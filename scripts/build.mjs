import { cp, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSite } from './render.mjs';
import { optimizeStatic } from './optimize-static.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const source = path.join(root, 'site');
const destination = path.join(root, 'dist');
const lockPath = path.join(root, '.build.lock');
const lock = await open(lockPath, 'wx').catch(error => {
  if (error.code === 'EEXIST') throw new Error('A build is already running. If it was interrupted, remove .build.lock before retrying.');
  throw error;
});
let staging;
let preserveStaging = false;

// Only generated output and this build's staging directory may be removed.
async function removeManaged(target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Refusing to remove a path outside the project');
  }
  await rm(target, { recursive: true, force: true });
}

async function assertOrdinaryTree(directory) {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Expected an ordinary build directory');
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) await assertOrdinaryTree(item);
    else if (!entry.isFile()) throw new Error('Build output must contain ordinary files and directories');
  }
}

// Some Windows encrypted or redirected folders reject directory rename with EXDEV.
// Copy file contents to preserve support for those folders, including stale-file removal.
async function mirrorContents(from, to) {
  await mkdir(to, { recursive: true });
  const incoming = await readdir(from, { withFileTypes: true });
  const outgoing = new Map((await readdir(to, { withFileTypes: true })).map(entry => [entry.name, entry]));
  for (const entry of incoming) {
    const target = path.join(to, entry.name);
    const old = outgoing.get(entry.name);
    if (old && old.isDirectory() !== entry.isDirectory()) await removeManaged(target);
    if (entry.isDirectory()) await mirrorContents(path.join(from, entry.name), target);
    else await writeFile(target, await readFile(path.join(from, entry.name)));
    outgoing.delete(entry.name);
  }
  for (const name of outgoing.keys()) await removeManaged(path.join(to, name));
}

try {
  staging = await mkdtemp(path.join(root, '.build-'));
  const candidate = path.join(staging, 'candidate');
  const previous = path.join(staging, 'previous');
  await cp(source, candidate, { recursive: true });
  await stat(path.join(candidate, 'index.html'));
  await renderSite(candidate, { requireIcp: process.argv.includes('--release') });
  await optimizeStatic(candidate);
  await assertOrdinaryTree(candidate);

  let hasPrevious = false;
  let copyMode = false;
  try {
    await assertOrdinaryTree(destination);
    hasPrevious = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (hasPrevious) {
    try {
      await rename(destination, previous);
    } catch (error) {
      if (error.code !== 'EXDEV') throw error;
      await cp(destination, previous, { recursive: true });
      copyMode = true;
    }
  }

  try {
    if (!copyMode) {
      try {
        await rename(candidate, destination);
      } catch (error) {
        if (error.code !== 'EXDEV') throw error;
        copyMode = true;
      }
    }
    if (copyMode) await mirrorContents(candidate, destination);
  } catch (error) {
    try {
      if (hasPrevious) await mirrorContents(previous, destination);
      else await removeManaged(destination);
    } catch (restoreError) {
      preserveStaging = true;
      throw new Error('Build failed. Recovery files preserved at ' + staging, { cause: restoreError });
    }
    throw error;
  }

  console.log('Built static site at ' + destination + (copyMode ? ' (Windows copy fallback)' : ''));
} finally {
  try {
    if (staging && !preserveStaging) await removeManaged(staging);
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
