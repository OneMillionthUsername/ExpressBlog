//Middleware functions are executed during the request-response cycle. They can perform tasks like authentication, logging, or validation before the request reaches the route handler.

/**
- Authentication: Middleware is used to secure routes by verifying tokens.
- Reusable Logic: Can be applied to multiple routes to handle common tasks like authentication or logging.
- Flow Control: Uses next() to pass control to the next middleware or route handler.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

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
    if(user && typeof user !== 'adminModel') {
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

export default (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send('No token provided');
    // Check token validity here
    next();
};