import type {
  ReferenceCandidate,
  ReferenceResolutionInput,
  ReferenceResolutionResult,
  ReferenceResolver,
  ResolvedReference,
  TargetReference,
} from "./contracts.js";

export class DefaultReferenceResolver implements ReferenceResolver {
  resolve(input: ReferenceResolutionInput): ReferenceResolutionResult {
    if (input.references.length === 0) {
      if (!input.allowActiveFallback || !input.activePersistedId) {
        return { status: "none", references: [], unresolved: [] };
      }
      const active = input.candidates.find((candidate) => candidate.persistedId === input.activePersistedId);
      if (!active) return { status: "missing", references: [], unresolved: [] };
      return {
        status: "resolved",
        references: [resolved({ raw: active.persistedId, confidence: 1 }, active, "active_fallback")],
        unresolved: [],
      };
    }

    const references: ResolvedReference[] = [];
    const unresolved: TargetReference[] = [];
    let ambiguous = false;

    for (const reference of input.references) {
      const matches = match(reference, input.candidates);
      if (matches.length === 1) {
        const candidate = matches[0];
        if (!candidate) continue;
        references.push(resolved(reference, candidate, reference.persistedId ? "explicit_id" : "alias"));
      } else {
        unresolved.push(reference);
        ambiguous ||= matches.length > 1;
      }
    }

    return {
      status: ambiguous ? "ambiguous" : unresolved.length > 0 ? "missing" : "resolved",
      references,
      unresolved,
    };
  }
}

function match(reference: TargetReference, candidates: ReferenceCandidate[]): ReferenceCandidate[] {
  if (reference.persistedId) {
    return candidates.filter((candidate) => candidate.persistedId === reference.persistedId);
  }
  const raw = normalize(reference.raw);
  return candidates.filter((candidate) => {
    if (reference.kind && candidate.kind && reference.kind !== candidate.kind) return false;
    return normalize(candidate.persistedId) === raw || candidate.aliases.some((alias) => normalize(alias) === raw);
  });
}

function resolved(
  reference: TargetReference,
  candidate: ReferenceCandidate,
  resolution: ResolvedReference["resolution"],
): ResolvedReference {
  return {
    raw: reference.raw,
    confidence: reference.confidence,
    ...(candidate.kind ? { kind: candidate.kind } : {}),
    persistedId: candidate.persistedId,
    resolution,
  };
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
