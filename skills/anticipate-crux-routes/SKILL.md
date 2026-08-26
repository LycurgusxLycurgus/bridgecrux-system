---
name: anticipate-crux-routes
description: Derive and audit a schema-3 BridgeCrux capability surface, compact hierarchical routes, semantic parity across conversation/app/headless surfaces, routing evaluation, and one real-persistence all-route simulation. Use when starting or converting a crux, changing product capabilities, consolidating routes and intents, finding duplicate or contradictory paths, investigating unhandled requests, or preventing drift between the agent and the application.
---

# Anticipate Crux Routes

Find missing capability and router coverage from the application that actually exists. Treat the agent, UI, channels, backend, and headless harness as presentations of one product—not separate feature inventories. Do not brainstorm arbitrary chatbot features.

BridgeCrux is versioned repository knowledge. Read the installed version, schema-3 contracts, and this skill before making framework claims. Use [gap-taxonomy.md](references/gap-taxonomy.md) for findings.

## Required Inputs

Read the smallest sufficient set:

1. Existing UI, wireframes, menus, command/chat surfaces, screenshots, product notes, and the generated or planned headless surface.
2. The schema-3 capability catalog, compact routes and route-local intents, router prompt/rules, and routing evaluation corpus.
3. Turn controller or dispatch order.
4. Backend queries, mutations, actions, jobs, and channel operations.
5. Deterministic-process states and allowed transitions.
6. Domain-specific function declarations and canonical content.
7. Existing tests, router decisions, reports, and capability gaps when available.
8. The bounded transcript window delivered separately to the router and user-facing agent.

## Audit Workflow

### 0. Build The Capability And Surface Flow

Start with user outcomes, then reconcile every presentation. For each outcome, create one capability row with its route-local intent, handler, operations, durable state, execution policy, copy/audit authority, conversation entrypoint, headless entrypoint, and every UI/channel entrypoint.

If a UI exists, reduce it to a pre-router flow: screens, panels, menus, controls, submitted fields, confirmation states, empty states, history views, destructive actions, and recovery paths. Treat every meaningful UI action as a candidate user goal that the agent may need to execute conversationally on the user's behalf.

If no UI exists, generate an inspectable headless capability surface first. A minimal no-CSS HTML sketch may supplement it when spatial states or controls need review; it is a task-surface instrument, not a design deliverable.

The pre-router flow must separate:

- read-only inspection;
- reversible edits;
- irreversible or high-cost mutation;
- deterministic process progression;
- history and correction;
- scheduled/background behavior;
- unsupported but visible future affordances.

Only after capability-to-surface reconciliation should route anticipation begin. Routes are coarse domains and intents are route-local sub-routes; neither is a second capability inventory.

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

For every declared route and intent, identify its single capability and:

- handler or deterministic branch;
- required state;
- read/write effect;
- source of user-visible copy;
- audit record;
- failure/recovery path.
- conversation, headless, and declared-surface bindings with equivalent semantics.

Mark routes that only render UI when the intent requires mutation, intents accepted by the router but ignored by dispatch, and tools that exist but cannot be reached naturally.

Use the audit-only defect labels from the gap taxonomy for construction failures that should be repaired before runtime: `surface_omission`, `guard_divergence`, and `composite_coverage`. Do not emit them as capability gaps to users.

A correctly recognized route is only half coverage. Verify that dispatch reaches the promised operation. If the router classifies a turn as a supported mutation but the handler falls through to a generic renderer, classify the finding as `add_handler_binding`. Do not let this become a runtime capability gap unless no existing route, intent, state contract, or backend operation can truthfully execute it.

### 2.1 Audit Duplicates And Contradictions

Run one static reconciliation across router instructions, route and intent types, dispatch order, handler bindings, operations, aliases, fallbacks, thinking policy, and tests. Report:

- duplicate routes or intents that represent the same user goal and state transition;
- duplicate route summaries, intent discriminators, capability outcome descriptions, aliases, handler/operation ownership, or surface affordances;
- overlapping utterance or guard conditions that can select different handlers;
- contradictory mutation, reference, permission, preservation, or confirmation rules;
- routes declared in prompts or types but absent from dispatch, and dispatch branches absent from canonical declarations;
- aliases, commands, or tools whose guards differ from their natural-language path;
- broad fallbacks that shadow a specific route or turn extraction failure into an unrelated renderer;
- model paths that expose tools outside their declared binding, and agentic paths whose predeclared thinking can be downgraded by model suggestion;
- missing or contradictory `deterministic`, `hybrid`, and `agentic` execution policies between canonical content, process steps, bindings, controllers, and tests;
- deterministic process steps that accept typed text, call a router/tutor/assessment model, expose tools, or consume choices without server-side user/session/step/replay validation;
- hybrid steps without predeclared difficulty, thinking, schema, domain validation, confirmation, scoped context, completion mode, or tool allowlist;
- conversational paths that can race the same user/thread because no expiring turn lease guards the whole execution boundary;
- model routes whose thinking or tools differ from the validated binding, and medium/high model-tool paths whose backend operations bypass deterministic authorization;
- tests that encode mutually incompatible expected routes for the same state and signal.
- public capabilities missing conversation, headless, or any declared product surface, or surfaces that reach a different handler, operation authority, durable state, or semantic result.

Resolve findings at the narrowest source of truth. Merge semantic duplicates when their contracts are identical. Preserve separate routes only when state bundle, authorization, operation, audit meaning, or user recovery genuinely differs, and make priority explicit. Finish with zero unexplained duplicates or contradictions.

### 2.2 Maintain The Route Implementation Checklist

Create one stable checklist row for every user action, scheduled event, deterministic transition, correction path, history path, and recovery action supported or exposed by the task surface. Record:

- stable path id;
- capability id and semantic outcome;
- task surface and user goal;
- task signal, route, and intent;
- state preconditions and reference scope;
- dispatch branch and handler;
- backend query, mutation, action, job, or external operation;
- read/write effect and validation boundary;
- execution mode, thinking level, model-call allowance, trusted-input source, completion mode, and allowed tools;
- user-copy source and channel delivery path;
- conversation, headless, and every declared UI/channel entrypoint;
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

Create one table-driven regression test that simulates the complete declared capability surface in a single test block. Give every route, intent, capability, and surface at least one representative turn or direct entry in its valid state, then include boundary rows for ambiguous extraction, missing fields, explicit prior-item references, conflicting signals, aliases, deterministic-process state, generated choices, unsupported execution, and ordinary knowledge-only chat.

Each row must assert the raw and validated route, attached capability, surface, execution mode, thinking policy, model-call count, allowed and used tools, trusted structured-input status, turn-lease result, handler, required completion operation or deliberate no-op, mutation boundary, persistence effect, copy source, activity/delivery result, and audit evidence. Run every row through real production functions and real in-memory persistence rather than testing prompt text or mocked operation success alone. The test must fail when a route or surface is unreachable, shadowed, contradictory, semantically divergent, connected to a generic fallback, uses a model on a zero-model deterministic process choice, exposes an undeclared tool, races a leased session, or claims an unpersisted effect.

Run the same representative freeform corpus at medium and high router thinking. Keep medium unless it fails the declared accuracy/consistency thresholds and high passes. Record evidence with `bridgecrux evaluate-routing`; do not escalate from preference or a single anecdote.

Keep this as one maintained route-surface simulation so new routes cannot be added without becoming visible beside all existing routes. Focused unit tests may supplement it; they do not replace it.

### 3. Apply Bounded Deduction

Generate candidates only from these structural pressures:

- **Capability-surface equivalence:** every public outcome must be reachable conversationally, headlessly, and through every declared presentation with the same handler/operation/durable semantics.
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

1. **Capability/surface flow:** user outcomes, screens or panels, chat/headless entrypoints, submitted fields, handler/operation, router route/intent, and gap status.
2. **HTML task-surface sketch:** minimal no-CSS HTML when no concrete UI exists or when the UI needs to be made explicit for audit.
3. **Route implementation checklist:** maintained inside the pre-router flow with one row per complete backend-agent communication path and explicit verification status.
4. **Duplicate/contradiction audit:** every overlap or conflict, its authoritative resolution, and any deliberate distinction.
5. **All-route/all-surface simulation:** one table-driven real-persistence test covering every capability, route/intent, presentation, and shared boundary case.
6. **Coverage summary:** operations, routes, intents, and orphaned bindings.
7. **Candidate table:** user need, evidence, current handling, primary gap type, recommendation, mutation effect, priority, confidence.
8. **Required changes:** exact route/intent/handler/tool/schema/test changes for accepted candidates.
9. **Rejected candidates:** concise reason they should not be added.
10. **Runtime gap guidance:** which unresolved candidates should emit a typed capability-gap report.
11. **Fluidity review:** transcript visibility, false-positive gap risk, stale metadata, fallback loops, and whether read-only questions are being mistaken for executable requests.
12. **Routing evaluation:** medium/high observations, thresholds, selected level, and evidence.
13. **Root-cause generalization:** the smallest universal contract change that prevents the observed failure family, not only the literal transcript.

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
- One table-driven regression test simulates every declared capability, route, intent, and surface through validation, execution or no-op, persistence, copy, delivery, and audit.
- Every active deterministic choice proves zero router, assessment, tutor, and tool model calls; typed text still routes. Every hybrid/agentic row proves its exact predeclared thinking and tool subset.
- Medium routing remains the default unless the recorded comparison corpus proves high is necessary.
- The candidate improves recovery without turning ordinary conversation into an error state.
- Capability-gap UX is reserved for explicit unsupported execution, never mere curiosity or a request for explanation.

Do not recommend a route solely because a user could theoretically ask for it.
