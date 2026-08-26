import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BRIDGECRUX_VERSION } from "../src/index.js";
import { runBridgeCruxCli } from "../src/cli.js";

describe("BridgeCrux kit", () => {
  it("exports the synchronized framework version", async () => {
    const manifest = JSON.parse(await readFile(resolve("packages/kit/package.json"), "utf8")) as { version: string };
    expect(BRIDGECRUX_VERSION).toBe(manifest.version);
  });

  it("validates and builds canonical content through the umbrella CLI", async () => {
    const fixture = resolve("conformance/fixtures/valid-crux");
    const operations = resolve("conformance/fixtures/operations.json");
    const output = join(await mkdtemp(join(tmpdir(), "bridgecrux-kit-")), "generated");
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await runBridgeCruxCli(["validate", "--root", fixture, "--operations", operations])).toBe(0);
    expect(await runBridgeCruxCli(["build", "--root", fixture, "--operations", operations, "--out", output])).toBe(0);
    expect(JSON.parse(await readFile(join(output, "manifest.generated.json"), "utf8"))).toMatchObject({ crux: { id: "neutral-conformance" } });
    stdout.mockRestore();
  });

  it("reports credential presence without exposing values", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const prior = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "must-not-appear";
    expect(await runBridgeCruxCli(["doctor", "--project", process.cwd(), "--json"])).toBe(0);
    const output = stdout.mock.calls.flat().join("");
    expect(output).toContain("gemini_credentials");
    expect(output).not.toContain("must-not-appear");
    if (prior === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prior;
    stdout.mockRestore();
  });

  it("evaluates medium and high routing observations without calling a model", async () => {
    const root = await mkdtemp(join(tmpdir(), "bridgecrux-routing-eval-"));
    const cases = join(root, "cases.json");
    const observations = join(root, "observations.json");
    await writeFile(cases, JSON.stringify([{ id: "one", message: "do it", expectedRoute: "tasks", expectedIntent: "execute", required: true }]));
    await writeFile(observations, JSON.stringify([
      { caseId: "one", thinkingLevel: "medium", run: 1, route: "wrong", intent: "wrong" },
      { caseId: "one", thinkingLevel: "high", run: 1, route: "tasks", intent: "execute" },
      { caseId: "one", thinkingLevel: "high", run: 2, route: "tasks", intent: "execute" },
    ]));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await runBridgeCruxCli(["evaluate-routing", "--cases", cases, "--observations", observations, "--json"])).toBe(0);
    expect(stdout.mock.calls.flat().join("")).toContain('"recommendation": "high"');
    stdout.mockRestore();
  });
});
