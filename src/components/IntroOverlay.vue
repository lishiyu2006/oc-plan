<script setup>
import { onMounted, ref } from 'vue'

// 进场动画:深色底 + 三个玫瑰色大色块错峰进入,再错峰滑出,露出网站
// 每个会话只播放一次(sessionStorage 标记,属于"仅必要"存储)
const show = ref(false)
const leaving = ref(false)
let timers = []

onMounted(() => {
  let played = false
  try {
    played = sessionStorage.getItem('intro-played') === '1'
  } catch {
    played = false
  }
  if (!played) {
    show.value = true
    timers.push(setTimeout(startLeave, 450))
  }
})

function startLeave() {
  if (leaving.value || !show.value) return
  leaving.value = true
  timers.push(setTimeout(finish, 1100))
}

function finish() {
  timers.forEach(clearTimeout)
  timers = []
  show.value = false
  try {
    sessionStorage.setItem('intro-played', '1')
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div v-if="show" class="intro" :class="{ leaving }" @click="startLeave">
    <div class="block b1"></div>
    <div class="block b2"></div>
    <div class="block b3"></div>
    <div class="block b4"></div>
    <p class="skip">点 击 跳 过</p>
  </div>
</template>

<style scoped>
.intro {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #161210;
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
.b4 { background: #161210; animation-delay: 0.24s; }

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

.skip {
  position: absolute;
  bottom: 2.2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.35em;
  color: #f4d0c7;
  opacity: 0;
  animation: fade-in 0.5s ease 0.7s forwards;
}

@keyframes fade-in {
  to { opacity: 0.75; }
}
</style>
