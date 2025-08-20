import express from 'express';

const postRouter = express.Router();
postRouter.all('/blogpost/:slug', middleware.requireJsonContent, async (req, res) => {
  //hier allgemeine Logik ausführen
  //logging
  //sanitazing
});

postRouter.get('/:slug', async (req, res) => {
  const slug = req.params.slug;
  const post = await getPostBySlug(slug);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(post);
});

postRouter.post('/', async (req, res) => {
  const postData = req.body;
  const newPost = await createPost(postData);
  res.status(201).json(newPost);
});

// commentsRouter.all();

postRouter.get('/blogpost/:slug', async (req, res) => {
  const slug = req.params.slug;
  try {
    const post = DatabaseService.getPostBySlug(slug);
    if(!post) return res.status(404).json({ error: 'Blogpost not found' });
    if(post.deleted) return res.status(410).json({ error: 'Blogpost deleted' });
    if(!post.published) return res.status(403).json({ error: 'Blogpost not published' });

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    const referer = req.get('Referer');

    DatabaseService.incrementViews(slug, ipAddress, userAgent, referer).catch(err => {
      console.error('Fehler beim Tracking:', err);
    });
    res.json(convertBigInts(post) || post);
  } catch (error) {
    console.error('Error loading the blog post', error);
    res.status(500).json({ error: 'Server failed to load the blogpost' });
  }
});

postRouter.post('/blogpost', strictLimiter, authenticateToken, requireAdmin, middleware.requireJsonContent, async (req, res) => {
  const { title, content, tags } = req.body;
  const slug = createSlug(title);
  try {
    const result = await DatabaseService.createPost({ title, slug, content, tags, author: req.user.username });
    if (!result) {
      return res.status(400).json({ error: 'Failed to create blog post' });
    }
    res.status(201).json({ message: 'Blog post created successfully', postId: convertBigInts(result.postId), title: result.title });
  } catch (error) {
    console.error('Error creating new blog post', error);
    res.status(500).json({ error: 'Server failed to create the blogpost' });
  }
});
export default postRouter;