// TinyMCE Script Loader Module
// Handles loading TinyMCE from various sources (local, jsDelivr, Tiny Cloud)

import { showNotification } from '../../common.js';

const TINYMCE_CONFIG = {
  apiKey: 'no-api-key',
  defaultKey: 'no-api-key',
};

/**
 * Load TinyMCE script from local, jsDelivr, or Tiny Cloud
 * @returns {Promise<boolean>}
 */
export async function loadTinyMceScript() {
  if (typeof tinymce !== 'undefined') {
    return true;
  }

  return await tryLocalTinyMCE();
}

/**
 * Try loading TinyMCE from local paths or jsDelivr
 * @returns {Promise<boolean>}
 */
async function tryLocalTinyMCE() {
  const localPaths = [
    '/assets/js/tinymce/tinymce.min.js',
  ];
  const errors = [];

  for (const path of localPaths) {
    try {
      const success = await loadScriptFromPath(path);
      if (success) {
        return true;
      } else {
        errors.push(`Failed to load from ${path}`);
      }
    } catch (error) {
      errors.push(`Error at ${path}: ${error.message}`);
    }
  }

  showNotification('Error', `All local TinyMCE paths failed:\n${errors.join('\n')}`);
  throw new Error('All local TinyMCE paths failed');
}

/**
 * Load a script from a specific path
 * @param {string} src - Script URL
 * @param {number} timeoutDuration - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
function loadScriptFromPath(src, timeoutDuration = 5000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;

    const timeout = setTimeout(() => {
      document.head.removeChild(script);
      reject(new Error('Script loading timeout'));
    }, timeoutDuration);

    script.onload = () => {
      clearTimeout(timeout);
      if (typeof tinymce !== 'undefined') {
        resolve(true);
      } else {
        reject(new Error('TinyMCE not available after script load'));
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      document.head.removeChild(script);
      reject(new Error('Script failed to load'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Show TinyMCE API Key setup dialog
 */
export function showTinyMceApiKeySetup() {
  const currentKey = TINYMCE_CONFIG.apiKey;
    
  const message = 
    'TinyMCE API-Schlüssel Setup:\n\n' +
    'KOSTENLOS registrieren:\n' +
    '1. Gehe zu: https://www.tiny.cloud/\n' +
    '2. Klicke "Get Started for FREE"\n' +
    '3. Registriere dich mit E-Mail\n' +
    '4. Kopiere deinen API-Schlüssel aus dem Dashboard\n' +
    '5. Füge ihn in der .env Datei ein\n\n' +
    'HINWEIS: Ohne API-Schlüssel wird automatisch\n' +
    'die lokale Version verwendet (weniger Features)\n\n' +
    `Aktueller Schlüssel: ${currentKey ? currentKey.substring(0, 10) + '...' : 'Nicht gesetzt'}`;

  const modalHtml = `
    <div class="modal-overlay" id="tinymce-api-key-modal">
      <div class="modal-container">
        <pre class="modal-content">${message}</pre>
        <div class="modal-footer">
          <button id="tinymce-api-key-close" class="modal-button">Schließen</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('tinymce-api-key-close').addEventListener('click', () => {
    document.getElementById('tinymce-api-key-modal').remove();
  });
  
  document.getElementById('tinymce-api-key-modal').focus();
}
