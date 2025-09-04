//The server.js file is responsible for configuring and starting the server. It imports the Express app from app.js, sets the port, and tells the app to listen for incoming requests.
/**
 *
- Importing the Express App: It imports the app created in app.js.
- Setting Up the Port: The server listens on a specific port (e.g., 3000).
- Starting the Server: The server is started using app.listen() to handle incoming requests.
- Logging the Server Status: It logs a message when the server starts successfully.
 */

//server.js
import http from 'http';
import https from 'https';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as config from './config/config.js';
import app from './app.js'; 
import logger from './utils/logger.js';
import { readFileSync } from 'fs';
import { initializeDatabase } from './databases/mariaDB.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===========================================
// SERVER CONFIGURATION & STARTUP
// ===========================================

// Global server references for graceful shutdown
let httpServer = null;
let httpsServer = null;

// SSL Configuration
function loadSSLCertificates() {
    if (config.IS_PLESK || config.IS_PRODUCTION) {
        return null; // SSL handled by Plesk/webserver
    }
    
    try {
        const sslPath = join(__dirname, 'ssl');
        const httpsOptions = {
            key: readFileSync(join(sslPath, 'private-key.pem')),
            cert: readFileSync(join(sslPath, 'certificate.pem'))
        };
        logger.info('SSL certificates loaded successfully (Development)');
        return httpsOptions;
    } catch (error) {
        logger.warn('SSL certificates not found - HTTP only available');
        logger.warn('Run "node ssl/generate-certs.js" to enable HTTPS');
        return null;
    }
}
// Main server startup function
async function startServer() {
    try {
        // Initialize database first
        await initializeDatabase();
        logger.info('Database initialized successfully');
        
        // Load SSL certificates if needed
        const httpsOptions = loadSSLCertificates();
        
        // Log server configuration
        logServerConfiguration();
        
        // Start HTTP server
        await startHTTPServer();
        
        // Start HTTPS server if certificates are available
        if (!config.IS_PLESK && httpsOptions) {
            await startHTTPSServer(httpsOptions);
        }
        
        // Setup graceful shutdown handlers
        setupGracefulShutdown();
        
        logger.info('Server startup completed successfully');
        
    } catch (error) {
        logger.error(`Error starting server: ${error.message}`, error);
        console.error(`Error starting server: ${error.message}`);
        process.exit(1);
    }
}
// Start HTTP server
function startHTTPServer() {
    return new Promise((resolve, reject) => {
        httpServer = http.createServer(app);
        
        // Configure server timeouts
        httpServer.setTimeout(30000);
        httpServer.headersTimeout = 31000;
        
        httpServer.listen(config.PORT, config.HOST, () => {
            const protocol = config.IS_PRODUCTION ? 'https' : 'http';
            const domain = config.DOMAIN || 'localhost';
            const displayPort = (protocol === 'http' && config.PORT === 80) || 
                              (protocol === 'https' && config.PORT === 443) ? '' : `:${config.PORT}`;

            logger.info(`HTTP Server running on ${config.HOST}:${config.PORT}`);
            logger.info(`Server erreichbar unter: ${protocol}://${domain}${displayPort}`);
            
            if (config.IS_PRODUCTION || config.IS_PLESK) {
                logger.info('Production mode: SSL handled by Plesk/webserver');
            } else {
                logger.info('Development mode: HTTP server started');
            }
            
            resolve();
        });
        
        httpServer.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                const errorMsg = `Port ${config.PORT} bereits in Verwendung! Tipp: Verwende einen anderen Port mit PORT=xxxx`;
                logger.error(errorMsg);
                console.error(errorMsg);
            } else {
                logger.error('HTTP Server error:', error);
            }
            reject(error);
        });
    });
}
// Start HTTPS server (development only)
function startHTTPSServer(httpsOptions) {
    return new Promise((resolve, reject) => {
        httpsServer = https.createServer(httpsOptions, app);
        
        httpsServer.listen(config.HTTPS_PORT, config.HOST, () => {
            logger.info(`HTTPS Server running on https://${config.HOST}:${config.HTTPS_PORT}`);
            logger.info('SSL/TLS enabled - secure connection available');
            logger.info('Certificate: Self-signed for development (browser warning normal)');
            resolve();
        });
        
        httpsServer.on('error', (error) => {
            logger.error('HTTPS Server error:', error);
            reject(error);
        });
    });
}
// Log server configuration
function logServerConfiguration() {
    logger.info('=== Server Configuration ===');
    logger.info(`Environment: ${config.IS_PRODUCTION ? 'Production' : 'Development'}`);
    logger.info(`Plesk integration: ${config.IS_PLESK ? 'Enabled' : 'Disabled'}`);
    logger.info(`HTTP Port: ${config.PORT}`);
    logger.info(`HTTPS Port: ${config.HTTPS_PORT}`);
    logger.info(`Host: ${config.HOST}`);
    logger.info(`Domain: ${config.DOMAIN || 'not set'}`);
}// Graceful shutdown setup
function setupGracefulShutdown() {
    ['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach(signal => {
        process.on(signal, () => gracefulShutdown(signal));
    });
}
// Graceful Shutdown Handler
function gracefulShutdown(signal) {
    logger.info(`${signal} received - starting graceful shutdown...`);
    
    const shutdownPromises = [];
    
    if (httpServer) {
        shutdownPromises.push(
            new Promise((resolve) => {
                httpServer.close((err) => {
                    if (err) {
                        logger.error('Error closing HTTP server:', err);
                    } else {
                        logger.info('HTTP server closed');
                    }
                    resolve();
                });
            })
        );
    }
    
    if (httpsServer) {
        shutdownPromises.push(
            new Promise((resolve) => {
                httpsServer.close((err) => {
                    if (err) {
                        logger.error('Error closing HTTPS server:', err);
                    } else {
                        logger.info('HTTPS server closed');
                    }
                    resolve();
                });
            })
        );
    }
    
    Promise.all(shutdownPromises).then(() => {
        logger.info('All servers closed successfully');
        process.exit(0);
    }).catch((error) => {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}
// Start the server
startServer();
/**
Keep routes modular: Separate routes based on features or entities (e.g., userRoutes, productRoutes).

Use environment variables: Store sensitive information like API keys or database credentials in .env files and access them via process.env.

Error Handling: Implement centralized error handling middleware to catch and respond to errors.

Write Tests: Maintain a separate folder (tests/) for unit and integration tests to ensure your app works as expected.

Follow REST principles: If you're building an API, ensure your routes follow RESTful conventions (e.g., GET /users, POST /users). 
*/
