# Installing And Upgrading BridgeCrux

BridgeCrux 0.3 is ESM-only, requires Node.js 22+, and publishes all packages and bundled skills at one synchronized version. Convex remains a peer dependency so applications own their compatible Convex version.

## New Application

Install the supported umbrella and project-local skills:

```bash
npm install @bridge-crux/kit@0.3.0 convex
npx @bridge-crux/skills@0.3.0 install --project .
npx bridgecrux --version
npx @bridge-crux/skills@0.3.0 doctor --project .
npx bridgecrux doctor --project .
```

The default target is `<project>/.codex/skills`. Installation writes exactly the three BridgeCrux skills, `.bridgecrux-skills.json`, and one bounded block in the selected root instruction files. `--instruction-files auto` updates existing `AGENTS.md` and/or `CLAUDE.md`, or creates `AGENTS.md` when neither exists.

Useful options:

```bash
npx @bridge-crux/skills@0.3.0 install --project . --dry-run
npx @bridge-crux/skills@0.3.0 install --project . --instruction-files agents
npx @bridge-crux/skills@0.3.0 install --global --project .
npx @bridge-crux/skills@0.3.0 install --target ./custom/skills --project .
```

`--global` uses `$CODEX_HOME/skills` (or the default user Codex home). It is explicit because a framework installation usually belongs to one application. Do not combine `--global` and `--target`.

## Safe Skill Lifecycle

The 0.3 installer verifies its bundled manifest and hashes before writing. It records installed ownership, checks existing managed hashes, stages all replacements, updates only the bounded instruction block, and rolls back the entire transaction on failure.

```bash
npx @bridge-crux/skills@0.3.0 update --project .
npx @bridge-crux/skills@0.3.0 doctor --project .
npx @bridge-crux/skills@0.3.0 uninstall --project .
```

Install, update, and uninstall refuse modified managed files or unmanaged name collisions. First review and back up the reported files. Use `--force` only to confirm intentional replacement or removal; it is never implicit.

## Upgrade An Existing 0.3 Application

Read [CHANGELOG.md](../CHANGELOG.md), choose one exact target, and update runtime and skills together:

```bash
npm install @bridge-crux/kit@0.3.0 convex
npx @bridge-crux/skills@0.3.0 update --project .
npx bridgecrux --version
npx @bridge-crux/skills@0.3.0 doctor --project .
npx bridgecrux doctor --project .
npm test
npm run build
```

After review, `@latest` may replace both exact selectors. Do not mix an exact runtime with latest skills or vice versa. Review and commit `package.json`, the lockfile, `.codex/skills/`, `.bridgecrux-skills.json`, the managed instruction block, regenerated crux output, and application changes required by release notes.

Applications that intentionally import individual packages update only those packages, all at the same target version:

```bash
npm install @bridge-crux/core@0.3.0 @bridge-crux/adapters@0.3.0
npx @bridge-crux/skills@0.3.0 update --project .
```

`@bridge-crux/kit` already contains the supported core/content/Convex/adapter surface; umbrella consumers should not add all internal packages directly.

## Migrate 0.2.x To 0.3.0

0.3 removes the 0.2 content and execution contracts. It does not retain schema-2 parsing, `execution.routes`, or the `model` mode.

1. Commit or back up the complete application.
2. Install the 0.3 runtime:

   ```bash
   npm install @bridge-crux/kit@0.3.0 convex
   ```

3. Adopt existing project-local skills. A 0.2 installation has no `.bridgecrux-skills.json`, so 0.3 deliberately treats those directories as unmanaged:

   ```bash
   npx @bridge-crux/skills@0.3.0 install --project . --dry-run
   npx @bridge-crux/skills@0.3.0 install --project . --force
   npx @bridge-crux/skills@0.3.0 doctor --project .
   ```

   Review and preserve any local skill customization before `--force`. Future upgrades use `update` without force while managed hashes remain unchanged.

4. Replace every `crux.config.json` with `schemaVersion: 3`:

   - replace separate route/intent registries with compact nested routes and route-local intents;
   - add one canonical capability for every user outcome, with handler, operations, execution, copy/audit sources, interaction policy, and conversation/headless/declared-surface bindings;
   - add medium-default routing plus evaluation evidence if high is selected;
   - add communication, onboarding, channel-affordance, and product-invariant contracts;
   - add lifecycle/destructive-action contracts where applicable;
   - change Google profiles to exact `gemini-3.5-flash-lite` and remove model-profile thinking, temperature, top-p, and top-k.

5. Update runtime code:

   - rename execution mode `model` to `agentic`;
   - derive `HandlerBinding`s from the capability catalog instead of maintaining a second list;
   - send only `CompactRoutingCatalog` to the task-signal router;
   - treat all hybrid work as high-thinking and all tool-using agentic work as high-thinking;
   - issue model-generated options through validated `InteractionPlan`s;
   - support generalized structured interactions and persisted communication preferences;
   - generate and exercise conversation, headless, and every declared surface.

6. Regenerate and validate:

   ```bash
   npx bridgecrux validate --root cruxes/<crux-id> --operations operations.json
   npx bridgecrux build --root cruxes/<crux-id> --operations operations.json --out generated/<crux-id>
   npx bridgecrux evaluate-routing --cases routing-cases.json --observations routing-observations.json
   npx bridgecrux doctor --project .
   npm test
   npm run build
   ```

7. Run the maintained real-persistence all-route/all-surface simulation. Prove deterministic callback zero-model behavior, typed-text routing, hybrid/agentic thinking and tools, generated-control round trips, operation/persistence outcomes, truthful copy, activity/delivery, and audit.

### Roll Back A 0.2 Migration

Schema 3 and runtime code are not readable by 0.2. Restore the application source and lockfile from version control, reinstall the exact 0.2 packages and skills, and rerun that version’s checks. Reinstalling only npm packages is insufficient.

## Compose Convex

Keep application tables beside BridgeCrux tables:

```ts
import { bridgeCruxTables } from "@bridge-crux/convex";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...bridgeCruxTables,
  records: defineTable({ ownerId: v.string(), status: v.string() }),
});
```

Use `ConvexBridgeCruxRepository` inside database functions. Expose app-owned domain behavior through declared operations. Actions call thin queries/mutations rather than accessing the database directly.

## Configure Providers

Gemini uses `GEMINI_API_KEY`; the default model is `gemini-3.5-flash-lite`. BridgeCrux sends explicit medium/high thinking, a 65,536 output-token maximum, the required safety settings, and no legacy sampling fields.

Telegram uses `TELEGRAM_BOT_TOKEN`. The adapter normalizes messages/callbacks, acknowledges callbacks early, refreshes typing activity, renders safe HTML, validates the shared callback codec, splits output, retries transient failures, and returns provider IDs. Domain intent and mutation authority remain outside the adapter.

Do not store credentials in crux content, reports, checked-in environment files, or handoffs. Doctor commands report presence only.

## Canonical Content And Diagnostics

```text
cruxes/<crux-id>/
  crux.config.json
  system.prompt.md
  assistants.md
  specific-functions/*.md
```

```bash
npx bridgecrux doctor --project . --json
npx @bridge-crux/skills@0.3.0 doctor --project . --json
```

Missing optional live credentials do not fail offline doctor. Detected schema-3, managed-instruction, or installed-skill integrity defects do.
