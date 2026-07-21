# Conformance

BridgeCrux separates deterministic offline conformance from credentialed provider gates.

## Full Offline Gate

```bash
npm run build
```

The command performs one release acceptance sequence:

1. remove derived build output;
2. synchronize and hash all three skill bundles;
3. compile every workspace package;
4. typecheck package and test code;
5. build the neutral canonical-content fixture;
6. lint TypeScript sources and tests;
7. run core, content, Convex, Gemini, Telegram, kit, installer, and whole-turn tests.

Convex persistence tests run against `convex-test`, including actual schema
indexes, transactions, structured-choice replay protection, and expiring turn
leases. Gemini and Telegram offline tests use injected provider boundaries; they
verify medium-thinking freeform routing, medium/high tool loops, schema handling,
normalization, safe HTML, typing refresh, callback acknowledgement, inline
controls, splitting, retries, provider ids, and structured errors without
credentials.

Whole-turn tests run neutral Telegram updates through the real Telegram
normalization boundary, Gemini structured/tool adapter boundary, deterministic
validator, execution-policy binding, idempotent operation, in-memory persistence,
copy gate, Telegram delivery, and raw/validated audit records. One test proves a
hybrid high-thinking tool mutation. Another proves that a trusted active-process
choice performs its code-owned transition with zero router, assessment, tutor,
or tool-model calls. Replaying either inbound event must not rerun its operation.

`auditAllRouteSimulation` is the public conformance helper for the one-table
route simulation maintained by `$anticipate-crux-routes`. Every declared
route/intent appears exactly once and asserts execution mode, thinking policy,
model-call count, trusted structured input, tools, required operation,
persistence, delivery, and audit. The helper rejects duplicates,
contradictions, missing paths, model use on deterministic process turns, and
undeclared tools. Use `InMemoryCruxRuntime` so those observations come from real
in-memory message, interaction, lease, ledger, report, and audit persistence
rather than mocked operation success.

## Package Installation Gate

```bash
npm run pack:test
```

This packs all public workspaces, installs their tarballs into a clean temporary ESM project, imports the umbrella package, runs the CLI, installs all three skills, and verifies the managed instruction block. No package is published by this command.

## Live Gates

```bash
npm run test:live
```

Each live test skips unless its explicit configuration exists:

- Gemini: `GEMINI_API_KEY`; optional `BRIDGECRUX_GEMINI_MODEL` overrides the default `gemini-3.1-flash-lite`.
- Telegram read-only authentication: `TELEGRAM_BOT_TOKEN`.
- Telegram delivery: additionally set `BRIDGECRUX_LIVE_SEND=1` and `TELEGRAM_TEST_CHAT_ID`.
- Convex: `CONVEX_URL` and `BRIDGECRUX_CONVEX_HEALTH_FUNCTION`, naming a public query that accepts `{}`.

Live Telegram delivery is opt-in because it creates an external message. Tests never print credentials.

## Supported Runtimes

Release automation should run the offline gate on Node.js 22 and 24. Package manifests reject Node versions below 22. The repository is ESM-only.
