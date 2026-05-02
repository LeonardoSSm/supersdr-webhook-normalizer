import { describe, expect, it } from "vitest";

import type { WebhookProviderAdapter } from "../adapters/webhook-provider-adapter";
import type { NormalizedMessage } from "../dtos/normalized-message";
import {
  MalformedWebhookPayloadError,
  UnknownWebhookProviderError,
  WebhookProcessingError,
} from "../errors/webhook-errors";
import {
  createDefaultWebhookNormalizerService,
  WebhookNormalizerService,
} from "./webhook-normalizer.service";

const normalizedMessage: NormalizedMessage = {
  provider: "meta",
  providerMessageId: "provider-message-id",
  instanceId: "instance-id",
  fromPhone: "5511988888888",
  toPhone: "5511999999999",
  contactName: "Joao Silva",
  direction: "inbound",
  messageType: "text",
  text: "Ola",
  timestamp: new Date(1677234567 * 1000),
  rawPayload: { payload: true },
};

function createFakeAdapter(options: {
  canHandle: boolean;
  normalize?: () => NormalizedMessage;
}): WebhookProviderAdapter {
  return {
    provider: "meta",
    canHandle: () => options.canHandle,
    normalize: () => options.normalize?.() ?? normalizedMessage,
  };
}

const metaPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "5511999999999",
              phone_number_id: "PHONE_NUMBER_ID",
            },
            messages: [
              {
                from: "5511988888888",
                id: "wamid.message-id",
                timestamp: "1677234567",
                type: "text",
                text: { body: "Ola" },
              },
            ],
          },
        },
      ],
    },
  ],
};

const evolutionPayload = {
  event: "messages.upsert",
  instance: "minha-instancia",
  data: {
    key: {
      remoteJid: "5511988888888@s.whatsapp.net",
      fromMe: false,
      id: "3EB0B430B6F8C1D073A0",
    },
    pushName: "Joao Silva",
    message: { conversation: "Ola" },
    messageType: "conversation",
    messageTimestamp: 1677234567,
  },
};

const zapiPayload = {
  instanceId: "SUA_INSTANCE_ID",
  messageId: "3EB0B430B6F8C1D073A0",
  phone: "5511988888888",
  fromMe: false,
  momment: 1677234567000,
  type: "ReceivedCallback",
  text: { message: "Ola" },
};

describe("WebhookNormalizerService", () => {
  it("uses the correct adapter when canHandle returns true", () => {
    const firstAdapter = createFakeAdapter({ canHandle: false });
    const secondAdapter = createFakeAdapter({ canHandle: true });
    const service = new WebhookNormalizerService([firstAdapter, secondAdapter]);

    expect(service.normalize({ provider: "selected" })).toEqual(normalizedMessage);
  });

  it("returns a NormalizedMessage from the selected adapter", () => {
    const selectedMessage: NormalizedMessage = {
      ...normalizedMessage,
      providerMessageId: "selected-message-id",
    };
    const service = new WebhookNormalizerService([
      createFakeAdapter({
        canHandle: true,
        normalize: () => selectedMessage,
      }),
    ]);

    expect(service.normalize({ payload: true })).toEqual(selectedMessage);
  });

  it("throws UnknownWebhookProviderError when no adapter recognizes the payload", () => {
    const service = new WebhookNormalizerService([
      createFakeAdapter({ canHandle: false }),
    ]);

    expect(() => service.normalize({ unknown: true })).toThrow(
      UnknownWebhookProviderError
    );
  });

  it("propagates MalformedWebhookPayloadError from the selected adapter", () => {
    const service = new WebhookNormalizerService([
      createFakeAdapter({
        canHandle: true,
        normalize: () => {
          throw new MalformedWebhookPayloadError("Malformed fake payload");
        },
      }),
    ]);

    expect(() => service.normalize({ malformed: true })).toThrow(
      MalformedWebhookPayloadError
    );
  });

  it("wraps unexpected adapter errors in WebhookProcessingError", () => {
    const service = new WebhookNormalizerService([
      createFakeAdapter({
        canHandle: true,
        normalize: () => {
          throw new Error("Unexpected adapter failure");
        },
      }),
    ]);

    expect(() => service.normalize({ payload: true })).toThrow(
      WebhookProcessingError
    );
  });

  it("creates a default service with Meta, Evolution and Z-API adapters", () => {
    const service = createDefaultWebhookNormalizerService();

    expect(service.normalize(metaPayload).provider).toBe("meta");
    expect(service.normalize(evolutionPayload).provider).toBe("evolution");
    expect(service.normalize(zapiPayload).provider).toBe("zapi");
  });
});