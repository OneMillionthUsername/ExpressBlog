#!/usr/bin/env node
import { DatabaseService, initializeDatabase } from '../databases/mariaDB.js';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

/**
 * Sanitize all posts.
 * @param {object} options
 * @param {boolean} options.dryRun - if true, do not persist updates to the DB; just log changes
 */
async function sanitizeAll(options = {}) {
  const { dryRun = false } = options;
  const window = new JSDOM('').window;
  const purifier = DOMPurify(window);
  try {
    // Ensure database pool is initialized (will switch to mock if env/deps missing)
    await initializeDatabase();
    console.log('Database initialization complete (or mock mode active)');
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
        console.log(`Sanitizing post ${p.id} - content would be updated` + (dryRun ? ' (dry-run)' : ''));
        if (!dryRun) {
          p.content = safe;
          await DatabaseService.updatePost({ id: p.id, content: p.content });
        }
      }
    }
    console.log('Sanitization complete');
  } catch (err) {
    logger.error('Error sanitizing DB posts:', err);
    console.error(err);
  }
}

// Exported for programmatic use by safe wrappers
export { sanitizeAll };

// If run directly, execute immediately (same behaviour as before)
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  sanitizeAll().then(() => process.exit(0)).catch(() => process.exit(1));
}
