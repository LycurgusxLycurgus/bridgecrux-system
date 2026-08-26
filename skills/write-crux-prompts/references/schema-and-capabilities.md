# Schema 3 And Capability Catalog

`crux.config.json` is the executable content index. BridgeCrux 0.3 accepts only `schemaVersion: 3`; the 0.2 `routeRegistry`, `intentRegistry`, and `execution.routes` shapes are removed rather than supported in parallel.

## Required Top-Level Contracts

Declare:

- crux identity, version, locale, conversation window, and product surfaces;
- compact nested `routes`, where each route has a short discriminator summary and route-local intents;
- canonical `capabilities`;
- model profiles and routing policy;
- communication styles and selection ownership;
- onboarding parity and channel affordances;
- independently verifiable product invariants;
- memory, capability-gap, and feedback policy.

## Capability Contract

One capability represents one user-visible outcome. It declares:

- stable `id`, title, and outcome description;
- exactly one route and route-local intent;
- exactly one handler and its authorized operation IDs;
- fixed execution policy and tool IDs;
- allowed copy sources and audit events;
- semantic bindings for `conversation`, generated `headless`, and every configured product surface;
- interaction policy: none, authored choices, or generated choices;
- a deterministic justification when deterministic;
- artifact lifecycle, destructive-action, or internal-only declarations when applicable.

Every route-local intent names its capability ID, and every capability names that same route/intent pair. Two capabilities cannot own one path. Duplicate route summaries, intent summaries, outcome descriptions, or overlapping aliases are defects because they make routing or product ownership ambiguous.

## Semantic Surface Parity

Surface parity means the same handler, operation authority, durable state, and result semantics are reachable from each declared presentation. It does not require identical layout or copy.

Every public capability binds:

- `conversation`: natural language, commands, or trusted controls;
- `headless`: an inspectable operation-oriented entrypoint even when no visual UI exists;
- every configured UI or channel surface.

Mark a surface `presentationOnly` only when another binding remains authoritative, and provide a rationale. Mark a capability `internalOnly` only with a reason.

For each visible affordance, the application—not only the prompt—must define its operation binding, authentication behavior, loading/activity state, success state, empty state, error state, and regression path.

## Durable Artifact Lifecycle

If a capability produces a saved artifact, declare create, persist, rediscover, reopen, and optional archive/delete operations. Declare novelty and idempotency policy. A transient UI card is not a durable artifact, and model participation is not proof that an artifact is novel.

Destructive actions require a server-issued confirmation, ownership validation, positive expiry, single-use consumption, outcome audit, and equivalent behavior on every surface.

## Product Invariants

Use typed invariants for product truth that can drift across layers, including:

- promised surface completeness;
- canonical ordering;
- source/provenance meaning;
- versioned preference defaults and migrations;
- forward-compatible authentication fields;
- intended hosting audience.

Each invariant needs a stable ID, clear description, and real verification IDs. Do not let the same default or order live independently in prompts, persistence, UI, and channel code.
