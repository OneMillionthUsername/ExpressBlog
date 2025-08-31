// UI-Element Sichtbarkeits-Utilities (zentralisiert)
export function showElement(id) {
    const element = document.getElementById(id);
    if (element) {
        element.style.display = 'block';
        return true;
    }
    return false;
}

export function hideElement(id) {
    const element = document.getElementById(id);
    if (element) {
        element.style.display = 'none';
        return true;
    }
    return false;
}

export function toggleElementVisibility(id, show) {
    return show ? showElement(id) : hideElement(id);
}
// Seiten-Refresh-Utilities (zentralisiert)
export function refreshCurrentPage() {
    // Intelligenter Refresh basierend auf verfügbaren Funktionen
    if (typeof loadAndDisplayRecentPosts === 'function') {
        loadAndDisplayRecentPosts();
    } else if (typeof loadAndDisplayArchivePosts === 'function') {
        loadAndDisplayArchivePosts();
    } else if (typeof loadAndDisplayMostReadPosts === 'function') {
        loadAndDisplayMostReadPosts();
    } else if (typeof loadAndDisplayBlogPost === 'function') {
        loadAndDisplayBlogPost();
    } else {
        location.reload();
    }
}

// DOM-Utilities (erweitert)
export function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    // Attribute setzen
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key === 'cssText') {
            element.style.cssText = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // Content setzen
    if (content) {
        element.innerHTML = content;
    }
    
    return element;
}

export function elementExists(id) {
    return document.getElementById(id) !== null;
}

export function waitForElement(id, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.getElementById(id);
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver((mutations) => {
            const element = document.getElementById(id);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${id} not found within ${timeout}ms`));
        }, timeout);
    });
}
// Funktion zum Formatieren eines Datums
export function formatPostDate(dateString) {
    const date = new Date(dateString);
    const postDate = date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const postTime = date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });
    return { postDate, postTime };
}
// Funktion zur Berechnung der Lesezeit
export function calculateReadingTime(content) {
    const wordsPerMinute = 200;
    const words = content.split(' ').length;
    return Math.ceil(words / wordsPerMinute);
}

// Funktion zum Formatieren von HTML-Content
export function formatContent(content) {
    // Nach dem Upload oder nach dem Setzen des Inhalts:
    return content
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}
// Funktion zum Aktualisieren der UI mit Blogpost-Daten
export function updateBlogPostUI(post) {
    // TITLE: Titel setzen
    document.getElementById('title').textContent = '';
    document.title = `${post.title} - Sub specie aeternitatis`;
    
    // META: Datum und Meta-Informationen
    const { postDate, postTime } = formatPostDate(post.created_at);
    const readingTime = calculateReadingTime(post.content);
    
    // Prüfen ob ein Update-Datum existiert und neuer ist
    let metaHtml = `<div class="post-date">Erstellt am ${postDate} um ${postTime}`;
    
    if (post.updated_at && post.updated_at !== post.created_at) {
        const updatedDate = new Date(post.updated_at);
        const createdDate = new Date(post.created_at);
        
        if (updatedDate > createdDate) {
            const { postDate: updateDate, postTime: updateTime } = formatPostDate(post.updated_at);
            metaHtml += `<br><span class="post-updated">Zuletzt aktualisiert am ${updateDate} um ${updateTime}</span>`;
        }
    }
    
    metaHtml += `</div>`;
    
    document.getElementById('meta').innerHTML = `
        ${metaHtml}
        <div class="post-reading-time">Lesezeit: ca. ${readingTime} min.</div>
    `;
    
    // CONTENT: Inhalt formatieren und einfügen
    const formattedContent = formatContent(post.content);
    document.getElementById('content').innerHTML = `<p>${formattedContent}</p>`;
    
    // TAGS: Tags anzeigen
    if (post.tags && post.tags.length > 0) {
        const tagsHtml = post.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ');
        document.getElementById('tags').innerHTML = `
            <div class="tags-label">Tags:</div>
            <div class="tags-list">${tagsHtml}</div>
        `;
        document.getElementById('tags').style.display = 'block';
    }
    
    // Elemente sichtbar machen
    document.getElementById('loading').style.display = 'none';
    document.getElementById('post-article').style.display = 'block';
    const mainTitle = document.getElementById('main-title');
    if (mainTitle) {
        mainTitle.textContent = post.title;
    }
    else {
        console.warn('Main title element not found, using document title instead');
    }
    const description = document.getElementById('description');
    if (description) {
        description.textContent = post.description || '';
    }
    else {
        console.warn('Description element not found, skipping description update');
    }
}
// ===========================================
// BLOG POST FORM HANDLING
// ===========================================

// Blog Post Form Handler (wird nur ausgeführt wenn das Element existiert)
export function initializeBlogPostForm() {
    const form = document.getElementById('blogPostForm');
    if (!form) return; // Element existiert nicht auf dieser Seite
    
    
    // Event-Listener für das Formular - create blogpost
    form.addEventListener('submit', async function(event) {
        event.preventDefault(); // Verhindert das Standard-Formular-Senden
        
        // TinyMCE: Klasse zu allen Bildern hinzufügen
        if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
            const editor = tinymce.get('content');
            const imgs = editor.dom.select('img');
            imgs.forEach(img => {
                editor.dom.addClass(img, 'blogpost-content-img');
            });
        }
        
        const postId = getUrlParameter('post');
        const url = postId ? `/blogpost/update/${postId}` : '/blogpost';
        const method = postId ? 'PUT' : 'POST';

        const title = document.getElementById('title').value;
        let content = '';
        if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
            content = tinymce.get('content').getContent();
        } else {
            content = document.getElementById('content').value;
        }
        const tagsInput = document.getElementById('tags').value;

        // Tags in ein Array umwandeln (optional, falls Tags als Array erwartet werden)
        const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

        const postData = {
            title: title,
            content: content,
            tags: tags,
            author: 'admin'  // Backend erwartet das author Feld
        };

        try {
            
            const headers = {
                'Content-Type': 'application/json'
            };

            // API-Request senden
            const response = await fetch(url, {
                method: method,
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(postData)
            });

            // Erst prüfen, ob Response parsebar ist
            let result;
            try {
                result = await response.json();
            } catch (parseError) {
                console.error('Response ist kein gültiges JSON:', parseError);
                document.getElementById('responseMessage').textContent = 'Serverfehler: Ungültige Antwort';
                return;
            }

            // Erfolgreiche Antwort
            if (response.ok) {
                showNotification('Post erfolgreich gespeichert!', 'success');
                setTimeout(() => {
                    window.location.href = '/pages/list_posts.html';
                }, 1000);
                return;
            }

            // Fehlerbehandlung
            const errorMessage = result.error || result.message || 'Unbekannter Fehler';
            
            if (response.status === 401 || response.status === 403) {
                document.getElementById('responseMessage').textContent = 'Session abgelaufen. Bitte melden Sie sich erneut an.';
                if (typeof adminLogout === 'function') {
                    await adminLogout();
                }
                return;
            }
            
            // Erfolgreiche Antwort
            //document.getElementById('responseMessage').textContent = `Status: ${response.status} - ${result.message || result.error}`;

            if (response.ok) {
                setTimeout(() => {
                    window.location.href = 'list_posts.html'; // Weiterleitung zur Liste der Posts
                }, 1000); // 1 Sekunde warten
            } else {
                console.error('Error creating blogpost:', result);
            }

        } catch (error) {
            console.error('Network or unexpected error:', error);
            document.getElementById('responseMessage').textContent = `Fehler: ${error.message}`;
        }
    });
}
function createInputField(id, labelText, type = 'text', className = 'card-input') {
    const label = document.createElement('label');
    label.className = 'modal-label';
    label.textContent = labelText;
    label.setAttribute('for', id);

    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    input.className = className;

    return { label, input };
}
// Modal Handler for create cards
export function showCreateCardModal() {
    const modal = document.createElement('div');
    modal.id = 'card-create-modal';
    modal.classList = 'modal modal-block';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.textContent = 'Create card';

    // Formular erstellen
    const form = document.createElement('form');
    form.className = 'modal-body';

    // Eingabefelder erstellen
    const fields = [
        { id: 'card-input-title', label: 'Title' },
        { id: 'card-input-subtitle', label: 'Subtitle' },
        { id: 'card-input-inputImgUrl', label: 'Image URL' },
        { id: 'card-input-inputLink', label: 'Link' }
    ];

    fields.forEach(field => {
        const { label, input } = createInputField(field.id, field.label);
        form.appendChild(label);
        form.appendChild(input);
    });

    // Buttons erstellen
    const createBtn = document.createElement('button');
    createBtn.type = 'submit';
    createBtn.classList = 'btn btn-outline-success';
    createBtn.textContent = 'Create card';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.classList = 'btn btn-outline-secondary ml-2';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => modal.remove();

    // Erfolgsmeldung
    const successMsg = document.createElement('div');
    successMsg.id = 'card-success-message';
    successMsg.className = 'success-message';
    successMsg.style.display = 'none';
    successMsg.textContent = 'Card erfolgreich erstellt!';

    // Formular zusammenfügen
    form.appendChild(createBtn);
    form.appendChild(cancelBtn);
    form.appendChild(successMsg);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(form);
    modal.appendChild(modalContent);

    document.body.appendChild(modal);

    // Formular-Submit-Handler
    form.onsubmit = async function (e) {
        e.preventDefault();
        const cardData = fields.reduce((data, field) => {
            data[field.id.replace('card-input-', '')] = document.getElementById(field.id).value;
            return data;
        }, {});

        try {
            const response = await makeApiRequest('/cards', {
                method: 'POST',
                body: JSON.stringify(cardData)
            });
            if (response.success) {
                modal.remove();
                showNotification('Card erstellt!', 'success');
            } else {
                showNotification('Card konnte nicht erstellt werden', 'error');
            }
        } catch (error) {
            console.error('Fehler im Endpunkt /cards:', error);
            showNotification('Fehler im Endpunkt /cards: ' + error.message, 'error');
        }
    };
}

// Hilfsfunktionen für erweiterte Funktionalität
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;

    document.body.appendChild(notification);

    // Entferne die Benachrichtigung nach 3 Sekunden
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}