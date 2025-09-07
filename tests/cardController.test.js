import { describe, expect, it, jest, beforeEach } from '@jest/globals';

// 1. Module mocken BEVOR sie importiert werden
const mockCreateCard = jest.fn();
const mockGetAllCards = jest.fn();
const mockGetCardById = jest.fn();
const mockDeleteCard = jest.fn();

jest.mock('../databases/mariaDB.js', () => ({
  DatabaseService: {
    createCard: mockCreateCard,
    getAllCards: mockGetAllCards,
    getCardById: mockGetCardById,
    deleteCard: mockDeleteCard,
  },
}));

jest.mock('../models/cardModel.js', () => {
  const CardMock = jest.fn().mockImplementation((data) => data);
  CardMock.validate = jest.fn();
  return { Card: CardMock }; // ← Named export Card mocken
});

// 2. NACH dem Mocken importieren
import { DatabaseService } from '../databases/mariaDB.js';
import { Card } from '../models/cardModel.js';
import * as cardController from '../controllers/cardController.js';

// Mock Card.validate after import
const originalCardValidate = Card.validate;
Card.validate = jest.fn();

// Mock DatabaseService methods after import
const originalCreateCard = DatabaseService.createCard;
const originalGetAllCards = DatabaseService.getAllCards;
const originalGetCardById = DatabaseService.getCardById;
const originalDeleteCard = DatabaseService.deleteCard;

DatabaseService.createCard = mockCreateCard;
DatabaseService.getAllCards = mockGetAllCards;
DatabaseService.getCardById = mockGetCardById;
DatabaseService.deleteCard = mockDeleteCard;

let consoleSpy;

beforeEach(() => {
  jest.clearAllMocks();
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.clearAllTimers();

  // Set up default mock implementations
  mockCreateCard.mockResolvedValue({ success: true, card: { id: 1 } });
  mockGetAllCards.mockResolvedValue([]);
  mockGetCardById.mockResolvedValue(null);
  mockDeleteCard.mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

describe('CardController', () => {
  describe('createCard', () => {
    it('should throw error when validation fails', async () => {
      const cardData = { title: '' };
      Card.validate.mockReturnValue({ 
        error: { details: [{ message: 'Title required' }, { message: 'Link required' }] }, 
        value: null, 
      });

      await expect(cardController.default.createCard(cardData))
        .rejects.toThrow('Validation failed: Title required; Link required');
    });
    it('should throw error when database fails', async () => {
      const cardData = { title: 'Test', link: 'http://test.com', img: 'http://test.jpg' };
      Card.validate.mockReturnValue({ error: null, value: cardData });
      mockCreateCard.mockRejectedValue(new Error('Database error'));

      await expect(cardController.default.createCard(cardData))
        .rejects.toThrow('Database error');
    });
    it('should throw error when card data is incomplete', async () => {
      const cardData = { title: 'Test' }; // Fehlender Link und Bild
      Card.validate.mockReturnValue({ 
        error: { details: [{ message: 'Link required' }, { message: 'Image required' }] }, 
        value: null, 
      });
    
      await expect(cardController.default.createCard(cardData))
        .rejects.toThrow('Validation failed: Link required; Image required');
    });
    it('should create and return card when data is valid', async () => {
      const cardData = { title: 'Test', link: 'http://test.com', img: 'http://test.jpg' };
      const dbResult = { id: 1, ...cardData };
      Card.validate.mockReturnValue({ error: null, value: cardData });
      mockCreateCard.mockResolvedValue(dbResult);

      const result = await cardController.default.createCard(cardData);

      expect(result).toBeInstanceOf(Card);
      expect(result.id).toBe(1);
      expect(result.title).toBe('Test');
      expect(result.link).toBe('http://test.com');
      expect(result.img).toBe('http://test.jpg');
    });
  });
  describe('getAllCards', () => {
    it('should return empty array when no cards', async () => {
      mockGetAllCards.mockResolvedValue([]);
      const result = await cardController.default.getAllCards();
      expect(result).toEqual([]);
    });
    it('should return empty array when cards is null', async () => {
      mockGetAllCards.mockResolvedValue(null);
      const result = await cardController.default.getAllCards();
      expect(result).toEqual([]);
    });
    it('should filter out invalid cards', async () => {
      const cards = [
        { id: 1, title: 'Valid Card' },
        { id: 2, title: '' }, // Invalid
        { id: 3, title: 'Another Valid' },
      ];
      
      mockGetAllCards.mockResolvedValue(cards);
      Card.validate
        .mockReturnValueOnce({ error: null, value: cards[0] })
        .mockReturnValueOnce({ error: { details: [{ message: 'Invalid' }] }, value: null })
        .mockReturnValueOnce({ error: null, value: cards[2] });

      const result = await cardController.default.getAllCards();
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Card);
      expect(result[0].id).toBe(1);
      expect(result[0].title).toBe('Valid Card');
      expect(result[1]).toBeInstanceOf(Card);
      expect(result[1].id).toBe(3);
      expect(result[1].title).toBe('Another Valid');
      expect(consoleSpy).toHaveBeenCalledWith('Validation failed for card:', 'Invalid');
    });
    it('should throw error when database fails', async () => {
      mockGetAllCards.mockRejectedValue(new Error('DB Error'));
      
      await expect(cardController.default.getAllCards())
        .rejects.toThrow('DB Error');
    });
    it('should return valid cards', async () => {
      const cards = [
        { id: 1, title: 'Valid Card', link: 'http://valid.com', img: 'http://valid.jpg' },
        { id: 2, title: 'Another Valid', link: 'http://another.com', img: 'http://another.jpg' },
      ];
      
      mockGetAllCards.mockResolvedValue(cards);
      Card.validate
        .mockReturnValueOnce({ error: null, value: cards[0] })
        .mockReturnValueOnce({ error: null, value: cards[1] });

      const result = await cardController.default.getAllCards();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Card);
      expect(result[0].id).toBe(1);
      expect(result[0].title).toBe('Valid Card');
      expect(result[1]).toBeInstanceOf(Card);
      expect(result[1].id).toBe(2);
      expect(result[1].title).toBe('Another Valid');
    });
  });
  describe('getCardById', () => {
    it('should return card when found', async () => {
      const card = { id: 1, title: 'Test', link: 'http://test.com', img: 'http://test.jpg' };
      mockGetCardById.mockResolvedValue(card);
      Card.validate.mockReturnValue({ error: null, value: card });

      const result = await cardController.default.getCardById(1);

      expect(result).toBeInstanceOf(Card);
      expect(result.id).toBe(1);
      expect(result.title).toBe('Test');
      expect(mockGetCardById).toHaveBeenCalledWith(1);
    });
    it('should throw error when card not found', async () => {
      mockGetCardById.mockResolvedValue(null);

      await expect(cardController.default.getCardById(999))
        .rejects.toThrow('Card not found');
    });
    it('should throw error when validation fails', async () => {
      const card = { id: 1, title: '' };
      mockGetCardById.mockResolvedValue(card);
      Card.validate.mockReturnValue({ 
        error: { details: [{ message: 'Invalid card' }] }, 
        value: null, 
      });

      await expect(cardController.default.getCardById(1))
        .rejects.toThrow('Validation failed: Invalid card');
    });
    it('should throw error when database fails', async () => {
      mockGetCardById.mockRejectedValue(new Error('DB timeout'));

      await expect(cardController.default.getCardById(1))
        .rejects.toThrow('DB timeout');
    });
    it('should throw error when card ID is invalid', async () => {
      await expect(cardController.default.getCardById(-1))
        .rejects.toThrow('Invalid card ID');
      await expect(cardController.default.deleteCard('abc'))
        .rejects.toThrow('Invalid card ID');
    });
  });
  describe('deleteCard', () => {
    it('should delete card successfully', async () => {
      mockDeleteCard.mockResolvedValue(true);

      const result = await cardController.default.deleteCard(1);
      
      expect(result).toEqual({
        success: true,
        message: 'Card deleted successfully',
      });
    });
    it('should throw error when card not found', async () => {
      mockDeleteCard.mockResolvedValue(false);

      await expect(cardController.default.deleteCard(999))
        .rejects.toThrow('Card not found or not deleted');
    });
    it('should throw error when database fails', async () => {
      mockDeleteCard.mockRejectedValue(new Error('Delete failed'));

      await expect(cardController.default.deleteCard(1))
        .rejects.toThrow('Delete failed');
    });
  });
});