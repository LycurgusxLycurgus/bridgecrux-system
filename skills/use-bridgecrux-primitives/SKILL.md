---
name: use-bridgecrux-primitives
description: Integrate, compose, audit, test, update, or repair BridgeCrux runtime primitives and coordinate the route-anticipation and prompt-authoring skills. Use for any work involving a crux's capability catalog, cross-surface behavior, routing, execution policies, handlers, operations, persistence, processes, generated controls, model/tool behavior, channels, installation, conformance, or end-to-end agentic-app behavior.
---

# Use BridgeCrux Primitives

BridgeCrux is a software harness and versioned repository knowledge, not a prompt convention or built-in model memory. Activate this skill before every nontrivial turn that may affect BridgeCrux-powered behavior. Read the installed version, [runtime-map.md](references/runtime-map.md), affected public contracts, canonical crux content, and relevant child skill. Re-open them whenever evidence exposes a knowledge gap; never fill one from memory.

Preserve this authority chain:

```text
inbound transport
-> normalized message and durable state
-> compact task-signal decision for user-authored text
-> deterministic validation and reference/evidence gates
-> attached capability and derived handler/operation binding
-> authorized operations, persistence, and audit
-> truthful copy gate
-> outbound transport
```

Raw model output never authorizes mutation or becomes durable truth.

## Choose The Work Path

- Use `$anticipate-crux-routes` first when capabilities or surfaces are new, changing, incomplete, duplicated, contradictory, or disconnected. It owns semantic parity, compact routes, route-local intents, routing evaluation, and the all-route/all-surface simulation.
- Use `$write-crux-prompts` when schema-3 configuration, system content, assistant routing content, specific functions, processes, onboarding, style, or product invariants change.
- Use both in that order for a new crux or product-surface change, then return here for runtime integration and whole-turn validation.
- For a stable runtime defect with correct capability and content contracts, work directly through this skill.

## Inspect Before Editing

Read the target package metadata, BridgeCrux version, schema-3 content, generated capability surface, route/capability registry, operations, persistence composition, adapters, installed-skill state, managed instructions, and affected tests. Recover facts autonomously; ask only when an unresolved product, authorization, safety, or data-lifecycle choice would materially change the contract.

## Compose One Agentic Application

1. Create one canonical capability catalog. Derive routes, handler bindings, operation allowlists, execution policies, copy/audit sources, and surface mappings from it. Never maintain separate “agent features” and “app features.”
2. Give every public capability semantic parity through conversation, generated headless entrypoints, and every declared UI/channel surface. Presentation may differ; handler, operation authority, durable state, and result semantics may not.
3. Keep routes coarse and intents route-local. Send only compact route/intent discriminators to the router—not lifecycle, persistence, or UI implementation detail.
4. Load bounded durable state before routing. Every user-authored textual turn uses the predeclared freeform router, medium by default. High routing requires a passed medium-vs-high comparison evaluation.
5. Validate raw decisions in code: route/intent, attached capability, speech act, time, references, required state/fields, mutation evidence, safety, composite compatibility, and handler binding.
6. Enforce the capability or active process execution policy; router/model output cannot downgrade or expand it:
   - `deterministic`: code only after routing. An active step bypasses routing only for a server-issued, replay-safe closed choice scoped to user/session/process/step. It makes zero router, tutor, assessment, and tool-model calls. Typed text routes normally.
   - `hybrid`: high-thinking interpretation or generated procedural UX with only declared tools. Schema/domain validation alone authorizes progression and persistence.
   - `agentic`: medium for knowledge-only conversation; high for complex work or any tool use. Tools are limited to the validated capability.
7. Accept generated controls only as validated `InteractionPlan`s with a declared hybrid capability, two to four bounded channel-safe options, expiry, and free-text continuation. Selection supplies evidence but never mutation authority.
8. Return operation plans from handlers. The executor enforces allowlists, permissions, preconditions, preservation, idempotency, persistence, and ledger/audit events.
9. Persist raw and validated decisions, operation results, messages, reports, interactions, preferences, and deferred work at their declared boundaries. Serialize each crux/channel/user/thread turn with an expiring correlation-owned lease.
10. Generate visible text only from an allowed source and gate success claims against actual required-operation outcomes. Apply persisted `casual` or `pragmatic` style without changing truth, authority, safety, or outcome.
11. Keep provider/channel behavior in adapters. New Google integrations use exact `gemini-3.5-flash-lite`, explicit medium/high thinking, 65,536 maximum output tokens, BridgeCrux safety settings, and no temperature/top-p/top-k. Telegram uses safe HTML, a shared callback codec, early acknowledgement, and refreshed best-effort typing activity.
12. Enforce onboarding parity, channel affordances, saved-artifact lifecycle, destructive confirmation, provenance/completeness/order/default/auth/hosting invariants, and explicit unsupported-execution reporting.

## Preserve Boundaries

- Keep `@bridge-crux/core` provider-neutral and application-domain-free.
- Compose `@bridge-crux/convex` tables with app-owned state; put domain behavior behind declared operations near its feature.
- Edit canonical source under `cruxes/<id>/`, not generated artifacts.
- Keep conversation history, personalization memory, domain evidence, operational audit, and model transcripts distinct.
- Preserve explicit references over active-item fallback, and omitted state/history during mutations.
- Leave unavailable providers, channels, capabilities, and automatic repairs unavailable until their full contract and tests exist.

## Diagnose And Validate

Classify the first broken boundary: capability/surface, content, router, validator, reference/evidence, binding, handler, operation, persistence, model, copy, channel, interaction, preference, memory, or report. Repair the narrowest authority and add the failure to the maintained simulation.

Finish only when:

- schema-3 content builds and its generated capability/headless artifacts are current;
- every public capability has semantically equivalent conversation, headless, and declared-surface paths;
- every route/intent attaches one capability and executable handler binding;
- deterministic choices prove zero model calls and replay-safe scope; typed text proves router use;
- hybrid/agentic thinking and tools exactly match their fixed policies;
- operations, persistence, truthful copy, delivery, activity, and audit are proven together;
- duplicate/contradiction and medium-vs-high routing evaluations pass;
- one real-persistence all-route/all-surface regression passes;
- install/update/doctor behavior and the relevant consumer migration are documented.
