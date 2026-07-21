import { randomUUID } from "node:crypto";
import type {
  ChannelSendResult,
  CruxOperation,
  ProcessDefinition,
  ProcessController,
  HandlerBinding,
  HandlerInput,
  HandlerResult,
  JsonValue,
  NormalizedInboundMessage,
  ModelClient,
  OperationResult,
  OutboundMessage,
  ProcessAssessment,
  ProcessAssessmentHook,
  ProcessAssessmentValidator,
  ProcessExecutionPolicy,
  ProcessStepContract,
  ProcessTurnInput,
  ResponsePlan,
  RawRouterDecision,
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
import type {
  ProcessRegistry,
  HandlerBindingRegistry,
  SpecificFunctionRegistry,
  ToolOperationRegistry,
} from "./registry.js";

export type TurnControllerOptions = {
  router: TaskSignalRouter;
  validator: RouterDecisionValidator;
  bindings: HandlerBindingRegistry;
  functions: SpecificFunctionRegistry;
  processes?: ProcessRegistry;
  tools?: ToolOperationRegistry;
  ports: RuntimePorts;
  copyGate: UserCopyGate;
  validationContext(state: Parameters<RouterValidationContextFactory>[0]): RouterValidationContext;
  tutor: {
    model?: string;
    systemPrompt: string;
    allowedContext?: (state: Awaited<ReturnType<RuntimePorts["state"]["load"]>>) => Record<string, unknown>;
  };
  now?: () => number;
  id?: () => string;
  turnLeaseMs?: number;
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
    let turnLease: { key: string; correlationId: string } | undefined;
    try {
      const inbound = await this.options.ports.channel.normalizeInbound(input.event);
      correlationId = inbound.correlationId;
      await this.options.ports.channel.acknowledgeInbound?.(inbound).catch(() => undefined);
      turnLease = {
        key: `${input.cruxId}:${inbound.channel}:${inbound.userExternalId}:${inbound.threadId ?? "default"}`,
        correlationId,
      };
      const acquired = await this.options.ports.turns.acquire({
        ...turnLease,
        expiresAt: this.#now() + (this.options.turnLeaseMs ?? 120_000),
      });
      if (!acquired) return { correlationId, operationResults: [], status: "busy" };

      const persistedInbound = await this.options.ports.state.persistInbound(inbound, input.cruxId);
      if (persistedInbound.duplicate) {
        return { correlationId, operationResults: [], status: "duplicate" };
      }

      const activity = await this.options.ports.channel.startActivity?.(inbound).catch(() => undefined);
      try {

      const state = await this.options.ports.state.load({
        cruxId: input.cruxId,
        inbound,
        conversationWindow: input.conversationWindow,
      });
      const activeProcessController = state.activeProcess ? this.options.processes?.resolve(state.activeProcess.processId) : undefined;
      const deterministicProcessTurn = activeProcessController?.executionPolicy(state.activeProcess!).mode === "deterministic";
      const raw = deterministicProcessTurn
        ? await this.#deterministicProcessDecision(input, inbound, state, activeProcessController!)
        : await this.options.router.decide({
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
        ...(!deterministicProcessTurn && this.options.router.modelName ? { model: this.options.router.modelName } : {}),
        createdAt: this.#now(),
      });

      let decision = this.options.validator.validate({ decision: raw, context: this.options.validationContext(state) });
      if (deterministicProcessTurn && decision.validationStatus === "clarification") {
        decision = {
          ...decision,
          validationStatus: "accepted",
          validationCodes: [...decision.validationCodes, "deterministic_choice_required"],
          allowedMutation: false,
          validatedHandlerTarget: activeProcessController!.handlerId,
        };
      }
      await this.options.ports.audit.persistRouterDecision({
        phase: "validated",
        decision,
        cruxId: input.cruxId,
        sessionId: state.session.id,
        correlationId,
        ...(!deterministicProcessTurn && this.options.router.modelName ? { model: this.options.router.modelName } : {}),
        createdAt: this.#now(),
      });

      const executable = decision.compositeStatus === "clarification" ? [] : [decision, ...decision.additionalSignals].filter(canExecute);
      const executions: { signal: ValidatedTaskSignalDecision; binding: HandlerBinding; plan: HandlerResult }[] = [];
      for (const signal of executable) {
        const binding = this.options.bindings.resolve(signal.route, signal.intent);
        const handlerId = signal.validatedHandlerTarget;
        const controller = handlerId ? this.options.functions.resolve(handlerId) : undefined;
        const processController = state.activeProcess && activeProcessController?.handlerId === handlerId ? activeProcessController : undefined;
        if (!binding || (!processController && (!controller || !controller.canHandle({ decision: signal, state, binding, correlationId })))) {
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
        if (processController && state.activeProcess) {
          const processInput = { decision: signal, state, binding, correlationId, process: state.activeProcess };
          const assessment = await processController.assess(processInput);
          executions.push({ signal, binding, plan: await processController.plan({ ...processInput, assessment }) });
        } else {
          executions.push({ signal, binding, plan: await controller!.plan({ decision: signal, state, binding, correlationId }) });
        }
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
      const thinkingLevel = resolveTurnThinkingLevel({ decision, bindings: this.options.bindings });
      const text = await this.#renderCopy(input, state, decision, operationResults, responsePlans, thinkingLevel);
      const source = selectCopySource(responsePlans, thinkingLevel);
      const copyResult = this.options.copyGate.validate({
        source,
        text,
        operationResults,
        successClaims: responsePlans.flatMap((plan) => plan.successClaims),
        requiredOperationIds: responsePlans.flatMap((plan) => plan.requiredOperationIds ?? []),
        ...(state.user.locale ? { locale: state.user.locale } : {}),
      });
      if (!copyResult.ok) {
        await this.options.ports.reports.create({ ...copyResult.report, cruxId: input.cruxId, correlationId });
      }
      const plannedControls = responsePlans.flatMap((plan) => plan.controls ?? []);
      if (plannedControls.length > 0 && (!state.activeProcess || !this.options.ports.interactions)) {
        throw new Error("Structured process controls require an active process and interaction store");
      }
      const controls =
        plannedControls.length > 0
          ? await Promise.all(
              plannedControls.map((control) =>
                this.options.ports.interactions!.issue({
                  control,
                  userId: state.user.id,
                  sessionId: state.session.id,
                  processRunId: state.activeProcess!.runId,
                  stepId: state.activeProcess!.activeStepId,
                  correlationId,
                }),
              ),
            )
          : [];
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
        ...(controls.length > 0 ? { controls } : {}),
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
      } finally {
        await activity?.stop().catch(() => undefined);
      }
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
    } finally {
      if (turnLease) await this.options.ports.turns.release(turnLease).catch(() => undefined);
    }
  }

  async #deterministicProcessDecision(
    input: TurnInput,
    inbound: NormalizedInboundMessage,
    state: Awaited<ReturnType<RuntimePorts["state"]["load"]>>,
    controller: ProcessController,
  ): Promise<RawRouterDecision> {
    const process = state.activeProcess!;
    const intent = input.registry.routes
      .find((route) => route.id === controller.route)
      ?.intents.find((candidate) => candidate.id === controller.intent);
    const binding = this.options.bindings.resolve(controller.route, controller.intent);
    const trusted =
      inbound.interaction && this.options.ports.interactions
        ? await this.options.ports.interactions.consume({
            interaction: inbound.interaction,
            userId: state.user.id,
            sessionId: state.session.id,
          })
        : undefined;
    const matchesActiveStep = trusted?.processRunId === process.runId && trusted.stepId === process.activeStepId;
    return {
      route: controller.route,
      intent: controller.intent,
      confidence: 1,
      speechAct: matchesActiveStep ? "execution" : "other",
      temporalStance: "present",
      targetReferences: [],
      stateMutationCandidate: matchesActiveStep ? intent?.mutationClasses[0] ?? "none" : "none",
      mutationEvidence: matchesActiveStep ? "positive" : "insufficient",
      safetyFlag: "none",
      ...(binding ? { handlerTarget: binding.handlerId } : {}),
      extracted: matchesActiveStep
        ? {
            targetStepId: trusted.stepId,
            [trusted.field]: trusted.value,
            __bridgecruxTrustedChoice: true,
          }
        : { targetStepId: process.activeStepId },
      reason: matchesActiveStep
        ? "A server-validated closed choice was selected for the active deterministic process step"
        : "The active deterministic process requires one of its server-issued closed choices",
    };
  }

  async #renderCopy(
    input: TurnInput,
    state: Awaited<ReturnType<RuntimePorts["state"]["load"]>>,
    decision: Parameters<RuntimePorts["audit"]["persistRouterDecision"]>[0]["decision"] & { additionalSignals?: unknown },
    operationResults: OperationResult[],
    plans: ResponsePlan[],
    thinkingLevel: "medium" | "high",
  ): Promise<string> {
    const validated = decision as Extract<typeof decision, { additionalSignals?: unknown }> & { validationStatus: string };
    const authored = plans.flatMap((plan) => (plan.authoredText ? [plan.authoredText] : []));
    const needsTutor = plans.some(
      (plan) => plan.source === "high_thinking_tutor" || plan.source === "conversational_tutor",
    ) || plans.length === 0;
    if (!needsTutor && authored.length > 0) return authored.join("\n\n");
    const fallback = plans[0]?.fallbackText ?? "I need a little more information before I can do that safely.";
    try {
      const allowedContext = this.options.tutor.allowedContext?.(state) ?? {
        cruxId: input.cruxId,
        availableState: state.availableState,
        ...(state.activeProcess ? { activeProcess: state.activeProcess } : {}),
        ...(state.activeSpecificFunction ? { activeSpecificFunction: state.activeSpecificFunction } : {}),
      };
      const binding = this.options.bindings.resolve(validated.route, validated.intent);
      const plannedTools = [...new Set(plans.flatMap((plan) => plan.toolIds ?? []))];
      const allowedToolIds = plannedTools.filter(
        (id) => Boolean(binding && binding.executionPolicy.mode !== "deterministic" && binding.executionPolicy.toolIds.includes(id)),
      );
      const tools = this.options.tools?.definitions(allowedToolIds) ?? [];
      if (tools.length > 0 && this.options.ports.model.toolLoop && binding) {
        const turnCorrelationId = state.recentMessages.at(-1)?.correlationId ?? state.session.id;
        const handler: HandlerInput = { decision: validated as never, state, binding, correlationId: turnCorrelationId };
        const result = await this.options.ports.model.toolLoop({
          ...(this.options.tutor.model ? { model: this.options.tutor.model } : {}),
          systemPrompt: this.options.tutor.systemPrompt,
          userMessage: state.recentMessages.at(-1)?.text ?? "",
          recentMessages: state.recentMessages,
          decision: validated as never,
          operationResults,
          allowedContext,
          correlationId: turnCorrelationId,
          thinkingLevel,
          tools: tools.map((tool) => tool.definition),
          execute: async (toolId, arguments_) => {
            const tool = tools.find((candidate) => candidate.definition.id === toolId);
            if (!tool) throw new Error(`Tool ${toolId} is outside the validated binding`);
            const operation = tool.operation({ arguments: arguments_, handler });
            const execution = await this.options.ports.operations.execute(
              {
                operations: [operation],
                ordering: "declared",
                responsePlan: { source: "safe_fallback", fallbackText: fallback, successClaims: [] },
              },
              { state, binding, decision: validated as never, correlationId: operation.correlationId },
            );
            operationResults.push(...execution.results);
            if (execution.ledgerEvents.length > 0) await this.options.ports.audit.appendLedger(execution.ledgerEvents);
            return execution.results[0] ?? { status: "failed" };
          },
        });
        return result.text;
      }
      return await this.options.ports.model.tutor({
        ...(this.options.tutor.model ? { model: this.options.tutor.model } : {}),
        systemPrompt: this.options.tutor.systemPrompt,
        userMessage: state.recentMessages.at(-1)?.text ?? "",
        recentMessages: state.recentMessages,
        decision: validated as never,
        operationResults,
        allowedContext,
        correlationId: operationResults[0]?.operationId ?? state.session.id,
        thinkingLevel,
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

export class DefaultProcessController implements ProcessController {
  readonly id: string;
  readonly route: string;
  readonly intent: string;
  readonly handlerId: string;

  constructor(
    private readonly definition: ProcessDefinition,
    private readonly options: {
      assessment?: ProcessAssessmentHook;
      validators?: ProcessAssessmentValidator[];
      allowedContext?: (input: ProcessTurnInput) => Record<string, unknown>;
    } = {},
  ) {
    this.id = definition.id;
    this.route = definition.route;
    this.intent = definition.intent;
    this.handlerId = definition.handlerId;
    validateProcessDefinition(definition);
  }

  executionPolicy(process: ProcessTurnInput["process"]): ProcessExecutionPolicy {
    return this.#step(process.activeStepId).executionPolicy;
  }

  async assess(input: ProcessTurnInput): Promise<ProcessAssessment> {
    const targetStepId = String(input.decision.extracted["targetStepId"] ?? input.process.activeStepId);
    const step = this.definition.steps.find((candidate) => candidate.id === targetStepId);
    if (!step) return assessment("clarify", targetStepId, ["targetStepId"], ["process_step_missing"]);
    if (input.decision.speechAct === "question") return assessment("clarify", targetStepId, [], ["question_does_not_advance"]);

    let result: ProcessAssessment;
    if (step.executionPolicy.mode === "deterministic") {
      result = assessClosedChoice(input, step);
    } else if (this.options.assessment) {
      result = {
        ...(await this.options.assessment.assess({
        input,
        step,
        allowedContext: this.options.allowedContext?.(input) ?? {
          process: input.process,
          availableState: input.state.availableState,
        },
      })),
        targetStepId,
      };
    } else {
      result = assessment("reject", targetStepId, requiredFields(step), ["assessment_hook_missing"]);
    }

    for (const validator of this.options.validators ?? []) result = validator.validate({ assessment: result, turn: input, step });
    if (result.status === "ready" && step.confirmationPolicy === "always") {
      return { ...result, status: "clarify", canAdvance: false, reasonCodes: [...result.reasonCodes, "confirmation_required"] };
    }
    if (result.status === "ready" && step.confirmationPolicy === "on_correction" && result.proposedCorrections.length > 0) {
      return { ...result, status: "clarify", canAdvance: false, reasonCodes: [...result.reasonCodes, "correction_confirmation_required"] };
    }
    return normalizeAssessment(result, step);
  }

  async plan(input: ValidatedProcessInput): Promise<HandlerResult> {
    const copy = this.definition.authoredCopy[input.assessment.status] ?? "Please provide the remaining information.";
    const step = this.#step(input.assessment.targetStepId);
    const source =
      step.executionPolicy.mode === "deterministic"
        ? "authored_deterministic"
        : step.executionPolicy.thinkingLevel === "high"
          ? "high_thinking_tutor"
          : "conversational_tutor";
    if (!input.assessment.canAdvance) {
      const controls = step.input.mode === "closed_choice" ? [{ ...step.input.control, stepId: step.id }] : [];
      const instruction = controls.length > 0 ? `${copy}\n\n${controls[0]!.prompt}` : copy;
      return {
        operations: [],
        ordering: "declared",
        responsePlan: {
          source,
          ...(source === "authored_deterministic" ? { authoredText: instruction } : { tutorInstruction: instruction }),
          fallbackText: copy,
          successClaims: [],
          ...(controls.length > 0 ? { controls } : {}),
        },
      };
    }
    const operation: CruxOperation = {
      id: this.definition.advanceOperationId,
      kind: "mutate",
      target: input.process.runId,
      payload: { stepId: input.assessment.targetStepId, nextStepId: step.nextStepId ?? null, fields: input.assessment.normalizedFields ?? {} },
      preconditions: [],
      preservation: { preserveOmittedFields: true, preserveHistory: true, reversible: false },
      idempotencyKey: `${input.process.runId}:${input.assessment.targetStepId}:${input.correlationId}`,
      correlationId: input.correlationId,
    };
    const nextStep = step.nextStepId ? this.#step(step.nextStepId) : undefined;
    const controls = nextStep?.input.mode === "closed_choice" ? [{ ...nextStep.input.control, stepId: nextStep.id }] : [];
    const instruction = controls.length > 0 ? `${copy}\n\n${controls[0]!.prompt}` : copy;
    const modelToolCompletion = step.completionMode === "model_tool";
    return {
      operations: modelToolCompletion ? [] : [operation],
      ordering: "declared",
      responsePlan: {
        source,
        ...(source === "authored_deterministic" ? { authoredText: instruction } : { tutorInstruction: instruction }),
        fallbackText: copy,
        successClaims: ["process_advanced"],
        requiredOperationIds: [this.definition.advanceOperationId],
        ...(controls.length > 0 ? { controls } : {}),
        ...(step.executionPolicy.mode === "hybrid" && step.executionPolicy.toolIds.length > 0
          ? { toolIds: step.executionPolicy.toolIds }
          : {}),
      },
    };
  }

  #step(id: string) {
    const step = this.definition.steps.find((candidate) => candidate.id === id);
    if (!step) throw new Error(`Unknown process step ${this.definition.id}/${id}`);
    return step;
  }
}

export class ModelProcessAssessmentHook implements ProcessAssessmentHook {
  constructor(
    private readonly model: ModelClient,
    private readonly options: { model?: string; prompt?: string } = {},
  ) {}

  assess(request: Parameters<ProcessAssessmentHook["assess"]>[0]): Promise<ProcessAssessment> {
    if (request.step.executionPolicy.mode !== "hybrid") {
      throw new Error(`Model assessment is unavailable for deterministic step ${request.step.id}`);
    }
    return this.model.structured({
      purpose: "assessment",
      ...(this.options.model ? { model: this.options.model } : {}),
      prompt:
        this.options.prompt ??
        "Assess only the active process step. Normalize supplied fields, list missing fields and proposed corrections, and never authorize persistence or claim that an operation succeeded.",
      input: {
        userMessage: request.input.state.recentMessages.at(-1)?.text ?? "",
        recentMessages: request.input.state.recentMessages,
        process: request.input.process,
        step: request.step,
        allowedContext: request.allowedContext,
      },
      schema: PROCESS_ASSESSMENT_SCHEMA,
      correlationId: request.input.correlationId,
      thinkingLevel: request.step.executionPolicy.thinkingLevel,
      parse: parseProcessAssessment,
    });
  }
}

function canExecute(decision: ValidatedTaskSignalDecision): boolean {
  return decision.validationStatus === "accepted" || decision.validationStatus === "corrected";
}

export function resolveTurnThinkingLevel(input: {
  decision: ValidatedTaskSignalDecision & { additionalSignals?: ValidatedTaskSignalDecision[] };
  bindings: HandlerBindingRegistry;
}): "medium" | "high" {
  const signals = [input.decision, ...(input.decision.additionalSignals ?? [])];
  const policies = signals.flatMap((signal) => {
    const policy = input.bindings.resolve(signal.route, signal.intent)?.executionPolicy;
    return policy ? [policy] : [];
  });
  return policies.some((policy) => policy.mode !== "deterministic" && policy.thinkingLevel === "high") ? "high" : "medium";
}

function selectCopySource(plans: ResponsePlan[], thinkingLevel: "medium" | "high"): ResponsePlan["source"] {
  if (plans.length > 0 && plans.every((plan) => plan.source === "authored_deterministic")) return "authored_deterministic";
  if (thinkingLevel === "high" || plans.some((plan) => plan.source === "high_thinking_tutor")) return "high_thinking_tutor";
  if (thinkingLevel === "medium") return "conversational_tutor";
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

const PROCESS_ASSESSMENT_SCHEMA: JsonValue = {
  type: "object",
  additionalProperties: false,
  required: ["status", "normalizedFields", "missingFields", "proposedCorrections", "confidence", "reasonCodes"],
  properties: {
    status: { type: "string", enum: ["ready", "reject", "partial", "clarify"] },
    normalizedFields: { type: "object" },
    missingFields: { type: "array", items: { type: "string" } },
    proposedCorrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "proposedValue", "reason"],
        properties: { field: { type: "string" }, proposedValue: {}, reason: { type: "string" } },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasonCodes: { type: "array", items: { type: "string" } },
  },
};

function parseProcessAssessment(value: unknown): ProcessAssessment {
  if (!record(value)) throw new Error("Process assessment must be an object");
  const status = value["status"];
  if (status !== "ready" && status !== "reject" && status !== "partial" && status !== "clarify") {
    throw new Error("Process assessment status is invalid");
  }
  const normalizedFields = record(value["normalizedFields"]) ? value["normalizedFields"] : {};
  const missingFields = stringList(value["missingFields"]);
  const reasonCodes = stringList(value["reasonCodes"]);
  const proposedCorrections = Array.isArray(value["proposedCorrections"])
    ? value["proposedCorrections"].flatMap((candidate) => {
        if (!record(candidate) || typeof candidate["field"] !== "string" || typeof candidate["reason"] !== "string") return [];
        return [{ field: candidate["field"], proposedValue: candidate["proposedValue"], reason: candidate["reason"] }];
      })
    : [];
  return {
    status,
    normalizedFields,
    targetStepId: "",
    canAdvance: status === "ready",
    missingFields,
    proposedCorrections,
    confidence: typeof value["confidence"] === "number" ? value["confidence"] : 0,
    reasonCodes,
  };
}

function validateProcessDefinition(definition: ProcessDefinition): void {
  if (definition.steps.length === 0) throw new Error(`Process ${definition.id} requires at least one step`);
  const ids = new Set<string>();
  for (const step of definition.steps) {
    if (!step.id || ids.has(step.id)) throw new Error(`Duplicate or empty process step ${definition.id}/${step.id}`);
    ids.add(step.id);
    if (step.executionPolicy.mode === "deterministic" && step.input.mode !== "closed_choice") {
      throw new Error(`Deterministic step ${definition.id}/${step.id} must use a closed-choice input`);
    }
    if (step.executionPolicy.mode === "hybrid" && step.input.mode === "closed_choice") {
      throw new Error(`Closed-choice step ${definition.id}/${step.id} must use deterministic execution`);
    }
    if (step.executionPolicy.mode === "deterministic" && step.completionMode !== "controller") {
      throw new Error(`Deterministic step ${definition.id}/${step.id} must use controller completion`);
    }
    if (step.completionMode === "model_tool" && (step.executionPolicy.mode !== "hybrid" || !step.executionPolicy.toolIds.includes(definition.advanceOperationId))) {
      throw new Error(`Model-tool step ${definition.id}/${step.id} must expose ${definition.advanceOperationId} as a hybrid tool`);
    }
    if (step.input.mode === "closed_choice") {
      if (step.input.control.options.length < 2) throw new Error(`Closed-choice step ${definition.id}/${step.id} requires at least two options`);
      const options = new Set(step.input.control.options.map((option) => option.id));
      if (options.size !== step.input.control.options.length) throw new Error(`Closed-choice step ${definition.id}/${step.id} has duplicate options`);
    }
  }
  for (const step of definition.steps) {
    if (step.nextStepId && !ids.has(step.nextStepId)) throw new Error(`Step ${definition.id}/${step.id} references unknown next step ${step.nextStepId}`);
  }
}

function assessClosedChoice(input: ProcessTurnInput, step: ProcessStepContract): ProcessAssessment {
  if (step.input.mode !== "closed_choice") return assessment("reject", step.id, [], ["closed_choice_contract_missing"]);
  if (input.decision.extracted["__bridgecruxTrustedChoice"] !== true) {
    return assessment("clarify", step.id, [step.input.control.field], ["trusted_choice_required"]);
  }
  const value = input.decision.extracted[step.input.control.field];
  if (!present(value)) return assessment("clarify", step.id, [step.input.control.field], ["trusted_choice_value_missing"]);
  return {
    status: "ready",
    normalizedFields: { [step.input.control.field]: value },
    targetStepId: step.id,
    canAdvance: true,
    missingFields: [],
    proposedCorrections: [],
    confidence: 1,
    reasonCodes: ["trusted_choice_accepted"],
  };
}

function requiredFields(step: ProcessStepContract): string[] {
  return step.input.mode === "closed_choice" ? [step.input.control.field] : step.input.requiredFields;
}

function normalizeAssessment(value: ProcessAssessment, step: ProcessStepContract): ProcessAssessment {
  const missing = requiredFields(step).filter((field) => !present(value.normalizedFields?.[field]));
  if (value.status === "ready" && missing.length > 0) {
    return {
      ...value,
      status: "partial",
      canAdvance: false,
      missingFields: [...new Set([...value.missingFields, ...missing])],
      reasonCodes: [...value.reasonCodes, "required_fields_missing"],
    };
  }
  return {
    ...value,
    canAdvance: value.status === "ready" && value.canAdvance,
    missingFields: [...new Set(value.missingFields)],
    confidence: Math.max(0, Math.min(1, value.confidence)),
  };
}

function assessment(
  status: Exclude<ProcessAssessment["status"], "ready">,
  targetStepId: string,
  missingFields: string[],
  reasonCodes: string[],
): ProcessAssessment {
  return {
    status,
    targetStepId,
    canAdvance: false,
    missingFields,
    proposedCorrections: [],
    confidence: 0,
    reasonCodes,
  };
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
