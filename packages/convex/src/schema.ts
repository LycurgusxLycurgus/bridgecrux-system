import { defineSchema, defineTable, type DataModelFromSchemaDefinition } from "convex/server";
import { v } from "convex/values";

export const bridgeCruxTables = {
  bridgecruxUsers: defineTable({
    externalId: v.string(),
    channel: v.string(),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
    displayName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastInboundAt: v.optional(v.number()),
    lastOutboundAt: v.optional(v.number()),
  }).index("by_channel_external", ["channel", "externalId"]),

  bridgecruxSessions: defineTable({
    userId: v.id("bridgecruxUsers"),
    cruxId: v.string(),
    status: v.string(),
    mode: v.optional(v.string()),
    activeProcessId: v.optional(v.string()),
    activeProcessRunId: v.optional(v.id("bridgecruxProcessRuns")),
    activeProcessStep: v.optional(v.string()),
    activeSpecificFunctionId: v.optional(v.string()),
    activeSpecificFunctionStateId: v.optional(v.string()),
    channelThreadId: v.optional(v.string()),
    modelContinuityId: v.optional(v.string()),
    inboundTurnCount: v.number(),
    lastMemoryReviewTurn: v.optional(v.number()),
    conversationWindow: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_crux", ["userId", "cruxId"]),

  bridgecruxMessages: defineTable({
    userId: v.id("bridgecruxUsers"),
    sessionId: v.id("bridgecruxSessions"),
    channel: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    text: v.string(),
    normalizedText: v.optional(v.string()),
    copySource: v.optional(v.string()),
    route: v.optional(v.string()),
    intent: v.optional(v.string()),
    channelMessageId: v.optional(v.string()),
    inboundIdempotencyKey: v.optional(v.string()),
    deliveryStatus: v.optional(v.union(v.literal("pending"), v.literal("sent"), v.literal("failed"))),
    correlationId: v.string(),
    createdAt: v.number(),
  })
    .index("by_session_created", ["sessionId", "createdAt"])
    .index("by_inbound_idempotency", ["inboundIdempotencyKey"])
    .index("by_correlation", ["correlationId"]),

  bridgecruxRouterDecisions: defineTable({
    userId: v.id("bridgecruxUsers"),
    sessionId: v.id("bridgecruxSessions"),
    cruxId: v.string(),
    phase: v.union(v.literal("raw"), v.literal("validated")),
    compositeGroupId: v.string(),
    signalIndex: v.number(),
    isPrimary: v.boolean(),
    route: v.string(),
    intent: v.string(),
    confidence: v.number(),
    speechAct: v.string(),
    temporalStance: v.string(),
    mutationEvidence: v.string(),
    safetyFlag: v.string(),
    stateMutationCandidate: v.string(),
    handlerTarget: v.optional(v.string()),
    validationStatus: v.optional(v.string()),
    validationCodes: v.optional(v.array(v.string())),
    targetReferencesJson: v.optional(v.string()),
    extractedJson: v.optional(v.string()),
    anticipatedRoute: v.optional(v.string()),
    capabilityGap: v.optional(v.string()),
    capabilityGapType: v.optional(v.string()),
    reason: v.string(),
    messageExcerpt: v.string(),
    model: v.optional(v.string()),
    correlationId: v.string(),
    createdAt: v.number(),
  })
    .index("by_session_created", ["sessionId", "createdAt"])
    .index("by_composite_signal", ["compositeGroupId", "signalIndex"])
    .index("by_correlation", ["correlationId"]),

  bridgecruxLedger: defineTable({
    userId: v.id("bridgecruxUsers"),
    sessionId: v.id("bridgecruxSessions"),
    cruxId: v.string(),
    eventType: v.string(),
    eventId: v.optional(v.string()),
    source: v.string(),
    targetId: v.optional(v.string()),
    payloadJson: v.string(),
    correlationId: v.string(),
    createdAt: v.number(),
  })
    .index("by_session_created", ["sessionId", "createdAt"])
    .index("by_target_created", ["targetId", "createdAt"]),

  bridgecruxOperationExecutions: defineTable({
    userId: v.id("bridgecruxUsers"),
    sessionId: v.id("bridgecruxSessions"),
    cruxId: v.string(),
    operationId: v.string(),
    kind: v.string(),
    target: v.string(),
    status: v.union(
      v.literal("started"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("skipped"),
      v.literal("duplicate"),
    ),
    idempotencyKey: v.optional(v.string()),
    payloadJson: v.string(),
    resultJson: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    correlationId: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_session_started", ["sessionId", "startedAt"]),

  bridgecruxProcessRuns: defineTable({
    userId: v.id("bridgecruxUsers"),
    sessionId: v.id("bridgecruxSessions"),
    cruxId: v.string(),
    processId: v.string(),
    processVersion: v.string(),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled"), v.literal("blocked")),
    activeStepId: v.optional(v.string()),
    stateJson: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_session_process_status", ["sessionId", "processId", "status"]),

  bridgecruxProcessItems: defineTable({
    userId: v.id("bridgecruxUsers"),
    processRunId: v.id("bridgecruxProcessRuns"),
    itemId: v.string(),
    stepId: v.string(),
    canonicalOrder: v.number(),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("deferred"), v.literal("completed"), v.literal("cancelled")),
    stateJson: v.string(),
    deferralReason: v.optional(v.string()),
    deferredAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    completionLedgerEventId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_process_order", ["processRunId", "canonicalOrder"])
    .index("by_process_status", ["processRunId", "status"])
    .index("by_process_item", ["processRunId", "itemId"]),

  bridgecruxMemories: defineTable({
    userId: v.id("bridgecruxUsers"),
    cruxId: v.string(),
    topic: v.string(),
    line: v.string(),
    evidence: v.string(),
    confidence: v.number(),
    source: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    lastEvidenceAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_crux_status", ["userId", "cruxId", "status"])
    .index("by_user_crux_topic", ["userId", "cruxId", "topic"]),

  bridgecruxReports: defineTable({
    userId: v.optional(v.id("bridgecruxUsers")),
    sessionId: v.optional(v.id("bridgecruxSessions")),
    cruxId: v.string(),
    severity: v.string(),
    boundary: v.string(),
    route: v.optional(v.string()),
    intent: v.optional(v.string()),
    handler: v.optional(v.string()),
    operationIds: v.optional(v.array(v.string())),
    model: v.optional(v.string()),
    summary: v.string(),
    transcriptExcerpt: v.optional(v.string()),
    stateSnapshotJson: v.string(),
    repairStatus: v.string(),
    exportStatus: v.optional(v.string()),
    correlationId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_repair_status_created", ["repairStatus", "createdAt"]),

  bridgecruxJobs: defineTable({
    kind: v.union(v.literal("memory_review"), v.literal("report_repair"), v.literal("followup"), v.literal("evaluation"), v.literal("feedback_export")),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("failed"), v.literal("cancelled")),
    payloadJson: v.string(),
    attempts: v.number(),
    runAfter: v.optional(v.number()),
    lastError: v.optional(v.string()),
    correlationId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status_run_after", ["status", "runAfter"]),
} as const;

export const bridgeCruxSchema = defineSchema(bridgeCruxTables);
export type BridgeCruxDataModel = DataModelFromSchemaDefinition<typeof bridgeCruxSchema>;

export const bridgeCruxTableNames = Object.freeze(Object.keys(bridgeCruxTables));
