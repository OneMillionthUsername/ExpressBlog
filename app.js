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
//import { unlink as unlinkAsync } from 'fs/promises';
import logger, { loggerMiddleware } from "./middleware/loggerMiddleware.js";
import helmet from 'helmet';
import * as config from './config/config.js';
import * as middleware from './middleware/securityMiddleware.js';
//import rateLimit from 'express-rate-limit';
import { globalLimiter } from './utils/limiters.js';
import routes from './routes/routesExport.js';
import csrfProtection from './utils/csrf.js';

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
    testConnection, 
    initializeDatabase, 
    DatabaseService 
} from './databases/mariaDB.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDirectoryPath = join(__dirname, 'public'); // Ein Ordner nach oben
const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
// globals
//--------------------------------------------
logger.info(`Server mode: ${config.IS_PRODUCTION ? 'Production' : 'Development'}`);
logger.info(`Plesk integration: ${config.IS_PLESK ? 'Enabled' : 'Disabled'}`);
logger.info(`JSON body limit: ${config.JSON_BODY_LIMIT}`);
logger.info(`URL-encoded body limit: ${config.URLENCODED_BODY_LIMIT}`);
logger.debug('Logger system initialized - DEBUG level active');
logger.debug('Test debug message - if you see this, debug logging works!');

const app = express();

//const commentsRouter = express.Router();
// Datenbank initialisieren
async function initializeApp() {
  console.log('Initializing database...');
  // Datenbankverbindung testen
  const dbConnected = await testConnection();
  if (!dbConnected) {
      console.error('Database connection failed! Server will exit.');
      process.exit(1);
  }
  // Schema erstellen
  const schemaCreated = await initializeDatabase();
  if (!schemaCreated) {
      console.error('Database schema could not be created! Server will exit.');
      process.exit(1);
  }
  console.log('Database successfully initialized');
}

// App initialisieren (asynchron)
initializeApp().then(() => {
    console.log('Server initialized successfully');
}).catch((error) => {
    console.error('Server initialization failed:', error);
});

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
        //'unsafe-inline'!
      ],
      styleSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://cdn.tiny.cloud",
        //"'unsafe-inline'" // Nur für Styles, falls unbedingt nötig
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://generativelanguage.googleapis.com",
        "https://cdn.tiny.cloud"
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

app.use(middleware.createEscapeInputMiddleware(['content', 'description']));

// ensure other endpoints use requireJsonContent(req,res) if they expect JSON
app.use(express.json());
app.use(express.urlencoded({
    extended: true,
    inflate: true,
    limit: "1mb",
    parameterLimit: 5000,
    type: "application/x-www-form-urlencoded",
  })
);
app.use(cookieParser());
app.set('trust proxy', false); // Damit Express die korrekte IP-Adresse des Clients hinter einem Reverse Proxy erkennt. Lokal muss es false sein!
app.use(loggerMiddleware);


app.use(csrfProtection);
app.use(globalLimiter);
app.use(middleware.errorHandlerMiddleware);
app.set('view engine', 'ejs');
// Statische Dateien mit korrekten MIME-Types
app.use(express.static(publicDirectoryPath, {
  setHeaders: (res, path) => {
    if (path.includes('/assets/js/tinymce/') || path.includes('/node_modules/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));
  
  // ===========================================
  // PUBLIC ENDPOINTS
  // ===========================================
  
  // Health Check Endpoint
app.use('/', routes.utilityRouter);
app.use('/', routes.staticRouter);

app.use('/auth', routes.authRouter);
app.use('/blogpost', routes.postRouter);
app.use('/upload', routes.uploadRouter);
app.use('/comments', routes.commentsRouter);

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
    // Development HTTPS Redirect
    // else if (!config.IS_PLESK && httpsOptions && req.header('x-forwarded-proto') !== 'https' && !req.secure) {
    //     if (req.method === 'GET') {
    //         return res.redirect(301, `https://${req.header('host')}${req.url}`);
    //     } else {
    //         return res.status(400).json({
    //             error: 'HTTPS required',
    //             message: 'API endpoints require HTTPS connection'
    //         });
    //     }
    // }
    next();
});
// Custom error-handling
// custom 404
app.use((req, res, next) => {
  res.status(404).send("Sorry, can't find that!");
});
// custom 500
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});
// Export the app to be used by the server
export default app;