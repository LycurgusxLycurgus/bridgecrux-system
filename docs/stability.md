# Stability Policy

All public packages and bundled skills share one version. Framework-development agents prepare and validate releases but do not publish unless the user explicitly assigns release authority.

## The 0.3 Contract

0.3.0 is a deliberate pre-1.0 breaking release. It removes schema 2, `execution.routes`, and execution mode `model`; no compatibility parser or alias exists.

Stable in 0.3:

- schema-3 capability catalog as the source for routes, bindings, operations, copy/audit authority, interaction, lifecycle, and surfaces;
- semantic parity across conversation, generated headless, and declared UI/channel surfaces;
- compact coarse routes with route-local intents and duplicate/contradiction auditing;
- medium-default freeform routing with an evaluation contract for any high escalation;
- fixed deterministic, high-hybrid, and medium/high-agentic policies;
- zero-model active deterministic choices and routed typed text;
- validated generated procedural choices that retain free-text continuation and never authorize persistence;
- code-owned operation authorization, preservation, idempotency, persistence, audit, and success copy;
- structured processes and domain validation that may downgrade model assessment;
- Convex generalized interactions, communication preferences, and turn leases;
- exact Gemini 3.5 Flash-Lite request policy and Telegram safe HTML/activity/control lifecycle;
- onboarding, channel-affordance, artifact-lifecycle, destructive-action, and typed product-invariant contracts;
- safe project-local skill install/update/uninstall/doctor with hashes, staging, rollback, and bounded instructions;
- real-persistence all-route/all-surface conformance and clean packed-consumer installation;
- ESM-only Node.js 22+ packages.

Compatible 0.3.x changes may add diagnostics, optional metadata, tests, or backward-compatible helpers. Stable field meanings and command behavior are not removed inside the line.

## Experimental In 0.3.x

- broad orchestration across several simultaneous validated signals;
- additional model providers, channels, and persistence backends;
- automatic generation of production UI implementation from the headless surface;
- broad multilingual copy linting;
- automatic memory-proposal semantics;
- automatic report repair or deployment.

Promotion requires evidence from another production crux and conformance coverage.

## Change Discipline

Raw model output remains non-authoritative. Any change that weakens capability parity, validated execution policy, deterministic authorization, tool scoping, durable truth, idempotency, auditability, or truthful copy is a new contract decision—not a patch.

The three canonical skills, bundled copies, managed instructions, public docs, package versions, and runtime behavior evolve together so consuming agents never have to guess BridgeCrux from model memory.
