# glTF 模型沿用图床直传 + jsDelivr 引用,单文件预算 20MB

Status: accepted (2026-09-08, 重构拷问定稿)

大陆模型按 ADR-0001 切为 `top`/`under` 两个 glTF 文件。托管决定:**沿用现有图片管线**——管理员经 admin 上传页把 GLB 直传 GitHub 图床仓库(lishiyu2006/picgo,复用 token 与 contents API 逻辑),得到 `https://cdn.jsdelivr.net/gh/...` URL 写回 `world.json` 的 `models` 字段,前端按 URL 加载;**单文件预算 ≤20MB**(jsDelivr 硬上限),超限即拒收并提示压缩。

**理由**:内容资产与展示内容统一走同一条"管理员上传 → 图床 → CDN"链路,不新增部署入口;模型更新不进本站仓库、不触发全站重构建,适配"后续持续更新"的维护节奏;URL 与图片一样经 withBase 语义(http 原样),前端零特判。

**压缩策略**:美术导出 GLB 时启用几何压缩(meshopt/draco),前端挂 DRACOLoader(decoder 随构建产物本地提供);贴图按需压 WebP/KTX2。20MB 内一个风格化低多边形大陆是现实目标;若未来单文件确需超限,再另行决议(不预先为假想的大文件复杂化管线)。

## Considered Options

- **模型入库本站仓库 public/ 走 Pages**:单文件上限 100MB 更宽,但每次模型更新都触发全站重新构建部署,仓库体积涨得快,且与"内容更新 = git 同步"的现有流程冲突。拒绝。
- **LFS / 独立对象存储**:引入新平台与鉴权面,远超当前单人维护所需。拒绝。

## Consequences

- admin 增加"模型"上传能力(上传区 + URL 写回 world.json models),复用 server.mjs 现有 token 引导/上传/重名避让逻辑。
- 前端 GLTFLoader 必须挂 DRACO 支持;加载失败(CDN 挂/文件损坏)时该层显示错误态与重试,不白屏。
- `public/world/` 仍是开发期资产的合法位置(models URL 可指相对路径),生产 URL 由上传流程写入。
