import { describe, expect, it } from "vitest";
import { clientAddress, createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows requests up to the limit per client and window", () => {
    let now = 0;
    const limiter = createRateLimiter({ create: { limit: 2, windowMs: 1000 } }, () => now);

    expect(limiter.allow("create", "a")).toBe(true);
    expect(limiter.allow("create", "a")).toBe(true);
    expect(limiter.allow("create", "a")).toBe(false);
    expect(limiter.allow("create", "b")).toBe(true);

    now = 1001;
    expect(limiter.allow("create", "a")).toBe(true);
  });

  it("does not limit unknown buckets", () => {
    const limiter = createRateLimiter({});
    expect(limiter.allow("other", "a")).toBe(true);
  });
});

describe("clientAddress", () => {
  it("uses the first forwarded address", () => {
    const request = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } });
    expect(clientAddress(request)).toBe("203.0.113.5");
  });
});
