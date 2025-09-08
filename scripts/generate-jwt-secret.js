#!/usr/bin/env node

/**
 * JWT-Secret-Generator
 *
 * Dieses Script generiert einen sicheren, zufälligen JWT-Secret
 * für die Verwendung in Ihrer Anwendung.
 *
 * Verwendung:
 * node scripts/generate-jwt-secret.js
 *
 * SICHERHEITSHINWEISE:
 * - Verwenden Sie diesen Secret nur für JWT-Signierung
 * - Speichern Sie ihn sicher in Ihrer .env-Datei
 * - Teilen Sie ihn niemals in Code-Repositories
 * - Generieren Sie einen neuen Secret bei Kompromittierung
 */

import crypto from 'crypto';

// Konfiguration
const SECRET_LENGTH = 64; // 64 Bytes = 128 Hex-Zeichen (sehr sicher)

/**
 * Generiert einen sicheren, zufälligen JWT-Secret
 * @param {number} length - Länge des Secrets in Bytes
 * @returns {string} Hex-String des Secrets
 */
function generateJWTSecret(length = SECRET_LENGTH) {
    return crypto.randomBytes(length).toString('hex');
}

// Haupt-Funktion
function main() {
    console.log('='.repeat(60));
    console.log('JWT-SECRET-GENERATOR');
    console.log('='.repeat(60));
    console.log();

    console.log('SICHERHEITSHINWEISE:');
    console.log('- Verwenden Sie diesen Secret nur für JWT-Signierung');
    console.log('- Speichern Sie ihn in Ihrer .env-Datei');
    console.log('- Teilen Sie ihn niemals in Code-Repositories');
    console.log('- Generieren Sie einen neuen bei Kompromittierung');
    console.log();

    const secret = generateJWTSecret();

    console.log('GENERIERTER JWT-SECRET:');
    console.log('='.repeat(60));
    console.log(secret);
    console.log('='.repeat(60));
    console.log();

    console.log('VERWENDUNG IN .env:');
    console.log(`JWT_SECRET=${secret}`);
    console.log();

    console.log('VERIFIKATION:');
    console.log(`Länge: ${secret.length} Zeichen`);
    console.log(`Entropie: ${SECRET_LENGTH * 8} Bits`);
    console.log('Quelle: crypto.randomBytes()');
    console.log();

    console.log('WICHTIG:');
    console.log('- Kopieren Sie den Secret in Ihre .env-Datei');
    console.log('- Starten Sie Ihre Anwendung neu');
    console.log('- Löschen Sie dieses Terminal nach der Verwendung');
}

// Script ausführen
main();
