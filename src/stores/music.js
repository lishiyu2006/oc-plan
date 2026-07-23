import { defineStore } from 'pinia'
import { useConsentStore } from './consent'

// 全局 BGM 播放器(单例 audio,不随路由切换销毁)
// - 默认不自动播放(浏览器自动播放策略);用户点击 SideNav 音符按钮切换
// - 播放状态仅在用户同意"全部"cookie 时持久化到 localStorage
// - 若上次开过音乐,本次访问在首次用户交互(pointerdown/keydown)后自动恢复
const KEY = 'music-on'
let audio = null

export const useMusicStore = defineStore('music', {
  state: () => ({ playing: false }),
  actions: {
    init() {
      if (audio) return
      audio = new Audio(`${import.meta.env.BASE_URL}audio/bgm.mp3`)
      audio.loop = true
      audio.preload = 'auto'
      audio.addEventListener('play', () => {
        this.playing = true
      })
      audio.addEventListener('pause', () => {
        this.playing = false
      })

      let want = false
      try {
        want = localStorage.getItem(KEY) === '1'
      } catch {
        /* 存储不可用时忽略 */
      }
      if (!want) return
      const resume = () => {
        window.removeEventListener('pointerdown', resume)
        window.removeEventListener('keydown', resume)
        this.tryPlay()
      }
      window.addEventListener('pointerdown', resume)
      window.addEventListener('keydown', resume)
    },
    tryPlay() {
      if (!audio) return
      audio.play().catch(() => {
        /* 浏览器拒绝自动播放时保持暂停态,等用户手动点 */
      })
    },
    toggle() {
      if (!audio) this.init()
      if (this.playing) audio.pause()
      else this.tryPlay()
      this.persist(!this.playing)
    },
    persist(on) {
      // 走 cookie-consent 许可逻辑:未同意"全部"不写入
      const consent = useConsentStore()
      if (!consent.allowed) return
      try {
        localStorage.setItem(KEY, on ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
  },
})
