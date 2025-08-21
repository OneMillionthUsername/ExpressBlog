import { DatabaseService } from "../databases/mariaDB";
import { cardModel } from "../models/cardModel";

const createCard = async (cardData) => {
    try {
        const card = await DatabaseService.createCard(cardData);
        return new cardModel(card);
    } catch (error) {
        console.error('Error creating card:', error);
        throw error;
    }
}

const getAllCards = async () => {
    try {
        const cards = DatabaseService.getAllCards();
        if (!cards || cards.length === 0) {
            return [];
        }
        
        return cards.map(card => new cardModel(card));
    } catch (error) {
        console.error('Error getting all cards:', error);
        throw error;
    }
}

const getCardById = async (id) => {
    try {
        const card = await DatabaseService.getCardById(id);
        return new cardModel(card);
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
        return { success: true };
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