<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NButton } from 'naive-ui'
import { useThemeStore } from '../stores/theme'

const theme = useThemeStore()
const route = useRoute()
const menuOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

const links = [
  { to: '/', label: '首页' },
  { to: '/photos', label: '相册' },
  { to: '/diary', label: '日记' },
  { to: '/about', label: '关于' },
]

const isActive = (to) =>
  to === '/' ? route.path === '/' : route.path.startsWith(to)
</script>

<template>
  <header class="nav">
    <router-link to="/" class="brand">
      <span class="dot"></span>OC · 照片日记
    </router-link>

    <!-- 桌面导航 -->
    <nav class="links desktop">
      <router-link
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="link"
        :class="{ active: isActive(l.to) }"
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
        <span class="ticon" :key="theme.dark ? 'sun' : 'moon'">
          {{ theme.dark ? '☀️' : '🌙' }}
        </span>
      </n-button>
    </nav>

    <!-- 移动端:主题 + 汉堡 -->
    <div class="mobile-ctrl">
      <n-button quaternary circle class="theme-btn" @click="theme.toggle()">
        <span class="ticon" :key="theme.dark ? 'sun' : 'moon'">
          {{ theme.dark ? '☀️' : '🌙' }}
        </span>
      </n-button>
      <button
        class="burger"
        :class="{ open: menuOpen }"
        aria-label="菜单"
        @click="menuOpen = !menuOpen"
      >
        <span></span><span></span><span></span>
      </button>
    </div>

    <!-- 移动端菜单:从顶部滑入,菜单项错峰淡入 -->
    <transition name="menu">
      <nav v-if="menuOpen" class="mobile-menu">
        <router-link
          v-for="(l, i) in links"
          :key="l.to"
          :to="l.to"
          class="m-link"
          :class="{ active: isActive(l.to) }"
          :style="{ transitionDelay: menuOpen ? i * 55 + 'ms' : '0ms' }"
          @click="menuOpen = false"
        >
          {{ l.label }}
        </router-link>
      </nav>
    </transition>
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

/* 导航链接:hover 下划线从左到右展开 */
.link {
  position: relative;
  font-size: 0.95rem;
  color: var(--text-soft);
  padding: 0.35rem 0.55rem;
  border-radius: 8px;
  transition: color 0.25s ease-out, background 0.25s ease-out;
}

.link::after {
  content: '';
  position: absolute;
  left: 0.55rem;
  right: 0.55rem;
  bottom: 0.1rem;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s var(--ease-out);
}

.link:hover { color: var(--text); }
.link:hover::after { transform: scaleX(1); }
.link:active { transform: scale(0.97); }

.link.active {
  color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
}

.link.active::after { transform: scaleX(0); }

/* 昼夜切换图标:旋转 + 缩放进入 */
.ticon {
  display: inline-block;
  animation: icon-pop 0.4s var(--ease-out);
}

@keyframes icon-pop {
  from {
    transform: rotate(-120deg) scale(0.3);
    opacity: 0;
  }
  to {
    transform: rotate(0) scale(1);
    opacity: 1;
  }
}

/* ---------- 移动端 ---------- */
.mobile-ctrl { display: none; align-items: center; gap: 0.4rem; }

.burger {
  display: grid;
  gap: 5px;
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
}

.burger span {
  display: block;
  width: 20px;
  height: 2px;
  border-radius: 2px;
  background: var(--text);
  transition: transform 0.3s var(--ease-out), opacity 0.2s ease-out;
}

.burger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.burger.open span:nth-child(2) { opacity: 0; }
.burger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

.mobile-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  display: grid;
  padding: 0.4rem 1.5rem 1rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.m-link {
  padding: 0.8rem 0.2rem;
  font-size: 1rem;
  color: var(--text-soft);
  border-bottom: 1px solid var(--border);
  transition:
    opacity 0.35s ease-out,
    transform 0.35s var(--ease-out),
    color 0.2s ease-out;
}

.m-link:last-child { border-bottom: none; }
.m-link.active { color: var(--accent); font-weight: 600; }
.m-link:active { transform: scale(0.97); }

/* 菜单整体从顶部滑入,菜单项错峰(内联 transitionDelay) */
.menu-enter-active { transition: opacity 0.25s ease-out, transform 0.3s var(--ease-out); }
.menu-leave-active { transition: opacity 0.15s ease-out, transform 0.15s ease-out; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: translateY(-10px); }
.menu-enter-from .m-link { opacity: 0; transform: translateX(18px); }
.menu-leave-to .m-link { opacity: 0; }

@media (max-width: 640px) {
  .links.desktop { display: none; }
  .mobile-ctrl { display: flex; }
  .brand { font-size: 0.92rem; }
}
</style>
