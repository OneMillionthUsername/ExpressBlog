# Basis-Image
FROM node:latest

# Pfad-Definition
ENV APP_PATH=/var/www/vhosts/musing-feynman.172-17-0-2.plesk.page/httpdocs
WORKDIR $APP_PATH

# Berechtigungen vorbereiten
RUN chown -R node:node $APP_PATH

# 1. Erst den gesamten Code kopieren (damit Skripte für Post-Install da sind)
COPY --chown=node:node . .

# 2. Zu User 'node' wechseln
USER node

# 3. Jetzt erst installieren
# Da der Code (inkl. scripts/) schon da ist, läuft das Post-Install-Skript durch
RUN npm install

# Port-Freigabe
EXPOSE 3000

# Startbefehl
CMD ["npm", "start", "dev"]