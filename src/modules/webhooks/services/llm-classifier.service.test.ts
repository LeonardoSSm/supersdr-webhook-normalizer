import { describe, expect, it, vi } from "vitest";

import type { NormalizedMessage } from "../dtos/normalized-message";
import {
  NoOpLlmClassifierService,
  OpenAiLlmClassifierService,
} from "./llm-classifier.service";

const baseMessage: NormalizedMessage = {
  provider: "meta",
  providerMessageId: "msg-1",
  fromPhone: "+5511999999999",
  direction: "inbound",
  messageType: "text",
  text: "Hello, I want to buy your product",
  contactName: "John",
  timestamp: new Date(),
  rawPayload: {},
};

describe("NoOpLlmClassifierService", () => {
  it("returns intent unknown without calling any API", async () => {
    const service = new NoOpLlmClassifierService();

    const result = await service.classify(baseMessage);

    expect(result).toEqual({ intent: "unknown", score: 0, model: "none" });
  });
});

describe("OpenAiLlmClassifierService", () => {
  it("calls the OpenAI API and returns the parsed intent", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ intent: "sales_inquiry", score: 0.95 }),
          },
        },
      ],
    });

    const mockClient = {
      chat: { completions: { create: mockCreate } },
    } as never;

    const service = new OpenAiLlmClassifierService(mockClient);
    const result = await service.classify(baseMessage);

    expect(result).toEqual({
      intent: "sales_inquiry",
      score: 0.95,
      model: "gpt-4o-mini",
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0] as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(callArgs.model).toBe("gpt-4o-mini");
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].role).toBe("user");
    expect(callArgs.messages[1].content).toContain(baseMessage.text);
    expect(callArgs.messages[1].content).toContain(baseMessage.contactName);
  });

  it("returns unknown intent without throwing when the API fails", async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error("API timeout"));

    const mockClient = {
      chat: { completions: { create: mockCreate } },
    } as never;

    const service = new OpenAiLlmClassifierService(mockClient);

    await expect(service.classify(baseMessage)).resolves.toEqual({
      intent: "unknown",
      score: 0,
      model: "gpt-4o-mini",
    });
  });
});
