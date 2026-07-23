# OC · 照片日记

一个个人「照片 + 日记」展示网站:顶部极简导航 + 首页照片流与最新日记 + 相册瀑布流 + 日记列表/详情 + 关于页。
内容完全由本地文件驱动,新增内容后可用同步脚本自动 commit & push,GitHub Actions 自动部署到 GitHub Pages。

## 技术栈

- Vue 3 + Vite(纯 JS,无 TypeScript)
- Vue Router 4(所有页面路由懒加载)
- Pinia(主题 / Cookie 同意状态)
- Naive UI(按需引入组件)
- marked(构建期渲染 Markdown 日记)

主色调(严格使用):浅玫瑰 `#f4d0c7` / 中玫瑰 `#e5a6a1` / 深玫瑰 `#c67a7a`,昼夜双主题,CSS 变量实现。

## 项目结构

```
├── .github/workflows/deploy.yml   # GitHub Actions 自动部署到 Pages
├── admin/                         # 本地管理后台(npm run admin,端口 3777)
│   ├── server.mjs                 # 零依赖 Node 服务:日记/照片/上传/同步 API
│   ├── public/                    # 原生 HTML/JS/CSS 单页界面(暗色主题)
│   └── config.local.json          # GitHub token(已 gitignore,首次启动自动从 PicGo 导入)
├── content/
│   ├── photos.json                # 照片数据(id/title/url/date/album/description)
│   └── diary/*.md                 # 日记,每篇一个 md,frontmatter: title/date/cover/summary
├── scripts/
│   ├── sync.mjs                   # content/ 自动同步脚本(无第三方依赖)
│   ├── sync.ps1                   # Windows 双击启动器
│   └── copy-404.mjs               # 构建后复制 index.html 为 404.html(SPA fallback)
├── src/
│   ├── components/                # NavBar / IntroOverlay(进场动画) / CookieBanner
│   ├── views/                     # Home / Photos / Diary / DiaryDetail / About(全部懒加载)
│   ├── stores/                    # Pinia: theme.js / consent.js
│   ├── content/index.js           # 构建期收集 photos.json 与 diary/*.md(import.meta.glob)
│   └── router/                    # createWebHistory + 懒加载路由
├── picgo-config.example.json      # PicGo GitHub 图床配置模板
└── vite.config.js                 # base 从 VITE_BASE_PATH 读取
```

## 本地开发

```bash
npm install
npm run dev        # 开发服务器
npm run build      # 生产构建(自动生成 dist/404.html)
npm run preview    # 本地预览构建产物
```

## 如何新增内容

### 新增照片

1. 用 PicGo 把照片上传到你的 GitHub 图片仓库(见下文 PicGo 配置)。
2. 打开 `content/photos.json`,在数组中追加一条:

```json
{
  "id": "p-005",
  "title": "照片标题",
  "url": "https://cdn.jsdelivr.net/gh/<你的用户名>/<图片仓库名>@main/img/xxx.jpg",
  "date": "2025-06-01",
  "album": "相册名(相同名字自动归为一组)",
  "description": "可选描述"
}
```

> 当前示例使用 picsum.photos 占位图,正式发布前请全部替换为图床链接。

### 新增日记

在 `content/diary/` 新建一个 `.md` 文件,文件名即 URL id(建议 `日期-标题.md`):

```markdown
---
title: 标题
date: 2025-06-01
cover: https://封面图链接(可选)
summary: 列表页显示的摘要
---

正文,支持标准 Markdown。
```

照片与日记均按 `date` 倒序自动排列,无需手动排序。

## PicGo 图床配置

1. 在 GitHub 新建一个**公开**仓库专门存图(如 `my-photos`),与本网站仓库分开。
2. GitHub → Settings → Developer settings → Personal access tokens,生成勾选 `repo` 权限的 token。
3. PicGo 安装插件 `picgo-plugin-github-plus`(或用内置 github 图床)。
4. 参照 `picgo-config.example.json` 填写:
   - `repo`: `<你的用户名>/<图片仓库名>`
   - `branch`: `main`
   - `token`: 上一步的 token
   - `path`: `img/`
   - `customUrl`: `https://cdn.jsdelivr.net/gh/<你的用户名>/<图片仓库名>@main`
5. 上传后把得到的 jsDelivr 链接填进 `content/photos.json`。

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库(例如 `oc-photo-diary`),把本项目 push 到 `main` 分支。
2. 编辑 `.github/workflows/deploy.yml`,把 `VITE_BASE_PATH: /your-repo/` 中的 `your-repo` 改成你的仓库名(注意前后都有 `/`)。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
4. push 到 main 后,Actions 自动 `npm ci && npm run build` 并部署;几分钟后访问 `https://<你的用户名>.github.io/<仓库名>/`。
5. SPA 刷新 404 问题已通过构建时生成 `404.html` 解决,无需额外配置。

## 本地管理后台

不想手编 markdown / photos.json、也不想在 PicGo 桌面端手动切换图床?项目内置一个零依赖的本地管理后台。

```bash
npm run admin          # 或双击 admin/启动后台.bat
```

启动后自动打开 `http://localhost:3777`(仅监听本机),包含三个标签页:

- **日记**:左侧列表(解析每篇 md 的 frontmatter),右侧编辑器 —— 顶部 title / date / cover(可从照片库下拉选取)/ summary 字段,正文左侧 Markdown 输入、右侧 marked 实时预览;支持新建(自动生成 `YYYY-MM-DD-slug.md`,中文标题自动回退为时间戳 slug)、保存、删除(带确认)。
- **照片**:拖放或选择图片 → 后端直接调用 GitHub Contents API 上传到图床仓库 `lishiyu2006/picgo` 的 `img/`(文件名冲突自动加时间戳前缀),返回 jsDelivr 链接并自动追加到 `content/photos.json`;缩略图网格中可编辑 title / date / album / description;删除仅移除 photos.json 记录,不删图床文件(页面上有注明)。
- **同步**:一个「提交并推送」按钮,执行 `git add content/ && git commit && git push`,输出显示在页面上;无变更时提示「没有需要同步的内容」。

**Token 来源与安全**:token 存放在 `admin/config.local.json`(已加入 .gitignore,不会进 git)。首次启动时程序会自动从 PicGo 的 `data.json`(`%APPDATA%\picgo\data.json` → `uploader.github.configList` 中 `lishiyu2006/picgo` 那条)导入 token;导入失败则照片页会显示表单让你手动粘贴。token 值永远不会打印到日志或回显到页面。

## content 自动同步脚本

`scripts/sync.mjs` 每隔 N 分钟检查 `content/` 有无未提交变更,有则自动 `git add content/ && git commit && git push`(无变更、无远程、push 失败都会优雅处理并打印日志)。

```bash
# 方式一:命令行(默认 10 分钟)
node scripts/sync.mjs
node scripts/sync.mjs --interval 5      # 改为 5 分钟
SYNC_INTERVAL=15 node scripts/sync.mjs  # 环境变量方式

# 方式二:Windows 双击 scripts/sync.ps1(需 node 在 PATH 中)
```

**开机自启(Windows 任务计划程序)**:

1. `Win + R` 输入 `taskschd.msc` 打开任务计划程序 → 创建任务。
2. 常规:名称随意,勾选「使用最高权限运行」可选。
3. 触发器:新建 → 「登录时」。
4. 操作:新建 → 程序填 `powershell.exe`,参数填:
   `-ExecutionPolicy Bypass -WindowStyle Hidden -File "F:\project\oc计划\scripts\sync.ps1"`,
   起始于填 `F:\project\oc计划`。
5. 确定保存。之后每次登录都会在后台自动同步 `content/`。

## 需要替换的占位符清单

| 位置 | 占位符 | 替换为 |
| --- | --- | --- |
| `.github/workflows/deploy.yml` | `/your-repo/` | 你的仓库名,如 `/oc-photo-diary/` |
| `picgo-config.example.json` | `<你的用户名>`、`<图片仓库名>`、`<...token...>` | GitHub 用户名、图片仓库名、PAT |
| `content/photos.json` | picsum.photos 占位链接 | PicGo 上传后的 jsDelivr 链接 |
| `content/diary/*.md` | 3 篇示例日记 | 你自己的日记 |
| `src/views/About.vue` | 示例自我介绍 | 你的介绍与联系方式 |
| `index.html` / `NavBar.vue` | 站点名「OC · 照片日记」 | 你的站点名(可选) |

## 隐私说明

- 首次访问会弹出本地存储许可横幅;选择「仅必要」后,除 sessionStorage 中的进场动画标记外不写入任何持久化数据。
- 主题偏好(`theme`)、阅读记录(`read-posts`)仅在你点击「接受」后写入 localStorage,全部数据只存在你自己的浏览器中。
