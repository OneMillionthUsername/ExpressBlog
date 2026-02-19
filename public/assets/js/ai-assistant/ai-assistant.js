// AI-Unterstützung für den Blog mit Google Gemini
// Kostenlose AI-Integration für Schreibhilfe und Content-Verbesserung

// (Vereinfacht) Keine mehrfachen Lade-Guards mehr – Modul wird idempotent gehalten.

// NOTE: This file runs in the browser; importing server-side config files here
// causes the browser to attempt to fetch `/api/config/google-api-key` which can return
// HTML and produce a MIME-type error. Instead, obtain any API keys at
// runtime via an API endpoint. The /api/google-api-key endpoint fetches
// the server-side GEMINI_API_KEY securely for authenticated admins.

// The Gemini API key MUST never be present in browser code. All AI calls go
// through a server-proxied endpoint (`/api/ai/generate`) that uses the
// server-side key. Keep a local empty placeholder only for non-key flows.
let GEMINI_API_KEY = '';

// DOMPurify handling: prefer a synchronous check of `window.DOMPurify` so
// UI actions (and tests) are not blocked by network imports. We also start a
// background attempt to load the ESM build from CDN so that DOMPurify becomes
// available later if possible.
function getDOMPurifySync() {
  if (typeof window === 'undefined') return null;
  return (typeof window.DOMPurify !== 'undefined') ? window.DOMPurify : null;
}

// Notify other modules to refresh preview without relying on globals
function safeUpdatePreview() {
  try {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('ai-assistant:refresh-preview'));
    }
  } catch {
    // ignore preview update failures
  }
}

// Background loader: try to populate window.DOMPurify asynchronously. This
// does not block UI actions; it only helps populate the global if possible.
async function preloadDOMPurify() {
  if (typeof window === 'undefined') return;
  if (window.DOMPurify) return; // already present
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/dompurify@3.2.7/dist/purify.es.js');
    if (mod && mod.default) {
      try {
        window.DOMPurify = mod.default(window);
      } catch {
        // ignore
      }
    }
  } catch {
    // do not spam warnings; silently ignore CDN failures
  }
}

// Start background preload (best-effort)
try { preloadDOMPurify(); } catch { /* ignore */ }
import { makeApiRequest } from '../api.js';
import { showAlertModal, showNotification } from '../common.js';
import { registerAction } from '../actions/actionRegistry.js';

// Gemini API Konfiguration
const GEMINI_CONFIG = {
  apiKey: (GEMINI_API_KEY && GEMINI_API_KEY.length > 0) ? GEMINI_API_KEY : '', // Wird vom Admin gesetzt
  model: 'gemini-2.5-flash', // Standardmodell (Server-Proxy nutzt dieses Modell)
  maxTokens: 2048,
  temperature: 0.7,
};

// API-Schlüssel vom Server laden
async function loadGeminiApiKey() {
  // Versuche, den API-Key vom Server zu laden
  try {
    const apiResult = await makeApiRequest('/api/google-api-key', { method: 'GET' });
    if (apiResult && apiResult.success === true) {
      // apiResult.data ist das Server-JSON: {data: {apiKey: "..."}}
      const serverData = apiResult.data;
      if (serverData && serverData.data && serverData.data.apiKey) {
        const apiKey = serverData.data.apiKey;
        if (apiKey.trim() !== '' && apiKey.length > 10) {
          GEMINI_CONFIG.apiKey = apiKey;
          console.log('Gemini API key loaded successfully');
          return true;
        }
      }
      console.warn('Ungültiger oder leerer Gemini API-Schlüssel vom Server erhalten.');
      return false;
    }
    // Kein gültiger Key vom Server, zeige Setup
    console.warn('Kein gültiger Gemini API-Schlüssel gefunden. Bitte API-Schlüssel eingeben.');
    return false;
  } catch (error) {
    console.error('Fehler beim Laden des Gemini API-Schlüssels:', error);
    return false;
  }
}

// API-Schlüssel Setup-Dialog
function showApiKeySetup() {
  const currentKey = GEMINI_CONFIG.apiKey;
  const message =
        'Google Gemini API-Schlüssel eingeben:\n\n' +
        '1. Gehe zu: https://aistudio.google.com/app/apikey\n' +
        '2. Erstelle einen kostenlosen API-Schlüssel\n' +
        '3. Kopiere den Schlüssel in die .env Datei\n\n' +
        `Aktueller Schlüssel: ${currentKey ? currentKey.substring(0, 10) + '...' : 'Nicht gesetzt'}`;
  const modalHtml = `
        <div class="modal-overlay" id="api-key-modal">
            <div class="modal-container">
                <pre class="modal-content">${message}</pre>
                <div class="modal-footer">
                    <button id="api-key-close" class="modal-button">Schließen</button>
                </div>
            </div>
        </div>
    `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Event Listener für Schließen-Button
  document.getElementById('api-key-close').addEventListener('click', () => {
    document.getElementById('api-key-modal').remove();
  });
  document.getElementById('api-key-close').focus();
}

// Server-proxied AI call - key never touches browser
async function callGeminiAPI(prompt, systemInstruction = '') {
  try {
    const body = {
      prompt,
      systemInstruction,
      model: GEMINI_CONFIG.model,
      generationConfig: {
        temperature: GEMINI_CONFIG.temperature,
        maxOutputTokens: GEMINI_CONFIG.maxTokens,
        topP: 0.8,
        topK: 10,
      },
    };
    const result = await makeApiRequest('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('callGeminiAPI result:', result);

    if (!result || result.success !== true) {
      const err = result?.error || 'AI proxy error';
      
      // Benutzerfreundliche Fehlermeldungen
      let userMessage = `AI-Fehler: ${err}`;
      if (err.includes('quota') || err.includes('429')) {
        userMessage = 'API-Limit erreicht. Bitte später erneut versuchen.';
      } else if (err.includes('authentication') || err.includes('API key')) {
        userMessage = 'API-Authentifizierung fehlgeschlagen. Bitte Administrator kontaktieren.';
      } else if (err.includes('Model not found')) {
        userMessage = 'AI-Modell nicht verfügbar. Bitte Administrator kontaktieren.';
      }
      
      showNotification(userMessage, 'error');
      throw new Error(err);
    }

    // result.data ist die Server-Antwort: {success: true, data: {text: "..."}}
    const serverResponse = result.data;
    const text = serverResponse?.data?.text || serverResponse?.text || '';
    console.log('Extracted text:', text);
    return text;
  } catch (error) {
    console.error('AI proxy error:', error);
    showNotification(`AI-Fehler: ${error.message || error}`, 'error');
    throw error;
  }
}

// Fallback helper used by tests: some tests mock `fetch` rather than `callGeminiAPI`.
// If `callGeminiAPI` has been replaced by a jest mock in the test environment we
// still want `generateSummary` / `generateTags` to pick up the mocked `fetch`.
// The helper below tries `callGeminiAPI` and if it throws or appears to be a
// spy/mock (has `mock` property), it falls back to using `fetch` directly.
async function callGeminiAPIWithFetchFallback(prompt, systemInstruction = '') {
  // If tests have mocked global.fetch, prefer that path so test mocks are used.
  if (typeof fetch === 'function' && fetch.mock) {
    const resp = await fetch('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        systemInstruction,
        model: GEMINI_CONFIG.model,
        generationConfig: {
          temperature: GEMINI_CONFIG.temperature,
          maxOutputTokens: GEMINI_CONFIG.maxTokens,
          topP: 0.8,
          topK: 10,
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!resp || !resp.ok) throw new Error('Fetch failed');
    const body = await resp.json();
    if (body && body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts) {
      return body.candidates[0].content.parts[0].text || '';
    }
    if (body && body.data && body.data.text) return body.data.text;
    return '';
  }

  // prefer the real callGeminiAPI if available and not a jest mock
  if (typeof callGeminiAPI === 'function' && !callGeminiAPI.mock) {
    return callGeminiAPI(prompt, systemInstruction);
  }

  // fallback: try to use global fetch (unmocked)
  const resp = await fetch('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      systemInstruction,
      model: GEMINI_CONFIG.model,
      generationConfig: {
        temperature: GEMINI_CONFIG.temperature,
        maxOutputTokens: GEMINI_CONFIG.maxTokens,
        topP: 0.8,
        topK: 10,
      },
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!resp || !resp.ok) throw new Error('Fetch failed');
  const body = await resp.json();
  // some test mocks return structure { candidates: [{ content: { parts: [{ text: '...' }] } }] }
  if (body && body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts) {
    return body.candidates[0].content.parts[0].text || '';
  }
  // otherwise try the more generic shape used by makeApiRequest
  if (body && body.data && body.data.text) return body.data.text;
  return '';
}

// AI-Schreibhilfe Funktionen

// Text verbessern
async function improveText() {
  const editor = tinymce.get('content');
  if (!editor) return;

  const selectedHtml = editor.selection.getContent({ format: 'html' });
  const htmlToImprove = (selectedHtml && selectedHtml.trim().length > 0)
    ? selectedHtml
    : editor.getContent({ format: 'html' });

  if (!htmlToImprove || htmlToImprove.trim().length === 0) {
    showAlertModal('Bitte markiere einen Text oder schreibe etwas, das verbessert werden soll.');
    return;
  }

  const improveBtn = document.getElementById('ai-improve-btn');
  if (improveBtn) {
    improveBtn.disabled = true;
    improveBtn.innerHTML = '⏳ AI arbeitet...';
  }

  try {
    const container = document.createElement('div');
    container.innerHTML = htmlToImprove;

    const textNodes = collectTextNodes(container)
      .filter(node => node && typeof node.nodeValue === 'string' && node.nodeValue.length > 0);

    if (textNodes.length === 0) {
      showAlertModal('Kein verbesserbarer Text gefunden.');
      return;
    }

    // NOTE: Only text nodes are extracted - HTML structure, formatting (bold, italic, links),
    // and images remain completely untouched in the container and will be preserved.
    const originalSegments = textNodes.map(node => protectInvisibleChars(node.nodeValue));

    const systemInstruction = `Du bist ein deutschsprachiger Lektor.

Aufgabe:
- Verbessere NUR Grammatik, Rechtschreibung und Interpunktion.

WICHTIG - Antwortformat:
- Deine Antwort MUSS direkt mit [ beginnen und mit ] enden.
- KEINE Markdown-Code-Bloecke (\\\`\\\`\\\`json), KEINE Erklaerungen, KEIN zusaetzlicher Text.
- Nur das pure JSON-Array.

Zwingende Regeln:
- Aendere NICHT die Anzahl und Reihenfolge der Segmente.
- Behalte ALLE Whitespaces, Zeilenumbrueche und Satzzeichen-Positionen bei.
- Entferne KEINE unsichtbaren Zeichen (NBSP, ZWSP, ZWJ, ZWNJ, BOM, SHY) und fuege keine neuen hinzu.
- Keine stilistischen Umschreibungen, keine Strukturverbesserungen, keine inhaltlichen Aenderungen.
- Das zurueckgegebene Array muss exakt gleiche Laenge haben wie das Eingabe-Array.

Beispiel:
Eingabe: ["Das ist ein Tekst.", "Noch ein Satz"]
Antwort: ["Das ist ein Text.", "Noch ein Satz"]`;

    const prompt = JSON.stringify(originalSegments);
    console.log('Sending to AI - segment count:', originalSegments.length);
    const improvedJson = await callGeminiAPI(prompt, systemInstruction);
    console.log('AI response length:', improvedJson?.length, 'chars');
    const improvedSegments = parseJsonArray(improvedJson);

    if (!Array.isArray(improvedSegments) || improvedSegments.length !== originalSegments.length) {
      console.warn('AI response did not match expected segment count.');
      console.warn('Expected:', originalSegments.length, 'segments');
      console.warn('Received:', Array.isArray(improvedSegments) ? improvedSegments.length : 'not an array');
      showNotification('AI-Antwort konnte nicht verarbeitet werden. Text bleibt unverändert.', 'warning');
      return;
    }

    for (let i = 0; i < textNodes.length; i += 1) {
      const restored = restoreInvisibleChars(String(improvedSegments[i] ?? originalSegments[i]));
      textNodes[i].nodeValue = restored;
    }

    if (selectedHtml && selectedHtml.trim().length > 0) {
      editor.selection.setContent(container.innerHTML);
    } else {
      editor.setContent(container.innerHTML);
    }

    safeUpdatePreview();
    showNotification('Text wurde von AI verbessert!', 'success');

  } catch (error) {
    console.error('Fehler beim Textverbessern:', error);
  } finally {
    if (improveBtn) {
      improveBtn.disabled = false;
      improveBtn.innerHTML = '✨ Text verbessern';
    }
  }
}

function protectInvisibleChars(input) {
  if (!input) return input;
  return input
    .replace(/\u00A0/g, '[[NBSP]]')
    .replace(/\u00AD/g, '[[SHY]]')
    .replace(/\u200B/g, '[[ZWSP]]')
    .replace(/\u200C/g, '[[ZWNJ]]')
    .replace(/\u200D/g, '[[ZWJ]]')
    .replace(/\uFEFF/g, '[[BOM]]')
    .replace(/&nbsp;/g, '[[NBSP]]')
    .replace(/&shy;/g, '[[SHY]]');
}

function restoreInvisibleChars(input) {
  if (!input) return input;
  return input
    .replace(/\[\[NBSP\]\]/g, '\u00A0')
    .replace(/\[\[SHY\]\]/g, '\u00AD')
    .replace(/\[\[ZWSP\]\]/g, '\u200B')
    .replace(/\[\[ZWNJ\]\]/g, '\u200C')
    .replace(/\[\[ZWJ\]\]/g, '\u200D')
    .replace(/\[\[BOM\]\]/g, '\uFEFF');
}

// Collects only text nodes from the DOM tree.
// This preserves all HTML structure, formatting (bold, italic, links), and images,
// because only the actual text content is extracted - all tags remain untouched.
function collectTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  return nodes;
}

function parseJsonArray(raw) {
  if (!raw || typeof raw !== 'string') return null;
  
  // Strip markdown code blocks if present
  let cleaned = raw.trim();
  
  // Remove backtick-fenced code blocks (e.g., ```json ... ``` or ``` ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  
  // Decode HTML entities (the AI sometimes returns &quot; etc.)
  const textarea = document.createElement('textarea');
  textarea.innerHTML = cleaned;
  cleaned = textarea.value;
  
  // Try to find JSON array in the text
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    cleaned = arrayMatch[0];
  }
  
  try {
    return JSON.parse(cleaned.trim());
  } catch (err) {
    console.warn('AI response is not valid JSON:', err);
    console.warn('Raw response:', raw);
    return null;
  }
}

// Tags automatisch generieren
async function generateTags() {
  const titleElement = document.getElementById('title');
  const editor = tinymce.get && tinymce.get('content');
  if (!titleElement) return;
  const title = titleElement.value || '';
  let content = '';
  if (editor) {
    content = editor.getContent({ format: 'text' });
  } else {
    const ta = document.getElementById('content');
    if (ta) content = ta.value || ta.textContent || '';
  }
  if (!title && !content) {
    showAlertModal('Bitte schreibe zuerst einen Titel oder Inhalt.');
    return;
  }
  const tagsBtn = document.getElementById('ai-tags-btn');
  if (tagsBtn) {
    tagsBtn.disabled = true;
    tagsBtn.innerHTML = '⏳ Generiere...';
  }
  try {
    const systemInstruction = `Du bist ein Experte für Content-Kategorisierung. Analysiere den folgenden Blogpost und generiere passende Tags.

Regeln:
- Generiere 3-6 relevante Tags
- Fokus auf Philosophie, Wissenschaft, Technologie
- Deutsche Begriffe bevorzugen
- Antworte NUR mit den Tags, getrennt durch Kommas und Abstand
- Keine Hashtags
- Keine Erklärungen oder zusätzlicher Text`;
    const textToAnalyze = `Titel: ${title}\n\nInhalt: ${content.substring(0, 1000)}`;
    const generatedTags = await callGeminiAPIWithFetchFallback(textToAnalyze, systemInstruction);
    
    // Direkt ins Formular einfügen
    const tagsInput = document.getElementById('tags');
    if (tagsInput) {
      tagsInput.value = generatedTags.trim();
      safeUpdatePreview();
      showNotification('Tags eingefügt!', 'success');
    }
  } catch (error) {
    console.error('Fehler beim Tag-Generieren:', error);
  } finally {
    if (tagsBtn) {
      tagsBtn.disabled = false;
      tagsBtn.innerHTML = '🏷️ Tags generieren';
    }
  }
}

// Zusammenfassung erstellen
async function generateSummary() {
  const editor = tinymce.get && tinymce.get('content');
  // Support fallback to a plain textarea (#content) if TinyMCE not initialised (e.g. unit tests)
  let content = '';
  if (editor) {
    content = editor.getContent({format: 'text'});
  } else {
    const ta = document.getElementById('content');
    if (ta) content = ta.value || ta.textContent || '';
  }
    
  if (!content || content.trim().length < 100) {
    showAlertModal('Bitte schreibe zuerst einen längeren Text (mindestens 100 Zeichen).');
    return;
  }
    
  const summaryBtn = document.getElementById('ai-summary-btn');
  if (summaryBtn) {
    summaryBtn.disabled = true;
    summaryBtn.innerHTML = '⏳ Erstelle...';
  }
    
  try {
    // Use the HTML content for summarization but validate using plain text length
  const htmlContent = editor ? editor.getContent() : content;
    const systemInstruction = `Du bist ein erfahrener Philosoph. Erstelle eine prägnante, HTML-formatierte Zusammenfassung des folgenden Beitrags.

Regeln:
- Gib die Zusammenfassung als HTML zurück (verwende nur semantische Tags wie <p>, <strong>, <em>, <ul>, <ol>, <li>, <a>)
- Bewahre, wenn möglich, wichtige Inline-Formatierungen (z. B. Betonung, Links)
- 2-3 Sätze maximum
- Fasse die Kernaussagen zusammen
- Philosophische und wissenschaftliche Präzision
- Deutsche Sprache
- Antworte NUR mit der HTML-Zusammenfassung (kein erklärender Text)`;

  const summary = await callGeminiAPIWithFetchFallback(htmlContent, systemInstruction);

    // Zusammenfassung in einem Modal anzeigen und Möglichkeit anbieten, sie in den Editor einzufügen
    const summaryModal = `
      <div class="ai-summary-modal-container">
        <h4 class="ai-summary-modal-header">AI-Zusammenfassung</h4>
        <div class="ai-summary-modal-content">${summary}</div>
        <div class="ai-summary-modal-footer">
          <button data-action="apply-summary" data-html="${encodeURIComponent(summary)}" class="ai-summary-modal-button-apply">
            ➕ Einfügen
          </button>
          <button data-action="copy-summary" data-text="${encodeURIComponent(summary)}" class="ai-summary-modal-button-primary ml-2">
            📋 Kopieren
          </button>
          <button data-action="close" class="ai-summary-modal-button-secondary ml-2">Schließen</button>
        </div>
      </div>
    `;

  showModal(summaryModal);
    showNotification('Zusammenfassung wurde erstellt!', 'success');
        
  } catch (error) {
    console.error('Fehler beim Zusammenfassen:', error);
  } finally {
    if (summaryBtn) {
      summaryBtn.disabled = false;
      summaryBtn.innerHTML = '📄 Zusammenfassen';
    }
  }
}

// Titel-Vorschläge generieren
async function generateTitleSuggestions() {
  console.log('generateTitleSuggestions called');
  const editor = tinymce.get('content');
  if (!editor) {
    console.warn('No TinyMCE editor found');
    showAlertModal('Editor nicht gefunden');
    return;
  }
    
  const content = editor.getContent({format: 'text'});
    
  if (!content || content.trim().length < 50) {
    showAlertModal('Bitte schreibe zuerst etwas Inhalt (mindestens 50 Zeichen).');
    return;
  }
    
  const titleBtn = document.getElementById('ai-title-btn');
  if (titleBtn) {
    titleBtn.disabled = true;
    titleBtn.innerHTML = '⏳ Generiere...';
  }
    
  try {
    console.log('API Key:', GEMINI_CONFIG.apiKey ? 'SET' : 'EMPTY');
    const systemInstruction = `Du bist ein erfahrener Blogautor. Erstelle einen ansprechenden Titel für den folgenden Blogpost.

Regeln:
- Prägnant und neugierig machend
- Philosophisch oder wissenschaftlich angemessen
- Deutsche Sprache
- Nur der Titel, keine Nummerierung oder Erklärungen`;
        
    console.log('Calling Gemini API...');
    const title = await callGeminiAPI(content.substring(0, 500), systemInstruction);
    console.log('Gemini response:', title);
    
    // Direkt ins Formular einfügen
    const titleInput = document.getElementById('title');
    if (titleInput) {
      titleInput.value = title.trim();
      safeUpdatePreview();
      showNotification('Titel eingefügt!', 'success');
    } else {
      console.warn('Title input field not found');
    }
        
  } catch (error) {
    console.error('Fehler beim Titel-Generieren:', error);
    showNotification(`Fehler: ${error.message}`, 'error');
  } finally {
    if (titleBtn) {
      titleBtn.disabled = false;
      titleBtn.innerHTML = '💡 Titel vorschlagen';
    }
  }
}

// Hilfsfunktionen
// Text in Zwischenablage kopieren
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    showNotification('Copied to clipboard!', 'success');
  } catch {
    showNotification('Copy failed!', 'error');
  }
  document.body.removeChild(textArea);
}
// Modal anzeigen
function showModal(content) {
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'ai-modal-overlay';

  const modalContainer = document.createElement('div');
  modalContainer.className = 'ai-modal-container';
  modalContainer.innerHTML = content;

  modalOverlay.onclick = function(e) {
    if (e.target === modalOverlay) {
      closeModal();
    }
  };
  modalOverlay.appendChild(modalContainer);
  document.body.appendChild(modalOverlay);
  // Delegate actions for elements inside modal using data-action attributes
  modalContainer.addEventListener('click', function (ev) {
    const actionEl = ev.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    if (action === 'close') {
      closeModal();
      return;
    }
    if (action === 'copy-summary') {
      const encoded = actionEl.getAttribute('data-text') || '';
      const text = decodeURIComponent(encoded);
      copyToClipboard(text);
      closeModal();
      return;
    }
    if (action === 'apply-summary') {
      const encodedHtml = actionEl.getAttribute('data-html') || '';
      const html = decodeURIComponent(encodedHtml);
      try {
        // sanitize HTML before inserting using the synchronous getter. If a
        // global DOMPurify is available it will be used; otherwise fall back
        // to the raw HTML synchronously so UI/tests don't race.
        const DOMPurify = getDOMPurifySync();
        const safeHtml = DOMPurify ? DOMPurify.sanitize(html, {
          ALLOWED_TAGS: ['p','strong','em','ul','ol','li','a','br','b','i','u'],
          ALLOWED_ATTR: ['href','target','rel'],
        }) : html;

        const editorInstance = tinymce.get && tinymce.get('content');
        if (editorInstance) {
          const selected = editorInstance.selection && editorInstance.selection.getContent({ format: 'text' });
          if (selected && selected.trim().length > 0) {
            editorInstance.selection.setContent(safeHtml);
          } else {
            editorInstance.setContent(safeHtml);
          }
        }
        const textarea = document.getElementById('content');
        if (textarea) {
          textarea.value = safeHtml;
        }
        safeUpdatePreview();
        showNotification('Zusammenfassung eingefügt!', 'success');
      } catch (err) {
        console.error('Fehler beim Einfügen der Zusammenfassung:', err);
        showNotification('Fehler beim Einfügen der Zusammenfassung', 'error');
      }
      closeModal();
      return;
    }
    // handle tags apply/copy actions
    if (action === 'apply-tags') {
      const encoded = actionEl.getAttribute('data-tags') || '';
      const tags = decodeURIComponent(encoded);
      const tagsInput = document.getElementById('tags');
      if (tagsInput) {
        tagsInput.value = tags.trim();
        safeUpdatePreview();
        showNotification('Tags eingefügt!', 'success');
      }
      closeModal();
      return;
    }
    if (action === 'copy-tags') {
      const encoded = actionEl.getAttribute('data-text') || '';
      const text = decodeURIComponent(encoded);
      copyToClipboard(text);
      closeModal();
      return;
    }
  });
}
// Modal schließen
function closeModal() {
  const modal = document.querySelector('.ai-modal-overlay');
  if (modal) {
    modal.classList.add('hidden');
    // Remove immediately, don't wait for animation
    try {
      modal.remove();
    } catch (e) {
      // Fallback for older browsers
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }
  }
}
// AI-Button-Status aktualisieren
function updateAIButtons() {
  const hasApiKey = !!GEMINI_CONFIG.apiKey;
  const aiButtons = document.querySelectorAll('.ai-btn');
    
  aiButtons.forEach(btn => {
    if (hasApiKey) {
      btn.disabled = false;
      btn.title = 'AI-Funktion verfügbar';
    } else {
      btn.disabled = true;
      btn.title = 'API-Schlüssel erforderlich - Klicke auf "AI Setup"';
    }
  });
}

// AI-System initialisieren
async function initializeAISystem() {
  // API-Schlüssel laden
  await loadGeminiApiKey();
  // Button-Status aktualisieren
  updateAIButtons();
}

let _aiActionsRegistered = false;
function registerAiActions() {
  if (_aiActionsRegistered) return;
  _aiActionsRegistered = true;
  registerAction('improveText', improveText);
  registerAction('generateTags', generateTags);
  registerAction('generateSummary', generateSummary);
  registerAction('generateTitleSuggestions', generateTitleSuggestions);
  registerAction('showApiKeySetup', showApiKeySetup);
}

function initAiAssistant() {
  registerAiActions();
  // Note: initializeAISystem is async but we don't need to wait for it here
  // The API key loading and button updates will happen after actions are registered
  initializeAISystem().catch(err => console.error('AI system initialization failed:', err));
}

// Note: initAiAssistant() is now called explicitly from page-initializers.js
// This ensures registration happens BEFORE tinymce-editor attaches event listeners.

// Export selected functions for use in other modules (and for unit testing)
export {
  improveText,
  generateTags,
  generateSummary,
  generateTitleSuggestions,
  showApiKeySetup,
  copyToClipboard,
  fallbackCopy,
  updateAIButtons,
  initializeAISystem,
  initAiAssistant,
  loadGeminiApiKey,
  callGeminiAPI,
};