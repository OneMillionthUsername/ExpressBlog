// Cache für CSRF-Token
let csrfToken = null;

// CSRF-Token abrufen
async function getCsrfToken() {
  if (csrfToken) return csrfToken;

  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include',
    });
    const data = await response.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  } catch (error) {
    console.error('Fehler beim Abrufen des CSRF-Tokens:', error);
    return null;
  }
}

export async function makeApiRequest(url, options = {}) {
  try {
    const method = options.method || 'GET';
    let headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      const token = await getCsrfToken();
      if (token) {
        headers['x-csrf-token'] = token;
      }
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers,
      ...options,
    });

    let result;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      if (response.status === 403 && result?.error?.includes('csrf')) {
        csrfToken = null;
      }

      return {
        success: false,
        error: result?.error || response.statusText,
        status: response.status,
      };
    }

    // Konsistente Rückgabe für erfolgreiche Requests
    return {
      success: true,
      data: result,
      status: response.status,
    };
  } catch (error) {
    throw new Error(`API-Request fehlgeschlagen: ${error.message}`, error);
  }
}

// CSRF-Token zurücksetzen (z.B. bei Session-Timeout)
export function resetCsrfToken() {
  csrfToken = null;
}

// Blog-Posts laden
export async function loadAllBlogPosts() {
  try {
    const result = await makeApiRequest('/blogpost/all');

    if (!result.success) {
      console.error('API Error loading blog posts:', result.error, 'Status:', result.status);
      throw new Error(`Failed to load blog posts: ${result.error}`);
    }

    const posts = result.data;

    if (!Array.isArray(posts)) {
      throw new Error('Response is not an array');
    }

    if (posts.length === 0) {
      console.info('No blog posts found - showing empty state');
      return [];
    }

    if (posts.length > 100) {
      console.warn('More than 100 blog posts found, this might take a while to load');
      const loadingElement = document.getElementById('loading');
      if (loadingElement) {
        loadingElement.innerHTML = `
          <p class="warning-message">
            Mehr als 100 Blog-Posts gefunden. Dies kann eine Weile dauern, um sie alle zu laden.
          </p>
        `;
      }
    }

    return posts;
  } catch (error) {
    console.error('Fehler beim Laden der Blog-Posts:', error);
    // Bei Fehlern ein leeres Array zurückgeben statt zu re-throwen
    // So können andere Teile der Seite trotzdem laden
    return [];
  }
}

// Cards laden (placeholder - keine API-Route implementiert)
export async function loadCards() {
  try {
    // TODO: Implementiere /cards API-Route im Backend
    console.info('Cards API not implemented yet - returning empty array');
    return [];
  } catch (error) {
    console.error('Fehler beim Laden der Cards:', error);
    return [];
  }
}

// CSRF-Token regelmäßig aktualisieren (alle 30 Minuten)
setInterval(async () => {
  csrfToken = null; // Token zurücksetzen, damit es beim nächsten Request neu abgerufen wird
}, 30 * 60 * 1000);