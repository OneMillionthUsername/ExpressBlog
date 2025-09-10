import express from 'express';
const staticRouter = express.Router();

staticRouter.get('/', (req, res) => {
  res.render('index');
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

staticRouter.get('/blogpost/all', (req, res) => {
  res.render('listCurrentPosts');
});

export default staticRouter;