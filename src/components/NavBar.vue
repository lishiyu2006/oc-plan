<script setup>
import { NButton } from 'naive-ui'
import { useThemeStore } from '../stores/theme'

const theme = useThemeStore()

const links = [
  { to: '/', label: '首页' },
  { to: '/photos', label: '相册' },
  { to: '/diary', label: '日记' },
  { to: '/about', label: '关于' },
]
</script>

<template>
  <header class="nav">
    <router-link to="/" class="brand">
      <span class="dot"></span>OC · 照片日记
    </router-link>
    <nav class="links">
      <router-link
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="link"
        :class="{ active: l.to === '/' ? $route.path === '/' : $route.path.startsWith(l.to) }"
      >
        {{ l.label }}
      </router-link>
      <n-button
        quaternary
        circle
        class="theme-btn"
        :title="theme.dark ? '切换到白天模式' : '切换到黑夜模式'"
        @click="theme.toggle()"
      >
        {{ theme.dark ? '☀️' : '🌙' }}
      </n-button>
    </nav>
  </header>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem clamp(1rem, 5vw, 3rem);
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  font-size: 1.02rem;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(135deg, var(--rose-light), var(--rose-deep));
}

.links {
  display: flex;
  align-items: center;
  gap: clamp(0.4rem, 2vw, 1.2rem);
}

.link {
  font-size: 0.95rem;
  color: var(--text-soft);
  padding: 0.3rem 0.55rem;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}

.link:hover { color: var(--text); }

.link.active {
  color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
}

.theme-btn { font-size: 1rem; }

@media (max-width: 560px) {
  .brand { font-size: 0.92rem; }
  .link { padding: 0.25rem 0.4rem; font-size: 0.88rem; }
}
</style>
