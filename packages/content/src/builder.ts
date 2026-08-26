import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
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
  ContentExecutionPolicy,
  CruxConfig,
  ProcessManifest,
  DiscoveredContentFile,
  DiscoveredCruxContent,
  FrontmatterBlock,
  ProcessStepManifest,
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
  else validateConfig(input.config, context, diagnostics);

  const ids = new Set<string>();
  const copyIds = new Set<string>();
  const functions: ParsedContentFile[] = [];
  for (const file of input.files.filter((candidate) => candidate.kind !== "config")) {
    if (file.blocks.length === 0) diagnostics.push(error("frontmatter_missing", "Canonical markdown requires YAML frontmatter", file.relativePath));
    if (file.kind === "specific_function") functions.push(file);
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
  const headlessPath = join(outputDirectory, "capability-surface.generated.md");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(
    typescriptPath,
    `// Generated by @bridge-crux/content. Do not edit.\nexport const content = ${JSON.stringify(manifest, null, 2)} as const;\n`,
    "utf8",
  );
  await writeFile(headlessPath, renderCapabilitySurface(manifest), "utf8");
  return { manifest, diagnostics: validation.diagnostics, generatedFiles: [typescriptPath, manifestPath, headlessPath].sort() };
}

export class ContentBuildError extends Error {
  constructor(readonly diagnostics: ContentDiagnostic[]) {
    super(`BridgeCrux content validation failed with ${diagnostics.length} diagnostic(s)`);
    this.name = "ContentBuildError";
  }
}

function validateConfig(config: CruxConfig, context: ContentValidationContext, diagnostics: ContentDiagnostic[]): void {
  if (config.schemaVersion !== 3) {
    diagnostics.push(error("schema_version_removed", "BridgeCrux 0.3.0 requires schemaVersion 3. Schema 2 routeRegistry, intentRegistry, and execution.routes contracts were removed; migrate to nested routes and the canonical capabilities catalog", "crux.config.json", "schemaVersion"));
  }
  if (!string(config.id)) diagnostics.push(error("config_field_invalid", "Config id is required", "crux.config.json", "id"));
  if (!string(config.version)) diagnostics.push(error("config_field_invalid", "Config version is required", "crux.config.json", "version"));
  if (!string(config.locale)) diagnostics.push(error("config_field_invalid", "Config locale is required", "crux.config.json", "locale"));
  if (!Number.isInteger(config.conversationWindow) || config.conversationWindow <= 0) {
    diagnostics.push(error("conversation_window_invalid", "conversationWindow must be a positive integer", "crux.config.json", "conversationWindow"));
  }
  if (!stringArray(config.surfaces) || new Set(config.surfaces).size !== config.surfaces.length) {
    diagnostics.push(error("surface_registry_invalid", "surfaces must contain unique surface ids", "crux.config.json", "surfaces"));
  }
  const routeIds = new Set<string>();
  const paths = new Map<string, string>();
  if (!Array.isArray(config.routes) || config.routes.length === 0) diagnostics.push(error("route_catalog_invalid", "routes must contain at least one compact route with route-local intents", "crux.config.json", "routes"));
  for (const route of config.routes ?? []) {
    if (!string(route.id) || routeIds.has(route.id) || !string(route.summary) || !Array.isArray(route.intents) || route.intents.length === 0) {
      diagnostics.push(error("route_catalog_invalid", `Route ${route.id || "<empty>"} requires a unique id, summary, and intents`, "crux.config.json", `routes.${route.id || "unknown"}`));
      continue;
    }
    routeIds.add(route.id);
    const intentIds = new Set<string>();
    const aliases = new Set<string>();
    for (const intent of route.intents) {
      const key = `${route.id}/${intent.id}`;
      if (!string(intent.id) || intentIds.has(intent.id) || !string(intent.summary) || !string(intent.capabilityId)) {
        diagnostics.push(error("intent_catalog_invalid", `Intent ${key} requires a unique id, summary, and capabilityId`, "crux.config.json", `routes.${route.id}.intents`));
      }
      intentIds.add(intent.id);
      paths.set(key, intent.capabilityId);
      for (const alias of intent.aliases ?? []) {
        const normalized = alias.trim().toLocaleLowerCase();
        if (!normalized || aliases.has(normalized)) diagnostics.push(error("route_alias_overlap", `Route ${route.id} contains a duplicate or empty alias ${alias}`, "crux.config.json", `routes.${route.id}.intents.${intent.id}.aliases`));
        aliases.add(normalized);
      }
    }
  }
  const capabilityIds = new Set<string>();
  const capabilityPaths = new Set<string>();
  const expectedSurfaces = new Set(["conversation", "headless", ...(config.surfaces ?? [])]);
  if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) diagnostics.push(error("capability_catalog_invalid", "capabilities must contain at least one user outcome", "crux.config.json", "capabilities"));
  for (const capability of config.capabilities ?? []) {
    const path = `${capability.route}/${capability.intent}`;
    if (!string(capability.id) || capabilityIds.has(capability.id)) diagnostics.push(error("capability_id_invalid", `Capability ${capability.id || "<empty>"} requires a unique id`, "crux.config.json", `capabilities.${capability.id || "unknown"}`));
    capabilityIds.add(capability.id);
    if (capabilityPaths.has(path)) diagnostics.push(error("capability_path_duplicate", `Multiple capabilities bind ${path}`, "crux.config.json", `capabilities.${capability.id}`));
    capabilityPaths.add(path);
    if (paths.get(path) !== capability.id) diagnostics.push(error("capability_path_invalid", `Capability ${capability.id} and intent ${path} do not reference each other`, "crux.config.json", `capabilities.${capability.id}`));
    if (!string(capability.title) || !string(capability.description) || !string(capability.handlerId)) diagnostics.push(error("capability_binding_invalid", `Capability ${capability.id} requires title, description, and handlerId`, "crux.config.json", `capabilities.${capability.id}`));
    if (!stringArray(capability.operationIds) || new Set(capability.operationIds).size !== capability.operationIds.length) diagnostics.push(error("capability_operations_invalid", `Capability ${capability.id} operationIds must be unique strings`, "crux.config.json", `capabilities.${capability.id}.operationIds`));
    validateExecutionPolicy(capability.execution, context.operationIds, diagnostics, "crux.config.json", `capabilities.${capability.id}.execution`);
    if (capability.execution?.mode === "deterministic" && !string(capability.deterministicJustification)) diagnostics.push(error("deterministic_justification_missing", `Deterministic capability ${capability.id} requires deterministicJustification`, "crux.config.json", `capabilities.${capability.id}.deterministicJustification`));
    if (capability.execution?.mode === "hybrid" && capability.execution.thinkingLevel !== "high") diagnostics.push(error("hybrid_thinking_invalid", `Hybrid capability ${capability.id} requires high thinking`, "crux.config.json", `capabilities.${capability.id}.execution.thinkingLevel`));
    if (capability.execution?.mode === "agentic" && capability.execution.toolIds.length > 0 && capability.execution.thinkingLevel !== "high") diagnostics.push(error("agentic_tool_thinking_invalid", `Tool-using agentic capability ${capability.id} requires high thinking`, "crux.config.json", `capabilities.${capability.id}.execution.thinkingLevel`));
    if (capability.interaction?.mode === "generated_choices" && capability.execution?.mode !== "hybrid") diagnostics.push(error("generated_choice_mode_invalid", `Generated choices require hybrid execution for ${capability.id}`, "crux.config.json", `capabilities.${capability.id}.interaction`));
    if (capability.interaction?.mode === "generated_choices" && (capability.interaction.minimumOptions !== 2 || capability.interaction.maximumOptions !== 4 || capability.interaction.allowFreeText !== true)) diagnostics.push(error("generated_choice_contract_invalid", `Generated choices for ${capability.id} require 2–4 options and free-text continuation`, "crux.config.json", `capabilities.${capability.id}.interaction`));
    if (!capability.internalOnly) {
      const surfaces = new Map((capability.surfaces ?? []).map((surface) => [surface.surface, surface]));
      if ((capability.surfaces ?? []).some((surface) => !string(surface.surface)) || surfaces.size !== (capability.surfaces ?? []).length) diagnostics.push(error("capability_surface_duplicate", `Capability ${capability.id} surface ids must be non-empty and unique`, "crux.config.json", `capabilities.${capability.id}.surfaces`));
      for (const surface of expectedSurfaces) if (!surfaces.has(surface)) diagnostics.push(error("capability_surface_missing", `Capability ${capability.id} is missing ${surface} parity`, "crux.config.json", `capabilities.${capability.id}.surfaces`));
      for (const surface of capability.surfaces ?? []) {
        if (!expectedSurfaces.has(surface.surface)) diagnostics.push(error("capability_surface_unknown", `Capability ${capability.id} binds undeclared surface ${surface.surface}`, "crux.config.json", `capabilities.${capability.id}.surfaces`));
        if (!stringArray(surface.entrypoints) || surface.entrypoints.length === 0) diagnostics.push(error("surface_entrypoint_missing", `Capability ${capability.id}/${surface.surface} requires entrypoints`, "crux.config.json", `capabilities.${capability.id}.surfaces`));
        if (!["public", "authenticated", "owner", "internal"].includes(surface.access) || !string(surface.states?.loading) || !string(surface.states?.success) || !string(surface.states?.error)) diagnostics.push(error("surface_state_contract_missing", `Capability ${capability.id}/${surface.surface} requires access plus loading, success, and error states`, "crux.config.json", `capabilities.${capability.id}.surfaces`));
        if (surface.presentationOnly && !string(surface.rationale)) diagnostics.push(error("surface_rationale_missing", `Presentation-only binding ${capability.id}/${surface.surface} requires a rationale`, "crux.config.json", `capabilities.${capability.id}.surfaces`));
      }
    } else if (!string(capability.internalReason)) diagnostics.push(error("internal_capability_reason_missing", `Internal capability ${capability.id} requires internalReason`, "crux.config.json", `capabilities.${capability.id}.internalReason`));
    for (const operationId of lifecycleOperations(capability.lifecycle)) {
      if (!capability.operationIds.includes(operationId)) diagnostics.push(error("lifecycle_operation_missing", `Capability ${capability.id} lifecycle operation ${operationId} is outside operationIds`, "crux.config.json", `capabilities.${capability.id}.lifecycle`));
    }
    if (capability.destructiveAction && (!Number.isInteger(capability.destructiveAction.expiryMs) || capability.destructiveAction.expiryMs <= 0)) diagnostics.push(error("destructive_expiry_invalid", `Destructive capability ${capability.id} requires a positive expiryMs`, "crux.config.json", `capabilities.${capability.id}.destructiveAction.expiryMs`));
  }
  for (const [path, capabilityId] of paths) if (!capabilityIds.has(capabilityId)) diagnostics.push(error("capability_missing", `Intent ${path} references missing capability ${capabilityId}`, "crux.config.json", "routes"));
  for (const [name, profile] of Object.entries(config.models ?? {})) {
    if (record(profile) && ["thinking", "temperature", "topP", "topK"].some((field) => field in profile)) {
      diagnostics.push(error("model_sampling_removed", "BridgeCrux 0.3 declares thinking in routing/capability policies and does not send temperature, topP, or topK to Gemini 3.5", "crux.config.json", `models.${name}`));
    }
    if (record(profile) && profile["provider"] === "google" && profile["model"] !== "gemini-3.5-flash-lite") diagnostics.push(error("gemini_model_invalid", `Google profile ${name} must use gemini-3.5-flash-lite`, "crux.config.json", `models.${name}.model`));
  }
  if (config.routing?.freeformThinkingLevel !== "medium" && config.routing?.freeformThinkingLevel !== "high") diagnostics.push(error("router_thinking_invalid", "Freeform routing requires medium or evaluation-backed high thinking", "crux.config.json", "routing.freeformThinkingLevel"));
  if (config.routing?.freeformThinkingLevel === "high" && (config.routing.highThinkingEvaluation?.status !== "passed" || !stringArray(config.routing.highThinkingEvaluation.evidence) || config.routing.highThinkingEvaluation.evidence.length === 0)) diagnostics.push(error("router_high_evaluation_missing", "High-thinking routing requires a passed evaluation with evidence", "crux.config.json", "routing.highThinkingEvaluation"));
  const styles = config.communication?.availableStyles ?? [];
  if (!Array.isArray(styles) || styles.length === 0 || styles.some((style) => style !== "casual" && style !== "pragmatic") || new Set(styles).size !== styles.length || !styles.includes(config.communication?.defaultStyle)) diagnostics.push(error("communication_style_invalid", "Communication styles must contain only casual/pragmatic, be unique, and include the default", "crux.config.json", "communication"));
  if (config.communication?.selection !== "developer_fixed" && config.communication?.selection !== "user_selectable") diagnostics.push(error("communication_selection_invalid", "Communication selection must be developer_fixed or user_selectable", "crux.config.json", "communication.selection"));
  if (!capabilityIds.has(config.onboarding?.firstTurnCapabilityId)) diagnostics.push(error("onboarding_capability_missing", "onboarding.firstTurnCapabilityId must reference a capability", "crux.config.json", "onboarding.firstTurnCapabilityId"));
  if (config.onboarding?.openControl !== true && config.onboarding?.openControl !== false) diagnostics.push(error("onboarding_open_control_invalid", "onboarding.openControl must be boolean", "crux.config.json", "onboarding.openControl"));
  for (const command of ["/", "/start", "/help"]) if (!config.onboarding?.commandEntrypoints?.includes(command)) diagnostics.push(error("onboarding_command_missing", `Onboarding must include ${command}`, "crux.config.json", "onboarding.commandEntrypoints"));
  const affordanceSurfaces = new Set((config.channelAffordances ?? []).map((affordance) => affordance.surface));
  if (affordanceSurfaces.size !== (config.channelAffordances ?? []).length) diagnostics.push(error("channel_affordance_duplicate", "Channel affordance surfaces must be unique", "crux.config.json", "channelAffordances"));
  for (const affordance of config.channelAffordances ?? []) {
    if (!string(affordance.surface) || !string(affordance.description) || !stringArray(affordance.commands) || new Set(affordance.commands).size !== affordance.commands.length || !["public", "authenticated", "internal"].includes(affordance.audience)) diagnostics.push(error("channel_affordance_invalid", `Channel affordance ${affordance.surface || "<empty>"} requires a description, unique commands, and valid audience`, "crux.config.json", "channelAffordances"));
  }
  for (const surface of config.surfaces ?? []) if (!affordanceSurfaces.has(surface)) diagnostics.push(error("channel_affordance_missing", `Surface ${surface} requires a channel affordance contract`, "crux.config.json", "channelAffordances"));
  const invariantIds = new Set<string>();
  const invariantKinds = new Set(["surface_completeness", "canonical_order", "provenance", "preference_default", "auth_forward_compatibility", "hosting_audience"]);
  if (!Array.isArray(config.invariants) || config.invariants.length === 0) diagnostics.push(error("product_invariant_missing", "Every crux must declare at least one independently verifiable product invariant", "crux.config.json", "invariants"));
  for (const invariant of config.invariants ?? []) {
    if (!string(invariant.id) || invariantIds.has(invariant.id) || !invariantKinds.has(invariant.kind) || !string(invariant.description) || !stringArray(invariant.verificationIds) || invariant.verificationIds.length === 0 || new Set(invariant.verificationIds).size !== invariant.verificationIds.length || (invariant.capabilityIds !== undefined && (!stringArray(invariant.capabilityIds) || new Set(invariant.capabilityIds).size !== invariant.capabilityIds.length))) {
      diagnostics.push(error("product_invariant_invalid", `Invariant ${invariant.id || "<empty>"} requires a unique id, description, and verificationIds`, "crux.config.json", `invariants.${invariant.id || "unknown"}`));
    }
    invariantIds.add(invariant.id);
    for (const capabilityId of invariant.capabilityIds ?? []) if (!capabilityIds.has(capabilityId)) diagnostics.push(error("product_invariant_capability_missing", `Invariant ${invariant.id} references missing capability ${capabilityId}`, "crux.config.json", `invariants.${invariant.id}.capabilityIds`));
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

  if (file.kind === "specific_function" || file.kind === "process") {
    const expectedKind = file.kind;
    if (metadata["kind"] !== expectedKind) diagnostics.push(error("content_kind_invalid", `Expected kind ${expectedKind}`, file.relativePath, "kind", block.line));
    const routes = strings(metadata[file.kind === "process" ? "entry_routes" : "routes"]);
    for (const route of routes) {
      if (!config?.routes.some((candidate) => candidate.id === route)) diagnostics.push(error("route_missing", `Undeclared route ${route}`, file.relativePath, "routes", block.line));
    }
    if (file.kind === "specific_function") {
      const intents = strings(metadata["intents"]);
      for (const intent of intents) {
        if (!routes.some((route) => config?.routes.find((candidate) => candidate.id === route)?.intents.some((candidate) => candidate.id === intent))) {
          diagnostics.push(error("intent_missing", `Undeclared intent ${intent}`, file.relativePath, "intents", block.line));
        }
      }
      for (const tool of strings(metadata["tools"])) {
        if (!context.operationIds.includes(tool)) diagnostics.push(error("operation_missing", `Unknown operation ${tool}`, file.relativePath, "tools", block.line));
      }
      requireArray(metadata, "state_reads", file, block, diagnostics);
      requireArray(metadata, "state_writes", file, block, diagnostics);
    } else {
      const advanceOperationId = metadata["advance_operation"];
      if (!string(advanceOperationId) || !context.operationIds.includes(advanceOperationId)) diagnostics.push(error("process_advance_operation_invalid", "Process advance_operation must reference a declared operation", file.relativePath, "advance_operation", block.line));
      const steps = processSteps(metadata["steps"]);
      const stepIds = steps.map((step) => step.id);
      if (steps.length === 0 || new Set(stepIds).size !== stepIds.length) diagnostics.push(error("process_steps_invalid", "Process steps must be non-empty, structured, and unique", file.relativePath, "steps", block.line));
      for (const step of steps) {
        if (step.nextStepId && !stepIds.includes(step.nextStepId)) diagnostics.push(error("process_transition_missing", `Step ${step.id} references missing step ${step.nextStepId}`, file.relativePath, "steps", block.line));
        validateProcessStep(step, string(advanceOperationId) ? advanceOperationId : "", context.operationIds, diagnostics, file.relativePath, block.line);
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
  const processes: ProcessManifest[] = [];
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
      } else if (file.kind === "process") {
        processes.push({
          id: String(block.metadata["id"]),
          version: String(block.metadata["version"]),
          entryRoutes: strings(block.metadata["entry_routes"]),
          advanceOperationId: String(block.metadata["advance_operation"]),
          steps: processSteps(block.metadata["steps"]),
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
  processes.sort((left, right) => left.id.localeCompare(right.id));
  const capabilityManifest = [...config.capabilities].sort((left, right) => left.id.localeCompare(right.id));
  const routeChecklist = capabilityManifest
    .map((capability) => ({
      pathId: `${capability.route}/${capability.intent}`,
      capabilityId: capability.id,
      route: capability.route,
      intent: capability.intent,
      execution: capability.execution,
      status: "designed" as const,
    }))
    .sort((left, right) => left.pathId.localeCompare(right.pathId));
  const handlerStubs = routeChecklist.map((row) => ({
    id: config.capabilities.find((capability) => capability.id === row.capabilityId)!.handlerId,
    capabilityId: row.capabilityId,
    route: row.route,
    intent: row.intent,
    operationIds: [...config.capabilities.find((capability) => capability.id === row.capabilityId)!.operationIds],
  }));
  const surfaceMatrix = capabilityManifest
    .flatMap((capability) => capability.surfaces.map((surface) => ({
      capabilityId: capability.id,
      route: capability.route,
      intent: capability.intent,
      surface: surface.surface,
      entrypoints: [...surface.entrypoints],
      access: surface.access,
      states: { ...surface.states },
    })))
    .sort((left, right) => `${left.capabilityId}/${left.surface}`.localeCompare(`${right.capabilityId}/${right.surface}`));
  const regressionScenarios: ContentManifest["regressionScenarios"] = [
    ...routeChecklist.map((row) => ({
      id: `route:${row.pathId}`,
      kind: "route" as const,
      expectedMode: row.execution.mode,
      ...(row.execution.mode !== "deterministic" ? { expectedThinkingLevel: row.execution.thinkingLevel } : {}),
      expectedToolIds: [...row.execution.toolIds],
    })),
    ...processes.flatMap((process) =>
      process.steps.map((step) => ({
        id: `process:${process.id}:${step.id}`,
        kind: "process_step" as const,
        expectedMode: step.execution.mode,
        ...(step.execution.mode !== "deterministic" ? { expectedThinkingLevel: step.execution.thinkingLevel } : {}),
        expectedToolIds: [...step.execution.toolIds],
      })),
    ),
    ...surfaceMatrix.map((surface) => {
      const execution = config.capabilities.find((capability) => capability.id === surface.capabilityId)!.execution;
      return {
        id: `surface:${surface.capabilityId}:${surface.surface}`,
        kind: "surface" as const,
        expectedMode: execution.mode,
        ...(execution.mode !== "deterministic" ? { expectedThinkingLevel: execution.thinkingLevel } : {}),
        expectedToolIds: [...execution.toolIds],
        surface: surface.surface,
      };
    }),
  ];
  return {
    schemaVersion: 3,
    crux: { id: config.id, version: config.version, locale: config.locale },
    config,
    systemPrompt: system.source,
    assistants: assistants.source,
    specificFunctions,
    processes,
    capabilityManifest,
    surfaceMatrix,
    routeChecklist,
    handlerStubs,
    regressionScenarios,
    generatedAt: "1970-01-01T00:00:00.000Z",
    sourceFiles: parsed.files.map((file) => relative(parsed.root, file.path).replaceAll("\\", "/")).sort(),
  };
}

function renderCapabilitySurface(manifest: ContentManifest): string {
  const lines = [
    `# ${manifest.crux.id} Capability Surface`,
    "",
    "Generated by BridgeCrux for headless review. Edit canonical content, not this file.",
    "",
    "| Capability | Route / intent | Execution | Surfaces | Operations |",
    "|---|---|---|---|---|",
  ];
  for (const capability of manifest.capabilityManifest) {
    const surfaces = capability.surfaces.map((surface) => surface.surface).join(", ");
    lines.push(`| ${capability.id} | ${capability.route}/${capability.intent} | ${capability.execution.mode} | ${surfaces} | ${capability.operationIds.join(", ") || "none"} |`);
  }
  lines.push("", "## Entrypoints", "");
  for (const row of manifest.surfaceMatrix) {
    lines.push(`- ${row.capabilityId} / ${row.surface} [${row.access}]: ${row.entrypoints.join(", ")}; loading=${row.states.loading}; success=${row.states.success}; error=${row.states.error}${row.states.empty ? `; empty=${row.states.empty}` : ""}`);
  }
  return `${lines.join("\n")}\n`;
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

function processSteps(value: unknown): ProcessStepManifest[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!record(candidate) || !string(candidate["id"]) || !record(candidate["input"]) || !record(candidate["execution"])) return [];
    const execution = parseExecutionPolicy(candidate["execution"]);
    const confirmation = candidate["confirmation_policy"];
    const completionMode = candidate["completion"];
    if (!execution || execution.mode === "agentic" || (completionMode !== "controller" && completionMode !== "model_tool") || (confirmation !== "never" && confirmation !== "on_correction" && confirmation !== "always")) return [];
    const input = normalizeProcessInput(candidate["id"], candidate["input"]);
    if (!input) return [];
    return [{
      id: candidate["id"],
      input,
      execution,
      completionMode,
      ...(string(candidate["next_step"]) ? { nextStepId: candidate["next_step"] } : {}),
      confirmationPolicy: confirmation,
      missingFieldQuestions: stringRecord(candidate["missing_field_questions"]),
    }];
  });
}

function normalizeProcessInput(stepId: string, value: Record<string, unknown>): Record<string, unknown> | undefined {
  const mode = value["mode"];
  if (mode === "closed_choice") {
    return {
      mode,
      control: {
        id: stepId,
        kind: "deterministic_process",
        field: value["field"],
        prompt: value["prompt"],
        options: value["options"],
        allowFreeText: false,
      },
    };
  }
  if (mode === "structured" || mode === "open_text" || mode === "composite") {
    return { mode, schema: value["schema"], requiredFields: strings(value["required_fields"]) };
  }
  return undefined;
}

function parseExecutionPolicy(value: Record<string, unknown>): ContentExecutionPolicy | undefined {
  const mode = value["mode"];
  const toolIds = strings(value["tools"]);
  if (mode === "deterministic") return toolIds.length === 0 ? { mode, toolIds: [] } : undefined;
  if (mode !== "hybrid" && mode !== "agentic") return undefined;
  const thinkingLevel = value["thinking"];
  if (thinkingLevel !== "medium" && thinkingLevel !== "high") return undefined;
  if (mode === "hybrid") return thinkingLevel === "high" ? { mode, thinkingLevel, toolIds } : undefined;
  return { mode: "agentic", thinkingLevel, toolIds };
}

function validateExecutionPolicy(
  policy: ContentExecutionPolicy,
  operationIds: string[],
  diagnostics: ContentDiagnostic[],
  file: string,
  field: string,
): void {
  if (policy.mode === "deterministic") {
    if (policy.toolIds.length > 0) diagnostics.push(error("deterministic_tools_invalid", "Deterministic execution makes zero model calls and exposes no model tools", file, field));
  } else if (policy.thinkingLevel !== "medium" && policy.thinkingLevel !== "high") {
    diagnostics.push(error("execution_thinking_invalid", `${policy.mode} execution requires medium or high thinking`, file, field));
  }
  if (policy.mode === "hybrid" && policy.thinkingLevel !== "high") diagnostics.push(error("hybrid_thinking_invalid", "Hybrid execution requires high thinking", file, field));
  if (policy.mode === "agentic" && policy.toolIds.length > 0 && policy.thinkingLevel !== "high") diagnostics.push(error("agentic_tool_thinking_invalid", "Tool-using agentic execution requires high thinking", file, field));
  for (const toolId of policy.toolIds) {
    if (!operationIds.includes(toolId)) diagnostics.push(error("execution_tool_missing", `Unknown execution tool ${toolId}`, file, field));
  }
}

function validateProcessStep(
  step: ProcessStepManifest,
  advanceOperationId: string,
  operationIds: string[],
  diagnostics: ContentDiagnostic[],
  file: string,
  line: number,
): void {
  const field = `steps.${step.id}`;
  validateExecutionPolicy(step.execution, operationIds, diagnostics, file, field);
  const mode = step.input["mode"];
  if (step.execution.mode === "deterministic" && step.completionMode !== "controller") diagnostics.push(error("deterministic_completion_invalid", "Deterministic process steps require controller completion", file, field, line));
  if (step.completionMode === "model_tool" && (step.execution.mode !== "hybrid" || !step.execution.toolIds.includes(advanceOperationId))) diagnostics.push(error("model_tool_completion_invalid", `Model-tool completion requires a hybrid step exposing ${advanceOperationId}`, file, field, line));
  if (step.execution.mode === "deterministic") {
    if (mode !== "closed_choice") diagnostics.push(error("deterministic_input_invalid", "Deterministic process steps require closed_choice input", file, field, line));
    const control = record(step.input["control"]) ? step.input["control"] : {};
    const options = Array.isArray(control["options"]) ? control["options"].filter(record) : [];
    const optionIds = options.flatMap((option) => string(option["id"]) ? [option["id"]] : []);
    if (!string(control["field"]) || !string(control["prompt"]) || options.length < 2 || new Set(optionIds).size !== options.length) {
      diagnostics.push(error("closed_choice_invalid", "Closed-choice input requires field, prompt, and at least two unique id/label/value options", file, field, line));
    }
    for (const option of options) {
      if (!string(option["label"]) || !("value" in option)) diagnostics.push(error("closed_choice_option_invalid", `Step ${step.id} has an invalid choice option`, file, field, line));
    }
    return;
  }
  if (mode !== "structured" && mode !== "open_text" && mode !== "composite") {
    diagnostics.push(error("hybrid_input_invalid", "Hybrid process steps require structured, open_text, or composite input", file, field, line));
  }
  if (!record(step.input["schema"]) || !stringArray(step.input["requiredFields"])) {
    diagnostics.push(error("hybrid_schema_invalid", "Hybrid process input requires a schema and required_fields", file, field, line));
  }
}

function stringRecord(value: unknown): Record<string, string> {
  if (!record(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function lifecycleOperations(lifecycle: CruxConfig["capabilities"][number]["lifecycle"]): string[] {
  if (!lifecycle) return [];
  return [
    lifecycle.createOperationId,
    lifecycle.persistOperationId,
    lifecycle.rediscoverOperationId,
    lifecycle.reopenOperationId,
    lifecycle.archiveOperationId,
    lifecycle.deleteOperationId,
  ].filter((value): value is string => Boolean(value));
}

function kind(relativePath: string): ContentFileKind {
  if (relativePath === "crux.config.json") return "config";
  if (relativePath === "system.prompt.md") return "system";
  if (relativePath === "assistants.md") return "assistants";
  if (relativePath === "specific-functions/processes.md") return "process";
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
