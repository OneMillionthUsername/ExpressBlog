// Import dependencies as ES6 modules
import { checkAdminStatusCached, showAdminLoginModal } from './admin.js';
import { loadAllBlogPosts } from './api.js';
// Logger not available in frontend - use console instead

// Export imported helper so other modules can import it from this module
export { loadAllBlogPosts };

// UI-Element Sichtbarkeits-Utilities (zentralisiert)
export function showElement(target) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return false;
  if (el.dataset._prevDisplay === undefined) {
    el.dataset._prevDisplay = getComputedStyle(el).display || '';
  }
  // restore previous display (empty string lets CSS decide)
  el.style.display = el.dataset._prevDisplay === 'none' ? '' : el.dataset._prevDisplay;
  el.classList.remove('d-none'); // harmless if Bootstrap present
  el.classList.add('d-block');
  el.setAttribute('aria-hidden', 'false');
  return true;
}

export function hideElement(target) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return false;
  if (el.dataset._prevDisplay === undefined) {
    el.dataset._prevDisplay = getComputedStyle(el).display || '';
  }
  el.style.display = 'none';
  el.classList.remove('d-block');
  el.classList.add('d-none');
  el.setAttribute('aria-hidden', 'true');
  return true;
}
export function toggleElementVisibility(id, show) {
  return show ? showElement(id) : hideElement(id);
}
// Seiten-Refresh-Utilities (zentralisiert)
export function refreshCurrentPage() {
  // Intelligenter Refresh basierend auf verfügbaren Funktionen
  if (typeof window.loadAndDisplayRecentPosts === 'function') {
    window.loadAndDisplayRecentPosts();
  } else if (typeof window.loadAndDisplayArchivePosts === 'function') {
    window.loadAndDisplayArchivePosts();
  } else if (typeof window.loadAndDisplayMostReadPosts === 'function') {
    window.loadAndDisplayMostReadPosts();
  } else if (typeof window.loadAndDisplayBlogPost === 'function') {
    window.loadAndDisplayBlogPost();
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
      subtree: true,
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
    day: 'numeric',
  });
  const postTime = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return { postDate, postTime };
}
// Funktion zur Berechnung der Lesezeit
export function calculateReadingTime(content) {
  const wordsPerMinute = 200;
  const words = content.split(' ').filter(Boolean).length;
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
  // META: Datum und Meta-Informationen
  const { postDate, postTime } = formatPostDate(post.created_at);
  const readingTime = calculateReadingTime(post.content);
    
  // display dates
  let metaHtml = `<div class="post-date">Erstellt am ${postDate} um ${postTime}`;
  if (post.updated_at && post.updated_at !== post.created_at) {
    const { postDate: updateDate, postTime: updateTime } = formatPostDate(post.updated_at);
    metaHtml += `<br><span class="post-updated">Zuletzt aktualisiert am ${updateDate} um ${updateTime}</span>`;
  }
  metaHtml += '</div>';
    
  // display readingtime
  const meta = document.getElementById('meta');
  if(meta) meta.innerHTML = `
        ${metaHtml}
        <div class="post-reading-time">Lesezeit: ca. ${readingTime} min.</div>
    `;
  else {
    console.warn('Meta element not found, skipping meta update');
  }

  // CONTENT: Inhalt formatieren und einfügen
  const formattedContent = formatContent(post.content);
  const content = document.getElementById('content');
  if (content) content.innerHTML = `<p>${formattedContent}</p>`;
  else {
    console.warn('Content element not found, skipping content update');
  }
  // TAGS: Tags anzeigen
  if (post.tags && post.tags.length > 0) {
    const tagsHtml = post.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ');
    const tags = document.getElementById('tags');
    if (tags) {
      tags.innerHTML = `
                <div class="tags-label">Tags:</div>
                <div class="tags-list">${tagsHtml}</div>
            `;
      tags.style.display = 'block';
    }
    else {
      tags.style.display = 'none';
    }
  }
  // Elemente sichtbar machen
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  const postArticle = document.getElementById('post-article');
  if (postArticle) postArticle.style.display = 'block';
  const mainTitle = document.getElementById('main-title');
  if (mainTitle) mainTitle.textContent = post.title || 'Untitled';
  const description = document.getElementById('description');
  if (description) description.textContent = post.description || '';
}
function handleFormError(message, error = null) {
  document.getElementById('responseMessage').textContent = message;
  showNotification(message, 'error');
  if (error) console.error(message, error);
}
// ===========================================
// BLOG POST FORM HANDLING
// ===========================================

// Blog Post Form Handler
export function initializeBlogPostForm() {
  const form = document.getElementById('blogPostForm');
  if (!form) return;
  form.addEventListener('submit', async function(event) {
    event.preventDefault();

    // TinyMCE: Klasse zu allen Bildern hinzufügen
    if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
      const editor = tinymce.get('content');
      const imgs = editor.dom.select('img');
      imgs.forEach(img => {
        editor.dom.addClass(img, 'blogpost-content-img');
      });
    }

    const postId = window.getPostIdFromPath();
    const url = postId ? `/blogpost/update/${postId}` : '/create';
    const method = postId ? 'PUT' : 'POST';

    const title = document.getElementById('title').value;
    if (!title || title.trim().length === 0) {
      window.showNotification('Bitte geben Sie einen Titel ein.', 'error');
      return;
    }

    let content = document.getElementById('content').value;
    if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
      content = tinymce.get('content').getContent();
    }
    if(!content || content.trim().length === 0) {
      window.showNotification('Bitte geben Sie einen Inhalt ein.', 'error');
      return;
    }
    const tagsInput = document.getElementById('tags').value;
    const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    const postData = {
      title,
      content,
      tags,
      author: 'admin',
    };

    try {
      const headers = { 'Content-Type': 'application/json' };
      const response = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(postData),
      });

      let result;
      try {
        result = await response.json();
      } catch (err) {
        handleFormError('Serverfehler: Antwort konnte nicht gelesen werden.', err);
        return;
      }

      if (!response.ok) {
        const errorMessage = result?.error || result?.message || 'Unbekannter Fehler';
        handleFormError(`Fehler beim Erstellen des Blogposts: ${errorMessage}`);
        if (response.status === 401 || response.status === 403) {
          handleFormError('Session abgelaufen. Bitte melden Sie sich erneut an.');
          if (typeof adminLogout === 'function') await adminLogout();
        }
        return;
      }

      window.showNotification('Post erfolgreich gespeichert!', 'success');
      setTimeout(() => {
        window.location.href = '/';  // Navigate to index page instead of API route
      }, 1000);

    } catch (error) {
      handleFormError(`Fehler: ${error.message}`, error);
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
    { id: 'card-input-inputLink', label: 'Link' },
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
        body: JSON.stringify(cardData),
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
// Funktion zum Anzeigen der Karten
export async function renderAndDisplayCards(cards) {
  const grid = document.getElementById('discoveries-grid');
  if (!grid) {
    console.warn('Grid-Element nicht gefunden');
    return;
  }
  grid.innerHTML = '';
  if (!Array.isArray(cards) || cards.length === 0) {
    grid.innerHTML = '<div class="no-cards">Noch keine Fundstücke vorhanden.</div>';
    return;
  }
    
  let html = '';
  cards.forEach(card => {
    // Prüfe, ob die Karte neu ist (z.B. innerhalb der letzten 7 Tage erstellt)
    const isNew = card.created_at ? (() => {
      const cardDate = new Date(card.created_at);
      const daysDiff = Math.floor((new Date() - cardDate) / (1000 * 60 * 60 * 24));
      return daysDiff <= 7;
    })() : false;
        
    // Zusätzliche neue Card Eigenschaften
    const isVeryNew = card.created_at ? (() => {
      const cardDate = new Date(card.created_at);
      const daysDiff = Math.floor((new Date() - cardDate) / (1000 * 60 * 60 * 24));
      return daysDiff < 1;
    })() : false;
        
    html += `
        <div class="col-md-4 mb-4">
            <div class="discovery-card ${isNew ? 'discovery-card-new' : ''} ${isVeryNew ? 'discovery-card-very-new' : ''}">
                ${isVeryNew ? '<div class="discovery-new-badge very-new">Gerade veröffentlicht</div>' : ''}
                ${isNew && !isVeryNew ? '<div class="discovery-new-badge">Neu</div>' : ''}
  <img src="${card.img_link}" 
      alt="${card.title}" 
      class="discovery-img"
      data-link="${card.link}"
      title="Zum Link öffnen">
                <div class="discovery-card-body">
                    <h5 class="discovery-title">${card.title}</h5>
                    <h6 class="discovery-subtitle">${card.subtitle}</h6>
                    <a href="${card.link}" target="_blank" class="discovery-link">
                        <i class="fas fa-external-link-alt"></i> Zur Quelle
                    </a>
                </div>
            </div>
        </div>
        `;
  });
  grid.innerHTML = html;

  // Attach event listeners to images with data-link to avoid inline handlers (CSP-friendly)
  const discoveryImgs = grid.querySelectorAll('.discovery-img[data-link]');
  discoveryImgs.forEach(img => {
    // make clickable and keyboard-accessible
    img.style.cursor = 'pointer';
    img.setAttribute('role', 'link');
    img.setAttribute('tabindex', '0');
    img.addEventListener('click', () => {
      const url = img.dataset.link;
      if (url) window.open(url, '_blank');
    });
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const url = img.dataset.link;
        if (url) window.open(url, '_blank');
      }
    });
  });
}
// Hauptfunktion zum Laden und Anzeigen eines Blogposts (für read_post.html)
export async function loadAndDisplayBlogPost() {
  // URL-Parameter auslesen
  const urlParams = new URLSearchParams(window.location.search); //  unsicher ob ich das brauche
  const postId = getPostIdFromPath() || urlParams.get('post');
    
  // Prüfen, ob ein Post-Parameter in der URL vorhanden ist
  if (!postId) {
    document.getElementById('loading').innerHTML = '<p class="error-message">Kein Blogpost ausgewählt.</p>';
    return;
  }

  try {
    // Blogpost laden
    const response = await fetch(`/blogpost/by-id/${postId}`);
    if (!response.ok) {
      throw new Error('Blogpost konnte nicht geladen werden');
    }
    const post = await response.json();
    // UI aktualisieren
    updateBlogPostUI(post);
        
    // Set canonical URL for the specific blog post
    // unklar ob ich das auch brauche
    //setCanonicalUrl();
        
  } catch (error) {
    console.error('Fehler beim Laden des Blogposts:', error);
    document.getElementById('loading').innerHTML = `<p class="error-message">Error loading blogpost. ${error.message}</p>`;
  }
}
// Funktion zum Laden und Anzeigen von Archiv-Posts (älter als 3 Monate)
export async function loadAndDisplayArchivePosts() {
  try {
    const response = await fetch('/blogposts');
    const posts = await response.json();
        
    //Error handling
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (!Array.isArray(posts)) {
      console.error('Backend returned no array for archive posts:', posts);
      document.getElementById('archivePosts').innerHTML = '<p>Fehler beim Laden der Archiv-Posts.</p>';
      return;
    }
    if (posts.length === 0) {
      document.getElementById('archivePosts').innerHTML = '<p>Keine Archiv-Posts gefunden.</p>';
      return;
    }

    const listContainer = document.getElementById('archivePosts');
        
    // Filtere Posts älter als 3 Monate
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
    const archivePosts = posts.filter(post => {
      const postDate = new Date(post.created_at);
      return postDate < threeMonthsAgo;
    });
        
    if (archivePosts.length === 0) {
      listContainer.innerHTML = `
                <div class="no-posts">
                    <div class="no-posts-icon">Archiv</div>
                    <h3>Kein Archiv verfügbar</h3>
                    <p>Es gibt keine Blog-Posts, die älter als 3 Monate sind.</p>
                </div>
            `;
      return;
    }

    let html = '<div class="archive-posts-list">';
    archivePosts.forEach(post => {
      const postDate = new Date(post.created_at).toLocaleDateString('de-DE');
      html += `
                <div class="archive-post-item">
                    <h3><a class="post-link-style" href="/blogpost/${post.id}0">${post.title}</a></h3>
                    <p class="post-meta">${postDate}</p>
                </div>
            `;
    });
    html += '</div>';
        
    listContainer.innerHTML = html;
        
    // Admin-Delete-Buttons hinzufügen (falls verfügbar)
    if (typeof addDeleteButtonsToPosts === 'function') {
      setTimeout(addDeleteButtonsToPosts, 50);
    }
        
  } catch (error) {
    console.error('Fehler beim Laden des Archivs:', error);
    document.getElementById('archivePosts').innerHTML = '<p>Fehler beim Laden des Archivs.</p>';
  }
}
// Funktion zum Laden und Anzeigen von aktuellen Posts (für list_posts.html)
export async function loadAndDisplayRecentPosts() {
  try {
    const posts = await loadAllBlogPosts();
    
    if (!Array.isArray(posts)) {
      throw new Error('Response is not an array');
    }
    if (posts.length === 0) {
      const isAdmin = typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn;
      document.getElementById('blogPostsList').innerHTML = `
                <div class="no-posts">
                    <div class="no-posts-icon">Posts</div>
                    <h3>Keine Posts verfügbar</h3>
                    <p>Es gibt noch keine Blog-Posts.</p>
                    ${isAdmin ? '<a href="create.html" class="btn btn-outline-primary mt-3">Ersten Post erstellen</a>' : ''}
                </div>
            `;
      return;
    }
    // Container für die Blogposts      
    const listContainer = document.getElementById('blogPostsList');
    if (!listContainer) {
      console.error('Blog posts list container not found');
      return;
    }
    listContainer.innerHTML = ''; // Leeren vor dem Rendern
    let html = '';
    // Filtere Posts der letzten 3 Monate
    const threeMonthsAgo = new Date();
    //debug
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
    const recentPosts = posts.filter(post => {
      const postDate = new Date(post.created_at);
      return postDate >= threeMonthsAgo;
    });
        

    if (recentPosts.length === 0) {
      listContainer.innerHTML = `
                <div class="no-posts">
                    <div class="no-posts-icon">Posts</div>
                    <h3>Keine aktuellen Posts</h3>
                    <p>Es wurden in den letzten 3 Monaten keine Blog-Posts veröffentlicht.</p>
                    <a href="create.html" class="btn btn-outline-primary mt-3">Ersten Post erstellen</a>
                </div>
            `;
      return;
    }
        
    recentPosts.forEach((post, index) => {
      const postDate = new Date(post.created_at);
      const formattedDate = postDate.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
            
      // Zeitabstand berechnen
      const now = new Date();
      const postDateOnly = new Date(postDate.getFullYear(), postDate.getMonth(), postDate.getDate());
      const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysDiff = Math.floor((nowDateOnly - postDateOnly) / (1000 * 60 * 60 * 24));
      let timeAgo = '';
            
      if (daysDiff < 1) {
        timeAgo = 'Heute';
      } else if (daysDiff === 1) {
        timeAgo = 'Gestern';
      } else if (daysDiff < 7) {
        timeAgo = `vor ${daysDiff} Tag${daysDiff !== 1 ? 'en' : ''}`;
      } else if (daysDiff < 30) {
        const weeksDiff = Math.floor(daysDiff / 7);
        timeAgo = `vor ${weeksDiff} Woche${weeksDiff !== 1 ? 'n' : ''}`;
      } else {
        const monthsDiff = Math.floor(daysDiff / 30);
        timeAgo = `vor ${monthsDiff} Monat${monthsDiff !== 1 ? 'en' : ''}`;
      }
      //TODO: Vor-x-Jahren als Parameter hinzufügen
            
      const isNew = daysDiff <= 7;
            
      // Zusätzliche neue Post Eigenschaften
      const isVeryNew = daysDiff < 1; // "Gerade veröffentlicht" nur für heute (weniger als 1 Tag)
      const isHot = daysDiff <= 3; // Hot Posts der letzten 3 Tage
            
      // HTML für den Post
      html += `
                <article class="post-card ${isNew ? 'post-card-new' : ''} ${isVeryNew ? 'post-card-very-new' : ''} ${isHot ? 'post-card-hot' : ''}">
                        <h3 class="post-card-title">
                            <a class="post-link-style" href="/blogpost/${post.id}">${post.title}</a>
                        </h3>
                        <div class="post-card-meta">
                            <span class="post-date">${formattedDate}</span>
                            <span class="post-time-ago ${daysDiff < 1 ? 'today-highlight' : ''}">${timeAgo}</span>
                            ${isVeryNew ? '<span class="new-badge very-new inline">Gerade veröffentlicht</span>' : ''}
                            ${isHot && !isVeryNew ? '<span class="hot-indicator">Trending</span>' : ''}
                            ${isNew && !isHot && !isVeryNew ? '<span class="new-indicator">Neu</span>' : ''}
                        </div>
                    
                    <div class="post-card-content">
                        ${post.tags.length > 0 ? `
                            <div class="post-card-tags">
                                Tags: ${post.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                </article>
            `;
    });
        
    html += '</div>';
    listContainer.innerHTML = html;
        
    // Check for very new posts and show notification modal
    const veryNewPosts = recentPosts.filter(post => {
      const postDate = new Date(post.created_at);
      const daysDiff = Math.floor((new Date() - postDate) / (1000 * 60 * 60 * 24));
      return daysDiff < 1;
    });
        
    if (veryNewPosts.length > 0) {
      showNewPostNotification(veryNewPosts);
    }
        
    // Admin-Delete-Buttons hinzufügen (falls verfügbar)
    if (typeof addDeleteButtonsToPosts === 'function') {
      setTimeout(addDeleteButtonsToPosts, 50);
    }
        
  } catch (error) {
    console.error('Fehler beim Laden der Blogposts:', error);
    document.getElementById('blogPostsList').innerHTML = `
            <div class="error-message">
                <div class="error-icon">Error</div>
                <h3>Laden fehlgeschlagen</h3>
                <p>Die Blog-Posts konnten nicht geladen werden.</p>
                <button onclick="loadAndDisplayRecentPosts()" class="btn btn-outline-primary mt-3">Erneut versuchen</button>
            </div>
        `;
  }
}

// Funktion zum Laden und Anzeigen aller Posts (für /blogpost/all)
export async function loadAndDisplayAllPosts() {
  console.log('loadAndDisplayAllPosts: Starting...');
  
  try {
    console.log('loadAndDisplayAllPosts: Calling loadAllBlogPosts()...');
    const posts = await loadAllBlogPosts();
    console.log('loadAndDisplayAllPosts: Loaded posts:', posts, 'Length:', posts?.length);
    
    if (!Array.isArray(posts)) {
      console.error('loadAndDisplayAllPosts: Response is not an array:', typeof posts);
      throw new Error('Response is not an array');
    }
    
    console.log('loadAndDisplayAllPosts: Posts array validation passed');
    
    if (posts.length === 0) {
      console.log('loadAndDisplayAllPosts: No posts found, showing empty state');
      const isAdmin = typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn;
      document.getElementById('blogPostsList').innerHTML = `
                <div class="no-posts">
                    <div class="no-posts-icon">Posts</div>
                    <h3>Keine Posts verfügbar</h3>
                    <p>Es gibt noch keine Blog-Posts.</p>
                    ${isAdmin ? '<a href="/blogpost/create" class="btn btn-outline-primary mt-3">Ersten Post erstellen</a>' : ''}
                </div>
            `;
      return;
    }
    
    // Container für die Blogposts      
    console.log('loadAndDisplayAllPosts: Looking for blogPostsList container...');
    const listContainer = document.getElementById('blogPostsList');
    if (!listContainer) {
      console.error('loadAndDisplayAllPosts: Blog posts list container not found');
      return;
    }
    console.log('loadAndDisplayAllPosts: Container found, clearing and rendering...');
    
    listContainer.innerHTML = ''; // Leeren vor dem Rendern
    let html = '';
    
    console.log('loadAndDisplayAllPosts: Starting to render posts...');
    // Alle Posts anzeigen (keine 3-Monats-Filterung)
    posts.forEach((post, index) => {
      console.log(`loadAndDisplayAllPosts: Rendering post ${index + 1}/${posts.length}:`, post.title);
      const postDate = formatPostDate(post.created_at);
      const excerpt = post.content ? post.content.substring(0, 150) + '...' : 'Kein Inhalt verfügbar';
      
      html += `
        <article class="blog-post-card">
          <div class="post-meta">
            <span class="post-date">${postDate}</span>
            <span class="post-author">von ${post.author || 'Unbekannt'}</span>
          </div>
          <h2 class="post-title">
            <a href="/blogpost/${post.slug}" class="post-link">${post.title}</a>
          </h2>
          <div class="post-excerpt">${excerpt}</div>
          <div class="post-footer">
            <span class="post-views">${post.views || 0} Aufrufe</span>
            ${post.tags && post.tags.length > 0 ? 
              `<div class="post-tags">
                ${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
              </div>` : ''}
          </div>
        </article>
      `;
    });
    
    console.log('loadAndDisplayAllPosts: Setting HTML content...');
    listContainer.innerHTML = html;
    console.log(`loadAndDisplayAllPosts: Successfully rendered ${posts.length} posts`);
    
    // Admin-Delete-Buttons hinzufügen (falls verfügbar)
    if (typeof addDeleteButtonsToPosts === 'function') {
      setTimeout(addDeleteButtonsToPosts, 50);
    }
        
  } catch (error) {
    console.error('loadAndDisplayAllPosts: Error occurred:', error);
    console.error('Fehler beim Laden aller Posts:', error);
    document.getElementById('blogPostsList').innerHTML = `
            <div class="error-state">
                <div class="error-icon">Error</div>
                <h3>Laden fehlgeschlagen</h3>
                <p>Die Blog-Posts konnten nicht geladen werden.</p>
                <button onclick="loadAndDisplayAllPosts()" class="btn btn-outline-primary mt-3">Erneut versuchen</button>
            </div>
        `;
  }
}

// Funktion zum Laden und Anzeigen der meistgelesenen Posts (für most_read.html)
export async function loadAndDisplayMostReadPosts() {
  try {
    const response = await fetch('/most-read');
    const posts = await response.json();
    //Error handling
    if (!response.ok) {
      console.error('Fehler beim Laden der meistgelesenen Posts:', posts);
      const listContainer = document.getElementById('mostReadPosts');
      listContainer.innerHTML = `
                <div class="error-message">
                    <div class="error-icon">Error</div>
                    <h3>Laden fehlgeschlagen</h3>
                    <p>Die Posts konnten nicht geladen werden.</p>
                    <button onclick="loadAndDisplayMostReadPosts()" class="btn btn-outline-primary mt-3">Erneut versuchen</button>
                </div>
            `;
      return;
    }
    const listContainer = document.getElementById('mostReadPosts');
    if (!listContainer) {
      console.error('Container for most read posts not found');
      return;
    }
    // Prüfen, ob posts ein Array ist
    if (!Array.isArray(posts)) {
      console.error('Backend returned no array for most-read posts:', posts);
      listContainer.innerHTML = `
                <div class="error-message">
                    <div class="error-icon">Error</div>
                    <h3>Laden fehlgeschlagen</h3>
                    <p>Die Statistiken konnten nicht geladen werden.</p>
                    <button onclick="loadAndDisplayMostReadPosts()" class="btn btn-outline-primary mt-3">Erneut versuchen</button>
                </div>
            `;
      return;
    }

    if (posts.length === 0) {
      listContainer.innerHTML = `
                <div class="no-posts">
                    <div class="no-posts-icon">Statistiken</div>
                    <h3>Keine Statistiken verfügbar</h3>
                    <p>Es gibt noch keine Blog-Post-Ansichten.</p>
                </div>
            `;
      return;
    }

    let html = '<div class="most-read-list">';
    posts.forEach((post, index) => {
      const rank = index + 1;
      const postDate = new Date(post.created_at).toLocaleDateString('de-DE');
      html += `
                <div class="most-read-item">
                    <span class="rank">#${rank}</span>
                    <div class="most-read-content">
                        <h3><a class="post-link-style" href="/blogpost/${post.id}">${post.title}</a></h3>
                        <p>${Number(post.views)} views | ${postDate}</p>
                    </div>
                </div>
            `;
    });
    html += '</div>';

    listContainer.innerHTML = html;

    // Admin-Delete-Buttons hinzufügen (falls verfügbar)
    if (typeof addDeleteButtonsToPosts === 'function') {
      setTimeout(addDeleteButtonsToPosts, 50);
    }

  } catch (error) {
    console.error('Fehler beim Laden der Posts:', error);
    document.getElementById('mostReadPosts').innerHTML = `
            <div class="error-message">
                <div class="error-icon">Error</div>
                <h3>Laden fehlgeschlagen</h3>
                <p>Die Posts konnten nicht geladen werden.</p>
                <button onclick="loadAndDisplayMostReadPosts()" class="btn btn-outline-primary mt-3">Erneut versuchen</button>
            </div>
        `;
  }
}
// Post bearbeiten (spezifisch für read_post.html)
// Edit Funktionen
export async function redirectEditPost(postId) {
  if(!isAdminLoggedIn) {
    alert(ADMIN_MESSAGES.login.required);
    return;
  }
  // Redirect to create.html with post data
  const createUrl = new URL('/pages/create.html', window.location.origin);
  createUrl.searchParams.set('post', postId);
  window.location.href = createUrl.toString();
}
// Post löschen und zur Post-Liste weiterleiten (spezifisch für read_post.html)
export async function deletePostAndRedirect(postId) {
  if(!isAdminLoggedIn) {
    alert(ADMIN_MESSAGES.login.required);
    return;
  }
  const deleted = await deletePost(postId);
  if (deleted) {
    // Nach dem Löschen zur Post-Liste weiterleiten
    window.location.href = 'list_posts.html';
  } else {
    console.error('Post konnte nicht gelöscht werden. Bitte versuchen Sie es später erneut.');
  }
}
export function reloadPageWithDelay(delay = 1000) {
  setTimeout(() => location.reload(), delay);
}
// Blog Utilities initialisieren
export async function initializeBlogUtilities() {
  if (document.getElementById('blogPostForm')) {
    initializeBlogPostForm();
  }
  // ...weitere Utilities...
  return;
}
// Utility-Funktion zum Abrufen von URL-Parametern
// function getUrlParameter(paramName) {
//     const urlParams = new URLSearchParams(window.location.search);
//     return urlParams.get(paramName);
// }
export function getPostIdFromPath() {
  const match = window.location.pathname.match(/\/blogpost\/(?:delete|update|by-id)\/(\d+)/);
  const postId = match ? match[1] : null;
  return postId;
}
export function getPostSlugFromPath() {
  const match = window.location.pathname.match(/\/blogpost\/([^\/]+)/);
  const slug = match ? match[1] : null;
  return slug;
}
// Prüft, ob ein Post-Parameter existiert, lädt ggf. den Post und füllt das Formular vor
export async function checkAndPrefillEditPostForm() {
  const postId = getPostIdFromPath();
  if (!postId) return;

  // Postdaten laden
  const response = await fetch(`/blogpost/${postId}`);
  if (!response.ok) return;
  const post = await response.json();

  if (!post || !post.id) {
    showNotification('Blogpost nicht gefunden', 'error');
    return;
  }
  // Prüfen ob TinyMCE geladen ist
  if (typeof tinymce === 'undefined' || !tinymce.get('content')) {
    console.warn('TinyMCE Editor not initialized yet, waiting for it to be ready...');
  }

  const mainTitle = document.getElementById('main-title');
  const description = document.getElementById('description');
  if (mainTitle) {
    mainTitle.textContent = 'Blogpost bearbeiten';
  }
  if (description) {
    hideElement('description');
  }

  // Prefill mit Retry, falls TinyMCE noch nicht bereit ist
  function prefillWhenReady(retries = 10) {
    const editor = tinymce.get('content');
    if (editor) {
      document.getElementById('title').value = post.title;
      editor.setContent(post.content);
      document.getElementById('tags').value = (post.tags || []).join(',');
    } else if (retries > 0) {
      setTimeout(() => prefillWhenReady(retries - 1), 200); // 200ms warten, dann nochmal versuchen
    } else {
      console.warn('TinyMCE Editor nicht bereit, Prefill abgebrochen.');
      return;
    }
  }
  prefillWhenReady();
}
// Fügt Delete-Buttons zu allen Posts hinzu (nur für Admins)
export async function addDeleteButtonsToPosts() {
  // Prüfe, ob Admin eingeloggt ist (passe ggf. an deine Logik an)
  if (!await checkAdminStatusCached()) return;

  // Für alle Post-Karten (passe den Selektor ggf. an)
  document.querySelectorAll('.post-card').forEach(card => {
    // Verhindere doppelte Buttons
    if (card.querySelector('.admin-delete-btn')) return;

    // Hole die Post-ID (passe an, falls du sie anders speicherst)
    const link = card.querySelector('a[href*="/blogpost/${post.id}"]');
    if (!link) return;
    const url = new URL(link.href, window.location.origin);
    const postId = url.pathname.split('/').pop();
    if (!postId) return;

    // Button erstellen
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-sm admin-delete-btn ml-2';
    btn.textContent = 'Löschen';
    btn.onclick = async () => {
      if (confirm('Diesen Post wirklich löschen?')) {
        // Hier deine Delete-Logik (z.B. API-Call)
        const res = await fetch(`/blogpost/delete/${postId}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
          card.remove();
        } else {
          alert('Löschen fehlgeschlagen!');
        }
      }
    };

    // Button anhängen (z.B. ans Ende der Karte)
    card.appendChild(btn);
  });
}
// Funktion zum Rendern des Seitenleisten-Archivs
export async function renderSidebarArchive(posts) {
  const archive = {};
  posts.forEach(post => {
    const year = new Date(post.created_at).getFullYear();
    if (!archive[year]) archive[year] = [];
    archive[year].push(post);
  });
  const dropdown = document.getElementById('year-archive-dropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  Object.keys(archive).sort((a, b) => b - a).forEach(year => {
    const a = document.createElement('a');
    a.className = 'dropdown-item';
    a.href = `pages/archiv.html?year=${year}`;
    a.textContent = `${year} (${archive[year].length})`;
    dropdown.appendChild(a);
  });
}
// Funktion zum Rendern der Sidebar mit den beliebtesten Posts
// Diese Funktion lädt alle Blogposts, filtert die letzten 3 Monate und sortiert sie
export async function renderPopularPostsSidebar(posts) {
  if (!Array.isArray(posts)) return;

  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  // Trenne neue und alte Beiträge
  const recent = [];
  const old = [];
  posts.forEach(post => {
    const created = new Date(post.created_at);
    if (created >= threeMonthsAgo) {
      recent.push(post);
    } else {
      old.push(post);
    }
  });

  // Sortiere nach Klicks/Views (nutze post.clicks oder post.views)
  recent.sort((a, b) => (b.clicks || b.views || 0) - (a.clicks || a.views || 0));
  old.sort((a, b) => (b.clicks || b.views || 0) - (a.clicks || a.views || 0));

  // Bis zu 5 neue, dann alte auffüllen
  let popular = recent.slice(0, 5);
  if (popular.length < 5) {
    popular = popular.concat(old.slice(0, 5 - popular.length));
  }

  // Rendern
  const list = document.getElementById('popular-posts');
  if (!list) return;
  list.innerHTML = '';
  popular.forEach(post => {
    const li = createElement('li', {}, `<a class="featured-post-title" href="/blogpost/${post.id}">${post.title}</a>`);
    list.appendChild(li);
  });
}
// Hover-Effekte für Buttons (wiederverwendbar)
export function addHoverEffects(element, scaleUp = 1.1, scaleDown = 1) {
  element.addEventListener('mouseenter', () => {
    element.style.transform = `scale(${scaleUp})`;
  });
    
  element.addEventListener('mouseleave', () => {
    element.style.transform = `scale(${scaleDown})`;
  });
}
// AJAX-Formular-Handling für Formspree-Kontaktformulare
(function() {
  const form = document.getElementById('my-form');
  if (!form) return;

  const status = document.getElementById('my-form-status');
  form.addEventListener('submit', async function handleSubmit(event) {
    event.preventDefault();
    if (status) status.innerHTML = 'Senden...';

    const data = new FormData(form);
    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: data,
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) {
        if (status) status.innerHTML = 'Danke für deine Nachricht!';
        form.reset();
      } else {
        const result = await response.json();
        if (result.errors && status) {
          status.innerHTML = result.errors.map(error => error.message).join(', ');
        } else if (status) {
          status.innerHTML = 'Oops! Es gab ein Problem beim Senden.';
        }
      }
    } catch (error) {
      if (status) status.innerHTML = 'Oops! Es gab ein Problem beim Senden.';
    }
  });
})();
/* ========================================
   DARK MODE FUNCTIONALITY
   ======================================== */

// Dark Mode State Management
let isDarkMode = false;
// Dark Mode initialization
export function initializeDarkMode() {
  // Check for saved theme preference or default to light mode
  const savedTheme = localStorage.getItem('blog-theme');
    
  if (savedTheme) {
    isDarkMode = savedTheme === 'dark';
  } else {
    // Check system preference
    isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
    
  // Apply the theme
  applyTheme(isDarkMode);
    
  // Apply theme to TinyMCE if it exists
  // if (typeof window.applyTinyMCETheme === 'function') {
  //     window.applyTinyMCETheme(isDarkMode);
  // }
    
  // Create floating menu with dark mode toggle
  createFloatingMenu();
    
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('blog-theme')) {
        isDarkMode = e.matches;
        applyTheme(isDarkMode);
        updateToggleButton();
        // Apply theme to TinyMCE
        // if (typeof window.applyTinyMCETheme === 'function') {
        //     window.applyTinyMCETheme(isDarkMode);
        // }
      }
    });
  }
}
// Apply theme to document
function applyTheme(darkMode) {
  const html = document.documentElement;
    
  if (darkMode) {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
  }
    
  isDarkMode = darkMode;
}
// Create floating menu system with dark mode toggle and admin login
function createFloatingMenu() {
  // Check if menu already exists
  if (document.getElementById('floating-menu')) return;
    
  // Create menu container
  const floatingMenu = document.createElement('div');
  floatingMenu.id = 'floating-menu';
  floatingMenu.className = 'floating-menu';
    
  // Create menu toggle button
  const menuToggle = document.createElement('button');
  menuToggle.className = 'menu-toggle';
  menuToggle.title = 'Menü öffnen';
  menuToggle.setAttribute('aria-label', 'Menü öffnen');

  // Create image icon:
  const clippyImg = document.createElement('img');
  clippyImg.src = '/assets/media/clippy.png';
  clippyImg.alt = 'Clippy';
  menuToggle.appendChild(clippyImg);
    
  // Create menu options container
  const menuOptions = document.createElement('div');
  menuOptions.className = 'menu-options';
    
  // Create dark mode button
  const darkModeBtn = document.createElement('button');
  darkModeBtn.className = 'menu-option dark-mode-btn';
  darkModeBtn.title = 'Dark Mode umschalten';
  darkModeBtn.setAttribute('data-tooltip', 'Dark Mode');
  darkModeBtn.setAttribute('aria-label', 'Dark Mode umschalten');
  updateDarkModeButtonIcon(darkModeBtn);
  darkModeBtn.addEventListener('click', () => {
    toggleDarkMode();
    updateDarkModeButtonIcon(darkModeBtn);
  });
    
  // Create admin button
  const adminBtn = document.createElement('button');
  adminBtn.className = 'menu-option admin-btn';
  adminBtn.title = 'Admin Login';
  adminBtn.setAttribute('data-tooltip', 'Admin Login');
  adminBtn.setAttribute('aria-label', 'Admin Login');
  adminBtn.innerHTML = '⋆';
  adminBtn.addEventListener('click', () => {
    if (typeof showAdminLoginModal === 'function') {
      showAdminLoginModal();
    }
    closeFloatingMenu();
  });
    
  // Create scroll to top button
  const scrollTopBtn = document.createElement('button');
  scrollTopBtn.className = 'menu-option scroll-top-btn';
  scrollTopBtn.title = 'Nach oben';
  scrollTopBtn.setAttribute('data-tooltip', 'Nach oben');
  scrollTopBtn.setAttribute('aria-label', 'Nach oben scrollen');
  scrollTopBtn.innerHTML = '⌃';
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    closeFloatingMenu();
  });
    
  // Add options to container
  menuOptions.appendChild(scrollTopBtn);
  menuOptions.appendChild(darkModeBtn);
  menuOptions.appendChild(adminBtn);
    
  // Add elements to menu - options first (above), then toggle button (bottom)
  floatingMenu.appendChild(menuOptions);
  floatingMenu.appendChild(menuToggle);
    
  // Menu toggle functionality
  let isMenuOpen = false;
  menuToggle.addEventListener('click', () => {
    isMenuOpen = !isMenuOpen;
    menuToggle.classList.toggle('active', isMenuOpen);
    menuOptions.classList.toggle('active', isMenuOpen);
    menuToggle.title = isMenuOpen ? 'Menü schließen' : 'Menü öffnen';
  });
    
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!floatingMenu.contains(e.target) && isMenuOpen) {
      closeFloatingMenu();
    }
  });
    
  function closeFloatingMenu() {
    isMenuOpen = false;
    menuToggle.classList.remove('active');
    menuOptions.classList.remove('active');
    menuToggle.title = 'Menü öffnen';
  }
    
  // Add to page
  document.body.appendChild(floatingMenu);
}
function updateDarkModeButtonIcon(button) {
  if (!button) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  button.innerHTML = isDark ? '○' : '●';
}
// Update toggle button icon
function updateToggleButtonIcon(button = null) {
  // Update new floating menu dark mode button
  const darkModeBtn = document.querySelector('.dark-mode-btn');
  if (darkModeBtn) {
    updateDarkModeButtonIcon(darkModeBtn);
  }
    
  // Legacy support for old toggle button
  const toggleButton = button || document.getElementById('dark-mode-toggle');
  if (toggleButton) {
    toggleButton.innerHTML = isDarkMode ? '○' : '●';
    toggleButton.title = isDarkMode ? 'Light Mode aktivieren' : 'Dark Mode aktivieren';
    toggleButton.setAttribute('aria-label', isDarkMode ? 'Light Mode aktivieren' : 'Dark Mode aktivieren');
  }
}
// Update toggle button after theme change
function updateToggleButton() {
  updateToggleButtonIcon();
}
// Toggle dark mode
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
    
  // Apply theme
  applyTheme(isDarkMode);
    
  // Update TinyMCE theme if available
  if (typeof window.updateTinyMCETheme === 'function') {
    window.updateTinyMCETheme();
  }
    
  // Dispatch theme change event for other components
  window.dispatchEvent(new CustomEvent('themeChanged', { 
    detail: { isDarkMode: isDarkMode }, 
  }));
    
  // Update button
  updateToggleButton();
    
  // Save preference
  localStorage.setItem('blog-theme', isDarkMode ? 'dark' : 'light');
    
  // Show notification
  showNotification(
    isDarkMode ? 'Dark Mode aktiviert 🌙' : 'Light Mode aktiviert ☀️', 
    'success',
  );
    
  // Animate toggle button
  const toggleButton = document.getElementById('dark-mode-toggle');
  if (toggleButton) {
    toggleButton.style.transform = 'translateY(-3px) scale(1.2) rotate(360deg)';
    setTimeout(() => {
      toggleButton.style.transform = '';
    }, 300);
  }
}
// Function to show spectacular notification for new posts
function showNewPostNotification(newPosts) {
  // Don't show if user has already seen today's posts
  const today = new Date().toDateString();
  const lastSeen = localStorage.getItem('lastSeenNewPosts');
    
  if (lastSeen === today) return;
    
  // Create the notification modal
  const modal = document.createElement('div');
  modal.className = 'new-post-modal';
  modal.innerHTML = `
        <span>Neue Posts verfügbar! ${newPosts.length} brandneue${newPosts.length > 1 ? ' Beiträge' : 'r Beitrag'}</span>
        <button onclick="this.parentElement.remove()" class="modal-close-btn">✕</button>
    `;
    
  document.body.appendChild(modal);
    
  // Add click event to navigate to first new post
  modal.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
      window.location.href = '/';  // Navigate to index page instead of API route
    }
  });
    
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (modal.parentElement) {
      modal.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => modal.remove(), 300);
    }
  }, 5000);
    
  // Mark as seen
  localStorage.setItem('lastSeenNewPosts', today);
}
// Auto-initialize dark mode when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDarkMode);
} else {
  initializeDarkMode();
}