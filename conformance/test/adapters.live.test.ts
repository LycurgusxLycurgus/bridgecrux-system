import { GeminiModelClient, TelegramChannelAdapter } from "@bridge-crux/adapters";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

describe("live adapter gates", () => {
  it.skipIf(!process.env.GEMINI_API_KEY || !process.env.BRIDGECRUX_GEMINI_MODEL)(
    "accepts a real Gemini structured response",
    async () => {
      const model = new GeminiModelClient();
      const result = await model.structured({
        purpose: "assessment",
        model: process.env.BRIDGECRUX_GEMINI_MODEL!,
        prompt: "Return the requested health status as JSON.",
        input: { requested: "ok" },
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["status"],
          properties: { status: { type: "string", enum: ["ok"] } },
        },
        correlationId: "live-gemini",
        thinkingLevel: "low",
        temperature: 0,
        parse(value) {
          if (!record(value) || value.status !== "ok") throw new Error("Gemini live response did not match the health schema");
          return { status: "ok" as const };
        },
      });
      expect(result.status).toBe("ok");
    },
  );

  it.skipIf(!process.env.TELEGRAM_BOT_TOKEN)("authenticates against the live Telegram boundary", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    if (process.env.BRIDGECRUX_LIVE_SEND === "1" && process.env.TELEGRAM_TEST_CHAT_ID) {
      const adapter = new TelegramChannelAdapter({ token });
      const result = await adapter.send({
        channel: "telegram",
        destination: process.env.TELEGRAM_TEST_CHAT_ID,
        text: "BridgeCrux live adapter conformance check.",
        correlationId: "live-telegram",
      });
      expect(result.status).toBe("sent");
      return;
    }
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const value = (await response.json()) as unknown;
    expect(response.ok && record(value) && value.ok === true).toBe(true);
  });

  it.skipIf(!process.env.CONVEX_URL || !process.env.BRIDGECRUX_CONVEX_HEALTH_FUNCTION)(
    "calls a configured live Convex health query",
    async () => {
      const client = new ConvexHttpClient(process.env.CONVEX_URL!);
      const health = makeFunctionReference<"query", Record<string, never>, unknown>(process.env.BRIDGECRUX_CONVEX_HEALTH_FUNCTION!);
      const result = await client.query(health, {});
      expect(result).toBeDefined();
    },
  );
});

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
