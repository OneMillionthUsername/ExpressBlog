// AI-Unterstützung für den Blog mit Google Gemini
// Kostenlose AI-Integration für Schreibhilfe und Content-Verbesserung

// Gemini API Konfiguration
const GEMINI_CONFIG = {
  apiKey: '', // Wird vom Admin gesetzt
  model: 'gemini-1.5-flash', // Kostenloses Modell
  maxTokens: 2048,
  temperature: 0.7,
};

// API-Schlüssel aus localStorage laden
async function loadGeminiApiKey() {
  // Versuche, den API-Key vom Server zu laden
  try {
    const response = await fetch('/config/google-api-key', { method: 'GET' });
    if (response.ok) {
      const data = await response.json();
      if (data.apiKey && data.apiKey.trim() !== '' && data.apiKey.length > 10) {
        GEMINI_CONFIG.apiKey = data.apiKey;
        return true;
      }
      else {
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

// Gemini API-Aufruf
async function callGeminiAPI(prompt, systemInstruction = '') {
  if (!GEMINI_CONFIG.apiKey) {
    if (!showApiKeySetup()) {
      throw new Error('API-Schlüssel erforderlich');
    }
  }
    
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent?key=${GEMINI_CONFIG.apiKey}`;
    
  const requestBody = {
    contents: [{
      parts: [{
        text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt,
      }],
    }],
    generationConfig: {
      temperature: GEMINI_CONFIG.temperature,
      maxOutputTokens: GEMINI_CONFIG.maxTokens,
      topP: 0.8,
      topK: 40,
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH', 
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  };
    
  try {
    console.log('Sende Anfrage an Gemini API...');
        
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
        
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API Fehler: ${errorData.error?.message || response.statusText}`);
    }
        
    const data = await response.json();
        
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Unerwartete API-Antwort von Gemini');
    }
        
    const aiResponse = data.candidates[0].content.parts[0].text;
    console.log('Gemini API-Antwort erhalten');
        
    return aiResponse;
  } catch (error) {
    console.error('Gemini API Fehler:', error);
        
    // Hilfreiche Fehlermeldungen
    if (error.message.includes('API_KEY_INVALID')) {
      showNotification('Ungültiger API-Schlüssel. Bitte überprüfe deinen Gemini API-Schlüssel.', 'error');
    } else if (error.message.includes('QUOTA_EXCEEDED')) {
      showNotification('API-Limit erreicht. Versuche es später erneut.', 'error');
    } else {
      showNotification(`AI-Fehler: ${error.message}`, 'error');
    }
        
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
        
    // Tags ins Eingabefeld einfügen
    const tagsInput = document.getElementById('tags');
    if (tagsInput) {
      tagsInput.value = generatedTags.trim();
      updatePreview();
    }
        
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
    const systemInstruction = `Du bist ein erfahrener Redakteur. Erstelle eine prägnante Zusammenfassung des folgenden Textes.

Regeln:
- 2-3 Sätze maximum
- Fasse die Kernaussagen zusammen
- Philosophische und wissenschaftliche Präzision
- Deutsche Sprache
- Antworte NUR mit der Zusammenfassung`;
        
    const summary = await callGeminiAPI(content, systemInstruction);
        
    // Zusammenfassung in einem Modal oder Alert anzeigen
    const summaryModal = `
            <div class="ai-summary-modal-container">
                <h4 class="ai-summary-modal-header">AI-Zusammenfassung</h4>
                <p class="ai-summary-modal-content">${summary}</p>
                <div class="ai-summary-modal-footer">
                    <button onclick="copyToClipboard('${summary.replace(/'/g, '\\\'')}'); closeModal();" class="ai-summary-modal-button-primary">
                        <i class="fas fa-copy ai-summary-modal-button-icon"></i> Kopieren
                    </button>
                    <button onclick="closeModal();" class="ai-summary-modal-button-secondary ml-2">Schließen</button>
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
        
    // Titel-Vorschläge in einem Modal anzeigen
    const titlesArray = titleSuggestions.split('\n').filter(line => line.trim());
    const titlesHtml = titlesArray.map(title => {
      const cleanTitle = title.replace(/^\d+\.\s*/, '').trim();
      return `<div class="ai-title-suggestion" onclick="selectTitle('${cleanTitle.replace(/'/g, '\\\'')}');">
                    ${cleanTitle}
                </div>`;
    }).join('');
        
    const titleModal = `
            <div class="ai-modal-overlay" id="ai-modal-overlay">
                <div class="ai-modal-container">
                    <h4 class="ai-modal-header">AI-Titel-Vorschläge</h4>
                    <p class="ai-modal-content">Klicke auf einen Titel, um ihn zu übernehmen:</p>
                    <div class="ai-modal-footer">
                        <button onclick="closeModal();" class="ai-modal-button">Schließen</button>
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
    }).catch(err => {
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
  } catch (err) {
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