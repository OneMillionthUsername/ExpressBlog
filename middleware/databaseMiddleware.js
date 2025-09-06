import { appStatus } from '../app.js';

/**
 * Middleware that ensures database is ready before processing request
 * Returns 503 Service Unavailable if database is still initializing
 */
export function requireDatabase(req, res, next) {
    if (!appStatus.isDatabaseReady()) {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Database is still initializing. Please try again in a moment.',
            timestamp: new Date().toISOString()
        });
    }
    next();
}

export default requireDatabase;
