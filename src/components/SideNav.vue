<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NButton } from 'naive-ui'
import { useThemeStore } from '../stores/theme'
import { useMusicStore } from '../stores/music'

const theme = useThemeStore()
const music = useMusicStore()
const route = useRoute()
const open = ref(false)

watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)

const links = [
  { to: '/world', en: 'WORLD', zh: '世界观' },
  { to: '/characters', en: 'CHARACTERS', zh: '人物' },
  { to: '/records', en: 'RECORDS', zh: '记录' },
]

const isActive = (to) => route.path.startsWith(to)
</script>

<template>
  <!-- 移动端汉堡(左上角) -->
  <button class="burger" :class="{ open }" aria-label="菜单" @click="open = !open">
    <span></span><span></span><span></span>
  </button>

  <aside class="sidenav" :class="{ open }">
    <router-link to="/" class="brand">
      <span class="en">OC PLAN</span>
      <span class="zh">原创角色计划</span>
    </router-link>

    <nav class="menu">
      <router-link
        v-for="(l, i) in links"
        :key="l.to"
        :to="l.to"
        class="item"
        :class="{ active: isActive(l.to) }"
        :style="{ transitionDelay: open ? i * 70 + 'ms' : '0ms' }"
      >
        <span class="en">{{ l.en }}</span>
        <span class="zh">{{ l.zh }}</span>
      </router-link>
    </nav>

    <div class="bottom">
      <n-button quaternary class="theme-btn" @click="theme.toggle()">
        <span class="ticon" :key="theme.dark ? 'sun' : 'moon'">
          {{ theme.dark ? '☀️' : '🌙' }}
        </span>
        <span class="tlabel">{{ theme.dark ? 'LIGHT' : 'DARK' }}</span>
      </n-button>
      <n-button
        quaternary
        class="theme-btn music-btn"
        :class="{ playing: music.playing }"
        :aria-label="music.playing ? '暂停音乐' : '播放音乐'"
        @click="music.toggle()"
      >
        <span class="ticon micon">♪</span>
        <span class="tlabel">{{ music.playing ? 'MUSIC ON' : 'MUSIC' }}</span>
      </n-button>
    </div>
  </aside>
</template>

<style scoped>
.sidenav {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 220px;
  z-index: 150;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 2rem 0 1.5rem;
}

/* ---------- 品牌双层标题 ---------- */
.brand {
  display: grid;
  gap: 0.5rem;
  padding: 0 1.5rem 1.8rem;
  border-bottom: 1px solid var(--border);
}

.brand .en {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.5rem;
  letter-spacing: 0.08em;
  line-height: 1;
}

.brand .zh {
  font-size: 0.68rem;
  letter-spacing: 0.42em;
  color: var(--text-soft);
}

/* ---------- 导航项:英文 + 中文双层 ---------- */
.menu {
  display: grid;
  padding: 1.2rem 0;
}

.item {
  position: relative;
  display: grid;
  gap: 0.3rem;
  padding: 0.95rem 1.5rem 0.95rem 1.9rem;
  color: var(--text-soft);
  transition: color 0.25s ease-out, background 0.25s ease-out,
    opacity 0.35s ease-out, transform 0.35s var(--ease-out);
}

.item .en {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.05rem;
  letter-spacing: 0.1em;
  line-height: 1;
}

.item .zh {
  font-size: 0.68rem;
  letter-spacing: 0.35em;
}

/* 当前路由:左侧 3px 强调竖条 + 文字变强调色 */
.item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent);
  transform: scaleY(0);
  transition: transform 0.3s var(--ease-out);
}

.item:hover { color: var(--text); background: var(--surface-2); }
.item:active { transform: scale(0.97); }

.item.active { color: var(--accent); }
.item.active::before { transform: scaleY(1); }

/* ---------- 底部昼夜切换 ---------- */
.bottom {
  margin-top: auto;
  padding: 1.2rem 1.5rem 0;
  border-top: 1px solid var(--border);
}

.theme-btn { width: 100%; justify-content: flex-start; }

.ticon {
  display: inline-block;
  animation: icon-pop 0.4s var(--ease-out);
}

@keyframes icon-pop {
  from { transform: rotate(-120deg) scale(0.3); opacity: 0; }
  to { transform: rotate(0) scale(1); opacity: 1; }
}

.tlabel {
  margin-left: 0.5rem;
  font-family: var(--font-display);
  font-size: 0.75rem;
  letter-spacing: 0.25em;
  color: var(--text-soft);
}

/* ---------- 音乐开关:播放中音符微微跳动 ---------- */
.music-btn .micon { font-size: 0.95rem; line-height: 1; }

.music-btn.playing .micon {
  color: var(--accent);
  animation: note-bounce 0.9s ease-in-out infinite;
}

.music-btn.playing .tlabel { color: var(--accent); }

@keyframes note-bounce {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-3px) rotate(-8deg); }
}

@media (prefers-reduced-motion: reduce) {
  .music-btn.playing .micon { animation: none; }
}

/* ---------- 移动端汉堡 ---------- */
.burger {
  display: none;
  position: fixed;
  top: 0.9rem;
  left: 0.9rem;
  z-index: 300;
  gap: 5px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.65rem 0.6rem;
  cursor: pointer;
}

.burger span {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--text);
  transition: transform 0.3s var(--ease-out), opacity 0.2s ease-out;
}

.burger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.burger.open span:nth-child(2) { opacity: 0; }
.burger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* ---------- 移动端:sidebar 收起,展开为全屏覆盖层 ---------- */
@media (max-width: 860px) {
  .burger { display: grid; }

  .sidenav {
    width: 100%;
    border-right: none;
    background: var(--bg);
    transform: translateX(-100%);
    transition: transform 0.35s var(--ease-out);
    padding-top: 4.5rem;
  }

  .sidenav.open { transform: translateX(0); }

  /* 菜单项错峰淡入(内联 transitionDelay) */
  .item { opacity: 0; transform: translateX(28px); }
  .sidenav.open .item { opacity: 1; transform: translateX(0); }

  .item .en { font-size: 1.6rem; }
  .item .zh { font-size: 0.8rem; }
}
</style>
