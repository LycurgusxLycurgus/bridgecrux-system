# BridgeCrux Runtime Map

## Packages

- `@bridge-crux/core`: provider-neutral contracts, registries, decision validation, reference and evidence gates, dispatch, operations, deterministic processes, copy, memory, and reports.
- `@bridge-crux/content`: canonical Markdown discovery, frontmatter validation, cross-reference checks, manifest generation, and deterministic TypeScript output.
- `@bridge-crux/convex`: composable framework tables, persistence repository, state loader, audit, ledger, idempotency, process deferral, memory, reports, and jobs.
- `@bridge-crux/adapters`: Gemini structured/tutor calls and Telegram normalization, formatting, delivery, retry, and transport errors.
- `@bridge-crux/kit`: supported public re-exports and the `bridgecrux` build, validate, and doctor commands.
- `@bridge-crux/skills`: installs all BridgeCrux skills and maintains their registration block in consumer instructions.

## Canonical Consumer Shape

```text
cruxes/<crux-id>/
  crux.config.json
  system.prompt.md
  assistants.md
  specific-functions/*.md

src/<feature>/
  route registry and bindings
  domain operation handlers
  BridgeCrux composition

convex/
  schema.ts composed with bridgeCruxTables
  thin mutations/queries/actions using ConvexBridgeCruxRepository
```

## CLI

- `bridgecrux build --root <crux-dir> --out <generated-dir>` validates and writes deterministic artifacts.
- `bridgecrux validate --root <crux-dir>` validates without writing.
- `bridgecrux doctor [--project <app-root>]` checks the local runtime and reports credential presence without printing values.
- `bridgecrux-skills install --target <skills-root> --project <app-root>` installs the coordinator and two authoring skills and updates project instructions.

## Stable And Experimental Surface

Provider-neutral contracts, registry validation, content parsing, Convex schema composition, adapter boundaries, and installation are stable for `0.1.x`. Generic multi-operation execution, specific-function/process orchestration, copy linting, memory proposal semantics, and repair workflows remain experimental until more real cruxes prove their behavior.
