# OC PLAN · 原创角色计划

一个 OC(原创角色)世界观展示站,视觉风格参考明日方舟官网:超粗 condensed 英文大标题 + 小号中文副标、黑灰工业风、锐利无倒角、青蓝(`#9ed9dd`)唯一强调色。

- **世界观 /world**:three.js 程序化生成的低多边形群岛大陆,可拖拽旋转;大陆上分布发光板块标记,点击后右侧滑出介绍面板(左边缘渐变与场景衔接)
- **人物 /characters**:景深层次聚焦列表(居中清晰、上下模糊),点击进入详情 —— 左照片右文字,文字错峰渐显
- **记录 /records**:同款聚焦列表,进入后是该人物的插画画廊 + 大图 lightbox
- **首页**:极简,仅导航 + 全屏氛围背景(纯 CSS)

## 技术栈

- Vue 3 + Vite(纯 JS),Vue Router 4(全部路由懒加载,three.js 仅在 /world chunk)
- Pinia(主题 / Cookie 同意),Naive UI(按需),three.js(程序化地形,无其他 3D 依赖)
- 标题字体 Oswald(Google Fonts CDN,fallback:Arial Narrow / Impact / 系统粗黑)

配色:深色 `#0e0f11` / `#16181c` / 卡片 `#1d2025`,文字 `#e8eaec`,强调 `#9ed9dd`;亮色主题 `#f2f4f5` 底,强调 `#5fb8bd`。全局 `border-radius: 0`。

## 项目结构

```
├── .github/workflows/deploy.yml   # GitHub Actions 自动部署到 Pages
├── admin/                         # 本地管理后台(npm run admin,端口 3777)
│   └── ...                        # 日记/照片管理仍可用于 content 维护(见下方说明)
├── content/
│   ├── world.json                 # 世界观板块(id/nameEn/name/color/x/z/description)
│   ├── characters.json            # 人物(id/name/nameEn/title/photo/intro/illustrations)
│   ├── photos.json                # (旧照片日记数据,前台已不展示,admin 仍可管理)
│   └── diary/                     # (旧日记数据,同上)
├── scripts/                       # sync.mjs 内容同步 / copy-404.mjs
├── src/
│   ├── components/
│   │   ├── SideNav.vue            # 左侧固定导航(移动端汉堡全屏覆盖)
│   │   ├── DualTitle.vue          # 双层标题(英文大标题 + 中文副标)
│   │   ├── FocusList.vue          # 景深聚焦列表(人物/记录复用)
│   │   ├── IntroOverlay.vue       # 加载引导型进场动画
│   │   ├── RouteProgress.vue      # 路由切换顶部进度条
│   │   ├── FadeImg.vue            # 骨架占位 + 图片淡入
│   │   └── CookieBanner.vue       # 本地存储许可横幅
│   ├── views/                     # Home / World / Characters / CharacterDetail / Records / RecordDetail
│   ├── stores/                    # theme.js / consent.js
│   ├── directives/reveal.js       # v-reveal 滚动淡入指令
│   └── content/index.js           # world.json / characters.json 数据入口
└── vite.config.js                 # base 从 VITE_BASE_PATH 读取
```

> **说明**:本站前台已从「照片日记」转型为「OC 展示站」,旧的相册/日记/关于页面与路由已移除。
> `content/photos.json` 与 `content/diary/` 仍保留,admin 后台(`npm run admin`)的日记/照片管理、
> 图床上传、一键同步功能不受影响,可用于日常 content 维护;若未来想恢复前台展示,重新加回路由即可。

## 内容维护

### 世界观板块(`content/world.json`)

```json
{
  "id": "region-xxx",
  "nameEn": "AURORA REACH",
  "name": "极光谷",
  "color": "#9ed9dd",
  "x": -6,
  "z": -6,
  "description": "板块介绍……"
}
```

`x` / `z` 是大陆平面坐标(范围约 ±12,中心为 0),标记柱会自动贴合地形高度;`color` 决定浮标发光色。

### 人物(`content/characters.json`)

```json
{
  "id": "char-xxx",
  "name": "凌",
  "nameEn": "LING",
  "title": "身份/称号",
  "photo": "https://…/900x1200.jpg",
  "intro": "人物简介……",
  "illustrations": ["https://…/1.jpg", "https://…/2.jpg"]
}
```

- `photo`:人物页详情的左半屏立绘;`illustrations`:记录页画廊
- 当前示例图片均为 picsum.photos 占位图;正式图片请用 admin 后台的照片上传(直传 GitHub 图床)
  或 PicGo 上传后替换为 jsDelivr 链接

## 本地开发

```bash
npm install
npm run dev        # 开发服务器
npm run build      # 生产构建(自动生成 dist/404.html)
npm run preview    # 本地预览构建产物
npm run admin      # 本地管理后台(content 维护,localhost:3777)
```

## 部署到 GitHub Pages

1. 把仓库 push 到 GitHub 的 `main` 分支。
2. 编辑 `.github/workflows/deploy.yml`,把 `VITE_BASE_PATH: /your-repo/` 中的 `your-repo` 改成你的仓库名(前后都有 `/`)。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
4. push 后自动构建部署;SPA 刷新 404 由构建时生成的 `404.html` 处理;路由 chunk 懒加载失败会自动整页刷新兜底。

## content 自动同步

`scripts/sync.mjs` 每隔 N 分钟检查 `content/` 变更并自动 commit & push:

```bash
node scripts/sync.mjs                # 默认 10 分钟
node scripts/sync.mjs --interval 5
```

Windows 开机自启:任务计划程序 → 登录时运行
`powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "F:\project\oc计划\scripts\sync.ps1"`。

## 隐私说明

- 首次访问弹出本地存储许可横幅;「仅必要」时除 sessionStorage 的进场动画标记外不写任何持久化数据
- 主题偏好仅在选择「接受」后写入 localStorage,全部数据只存在你自己的浏览器中
