import { describe, expect, it } from "vitest";

import { buildApp } from "../../../app";

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
            contacts: [
              {
                profile: { name: "Joao Silva" },
              },
            ],
            messages: [
              {
                from: "5511988888888",
                id: "wamid.message-id",
                timestamp: "1677234567",
                type: "text",
                text: { body: "Ola, gostaria de saber mais sobre o produto" },
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
    message: {
      conversation: "Ola, gostaria de saber mais sobre o produto",
    },
    messageType: "conversation",
    messageTimestamp: 1677234567,
  },
  destination: "5511999999999@s.whatsapp.net",
};

const zapiPayload = {
  instanceId: "SUA_INSTANCE_ID",
  messageId: "3EB0B430B6F8C1D073A0",
  phone: "5511988888888",
  fromMe: false,
  momment: 1677234567000,
  type: "ReceivedCallback",
  senderName: "Joao Silva",
  text: {
    message: "Ola, gostaria de saber mais sobre o produto",
  },
};

async function postWebhook(payload: object) {
  const app = buildApp();

  try {
    return await app.inject({
      method: "POST",
      url: "/webhooks",
      headers: {
        "content-type": "application/json",
      },
      payload: JSON.stringify(payload),
    });
  } finally {
    await app.close();
  }
}

describe("POST /webhooks", () => {
  it("normalizes a valid Meta payload", async () => {
    const response = await postWebhook(metaPayload);
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        provider: "meta",
        providerMessageId: "wamid.message-id",
        instanceId: "PHONE_NUMBER_ID",
        fromPhone: "5511988888888",
        toPhone: "5511999999999",
        contactName: "Joao Silva",
        direction: "inbound",
        messageType: "text",
        text: "Ola, gostaria de saber mais sobre o produto",
        timestamp: new Date(1677234567 * 1000).toISOString(),
      },
    });
  });

  it("normalizes a valid Evolution payload", async () => {
    const response = await postWebhook(evolutionPayload);
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        provider: "evolution",
        providerMessageId: "3EB0B430B6F8C1D073A0",
        instanceId: "minha-instancia",
        fromPhone: "5511988888888",
        toPhone: "5511999999999",
        contactName: "Joao Silva",
        direction: "inbound",
        messageType: "text",
        text: "Ola, gostaria de saber mais sobre o produto",
        timestamp: new Date(1677234567 * 1000).toISOString(),
      },
    });
  });

  it("normalizes a valid Z-API payload", async () => {
    const response = await postWebhook(zapiPayload);
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        provider: "zapi",
        providerMessageId: "3EB0B430B6F8C1D073A0",
        instanceId: "SUA_INSTANCE_ID",
        fromPhone: "5511988888888",
        contactName: "Joao Silva",
        direction: "inbound",
        messageType: "text",
        text: "Ola, gostaria de saber mais sobre o produto",
        timestamp: new Date(1677234567000).toISOString(),
      },
    });
  });

  it("returns UNKNOWN_WEBHOOK_PROVIDER for unknown payloads", async () => {
    const response = await postWebhook({ provider: "unknown" });
    const body = response.json();

    expect(response.statusCode).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "UNKNOWN_WEBHOOK_PROVIDER",
      message: "Unknown webhook provider",
    });
  });

  it("returns MALFORMED_WEBHOOK_PAYLOAD for malformed recognized payloads", async () => {
    const response = await postWebhook({ object: "whatsapp_business_account" });
    const body = response.json();

    expect(response.statusCode).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "MALFORMED_WEBHOOK_PAYLOAD",
      message: "Malformed Meta webhook payload",
    });
  });
});