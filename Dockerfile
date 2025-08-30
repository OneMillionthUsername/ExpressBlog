# Verwende ein offizielles Node.js Image als Basis
FROM node:18-alpine

# Setze das Arbeitsverzeichnis
WORKDIR /app

# Kopiere die package.json und package-lock.json (um Caching zu nutzen)
COPY package*.json ./

# Installiere die Abhängigkeiten
RUN npm install

# Kopiere den gesamten Quellcode in den Container
COPY . .

# Exponiere den Port, auf dem die Anwendung läuft
EXPOSE 3000

# Starte die Anwendung
CMD ["npm", "start"]