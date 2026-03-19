import express from 'express';
import { readFile, stat } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

const LOG_PATH = '/var/log/nginx/blog-access.log';
const REPORT_PATH = '/tmp/goaccess-report.json';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

async function isCacheFresh() {
  try {
    const info = await stat(REPORT_PATH);
    return (Date.now() - info.mtimeMs) < CACHE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

async function generateReport() {
  await execFileAsync('goaccess', [
    LOG_PATH,
    '-o', REPORT_PATH,
  ], { timeout: 30_000 });
}

const adminStatsRouter = express.Router();

adminStatsRouter.get(
  '/admin/stats',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      if (!await isCacheFresh()) {
        await generateReport();
      }
      const raw = await readFile(REPORT_PATH, 'utf-8');
      const stats = JSON.parse(raw);
      res.render('admin/stats', { stats });
    } catch (err) {
      logger.warn('GoAccess report generation failed', {
        error: err.message,
      });
      res.status(503).render('admin/stats', { stats: null });
    }
  },
);

export default adminStatsRouter;
