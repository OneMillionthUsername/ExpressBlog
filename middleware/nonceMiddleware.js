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
  // Skip nonce generation for static assets — they don't need CSP nonces
  if (req.path.startsWith('/assets/') || req.path.startsWith('/public/') || req.path.startsWith('/node_modules/')) {
    return next();
  }

  // Generiere eine sichere Nonce für jeden Request
  const nonce = crypto.randomBytes(16).toString('base64');

  // Speichere die Nonce im Response-Objekt für Templates
  res.locals.nonce = nonce;

  // Füge die Nonce zur CSP hinzu
  const cspHeader = res.getHeader('Content-Security-Policy') || '';

  if (cspHeader) {
    // TinyMCE injiziert dynamisch <style>-Elemente die keine Nonce bekommen können
    const tinymceStyleHashes = [
      '\'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=\'', // empty style element
      '\'sha256-Mia3q7J61OxNlAZtRNAwCYtIrMyDLicwwyzKx08ck64=\'', // TinyMCE skin style
    ];

    // TinyMCE executor.js erstellt dynamisch Inline-Scripts die keine Nonce bekommen
    const tinymceScriptHashes = [
      '\'sha256-C0d30RW4IMywlXnx8PG0b2EsyhP36uq8ljzfmRP2RC0=\'', // TinyMCE executor inline script
    ];

    // Nonce für script-src und style-src hinzufügen
    let updatedCSP = cspHeader.replace(
      /script-src ([^;]*)/,
      `script-src $1 'nonce-${nonce}' 'unsafe-hashes' ${tinymceScriptHashes.join(' ')}`,
    );

    updatedCSP = updatedCSP.replace(
      /style-src(?!-attr) ([^;]*)/,
      `style-src $1 'nonce-${nonce}' 'unsafe-hashes' ${tinymceStyleHashes.join(' ')}`,
    );

    res.setHeader('Content-Security-Policy', updatedCSP);
  }

  next();
};

export default nonceMiddleware;
