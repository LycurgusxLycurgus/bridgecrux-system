import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ContentBuildError,
  buildCruxContent,
  discoverCruxContent,
  parseCruxContent,
  parseFrontmatterBlocks,
  validateCruxContent,
} from "../src/index.js";

const fixture = resolve("conformance/fixtures/valid-crux");
const operations = ["records.inspect", "records.complete", "process.advance"];

describe("canonical content builder", () => {
  it("parses frontmatter after leading markdown and repeated blocks", () => {
    const blocks = parseFrontmatterBlocks(`# Lead\n\n---\nid: one\nkind: specific_function\n---\nFirst\n\n---\nid: two\nkind: specific_function\n---\nSecond`);
    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.metadata["id"])).toEqual(["one", "two"]);
    expect(blocks[0]?.line).toBe(3);
  });

  it("discovers and validates the neutral canonical package", async () => {
    const parsed = await parseCruxContent(await discoverCruxContent(fixture));
    const result = validateCruxContent(parsed, { operationIds: operations });
    expect(result).toEqual({ ok: true, diagnostics: [] });
  });

  it("emits deterministic, non-empty TypeScript and manifest artifacts", async () => {
    const output = await mkdtemp(join(tmpdir(), "bridgecrux-content-"));
    const first = await buildCruxContent({ root: fixture, operationIds: operations, outputDirectory: output });
    const initial = await readFile(join(output, "manifest.generated.json"), "utf8");
    const second = await buildCruxContent({ root: fixture, operationIds: operations, outputDirectory: output });
    const repeated = await readFile(join(output, "manifest.generated.json"), "utf8");
    expect(first.manifest.specificFunctions).toHaveLength(1);
    expect(first.manifest.processes).toHaveLength(1);
    expect(first.manifest.schemaVersion).toBe(3);
    expect(first.manifest.capabilityManifest).toHaveLength(4);
    expect(first.manifest.routeChecklist).toHaveLength(4);
    expect(first.manifest.handlerStubs).toHaveLength(4);
    expect(first.manifest.surfaceMatrix).toHaveLength(12);
    expect(first.manifest.surfaceMatrix[0]).toMatchObject({ access: expect.any(String), states: { loading: expect.any(String), success: expect.any(String), error: expect.any(String) } });
    expect(first.manifest.regressionScenarios).toHaveLength(18);
    expect(first.manifest.processes[0]?.steps[0]).toMatchObject({
      id: "collect",
      input: { mode: "closed_choice", control: { field: "answer" } },
      execution: { mode: "deterministic", toolIds: [] },
    });
    expect(second.manifest).toEqual(first.manifest);
    expect(repeated).toBe(initial);
    expect(await readFile(join(output, "capability-surface.generated.md"), "utf8")).toContain("records.complete");
  });

  it("fails with actionable diagnostics for missing operations", async () => {
    await expect(buildCruxContent({ root: fixture, operationIds: [] })).rejects.toBeInstanceOf(ContentBuildError);
    try {
      await buildCruxContent({ root: fixture, operationIds: [] });
    } catch (error) {
      expect((error as ContentBuildError).diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "operation_missing", file: "specific-functions/records.md" })]),
      );
    }
  });

  it("rejects duplicate ids without silently dropping content", async () => {
    const temp = await mkdtemp(join(tmpdir(), "bridgecrux-invalid-"));
    const source = await readFile(join(fixture, "specific-functions/records.md"), "utf8");
    await writeFile(join(temp, "duplicate.md"), `${source}\n${source}`, "utf8");
    const parsed = {
      root: temp,
      config: JSON.parse(await readFile(join(fixture, "crux.config.json"), "utf8")),
      files: [
        {
          path: join(temp, "duplicate.md"),
          relativePath: "specific-functions/duplicate.md",
          kind: "specific_function" as const,
          source: `${source}\n${source}`,
          blocks: parseFrontmatterBlocks(`${source}\n${source}`),
        },
      ],
    };
    const result = validateCruxContent(parsed, { operationIds: operations });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "content_id_duplicate" })]));
  });

  it("rejects removed schema-2 and model sampling contracts with migration diagnostics", async () => {
    const parsed = await parseCruxContent(await discoverCruxContent(fixture));
    parsed.config = {
      ...parsed.config!,
      schemaVersion: 2,
      models: {
        ...parsed.config!.models,
        router: { ...parsed.config!.models.router, temperature: 0.2 },
      },
    } as never;
    const result = validateCruxContent(parsed, { operationIds: operations });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "schema_version_removed" }),
      expect.objectContaining({ code: "model_sampling_removed" }),
    ]));
  });

  it("rejects surface affordances without access and observable states", async () => {
    const parsed = await parseCruxContent(await discoverCruxContent(fixture));
    parsed.config!.capabilities[0]!.surfaces[0] = {
      ...parsed.config!.capabilities[0]!.surfaces[0]!,
      access: undefined,
      states: { loading: "", success: "", error: "" },
    } as never;
    const result = validateCruxContent(parsed, { operationIds: operations });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "surface_state_contract_missing" }));
  });
});
