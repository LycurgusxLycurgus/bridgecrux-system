#!/usr/bin/env node
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  ContentBuildError,
  buildCruxContent,
  discoverCruxContent,
  parseCruxContent,
  validateCruxContent,
} from "@bridge-crux/content";
import { evaluateRoutingComplexity, type RoutingEvaluationCase, type RoutingEvaluationObservation } from "@bridge-crux/core";
import { BRIDGECRUX_VERSION } from "./index.js";

export async function runBridgeCruxCli(argv = process.argv.slice(2)): Promise<number> {
  let parsed: ReturnType<typeof parseCliArgs>;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Invalid command"}\n${usage()}`);
    return 2;
  }
  if (parsed.values.version) {
    process.stdout.write(`${BRIDGECRUX_VERSION}\n`);
    return 0;
  }
  if (parsed.values.help) {
    process.stdout.write(usage());
    return 0;
  }
  const command = parsed.positionals[0];
  if (command === "doctor") return doctor(resolve(parsed.values.project ?? process.cwd()), parsed.values.json ?? false);
  if (command === "evaluate-routing") return evaluateRouting(parsed.values.cases, parsed.values.observations, parsed.values.json ?? false);
  if (command !== "build" && command !== "validate") {
    process.stderr.write(usage());
    return 2;
  }
  const root = parsed.values.root ?? parsed.positionals[1];
  if (!root) {
    process.stderr.write(`A crux root is required.\n${usage()}`);
    return 2;
  }
  try {
    const operationIds = await readOperationIds(parsed.values.operations);
    if (command === "build") {
      const result = await buildCruxContent({
        root,
        operationIds,
        ...(parsed.values.out ? { outputDirectory: parsed.values.out } : {}),
      });
      writeResult({ ok: true, cruxId: result.manifest.crux.id, generatedFiles: result.generatedFiles }, parsed.values.json ?? false);
      return 0;
    }
    const content = await parseCruxContent(await discoverCruxContent(root));
    const result = validateCruxContent(content, { operationIds });
    writeResult(result, parsed.values.json ?? false);
    return result.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof ContentBuildError) writeError({ ok: false, diagnostics: error.diagnostics });
    else writeError({ ok: false, error: error instanceof Error ? error.message : "BridgeCrux command failed" });
    return 1;
  }
}

function parseCliArgs(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      root: { type: "string" },
      out: { type: "string" },
      operations: { type: "string" },
      project: { type: "string" },
      cases: { type: "string" },
      observations: { type: "string" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });
}

async function evaluateRouting(casesPath: string | undefined, observationsPath: string | undefined, json: boolean): Promise<number> {
  if (!casesPath || !observationsPath) {
    writeError({ ok: false, error: "evaluate-routing requires --cases and --observations JSON files" });
    return 2;
  }
  try {
    const cases = await readJsonArray<RoutingEvaluationCase>(casesPath);
    const observations = await readJsonArray<RoutingEvaluationObservation>(observationsPath);
    const result = evaluateRoutingComplexity({ cases, observations });
    writeResult({ ok: result.status === "passed", ...result }, json);
    return result.status === "passed" ? 0 : 1;
  } catch (error) {
    writeError({ ok: false, error: error instanceof Error ? error.message : "Routing evaluation failed" });
    return 1;
  }
}

async function readJsonArray<T>(path: string): Promise<T[]> {
  const parsed = JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${path} must contain a JSON array`);
  return parsed as T[];
}

async function doctor(project: string, json: boolean): Promise<number> {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const packageJsonPresent = await exists(resolve(project, "package.json"));
  const cruxRoot = resolve(project, "cruxes");
  const cruxConfigPaths = (await exists(cruxRoot)) ? await findCruxConfigs(cruxRoot) : [];
  const cruxConfigChecks = await Promise.all(cruxConfigPaths.map(inspectCruxConfig));
  const localSkillsRoot = resolve(project, ".codex", "skills");
  const localSkillDirectories = await Promise.all(["anticipate-crux-routes", "use-bridgecrux-primitives", "write-crux-prompts"].map((name) => exists(resolve(localSkillsRoot, name))));
  const localSkillsPresent = localSkillDirectories.some(Boolean);
  const skillStateCheck = localSkillsPresent ? await inspectSkillState(resolve(localSkillsRoot, ".bridgecrux-skills.json")) : { ok: true, detail: "project-local BridgeCrux skills not installed" };
  const instructionCheck = await inspectManagedInstructions(project);
  const checks = [
    { id: "node", ok: major >= 22, required: true, detail: `Node ${process.versions.node}; requires >=22` },
    { id: "package_json", ok: packageJsonPresent, required: true, detail: "project package.json" },
    { id: "cruxes", ok: await exists(cruxRoot), required: false, detail: "canonical cruxes directory (optional until first crux)" },
    { id: "schema_3", ok: cruxConfigChecks.every((check) => check.ok), required: cruxConfigChecks.length > 0, detail: cruxConfigChecks.length === 0 ? "no crux.config.json files detected" : cruxConfigChecks.map((check) => check.detail).join("; ") },
    { id: "project_local_skills", ok: skillStateCheck.ok, required: localSkillsPresent, detail: skillStateCheck.detail },
    { id: "managed_instructions", ok: instructionCheck.ok, required: instructionCheck.detected, detail: instructionCheck.detail },
    { id: "gemini_credentials", ok: Boolean(process.env.GEMINI_API_KEY), required: false, detail: "GEMINI_API_KEY presence (required only for live Gemini)" },
    { id: "telegram_credentials", ok: Boolean(process.env.TELEGRAM_BOT_TOKEN), required: false, detail: "TELEGRAM_BOT_TOKEN presence (required only for live Telegram)" },
    { id: "convex_configuration", ok: Boolean(process.env.CONVEX_URL || process.env.CONVEX_DEPLOYMENT), required: false, detail: "CONVEX_URL or CONVEX_DEPLOYMENT presence (required only for live Convex)" },
  ];
  const requiredOk = checks.every((check) => !check.required || check.ok);
  writeResult({ ok: requiredOk, bridgecrux: BRIDGECRUX_VERSION, project, checks }, json);
  return requiredOk ? 0 : 1;
}

async function findCruxConfigs(root: string): Promise<string[]> {
  const direct = resolve(root, "crux.config.json");
  const found = (await exists(direct)) ? [direct] : [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = resolve(root, entry.name, "crux.config.json");
    if (await exists(nested)) found.push(nested);
  }
  return found.sort();
}

async function inspectCruxConfig(path: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const config = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    const models = record(config.models) ? Object.values(config.models).filter(record) : [];
    const googleProfilesValid = models.every((profile) => profile.provider !== "google" || profile.model === "gemini-3.5-flash-lite");
    const removedSamplingAbsent = models.every((profile) => ["thinking", "temperature", "topP", "topK"].every((field) => !(field in profile)));
    const ok = config.schemaVersion === 3 && googleProfilesValid && removedSamplingAbsent;
    return { ok, detail: `${path}: ${ok ? "schema 3 / Gemini 3.5 policy valid" : "requires schema 3 and the Gemini 3.5 sampling contract"}` };
  } catch {
    return { ok: false, detail: `${path}: unreadable JSON` };
  }
}

async function inspectSkillState(path: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const state = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    const skills = Array.isArray(state.skills) ? state.skills : [];
    const ok = state.version === 2 && typeof state.packageVersion === "string" && skills.length === 3;
    return { ok, detail: ok ? `managed project-local skills ${state.packageVersion}` : "project-local skills require a valid .bridgecrux-skills.json state file" };
  } catch {
    return { ok: false, detail: "project-local BridgeCrux skills exist without managed state; reinstall or adopt them explicitly" };
  }
}

async function inspectManagedInstructions(project: string): Promise<{ ok: boolean; detected: boolean; detail: string }> {
  const files = [resolve(project, "AGENTS.md"), resolve(project, "CLAUDE.md")];
  let detected = false;
  for (const path of files) {
    if (!(await exists(path))) continue;
    const source = await readFile(path, "utf8");
    const starts = source.split("<!-- bridgecrux:managed:start -->").length - 1;
    const ends = source.split("<!-- bridgecrux:managed:end -->").length - 1;
    if (starts > 0 || ends > 0) detected = true;
    if (starts !== ends || starts > 1) return { ok: false, detected: true, detail: `${path}: duplicate or unbalanced BridgeCrux managed blocks` };
  }
  return { ok: true, detected, detail: detected ? "managed instruction block is balanced and unique" : "no BridgeCrux managed instruction block detected" };
}

async function readOperationIds(path: string | undefined): Promise<string[]> {
  if (!path) return [];
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) return parsed;
  if (record(parsed) && Array.isArray(parsed.operations)) return parsed.operations.filter((value): value is string => typeof value === "string");
  throw new Error("Operation manifest must be a string array or an object with an operations array");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function writeResult(value: unknown, pretty: boolean): void {
  process.stdout.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
}

function writeError(value: unknown): void {
  process.stderr.write(`${JSON.stringify(value, null, 2)}\n`);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function usage(): string {
  return [
    "Usage:",
    "  bridgecrux build --root <crux-dir> [--operations <manifest.json>] [--out <generated-dir>] [--json]",
    "  bridgecrux validate --root <crux-dir> [--operations <manifest.json>] [--json]",
    "  bridgecrux doctor [--project <app-root>] [--json]",
    "  bridgecrux evaluate-routing --cases <cases.json> --observations <observations.json> [--json]",
    "  bridgecrux --version",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runBridgeCruxCli();
