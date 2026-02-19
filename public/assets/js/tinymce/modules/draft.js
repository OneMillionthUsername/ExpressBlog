// Draft Management Module
// Handles saving and restoring blog post drafts to/from localStorage

import { showNotification } from '../../common.js';
import { updatePreview } from './preview.js';

const DRAFT_KEY = 'blogpost_draft_content';

/**
 * Save draft silently to localStorage (no notification)
 * @returns {boolean} Success status
 */
export function saveDraftSilent() {
  try {
    const title = document.getElementById('title')?.value || '';
    let content = '';

    // Get content from TinyMCE or textarea
    const tinymceEditor = tinymce.get('content');
    if (tinymceEditor) {
      content = tinymceEditor.getContent();
    } else {
      const contentElement = document.getElementById('content');
      if (contentElement) {
        content = contentElement.value;
      }
    }

    const tags = document.getElementById('tags')?.value || '';

    const draftData = {
      title: title,
      content: content,
      tags: tags,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    return true;
  } catch (err) {
    showNotification('Entwurf konnte nicht gespeichert werden', 'error');
    console.error('saveDraftSilent error:', err);
    return false;
  }
}

/**
 * Save draft with user notification
 * @returns {boolean} Success status
 */
export function saveDraft() {
  const ok = saveDraftSilent();
  if (ok) {
    showNotification('Entwurf gespeichert 📄', 'success');
  } else {
    showNotification('Entwurf konnte nicht gespeichert werden', 'error');
  }
  return ok;
}

/**
 * Clear draft from localStorage and editor
 * @returns {boolean} Success status
 */
export function clearDraft() {
  let removed = true;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    removed = false;
    console.error('clearDraft error:', err);
    showNotification('Entwurf konnte nicht gelöscht werden', 'error');
  }

  // Clear editor/UI
  try {
    const tinymceEditor = tinymce.get('content');
    if (tinymceEditor) {
      tinymceEditor.setContent('');
    } else {
      const contentElement = document.getElementById('content');
      if (contentElement) {
        contentElement.value = '';
      }
    }
  } catch (err) {
    console.warn('clearDraft: failed to clear editor content', err);
  }

  try { document.getElementById('title').value = ''; } catch (err) { void err; }
  try { document.getElementById('tags').value = ''; } catch (err) { void err; }
  
  if (typeof updatePreview === 'function') {
    updatePreview();
  }

  if (removed) {
    showNotification('Entwurf gelöscht 🗑️', 'info');
    return true;
  }
  return false;
}

/**
 * Load draft from localStorage
 * @returns {Object|null} Draft data or null
 */
export function loadDraft() {
  try {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      return JSON.parse(savedDraft);
    }
  } catch (err) {
    console.error('loadDraft error:', err);
  }
  return null;
}

/**
 * Check if draft exists
 * @returns {boolean}
 */
export function hasDraft() {
  return localStorage.getItem(DRAFT_KEY) !== null;
}
