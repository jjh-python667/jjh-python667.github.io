import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../dist', import.meta.url)));
const portIndex = process.argv.indexOf('--port');
const port = portIndex === -1 ? 4176 : Number(process.argv[portIndex + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
const agentOrigin = new URL(process.env.LEARNING_AGENT_ORIGIN || 'http://127.0.0.1:4181');
if (agentOrigin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(agentOrigin.hostname)) {
  throw new Error('The preview proxy requires a local HTTP learning service');
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml' };
const staticCache = new Map();
function accepts(header, encoding) {
  const value = String(header || '').split(',').find(item => item.trim().split(';')[0] === encoding);
  return value && !/;\s*q=0(?:\.0*)?\s*$/.test(value);
}
async function representation(file, request) {
  const info = await stat(file);
  let cached = staticCache.get(file);
  if (!cached || cached.mtime !== info.mtimeMs || cached.size !== info.size) {
    cached = { mtime: info.mtimeMs, size: info.size, variants: new Map() };
    staticCache.set(file, cached);
  }
  let encoding = '';
  if (/\.(?:html|css|js|json|svg|xml|txt)$/.test(file)) {
    for (const candidate of ['br', 'gzip']) {
      if (!accepts(request.headers['accept-encoding'], candidate)) continue;
      try { await stat(file + (candidate === 'br' ? '.br' : '.gz')); encoding = candidate; break; } catch {}
    }
  }
  if (!cached.variants.has(encoding)) {
    const body = await readFile(file + (encoding === 'br' ? '.br' : encoding === 'gzip' ? '.gz' : ''));
    cached.variants.set(encoding, { body, etag: '"' + createHash('sha256').update(body).digest('hex').slice(0, 24) + '"' });
  }
  return { ...cached.variants.get(encoding), encoding };
}

function proxyAgent(request, response, pathname) {
  const target = new URL(agentOrigin);
  target.pathname = pathname === '/learning/' ? '/' : pathname;
  target.search = new URL(request.url, 'http://localhost').search;
  const upstream = http.request(target, { method: request.method, headers: { ...request.headers, host: request.headers.host } }, incoming => {
    const headers = { ...incoming.headers };
    response.writeHead(incoming.statusCode || 502, headers);
    incoming.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ detail: '学习服务尚未启动，请先运行本机学习服务。' }));
  });
  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
}

http.createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Invalid URL'); return; }
  if (pathname === '/learning') { response.writeHead(302, { Location: '/learning/' }).end(); return; }
  if (pathname === '/learning/' || pathname.startsWith('/api/') || pathname.startsWith('/static/') ||
      pathname === '/invite' || pathname.startsWith('/invite/')) {
    proxyAgent(request, response, pathname);
    return;
  }
  try {
    const file = await realpath(path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end('Forbidden'); return; }
    const { body, etag, encoding } = await representation(file, request);
    const immutable = /(?:site|portfolio|vendor-gsap)-[a-f0-9]{12}\.(?:css|js)$/.test(file);
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', 'Vary': 'Accept-Encoding', 'ETag': etag };
    if (encoding) headers['Content-Encoding'] = encoding;
    if (request.headers['if-none-match'] === etag) { response.writeHead(304, headers).end(); return; }
    headers['Content-Length'] = body.length;
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      response.writeHead(404, { 'Content-Type': types['.html'] });
      response.end(await readFile(path.join(root, '404.html')));
      return;
    }
    response.writeHead(500).end('Preview error');
  }
}).listen(port, '127.0.0.1', () => console.log('Preview http://127.0.0.1:' + port + '/'));
