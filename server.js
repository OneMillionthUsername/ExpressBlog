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
    try {
        const sslPath = join(__dirname, '..', 'ssl');
        httpsOptions = {
            key: readFileSync(join(sslPath, 'private-key.pem')),
            cert: readFileSync(join(sslPath, 'certificate.pem'))
        };
        console.log('SSL certificates loaded successfully (Development)');
    } catch (error) {
        console.warn('SSL certificates not found - HTTP only available');
        console.warn('Run "node ssl/generate-certs.js" to enable HTTPS');
    }
} else {
    console.log('Production mode: SSL handled by Plesk/webserver');
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

    if(config.IS_PRODUCTION) {
        console.log('Production mode: SSL handled by Plesk/webserver');
    }
    else if (httpsOptions) {
        console.log('Development mode: SSL enabled with self-signed certificates');
    }
    else {
        console.log('Development mode: HTTP only - run "node ssl/generate-certs.js" to enable HTTPS');
    }

    if (config.IS_PLESK) {
        console.log('Plesk mode: SSL handled by Plesk');
    } else if (!httpsOptions) {
        console.log('HTTP only available - run "node ssl/generate-certs.js" for HTTPS');
    }
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} bereits in Verwendung!`);
        console.error(`Tipp: Verwende einen anderen Port mit PORT=xxxx`);
    } else {
        console.error('Server-Fehler:', error);
    }
    process.exit(1);
});

// Graceful Shutdown Handler
function gracefulShutdown(signal) {
    console.log(`${signal} erhalten - starte Graceful Shutdown...`);
    
    httpServer.close((err) => {
        if (err) {
            console.error('Fehler beim Schließen des HTTP-Servers:', err);
            process.exit(1);
        }
        
        console.log('HTTP-Server geschlossen');
        console.log('Server erfolgreich beendet');
        process.exit(0);
    });
}

// HTTPS Server nur in Development starten
if (!config.IS_PLESK && httpsOptions) {
    const httpsServer = https.createServer(httpsOptions, app);
    httpsServer.listen(config.HTTPS_PORT, config.HOST, () => {
        console.log(`HTTPS Server running on https://${config.HOST}:${config.HTTPS_PORT}`);
        console.log('SSL/TLS enabled - secure connection available');
        console.log('Certificate: Self-signed for development (browser warning normal)');
        console.log('JWT authentication enabled');
    });
    
    // Graceful shutdown für beide Server
    ['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach(signal => {
        process.on(signal, () => {
            console.log(`${signal} erhalten - starte Graceful Shutdown...`);
            
            httpServer.close((httpErr) => {
                httpsServer.close((httpsErr) => {
                    if (httpErr || httpsErr) {
                        console.error('Fehler beim Schließen der Server:', httpErr || httpsErr);
                        process.exit(1);
                    }
                    console.log('Beide Server geschlossen');
                    console.log('Server erfolgreich beendet');
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
