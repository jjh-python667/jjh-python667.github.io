import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const date = value => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(value));
const names = { 'dealhunter': '全球羊毛情报中心', 'newsdesk': '资讯台 Newsdesk', 'antou-office-agent': '案头 ANTOU', 'personal-learning-agent': '学习搭子', 'yujiang-deepseek': '大肥鱼·雨酱',
  'grokbot-workflow-notes': 'AI 工具工作流笔记', 'star-wars-mini': '星球大战 mini', 'python-learning': 'Python 学习记录' };

export async function renderSite(directory, { requireIcp = false } = {}) {
  const config = JSON.parse(await readFile(path.join(directory, 'data/site.json'), 'utf8'));
  const updates = JSON.parse(await readFile(path.join(directory, 'data/updates.json'), 'utf8'));
  const growth = JSON.parse(await readFile(path.join(directory, 'data/growth.json'), 'utf8'));
  const icp = config.icp_number.trim();
  if (requireIcp && !icp) throw new Error("Fill the approved ICP number in site/data/site.json before releasing to the Shanghai ECS.");
  if (icp && !/^[\u4e00-\u9fff]ICP备\d{6,12}号(?:-\d+)?$/.test(icp)) throw new Error('Check the ICP number in site/data/site.json');
  const e = escapeHtml;
  const items = updates.items.slice(0, 3);
  const latest = items[0];
  const repoUrl = name => 'https://github.com/' + encodeURIComponent(config.github_user) + '/' + encodeURIComponent(name);
  const updateHtml = items.map(item => '<div class="update-item"><a href="' + repoUrl(item.name) +
    '" target="_blank" rel="noopener noreferrer">' + e(names[item.name] || item.name) + '</a><p>' + e(config.project_descriptions?.[item.name] || item.description || '项目说明见公开仓库。') +
    '</p><div class="update-meta"><span>最近更新：<time datetime="' + e(item.pushed_at) + '">' + date(item.pushed_at) + '</time></span>' +
    (item.language ? '<span>' + e(item.language) + '</span>' : '') + '</div></div>').join('');
  const workbench = latest ? '<h2>工作台</h2><div class="wb-block"><p class="wb-label">最近在改进</p><a class="wb-update" href="' +
    repoUrl(latest.name) + '" target="_blank" rel="noopener noreferrer"><span class="wb-name">' +
    e(names[latest.name] || latest.name) + '</span><span class="wb-meta">更新于 ' + date(latest.pushed_at) + '</span></a></div>' : '';
  const done = growth.done.map(item => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) throw new Error('Invalid growth date');
    if (item.href && !/^(?:#works|projects\/[a-z0-9-]+\.html)$/.test(item.href)) throw new Error('Invalid growth link');
    return '<li class="timeline-item"><time datetime="' + e(item.date) + '">' + e(item.date) +
      '</time><div class="timeline-body"><strong>' + e(item.title) + '</strong><p>' + e(item.description) +
      '</p>' + (item.href ? '<a class="timeline-link" href="' + e(item.href) + '">看看相关作品 →</a>' : '') + '</div></li>';
  }).join('');
  const doing = growth.doing.map(item => '<div class="current-goal"><strong>' + e(item.title) +
    '</strong><p>' + e(item.description) + '</p></div>').join('') || '<p class="empty">下一件想做的事，还在酝酿。</p>';
  const indexPath = path.join(directory, 'index.html');
  let html = await readFile(indexPath, 'utf8');
  const updatesStart = html.indexOf('      <div class="updates">');
  const updatesEnd = html.indexOf('    </section>', updatesStart);
  const growthStart = html.indexOf('<div class="growth-grid">');
  const growthEnd = html.indexOf('    </section>', growthStart);
  if ([updatesStart, updatesEnd, growthStart, growthEnd].some(i => i < 0)) throw new Error('Expected homepage sections missing');
  html = html.slice(0, growthStart) + '<div class="growth-grid"><div class="panel"><h3>我正在做</h3>' + doing +
    '</div><div class="panel"><h3>已完成</h3><ol class="timeline">' + done + '</ol></div></div>\n' + html.slice(growthEnd);
  html = html.slice(0, updatesStart) + '<div class="updates">' + updateHtml + '</div><p class="sync-bar">资料核对于 ' +
    date(updates.synced_at) + ' · 来自公开 GitHub 仓库</p>\n' + html.slice(updatesEnd);
  html = html.replace(/(<aside class="workshop-card workbench[^"]*"[^>]*>)[\s\S]*?(<\/aside>)/g, '$1' + workbench + '$2');
  await writeFile(indexPath, html);
  const files = ['index.html', '404.html', 'agent.html', ...(await readdir(path.join(directory, 'projects'))).filter(f => f.endsWith('.html')).map(f => 'projects/' + f)];
  for (const file of files) {
    const filename = path.join(directory, file);
    let page = await readFile(filename, 'utf8');
    const footer = icp ? '<p class="icp"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">' +
      e(icp) + '</a></p>' : '<p class="icp" hidden data-icp-placeholder></p>';
    page = page.replace(/<p class="icp"[^>]*>[\s\S]*?<\/p>/, footer);
    await writeFile(filename, page);
  }
}
