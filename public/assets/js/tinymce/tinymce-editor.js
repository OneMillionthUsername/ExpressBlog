// TinyMCE Editor - Main Module
// Simplified and modularized version

// Import core modules
import { loadTinyMceScript, showTinyMceApiKeySetup } from './modules/loader.js';
import { getTinyMCEConfig } from './modules/config.js';
import { saveDraft, saveDraftSilent, clearDraft, loadDraft } from './modules/draft.js';
import { updatePreview, togglePreview } from './modules/preview.js';
import { updateTinyMCETheme } from './modules/theme.js';
import { insertTemplate } from './modules/templates.js';

// Import utilities
import { showNotification, checkAndPrefillEditPostForm, getPostIdFromPath } from '../common.js';
import { registerAction } from '../actions/actionRegistry.js';

/**
 * Check if user has admin access
 * @returns {Promise<boolean>}
 */
async function ensureAdminAccess() {
  try {
    const el = document.getElementById('server-config');
   if (el && el.textContent) {
      const cfg = JSON.parse(el.textContent);
      if (cfg && typeof cfg.isAdmin !== 'undefined') {
        return !!cfg.isAdmin;
      }
    }
  } catch { /* ignore */ }

  try {
    const cfgMod = await import('../config.js');
    if (cfgMod && typeof cfgMod.isAdminFromServer === 'function') {
      return !!cfgMod.isAdminFromServer();
    }
  } catch { /* ignore */ }

  return false;
}

/**
 * Initialize TinyMCE editor
 * @returns {Promise<void>}
 */
async function initializeTinyMCE() {
  const contentElement = document.getElementById('content');
  if (!contentElement) {
    console.error('TinyMCE: Element #content not found');
    return;
  }

  // Load TinyMCE script if not already loaded
  if (typeof tinymce === 'undefined') {
    try {
      await loadTinyMceScript();
    } catch (error) {
      console.error('TinyMCE could not be loaded:', error);
      showNotification('Editor konnte nicht geladen werden - verwende einfachen Textbereich', 'warning');
      enableTextareaFallback(contentElement);
      return;
    }
  }

  // Remove existing instance
  if (tinymce.get('content')) {
    tinymce.remove('#content');
  }

  try {
    const config = getTinyMCEConfig();
    await tinymce.init(config);

    const editor = tinymce.get('content');
    if (!editor) {
      throw new Error('Editor could not be initialized');
    }

    // tinymce.init() resolves only after the editor is fully ready (init event already fired).
    // Run post-init logic directly here rather than re-registering an init listener.
    showNotification('Editor bereit!', 'success');

    // Check if editing an existing post
    const isEditMode = (() => {
      try {
        if (document.getElementById('server-post')) return true;
        const path = window.location && window.location.pathname ? window.location.pathname : '';
        if (/\/createPost\//.test(path)) return true;
        const postId = (typeof getPostIdFromPath === 'function') ? getPostIdFromPath() : null;
        if (postId) return true;
        const search = window.location && window.location.search ? window.location.search : '';
        const params = new URLSearchParams(search);
        return !!params.get('post');
      } catch {
        return false;
      }
    })();

    if (isEditMode) {
      // Prefill editor content from server-post JSON or API
      await checkAndPrefillEditPostForm(editor);
    }
    // New post: editor starts empty. Use the "Entwurf laden" button to restore a draft manually.

  } catch (error) {
    console.error('Error initializing TinyMCE:', error);
    contentElement.style.display = 'block';
    contentElement.style.height = '400px';
    contentElement.style.resize = 'vertical';
    showNotification('Editor-Problem - verwende einfachen Textbereich', 'warning');
  }
}

/**
 * Enable simple textarea fallback
 * @param {HTMLElement} contentElement 
 */
function enableTextareaFallback(contentElement) {
  contentElement.className = 'textarea-fallback';
  showNotification('Verwende einfachen Textbereich', 'info');
  contentElement.addEventListener('input', updatePreview);
}

/**
 * Add tag to tags field
 * @param {string} tagName 
 */
function addTag(tagName) {
  const tagsInput = document.getElementById('tags');
  if (!tagsInput) return;

  const currentTags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  if (!currentTags.includes(tagName)) {
    currentTags.push(tagName);
    tagsInput.value = currentTags.join(', ');
    updatePreview();
    saveDraftSilent();
  }
}

/**
 * Restore the last saved draft into the editor (called manually via button)
 */
function restoreDraftToEditor() {
  const draft = loadDraft();
  if (!draft) {
    showNotification('Kein gespeicherter Entwurf gefunden', 'info');
    return;
  }
  try {
    if (draft.title) document.getElementById('title').value = draft.title;
    if (draft.tags) document.getElementById('tags').value = draft.tags;
    const editor = tinymce.get('content');
    if (editor && draft.content) {
      editor.setContent(draft.content);
    } else if (draft.content) {
      const el = document.getElementById('content');
      if (el) el.value = draft.content;
    }
    updatePreview();
    showNotification('Entwurf geladen 📄', 'success');
  } catch (error) {
    console.error('Error restoring draft:', error);
    showNotification('Fehler beim Laden des Entwurfs', 'error');
  }
}

/**
 * Reset form
 */
function resetForm() {
  if (confirm('Möchten Sie wirklich alle Eingaben zurücksetzen?')) {
    try {
      document.getElementById('title').value = '';
      document.getElementById('tags').value = '';
      
      const editor = tinymce.get('content');
      if (editor) {
        editor.setContent('');
      } else {
        document.getElementById('content').value = '';
      }
      
      updatePreview();
      showNotification('Formular zurückgesetzt', 'info');
    } catch (error) {
      console.error('Error resetting form:', error);
      showNotification('Fehler beim Zurücksetzen', 'error');
    }
  }
}

/**
 * Initialize blog editor - main entry point
 */
async function initializeBlogEditor() {
  const hasAdmin = await ensureAdminAccess();
  console.debug('initializeBlogEditor: admin access =', hasAdmin);
  
  if (!hasAdmin) {
    return;
  }

  // Initialize TinyMCE
  console.debug('initializeBlogEditor: initializing TinyMCE...');
  await initializeTinyMCE();

  // Setup event listeners
  const titleElement = document.getElementById('title');
  const tagsElement = document.getElementById('tags');

  if (titleElement) {
    titleElement.addEventListener('input', function() {
      updatePreview();
      saveDraftSilent();
    });
  }

  if (tagsElement) {
    tagsElement.addEventListener('input', function() {
      updatePreview();
      saveDraftSilent();
    });
  }

  // Register actions
  registerCoreActions();

  // Initial preview update
  setTimeout(updatePreview, 500);
  
  console.debug('initializeBlogEditor: complete');
}

/**
 * Register core editor actions
 */
function registerCoreActions() {
  registerAction('saveDraft', saveDraft);
  registerAction('loadDraft', restoreDraftToEditor);
  registerAction('clearDraft', clearDraft);
  registerAction('updatePreview', updatePreview);
  registerAction('togglePreview', togglePreview);
  registerAction('resetForm', resetForm);
  registerAction('showTinyMceApiKeySetup', showTinyMceApiKeySetup);
  registerAction('add-tag', (e, el) => {
    const tag = el?.getAttribute('data-tag');
    if (tag) {
      addTag(tag);
      // Visual feedback: briefly mark chip as added
      if (el) {
        el.classList.add('added');
        setTimeout(() => el.classList.remove('added'), 1500);
      }
    }
  });
  
  // Register template button handlers
  const templateButtons = document.querySelectorAll('[data-template]');
  templateButtons.forEach(button => {
    button.addEventListener('click', function() {
      const templateName = this.getAttribute('data-template');
      if (templateName) {
        insertTemplate(templateName);
      }
    });
  });
}

// Export main functions
export {
  initializeBlogEditor,
  saveDraft,
  saveDraftSilent,
  clearDraft,
  updatePreview,
  togglePreview,
  addTag,
  resetForm,
  updateTinyMCETheme,
  insertTemplate,
};
