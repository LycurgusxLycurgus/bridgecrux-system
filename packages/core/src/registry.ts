import type {
  AuditDefectType,
  HandlerBinding,
  HandlerBindingIssue,
  IntentContract,
  OperationHandler,
  RouteContract,
  RouteRegistryDefinition,
  SpecificFunctionController,
} from "./contracts.js";

export class RouteIntentRegistry {
  readonly definition: RouteRegistryDefinition;
  readonly #routes = new Map<string, RouteContract>();

  constructor(definition: RouteRegistryDefinition) {
    for (const route of definition.routes) {
      if (!route.id.trim() || this.#routes.has(route.id)) {
        throw new Error(`Duplicate or empty route id: ${route.id}`);
      }
      const intents = new Set<string>();
      for (const intent of route.intents) {
        if (!intent.id.trim() || intents.has(intent.id)) {
          throw new Error(`Duplicate or empty intent id ${intent.id} in route ${route.id}`);
        }
        intents.add(intent.id);
      }
      this.#routes.set(route.id, route);
    }
    this.definition = definition;
  }

  hasRoute(route: string): boolean {
    return this.#routes.has(route);
  }

  hasIntent(route: string, intent: string): boolean {
    return this.intent(route, intent) !== undefined;
  }

  intent(route: string, intent: string): IntentContract | undefined {
    return this.#routes.get(route)?.intents.find((candidate) => candidate.id === intent);
  }

  routes(): RouteContract[] {
    return [...this.#routes.values()];
  }
}

export class HandlerBindingRegistry {
  readonly #bindings = new Map<string, HandlerBinding>();

  constructor(bindings: HandlerBinding[] = []) {
    for (const binding of bindings) this.register(binding);
  }

  register(binding: HandlerBinding): void {
    const key = bindingKey(binding.route, binding.intent);
    if (this.#bindings.has(key)) throw new Error(`Duplicate handler binding: ${key}`);
    this.#bindings.set(key, binding);
  }

  resolve(route: string, intent: string): HandlerBinding | undefined {
    return this.#bindings.get(bindingKey(route, intent));
  }

  list(): HandlerBinding[] {
    return [...this.#bindings.values()];
  }
}

export class OperationRegistry {
  readonly #handlers = new Map<string, OperationHandler>();

  register(handler: OperationHandler): void {
    if (this.#handlers.has(handler.operationId)) throw new Error(`Duplicate operation handler: ${handler.operationId}`);
    this.#handlers.set(handler.operationId, handler);
  }

  resolve(operationId: string): OperationHandler | undefined {
    return this.#handlers.get(operationId);
  }

  listForBinding(binding: HandlerBinding): OperationHandler[] {
    return binding.operationIds.flatMap((id) => {
      const handler = this.resolve(id);
      return handler ? [handler] : [];
    });
  }

  ids(): string[] {
    return [...this.#handlers.keys()];
  }
}

export class SpecificFunctionRegistry {
  readonly #controllers = new Map<string, SpecificFunctionController>();

  register(controller: SpecificFunctionController): void {
    if (this.#controllers.has(controller.id)) throw new Error(`Duplicate specific-function controller: ${controller.id}`);
    this.#controllers.set(controller.id, controller);
  }

  resolve(id: string): SpecificFunctionController | undefined {
    return this.#controllers.get(id);
  }
}

export function auditHandlerBindings(
  registry: RouteIntentRegistry,
  bindings: HandlerBindingRegistry,
  operationIds: Iterable<string>,
): HandlerBindingIssue[] {
  const issues: HandlerBindingIssue[] = [];
  const operations = new Set(operationIds);
  const represented = new Set<string>();

  for (const route of registry.routes()) {
    for (const intent of route.intents) {
      const binding = bindings.resolve(route.id, intent.id);
      if (!binding) {
        issues.push(issue("handler_binding", `Missing binding for ${route.id}/${intent.id}`, route.id, intent.id));
        continue;
      }
      for (const operationId of binding.operationIds) {
        represented.add(operationId);
        if (!operations.has(operationId)) {
          issues.push({
            type: "handler_binding",
            route: route.id,
            intent: intent.id,
            handlerId: binding.handlerId,
            operationId,
            message: `Binding references missing operation ${operationId}`,
          });
        }
      }
      if (intent.mutationClasses.length > 0 && binding.operationIds.length === 0) {
        issues.push(issue("handler_binding", `Mutating intent ${route.id}/${intent.id} has no operation`, route.id, intent.id));
      }
      for (const mutationClass of binding.allowedMutationClasses) {
        if (!intent.mutationClasses.includes(mutationClass)) {
          issues.push(issue("guard_divergence", `Binding allows undeclared mutation ${mutationClass}`, route.id, intent.id));
        }
      }
    }
  }

  for (const operationId of operations) {
    if (!represented.has(operationId)) {
      issues.push({ type: "surface_omission", operationId, message: `Operation ${operationId} is absent from the task surface` });
    }
  }

  return issues;
}

function bindingKey(route: string, intent: string): string {
  return `${route}\u0000${intent}`;
}

function issue(type: AuditDefectType, message: string, route: string, intent: string): HandlerBindingIssue {
  return { type, route, intent, message };
}
