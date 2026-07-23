<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import DualTitle from '../components/DualTitle.vue'
import FadeImg from '../components/FadeImg.vue'
import { getCharacter } from '../content'

const route = useRoute()
const c = computed(() => getCharacter(route.params.id))
const lightbox = ref(null)
</script>

<template>
  <div class="record-detail">
    <template v-if="c">
      <header class="head" v-reveal>
        <DualTitle :en="c.nameEn" zh="插画记录" size="sm" />
        <router-link class="back" to="/records">← 返回记录</router-link>
      </header>

      <div class="gallery">
        <button
          v-for="(url, i) in c.illustrations"
          :key="i"
          class="card piece"
          v-reveal="i * 80"
          @click="lightbox = url"
        >
          <div class="thumb"><FadeImg :src="url" :alt="`${c.name} 插画 ${i + 1}`" /></div>
        </button>
      </div>

      <!-- 大图 lightbox -->
      <transition name="lb">
        <div v-if="lightbox" class="lightbox" @click="lightbox = null">
          <img :src="lightbox" :alt="c.name" />
          <p class="lb-hint">点击任意处关闭</p>
        </div>
      </transition>
    </template>

    <div v-else class="missing">
      <h1>没有找到这个人物</h1>
      <router-link class="back" to="/records">← 返回记录</router-link>
    </div>
  </div>
</template>

<style scoped>
.record-detail {
  min-height: 100vh;
  padding: 3rem clamp(1.2rem, 4vw, 3rem) 4rem;
}

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}

.back {
  font-size: 0.82rem;
  letter-spacing: 0.2em;
  color: var(--text-soft);
  transition: color 0.2s;
  white-space: nowrap;
}

.back:hover { color: var(--accent); }

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.2rem;
}

.piece {
  padding: 0;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: zoom-in;
  text-align: left;
}

.piece .thumb { aspect-ratio: 3 / 2; }

/* lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(14, 15, 17, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  cursor: zoom-out;
  padding: 2rem;
}

.lightbox img {
  max-width: min(1100px, 92vw);
  max-height: 82vh;
  object-fit: contain;
  border: 1px solid #2a2e34;
}

.lb-hint {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.3em;
  color: #9a9ea4;
}

.lb-enter-active { transition: opacity 0.3s ease-out; }
.lb-leave-active { transition: opacity 0.2s ease-out; }
.lb-enter-from, .lb-leave-to { opacity: 0; }
.lb-enter-active img { transition: transform 0.35s var(--ease-out); }
.lb-enter-from img { transform: scale(0.94); }

.missing { padding: 5rem 2rem; }

@media (max-width: 860px) {
  .record-detail { padding-top: 4.5rem; }
}
</style>
