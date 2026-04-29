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
- ✅ Iter 21 (atual): Validação final de `requirements.txt` + `package.json` + scripts de deploy

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
