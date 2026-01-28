/**
 * Konvertiert ein `published` Feld von verschiedenen Typen zu Boolean.
 * Konvertiert Zahlen (0/1) zu Boolean, und null/undefined zu false.
 * @param {any} published - Der zu konvertierende Wert.
 * @returns {boolean} Der normalisierte Boolean-Wert.
 */
function normalizePublished(published) {
  if (typeof published === 'number') {
    return published === 1;
  } else if (published === null || published === undefined) {
    return false;
  }
  return Boolean(published);
}

export { normalizePublished };