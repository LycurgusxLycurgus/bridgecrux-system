import { randomUUID } from "node:crypto";
import type {
  CruxReport,
  CruxReportInput,
  FeedbackExportResult,
  FeedbackExporter,
  RedactedFeedbackPayload,
  RepairClassification,
  RepairQueue,
  RepairResult,
  ReportController,
  ReportStore,
  QueuedRepair,
} from "./contracts.js";

export class InMemoryReportStore implements ReportStore {
  readonly #reports = new Map<string, CruxReport>();
  constructor(private readonly now: () => number = Date.now) {}

  async create(input: CruxReportInput): Promise<CruxReport> {
    const timestamp = this.now();
    const report: CruxReport = { ...input, id: randomUUID(), repairStatus: "open", createdAt: timestamp, updatedAt: timestamp };
    this.#reports.set(report.id, report);
    return report;
  }

  async update(reportId: string, patch: Partial<Pick<CruxReport, "repairStatus" | "summary">>): Promise<CruxReport> {
    const current = this.#reports.get(reportId);
    if (!current) throw new Error(`Unknown report ${reportId}`);
    const updated = { ...current, ...patch, updatedAt: this.now() };
    this.#reports.set(reportId, updated);
    return updated;
  }

  async listOpen(): Promise<CruxReport[]> {
    return [...this.#reports.values()].filter((report) => report.repairStatus === "open" || report.repairStatus === "queued");
  }
}

export class DefaultReportController implements ReportController {
  constructor(private readonly store: ReportStore) {}

  capture(input: CruxReportInput): Promise<CruxReport> {
    return this.store.create(redactReport(input));
  }

  async classify(report: CruxReport): Promise<RepairClassification> {
    if (report.boundary === "content") return { kind: "content", reason: "Canonical content or build validation failed" };
    if (report.boundary === "channel" || report.boundary === "model") return { kind: "external", reason: "Provider boundary requires adapter diagnosis" };
    if (report.severity === "info") return { kind: "observe", reason: "Informational report does not justify a patch" };
    if (report.boundary === "validator" || report.boundary === "binding") return { kind: "contract", reason: "Runtime contract or registration is incomplete" };
    return { kind: "code", reason: "Runtime implementation requires a reviewed correction" };
  }
}

/** @experimental Produces reviewable proposals and never applies patches. */
export class ReviewOnlyRepairQueue implements RepairQueue {
  readonly #reports = new Map<string, CruxReport>();

  async enqueue(report: CruxReport): Promise<QueuedRepair> {
    this.#reports.set(report.id, report);
    return { id: randomUUID(), reportId: report.id, status: "queued" };
  }

  async process(job: QueuedRepair): Promise<RepairResult> {
    const report = this.#reports.get(job.reportId);
    if (!report) return { reportId: job.reportId, status: "failed", summary: "Report was not available" };
    return {
      reportId: report.id,
      status: "proposed",
      summary: `Review required for ${report.boundary}: ${report.summary}`,
    };
  }
}

export class OptInFeedbackExporter implements FeedbackExporter {
  constructor(
    private readonly options: {
      enabled: boolean;
      endpoint?: string;
      fetcher?: typeof fetch;
    },
  ) {}

  async preview(input: {
    report: CruxReport;
    frameworkVersion: string;
    adapterVersions: Record<string, string>;
  }): Promise<RedactedFeedbackPayload> {
    return {
      frameworkVersion: input.frameworkVersion,
      adapterVersions: input.adapterVersions,
      boundary: input.report.boundary,
      defectType: input.report.severity,
      ...(input.report.route ? { route: input.report.route } : {}),
      ...(input.report.intent ? { intent: input.report.intent } : {}),
      stateShape: Object.keys(input.report.stateSnapshot).sort(),
      summary: input.report.summary,
    };
  }

  async export(payload: RedactedFeedbackPayload): Promise<FeedbackExportResult> {
    if (!this.options.enabled) return { status: "disabled" };
    if (!this.options.endpoint) {
      return { status: "failed", error: { status: 500, code: "feedback_endpoint_missing", message: "Feedback endpoint is not configured" } };
    }
    const fetcher = this.options.fetcher ?? fetch;
    try {
      const response = await fetcher(this.options.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return { status: "failed", error: { status: response.status, code: "feedback_export_failed", message: "Feedback endpoint rejected the payload" } };
      }
      const reference = response.headers.get("x-request-id");
      return { status: "sent", ...(reference ? { reference } : {}) };
    } catch (error) {
      return {
        status: "failed",
        error: { status: 503, code: "feedback_transport_error", message: error instanceof Error ? error.message : "Feedback transport failed", retryable: true },
      };
    }
  }
}

function redactReport(input: CruxReportInput): CruxReportInput {
  return {
    ...input,
    summary: redact(input.summary).slice(0, 1_000),
    transcriptExcerpt: input.transcriptExcerpt ? redact(input.transcriptExcerpt).slice(0, 1_000) : undefined,
    stateSnapshot: Object.fromEntries(Object.keys(input.stateSnapshot).map((key) => [key, "[redacted]"])),
  } as CruxReportInput;
}

function redact(value: string): string {
  return value.replace(/(api[_ -]?key|password|secret|token)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}
