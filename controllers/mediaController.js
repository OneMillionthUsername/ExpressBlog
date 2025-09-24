import { DatabaseService } from '../databases/mariaDB.js';
import { Media } from '../models/mediaModel.js';
import fs from 'fs/promises';
import _path from 'path';

/**
 * Fügt ein neues Media-Objekt zur Datenbank hinzu, validiert das Ergebnis
 * und gibt die vollständige `Media`-Instanz zurück.
 *
 * @param {Object} mediaData - Metadata für das Medium (path, filename, postId, etc.).
 * @returns {Promise<Media>} Die erstellte und validierte `Media`-Instanz.
 * @throws {Error} Bei Validierungs- oder DB-Fehlern.
 */
const addMedia = async (mediaData) => {
  const { error, value } = Media.validate(mediaData);
  if (error) {
    throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
  }
  try {
    const mediaId = await DatabaseService.addMedia(value);
        
    // Zurück das vollständige Media-Objekt holen
    const media = await DatabaseService.getMediaById(mediaId);
    if (!media) throw new Error('Media not found after creation');
        
    const { error: valError, value: valValue } = Media.validate(media);
    if (valError) throw new Error('Validation failed after creation');
        
    return new Media(valValue);
  } catch (error) {
    console.error('Error adding media:', error);
    throw error;
  }
};
/**
 * Löscht ein Medium aus Datenbank und, falls vorhanden, die zugehörige Datei vom Filesystem.
 *
 * @param {number} media_id - Die ID des Mediums.
 * @returns {Promise<Object>} Ergebnisobjekt mit Erfolgsmeldung.
 * @throws {Error} Bei Fehlern beim Löschen.
 */
const deleteMedia = async (media_id) => {
  try {
    // Erst Media-Info holen für Dateipfad
    const media = await DatabaseService.getMediaById(media_id);
    if (!media) {
      throw new Error('Media not found');
    }
        
    // Aus Datenbank löschen
    const result = await DatabaseService.deleteMedia(media_id);
    if (!result) {
      throw new Error('Media not deleted from database');
    }
        
    // Datei vom Dateisystem löschen
    try {
      await fs.unlink(media.path);
    } catch (fileError) {
      console.warn('Could not delete file:', media.path, fileError.message);
      // Nicht fatal - Datenbank ist bereits bereinigt
    }
        
    return { success: true, message: 'Media deleted successfully' };
  } catch (error) {
    console.error('Error deleting media:', error);
    throw error;
  }
};
/**
 * Liefert alle Media-Einträge zu einem Post und validiert jedes Element.
 * Ungültige Einträge werden übersprungen.
 *
 * @param {number} postId - Die ID des Posts.
 * @returns {Promise<Media[]>} Array gültiger `Media`-Instanzen.
 * @throws {Error} Bei DB-Fehlern.
 */
const getMediaByPostId = async (postId) => {
  try {
    const mediaList = await DatabaseService.getMediaByPostId(postId);
    if (!mediaList || mediaList.length === 0) {
      return [];
    }
        
    const validMedia = [];
    for (const media of mediaList) {
      const { error, value } = Media.validate(media);
      if (error) {
        console.error('Invalid media data:', error.details.map(d => d.message).join('; '));
        continue;
      }
      validMedia.push(new Media(value));
    }
        
    return validMedia;
  } catch (error) {
    console.error('Error fetching media by postId:', error);
    throw error;
  }
};
export default {
  addMedia,
  deleteMedia,
  getMediaByPostId,
};