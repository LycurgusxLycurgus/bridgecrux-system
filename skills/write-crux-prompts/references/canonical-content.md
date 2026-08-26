# Canonical Content

## `system.prompt.md`

Define product identity, user outcome, domain vocabulary, non-goals, durable-state truth, privacy/safety/authorization boundaries, communication-style application, copy rules, capability-gap behavior, and the model’s relationship to handlers and tools. Keep stable product facts here; keep task discrimination in `assistants.md`.

The selected `casual` or `pragmatic` style may change wording, never facts, permissions, operation authority, safety, or success claims. Casual language still passes a comprehension gate: the meaning must remain clear without the joke or cultural reference.

## `assistants.md`

Describe the compact hierarchical router and the structured raw decision schema. Include:

- coarse route and route-local intent discriminators;
- speech act, temporal stance, references, mutation evidence, safety flag, extracted fields, confidence, and reason;
- composite compatibility rules;
- the rule that aliases provide evidence but never directly execute;
- representative boundary examples and corrections, not an exhaustive phrase list.

Do not duplicate capability operations, lifecycle, or surface descriptions here. Those live in `crux.config.json` and specific functions.

## Specific Functions

Each `specific-functions/<function>.md` frontmatter names its stable ID/version, routes, intents, tools, state reads/writes, and copy IDs. Its body defines evidence mapping, handler behavior, missing/ambiguous references, operation sequencing, authorization, errors, audit, and user-visible outcomes.

The declarations must match real code. If a function is unavailable, write a capability gap; do not describe a simulated success.

## Established Processes

A process declares entry routes, advance operation, state reads/writes, deferral, and ordered steps. Each step declares input mode/schema, fixed deterministic or hybrid execution, completion mode, confirmation policy, missing-field questions, and transition.

Use deterministic steps only for closed authored choices that can be validated without interpretation. Use hybrid high-thinking assessment for open text, composite fields, ambiguity, correction, normalization, or dynamic options. The assessment may propose normalized fields, missing fields, corrections, and confidence, but cannot authorize persistence. Domain validators may downgrade ready to partial with typed reasons.

## Onboarding And Channels

First message, `/`, `/start`, and `/help` share a complete capability introduction. Configure channel commands, descriptions, menu/open controls, and intended audience as product contracts. Noticeable channel work starts activity immediately and refreshes it best-effort. Telegram uses safe HTML, a shared outbound/inbound callback codec, early callback acknowledgement, and bounded callback IDs.

Prefer one typed authenticated command endpoint in constrained embedded WebViews when multiple path-specific preflights are unreliable. Authentication validation preserves unknown signed fields and distinguishes invalid, expired, transport, validation, and operation failures.

## Validation

Run:

```sh
npx bridgecrux validate --root cruxes/<crux-id> --operations <operations.json>
npx bridgecrux build --root cruxes/<crux-id> --operations <operations.json>
npx bridgecrux evaluate-routing --cases <cases.json> --observations <observations.json>
npx bridgecrux doctor --project .
```

Then run one real-persistence simulation that covers every route, intent, capability, handler, operation, expected execution/thinking/tool policy, conversation/headless/declared surface, control round trip, success/failure copy, and durable result. Mocked operation success alone is insufficient.
