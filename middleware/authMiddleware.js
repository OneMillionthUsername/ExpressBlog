//Middleware functions are executed during the request-response cycle. They can perform tasks like authentication, logging, or validation before the request reaches the route handler.

/**
- Authentication: Middleware is used to secure routes by verifying tokens.
- Reusable Logic: Can be applied to multiple routes to handle common tasks like authentication or logging.
- Flow Control: Uses next() to pass control to the next middleware or route handler.
 */
import * as authService from '../services/authService.js';
import logger from '../utils/logger.js';

/**
 * Express middleware to authenticate requests using JWT stored in cookies or headers.
 *
 * Behavior:
 * - Extracts token via `authService.extractTokenFromRequest`.
 * - Verifies token with `authService.verifyToken`.
 * - Attaches `req.user` on success and calls `next()`.
 * - Returns `401` JSON response when missing/invalid/expired token.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function authenticateToken(req, res, next) {
  const token = authService.extractTokenFromRequest(req);

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.headers['x-real-ip'] || req.ip || req.socket.remoteAddress;

  if (!token) {
    logger.auth('[AUTH] 401 No token provided', null, ip);
    return res.status(401).json({ 
      error: 'Access denied',
      message: 'JWT token required', 
    });
  }
  try {
    const user = authService.verifyToken(token);
    if (!user) {
      logger.auth('[AUTH] 401 Invalid/expired token', null, ip);
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token is expired or invalid', 
      });
    }
        
    // Attach user info to request
    req.user = user;
    next();
  } catch (error) {
    logger.auth('[AUTH] 401 Token verification exception', null, ip);
    logger.error('Error during token authentication:', error);
    // Treat verification/parsing errors as authentication failures, not internal server errors
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'Token verification failed', 
    });
  }
}

/**
 * Middleware that enforces administrative privileges.
 * Expects `req.user` to be populated (e.g. via `authenticateToken`).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.isAdmin !== true) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.headers['x-real-ip'] || req.ip || req.socket.remoteAddress;
    logger.auth(
      `[AUTH] 403 Admin access denied for user "${req.user?.username ?? 'unauthenticated'}" on ${req.method} ${req.originalUrl}`,
      req.user?.username ?? null,
      ip,
    );
    return res.status(403).json({ 
      error: 'Admin privileges required',
      message: 'Only administrators have access to this function', 
    });
  }
  next();
}