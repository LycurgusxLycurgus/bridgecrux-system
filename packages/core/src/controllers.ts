import { randomUUID } from "node:crypto";
import type {
  ChannelSendResult,
  CruxOperation,
  DeterministicProcessController,
  HandlerBinding,
  HandlerInput,
  HandlerResult,
  OperationResult,
  OutboundMessage,
  ProcessAssessment,
  ProcessTurnInput,
  ResponsePlan,
  RouterDecisionValidator,
  RouterValidationContext,
  RuntimeErrorEnvelope,
  RuntimePorts,
  SpecificFunctionController,
  TaskSignalRouter,
  TurnController,
  TurnInput,
  TurnResult,
  UserCopyGate,
  ValidatedProcessInput,
  ValidatedTaskSignalDecision,
} from "./contracts.js";
import type { HandlerBindingRegistry, SpecificFunctionRegistry } from "./registry.js";

export type TurnControllerOptions = {
  router: TaskSignalRouter;
  validator: RouterDecisionValidator;
  bindings: HandlerBindingRegistry;
  functions: SpecificFunctionRegistry;
  ports: RuntimePorts;
  copyGate: UserCopyGate;
  validationContext(state: Parameters<RouterValidationContextFactory>[0]): RouterValidationContext;
  tutor: {
    model: string;
    systemPrompt: string;
  };
  now?: () => number;
  id?: () => string;
};

type RouterValidationContextFactory = (state: Awaited<ReturnType<RuntimePorts["state"]["load"]>>) => RouterValidationContext;

/** @experimental Generic turn orchestration requires validation against a second real crux before stabilization. */
export class DefaultTurnController implements TurnController {
  readonly #now: () => number;
  readonly #id: () => string;

  constructor(private readonly options: TurnControllerOptions) {
    this.#now = options.now ?? Date.now;
    this.#id = options.id ?? randomUUID;
  }

  async handle(input: TurnInput): Promise<TurnResult> {
    let correlationId = this.#id();
    try {
      const inbound = await this.options.ports.channel.normalizeInbound(input.event);
      correlationId = inbound.correlationId;
      const persistedInbound = await this.options.ports.state.persistInbound(inbound, input.cruxId);
      if (persistedInbound.duplicate) {
        return { correlationId, operationResults: [], status: "duplicate" };
      }

      const state = await this.options.ports.state.load({
        cruxId: input.cruxId,
        inbound,
        conversationWindow: input.conversationWindow,
      });
      const raw = await this.options.router.decide({
        message: inbound,
        registry: input.registry,
        state,
        declaredOperations: input.declaredOperations,
        safetyPolicies: input.safetyPolicies,
        mutationPolicies: input.mutationPolicies,
      });
      await this.options.ports.audit.persistRouterDecision({
        phase: "raw",
        decision: raw,
        cruxId: input.cruxId,
        sessionId: state.session.id,
        correlationId,
        ...(this.options.router.modelName ? { model: this.options.router.modelName } : {}),
        createdAt: this.#now(),
      });

      const decision = this.options.validator.validate({ decision: raw, context: this.options.validationContext(state) });
      await this.options.ports.audit.persistRouterDecision({
        phase: "validated",
        decision,
        cruxId: input.cruxId,
        sessionId: state.session.id,
        correlationId,
        ...(this.options.router.modelName ? { model: this.options.router.modelName } : {}),
        createdAt: this.#now(),
      });

      const executable = decision.compositeStatus === "clarification" ? [] : [decision, ...decision.additionalSignals].filter(canExecute);
      const executions: { signal: ValidatedTaskSignalDecision; binding: HandlerBinding; plan: HandlerResult }[] = [];
      for (const signal of executable) {
        const binding = this.options.bindings.resolve(signal.route, signal.intent);
        const handlerId = signal.validatedHandlerTarget;
        const controller = handlerId ? this.options.functions.resolve(handlerId) : undefined;
        if (!binding || !controller || !controller.canHandle({ decision: signal, state, binding, correlationId })) {
          await this.options.ports.reports.create({
            severity: "bug",
            boundary: "binding",
            cruxId: input.cruxId,
            route: signal.route,
            intent: signal.intent,
            ...(handlerId ? { handler: handlerId } : {}),
            summary: "Validated decision did not resolve to an executable controller",
            stateSnapshot: { availableState: state.availableState },
            correlationId,
          });
          return {
            correlationId,
            decision,
            operationResults: [],
            status: "failed",
            error: runtimeError(500, "handler_resolution_failed", "Validated handler could not be resolved"),
          };
        }
        executions.push({ signal, binding, plan: await controller.plan({ decision: signal, state, binding, correlationId }) });
      }

      const operationResults: OperationResult[] = [];
      const ledger = [];
      for (const execution of executions) {
        const result = await this.options.ports.operations.execute(execution.plan, {
          state,
          binding: execution.binding,
          decision: execution.signal,
          correlationId,
        });
        operationResults.push(...result.results);
        ledger.push(...result.ledgerEvents);
      }
      if (ledger.length > 0) await this.options.ports.audit.appendLedger(ledger);

      const responsePlans = executions.map((execution) => execution.plan.responsePlan);
      const text = await this.#renderCopy(input, state, decision, operationResults, responsePlans);
      const source = selectCopySource(responsePlans, decision.needsHighThinking);
      const copyResult = this.options.copyGate.validate({
        source,
        text,
        operationResults,
        successClaims: responsePlans.flatMap((plan) => plan.successClaims),
        ...(state.user.locale ? { locale: state.user.locale } : {}),
      });
      if (!copyResult.ok) {
        await this.options.ports.reports.create({ ...copyResult.report, cruxId: input.cruxId, correlationId });
      }
      const outboundMessage: OutboundMessage = {
        id: this.#id(),
        userId: state.user.id,
        sessionId: state.session.id,
        channel: inbound.channel,
        ...(inbound.threadId ? { threadId: inbound.threadId } : {}),
        text: copyResult.ok ? copyResult.text : copyResult.fallbackText,
        copySource: copyResult.ok ? source : "safe_fallback",
        route: decision.route,
        intent: decision.intent,
        correlationId,
        createdAt: this.#now(),
      };
      const payloads = await this.options.ports.channel.formatOutbound(outboundMessage);
      const deliveries: ChannelSendResult[] = [];
      for (const payload of payloads) deliveries.push(await this.options.ports.channel.send(payload));
      const delivery = aggregateDelivery(deliveries);
      const outbound = await this.options.ports.state.persistOutbound(outboundMessage, delivery);
      const clarification = decision.validationStatus === "clarification" || decision.compositeStatus === "clarification";
      return {
        correlationId,
        decision,
        operationResults,
        outbound,
        status: delivery.status === "failed" ? "failed" : clarification ? "clarification" : "completed",
        ...(delivery.error ? { error: delivery.error } : {}),
      };
    } catch (error) {
      const envelope = runtimeError(500, "turn_failed", error instanceof Error ? error.message : "Turn failed");
      await this.options.ports.reports.create({
        severity: "bug",
        boundary: "unknown",
        cruxId: input.cruxId,
        summary: envelope.message,
        stateSnapshot: {},
        correlationId,
      });
      return { correlationId, operationResults: [], status: "failed", error: envelope };
    }
  }

  async #renderCopy(
    input: TurnInput,
    state: Awaited<ReturnType<RuntimePorts["state"]["load"]>>,
    decision: Parameters<RuntimePorts["audit"]["persistRouterDecision"]>[0]["decision"] & { additionalSignals?: unknown },
    operationResults: OperationResult[],
    plans: ResponsePlan[],
  ): Promise<string> {
    const validated = decision as Extract<typeof decision, { additionalSignals?: unknown }> & { validationStatus: string };
    const authored = plans.flatMap((plan) => (plan.authoredText ? [plan.authoredText] : []));
    const needsTutor = plans.some((plan) => plan.source === "high_thinking_tutor") || plans.length === 0;
    if (!needsTutor && authored.length > 0) return authored.join("\n\n");
    const fallback = plans[0]?.fallbackText ?? "I need a little more information before I can do that safely.";
    try {
      return await this.options.ports.model.tutor({
        model: this.options.tutor.model,
        systemPrompt: this.options.tutor.systemPrompt,
        userMessage: state.recentMessages.at(-1)?.text ?? "",
        recentMessages: state.recentMessages,
        decision: validated as never,
        operationResults,
        allowedContext: { cruxId: input.cruxId, availableState: state.availableState },
        correlationId: operationResults[0]?.operationId ?? state.session.id,
        thinkingLevel: "high",
      });
    } catch {
      return fallback;
    }
  }
}

export type DeclarativeFunctionConfig = {
  id: string;
  intents: Record<
    string,
    {
      operations(input: HandlerInput): CruxOperation[];
      response(input: HandlerInput): ResponsePlan;
    }
  >;
};

export class DeclarativeSpecificFunctionController implements SpecificFunctionController {
  readonly id: string;
  constructor(private readonly config: DeclarativeFunctionConfig) {
    this.id = config.id;
  }

  canHandle(input: HandlerInput): boolean {
    return this.config.intents[input.decision.intent] !== undefined;
  }

  async plan(input: HandlerInput): Promise<HandlerResult> {
    const intent = this.config.intents[input.decision.intent];
    if (!intent) throw new Error(`Controller ${this.id} cannot handle intent ${input.decision.intent}`);
    return { operations: intent.operations(input), ordering: "declared", responsePlan: intent.response(input) };
  }
}

export type DeterministicProcessDefinition = {
  id: string;
  steps: {
    id: string;
    requiredFields: string[];
    nextStepId?: string;
  }[];
  advanceOperationId: string;
  deferOperationId?: string;
  authoredCopy: Record<string, string>;
};

export class DefaultDeterministicProcessController implements DeterministicProcessController {
  readonly id: string;
  constructor(private readonly definition: DeterministicProcessDefinition) {
    this.id = definition.id;
  }

  async assess(input: ProcessTurnInput): Promise<ProcessAssessment> {
    const targetStepId = String(input.decision.extracted["targetStepId"] ?? input.process.activeStepId);
    const step = this.definition.steps.find((candidate) => candidate.id === targetStepId);
    if (!step) return { status: "clarify", targetStepId, canAdvance: false, missing: ["targetStepId"] };
    if (input.decision.speechAct === "question") return { status: "clarify", targetStepId, canAdvance: false, missing: [] };
    const missing = step.requiredFields.filter((field) => !present(input.decision.extracted[field]));
    if (missing.length === step.requiredFields.length && missing.length > 0) return { status: "reject", targetStepId, canAdvance: false, missing };
    if (missing.length > 0) return { status: "partial", targetStepId, canAdvance: false, missing };
    return { status: "accept", normalizedFields: input.decision.extracted, targetStepId, canAdvance: true, missing: [] };
  }

  async plan(input: ValidatedProcessInput): Promise<HandlerResult> {
    const copy = this.definition.authoredCopy[input.assessment.status] ?? "Please provide the remaining information.";
    if (!input.assessment.canAdvance) {
      return {
        operations: [],
        ordering: "declared",
        responsePlan: { source: "authored_deterministic", authoredText: copy, fallbackText: copy, successClaims: [] },
      };
    }
    const step = this.definition.steps.find((candidate) => candidate.id === input.assessment.targetStepId);
    const operation: CruxOperation = {
      id: this.definition.advanceOperationId,
      kind: "mutate",
      target: input.process.runId,
      payload: { stepId: input.assessment.targetStepId, nextStepId: step?.nextStepId ?? null, fields: input.assessment.normalizedFields ?? {} },
      preconditions: [],
      preservation: { preserveOmittedFields: true, preserveHistory: true, reversible: false },
      idempotencyKey: `${input.process.runId}:${input.assessment.targetStepId}:${input.correlationId}`,
      correlationId: input.correlationId,
    };
    return {
      operations: [operation],
      ordering: "declared",
      responsePlan: { source: "authored_deterministic", authoredText: copy, fallbackText: copy, successClaims: ["process_advanced"] },
    };
  }
}

function canExecute(decision: ValidatedTaskSignalDecision): boolean {
  return decision.validationStatus === "accepted" || decision.validationStatus === "corrected";
}

function selectCopySource(plans: ResponsePlan[], needsHighThinking: boolean): ResponsePlan["source"] {
  if (needsHighThinking || plans.some((plan) => plan.source === "high_thinking_tutor")) return "high_thinking_tutor";
  return plans[0]?.source ?? "safe_fallback";
}

function aggregateDelivery(deliveries: ChannelSendResult[]): ChannelSendResult {
  const failed = deliveries.find((delivery) => delivery.status === "failed");
  if (failed) return failed;
  const last = deliveries.at(-1);
  return last ?? { status: "failed", error: runtimeError(500, "empty_delivery", "Channel produced no outbound payload") };
}

function runtimeError(status: number, code: string, message: string): RuntimeErrorEnvelope {
  return { status, code, message };
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}
