import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'site/data/updates.json');
const config = JSON.parse(await readFile(path.join(root, 'site/data/site.json'), 'utf8'));
const temporary = target + '.' + randomUUID() + '.tmp';
try {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'jjh-portfolio' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const repos = [];
  for (let page = 1; ; page++) {
    const url = 'https://api.github.com/users/' + encodeURIComponent(config.github_user) +
      '/repos?type=owner&sort=pushed&per_page=100&page=' + page;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('GitHub returned HTTP ' + response.status);
    const batch = await response.json();
    if (!Array.isArray(batch) || batch.some(item => !item.name || !Number.isFinite(Date.parse(item.pushed_at)))) {
      throw new Error('Unexpected GitHub response');
    }
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const items = repos.filter(item => !item.fork && !item.archived && !config.exclude_repositories.includes(item.name))
    .sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at)).slice(0, 3).map(item => ({
      name: item.name, description: item.description || '', language: item.language,
      pushed_at: item.pushed_at, html_url: item.html_url, topics: item.topics || []
    }));
  const snapshot = { synced_at: new Date().toISOString(), source: 'github_api', github_user: config.github_user, items };
  await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n');
  try {
    await rename(temporary, target);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    const previousPath = temporary + '.previous';
    const previous = await readFile(target);
    await writeFile(previousPath, previous);
    try {
      await writeFile(target, JSON.stringify(snapshot, null, 2) + '\n');
    } catch (writeError) {
      try {
        await writeFile(target, previous);
      } catch (restoreError) {
        throw new Error('Snapshot recovery file preserved at ' + previousPath, { cause: restoreError });
      }
      await rm(previousPath, { force: true });
      throw writeError;
    }
    await rm(previousPath, { force: true });
  }
  console.log('Synced ' + items.length + ' public projects. Run npm run build to update pages.');
} catch (error) {
  const old = JSON.parse(await readFile(target, 'utf8'));
  if (!Array.isArray(old.items) || !Number.isFinite(Date.parse(old.synced_at))) throw error;
  console.warn('Sync unavailable. Kept the last successful snapshot: ' + error.message);
} finally {
  await rm(temporary, { force: true });
}
