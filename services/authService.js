//Contains business logic functions that often interact with models and perform more complex operations.

/**
- authService.js: Handles user authentication logic.
- productService.js: Contains logic related to products, like fetching product data.
 */
import jwt from 'jsonwebtoken';
import { Admin } from '../models/adminModel.js';
import { JWT_SECRET, NODE_ENV } from '../config/config.js';


export const AUTH_COOKIE_NAME = 'authToken';
// JWT-Konfiguration
const JWT_CONFIG = {
    SECRET_KEY: JWT_SECRET,
    EXPIRES_IN: '24h', // Token-Lebensdauer
    ALGORITHM: 'HS256',
    ISSUER: 'blog-app',
    AUDIENCE: 'blog-users'
};

// JWT-Secret Validation
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    if (NODE_ENV === 'test') {
        console.warn('WARNING: JWT_SECRET not set in test environment');
        JWT_SECRET = 'test_jwt_secret_key_with_at_least_32_characters_for_testing_purposes';
    } else {
        console.error('FATAL ERROR: JWT_SECRET environment variable is not set or invalid');
        console.error('Please add JWT_SECRET to your .env file');
        console.error('Example: JWT_SECRET=your_64_character_secret_key_here');
        process.exit(1);
    }
}
// Generate JWT token
export function generateToken(user) {
    if(user && !(user instanceof Admin)) {
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

export default {
    generateToken,
    verifyToken,
    extractTokenFromRequest
};
