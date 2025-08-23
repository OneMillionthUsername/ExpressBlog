import csrf from '@dr.pogodin/csurf';

const csrfProtection = csrf({
    cookie: {
        httpOnly: true, // CSRF cookie can't be accessed via JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }

});

export default { csrfProtection };