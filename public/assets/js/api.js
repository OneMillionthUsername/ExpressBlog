
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
    // CSRF-Token für POST/PUT/DELETE/PATCH Requests abrufen
    const method = options.method || 'GET';
    let headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      const token = await getCsrfToken();
      if (token) {
        headers['x-csrf-token'] = token;
      }
    }

    const response = await fetch(url, {
      credentials: 'include', // sendet Cookies mit
      headers,
      ...options,
    });

    // Versuche, JSON zu parsen, falls vorhanden
    let result;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      // Bei CSRF-Fehlern Token zurücksetzen
      if (response.status === 403 && result?.error?.includes('csrf')) {
        csrfToken = null;
      }

      return {
        success: false,
        error: result?.error || response.statusText,
        status: response.status,
      };
    }

    return result;
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

    const posts = result;

    if (!Array.isArray(posts)) {
      throw new Error('Response is not an array');
    }

    if (posts.length === 0) {
      console.warn('No blog posts found');
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
    throw error; // Re-throw error instead of returning empty array
  }
}

// CSRF-Token regelmäßig aktualisieren (alle 30 Minuten)
setInterval(async () => {
  csrfToken = null; // Token zurücksetzen, damit es beim nächsten Request neu abgerufen wird
}, 30 * 60 * 1000);