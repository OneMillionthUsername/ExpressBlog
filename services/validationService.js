/**
 * Für unkritische Validierung gedacht.
 * Backend wird mit Joi und Celebrate validiert.
 */
// Note: do not import Node's 'url' module here because this service is imported
// both by server-side code and by client-side ESM modules under `public/assets/js`.
// Browsers provide a global `URL` constructor, so rely on that to validate URLs.
/**
 * Validiert eine ID.
 * @param {*} id - Die zu prüfende ID.
 * @returns {boolean} - Ob die ID gültig ist.
 */
export function isValidIdSchema(id) {
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
export function isValidStringSchema(str, { min = 1, max = 1000, pattern = null, blacklist = [] } = {}) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed.length < min || trimmed.length > max) return false;
  if (pattern && !pattern.test(trimmed)) return false;
  if (blacklist.some(word => trimmed.includes(word))) return false;
  return true;
}
export function isValidUrlSchema(url) {
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
export function isValidDateSchema(dateStr, { notPast = false, notFuture = false } = {}) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  if (notPast && date < now) return false;
  if (notFuture && date > now) return false;
  return true;
}
export function containsVisibleCharSchema(str) {
  // Entfernt alle Whitespace- und unsichtbaren Unicode-Zeichen
  // und prüft, ob mindestens ein sichtbares Zeichen übrig bleibt
  return /[^\s\u200B-\u200D\uFEFF]/.test(str);
}
export function isValidUsernameSchema(username) {
  if (typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 50) return false;
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return false;
  return true;
}
export function isValidCommentSchema(commentText) {
  if (typeof commentText !== 'string') return false;
  const trimmed = commentText.trim();
  if (trimmed.length < 1 || trimmed.length > 1000) return false;
  if (!containsVisibleCharSchema(trimmed)) return false;
  return true;
}
/**
 * Validiert ein Passwort nach gängigen Kriterien.
 * Mindestlänge, Groß-/Kleinbuchstaben, Zahl und Sonderzeichen.
 * @param {string} password
 * @returns {boolean}
 */
export function isValidPasswordSchema(password) {
  if (typeof password !== 'string') return false;
  const trimmed = password.trim();
  if (trimmed.length < 8) return false; // Mindestlänge
  if (!/[A-Z]/.test(trimmed)) return false; // Großbuchstabe
  if (!/[a-z]/.test(trimmed)) return false; // Kleinbuchstabe
  if (!/[0-9]/.test(trimmed)) return false; // Zahl
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(trimmed)) return false; // Sonderzeichen
  return true;
}

const validationService = {
  isValidIdSchema,
  isValidStringSchema,
  isValidUrlSchema,
  isValidDateSchema,
  containsVisibleCharSchema,
  isValidUsernameSchema,
  isValidCommentSchema,
  isValidPasswordSchema,
};

export default validationService;