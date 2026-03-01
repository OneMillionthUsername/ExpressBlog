/**
 * Application logger singleton.
 *
 * Writes logs into per-purpose files under `logs/` and also prints to
 * the console. Provides `error`, `warn`, `info`, `debug`, `access` and
 * `auth` helpers and performs daily rotation of files.
 */

import { createWriteStream, existsSync, mkdirSync, accessSync, constants } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_DIR = process.env.LOG_DIR || join(__dirname, '..', 'logs');

function ensureWritableLogDir(dirPath) {
  try {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    accessSync(dirPath, constants.W_OK);
    return true;
  } catch (error) {
    const uid = typeof process.getuid === 'function' ? process.getuid() : 'n/a';
    const gid = typeof process.getgid === 'function' ? process.getgid() : 'n/a';
    console.error(`[LOGGER] File logging disabled: cannot access log directory "${dirPath}" for writing.`);
    console.error(`[LOGGER] Runtime identity uid=${uid}, gid=${gid}.`);
    console.error(`[LOGGER] Reason: ${error.message}`);
    return false;
  }
}

const FILE_LOGGING_ENABLED = ensureWritableLogDir(LOG_DIR);
// Log-Level Definition
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

class Logger {
  constructor() {
    this.logStreams = {};
    this.initializeStreams();
  }

  initializeStreams() {
    if (!FILE_LOGGING_ENABLED) {
      this.logStreams = {};
      return;
    }

    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
    // Verschiedene Log-Dateien für verschiedene Zwecke
    this.logStreams = {
      error: createWriteStream(join(LOG_DIR, `error-${date}.log`), { flags: 'a' }),
      access: createWriteStream(join(LOG_DIR, `access-${date}.log`), { flags: 'a' }),
      application: createWriteStream(join(LOG_DIR, `app-${date}.log`), { flags: 'a' }),
      debug: createWriteStream(join(LOG_DIR, `debug-${date}.log`), { flags: 'a' }),
      auth: createWriteStream(join(LOG_DIR, `auth-${date}.log`), { flags: 'a' }),
    };

    // Fehlerbehandlung für Streams
    Object.values(this.logStreams).forEach(stream => {
      stream.on('error', (err) => {
        console.error('Log stream error:', err);
      });
    });
  }

  formatMessage(level, message, extra = null) {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;
        
    if (extra) {
      return `${baseMessage} ${JSON.stringify(extra, null, 2)}`;
    }
    return baseMessage;
  }

  shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[CURRENT_LOG_LEVEL];
  }

  writeToFile(streamName, message) {
    if (!FILE_LOGGING_ENABLED) return;
    if (this.logStreams[streamName]) {
      this.logStreams[streamName].write(message + '\n');
    }
  }

  // Haupt-Logging-Methoden
  error(message, extra = null) {
    const formatted = this.formatMessage('ERROR', message, extra);
        
    // In Konsole UND Datei schreiben
    console.error(formatted);
    this.writeToFile('error', formatted);
    this.writeToFile('application', formatted);
  }

  warn(message, extra = null) {
    if (!this.shouldLog('WARN')) return;
        
    const formatted = this.formatMessage('WARN', message, extra);
    console.warn(formatted);
    this.writeToFile('application', formatted);
  }

  info(message, extra = null) {
    if (!this.shouldLog('INFO')) return;
        
    const formatted = this.formatMessage('INFO', message, extra);
    console.log(formatted);
    this.writeToFile('application', formatted);
  }

  debug(message, extra = null) {
    if (!this.shouldLog('DEBUG')) return;
        
    const formatted = this.formatMessage('DEBUG', message, extra);
    console.log(formatted);
    this.writeToFile('debug', formatted);
    this.writeToFile('application', formatted);
  }

  // Spezielle Logging-Methoden
  access(method, url, status, responseTime, ip) {
    const message = `${ip} "${method} ${url}" ${status} ${responseTime}ms`;
    const formatted = this.formatMessage('ACCESS', message);
    this.writeToFile('access', formatted);
  }

  auth(message, user = null, ip = null) {
    const extra = {};
    if (user) extra.user = user;
    if (ip) extra.ip = ip;
        
    const formatted = this.formatMessage('AUTH', message, extra);
    console.log(formatted);
    this.writeToFile('auth', formatted);
    this.writeToFile('application', formatted);
  }

  // Dateirotation (täglich)
  rotateLogFiles() {
    if (!FILE_LOGGING_ENABLED) return;

    const currentDate = new Date().toISOString().split('T')[0];
    const expectedFile = join(LOG_DIR, `app-${currentDate}.log`);
        
    // Wenn Datum geändert hat, neue Streams erstellen
    if (!existsSync(expectedFile)) {
      Object.values(this.logStreams).forEach(stream => {
        stream.end();
      });
      this.initializeStreams();
    }
  }

  // Graceful shutdown
  close() {
    Object.values(this.logStreams).forEach(stream => {
      stream.end();
    });
  }
}
// Singleton Logger exportieren
const logger = new Logger();

// Tägliche Rotation
setInterval(() => {
  logger.rotateLogFiles();
}, 60 * 60 * 1000); // Jede Stunde prüfen

// Graceful shutdown handling
process.on('SIGTERM', () => logger.close());
process.on('SIGINT', () => logger.close());

export default logger;
