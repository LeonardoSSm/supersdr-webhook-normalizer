export class UnknownWebhookProviderError extends Error {
  constructor(message = "Unknown webhook provider") {
    super(message);
    this.name = "UnknownWebhookProviderError";
  }
}

export class MalformedWebhookPayloadError extends Error {
  constructor(message = "Malformed webhook payload") {
    super(message);
    this.name = "MalformedWebhookPayloadError";
  }
}

export class WebhookProcessingError extends Error {
  constructor(message = "Webhook processing failed") {
    super(message);
    this.name = "WebhookProcessingError";
  }
}