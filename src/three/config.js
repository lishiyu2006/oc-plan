import { Color } from 'three'

/* ================================================================
 * AETHERION 世界常量 —— 全部纯数据,零副作用
 * ================================================================ */

// ---------- 高程与布局常量 ----------
export const H_SCALE = 6
export const SKY_Y = 14
export const UNDER_DOME_Y = -8
export const UNDER_SEA_Y = -20

// 古境王门离岛(与大陆分离的第二块小陆地)
export const ISLE = { x: 20, z: -8, r: 4.6 }

// ---------- 层定义 ----------
export const LAYERS = [
  { key: 'sky', en: 'SKY', zh: '天空' },
  { key: 'surface', en: 'SURFACE', zh: '地表' },
  { key: 'underground', en: 'UNDERGROUND', zh: '地下' },
]
export const LAYER_LABEL = {
  sky: '天空 · SKY',
  surface: '地表 · SURFACE',
  underground: '地下 · UNDERGROUND',
}
export const LAYER_VIEW = {
  surface: { pos: [0, 15, 24], tgt: [0, 0.5, 0] },
  sky: { pos: [0, 19.5, 21], tgt: [0, 14.2, 0] },
  // 地下相机放在洞顶背板(半径 22)之外俯视进入,避免穿模
  underground: { pos: [0, -14, 30], tgt: [0, -16, 0] },
}
// 切层高空中继点:任何层切换都先升到这里,再下降进入目标层
export const SAFE_RELAY = { pos: [0, 26, 30], tgt: [0, 0, 0] }

// ---------- 昼夜参数(映射:网站亮色主题 = 3D 白天,暗色主题 = 3D 黑夜) ----------
export const DAY = {
  bg: new Color('#aebec5'),
  hemiSky: new Color('#cfe4ea'),
  hemiGround: new Color('#5a6a5e'),
  hemiInt: 0.8,
  dirColor: new Color('#fff0d8'),
  dirInt: 2.1,
  seaColor: new Color('#1e5b68'),
  seaOpacity: 0.75,
  starOp: 0,
  particleOp: 0.3,
  emissiveK: 0.6,
}
export const NIGHT = {
  bg: new Color('#0a0e18'),
  hemiSky: new Color('#1a2438'),
  hemiGround: new Color('#0c1018'),
  hemiInt: 0.3,
  dirColor: new Color('#93a8d8'),
  dirInt: 0.55,
  seaColor: new Color('#0d2831'),
  seaOpacity: 0.88,
  starOp: 0.9,
  particleOp: 0.95,
  emissiveK: 1.35,
}
