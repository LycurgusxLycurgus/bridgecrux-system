import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRIDGECRUX_MANAGED_INSTRUCTIONS,
  BRIDGECRUX_SKILL_NAMES,
  MANAGED_BLOCK_START,
  SKILLS_STATE_FILE,
  doctorBridgeCruxSkills,
  installBridgeCruxSkills,
  uninstallBridgeCruxSkills,
  updateBridgeCruxSkills,
  verifyBundledSkills,
} from "../src/index.js";

const bundledDirectory = resolve("packages/skills/bundled-skills");

describe("BridgeCrux skills installer", () => {
  it("verifies and installs exactly three bundled skills with an idempotent managed block", async () => {
    const root = await mkdtemp(join(tmpdir(), "bridgecrux-skills-"));
    const target = join(root, "skills");
    const project = join(root, "app");
    await mkdir(project);
    await writeFile(join(project, "AGENTS.md"), "# Existing agent rules\n", "utf8");
    await writeFile(join(project, "CLAUDE.md"), "# Existing Claude rules\n", "utf8");
    const manifest = await verifyBundledSkills(bundledDirectory);
    expect(manifest.version).toBe(2);
    expect(manifest.skills).toEqual(expect.arrayContaining([...BRIDGECRUX_SKILL_NAMES]));

    const options = { target, project, instructionFiles: "both" as const, bundledDirectory };
    await installBridgeCruxSkills(options);
    await installBridgeCruxSkills(options);

    for (const name of BRIDGECRUX_SKILL_NAMES) expect((await stat(join(target, name, "SKILL.md"))).isFile()).toBe(true);
    expect(JSON.parse(await readFile(join(target, SKILLS_STATE_FILE), "utf8"))).toMatchObject({ version: 2, skills: BRIDGECRUX_SKILL_NAMES });
    const routeSkill = await readFile(join(target, "anticipate-crux-routes", "SKILL.md"), "utf8");
    expect(routeSkill).toContain("Audit Duplicates And Contradictions");
    expect(routeSkill).toContain("Run One All-Route Simulation");
    for (const filename of ["AGENTS.md", "CLAUDE.md"]) {
      const source = await readFile(join(project, filename), "utf8");
      expect(source.match(new RegExp(MANAGED_BLOCK_START, "g"))).toHaveLength(1);
      expect(source.trimEnd().endsWith(BRIDGECRUX_MANAGED_INSTRUCTIONS)).toBe(true);
      expect(source).toContain("$use-bridgecrux-primitives");
      expect(source).toContain("$anticipate-crux-routes");
      expect(source).toContain("$write-crux-prompts");
      expect(source).toContain("@bridge-crux/kit");
      expect(source).toContain("every nontrivial turn");
      expect(source).toContain("not built-in model knowledge");
      expect(source).toContain("never fill BridgeCrux gaps from model memory");
    }
  });

  it("auto-creates AGENTS.md and uninstall preserves surrounding instructions", async () => {
    const root = await mkdtemp(join(tmpdir(), "bridgecrux-skills-auto-"));
    const target = join(root, "skills");
    const project = join(root, "app");
    await mkdir(project);
    await installBridgeCruxSkills({ target, project, bundledDirectory });
    expect(await readFile(join(project, "AGENTS.md"), "utf8")).toContain(MANAGED_BLOCK_START);
    await writeFile(join(project, "AGENTS.md"), `# Keep me\n\n${BRIDGECRUX_MANAGED_INSTRUCTIONS}\n`, "utf8");
    await uninstallBridgeCruxSkills({ target, project, instructionFiles: "agents" });
    expect(await readFile(join(project, "AGENTS.md"), "utf8")).toBe("# Keep me\n");
    await expect(stat(join(target, "use-bridgecrux-primitives"))).rejects.toThrow();
  });

  it("dry-run reports actions without changing the project", async () => {
    const root = await mkdtemp(join(tmpdir(), "bridgecrux-skills-dry-"));
    const project = join(root, "app");
    await mkdir(project);
    const result = await installBridgeCruxSkills({
      target: join(root, "skills"),
      project,
      bundledDirectory,
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    await expect(stat(join(project, "AGENTS.md"))).rejects.toThrow();
  });

  it("supports a repository-local .codex skills root without touching a global target", async () => {
    const root = await mkdtemp(join(tmpdir(), "bridgecrux-skills-local-"));
    const project = join(root, "app");
    const target = join(project, ".codex", "skills");
    await mkdir(project);

    const result = await installBridgeCruxSkills({ target, project, bundledDirectory });

    expect(result.target).toBe(resolve(target));
    for (const name of BRIDGECRUX_SKILL_NAMES) {
      expect((await stat(join(project, ".codex", "skills", name, "SKILL.md"))).isFile()).toBe(true);
    }
    expect(await readFile(join(project, "AGENTS.md"), "utf8")).toContain(MANAGED_BLOCK_START);
  });

  it("refuses modified managed skills, then performs an explicit forced transactional update", async () => {
    const root = await mkdtemp(join(tmpdir(), "bridgecrux-skills-update-"));
    const project = join(root, "app");
    const target = join(project, ".codex", "skills");
    await mkdir(project);
    await installBridgeCruxSkills({ target, project, bundledDirectory });
    const skillPath = join(target, "use-bridgecrux-primitives", "SKILL.md");
    await writeFile(skillPath, "locally modified\n", "utf8");

    await expect(updateBridgeCruxSkills({ target, project, bundledDirectory })).rejects.toThrow(/was modified/);
    expect((await doctorBridgeCruxSkills({ target, project })).ok).toBe(false);
    const result = await updateBridgeCruxSkills({ target, project, bundledDirectory, force: true });
    expect(result.action).toBe("update");
    expect(await readFile(skillPath, "utf8")).toContain("Use BridgeCrux Primitives");
    expect((await doctorBridgeCruxSkills({ target, project })).ok).toBe(true);
  });
});
