/**
 * Legal Controller
 * Handles /impressum and /datenschutz – no database dependency
 */

export function getImpressum(req, res) {
  res.render('impressum', {
    title: 'Impressum – SpeculumX',
    activePage: 'impressum',
    isAdmin: res.locals.isAdmin ?? false,
    nonce: res.locals.nonce,
    assetVersion: res.locals.assetVersion ?? '',
  });
}

export function getDatenschutz(req, res) {
  res.render('datenschutz', {
    title: 'Datenschutzerklärung – SpeculumX',
    activePage: 'datenschutz',
    isAdmin: res.locals.isAdmin ?? false,
    nonce: res.locals.nonce,
    assetVersion: res.locals.assetVersion ?? '',
  });
}
