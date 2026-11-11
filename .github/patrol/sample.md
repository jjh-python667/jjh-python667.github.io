# 站点巡检报告

- 时间：2026-11-11 23:43:02 +08:00（2026-11-11T15:43:02.793Z）
- 模式：本地 dry-run
- 结论：**通过**
- 报告来源：规则。未调用 GitHub Models（本地 dry-run 不读取令牌）。

## 可用性

| 目标 | 角色 | 结果 | 最终 URL | 耗时 | Last-Modified |
| --- | --- | --- | --- | --- | --- |
| 作品集 | 必须 | HTTP 200 | https://jjh-python667.github.io/ | 119 ms | Tue, 10 Nov 2026 13:37:59 GMT |
| Deal Hunter | 可选，失败不令任务失败 | HTTP 200 | https://dealhunter.gongjiang667.workers.dev/ | 835 ms |  |

## 首页内容哈希

- 算法：SHA-256（HTTP 响应正文，最多读取 2000000 字节）
- 本次：`6600470ce93862949d5c35022c5b92e55359dea3618de1eeaea303b2298d8d87`
- 字节：36033
- 基线文件：`.github/patrol/baseline.json`
- 基线：`6600470ce93862949d5c35022c5b92e55359dea3618de1eeaea303b2298d8d87`
- 比较：与已提交基线一致。

## 链接

共检查 56 个 URL（站内 34，站外 22）。限速：并发 2，相邻请求至少间隔 400 ms，单次超时 20 秒；HTTP 429/502/503/504 和网络错误重试 1 次。HEAD 遇到 400、403、404、405、501 时改用 GET。站外链接失败只记警告。Cloudflare Access 登录页（HTTP 302 或随后的 200）只确认可达，不把登录页当成站点正文。

- 通过：55
- 受 Access 保护，只检查可达：1
- 警告：0
- 未通过：0

### 未通过

无。

### 警告

无。

### 受 Access 保护，只检查可达

- https://newsdesk.gongjiang667.workers.dev/ — HTTP 200 — 最终 URL：https://gongjiang667.cloudflareaccess.com/cdn-cgi/access/login/newsdesk.gongjiang667.workers.dev。这是 Cloudflare Access 登录页，只确认可达，未核对该站点正文。

## Lighthouse

工具：`lighthouse@13.6.0`（免费开源 CLI），只跑 performance 与 accessibility，使用本机 Chrome headless。分数是单次实验数据，默认移动端模拟，会随机器和网络变化。

判定：性能低于 50 记警告，低于 25 且目标为必须时记未通过；无障碍低于 90 记警告，低于 80 且目标为必须时记未通过。下面只列出计入类别分数、且单项低于 0.9 的审计。

### 作品集（必须）

- URL：https://jjh-python667.github.io/
- 结果：通过
- 版本：13.6.0；形态：mobile
- 性能：100
- 无障碍：100
- 实验指标：FCP 1.3 s；LCP 1.3 s；TBT 0 ms；CLS 0
- 计入分数且低于 0.9 的审计：无。

### Deal Hunter（可选）

- URL：https://dealhunter.gongjiang667.workers.dev/
- 结果：通过
- 版本：13.6.0；形态：mobile
- 性能：100
- 无障碍：100
- 实验指标：FCP 1.1 s；LCP 1.1 s；TBT 60 ms；CLS 0
- 计入分数且低于 0.9 的审计：无。

## 其他通知

无。

## 跟踪 issue

dry-run 不同步 GitHub issue。

## 附录：全部 URL

| 结果 | HTTP | 角色 | URL |
| --- | --- | --- | --- |
| 通过 | 200 | optional | https://dealhunter.gongjiang667.workers.dev/ |
| 通过 | 200 | external | https://github.com/jjh-python667 |
| 通过 | 200 | external | https://github.com/jjh-python667/antou-office-agent |
| 通过 | 200 | external | https://github.com/jjh-python667/antou-office-agent/archive/refs/heads/main.zip |
| 通过 | 200 | external | https://github.com/jjh-python667/antou-office-agent/blob/main/CHANGES-v3.2.md |
| 通过 | 200 | external | https://github.com/jjh-python667/antou-office-agent/blob/main/docs/PROJECT.md |
| 通过 | 200 | external | https://github.com/jjh-python667/dealhunter |
| 通过 | 200 | external | https://github.com/jjh-python667/dealhunter/actions |
| 通过 | 200 | external | https://github.com/jjh-python667/dealhunter/blob/main/README.md |
| 通过 | 200 | external | https://github.com/jjh-python667/grokbot-workflow-notes |
| 通过 | 200 | external | https://github.com/jjh-python667/newsdesk |
| 通过 | 200 | external | https://github.com/jjh-python667/newsdesk/archive/refs/heads/main.zip |
| 通过 | 200 | external | https://github.com/jjh-python667/newsdesk/blob/main/HANDOFF.md |
| 通过 | 200 | external | https://github.com/jjh-python667/newsdesk/blob/main/review/REVIEW.md |
| 通过 | 200 | external | https://github.com/jjh-python667/personal-learning-agent |
| 通过 | 200 | external | https://github.com/jjh-python667/personal-learning-agent/blob/main/docs/ACCEPTANCE_v0.4.md |
| 通过 | 200 | external | https://github.com/jjh-python667/personal-learning-agent/blob/main/README.md |
| 通过 | 200 | external | https://github.com/jjh-python667/personal-learning-agent/pull/1 |
| 通过 | 200 | external | https://github.com/jjh-python667/python-learning |
| 通过 | 200 | external | https://github.com/jjh-python667/star-wars-mini |
| 通过 | 200 | external | https://github.com/jjh-python667/star-wars-mini/blob/main/GAMEPLAY.md |
| 通过 | 200 | portfolio | https://jjh-python667.github.io/ |
| 通过 | 200 | internal | https://jjh-python667.github.io/agent.html |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/css/site-832b3ee59c32.css |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/css/site-a9f88b0b4152.css |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/apple-touch-icon.png |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/favicon-32.png |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/og.png |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/antou-v32-160.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/antou-v32-320.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/avatar-64.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/grain.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/newsdesk-160.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/newsdesk-320.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/pla-v020-1440.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/pla-v020-160.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/pla-v020-320.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/optimized/swm-run-960.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/screenshots/antou-v32.jpg |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/screenshots/dealhunter-desktop.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/screenshots/dealhunter-mobile.webp |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/screenshots/newsdesk-desktop.png |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/img/screenshots/pla-v020.png |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/js/portfolio-319c7717404b.js |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/js/portfolio-ec1e4cd9bb31.js |
| 通过 | 200 | internal | https://jjh-python667.github.io/assets/js/vendor-gsap-cc99be2073a8.js |
| 通过 | 200 | internal | https://jjh-python667.github.io/index.html |
| 通过 | 200 | internal | https://jjh-python667.github.io/projects/antou-office-agent.html |
| 通过 | 200 | internal | https://jjh-python667.github.io/projects/dealhunter.html |
| 通过 | 200 | internal | https://jjh-python667.github.io/projects/grokbot-workflow-notes.html |
| 通过 | 200 | internal | https://jjh-python667.github.io/projects/newsdesk.html |
| 通过 | 200 | internal | https://jjh-python667.github.io/projects/personal-learning-agent.html |
| 通过 | 200 | internal | https://jjh-python667.github.io/projects/star-wars-mini.html |
| 通过 | 200 | robots | https://jjh-python667.github.io/robots.txt |
| 通过 | 200 | sitemap | https://jjh-python667.github.io/sitemap.xml |
| 受 Access 保护，只检查可达 | 200 | external | https://newsdesk.gongjiang667.workers.dev/ |
