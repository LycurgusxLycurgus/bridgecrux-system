# Authoring A Crux

Use `$use-bridgecrux-primitives` as the coordinator. BridgeCrux knowledge is versioned: read the installed skills and contracts instead of relying on model memory.

## 1. Define One Capability Surface

Run `$anticipate-crux-routes`. Begin with user outcomes, then reconcile product UI, conversation, channels, backend operations, processes, jobs, durable artifacts, and a generated headless surface.

```text
user outcome
-> one capability
-> one route-local intent
-> one handler + authorized operations
-> one durable semantic result
-> conversation + headless + every declared surface
```

Routes are coarse domains; intents are sub-routes. Collapse semantic duplicates and overlapping aliases. A UI control, command, or backend operation that is not represented must be deliberately internal, intentionally unavailable, or a typed gap.

Maintain one checklist and one real-persistence all-route/all-surface simulation. A route label or mocked success is not proof of capability parity.

## 2. Write Schema-3 Canonical Content

Run `$write-crux-prompts`. It authors:

- `crux.config.json`: compact routes, capabilities, surfaces, fixed execution, models, communication, onboarding, channel affordances, invariants, memory, gaps, and feedback;
- `system.prompt.md`: product identity, scope, durable truth, boundaries, style, copy, and capability-gap behavior;
- `assistants.md`: compact hierarchical router and raw-decision contract;
- `specific-functions/*.md`: verified domain handlers, state, operations, evidence, references, errors, audit, and copy;
- process files: established deterministic or hybrid step contracts.

Prompt text cannot create missing software. Keep facts in one authoritative file and reference them rather than duplicating them.

## 3. Register Runtime Contracts

Construct one `RouteRegistryDefinition` containing surfaces, routes with route-local intents, and capabilities. Derive bindings with `HandlerBindingRegistry.fromDefinition`; do not hand-maintain a second feature registry.

For each capability:

1. register its controller;
2. register every authorized operation/tool adapter;
3. expose application state through the bounded state loader;
4. provide reference candidates, evidence policies, mutation classes, and composite rules;
5. map conversation, headless, and all configured UI/channel entrypoints to the same semantics;
6. declare lifecycle and destructive-action behavior where needed.

## 4. Fix Execution Before Entry

| Mode | Use | Thinking/tools |
| --- | --- | --- |
| deterministic | Code path or active closed authored choice | zero model calls after entry; no tools |
| hybrid | Open/composite interpretation or dynamic procedural choices | high; declared tools only |
| agentic | Free explanation/planning/execution | medium for knowledge-only; high for complex or any tools |

Every user-authored text turn routes at medium by default. An active deterministic choice may bypass routing only after durable user/session/process/step/expiry/option/replay validation. Typed text routes normally.

Generated procedural UX is a validated hybrid `InteractionPlan`: two to four contextual options, channel-safe IDs, free-text continuation, bounded expiry, and no mutation authority. Code validates and issues it; selection is evidence for the normal capability path.

Use `bridgecrux evaluate-routing` on a representative corpus before selecting high router thinking.

## 5. Protect State And Copy

Models never authorize effects. Operations enforce references, ownership, permissions, preconditions, preservation, idempotency, persistence, and audit. Success copy must cite actual required-operation outcomes.

Saved artifacts declare create → persist → acknowledge → rediscover → reopen → archive/delete. Destructive behavior adds server-issued confirmation, ownership, expiry, single use, post-outcome state, and cross-surface regression.

Persist the `casual` or `pragmatic` communication preference when user-selectable. Style changes wording only; facts, authority, safety, and outcomes remain identical.

## 6. Build And Prove

```bash
npx bridgecrux validate --root cruxes/<crux-id> --operations operations.json
npx bridgecrux build --root cruxes/<crux-id> --operations operations.json --out generated/<crux-id>
npx bridgecrux evaluate-routing --cases routing-cases.json --observations routing-observations.json
npx bridgecrux doctor --project .
```

Then run one acceptance block covering:

- every capability, route, intent, handler, operation, and surface;
- representative, ambiguous, correction, reference, unsupported, and conversation turns;
- deterministic callback zero-model behavior and typed-text routing;
- exact hybrid/agentic thinking and tools;
- generated control encode/decode/acknowledge/consume behavior;
- real in-memory persistence, idempotency, copy, activity, delivery, and audit;
- onboarding parity, communication style, lifecycle, destructive actions, and product invariants;
- duplicate and contradiction audit with zero unexplained findings.

If the block fails, repair the first broken authority and rerun the same complete block.
