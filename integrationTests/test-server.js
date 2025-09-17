// Minimaler Test-Server für Plesk-Debugging
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { appendFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Einfaches File-Logging (falls normale Logs nicht funktionieren)
function logToFile(message) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    appendFileSync(join(__dirname, 'debug.log'), logEntry);
    console.log(logEntry.trim());
  } catch (error) {
    console.error('Logging failed:', error);
  }
}

const app = express();

// Grundlegende Middleware
app.use(express.json());

// Test-Routen
app.get('/', (req, res) => {
  logToFile('ROOT route called successfully');
  res.json({ 
    status: 'OK', 
    message: 'Test-Server läuft!',
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT || 3000,
      platform: process.platform,
      nodeVersion: process.version
    }
  });
});

app.get('/health', (req, res) => {
  logToFile('HEALTH route called');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/error-test', (req, res) => {
  logToFile('ERROR-TEST route called - throwing intentional error');
  throw new Error('Test-Error für Debugging');
});

// Error-Handler
app.use((error, req, res, next) => {
  logToFile(`ERROR caught: ${error.message}`);
  logToFile(`ERROR stack: ${error.stack}`);
  res.status(500).json({ 
    error: 'Server Error', 
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404-Handler
app.use((req, res) => {
  logToFile(`404 - Route not found: ${req.url}`);
  res.status(404).json({ error: 'Not Found', url: req.url });
});

const PORT = process.env.PORT || 3000;

// Server starten
logToFile('Starting test server...');
logToFile(`Environment: NODE_ENV=${process.env.NODE_ENV}`);
logToFile(`Port: ${PORT}`);
logToFile(`Platform: ${process.platform}`);
logToFile(`Node Version: ${process.version}`);

app.listen(PORT, (error) => {
  if (error) {
    logToFile(`Server start FAILED: ${error.message}`);
    process.exit(1);
  }
  logToFile(`Test-Server läuft auf Port ${PORT}`);
  logToFile('URLs zu testen:');
  logToFile(`- http://localhost:${PORT}/`);
  logToFile(`- http://localhost:${PORT}/health`);
  logToFile(`- http://localhost:${PORT}/error-test`);
});

// Uncaught Exception Handler
process.on('uncaughtException', (error) => {
  logToFile(`UNCAUGHT EXCEPTION: ${error.message}`);
  logToFile(`UNCAUGHT STACK: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logToFile(`UNHANDLED REJECTION at: ${promise}, reason: ${reason}`);
  process.exit(1);
});