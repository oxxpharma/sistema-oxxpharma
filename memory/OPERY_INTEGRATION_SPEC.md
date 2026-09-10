# Integração OxxPharma ↔ Opery Solutions

**Versão:** 1.1 · **Data:** Fev/2026
**Ambientes:** ambos rodam no mesmo servidor de produção, diferenciados apenas pela URL. O token de autenticação é o mesmo nos dois.

Este documento descreve o contrato de integração entre o sistema **OxxPharma** (e-commerce online) e o **Opery Solutions** (ERP interno da loja física). A integração é bidirecional:

1. **Opery → OxxPharma** (Inbound): envio de vendas presenciais para consolidar dashboard.
2. **OxxPharma → Opery** (Outbound): envio de pedidos online pagos para emissão de NF-e.

---

## 1. Ambientes

Existem dois ambientes, ambos hospedados no mesmo servidor de produção. A URL muda; o **token é o mesmo** nos dois.

| Ambiente | URL base | Uso |
|---|---|---|
| **Sandbox** | `https://oxxpharma.com.br/api/opery/sandbox/webhook/...` | Testes de integração, homologação |
| **Produção** | `https://oxxpharma.com.br/api/opery/webhook/...` | Operação real |

> A chave `X-Opery-Api-Key` (token compartilhado) é única e será enviada pela OxxPharma por canal seguro. **Nunca coloque em URL, e-mail comum ou repositório.**

---

## 2. Autenticação

Ambos os lados usam **API Key** (bearer token) trocada via header HTTP.

| Direção | Header | Variável no destino |
|---|---|---|
| Opery → OxxPharma | `X-Opery-Api-Key: <chave>` | `OPERY_WEBHOOK_SECRET` |
| OxxPharma → Opery | `Authorization: Bearer <chave>` | `OPERY_OUTBOUND_TOKEN` |

**O mesmo token vale tanto para sandbox quanto para produção.** O que muda entre os ambientes é apenas a URL chamada.

---

## 3. INBOUND — Opery envia vendas presenciais

### 3.1 Endpoints (escolha o ambiente)

**Sandbox:**
```
POST https://oxxpharma.com.br/api/opery/sandbox/webhook/sales
```

**Produção:**
```
POST https://oxxpharma.com.br/api/opery/webhook/sales
```

### 3.2 Headers

```
Content-Type: application/json
X-Opery-Api-Key: <chave-fornecida-pela-oxxpharma>
```

### 3.3 Body (JSON)

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
      { "sku": "MED-DIP-500", "name": "Dipirona 500mg 20 comp", "qty": 2, "unit_price": 15.90, "total": 31.80 }
    ],
    "metadata": { "nfce_number": "12345" }
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

### 3.4 Campos aceitos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `opery_order_id` | string | **sim** | ID único do pedido no ERP (idempotência) |
| `order_date` | string | recomendado | ISO-8601 (`2026-02-15T14:32:00-03:00`), `YYYY-MM-DD` ou `DD/MM/YYYY [HH:MM:SS]` |
| `total` | number | recomendado | Valor total do pedido em reais |
| `status` | string | recomendado | `paid`\|`pending`\|`cancelled` (aceita também PT: `pago`, `aguardando`, `cancelado`) |
| `customer_name` | string | opcional | Nome do cliente |
| `customer_cpf` | string | opcional | CPF (só dígitos ou formatado) |
| `customer_email` | string | opcional | Email do cliente |
| `payment_method` | string | opcional | `pix`, `credito`, `debito`, `dinheiro`, etc. |
| `branch` | string | opcional | Filial/loja |
| `operator` | string | opcional | Vendedor/operador do caixa |
| `items` | array | opcional | Itens do pedido |
| `metadata` | object | opcional | Qualquer JSON adicional |

### 3.5 Comportamento

- **Idempotente**: reenviar o mesmo `opery_order_id` **atualiza** o registro existente (não duplica).
- Cancelamento: enviar `status: "cancelled"` no mesmo `opery_order_id`.
- Atualizações de status/valor: envie o payload atualizado com o mesmo ID.

### 3.6 Resposta

```json
{ "received": 2, "created": 1, "updated": 1, "errors": [] }
```

**Códigos HTTP:**
- `200`: processado (mesmo com alguns itens em `errors`).
- `400`: body inválido (ausência de `sale`/`sales`).
- `401`: `X-Opery-Api-Key` inválido ou ausente.

### 3.7 Health check

Use antes de enviar dados para validar chave e conectividade.

**Sandbox:**
```
POST https://oxxpharma.com.br/api/opery/sandbox/webhook/health
X-Opery-Api-Key: <chave>
```

**Produção:**
```
POST https://oxxpharma.com.br/api/opery/webhook/health
X-Opery-Api-Key: <chave>
```

Resposta:
```json
{ "ok": true, "message": "Autenticado. Endpoint de vendas: POST /api/opery/webhook/sales", "environment": "sandbox" }
```

### 3.8 Frequência recomendada

- **Realtime** (recomendado): dispare o webhook logo após cada venda finalizada.
- **Batch** (fallback): rode um sync a cada 5–15 min enviando as vendas do intervalo.
- Envie **status updates** também (ex: quando um pedido pendente for pago).

---

## 4. OUTBOUND — OxxPharma envia pedidos online pagos

Quando um pedido é pago no site, disparamos automaticamente para o endpoint da Opery emitir NF-e.

### 4.1 O que a Opery precisa expor

Duas URLs (uma pra sandbox, uma pra produção), aceitando o mesmo token:
```
POST {OPERY_BASE_URL_SANDBOX}/<caminho-a-definir>
POST {OPERY_BASE_URL_PRODUCTION}/<caminho-a-definir>
```

Que:
1. Recebem o payload de pedido pago.
2. Registram internamente e retornam `2xx` imediatamente (idealmente < 5s).
3. Processam a emissão de NF-e de forma assíncrona.
4. **(Opcional)** Retornam o número/XML/URL da NF-e no corpo da resposta.

### 4.2 Headers que vamos enviar

```
Content-Type: application/json
Authorization: Bearer <token-fornecido-pela-opery>
X-OxxPharma-Source: oxxpharma-app
```

### 4.3 Payload que vamos enviar

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
    "street": "Av. Paulista", "number": "1000", "complement": "Apto 42",
    "neighborhood": "Bela Vista", "city": "São Paulo", "state": "SP",
    "zip": "01310100", "country": "BR"
  },
  "items": [
    { "sku": "MED-DIP-500", "product_id": "prod_abc", "name": "Dipirona 500mg 20 comp",
      "quantity": 2, "unit_price": 15.90, "total": 31.80, "ncm": null, "cfop": null }
  ],
  "totals": { "subtotal": 31.80, "discount": 0, "shipping": 12.50, "total": 44.30 },
  "shipping_method": "PAC",
  "tracking_code": null,
  "notes": null
}
```

### 4.4 Resposta esperada da Opery

**Mínimo aceitável (assíncrono):**
```json
{ "received": true }
```

**Recomendado (já com NF):**
```json
{
  "received": true,
  "nf_number": "2026000042",
  "nf_chave": "35240712345678901234567890123456789012345678",
  "nf_xml": "<?xml version=\"1.0\"?><nfeProc>...</nfeProc>",
  "nf_pdf_url": "https://opery.example.com/nfe/2026000042.pdf",
  "issued_at": "2026-02-15T10:25:00-03:00"
}
```

Se retornar `nf_xml` no padrão SEFAZ, nós geramos o DANFE (PDF) automaticamente. Se retornar apenas `nf_pdf_url`, disponibilizamos o link direto.

### 4.5 Retry e idempotência

- Tentaremos até **5 vezes** em caso de falha (`5xx` ou timeout).
- Cada request tem `order_id` como chave — a Opery deve tratar como **idempotente** (mesmo pedido enviado 2x = uma única NF).
- Falhas ficam armazenadas em `opery_dispatch_log` e podem ser reprocessadas pelo admin.

### 4.6 Callback opcional (NF assíncrona)

Se a NF-e for emitida de forma assíncrona, a Opery pode chamar:

**Sandbox:**
```
POST https://oxxpharma.com.br/api/opery/sandbox/webhook/nf-issued
```

**Produção:**
```
POST https://oxxpharma.com.br/api/opery/webhook/nf-issued
```

Com body:
```json
{
  "order_id": "ord_abcdef123456",
  "nf_number": "2026000042",
  "nf_chave": "35240712345678901234567890123456789012345678",
  "nf_xml": "<?xml ...>",
  "nf_pdf_url": "https://opery.example.com/nfe/2026000042.pdf"
}
```

---

## 5. Timezone & formatos

- Todas as datas devem estar em **ISO-8601** com offset. Sem timezone assumimos **UTC**.
- Timezone padrão de negócio: `America/Sao_Paulo` (BRT/BRST).
- Valores monetários: `number` (não string), 2 casas decimais, `.` como separador. Ex.: `1234.56`.

## 6. Códigos de erro

| HTTP | Significado | Ação |
|---|---|---|
| 200 | OK | — |
| 400 | Payload inválido | Corrigir conforme spec |
| 401 | Chave inválida | Verificar `X-Opery-Api-Key` |
| 429 | Rate limit (a implementar) | Aguardar e reenviar |
| 5xx | Erro no servidor | Retry exponencial |

---

## 7. Checklist para a equipe Opery

- [ ] Receber o token único da OxxPharma (canal seguro).
- [ ] Testar em **sandbox** via `POST /api/opery/sandbox/webhook/health`.
- [ ] Enviar vendas em sandbox e validar que aparecem no dashboard.
- [ ] Após homologação, apontar para o endpoint **produção**.
- [ ] Enviar seed inicial (últimas vendas do mês) em produção.
- [ ] **Fase 2:** Expor endpoint POST (sandbox + produção) que aceite o payload de "pedido pago" (seção 4) e emita NF-e.
- [ ] **Fase 2:** Fornecer 2 URLs (sandbox + produção) e o token único para OxxPharma configurar.

---

## 8. Endpoints admin (uso interno OxxPharma)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/opery/dashboard` | KPIs consolidados |
| GET | `/api/admin/opery/sales` | Listagem paginada das vendas presenciais |
| GET | `/api/admin/opery/inbound-log` | Logs de recebimento (auditoria) |
| GET | `/api/admin/opery/dispatch-log` | Logs de envio p/ Opery |
| POST | `/api/admin/opery/dispatch/retry` | Reprocessa envios que falharam |
| POST | `/api/admin/opery/dispatch/{order_id}` | Dispara manualmente 1 pedido |
| GET/PUT | `/api/admin/opery/config` | Ler/salvar configuração (URLs sandbox/produção, token, ambiente ativo) |

---

## 9. Contatos

- **OxxPharma (integração):** _(preencher)_
- **Opery (integração):** _(preencher)_

_Fim do documento._
