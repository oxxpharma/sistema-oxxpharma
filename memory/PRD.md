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

## Backlog

### P0 - Fase 2D (proxima sessao): MercadoPago real
- [ ] Aguardando MERCADO_PAGO_ACCESS_TOKEN do user
- [ ] PIX/cartao/boleto via SDK Mercado Pago
- [ ] Webhook `/api/payments/webhook/mercadopago` processando status
- [ ] Remover botao "Simular pagamento" quando token ativo

### P1 - Notificacoes
- [ ] Email transacional via Resend/SendGrid:
  - Pedido criado, pago, enviado
  - Comissao gerada
  - Candidato a Propagandista (para admin)
  - Saque aprovado/pago
  - Cadastro via link de indicacao (para o afiliado)

### P2 - Melhorias
- [ ] Upload de imagem para S3 (hoje base64)
- [ ] Notificacoes email (pedido criado/pago/enviado; comissao gerada; candidato a propagandista)
- [ ] Modularizar server.py (ja passou de 1000 linhas)
- [ ] Calendar UI no relatorio (trocar input type=date)
- [ ] Favicon + manifest.json
- [ ] React Router v7 future flags
- [ ] API sync automatica com sistema externo (hoje so import manual)

### P3 - Future
- [ ] Exportar tree MMN em PDF
- [ ] Dashboard financeiro do Propagandista (grafico de evolucao)
- [ ] Metas + gamificacao
- [ ] Programa de indicacao com bonus de ativacao
- [ ] Cupons/promoções

## Next Tasks
1. Sistema de saques (Fase 2B)
2. Faturamento interno (Fase 2C)
3. MercadoPago real (aguarda credenciais)
