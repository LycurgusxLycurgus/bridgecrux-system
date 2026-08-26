import type { ModelThinkingLevel } from "./contracts.js";

export type RoutingEvaluationCase = {
  id: string;
  message: string;
  expectedRoute: string;
  expectedIntent: string;
  required: boolean;
  state?: Record<string, unknown>;
};

export type RoutingEvaluationObservation = {
  caseId: string;
  thinkingLevel: ModelThinkingLevel;
  run: number;
  route: string;
  intent: string;
};

export type RoutingComplexityEvaluation = {
  status: "passed" | "repair_required" | "insufficient_evidence";
  recommendation?: ModelThinkingLevel;
  medium: RoutingEvaluationSummary;
  high: RoutingEvaluationSummary;
  reasons: string[];
};

export type RoutingEvaluationSummary = {
  total: number;
  passed: number;
  requiredFailures: string[];
  inconsistentCases: string[];
};

export function evaluateRoutingComplexity(input: {
  cases: RoutingEvaluationCase[];
  observations: RoutingEvaluationObservation[];
}): RoutingComplexityEvaluation {
  if (input.cases.length === 0 || new Set(input.cases.map((candidate) => candidate.id)).size !== input.cases.length) {
    return empty("Routing evaluation requires at least one uniquely identified case");
  }
  const medium = summarize("medium", input.cases, input.observations);
  const high = summarize("high", input.cases, input.observations);
  const missingMedium = input.cases.filter((candidate) => !input.observations.some((row) => row.caseId === candidate.id && row.thinkingLevel === "medium"));
  if (missingMedium.length > 0) {
    return {
      status: "insufficient_evidence",
      medium,
      high,
      reasons: [`Medium-thinking observations are missing for: ${missingMedium.map((candidate) => candidate.id).join(", ")}`],
    };
  }
  if (medium.requiredFailures.length === 0 && medium.inconsistentCases.length === 0) {
    return {
      status: "passed",
      recommendation: "medium",
      medium,
      high,
      reasons: ["Medium thinking passed every required route case consistently; high thinking is unnecessary"],
    };
  }
  const missingHigh = input.cases.filter((candidate) => !input.observations.some((row) => row.caseId === candidate.id && row.thinkingLevel === "high"));
  if (missingHigh.length > 0) {
    return {
      status: "insufficient_evidence",
      medium,
      high,
      reasons: [`Medium did not pass; high-thinking comparison is missing for: ${missingHigh.map((candidate) => candidate.id).join(", ")}`],
    };
  }
  if (high.requiredFailures.length === 0 && high.inconsistentCases.length === 0) {
    return {
      status: "passed",
      recommendation: "high",
      medium,
      high,
      reasons: ["Medium missed required or repeatable cases and high passed the same corpus consistently"],
    };
  }
  return {
    status: "repair_required",
    medium,
    high,
    reasons: ["Neither thinking level satisfies the required routing corpus; repair the route catalog, prompt, state projection, or validator"],
  };
}

function summarize(
  thinkingLevel: ModelThinkingLevel,
  cases: RoutingEvaluationCase[],
  observations: RoutingEvaluationObservation[],
): RoutingEvaluationSummary {
  const expected = new Map(cases.map((candidate) => [candidate.id, candidate]));
  const rows = observations.filter((row) => row.thinkingLevel === thinkingLevel && expected.has(row.caseId));
  const requiredFailures: string[] = [];
  const inconsistentCases: string[] = [];
  let passed = 0;
  for (const candidate of cases) {
    const candidateRows = rows.filter((row) => row.caseId === candidate.id);
    if (candidateRows.length === 0) continue;
    const outcomes = new Set(candidateRows.map((row) => `${row.route}/${row.intent}`));
    if (outcomes.size > 1) inconsistentCases.push(candidate.id);
    const correct = candidateRows.every((row) => row.route === candidate.expectedRoute && row.intent === candidate.expectedIntent);
    if (correct) passed += 1;
    else if (candidate.required) requiredFailures.push(candidate.id);
  }
  return { total: cases.length, passed, requiredFailures, inconsistentCases };
}

function empty(reason: string): RoutingComplexityEvaluation {
  const summary = { total: 0, passed: 0, requiredFailures: [], inconsistentCases: [] };
  return { status: "insufficient_evidence", medium: summary, high: summary, reasons: [reason] };
}
