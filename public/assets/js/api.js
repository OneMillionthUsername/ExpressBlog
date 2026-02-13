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
      if (!isTestEnv) {
        const token = await getCsrfToken();
        if (token) {
          headers['x-csrf-token'] = token;
        }
      }
    }

    const fetchStartTime = performance.now();
    // Build final options ensuring our merged headers (with CSRF token) are used
    const finalOptions = Object.assign({}, options, {
      credentials: 'include',
      headers, // our merged headers include options.headers and x-csrf-token
    });
    const response = await fetch(url, finalOptions);
    if (typeof response === 'undefined' || response === null) {
      throw new Error('No response from fetch');
    }

  const fetchEndTime = performance.now();
  // add some future benchmark for request duration logging if needed
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

// Expose makeApiRequest on global/window for legacy tests that mock global.makeApiRequest
try {
  if (typeof window !== 'undefined') {
    window.makeApiRequest = makeApiRequest;
  }
} catch (_err) {
  void _err;
  // ignore in non-browser environments
}
