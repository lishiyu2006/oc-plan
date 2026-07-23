<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import DualTitle from '../components/DualTitle.vue'
import { regions } from '../content'
import { useThemeStore } from '../stores/theme'

/* ================================================================
 * 艾瑟里昂 AETHERION —— 漂浮在虚空中的魔法大陆
 * 三层结构:天空 sky(y≈14)/ 地表 surface(y≈0)/ 地下 underground(y≈-8~-20)
 * 全部手写在同一场景,无额外依赖
 * ================================================================ */

// ---------- value noise + fbm(6 octaves)+ 域扭曲 ----------
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
  const dist = Math.sqrt(x * x + z * z) / 19
  return base - 0.26 - dist * dist * 0.6
}

const H_SCALE = 6
const SKY_Y = 14
const UNDER_DOME_Y = -8
const UNDER_SEA_Y = -20

const LAYERS = [
  { key: 'sky', en: 'SKY', zh: '天空' },
  { key: 'surface', en: 'SURFACE', zh: '地表' },
  { key: 'underground', en: 'UNDERGROUND', zh: '地下' },
]
const LAYER_LABEL = { sky: '天空 · SKY', surface: '地表 · SURFACE', underground: '地下 · UNDERGROUND' }
const LAYER_VIEW = {
  surface: { pos: [0, 15, 24], tgt: [0, 0.5, 0] },
  sky: { pos: [0, 19.5, 21], tgt: [0, 14.2, 0] },
  underground: { pos: [0, -11, 21], tgt: [0, -15.5, 0] },
}

// ---------- 昼夜参数(映射:网站亮色主题 = 3D 白天,暗色主题 = 3D 黑夜) ----------
const DAY = {
  bg: new THREE.Color('#aebec5'),
  hemiSky: new THREE.Color('#cfe4ea'),
  hemiGround: new THREE.Color('#5a6a5e'),
  hemiInt: 0.8,
  dirColor: new THREE.Color('#fff0d8'),
  dirInt: 2.1,
  seaColor: new THREE.Color('#1e5b68'),
  seaOpacity: 0.75,
  starOp: 0,
  particleOp: 0.3,
  emissiveK: 0.6,
}
const NIGHT = {
  bg: new THREE.Color('#0a0e18'),
  hemiSky: new THREE.Color('#1a2438'),
  hemiGround: new THREE.Color('#0c1018'),
  hemiInt: 0.3,
  dirColor: new THREE.Color('#93a8d8'),
  dirInt: 0.55,
  seaColor: new THREE.Color('#0d2831'),
  seaOpacity: 0.88,
  starOp: 0.9,
  particleOp: 0.95,
  emissiveK: 1.35,
}

// ---------- 组件状态 ----------
const host = ref(null)
const layer = ref('surface')
const selected = ref(null)
const selectedLayerLabel = computed(() =>
  selected.value ? LAYER_LABEL[selected.value.layer] : '',
)

const theme = useThemeStore()
const reduced =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let renderer, scene, camera, controls, clock, rafId = 0
let hemi, dirLight, seaMesh, underSeaMesh, stars, particles, rimRain
let islands = []
let markerGroups = {} // layer -> Group(含浮标 + point light)
let gemsByLayer = { sky: [], surface: [], underground: [] }
let markerByRegion = {}
let raycaster, pointer, hovered = null
let tween = null
let focused = false
let orbiting = true
let userInteracting = false
let dn = 1 // day-night 插值:1 = 白天,0 = 黑夜
let dnTarget = 1
let listeners = []

function addListener(target, type, fn, opts) {
  target.addEventListener(type, fn, opts)
  listeners.push([target, type, fn])
}

/* ---------- 相机动画:球面弧线插值(旋转着拉近/切层),easeOutCubic ---------- */
function flyTo(toPosArr, toTgtArr, dur, done) {
  const toPos = new THREE.Vector3(...toPosArr)
  const toTgt = new THREE.Vector3(...toTgtArr)
  if (reduced) {
    camera.position.copy(toPos)
    controls.target.copy(toTgt)
    controls.enabled = true
    done?.()
    return
  }
  const center = toTgt.clone()
  const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(center))
  const to = new THREE.Spherical().setFromVector3(toPos.clone().sub(center))
  let dTheta = to.theta - from.theta
  while (dTheta > Math.PI) dTheta -= Math.PI * 2
  while (dTheta < -Math.PI) dTheta += Math.PI * 2
  tween = {
    t0: performance.now(),
    dur: dur * 1000,
    center,
    from,
    to,
    dTheta,
    fromTgt: controls.target.clone(),
    toTgt,
    done,
  }
  controls.enabled = false
}

function stepTween(now) {
  const k = Math.min(1, (now - tween.t0) / tween.dur)
  const e = 1 - Math.pow(1 - k, 3) // easeOutCubic
  const s = new THREE.Spherical(
    THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, e),
    THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, e),
    tween.from.theta + tween.dTheta * e,
  )
  camera.position.copy(tween.center).add(new THREE.Vector3().setFromSpherical(s))
  controls.target.lerpVectors(tween.fromTgt, tween.toTgt, e)
  if (k >= 1) {
    const done = tween.done
    tween = null
    controls.enabled = true
    done?.()
  }
}

/* ---------- 交互 ---------- */
function switchLayer(key) {
  if (key === layer.value) return
  layer.value = key
  selected.value = null
  focused = false
  for (const k of Object.keys(markerGroups)) markerGroups[k].visible = k === key
  const v = LAYER_VIEW[key]
  flyTo(v.pos, v.tgt, 0.95)
}

function focusRegion(region) {
  const node = markerByRegion[region.id]
  if (!node) return
  const mPos = new THREE.Vector3()
  node.getWorldPosition(mPos)
  // 相机沿球面弧线拉近到板块附近(比平时自转快得多的旋转)
  const dir = camera.position.clone().sub(mPos)
  if (dir.length() < 0.001) dir.set(1, 0.5, 1)
  dir.normalize()
  if (dir.y < 0.3) {
    dir.y = 0.35
    dir.normalize()
  }
  const dest = mPos.clone().add(dir.multiplyScalar(6.5))
  focused = true
  flyTo(dest.toArray(), mPos.toArray(), 0.8, () => {
    selected.value = region // 拉近到位后再滑出介绍面板
  })
}

function unfocus() {
  if (!focused && !selected.value) return
  focused = false
  selected.value = null
  const v = LAYER_VIEW[layer.value]
  flyTo(v.pos, v.tgt, 0.85)
}

/* ---------- 场景搭建 ---------- */
function buildTerrain() {
  const geo = new THREE.PlaneGeometry(36, 36, 256, 256)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = heightAt(x, z)
    pos.setY(i, h * H_SCALE)
    if (h < -0.16) c.set('#0b1f26')
    else if (h < 0.0) c.set('#256069')
    else if (h < 0.05) c.set('#77806f')
    else if (h < 0.24) c.set('#4b5847')
    else if (h < 0.44) c.set('#585e63')
    else c.set('#c9ced2')
    // 轻微色抖动,避免大色块死板
    const j = (noise(x * 3.1, z * 3.1) - 0.5) * 0.05
    colors[i * 3] = THREE.MathUtils.clamp(c.r + j, 0, 1)
    colors[i * 3 + 1] = THREE.MathUtils.clamp(c.g + j, 0, 1)
    colors[i * 3 + 2] = THREE.MathUtils.clamp(c.b + j, 0, 1)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
  )
  scene.add(mesh)
}

function makeSea(size, y, segs) {
  const geo = new THREE.PlaneGeometry(size, size, segs, segs)
  geo.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: '#0d2831',
      transparent: true,
      opacity: 0.85,
      roughness: 0.35,
      metalness: 0.15,
    }),
  )
  mesh.position.y = y
  mesh.userData.base = geo.attributes.position.array.slice()
  scene.add(mesh)
  return mesh
}

function animateSea(mesh, t, amp) {
  const pos = mesh.geometry.attributes.position
  const base = mesh.userData.base
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3]
    const z = base[i * 3 + 2]
    pos.setY(i, Math.sin(x * 0.28 + t * 0.9) * amp + Math.cos(z * 0.24 + t * 0.7) * amp)
  }
  pos.needsUpdate = true
}

function buildTrees() {
  const count = 480
  const geo = new THREE.ConeGeometry(0.4, 1.5, 6)
  const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 })
  const inst = new THREE.InstancedMesh(geo, mat, count)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const col = new THREE.Color()
  let placed = 0
  for (let tries = 0; tries < 4000 && placed < count; tries++) {
    const x = (noise(tries * 0.71, 3.3) - 0.5) * 32
    const z = (noise(9.1, tries * 0.53) - 0.5) * 32
    const h = heightAt(x, z)
    if (h < 0.05 || h > 0.3) continue
    if (fbm(vegNoise, x * 0.1, z * 0.1, 3) < 0.48) continue
    // 避开地表板块标记
    if (regions.some((r) => r.layer === 'surface' && (r.x - x) ** 2 + (r.z - z) ** 2 < 4)) continue
    const s = 0.7 + noise(x * 5, z * 5) * 0.9
    m.compose(
      new THREE.Vector3(x, h * H_SCALE + 0.6 * s, z),
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), noise(x, z) * Math.PI),
      new THREE.Vector3(s, s, s),
    )
    inst.setMatrixAt(placed, m)
    inst.setColorAt(placed, col.setHSL(0.32 + noise(x * 9, z * 9) * 0.06, 0.25, 0.3 + noise(x, z * 7) * 0.12))
    placed++
  }
  inst.count = placed
  scene.add(inst)
}

function buildCrystalCluster(cx, cz, color, n = 6, spread = 1.6) {
  const group = new THREE.Group()
  for (let i = 0; i < n; i++) {
    const s = 0.18 + noise(cx + i * 3.1, cz - i) * 0.4
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(s),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.1,
        flatShading: true,
      }),
    )
    const x = cx + (noise(i * 1.7, cx) - 0.5) * spread * 2
    const z = cz + (noise(cz, i * 2.3) - 0.5) * spread * 2
    gem.position.set(x, heightAt(x, z) * H_SCALE + s * 0.8, z)
    gem.rotation.set(noise(i, 1) * 0.6, noise(i, 2) * Math.PI, noise(i, 3) * 0.6)
    group.add(gem)
  }
  scene.add(group)
  return group
}

function buildParticles() {
  // 魔力光点:缓慢上升,夜里更亮
  const n = 320
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const a = noise(i * 1.31, 4.4) * Math.PI * 2
    const r = noise(6.6, i * 0.87) * 13
    arr[i * 3] = Math.cos(a) * r
    arr[i * 3 + 1] = 0.5 + noise(i, i) * 7
    arr[i * 3 + 2] = Math.sin(a) * r
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  particles = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: '#9ed9dd',
      size: 0.14,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  scene.add(particles)
}

function buildStars() {
  const n = 700
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(
      noise(i * 1.1, 0.7) * 2 - 1,
      noise(0.3, i * 1.7) * 2 - 1,
      noise(i * 2.3, i * 0.9) * 2 - 1,
    )
      .normalize()
      .multiplyScalar(60 + noise(i, 8) * 35)
    arr.set([v.x, v.y, v.z], i * 3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: '#dfe8f0',
      size: 0.35,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false, // 星空在雾距之外,不受雾影响
    }),
  )
  scene.add(stars)
}

function buildRimRain() {
  // 世界之界:大陆边缘一圈向下坠落的光雨
  const n = 420
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = 17.3 + noise(i * 0.9, 1.1) * 1.6
    arr[i * 3] = Math.cos(a) * r
    arr[i * 3 + 1] = -12 + noise(i, 5.5) * 20
    arr[i * 3 + 2] = Math.sin(a) * r
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  rimRain = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: '#e8e4d8',
      size: 0.13,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  scene.add(rimRain)
}

function buildIsland(x, z, y, tall = false) {
  const g = new THREE.Group()
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 1.5, 0.9, 7),
    new THREE.MeshStandardMaterial({ color: '#4b5847', flatShading: true, roughness: 1 }),
  )
  const bottom = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 2.6, 7),
    new THREE.MeshStandardMaterial({ color: '#585e63', flatShading: true, roughness: 1 }),
  )
  bottom.rotation.x = Math.PI
  bottom.position.y = -1.7
  g.add(top, bottom)
  if (tall) {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.5, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: '#3a3f45', flatShading: true, roughness: 0.9 }),
    )
    tower.position.y = 2
    const lamp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5),
      new THREE.MeshStandardMaterial({
        color: '#b8e6e9',
        emissive: '#b8e6e9',
        emissiveIntensity: 1.6,
        flatShading: true,
      }),
    )
    lamp.position.y = 3.9
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.3, 6, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#b8e6e9',
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    beam.position.y = 7
    g.add(tower, lamp, beam)
  }
  g.position.set(x, y, z)
  scene.add(g)
  islands.push({ node: g, baseY: y })
  return g
}

function buildBridge(a, b) {
  const from = new THREE.Vector3(a[0], a[2] - 0.1, a[1])
  const to = new THREE.Vector3(b[0], b[2] - 0.1, b[1])
  const len = from.distanceTo(to)
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.05, 0.18),
    new THREE.MeshStandardMaterial({
      color: '#9ed9dd',
      emissive: '#9ed9dd',
      emissiveIntensity: 1.1,
    }),
  )
  bridge.position.copy(from).add(to).multiplyScalar(0.5)
  bridge.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x)
  scene.add(bridge)
}

function buildUnderground() {
  // 洞顶背板(地下的天空)
  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshStandardMaterial({ color: '#0b0a12', roughness: 1 }),
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = UNDER_DOME_Y + 0.4
  scene.add(ceiling)

  // 倒悬钟乳石锥 + emissive 结晶(晶穹)
  const n = 110
  const inst = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.5, 2.6, 6),
    new THREE.MeshStandardMaterial({
      color: '#4a4280',
      emissive: '#9a8ae8',
      emissiveIntensity: 0.7,
      flatShading: true,
    }),
    n,
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
  const col = new THREE.Color()
  for (let i = 0; i < n; i++) {
    const a = noise(i * 1.3, 2.2) * Math.PI * 2
    const r = noise(7.7, i * 0.61) * 26
    const s = 0.5 + noise(i, i * 3) * 1.6
    m.compose(
      new THREE.Vector3(Math.cos(a) * r, UNDER_DOME_Y - s * 1.1, Math.sin(a) * r),
      q,
      new THREE.Vector3(s * 0.6, s, s * 0.6),
    )
    inst.setMatrixAt(i, m)
    inst.setColorAt(i, col.setHSL(0.72 + noise(i, 9) * 0.08, 0.4, 0.5 + noise(9, i) * 0.2))
  }
  scene.add(inst)

  // 晶穹点光(幽光感主光源之一)
  const domeLight = new THREE.PointLight('#8a7ae8', 60, 34, 2)
  domeLight.position.set(0, UNDER_DOME_Y - 3, 0)
  scene.add(domeLight)

  // 海岸幽光:暗海岸边一圈发光小晶
  const glow = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.16),
    new THREE.MeshStandardMaterial({
      color: '#3f9ec9',
      emissive: '#3f9ec9',
      emissiveIntensity: 1.4,
      flatShading: true,
    }),
    44,
  )
  const q2 = new THREE.Quaternion()
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2
    const r = 8 + noise(i * 0.7, 3.3) * 6
    m.compose(
      new THREE.Vector3(Math.cos(a) * r, UNDER_SEA_Y + 0.3, Math.sin(a) * r),
      q2.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a),
      new THREE.Vector3(1, 1.6, 1),
    )
    glow.setMatrixAt(i, m)
  }
  scene.add(glow)
}

function buildMarker(region, y) {
  const g = new THREE.Group()
  g.position.set(region.x, y, region.z)

  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5),
    new THREE.MeshStandardMaterial({
      color: region.color,
      emissive: region.color,
      emissiveIntensity: 0.8,
      flatShading: true,
    }),
  )
  gem.userData.region = region
  g.add(gem)

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6),
    new THREE.MeshBasicMaterial({ color: region.color, transparent: true, opacity: 0.55 }),
  )
  beam.position.y = -1.15
  g.add(beam)

  // 板块点光(随所在层 Group 显隐,控制灯光总数)
  const light = new THREE.PointLight(region.color, 10, 9, 2)
  g.add(light)

  markerGroups[region.layer].add(g)
  gemsByLayer[region.layer].push(gem)
  markerByRegion[region.id] = gem
  region._node = g
  region._gem = gem
  region._baseY = y
}

onMounted(() => {
  const el = host.value
  scene = new THREE.Scene()
  scene.background = new THREE.Color(DAY.bg)
  scene.fog = new THREE.Fog(DAY.bg.getHex(), 36, 95)

  camera = new THREE.PerspectiveCamera(46, el.clientWidth / el.clientHeight, 0.1, 250)
  camera.position.set(...LAYER_VIEW.surface.pos)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  // 光照:hemisphere + directional 主光
  hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiInt)
  scene.add(hemi)
  dirLight = new THREE.DirectionalLight(DAY.dirColor, DAY.dirInt)
  dirLight.position.set(14, 24, 10)
  scene.add(dirLight)

  // 三层 Group(板块浮标 + 点光按层显隐)
  for (const k of ['sky', 'surface', 'underground']) {
    markerGroups[k] = new THREE.Group()
    markerGroups[k].visible = k === 'surface'
    scene.add(markerGroups[k])
  }

  // ----- 地表层 -----
  buildTerrain()
  seaMesh = makeSea(120, -0.3, 48)
  buildTrees()
  buildParticles()
  buildStars()
  buildRimRain()
  buildCrystalCluster(-6, -5, '#d8c89a') // 星坠荒原水晶簇
  buildCrystalCluster(-7.5, -4, '#d8c89a', 5, 1.2)

  // ----- 天空层:悬浮岛 + 光桥 + 灯塔 -----
  const isles = [
    [-7, -3, SKY_Y],
    [-5, -1, SKY_Y + 1],
    [-3, -3, SKY_Y + 0.2],
  ]
  isles.forEach(([x, z, y]) => buildIsland(x, z, y))
  buildBridge(isles[0], isles[1])
  buildBridge(isles[1], isles[2])
  buildIsland(5, 3, SKY_Y + 1.5, true) // 天穹灯塔

  // ----- 地下层:倒悬晶穹 + 暗海 -----
  buildUnderground()
  underSeaMesh = makeSea(70, UNDER_SEA_Y, 40)
  underSeaMesh.material.emissive = new THREE.Color('#0e3a4d')
  underSeaMesh.material.emissiveIntensity = 0.5

  // ----- 板块标记 -----
  for (const r of regions) {
    let y
    if (r.layer === 'surface') y = Math.max(heightAt(r.x, r.z) * H_SCALE, 0) + 1.4
    else if (r.layer === 'sky') y = SKY_Y + 2.2
    else y = r.id === 'crystal-vault' ? UNDER_DOME_Y - 2.5 : UNDER_SEA_Y + 1.6
    buildMarker(r, y)
  }
  // 天空灯塔岛标记抬高到塔顶
  const beacon = regions.find((r) => r.id === 'celest-beacon')
  if (beacon?._node) {
    beacon._node.position.y = SKY_Y + 1.5 + 4.6
    beacon._baseY = SKY_Y + 1.5 + 4.6
  }

  // ---------- 交互 ----------
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.enablePan = false
  controls.minDistance = 4
  controls.maxDistance = 60
  controls.minPolarAngle = 0.35
  controls.maxPolarAngle = 1.5
  controls.target.set(...LAYER_VIEW.surface.tgt)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  let downX = 0
  let downY = 0

  addListener(controls, 'start', () => {
    userInteracting = true
    focused = false // 用户拖拽即解除聚焦
  })
  addListener(controls, 'end', () => {
    userInteracting = false
  })
  addListener(renderer.domElement, 'pointerdown', (e) => {
    downX = e.clientX
    downY = e.clientY
  })
  addListener(renderer.domElement, 'pointermove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(gemsByLayer[layer.value], false)[0]
    hovered = hit ? hit.object.userData.region : null
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
  })
  addListener(renderer.domElement, 'click', (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return // 拖拽不算点击
    if (hovered) focusRegion(hovered)
    else unfocus()
  })
  addListener(window, 'resize', () => {
    camera.aspect = el.clientWidth / el.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
  })

  // 昼夜同步:网站暗色主题 = 3D 黑夜,亮色主题 = 3D 白天
  dnTarget = theme.dark ? 0 : 1
  dn = dnTarget
  watch(
    () => theme.dark,
    (dark) => {
      dnTarget = dark ? 0 : 1
    },
  )

  clock = new THREE.Clock()
  const tmpColor = new THREE.Color()
  const animate = () => {
    rafId = requestAnimationFrame(animate)
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime
    const now = performance.now()

    // 相机:补间 > 用户交互 > 空闲缓慢自转
    if (tween) stepTween(now)
    else if (!reduced && orbiting && !userInteracting && !focused) {
      const angle = dt * 0.045 // 平时自转(很慢)
      const off = camera.position.clone().sub(controls.target)
      const s = new THREE.Spherical().setFromVector3(off)
      s.theta += angle
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s))
    }

    // 昼夜 1s 左右 lerp,不硬切
    dn += (dnTarget - dn) * Math.min(1, dt * 1.6)
    scene.background.copy(tmpColor.lerpColors(NIGHT.bg, DAY.bg, dn))
    scene.fog.color.copy(scene.background)
    hemi.color.lerpColors(NIGHT.hemiSky, DAY.hemiSky, dn)
    hemi.groundColor.lerpColors(NIGHT.hemiGround, DAY.hemiGround, dn)
    hemi.intensity = THREE.MathUtils.lerp(NIGHT.hemiInt, DAY.hemiInt, dn)
    dirLight.color.lerpColors(NIGHT.dirColor, DAY.dirColor, dn)
    dirLight.intensity = THREE.MathUtils.lerp(NIGHT.dirInt, DAY.dirInt, dn)
    seaMesh.material.color.lerpColors(NIGHT.seaColor, DAY.seaColor, dn)
    seaMesh.material.opacity = THREE.MathUtils.lerp(NIGHT.seaOpacity, DAY.seaOpacity, dn)
    stars.material.opacity = THREE.MathUtils.lerp(NIGHT.starOp, DAY.starOp, dn)
    particles.material.opacity = THREE.MathUtils.lerp(NIGHT.particleOp, DAY.particleOp, dn)
    const emK = THREE.MathUtils.lerp(NIGHT.emissiveK, DAY.emissiveK, dn)

    // 元素动画
    if (!reduced) {
      animateSea(seaMesh, t, 0.16)
      animateSea(underSeaMesh, t * 0.7, 0.22)
      for (const r of regions) {
        if (!r._node) continue
        r._node.position.y = r._baseY + Math.sin(t * 1.2 + r.x) * 0.18
        r._gem.rotation.y = t * 0.5
      }
      for (let i = 0; i < islands.length; i++) {
        islands[i].node.position.y = islands[i].baseY + Math.sin(t * 0.5 + i * 1.3) * 0.35
        islands[i].node.rotation.y += dt * 0.04
      }
      const pp = particles.geometry.attributes.position
      for (let i = 0; i < pp.count; i++) {
        let y = pp.getY(i) + dt * 0.35
        if (y > 8) y = 0.4
        pp.setY(i, y)
      }
      pp.needsUpdate = true
      const rp = rimRain.geometry.attributes.position
      for (let i = 0; i < rp.count; i++) {
        let y = rp.getY(i) - dt * (1.2 + (i % 5) * 0.3)
        if (y < -14) y = 8
        rp.setY(i, y)
      }
      rp.needsUpdate = true
    }

    // 浮标呼吸发光 + 悬停放大
    for (const k of Object.keys(gemsByLayer)) {
      for (const gem of gemsByLayer[k]) {
        const r = gem.userData.region
        gem.material.emissiveIntensity =
          (0.65 + (reduced ? 0 : 0.35 * Math.sin(t * 2 + r.x))) * emK
        const target = hovered && hovered.id === r.id ? 1.35 : 1
        gem.scale.setScalar(gem.scale.x + (target - gem.scale.x) * 0.15)
      }
    }

    controls.update()
    renderer.render(scene, camera)
  }
  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  for (const [target, type, fn] of listeners) target.removeEventListener(type, fn)
  listeners = []
  controls?.dispose()
  scene?.traverse((obj) => {
    obj.geometry?.dispose?.()
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((mm) => mm.dispose?.())
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
        @click="switchLayer(l.key)"
      >
        <span class="en">{{ l.en }}</span>
        <span class="zh">{{ l.zh }}</span>
      </button>
    </div>

    <!-- 板块介绍面板:右侧滑出,左边缘渐变衔接场景 -->
    <transition name="panel">
      <div v-if="selected" class="panel-wrap" @click.self="unfocus">
        <div class="fade-strip"></div>
        <aside class="panel">
          <button class="close" aria-label="关闭" @click="unfocus">✕</button>
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

  .panel-enter-from, .panel-leave-to { transform: translateY(60px); }
}
</style>
