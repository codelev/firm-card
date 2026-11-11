import type { BusinessCard, CardCreation, PaperCard } from "@/lib/business-card";

export type FieldErrors = Record<string, string[] | undefined>;

export const rateLimitedCode = -32001;
export const busyCode = -32002;

export function friendlyRpcMessage(error: unknown, fallback: string): string {
  if (error instanceof RpcError && error.code === rateLimitedCode) {
    return "You've reached the hourly limit. Please try again later.";
  }
  if (error instanceof RpcError && error.code === busyCode) {
    return "The server is busy. Please try again in a moment.";
  }
  return fallback;
}

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}

type RpcEnvelope<T> =
  | { result: T; error?: undefined }
  | { result?: undefined; error: { code: number; message: string; data?: FieldErrors } };

async function call<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
  const envelope = (await response.json().catch(() => null)) as RpcEnvelope<T> | null;
  if (!envelope) {
    throw new RpcError(`Request failed (${response.status})`, response.status);
  }
  if (envelope.error) {
    throw new RpcError(envelope.error.message, envelope.error.code, envelope.error.data);
  }
  return envelope.result;
}

export function createBusinessCard(cardCreation: CardCreation) {
  return call<{ businessCard: BusinessCard; appUrl: string }>("complete.createBusinessCard", { cardCreation });
}

export function recognizePaperCard(image: string) {
  return call<{ paperCard: PaperCard }>("complete.recognizePaperCard", { cardRecognition: { image } });
}
