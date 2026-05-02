import { describe, expect, it } from "vitest";

import { MalformedWebhookPayloadError } from "../errors/webhook-errors";
import { EvolutionWebhookAdapter } from "./evolution-webhook.adapter";

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
  date_time: "2024-01-15T10:30:00.000Z",
  sender: "5511988888888@s.whatsapp.net",
  server_url: "https://sua-evolution-api.com",
  apikey: "sua-api-key",
};

describe("EvolutionWebhookAdapter", () => {
  const adapter = new EvolutionWebhookAdapter();

  it("identifies valid Evolution API webhook payloads", () => {
    expect(adapter.provider).toBe("evolution");
    expect(adapter.canHandle(evolutionPayload)).toBe(true);
  });

  it("does not identify unknown payloads", () => {
    expect(adapter.canHandle({ event: "unknown" })).toBe(false);
  });

  it("normalizes a text message payload", () => {
    const normalizedMessage = adapter.normalize(evolutionPayload);

    expect(normalizedMessage).toEqual({
      provider: "evolution",
      providerMessageId: "3EB0B430B6F8C1D073A0",
      instanceId: "minha-instancia",
      fromPhone: "5511988888888",
      toPhone: "5511999999999",
      contactName: "Joao Silva",
      direction: "inbound",
      messageType: "text",
      text: "Ola, gostaria de saber mais sobre o produto",
      timestamp: new Date(1677234567 * 1000),
      rawPayload: evolutionPayload,
    });
  });

  it("removes the WhatsApp JID suffix from phone numbers", () => {
    const normalizedMessage = adapter.normalize(evolutionPayload);

    expect(normalizedMessage.fromPhone).toBe("5511988888888");
    expect(normalizedMessage.toPhone).toBe("5511999999999");
  });

  it("sets direction as inbound when fromMe is false", () => {
    expect(adapter.normalize(evolutionPayload).direction).toBe("inbound");
  });

  it("sets direction as outbound when fromMe is true", () => {
    const outboundPayload = structuredClone(evolutionPayload);
    outboundPayload.data.key.fromMe = true;

    expect(adapter.normalize(outboundPayload).direction).toBe("outbound");
  });

  it("maps Evolution message types to internal message types", () => {
    const imagePayload = structuredClone(evolutionPayload);
    imagePayload.data.messageType = "imageMessage";

    const unknownPayload = structuredClone(evolutionPayload);
    unknownPayload.data.messageType = "stickerMessage";

    expect(adapter.normalize(imagePayload).messageType).toBe("image");
    expect(adapter.normalize(unknownPayload).messageType).toBe("unknown");
  });

  it("uses date_time as timestamp fallback", () => {
    const fallbackPayload = {
      ...evolutionPayload,
      data: {
        ...evolutionPayload.data,
        messageTimestamp: undefined,
      },
    };

    expect(adapter.normalize(fallbackPayload).timestamp).toEqual(
      new Date("2024-01-15T10:30:00.000Z")
    );
  });

  it("throws MalformedWebhookPayloadError for malformed payloads", () => {
    expect(() => adapter.normalize({ event: "messages.upsert" })).toThrow(
      MalformedWebhookPayloadError
    );
  });
});