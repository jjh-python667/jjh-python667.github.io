# 工匠的 GitHub 工坊

人工智能专业大一的公开静态作品集。文档标题是「JJH Builds · 工匠的个人主页与作品集」，首屏标题是「把学习与办公的想法，做成能跑的工具。」

公开地址：[https://jjhbuilds.com/](https://jjhbuilds.com/)

这个仓库只发布静态展示页。案头、学习搭子、资讯台和优惠情报站的后端都不在这里。当前 `docs/` 是候选产物：已批准的改版文案和动态，加上 `main` 上原有的全球羊毛情报中心页面与滚动修复。它和已经部署到 jjhbuilds.com 的 159 项静态包不是同一版。

Public static portfolio for a first-year AI undergraduate. The document title is “JJH Builds · 工匠的个人主页与作品集”. The hero says “把学习与办公的想法，做成能跑的工具。” The public entry is [https://jjhbuilds.com/](https://jjhbuilds.com/). This repository publishes static pages only. The current `docs/` tree is a candidate: the approved redesign copy and updates, plus the Deal Hunter page and scroll fix already on `main`. It is a different build from the 159-file package deployed at jjhbuilds.com.

## 页面上有什么

首页导航：最近动态、精选作品、成长记录、学习空间、GitHub。

| 位置 | 内容 |
| --- | --- |
| 首屏 | 文档标题、首屏标题，以及 2026-11-19「作品集正式域名上线并通过 HTTPS 验收」 |
| 预览条 | 资讯台、案头、学习搭子 |
| `#works` 精选作品 | 搜索、按标签筛选；第一项是全球羊毛情报中心，其后是原来的项目 |
| `#updates` 最近在做什么 | `site/data/updates.json` 的策展里程碑。主高亮是「继续打磨案头办公助手的实际交付」，完整列表在 `updates.html` |
| `#growth` 成长记录 | 「我正在做」和「已完成」，数据在 `site/data/growth.json`。当前条目是「作品集已接入独立域名并启用 HTTPS」；2026-11-10 仍保留「独立域名仍在准备」 |
| `#about` 简介 | 页脚前的一段自我介绍 |
| `agent.html` | 学习空间：固定讲解 / 答题示例。邀请试用写的是准备中 |
| `404.html` | 未找到页面 |

精选作品，按首页顺序：

| 项目 | 页面 | 仓库 |
| --- | --- | --- |
| 全球羊毛情报中心 | [介绍](https://jjh-python667.github.io/projects/dealhunter.html) | [dealhunter](https://github.com/jjh-python667/dealhunter) |
| 资讯台 Newsdesk | [介绍](https://jjh-python667.github.io/projects/newsdesk.html) | [newsdesk](https://github.com/jjh-python667/newsdesk) |
| 案头 ANTOU | [介绍](https://jjh-python667.github.io/projects/antou-office-agent.html) | [antou-office-agent](https://github.com/jjh-python667/antou-office-agent) |
| 学习搭子 | [介绍](https://jjh-python667.github.io/projects/personal-learning-agent.html) | [personal-learning-agent](https://github.com/jjh-python667/personal-learning-agent) |
| 星球大战 mini | [介绍](https://jjh-python667.github.io/projects/star-wars-mini.html) | [star-wars-mini](https://github.com/jjh-python667/star-wars-mini) |
| AI 工具工作流笔记 | [介绍](https://jjh-python667.github.io/projects/grokbot-workflow-notes.html) | [grokbot-workflow-notes](https://github.com/jjh-python667/grokbot-workflow-notes) |

`site/projects/yujiang-deepseek.html` 仍在仓库和 `docs/` 里，但首页不链出，`sitemap.xml` 也没有它。它不是精选栏目。

站点地图里的地址是首页、学习空间，以及上表 6 个项目页。页面还有主题切换、命令板和本地 GSAP 3.15.1 动效。GSAP 的来源和许可见 `site/assets/vendor/gsap/`。

The header links to recent updates, featured work, the growth log, the learning page, and GitHub. Featured work starts with Deal Hunter and then the projects in the table above. Search and tag filters sit on `#works`. `#updates` is the curated milestone list, with the office-agent item highlighted; `#growth` keeps the approved order, including the 2026-11-10 note that the independent domain was still being prepared. `agent.html` is a fixed learning demo; the invited trial is not open, and the page does not say the ICP filing is still in progress. `yujiang-deepseek.html` is still in the repo but is not linked from the homepage and is not in the sitemap.

## 本地构建和预览

需要 Node.js 20 或更新版本。站点构建没有 npm 依赖。

```sh
npm run build
npm run preview
```

浏览器打开 http://127.0.0.1:4176/ 。换端口：`node scripts/preview.mjs --port 4178`。

`npm run prepare:pages` 会把 `dist/` 同步到 `docs/`，保留 `.nojekyll`。它不会提交、推送或部署。

`npm run sync` 会重新读取公开 GitHub 仓库动态；失败时保留上一次成功的快照。它会改页面里的动态内容，改样式时不必运行。

缩略图脚本是 `node scripts/optimize-featured.mjs`，需要本机 Pillow，并用 `FEATURED_PYTHON` 指定 Python。日常构建不用它。

Node.js 20 or newer. The site build has no npm dependencies. `npm run build` writes `dist/`. `npm run preview` serves it at http://127.0.0.1:4176/ . `npm run prepare:pages` copies `dist/` into `docs/` and does not deploy. `npm run sync` refreshes the public GitHub activity block.

## 目录

```text
site/          页面源文件：HTML、CSS、JS、data、图片、robots.txt、sitemap.xml
scripts/       build、render、preview、prepare-pages、sync、optimize、patrol
docs/          GitHub Pages 目录，只放站点构建结果
.github/       巡检 workflow、首页哈希基线和样例报告 .github/patrol/sample.md
```

GitHub Pages 使用 `docs/`。不要在这个仓库里改 Cloudflare Worker。

`docs/` is the GitHub Pages directory and stays limited to the built site. The patrol sample is `.github/patrol/sample.md`. Worker code is not in this repository.

## 巡检

`npm run patrol` 是本地 dry-run：请求线上地址，写报告，不打开 issue，也不读取令牌。

GitHub Actions 工作流 `.github/workflows/site-patrol.yml`：

- 每天 02:00 UTC 运行，也可以手动 `workflow_dispatch`。这两种才会巡检线上站点
- 打开指向 `main` 的 pull request 时只运行 `node --check` 和 `node scripts/patrol.mjs --self-check`，不访问线上站点，也不创建或修改 issue
- 定时和手动巡检必须检查 [https://jjh-python667.github.io/](https://jjh-python667.github.io/)
- [https://dealhunter.gongjiang667.workers.dev/](https://dealhunter.gongjiang667.workers.dev/) 是可选项。打不开或返回错误只记警告，不让任务失败
- 检查站内和站外链接。并发 2，相邻请求至少间隔 400 ms。站外链接（含源码压缩包）失败只记警告。Cloudflare Access 登录页（HTTP 302，或跳到登录页后的 200）只记为「受 Access 保护，只检查可达」，不把登录页当成站点正文
- 用免费的 Lighthouse CLI（`lighthouse@13.6.0`，需要 Node.js 22.19+）测性能和无障碍。性能低于 50 或无障碍低于 90 记警告；性能低于 25 或无障碍低于 80 记未通过
- 用首页 HTML 的 SHA-256 和 `.github/patrol/baseline.json` 比较。内容变化只写进报告，不单独当作失败
- 中文报告写到 job summary，并上传 artifact `site-patrol-report`
- 规则生成报告。`schedule` 和 `workflow_dispatch` 用内置 `GITHUB_TOKEN` 和该 job 的 `models: read` 调用 GitHub Models 补一段摘要；`pull_request` 不调用。Models 不可用时回退到规则报告
- 只有结论是「未通过」时，才创建或更新一条标题为「站点巡检：待处理问题」、标签为 `site-patrol` 的 issue。链接返回 403 或 429、站外链接的 5xx、Deal Hunter 超时，以及 Lighthouse 警告，只写进 job summary。结论没变时不追加评论；结论回到「通过」时关闭这条 issue，并留一条恢复说明

不需要新增 secret，也不使用付费服务。Models 不可用时，定时和手动巡检仍给出规则报告。

`npm run patrol` is a local dry-run. A pull request only runs the offline self-check. The scheduled run and a manual dispatch check the portfolio, treat Deal Hunter as optional, check links with a rate limit, run Lighthouse, and compare the homepage hash with the committed baseline. The Chinese report is rule-based. `schedule` and `workflow_dispatch` ask GitHub Models for a short summary with the built-in `GITHUB_TOKEN`. A pull request does not. If Models is unavailable, the report stays the rule text. The daily run and a manual dispatch open or update one issue only when the conclusion is 未通过. Warnings stay in the job summary. A comment is posted only when that conclusion changes, and a later pass closes the issue with one recovered comment.

## 第三方素材

GSAP 与 ScrollTrigger 的来源和许可见 `site/assets/vendor/gsap/`。星球大战 mini 的画面在项目页里说明，素材不放进本仓库的根目录。

GSAP and ScrollTrigger keep the terms shipped in `site/assets/vendor/gsap/`. The Star Wars mini page explains its own artwork.

## 许可

本仓库使用 [MIT License](LICENSE)。

This repository is MIT.
