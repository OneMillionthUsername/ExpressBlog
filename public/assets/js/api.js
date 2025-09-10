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
  console.debug(`[${requestId}] makeApiRequest: Starting request`, {
    url,
    method: options.method || 'GET',
    has_body: !!options.body,
    current_location: window.location.href,
    user_agent: navigator.userAgent.substring(0, 100)
  });
  
  try {
    const method = options.method || 'GET';
    let headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      console.debug(`[${requestId}] makeApiRequest: Getting CSRF token for ${method} request`);
      const token = await getCsrfToken();
      if (token) {
        headers['x-csrf-token'] = token;
        console.debug(`[${requestId}] makeApiRequest: CSRF token added to headers`);
      } else {
        console.debug(`[${requestId}] makeApiRequest: Warning - No CSRF token available`);
      }
    }

    console.debug(`[${requestId}] makeApiRequest: Making fetch request`, {
      final_headers: headers,
      credentials: 'include',
      full_options: { ...options, headers }
    });

    const fetchStartTime = performance.now();
    const response = await fetch(url, {
      credentials: 'include',
      headers,
      ...options,
    });
    const fetchEndTime = performance.now();
    const fetchDuration = Math.round(fetchEndTime - fetchStartTime);

    console.debug(`[${requestId}] makeApiRequest: Fetch completed`, {
      status: response.status,
      status_text: response.statusText,
      ok: response.ok,
      fetch_duration_ms: fetchDuration,
      response_headers: response.headers ? Object.fromEntries(response.headers.entries()) : 'Headers not available',
      content_type: response.headers ? response.headers.get('content-type') : 'Content-Type not available'
    });

    let result;
    try {
      console.debug(`[${requestId}] makeApiRequest: Parsing JSON response`);
      result = await response.json();
      console.debug(`[${requestId}] makeApiRequest: JSON parsed successfully`, {
        result_type: typeof result,
        result_is_array: Array.isArray(result),
        result_keys: typeof result === 'object' && result !== null ? Object.keys(result) : 'N/A'
      });
    } catch (jsonError) {
      console.debug(`[${requestId}] makeApiRequest: JSON parsing failed`, {
        json_error: jsonError.message,
        response_text_preview: 'Text parsing not available in test environment'
      });
      result = null;
    }

    if (!response.ok) {
      console.debug(`[${requestId}] makeApiRequest: Request failed`, {
        status: response.status,
        error: result?.error || response.statusText,
        full_result: result
      });
      
      if (response.status === 403 && result?.error?.includes('csrf')) {
        console.debug(`[${requestId}] makeApiRequest: CSRF error detected - resetting token`);
        csrfToken = null;
      }

      return {
        success: false,
        error: result?.error || response.statusText,
        status: response.status,
      };
    }

    console.debug(`[${requestId}] makeApiRequest: Request successful`, {
      final_result_type: typeof result,
      final_result_preview: JSON.stringify(result).substring(0, 200)
    });

    // Konsistente Rückgabe für erfolgreiche Requests
    return {
      success: true,
      data: result,
      status: response.status,
    };
  } catch (error) {
    console.debug(`[${requestId}] makeApiRequest: Exception caught`, {
      error_message: error.message,
      error_name: error.name,
      error_stack: error.stack?.substring(0, 500)
    });
    throw new Error(`API-Request fehlgeschlagen: ${error.message}`, error);
  }
}

// CSRF-Token zurücksetzen (z.B. bei Session-Timeout)
export function resetCsrfToken() {
  csrfToken = null;
}

// Blog-Posts laden
export async function loadAllBlogPosts() {
  console.debug('loadAllBlogPosts: Funktion gestartet');
  
  try {
    console.debug('loadAllBlogPosts: Bereite API-Request vor', {
      endpoint: '/blogpost/all',
      method: 'GET',
      timestamp: new Date().toISOString()
    });

    const startTime = performance.now();
    const result = await makeApiRequest('/blogpost/all');
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    console.debug('loadAllBlogPosts: API-Request abgeschlossen', {
      duration_ms: duration,
      result_success: result.success,
      result_status: result.status,
      result_has_data: !!result.data,
      result_data_type: typeof result.data,
      full_result: result
    });

    if (!result.success) {
      console.debug('loadAllBlogPosts: API-Request fehlgeschlagen - Details:', {
        error: result.error,
        status: result.status,
        error_type: typeof result.error
      });
      console.error('API Error loading blog posts:', result.error, 'Status:', result.status);
      throw new Error(`Failed to load blog posts: ${result.error}`);
    }

    const posts = result.data;
    console.debug('loadAllBlogPosts: Verarbeite Antwortdaten', {
      posts_type: typeof posts,
      posts_is_array: Array.isArray(posts),
      posts_length: Array.isArray(posts) ? posts.length : 'N/A',
      posts_constructor: posts?.constructor?.name,
      first_post_sample: Array.isArray(posts) && posts.length > 0 ? {
        id: posts[0].id,
        title: posts[0].title?.substring(0, 50) + '...',
        slug: posts[0].slug,
        has_content: !!posts[0].content,
        created_at: posts[0].created_at
      } : null
    });

    if (!Array.isArray(posts)) {
      console.debug('loadAllBlogPosts: Fehler - Antwort ist kein Array', {
        actual_type: typeof posts,
        actual_constructor: posts?.constructor?.name,
        actual_value_preview: JSON.stringify(posts).substring(0, 200)
      });
      throw new Error('Response is not an array');
    }

    if (posts.length === 0) {
      console.debug('loadAllBlogPosts: Keine Blog-Posts gefunden - zeige leeren Zustand');
      return [];
    }

    if (posts.length > 100) {
      console.debug('loadAllBlogPosts: Warnung - Mehr als 100 Blog-Posts gefunden', {
        exact_count: posts.length,
        performance_warning: 'Dies könnte die Ladezeit beeinträchtigen'
      });
      const loadingElement = document.getElementById('loading');
      if (loadingElement) {
        console.debug('loadAllBlogPosts: Zeige Performance-Warnung im UI');
        loadingElement.innerHTML = `
          <p class="warning-message">
            Mehr als 100 Blog-Posts gefunden. Dies kann eine Weile dauern, um sie alle zu laden.
          </p>
        `;
      } else {
        console.debug('loadAllBlogPosts: Loading-Element nicht gefunden - kann Warnung nicht anzeigen');
      }
    }

    console.debug('loadAllBlogPosts: Erfolgreich abgeschlossen', {
      returned_posts_count: posts.length,
      final_data_type: typeof posts,
      execution_completed: true
    });

    return posts;
  } catch (error) {
    console.debug('loadAllBlogPosts: Fehler aufgetreten', {
      error_message: error.message,
      error_type: error.constructor.name,
      error_stack: error.stack?.substring(0, 500),
      fallback_action: 'Rückgabe eines leeren Arrays'
    });
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