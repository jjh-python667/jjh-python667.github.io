import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORTFOLIO_URL = 'https://jjh-python667.github.io/';
const OPTIONAL_URLS = ['https://dealhunter.gongjiang667.workers.dev/'];
const BASELINE_PATH = '.github/patrol/baseline.json';
const LIGHTHOUSE_SPEC = 'lighthouse@13.6.0';
const ISSUE_TITLE = '站点巡检：待处理问题';
const ISSUE_LABEL = 'site-patrol';
const MAX_URLS = 250;
const MAX_HTML_PAGES = 40;
const MAX_BODY_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 20_000;
const CONCURRENCY = 2;
const START_INTERVAL_MS = 400;
const USER_AGENT = 'jjh-portfolio-patrol/1.0 (+https://github.com/jjh-python667/jjh-python667.github.io)';
const SCORE_RULES = {
  performance: { warnBelow: 50, failBelow: 25 },
  accessibility: { warnBelow: 90, failBelow: 80 },
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseArgs(argv) {
  const args = {
    portfolio: PORTFOLIO_URL,
    optional: [],
    baseline: BASELINE_PATH,
    out: '',
    json: '',
    summary: process.env.GITHUB_STEP_SUMMARY || '',
    dryRun: false,
    writeBaseline: false,
    skipLighthouse: false,
    selfCheck: false,
  };
  let optionalPassed = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for ' + token);
      index += 1;
      return value;
    };
    if (token === '--dry-run') args.dryRun = true;
    else if (token === '--write-baseline') args.writeBaseline = true;
    else if (token === '--skip-lighthouse') args.skipLighthouse = true;
    else if (token === '--self-check') args.selfCheck = true;
    else if (token === '--portfolio') args.portfolio = next();
    else if (token === '--baseline') args.baseline = next();
    else if (token === '--out') args.out = next();
    else if (token === '--json') args.json = next();
    else if (token === '--summary') args.summary = next();
    else if (token === '--optional') {
      if (!optionalPassed) {
        args.optional = [];
        optionalPassed = true;
      }
      args.optional.push(next());
    } else throw new Error('Unknown argument ' + token);
  }
  if (!optionalPassed) args.optional = [...OPTIONAL_URLS];
  return args;
}

function createLimiter({ concurrency, intervalMs }) {
  let active = 0;
  let nextStart = 0;
  const waiting = [];
  function kick() {
    while (active < concurrency && waiting.length) {
      const job = waiting.shift();
      const now = Date.now();
      const delay = Math.max(0, nextStart - now);
      nextStart = now + delay + intervalMs;
      active += 1;
      setTimeout(() => {
        Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(() => {
          active -= 1;
          kick();
        });
      }, delay);
    }
  }
  return fn => new Promise((resolve, reject) => {
    waiting.push({ fn, resolve, reject });
    kick();
  });
}

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, entity) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return all;
      return String.fromCodePoint(code);
    }
    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : all;
  });
}

function attributes(tag) {
  const attrs = {};
  const re = /([:@\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match;
  while ((match = re.exec(tag))) attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  return attrs;
}

function normalizeHttpUrl(raw, base) {
  if (!raw) return '';
  const value = decodeEntities(String(raw).trim());
  if (!value || value.startsWith('#') || /^(?:mailto:|tel:|javascript:|data:)/i.test(value)) return '';
  let url;
  try {
    url = new URL(value, base);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  url.hash = '';
  return url.href;
}

function extractHtmlLinks(html, base) {
  const found = [];
  const tagRe = /<(a|link|img|script|source|iframe|video|audio|meta)\b[^>]*>/gi;
  let match;
  while ((match = tagRe.exec(html))) {
    const tag = match[0];
    const attrs = attributes(tag);
    const name = match[1].toLowerCase();
    if (name === 'meta') {
      const prop = (attrs.property || attrs.name || '').toLowerCase();
      if (prop === 'og:image' || prop === 'twitter:image' || prop === 'og:image:url') {
        const url = normalizeHttpUrl(attrs.content, base);
        if (url) found.push(url);
      }
      continue;
    }
    for (const key of ['href', 'src', 'poster']) {
      const url = normalizeHttpUrl(attrs[key], base);
      if (url) found.push(url);
    }
    if (attrs.srcset) {
      for (const part of attrs.srcset.split(',')) {
        const candidate = part.trim().split(/\s+/)[0];
        const url = normalizeHttpUrl(candidate, base);
        if (url) found.push(url);
      }
    }
  }
  return found;
}

function extractCssUrls(css, base) {
  const found = [];
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let match;
  while ((match = re.exec(css))) {
    const value = match[2].trim();
    if (!value || value.startsWith('data:') || value.startsWith('#') || value.startsWith('%23')) continue;
    const url = normalizeHttpUrl(value, base);
    if (url) found.push(url);
  }
  return found;
}

function extractSitemapLocs(xml) {
  const found = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match;
  while ((match = re.exec(xml))) {
    const url = normalizeHttpUrl(decodeEntities(match[1]), PORTFOLIO_URL);
    if (url) found.push(url);
  }
  return found;
}

function pathnameOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

function likelyDocument(url) {
  const pathname = pathnameOf(url);
  if (pathname.endsWith('/')) return true;
  const last = pathname.split('/').pop() || '';
  if (!last.includes('.')) return true;
  return /\.html?$/i.test(last);
}

function wantsBody(url) {
  const pathname = pathnameOf(url).toLowerCase();
  return likelyDocument(url) || pathname.endsWith('.css') || pathname.endsWith('.xml') || pathname.endsWith('.txt');
}

function hostnameOf(url) {
  return new URL(url).hostname;
}

function classify(record) {
  const reachable = record.status > 0 && !record.error;
  if (record.optional) {
    if (!reachable || record.status >= 400) return 'warn';
    return 'ok';
  }
  if (!reachable) return 'hard';
  if (record.status >= 200 && record.status < 400) return 'ok';
  if ((record.status === 401 || record.status === 403) && !record.sameOrigin) return 'warn';
  if (record.status === 429) return 'warn';
  if (record.status >= 400) return 'hard';
  return 'warn';
}

function scoreLevel(category, score, required) {
  if (typeof score !== 'number') return required ? 'hard' : 'warn';
  const rules = SCORE_RULES[category];
  if (score < rules.failBelow) return required ? 'hard' : 'warn';
  if (score < rules.warnBelow) return 'warn';
  return 'ok';
}

function shanghaiNow(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} +08:00`;
}

async function requestOnce(url, { method, read }) {
  const response = await fetch(url, {
    method,
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: read ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' : '*/*',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const contentType = response.headers.get('content-type') || '';
  const lastModified = response.headers.get('last-modified') || '';
  if (!read) {
    await response.body?.cancel();
    return { status: response.status, finalUrl: response.url || url, contentType, lastModified, body: '', bytes: 0, sha256: '', truncated: false };
  }
  const chunks = [];
  let received = 0;
  let truncated = false;
  const reader = response.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        truncated = true;
        const keep = value.byteLength - (received - MAX_BODY_BYTES);
        if (keep > 0) chunks.push(value.subarray(0, keep));
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }
  const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
  return {
    status: response.status,
    finalUrl: response.url || url,
    contentType,
    lastModified,
    body: buffer.toString('utf8'),
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    truncated,
  };
}

async function requestWithRetry(url, { read }) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let result = await requestOnce(url, { method: read ? 'GET' : 'HEAD', read });
      if (!read && [400, 403, 404, 405, 501].includes(result.status)) {
        result = await requestOnce(url, { method: 'GET', read: false });
      }
      if ([429, 502, 503, 504].includes(result.status) && attempt === 0) {
        await sleep(1500);
        continue;
      }
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await sleep(1500);
        continue;
      }
    }
  }
  throw lastError;
}

function addSource(record, source) {
  if (!source || record.sources.includes(source) || record.sources.length >= 8) return;
  record.sources.push(source);
}

async function crawl(args) {
  const portfolio = new URL(args.portfolio);
  const optionalHosts = new Set(args.optional.map(url => hostnameOf(url)));
  const limit = createLimiter({ concurrency: CONCURRENCY, intervalMs: START_INTERVAL_MS });
  const checked = new Map();
  const queued = new Set();
  const pendingSources = new Map();
  const queue = [];
  let truncatedQueue = false;
  let pageCap = false;
  let htmlPages = 0;

  function enqueue(item) {
    const url = normalizeHttpUrl(item.url);
    if (!url) return;
    const existing = checked.get(url);
    if (existing) {
      addSource(existing, item.source);
      return;
    }
    if (queued.has(url)) {
      const list = pendingSources.get(url) || [];
      if (item.source && !list.includes(item.source) && list.length < 8) {
        list.push(item.source);
        pendingSources.set(url, list);
      }
      return;
    }
    if (queued.size >= MAX_URLS) {
      truncatedQueue = true;
      return;
    }
    queued.add(url);
    queue.push({ ...item, url });
  }

  enqueue({ url: portfolio.href, read: true, source: '入口', role: 'portfolio' });
  for (const url of args.optional) enqueue({ url, read: true, source: '可选目标', role: 'optional' });
  enqueue({ url: new URL('/robots.txt', portfolio).href, read: true, source: '入口', role: 'robots' });
  enqueue({ url: new URL('/sitemap.xml', portfolio).href, read: true, source: '入口', role: 'sitemap' });

  async function check(item) {
    const existing = checked.get(item.url);
    if (existing) {
      addSource(existing, item.source);
      await existing.done;
      return existing;
    }
    const record = {
      url: item.url,
      role: item.role,
      sources: item.source ? [item.source] : [],
      status: 0,
      finalUrl: '',
      ms: 0,
      error: '',
      contentType: '',
      lastModified: '',
      bytes: 0,
      sha256: '',
      truncated: false,
      body: '',
      sameOrigin: hostnameOf(item.url) === portfolio.hostname,
      optional: optionalHosts.has(hostnameOf(item.url)),
    };
    for (const source of pendingSources.get(item.url) || []) addSource(record, source);
    record.done = (async () => {
      const started = Date.now();
      try {
        const result = await limit(() => requestWithRetry(item.url, { read: item.read }));
        record.status = result.status;
        record.finalUrl = result.finalUrl;
        record.contentType = result.contentType;
        record.lastModified = result.lastModified;
        record.bytes = result.bytes;
        record.sha256 = result.sha256;
        record.truncated = result.truncated;
        record.body = result.body;
      } catch (error) {
        const code = error?.cause?.code || error?.name || 'Error';
        record.error = code === 'TimeoutError' ? 'timeout' : String(code);
      } finally {
        record.ms = Date.now() - started;
      }
    })();
    checked.set(item.url, record);
    await record.done;
    return record;
  }

  while (queue.length) {
    const item = queue.shift();
    const record = await check(item);
    process.stderr.write(`checked ${record.status || record.error} ${record.url}\n`);
    if (record.role === 'optional') {
      record.body = '';
      continue;
    }
    if (!(record.status >= 200 && record.status < 400) || !record.body) {
      record.body = '';
      continue;
    }
    const base = record.finalUrl || record.url;
    const discovered = [];
    if (record.role === 'robots' || pathnameOf(record.url).endsWith('/robots.txt')) {
      for (const line of record.body.split(/\r?\n/)) {
        const match = line.match(/^\s*Sitemap:\s*(\S+)/i);
        if (match) discovered.push(normalizeHttpUrl(match[1]));
      }
    } else if (pathnameOf(record.url).toLowerCase().endsWith('.xml') || record.contentType.includes('xml')) {
      if (record.sameOrigin) discovered.push(...extractSitemapLocs(record.body));
    } else if (record.sameOrigin && (record.contentType.includes('text/css') || pathnameOf(record.url).toLowerCase().endsWith('.css'))) {
      discovered.push(...extractCssUrls(record.body, base));
    } else if (record.sameOrigin && (record.contentType.includes('text/html') || likelyDocument(record.url))) {
      if (htmlPages >= MAX_HTML_PAGES) {
        pageCap = true;
        record.body = '';
        continue;
      }
      htmlPages += 1;
      discovered.push(...extractHtmlLinks(record.body, base));
    }
    record.body = '';
    for (const url of discovered) {
      if (!url) continue;
      const sameOrigin = hostnameOf(url) === portfolio.hostname;
      const optional = optionalHosts.has(hostnameOf(url));
      enqueue({
        url,
        read: sameOrigin && wantsBody(url),
        source: record.url,
        role: optional ? 'optional-link' : sameOrigin ? 'internal' : 'external',
      });
    }
  }

  return { checked: [...checked.values()], truncatedQueue, pageCap, htmlPages, portfolio: portfolio.href };
}

function findingText(record) {
  const where = record.sources.length ? record.sources.join('、') : '无来源记录';
  const status = record.error ? `不可达（${record.error}）` : `HTTP ${record.status}`;
  return `- ${record.url} — ${status} — 来源：${where}`;
}

function levelLabel(level) {
  if (level === 'hard') return '未通过';
  if (level === 'warn') return '警告';
  return '通过';
}

function cleanDisplay(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function metricLine(audit) {
  if (!audit || !audit.displayValue) return '';
  return cleanDisplay(audit.displayValue);
}

function summarizeLighthouse(json, required) {
  if (!json) {
    return { required, version: '', formFactor: '', finalUrl: '', scores: {}, metrics: {}, failed: [], level: required ? 'hard' : 'warn', error: '没有 Lighthouse 结果' };
  }
  const scores = {};
  const failed = [];
  let level = 'ok';
  for (const category of ['performance', 'accessibility']) {
    const raw = json.categories?.[category]?.score;
    const score = typeof raw === 'number' ? Math.round(raw * 100) : null;
    scores[category] = score;
    const categoryLevel = scoreLevel(category, score, required);
    if (categoryLevel === 'hard') level = 'hard';
    else if (categoryLevel === 'warn' && level !== 'hard') level = 'warn';
    const refs = json.categories?.[category]?.auditRefs || [];
    for (const ref of refs) {
      const audit = json.audits?.[ref.id];
      if (!audit || typeof audit.score !== 'number' || audit.score >= 0.9) continue;
      if (!(typeof ref.weight === 'number' && ref.weight > 0)) continue;
      const mode = audit.scoreDisplayMode;
      if (mode === 'notApplicable' || mode === 'manual' || mode === 'informative') continue;
      failed.push({ category, id: ref.id, title: audit.title, display: cleanDisplay(audit.displayValue) });
    }
  }
  return {
    required,
    version: json.lighthouseVersion || '',
    formFactor: json.configSettings?.formFactor || '',
    finalUrl: json.finalDisplayedUrl || json.finalUrl || '',
    scores,
    metrics: {
      fcp: metricLine(json.audits?.['first-contentful-paint']),
      lcp: metricLine(json.audits?.['largest-contentful-paint']),
      tbt: metricLine(json.audits?.['total-blocking-time']),
      cls: metricLine(json.audits?.['cumulative-layout-shift']),
    },
    failed: failed.slice(0, 15),
    level,
    error: '',
  };
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return '';
}

function nodeSupportsLighthouse() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 19);
}

async function runLighthouse(url, outputPath, chromePath) {
  const args = [
    '--yes',
    LIGHTHOUSE_SPEC,
    url,
    '--quiet',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage',
    '--only-categories=performance,accessibility',
    '--output=json',
    `--output-path=${outputPath}`,
    '--disable-full-page-screenshot',
    '--max-wait-for-load=60000',
  ];
  const env = { ...process.env, CHROME_PATH: chromePath || process.env.CHROME_PATH || '' };
  const child = spawn('npx', args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  child.stdout.on('data', () => {});
  const timer = setTimeout(() => child.kill('SIGKILL'), 180000);
  const code = await new Promise(resolve => child.on('close', resolve));
  clearTimeout(timer);
  if (code !== 0) throw new Error(`Lighthouse 退出码 ${code}${stderr ? '：' + stderr.trim().slice(-500) : ''}`);
  const json = JSON.parse(await readFile(outputPath, 'utf8'));
  return json;
}

async function maybeEnhance(facts, enabled) {
  if (!enabled) {
    return { used: false, reason: '未调用 GitHub Models（本地 dry-run 不读取令牌）。', summary: '' };
  }
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) return { used: false, reason: '没有 GITHUB_TOKEN，已使用规则报告。', summary: '' };
  const factsJson = JSON.stringify(facts);
  try {
    const response = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        temperature: 0,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: '你是站点巡检记录员。只根据用户给出的 JSON 写一段中文摘要，不超过 300 字。不得新增 JSON 里没有的网址、状态码、分数、哈希或故障。不要给出 JSON 之外的修复步骤。',
          },
          { role: 'user', content: factsJson },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      return { used: false, reason: `GitHub Models 返回 HTTP ${response.status}，已回退到规则报告。`, summary: '' };
    }
    const payload = await response.json();
    const text = String(payload?.choices?.[0]?.message?.content || '').replace(/```[\s\S]*?```/g, match => match.replace(/```json|```/g, '')).trim();
    if (!grounded(text, factsJson)) {
      return { used: false, reason: '模型输出与测量数据对不上，已回退到规则报告。', summary: '' };
    }
    return { used: true, reason: '已用 GitHub Models（openai/gpt-4o-mini）补了一段摘要，数字以规则报告为准。', summary: text };
  } catch (error) {
    const name = error?.name === 'TimeoutError' ? '超时' : '请求失败';
    return { used: false, reason: `GitHub Models ${name}，已回退到规则报告。`, summary: '' };
  }
}

function grounded(text, factsJson) {
  if (!text || text.length > 1200) return false;
  const urls = text.match(/https?:\/\/[^\s)\]>"']+/g) || [];
  if (urls.some(url => !factsJson.includes(url.replace(/[.,。]+$/g, '')))) return false;
  const numbers = text.match(/\d{2,}/g) || [];
  return numbers.every(number => factsJson.includes(number));
}

function buildFacts(state) {
  return {
    generatedAt: state.generatedAt,
    portfolio: {
      url: state.portfolio.url,
      status: state.portfolio.status,
      error: state.portfolio.error || '',
      hash: state.portfolio.sha256 || '',
      hashMatchesBaseline: state.hashComparison,
    },
    optional: state.optional.map(record => ({ url: record.url, status: record.status, error: record.error || '' })),
    links: state.counts,
    hard: state.hard.map(record => ({ url: record.url, status: record.status, error: record.error || '' })),
    warnings: (state.linkWarnings || []).map(record => ({ url: record.url, status: record.status, error: record.error || '' })),
    lighthouse: state.lighthouse.map(item => ({
      url: item.url,
      required: item.required,
      performance: item.summary?.scores?.performance ?? null,
      accessibility: item.summary?.scores?.accessibility ?? null,
      error: item.error || item.summary?.error || '',
      level: item.summary?.level || 'warn',
    })),
  };
}

function buildReport(state) {
  const lines = [];
  lines.push('# 站点巡检报告');
  lines.push('');
  lines.push(`- 时间：${state.generatedAtShanghai}（${state.generatedAt}）`);
  lines.push(`- 模式：${state.dryRun ? '本地 dry-run' : 'GitHub Actions'}`);
  lines.push(`- 结论：**${state.conclusion}**`);
  lines.push(`- 报告来源：规则。${state.models.reason}`);
  if (state.models.summary) {
    lines.push('');
    lines.push('## 模型摘要');
    lines.push('');
    lines.push(state.models.summary);
    lines.push('');
    lines.push('下面的表格和名单仍是规则根据实测结果生成的。');
  }
  lines.push('');
  lines.push('## 可用性');
  lines.push('');
  lines.push('| 目标 | 角色 | 结果 | 最终 URL | 耗时 | Last-Modified |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  lines.push(availabilityRow('作品集', '必须', state.portfolio));
  for (const record of state.optional) lines.push(availabilityRow('Deal Hunter', '可选，失败不令任务失败', record));
  lines.push('');
  lines.push('## 首页内容哈希');
  lines.push('');
  lines.push(`- 算法：SHA-256（HTTP 响应正文，最多读取 ${MAX_BODY_BYTES} 字节）`);
  lines.push(`- 本次：\`${state.portfolio.sha256 || '无'}\``);
  lines.push(`- 字节：${state.portfolio.bytes || 0}${state.portfolio.truncated ? '（已截断，不与基线作结论）' : ''}`);
  lines.push(`- 基线文件：\`${state.baselinePath}\``);
  lines.push(`- 基线：\`${state.baselineHash || '无'}\``);
  lines.push(`- 比较：${state.hashComparison}`);
  lines.push('');
  lines.push('## 链接');
  lines.push('');
  lines.push(`共检查 ${state.counts.checked} 个 URL（站内 ${state.counts.internal}，站外 ${state.counts.external}）。限速：并发 ${CONCURRENCY}，相邻请求至少间隔 ${START_INTERVAL_MS} ms，单次超时 ${REQUEST_TIMEOUT_MS / 1000} 秒；HTTP 429/502/503/504 和网络错误重试 1 次。HEAD 遇到 400、403、404、405、501 时改用 GET。`);
  lines.push('');
  lines.push(`- 通过：${state.counts.ok}`);
  lines.push(`- 警告：${state.counts.warn}`);
  lines.push(`- 未通过：${state.counts.hard}`);
  if (state.truncatedQueue) lines.push('- 通知：待检查 URL 超过上限，后面的链接没有继续加入。');
  if (state.pageCap) lines.push(`- 通知：HTML 页面达到 ${MAX_HTML_PAGES} 页上限，没有继续展开。`);
  lines.push('');
  lines.push('### 未通过');
  lines.push('');
  lines.push(state.hard.length ? state.hard.map(findingText).join('\n') : '无。');
  lines.push('');
  lines.push('### 警告');
  lines.push('');
  lines.push(state.linkWarnings.length ? state.linkWarnings.map(findingText).join('\n') : '无。');
  lines.push('');
  lines.push('## Lighthouse');
  lines.push('');
  lines.push(`工具：\`${LIGHTHOUSE_SPEC}\`（免费开源 CLI），只跑 performance 与 accessibility，使用本机 Chrome headless。分数是单次实验数据，默认移动端模拟，会随机器和网络变化。`);
  lines.push('');
  lines.push(`判定：性能低于 ${SCORE_RULES.performance.warnBelow} 记警告，低于 ${SCORE_RULES.performance.failBelow} 且目标为必须时记未通过；无障碍低于 ${SCORE_RULES.accessibility.warnBelow} 记警告，低于 ${SCORE_RULES.accessibility.failBelow} 且目标为必须时记未通过。下面只列出计入类别分数、且单项低于 0.9 的审计。`);
  lines.push('');
  if (!state.lighthouse.length) lines.push('没有运行 Lighthouse。');
  for (const item of state.lighthouse) {
    lines.push(`### ${item.label}`);
    lines.push('');
    lines.push(`- URL：${item.url}`);
    lines.push(`- 结果：${levelLabel(item.summary?.level || 'warn')}`);
    if (item.error) {
      lines.push(`- 说明：${item.error}`);
      lines.push('');
      continue;
    }
    const summary = item.summary;
    lines.push(`- 版本：${summary.version || '未知'}；形态：${summary.formFactor || '未知'}`);
    lines.push(`- 性能：${summary.scores.performance ?? '无'}`);
    lines.push(`- 无障碍：${summary.scores.accessibility ?? '无'}`);
    const metrics = [`FCP ${summary.metrics.fcp || '无'}`, `LCP ${summary.metrics.lcp || '无'}`, `TBT ${summary.metrics.tbt || '无'}`, `CLS ${summary.metrics.cls || '无'}`];
    lines.push(`- 实验指标：${metrics.join('；')}`);
    if (summary.failed.length) {
      lines.push('- 计入分数且低于 0.9 的审计：');
      for (const audit of summary.failed) {
        lines.push(`  - ${audit.category} / ${audit.title}${audit.display ? '（' + audit.display + '）' : ''}`);
      }
    } else lines.push('- 计入分数且低于 0.9 的审计：无。');
    lines.push('');
  }
  lines.push('## 其他通知');
  lines.push('');
  lines.push(state.notices.length ? state.notices.map(item => `- ${item}`).join('\n') : '无。');
  lines.push('');
  lines.push('## 跟踪 issue');
  lines.push('');
  lines.push(state.issue.summary);
  lines.push('');
  lines.push('## 附录：全部 URL');
  lines.push('');
  lines.push('| 结果 | HTTP | 角色 | URL |');
  lines.push('| --- | --- | --- | --- |');
  const ordered = [...state.checked].sort((a, b) => (b.status || 0) - (a.status || 0) || a.url.localeCompare(b.url));
  for (const record of ordered) {
    const level = classify(record);
    const status = record.error ? record.error : String(record.status);
    lines.push(`| ${levelLabel(level)} | ${status} | ${record.role} | ${record.url} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function availabilityRow(label, role, record) {
  if (!record) return `| ${label} | ${role} | 未检查 |  |  |  |`;
  const result = record.error ? `不可达（${record.error}）` : `HTTP ${record.status}`;
  const finalUrl = record.finalUrl || record.url || '';
  return `| ${label} | ${role} | ${result} | ${finalUrl} | ${record.ms || 0} ms | ${record.lastModified || ''} |`;
}

async function github(pathname, { method = 'GET', body } = {}) {
  const token = process.env.GITHUB_TOKEN || '';
  const response = await fetch('https://api.github.com' + pathname, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 180) };
    }
  }
  const link = response.headers.get('link') || '';
  return { status: response.status, data, link };
}

function conclusionIn(text) {
  const match = String(text || '').match(/结论：\*\*(通过|有警告|未通过)\*\*/);
  return match ? match[1] : '';
}

function issuePlan(current, conclusion) {
  const open = Boolean(current && current.state === 'open');
  const recorded = conclusionIn(current && current.body);
  if (conclusion === '未通过') {
    if (!current) return { action: 'create', comment: true };
    if (open && recorded === '未通过') return { action: 'update', comment: false };
    return { action: 'reopen', comment: true };
  }
  if (conclusion === '通过' && open) return { action: 'close', comment: true };
  return { action: 'none', comment: false };
}

function clipReport(report) {
  if (report.length <= 60000) return report;
  return report.slice(0, 59000) + '\n\n（报告过长，已截断。完整文本见本次 workflow artifact。）\n';
}

async function syncIssue(repo, report, conclusion) {
  if (!process.env.GITHUB_TOKEN) {
    return { summary: '未同步 issue：没有 GITHUB_TOKEN。', error: true, needed: conclusion === '未通过', refreshBody: false };
  }
  const issues = [];
  for (let page = 1; page <= 5; page += 1) {
    const listed = await github(`/repos/${repo}/issues?state=all&per_page=100&page=${page}`);
    if (listed.status !== 200 || !Array.isArray(listed.data)) {
      return { summary: `读取 issue 列表失败（HTTP ${listed.status}）。`, error: true, needed: conclusion === '未通过', refreshBody: false };
    }
    issues.push(...listed.data);
    if (!listed.link.includes('rel="next"') || listed.data.length < 100) break;
  }
  const matches = issues.filter(item => !item.pull_request && (item.title === ISSUE_TITLE || (item.labels || []).some(itemLabel => itemLabel.name === ISSUE_LABEL)));
  const current = matches.find(item => item.state === 'open') || matches[0];
  const plan = issuePlan(current, conclusion);
  if (plan.action === 'none') {
    return { summary: '本次不改跟踪 issue。警告只留在 job summary。', error: false, needed: false, refreshBody: false };
  }
  const body = clipReport(report);
  if (plan.action === 'close') {
    const closed = await github(`/repos/${repo}/issues/${current.number}`, {
      method: 'PATCH',
      body: { state: 'closed' },
    });
    if (closed.status !== 200) {
      return { summary: `关闭 issue #${current.number} 失败（HTTP ${closed.status}）。`, error: false, needed: false, refreshBody: false };
    }
    await github(`/repos/${repo}/issues/${current.number}/comments`, {
      method: 'POST',
      body: { body: '结论已回到「通过」，关闭这条跟踪 issue。' },
    });
    return { summary: `结论回到通过，已关闭 issue #${current.number}。`, error: false, needed: false, number: current.number, refreshBody: false };
  }
  const label = await github(`/repos/${repo}/labels`, {
    method: 'POST',
    body: { name: ISSUE_LABEL, color: 'b60205', description: '站点巡检未通过时的跟踪 issue。' },
  });
  if (![200, 201, 422].includes(label.status)) {
    return { summary: `未能确认标签 ${ISSUE_LABEL}（HTTP ${label.status}）。`, error: true, needed: true, refreshBody: false };
  }
  let number = current && current.number;
  if (plan.action === 'create') {
    const created = await github(`/repos/${repo}/issues`, {
      method: 'POST',
      body: { title: ISSUE_TITLE, body, labels: [ISSUE_LABEL] },
    });
    if (created.status !== 201) return { summary: `创建跟踪 issue 失败（HTTP ${created.status}）。`, error: true, needed: true, refreshBody: false };
    number = created.data.number;
  } else {
    const labels = [...new Set([...(current.labels || []).map(itemLabel => itemLabel.name), ISSUE_LABEL])];
    const updated = await github(`/repos/${repo}/issues/${number}`, {
      method: 'PATCH',
      body: { title: ISSUE_TITLE, body, state: 'open', labels },
    });
    if (updated.status !== 200) return { summary: `更新 issue #${number} 失败（HTTP ${updated.status}）。`, error: true, needed: true, refreshBody: false };
  }
  if (plan.comment) {
    await github(`/repos/${repo}/issues/${number}/comments`, {
      method: 'POST',
      body: { body: '结论变为「未通过」。' },
    });
  }
  const summary = plan.comment ? `结论变为未通过，已写入 issue #${number}。` : `结论仍是未通过，已更新 issue #${number} 的正文，没有新增评论。`;
  return { summary, error: false, needed: true, number, refreshBody: true };
}

async function writeOutput(file, contents) {
  if (!file) return;
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await writeFile(file, contents);
}

function runSelfCheck() {
  const html = '<a href="projects/a.html">A</a><img src="assets/a.png" srcset="assets/a.png 1x, assets/b.png 2x"><meta property="og:image" content="https://jjh-python667.github.io/assets/img/og.png"><a href="mailto:a@example.com">mail</a><a href="#main">skip</a>';
  const links = extractHtmlLinks(html, 'https://jjh-python667.github.io/');
  if (!links.includes('https://jjh-python667.github.io/projects/a.html')) throw new Error('missing html link');
  if (!links.includes('https://jjh-python667.github.io/assets/b.png')) throw new Error('missing srcset');
  if (!links.includes('https://jjh-python667.github.io/assets/img/og.png')) throw new Error('missing og:image');
  if (links.some(url => url.startsWith('mailto:') || url.endsWith('#main'))) throw new Error('kept a non-http link');
  const css = extractCssUrls('body{background:url("../img/optimized/grain.webp")} .a{background:url("data:image/svg+xml,x")}', 'https://jjh-python667.github.io/assets/css/impact.css');
  if (css.length !== 1 || !css[0].endsWith('/assets/img/optimized/grain.webp')) throw new Error('css url parse failed: ' + css.join(','));
  const cases = [
    [{ status: 0, error: 'timeout', optional: true, sameOrigin: false }, 'warn'],
    [{ status: 500, error: '', optional: true, sameOrigin: false }, 'warn'],
    [{ status: 200, error: '', optional: true, sameOrigin: false }, 'ok'],
    [{ status: 404, error: '', optional: false, sameOrigin: true }, 'hard'],
    [{ status: 403, error: '', optional: false, sameOrigin: false }, 'warn'],
    [{ status: 403, error: '', optional: false, sameOrigin: true }, 'hard'],
    [{ status: 429, error: '', optional: false, sameOrigin: false }, 'warn'],
    [{ status: 200, error: '', optional: false, sameOrigin: true }, 'ok'],
  ];
  for (const [record, expected] of cases) {
    const actual = classify(record);
    if (actual !== expected) throw new Error(`classify ${JSON.stringify(record)} => ${actual}, expected ${expected}`);
  }
  if (scoreLevel('accessibility', 79, true) !== 'hard') throw new Error('a11y threshold');
  if (scoreLevel('performance', 40, true) !== 'warn') throw new Error('perf warn threshold');
  if (scoreLevel('performance', 40, false) !== 'warn') throw new Error('optional perf');
  if (!grounded('首页 HTTP 200，性能 80。', '{"status":200,"performance":80}')) throw new Error('grounded should accept');
  if (grounded('建议 24 小时内处理。', '{"status":200}')) throw new Error('grounded should reject invented numbers');
  const openFail = { state: 'open', body: '结论：**未通过**' };
  const plans = [
    [null, '未通过', 'create', true],
    [openFail, '未通过', 'update', false],
    [{ state: 'closed', body: '结论：**未通过**' }, '未通过', 'reopen', true],
    [openFail, '通过', 'close', true],
    [openFail, '有警告', 'none', false],
    [null, '有警告', 'none', false],
    [null, '通过', 'none', false],
    [{ state: 'closed', body: '结论：**通过**' }, '通过', 'none', false],
  ];
  for (const [current, conclusion, action, comment] of plans) {
    const plan = issuePlan(current, conclusion);
    if (plan.action !== action || plan.comment !== comment) {
      throw new Error(`issuePlan ${conclusion} => ${plan.action}/${plan.comment}, expected ${action}/${comment}`);
    }
  }
  if (conclusionIn('结论：**有警告**') !== '有警告') throw new Error('conclusion parse');
  console.log('self-check ok');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfCheck) {
    runSelfCheck();
    return;
  }
  const generatedAtDate = new Date();
  const generatedAt = generatedAtDate.toISOString();
  const generatedAtShanghai = shanghaiNow(generatedAtDate);
  process.stderr.write(`patrol start ${generatedAt}\n`);
  const crawlResult = await crawl(args);
  const checked = crawlResult.checked;
  const portfolio = checked.find(record => record.role === 'portfolio');
  const optional = args.optional.map(url => checked.find(record => record.url === new URL(url).href)).filter(Boolean);
  for (const record of checked) record.level = classify(record);
  const hard = checked.filter(record => record.level === 'hard');
  const linkWarnings = checked.filter(record => record.level === 'warn');

  let baseline = null;
  try {
    baseline = JSON.parse(await readFile(args.baseline, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const baselineHash = typeof baseline?.hash === 'string' ? baseline.hash : '';
  let hashComparison = '没有可比对的哈希。';
  const notices = [];
  if (!portfolio || portfolio.error || portfolio.status < 200 || portfolio.status >= 300) {
    hashComparison = '首页没有成功返回正文，未比较哈希。';
  } else if (portfolio.truncated) {
    hashComparison = '正文被截断，未与基线比较。';
    notices.push('首页正文超过读取上限，哈希不能当作内容变更结论。');
  } else if (!baselineHash) {
    hashComparison = '仓库里还没有基线哈希。';
    notices.push('未找到基线哈希。可用 --write-baseline 写入 .github/patrol/baseline.json。');
  } else if (baselineHash === portfolio.sha256) {
    hashComparison = '与已提交基线一致。';
  } else {
    hashComparison = '与已提交基线不同。';
    notices.push('首页 HTML 哈希与已提交基线不同。这只记为通知，不单独打开跟踪 issue，也不因此让任务失败。');
  }

  if (args.writeBaseline) {
    if (portfolio?.sha256 && !portfolio.truncated && portfolio.status >= 200 && portfolio.status < 300) {
      const payload = {
        url: portfolio.url,
        algorithm: 'sha256',
        hash: portfolio.sha256,
        bytes: portfolio.bytes,
        capturedAt: generatedAt,
        note: '首页 HTML 响应正文的 SHA-256。GitHub Actions 只比较，不改写这个文件。',
      };
      await writeOutput(args.baseline, JSON.stringify(payload, null, 2) + '\n');
      notices.push(`已写入基线 ${args.baseline}。`);
    } else notices.push('未写入基线：首页正文不可用。');
  }

  const lighthouse = [];
  const chromePath = args.skipLighthouse ? '' : await findChrome();
  const lighthouseTargets = [];
  if (!args.skipLighthouse) {
    lighthouseTargets.push({ url: args.portfolio, label: '作品集（必须）', required: true, ok: portfolio && portfolio.status >= 200 && portfolio.status < 400 });
    for (const record of optional) {
      lighthouseTargets.push({ url: record.url, label: 'Deal Hunter（可选）', required: false, ok: record.status >= 200 && record.status < 400 && !record.error });
    }
  }
  if (args.skipLighthouse) notices.push('本次跳过 Lighthouse。');
  else if (!chromePath) notices.push('没有找到 Chrome。Lighthouse 仍会尝试启动，失败会记入结果。');
  else if (!nodeSupportsLighthouse()) notices.push(`当前 Node ${process.versions.node} 低于 Lighthouse 13.6 要求的 22.19。`);

  if (!args.skipLighthouse && nodeSupportsLighthouse()) {
    await mkdir('.patrol', { recursive: true });
    for (const target of lighthouseTargets) {
      if (!target.ok) {
        const error = target.required ? '页面不可用，未跑 Lighthouse。' : '可选目标不可用，未跑 Lighthouse。';
        lighthouse.push({ ...target, error, summary: summarizeLighthouse(null, target.required) });
        continue;
      }
      const outputPath = path.join('.patrol', `lighthouse-${target.required ? 'portfolio' : 'optional'}.json`);
      try {
        process.stderr.write(`lighthouse ${target.url}\n`);
        const json = await runLighthouse(target.url, outputPath, chromePath);
        lighthouse.push({ ...target, error: '', summary: summarizeLighthouse(json, target.required) });
      } catch (error) {
        const message = String(error.message || error).replace(/\s+/g, ' ').slice(0, 500);
        const summary = summarizeLighthouse(null, target.required);
        summary.error = message;
        lighthouse.push({ ...target, error: message, summary });
      }
    }
  } else if (!args.skipLighthouse) {
    for (const target of lighthouseTargets) {
      const summary = summarizeLighthouse(null, target.required);
      summary.error = `Node ${process.versions.node} 不能运行 ${LIGHTHOUSE_SPEC}`;
      lighthouse.push({ ...target, error: summary.error, summary });
    }
  }

  const lighthouseHard = lighthouse.filter(item => item.required && item.summary.level === 'hard');
  const lighthouseWarnings = lighthouse.filter(item => item.summary.level === 'warn');
  const counts = {
    checked: checked.length,
    ok: checked.filter(record => record.level === 'ok').length,
    warn: linkWarnings.length,
    hard: hard.length,
    internal: checked.filter(record => record.sameOrigin).length,
    external: checked.filter(record => !record.sameOrigin).length,
  };
  const hasProblems = hard.length > 0 || linkWarnings.length > 0 || lighthouseHard.length > 0 || lighthouseWarnings.length > 0;
  const siteHard = hard.length > 0 || lighthouseHard.length > 0;
  let conclusion = '通过';
  if (siteHard) conclusion = '未通过';
  else if (hasProblems) conclusion = '有警告';

  const state = {
    generatedAt,
    generatedAtShanghai,
    dryRun: args.dryRun,
    portfolio: portfolio || { url: args.portfolio, status: 0, error: '未检查', ms: 0, lastModified: '', sha256: '', bytes: 0, truncated: false, finalUrl: '' },
    optional,
    checked,
    hard,
    linkWarnings,
    counts,
    hashComparison,
    baselinePath: args.baseline,
    baselineHash,
    notices,
    lighthouse,
    conclusion,
    models: { used: false, reason: '', summary: '' },
    issue: { summary: args.dryRun ? 'dry-run 不同步 GitHub issue。' : '尚未同步 issue。' },
  };
  state.models = await maybeEnhance(buildFacts(state), !args.dryRun && process.env.PATROL_USE_MODELS === '1');
  let report = buildReport({ ...state, notices });

  const syncIssues = !args.dryRun && process.env.PATROL_SYNC_ISSUES === '1';
  let issueFailed = false;
  if (syncIssues) {
    const repo = process.env.GITHUB_REPOSITORY || '';
    if (!repo) {
      state.issue = { summary: '未同步 issue：没有 GITHUB_REPOSITORY。', error: true, needed: conclusion === '未通过', refreshBody: false };
      issueFailed = conclusion === '未通过';
    } else {
      try {
        state.issue = await syncIssue(repo, report, conclusion);
        issueFailed = Boolean(state.issue.error && state.issue.needed);
      } catch (error) {
        state.issue = { summary: '同步 issue 失败：' + (error.name || 'Error'), error: true, needed: conclusion === '未通过', refreshBody: false };
        issueFailed = conclusion === '未通过';
      }
    }
    report = buildReport({ ...state, notices });
    if (state.issue.refreshBody && state.issue.number && process.env.GITHUB_REPOSITORY) {
      const refreshed = report.length > 60000 ? report.slice(0, 59000) + '\n\n（报告过长，已截断。完整文本见本次 workflow artifact。）\n' : report;
      await github(`/repos/${process.env.GITHUB_REPOSITORY}/issues/${state.issue.number}`, {
        method: 'PATCH',
        body: { body: refreshed },
      });
    }
  }

  if (args.out) await writeOutput(args.out, report.endsWith('\n') ? report : report + '\n');
  else process.stdout.write(report + '\n');
  if (args.summary) await writeOutput(args.summary, report.endsWith('\n') ? report : report + '\n');
  if (args.json) {
    const json = {
      generatedAt,
      conclusion,
      dryRun: args.dryRun,
      portfolio: {
        url: state.portfolio.url,
        status: state.portfolio.status,
        error: state.portfolio.error || '',
        finalUrl: state.portfolio.finalUrl || '',
        ms: state.portfolio.ms || 0,
        lastModified: state.portfolio.lastModified || '',
        sha256: state.portfolio.sha256 || '',
        bytes: state.portfolio.bytes || 0,
        hashComparison,
      },
      optional: optional.map(record => ({ url: record.url, status: record.status, error: record.error || '', ms: record.ms, finalUrl: record.finalUrl || '' })),
      counts,
      hard: hard.map(record => ({ url: record.url, status: record.status, error: record.error || '', sources: record.sources })),
      linkWarnings: linkWarnings.map(record => ({ url: record.url, status: record.status, error: record.error || '', sources: record.sources })),
      lighthouse: lighthouse.map(item => ({
        url: item.url,
        required: item.required,
        error: item.error || '',
        level: item.summary?.level || '',
        version: item.summary?.version || '',
        formFactor: item.summary?.formFactor || '',
        scores: item.summary?.scores || {},
        metrics: item.summary?.metrics || {},
      })),
      models: state.models,
      issue: state.issue,
    };
    await writeOutput(args.json, JSON.stringify(json, null, 2) + '\n');
  }
  const exitCode = siteHard || issueFailed ? 1 : 0;
  process.stderr.write(`patrol conclusion ${conclusion} exit ${exitCode}\n`);
  process.exitCode = exitCode;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
