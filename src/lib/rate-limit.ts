export type RateLimitRule = {
  limit: number;
  windowMs: number;
};

export function createRateLimiter(rules: Record<string, RateLimitRule>, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();

  return {
    allow(bucket: string, client: string): boolean {
      const rule = rules[bucket];
      if (!rule) {
        return true;
      }
      const key = `${bucket}:${client}`;
      const cutoff = now() - rule.windowMs;
      const recent = (hits.get(key) ?? []).filter((time) => time > cutoff);
      if (recent.length >= rule.limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now());
      hits.set(key, recent);
      return true;
    },
    prune() {
      const longestWindow = Math.max(...Object.values(rules).map((rule) => rule.windowMs));
      const cutoff = now() - longestWindow;
      for (const [key, times] of hits) {
        if (times.every((time) => time <= cutoff)) {
          hits.delete(key);
        }
      }
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

const hourMs = 60 * 60 * 1000;

const globalForRateLimit = globalThis as typeof globalThis & { firmcardRateLimiter?: RateLimiter };

export const rpcRateLimiter: RateLimiter = (globalForRateLimit.firmcardRateLimiter ??= createRateLimiter({
  "complete.recognizePaperCard": { limit: 5, windowMs: hourMs },
  "complete.createBusinessCard": { limit: 5, windowMs: hourMs },
}));

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
