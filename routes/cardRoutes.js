import express from 'express';
import cardController from '../controllers/cardController.js';
import { strictLimiter } from '../utils/limiters.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { celebrate, Joi, Segments } from 'celebrate';
import csrfProtection from '../utils/csrf.js';
import logger from '../utils/logger.js';
import { applySsrNoCache, getSsrAdmin } from '../utils/utils.js';

/**
 * Routes for Cards (small discoverable items shown on the site).
 *
 * - `GET /create` renders the card creation form (admin only)
 * - `POST /create` creates a card via HTML form (admin only)
 * - `POST /:id/delete` deletes a card (admin only)
 */
const cardRouter = express.Router();

// GET /cards/create - Card erstellen (Admin only)
cardRouter.get('/create',
  strictLimiter,
  authenticateToken,
  requireAdmin,
  csrfProtection,
  (req, res) => {
    const isAdmin = getSsrAdmin(res);
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
    const error = req.query && req.query.error ? '1' : null;
    applySsrNoCache(res, { varyCookie: true });
    return res.render('cardCreate', { isAdmin, csrfToken, error });
  },
);

// POST /cards/create - Neue Card erstellen (Admin only)
cardRouter.post('/create',
  strictLimiter,
  csrfProtection,
  celebrate({
    [Segments.BODY]: Joi.object({
      title: Joi.string().min(1).max(255).required(),
      subtitle: Joi.string().max(500).allow('', null),
      link: Joi.string().uri().required(),
      img_link: Joi.string().uri().required(),
    }),
  }),
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      await cardController.createCard(req.body);
      return res.redirect(303, '/');
    } catch (error) {
      logger.error('Error creating card (SSR):', error);
      return res.redirect(303, '/cards/create?error=1');
    }
  },
);

// POST /cards/:id/delete - Card löschen (Admin only)
cardRouter.post('/:id/delete',
  strictLimiter,
  csrfProtection,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      id: Joi.number().integer().min(1).required(),
    }),
  }),
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const cardId = parseInt(req.params.id);
    try {
      await cardController.deleteCard(cardId);
      return res.redirect(303, '/');
    } catch (error) {
      logger.error('Error deleting card (SSR):', error);
      return res.redirect(303, '/?cardDeleteError=1');
    }
  },
);

export default cardRouter;
