# 🔌 API de Integração — OxxPharma ⇄ Maxx MMN

Documento técnico para o time da **Maxx MMN** integrar com a plataforma **OxxPharma**.

- **Base URL produção:** `https://oxxpharma.com.br`
- **Base URL homologação:** _(combinar)_
- **Formato:** JSON em todas as requisições e respostas
- **Encoding:** UTF-8
- **Versão:** v1 (atual)
- **Contato técnico:** `contato@oxxpharma.com`

---

## 📖 Visão geral

Existem **2 fluxos** de integração entre os sistemas:

| Fluxo | Direção | Quem implementa o endpoint | Quando |
|-------|---------|---------------------------|--------|
| **A. Sync de Usuários** | Maxx → OxxPharma | OxxPharma (este doc) | Quando um usuário entra/atualiza/sai da rede MMN no Maxx |
| **B. Envio de Pontos** | OxxPharma → Maxx | Maxx (vocês descrevem) | Quando um usuário compra um produto pago (em tempo real ou em lote diário) |

---

## 🔐 Autenticação (Fluxo A — Maxx → OxxPharma)

Todas as requisições do Maxx para a OxxPharma devem incluir o header:

```http
X-Webhook-Token: SEU_TOKEN_SECRETO_AQUI
```

O token é gerado pela OxxPharma em `/backoffice/sincronizacao` e enviado via canal seguro ao time Maxx.
Caso o token vaze, peça à OxxPharma para regenerar.

**Resposta de auth inválida:**
```json
HTTP 401
{"detail": "Token invalido"}
```

---

## 🟢 Fluxo A — Sincronização de Usuários da Rede MMN

### `POST /api/external/network1/sync`

Recebe lista de usuários da Rede 1 (corporativa) com a estrutura de líder. Suporta 2 ações:

- `upsert` — cria ou atualiza usuários
- `delete` — remove o vínculo de rede (não apaga o usuário, só desativa MMN)

### Headers
```http
Content-Type: application/json
X-Webhook-Token: <token>
```

### Body (`upsert`)

```json
{
  "action": "upsert",
  "default_password": "oxx@pharma",
  "users": [
    {
      "external_id": "MX-001",
      "name": "João da Silva",
      "email": "joao.silva@email.com",
      "phone": "11999999999",
      "leader_external_id": null
    },
    {
      "external_id": "MX-002",
      "name": "Maria Souza",
      "email": "maria@email.com",
      "phone": "11988887777",
      "leader_external_id": "MX-001"
    },
    {
      "external_id": "MX-003",
      "name": "Pedro Lima",
      "email": "pedro@email.com",
      "phone": "11977776666",
      "leader_external_id": "MX-001"
    }
  ]
}
```

### Campos do usuário
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `external_id` | string | ✅ | ID único do usuário no sistema Maxx |
| `name` | string | ✅ | Nome completo |
| `email` | string | ✅ | E-mail (único) |
| `phone` | string | opcional | Telefone (com DDD, somente dígitos) |
| `leader_external_id` | string \| null | opcional | `external_id` do líder direto na rede MMN. `null` para usuários no topo |

### Comportamento

- **Primeiro acesso**: usuários novos são criados com `must_set_password=true`. Eles **não conseguem logar** até definir a própria senha.
- **default_password**: senha de fallback caso o usuário nunca defina (recomendamos manter `"oxx@pharma"` ou similar).
- **leader_external_id**: a estrutura hierárquica é construída em 2 passes — primeiro inserimos todos, depois fazemos o link `network_sponsor_id`.
- **upsert idempotente**: pode chamar várias vezes; já existentes são atualizados.

### Response (sucesso)

```json
HTTP 200
{
  "ok": true,
  "stats": {
    "created": 2,
    "updated": 1,
    "deleted": 0,
    "errors": []
  }
}
```

### Body (`delete`)

```json
{
  "action": "delete",
  "users": [
    {"external_id": "MX-099"}
  ]
}
```

> O usuário **não é apagado**, apenas removido da rede (`network_type = customer`). Histórico de pedidos/comissões é preservado.

### Response

```json
HTTP 200
{
  "ok": true,
  "stats": {"created": 0, "updated": 0, "deleted": 1, "errors": []}
}
```

### Validações & erros comuns

| Status | Quando |
|--------|--------|
| `401` | Token ausente ou inválido |
| `400` | JSON malformado, action inválida, lista vazia |
| `200` com `errors[]` populado | Alguns registros falharam (e-mail duplicado em outro usuário, etc) |

---

## 🟦 Fluxo B — OxxPharma envia Pontos para o Maxx

Toda vez que um pedido é **pago**, a OxxPharma calcula a pontuação automaticamente (configurada por produto no painel admin) e dispara um POST para o endpoint que vocês fornecerem.

### O endpoint que precisamos de vocês

**Especificação esperada do endpoint da Maxx:**

```http
POST https://api.maxx.com.br/integration/points
Content-Type: application/json
Authorization: Bearer <TOKEN_FORNECIDO_POR_VOCES>
```

(Vocês podem usar **qualquer** mecanismo: Bearer, API Key em header customizado, Basic Auth, sem auth — temos suporte a todos. Só nos digam qual.)

### Payload que a OxxPharma irá enviar

```json
{
  "source": "oxxpharma",
  "sent_at": "2026-04-29T18:30:00Z",
  "count": 2,
  "points": [
    {
      "user_id": "user_abc123",
      "external_id": "MX-001",
      "name": "João da Silva",
      "email": "joao.silva@email.com",
      "points": 50.0,
      "registered_at": "2026-04-29T18:25:00Z",
      "order_id": "ord_xxx",
      "product_name": "Colágeno Hidrolisado",
      "quantity": 2
    },
    {
      "user_id": "user_def456",
      "external_id": "MX-002",
      "name": "Maria Souza",
      "email": "maria@email.com",
      "points": 30.0,
      "registered_at": "2026-04-29T18:27:00Z",
      "order_id": "ord_yyy",
      "product_name": "Vitamina D3",
      "quantity": 1
    }
  ]
}
```

### Campos do payload

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `source` | string | Sempre `"oxxpharma"` |
| `sent_at` | ISO 8601 UTC | Timestamp do envio |
| `count` | int | Quantidade de registros no batch |
| `points[].user_id` | string | ID interno OxxPharma (sempre presente) |
| `points[].external_id` | string \| null | `external_id` do Maxx (chave para vocês — vai ser `null` para usuários que não foram importados) |
| `points[].name` | string | Nome do usuário |
| `points[].email` | string | E-mail (chave alternativa) |
| `points[].points` | float | Pontos a creditar |
| `points[].registered_at` | ISO 8601 UTC | Quando os pontos foram gerados |
| `points[].order_id` | string | ID do pedido OxxPharma |
| `points[].product_name` | string | Nome do produto comprado |
| `points[].quantity` | int | Quantidade de itens |

### Resposta esperada do Maxx

```json
HTTP 200 ou 201
{"ok": true}        // qualquer body é aceito
```

**Qualquer status 2xx** é considerado sucesso. A OxxPharma marcará os registros como `applied_externally=true` e não tentará reenviar.

**4xx ou 5xx**: registros ficam pendentes para nova tentativa no próximo batch ou disparo manual.

### Modos de operação (configuráveis no painel admin)

A OxxPharma pode operar em 3 modos que vocês escolhem:

1. **`realtime`** — envia 1 requisição por usuário **imediatamente** após cada pedido pago. Mais simples, mas mais chamadas. Recomendado se vocês conseguem processar em tempo real.
2. **`batch`** — agrupa todos os pontos do dia e envia em **1 única requisição diária às 23:50 BRT**. Recomendado para reduzir tráfego.
3. **`manual`** — admin OxxPharma dispara manualmente quando quiser. Útil para começar e validar.

### Customização de payload (opcional)

Se o formato acima não bater 100% com o de vocês, podemos personalizar via **template** no painel OxxPharma usando a variável `{{batch_json}}`. Exemplo:

```json
{
  "api_version": "1",
  "client": "oxxpharma",
  "data": {{batch_json}}
}
```

Vocês passam o formato esperado e configuramos.

### Idempotência

Cada `point.order_id + product_name + registered_at` é único. Se vocês receberem 2 vezes o mesmo registro (rede instável + retry da nossa parte), tratem como **idempotente** ou retornem `200` mesmo que já tenham processado.

---

## 📊 Boas práticas

### Para o time Maxx
- Configure **rate limit** generoso no endpoint de pontos (estimamos picos de 100 req/min)
- Logue **todos** os requests recebidos por **30 dias** para reconciliação
- Em caso de manutenção, retornem `503` — vamos tentar novamente
- Forneçam um endpoint `GET /health` para que possamos monitorar

### Para o time OxxPharma
- Logamos cada chamada outbound em `db.maxx_logs` (visível em `/backoffice/maxx`)
- Tokens armazenados criptografados no DB (não no .env)
- Retentativa automática em falhas transientes (3x com backoff exponencial)

---

## 🧪 Como testar (curl)

### A — Sync de usuários

```bash
curl -X POST "https://oxxpharma.com.br/api/external/network1/sync" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: SEU_TOKEN_AQUI" \
  -d '{
    "action": "upsert",
    "users": [
      {"external_id":"TEST-001","name":"Teste","email":"teste@maxx.com","phone":"11999999999"}
    ]
  }'
```

### B — Forçar envio de pontos (admin)

(uso interno OxxPharma — não exposto ao Maxx)

```bash
curl -X POST "https://oxxpharma.com.br/api/admin/maxx-sync-points" \
  -H "Authorization: Bearer <jwt_admin_oxxpharma>"
```

---

## 🗺️ Roadmap futuro (próximas versões)

| Versão | O quê |
|--------|-------|
| v1.1 | Endpoint `GET /api/external/users` para Maxx puxar dados (read-only) |
| v1.2 | Webhook bidirecional para invalidação de pedidos |
| v1.3 | Reembolsos sincronizados (pontos reversos) |

---

## 📞 Suporte

- **OxxPharma técnico:** `contato@oxxpharma.com`
- **Issue tracker:** _(combinar)_
- **Status page:** `https://oxxpharma.com.br/api/health`

---

**Versão deste documento:** 1.0 — 2026-04-29
**Próxima revisão:** após implementação inicial pelos times
