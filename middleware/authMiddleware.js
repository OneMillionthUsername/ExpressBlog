//Middleware functions are executed during the request-response cycle. They can perform tasks like authentication, logging, or validation before the request reaches the route handler.

/**
- Authentication: Middleware is used to secure routes by verifying tokens.
- Reusable Logic: Can be applied to multiple routes to handle common tasks like authentication or logging.
- Flow Control: Uses next() to pass control to the next middleware or route handler.
 */
import * as authService from '../services/authService.js';

// JWT-Middleware für Express
export function authenticateToken(req, res, next) {
    const token = authService.extractTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({ 
            error: 'Access denied',
            message: 'JWT token required' 
        });
    }
    try {
        const user = verifyToken(token);
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'Token is expired or invalid' 
            });
        }
        
        // Attach user info to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Error during token authentication:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Token authentication failed' 
        });
    }
}
// Admin-Only Middleware
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
            error: 'Admin privileges required',
            message: 'Only administrators have access to this function' 
        });
    }
    next();
}