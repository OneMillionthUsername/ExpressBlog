import crypto from 'crypto';

// Nonce-Middleware für sichere Inline-Scripts und Styles
const nonceMiddleware = (req, res, next) => {
  // Generiere eine sichere Nonce für jeden Request
  const nonce = crypto.randomBytes(16).toString('base64');

  // Speichere die Nonce im Response-Objekt für Templates
  res.locals.nonce = nonce;

  // Füge die Nonce zur CSP hinzu
  const cspHeader = res.getHeader('Content-Security-Policy') || '';

  if (cspHeader) {
    // Ersetze die bestehende CSP mit Nonce-Unterstützung für scripts UND styles
    let updatedCSP = cspHeader.replace(
      /script-src ([^;]*)/,
      `script-src $1 'nonce-${nonce}'`,
    );
    
    // Füge Nonce für style-src hinzu und erlaube unsafe-hashes für style-Attribute
    updatedCSP = updatedCSP.replace(
      /style-src ([^;]*)/,
      `style-src $1 'nonce-${nonce}' 'unsafe-hashes'`,
    );
    
    res.setHeader('Content-Security-Policy', updatedCSP);
  }

  next();
};

export default nonceMiddleware;
