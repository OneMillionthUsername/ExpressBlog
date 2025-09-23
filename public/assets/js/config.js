// Read SSR-injected configuration from a non-executable JSON script tag
// <script id="server-config" type="application/json">{"isAdmin":true}</script>

let _config = null;

function readServerConfig() {
  if (typeof document === 'undefined') return {};
  try {
    const el = document.getElementById('server-config');
    if (!el) return {};
    const text = (el.textContent || el.innerText || '').trim();
    if (text) {
      try {
        // Some browser extensions may inject wrapping comments or noise. Try to locate JSON braces.
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        const candidate = (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace)
          ? text.slice(firstBrace, lastBrace + 1)
          : text;
        return JSON.parse(candidate);
      } catch { /* ignore and use data-* fallback */ }
    }
    // Fallback: read from data-* attributes if provided
    const ds = el.dataset || {};
    const isAdmin = String(ds.isAdmin || '').toLowerCase() === 'true';
    const assetVersion = String(ds.assetVersion || '');
    return { isAdmin, assetVersion };
  } catch {
    return {};
  }
}

export function getServerConfig() {
  if (_config) return _config;
  _config = readServerConfig();
  return _config;
}

export function isAdminFromServer() {
  const cfg = getServerConfig();
  return !!(cfg && cfg.isAdmin);
}

export function getAssetVersion() {
  const cfg = getServerConfig();
  return (cfg && typeof cfg.assetVersion === 'string') ? cfg.assetVersion : '';
}
