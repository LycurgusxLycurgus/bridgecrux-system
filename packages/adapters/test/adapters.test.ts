import type { OutboundMessage, RouterInput, TutorModelRequest } from "@bridge-crux/core";
import { describe, expect, it, vi } from "vitest";
import {
  BridgeCruxAdapterError,
  GEMINI_DEFAULT_MODEL,
  GeminiModelClient,
  GeminiTaskSignalRouter,
  TelegramChannelAdapter,
  formatTelegramHtml,
  splitTelegramText,
} from "../src/index.js";

describe("GeminiModelClient", () => {
  it("uses JSON schema, high thinking, and default router temperature for agentic work", async () => {
    const generated = vi.fn().mockResolvedValue({ text: '{"value":"ok"}' });
    const audit = vi.fn();
    const client = new GeminiModelClient({ client: { models: { generateContent: generated } }, audit });
    const result = await client.structured({
      purpose: "router",
      model: "gemini-test",
      prompt: "classify",
      input: { message: "hello" },
      schema: { type: "object" },
      correlationId: "corr",
      parse: (value) => value as { value: string },
    });

    expect(result).toEqual({ value: "ok" });
    expect(generated).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-test",
        config: expect.objectContaining({ temperature: 0.2, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "HIGH" } }),
      }),
    );
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ purpose: "router", status: "succeeded", correlationId: "corr" }));
  });

  it("defaults new integrations to Gemini 3.1 Flash-Lite and supports medium knowledge-only chat", async () => {
    const generated = vi
      .fn()
      .mockResolvedValueOnce({ text: '{"value":"ok"}' })
      .mockResolvedValueOnce({ text: "A concise factual answer." });
    const client = new GeminiModelClient({ client: { models: { generateContent: generated } } });

    await client.structured({
      purpose: "assessment",
      prompt: "assess",
      input: {},
      schema: { type: "object" },
      correlationId: "default-model",
      parse: (value) => value,
    });
    const chatRequest = tutorRequest();
    delete chatRequest.model;
    await client.tutor({ ...chatRequest, thinkingLevel: "medium" });

    expect(generated.mock.calls[0]?.[0]).toMatchObject({
      model: GEMINI_DEFAULT_MODEL,
      config: { thinkingConfig: { thinkingLevel: "HIGH" } },
    });
    expect(generated.mock.calls[1]?.[0]).toMatchObject({
      model: GEMINI_DEFAULT_MODEL,
      config: { thinkingConfig: { thinkingLevel: "MEDIUM" } },
    });
  });

  it("rejects invalid router schemas and converts provider failures", async () => {
    const invalid = new GeminiModelClient({
      client: { models: { generateContent: vi.fn().mockResolvedValue({ text: '{"route":"records"}' }) } },
    });
    const router = new GeminiTaskSignalRouter({ model: "gemini-test", client: invalid });
    await expect(router.decide(routerInput())).rejects.toMatchObject({ envelope: { code: "gemini_schema_rejected" } });

    const failed = new GeminiModelClient({
      client: { models: { generateContent: vi.fn().mockRejectedValue(new Error("upstream unavailable")) } },
    });
    await expect(
      failed.structured({
        purpose: "assessment",
        model: "gemini-test",
        prompt: "assess",
        input: {},
        schema: {},
        correlationId: "corr",
        parse: (value) => value,
      }),
    ).rejects.toMatchObject({ envelope: { code: "model_provider_error", status: 502 } });
  });

  it("routes freeform conversation at medium thinking", async () => {
    const generated = vi.fn().mockResolvedValue({ text: JSON.stringify({
      route: "conversation",
      intent: "explain",
      confidence: 0.9,
      speechAct: "question",
      temporalStance: "present",
      targetReferences: [],
      stateMutationCandidate: "none",
      mutationEvidence: "insufficient",
      safetyFlag: "none",
      extracted: {},
      reason: "knowledge question",
    }) });
    const client = new GeminiModelClient({ client: { models: { generateContent: generated } } });
    await new GeminiTaskSignalRouter({ client }).decide(routerInput());
    expect(generated.mock.calls[0]?.[0]).toMatchObject({ config: { thinkingConfig: { thinkingLevel: "MEDIUM" } } });
  });

  it("uses high thinking for tutor copy and sends only the allowed request context", async () => {
    const generated = vi.fn().mockResolvedValue({ text: "  Here is the explanation.  " });
    const client = new GeminiModelClient({ client: { models: { generateContent: generated } } });
    const text = await client.tutor(tutorRequest());
    expect(text).toBe("Here is the explanation.");
    expect(generated).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ thinkingConfig: { thinkingLevel: "HIGH" } }) }),
    );
    const call = generated.mock.calls[0]?.[0] as { contents: string };
    expect(call.contents).toContain("allowedContext");
    expect(call.contents).not.toContain("providerSession");
  });

  it("runs a high-thinking loop with only explicitly supplied tools", async () => {
    const generated = vi
      .fn()
      .mockResolvedValueOnce({ text: '{"action":"call","toolId":"records.read","input":{"id":"one"}}' })
      .mockResolvedValueOnce({ text: '{"action":"respond","text":"Record one is active."}' });
    const execute = vi.fn().mockResolvedValue({ id: "one", status: "active" });
    const client = new GeminiModelClient({ client: { models: { generateContent: generated } } });
    const result = await client.toolLoop!({
      ...tutorRequest(),
      tools: [{ id: "records.read", description: "Read one record", inputSchema: { type: "object" } }],
      execute,
    });
    expect(result).toEqual({
      text: "Record one is active.",
      calls: [{ toolId: "records.read", input: { id: "one" }, output: { id: "one", status: "active" } }],
    });
    expect(execute).toHaveBeenCalledWith("records.read", { id: "one" });
    const first = generated.mock.calls[0]?.[0] as { contents: string; config: { thinkingConfig: { thinkingLevel: string } } };
    expect(first.contents).toContain("records.read");
    expect(first.contents).not.toContain("records.delete");
    expect(first.config.thinkingConfig.thinkingLevel).toBe("HIGH");
  });

  it("blocks model-selected tools outside the filtered request", async () => {
    const execute = vi.fn();
    const client = new GeminiModelClient({
      client: {
        models: {
          generateContent: vi.fn().mockResolvedValue({ text: '{"action":"call","toolId":"records.delete","input":{"id":"one"}}' }),
        },
      },
    });
    await expect(
      client.toolLoop!({
        ...tutorRequest(),
        tools: [{ id: "records.read", description: "Read one record", inputSchema: { type: "object" } }],
        execute,
      }),
    ).rejects.toMatchObject({ envelope: { code: "gemini_tool_not_allowed", status: 403 } });
    expect(execute).not.toHaveBeenCalled();
  });

  it("supports predeclared tools at medium thinking", async () => {
    const execute = vi.fn().mockResolvedValue({ status: "active" });
    const generated = vi
      .fn()
      .mockResolvedValueOnce({ text: '{"action":"call","toolId":"records.read","input":{"id":"one"}}' })
      .mockResolvedValueOnce({ text: '{"action":"respond","text":"Active."}' });
    const client = new GeminiModelClient({ client: { models: { generateContent: generated } } });
    const result = await client.toolLoop!({
      ...tutorRequest(),
      thinkingLevel: "medium",
      tools: [{ id: "records.read", description: "Read one record", inputSchema: { type: "object" } }],
      execute,
    });
    expect(result.text).toBe("Active.");
    expect(execute).toHaveBeenCalledOnce();
    expect(generated.mock.calls[0]?.[0]).toMatchObject({ config: { thinkingConfig: { thinkingLevel: "MEDIUM" } } });
  });
});

describe("TelegramChannelAdapter", () => {
  it("normalizes updates, stable duplicate keys, attachments, and command aliases without domain interpretation", async () => {
    const adapter = telegram({ commandAliases: { "/begin": "/start" } });
    const event = {
      update_id: 91,
      message: {
        message_id: 7,
        from: { id: 42 },
        chat: { id: -1001 },
        message_thread_id: 12,
        date: 1_700_000_000,
        text: "/begin Keep Record Alpha exactly",
        photo: [{ file_id: "small" }, { file_id: "large" }],
      },
    };
    const normalized = await adapter.normalizeInbound(event);
    const duplicate = await adapter.normalizeInbound(event);
    expect(normalized).toMatchObject({
      id: "7",
      userExternalId: "42",
      threadId: "-1001:12",
      text: "/start Keep Record Alpha exactly",
      idempotencyKey: "telegram:update:91",
      correlationId: "telegram:91:7",
    });
    expect(normalized.attachments).toEqual([{ type: "photo", fileId: "large" }]);
    expect(duplicate.idempotencyKey).toBe(normalized.idempotencyKey);
  });

  it("splits Unicode safely and preserves Telegram destinations", async () => {
    expect(splitTelegramText("one two three", 7)).toEqual(["one", "two", "three"]);
    expect(splitTelegramText("😀😀😀", 2)).toEqual(["😀😀", "😀"]);
    const adapter = telegram({ maxMessageLength: 5 });
    const payloads = await adapter.formatOutbound(outbound({ text: "hello world", threadId: "-1001:12" }));
    expect(payloads).toEqual([
      { channel: "telegram", destination: "-1001", text: "hello", replyTo: "12", correlationId: "corr" },
      { channel: "telegram", destination: "-1001", text: "world", replyTo: "12", correlationId: "corr" },
    ]);
  });

  it("converts ordinary Markdown to safe Telegram HTML and selects HTML parse mode", async () => {
    expect(formatTelegramHtml("# Status\n- **Ready**\nUse `npm test` & verify [docs](https://example.com?a=1&b=2)."))
      .toBe('<b>Status</b>\n• <b>Ready</b>\nUse <code>npm test</code> &amp; verify <a href="https://example.com?a=1&amp;b=2">docs</a>.');

    const fetch = vi.fn().mockResolvedValue(response({ ok: true, result: { message_id: 89 } }, 200));
    const adapter = telegram({ fetch });
    const [payload] = await adapter.formatOutbound(outbound({ text: "## Result\n**Saved** <unsafe>" }));
    expect(payload?.text).toBe("<b>Result</b>\n<b>Saved</b> &lt;unsafe&gt;");
    await adapter.send(payload!);
    const body = JSON.parse(String((fetch.mock.calls[0]?.[1] as RequestInit | undefined)?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ parse_mode: "HTML", text: "<b>Result</b>\n<b>Saved</b> &lt;unsafe&gt;" });
  });

  it("acknowledges structured choices, emits inline controls, and brackets work with typing activity", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ok: true, result: { message_id: 90 } }, 200));
    const adapter = telegram({ fetch, typingRefreshMs: 60_000 });
    const inbound = await adapter.normalizeInbound({
      update_id: 92,
      callback_query: {
        id: "callback-1",
        from: { id: 42 },
        data: "bc:interaction-1:approve",
        message: { message_id: 8, chat: { id: 42 }, message_thread_id: 3 },
      },
    });
    expect(inbound.interaction).toMatchObject({
      kind: "choice",
      interactionId: "interaction-1",
      optionId: "approve",
      providerInteractionId: "callback-1",
    });

    await adapter.acknowledgeInbound(inbound);
    const activity = await adapter.startActivity(inbound);
    await activity.stop();
    const [payload] = await adapter.formatOutbound(outbound({
      threadId: "42:3",
      controls: [{
        id: "interaction-2",
        field: "answer",
        prompt: "Choose",
        options: [{ id: "yes", label: "Yes", value: true }, { id: "no", label: "No", value: false }],
      }],
    }));
    await adapter.send(payload!);

    expect(fetch.mock.calls.map((call) => String(call[0]))).toEqual([
      expect.stringContaining("/answerCallbackQuery"),
      expect.stringContaining("/sendChatAction"),
      expect.stringContaining("/sendMessage"),
    ]);
    const delivery = JSON.parse(String((fetch.mock.calls[2]?.[1] as RequestInit | undefined)?.body)) as Record<string, unknown>;
    expect(delivery).toMatchObject({
      chat_id: "42",
      message_thread_id: "3",
      reply_markup: {
        inline_keyboard: [[
          { text: "Yes", callback_data: "bc:interaction-2:yes" },
          { text: "No", callback_data: "bc:interaction-2:no" },
        ]],
      },
    });
  });

  it("retries transient responses and returns the persisted provider message id", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: false, description: "busy" }, 503))
      .mockResolvedValueOnce(response({ ok: true, result: { message_id: 88 } }, 200));
    const delay = vi.fn().mockResolvedValue(undefined);
    const adapter = telegram({ fetch, retryDelay: delay });
    const result = await adapter.send({ channel: "telegram", destination: "42", text: "hello", correlationId: "corr" });
    expect(result).toEqual({ status: "sent", channelMessageId: "88" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it("returns structured transport errors without throwing domain decisions into the channel", async () => {
    const adapter = telegram({ fetch: vi.fn().mockResolvedValue(response({ ok: false, description: "chat not found" }, 400)) });
    const result = await adapter.send({ channel: "telegram", destination: "missing", text: "plain copy", correlationId: "corr" });
    expect(result).toMatchObject({ status: "failed", error: { code: "telegram_delivery_failed", status: 400 } });
    await expect(adapter.normalizeInbound({ update_id: 1 })).rejects.toBeInstanceOf(BridgeCruxAdapterError);
  });
});

function telegram(options: ConstructorParameters<typeof TelegramChannelAdapter>[0] = {}): TelegramChannelAdapter {
  return new TelegramChannelAdapter({ token: "test-token", maxAttempts: 2, retryDelay: async () => undefined, ...options });
}

function response(body: object, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function outbound(overrides: Partial<OutboundMessage> = {}): OutboundMessage {
  return {
    id: "out-1",
    userId: "42",
    sessionId: "session",
    channel: "telegram",
    text: "hello",
    copySource: "high_thinking_tutor",
    correlationId: "corr",
    createdAt: 1,
    ...overrides,
  };
}

function routerInput(): RouterInput {
  return {
    message: {
      id: "m",
      userExternalId: "u",
      channel: "test",
      text: "hello",
      attachments: [],
      timestamp: 1,
      idempotencyKey: "once",
      correlationId: "corr",
    },
    registry: { routes: [] },
    state: {
      user: { id: "u", externalId: "u", channel: "test" },
      session: { id: "s", cruxId: "c", status: "active", inboundTurnCount: 1, conversationWindow: 5 },
      recentMessages: [],
      memories: [],
      ledgerSummary: { latestEvents: [], counts: {} },
      recentRouterDecisions: [],
      availableState: [],
    },
    declaredOperations: [],
    safetyPolicies: [],
    mutationPolicies: [],
  };
}

function tutorRequest(): TutorModelRequest {
  return {
    model: "gemini-test",
    systemPrompt: "Explain clearly",
    userMessage: "Why?",
    recentMessages: [],
    decision: {
      route: "conversation",
      intent: "explain",
      confidence: 1,
      speechAct: "question",
      temporalStance: "present",
      targetReferences: [],
      resolvedReferences: [],
      stateMutationCandidate: "none",
      mutationEvidence: "insufficient",
      safetyFlag: "none",
      extracted: {},
      reason: "question",
      validationStatus: "accepted",
      validationCodes: [],
      allowedMutation: false,
      additionalSignals: [],
      compositeStatus: "single",
    },
    operationResults: [],
    allowedContext: { record: { id: "one" } },
    correlationId: "corr",
    thinkingLevel: "high",
  };
}
