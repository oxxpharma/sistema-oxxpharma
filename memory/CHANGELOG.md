# OxxPharma — CHANGELOG

Histórico datado de iterações (mais recentes primeiro). Detalhes técnicos completos em `/app/test_reports/iteration_*.json`.

---

## Iter 66.6 (Fev/2026) — AdminProductForm: mostrar categorias/subcategorias inativas

- `AdminProductForm.jsx` agora usa `GET /api/admin/categories` (que retorna TODAS: ativas + inativas) em vez do endpoint público. Fallback para `/api/categories` mantido.
- Subcategorias já usavam `/api/admin/subcategories` que retorna todas.
- Comportamento: categoria/subcategoria inativa continua invisível no site, mas pode ser vinculada normalmente a produtos no admin.

## Iter 66.5 (Fev/2026) — Fix: Supressão de Rede quebrando em produção

**Root cause identificado:** `_find_users_by_emails` construía um regex gigante `^(email1|email2|...|emailN)$` com `re.escape`. Em produção com milhares de usuários, MongoDB retornava erro no compile/execute do regex (500). Em preview, com poucos emails, funcionava.

**Correção (`network_suppression_service.py`):**
- Substituído regex gigante por `$in` com emails lowercase, em batches de 500 (BSON-safe)
- Fallback case-insensitive individual apenas para emails que não bateram no `$in` (max 200 iterações)
- Emails no `users` collection já são armazenados em lowercase no `register`/`login`, então o `$in` é O(1) por email com índice

**Extras:**
- Fallback para conversão de `.xls` via `xlrd + openpyxl` quando `soffice` não está instalado (comum em produção sem LibreOffice)
- `xlrd<2` adicionado ao `requirements.txt` para garantir suporte a `.xls` legado (BIFF5/BIFF8)
- `/api/admin/network-suppression/upload` agora captura `Exception` genérico e loga stacktrace + retorna 500 com `type(e).__name__` para diagnosticar futuros erros

**Testado:** upload `.xlsx` com 3 emails → 200 OK, matched=2, not_found=1.

## Iter 66.4 (Fev/2026) — 2FA obrigatório + Notificação de Bônus por Email

### 2FA por email (`twofa_routes.py`)
- **Obrigatório** para roles `company_admin` e `propagandista` (dados sensíveis de folha e comissões).
- **Fluxo:**
  1. `POST /api/auth/login` normal → se role sensível, backend gera código 6 dígitos + envia email HTML e retorna `{requires_2fa: true, pending_token, email_masked, role}` em vez do JWT.
  2. `POST /api/auth/2fa/verify` com `{email, code, pending_token}` → valida (compare_digest, 5 tentativas, TTL 10min) → retorna JWT + `trusted_device_token` (JWT `kind: trusted_device`, expira em 7 dias).
  3. Frontend guarda o `trusted_device_token` em `localStorage.oxx_trusted_device` e envia via header `X-Trusted-Device` em TODAS as chamadas (`api.js`).
  4. Próximos logins pela mesma máquina pulam o 2FA por 7 dias (verificado via `twofa_routes.verify_trusted_token`).
- **Reenvio:** `POST /api/auth/2fa/resend` — apaga challenge anterior, gera novo código com cooldown de 30s no front.
- **Logout NÃO limpa** o `oxx_trusted_device` — é do dispositivo, não da sessão.
- **UI:** `LoginPage.jsx` reformulada com dois estados (email/senha → código). Campo dedicado com `inputMode="numeric"`, `autoComplete="one-time-code"`, letter-spacing largo. Botões: Verificar, Reenviar (com contador), Voltar.

### Notificação de Bônus de Garantia por email
- **Coluna `email`** adicionada ao template XLSX e ao parser de upload (aliases: `email`, `e-mail`).
- **Armazenamento:** cada `warranty_bonuses` doc guarda o email da planilha (opcional).
- **Envio automático** de email HTML `_send_bonus_notification()` em 2 cenários:
  1. **Upload da planilha:** para cada user existente que ganhou bônus (email do cadastro + email da planilha se diferentes) e para cada CPF ainda sem cadastro (email da planilha).
  2. **Auto-claim** no `POST /api/auth/register` e `PUT /api/users/me` (quando CPF é setado) — pega o email do usuário + emails da planilha e envia notificação com o total ganho.
- **Template** com valor total, quantidade de aparelhos, primeiro tier de compra mínima, CTA "Ver produtos" e disclaimer legal.

## Iter 66.3 (Fev/2026) — Convênio refinos + Bônus de Garantia Ozoxx

### Convênio · Ajustes
- **Contrato PDF Upload** via Emergent Object Storage (`storage_service.py` + `POST /api/admin/companies/{id}/contract` + `GET /api/company-contracts/{id}.pdf` com auth via header OU `?auth=<token>` para `<a href>`).
- **Faturamento admin** (`/backoffice/convenio/faturamento` + `AdminCompanyBillings.jsx`): lista fechamentos, rodar fechamento manual, gerar cobrança MP, reenviar email, marcar pago manual.
- **PIX/Boleto real MP**: `payments_service.create_billing_preference()` gera preferência com `external_reference=billing:<id>`. Webhook `/api/payments/webhook/mercadopago` detecta prefixo `billing:` → marca `company_billings.status=paid` + propaga para `payroll_charges`.
- **Privacidade**: `/api/me/employee-context` NÃO retorna mais `salary`. Frontend do checkout mostra apenas "limite disponível". Salário fica só no admin da empresa e no cálculo interno do limite.
- **Override manual de limite** (`payroll_limit_override` no Employee): empresa pode setar valor fixo por funcionário via `PUT /api/company/employees/{id}` ou `PUT /api/company/employees/{id}/limit`. Se preenchido, ignora o cálculo por salário.
- **Edição de dados de funcionário**: `PUT /api/company/employees/{id}` já existente + UI atualizada em `CompanyEmployees.jsx` com botão Editar.
- **Limite de unidades com desconto**: `Company.discount_max_units` (int opcional). Na hora do checkout, só as N primeiras unidades ganham desconto; as demais pagam preço cheio (média ponderada por linha).
- **Desconto convênio × Cupom não acumula**: se cupom aplicado, desconto do convênio é ignorado no cart pricing e no checkout backend. Frontend mostra aviso laranja no checkout.

### Bônus de Garantia (Ozoxx) — Nova feature
- **Módulo novo:** `warranty_bonus_routes.py` (APIRouter).
- **Config global** em `settings.warranty_bonus_config` = `{enabled, amount_per_unit, min_order_per_unit}` (defaults R$100 / R$300).
- **Upload de planilha** (`POST /api/admin/warranty-bonus/upload`) com colunas `nome, cpf, serie`. Aceita `dry_run`. Dedupe por (cpf+serie). Se o CPF já tem user cadastrado → claim automático (status=claimed); senão fica `pending`.
- **Auto-claim** no cadastro (`POST /api/auth/register`) e na atualização de CPF do perfil (`PUT /api/users/me`): busca todos os bônus pendentes do mesmo CPF e vincula.
- **Regra de uso:** N aparelhos = N tiers de bônus. Tier N ativa quando `subtotal >= N * min_order`. Só 1 uso por pedido (unidades somam). Ex: 2 aparelhos, subtotal R$350 → 1 tier ativo (R$100). Subtotal R$700 → 2 tiers (R$200).
- **Endpoints usuario:** `GET /api/me/warranty-bonus?subtotal=X` retorna `{available_units, usable_units, amount, min_next_tier, remaining_for_next}`.
- **Endpoints admin:** config get/put, template.xlsx, upload, list, uploads.
- **Consumo no checkout:** `CheckoutData.warranty_bonus_units` → deduz do total + marca bônus como `used` linkados à order.
- **Frontend:** `AdminWarrantyBonus.jsx` (config + upload preview + lista + uploads históricos) e card no `CheckoutPage` com dropdown para escolher quantos bônus usar + linha no resumo.

## Iter 66.2 (Fev/2026) — Convênio: FASE 3 (Checkout Payroll) + FASE 4 (Propagandista + Fechamento)

### FASE 3 — Pagamento "Desconto em Folha" & Regras
- **Novo método `payroll`** no checkout (`CheckoutData.payment_method`) só visível para funcionários de empresas com `payroll_enabled=true`.
- **Aceite digital obrigatório:** `payroll_accepted=true` + `payroll_terms_version` no payload; sem aceite retorna 400. Registro completo em `db.payroll_acceptances` (ip, user_agent, terms_version, timestamp).
- **Validação legal:** pedido não pode exceder `available_limit` (salário × payroll_limit_percent − open_charges) — bloqueio no backend e no frontend.
- **Fluxo:** ordem entra direto como `payment_status=paid`, `paid_via=payroll`, dispara comissões, pontos, Maxx e email. Cria `PayrollCharge` (open) linkada.
- **Desconto do convênio** (`discount_percent`) agora aplica automático no cart pricing (linha 1527 do server.py) — funcionário paga o preço com desconto mesmo em PIX/cartão.
- **Novos endpoints:** `GET /api/me/employee-context` (retorna limite + saldo em tempo real) e `POST /api/checkout/payroll-eligibility` (preview).
- **Frontend:** `CheckoutPage` detecta funcionário, mostra novo card "Desconto em folha" com todos os valores (salário, limite, aberto, disponível, pedido), checkbox de aceite obrigatório, e bloqueio visual quando excede.

### FASE 4 — Propagandista + Comissões + Fechamento Mensal + Faturamento
- **Nova role `propagandista`** aceita em `POST /api/admin/users/{id}/set-role`. Redirect no login vai direto para `/propagandista`.
- **Comissões automáticas** em `mark_order_paid()` (novo hook `create_propagandista_commissions_for_order`):
  - **1ª geração:** compra de funcionário → propagandista da empresa recebe % (default 8%).
  - **2ª geração:** compra de indicação do funcionário → 3% (default).
  - **Split empresa:** `commission_company_percent` sai da % do propagandista (limitado ao próprio rate). Ex: 8% - 2% split = 6% pro propagandista + 2% pra empresa.
  - Coleção `propagandista_commissions` (idempotente por order_id).
- **Fechamento mensal:** `process_monthly_closing(db, period)` agrupa `payroll_charges` open do período por empresa → cria `company_billings` (issued) → marca charges como `billed`.
- **Cron dia 1 às 00:15 BR:** roda fechamento do mês anterior + envia email HTML para o `company_email` de cada empresa fechada (tabela por funcionário).
- **Faturamento consolidado:** `company_billings` guarda total + charges + payment_method (pix default). Admin marca como `paid` via `POST /api/admin/company-billings/{id}/mark-paid` (propaga status para charges).
- **Endpoints admin:** `POST /api/admin/convenio/run-monthly-closing` (manual), `GET /api/admin/company-billings`.
- **Endpoints propagandista:** `GET /api/propagandista/me`, `GET /api/propagandista/commissions?month=YYYY-MM`.
- **Frontend:** `PropagandistaLayout` + `PropagandistaDashboard` (stats + tabela de comissões por mês + gen1/gen2 separados).
- **Testado end-to-end** via curl: compra R$39.90 (com 10% off) → payroll_charge criada → fechamento gerou billing R$115.71 (2 pedidos consolidados) → comissão propagandista R$2.15 (6%) + empresa R$0.72 (2%).

## Iter 66 (Fev/2026) — FASE 1 (produto/templates) + FASE 2 (Convênio: Base)

### FASE 1 — Produto & Templates
- **Foto sticky no ProductDetails** (`.jsx`): a imagem do produto agora fica fixa no scroll (md:sticky top-24) enquanto o conteúdo textual rola — igual Wepink/Sephora.
- **Templates aplicam só títulos** (`AdminProductForm.jsx`): ao aplicar um template salvo, o backend copia apenas o campo `title` de cada item — o `text` fica vazio. Evita "vazar" texto de outro produto.
- **Deletar templates** (`AdminProductForm.jsx`): botão "Gerenciar" abre modal listando todos os templates salvos com botão de excluir. Backend já expunha `DELETE /api/admin/product-field-templates/{id}`.

### FASE 2 — Convênio (Base)
- **Novo módulo `convenio_routes.py`** (APIRouter, ~500 linhas) — evita bloat em `server.py`. Registrado via `app.include_router()` com deps injetadas (`require_admin`, `get_current_user`).
- **Modelos:** `Company` (name, cnpj, email, discount_percent, payroll_enabled, payroll_limit_percent, commission_company_percent, propagandista_id, contract_url, active), `Employee` (name, email, cpf, phone, salary, position, company_id, user_id, active).
- **Nova role `company_admin`** com campo `company_admin_of` no user, incluída na validação de `POST /api/admin/users/{id}/set-role`. Novo endpoint `POST /api/admin/companies/{id}/assign-admin` para vincular RH.
- **Endpoints admin:** CRUD `/api/admin/companies`, dashboard `/api/admin/convenio/dashboard`.
- **Endpoints da empresa (`role=company_admin`):** `/api/company/me`, CRUD `/api/company/employees`, `/api/company/reports/open-charges`, `/api/company/reports/monthly?month=YYYY-MM`, `/api/company/contract`.
- **Importação XLSX:** `POST /api/company/employees/import-xlsx` com preview (dry_run) e commit. Aliases de coluna (nome/name, email/e-mail, cpf, telefone/phone/celular, cargo/position/funcao, salario/salary). Modelo XLSX download em `GET /api/company/employees/template.xlsx`.
- **Frontend admin:** menu "Convênio (Empresas)" em `BackofficeLayout`, páginas `AdminCompanies.jsx` (dashboard + lista) e `AdminCompanyForm.jsx` (edit com abas Dados/Funcionários/Importar XLSX + preview).
- **Frontend RH:** novo layout `CompanyLayout.jsx` + páginas `CompanyDashboard`, `CompanyEmployees` (CRUD + XLSX), `CompanyReports` (cobranças em aberto), `CompanyMonthlyClosing` (por mês), `CompanyContract`.
- **Redirect no LoginPage:** `company_admin` vai direto para `/empresa`, sem passar pelo backoffice.

**Próximas fases** (a implementar):
- FASE 3: Pagamento "Desconto em folha" no checkout + aceite digital + validação de limite consignado.
- FASE 4: Propagandistas + comissões 1ª/2ª geração + fechamento mensal automático (cron) + faturamento consolidado (PIX/boleto) + envio de email.

## Iter 65 (Fev/2026) — Indicação: TTL 24h, anti-self-referral e sticky no frontend
- **RefContext (`/app/frontend/src/contexts/RefContext.js`) reescrito:**
  - Cache do indicador agora tem **TTL de 24h** (`oxx_ref = { code, name, savedAt }`). Após 24h, é limpo automaticamente (checagem a cada minuto enquanto a aba está aberta e na próxima abertura).
  - Migração automática das chaves legadas `oxx_ref_code` / `oxx_ref_name` (que persistiam sem expirar) — são removidas na 1ª abertura.
  - **Auto-indicação bloqueada:** ao entrar com `?ref=<próprio_código>` estando logado, o link é ignorado (banner não aparece).
  - **Sticky no frontend:** se o usuário logado já tem `sponsor_id` diferente, um novo `?ref=` **não sobrescreve** o cache — o indicador original é preservado. Backend já era sticky (linha ~1618 do `server.py`), mas agora o banner também respeita.
  - Quando o usuário loga e o cache aponta pra ele mesmo ou pra outro sponsor diferente do que já está fixado, o cache é limpo automaticamente.
- **Backend (`GET /api/referrals/validate/{code}`):** passou a aceitar auth opcional e retornar `is_self` (`true` se o usuário logado tenta usar o próprio link) e `already_sponsored` (`true` se ele já tem outro `sponsor_id`). Clique não é registrado quando `is_self=true`. Testado via curl (self=true, already_sponsored=true nos cenários certos).
- **Regra de troca de indicador:** só via admin no `/backoffice/usuarios` (via `sponsor_id`/`sponsor_code`). Cliente deve solicitar via suporte.

## Iter 64.2 (Fev/2026) — Admin Categorias: modal responsivo + inativas visíveis
- **Backend:** novo endpoint `GET /api/admin/categories` que retorna TODAS as categorias (ativas + inativas). `GET /api/categories` (público) continua filtrando `active=true`. `GET /api/admin/subcategories` já retornava todas.
- **Frontend (`AdminCategories.jsx`):** passa a consumir `/api/admin/categories` no painel — categorias/subcategorias desativadas continuam listadas com badge "Inativa" (fundo vermelho claro) e opacidade reduzida. Editar/desativar/excluir seguem funcionando normalmente.
- **UX modais:** ambos os modais (Nova/Editar categoria e Nova/Editar subcategoria) agora têm `max-h-[90vh]`, header e footer sticky com scroll interno no formulário — não corta mais em telas menores nem quando o form fica longo (SEO expandido, muitos vínculos etc.).

## Iter 64.1 (Fev/2026) — Reenvio para Maxx sempre visível
- **Correção:** os checkboxes e o botão "Reenviar para a Maxx" só apareciam quando `sent_to_maxx=false`. Isso escondia o botão exatamente no caso em que o admin mais precisa: quando a Maxx respondeu HTTP 200 sem external_id (marcando `sent_to_maxx=true` no nosso DB) mas na verdade não efetivou lá.
- Agora QUALQUER lançamento com `log_id` pode ser marcado e reenviado. A coluna passou a se chamar **"Enviado à Maxx"** (Sim + data / Não) — deixa claro o estado real.
- Backend: removido early-return de "todos já enviados". Se admin marca e clica, o sistema reenvia mesmo assim.

## Iter 64 (Fev/2026) — Reenvio manual seletivo de pontos para a Maxx
- Novo endpoint `POST /api/admin/users/{user_id}/points/resend-maxx` recebe `{log_ids: [...]}` e reenvia SOMENTE os lançamentos selecionados. Antes de enviar, atualiza os logs com o `external_id` atual do user (útil para casos em que o vínculo Maxx foi feito DEPOIS da compra).
- Validação: 400 se `log_ids` vazio; 400 se user sem `external_id`; 404 se user não existe.
- Aba **Pontos** do admin (`AdminUserDetails > PointsTab`) agora tem:
  - Checkbox por lançamento (só habilita para pontos NÃO enviados)
  - "Selecionar todos" no header
  - Botão **"Reenviar N para a Maxx"** com contador dinâmico
  - Aviso se usuário não tem ID Externo (bloqueia envio)
  - Coluna "Aplicado" agora diferencia "Sim" (`sent_to_maxx=true`) de "Pendente"
- Requer super_admin (mesma role do "sync-user" existente).

## Iter 63 (Fev/2026) — Autocomplete de CEP no formulário "Aderir ao Programa"
- `ReferralEnrollmentForm.jsx` agora detecta o campo CEP (por `mask='cep'` ou key regex `cep|zip|postal_?code`) e, quando o usuário digita 8 dígitos, chama **ViaCEP** (`https://viacep.com.br/ws/{cep}/json/`) e preenche automaticamente os campos de endereço (`rua/logradouro`, `bairro`, `cidade/localidade`, `uf/estado`, `complemento`).
- Ícone de loading (spinner) aparece no input do CEP durante a busca.
- Fallback: se ViaCEP retornar erro ou CEP inválido, mostra toast sem travar o form. Usuário pode preencher manualmente.
- Zero mudança no backend — os aliases já eram reconhecidos pelo normalizador de endereço (`street/endereco/logradouro`, etc).

## Iter 62 (Fev/2026) — Página de cadastro dedicada + SEO categorias/subcategorias + combo dura em dias

**Cadastro do produto: modal → página dedicada**
- Nova rota `/backoffice/produtos/novo` e `/backoffice/produtos/:id` renderizando `AdminProductForm.jsx` como página completa (sem risco de fechar modal e perder dados).
- Header fixo com 3 botões: **Cancelar**, **Salvar e adicionar novo** (limpa form e mantém na página, só no fluxo "Novo"), **Salvar** (volta pra lista).
- Endpoint admin `GET /api/admin/products/{id}` para carregar produto em edição (inclui inativos, diferente do público).
- `AdminProducts.jsx` enxugado ~250 linhas — só lista e navegação.

**Combo pricing: campo "days"**
- Cada linha do combo aceita `days` (opcional) — exibido como "(60 dias)" no seletor da PDP ao lado da qty. Ajuda cliente a entender quanto tempo o combo dura.

**SEO — categorias e subcategorias indexáveis:**
- Campos novos em `Category` e `Subcategory`: `slug`, `seo_title`, `seo_description`.
- Slug auto-gerado a partir do nome (`slugify` + `_ensure_unique_slug`) na criação/edição. **Backfill automático no startup** para categorias legadas sem slug.
- Endpoints públicos: `GET /api/categories/by-slug/{slug}`, `GET /api/subcategories/by-slug/{slug}` — retorna categoria/subcategoria + produtos + subcategorias filhas.
- Páginas SPA novas: **`/categoria/:slug`** e **`/subcategoria/:slug`** com breadcrumbs, título, descrição, grid de produtos.
- Componente `SEOHead.jsx` — manipula `<title>`, `<meta description>`, `<link canonical>`, Open Graph, Twitter Card e JSON-LD (`CollectionPage` + `ItemList`).
- PDP (`ProductDetails`) também recebeu `SEOHead` com JSON-LD `Product` (nome, marca, preço, disponibilidade, imagens) — Google Rich Results.
- **`GET /api/sitemap.xml`** — sitemap dinâmico com home, /produtos, todas as categorias/subcategorias (com slug) e produtos ativos.
- **`/robots.txt` estático** (`frontend/public/robots.txt`) libera indexação e aponta `Sitemap: /api/sitemap.xml`. `Disallow` protege /backoffice, /login, /checkout, /minha-conta, /minha-rede.
- Admin de Categorias/Subcategorias: campos SEO (slug, título, descrição) editáveis no formulário.

**Validado:**
- Sitemap.xml retorna todas as URLs esperadas (categorias com slug já backfilled).
- Endpoint `by-slug` funciona com produtos + subcategorias vinculadas.
- Slug auto-gerado: `"Cuidados com a Pele"` → `cuidados-com-a-pele`.

## Iter 61 (Fev/2026) — Overhaul do cadastro de produtos + PDP
**Cadastro do produto:**
- **Descrição rica** via editor TipTap (bold/itálico/sublinhado/listas/citação/link/H1-3/limpar). Componente `RichTextEditor` reutilizável.
- **Tempo de consumo** (`consumption_days`) — dias estimados de duração do produto.
- **Características** (`features[]`) — lista dinâmica de bullet points exibida em tópicos abaixo do nome na PDP.
- **Campos personalizados** (`custom_fields[]`) — adição ilimitada de quadros {título, texto} exibidos abaixo do botão de compra.
- **Templates de campos personalizados** — CRUD em `product_field_templates`. Botão "Salvar template" e dropdown "Aplicar template" no formulário.
- **Combo de quantidade** (`combo_pricing[]`) — array `{qty, price, discount_pct}`, editor com adição/remoção linha a linha, seletor visual na PDP.
- **Multi-categoria** (`categories[]`) + **Multi-subcategoria** (`subcategories[]`) via checkbox lists no form. Compat mantida com `category`/`subcategory` legado.

**Nova entidade Subcategorias:**
- Coleção `subcategories`: `{subcategory_id, name, category_ids[], order, active}` — muitos-para-muitos com categorias.
- Endpoints: `GET /api/subcategories` (público, filtra por category_id), `GET/POST/PUT/DELETE /api/admin/subcategories`.
- UI unificada em `/backoffice/categorias` (seção "Subcategorias" abaixo).

**PDP (`ProductDetails`):**
- Renderiza `description_html` como HTML sanitizado (fallback para texto puro).
- Bullet points de características abaixo do nome.
- Badge de "tempo de consumo".
- Seletor visual de combo (1u / 2u / 3u com % off e preço unitário).
- Botão **"Comprar pelo WhatsApp"** (verde WhatsApp) abaixo do botão de compra, gera link `wa.me` com template preenchido (`{product_name}`, `{product_price}`, `{quantity}`, `{product_url}`).
- Quadros de campos personalizados renderizados no final da coluna direita.

**Settings (Admin → Configurações):**
- Bloco WhatsApp: toggle enabled, número E.164, template editável de mensagem.
- Endpoint público `/api/site-settings` agora expõe `whatsapp: {enabled, number, message_template}`.

**Combo pricing no checkout:**
- Aplicado automaticamente quando `qty` bate exatamente com uma linha configurada.
- **NÃO aplica** se cliente tiver `coupon_code` ou `voucher_amount > 0` (combo é exclusivo com outros descontos).
- Cart display sempre mostra o combo se aplicável (informativo).

**Fixes de higiene junto com o feature:**
- Removido arquivo órfão `role_profiles_endpoints.py` (era dead code, decorators órfãos).
- Renomeadas funções duplicadas `public_get_page`/`admin_get_page` legado para `_cms_` (rota não muda).
- `test_merge_users.py` — corrigida ordem de declaração de `_read_env_url`.
- `sw.js` — adicionado `/* global clients */` para lint.
- `api.js` — detecta FormData e não força `Content-Type` JSON (permite uploads via `api.post`).

## Iter 60 (Fev/2026) — Ajustes: supressão vira afiliado + Comercial acessa Produtos
- **Supressão:** ao suprimir usuário X que tinha `network_sponsor_id=L`, agora o líder L é **promovido a `sponsor_id`** (afiliado permanente) e o `network_sponsor_id` de X é limpo. X vira "cliente direto" do ex-líder — compras futuras geram 8% de afiliado pro L. Se X não tinha líder Equipe, o `sponsor_id` antigo é preservado.
- **Revert:** restaura ambos os campos ao estado pré-supressão via snapshot (`pre_suppression_network_sponsor_id` + `pre_suppression_sponsor_id`), sem regressão.
- **Comercial → Produtos:** perfil `comercial` agora vê e edita "Produtos" no backoffice. Backend já autorizava (`require_admin` aceita comercial); só o `can.editProducts` do AuthContext estava restrito.
- Validado: cenário X (com afiliado antigo) → apply promove L a sponsor_id (mantém snapshot do ORIG_AFF) → filhos sobem pro L → revert restaura tudo.

## Iter 59 (Fev/2026) — Supressão mensal da rede (MMN)
- Novo módulo `/app/backend/network_suppression_service.py` (~380 linhas).
- **Fluxo:** admin sobe `.xls/.xlsx` de cancelados da Ozoxx → sistema faz match por e-mail → gera **preview em rascunho** classificando cada linha (`matched | not_found | already_cancelled | email_ambiguous`) → admin confere e confirma → apply em **duas fases** (marca todos como suprimidos, depois reparent).
- **Cascata resolvida:** `_resolve_upline` sobe a árvore ignorando quem também está no lote — filhos nunca ficam órfãos apontando pra outro suprimido no mesmo mês.
- **Revert:** guarda snapshot em `pre_suppression_*` no user + `children_reassigned` na entry; permitido só no **mesmo mês** da aplicação (janela até fechamento de comissão).
- **Efeitos por usuário suprimido:** `suppressed=true`, `network_type='customer'`, filhos reatribuídos ao upline ativo mais próximo (null se raiz). Login, pedidos e histórico permanecem consultáveis. Comissões em aberto NÃO são mexidas.
- **Endpoints:** `POST /api/admin/network-suppression/upload`, `GET /batches`, `GET /batches/{id}`, `POST /batches/{id}/apply`, `POST /batches/{id}/revert`, `DELETE /batches/{id}` (só rascunhos).
- **Parser:** aceita `.xls` (converte via LibreOffice CLI) e `.xlsx` (openpyxl). Detecta colunas por variações (EMAIL/E-MAIL/etc). Ignora `ID/LOGIN/NOME VENDEDOR`.
- **UI:** `/backoffice/supressao-rede` — dropzone, tabela de lotes com badges, drawer detalhado com abas por status + busca + botão de confirmação explícita.
- **Novas coleções:** `network_suppression_batches`, `network_suppression_entries`.
- **Deps:** requer `soffice` (LibreOffice) instalado no host para converter `.xls` (legado OLE); `.xlsx` funciona sem essa dependência.
- **Validado:** teste programático de cascata (`A→B→C→D` com A e B suprimidos, C sobe pra ROOT via A→A também suprimido) + E2E via HTTP (upload/list/apply/revert/idempotência).

## Iter 58 (Fev/2026) — 🚨 Fix crítico: envio duplicado de pontos para a Maxx
- **Sintoma:** Alguns pedidos disparavam DUAS chamadas quase simultâneas para `/api/Faturas/receberpontos` da Maxx, gerando `movimento_id` e `fatura_id` diferentes na origem — o cliente recebia **pontos em dobro**.
- **Causa raiz:** `register_points_from_order` e `mark_order_paid` usavam checagens não-atômicas (`find_one` → `update_one`). Sob webhooks concorrentes do Mercado Pago (que envia múltiplas notificações em milissegundos por pagamento aprovado), ambas as execuções passavam pelo guard antes de qualquer uma persistir → race condition.
- **Fix:**
  - `mark_order_paid`: substituído por `find_one_and_update` condicional (`payment_status != paid`). Só o webhook vencedor roda comissões/pontos/emails; os demais retornam idempotentes.
  - `register_points_from_order`: guard atômico via `find_one_and_update` setando `orders.points_registered=True` — apenas UMA invocação registra pontos e dispara `maxx_service.trigger_realtime`.
- **Validação:** Teste de concorrência com 5 invocações paralelas → 1 conjunto de pontos criado (antes: 5). Preview DB confirmou 2 pedidos históricos afetados (`ord_6b00158702eb`, `ord_5cfa1dd75aa5`).

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

## 2026-02-10 · Iter 67 · Integração Opery Solutions
- Backend `opery_service.py` + `opery_routes.py` — recebe vendas presenciais do ERP e envia pedidos pagos para emissão de NF-e
- Endpoints INBOUND: `POST /api/opery/webhook/sales` (autenticado por `X-Opery-Api-Key`) + `POST /api/opery/webhook/health`
- Endpoints ADMIN: `/api/admin/opery/dashboard`, `/sales`, `/dispatch-log`, `/dispatch/retry`, `/dispatch/{order_id}`, `/config`
- Idempotência via `opery_order_id` único; retry até 5x em outbound; fila `pending_config` quando `OPERY_OUTBOUND_URL` não estiver setado
- Frontend `AdminDashboard.jsx` refatorado com 3 abas: **Vendas Online** · **Vendas Presenciais** · **Total Consolidado**
- Toggle na aba Total Consolidado: gráfico Separadas (2 linhas Online/Presencial) ou Somada (1 linha)
- Documentação completa para equipe Opery em `/app/memory/OPERY_INTEGRATION_SPEC.md`
- ENV novos: `OPERY_WEBHOOK_SECRET`, `OPERY_OUTBOUND_URL`, `OPERY_OUTBOUND_TOKEN`

## 2026-02-10 · Iter 67.1 · Opery — Config no DB + Página Admin + NF por XML
- Credenciais Opery migradas do `.env` para MongoDB (`opery_settings`) via `PUT /api/admin/opery/config`. Fallback automático para `.env` mantido.
- Nova página admin `/backoffice/opery` com 4 abas: **Configuração** (form + gerador de secret), **Endpoints** (URLs com copiar), **Logs Entrada** (auditoria inbound), **Logs Saída** (dispatch + reenvio individual).
- Todos os webhooks inbound agora gravam em `opery_inbound_log` (headers mascarados, body, response, erros).
- Modal de Pedido no admin ganhou seção **Sincronização Opery**: status visual (sincronizado/aguardando/falhou/nunca), botão Sincronizar, botão Log detalhado (payload + response), download DANFE (PDF) e XML bruto.
- Callback assíncrono `POST /api/opery/webhook/nf-issued` para Opery avisar quando emitir NF-e.
- Geração de DANFE via **`brazilfiscalreport`** consumindo XML NF-e padrão SEFAZ. Se XML fora do padrão, retorna HTTP 422 e frontend exibe aviso "PDF indisponível" + link XML bruto.
- Página pública `/docs/opery` com documentação Markdown estilizada (react-markdown + remark-gfm), com base URL clicável e tabelas formatadas — link acessível de dentro da página admin.
- Novos endpoints: `GET/PUT /api/admin/opery/config`, `GET /api/admin/opery/inbound-log`, `GET /api/admin/opery/dispatch-log/{order_id}`, `GET /api/admin/opery/order/{order_id}/nf-status|nf.pdf|nf.xml`, `GET /api/opery/docs-spec`.
- Deps: `brazilfiscalreport==1.0.2`, `fpdf2==2.8.8`, `react-markdown@8`, `remark-gfm@3`.

## 2026-02-10 · Iter 67.2 · Opery — 2 Ambientes (Sandbox + Produção)
- Config `opery_settings` agora tem 3 campos de URL: `outbound_url_sandbox`, `outbound_url_production`, `outbound_token` (compartilhado). Novo campo `active_env` alterna qual URL o outbound usa (toggle na UI).
- Backend expõe webhooks espelhados: `/api/opery/webhook/*` (produção) e `/api/opery/sandbox/webhook/*` (sandbox), aceitando o mesmo token. Health check sandbox retorna `environment: sandbox` no response.
- UI: toggle 🧪 Sandbox / 🚀 Produção, alerta vermelho quando Produção ativa ("Modo produção — pedidos reais vão emitir NF-e"), badge "ATIVA" na URL escolhida, dois blocos separados na aba Endpoints.
- Documentação pública `/docs/opery` atualizada com tabela de ambientes explicando que **URL muda mas token é o mesmo**, endpoints listados nas duas variantes em cada seção.
