// Admin-System für den Blog
// Alle admin-bezogenen Funktionen sind hier zentralisiert
import { showFeedback } from './feedback.js';
// Import helpers from common module instead of relying on window globals
import {
  createElement,
  elementExists,
  hideElement,
  reloadPageWithDelay,
  getUrlParameter,
} from './common.js';
import { isAdmin, setAdmin } from './state/adminState.js';
import { isAdminFromServer } from './config.js';

// Admin-Status (module-scoped via state store)
let currentUser = null;
// Admin-Status Caching mit Timestamp
let adminStatusCache = {
  promise: null,
  result: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000 // 5 Minuten Cache
};
// Admin-System Initialisierung
let adminSystemInitialized = false;
let adminSystemInitPromise = null;

// Admin-Status über HTTP-only Cookie prüfen
// Normalize response to a stable shape: { ok, valid, user }
async function checkAdminStatusCached() {
  const serverSaysAdmin = isAdminFromServer();
  setAdmin(!!serverSaysAdmin);
  currentUser = serverSaysAdmin ? currentUser : null;
  adminStatusCache.result = !!serverSaysAdmin;
  adminStatusCache.timestamp = Date.now();
  return adminStatusCache.result;
}
// Cookie-basiertes Admin Logout 
async function adminLogout() {
  if (!isAdmin()) {
    return;
  }
  const logoutForm = document.getElementById('admin-logout-form');
  if (logoutForm && typeof logoutForm.submit === 'function') {
    logoutForm.submit();
    return;
  }
    
  // Lokale Variablen zurücksetzen
  setAdmin(false);
  currentUser = null;
  adminStatusCache = {
    promise: null,
    result: null,
    timestamp: 0,
    ttl: 5 * 60 * 1000
  };
    
  updateNavigationVisibility();

  // Seite neu laden, um server-seitigen Status zu aktualisieren
  reloadPageWithDelay();
}
// Funktion zum Aktualisieren der Navigation basierend auf Admin-Status
function updateNavigationVisibility() {
  const createNavItem = document.getElementById('admin-create-link');
  if (createNavItem) {
    createNavItem.style.display = isAdmin() ? 'block' : 'none';
  }
  const createCardItem = document.getElementById('admin-createCard-modal');
  if (createCardItem) {
    createCardItem.style.display = isAdmin() ? 'block' : 'none';
  }
    
  // Create-Links auf anderen Seiten
  const createLinks = document.querySelectorAll('.create-link');
  createLinks.forEach(link => {
    link.style.display = isAdmin() ? 'inline-block' : 'none';
  });
    
  // Navigation auf /createPost (Admin-geschützte vs. öffentliche Navigation)
  const publicNavigation = document.getElementById('public-navigation');
  if (publicNavigation) {
    publicNavigation.style.display = isAdmin() ? 'none' : 'block';
  }
    
  // Admin-Toolbar und Login-Button entsprechend ein-/ausblenden
  if (isAdmin()) {
    createAdminToolbar();
    hideElement('admin-login-btn');
  } else {
    hideElement('admin-toolbar');
    const adminControls = document.getElementById('admin-controls');
    if (adminControls) {
      hideElement('admin-controls');
      adminControls.innerHTML = '';
    }
    // Admin-Login-Button wird vom Floating Menu System verwaltet
  }
}
// Admin-Toolbar erstellen
function createAdminToolbar() {
  if (!isAdmin()) return;
  // Prüfen ob Toolbar bereits existiert
  if (elementExists('admin-toolbar')) return;
  const toolbar = createElement('div');
  toolbar.id = 'admin-toolbar';
  toolbar.className = 'admin-toolbar';
  toolbar.innerHTML = `
        <span>Admin-Modus aktiv</span>
    `;
  document.body.prepend(toolbar);
  // Attach local listener for admin toolbar actions to avoid inline handlers
  // Body-Padding anpassen wegen der Toolbar
  document.body.style.paddingTop = ADMIN_CONFIG.TOOLBAR_HEIGHT;
}
// Modal anzeigen
function showAdminLoginModal() {
  if (isAdmin()) {
    showFeedback('Admin bereits eingeloggt.', 'error');
    return;
  }
  if (document.getElementById('admin-login-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'admin-login-modal';
  modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Login</h3>
            </div>
            <div class="modal-body">
          <form method="POST" action="/auth/login">
            <div>
              <label for="admin-username">Benutzername:</label>
              <input id="admin-username" name="username" type="text" required />
            </div>
            <div>
              <label for="admin-password">Passwort:</label>
              <input id="admin-password" name="password" type="password" required />
            </div>
            <div class="modal-actions">
              <button type="button" id="admin-login-cancel" data-action="close-modal">Abbrechen</button>
              <button type="submit" id="admin-login-submit">Anmelden</button>
            </div>
            <div id="admin-login-error"></div>
          </form>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
    
  // Event-Handler: use delegated/data-action attributes for close and submit
  const cancelBtn = document.getElementById('admin-login-cancel');
  if (cancelBtn) {
    cancelBtn.dataset.action = 'close-modal';
  }

  // Close modal when clicking outside (on overlay)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal && modal.parentElement) modal.parentElement.removeChild(modal);
    }
  });

  function _showError(msg) {
    const err = document.getElementById('admin-login-error');
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
  }
}
function resolveCurrentPostId() {
  try {
    // 1) Server-injected JSON via non-executable script tag
    try {
      const el = document.getElementById('server-post');
      if (el && el.textContent) {
        const obj = JSON.parse(el.textContent);
        if (obj && obj.id) return String(obj.id);
      }
    } catch { /* ignore */ }
    // 2) Meta tag
    const meta = document.querySelector('meta[name="post-id"]');
    if (meta && meta.content) return String(meta.content);
    // 3) Any element with data-post-id (e.g., #post-article)
    const dataEl = document.querySelector('[data-post-id]');
    if (dataEl && dataEl.getAttribute('data-post-id')) return String(dataEl.getAttribute('data-post-id'));
    // 4) URL pattern /blogpost/123 or /blogpost/by-id/123
    const path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    const m = path.match(/\/blogpost\/(?:by-id\/)?(\d+)/);
    if (m && m[1]) return String(m[1]);
    // 5) Legacy query parameter
    const q = getUrlParameter('post');
    if (q) return String(q);
  } catch { /* ignore */ }
  return null;
}

async function addReadPostAdminControls() {
  if (!isAdmin()) return;
  const postId = resolveCurrentPostId();
  if (!postId) return;

  let adminControls = document.getElementById('admin-controls');
  // Fallback: create container inside navigation if missing
  if (!adminControls) {
    const nav = document.querySelector('.navigation') || document.querySelector('.post-footer') || document.body;
    adminControls = document.createElement('div');
    adminControls.id = 'admin-controls';
    adminControls.className = 'mt-15';
    nav.appendChild(adminControls);
  }

  if (adminControls) {
    adminControls.innerHTML = `
      <button type="button" data-action="delete-post" data-post-id="${postId}" class="btn admin-delete-btn btn-lg ml-2">
        Post löschen
      </button>
      <button type="button" class="btn btn-outline-warning btn-lg ml-2" data-action="edit-post" data-post-id="${postId}">
        <span class="btn-icon">✏️</span>
        Post bearbeiten
      </button>
    `;
    // Ensure controls are visible if a utility 'hidden' class is present
    try { adminControls.classList.remove('hidden'); } catch { /* no-op */ }
  }
}
async function initializeAdminSystem() {
  if (adminSystemInitialized) return true;
  if (adminSystemInitPromise) return adminSystemInitPromise;

  adminSystemInitPromise = (async () => {
    try {
      // Seed from SSR config for immediate UI correctness, then verify
      try { setAdmin(isAdminFromServer()); } catch { /* ignore */ }
      const status = await checkAdminStatusCached();
      updateNavigationVisibility();
      adminSystemInitialized = true;
      return status;
    } catch (error) {
      console.error('Admin-Status konnte nicht geprüft werden:', error);
      showFeedback('Verbindung zum Server fehlgeschlagen. Admin-Funktionen stehen nicht zur Verfügung.', 'error');
      adminSystemInitialized = false;
      return false;
    }
  })();

  return adminSystemInitPromise;
}
function addAdminMenuItemToNavbar() {
  if (isAdmin()) {
    const menu = document.getElementById('navbar-menu-items');
    if (menu && !document.getElementById('admin-create-link')) {
      const createLi = document.createElement('li');
      createLi.id = 'admin-create-link';
  createLi.innerHTML = '<a href="/createPost">Post erstellen</a>';
      menu.insertBefore(createLi, menu.firstChild.nextSibling);
    }
    if (menu && !document.getElementById('admin-createCard-modal')) {
      const createCardLi = document.createElement('li');
      createCardLi.id = 'admin-createCard-modal';
      createCardLi.innerHTML = '<a href="/cards/create">Card erstellen</a>';
      menu.insertBefore(createCardLi, menu.firstChild.nextSibling);
    }
  }
}
const ADMIN_CONFIG = {
  TOOLBAR_HEIGHT: '30px',
  ELEMENT_WAIT_TIMEOUT: 5000,
};

// Exporting showAdminLoginModal is enough for modules to import it;
// avoid attaching to `window` to keep modules pure.

/*
  Admin delegation & testing notes:
  - Use `initializeAdminDelegation()` to wire admin-specific `data-action` handlers.
    This keeps markup free of inline `onclick` attributes and centralizes admin UI
    behavior (login modal, create-card, delete/edit post, etc.).

  - Optimistic UI for login modal in delegated submit:
    * The delegated `admin-login-submit` handler removes the modal optimistically and
      triggers `adminLogin()` in the background. This improves UX and reduces test
      timing flakiness (tests don't need to wait for animations or modal states).
    * If login fails the code attempts to reopen the modal as a best-effort UX recovery.

  - Testing guidance (Jest + ESM):
    * If tests mock `makeApiRequest` or other imported functions, perform the mock before
      importing `admin.js` using `jest.unstable_mockModule(...)`. Then `await import(...)`
      the module under test. This prevents errors caused by overwriting read-only ESM bindings.
    * Call `initializeAdminDelegation()` in your test setup to ensure delegated handlers are
      attached to the document before simulating clicks.

  - Exposing helpers:
    * Exported functions like `showAdminLoginModal`, `deletePost`, and `getCurrentUser`
      are intentionally exported so tests and other modules can call them without relying on
      `window` globals.
*/

function getCurrentUser() {
  return currentUser;
}

export { initializeAdminSystem, addAdminMenuItemToNavbar, checkAdminStatusCached, showAdminLoginModal, ADMIN_CONFIG, addReadPostAdminControls, getCurrentUser };

// Initialize admin-specific delegated action handlers. Call this once after admin init.
let _adminDelegationInitialized = false;
export function initializeAdminDelegation() {
  if (_adminDelegationInitialized) return;
  _adminDelegationInitialized = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;
    // Admin-only actions
    if (action === 'show-admin-login') {
      e.preventDefault();
      if (typeof showAdminLoginModal === 'function') showAdminLoginModal();
      return;
    }
  });
}

// Retry loop to ensure admin controls get injected even if admin status/postId arrive late
let _adminControlsInjected = false;
async function ensureAdminControls({ attempts = 10, intervalMs = 500 } = {}) {
  if (_adminControlsInjected) return true;
  for (let i = 0; i < attempts; i++) {
    try {
      const ok = await checkAdminStatusCached();
      const postId = resolveCurrentPostId();
      if (ok && isAdmin() && postId) {
        await addReadPostAdminControls();
        _adminControlsInjected = true;
        return true;
      }
    } catch { /* ignore and retry */ }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

export { ensureAdminControls };