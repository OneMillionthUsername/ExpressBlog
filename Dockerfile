# --- STAGE 1: Development & Build ---
# Wir nutzen Bookworm-slim für die nötigen Build-Tools (Python/G++)
FROM node:22-bookworm-slim AS build

# Installiere Abhängigkeiten für native Node-Module
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Package-Dateien und Scripts kopieren
COPY package*.json ./
COPY scripts/ ./scripts/

# Installation (inkl. Dev-Dependencies für native Builds)
RUN npm install

# Den restlichen Code kopieren
COPY . .

# Falls du doch mal ein Build-Script ausführst (auch wenn es nur ein echo ist)
RUN npm run build --if-present


# --- STAGE 2: Production Release (Die Gummizelle) ---
# Minimalistisches Alpine Linux für minimale Angriffsfläche
FROM node:22-alpine AS release

WORKDIR /app
ENV NODE_ENV=production

# Wir kopieren die Abhängigkeiten, die in Stage 1 (Bookworm) gebaut wurden
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
# Hier der Fix: Wir kopieren ALLES (server.js, etc.), da kein /dist existiert
COPY --from=build --chown=node:node /app .

# Sicherheit: App läuft als eingeschränkter User 'node'
USER node

EXPOSE 3000

# Direktstart (spart RAM)
CMD ["node", "server.js"]