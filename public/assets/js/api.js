
export async function makeApiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            credentials: 'include', // sendet Cookies mit
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        // Versuche, JSON zu parsen, falls vorhanden
        let result;
        try {
            result = await response.json();
        } catch {
            result = null;
        }
        if (!response.ok) {
            return { 
              success: false, 
              error: result?.error || response.statusText, 
              status: response.status 
            };
        }
        return result;
    } catch (error) {
        throw new Error(`API-Request fehlgeschlagen: ${error.message}`, error);
    }
}