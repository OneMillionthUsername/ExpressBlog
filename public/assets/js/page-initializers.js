// Create Page Initialisierung
async function initializeCreatePageComplete() {
    try {        
        // TinyMCE Editor
        if (typeof initializeCreatePage === 'function') {
            await initializeCreatePage();
        } else {
            console.warn('initializeCreatePage Funktion nicht verfügbar');
        }        
    } catch (error) {
        console.error('Fehler bei der Create Page Initialisierung:', error);
    }
    // Create Page Admin Protection und Initialisierung
    async function initializeCreatePage() {
        // Prüfe Admin-Status und zeige entsprechenden Inhalt
        hideElement('create-content');
        hideElement('admin-required');
        if (isAdminLoggedIn) {
            // Admin ist eingeloggt - zeige Create-Formular
            showElement('create-content');
            // Editor und API-Keys NUR jetzt initialisieren!
            if (typeof initializeBlogEditor === 'function') {
                await initializeBlogEditor();
            }
        } else {
            // Kein Admin - zeige Warnung
            showElement('admin-required');
        }
        
        // Navigation-Sichtbarkeit aktualisieren
        updateNavigationVisibility();
    }
}

// Index Page Initialisierung
async function initializeIndexPageComplete() {
    try {
        const posts = await loadAllBlogPosts();
        const cards = await loadCards();

        if(!posts || posts.length === 0) {
            console.warn('Keine Posts gefunden');
        }
        if (typeof renderSidebarArchive === 'function') {
            await renderSidebarArchive(posts);
        }
        if (typeof renderPopularPostsSidebar === 'function') {
            await renderPopularPostsSidebar(posts);
        }
        if(!cards || cards.length === 0) {
            console.warn('Keine Cards gefunden');
        }
        if(typeof renderAndDisplayCards === 'function') {
            await renderAndDisplayCards(cards);
        }
    } catch (error) {
        console.error('Fehler bei der Index Page Initialisierung:', error);
    }
}

// Archiv Page Initialisierung
async function initializeArchivePageComplete() {
    try {
        if (typeof loadAndDisplayArchivePosts === 'function') {
            await loadAndDisplayArchivePosts();
        } else {
            console.warn('loadAndDisplayArchivePosts Funktion nicht verfügbar');
        }
    } catch (error) {
        console.error('Fehler bei der Archiv Page Initialisierung:', error);
    }
}

// Recent Posts Page Initialisierung
async function initializeRecentPostsPageComplete() {
    try {
        if (typeof loadAndDisplayRecentPosts === 'function') {
            await loadAndDisplayRecentPosts();
        } else {
            console.warn('loadAndDisplayRecentPosts Funktion nicht verfügbar');
        }
    } catch (error) {
        console.error('Fehler bei der Recent Posts Page Initialisierung:', error);
    }
}

// Most Read Posts Page Initialisierung
async function initializeMostReadPostsPageComplete() {
    try {
        if (typeof loadAndDisplayMostReadPosts === 'function') {
            await loadAndDisplayMostReadPosts();
        } else {
            console.warn('loadAndDisplayMostReadPosts Funktion nicht verfügbar');
        }
    } catch (error) {
        console.error('Fehler bei der Most Read Posts Page Initialisierung:', error);
    }
}

// Read Post Page Initialisierung
async function initializeReadPostPageComplete() {
    try {
        if (typeof loadAndDisplayBlogPost === 'function') {
            await loadAndDisplayBlogPost();
        } else {
            console.warn('loadAndDisplayBlogPost Funktion nicht verfügbar');
        }

        // Admin-Controls und Kommentarsystem nach dem Laden des Posts
        function waitForElement(selector, callback, interval = 100, maxTries = 20) {
            let tries = 0;
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    callback(el);
                } else if (++tries >= maxTries) {
                    clearInterval(timer);
                    console.warn(`Element ${selector} nicht gefunden.`);
                }
            }, interval);
        }

        waitForElement('#admin-controls', addReadPostAdminControls);
        waitForElement('#comments-section', (el) => {
            el.style.display = 'block';
            if (typeof initializeCommentsSystem === 'function') {
                initializeCommentsSystem();
            }
        });

    } catch (error) {
        console.error('Fehler bei der Read Post Page Initialisierung:', error);
    }
}

// Export für andere Dateien
window.pageInitializers = {
    create: initializeCreatePageComplete,
    index: initializeIndexPageComplete,
    archiv: initializeArchivePageComplete,
    list_posts: initializeRecentPostsPageComplete,
    most_read: initializeMostReadPostsPageComplete,
    read_post: initializeReadPostPageComplete
};

document.addEventListener('DOMContentLoaded', function() {
    if (typeof addAdminMenuItemToNavbar === 'function') {
        addAdminMenuItemToNavbar();
    }

    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    window.moduleLoader.onAllLoaded(async () => {
        // standardmäßige Initialisierung
        if (typeof initializeAdminSystem === 'function') {
            await initializeAdminSystem();   
            if (typeof addAdminMenuItemToNavbar === 'function') {
                addAdminMenuItemToNavbar();
        }
        }
        if (typeof initializeBlogUtilities === 'function') {
            await initializeBlogUtilities();
        }
        // Dann die page-spezifische Initialisierung
        switch(currentPage) {
            case 'create':
                window.pageInitializers.create();
                break;
            case 'index':
            case '':
                window.pageInitializers.index();
                break;
            case 'archiv':
                window.pageInitializers.archiv();
                break;
            case 'list_posts':
                window.pageInitializers.list_posts();
                break;
            case 'most_read':
                window.pageInitializers.most_read();
                break;
            case 'read_post':
                window.pageInitializers.read_post();
                break;
            default:
                console.log(`Keine spezifische Initialisierung für ${currentPage}`);
        }       
        if (typeof addAdminMenuItemToNavbar === 'function') {
            addAdminMenuItemToNavbar();
        }
    });
});