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

export default staticRouter;