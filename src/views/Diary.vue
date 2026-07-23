<script setup>
import { ref } from 'vue'
import { diaryPosts, getReadPosts } from '../content'
import FadeImg from '../components/FadeImg.vue'

// 已读标记(仅展示;写入发生在详情页,且需用户同意)
const readIds = ref(getReadPosts())
</script>

<template>
  <h1 class="page-title">日记</h1>
  <p class="page-sub">共 {{ diaryPosts.length }} 篇,按时间倒序。</p>

  <div class="list">
    <router-link
      v-for="post in diaryPosts"
      :key="post.id"
      :to="`/diary/${post.id}`"
      class="card item"
      v-reveal
    >
      <div v-if="post.cover" class="thumb cover">
        <FadeImg :src="post.cover" :alt="post.title" />
      </div>
      <div class="body">
        <div class="top">
          <span class="date">{{ post.date }}</span>
          <span v-if="readIds.includes(post.id)" class="read">已读</span>
        </div>
        <h2>{{ post.title }}</h2>
        <p>{{ post.summary }}</p>
      </div>
    </router-link>
  </div>
</template>

<style scoped>
.page-title { font-size: 2rem; margin: 0 0 0.4rem; }
.page-sub { color: var(--text-soft); margin: 0 0 1.8rem; }

.list { display: grid; gap: 1.3rem; }

.item { display: flex; }

.cover {
  width: 260px;
  flex-shrink: 0;
  border-radius: 16px 0 0 16px;
}

.body { padding: 1.3rem 1.6rem; }

.top {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.date { font-size: 0.8rem; color: var(--accent); letter-spacing: 0.1em; }

.read {
  font-size: 0.72rem;
  color: var(--text-soft);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.1rem 0.55rem;
}

.body h2 { margin: 0.45rem 0 0.55rem; font-size: 1.25rem; }
.body p { margin: 0; color: var(--text-soft); line-height: 1.75; font-size: 0.94rem; }

@media (max-width: 640px) {
  .item { flex-direction: column; }
  .cover { width: 100%; aspect-ratio: 16 / 9; border-radius: 16px 16px 0 0; }
}
</style>
