import validationService from '../services/validationService.js';
import { postSchema } from '../models/postModel.js';
import { createSlug } from '../utils/utils.js';
import { fileTypeFromBuffer } from 'file-type';
import { sanitizeFilename } from '../utils/utils.js';

function validateId(req, res, next) {
  const postId = req.params.postId;
  if (!validationService.isValidIdSchema(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  next();
}
function validatePostBody(req, res, next) {
  const { error, value } = postSchema.validate({
    ...req.body,
    slug: req.body.title ? createSlug(req.body.title) : undefined,
    author: req.user?.username || 'unknown',
    created_at: new Date(),
    updated_at: new Date(),
  }, { abortEarly: false, stripUnknown: true });

  if (error) {
    return res.status(400).json({ error: 'Ungültige Blogpost-Daten', details: error.details });
  }
  req.validatedPost = value;
  next();
}
//generische Middleware-Funktion zur Validierung von Feldern
function validateFields(rules) {
  return function (req, res, next) {
    for (const [location, fields] of Object.entries(rules)) {
      const source = req[location] || {};
      for (const [field, rule] of Object.entries(fields)) {
        const value = source[field];
        // Pflichtfeld
        if (rule.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
          return res.status(400).json({ error: `Feld "${field}" ist erforderlich.` });
        }
        // Typ-Check
        if (rule.type && typeof value !== rule.type && value !== undefined) {
          return res.status(400).json({ error: `Feld "${field}" muss vom Typ ${rule.type} sein.` });
        }
        // Länge
        if (rule.min !== undefined && typeof value === 'string' && value.trim().length < rule.min) {
          return res.status(400).json({ error: `Feld "${field}" ist zu kurz.` });
        }
        if (rule.max !== undefined && typeof value === 'string' && value.trim().length > rule.max) {
          return res.status(400).json({ error: `Feld "${field}" ist zu lang.` });
        }
        // Pattern
        if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
          return res.status(400).json({ error: `Feld "${field}" hat ein ungültiges Format.` });
        }
      }
    }
    next();
  };
}
function validateSlug(req, res, next) {
  // Guard against req.body being undefined (GET requests may not have a body)
  const slug = (req.body && req.body.slug) || req.params.slug;
  // Slug muss vorhanden sein, 3-50 Zeichen, nur a-z, 0-9, Bindestrich
  const slugPattern = /^[a-z0-9-]{3,50}$/;
  if (!slug || typeof slug !== 'string' || !slugPattern.test(slug)) {
    return res.status(400).json({ error: 'Ungültiger Slug. Erlaubt sind nur Kleinbuchstaben, Zahlen und Bindestriche (3-100 Zeichen).' });
  }
  next();
}
async function validateMediaFile(file, allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']) {
  // 1. Dateiname prüfen
  if (!file.originalname || sanitizeFilename(file.originalname) !== file.originalname) {
    return { valid: false, error: 'Ungültiger Dateiname.' };
  }
  // 2. MIME-Type prüfen (laut Buffer, nicht nur laut Upload)
  const type = await fileTypeFromBuffer(file.buffer);
  if (!type || !allowedMimeTypes.includes(type.mime)) {
    return { valid: false, error: 'Nicht erlaubter Dateityp.' };
  }
  // 3. Größe prüfen (z.B. max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'Datei zu groß.' };
  }
  // 4. Optional: Virenscan (ClamAV)
  // ... clamav.js Integration ...
  return { valid: true };
}
export {
  validateId,
  validatePostBody,
  validateFields,
  validateSlug,
  validateMediaFile,
};