<script setup>
import { photos, diaryPosts } from '../content'

const latestPhotos = photos.slice(0, 6)
const latestPosts = diaryPosts.slice(0, 3)
</script>

<template>
  <section class="hero">
    <p class="eyebrow">PHOTO DIARY</p>
    <h1>把日子过成<br /><em>可以被翻看的样子</em></h1>
    <p class="sub">照片与文字,记录那些值得留住的瞬间。</p>
  </section>

  <h2 class="section-title">最新照片</h2>
  <div class="photo-grid">
    <router-link
      v-for="p in latestPhotos"
      :key="p.id"
      to="/photos"
      class="card photo-card"
    >
      <div class="thumb"><img :src="p.url" :alt="p.title" loading="lazy" /></div>
      <div class="meta">
        <span class="title">{{ p.title }}</span>
        <span class="date">{{ p.date }}</span>
      </div>
    </router-link>
  </div>

  <h2 class="section-title">最新日记</h2>
  <div class="post-list">
    <router-link
      v-for="post in latestPosts"
      :key="post.id"
      :to="`/diary/${post.id}`"
      class="card post-card"
    >
      <div v-if="post.cover" class="thumb post-cover">
        <img :src="post.cover" :alt="post.title" loading="lazy" />
      </div>
      <div class="post-body">
        <span class="date">{{ post.date }}</span>
        <h3>{{ post.title }}</h3>
        <p>{{ post.summary }}</p>
      </div>
    </router-link>
  </div>
</template>

<style scoped>
.hero { padding: clamp(1rem, 6vw, 4rem) 0 1rem; }

.eyebrow {
  letter-spacing: 0.4em;
  font-size: 0.75rem;
  color: var(--accent);
  margin: 0 0 1rem;
}

.hero h1 {
  font-size: clamp(2rem, 6vw, 3.4rem);
  line-height: 1.25;
  margin: 0 0 1.2rem;
  font-weight: 700;
}

.hero h1 em {
  font-style: normal;
  background: linear-gradient(120deg, var(--rose-mid), var(--rose-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.sub { color: var(--text-soft); font-size: 1.05rem; margin: 0; }

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.2rem;
}

.photo-card .thumb { aspect-ratio: 3 / 2; }

.meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.75rem 1rem;
}

.meta .title { font-weight: 600; font-size: 0.95rem; }
.meta .date { font-size: 0.78rem; color: var(--text-soft); }

.post-list { display: grid; gap: 1.2rem; }

.post-card { display: flex; }

.post-cover {
  width: 240px;
  flex-shrink: 0;
  border-radius: 16px 0 0 16px;
}

.post-body { padding: 1.2rem 1.5rem; }
.post-body .date { font-size: 0.78rem; color: var(--accent); letter-spacing: 0.1em; }
.post-body h3 { margin: 0.4rem 0 0.5rem; font-size: 1.15rem; }
.post-body p { margin: 0; color: var(--text-soft); font-size: 0.92rem; line-height: 1.7; }

@media (max-width: 640px) {
  .post-card { flex-direction: column; }
  .post-cover { width: 100%; aspect-ratio: 16 / 9; border-radius: 16px 16px 0 0; }
}
</style>
