<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import DualTitle from '../components/DualTitle.vue'
import { regions } from '../content'

// ---------- 程序化低多边形大陆:value-noise + fbm,零依赖 ----------
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

function fbm(x, y) {
  let v = 0
  let amp = 0.55
  let freq = 1
  for (let i = 0; i < 4; i++) {
    v += amp * noise(x * freq, y * freq)
    amp *= 0.5
    freq *= 2.1
  }
  return v
}

// 海拔:中心高、边缘低(群岛形态)
function heightAt(x, z) {
  const base = fbm(x * 0.055 + 10, z * 0.055 + 10)
  const dist = Math.sqrt(x * x + z * z) / 19
  return base - 0.26 - dist * dist * 0.6
}

const HEIGHT_SCALE = 6

function colorFor(h) {
  if (h < -0.16) return new THREE.Color('#0b1f26') // 深海
  if (h < 0.0) return new THREE.Color('#256069') // 浅海(青蓝系)
  if (h < 0.05) return new THREE.Color('#77806f') // 滩涂
  if (h < 0.24) return new THREE.Color('#4b5847') // 陆地灰绿
  if (h < 0.44) return new THREE.Color('#585e63') // 岩壁
  return new THREE.Color('#c9ced2') // 雪顶
}

// ---------- 组件 ----------
const host = ref(null)
const selected = ref(null)
const hovered = shallowRef(null)

const reduced =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let renderer, scene, camera, controls, rafId = 0
let terrainGroup, markerMeshes = []
let raycaster, pointer
let onPointerMove, onClick, onResize
let clock

onMounted(() => {
  const el = host.value
  const w = el.clientWidth
  const h = el.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0e0f11')
  scene.fog = new THREE.Fog('#0e0f11', 34, 78)

  camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 200)
  camera.position.set(0, 15, 24)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  el.appendChild(renderer.domElement)

  // 灯光
  const dir = new THREE.DirectionalLight('#ffffff', 1.6)
  dir.position.set(12, 22, 8)
  scene.add(dir)
  scene.add(new THREE.AmbientLight('#9ed9dd', 0.25))

  terrainGroup = new THREE.Group()
  scene.add(terrainGroup)

  // 地形
  const geo = new THREE.PlaneGeometry(36, 36, 110, 110)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = heightAt(x, z)
    pos.setY(i, h * HEIGHT_SCALE)
    const c = colorFor(h)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
  )
  terrainGroup.add(terrain)

  // 海面
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      color: '#0d2831',
      transparent: true,
      opacity: 0.88,
      roughness: 0.4,
      metalness: 0.1,
    }),
  )
  sea.rotation.x = -Math.PI / 2
  sea.position.y = -0.3
  scene.add(sea)

  // 板块标记:菱形浮标 + 发光柱
  for (const r of regions) {
    const y = Math.max(heightAt(r.x, r.z) * HEIGHT_SCALE, 0) + 1.4
    const group = new THREE.Group()
    group.position.set(r.x, y, r.z)

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5),
      new THREE.MeshStandardMaterial({
        color: r.color,
        emissive: r.color,
        emissiveIntensity: 0.8,
        flatShading: true,
      }),
    )
    gem.userData.region = r
    group.add(gem)
    markerMeshes.push(gem)

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6),
      new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.55 }),
    )
    beam.position.y = -1.15
    group.add(beam)

    terrainGroup.add(group)
    r._node = group
    r._gem = gem
    r._baseY = y
  }

  // 交互
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.enablePan = false
  controls.minDistance = 14
  controls.maxDistance = 46
  controls.minPolarAngle = 0.55
  controls.maxPolarAngle = 1.32
  controls.target.set(0, 0.5, 0)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  onPointerMove = (e) => {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(markerMeshes, false)[0]
    hovered.value = hit ? hit.object.userData.region : null
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
  }

  onClick = () => {
    if (hovered.value) selected.value = hovered.value
    else selected.value = null
  }

  onResize = () => {
    const nw = el.clientWidth
    const nh = el.clientHeight
    camera.aspect = nw / nh
    camera.updateProjectionMatrix()
    renderer.setSize(nw, nh)
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('click', onClick)
  window.addEventListener('resize', onResize)

  clock = new THREE.Clock()
  const animate = () => {
    rafId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    if (!reduced) {
      terrainGroup.rotation.y += 0.0009
      for (let i = 0; i < regions.length; i++) {
        const r = regions[i]
        r._node.position.y = r._baseY + Math.sin(t * 1.2 + i * 1.7) * 0.18
        r._gem.material.emissiveIntensity = 0.65 + 0.35 * Math.sin(t * 2 + i)
        r._gem.rotation.y = t * 0.5 + i
      }
    }
    for (const m of markerMeshes) {
      const target = hovered.value && m.userData.region.id === hovered.value.id ? 1.35 : 1
      m.scale.setScalar(m.scale.x + (target - m.scale.x) * 0.15)
    }
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  if (renderer) {
    renderer.domElement.removeEventListener('pointermove', onPointerMove)
    renderer.domElement.removeEventListener('click', onClick)
  }
  window.removeEventListener('resize', onResize)
  controls?.dispose()
  scene?.traverse((obj) => {
    obj.geometry?.dispose?.()
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => m.dispose?.())
    }
  })
  renderer?.dispose()
  renderer?.domElement?.parentElement?.removeChild(renderer.domElement)
})
</script>

<template>
  <div class="world-view">
    <div ref="host" class="gl"></div>

    <div class="world-title">
      <DualTitle en="WORLD" zh="世界观" />
      <p class="tip">拖拽旋转 · 点击发光标记查看板块</p>
    </div>

    <!-- 板块介绍面板:右侧滑出,左边缘渐变衔接场景 -->
    <transition name="panel">
      <div v-if="selected" class="panel-wrap" @click.self="selected = null">
        <div class="fade-strip"></div>
        <aside class="panel">
          <button class="close" aria-label="关闭" @click="selected = null">✕</button>
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

/* ---------- 右侧介绍面板 ---------- */
.panel-wrap {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
}

/* 面板左边缘:向左渐隐的渐变过渡,与 3D 场景自然衔接 */
.fade-strip {
  width: 90px;
  background: linear-gradient(to right, transparent, #16181c);
}

.panel {
  position: relative;
  width: 340px;
  background: #16181c;
  color: #e8eaec;
  padding: 3.2rem 2.2rem;
  /* HUD 切角:右下角斜切 */
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 26px), calc(100% - 26px) 100%, 0 100%);
}

.panel .zh { color: #9a9ea4; }

.close {
  position: absolute;
  top: 1.1rem;
  right: 1.1rem;
  background: none;
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

/* ---------- 移动端:面板改为底部弹出 ---------- */
@media (max-width: 860px) {
  .world-title { top: 4.2rem; left: 1.2rem; }

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

  .panel-enter-from, .panel-leave-to { transform: translateY(60px); }
}
</style>
