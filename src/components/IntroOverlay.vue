<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import router from '../router'

// 加载引导型进场动画:
// - 进度条与真实加载挂钩(window load + 首屏路由 chunk ready)
// - 先爬升到 90% 等待,加载完成冲到 100%,然后色块错峰滑出
// - 最短展示 800ms,最长兜底 5s;每会话一次(sessionStorage);点击可跳过
// - prefers-reduced-motion 时直接跳过
const MIN_MS = 800
const MAX_MS = 5000

const show = ref(false)
const leaving = ref(false)
const progress = ref(0)

let startedAt = 0
let loaded = false
let routeReady = false
let stepTimer = null
let timeouts = []

function onWinLoad() {
  loaded = true
}

function cleanup() {
  clearInterval(stepTimer)
  timeouts.forEach(clearTimeout)
  timeouts = []
  window.removeEventListener('load', onWinLoad)
}

onMounted(() => {
  let played = false
  try {
    played = sessionStorage.getItem('intro-played') === '1'
  } catch {
    played = false
  }
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (played || reduced) return

  show.value = true
  startedAt = performance.now()
  loaded = document.readyState === 'complete'
  if (!loaded) window.addEventListener('load', onWinLoad, { once: true })
  router
    .isReady()
    .then(() => {
      routeReady = true
    })
    .catch(() => {
      routeReady = true
    })

  stepTimer = setInterval(step, 100)
})

function step() {
  const elapsed = performance.now() - startedAt
  const ready = (loaded && routeReady) || elapsed >= MAX_MS
  if (ready && elapsed >= MIN_MS) {
    clearInterval(stepTimer)
    progress.value = 100
    timeouts.push(setTimeout(startLeave, 300))
    return
  }
  if (progress.value < 90) {
    progress.value = Math.min(90, progress.value + Math.max(0.8, (90 - progress.value) * 0.07))
  }
}

function startLeave() {
  if (leaving.value || !show.value) return
  clearInterval(stepTimer)
  leaving.value = true
  timeouts.push(setTimeout(finish, 1150))
}

function finish() {
  cleanup()
  show.value = false
  try {
    sessionStorage.setItem('intro-played', '1')
  } catch {
    /* ignore */
  }
}

onBeforeUnmount(cleanup)
</script>

<template>
  <div v-if="show" class="intro" :class="{ leaving }" @click="startLeave">
    <div class="block b1"></div>
    <div class="block b2"></div>
    <div class="block b3"></div>
    <div class="block b4"></div>

    <div class="loader">
      <p class="brand">OC · 照片日记</p>
      <div class="track">
        <div class="fill" :style="{ width: progress + '%' }"></div>
      </div>
      <p class="pct">{{ Math.round(progress) }}%</p>
      <p class="skip">点 击 跳 过</p>
    </div>
  </div>
</template>

<style scoped>
.intro {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #131316;
  cursor: pointer;
  overflow: hidden;
}

.block {
  position: absolute;
  inset: 0;
  transform: translateY(102%);
  animation: slide-in 0.5s cubic-bezier(0.75, 0, 0.2, 1) forwards;
}

.b1 { background: #f4d0c7; animation-delay: 0s; }
.b2 { background: #e5a6a1; animation-delay: 0.08s; }
.b3 { background: #c67a7a; animation-delay: 0.16s; }
.b4 { background: #131316; animation-delay: 0.24s; }

@keyframes slide-in {
  to { transform: translateY(0); }
}

.leaving .block {
  animation: slide-out 0.65s cubic-bezier(0.75, 0, 0.2, 1) forwards;
}
.leaving .b4 { animation-delay: 0s; }
.leaving .b3 { animation-delay: 0.1s; }
.leaving .b2 { animation-delay: 0.2s; }
.leaving .b1 { animation-delay: 0.3s; }

@keyframes slide-out {
  to { transform: translateY(-102%); }
}

/* ---------- 加载指示 ---------- */
.loader {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  width: min(320px, 70vw);
  text-align: center;
  opacity: 0;
  animation: loader-in 0.4s ease-out 0.55s forwards;
  transition: opacity 0.25s ease-out;
}

.leaving .loader { opacity: 0 !important; }

@keyframes loader-in {
  to { opacity: 1; }
}

.brand {
  margin: 0 0 1.4rem;
  font-size: 0.9rem;
  letter-spacing: 0.3em;
  color: #f2f0f4;
}

.track {
  height: 3px;
  border-radius: 3px;
  background: #2a2a32;
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #f4d0c7, #e5a6a1, #c67a7a);
  transition: width 0.25s ease-out;
}

.pct {
  margin: 0.8rem 0 0;
  font-size: 0.78rem;
  letter-spacing: 0.2em;
  color: #e5a6a1;
}

.skip {
  margin: 2.4rem 0 0;
  font-size: 0.72rem;
  letter-spacing: 0.35em;
  color: #f4d0c7;
  opacity: 0.55;
}
</style>
