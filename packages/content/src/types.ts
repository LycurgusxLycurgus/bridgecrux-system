export type ModelProfile = {
  provider: string;
  model: string;
  thinking: "low" | "high";
  temperature?: number;
};

export type CruxConfig = {
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
    memory?: ModelProfile;
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

export type ContentFileKind = "config" | "system" | "assistants" | "specific_function" | "deterministic_process";

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

export type DeterministicProcessManifest = {
  id: string;
  version: string;
  entryRoutes: string[];
  steps: string[];
  stateReads: string[];
  stateWrites: string[];
  allowsDeferral: boolean;
  source: string;
  body: string;
};

export type ContentManifest = {
  schemaVersion: 1;
  crux: {
    id: string;
    version: string;
    locale: string;
  };
  config: CruxConfig;
  systemPrompt: string;
  assistants: string;
  specificFunctions: SpecificFunctionManifest[];
  deterministicProcesses: DeterministicProcessManifest[];
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
