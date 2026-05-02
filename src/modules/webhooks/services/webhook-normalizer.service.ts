import { EvolutionWebhookAdapter } from "../adapters/evolution-webhook.adapter";
import { MetaWebhookAdapter } from "../adapters/meta-webhook.adapter";
import type { WebhookProviderAdapter } from "../adapters/webhook-provider-adapter";
import { ZapiWebhookAdapter } from "../adapters/zapi-webhook.adapter";
import type { NormalizedMessage } from "../dtos/normalized-message";
import {
  MalformedWebhookPayloadError,
  UnknownWebhookProviderError,
  WebhookProcessingError,
} from "../errors/webhook-errors";

export class WebhookNormalizerService {
  constructor(private readonly adapters: WebhookProviderAdapter[]) {}

  normalize(payload: unknown): NormalizedMessage {
    const adapter = this.adapters.find((currentAdapter) =>
      currentAdapter.canHandle(payload)
    );

    if (!adapter) {
      throw new UnknownWebhookProviderError();
    }

    try {
      return adapter.normalize(payload);
    } catch (error) {
      if (error instanceof MalformedWebhookPayloadError) {
        throw error;
      }

      throw new WebhookProcessingError();
    }
  }
}

export function createDefaultWebhookNormalizerService(): WebhookNormalizerService {
  return new WebhookNormalizerService([
    new MetaWebhookAdapter(),
    new EvolutionWebhookAdapter(),
    new ZapiWebhookAdapter(),
  ]);
}