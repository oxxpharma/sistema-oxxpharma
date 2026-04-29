# 🚀 OxxPharma — Guia de Deploy em Produção

Tudo que você precisa para subir a OxxPharma em um servidor Linux Ubuntu.

> **Pré-requisitos:** servidor Ubuntu 22.04 / 24.04 / 25.10 com acesso `root`, domínio `oxxpharma.com.br` apontando para o IP do servidor (registros A na zona DNS).

---

## ⚡ Resumo (pra quem tem pressa)

```bash
# 1. Apontar o DNS de oxxpharma.com.br e www.oxxpharma.com.br para o IP do servidor

# 2. Conectar no servidor
ssh root@SEU_IP

# 3. Clonar o repositório
mkdir -p /var/www
cd /var/www
git clone https://github.com/SEU_USUARIO/oxxpharma.git oxxpharma
cd oxxpharma

# 4. Setup inicial (uma vez só)
sudo bash deploy/install.sh

# 5. Editar variáveis de ambiente (gerar JWT_SECRET, etc)
sudo nano backend/.env

# 6. Deploy
sudo bash deploy/deploy.sh

# 7. SSL/HTTPS
sudo certbot --nginx -d oxxpharma.com.br -d www.oxxpharma.com.br -m contato@oxxpharma.com --agree-tos --redirect
```

Acesse `https://oxxpharma.com.br` e logue como admin com a senha definida no `.env`.

---

## 📋 Passo a passo detalhado

### 1️⃣ DNS

No painel do seu provedor de domínio, crie 2 registros tipo **A** apontando para o IP público do servidor:

| Nome | Tipo | Valor |
|------|------|-------|
| `@` | A | `IP_DO_SERVIDOR` |
| `www` | A | `IP_DO_SERVIDOR` |

Aguarde a propagação (`dig oxxpharma.com.br` no terminal deve retornar o IP).

---

### 2️⃣ Subir código no GitHub

No seu computador (uma vez):

```bash
git remote add origin https://github.com/SEU_USUARIO/oxxpharma.git
git push -u origin main
```

> Dica: se o repositório for privado, configure uma chave SSH no servidor (`ssh-keygen -t ed25519` e adicione a `.pub` em **GitHub → Settings → SSH keys**), ou use um Personal Access Token.

---

### 3️⃣ Conectar no servidor e clonar

```bash
ssh root@SEU_IP
mkdir -p /var/www
cd /var/www
git clone https://github.com/SEU_USUARIO/oxxpharma.git oxxpharma
cd oxxpharma
```

> Estrutura final: `/var/www/oxxpharma/{backend,frontend,deploy}/`

---

### 4️⃣ Setup inicial do servidor (rode UMA VEZ)

```bash
sudo bash /var/www/oxxpharma/deploy/install.sh
```

O script instala:
- Python 3.11
- Node.js 20 + Yarn
- MongoDB 7
- Nginx
- Supervisor
- Certbot (Let's Encrypt)
- UFW (firewall) — abre 22 (SSH) e 80/443 (HTTP/HTTPS)

Tempo médio: **5 a 10 minutos**.

---

### 5️⃣ Configurar variáveis de ambiente

Crie e edite o `.env` do backend:

```bash
cd /var/www/oxxpharma
sudo cp deploy/env.backend.example backend/.env
sudo nano backend/.env
```

**Edite obrigatoriamente:**

```ini
# Gere uma chave aleatória forte
JWT_SECRET=COLE_AQUI_UMA_CHAVE_DE_64_CARACTERES

# Senha do admin para o primeiro login (troque depois pelo painel)
ADMIN_EMAIL=admin@oxxpharma.com
ADMIN_PASSWORD=SUA_SENHA_FORTE_AQUI
```

**Para gerar JWT_SECRET no servidor:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Cole o valor retornado em `JWT_SECRET=`.

> **Não precisa** preencher MercadoPago/Resend/Correios no `.env` — você configura tudo pelo painel admin depois.

Salve com `Ctrl+O`, `Enter`, `Ctrl+X`.

---

### 6️⃣ Deploy

```bash
sudo bash /var/www/oxxpharma/deploy/deploy.sh
```

Esse script:
1. Cria virtualenv Python e instala dependências do backend
2. Faz build de produção do frontend (`yarn build`)
3. Instala configuração do Nginx em `/etc/nginx/sites-available/oxxpharma`
4. Instala serviço Supervisor para o backend
5. Sobe tudo e roda health check

Tempo médio: **3 a 5 minutos**.

Se der erro, leia a última linha vermelha — geralmente é falta de variável no `.env`.

---

### 7️⃣ HTTPS / SSL com Let's Encrypt

```bash
sudo certbot --nginx \
  -d oxxpharma.com.br \
  -d www.oxxpharma.com.br \
  -m contato@oxxpharma.com \
  --agree-tos --redirect
```

O Certbot:
- Gera o certificado
- Atualiza o nginx automaticamente
- Configura redirect 80 → 443
- Renova automaticamente a cada 60 dias (cron já habilitado)

✅ Pronto. Acesse **https://oxxpharma.com.br**

---

## 🛠️ Pós-deploy: configurar pelo painel admin

Logue em `https://oxxpharma.com.br/login` com o admin do `.env` e configure:

### 📧 E-mails (Resend) — `/backoffice/emails`
- Habilitar envio de emails
- Colar `RESEND_API_KEY`
- Definir `email_from` (ex: `OxxPharma <contato@oxxpharma.com>`)
- Configurar destinatários admin

### 💳 MercadoPago — `/backoffice/pagamentos`
- Aba **Credenciais**:
  - Test: Public Key + Access Token (sandbox)
  - Production: Public Key + Access Token (real)
  - Webhook Secret (HMAC, opcional mas recomendado)
- Aba **Ambiente**: comece em **Sandbox**, mude para **Produção** quando estiver tudo OK
- No painel do MercadoPago ([Webhooks](https://www.mercadopago.com.br/developers/panel/notifications/webhooks)) configure a URL:
  ```
  https://oxxpharma.com.br/api/payments/webhook/mercadopago
  ```

### 📦 Correios CWS — `/backoffice/frete`
- Aba **Configuração**:
  - **Ambiente**: Homologação (recomendado começar) ou Produção
  - **Usuário**: login Meu Correios
  - **Código de acesso**: gere no portal CWS
  - **Número do contrato**
  - **CEP de origem**
- Clique **Testar autenticação** → deve mostrar verde
- Configure os serviços (PAC `03298`, SEDEX `03220`, etc.)
- Marque **Ativado**

### 🎁 Cartão de Benefícios — `/backoffice/cartao`
- Configure o cron diário (default 23:59 GMT-3)
- Configure os campos do formulário de adesão
- Adicione URL e auth da API do cartão (quando o fornecedor enviar)

### 👥 Importar usuários da rede MMN
- `/backoffice/redes` → tab Rede 1 → **Importar CSV**
- Formato: `id, nome, email, id_lider, telefone`
- Usuários importados ficam com `must_set_password=true`
- Para enviar e-mails de primeiro acesso em massa: edite cada user em `/backoffice/usuarios` e clique **Enviar 1º acesso**

---

## 🔄 Atualizações futuras (após push no GitHub)

```bash
sudo bash /var/www/oxxpharma/deploy/update.sh
```

Equivale a `git pull` + `deploy.sh`.

---

## 🧰 Comandos úteis

```bash
# Status dos serviços
sudo supervisorctl status oxxpharma-backend
sudo systemctl status nginx mongod

# Ver logs em tempo real
sudo tail -f /var/log/oxxpharma/backend.out.log     # backend stdout
sudo tail -f /var/log/oxxpharma/backend.err.log     # backend erros
sudo tail -f /var/log/nginx/oxxpharma.access.log    # nginx access
sudo tail -f /var/log/nginx/oxxpharma.error.log     # nginx errors

# Restart manual
sudo supervisorctl restart oxxpharma-backend
sudo systemctl reload nginx

# Backup do MongoDB
mongodump --db oxxpharma --out /var/backups/oxxpharma-$(date +%F)

# Restaurar backup
mongorestore --db oxxpharma /var/backups/oxxpharma-2026-04-29/oxxpharma

# Health check
curl https://oxxpharma.com.br/api/health
```

---

## 🆘 Troubleshooting

### Backend não sobe
```bash
sudo tail -n 100 /var/log/oxxpharma/backend.err.log
```
Causas comuns:
- `JWT_SECRET` vazio → edite `.env`
- MongoDB não está rodando → `sudo systemctl start mongod`
- Porta 8001 ocupada → `sudo lsof -i :8001`

### Frontend mostra "404 Not Found"
Verifique se o build existe:
```bash
ls /var/www/oxxpharma/frontend/build
```
Se não existir, rode `cd /var/www/oxxpharma/frontend && yarn build` manualmente.

### SSL não funciona
```bash
sudo nginx -t                                    # valida config
sudo certbot renew --dry-run                     # testa renovação
sudo certbot certificates                        # lista certificados
```

### Mudei o domínio
Edite `/etc/nginx/sites-available/oxxpharma`, frontend `.env` (`REACT_APP_BACKEND_URL`) e backend `.env` (`APP_URL`, `BACKEND_URL`). Re-rode `deploy.sh`.

### Esqueci a senha do admin
Conecte no Mongo e gere bcrypt manualmente:
```bash
# 1) Gerar hash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'NOVA_SENHA', bcrypt.gensalt()).decode())"

# 2) Atualizar no Mongo
mongosh oxxpharma --eval 'db.users.updateOne({email:"admin@oxxpharma.com"}, {$set: {password_hash: "COLE_O_HASH_AQUI"}})'
```

---

## 📁 Estrutura final no servidor

```
/var/www/oxxpharma/
├── backend/
│   ├── .env                  ← suas credenciais
│   ├── .venv/                ← virtualenv Python
│   ├── server.py
│   ├── correios_service.py
│   ├── payments_service.py
│   ├── card_service.py
│   ├── email_service.py
│   └── requirements.txt
├── frontend/
│   ├── .env
│   ├── build/                ← React build de produção (servido pelo nginx)
│   ├── src/
│   └── package.json
└── deploy/
    ├── install.sh            ← uma vez
    ├── deploy.sh             ← toda atualização
    ├── update.sh             ← git pull + deploy
    ├── nginx.conf.template
    ├── supervisor.conf.template
    ├── env.backend.example
    └── env.frontend.example
```

Logs em `/var/log/oxxpharma/` e `/var/log/nginx/`.

---

## ✅ Checklist final

- [ ] DNS apontando (`dig oxxpharma.com.br` retorna IP)
- [ ] `install.sh` rodou sem erro
- [ ] `backend/.env` com `JWT_SECRET` e `ADMIN_PASSWORD` configurados
- [ ] `deploy.sh` finalizou com health check OK
- [ ] Certbot configurou SSL (acesso via `https://`)
- [ ] Login admin funciona
- [ ] Resend configurado (testar enviando email do `/backoffice/emails`)
- [ ] MercadoPago em sandbox testado (faça uma compra de teste)
- [ ] Correios em homologação testado
- [ ] Mudou MercadoPago para produção quando estiver tudo certo
- [ ] Webhook do MP configurado no painel deles
- [ ] Backup do Mongo agendado em cron

Boa sorte! 🚀
