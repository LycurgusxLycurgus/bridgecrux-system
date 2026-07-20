---
name: write-crux-prompts
description: "Create or revise the canonical BridgeCrux prompt package for a crux: system.prompt.md, assistants.md, and specific-functions/*.md. Use when creating a crux from scratch, transforming an application into a crux, adding or changing task signals and routes, documenting the agent's frontend/backend harness, defining deterministic processes, or correcting drift between prompt content and executable application behavior."
---

# Write Crux Prompts

Create one coherent BridgeCrux prompt package grounded in the application that actually exists. The package must tell the user-facing agent what it is, what product it operates, what frontend and backend affordances it has, how it should help the user, how turns are routed, and which domain functions and deterministic processes are valid.

This skill authors canonical crux content. It does not invent backend capabilities, implement runtime primitives, or treat prompt text as a substitute for missing software.

## Required Inputs

Read the smallest sufficient set before writing:

1. The BridgeCrux standardized repo handoff or constitution supplied with the target repo.
2. Product purpose, target user, user journeys, domain vocabulary, and non-goals.
3. Existing UI, task-surface map, pre-router flow, commands, channel surfaces, or product requirements.
4. Backend schema, queries, mutations, actions, jobs, tools, external integrations, and their validation rules.
5. Current router, dispatch, handlers, state machines, memory behavior, reports, tests, and audit records when revising an existing crux.
6. Model and channel adapters, including formatting, transport, context-window, and tool-use constraints.
7. Safety, privacy, legal, authorization, and irreversible-action boundaries that apply to the product.
8. Existing canonical crux files when updating rather than creating.
9. The maintained route implementation checklist produced by `anticipate-crux-routes`, when available.

If the route implementation checklist does not exist and the task surface is not already explicit, use `anticipate-crux-routes` before finalizing `assistants.md`. Do not invent a route registry from product prose alone when executable surfaces can be inspected.

Inspect before asking the user. Ask only for missing domain intent, product boundaries, safety decisions, user-facing identity, or other choices that cannot be recovered from the repo.

## Output Contract

Create or revise exactly one canonical crux package:

```text
cruxes/<crux-id>/
  system.prompt.md
  assistants.md
  specific-functions/
    <domain-function>.md
    deterministic-processes.md  # only when deterministic processes exist
```

Do not create `general-functions/`. Harness-wide capabilities belong in `system.prompt.md`. Internal task-signal routing and operation policy belong in `assistants.md`. Domain knowledge, domain operations, and deterministic process definitions belong in `specific-functions/`.

Generated TypeScript, manifests, schemas, runtime code, tests, and adapters are outside this skill's canonical writing output. Run or request the installed content builder after authoring so generated artifacts can be validated separately.

The three surfaces form one contract:

- `system.prompt.md` defines identity, scope, global behavior, harness awareness, user-facing interaction, and safe use of available application capabilities.
- `assistants.md` defines task-signal judgment, route and intent registries, deterministic validation, dispatch expectations, tool authorization, audit behavior, and correction rules.
- `specific-functions/*.md` defines domain truth, function-local state and operations, evidence, references, preservation requirements, user guidance, and completion or recovery behavior.

Do not repeat the same rule across all three files. Place it at the narrowest authoritative surface and reference the concept from the others only when needed for execution.

## Authoring Workflow

### 1. Establish The Crux Contract

Before writing prose, produce a compact internal map of:

- crux identity and purpose;
- primary user and user jobs;
- supported and unsupported scope;
- frontend and channel surfaces;
- backend state and source-of-truth records;
- available read operations;
- available mutation operations;
- scheduled and background operations;
- deterministic processes and their state transitions;
- domain-specific functions;
- model roles;
- memory sources and exclusions;
- safety and authorization boundaries;
- user-copy sources;
- report and recovery behavior.

Every claimed capability must resolve to an existing operation, an explicitly planned runtime contract, or an intentionally unavailable state. Prompt text must not create false affordances.

### 2. Reconcile The Application Surface

Use the maintained route implementation checklist as the executable source for prompt coverage. Reconcile both directions:

```text
UI or conversational goal
-> route
-> intent
-> validation
-> handler
-> backend operation
-> persistence
-> user response
-> audit evidence
```

```text
command, tool, mutation, job, or recovery action
-> deliberate task surface
-> route and intent or internal-only status
-> shared guards
-> user-copy and audit contract
```

Do not mark a task signal supported because the router can name it. It is supported only when the complete path exists or the prompt clearly states that implementation is pending.

### 3. Write `system.prompt.md`

Use the layered construction of a serious agent system prompt, but include only rules and capabilities that belong to this crux. Do not copy provider-specific policies, unrelated tools, user biography, product examples, or accidental constraints from a reference system prompt.

The system prompt must make the agent understand both sides of the product:

- what the user experiences;
- what software harness the agent can operate;
- how the harness helps the user;
- which facts come from durable backend state;
- which actions require tools or handlers;
- which behavior remains conversational;
- how failures are surfaced and recovered.

Use this section architecture unless the product requires a clearer equivalent:

```md
---
name: <crux-id>-system
description: <one-sentence operating scope>
version: <content-version>
---

# <Crux Name> System Prompt

## Identity

## Purpose And Scope

## User And Interaction Surface

## Application Harness

## Frontend And Channel

## Backend State And Source Of Truth

## Available Capabilities

## Agent Behavior

## State Mutation And Authorization

## Memory

## Safety, Privacy, And Boundaries

## User-Facing Copy

## Failures, Reports, And Recovery

## Validation
```

Section requirements:

#### Identity

- Define the agent's user-facing role and operating stance.
- Define how it should reason about confusion, correction, uncertainty, and user momentum.
- Keep persona subordinate to product utility.
- Do not describe the agent as capable of actions the harness cannot perform.

#### Purpose And Scope

- State the user's real job and the crux's responsibility.
- State active scope and deliberate non-scope.
- Define what success looks like for an ordinary turn and for the overall user journey.

#### User And Interaction Surface

- Describe who the user is in product terms, not through speculative personal traits.
- Describe the actions the user can request naturally.
- Make natural language the primary interface unless the product explicitly requires another interaction mode.
- Treat commands and controls as aliases for the same guarded operations, not privileged bypasses.

#### Application Harness

- Explain that the agent operates an application, not only a conversation.
- Name the categories of state, tools, deterministic processes, domain records, reports, jobs, and channel affordances the agent can use.
- Explain the router/tutor/handler separation without exposing internal machinery in user copy.
- State that durable backend records override conversational inference.

#### Frontend And Channel

- Describe the visible UI or channel and its interaction constraints.
- Define formatting, length, attachment, latency, and recovery expectations that change user copy.
- Preserve parity between meaningful UI controls and natural-language actions.
- Do not place transport implementation details in domain guidance.

#### Backend State And Source Of Truth

- Identify which persisted records answer status, history, evidence, settings, progress, and active-work questions.
- Distinguish compact memory from domain history and operational audit records.
- State which identifiers are authoritative when transcript recency conflicts with persisted state.
- Define preservation expectations for partial updates and corrections.

#### Available Capabilities

- Describe app-wide harness capabilities and their user-facing meaning.
- Distinguish reads, reversible mutations, irreversible or high-cost mutations, scheduled work, and internal-only operations.
- Require successful operation results before claiming that state changed.
- Keep domain-specific execution details in `specific-functions/`.

#### Agent Behavior

- Use Best-Answer judgment: infer the user's real need, identify the material assumption that could make a direct answer wrong, choose the response that protects against the highest-cost failure, and pre-correct the likely shallow-answer failure.
- Answer directly when no operation is needed.
- Execute through the harness when an authorized operation is needed.
- Clarify only when missing information prevents a unique safe action.
- Preserve state when ambiguity could cause an incorrect mutation.

#### State Mutation And Authorization

- State that route classification does not authorize mutation.
- Require positive evidence, satisfied state preconditions, resolved references, allowed transitions, and an authorized handler before mutation.
- Distinguish topical mention, questions, announcements, proposals, permission requests, corrections, confirmations, and execution requests.
- Distinguish past or present evidence from future intention and hypothetical discussion.
- Require commands, shortcuts, and model tool calls to use the same guards as natural-language routes.

#### Memory

- Define what stable user information can become memory.
- Exclude tutor-authored claims, transient chat, raw history, secrets, and unsupported inference.
- Explain how users inspect, correct, or remove memory when the runtime supports it.
- Keep domain evidence in domain records rather than compact memory.

#### Safety, Privacy, And Boundaries

- Include only product-relevant boundaries.
- Separate refusal, adaptation, clarification, escalation, and human handoff behavior.
- Preserve useful product assistance after setting a boundary.
- Never copy unrelated safety policy from another agent or source application.

#### User-Facing Copy

- Define language, tone, formatting, terminology, and channel-native syntax.
- Keep route names, tool names, schemas, model names, debug language, and backend mechanics internal.
- Require truthful result copy based on persisted operation outcomes.
- Define deterministic copy as authored process text and conversational copy as high-thinking tutor output.

#### Failures, Reports, And Recovery

- Explain when a failure creates a report.
- Require calm user-facing recovery without implementation leakage.
- Distinguish application defects from genuine unsupported capability requests.
- Do not promise automatic repair unless a tested repair integration exists.

#### Validation

- Define the final response gate: correct task signal, truthful state, valid operation outcome, proper copy source, channel compatibility, safety compliance, and a clear next action or completion state.

### 4. Write `assistants.md`

Treat `assistants.md` as the crux's internal operating constitution. Its center is the Task-Signal Smart Router. Everything else exists to make router decisions executable, safe, auditable, and correctable.

Use this section architecture unless a smaller equivalent is clearer:

```md
---
name: <crux-id>-assistants
description: <task-signal, operation, and correction scope>
version: <content-version>
---

# <Crux Name> Assistant Behavior

## Task

## I/O

## Task-Signal Judgment

## Route And Intent Registry

## Task-Signal Smart Router

## Router Decision Contract

## Deterministic Decision Validation

## Reference Resolution

## Evidence And Authorization Gates

## Dispatch And Handler Binding

## Composite Turns

## Tool, Command, And Shortcut Parity

## Deterministic Processes

## Capability Gaps And Audit Defects

## Memory And Correction

## Reports And Recovery

## Validation Gate
```

#### Task And I/O

- Define the router's operational task in one paragraph.
- List the exact state bundle supplied to the router and tutor.
- Require the router and tutor to receive the same bounded recent-conversation window.
- State that persisted identifiers and domain records remain authoritative.
- Define router output as internal structured data and tutor output as user-visible copy.

#### Task-Signal Judgment

Require judgment from all relevant evidence:

- literal message;
- conversational function or speech act;
- temporal stance;
- current persisted state;
- explicit references;
- available operations;
- mutation effects;
- safety and authorization boundaries;
- recent conversation;
- known failure or correction evidence.

Require the router to distinguish:

- topic from requested action;
- route from intent;
- question from announcement;
- announcement from execution;
- proposal from authorization;
- explanation from permission;
- correction from replacement;
- confirmation from ambiguous assent;
- past or present evidence from future intention;
- explicit target from active-item fallback;
- route confidence from mutation-precondition confidence.

Mutation requires positive evidence and satisfied preconditions. Negative evidence, contradiction, unresolved reference, missing required fields, unsupported transition, or ambiguity must block mutation even when route confidence is high.

#### Route And Intent Registry

- Declare route names from this crux's actual task surface.
- Declare intents as conversational actions inside each route.
- Keep the universal router envelope stable while allowing route and intent names to be crux-defined.
- Prefer a stronger intent under an existing route when state, handler, audit meaning, and user surface remain the same.
- Add a route only when it selects a distinct state bundle, controller, audit meaning, or user-facing system area.
- Split composite controls into separate intents or paths when fields or lifecycle actions use different extraction, validation, preservation, permission, or failure rules.

#### Task-Signal Smart Router

Create a routing table derived from the maintained route implementation checklist. Use one stable row per executable task signal. Do not collapse independently guarded child paths into a generic row.

Minimum columns:

| Task signal | Route | Intent | State/reference preconditions | Mutation candidate | Deterministic validator | Handler/operation | User-copy source | Audit evidence |
|---|---|---|---|---|---|---|---|---|

Keep long rationale outside the table. The table is an executable index, not narrative documentation.

Route priority must protect against the highest-cost foreseeable failure. Define the product-specific precedence for safety, active deterministic processes, explicit mutations, evidence, reads, recovery, and free conversation.

#### Router Decision Contract

Use a universal semantic envelope with crux-declared route and intent values. Adapt field names to the installed runtime contract without weakening these semantics:

```json
{
  "route": "<declared-route>",
  "intent": "<declared-intent>",
  "confidence": 0,
  "needsHighThinking": true,
  "speechAct": "<question|announcement|proposal|permission|correction|confirmation|execution|other>",
  "temporalStance": "<past|present|future|hypothetical|unclear>",
  "targetReferences": [],
  "stateMutationCandidate": "<none-or-declared-mutation-class>",
  "mutationEvidence": "<positive|insufficient|negative>",
  "safetyFlag": "<none|possible|urgent>",
  "handlerTarget": "<declared-handler-or-empty>",
  "extracted": {},
  "anticipatedRoute": "",
  "capabilityGap": "",
  "capabilityGapType": ""
}
```

The router uses high thinking by default with `gemini-3.1-flash-lite` and returns JSON only, never user copy, never tool execution, and never direct persistence. Treat its `needsHighThinking` field as advisory escalation metadata: runtime policy keeps every agentic path at high thinking. Only explicitly declared knowledge-only chat may use medium thinking with no tools; deterministic authored process output uses no model call.

#### Deterministic Decision Validation

Define post-router code validation for every mutating or high-cost path. Validation must:

- reject undeclared route and intent values;
- verify current state and transition preconditions;
- resolve explicit references before active-item fallback;
- verify required fields and positive mutation evidence;
- reject stale or incompatible mutation metadata;
- clear anticipation and capability-gap metadata when validation changes the route or intent;
- downgrade ambiguous mutations to clarification or non-mutating tutor behavior;
- produce an auditable validated decision distinct from raw model output.

The validated decision, not raw router output, controls dispatch.

#### Reference Resolution

- Resolve explicit references against persisted identifiers and declared aliases.
- Let an explicit current or prior target control reads, evidence prompts, corrections, and completion.
- Use the active item only when no reference is identifiable.
- Use recent transcript to interpret language, not to override persisted identity.
- Preserve the active item when evidence or correction targets another record.

#### Evidence And Authorization Gates

- Define sufficient evidence from the domain function's actual completion contract.
- Treat preparation, intention, permission, future evidence, partial reporting, questions, and topical mentions as non-completion.
- Let one turn produce multiple validated operations when it contains independent sufficient signals.
- Preserve each operation's separate audit record and user result.
- Require irreversible or history-changing actions to meet their stronger authorization policy.

#### Dispatch And Handler Binding

- Map every validated route and intent to a real handler and operation.
- Treat a correct route connected to a generic renderer as incomplete binding.
- Require read routes to query authoritative domain state.
- Require mutation routes to execute before claiming success.
- Filter available tools after routing so a model cannot call unrelated mutations merely because they exist globally.
- Preserve omitted fields and historical evidence according to the operation contract.

#### Composite Turns

- Define which task signals can coexist in one user message.
- Do not discard one valid track because another route has higher dispatch priority.
- Execute compatible operations in deterministic order.
- Block or clarify incompatible operations.
- Produce copy that truthfully reports each completed and uncompleted effect.

#### Tool, Command, And Shortcut Parity

- Map every user-invokable command, hidden shortcut, tool declaration, scheduled action, and recovery action back to a deliberate task-surface row.
- Require aliases to share extraction, reference resolution, evidence thresholds, transition guards, preservation rules, and audit behavior.
- Mark operations internal-only when users must not invoke them.
- Treat divergent guards as an implementation defect, not a new user-facing capability gap.

#### Deterministic Processes

- Reference `specific-functions/deterministic-processes.md` when deterministic processes exist.
- State that code owns step progression and durable mutation.
- Allow the tutor to assess, normalize, explain, and request the smallest missing information.
- Preserve deferred items as pending rather than completed when the process contract permits deferral.
- Keep deferred items visible, excluded from progress, and completable later by explicit reference.
- Use deterministic authored copy for stable process surfaces and high-thinking tutor copy for interpretation, correction, and ambiguity.

#### Capability Gaps And Audit Defects

Runtime capability gaps are allowed only for explicit execution requests that remain unsupported after checking existing routes, intents, handlers, software operations, state contracts, and integrations.

Require:

- configured confidence threshold;
- non-mutating decision;
- anticipated route name;
- structured runtime gap type;
- open auditable report;
- truthful user copy;
- no stale placeholder metadata;
- no recovery wording that loops into the same gap.

Keep construction defects internal. Surface omissions, guard divergence, composite coverage, generic-renderer bindings, missing extractors, and disconnected tools must be repaired or tracked by the implementation checklist. They are not user-facing capability gaps.

#### Memory, Reports, And Correction

- Keep compact personalization memory separate from domain evidence and operational audit.
- Store only durable user-authored or user-confirmed facts according to the memory contract.
- Record router, validation, handler, operation, persistence, copy, and failure evidence needed for diagnosis.
- Convert recurring production failures into route, validator, content, binding, or regression corrections.
- Do not let tutor wording become user memory without acceptance evidence.

#### Validation Gate

A route is complete only when recognized task signal, deterministic validation, dispatch, handler, operation, persistence, user response, and audit evidence work together. Router output or an isolated unit test is insufficient proof.

### 5. Write `specific-functions/*.md`

Create one file per coherent domain concern. Keep knowledge and operation rules close to the function they govern. Split only when a file loses local comprehensibility or contains unrelated state and operation contracts.

Each specific-function file must define the domain truth needed to guide and execute that function. Use the installed content-builder schema when it is stricter. At minimum, declare:

```yaml
---
id: <stable-function-id>
kind: specific_function
title: <domain-native-title>
version: <content-version>
routes:
  - <declared-route>
intents:
  - <declared-intent>
tools:
  - <existing-tool-or-operation>
state_reads:
  - <authoritative-record>
state_writes:
  - <authorized-record>
---
```

Use only fields supported by the installed builder, adding required contract fields to the builder plan rather than silently dropping them from canonical content.

Use this body architecture as applicable:

```md
# <Function Title>

## Purpose And Scope

## Domain Contract

## Inputs And References

## State And Source Of Truth

## Allowed Operations

## Task Signals

## Validation And Authorization

## Evidence

## Preservation And Reversal

## Tutor Guidance

## Deterministic Copy

## Failure And Recovery

## Audit And Regression Contract
```

Requirements:

- Define the function's real user job and non-scope.
- Define required inputs, explicit references, defaults, and ambiguity handling.
- Identify authoritative domain records and distinguish them from compact memory.
- Declare reads, mutations, scheduled effects, and external effects.
- Define positive and negative task-signal evidence.
- Define field extraction and validation requirements.
- State which omitted fields remain unchanged.
- State which historical evidence remains preserved.
- State whether reversal, correction, supersession, reopening, or archival is supported.
- Define completion evidence and partial evidence behavior.
- Define user-visible copy source for stable and conversational states.
- Define report and recovery behavior for failed operations.
- Define the route-to-operation regression evidence required for verification.

Do not turn domain content into universal BridgeCrux vocabulary. Use the target product's precise language only inside its crux package.

### 6. Write `specific-functions/deterministic-processes.md` When Needed

Create this single file only when one or more deterministic processes exist. Do not create a top-level `deterministic-processes/` directory.

The file is the canonical process contract. It may contain multiple process blocks if the content builder supports repeated frontmatter. Each process must declare:

```yaml
---
id: <stable-process-id>
kind: deterministic_process
version: <content-version>
entry_routes:
  - <declared-route>
steps:
  - <stable-step-id>
state_reads:
  - <authoritative-record>
state_writes:
  - <authorized-record>
allows_deferral: <true-or-false>
---
```

Each process body must define:

- purpose;
- entry conditions;
- exit conditions;
- ordered steps;
- valid answer or action shapes;
- assessment states;
- normalization rules;
- state-transition rules;
- reference rules;
- evidence requirements;
- deferral behavior when allowed;
- preservation and reversal behavior;
- authored deterministic copy ids;
- high-thinking tutor responsibilities;
- report and recovery behavior;
- audit and regression evidence.

Use explicit process statuses supported by the runtime. A deferred element remains pending, retains reason and timestamp, does not count as complete, does not inflate progress, and can be completed later through explicit reference without replacing the active element.

### 7. Reconcile The Three Surfaces

Before validation, verify:

- Every harness-wide capability in `system.prompt.md` has a truthful runtime path or explicit unavailable boundary.
- Every route and intent in `assistants.md` exists in the route implementation checklist.
- Every mutating route has deterministic validation, a handler binding, an operation, preservation rules, and audit evidence.
- Every specific function is reachable through declared routes and intents or explicitly internal-only.
- Every tool named in canonical content exists and is authorized only for relevant validated routes.
- Every deterministic process referenced by `assistants.md` exists in `specific-functions/deterministic-processes.md`.
- Router and tutor use the same bounded recent-conversation window.
- Persisted references override active-item fallback and transcript recency.
- Domain history is read from domain records rather than compact memory.
- Commands and shortcuts cannot bypass natural-language guards.
- Composite turns preserve all compatible validated signals.
- Capability gaps exclude construction defects and ordinary conversation.
- User-visible copy never exposes internal route, model, tool, schema, prompt, or audit vocabulary.

Repair contradictions at the narrowest authoritative file. Do not resolve disagreement by duplicating another rule.

## Writing Constitution

- Write direct, executable instructions.
- State desired behavior affirmatively.
- Give every rule a clear trigger, action, scope, output effect, or quality gate.
- Keep one central deliverable: the canonical crux prompt package.
- Use constitution-like rules and schemas instead of illustrative examples.
- Use domain examples only when the product owner explicitly requires them as canonical domain content.
- Preserve the target product's necessary vocabulary without promoting it to BridgeCrux doctrine.
- Keep ordinary user-facing copy free of implementation language.
- Use tables for compact route contracts, not for long explanatory prose.
- Remove duplicated, decorative, contradictory, and non-executable text.
- Make each file self-contained for its responsibility while keeping cross-file ownership clear.

## Validation

The skill succeeds only when all applicable checks pass:

1. The package contains `system.prompt.md`, `assistants.md`, and at least one `specific-functions/*.md` file.
2. No `general-functions/` directory was created.
3. Deterministic processes, when present, live only in `specific-functions/deterministic-processes.md`.
4. `system.prompt.md` truthfully defines identity, user experience, frontend/channel, backend state, capabilities, mutation rules, memory, safety, copy, and recovery.
5. `assistants.md` contains a Task-Signal Smart Router table derived from the actual task surface.
6. Route and intent names are crux-declared inside the universal decision envelope.
7. Every mutation requires positive evidence, resolved references, state preconditions, an authorized handler, and preservation rules.
8. Raw router output cannot directly execute mutations or produce user copy.
9. Post-router validation clears incompatible and stale metadata before dispatch.
10. Route recognition is connected through dispatch, handler, operation, persistence, response, and audit.
11. Commands, shortcuts, tools, jobs, and natural-language routes obey parity rules.
12. Composite controls and composite turns are decomposed where execution contracts differ.
13. Runtime capability gaps are reserved for explicit genuinely unsupported execution requests.
14. Construction defects remain internal audit findings.
15. Specific functions declare authoritative state, operations, evidence, references, preservation, copy source, failure behavior, and regression proof.
16. Compact memory is not used as domain history.
17. The content builder parses every canonical file and rejects missing ids, invalid references, unsupported operations, and empty generated content.
18. The maintained route implementation checklist reconciles UI-to-runtime and runtime-to-task-surface coverage.
19. No source application's domain vocabulary or sample content leaked into universal BridgeCrux rules.
20. The final package gives the agent enough truthful context to operate the app as a useful assistant or tutor without exposing its internal machinery to the user.

If a check fails because runtime software or builder support is missing, record the implementation requirement explicitly. Do not hide the gap with prompt prose.
