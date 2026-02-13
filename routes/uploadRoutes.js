// routes/uploadRoutes.js
import express from 'express';
import { imageUpload } from '../middleware/uploadMiddleware.js';
import mediaController from '../controllers/mediaController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { strictLimiter } from '../utils/limiters.js';
import { validateMediaFile } from '../middleware/validationMiddleware.js';
import csrfProtection from '../utils/csrf.js';

/**
 * Routes for media uploads.
 *
 * - `POST /image` accepts multipart/form-data with an `image` field and
 *   stores metadata in the media table. Only authenticated admins may
 *   create media entries.
 */
const uploadRouter = express.Router();

uploadRouter.post('/image', 
  strictLimiter,
  csrfProtection,
  imageUpload.single('image'), 
  validateMediaFile,
  authenticateToken,
  requireAdmin, 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No file uploaded', 
        });
      }
      // Media-Objekt für Datenbank erstellen
      const mediaData = {
        postId: req.body.postId || null, // Optional: falls Bild zu Post gehört
        original_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        uploaded_by: req.user.username, // Aus Auth-Middleware
        path: req.file.path,
        alt_text: req.body.alt_text || null,
      };
      // Media in Datenbank speichern
      const result = await mediaController.addMedia(mediaData);
      res.json({
        success: true,
        message: 'Image uploaded successfully',
        media: {
          id: result.id,
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: req.file.path,
          size: req.file.size,
          mimeType: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      // Datei löschen bei Fehler
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Upload failed', 
      });
    }
  });

export default uploadRouter;