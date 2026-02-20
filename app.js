// The app.js file contains the core logic of your Express application. It’s responsible for defining routes, middleware, and how requests should be handled.

/**
- Setting up Express: The app.js file creates and configures the Express application
- Handling Middleware: Middleware like express.json() is used for parsing incoming requests.
- Defining Routes: You define the routes that handle HTTP requests in this file.
- Exporting the App: The Express app is exported so it can be used in another file (like server.js) to run the application.
*/

// app.js

import express from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { EventEmitter } from 'events';
import logger, { loggerMiddleware } from './middleware/loggerMiddleware.js';
import helmet from 'helmet';
import * as config from './config/config.js';
import * as middleware from './middleware/securityMiddleware.js';
import { requireDatabase } from './middleware/databaseMiddleware.js';
import { globalLimiter } from './utils/limiters.js';
import routes from './routes/routesExport.js';
import createDbRouter from './routes/dbRouter.js';
import aiRoutes from './routes/aiRoutes.js';
import nonceMiddleware from './middleware/nonceMiddleware.js';
import compression from 'compression';
import { authenticateToken, requireAdmin } from './middleware/authMiddleware.js';
import * as authService from './services/authService.js';
import { errors as celebrateErrors } from 'celebrate';
import legalRoutes from './routes/legalRoutes.js';

// App-Status Management
class AppStatus extends EventEmitter {
  constructor() {
    super();
    this.dbReady = false;
    this.appReady = false;
  }

  setDatabaseReady() {
    this.dbReady = true;
    this.checkAppReady();
    logger.info('Database is ready');
  }

  checkAppReady() {
    if (this.dbReady && !this.appReady) {
      this.appReady = true;
      this.emit('ready');
      logger.info('App is fully ready and operational');
    }
  }

  isReady() {
    return this.appReady;
  }

  isDatabaseReady() {
    return this.dbReady;
  }

  waitForReady(timeouts = 30000) {
    return new Promise((resolve, reject) => {
      if (this.appReady) {
        return resolve();
      } 
      const onReady = (...args) => {
        clearTimeout(timer);
        resolve(args.length ? args[0] : undefined);
      };
      this.once('ready', onReady);
      const timer = setTimeout(() => {
        this.removeListener('ready', onReady);
        reject(new Error('waitForReady timed out'));
      }, timeouts);
    });
  }
}

const appStatus = new AppStatus();

// Validating critical vars
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  logger.error('Missing required environment variables', { missingVars });
  logger.error('Create .env file with these variables before starting the server');
  process.exit(1);
}

// Database-integration
import { 
  initializeDatabase,
  testConnection, 
  initializeDatabaseSchema,
  isMockDatabase,
} from './databases/mariaDB.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDirectoryPath = join(__dirname, 'public');

// globals
//--------------------------------------------  
logger.debug('Logger system initialized - DEBUG level active');
logger.debug('Test debug message - if you see this, debug logging works!');
logger.debug(`__dirname: ${__dirname}`);
logger.debug(`publicDirectoryPath: ${publicDirectoryPath}`);

const app = express();

// Expose a stable asset version to templates for cache-busting client imports
let __assetVersion = process.env.ASSET_VERSION || '';
if (!__assetVersion) {
  try {
    const pkgJsonPath = join(__dirname, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    if (pkg && pkg.version) __assetVersion = String(pkg.version);
  } catch { /* ignore */ }
}
if (!__assetVersion) {
  // Fallback: server start timestamp (changes on each deploy)
  __assetVersion = String(Math.floor(Date.now() / 1000));
}
app.use((req, res, next) => {
  res.locals.assetVersion = __assetVersion;
  next();
});

// ===========================================
// MIDDLEWARE
// ===========================================
// Helmet core + secure CSP (no 'unsafe-inline')
// Trust the first proxy hop in all environments.
// In production: Nginx on the VPS forwards X-Forwarded-For / X-Real-IP.
// In development: Nginx runs as a Docker service (non-loopback IP), so 'loopback' would
// prevent Express from reading X-Forwarded-For. Using 1 trusts exactly one proxy hop.
app.set('trust proxy', 1);
// Helmet für SEO-Files überspringen
app.use((req, res, next) => {
  if (req.path === '/robots.txt' || req.path === '/sitemap.xml') {
    res.removeHeader('Content-Security-Policy');
  }
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: [
        '\'self\'',
        'https://cdn.tiny.cloud',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://generativelanguage.googleapis.com',
        // Nonce wird dynamisch hinzugefügt für Inline-Scripts
      ],
      styleSrc: [
        '\'self\'',
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://cdn.tiny.cloud',
        '\'unsafe-inline\'',
        // Note: 'unsafe-inline' avoided when possible
      ],
      fontSrc: [
        '\'self\'',
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com',
      ],
      imgSrc: [
        '\'self\'', 
        'data:', 
        'blob:',
        'https:',
        'https://images.unsplash.com',
        'https://cdn.tiny.cloud',
        'https://avatars.githubusercontent.com',
        'https://cdn.jsdelivr.net',
      ],
      connectSrc: [
        '\'self\'',
        'https://generativelanguage.googleapis.com/v1beta/',
        'https://cdn.tiny.cloud/1/',
        'https://formspree.io',
      ],
      // Allow TinyMCE editor iframe (same-origin) and safe blob/data contexts
      // Old value was ['none'], which prevented TinyMCE from rendering its editor iframe
      frameSrc: ['\'self\'', 'blob:', 'data:'],
      childSrc: ['\'self\'', 'blob:', 'data:'],
      objectSrc: ['\'none\''],
      baseUri: ['\'self\''],
      formAction: ['\'self\'', 'https://formspree.io'],
      frameAncestors: ['\'none\''],
      scriptSrcAttr: ['\'unsafe-hashes\'', '\'unsafe-inline\''],
    },
  },
  hsts: config.IS_PRODUCTION ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Nonce-Middleware für sichere Inline-Scripts
app.use(nonceMiddleware);

// Enable gzip/deflate compression for responses
app.use(compression());

// 2. Cookie Parser
app.use(cookieParser());
// Inject admin flag for all SSR templates based on auth cookie/header
app.use((req, res, next) => {
  let isAdmin = false;
  try {
    const token = authService.extractTokenFromRequest(req);
    if (token) {
      const decoded = authService.verifyToken(token);
      if (decoded && decoded.isAdmin) isAdmin = true;
    }
  } catch { /* ignore token errors */ }
  res.locals.isAdmin = isAdmin;
  next();
});
// 3. Request-Parsing (with security limits)
app.use(express.json({ limit: config.JSON_BODY_LIMIT }));  // Configurable limit for DoS protection
app.use(express.urlencoded({
  extended: true,
  inflate: true,
  limit: config.URLENCODED_BODY_LIMIT,  // Configurable limit for DoS protection
  parameterLimit: 1000,  // Reduced from 5000
  type: 'application/x-www-form-urlencoded',
}));

// 4. Input-Sanitization (NACH json parsing!)
app.use(middleware.createEscapeInputMiddleware(['content', 'description']));

// 6. Rate Limiting (statische Dateien ausgenommen)
app.use((req, res, next) => {
  // Rate Limiting für statische Assets überspringen
  if (req.url.startsWith('/assets/') || 
      req.url.startsWith('/public/') ||
      req.url.includes('.js') ||
      req.url.includes('.css') ||
      req.url.includes('.ico') ||
      req.url.includes('.png') ||
      req.url.includes('.jpg') ||
      req.url.includes('.jpeg') ||
      req.url.includes('.svg')) {
    return next();
  }
  // Rate Limiting nur für dynamische Inhalte
  return globalLimiter(req, res, next);
});

// 7. Basis-Konfiguration
app.use(loggerMiddleware);
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

import ejsLayouts from 'express-ejs-layouts';
app.use(ejsLayouts);
app.set('layout', 'layout');
// 7.5. Explizite MIME-Type-Behandlung für kritische statische Dateien
app.get(/\.(js|css)$/, (req, res, next) => {
  if (req.url.endsWith('.js')) {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  } else if (req.url.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
  }
  // Allow cross-origin resource sharing for static JS/CSS so resources like `favicon.ico`
  // or third-party served assets don't get blocked by strict CORP rules.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// 8. Statische Dateien (brauchen keine DB)
app.use('/', legalRoutes);
app.use(express.static(publicDirectoryPath, {
  setHeaders: (res, path) => {
    // Kein CSP für SEO-relevante Dateien, damit sie von Suchmaschinen gecrawlt werden können
    if (path.endsWith('robots.txt') || path.endsWith('sitemap.xml')) {
      res.removeHeader('Content-Security-Policy');
    }
    // Cross-Origin-Resource-Policy für alle statischen Dateien
    // Relax CORP for static assets served by this Express app so clients on other origins
    // (or reverse proxies) can fetch favicon.ico, images, JS, etc., without being blocked.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // MIME-Type für JavaScript-Dateien explizit setzen
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    }
    // MIME-Type für CSS-Dateien
    else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    
    // Cache-Control für verschiedene Dateitypen
    if (path.includes('/node_modules/')) {
      // Third-party libraries can be cached long-term (fingerprinted by version)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (path.includes('/assets/js/tinymce/')) {
      // Cache editor assets longer; cache-busting is handled via versioned query param (?v=...)
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days
    } else if (path.includes('.ico') || path.includes('.png') || path.includes('.jpg') || path.includes('.jpeg')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 Tag für Bilder
    }
  },
}));

// 9. Health Check (funktioniert IMMER, auch ohne DB)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: appStatus.isDatabaseReady() ? 'ready' : 'initializing',
    app: appStatus.isReady() ? 'ready' : 'initializing',
  });
});

// Datenbank initialisieren
async function initializeApp() {
  try {
    logger.info('Initializing database...');
    await initializeDatabase();
    logger.info('Database pool initialized');
    
    // Datenbankverbindung testen
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.warn('Database connection failed! Continuing in MOCK mode for development.');
      logger.warn('Note: Database-dependent features will not work properly.');
      // DON'T exit - continue with mock mode
    } else {
      logger.info('Database connection established');
    }
    
    // Schema erstellen (nur wenn DB verbunden)
    if (dbConnected) {
      logger.info('Initializing database schema...');
      const schemaCreated = await initializeDatabaseSchema();
      if (!schemaCreated) {
        logger.error('Database schema could not be created! Server will exit.');
        process.exit(1);
      }
      logger.info('Database schema initialized');
    } else {
      logger.warn('Skipping schema initialization - using mock mode');
    }
    
    // Info über DB-Modus
    if (isMockDatabase()) {
      logger.info('Datenbank im Mock-Modus - keine echte Verbindung');
    } else {
      logger.info('Echte Datenbankverbindung aktiv');
    }
    
    // WICHTIG: DB ist bereit - Status updaten
    appStatus.setDatabaseReady();
    logger.info('Database successfully initialized');
    
    // Jetzt DB-abhängige Routes registrieren
    registerDatabaseRoutes();
    
  } catch (error) {
    logger.error('Error in initializeApp:', error);
    throw error; // Re-throw the error so it can be caught by the caller
  }
}

// DB-abhängige Routes (werden erst nach DB-Init registriert)
function registerDatabaseRoutes() {
  logger.info('Registering database-dependent routes...');
  
  // Build the grouped DB router in routes/ and mount it here after DB init.
  const dbRouter = createDbRouter(requireDatabase, routes);
  app.use('/', dbRouter);
  
  // Celebrate validation error handler should be before 404 and other error handlers
  app.use(celebrateErrors());
  
  
  // 404 handler MUST be registered AFTER all routes
  app.use((req, res, _next) => {
    res.status(404).render('error', {message: 'Seite nicht gefunden'});
    //send('Sorry, can\'t find that!');
  });
    
  // Error handler MUST be registered AFTER 404 handler
  app.use((err, req, res, _next) => {
    res.status(500).render('error', {message: err.message});
  });
    
  logger.info('Database-dependent routes registered');
}

// App initialisieren (asynchron)
initializeApp().then(() => {
  logger.info('App initialization completed successfully');
}).catch((error) => {
  logger.error('App initialization failed:', error);
  logger.error('Error details:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });
  console.error('Full error object:', error);
  process.exit(1);
});

// ===========================================
// PUBLIC ENDPOINTS
// ===========================================

// Mount AI proxy early (route itself enforces admin auth)
app.use('/api/ai', aiRoutes);

// Mount utility routes under /api for consistent API structure
app.use('/api', routes.utilityRouter);

// Temporary diagnostic endpoint to help debug header forwarding issues in
// production (e.g. proxies/CDNs that strip Accept or X-Requested-With).
// This endpoint intentionally masks sensitive headers (cookies, authorization)
// and also returns a small whitelist of headers that are most relevant.
app.get('/debug/headers', authenticateToken, requireAdmin, (req, res) => {
  try {
    const masked = { ...req.headers };
    if (masked.cookie) masked.cookie = '[REDACTED]';
    if (masked.authorization) masked.authorization = '[REDACTED]';
    // Whitelist of headers helpful for diagnosing content-negotiation issues
    const whitelist = {
      accept: req.get('accept') || null,
      'x-requested-with': req.get('x-requested-with') || null,
      'user-agent': req.get('user-agent') || null,
      host: req.get('host') || null,
      referer: req.get('referer') || null,
      'x-forwarded-proto': req.get('x-forwarded-proto') || null,
    };

    return res.json({
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      headers: { masked, whitelist },
    });
  } catch (err) {
    return res.status(500).json({ error: 'diagnostic endpoint error', message: String(err) });
  }
});


// Nur sichere, öffentliche APIs exportieren
export function isAppReady() {
  return appStatus.isReady();
}

export function isDatabaseReady() {
  return appStatus.isDatabaseReady();
}

export function waitForApp() {
  return appStatus.waitForReady();
}

export function getAppStatus() {
  return {
    ready: appStatus.isReady(),
    database: appStatus.isDatabaseReady(),
    timestamp: new Date().toISOString(),
  };
}

// Export appStatus for middleware usage
export { appStatus };

// ===========================================
// ERROR HANDLING & FALLBACKS
// ===========================================

// HTTP zu HTTPS Redirect (Plesk-kompatibel) - API-Routen und statische Dateien ausgeschlossen
// app.use((req, res, next) => {
//   // API-Routen und statische Assets von HTTPS-Redirect ausschließen
//   if (req.url.startsWith('/auth/') || 
//     req.url.startsWith('/extension/') || 
//     req.url.startsWith('/blogpost') || 
//     req.url.startsWith('/comments/') || 
//     req.url.startsWith('/upload/') ||
//     req.url.startsWith('/assets/') || 
//     req.url.startsWith('/public/') ||
//     req.url.includes('.js') ||
//     req.url.includes('.css') ||
//     req.url.includes('.ico')) {
//     return next(); // Kein Redirect für API-Calls und statische Dateien
//   }
//   // Plesk verwendet x-forwarded-proto Header
//   if (config.IS_PLESK && req.header('x-forwarded-proto') === 'http') {
//     // Nur GET-Requests umleiten, POST/PUT/DELETE über HTTP ablehnen
//     if (req.method === 'GET') {
//       return res.redirect(301, `https://${req.header('host')}${req.url}`);
//     } else {
//       return res.status(400).json({
//         error: 'HTTPS required',
//         message: 'API endpoints require HTTPS connection',
//       });
//     }
//   } 
//   next();
// });

// Error-Handling Middleware (MUSS am Ende stehen!)
app.use(middleware.errorHandlerMiddleware);


// Export the app to be used by the server
export default app;