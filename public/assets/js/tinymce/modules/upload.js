// Image Upload Module
// Handles image upload for TinyMCE editor

import { makeApiRequest } from '../../api.js';
import { showNotification, getPostIdFromPath } from '../../common.js';

/**
 * Validate image before upload
 * @param {Blob} blob - Image blob
 * @throws {Error} If validation fails
 */
function validateImageBeforeUpload(blob) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (blob.size > maxSize) {
    throw new Error(`Bild zu groß (${(blob.size / 1024 / 1024).toFixed(2)}MB). Maximum: 10MB`);
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(blob.type)) {
    throw new Error(`Ungültiger Dateityp: ${blob.type}. Erlaubt: JPEG, PNG, GIF, WebP`);
  }
}

/**
 * Debug upload response and extract image URL
 * @param {Object} result - Upload result
 * @param {string} context - Context string for debugging
 * @returns {string|null} Image URL
 */
function debugUploadResponse(result, context = 'Upload') {
  if (!result) {
    console.error(`${context}: Leere Response`);
    return null;
  }

  // Try multiple possible URL fields
  const imageUrl = result.location || result.url || result.imageUrl || result.path;
  
  if (!imageUrl) {
    console.error(`${context}: Keine URL in Response gefunden`, result);
    return null;
  }

  return imageUrl;
}

/**
 * Upload image using multipart form data
 * @param {Object} blobInfo - TinyMCE blob info
 * @param {Function} progress - Progress callback
 * @returns {Promise<string>} Image URL
 */
export async function uploadImageMultipart(blobInfo, progress) {
  const blob = blobInfo.blob();
  const filename = blobInfo.filename() || 'upload.jpg';

  // Validate image
  validateImageBeforeUpload(blob);

  if (typeof progress === 'function') progress(10);

  const formData = new FormData();
  formData.append('image', blob, filename);
  
  // Add postId if editing existing post
  try {
    const postId = (typeof getPostIdFromPath === 'function') ? getPostIdFromPath() : null;
    if (postId && !isNaN(postId) && postId > 0) {
      formData.append('postId', postId);
    }
  } catch (e) {
    // Ignore if postId not available (new post)
  }

  const apiResult = await makeApiRequest('/upload/image', {
    method: 'POST',
    body: formData,
  });

  if (!apiResult || apiResult.success !== true) {
    const errMsg = (apiResult && apiResult.error) || 'Upload fehlgeschlagen';
    throw new Error(errMsg);
  }

  if (typeof progress === 'function') progress(100);

  const result = apiResult.data;
  const imageUrl = debugUploadResponse(result, 'Upload');
  if (!imageUrl) {
    throw new Error('Server gab keine gültige URL zurück');
  }

  return imageUrl;
}

/**
 * Backwards-compatible wrapper for success/failure callbacks
 * @param {Object} blobInfo - TinyMCE blob info
 * @param {Function} success - Success callback
 * @param {Function} failure - Failure callback
 * @param {Function} progress - Progress callback
 * @returns {Promise<string>}
 */
export function multipartImageUploadHandler(blobInfo, success, failure, progress) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const imageUrl = await uploadImageMultipart(blobInfo, progress);
        if (typeof success === 'function') {
          success(imageUrl);
        }
        resolve(imageUrl);
      } catch (error) {
        console.error('Upload fehlgeschlagen:', error);
        if (typeof failure === 'function') {
          failure(error.message, { remove: true });
        }
        showNotification(`Upload-Fehler: ${error.message}`, 'error');
        reject(error);
      }
    })();
  });
}
