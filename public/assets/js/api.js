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
  const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  try {
    const method = options.method || 'GET';
    let headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      const token = await getCsrfToken();
      if (token) {
        headers['x-csrf-token'] = token;
      } else {
      }
    }

    const fetchStartTime = performance.now();
    const response = await fetch(url, {
      credentials: 'include',
      headers,
      ...options,
    });
    const fetchEndTime = performance.now();
    const fetchDuration = Math.round(fetchEndTime - fetchStartTime);

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
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

    const startTime = performance.now();
    const result = await makeApiRequest('/blogpost/all');
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    if (!result.success) {
      console.error('API Error loading blog posts:', result.error, 'Status:', result.status);
      throw new Error(`Failed to load blog posts: ${result.error}`);
    }

    const posts = result.data;

    if (!Array.isArray(posts)) {
      throw new Error('Response is not an array');
    }

    if (posts.length === 0) {
      return [];
    }

    if (posts.length > 100) {
      const loadingElement = document.getElementById('loading');
      if (loadingElement) {
        loadingElement.innerHTML = `
          <p class="warning-message">
            Mehr als 100 Blog-Posts gefunden. Dies kann eine Weile dauern, um sie alle zu laden.
          </p>
        `;
      } else {
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

// Cards laden
export async function loadCards() {
  try {
    
    const apiResult = await makeApiRequest('/cards', { method: 'GET' });

    if (!apiResult || apiResult.success !== true) {
      console.warn('loadCards: API returned failure or unexpected envelope', apiResult);
      return [];
    }

    const response = apiResult.data;

    if (!response || !Array.isArray(response)) {
      console.warn('loadCards: Invalid response format', response);
      return [];
    }

    if (response.length === 0) {
      console.warn('No cards found');
      return [];
    }

    if (response.length > 9) {
      console.warn('More than nine cards found. Taking the most recent');
      // Kürze das Array auf die ersten 9 Elemente (neueste)
      response.splice(9);
    }

    return response;
  } catch (error) {
    console.error('Fehler beim Laden der Cards:', error);
    return [];
  }
}

// CSRF-Token regelmäßig aktualisieren (alle 30 Minuten)
setInterval(async () => {
  csrfToken = null; // Token zurücksetzen, damit es beim nächsten Request neu abgerufen wird
}, 30 * 60 * 1000);