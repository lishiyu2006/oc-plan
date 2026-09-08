# OC PLAN · 原创角色计划

一个 OC(原创角色)世界观展示站,视觉风格参考明日方舟官网:超粗 condensed 英文大标题 + 小号中文副标、黑灰工业风、锐利无倒角、青蓝(`#9ed9dd`)唯一强调色。

- **世界观 /world**:以 **glTF 场景模型**呈现的艾瑟里昂(AETHERION)三层世界(天空/地表/地下),可拖拽旋转、点选板块弹介绍面板;网站明暗主题联动 3D 昼夜
- **人物 /characters**:景深层次聚焦列表(居中清晰、上下模糊),点击进入详情 —— 左照片右文字,文字错峰渐显
- **记录 /records**:同款聚焦列表,进入后是该人物的插画画廊 + 大图 lightbox
- **首页**:极简,仅导航 + 全屏氛围背景(纯 CSS)

## 技术栈

- Vue 3 + Vite(纯 JS,包管理 **pnpm**),Vue Router 4(全部路由懒加载,three.js 仅在 /world chunk)
- Pinia(主题 / Cookie 同意 / BGM),Naive UI(按需),**three.js(仅做 glTF 场景加载与交互,GLTFLoader + DRACO)**
- 标题字体 Oswald(Google Fonts CDN,fallback:Arial Narrow / Impact / 系统粗黑)

配色:深色 `#0e0f11` / `#16181c` / 卡片 `#1d2025`,文字 `#e8eaec`,强调 `#9ed9dd`;亮色主题 `#f2f4f5` 底,强调 `#5fb8bd`。全局 `border-radius: 0`。

### three.js 架构(ADR-0001 / ADR-0002)

- **Web 层不认识 three.js**:视图只 import `src/three/index.js` 导出的 `World` 类,传容器/板块数据/模型 URL 与回调,其余引擎自理(规范详见 `docs/threejs-world-architecture.md`)
- **场景模型分两个 glTF 文件**:`models.top`(天空+地表)/ `models.under`(地下),见 `content/world.json`
- **板块 = 同名锚点**:模型里节点名 = 板块 id(如 `aria-isles`),前端按名字寻址、拾取其下 mesh 做点击目标;世界几何全部在 Blender 里产出,代码不生成地形
- **昼夜**:前端实时灯(hemi + dir)随网站主题 lerp,地下恒定;模型只带几何与 PBR 材质、不烘焙

## 项目结构

```
├── .github/workflows/deploy.yml   # GitHub Actions 自动部署到 Pages(pnpm)
├── admin/                         # 本地管理后台(pnpm admin,端口 3777)
│   └── public/                    # 日记/照片/模型/同步 管理界面
├── content/                       # 内容数据源(JSON + 图片,admin/sync 维护)
│   ├── world.json                 # models(场景模型 URL)+ regions(板块内容)
│   ├── characters.json            # 人物(id/name/nameEn/title/photo/intro/appearance/illustrations)
│   ├── photos.json                # (旧照片日记数据,前台已不展示,admin 仍可管理)
│   └── diary/                     # (旧日记数据,同上)
├── public/world/models/           # 开发期占位场景模型(aetherion-top/under.glb)
├── scripts/                       # sync.mjs 内容同步 / copy-404.mjs / gen-placeholder-models.mjs
├── src/
│   ├── three/                     # ★ three.js 引擎(唯一 three 隔离区,index.js 为出口)
│   │   ├── World.js               # World 类:场景/相机/加载/交互/昼夜/切层/渲染循环
│   │   └── config.js              # 层/昼夜常量
│   ├── views/                     # Home / World / Characters / CharacterDetail / Records / RecordDetail
│   ├── components/                # SideNav / DualTitle / FocusList / IntroOverlay / RouteProgress / FadeImg / CookieBanner
│   ├── stores/                    # theme.js / consent.js / music.js
│   ├── directives/reveal.js       # v-reveal 滚动淡入指令
│   └── content/index.js           # content JSON 数据入口(models/regions/characters)
├── docs/                          # ADR(docs/adr/)+ three.js 规范 + agent 约定
└── vite.config.js                 # base 从 VITE_BASE_PATH 读取;dev 装配 vite-plugin-vue-mcp
```

> **说明**:本站前台已从「照片日记」转型为「OC 展示站」,旧的相册/日记数据与路由已移除。
> `content/photos.json` 与 `content/diary/` 仍保留,admin 后台的日记/照片管理、图床上传、
> 一键同步不受影响;若未来想恢复前台展示,重新加回路由即可。

## 内容维护

### 世界观场景模型(admin → 模型 tab)

大陆的 3D 几何是 **glTF 场景模型**,不在代码里生成。两个文件(`top` = 天空+地表,`under` = 地下):

- 建模:Blender 中搭建大陆;每个板块放一个 **名字 = 板块 id** 的锚点物体(空物体或组),其下是可点击的地标实体
- 导出:GLB,**建议勾选 meshopt/draco 压缩**;单文件 ≤20MB(jsDelivr 上限)
- 上传:`pnpm admin` → 「模型」tab → 选择文件。直传图床仓库 `lishiyu2006/picgo` 的 `models/` 目录,
  得到 jsDelivr URL 并自动写回 `content/world.json` 的 `models` 字段;随后「同步」tab 推送到 GitHub
- 开发期无真实模型时使用 `public/world/models/` 下的占位模型(可运行
  `node scripts/gen-placeholder-models.mjs` 按板块环形布局重新生成)

### 世界观板块(`content/world.json`)

```jsonc
{
  "models": { "top": "…/aetherion-top.glb", "under": "…/aetherion-under.glb" },
  "regions": [
    {
      "id": "aria-isles",      // 与模型内锚点同名
      "name": "风歌浮岛",
      "nameEn": "ARIA ISLES",
      "layer": "sky",          // "sky" | "surface" | "underground"
      "color": "#9ed9dd",      // 面板标题强调色
      "image": "world/aria-isles.jpg",
      "description": "板块介绍……"
    }
  ]
}
```

- `models.top` / `models.under`:场景模型地址(jsDelivr URL,或开发期相对路径),见 ADR-0002
- `layer` 决定板块在页面右上角层切换按钮中的归属
- **板块在 3D 中的位置由同名锚点决定,不存坐标**(ADR-0001);锚点缺失只警告对应板块,不影响其他
- 当前内置 12 个板块(天空 2 / 地表 8 / 地下 2),点击场景内板块实体相机会旋转拉近并滑出介绍面板

### 人物(`content/characters.json`)

```json
{
  "id": "char-xxx",
  "name": "凌",
  "nameEn": "LING",
  "title": "身份/称号",
  "photo": "https://…/900x1200.jpg",
  "intro": "人物简介……",
  "appearance": "外貌描述……",
  "illustrations": ["https://…/1.jpg", "https://…/2.jpg"]
}
```

- `photo`:人物页详情的左半屏立绘;`illustrations`:记录页画廊
- 图片请用 admin 后台的照片上传(直传 GitHub 图床 → jsDelivr)或 PicGo 上传后替换为 jsDelivr 链接

## 本地开发

```bash
pnpm install
pnpm dev          # 开发服务器(vite-plugin-vue-mcp 端点 http://localhost:5173/__mcp/sse 供 agent 调试)
pnpm build        # 生产构建(自动生成 dist/404.html)
pnpm preview      # 本地预览构建产物
pnpm admin        # 本地管理后台(content 维护,localhost:3777)
```

## 部署到 GitHub Pages

1. 把仓库 push 到 GitHub 的 `main` 分支。
2. `.github/workflows/deploy.yml` 已配置 `VITE_BASE_PATH: /oc-plan/`;若仓库名不同,改成 `/your-repo/`(前后都有 `/`)。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
4. push 后自动构建部署;SPA 刷新 404 由构建时生成的 `404.html` 处理;路由 chunk 懒加载失败会自动整页刷新兜底。

## content 自动同步

`scripts/sync.mjs` 每隔 N 分钟检查 `content/` 变更并自动 commit & push(含 admin 上传模型后写回的 world.json):

```bash
node scripts/sync.mjs                # 默认 10 分钟
node scripts/sync.mjs --interval 5
```

Windows 开机自启:任务计划程序 → 登录时运行
`powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "F:\project\oc计划\scripts\sync.ps1"`。

## 隐私说明

- 首次访问弹出本地存储许可横幅;「仅必要」时除 sessionStorage 的进场动画标记外不写任何持久化数据
- 主题偏好仅在选择「接受」后写入 localStorage,全部数据只存在你自己的浏览器中
