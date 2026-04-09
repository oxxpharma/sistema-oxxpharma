# OxxPharma - Sistema de Marketing Multinivel Farmaceutico

## Problem Statement
Reestruturar completamente um sistema MLM existente (Vanguard) para OxxPharma, uma empresa farmaceutica com sistema de franquias em 4 niveis hierarquicos.

## Architecture
- **Backend**: FastAPI (Python) + MongoDB
- **Frontend**: React + Tailwind CSS + Recharts
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
9. Dashboards especificos por nivel
10. Relatorios detalhados
11. Fluxo de upgrade de Indicador para Unidade Indicadora

## What's Been Implemented

### Sessao 1 (2026-04-09)
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

### Sessao 2 (2026-04-09)
- [x] Dashboards especificos por nivel:
  - Admin: graficos de usuarios por nivel, top comissoes, receita
  - Estadual: regionais, cidades, indicadores do estado, receita estadual
  - Regional: unidades/cidades do DDD, indicadores, receita regional
  - Cidade: indicadores ativos, vendas mensais, receita da unidade
  - Indicador: progresso de upgrade (barra), indicacoes, investimento necessario
  - Unidade Indicadora: total comissoes, indicacoes ativas, desempenho
- [x] Relatorios detalhados com 3 tabs:
  - Vendas: pedidos diarios, top produtos, status, filtro por periodo
  - Comissoes: por geracao, por nivel, top comissionados, status
  - Rede: usuarios por nivel, por estado, cadastros diarios
- [x] Fluxo completo de upgrade Indicador -> Unidade Indicadora:
  - Pagina de progresso com barra de indicacoes
  - Formulario de investimento
  - Solicitacao enviada ao admin
  - Admin pode aprovar/rejeitar na pagina /upgrade-requests
  - Transacao registrada no historico

## Backlog (Prioritizado)
### P1 - Importante
- [ ] Upload de imagens para produtos
- [ ] Dashboard com dados reais (seed de pedidos/comissoes para demo)
- [ ] Filtros avancados nos relatorios (por estado, por nivel)

### P2 - Desejavel
- [ ] Notificacoes in-app
- [ ] Exportar relatorios em CSV/PDF
- [ ] Historico de alteracoes (audit log)
- [ ] Gestao de estoque por unidade
- [ ] Mapa de cobertura por estado/regiao
- [ ] Sistema de metas e gamificacao

## Next Tasks
1. Upload de imagens para produtos
2. Seed de dados para demo (pedidos, comissoes)
3. Filtros avancados nos relatorios
