//Middleware functions are executed during the request-response cycle. They can perform tasks like authentication, logging, or validation before the request reaches the route handler.

/**
- Authentication: Middleware is used to secure routes by verifying tokens.
- Reusable Logic: Can be applied to multiple routes to handle common tasks like authentication or logging.
- Flow Control: Uses next() to pass control to the next middleware or route handler.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { adminModel } from '../models/adminModel';

export const AUTH_COOKIE_NAME = 'authToken';

// JWT-Secret Validation
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is required!');
    console.error('Please add JWT_SECRET to your .env file');
    console.error('Example: JWT_SECRET=your_64_character_secret_key_here');
    process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
    console.error('FATAL ERROR: JWT_SECRET must be at least 32 characters long');
    process.exit(1);
}

// JWT-Konfiguration
const JWT_CONFIG = {
    SECRET_KEY: process.env.JWT_SECRET,
    EXPIRES_IN: '24h', // Token-Lebensdauer
    ALGORITHM: 'HS256',
    ISSUER: 'blog-app',
    AUDIENCE: 'blog-users'
};

// Generate JWT token
export function generateToken(user) {
    if(user && !(user instanceof adminModel)) {
        throw new Error('Invalid user data for token generation');
    }
 
    const payload = {
        id: Number(user.id), // BigInt to Number
        username: user.username,
        role: user.role,
        iss: JWT_CONFIG.ISSUER,
        aud: JWT_CONFIG.AUDIENCE
    };
    
    try {
        const token = jwt.sign(payload, JWT_CONFIG.SECRET_KEY, {
            expiresIn: JWT_CONFIG.EXPIRES_IN,
            algorithm: JWT_CONFIG.ALGORITHM
        });
        
        return token;
    } catch (error) {
        console.error('Token generation failed:', error);
        throw new Error('Token generation failed');
    }
}
// verifyToken
export function verifyToken(token) {   
    try {        
        const decoded = jwt.verify(token, JWT_CONFIG.SECRET_KEY, {
            algorithms: [JWT_CONFIG.ALGORITHM],
            issuer: JWT_CONFIG.ISSUER,
            audience: JWT_CONFIG.AUDIENCE
        });
        
        return decoded;
    } catch (error) {
        console.error('JWT verification failed');
        console.error('Error details:', error.message);
        if (process.env.NODE_ENV !== 'production') {
            console.error('Full error stack:', error.stack);
        }
        
        return null;
    }
}

// Token aus Request extrahieren
/**
 * Extracts the JWT token from an Express request object.
 * Checks the Authorization header and cookies for a token.
 * @param {import('express').Request} req - The Express request object.
 * @returns {string|null} The extracted JWT token, or null if not found.
 */
export function extractTokenFromRequest(req) {    
    // Prüfe Authorization Header
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const headerToken = authHeader.substring(7);
        return headerToken;
    }
    
    // Prüfe Cookies (fallback)
    if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
        const cookieToken = req.cookies[AUTH_COOKIE_NAME];
        return cookieToken;
    }
    
    return null;
}

// Admin-Login validieren (Datenbank-basiert)
export async function validateAdminLogin(username, password) {
    if (!username || !password) {
        return null;
    }
    try {
        const { default: adminController } = await import('../controllers/adminController.js');
        const admin = await adminController.getAdminByUsername(username);
        
        if (!admin || !admin.active || admin.locked_until && new Date() < new Date(admin.locked_until)) {
            return null;
        }
        
        const isValidPassword = await bcrypt.compare(password, admin.password_hash);
        
        if (isValidPassword) {
            await adminController.updateAdminLoginSuccess(admin.id);

            const returnUser = {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                email: admin.email,
                full_name: admin.full_name
            };
            
            return returnUser;
        } else {
            await adminController.updateAdminLoginFailure(admin.id);
            return null;
        }
    } catch (error) {
        console.error('ERROR during admin login validation:');
        console.error(error);
        return null;
    }
}

// Passwort hashen (für Admin-Passwort-Update)
// export async function hashPassword(password) {
//     try {
//         const saltRounds = 12; // Höhere Sicherheit
//         return await bcrypt.hash(password, saltRounds);
//     } catch (error) {
//         console.error('Fehler beim Passwort-Hashing:', error);
//         throw error;
//     }
// }

// JWT-Middleware für Express
export function authenticateToken(req, res, next) {
    const token = extractTokenFromRequest(req);
    
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