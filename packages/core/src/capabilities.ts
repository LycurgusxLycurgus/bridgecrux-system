import { Buffer } from "node:buffer";
import type {
  CapabilityContract,
  CompactRoutingCatalog,
  HandlerBinding,
  HandlerBindingIssue,
  InteractionPlan,
  InteractionPlanValidationResult,
  IntentContract,
  RouteRegistryDefinition,
} from "./contracts.js";

export function compactRoutingCatalog(definition: RouteRegistryDefinition): CompactRoutingCatalog {
  return {
    routes: definition.routes.map((route) => ({
      id: route.id,
      summary: route.summary,
      intents: route.intents.map((intent) => ({
        id: intent.id,
        summary: intent.summary,
        ...(intent.aliases ? { aliases: [...intent.aliases] } : {}),
      })),
    })),
  };
}

export class CapabilityRegistry {
  readonly #capabilities = new Map<string, CapabilityContract>();
  readonly #paths = new Map<string, CapabilityContract>();
  readonly #intents = new Map<string, IntentContract>();

  constructor(readonly definition: RouteRegistryDefinition) {
    const issues = auditCapabilityCatalog(definition);
    if (issues.length > 0) {
      throw new Error(`Invalid capability catalog:\n- ${issues.map((issue) => issue.message).join("\n- ")}`);
    }
    for (const route of definition.routes) {
      for (const intent of route.intents) this.#intents.set(pathKey(route.id, intent.id), intent);
    }
    for (const capability of definition.capabilities) {
      this.#capabilities.set(capability.id, capability);
      this.#paths.set(pathKey(capability.route, capability.intent), capability);
    }
  }

  capability(id: string): CapabilityContract | undefined {
    return this.#capabilities.get(id);
  }

  forPath(route: string, intent: string): CapabilityContract | undefined {
    return this.#paths.get(pathKey(route, intent));
  }

  intent(route: string, intent: string): IntentContract | undefined {
    return this.#intents.get(pathKey(route, intent));
  }

  list(): CapabilityContract[] {
    return [...this.#capabilities.values()];
  }

  bindings(): HandlerBinding[] {
    return this.list().map((capability) => capabilityBinding(capability, this.intent(capability.route, capability.intent)!));
  }
}

export function capabilityBinding(capability: CapabilityContract, intent: IntentContract): HandlerBinding {
  return {
    capabilityId: capability.id,
    route: capability.route,
    intent: capability.intent,
    handlerId: capability.handlerId,
    allowedMutationClasses: [...intent.mutationClasses],
    requiredState: [...intent.requiredState],
    operationIds: [...capability.operationIds],
    executionPolicy: capability.executionPolicy,
    copySources: [...capability.copySources],
    auditEvents: [...capability.auditEvents],
  };
}

export function auditCapabilityCatalog(
  definition: RouteRegistryDefinition,
  operationIds?: Iterable<string>,
): HandlerBindingIssue[] {
  const issues: HandlerBindingIssue[] = [];
  const declaredOperations = operationIds ? new Set(operationIds) : undefined;
  const declaredSurfaceList = ["conversation", "headless", ...definition.surfaces];
  const expectedSurfaces = new Set(declaredSurfaceList);
  const routes = new Map<string, Map<string, IntentContract>>();
  const capabilityIds = new Set<string>();
  const capabilityPaths = new Set<string>();
  const routeSummaries = new Map<string, string>();
  const intentSummaries = new Map<string, string>();
  const aliasesByPath = new Map<string, string>();
  const capabilityDescriptions = new Map<string, string>();

  for (const surface of expectedSurfaces) {
    if (!surface.trim()) issues.push(issue("capability_parity", "Capability surface ids cannot be empty"));
  }
  if (expectedSurfaces.size !== declaredSurfaceList.length) {
    issues.push(issue("capability_parity", "Capability surfaces must be unique"));
  }

  for (const route of definition.routes) {
    if (!route.id.trim() || routes.has(route.id)) {
      issues.push(issue("route_overlap", `Duplicate or empty route id ${route.id || "<empty>"}`, route.id));
      continue;
    }
    if (!route.summary.trim()) issues.push(issue("route_overlap", `Route ${route.id} requires a compact routing summary`, route.id));
    const normalizedRouteSummary = normalizeSemanticText(route.summary);
    const priorRoute = routeSummaries.get(normalizedRouteSummary);
    if (normalizedRouteSummary && priorRoute) issues.push(issue("route_overlap", `Routes ${priorRoute} and ${route.id} have duplicate routing summaries`, route.id));
    else if (normalizedRouteSummary) routeSummaries.set(normalizedRouteSummary, route.id);
    const intents = new Map<string, IntentContract>();
    routes.set(route.id, intents);
    for (const intent of route.intents) {
      if (!intent.id.trim() || intents.has(intent.id)) {
        issues.push(issue("route_overlap", `Duplicate or empty intent ${route.id}/${intent.id || "<empty>"}`, route.id, intent.id));
        continue;
      }
      if (!intent.summary.trim()) issues.push(issue("route_overlap", `Intent ${route.id}/${intent.id} requires a discriminator summary`, route.id, intent.id));
      const normalizedIntentSummary = normalizeSemanticText(intent.summary);
      const priorIntent = intentSummaries.get(normalizedIntentSummary);
      if (normalizedIntentSummary && priorIntent) issues.push(issue("route_overlap", `Intents ${priorIntent} and ${route.id}/${intent.id} have duplicate discriminator summaries`, route.id, intent.id));
      else if (normalizedIntentSummary) intentSummaries.set(normalizedIntentSummary, `${route.id}/${intent.id}`);
      if (!intent.capabilityId.trim()) issues.push(issue("capability_parity", `Intent ${route.id}/${intent.id} requires a capability id`, route.id, intent.id));
      const aliases = intent.aliases ?? [];
      if (new Set(aliases).size !== aliases.length) issues.push(issue("route_overlap", `Intent ${route.id}/${intent.id} contains duplicate aliases`, route.id, intent.id));
      for (const alias of aliases) {
        const normalizedAlias = normalizeSemanticText(alias);
        const priorAlias = normalizedAlias ? aliasesByPath.get(normalizedAlias) : undefined;
        if (priorAlias) issues.push(issue("route_overlap", `Alias ${alias} overlaps ${priorAlias} and ${route.id}/${intent.id}`, route.id, intent.id));
        else if (normalizedAlias) aliasesByPath.set(normalizedAlias, `${route.id}/${intent.id}`);
      }
      intents.set(intent.id, intent);
    }
  }

  for (const capability of definition.capabilities) {
    if (!capability.id.trim() || capabilityIds.has(capability.id)) {
      issues.push(issue("capability_parity", `Duplicate or empty capability id ${capability.id || "<empty>"}`, capability.route, capability.intent));
      continue;
    }
    capabilityIds.add(capability.id);
    const path = pathKey(capability.route, capability.intent);
    if (capabilityPaths.has(path)) issues.push(issue("route_overlap", `Multiple capabilities bind ${capability.route}/${capability.intent}`, capability.route, capability.intent));
    capabilityPaths.add(path);
    const intent = routes.get(capability.route)?.get(capability.intent);
    if (!intent) {
      issues.push(issue("capability_parity", `Capability ${capability.id} references undeclared path ${capability.route}/${capability.intent}`, capability.route, capability.intent));
    } else if (intent.capabilityId !== capability.id) {
      issues.push(issue("capability_parity", `Intent ${capability.route}/${capability.intent} names ${intent.capabilityId} but capability ${capability.id} owns the path`, capability.route, capability.intent));
    }
    if (!capability.title.trim() || !capability.description.trim() || !capability.handlerId.trim()) {
      issues.push(issue("affordance_binding", `Capability ${capability.id} requires title, description, and handlerId`, capability.route, capability.intent));
    }
    const normalizedDescription = normalizeSemanticText(capability.description);
    const priorCapability = capabilityDescriptions.get(normalizedDescription);
    if (normalizedDescription && priorCapability) issues.push(issue("route_overlap", `Capabilities ${priorCapability} and ${capability.id} have duplicate outcome descriptions`, capability.route, capability.intent));
    else if (normalizedDescription) capabilityDescriptions.set(normalizedDescription, capability.id);
    if (new Set(capability.operationIds).size !== capability.operationIds.length) {
      issues.push(issue("affordance_binding", `Capability ${capability.id} contains duplicate operations`, capability.route, capability.intent));
    }
    for (const operationId of capability.operationIds) {
      if (declaredOperations && !declaredOperations.has(operationId)) {
        issues.push({ ...issue("handler_binding", `Capability ${capability.id} references missing operation ${operationId}`, capability.route, capability.intent), operationId });
      }
    }
    validateExecution(capability, issues);
    validateSurfaces(capability, expectedSurfaces, issues);
    validateLifecycle(capability, issues);
  }

  for (const [routeId, intents] of routes) {
    for (const intent of intents.values()) {
      if (!capabilityIds.has(intent.capabilityId)) {
        issues.push(issue("capability_parity", `Intent ${routeId}/${intent.id} references missing capability ${intent.capabilityId}`, routeId, intent.id));
      }
    }
  }
  return issues;
}

function normalizeSemanticText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ");
}

export function validateInteractionPlan(
  plan: InteractionPlan,
  definition: RouteRegistryDefinition,
  now = Date.now(),
): InteractionPlanValidationResult {
  const issues: string[] = [];
  let registry: CapabilityRegistry | undefined;
  try {
    registry = new CapabilityRegistry(definition);
  } catch (error) {
    return { ok: false, issues: [error instanceof Error ? error.message : "Capability catalog is invalid"] };
  }
  const capability = registry.capability(plan.capabilityId);
  if (!capability || capability.route !== plan.route || capability.intent !== plan.intent) {
    issues.push(`Generated interaction references undeclared capability path ${plan.capabilityId}:${plan.route}/${plan.intent}`);
  } else {
    if (capability.executionPolicy.mode !== "hybrid") issues.push(`Generated interactions require a hybrid capability; ${capability.id} is ${capability.executionPolicy.mode}`);
    if (capability.interaction.mode !== "generated_choices") issues.push(`Capability ${capability.id} does not allow generated choices`);
  }
  if (!plan.prompt.trim() || !plan.field.trim()) issues.push("Generated interaction requires a prompt and field");
  if (plan.options.length < 2 || plan.options.length > 4) issues.push("Generated interaction requires two to four options");
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const option of plan.options) {
    if (!/^[A-Za-z0-9_-]+$/u.test(option.id) || Buffer.byteLength(option.id, "utf8") > 24) issues.push(`Option ${option.id || "<empty>"} has an unsafe channel id`);
    if (!option.label.trim() || [...option.label].length > 80) issues.push(`Option ${option.id || "<empty>"} requires a label of at most 80 characters`);
    if (ids.has(option.id)) issues.push(`Duplicate option id ${option.id}`);
    if (labels.has(option.label.trim().toLocaleLowerCase())) issues.push(`Duplicate option label ${option.label}`);
    ids.add(option.id);
    labels.add(option.label.trim().toLocaleLowerCase());
  }
  if (plan.expiresAt !== undefined && (!Number.isFinite(plan.expiresAt) || plan.expiresAt <= now)) issues.push("Generated interaction expiry must be in the future");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    control: {
      id: "pending",
      kind: "generated_clarification",
      capabilityId: plan.capabilityId,
      route: plan.route,
      intent: plan.intent,
      field: plan.field,
      prompt: plan.prompt,
      options: plan.options,
      allowFreeText: true,
      ...(plan.expiresAt !== undefined ? { expiresAt: plan.expiresAt } : {}),
    },
  };
}

function validateExecution(capability: CapabilityContract, issues: HandlerBindingIssue[]): void {
  const policy = capability.executionPolicy;
  if (policy.mode === "deterministic") {
    if (!capability.deterministicJustification?.trim()) issues.push(issue("execution_policy", `Deterministic capability ${capability.id} requires a justification`, capability.route, capability.intent));
    if (policy.toolIds.length > 0) issues.push(issue("execution_policy", `Deterministic capability ${capability.id} cannot expose model tools`, capability.route, capability.intent));
    if (capability.interaction.mode === "generated_choices") issues.push(issue("execution_policy", `Deterministic capability ${capability.id} cannot generate choices`, capability.route, capability.intent));
  } else if (policy.mode === "hybrid") {
    if (policy.thinkingLevel !== "high") issues.push(issue("execution_policy", `Hybrid capability ${capability.id} requires high thinking`, capability.route, capability.intent));
  } else if (policy.toolIds.length > 0 && policy.thinkingLevel !== "high") {
    issues.push(issue("execution_policy", `Tool-using agentic capability ${capability.id} requires high thinking`, capability.route, capability.intent));
  }
  for (const toolId of policy.toolIds) {
    if (!capability.operationIds.includes(toolId)) issues.push(issue("execution_policy", `Capability ${capability.id} exposes tool ${toolId} outside its operations`, capability.route, capability.intent));
  }
}

function validateSurfaces(
  capability: CapabilityContract,
  expectedSurfaces: Set<string>,
  issues: HandlerBindingIssue[],
): void {
  if (capability.internalOnly) {
    if (!capability.internalReason?.trim()) issues.push(issue("capability_parity", `Internal capability ${capability.id} requires a reason`, capability.route, capability.intent));
    return;
  }
  const bindings = new Map<string, CapabilityContract["surfaces"][number]>();
  for (const binding of capability.surfaces) {
    if (!binding.surface.trim() || bindings.has(binding.surface)) issues.push(issue("capability_parity", `Capability ${capability.id} has a duplicate or empty surface`, capability.route, capability.intent));
    if (!expectedSurfaces.has(binding.surface)) issues.push(issue("capability_parity", `Capability ${capability.id} binds undeclared surface ${binding.surface}`, capability.route, capability.intent));
    if (binding.entrypoints.length === 0 || binding.entrypoints.some((entrypoint) => !entrypoint.trim())) issues.push(issue("affordance_binding", `Capability ${capability.id}/${binding.surface} requires concrete entrypoints`, capability.route, capability.intent));
    if (!binding.access || !binding.states?.loading?.trim() || !binding.states.success?.trim() || !binding.states.error?.trim()) issues.push(issue("affordance_binding", `Capability ${capability.id}/${binding.surface} requires access plus loading, success, and error states`, capability.route, capability.intent));
    if (binding.presentationOnly && !binding.rationale?.trim()) issues.push(issue("capability_parity", `Presentation-only surface ${capability.id}/${binding.surface} requires a rationale`, capability.route, capability.intent));
    bindings.set(binding.surface, binding);
  }
  for (const surface of expectedSurfaces) {
    if (!bindings.has(surface)) issues.push(issue("capability_parity", `Capability ${capability.id} is missing surface ${surface}`, capability.route, capability.intent));
  }
}

function validateLifecycle(capability: CapabilityContract, issues: HandlerBindingIssue[]): void {
  if (capability.lifecycle) {
    const operations = [
      capability.lifecycle.createOperationId,
      capability.lifecycle.persistOperationId,
      capability.lifecycle.rediscoverOperationId,
      capability.lifecycle.reopenOperationId,
      capability.lifecycle.archiveOperationId,
      capability.lifecycle.deleteOperationId,
    ].filter((value): value is string => Boolean(value));
    for (const operationId of operations) {
      if (!capability.operationIds.includes(operationId)) issues.push(issue("lifecycle_contract", `Capability ${capability.id} lifecycle operation ${operationId} is outside its operation set`, capability.route, capability.intent));
    }
  }
  if (capability.destructiveAction && (!Number.isInteger(capability.destructiveAction.expiryMs) || capability.destructiveAction.expiryMs <= 0)) {
    issues.push(issue("lifecycle_contract", `Destructive capability ${capability.id} requires a positive confirmation expiry`, capability.route, capability.intent));
  }
}

function pathKey(route: string, intent: string): string {
  return `${route}\u0000${intent}`;
}

function issue(
  type: HandlerBindingIssue["type"],
  message: string,
  route?: string,
  intent?: string,
): HandlerBindingIssue {
  return { type, message, ...(route ? { route } : {}), ...(intent ? { intent } : {}) };
}
