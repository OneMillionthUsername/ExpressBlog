import { getUrlParameter, escapeHtml } from './utils.js';
import validationService from '../../../services/validationService.js';


async function addComment(postId, username, commentText) {
    // Input-Validierung (client-seitig)
    if (!validationService.validateId(postId)) {
        showCommentFeedback('Ungültige Post-ID.', 'error');
        return false;
    }
    if(!validationService.validateString(username, { min: 0, max: 50 })) {
        showCommentFeedback('Ungültiger Benutzername.', 'error');
        return false;
    }
    if (!commentText || commentText.trim().length === 0) {
        showCommentFeedback('Bitte gib einen Kommentar ein.', 'error');
        return false;
    }
    if (commentText.trim().length > 1000) {
        showCommentFeedback('Kommentar ist zu lang (maximal 1000 Zeichen).', 'error');
        return false;
    }
    try {      
        const response = await fetch(`/comments/${postId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username && username.trim() !== '' ? escapeHtml(username.trim()) : '',
                text: escapeHtml(commentText.trim())
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert('Fehler beim Speichern: ' + (result.error || 'Unbekannter Fehler'));
            return false;
        }
        console.log('Kommentar erfolgreich hinzugefügt:', result.newComment);
        
        // Kommentare neu laden und anzeigen
        await displayComments(postId);

        // Formular zurücksetzen
        resetCommentForm();
        
        // Erfolgs-Feedback
        showCommentFeedback('Kommentar erfolgreich hinzugefügt! 🎉', 'success');
        
        return true;
    } catch (error) {
        console.error('Fehler beim Hinzufügen des Kommentars:', error);
        showCommentFeedback('Netzwerkfehler beim Speichern des Kommentars. Bitte versuche es später erneut.', 'error');
        return false;
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
        const response = await fetch(`/comments/${postId}`);
        const comments = await response.json();

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
                        `<button onclick="deleteComment('${postId}', '${comment.id}')" 
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
        //console.error('Fehler beim Anzeigen der Kommentare:', error);
        commentsContainer.innerHTML = `
            <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle"></i>
                Error loading comments. Please try again later.
            <button onclick="displayComments('${postId}')" class="btn btn-sm btn-outline-danger ml-2">
                <i class="fas fa-redo"></i> Try again
            </button>
            </div>
        `;
        updateCommentCount(0);
    }
}
// Kommentar löschen (nur für Admins mit JWT)
async function deleteComment(postId, commentId) {
    // Prüfe Admin-Status
    if (typeof isAdminLoggedIn === 'undefined' || !isAdminLoggedIn) {
        showCommentFeedback('Nur Administratoren können Kommentare löschen.', 'error');
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
                'Content-Type': 'application/json'
            }
        });
        const result = await response.json();
        // Bei 401/403 - Session abgelaufen
        if (response.status === 401 || response.status === 403) {
            showCommentFeedback('Session abgelaufen. Bitte melden Sie sich erneut an.', 'error');
            // Optional: Admin-Logout aufrufen falls verfügbar
            if (typeof adminLogout === 'function') {
                await adminLogout();
            }
            return false;
        }
        if (!response.ok) {
            showCommentFeedback('Fehler beim Löschen: ' + (result.error || 'Unbekannter Fehler'), 'error');
            return false;
        }
        // Kommentare neu laden und anzeigen
        await displayComments(postId);
        // Erfolgs-Feedback
        showCommentFeedback('Kommentar erfolgreich gelöscht.', 'info');
        return true;
    } catch (error) {
        console.error('Fehler beim Löschen des Kommentars:', error);
        showCommentFeedback('Netzwerkfehler beim Löschen des Kommentars.', 'error');
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
        showCommentFeedback('Fehler: Post-ID nicht gefunden.', 'error');
        return;
    }
    if (!validateId(postId)) {
        showCommentFeedback('Ungültige Post-ID!', 'error');
        return;
    }
    const username = escapeHtml(document.getElementById('comment-username').value.trim());
    const commentText = escapeHtml(document.getElementById('comment-text').value.trim());
    const commentData = { username: username, text: commentText };
    // Submit-Button deaktivieren während des Sendens
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gesendet...';
    
    try {
        const success = await fetch(`/comments/${postId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commentData)
        });
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
// Feedback-Nachrichten anzeigen
function showCommentFeedback(message, type = 'info') {
    const feedbackContainer = document.getElementById('comment-feedback');
    if (!feedbackContainer) {
        // Falls kein Container vorhanden ist, erstelle einen
        const container = document.createElement('div');
        container.id = 'comment-feedback';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }
    
    const alertClass = type === 'success' ? 'alert-success' : 
                      type === 'error' ? 'alert-danger' : 'alert-info';
    
    const feedback = document.createElement('div');
    feedback.className = `alert ${alertClass} alert-dismissible fade show`;
    feedback.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert">
            <span>&times;</span>
        </button>
    `;
    feedback.style.animation = 'slideInRight 0.3s ease-out';
    
    const container = document.getElementById('comment-feedback');
    container.appendChild(feedback);
    
    // Auto-remove nach 4 Sekunden
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }
    }, 4000);
}
// mark module as loaded
if (window.moduleLoader) window.moduleLoader.markLoaded('comments');