/**
 * Für unkritische Validierung gedacht.
 * Backend wird mit Joi und Celebrate validiert.
 */
import { URL } from 'url';
/**
 * Validiert eine ID.
 * @param {*} id - Die zu prüfende ID.
 * @returns {boolean} - Ob die ID gültig ist.
 */

function validateIdSchema(id) {
    // Prüft, ob die ID existiert, ein String ist, nur Ziffern enthält und positiv ist
    if (typeof id !== 'string') return false;
    const trimmed = id.trim();
    // Optional: Mindestlänge prüfen (z.B. 1)
    if (trimmed.length === 0) return false;
    // Nur Ziffern erlaubt (z.B. für numerische IDs)
    if (!/^\d+$/.test(trimmed)) return false;
    // Optional: Positive Zahl
    if (parseInt(trimmed, 10) <= 0) return false;
    return true;
}

function validateStringSchema(str, { min = 1, max = 1000, pattern = null, blacklist = [] } = {}) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (trimmed.length < min || trimmed.length > max) return false;
    if (pattern && !pattern.test(trimmed)) return false;
    if (blacklist.some(word => trimmed.includes(word))) return false;
    return true;
}

function validateUrlSchema(url) {
    try {
        const u = new URL(url);
        // Nur http/https erlauben
        if (!['http:', 'https:'].includes(u.protocol)) return false;
        // Optional: Maximale Länge
        if (url.length > 2048) return false;
        return true;
    } catch {
        return false;
    }
}

function validateDateSchema(dateStr, { notPast = false, notFuture = false } = {}) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    if (notPast && date < now) return false;
    if (notFuture && date > now) return false;
    return true;
}

const validationService = {
    validateId,
    validateString,
    validateUrl,
    validateDate,
    validateFields
};

export default validationService;