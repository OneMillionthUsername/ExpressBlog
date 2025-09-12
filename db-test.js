// Phase 2: App mit Database-Test (ohne komplexe Middleware)
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File-Logging
function logToFile(message) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    appendFileSync(join(__dirname, 'db-debug.log'), logEntry);
    console.log(logEntry.trim());
  } catch (error) {
    console.error('Logging failed:', error);
  }
}

logToFile('=== Testing Database Integration ===');

const app = express();

// Basic Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// Test Database-Import
logToFile('Testing database imports...');
try {
  // Import dotenv first
  logToFile('Importing dotenv...');
  const dotenv = await import('dotenv');
  dotenv.config();
  logToFile('dotenv imported successfully');

  // Test environment variables
  logToFile('Checking environment variables...');
  const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logToFile(`Missing environment variables: ${missingVars.join(', ')}`);
  } else {
    logToFile('All required environment variables present');
  }

  // Test MariaDB import
  logToFile('Importing MariaDB...');
  const mariadb = await import('mariadb');
  logToFile('MariaDB imported successfully');

  // Test Database connection
  logToFile('Testing database connection...');
  const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 1, // Minimal für Test
    acquireTimeout: 5000,
    timeout: 5000
  });

  const conn = await pool.getConnection();
  logToFile('Database connection successful');
  
  // Simple query test
  const result = await conn.query('SELECT 1 as test');
  logToFile(`Database query successful: ${JSON.stringify(result)}`);
  
  conn.release();
  pool.end();
  logToFile('Database connection closed');

} catch (error) {
  logToFile(`Database test failed: ${error.message}`);
  logToFile(`Stack: ${error.stack}`);
}

// Routes
app.get('/', (req, res) => {
  logToFile('ROOT route with database test');
  res.render('index', { 
    title: 'Database Test',
    message: 'Check db-debug.log for database test results' 
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy - database tested',
    timestamp: new Date().toISOString()
  });
});

app.get('/db-test', async (req, res) => {
  logToFile('DB-TEST route called');
  try {
    const mariadb = await import('mariadb');
    const pool = mariadb.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: 1,
      acquireTimeout: 5000,
      timeout: 5000
    });

    const conn = await pool.getConnection();
    const result = await conn.query('SELECT NOW() as current_time, DATABASE() as db_name');
    conn.release();
    pool.end();

    logToFile('✅ DB-TEST successful');
    res.json({ 
      status: 'success',
      result: result[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logToFile(`❌ DB-TEST failed: ${error.message}`);
    res.status(500).json({
      error: 'Database test failed',
      message: error.message
    });
  }
});

// Error handlers
app.use((error, req, res, next) => {
  logToFile(`ERROR: ${error.message}`);
  res.status(500).json({ error: 'Internal Server Error', message: error.message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', url: req.url });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, (error) => {
  if (error) {
    logToFile(`Server start FAILED: ${error.message}`);
    process.exit(1);
  }
  logToFile(`Database test server running on port ${PORT}`);
});

process.on('uncaughtException', (error) => {
  logToFile(`UNCAUGHT EXCEPTION: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`);
  process.exit(1);
});