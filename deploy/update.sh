#!/usr/bin/env bash
# Atualizar app: git pull + redeploy
set -e
APP_DIR="${APP_DIR:-/var/www/oxxpharma}"
cd "$APP_DIR"

echo "→ Git pull..."
git pull

echo "→ Redeploy..."
sudo bash "$APP_DIR/deploy/deploy.sh"
