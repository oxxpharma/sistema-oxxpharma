# OxxPharma — CHANGELOG

Histórico datado de iterações (mais recentes primeiro). Detalhes técnicos completos em `/app/test_reports/iteration_*.json`.

---

## Iter 57 (Fev/2026) — IGVD Lookup: ID legado numérico (`external_id`)
- `lookup_user_by_email` agora projeta e retorna o campo `external_id` do usuário (e do líder) como `user.user_id` / `leader.user_id`.
- Fallback seguro: se o usuário não tiver `external_id`, mantém o `user_id` interno (`user_XXX`) — garante retrocompatibilidade.
- Sandbox atualizado com exemplos numéricos (`"5180"` / `"4309"`) espelhando o formato de produção.
- Documentação `IGVD_USER_LOOKUP_API.md` atualizada (v1.1) com nova semântica do campo, tabelas e exemplos.
- Validado por curl: usuário real com `external_id`, usuário sem `external_id` (fallback), e-mail inexistente e falha de autenticação.

## Iter 56 (Ago/2026) — Integração OxxPharma → IGVD: User Lookup
- **Endpoints** `POST /api/integrations/igvd/user-lookup` (produção) + `/sandbox` (homologação).
  - Autenticação: header `x-Api-Key` = `settings.igvd_voucher_secret` (mesma chave dos vouchers).
  - Response: `{found, user{user_id,name,email,network_type}, leader{...}, sponsor_source}`.
  - `leader` prioriza `network_sponsor_id` (MMN); fallback para `sponsor_id`.
- **Helper reutilizável** `igvd_service.lookup_user_by_email(db, email)`.
- **Auditoria** em `db.igvd_lookup_logs` (endpoint, email, IP, user-agent, request_id, at).
- **Endpoint admin** `GET /api/admin/igvd/lookup-logs` — histórico paginado.
- **Documentação pública** `/app/docs/IGVD_USER_LOOKUP_API.md` com contratos, exemplos cURL/Node/PHP/Python, tabelas de erro e boas práticas.

## Iter 55 (Ago/2026) — Anexo de Nota Fiscal por pedido
- `POST/GET/DELETE /api/admin/orders/{order_id}/nf` — upload/download/delete de NF (PDF/XML/JPG/PNG/WEBP até 8 MB).
- Storage separado em `db.orders_nf` (mantém o pedido leve). Metadata (`nf_meta`) inline no order.
- Histórico de substituições em `order.nf_history` (audit trail com replaced_at/deleted_at + user).
- UI na lista de pedidos: 📎 anexar / ⬇️ baixar / ✏️ substituir — botões condicionais.
- Modal drag&drop com validação client-side de tamanho e tipo.
- Tests: iter_27.json → 12/12 backend PASS + Playwright 100%.

## Iter 54 (Ago/2026) — Campanha do Multiplicador (P0)
- Módulo novo `/app/backend/multiplier_campaign.py` (~280 linhas) — TZ America/Sao_Paulo.
- Coleção `multiplier_status` (unique index `user_id + month`) armazena status mensal.
- Cron dia 1 às 00:05 BR (piggyback no scheduler do card_service) avalia mês corrente com base no mês anterior.
- Regras: mês bootstrap ativa todos; meta ausente desativa; escopo = usuários MMN (network_1 OU network_2); aplica só a gerações 3-6.
- Hook em `compute_order_commissions` — se `is_active_for(sponsor)` retorna ativo, multiplica `rate_pct` e grava `multiplier_applied` + `multiplier_month` na comissão. Não recalcula histórico.
- **6 endpoints**: `GET/PUT /api/admin/multiplier-campaign`, `POST .../reprocess`, `GET .../stats`, `GET .../users`, `GET /api/users/me/multiplier`.
- Página admin `/backoffice/campanha`: toggle, multiplier input, grid 12 metas/ano com switcher, 4 KPIs, BarChart + LineChart, Top 5 streak, tabela filtrável.
- Card `/minha-rede`: gradient slate escuro quando ativo, gradient amber suave quando inativo, barra de progresso, modal "Como funciona a campanha", badge "⚡ Nx" na taxa multiplicada das gerações 3-6 (com a original riscada).
- Tests: iter_26.json → 22/22 backend PASS.

## Iter 53 (Ago/2026) — PDV (Frente de Caixa)
- `POST /api/admin/orders/manual` — cria pedido sem gateway.
- Aceita cliente cadastrado (autofill) ou guest (snapshot completo: nome, email, cpf, phone, endereço).
- Items com resolução de preço via `tier_key` (`base` | `tier:N` | `custom`) + `unit_price` override.
- Frete manual/grátis/pickup; pagamento Cartão/Cartão Parcelado (2-12x)/Pix.
- Flags `skip_maxx_sync`, `skip_points`, `mark_paid`.
- `register_points_from_order` respeita flags (early return se skip_points).
- Página `/backoffice/pdv` — layout 2 colunas (Cliente + Produtos + Frete + Pagamento | Resumo sticky).
- Tests: iter_25.json → 21/21 backend PASS + Playwright 100%.

## Iter 52 (Ago/2026) — IGVD 3 bugs críticos
- **Preço unitário editável no kit IGVD**: campo `unit_price` opcional por item; substitui o preço base; impacta subtotal, total, cashback e fatura.
- **CPF não indo pro cadastro/pedido**: parser normalizado `_normalize_lic` aceita aliases (`cpf`, `cpfCnpj`, `cpf_cnpj`, `document`, `documento`, `document_number`). Fallback direto para `voucher.licenciado_cpf_digits` no order.
- **CEP não indo pro pedido**: parser aceita `cep`/`zip_code`/`postal_code`/`postalCode`; endereço aceita `logradouro`/`rua`/`endereco`, `numero`, `bairro`, `cidade`/`municipio`, `uf`/`estado`. Enrichment persiste no perfil do usuário quando faltavam campos.
- Container payload aceita `licenciado`/`customer`/`user` na raiz.
- `total` do pedido IGVD agora usa `subtotal` (kit config = source of truth); `amount_brl` da IGVD fica em `igvd_amount_brl` para referência.

## Iter 51 (Jul/2026) — Saldo Total Disponível
- Novo card verde destaque no `/minha-rede` mostrando `account_balance` (soma comissões `status=paid` + `sent_to_card != true`).
- **Independente do filtro de período** — resolve confusão dos usuários que achavam que o saldo sumia ao trocar o mês.
- Backend: `/api/users/me/network` retorna `account_balance` fixo.

## Iter 50 (Jul/2026) — Top 3 do período + ordenação
- Novo bloco "Top 3 do período" em `/minha-rede` com pódio (medalha ouro/prata/bronze).
- Cada geração ordena membros DESC por `purchases_total` — quem mais comprou aparece primeiro.
- Cada membro mostra "Compras no período" na linha; o 1º com purchases > 0 ganha ícone Award amarelo e badges 1º/2º/3º.
- Backend: `top_buyers[]` no payload de `/api/users/me/network`.

## Iter 49 (Jul/2026) — Reprocess IGVD + Filtro Mês Atual + Métricas de Rede
- `POST /api/admin/igvd/reprocess-order` — aceita ID completo ou 8 chars uppercase (`#10E6A477`); idempotente; dispara `_post_igvd_order_created`.
- Componente `PeriodFilter.jsx` (Mês/Ano + Intervalo custom) aplicado em AdminDashboard, MyNetwork, MyReferral — default mês atual.
- Backend `/api/users/me/network|referral|commissions` aceitam `start`/`end`.
- MyNetwork: novas colunas por geração `received_total` (paid+pending) e `purchases_total` (orders paid dos downlines).
- UI AdminIgvd: card "Reprocessar hooks de pedido IGVD".
- Tests: iter_23.json + iter_24.json → 17/17 PASS.

## Iter 48 (Jul/2026) — IGVD Integration Suite
- `/api/integrations/igvd/voucher` (produção) + `/sandbox` — recebe vouchers de adesão.
- Idempotência via `voucher_code` + `Idempotency-Key` header.
- Se user existe (por CPF/email) → cria pedido pago automático do kit; senão salva pendente.
- Hook `_post_igvd_order_created` dispara comissões + pontos Maxx + fatura por email.
- Enrich do user com CPF/telefone/endereço vindos do payload IGVD (só preenche campos vazios).
- Admin page `/backoffice/igvd` — config, kit builder, listagem de vouchers, retry-pending.
- Role `estoque` criada (acesso restrito a Pedidos + Cupons).

## Iter 47 (Jun/2026) — Retirada no Local
- Toggle no checkout `is_pickup=true`, frete zerado.
- `pickup_snapshot` no order doc (endereço da loja + horário).
- Badge visual "RETIRADA" no admin.
- Snapshot na fatura por email.

## Iter 46 (Jun/2026) — RBAC Expandido
- Role `atendimento` (Support) — dashboard oculto.
- Role `estoque` (Inventário) — restrito a Orders/Coupons.
- `SYSTEM_PROFILES` centralizado em `/app/backend/role_profiles.py`.
- Frontend `AuthContext.can` reflete permissões.

## Iter 45 (Jun/2026) — Invoice Emails
- Coluna SKU na fatura detalhada.
- Fallback de dados para pedidos legados sem `customer_cpf`/`pickup_snapshot`.
- Botão admin "Reenviar Fatura" (`/api/admin/orders/{id}/resend-invoice`).

## Iter 44 (Mai/2026) — CPF/CEP no checkout + Backfill
- Validação obrigatória de CPF e CEP no checkout.
- Snapshots persistidos no order doc (`customer_cpf`, `customer_cpf_digits`).
- Modal admin "Corrigir dados faltantes".
- Script `tests/backfill_missing_customer_data.py` — varre pedidos legados e preenche via user profile / enrollment form.

## Iter 43 (Mai/2026) — Multi-tenant Pharmakon
- Tenant middleware `tenant_service.get_tenant(request)` resolve por `Host` + `X-Tenant`.
- Appearance separada por tenant (logo, cores, blocks CMS).
- Coleções isoladas: orders, commissions, coupons, themes (via campo `tenant`).
- Shared: users, products, categories.
- Page Builder: Hero Carousel, Upload de imagem inline, blocks full-width.

## Iter 42* (Abr–Mai/2026) — Estabilização MMN
Suíte extensa de fixes (42a–42o) totalizando **60/60 testes PASS**. Principais:
- 42l: Fix afiliação perdida (sponsor_id sticky no checkout + snapshot no order + backfill).
- 42m: "Compras por Indicação" no relatório Cashback por Geração.
- 42n: Indicações Diretas + Top 10 contam APENAS pedidos via link `?ref=`.
- 42o: TipTap rich editor para templates de email + Top 10 produtos no Dashboard + Auto-aprovação do Programa de Benefícios.

## Iter 41 (Abr/2026) — Filtro de período no Dashboard admin
- `/api/admin/dashboard` aceita `start`/`end`.
- Presets 7d/30d/90d na UI.

## Iter 40 (Abr/2026) — Programa de Indicação com adesão
- Usuário só recebe `referral_code` após preencher enrollment form.
- Comissões geradas antes da adesão ficam em `pending_enrollment` → promovidas para `pending` quando ativa.

## Iter 38–39 (Mar/2026) — Maxx per-order + Roles + Auth priority
- Realtime sync com Maxx por pedido individual.
- Auth priority: user_id → external_id → CPF → email.

## Iter 35–37 (Mar/2026) — Cashback por origem
- `by_source` no `/api/users/me/network` separa afiliado / Equipe 1 / Equipe 2.

## Iter 25 (Fev/2026) — Melhor Envio + Frete grátis por audiências
- Módulo `melhorenvio_service.py` — OAuth2 completo, auto-refresh.
- Provider switcher (`shipping_provider: correios | melhorenvio`) com fallback automático.
- Regras de frete grátis por audiência (network_1/network_2/logged/all) com min_subtotal.

## Iter 24 (Fev/2026) — CPF na sync Maxx + Pontos públicos
- Match no import: external_id → CPF → email.
- `/meus-pontos` para o customer com histórico e totais.
- Novo índice `users.cpf_digits` (sparse).

## Iter 23 (Fev/2026) — Painel admin detalhado por usuário
- `/backoffice/usuarios/:user_id` com 6 abas (Visão Geral, Comissões, Pedidos, Rede MMN, Cartão, Pontos).
- Endpoint agregador `GET /api/admin/users/{user_id}/details`.

## Iter 22 (Fev/2026) — Fix leader_external_id sync
- Persistência de `leader_external_id` mesmo se líder não existir ainda.
- Resolução em cascata ao criar usuário com o external_id esperado.

## Iter 20 (Jan/2026) — Maxx MMN API + CMS GrapesJS
- Inbound sync + Outbound score push.
- Documentação `/docs/MAXX_MMN_API.md`.
- Editor visual GrapesJS (AdminPages, AdminAppearance, CmsPageView).

## Iter 19 (Jan/2026) — Pacote de deploy Ubuntu
- Scripts `install.sh`, `deploy.sh`, `update.sh`.
- Templates Nginx + Supervisor + SSL Certbot.
- `DEPLOY.md`.

## Iter 16–18 (Dez/2025 – Jan/2026) — Pagamentos, Frete, Admin Users
- MercadoPago real (sandbox/produção via DB, HMAC webhook).
- Correios CWS Bearer Token (contrato, PAC/SEDEX).
- Gestão admin de usuários + exportação XLSX.

## Iter 1–15 (2025) — MVP
- Auth, catálogo, carrinho, checkout, MMN base, gift cards, dashboards, cartão de benefícios via cron.
