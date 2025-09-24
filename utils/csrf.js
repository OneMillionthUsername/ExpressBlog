import csrf from '@dr.pogodin/csurf';

/**
 * CSRF protection middleware factory configured to use cookie-based tokens.
 * Accepts tokens from common header names as well as `req.body._csrf`.
 */
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,           // Cookie nicht per JavaScript lesbar
    // Use 'lax' for same-site requests (frontend and backend on same domain)
    // Only use 'none' if frontend and backend are on different domains
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // HTTPS only in Production
    maxAge: 60 * 60 * 1000,  // 1 Stunde Lebensdauer
  },
  // CSRF-Token aus Header ODER Body akzeptieren
  value: (req) => {
    // Accept multiple common header names to be more robust across clients/proxies
    const headerToken = req.get?.('x-csrf-token')
      || req.get?.('x-xsrf-token')
      || req.get?.('csrf-token')
      || req.headers?.['x-csrf-token']
      || req.headers?.['x-xsrf-token']
      || req.headers?.['csrf-token'];
    return headerToken || req.body?.['_csrf'] || req.query?.['_csrf'];
  },
});

export default csrfProtection;