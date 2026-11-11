# 工匠的 GitHub 工坊

人工智能专业大一的公开静态作品集。页面标题是「做 AI 产品，也做工作流。」

公开地址：[https://jjh-python667.github.io/](https://jjh-python667.github.io/)

这个仓库只发布静态展示页。案头、学习搭子、资讯台和优惠情报站的后端都不在这里。仓库版本 `1.2.1` 增加的是说明和巡检，没有改页面外观或文案。页面内容沿用 `1.2.0`（2026-11-10）。主人把合并提交 `643740a` 记为当时的线上基准；之后 `main` 上的 `docs/` 又发布了优惠情报站等内容，线上首页能看到这些内容。

Public static portfolio for a first-year AI undergraduate. The headline is “做 AI 产品，也做工作流。” The live site is [https://jjh-python667.github.io/](https://jjh-python667.github.io/). This repository publishes the static pages only. Repository version `1.2.1` adds docs and the patrol workflow. It does not change the page design or copy. The owner marked merge `643740a` as the live baseline at that time; later commits on `main` also updated `docs/`, including Deal Hunter, and that content is what the public homepage shows.

## 页面上有什么

首页导航：作品、动态、成长记录、学习空间、GitHub。

| 位置 | 内容 |
| --- | --- |
| 首屏 | 标题、工坊舞台（案头、资讯台、学习搭子）、工作台 |
| 预览条 | 资讯台、案头、学习搭子 |
| `#works` 精选作品 | 搜索、按标签筛选，以及下面 6 个项目 |
| `#updates` 最近在做什么 | 由 `site/data/updates.json` 在构建时写入，最多 3 个公开仓库 |
| `#growth` 成长记录 | 「我正在做」和「已完成」，数据在 `site/data/growth.json` |
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

The header links to works, updates, the growth log, the learning page, and GitHub. Featured work is the six projects in the table above. Search and tag filters sit on `#works`. `#updates` and `#growth` are filled from `site/data/` at build time. `agent.html` is a fixed learning demo; the page says the invited trial is not open. `yujiang-deepseek.html` is still in the repo but is not linked from the homepage and is not in the sitemap.

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

- 每天 02:00 UTC 运行，也可以手动 `workflow_dispatch`
- 打开指向 `main` 的 pull request 时也会跑检查并上传 artifact，但不会创建或修改 issue
- 必须检查 [https://jjh-python667.github.io/](https://jjh-python667.github.io/)
- [https://dealhunter.gongjiang667.workers.dev/](https://dealhunter.gongjiang667.workers.dev/) 是可选项。打不开或返回错误只记警告，不让任务失败
- 检查站内和站外链接。并发 2，相邻请求至少间隔 400 ms
- 用免费的 Lighthouse CLI（`lighthouse@13.6.0`，需要 Node.js 22.19+）测性能和无障碍。性能低于 50 或无障碍低于 90 记警告；性能低于 25 或无障碍低于 80 记未通过
- 用首页 HTML 的 SHA-256 和 `.github/patrol/baseline.json` 比较。内容变化只写进报告，不单独当作失败
- 中文报告写到 job summary，并上传 artifact `site-patrol-report`
- 规则生成报告。工作流里 `PATROL_USE_MODELS` 默认为 `'0'`，不会调用模型。把它改成 `'1'` 由仓库主人决定；打开后才用内置 `GITHUB_TOKEN` 和该 job 的 `models: read`，调用失败或服务不可用时仍回退到规则报告
- 只有结论是「未通过」时，才创建或更新一条标题为「站点巡检：待处理问题」、标签为 `site-patrol` 的 issue。链接返回 403 或 429、Deal Hunter 超时，以及 Lighthouse 警告，只写进 job summary。结论没变时不追加评论；结论回到「通过」时关闭这条 issue，并留一条恢复说明

不需要新增 secret，也不使用付费服务。2026-07-30 起 GitHub Models 已停用，所以现在预期走规则回退。

`npm run patrol` is a local dry-run. The workflow checks the portfolio, treats Deal Hunter as optional, checks links with a rate limit, runs Lighthouse, and compares the homepage hash with the committed baseline. The Chinese report is rule-based. The workflow sets `PATROL_USE_MODELS` to `'0'`, so no model is called unless the owner changes it to `'1'`. If that call fails, the report falls back to the rules. The daily run and a manual dispatch open or update one issue only when the conclusion is 未通过. Warnings stay in the job summary. A comment is posted only when that conclusion changes, and a later pass closes the issue with one recovered comment.

## 第三方素材

GSAP 与 ScrollTrigger 的来源和许可见 `site/assets/vendor/gsap/`。星球大战 mini 的画面在项目页里说明，素材不放进本仓库的根目录。

GSAP and ScrollTrigger keep the terms shipped in `site/assets/vendor/gsap/`. The Star Wars mini page explains its own artwork.

## 许可

本仓库使用 [MIT License](LICENSE)。

This repository is MIT.
