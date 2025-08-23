import express from 'express';
import { requireAdmin, authenticateToken } from "../middleware/authMiddleware";
import { globalLimiter } from "../utils/limiters.js";

const extensionRouter = express.Router();

// ===========================================
// API ENDPOINTS
// ===========================================
extensionRouter.get('/tinymce-key', globalLimiter, authenticateToken, requireAdmin, async (req, res) => {
    if (!process.env.TINYMCE_API_KEY) {
        return res.status(404).json({ error: 'TINYMCE_API_KEY is not set in environment variables.' });
    }
    res.json({ apiKey: process.env.TINYMCE_API_KEY });
});

extensionRouter.get('/google-api-key', globalLimiter, authenticateToken, requireAdmin, async (req, res) => {
    if (!process.env.GOOGLE_API_KEY) {
        return res.status(404).json({ error: 'Google API Key not set in environment variables.' });
    }
    res.json({ apiKey: process.env.GOOGLE_API_KEY });
});