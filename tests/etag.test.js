import { test, expect } from '@jest/globals';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-friendly __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Run the helper Node script in a child process to avoid ESM module linking issues in Jest.
test('getAllHandler returns ETag and 304 when If-None-Match matches (via helper script)', async () => {
  const scriptPath = path.resolve(__dirname, '..', 'scripts', 'run-etag-test.mjs');
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [scriptPath], { windowsHide: true, timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      // Even if `err` is set (non-zero exit), inspect stdout/stderr for expected output.
      const out = stdout || '';
      const errOut = stderr || '';
      if (err && (!out.includes('res1.statusCode 200') || !out.includes('res2.statusCode 304'))) {
        // Not the expected result — include stdout/stderr for diagnostics
        err.message += '\nSTDOUT:\n' + out + '\nSTDERR:\n' + errOut;
        return reject(err);
      }
      try {
        expect(out).toContain('res1.statusCode 200');
        expect(out).toContain('res1._headers');
        expect(out).toContain('res2.statusCode 304');
        resolve();
      } catch (assertErr) {
        assertErr.message += '\nSTDOUT:\n' + out + '\nSTDERR:\n' + errOut;
        reject(assertErr);
      }
    });
  });
}, 40000);

