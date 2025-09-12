// Phase 3: App mit Database + Basic Middleware (ohne Security)
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendFileSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File-Logging
function logToFile(message) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    appendFileSync(join(__dirname, 'middleware-debug.log'), logEntry);
    console.log(logEntry.trim());
  } catch (error) {
    console.error('Logging failed:', error);
  }
}

logToFile('=== Testing App with Basic Middleware ===');

const app = express();

// Import database functions
logToFile('Importing database module...');
let dbModule;
try {
  const module = await import('./databases/mariaDB.js');
  dbModule = module;
  logToFile('SUCCESS: Database module imported successfully');
} catch (error) {
  logToFile(`FAILED: Database module import failed: ${error.message}`);
  process.exit(1);
}

// Test database initialization
logToFile('Testing database initialization...');
try {
  await dbModule.initializeDatabase();
  logToFile('SUCCESS: Database initialized');
  
  const connected = await dbModule.testConnection();
  logToFile(`SUCCESS: Database connection test: ${connected}`);
  
  if (connected) {
    await dbModule.initializeDatabaseSchema();
    logToFile('SUCCESS: Database schema initialized');
  }
} catch (error) {
  logToFile(`FAILED: Database initialization failed: ${error.message}`);
}

// Basic Middleware (NO SECURITY YET)
logToFile('Adding basic middleware...');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
const publicDirectoryPath = join(__dirname, 'public');
app.use(express.static(publicDirectoryPath));

// EJS Setup
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

logToFile('Basic middleware added successfully');

// Test Routes with Database
app.get('/', async (req, res) => {
  logToFile('ROOT route called with database test');
  try {
    // Test a simple database query
    const result = await dbModule.getAllPosts();
    logToFile(`Database query result: ${Array.isArray(result) ? result.length : 'no'} posts`);
    
    res.render('index', { 
      title: 'Database + Middleware Test',
      message: `Database connected! Found ${Array.isArray(result) ? result.length : 0} posts.`
    });
    logToFile('SUCCESS: ROOT route: success with database');
  } catch (error) {
    logToFile(`FAILED:   ROOT route: database error - ${error.message}`);
    res.status(500).json({
      error: 'Database query failed',
      message: error.message
    });
  }
});

app.get('/health', async (req, res) => {
  logToFile('HEALTH route with database status');
  try {
    const connected = await dbModule.testConnection();
    res.json({ 
      status: 'healthy',
      database: connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'error',
      error: error.message
    });
  }
});

app.get('/posts', async (req, res) => {
  logToFile('POSTS route called');
  try {
    const posts = await dbModule.getAllPosts();
    logToFile(`SUCCESS: Posts retrieved: ${Array.isArray(posts) ? posts.length : 'none'}`);
    res.json({
      success: true,
      count: Array.isArray(posts) ? posts.length : 0,
      posts: posts || []
    });
  } catch (error) {
    logToFile(`FAILED: Posts route error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/cards', async (req, res) => {
  logToFile('CARDS route called');
  try {
    const cards = await dbModule.getAllCards();
    logToFile(`SUCCESS: Cards retrieved: ${Array.isArray(cards) ? cards.length : 'none'}`);
    res.json({
      success: true,
      count: Array.isArray(cards) ? cards.length : 0,
      cards: cards || []
    });
  } catch (error) {
    logToFile(`Cards route error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handlers
app.use((error, req, res, next) => {
  logToFile(`ERROR: ${error.message}`);
  logToFile(`Stack: ${error.stack}`);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: error.message,
    url: req.url
  });
});

app.use((req, res) => {
  logToFile(`404 - Route not found: ${req.url}`);
  res.status(404).json({ error: 'Not Found', url: req.url });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, (error) => {
  if (error) {
    logToFile(`Server start FAILED: ${error.message}`);
    process.exit(1);
  }
  logToFile(`Middleware test server running on port ${PORT}`);
});

process.on('uncaughtException', (error) => {
  logToFile(`UNCAUGHT EXCEPTION: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`);
  process.exit(1);
});