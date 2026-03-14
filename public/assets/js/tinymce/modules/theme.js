// Theme Module
// Design is always dark — tinymce-content.css handles all styling.
// These functions are kept as no-ops for API compatibility.

/**
 * Apply theme to TinyMCE editor (no-op, always dark via CSS)
 * @param {Object} _editor - TinyMCE editor instance (unused)
 */
export function applyTinyMCETheme(_editor) {
  // No-op: tinymce-content.css is always dark
}

/**
 * Update TinyMCE theme for all editors (no-op, always dark via CSS)
 */
export function updateTinyMCETheme() {
  // No-op: tinymce-content.css is always dark
}
