#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
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
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });
}

async function doctor(project: string, json: boolean): Promise<number> {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const checks = [
    { id: "node", ok: major >= 22, detail: `Node ${process.versions.node}; requires >=22` },
    { id: "package_json", ok: await exists(resolve(project, "package.json")), detail: "project package.json" },
    { id: "cruxes", ok: await exists(resolve(project, "cruxes")), detail: "canonical cruxes directory (optional until first crux)" },
    { id: "gemini_credentials", ok: Boolean(process.env.GEMINI_API_KEY), detail: "GEMINI_API_KEY presence (required only for live Gemini)" },
    { id: "telegram_credentials", ok: Boolean(process.env.TELEGRAM_BOT_TOKEN), detail: "TELEGRAM_BOT_TOKEN presence (required only for live Telegram)" },
    { id: "convex_configuration", ok: Boolean(process.env.CONVEX_URL || process.env.CONVEX_DEPLOYMENT), detail: "CONVEX_URL or CONVEX_DEPLOYMENT presence (required only for live Convex)" },
  ];
  const requiredOk = checks[0]!.ok;
  writeResult({ ok: requiredOk, bridgecrux: BRIDGECRUX_VERSION, project, checks }, json);
  return requiredOk ? 0 : 1;
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
    "  bridgecrux --version",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runBridgeCruxCli();
