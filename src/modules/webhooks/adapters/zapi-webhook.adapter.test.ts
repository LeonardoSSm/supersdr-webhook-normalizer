import { describe, expect, it } from "vitest";

import { MalformedWebhookPayloadError } from "../errors/webhook-errors";
import { ZapiWebhookAdapter } from "./zapi-webhook.adapter";

const zapiPayload = {
  instanceId: "SUA_INSTANCE_ID",
  messageId: "3EB0B430B6F8C1D073A0",
  phone: "5511988888888",
  fromMe: false,
  momment: 1677234567000,
  status: "RECEIVED",
  chatName: "Joao Silva Chat",
  senderPhoto: "https://pps.whatsapp.net/...",
  senderName: "Joao Silva",
  participantPhone: null,
  photo: "https://pps.whatsapp.net/...",
  broadcast: false,
  type: "ReceivedCallback",
  text: {
    message: "Ola, gostaria de saber mais sobre o produto",
  },
};

describe("ZapiWebhookAdapter", () => {
  const adapter = new ZapiWebhookAdapter();

  it("identifies valid Z-API webhook payloads", () => {
    expect(adapter.canHandle(zapiPayload)).toBe(true);
  });

  it("does not identify unknown payloads", () => {
    expect(adapter.canHandle({ event: "messages.upsert" })).toBe(false);
  });

  it("normalizes a text message payload", () => {
    const normalizedMessage = adapter.normalize(zapiPayload);

    expect(normalizedMessage).toEqual({
      provider: "zapi",
      providerMessageId: "3EB0B430B6F8C1D073A0",
      instanceId: "SUA_INSTANCE_ID",
      fromPhone: "5511988888888",
      toPhone: undefined,
      contactName: "Joao Silva",
      direction: "inbound",
      messageType: "text",
      text: "Ola, gostaria de saber mais sobre o produto",
      timestamp: new Date(1677234567000),
      rawPayload: zapiPayload,
    });
  });

  it("sets provider as zapi", () => {
    expect(adapter.normalize(zapiPayload).provider).toBe("zapi");
  });

  it("sets direction as inbound when fromMe is false", () => {
    expect(adapter.normalize(zapiPayload).direction).toBe("inbound");
  });

  it("sets direction as outbound when fromMe is true", () => {
    const outboundPayload = {
      ...zapiPayload,
      fromMe: true,
      participantPhone: "5511977777777",
    };

    const normalizedMessage = adapter.normalize(outboundPayload);

    expect(normalizedMessage.direction).toBe("outbound");
    expect(normalizedMessage.fromPhone).toBe("5511977777777");
  });

  it("uses senderName as contactName when available", () => {
    expect(adapter.normalize(zapiPayload).contactName).toBe("Joao Silva");
  });

  it("uses chatName as contactName fallback", () => {
    const fallbackPayload = {
      ...zapiPayload,
      senderName: undefined,
    };

    expect(adapter.normalize(fallbackPayload).contactName).toBe("Joao Silva Chat");
  });

  it("converts momment from milliseconds to Date", () => {
    expect(adapter.normalize(zapiPayload).timestamp).toEqual(new Date(1677234567000));
  });

  it("maps payloads without text message as unknown message type", () => {
    const unknownMessagePayload = {
      ...zapiPayload,
      text: undefined,
    };

    const normalizedMessage = adapter.normalize(unknownMessagePayload);

    expect(normalizedMessage.messageType).toBe("unknown");
    expect(normalizedMessage.text).toBeUndefined();
  });

  it("throws MalformedWebhookPayloadError for malformed payloads", () => {
    expect(() => adapter.normalize({ instanceId: "SUA_INSTANCE_ID" })).toThrow(
      MalformedWebhookPayloadError
    );
  });
});