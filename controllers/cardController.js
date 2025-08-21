import { DatabaseService } from "../databases/mariaDB";
import { Card } from "../models/cardModel";

const createCard = async (cardData) => {
    const { error, value } = Card.validate(cardData);
    if (error) {
        throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    try {
        const card = await DatabaseService.createCard(value);
        return new Card(card);
    } catch (error) {
        console.error('Error creating card:', error);
        throw error;
    }
}

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
        console.error('Error getting all cards:', error);
        throw error;
    }
}

const getCardById = async (id) => {
    try {
        const card = await DatabaseService.getCardById(id);
        if (!card) {
            throw new Error('Card not found');
        }
        const { error, value } = Card.validate(card);
        if (error) {
            throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
        }
        return new Card(value);
    } catch (error) {
        console.error('Error getting card by id:', error);
        throw error;
    }
}

const deleteCard = async (id) => {
    try {
        const deleted = await DatabaseService.deleteCard(id);
        if (!deleted) {
            throw new Error('Card not found or not deleted');
        }
        return { success: true, message: 'Card deleted successfully' };
    } catch (error) {
        console.error('Error deleting card:', error);
        throw error;
    }
}

export default {
    createCard,
    getAllCards,
    getCardById,
    deleteCard
}