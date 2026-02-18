import express from 'express';
import logger from '../utils/logger.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config/config.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import csrfProtection from '../utils/csrf.js';

/**
 * AI helper routes (protected admin-only endpoints).
 *
 * Uses the official Google Generative AI SDK for cleaner, simpler code.
 * Example: POST /generate - forwards prompt to Gemini API and returns generated text.
 */
const router = express.Router();
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// POST /api/ai/generate
router.post('/generate', csrfProtection, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { prompt, systemInstruction, model } = req.body || {};
    
    if (!prompt || typeof prompt !== 'string' || prompt.length > 20000) {
      return res.status(400).json({ success: false, error: 'Invalid prompt' });
    }

    const safeModel = (typeof model === 'string' && model.trim().length > 0)
      ? model.trim()
      : 'gemini-2.0-flash-exp';

    const generativeModel = genAI.getGenerativeModel({ 
      model: safeModel,
      ...(systemInstruction && { systemInstruction }),
    });

    const result = await generativeModel.generateContent(prompt);
    const aiText = result.response.text() || '';
    
    return res.json({ success: true, data: { text: aiText } });
  } catch (err) {
    logger.error('AI generate route error', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
