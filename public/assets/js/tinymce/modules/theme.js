// Theme Module
// Handles dark mode and theme switching for TinyMCE

/**
 * Apply theme to TinyMCE editor
 * @param {Object} editor - TinyMCE editor instance
 */
export function applyTinyMCETheme(editor) {
  if (!editor || !editor.getBody) return;
  try {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const body = editor.getBody();
    if (!body) return;
    // Toggle CSS class on the editor body — styles defined in tinymce-content.css.
    // This avoids injecting inline <style> tags which require CSP nonces.
    body.classList.toggle('dark-mode', isDarkMode);
  } catch (error) {
    console.error('Error applying TinyMCE theme:', error);
  }
}

/**
 * Update TinyMCE theme for all editors
 */
export function updateTinyMCETheme() {
  if (typeof tinymce === 'undefined') return;
  
  const editor = tinymce.get('content');
  if (editor) {
    applyTinyMCETheme(editor);
  }
}
