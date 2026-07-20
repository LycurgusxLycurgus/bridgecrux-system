# Installing BridgeCrux

BridgeCrux `0.1.x` is ESM-only and requires Node.js 22 or newer. Node.js 22 and 24 are the supported CI targets. Convex is a peer dependency because consumers compose framework tables with their application schema.

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
`gemini-3.1-flash-lite` identifier. `GeminiModelClient` supports the model's
`minimal`, `low`, `medium`, and `high` thinking levels, but BridgeCrux runtime
policy is intentionally narrower:

- routing, extraction, ambiguity, partial mutations, tool use, personalized
  interpretation, and every other agentic path use `high`;
- an explicitly configured knowledge-only chat route may use `medium` only when
  it has no tools, no mutation, and no active process or specific function;
- stable deterministic-process surfaces use authored copy and make no model call.

Configure knowledge-only routes through
`DefaultTurnController`'s `tutor.knowledgeOnlyChatRoutes`. The router's
`needsHighThinking` output may request escalation, but cannot downgrade runtime
policy. Override `GEMINI_DEFAULT_MODEL` only when an application has an explicit
model requirement.

Current upstream references: [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
and [Gemini thinking levels](https://ai.google.dev/gemini-api/docs/gemini-3).

Telegram requires `TELEGRAM_BOT_TOKEN`. `TelegramChannelAdapter` normalizes
webhook updates, applies configured command aliases, converts ordinary Markdown
to Telegram-safe HTML, splits output, retries transient delivery failures, and
returns provider message ids. HTML formatting is the default; pass
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
    deterministic-processes.md  # only when needed
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
