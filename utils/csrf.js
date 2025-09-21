import csrf from '@dr.pogodin/csurf';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,           // Cookie nicht per JavaScript lesbar
    // For cross-site contexts (e.g. when the frontend and backend are on different origins)
    // browsers require SameSite='None' AND Secure=true. We set Secure in production only.
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production', // HTTPS only in Production
    maxAge: 60 * 60 * 1000,  // 1 Stunde Lebensdauer
  },
  // CSRF-Token aus Header ODER Body akzeptieren
  value: (req) => {
    return req.headers['x-csrf-token'] || req.body?.['_csrf'] || req.query?.['_csrf'];
  },
});

export default csrfProtection;