import Fastify from "fastify";

import { logger } from "./shared/logger";

export function buildApp() {
  const app = Fastify({
    logger,
  });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}
