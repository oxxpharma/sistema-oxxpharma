# OxxPharma - E-commerce Farmaceutico + Duplo MMN

## Problem Statement
Sistema com 3 pilares:
1. **Loja Virtual pública** em `/` com carrinho/checkout
2. **Programa de Afiliados** (8% configurável sobre o link de indicação — todos os usuários têm)
3. **Marketing Multinível em 2 redes independentes**:
   - **Rede 1 - Corporativa**: usuários vindos de sistema externo (importação via CSV + API futura)
   - **Rede 2 - Propagandistas**: clientes promovidos organicamente pelo admin após atingir volume de indicações

## Architecture
- **Backend**: FastAPI + MongoDB + Motor
- **Frontend**: React 18 + React Router v6 + TailwindCSS + Sonner
- **Auth**: JWT Bearer + cookie
- **External APIs**: ViaCEP (autocomplete CEP), MercadoPago (placeholder)

## Regras de Negócio

### Comissão de Afiliado (8% configurável)
- Paga ao `sponsor_id` direto (quem indicou via link)
- SEMPRE paga, independente da rede do sponsor

### Comissão MMN (até 6 gerações)
- Só ativa se o **sponsor direto** do comprador estiver em `network_1` ou `network_2`
- **Regra 2A**: se sponsor é `customer`, a cadeia MMN **para ali** — nenhuma comissão sobe
- Sobe pelo `network_sponsor_id` mantendo a mesma rede (se muda de rede, para)
- Percentuais por geração configuráveis independentes para Rede 1 e Rede 2 (default: 5,3,2,1,1,0.5 %)

### Promoção a Propagandista
- Admin vê candidatos em `/backoffice/candidatos` (clientes com ≥ X indicações em N dias, configurável)
- Ao promover: `network_type='network_2'` + `network_sponsor_id` = sponsor_id atual (se esse sponsor for network_2, senão null)

### Rede 1 (Corporativa)
- Importada via CSV com colunas: `id, nome, email, id_lider, telefone`
- Upsert por `external_id` OU `email`
- Mapeamento de líderes em 2ª passada
- Senha default: `oxx@pharma`
- API futura: webhook `/api/admin/network1/import` aceita POST JSON pronto

## User Personas
- **Customer**: compra, ganha 8% em suas indicações. Vê /indique-ganhe e /minha-rede (card simples).
- **Network 1**: importado, até 6 gerações + 8%. Painel `/minha-rede` completo.
- **Network 2**: propagandista promovido, idem Network 1. Painel `/minha-rede` completo.
- **Admin**: gerencia TUDO em `/backoffice`.

## Endpoints Backend Principais

### Auth & User
- POST /api/auth/register (sponsor_code opcional, referral_code auto-gerado)
- POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout
- GET/POST/PUT/DELETE /api/users/me/addresses
- PUT /api/users/me (name, phone, cpf, pix_key, pix_key_type)
- GET /api/users/me/referral (8% + stats simples)
- GET /api/users/me/network (tipo de rede + 6 gerações + totals)
- GET /api/users/me/commissions

### Store
- GET /api/categories, /api/products (filtros), /api/products/featured, /api/products/{id}
- CRUD /api/cart/items
- POST /api/checkout (gera commissions: 1x afiliado 8% + MMN 6 gerações)
- POST /api/payments/create/{order_id} (MercadoPago stub)
- POST /api/payments/mock/confirm/{order_id}
- GET /api/orders, GET /api/orders/{id}

### Admin
- GET/PUT /api/admin/settings (8%, generations, threshold, withdrawal)
- Produtos: GET/POST/PUT/DELETE /api/admin/products
- Categorias: /api/admin/categories
- Pedidos: GET /api/admin/orders, PUT /api/admin/orders/{id}/status
- Usuários: GET /api/admin/users, /api/admin/users/{id}
- GET /api/admin/users-by-network?network_type=
- GET /api/admin/users/{id}/tree (6 gerações)
- POST /api/admin/users/{id}/promote-to-propagandista
- POST /api/admin/users/{id}/revoke-network
- GET /api/admin/propaganda-candidates
- POST /api/admin/network1/import
- GET /api/admin/commissions-report?status=&start=&end=
- GET /api/admin/dashboard

## Rotas Frontend

### Loja Pública
- `/` home
- `/produto/:id`, `/buscar`, `/carrinho`
- `/checkout`, `/pedido/:id`, `/meus-pedidos`, `/meus-enderecos`
- `/minha-conta`, `/indique-ganhe`, `/minha-rede`

### Auth
- `/login`, `/cadastrar`

### Backoffice Admin
- `/backoffice` (Dashboard)
- `/backoffice/produtos`, `/categorias`, `/pedidos`, `/usuarios`
- `/backoffice/redes` (tabs + importar CSV)
- `/backoffice/candidatos` (propaganda)
- `/backoffice/relatorio-comissoes` (CSV export)
- `/backoffice/configuracoes` (tudo)

## What's Been Implemented

### Sessao 1 (2026-04-23) - MVP E-commerce
- [x] Backend e-commerce completo com 8% afiliado
- [x] Loja virtual publica + backoffice admin
- [x] 38/38 testes backend + 95% frontend

### Sessao 2 (2026-04-23) - Fase 2A: Base MMN + CEP
- [x] Autocomplete CEP via ViaCEP (hook + AddressForm reutilizavel)
- [x] Collection `settings` (singleton) com taxa afiliado, rede1/rede2 generations (6), threshold propaganda, withdrawal toggle+min+release_days
- [x] Campos novos em users: network_type, network_sponsor_id, external_id, cpf, pix_key, pix_key_type
- [x] Motor de comissao MMN ate 6 geracoes no checkout (respeitando Regra 2A)
- [x] Endpoints admin: settings, users-by-network, tree, promote/revoke, candidates, network1/import, commissions-report
- [x] Pagina /minha-rede (3 versoes: customer / network_1 / network_2)
- [x] Painel admin: Configuracoes, Redes MMN (3 tabs + import CSV), Candidatos, Relatorio comissoes
- [x] 18/18 testes backend + 95% frontend validado

### Sessao 3 (2026-04-23) - Fase 2B: Saques (Withdrawals)
- [x] Collection `withdrawals` + campo `withdrawal_id` em commissions + status novo `paid_out`
- [x] GET /api/users/me/balance (available, quarantine, pending_commissions, reserved_in_withdrawals, total_withdrawn + settings)
- [x] POST /api/withdrawals (valida enabled/min/available, FIFO por paid_at, reserva commissions via withdrawal_id)
- [x] POST /api/users/me/withdrawals/{id}/cancel (so pending, libera commissions)
- [x] Admin CRUD: GET com summary, approve, reject com reason, mark-paid (converte commissions a paid_out)
- [x] GET /api/admin/withdrawals/export?status=X (CSV pronto p/ cartao de beneficios)
- [x] Pagina /meus-saques (cards saldo + modal solicitacao + historico)
- [x] Pagina /backoffice/saques (filtros + summary + modal de detalhes + acoes + CSV)
- [x] Link "Meus saques" no menu do usuario e botao em /minha-rede
- [x] Quarentena respeita withdrawal_release_days
- [x] 17/18 testes backend (1 skip) + 95% frontend validado

### Sessao 4 (2026-04-23) - Fase 2C: Faturamento Interno
- [x] Dados da empresa configuraveis (company_name, cnpj, address, city, state, zip, phone, email, invoice_prefix)
- [x] Contador atomico `invoice_counter` em settings
- [x] Auto-emissao de nota quando pedido vira 'paid' (em mock/confirm e admin update status)
- [x] Numero sequencial com prefixo (ex: OXX-000001)
- [x] Indice unique sparse em orders.invoice_number (previne duplicatas)
- [x] Endpoints: GET /api/orders/{id}/invoice (user/admin ACL), POST /api/admin/orders/{id}/issue-invoice (manual), GET /api/admin/invoices (lista + totais)
- [x] Pagina /pedido/:id/nota - layout A4 imprimivel com window.print() e @media print CSS
- [x] Rota standalone (sem header/footer) para impressao limpa
- [x] Pagina /backoffice/faturamento - lista + busca + CSV export
- [x] Secao "Dados da empresa" em /backoffice/configuracoes
- [x] Banner verde em /pedido/:id e modal admin mostrando nota emitida + link "Ver/Imprimir"
- [x] Admin pode emitir manualmente pedido pago sem nota
- [x] 12/13 testes backend (1 skip) + 90% frontend validado

### Sessao 5 (2026-04-23) - Fase 2E: Emails Resend + Webhook Inbound Rede 1
- [x] Integracao Resend (SDK + fallback silencioso quando key ausente)
- [x] Modulo email_service.py com render_template mustache {{var}}, send_email, send_template, trigger
- [x] 8 templates default seedados (welcome, order_*, commission_earned, admin_new_*)
- [x] Collection email_templates (CRUD admin + reset para padrao)
- [x] Collection email_logs (toda tentativa logada, sucesso ou falha)
- [x] Gatilhos automaticos: register (welcome), checkout (order_created + admin_new_order + commission_earned), paid/shipped/delivered, detect candidate ao atingir threshold
- [x] Gatilhos on/off granular em settings (email_trigger_*)
- [x] Endpoint broadcast com targets (all/customer/network_1/network_2/admin/user_ids/emails)
- [x] POST /api/admin/email-test (envia email de teste avulso)
- [x] Credenciais no painel admin: resend_api_key, email_from, email_admin_recipients, email_enabled
- [x] Webhook INBOUND /api/external/network1/sync autenticado por X-Webhook-Token
- [x] actions: upsert (cria/atualiza + mapeia lider) e delete (reverte network_1 para customer)
- [x] Collection webhook_logs (toda chamada logada com stats)
- [x] Token gerado automaticamente no startup, regeneravel pelo admin
- [x] Pagina /backoffice/emails (4 tabs: Config, Modelos, Broadcast, Logs)
- [x] Pagina /backoffice/webhook (URL/token + docs + exemplo curl + logs)
- [x] 19/19 testes backend (100%) + 100% frontend validado

### Sessao 6 (2026-04-24) - Fase 3: Cartao de Beneficios (pivot do saque PIX)
- [x] Migracao: removido auto-gen de referral_code no cadastro; usuarios existentes (exceto admin) foram resetados
- [x] Indice `users.referral_code` virou unique + partialFilterExpression `{referral_code: {$type: string}}`
- [x] Modulo `card_service.py`: get/update config, build_daily_batch, run_daily_transfer, mark_batch_exported, batch_to_csv, APScheduler (tick a cada minuto, TZ=America/Sao_Paulo)
- [x] Collection `settings` com doc `_id=card_config`: enabled, cron_hour/minute, enrollment_fields (dinamicos), api adapter (url/method/auth/headers/template/timeout), enrollment_api separado
- [x] Collection `card_batches`: batch_id, entries, total_amount, status (queued/sent_api/sent_manual/failed), mode, triggered_by
- [x] Collection `card_api_logs`: log de toda chamada HTTP (URL, method, status, response, contexto)
- [x] Adapter HTTP generico (none/bearer/apikey/basic) + template JSON + headers extras
- [x] Campo novo em users: `referral_program_active`, `referral_enrollment` (dados do form), `referral_enrolled_at`
- [x] Campo novo em commissions: `sent_to_card`, `sent_to_card_at`, `card_batch_id`
- [x] Endpoints:
  - GET /api/public/card-enrollment-fields (frontend do user monta o form)
  - POST /api/users/me/referral-enrollment (valida, gera referral_code, ativa programa, best-effort API)
  - GET /api/users/me/referral (ja retorna has_referral_program, account_balance, sent_to_card_total)
  - GET /api/users/me/card-balance
  - GET/PUT /api/admin/card-config
  - POST /api/admin/users/{id}/activate-referral (admin ativa manualmente)
  - POST /api/admin/users/{id}/deactivate-referral
  - POST /api/admin/reset-all-referrals (destroi todos codigos exceto admin)
  - GET /api/admin/card-batches, GET /api/admin/card-batches/{id}
  - POST /api/admin/card-batches/run (disparo manual)
  - POST /api/admin/card-batches/{id}/mark-exported
  - GET /api/admin/card-batches/{id}/export.csv
  - GET /api/admin/card-logs
- [x] Frontend user: Banner de adesao em /indique-ganhe + modal ReferralEnrollmentForm dinamico (suporta text, number, email, date, tel, select, textarea; mascaras cpf/phone/cep)
- [x] Frontend user: dois saldos novos "Saldo na conta" e "Enviado para o cartao"; coluna "Cartao" no historico de comissoes; link "Meus saques" removido do menu
- [x] Frontend admin: /backoffice/cartao com 4 abas (Config, Form de adesao, Lotes, Logs) + reset-all
- [x] Frontend admin: coluna Programa em /backoffice/usuarios com botoes Ativar/Desativar
- [x] Sidebar admin: item "Cartao Beneficios" substitui "Saques" na navegacao
- [x] 23/23 testes backend + 100% frontend validado

### Sessao 7 (2026-04-29) - Fase 4: Gestao de Usuarios + MercadoPago real + Sistema de Pontos
- [x] Admin gestao completa de usuarios:
  - PUT /api/admin/users/{id} (editar nome, email, phone, cpf, role, status, network_type, sponsor, etc - email validado unico)
  - DELETE /api/admin/users/{id} (HARD delete + remove commissions + cart; pedidos preservados; descendentes da rede recebem network_sponsor_id=null)
  - POST /api/admin/users/{id}/toggle-status (active/inactive)
  - POST /api/admin/users/{id}/send-password-reset (envia email Resend, token 60min)
  - POST /api/admin/users/{id}/send-first-access (envia email com link 7d, marca must_set_password=true)
  - Login bloqueia status in (cancelled, inactive, deleted) com 401
- [x] Auth public flows (sem JWT):
  - POST /api/auth/password-reset/request (sempre {ok:true} - nao vaza emails)
  - GET /api/auth/password-reset/validate?token=XXX (200 com {email,name,type} ou 400 invalido/expirado/usado)
  - POST /api/auth/password-reset/confirm {token,password>=6}
  - POST /api/auth/first-access/request (similar mas type=first_access)
  - Frontend pages: /esqueci-senha, /primeiro-acesso-solicitar, /redefinir-senha?token=, /primeiro-acesso?token= (ResetPasswordPage + ForgotPasswordPage com mode prop)
  - Login agora tem links "Esqueci minha senha" e "Primeiro acesso"
- [x] Importacao Network 1 (CSV/API): novos usuarios criados SEM referral_code, com must_set_password=true e referral_program_active=false (alinhado com Fase 3)
- [x] MercadoPago integracao real (SDK mercadopago 2.3.0):
  - payments_service.py: create_preference, get_payment_details, verify_webhook_signature (HMAC SHA256)
  - Tokens em .env: MP_PUBLIC_KEY_TEST/PROD, MP_ACCESS_TOKEN_TEST/PROD, MP_WEBHOOK_SECRET
  - Toggle test/production no admin (/backoffice/pagamentos) salva em settings.global.mp_environment
  - POST /api/payments/create/{order_id} cria preferencia real, redireciona para sandbox_init_point ou init_point conforme env
  - POST /api/payments/webhook/mercadopago valida assinatura, busca payment, marca pedido como paid, registra commissions e pontos
  - Mock de pagamento (/api/payments/mock/confirm/{id}) bloqueado em producao
  - Coleção payment_webhook_logs registra todos os webhooks recebidos
  - Frontend: CheckoutPage redireciona para payment_url quando MP, OrderDetails mostra botao "Pagar com MercadoPago" se pendente
- [x] Sistema de pontos manual:
  - Campo points_value em ProductCreate (manual pelo admin)
  - register_points_from_order (idempotente) registra em points_log quando pedido vira paid (mock confirm, mp webhook, ou admin atualiza status)
  - Coleção points_log: log_id, user_id+name+email+external_id, order_id, product_id+name, quantity, points_per_unit, points_total, registered_at, applied_externally
  - GET /api/admin/points-report com filtros (start, end, user_id, applied=true|false), paginacao, summary {total_points, count}
  - GET /api/admin/points-report/export.csv (CSV com BOM utf-8-sig, cabecalhos PT-BR)
  - POST /api/admin/points-report/mark-applied {log_ids:[...]}
  - Frontend /backoffice/pontos: tabela com checkbox por linha, filtros, export CSV, botao "Marcar como aplicado"
- [x] UserEditModal: edicao completa + acoes (reset, first-access, toggle, delete) num so modal
- [x] BackofficeLayout: novos itens "Relatorio pontos" e "Pagamentos (MP)"
- [x] 19/20 testes backend (1 falha de naming convention dos testes, nao bug) + 100% frontend validado

### Sessao 8 (2026-04-29 cont.) - Iter 18: XLSX + MP DB + Correios
- [x] Relatorio de pontos: substituido CSV por XLSX (openpyxl) com layout simples (Data/Hora, ID, Nome, Pontos totais), header colorido, freeze_panes A2, auto_filter, formato pt-BR de data e numero
- [x] Endpoint antigo /api/admin/points-report/export.csv removido (substituido por export.xlsx)
- [x] MercadoPago credenciais migradas para banco (settings doc _id=global): mp_test_public_key, mp_test_access_token, mp_prod_public_key, mp_prod_access_token, mp_webhook_secret. Tokens DB tem precedencia, .env eh fallback
- [x] payments_service.get_admin_config retorna tokens mascarados (8 primeiros + 4 ultimos chars)
- [x] PUT /api/admin/payments-config aceita campos parciais (deixar em branco preserva atual)
- [x] AdminPayments.jsx: nova aba "Credenciais" com toggle show/hide secrets
- [x] Correios integration:
  - correios_service.py com get_config/update_config (defaults sensatos)
  - calculate_freight com cache em DB (freight_cache, 60min) + logs (correios_logs)
  - Adapter usa endpoint legacy CalcPrecoPrazo (sem contrato funciona com balcão; com contrato passa nCdEmpresa+sDsSenha)
  - "Retirada Local" gerenciada como opção paralela (label, endereço, preço configuráveis)
  - Defaults para produtos sem dimensão (16x11x6 cm, 0.3kg min)
- [x] Endpoints Correios:
  - GET/PUT /api/admin/correios-config
  - GET /api/admin/correios-logs
  - POST /api/admin/correios-test (cep+peso)
  - POST /api/shipping/calculate (publico, items via product_id ou cart do user logado)
- [x] ProductCreate ganhou length_cm, width_cm, height_cm (peso ja existia)
- [x] Frontend: /backoffice/frete (AdminShipping) com 3 abas (Config, Test, Logs); AdminProducts com inputs peso+dimensoes
- [x] Sidebar admin: novo item "Frete (Correios)"
- [x] 12/12 testes backend + 100% frontend (testing_agent_v3_fork iteration_18)

## Backlog

### P1 - Integracao real API Cartao de Beneficios (proxima sessao)
- [ ] Aguardando documentacao da empresa (chega na proxima semana)
- [ ] Testar adapter com endpoint real e ajustar template
- [ ] Campos especificos que o cartao exige (alem do CPF)

### P0 - Fase 2D: MercadoPago real
- [ ] Aguardando MERCADO_PAGO_ACCESS_TOKEN do user
- [ ] PIX/cartao/boleto via SDK
- [ ] Webhook /api/payments/webhook/mercadopago
- [ ] Remover "Simular pagamento" quando token ativo

### P2 - Melhorias
- [ ] Upload de imagem para S3 (hoje base64)
- [ ] Modularizar server.py (ja passou de 2000 linhas)
- [ ] Favicon + manifest.json
- [ ] React Router v7 future flags

### P3 - Future
- [ ] Exportar tree MMN em PDF
- [ ] Dashboard financeiro do Propagandista
- [ ] Metas + gamificacao
- [ ] Cupons/promocoes
- [ ] Extrato detalhado do cartao por usuario (listar batches em que ele participou)

## Next Tasks
1. Integracao real API do cartao (quando docs chegarem)
2. MercadoPago real (aguarda credenciais)
3. Modularizar server.py
