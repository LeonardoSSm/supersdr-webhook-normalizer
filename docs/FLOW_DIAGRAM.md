# Diagrama de Fluxo — Processamento de Webhook

```mermaid
flowchart TD
    A([Provedor WhatsApp envia POST /webhooks]) --> B[Fastify recebe a requisição]

    B --> C[WebhookNormalizerService.normalize&#40;payload&#41;]

    C --> D{Para cada Adapter\ncanHandle&#40;payload&#41;?}

    D -- Não --> D
    D -- Nenhum reconheceu --> E[UnknownWebhookProviderError]
    E --> F([HTTP 400 — UNKNOWN_WEBHOOK_PROVIDER])

    D -- Sim --> G[adapter.normalize&#40;payload&#41;]

    G -- Payload inválido --> H[MalformedWebhookPayloadError]
    H --> I([HTTP 400 — MALFORMED_WEBHOOK_PAYLOAD])

    G -- Sucesso --> J[NormalizedMessage]

    J --> K[LlmClassifierService.classify&#40;normalizedMessage&#41;]

    K -- OPENAI_API_KEY ausente ou erro da API --> L[MessageIntent\nintent: unknown]
    K -- Classificação bem-sucedida --> L2[MessageIntent\nintent: sales_inquiry | support | spam | greeting]

    L --> M[MessageRepository.save&#40;normalizedMessage, intent&#41;]
    L2 --> M

    M --> N[(PostgreSQL\ntabela messages\nupsert idempotente)]

    N --> O([HTTP 200\n{ success: true, data: NormalizedMessage + intent }])
```

## Notas

- **Idempotência:** o `save` usa `upsert` com chave `(provider, providerMessageId)` — o mesmo webhook enviado duas vezes resulta em uma única linha no banco.
- **Degradação graciosa do LLM:** se `OPENAI_API_KEY` não estiver configurada, o `NoOpLlmClassifierService` retorna `intent: "unknown"` sem chamar a API. Erros da API também são capturados e não interrompem o fluxo.
- **Extensibilidade:** novos provedores são adicionados criando um novo Adapter e registrando-o em `createDefaultWebhookNormalizerService()` — sem alterar nenhum código existente.
