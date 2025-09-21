// Debugging-Version: App ohne Database
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File-Logging für Debug
function logToFile(message) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    appendFileSync(join(__dirname, 'app-debug.log'), logEntry);
    console.log(logEntry.trim());
  } catch (error) {
    console.error('Logging failed:', error);
  }
}

logToFile('=== Starting minimal app debug ===');

const app = express();

// Basis-Middleware (wie in deiner App)
logToFile('Adding basic middleware...');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statische Dateien
const publicDirectoryPath = join(__dirname, 'public');
logToFile(`Setting up static files: ${publicDirectoryPath}`);
app.use(express.static(publicDirectoryPath));

// EJS Setup
logToFile('Setting up EJS...');
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// Test-Routen
app.get('/', (req, res) => {
  logToFile('ROOT route called - testing EJS render');
  try {
    res.render('index', { 
      title: 'Debug Test',
      message: 'App läuft ohne Database!', 
    });
    logToFile('ROOT route: EJS render successful');
  } catch (error) {
    logToFile(`ROOT route: EJS render failed - ${error.message}`);
    res.status(500).json({ 
      error: 'Template error', 
      message: error.message,
      stack: error.stack,
    });
  }
});

app.get('/health', (req, res) => {
  logToFile('HEALTH route called');
  res.json({ 
    status: 'healthy - no database',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.get('/debug-info', (req, res) => {
  logToFile('DEBUG-INFO route called');
  res.json({
    __dirname,
    publicPath: publicDirectoryPath,
    viewsPath: join(__dirname, 'views'),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      platform: process.platform,
      nodeVersion: process.version,
    },
  });
});

// Error-Handler
app.use((error, _req, _res, _next) => {
  logToFile(`ERROR: ${error.message}`);
  logToFile(`ERROR stack: ${error.stack}`);
  // Not sending response in test helper
});

// 404-Handler
app.use((req, res) => {
  logToFile(`404 - Route not found: ${req.url}`);
  res.status(404).json({ error: 'Not Found', url: req.url });
});

const PORT = process.env.PORT || 3000;

logToFile(`Starting server on port ${PORT}...`);

app.listen(PORT, (error) => {
  if (error) {
    logToFile(`Server start FAILED: ${error.message}`);
    process.exit(1);
  }
  logToFile(`Minimal app debug server running on port ${PORT}`);
});

// Error-Handler
process.on('uncaughtException', (error) => {
  logToFile(`UNCAUGHT EXCEPTION: ${error.message}`);
  logToFile(`Stack: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`);
  process.exit(1);
});