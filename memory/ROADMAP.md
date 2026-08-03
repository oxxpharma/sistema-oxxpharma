# OxxPharma — ROADMAP

Backlog priorizado. Última revisão: Ago/2026 (após Iter 56).

---

## 🔴 P0 — Bloqueadores de produção

Nenhum item aberto. Todos os fluxos críticos (checkout, MMN, integrações) estão funcionais e testados.

---

## 🟠 P1 — Alta prioridade (próximas iterações)

### Ativação Maxx MMN em produção
- Config do Maxx está desativada em produção — pontos gerados não sincronizam.
- **Ação**: revisar credenciais no admin `/backoffice/maxx`, testar sync manual e habilitar realtime.
- **Contexto**: diagnóstico feito em iteração anterior (arquivo `tests/diagnose_cashbacks.py`).

### Ascender árvore MMN até líder network_1
- Quando um customer indica outro customer, os pontos Maxx precisam subir a cadeia até o primeiro líder `network_1` da hierarquia.
- Hoje: se A (customer) → B (customer) → C (network_1), o pedido do A não credita C.
- **Onde tocar**: `register_points_from_order` em `server.py` + BFS de ancestrais.

### DNS + Nginx + Resend para domínio Pharmakon
- Domínio secundário do multi-tenant.
- **Ação**: apontar DNS, criar server block Nginx, adicionar Pharmakon nos senders verificados do Resend.
- Assistência ao cliente para configuração.

### Notificações da Campanha do Multiplicador
- E-mail + banner in-app quando o usuário:
  - (a) ativa o multiplicador no mês novo
  - (b) atinge 50% / 75% / 90% da meta corrente
  - (c) bate a meta pela 1ª vez
- **Onde tocar**: reusa `user_snapshot` + Resend já integrados. Cron dispara no dia 15 e 25 do mês, e realtime quando cruza thresholds.

### Envio automático da NF por e-mail ao cliente
- Após admin anexar a NF (Iter 55), disparar e-mail para `customer_email` com o arquivo em anexo.
- Reutiliza padrão `_send_admin_invoice_if_configured`.
- Elimina "manda a NF pra mim?" no atendimento.

### Debugger de payload IGVD no admin
- Aba nova em `/backoffice/igvd` mostrando últimos 5 payloads brutos recebidos.
- Diff entre campos normalizados vs. originais.
- Diagnóstico em 30s de novas chaves exóticas.
- Reutiliza `igvd_vouchers.raw_payload` (já persistido).

### Aba "Consultas API" no admin IGVD
- Listagem das últimas chamadas de user-lookup (Iter 56).
- Reutiliza `igvd_lookup_logs` já criada.
- Facilita debug de cadastros faltantes.

---

## 🟡 P2 — Backlog técnico / manutenção

### Refatorar `server.py` (> 9.100 linhas)
- Extrair rotas para `/app/backend/routes/` por domínio (orders, users, admin, integrations, catalog, cms).
- Manter compatibilidade — não muda contrato externo.
- Blocker natural quando o arquivo crescer mais.

### Corrigir testes pytest legados
- Suítes antigas (iter 16-18) falhavam por dados sujos no DB de preview.
- **Ação**: revisar fixtures de teardown + isolar coleções por prefixo de teste.

### Top 3 downlines no Dashboard admin
- Widget "top 3 do mês" no `/backoffice` (não só no `/minha-rede` do user).
- Reutiliza a agregação de `purchases_total` (Iter 50).
- Vira ferramenta de coaching para o admin.

### Botão "Enviar mensagem" no Top 3
- Ao lado de cada top comprador, botão que abre WhatsApp com template pronto.
- `wa.me/?text=Parabéns%20{nome}...`
- Zero backend, alto impacto de relacionamento.

### Atalhos de teclado no PDV
- F2 = focar busca de produto
- F4 = finalizar pedido
- Esc = limpar cliente
- Vendedor de balcão fecha em metade do tempo em horário de pico.

### Histórico de envios ao cartão no `/minha-rede`
- Botão ao lado do "Saldo Total Disponível" abrindo mini-modal com últimas 5 remessas D+2.
- Dado já existe em `card_history` (`/api/users/me/referral`).
- Reduz tickets "quando cai no cartão?".

---

## 🟢 P3 — Longo prazo / nice-to-have

### 2FA
- TOTP via Google Authenticator / Authy.
- Priorizar admin + super_admin.

### PWA + Push Notifications
- Manifest + service worker.
- Notifica pedido pago, cashback recebido, meta próxima etc.
- Web Push com VAPID.

### Auditoria centralizada
- Coleção `audit_log` global com ação/quem/quando/diff.
- Hoje espalhado em `nf_history`, `commissions.log`, logs do supervisor.

### Rate limit por chave IGVD
- Middleware que aplica 429 se x-Api-Key ultrapassar 20 req/s.
- Só para as rotas `/api/integrations/igvd/*`.

### Cash-flow forecast
- Dashboard preditivo baseado em pedidos pagos + comissões pendentes vs. saldo cartão.

---

## Sugestões pendentes do agente (aguardando decisão)

Ideias sugeridas em iterações anteriores que o usuário não confirmou nem rejeitou. Manter aqui para retomada:

1. **Envio da NF por e-mail ao cliente** (Iter 55) — reclassificada em P1 acima.
2. **Debugger de payload IGVD** (Iter 52) — reclassificada em P1 acima.
3. **Notificações da Campanha do Multiplicador** (Iter 54) — reclassificada em P1 acima.
4. **Atalhos de teclado no PDV** (Iter 53) — reclassificada em P2 acima.
5. **Top 3 no Dashboard admin** (Iter 50) — reclassificada em P2 acima.
6. **Aba Consultas API no admin IGVD** (Iter 56) — reclassificada em P1 acima.
