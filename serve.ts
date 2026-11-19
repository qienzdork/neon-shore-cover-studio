// A tiny static server for app/ (Node 22, standard library only), so the
// cover studio can be tried locally without a build step:
//   node serve.ts [--port 8080]
// It serves app/ on http://localhost:8080, sends the MIME types an offline
// web app needs, and refuses any path outside app/. Development convenience
// only — not a server for the internet.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const wanted = portIndex === -1 ? 8080 : Number(args[portIndex + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }
  const rawPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const requested = normalize(join(root, rawPath === '/' ? 'index.html' : rawPath));
  if (!requested.startsWith(root + sep) && requested !== root) {
    res.writeHead(403);
    res.end();
    return;
  }
  let path = requested;
  try {
    const stat = statSync(path);
    if (stat.isDirectory()) path = join(path, 'index.html');
  } catch {
    res.writeHead(404);
    res.end('Not found\n');
    return;
  }
  const mime = MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  if (req.method === 'GET') createReadStream(path).pipe(res);
  else res.end();
}).listen(port, '127.0.0.1', () => {
  console.log(`Neon Shore Cover Studio at http://localhost:${port}`);
});
