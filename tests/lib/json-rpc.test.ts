import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBusinessCardService } from "@/lib/business-card-service";
import { createEventBus, type DomainEvent } from "@/lib/events";
import { handleRpcRequest, rpcErrorCodes } from "@/lib/json-rpc";
import { linesFromText } from "@/lib/paper-card-parser";
import { InvalidImageError, ServiceBusyError } from "@/lib/service-errors";

const validCard = {
  fullName: "John Smith",
  organizationName: "Acme Ltd",
  organizationID: "GB123456",
  organizationAddress: "221B Baker Street, London",
  phone: "+44 20 7946 0000",
  email: "john@acme.example",
};

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let dataDir: string;
let events: DomainEvent[];
const recognizeLines = vi.fn(async () => linesFromText("Acme Ltd\nJohn Smith\nEngineer\njohn@acme.example"));

function setup() {
  const bus = createEventBus(() => new Date("2026-01-01T00:00:00.000Z"));
  bus.subscribe((event) => events.push(event));
  return createBusinessCardService({ dataDir, events: bus, recognizeLines });
}

function rpc(method: string, params: unknown, id: number | string = 1) {
  return { jsonrpc: "2.0", id, method, params };
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "firmcard-"));
  events = [];
  recognizeLines.mockClear();
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("complete.createBusinessCard", () => {
  it("creates the card app and emits BusinessCardCreated when the email is valid", async () => {
    const response = await handleRpcRequest(
      setup(),
      rpc("complete.createBusinessCard", { cardCreation: validCard }),
      () => {},
    );

    expect("result" in response).toBe(true);
    const result = (response as { result: { businessCard: unknown; appUrl: string } }).result;
    expect(result.businessCard).toEqual({ ...validCard, role: "" });
    expect(result.appUrl).toMatch(/^\/cards\/[A-Za-z0-9_-]{22}\/index\.html$/);

    const [id] = await readdir(path.join(dataDir, "cards"));
    const files = await readdir(path.join(dataDir, "cards", id));
    expect(files.sort()).toEqual(
      [
        "app.js",
        "card.json",
        "card.vcf",
        "icon-192.png",
        "icon-512.png",
        "index.html",
        "manifest.webmanifest",
        "style.css",
        "sw.js",
      ].sort(),
    );
    const html = await readFile(path.join(dataDir, "cards", id, "index.html"), "utf8");
    expect(html).toContain("John Smith");
    expect(html).toContain("<svg");

    expect(events).toEqual([
      {
        type: "BusinessCardCreated",
        createdAt: "2026-01-01T00:00:00.000Z",
        version: 1,
        payload: {},
      },
    ]);
  });

  it("rejects an invalid email without emitting an event", async () => {
    const response = await handleRpcRequest(
      setup(),
      rpc("complete.createBusinessCard", { cardCreation: { ...validCard, email: "not-an-email" } }),
      () => {},
    );

    expect(response).toMatchObject({
      error: { code: rpcErrorCodes.invalidParams, data: { email: ["Invalid email"] } },
    });
    expect(events).toEqual([]);
  });

  it("escapes HTML in card fields", async () => {
    await handleRpcRequest(
      setup(),
      rpc("complete.createBusinessCard", { cardCreation: { ...validCard, fullName: "<script>x</script> Smith" } }),
      () => {},
    );
    const [id] = await readdir(path.join(dataDir, "cards"));
    const html = await readFile(path.join(dataDir, "cards", id, "index.html"), "utf8");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("complete.recognizePaperCard", () => {
  it("returns recognized fields and emits PaperCardRecognized", async () => {
    const response = await handleRpcRequest(
      setup(),
      rpc("complete.recognizePaperCard", { cardRecognition: { image: tinyPng } }),
      () => {},
    );

    expect(response).toMatchObject({
      result: { paperCard: { fullName: "John Smith", organizationName: "Acme Ltd", email: "john@acme.example" } },
    });
    expect(recognizeLines).toHaveBeenCalledOnce();
    expect(events.map((event) => event.type)).toEqual(["PaperCardRecognized"]);
  });

  it("rejects images that are not data URLs", async () => {
    const response = await handleRpcRequest(
      setup(),
      rpc("complete.recognizePaperCard", { cardRecognition: { image: "https://example.com/card.png" } }),
      () => {},
    );

    expect(response).toMatchObject({ error: { code: rpcErrorCodes.invalidParams } });
    expect(recognizeLines).not.toHaveBeenCalled();
  });
});

describe("protocol", () => {
  it("rejects malformed requests", async () => {
    expect(await handleRpcRequest(setup(), { method: "x" }, () => {})).toMatchObject({
      error: { code: rpcErrorCodes.invalidRequest },
    });
  });

  it("rejects unknown methods", async () => {
    expect(await handleRpcRequest(setup(), rpc("complete.unknown", {}), () => {})).toMatchObject({
      error: { code: rpcErrorCodes.methodNotFound },
    });
  });

  it("accepts positional params", async () => {
    const response = await handleRpcRequest(setup(), rpc("complete.createBusinessCard", [validCard]), () => {});
    expect("result" in response).toBe(true);
  });

  it("reports internal errors without leaking details", async () => {
    recognizeLines.mockRejectedValueOnce(new Error("ocr crashed"));
    const onInternalError = vi.fn();
    const response = await handleRpcRequest(
      setup(),
      rpc("complete.recognizePaperCard", { cardRecognition: { image: tinyPng } }),
      onInternalError,
    );
    expect(response).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: rpcErrorCodes.internalError, message: "Internal error" },
    });
    expect(onInternalError).toHaveBeenCalledOnce();
  });
});

describe("protection", () => {
  it("rejects rate-limited methods before running them", async () => {
    const response = await handleRpcRequest(
      setup(),
      rpc("complete.createBusinessCard", { cardCreation: validCard }),
      () => {},
      () => false,
    );
    expect(response).toMatchObject({ error: { code: rpcErrorCodes.rateLimited } });
    expect(events).toEqual([]);
  });

  it("reports unreadable images as invalid params", async () => {
    recognizeLines.mockRejectedValueOnce(new InvalidImageError());
    const response = await handleRpcRequest(
      setup(),
      rpc("complete.recognizePaperCard", { cardRecognition: { image: tinyPng } }),
      () => {},
    );
    expect(response).toMatchObject({
      error: { code: rpcErrorCodes.invalidParams, data: { image: expect.any(Array) } },
    });
  });

  it("reports a busy OCR queue", async () => {
    recognizeLines.mockRejectedValueOnce(new ServiceBusyError());
    const response = await handleRpcRequest(
      setup(),
      rpc("complete.recognizePaperCard", { cardRecognition: { image: tinyPng } }),
      () => {},
    );
    expect(response).toMatchObject({ error: { code: rpcErrorCodes.busy } });
  });
});
