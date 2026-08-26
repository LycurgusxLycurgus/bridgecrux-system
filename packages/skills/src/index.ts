import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BRIDGECRUX_SKILL_NAMES = [
  "anticipate-crux-routes",
  "use-bridgecrux-primitives",
  "write-crux-prompts",
] as const;

export const MANAGED_BLOCK_START = "<!-- bridgecrux:managed:start -->";
export const MANAGED_BLOCK_END = "<!-- bridgecrux:managed:end -->";
export const SKILLS_STATE_FILE = ".bridgecrux-skills.json";

export const BRIDGECRUX_MANAGED_INSTRUCTIONS = [
  MANAGED_BLOCK_START,
  "## BridgeCrux Agentic-App Instructions",
  "",
  "BridgeCrux is versioned repository knowledge, not built-in model knowledge. At the start of every nontrivial turn that may inspect, explain, plan, change, debug, validate, or extend this agentic application's capabilities, routes, processes, operations, persistence, model/tool policy, content, copy, channel behavior, or cross-surface experience, activate `$use-bridgecrux-primitives`. Re-open the installed skill, runtime map, canonical crux content, and package contracts whenever a knowledge gap appears; never fill BridgeCrux gaps from model memory.",
  "",
  "Installed capabilities:",
  "",
  "- `$use-bridgecrux-primitives` coordinates runtime integration and preserves the authority chain from inbound state through validated routing, a predeclared execution policy, scoped tools, authorized operations, durable truth, copy, delivery, and audit.",
  "- `$anticipate-crux-routes` derives the compact route catalog and route-local intents from one capability surface; it maintains the capability/surface checklist, duplicate and contradiction audit, routing evaluation corpus, and one real-persistence all-route/all-surface simulation.",
  "- `$write-crux-prompts` authors schema-3 `system.prompt.md`, `assistants.md`, and specific-function/process content from verified capabilities. Prompt text cannot invent software.",
  "- `@bridge-crux/kit` provides core contracts, canonical content, Convex persistence, Gemini 3.5 Flash-Lite and Telegram adapters, and the `bridgecrux build|validate|evaluate-routing|doctor` CLI.",
  "- `@bridge-crux/skills` installs and safely updates these three skills plus this bounded block. Project-local installation under `.codex/skills` is the default; global installation is explicit.",
  "",
  "Treat the product as one agentic application with multiple presentations. Every user-facing capability must resolve to the same handler, operations, persistence, and semantic result from conversation, each declared channel or app surface, and the generated headless surface. Routes are coarse domains; intents are route-local sub-routes bound to exactly one capability. Aliases are routing evidence, never execution authority.",
  "",
  "Every user-authored textual turn uses the predeclared freeform router, medium by default. High router thinking requires a passed comparison evaluation. A validated capability then enforces its fixed mode: deterministic code after routing; high-thinking hybrid interpretation and procedural choices; medium agentic interaction for knowledge-only conversation; or high agentic interaction for complex/tool work. Only server-issued, scoped, replay-safe closed choices in an active deterministic process bypass routing and make zero model calls. Generated choices never authorize persistence. Code alone authorizes operations, state changes, idempotency, and truthful success copy.",
  "",
  "Default new Google integrations to `gemini-3.5-flash-lite` with explicit medium/high thinking, 65,536 maximum output tokens, and the BridgeCrux Gemini safety configuration. Keep free conversation primary; use generated controls only when they reduce material ambiguity. Preserve Telegram-safe HTML, early callback acknowledgement, refreshed typing activity, shared callback encoding, turn leases, communication-style policy, and lifecycle checks. For a new crux or changed product surface, use `$anticipate-crux-routes`, then `$write-crux-prompts`, then `$use-bridgecrux-primitives`. Do not substitute prompts for missing runtime behavior, widen tools beyond a validated capability, or let model output replace durable application truth.",
  MANAGED_BLOCK_END,
].join("\n");

export type InstructionFileMode = "auto" | "agents" | "claude" | "both" | "none";

export type SkillInstallOptions = {
  target: string;
  project: string;
  instructionFiles?: InstructionFileMode;
  dryRun?: boolean;
  force?: boolean;
  bundledDirectory?: string;
};

export type SkillInstallResult = {
  action: "install" | "update" | "uninstall";
  target: string;
  project: string;
  packageVersion?: string;
  skills: string[];
  instructionFiles: string[];
  stateFile: string;
  dryRun: boolean;
};

export type SkillDoctorResult = {
  ok: boolean;
  target: string;
  project: string;
  packageVersion?: string;
  checks: { id: string; ok: boolean; detail: string }[];
};

type SkillManifest = {
  version: 2;
  packageVersion: string;
  skills: string[];
  files: { path: string; sha256: string }[];
};

type InstalledState = SkillManifest & {
  installedAt: string;
  instructionFiles: string[];
};

export function installBridgeCruxSkills(options: SkillInstallOptions): Promise<SkillInstallResult> {
  return installOrUpdate("install", options);
}

export function updateBridgeCruxSkills(options: SkillInstallOptions): Promise<SkillInstallResult> {
  return installOrUpdate("update", options);
}

async function installOrUpdate(action: "install" | "update", options: SkillInstallOptions): Promise<SkillInstallResult> {
  const target = resolve(options.target);
  const project = resolve(options.project);
  const bundled = resolve(options.bundledDirectory ?? defaultBundledDirectory());
  const manifest = await verifyBundledSkills(bundled);
  const skillNames = verifySkillNames(manifest.skills);
  const instructionFiles = await resolveInstructionFiles(project, options.instructionFiles ?? "auto");
  const stateFile = join(target, SKILLS_STATE_FILE);
  const state = await readInstalledState(stateFile);
  if (action === "update" && !state) throw new Error(`No managed BridgeCrux skill installation was found at ${target}; run install first`);
  const conflicts = state ? await installedConflicts(target, state) : await unmanagedConflicts(target);
  if (conflicts.length > 0 && !options.force) {
    throw new Error(`BridgeCrux will not overwrite modified or unmanaged skill files:\n- ${conflicts.join("\n- ")}\nBack up the files or rerun with --force after review.`);
  }
  const result: SkillInstallResult = {
    action,
    target,
    project,
    packageVersion: manifest.packageVersion,
    skills: skillNames,
    instructionFiles,
    stateFile,
    dryRun: options.dryRun ?? false,
  };
  if (options.dryRun) return result;

  await mkdir(target, { recursive: true });
  const transactionId = randomUUID();
  const stage = join(target, `.bridgecrux-stage-${transactionId}`);
  const backup = join(target, `.bridgecrux-backup-${transactionId}`);
  const instructionSnapshots = await Promise.all(instructionFiles.map(snapshotFile));
  const stateSnapshot = await snapshotFile(stateFile);
  const movedExisting: string[] = [];
  const installedNew: string[] = [];
  try {
    await mkdir(stage, { recursive: true });
    await mkdir(backup, { recursive: true });
    for (const name of skillNames) await cp(join(bundled, name), join(stage, name), { recursive: true, force: true });
    await verifyManifestFiles(stage, manifest);
    for (const name of skillNames) {
      const destination = join(target, name);
      if (await exists(destination)) {
        await rename(destination, join(backup, name));
        movedExisting.push(name);
      }
      await rename(join(stage, name), destination);
      installedNew.push(name);
    }
    for (const path of instructionFiles) await updateManagedInstructions(path);
    const installedState: InstalledState = {
      ...manifest,
      skills: skillNames,
      files: manifest.files.map((entry) => ({ ...entry })),
      installedAt: new Date().toISOString(),
      instructionFiles,
    };
    await writeJsonAtomic(stateFile, installedState);
  } catch (error) {
    for (const name of installedNew) await rm(join(target, name), { recursive: true, force: true }).catch(() => undefined);
    for (const name of movedExisting) {
      if (await exists(join(backup, name))) await rename(join(backup, name), join(target, name)).catch(() => undefined);
    }
    await Promise.all(instructionSnapshots.map(restoreSnapshot));
    await restoreSnapshot(stateSnapshot);
    throw error;
  } finally {
    await rm(stage, { recursive: true, force: true }).catch(() => undefined);
    await rm(backup, { recursive: true, force: true }).catch(() => undefined);
  }
  return result;
}

export async function uninstallBridgeCruxSkills(options: SkillInstallOptions): Promise<SkillInstallResult> {
  const target = resolve(options.target);
  const project = resolve(options.project);
  const stateFile = join(target, SKILLS_STATE_FILE);
  const state = await readInstalledState(stateFile);
  const instructionFiles = state?.instructionFiles ?? await resolveInstructionFiles(project, options.instructionFiles ?? "auto", false);
  const conflicts = state ? await installedConflicts(target, state) : await unmanagedConflicts(target);
  if (conflicts.length > 0 && !options.force) {
    throw new Error(`BridgeCrux will not remove modified or unmanaged skill files:\n- ${conflicts.join("\n- ")}\nBack up the files or rerun with --force after review.`);
  }
  const result: SkillInstallResult = {
    action: "uninstall",
    target,
    project,
    ...(state?.packageVersion ? { packageVersion: state.packageVersion } : {}),
    skills: [...BRIDGECRUX_SKILL_NAMES],
    instructionFiles,
    stateFile,
    dryRun: options.dryRun ?? false,
  };
  if (!options.dryRun) {
    for (const name of BRIDGECRUX_SKILL_NAMES) await rm(join(target, name), { recursive: true, force: true });
    for (const path of instructionFiles) await removeManagedInstructions(path);
    await rm(stateFile, { force: true });
  }
  return result;
}

export async function doctorBridgeCruxSkills(options: Pick<SkillInstallOptions, "target" | "project">): Promise<SkillDoctorResult> {
  const target = resolve(options.target);
  const project = resolve(options.project);
  const state = await readInstalledState(join(target, SKILLS_STATE_FILE));
  const conflicts = state ? await installedConflicts(target, state) : [];
  const instructionChecks = await Promise.all((state?.instructionFiles ?? []).map(async (path) => {
    const source = await readOptional(path);
    const count = source ? source.split(MANAGED_BLOCK_START).length - 1 : 0;
    return { id: `instructions:${path}`, ok: count === 1 && source!.includes(MANAGED_BLOCK_END), detail: `${path}: expected one bounded managed block` };
  }));
  const checks = [
    { id: "state", ok: Boolean(state), detail: state ? `managed package ${state.packageVersion}` : `missing ${SKILLS_STATE_FILE}` },
    { id: "owned_files", ok: Boolean(state) && conflicts.length === 0, detail: conflicts.length === 0 ? "managed skill hashes match" : conflicts.join(", ") },
    ...instructionChecks,
  ];
  return { ok: checks.every((check) => check.ok), target, project, ...(state?.packageVersion ? { packageVersion: state.packageVersion } : {}), checks };
}

export async function verifyBundledSkills(directory: string): Promise<SkillManifest> {
  const manifest = parseManifest(await readFile(join(directory, "manifest.json"), "utf8"));
  verifySkillNames(manifest.skills);
  await verifyManifestFiles(directory, manifest);
  return manifest;
}

async function verifyManifestFiles(directory: string, manifest: SkillManifest): Promise<void> {
  const declared = new Set(manifest.files.map((entry) => entry.path));
  const actual = (await collectRelativeFiles(directory)).filter((path) => path !== "manifest.json");
  const omitted = actual.filter((path) => !declared.has(path));
  const missing = [...declared].filter((path) => !actual.includes(path));
  if (omitted.length > 0 || missing.length > 0) throw new Error(`BridgeCrux skill manifest coverage mismatch: ${[...omitted, ...missing].join(", ")}`);
  for (const entry of manifest.files) {
    if (unsafeManifestPath(entry.path)) throw new Error(`Unsafe skill manifest path ${entry.path}`);
    const digest = await digestFile(join(directory, entry.path));
    if (digest !== entry.sha256) throw new Error(`BridgeCrux skill integrity check failed for ${entry.path}`);
  }
}

export async function updateManagedInstructions(path: string): Promise<void> {
  const source = await readOptional(path) ?? "";
  if (source.includes(MANAGED_BLOCK_START) && !source.includes(MANAGED_BLOCK_END)) throw new Error(`Found ${MANAGED_BLOCK_START} without ${MANAGED_BLOCK_END}`);
  const preserved = stripManagedBlock(source).trimEnd();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${preserved ? `${preserved}\n\n` : ""}${BRIDGECRUX_MANAGED_INSTRUCTIONS}\n`, "utf8");
}

export async function removeManagedInstructions(path: string): Promise<void> {
  const source = await readOptional(path);
  if (source === undefined) return;
  const preserved = stripManagedBlock(source).trimEnd();
  await writeFile(path, preserved ? `${preserved}\n` : "", "utf8");
}

function stripManagedBlock(source: string): string {
  const start = source.indexOf(MANAGED_BLOCK_START);
  if (start < 0) return source;
  const end = source.indexOf(MANAGED_BLOCK_END, start);
  if (end < 0) throw new Error(`Found ${MANAGED_BLOCK_START} without ${MANAGED_BLOCK_END}`);
  const duplicate = source.indexOf(MANAGED_BLOCK_START, end + MANAGED_BLOCK_END.length);
  if (duplicate >= 0) throw new Error("Found more than one BridgeCrux managed instruction block");
  return `${source.slice(0, start)}${source.slice(end + MANAGED_BLOCK_END.length)}`;
}

async function installedConflicts(target: string, state: InstalledState): Promise<string[]> {
  const conflicts: string[] = [];
  const expected = new Map(state.files.map((entry) => [entry.path, entry.sha256]));
  const actual = (await collectOwnedFiles(target)).sort();
  for (const path of actual) if (!expected.has(path)) conflicts.push(`${path} is unmanaged`);
  for (const [path, sha256] of expected) {
    if (!actual.includes(path)) conflicts.push(`${path} is missing`);
    else if (await digestFile(join(target, path)) !== sha256) conflicts.push(`${path} was modified`);
  }
  return conflicts;
}

async function unmanagedConflicts(target: string): Promise<string[]> {
  const conflicts: string[] = [];
  for (const name of BRIDGECRUX_SKILL_NAMES) if (await exists(join(target, name))) conflicts.push(`${name}/ already exists without BridgeCrux ownership metadata`);
  return conflicts;
}

async function collectOwnedFiles(target: string): Promise<string[]> {
  const files: string[] = [];
  for (const name of BRIDGECRUX_SKILL_NAMES) {
    const directory = join(target, name);
    if (await exists(directory)) files.push(...(await collectRelativeFiles(directory)).map((path) => `${name}/${path}`));
  }
  return files.sort();
}

async function collectRelativeFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(current: string): Promise<void> {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(relative(directory, path).replaceAll("\\", "/"));
    }
  }
  await walk(directory);
  return files;
}

async function resolveInstructionFiles(project: string, mode: InstructionFileMode, createAuto = true): Promise<string[]> {
  if (mode === "none") return [];
  const agents = join(project, "AGENTS.md");
  const claude = join(project, "CLAUDE.md");
  if (mode === "agents") return [agents];
  if (mode === "claude") return [claude];
  if (mode === "both") return [agents, claude];
  if (mode !== "auto") throw new Error(`Unknown instruction file mode ${String(mode)}`);
  const existing = (await Promise.all([agents, claude].map(async (path) => (await exists(path) ? path : undefined)))).filter((path): path is string => Boolean(path));
  return existing.length > 0 ? existing : createAuto ? [agents] : [];
}

function parseManifest(source: string): SkillManifest {
  const value = JSON.parse(source) as unknown;
  if (!record(value) || value.version !== 2 || !string(value.packageVersion) || !stringArray(value.skills) || !Array.isArray(value.files)) throw new Error("BridgeCrux skill manifest is invalid or belongs to the removed format-1 installer");
  const files = value.files.map((entry) => {
    if (!record(entry) || !string(entry.path) || !/^[a-f0-9]{64}$/u.test(String(entry.sha256))) throw new Error("BridgeCrux skill manifest file entry is invalid");
    return { path: String(entry.path), sha256: String(entry.sha256) };
  });
  return { version: 2, packageVersion: value.packageVersion, skills: value.skills, files };
}

async function readInstalledState(path: string): Promise<InstalledState | undefined> {
  const source = await readOptional(path);
  if (!source) return undefined;
  const value = JSON.parse(source) as unknown;
  if (!record(value) || !string(value.installedAt) || !stringArray(value.instructionFiles)) throw new Error(`Invalid BridgeCrux installation state at ${path}`);
  const manifest = parseManifest(JSON.stringify(value));
  return { ...manifest, installedAt: value.installedAt, instructionFiles: value.instructionFiles };
}

function verifySkillNames(names: string[]): string[] {
  if (names.length !== BRIDGECRUX_SKILL_NAMES.length || BRIDGECRUX_SKILL_NAMES.some((name) => !names.includes(name))) throw new Error("BridgeCrux skill manifest must contain the three supported skills");
  return [...BRIDGECRUX_SKILL_NAMES];
}

function defaultBundledDirectory(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "bundled-skills");
}

async function digestFile(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rm(path, { force: true });
  await rename(temporary, path);
}

type FileSnapshot = { path: string; source?: string };

async function snapshotFile(path: string): Promise<FileSnapshot> {
  const source = await readOptional(path);
  return source === undefined ? { path } : { path, source };
}

async function restoreSnapshot(snapshot: FileSnapshot): Promise<void> {
  if (snapshot.source === undefined) await rm(snapshot.path, { force: true }).catch(() => undefined);
  else {
    await mkdir(dirname(snapshot.path), { recursive: true });
    await writeFile(snapshot.path, snapshot.source, "utf8");
  }
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function unsafeManifestPath(path: string): boolean {
  return path.includes("..") || path.startsWith("/") || path.includes("\\");
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(string);
}

function string(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
