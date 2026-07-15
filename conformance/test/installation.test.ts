import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const npmCli = process.env.npm_execpath;
const packages = ["core", "content", "convex", "adapters", "kit", "skills"] as const;

describe("clean-project package installation", () => {
  it(
    "packs and installs all public packages without publishing",
    async () => {
      const root = resolve(".");
      const temporary = await mkdtemp(join(tmpdir(), "bridgecrux-installation-"));
      const tarballs = join(temporary, "tarballs");
      const project = join(temporary, "consumer");
      await mkdir(tarballs);
      await mkdir(project);

      for (const name of packages) {
        await executeNpm(["pack", "--json", "--pack-destination", tarballs, resolve(root, "packages", name)], root, 60_000);
      }
      const packed = await Promise.all(
        packages.map(async (name) => {
          const expected = join(tarballs, `bridge-crux-${name}-0.1.0.tgz`);
          expect((await stat(expected)).isFile()).toBe(true);
          return expected;
        }),
      );

      await writeFile(
        join(project, "package.json"),
        `${JSON.stringify({ name: "bridgecrux-clean-consumer", private: true, type: "module" }, null, 2)}\n`,
        "utf8",
      );
      await executeNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", ...packed, "convex@1.42.2"], project, 120_000);

      const verification = `
        import { BRIDGECRUX_VERSION, DefaultRouterDecisionValidator } from "@bridge-crux/kit";
        import { bridgeCruxTableNames } from "@bridge-crux/convex";
        import { installBridgeCruxSkills } from "@bridge-crux/skills";
        import { readFile } from "node:fs/promises";
        import { join } from "node:path";
        if (BRIDGECRUX_VERSION !== "0.1.0") throw new Error("version mismatch");
        if (typeof DefaultRouterDecisionValidator !== "function") throw new Error("core export missing");
        if (!bridgeCruxTableNames.includes("bridgecruxRouterDecisions")) throw new Error("Convex tables missing");
        const target = join(process.cwd(), ".skills");
        await installBridgeCruxSkills({ target, project: process.cwd(), instructionFiles: "agents" });
        const agents = await readFile(join(process.cwd(), "AGENTS.md"), "utf8");
        if (!agents.includes("$use-bridgecrux-primitives") || !agents.includes("$anticipate-crux-routes") || !agents.includes("$write-crux-prompts")) {
          throw new Error("managed skill instructions missing");
        }
      `;
      await writeFile(join(project, "verify.mjs"), verification, "utf8");
      await execute(process.execPath, ["verify.mjs"], { cwd: project, timeout: 30_000, windowsHide: true });

      const cli = join(project, "node_modules", "@bridge-crux", "kit", "dist", "cli.js");
      const cliResult = await execute(process.execPath, [cli, "--version"], { cwd: project, timeout: 30_000, windowsHide: true });
      expect(cliResult.stdout.trim()).toBe("0.1.0");
      for (const name of ["bridgecrux", "bridgecrux-content", "bridgecrux-skills"]) {
        const executable = join(project, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
        expect((await stat(executable)).isFile(), `${name} executable`).toBe(true);
      }
      expect(await readFile(join(project, "AGENTS.md"), "utf8")).toContain("BridgeCrux Agentic-App Instructions");
      for (const name of ["anticipate-crux-routes", "use-bridgecrux-primitives", "write-crux-prompts"]) {
        expect((await stat(join(project, ".skills", name, "SKILL.md"))).isFile(), basename(name)).toBe(true);
      }
    },
    180_000,
  );
});

function executeNpm(args: string[], cwd: string, timeout: number) {
  if (npmCli) return execute(process.execPath, [npmCli, ...args], { cwd, timeout, windowsHide: true });
  return execute("npm", args, { cwd, timeout, windowsHide: true, shell: process.platform === "win32" });
}
