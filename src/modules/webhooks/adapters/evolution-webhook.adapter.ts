import { z } from "zod";

import type { NormalizedMessage } from "../dtos/normalized-message";
import { MalformedWebhookPayloadError } from "../errors/webhook-errors";
import type { WebhookProviderAdapter } from "./webhook-provider-adapter";

const evolutionWebhookPayloadSchema = z
  .object({
    event: z.literal("messages.upsert"),
    instance: z.string().min(1),
    data: z.object({
      key: z.object({
        remoteJid: z.string().min(1),
        fromMe: z.boolean(),
        id: z.string().min(1),
      }),
      pushName: z.string().optional(),
      message: z
        .object({
          conversation: z.string().optional(),
        })
        .optional(),
      messageType: z.string().min(1),
      messageTimestamp: z.number().int().nonnegative().optional(),
    }),
    destination: z.string().min(1).optional(),
    date_time: z.string().datetime().optional(),
  })
  .superRefine((payload, context) => {
    if (payload.data.messageTimestamp === undefined && payload.date_time === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "messageTimestamp or date_time is required",
        path: ["data", "messageTimestamp"],
      });
    }
  });

type EvolutionWebhookPayload = z.infer<typeof evolutionWebhookPayloadSchema>;

export class EvolutionWebhookAdapter implements WebhookProviderAdapter {
  provider = "evolution" as const;

  canHandle(payload: unknown): boolean {
    return evolutionWebhookPayloadSchema.safeParse(payload).success;
  }

  normalize(payload: unknown): NormalizedMessage {
    const parsedPayload = this.parsePayload(payload);
    const { data } = parsedPayload;

    return {
      provider: this.provider,
      providerMessageId: data.key.id,
      instanceId: parsedPayload.instance,
      fromPhone: this.normalizePhone(data.key.remoteJid),
      toPhone: parsedPayload.destination
        ? this.normalizePhone(parsedPayload.destination)
        : undefined,
      contactName: data.pushName,
      direction: data.key.fromMe ? "outbound" : "inbound",
      messageType: this.normalizeMessageType(data.messageType),
      text: data.message?.conversation,
      timestamp: this.normalizeTimestamp(data.messageTimestamp, parsedPayload.date_time),
      rawPayload: payload,
    };
  }

  private parsePayload(payload: unknown): EvolutionWebhookPayload {
    const parsedPayload = evolutionWebhookPayloadSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw new MalformedWebhookPayloadError("Malformed Evolution webhook payload");
    }

    return parsedPayload.data;
  }

  private normalizeMessageType(type: string): NormalizedMessage["messageType"] {
    const messageTypeMap: Record<string, NormalizedMessage["messageType"]> = {
      conversation: "text",
      imageMessage: "image",
      audioMessage: "audio",
      videoMessage: "video",
      documentMessage: "document",
    };

    return messageTypeMap[type] ?? "unknown";
  }

  private normalizePhone(jid: string): string {
    return jid.replace(/@s\.whatsapp\.net$/, "");
  }

  private normalizeTimestamp(messageTimestamp?: number, dateTime?: string): Date {
    if (messageTimestamp !== undefined) {
      return new Date(messageTimestamp * 1000);
    }

    if (dateTime !== undefined) {
      return new Date(dateTime);
    }

    throw new MalformedWebhookPayloadError("Invalid Evolution webhook timestamp");
  }
}