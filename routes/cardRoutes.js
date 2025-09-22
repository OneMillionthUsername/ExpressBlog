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
  logger.debug(`[${requestId}] GET /cards: Request received from ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
  logger.debug(`[${requestId}] GET /cards: Request headers:`, req.headers);
  
  try {
    logger.debug(`[${requestId}] GET /cards: Calling cardController.getAllCards()`);
    const cards = await cardController.getAllCards();
    logger.debug(`[${requestId}] GET /cards: Retrieved ${cards.length} cards`);
    logger.debug(`[${requestId}] GET /cards: Card data:`, JSON.stringify(cards, null, 2));
    
    logger.debug(`[${requestId}] GET /cards: Sending response with ${cards.length} cards`);
    res.json(cards);
    logger.debug(`[${requestId}] GET /cards: Response sent successfully`);
  } catch (error) {
    logger.error(`[${requestId}] GET /cards: Error occurred`, error);
    logger.error(`[${requestId}] GET /cards: Error stack:`, error.stack);
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
    logger.debug(`[${requestId}] GET /cards/${cardId}: Request received from ${req.ip}`);
    logger.debug(`[${requestId}] GET /cards/${cardId}: Parsed cardId: ${cardId}`);
    
    try {
      logger.debug(`[${requestId}] GET /cards/${cardId}: Calling cardController.getCardById(${cardId})`);
      const card = await cardController.getCardById(cardId);
      logger.debug(`[${requestId}] GET /cards/${cardId}: Card found:`, JSON.stringify(card, null, 2));
      
      logger.debug(`[${requestId}] GET /cards/${cardId}: Sending response`);
      res.json(card);
      logger.debug(`[${requestId}] GET /cards/${cardId}: Response sent successfully`);
    } catch (error) {
      logger.error(`[${requestId}] GET /cards/${cardId}: Error occurred`, error);
      logger.error(`[${requestId}] GET /cards/${cardId}: Error stack:`, error.stack);
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
      img_link: Joi.string().uri().required(),
    }),
  }),
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    logger.debug(`[${requestId}] POST /cards: Request received from ${req.ip}`);
    logger.debug(`[${requestId}] POST /cards: Request body:`, JSON.stringify(req.body, null, 2));
    
    try {
      logger.debug(`[${requestId}] POST /cards: Calling cardController.createCard()`);
      const card = await cardController.createCard(req.body);
      logger.debug(`[${requestId}] POST /cards: Card created:`, JSON.stringify(card, null, 2));
      
      logger.info(`[${requestId}] POST /cards: Card created successfully`, { cardId: card.id });
      res.status(201).json({
        success: true,
        message: 'Card created successfully',
        card: card,
      });
      logger.debug(`[${requestId}] POST /cards: Response sent successfully`);
    } catch (error) {
      logger.error(`[${requestId}] POST /cards: Error occurred`, error);
      logger.error(`[${requestId}] POST /cards: Error stack:`, error.stack);
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
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const cardId = parseInt(req.params.id);
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    logger.debug(`[${requestId}] DELETE /cards/${cardId}: Request received from ${req.ip}`);
    logger.debug(`[${requestId}] DELETE /cards/${cardId}: Parsed cardId: ${cardId}`);
    
    try {
      logger.debug(`[${requestId}] DELETE /cards/${cardId}: Calling cardController.deleteCard(${cardId})`);
      await cardController.deleteCard(cardId);
      logger.debug(`[${requestId}] DELETE /cards/${cardId}: Card deleted successfully`);
      
      logger.info(`[${requestId}] DELETE /cards/${cardId}: Card deleted successfully`);
      res.json({
        success: true,
        message: 'Card deleted successfully',
      });
      logger.debug(`[${requestId}] DELETE /cards/${cardId}: Response sent successfully`);
    } catch (error) {
      logger.error(`[${requestId}] DELETE /cards/${cardId}: Error occurred`, error);
      logger.error(`[${requestId}] DELETE /cards/${cardId}: Error stack:`, error.stack);
      console.error(`Error deleting card ${cardId}:`, error);
      res.status(500).json({ error: 'Server failed to delete card' });
    }
  },
);

export default cardRouter;
