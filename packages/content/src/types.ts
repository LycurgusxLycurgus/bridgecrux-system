export type ModelProfile = {
  provider: string;
  model: string;
  temperature?: number;
};

export type ContentExecutionPolicy =
  | { mode: "deterministic"; toolIds: [] }
  | { mode: "hybrid" | "model"; thinkingLevel: "medium" | "high"; toolIds: string[] };

export type CruxConfig = {
  schemaVersion: 2;
  id: string;
  version: string;
  locale: string;
  routeRegistry: string[];
  intentRegistry: Record<string, string[]>;
  capabilityGapEligibleRoutes: string[];
  conversationWindow: number;
  models: {
    router: ModelProfile;
    tutor: ModelProfile;
    assessment?: ModelProfile;
    memory?: ModelProfile;
  };
  execution: {
    freeformRouterThinkingLevel: "medium";
    routes: Record<string, ContentExecutionPolicy>;
  };
  channels: string[];
  memory: {
    reviewEveryInboundTurns: number;
    reviewAtMilestones: boolean;
  };
  capabilityGaps: {
    minimumConfidence: number;
    enabled: boolean;
  };
  feedback: {
    enabled: boolean;
    endpoint?: string;
  };
};

export type ContentFileKind = "config" | "system" | "assistants" | "specific_function" | "process";

export type DiscoveredContentFile = {
  path: string;
  relativePath: string;
  kind: ContentFileKind;
};

export type DiscoveredCruxContent = {
  root: string;
  files: DiscoveredContentFile[];
};

export type FrontmatterBlock = {
  metadata: Record<string, unknown>;
  body: string;
  line: number;
};

export type ParsedContentFile = DiscoveredContentFile & {
  source: string;
  blocks: FrontmatterBlock[];
};

export type ParsedCruxContent = {
  root: string;
  config?: CruxConfig;
  files: ParsedContentFile[];
};

export type ContentDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  file: string;
  line?: number;
  field?: string;
};

export type ContentValidationContext = {
  operationIds: string[];
};

export type ContentValidationResult = {
  ok: boolean;
  diagnostics: ContentDiagnostic[];
};

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
  execution: ContentExecutionPolicy;
  completionMode: "controller" | "model_tool";
  nextStepId?: string;
  confirmationPolicy: "never" | "on_correction" | "always";
  missingFieldQuestions: Record<string, string>;
};

export type ContentManifest = {
  schemaVersion: 2;
  crux: {
    id: string;
    version: string;
    locale: string;
  };
  config: CruxConfig;
  systemPrompt: string;
  assistants: string;
  specificFunctions: SpecificFunctionManifest[];
  processes: ProcessManifest[];
  routeChecklist: {
    pathId: string;
    route: string;
    intent: string;
    execution: ContentExecutionPolicy;
    status: "designed";
  }[];
  handlerStubs: {
    id: string;
    route: string;
    intent: string;
    operationIds: string[];
  }[];
  regressionScenarios: {
    id: string;
    kind: "route" | "process_step";
    expectedMode: "deterministic" | "hybrid" | "model";
    expectedThinkingLevel?: "medium" | "high";
    expectedToolIds: string[];
  }[];
  generatedAt: string;
  sourceFiles: string[];
};

export type ContentBuildInput = {
  root: string;
  operationIds: string[];
  outputDirectory?: string;
};

export type ContentBuildResult = {
  manifest: ContentManifest;
  diagnostics: ContentDiagnostic[];
  generatedFiles: string[];
};

export interface ContentBuilder {
  discover(root: string): Promise<DiscoveredCruxContent>;
  parse(input: DiscoveredCruxContent): Promise<ParsedCruxContent>;
  validate(input: ParsedCruxContent, context: ContentValidationContext): ContentValidationResult;
  build(input: ContentBuildInput): Promise<ContentBuildResult>;
}
