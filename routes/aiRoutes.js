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
const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';
const FALLBACK_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function isModelAvailabilityError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('model')
    || msg.includes('404')
    || msg.includes('not found')
    || msg.includes('unavailable')
    || msg.includes('deprecated')
  );
}

// POST /api/ai/generate
router.post('/generate', csrfProtection, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { prompt, systemInstruction, model } = req.body || {};
    
    if (!prompt || typeof prompt !== 'string' || prompt.length > 20000) {
      return res.status(400).json({ success: false, error: 'Invalid prompt. Must be a string with max 20000 characters.' });
    }

    const safeModel = (typeof model === 'string' && model.trim().length > 0)
      ? model.trim()
      : DEFAULT_GEMINI_MODEL;

    const modelCandidates = [
      safeModel,
      ...FALLBACK_GEMINI_MODELS.filter((candidate) => candidate !== safeModel),
    ];

    let usedModel = modelCandidates[0];
    let result;
    let lastError;

    for (let i = 0; i < modelCandidates.length; i += 1) {
      const candidateModel = modelCandidates[i];
      try {
        const generativeModel = genAI.getGenerativeModel({
          model: candidateModel,
          ...(systemInstruction && { systemInstruction }),
        });
        result = await generativeModel.generateContent(prompt);
        usedModel = candidateModel;
        break;
      } catch (modelErr) {
        lastError = modelErr;
        const hasNextCandidate = i < modelCandidates.length - 1;
        if (!isModelAvailabilityError(modelErr) || !hasNextCandidate) {
          throw modelErr;
        }

        logger.warn('Gemini model unavailable, retrying with next fallback model', {
          failedModel: candidateModel,
          nextModel: modelCandidates[i + 1],
          error: modelErr.message,
        });
      }
    }

    if (!result) {
      throw lastError || new Error('No Gemini model available');
    }

    const aiText = result.response.text() || '';
    
    return res.json({ success: true, data: { text: aiText, model: usedModel } });
  } catch (err) {
    logger.error('AI generate route error', { 
      error: err.message, 
      status: err.status || err.statusCode,
      model: req.body?.model || DEFAULT_GEMINI_MODEL,
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
