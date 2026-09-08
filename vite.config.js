import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VueMcp } from 'vite-plugin-vue-mcp'

// base 从环境变量 VITE_BASE_PATH 读取:
// - 本地开发 / 本地 build:默认为 '/'
// - GitHub Actions 部署:workflow 中设置为 '/<repo名>/'
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    vue(),
    // dev-only 的 agent 调试工具(vite-plugin-vue-mcp):组件树/状态/router/pinia 经 MCP
    // 暴露给 agent(端点 http://localhost:5173/__mcp/sse)。build 时不加载。
    ...(command === 'serve' ? [VueMcp()] : []),
  ],
}))
