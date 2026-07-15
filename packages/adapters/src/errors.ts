import type { RuntimeErrorEnvelope } from "@bridge-crux/core";

export class BridgeCruxAdapterError extends Error {
  constructor(
    readonly envelope: RuntimeErrorEnvelope,
    options?: ErrorOptions,
  ) {
    super(envelope.message, options);
    this.name = "BridgeCruxAdapterError";
  }
}

export function providerError(boundary: "model" | "channel", error: unknown): BridgeCruxAdapterError {
  const message = error instanceof Error ? error.message : `${boundary} provider failed`;
  return new BridgeCruxAdapterError(
    {
      status: 502,
      code: `${boundary}_provider_error`,
      message: message.slice(0, 500),
      details: { boundary, retryable: true },
    },
    error instanceof Error ? { cause: error } : undefined,
  );
}
