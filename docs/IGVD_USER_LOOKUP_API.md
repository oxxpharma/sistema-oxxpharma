# OxxPharma → IGVD · User Lookup API

**Versão:** 1.0 (Iter 56, Ago/2026)
**Base URL Produção:** `https://oxxpharma.com/api`
**Base URL Homologação (sandbox):** o mesmo domínio, endpoint termina em `/sandbox`
**Autenticação:** Header HTTP `x-Api-Key: <chave-compartilhada>` (mesma chave usada hoje pelo webhook de vouchers de adesão)
**Content-Type:** `application/json`
**Encoding:** UTF-8

---

## 📌 Contexto

A IGVD precisa atualizar cadastros e, para tanto, consulta a OxxPharma pelo **e-mail** do licenciado, recebendo em resposta:

- **user_id** — identificador legado numérico do licenciado dentro da OxxPharma (mesma numeração usada historicamente pela IGVD, ex.: `"5180"`). Fallback para o ID interno (`user_XXX`) se o legado não estiver cadastrado.
- **leader** — patrocinador/líder do licenciado, com **user_id** (legado numérico), **nome**, **e-mail** e tipo de rede

A hierarquia utilizada é a de **negócio (MMN)**: se o licenciado tiver `network_sponsor_id` (patrocinador MMN), é esse o líder retornado. Caso contrário, cai automaticamente para `sponsor_id` (patrocinador de indicação/afiliado). O campo `sponsor_source` na resposta informa qual das duas hierarquias foi usada.

---

## 🔑 Autenticação

Envie o header `x-Api-Key` com a chave compartilhada. É a **mesma chave** usada hoje pelo webhook de vouchers de adesão (`igvd_voucher_secret` no admin da OxxPharma).

- Ausente ou incorreta → **HTTP 401** `{"detail": "x-Api-Key invalida ou ausente"}`
- Se precisar rotacionar a chave, contate a OxxPharma; após a troca ambas as integrações (voucher e lookup) usam a chave nova simultaneamente.

---

## 📮 Endpoint de PRODUÇÃO

`POST /api/integrations/igvd/user-lookup`

### Request

```http
POST /api/integrations/igvd/user-lookup HTTP/1.1
Host: oxxpharma.com
Content-Type: application/json
x-Api-Key: SUA_CHAVE

{
  "email": "maria@rede1.com.br"
}
```

**Corpo (JSON):**

| Campo | Tipo   | Obrigatório | Descrição |
|-------|--------|-------------|-----------|
| email | string | ✅          | E-mail do licenciado. Case-insensitive. Precisa conter `@`. |

### Response · 200 · Encontrado

```json
{
  "found": true,
  "user": {
    "user_id": "5180",
    "name": "Maria Costa",
    "email": "maria@rede1.com.br",
    "network_type": "network_1"
  },
  "leader": {
    "user_id": "4309",
    "name": "Joao Silva",
    "email": "joao@rede1.com.br",
    "network_type": "network_1"
  },
  "sponsor_source": "network_sponsor_id"
}
```

**Campos:**

| Campo                     | Tipo                 | Descrição |
|---------------------------|----------------------|-----------|
| `found`                   | boolean              | `true` se o e-mail existe na base; `false` caso contrário. |
| `user.user_id`            | string               | ID legado numérico do usuário (ex.: `"5180"`). Fallback para o ID interno `user_XXX` se o cadastro não tiver ID legado. |
| `user.name`               | string               | Nome completo do licenciado. |
| `user.email`              | string               | E-mail cadastrado (na forma armazenada). |
| `user.network_type`       | string \| null       | `customer` \| `network_1` \| `network_2` |
| `leader`                  | object \| null       | Líder/patrocinador. `null` se o usuário não tiver patrocinador. |
| `leader.user_id`          | string               | ID legado numérico do líder (mesma regra de fallback). |
| `leader.name`             | string               | Nome do líder. |
| `leader.email`            | string               | E-mail do líder. |
| `leader.network_type`     | string \| null       | Tipo de rede do líder. |
| `sponsor_source`          | string \| null       | `network_sponsor_id` (prioridade — hierarquia MMN) OU `sponsor_id` (fallback — hierarquia de indicação). `null` se sem líder. |

### Response · 200 · Não encontrado

```json
{
  "found": false,
  "user": null,
  "leader": null,
  "sponsor_source": null
}
```

> **Importante:** e-mail inexistente **não** é erro. A resposta é 200 com `found: false`. A IGVD deve tratar esse caso como cadastro pendente na OxxPharma.

### Erros possíveis

| Código | Corpo                                                        | Causa                                              |
|--------|--------------------------------------------------------------|----------------------------------------------------|
| 400    | `{"detail": "email inválido"}`                               | Corpo sem `email` ou string sem `@`.               |
| 401    | `{"detail": "x-Api-Key invalida ou ausente"}`                | Header faltando ou chave incorreta.                |
| 500    | `{"detail": "..."}`                                          | Erro interno; retry com back-off exponencial.      |

---

## 🧪 Endpoint de HOMOLOGAÇÃO / SANDBOX

`POST /api/integrations/igvd/user-lookup/sandbox`

Contrato **idêntico** ao de produção, mas **não consulta o banco de usuários reais**. Sempre devolve um payload simulado válido, útil para a IGVD validar autenticação e parseamento antes de mandar para produção.

### Request

```http
POST /api/integrations/igvd/user-lookup/sandbox HTTP/1.1
Host: oxxpharma.com
Content-Type: application/json
x-Api-Key: SUA_CHAVE

{
  "email": "qualquer@email.com"
}
```

### Response · 200 (sempre)

```json
{
  "found": true,
  "sandbox": true,
  "user": {
    "user_id": "5180",
    "name": "Usuário Simulado",
    "email": "qualquer@email.com",
    "network_type": "customer"
  },
  "leader": {
    "user_id": "4309",
    "name": "Líder Simulado",
    "email": "leader.sandbox@example.com",
    "network_type": "network_1"
  },
  "sponsor_source": "network_sponsor_id",
  "message": "Sandbox: nada foi consultado no banco. Contrato validado."
}
```

Sinal para a IGVD saber que veio do sandbox: campo `"sandbox": true`.

Erros de autenticação e validação são idênticos aos de produção (401/400).

---

## 📊 Logs & Auditoria

Toda requisição (produção e sandbox) é gravada em `igvd_lookup_logs` com:

- `endpoint`: `"production"` ou `"sandbox"`
- `email` (normalizado lowercase)
- `found`: bool
- `matched_user_id`, `matched_leader_id`, `sponsor_source`
- `ip`, `user_agent`
- `request_id` (se enviado via header `x-request-id` ou `Idempotency-Key`)
- `at`: ISO timestamp UTC

O admin da OxxPharma pode consultar via `GET /api/admin/igvd/lookup-logs?page=1&limit=30` (requer auth admin).

**Recomendação para a IGVD:** enviar um header `x-request-id` único por chamada (UUID/ULID) — facilita o cross-check em caso de disputas ou reprocessamento.

---

## 🧑‍💻 Exemplos práticos

### cURL — produção

```bash
curl -X POST https://oxxpharma.com/api/integrations/igvd/user-lookup \
  -H "Content-Type: application/json" \
  -H "x-Api-Key: SUA_CHAVE" \
  -H "x-request-id: $(uuidgen)" \
  -d '{"email":"maria@rede1.com.br"}'
```

### JavaScript (Node.js/fetch)

```javascript
const res = await fetch('https://oxxpharma.com/api/integrations/igvd/user-lookup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-Api-Key': process.env.OXXPHARMA_API_KEY,
    'x-request-id': crypto.randomUUID(),
  },
  body: JSON.stringify({ email: 'maria@rede1.com.br' }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
if (!data.found) {
  console.log('Usuário não encontrado na OxxPharma');
} else {
  console.log('user_id:', data.user.user_id);
  console.log('leader_id:', data.leader?.user_id);
  console.log('leader_name:', data.leader?.name);
}
```

### PHP (cURL)

```php
$ch = curl_init('https://oxxpharma.com/api/integrations/igvd/user-lookup');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'x-Api-Key: ' . $apiKey,
    'x-request-id: ' . bin2hex(random_bytes(16)),
  ],
  CURLOPT_POSTFIELDS => json_encode(['email' => 'maria@rede1.com.br']),
]);
$raw  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$data = json_decode($raw, true);
curl_close($ch);
```

### Python

```python
import requests, uuid

r = requests.post(
    "https://oxxpharma.com/api/integrations/igvd/user-lookup",
    headers={
        "Content-Type": "application/json",
        "x-Api-Key": OXXPHARMA_API_KEY,
        "x-request-id": str(uuid.uuid4()),
    },
    json={"email": "maria@rede1.com.br"},
    timeout=10,
)
r.raise_for_status()
data = r.json()
```

---

## ⚙️ Boas práticas

1. **Rate limiting:** mantenha ≤ 20 req/s por IP; a OxxPharma pode aplicar 429 se detectar rajadas anormais.
2. **Timeout:** configure timeout de rede de **10s** (a busca é indexada; resposta média ~50ms).
3. **Retry:** apenas em 5xx e timeouts — use back-off exponencial (1s, 2s, 4s, máx. 3 tentativas). Nunca refaça retry em 4xx.
4. **Cache local:** você pode cachear a resposta `found=true` por até **60 minutos**. Nunca cache `found=false` por mais que 5 minutos (o usuário pode ser criado a qualquer momento).
5. **Sempre teste no sandbox** antes de subir mudanças para produção — o payload é sempre válido, o que garante que 4xx só apareça em bug real.
6. **`x-request-id`:** sempre envie um UUID/ULID único — imprescindível para debug conjunto.

---

## 📞 Contato / Rotação de chave

- Suporte técnico: `suporte@oxxpharma.com`
- Para rotacionar a `x-Api-Key`: alinhar janela com a OxxPharma; a chave atual continua válida até ser explicitamente sobrescrita no admin.

---

## 📜 Changelog

| Versão | Data      | Notas                                              |
|--------|-----------|----------------------------------------------------|
| 1.0    | Ago/2026  | Lançamento inicial (Iter 56). Endpoint produção + sandbox + auditoria. |
| 1.1    | Fev/2026  | (Iter 57) `user.user_id` e `leader.user_id` passam a retornar o ID legado numérico (`external_id`, ex.: `"5180"`) quando disponível — fallback para o ID interno `user_XXX` mantém compatibilidade. |
