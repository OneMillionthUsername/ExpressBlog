// Templates Module
// Provides predefined blog post templates for different content types

import { showNotification } from '../../common.js';
import { updatePreview } from './preview.js';

/**
 * Insert a template into the editor
 * @param {string} templateName - Name of the template to insert
 */
export function insertTemplate(templateName) {
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
    `
  };

  if (!templates[templateName]) {
    console.error('Unknown template:', templateName);
    showNotification('Vorlage nicht gefunden', 'error');
    return;
  }

  const tinymceEditor = tinymce.get('content');
  if (tinymceEditor) {
    tinymceEditor.setContent(templates[templateName]);
  } else {
    // Fallback: In Textarea einfügen (HTML-Tags entfernen für bessere Lesbarkeit)
    const contentElement = document.getElementById('content');
    if (contentElement) {
      const plainText = templates[templateName]
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
  showNotification('Vorlage eingefügt ✅', 'success');
}
