import { v } from "convex/values";

export const targetReferenceValidator = v.object({
  raw: v.string(),
  kind: v.optional(v.string()),
  persistedId: v.optional(v.string()),
  confidence: v.number(),
});

export const rawTaskSignalValidator = v.object({
  route: v.string(),
  intent: v.string(),
  confidence: v.number(),
  speechAct: v.union(
    v.literal("question"),
    v.literal("announcement"),
    v.literal("proposal"),
    v.literal("permission"),
    v.literal("correction"),
    v.literal("confirmation"),
    v.literal("execution"),
    v.literal("other"),
  ),
  temporalStance: v.union(v.literal("past"), v.literal("present"), v.literal("future"), v.literal("hypothetical"), v.literal("unclear")),
  targetReferences: v.array(targetReferenceValidator),
  stateMutationCandidate: v.string(),
  mutationEvidence: v.union(v.literal("positive"), v.literal("insufficient"), v.literal("negative")),
  safetyFlag: v.union(v.literal("none"), v.literal("possible"), v.literal("urgent")),
  handlerTarget: v.optional(v.string()),
  extracted: v.any(),
  anticipatedRoute: v.optional(v.string()),
  capabilityGap: v.optional(v.string()),
  capabilityGapType: v.optional(v.string()),
  reason: v.string(),
});

export const operationResultValidator = v.object({
  operationId: v.string(),
  status: v.union(v.literal("succeeded"), v.literal("failed"), v.literal("skipped"), v.literal("duplicate")),
  persistedIds: v.optional(v.array(v.string())),
  output: v.optional(v.any()),
  error: v.optional(
    v.object({
      status: v.number(),
      code: v.string(),
      message: v.string(),
      details: v.optional(v.any()),
      retryable: v.optional(v.boolean()),
    }),
  ),
});
