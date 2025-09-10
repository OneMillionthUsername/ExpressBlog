import csrf from '@dr.pogodin/csurf';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,           // Cookie nicht per JavaScript lesbar
    secure: process.env.NODE_ENV === 'production', // HTTPS only in Production
    sameSite: 'lax',         // Funktioniert mit normalen Navigation und API-Calls
    maxAge: 60 * 60 * 1000,  // 1 Stunde Lebensdauer
  },
  // CSRF-Token aus Header ODER Body akzeptieren
  value: (req) => {
    return req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
  },
});

export default csrfProtection;