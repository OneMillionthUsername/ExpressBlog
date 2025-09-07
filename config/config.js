import 'dotenv/config.js';

// config/config.js

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PLESK = process.env.PLESK_ENV === 'true';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '100kb';
export const URLENCODED_BODY_LIMIT = process.env.URLENCODED_BODY_LIMIT || '100kb';
export const PORT = process.env.PORT || (IS_PLESK ? 8080 : 3000);
export const HTTPS_PORT = process.env.HTTPS_PORT || (IS_PLESK ? 8443 : 3443);
export const HOST = process.env.HOST || '0.0.0.0';
export const DOMAIN = process.env.DOMAIN || 'localhost';
export const DB_HOST = process.env.DB_HOST;
export const DB_USER = process.env.DB_USER;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const DB_NAME = process.env.DB_NAME;
export const JWT_SECRET = process.env.JWT_SECRET;