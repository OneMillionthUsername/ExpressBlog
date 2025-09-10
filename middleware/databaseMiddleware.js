import { appStatus } from '../app.js';
import logger from '../utils/logger.js';

/**
 * Middleware that ensures database is ready before processing request
 * Returns 503 Service Unavailable if database is still initializing
 */
export function requireDatabase(req, res, next) {
  logger.debug('requireDatabase: Checking database readiness', {
    url: req.url,
    method: req.method,
    isDatabaseReady: appStatus.isDatabaseReady(),
  });
  
  if (!appStatus.isDatabaseReady()) {
    logger.debug('requireDatabase: Database not ready, returning 503');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database is still initializing. Please try again in a moment.',
      timestamp: new Date().toISOString(),
    });
  }
  
  logger.debug('requireDatabase: Database ready, proceeding to next middleware');
  next();
}

export default requireDatabase;
