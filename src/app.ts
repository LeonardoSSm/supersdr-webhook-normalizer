import Fastify from "fastify";

import {
  webhookRoutes,
  type WebhookRoutesOptions,
} from "./modules/webhooks/routes/webhook.routes";
import { logger } from "./shared/logger";

export type BuildAppOptions = WebhookRoutesOptions;

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger,
  });

  void app.register(webhookRoutes, options);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}