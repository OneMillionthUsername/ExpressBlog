/* eslint-env jest */
import { spawn } from 'child_process';
import { once } from 'events';
import { jest } from '@jest/globals';
import http from 'http';
import https from 'https';
import { URL } from 'url';

// Use global fetch (Node 18+). Jest provides globals via environment.
jest.setTimeout(20000);

describe('Integration: GET /blogpost/all ETag behavior (child server)', () => {
  let serverProc;
  let url;

  beforeAll(async () => {
    // Start the ESM server in a child process
    serverProc = spawn(process.execPath, ['integrationTests/etag-server.mjs'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProc.stdout.setEncoding('utf8');
    serverProc.stderr.setEncoding('utf8');
    // Read stdout until we see the TEST_SERVER_PORT line (use 'data' listener to avoid async iterator keeping handle)
    await new Promise((resolve, reject) => {
      const onData = (chunk) => {
        const lines = String(chunk).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('TEST_SERVER_PORT:')) {
            const port = Number(line.split(':')[1]);
            url = `http://127.0.0.1:${port}/blogpost/all`;
            serverProc.stdout.removeListener('data', onData);
            resolve();
            return;
          }
        }
      };
      serverProc.stdout.on('data', onData);

      // Timeout in case server fails to start
      const to = setTimeout(() => {
        serverProc.stdout.removeListener('data', onData);
        reject(new Error('Server did not print port in time'));
      }, 5000);
    });
  });

  afterAll(async () => {
    if (serverProc && !serverProc.killed) {
      serverProc.kill('SIGTERM');
      await once(serverProc, 'exit');
    }
  });

  test('responds with ETag and returns 304 when If-None-Match matches', async () => {
    // simple http fetch helper to avoid relying on global fetch
    const httpFetch = (targetUrl, options = {}) => {
      return new Promise((resolve, reject) => {
        const u = new URL(targetUrl);
        const lib = u.protocol === 'https:' ? https : http;
        const req = lib.request(u, { method: options.method || 'GET', headers: options.headers || {} }, (res) => {
          const headers = new Map();
          for (const [k, v] of Object.entries(res.headers)) {
            headers.set(k.toLowerCase(), Array.isArray(v) ? v.join(',') : v);
          }
          const out = {
            status: res.statusCode,
            headers: { get: (k) => headers.get(k.toLowerCase()) },
            text: () => new Promise((r) => { let buf = ''; res.on('data', c => buf += c); res.on('end', () => r(buf)); }),
          };
          // drain body
          res.on('data', () => {});
          res.on('end', () => {});
          resolve(out);
        });
        req.on('error', reject);
        req.end();
      });
    };

    const res1 = await httpFetch(url);
    expect(res1.status).toBe(200);
    const etag = res1.headers.get('etag');
    expect(etag).toBe('"fixed-checksum-123"');

    const res2 = await httpFetch(url, { headers: { 'If-None-Match': etag } });
    expect(res2.status).toBe(304);
  });
});
