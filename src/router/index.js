import { createRouter, createWebHistory } from 'vue-router'

// 所有页面路由均懒加载:未点击的页面不会被加载
// three.js 只被 /world 引用,仅在该路由 chunk 中
const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/world',
    name: 'world',
    component: () => import('../views/World.vue'),
  },
  {
    path: '/characters',
    name: 'characters',
    component: () => import('../views/Characters.vue'),
  },
  {
    path: '/characters/:id',
    name: 'character-detail',
    component: () => import('../views/CharacterDetail.vue'),
  },
  {
    path: '/records',
    name: 'records',
    component: () => import('../views/Records.vue'),
  },
  {
    path: '/records/:id',
    name: 'record-detail',
    component: () => import('../views/RecordDetail.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  // base 与 vite.config.js 的 base 保持一致(GitHub Pages 子路径部署)
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// 兜底:GitHub Pages 重新部署后,旧页面引用的 chunk hash 会失效(404),
// 懒加载失败时自动整页刷新,拉取最新的 index.html 与资源
router.onError((error) => {
  const msg = String(error?.message || error || '')
  if (/dynamically imported module|module script failed|ChunkLoadError/i.test(msg)) {
    window.location.reload()
  }
})

export default router
