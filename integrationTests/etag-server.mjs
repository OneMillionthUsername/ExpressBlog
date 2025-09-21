import express from 'express';
import postController from '../controllers/postController.js';
import { getAllHandler } from '../routes/postRoutes.js';

// Patch controller for deterministic responses in tests
postController.getAllPosts = async () => {
  return [ { id: 1, title: 'Hello', slug: 'hello', content: 'world', published: true } ];
};
postController.getPostsChecksum = () => 'fixed-checksum-123';

const app = express();
app.use(express.json());
app.get('/blogpost/all', (req, res) => getAllHandler(req, res));

const server = app.listen(0, () => {
  const port = server.address().port;
  // Signal the test harness with the chosen port
  // Prefix chosen to make parsing robust
  console.log(`TEST_SERVER_PORT:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
