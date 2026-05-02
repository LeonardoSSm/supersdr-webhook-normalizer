import type {
  MessageProvider,
  NormalizedMessage,
} from "../dtos/normalized-message";

export interface WebhookProviderAdapter {
  provider: MessageProvider;
  canHandle(payload: unknown): boolean;
  normalize(payload: unknown): NormalizedMessage;
}