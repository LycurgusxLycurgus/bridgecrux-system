# Changelog

BridgeCrux publishes all public packages and bundled skills at one synchronized
version. Upgrade the runtime packages and installed skills together.

## 0.3.0 - 2026-08-26

### Breaking Changes

- Removed schema 2, separate route/intent execution maps, and execution mode
  `model`. Canonical content requires `schemaVersion: 3`, nested compact routes,
  route-local intents, and a canonical capability catalog. Runtime policy uses
  `agentic`; no compatibility parser or alias is retained.
- Hybrid execution is always high-thinking. Agentic execution is medium only
  for knowledge-only work and high for complex or any tool-using work.
- Google profiles use exact `gemini-3.5-flash-lite`. Model profiles reject
  thinking and legacy `temperature`, `topP`, and `topK` sampling fields.
- Handler bindings are derived from the capability catalog. `RouterInput`
  accepts a compact routing catalog rather than the full registry.

### Added

- One capability contract for user outcome, route-local intent, handler,
  operations, execution, copy/audit authority, interactions, lifecycle, and
  conversation/headless/declared-surface parity. Every surface declares access
  plus loading, success, error, and optional empty behavior.
- Static detection for duplicate route summaries, intent discriminators,
  aliases, capability paths, and outcome descriptions, plus enhanced
  all-route/all-surface simulation evidence.
- `InteractionPlan` validation for high-thinking hybrid 2–4 option procedural
  UX with channel-safe IDs, free-text continuation, expiry, and no implicit
  mutation authority.
- `bridgecrux evaluate-routing` for deterministic medium-vs-high comparison
  evidence and `bridgecrux doctor` checks for schema 3, managed instructions,
  and project-local skill state.
- Generated `capability-surface.generated.md` headless output, onboarding and
  channel-affordance contracts, communication-style preference persistence,
  artifact/destructive lifecycle contracts, and typed product invariants.
- Transactional skill `install`, `update`, `uninstall`, and `doctor` with
  integrity hashes, managed ownership state, collision protection, staging,
  rollback, dry-run, explicit force, and project-local default targeting.

### Changed And Fixed

- Every user-authored textual turn uses medium freeform routing unless a passed
  comparison evaluation proves high necessary. Only a trusted active
  deterministic choice bypasses routing; typed text still routes.
- Gemini requests now use 65,536 maximum output tokens, explicit medium/high
  thinking, the BridgeCrux safety configuration, and no legacy sampling fields.
- Telegram validates outbound controls through the same codec used inbound,
  acknowledges callbacks early, renders safe HTML, and refreshes typing during
  noticeable work.
- Canonical skills now teach one agentic application across all presentations,
  compact route design, semantic parity, generated interactions, product
  invariants, and real-persistence conformance. The prompt skill uses focused
  progressive-disclosure references instead of one oversized instruction file.

### Upgrade Notes

- Follow [Migrate 0.2.x To 0.3.0](docs/installation.md#migrate-02x-to-030).
  Runtime and skills must use the same exact version.
- Existing 0.2 project-local skills have no managed ownership state. Preview
  with `install --dry-run`, preserve local changes, then explicitly adopt once
  with `install --force`; later upgrades use `update`.
- Rollback requires restoring schema-2 application source and lockfiles from
  version control as well as reinstalling the exact 0.2 packages and skills.

## 0.2.0 - 2026-07-21

### Breaking Changes

- Removed the 0.1.1 content and process contracts. Schema version 1,
  model-profile `thinking`, router `needsHighThinking`,
  `specific-functions/deterministic-processes.md`, `kind:
  deterministic_process`, and the old deterministic-process public API names
  are not accepted or aliased in 0.2.0.
- Canonical content now requires `schemaVersion: 2`, medium freeform routing,
  one execution policy per route/intent, `specific-functions/processes.md`, and
  structured per-step process contracts.
- Runtime bindings now require `executionPolicy`. Runtime ports require a turn
  lease store; applications using closed-choice controls also provide structured
  interaction persistence. Convex `repositoryPorts` supplies both.

### Added

- Universal deterministic, hybrid, and model execution contracts. Established
  process difficulty, thinking level, completion authority, context, and tools
  are fixed before entry.
- Code-only deterministic process turns for server-issued closed choices, with
  zero router, assessment, tutor, and tool-model calls.
- Scoped medium/high model tools for hybrid and model paths while operation
  validation and persistence remain code-authorized.
- Model assessment hooks that return normalized fields, missing fields,
  proposed corrections, confidence, and typed reasons; domain validators can
  downgrade readiness without authorizing persistence.
- Telegram typing refresh, callback acknowledgement, inline choices, durable
  identity/step validation, replay protection, and per-user/thread turn leases.
- `InMemoryCruxRuntime` and `auditAllRouteSimulation` for real-persistence route
  simulations and duplicate/contradiction checks.
- Generated route checklists, handler stubs, and regression scenarios from the
  canonical content contract.

### Changed

- Freeform routing now uses medium thinking. Validated route policy selects
  deterministic code, medium/high hybrid execution, medium knowledge/simple
  model work, or high agentic model work.
- The three skills and managed instruction block now require agents to load
  versioned BridgeCrux knowledge for nearly every relevant turn and never fill
  framework knowledge gaps from model memory.
- Public process APIs are now `ActiveProcess`, `ProcessDefinition`,
  `ProcessController`, `DefaultProcessController`, and `ProcessRegistry`.

### Upgrade Notes

- Follow [Migrate 0.1.1 To 0.2.0](docs/installation.md#migrate-011-to-020)
  before running the content builder. Runtime and skills must be upgraded to the
  same exact version.
- Rollback requires restoring 0.1.1 application source contracts from version
  control as well as reinstalling the 0.1.1 packages and skills.

## 0.1.1 - 2026-07-20

### Changed

- Added project-local skill installation under `.codex/skills/` as the
  recommended per-application setup while preserving explicit global installs.
- Defaulted new Gemini integrations to stable `gemini-3.1-flash-lite`, with
  high thinking for agentic behavior and medium thinking only for declared
  knowledge-only chat without tools or active work.
- Added Telegram-safe HTML rendering for ordinary Markdown output.
- Expanded `anticipate-crux-routes` with a duplicate/contradiction audit and one
  maintained all-route simulation requirement.

### Upgrade Notes

- Reinstall both `@bridge-crux/kit` and `@bridge-crux/skills` at `0.1.1`; the
  skills installer safely replaces the three BridgeCrux skill directories and
  refreshes its managed instruction block.
- Telegram formatting now defaults to HTML rendering. Applications that require
  deliberately unformatted output can construct `TelegramChannelAdapter` with
  `formatting: "plain"`.
- Configure truly knowledge-only routes through
  `tutor.knowledgeOnlyChatRoutes`. All other model-backed agentic behavior stays
  at high thinking, and medium-thinking chat cannot use tools.
- Review and commit regenerated project-local skills and managed instructions
  according to the consuming repository's tracking policy.

## 0.1.0 - 2026-07-15

- Initial public release of the synchronized BridgeCrux package set, runtime
  primitives, Convex persistence, Gemini and Telegram adapters, content tooling,
  CLI, conformance suite, and three installable Agent Skills.
