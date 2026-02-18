#!/bin/bash
# Production Deployment Script für Ubuntu VPS mit PM2
# Wird durch GitHub Actions aufgerufen

set -e

PROJECT_DIR="/var/www/blog"
LOG_FILE="/var/log/expressblog/deploy.log"
LOG_DIR="/var/log/expressblog"

# Logging-Funktion
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Fehlerbehandlung
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Erstelle Log-Verzeichnis falls nicht vorhanden
mkdir -p "$LOG_DIR"

log "=========================================="
log "ExpressBlog Production Deployment Started"
log "=========================================="

cd "$PROJECT_DIR" || error_exit "Cannot cd to $PROJECT_DIR"

# Git Pull
log "Pulling latest code from main branch..."
git fetch origin || error_exit "Git fetch failed"
git checkout main || error_exit "Git checkout failed"
git pull origin main || error_exit "Git pull failed"

# Node Dependencies
log "Installing dependencies..."
npm ci || error_exit "npm ci failed"

# PM2 Restart
log "Restarting application with PM2..."
pm2 restart speculumx-blog || error_exit "PM2 restart failed"

# Warte eine Sekunde
sleep 2

# Überprüfe ob App läuft
if pm2 info speculumx-blog | grep -q "online"; then
    log "✅ Application is running"
else
    error_exit "Application failed to start"
fi

log "=========================================="
log "ExpressBlog Production Deployment Completed Successfully"
log "=========================================="

# Optional: PM2 Logs
log "Recent logs:"
pm2 logs "speculumx-blog" --lines 20 --nostream || true
