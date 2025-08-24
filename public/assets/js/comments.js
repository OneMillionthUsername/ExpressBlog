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
        const comments = await getCommentsByPostId(postId);
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
    const postId = getUrlParameter('post');
    if (!postId) {
        alert('Fehler: Post-ID nicht gefunden.');
        return;
    }
    const username = document.getElementById('comment-username').value.trim();
    const commentText = document.getElementById('comment-text').value.trim();
    const commentData = { username: username, text: commentText };
    // Submit-Button deaktivieren während des Sendens
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gesendet...';
    
    try {
        const success = await addComment(postId, commentData);
        if (success) {
            // Username für nächstes Mal speichern
            saveUsername();
        }
    } finally {
        // Submit-Button wieder aktivieren
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}