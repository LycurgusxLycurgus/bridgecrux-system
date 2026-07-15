import type { EvidenceAssessment, EvidenceGate, EvidenceInput, EvidencePolicy } from "./contracts.js";

export class DefaultEvidenceGate implements EvidenceGate {
  assess(input: EvidenceInput, policy: EvidencePolicy): EvidenceAssessment {
    const dimensions = Object.entries(input.extracted)
      .filter(([, value]) => present(value))
      .map(([key]) => key)
      .sort();
    const missing = policy.requiredDimensions.filter((dimension) => !dimensions.includes(dimension));
    const contradictory =
      input.mutationEvidence === "negative" ||
      (policy.contradictionFields ?? []).some((field) => contradictoryValue(input.extracted[field]));

    let status: EvidenceAssessment["status"] = "none";
    if (contradictory) status = "contradictory";
    else if (input.temporalStance === "future" || input.speechAct === "permission" || input.speechAct === "proposal") status = "announced";
    else if (dimensions.length > 0 && missing.length > 0) status = "partial";
    else if (missing.length === 0 && input.mutationEvidence === "positive") status = "sufficient";

    return {
      status,
      ...(input.target ? { target: input.target } : {}),
      dimensions,
      missing,
      permitsCompletion: status === "sufficient",
      extracted: input.extracted,
    };
  }
}

function present(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  return !Array.isArray(value) || value.length > 0;
}

function contradictoryValue(value: unknown): boolean {
  return value === false || value === "contradictory" || value === "retracted";
}
