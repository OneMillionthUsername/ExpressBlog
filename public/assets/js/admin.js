// Admin-System für den Blog
// Alle admin-bezogenen Funktionen sind hier zentralisiert
import { makeApiRequest } from '../js/api.js';
import { showFeedback } from '../js/feedback.js';

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
    const result = await makeApiRequest('/auth/verify', {
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
    await makeApiRequest('/auth/logout', {
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
        <button onclick="adminLogout()" class="admin-logout-btn">
            Logout
        </button>
    `;
  document.body.prepend(toolbar);
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
  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Admin Login</h3>
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
                    <button id="admin-login-cancel">Abbrechen</button>
                    <button id="admin-login-submit">Anmelden</button>
                </div>
                <div id="admin-login-error"></div>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
    
  // Event-Handler
  document.getElementById('admin-login-cancel').onclick = () => modal.remove();
    
  // Close modal when clicking outside (on overlay)
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
    
  document.getElementById('admin-login-submit').onclick = async () => {
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
        
    // Simple validation
    if (!username || username.length < 3 || !password || password.length < 8) {
      showError('Benutzername und Passwort müssen mindestens 3 bzw. 8 Zeichen lang sein!');
      return;
    }
        
    const success = await adminLogin(username, password);
    if (success) modal.remove();
    else showError('Login fehlgeschlagen! Bitte überprüfen Sie Ihre Eingaben.');
  };
  function showError(msg) {
    const err = document.getElementById('admin-login-error');
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
    const result = await makeApiRequest('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
        
    if (result.success && result.data?.token) {
      isAdminLoggedIn = true;
      currentUser = result.data.user;
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
                <button type="button" onclick="deletePostAndRedirect('${postId}')" class="btn admin-delete-btn btn-lg ml-2">
                    Post löschen
                </button>
                <button type="button" class="btn btn-outline-warning btn-lg ml-2" onclick="redirectEditPost('${postId}')">
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
      link.onclick = function(e) {
        e.preventDefault();
        if (typeof window.showCreateCardModal === 'function') {
          window.showCreateCardModal();
        } else {
          alert('showCreateCardModal ist nicht verfügbar!');
        }
      };

      createCardLi.appendChild(link);
      menu.insertBefore(createCardLi, menu.firstChild.nextSibling);
    }
  }
}
const ADMIN_CONFIG = {
  TOOLBAR_HEIGHT: '30px',
  ELEMENT_WAIT_TIMEOUT: 5000,
};

// Make showAdminLoginModal globally available for cross-module access
window.showAdminLoginModal = showAdminLoginModal;

export { addAdminMenuItemToNavbar, checkAdminStatusCached, showAdminLoginModal, ADMIN_CONFIG };