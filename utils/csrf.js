import csrf from '@dr.pogodin/csurf';

// Intelligente SameSite-Konfiguration
const getSameSiteConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = process.env.DOMAIN;

  // Development: Immer 'strict' für maximale Sicherheit beim Entwickeln
  if (!isProduction) {
    return 'strict';
  }

  // Production: Prüfe auf bekannte Cross-Origin-Szenarien
  if (isProduction) {
    // Wenn DOMAIN gesetzt ist, gehe von Same-Origin aus
    if (domain && process.env.ALLOW_CROSS_ORIGIN !== 'true') {
      return 'strict'; // Maximale Sicherheit für Same-Origin
    }

    // Bei Cross-Origin oder unbekannter Konfiguration: 'lax'
    return 'lax'; // API-kompatibel, aber sicher
  }

  // Fallback: 'strict' für unbekannte Umgebungen
  return 'strict';
};

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,           // Cookie nicht per JavaScript lesbar
    secure: process.env.NODE_ENV === 'production', // HTTPS only in Production
    sameSite: getSameSiteConfig(),
    maxAge: 60 * 60 * 1000,  // 1 Stunde Lebensdauer
  },
  // CSRF-Token aus Header ODER Body akzeptieren
  value: (req) => {
    return req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
  },
});

export default csrfProtection;