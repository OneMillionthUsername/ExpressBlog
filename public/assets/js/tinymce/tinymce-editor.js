// TinyMCE Editor Konfiguration und Funktionen
// Diese Datei enthält alle TinyMCE-spezifischen Funktionen für create.html

import { makeApiRequest } from '../api.js';
// Import AI assistant functions
import {
  improveText,
  generateTags,
  generateSummary,
  generateTitleSuggestions,
  showApiKeySetup,
} from '../ai-assistant/ai-assistant.js';

// TinyMCE API-Schlüssel Konfiguration (client uses default; server injects CDN script when allowed)
const defaultTinyMceKey = 'no-api-key';
const TINYMCE_CONFIG = {
  apiKey: defaultTinyMceKey,
  defaultKey: defaultTinyMceKey,
};

// Removed client-side key fetch; server injects the TinyMCE CDN script with key when appropriate.
// The editor will use the global `tinymce` if present or fall back to local loading.

/**
 * Holt den TinyMCE API-Key vom Server.
 * Gibt ein Promise zurück, das beim Auflösen ein Objekt mit { apiKey } liefert.
 * Um den reinen API-Key-String zu erhalten, muss die Funktion asynchron verwendet werden,
 * z.B. über await in einer weiteren Hilfsfunktion wie loadTinyMceApiKey().
 */
// getTinyMceApiKey removed. Server should not expose key via public endpoint. If the page
// included the TinyMCE CDN script (rendered server-side for admins), `tinymce` global will be available.

// TinyMCE API-Schlüssel Setup-Dialog mit verbesserter Benutzerführung
function showTinyMceApiKeySetup() {
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

  // Event Listener für Schließen-Button
  document.getElementById('tinymce-api-key-close').addEventListener('click', () => {
    document.getElementById('tinymce-api-key-modal').remove();
  });
  // Fokus auf das Modal setzen
  document.getElementById('tinymce-api-key-modal').focus();
  return;
}
// TinyMCE dynamisch laden mit CDN-First Approach
async function loadTinyMceScript() {
  // Prüfen ob TinyMCE bereits geladen ist
  if (typeof tinymce !== 'undefined') {
    return true;
  }
    
  // Für Plesk/Production: Zuerst CDN versuchen
  if (!isLocalDevelopment()) {
    try {
      const cdnLoaded = await tryCloudTinyMCE();
      if (cdnLoaded) {
        return true;
      }
      else {
        console.warn('CDN TinyMCE konnte nicht geladen werden, versuche lokalen Fallback');
      }
    } catch (error) {
      console.error('CDN TinyMCE konnte nicht geladen werden:', error);
    }
  }
    
  // Fallback: Lokales TinyMCE
  try {
    const localLoaded = await tryLocalTinyMCE();
    if (localLoaded) {
      return true;
    }
    else {
      console.warn('Lokales TinyMCE konnte nicht geladen werden, versuche Cloud-Fallback');
    }
  } catch (error) {
    console.error('Lokales TinyMCE konnte nicht geladen werden:', error);
  }
    
  // Letzter Fallback: CDN falls noch nicht versucht
  if (isLocalDevelopment()) {
    return await tryCloudTinyMCE();
  }
  throw new Error('TinyMCE konnte nicht geladen werden');
}
// Cloud TinyMCE laden
async function tryCloudTinyMCE() {
  const apiKey = TINYMCE_CONFIG.apiKey || TINYMCE_CONFIG.defaultKey;
  const scriptUrl = `https://cdn.tiny.cloud/1/${apiKey}/tinymce/6/tinymce.min.js`;
    
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.referrerPolicy = 'origin';
        
    // Timeout für Cloud-Loading
    const timeout = setTimeout(() => {
      console.error('TinyMCE Cloud Loading Timeout');
      document.head.removeChild(script);
      reject(new Error('TinyMCE Cloud Loading Timeout'));
    }, 10000); // 10 Sekunden Timeout
        
    script.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };
        
    script.onerror = () => {
      clearTimeout(timeout);
      console.error('Fehler beim Laden des TinyMCE Scripts von Cloud');
      document.head.removeChild(script);
      reject(new Error('TinyMCE Cloud Loading Failed'));
    };
        
    document.head.appendChild(script);
  });
}
// Lokaler TinyMCE Fallback mit mehreren Pfaden
async function tryLocalTinyMCE() {
  const localPaths = [
    '/assets/js/tinymce/tinymce.min.js',     // Hauptpfad
    '/node_modules/tinymce/tinymce.min.js',  // npm Installation
    'https://cdn.jsdelivr.net/npm/tinymce@6/tinymce.min.js', // CDN Fallback
  ];
    
  for (const path of localPaths) {
    try {
      const success = await loadScriptFromPath(path);
      if (success) {
        return true;
      }
      else {
        console.warn(`TinyMCE konnte nicht von ${path} geladen werden, versuche nächsten Pfad`);
      }
    } catch (error) {
      console.error(`Fehler bei ${path}:`, error.message);
    }
  }
  throw new Error('Alle lokalen TinyMCE Pfade fehlgeschlagen');
}
// Hilfsfunktion zum Laden von Scripts mit Promise
function loadScriptFromPath(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
        
    const timeout = setTimeout(() => {
      document.head.removeChild(script);
      reject(new Error('Script loading timeout'));
    }, 5000);
        
    script.onload = () => {
      clearTimeout(timeout);
      // Prüfen ob TinyMCE wirklich verfügbar ist
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
// TinyMCE Editor initialisieren
async function initializeTinyMCE() {
  // Prüfen ob das Element existiert
  const contentElement = document.getElementById('content');
  if (!contentElement) {
    console.error('TinyMCE: Content-Element #content nicht gefunden');
    return;
  }
    
  // TinyMCE Script laden falls noch nicht verfügbar
  if (typeof tinymce === 'undefined') {
    try {
      await loadTinyMceScript();
    } catch (error) {
      console.error('TinyMCE Script konnte nicht geladen werden:', error);
            
      // Detaillierte Fehlermeldung für den Benutzer
      let errorMessage = 'TinyMCE Editor konnte nicht geladen werden.\n\n';
            
      if (error.message.includes('timeout') || error.message.includes('connection')) {
        errorMessage += 'Mögliche Ursachen:\n' +
                              '• Netzwerkprobleme oder langsame Verbindung\n' +
                              '• Blockierung durch Firewall/Antivirus\n' +
                              '• HTTPS-Zertifikatsprobleme\n\n';
      } else if (error.message.includes('Cloud')) {
        errorMessage += 'Mögliche Ursachen:\n' +
                              '• TinyMCE Cloud Service nicht erreichbar\n' +
                              '• API-Schlüssel ungültig oder abgelaufen\n' +
                              '• Netzwerkbeschränkungen\n\n';
      } else {
        errorMessage += 'Mögliche Ursachen:\n' +
                              '• Content Security Policy Blockierung\n' +
                              '• Browser-Kompatibilitätsprobleme\n' +
                              '• Script-Blocker aktiv\n\n';
      }
            
      errorMessage += 'Möchten Sie den einfachen Textbereich verwenden?\n' +
                           '(Alle Funktionen außer WYSIWYG-Bearbeitung sind verfügbar)';
            
      // Fallback: Einfachen Textbereich anbieten
      const useSimple = confirm(errorMessage);
            
      if (useSimple) {
        enableTextareaFallback(contentElement);
        showNotification('Einfacher Textbereich aktiviert - alle Funktionen verfügbar', 'info');
      } else {
        // API-Schlüssel Setup anbieten
        const wantSetup = confirm(
          'Möchten Sie einen neuen TinyMCE API-Schlüssel konfigurieren?\n\n' +
                    'Ein kostenloser API-Schlüssel kann unter https://www.tiny.cloud/ erstellt werden.',
        );
        if (wantSetup) {
          showTinyMceApiKeySetup();
        }
      }
      return;
    }
  }
  else {
    console.warn('TinyMCE ist nicht verfügbar, versuche Fallback');
  }

  // Vorherige TinyMCE Instanz entfernen falls vorhanden
  if (tinymce.get('content')) {
    tinymce.remove('#content');
  }

  try {
    await tinymce.init({
      selector: '#content',
      height: 500,
      menubar: 'edit view insert format tools help',
            
      // Basis-URL für TinyMCE dynamisch setzen
      base_url: isLocalDevelopment() 
        ? '/assets/js/tinymce' 
        : 'https://cdn.tiny.cloud/1/' + (TINYMCE_CONFIG.apiKey || 'no-api-key') + '/tinymce/6',
      suffix: '.min',
            
      // Für CDN: base_url nicht setzen
      ...(!isLocalDevelopment() 
        ? {} 
        : { base_url: '/assets/js/tinymce', suffix: '.min' }),
            
      plugins: [
        'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
        'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
        'insertdatetime', 'media', 'table', 'help', 'wordcount', 'autosave',
        'save', 'directionality', 'emoticons', 'template',
        'codesample', 'nonbreaking', 'pagebreak', 'quickbars',
      ],
      toolbar: [
        'undo redo | bold italic underline strikethrough | fontsize forecolor backcolor',
        'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent',
        'link image media table | codesample blockquote hr pagebreak | emoticons charmap',
        'searchreplace visualblocks code fullscreen preview | save help',
      ],
      toolbar_mode: 'floating',
      quickbars_selection_toolbar: 'bold italic underline | quicklink blockquote',
      quickbars_insert_toolbar: 'image media table hr',
      contextmenu: 'link image table configurepermanentpen',
            
      // Autosave-Funktionalität
      autosave_interval: '60s',
      autosave_prefix: 'blogpost_draft_',
      autosave_restore_when_empty: true,
      autosave_retention: '1440m', // 24 Stunden
            
      // Erweiterte Formatierungsoptionen
      font_size_formats: '8pt 10pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt 48pt 60pt 72pt',
      block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Heading 5=h5; Heading 6=h6; Preformatted=pre; Address=address',
            
      // Stil-Definitionen (verkürzt)
      style_formats: [
        {title: 'Headers', items: [
          {title: 'Header 1', block: 'h1'},
          {title: 'Header 2', block: 'h2'},
          {title: 'Header 3', block: 'h3'},
        ]},
        {title: 'Inline', items: [
          {title: 'Bold', inline: 'strong'},
          {title: 'Italic', inline: 'em'},
          {title: 'Code', inline: 'code'},
        ]},
      ],
            
      // Comprehensive content styles to match final post appearance
      content_css: [
        'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Crimson+Text:wght@400;600;700&display=swap',
      ],
      content_css: [
        '/assets/css/tinymce-content.css',
      ],            
      // Upload-Konfiguration (mit Fallback-Option)
      images_upload_handler: function(blobInfo, success, failure, progress) {
        // Fallback-Option: Verwende einfachen Upload bei kleineren Bildern
        const blob = blobInfo.blob();
        const sizeInMB = blob.size / 1024 / 1024;
                
        if (sizeInMB < 2) {
          // Kleine Bilder: verwende direkten Upload ohne Komprimierung
          return simpleImageUploadHandler(blobInfo, success, failure, progress);
        } else {
          // Große Bilder: verwende komprimierten Upload
          return compressAndUploadImage(blobInfo, success, failure, progress);
        }
      },
            
      // Erweiterte Einstellungen
      paste_data_images: true,
      automatic_uploads: true,
      images_file_types: 'jpg,jpeg,png,gif,webp',
            
      // Branding entfernen
      branding: false,
      promotion: false,
            
      // Tastenkürzel
      custom_shortcuts: true,
            
      // Vereinfachte Tabellen-Funktionen
      table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow',
            
      // Link-Funktionen
      link_context_toolbar: true,
            
      // Listen-Funktionen
      lists_indent_on_tab: true,
            
      // Event-Handler (erweitert mit Dark Mode-Unterstützung)
      setup: function(editor) {
        editor.on('init', function() {
          // Apply dark mode if active
          applyTinyMCETheme(editor);
                    
          showNotification('Editor bereit!', 'success');
          if (typeof checkAndPrefillEditPostForm === 'function') {
            checkAndPrefillEditPostForm();
          }
        });
                
        editor.on('input keyup paste', function() {
          updatePreview();
        });
                
        // Listen for theme changes
        if (typeof window.addEventListener === 'function') {
          window.addEventListener('themeChanged', function() {
            applyTinyMCETheme(editor);
          });
        }
      },
    });

        
  } catch (error) {
    console.error('Fehler bei TinyMCE-Initialisierung:', error);
        
    // Fallback zu normalem Textarea
    contentElement.style.display = 'block';
    contentElement.style.height = '400px';
    contentElement.style.resize = 'vertical';

    showNotification('Editor-Problem - verwende einfachen Textbereich', 'warning');
  }
}

// TinyMCE Theme Management for Dark Mode
// function applyTinyMCETheme(editor) {
//     if (!editor || !editor.getBody) return;
    
//     const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
//     const editorBody = editor.getBody();
    
//     if (editorBody) {
//         if (isDarkMode) {
//             editorBody.setAttribute('data-theme', 'dark');
//             // Apply dark mode styles to editor frame
//             editorBody.style.backgroundColor = '#121212';
//             editorBody.style.color = '#e0e0e0';
//         } else {
//             editorBody.removeAttribute('data-theme');
//             // Apply light mode styles to editor frame
//             editorBody.style.backgroundColor = '#ffffff';
//             editorBody.style.color = '#2c3e50';
//         }
//     }
// }

// Global function to update TinyMCE theme when dark mode toggles
// function updateTinyMCETheme() {
//     if (typeof tinymce !== 'undefined') {
//         const editor = tinymce.get('content');
//         if (editor) {
//             applyTinyMCETheme(editor);
//         }
//     }
// }

// (Removed legacy global exports - use module exports and event binding instead)

// Textarea Fallback aktivieren
function enableTextareaFallback(contentElement) {
  contentElement.className = 'textarea-fallback';
  showNotification('Verwende einfachen Textbereich', 'info');

  // Event Listener für Preview-Update hinzufügen
  contentElement.addEventListener('input', updatePreview);
}

// Draft-Management-Funktionen
function checkForDrafts() {
  const draftKey = 'blogpost_draft_content';
  const savedDraft = localStorage.getItem(draftKey);
    
  if (savedDraft) {
    if (confirm('Es wurde ein gespeicherter Entwurf gefunden. Möchten Sie ihn wiederherstellen?')) {
      try {
        const draftData = JSON.parse(savedDraft);
                
        // Titel und Tags wiederherstellen
        if (draftData.title) {
          document.getElementById('title').value = draftData.title;
        }
        if (draftData.tags) {
          document.getElementById('tags').value = draftData.tags;
        }
                
        // Inhalt wiederherstellen (TinyMCE oder Textarea)
        if (draftData.content) {
          const tinymceEditor = tinymce.get('content');
          if (tinymceEditor) {
            tinymceEditor.setContent(draftData.content);
          } else {
            // Fallback: In Textarea wiederherstellen
            const contentElement = document.getElementById('content');
            if (contentElement) {
              contentElement.value = draftData.content.replace(/<[^>]*>/g, ''); // HTML-Tags entfernen
            }
          }
        }
                
        showNotification('Entwurf wiederhergestellt 📄', 'success');
        updatePreview();
      } catch (error) {
        console.error('Fehler beim Wiederherstellen des Entwurfs:', error);
        showNotification('Fehler beim Wiederherstellen des Entwurfs', 'error');
      }
    }
  }
}
function saveDraft() {
  const title = document.getElementById('title').value;
  let content = '';
    
  // Content aus TinyMCE oder Textarea holen
  const tinymceEditor = tinymce.get('content');
  if (tinymceEditor) {
    content = tinymceEditor.getContent();
  } else {
    // Fallback: Direkt aus dem Textarea
    const contentElement = document.getElementById('content');
    if (contentElement) {
      content = contentElement.value;
    }
  }
    
  const tags = document.getElementById('tags').value;
    
  const draftData = {
    title: title,
    content: content,
    tags: tags,
    timestamp: new Date().toISOString(),
  };
    
  localStorage.setItem('blogpost_draft_content', JSON.stringify(draftData));
  //showNotification('Entwurf gespeichert', 'success');
}
function clearDraft() {
  localStorage.removeItem('blogpost_draft_content');
  const tinymceEditor = tinymce.get('content');
  if (tinymceEditor) {
    tinymceEditor.setContent('');
  } else {
    const contentElement = document.getElementById('content');
    if (contentElement) {
      contentElement.value = '';
    }
  }
  document.getElementById('title').value = '';
  document.getElementById('tags').value = '';
  updatePreview();
  showNotification('Entwurf gelöscht 🗑️', 'info');
}

// Template-Funktionen
function insertTemplate(template) {
  const templates = {
    'blog-post': `
            <h1>Titel des Blogposts</h1>
            <p><em>Einleitungstext, der die Leser neugierig macht...</em></p>
            
            <h2>Hauptteil</h2>
            <p>Hier entwickeln Sie Ihre Hauptargumente...</p>
            
            <blockquote>
                <p>Ein inspirierendes Zitat oder eine wichtige Aussage.</p>
            </blockquote>
            
            <h2>Fazit</h2>
            <p>Zusammenfassung und Schlussfolgerungen...</p>
        `,
    'philosophy': `
            <h1>Philosophische Betrachtung</h1>
            <p><em>Sub specie aeternitatis - unter dem Gesichtspunkt der Ewigkeit</em></p>
            
            <h2>These</h2>
            <p>Formulierung der zentralen philosophischen These...</p>
            
            <h2>Argumentation</h2>
            <p>Entwicklung der Argumente...</p>
            
            <h2>Einwände und Diskussion</h2>
            <p>Auseinandersetzung mit möglichen Gegenargumenten...</p>
            
            <h2>Schlussfolgerung</h2>
            <p>Zusammenfassung und weiterführende Gedanken...</p>
        `,
    'science': `
            <h1>Wissenschaftliche Erörterung</h1>
            <p><em>Einführung in das Thema...</em></p>
            
            <h2>Hintergrund</h2>
            <p>Kontext und bisherige Forschung...</p>
            
            <h2>Methodik</h2>
            <p>Herangehensweise und Methoden...</p>
            
            <h2>Ergebnisse</h2>
            <p>Darstellung der Erkenntnisse...</p>
            
            <h2>Diskussion</h2>
            <p>Interpretation und Bedeutung...</p>
            
            <h2>Ausblick</h2>
            <p>Zukünftige Entwicklungen und Forschungsrichtungen...</p>
        `,
  };
    
  if (templates[template]) {
    const tinymceEditor = tinymce.get('content');
    if (tinymceEditor) {
      tinymceEditor.setContent(templates[template]);
    } else {
      // Fallback: In Textarea einfügen (HTML-Tags entfernen für bessere Lesbarkeit)
      const contentElement = document.getElementById('content');
      if (contentElement) {
        const plainText = templates[template]
          .replace(/<h[1-6]>/g, '\n\n')
          .replace(/<\/h[1-6]>/g, '\n')
          .replace(/<p>/g, '\n')
          .replace(/<\/p>/g, '\n')
          .replace(/<blockquote>/g, '\n"')
          .replace(/<\/blockquote>/g, '"\n')
          .replace(/<em>/g, '')
          .replace(/<\/em>/g, '')
          .replace(/\n\s*\n/g, '\n\n')
          .trim();
        contentElement.value = plainText;
      }
    }
    updatePreview();
    showNotification('Vorlage eingefügt', 'success');
  }
}

// Tag-Funktionen
function addTag(tagName) {
  const tagsInput = document.getElementById('tags');
  const currentTags = tagsInput.value;
    
  if (currentTags === '') {
    tagsInput.value = tagName;
  } else if (!currentTags.split(',').map(t => t.trim()).includes(tagName)) {
    tagsInput.value = currentTags + ', ' + tagName;
  }
    
  updatePreview();
  saveDraft();
}

// Vorschau-Funktionen
function updatePreview() {
  const title = document.getElementById('title').value;
  let content = '';
    
  // Content aus TinyMCE oder Textarea holen
  const tinymceEditor = tinymce.get('content');
  if (tinymceEditor) {
    content = tinymceEditor.getContent();
  } else {
    // Fallback: Direkt aus dem Textarea
    const contentElement = document.getElementById('content');
    if (contentElement) {
      content = contentElement.value.replace(/\n/g, '<br>'); // Einfache HTML-Konvertierung
    }
  }
    
  const tags = document.getElementById('tags').value;
    
  const previewBox = document.getElementById('preview-content');
    
  if (!title && !content) {
    previewBox.innerHTML = '<p class="preview-placeholder">Die Vorschau wird hier angezeigt, sobald du schreibst...</p>';
    return;
  }
    
  let previewHtml = '';
    
  if (title) {
    previewHtml += `<h2 class="preview-post-title">${title}</h2>`;
  }
    
  if (content) {
    previewHtml += `<div class="preview-post-content">${content}</div>`;
  }
    
  if (tags) {
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    if (tagArray.length > 0) {
      previewHtml += `
                <div class="preview-tags">
                    🏷️ ${tagArray.map(tag => `<span class="preview-tag">${tag}</span>`).join(' ')}
                </div>
            `;
    }
  }
    
  previewBox.innerHTML = previewHtml;
}

let previewVisible = true;
function togglePreview() {
  const preview = document.querySelector('.form-preview');
  previewVisible = !previewVisible;
  preview.style.display = previewVisible ? 'block' : 'none';
    
  const toggleBtn = document.querySelector('.btn-outline-info');
  toggleBtn.innerHTML = previewVisible ? 
    '<span class="btn-icon">👁️</span> Vorschau verbergen' : 
    '<span class="btn-icon">👁️</span> Vorschau anzeigen';
}

// Formular-Funktionen
function resetForm() {
  if (confirm('Möchtest du wirklich alle Eingaben zurücksetzen?')) {
    document.getElementById('blogPostForm').reset();
        
    // TinyMCE Editor zurücksetzen
    const tinymceEditor = tinymce.get('content');
    if (tinymceEditor) {
      tinymceEditor.setContent('');
    } else {
      // Fallback: Textarea zurücksetzen
      const contentElement = document.getElementById('content');
      if (contentElement) {
        contentElement.value = '';
      }
    }
        
    updatePreview();
    clearDraft();
    showNotification('Formular zurückgesetzt', 'info');
  }
}

// Autosave-Intervall (alle 60 Sekunden)
let lastDraft = '';
setInterval(() => {
  const title = document.getElementById('title')?.value || '';
  const tags = document.getElementById('tags')?.value || '';
  const tinymceEditor = tinymce.get('content');
  const content = tinymceEditor ? tinymceEditor.getContent() : '';
  const currentDraft = JSON.stringify({ title, content, tags });

  if (currentDraft !== lastDraft) {
    saveDraft();
    lastDraft = currentDraft;
  }
}, 60000); // 60 Sekunden

// Erweiterte Bild-Management-Funktionen

// Alle hochgeladenen Bilder auflisten (für Admin)
// async function listUploadedImages() {
//     try {
//         const response = await fetch('/api/images');
//         if (!response.ok) {
//             throw new Error(`HTTP ${response.status}`);
//         }
//         return await response.json();
//     } catch (error) {
//         console.error('Fehler beim Laden der Bilderliste:', error);
//         return [];
//     }
// }

// Bild löschen (Admin-only)
// async function deleteUploadedImage(filename) {
//     if (!checkAdminStatusCached()) {
//         alert('Nur Administratoren können Bilder löschen.');
//         return false;
//     }
    
//     if (!confirm(`Möchten Sie das Bild "${filename}" wirklich löschen?`)) {
//         return false;
//     }
    
//     try {
//         const response = await fetch(`/assets/uploads/${filename}`, {
//             method: 'DELETE'
//         });
        
//         if (!response.ok) {
//             const error = await response.json();
//             throw new Error(error.error || 'Unbekannter Fehler');
//         }
        
//         const result = await response.json();
//         showNotification(`Bild "${filename}" erfolgreich gelöscht.`, 'info');
//         return true;
//     } catch (error) {
//         console.error('Fehler beim Löschen des Bildes:', error);
//         alert('Fehler beim Löschen: ' + error.message);
//         return false;
//     }
// }

// Drag & Drop für Bilder im Editor
function initializeDragAndDrop() {
  const editor = tinymce.get('content');
  if (!editor) return;
    
  // Drag & Drop Events
  editor.on('dragover', function(e) {
    e.preventDefault();
    editor.getContainer().style.borderColor = '#3498db';
  });
    
  editor.on('dragleave', function(e) {
    e.preventDefault();
    editor.getContainer().style.borderColor = '';
  });
    
  editor.on('drop', function(e) {
    e.preventDefault();
    editor.getContainer().style.borderColor = '';
        
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          // TinyMCE wird automatisch den Upload-Handler aufrufen
        }
      });
    }
  });
}

// Bild-Galerie für den Editor (erweiterte Funktion)
// function showImageGallery() {
//     if (!checkAdminStatusCached()) {
//         alert('Nur Administratoren können die Bildergalerie verwenden.');
//         return;
//     }
    
//     // Hier könnte eine Modal-Galerie implementiert werden
//     // Für jetzt: einfacher Platzhalter
//     alert('Bildergalerie wird in einer zukünftigen Version implementiert.');
// }

// Bild-Komprimierung und Upload-Funktion
async function compressAndUploadImage(blobInfo, success, failure, progress) {
  return new Promise(async (resolve, reject) => {
    try {
      const blob = blobInfo.blob();
      const filename = blobInfo.filename() || 'upload.jpg';
      const originalSize = blob.size / 1024 / 1024; // MB
            
      // Bildvalidierung vor Upload
      try {
        validateImageBeforeUpload(blob);
      } catch (validationError) {
        failure(validationError.message, { remove: true });
        showNotification(`${validationError.message}`, 'error');
        reject(validationError);
        return;
      }
            
      if (progress) {
        progress(10);
      }
            
      // Intelligente Komprimierung basierend auf Dateigröße
      let quality = 0.9;
      let maxWidth = 1920;
      let maxHeight = 1080;
            
      if (originalSize > 10) {
        quality = 0.6;
        maxWidth = 1280;
        maxHeight = 720;
      } else if (originalSize > 5) {
        quality = 0.7;
        maxWidth = 1600;
        maxHeight = 900;
      } else if (originalSize > 2) {
        quality = 0.8;
      }
                        
      // Bild komprimieren
      const compressedBase64 = await compressImage(blob, quality, maxWidth, maxHeight);
            
      if (progress) {
        progress(30);
      }
            
      // Komprimierungsrate berechnen
        const compressedSize = compressedBase64.length * 0.75 / 1024 / 1024; // Ungefähre Größe nach Base64-Dekodierung
        const _compressionRate = ((originalSize - compressedSize) / originalSize * 100);
                        
      // Fallback: Wenn das Bild immer noch zu groß ist, aggressiver komprimieren
      let finalBase64 = compressedBase64;
      if (compressedSize > 40) { // Mehr als 40MB nach Komprimierung
        finalBase64 = await compressImage(blob, 0.4, 1024, 768);
                
        if (progress) {
              progress(30);
            }
      }
            
      // Zu Server senden mit Retry-Logik - übergebe das ursprüngliche Blob für weitere Komprimierung
      const uploadResult = await uploadWithRetry(finalBase64, filename, blob, success, failure, progress);
      resolve(uploadResult); // Upload erfolgreich - gebe die URL weiter
            
    } catch (error) {
      console.error('Fehler beim Hochladen des Bildes:', error);
      try {
        await handleUploadError(error, blobInfo, success, failure);
      } catch (handlerError) {
        console.error('Fehler in Upload-Error-Handler:', handlerError);
      }
      reject(error);
    }
  });
}
// Vereinfachter TinyMCE Upload-Handler (verwendet /upload/image ohne Komprimierung)
  function simpleImageUploadHandler(blobInfo, success, failure, _progress) {
  return new Promise((resolve, reject) => {
    try {
      const blob = blobInfo.blob();
      const filename = blobInfo.filename() || 'upload.jpg';
            
      // Konvertiere Blob zu Base64
      const reader = new FileReader();
      reader.onload = function() {
        const base64Data = reader.result;
                
        (async () => {
          try {
            const apiResult = await makeApiRequest('/upload/image', {
              method: 'POST',
              body: JSON.stringify({ image: base64Data, name: filename }),
            });
            if (!apiResult || apiResult.success !== true) {
              const errMsg = (apiResult && apiResult.error) || 'Upload fehlgeschlagen';
              const error = new Error(errMsg);
              failure(error.message, { remove: true });
              showNotification(`Upload-Fehler: ${errMsg}`, 'error');
              reject(error);
              return;
            }
            const result = apiResult.data;
            const imageUrl = debugUploadResponse(result, 'Upload');
            if (!imageUrl) {
              const error = new Error('Server gab keine gültige URL zurück');
              failure(error.message, { remove: true });
              reject(error);
              return;
            }
            safeSuccess(success, imageUrl, 'Upload');
            showNotification(`Bild "${result.filename}" hochgeladen! 📸`, 'success');
            resolve(imageUrl);
          } catch (error) {
            console.error('Upload fehlgeschlagen:', error);
            failure(error.message, { remove: true });
            showNotification(`Upload-Fehler: ${error.message}`, 'error');
            reject(error);
          }
        })();
      };
            
      reader.onerror = function() {
        const error = new Error('Fehler beim Lesen der Bilddatei');
        failure(error.message, { remove: true });
        reject(error);
      };
            
      reader.readAsDataURL(blob);
            
    } catch (error) {
      console.error('Fehler beim Upload:', error);
      failure(error.message, { remove: true });
      reject(error);
    }
  });
}
// Sicherer Success-Wrapper für TinyMCE Upload-Handler
function safeSuccess(success, imageUrl, _context = 'Upload') {
  if (!success || typeof success !== 'function') {
    throw new Error('Ungültiger Success Callback');
  }
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error(`Ungültige URL-Response: ${typeof imageUrl}`);
  }
    
  if (!imageUrl || imageUrl.trim() === '') {
    throw new Error('Leere URL erhalten');
  }
  success(imageUrl);
}

// Export helper functions used by other modules or future code
// Internal functions are prefixed with '_' to indicate they are internal but
// we export them under public names for other modules/tests to consume.
export {
  checkForDrafts,
  addTag,
  initializeDragAndDrop,
  compressAndUploadImage,
};

// Vereinfachte Upload-Fehlerbehandlung (hauptsächlich für nicht-komprimierbare Fehler)
async function handleUploadError(error, blobInfo, success, failure) {
  const filename = blobInfo.filename() || 'upload.jpg';
    
  console.error(`Upload-Fehler für ${filename}:`, error);
    
  // Spezifische Fehlerbehandlung für verschiedene Fehlertypen
  if (error.message.includes('Network') || error.message.includes('fetch')) {
    failure('Netzwerkfehler beim Upload. Bitte prüfen Sie Ihre Internetverbindung.', { remove: true });
    showNotification('Netzwerkfehler beim Upload - bitte Internetverbindung prüfen', 'error');
  } else if (error.message.includes('500')) {
    failure('Server-Fehler beim Upload. Bitte versuchen Sie es später erneut.', { remove: true });
    showNotification('Server-Fehler beim Upload - bitte später versuchen', 'error');
  } else if (error.message.includes('413') || error.message.includes('Payload Too Large')) {
    failure('Bild ist zu groß. Bitte verwenden Sie ein kleineres Bild (empfohlen: < 2MB).', { remove: true });
    showNotification('Bild zu groß - bitte verwenden Sie ein kleineres Bild', 'error');
  } else if (error.message.includes('400')) {
    failure('Ungültiges Bildformat. Unterstützt werden: JPG, PNG, GIF, WebP.', { remove: true });
    showNotification('Ungültiges Bildformat', 'error');
  } else {
    failure('Unbekannter Fehler beim Upload: ' + error.message, { remove: true });
    showNotification('Upload-Fehler: ' + error.message, 'error');
  }
}
// Upload-Fortschritts-Anzeige
function showUploadProgress(filename, progress) {
  let progressContainer = document.getElementById('upload-progress');

  if (!progressContainer) {
    progressContainer = document.createElement('div');
    progressContainer.id = 'upload-progress';
    document.body.appendChild(progressContainer);
  }

  progressContainer.innerHTML = `
        <div class="upload-item">
            <i class="fas fa-upload upload-item-icon"></i>
            <span class="upload-item-text">${filename}</span>
        </div>
        <div class="progress">
            <div class="progress-bar" style="width: ${progress}%;"></div>
        </div>
        <div class="upload-progress-text">
            ${progress}% hochgeladen
        </div>
    `;

  if (progress >= 100) {
    setTimeout(() => {
      if (progressContainer.parentNode) {
        progressContainer.parentNode.removeChild(progressContainer);
      }
    }, 2000);
  }
}
// Bild-Komprimierungsfunktion
function compressImage(file, quality = 0.8, maxWidth = 1920, maxHeight = 1080) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
        
    img.onload = function() {
      // Berechne neue Dimensionen unter Beibehaltung des Seitenverhältnisses
      let { width, height } = img;
            
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
            
      // Canvas-Größe setzen
      canvas.width = width;
      canvas.height = height;
            
      // Bild auf Canvas zeichnen
      ctx.drawImage(img, 0, 0, width, height);
            
      // Als komprimiertes Base64 ausgeben
      try {
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } catch (error) {
        reject(new Error('Fehler bei der Bild-Komprimierung: ' + error.message));
      }
    };
        
    img.onerror = function() {
      reject(new Error('Fehler beim Laden des Bildes für die Komprimierung'));
    };
        
    // FileReader für Blob-zu-Image Konvertierung
    const reader = new FileReader();
    reader.onload = function(e) {
      img.src = e.target.result;
    };
    reader.onerror = function() {
      reject(new Error('Fehler beim Lesen der Bilddatei'));
    };
    reader.readAsDataURL(file);
  });
}
// Upload mit Retry-Logik und progressiver Komprimierung
async function uploadWithRetry(base64Data, filename, originalBlob, success, failure, progress, attempt = 1) {
  const maxAttempts = 3;
    
    try {
      const apiResult = await makeApiRequest('/upload/image', {
        method: 'POST',
        body: JSON.stringify({ image: base64Data, name: filename }),
      });
        
    if (progress) {
      progress(50 + (attempt * 15));
    }
        
    if (!apiResult || apiResult.success !== true) {
      throw new Error(apiResult && apiResult.error ? apiResult.error : 'Upload fehlgeschlagen');
    }
    const result = apiResult.data;
        
    if (progress) {
      progress(100);
    }
                
    // Debug Response
    const imageUrl = debugUploadResponse(result, 'Komprimierter Upload');
    if (!imageUrl) {
      const error = new Error('Server gab keine gültige URL zurück');
      failure(error.message, { remove: true });
      throw error;
    }
        
  safeSuccess(success, imageUrl, 'Komprimierter Upload');
    showNotification(`Bild "${result.filename}" erfolgreich hochgeladen! 📸`, 'success');
    return imageUrl; // Nur die URL zurückgeben, nicht das ganze Objekt
        
  } catch (error) {
    console.error(`Upload-Versuch ${attempt} fehlgeschlagen:`, error);
        
    // Bei 413 (Payload Too Large) oder ähnlichen Größen-Fehlern und wenn noch Versuche übrig sind
    if ((error.message.includes('413') || error.message.includes('Payload Too Large') || error.message.includes('entity too large')) && attempt < maxAttempts) {
            
      // Progressive Komprimierungseinstellungen für weitere Versuche
      const compressionSettings = [
        { quality: 0.6, width: 1280, height: 720 },  // Versuch 2
        { quality: 0.4, width: 1024, height: 576 },  // Versuch 3
      ];
            
      const settings = compressionSettings[attempt - 1];
            
      showNotification(`Bild zu groß - versuche stärkere Komprimierung (${Math.round(settings.quality * 100)}% Qualität)...`, 'info');
            
      try {
        // Mit dem ursprünglichen Blob neu komprimieren
        const newCompressed = await compressImage(
          originalBlob, 
          settings.quality, 
          settings.width, 
          settings.height,
        );
                
        // Neue Größe berechnen und loggen
  const _newSize = newCompressed.length * 0.75 / 1024 / 1024;                
        return await uploadWithRetry(newCompressed, filename, originalBlob, success, failure, progress, attempt + 1);
                
      } catch (compressionError) {
        console.error('Fehler bei der Rekomprimierung:', compressionError);
        failure(`Komprimierungsfehler: ${compressionError.message}`, { remove: true });
        showNotification('Fehler bei der Bildkomprimierung', 'error');
        return;
      }
    } else {
      // Maximale Versuche erreicht oder anderer Fehler
      let errorMessage;
            
      if (error.message.includes('413') || error.message.includes('Payload Too Large') || error.message.includes('entity too large')) {
        errorMessage = 'Bild ist auch nach maximaler Komprimierung zu groß. Bitte verwenden Sie ein kleineres Bild (empfohlen: < 2MB)';
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        errorMessage = 'Netzwerkfehler beim Upload. Bitte prüfen Sie Ihre Internetverbindung.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server-Fehler beim Upload. Bitte versuchen Sie es später erneut.';
      } else {
        errorMessage = `Upload-Fehler: ${error.message}`;
      }
            
      failure(errorMessage, { remove: true });
      showNotification(`${errorMessage}`, 'error');
    }
  }
}
// Bildvalidierung vor dem Upload
function validateImageBeforeUpload(file) {
  const maxSize = 100 * 1024 * 1024; // 100MB absolutes Maximum
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
  if (file.size > maxSize) {
    throw new Error(`Bild ist zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 100MB`);
  }
    
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Ungültiger Dateityp: ${file.type}. Unterstützt: JPG, PNG, GIF, WebP`);
  }
    
  return true;
}
// Initialisierung und Event Listener
async function initializeBlogEditor() {
  // Prüfe Admin Status
  if (!await checkAdminStatusCached()) {
    return;
  }
  // TinyMCE initialisieren
  await initializeTinyMCE();
  // Event Listener für Titel und Tags
  const titleElement = document.getElementById('title');
  const tagsElement = document.getElementById('tags');
  if (titleElement) {
    titleElement.addEventListener('input', function() {
      updatePreview();
      saveDraft();
    });
  } else {
    console.error('Title-Element nicht gefunden');
  }
  if (tagsElement) {
    tagsElement.addEventListener('input', function() {
      updatePreview();
      saveDraft();
    });
  } else {
    console.error('Tags-Element nicht gefunden');
  }

  // Bind UI buttons that used to call inline onclick handlers
  try {
    // Template buttons
    document.querySelectorAll('[data-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tpl = btn.dataset.template;
        if (typeof insertTemplate === 'function') insertTemplate(tpl);
      });
    });

    // Generic data-action bindings — use an explicit action map instead of eval/global lookups
      // actionMap is exposed via getActionMap for testing and easier wiring
      const actionMap = getActionMap();

    document.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      if (!action) return;
      btn.addEventListener('click', () => {
        const fn = actionMap[action];
        if (typeof fn === 'function') {
          try {
            fn();
          } catch (err) {
            console.error(`Error executing action '${action}':`, err);
          }
        } else {
          // Silent no-op for unmapped actions; warn for easier debugging
          console.warn(`No action mapped for '${action}'`);
        }
      });
    });
  } catch (err) {
    // Binding errors shouldn't break editor initialization
    console.warn('initializeBlogEditor: could not bind some UI actions', err);
  }
}


// Debug-Funktion für Upload-Response (für Troubleshooting)
function debugUploadResponse(result, context = 'Upload') {
    
  // Validiere Response-Struktur
  const imageUrl = result?.location || result?.url;
  if (!imageUrl) {
    console.error(`${context}: Keine URL in Response gefunden`);
    return null;
  }
    
  if (typeof imageUrl !== 'string') {
    console.error(`${context}: URL ist kein String:`, imageUrl);
    return null;
  }
  return imageUrl;
}
// Test-Funktion für Upload-Handler (für Debugging)
function testImageUploadHandler() {
  // Erstelle ein Test-Blob
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 100, 100);
    
  canvas.toBlob(function(blob) {
    const testBlobInfo = {
      blob: () => blob,
      filename: () => 'test-image.jpg',
    };
        
    const success = (url) => {
            
      // Zusätzlicher Test: Validiere dass TinyMCE die URL verarbeiten kann
      if (typeof url === 'string' && url.trim() !== '') {
        showNotification('Test Upload erfolgreich!', 'success');
      } else {
        console.error('Test Upload: URL ist ungültig für TinyMCE:', url);
        showNotification('Test Upload: URL-Problem erkannt!', 'error');
      }
    };
        
    const failure = (error) => {
      console.error('Test Upload fehlgeschlagen:', error);
      showNotification('Test Upload fehlgeschlagen: ' + error, 'error');
    };
        
    const progress = (percent) => {
      showUploadProgress('test-image.jpg', percent);
    };
        
    // Teste einfachen Upload
    simpleImageUploadHandler(testBlobInfo, success, failure, progress)
      .then(() => { /* upload test resolved */ })
      .catch(error => {
        if(typeof failure === 'function') {
          failure(error);
        } else {
          console.error('Test Upload Promise fehlgeschlagen:', error);
        }
      });
  }, 'image/jpeg', 0.8);
}

// TinyMCE Connection Diagnostics
function runTinyMCEDiagnostics() {
    
  const diagnostics = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    location: window.location.href,
    tinymceLoaded: typeof tinymce !== 'undefined',
    apiKey: TINYMCE_CONFIG.apiKey || 'Nicht gesetzt',
    localStorage: !!window.localStorage,
    fetch: !!window.fetch,
    promise: !!window.Promise,
  };
    
  // Test verschiedene TinyMCE URLs
  const testUrls = [
    `https://cdn.tiny.cloud/1/${TINYMCE_CONFIG.apiKey || 'no-api-key'}/tinymce/6/tinymce.min.js`,
    '/assets/js/tinymce/tinymce.min.js',
    '/node_modules/tinymce/tinymce.min.js',
    'https://cdn.jsdelivr.net/npm/tinymce@6/tinymce.min.js',
  ];
        
  // Test URL Erreichbarkeit
  testUrls.forEach(async (url, index) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        diagnostics[`testUrl${index + 1}`] = { url, status: 'Erreichbar' };
      } else {
        console.warn(`${url} nicht erreichbar: HTTP ${response.status}`);
        diagnostics[`testUrl${index + 1}`] = { url, status: `Nicht erreichbar: HTTP ${response.status}` };
      }
    } catch (error) {
      console.error(`Fehler beim Laden von ${url}:`, error);
      diagnostics[`testUrl${index + 1}`] = { url, status: 'Fehler', error: error.message };
      return;
    }
  });
    
  // CSP Test
  try {
    const testScript = document.createElement('script');
    // Use a harmless no-op to avoid polluting the console during diagnostics
    testScript.src = 'data:text/javascript,/* CSP Test OK */';
    document.head.appendChild(testScript);
    document.head.removeChild(testScript);
  } catch (error) {
    console.error('CSP Test fehlgeschlagen:', error);
    diagnostics.cspTest = 'Fehlgeschlagen: ' + error.message;
  }
    
  return diagnostics;
}
// Globale Test-Funktion verfügbar machen
// Expose action map for unit testing and reuse
function getActionMap() {
  return {
    improveText: (typeof improveText === 'function') ? improveText : undefined,
    generateTitleSuggestions: (typeof generateTitleSuggestions === 'function') ? generateTitleSuggestions : undefined,
    generateTags: (typeof generateTags === 'function') ? generateTags : undefined,
    generateSummary: (typeof generateSummary === 'function') ? generateSummary : undefined,
    saveDraft: (typeof saveDraft === 'function') ? saveDraft : undefined,
    clearDraft: (typeof clearDraft === 'function') ? clearDraft : undefined,
    showApiKeySetup: (typeof showApiKeySetup === 'function') ? showApiKeySetup : undefined,
    showTinyMceApiKeySetup: (typeof showTinyMceApiKeySetup === 'function') ? showTinyMceApiKeySetup : undefined,
    resetForm: (typeof resetForm === 'function') ? resetForm : undefined,
    togglePreview: (typeof togglePreview === 'function') ? togglePreview : undefined,
  };
}

export { testImageUploadHandler, initializeBlogEditor, runTinyMCEDiagnostics, getActionMap };

// mark module as loaded
// TinyMCE Editor module loaded