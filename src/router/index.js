import { createRouter, createWebHistory } from 'vue-router'

// 所有页面路由均懒加载:未点击的页面不会被加载
const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/photos',
    name: 'photos',
    component: () => import('../views/Photos.vue'),
  },
  {
    path: '/diary',
    name: 'diary',
    component: () => import('../views/Diary.vue'),
  },
  {
    path: '/diary/:id',
    name: 'diary-detail',
    component: () => import('../views/DiaryDetail.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/About.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export default createRouter({
  // base 与 vite.config.js 的 base 保持一致(GitHub Pages 子路径部署)
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
