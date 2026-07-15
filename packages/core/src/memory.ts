import type {
  MemoryController,
  MemoryOperation,
  MemoryOperationResult,
  MemoryReviewInput,
  MemoryStore,
  QueuedJob,
  RuntimeJobQueue,
} from "./contracts.js";

const SECRET_PATTERN = /(api[_ -]?key|password|secret|token|private[_ -]?key)/i;

/** @experimental Operation-level memory behavior requires a second real crux before stabilization. */
export class DefaultMemoryController implements MemoryController {
  constructor(private readonly proposer: (input: MemoryReviewInput) => Promise<MemoryOperation[]>) {}

  propose(input: MemoryReviewInput): Promise<MemoryOperation[]> {
    return this.proposer(input);
  }

  validate(operations: MemoryOperation[], input: MemoryReviewInput): MemoryOperation[] {
    const evidence = new Set([...input.userAuthoredEvidence, ...input.confirmedMilestones]);
    return operations.filter((operation) => {
      if (operation.type === "noop" || operation.type === "archive") return true;
      if (operation.type === "merge") {
        return operation.topics.length > 0 && validLine(operation.line) && evidence.has(operation.evidence) && confidence(operation.confidence);
      }
      if (operation.type === "correct") return validLine(operation.line) && confidence(operation.confidence);
      return validLine(operation.line) && evidence.has(operation.evidence) && confidence(operation.confidence);
    });
  }

  async apply(operations: MemoryOperation[], store: MemoryStore, input: MemoryReviewInput): Promise<MemoryOperationResult[]> {
    return store.apply(this.validate(operations, input), {
      userId: input.userId,
      cruxId: input.cruxId,
      correlationId: input.correlationId,
    });
  }
}

export type MemoryReviewScheduleInput = {
  userId: string;
  cruxId: string;
  inboundTurnCount: number;
  lastMemoryReviewTurn?: number;
  reviewEveryInboundTurns: number;
  reviewAtMilestones: boolean;
  milestoneReached: boolean;
  correlationId: string;
};

/** @experimental Scheduling policy remains configurable until multiple real cruxes establish useful review cadence. */
export class DefaultMemoryReviewScheduler {
  constructor(private readonly jobs: RuntimeJobQueue) {}

  shouldSchedule(input: MemoryReviewScheduleInput): boolean {
    const lastReview = input.lastMemoryReviewTurn ?? 0;
    const intervalReached =
      Number.isInteger(input.reviewEveryInboundTurns) &&
      input.reviewEveryInboundTurns > 0 &&
      input.inboundTurnCount > 0 &&
      input.inboundTurnCount - lastReview >= input.reviewEveryInboundTurns;
    return intervalReached || (input.reviewAtMilestones && input.milestoneReached);
  }

  async schedule(input: MemoryReviewScheduleInput): Promise<QueuedJob | undefined> {
    if (!this.shouldSchedule(input)) return undefined;
    const reason = input.reviewAtMilestones && input.milestoneReached ? "milestone" : "turn_interval";
    return this.jobs.enqueue({
      kind: "memory_review",
      payload: {
        userId: input.userId,
        cruxId: input.cruxId,
        inboundTurnCount: input.inboundTurnCount,
        ...(input.lastMemoryReviewTurn !== undefined ? { lastMemoryReviewTurn: input.lastMemoryReviewTurn } : {}),
        reason,
      },
      correlationId: input.correlationId,
    });
  }
}

function validLine(line: string): boolean {
  return line.trim().length > 0 && line.length <= 500 && !SECRET_PATTERN.test(line);
}

function confidence(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
