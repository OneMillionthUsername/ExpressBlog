import express from 'express';

/**
 * Factory that returns a router with DB-dependent routes mounted.
 * Accepts the `requireDatabase` middleware so app.js keeps lifecycle control.
 */
/**
 * Create a router that mounts application routers behind a DB readiness
 * middleware. This factory keeps DB lifecycle concerns in one place so
 * `app.js` can control when the application starts accepting requests.
 */
export default function createDbRouter(requireDatabase, routes) {
  const dbRouter = express.Router();

  // Apply DB readiness check once for this router
  dbRouter.use(requireDatabase);

  // Mount the sub-routers (order preserved)
  dbRouter.use('/', routes.staticRouter);
  // Sitemap may be fine without DB; keep it here for consistency. Move outside if needed.
  dbRouter.use('/', routes.sitemapRouter);

  // Utility routes (e.g., CSRF token endpoint)
  // Expose under /api so clients can fetch /api/csrf-token before making POST requests
  dbRouter.use('/api', routes.utilityRouter);

  dbRouter.use('/auth', routes.authRouter);
  dbRouter.use('/blogpost', routes.postRouter);
  dbRouter.use('/upload', routes.uploadRouter);
  dbRouter.use('/comments', routes.commentsRouter);
  dbRouter.use('/cards', routes.cardRouter);

  return dbRouter;
}
