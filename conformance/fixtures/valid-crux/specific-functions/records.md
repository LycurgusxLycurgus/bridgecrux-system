---
id: neutral-records
kind: specific_function
title: Neutral Records
version: 0.1.0
routes:
  - records
intents:
  - inspect
  - complete
tools:
  - records.inspect
  - records.complete
state_reads:
  - records
state_writes:
  - records
copy_ids:
  - records.completed
---

# Neutral Records

## Domain Contract

A record can be inspected without mutation. Completion requires explicit target resolution, present or past evidence, and a successful persisted operation. Partial updates preserve omitted fields and historical evidence.

## Audit And Regression Contract

Verification covers routing, reference resolution, evidence, binding, persistence, response, and audit together.
