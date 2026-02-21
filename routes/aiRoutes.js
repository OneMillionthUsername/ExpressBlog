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
      return res.status(400).json({ success: false, error: 'Invalid prompt. Must be a string with max 20000 characters.' });
    }

    const safeModel = (typeof model === 'string' && model.trim().length > 0)
      ? model.trim()
      : 'gemini-2.5-flash'; // Stable, free model (2.0 is deprecated)

    const generativeModel = genAI.getGenerativeModel({ 
      model: safeModel,
      // Wenn systemInstruction gesetzt ist (truthy), wird das Objekt { systemInstruction } 
      // in das Objekt für getGenerativeModel eingebaut. Ist systemInstruction nicht gesetzt, 
      // passiert nichts.
      // Kurz: Das ist eine elegante Möglichkeit, ein optionales Feld
      // nur dann zu übergeben, wenn es vorhanden ist. 
      ...(systemInstruction && { systemInstruction }),
    });

    const result = await generativeModel.generateContent(prompt);
    const aiText = result.response.text() || '';
    
    return res.json({ success: true, data: { text: aiText } });
  } catch (err) {
    logger.error('AI generate route error', { 
      error: err.message, 
      status: err.status || err.statusCode,
      model: req.body?.model || 'gemini-2.5-flash',
      stack: err.stack,
    });
    
    // Provide helpful error messages
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    
    if (err.message?.includes('API key')) {
      statusCode = 502;
      errorMessage = 'API authentication failed - check API key configuration';
    } else if (err.message?.includes('quota') || err.message?.includes('429')) {
      statusCode = 429;
      errorMessage = 'API quota exceeded - please try again later';
    } else if (err.message?.includes('model') || err.message?.includes('404')) {
      statusCode = 400;
      errorMessage = 'Model not found or unavailable';
    }
    
    return res.status(statusCode).json({ success: false, error: errorMessage });
  }
});

export default router;
