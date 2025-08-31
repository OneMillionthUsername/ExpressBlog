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
import * as config from './config/config.js';
import app from './app.js'; 
import logger from './utils/logger.js';
import { readFileSync } from 'fs';

// ===========================================
// SERVER STARTEN
// ===========================================
// Plesk-Environment-Erkennung

console.log(`Server configuration:`);
console.log(`HTTP Port: ${config.PORT}`);
console.log(`HTTPS Port: ${config.HTTPS_PORT}`);
console.log(`Host: ${config.HOST}`);
console.log(`Domain: ${config.DOMAIN || 'not set'}`);

// SSL-Zertifikate nur in Development laden (Plesk übernimmt SSL in Production)
let httpsOptions = null;
if (!config.IS_PLESK && !config.IS_PRODUCTION) {
    logger.info('Loading SSL certificates for development...');
    try {
        const sslPath = join(__dirname, '..', 'ssl');
        httpsOptions = {
            key: readFileSync(join(sslPath, 'private-key.pem')),
            cert: readFileSync(join(sslPath, 'certificate.pem'))
        };
        console.log('SSL certificates loaded successfully (Development)');
        logger.info('SSL certificates loaded successfully (Development)');
    } catch (error) {
        console.warn('SSL certificates not found - HTTP only available');
        console.warn('Run "node ssl/generate-certs.js" to enable HTTPS');
        logger.warn('SSL certificates not found - HTTP only available');
        logger.warn('Run "node ssl/generate-certs.js" to enable HTTPS');
    }
} else {
    logger.info('Production mode: SSL handled by Plesk/webserver');
}

// HTTP Server (für Entwicklung und Redirects)
const httpServer = http.createServer(app);

// Server-Timeouts konfigurieren
httpServer.setTimeout(30000); // 30 Sekunden
httpServer.headersTimeout = 31000; // Etwas höher als setTimeout

httpServer.listen(config.PORT, config.HOST, () => {
    const protocol = config.IS_PRODUCTION || httpsOptions ? 'https' : 'http';
    const domain = process.env.DOMAIN || 'localhost';
    const displayPort = (protocol === 'http' && config.PORT === 80) || (protocol === 'https' && config.PORT === 443) ? '' : `:${config.PORT}`;

    console.log(`HTTP Server running on ${config.HOST}:${config.PORT}`);
    console.log(`Server erreichbar unter: ${protocol}://${domain}${displayPort}`);
    logger.info(`HTTP Server running on ${config.HOST}:${config.PORT}`);
    logger.info(`Server erreichbar unter: ${protocol}://${domain}${displayPort}`);

    if(config.IS_PRODUCTION) {
        logger.info('Production mode: SSL handled by Plesk/webserver');
    }
    else if (httpsOptions) {
        logger.info('Development mode: SSL enabled with self-signed certificates');
    }
    else {
        logger.info('Development mode: HTTP only - run "node ssl/generate-certs.js" to enable HTTPS');
    }

    if (config.IS_PLESK) {
        logger.info('Plesk mode: SSL handled by Plesk');
    } else if (!httpsOptions) {
        console.warn('HTTP only available - run "node ssl/generate-certs.js" for HTTPS')
        logger.warn('HTTP only available - run "node ssl/generate-certs.js" for HTTPS');
    }
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} bereits in Verwendung!`);
        console.error(`Tipp: Verwende einen anderen Port mit PORT=xxxx`);
        logger.error(`${PORT} bereits in Verwendung!`);
        logger.error(`Tipp: Verwende einen anderen Port mit PORT=xxxx`);
    } else {
        logger.error('Server-Fehler:', error);
    }
    process.exit(1);
});

// Graceful Shutdown Handler
function gracefulShutdown(signal) {
    console.log(`${signal} erhalten - starte Graceful Shutdown...`);
    logger.info(`${signal} erhalten - starte Graceful Shutdown...`);
    httpServer.close((err) => {
        if (err) {
            console.error('Fehler beim Schließen des HTTP-Servers:', err);
            logger.error('Fehler beim Schließen des HTTP-Servers:', err);
            process.exit(1);
        }

        logger.info('HTTP-Server geschlossen');
        logger.info('Server erfolgreich beendet');
        process.exit(0);
    });
}

// HTTPS Server nur in Development starten
if (!config.IS_PLESK && httpsOptions) {
    logger.info('Loading SSL certificates for development...');
    const httpsServer = https.createServer(httpsOptions, app);
    httpsServer.listen(config.HTTPS_PORT, config.HOST, () => {
        logger.info(`HTTPS Server running on https://${config.HOST}:${config.HTTPS_PORT}`);
        logger.info('SSL/TLS enabled - secure connection available');
        logger.info('Certificate: Self-signed for development (browser warning normal)');
        logger.info('JWT authentication enabled');
    });
    
    // Graceful shutdown für beide Server
    ['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach(signal => {
        process.on(signal, () => {
            logger.info(`${signal} erhalten - starte Graceful Shutdown...`);
            httpServer.close((httpErr) => {
                httpsServer.close((httpsErr) => {
                    if (httpErr || httpsErr) {
                        logger.error('Fehler beim Schließen der Server:', httpErr || httpsErr);
                        process.exit(1);
                    }
                    logger.info('Beide Server geschlossen');
                    logger.info('Server erfolgreich beendet');
                    process.exit(0);
                });
            });
        });
    });
} else {
    // Graceful shutdown nur für HTTP
    ['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach(signal => {
        process.on(signal, () => gracefulShutdown(signal));
    });
}
/**
Keep routes modular: Separate routes based on features or entities (e.g., userRoutes, productRoutes).

Use environment variables: Store sensitive information like API keys or database credentials in .env files and access them via process.env.

Error Handling: Implement centralized error handling middleware to catch and respond to errors.

Write Tests: Maintain a separate folder (tests/) for unit and integration tests to ensure your app works as expected.

Follow REST principles: If you're building an API, ensure your routes follow RESTful conventions (e.g., GET /users, POST /users). 
*/
