# Routing And Execution

## Hierarchical Router

Send the model a compact catalog containing only coarse route IDs/summaries and their route-local intent IDs/summaries/aliases. Do not send the full capability, lifecycle, persistence, or surface graph as routing prose. The runtime attaches the validated capability and handler binding after routing.

Every user-authored textual turn goes through the freeform router. Use medium thinking by default. High router thinking is allowed only after the same representative corpus is run at medium and high, medium fails the declared accuracy/consistency thresholds, high passes, and evidence is recorded in the schema-3 routing contract.

Exact commands and aliases are evidence, not execution authority. A topic word must not shadow whole-turn intent. Post-router code validates route/intent existence, references, state, mutation evidence, operation scope, composite compatibility, and handler binding.

## Fixed Execution Modes

| Mode | Valid use | Thinking | Tools |
| --- | --- | --- | --- |
| deterministic | A predeclared code path, especially an active closed-choice process step | none after entry | none |
| hybrid | Model interpretation or dynamic 2–4 option procedural UX followed by code validation/execution | high | capability/process scoped only |
| agentic | Open explanation, planning, or task execution | medium for knowledge-only; high for complex or any tool-using work | capability scoped only |

Execution mode, thinking level, context, tools, and completion mode are fixed before a capability or established process begins. Router output cannot weaken or widen them.

An active deterministic step bypasses routing only when the inbound value is a server-issued, user/session/process/step-scoped, replay-safe closed choice. Typed free text is not a deterministic answer; route it normally. Deterministic processing makes zero model calls.

## Generated Procedural UX

A hybrid model may propose an `InteractionPlan` with a prompt, field, capability path, and two to four contextual choices. Code must validate:

- the capability and path exist and are hybrid;
- the capability permits generated choices;
- option IDs are channel safe and unique;
- labels are bounded and distinct;
- expiry is valid;
- free-text continuation remains available.

Persist the issued control with user/session/capability/route/intent scope. On selection, consume it once and treat the value as interpretation evidence only. The choice never authorizes mutation; ordinary validation and operation policy still apply.

## Tool And Persistence Authority

The model can call only tools present in the validated capability or active process policy. Tool-using agentic and all hybrid work use high thinking. Code validates inputs, resolves durable references, authorizes operations, applies preconditions and idempotency, performs persistence, and gates copy against actual operation results.

Do not claim saved, deleted, sent, published, or updated until the relevant operation succeeded. If interpretation is partial, retain understood fields and ask only for missing information; parser failure must not fall through to an unrelated renderer.
