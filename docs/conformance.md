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

Convex persistence tests run against `convex-test`, including actual schema indexes and transactions. Gemini and Telegram offline tests use injected provider boundaries; they verify request configuration, schema handling, normalization, splitting, retries, provider ids, and structured errors without credentials.

The whole-turn test runs a neutral Telegram update through the real Telegram normalization boundary, Gemini structured/tutor adapter boundary, deterministic validator, handler binding, idempotent operation, persistence ports, copy gate, Telegram delivery boundary, and raw/validated audit records. Replaying the update must not rerun the operation.

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
