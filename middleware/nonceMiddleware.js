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
    // Nonce für script-src und style-src hinzufügen
    let updatedCSP = cspHeader.replace(
      /script-src ([^;]*)/,
      `script-src $1 'nonce-${nonce}'`,
    );

    updatedCSP = updatedCSP.replace(
      /style-src(?!-attr) ([^;]*)/,
      `style-src $1 'nonce-${nonce}'`,
    );

    res.setHeader('Content-Security-Policy', updatedCSP);
  }

  next();
};

export default nonceMiddleware;
