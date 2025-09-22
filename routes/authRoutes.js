/**
 * authRoutes: Für Login, Logout, Registrierung, Token usw.
 * adminRoutes: Für Admin-spezifische Funktionen
 * adminController: Für die Logik hinter Admin-Funktionen
 */
import express from 'express';
import { loginLimiter, strictLimiter } from '../utils/limiters.js';
import adminController from '../controllers/adminController.js';
import * as authService from '../services/authService.js';
import { AUTH_COOKIE_NAME } from '../services/authService.js';
import { celebrate, Joi, Segments } from 'celebrate';
import { IS_PRODUCTION } from '../config/config.js';
import logger from '../utils/logger.js';

const authRouter = express.Router();
// authRouter.all('*', requireJsonContent, async (req, res) => {
//   //hier allgemeine Logik ausführen
//   //logging
//   //sanitazing
// });
/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Admin Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Erfolgreich eingeloggt
 *       401:
 *         description: Ungültige Anmeldedaten
 */
// Login-Validierung
authRouter.post('/login',
  loginLimiter,
  celebrate({
    [Segments.BODY]: Joi.object({
      username: Joi.string().min(1).max(100).required(),
      password: Joi.string().min(8).max(100).required(),
    }),
  }),
  async (req, res) => {
    try {
      logger.debug('[AUTH] /auth/login request received', {
        bodyKeys: Object.keys(req.body || {}),
        hasUsername: Boolean(req.body && req.body.username),
        hasPassword: Boolean(req.body && typeof req.body.password === 'string'),
        csrfHeader: req.get('x-csrf-token') || req.get('x-xsrf-token') || req.get('csrf-token') || null,
        hasCsrfCookie: Boolean(req.cookies && req.cookies._csrf),
      });
      // Timeout für Auth-Operationen (ohne unhandled rejection)
      const AUTH_TIMEOUT_MS = Number(process.env.AUTH_TIMEOUT_MS || 8000);
      const TIMEOUT_SENTINEL = Symbol('AUTH_TIMEOUT');
      let timer;
      const authPromise = adminController.authenticateAdmin(req.body.username, req.body.password);
      const raced = await Promise.race([
        authPromise,
        new Promise((resolve) => { timer = setTimeout(() => resolve(TIMEOUT_SENTINEL), AUTH_TIMEOUT_MS); }),
      ]);
      if (timer) clearTimeout(timer);

      if (raced === TIMEOUT_SENTINEL) {
        logger.warn(`[AUTH AUDIT] Authentication timed out for username: ${req.body.username}`);
        return res.status(503).json({ success: false, error: 'Authentication timeout' });
      }
      const admin = raced;
      if (!admin) {
        logger.warn(`[AUTH AUDIT] Failed login for username: ${req.body.username}`);
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
      // Token generation
      const { id, username, role } = admin;
      const token = authService.generateToken({ id, username, role });
      logger.debug('[AUTH] Token generated successfully for user', { id, username, role });
      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,           // Nicht per JavaScript lesbar
        secure: IS_PRODUCTION,    // Nur über HTTPS
        sameSite: 'strict',       // CSRF-Schutz
        maxAge: 24 * 60 * 60 * 1000, // 24h
        path: '/',                 // Für ganze Domain
      });
      logger.info(`[AUTH AUDIT] Successful login for username: ${username} (id: ${id}, role: ${role})`);
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
        },
      });
    } catch (error) {
      logger.error(`[AUTH AUDIT] Login error for username: ${req.body && req.body.username}`, error);
      logger.debug('[AUTH] Login error details', {
        message: error && error.message,
        stack: error && error.stack,
        hasCsrfHeader: Boolean(req.get('x-csrf-token') || req.get('x-xsrf-token') || req.get('csrf-token')),
        hasCsrfCookie: Boolean(req.cookies && req.cookies._csrf),
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
// POST /auth/verify - Token-Verifikation
// Response:
//   - On success:
authRouter.post('/verify',
  strictLimiter,
  celebrate({
    [Segments.BODY]: Joi.object({
      token: Joi.string().min(10).max(512).optional(),
    }),
  }),
  (req, res) => {
    let tokenSource = 'unknown';
    try {
      const token = authService.extractTokenFromRequest(req);
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        tokenSource = 'Authorization header';
      } else if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
        tokenSource = 'authToken cookie';
      } else if (req.body && req.body.token) {
        tokenSource = 'request body';
      }
      if (!token) {
        logger.warn(`[AUTH AUDIT] Token verification failed: No token found (source: ${tokenSource})`);
        return res.status(401).json({ 
          success: false,
          data: {
            valid: false,
            error: 'Kein Token gefunden', 
          },
        });
      }
      const admin = authService.verifyToken(token);
      if (!admin) {
        logger.warn(`[AUTH AUDIT] Token verification failed: Invalid or expired token (source: ${tokenSource})`);
        return res.status(403).json({ 
          success: false,
          data: {
            valid: false,
            error: 'Token invalid or expired', 
          },
        });
      }
      res.json({
        success: true,
        data: {
          valid: true,
          user: {
            id: Number(admin.id), // BigInt zu Number konvertieren
            username: admin.username,
            role: admin.role,
          },
        },
      });
    } catch (error) {
      logger.error(`[AUTH AUDIT] Error during token verification (source: ${tokenSource}):`, error);
      return res.status(403).json({ 
        success: false,
        data: {
          valid: false,
          error: 'Token invalid or expired', 
        },
      });
    }
  });
// POST /auth/logout - Abmeldung
authRouter.post('/logout', (req, res) => {
  // Cookie entfernen (auch wenn nicht vorhanden, ist das idempotent)
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  // Optional: Logging
  //console.info(`[AUTH AUDIT] Logout for user: ${req.user?.username || 'unknown'}`);

  // Klare Antwort für das Frontend
  res.status(200).json({
    success: true,
    message: 'Logout erfolgreich. Sie wurden abgemeldet.',
  });
});
export default authRouter;


