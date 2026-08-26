import type {
  HandlerBinding,
  RawRouterDecision,
  RawTaskSignalDecision,
  RouterDecisionValidator,
  RouterValidationInput,
  ValidatedRouterDecision,
  ValidatedTaskSignalDecision,
  ValidationStatus,
} from "./contracts.js";
import { DefaultCapabilityGapGate, normalizeGapMetadata } from "./capability-gaps.js";
import { DefaultEvidenceGate } from "./evidence.js";
import { DefaultReferenceResolver } from "./references.js";
import { HandlerBindingRegistry, RouteIntentRegistry } from "./registry.js";

export const VALIDATION_CODES = {
  DUPLICATE_SIGNAL: "duplicate_signal",
  UNKNOWN_ROUTE: "unknown_route",
  UNKNOWN_INTENT: "unknown_intent",
  SPEECH_ACT_INCOMPATIBLE: "speech_act_incompatible",
  TEMPORAL_STANCE_INCOMPATIBLE: "temporal_stance_incompatible",
  REFERENCE_AMBIGUOUS: "reference_ambiguous",
  REFERENCE_MISSING: "reference_missing",
  REQUIRED_STATE_MISSING: "required_state_missing",
  REQUIRED_FIELD_MISSING: "required_field_missing",
  EVIDENCE_INSUFFICIENT: "evidence_insufficient",
  EVIDENCE_CONTRADICTORY: "evidence_contradictory",
  MUTATION_NOT_ALLOWED: "mutation_not_allowed",
  MUTATION_EVIDENCE_MISSING: "mutation_evidence_missing",
  HANDLER_BINDING_MISSING: "handler_binding_missing",
  HANDLER_TARGET_CORRECTED: "handler_target_corrected",
  SAFETY_BLOCKED: "safety_blocked",
  GAP_ACCEPTED: "capability_gap_accepted",
  GAP_REJECTED: "capability_gap_rejected",
  STALE_METADATA_CLEARED: "stale_metadata_cleared",
} as const;

export class DefaultRouterDecisionValidator implements RouterDecisionValidator {
  readonly #references = new DefaultReferenceResolver();
  readonly #evidence = new DefaultEvidenceGate();
  readonly #gaps = new DefaultCapabilityGapGate();

  validate(input: RouterValidationInput): ValidatedRouterDecision {
    const routes = new RouteIntentRegistry(input.context.registry);
    const bindings = new HandlerBindingRegistry(input.context.bindings);
    const candidates = normalizeSignals(input.decision);
    const validated = candidates.signals.map((signal) =>
      this.#validateSignal(signal, input, routes, bindings),
    );
    const primary = validated[0];
    if (!primary) throw new Error("Router decision must contain a primary task signal");
    const additionalSignals = validated.slice(1);
    const compositeStatus = composite(validated, input);
    const primaryCodes = [...primary.validationCodes];
    if (candidates.duplicates > 0) primaryCodes.push(VALIDATION_CODES.DUPLICATE_SIGNAL);

    return {
      ...primary,
      validationCodes: primaryCodes,
      additionalSignals,
      compositeStatus,
    };
  }

  #validateSignal(
    raw: RawTaskSignalDecision,
    input: RouterValidationInput,
    routes: RouteIntentRegistry,
    bindings: HandlerBindingRegistry,
  ): ValidatedTaskSignalDecision {
    const codes: string[] = [];
    let status: ValidationStatus = "accepted";
    const routeExists = routes.hasRoute(raw.route);
    if (!routeExists) {
      codes.push(VALIDATION_CODES.UNKNOWN_ROUTE);
      status = "blocked";
    }

    const intent = routes.intent(raw.route, raw.intent);
    if (routeExists && !intent) {
      codes.push(VALIDATION_CODES.UNKNOWN_INTENT);
      status = "blocked";
    }

    if (intent && !intent.speechActs.includes(raw.speechAct)) {
      codes.push(VALIDATION_CODES.SPEECH_ACT_INCOMPATIBLE);
      status = mutationRequested(raw) ? "clarification" : "blocked";
    }
    if (intent && !intent.temporalStances.includes(raw.temporalStance)) {
      codes.push(VALIDATION_CODES.TEMPORAL_STANCE_INCOMPATIBLE);
      status = mutationRequested(raw) ? "clarification" : "blocked";
    }

    const referenceResult = this.#references.resolve({
      references: raw.targetReferences,
      candidates: input.context.referenceCandidates,
      ...(input.context.activeReferenceId ? { activePersistedId: input.context.activeReferenceId } : {}),
      allowActiveFallback: true,
    });
    if (referenceResult.status === "ambiguous") {
      codes.push(VALIDATION_CODES.REFERENCE_AMBIGUOUS);
      status = "clarification";
    } else if (referenceResult.status === "missing") {
      codes.push(VALIDATION_CODES.REFERENCE_MISSING);
      status = mutationRequested(raw) ? "clarification" : status;
    }

    if (intent) {
      if (intent.requiredState.some((state) => !input.context.availableState.includes(state))) {
        codes.push(VALIDATION_CODES.REQUIRED_STATE_MISSING);
        status = "blocked";
      }
      if (intent.requiredFields.some((field) => !present(raw.extracted[field]))) {
        codes.push(VALIDATION_CODES.REQUIRED_FIELD_MISSING);
        status = mutationRequested(raw) ? "clarification" : "blocked";
      }
    }

    const binding = bindings.resolve(raw.route, raw.intent);
    if (!binding) {
      codes.push(VALIDATION_CODES.HANDLER_BINDING_MISSING);
      status = "blocked";
    }

    let allowedMutation = false;
    if (mutationRequested(raw)) {
      const declared = intent?.mutationClasses.includes(raw.stateMutationCandidate) ?? false;
      const bound = binding?.allowedMutationClasses.includes(raw.stateMutationCandidate) ?? false;
      if (!declared || !bound) {
        codes.push(VALIDATION_CODES.MUTATION_NOT_ALLOWED);
        status = "blocked";
      } else if (raw.mutationEvidence !== "positive") {
        codes.push(VALIDATION_CODES.MUTATION_EVIDENCE_MISSING);
        status = "clarification";
      } else {
        allowedMutation = true;
      }
    }

    if (intent?.evidencePolicyId) {
      const policy = input.context.evidencePolicies[intent.evidencePolicyId];
      if (!policy) {
        codes.push(VALIDATION_CODES.EVIDENCE_INSUFFICIENT);
        status = "blocked";
        allowedMutation = false;
      } else {
        const assessment = this.#evidence.assess(
          {
            speechAct: raw.speechAct,
            temporalStance: raw.temporalStance,
            mutationEvidence: raw.mutationEvidence,
            extracted: raw.extracted,
            ...(referenceResult.references[0] ? { target: referenceResult.references[0] } : {}),
          },
          policy,
        );
        if (assessment.status === "contradictory") {
          codes.push(VALIDATION_CODES.EVIDENCE_CONTRADICTORY);
          status = "blocked";
          allowedMutation = false;
        } else if (!assessment.permitsCompletion) {
          codes.push(VALIDATION_CODES.EVIDENCE_INSUFFICIENT);
          status = "clarification";
          allowedMutation = false;
        }
      }
    }

    if (raw.safetyFlag === "urgent") {
      codes.push(VALIDATION_CODES.SAFETY_BLOCKED);
      status = "blocked";
      allowedMutation = false;
    }

    const hasGapMetadata = Boolean(
      normalizeGapMetadata(raw.anticipatedRoute) ||
        normalizeGapMetadata(raw.capabilityGap) ||
        raw.capabilityGapType,
    );
    let preserveGapMetadata = false;
    if (hasGapMetadata) {
      const gap = this.#gaps.assess({
        decision: raw,
        registry: input.context.registry,
        hasHandler: Boolean(binding),
        hasOperation: Boolean(binding?.operationIds.length),
        minimumConfidence: input.context.minimumGapConfidence,
        reportPersistable: input.context.reportPersistable,
      });
      preserveGapMetadata = gap.eligible;
      codes.push(gap.eligible ? VALIDATION_CODES.GAP_ACCEPTED : VALIDATION_CODES.GAP_REJECTED);
      if (!gap.eligible) codes.push(...gap.codes, VALIDATION_CODES.STALE_METADATA_CLEARED);
    }

    let validatedHandlerTarget = binding?.handlerId;
    if (binding && raw.handlerTarget !== binding.handlerId) {
      codes.push(VALIDATION_CODES.HANDLER_TARGET_CORRECTED);
      status = status === "accepted" ? "corrected" : status;
    }
    if (status === "blocked" || status === "clarification") {
      allowedMutation = false;
      if (!binding) validatedHandlerTarget = undefined;
    }

    return validatedSignal(raw, {
      capabilityId: intent?.capabilityId ?? "",
      status,
      codes,
      references: referenceResult.references,
      allowedMutation,
      validatedHandlerTarget,
      preserveGapMetadata,
    });
  }
}

function normalizeSignals(decision: RawRouterDecision): { signals: RawTaskSignalDecision[]; duplicates: number } {
  const signals: RawTaskSignalDecision[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const signal of [primary(decision), ...(decision.additionalSignals ?? [])]) {
    const signature = JSON.stringify([
      signal.route,
      signal.intent,
      signal.stateMutationCandidate,
      signal.targetReferences.map((reference) => reference.persistedId ?? reference.raw).sort(),
      signal.extracted,
    ]);
    if (seen.has(signature)) {
      duplicates += 1;
      continue;
    }
    seen.add(signature);
    signals.push(signal);
  }
  return { signals, duplicates };
}

function primary(decision: RawRouterDecision): RawTaskSignalDecision {
  const signal: RawRouterDecision = { ...decision };
  delete signal.additionalSignals;
  return signal;
}

function validatedSignal(
  raw: RawTaskSignalDecision,
  result: {
    status: ValidationStatus;
    capabilityId: string;
    codes: string[];
    references: ValidatedTaskSignalDecision["resolvedReferences"];
    allowedMutation: boolean;
    validatedHandlerTarget: string | undefined;
    preserveGapMetadata: boolean;
  },
): ValidatedTaskSignalDecision {
  const anticipatedRoute = result.preserveGapMetadata ? normalizeGapMetadata(raw.anticipatedRoute) : undefined;
  const capabilityGap = result.preserveGapMetadata ? normalizeGapMetadata(raw.capabilityGap) : undefined;
  return {
    capabilityId: result.capabilityId,
    route: raw.route,
    intent: raw.intent,
    confidence: raw.confidence,
    speechAct: raw.speechAct,
    temporalStance: raw.temporalStance,
    targetReferences: raw.targetReferences,
    stateMutationCandidate: raw.stateMutationCandidate,
    mutationEvidence: raw.mutationEvidence,
    safetyFlag: raw.safetyFlag,
    extracted: raw.extracted,
    reason: raw.reason,
    ...(raw.handlerTarget ? { handlerTarget: raw.handlerTarget } : {}),
    ...(anticipatedRoute ? { anticipatedRoute } : {}),
    ...(capabilityGap ? { capabilityGap } : {}),
    ...(result.preserveGapMetadata && raw.capabilityGapType ? { capabilityGapType: raw.capabilityGapType } : {}),
    validationStatus: result.status,
    validationCodes: result.codes,
    resolvedReferences: result.references,
    allowedMutation: result.allowedMutation,
    ...(result.validatedHandlerTarget ? { validatedHandlerTarget: result.validatedHandlerTarget } : {}),
  };
}

function composite(decisions: ValidatedTaskSignalDecision[], input: RouterValidationInput): ValidatedRouterDecision["compositeStatus"] {
  if (decisions.length === 1) {
    const first = decisions[0];
    return first?.validationStatus === "clarification" ? "clarification" : "single";
  }
  const accepted = decisions.filter((decision) => decision.validationStatus === "accepted" || decision.validationStatus === "corrected");
  if (accepted.length !== decisions.length) return accepted.length === 0 ? "clarification" : "partially_blocked";
  const result = input.context.compositeCompatibility?.(decisions) ?? "compatible";
  return result;
}

function mutationRequested(signal: RawTaskSignalDecision): boolean {
  return signal.stateMutationCandidate.trim().toLocaleLowerCase() !== "none" && signal.stateMutationCandidate.trim() !== "";
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

export function bindingForDecision(
  decision: ValidatedTaskSignalDecision,
  bindings: HandlerBinding[],
): HandlerBinding | undefined {
  return bindings.find((binding) => binding.route === decision.route && binding.intent === decision.intent);
}
