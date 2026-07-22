// 构建后把 dist/index.html 复制为 dist/404.html
// GitHub Pages 对未知路径返回 404.html,SPA 即可用 createWebHistory 正常工作
import { copyFileSync, existsSync } from 'node:fs'

const src = 'dist/index.html'
const dest = 'dist/404.html'

if (existsSync(src)) {
  copyFileSync(src, dest)
  console.log('[build] 已生成 dist/404.html(SPA fallback)')
} else {
  console.error('[build] 未找到 dist/index.html,vite build 可能失败')
  process.exit(1)
}
