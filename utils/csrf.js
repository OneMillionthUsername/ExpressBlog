import csrf from '@dr.pogodin/csurf';

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
    return req.headers['x-csrf-token'] || req.body?.['_csrf'] || req.query?.['_csrf'];
  },
});

export default csrfProtection;