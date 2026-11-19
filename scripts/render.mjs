import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const formatDate = value => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(value));

function renderLinks(links = [], e) {
  if (!Array.isArray(links) || !links.length) return '';
  return '<div class="update-links">' + links.map(l => {
    const attrs = l.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const cls = l.external ? 'update-link is-ext' : 'update-link';
    return '<a class="' + cls + '" href="' + e(l.href) + '"' + attrs + '>' + e(l.label) + (l.external ? ' ↗' : ' →') + '</a>';
  }).join('') + '</div>';
}

function renderUpdateCard(item, e, { spotlight = false } = {}) {
  const status = item.status || (item.date ? '已完成' : '进行中');
  const isWip = status === '进行中' || !item.date;
  const dateLabel = item.date ? '<time datetime="' + e(item.date) + '">' + e(item.date) + '</time>' : '<span class="status-wip-date">持续推进中</span>';
  const badgeCls = isWip ? 'upd-badge is-wip' : (status === '里程碑' ? 'upd-badge is-milestone' : 'upd-badge');
  const tagHtml = item.tag ? '<span class="upd-tag">' + e(item.tag) + '</span>' : '';
  return '<article class="' + (spotlight ? 'update-card is-spotlight' : 'update-card') + '">' +
    '<div class="update-card-top"><span class="' + badgeCls + '">' + e(status) + '</span>' + dateLabel + tagHtml + '</div>' +
    '<h3>' + e(item.title) + '</h3>' +
    '<p>' + e(item.description) + '</p>' +
    renderLinks(item.links, e) +
    '</article>';
}

export async function renderSite(directory, { requireIcp = false } = {}) {
  const config = JSON.parse(await readFile(path.join(directory, 'data/site.json'), 'utf8'));
  const updates = JSON.parse(await readFile(path.join(directory, 'data/updates.json'), 'utf8'));
  const growth = JSON.parse(await readFile(path.join(directory, 'data/growth.json'), 'utf8'));
  const icp = config.icp_number.trim();
  if (requireIcp && !icp) throw new Error("Fill the approved ICP number in site/data/site.json before releasing to the Shanghai ECS.");
  if (icp && !/^[\u4e00-\u9fff]ICP备\d{6,12}号(?:-\d+)?$/.test(icp)) throw new Error('Check the ICP number in site/data/site.json');
  const e = escapeHtml;

  const allItems = Array.isArray(updates.items) ? updates.items : [];
  const homeItems = allItems.slice(0, 5);
  const spotlightItem = homeItems[0];
  const restHomeItems = homeItems.slice(1);

  const updatesSectionHtml = spotlightItem
    ? '<div class="updates-layout">' +
        renderUpdateCard(spotlightItem, e, { spotlight: true }) +
        '<div class="updates-grid">' + restHomeItems.map(item => renderUpdateCard(item, e)).join('') + '</div>' +
      '</div>' +
      '<div class="updates-footer-bar">' +
        '<p class="sync-bar">单数据源维护于 <code>site/data/updates.json</code> · 最近核对 ' + formatDate(updates.synced_at) + '</p>' +
        '<a class="btn btn-primary" href="updates.html">查看全部动态（共 ' + allItems.length + ' 条） →</a>' +
      '</div>'
    : '<p class="empty">暂无公开动态。</p>';

  const latestDoing = allItems.find(x => x.status === '进行中' || !x.date);
  const latestMilestone = allItems.find(x => Boolean(x.date));
  const nowCardHtml = [
    '<div class="now-card-head"><span class="now-pill"><i class="plaque-dot" aria-hidden="true"></i>最近在做什么</span><a class="now-all-link" href="#updates">看全部 ↓</a></div>',
    latestMilestone
      ? '<div class="now-item is-primary"><div class="now-meta"><span class="upd-badge is-milestone">' + e(latestMilestone.status || '最新进展') + '</span><time datetime="' + e(latestMilestone.date) + '">' + e(latestMilestone.date) + '</time></div><strong>' + e(latestMilestone.title) + '</strong><p>' + e(latestMilestone.description) + '</p>' + renderLinks((latestMilestone.links || []).slice(0, 2), e) + '</div>'
      : '',
    latestDoing
      ? '<div class="now-item is-secondary"><div class="now-meta"><span class="upd-badge is-wip">进行中</span></div><strong>' + e(latestDoing.title) + '</strong><p>' + e(latestDoing.description) + '</p></div>'
      : ''
  ].join('');

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
  html = html.replace(/(<div class="updates" data-updates-feed>)[\s\S]*?(<\/div><!-- \/updates-feed -->)/, '$1' + updatesSectionHtml + '$2');
  html = html.replace(/(<aside class="hero-now-card"[^>]*>)[\s\S]*?(<\/aside>)/, '$1' + nowCardHtml + '$2');

  const growthStart = html.indexOf('<div class="growth-grid">');
  const growthEnd = html.indexOf('    </section>', growthStart);
  if (growthStart >= 0 && growthEnd >= 0) {
    html = html.slice(0, growthStart) + '<div class="growth-grid"><div class="panel"><h3>我正在做</h3>' + doing +
      '</div><div class="panel"><h3>已完成</h3><ol class="timeline">' + done + '</ol></div></div>\n' + html.slice(growthEnd);
  }
  await writeFile(indexPath, html);

  const updatesPagePath = path.join(directory, 'updates.html');
  let upHtml = await readFile(updatesPagePath, 'utf8');
  const archiveHtml = '<ol class="archive-timeline">' + allItems.map((item, idx) =>
    '<li class="archive-item">' + renderUpdateCard(item, e, { spotlight: idx === 0 }) + '</li>'
  ).join('') + '</ol>';
  upHtml = upHtml.replace(/(<div class="updates-archive" data-updates-archive>)[\s\S]*?(<\/div><!-- \/updates-archive -->)/, '$1' + archiveHtml + '$2');
  upHtml = upHtml.replace(/data-updates-total>[^<]*/, 'data-updates-total>共 ' + allItems.length + ' 条记录');
  await writeFile(updatesPagePath, upHtml);

  const files = ['index.html', 'updates.html', '404.html', 'agent.html', ...(await readdir(path.join(directory, 'projects'))).filter(f => f.endsWith('.html')).map(f => 'projects/' + f)];
  for (const file of files) {
    const filename = path.join(directory, file);
    let page = await readFile(filename, 'utf8');
    const footer = icp ? '<p class="icp"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">' +
      e(icp) + '</a></p>' : '<p class="icp" hidden data-icp-placeholder></p>';
    page = page.replace(/<p class="icp"[^>]*>[\s\S]*?<\/p>/, footer);
    await writeFile(filename, page);
  }
}
