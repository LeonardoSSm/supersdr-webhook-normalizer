import { describe, expect, it } from "vitest";

import { MalformedWebhookPayloadError } from "../errors/webhook-errors";
import { MetaWebhookAdapter } from "./meta-webhook.adapter";

const metaPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "5511999999999",
              phone_number_id: "PHONE_NUMBER_ID",
            },
            contacts: [
              {
                profile: { name: "Joao Silva" },
                wa_id: "5511988888888",
              },
            ],
            messages: [
              {
                from: "5511988888888",
                id: "wamid.HBgNNTUxMTk5OTk5OTk5ORUCABIYFjNFQjBCNkU3",
                timestamp: "1677234567",
                type: "text",
                text: { body: "Ola, gostaria de saber mais sobre o produto" },
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

describe("MetaWebhookAdapter", () => {
  const adapter = new MetaWebhookAdapter();

  it("identifies Meta Cloud API webhook payloads", () => {
    expect(adapter.provider).toBe("meta");
    expect(adapter.canHandle(metaPayload)).toBe(true);
    expect(adapter.canHandle({ object: "unknown" })).toBe(false);
  });

  it("normalizes a Meta text message payload", () => {
    const normalizedMessage = adapter.normalize(metaPayload);

    expect(normalizedMessage).toEqual({
      provider: "meta",
      providerMessageId: "wamid.HBgNNTUxMTk5OTk5OTk5ORUCABIYFjNFQjBCNkU3",
      instanceId: "PHONE_NUMBER_ID",
      fromPhone: "5511988888888",
      toPhone: "5511999999999",
      contactName: "Joao Silva",
      direction: "inbound",
      messageType: "text",
      text: "Ola, gostaria de saber mais sobre o produto",
      timestamp: new Date(1677234567 * 1000),
      rawPayload: metaPayload,
    });
  });

  it("maps supported non-text media types and unknown types", () => {
    const imagePayload = structuredClone(metaPayload);
    imagePayload.entry[0].changes[0].value.messages[0].type = "image";

    const stickerPayload = structuredClone(metaPayload);
    stickerPayload.entry[0].changes[0].value.messages[0].type = "sticker";

    expect(adapter.normalize(imagePayload).messageType).toBe("image");
    expect(adapter.normalize(stickerPayload).messageType).toBe("unknown");
  });

  it("throws MalformedWebhookPayloadError for malformed payloads", () => {
    expect(() => adapter.normalize({ object: "whatsapp_business_account" })).toThrow(
      MalformedWebhookPayloadError
    );
  });
});