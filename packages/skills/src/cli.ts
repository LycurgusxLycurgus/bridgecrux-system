#!/usr/bin/env node
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  installBridgeCruxSkills,
  doctorBridgeCruxSkills,
  type InstructionFileMode,
  uninstallBridgeCruxSkills,
  updateBridgeCruxSkills,
} from "./index.js";

export async function runSkillsCli(argv = process.argv.slice(2)): Promise<number> {
  let parsed: ReturnType<typeof parseCliArgs>;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Invalid command"}\n${usage()}`);
    return 2;
  }
  if (parsed.values.help) {
    process.stdout.write(usage());
    return 0;
  }
  const command = parsed.positionals[0];
  if (command !== "install" && command !== "update" && command !== "uninstall" && command !== "doctor") {
    process.stderr.write(usage());
    return 2;
  }
  const instructionFiles = parsed.values["instruction-files"] ?? "auto";
  if (!isInstructionMode(instructionFiles)) {
    process.stderr.write("--instruction-files must be auto, agents, claude, both, or none\n");
    return 2;
  }
  const project = resolve(parsed.values.project ?? process.cwd());
  if (parsed.values.global && parsed.values.target) {
    process.stderr.write("--global and --target cannot be combined\n");
    return 2;
  }
  const options = {
    target: resolve(parsed.values.target ?? defaultTarget(project, parsed.values.global ?? false)),
    project,
    instructionFiles,
    dryRun: parsed.values["dry-run"] ?? false,
    force: parsed.values.force ?? false,
  };
  try {
    if (command === "doctor") {
      const result = await doctorBridgeCruxSkills(options);
      process.stdout.write(`${JSON.stringify(result, null, parsed.values.json ? 2 : 0)}\n`);
      return result.ok ? 0 : 1;
    }
    const result = command === "install"
      ? await installBridgeCruxSkills(options)
      : command === "update"
        ? await updateBridgeCruxSkills(options)
        : await uninstallBridgeCruxSkills(options);
    process.stdout.write(`${JSON.stringify(result, null, parsed.values.json ? 2 : 0)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "BridgeCrux skill operation failed"}\n`);
    return 1;
  }
}

function parseCliArgs(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      target: { type: "string" },
      project: { type: "string" },
      "instruction-files": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      global: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
}

function defaultTarget(project: string, global: boolean): string {
  if (!global) return join(project, ".codex", "skills");
  const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  return join(codexHome, "skills");
}

function isInstructionMode(value: string): value is InstructionFileMode {
  return value === "auto" || value === "agents" || value === "claude" || value === "both" || value === "none";
}

function usage(): string {
  return [
    "Usage:",
    "  bridgecrux-skills install [--project <app-root>] [--target <skills-root>|--global] [--instruction-files auto|agents|claude|both|none] [--dry-run] [--force]",
    "  bridgecrux-skills update [--project <app-root>] [--target <skills-root>|--global] [--instruction-files auto|agents|claude|both|none] [--dry-run] [--force]",
    "  bridgecrux-skills uninstall [--project <app-root>] [--target <skills-root>|--global] [--instruction-files auto|agents|claude|both|none] [--dry-run] [--force]",
    "  bridgecrux-skills doctor [--project <app-root>] [--target <skills-root>|--global] [--json]",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runSkillsCli();
