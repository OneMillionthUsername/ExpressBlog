#!/usr/bin/env node
import { sanitizeAll } from './sanitize-db-posts.js';
import logger from '../utils/logger.js';

(async function main(){
  try {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('--dryrun');

    if (process.env.NODE_ENV === 'production') {
      if (process.env.SANITIZE_DB_CONFIRM !== 'yes' && process.env.SANITIZE_DB_CONFIRM !== 'YES') {
        console.error('Refusing to run sanitize in production without explicit confirmation.');
        console.error('Set environment variable SANITIZE_DB_CONFIRM=yes to acknowledge you understand this will modify production data.');
        process.exitCode = 2;
        return;
      }
    }

    console.log('Starting DB sanitization' + (process.env.NODE_ENV === 'production' ? ' (production mode)':'') + (dryRun ? ' (dry-run)' : '') + '...');
    await sanitizeAll({ dryRun });
    console.log('DB sanitization finished.');
    process.exit(0);
  } catch (err) {
    logger.error('Fatal error running sanitize wrapper', err);
    console.error(err);
    process.exit(1);
  }
})();
