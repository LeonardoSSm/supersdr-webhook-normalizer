import Fastify from "fastify";

import { webhookRoutes } from "./modules/webhooks/routes/webhook.routes";
import { logger } from "./shared/logger";

export function buildApp() {
  const app = Fastify({
    logger,
  });

  void app.register(webhookRoutes);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}
