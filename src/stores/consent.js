import { defineStore } from 'pinia'

// Cookie / 本地存储同意状态
// pending: 尚未选择(显示横幅)
// all: 接受,允许持久化存储主题偏好、阅读记录等
// necessary: 仅必要,不写任何持久化存储(sessionStorage 的进场动画标记除外)
export const useConsentStore = defineStore('consent', {
  state: () => ({ status: 'pending' }),
  getters: {
    allowed: (s) => s.status === 'all',
  },
  actions: {
    init() {
      try {
        const v = localStorage.getItem('cookie-consent')
        if (v === 'all' || v === 'necessary') this.status = v
      } catch {
        /* 存储不可用时保持 pending */
      }
    },
    choose(value) {
      this.status = value
      try {
        localStorage.setItem('cookie-consent', value)
        if (value === 'necessary') {
          // 用户改选"仅必要"时,清除此前写入的偏好数据
          localStorage.removeItem('theme')
          localStorage.removeItem('read-posts')
          localStorage.removeItem('music-on')
        }
      } catch {
        /* ignore */
      }
    },
  },
})
