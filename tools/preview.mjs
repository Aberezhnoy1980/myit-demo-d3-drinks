import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4333);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const project = fileURLToPath(new URL('../', import.meta.url));
const localFiles = {
  '/__editor__/index.html': 'editor/index.html', '/__editor__/editor.css': 'editor/editor.css',
  '/__editor__/editor.mjs': 'editor/editor.mjs', '/__editor__/content.mjs': 'lib/content.mjs',
  '/__editor__/instructions.html': 'editor/instructions.html', '/__editor__/site.json': 'content/site.json',
  '/__editor__/template.html': 'src/index.html', '/__audit__/runtime.js': 'tools/audit-runtime.js'
};
http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end('Только чтение'); return; }
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    const slow = pathname.startsWith('/__slow__/');
    if (slow) pathname = pathname.slice('/__slow__'.length);
    // Same immutable build is available at root and under a review prefix.
    if (pathname.startsWith('/portfolio/d3/')) pathname = pathname.slice('/portfolio/d3'.length);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = localFiles[pathname] ? resolve(project, localFiles[pathname]) : resolve(root, '.' + pathname);
    if (!localFiles[pathname] && !file.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error('Outside root');
    if (url.searchParams.has('missing')) throw new Error('Intentional test failure');
    let source = await readFile(file);
    const html = extname(file) === '.html' && !localFiles[pathname];
    if (html && url.searchParams.get('audit') === 'missing-media') source = Buffer.from(source.toString().replace(/(\.\/assets\/[^" ]+\.svg)/g, '$1?missing=1'));
    if (html && ['1','slow'].includes(url.searchParams.get('audit'))) source = Buffer.from(source.toString().replace('</head>', '<script src="/__audit__/runtime.js" defer></script></head>'));
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const data = gzip ? gzipSync(source) : source;
    if (slow) await new Promise(resolve => setTimeout(resolve, 150 + data.length / 163840 * 1000));
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Accept-Encoding', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}), ...(html && url.searchParams.get('audit') === 'no-js' ? {'Content-Security-Policy': "script-src 'none'; object-src 'none'"} : {}) });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Страница не найдена');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/`));
