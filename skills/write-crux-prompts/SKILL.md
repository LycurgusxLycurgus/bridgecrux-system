---
name: write-crux-prompts
description: "Create or revise schema-3 BridgeCrux canonical content: crux.config.json, system.prompt.md, assistants.md, specific-functions, and established processes. Use for a new crux, a changed capability or surface, route/intention consolidation, execution-policy changes, prompt drift, onboarding or communication-style changes, and migrations from BridgeCrux 0.2 or earlier."
---

# Write Crux Prompts

Author canonical content from verified application behavior. A prompt may describe software that exists; it cannot create a missing handler, operation, persistence path, surface binding, authentication rule, or test.

BridgeCrux is versioned repository knowledge. Before making claims, read the installed package version, this skill, the target crux content, and the relevant source contracts. Do not reconstruct BridgeCrux from model memory.

## Load References Deliberately

Always read [schema-and-capabilities.md](references/schema-and-capabilities.md).

Then read only what the task needs:

- Read [routing-and-execution.md](references/routing-and-execution.md) for routes, intents, deterministic/hybrid/agentic policy, model/tool access, structured choices, or routing evaluation.
- Read [canonical-content.md](references/canonical-content.md) for `system.prompt.md`, `assistants.md`, specific functions, process frontmatter, copy, onboarding, communication styles, or validation.

For a full new crux or schema migration, read all three.

## Inputs

Inspect the smallest sufficient evidence:

1. Product purpose, users, journeys, non-goals, and vocabulary.
2. The maintained capability/surface and route checklist from `$anticipate-crux-routes`.
3. UI affordances, chat/channel affordances, and the generated or planned headless surface.
4. Handlers, operations, schemas, state machines, jobs, integrations, auth, and persistence.
5. Current prompts, route traces, tests, reports, and durable-state behavior.
6. Safety, privacy, ownership, expiry, idempotency, destructive-action, provenance, and hosting constraints.

If implementation evidence is missing, label the capability blocked or planned. Never write prompt language that makes it appear executable.

## Workflow

1. Establish one capability catalog. Each capability is one user outcome with one route-local intent, one handler, declared operations, fixed execution policy, copy sources, audit events, and semantic bindings for conversation, headless, and every declared product surface.
2. Collapse routes into coarse domains. Treat intents as route-local sub-routes. Remove duplicates, aliases that compete for the same text, and UI-specific routes for capabilities already represented semantically.
3. Declare execution before entry. Every freeform textual turn routes through the medium-thinking router unless a comparison evaluation proves high is necessary. Only an active server-issued deterministic choice may bypass routing.
4. Separate authority. Models may interpret, explain, plan, and call only scoped tools. Code validates IDs, references, operations, permissions, idempotency, persistence, and success claims.
5. Write schema-3 `crux.config.json`, then the system content, assistant routing content, specific functions, and established processes. Keep each fact in one canonical location and reference it elsewhere.
6. Include onboarding parity for first turn, `/`, `/start`, and `/help`; declared channel affordances; the communication-style contract; and independently verifiable product invariants.
7. Validate with the installed CLI and the application’s all-route/all-surface simulation. Fix content and implementation drift at the first broken boundary.

## Non-Negotiable Product Shape

Treat the result as one agentic application with multiple presentations—not an app plus a separate bot. Conversation should be able to reach every public product outcome. UI/channel/headless entrypoints must resolve to the same handler, operation authority, durable state, and semantic result. Presentation may differ; capability semantics may not.

Free conversation is primary. Controls are used only when they reduce material ambiguity or implement a genuinely closed established step. A generated choice always permits free-text continuation and never authorizes persistence merely because it was selected.

## Output

Create or update:

```text
cruxes/<crux-id>/
  crux.config.json
  system.prompt.md
  assistants.md
  specific-functions/
    <function>.md
    <process>.md
```

Also update the capability/surface checklist, generated manifest and headless surface, and real regression simulation when the target repository owns them.

## Completion Gate

Do not hand off until:

- schema version is exactly 3 and removed 0.2 fields are absent;
- each route/intent maps one-to-one to a capability and handler binding;
- every public capability has conversation, headless, and declared-surface parity;
- deterministic paths are closed-choice code with zero model calls after entry;
- hybrid paths are high-thinking, scoped, and validate generated interaction plans;
- agentic knowledge work is medium and complex/tool work is high;
- Google model profiles use `gemini-3.5-flash-lite` without temperature, top-p, or top-k;
- onboarding, style, channel, lifecycle, destructive-action, and product-invariant contracts are explicit where applicable;
- canonical content validates and generated artifacts are current;
- one real-persistence all-route/all-surface simulation passes.
