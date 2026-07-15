import type { NormalizedInboundMessage, RawRouterDecision } from "@bridge-crux/core";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { ConvexBridgeCruxRepository } from "../src/repository.js";
import { bridgeCruxSchema } from "../src/schema.js";

const inbound: NormalizedInboundMessage = {
  id: "m-1",
  userExternalId: "telegram-42",
  channel: "telegram",
  text: "Show the current record",
  attachments: [],
  timestamp: 1_700_000_000_000,
  idempotencyKey: "telegram:update:1",
  correlationId: "corr-1",
};
const modules = { "./_generated/api.ts": async () => ({}) };

describe("ConvexBridgeCruxRepository", () => {
  it("persists inbound messages idempotently and loads bounded runtime state", async () => {
    const t = convexTest({ schema: bridgeCruxSchema, modules });
    const first = await t.run((ctx) => new ConvexBridgeCruxRepository(ctx.db, undefined, () => 100).persistInbound(inbound, "records"));
    const duplicate = await t.run((ctx) => new ConvexBridgeCruxRepository(ctx.db, undefined, () => 101).persistInbound(inbound, "records"));
    const state = await t.run((ctx) =>
      new ConvexBridgeCruxRepository(ctx.db).load({ cruxId: "records", inbound, conversationWindow: 5 }),
    );

    expect(first.duplicate).toBeUndefined();
    expect(duplicate.duplicate).toBe(true);
    expect(state.recentMessages).toHaveLength(1);
    expect(state.session.inboundTurnCount).toBe(1);
    expect(state.availableState).toContain("messages");
  });

  it("persists composite router audits before correlated ledger events", async () => {
    const t = convexTest({ schema: bridgeCruxSchema, modules });
    const persisted = await t.run((ctx) => new ConvexBridgeCruxRepository(ctx.db).persistInbound(inbound, "records"));
    const decision: RawRouterDecision = raw({
      additionalSignals: [raw({ route: "conversation", intent: "explain", reason: "secondary" })],
    });
    await t.run(async (ctx) => {
      const repository = new ConvexBridgeCruxRepository(ctx.db, undefined, () => 200);
      await repository.persistRouterDecision({
        phase: "raw",
        decision,
        cruxId: "records",
        sessionId: persisted.sessionId,
        correlationId: "corr-1",
        model: "test-router",
        createdAt: 200,
      });
      await repository.appendLedger([
        { eventType: "record.inspected", source: "test", payload: { ok: true }, correlationId: "corr-1", createdAt: 201 },
      ]);
    });
    const counts = await t.run(async (ctx) => ({
      decisions: (await ctx.db.query("bridgecruxRouterDecisions").collect()).length,
      ledger: (await ctx.db.query("bridgecruxLedger").collect()).length,
    }));
    expect(counts).toEqual({ decisions: 2, ledger: 1 });
  });

  it("stores memories, reports, jobs, and operation idempotency records", async () => {
    const t = convexTest({ schema: bridgeCruxSchema, modules });
    const persisted = await t.run((ctx) => new ConvexBridgeCruxRepository(ctx.db).persistInbound(inbound, "records"));
    await t.run(async (ctx) => {
      const repository = new ConvexBridgeCruxRepository(ctx.db, undefined, () => 300);
      await repository.applyMemories(
        [{ type: "upsert", topic: "preferred_view", line: "compact", evidence: "user asked", confidence: 0.9 }],
        { userId: persisted.userId, cruxId: "records", correlationId: "corr-1" },
      );
      await repository.createReport({
        cruxId: "records",
        severity: "bug",
        boundary: "router",
        summary: "A route needs review",
        stateSnapshot: { token: "secret" },
        correlationId: "corr-1",
      });
      await repository.enqueueJob({ kind: "memory_review", payload: { userId: persisted.userId }, correlationId: "corr-1" });
      await repository.recordOperation({
        userId: persisted.userId,
        sessionId: persisted.sessionId,
        cruxId: "records",
        operation: {
          operationId: "records.read",
          kind: "query",
          target: "record-1",
          payload: {},
          result: { operationId: "records.read", status: "succeeded", output: { id: "record-1" } },
          idempotencyKey: "read-once",
          correlationId: "corr-1",
          startedAt: 299,
        },
      });
      await repository.recordOperation({
        userId: persisted.userId,
        sessionId: persisted.sessionId,
        cruxId: "records",
        operation: {
          operationId: "records.read",
          kind: "query",
          target: "record-1",
          payload: {},
          result: { operationId: "records.read", status: "succeeded" },
          idempotencyKey: "read-once",
          correlationId: "corr-1",
          startedAt: 300,
        },
      });
    });
    const result = await t.run(async (ctx) => {
      const repository = new ConvexBridgeCruxRepository(ctx.db);
      return {
        memories: await repository.listMemories(persisted.userId, "records"),
        reports: await repository.listOpenReports(),
        operation: await repository.operationByIdempotency("read-once"),
        operationCount: (await ctx.db.query("bridgecruxOperationExecutions").collect()).length,
        jobCount: (await ctx.db.query("bridgecruxJobs").collect()).length,
      };
    });
    expect(result.memories[0]?.line).toBe("compact");
    expect(result.reports[0]?.stateSnapshot).toEqual({ token: "[redacted]" });
    expect(result.operation?.output).toEqual({ id: "record-1" });
    expect(result.operationCount).toBe(1);
    expect(result.jobCount).toBe(1);
  });

  it("completes a deferred item without advancing the active process step", async () => {
    const t = convexTest({ schema: bridgeCruxSchema, modules });
    const persisted = await t.run((ctx) => new ConvexBridgeCruxRepository(ctx.db).persistInbound(inbound, "records"));
    const seeded = await t.run(async (ctx) => {
      const processRunId = await ctx.db.insert("bridgecruxProcessRuns", {
        userId: persisted.userId as never,
        sessionId: persisted.sessionId as never,
        cruxId: "records",
        processId: "review",
        processVersion: "1",
        status: "active",
        activeStepId: "step-two",
        stateJson: "{}",
        startedAt: 1,
        updatedAt: 1,
      });
      const session = await ctx.db.get(persisted.sessionId as never);
      if (!session || !("inboundTurnCount" in session)) throw new Error("session missing");
      await ctx.db.patch(session._id, { activeProcessId: "review", activeProcessRunId: processRunId, activeProcessStep: "step-two" });
      await ctx.db.insert("bridgecruxProcessItems", {
        userId: persisted.userId as never,
        processRunId,
        itemId: "item-one",
        stepId: "step-one",
        canonicalOrder: 1,
        status: "active",
        stateJson: "{}",
        updatedAt: 1,
      });
      return processRunId;
    });
    await t.run(async (ctx) => {
      const repository = new ConvexBridgeCruxRepository(ctx.db, undefined, () => 400);
      await repository.deferProcessItem({ processRunId: seeded, itemId: "item-one", reason: "wait for evidence" });
      await repository.completeDeferredProcessItem({ processRunId: seeded, itemId: "item-one", ledgerEventId: "ledger-1" });
    });
    const state = await t.run((ctx) =>
      new ConvexBridgeCruxRepository(ctx.db).load({ cruxId: "records", inbound, conversationWindow: 5 }),
    );
    expect(state.activeProcess?.activeStepId).toBe("step-two");
    expect(state.deferredItems).toBeUndefined();
  });
});

function raw(overrides: Partial<RawRouterDecision> = {}): RawRouterDecision {
  return {
    route: "records",
    intent: "inspect",
    confidence: 0.95,
    needsHighThinking: true,
    speechAct: "question",
    temporalStance: "present",
    targetReferences: [],
    stateMutationCandidate: "none",
    mutationEvidence: "insufficient",
    safetyFlag: "none",
    extracted: {},
    reason: "test",
    ...overrides,
  };
}
