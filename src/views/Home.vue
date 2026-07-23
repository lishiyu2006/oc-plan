<script setup>
// 首页:极简,只保留导航 + 全屏氛围背景(纯 CSS,无文字)
</script>

<template>
  <div class="home-view">
    <div class="atmos"></div>
  </div>
</template>

<style scoped>
.home-view {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.atmos {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(55% 45% at 72% 28%, rgba(158, 217, 221, 0.1), transparent 62%),
    radial-gradient(40% 38% at 18% 78%, rgba(158, 217, 221, 0.06), transparent 60%),
    repeating-linear-gradient(
      0deg,
      transparent 0 79px,
      rgba(158, 217, 221, 0.05) 79px 80px
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0 79px,
      rgba(158, 217, 221, 0.05) 79px 80px
    ),
    var(--bg);
}

/* 微弱呼吸的氛围光 */
.atmos::after {
  content: '';
  position: absolute;
  right: 12%;
  top: 22%;
  width: 2px;
  height: 34%;
  background: linear-gradient(to bottom, transparent, var(--accent), transparent);
  opacity: 0.35;
  animation: pulse 4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.4; }
}
</style>
