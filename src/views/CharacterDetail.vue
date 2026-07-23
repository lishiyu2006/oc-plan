<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import FadeImg from '../components/FadeImg.vue'
import { getCharacter } from '../content'

const route = useRoute()
const c = computed(() => getCharacter(route.params.id))
</script>

<template>
  <div class="detail-view">
    <template v-if="c">
      <!-- 左:人物照片(进入时放大归位) -->
      <div class="photo">
        <FadeImg :src="c.photo" :alt="c.name" />
      </div>

      <!-- 右:文字信息依次渐显(错峰 fade+slideX) -->
      <div class="info">
        <p class="en anim" style="--d: 0.15s">{{ c.nameEn }}</p>
        <h1 class="zh anim" style="--d: 0.3s">{{ c.name }}</h1>
        <p class="title anim" style="--d: 0.45s">{{ c.title }}</p>
        <div class="rule anim" style="--d: 0.55s"></div>
        <p class="intro anim" style="--d: 0.7s">{{ c.intro }}</p>
        <div class="ops anim" style="--d: 0.85s">
          <router-link class="back" to="/characters">← 返回人物</router-link>
          <router-link class="back accent" :to="`/records/${c.id}`">查看插画 →</router-link>
        </div>
      </div>
    </template>

    <div v-else class="missing">
      <h1>没有找到这个人物</h1>
      <router-link class="back" to="/characters">← 返回人物</router-link>
    </div>
  </div>
</template>

<style scoped>
.detail-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

/* 左照片:放大并归位到左半屏 */
.photo {
  position: relative;
  height: 100vh;
  overflow: hidden;
  animation: photo-in 0.7s var(--ease-out) both;
}

@keyframes photo-in {
  from {
    transform: scale(1.12) translateX(6%);
    opacity: 0.3;
  }
  to {
    transform: scale(1) translateX(0);
    opacity: 1;
  }
}

/* 右文字:错峰渐显 */
.info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1.5rem, 5vw, 4rem);
}

.anim {
  animation: rise 0.6s var(--ease-out) both;
  animation-delay: var(--d, 0s);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateX(34px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.en {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(2.4rem, 5vw, 4rem);
  letter-spacing: 0.06em;
  line-height: 1;
  margin: 0;
  color: var(--accent);
}

.zh {
  margin: 0.8rem 0 0;
  font-size: 1.1rem;
  letter-spacing: 0.42em;
  font-weight: 400;
}

.title {
  margin: 1.4rem 0 0;
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  color: var(--text-soft);
}

.rule {
  width: 42px;
  height: 2px;
  background: var(--accent);
  margin: 1.6rem 0;
}

.intro {
  margin: 0;
  line-height: 2.1;
  font-size: 0.95rem;
  color: var(--text-soft);
  max-width: 46ch;
}

.ops { display: flex; gap: 1.6rem; margin-top: 2.4rem; }

.back {
  font-size: 0.82rem;
  letter-spacing: 0.2em;
  color: var(--text-soft);
  transition: color 0.2s;
}

.back:hover { color: var(--text); }
.back.accent { color: var(--accent); }

.missing { grid-column: 1 / -1; padding: 5rem 2rem; }

@media (max-width: 860px) {
  .detail-view { grid-template-columns: 1fr; }
  .photo { height: 52vh; }
  .info { justify-content: flex-start; padding-top: 2rem; }
}

@media (prefers-reduced-motion: reduce) {
  .photo, .anim { animation: none; opacity: 1; transform: none; }
}
</style>
