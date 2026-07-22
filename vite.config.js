import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base 从环境变量 VITE_BASE_PATH 读取:
// - 本地开发 / 本地 build:默认为 '/'
// - GitHub Actions 部署:workflow 中设置为 '/<repo名>/'
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [vue()],
})
