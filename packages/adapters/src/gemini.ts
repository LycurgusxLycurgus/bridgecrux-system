import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type {
  JsonValue,
  ModelClient,
  RawRouterDecision,
  RouterInput,
  StructuredModelRequest,
  TaskSignalRouter,
  ToolLoopRequest,
  ToolLoopResult,
  TutorModelRequest,
} from "@bridge-crux/core";
import { BridgeCruxAdapterError, providerError } from "./errors.js";

type GeminiResponse = { readonly text?: string };
type GeminiClient = {
  models: {
    generateContent(input: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        temperature?: number;
        responseMimeType?: string;
        responseJsonSchema?: unknown;
        thinkingConfig?: { thinkingLevel?: ThinkingLevel };
      };
    }): Promise<GeminiResponse>;
  };
};

export type GeminiCallAudit = (event: {
  purpose: "router" | "memory" | "assessment" | "tutor" | "tool";
  model: string;
  correlationId: string;
  thinkingLevel: "low" | "high";
  status: "succeeded" | "failed";
}) => void | Promise<void>;

export type GeminiModelClientOptions = {
  apiKey?: string;
  client?: GeminiClient;
  audit?: GeminiCallAudit;
  maxToolRounds?: number;
};

export class GeminiModelClient implements ModelClient {
  readonly #client: GeminiClient;
  readonly #audit: GeminiCallAudit | undefined;
  readonly #maxToolRounds: number;

  constructor(options: GeminiModelClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!options.client && !apiKey) {
      throw new BridgeCruxAdapterError({ status: 500, code: "gemini_api_key_missing", message: "GEMINI_API_KEY is required" });
    }
    this.#client = options.client ?? (new GoogleGenAI({ apiKey: apiKey! }) as unknown as GeminiClient);
    this.#audit = options.audit;
    this.#maxToolRounds = options.maxToolRounds ?? 4;
  }

  async structured<T>(request: StructuredModelRequest<T>): Promise<T> {
    const thinkingLevel = request.thinkingLevel ?? "low";
    try {
      const response = await this.#client.models.generateContent({
        model: request.model,
        contents: `${request.prompt}\n\nINPUT_JSON:\n${safeJson(request.input)}`,
        config: {
          temperature: request.temperature ?? 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: request.schema,
          thinkingConfig: { thinkingLevel: thinkingLevel === "high" ? ThinkingLevel.HIGH : ThinkingLevel.LOW },
        },
      });
      const value = parseJsonResponse(response.text);
      const parsed = request.parse(value);
      await this.#record(request.purpose, request.model, request.correlationId, thinkingLevel, "succeeded");
      return parsed;
    } catch (error) {
      await this.#record(request.purpose, request.model, request.correlationId, thinkingLevel, "failed");
      if (error instanceof BridgeCruxAdapterError) throw error;
      throw providerError("model", error);
    }
  }

  async tutor(request: TutorModelRequest): Promise<string> {
    try {
      const response = await this.#client.models.generateContent({
        model: request.model,
        contents: safeJson({
          userMessage: request.userMessage,
          recentMessages: request.recentMessages,
          validatedDecision: request.decision,
          operationResults: request.operationResults,
          allowedContext: request.allowedContext,
        }),
        config: {
          systemInstruction: request.systemPrompt,
          temperature: 0.4,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });
      const text = response.text?.trim();
      if (!text) throw new BridgeCruxAdapterError({ status: 502, code: "gemini_empty_response", message: "Gemini returned no user copy" });
      await this.#record("tutor", request.model, request.correlationId, "high", "succeeded");
      return text;
    } catch (error) {
      await this.#record("tutor", request.model, request.correlationId, "high", "failed");
      if (error instanceof BridgeCruxAdapterError) throw error;
      throw providerError("model", error);
    }
  }

  async toolLoop(request: ToolLoopRequest): Promise<ToolLoopResult> {
    if (request.tools.length === 0) return { text: await this.tutor(request), calls: [] };
    const allowed = new Map(request.tools.map((tool) => [tool.id, tool]));
    const calls: ToolLoopResult["calls"] = [];
    for (let round = 0; round < this.#maxToolRounds; round += 1) {
      try {
        const response = await this.#client.models.generateContent({
          model: request.model,
          contents: safeJson({
            userMessage: request.userMessage,
            recentMessages: request.recentMessages,
            validatedDecision: request.decision,
            operationResults: request.operationResults,
            allowedContext: request.allowedContext,
            allowedTools: request.tools,
            priorCalls: calls,
          }),
          config: {
            systemInstruction: `${request.systemPrompt}\nSelect only from allowedTools. Return a call when authoritative data is required; otherwise return the final user-facing response.`,
            temperature: 0.2,
            responseMimeType: "application/json",
            responseJsonSchema: toolLoopSchema([...allowed.keys()]),
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          },
        });
        const selection = parseToolSelection(parseJsonResponse(response.text));
        if (selection.action === "respond") {
          await this.#record("tool", request.model, request.correlationId, "high", "succeeded");
          return { text: selection.text, calls };
        }
        if (!allowed.has(selection.toolId)) {
          throw new BridgeCruxAdapterError({
            status: 403,
            code: "gemini_tool_not_allowed",
            message: `Gemini requested an unavailable tool: ${selection.toolId}`,
          });
        }
        const output = await request.execute(selection.toolId, selection.input);
        calls.push({ toolId: selection.toolId, input: selection.input, output });
        await this.#record("tool", request.model, request.correlationId, "high", "succeeded");
      } catch (error) {
        await this.#record("tool", request.model, request.correlationId, "high", "failed");
        if (error instanceof BridgeCruxAdapterError) throw error;
        throw providerError("model", error);
      }
    }
    throw new BridgeCruxAdapterError({
      status: 502,
      code: "gemini_tool_loop_limit",
      message: `Gemini did not produce final copy within ${this.#maxToolRounds} tool rounds`,
    });
  }

  async #record(
    purpose: "router" | "memory" | "assessment" | "tutor" | "tool",
    model: string,
    correlationId: string,
    thinkingLevel: "low" | "high",
    status: "succeeded" | "failed",
  ): Promise<void> {
    await this.#audit?.({ purpose, model, correlationId, thinkingLevel, status });
  }
}

export type GeminiTaskSignalRouterOptions = {
  model: string;
  client: ModelClient;
  prompt?: string;
};

export class GeminiTaskSignalRouter implements TaskSignalRouter {
  readonly modelName: string;
  readonly #client: ModelClient;
  readonly #prompt: string;

  constructor(options: GeminiTaskSignalRouterOptions) {
    this.modelName = options.model;
    this.#client = options.client;
    this.#prompt =
      options.prompt ??
      "Classify the user's task signal using only declared routes, intents, state, operations, and policies. Return the schema exactly. Do not execute, authorize, or write user-facing copy.";
  }

  decide(input: RouterInput): Promise<RawRouterDecision> {
    return this.#client.structured({
      purpose: "router",
      model: this.modelName,
      prompt: this.#prompt,
      input,
      schema: ROUTER_DECISION_SCHEMA,
      correlationId: input.message.correlationId,
      temperature: 0.2,
      thinkingLevel: "low",
      parse: parseRouterDecision,
    });
  }
}

export const ROUTER_DECISION_SCHEMA: JsonValue = {
  type: "object",
  additionalProperties: false,
  required: [
    "route",
    "intent",
    "confidence",
    "needsHighThinking",
    "speechAct",
    "temporalStance",
    "targetReferences",
    "stateMutationCandidate",
    "mutationEvidence",
    "safetyFlag",
    "extracted",
    "reason",
  ],
  properties: {
    route: { type: "string" },
    intent: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needsHighThinking: { type: "boolean" },
    speechAct: { type: "string", enum: ["question", "announcement", "proposal", "permission", "correction", "confirmation", "execution", "other"] },
    temporalStance: { type: "string", enum: ["past", "present", "future", "hypothetical", "unclear"] },
    targetReferences: { type: "array", items: { type: "object" } },
    stateMutationCandidate: { type: "string" },
    mutationEvidence: { type: "string", enum: ["positive", "insufficient", "negative"] },
    safetyFlag: { type: "string", enum: ["none", "possible", "urgent"] },
    extracted: { type: "object" },
    reason: { type: "string" },
    handlerTarget: { type: "string" },
    anticipatedRoute: { type: "string" },
    capabilityGap: { type: "string" },
    capabilityGapType: { type: "string" },
    additionalSignals: { type: "array", items: { type: "object" } },
  },
};

function parseJsonResponse(text: string | undefined): unknown {
  if (!text) throw new BridgeCruxAdapterError({ status: 502, code: "gemini_empty_response", message: "Gemini returned no structured output" });
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new BridgeCruxAdapterError(
      { status: 502, code: "gemini_invalid_json", message: "Gemini returned invalid structured JSON" },
      { cause: error },
    );
  }
}

function parseRouterDecision(value: unknown): RawRouterDecision {
  if (!record(value)) throw schemaError("Router output must be an object");
  for (const key of ["route", "intent", "speechAct", "temporalStance", "stateMutationCandidate", "mutationEvidence", "safetyFlag", "reason"]) {
    if (typeof value[key] !== "string") throw schemaError(`Router output field ${key} must be a string`);
  }
  if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) throw schemaError("Router confidence must be between 0 and 1");
  if (typeof value.needsHighThinking !== "boolean") throw schemaError("Router needsHighThinking must be boolean");
  if (!Array.isArray(value.targetReferences) || !record(value.extracted)) throw schemaError("Router references and extracted fields have invalid shapes");
  if (value.additionalSignals !== undefined && !Array.isArray(value.additionalSignals)) throw schemaError("Router additionalSignals must be an array");
  return value as RawRouterDecision;
}

function schemaError(message: string): BridgeCruxAdapterError {
  return new BridgeCruxAdapterError({ status: 502, code: "gemini_schema_rejected", message });
}

type ToolSelection =
  | { action: "respond"; text: string }
  | { action: "call"; toolId: string; input: Record<string, unknown> };

function toolLoopSchema(toolIds: string[]): JsonValue {
  return {
    type: "object",
    additionalProperties: false,
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["call", "respond"] },
      toolId: { type: "string", enum: toolIds },
      input: { type: "object" },
      text: { type: "string" },
    },
  };
}

function parseToolSelection(value: unknown): ToolSelection {
  if (!record(value) || (value.action !== "call" && value.action !== "respond")) {
    throw schemaError("Gemini tool selection must use action call or respond");
  }
  if (value.action === "respond") {
    if (typeof value.text !== "string" || !value.text.trim()) throw schemaError("Gemini final tool-loop response must contain text");
    return { action: "respond", text: value.text.trim() };
  }
  if (typeof value.toolId !== "string" || !record(value.input)) throw schemaError("Gemini tool call requires toolId and object input");
  return { action: "call", toolId: value.toolId, input: value.input };
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item)) ?? "null";
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
