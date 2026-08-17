#!/usr/bin/env node
/**
 * Zero-dependency static file server for the Next export (`out/`).
 * Used by Playwright webServer — no next dev, no SSR.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.cwd(), process.env.DIR || 'out');
const PORT = Number(process.env.PORT || 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function contentType(filePath) {
  return TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(root, rel);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null;
  }
  return resolved;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

/**
 * Mirrors host routing for a Next static export: `/phases` is written to
 * `out/phases.html`, so an extensionless route must fall back to `<route>.html`
 * before the SPA fallback (otherwise the app boots with the wrong route tree).
 */
function resolveFile(target) {
  if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (stat.isFile()) return target;
    if (stat.isDirectory()) {
      const index = path.join(target, 'index.html');
      if (fs.existsSync(index)) return index;
    }
  }

  const asHtml = `${target}.html`;
  if (fs.existsSync(asHtml) && fs.statSync(asHtml).isFile()) return asHtml;

  return null;
}

const server = http.createServer((req, res) => {
  const target = safeJoin(ROOT, req.url || '/');
  if (!target) {
    send(res, 403, 'Forbidden');
    return;
  }

  const filePath = resolveFile(target);

  if (!filePath) {
    // SPA fallback for unknown paths
    const index = path.join(ROOT, 'index.html');
    if (fs.existsSync(index)) {
      send(res, 200, fs.readFileSync(index), {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      return;
    }
    send(res, 404, 'Not Found');
    return;
  }

  send(res, 200, fs.readFileSync(filePath), {
    'Content-Type': contentType(filePath),
    'Cache-Control': 'no-store',
  });
});

server.listen(PORT, () => {
  console.log(`[serve-static] serving ${ROOT} on http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
