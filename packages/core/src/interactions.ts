import { randomUUID } from "node:crypto";
import type {
  ChoiceControl,
  StructuredInteractionStore,
  TrustedChoiceInteraction,
  TurnLeaseStore,
} from "./contracts.js";

type IssuedInteraction = {
  control: ChoiceControl;
  userId: string;
  sessionId: string;
  processRunId?: string;
  stepId?: string;
  consumed: boolean;
};

export class InMemoryStructuredInteractionStore implements StructuredInteractionStore {
  readonly #interactions = new Map<string, IssuedInteraction>();

  constructor(private readonly id: () => string = randomUUID, private readonly now: () => number = Date.now) {}

  async issue(input: Parameters<StructuredInteractionStore["issue"]>[0]): Promise<ChoiceControl> {
    if (input.control.kind === "deterministic_process" && (!input.processRunId || !(input.control.stepId ?? input.stepId))) {
      throw new Error("Deterministic process controls require process and step scope");
    }
    if (input.control.kind === "deterministic_process" && input.control.allowFreeText) {
      throw new Error("Deterministic process controls cannot allow free-text selection");
    }
    if (input.control.kind === "generated_clarification" && (!input.control.capabilityId || !input.control.route || !input.control.intent)) {
      throw new Error("Generated clarification controls require capability, route, and intent scope");
    }
    const interactionId = this.id();
    const control = { ...input.control, id: interactionId };
    this.#interactions.set(interactionId, {
      control,
      userId: input.userId,
      sessionId: input.sessionId,
      ...(input.processRunId ? { processRunId: input.processRunId } : {}),
      ...(input.control.stepId ?? input.stepId ? { stepId: input.control.stepId ?? input.stepId } : {}),
      consumed: false,
    });
    return control;
  }

  async consume(input: Parameters<StructuredInteractionStore["consume"]>[0]): Promise<TrustedChoiceInteraction | undefined> {
    const issued = this.#interactions.get(input.interaction.interactionId);
    if (!issued || issued.userId !== input.userId || issued.sessionId !== input.sessionId) return undefined;
    if (issued.control.expiresAt !== undefined && issued.control.expiresAt <= this.now()) return undefined;
    if (issued.consumed) return undefined;
    const option = issued.control.options.find((candidate) => candidate.id === input.interaction.optionId);
    if (!option) return undefined;
    issued.consumed = true;
    return {
      ...input.interaction,
      controlKind: issued.control.kind,
      ...(issued.processRunId ? { processRunId: issued.processRunId } : {}),
      ...(issued.stepId ? { stepId: issued.stepId } : {}),
      ...(issued.control.capabilityId ? { capabilityId: issued.control.capabilityId } : {}),
      ...(issued.control.route ? { route: issued.control.route } : {}),
      ...(issued.control.intent ? { intent: issued.control.intent } : {}),
      field: issued.control.field,
      value: option.value,
    };
  }
}

export class InMemoryTurnLeaseStore implements TurnLeaseStore {
  readonly #leases = new Map<string, { correlationId: string; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async acquire(input: Parameters<TurnLeaseStore["acquire"]>[0]): Promise<boolean> {
    const existing = this.#leases.get(input.key);
    if (existing && existing.expiresAt > this.now() && existing.correlationId !== input.correlationId) return false;
    this.#leases.set(input.key, { correlationId: input.correlationId, expiresAt: input.expiresAt });
    return true;
  }

  async release(input: Parameters<TurnLeaseStore["release"]>[0]): Promise<void> {
    if (this.#leases.get(input.key)?.correlationId === input.correlationId) this.#leases.delete(input.key);
  }
}
