import postRouter from './postRoutes.js';
import uploadRouter from './uploadRoutes.js';
import authRouter from './authRoutes.js';
import commentsRouter from './commentsRoutes.js';
import utilityRouter from './utilityRoutes.js';
import staticRouter from './staticRoutes.js';
import cardRouter from './cardRoutes.js';
import sitemapRouter from './sitemapRoutes.js';

/**
 * Central export of routers used by `app.js`.
 *
 * Each property is an Express Router responsible for a related set of
 * endpoints. `app.js` mounts these routers under appropriate base paths.
 */
export default {
  postRouter,
  uploadRouter,
  authRouter,
  commentsRouter,
  utilityRouter,
  staticRouter,
  cardRouter,
  sitemapRouter,
  // Note: debug endpoint is mounted directly in app.js as `/debug/headers`.
};