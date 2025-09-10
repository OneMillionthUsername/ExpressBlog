import express from 'express';
import logger from '../utils/logger.js';
const staticRouter = express.Router();

staticRouter.get('/', (req, res) => {
  logger.debug(`[HOME] GET / requested from ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
  logger.debug('[HOME] GET / - Rendering index.ejs');
  
  try {
    res.render('index');
    logger.debug('[HOME] GET / - Successfully rendered index.ejs');
  } catch (error) {
    logger.error('[HOME] GET / - Error rendering index.ejs:', error);
    res.status(500).send('Error rendering homepage');
  }
});

staticRouter.get('/about', (req, res) => {
  res.render('about');
});

staticRouter.get('/createPost', (req, res) => {
  res.render('createPost');
});

staticRouter.get('/about.html', (req, res) => {
  res.redirect('/about');
});

staticRouter.get('/posts', (req, res) => {
  res.render('listCurrentPosts');
});

staticRouter.get('/test', (req, res) => {
  logger.debug(`[TEST] GET /test requested from ${req.ip}`);
  res.send(`
    <html>
    <head><title>Test Page</title></head>
    <body>
      <h1>Test erfolgreich!</h1>
      <p>Die Route funktioniert.</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
    </body>
    </html>
  `);
});

staticRouter.get('/debug', (req, res) => {
  logger.debug(`[DEBUG] GET /debug requested from ${req.ip}`);
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Debug Page</title>
      <link rel="stylesheet" href="/assets/css/style.css">
    </head>
    <body>
      <h1>Debug erfolgreich!</h1>
      <p>Statische Dateien werden geladen.</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
      <script src="/assets/js/page-initializers.js" type="module"></script>
    </body>
    </html>
  `);
});

staticRouter.get('/home-test', (req, res) => {
  logger.debug(`[HOME-TEST] GET /home-test requested from ${req.ip}`);
  try {
    res.render('index', {}, (err, html) => {
      if (err) {
        logger.error('[HOME-TEST] Template error:', err);
        res.status(500).send(`Template Error: ${err.message}`);
      } else {
        logger.debug('[HOME-TEST] Template rendered successfully');
        res.send(html);
      }
    });
  } catch (error) {
    logger.error('[HOME-TEST] Route error:', error);
    res.status(500).send(`Route Error: ${error.message}`);
  }
});