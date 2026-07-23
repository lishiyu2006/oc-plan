<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

// 路由切换顶部细进度条:beforeEach 开始,afterEach 完成
const active = ref(false)
const width = ref(0)
let creepTimer = null
let hideTimer = null

const router = useRouter()

function start() {
  clearTimeout(hideTimer)
  clearInterval(creepTimer)
  active.value = true
  width.value = 12
  creepTimer = setInterval(() => {
    if (width.value < 85) width.value += Math.max(1.5, (85 - width.value) * 0.12)
  }, 180)
}

function finish() {
  clearInterval(creepTimer)
  width.value = 100
  hideTimer = setTimeout(() => {
    active.value = false
    width.value = 0
  }, 280)
}

router.beforeEach(() => {
  start()
})
router.afterEach(() => {
  finish()
})
</script>

<template>
  <div class="route-progress" :class="{ active }" aria-hidden="true">
    <div class="bar" :style="{ width: width + '%' }"></div>
  </div>
</template>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.25s ease-out;
  pointer-events: none;
}

.route-progress.active { opacity: 1; }

.bar {
  height: 100%;
  background: linear-gradient(90deg, #5fb8bd, #9ed9dd);
  border-radius: 0 3px 3px 0;
  transition: width 0.25s ease-out;
}
</style>
