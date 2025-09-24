import express from 'express';
import logger from '../utils/logger.js';
/* global fetch */
import { GEMINI_API_KEY } from '../config/config.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

/**
 * AI helper routes (protected admin-only endpoints).
 *
 * Example: POST /generate - forwards prompt to upstream Gemini API and
 * returns generated text. These endpoints are admin-only and expect JSON.
 */
const router = express.Router();

// POST /api/ai/generate
router.post('/generate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || prompt.length > 20000) {
      return res.status(400).json({ success: false, error: 'Invalid prompt' });
    }

    // TODO: add rate limiting here

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
      contents: [{ parts: [{ text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!r.ok) {
      const errBody = await r.text().catch(() => null);
      logger.error('Gemini upstream error', { status: r.status, body: errBody });
      return res.status(502).json({ success: false, error: 'Upstream AI service error' });
    }

    const data = await r.json();
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.json({ success: true, data: { text: aiText } });
  } catch (err) {
    logger.error('AI generate route error', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
