<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DualTitle from '../components/DualTitle.vue'
import FadeImg from '../components/FadeImg.vue'
import { regions } from '../content'
import { useThemeStore } from '../stores/theme'
import { World } from '../three'

/* ================================================================
 * AETHERION 世界观页 —— UI 壳
 * three.js 全部逻辑在 src/three/World.js(经 index.js 唯一出口),
 * 本组件只负责:容器、覆盖层 DOM、面板 UI、主题/层状态同步。
 * ================================================================ */

const LAYERS = [
  { key: 'sky', en: 'SKY', zh: '天空' },
  { key: 'surface', en: 'SURFACE', zh: '地表' },
  { key: 'underground', en: 'UNDERGROUND', zh: '地下' },
]
const LAYER_LABEL = {
  sky: '天空 · SKY',
  surface: '地表 · SURFACE',
  underground: '地下 · UNDERGROUND',
}

const theme = useThemeStore()

const host = ref(null)
const wipeEl = ref(null)
const wipeBd = ref(null)

const layer = ref('surface')
const selected = ref(null)
const selectedLayerLabel = computed(() =>
  selected.value ? LAYER_LABEL[selected.value.layer] : '',
)

const reduced =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let world = null

onMounted(() => {
  world = new World(host.value, {
    regions,
    wipeEl: wipeEl.value,
    wipeBd: wipeBd.value,
    reduced,
    dark: theme.dark,
    onLayer: (key) => {
      layer.value = key
    },
    onSelect: (region) => {
      selected.value = region
    },
  })
})

onBeforeUnmount(() => {
  world?.dispose()
  world = null
})

watch(
  () => theme.dark,
  (dark) => world?.setDayNight(dark),
)
</script>

<template>
  <div class="world-view">
    <div ref="host" class="gl"></div>

    <div class="world-title">
      <DualTitle en="AETHERION" zh="艾瑟里昂 · 世界观" />
      <p class="tip">拖拽旋转 · 点击发光标记拉近查看</p>
    </div>

    <!-- 三层切换:天空 / 地表 / 地下 -->
    <div class="layer-switch">
      <button
        v-for="l in LAYERS"
        :key="l.key"
        class="lbtn"
        :class="{ active: layer === l.key }"
        @click="world?.setLayer(l.key)"
      >
        <span class="en">{{ l.en }}</span>
        <span class="zh">{{ l.zh }}</span>
      </button>
    </div>

    <!-- 层切换笔画擦除 overlay(盖住一切,pointer-events 不拦截) -->
    <div ref="wipeBd" class="wipe-bd"></div>
    <div ref="wipeEl" class="wipe"></div>

    <!-- 板块介绍面板:右侧滑出,左边缘渐变衔接场景 -->
    <transition name="panel">
      <div v-if="selected" class="panel-wrap" @click.self="world?.exitFocus()">
        <div class="fade-strip"></div>
        <aside class="panel">
          <button class="close" aria-label="关闭" @click="world?.exitFocus()">✕</button>
          <!-- 概念头图:铺满面板宽,底部渐变融入面板底色;加载前骨架占位 -->
          <div v-if="selected.image" class="panel-hero">
            <FadeImg :src="selected.image" :alt="selected.name" />
          </div>
          <p class="layer-tag">{{ selectedLayerLabel }}</p>
          <div class="dual-title sm">
            <h1 class="en" :style="{ color: selected.color }">{{ selected.nameEn }}</h1>
            <p class="zh">{{ selected.name }}</p>
          </div>
          <p class="desc">{{ selected.description }}</p>
        </aside>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.world-view {
  position: relative;
  height: 100vh;
  overflow: hidden;
  background: #0e0f11;
}

.gl { position: absolute; inset: 0; }

.world-title {
  position: absolute;
  top: 2.2rem;
  left: 2.4rem;
  z-index: 5;
  pointer-events: none;
  color: #e8eaec;
}

.world-title :deep(.en) { color: #e8eaec; }
.world-title :deep(.zh) { color: #9a9ea4; }

.tip {
  margin: 1rem 0 0;
  font-size: 0.72rem;
  letter-spacing: 0.28em;
  color: #9a9ea4;
}

/* ---------- 三层切换按钮 ---------- */
.layer-switch {
  position: absolute;
  top: 2.2rem;
  right: 2.4rem;
  z-index: 6;
  display: flex;
  gap: 0.6rem;
}

.lbtn {
  display: grid;
  gap: 0.25rem;
  justify-items: center;
  padding: 0.55rem 1.1rem;
  background: rgba(22, 24, 28, 0.75);
  border: 1px solid #2a2e34;
  color: #9a9ea4;
  cursor: pointer;
  transition: color 0.25s, border-color 0.25s, background 0.25s, transform 0.1s;
  backdrop-filter: blur(6px);
}

.lbtn .en {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  line-height: 1;
}

.lbtn .zh { font-size: 0.62rem; letter-spacing: 0.3em; }

.lbtn:hover { color: #e8eaec; border-color: #9ed9dd; }
.lbtn:active { transform: scale(0.97); }

.lbtn.active {
  color: #9ed9dd;
  border-color: #9ed9dd;
  background: rgba(158, 217, 221, 0.1);
}

/* ---------- 右侧介绍面板 ---------- */
.panel-wrap {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
}

.fade-strip {
  width: 90px;
  background: linear-gradient(to right, transparent, #16181c);
}

.panel {
  position: relative;
  width: 360px;
  background: #16181c;
  color: #e8eaec;
  padding: 3.2rem 2.2rem;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 26px), calc(100% - 26px) 100%, 0 100%);
}

.panel .zh { color: #9a9ea4; }

/* ---------- 面板概念头图 ---------- */
.panel-hero {
  position: relative;
  height: 160px;
  /* 抵消面板 padding,图片铺满面板整个宽度(含顶部) */
  margin: -3.2rem -2.2rem 1.6rem;
  overflow: hidden;
}

/* 底部渐变淡出,让图融入纯色面板背景(#16181c),不形成硬边 */
.panel-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 45%, rgba(22, 24, 28, 0.65) 78%, #16181c 100%);
  pointer-events: none;
}

.layer-tag {
  display: inline-block;
  margin: 0 0 1.2rem;
  padding: 0.25rem 0.7rem;
  border: 1px solid #2a2e34;
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  color: #9ed9dd;
}

.close {
  position: absolute;
  top: 1.1rem;
  right: 1.1rem;
  z-index: 2; /* 压在概念头图之上 */
  background: rgba(22, 24, 28, 0.55);
  border: 1px solid #2a2e34;
  color: #9a9ea4;
  width: 34px;
  height: 34px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: color 0.2s, border-color 0.2s;
}

.close:hover { color: #9ed9dd; border-color: #9ed9dd; }

.desc {
  margin: 1.8rem 0 0;
  line-height: 2;
  font-size: 0.94rem;
  color: #c3c7cc;
}

.panel-enter-active { transition: transform 0.4s var(--ease-out), opacity 0.35s ease-out; }
.panel-leave-active { transition: transform 0.25s ease-out, opacity 0.2s ease-out; }
.panel-enter-from, .panel-leave-to { transform: translateX(60px); opacity: 0; }

/* ---------- 层切换笔画擦除 ---------- */
.wipe-bd {
  position: absolute;
  inset: 0;
  z-index: 38;
  background: #0e0f11;
  opacity: 0;
  pointer-events: none;
}

.wipe {
  position: absolute;
  top: -4%;
  bottom: -4%;
  left: 0;
  width: 55vw;
  z-index: 39;
  background: #0e0f11;
  border-right: 3px solid #9ed9dd; /* 前进方向亮边 */
  box-shadow:
    0 0 30px 8px rgba(158, 217, 221, 0.28),
    46px 0 90px 42px #0e0f11,
    -34px 0 70px 34px #0e0f11; /* 上下/尾部边缘不规则模糊 */
  transform: translateX(-110vw) skewX(-3deg);
  pointer-events: none;
}

/* ---------- 移动端 ---------- */
@media (max-width: 860px) {
  .world-title { top: 4.2rem; left: 1.2rem; }
  .layer-switch { top: auto; bottom: 1.2rem; right: 1.2rem; left: 1.2rem; justify-content: center; }

  .panel-wrap {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    flex-direction: column;
  }

  .fade-strip {
    width: auto;
    height: 48px;
    background: linear-gradient(to bottom, transparent, #16181c);
  }

  .panel {
    width: 100%;
    max-height: 52vh;
    overflow: auto;
    padding: 1.6rem 1.4rem 2.2rem;
    clip-path: none;
  }

  .panel-hero {
    height: 140px;
    margin: -1.6rem -1.4rem 1.2rem; /* 对应移动端面板 padding */
  }

  .panel-enter-from, .panel-leave-to { transform: translateY(60px); }
}
</style>
