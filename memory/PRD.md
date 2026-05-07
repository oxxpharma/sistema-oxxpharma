# OxxPharma — Product Requirements Document (PRD)

## Original Problem Statement
Construir e finalizar o sistema **OxxPharma** (E-commerce + MMN/Multinível) e prepará-lo para deploy de produção em servidor Linux Ubuntu (`/var/www/oxxpharma`, domínio `oxxpharma.com.br`). Última fase: documentação de API para integração **Maxx MMN** + editor visual de páginas (CMS estilo Elementor) com **GrapesJS** + verificação final dos arquivos de dependências e scripts de deploy.

## Tech Stack
- **Frontend**: React 18, TailwindCSS, React Router, Framer Motion, GrapesJS (CMS builder), Recharts, Sonner
- **Backend**: FastAPI, Motor (Mongo Async), APScheduler, bcrypt+JWT, MercadoPago SDK, Resend, openpyxl, reportlab
- **DB**: MongoDB 7
- **Infra**: Ubuntu 22.04+/Nginx/Supervisor/Certbot (Let's Encrypt)

## Core Requirements
1. **E-commerce real** com checkout MercadoPago (Sandbox/Produção via DB) e webhook HMAC.
2. **Frete real Correios CWS** (Bearer Token, contrato, serviços PAC/SEDEX).
3. **MMN/Pontuação**: import CSV, exportação XLSX, gestão profunda de usuários (hard delete, edit total, e-mail de 1º acesso), Cartão de Benefícios via cron.
4. **Maxx MMN API** (Inbound sync + Outbound score push) + documentação `/docs/MAXX_MMN_API.md`.
5. **CMS Visual GrapesJS** no admin (`/backoffice/paginas`, `/backoffice/aparencia`).
6. **Credenciais sensíveis no DB** (`app_credentials`) — não no `.env`.
7. **Deploy de Produção**: `install.sh`, `deploy.sh`, `update.sh`, templates Nginx/Supervisor, SSL.

## What's Been Implemented (CHANGELOG)
- ✅ Iter 1-15: Auth, catálogo, carrinho, MMN, gift card, dashboards
- ✅ Iter 16-17: MercadoPago real + Correios CWS Bearer Token
- ✅ Iter 18: Gestão admin de usuários + relatórios XLSX
- ✅ Iter 19: Pacote `/app/deploy/` Linux Ubuntu (install/deploy/update + Nginx/Supervisor) + DEPLOY.md
- ✅ Iter 20: Maxx MMN API + GrapesJS CMS (AdminPages, AdminAppearance, AdminMaxx, CmsPageView)
- ✅ Iter 21: Validação final de `requirements.txt` + `package.json` + scripts de deploy
- ✅ Iter 22 (Fev/2026): Fix do mapeamento `leader_external_id` → `network_sponsor_id` na Sync Externa.
  - Helper `resolve_leader_links()` centralizado em `server.py`
  - Persistência de `leader_external_id` em cada doc do user (mesmo se o líder ainda não existir)
  - Resolução em cascata: ao criar/atualizar A, todos os usuários pendentes que tinham `leader_external_id == A.external_id` são auto-vinculados
  - Auto-resolução no PUT admin: editar `leader_external_id` recalcula `network_sponsor_id`
  - Modal admin (`UserEditModal.jsx`) agora exibe o campo `leader_external_id`
  - Stats expandidos no log: `sponsors_mapped`, `sponsors_pending`, `leader_external_persisted`
  - Testes de regressão: `/app/backend/tests/test_leader_external_id_sync.py` (3 cenários, 100% passing)
- ✅ Iter 23 (Fev/2026): Painel admin detalhado por usuário (`/backoffice/usuarios/:user_id`)
  - Endpoint agregador `GET /api/admin/users/{user_id}/details` retorna user + KPIs + listas
  - Página `AdminUserDetails.jsx` com 6 abas: Visão Geral, Comissões, Pedidos, Rede MMN, Cartão de Benefícios, Pontos
  - KPIs: saldo disponível/quarentena/pendente, total ganho/sacado/gasto, # pedidos, total cartão, pontos, downline/indicados, última compra
  - Listas paginadas (até 200 comissões/pontos, 100 pedidos/downline, batches do cartão)
  - Botão "Detalhes" ao lado de "Editar" na lista de usuários (modal de edição preservado)
  - Frete + correção de `api.delete()` que faltava em `lib/api.js`
  - Caixa do programa MMN: imagem decorativa configurável (URL, largura, rotação, translate X/Y, animação flutuante)
- ✅ Iter 24 (Fev/2026): Match por CPF na sync Maxx + visualização pública de pontos
  - Sync API Maxx (`POST /api/external/network1/sync` e `POST /api/admin/network1/import`) agora aceita campo `cpf` e prioriza match: external_id → CPF normalizado → email
  - Quando CPF bate com user já cadastrado direto pela loja, vincula sem duplicar e atualiza external_id/leader_external_id/name/phone
  - Stats expandidos: `linked_by_cpf` no retorno
  - Cadastro público (`/cadastrar`) agora pede CPF (campo opcional mas recomendado)
  - Novo índice `users.cpf_digits` (somente dígitos, sparse)
  - Endpoint admin `GET /api/admin/maxx-pending-by-user` lista users com pontos pendentes agrupado
  - Endpoint admin `POST /api/admin/maxx-sync-user/{user_id}` envia em massa pendentes de um único usuário (atualiza external_id nos logs antes do envio)
  - Página admin `/backoffice/maxx-pendentes` com tabela e botão "Enviar pontos" por usuário
  - Endpoint público `GET /api/users/me/points` retorna histórico + totais (sent/pending) sem mencionar "Maxx"
  - Página loja `/meus-pontos` (link no menu user) com 3 cards (total/enviado/pendente) + tabela completa
- ✅ Iter 25 (Fev/2026): Integração Melhor Envio + Frete grátis por audiências
  - Novo módulo `melhorenvio_service.py` com OAuth2 completo (build URL + exchange code + auto-refresh do token)
  - Tokens persistidos em `db.app_credentials` (não em .env — permite rotação sem redeploy)
  - Endpoints admin: GET/PUT config, authorize-url, callback OAuth (RedirectResponse), disconnect, refresh manual, test-calculate, logs
  - Página `/backoffice/melhor-envio` com tutorial, credenciais, CEP origem, sandbox toggle, botão conectar, teste rápido de cotação com tabela de resultados
  - Provider switcher: `site_settings.shipping_provider` (correios | melhorenvio) com opção de fallback automático
  - `POST /api/shipping/calculate` agora roteia dinâmicamente pelo provider configurado
  - Frete grátis: novo modo `audiences` permitindo escolher Cliente/Rede 1/Rede 2 + categorias de usuário (mesmo padrão dos pontos)
  - Collection `melhorenvio_logs` para auditoria das chamadas
- ✅ Iter 26 (Fev/2026): Calculadora de frete + pricing por rede/programa + relatório de aprovados
  - Fix crítico: URL base Melhor Envio corrigida de `api.melhorenvio.com.br` para `melhorenvio.com.br`
  - Escopos OAuth reduzidos para `shipping-calculate shipping-tracking` (read-only, trava dupla contra geração de etiquetas)
  - Removido frete fixo hardcoded R$15,90 em CartPage, CheckoutPage e `/api/checkout`
  - Novo componente `ShippingCalculator.jsx` reutilizável (CEP + opções + seleção persistida em localStorage)
  - Carrinho: calculadora inline; Checkout: auto-cotação ao escolher endereço
  - `/api/checkout` agora aceita e valida shipping_price/carrier/service_id, com fallback server-side
  - Pricing tiers: 2 novos tipos: `network` (Cliente/Rede 1/Rede 2) e `referral_active` (ativo no Programa de Benefícios)
  - Relatório `/backoffice/programa-aprovados`: lotes por dia, KPIs, lista expandível, export CSV/XLSX por dia ou geral (21 colunas)
- ✅ Iter 27 (Fev/2026): Fatura detalhada automática para e-mail configurável
  - Novo campo `site_settings.order_invoice_email_to` (vazio = desabilitado)
  - Campo configurável em `/backoffice/emails` (aba Credenciais Resend)
  - Novo template `invoice_admin_paid` com fatura completa: itens (tabela), totais, frete (transportadora + serviço), desconto, cupom, endereço, pagamento, nota fiscal
  - Trigger disparado quando pedido vira `payment_status=paid` em 2 pontos: admin marcar como pago + webhook de pagamento (MercadoPago)
  - Itens pré-renderizados como HTML (render_template não suporta loops)
  - Dispara apenas quando email configurado e pedido realmente pago
- ✅ Iter 28 (Fev/2026): Maxx — auth `webhook_token` + função de envio de teste por usuário
  - Novo tipo de auth `webhook_token` (default: header `X-Webhook-Token`) — alinhado com a doc Ozoxx/Maxx
  - Nome do header configurável em ambos `webhook_token` e `apikey`
  - Helper `send_test_for_user(db, user_id, points_value, product_name)` — envia 1 ponto sintético sem persistir no `points_log`
  - Endpoint admin `POST /api/admin/maxx-test-send` (body `{user_id, points_value?, product_name?}`)
  - Endpoint admin `GET /api/admin/maxx-test-users?q=&limit=` para autocompletar (busca em name/email/cpf/external_id)
  - Aba "Teste de envio" no `/backoffice/maxx`: busca usuário com debounce, alerta visível se sem `external_id`, mostra request/headers/payload/response da Maxx para debug
  - Header `Authorization` mascarado no retorno do teste (segurança ao printar/screenshot)
- ✅ Iter 29 (Fev/2026): Maxx — proteção contra apagar token + detecção de erro no body
  - **Bug fix crítico:** GET config agora retorna token mascarado (`C9E••••••••••D0E` — preserva tamanho). Antes retornava texto cru, causando risco de vazamento em print.
  - **Bug fix crítico:** Save sem redigitar o token **não apaga mais** o valor salvo (antes: se o input ficasse mascarado e usuário clicasse Save, o PUT sobrescrevia o token real pela máscara — causando "Token Inválido" nas próximas chamadas)
  - Proteção tripla em `update_config`: ignora valores vazios, só com `•/*`, ou não fornecidos
  - Frontend: campo do token vem SEMPRE vazio no GET; placeholder mostra "Já salvo (X caracteres). Deixe vazio para manter."
  - **Detecção de erro no body:** teste considera `{"error":"1", "error_msg":"..."}` como falha mesmo com HTTP 200 (era o caso da Ozoxx)
  - Resposta do teste expõe `maxx_auth_value_length` e `_configured` para o UI dar feedback visual
  - Mascaramento melhorado: `Bearer XXXXXX` → `Bearer XXX••••XXX` (preserva prefixo de schema)
- ✅ Iter 30 (Fev/2026): Fusão de contas duplicadas + listagem nominal das 6 gerações
  - **Detecção:** `GET /api/admin/duplicate-users` cruza `cpf_digits`, `email` e `phone_digits` (com migration lazy de `phone_digits` para users antigos), ordena com sugestão `suggested_keep` (quem tem orders/points + maior antiguidade)
  - **Fusão:** `POST /api/admin/merge-users` body `{keep_user_id, drop_user_id}` — sobrescreve no keep apenas campos cadastrais preenchidos do drop (`name, email, phone, cpf, external_id, leader_external_id, network_type, rg, birth_date, mother_name`); preserva pix_key, addresses (deduplica por zip+number+street); migra `orders, commissions (user_id+from_user_id), withdrawals, points_log, payment_webhook_logs, addresses, card_batches.lines`; redireciona `sponsor_id`/`network_sponsor_id` de outros users; faz `$unset` nos campos com unique index do drop antes do `$set` no keep para evitar DuplicateKey; deleta drop ao final
  - **Auditoria:** nova collection `merge_audit_log` com `merge_id, kept/deleted user_id, performed_by, snapshots, fields_overwritten, moved_counts`
  - **Histórico:** `GET /api/admin/merge-audit-log?limit=N`
  - **UI Admin:** `/backoffice/usuarios/duplicados` com banner de regras, tabs Duplicatas/Histórico, seleção radio (Manter) + checkbox (Fundir) por linha, dialog de confirmação irreversível, botão atalho em `/backoffice/usuarios`, item no menu lateral
  - **6 gerações nominais:** `/api/users/me/network` agora retorna `members` array (name/email/external_id/created_at/referral_program_active) por geração; `MyNetwork.jsx` reescrito com accordion expandível por geração mostrando os nomes; `AdminUserDetails.jsx` já tinha `network.downline_by_generation` exibindo até 6 gerações
  - Testes pytest: 14/14 passing (`test_merge_users.py` 4 + `test_merge_users_edgecases.py` 10)
- ✅ Iter 31 (Fev/2026): Comissão MMN flui pela cadeia de afiliados (até 6 gerações)
  - **Nova regra crítica:** quando um pedido vira pago, a lógica de comissão MMN agora sobe pela cadeia `sponsor_id` (afiliados) **com fallback para `network_sponsor_id`** (Maxx), até 6 níveis. A cada nível, se o ancestor for `network_1`/`network_2` E tiver `referral_program_active=True`, recebe comissão da geração N usando a taxa da própria rede (network1_generations / network2_generations). Múltiplos MMN na mesma cadeia recebem cada um sua geração relativa ao comprador.
  - **Cenário típico:** Giovani (N1 ativo) → A (customer+programa) → B → C → D → E → F (customer compra). Resultado: E ganha afiliado gen 0, Giovani ganha MMN gen 6 (taxa N1: 0,5%). Antes Giovani não ganhava nada porque a cadeia parava no primeiro `customer`.
  - **Visualização da rede unificada:** `/api/users/me/network` e `/api/admin/users/{id}/details.network.downline_by_generation` agora fazem BFS unificado por `sponsor_id` OU `network_sponsor_id` (dedup por user_id). Inclui customers e MMN misturados — `MyNetwork.jsx` exibe badge "Rede 1/2" no membro quando aplicável.
  - **Compatibilidade:** preserva o fluxo Maxx (cadeia via `network_sponsor_id` continua funcionando para usuários importados sem `sponsor_id`).
  - Testes pytest: 20/20 passing (`test_mmn_via_affiliate_chain.py` 3 novos + 17 pré-existentes inalterados).
- ✅ Iter 32 (Fev/2026): Dashboard administrativo redesenhado
  - **Novos campos do `/api/admin/dashboard`:** `avg_ticket`, `revenue_by_day` (30 dias), `weekly_comparison` (current/previous + %delta de receita e pedidos), `top_buyers` (top 10 por valor pago acumulado), `top_affiliates` (top 10 por comissões geradas, com referrals_count e referral_code), `commissions_summary` (pending/paid/paid_out/cancelled), `orders_by_status` agora retorna lista com count + total R$
  - **Frontend `AdminDashboard.jsx` reescrito** com 4 KPI cards no topo (faturamento em destaque com gradient laranja + delta vs. semana anterior, pedidos com delta, ticket médio, clientes ativos), gráfico de linha Recharts dos últimos 30 dias com gradient e tooltip, donut chart de status com lista detalhada (count + R$), Top 10 compradores e Top 10 indicadores lado a lado (com pódio ouro/prata/bronze nos 3 primeiros, link para detalhes do user, badges de rede), card de comissões consolidadas (cores semânticas), tabela de pedidos recentes
  - Tudo com `data-testid` para automação e responsivo (lg:grid-cols-3, lg:grid-cols-4)
- ✅ Iter 33 (Fev/2026): Recálculo retroativo de comissões
  - **Função reusável `compute_order_commissions(db, order, customer, settings, ...)`** extraída em `server.py` que reproduz fielmente a regra de comissão do checkout (afiliado gen 0 + MMN 1ª–6ª pela cadeia `sponsor_id → network_sponsor_id`, MMN com `referral_program_active`).
  - **`POST /api/admin/recalc-commissions/preview`** (modo SIMULAR): aceita filtros `{date_from, date_to, customer_email, user_id, order_ids}`, busca apenas pedidos `payment_status=paid` SEM nenhuma comissão registrada, simula o cálculo e retorna sumário (orders_eligible, total_commissions, total_amount, beneficiaries, affected_orders com breakdown por geração).
  - **`POST /api/admin/recalc-commissions/apply`** (modo APLICAR): mesma assinatura — grava comissões com `retroactive=true` e `recalc_batch_id=<batch>`. **Idempotente**: re-checa antes de inserir e pula pedidos já com comissão. Audit log completo em `db.recalc_audit_log`.
  - **`GET /api/admin/recalc-commissions/history`**: lista lotes anteriores para rastreabilidade.
  - **UI `/backoffice/recalcular-comissoes`** (`AdminRecalcCommissions.jsx`): banner de regras, 3 filtros (datas + email cliente), botão "Simular recálculo" → 4 KPI cards de sumário + tabela de beneficiários + lista expandível de pedidos afetados com breakdown por linha, botão "Confirmar e gravar" com modal de confirmação irreversível, toggle "Ver histórico" com tabela de auditoria. Item de menu adicionado em "MMN / Comissões".
  - Testes pytest: 5/5 passing (`test_recalc_commissions.py`: preview não persiste, apply grava com flags, idempotência, history endpoint, exige admin). Total da suíte: **25/25 passing**.
- ✅ Iter 34-37 (Fev/2026): Pacote 6 features (Roles, Impersonation, Equipe, Voucher, Pontos espelho Equipe 1, Comissões por origem) — backend e frontend completos.
- ✅ Iter 38 (Fev/2026): Voucher no checkout + Maxx por pedido + Pagamento full-voucher
  - **Frontend Checkout (`CheckoutPage.jsx`):** novo bloco "Saldo Voucher disponível" (busca via `GET /api/users/me/voucher`); checkbox "Usar saldo voucher"; cálculo dinâmico do total com voucher abatendo (`min(saldo, total)`); ao marcar, mostra linhas "Voucher aplicado" e "Restante a pagar"; quando voucher cobre 100%, esconde métodos PIX/Cartão/Boleto, troca o aviso e marca pedido como pago direto sem MercadoPago.
  - **Backend `/api/payments/create/{order_id}`:** se `order.total <= 0` (totalmente coberto pelo voucher), chama `mark_order_paid(... source="voucher")` retornando `{provider: "voucher", paid: true}` — pula MP, dispara emissão de NF, comissões → paid, registro de pontos e e-mails normalmente.
  - **MercadoPago:** quando há voucher_used > 0 ou cupom, agora envia uma única linha consolidada `Pedido #ord_xxx` com `order.total` real (antes mandaria subtotal+frete sem desconto, cobrando demais).
  - **Maxx — agregação por pedido (`maxx_service.py::_build_payload`):** antes 1 entrada por produto (gerava N logs na Maxx por compra). Agora agrupa por `(user_id, order_id)`: soma pontos, soma quantidade total, lista produtos em `products[]` e gera resumo `product_name = "Vit C x2; Omega 3 x1"`. Cliente + sponsor espelhado de Equipe 1 do mesmo pedido continuam como 2 entradas (chaves distintas).
  - **Bugfix Impersonation (voltava para admin em <1s):** `get_current_user` lia o cookie `access_token` ANTES do header `Authorization`. Como o login grava um cookie httpOnly do admin, a impersonation (que troca só o token do localStorage) era ignorada pelo backend → `/api/auth/me` retornava admin → UI revertia. Corrigido: header Authorization tem prioridade sobre cookie.
  - **Bugfix Fatura admin não enviada:** `_send_admin_invoice_if_configured` lia `order_invoice_email_to` do doc `settings{_id:"site"}` (configs visuais da loja), mas a chave é salva via PUT `/api/admin/settings` em `settings{_id:"global"}`. Sempre retornava vazio e o email não disparava. Corrigido para usar `get_settings(db)`. Validado E2E: invoice_admin_paid para giovani.mella@gmail.com = sent:True.
  - **Bugfix menu admin igual para todos:** o filtro `can?.[it.perm]` do sidebar dependia de uma propriedade `perm` que nenhum item tinha → todo admin via todo o menu. Adicionada `perm` em cada item (`integrations`/`financial`/`commercial`/`editProducts`/`manageRoles`). Resultado validado em 4 logins distintos: super_admin 33 itens, admin 20, financeiro 10, comercial 13 — cada um vê apenas o que sua role permite.
  - **Hardening de roles:** `isSuperAdmin` no frontend e `require_super_admin` no backend passaram a ser strict (apenas `role='super_admin'`). Antes admin legacy com access_level=0 ainda "viava" super e burlava a regra de "admin não vê integrações críticas". Migração do `admin@oxxpharma.com` de `role='admin'` para `role='super_admin'` aplicada via `seed_admin` (roda em todo startup, mantém promoção idempotente).
  - Testes: 19/20 passing (1 skipped). Roles: super/admin/financeiro/comercial criados em `test_credentials.md` para validação manual.
- ✅ Iter 39-41 (Fev/2026): Funil /indique-ganhe, Preço Clube p/ não-membros, Relatório Comissões por Geração, retenção `pending_enrollment`, modo `force` no recálculo, filtro de data + Top10 vendas diretas no Dashboard.
- ✅ Iter 42 (Fev/2026): **Fix crítico: Comissões duplicadas no DB** (cliente reportou pagamento de R$1.422 vs R$1.278 esperado).
  - **Root cause**: `admin_recalc_apply` em modo `force` filtrava apenas `status="paid"` para preservar histórico, mas comissões já SAQUEADAS pelo usuário (`status="paid_out"`) eram ignoradas no filtro `paid_keys` → o recalc deletava as `pending` e recriava idênticas, gerando 2 comissões para o mesmo (order, user, type, generation).
  - **Fix backend**: `paid_keys` agora bloqueia inserção quando existir comissão com `status in ["paid","paid_out"]`. `delete_many` continua restrito a `pending|pending_enrollment` para nunca tocar histórico.
  - **Defesa em profundidade**: criado **índice único** `uq_commission_per_beneficiary` em `(order_id, user_id, type, generation)`; `insert_many` migrado para `ordered=False` com try/except (idempotente mesmo em race conditions).
  - **Cleanup**: script `tests/cleanup_duplicate_commissions.py` removeu 3 grupos duplicados do DB de produção (mantendo `paid_out` por prioridade).
  - **Validação**: todos os amounts agora batem matematicamente com `subtotal × rate`; recalc force executado 2x sem gerar nenhuma duplicata.
  - Testes: `test_iter42_no_duplicate_commissions.py` (3 testes — sem duplicatas no DB, índice único existente, recalc force idempotente sobre paid/paid_out) — **todos PASS**.
- ✅ Iter 42b (Fev/2026): **Reverter status de comissões (paid|paid_out → pending)** — apenas super_admin.
  - Endpoints: `POST /api/admin/commissions/revert/preview` + `/apply` (`require_super_admin()`).
  - Aceita 4 modos de filtro combináveis: `commission_ids[]`, `order_ids[]`, `user_id`, intervalo `start/end`.
  - Reverte massa (>1 pedido) exige `confirm=True` (proteção contra acidente).
  - Atualização: `status="pending"`, remove `paid_at`/`paid_out_at`/`withdrawal_id`; grava `reverted_at`/`reverted_by_email` (audit leve embutido).
  - Frontend (`AdminCommissionsByGeneration.jsx`): botão "↩ Reverter" por linha + "Reverter pedido inteiro" no expand + "Reverter por filtro" no topo. Modal `RevertCommissionsModal` mostra preview, contadores, alerta de saques afetados, e exige digitar `REVERTER` para confirmação em massa.
  - Testes: `test_iter42_revert_commissions.py` (5 testes — RBAC super_admin only, exige filtro, confirm em massa, desvinculação de withdrawal_id, ignora pending) — **todos PASS**.

## Files of Reference
- `/app/backend/requirements.txt` — todas libs (mercadopago 2.2.1, resend 2.22, openpyxl 3.1+, reportlab 4+, apscheduler, motor, bcrypt, etc.)
- `/app/frontend/package.json` — grapesjs 0.22.16 + presets/blocks-basic
- `/app/deploy/{install,deploy,update}.sh` + templates Nginx/Supervisor + env examples
- `/app/DEPLOY.md` — guia completo
- `/app/docs/MAXX_MMN_API.md` — documentação API Maxx

## Backlog / Future
- **P1**: Blocos customizados OxxPharma para o GrapesJS (grid produtos em destaque, depoimentos, banner promo).
- **P2**: Job cron de backup automático Mongo + rotação de logs.
- **P2**: 2FA para admin.
- **P2**: PWA / push notifications para clientes.

## Test Credentials
Ver `/app/memory/test_credentials.md`. Admin: `admin@oxxpharma.com` / `admin123`.

## Project Health
- **Broken**: nenhum
- **Mocked**: API externa Cartão de Benefícios (adapter genérico — depende do fornecedor)
- **Test coverage**: iter 16-20 todas PASS 100%
