<script setup>
import { computed, ref } from 'vue'
import { photos, albums } from '../content'
import FadeImg from '../components/FadeImg.vue'

const activeAlbum = ref('全部')

const filtered = computed(() =>
  activeAlbum.value === '全部'
    ? photos
    : photos.filter((p) => p.album === activeAlbum.value),
)
</script>

<template>
  <h1 class="page-title">相册</h1>
  <p class="page-sub">按专辑浏览,或下拉查看全部照片。</p>

  <div class="album-tabs">
    <button
      v-for="a in ['全部', ...albums]"
      :key="a"
      class="tab"
      :class="{ active: activeAlbum === a }"
      @click="activeAlbum = a"
    >
      {{ a }}
    </button>
  </div>

  <div class="masonry">
    <figure v-for="p in filtered" :key="p.id" class="card item" v-reveal>
      <div class="thumb"><FadeImg :src="p.url" :alt="p.title" /></div>
      <figcaption class="caption">
        <div class="row">
          <span class="title">{{ p.title }}</span>
          <span class="album">{{ p.album }}</span>
        </div>
        <span class="date">{{ p.date }}</span>
        <p v-if="p.description" class="desc">{{ p.description }}</p>
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.page-title { font-size: 2rem; margin: 0 0 0.4rem; }
.page-sub { color: var(--text-soft); margin: 0 0 1.5rem; }

.album-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 1.6rem;
}

.tab {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-soft);
  padding: 0.4rem 1rem;
  border-radius: 999px;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover { color: var(--text); }

.tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

/* 瀑布流:CSS columns 实现,无第三方依赖 */
.masonry { columns: 3 260px; column-gap: 1.2rem; }

.item {
  break-inside: avoid;
  margin: 0 0 1.2rem;
}

.item .thumb { aspect-ratio: 3 / 2; }

.tab:active { transform: scale(0.97); }

.caption { padding: 0.9rem 1.1rem 1.1rem; }

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.title { font-weight: 600; }

.album {
  font-size: 0.72rem;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.date { display: block; font-size: 0.78rem; color: var(--text-soft); margin-top: 0.3rem; }

.desc {
  margin: 0.6rem 0 0;
  font-size: 0.85rem;
  line-height: 1.7;
  color: var(--text-soft);
}
</style>
