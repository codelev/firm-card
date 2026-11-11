export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { dataDir } = await import("@/lib/paths");
    const { logger } = await import("@/lib/logger");
    logger.info("server starting", { dataDir });
  }
}
