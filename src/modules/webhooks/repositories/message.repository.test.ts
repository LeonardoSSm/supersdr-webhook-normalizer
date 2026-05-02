import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { NormalizedMessage } from "../dtos/normalized-message";
import { MessageRepository } from "./message.repository";

const normalizedMessage: NormalizedMessage = {
  provider: "meta",
  providerMessageId: "provider-message-id",
  instanceId: "instance-id",
  fromPhone: "5511988888888",
  toPhone: "5511999999999",
  contactName: "Joao Silva",
  direction: "inbound",
  messageType: "text",
  text: "Ola, gostaria de saber mais sobre o produto",
  timestamp: new Date(1677234567 * 1000),
  rawPayload: {
    object: "whatsapp_business_account",
    entry: [{ id: "entry-id" }],
  },
};

function createPrismaMock() {
  return {
    message: {
      upsert: vi.fn().mockResolvedValue({ id: "message-id" }),
    },
  } as unknown as PrismaClient;
}

describe("MessageRepository", () => {
  it("calls prisma.message.upsert with the expected data", async () => {
    const prisma = createPrismaMock();
    const repository = new MessageRepository(prisma);

    await repository.save(normalizedMessage);

    expect(prisma.message.upsert).toHaveBeenCalledWith({
      where: {
        provider_providerMessageId: {
          provider: "meta",
          providerMessageId: "provider-message-id",
        },
      },
      create: {
        provider: "meta",
        providerMessageId: "provider-message-id",
        instanceId: "instance-id",
        fromPhone: "5511988888888",
        toPhone: "5511999999999",
        contactName: "Joao Silva",
        direction: "inbound",
        messageType: "text",
        text: "Ola, gostaria de saber mais sobre o produto",
        timestamp: new Date(1677234567 * 1000),
        rawPayload: {
          object: "whatsapp_business_account",
          entry: [{ id: "entry-id" }],
        },
      },
      update: {
        provider: "meta",
        providerMessageId: "provider-message-id",
        instanceId: "instance-id",
        fromPhone: "5511988888888",
        toPhone: "5511999999999",
        contactName: "Joao Silva",
        direction: "inbound",
        messageType: "text",
        text: "Ola, gostaria de saber mais sobre o produto",
        timestamp: new Date(1677234567 * 1000),
        rawPayload: {
          object: "whatsapp_business_account",
          entry: [{ id: "entry-id" }],
        },
      },
    });
  });

  it("uses provider and providerMessageId as the idempotency key", async () => {
    const prisma = createPrismaMock();
    const repository = new MessageRepository(prisma);

    await repository.save(normalizedMessage);

    expect(prisma.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_providerMessageId: {
            provider: normalizedMessage.provider,
            providerMessageId: normalizedMessage.providerMessageId,
          },
        },
      })
    );
  });

  it("persists normalized messages without provider-specific branching", async () => {
    const prisma = createPrismaMock();
    const repository = new MessageRepository(prisma);
    const zapiMessage: NormalizedMessage = {
      ...normalizedMessage,
      provider: "zapi",
      providerMessageId: "zapi-message-id",
      rawPayload: { instanceId: "zapi-instance" },
    };

    await repository.save(zapiMessage);

    expect(prisma.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_providerMessageId: {
            provider: "zapi",
            providerMessageId: "zapi-message-id",
          },
        },
        create: expect.objectContaining({
          provider: "zapi",
          rawPayload: { instanceId: "zapi-instance" },
        }),
      })
    );
  });
});