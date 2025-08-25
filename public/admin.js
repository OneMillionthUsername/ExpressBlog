// Admin-System für den Blog
// Alle admin-bezogenen Funktionen sind hier zentralisiert
import { makeApiRequest } from "../utils/utils";
// Admin-Status Variable (muss vor allen Funktionen stehen)
let isAdminLoggedIn = false;
let currentUser = null;
// Admin-Status Caching
let adminStatusPromise = null;

// Admin-Status über HTTP-only Cookie prüfen
async function verifyAdminStatus() {
    try {
        const result = await makeApiRequest('/auth/verify', {
            method: 'POST'
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
            method: 'POST'
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
// TODO finish admin.js