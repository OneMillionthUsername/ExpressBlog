// ===========================================
// EINFACHES & ROBUSTES PAGE INITIALISIERUNGSSYSTEM
// ===========================================

import { loadAllBlogPosts, loadCards } from './api.js';
import { 
  //loadAndDisplayAllPosts, 
  loadAndDisplayRecentPosts, 
  loadAndDisplayArchivePosts, 
  loadAndDisplayMostReadPosts,
  loadAndDisplayBlogPost,
  renderAndDisplayCards,
  renderPopularPostsSidebar,
  renderSidebarArchive,
} from './common.js';
// Do NOT statically import the TinyMCE editor or AI assistant here.
// They should only be loaded on the Create page to avoid loading large
// modules (and accidental server-side imports) on every page.
let initializeBlogEditor = null;
import { initializeAdminSystem, addAdminMenuItemToNavbar, initializeAdminDelegation, addReadPostAdminControls, ensureAdminControls } from './admin.js';
import { isAdminFromServer, getAssetVersion } from './config.js';
import { initializeCommonDelegation, showElement, hideElement } from './common.js';
import { initializeCommentsDelegation, initializeCommentsSystem } from './comments.js';

// Admin- und Kommentar-Funktionen bleiben optional (typeof checks)
// da sie aus separaten Modulen kommen können

// Globale Initialisierung - einmalig beim DOM-Ready
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // 1. Admin-System immer initialisieren, damit Admin-UI nach Reload/Navigations persistiert
    if (typeof initializeAdminSystem === 'function') {
      await initializeAdminSystem();
    }

    // 2. Admin-Menü hinzufügen (bei jedem Load; Funktion ist idempotent)
    if (typeof addAdminMenuItemToNavbar === 'function') {
      addAdminMenuItemToNavbar();
    }

    // 3. Initialize common delegation (data-action handlers)
    if (typeof initializeCommonDelegation === 'function') {
      initializeCommonDelegation();
    }
    // Initialize admin delegation
    if (typeof initializeAdminDelegation === 'function') {
      initializeAdminDelegation();
    }

    // 4. Seiten-spezifische Initialisierung
    await initializeCurrentPage();

    // Initialize comments delegation (used on read_post pages)
    if (typeof initializeCommentsDelegation === 'function') {
      initializeCommentsDelegation();
    }

  } catch (error) {
    console.error('Fehler bei der globalen Initialisierung:', error);
  }
});

// Seiten-spezifische Initialisierung
async function initializeCurrentPage() {
  const currentPage = getCurrentPageType();

  try {
    switch(currentPage) {
      case 'create':
        await initializeCreatePage();
        break;
      case 'index':
        await initializeIndexPage();
        break;
      case 'archiv':
        await initializeArchivePage();
        break;
      case 'list_posts':
        await initializeRecentPostsPage();
        break;
      case 'most_read':
        await initializeMostReadPostsPage();
        break;
      case 'read_post':
        await initializeReadPostPage();
        break;
      case 'about':
        // About-Seite - normalerweise keine spezielle Initialisierung nötig
        break;
      default:
        // default: no-op
    }
  } catch (error) {
    console.error(`Fehler bei ${currentPage} Initialisierung:`, error);
  }
}

// Hilfsfunktion: Aktuelle Seite ermitteln
function getCurrentPageType() {
  const path = window.location.pathname;
  const page = path.split('/').pop().replace('.html', '').replace('.ejs', '');

  // Exakte Übereinstimmungen mit tatsächlichen Dateinamen
  if (path === '/' || page === '') return 'index';
  if (page === 'createPost' || /^\/createPost\//.test(path)) return 'create';
  if (page === 'archiv') return 'archiv';
  if (page === 'listCurrentPosts') return 'list_posts';
  if (page === 'mostReadPosts' || path === '/blogpost/most-read' || path.endsWith('/most-read')) return 'most_read';
  if (page === 'readPost' || /^\/blogpost\/(by-id\/\d+|\d+|[^\/]+)$/.test(path)) return 'read_post';
  if (page === 'about') return 'about';
  if (path === '/posts') return 'list_posts';

  // Fallback für unbekannte Seiten
  return 'index';
}

// ===========================================
// VEREINFACHTE SEITEN-INITIALISIERUNGEN
// ===========================================

// Create Page - vereinfacht
async function initializeCreatePage() {

  try {
    // Dynamically import editor + AI assistant only on create page
    if (!initializeBlogEditor) {
      try {
  const v = (typeof getAssetVersion === 'function' && getAssetVersion()) || 'v1';
  const mod = await import(`./tinymce/tinymce-editor.js?v=${encodeURIComponent(v)}`);
        // Use only the high-level initializer to ensure admin gating and full wiring
        if (typeof mod.initializeBlogEditor === 'function') {
          initializeBlogEditor = mod.initializeBlogEditor;
        } else {
          console.error('TinyMCE-Modul exportiert keine initializeBlogEditor()-Funktion. Editor-Initialisierung wird übersprungen.');
          initializeBlogEditor = async () => {};
        }
      } catch (err) {
        console.error('Fehler beim Laden des TinyMCE-Moduls:', err);
      }
    }

    // Admin-Status prüfen und UI anpassen FIRST
    // Use the safe server-injected flag if available. Do NOT rely on any injected secrets.
    const isAdmin = (typeof isAdminFromServer === 'function') ? !!isAdminFromServer() : false;
    if (!isAdmin) {
      hideElement('create-content');
      showElement('admin-required');
      return;  // Exit early if not admin
    }

    showElement('create-content');
    hideElement('admin-required');

    // IMPORTANT: Load AI assistant BEFORE tinymce-editor to ensure action registration
    // happens before click handlers are attached
    try {
      const aiMod = await import('./ai-assistant/ai-assistant.js');
      if (aiMod && typeof aiMod.initAiAssistant === 'function') {
        aiMod.initAiAssistant();
      }
    } catch (err) {
      console.error('Fehler beim Laden des AI-Assistant-Moduls:', err);
    }

    // NOW initialize TinyMCE editor (which attaches click handlers to already-registered actions)
    if (typeof initializeBlogEditor === 'function') {
      await initializeBlogEditor();
    }

  } catch (error) {
    console.error('Create Page Initialisierung fehlgeschlagen:', error);
  }
}

// Index Page - vereinfacht
async function initializeIndexPage() {

  try {
    // Posts laden
    const posts = await loadAllBlogPosts();
    if (posts && posts.length > 0) {
      // Sidebar-Elemente rendern
      if (typeof renderSidebarArchive === 'function') {
        try {
          await renderSidebarArchive(posts);
        } catch (err) {
          console.error('initializeIndexPage: renderSidebarArchive threw:', err);
        }
      }

      if (typeof renderPopularPostsSidebar === 'function') {
        try {
          await renderPopularPostsSidebar(posts);
        } catch (err) {
          console.error('initializeIndexPage: renderPopularPostsSidebar threw:', err);
        }
      }
    }

    // Cards laden only if the page contains a cards container or the renderer is present
  // Support multiple possible containers used across templates (discoveries-grid is used on index.ejs)
  const hasCardsContainer = document.getElementById('cards-container') || document.getElementById('cards') || document.querySelector('.cards-list') || document.getElementById('discoveries-grid');
    if (hasCardsContainer) {
      const cards = await loadCards();
      if (cards && cards.length > 0) {
        if (typeof renderAndDisplayCards === 'function') {
          await renderAndDisplayCards(cards);
        }
      } else {
        console.info('No cards available - skipping card rendering');
      }
    }

  } catch (error) {
    console.error('Index Page Initialisierung fehlgeschlagen:', error);
  }
}

// Archiv Page - vereinfacht
async function initializeArchivePage() {

  try {
    await loadAndDisplayArchivePosts();
  } catch (error) {
    console.error('Archiv Page Initialisierung fehlgeschlagen:', error);
  }
}

// Recent Posts - vereinfacht
async function initializeRecentPostsPage() {
  try {
    await loadAndDisplayRecentPosts();
  } catch (error) {
    console.error('initializeRecentPostsPage: Error occurred:', error);
    console.error('Recent Posts Initialisierung fehlgeschlagen:', error);
  }
}

// Most Read Posts - vereinfacht
async function initializeMostReadPostsPage() {
  try {
    await loadAndDisplayMostReadPosts();
  } catch (error) {
    console.error('Most Read Posts Initialisierung fehlgeschlagen:', error);
  }
}

// Read Post Page - vereinfacht
async function initializeReadPostPage() {
  try {
    // Post laden
    await loadAndDisplayBlogPost();

    // Admin-Controls hinzufügen (vereinfacht)
    setTimeout(async () => {
      if (typeof addReadPostAdminControls === 'function') {
        addReadPostAdminControls();
      }
      // Additionally run a short retry loop to handle late-arriving admin status or postId
      if (typeof ensureAdminControls === 'function') {
        ensureAdminControls({ attempts: 6, intervalMs: 400 });
      }

      // Kommentare aktivieren: remove the utility 'hidden' class (CSS uses !important)
      const commentsSection = document.getElementById('comments-section');
      if (commentsSection) {
        commentsSection.classList.remove('hidden');
        if (typeof initializeCommentsSystem === 'function') {
          // initializeCommentsSystem will attach event handlers and load comments
          initializeCommentsSystem();
        }
      }
    }, 500); // Kurze Verzögerung für DOM-Updates

  } catch (error) {
    console.error('Read Post Page Initialisierung fehlgeschlagen:', error);
  }
}

// ===========================================
// LEGACY CODE - WIRD NICHT MEHR VERWENDET
// Kann später entfernt werden
// ===========================================

// Export the initializers so other modules/importers can use them directly
export {
  initializeCreatePage,
  initializeIndexPage,
  initializeArchivePage,
  initializeRecentPostsPage,
  initializeMostReadPostsPage,
  initializeReadPostPage,
  initializeCurrentPage as initializePage,
  getCurrentPageType,
};

// Backwards compatibility note: legacy consumers that relied on
// `window.pageInitializers` or `window.moduleLoader` should be updated
// to import the named exports above. This keeps the module ESM-only and
// avoids creating new globals.