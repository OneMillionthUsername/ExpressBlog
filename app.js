// The app.js file contains the core logic of your Express application. It’s responsible for defining routes, middleware, and how requests should be handled.

/**
- Setting up Express: The app.js file creates and configures the Express application
- Handling Middleware: Middleware like express.json() is used for parsing incoming requests.
- Defining Routes: You define the routes that handle HTTP requests in this file.
- Exporting the App: The Express app is exported so it can be used in another file (like server.js) to run the application.
*/

// app.js

import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { EventEmitter } from 'events';
import logger, { loggerMiddleware } from "./middleware/loggerMiddleware.js";
import helmet from 'helmet';
import * as config from './config/config.js';
import * as middleware from './middleware/securityMiddleware.js';
import { requireDatabase } from './middleware/databaseMiddleware.js';
import { globalLimiter } from './utils/limiters.js';
import routes from './routes/routesExport.js';
import csrfProtection from './utils/csrf.js';

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

    waitForReady() {
        return new Promise((resolve) => {
            if (this.appReady) {
                resolve();
            } else {
                this.once('ready', resolve);
            }
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
    isMockDatabase
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

// ===========================================
// MIDDLEWARE
// ===========================================
// Helmet core + secure CSP (no 'unsafe-inline')
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdn.tiny.cloud",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://generativelanguage.googleapis.com"
        // Note: 'unsafe-inline' intentionally excluded for security
      ],
      styleSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://cdn.tiny.cloud"
        // Note: 'unsafe-inline' avoided when possible
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "blob:",
        "https://images.unsplash.com",
        "https://cdn.tiny.cloud",
        "https://avatars.githubusercontent.com",
        "https://cdn.jsdelivr.net"
      ],
      connectSrc: [
        "'self'",
        "https://generativelanguage.googleapis.com/v1beta/",
        "https://cdn.tiny.cloud/1/"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  hsts: config.IS_PRODUCTION ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// 2. Cookie Parser (required BEFORE CSRF!)
app.use(cookieParser());

// 3. CSRF-Schutz (needs cookies!)
app.use(csrfProtection);

// 4. Request-Parsing (with security limits)
app.use(express.json({ limit: "100kb" }));  // Reduced from default for DoS protection
app.use(express.urlencoded({
    extended: true,
    inflate: true,
    limit: "100kb",  // Reduced from 1mb for DoS protection
    parameterLimit: 1000,  // Reduced from 5000
    type: "application/x-www-form-urlencoded",
  })
);

// 5. Input-Sanitization (NACH json parsing!)
app.use(middleware.createEscapeInputMiddleware(['content', 'description']));

// 6. Rate Limiting
app.use(globalLimiter);

// 7. Basis-Konfiguration
app.set('trust proxy', false);
app.use(loggerMiddleware);
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// 8. Statische Dateien (brauchen keine DB)
app.use(express.static(publicDirectoryPath, {
  setHeaders: (res, path) => {
    if (path.includes('/assets/js/tinymce/') || path.includes('/node_modules/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// 9. Health Check (funktioniert IMMER, auch ohne DB)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: appStatus.isDatabaseReady() ? 'ready' : 'initializing',
        app: appStatus.isReady() ? 'ready' : 'initializing'
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
    
    // Alle DB-abhängigen Routes mit DB-Check (Reihenfolge wichtig!)
    app.use('/', routes.staticRouter);    // TEMP: Ohne requireDatabase!
    
    app.use('/', routes.utilityRouter);   // TEMP: Ohne requireDatabase!
    
    app.use('/auth', requireDatabase, routes.authRouter);
    app.use('/blogpost', requireDatabase, routes.postRouter);
    app.use('/upload', requireDatabase, routes.uploadRouter);
    app.use('/comments', requireDatabase, routes.commentsRouter);
    
    // 404 handler MUST be registered AFTER all routes
    app.use((req, res, next) => {
        res.status(404).send("Sorry, can't find that!");
    });
    
    // Error handler MUST be registered AFTER 404 handler
    app.use((err, req, res, next) => {
        res.status(500).json({ message: err.message });
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
        name: error.name
    });
    console.error('Full error object:', error);
    process.exit(1);
});

// ===========================================
// PUBLIC ENDPOINTS
// ===========================================

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
        timestamp: new Date().toISOString()
    };
}

// Export appStatus for middleware usage
export { appStatus };

// ===========================================
// ERROR HANDLING & FALLBACKS
// ===========================================

// HTTP zu HTTPS Redirect (Plesk-kompatibel) - API-Routen ausgeschlossen
app.use((req, res, next) => {
    // API-Routen von HTTPS-Redirect ausschließen
    if (req.url.startsWith('/auth/') || 
    req.url.startsWith('/extension/') || 
    req.url.startsWith('/blogpost') || 
    req.url.startsWith('/comments/') || 
    req.url.startsWith('/upload/')) {
        return next(); // Kein Redirect für API-Calls
    }
    // Plesk verwendet x-forwarded-proto Header
    if (config.IS_PLESK && req.header('x-forwarded-proto') === 'http') {
        // Nur GET-Requests umleiten, POST/PUT/DELETE über HTTP ablehnen
        if (req.method === 'GET') {
            return res.redirect(301, `https://${req.header('host')}${req.url}`);
        } else {
            return res.status(400).json({
                error: 'HTTPS required',
                message: 'API endpoints require HTTPS connection'
            });
        }
    } 
    next();
});

// Error-Handling Middleware (MUSS am Ende stehen!)
app.use(middleware.errorHandlerMiddleware);

// Export the app to be used by the server
export default app;