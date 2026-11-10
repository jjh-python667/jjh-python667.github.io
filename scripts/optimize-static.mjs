import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import path from 'node:path';

export async function optimizeStatic(directory) {
  const files = ['index.html', '404.html', 'agent.html', ...(await readdir(path.join(directory, 'projects'))).filter(x => x.endsWith('.html')).map(x => 'projects/' + x)];
  const written = new Map();
  async function combine(filename, tags, type, label) {
    const contents = await Promise.all(tags.map(async tag => {
      const href = tag.match(/(?:src|href)="([^"]+)"/)[1];
      const source = href.startsWith('/') ? path.resolve(directory, '.' + href) : path.resolve(path.dirname(filename), href);
      const relative = path.relative(directory, source);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.startsWith('assets' + path.sep)) throw new Error('Bundle input must stay in assets');
      return (await readFile(source, 'utf8')).replace(/\/\/[#@] sourceMappingURL=.*$/gm, '');
    }));
    // Stable bundle fingerprints across Windows and Linux checkouts.
    const body = contents.join(type === 'js' ? '\n;\n' : '\n').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd() + '\n';
    const digest = createHash('sha256').update(body).digest('hex').slice(0, 12);
    const relative = 'assets/' + (type === 'js' ? 'js/' : 'css/') + label + '-' + digest + '.' + type;
    if (!written.has(relative)) { await mkdir(path.dirname(path.join(directory, relative)), { recursive: true }); await writeFile(path.join(directory, relative), body); written.set(relative, Buffer.byteLength(body)); }
    return '/' + relative;
  }
  for (const file of files) {
    const filename = path.join(directory, file);
    let html = await readFile(filename, 'utf8');
    const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(x => x[0]);
    if (styles.length) {
      const url = await combine(filename, styles, 'css', 'site');
      for (const [index, tag] of styles.entries()) html = html.replace(tag, index === 0 ? '<link rel="stylesheet" href="' + url + '">' : '');
    }
    const scripts = [...html.matchAll(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/g)].map(x => x[0]);
    const vendors = scripts.filter(x => x.includes('/vendor/gsap/'));
    const application = scripts.filter(x => !vendors.includes(x));
    const urls = [];
    if (vendors.length) urls.push(await combine(filename, vendors, 'js', 'vendor-gsap'));
    if (application.length) urls.push(await combine(filename, application, 'js', 'portfolio'));
    for (const [index, tag] of scripts.entries()) html = html.replace(tag, index === 0 ? urls.map(url => '<script src="' + url + '" defer></script>').join('\n') : '');
    await writeFile(filename, html.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, ''));
  }
  // Keep source assets for diagnostics and the independent learning workspace.
  // Precompressed files are also directly usable by Nginx gzip_static.
  async function compress(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) await compress(filename);
      else if (/\.(?:html|js|css|json|svg|xml|txt)$/.test(entry.name)) {
        const body = await readFile(filename);
        if (body.length < 512) continue;
        await writeFile(filename + '.gz', gzipSync(body, { level: 9 }));
        await writeFile(filename + '.br', brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }));
      }
    }
  }
  await compress(directory);
  return Object.fromEntries(written);
}
