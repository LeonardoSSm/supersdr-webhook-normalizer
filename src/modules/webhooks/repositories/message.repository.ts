import { Prisma, type Message, type PrismaClient } from "@prisma/client";

import type { NormalizedMessage } from "../dtos/normalized-message";

export class MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(normalizedMessage: NormalizedMessage): Promise<Message> {
    const data = this.toMessageData(normalizedMessage);

    return this.prisma.message.upsert({
      where: {
        provider_providerMessageId: {
          provider: normalizedMessage.provider,
          providerMessageId: normalizedMessage.providerMessageId,
        },
      },
      create: data,
      update: data,
    });
  }

  private toMessageData(
    normalizedMessage: NormalizedMessage
  ): Prisma.MessageCreateInput {
    return {
      provider: normalizedMessage.provider,
      providerMessageId: normalizedMessage.providerMessageId,
      instanceId: normalizedMessage.instanceId,
      fromPhone: normalizedMessage.fromPhone,
      toPhone: normalizedMessage.toPhone,
      contactName: normalizedMessage.contactName,
      direction: normalizedMessage.direction,
      messageType: normalizedMessage.messageType,
      text: normalizedMessage.text,
      timestamp: normalizedMessage.timestamp,
      rawPayload: this.toJsonValue(normalizedMessage.rawPayload),
    };
  }

  private toJsonValue(
    value: unknown
  ): Prisma.JsonNullValueInput | Prisma.InputJsonValue {
    const serializedValue = JSON.stringify(value);

    if (serializedValue === undefined) {
      return Prisma.JsonNull;
    }

    return JSON.parse(serializedValue) as Prisma.InputJsonValue;
  }
}