import type {
  ChannelAdapter,
  ChannelOutboundPayload,
  ChannelSendResult,
  JsonValue,
  NormalizedInboundMessage,
  OutboundMessage,
  RuntimeErrorEnvelope,
} from "@bridge-crux/core";
import { BridgeCruxAdapterError } from "./errors.js";

export type TelegramChannelAdapterOptions = {
  token?: string;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  commandAliases?: Record<string, string>;
  maxMessageLength?: number;
  maxAttempts?: number;
  retryDelay?: (milliseconds: number) => Promise<void>;
};

export class TelegramChannelAdapter implements ChannelAdapter {
  readonly channel = "telegram";
  readonly #token: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #aliases: Readonly<Record<string, string>>;
  readonly #maxLength: number;
  readonly #maxAttempts: number;
  readonly #retryDelay: (milliseconds: number) => Promise<void>;

  constructor(options: TelegramChannelAdapterOptions = {}) {
    const token = options.token ?? process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new BridgeCruxAdapterError({ status: 500, code: "telegram_token_missing", message: "TELEGRAM_BOT_TOKEN is required" });
    this.#token = token;
    this.#baseUrl = (options.apiBaseUrl ?? "https://api.telegram.org").replace(/\/$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#aliases = Object.freeze({ ...(options.commandAliases ?? {}) });
    this.#maxLength = options.maxMessageLength ?? 4_096;
    this.#maxAttempts = options.maxAttempts ?? 3;
    this.#retryDelay = options.retryDelay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async normalizeInbound(event: unknown): Promise<NormalizedInboundMessage> {
    if (!record(event) || !integer(event.update_id)) throw invalidUpdate("Telegram update_id is required");
    const message = selectMessage(event);
    if (!message || !integer(message.message_id) || !record(message.chat) || !numberOrString(message.chat.id)) {
      throw invalidUpdate("Telegram message and chat identifiers are required");
    }
    if (!record(message.from) || !numberOrString(message.from.id)) throw invalidUpdate("Telegram sender identifier is required");
    const originalText = typeof message.text === "string" ? message.text : typeof message.caption === "string" ? message.caption : "";
    const text = normalizeCommand(originalText, this.#aliases);
    const chatId = String(message.chat.id);
    const messageThreadId = numberOrString(message.message_thread_id) ? String(message.message_thread_id) : undefined;
    return {
      id: String(message.message_id),
      userExternalId: String(message.from.id),
      threadId: messageThreadId ? `${chatId}:${messageThreadId}` : chatId,
      channel: this.channel,
      text,
      attachments: attachments(message),
      timestamp: integer(message.date) ? message.date * 1_000 : Date.now(),
      idempotencyKey: `telegram:update:${event.update_id}`,
      correlationId: `telegram:${event.update_id}:${message.message_id}`,
    };
  }

  async formatOutbound(message: OutboundMessage): Promise<ChannelOutboundPayload[]> {
    const destination = message.threadId?.split(":", 1)[0] ?? message.userId;
    return splitTelegramText(message.text, this.#maxLength).map((text) => ({
      channel: this.channel,
      destination,
      text,
      ...(message.threadId?.includes(":") ? { replyTo: message.threadId.split(":")[1] } : {}),
      correlationId: message.correlationId,
    }));
  }

  async send(payload: ChannelOutboundPayload): Promise<ChannelSendResult> {
    if (payload.channel !== this.channel) return failed("telegram_channel_mismatch", `Cannot send ${payload.channel} payload through Telegram`, 400, false);
    let lastError: RuntimeErrorEnvelope | undefined;
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      try {
        const response = await this.#fetch(`${this.#baseUrl}/bot${this.#token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: payload.destination,
            text: payload.text,
            ...(payload.replyTo ? { message_thread_id: payload.replyTo } : {}),
          }),
        });
        const body = await readJson(response);
        if (response.ok && body.ok === true && record(body.result) && numberOrString(body.result.message_id)) {
          return { status: "sent", channelMessageId: String(body.result.message_id) };
        }
        const retryable = response.status === 429 || response.status >= 500;
        lastError = transportError(
          "telegram_delivery_failed",
          typeof body.description === "string" ? body.description : `Telegram returned HTTP ${response.status}`,
          response.status || 502,
          retryable,
        );
        if (!retryable || attempt === this.#maxAttempts) break;
        await this.#retryDelay(retryMilliseconds(body, attempt));
      } catch (error) {
        lastError = transportError(
          "telegram_transport_error",
          error instanceof Error ? error.message : "Telegram transport failed",
          502,
          true,
        );
        if (attempt === this.#maxAttempts) break;
        await this.#retryDelay(250 * 2 ** (attempt - 1));
      }
    }
    return { status: "failed", error: lastError ?? transportError("telegram_delivery_failed", "Telegram delivery failed", 502, false) };
  }
}

export function splitTelegramText(text: string, maxLength = 4_096): string[] {
  if (!Number.isInteger(maxLength) || maxLength < 1) throw new RangeError("maxLength must be a positive integer");
  const characters = [...text];
  if (characters.length === 0) return [""];
  const chunks: string[] = [];
  let remaining = characters;
  while (remaining.length > maxLength) {
    const window = remaining.slice(0, maxLength);
    let boundary = window.lastIndexOf("\n");
    if (boundary < Math.floor(maxLength * 0.5)) boundary = window.lastIndexOf(" ");
    if (boundary < Math.floor(maxLength * 0.5)) boundary = maxLength;
    chunks.push(remaining.slice(0, boundary).join("").trimEnd());
    remaining = remaining.slice(boundary);
    while (remaining[0] === " " || remaining[0] === "\n") remaining = remaining.slice(1);
  }
  chunks.push(remaining.join(""));
  return chunks;
}

function selectMessage(update: Record<string, unknown>): Record<string, unknown> | undefined {
  for (const key of ["message", "edited_message", "channel_post", "edited_channel_post"]) {
    if (record(update[key])) return update[key];
  }
  return undefined;
}

function normalizeCommand(text: string, aliases: Readonly<Record<string, string>>): string {
  const trimmed = text.trim();
  const [token, ...rest] = trimmed.split(/\s+/u);
  if (!token?.startsWith("/")) return trimmed;
  const [command, mention] = token.toLowerCase().split("@", 2);
  const canonical = aliases[command!] ?? command;
  const commandToken = mention ? `${canonical}@${mention}` : canonical;
  return [commandToken, ...rest].join(" ");
}

function attachments(message: Record<string, unknown>): JsonValue[] {
  const values: JsonValue[] = [];
  if (Array.isArray(message.photo)) {
    const photo = [...message.photo].reverse().find(record);
    if (photo && typeof photo.file_id === "string") values.push({ type: "photo", fileId: photo.file_id });
  }
  for (const type of ["document", "audio", "video", "voice", "animation"] as const) {
    const value = message[type];
    if (record(value) && typeof value.file_id === "string") values.push({ type, fileId: value.file_id });
  }
  return values;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = (await response.json()) as unknown;
    return record(value) ? value : {};
  } catch {
    return {};
  }
}

function retryMilliseconds(body: Record<string, unknown>, attempt: number): number {
  const parameters = body.parameters;
  if (record(parameters) && typeof parameters.retry_after === "number") return parameters.retry_after * 1_000;
  return 250 * 2 ** (attempt - 1);
}

function invalidUpdate(message: string): BridgeCruxAdapterError {
  return new BridgeCruxAdapterError({ status: 400, code: "telegram_invalid_update", message });
}

function failed(code: string, message: string, status: number, retryable: boolean): ChannelSendResult {
  return { status: "failed", error: transportError(code, message, status, retryable) };
}

function transportError(code: string, message: string, status: number, retryable: boolean): RuntimeErrorEnvelope {
  return { status, code, message: message.slice(0, 500), details: { boundary: "channel", retryable } };
}

function numberOrString(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
