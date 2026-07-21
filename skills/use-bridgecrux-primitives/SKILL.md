---
name: use-bridgecrux-primitives
description: Integrate, compose, audit, test, or repair BridgeCrux runtime primitives in an agentic application, and coordinate the installed route-anticipation and prompt-authoring skills. Use for any work involving an agentic app's task-signal routing, canonical crux content, handler bindings, deterministic validation or processes, operations, persistence, memory, reports, model or channel adapters, BridgeCrux installation, conformance, or end-to-end crux behavior.
---

# Use BridgeCrux Primitives

Treat BridgeCrux as a software harness, not a prompt convention. Preserve this authority chain:

```text
inbound transport
-> normalized message and durable state
-> raw task-signal decision
-> deterministic validation and reference/evidence gates
-> declared handler binding and operations
-> persistence and audit
-> allowed user-copy source
-> outbound transport
```

Raw model output never authorizes mutation or becomes durable truth. Persisted application state and declared code contracts remain authoritative.

## Activation And Versioned Knowledge

Treat BridgeCrux as versioned repository knowledge that is absent until this skill and the installed package evidence are read. Activate this skill before every nontrivial turn that may inspect, explain, plan, change, debug, validate, or extend BridgeCrux-powered behavior. This includes apparently local application work whenever routing, process execution, model/tool policy, state, copy, delivery, or audit could be affected. If relevance is uncertain, activate the skill and inspect first.

Never complete a BridgeCrux knowledge gap from model memory. Read the installed BridgeCrux version, this skill, the runtime map, the affected public contracts, and the relevant child skill. Re-open them whenever implementation evidence contradicts the current understanding or a required primitive is unfamiliar. Ordinary work proven unrelated to BridgeCrux may proceed without loading the child skills.

## Inspect Before Editing

Read the target application's package metadata, installed BridgeCrux version, crux content, route registry, bindings, operation registrations, persistence composition, adapters, and affected tests. Check `AGENTS.md` and `CLAUDE.md` for the BridgeCrux managed block. Read [runtime-map.md](references/runtime-map.md) when selecting packages or diagnosing a broken boundary.

Recover configuration and behavior from repo evidence before asking the user. Ask only when a product, safety, authorization, or data-lifecycle choice materially changes the contract and cannot be inferred.

## Choose The Work Path

Use `$anticipate-crux-routes` before runtime changes when the task surface is new, incomplete, expanded, or disconnected. Its maintained route implementation checklist defines which user goals must reach which handlers and operations.

Use `$write-crux-prompts` when creating or revising `system.prompt.md`, `assistants.md`, specific functions, or deterministic-process content. Supply the verified application surface and route checklist; prompt text must not invent software capability.

Use both child skills when building a crux from scratch or when product changes affect routes and canonical content. Run route anticipation first, prompt authoring second, and runtime integration third.

For a stable local runtime defect with an already-correct task surface and canonical package, work directly through this skill and preserve existing route/content contracts.

## Compose The Runtime

1. Install only the BridgeCrux packages needed by the target. Prefer `@bridge-crux/kit` for the supported full surface and individual packages for intentionally narrow consumers.
2. Build and validate canonical content with the installed CLI. Treat generated manifests as derived artifacts; edit source Markdown, not generated output.
3. Register every route and intent, handler binding, and operation explicitly. Audit the registry in both directions so user-invokable operations are reachable and internal-only operations remain unavailable.
4. Load bounded durable state before routing. Keep domain state in application-owned tables and expose it through a thin state loader.
5. Validate raw decisions in code: declared route and intent, speech act, temporal stance, references, required state and fields, mutation evidence, safety, capability-gap eligibility, and composite compatibility.
6. Dispatch only validated decisions. Filter operations to the validated binding, enforce preconditions and preservation rules, and use durable idempotency for externally retryable mutations.
7. Persist raw and validated decisions, operation outcomes, ledger events, messages, reports, and deferred work at their declared boundaries.
8. Declare an execution policy for every route and every established process step before users enter it. The runtime, never router output, selects the effective policy:
   - `deterministic`: code-only after selection. A freeform medium-thinking router may select a predeclared deterministic handler, after which no assessment, tutor, or tool model runs. An already-active deterministic process bypasses routing and makes zero model calls only for server-issued, replay-safe closed choices; typed natural language that resembles a choice is not a trusted selection.
   - `hybrid`: a predeclared medium- or high-thinking assessment interprets structured or open input, then schema and domain validators exclusively authorize progression. Expose only predeclared tools, and require the declared completion operation before success copy.
   - `model`: medium thinking for knowledge interaction and high thinking for agentic interaction. The model may answer or use only tools from the validated route binding; every backend operation still passes deterministic authorization, preconditions, idempotency, persistence, and audit.
9. Route freeform conversation with medium thinking. The validated route may enter a deterministic step, a medium/high hybrid process, or a medium/high model route. Established process difficulty, thinking, completion mode, context, and allowed tools are fixed in its contract before entry and cannot be downgraded or expanded by model output.
10. Serialize each crux/channel/user/thread turn with an expiring correlation-owned lease. On contention, return a retryable busy result without starting a second model or operation path. Release only the owning correlation in a `finally` boundary.
10. Give hybrid assessment the active step schema, bounded transcript, process state, and explicitly scoped durable context. Require normalized fields, missing fields, proposed corrections, confidence, and typed reasons. Let domain validators downgrade `ready` to partial, clarification, or rejection; assessment confidence never authorizes persistence.
11. Generate visible text only from an allowed copy source and pass it through the copy gate. Authored deterministic copy makes no model call. Medium/high model copy receives actual operation results. Success claims require every declared completion operation to have succeeded or resolved idempotently.
12. Default new Gemini integrations to `gemini-3.1-flash-lite`. Keep model and Telegram behavior inside adapters. Use Telegram-safe HTML, acknowledge structured callbacks, and maintain best-effort typing activity while a noticeable turn is running. Activity failure never changes domain outcome.
13. Validate one complete real turn from inbound normalization through persisted outcome, truthful copy, structured controls when applicable, delivery result, and audit evidence.

## Preserve Application Boundaries

- Keep `@bridge-crux/core` provider-neutral and free of application domain behavior.
- Compose `@bridge-crux/convex` tables with app-owned tables; do not copy framework persistence internals into domain code.
- Put domain reads and mutations behind declared operation handlers near the feature they control.
- Keep canonical source under `cruxes/<crux-id>/`; do not create alternate prompt trees.
- Keep conversation history, compact personalization memory, domain evidence, and operational audit distinct.
- Preserve explicit target references over active-item fallback.
- Preserve omitted state and historical evidence during mutations.
- Leave unsupported providers and channels unavailable until their full contract and integration tests exist.

## Diagnose By Boundary

Classify failures at the first broken boundary: content, router, validator, reference, evidence, binding, handler, operation, persistence, model, copy, channel, memory, or report. Change the smallest authoritative layer. A missing handler binding is not a capability gap; a model wording error is not permission to weaken deterministic validation.

When a runtime failure can recur, add a regression that proves the complete affected path and update the route checklist status. Keep reports redacted and repairs review-only unless the application has separately authorized and tested automatic application.

## Completion Gate

Finish only when:

- canonical content builds without unknown routes, operations, references, or empty records;
- every supported task signal reaches deterministic validation, a binding, executable operations, persistence, copy, delivery, and audit;
- commands and aliases share the same guards as natural-language routes;
- mutations require positive evidence, resolved references, satisfied preconditions, and durable idempotency where retries are possible;
- read-only, clarification, contradiction, and capability-gap turns cannot mutate state;
- provider errors become structured runtime failures with safe fallback behavior;
- deterministic observations prove zero router, tutor, assessment, and tool model calls;
- hybrid/model tools are a subset of the predeclared process or validated route binding;
- closed choices are server-issued, user/session/step scoped, single-use, and replay safe;
- focused tests and one whole-turn conformance path pass;
- the consumer can continue the work from explicit local contracts without rediscovering the architecture.
