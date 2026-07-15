---
id: neutral-sequence
kind: deterministic_process
version: 0.1.0
entry_routes:
  - records
steps:
  - collect
  - verify
transitions:
  - verify
state_reads:
  - process_runs
state_writes:
  - process_runs
allows_deferral: true
copy_ids:
  - process.collect
  - process.verify
---

# Neutral Sequence

Code owns progression. A deferred item remains pending, keeps its reason and timestamp, does not increase progress, and may be completed later through an explicit reference.
