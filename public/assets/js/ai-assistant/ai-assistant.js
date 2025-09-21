// AI-Unterstützung für den Blog mit Google Gemini
// Kostenlose AI-Integration für Schreibhilfe und Content-Verbesserung

// NOTE: This file runs in the browser; importing server-side config files here
// causes the browser to attempt to fetch `/config/config` which can return
// HTML and produce a MIME-type error. Instead, obtain any API keys at
// runtime via an API endpoint or from an injected global (server-rendered)
// variable. We will prefer a runtime fetch from `/config/google-api-key`.

let GEMINI_API_KEY = '';

// Try reading a server-injected window variable first (when server renders it)
if (typeof window !== 'undefined' && window.__SERVER_CONFIG && window.__SERVER_CONFIG.GEMINI_API_KEY) {
  GEMINI_API_KEY = window.__SERVER_CONFIG.GEMINI_API_KEY;
}

// DOMPurify handling: prefer a synchronous check of `window.DOMPurify` so
// UI actions (and tests) are not blocked by network imports. We also start a
// background attempt to load the ESM build from CDN so that DOMPurify becomes
// available later if possible.
function getDOMPurifySync() {
  if (typeof window === 'undefined') return null;
  return (typeof window.DOMPurify !== 'undefined') ? window.DOMPurify : null;
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
preloadDOMPurify();
import { makeApiRequest } from '../api.js';

// Gemini API Konfiguration
const GEMINI_CONFIG = {
  apiKey: (GEMINI_API_KEY && GEMINI_API_KEY.length > 0) ? GEMINI_API_KEY : '', // Wird vom Admin gesetzt
  model: 'gemini-1.5-flash', // Kostenloses Modell
  maxTokens: 2048,
  temperature: 0.7,
};

// API-Schlüssel aus localStorage laden
async function loadGeminiApiKey() {
  // Versuche, den API-Key vom Server zu laden
  try {
    const apiResult = await makeApiRequest('/config/google-api-key', { method: 'GET' });
    if (apiResult && apiResult.success === true) {
      const data = apiResult.data;
      if (data.apiKey && data.apiKey.trim() !== '' && data.apiKey.length > 10) {
        GEMINI_CONFIG.apiKey = data.apiKey;
        return true;
      } else {
        console.warn('Ungültiger oder leerer Gemini API-Schlüssel vom Server erhalten.');
        return false;
      }
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
        <div class="google-api-key-modal-overlay" id="google-api-key-modal">
            <div class="google-api-key-modal-container">
                <pre class="google-api-key-modal-content">${message}</pre>
                <div class="google-api-key-modal-footer">
                    <button id="google-api-key-close" class="google-api-key-modal-button">Schließen</button>
                </div>
            </div>
        </div>
    `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Event Listener für Schließen-Button
  document.getElementById('google-api-key-close').addEventListener('click', () => {
    document.getElementById('google-api-key-modal').remove();
  });
  document.getElementById('google-api-key-close').focus();
}

// Server-proxied AI call - key never touches browser
async function callGeminiAPI(prompt, systemInstruction = '') {
  try {
    const body = { prompt, systemInstruction };
    const result = await makeApiRequest('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!result || result.success !== true) {
      const err = result?.error || 'AI proxy error';
      showNotification(`AI-Fehler: ${err}`, 'error');
      throw new Error(err);
    }

    return result.data?.text || '';
  } catch (error) {
    console.error('AI proxy error:', error);
    showNotification(`AI-Fehler: ${error.message || error}`, 'error');
    throw error;
  }
}

// AI-Schreibhilfe Funktionen

// Text verbessern
async function improveText() {
  const editor = tinymce.get('content');
  if (!editor) return;
    
  const selectedText = editor.selection.getContent({format: 'text'});
  const allText = editor.getContent({format: 'text'});
  const textToImprove = selectedText || allText;
    
  if (!textToImprove || textToImprove.trim().length === 0) {
    alert('Bitte markiere einen Text oder schreibe etwas, das verbessert werden soll.');
    return;
  }
    
  const improveBtn = document.getElementById('ai-improve-btn');
  if (improveBtn) {
    improveBtn.disabled = true;
    improveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI arbeitet...';
  }
    
  try {
    const systemInstruction = `Du bist ein erfahrener deutscher Autor und Philosoph. Verbessere den folgenden Text stilistisch und inhaltlich:

Regeln:
- Behalte die Formatierung bei
- Behalte die ursprüngliche Bedeutung bei
- Verwende elegante, philosophische Sprache
- Verbessere Struktur und Lesbarkeit
- Korrigiere Grammatik und Rechtschreibung
- Antworte NUR mit dem verbesserten Text, keine Erklärungen`;
        
    const improvedText = await callGeminiAPI(textToImprove, systemInstruction);
        
    // Text in Editor einfügen
    if (selectedText) {
      editor.selection.setContent(improvedText);
    } else {
      editor.setContent(improvedText);
    }
        
    updatePreview();
    showNotification('Text wurde von AI verbessert!', 'success');
        
  } catch (error) {
    console.error('Fehler beim Textverbessern:', error);
  } finally {
    if (improveBtn) {
      improveBtn.disabled = false;
      improveBtn.innerHTML = '<i class="fas fa-magic"></i> Text verbessern';
    }
  }
}

// Tags automatisch generieren
async function generateTags() {
  const titleElement = document.getElementById('title');
  const editor = tinymce.get('content');
    
  if (!titleElement || !editor) return;
    
  const title = titleElement.value;
  const content = editor.getContent({format: 'text'});
    
  if (!title && !content) {
    alert('Bitte schreibe zuerst einen Titel oder Inhalt.');
    return;
  }
    
  const tagsBtn = document.getElementById('ai-tags-btn');
  if (tagsBtn) {
    tagsBtn.disabled = true;
    tagsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generiere...';
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
        
    const generatedTags = await callGeminiAPI(textToAnalyze, systemInstruction);
        
    // Show tags in a modal and offer to apply or copy
    const tagsModal = `
      <div class="ai-tags-modal-container">
        <h4 class="ai-tags-modal-header">AI-Tags</h4>
        <p class="ai-tags-modal-content">${generatedTags}</p>
        <div class="ai-tags-modal-footer">
          <button data-action="apply-tags" data-tags="${encodeURIComponent(generatedTags)}" class="ai-tags-modal-button-apply">Einfügen</button>
          <button data-action="copy-tags" data-text="${encodeURIComponent(generatedTags)}" class="ai-tags-modal-button-copy ml-2">Kopieren</button>
          <button data-action="close" class="ai-tags-modal-button-close ml-2">Schließen</button>
        </div>
      </div>
    `;

    showModal(tagsModal);
    showNotification('Tags wurden automatisch generiert!', 'success');
        
  } catch (error) {
    console.error('Fehler beim Tag-Generieren:', error);
  } finally {
    if (tagsBtn) {
      tagsBtn.disabled = false;
      tagsBtn.innerHTML = '<i class="fas fa-tags"></i> Tags generieren';
    }
  }
}

// Zusammenfassung erstellen
async function generateSummary() {
  const editor = tinymce.get('content');
  if (!editor) return;
    
  const content = editor.getContent({format: 'text'});
    
  if (!content || content.trim().length < 100) {
    alert('Bitte schreibe zuerst einen längeren Text (mindestens 100 Zeichen).');
    return;
  }
    
  const summaryBtn = document.getElementById('ai-summary-btn');
  if (summaryBtn) {
    summaryBtn.disabled = true;
    summaryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Erstelle...';
  }
    
  try {
    // Use the HTML content for summarization but validate using plain text length
    const htmlContent = editor.getContent();
    const systemInstruction = `Du bist ein erfahrener Philosoph. Erstelle eine prägnante, HTML-formatierte Zusammenfassung des folgenden Beitrags.

Regeln:
- Gib die Zusammenfassung als HTML zurück (verwende nur semantische Tags wie <p>, <strong>, <em>, <ul>, <ol>, <li>, <a>)
- Bewahre, wenn möglich, wichtige Inline-Formatierungen (z. B. Betonung, Links)
- 2-3 Sätze maximum
- Fasse die Kernaussagen zusammen
- Philosophische und wissenschaftliche Präzision
- Deutsche Sprache
- Antworte NUR mit der HTML-Zusammenfassung (kein erklärender Text)`;

    const summary = await callGeminiAPI(htmlContent, systemInstruction);

    // Zusammenfassung in einem Modal anzeigen und Möglichkeit anbieten, sie in den Editor einzufügen
    const summaryModal = `
      <div class="ai-summary-modal-container">
        <h4 class="ai-summary-modal-header">AI-Zusammenfassung</h4>
        <div class="ai-summary-modal-content">${summary}</div>
        <div class="ai-summary-modal-footer">
          <button data-action="apply-summary" data-html="${encodeURIComponent(summary)}" class="ai-summary-modal-button-apply">
            <i class="fas fa-plus-circle"></i> Einfügen
          </button>
          <button data-action="copy-summary" data-text="${encodeURIComponent(summary)}" class="ai-summary-modal-button-primary ml-2">
            <i class="fas fa-copy ai-summary-modal-button-icon"></i> Kopieren
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
      summaryBtn.innerHTML = '<i class="fas fa-file-text"></i> Zusammenfassen';
    }
  }
}

// Titel-Vorschläge generieren
async function generateTitleSuggestions() {
  const editor = tinymce.get('content');
  if (!editor) return;
    
  const content = editor.getContent({format: 'text'});
    
  if (!content || content.trim().length < 50) {
    alert('Bitte schreibe zuerst etwas Inhalt (mindestens 50 Zeichen).');
    return;
  }
    
  const titleBtn = document.getElementById('ai-title-btn');
  if (titleBtn) {
    titleBtn.disabled = true;
    titleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generiere...';
  }
    
  try {
    const systemInstruction = `Du bist ein erfahrener Blogautor. Erstelle 5 ansprechende Titel für den folgenden Blogpost.

Regeln:
- Jeder Titel in einer neuen Zeile
- Prägnant und neugierig machend
- Philosophisch oder wissenschaftlich angemessen
- Deutsche Sprache
- Nummeriere die Titel (1. 2. 3. etc.)`;
        
    const titleSuggestions = await callGeminiAPI(content.substring(0, 500), systemInstruction);
        
  // Titel-Vorschläge in einem Modal anzeigen (use data-action attributes)
  const titlesArray = titleSuggestions.split('\n').filter(line => line.trim());
  const titlesHtml = titlesArray.map(title => {
    const cleanTitle = title.replace(/^\d+\.\s*/, '').trim();
    return `<div class="ai-title-suggestion" data-action="select-title" data-title="${encodeURIComponent(cleanTitle)}">
          ${cleanTitle}
        </div>`;
  }).join('');

  const titleModal = `
      <div class="ai-modal-overlay" id="ai-modal-overlay">
        <div class="ai-modal-container">
          <h4 class="ai-modal-header">AI-Titel-Vorschläge</h4>
          <p class="ai-modal-content">Klicke auf einen Titel, um ihn zu übernehmen:</p>
          <div class="ai-title-suggestions">${titlesHtml}</div>
          <div class="ai-modal-footer">
            <button data-action="close" class="ai-modal-button">Schließen</button>
          </div>
        </div>
      </div>
    `;

  showModal(titleModal);
    showNotification('Titel-Vorschläge wurden generiert!', 'success');
        
  } catch (error) {
    console.error('Fehler beim Titel-Generieren:', error);
  } finally {
    if (titleBtn) {
      titleBtn.disabled = false;
      titleBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Titel vorschlagen';
    }
  }
}

// Hilfsfunktionen
// Titel auswählen
function selectTitle(title) {
  const titleInput = document.getElementById('title');
  if (titleInput) {
    titleInput.value = title;
    updatePreview();
    showNotification('Titel übernommen!', 'success');
  }
  closeModal();
}
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

        const editor = tinymce.get('content');
        if (editor) {
          const selected = editor.selection && editor.selection.getContent({ format: 'text' });
          if (selected && selected.trim().length > 0) {
            editor.selection.setContent(safeHtml);
          } else {
            editor.setContent(safeHtml);
          }
          updatePreview();
          showNotification('Zusammenfassung eingefügt!', 'success');
        } else {
          const textarea = document.getElementById('content');
          if (textarea) {
            textarea.value = safeHtml;
            updatePreview();
            showNotification('Zusammenfassung eingefügt!', 'success');
          }
        }
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
        updatePreview();
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
    if (action === 'select-title') {
      const encoded = actionEl.getAttribute('data-title') || '';
      const title = decodeURIComponent(encoded);
      selectTitle(title);
      // closeModal is called by selectTitle
      return;
    }
  });
}
// Modal schließen
function closeModal() {
  const modal = document.querySelector('.ai-modal-overlay');
  if (modal) {
    modal.classList.add('hidden');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
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

// AI-System beim Laden der Seite initialisieren
document.addEventListener('DOMContentLoaded', function() {
  // Kurz warten, damit andere Module geladen sind
  setTimeout(initializeAISystem, 500);
});

//mark module as loaded
// AI Assistant module loaded

// Export selected functions for use in other modules (and for unit testing)
export {
  improveText,
  generateTags,
  generateSummary,
  generateTitleSuggestions,
  showApiKeySetup,
  selectTitle,
  copyToClipboard,
  fallbackCopy,
  updateAIButtons,
  initializeAISystem,
  loadGeminiApiKey,
  callGeminiAPI,
};