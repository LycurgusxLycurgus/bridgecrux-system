---
id: neutral-sequence
kind: process
version: 0.3.0
entry_routes:
  - records
advance_operation: process.advance
steps:
  - id: collect
    input:
      mode: closed_choice
      field: answer
      prompt: Choose one of the available answers.
      options:
        - id: continue
          label: Continue
          value: continue
        - id: defer
          label: Decide later
          value: defer
    execution:
      mode: deterministic
      tools: []
    completion: controller
    next_step: verify
    confirmation_policy: never
    missing_field_questions: {}
  - id: verify
    input:
      mode: open_text
      schema:
        type: object
        properties:
          evidence:
            type: string
        required:
          - evidence
      required_fields:
        - evidence
    execution:
      mode: hybrid
      thinking: high
      tools: []
    completion: controller
    confirmation_policy: on_correction
    missing_field_questions:
      evidence: What evidence should be recorded?
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
