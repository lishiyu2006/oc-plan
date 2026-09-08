import * as THREE from 'three'
import { ISLE } from './config.js'

/* ================================================================
 * 程序化高度场数学(value noise + fbm + 域扭曲)
 * 注意:随 ADR-0001(glTF 场景级替换)此模块将被删除,M3 起不再使用。
 * ================================================================ */

function makeNoise(seed) {
  const rand = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  const fade = (t) => t * t * (3 - 2 * t)
  return (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const a = rand(xi, yi)
    const b = rand(xi + 1, yi)
    const c = rand(xi, yi + 1)
    const d = rand(xi + 1, yi + 1)
    const u = fade(xf)
    const v = fade(yf)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}
const noise = makeNoise(7)
const vegNoise = makeNoise(23)

function fbm(n, x, y, oct = 6) {
  let v = 0
  let amp = 0.55
  let f = 1
  for (let i = 0; i < oct; i++) {
    v += amp * n(x * f, y * f)
    amp *= 0.5
    f *= 2.05
  }
  return v
}

// 域扭曲让海岸线更自然
function heightAt(x, z) {
  const qx = fbm(noise, x * 0.045 + 5.2, z * 0.045 + 1.3, 4)
  const qz = fbm(noise, x * 0.045 + 2.8, z * 0.045 + 8.1, 4)
  const base = fbm(noise, x * 0.045 + qx * 4.5, z * 0.045 + qz * 4.5, 6)
  // 平滑径向衰减:r<9 保持原样,9→17 沉入深海,保证大陆四周完整环海
  const dist = Math.sqrt(x * x + z * z)
  const s = THREE.MathUtils.clamp((dist - 9) / 8, 0, 1)
  const fall = s * s * (3 - 2 * s)
  return base - 0.26 - fall * 1.15
}

// 霜语冰原范围(北境:染白、不种树)
function inFrost(x, z) {
  return x > -3 && x < 7 && z > -11 && z < -5
}

// 古境王门离岛高度场(以 ISLE 为原点)
function isleHeightAt(x, z) {
  const dx = x - ISLE.x
  const dz = z - ISLE.z
  const d = Math.sqrt(dx * dx + dz * dz) / ISLE.r
  if (d >= 1) return -0.5
  const base = fbm(noise, x * 0.2 + 3.1, z * 0.2 + 7.7, 4)
  return (base - 0.32) * 0.5 * (1 - d * d) + (1 - d * d) * 0.24
}

export { fbm, heightAt, inFrost, isleHeightAt, noise, vegNoise }
