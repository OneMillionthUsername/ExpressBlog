/* Shared text utilities usable in both browser and server (ESM only). */

// Decode common HTML entities (named + numeric). Safe to use before inserting
// into templates that will escape output again.
export function decodeHtmlEntities(input = '') {
  let s = String(input);
  // numeric decimal entities
  s = s.replace(/&#(\d+);/g, (_, dec) => {
    try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return _; }
  });
  // numeric hex entities
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return _; }
  });
  // selected named entities
  const map = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': '\'', '&apos;': '\'',
    '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&hellip;': '…',
    '&lsquo;': '‘', '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”',
    '&laquo;': '«', '&raquo;': '»',
    '&auml;': 'ä', '&ouml;': 'ö', '&uuml;': 'ü', '&Auml;': 'Ä', '&Ouml;': 'Ö', '&Uuml;': 'Ü', '&szlig;': 'ß',
  };
  return s.replace(/(&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;|&ndash;|&mdash;|&hellip;|&lsquo;|&rsquo;|&ldquo;|&rdquo;|&laquo;|&raquo;|&auml;|&ouml;|&uuml;|&Auml;|&Ouml;|&Uuml;|&szlig;)/g, m => map[m] || m);
}

// Minimal HTML escaper for text content
export function escapeHtml(str = '') {
  const s = String(str);
  const map = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return s.replace(/[&<>"']/g, ch => map[ch]);
}
