import type { CopyGateInput, CopyGateResult, CruxReportInput, UserCopyGate } from "./contracts.js";

const INTERNAL_TERMS = [
  /\brouter decision\b/i,
  /\bhandler binding\b/i,
  /\boperation id\b/i,
  /\bstateMutationCandidate\b/i,
  /\bcapabilityGapType\b/i,
  /\bvalidationCodes\b/i,
  /```json/i,
];

/** @experimental The first hard copy gate is mandatory but remains experimental in 0.x. */
export class DefaultUserCopyGate implements UserCopyGate {
  constructor(private readonly fallbackText = "I couldn’t complete that safely. Please try again or rephrase the request.") {}

  validate(input: CopyGateInput): CopyGateResult {
    const failure = this.#reason(input);
    if (!failure) return { ok: true, text: input.text.trim() };
    const report: CruxReportInput = {
      severity: "bug",
      boundary: "model",
      summary: failure,
      stateSnapshot: { copySource: input.source, operationStatuses: input.operationResults.map((result) => result.status) },
      correlationId: "copy-gate",
    };
    return { ok: false, reason: failure, fallbackText: this.fallbackText, report };
  }

  #reason(input: CopyGateInput): string | undefined {
    if (!input.text.trim()) return "User copy was empty";
    if (INTERNAL_TERMS.some((pattern) => pattern.test(input.text))) return "User copy exposed internal runtime vocabulary";
    if (input.maxLength && input.text.length > input.maxLength) return "User copy exceeded the configured unsplit channel limit";
    const failed = input.operationResults.some((result) => result.status === "failed" || result.status === "skipped");
    if (failed && input.successClaims.length > 0) return "User copy claimed success after an unsuccessful operation";
    return undefined;
  }
}
