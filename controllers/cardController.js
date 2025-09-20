import { DatabaseService } from '../databases/mariaDB.js';
import { Card } from '../models/cardModel.js';
import { CardControllerException } from '../models/customExceptions.js';
import logger from '../utils/logger.js';

const createCard = async (cardData) => {
  const { error, value } = Card.validate(cardData);
  if (error) {
    throw new CardControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
  }
  try {
    const card = await DatabaseService.createCard(value);
    return new Card(card);
  } catch (error) {
    throw new CardControllerException(`Error creating card: ${error.message}`, error);
  }
};
const getAllCards = async () => {
  try {
    logger.debug('Fetching all cards from database');
    const cards = await DatabaseService.getAllCards();
    const fetchedCount = Array.isArray(cards) ? cards.length : 0;
    logger.debug(`Fetched ${fetchedCount} cards from database`);
    if (!cards || fetchedCount === 0) {
      logger.debug('No cards found in database');
      return [];
    }
    // validate
    const validCards = [];
    for (const card of cards) {
      const { error, value } = Card.validate(card);
      if (error) {
        logger.debug('Validation failed for card:', error.details.map(d => d.message).join('; '));
        continue;
      }
      validCards.push(new Card(value));
    }
    logger.debug(`Returning ${validCards.length} valid cards`);
    return validCards;
  } catch (error) {
    throw new CardControllerException(`Error getting all cards: ${error.message}`, error);
  }
};
const getCardById = async (id) => {
  try {
    if (!Number.isInteger(id) || id <= 0) {
      throw new CardControllerException('Invalid card ID');
    }
    const card = await DatabaseService.getCardById(id);
    if (!card) {
      throw new CardControllerException('Card not found');
    }
    const { error, value } = Card.validate(card);
    if (error) {
      throw new CardControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    return new Card(value);
  } catch (error) {
    throw new CardControllerException(`Error getting card by id: ${error.message}`, error);
  }
};
const deleteCard = async (id) => {
  try {
    if (!Number.isInteger(id) || id <= 0) {
      throw new CardControllerException('Invalid card ID');
    }
    const deleted = await DatabaseService.deleteCard(id);
    if (!deleted) {
      throw new CardControllerException('Card not found or not deleted');
    }
    return { success: true, message: 'Card deleted successfully' };
  } catch (error) {
    throw new CardControllerException(`Error deleting card: ${error.message}`, error);
  }
};
export default {
  createCard,
  getAllCards,
  getCardById,
  deleteCard,
};