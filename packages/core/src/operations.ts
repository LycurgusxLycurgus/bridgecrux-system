import type {
  CruxOperation,
  LedgerEvent,
  OperationContext,
  OperationExecutionResult,
  OperationExecutor,
  OperationPlan,
  OperationResult,
  RuntimeErrorEnvelope,
} from "./contracts.js";
import type { OperationRegistry } from "./registry.js";

export type IdempotencyStore = {
  get(key: string): Promise<OperationResult | undefined>;
  put(key: string, result: OperationResult): Promise<void>;
};

export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly #results = new Map<string, OperationResult>();

  async get(key: string): Promise<OperationResult | undefined> {
    return this.#results.get(key);
  }

  async put(key: string, result: OperationResult): Promise<void> {
    this.#results.set(key, result);
  }
}

/** @experimental Generic multi-operation execution remains experimental until a second real crux validates it. */
export class DefaultOperationExecutor implements OperationExecutor {
  constructor(
    private readonly registry: OperationRegistry,
    private readonly idempotency: IdempotencyStore = new InMemoryIdempotencyStore(),
    private readonly now: () => number = Date.now,
  ) {}

  async execute(plan: OperationPlan, context: OperationContext): Promise<OperationExecutionResult> {
    const results: OperationResult[] = [];
    const ledgerEvents: LedgerEvent[] = [];
    const seen = new Set<string>();
    let transactionalFailure = false;

    for (const operation of plan.operations) {
      let result: OperationResult;
      if (transactionalFailure) {
        result = failure(operation.id, "operation_group_stopped", "A prior operation in the transactional group failed", 409, "skipped");
      } else if (seen.has(operation.id)) {
        result = failure(operation.id, "duplicate_operation_id", `Operation ${operation.id} appears more than once`, 400);
      } else {
        seen.add(operation.id);
        result = await this.#executeOne(operation, context);
      }
      results.push(result);
      ledgerEvents.push(toLedger(operation, result, this.now()));
      transactionalFailure =
        plan.ordering === "transactional_group" && result.status !== "succeeded" && result.status !== "duplicate";
    }

    const failures = results.filter((result) => result.status === "failed").length;
    return {
      results,
      ledgerEvents,
      status: failures === 0 ? "succeeded" : failures === results.length ? "failed" : "partially_failed",
    };
  }

  async #executeOne(operation: CruxOperation, context: OperationContext): Promise<OperationResult> {
    if (!context.binding.operationIds.includes(operation.id)) {
      return failure(operation.id, "operation_not_authorized", `Operation ${operation.id} is outside the validated binding`, 403);
    }
    if (operation.kind === "mutate" && !context.decision.allowedMutation) {
      return failure(operation.id, "mutation_not_authorized", "Validated decision did not authorize mutation", 403);
    }
    const handler = this.registry.resolve(operation.id);
    if (!handler) return failure(operation.id, "operation_unregistered", `Operation ${operation.id} is not registered`, 500);

    if (operation.idempotencyKey) {
      const prior = await this.idempotency.get(operation.idempotencyKey);
      if (prior) return { ...prior, status: "duplicate" };
    }

    for (const precondition of operation.preconditions) {
      if (!(await precondition.evaluate(context))) {
        return failure(operation.id, "precondition_failed", precondition.description, 409);
      }
    }

    let result: OperationResult;
    try {
      result = await handler.execute(operation, context);
    } catch (error) {
      result = failure(
        operation.id,
        "operation_exception",
        error instanceof Error ? error.message : "Operation handler failed",
        500,
      );
    }
    if (operation.idempotencyKey && (result.status === "succeeded" || result.status === "duplicate")) {
      await this.idempotency.put(operation.idempotencyKey, result);
    }
    return result;
  }
}

function failure(
  operationId: string,
  code: string,
  message: string,
  status: number,
  resultStatus: OperationResult["status"] = "failed",
): OperationResult {
  const error: RuntimeErrorEnvelope = { status, code, message };
  return { operationId, status: resultStatus, error };
}

function toLedger(operation: CruxOperation, result: OperationResult, createdAt: number): LedgerEvent {
  return {
    eventType: `operation.${result.status}`,
    source: operation.id,
    targetId: operation.target,
    payload: { kind: operation.kind, operationId: operation.id, status: result.status },
    correlationId: operation.correlationId,
    createdAt,
  };
}
