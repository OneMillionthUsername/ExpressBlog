# --- STAGE 1: Development & Build ---
# Wir nutzen Bookworm-slim für die nötigen Build-Tools (Python/G++)
FROM node:22-bookworm-slim AS dev

# Installiere Abhängigkeiten für native Node-Module [cite: 1]
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Package-Dateien und Scripts für postinstall kopieren [cite: 1]
COPY package*.json ./
COPY scripts/ ./scripts/

# Installation aller Module (inkl. Dev-Dependencies für Tests/Builds) 
RUN npm install

# Den restlichen Code kopieren [cite: 2]
COPY . .

EXPOSE 3000

# Standardbefehl für die lokale Entwicklung
CMD ["npm", "run", "dev"]


# --- STAGE 2: Production Release (Die Gummizelle) ---
# Minimalistisches Alpine Linux für minimale Angriffsfläche
FROM node:22-alpine AS release

WORKDIR /app
ENV NODE_ENV=production

# Nur die notwendigen Artefakte aus der Dev-Stage kopieren
COPY --from=dev /app/node_modules ./node_modules
COPY --from=dev /app . 

# 🛡️ Sicherheit: App läuft als eingeschränkter User 'node'
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Direktstart mit Node (spart RAM gegenüber NPM)
CMD ["node", "server.js"]