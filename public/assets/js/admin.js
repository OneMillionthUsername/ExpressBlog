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
  // deletePostAndRedirect,
} from './common.js';
import { showCreateCardModal } from './common.js';
import { isValidIdSchema } from './lib/validationClient.js';

// Admin-Status Variable (muss vor allen Funktionen stehen)
let isAdminLoggedIn = false;
let currentUser = null;
// Admin-Status Caching
let adminStatusPromise = null;
// Admin-System Initialisierung
let adminSystemInitialized = false;
let adminSystemInitPromise = null;

// Admin-Status über HTTP-only Cookie prüfen
async function verifyAdminStatus() {
  try {
    const result = await callApi('/auth/verify', {
      method: 'POST',
    });
    return result;
  } catch (error) {
    console.warn('Admin status check failed:', error);
    return { success: false };
  }
}
async function checkAdminStatus() {
  try {
    const result = await verifyAdminStatus();
    // TODO: doppelt data analysieren
    if (result.success && result.data?.valid) {
      isAdminLoggedIn = true;
      adminStatusPromise = Promise.resolve(true);
      currentUser = result.data.user;
      return true;
    } else {
      // Admin nicht eingeloggt oder Session abgelaufen
      isAdminLoggedIn = false;
      currentUser = null;
      return false;
    }
  }  catch (error) {
    console.warn('Admin status check failed:', error);
    isAdminLoggedIn = false;
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
  if (!isAdminLoggedIn) {
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
  isAdminLoggedIn = false;
  currentUser = null;
  adminStatusPromise = null; // Cache leeren
    
  updateNavigationVisibility();

  // Nur reload, wenn NICHT auf create.html
  if (!window.location.pathname.includes('create.html')) {
    reloadPageWithDelay();
  } else {
    // Auf create.html: Editor und geschützte Bereiche ausblenden, Sperrseite zeigen
    hideElement('create-content');
    showElement('admin-required');
  }
}
async function deletePost(postId) {
  if (!isAdminLoggedIn) {
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
    createNavItem.style.display = isAdminLoggedIn ? 'block' : 'none';
  }
    
  // Create-Links auf anderen Seiten
  const createLinks = document.querySelectorAll('.create-link');
  createLinks.forEach(link => {
    link.style.display = isAdminLoggedIn ? 'inline-block' : 'none';
  });
    
  // Navigation auf create.html (Admin-geschützte vs. öffentliche Navigation)
  const publicNavigation = document.getElementById('public-navigation');
  if (publicNavigation) {
    publicNavigation.style.display = isAdminLoggedIn ? 'none' : 'block';
  }
    
  // Admin-Toolbar und Login-Button entsprechend ein-/ausblenden
  if (isAdminLoggedIn) {
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
  if (!isAdminLoggedIn) return;
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
  if (isAdminLoggedIn) {
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
  if (isAdminLoggedIn) {
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
      isAdminLoggedIn = true;
      currentUser = (result.data && result.data.user) ? result.data.user : currentUser;
      adminStatusPromise = Promise.resolve(true);
      showFeedback('Erfolgreich eingeloggt.', 'info');
      updateNavigationVisibility();
      // Nur reload, wenn NICHT auf create.html
      if (!window.location.pathname.includes('create.html')) {
        reloadPageWithDelay();
      } else {
        // Auf create.html: Editor und geschützte Bereiche einblenden, Sperrseite ausblenden
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
async function addReadPostAdminControls() {
  if (!isAdminLoggedIn) return;
    
  const postId = getUrlParameter('post');
  //Error handling
  if (!postId) return;
  else {
    const adminControls = document.getElementById('admin-controls');
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
    }
  }
}
async function initializeAdminSystem() {
  if (adminSystemInitialized) return true;
  if (adminSystemInitPromise) return adminSystemInitPromise;

  adminSystemInitPromise = (async () => {
    try {
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
  if (isAdminLoggedIn) {
    const menu = document.getElementById('navbar-menu-items');
    if (menu && !document.getElementById('admin-create-link')) {
      const createLi = document.createElement('li');
      createLi.id = 'admin-create-link';
      createLi.innerHTML = '<a href="/blogpost/create.html">Post erstellen</a>';
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