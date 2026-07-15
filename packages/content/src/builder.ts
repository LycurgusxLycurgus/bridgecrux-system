import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  ContentBuildInput,
  ContentBuildResult,
  ContentBuilder,
  ContentDiagnostic,
  ContentFileKind,
  ContentManifest,
  ContentValidationContext,
  ContentValidationResult,
  CruxConfig,
  DeterministicProcessManifest,
  DiscoveredContentFile,
  DiscoveredCruxContent,
  FrontmatterBlock,
  ParsedContentFile,
  ParsedCruxContent,
  SpecificFunctionManifest,
} from "./types.js";

const REQUIRED_TOP_LEVEL = ["crux.config.json", "system.prompt.md", "assistants.md"] as const;

export class DefaultContentBuilder implements ContentBuilder {
  discover(root: string): Promise<DiscoveredCruxContent> {
    return discoverCruxContent(root);
  }

  parse(input: DiscoveredCruxContent): Promise<ParsedCruxContent> {
    return parseCruxContent(input);
  }

  validate(input: ParsedCruxContent, context: ContentValidationContext): ContentValidationResult {
    return validateCruxContent(input, context);
  }

  build(input: ContentBuildInput): Promise<ContentBuildResult> {
    return buildCruxContent(input);
  }
}

export async function discoverCruxContent(rootInput: string): Promise<DiscoveredCruxContent> {
  const root = resolve(rootInput);
  const files: DiscoveredContentFile[] = REQUIRED_TOP_LEVEL.map((relativePath) => ({
    path: join(root, relativePath),
    relativePath,
    kind: kind(relativePath),
  }));
  const specificDirectory = join(root, "specific-functions");
  try {
    const entries = await readdir(specificDirectory, { withFileTypes: true });
    for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith(".md")).sort(byName)) {
      const relativePath = `specific-functions/${entry.name}`;
      files.push({ path: join(specificDirectory, entry.name), relativePath, kind: kind(relativePath) });
    }
  } catch {
    // Validation reports the missing function directory/file with a stable diagnostic.
  }
  return { root, files };
}

export async function parseCruxContent(input: DiscoveredCruxContent): Promise<ParsedCruxContent> {
  const files: ParsedContentFile[] = [];
  let config: CruxConfig | undefined;
  for (const file of input.files) {
    try {
      const source = await readFile(file.path, "utf8");
      if (file.kind === "config") {
        config = JSON.parse(source) as CruxConfig;
        files.push({ ...file, source, blocks: [] });
      } else {
        files.push({ ...file, source, blocks: parseFrontmatterBlocks(source) });
      }
    } catch {
      // Missing and malformed files are represented in validation diagnostics.
    }
  }
  return { root: input.root, ...(config ? { config } : {}), files };
}

export function parseFrontmatterBlocks(source: string): FrontmatterBlock[] {
  const pattern = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*$/gm;
  const matches = [...source.matchAll(pattern)];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const next = matches[index + 1]?.index ?? source.length;
    const metadata = parseYaml(match[1] ?? "") as unknown;
    if (!record(metadata)) throw new Error(`Frontmatter at line ${lineAt(source, start)} must be a mapping`);
    return { metadata, body: source.slice(end, next).trim(), line: lineAt(source, start) };
  });
}

export function validateCruxContent(input: ParsedCruxContent, context: ContentValidationContext): ContentValidationResult {
  const diagnostics: ContentDiagnostic[] = [];
  for (const required of REQUIRED_TOP_LEVEL) {
    if (!input.files.some((file) => file.relativePath === required)) {
      diagnostics.push(error("required_file_missing", `Required file ${required} is missing`, required));
    }
  }
  if (!input.config) diagnostics.push(error("config_invalid", "crux.config.json is missing or invalid JSON", "crux.config.json"));
  else validateConfig(input.config, diagnostics);

  const ids = new Set<string>();
  const copyIds = new Set<string>();
  const functions: ParsedContentFile[] = [];
  for (const file of input.files.filter((candidate) => candidate.kind !== "config")) {
    if (file.blocks.length === 0) diagnostics.push(error("frontmatter_missing", "Canonical markdown requires YAML frontmatter", file.relativePath));
    if (file.kind === "specific_function" && basename(file.relativePath) !== "deterministic-processes.md") functions.push(file);
    for (const block of file.blocks) validateBlock(file, block, input.config, context, ids, copyIds, diagnostics);
  }
  if (functions.length === 0) {
    diagnostics.push(error("specific_functions_empty", "At least one specific-function markdown file is required", "specific-functions"));
  }
  const assistants = input.files.find((file) => file.kind === "assistants");
  if (assistants && (!assistants.source.includes("Task-Signal Smart Router") || !assistants.source.includes("| Task signal |"))) {
    diagnostics.push(error("router_table_missing", "assistants.md must contain the Task-Signal Smart Router table", assistants.relativePath));
  }
  return { ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"), diagnostics: sortDiagnostics(diagnostics) };
}

export async function buildCruxContent(input: ContentBuildInput): Promise<ContentBuildResult> {
  const discovered = await discoverCruxContent(input.root);
  const parsed = await parseCruxContent(discovered);
  const validation = validateCruxContent(parsed, { operationIds: input.operationIds });
  if (!validation.ok) throw new ContentBuildError(validation.diagnostics);
  const manifest = createManifest(parsed);
  const outputDirectory = resolve(input.outputDirectory ?? join(input.root, "generated"));
  await mkdir(outputDirectory, { recursive: true });
  const manifestPath = join(outputDirectory, "manifest.generated.json");
  const typescriptPath = join(outputDirectory, "content.generated.ts");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(
    typescriptPath,
    `// Generated by @bridge-crux/content. Do not edit.\nexport const content = ${JSON.stringify(manifest, null, 2)} as const;\n`,
    "utf8",
  );
  return { manifest, diagnostics: validation.diagnostics, generatedFiles: [typescriptPath, manifestPath].sort() };
}

export class ContentBuildError extends Error {
  constructor(readonly diagnostics: ContentDiagnostic[]) {
    super(`BridgeCrux content validation failed with ${diagnostics.length} diagnostic(s)`);
    this.name = "ContentBuildError";
  }
}

function validateConfig(config: CruxConfig, diagnostics: ContentDiagnostic[]): void {
  if (!string(config.id)) diagnostics.push(error("config_field_invalid", "Config id is required", "crux.config.json", "id"));
  if (!string(config.version)) diagnostics.push(error("config_field_invalid", "Config version is required", "crux.config.json", "version"));
  if (!string(config.locale)) diagnostics.push(error("config_field_invalid", "Config locale is required", "crux.config.json", "locale"));
  if (!stringArray(config.routeRegistry) || new Set(config.routeRegistry).size !== config.routeRegistry.length) {
    diagnostics.push(error("route_registry_invalid", "routeRegistry must contain unique route ids", "crux.config.json", "routeRegistry"));
  }
  for (const [route, intents] of Object.entries(config.intentRegistry ?? {})) {
    if (!config.routeRegistry?.includes(route) || !stringArray(intents) || new Set(intents).size !== intents.length) {
      diagnostics.push(error("intent_registry_invalid", `Intent registry for ${route} is invalid`, "crux.config.json", `intentRegistry.${route}`));
    }
  }
  if (!Number.isInteger(config.conversationWindow) || config.conversationWindow <= 0) {
    diagnostics.push(error("conversation_window_invalid", "conversationWindow must be a positive integer", "crux.config.json", "conversationWindow"));
  }
  if (config.models?.router?.thinking !== "low") {
    diagnostics.push(error("router_thinking_invalid", "Router thinking must be low", "crux.config.json", "models.router.thinking"));
  }
  if (config.models?.tutor?.thinking !== "high") {
    diagnostics.push(error("tutor_thinking_invalid", "Tutor thinking must be high", "crux.config.json", "models.tutor.thinking"));
  }
  if ((config.models?.router?.temperature ?? 0.2) !== 0.2) {
    diagnostics.push(error("router_temperature_invalid", "Router temperature must be 0.2", "crux.config.json", "models.router.temperature"));
  }
  if (config.feedback?.enabled && !config.feedback.endpoint) {
    diagnostics.push(error("feedback_endpoint_missing", "Enabled feedback requires an endpoint", "crux.config.json", "feedback.endpoint"));
  }
}

function validateBlock(
  file: ParsedContentFile,
  block: FrontmatterBlock,
  config: CruxConfig | undefined,
  context: ContentValidationContext,
  ids: Set<string>,
  copyIds: Set<string>,
  diagnostics: ContentDiagnostic[],
): void {
  const metadata = block.metadata;
  const id = metadata["id"] ?? metadata["name"];
  if (!string(id)) diagnostics.push(error("content_id_missing", "Frontmatter id or name is required", file.relativePath, "id", block.line));
  else if (ids.has(id)) diagnostics.push(error("content_id_duplicate", `Duplicate content id ${id}`, file.relativePath, "id", block.line));
  else ids.add(id);
  if (!string(metadata["version"])) diagnostics.push(error("content_version_missing", "Frontmatter version is required", file.relativePath, "version", block.line));

  if (file.kind === "specific_function" || file.kind === "deterministic_process") {
    const expectedKind = file.kind;
    if (metadata["kind"] !== expectedKind) diagnostics.push(error("content_kind_invalid", `Expected kind ${expectedKind}`, file.relativePath, "kind", block.line));
    const routes = strings(metadata[file.kind === "deterministic_process" ? "entry_routes" : "routes"]);
    for (const route of routes) {
      if (!config?.routeRegistry.includes(route)) diagnostics.push(error("route_missing", `Undeclared route ${route}`, file.relativePath, "routes", block.line));
    }
    if (file.kind === "specific_function") {
      const intents = strings(metadata["intents"]);
      for (const intent of intents) {
        if (!routes.some((route) => config?.intentRegistry[route]?.includes(intent))) {
          diagnostics.push(error("intent_missing", `Undeclared intent ${intent}`, file.relativePath, "intents", block.line));
        }
      }
      for (const tool of strings(metadata["tools"])) {
        if (!context.operationIds.includes(tool)) diagnostics.push(error("operation_missing", `Unknown operation ${tool}`, file.relativePath, "tools", block.line));
      }
      requireArray(metadata, "state_reads", file, block, diagnostics);
      requireArray(metadata, "state_writes", file, block, diagnostics);
    } else {
      const steps = strings(metadata["steps"]);
      if (steps.length === 0 || new Set(steps).size !== steps.length) diagnostics.push(error("process_steps_invalid", "Process steps must be non-empty and unique", file.relativePath, "steps", block.line));
      for (const transition of strings(metadata["transitions"])) {
        if (!steps.includes(transition)) diagnostics.push(error("process_transition_missing", `Transition references missing step ${transition}`, file.relativePath, "transitions", block.line));
      }
    }
  }
  for (const copyId of strings(metadata["copy_ids"])) {
    if (copyIds.has(copyId)) diagnostics.push(error("copy_id_duplicate", `Duplicate copy id ${copyId}`, file.relativePath, "copy_ids", block.line));
    copyIds.add(copyId);
  }
}

function createManifest(parsed: ParsedCruxContent): ContentManifest {
  const config = parsed.config;
  if (!config) throw new Error("Validated content did not contain a config");
  const system = parsed.files.find((file) => file.kind === "system");
  const assistants = parsed.files.find((file) => file.kind === "assistants");
  if (!system || !assistants) throw new Error("Validated content did not contain required prompts");
  const specificFunctions: SpecificFunctionManifest[] = [];
  const deterministicProcesses: DeterministicProcessManifest[] = [];
  for (const file of parsed.files) {
    for (const block of file.blocks) {
      if (file.kind === "specific_function") {
        specificFunctions.push({
          id: String(block.metadata["id"]),
          title: String(block.metadata["title"]),
          version: String(block.metadata["version"]),
          routes: strings(block.metadata["routes"]),
          intents: strings(block.metadata["intents"]),
          tools: strings(block.metadata["tools"]),
          stateReads: strings(block.metadata["state_reads"]),
          stateWrites: strings(block.metadata["state_writes"]),
          source: file.relativePath,
          body: block.body,
        });
      } else if (file.kind === "deterministic_process") {
        deterministicProcesses.push({
          id: String(block.metadata["id"]),
          version: String(block.metadata["version"]),
          entryRoutes: strings(block.metadata["entry_routes"]),
          steps: strings(block.metadata["steps"]),
          stateReads: strings(block.metadata["state_reads"]),
          stateWrites: strings(block.metadata["state_writes"]),
          allowsDeferral: block.metadata["allows_deferral"] === true,
          source: file.relativePath,
          body: block.body,
        });
      }
    }
  }
  specificFunctions.sort((left, right) => left.id.localeCompare(right.id));
  deterministicProcesses.sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: 1,
    crux: { id: config.id, version: config.version, locale: config.locale },
    config,
    systemPrompt: system.source,
    assistants: assistants.source,
    specificFunctions,
    deterministicProcesses,
    generatedAt: "1970-01-01T00:00:00.000Z",
    sourceFiles: parsed.files.map((file) => relative(parsed.root, file.path).replaceAll("\\", "/")).sort(),
  };
}

function requireArray(
  metadata: Record<string, unknown>,
  field: string,
  file: ParsedContentFile,
  block: FrontmatterBlock,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(metadata[field])) diagnostics.push(error("content_field_invalid", `${field} must be an array`, file.relativePath, field, block.line));
}

function kind(relativePath: string): ContentFileKind {
  if (relativePath === "crux.config.json") return "config";
  if (relativePath === "system.prompt.md") return "system";
  if (relativePath === "assistants.md") return "assistants";
  if (relativePath === "specific-functions/deterministic-processes.md") return "deterministic_process";
  return "specific_function";
}

function error(code: string, message: string, file: string, field?: string, line?: number): ContentDiagnostic {
  return { severity: "error", code, message, file, ...(line ? { line } : {}), ...(field ? { field } : {}) };
}

function sortDiagnostics(diagnostics: ContentDiagnostic[]): ContentDiagnostic[] {
  return diagnostics.sort((left, right) => `${left.file}:${left.line ?? 0}:${left.code}`.localeCompare(`${right.file}:${right.line ?? 0}:${right.code}`));
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(string) : [];
}

function string(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(string);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function byName(left: { name: string }, right: { name: string }): number {
  return left.name.localeCompare(right.name);
}
