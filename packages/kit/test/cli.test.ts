import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BRIDGECRUX_VERSION } from "../src/index.js";
import { runBridgeCruxCli } from "../src/cli.js";

describe("BridgeCrux kit", () => {
  it("exports the synchronized framework version", () => {
    expect(BRIDGECRUX_VERSION).toBe("0.1.0");
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
});
