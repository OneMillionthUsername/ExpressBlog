import csrf from 'csurf';

// CSRF-Middleware
const csrfProtection = csrf({ 
    cookie: { 
        httpOnly: true, 
        secure: IS_PRODUCTION,
        sameSite: 'strict'
    } 
});

app.use(csrfProtection);

// Token an Frontend senden
app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});