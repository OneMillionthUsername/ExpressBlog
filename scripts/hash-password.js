#!/usr/bin/env node

/**
 * Sicheres Passwort-Hashing-Tool für Admin-Benutzer
 * 
 * Dieses Script hilft bei der sicheren Erstellung von bcrypt-Hashes
 * für Admin-Benutzer-Passwörter.
 * 
 * Verwendung:
 * node scripts/hash-password.js
 * 
 * SICHERHEITSHINWEISE:
 * - Verwenden Sie dieses Script nur auf sicheren Systemen
 * - Löschen Sie die Konsolen-Historie nach der Verwendung
 * - Bewahren Sie Passwörter niemals im Klartext auf
 * - Führen Sie dieses Script nicht auf öffentlichen/geteilten Systemen aus
 */

import bcrypt from 'bcrypt';
import readline from 'readline';

// Konfiguration
const SALT_ROUNDS = 12; // Hohe Sicherheit (dauert länger, aber sicherer)
const MIN_PASSWORD_LENGTH = 8;

// small helper to ask a question (clean readline per question)
function askQuestion(prompt) {
    return new Promise((resolve, reject) => {
        const r = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: !!process.stdin.isTTY
        });

        r.question(prompt, (answer) => {
            r.close();
            resolve(answer);
        });

        r.on('SIGINT', () => {
            r.close();
            reject(new Error('Aborted by user'));
        });
        });
    }

// Passwort-Stärke prüfen
function checkPasswordStrength(password) {
    const checks = {
        length: password.length >= MIN_PASSWORD_LENGTH,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        numbers: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    const score = Object.values(checks).filter(check => check).length;
    
    return {
        score,
        checks,
        isStrong: score >= 4 && checks.length
    };
}

// Passwort-Stärke-Feedback
function getPasswordFeedback(strength) {
    const feedback = [];
    
    if (!strength.checks.length) {
        feedback.push('- Mindestens 8 Zeichen verwenden');
    }
    if (!strength.checks.uppercase) {
        feedback.push('- Mindestens einen Großbuchstaben verwenden');
    }
    if (!strength.checks.lowercase) {
        feedback.push('- Mindestens einen Kleinbuchstaben verwenden');
    }
    if (!strength.checks.numbers) {
        feedback.push('- Mindestens eine Zahl verwenden');
    }
    if (!strength.checks.special) {
        feedback.push('- Mindestens ein Sonderzeichen verwenden (!@#$%^&*...)');
    }
    
    return feedback;
}

// Passwort sicher eingeben (versteckt)
function securePasswordInput(prompt) {
    return new Promise((resolve, reject) => {
        // Non-interactive fallback
        if (!process.stdin.isTTY) {
            askQuestion(prompt).then(a => resolve(a || '')).catch(reject);
            return;
        }

        // Create a temporary readline interface that mutes output
        const rlHidden = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        // Override output to mask input with '*'
        const originalWrite = rlHidden._writeToOutput.bind(rlHidden);
        rlHidden._writeToOutput = function(stringToWrite) {
            // When the prompt or control characters are emitted, allow them through
            if (stringToWrite.startsWith(prompt) || /\u001b\[.*?m/.test(stringToWrite)) {
                originalWrite(stringToWrite);
            } else {
                const masked = stringToWrite.replace(/./g, '*');
                originalWrite(masked);
            }
        };

        rlHidden.question(prompt, (answer) => {
            // Clear the current line that may contain echoed plaintext
            try {
                // ANSI clear line and carriage return
                process.stdout.write('\x1b[2K\r');
                // Reprint prompt + masked input for visual feedback
                const masked = (answer || '').replace(/./g, '*');
                process.stdout.write(prompt + masked + '\n');
            } catch (e) {
                // ignore if terminal doesn't support
            }
            rlHidden.close();
            resolve(answer || '');
        });

        rlHidden.on('SIGINT', () => {
            rlHidden.close();
            reject(new Error('Aborted by user'));
        });
    });
}

// Haupt-Funktion
async function main() {
    console.log('='.repeat(60));
    console.log('SICHERES PASSWORT-HASHING-TOOL FÜR ADMIN-BENUTZER');
    console.log('='.repeat(60));
    console.log();
    
    console.log('SICHERHEITSHINWEISE:');
    console.log('- Verwenden Sie starke, einzigartige Passwörter');
    console.log('- Löschen Sie die Konsolen-Historie nach der Verwendung');
    console.log('- Führen Sie dieses Script nur auf sicheren Systemen aus');
    console.log('- Bewahren Sie Passwörter niemals im Klartext auf');
    console.log();
    
    try {
        // Passwort eingeben
        const password = await securePasswordInput('Geben Sie das Passwort ein: ');
        
        if (!password) {
            console.log('Fehler: Kein Passwort eingegeben');
            return;
        }
        
        // Passwort-Stärke prüfen
        const strength = checkPasswordStrength(password);
        
        console.log('\nPasswort-Stärke-Analyse:');
        console.log(`Score: ${strength.score}/5`);
        
        if (strength.isStrong) {
            console.log('Starkes Passwort');
        } else {
            console.log('Schwaches Passwort');
            console.log('\nVerbesserungsvorschläge:');
            getPasswordFeedback(strength).forEach(feedback => {
                console.log(feedback);
            });
        }
        
        // Frage ob fortfahren
        const answer = await askQuestion('\nMöchten Sie fortfahren? (j/n): ');
        if (answer.toLowerCase() !== 'j' && answer.toLowerCase() !== 'y') {
            console.log('Abgebrochen');
            return;
        }

        // Hash generieren
        console.log('\nGeneriere bcrypt-Hash...');
        console.log('(Dies kann einige Sekunden dauern)');

        const startTime = Date.now();
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const endTime = Date.now();

        console.log('\n' + '='.repeat(60));
        console.log('BCRYPT-HASH (Salt Rounds: ' + SALT_ROUNDS + ')');
        console.log('='.repeat(60));
        console.log(hash);
        console.log('='.repeat(60));
        console.log(`Generiert in: ${endTime - startTime}ms`);
        console.log();

        // SQL-Beispiel
        console.log('SQL-BEISPIEL:');
        console.log('INSERT INTO admins (username, password_hash, email, full_name, role, active) VALUES (');
        console.log(`    'admin',`);
        console.log(`    '${hash}',`);
        console.log(`    'admin@example.com',`);
        console.log(`    'System Administrator',`);
        console.log(`    'admin',`);
        console.log(`    1`);
        console.log(');');
        console.log();

        // Verifikation
        console.log('VERIFIKATION:');
        const isValid = await bcrypt.compare(password, hash);
        console.log(`Hash-Verifikation: ${isValid ? 'Erfolgreich' : 'Fehlgeschlagen'}`);
        console.log();

        console.log('WICHTIGE HINWEISE:');
        console.log('- Kopieren Sie den Hash in Ihr SQL-Script');
        console.log('- Löschen Sie dieses Terminal/diese Konsole nach der Verwendung');
        console.log('- Verwenden Sie den Hash nur für einen Admin-Benutzer');
        console.log('- Bewahren Sie das ursprüngliche Passwort sicher auf');
        console.log();
        
    } catch (error) {
        console.error('Fehler beim Generieren des Hashes:', error);
    }
}

// Script ausführen
main().catch(console.error);
