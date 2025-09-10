// ===========================================
// EINFACHES & ROBUSTES PAGE INITIALISIERUNGSSYSTEM
// ===========================================

import { loadAllBlogPosts, loadCards } from './api.js';

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

    // 4. Seiten-spezifische Initialisierung
    await initializeCurrentPage();

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
        console.log('About-Seite geladen - keine spezielle Initialisierung');
        break;
      default:
        console.log(`Standard-Initialisierung für: ${currentPage}`);
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

  // Fallback für unbekannte Seiten
  console.log(`Unbekannte Seite erkannt: ${page} (Pfad: ${path})`);
  return 'index';
}

// ===========================================
// VEREINFACHTE SEITEN-INITIALISIERUNGEN
// ===========================================

// Create Page - vereinfacht
async function initializeCreatePage() {
  console.log('Initialisiere Create Page...');

  try {
    // Editor initialisieren (falls verfügbar)
    if (typeof initializeBlogEditor === 'function') {
      await initializeBlogEditor();
    }

    // Admin-Status prüfen und UI anpassen
    if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) {
      showElement('create-content');
      hideElement('admin-required');
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
  console.log('Initialisiere Index Page...');

  try {
    // Posts laden
    const posts = await loadAllBlogPosts();
    if (posts && posts.length > 0) {
      // Sidebar-Elemente rendern
      if (typeof renderSidebarArchive === 'function') {
        await renderSidebarArchive(posts);
      }
      if (typeof renderPopularPostsSidebar === 'function') {
        await renderPopularPostsSidebar(posts);
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
  console.log('Initialisiere Archiv Page...');

  try {
    if (typeof loadAndDisplayArchivePosts === 'function') {
      await loadAndDisplayArchivePosts();
    }
  } catch (error) {
    console.error('Archiv Page Initialisierung fehlgeschlagen:', error);
  }
}

// Recent Posts - vereinfacht
async function initializeRecentPostsPage() {
  console.log('Initialisiere Recent Posts Page...');

  try {
    if (typeof loadAndDisplayRecentPosts === 'function') {
      await loadAndDisplayRecentPosts();
    }
  } catch (error) {
    console.error('Recent Posts Initialisierung fehlgeschlagen:', error);
  }
}

// Most Read Posts - vereinfacht
async function initializeMostReadPostsPage() {
  console.log('Initialisiere Most Read Posts Page...');

  try {
    if (typeof loadAndDisplayMostReadPosts === 'function') {
      await loadAndDisplayMostReadPosts();
    }
  } catch (error) {
    console.error('Most Read Posts Initialisierung fehlgeschlagen:', error);
  }
}

// Read Post Page - vereinfacht
async function initializeReadPostPage() {
  console.log('Initialisiere Read Post Page...');

  try {
    // Post laden
    if (typeof loadAndDisplayBlogPost === 'function') {
      await loadAndDisplayBlogPost();
    }

    // Admin-Controls hinzufügen (vereinfacht)
    setTimeout(() => {
      const adminControls = document.getElementById('admin-controls');
      if (adminControls) {
        addReadPostAdminControls();
      }

      // Kommentare aktivieren
      const commentsSection = document.getElementById('comments-section');
      if (commentsSection) {
        commentsSection.style.display = 'block';
        if (typeof initializeCommentsSystem === 'function') {
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

// Altes pageInitializers Objekt (für Abwärtskompatibilität)
window.pageInitializers = {
  create: initializeCreatePage,
  index: initializeIndexPage,
  archiv: initializeArchivePage,
  list_posts: initializeRecentPostsPage,
  most_read: initializeMostReadPostsPage,
  read_post: initializeReadPostPage,
};

// Fallback für altes moduleLoader System
window.moduleLoader = window.moduleLoader || {
  onAllLoaded: function(callback) {
    // Sofort ausführen (DOM ist bereits geladen)
    if (typeof callback === 'function') {
      callback();
    }
  }
};