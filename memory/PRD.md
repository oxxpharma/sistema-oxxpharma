# OxxPharma - Sistema de Marketing Multinivel Farmaceutico

## Problem Statement
Reestruturar completamente um sistema MLM existente (Vanguard) para OxxPharma, uma empresa farmaceutica com sistema de franquias em 4 niveis hierarquicos.

## Architecture
- **Backend**: FastAPI (Python) + MongoDB
- **Frontend**: React + Tailwind CSS
- **Auth**: JWT com email/senha (bcrypt)
- **Database**: MongoDB (oxxpharma)

## User Personas
- **Admin**: Super-usuario com controle total do sistema
- **Nacional**: Controle interno da empresa, recebe comissao para eventos/investimentos
- **Estadual**: Profissionais da saude ou farmacias que gerenciam estados
- **Regional**: Gestao por DDD/area de atuacao
- **Cidade**: Unidades com lojas fisicas que vendem produtos
- **Indicador**: Pessoas que compram e indicam novos clientes
- **Unidade Indicadora**: Indicadores upgraded que investem e ganham comissoes

## Core Requirements
1. Hierarquia de niveis com mecanica de franquias
2. Comissoes ate 6a geracao (configuraveis)
3. Catalogo completo de produtos (CRUD)
4. Sistema de carteira/saldos
5. Rede/Network tree visualization
6. Indicadores e Unidades Indicadoras
7. Venda cross-state (split 50/50)
8. Painel admin com configuracoes

## What's Been Implemented (2026-04-09)
- [x] Backend completo com FastAPI (server.py)
- [x] Auth JWT com login/register/logout
- [x] CRUD de usuarios com filtros por nivel/estado/DDD
- [x] CRUD de produtos completo
- [x] Sistema de pedidos
- [x] Comissoes ate 6a geracao
- [x] Comissao Nacional automatica
- [x] Carteira com saques
- [x] Network tree
- [x] Franquias (venda cross-state)
- [x] Dashboard admin e usuario
- [x] Configuracoes de comissoes
- [x] Landing page
- [x] Loja publica
- [x] Referencia de estados e DDDs brasileiros
- [x] Seed admin e nacional automatico

## Backlog (Prioritizado)
### P0 - Critico
- Nenhum item pendente

### P1 - Importante
- [ ] Relatorios detalhados (vendas por periodo, comissoes por nivel)
- [ ] Upload de imagens para produtos
- [ ] Upgrade de Indicador para Unidade Indicadora (fluxo completo)
- [ ] Dashboard especifico para cada nivel

### P2 - Desejavel
- [ ] Notificacoes in-app
- [ ] Exportar relatorios em CSV/PDF
- [ ] Historico de alteracoes (audit log)
- [ ] Gestao de estoque por unidade
- [ ] Mapa de cobertura por estado/regiao

## Next Tasks
1. Implementar relatorios detalhados
2. Upload de imagens para produtos
3. Fluxo completo de upgrade de indicador
4. Dashboards especificos por nivel
