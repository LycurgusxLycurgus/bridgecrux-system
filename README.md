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

BridgeCrux `0.1.x` is ESM-only and requires Node.js 22 or newer.

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

New Gemini integrations default to the stable `gemini-3.1-flash-lite` model.
BridgeCrux uses high thinking for routing and all other agentic behavior,
medium thinking only for explicitly configured knowledge-only chat routes with
no tools, and no model call for stable authored deterministic-process copy.
Telegram output is converted from ordinary Markdown into Telegram-safe HTML so
headings, emphasis, lists, links, quotations, and code render instead of leaking
raw Markdown syntax.

## Develop This Repository

```bash
npm ci
npm run build
```

`npm run build` cleans derived output, synchronizes skill bundles, compiles, typechecks tests, builds the neutral fixture, lints, and runs the offline conformance suite. Live provider gates are separate and credential-controlled:

```bash
npm run test:live
```

See [installation](docs/installation.md), [authoring](docs/authoring.md), [conformance](docs/conformance.md), [releasing](docs/releasing.md), [stability](docs/stability.md), and the [standardized repository handoff](docs/standardized-repo-handoff.md).

## License

Apache-2.0.
