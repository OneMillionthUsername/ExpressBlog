// Preview Module
// Handles preview functionality for blog posts

import DOMPurify from '/vendor/dompurify.min.js';

/**
 * Update preview of blog post
 */
export function updatePreview() {
  const titleElement = document.getElementById('title');
  const tagsElement = document.getElementById('tags');
  const previewTitleElement = document.getElementById('preview-title');
  const previewTagsElement = document.getElementById('preview-tags');
  const previewContentElement = document.getElementById('preview-content');

  if (!previewTitleElement || !previewContentElement) return;

  // Update title
  if (titleElement) {
    const title = titleElement.value || 'Kein Titel';
    previewTitleElement.textContent = title;
    if (document.getElementById('main-title')) {
      document.getElementById('main-title').textContent = title;
    }
  }

  // Update content
  const tinymceEditor = tinymce.get('content');
  let content = '';
  
  if (tinymceEditor) {
    content = tinymceEditor.getContent();
  } else {
    const contentElement = document.getElementById('content');
    if (contentElement) {
      content = contentElement.value;
    }
  }

  // Sanitize and display content
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    previewContentElement.innerHTML = DOMPurify.sanitize(content);
  } else {
    previewContentElement.textContent = 'Preview nicht verfügbar (DOMPurify nicht geladen)';
  }

  // Update tags
  if (tagsElement && previewTagsElement) {
    const tags = tagsElement.value.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    if (tags.length > 0) {
      previewTagsElement.innerHTML = tags
        .map(tag => `<span class="tag">${tag}</span>`)
        .join('');
    } else {
      previewTagsElement.innerHTML = '<span class="text-muted">Keine Tags</span>';
    }
  }
}

/**
 * Toggle preview visibility
 */
export function togglePreview() {
  const previewBox = document.getElementById('preview-box');
  if (!previewBox) return;

  // Always update preview to ensure it shows current content
  updatePreview();

  if (previewBox.style.display === 'none' || !previewBox.style.display) {
    previewBox.style.display = 'block';
  } else {
    previewBox.style.display = 'none';
  }
}
