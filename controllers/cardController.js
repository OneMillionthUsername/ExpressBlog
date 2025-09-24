import { DatabaseService } from '../databases/mariaDB.js';
import { Card } from '../models/cardModel.js';
import { CardControllerException } from '../models/customExceptions.js';

/**
 * Erstellt eine neue Karte (Card) nach Validierung der Eingabedaten.
 *
 * @param {Object} cardData - Rohdaten für die Karte (title, description, img_link, etc.).
 * @returns {Promise<Card>} Die erstellte und validierte `Card`-Instanz.
 * @throws {CardControllerException} Wenn die Validierung oder DB-Operation fehlschlägt.
 */
const createCard = async (cardData) => {
  const { error, value } = Card.validate(cardData);
  if (error) {
    throw new CardControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
  }
  try {
    const result = await DatabaseService.createCard(value);
    // DatabaseService.createCard returns { success: true, card: {...} }
    const created = result && result.card ? result.card : result;
    return new Card(created);
  } catch (error) {
    throw new CardControllerException(`Error creating card: ${error.message}`, error);
  }
};
/**
 * Liest alle Karten aus der Datenbank, validiert jede Karte und gibt
 * ein Array von `Card`-Instanzen zurück. Ungültige Einträge werden übersprungen.
 *
 * @returns {Promise<Card[]>} Array gültiger `Card`-Instanzen (leer wenn keine Karten).
 * @throws {CardControllerException} Bei internen Fehlern beim Lesen aus der DB.
 */
const getAllCards = async () => {
  try {
    const cards = await DatabaseService.getAllCards();
    if (!cards || cards.length === 0) {
      return [];
    }
    // validate
    const validCards = [];
    for (const card of cards) {
      const { error, value } = Card.validate(card);
      if (error) {
        console.error('Validation failed for card:', error.details.map(d => d.message).join('; '));
        continue;
      }
      validCards.push(new Card(value));
    }
    return validCards;
  } catch (error) {
    throw new CardControllerException(`Error getting all cards: ${error.message}`, error);
  }
};
/**
 * Holt eine Karte anhand ihrer numerischen ID, validiert sie und gibt
 * die `Card`-Instanz zurück.
 *
 * @param {number} id - Numerische ID der Karte (größer als 0).
 * @returns {Promise<Card>} Validierte `Card`-Instanz.
 * @throws {CardControllerException} Bei ungültiger ID, nicht gefunden oder Validierungsfehler.
 */
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
/**
 * Löscht eine Karte anhand ihrer ID.
 *
 * @param {number} id - Numerische ID der Karte.
 * @returns {Promise<Object>} Ergebnisobjekt mit Erfolgsmeldung.
 * @throws {CardControllerException} Bei ungültiger ID oder wenn das Löschen fehlschlägt.
 */
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