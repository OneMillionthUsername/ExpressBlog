#!/usr/bin/env node
import { DatabaseService } from '../databases/mariaDB.js';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

async function sanitizeAll() {
  const window = new JSDOM('').window;
  const purifier = DOMPurify(window);
  try {
    console.log('Loading posts from DB...');
    const posts = await DatabaseService.getAllPosts();
    if (!posts || posts.length === 0) {
      console.log('No posts to sanitize');
      return;
    }
    for (const p of posts) {
      const safe = purifier.sanitize(p.content || '', {
        ALLOWED_TAGS: ['p','br','b','i','strong','em','u','a','ul','ol','li','img','blockquote','pre','code','h1','h2','h3'],
        ALLOWED_ATTR: ['href','title','target','rel','src','alt'],
      });
      if (safe !== p.content) {
        console.log(`Sanitizing post ${p.id} - updating content`);
        p.content = safe;
        await DatabaseService.updatePost({ id: p.id, content: p.content });
      }
    }
    console.log('Sanitization complete');
  } catch (err) {
    logger.error('Error sanitizing DB posts:', err);
    console.error(err);
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  sanitizeAll().then(() => process.exit(0)).catch(() => process.exit(1));
}
