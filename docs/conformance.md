# Conformance

BridgeCrux separates deterministic offline acceptance from credentialed provider checks.

## Full Offline Gate

```bash
npm run build
```

This is one release acceptance block: clean derived output, integrity-bundle the three skills, compile, typecheck source/tests, build the neutral schema-3 fixture, lint, and run core/content/Convex/Gemini/Telegram/kit/installer/whole-turn tests.

The suite proves:

- capability-derived route/handler bindings and conversation/headless/declared-surface parity;
- compact router input without handler, operation, lifecycle, or UI implementation detail;
- medium-default routing and deterministic medium-vs-high evaluation;
- deterministic callback progression with zero router/tutor/assessment/tool-model calls, while typed text still routes;
- high hybrid and medium/high agentic enforcement with exact tool subsets;
- validated 2–4 option generated interaction plans and shared Telegram callback round trips;
- real Convex interaction replay protection, communication preferences, and expiring turn leases;
- Gemini 3.5 Flash-Lite thinking/output/safety/no-sampling requests;
- Telegram safe HTML, typing refresh, acknowledgement, controls, splitting, retry, IDs, and structured errors;
- operation authorization, real in-memory persistence, truthful copy, delivery, and raw/validated audit.

`auditAllRouteSimulation` requires exactly one observation per route/intent and surface evidence per public capability. It rejects missing/duplicate paths, wrong capability bindings, surface divergence, policy contradictions, undeclared tools, model use on deterministic active choices, missing persistence, false success, and missing delivery/audit evidence.

## Packed Consumer Gate

```bash
npm run pack:test
```

This packs all six public workspaces, installs them into a clean ESM project, imports the umbrella, runs the CLI, installs project-local skills, verifies managed state and instructions, runs skill/runtime doctor, and removes the temporary consumer. It publishes nothing.

## Release Metadata Gate

```bash
npm run release:verify -- 0.3.0
```

This checks synchronized package versions, internal dependency versions, package/repository metadata, the kit version constant, the skill manifest, and publish order assumptions.

## Live Gates

```bash
npm run test:live
```

Tests skip unless explicitly configured:

- Gemini: `GEMINI_API_KEY`; optional `BRIDGECRUX_GEMINI_MODEL` overrides `gemini-3.5-flash-lite`.
- Telegram authentication: `TELEGRAM_BOT_TOKEN`.
- Telegram delivery: additionally `BRIDGECRUX_LIVE_SEND=1` and `TELEGRAM_TEST_CHAT_ID`.
- Convex: `CONVEX_URL` and `BRIDGECRUX_CONVEX_HEALTH_FUNCTION`.

Live Telegram delivery is opt-in because it creates an external message. Tests never print credentials.

## Supported Runtimes

Release automation runs Node.js 22 and 24. Packages are ESM-only and reject Node versions below 22.
