import { describe, expect, it, jest, beforeEach } from '@jest/globals';

// 1. Module mocken BEVOR sie importiert werden
jest.unstable_mockModule('../databases/mariaDB.js', () => ({
  DatabaseService: {
    createCard: jest.fn(),
    getAllCards: jest.fn(),
    getCardById: jest.fn(),
    deleteCard: jest.fn()
  }
}));

jest.unstable_mockModule('../models/cardModel.js', () => {
  const CardMock = jest.fn().mockImplementation((data) => data);
  CardMock.validate = jest.fn();
  return { Card: CardMock }; // ← Named export Card mocken
});

// 2. NACH dem Mocken importieren
const { DatabaseService } = await import('../databases/mariaDB.js');
const { Card } = await import('../models/cardModel.js');
const cardController = await import('../controllers/cardController.js');

let consoleSpy;

beforeEach(() => {
  jest.clearAllMocks();
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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
      value: null 
    });

    await expect(cardController.default.createCard(cardData))
      .rejects.toThrow('Validation failed: Title required; Link required');
  });
  it('should throw error when database fails', async () => {
    const cardData = { title: 'Test', link: 'http://test.com', img: 'http://test.jpg' };
    Card.validate.mockReturnValue({ error: null, value: cardData });
    DatabaseService.createCard.mockRejectedValue(new Error('Database error'));

    await expect(cardController.default.createCard(cardData))
      .rejects.toThrow('Database error');
    
    expect(consoleSpy).toHaveBeenCalledWith('Error creating card:', expect.any(Error));
  });
  it('should throw error when card data is incomplete', async () => {
    const cardData = { title: 'Test' }; // Fehlender Link und Bild
    Card.validate.mockReturnValue({ 
      error: { details: [{ message: 'Link required' }, { message: 'Image required' }] }, 
      value: null 
    });
  
    await expect(cardController.default.createCard(cardData))
      .rejects.toThrow('Validation failed: Link required; Image required');
  });
});
describe('getAllCards', () => {
  it('should return empty array when no cards', async () => {
    DatabaseService.getAllCards.mockResolvedValue([]);
    const result = await cardController.default.getAllCards();
    expect(result).toEqual([]);
  });
  it('should return empty array when cards is null', async () => {
    DatabaseService.getAllCards.mockResolvedValue(null);
    const result = await cardController.default.getAllCards();
    expect(result).toEqual([]);
  });
  it('should filter out invalid cards', async () => {
    const cards = [
      { id: 1, title: 'Valid Card' },
      { id: 2, title: '' }, // Invalid
      { id: 3, title: 'Another Valid' }
    ];
    
    DatabaseService.getAllCards.mockResolvedValue(cards);
    Card.validate
      .mockReturnValueOnce({ error: null, value: cards[0] })
      .mockReturnValueOnce({ error: { details: [{ message: 'Invalid' }] }, value: null })
      .mockReturnValueOnce({ error: null, value: cards[2] });

    const result = await cardController.default.getAllCards();
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(cards[0]);
    expect(result[1]).toEqual(cards[2]);
    expect(consoleSpy).toHaveBeenCalledWith('Validation failed for card:', 'Invalid');
  });
  it('should throw error when database fails', async () => {
    DatabaseService.getAllCards.mockRejectedValue(new Error('DB Error'));
    
    await expect(cardController.default.getAllCards())
      .rejects.toThrow('DB Error');
    
    expect(consoleSpy).toHaveBeenCalledWith('Error getting all cards:', expect.any(Error));
  });
  it('should return valid cards', async () => {
    const cards = [
      { id: 1, title: 'Valid Card', link: 'http://valid.com', img: 'http://valid.jpg' },
      { id: 2, title: 'Another Valid', link: 'http://another.com', img: 'http://another.jpg' }
    ];
    
    DatabaseService.getAllCards.mockResolvedValue(cards);
    Card.validate
      .mockReturnValueOnce({ error: null, value: cards[0] })
      .mockReturnValueOnce({ error: null, value: cards[1] });

    const result = await cardController.default.getAllCards();
    
    expect(result).toEqual([
      { id: 1, title: 'Valid Card', link: 'http://valid.com', img: 'http://valid.jpg' },
      { id: 2, title: 'Another Valid', link: 'http://another.com', img: 'http://another.jpg' }
    ]);
  });
});
describe('getCardById', () => {
  it('should return card when found', async () => {
    const card = { id: 1, title: 'Test' };
    DatabaseService.getCardById.mockResolvedValue(card);
    Card.validate.mockReturnValue({ error: null, value: card });

    const result = await cardController.default.getCardById(1);
    
    expect(result).toEqual(card);
    expect(DatabaseService.getCardById).toHaveBeenCalledWith(1);
  });
  it('should throw error when card not found', async () => {
    DatabaseService.getCardById.mockResolvedValue(null);

    await expect(cardController.default.getCardById(999))
      .rejects.toThrow('Card not found');
    
    expect(consoleSpy).toHaveBeenCalledWith('Error getting card by id:', expect.any(Error));
  });
  it('should throw error when validation fails', async () => {
    const card = { id: 1, title: '' };
    DatabaseService.getCardById.mockResolvedValue(card);
    Card.validate.mockReturnValue({ 
      error: { details: [{ message: 'Invalid card' }] }, 
      value: null 
    });

    await expect(cardController.default.getCardById(1))
      .rejects.toThrow('Validation failed: Invalid card');
  });
  it('should throw error when database fails', async () => {
    DatabaseService.getCardById.mockRejectedValue(new Error('DB timeout'));

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
    DatabaseService.deleteCard.mockResolvedValue(true);

    const result = await cardController.default.deleteCard(1);
    
    expect(result).toEqual({
      success: true,
      message: 'Card deleted successfully'
    });
  });

  it('should throw error when card not found', async () => {
    DatabaseService.deleteCard.mockResolvedValue(false);

    await expect(cardController.default.deleteCard(999))
      .rejects.toThrow('Card not found or not deleted');
  });

  it('should throw error when database fails', async () => {
    DatabaseService.deleteCard.mockRejectedValue(new Error('Delete failed'));

    await expect(cardController.default.deleteCard(1))
      .rejects.toThrow('Delete failed');
    
    expect(consoleSpy).toHaveBeenCalledWith('Error deleting card:', expect.any(Error));
  });
});
});