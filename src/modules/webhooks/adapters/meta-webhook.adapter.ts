import { z } from "zod";

import type { NormalizedMessage } from "../dtos/normalized-message";
import { MalformedWebhookPayloadError } from "../errors/webhook-errors";
import type { WebhookProviderAdapter } from "./webhook-provider-adapter";

const metaMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string().min(1),
  text: z
    .object({
      body: z.string().optional(),
    })
    .optional(),
});

const metaWebhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              field: z.literal("messages"),
              value: z.object({
                messaging_product: z.literal("whatsapp"),
                metadata: z.object({
                  display_phone_number: z.string().min(1),
                  phone_number_id: z.string().min(1),
                }),
                contacts: z
                  .array(
                    z.object({
                      profile: z
                        .object({
                          name: z.string().optional(),
                        })
                        .optional(),
                    })
                  )
                  .optional(),
                messages: z.array(metaMessageSchema).min(1),
              }),
            })
          )
          .min(1),
      })
    )
    .min(1),
});

type MetaWebhookPayload = z.infer<typeof metaWebhookPayloadSchema>;

export class MetaWebhookAdapter implements WebhookProviderAdapter {
  provider = "meta" as const;

  canHandle(payload: unknown): boolean {
    return metaWebhookPayloadSchema.safeParse(payload).success;
  }

  normalize(payload: unknown): NormalizedMessage {
    const parsedPayload = this.parsePayload(payload);
    const change = parsedPayload.entry[0].changes[0];
    const { metadata, contacts, messages } = change.value;
    const message = messages[0];

    return {
      provider: this.provider,
      providerMessageId: message.id,
      instanceId: metadata.phone_number_id,
      fromPhone: message.from,
      toPhone: metadata.display_phone_number,
      contactName: contacts?.[0]?.profile?.name,
      direction: "inbound",
      messageType: this.normalizeMessageType(message.type),
      text: message.text?.body,
      timestamp: this.normalizeTimestamp(message.timestamp),
      rawPayload: payload,
    };
  }

  private parsePayload(payload: unknown): MetaWebhookPayload {
    const parsedPayload = metaWebhookPayloadSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw new MalformedWebhookPayloadError("Malformed Meta webhook payload");
    }

    return parsedPayload.data;
  }

  private normalizeMessageType(type: string): NormalizedMessage["messageType"] {
    const supportedTypes: Array<NormalizedMessage["messageType"]> = [
      "text",
      "image",
      "audio",
      "video",
      "document",
    ];

    if (supportedTypes.includes(type as NormalizedMessage["messageType"])) {
      return type as NormalizedMessage["messageType"];
    }

    return "unknown";
  }

  private normalizeTimestamp(timestamp: string): Date {
    const timestampInSeconds = Number(timestamp);

    if (!Number.isFinite(timestampInSeconds)) {
      throw new MalformedWebhookPayloadError("Invalid Meta webhook timestamp");
    }

    return new Date(timestampInSeconds * 1000);
  }
}