# BridgeCrux 0.3 Runtime Map

## Packages

- `@bridge-crux/core`: provider-neutral schema-3 capability/surface, compact routing, execution, process, interaction, operation, validation, copy, audit, lease, routing-evaluation, and in-memory conformance contracts.
- `@bridge-crux/content`: schema-3 canonical discovery, validation, capability/surface manifest, route/process regression artifacts, and generated headless surface.
- `@bridge-crux/convex`: composable state, messages, audit, ledger, idempotency, interactions, communication preferences, leases, processes, memory, reports, and jobs.
- `@bridge-crux/adapters`: Gemini 3.5 Flash-Lite structured routing/tutoring/tool loop and Telegram normalization, safe HTML, shared control codec, typing, acknowledgement, delivery, retry, and errors.
- `@bridge-crux/kit`: supported public exports plus `bridgecrux build|validate|evaluate-routing|doctor`.
- `@bridge-crux/skills`: integrity-bundled project-local skills with transactional install/update/uninstall/doctor and a bounded managed instruction block.

## Canonical Consumer Shape

```text
cruxes/<crux-id>/
  crux.config.json
  system.prompt.md
  assistants.md
  specific-functions/*.md

generated/
  manifest.generated.json
  routes.generated.ts
  capability-surface.generated.md

src/<feature>/
  capability-derived registry and controllers
  domain operation handlers
  BridgeCrux composition

convex/
  schema.ts composed with bridgeCruxTables
  thin functions using ConvexBridgeCruxRepository

.codex/skills/
  .bridgecrux-skills.json
  anticipate-crux-routes/
  use-bridgecrux-primitives/
  write-crux-prompts/
```

## Execution Authority

- User-authored text receives a compact medium-thinking route/intent decision. Full capabilities are attached after deterministic validation.
- A validated capability fixes handler, operations, execution mode, thinking, tools, copy, audit, interaction, lifecycle, and surfaces.
- An active deterministic server-issued closed choice may bypass routing and makes zero model calls. Typed text routes.
- Hybrid is high-thinking and code validates every proposed interpretation or generated choice.
- Agentic work is medium for knowledge-only interaction and high for complex or any tool-using work.
- Code alone authorizes operations, persistence, idempotency, completion, and success claims.

## CLI

```sh
bridgecrux validate --root <crux-dir> --operations <operations.json>
bridgecrux build --root <crux-dir> --operations <operations.json> --out <generated-dir>
bridgecrux evaluate-routing --cases <cases.json> --observations <observations.json>
bridgecrux doctor --project <app-root>

bridgecrux-skills install --project <app-root>
bridgecrux-skills update --project <app-root>
bridgecrux-skills doctor --project <app-root>
bridgecrux-skills uninstall --project <app-root>
```

Project-local `.codex/skills` is the default. `--global` is explicit. Managed files are hash-checked; modified or unmanaged collisions require explicit `--force`, and writes are staged with rollback.

## Stable And Experimental

Stable in 0.3: schema-3 capability-first content, semantic surface parity, compact hierarchical routing, routing evaluation, raw/validated separation, fixed execution policy, generated interaction validation, structured processes, Convex interactions/preferences/leases, Gemini 3.5 policy, Telegram controls/activity, generated headless manifests, CLI diagnostics, safe skill lifecycle, and real-persistence conformance.

Still experimental: broad multi-signal orchestration, additional model providers and persistence backends, broad multilingual copy linting, automatic memory-proposal semantics, and automatic repairs.
