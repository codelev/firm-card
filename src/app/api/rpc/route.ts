import { maxImageBytes } from "@/lib/business-card";
import { handleRpcRequest, rpcErrorCodes } from "@/lib/json-rpc";
import { errorFields, logger } from "@/lib/logger";
import { clientAddress, rpcRateLimiter } from "@/lib/rate-limit";
import { businessCardService } from "@/lib/server";

const maxBodyBytes = Math.ceil((maxImageBytes * 4) / 3) + 64 * 1024;

function rpcError(code: number, message: string, status: number) {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status });
}

async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBodyBytes) {
    return null;
  }
  if (!request.body) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return rpcError(rpcErrorCodes.unsupportedMediaType, "Content-Type must be application/json", 415);
  }

  const raw = await readBody(request);
  if (raw === null) {
    return rpcError(rpcErrorCodes.payloadTooLarge, "Request is too large", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return rpcError(rpcErrorCodes.parseError, "Parse error", 400);
  }

  const client = clientAddress(request);
  rpcRateLimiter.prune();
  const response = await handleRpcRequest(
    businessCardService,
    body,
    (error) => logger.error("rpc method failed", errorFields(error)),
    (method) => rpcRateLimiter.allow(method, client),
  );

  if ("error" in response && response.error.code === rpcErrorCodes.rateLimited) {
    return Response.json(response, { status: 429, headers: { "Retry-After": "3600" } });
  }
  if ("error" in response && response.error.code === rpcErrorCodes.busy) {
    return Response.json(response, { status: 503, headers: { "Retry-After": "30" } });
  }
  return Response.json(response);
}
