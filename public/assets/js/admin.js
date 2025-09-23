// Admin-System für den Blog
// Alle admin-bezogenen Funktionen sind hier zentralisiert
import { makeApiRequest } from './api.js';
import { showFeedback } from './feedback.js';
// Import helpers from common module instead of relying on window globals
import {
  createElement,
  elementExists,
  hideElement,
  showElement,
  reloadPageWithDelay,
  getUrlParameter,
  deletePostAndRedirect,
  redirectEditPost,
  showCreateCardModal,
} from './common.js';
import { isValidIdSchema } from './lib/validationClient.js';
import { isAdmin, setAdmin } from './state/adminState.js';
import { isAdminFromServer } from './config.js';

// Admin-Status (module-scoped via state store)
let currentUser = null;
// Admin-Status Caching
let adminStatusPromise = null;
// Admin-System Initialisierung
let adminSystemInitialized = false;
let adminSystemInitPromise = null;

// Admin-Status über HTTP-only Cookie prüfen
// Normalize response to a stable shape: { ok, valid, user }
async function verifyAdminStatus() {
  try {
    const envelope = await callApi('/auth/verify', {
      method: 'POST',
    });
    const payload = envelope && envelope.data ? envelope.data : null; // server JSON
    const valid = Boolean(payload && payload.data && payload.data.valid === true);
    const user = payload && payload.data && payload.data.user ? payload.data.user : null;
    return { ok: envelope && envelope.success === true, valid, user };
  } catch (error) {
    console.warn('Admin status check failed:', error);
    return { ok: false, valid: false, user: null };
  }
}
async function checkAdminStatus() {
  try {
    const status = await verifyAdminStatus();
    if (status.ok && status.valid) {
      setAdmin(true);
      adminStatusPromise = Promise.resolve(true);
      currentUser = status.user || null;
      return true;
    } else {
      // Admin nicht eingeloggt oder Session abgelaufen
      setAdmin(false);
      currentUser = null;
      return false;
    }
  }  catch (error) {
    console.warn('Admin status check failed:', error);
    setAdmin(false);
    currentUser = null;
    return false;
  }
}
async function checkAdminStatusCached() {
  if (!adminStatusPromise) {
    adminStatusPromise = checkAdminStatus();
  }
  return adminStatusPromise;
}
// Cookie-basiertes Admin Logout
async function adminLogout() {
  if (!isAdmin()) {
    return;
  }
  try {
    await callApi('/auth/logout', {
      method: 'POST',
    });
  } catch (error) {
    console.warn('Logout-Request fehlgeschlagen:', error);
  }
    
  // Lokale Variablen zurücksetzen
  setAdmin(false);
  currentUser = null;
  adminStatusPromise = null; // Cache leeren
    
  updateNavigationVisibility();

  // Nur reload, wenn NICHT auf /createPost
  if (!window.location.pathname.includes('/createPost')) {
    reloadPageWithDelay();
  } else {
  // Auf /createPost: Editor und geschützte Bereiche ausblenden, Sperrseite zeigen
    hideElement('create-content');
    showElement('admin-required');
  }
}
async function deletePost(postId) {
  if (!isAdmin()) {
    showFeedback('Sie sind nicht eingeloggt.', 'error');
    return false;
  }
  if (!isValidIdSchema(postId)){
    showFeedback('Ungültige Beitrags-ID.', 'error');
    return false;
  }

  if (!confirm('Sind Sie sicher, dass Sie diesen Beitrag löschen möchten?')) {
    return false;
  }

  const result = await makeApiRequest(`/blogpost/delete/${postId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
    
  if (result.success) {
    showFeedback('Beitrag erfolgreich gelöscht.', 'info');
    return true;
  } else {
    const errorMsg = result.error || (result.data && result.data.error) || 'Unbekannter Fehler';
        
    // Bei 401/403 - Session abgelaufen
    if (result.status === 401 || result.status === 403) {
      showFeedback('Session abgelaufen. Bitte melden Sie sich erneut an.', 'error');
      await adminLogout();
      return false;
    }
        
    if (result.status === 0) {
      showFeedback('Netzwerkfehler. Bitte versuchen Sie es später erneut.', 'error');
    } else {
      showFeedback('Fehler beim Löschen des Beitrags: ' + errorMsg, 'error');
    }
    return false;
  }
}
// Funktion zum Aktualisieren der Navigation basierend auf Admin-Status
function updateNavigationVisibility() {
  const createNavItem = document.getElementById('create-nav-item');
  if (createNavItem) {
    createNavItem.style.display = isAdmin() ? 'block' : 'none';
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
        <button data-action="admin-logout" class="admin-logout-btn">
            Logout
        </button>
    `;
  document.body.prepend(toolbar);
  // Attach local listener for admin toolbar actions to avoid inline handlers
  toolbar.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'admin-logout') {
      adminLogout();
    }
  });
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
                <div>
                    <label for="admin-username">Benutzername:</label>
                    <input id="admin-username" type="text" />
                </div>
                <div>
                    <label for="admin-password">Passwort:</label>
                    <input id="admin-password" type="password" />
                </div>
                <div class="modal-actions">
          <button type="button" id="admin-login-cancel" data-action="close-modal">Abbrechen</button>
          <button type="button" id="admin-login-submit">Anmelden</button>
                </div>
                <div id="admin-login-error"></div>
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

  const submitBtn = document.getElementById('admin-login-submit');
  if (submitBtn) {
    // Mark submit button so delegated or local code can handle submit
    submitBtn.dataset.action = 'admin-login-submit';
  }
  function _showError(msg) {
    const err = document.getElementById('admin-login-error');
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
  }
}
async function adminLogin(username, password) {
  if (isAdmin()) {
    showFeedback('Admin bereits eingeloggt.', 'error');
    return true;
  }
  try {
    const result = await callApi('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
        
    if (result && result.success === true) {
      setAdmin(true);
      currentUser = (result.data && result.data.user) ? result.data.user : currentUser;
      adminStatusPromise = Promise.resolve(true);
      showFeedback('Erfolgreich eingeloggt.', 'info');
      updateNavigationVisibility();
      // Keine Voll-Reloads mehr: UI direkt aktualisieren
      try { addAdminMenuItemToNavbar(); } catch { /* no-op */ }
      if (window.location.pathname.includes('/createPost')) {
        // Auf /createPost: Editor und geschützte Bereiche einblenden, Sperrseite ausblenden
        showElement('create-content');
        hideElement('admin-required');
      }
      return true;
    } else {
      const errorMsg = result.error || (result.data && result.data.error) || 'Unbekannter Fehler';
      showFeedback('Login fehlgeschlagen: ' + errorMsg, 'error');
      return false;
    }
  } catch (error) {
    console.error('Login-Fehler:', error);
    showFeedback('Netzwerkfehler. Bitte versuchen Sie es später erneut.', 'error');
    return false;
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

      // Link statt Button
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = 'Card erstellen';
      link.style.cursor = 'pointer';
      // delegate via data-action attribute
      link.dataset.action = 'show-create-card';

      createCardLi.appendChild(link);
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

export { initializeAdminSystem, addAdminMenuItemToNavbar, checkAdminStatusCached, showAdminLoginModal, ADMIN_CONFIG, deletePost, addReadPostAdminControls, getCurrentUser };

// Helper wrapper to call API. Tests may mock module imports; fallback to global.makeApiRequest
async function callApi(path, options) {
  try {
    if (typeof makeApiRequest === 'function') {
      return await makeApiRequest(path, options);
    }
  } catch {
    // fallthrough to global
  }
  if (typeof globalThis.makeApiRequest === 'function') {
    return await globalThis.makeApiRequest(path, options);
  }
  throw new Error('No API function available');
}

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
    if (action === 'show-create-card') {
      e.preventDefault();
      if (typeof showCreateCardModal === 'function') showCreateCardModal();
      return;
    }
    if (action === 'admin-login-submit') {
      e.preventDefault();
      // Read credentials from modal inputs
      const usernameEl = document.getElementById('admin-username');
      const passwordEl = document.getElementById('admin-password');
      const username = usernameEl ? usernameEl.value : '';
      const password = passwordEl ? passwordEl.value : '';
      // Optimistically remove modal so UI feels responsive in tests and real usage.
      const modalToClose = document.getElementById('admin-login-modal');
      if (modalToClose && modalToClose.parentElement) modalToClose.parentElement.removeChild(modalToClose);

      // Call adminLogin in background; if it fails, show feedback and optionally reopen modal
      (async () => {
        try {
          const success = await adminLogin(username, password);
          if (!success) {
            showFeedback('Login fehlgeschlagen. Bitte versuchen Sie es erneut.', 'error');
            // Try to reopen the modal so the user can retry (best-effort)
            try {
              showAdminLoginModal();
            } catch {
              // ignore
            }
          }
        } catch (err) {
          console.error('Delegated admin login failed:', err);
          showFeedback('Login fehlgeschlagen. Bitte versuchen Sie es später erneut.', 'error');
          try { showAdminLoginModal(); } catch { }
        }
      })();
      return;
    }
    if (action === 'delete-post') {
      const postId = btn.dataset.postId;
      if (postId && typeof deletePostAndRedirect === 'function') deletePostAndRedirect(postId);
      return;
    }
    if (action === 'edit-post') {
      const postId = btn.dataset.postId;
      if (postId && typeof redirectEditPost === 'function') redirectEditPost(postId);
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