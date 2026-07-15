# Capability Gap Taxonomy

Use one primary type per finding.

| Type | Meaning | Typical remedy |
|---|---|---|
| `software_capability` | The application cannot perform the requested operation. | Build domain/backend capability first. |
| `task_signal` | A distinct supported user goal has no route. | Add route, handler target, audit contract, and tests. |
| `intent_reading` | The route exists but cannot distinguish the requested conversational action. | Add or strengthen intent and validation. |
| `field_extraction` | The action exists but required arguments cannot be recovered reliably. | Add structured assessment/extraction and validation. |
| `state_contract` | The transition, rollback, ownership, or persistence rule is undefined. | Define state machine and mutation contract. |
| `tool_binding` | The backend operation exists but the agent/router cannot invoke it. | Add handler/tool binding and dispatch. |
| `knowledge_content` | The agent lacks canonical knowledge or specific-function instructions. | Update canonical markdown/content builder inputs. |
| `channel_interface` | The capability exists but is unavailable or malformed in the channel. | Extend channel adapter/UI surface. |
| `external_integration` | Completion depends on an unavailable external service or permission. | Build and monitor the integration. |

Route audits may also use these implementation-defect labels. They are not runtime capability-gap types and must never be shown to the user:

| Audit defect | Meaning | Typical remedy |
|---|---|---|
| `surface_omission` | A user-invokable command, tool, job, or backend operation is absent from the task surface and checklist. | Add the deliberate surface/checklist mapping or mark it internal-only. |
| `guard_divergence` | Two aliases for the same operation apply different validation, reference, or state-transition rules. | Route aliases through one shared guard/controller and add parity regression coverage. |
| `composite_coverage` | A broad checklist row hides independently editable fields or lifecycle actions. | Split the row into stable child paths with preservation contracts. |

Distinguish these common cases:

- Correct route, wrong action interpretation: `intent_reading`.
- Correct intent, missing argument: `field_extraction`.
- Existing mutation, no agent execution path: `tool_binding`.
- Router can name the action but backend cannot do it: `software_capability`.
- Backend could do it, but safe transition rules are missing: `state_contract`.
- User asks to inspect stored domain evidence and receives personalization memory: usually `task_signal` or `intent_reading`, not `knowledge_content`.
- Hidden command bypasses a natural-language validator: audit as `guard_divergence`, then classify any underlying runtime gap separately only if one remains.
