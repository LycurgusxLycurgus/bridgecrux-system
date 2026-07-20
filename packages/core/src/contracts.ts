export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SpeechAct =
  | "question"
  | "announcement"
  | "proposal"
  | "permission"
  | "correction"
  | "confirmation"
  | "execution"
  | "other";

export type TemporalStance = "past" | "present" | "future" | "hypothetical" | "unclear";
export type MutationEvidence = "positive" | "insufficient" | "negative";
export type SafetyFlag = "none" | "possible" | "urgent";
export type ValidationStatus = "accepted" | "corrected" | "clarification" | "blocked";
export type CompositeStatus = "single" | "compatible" | "clarification" | "partially_blocked";

export type RuntimeCapabilityGapType =
  | "software_capability"
  | "task_signal"
  | "intent_reading"
  | "field_extraction"
  | "state_contract"
  | "tool_binding"
  | "knowledge_content"
  | "channel_interface"
  | "external_integration";

export type AuditDefectType =
  | "surface_omission"
  | "guard_divergence"
  | "composite_coverage"
  | "handler_binding"
  | "extractor_binding";

export type TargetReference = {
  raw: string;
  kind?: string;
  persistedId?: string;
  confidence: number;
};

export type ResolvedReference = TargetReference & {
  persistedId: string;
  resolution: "explicit_id" | "alias" | "active_fallback";
};

export type RawTaskSignalDecision = {
  route: string;
  intent: string;
  confidence: number;
  needsHighThinking: boolean;
  speechAct: SpeechAct;
  temporalStance: TemporalStance;
  targetReferences: TargetReference[];
  stateMutationCandidate: string;
  mutationEvidence: MutationEvidence;
  safetyFlag: SafetyFlag;
  handlerTarget?: string;
  extracted: Record<string, unknown>;
  anticipatedRoute?: string;
  capabilityGap?: string;
  capabilityGapType?: RuntimeCapabilityGapType;
  reason: string;
};

export type RawRouterDecision = RawTaskSignalDecision & {
  additionalSignals?: RawTaskSignalDecision[];
};

export type ValidatedTaskSignalDecision = RawTaskSignalDecision & {
  validationStatus: ValidationStatus;
  validationCodes: string[];
  resolvedReferences: ResolvedReference[];
  allowedMutation: boolean;
  validatedHandlerTarget?: string;
};

export type ValidatedRouterDecision = ValidatedTaskSignalDecision & {
  additionalSignals: ValidatedTaskSignalDecision[];
  compositeStatus: CompositeStatus;
};

export type IntentContract = {
  id: string;
  speechActs: SpeechAct[];
  temporalStances: TemporalStance[];
  mutationClasses: string[];
  requiredFields: string[];
  requiredState: string[];
  evidencePolicyId?: string;
  capabilityGapEligible?: boolean;
};

export type RouteContract = {
  id: string;
  intents: IntentContract[];
};

export type RouteRegistryDefinition = {
  routes: RouteContract[];
};

export type RuntimeUser = {
  id: string;
  externalId: string;
  channel: string;
  locale?: string;
  timezone?: string;
  displayName?: string;
};

export type RuntimeSession = {
  id: string;
  cruxId: string;
  status: string;
  inboundTurnCount: number;
  conversationWindow: number;
  activeProcessId?: string;
  activeProcessRunId?: string;
  activeProcessStep?: string;
  activeSpecificFunctionId?: string;
  activeSpecificFunctionStateId?: string;
  modelContinuityId?: string;
};

export type UserCopySource =
  | "authored_deterministic"
  | "conversational_tutor"
  | "high_thinking_tutor"
  | "safe_fallback";

export type RuntimeMessage = {
  id: string;
  userId: string;
  sessionId: string;
  channel: string;
  direction: "inbound" | "outbound";
  text: string;
  normalizedText?: string;
  copySource?: UserCopySource;
  route?: string;
  intent?: string;
  channelMessageId?: string;
  inboundIdempotencyKey?: string;
  deliveryStatus?: "pending" | "sent" | "failed";
  correlationId: string;
  createdAt: number;
};

export type RuntimeMemory = {
  id: string;
  userId: string;
  cruxId: string;
  topic: string;
  line: string;
  evidence: string;
  confidence: number;
  source: string;
  status: "active" | "archived";
  lastEvidenceAt: number;
};

export type LedgerEvent = {
  eventType: string;
  source: string;
  targetId?: string;
  payload: Record<string, unknown>;
  correlationId: string;
  createdAt: number;
};

export type LedgerSummary = {
  latestEvents: LedgerEvent[];
  counts: Record<string, number>;
};

export type RouterDecisionAudit = {
  phase: "raw" | "validated";
  decision: RawRouterDecision | ValidatedRouterDecision;
  cruxId: string;
  sessionId: string;
  correlationId: string;
  model?: string;
  createdAt: number;
};

export type ActiveDeterministicProcess = {
  processId: string;
  version: string;
  runId: string;
  activeStepId: string;
  state: Record<string, unknown>;
};

export type ActiveSpecificFunction = {
  functionId: string;
  version: string;
  stateId?: string;
  state: Record<string, unknown>;
};

export type DeferredProcessItem = {
  itemId: string;
  processRunId: string;
  stepId: string;
  canonicalOrder: number;
  reason: string;
  deferredAt: number;
};

export type CruxStateBundle = {
  user: RuntimeUser;
  session: RuntimeSession;
  recentMessages: RuntimeMessage[];
  memories: RuntimeMemory[];
  ledgerSummary: LedgerSummary;
  recentRouterDecisions: RouterDecisionAudit[];
  availableState: string[];
  activeProcess?: ActiveDeterministicProcess;
  activeSpecificFunction?: ActiveSpecificFunction;
  deferredItems?: DeferredProcessItem[];
  domainState?: unknown;
};

export type NormalizedInboundMessage = {
  id: string;
  userExternalId: string;
  threadId?: string;
  channel: string;
  text: string;
  attachments: JsonValue[];
  timestamp: number;
  idempotencyKey: string;
  correlationId: string;
  raw?: unknown;
};

export type PersistedMessage = RuntimeMessage & {
  duplicate?: boolean;
};

export type StateLoadRequest = {
  cruxId: string;
  inbound: NormalizedInboundMessage;
  conversationWindow: number;
};

export type RuntimeStateStore = {
  load(input: StateLoadRequest): Promise<CruxStateBundle>;
  persistInbound(message: NormalizedInboundMessage, cruxId: string): Promise<PersistedMessage>;
  persistOutbound(message: OutboundMessage, delivery: ChannelSendResult): Promise<PersistedMessage>;
};

export type RuntimeAuditStore = {
  persistRouterDecision(decision: RouterDecisionAudit): Promise<void>;
  appendLedger(events: LedgerEvent[]): Promise<void>;
};

export type RuntimeJob = {
  kind: "memory_review" | "report_repair" | "followup" | "evaluation" | "feedback_export";
  payload: Record<string, unknown>;
  correlationId: string;
  runAfter?: number;
};

export type QueuedJob = RuntimeJob & {
  id: string;
  status: "queued";
};

export type RuntimeJobQueue = {
  enqueue(job: RuntimeJob): Promise<QueuedJob>;
};

export type RouterInput = {
  message: NormalizedInboundMessage;
  registry: RouteRegistryDefinition;
  state: CruxStateBundle;
  declaredOperations: string[];
  safetyPolicies: string[];
  mutationPolicies: string[];
};

export type TaskSignalRouter = {
  readonly modelName?: string;
  decide(input: RouterInput): Promise<RawRouterDecision>;
};

export type ReferenceCandidate = {
  persistedId: string;
  kind?: string;
  aliases: string[];
};

export type ReferenceResolutionInput = {
  references: TargetReference[];
  candidates: ReferenceCandidate[];
  activePersistedId?: string;
  allowActiveFallback: boolean;
};

export type ReferenceResolutionResult = {
  status: "resolved" | "ambiguous" | "missing" | "none";
  references: ResolvedReference[];
  unresolved: TargetReference[];
};

export type ReferenceResolver = {
  resolve(input: ReferenceResolutionInput): ReferenceResolutionResult;
};

export type EvidencePolicy = {
  id: string;
  requiredDimensions: string[];
  contradictionFields?: string[];
  allowsAdditionalDimensions?: boolean;
};

export type EvidenceInput = {
  speechAct: SpeechAct;
  temporalStance: TemporalStance;
  mutationEvidence: MutationEvidence;
  extracted: Record<string, unknown>;
  target?: ResolvedReference;
};

export type EvidenceAssessment = {
  status: "none" | "announced" | "partial" | "sufficient" | "contradictory";
  target?: ResolvedReference;
  dimensions: string[];
  missing: string[];
  permitsCompletion: boolean;
  extracted: Record<string, unknown>;
};

export type EvidenceGate = {
  assess(input: EvidenceInput, policy: EvidencePolicy): EvidenceAssessment;
};

export type CapabilityGapInput = {
  decision: RawTaskSignalDecision;
  registry: RouteRegistryDefinition;
  hasHandler: boolean;
  hasOperation: boolean;
  minimumConfidence: number;
  reportPersistable: boolean;
};

export type CapabilityGapAssessment = {
  eligible: boolean;
  codes: string[];
  gapType?: RuntimeCapabilityGapType;
};

export type CapabilityGapGate = {
  assess(input: CapabilityGapInput): CapabilityGapAssessment;
};

export type HandlerBinding = {
  route: string;
  intent: string;
  handlerId: string;
  allowedMutationClasses: string[];
  requiredState: string[];
  operationIds: string[];
  copySources: UserCopySource[];
  auditEvents: string[];
};

export type HandlerBindingIssue = {
  type: AuditDefectType;
  route?: string;
  intent?: string;
  handlerId?: string;
  operationId?: string;
  message: string;
};

export type OperationPrecondition = {
  id: string;
  description: string;
  evaluate(context: OperationContext): boolean | Promise<boolean>;
};

export type PreservationContract = {
  preserveOmittedFields: boolean;
  preserveHistory: boolean;
  reversible: boolean;
  reversalOperationId?: string;
};

export type CruxOperationKind = "read" | "mutate" | "schedule" | "report" | "memory" | "deliver";

export type CruxOperation = {
  id: string;
  kind: CruxOperationKind;
  target: string;
  payload: Record<string, unknown>;
  preconditions: OperationPrecondition[];
  preservation: PreservationContract;
  idempotencyKey?: string;
  correlationId: string;
};

export type RuntimeErrorEnvelope = {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};

export type OperationResult = {
  operationId: string;
  status: "succeeded" | "failed" | "skipped" | "duplicate";
  persistedIds?: string[];
  output?: unknown;
  error?: RuntimeErrorEnvelope;
};

export type ResponsePlan = {
  source: UserCopySource;
  authoredText?: string;
  tutorInstruction?: string;
  fallbackText: string;
  successClaims: string[];
};

export type OperationPlan = {
  operations: CruxOperation[];
  ordering: "declared" | "transactional_group";
  responsePlan: ResponsePlan;
};

export type OperationContext = {
  state: CruxStateBundle;
  binding: HandlerBinding;
  decision: ValidatedTaskSignalDecision;
  correlationId: string;
};

export type OperationHandler = {
  readonly operationId: string;
  execute(operation: CruxOperation, context: OperationContext): Promise<OperationResult>;
};

export type OperationExecutionResult = {
  results: OperationResult[];
  ledgerEvents: LedgerEvent[];
  status: "succeeded" | "partially_failed" | "failed";
};

export type OperationExecutor = {
  execute(plan: OperationPlan, context: OperationContext): Promise<OperationExecutionResult>;
};

export type RouterValidationContext = {
  registry: RouteRegistryDefinition;
  bindings: HandlerBinding[];
  referenceCandidates: ReferenceCandidate[];
  activeReferenceId?: string;
  availableState: string[];
  evidencePolicies: Record<string, EvidencePolicy>;
  minimumGapConfidence: number;
  reportPersistable: boolean;
  compositeCompatibility?: (decisions: ValidatedTaskSignalDecision[]) => "compatible" | "clarification";
};

export type RouterValidationInput = {
  decision: RawRouterDecision;
  context: RouterValidationContext;
};

export type RouterDecisionValidator = {
  validate(input: RouterValidationInput): ValidatedRouterDecision;
};

export type HandlerInput = {
  decision: ValidatedTaskSignalDecision;
  state: CruxStateBundle;
  binding: HandlerBinding;
  correlationId: string;
};

export type HandlerResult = OperationPlan;

export type SpecificFunctionController = {
  readonly id: string;
  canHandle(input: HandlerInput): boolean;
  plan(input: HandlerInput): Promise<HandlerResult>;
};

export type ProcessAssessment = {
  status: "accept" | "reject" | "partial" | "clarify";
  normalizedFields?: Record<string, unknown>;
  targetStepId: string;
  canAdvance: boolean;
  missing: string[];
};

export type ProcessTurnInput = HandlerInput & {
  process: ActiveDeterministicProcess;
};

export type ValidatedProcessInput = ProcessTurnInput & {
  assessment: ProcessAssessment;
};

export type DeterministicProcessController = {
  readonly id: string;
  assess(input: ProcessTurnInput): Promise<ProcessAssessment>;
  plan(input: ValidatedProcessInput): Promise<HandlerResult>;
};

export type StructuredModelRequest<T> = {
  purpose: "router" | "memory" | "assessment";
  model?: string;
  prompt: string;
  input: unknown;
  schema: JsonValue;
  correlationId: string;
  temperature?: number;
  thinkingLevel?: ModelThinkingLevel;
  parse(value: unknown): T;
};

export type TutorModelRequest = {
  model?: string;
  systemPrompt: string;
  userMessage: string;
  recentMessages: RuntimeMessage[];
  decision: ValidatedRouterDecision;
  operationResults: OperationResult[];
  allowedContext: Record<string, unknown>;
  correlationId: string;
  thinkingLevel?: "medium" | "high";
};

export type ModelThinkingLevel = "minimal" | "low" | "medium" | "high";

export type ToolDefinition = {
  id: string;
  description: string;
  inputSchema: JsonValue;
};

export type ToolLoopRequest = TutorModelRequest & {
  tools: ToolDefinition[];
  execute(toolId: string, input: Record<string, unknown>): Promise<unknown>;
};

export type ToolLoopResult = {
  text: string;
  calls: { toolId: string; input: Record<string, unknown>; output: unknown }[];
};

export type ModelClient = {
  structured<T>(request: StructuredModelRequest<T>): Promise<T>;
  tutor(request: TutorModelRequest): Promise<string>;
  toolLoop?(request: ToolLoopRequest): Promise<ToolLoopResult>;
};

export type OutboundMessage = {
  id: string;
  userId: string;
  sessionId: string;
  channel: string;
  threadId?: string;
  text: string;
  copySource: UserCopySource;
  route?: string;
  intent?: string;
  correlationId: string;
  createdAt: number;
};

export type ChannelOutboundPayload = {
  channel: string;
  destination: string;
  text: string;
  replyTo?: string;
  correlationId: string;
};

export type ChannelSendResult = {
  status: "sent" | "failed";
  channelMessageId?: string;
  error?: RuntimeErrorEnvelope;
};

export type ChannelAdapter = {
  readonly channel: string;
  normalizeInbound(event: unknown): Promise<NormalizedInboundMessage>;
  formatOutbound(message: OutboundMessage): Promise<ChannelOutboundPayload[]>;
  send(payload: ChannelOutboundPayload): Promise<ChannelSendResult>;
};

export type CopyGateInput = {
  source: UserCopySource;
  text: string;
  operationResults: OperationResult[];
  successClaims: string[];
  locale?: string;
  maxLength?: number;
};

export type CopyGateResult =
  | { ok: true; text: string }
  | { ok: false; reason: string; fallbackText: string; report: CruxReportInput };

export type UserCopyGate = {
  validate(input: CopyGateInput): CopyGateResult;
};

export type CruxReportSeverity =
  | "info"
  | "bug"
  | "safety"
  | "missing_knowledge"
  | "tool_error"
  | "model_error"
  | "capability_gap";

export type CruxReportBoundary =
  | "router"
  | "validator"
  | "reference"
  | "evidence"
  | "binding"
  | "handler"
  | "operation"
  | "model"
  | "channel"
  | "content"
  | "memory"
  | "unknown";

export type CruxReportInput = {
  severity: CruxReportSeverity;
  boundary: CruxReportBoundary;
  cruxId?: string;
  route?: string;
  intent?: string;
  handler?: string;
  operationIds?: string[];
  model?: string;
  summary: string;
  transcriptExcerpt?: string;
  stateSnapshot: Record<string, unknown>;
  correlationId: string;
};

export type CruxReport = CruxReportInput & {
  id: string;
  repairStatus: "open" | "queued" | "sent" | "resolved" | "ignored";
  createdAt: number;
  updatedAt: number;
};

export type ReportStore = {
  create(report: CruxReportInput): Promise<CruxReport>;
  update(reportId: string, patch: Partial<Pick<CruxReport, "repairStatus" | "summary">>): Promise<CruxReport>;
  listOpen(): Promise<CruxReport[]>;
};

export type RepairClassification = {
  kind: "code" | "content" | "contract" | "external" | "observe";
  reason: string;
};

export type ReportController = {
  capture(input: CruxReportInput): Promise<CruxReport>;
  classify(report: CruxReport): Promise<RepairClassification>;
};

export type QueuedRepair = {
  id: string;
  reportId: string;
  status: "queued";
};

export type RepairResult = {
  reportId: string;
  status: "proposed" | "blocked" | "failed";
  summary: string;
};

/** @experimental Requires configured review and validation before any patch application. */
export type RepairQueue = {
  enqueue(report: CruxReport): Promise<QueuedRepair>;
  process(job: QueuedRepair): Promise<RepairResult>;
};

export type MemoryOperation =
  | { type: "noop"; reason: string }
  | { type: "upsert"; topic: string; line: string; evidence: string; confidence: number }
  | { type: "merge"; topics: string[]; topic: string; line: string; evidence: string; confidence: number }
  | { type: "correct"; topic: string; line: string; replaces: string; reason: string; confidence: number }
  | { type: "archive"; topic: string; reason: string };

export type MemoryOperationResult = {
  operation: MemoryOperation;
  status: "applied" | "rejected" | "noop";
  memory?: RuntimeMemory;
  reason?: string;
};

export type MemoryReviewInput = {
  userId: string;
  cruxId: string;
  userAuthoredEvidence: string[];
  confirmedMilestones: string[];
  currentMemories: RuntimeMemory[];
  correlationId: string;
};

export type MemoryStore = {
  list(userId: string, cruxId: string): Promise<RuntimeMemory[]>;
  apply(operations: MemoryOperation[], context: { userId: string; cruxId: string; correlationId: string }): Promise<MemoryOperationResult[]>;
};

/** @experimental Operation-level memory semantics require validation across two real cruxes. */
export type MemoryController = {
  propose(input: MemoryReviewInput): Promise<MemoryOperation[]>;
  validate(operations: MemoryOperation[], input: MemoryReviewInput): MemoryOperation[];
  apply(operations: MemoryOperation[], store: MemoryStore, input: MemoryReviewInput): Promise<MemoryOperationResult[]>;
};

export type RedactedFeedbackPayload = {
  frameworkVersion: string;
  adapterVersions: Record<string, string>;
  boundary: CruxReportBoundary;
  defectType: string;
  route?: string;
  intent?: string;
  stateShape: string[];
  regressionId?: string;
  summary: string;
};

export type FeedbackExportResult = {
  status: "sent" | "disabled" | "failed";
  reference?: string;
  error?: RuntimeErrorEnvelope;
};

export type FeedbackExporter = {
  preview(input: { report: CruxReport; frameworkVersion: string; adapterVersions: Record<string, string> }): Promise<RedactedFeedbackPayload>;
  export(payload: RedactedFeedbackPayload): Promise<FeedbackExportResult>;
};

export type RuntimePorts = {
  state: RuntimeStateStore;
  audit: RuntimeAuditStore;
  operations: OperationExecutor;
  memory: MemoryStore;
  reports: ReportStore;
  jobs: RuntimeJobQueue;
  model: ModelClient;
  channel: ChannelAdapter;
  feedback?: FeedbackExporter;
};

export type TurnInput = {
  cruxId: string;
  event: unknown;
  registry: RouteRegistryDefinition;
  declaredOperations: string[];
  safetyPolicies: string[];
  mutationPolicies: string[];
  conversationWindow: number;
};

export type TurnResult = {
  correlationId: string;
  decision?: ValidatedRouterDecision;
  operationResults: OperationResult[];
  outbound?: PersistedMessage;
  status: "completed" | "duplicate" | "clarification" | "failed";
  error?: RuntimeErrorEnvelope;
};

export type TurnController = {
  handle(input: TurnInput): Promise<TurnResult>;
};
