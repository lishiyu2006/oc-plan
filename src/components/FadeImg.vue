<script setup>
import { ref } from 'vue'

// 图片懒加载 + 骨架占位 + 加载完成后淡入
defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
})

const loaded = ref(false)
</script>

<template>
  <div class="fade-img" :class="{ loaded }">
    <div v-if="!loaded" class="skeleton" aria-hidden="true"></div>
    <img :src="src" :alt="alt" loading="lazy" @load="loaded = true" />
  </div>
</template>

<style scoped>
.fade-img {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--skeleton);
}

.skeleton {
  position: absolute;
  inset: 0;
  background: var(--skeleton);
  animation: breathe 1.6s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.45s ease-out, transform 0.45s var(--ease-out);
}

.loaded img { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  img { opacity: 1; transition: none; }
}
</style>
