import type { FastifyPluginAsync } from "fastify";

import {
  MalformedWebhookPayloadError,
  UnknownWebhookProviderError,
  WebhookProcessingError,
} from "../errors/webhook-errors";
import { createDefaultWebhookNormalizerService } from "../services/webhook-normalizer.service";

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  const service = createDefaultWebhookNormalizerService();

  app.post("/webhooks", async (request, reply) => {
    try {
      const normalizedMessage = service.normalize(request.body);

      return reply.code(200).send({
        success: true,
        data: normalizedMessage,
      });
    } catch (error) {
      request.log.error({ error }, "Failed to process webhook");

      if (error instanceof UnknownWebhookProviderError) {
        return reply.code(400).send({
          success: false,
          error: "UNKNOWN_WEBHOOK_PROVIDER",
          message: error.message,
        });
      }

      if (error instanceof MalformedWebhookPayloadError) {
        return reply.code(400).send({
          success: false,
          error: "MALFORMED_WEBHOOK_PAYLOAD",
          message: error.message,
        });
      }

      if (error instanceof WebhookProcessingError) {
        return reply.code(500).send({
          success: false,
          error: "WEBHOOK_PROCESSING_ERROR",
          message: error.message,
        });
      }

      return reply.code(500).send({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Unexpected error while processing webhook",
      });
    }
  });
};