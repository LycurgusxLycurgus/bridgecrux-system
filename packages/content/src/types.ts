export type ModelProfile = {
  provider: string;
  model: string;
};

export type ContentExecutionPolicy =
  | { mode: "deterministic"; toolIds: [] }
  | { mode: "hybrid"; thinkingLevel: "high"; toolIds: string[] }
  | { mode: "agentic"; thinkingLevel: "medium" | "high"; toolIds: string[] };

export type ContentIntent = {
  id: string;
  summary: string;
  capabilityId: string;
  aliases?: string[];
  capabilityGapEligible?: boolean;
};

export type ContentRoute = {
  id: string;
  summary: string;
  intents: ContentIntent[];
};

export type ContentSurfaceBinding = {
  surface: string;
  entrypoints: string[];
  access: "public" | "authenticated" | "owner" | "internal";
  states: {
    loading: string;
    success: string;
    error: string;
    empty?: string;
  };
  presentationOnly?: boolean;
  rationale?: string;
};

export type ProductInvariant = {
  id: string;
  kind:
    | "surface_completeness"
    | "canonical_order"
    | "provenance"
    | "preference_default"
    | "auth_forward_compatibility"
    | "hosting_audience";
  description: string;
  verificationIds: string[];
  capabilityIds?: string[];
};

export type ContentCapability = {
  id: string;
  title: string;
  description: string;
  route: string;
  intent: string;
  handlerId: string;
  operationIds: string[];
  execution: ContentExecutionPolicy;
  copySources: ("authored_deterministic" | "conversational_tutor" | "high_thinking_tutor" | "safe_fallback")[];
  auditEvents: string[];
  surfaces: ContentSurfaceBinding[];
  interaction:
    | { mode: "none" }
    | { mode: "authored_choices"; allowFreeText: false }
    | { mode: "generated_choices"; allowFreeText: true; minimumOptions: 2; maximumOptions: 4 };
  deterministicJustification?: string;
  lifecycle?: {
    createOperationId: string;
    persistOperationId: string;
    rediscoverOperationId: string;
    reopenOperationId: string;
    archiveOperationId?: string;
    deleteOperationId?: string;
    noveltyPolicy: "required" | "not_applicable";
    idempotency: "required" | "not_applicable";
  };
  destructiveAction?: {
    confirmation: "server_issued";
    ownership: "required";
    expiryMs: number;
    singleUse: true;
    auditEvent: string;
  };
  internalOnly?: boolean;
  internalReason?: string;
};

export type CruxConfig = {
  schemaVersion: 3;
  id: string;
  version: string;
  locale: string;
  conversationWindow: number;
  surfaces: string[];
  routes: ContentRoute[];
  capabilities: ContentCapability[];
  models: {
    router: ModelProfile;
    tutor: ModelProfile;
    assessment?: ModelProfile;
    memory?: ModelProfile;
  };
  routing: {
    freeformThinkingLevel: "medium" | "high";
    highThinkingEvaluation?: { status: "passed"; evidence: string[] };
  };
  communication: {
    availableStyles: ("casual" | "pragmatic")[];
    defaultStyle: "casual" | "pragmatic";
    selection: "developer_fixed" | "user_selectable";
  };
  onboarding: {
    firstTurnCapabilityId: string;
    commandEntrypoints: string[];
    openControl: boolean;
  };
  channelAffordances: {
    surface: string;
    commands: string[];
    description: string;
    menuButton?: string;
    audience: "public" | "authenticated" | "internal";
  }[];
  invariants: ProductInvariant[];
  memory: { reviewEveryInboundTurns: number; reviewAtMilestones: boolean };
  capabilityGaps: { minimumConfidence: number; enabled: boolean };
  feedback: { enabled: boolean; endpoint?: string };
};

export type ContentFileKind = "config" | "system" | "assistants" | "specific_function" | "process";
export type DiscoveredContentFile = { path: string; relativePath: string; kind: ContentFileKind };
export type DiscoveredCruxContent = { root: string; files: DiscoveredContentFile[] };
export type FrontmatterBlock = { metadata: Record<string, unknown>; body: string; line: number };
export type ParsedContentFile = DiscoveredContentFile & { source: string; blocks: FrontmatterBlock[] };
export type ParsedCruxContent = { root: string; config?: CruxConfig; files: ParsedContentFile[] };

export type ContentDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  file: string;
  line?: number;
  field?: string;
};

export type ContentValidationContext = { operationIds: string[] };
export type ContentValidationResult = { ok: boolean; diagnostics: ContentDiagnostic[] };

export type SpecificFunctionManifest = {
  id: string;
  title: string;
  version: string;
  routes: string[];
  intents: string[];
  tools: string[];
  stateReads: string[];
  stateWrites: string[];
  source: string;
  body: string;
};

export type ProcessManifest = {
  id: string;
  version: string;
  entryRoutes: string[];
  advanceOperationId: string;
  steps: ProcessStepManifest[];
  stateReads: string[];
  stateWrites: string[];
  allowsDeferral: boolean;
  source: string;
  body: string;
};

export type ProcessStepManifest = {
  id: string;
  input: Record<string, unknown>;
  execution: Exclude<ContentExecutionPolicy, { mode: "agentic" }>;
  completionMode: "controller" | "model_tool";
  nextStepId?: string;
  confirmationPolicy: "never" | "on_correction" | "always";
  missingFieldQuestions: Record<string, string>;
};

export type ContentManifest = {
  schemaVersion: 3;
  crux: { id: string; version: string; locale: string };
  config: CruxConfig;
  systemPrompt: string;
  assistants: string;
  specificFunctions: SpecificFunctionManifest[];
  processes: ProcessManifest[];
  capabilityManifest: ContentCapability[];
  surfaceMatrix: {
    capabilityId: string;
    route: string;
    intent: string;
    surface: string;
    entrypoints: string[];
    access: ContentSurfaceBinding["access"];
    states: ContentSurfaceBinding["states"];
  }[];
  routeChecklist: {
    pathId: string;
    capabilityId: string;
    route: string;
    intent: string;
    execution: ContentExecutionPolicy;
    status: "designed";
  }[];
  handlerStubs: {
    id: string;
    capabilityId: string;
    route: string;
    intent: string;
    operationIds: string[];
  }[];
  regressionScenarios: {
    id: string;
    kind: "route" | "process_step" | "surface";
    expectedMode: "deterministic" | "hybrid" | "agentic";
    expectedThinkingLevel?: "medium" | "high";
    expectedToolIds: string[];
    surface?: string;
  }[];
  generatedAt: string;
  sourceFiles: string[];
};

export type ContentBuildInput = { root: string; operationIds: string[]; outputDirectory?: string };
export type ContentBuildResult = { manifest: ContentManifest; diagnostics: ContentDiagnostic[]; generatedFiles: string[] };

export interface ContentBuilder {
  discover(root: string): Promise<DiscoveredCruxContent>;
  parse(input: DiscoveredCruxContent): Promise<ParsedCruxContent>;
  validate(input: ParsedCruxContent, context: ContentValidationContext): ContentValidationResult;
  build(input: ContentBuildInput): Promise<ContentBuildResult>;
}
