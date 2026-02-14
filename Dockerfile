FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Erst package-Dateien
COPY package*.json ./

# 2. AUCH den scripts-Ordner kopieren (für das postinstall-Script)
COPY scripts/ ./scripts/

# 3. Jetzt schlägt npm install nicht mehr fehl
RUN npm install

# 4. Den Rest kopieren
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]