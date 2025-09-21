// Client-side validation helpers (browser-safe)
// Keep behavior compatible with server-side services/validationService.js for shared checks

export function isValidIdSchema(id) {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length === 0) return false;
  if (!/^\d+$/.test(trimmed)) return false;
  if (parseInt(trimmed, 10) <= 0) return false;
  return true;
}

export function isValidUsernameSchema(username) {
  if (typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 50) return false;
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return false;
  return true;
}

export function containsVisibleCharSchema(str) {
  return /[^\s\u200B-\u200D\uFEFF]/.test(str);
}

export function isValidCommentSchema(commentText) {
  if (typeof commentText !== 'string') return false;
  const trimmed = commentText.trim();
  if (trimmed.length < 1 || trimmed.length > 1000) return false;
  if (!containsVisibleCharSchema(trimmed)) return false;
  return true;
}

export default {
  isValidIdSchema,
  isValidUsernameSchema,
  isValidCommentSchema,
  containsVisibleCharSchema,
};
