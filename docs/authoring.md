# Authoring A Crux

Use `$use-bridgecrux-primitives` as the coordinator for all work in this guide.

## Define The Executable Surface

Run `$anticipate-crux-routes` when creating a crux, exposing a new feature, or auditing an incomplete agent path. Its route implementation checklist must reconcile both directions:

```text
user goal -> route -> validation -> handler -> operation -> persistence -> copy -> audit
operation, command, or job -> deliberate task surface or internal-only status
```

Do not declare a capability merely because a model can describe it. A supported task signal must reach a real operation or a deliberate read-only/conversational controller.

## Write Canonical Content

Run `$write-crux-prompts` after the application surface and backend operations are known. It owns exactly:

- `system.prompt.md` for identity, scope, harness awareness, interaction, safety, and user-copy behavior;
- `assistants.md` for the Task-Signal Smart Router, registries, decision validation, dispatch, audit, and correction;
- `specific-functions/*.md` for domain truth, operations, evidence, references, preservation, recovery, and regression contracts;
- `specific-functions/deterministic-processes.md` only when ordered code-owned processes exist.

Use the application’s domain vocabulary inside its crux. Keep universal BridgeCrux packages and neutral fixtures free of consumer-specific terms.

## Register Runtime Contracts

For each supported route/intent pair:

1. Add an `IntentContract` to the route registry.
2. Add one `HandlerBinding` naming required state, allowed mutation classes, operation ids, copy sources, and audit events.
3. Register the matching `SpecificFunctionController` or deterministic process controller.
4. Register every operation handler. Keep reads and mutations adjacent to the application feature they control.
5. Supply reference candidates, evidence policies, available state, and composite compatibility to deterministic validation.
6. Persist raw and validated decisions separately.

Explicit persisted references take precedence over active-item fallback. Questions, proposals, future intention, contradiction, missing fields, unresolved targets, and safety flags must not mutate state.

## Content Frontmatter

Canonical Markdown uses YAML frontmatter. The builder accepts repeated frontmatter blocks in `specific-functions/deterministic-processes.md` so several processes can share that canonical file. Stable ids, versions, declared routes, intents, tools, state reads, and state writes are validated against `crux.config.json` and the operation manifest.

Use the neutral fixture under `conformance/fixtures/valid-crux/` as a schema exercise, not as a product template.

## Completion

A crux path is verified only when one test or production trace proves normalized inbound input, bounded durable state, raw routing, deterministic validation, binding, operation, persistence, truthful copy, delivery result, and audit evidence together. Update the route implementation checklist with that evidence.

