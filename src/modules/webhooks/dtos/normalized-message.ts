export type MessageProvider = "meta" | "evolution" | "zapi";

export type MessageDirection = "inbound" | "outbound";

export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "unknown";

export interface NormalizedMessage {
  provider: MessageProvider;
  providerMessageId: string;
  instanceId?: string;
  fromPhone: string;
  toPhone?: string;
  contactName?: string;
  direction: MessageDirection;
  messageType: MessageType;
  text?: string;
  timestamp: Date;
  // Original provider payload kept for traceability and troubleshooting.
  rawPayload: unknown;
}