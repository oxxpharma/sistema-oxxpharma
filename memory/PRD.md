# OxxPharma - Farmacia Digital + Programa de Afiliados

## Problem Statement
Sistema de e-commerce farmaceutico com loja publica B2C e programa de afiliados embarcado.
- Loja Virtual publica na rota `/` com carrinho, checkout e categorias
- Backoffice Admin isolado em `/backoffice`
- Sistema de afiliado: link `?ref=CODE` gera 8% de comissao sobre vendas
- Pagamento: mock inicial, estrutura preparada para MercadoPago

## Architecture
- **Backend**: FastAPI (Python) + MongoDB + Motor async
- **Frontend**: React 18 + React Router v6 + TailwindCSS + Sonner toasts
- **Auth**: JWT (Bearer token + cookie httponly)
- **Database**: MongoDB (collections: users, products, categories, carts, orders, commissions)

## User Personas
- **Cliente final**: navega na loja, compra, pode virar afiliado compartilhando seu link
- **Afiliado**: qualquer usuario cadastrado (link em `/indique-ganhe`), ganha 8% por venda feita via seu link
- **Admin**: gerencia loja (produtos, categorias, pedidos, usuarios) via `/backoffice`

## Core Requirements
1. Loja publica navegavel sem login (carrinho guest em localStorage)
2. Checkout requer autenticacao
3. Captura automatica de `?ref=CODE` da URL e persistencia em localStorage
4. Cadastro com sponsor_code vincula afiliado permanentemente
5. Comissao 8% gerada no checkout (pending) e virada para paid quando pedido marcado como pago
6. CRUD admin com upload de imagens via base64 (preparado para S3 futuramente)
7. Estrutura de pagamento compativel com MercadoPago (ativado ao setar MERCADO_PAGO_ACCESS_TOKEN)

## What's Been Implemented

### Sessao E-commerce MVP (2026-04-23)
- [x] Backend reescrito para MVP E-commerce (server.py 850 linhas)
- [x] Auth JWT com register/login/logout (email + cookie)
- [x] Referral code automatico no register
- [x] Sponsor code vinculando afiliado
- [x] Categorias + Produtos (publicos + admin CRUD)
- [x] Carrinho completo (guest via localStorage, server via API pos-login)
- [x] Enderecos CRUD
- [x] Checkout com frete fixo R$15,90
- [x] Comissao 8% automatica (prioridade: user.sponsor_id > ref_code no body)
- [x] Endpoints de afiliado: /referrals/validate, /users/me/referral, /users/me/commissions
- [x] Pagamento mock + estrutura MercadoPago (/api/payments/create, /api/payments/mock/confirm, /api/payments/webhook/mercadopago)
- [x] Admin: dashboard, produtos (com upload imagem base64), categorias, pedidos (mudar status), usuarios
- [x] Frontend: StoreLayout publica em `/` com header/footer, BackofficeLayout com sidebar em `/backoffice`
- [x] Paginas loja: StoreHome, ProductDetails, Cart, Checkout, OrderDetails, MyOrders, MyAddresses, MyAccount, MyReferral, SearchPage
- [x] Paginas backoffice: Dashboard, Products, Categories, Orders, Users
- [x] Paginas auth: Login, Register (captura sponsor_code)
- [x] Captura URL `?ref=XXX` com RefContext + banner "Indicado por X"
- [x] Guards de rota (Auth/Admin)
- [x] Toaster (sonner) em portugues
- [x] Design: paleta laranja OxxPharma, fonte Chivo + IBM Plex Sans

### Testes (iteration_11.json)
- Backend: 38/38 testes PASS (100%)
- Frontend: validado via UI (95%)
- Fluxo E2E afiliado confirmado funcionando

## Backlog

### P1 - Importante
- [ ] Integrar Mercado Pago real (aguardando credenciais do user)
- [ ] Upload de imagem via file storage real (S3/GCS) em vez de base64
- [ ] Webhook Mercado Pago processando confirmacao

### P2 - Desejavel
- [ ] CEP autocomplete (ViaCEP)
- [ ] Frete calculado (Correios API ou Melhor Envio)
- [ ] Notificacoes por email (pedido criado/pago/enviado)
- [ ] Pagina institucional /sobre, /politicas
- [ ] Favicon + manifest.json
- [ ] Modular server.py em routes/ (auth.py, products.py, cart.py, checkout.py, admin.py, payments.py)
- [ ] Reativar MMN multi-nivel (Fase 2: estadual/regional/cidade) se desejado

### P3 - Nice to have
- [ ] Avaliacoes de produtos
- [ ] Lista de favoritos
- [ ] Cupons de desconto
- [ ] Programa de afiliados multi-nivel (ate N geracoes)
- [ ] Pagamento parcial em saldo de comissoes
- [ ] Dashboard de afiliado com metricas avancadas

## Next Tasks (priorizado)
1. Aguardar credenciais do MercadoPago para ativar pagamento real
2. Upload real de imagens (quando S3/storage disponivel)
3. Modularizar server.py antes dele ultrapassar 1000 linhas
