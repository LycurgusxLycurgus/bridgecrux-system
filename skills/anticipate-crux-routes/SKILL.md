---
name: anticipate-crux-routes
description: Create, audit, complete, simulate, and expand the task-signal surface and route implementation checklist for a BridgeCrux or agentic application. Use when starting a crux, translating an existing UI or backend into agent routes, reviewing whether routes reach handlers and software operations, checking route duplication or contradiction, updating a crux after new features, investigating unhandled requests, or preparing BridgeCrux primitive extraction.
---

# Anticipate Crux Routes

Find missing router coverage from the application that actually exists. Do not brainstorm arbitrary chatbot features.

## Required Inputs

Read the smallest sufficient set:

1. Existing UI, wireframes, menus, command surfaces, screenshots, product notes, or a statement that no UI exists yet.
2. Router route and intent types plus router prompt/rules.
3. Turn controller or dispatch order.
4. Backend queries, mutations, actions, jobs, and channel operations.
5. Deterministic-process states and allowed transitions.
6. Domain-specific function declarations and canonical content.
7. Existing tests, router decisions, reports, and capability gaps when available.
8. The bounded transcript window delivered separately to the router and user-facing agent.

Use [gap-taxonomy.md](references/gap-taxonomy.md) to classify findings.

## Audit Workflow

### 0. Build The Pre-Router UI Flow

Start with the user interface, even when the product is chat-first.

If a UI exists, reduce it to a pre-router flow: screens, panels, menus, controls, submitted fields, confirmation states, empty states, history views, destructive actions, and recovery paths. Treat every meaningful UI action as a candidate user goal that the agent may need to execute conversationally on the user's behalf.

If no UI exists, create a minimal no-CSS HTML sketch and a pre-router flow from the domain, backend operations, deterministic processes, and user-facing channel. The HTML sketch is not a design deliverable. It is a task-surface instrument: it should expose every menu, form, toggle, dropdown, checklist, history panel, and action button a plain application would need so router coverage can be audited from concrete affordances instead of imagination.

The pre-router flow must separate:

- read-only inspection;
- reversible edits;
- irreversible or high-cost mutation;
- deterministic process progression;
- history and correction;
- scheduled/background behavior;
- unsupported but visible future affordances.

Only after this UI-to-flow pass should route anticipation begin. A missing route is stronger when a reasonable UI would need the same action.

Store the route implementation checklist inside the pre-router flow. Treat it as a maintained contract rather than a one-time audit result.

### 1. Build The Operation Inventory

List each real application operation and mark it:

- user-invokable through natural language;
- internal-only by design;
- scheduled/background;
- missing an agent binding;
- missing entirely.

Do not infer a route from a function name alone. Read its contract, preconditions, state effects, and output.

Reconcile the inventory in both directions. Map every UI or conversational action to runtime execution, then map every user-invokable backend operation, command alias, hidden shortcut, scheduled action, and tool declaration back to a deliberate task-surface row. A hidden command must obey the same state guards as its natural-language route; treat any bypass as a regression.

### 2. Build The Router Coverage Matrix

For every declared route and intent, identify:

- handler or deterministic branch;
- required state;
- read/write effect;
- source of user-visible copy;
- audit record;
- failure/recovery path.

Mark routes that only render UI when the intent requires mutation, intents accepted by the router but ignored by dispatch, and tools that exist but cannot be reached naturally.

Use the audit-only defect labels from the gap taxonomy for construction failures that should be repaired before runtime: `surface_omission`, `guard_divergence`, and `composite_coverage`. Do not emit them as capability gaps to users.

A correctly recognized route is only half coverage. Verify that dispatch reaches the promised operation. If the router classifies a turn as a supported mutation but the handler falls through to a generic renderer, classify the finding as `add_handler_binding`. Do not let this become a runtime capability gap unless no existing route, intent, state contract, or backend operation can truthfully execute it.

### 2.1 Audit Duplicates And Contradictions

Run one static reconciliation across router instructions, route and intent types, dispatch order, handler bindings, operations, aliases, fallbacks, thinking policy, and tests. Report:

- duplicate routes or intents that represent the same user goal and state transition;
- overlapping utterance or guard conditions that can select different handlers;
- contradictory mutation, reference, permission, preservation, or confirmation rules;
- routes declared in prompts or types but absent from dispatch, and dispatch branches absent from canonical declarations;
- aliases, commands, or tools whose guards differ from their natural-language path;
- broad fallbacks that shadow a specific route or turn extraction failure into an unrelated renderer;
- chat paths that expose tools or high-cost mutations, and agentic paths that can be downgraded from required high thinking by model suggestion;
- tests that encode mutually incompatible expected routes for the same state and signal.

Resolve findings at the narrowest source of truth. Merge semantic duplicates when their contracts are identical. Preserve separate routes only when state bundle, authorization, operation, audit meaning, or user recovery genuinely differs, and make priority explicit. Finish with zero unexplained duplicates or contradictions.

### 2.2 Maintain The Route Implementation Checklist

Create one stable checklist row for every user action, scheduled event, deterministic transition, correction path, history path, and recovery action supported or exposed by the task surface. Record:

- stable path id;
- task surface and user goal;
- task signal, route, and intent;
- state preconditions and reference scope;
- dispatch branch and handler;
- backend query, mutation, action, job, or external operation;
- read/write effect and validation boundary;
- user-copy source and channel delivery path;
- router decision, ledger, report, or other audit evidence;
- regression test or production trace;
- implementation status and last verification evidence.

Decompose composite controls before assigning status. A generic edit, manage, settings, history, or lifecycle row is incomplete when its individual fields or actions follow different extractors, handlers, preservation rules, permissions, or failure paths. Give those child paths stable rows so one working field cannot hide another disconnected mutation.

For every mutation row, record what omitted state and historical evidence must be preserved. For every read-only selector or preview, state explicitly that it performs no transition. This keeps task-surface equivalence from turning inspection controls into unauthorized progression.

Use these statuses consistently:

- `missing`: a required path has no complete executable contract;
- `designed`: the contract exists but implementation is incomplete;
- `implemented_unverified`: code appears connected but the end-to-end path has not been proven;
- `verified`: route, dispatch, operation, persistence, response, and audit behavior have been proven together;
- `regressed`: a previously verified path failed and requires repair;
- `intentionally_unavailable`: the task surface deliberately excludes the operation and records the reason.

Mark a path `verified` only after checking the full chain from task signal through persisted result and user-visible response. A router label, handler name, backend function, or isolated unit test is insufficient by itself.

When creating a crux, derive the first checklist from the UI/pre-router flow and operation inventory. During an audit, revalidate existing rows instead of trusting old status. After an app update, diff the UI, operations, states, and deterministic processes against the checklist, add new paths, update changed contracts, and mark broken paths `regressed` without deleting their history.

### 2.3 Run One All-Route Simulation

Create one table-driven regression test that simulates the complete declared task surface in a single test block. Give every route and intent at least one representative turn in its valid state, then include boundary rows for ambiguous extraction, missing fields, explicit prior-item references, conflicting signals, aliases, deterministic-process state, unsupported execution, and ordinary knowledge-only chat.

Each row must assert the raw and validated route, thinking policy, allowed tools, handler, operation or deliberate no-op, mutation boundary, persistence effect, copy source, delivery result, and audit evidence. Run every row through the real router-to-controller path rather than testing prompt text alone. The test must fail when a route is unreachable, shadowed, contradictory, connected to a generic fallback, or allowed to claim an unpersisted effect.

Keep this as one maintained route-surface simulation so new routes cannot be added without becoming visible beside all existing routes. Focused unit tests may supplement it; they do not replace it.

### 3. Apply Bounded Deduction

Generate candidates only from these structural pressures:

- **UI-action equivalence:** every meaningful UI control should have either a natural-language route, a deliberate internal-only reason, or a documented missing capability.
- **Lifecycle symmetry:** inspect, start, continue, pause, resume, complete, reopen, archive when the domain lifecycle supports them.
- **Scope symmetry:** current item, named item, completed items, all items, and filtered history when stored data supports those scopes.
- **Mutation/read symmetry:** if users can create or change durable state, consider inspect, correct, and safe reversal.
- **Handler-binding symmetry:** if a UI exposes "view/correct saved state" and a backend mutation already exists, the router must reach that mutation through a handler; a generic settings/status render is a missed binding, not an unsupported feature.
- **Scheduled-event symmetry:** reminders imply inspect schedule, change schedule, skip once, pause, and explain what will happen when supported by the scheduler.
- **Evidence symmetry:** submitting evidence implies inspect evidence, append correction, distinguish target item, and recover from misattachment.
- **Error symmetry:** failures imply retry, status, report, recovery, and escalation where underlying operations exist.
- **Multi-signal composition:** determine whether one message can legitimately require more than one existing handler.
- **Channel equivalence:** every important command or UI action should have a natural-language task signal.
- **Permission symmetry:** if the agent can read a state but not mutate it, do not propose mutation without a backend contract.
- **Deferral symmetry:** when a sequential item can be blocked temporarily, inspect whether it can be deferred without being treated as completed or replaced.
- **Reference precedence:** explicit references to a named or prior item must override the current-item default for inspection, correction, and evidence collection.
- **Conversation continuity:** questions, explanations, and alternative-seeking should remain conversational unless the user explicitly requests an unsupported state change.
- **Loop resistance:** placeholder gap values, stale route metadata, and recovery suggestions must not trigger the same gap repeatedly.

Stop deduction when there is no user goal, state transition, backend operation, recurring trace, or domain requirement supporting the candidate.

### 4. Classify The Gap Layer

For each candidate, identify exactly one primary layer:

- software capability;
- task-signal route;
- intent reading;
- field extraction;
- state contract;
- tool binding;
- knowledge/content;
- channel interface;
- external integration.

Secondary layers may be noted, but do not collapse every problem into "missing route."

### 5. Decide The Disposition

Use one:

- `already_covered`: existing route and handler solve it.
- `strengthen_existing_intent`: same system area, missing or weak intent.
- `add_route`: distinct state bundle, handler, audit meaning, or user surface.
- `add_handler_binding`: backend operation exists but router cannot execute it.
- `build_software_first`: no safe backend capability exists.
- `observe`: plausible but insufficient evidence.
- `reject`: speculative, unsafe, redundant, or domain-incoherent.

Prefer strengthening an existing intent over adding a route. Prefer building software before exposing a route that cannot execute.

## Output Contract

Produce:

1. **Pre-router UI flow:** screens or panels, user actions, submitted fields, backend operation, router route/intent, and gap status.
2. **HTML task-surface sketch:** minimal no-CSS HTML when no concrete UI exists or when the UI needs to be made explicit for audit.
3. **Route implementation checklist:** maintained inside the pre-router flow with one row per complete backend-agent communication path and explicit verification status.
4. **Duplicate/contradiction audit:** every overlap or conflict, its authoritative resolution, and any deliberate distinction.
5. **All-route simulation:** one table-driven test covering every route/intent and the shared boundary cases.
6. **Coverage summary:** operations, routes, intents, and orphaned bindings.
7. **Candidate table:** user need, evidence, current handling, primary gap type, recommendation, mutation effect, priority, confidence.
8. **Required changes:** exact route/intent/handler/tool/schema/test changes for accepted candidates.
9. **Rejected candidates:** concise reason they should not be added.
10. **Runtime gap guidance:** which unresolved candidates should emit a typed capability-gap report.
11. **Fluidity review:** transcript visibility, false-positive gap risk, stale metadata, fallback loops, and whether read-only questions are being mistaken for executable requests.
12. **Root-cause generalization:** the smallest universal contract change that prevents the observed failure family, not only the literal transcript.

Priority:

- `P0`: wrong or unsafe mutation, data loss, privacy/safety failure.
- `P1`: common goal blocked or state corrupted.
- `P2`: important inspection, correction, or control missing.
- `P3`: useful convenience with a valid operation surface.

## Validation

Before accepting a candidate, verify:

- A realistic user goal exists.
- The goal is visible in the UI/pre-router flow or follows from an existing backend/domain operation.
- The candidate is not already representable by a better intent.
- State preconditions can be validated.
- The handler can be implemented or explicitly marked software-first.
- User copy can state the result truthfully.
- Tests can prove routing, mutation boundaries, and audit output.
- Every required path has a checklist row, and every `verified` row cites end-to-end evidence.
- UI-to-runtime and runtime-to-UI reconciliation includes commands, shortcuts, tools, jobs, and background actions.
- Composite controls are split wherever fields or lifecycle actions have distinct execution contracts.
- Hidden aliases preserve the same state and mutation guards as natural-language routes.
- New or changed UI, operations, states, and deterministic processes have been reconciled with the checklist.
- The static audit reports zero unexplained duplicate or contradictory routes, guards, bindings, policies, and expectations.
- One table-driven regression test simulates every declared route and intent through validation, execution or no-op, copy, delivery, and audit.
- The candidate improves recovery without turning ordinary conversation into an error state.
- Capability-gap UX is reserved for explicit unsupported execution, never mere curiosity or a request for explanation.

Do not recommend a route solely because a user could theoretically ask for it.
