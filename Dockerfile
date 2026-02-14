# Nutze die Version 22 (LTS), passend zu deiner lokalen Installation
FROM node:22-bookworm-slim

# Build-Tools für Pakete wie bcrypt installieren
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# NUR package-Dateien kopieren für effizientes Caching
COPY package*.json ./

# Installiere Abhängigkeiten (im Container für Linux)
RUN npm install

# Den Rest kopieren
COPY . .

EXPOSE 3000

# Starte mit nodemon (aus deinen devDependencies)
CMD ["npm", "run", "dev"]