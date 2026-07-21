# Stability Policy

BridgeCrux publishes every public package and bundled skill at one synchronized
version. The repository is publish-ready, but framework development does not
publish unless the user explicitly assigns release authority.

## The 0.2 Contract

Version 0.2.0 is a deliberate pre-1.0 breaking release. It removes the 0.1.1
content schema, model-profile thinking flags, `needsHighThinking`, and the old
deterministic-process public names. There is no compatibility parser or runtime
alias. Consumers must follow the migration checklist in `docs/installation.md`.

The stable 0.2 line includes:

- raw and validated task-signal separation, with medium-thinking freeform
  routing that cannot authorize effects or choose execution policy;
- predeclared deterministic, hybrid, and model policies on every binding and
  process step, including fixed thinking and tool allowlists;
- deterministic active-process turns restricted to trusted closed choices and
  zero model calls;
- model-assisted process assessment with typed partial/correction results and
  code-owned domain validation, operation authorization, and persistence;
- canonical schema version 2, `specific-functions/processes.md`, generated
  route checklists, handler stubs, and regression scenarios;
- composable Convex persistence, single-use structured interactions, and
  expiring correlation-owned turn leases;
- Gemini `gemini-3.1-flash-lite` medium/high execution and Telegram safe HTML,
  typing lifecycle, callback acknowledgement, and inline controls;
- the in-memory conformance runtime, all-route simulation audit, kit CLI, and
  skills installer/managed-block behavior;
- ESM-only Node.js 22+ packages.

Compatible 0.2.x changes may add diagnostics, optional metadata, tests, or
backward-compatible helpers. Stable fields and command meanings are not removed
within the line.

## Experimental In 0.2.x

- generic orchestration across several simultaneous route signals;
- reusable process/domain controllers across additional production cruxes;
- user-copy lint breadth and locale-specific copy policy;
- automatic memory proposal semantics;
- report classification, repair proposals, and feedback evaluation workflows;
- additional providers, channels, and persistence backends.

Experimental APIs are marked in source. They need evidence from at least one
additional real crux before promotion.

## Change Discipline

Raw model output remains non-authoritative in every version. Changes that weaken
validated execution policy, deterministic mutation authorization, durable state
truth, tool scoping, auditability, or truthful user copy require a new contract
decision and cannot be treated as a patch.

The three source skills are integrity-bundled into the skills package. Their
managed instruction block and runtime guidance evolve with the same synchronized
version so an installed agent never has to guess BridgeCrux behavior from model
memory.
