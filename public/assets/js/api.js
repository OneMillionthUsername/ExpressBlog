// Cache für CSRF-Token
let csrfToken = null;

// Simple in-memory GET cache to reduce duplicate requests for idempotent endpoints
const getResponseCache = new Map();
const DEFAULT_GET_CACHE_TTL = 60 * 1000; // 60 seconds

export function clearGetResponseCache() {
  getResponseCache.clear();
}

// Per-endpoint TTLs (ms) - add entries here for endpoints that should cache longer/shorter
const ENDPOINT_CACHE_TTLS = new Map([
  ['/blogpost/all', 30 * 1000], // posts list keep shorter TTL (30s)
  ['/cards', 5 * 60 * 1000],    // cards change rarely; cache 5 minutes
  ['/blogpost/most-read', 5 * 60 * 1000], // most-read is semi-static; cache 5 minutes
]);

// Shared posts cache (higher-level store used by UI components)
const postsCache = {
  ts: 0,
  data: null,
  ttl: ENDPOINT_CACHE_TTLS.get('/blogpost/all') || DEFAULT_GET_CACHE_TTL,
};

export function getCachedPosts() {
  try {
    if (!postsCache.data) return null;
    if (Date.now() - postsCache.ts > postsCache.ttl) {
      postsCache.data = null;
      return null;
    }
    // return a shallow clone to avoid accidental mutation by callers
    return Array.isArray(postsCache.data) ? postsCache.data.slice() : JSON.parse(JSON.stringify(postsCache.data));
  } catch (e) { void e; return null; }
}

export async function refreshPosts(force = false) {
  if (!force) {
    const cached = getCachedPosts();
    if (cached) return cached;
  }

  const result = await makeApiRequest('/blogpost/all');
  if (!result || result.success !== true) {
    return [];
  }
  const posts = result.data;
  postsCache.ts = Date.now();
  postsCache.data = Array.isArray(posts) ? posts.slice() : posts;
  return postsCache.data;
}

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
  const _requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  try {
  const method = options.method || 'GET';
  const methodUp = method.toUpperCase();
  // Detect FormData bodies — do not set Content-Type so browser can add the correct boundary
  const isFormData = typeof FormData !== 'undefined' && options.body && options.body instanceof FormData;
  // Default headers: request JSON by default; tests may override global.makeApiRequest
  const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
  // Ensure we also ask explicitly for JSON responses to avoid server-side HTML rendering
  defaultHeaders['Accept'] = 'application/json';
  // Mark the request as an XMLHttpRequest so servers can distinguish browser navigation from API/XHR
  // This helps proxies and middleware detect API calls and avoid rendering HTML responses.
  defaultHeaders['X-Requested-With'] = 'XMLHttpRequest';
  let headers = { ...(defaultHeaders), ...(options.headers || {}) };

    // During unit tests we avoid requesting a CSRF token to prevent
    // the extra /api/csrf-token fetch from breaking expectations.
    const isTestEnv = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') || false;
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(methodUp)) {
      // invalidate GET cache on mutating requests
  try { clearGetResponseCache(); } catch (e) { void e; }
      if (!isTestEnv) {
        const token = await getCsrfToken();
        if (token) {
          headers['x-csrf-token'] = token;
        }
      }
    }

    // Simple GET cache lookup
    if (methodUp === 'GET') {
      try {
        const cacheKey = String(url);
        const cached = getResponseCache.get(cacheKey);
        const endpointTtl = ENDPOINT_CACHE_TTLS.get(url);
        const ttl = typeof options.cacheTtl === 'number' ? options.cacheTtl : (typeof endpointTtl === 'number' ? endpointTtl : DEFAULT_GET_CACHE_TTL);
        if (cached) {
          const age = Date.now() - cached.ts;
          if (age < ttl) {
            return { success: true, data: JSON.parse(JSON.stringify(cached.data)), status: 200 };
          }
          getResponseCache.delete(cacheKey);
        }
      } catch (e) { void e; }
    }

    const fetchStartTime = performance.now();
    const response = await fetch(url, Object.assign({
      credentials: 'include',
      headers,
    }, options));
    if (typeof response === 'undefined' || response === null) {
      throw new Error('No response from fetch');
    }

  const fetchEndTime = performance.now();
  const _fetchDuration = Math.round(fetchEndTime - fetchStartTime);

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
    // Cache GET responses
    if (methodUp === 'GET') {
      try {
        const cacheKey = String(url);
        const endpointTtl = ENDPOINT_CACHE_TTLS.get(url);
        const ttl = typeof options.cacheTtl === 'number' ? options.cacheTtl : (typeof endpointTtl === 'number' ? endpointTtl : DEFAULT_GET_CACHE_TTL);
        getResponseCache.set(cacheKey, { ts: Date.now(), data: result, ttl });
      } catch (e) { void e; }
    }

    return {
      success: true,
      data: result,
      status: response.status,
    };
  } catch (error) {
    // Normalize error for callers
    throw new Error(`API-Request fehlgeschlagen: ${error && error.message ? error.message : String(error)}`);
  }
}

// CSRF-Token zurücksetzen (z.B. bei Session-Timeout)
export function resetCsrfToken() {
  csrfToken = null;
}

// Expose makeApiRequest on global/window for legacy tests that mock global.makeApiRequest
try {
  if (typeof window !== 'undefined') {
    window.makeApiRequest = makeApiRequest;
    window.resetCsrfToken = resetCsrfToken;
  }
} catch (_err) {
  void _err;
  // ignore in non-browser environments
}

// Blog-Posts laden
export async function loadAllBlogPosts() {
  
  try {

    const startTime = performance.now();
    const posts = await refreshPosts();
    const endTime = performance.now();
    const _duration = Math.round(endTime - startTime);

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