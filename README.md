# BridgeCrux

BridgeCrux turns one application into one agentic application across chat, UI, channels, and a generated headless surface. The agent does not imitate the app: every presentation reaches the same declared capability, handler, operation authority, durable state, and semantic result.

```text
user-authored text -> compact medium-thinking route/intent
-> deterministic validation -> canonical capability + handler binding
-> fixed deterministic | hybrid | agentic policy
-> authorized operations and durable state
-> truthful copy -> channel delivery and audit
```

Model output may interpret, explain, plan, and call scoped tools. Code alone authorizes operations, persistence, idempotency, and success claims.

## Start Here

BridgeCrux 0.3 is ESM-only and requires Node.js 22 or newer.

```bash
npm install @bridge-crux/kit@0.3.0 convex
npx @bridge-crux/skills@0.3.0 install --project .
npx bridgecrux --version
npx bridgecrux doctor --project .
```

The skills install project-locally under `.codex/skills`; nothing is written to `$CODEX_HOME`. The installer also adds one bounded BridgeCrux block to `AGENTS.md` or `CLAUDE.md`. Global installation is explicit:

```bash
npx @bridge-crux/skills@0.3.0 install --global --project .
```

Use `$use-bridgecrux-primitives` for BridgeCrux work. For a new crux or changed product surface it coordinates:

1. `$anticipate-crux-routes` — one capability/surface inventory, compact routes, duplicate/contradiction audit, routing evaluation, and all-route/all-surface simulation.
2. `$write-crux-prompts` — schema-3 configuration and canonical system, router, function, process, onboarding, style, and invariant content.
3. `$use-bridgecrux-primitives` — runtime integration and whole-turn validation.

## The 0.3 Contract

- One capability catalog is the source of truth for agent, app, channels, and headless behavior.
- Routes are coarse domains; intents are route-local sub-routes. The router sees only compact discriminators.
- Every user-authored textual turn routes through a medium-thinking model by default. High router thinking requires a passed comparison evaluation.
- `deterministic` means code only after routing. An active server-issued closed choice may bypass routing and makes zero model calls; typed text still routes.
- `hybrid` means high-thinking interpretation or dynamic 2–4 option procedural UX, followed by code validation and authorized operations.
- `agentic` means medium thinking for knowledge-only interaction and high thinking for complex work or any tool use.
- Generated choices allow free-text continuation and never authorize mutation merely because the user selected one.
- New Google integrations use exact `gemini-3.5-flash-lite`, explicit medium/high thinking, 65,536 maximum output tokens, the BridgeCrux safety configuration, and no temperature/top-p/top-k.
- Telegram uses safe HTML, one outbound/inbound callback codec, early callback acknowledgement, and refreshed typing activity during noticeable work.
- Communication style (`casual` or `pragmatic`), onboarding, channel affordances, lifecycle, destructive confirmation, and product invariants are durable contracts.

## Author A Crux

Canonical source lives in one tree:

```text
cruxes/<crux-id>/
  crux.config.json
  system.prompt.md
  assistants.md
  specific-functions/*.md
```

Validate and generate the manifest, typed route artifacts, and inspectable headless capability surface:

```bash
npx bridgecrux validate --root cruxes/<crux-id> --operations operations.json
npx bridgecrux build --root cruxes/<crux-id> --operations operations.json --out generated/<crux-id>
npx bridgecrux evaluate-routing --cases routing-cases.json --observations routing-observations.json
npx bridgecrux doctor --project .
```

See [Authoring](docs/authoring.md) and [Conformance](docs/conformance.md).

## Upgrade An Application

For an existing managed 0.3 installation:

```bash
npm install @bridge-crux/kit@latest convex
npx @bridge-crux/skills@latest update --project .
npx bridgecrux --version
npx @bridge-crux/skills@latest doctor --project .
npx bridgecrux doctor --project .
npm test
npm run build
```

The updater checks hashes, stages all three skills, refreshes the bounded instruction block, records installed ownership, and rolls back on failure. It refuses modified or unmanaged skill files unless the user reviews them and explicitly uses `--force`.

### Breaking Migration From 0.2.x

BridgeCrux 0.3 removes schema 2 and the `model` execution name. There is no compatibility parser.

1. Back up or commit the application.
2. Install `@bridge-crux/kit@0.3.0` and `@bridge-crux/skills@0.3.0`.
3. Existing 0.2 local skills have no managed state. Preview adoption, review/backup collisions, then explicitly adopt them:

   ```bash
   npx @bridge-crux/skills@0.3.0 install --project . --dry-run
   npx @bridge-crux/skills@0.3.0 install --project . --force
   ```

4. Migrate every crux to schema 3: nested compact routes/intents, canonical capabilities and surfaces, fixed execution, routing, communication, onboarding, channel affordances, and product invariants.
5. Rename runtime `model` policies to `agentic`; hybrid is high-thinking; tool-using agentic work is high-thinking.
6. Change Google profiles to `gemini-3.5-flash-lite` and remove temperature/top-p/top-k.
7. Regenerate content and pass doctor, route evaluation, the real-persistence all-route/all-surface simulation, tests, and production build.

The exact migration and rollback procedure is in [Installation](docs/installation.md#migrate-02x-to-030). Review [CHANGELOG.md](CHANGELOG.md) before choosing `@latest`.

## Packages

- `@bridge-crux/core` — capability, routing, execution, process, operation, interaction, copy, audit, evaluation, and conformance contracts.
- `@bridge-crux/content` — schema-3 discovery, validation, manifests, typed artifacts, and headless surface generation.
- `@bridge-crux/convex` — composable persistence, interactions, preferences, leases, memory, reports, and jobs.
- `@bridge-crux/adapters` — Gemini 3.5 Flash-Lite and Telegram boundaries.
- `@bridge-crux/kit` — supported umbrella exports and `bridgecrux` CLI.
- `@bridge-crux/skills` — three integrity-bundled skills and their safe local lifecycle.

## Develop This Repository

```bash
npm ci
npm run build
npm run pack:test
```

`npm run build` synchronizes skills, compiles and typechecks, generates the neutral schema-3 fixture, lints, and runs the offline suite. `npm run pack:test` installs all packed packages into a clean consumer. Credentialed provider checks are separate with `npm run test:live`.

Release operators should follow [Publishing handoff](docs/releasing.md). Framework-development work does not publish automatically.

## License

Apache-2.0.
