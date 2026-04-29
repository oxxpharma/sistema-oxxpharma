#!/usr/bin/env bash
# ============================================================
# OxxPharma - Deploy / Update da aplicacao
# ============================================================
# Rode TODA VEZ que fizer git pull para atualizar.
# Uso: sudo bash deploy.sh
# ============================================================
set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC} $*"; }

if [[ $EUID -ne 0 ]]; then
   err "Rode como root: sudo bash deploy.sh"
   exit 1
fi

APP_DIR="${APP_DIR:-/var/www/oxxpharma}"
DOMAIN="${DOMAIN:-oxxpharma.com.br}"
DEPLOY_DIR="$APP_DIR/deploy"

cd "$APP_DIR"

# ---------- 1. Backend: venv + dependencias ----------
log "Configurando backend Python..."
cd "$APP_DIR/backend"

# Carrega caminho do Python escolhido pelo install.sh
PYTHON_BIN=""
if [[ -f /etc/oxxpharma/env ]]; then
    # shellcheck disable=SC1091
    source /etc/oxxpharma/env
fi
# Auto-deteccao se nao encontrado
if [[ -z "$PYTHON_BIN" || ! -x "$PYTHON_BIN" ]]; then
    for c in python3.11 python3.12 python3.13 python3; do
        if command -v "$c" &>/dev/null; then
            PYTHON_BIN="$(command -v $c)"; break
        fi
    done
fi
[[ -z "$PYTHON_BIN" ]] && { err "Python nao encontrado. Rode install.sh antes."; exit 1; }
log "Usando Python: $PYTHON_BIN ($($PYTHON_BIN -V))"

if [[ ! -d .venv ]]; then
    "$PYTHON_BIN" -m venv .venv
fi

source .venv/bin/activate
pip install --upgrade pip wheel setuptools -q
pip install -r requirements.txt -q
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -q || warn "emergentintegrations falhou (opcional)"
deactivate

# ---------- 2. .env do backend ----------
if [[ ! -f "$APP_DIR/backend/.env" ]]; then
    log "Criando backend/.env a partir do template..."
    cp "$DEPLOY_DIR/env.backend.example" "$APP_DIR/backend/.env"
    warn "*** EDITE $APP_DIR/backend/.env e re-rode o deploy ***"
fi

# ---------- 3. Frontend: build de produção ----------
log "Build do frontend..."
cd "$APP_DIR/frontend"

# .env do frontend
if [[ ! -f .env ]]; then
    log "Criando frontend/.env..."
    cp "$DEPLOY_DIR/env.frontend.example" .env
    sed -i "s|__DOMAIN__|$DOMAIN|g" .env
fi

yarn install --frozen-lockfile --silent || yarn install --silent
yarn build

# ---------- 4. Permissoes ----------
log "Ajustando permissões..."
chown -R www-data:www-data "$APP_DIR"

# ---------- 5. Nginx ----------
log "Instalando configuração do Nginx..."
sed "s|__DOMAIN__|$DOMAIN|g; s|__APP_DIR__|$APP_DIR|g" "$DEPLOY_DIR/nginx.conf.template" > /etc/nginx/sites-available/oxxpharma
ln -sf /etc/nginx/sites-available/oxxpharma /etc/nginx/sites-enabled/oxxpharma
[[ -f /etc/nginx/sites-enabled/default ]] && rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ---------- 6. Supervisor (backend) ----------
log "Instalando configuração do Supervisor (backend)..."
sed "s|__APP_DIR__|$APP_DIR|g" "$DEPLOY_DIR/supervisor.conf.template" > /etc/supervisor/conf.d/oxxpharma-backend.conf
supervisorctl reread
supervisorctl update
supervisorctl restart oxxpharma-backend || supervisorctl start oxxpharma-backend

sleep 3

# ---------- 7. Health check ----------
log "Health check..."
log "Status do supervisor:"
supervisorctl status oxxpharma-backend || true

# Curl com debug, sem set -e tripping
HEALTH=$(curl -s -o /tmp/health.out -w "%{http_code}" http://localhost:8001/api/health || echo "000")
if [[ "$HEALTH" == "200" ]]; then
    log "✓ Backend respondendo em :8001 (HTTP $HEALTH)"
else
    err "✗ Backend não respondeu (HTTP $HEALTH)."
    err ""
    err "Diagnóstico:"
    err "  1) Status: sudo supervisorctl status oxxpharma-backend"
    err "  2) Logs:   sudo tail -n 80 /var/log/oxxpharma/backend.err.log"
    err "  3) Porta:  sudo ss -tlnp | grep 8001"
    err ""
    err "Saída do curl:"
    cat /tmp/health.out 2>/dev/null || true
    err ""
    err "Últimas 30 linhas do log de erro:"
    tail -n 30 /var/log/oxxpharma/backend.err.log 2>/dev/null || echo "  (log vazio ou ainda não criado)"
    exit 1
fi

echo ""
log "=========================================="
log "✓ Deploy concluído com sucesso!"
log "=========================================="
log "App: https://$DOMAIN"
log "Logs backend:  tail -f /var/log/oxxpharma/backend.out.log"
log "Logs nginx:    tail -f /var/log/nginx/access.log"
log "Restart:       sudo supervisorctl restart oxxpharma-backend"
echo ""
