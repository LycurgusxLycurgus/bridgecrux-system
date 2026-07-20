import { GeminiModelClient, GeminiTaskSignalRouter, TelegramChannelAdapter } from "@bridge-crux/adapters";
import {
  DeclarativeSpecificFunctionController,
  DefaultOperationExecutor,
  DefaultRouterDecisionValidator,
  DefaultTurnController,
  DefaultUserCopyGate,
  HandlerBindingRegistry,
  InMemoryReportStore,
  OperationRegistry,
  SpecificFunctionRegistry,
  type LedgerEvent,
  type PersistedMessage,
  type RawRouterDecision,
  type RouterDecisionAudit,
  type RouteRegistryDefinition,
  type RuntimeMessage,
  type RuntimePorts,
} from "@bridge-crux/core";
import { describe, expect, it, vi } from "vitest";

const registry: RouteRegistryDefinition = {
  routes: [
    {
      id: "records",
      intents: [
        {
          id: "complete",
          speechActs: ["announcement", "execution", "confirmation"],
          temporalStances: ["past", "present"],
          mutationClasses: ["complete_record"],
          requiredFields: ["evidence", "result"],
          requiredState: ["records"],
          evidencePolicyId: "record_completion",
        },
      ],
    },
  ],
};

const binding = {
  route: "records",
  intent: "complete",
  handlerId: "records-controller",
  allowedMutationClasses: ["complete_record"],
  requiredState: ["records"],
  operationIds: ["records.complete"],
  copySources: ["high_thinking_tutor" as const],
  auditEvents: ["record.completed"],
};

describe("whole-turn conformance", () => {
  it("runs normalized inbound through validated persistence, operation, truthful copy, delivery, and audit", async () => {
    const domain = new Map([["record-alpha", { status: "active", evidence: "" }]]);
    const modelCalls: unknown[] = [];
    const modelProvider = {
      models: {
        generateContent: vi.fn(async (request: unknown) => {
          modelCalls.push(request);
          return modelCalls.length === 1
            ? { text: JSON.stringify(routerDecision()) }
            : { text: "Record Alpha is complete and the evidence is saved." };
        }),
      },
    };
    const model = new GeminiModelClient({ client: modelProvider });
    const router = new GeminiTaskSignalRouter({ model: "gemini-test", client: model });
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 501 } }), { status: 200 }));
    const channel = new TelegramChannelAdapter({ token: "test", fetch: send, retryDelay: async () => undefined });
    const auditDecisions: RouterDecisionAudit[] = [];
    const ledger: LedgerEvent[] = [];
    const inboundKeys = new Set<string>();
    const messages: RuntimeMessage[] = [];
    const reports = new InMemoryReportStore(() => 1_700_000_000_000);
    let operationExecutions = 0;

    const operationRegistry = new OperationRegistry();
    operationRegistry.register({
      operationId: "records.complete",
      async execute(operation) {
        operationExecutions += 1;
        const record = domain.get(operation.target);
        if (!record) return { operationId: operation.id, status: "failed", error: { status: 404, code: "record_missing", message: "Record was not found" } };
        record.status = "completed";
        record.evidence = String(operation.payload.evidence ?? "");
        return { operationId: operation.id, status: "succeeded", persistedIds: [operation.target], output: { status: record.status } };
      },
    });

    const bindings = new HandlerBindingRegistry([binding]);
    const functions = new SpecificFunctionRegistry();
    functions.register(
      new DeclarativeSpecificFunctionController({
        id: "records-controller",
        intents: {
          complete: {
            operations: (input) => [
              {
                id: "records.complete",
                kind: "mutate",
                target: input.decision.resolvedReferences[0]?.persistedId ?? "",
                payload: { evidence: input.decision.extracted.evidence },
                preconditions: [],
                preservation: { preserveOmittedFields: true, preserveHistory: true, reversible: false },
                idempotencyKey: `complete:${input.decision.resolvedReferences[0]?.persistedId}`,
                correlationId: input.correlationId,
              },
            ],
            response: () => ({
              source: "high_thinking_tutor",
              tutorInstruction: "State only the persisted completion result.",
              fallbackText: "Record Alpha is complete.",
              successClaims: ["record completion"],
            }),
          },
        },
      }),
    );

    const ports: RuntimePorts = {
      state: {
        async persistInbound(inbound): Promise<PersistedMessage> {
          const duplicate = inboundKeys.has(inbound.idempotencyKey);
          inboundKeys.add(inbound.idempotencyKey);
          const message: PersistedMessage = {
            id: inbound.id,
            userId: "user-42",
            sessionId: "session-1",
            channel: inbound.channel,
            direction: "inbound",
            text: inbound.text,
            normalizedText: inbound.text,
            inboundIdempotencyKey: inbound.idempotencyKey,
            deliveryStatus: "sent",
            correlationId: inbound.correlationId,
            createdAt: inbound.timestamp,
            ...(duplicate ? { duplicate: true } : {}),
          };
          if (!duplicate) messages.push(message);
          return message;
        },
        async load() {
          return {
            user: { id: "user-42", externalId: "42", channel: "telegram", locale: "en" },
            session: { id: "session-1", cruxId: "records", status: "active", inboundTurnCount: 1, conversationWindow: 12 },
            recentMessages: [...messages],
            memories: [],
            ledgerSummary: { latestEvents: [...ledger], counts: {} },
            recentRouterDecisions: [...auditDecisions],
            availableState: ["records"],
            domainState: { records: [...domain.entries()] },
          };
        },
        async persistOutbound(outbound, delivery) {
          const persisted: PersistedMessage = {
            id: outbound.id,
            userId: outbound.userId,
            sessionId: outbound.sessionId,
            channel: outbound.channel,
            direction: "outbound",
            text: outbound.text,
            copySource: outbound.copySource,
            ...(outbound.route ? { route: outbound.route } : {}),
            ...(outbound.intent ? { intent: outbound.intent } : {}),
            ...(delivery.channelMessageId ? { channelMessageId: delivery.channelMessageId } : {}),
            deliveryStatus: delivery.status,
            correlationId: outbound.correlationId,
            createdAt: outbound.createdAt,
          };
          messages.push(persisted);
          return persisted;
        },
      },
      audit: {
        async persistRouterDecision(decision) {
          auditDecisions.push(decision);
        },
        async appendLedger(events) {
          ledger.push(...events);
        },
      },
      operations: new DefaultOperationExecutor(operationRegistry, undefined, () => 1_700_000_000_000),
      memory: { list: async () => [], apply: async () => [] },
      reports,
      jobs: { enqueue: async (job) => ({ ...job, id: "job-1", status: "queued" }) },
      model,
      channel,
    };
    const controller = new DefaultTurnController({
      router,
      validator: new DefaultRouterDecisionValidator(),
      bindings,
      functions,
      ports,
      copyGate: new DefaultUserCopyGate(),
      validationContext: (state) => ({
        registry,
        bindings: bindings.list(),
        referenceCandidates: [{ persistedId: "record-alpha", aliases: ["Record Alpha", "alpha"] }],
        availableState: state.availableState,
        evidencePolicies: { record_completion: { id: "record_completion", requiredDimensions: ["evidence", "result"] } },
        minimumGapConfidence: 0.75,
        reportPersistable: true,
      }),
      tutor: { model: "gemini-test", systemPrompt: "Write truthful user-facing copy without implementation vocabulary." },
      now: () => 1_700_000_000_000,
      id: (() => {
        let sequence = 0;
        return () => `generated-${++sequence}`;
      })(),
    });
    const input = {
      cruxId: "records",
      event: telegramUpdate(),
      registry,
      declaredOperations: ["records.complete"],
      safetyPolicies: ["block unresolved mutation references"],
      mutationPolicies: ["require positive completion evidence"],
      conversationWindow: 12,
    };

    const result = await controller.handle(input);
    const duplicate = await controller.handle(input);

    expect(result.status).toBe("completed");
    expect(result.decision).toMatchObject({ validationStatus: "accepted", allowedMutation: true, validatedHandlerTarget: "records-controller" });
    expect(result.operationResults).toEqual([expect.objectContaining({ operationId: "records.complete", status: "succeeded" })]);
    expect(result.outbound).toMatchObject({ text: "Record Alpha is complete and the evidence is saved.", channelMessageId: "501", deliveryStatus: "sent" });
    expect(domain.get("record-alpha")).toEqual({ status: "completed", evidence: "signed result" });
    expect(auditDecisions.map((audit) => audit.phase)).toEqual(["raw", "validated"]);
    expect(ledger).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(modelCalls).toEqual([
      expect.objectContaining({ config: expect.objectContaining({ thinkingConfig: { thinkingLevel: "HIGH" } }) }),
      expect.objectContaining({ config: expect.objectContaining({ thinkingConfig: { thinkingLevel: "HIGH" } }) }),
    ]);
    const deliveryBody = JSON.parse(String((send.mock.calls[0]?.[1] as RequestInit | undefined)?.body)) as Record<string, unknown>;
    expect(deliveryBody).toMatchObject({ parse_mode: "HTML", text: "Record Alpha is complete and the evidence is saved." });
    expect(operationExecutions).toBe(1);
    expect(duplicate.status).toBe("duplicate");
    expect(await reports.listOpen()).toEqual([]);
  });
});

function routerDecision(): RawRouterDecision {
  return {
    route: "records",
    intent: "complete",
    confidence: 0.98,
    needsHighThinking: true,
    speechAct: "announcement",
    temporalStance: "past",
    targetReferences: [{ raw: "Record Alpha", persistedId: "record-alpha", confidence: 1 }],
    stateMutationCandidate: "complete_record",
    mutationEvidence: "positive",
    safetyFlag: "none",
    handlerTarget: "records-controller",
    extracted: { evidence: "signed result", result: "accepted" },
    reason: "The user explicitly reported completed evidence for Record Alpha",
  };
}

function telegramUpdate() {
  return {
    update_id: 700,
    message: {
      message_id: 33,
      from: { id: 42 },
      chat: { id: 42 },
      date: 1_700_000_000,
      text: "I completed Record Alpha with a signed result.",
    },
  };
}
