# 工匠的 GitHub 工坊

公开作品集：[jjh-python667.github.io](https://jjh-python667.github.io/)

这是现有 JJH Builds 作品集的 GitHub Pages 静态展示版本，保留原有明暗主题、GSAP 开场、滚动编排、作品搜索和筛选。本次加入 [案头 ANTOU v3.2](https://github.com/jjh-python667/antou-office-agent) 的项目介绍、真实本地演示截图与成长记录。

## 构建与预览

需要 Node.js 20 或更新版本，无需安装前端依赖：

```sh
npm run build
npm run preview
```

默认本地预览端口 4176，也可以运行 `node scripts/preview.mjs --port 4178`。输出在 `dist/`，GitHub Pages 使用提交后的 `docs/` 静态产物。

源文件位于 `site/`，构建脚本位于 `scripts/`。修改后执行 `npm run build`，再将 `dist/` 内容同步到 `docs/` 后提交。`npm run sync` 可重新读取公开 GitHub 仓库动态；失败时保留上一次成功快照。

## 展示范围

- 案头是本地单用户办公助手，提供源码下载，没有公网 Agent 后端；截图使用真实本地演示数据，不冒充真实云端联调。
- 学习空间保留项目说明和固定交互示例，真实学习后台、账户、邀请配置与运行数据库不包含在本仓库。
- 项目开发与展示页面在 AI 助手辅助下完成，详细验证范围见各项目说明。

本仓库仅发布静态展示页。`jjhbuilds.com` 的现有源码、备案进度、域名解析和服务端部署配置不因这次 GitHub Pages 发布而改动。

GSAP 和 ScrollTrigger 以本地资源使用，来源与许可记录见 `site/assets/vendor/gsap/`。
