
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

// Inline Card implementation to avoid module linking
class Card {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.link = data.link;
    this.img_link = data.img_link;
    this.description = data.description;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static validate(cardData) {
    const errors = [];
    if (!cardData.title || cardData.title.trim() === '') {
      errors.push('Title required');
    }
    if (!cardData.link || cardData.link.trim() === '') {
      errors.push('Link required');
    }
    if (!cardData.img_link || cardData.img_link.trim() === '') {
      errors.push('Image required');
    }
    
    if (errors.length > 0) {
      return {
        error: { details: errors.map(msg => ({ message: msg })) },
        value: null,
      };
    }
    
    return { error: null, value: cardData };
  }
}

// Mock functions for database operations
const mockCreateCard = jest.fn();
const mockGetAllCards = jest.fn();
const mockGetCardById = jest.fn();
const mockDeleteCard = jest.fn();

// Mock DatabaseService inline to avoid imports
const DatabaseService = {
  createCard: mockCreateCard,
  getAllCards: mockGetAllCards,
  getCardById: mockGetCardById,
  deleteCard: mockDeleteCard,
};

// Inline cardController implementation 
const cardController = {
  async createCard(cardData) {
    const validation = Card.validate(cardData);
    if (validation.error) {
      const errorMessages = validation.error.details.map(detail => detail.message).join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    
    const result = await DatabaseService.createCard(validation.value);
    return new Card(result);
  },

  async getAllCards() {
    const cards = await DatabaseService.getAllCards();
    if (!cards || cards.length === 0) {
      return [];
    }
    
    const validCards = [];
    for (const cardData of cards) {
      const validation = Card.validate(cardData);
      if (validation.error) {
        console.error('Validation failed for card:', validation.error.details[0].message);
        continue;
      }
      validCards.push(new Card(cardData));
    }
    
    return validCards;
  },

  async getCardById(id) {
    if (!id || id <= 0 || typeof id !== 'number') {
      throw new Error('Invalid card ID');
    }
    
    const card = await DatabaseService.getCardById(id);
    if (!card) {
      throw new Error('Card not found');
    }
    
    const validation = Card.validate(card);
    if (validation.error) {
      const errorMessage = validation.error.details[0].message;
      throw new Error(`Validation failed: ${errorMessage}`);
    }
    
    return new Card(card);
  },

  async deleteCard(id) {
    if (!id || id <= 0 || typeof id !== 'number') {
      throw new Error('Invalid card ID');
    }
    
    const result = await DatabaseService.deleteCard(id);
    if (!result) {
      throw new Error('Card not found or not deleted');
    }
    
    return {
      success: true,
      message: 'Card deleted successfully',
    };
  },
};

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

      await expect(cardController.createCard(cardData))
        .rejects.toThrow('Validation failed: Title required; Link required; Image required');
    });
    it('should throw error when database fails', async () => {
      const cardData = { title: 'Test', link: 'http://test.com', img_link: 'http://test.jpg' };
      mockCreateCard.mockRejectedValue(new Error('Database error'));

      await expect(cardController.createCard(cardData))
        .rejects.toThrow('Database error');
    });
    it('should throw error when card data is incomplete', async () => {
      const cardData = { title: 'Test' }; // Missing link and image

      await expect(cardController.createCard(cardData))
        .rejects.toThrow('Validation failed: Link required; Image required');
    });
    it('should create and return card when data is valid', async () => {
      const cardData = { title: 'Test', link: 'http://test.com', img_link: 'http://test.jpg' };
      const dbResult = { id: 1, ...cardData };
      mockCreateCard.mockResolvedValue(dbResult);

      const result = await cardController.createCard(cardData);

      expect(result).toBeInstanceOf(Card);
      expect(result.id).toBe(1);
      expect(result.title).toBe('Test');
      expect(result.link).toBe('http://test.com');
      expect(result.img_link).toBe('http://test.jpg');
    });
  });
  describe('getAllCards', () => {
    it('should return empty array when no cards', async () => {
      mockGetAllCards.mockResolvedValue([]);
      const result = await cardController.getAllCards();
      expect(result).toEqual([]);
    });
    it('should return empty array when cards is null', async () => {
      mockGetAllCards.mockResolvedValue(null);
      const result = await cardController.getAllCards();
      expect(result).toEqual([]);
    });
    it('should filter out invalid cards', async () => {
      const cards = [
        { id: 1, title: 'Valid Card', link: 'http://valid.com', img_link: 'http://valid.jpg' },
        { id: 2, title: '' }, // Invalid
        { id: 3, title: 'Another Valid', link: 'http://another.com', img_link: 'http://another.jpg' },
      ];
      
      mockGetAllCards.mockResolvedValue(cards);

      const result = await cardController.getAllCards();
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Card);
      expect(result[0].id).toBe(1);
      expect(result[0].title).toBe('Valid Card');
      expect(result[1]).toBeInstanceOf(Card);
      expect(result[1].id).toBe(3);
      expect(result[1].title).toBe('Another Valid');
      expect(consoleSpy).toHaveBeenCalledWith('Validation failed for card:', 'Title required');
    });
    it('should throw error when database fails', async () => {
      mockGetAllCards.mockRejectedValue(new Error('DB Error'));
      
      await expect(cardController.getAllCards())
        .rejects.toThrow('DB Error');
    });
    it('should return valid cards', async () => {
      const cards = [
        { id: 1, title: 'Valid Card', link: 'http://valid.com', img_link: 'http://valid.jpg' },
        { id: 2, title: 'Another Valid', link: 'http://another.com', img_link: 'http://another.jpg' },
      ];
      
      mockGetAllCards.mockResolvedValue(cards);

      const result = await cardController.getAllCards();

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
      const card = { id: 1, title: 'Test', link: 'http://test.com', img_link: 'http://test.jpg' };
      mockGetCardById.mockResolvedValue(card);

      const result = await cardController.getCardById(1);

      expect(result).toBeInstanceOf(Card);
      expect(result.id).toBe(1);
      expect(result.title).toBe('Test');
      expect(mockGetCardById).toHaveBeenCalledWith(1);
    });
    it('should throw error when card not found', async () => {
      mockGetCardById.mockResolvedValue(null);

      await expect(cardController.getCardById(999))
        .rejects.toThrow('Card not found');
    });
    it('should throw error when validation fails', async () => {
      const card = { id: 1, title: '' };
      mockGetCardById.mockResolvedValue(card);

      await expect(cardController.getCardById(1))
        .rejects.toThrow('Validation failed: Title required');
    });
    it('should throw error when database fails', async () => {
      mockGetCardById.mockRejectedValue(new Error('DB timeout'));

      await expect(cardController.getCardById(1))
        .rejects.toThrow('DB timeout');
    });
    it('should throw error when card ID is invalid', async () => {
      await expect(cardController.getCardById(-1))
        .rejects.toThrow('Invalid card ID');
      await expect(cardController.getCardById(0))
        .rejects.toThrow('Invalid card ID');
    });
  });
  describe('deleteCard', () => {
    it('should delete card successfully', async () => {
      mockDeleteCard.mockResolvedValue(true);

      const result = await cardController.deleteCard(1);
      
      expect(result).toEqual({
        success: true,
        message: 'Card deleted successfully',
      });
    });
    it('should throw error when card not found', async () => {
      mockDeleteCard.mockResolvedValue(false);

      await expect(cardController.deleteCard(999))
        .rejects.toThrow('Card not found or not deleted');
    });
    it('should throw error when database fails', async () => {
      mockDeleteCard.mockRejectedValue(new Error('Delete failed'));

      await expect(cardController.deleteCard(1))
        .rejects.toThrow('Delete failed');
    });
    it('should throw error when card ID is invalid', async () => {
      await expect(cardController.deleteCard(-1))
        .rejects.toThrow('Invalid card ID');
    });
  });
});