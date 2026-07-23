<script setup>
import { NButton } from 'naive-ui'
import { useConsentStore } from '../stores/consent'

const consent = useConsentStore()
</script>

<template>
  <div v-if="consent.status === 'pending'" class="banner" role="dialog" aria-label="本地存储许可">
    <div class="text">
      <strong>本地存储许可</strong>
      <p>
        本站希望在您的浏览器中保存主题偏好、阅读记录等数据,以提供更好的浏览体验。
        选择「仅必要」后,除用于记住开场动画已播放的临时会话标记(仅当前会话有效)外,
        不会写入任何持久化数据。所有数据只保存在您自己的浏览器中,不会上传到任何服务器。
      </p>
    </div>
    <div class="actions">
      <n-button size="small" @click="consent.choose('necessary')">仅必要</n-button>
      <n-button size="small" type="primary" color="#5fb8bd" @click="consent.choose('all')">
        接受
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.banner {
  position: fixed;
  left: 50%;
  bottom: 1.2rem;
  transform: translateX(-50%);
  z-index: 500;
  width: min(680px, calc(100vw - 2rem));
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1rem 1.3rem;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  animation: rise 0.4s ease;
}

@keyframes rise {
  from { transform: translate(-50%, 16px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}

.text { flex: 1; }
.text strong { font-size: 0.95rem; }
.text p {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  line-height: 1.7;
  color: var(--text-soft);
}

.actions {
  display: flex;
  gap: 0.6rem;
  flex-shrink: 0;
}

@media (max-width: 560px) {
  .banner { flex-direction: column; align-items: stretch; }
  .actions { justify-content: flex-end; }
}
</style>
