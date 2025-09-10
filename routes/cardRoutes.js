import express from 'express';
import cardController from '../controllers/cardController.js';
import { requireJsonContent } from '../middleware/securityMiddleware.js';
import { globalLimiter, strictLimiter } from '../utils/limiters.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { celebrate, Joi, Segments } from 'celebrate';
import csrfProtection from '../utils/csrf.js';
import logger from '../utils/logger.js';

const cardRouter = express.Router();

// GET /cards - Alle Cards abrufen
cardRouter.get('/', globalLimiter, async (req, res) => {
  const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  logger.debug(`[${requestId}] GET /cards: Request received`);
  
  try {
    const cards = await cardController.getAllCards();
    logger.debug(`[${requestId}] GET /cards: Retrieved ${cards.length} cards`);
    res.json(cards);
  } catch (error) {
    logger.error(`[${requestId}] GET /cards: Error occurred`, error);
    console.error('Error loading cards:', error);
    res.status(500).json({ error: 'Server failed to load cards' });
  }
});

// GET /cards/:id - Spezifische Card abrufen
cardRouter.get('/:id', 
  globalLimiter,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      id: Joi.number().integer().min(1).required(),
    }),
  }),
  async (req, res) => {
    const cardId = parseInt(req.params.id);
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    logger.debug(`[${requestId}] GET /cards/${cardId}: Request received`);
    
    try {
      const card = await cardController.getCardById(cardId);
      logger.debug(`[${requestId}] GET /cards/${cardId}: Card found`);
      res.json(card);
    } catch (error) {
      logger.error(`[${requestId}] GET /cards/${cardId}: Error occurred`, error);
      console.error(`Error loading card ${cardId}:`, error);
      res.status(500).json({ error: 'Server failed to load card' });
    }
  },
);

// POST /cards - Neue Card erstellen (Admin only)
cardRouter.post('/',
  strictLimiter,
  csrfProtection,
  requireJsonContent,
  celebrate({
    [Segments.BODY]: Joi.object({
      title: Joi.string().min(1).max(255).required(),
      subtitle: Joi.string().max(500).allow('', null),
      link: Joi.string().uri().required(),
      img: Joi.string().uri().required(),
    }),
  }),
  requireAdmin,
  authenticateToken,
  async (req, res) => {
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    logger.debug(`[${requestId}] POST /cards: Request received`);
    
    try {
      const card = await cardController.createCard(req.body);
      logger.info(`[${requestId}] POST /cards: Card created successfully`, { cardId: card.id });
      res.status(201).json({
        success: true,
        message: 'Card created successfully',
        card: card,
      });
    } catch (error) {
      logger.error(`[${requestId}] POST /cards: Error occurred`, error);
      console.error('Error creating card:', error);
      res.status(500).json({ error: 'Server failed to create card' });
    }
  },
);

// DELETE /cards/:id - Card löschen (Admin only)
cardRouter.delete('/:id',
  strictLimiter,
  csrfProtection,
  requireJsonContent,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      id: Joi.number().integer().min(1).required(),
    }),
  }),
  requireAdmin,
  authenticateToken,
  async (req, res) => {
    const cardId = parseInt(req.params.id);
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    logger.debug(`[${requestId}] DELETE /cards/${cardId}: Request received`);
    
    try {
      await cardController.deleteCard(cardId);
      logger.info(`[${requestId}] DELETE /cards/${cardId}: Card deleted successfully`);
      res.json({
        success: true,
        message: 'Card deleted successfully',
      });
    } catch (error) {
      logger.error(`[${requestId}] DELETE /cards/${cardId}: Error occurred`, error);
      console.error(`Error deleting card ${cardId}:`, error);
      res.status(500).json({ error: 'Server failed to delete card' });
    }
  },
);

export default cardRouter;
