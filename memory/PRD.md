# OxxPharma / Pharmakon — Product Requirements Document

> **Última revisão:** Agosto/2026 (após Iter 56)
> **Arquivos irmãos:** `CHANGELOG.md` (histórico de iterações), `ROADMAP.md` (backlog priorizado), `test_credentials.md` (credenciais de teste).

---

## 1. Visão Geral

E-commerce **multi-tenant** (OxxPharma + Pharmakon) com sistema MMN (multi-nível) integrado, rodando em codebase e banco únicos. Catálogo de produtos e cadastro de usuários são compartilhados; **transações, dashboards, temas visuais e domínios são separados por tenant** via header HTTP `Host`/`X-Tenant`.

### Personas
1. **Cliente final** — compra na loja, pode ativar programa de indicação.
2. **Indicador (afiliado)** — ganha cashback nas compras via `?ref=`.
3. **Rede MMN (Equipe 1 / Equipe 2)** — ganha comissão de gerações 1-6 abaixo.
4. **Admin / Atendimento / Estoque** — RBAC granular (ver §6).

---

## 2. Tech Stack

| Camada     | Tecnologia |
|------------|------------|
| Frontend   | React 18, TailwindCSS, React Router, Framer Motion, Recharts, Sonner, TipTap, GrapesJS |
| Backend    | FastAPI, Motor (Mongo Async), APScheduler, bcrypt+JWT, MercadoPago SDK, Resend, openpyxl, reportlab |
| Banco      | MongoDB 7 (coleção única compartilhada + campo `tenant` por documento) |
| Infra      | Ubuntu 22.04+ / Nginx / Supervisor / Certbot |
| Integrações| MercadoPago (pagamentos) · Melhor Envio + Correios CWS (frete) · Resend (email) · Maxx MMN (sync outbound) · IGVD (vouchers + user-lookup) · Cartão de Benefícios (adapter genérico) |

---

## 3. Requisitos Funcionais Principais

### 3.1 E-commerce
- Checkout MercadoPago (sandbox/produção via DB, HMAC webhook).
- Frete real: Melhor Envio (OAuth2) OU Correios CWS (Bearer + contrato) — provider switcher no admin.
- Retirada no local (checkout toggle, frete zerado, dados de retirada na fatura).
- Cupons + regras de frete grátis por audiência.
- Preços contextuais por produto (`pricing_tiers`) — guest/logged/category/network_type.

### 3.2 MMN & Cashback
- Rede em 6 gerações (`network_1` corporativo + `network_2` propagandista).
- Comissões automáticas ao pagar pedido (`_create_commissions_for_paid_order`).
- Programa de indicação — usuário adere via `/indique-ganhe`, ganha `referral_code`.
- Cashback separado em: pending → paid → sent_to_card (D+2 via cron).
- Import CSV, exportação XLSX, recálculo retroativo.

### 3.3 Campanha do Multiplicador (Iter 54)
- Multiplica taxa de comissão das gerações 3-6 por N× quando o sponsor bate a **meta mensal de vendas na 1ª geração**.
- Metas mês a mês configuráveis; mês de bootstrap ativa todo mundo.
- Cron dia 1 00:05 BR avalia; admin pode reprocessar manualmente.

### 3.4 Multi-tenant
- Isolamento de tenant por: `orders`, `commissions`, `coupons`, `themes` (via campo `tenant`).
- Shared: `users`, `products`, `categories`.
- Middleware `tenant_service.get_tenant(request)` — resolve por `Host` header ou `X-Tenant`.
- Appearance separada (logo, cores, blocks) por tenant.

### 3.5 CMS Visual (Page Builder)
- `/backoffice/paginas` + `/backoffice/aparencia` — editor drag-and-drop estilo Elementor.
- Suporta Hero Carousel, Upload de imagem inline, blocks de largura total.
- Renderizado dinamicamente em `CmsPageView`.

### 3.6 Integrações IGVD
- **Voucher inbound** (`/api/integrations/igvd/voucher` + `/sandbox`): recebe adesão, gera pedido pago automático do "kit adesão", dispara comissões/pontos/fatura.
- **User lookup** (`/api/integrations/igvd/user-lookup` + `/sandbox`) — Iter 56: dado o e-mail, retorna user_id + leader (network_sponsor prioritário). Auditoria em `igvd_lookup_logs`.
- Kit config editável com `unit_price` override por item (Iter 52).
- Botão admin "Reprocessar hooks" para pedidos antigos (Iter 49).

### 3.7 PDV / Frente de Caixa (Iter 53)
- `/backoffice/pdv` — criar pedido manual com cliente cadastrado OU guest.
- Escolha por item de qual `pricing_tier` aplicar (ou preço custom).
- Frete: valor manual / grátis / retirada.
- Pagamento: Cartão / Cartão parcelado (2-12x) / Pix — sem gateway.
- Flags: `skip_maxx_sync`, `skip_points`, `mark_paid`.

### 3.8 Notas Fiscais (Iter 55)
- Upload PDF/XML/JPG/PNG/WEBP ≤ 8MB por pedido.
- Botões condicionais na lista: anexar (📎) / baixar (⬇️) / substituir (✏️).
- Auditoria em `order.nf_history` (quem/quando anexou/substituiu/removeu).

---

## 4. Estado do Projeto

| Componente                    | Status        |
|-------------------------------|---------------|
| E-commerce base               | ✅ Produção   |
| MMN + Cashback                | ✅ Produção   |
| Multi-tenant OxxPharma        | ✅ Produção   |
| Multi-tenant Pharmakon        | 🟡 DNS pendente |
| IGVD inbound (vouchers)       | ✅ Produção   |
| IGVD outbound (user lookup)   | ✅ Iter 56    |
| Campanha do Multiplicador     | ✅ Iter 54    |
| PDV                           | ✅ Iter 53    |
| Anexo de NF                   | ✅ Iter 55    |
| CMS Page Builder              | ✅ Iter 20    |
| Maxx MMN sync                 | 🟡 Ativação em produção pendente |
| Cartão de Benefícios          | 🟡 Mocked (adapter genérico) |
| 2FA / PWA Push                | ❌ Roadmap    |

### Coverage de testes
- Suíte pytest: **iter 16-20, 42*, 49, 53, 54, 55, 56** — todas com relatórios 100% PASS registrados em `/app/test_reports/iteration_*.json`.

---

## 5. Modelo de Dados (esquemas críticos)

### `users`
```
{ user_id, email, cpf, cpf_digits, name, phone, addresses[], role,
  network_type: customer|network_1|network_2,
  sponsor_id, network_sponsor_id, leader_external_id, external_id,
  referral_code, referral_program_active, referral_enrollment{},
  voucher_balance, tenant }
```

### `orders`
```
{ order_id, user_id (null se guest), customer_{name,email,cpf,phone},
  items[], subtotal, shipping_cost, discount, total,
  payment_status, payment_method (card|card_installments|pix|mp),
  payment_installments, payment_notes,
  shipping_address, is_pickup, pickup_snapshot,
  sponsor_id, tenant,
  # PDV (Iter 53)
  source: pdv|store|igvd, manual, created_by_admin, admin_notes,
  skip_maxx_sync, skip_points,
  # IGVD (Iter 48–52)
  igvd_voucher_code, igvd_amount_brl,
  # NF (Iter 55)
  nf_meta{name,mime,size,uploaded_by_name,uploaded_at}, nf_history[]
}
```

### `commissions`
```
{ commission_id, user_id, order_id, customer_id, customer_name,
  type: affiliate|network_gen, network_type, generation,
  amount, rate, order_subtotal,
  status: pending_enrollment|pending|paid|cancelled,
  sent_to_card, sent_to_card_at, card_batch_id,
  # Multiplier (Iter 54)
  multiplier_applied, multiplier_month,
  tenant, created_at }
```

### `multiplier_status` (Iter 54)
```
{ user_id, month (YYYY-MM), active, goal, sales_gen1, hit_goal,
  streak_months, evaluated_at }  # unique (user_id, month)
```

### `settings` (docs `_id: "global"`)
Contém: MercadoPago, Correios CWS, Melhor Envio, Resend, Maxx, tenants, IGVD (`igvd_voucher_enabled`, `igvd_voucher_secret`, `igvd_kit_items`), Campanha multiplicador (`multiplier_campaign_*`), regras de frete grátis, cores/logo por tenant.

### Coleções acessórias
`points_log`, `orders_nf`, `igvd_vouchers`, `igvd_lookup_logs` (Iter 56), `card_batches`, `app_credentials`, `pages`, `categories`, `coupons`, `themes`, `settings`.

---

## 6. RBAC (Roles)

Definido em `/app/backend/role_profiles.py` e checado no frontend via `AuthContext.can`:

| Role         | Escopo |
|--------------|--------|
| super_admin  | Tudo (inclui integrações, tenant settings) |
| admin        | Tudo exceto config sensível de integração |
| atendimento  | Pedidos + usuários (dashboard oculto) |
| estoque      | Apenas Pedidos + Cupons |
| customer     | Loja + Programa de Indicação |

---

## 7. Convenções

- Timezone canônica: **America/Sao_Paulo** (usado em cron, month_key, dashboards).
- IDs curtos exibidos ao usuário: últimos 8 chars do `order_id` em UPPERCASE (ex.: `#10E6A477`).
- Comissões idempotentes via índice único `uq_commission_per_beneficiary`.
- Uploads inline (imagens de produto, NF): data URL base64 armazenado no DB, com projeção de campos pesados nas listagens.

---

## 8. Deployment

- Pacote em `/app/deploy/` com `install.sh`, `deploy.sh`, `update.sh`, templates Nginx + Supervisor.
- Documentação principal: `/app/deploy/DEPLOY.md`.
- Credenciais sensíveis em `db.app_credentials` (nunca `.env`).
- Cron interno via APScheduler dentro do backend (não usa cron do sistema).

---

## 9. Documentos Auxiliares

| Documento | Conteúdo |
|-----------|----------|
| `/app/memory/CHANGELOG.md`                  | Histórico completo de iterações (datado) |
| `/app/memory/ROADMAP.md`                    | Backlog priorizado P0/P1/P2/P3 |
| `/app/memory/test_credentials.md`           | Credenciais de admin/customers de teste |
| `/app/docs/IGVD_USER_LOOKUP_API.md`         | Contrato público da API OxxPharma → IGVD (Iter 56) |
| `/app/docs/MAXX_MMN_API.md`                 | Contrato da integração Maxx MMN |
| `/app/deploy/DEPLOY.md`                     | Instruções de deploy em Ubuntu |
