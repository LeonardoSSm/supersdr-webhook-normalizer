# SuperSDR – Sistema de Normalização de Webhooks

## Descrição

O **SuperSDR Webhook Normalizer** resolve um problema real de integrações com WhatsApp: cada provedor (Meta Cloud API, Evolution API, Z-API) envia payloads em formatos completamente diferentes. Sem um normalizador, a aplicação consumidora precisa entender e tratar cada formato separadamente, o que gera código duplicado e difícil de manter.

Este sistema recebe webhooks de qualquer provedor suportado, normaliza o payload para um formato único (`NormalizedMessage`), persiste a mensagem no banco de dados PostgreSQL e, opcionalmente, classifica a intenção do contato usando a OpenAI API (`gpt-4o-mini`). O resultado é uma interface consistente independente de qual provedor originou a mensagem.

---

## Tecnologias

| Tecnologia     | Uso                                              |
|----------------|--------------------------------------------------|
| TypeScript     | Tipagem estática em todo o projeto               |
| Node.js ≥ 20   | Runtime                                          |
| Fastify        | HTTP framework de alta performance               |
| Prisma         | ORM e migrations para o banco de dados           |
| PostgreSQL      | Banco de dados relacional                        |
| Zod            | Validação de variáveis de ambiente               |
| Vitest         | Testes unitários e de integração                 |
| Pino           | Logger estruturado (integrado ao Fastify)        |
| OpenAI API     | Classificação de intenção via `gpt-4o-mini`      |
| Docker         | Provisionamento do PostgreSQL via Docker Compose |

---

## Como Rodar

**Pré-requisitos:** Node.js >= 20 e Docker instalados.

```bash
# 1. Clone e entre no projeto
git clone <url-do-repo>
cd supersdr-webhook-normalizer

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env e preencha OPENAI_API_KEY (opcional — sem ela usa NoOpClassifier)

# 3. Suba o banco de dados
docker-compose up -d

# 4. Instale as dependências
npm install

# 5. Execute as migrations
npm run prisma:migrate

# 6. Inicie o servidor em modo desenvolvimento
npm run dev
```

O servidor sobe em `http://localhost:3333`.

### Testes

```bash
npm test
```

---

## Exemplos de uso

### POST /webhooks — Meta Cloud API

```bash
curl -X POST http://localhost:3333/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "5511999999999",
            "phone_number_id": "PHONE_NUMBER_ID"
          },
          "contacts": [{ "profile": { "name": "Joao Silva" } }],
          "messages": [{
            "from": "5511988888888",
            "id": "wamid.message-id",
            "timestamp": "1677234567",
            "type": "text",
            "text": { "body": "Ola, gostaria de saber mais sobre o produto" }
          }]
        }
      }]
    }]
  }'
```

### POST /webhooks — Evolution API

```bash
curl -X POST http://localhost:3333/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "minha-instancia",
    "data": {
      "key": {
        "remoteJid": "5511988888888@s.whatsapp.net",
        "fromMe": false,
        "id": "3EB0B430B6F8C1D073A0"
      },
      "pushName": "Joao Silva",
      "message": { "conversation": "Ola, gostaria de saber mais sobre o produto" },
      "messageType": "conversation",
      "messageTimestamp": 1677234567
    },
    "destination": "5511999999999@s.whatsapp.net"
  }'
```

### POST /webhooks — Z-API

```bash
curl -X POST http://localhost:3333/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "SUA_INSTANCE_ID",
    "messageId": "3EB0B430B6F8C1D073A0",
    "phone": "5511988888888",
    "fromMe": false,
    "momment": 1677234567000,
    "type": "ReceivedCallback",
    "senderName": "Joao Silva",
    "text": { "message": "Ola, gostaria de saber mais sobre o produto" }
  }'
```

### GET /messages — Listar mensagens com filtros

```bash
# Todas as mensagens (limite padrão: 20)
curl http://localhost:3333/messages

# Filtrar por provedor
curl "http://localhost:3333/messages?provider=meta"

# Filtrar por telefone do remetente
curl "http://localhost:3333/messages?fromPhone=5511988888888"

# Combinar filtros com limite customizado
curl "http://localhost:3333/messages?provider=evolution&limit=5"
```

---

## Decisões Técnicas

### Pattern: Adapter

Cada provedor tem um Adapter que implementa a interface `WebhookProviderAdapter` com dois métodos: `canHandle(payload)` e `normalize(payload)`. O `WebhookNormalizerService` itera a lista de adapters e delega para o primeiro que reconhece o payload.

Adicionar suporte a um novo provedor significa criar **1 arquivo novo** sem alterar nada existente — princípio Open/Closed (OCP). Por exemplo, para suportar Typebot basta criar `typebot-webhook.adapter.ts` e registrá-lo em `createDefaultWebhookNormalizerService()`. Nenhuma linha existente é modificada.

### Fastify ao invés de Express

Fastify oferece melhor throughput, tipagem nativa com TypeScript via generics, e o logger Pino embutido com output estruturado em JSON — o que facilita ingestão por ferramentas como Datadog ou Grafana sem configuração adicional.

### Banco de Dados

O schema reflete diretamente os campos do `NormalizedMessage` (provider, fromPhone, text, timestamp, etc.) mais o `rawPayload` em JSON para rastreabilidade completa — se houver um bug no adapter, o payload original ainda está lá para debug.

O `upsert` com `@@unique([provider, providerMessageId])` garante **idempotência**: o mesmo webhook enviado duas vezes não gera duplicata. Isso é crítico porque provedores como a Meta reenviam webhooks em caso de timeout.

### Extensibilidade

Para adicionar **Typebot** como provedor:

```typescript
// src/modules/webhooks/adapters/typebot-webhook.adapter.ts
export class TypebotWebhookAdapter implements WebhookProviderAdapter {
  provider = "typebot" as const;
  canHandle(payload: unknown): boolean { /* ... */ }
  normalize(payload: unknown): NormalizedMessage { /* ... */ }
}
```

```typescript
// src/modules/webhooks/services/webhook-normalizer.service.ts
export function createDefaultWebhookNormalizerService() {
  return new WebhookNormalizerService([
    new MetaWebhookAdapter(),
    new EvolutionWebhookAdapter(),
    new ZapiWebhookAdapter(),
    new TypebotWebhookAdapter(), // <-- apenas esta linha nova
  ]);
}
```

Zero alteração no código existente.

### Tratamento de Erros

Três tipos de erro com semânticas distintas:

| Erro                          | HTTP | Quando ocorre                                      |
|-------------------------------|------|----------------------------------------------------|
| `UnknownWebhookProviderError` | 400  | Nenhum adapter reconhece o payload                 |
| `MalformedWebhookPayloadError`| 400  | Adapter reconheceu mas o payload está incompleto   |
| `WebhookProcessingError`      | 500  | Erro inesperado durante o processamento            |

O handler da rota mapeia cada tipo para o HTTP status correto, sem vazar stack traces para o cliente.

### Integração com LLM

Após normalizar a mensagem, o `LlmClassifierService` classifica a intenção do contato usando `gpt-4o-mini`. A classificação retorna `{ intent, score, model }` e é salva junto com a mensagem no banco.

Se `OPENAI_API_KEY` não estiver configurada, o sistema usa o `NoOpLlmClassifierService`, que retorna `intent: "unknown"` sem chamar a API (graceful degradation). Erros da API também são capturados silenciosamente e retornam `unknown` — a falha da classificação não interrompe o fluxo principal de persistência.

### Como a IA me ajudou

Utilizei o Claude para acelerar partes repetitivas do desenvolvimento: geração de schemas Zod, estrutura de testes unitários com mocks, e código boilerplate de adapters. Cada trecho gerado foi revisado, ajustado ao contexto do projeto e validado contra os testes. A arquitetura, as decisões de design (escolha dos padrões, idempotência via upsert, degradação graciosa do LLM) e o entendimento de cada linha são meus.

---

## Funcionalidades Implementadas

- [x] POST /webhooks — recebimento e normalização
- [x] Adapter: Meta Cloud API
- [x] Adapter: Evolution API
- [x] Adapter: Z-API
- [x] Persistência em PostgreSQL com idempotência
- [x] Tratamento de erros (3 tipos distintos)
- [x] Testes unitários (adapters, service, routes, repository)
- [x] Classificação de intenção via LLM (OpenAI gpt-4o-mini)
- [x] GET /messages com filtros
- [x] Docker Compose para PostgreSQL
- [ ] Teste com provedor real (Z-API ou Evolution)
