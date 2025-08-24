/**
 * authRoutes: Für Login, Logout, Registrierung, Token usw.
 * adminRoutes: Für Admin-spezifische Funktionen
 * adminController: Für die Logik hinter Admin-Funktionen
 */
import express from 'express';
import { requireJsonContent } from '../middleware/securityMiddleware.js';
import { loginLimiter, strictLimiter } from '../utils/limiters.js';
import { sendLoginResponse, sendLogoutResponse } from '../utils/utils.js';
import * as adminController from "../controllers/adminController.js";
import * as authService from "../services/authService.js";
import { AUTH_COOKIE_NAME } from '../services/authService.js';
import { celebrate, Joi, Segments } from 'celebrate';

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
      password: Joi.string().min(8).max(100).required()
    })
  }),
  async (req, res) => {
    try {
        // Timeout für Auth-Operationen
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Authentication timeout')), 5000);
        });
        const authPromise = adminController.authenticateAdmin(req.body.username, req.body.password);
        // Authentication
        const admin = await Promise.race([authPromise, timeoutPromise]);
        if (!admin) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        // Token generation
        const { id, username, role } = admin;
        const token = authService.generateToken({ id, username, role });
        // Response
        sendLoginResponse(res, admin, token);
    } catch (error) {
        console.error('Login error:', error);
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
      token: Joi.string().min(10).max(512).optional()
    })
  }),
  (req, res) => {
    try {
        const token = authService.extractTokenFromRequest(req);
        let tokenSource = 'unknown';
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            tokenSource = 'Authorization header';
        } else if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
            tokenSource = 'authToken cookie';
        } else if (req.body && req.body.token) {
            tokenSource = 'request body';
        }
        if (!token) {
            console.warn(`[AUTH AUDIT] Token verification failed: No token found (source: ${tokenSource})`);
            return res.status(401).json({ 
                success: false,
                data: {
                    valid: false,
                    error: 'Kein Token gefunden' 
                }
            });
        }
        let admin;
        admin = authService.verifyToken(token);
        if (!admin) {
            console.warn(`[AUTH AUDIT] Token verification failed: Invalid or expired token (source: ${tokenSource})`);
            return res.status(403).json({ 
                success: false,
                data: {
                    valid: false,
                    error: 'Token invalid or expired' 
                }
            });
        }
        res.json({
            success: true,
            data: {
                valid: true,
                user: {
                    id: Number(admin.id), // BigInt zu Number konvertieren
                    username: admin.username,
                    role: admin.role
                }
            }
        });
    } catch (error) {
        console.error(`[AUTH AUDIT] Error during token verification (source: ${tokenSource}):`, err);
        return res.status(403).json({ 
            success: false,
            data: {
                valid: false,
                error: 'Token invalid or expired' 
            }
        });
    }
});
// POST /auth/logout - Abmeldung
authRouter.post('/logout', (req, res) => {
    sendLogoutResponse(res);
});

export default authRouter;


