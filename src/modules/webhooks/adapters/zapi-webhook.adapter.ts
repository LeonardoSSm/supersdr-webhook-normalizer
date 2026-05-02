import { z } from "zod";

import type { NormalizedMessage } from "../dtos/normalized-message";
import { MalformedWebhookPayloadError } from "../errors/webhook-errors";
import type { WebhookProviderAdapter } from "./webhook-provider-adapter";

const zapiWebhookPayloadSchema = z.object({
  instanceId: z.string().min(1),
  messageId: z.string().min(1),
  phone: z.string().min(1),
  fromMe: z.boolean(),
  momment: z.number().int().nonnegative(),
  type: z.string().min(1).optional(),
  chatName: z.string().optional(),
  senderName: z.string().optional(),
  participantPhone: z.string().nullable().optional(),
  text: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
});

type ZapiWebhookPayload = z.infer<typeof zapiWebhookPayloadSchema>;

export class ZapiWebhookAdapter implements WebhookProviderAdapter {
  provider = "zapi" as const;

  canHandle(payload: unknown): boolean {
    return zapiWebhookPayloadSchema.safeParse(payload).success;
  }

  normalize(payload: unknown): NormalizedMessage {
    const parsedPayload = this.parsePayload(payload);
    const text = parsedPayload.text?.message;

    return {
      provider: this.provider,
      providerMessageId: parsedPayload.messageId,
      instanceId: parsedPayload.instanceId,
      fromPhone: this.normalizeFromPhone(parsedPayload),
      toPhone: undefined,
      contactName: parsedPayload.senderName ?? parsedPayload.chatName,
      direction: parsedPayload.fromMe ? "outbound" : "inbound",
      messageType: text ? "text" : "unknown",
      text,
      timestamp: new Date(parsedPayload.momment),
      rawPayload: payload,
    };
  }

  private parsePayload(payload: unknown): ZapiWebhookPayload {
    const parsedPayload = zapiWebhookPayloadSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw new MalformedWebhookPayloadError("Malformed Z-API webhook payload");
    }

    return parsedPayload.data;
  }

  private normalizeFromPhone(payload: ZapiWebhookPayload): string {
    if (!payload.fromMe) {
      return payload.phone;
    }

    return payload.participantPhone ?? payload.phone;
  }
}