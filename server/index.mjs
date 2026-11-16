// Production server: the built game (dist/) plus the prize API on one port.
//   npm run build && npm start        → http://localhost:8787 (game) and /admin.html (admin)
// Env: PORT (default 8787), ADMIN_PASSWORD (optional; otherwise one is generated on first run).
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(ROOT, '..', 'dist');
const PORT = Number(process.env.PORT) || 8787;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
};

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('Chưa có bản build. Chạy "npm run build" trước.');
  process.exit(1);
}

const api = createApi();

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname.includes('/api/')) return void api(req, res);
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  if (rel === '/admin') rel = '/admin.html';
  const file = path.resolve(DIST, `.${rel}`);
  if (!file.startsWith(DIST + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.statusCode = 404;
    return void res.end('Not found');
  }
  res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  // hashed assets never change; pages and config always revalidate
  res.setHeader('Cache-Control', rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`Căn Phòng Tarot: http://localhost:${PORT}  ·  admin: http://localhost:${PORT}/admin.html`);
});
