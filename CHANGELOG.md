# Changelog

BridgeCrux publishes all public packages and bundled skills at one synchronized
version. Upgrade the runtime packages and installed skills together.

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
