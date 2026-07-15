---
name: neutral-conformance-assistants
description: Route neutral task signals through validated operations.
version: 0.1.0
---

# Neutral Conformance Assistant Behavior

## Task-Signal Smart Router

| Task signal | Route | Intent | State/reference preconditions | Mutation candidate | Deterministic validator | Handler/operation | User-copy source | Audit evidence |
|---|---|---|---|---|---|---|---|---|
| Inspect a persisted record | records | inspect | Resolve explicit record, then active fallback | none | Read authorization | records.inspect | high-thinking tutor | route and read ledger |
| Complete a persisted record with evidence | records | complete | Resolve target and sufficient evidence | complete_record | Evidence and transition gates | records.complete | high-thinking tutor | route and mutation ledger |
| Request an unavailable execution | conversation | unsupported_execution | Explicit execution and report persistence | none | CapabilityGapGate | capability-gap report | safe fallback | open capability-gap report |

## Validation Gate

A route is complete only when recognition, validation, binding, operation, persistence, copy, and audit evidence agree.
