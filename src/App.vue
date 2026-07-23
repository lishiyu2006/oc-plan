<script setup>
import { onMounted, watch } from 'vue'
import SideNav from './components/SideNav.vue'
import IntroOverlay from './components/IntroOverlay.vue'
import CookieBanner from './components/CookieBanner.vue'
import RouteProgress from './components/RouteProgress.vue'
import { useThemeStore } from './stores/theme'
import { useConsentStore } from './stores/consent'

const theme = useThemeStore()
const consent = useConsentStore()

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
