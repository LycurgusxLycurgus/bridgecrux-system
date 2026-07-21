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
  processRunId: string;
  stepId: string;
  consumed: boolean;
};

export class InMemoryStructuredInteractionStore implements StructuredInteractionStore {
  readonly #interactions = new Map<string, IssuedInteraction>();

  constructor(private readonly id: () => string = randomUUID) {}

  async issue(input: Parameters<StructuredInteractionStore["issue"]>[0]): Promise<ChoiceControl> {
    const interactionId = this.id();
    const control = { ...input.control, id: interactionId };
    this.#interactions.set(interactionId, {
      control,
      userId: input.userId,
      sessionId: input.sessionId,
      processRunId: input.processRunId,
      stepId: input.control.stepId ?? input.stepId,
      consumed: false,
    });
    return control;
  }

  async consume(input: Parameters<StructuredInteractionStore["consume"]>[0]): Promise<TrustedChoiceInteraction | undefined> {
    const issued = this.#interactions.get(input.interaction.interactionId);
    if (!issued || issued.userId !== input.userId || issued.sessionId !== input.sessionId) return undefined;
    if (issued.control.expiresAt !== undefined && issued.control.expiresAt <= Date.now()) return undefined;
    if (issued.consumed) return undefined;
    const option = issued.control.options.find((candidate) => candidate.id === input.interaction.optionId);
    if (!option) return undefined;
    issued.consumed = true;
    return {
      ...input.interaction,
      processRunId: issued.processRunId,
      stepId: issued.stepId,
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
