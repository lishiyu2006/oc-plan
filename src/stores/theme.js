import { defineStore } from 'pinia'
import { useConsentStore } from './consent'

// 昼夜主题:CSS 变量 + data-theme 属性,持久化需先获得同意
export const useThemeStore = defineStore('theme', {
  state: () => ({ dark: false }),
  actions: {
    init() {
      const consent = useConsentStore()
      if (consent.allowed) {
        try {
          this.dark = localStorage.getItem('theme') === 'dark'
          return
        } catch {
          /* fallthrough */
        }
      }
      // 未同意时跟随系统偏好(不持久化)
      this.dark =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    },
    toggle() {
      this.dark = !this.dark
      const consent = useConsentStore()
      if (consent.allowed) {
        try {
          localStorage.setItem('theme', this.dark ? 'dark' : 'light')
        } catch {
          /* ignore */
        }
      }
    },
  },
})
