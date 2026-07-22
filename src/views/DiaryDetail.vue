<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getPost, markPostRead } from '../content'
import { useConsentStore } from '../stores/consent'

const route = useRoute()
const consent = useConsentStore()
const post = computed(() => getPost(route.params.id))

onMounted(() => {
  // 阅读记录属于偏好数据,需用户同意后才持久化
  if (post.value && consent.allowed) markPostRead(post.value.id)
})
</script>

<template>
  <article v-if="post" class="article">
    <router-link to="/diary" class="back">← 返回日记列表</router-link>
    <p class="date">{{ post.date }}</p>
    <h1>{{ post.title }}</h1>
    <div v-if="post.cover" class="card cover-card">
      <img :src="post.cover" :alt="post.title" />
    </div>
    <!-- 内容由本地 markdown 构建期渲染,非用户输入 -->
    <div class="prose" v-html="post.html"></div>
  </article>

  <div v-else class="not-found">
    <h1>没有找到这篇日记</h1>
    <p>它可能已被移动或删除。</p>
    <router-link to="/diary" class="back">← 返回日记列表</router-link>
  </div>
</template>

<style scoped>
.article { max-width: 720px; margin: 0 auto; }

.back {
  display: inline-block;
  font-size: 0.88rem;
  color: var(--accent);
  margin-bottom: 2rem;
}

.date {
  color: var(--accent);
  letter-spacing: 0.15em;
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
}

h1 {
  font-size: clamp(1.6rem, 5vw, 2.4rem);
  margin: 0 0 1.5rem;
  line-height: 1.3;
}

.cover-card { margin-bottom: 2rem; }
.cover-card img { width: 100%; }

.not-found { text-align: center; padding: 4rem 0; }
.not-found p { color: var(--text-soft); }
</style>
