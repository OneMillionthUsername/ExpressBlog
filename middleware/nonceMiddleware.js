import crypto from 'crypto';

/**
 * Middleware to generate a per-request CSP nonce and inject it into `res.locals.nonce`.
 * Also augments the existing `Content-Security-Policy` header (if present) to include
 * the generated nonce for `script-src` and `style-src`, and preserves known hashes.
 *
 * Usage: Templates should use `res.locals.nonce` as the value for inline script/style nonces.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const nonceMiddleware = (req, res, next) => {
  // Generiere eine sichere Nonce für jeden Request
  const nonce = crypto.randomBytes(16).toString('base64');

  // Speichere die Nonce im Response-Objekt für Templates
  res.locals.nonce = nonce;

  // Füge die Nonce zur CSP hinzu
  const cspHeader = res.getHeader('Content-Security-Policy') || '';

  if (cspHeader) {
    // Bekannte Hashes für inline Scripts und Styles die erlaubt werden sollen
    const knownScriptHashes = [
      '\'sha256-ZswfTY7H35rbv8WC7NXBoiC7WNu86vSzCDChNWwZZDM=\'',
    ];
    
    const knownStyleHashes = [
      '\'sha256-+OsIn6RhyCZCUkkvtHxFtP0kU3CGdGeLjDd9Fzqdl3o=\'',
    ];
    
    // Ersetze die bestehende CSP mit Nonce-Unterstützung für scripts UND erlaubte Hashes
    let updatedCSP = cspHeader.replace(
      /script-src ([^;]*)/,
      `script-src $1 'nonce-${nonce}' ${knownScriptHashes.join(' ')}`,
    );
    
    // Füge Nonce für style-src hinzu und erlaube unsafe-hashes für style-Attribute plus bekannte Hashes
    updatedCSP = updatedCSP.replace(
      /style-src ([^;]*)/,
      `style-src $1 'nonce-${nonce}' 'unsafe-hashes' ${knownStyleHashes.join(' ')}`,
    );
    
    res.setHeader('Content-Security-Policy', updatedCSP);
  }

  next();
};

export default nonceMiddleware;
