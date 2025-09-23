// Read SSR-injected configuration from a non-executable JSON script tag
// <script id="server-config" type="application/json">{"isAdmin":true}</script>

let _config = null;

function readServerConfig() {
  if (typeof document === 'undefined') return {};
  try {
    const el = document.getElementById('server-config');
    if (!el) return {};
    const text = el.textContent || el.innerText || '';
    if (!text) return {};
    return JSON.parse(text);
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
