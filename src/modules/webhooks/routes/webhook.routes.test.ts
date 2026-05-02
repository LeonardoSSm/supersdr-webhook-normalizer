import { describe, expect, it, vi } from "vitest";

import { buildApp } from "../../../app";
import type { MessagePersistence } from "./webhook.routes";

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

function createMessageRepositoryMock() {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findMany: vi.fn().mockResolvedValue([]),
  } satisfies MessagePersistence;
}

async function postWebhook(
  payload: object,
  messageRepository = createMessageRepositoryMock()
) {
  const app = buildApp({ messageRepository });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/webhooks",
      headers: {
        "content-type": "application/json",
      },
      payload: JSON.stringify(payload),
    });

    return { response, messageRepository };
  } finally {
    await app.close();
  }
}

async function getMessages(
  query: { provider?: string; fromPhone?: string; limit?: number } = {},
  messageRepository = createMessageRepositoryMock()
) {
  const app = buildApp({ messageRepository });

  try {
    const params = new URLSearchParams();
    if (query.provider !== undefined) params.set("provider", query.provider);
    if (query.fromPhone !== undefined) params.set("fromPhone", query.fromPhone);
    if (query.limit !== undefined) params.set("limit", String(query.limit));

    const qs = params.toString();
    const url = qs ? `/messages?${qs}` : "/messages";

    const response = await app.inject({ method: "GET", url });

    return { response, messageRepository };
  } finally {
    await app.close();
  }
}

describe("POST /webhooks", () => {
  it("normalizes and persists a valid Meta payload", async () => {
    const { response, messageRepository } = await postWebhook(metaPayload);
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
    expect(messageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "meta",
        providerMessageId: "wamid.message-id",
        timestamp: new Date(1677234567 * 1000),
      }),
      undefined
    );
  });

  it("normalizes and persists a valid Evolution payload", async () => {
    const { response, messageRepository } = await postWebhook(evolutionPayload);

    expect(response.statusCode).toBe(200);
    expect(messageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "evolution",
        providerMessageId: "3EB0B430B6F8C1D073A0",
        fromPhone: "5511988888888",
      }),
      undefined
    );
  });

  it("normalizes and persists a valid Z-API payload", async () => {
    const { response, messageRepository } = await postWebhook(zapiPayload);

    expect(response.statusCode).toBe(200);
    expect(messageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "zapi",
        providerMessageId: "3EB0B430B6F8C1D073A0",
        fromPhone: "5511988888888",
      }),
      undefined
    );
  });

  it("returns UNKNOWN_WEBHOOK_PROVIDER and does not persist unknown payloads", async () => {
    const { response, messageRepository } = await postWebhook({ provider: "unknown" });
    const body = response.json();

    expect(response.statusCode).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "UNKNOWN_WEBHOOK_PROVIDER",
      message: "Unknown webhook provider",
    });
    expect(messageRepository.save).not.toHaveBeenCalled();
  });

  it("returns MALFORMED_WEBHOOK_PAYLOAD and does not persist malformed payloads", async () => {
    const { response, messageRepository } = await postWebhook({
      object: "whatsapp_business_account",
    });
    const body = response.json();

    expect(response.statusCode).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "MALFORMED_WEBHOOK_PAYLOAD",
      message: "Malformed Meta webhook payload",
    });
    expect(messageRepository.save).not.toHaveBeenCalled();
  });

  it("returns INTERNAL_SERVER_ERROR when persistence fails unexpectedly", async () => {
    const messageRepository = {
      save: vi.fn().mockRejectedValue(new Error("Database unavailable")),
      findMany: vi.fn().mockResolvedValue([]),
    } satisfies MessagePersistence;

    const { response } = await postWebhook(metaPayload, messageRepository);
    const body = response.json();

    expect(response.statusCode).toBe(500);
    expect(body).toEqual({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Unexpected error while processing webhook",
    });
    expect(messageRepository.save).toHaveBeenCalledOnce();
  });
});

describe("GET /messages", () => {
  it("returns an empty list when there are no messages", async () => {
    const { response } = await getMessages();
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({ success: true, data: [], total: 0 });
  });

  it("passes provider filter to the repository and returns filtered messages", async () => {
    const mockMessage = {
      id: "clxxx1",
      provider: "meta",
      providerMessageId: "wamid.123",
      instanceId: null,
      fromPhone: "5511988888888",
      toPhone: null,
      contactName: "Joao",
      direction: "inbound",
      messageType: "text",
      text: "Hello",
      timestamp: new Date("2023-02-24T12:00:00.000Z"),
      rawPayload: {},
      intent: null,
      intentScore: null,
      intentModel: null,
      createdAt: new Date("2023-02-24T12:00:00.000Z"),
      updatedAt: new Date("2023-02-24T12:00:00.000Z"),
    };

    const messageRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn().mockResolvedValue([mockMessage]),
    } satisfies MessagePersistence;

    const { response } = await getMessages({ provider: "meta" }, messageRepository);
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(messageRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "meta" })
    );
  });

  it("returns 500 when the repository throws", async () => {
    const messageRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn().mockRejectedValue(new Error("DB connection lost")),
    } satisfies MessagePersistence;

    const { response } = await getMessages({}, messageRepository);
    const body = response.json();

    expect(response.statusCode).toBe(500);
    expect(body).toEqual({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Unexpected error while fetching messages",
    });
  });
});
