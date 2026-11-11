import { cp, lstat, mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Prepare the existing GitHub Pages directory locally; this never pushes or deploys.
await import('./build.mjs');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const source = path.join(root, 'dist');
const target = path.resolve(root, 'docs');
if (path.relative(root, target) !== 'docs') throw new Error('Unexpected Pages output');
await mkdir(target, { recursive: true });
async function walk(folder) {
  const info = await lstat(folder);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Pages output must be an ordinary directory');
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filename));
    else if (entry.isFile()) files.push(filename);
    else throw new Error('Pages output contains a non-regular file');
  }
  return files;
}
const incoming = new Set((await walk(source)).map(file => path.relative(source, file)));
const previous = await walk(target);
await cp(source, target, { recursive: true });
for (const file of previous) {
  const relative = path.relative(target, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Refusing cleanup outside Pages output');
  if (relative !== '.nojekyll' && !incoming.has(relative)) await unlink(file);
}
await writeFile(path.join(target, '.nojekyll'), '');
console.log('Prepared docs/ from dist/ locally. No commit, push or deployment performed.');
