import { GeminiModelClient, GeminiTaskSignalRouter, TelegramChannelAdapter } from "@bridge-crux/adapters";
import {
  DeclarativeSpecificFunctionController,
  DefaultProcessController,
  DefaultOperationExecutor,
  DefaultRouterDecisionValidator,
  DefaultTurnController,
  DefaultUserCopyGate,
  HandlerBindingRegistry,
  ProcessRegistry,
  InMemoryCruxRuntime,
  InMemoryReportStore,
  InMemoryTurnLeaseStore,
  OperationRegistry,
  SpecificFunctionRegistry,
  ToolOperationRegistry,
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
  executionPolicy: { mode: "hybrid" as const, thinkingLevel: "high" as const, toolIds: ["records.complete"] },
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
          if (modelCalls.length === 1) return { text: JSON.stringify(routerDecision()) };
          if (modelCalls.length === 2) return { text: '{"action":"call","toolId":"records.complete","input":{"target":"record-alpha","evidence":"signed result"}}' };
          return { text: '{"action":"respond","text":"Record Alpha is complete and the evidence is saved."}' };
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
    const tools = new ToolOperationRegistry();
    tools.register({
      definition: {
        id: "records.complete",
        description: "Complete the validated record with evidence.",
        inputSchema: { type: "object", properties: { target: { type: "string" }, evidence: { type: "string" } } },
      },
      operation: ({ arguments: arguments_, handler }) => ({
        id: "records.complete",
        kind: "mutate",
        target: String(arguments_["target"] ?? handler.decision.resolvedReferences[0]?.persistedId ?? ""),
        payload: { evidence: arguments_["evidence"] },
        preconditions: [],
        preservation: { preserveOmittedFields: true, preserveHistory: true, reversible: false },
        idempotencyKey: `complete:${handler.decision.resolvedReferences[0]?.persistedId}`,
        correlationId: handler.correlationId,
      }),
    });
    const functions = new SpecificFunctionRegistry();
    functions.register(
      new DeclarativeSpecificFunctionController({
        id: "records-controller",
        intents: {
          complete: {
            operations: () => [],
            response: () => ({
              source: "high_thinking_tutor",
              tutorInstruction: "State only the persisted completion result.",
              fallbackText: "Record Alpha is complete.",
              successClaims: ["record completion"],
              toolIds: ["records.complete"],
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
      turns: new InMemoryTurnLeaseStore(() => 1_700_000_000_000),
    };
    const controller = new DefaultTurnController({
      router,
      validator: new DefaultRouterDecisionValidator(),
      bindings,
      functions,
      tools,
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
    expect(send).toHaveBeenCalledTimes(2);
    expect(modelCalls).toEqual([
      expect.objectContaining({ config: expect.objectContaining({ thinkingConfig: { thinkingLevel: "MEDIUM" } }) }),
      expect.objectContaining({ config: expect.objectContaining({ thinkingConfig: { thinkingLevel: "HIGH" } }) }),
      expect.objectContaining({ config: expect.objectContaining({ thinkingConfig: { thinkingLevel: "HIGH" } }) }),
    ]);
    const activityBody = JSON.parse(String((send.mock.calls[0]?.[1] as RequestInit | undefined)?.body)) as Record<string, unknown>;
    expect(activityBody).toMatchObject({ chat_id: "42", action: "typing" });
    const deliveryBody = JSON.parse(String((send.mock.calls[1]?.[1] as RequestInit | undefined)?.body)) as Record<string, unknown>;
    expect(deliveryBody).toMatchObject({ parse_mode: "HTML", text: "Record Alpha is complete and the evidence is saved." });
    expect(operationExecutions).toBe(1);
    expect(duplicate.status).toBe("duplicate");
    expect(await reports.listOpen()).toEqual([]);
  });
});

describe("deterministic process conformance", () => {
  it("advances from a trusted closed choice with zero router, tutor, or tool model calls", async () => {
    const processRegistry = new ProcessRegistry();
    processRegistry.register(new DefaultProcessController({
      id: "onboarding",
      version: "2",
      route: "process",
      intent: "answer",
      handlerId: "onboarding-controller",
      steps: [{
        id: "choose",
        input: {
          mode: "closed_choice",
          control: {
            id: "choose",
            field: "answer",
            prompt: "Choose one option.",
            options: [{ id: "yes", label: "Yes", value: true }, { id: "no", label: "No", value: false }],
          },
        },
        executionPolicy: { mode: "deterministic", toolIds: [] },
        completionMode: "controller",
        confirmationPolicy: "never",
        missingFieldQuestions: {},
      }],
      advanceOperationId: "process.advance",
      authoredCopy: { ready: "Choice saved.", partial: "Choose one option.", reject: "Choose one option.", clarify: "Choose one option." },
    }));
    const processRoute: RouteRegistryDefinition = {
      routes: [{
        id: "process",
        intents: [{
          id: "answer",
          speechActs: ["execution", "other"],
          temporalStances: ["present"],
          mutationClasses: ["advance_process"],
          requiredFields: ["answer"],
          requiredState: [],
        }],
      }],
    };
    const processBinding = {
      route: "process",
      intent: "answer",
      handlerId: "onboarding-controller",
      allowedMutationClasses: ["advance_process"],
      requiredState: [],
      operationIds: ["process.advance"],
      executionPolicy: { mode: "deterministic" as const, toolIds: [] as [] },
      copySources: ["authored_deterministic" as const],
      auditEvents: ["process.advanced"],
    };
    const bindings = new HandlerBindingRegistry([processBinding]);
    const operations = new OperationRegistry();
    const advance = vi.fn().mockImplementation(async (operation) => ({ operationId: operation.id, status: "succeeded" as const, persistedIds: [operation.target] }));
    operations.register({ operationId: "process.advance", execute: advance });
    let interactionSequence = 0;
    const runtime = new InMemoryCruxRuntime({
      cruxId: "process",
      userId: "user-1",
      externalId: "42",
      sessionId: "session-1",
      activeProcess: { processId: "onboarding", version: "2", runId: "run-1", activeStepId: "choose", state: {} },
      id: () => `interaction-${++interactionSequence}`,
    });
    const control = await runtime.interactions.issue({
      control: {
        id: "choose",
        field: "answer",
        prompt: "Choose one option.",
        options: [{ id: "yes", label: "Yes", value: true }, { id: "no", label: "No", value: false }],
      },
      userId: "user-1",
      sessionId: "session-1",
      processRunId: "run-1",
      stepId: "choose",
      correlationId: "seed",
    });
    const router = { modelName: "must-not-run", decide: vi.fn() };
    const model = { structured: vi.fn(), tutor: vi.fn(), toolLoop: vi.fn() };
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 600 } }), { status: 200 }));
    const channel = new TelegramChannelAdapter({ token: "test", fetch: send, retryDelay: async () => undefined });
    const ports = runtime.ports({ operations: new DefaultOperationExecutor(operations), model: model as never, channel });
    const controller = new DefaultTurnController({
      router: router as never,
      validator: new DefaultRouterDecisionValidator(),
      bindings,
      functions: new SpecificFunctionRegistry(),
      processes: processRegistry,
      ports,
      copyGate: new DefaultUserCopyGate(),
      validationContext: () => ({
        registry: processRoute,
        bindings: bindings.list(),
        referenceCandidates: [],
        availableState: [],
        evidencePolicies: {},
        minimumGapConfidence: 0.75,
        reportPersistable: true,
      }),
      tutor: { systemPrompt: "Not used." },
      id: (() => { let id = 0; return () => `turn-${++id}`; })(),
    });
    const event = {
      update_id: 701,
      callback_query: {
        id: "callback-701",
        from: { id: 42 },
        data: `bc:${control.id}:yes`,
        message: { message_id: 70, chat: { id: 42 } },
      },
    };
    const input = {
      cruxId: "process",
      event,
      registry: processRoute,
      declaredOperations: ["process.advance"],
      safetyPolicies: [],
      mutationPolicies: ["trusted choices only"],
      conversationWindow: 12,
    };

    await runtime.turns.acquire({ key: "process:telegram:42:42", correlationId: "blocking-turn", expiresAt: Date.now() + 60_000 });
    const busy = await controller.handle(input);
    expect(busy.status).toBe("busy");
    expect(runtime.messages).toHaveLength(0);
    expect(String(send.mock.calls[0]?.[0])).toContain("answerCallbackQuery");
    expect(router.decide).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
    await runtime.turns.release({ key: "process:telegram:42:42", correlationId: "blocking-turn" });

    const result = await controller.handle(input);
    const duplicate = await controller.handle(input);

    expect(result).toMatchObject({ status: "completed", operationResults: [{ operationId: "process.advance", status: "succeeded" }] });
    expect(duplicate.status).toBe("duplicate");
    expect(advance).toHaveBeenCalledOnce();
    expect(router.decide).not.toHaveBeenCalled();
    expect(model.structured).not.toHaveBeenCalled();
    expect(model.tutor).not.toHaveBeenCalled();
    expect(model.toolLoop).not.toHaveBeenCalled();
    expect(runtime.routerDecisions).toHaveLength(2);
    expect(runtime.routerDecisions.every((decision) => decision.model === undefined)).toBe(true);
  });
});

function routerDecision(): RawRouterDecision {
  return {
    route: "records",
    intent: "complete",
    confidence: 0.98,
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
