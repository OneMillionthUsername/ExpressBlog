import 'dotenv/config.js';

// config/config.js

export const APP_VERSION = '4.0.0';

export const NODE_ENV = process.env.NODE_ENV || 'development';
//export const IS_PLESK = Boolean(process.env.PLESK_ENV && process.env.PLESK_ENV === 'true');
export const IS_PRODUCTION = NODE_ENV === 'production';
// Common defaults: allow rich HTML editor payloads without being overly permissive
export const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '2mb';
export const URLENCODED_BODY_LIMIT = process.env.URLENCODED_BODY_LIMIT || '2mb';
export const PORT = process.env.PORT || (3000);
export const HTTPS_PORT = process.env.HTTPS_PORT || (IS_PRODUCTION ? 443 : 3443);
export const HOST = process.env.HOST || '0.0.0.0';
export const DOMAIN = process.env.DOMAIN || 'localhost';
export const DB_HOST = process.env.DB_HOST;
export const DB_USER = process.env.DB_USER;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const DB_NAME = process.env.DB_NAME;
export const JWT_SECRET = process.env.JWT_SECRET;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'your_gemini_api_key_here';
export const TINY_MCE_API_KEY = process.env.TINY_MCE_API_KEY || 'your_tiny_mce_api_key_here';