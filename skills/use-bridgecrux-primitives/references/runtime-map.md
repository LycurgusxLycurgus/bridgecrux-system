# BridgeCrux 0.2 Runtime Map

## Packages

- `@bridge-crux/core`: provider-neutral route, execution-policy, process, interaction, turn-lease, operation, validation, copy, memory, report, and in-memory conformance contracts.
- `@bridge-crux/content`: schema-2 canonical Markdown discovery, execution-policy and structured-process validation, cross-reference checks, manifests, route checklists, handler stubs, regression scenarios, and deterministic TypeScript output.
- `@bridge-crux/convex`: composable framework tables and repository ports for state, audit, ledger, idempotency, structured interactions, expiring turn leases, processes, memory, reports, and jobs.
- `@bridge-crux/adapters`: Gemini medium/high model execution and Telegram normalization, safe HTML, typing refresh, callback acknowledgement, inline controls, delivery, retry, and transport errors.
- `@bridge-crux/kit`: supported public re-exports and the `bridgecrux` build, validate, and doctor commands.
- `@bridge-crux/skills`: installs all BridgeCrux skills and maintains their registration block in consumer instructions.

## Canonical Consumer Shape

```text
cruxes/<crux-id>/
  crux.config.json
  system.prompt.md
  assistants.md
  specific-functions/
    *.md
    processes.md

src/<feature>/
  route registry and execution-policy bindings
  domain operation handlers
  BridgeCrux composition

convex/
  schema.ts composed with bridgeCruxTables
  thin mutations/queries/actions using ConvexBridgeCruxRepository and repositoryPorts
```

## Execution Authority

- Freeform routing always uses medium thinking and returns a non-authoritative raw decision.
- Every route/intent and established process step declares its execution policy before entry.
- `deterministic` runs code after routing; an active deterministic process bypasses routing only for a server-issued, replay-safe closed choice and makes zero model calls.
- `hybrid` uses a predeclared medium/high assessment with only process-scoped tools; schema and domain validation authorize progression.
- `model` uses medium for knowledge/simple work or high for agentic work with only route-scoped tools.
- Code exclusively authorizes operations, persistence, completion, idempotency, and truthful success copy.
- Each crux/channel/user/thread turn is serialized by an expiring correlation-owned lease.

## CLI

- `bridgecrux build --root <crux-dir> --out <generated-dir>` validates and writes deterministic artifacts.
- `bridgecrux validate --root <crux-dir>` validates without writing.
- `bridgecrux doctor [--project <app-root>]` checks the local runtime and reports credential presence without printing values.
- `bridgecrux-skills install --target <skills-root> --project <app-root>` installs the coordinator and two authoring skills and updates project instructions.

## Stable And Experimental Surface

The stable 0.2 surface includes raw/validated decision separation, predeclared execution policies, schema-2 content, structured processes, Convex interactions and turn leases, Gemini medium/high execution, Telegram structured controls, in-memory conformance, CLI behavior, and skill installation. Generic multi-signal orchestration, additional providers and persistence backends, broad copy linting, memory proposal semantics, and repair workflows remain experimental until more production cruxes prove them.
