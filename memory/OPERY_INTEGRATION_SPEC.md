# Integração OxxPharma ↔ Opery Solutions

**Versão:** 1.0 · **Data:** Fev/2026
**Ambiente de teste:** `https://oxx-franchise-system.preview.emergentagent.com`
**Ambiente produção:** _(a definir — mesmo domínio da loja)_

Este documento descreve o contrato de integração entre o sistema **OxxPharma** (e-commerce online) e o **Opery Solutions** (ERP interno da loja física). A integração é bidirecional:

1. **Opery → OxxPharma** (Inbound): envio de vendas presenciais para consolidar dashboard.
2. **OxxPharma → Opery** (Outbound): envio de pedidos online pagos para emissão de NF-e.

---

## 1. Autenticação

Ambos os lados usam **API Key** (bearer token) trocada via header HTTP.

| Direção | Header | Variável no destino |
|---|---|---|
| Opery → OxxPharma | `X-Opery-Api-Key: <chave>` | `OPERY_WEBHOOK_SECRET` |
| OxxPharma → Opery | `Authorization: Bearer <chave>` | `OPERY_OUTBOUND_TOKEN` |

> A chave da Opery para acessar nossos endpoints será enviada por canal seguro (não fica em código). Nunca coloque em URL.

---

## 2. INBOUND — Opery envia vendas presenciais

### 2.1 Endpoint

```
POST {OXXPHARMA_BASE_URL}/api/opery/webhook/sales
```

### 2.2 Headers

```
Content-Type: application/json
X-Opery-Api-Key: <chave-fornecida-pela-oxxpharma>
```

### 2.3 Body (JSON)

Aceita **1 venda** ou **lote**. Use `sale` para 1 e `sales` para várias.

#### Envio único
```json
{
  "sale": {
    "opery_order_id": "OP-2026-000123",
    "order_date": "2026-02-15T14:32:00-03:00",
    "total": 250.50,
    "status": "paid",
    "customer_name": "Maria Silva",
    "customer_cpf": "12345678900",
    "customer_email": "maria@exemplo.com",
    "payment_method": "pix",
    "branch": "Loja Centro",
    "operator": "Vendedor 07",
    "items": [
      {
        "sku": "MED-DIP-500",
        "name": "Dipirona 500mg 20 comp",
        "qty": 2,
        "unit_price": 15.90,
        "total": 31.80
      }
    ],
    "metadata": { "nfce_number": "12345", "session_id": "abc" }
  }
}
```

#### Envio em lote (recomendado para sync diário)
```json
{
  "sales": [
    { "opery_order_id": "OP-001", "order_date": "2026-02-15", "total": 89.90, "status": "paid" },
    { "opery_order_id": "OP-002", "order_date": "2026-02-15", "total": 420.00, "status": "pending" }
  ]
}
```

### 2.4 Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `opery_order_id` | string | **sim** | ID único do pedido no ERP (garante idempotência) |
| `order_date` | string | recomendado | ISO-8601 (`2026-02-15T14:32:00-03:00`) ou `YYYY-MM-DD` ou `DD/MM/YYYY [HH:MM:SS]` |
| `total` | number | recomendado | Valor total do pedido em reais |
| `status` | string | recomendado | `paid`\|`pending`\|`cancelled` (também aceita PT: `pago`, `aguardando`, `cancelado`) |
| `customer_name` | string | opcional | Nome do cliente |
| `customer_cpf` | string | opcional | CPF (só dígitos ou formatado) |
| `customer_email` | string | opcional | Email do cliente |
| `payment_method` | string | opcional | `pix`, `credito`, `debito`, `dinheiro`, etc. |
| `branch` | string | opcional | Filial/loja |
| `operator` | string | opcional | Vendedor/operador do caixa |
| `items` | array | opcional | Itens do pedido (opcional para MVP) |
| `metadata` | object | opcional | Qualquer JSON adicional que a Opery quiser guardar |

### 2.5 Comportamento

- **Idempotente**: reenviar o mesmo `opery_order_id` **atualiza** o registro existente (não duplica).
- Vendas cancelam-se enviando `status: "cancelled"` no mesmo `opery_order_id`.
- Alterações de status/valor após emissão: enviar payload atualizado com mesmo ID.

### 2.6 Resposta

```json
{
  "received": 2,
  "created": 1,
  "updated": 1,
  "errors": []
}
```

Códigos HTTP:
- `200`: processado (mesmo com alguns itens em `errors`).
- `400`: body inválido (ausência de `sale`/`sales`).
- `401`: `X-Opery-Api-Key` inválido ou ausente.

### 2.7 Health check

```
POST {OXXPHARMA_BASE_URL}/api/opery/webhook/health
X-Opery-Api-Key: <chave>
```

Resposta:
```json
{ "ok": true, "message": "Autenticado. Endpoint de vendas: POST /api/opery/webhook/sales" }
```

Use este endpoint para validar chave e conectividade antes de enviar produção.

### 2.8 Frequência recomendada

- **Realtime** (recomendado): dispare o webhook logo após cada venda finalizada.
- **Batch** (fallback): rode um sync a cada 5–15 min enviando as vendas do intervalo.
- Envie também **status updates** (ex: quando um pedido pendente for pago).

---

## 3. OUTBOUND — OxxPharma envia pedidos online pagos

Quando um pedido é pago no site da OxxPharma, disparamos automaticamente um POST para o endpoint da Opery para que ela emita a NF-e e (opcionalmente) retorne os dados fiscais.

### 3.1 O que a Opery precisa expor

```
POST {OPERY_BASE_URL}/<caminho-a-definir>
```

Endpoint que:
1. Recebe o payload de pedido pago.
2. Registra internamente e retorna `2xx` imediatamente (idealmente < 5s).
3. Processa a emissão de NF-e de forma assíncrona.
4. **(Opcional)** Retorna o número da NF-e no corpo da resposta se já disponível.

### 3.2 Headers que vamos enviar

```
Content-Type: application/json
Authorization: Bearer <token-fornecido-pela-opery>
X-OxxPharma-Source: oxxpharma-app
```

### 3.3 Payload que vamos enviar

```json
{
  "source": "oxxpharma",
  "order_id": "ord_abcdef123456",
  "invoice_number": "2026000042",
  "order_date": "2026-02-15T10:23:00+00:00",
  "paid_at": "2026-02-15T10:24:15+00:00",
  "payment_method": "pix",
  "payment_id": "MP-98765432",
  "customer": {
    "user_id": "usr_xyz789",
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "cpf": "12345678900",
    "cnpj": null,
    "phone": "+5511988887777"
  },
  "shipping_address": {
    "street": "Av. Paulista",
    "number": "1000",
    "complement": "Apto 42",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "zip": "01310100",
    "country": "BR"
  },
  "items": [
    {
      "sku": "MED-DIP-500",
      "product_id": "prod_abc",
      "name": "Dipirona 500mg 20 comp",
      "quantity": 2,
      "unit_price": 15.90,
      "total": 31.80,
      "ncm": null,
      "cfop": null
    }
  ],
  "totals": {
    "subtotal": 31.80,
    "discount": 0,
    "shipping": 12.50,
    "total": 44.30
  },
  "shipping_method": "PAC",
  "tracking_code": null,
  "notes": null
}
```

### 3.4 Resposta esperada da Opery

**Mínimo aceitável (assíncrono):**
```json
{ "received": true }
```

**Recomendado (já com NF):**
```json
{
  "received": true,
  "nf_number": "2026000042",
  "nf_url": "https://opery.example.com/nfe/2026000042.pdf",
  "issued_at": "2026-02-15T10:25:00-03:00"
}
```

Se a Opery retornar `nf_number` e `nf_url`, gravamos no pedido nos campos `opery_nf_number`, `opery_nf_url` e `opery_nf_issued_at`.

### 3.5 Retry e idempotência

- Tentaremos até **5 vezes** em caso de falha (`5xx` ou timeout).
- Cada request enviada tem o `order_id` como chave — a Opery deve tratar como **idempotente** (mesmo pedido enviado 2x = uma única NF).
- Falhas ficam armazenadas em `opery_dispatch_log` e podem ser reprocessadas manualmente pelo admin.

### 3.6 Callback opcional (NF assíncrona)

Se a NF-e for emitida de forma assíncrona (webhook de retorno), a Opery pode chamar:

```
POST {OXXPHARMA_BASE_URL}/api/opery/webhook/sales
X-Opery-Api-Key: <chave>

{
  "sale": {
    "opery_order_id": "ord_abcdef123456",
    "status": "paid",
    "metadata": {
      "nf_number": "2026000042",
      "nf_url": "https://opery.example.com/nfe/2026000042.pdf"
    }
  }
}
```

_(Podemos criar um endpoint dedicado `POST /api/opery/webhook/nf-issued` se preferirem — basta avisar.)_

---

## 4. Timezone & formatos

- Todas as datas devem estar em **ISO-8601** com offset. Se enviar sem timezone, assumimos **UTC**.
- Timezone padrão de negócio: `America/Sao_Paulo` (BRT/BRST).
- Valores monetários: `number` (não string), 2 casas decimais, `.` como separador decimal. Ex.: `1234.56`.

## 5. Códigos de erro

| HTTP | Significado | Ação |
|---|---|---|
| 200 | OK | Nada a fazer |
| 400 | Payload inválido | Corrigir formato conforme spec |
| 401 | Chave inválida | Verificar `X-Opery-Api-Key` |
| 429 | Rate limit (a implementar) | Aguardar e reenviar |
| 5xx | Erro no servidor | Retry exponencial (nossa API já faz retry em outbound) |

---

## 6. Checklist para a equipe Opery

- [ ] Receber a chave `X-Opery-Api-Key` da OxxPharma (canal seguro).
- [ ] Implementar chamada ao `POST /api/opery/webhook/sales` a cada venda registrada.
- [ ] Validar via `POST /api/opery/webhook/health`.
- [ ] Enviar seed inicial (últimas vendas do mês) para dashboard começar populado.
- [ ] **Fase 2**: Expor endpoint `POST` que aceite o payload de "pedido pago" (seção 3) e emita NF-e.
- [ ] **Fase 2**: Fornecer URL e token (`OPERY_OUTBOUND_URL`, `OPERY_OUTBOUND_TOKEN`) para OxxPharma configurar.

---

## 7. Endpoints admin (uso interno OxxPharma)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/opery/dashboard` | KPIs consolidados (usado pelo Dashboard) |
| GET | `/api/admin/opery/sales` | Listagem paginada das vendas presenciais |
| GET | `/api/admin/opery/dispatch-log` | Logs de envio p/ Opery |
| POST | `/api/admin/opery/dispatch/retry` | Reprocessa envios que falharam |
| POST | `/api/admin/opery/dispatch/{order_id}` | Dispara manualmente 1 pedido para a Opery |
| GET | `/api/admin/opery/config` | Verifica se chaves estão configuradas |

---

## 8. Contatos

- **OxxPharma (integração):** _(preencher)_
- **Opery (integração):** _(preencher)_

_Fim do documento._
