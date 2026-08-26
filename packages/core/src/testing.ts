import type {
  ActiveProcess,
  ChannelAdapter,
  CruxStateBundle,
  LedgerEvent,
  ModelClient,
  NormalizedInboundMessage,
  OperationExecutor,
  PersistedMessage,
  RouterDecisionAudit,
  RouteRegistryDefinition,
  HandlerBinding,
  RuntimeJob,
  RuntimeMemory,
  RuntimeMessage,
  RuntimePorts,
  UserCopySource,
} from "./contracts.js";
import { InMemoryStructuredInteractionStore, InMemoryTurnLeaseStore } from "./interactions.js";
import { InMemoryReportStore } from "./reports.js";

export class InMemoryCruxRuntime {
  readonly messages: RuntimeMessage[] = [];
  readonly routerDecisions: RouterDecisionAudit[] = [];
  readonly ledger: LedgerEvent[] = [];
  readonly jobs: (RuntimeJob & { id: string; status: "queued" })[] = [];
  readonly memories: RuntimeMemory[] = [];
  readonly reports: InMemoryReportStore;
  readonly interactions: InMemoryStructuredInteractionStore;
  readonly turns: InMemoryTurnLeaseStore;
  readonly #inboundKeys = new Set<string>();
  #domainState: unknown;
  #activeProcess: ActiveProcess | undefined;
  #turnCount = 0;

  constructor(
    private readonly options: {
      cruxId: string;
      userId?: string;
      externalId?: string;
      communicationStyle?: "casual" | "pragmatic";
      sessionId?: string;
      channel?: string;
      conversationWindow?: number;
      availableState?: string[];
      domainState?: unknown;
      activeProcess?: ActiveProcess;
      now?: () => number;
      id?: () => string;
    },
  ) {
    const now = options.now ?? Date.now;
    this.reports = new InMemoryReportStore(now);
    this.interactions = new InMemoryStructuredInteractionStore(options.id);
    this.turns = new InMemoryTurnLeaseStore(now);
    this.#domainState = options.domainState;
    this.#activeProcess = options.activeProcess;
  }

  setDomainState(value: unknown): void {
    this.#domainState = value;
  }

  setActiveProcess(value: ActiveProcess | undefined): void {
    this.#activeProcess = value;
  }

  ports(input: { operations: OperationExecutor; model: ModelClient; channel: ChannelAdapter }): RuntimePorts {
    return {
      state: {
        persistInbound: (message) => this.#persistInbound(message),
        load: (request) => this.#load(request.inbound, request.conversationWindow),
        persistOutbound: (message, delivery) => {
          const persisted: PersistedMessage = {
            ...message,
            direction: "outbound",
            ...(delivery.channelMessageId ? { channelMessageId: delivery.channelMessageId } : {}),
            deliveryStatus: delivery.status,
          };
          this.messages.push(persisted);
          return Promise.resolve(persisted);
        },
      },
      audit: {
        persistRouterDecision: (decision) => {
          this.routerDecisions.push(decision);
          return Promise.resolve();
        },
        appendLedger: (events) => {
          this.ledger.push(...events);
          return Promise.resolve();
        },
      },
      operations: input.operations,
      memory: {
        list: async (userId, cruxId) => this.memories.filter((memory) => memory.userId === userId && memory.cruxId === cruxId),
        apply: async (operations) => operations.map((operation) => ({ operation, status: operation.type === "noop" ? "noop" : "rejected", reason: "Testing runtime requires explicit memory fixtures" })),
      },
      reports: this.reports,
      jobs: {
        enqueue: async (job) => {
          const queued = { ...job, id: `job-${this.jobs.length + 1}`, status: "queued" as const };
          this.jobs.push(queued);
          return queued;
        },
      },
      model: input.model,
      channel: input.channel,
      turns: this.turns,
      interactions: this.interactions,
    };
  }

  async #persistInbound(message: NormalizedInboundMessage): Promise<PersistedMessage> {
    const duplicate = this.#inboundKeys.has(message.idempotencyKey);
    this.#inboundKeys.add(message.idempotencyKey);
    if (!duplicate) this.#turnCount += 1;
    const persisted: PersistedMessage = {
      id: message.id,
      userId: this.options.userId ?? "user-1",
      sessionId: this.options.sessionId ?? "session-1",
      channel: message.channel,
      direction: "inbound",
      text: message.text,
      normalizedText: message.text,
      inboundIdempotencyKey: message.idempotencyKey,
      deliveryStatus: "sent",
      correlationId: message.correlationId,
      createdAt: message.timestamp,
      ...(duplicate ? { duplicate: true } : {}),
    };
    if (!duplicate) this.messages.push(persisted);
    return persisted;
  }

  async #load(inbound: NormalizedInboundMessage, conversationWindow: number): Promise<CruxStateBundle> {
    return {
      user: {
        id: this.options.userId ?? "user-1",
        externalId: this.options.externalId ?? inbound.userExternalId,
        channel: this.options.channel ?? inbound.channel,
        ...(this.options.communicationStyle ? { communicationStyle: this.options.communicationStyle } : {}),
      },
      session: {
        id: this.options.sessionId ?? "session-1",
        cruxId: this.options.cruxId,
        status: "active",
        inboundTurnCount: this.#turnCount,
        conversationWindow: this.options.conversationWindow ?? conversationWindow,
        ...(this.#activeProcess
          ? {
              activeProcessId: this.#activeProcess.processId,
              activeProcessRunId: this.#activeProcess.runId,
              activeProcessStep: this.#activeProcess.activeStepId,
            }
          : {}),
      },
      recentMessages: this.messages.slice(-conversationWindow),
      memories: [...this.memories],
      ledgerSummary: { latestEvents: [...this.ledger], counts: countBy(this.ledger.map((event) => event.eventType)) },
      recentRouterDecisions: [...this.routerDecisions],
      availableState: this.options.availableState ?? [],
      ...(this.#activeProcess ? { activeProcess: this.#activeProcess } : {}),
      ...(this.#domainState !== undefined ? { domainState: this.#domainState } : {}),
    };
  }
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

export type RouteSimulationObservation = {
  pathId: string;
  capabilityId: string;
  route: string;
  intent: string;
  executionMode: "deterministic" | "hybrid" | "agentic";
  thinkingLevel?: "medium" | "high";
  modelCallCount: number;
  activeProcessTurn: boolean;
  structuredInput: "none" | "trusted" | "rejected";
  turnLeaseStatus: "acquired" | "busy";
  toolIds: string[];
  operationIds: string[];
  requiredOperationId?: string;
  deliberateNoop?: boolean;
  persisted: boolean;
  copySource: UserCopySource;
  activityStatus: "started" | "not_supported";
  delivered: boolean;
  audited: boolean;
  surfaceResults: Record<string, boolean>;
};

export function auditAllRouteSimulation(input: {
  registry: RouteRegistryDefinition;
  bindings: HandlerBinding[];
  observations: RouteSimulationObservation[];
}): string[] {
  const issues: string[] = [];
  const expected = input.registry.routes.flatMap((route) => route.intents.map((intent) => `${route.id}/${intent.id}`));
  const bindings = new Map(input.bindings.map((binding) => [`${binding.route}/${binding.intent}`, binding]));
  for (const pathId of expected) {
    const rows = input.observations.filter((row) => `${row.route}/${row.intent}` === pathId);
    if (rows.length !== 1) {
      issues.push(`${pathId} requires exactly one all-route simulation row; found ${rows.length}`);
      continue;
    }
    const row = rows[0]!;
    const binding = bindings.get(pathId);
    if (!binding) {
      issues.push(`${pathId} has no handler binding`);
      continue;
    }
    const capability = input.registry.capabilities.find((candidate) => `${candidate.route}/${candidate.intent}` === pathId);
    if (!capability) {
      issues.push(`${pathId} has no capability contract`);
      continue;
    }
    if (row.capabilityId !== capability.id) issues.push(`${pathId} simulated capability ${row.capabilityId} but declares ${capability.id}`);
    if (row.executionMode !== binding.executionPolicy.mode) issues.push(`${pathId} simulated ${row.executionMode} but declares ${binding.executionPolicy.mode}`);
    if (row.turnLeaseStatus !== "acquired") issues.push(`${pathId} did not acquire its turn lease`);
    if (binding.executionPolicy.mode === "deterministic") {
      if (row.modelCallCount !== 0) issues.push(`${pathId} is deterministic but made ${row.modelCallCount} model call(s)`);
      if (row.toolIds.length > 0) issues.push(`${pathId} is deterministic but exposed model tools`);
      if (row.activeProcessTurn && row.structuredInput !== "trusted") issues.push(`${pathId} active deterministic turn did not prove trusted structured input`);
    } else if (row.thinkingLevel !== binding.executionPolicy.thinkingLevel) {
      issues.push(`${pathId} simulated ${row.thinkingLevel ?? "no"} thinking but declares ${binding.executionPolicy.thinkingLevel}`);
    }
    for (const toolId of row.toolIds) {
      if (binding.executionPolicy.mode === "deterministic" || !binding.executionPolicy.toolIds.includes(toolId)) issues.push(`${pathId} used undeclared tool ${toolId}`);
    }
    for (const operationId of row.operationIds) {
      if (!binding.operationIds.includes(operationId)) issues.push(`${pathId} executed operation ${operationId} outside its binding`);
    }
    if (row.requiredOperationId && !row.operationIds.includes(row.requiredOperationId) && !row.deliberateNoop) {
      issues.push(`${pathId} did not execute required operation ${row.requiredOperationId}`);
    }
    if (!binding.copySources.includes(row.copySource)) issues.push(`${pathId} used undeclared copy source ${row.copySource}`);
    if (!row.persisted) issues.push(`${pathId} did not prove persistence or a deliberate no-op`);
    if (!row.delivered) issues.push(`${pathId} did not prove user delivery`);
    if (!row.audited) issues.push(`${pathId} did not prove audit evidence`);
    for (const surface of ["conversation", "headless", ...input.registry.surfaces]) {
      if (row.surfaceResults[surface] !== true) issues.push(`${pathId} did not prove ${surface} surface parity`);
    }
  }
  for (const row of input.observations) {
    if (!expected.includes(`${row.route}/${row.intent}`)) issues.push(`${row.pathId} simulates undeclared path ${row.route}/${row.intent}`);
  }
  return issues;
}
