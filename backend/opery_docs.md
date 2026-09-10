# Integração OxxPharma ↔ Opery Solutions

**Ambientes:** ambos rodam no mesmo servidor de produção, diferenciados apenas pela URL. O token de autenticação é o mesmo nos dois.

Este documento descreve o contrato de integração entre o sistema **OxxPharma** (e-commerce online) e o **Opery Solutions** (ERP interno da loja física). A integração é bidirecional:

1. **Opery → OxxPharma** (Inbound): envio de **snapshots diários de faturamento** para consolidar o dashboard.
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

## 3. INBOUND — Opery envia snapshots diários de faturamento

Este é o **fluxo principal** da integração. A Opery deve mandar **1 registro por dia** com os totais consolidados daquele dia. Não é necessário enviar dados de clientes, CPFs ou itens dos pedidos — apenas os totais agregados.

### 3.1 Endpoints (escolha o ambiente)

**Sandbox:**
```
POST https://oxxpharma.com.br/api/opery/sandbox/webhook/revenue
```

**Produção:**
```
POST https://oxxpharma.com.br/api/opery/webhook/revenue
```

### 3.2 Headers

```
Content-Type: application/json
X-Opery-Api-Key: <chave-fornecida-pela-oxxpharma>
```

### 3.3 Body (JSON)

Aceita **1 snapshot** ou **lote** (recomendado para backfill/sync). Use `snapshot` para 1 e `snapshots` para várias.

#### Snapshot único
```json
{
  "snapshot": {
    "date": "2026-02-15",
    "total_revenue": 12580.50,
    "total_orders_value": 15230.00,
    "orders_count": 87,
    "paid_orders_count": 72
  }
}
```

#### Lote (recomendado para carga histórica)
```json
{
  "snapshots": [
    { "date": "2026-02-13", "total_revenue": 760.30, "total_orders_value": 900.00, "orders_count": 8, "paid_orders_count": 6 },
    { "date": "2026-02-14", "total_revenue": 1580.00, "total_orders_value": 1750.00, "orders_count": 14, "paid_orders_count": 12 },
    { "date": "2026-02-15", "total_revenue": 12580.50, "total_orders_value": 15230.00, "orders_count": 87, "paid_orders_count": 72 }
  ]
}
```

### 3.4 Campos aceitos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `date` | string | **sim** | Formato **`YYYY-MM-DD`** (chave de idempotência). Aceita também ISO e `DD/MM/YYYY`. |
| `total_revenue` | number | **sim** | Faturamento do dia — soma dos pedidos **PAGOS** apenas. |
| `total_orders_value` | number | **sim** | Valor total dos pedidos no dia — **pagos + pendentes**. |
| `orders_count` | integer | **sim** | Quantidade total de pedidos do dia (pagos + pendentes). |
| `paid_orders_count` | integer | opcional | Quantidade de pedidos pagos (para cálculo do ticket médio). Se ausente, usamos `orders_count`. |

> **Ticket médio** é calculado internamente pela OxxPharma: `total_revenue / paid_orders_count`. Não precisa enviar.

### 3.5 Comportamento idempotente

- **Chave única: `date`.** Reenviar o mesmo dia **sobrescreve** o registro existente. Não duplica.
- Se um valor foi lançado errado ou precisou ser recalculado: basta reenviar o mesmo `date` com os valores corretos.
- Durante o dia, a Opery pode reenviar o snapshot do dia atual **quantas vezes quiser** — a cada envio, os valores no dashboard da OxxPharma são atualizados. Todo o rastro de atualizações fica registrado para auditoria.
- Não há campo de "delete" — se um dia teve zero movimento, envie zeros explicitamente ou simplesmente não envie (fica ausente).

### 3.6 Carga inicial (backfill)

**Na primeira integração, a Opery deve enviar o histórico completo desde 01/01/2025 até a data atual.**

Divida em lotes de até ~500 snapshots por request (~500 dias ≈ 1,3 anos por lote). Exemplo de estratégia:

```
Lote 1: 2025-01-01 → 2025-12-31 (365 snapshots)
Lote 2: 2026-01-01 → data atual
```

### 3.7 Envios contínuos (após o backfill)

Depois da carga inicial, a Opery deve enviar os valores **sempre que houver atualização**, seguindo estas duas estratégias combinadas:

- **Realtime durante o dia**: sempre que os totais forem atualizados no ERP (novo pedido registrado, pagamento confirmado, etc.), reenvie o snapshot do dia atual com os valores atualizados. A idempotência por `date` garante que não duplica.
- **Fechamento diário**: rode um job à meia-noite (America/Sao_Paulo) reenviando o snapshot **do dia anterior** já consolidado, para fixar os valores finais.

### 3.8 Resposta

```json
{ "received": 3, "created": 2, "updated": 1, "errors": [] }
```

**Códigos HTTP:**
- `200`: processado.
- `400`: body inválido (ausência de `snapshot`/`snapshots` ou `date` faltando).
- `401`: `X-Opery-Api-Key` inválido ou ausente.

### 3.9 Health check

Use antes de enviar dados para validar chave e conectividade.

```
POST https://oxxpharma.com.br/api/opery/sandbox/webhook/health
POST https://oxxpharma.com.br/api/opery/webhook/health
X-Opery-Api-Key: <chave>
```

Resposta:
```json
{ "ok": true, "message": "Autenticado.", "environment": "sandbox" }
```

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

- `date` no snapshot: use `YYYY-MM-DD` referente ao dia contábil no fuso `America/Sao_Paulo`.
- Datas em outros campos: **ISO-8601** com offset. Sem timezone assumimos **UTC**.
- Valores monetários: `number` (não string), 2 casas decimais, `.` como separador. Ex.: `1234.56`.

## 6. Códigos de erro

| HTTP | Significado | Ação |
|---|---|---|
| 200 | OK | — |
| 400 | Payload inválido (ex: `date` faltando) | Corrigir conforme spec |
| 401 | Chave inválida | Verificar `X-Opery-Api-Key` |
| 429 | Rate limit (a implementar) | Aguardar e reenviar |
| 5xx | Erro no servidor | Retry exponencial |

---

## 7. Checklist para a equipe Opery

- [ ] Receber o token único da OxxPharma (canal seguro).
- [ ] Testar em **sandbox** via `POST /api/opery/sandbox/webhook/health`.
- [ ] Enviar **carga inicial (backfill)** cobrindo o período **01/01/2025 até a data atual** em lotes no sandbox — validar no dashboard.
- [ ] Após homologação, apontar para o endpoint **produção** e enviar o backfill lá também.
- [ ] Implementar envio contínuo: reenviar o snapshot do dia atual sempre que os valores forem atualizados no ERP.
- [ ] Configurar job diário à meia-noite (BRT) que reenvia o snapshot do dia anterior já consolidado.
- [ ] **Fase 2:** Expor endpoint POST (sandbox + produção) que aceite o payload de "pedido pago" (seção 4) e emita NF-e.
- [ ] **Fase 2:** Fornecer 2 URLs (sandbox + produção) e o token único para OxxPharma configurar.

---

_Fim do documento._
