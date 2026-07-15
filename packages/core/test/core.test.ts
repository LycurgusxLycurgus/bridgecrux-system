import { describe, expect, it, vi } from "vitest";
import {
  DefaultCapabilityGapGate,
  DefaultDeterministicProcessController,
  DefaultEvidenceGate,
  DefaultMemoryController,
  DefaultMemoryReviewScheduler,
  DefaultOperationExecutor,
  DefaultReferenceResolver,
  DefaultReportController,
  DefaultRouterDecisionValidator,
  DefaultUserCopyGate,
  HandlerBindingRegistry,
  InMemoryIdempotencyStore,
  InMemoryReportStore,
  OperationRegistry,
  OptInFeedbackExporter,
  ReviewOnlyRepairQueue,
  RouteIntentRegistry,
  VALIDATION_CODES,
  auditHandlerBindings,
  type CruxOperation,
  type CruxStateBundle,
  type HandlerBinding,
  type HandlerInput,
  type MemoryOperation,
  type OperationContext,
  type ProcessTurnInput,
  type RawRouterDecision,
  type RouteRegistryDefinition,
  type RuntimeJob,
} from "../src/index.js";

const registry: RouteRegistryDefinition = {
  routes: [
    {
      id: "records",
      intents: [
        {
          id: "inspect",
          speechActs: ["question", "execution"],
          temporalStances: ["past", "present", "unclear"],
          mutationClasses: [],
          requiredFields: [],
          requiredState: ["records"],
        },
        {
          id: "complete",
          speechActs: ["announcement", "execution"],
          temporalStances: ["past", "present"],
          mutationClasses: ["complete_record"],
          requiredFields: ["evidence"],
          requiredState: ["records"],
          evidencePolicyId: "completion",
        },
      ],
    },
    {
      id: "conversation",
      intents: [
        {
          id: "unsupported_execution",
          speechActs: ["execution"],
          temporalStances: ["present", "unclear"],
          mutationClasses: [],
          requiredFields: [],
          requiredState: [],
          capabilityGapEligible: true,
        },
      ],
    },
  ],
};

const bindings: HandlerBinding[] = [
  {
    route: "records",
    intent: "inspect",
    handlerId: "records-controller",
    allowedMutationClasses: [],
    requiredState: ["records"],
    operationIds: ["records.read"],
    copySources: ["high_thinking_tutor"],
    auditEvents: ["records.inspected"],
  },
  {
    route: "records",
    intent: "complete",
    handlerId: "records-controller",
    allowedMutationClasses: ["complete_record"],
    requiredState: ["records"],
    operationIds: ["records.complete"],
    copySources: ["high_thinking_tutor"],
    auditEvents: ["records.completed"],
  },
  {
    route: "conversation",
    intent: "unsupported_execution",
    handlerId: "gap-controller",
    allowedMutationClasses: [],
    requiredState: [],
    operationIds: [],
    copySources: ["safe_fallback"],
    auditEvents: ["capability_gap.created"],
  },
];

describe("route and binding registries", () => {
  it("rejects duplicate routes and reports incomplete task paths", () => {
    expect(() => new RouteIntentRegistry({ routes: [registry.routes[0]!, registry.routes[0]!] })).toThrow(/Duplicate/);
    const routeRegistry = new RouteIntentRegistry(registry);
    const bindingRegistry = new HandlerBindingRegistry(bindings.slice(0, 2));
    const issues = auditHandlerBindings(routeRegistry, bindingRegistry, ["records.read", "records.complete", "internal.only"]);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "handler_binding", route: "conversation" }),
        expect.objectContaining({ type: "surface_omission", operationId: "internal.only" }),
      ]),
    );
  });
});

describe("reference and evidence gates", () => {
  it("gives explicit references precedence and blocks ambiguity", () => {
    const resolver = new DefaultReferenceResolver();
    const candidates = [
      { persistedId: "a", aliases: ["first"] },
      { persistedId: "b", aliases: ["second", "shared"] },
      { persistedId: "c", aliases: ["shared"] },
    ];
    expect(
      resolver.resolve({
        references: [{ raw: "second", confidence: 0.9 }],
        candidates,
        activePersistedId: "a",
        allowActiveFallback: true,
      }).references[0]?.persistedId,
    ).toBe("b");
    expect(
      resolver.resolve({ references: [{ raw: "shared", confidence: 0.7 }], candidates, allowActiveFallback: true }).status,
    ).toBe("ambiguous");
  });

  it("distinguishes announcements, partial, sufficient, and contradictory evidence", () => {
    const gate = new DefaultEvidenceGate();
    const policy = { id: "completion", requiredDimensions: ["evidence", "result"], contradictionFields: ["confirmed"] };
    expect(
      gate.assess(
        { speechAct: "proposal", temporalStance: "future", mutationEvidence: "positive", extracted: { evidence: "later" } },
        policy,
      ).status,
    ).toBe("announced");
    expect(
      gate.assess(
        { speechAct: "announcement", temporalStance: "present", mutationEvidence: "positive", extracted: { evidence: "done" } },
        policy,
      ).status,
    ).toBe("partial");
    expect(
      gate.assess(
        {
          speechAct: "announcement",
          temporalStance: "past",
          mutationEvidence: "positive",
          extracted: { evidence: "done", result: "accepted" },
        },
        policy,
      ).permitsCompletion,
    ).toBe(true);
    expect(
      gate.assess(
        {
          speechAct: "announcement",
          temporalStance: "past",
          mutationEvidence: "positive",
          extracted: { evidence: "done", result: "accepted", confirmed: false },
        },
        policy,
      ).status,
    ).toBe("contradictory");
  });
});

describe("capability gap and router validation", () => {
  it("accepts only explicit, non-mutating, reportable unsupported execution", () => {
    const gate = new DefaultCapabilityGapGate();
    const decision = raw({
      route: "conversation",
      intent: "unsupported_execution",
      speechAct: "execution",
      anticipatedRoute: "exports",
      capabilityGap: "Export is unavailable",
      capabilityGapType: "software_capability",
    });
    expect(
      gate.assess({
        decision,
        registry,
        hasHandler: true,
        hasOperation: false,
        minimumConfidence: 0.75,
        reportPersistable: true,
      }).eligible,
    ).toBe(true);
    expect(
      gate.assess({
        decision: { ...decision, speechAct: "question" },
        registry,
        hasHandler: true,
        hasOperation: false,
        minimumConfidence: 0.75,
        reportPersistable: true,
      }).eligible,
    ).toBe(false);
  });

  it("blocks mutation without sufficient evidence and clears stale metadata", () => {
    const validator = new DefaultRouterDecisionValidator();
    const decision = raw({
      route: "records",
      intent: "complete",
      speechAct: "announcement",
      temporalStance: "past",
      stateMutationCandidate: "complete_record",
      mutationEvidence: "positive",
      extracted: { evidence: "done" },
      anticipatedRoute: "none",
      capabilityGap: "unknown",
    });
    const result = validator.validate({ decision, context: validationContext() });
    expect(result.validationStatus).toBe("clarification");
    expect(result.allowedMutation).toBe(false);
    expect(result.validationCodes).toContain(VALIDATION_CODES.EVIDENCE_INSUFFICIENT);
    expect(result).not.toHaveProperty("anticipatedRoute");
    expect(result).not.toHaveProperty("capabilityGap");
  });

  it("preserves compatible additional signals and rejects duplicates", () => {
    const validator = new DefaultRouterDecisionValidator();
    const primary = raw({ route: "records", intent: "inspect", speechAct: "question" });
    const additional = raw({ route: "records", intent: "inspect", speechAct: "question", targetReferences: [{ raw: "second", confidence: 1 }] });
    const result = validator.validate({
      decision: { ...primary, additionalSignals: [additional, additional] },
      context: validationContext(),
    });
    expect(result.compositeStatus).toBe("compatible");
    expect(result.additionalSignals).toHaveLength(1);
    expect(result.validationCodes).toContain(VALIDATION_CODES.DUPLICATE_SIGNAL);
  });

  it("authorizes a complete, referenced mutation only after all gates pass", () => {
    const validator = new DefaultRouterDecisionValidator();
    const decision = raw({
      route: "records",
      intent: "complete",
      speechAct: "announcement",
      temporalStance: "past",
      stateMutationCandidate: "complete_record",
      mutationEvidence: "positive",
      targetReferences: [{ raw: "second", confidence: 1 }],
      extracted: { evidence: "done", result: "accepted" },
    });
    const result = validator.validate({ decision, context: validationContext() });
    expect(result.validationStatus).toBe("corrected");
    expect(result.allowedMutation).toBe(true);
    expect(result.validatedHandlerTarget).toBe("records-controller");
    expect(result.resolvedReferences[0]?.persistedId).toBe("b");
  });
});

describe("operation execution", () => {
  it("enforces binding authorization, idempotency, and correlation ledger events", async () => {
    const operationRegistry = new OperationRegistry();
    const execute = vi.fn(async (operation: CruxOperation) => ({ operationId: operation.id, status: "succeeded" as const, output: { ok: true } }));
    operationRegistry.register({ operationId: "records.complete", execute });
    const executor = new DefaultOperationExecutor(operationRegistry, new InMemoryIdempotencyStore(), () => 10);
    const operation = mutationOperation();
    const context = operationContext();
    const first = await executor.execute(
      { operations: [operation], ordering: "declared", responsePlan: responsePlan() },
      context,
    );
    const second = await executor.execute(
      { operations: [operation], ordering: "declared", responsePlan: responsePlan() },
      context,
    );
    expect(first.status).toBe("succeeded");
    expect(first.ledgerEvents[0]).toMatchObject({ eventType: "operation.succeeded", correlationId: "corr" });
    expect(second.results[0]?.status).toBe("duplicate");
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("process, memory, and copy protection", () => {
  it("keeps deterministic progression in code", async () => {
    const controller = new DefaultDeterministicProcessController({
      id: "process",
      steps: [{ id: "one", requiredFields: ["answer"], nextStepId: "two" }, { id: "two", requiredFields: [] }],
      advanceOperationId: "process.advance",
      authoredCopy: { accept: "Accepted", partial: "More needed", reject: "Try again", clarify: "Please clarify" },
    });
    const input = processInput({ answer: "yes" });
    const assessment = await controller.assess(input);
    const plan = await controller.plan({ ...input, assessment });
    expect(assessment.canAdvance).toBe(true);
    expect(plan.operations[0]).toMatchObject({ id: "process.advance", kind: "mutate" });
    const question = await controller.assess({ ...input, decision: { ...input.decision, speechAct: "question" } });
    expect(question.canAdvance).toBe(false);
  });

  it("rejects tutor-authored or secret memory and blocks false success copy", async () => {
    const operations: MemoryOperation[] = [
      { type: "upsert", topic: "preference", line: "Prefers concise answers", evidence: "user said so", confidence: 0.9 },
      { type: "upsert", topic: "credential", line: "api key: hidden", evidence: "user said so", confidence: 1 },
      { type: "upsert", topic: "guess", line: "Tutor guessed this", evidence: "tutor output", confidence: 0.9 },
    ];
    const memory = new DefaultMemoryController(async () => operations);
    const input = {
      userId: "u",
      cruxId: "c",
      userAuthoredEvidence: ["user said so"],
      confirmedMilestones: [],
      currentMemories: [],
      correlationId: "corr",
    };
    expect(memory.validate(operations, input)).toEqual([operations[0]]);

    const gate = new DefaultUserCopyGate();
    expect(
      gate.validate({
        source: "high_thinking_tutor",
        text: "Done.",
        operationResults: [{ operationId: "x", status: "failed" }],
        successClaims: ["record_saved"],
      }).ok,
    ).toBe(false);
    expect(
      gate.validate({ source: "high_thinking_tutor", text: "The router decision says yes.", operationResults: [], successClaims: [] }).ok,
    ).toBe(false);
  });

  it("schedules memory review at the configured interval or milestone, never every turn by default", async () => {
    const enqueue = vi.fn(async (job: RuntimeJob) => ({ ...job, id: "job-1", status: "queued" as const }));
    const scheduler = new DefaultMemoryReviewScheduler({ enqueue });
    const base = {
      userId: "u",
      cruxId: "c",
      inboundTurnCount: 29,
      reviewEveryInboundTurns: 30,
      reviewAtMilestones: true,
      milestoneReached: false,
      correlationId: "corr",
    };
    expect(await scheduler.schedule(base)).toBeUndefined();
    expect(await scheduler.schedule({ ...base, inboundTurnCount: 30 })).toMatchObject({ kind: "memory_review", status: "queued" });
    expect(await scheduler.schedule({ ...base, inboundTurnCount: 2, milestoneReached: true })).toMatchObject({
      payload: expect.objectContaining({ reason: "milestone" }),
    });
    expect(enqueue).toHaveBeenCalledTimes(2);
  });
});

describe("reports, repair, and feedback privacy", () => {
  it("redacts reports, keeps repair review-only, and exports nothing while disabled", async () => {
    const store = new InMemoryReportStore(() => 10);
    const controller = new DefaultReportController(store);
    const report = await controller.capture({
      severity: "bug",
      boundary: "binding",
      cruxId: "records",
      route: "records",
      intent: "complete",
      summary: "token=summary-secret binding failed",
      transcriptExcerpt: "password=transcript-secret please complete it",
      stateSnapshot: { apiKey: "state-secret", recordId: "one" },
      correlationId: "corr",
    });
    expect(report.summary).toBe("token=[redacted] binding failed");
    expect(report.transcriptExcerpt).toBe("password=[redacted] please complete it");
    expect(report.stateSnapshot).toEqual({ apiKey: "[redacted]", recordId: "[redacted]" });
    expect(await controller.classify(report)).toMatchObject({ kind: "contract" });

    const repair = new ReviewOnlyRepairQueue();
    const proposal = await repair.process(await repair.enqueue(report));
    expect(proposal).toMatchObject({ status: "proposed", reportId: report.id });

    const send = vi.fn();
    const exporter = new OptInFeedbackExporter({ enabled: false, endpoint: "https://feedback.invalid", fetcher: send });
    const preview = await exporter.preview({ report, frameworkVersion: "0.1.0", adapterVersions: { convex: "0.1.0" } });
    expect(preview).not.toHaveProperty("transcriptExcerpt");
    expect(preview).not.toHaveProperty("stateSnapshot");
    expect(await exporter.export(preview)).toEqual({ status: "disabled" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends only the inspectable redacted preview after explicit opt-in", async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202, headers: { "x-request-id": "feedback-1" } }));
    const exporter = new OptInFeedbackExporter({ enabled: true, endpoint: "https://feedback.invalid", fetcher: send });
    const store = new InMemoryReportStore(() => 10);
    const report = await new DefaultReportController(store).capture({
      severity: "model_error",
      boundary: "model",
      summary: "secret=provider-value failed",
      transcriptExcerpt: "token=private-value",
      stateSnapshot: { privateValue: "hidden" },
      correlationId: "corr",
    });
    const preview = await exporter.preview({ report, frameworkVersion: "0.1.0", adapterVersions: { gemini: "2.11.0" } });
    expect(await exporter.export(preview)).toEqual({ status: "sent", reference: "feedback-1" });
    const body = String((send.mock.calls[0]?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("secret=[redacted]");
    expect(body).not.toContain("provider-value");
    expect(body).not.toContain("private-value");
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

function validationContext() {
  return {
    registry,
    bindings,
    referenceCandidates: [
      { persistedId: "a", aliases: ["first"] },
      { persistedId: "b", aliases: ["second"] },
    ],
    activeReferenceId: "a",
    availableState: ["records"],
    evidencePolicies: { completion: { id: "completion", requiredDimensions: ["evidence", "result"] } },
    minimumGapConfidence: 0.75,
    reportPersistable: true,
  };
}

function state(): CruxStateBundle {
  return {
    user: { id: "u", externalId: "external", channel: "test" },
    session: { id: "s", cruxId: "c", status: "active", inboundTurnCount: 1, conversationWindow: 10 },
    recentMessages: [],
    memories: [],
    ledgerSummary: { latestEvents: [], counts: {} },
    recentRouterDecisions: [],
    availableState: ["records"],
  };
}

function operationContext(): OperationContext {
  const decision = new DefaultRouterDecisionValidator().validate({
    decision: raw({
      route: "records",
      intent: "complete",
      speechAct: "announcement",
      temporalStance: "past",
      stateMutationCandidate: "complete_record",
      mutationEvidence: "positive",
      extracted: { evidence: "done", result: "accepted" },
    }),
    context: validationContext(),
  });
  return { state: state(), binding: bindings[1]!, decision, correlationId: "corr" };
}

function mutationOperation(): CruxOperation {
  return {
    id: "records.complete",
    kind: "mutate",
    target: "a",
    payload: {},
    preconditions: [],
    preservation: { preserveOmittedFields: true, preserveHistory: true, reversible: false },
    idempotencyKey: "once",
    correlationId: "corr",
  };
}

function responsePlan() {
  return { source: "high_thinking_tutor" as const, fallbackText: "Could not complete", successClaims: ["completed"] };
}

function processInput(extracted: Record<string, unknown>): ProcessTurnInput {
  const handlerInput: HandlerInput = {
    state: state(),
    binding: bindings[1]!,
    decision: {
      ...raw({
        route: "records",
        intent: "complete",
        speechAct: "announcement",
        temporalStance: "present",
        stateMutationCandidate: "complete_record",
        mutationEvidence: "positive",
        extracted,
      }),
      validationStatus: "accepted",
      validationCodes: [],
      resolvedReferences: [],
      allowedMutation: true,
      validatedHandlerTarget: "process",
    },
    correlationId: "corr",
  };
  return {
    ...handlerInput,
    process: { processId: "process", version: "1", runId: "run", activeStepId: "one", state: {} },
  };
}
