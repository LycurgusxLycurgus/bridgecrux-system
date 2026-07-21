# Installing BridgeCrux

BridgeCrux `0.2.x` is ESM-only and requires Node.js 22 or newer. Node.js 22 and 24 are the supported CI targets. Convex is a peer dependency because consumers compose framework tables with their application schema.

## Runtime And Skills

Install the complete supported runtime:

```bash
npm install @bridge-crux/kit convex
```

For one application, install the three Agent Skills inside the project and
register them in the application instructions:

```bash
npx @bridge-crux/skills install \
  --target ./.codex/skills \
  --project . \
  --instruction-files auto
```

This produces `.codex/skills/anticipate-crux-routes`,
`.codex/skills/write-crux-prompts`, and
`.codex/skills/use-bridgecrux-primitives` in the repository. It does not write
to `$CODEX_HOME` and keeps application-specific BridgeCrux instructions local.

Use the global Codex skills root only when the same installation should be
available to every repository for the current user:

```bash
npx @bridge-crux/skills install \
  --target "$CODEX_HOME/skills" \
  --project . \
  --instruction-files auto
```

`auto` updates every existing root `AGENTS.md` and `CLAUDE.md`; if neither exists, it creates `AGENTS.md`. The installer appends one bounded block at the end of each selected file. Reinstalling updates that block without duplicating it. Select `agents`, `claude`, `both`, or `none` when automatic selection is not appropriate. Use `--dry-run` to inspect paths without writing.

Uninstall only the three named skill directories and their managed blocks:

```bash
npx @bridge-crux/skills uninstall --target ./.codex/skills --project .
```

The managed block requires `$use-bridgecrux-primitives` for all agentic-app crux functionality and describes when it coordinates `$anticipate-crux-routes` and `$write-crux-prompts`.

## Upgrade An Existing Application

Read the repository [changelog](../CHANGELOG.md) before changing versions. Choose
one exact BridgeCrux version and use it for the runtime packages and skills in
the same upgrade. Exact versions make the rollout reproducible; use `@latest`
only after confirming its release notes and compatibility requirements.

### Umbrella Kit And Project-Local Skills

For an application using the recommended umbrella package and local skills,
replace `0.2.0` with the selected target version:

```bash
npm install @bridge-crux/kit@0.2.0
npx @bridge-crux/skills@0.2.0 install \
  --target ./.codex/skills \
  --project . \
  --instruction-files auto
npx bridgecrux --version
npx bridgecrux doctor --project .
```

To adopt the newest published release after reviewing it, replace both
`@0.2.0` selectors with `@latest`. Always change both selectors together and
confirm `npx bridgecrux --version` before committing the upgrade.

The skills installer verifies its packaged manifest, replaces only
`anticipate-crux-routes`, `write-crux-prompts`, and
`use-bridgecrux-primitives` under the selected target, and refreshes its bounded
managed block. Existing instructions outside that block are preserved, and
reinstalling does not duplicate the block.

`@bridge-crux/kit` already depends on the supported core, content, Convex, and
adapter packages. Do not add those as direct dependencies unless the application
imports them intentionally. Convex is a peer dependency: keep the existing
compatible application version, and upgrade Convex separately only after
checking the target kit's peer range and the application's Convex migration.

### Direct Package Consumers

If the application intentionally imports individual packages, update every
BridgeCrux package already declared in `package.json` to the same exact target.
For example, an application that directly uses only core and adapters runs:

```bash
npm install @bridge-crux/core@0.2.0 @bridge-crux/adapters@0.2.0
npx @bridge-crux/skills@0.2.0 install --target ./.codex/skills --project .
```

Select from `@bridge-crux/core`, `@bridge-crux/content`,
`@bridge-crux/convex`, `@bridge-crux/adapters`, `@bridge-crux/kit`, and
`@bridge-crux/skills` based on dependencies already owned by the application.
Installing all six is neither required nor recommended for an umbrella-kit
consumer.

### Global Skills

When the previous installation deliberately used the global Codex skills root,
refresh the same target. In PowerShell:

```powershell
npx @bridge-crux/skills@0.2.0 install `
  --target "$env:CODEX_HOME\skills" `
  --project . `
  --instruction-files auto
```

On bash-compatible shells:

```bash
npx @bridge-crux/skills@0.2.0 install \
  --target "$CODEX_HOME/skills" \
  --project . \
  --instruction-files auto
```

### Validate And Commit

After installation:

1. Confirm `npx bridgecrux --version` reports the selected version.
2. Run `npx bridgecrux doctor --project .` and resolve required failures.
3. Run the application's real tests and production build, such as `npm test`
   and `npm run build` when those scripts exist.
4. Review `package.json`, the lockfile, `.codex/skills/`, the managed block in
   `AGENTS.md` or `CLAUDE.md`, and every migration note in the changelog.
5. Commit project-local skills and instruction files when the repository shares
   them with collaborators. If they are intentionally ignored, make their
   installation part of reproducible project setup instead.

### Roll Back

Reinstall both runtime and skills at the same previously working version, then
rerun the same doctor, test, and build checks. For example:

```bash
npm install @bridge-crux/kit@0.1.1
npx @bridge-crux/skills@0.1.1 install --target ./.codex/skills --project .
npx bridgecrux --version
npx bridgecrux doctor --project .
```

## Migrate 0.1.1 To 0.2.0

BridgeCrux 0.2.0 removes the 0.1.1 content and process contracts rather than
silently translating them. Upgrade one application branch at a time:

1. Update runtime and skills together to 0.2.0 using the commands above.
2. Set every `crux.config.json` to `schemaVersion: 2`. Remove `thinking` from
   model profiles. Add `execution.freeformRouterThinkingLevel: "medium"` and
   one `execution.routes["<route>/<intent>"]` policy for every registered pair.
3. Add `executionPolicy` to every runtime `HandlerBinding`. Deterministic policy
   has an empty tool list; hybrid/model policy declares `medium` or `high` plus
   its exact tool-operation ids.
4. Rename `specific-functions/deterministic-processes.md` to
   `specific-functions/processes.md` and change frontmatter `kind` from
   `deterministic_process` to `process`. Replace string step lists with
   structured step contracts declaring input, execution, completion,
   confirmation, missing-field questions, and transitions.
5. Replace `ActiveDeterministicProcess`, `DeterministicProcessDefinition`,
   `DeterministicProcessController`, `DefaultDeterministicProcessController`,
   and `DeterministicProcessRegistry` with `ActiveProcess`,
   `ProcessDefinition`, `ProcessController`, `DefaultProcessController`, and
   `ProcessRegistry`.
6. Supply `RuntimePorts.turns` for expiring per-user/thread turn leases. Supply
   `RuntimePorts.interactions` wherever closed-choice process controls are used.
   Convex consumers should spread the current `bridgeCruxTables` into their
   schema and use `repositoryPorts`, which provides both stores.
7. Regenerate canonical output, then run `bridgecrux validate`, `bridgecrux
   doctor`, the application's all-route simulation, tests, and production build.

The content validator reports stable migration diagnostics for schema 1 and
model-profile thinking fields. There is no 0.1.1 compatibility mode in 0.2.0.
Rollback therefore requires restoring the application's 0.1.1 source contracts
from version control as well as reinstalling 0.1.1 packages and skills.

## Compose Convex

Keep application-owned domain tables beside BridgeCrux tables:

```ts
import { bridgeCruxTables } from "@bridge-crux/convex";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...bridgeCruxTables,
  records: defineTable({ ownerId: v.string(), status: v.string() }),
});
```

Inside Convex mutations, construct `ConvexBridgeCruxRepository` from `ctx.db`. Supply a small `DomainStateLoader` when router and tutor calls need application-owned records. Keep domain queries and mutations in application feature code and expose them through registered BridgeCrux operation handlers.

Convex actions do not own database access. Call thin application mutations and queries from actions; use the repository inside those database functions.

## Configure Adapters

Gemini requires `GEMINI_API_KEY`. New integrations default to the stable
`gemini-3.1-flash-lite` identifier. BridgeCrux exposes only `medium` and `high`
thinking in its 0.2 runtime contract. Freeform routing is always medium. Every
validated route and established process step then follows its predeclared
execution policy: deterministic code, medium/high hybrid assessment with scoped
tools, medium model work for knowledge/simple interaction, or high model work
for agentic interaction. Hybrid and model routes may use tools when their
validated allowlist declares them; code remains the authority for backend
operations and persistence. An active deterministic process accepts only a
server-issued closed choice and makes zero model calls. Model output cannot
change mode, thinking, completion authority, or tools.

Current upstream references: [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
and [Gemini thinking levels](https://ai.google.dev/gemini-api/docs/gemini-3).

Telegram requires `TELEGRAM_BOT_TOKEN`. `TelegramChannelAdapter` normalizes
webhook messages and callback queries, acknowledges callbacks, refreshes typing
activity while work continues, converts ordinary Markdown to Telegram-safe
HTML, renders declared process choices as inline controls, splits output,
retries transient delivery failures, and returns provider message ids. Callback
choices are validated by the runtime against durable user/session/process/step
state and consumed once. HTML formatting is the default; pass
`formatting: "plain"` only for deliberately unformatted text. The adapter does
not interpret domain intent.

See Telegram's current [sendMessage and formatting contract](https://core.telegram.org/bots/api#sendmessage).

Do not store credentials in canonical crux content, reports, or checked-in environment files. `bridgecrux doctor` reports only credential presence.

## Canonical Content

Each crux uses one source tree:

```text
cruxes/<crux-id>/
  crux.config.json
  system.prompt.md
  assistants.md
  specific-functions/
    <function>.md
    processes.md  # only when established processes exist
```

Build from source Markdown rather than editing generated files:

```bash
npx bridgecrux validate --root cruxes/<crux-id> --operations operations.json
npx bridgecrux build --root cruxes/<crux-id> --operations operations.json --out generated/<crux-id>
```

The operations manifest is either a JSON string array or `{ "operations": ["operation.id"] }`.

## Diagnostics

```bash
npx bridgecrux doctor --project . --json
```

Missing optional live credentials do not make the offline runtime invalid. They appear as disabled provider checks and are required only when exercising those live boundaries.
