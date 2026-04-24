# OxxPharma - Test Credentials

## Admin (criado automaticamente)
- **Email**: admin@oxxpharma.com
- **Password**: admin123
- Role: admin (access_level 0) → acessa `/backoffice`

## Rede 1 (importada via CSV para testes)
- joao@rede1.com.br / oxx@pharma (topo da rede, EXT001)
- maria@rede1.com.br / oxx@pharma (gen1 de João, EXT002)
- pedro@rede1.com.br / oxx@pharma (gen2 de João, EXT003)

## Observações importantes
- Admin seedado automaticamente no startup
- Cadastro público via /cadastrar cria usuário `network_type='customer'` **SEM** `referral_code` (novo fluxo de cartão de benefícios)
- Usuário precisa aderir ao programa via banner em `/indique-ganhe` preenchendo formulário dinâmico
- Admin pode ativar programa manualmente em `/backoffice/usuarios`
- Cadastro com `?ref=CODE` na URL vincula `sponsor_id` (8% afiliado permanente)
- Promoção a Propagandista: admin manualmente via `/backoffice/candidatos` ou `/backoffice/redes` tab Customer
- Senha default para imports Rede 1: **oxx@pharma** (configurável no payload da API)

## Programa Cartão de Benefícios (FASE 3 - nova)
- Admin painel: `/backoffice/cartao` (abas: Config, Campos form, Lotes, Logs)
- Campos default do form de adesão: cpf, full_name, birth_date, mother_name, phone (configuráveis pelo admin)
- Cron: todos dias 23:59 BRT (GMT-3) envia lote agregado das commissions `status=paid` e `sent_to_card=false`
- Adapter HTTP genérico: URL, método, auth (none/bearer/apikey/basic), template de payload
- Fallback: se API não configurada, admin exporta CSV manualmente e marca "enviado"


## Fluxo de teste MMN
1. Cliente A se cadastra → `customer`
2. Admin promove A → `network_2`, network_sponsor_id = sponsor de A
3. Cliente B se cadastra via link ?ref=CODIGO_A → sponsor_id=A
4. Admin promove B → `network_2`, network_sponsor_id=A (A é network_2)
5. Cliente C se cadastra via link de B → sponsor_id=B, customer
6. C faz compra →
   - B recebe 8% (afiliado) + 5% (gen 1, rede 2)
   - A recebe 3% (gen 2, rede 2)
7. Admin marca pedido pago → commissions viram `paid`
8. A e B veem totais em `/minha-rede`
