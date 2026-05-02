import type OpenAI from "openai";

import type { NormalizedMessage } from "../dtos/normalized-message";

export type MessageIntent = {
  intent: string;
  score: number;
  model: string;
};

export interface LlmClassifierService {
  classify(message: NormalizedMessage): Promise<MessageIntent>;
}

const SYSTEM_PROMPT = `You are an intent classifier for WhatsApp messages.
Analyze the message and return ONLY a JSON object with no additional text, markdown, or explanation.
The JSON must follow this exact format:
{"intent":"<intent>","score":<score>}
Where:
- intent is one of: "sales_inquiry", "support", "spam", "greeting", "unknown"
- score is a float between 0.0 and 1.0 representing confidence`;

const MODEL = "gpt-4o-mini";

export class NoOpLlmClassifierService implements LlmClassifierService {
  async classify(_message: NormalizedMessage): Promise<MessageIntent> {
    return { intent: "unknown", score: 0, model: "none" };
  }
}

export class OpenAiLlmClassifierService implements LlmClassifierService {
  constructor(private readonly client: OpenAI) {}

  async classify(message: NormalizedMessage): Promise<MessageIntent> {
    try {
      const userPrompt = [
        `Contact name: ${message.contactName ?? "unknown"}`,
        `Message: ${message.text ?? "(no text)"}`,
      ].join("\n");

      const completion = await this.client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 64,
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as { intent: string; score: number };

      return {
        intent: parsed.intent,
        score: parsed.score,
        model: MODEL,
      };
    } catch (error) {
      console.error("LLM classification failed", error);
      return { intent: "unknown", score: 0, model: MODEL };
    }
  }
}
