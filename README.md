# BridgeCrux

BridgeCrux is a provider-neutral TypeScript runtime for turning applications into stateful, task-signal-driven agents. It combines deterministic decision validation, explicit handler and operation contracts, canonical Markdown content, Convex persistence, Gemini model calls, Telegram delivery, conformance tooling, and installable Agent Skills.

The runtime keeps authority in code and durable state:

```text
inbound transport -> normalized message and state -> raw task signal
-> deterministic validation -> declared handler and operations
-> persistence and audit -> allowed user copy -> outbound transport
```

Raw model output never authorizes mutation or becomes application truth.

## Packages

- `@bridge-crux/core` — provider-neutral contracts, registries, validation, operations, processes, copy, memory, and reports.
- `@bridge-crux/content` — canonical content discovery, validation, manifests, and deterministic TypeScript emission.
- `@bridge-crux/convex` — composable Convex schema and persistence primitives.
- `@bridge-crux/adapters` — Gemini model and Telegram channel boundaries.
- `@bridge-crux/kit` — the supported public umbrella and `bridgecrux` CLI.
- `@bridge-crux/skills` — three Agent Skills plus managed `AGENTS.md`/`CLAUDE.md` registration.

## Install In An Application

BridgeCrux `0.2.x` is ESM-only and requires Node.js 22 or newer.

```bash
npm install @bridge-crux/kit convex
npx @bridge-crux/skills install --target ./.codex/skills --project .
```

This project-local installation keeps all three skills under the repository's
`.codex/skills/`; nothing is installed into `$CODEX_HOME`. It is the recommended
default when BridgeCrux belongs to one application. To share the skills across
all repositories for the current Codex user, install them globally instead:

```bash
npx @bridge-crux/skills install --target "$CODEX_HOME/skills" --project .
```

Create canonical content under `cruxes/<crux-id>/`, then validate it:

```bash
npx bridgecrux validate --root cruxes/<crux-id> --operations operations.json
npx bridgecrux build --root cruxes/<crux-id> --operations operations.json
npx bridgecrux doctor --project .
```

Use `$use-bridgecrux-primitives` for any BridgeCrux-related agentic-app work. It coordinates `$anticipate-crux-routes` for the executable task surface and `$write-crux-prompts` for canonical content.

New Gemini integrations default to `gemini-3.1-flash-lite`. Freeform conversation
uses a medium-thinking router, then code enforces the selected route's declared
execution policy:

- `deterministic`: code-only after routing, or a trusted server-issued closed
  choice inside an active process; active structured turns make zero model calls;
- `hybrid`: a medium- or high-thinking model interprets open input and may use
  only the process-scoped tools, while code validates and authorizes effects;
- `model`: medium thinking for knowledge/simple work or high thinking for
  agentic work, with only the route-scoped tools.

An established process fixes its mode, thinking level, tool allowlist,
confirmation policy, and completion authority before the user enters it.
Telegram output is rendered as safe HTML, typing activity is refreshed while a
turn runs, and inline process choices use acknowledged, server-validated,
single-use callbacks. Ordinary interaction remains freeform chat; choices appear
only where a declared process requires a closed selection.

## Upgrade An Existing Application

Review the [changelog](CHANGELOG.md), choose one target version for both the
runtime and skills, then update and refresh the project-local installation. For
the current release:

```bash
npm install @bridge-crux/kit@0.2.0
npx @bridge-crux/skills@0.2.0 install --target ./.codex/skills --project .
npx bridgecrux --version
npx bridgecrux doctor --project .
```

For a future release that has already been reviewed, replace `@0.2.0` with
`@latest` in both install commands. Keep runtime and skills on the same version;
do not mix an exact runtime with latest skills or the reverse.

The installer replaces only the three managed BridgeCrux skill directories and
refreshes the bounded block in `AGENTS.md` or `CLAUDE.md` without duplicating it.
Run the application's own test and build commands, review the lockfile, installed
skills, managed instruction block, and release-specific migration notes, then
commit them according to the application's repository policy.

Applications that import individual BridgeCrux packages should update only
those declared packages, all to the same target version. Do not add every
internal package when `@bridge-crux/kit` already provides the supported umbrella.
See the complete [upgrade and rollback procedure](docs/installation.md#upgrade-an-existing-application).

### Migrating From 0.1.1

Version 0.2.0 deliberately removes the 0.1.1 content and process contracts; it
does not retain a compatibility parser. Before building, migrate every crux to
`schemaVersion: 2`, move model thinking settings into `execution.routes`, set
`execution.freeformRouterThinkingLevel` to `medium`, rename
`specific-functions/deterministic-processes.md` to
`specific-functions/processes.md`, use `kind: process`, and define structured
per-step input, execution, completion, confirmation, and missing-field
contracts. Runtime integrations must replace the old deterministic-process API
names with `ProcessDefinition`, `ProcessController`, `ProcessRegistry`, and
`DefaultProcessController`, declare an `executionPolicy` on every binding, and
supply turn leases plus structured-interaction persistence. See the
[0.2 migration checklist](docs/installation.md#migrate-011-to-020).

## Develop This Repository

```bash
npm ci
npm run build
```

`npm run build` cleans derived output, synchronizes skill bundles, compiles, typechecks tests, builds the neutral fixture, lints, and runs the offline conformance suite. Live provider gates are separate and credential-controlled:

```bash
npm run test:live
```

See the [changelog](CHANGELOG.md), [installation](docs/installation.md), [authoring](docs/authoring.md), [conformance](docs/conformance.md), [releasing](docs/releasing.md), and [stability](docs/stability.md).

## License

Apache-2.0.
