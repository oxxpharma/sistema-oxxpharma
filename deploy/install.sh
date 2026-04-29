#!/usr/bin/env bash
# ============================================================
# OxxPharma - Setup inicial do servidor (rode UMA VEZ)
# ============================================================
# - Instala MongoDB, Python 3.11, Node.js 20, Nginx, Supervisor
# - Configura firewall, SSL Let's Encrypt
# Rode como root: sudo bash install.sh
# ============================================================
set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INSTALL]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC} $*"; }

if [[ $EUID -ne 0 ]]; then
   err "Rode como root: sudo bash install.sh"
   exit 1
fi

DOMAIN="${DOMAIN:-oxxpharma.com.br}"
EMAIL="${EMAIL:-contato@oxxpharma.com}"
APP_DIR="${APP_DIR:-/var/www/oxxpharma}"

log "Domínio: $DOMAIN | E-mail SSL: $EMAIL | Diretório: $APP_DIR"

# ---------- 1. Pacotes do sistema ----------
log "Atualizando sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl wget gnupg2 ca-certificates lsb-release software-properties-common \
    build-essential ufw git unzip

# ---------- 2. Python 3.11 ----------
log "Instalando Python 3.11..."
apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip || {
    add-apt-repository -y ppa:deadsnakes/ppa
    apt-get update -qq
    apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip
}

# ---------- 3. Node.js 20 + Yarn ----------
log "Instalando Node.js 20 + Yarn..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
npm install -g yarn

# ---------- 4. MongoDB 7 ----------
log "Instalando MongoDB 7..."
if ! command -v mongod &>/dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
        > /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -qq
    apt-get install -y -qq mongodb-org || {
        warn "MongoDB 7 falhou. Tentando mongodb (versao do apt)..."
        apt-get install -y -qq mongodb
    }
    systemctl enable mongod || systemctl enable mongodb || true
    systemctl start mongod || systemctl start mongodb || true
else
    log "MongoDB já instalado."
fi

# ---------- 5. Nginx + Supervisor ----------
log "Instalando Nginx + Supervisor..."
apt-get install -y -qq nginx supervisor

# ---------- 6. Firewall ----------
log "Configurando firewall (UFW)..."
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'

# ---------- 7. Diretorio do app ----------
log "Garantindo diretório $APP_DIR..."
mkdir -p "$APP_DIR"
mkdir -p /var/log/oxxpharma
chown -R www-data:www-data /var/log/oxxpharma

# ---------- 8. Certbot (Let's Encrypt) ----------
log "Instalando Certbot (Let's Encrypt)..."
apt-get install -y -qq certbot python3-certbot-nginx

# ---------- 9. Resumo ----------
echo ""
log "=========================================="
log "Setup base concluído! Próximos passos:"
log "=========================================="
log "1. Faça o git clone do repositório em $APP_DIR (se ainda não fez)"
log "2. Edite $APP_DIR/backend/.env com suas variáveis"
log "3. Rode: sudo bash $APP_DIR/deploy/deploy.sh"
log "4. Configure SSL: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -m $EMAIL --agree-tos --redirect"
echo ""
