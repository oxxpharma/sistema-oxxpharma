#!/usr/bin/env bash
# ============================================================
# OxxPharma - Setup inicial do servidor (rode UMA VEZ)
# ============================================================
# - Instala MongoDB, Python (3.11/3.12/3.13), Node.js 20, Nginx, Supervisor
# - Configura firewall, Certbot
# - Suporta Ubuntu 22.04 (jammy) / 24.04 (noble) / 25.10 (questing)
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

# Detecta versao do Ubuntu
. /etc/os-release
UBUNTU_CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
log "SO: $PRETTY_NAME ($UBUNTU_CODENAME)"
log "Domínio: $DOMAIN | E-mail SSL: $EMAIL | Diretório: $APP_DIR"

# ---------- 1. Pacotes do sistema ----------
log "Atualizando sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl wget gnupg2 ca-certificates lsb-release software-properties-common \
    build-essential ufw git unzip

# ---------- 2. Python (>= 3.11) ----------
# Estrategia: tenta python3.11 -> 3.12 -> 3.13 -> sistema. Aceita >= 3.10.
log "Procurando Python >= 3.11..."

PY_BIN=""
# Lista de candidatos por ordem de preferencia
for v in 3.11 3.12 3.13; do
    if apt-cache show "python${v}" 2>/dev/null | grep -q "^Package:"; then
        log "Pacote python${v} disponivel no apt - instalando..."
        apt-get install -y -qq "python${v}" "python${v}-venv" "python${v}-dev" python3-pip || continue
        PY_BIN="$(command -v python${v} || true)"
        [[ -n "$PY_BIN" ]] && break
    fi
done

# Fallback: deadsnakes PPA (suporta jammy/noble; nao suporta questing/25.10)
if [[ -z "$PY_BIN" ]] && [[ "$UBUNTU_CODENAME" == "jammy" || "$UBUNTU_CODENAME" == "noble" ]]; then
    warn "Tentando deadsnakes PPA para python3.11..."
    add-apt-repository -y ppa:deadsnakes/ppa || true
    apt-get update -qq || true
    apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip || true
    PY_BIN="$(command -v python3.11 || true)"
fi

# Ultimo recurso: usar python3 do sistema (Ubuntu 25.10 ja vem com 3.13)
if [[ -z "$PY_BIN" ]]; then
    warn "Caindo para python3 do sistema..."
    apt-get install -y -qq python3 python3-venv python3-dev python3-pip
    PY_BIN="$(command -v python3 || true)"
fi

if [[ -z "$PY_BIN" ]]; then
    err "Não foi possível instalar Python. Aborte."
    exit 1
fi

# Valida versao >= 3.10
PY_VER="$("$PY_BIN" -c 'import sys;print("%d.%d"%sys.version_info[:2])')"
log "Python escolhido: $PY_BIN (v$PY_VER)"
if ! "$PY_BIN" -c 'import sys;exit(0 if sys.version_info>=(3,10) else 1)'; then
    err "Versão Python ($PY_VER) é inferior a 3.10. Aborte."
    exit 1
fi

# Salva binario para o deploy.sh consumir
mkdir -p /etc/oxxpharma
echo "PYTHON_BIN=$PY_BIN" > /etc/oxxpharma/env
echo "PYTHON_VERSION=$PY_VER" >> /etc/oxxpharma/env
log "Caminho Python salvo em /etc/oxxpharma/env"

# ---------- 3. Node.js 20 + Yarn ----------
log "Instalando Node.js 20 + Yarn..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
npm install -g yarn

# ---------- 4. MongoDB ----------
log "Instalando MongoDB..."

# Mapeia codename para repo MongoDB oficial (questing -> noble por compat binaria)
case "$UBUNTU_CODENAME" in
    jammy)              MONGO_REPO_CN="jammy" ;;
    noble|questing|*)   MONGO_REPO_CN="noble" ;;
esac
log "Usando repo MongoDB para codename: $MONGO_REPO_CN"

# Dependencia comum
apt-get install -y -qq libssl3 libcurl4 || true

install_mongo_version() {
    local VER="$1"
    log "Tentando MongoDB ${VER}.0 (repo $MONGO_REPO_CN)..."
    rm -f /etc/apt/sources.list.d/mongodb-org-*.list
    curl -fsSL "https://www.mongodb.org/static/pgp/server-${VER}.0.asc" \
        | gpg -o "/usr/share/keyrings/mongodb-server-${VER}.0.gpg" --dearmor --yes 2>/dev/null || return 1
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${VER}.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${MONGO_REPO_CN}/mongodb-org/${VER}.0 multiverse" \
        > "/etc/apt/sources.list.d/mongodb-org-${VER}.0.list"
    apt-get update -qq 2>/dev/null || return 1
    apt-get install -y -qq mongodb-org 2>/dev/null || return 1
    return 0
}

if ! command -v mongod &>/dev/null; then
    MONGO_OK=0
    # Tenta 8.0 (mais recente), depois 7.0
    if install_mongo_version 8; then MONGO_OK=1; log "MongoDB 8.0 instalado."; fi
    if [[ "$MONGO_OK" -eq 0 ]] && install_mongo_version 7; then MONGO_OK=1; log "MongoDB 7.0 instalado."; fi

    if [[ "$MONGO_OK" -eq 0 ]]; then
        err "Falha ao instalar MongoDB pelos repos oficiais."
        err "Tente manualmente: https://www.mongodb.com/docs/manual/installation/"
        exit 1
    fi

    systemctl enable mongod 2>/dev/null || true
    systemctl start  mongod 2>/dev/null || true
    sleep 2
    if systemctl is-active --quiet mongod; then
        log "✓ MongoDB ativo (porta 27017)"
    else
        warn "MongoDB instalado mas nao iniciou. Veja: journalctl -u mongod"
    fi
else
    log "MongoDB já instalado: $(mongod --version | head -1)"
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
log "Setup base concluído!"
log "Python: $PY_BIN ($PY_VER)"
log "Node:   $(node -v 2>/dev/null || echo 'erro')"
log "Mongo:  $(mongod --version 2>/dev/null | head -1 || echo 'erro')"
log "=========================================="
log "Próximos passos:"
log "1. Edite $APP_DIR/backend/.env com suas variáveis (JWT_SECRET, ADMIN_PASSWORD)"
log "2. Rode: sudo bash $APP_DIR/deploy/deploy.sh"
log "3. Configure SSL: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -m $EMAIL --agree-tos --redirect"
echo ""
