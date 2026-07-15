#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { ContentBuildError, buildCruxContent, discoverCruxContent, parseCruxContent, validateCruxContent } from "./builder.js";

export async function runContentCli(argv = process.argv.slice(2)): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      operations: { type: "string" },
      output: { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  const [command, root] = positionals;
  if (!command || !root || !["build", "validate"].includes(command)) {
    process.stderr.write("Usage: bridgecrux-content <build|validate> <crux-root> --operations <manifest.json> [--output <dir>] [--json]\n");
    return 2;
  }
  const operationIds = await readOperationIds(values.operations);
  try {
    if (command === "build") {
      const result = await buildCruxContent({ root, operationIds, ...(values.output ? { outputDirectory: values.output } : {}) });
      process.stdout.write(`${JSON.stringify({ ok: true, generatedFiles: result.generatedFiles }, null, values.json ? 2 : 0)}\n`);
      return 0;
    }
    const parsed = await parseCruxContent(await discoverCruxContent(root));
    const result = validateCruxContent(parsed, { operationIds });
    process.stdout.write(`${JSON.stringify(result, null, values.json ? 2 : 0)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof ContentBuildError) {
      process.stderr.write(`${JSON.stringify({ ok: false, diagnostics: error.diagnostics }, null, 2)}\n`);
      return 1;
    }
    process.stderr.write(`${error instanceof Error ? error.message : "Content command failed"}\n`);
    return 1;
  }
}

async function readOperationIds(path: string | undefined): Promise<string[]> {
  if (!path) return [];
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) return parsed;
  if (record(parsed) && Array.isArray(parsed["operations"])) {
    return parsed["operations"].filter((value): value is string => typeof value === "string");
  }
  throw new Error("Operation manifest must be a string array or an object with an operations array");
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runContentCli();
}
