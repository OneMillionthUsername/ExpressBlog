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
    const assetVersion = String(ds.assetVersion || ''); // version string for cache busting, er im Blog-System verwendet wird, um statische Dateien (wie CSS, JS, Bilder) zu versionieren. Wenn sich eine Datei ändert, kann die Version erhöht werden, damit Browser die aktualisierte Datei laden, anstatt eine zwischengespeicherte Version zu verwenden.
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
  /*
  Einfache Verneinung (!) macht aus einem truthy Wert false und aus einem falsy Wert true.
  Doppelte Verneinung (!!) macht aus jedem Wert exakt true oder false.
  cfg && cfg.isAdmin gibt entweder den Wert von cfg.isAdmin (wenn cfg existiert) oder undefined/false.
  !!(...) sorgt dafür, dass das Ergebnis immer ein Boolean ist.
  */
}

export function getAssetVersion() {
  const cfg = getServerConfig();
  return (cfg && typeof cfg.assetVersion === 'string') ? cfg.assetVersion : '';
}
