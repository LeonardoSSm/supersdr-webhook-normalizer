import OpenAI from "openai";
import Fastify from "fastify";

import { env } from "./config/env";
import {
  NoOpLlmClassifierService,
  OpenAiLlmClassifierService,
} from "./modules/webhooks/services/llm-classifier.service";
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

export function createLlmClassifier() {
  if (env.OPENAI_API_KEY) {
    return new OpenAiLlmClassifierService(
      new OpenAI({ apiKey: env.OPENAI_API_KEY })
    );
  }

  return new NoOpLlmClassifierService();
}
