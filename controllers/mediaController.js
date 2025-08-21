import { DatabaseService } from "../databases/mariaDB";
import { mediaModel } from "../models/mediaModel.js";

const addMedia = async (mediaData) => {
    try {
        const media = await DatabaseService.addMedia(mediaData);
        return new mediaModel(media);
    } catch (error) {
        console.error('Error adding media:', error);
        throw error;
    }
}

const deleteMedia = async (media_id) => {
    try {
        const result = await DatabaseService.deleteMedia(media_id);
        if (!result) {
            throw new Error('Media not found or not deleted');
        }
        return { success: true, message: 'Media deleted successfully' };
    } catch (error) {
        console.error('Error deleting media:', error);
        throw error;
    }
}

export default {
    addMedia,
    deleteMedia
}