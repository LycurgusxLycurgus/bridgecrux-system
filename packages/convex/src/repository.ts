import type {
  CruxReport,
  CruxReportInput,
  CruxStateBundle,
  ChannelSendResult,
  LedgerEvent,
  MemoryOperation,
  MemoryOperationResult,
  NormalizedInboundMessage,
  OperationResult,
  OutboundMessage,
  PersistedMessage,
  QueuedJob,
  RouterDecisionAudit,
  RuntimeJob,
  RuntimeMemory,
  RuntimeMessage,
  StateLoadRequest,
} from "@bridge-crux/core";
import type { GenericDatabaseWriter } from "convex/server";
import type { BridgeCruxDataModel } from "./schema.js";

type Database = GenericDatabaseWriter<BridgeCruxDataModel>;
type UserId = BridgeCruxDataModel["bridgecruxUsers"]["document"]["_id"];
type SessionId = BridgeCruxDataModel["bridgecruxSessions"]["document"]["_id"];
type ProcessRunId = BridgeCruxDataModel["bridgecruxProcessRuns"]["document"]["_id"];
type ReportId = BridgeCruxDataModel["bridgecruxReports"]["document"]["_id"];

export type DomainStateLoader = (input: {
  db: Database;
  userId: UserId;
  sessionId: SessionId;
  inbound: NormalizedInboundMessage;
}) => Promise<unknown>;

export class ConvexBridgeCruxRepository {
  constructor(
    readonly db: Database,
    private readonly domainStateLoader?: DomainStateLoader,
    private readonly now: () => number = Date.now,
  ) {}

  async persistInbound(message: NormalizedInboundMessage, cruxId: string): Promise<PersistedMessage> {
    const existing = await this.db
      .query("bridgecruxMessages")
      .withIndex("by_inbound_idempotency", (query) => query.eq("inboundIdempotencyKey", message.idempotencyKey))
      .unique();
    if (existing) return { ...toMessage(existing), duplicate: true };

    const { userId, sessionId } = await this.#ensureUserSession(message, cruxId);
    const id = await this.db.insert("bridgecruxMessages", {
      userId,
      sessionId,
      channel: message.channel,
      direction: "inbound",
      text: message.text,
      normalizedText: message.text.trim(),
      inboundIdempotencyKey: message.idempotencyKey,
      deliveryStatus: "sent",
      correlationId: message.correlationId,
      createdAt: message.timestamp,
    });
    await this.db.patch(userId, { lastInboundAt: message.timestamp, updatedAt: this.now() });
    const session = await this.db.get(sessionId);
    if (session) await this.db.patch(sessionId, { inboundTurnCount: session.inboundTurnCount + 1, updatedAt: this.now() });
    const inserted = await this.db.get(id);
    if (!inserted) throw new Error("Inbound message persistence failed");
    return toMessage(inserted);
  }

  async load(input: StateLoadRequest): Promise<CruxStateBundle> {
    const user = await this.db
      .query("bridgecruxUsers")
      .withIndex("by_channel_external", (query) => query.eq("channel", input.inbound.channel).eq("externalId", input.inbound.userExternalId))
      .unique();
    if (!user) throw new Error("Runtime user was not persisted before state loading");
    const session = await this.db
      .query("bridgecruxSessions")
      .withIndex("by_user_crux", (query) => query.eq("userId", user._id).eq("cruxId", input.cruxId))
      .unique();
    if (!session) throw new Error("Runtime session was not persisted before state loading");

    const messages = (
      await this.db.query("bridgecruxMessages").withIndex("by_session_created", (query) => query.eq("sessionId", session._id)).order("desc").take(input.conversationWindow)
    )
      .reverse()
      .map(toMessage);
    const memories = (
      await this.db
        .query("bridgecruxMemories")
        .withIndex("by_user_crux_status", (query) => query.eq("userId", user._id).eq("cruxId", input.cruxId).eq("status", "active"))
        .collect()
    ).map(toMemory);
    const ledgerDocuments = await this.db
      .query("bridgecruxLedger")
      .withIndex("by_session_created", (query) => query.eq("sessionId", session._id))
      .order("desc")
      .take(50);
    const decisionDocuments = await this.db
      .query("bridgecruxRouterDecisions")
      .withIndex("by_session_created", (query) => query.eq("sessionId", session._id))
      .order("desc")
      .take(20);
    const activeProcessDocument = session.activeProcessRunId ? await this.db.get(session.activeProcessRunId) : null;
    const deferredDocuments = session.activeProcessRunId
      ? await this.db
          .query("bridgecruxProcessItems")
          .withIndex("by_process_status", (query) => query.eq("processRunId", session.activeProcessRunId!).eq("status", "deferred"))
          .collect()
      : [];
    const domainState = this.domainStateLoader
      ? await this.domainStateLoader({ db: this.db, userId: user._id, sessionId: session._id, inbound: input.inbound })
      : undefined;
    const availableState = ["messages", "memories", "ledger", "router_decisions", "reports", "jobs"];
    if (record(domainState)) availableState.push(...Object.keys(domainState));

    return {
      user: {
        id: user._id,
        externalId: user.externalId,
        channel: user.channel,
        ...(user.locale ? { locale: user.locale } : {}),
        ...(user.timezone ? { timezone: user.timezone } : {}),
        ...(user.displayName ? { displayName: user.displayName } : {}),
      },
      session: {
        id: session._id,
        cruxId: session.cruxId,
        status: session.status,
        inboundTurnCount: session.inboundTurnCount,
        conversationWindow: session.conversationWindow,
        ...(session.activeProcessId ? { activeProcessId: session.activeProcessId } : {}),
        ...(session.activeProcessRunId ? { activeProcessRunId: session.activeProcessRunId } : {}),
        ...(session.activeProcessStep ? { activeProcessStep: session.activeProcessStep } : {}),
        ...(session.activeSpecificFunctionId ? { activeSpecificFunctionId: session.activeSpecificFunctionId } : {}),
        ...(session.activeSpecificFunctionStateId ? { activeSpecificFunctionStateId: session.activeSpecificFunctionStateId } : {}),
        ...(session.modelContinuityId ? { modelContinuityId: session.modelContinuityId } : {}),
      },
      recentMessages: messages,
      memories,
      ledgerSummary: {
        latestEvents: ledgerDocuments.reverse().map((document) => ({
          eventType: document.eventType,
          source: document.source,
          ...(document.targetId ? { targetId: document.targetId } : {}),
          payload: jsonRecord(document.payloadJson),
          correlationId: document.correlationId,
          createdAt: document.createdAt,
        })),
        counts: countBy(ledgerDocuments.map((document) => document.eventType)),
      },
      recentRouterDecisions: decisionDocuments.map(toDecisionAudit),
      availableState: [...new Set(availableState)].sort(),
      ...(activeProcessDocument
        ? {
            activeProcess: {
              processId: activeProcessDocument.processId,
              version: activeProcessDocument.processVersion,
              runId: activeProcessDocument._id,
              activeStepId: activeProcessDocument.activeStepId ?? "",
              state: jsonRecord(activeProcessDocument.stateJson),
            },
          }
        : {}),
      ...(session.activeSpecificFunctionId
        ? {
            activeSpecificFunction: {
              functionId: session.activeSpecificFunctionId,
              version: "runtime",
              ...(session.activeSpecificFunctionStateId ? { stateId: session.activeSpecificFunctionStateId } : {}),
              state: {},
            },
          }
        : {}),
      ...(deferredDocuments.length > 0
        ? {
            deferredItems: deferredDocuments.map((document) => ({
              itemId: document.itemId,
              processRunId: document.processRunId,
              stepId: document.stepId,
              canonicalOrder: document.canonicalOrder,
              reason: document.deferralReason ?? "deferred",
              deferredAt: document.deferredAt ?? document.updatedAt,
            })),
          }
        : {}),
      ...(domainState !== undefined ? { domainState } : {}),
    };
  }

  async persistOutbound(message: OutboundMessage, delivery: ChannelSendResult): Promise<PersistedMessage> {
    const userId = message.userId as UserId;
    const sessionId = message.sessionId as SessionId;
    const id = await this.db.insert("bridgecruxMessages", {
      userId,
      sessionId,
      channel: message.channel,
      direction: "outbound",
      text: message.text,
      copySource: message.copySource,
      ...(message.route ? { route: message.route } : {}),
      ...(message.intent ? { intent: message.intent } : {}),
      ...(delivery.channelMessageId ? { channelMessageId: delivery.channelMessageId } : {}),
      deliveryStatus: delivery.status,
      correlationId: message.correlationId,
      createdAt: message.createdAt,
    });
    await this.db.patch(userId, { lastOutboundAt: message.createdAt, updatedAt: this.now() });
    const inserted = await this.db.get(id);
    if (!inserted) throw new Error("Outbound message persistence failed");
    return toMessage(inserted);
  }

  async persistRouterDecision(audit: RouterDecisionAudit): Promise<void> {
    const sessionId = audit.sessionId as SessionId;
    const session = await this.db.get(sessionId);
    if (!session) throw new Error(`Unknown session ${audit.sessionId}`);
    const primary = { ...audit.decision };
    const additional = "additionalSignals" in primary && Array.isArray(primary.additionalSignals) ? primary.additionalSignals : [];
    delete (primary as { additionalSignals?: unknown }).additionalSignals;
    const signals = [primary, ...additional];
    for (const [index, signal] of signals.entries()) {
      await this.db.insert("bridgecruxRouterDecisions", {
        userId: session.userId,
        sessionId,
        cruxId: audit.cruxId,
        phase: audit.phase,
        compositeGroupId: audit.correlationId,
        signalIndex: index,
        isPrimary: index === 0,
        route: signal.route,
        intent: signal.intent,
        confidence: signal.confidence,
        speechAct: signal.speechAct,
        temporalStance: signal.temporalStance,
        mutationEvidence: signal.mutationEvidence,
        safetyFlag: signal.safetyFlag,
        stateMutationCandidate: signal.stateMutationCandidate,
        ...(signal.handlerTarget ? { handlerTarget: signal.handlerTarget } : {}),
        ...(hasString(signal, "validationStatus") ? { validationStatus: signal.validationStatus } : {}),
        ...(hasStrings(signal, "validationCodes") ? { validationCodes: signal.validationCodes } : {}),
        targetReferencesJson: JSON.stringify(signal.targetReferences),
        extractedJson: JSON.stringify(signal.extracted),
        ...(signal.anticipatedRoute ? { anticipatedRoute: signal.anticipatedRoute } : {}),
        ...(signal.capabilityGap ? { capabilityGap: signal.capabilityGap } : {}),
        ...(signal.capabilityGapType ? { capabilityGapType: signal.capabilityGapType } : {}),
        reason: signal.reason,
        messageExcerpt: signal.reason.slice(0, 500),
        ...(audit.model ? { model: audit.model } : {}),
        correlationId: audit.correlationId,
        createdAt: audit.createdAt,
      });
    }
  }

  async appendLedger(events: LedgerEvent[]): Promise<void> {
    for (const event of events) {
      const context = await this.db
        .query("bridgecruxRouterDecisions")
        .withIndex("by_correlation", (query) => query.eq("correlationId", event.correlationId))
        .first();
      if (!context) throw new Error(`No persisted decision context for ledger correlation ${event.correlationId}`);
      await this.db.insert("bridgecruxLedger", {
        userId: context.userId,
        sessionId: context.sessionId,
        cruxId: context.cruxId,
        eventType: event.eventType,
        source: event.source,
        ...(event.targetId ? { targetId: event.targetId } : {}),
        payloadJson: JSON.stringify(event.payload),
        correlationId: event.correlationId,
        createdAt: event.createdAt,
      });
    }
  }

  async listMemories(userId: string, cruxId: string): Promise<RuntimeMemory[]> {
    const memories = await this.db
      .query("bridgecruxMemories")
      .withIndex("by_user_crux_status", (query) => query.eq("userId", userId as UserId).eq("cruxId", cruxId).eq("status", "active"))
      .collect();
    return memories.map(toMemory);
  }

  async applyMemories(
    operations: MemoryOperation[],
    context: { userId: string; cruxId: string; correlationId: string },
  ): Promise<MemoryOperationResult[]> {
    const results: MemoryOperationResult[] = [];
    const userId = context.userId as UserId;
    for (const operation of operations) {
      if (operation.type === "noop") {
        results.push({ operation, status: "noop", reason: operation.reason });
        continue;
      }
      if (operation.type === "archive") {
        const existing = await this.#memoryByTopic(userId, context.cruxId, operation.topic);
        if (!existing) results.push({ operation, status: "rejected", reason: "Memory topic does not exist" });
        else {
          await this.db.patch(existing._id, { status: "archived", updatedAt: this.now() });
          results.push({ operation, status: "applied" });
        }
        continue;
      }
      const topic = operation.topic;
      const existing = await this.#memoryByTopic(userId, context.cruxId, topic);
      const line = operation.line;
      const evidence = operation.type === "correct" ? operation.reason : operation.evidence;
      const confidence = operation.confidence;
      const timestamp = this.now();
      if (existing) {
        await this.db.patch(existing._id, { line, evidence, confidence, status: "active", lastEvidenceAt: timestamp, updatedAt: timestamp });
        const updated = await this.db.get(existing._id);
        results.push({ operation, status: "applied", ...(updated ? { memory: toMemory(updated) } : {}) });
      } else {
        const id = await this.db.insert("bridgecruxMemories", {
          userId,
          cruxId: context.cruxId,
          topic,
          line,
          evidence,
          confidence,
          source: operation.type,
          status: "active",
          lastEvidenceAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        const inserted = await this.db.get(id);
        results.push({ operation, status: "applied", ...(inserted ? { memory: toMemory(inserted) } : {}) });
      }
    }
    return results;
  }

  async createReport(input: CruxReportInput): Promise<CruxReport> {
    const timestamp = this.now();
    const id = await this.db.insert("bridgecruxReports", {
      ...(input.cruxId ? { cruxId: input.cruxId } : { cruxId: "unknown" }),
      severity: input.severity,
      boundary: input.boundary,
      ...(input.route ? { route: input.route } : {}),
      ...(input.intent ? { intent: input.intent } : {}),
      ...(input.handler ? { handler: input.handler } : {}),
      ...(input.operationIds ? { operationIds: input.operationIds } : {}),
      ...(input.model ? { model: input.model } : {}),
      summary: input.summary,
      ...(input.transcriptExcerpt ? { transcriptExcerpt: redact(input.transcriptExcerpt) } : {}),
      stateSnapshotJson: JSON.stringify(redactedShape(input.stateSnapshot)),
      repairStatus: "open",
      correlationId: input.correlationId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const document = await this.db.get(id);
    if (!document) throw new Error("Report persistence failed");
    return toReport(document);
  }

  async updateReport(reportId: string, patch: Partial<Pick<CruxReport, "repairStatus" | "summary">>): Promise<CruxReport> {
    const id = reportId as ReportId;
    await this.db.patch(id, { ...patch, updatedAt: this.now() });
    const document = await this.db.get(id);
    if (!document) throw new Error(`Unknown report ${reportId}`);
    return toReport(document);
  }

  async listOpenReports(): Promise<CruxReport[]> {
    const open = await this.db
      .query("bridgecruxReports")
      .withIndex("by_repair_status_created", (query) => query.eq("repairStatus", "open"))
      .collect();
    const queued = await this.db
      .query("bridgecruxReports")
      .withIndex("by_repair_status_created", (query) => query.eq("repairStatus", "queued"))
      .collect();
    return [...open, ...queued].sort((left, right) => left.createdAt - right.createdAt).map(toReport);
  }

  async enqueueJob(job: RuntimeJob): Promise<QueuedJob> {
    const timestamp = this.now();
    const id = await this.db.insert("bridgecruxJobs", {
      kind: job.kind,
      status: "queued",
      payloadJson: JSON.stringify(job.payload),
      attempts: 0,
      ...(job.runAfter ? { runAfter: job.runAfter } : {}),
      correlationId: job.correlationId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return { ...job, id, status: "queued" };
  }

  async recordOperation(
    context: { userId: string; sessionId: string; cruxId: string; operation: CruxOperationRecord },
  ): Promise<void> {
    const existing = context.operation.idempotencyKey
      ? await this.db
          .query("bridgecruxOperationExecutions")
          .withIndex("by_idempotency", (query) => query.eq("idempotencyKey", context.operation.idempotencyKey))
          .unique()
      : null;
    if (existing) return;
    await this.db.insert("bridgecruxOperationExecutions", {
      userId: context.userId as UserId,
      sessionId: context.sessionId as SessionId,
      cruxId: context.cruxId,
      operationId: context.operation.operationId,
      kind: context.operation.kind,
      target: context.operation.target,
      status: context.operation.result.status,
      ...(context.operation.idempotencyKey ? { idempotencyKey: context.operation.idempotencyKey } : {}),
      payloadJson: JSON.stringify(context.operation.payload),
      resultJson: JSON.stringify(context.operation.result),
      ...(context.operation.result.error ? { errorCode: context.operation.result.error.code } : {}),
      correlationId: context.operation.correlationId,
      startedAt: context.operation.startedAt,
      completedAt: this.now(),
    });
  }

  async operationByIdempotency(key: string): Promise<OperationResult | undefined> {
    const document = await this.db
      .query("bridgecruxOperationExecutions")
      .withIndex("by_idempotency", (query) => query.eq("idempotencyKey", key))
      .unique();
    if (!document?.resultJson) return undefined;
    return JSON.parse(document.resultJson) as OperationResult;
  }

  async deferProcessItem(input: { processRunId: string; itemId: string; reason: string }): Promise<void> {
    const processRunId = input.processRunId as ProcessRunId;
    const item = await this.db
      .query("bridgecruxProcessItems")
      .withIndex("by_process_item", (query) => query.eq("processRunId", processRunId).eq("itemId", input.itemId))
      .unique();
    if (!item) throw new Error(`Unknown process item ${input.itemId}`);
    if (item.status === "completed") throw new Error("Completed process items cannot be deferred");
    const timestamp = this.now();
    await this.db.patch(item._id, { status: "deferred", deferralReason: input.reason, deferredAt: timestamp, updatedAt: timestamp });
  }

  async completeDeferredProcessItem(input: { processRunId: string; itemId: string; ledgerEventId: string }): Promise<void> {
    const processRunId = input.processRunId as ProcessRunId;
    const item = await this.db
      .query("bridgecruxProcessItems")
      .withIndex("by_process_item", (query) => query.eq("processRunId", processRunId).eq("itemId", input.itemId))
      .unique();
    if (!item || item.status !== "deferred") throw new Error(`Deferred process item ${input.itemId} was not found`);
    const timestamp = this.now();
    await this.db.patch(item._id, {
      status: "completed",
      completedAt: timestamp,
      completionLedgerEventId: input.ledgerEventId,
      updatedAt: timestamp,
    });
  }

  async #ensureUserSession(message: NormalizedInboundMessage, cruxId: string): Promise<{ userId: UserId; sessionId: SessionId }> {
    let user = await this.db
      .query("bridgecruxUsers")
      .withIndex("by_channel_external", (query) => query.eq("channel", message.channel).eq("externalId", message.userExternalId))
      .unique();
    if (!user) {
      const timestamp = this.now();
      const id = await this.db.insert("bridgecruxUsers", {
        externalId: message.userExternalId,
        channel: message.channel,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastInboundAt: message.timestamp,
      });
      user = await this.db.get(id);
    }
    if (!user) throw new Error("User creation failed");
    let session = await this.db
      .query("bridgecruxSessions")
      .withIndex("by_user_crux", (query) => query.eq("userId", user!._id).eq("cruxId", cruxId))
      .unique();
    if (!session) {
      const timestamp = this.now();
      const id = await this.db.insert("bridgecruxSessions", {
        userId: user._id,
        cruxId,
        status: "active",
        ...(message.threadId ? { channelThreadId: message.threadId } : {}),
        inboundTurnCount: 0,
        conversationWindow: 12,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      session = await this.db.get(id);
    }
    if (!session) throw new Error("Session creation failed");
    return { userId: user._id, sessionId: session._id };
  }

  #memoryByTopic(userId: UserId, cruxId: string, topic: string) {
    return this.db
      .query("bridgecruxMemories")
      .withIndex("by_user_crux_topic", (query) => query.eq("userId", userId).eq("cruxId", cruxId).eq("topic", topic))
      .unique();
  }
}

export type CruxOperationRecord = {
  operationId: string;
  kind: string;
  target: string;
  payload: Record<string, unknown>;
  result: OperationResult;
  idempotencyKey?: string;
  correlationId: string;
  startedAt: number;
};

function toMessage(document: BridgeCruxDataModel["bridgecruxMessages"]["document"]): RuntimeMessage {
  return {
    id: document._id,
    userId: document.userId,
    sessionId: document.sessionId,
    channel: document.channel,
    direction: document.direction,
    text: document.text,
    ...(document.normalizedText ? { normalizedText: document.normalizedText } : {}),
    ...(isCopySource(document.copySource) ? { copySource: document.copySource } : {}),
    ...(document.route ? { route: document.route } : {}),
    ...(document.intent ? { intent: document.intent } : {}),
    ...(document.channelMessageId ? { channelMessageId: document.channelMessageId } : {}),
    ...(document.inboundIdempotencyKey ? { inboundIdempotencyKey: document.inboundIdempotencyKey } : {}),
    ...(document.deliveryStatus ? { deliveryStatus: document.deliveryStatus } : {}),
    correlationId: document.correlationId,
    createdAt: document.createdAt,
  };
}

function toMemory(document: BridgeCruxDataModel["bridgecruxMemories"]["document"]): RuntimeMemory {
  return {
    id: document._id,
    userId: document.userId,
    cruxId: document.cruxId,
    topic: document.topic,
    line: document.line,
    evidence: document.evidence,
    confidence: document.confidence,
    source: document.source,
    status: document.status,
    lastEvidenceAt: document.lastEvidenceAt,
  };
}

function toDecisionAudit(document: BridgeCruxDataModel["bridgecruxRouterDecisions"]["document"]): RouterDecisionAudit {
  return {
    phase: document.phase,
    decision: {
      route: document.route,
      intent: document.intent,
      confidence: document.confidence,
      needsHighThinking: true,
      speechAct: document.speechAct as RouterDecisionAudit["decision"]["speechAct"],
      temporalStance: document.temporalStance as RouterDecisionAudit["decision"]["temporalStance"],
      targetReferences: jsonArray(document.targetReferencesJson),
      stateMutationCandidate: document.stateMutationCandidate,
      mutationEvidence: document.mutationEvidence as RouterDecisionAudit["decision"]["mutationEvidence"],
      safetyFlag: document.safetyFlag as RouterDecisionAudit["decision"]["safetyFlag"],
      extracted: jsonRecord(document.extractedJson),
      reason: document.reason,
      ...(document.handlerTarget ? { handlerTarget: document.handlerTarget } : {}),
      ...(document.anticipatedRoute ? { anticipatedRoute: document.anticipatedRoute } : {}),
      ...(document.capabilityGap ? { capabilityGap: document.capabilityGap } : {}),
      ...(document.capabilityGapType ? { capabilityGapType: document.capabilityGapType as never } : {}),
    },
    cruxId: document.cruxId,
    sessionId: document.sessionId,
    correlationId: document.correlationId,
    ...(document.model ? { model: document.model } : {}),
    createdAt: document.createdAt,
  };
}

function toReport(document: BridgeCruxDataModel["bridgecruxReports"]["document"]): CruxReport {
  return {
    id: document._id,
    severity: document.severity as CruxReport["severity"],
    boundary: document.boundary as CruxReport["boundary"],
    cruxId: document.cruxId,
    ...(document.route ? { route: document.route } : {}),
    ...(document.intent ? { intent: document.intent } : {}),
    ...(document.handler ? { handler: document.handler } : {}),
    ...(document.operationIds ? { operationIds: document.operationIds } : {}),
    ...(document.model ? { model: document.model } : {}),
    summary: document.summary,
    ...(document.transcriptExcerpt ? { transcriptExcerpt: document.transcriptExcerpt } : {}),
    stateSnapshot: jsonRecord(document.stateSnapshotJson),
    correlationId: document.correlationId,
    repairStatus: document.repairStatus as CruxReport["repairStatus"],
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function jsonRecord(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return record(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function jsonArray(value: string | undefined): RouterDecisionAudit["decision"]["targetReferences"] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as RouterDecisionAudit["decision"]["targetReferences"]) : [];
  } catch {
    return [];
  }
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function hasString<T extends object, K extends string>(value: T, key: K): value is T & Record<K, string> {
  return key in value && typeof (value as Record<string, unknown>)[key] === "string";
}

function hasStrings<T extends object, K extends string>(value: T, key: K): value is T & Record<K, string[]> {
  return key in value && Array.isArray((value as Record<string, unknown>)[key]);
}

function isCopySource(value: string | undefined): value is RuntimeMessage["copySource"] & string {
  return value === "authored_deterministic" || value === "high_thinking_tutor" || value === "safe_fallback";
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactedShape(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.keys(value).map((key) => [key, "[redacted]"]));
}

function redact(value: string): string {
  return value.replace(/(api[_ -]?key|password|secret|token)\s*[:=]\s*\S+/gi, "$1=[redacted]").slice(0, 1_000);
}
