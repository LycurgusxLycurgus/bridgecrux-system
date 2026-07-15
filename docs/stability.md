# Stability Policy

BridgeCrux begins at synchronized version `0.1.0`. All public packages and bundled skills ship from the same repository version. The repository is publish-ready, but repository construction does not publish packages.

## Stable In `0.1.x`

- provider-neutral runtime contracts and the raw/validated decision separation;
- route, intent, handler-binding, operation, and specific-function registries;
- deterministic reference, evidence, mutation, safety, capability-gap, and composite validation rules;
- canonical content tree, parsing, validation, manifest, and TypeScript emission;
- Convex table composition and repository persistence boundaries;
- Gemini `ModelClient` and Telegram `ChannelAdapter` contracts;
- kit CLI commands and skills installer/managed-block behavior;
- ESM-only Node.js 22+ package contract.

Compatible `0.1.x` changes may add diagnostics, optional fields, internal tests, or backward-compatible helpers. Existing stable fields and command meanings are not removed within the line.

## Experimental In `0.1.x`

- generic multi-operation orchestration beyond the proven neutral path;
- reusable deterministic-process and specific-function controllers across multiple real cruxes;
- user-copy lint breadth and locale-specific copy policy;
- automatic memory proposal semantics;
- report classification, repair proposals, and feedback evaluation workflows;
- model tool-loop policy beyond the first filtered structured-call implementation;
- additional providers, channels, and persistence backends.

Experimental APIs are marked in source where they are exposed. They require evidence from at least one additional real crux before promotion.

## Change Discipline

Raw model output remains non-authoritative in every version. Changes that weaken deterministic mutation authorization, durable state truth, auditability, or truthful user copy require a new contract decision and cannot be treated as a patch.

The two supplied skills remain byte-for-byte source assets. Their package copies are generated and hash-verified. The framework-owned coordinator skill may evolve with runtime contracts while preserving its mandatory coordination role.
