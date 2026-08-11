import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

createServer((request, response) => {
  const requested = request.url?.split('?')[0] || '/';
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const filename = normalize(join(root, relative));

  if (!filename.startsWith(root) || !existsSync(filename)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mime[extname(filename)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  createReadStream(filename).pipe(response);
}).listen(4173, '127.0.0.1', () => {
  console.log('Portfolio mission control: http://127.0.0.1:4173');
});
