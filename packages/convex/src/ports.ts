import type {
  MemoryStore,
  ReportStore,
  RuntimeAuditStore,
  RuntimeJobQueue,
  RuntimeStateStore,
  StructuredInteractionStore,
  TurnLeaseStore,
} from "@bridge-crux/core";
import type { IdempotencyStore } from "@bridge-crux/core";
import type { ConvexBridgeCruxRepository } from "./repository.js";

export function repositoryPorts(repository: ConvexBridgeCruxRepository): {
  state: RuntimeStateStore;
  audit: RuntimeAuditStore;
  memory: MemoryStore;
  reports: ReportStore;
  jobs: RuntimeJobQueue;
  idempotency: IdempotencyStore;
  interactions: StructuredInteractionStore;
  turns: TurnLeaseStore;
} {
  return {
    state: {
      load: (input) => repository.load(input),
      persistInbound: (message, cruxId) => repository.persistInbound(message, cruxId),
      persistOutbound: (message, delivery) => repository.persistOutbound(message, delivery),
    },
    audit: {
      persistRouterDecision: (decision) => repository.persistRouterDecision(decision),
      appendLedger: (events) => repository.appendLedger(events),
    },
    memory: {
      list: (userId, cruxId) => repository.listMemories(userId, cruxId),
      apply: (operations, context) => repository.applyMemories(operations, context),
    },
    reports: {
      create: (report) => repository.createReport(report),
      update: (reportId, patch) => repository.updateReport(reportId, patch),
      listOpen: () => repository.listOpenReports(),
    },
    jobs: { enqueue: (job) => repository.enqueueJob(job) },
    idempotency: {
      get: (key) => repository.operationByIdempotency(key),
      put: async () => {
        throw new Error(
          "Convex idempotency writes require execution context; use recordOperation with user, session, and crux identifiers",
        );
      },
    },
    interactions: {
      issue: (input) => repository.issueInteraction(input),
      consume: (input) => repository.consumeInteraction(input),
    },
    turns: {
      acquire: (input) => repository.acquireTurnLease(input),
      release: (input) => repository.releaseTurnLease(input),
    },
  };
}
