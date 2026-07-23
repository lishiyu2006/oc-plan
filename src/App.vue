<script setup>
import { onMounted, watch } from 'vue'
import SideNav from './components/SideNav.vue'
import IntroOverlay from './components/IntroOverlay.vue'
import CookieBanner from './components/CookieBanner.vue'
import RouteProgress from './components/RouteProgress.vue'
import { useThemeStore } from './stores/theme'
import { useConsentStore } from './stores/consent'
import { useMusicStore } from './stores/music'

const theme = useThemeStore()
const consent = useConsentStore()
const music = useMusicStore()

watch(
  () => theme.dark,
  (v) => {
    document.documentElement.dataset.theme = v ? 'dark' : 'light'
  },
  { immediate: true },
)

onMounted(() => {
  consent.init()
  theme.init()
  music.init()
  // 浏览器空闲时预取 /world 的 three.js chunk(requestIdleCallback,兜底 setTimeout),
  // 不影响首屏加载;与 router 的懒加载指向同一 chunk,只是提前拉取
  const prefetchWorld = () => import('./views/World.vue').catch(() => {})
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(prefetchWorld, { timeout: 4000 })
  } else {
    setTimeout(prefetchWorld, 2500)
  }
})
</script>

<template>
  <RouteProgress />
  <IntroOverlay />
  <SideNav />
  <main class="app-main">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </main>
  <CookieBanner />
</template>
