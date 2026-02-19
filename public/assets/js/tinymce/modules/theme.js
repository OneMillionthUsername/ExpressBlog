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
    const editorBody = editor.getBody();
    
    if (!editorBody) return;
    
    if (isDarkMode) {
      editorBody.style.backgroundColor = '#1e1e1e';
      editorBody.style.color = '#e0e0e0';
    } else {
      editorBody.style.backgroundColor = '#ffffff';
      editorBody.style.color = '#2c3e50';
    }
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
