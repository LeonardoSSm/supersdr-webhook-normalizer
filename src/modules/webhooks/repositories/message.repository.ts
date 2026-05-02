import { Prisma, type Message, type PrismaClient } from "@prisma/client";

import type { NormalizedMessage } from "../dtos/normalized-message";
import type { MessageIntent } from "../services/llm-classifier.service";

export class MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(
    normalizedMessage: NormalizedMessage,
    intentData?: MessageIntent
  ): Promise<Message> {
    const data = this.toMessageData(normalizedMessage, intentData);

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
    normalizedMessage: NormalizedMessage,
    intentData?: MessageIntent
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
      intent: intentData?.intent,
      intentScore: intentData?.score,
      intentModel: intentData?.model,
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