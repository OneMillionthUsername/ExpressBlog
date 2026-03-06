import logger from '../utils/logger.js';
import { decodeHtmlEntities, withExcerpts, createExcerpt, extractFirstImageUrl } from '../public/assets/js/shared/text.js';
import categoryController from './categoryController.js';
import postController from './postController.js';
import cardController from './cardController.js';
import { DatabaseService } from '../databases/mariaDB.js';
import { TINY_MCE_API_KEY } from '../config/config.js';
import { applySsrNoCache, getSsrAdmin } from '../utils/utils.js';
import contactMailService from '../services/contactMailService.js';

async function showHomePage(req, res) {
  logger.debug(`[HOME] GET / requested from ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
  logger.debug('[HOME] GET / - Rendering index.ejs');
  const isAdmin = getSsrAdmin(res);
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;

  try {
    const posts = await DatabaseService.getPublishedPostsForHome();
    const categories = await categoryController.getAllCategories();
    const featuredPosts = (posts || []).slice(0, 3).map(p => ({
      title: decodeHtmlEntities(p.title || ''),
      slug: p.slug,
      excerpt: createExcerpt(p.excerpt_source, 150),
      previewImage: (() => {
        let url = extractFirstImageUrl(p.preview_source || p.excerpt_source || '');
        if (!url) return { src: null, srcset: null };
        if (url.startsWith('http')) return { src: url, srcset: null };
        const assetsIdx = url.indexOf('/assets/');
        if (assetsIdx > 0) url = url.substring(assetsIdx);
        const extIndex = url.lastIndexOf('.');
        if (extIndex === -1) return { src: url, srcset: null };
        const base = url.substring(0, extIndex);
        return { src: base + '-72.webp', srcset: base + '-72.webp 1x, ' + base + '-144.webp 2x' };
      })(),
    }));

    const popularPosts = (posts || [])
      .slice()
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        slug: p.slug,
        title: decodeHtmlEntities(p.title || ''),
      }));

    const archiveYears = Array.from(new Set((posts || []).map(p => {
      try { return new Date(p.created_at).getFullYear(); } catch { return null; }
    }).filter(Boolean))).sort((a, b) => b - a);

    let cards = [];
    try {
      const allCards = await cardController.getAllCards();
      cards = Array.isArray(allCards) ? allCards.filter(c => c.published !== false) : [];
    } catch (cardErr) {
      logger.error('[HOME] GET / - Error fetching cards:', cardErr);
      cards = [];
    }

    logger.debug('[HOME] GET / - Rendering index.ejs with featured posts:', { featured_slugs: featuredPosts.map(p => p.slug) });
    applySsrNoCache(res, { varyCookie: true });
    res.render('index', { featuredPosts, popularPosts, archiveYears, cards, isAdmin, csrfToken, categories });
    logger.debug('[HOME] GET / - Successfully rendered index.ejs');
  } catch (error) {
    logger.error('[HOME] GET / - Error rendering index.ejs:', error);
    applySsrNoCache(res, { varyCookie: true });
    res.status(500).send('Error rendering homepage');
  }
}

function showAboutPage(req, res) {
  const isAdmin = getSsrAdmin(res);
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
  applySsrNoCache(res, { varyCookie: true });
  res.render('about', { isAdmin, csrfToken });
}

function redirectAboutHtml(_req, res) {
  res.redirect('/about');
}

async function submitContactForm(req, res) {
  const minSubmitDelayMs = 3000;
  const honeypot = String(req.body?.website || '').trim();
  const formLoadedAtRaw = String(req.body?.formLoadedAt || '').trim();
  const formLoadedAt = Number(formLoadedAtRaw);
  const now = Date.now();
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const message = String(req.body?.message || '').trim();
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.headers['x-real-ip']
    || req.ip
    || req.socket?.remoteAddress
    || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  if (honeypot) {
    logger.warn('[CONTACT] Honeypot triggered - dropping submission', { ip });
    return res.status(200).json({ success: true, message: 'Nachricht erfolgreich gesendet.' });
  }

  const isInvalidTimestamp = !Number.isFinite(formLoadedAt) || formLoadedAt <= 0 || formLoadedAt > now;
  const isTooFast = !isInvalidTimestamp && (now - formLoadedAt < minSubmitDelayMs);

  if (isInvalidTimestamp || isTooFast) {
    logger.warn('[CONTACT] Timing check triggered - dropping submission', {
      ip,
      isInvalidTimestamp,
      elapsedMs: isInvalidTimestamp ? null : (now - formLoadedAt),
    });
    return res.status(429).json({
      success: false,
      error: 'Bitte warte einen Moment und sende das Formular erneut.',
    });
  }

  contactMailService.sendContactMail({ name, email, message, ip, userAgent })
    .catch(error => {
      logger.error('[CONTACT] Failed to send contact email', {
        error: error && error.message ? error.message : String(error),
        ip,
      });
    });

  return res.status(200).json({ success: true, message: 'Nachricht erfolgreich gesendet.' });
}

async function showPostsPage(req, res) {
  try {
    const isAdmin = getSsrAdmin(res);
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
    const posts = await postController.getCurrentPosts();
    applySsrNoCache(res, { varyCookie: true });
    return res.render('listCurrentPosts', { posts: withExcerpts(posts), isAdmin, csrfToken });
  } catch (err) {
    logger.error('[POSTS] Error rendering listCurrentPosts:', err && err.message);
    const isAdmin = getSsrAdmin(res);
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
    applySsrNoCache(res, { varyCookie: true });
    return res.render('listCurrentPosts', { isAdmin, csrfToken });
  }
}

function getCreateViewBaseContext(req, res) {
  const isAdmin = getSsrAdmin(res);
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
  const formError = req.query && req.query.error ? 'Blogpost konnte nicht gespeichert werden.' : null;
  const tinyMceKey = isAdmin ? TINY_MCE_API_KEY : null;
  return { isAdmin, csrfToken, formError, tinyMceKey };
}

async function renderCreatePostView(req, res, { post = null, formAction = '/blogpost/create' } = {}) {
  try {
    const { isAdmin, csrfToken, formError, tinyMceKey } = getCreateViewBaseContext(req, res);
    
    logger.debug('[CREATEPOST] SSR computed flags', {
      isAdmin,
      tinyMceKeyProvided: !!tinyMceKey,
    });

    const categories = await categoryController.getAllCategories();
    logger.debug('[CREATEPOST] Fetched categories for createPost view', { categoryCount: Array.isArray(categories) ? categories.length : 0 });

    applySsrNoCache(res, { varyCookie: true });
    res.render('createPost', { tinyMceKey, isAdmin, post, csrfToken, formAction, formError, categories });
  } catch (err) {
    logger.error('[CREATEPOST] Error rendering createPost:', err);
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
    applySsrNoCache(res, { varyCookie: true });
    res.render('createPost', {
      tinyMceKey: null,
      isAdmin: false,
      post: null,
      csrfToken,
      formAction: '/blogpost/create',
      formError: 'Blogpost konnte nicht geladen werden.',
      categories: [],
    });
  }
}

async function showCreatePostPage(req, res) {
  return renderCreatePostView(req, res, {
    post: null,
    formAction: '/blogpost/create',
  });
}

async function showUpdatePostByIdPage(req, res) {
  const postId = req.params && req.params.id;
  let serverPost = null;
  try {
    if (postId && /^[0-9]+$/.test(String(postId))) {
      serverPost = await postController.getPostById(postId);
    }
  } catch (fetchErr) {
    logger.debug('[UPDATEPOST] Could not fetch post by id for prefill:', fetchErr && fetchErr.message);
  }

  const fallbackEditId = postId && /^[0-9]+$/.test(String(postId)) ? Number(postId) : null;
  const effectivePostId = serverPost && serverPost.id ? Number(serverPost.id) : fallbackEditId;
  const formAction = effectivePostId ? `/blogpost/update/${effectivePostId}` : '/blogpost/create';

  return renderCreatePostView(req, res, {
    post: serverPost,
    formAction,
  });
}

export default {
  showHomePage,
  showAboutPage,
  redirectAboutHtml,
  submitContactForm,
  showPostsPage,
  showCreatePostPage,
  showUpdatePostByIdPage,
};
