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
