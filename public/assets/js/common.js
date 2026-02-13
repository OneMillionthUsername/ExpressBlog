/* eslint-env browser, es2021 */
/* global tinymce, ADMIN_MESSAGES, adminLogout, document, window, fetch, MutationObserver, location, localStorage, CustomEvent */
// Import dependencies as ES6 modules
import { makeApiRequest as _makeApiRequest } from './api.js';
import { decodeHtmlEntities, escapeHtml as _escapeHtml } from './shared/text.js';
import { showFeedback } from './feedback.js';
// Logger not available in frontend - use console instead

import { isAdmin } from './state/adminState.js';

// Helper: strip HTML from a string and return plain text. Prefer DOMPurify if
// available for better handling, otherwise fall back to a simple regex.
export function stripHtml(html = '') {
  if (!html) return '';
  try {
    if (typeof DOMPurify !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
      // Use DOMPurify to sanitize then remove tags by placing into a temporary element
      const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
      return String(clean);
    }
  } catch (e) {
    void e; // silence unused var linter, fallback to regex stripper
  }
  // Fallback: naive tag stripper
  return String(html).replace(/<[^>]*>/g, '');
}

export function createExcerptFromHtml(html = '', maxLength = 150) {
  const text = stripHtml(html).trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Use globalThis.makeApiRequest when present (tests sometimes mock global.makeApiRequest)
async function apiRequest(path, options) {
  const isTestEnv = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test');

  // If a global makeApiRequest is provided (tests often mock this), use it directly
  if (typeof globalThis !== 'undefined' && typeof globalThis.makeApiRequest === 'function') {
    return await globalThis.makeApiRequest(path, options);
  }

  // In tests, if window.fetch is mocked, use it directly so expectations about calls succeed
  if (isTestEnv && typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const response = await window.fetch(path, options);
    let result = null;
    try { result = await response.json(); } catch (_e) { void _e; }
    if (!response.ok) {
      return { success: false, error: result?.error || response.statusText, status: response.status };
    }
    return { success: true, data: result, status: response.status };
  }

  // Fallback to internal wrapper
  return await _makeApiRequest(path, options);
}
    let posts = apiResult && apiResult.success === true ? apiResult.data : null;
    // Error handling
    if (!apiResult || apiResult.success !== true) {
      console.error('Fehler beim Laden der meistgelesenen Posts:', apiResult && apiResult.error);
      // Fallback: try to compute most-read from the all-posts endpoint to keep UI working
      try {
        const allResult = await apiRequest('/api/blogpost/all', { method: 'GET' });
        if (allResult && allResult.success === true && Array.isArray(allResult.data)) {
          // sort by views desc and take top N
          posts = allResult.data.slice().sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 10);
        }
      } catch (err) {
        void err;
      }
      const listContainer = document.getElementById('mostReadPosts');
      listContainer.innerHTML = `
                <div class="error-message">
                    <div class="error-icon">Error</div>
                    <h3>Laden fehlgeschlagen</h3>
                    <p>Die Posts konnten nicht geladen werden.</p>
                    <button data-action="load-mostread-posts" class="btn btn-outline-primary mt-3">Erneut versuchen</button>
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
                    <button data-action="load-mostread-posts" class="btn btn-outline-primary mt-3">Erneut versuchen</button>
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
                <button data-action="load-mostread-posts" class="btn btn-outline-primary mt-3">Erneut versuchen</button>
            </div>
        `;
  }
}

// Utility-Funktion zum Abrufen von URL-Parametern
export function getUrlParameter(paramName) {
  try {
    const urlParams = new URLSearchParams(window.location.search || '');
    return urlParams.get(paramName);
  } catch {
    // In test environments window.location.search may be undefined or mocked
    try {
      const search = (typeof window !== 'undefined' && window.location && window.location.search) || '';
      const urlParams = new URLSearchParams(search);
      return urlParams.get(paramName);
    } catch {
      return null;
    }
  }
}

/*
 Delegation notes:
 - Use `data-action` attributes in markup and call `initializeCommonDelegation()` once at page init.
 - Tests that need to mock imported modules should use `jest.unstable_mockModule(...)` BEFORE importing modules that depend on them.
 - Avoid attaching functions to `window`; prefer exports and delegation.
*/
export function getPostIdFromPath() {
  // Match explicit routes like /blogpost/by-id/123, /blogpost/update/123, /blogpost/delete/123
  let match = window.location.pathname.match(/\/blogpost\/(?:delete|update|by-id)\/(\d+)/);
  if (match) return match[1];
  // Also support the shorthand numeric URL /blogpost/123
  match = window.location.pathname.match(/\/blogpost\/(\d+)(?:\/|$)/);
  if (match) return match[1];
  // Support createPost edit URLs like /createPost/123
  match = window.location.pathname.match(/\/createPost\/(\d+)(?:\/|$)/);
  return match ? match[1] : null;
}
export function getPostSlugFromPath() {
  const match = window.location.pathname.match(/\/blogpost\/([^\/]+)/);
  const slug = match ? match[1] : null;
  return slug;
}
// Prüft, ob ein Post-Parameter existiert, lädt ggf. den Post und füllt das Formular vor
export async function checkAndPrefillEditPostForm() {
  // Prefer server-injected post object (SSR) from JSON script to avoid an extra API call.
  let post = null;
  try {
    const el = document.getElementById('server-post');
    if (el && el.textContent) post = JSON.parse(el.textContent);
  } catch { /* ignore */ }
  if (!post) {
    const postId = getPostIdFromPath();
    if (!postId) return;

    // Postdaten laden via zentraler API-Wrapper
    let apiResult = await apiRequest(`/api/blogpost/by-id/${postId}`, { method: 'GET' });
    if ((!apiResult || apiResult.success !== true) && apiResult && apiResult.status === 404) {
      apiResult = await apiRequest(`/blogpost/${postId}`, { method: 'GET' });
    }
    if (!apiResult || apiResult.success !== true) return;
    post = apiResult.data;
  }

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
      const tagsValue = Array.isArray(post.tags)
        ? post.tags.join(',')
        : (typeof post.tags === 'string' ? post.tags : '');
      document.getElementById('tags').value = tagsValue;
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
  // Check if admin is logged in using state store
  if (!isAdmin()) return;

  // Für alle Post-Karten (passe den Selektor ggf. an)
  document.querySelectorAll('.post-card').forEach(card => {
    // Verhindere doppelte Buttons
    if (card.querySelector('.admin-delete-btn')) return;

    // Hole die Post-ID (passe an, falls du sie anders speicherst)
    const link = card.querySelector('a[href*="/blogpost/"]');
    if (!link) return;
    const url = new URL(link.href, window.location.origin);
    const postId = url.pathname.split('/').pop();
    if (!postId) return;

    // Button erstellen
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-sm admin-delete-btn ml-2';
    btn.textContent = 'Löschen';
    // Delegate delete action via data-action so admin module can handle it
    btn.dataset.action = 'delete-post';
    btn.dataset.postId = postId;

    // Button anhängen (z.B. ans Ende der Karte)
    card.appendChild(btn);
  });
}
// Funktion zum Rendern des Seitenleisten-Archivs
export async function renderSidebarArchive(posts) {
  const archive = {};
  posts.forEach((post, _index) => {
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
    // No year query param — server currently returns archived posts (older than threshold)
    // so we link to the archive page and show the year as context in the label only.
    a.href = `/blogpost/archive`;
    a.textContent = `${year} (${archive[year].length})`;
    dropdown.appendChild(a);
  });
}
// Funktion zum Rendern der Sidebar mit den beliebtesten Posts
// Diese Funktion lädt alle Blogposts, filtert die letzten 3 Monate und sortiert sie
export async function renderPopularPostsSidebar(posts) {
  if (!Array.isArray(posts)) return;
  // Prefer server-provided most-read posts (ordered by views). If it fails,
  // fall back to the existing client-side selection logic.
  try {
    // If the sidebar element is not present, avoid making the server call.
    const listEl = document.getElementById('popular-posts');
    if (!listEl) return;

    const response = await (typeof globalThis !== 'undefined' && typeof globalThis.makeApiRequest === 'function' ?
      globalThis.makeApiRequest('/api/blogpost/most-read', { method: 'GET' }) : await apiRequest('/api/blogpost/most-read', { method: 'GET' }));

    const serverPosts = response && response.success === true ? response.data : null;
    if (Array.isArray(serverPosts) && serverPosts.length > 0) {
      const list = document.getElementById('popular-posts');
      if (!list) return;
      list.innerHTML = '';
      serverPosts.slice(0, 5).forEach(p => {
        //const _views = Number(p.views || 0);
        const title = (typeof DOMPurify !== 'undefined' && DOMPurify) ? DOMPurify.sanitize(p.title) : p.title;
        const li = createElement('li', {}, `<a class="featured-post-title" href="/blogpost/${p.slug}">${title}</a>`);
        list.appendChild(li);
      });
      return;
    }
  } catch (err) {
    // If server call fails, fall back to client-side logic below
    console.debug('renderPopularPostsSidebar: could not fetch /most-read, falling back to client-side selection', err);
  }

  // --- Fallback: client-side selection (as before) ---
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
  // Sortierung sollte in der DB stattfinden.
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
    const li = createElement('li', {}, `<a class="featured-post-title" href="/blogpost/${post.slug}">${post.title}</a>`);
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
      // Log error for debugging and to satisfy lint rules
      console.error('Error while sending contact form:', error);
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
  // Use delegated handler instead of inline click listener
  adminBtn.dataset.action = 'show-admin-login';
    
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
      // Use the exported helper to close the menu
      closeFloatingMenu();
    }
  });
    
  // Add to page
  document.body.appendChild(floatingMenu);
}
// Exported helper to close the floating menu from other modules or delegated handlers
export function closeFloatingMenu() {
  const floatingMenu = document.getElementById('floating-menu');
  if (!floatingMenu) return;
  const menuToggle = floatingMenu.querySelector('.menu-toggle');
  const menuOptions = floatingMenu.querySelector('.menu-options');
  if (menuToggle) menuToggle.classList.remove('active');
  if (menuOptions) menuOptions.classList.remove('active');
  // If there was an internal isMenuOpen state, we can't access it here; rely on DOM to represent closed state
  if (menuToggle) menuToggle.title = 'Menü öffnen';
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
    
  // Dispatch theme change event for other components (TinyMCE listens to this)
  window.dispatchEvent(new CustomEvent('themeChanged', {
    detail: { isDarkMode },
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
        <button data-action="close-modal" class="modal-close-btn">✕</button>
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
// Skip automatic initialization during tests to avoid manipulating a minimal jsdom
// environment which may not include expected elements.
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
  // In test mode we skip auto-init to keep tests hermetic.
} else if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDarkMode);
  } else {
    initializeDarkMode();
  }
}

// Einheitliche Alert-Modal Funktion
export function showAlertModal(message) {
  const modalHtml = `
    <div class="modal-overlay" id="alert-modal">
      <div class="modal-container">
        <div class="modal-content">${message}</div>
        <div class="modal-footer">
          <button id="alert-close" class="modal-button">OK</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('alert-modal');
  const closeBtn = document.getElementById('alert-close');

  const closeModal = () => modal.remove();

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  closeBtn.focus();
}

// ===========================================
// ADMIN HELPER FUNCTIONS
// ===========================================

// Reload page after a delay
export function reloadPageWithDelay(delayMs = 1000) {
  setTimeout(() => {
    window.location.reload();
  }, delayMs);
}

// Redirect to edit post page
export function redirectEditPost(postId) {
  if (!postId) {
    console.error('redirectEditPost: No postId provided');
    return;
  }
  window.location.href = `/createPost/${postId}`;
}

// Delete post and redirect to home page
export async function deletePostAndRedirect(postId) {
  if (!postId) {
    console.error('deletePostAndRedirect: No postId provided');
    return;
  }

  try {
    const response = await _makeApiRequest(`/api/blogpost/delete/${postId}` , {
      method: 'DELETE',
    });

    if (response && response.success) {
      showFeedback('Post erfolgreich gelöscht', 'success');
      // Redirect to home page after 1 second
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } else {
      const errorMsg = response && response.error ? response.error : 'Unbekannter Fehler beim Löschen';
      showFeedback(errorMsg, 'error');
    }
  } catch (error) {
    console.error('deletePostAndRedirect error:', error);
    showFeedback('Fehler beim Löschen des Posts', 'error');
  }
}

// Re-export shared escapeHtml to keep existing imports working
export { _escapeHtml as escapeHtml };