import { showFeedback } from './feedback.js';
import { isValidIdSchema, isValidCommentSchema, isValidUsernameSchema} from '../../../services/validationService.js';

async function loadComments(postId) {
  if (!postId || !isValidIdSchema(postId)) {
    console.warn('Ungültige Post-ID, Kommentarsystem wird nicht geladen.');
    return;
  }
  try {
    const response = await fetch(`/comments/${postId}`);
    if (!response.ok) {
      if (response.status === 404) {
        // Keine Kommentare gefunden, leere Liste zurückgeben
        return [];
      }
    } else {
      showFeedback('Fehler beim Laden der Kommentare. Bitte versuche es später erneut.', 'error');
      return [];
    }
    const comments = await response.json();
    if (!Array.isArray(comments)) {
      showFeedback('Unerwartetes Format der Kommentare.', 'error');
      return [];
    }
    return comments.map(comment => ({
      ...comment,
      createdAt: formatCommentTime(comment.createdAt),
    }));
  } catch (error) {
    console.error('Fehler beim Laden der Kommentare:', error);
    showFeedback('Fehler beim Laden der Kommentare:', 'error');
    return [];
  }
}
// Delegated handlers for comment actions (data-action attributes)
let _commentsDelegationInitialized = false;
export function initializeCommentsDelegation() {
  if (_commentsDelegationInitialized) return;
  _commentsDelegationInitialized = true;
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;
    if (action === 'delete-comment') {
      e.preventDefault();
      const postId = btn.dataset.postId;
      const commentId = btn.dataset.commentId;
      if (postId && commentId) await deleteComment(postId, commentId);
      return;
    }
    if (action === 'retry-display-comments') {
      e.preventDefault();
      const postId = btn.dataset.postId;
      if (postId) await displayComments(postId);
      return;
    }
  });
}
async function createComment(postId, username, commentText) {
  // Input-Validierung (client-seitig)
  if (!isValidIdSchema(postId)) {
    showFeedback('Ungültige Post-ID.', 'error');
    return false;
  }

  if (!isValidUsernameSchema(username)) {
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showFeedback('Name enthält ungültige Zeichen.', 'error');
    } else if (username.trim().length > 50) {
      showFeedback('Name zu lang (maximal 50 Zeichen).', 'error');
    } else {
      // showFeedback('Name darf nicht leer sein.', 'error');
    }
    return false;
  }
  if (!isValidCommentSchema(commentText)) {
    if (commentText.trim().length < 1) {
      showFeedback('Kommentar darf nicht leer sein.', 'error');
    } else if (commentText.trim().length > 1000) {
      showFeedback('Kommentar ist zu lang (maximal 1000 Zeichen).', 'error');
    } else {
      showFeedback('Kommentar muss mindestens ein sichtbares Zeichen enthalten.', 'error');
    }
    return false;
  }
  try {
    const response = await fetch(`/comments/${postId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username && username.trim() !== '' ? escapeHtml(username.trim()) : '',
        text: escapeHtml(commentText.trim()),
      }),
    });
    const result = await response.json();      
    if (!response.ok) {
      showFeedback('Fehler beim Speichern: ' + (result.error || 'Unbekannter Fehler'), 'error');
      return false;
    }
    // Kommentare neu laden und anzeigen
    await displayComments(postId);
    // Formular zurücksetzen
    resetCommentForm();        
    // Erfolgs-Feedback
    showFeedback('Kommentar erfolgreich hinzugefügt! 🎉', 'success');
    return true;
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Kommentars:', error);
    showFeedback('Netzwerkfehler beim Speichern des Kommentars. Bitte versuche es später erneut.', 'error');
    return false;
  }
}
async function displayComments(postId) {
  const commentsContainer = document.getElementById('comments-list');
  if (!commentsContainer) return;
  // show Loading-Spinner
  commentsContainer.innerHTML = `
        <div class="text-center">
            <div class="spinner-border" role="status">
                <span class="sr-only">Lade Kommentare...</span>
            </div>
            <p class="mt-2 text-muted">Lade Kommentare...</p>
        </div>
    `;
  try {
    const comments = await loadComments(postId);
    if (comments.length === 0) {
      commentsContainer.innerHTML = `
                <div class="no-comments">
                    <p class="text-muted text-center">
                        <em>💭 Noch keine Kommentare vorhanden. Sei der erste, der kommentiert!</em>
                    </p>
                </div>
            `;
      updateCommentCount(0);
      return;
    }
    // Sort comments by date (newest first)
    comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const commentsHtml = comments.map(comment => `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <span class="comment-username">
                        <i class="fas fa-user-circle"></i> ${comment.username}
                    </span>
                    <span class="comment-time">${formatCommentTime(comment.created_at)}</span>
          ${(typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) ? 
  `<button data-action="delete-comment" data-post-id="${postId}" data-comment-id="${comment.id}"
                class="btn btn-sm btn-outline-danger comment-delete-btn" 
                title="Kommentar löschen">
              <i class="fas fa-trash"></i>
            </button>` : ''
}
                </div>
                <div class="comment-text">${comment.text}</div>
            </div>
        `).join('');
    commentsContainer.innerHTML = commentsHtml;
    // actualise commentscounter
    updateCommentCount(comments.length);
  } catch (error) {
    console.error('Fehler beim Anzeigen der Kommentare:', error);
    commentsContainer.innerHTML = `
            <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle"></i>
                Error loading comments. Please try again later.
      <button data-action="retry-display-comments" data-post-id="${postId}" class="btn btn-sm btn-outline-danger ml-2">
        <i class="fas fa-redo"></i> Try again
      </button>
            </div>
        `;
    updateCommentCount(0);
  }
}
// Kommentar löschen (Admin)
async function deleteComment(postId, commentId) {
  // Prüfe Admin-Status
  if (typeof isAdminLoggedIn === 'undefined' || !isAdminLoggedIn) {
    showFeedback('Nur Administratoren können Kommentare löschen.', 'error');
    return false;
  }
  if(!isValidIdSchema(postId) || !isValidIdSchema(commentId)) {
    showFeedback('Ungültige ID.', 'error');
    return false;
  }
  if (!confirm('Möchten Sie diesen Kommentar wirklich löschen?')) {
    return false;
  }
  try {
    const response = await fetch(`/comments/${postId}/${commentId}`, {
      method: 'DELETE',
      credentials: 'include', // HTTP-only Cookies verwenden
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    // Bei 401/403 - Session abgelaufen
    if (response.status === 401 || response.status === 403) {
      showFeedback('Session abgelaufen. Bitte melden Sie sich erneut an.', 'error');
      // Optional: Admin-Logout aufrufen falls verfügbar
      if (typeof adminLogout === 'function') {
        await adminLogout();
      }
      return false;
    }
    if (!response.ok) {
      showFeedback('Fehler beim Löschen: ' + (result.error || 'Unbekannter Fehler'), 'error');
      return false;
    }
    // Kommentare neu laden und anzeigen
    await displayComments(postId);
    // Erfolgs-Feedback
    showFeedback('Kommentar erfolgreich gelöscht.', 'info');
    return true;
  } catch (error) {
    console.error('Fehler beim Löschen des Kommentars:', error);
    showFeedback('Netzwerkfehler beim Löschen des Kommentars.', 'error');
    return false;
  }
}
// Kommentar-Formular zurücksetzen
function resetCommentForm() {
  const form = document.getElementById('comment-form');
  if (form) {
    form.reset();
  }
  else {
    console.error('Kommentar-Formular not found.');
  }
  // Character Counter zurücksetzen
  const charCounter = document.getElementById('char-counter');
  if (charCounter) {
    charCounter.textContent = '0/1000';
    charCounter.className = 'char-counter';
  }
  else {
    console.error('Character Counter not found.');
  }
}
function updateCharCounter() {
  const textarea = document.getElementById('comment-text');
  const charCounter = document.getElementById('char-counter');
    
  if (textarea && charCounter) {
    const length = textarea.value.length;
    charCounter.textContent = `${length}/1000`;
        
    // Farbe basierend auf Länge ändern
    if (length > 900) {
      charCounter.className = 'char-counter text-danger';
    } else if (length > 700) {
      charCounter.className = 'char-counter text-warning';
    } else {
      charCounter.className = 'char-counter text-muted';
    }
  }
}
async function handleCommentSubmit(event) {
  event.preventDefault();
  const postId = escapeHtml(getUrlParameter('post'));
  if (!postId) {
    showFeedback('Fehler: Post-ID nicht gefunden.', 'error');
    return;
  }
  if (!isValidIdSchema(postId)) {
    showFeedback('Ungültige Post-ID!', 'error');
    return;
  }
  const username = escapeHtml(document.getElementById('comment-username').value.trim());
  const commentText = escapeHtml(document.getElementById('comment-text').value.trim());
  if (!isValidUsernameSchema(username)) {
    showFeedback('Ungültiger Benutzername!', 'error');
    return;
  }
  if (!isValidCommentSchema(commentText)) {
    showFeedback('Ungültiger Kommentartext!', 'error');
    return;
  }
  // Submit-Button deaktivieren während des Sendens
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gesendet...';
    
  try {
    const success = await createComment(postId, username, commentText);
    if (success.ok) {
      // Username für nächstes Mal speichern
      saveUsername();
    }
  } finally {
    // Submit-Button wieder aktivieren
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}
function updateCommentCount(count) {
  const commentCount = document.getElementById('comment-count');
  if (commentCount) {
    commentCount.textContent = count;
  }
    
  const commentTitle = document.getElementById('comments-title');
  if (commentTitle) {
    commentTitle.innerHTML = `
            💬 Kommentare <span class="badge badge-secondary">${count}</span>
        `;
  }
}
// Kommentarsystem initialisieren
async function initializeCommentsSystem() {    
  // Post-Id aus URL extrahieren
  const postId = getUrlParameter('post');
  if (!postId) {
    console.warn('Keine Post-ID gefunden, Kommentarsystem wird nicht geladen.');
    return;
  }
  if(!isValidIdSchema(postId)) {
    console.warn('Ungültige Post-ID, Kommentarsystem wird nicht geladen.');
    return;
  }
  // Kommentare laden und anzeigen
  await displayComments(postId);
  // Event Listener für Formular
  const commentForm = document.getElementById('comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', handleCommentSubmit);
  }
  // Event Listener für Character Counter
  const commentTextarea = document.getElementById('comment-text');
  if (commentTextarea) {
    commentTextarea.addEventListener('input', updateCharCounter);
    commentTextarea.addEventListener('keyup', updateCharCounter);
  }
}
// Format relative time
function formatCommentTime(commentCreatedAt) {
  const now = new Date();
  const commentTime = new Date(commentCreatedAt);
  const diffMs = now - commentTime;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
  if (diffMinutes < 1) {
    return 'vor wenigen Sekunden';
  } else if (diffMinutes < 60) {
    return `vor ${diffMinutes} Minute${diffMinutes === 1 ? '' : 'n'}`;
  } else if (diffHours < 24) {
    return `vor ${diffHours} Stunde${diffHours === 1 ? '' : 'n'}`;
  } else if (diffDays < 30) {
    return `vor ${diffDays} Tag${diffDays === 1 ? '' : 'en'}`;
  } else {
    return commentTime.toLocaleDateString('de-DE');
  }
}
// Username aus localStorage laden/speichern (für Benutzerfreundlichkeit)
function loadSavedUsername() {
  const savedUsername = localStorage.getItem('blog_comment_username');
  const usernameInput = document.getElementById('comment-username');
    
  if (savedUsername && usernameInput) {
    usernameInput.value = savedUsername;
  }
}
function saveUsername() {
  const usernameInput = document.getElementById('comment-username');
  if (usernameInput && usernameInput.value.trim()) {
    localStorage.setItem('blog_comment_username', usernameInput.value.trim());
  }
}
document.addEventListener('DOMContentLoaded', function() {
  loadSavedUsername();
    
  const usernameInput = document.getElementById('comment-username');
  if (usernameInput) {
    usernameInput.addEventListener('blur', saveUsername);
  }
});

// mark module as loaded
// Comments module loaded
export { initializeCommentsSystem };