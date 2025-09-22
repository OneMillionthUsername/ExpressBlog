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
import { initializeAdminSystem, addAdminMenuItemToNavbar, initializeAdminDelegation } from './admin.js';
import { initializeBlogUtilities, initializeCommonDelegation } from './common.js';
import { initializeCommentsDelegation, initializeCommentsSystem } from './comments.js';

// Admin- und Kommentar-Funktionen bleiben optional (typeof checks)
// da sie aus separaten Modulen kommen können

// Globale Initialisierung - einmalig beim DOM-Ready
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // 1. Admin-System initialisieren (immer zuerst)
    if (typeof initializeAdminSystem === 'function') {
      await initializeAdminSystem();
    }

    // 2. Admin-Menü hinzufügen (einmalig)
    if (typeof addAdminMenuItemToNavbar === 'function') {
      addAdminMenuItemToNavbar();
    }

    // 3. Blog-Utilities initialisieren
    if (typeof initializeBlogUtilities === 'function') {
      await initializeBlogUtilities();
    }

    // Initialize common delegation (data-action handlers)
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
  if (page === 'createPost') return 'create';
  if (page === 'archiv') return 'archiv';
  if (page === 'listCurrentPosts') return 'list_posts';
  if (page === 'mostReadPosts') return 'most_read';
  if (page === 'readPost') return 'read_post';
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
        const mod = await import('./tinymce/tinymce-editor.js');
        // module exports initialize function under several names; support both
        initializeBlogEditor = mod.initializeTinyMCE || mod.initializeBlogEditor || mod.initializeCreatePage || mod.initializeCreatePage;
      } catch (err) {
        console.error('Fehler beim Laden des TinyMCE-Moduls:', err);
      }
    }

    if (typeof initializeBlogEditor === 'function') {
      await initializeBlogEditor();
    }

    // Admin-Status prüfen und UI anpassen
    // Use the safe server-injected flag if available. Do NOT rely on any injected secrets.
    const isAdmin = (typeof window !== 'undefined' && window.__SERVER_CONFIG && window.__SERVER_CONFIG.isAdmin) ? !!window.__SERVER_CONFIG.isAdmin : false;
    if (isAdmin) {
      showElement('create-content');
      hideElement('admin-required');

      // Lazy-load AI assistant only for admins (separate module)
      try {
        import('./ai-assistant/ai-assistant.js')
          .then(m => {
            if (m && typeof m.initAiAssistant === 'function') {
              m.initAiAssistant();
            }
          })
          .catch(err => console.error('Fehler beim Laden des AI-Assistant-Moduls:', err));
      } catch (err) {
        console.error('Dynamischer Import für AI-Assistant fehlgeschlagen:', err);
      }

    } else {
      hideElement('create-content');
      showElement('admin-required');
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
          console.debug('initializeIndexPage: calling renderSidebarArchive, posts.length=', posts.length);
          await renderSidebarArchive(posts);
        } catch (err) {
          console.error('initializeIndexPage: renderSidebarArchive threw:', err);
        }
      }

      if (typeof renderPopularPostsSidebar === 'function') {
        try {
          console.debug('initializeIndexPage: calling renderPopularPostsSidebar, posts.length=', posts.length);
          // Sanity-check: ensure target container exists (function may be no-op if missing)
          const popularEl = document.getElementById('popular-posts');
          if (!popularEl) console.info('initializeIndexPage: #popular-posts element not found in DOM');
          await renderPopularPostsSidebar(posts);
        } catch (err) {
          console.error('initializeIndexPage: renderPopularPostsSidebar threw:', err);
        }
      }
    } else {
      console.info('No posts available - skipping sidebar rendering');
    }

    // Cards laden
    const cards = await loadCards();
    if (cards && cards.length > 0) {
      if (typeof renderAndDisplayCards === 'function') {
        await renderAndDisplayCards(cards);
      }
    } else {
      console.info('No cards available - skipping card rendering');
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
    setTimeout(() => {
      const adminControls = document.getElementById('admin-controls');
      if (adminControls) {
        addReadPostAdminControls();
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