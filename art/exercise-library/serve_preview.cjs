const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.env.RIJI_PREVIEW_PORT || 8767);
const rootFiles = new Set(['preview.html', 'preview.js', 'gallery-data.js']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
http.createServer((request, response) => {
  let relative;
  try { relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1) || 'preview.html'; }
  catch (_) { response.writeHead(400).end(); return; }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  const file = path.resolve(__dirname, relative);
  const allowed = rootFiles.has(relative) || /^(output|renders)\/[a-z0-9_-]+\/(animation\.webp|poster\.webp|thumb\.webp|keyframes\.jpg|\d{3}\.png)$/.test(relative);
  if (!file.startsWith(__dirname + path.sep) || !allowed) { response.writeHead(404).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store',
      'Content-Length': data.length, 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Animation review: http://127.0.0.1:${port}/`));
