import type { CapabilityGapAssessment, CapabilityGapGate, CapabilityGapInput } from "./contracts.js";

const PLACEHOLDERS = new Set(["", "none", "null", "unknown"]);

export class DefaultCapabilityGapGate implements CapabilityGapGate {
  assess(input: CapabilityGapInput): CapabilityGapAssessment {
    const codes: string[] = [];
    const route = input.registry.routes.find((candidate) => candidate.id === input.decision.route);
    const intent = route?.intents.find((candidate) => candidate.id === input.decision.intent);

    if (input.decision.speechAct !== "execution") codes.push("gap_not_execution");
    if (!intent?.capabilityGapEligible) codes.push("gap_route_ineligible");
    if (input.decision.confidence < input.minimumConfidence) codes.push("gap_confidence_low");
    if (normalize(input.decision.stateMutationCandidate) !== "none") codes.push("gap_mutation_candidate_present");
    if (!metadata(input.decision.anticipatedRoute)) codes.push("gap_missing_anticipated_route");
    if (!metadata(input.decision.capabilityGap)) codes.push("gap_missing_description");
    if (!input.decision.capabilityGapType) codes.push("gap_missing_type");
    if (input.hasOperation) codes.push("gap_existing_operation");
    if (!input.hasHandler) codes.push("gap_missing_fallback_handler");
    if (!input.reportPersistable) codes.push("gap_report_unavailable");

    return {
      eligible: codes.length === 0,
      codes,
      ...(codes.length === 0 && input.decision.capabilityGapType ? { gapType: input.decision.capabilityGapType } : {}),
    };
  }
}

export function normalizeGapMetadata(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  return metadata(normalized) ? normalized : undefined;
}

function metadata(value: string | undefined): boolean {
  return value !== undefined && !PLACEHOLDERS.has(normalize(value));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
