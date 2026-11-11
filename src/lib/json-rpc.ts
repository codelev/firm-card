import { z } from "zod";
import type { BusinessCardService } from "@/lib/business-card-service";
import { InvalidImageError, ServiceBusyError, ServiceTimeoutError } from "@/lib/service-errors";

export const rpcErrorCodes = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
  rateLimited: -32001,
  busy: -32002,
  payloadTooLarge: -32003,
  unsupportedMediaType: -32004,
} as const;

const requestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
});

type RpcId = string | number | null;

export type RpcResponse =
  | { jsonrpc: "2.0"; id: RpcId; result: unknown }
  | { jsonrpc: "2.0"; id: RpcId; error: { code: number; message: string; data?: unknown } };

type MethodSpec = {
  paramName: string;
  run: (service: BusinessCardService, param: unknown) => Promise<unknown>;
};

const methods: Record<string, MethodSpec> = {
  "complete.createBusinessCard": {
    paramName: "cardCreation",
    run: (service, param) => service.createBusinessCard(param),
  },
  "complete.recognizePaperCard": {
    paramName: "cardRecognition",
    run: (service, param) => service.recognizePaperCard(param),
  },
};

function failure(id: RpcId, code: number, message: string, data?: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } };
}

export async function handleRpcRequest(
  service: BusinessCardService,
  body: unknown,
  onInternalError: (error: unknown) => void,
  allow: (method: string) => boolean = () => true,
): Promise<RpcResponse> {
  const request = requestSchema.safeParse(body);
  if (!request.success) {
    return failure(null, rpcErrorCodes.invalidRequest, "Invalid Request");
  }
  const { method, params, id = null } = request.data;
  const spec = methods[method];
  if (!spec) {
    return failure(id, rpcErrorCodes.methodNotFound, "Method not found");
  }
  if (!allow(method)) {
    return failure(id, rpcErrorCodes.rateLimited, "Too many requests");
  }
  const param = Array.isArray(params) ? params[0] : params?.[spec.paramName];

  try {
    return { jsonrpc: "2.0", id, result: await spec.run(service, param) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure(id, rpcErrorCodes.invalidParams, "Invalid params", z.flattenError(error).fieldErrors);
    }
    if (error instanceof InvalidImageError) {
      return failure(id, rpcErrorCodes.invalidParams, "Invalid params", { image: [error.message] });
    }
    if (error instanceof ServiceBusyError || error instanceof ServiceTimeoutError) {
      return failure(id, rpcErrorCodes.busy, error.message);
    }
    onInternalError(error);
    return failure(id, rpcErrorCodes.internalError, "Internal error");
  }
}
