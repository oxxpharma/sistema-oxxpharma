# OxxPharma

E-commerce + Sistema MMN (Marketing Multinível) com:
- 🛒 Loja completa (carrinho, checkout, pedidos)
- 💳 Pagamentos via MercadoPago (sandbox + produção)
- 📦 Cálculo de frete via Correios CWS API
- 🌐 2 redes MMN independentes com comissões automáticas
- 🎁 Cartão de Benefícios com envio diário (CRON)
- 📧 E-mails transacionais via Resend
- 🏆 Sistema de pontos exportável em XLSX

## Stack
- **Backend**: FastAPI (Python 3.11) + MongoDB + APScheduler
- **Frontend**: React 18 + TailwindCSS + Shadcn/UI
- **Servidor**: Nginx + Supervisor + Let's Encrypt

## 🚀 Deploy em produção
Veja [DEPLOY.md](./DEPLOY.md) — passo a passo completo.

```bash
# Resumo (no servidor):
cd /var/www && git clone <repo> oxxpharma && cd oxxpharma
sudo bash deploy/install.sh    # 1x: instala MongoDB, Python, Node, Nginx
sudo nano backend/.env         # configura JWT_SECRET, ADMIN_PASSWORD
sudo bash deploy/deploy.sh     # build + start
sudo certbot --nginx -d oxxpharma.com.br -d www.oxxpharma.com.br
```

## 🛠️ Desenvolvimento local

### Backend
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../deploy/env.backend.example .env  # edite
uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
yarn start
```

## 📁 Estrutura
```
backend/             FastAPI + serviços
frontend/            React + components
deploy/              Scripts de deploy + templates
DEPLOY.md            Guia completo
```

## 🔐 Configurações (todas pelo painel admin)
- `/backoffice/emails` → Resend
- `/backoffice/pagamentos` → MercadoPago (sandbox + produção)
- `/backoffice/frete` → Correios CWS
- `/backoffice/cartao` → Cartão de Benefícios
- `/backoffice/usuarios` → Gestão de usuários (CRUD completo)
- `/backoffice/pontos` → Relatório XLSX

## 📜 Licença
Proprietária — OxxPharma © 2026
