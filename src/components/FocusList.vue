<script setup>
import { ref } from 'vue'

// 聚焦列表:居中条目清晰放大,上下条目随距离模糊/变暗/缩小(景深层次)
// 滚轮/触摸/点击切换居中项;点击居中项触发 open
const props = defineProps({
  items: { type: Array, required: true }, // [{ id, name, nameEn }]
})
const emit = defineEmits(['open'])

const center = ref(0)
const SPACING = 118

function clamp(i) {
  return Math.min(props.items.length - 1, Math.max(0, i))
}

function styleFor(i) {
  const d = i - center.value
  const ad = Math.abs(d)
  return {
    transform: `translate(-50%, -50%) translateY(${d * SPACING}px) scale(${Math.max(
      0.8,
      1 - ad * 0.08,
    )})`,
    filter: `blur(${Math.min(6, ad * 2.4)}px)`,
    opacity: Math.max(0.22, 1 - ad * 0.24),
    zIndex: 20 - ad,
  }
}

// 滚轮切换(节流)
let wheelLock = 0
function onWheel(e) {
  const now = performance.now()
  if (now - wheelLock < 220) return
  wheelLock = now
  center.value = clamp(center.value + (e.deltaY > 0 ? 1 : -1))
}

// 触摸滑动
let touchY = null
function onTouchStart(e) {
  touchY = e.touches[0].clientY
}
function onTouchEnd(e) {
  if (touchY == null) return
  const dy = e.changedTouches[0].clientY - touchY
  if (Math.abs(dy) > 40) center.value = clamp(center.value + (dy < 0 ? 1 : -1))
  touchY = null
}

function onClick(i) {
  if (i === center.value) emit('open', props.items[i])
  else center.value = i
}
</script>

<template>
  <div
    class="focus-list"
    @wheel.passive="onWheel"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div
      v-for="(item, i) in items"
      :key="item.id"
      class="focus-item"
      :class="{ current: i === center }"
      :style="styleFor(i)"
      @click="onClick(i)"
    >
      <span class="en">{{ item.nameEn }}</span>
      <span class="zh">{{ item.name }}</span>
    </div>
    <p class="hint">滚动 / 点击切换 · 点击居中项进入</p>
  </div>
</template>

<style scoped>
.focus-list {
  position: relative;
  height: calc(100vh - 200px);
  min-height: 420px;
  overflow: hidden;
  user-select: none;
}

.focus-item {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  cursor: pointer;
  padding: 0.8rem 2rem;
  transition:
    transform 0.55s var(--ease-out),
    filter 0.55s ease-out,
    opacity 0.55s ease-out;
}

.focus-item .en {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(2rem, 5vw, 3.2rem);
  letter-spacing: 0.08em;
  line-height: 1;
  white-space: nowrap;
}

.focus-item .zh {
  font-size: 0.78rem;
  letter-spacing: 0.4em;
  color: var(--text-soft);
}

.focus-item.current .en { color: var(--accent); }
.focus-item.current .zh { color: var(--text); }

.focus-item:active { transition-duration: 0.1s; }

.hint {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.3em;
  color: var(--text-soft);
  opacity: 0.7;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .focus-item { filter: none !important; }
}
</style>
