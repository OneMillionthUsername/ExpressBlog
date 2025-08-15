//Contains helper functions like logging or error handling that can be reused throughout the app.

/**
 - Reusable Functions: Stores commonly used functions to avoid code duplication.
- Utility Focus: Contains utility functions that enhance code readability and maintainability.
 */

export default (message) => {
  console.log(`[LOG]: ${message}`);
};

// Logger-Middleware mit verbessertem Logging
export function loggerMiddleware(req, res, next) {
    const startTime = Date.now();
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Request loggen
    logger.debug(`Incoming request: ${req.method} ${req.url}`, {
        ip,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer')
    });

    // Response Zeit messen
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        logger.access(req.method, req.url, res.statusCode, responseTime, ip);
    });

    next();
}