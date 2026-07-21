import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BRIDGECRUX_SKILL_NAMES = [
  "anticipate-crux-routes",
  "use-bridgecrux-primitives",
  "write-crux-prompts",
] as const;

export const MANAGED_BLOCK_START = "<!-- bridgecrux:managed:start -->";
export const MANAGED_BLOCK_END = "<!-- bridgecrux:managed:end -->";

export const BRIDGECRUX_MANAGED_INSTRUCTIONS = `${MANAGED_BLOCK_START}
## BridgeCrux Agentic-App Instructions

BridgeCrux is the crux operating layer for this agentic application. Treat it as versioned repository knowledge that the agent does not know until the installed skills and package evidence are read. At the start of every nontrivial turn, activate \`$use-bridgecrux-primitives\` whenever the work may inspect, explain, plan, change, debug, validate, or extend task-signal routing, canonical content, handler bindings, execution policies, deterministic or hybrid processes, operations, persistence, memory, reports, model/tool behavior, channel behavior, conformance, or end-to-end agent behavior. If relevance or framework behavior is uncertain, activate the skill and inspect before making BridgeCrux claims or edits. Re-open the skill, its runtime map, and installed package contracts whenever a knowledge gap appears; never fill that gap from model memory.

In the BridgeCrux repository, canonical skill sources live under \`skills/\`; consumer installations copy integrity-verified bundles into the configured skills root.

Installed capabilities:

- \`$use-bridgecrux-primitives\` is the mandatory coordinator for integrating, composing, auditing, testing, and repairing BridgeCrux runtime behavior. It preserves the authority chain from normalized inbound state through validated routing, fixed execution policy, scoped tools, declared operations, persistence, truthful copy, delivery, and audit.
- \`$anticipate-crux-routes\` derives and maintains the application task surface, route implementation checklist, one all-route simulation, duplicate/contradiction audit, handler/operation coverage, and typed gap dispositions. Use it when the task surface is new, changing, incomplete, or under audit.
- \`$write-crux-prompts\` creates or revises the canonical \`system.prompt.md\`, \`assistants.md\`, specific-function, and established-process content from verified application behavior. Use it whenever canonical crux instructions change.
- \`@bridge-crux/kit\` exposes the provider-neutral core, canonical content builder, Convex persistence primitives, Gemini model adapter, Telegram channel adapter, and the \`bridgecrux build|validate|doctor\` CLI.
- \`@bridge-crux/skills\` installs these three skills and maintains this bounded instruction block.

For a new crux or product-surface change, run the skills in this order: \`$anticipate-crux-routes\`, \`$write-crux-prompts\`, then \`$use-bridgecrux-primitives\` for runtime integration and whole-turn validation. Keep free conversation as the primary interface and use \`gemini-3.1-flash-lite\` by default. Freeform routing uses medium thinking. A validated route then follows its predeclared policy: deterministic code after routing; medium/high hybrid assessment with only process-scoped tools; medium model interaction for knowledge/simple work; or high model interaction for agentic work. An active deterministic step may bypass routing only for a server-issued, replay-safe closed choice and must make zero model calls. Process difficulty, thinking, completion mode, context, and tools are fixed before entry. Serialize each crux/channel/user/thread turn with an expiring owner lease, and render Telegram copy, structured callbacks, acknowledgement, and typing activity through its adapter. For a stable runtime defect with correct routes and content, use \`$use-bridgecrux-primitives\` directly. Do not substitute prompt text for missing software, expand tools beyond the validated binding, or let raw model output authorize mutations or replace durable application truth.
${MANAGED_BLOCK_END}`;

export type InstructionFileMode = "auto" | "agents" | "claude" | "both" | "none";

export type SkillInstallOptions = {
  target: string;
  project: string;
  instructionFiles?: InstructionFileMode;
  dryRun?: boolean;
  bundledDirectory?: string;
};

export type SkillInstallResult = {
  action: "install" | "uninstall";
  target: string;
  project: string;
  skills: string[];
  instructionFiles: string[];
  dryRun: boolean;
};

type SkillManifest = {
  version: number;
  skills: string[];
  files: { path: string; sha256: string }[];
};

export async function installBridgeCruxSkills(options: SkillInstallOptions): Promise<SkillInstallResult> {
  const target = resolve(options.target);
  const project = resolve(options.project);
  const bundled = resolve(options.bundledDirectory ?? defaultBundledDirectory());
  const manifest = await verifyBundledSkills(bundled);
  const skillNames = verifySkillNames(manifest.skills);
  const instructionFiles = await resolveInstructionFiles(project, options.instructionFiles ?? "auto");
  if (!options.dryRun) {
    await mkdir(target, { recursive: true });
    for (const name of skillNames) {
      const destination = join(target, name);
      await rm(destination, { recursive: true, force: true });
      await cp(join(bundled, name), destination, { recursive: true, force: true, errorOnExist: false });
    }
    for (const path of instructionFiles) await updateManagedInstructions(path);
  }
  return { action: "install", target, project, skills: skillNames, instructionFiles, dryRun: options.dryRun ?? false };
}

export async function uninstallBridgeCruxSkills(options: SkillInstallOptions): Promise<SkillInstallResult> {
  const target = resolve(options.target);
  const project = resolve(options.project);
  const instructionFiles = await resolveInstructionFiles(project, options.instructionFiles ?? "auto", false);
  if (!options.dryRun) {
    for (const name of BRIDGECRUX_SKILL_NAMES) await rm(join(target, name), { recursive: true, force: true });
    for (const path of instructionFiles) await removeManagedInstructions(path);
  }
  return {
    action: "uninstall",
    target,
    project,
    skills: [...BRIDGECRUX_SKILL_NAMES],
    instructionFiles,
    dryRun: options.dryRun ?? false,
  };
}

export async function verifyBundledSkills(directory: string): Promise<SkillManifest> {
  const manifest = parseManifest(await readFile(join(directory, "manifest.json"), "utf8"));
  verifySkillNames(manifest.skills);
  for (const entry of manifest.files) {
    if (entry.path.includes("..") || entry.path.startsWith("/") || entry.path.includes("\\")) {
      throw new Error(`Unsafe skill manifest path ${entry.path}`);
    }
    const digest = createHash("sha256").update(await readFile(join(directory, entry.path))).digest("hex");
    if (digest !== entry.sha256) throw new Error(`BridgeCrux skill integrity check failed for ${entry.path}`);
  }
  return manifest;
}

export async function updateManagedInstructions(path: string): Promise<void> {
  let source = "";
  try {
    source = await readFile(path, "utf8");
  } catch {
    await mkdir(dirname(path), { recursive: true });
  }
  const preserved = stripManagedBlock(source).trimEnd();
  await writeFile(path, `${preserved ? `${preserved}\n\n` : ""}${BRIDGECRUX_MANAGED_INSTRUCTIONS}\n`, "utf8");
}

export async function removeManagedInstructions(path: string): Promise<void> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch {
    return;
  }
  const preserved = stripManagedBlock(source).trimEnd();
  await writeFile(path, preserved ? `${preserved}\n` : "", "utf8");
}

function stripManagedBlock(source: string): string {
  const start = source.indexOf(MANAGED_BLOCK_START);
  if (start < 0) return source;
  const end = source.indexOf(MANAGED_BLOCK_END, start);
  if (end < 0) throw new Error(`Found ${MANAGED_BLOCK_START} without ${MANAGED_BLOCK_END}`);
  return `${source.slice(0, start)}${source.slice(end + MANAGED_BLOCK_END.length)}`;
}

async function resolveInstructionFiles(project: string, mode: InstructionFileMode, createAuto = true): Promise<string[]> {
  if (mode === "none") return [];
  const agents = join(project, "AGENTS.md");
  const claude = join(project, "CLAUDE.md");
  if (mode === "agents") return [agents];
  if (mode === "claude") return [claude];
  if (mode === "both") return [agents, claude];
  if (mode !== "auto") throw new Error(`Unknown instruction file mode ${String(mode)}`);
  const existing = (await Promise.all([agents, claude].map(async (path) => ((await exists(path)) ? path : undefined)))).filter(
    (path): path is string => Boolean(path),
  );
  return existing.length > 0 ? existing : createAuto ? [agents] : [];
}

function parseManifest(source: string): SkillManifest {
  const value = JSON.parse(source) as unknown;
  if (!record(value) || value.version !== 1 || !stringArray(value.skills) || !Array.isArray(value.files)) {
    throw new Error("BridgeCrux skill manifest is invalid");
  }
  const files = value.files.map((entry) => {
    if (!record(entry) || typeof entry.path !== "string" || typeof entry.sha256 !== "string") {
      throw new Error("BridgeCrux skill manifest file entry is invalid");
    }
    return { path: entry.path, sha256: entry.sha256 };
  });
  return { version: 1, skills: value.skills, files };
}

function verifySkillNames(names: string[]): string[] {
  if (names.length !== BRIDGECRUX_SKILL_NAMES.length || BRIDGECRUX_SKILL_NAMES.some((name) => !names.includes(name))) {
    throw new Error("BridgeCrux skill manifest must contain the three supported skills");
  }
  return [...BRIDGECRUX_SKILL_NAMES];
}

function defaultBundledDirectory(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "bundled-skills");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
