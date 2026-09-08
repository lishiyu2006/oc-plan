import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

import { DAY, LAYER_VIEW, NIGHT, SAFE_RELAY } from './config.js'

/* ================================================================
 * World —— AETHERION 大陆引擎组装者(glTF 场景级,ADR-0001)。
 * 宿主(Vue 视图)只 import 本类:传入容器、板块数据与模型 URL。
 *
 * 模型契约(与建模侧/占位模型一致):
 *  - 每渲染场景一个 glTF:models.top(天空+地表)、models.under(地下)
 *  - 每个板块在模型里有一个「名字 = region.id」的 Group(锚点),
 *    其下的任意 mesh 都可点击;前端按名字寻址并挂交互/动画。
 * ================================================================ */

class World {
  /**
   * @param {HTMLElement} container 挂载 canvas 的容器
   * @param {object} opts
   * @param {Array} opts.regions world.json.regions(含 image URL)
   * @param {object} opts.models   { top: string, under: string } 模型 URL(空串 = 无模型)
   * @param {HTMLElement} opts.wipeEl 切层笔画擦除元素
   * @param {HTMLElement} opts.wipeBd 切层背板元素
   * @param {boolean} opts.reduced prefers-reduced-motion
   * @param {boolean} opts.dark   初始暗色主题(3D 黑夜)
   * @param {(key: string) => void} [opts.onLayer]
   * @param {(region: object|null) => void} [opts.onSelect]
   * @param {(phase: string, ok: boolean) => void} [opts.onStatus] 加载状态回调
   */
  constructor(container, opts = {}) {
    const { regions, models, wipeEl, wipeBd, reduced, dark, onLayer, onSelect, onStatus } = opts
    this.container = container
    this.regions = regions
    this.models = models || { top: '', under: '' }
    this.wipeEl = wipeEl
    this.wipeBd = wipeBd
    this.reduced = !!reduced
    this.onLayer = onLayer
    this.onSelect = onSelect
    this.onStatus = onStatus

    this.renderer = null
    this.sceneTop = null
    this.sceneUnder = null
    this.camera = null
    this.controls = null
    this.clock = null
    this.rafId = 0
    this.hemi = null
    this.dirLight = null

    // 锚点寻址结果:region.id -> { group, meshes, baseY }
    this.landmarkByRegion = {}
    // 拾取目标(按层聚合,供 raycaster)
    this.pickByLayer = { sky: [], surface: [], underground: [] }

    this.raycaster = null
    this.pointer = null
    this.hovered = null
    this.tween = null
    this.focused = false
    this.orbiting = true
    this.userInteracting = false
    this.dn = 1
    this.dnTarget = 1
    this.layer = 'surface'
    this.hasSelection = false
    this.listeners = []
    this.wiping = false

    this.underLoaded = false // under 是否已加载
    this.ready = false // top 加载完成、可交互

    this.#setupGL()
    this.#wireInteraction()
    this.#syncDayNight(dark ? 0 : 1, true)
    this.#loadTop()
    this.#startClock()
  }

  /* ---------- 基础 GL 初始化(renderer/scenes/camera/灯光) ---------- */
  #setupGL() {
    const el = this.container
    // 地-天 / 地下两个独立 scene:每帧只渲染当前层
    this.sceneTop = new THREE.Scene()
    this.sceneTop.background = new THREE.Color(DAY.bg)
    this.sceneTop.fog = new THREE.Fog(DAY.bg.getHex(), 36, 95)
    this.sceneUnder = new THREE.Scene()
    this.sceneUnder.background = new THREE.Color('#07080d')
    this.sceneUnder.fog = new THREE.Fog('#07080d', 30, 90)

    this.camera = new THREE.PerspectiveCamera(46, el.clientWidth / el.clientHeight, 0.1, 250)
    this.camera.position.set(...LAYER_VIEW.surface.pos)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(this.renderer.domElement)

    // 地-天 scene 光照:hemisphere + directional 主光(随昼夜 lerp)
    this.hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiInt)
    this.sceneTop.add(this.hemi)
    this.dirLight = new THREE.DirectionalLight(DAY.dirColor, DAY.dirInt)
    this.dirLight.position.set(14, 24, 10)
    this.sceneTop.add(this.dirLight)
    // 地下 scene 独立恒定光照(不受网站主题昼夜影响)
    const underHemi = new THREE.HemisphereLight('#232230', '#0c0a12', 0.3)
    this.sceneUnder.add(underHemi)
    const underDir = new THREE.DirectionalLight('#9a8ae8', 0.35)
    underDir.position.set(10, 6, 14)
    this.sceneUnder.add(underDir)
  }

  /* ---------- 模型加载 ---------- */
  #makeLoader() {
    const loader = new GLTFLoader()
    const draco = new DRACOLoader()
    // decoder 使用 DRACOLoader 默认路径(three 包内 libs/draco,经 vite import.meta.url 解析)
    loader.setDRACOLoader(draco)
    return loader
  }

  #loadTop() {
    const url = this.models.top
    if (!url) {
      // 无模型(未上传):仍进 ready,视图提示
      this.ready = true
      return
    }
    this.#makeLoader().load(
      url,
      (gltf) => {
        this.sceneTop.add(gltf.scene)
        this.#parseAnchors(gltf.scene)
        this.ready = true
        this.onStatus?.('top', true)
      },
      undefined,
      (err) => {
        console.error('[World] top 模型加载失败:', url, err)
        this.ready = true // 失败也放行,视图显示错误态
        this.onStatus?.('top', false)
      },
    )
  }

  /** 懒加载地下模型:首次切到地下前调用。 */
  #loadUnder() {
    if (this.underLoaded) return
    this.underLoaded = true
    const url = this.models.under
    if (!url) return
    this.#makeLoader().load(
      url,
      (gltf) => {
        this.sceneUnder.add(gltf.scene)
        this.#parseAnchors(gltf.scene)
        this.onStatus?.('under', true)
      },
      undefined,
      (err) => {
        console.error('[World] under 模型加载失败:', url, err)
        this.onStatus?.('under', false)
      },
    )
  }

  /** 遍历场景,把「名字 = region.id」的节点登记为锚点。 */
  #parseAnchors(root) {
    const nameToRegion = {}
    for (const r of this.regions) nameToRegion[r.id] = r

    root.traverse((obj) => {
      const region = nameToRegion[obj.name]
      if (!region) return
      // 锚点可以是任意类型节点(glTF 纯变换节点是 Object3D,不带 mesh 的组同理);
      // 若该节点本身是 mesh 也算,但更常见的是锚点下挂 landmark mesh
      const meshes = []
      obj.traverse((child) => {
        if (child.isMesh) meshes.push(child)
      })
      if (!meshes.length) return // 空锚点(无任何可视实体)不登记
      const entry = { group: obj, meshes, baseY: obj.position.y }
      this.landmarkByRegion[region.id] = entry
      this.pickByLayer[region.layer].push(...meshes)
      for (const m of meshes) m.userData.region = region
      entry.materials = []
      for (const m of meshes) {
        if (!m.material) continue
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mat of mats) entry.materials.push(mat)
      }
    })
    // 锚点动画基准:记录各 landmark 初始世界高度(呼吸浮动用)
    for (const r of this.regions) {
      const e = this.landmarkByRegion[r.id]
      if (e) e.baseY = e.group.position.y
    }
  }

  /* ---------- 交互 ---------- */
  #wireInteraction() {
    const el = this.container
    const renderer = this.renderer
    const camera = this.camera

    this.controls = new OrbitControls(camera, renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.enablePan = false
    this.controls.minDistance = 4
    this.controls.maxDistance = 60
    this.controls.minPolarAngle = 0.35
    this.controls.maxPolarAngle = 1.5
    this.controls.target.set(...LAYER_VIEW.surface.tgt)

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    let downX = 0
    let downY = 0

    this.#addListener(this.controls, 'start', () => {
      this.userInteracting = true
      this.focused = false
    })
    this.#addListener(this.controls, 'end', () => {
      this.userInteracting = false
    })
    this.#addListener(renderer.domElement, 'pointerdown', (e) => {
      downX = e.clientX
      downY = e.clientY
    })
    this.#addListener(renderer.domElement, 'pointermove', (e) => {
      if (!this.ready) return
      const rect = renderer.domElement.getBoundingClientRect()
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      this.raycaster.setFromCamera(this.pointer, camera)
      const targets = this.pickByLayer[this.layer]
      const hit = targets.length
        ? this.raycaster.intersectObjects(targets, false)[0]
        : undefined
      this.#setHovered(hit ? hit.object.userData.region : null)
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
    })
    this.#addListener(renderer.domElement, 'click', (e) => {
      if (!this.ready) return
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return // 拖拽不算点击
      if (this.hovered) this.focusRegion(this.hovered)
      else this.exitFocus()
    })
    this.#addListener(window, 'resize', () => {
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    })
  }

  #setHovered(region) {
    // 高亮离开旧锚点、进入新锚点
    if (this.hovered === region) return
    const oldEntry = this.hovered ? this.landmarkByRegion[this.hovered.id] : null
    const newEntry = region ? this.landmarkByRegion[region.id] : null
    if (oldEntry) this.#applyHover(oldEntry, false)
    this.hovered = region
    if (newEntry) this.#applyHover(newEntry, true)
  }

  #applyHover(entry, on) {
    for (const mat of entry.materials) {
      if (mat.emissive) mat.emissiveIntensity = on ? Math.max(mat.emissiveIntensity, 1.6) : 0.6
    }
  }

  /* ---------- 对外接口 ---------- */
  setDayNight(dark) {
    this.dnTarget = dark ? 0 : 1
  }

  setLayer(key) {
    this.#switchLayer(key)
  }

  exitFocus() {
    if (!this.focused && !this.hasSelection) return
    this.focused = false
    this.hasSelection = false
    this.onSelect?.(null)
    const v = LAYER_VIEW[this.layer]
    this.#flyTo(v.pos, v.tgt, 0.85)
  }

  focusRegion(region) {
    const entry = this.landmarkByRegion[region.id]
    if (!entry) return
    const mPos = new THREE.Vector3()
    entry.group.getWorldPosition(mPos)
    const dir = this.camera.position.clone().sub(mPos)
    if (dir.length() < 0.001) dir.set(1, 0.5, 1)
    dir.normalize()
    if (dir.y < 0.3) {
      dir.y = 0.35
      dir.normalize()
    }
    const dest = mPos.clone().add(dir.multiplyScalar(6.5))
    this.focused = true
    this.#flyTo(dest.toArray(), mPos.toArray(), 0.8, () => {
      this.hasSelection = true
      this.onSelect?.(region)
    })
  }

  dispose() {
    cancelAnimationFrame(this.rafId)
    for (const [target, type, fn] of this.listeners) target.removeEventListener(type, fn)
    this.listeners = []
    this.controls?.dispose()
    for (const s of [this.sceneTop, this.sceneUnder]) {
      s?.traverse((obj) => {
        obj.geometry?.dispose?.()
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          mats.forEach((mm) => mm.dispose?.())
        }
      })
    }
    this.renderer?.dispose()
    this.renderer?.domElement?.parentElement?.removeChild(this.renderer.domElement)
  }

  /* ---------- 内部:监听管理 ---------- */
  #addListener(target, type, fn, opts) {
    target.addEventListener(type, fn, opts)
    this.listeners.push([target, type, fn])
  }

  /* ---------- 相机动画:球面弧线插值,easeOutCubic ---------- */
  #flyTo(toPosArr, toTgtArr, dur, done) {
    const toPos = new THREE.Vector3(...toPosArr)
    const toTgt = new THREE.Vector3(...toTgtArr)
    if (this.reduced) {
      this.camera.position.copy(toPos)
      this.controls.target.copy(toTgt)
      this.controls.enabled = true
      done?.()
      return
    }
    const center = toTgt.clone()
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(center))
    const to = new THREE.Spherical().setFromVector3(toPos.clone().sub(center))
    let dTheta = to.theta - from.theta
    while (dTheta > Math.PI) dTheta -= Math.PI * 2
    while (dTheta < -Math.PI) dTheta += Math.PI * 2
    this.tween = {
      t0: performance.now(),
      dur: dur * 1000,
      center,
      from,
      to,
      dTheta,
      fromTgt: this.controls.target.clone(),
      toTgt,
      done,
    }
    this.controls.enabled = false
  }

  #stepTween(now) {
    const k = Math.min(1, (now - this.tween.t0) / this.tween.dur)
    const e = 1 - Math.pow(1 - k, 3)
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(this.tween.from.radius, this.tween.to.radius, e),
      THREE.MathUtils.lerp(this.tween.from.phi, this.tween.to.phi, e),
      this.tween.from.theta + this.tween.dTheta * e,
    )
    this.camera.position.copy(this.tween.center).add(new THREE.Vector3().setFromSpherical(s))
    this.controls.target.lerpVectors(this.tween.fromTgt, this.tween.toTgt, e)
    if (k >= 1) {
      const done = this.tween.done
      this.tween = null
      this.controls.enabled = true
      done?.()
    }
  }

  /* ---------- 层切换 + 笔画擦除过渡(与程序化版行为一致) ---------- */
  #switchLayer(key) {
    if (key === this.layer || this.wiping) return
    const involvesUnder = this.layer === 'underground' || key === 'underground'
    if (this.reduced || !involvesUnder) {
      this.tween = null
      this.layer = key
      this.hasSelection = false
      this.focused = false
      this.onSelect?.(null)
      this.onLayer?.(key)
      const v = LAYER_VIEW[key]
      this.camera.position.set(...v.pos)
      this.controls.target.set(...v.tgt)
      this.controls.enabled = true
      // 进地下前懒加载
      if (key === 'underground') this.#loadUnder()
      return
    }
    this.wiping = true
    const el = this.wipeEl
    const bd = this.wipeBd
    const W = window.innerWidth
    const T_IN = 550
    const T_HOLD = 300
    const T_OUT = 550
    const TOTAL = T_IN + T_HOLD + T_OUT
    const t0 = performance.now()
    let switched = false
    const paint = (x, u, bdOp) => {
      const v = 0.5 / Math.sqrt(2 * Math.max(u, 0.04))
      const speedRatio = Math.min(1, (v - 0.5) / 1.27)
      const w = (0.55 - 0.4 * speedRatio) * W
      el.style.width = w + 'px'
      el.style.transform = `translateX(${x * (W + w) - w}px) skewX(-3deg)`
      bd.style.opacity = String(bdOp)
    }
    const step = (now) => {
      const e = now - t0
      if (e < T_IN) {
        const s = e / T_IN
        paint(0.5 * Math.sqrt(2 * s), Math.min(s, 1 - s), 0.92 * s)
      } else if (e < T_IN + T_HOLD) {
        if (!switched) {
          switched = true
          this.layer = key
          this.hasSelection = false
          this.focused = false
          this.onSelect?.(null)
          this.onLayer?.(key)
          this.tween = null
          if (key === 'underground') this.#loadUnder()
          this.camera.position.set(...SAFE_RELAY.pos)
          this.controls.target.set(...SAFE_RELAY.tgt)
          this.renderer.render(key === 'underground' ? this.sceneUnder : this.sceneTop, this.camera)
          const v = LAYER_VIEW[key]
          this.#flyTo(v.pos, v.tgt, 1.0)
        }
        paint(0.5, 0.5, 0.92)
      } else if (e < TOTAL) {
        const s = (e - T_IN - T_HOLD) / T_OUT
        const t = 0.5 + 0.5 * s
        paint(1 - 0.5 * Math.sqrt(2 * (1 - t)), Math.min(t, 1 - t), 0.92 * (1 - s))
      } else {
        el.style.transform = 'translateX(-110vw) skewX(-3deg)'
        el.style.width = '55vw'
        bd.style.opacity = '0'
        this.wiping = false
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  /* ---------- 昼夜同步 ---------- */
  #syncDayNight(v, instant) {
    this.dnTarget = v
    if (instant) this.dn = v
  }

  /* ---------- 渲染循环 ---------- */
  #startClock() {
    this.clock = new THREE.Clock()
    const tmpColor = new THREE.Color()
    const animate = () => {
      this.rafId = requestAnimationFrame(animate)
      const dt = Math.min(this.clock.getDelta(), 0.05)
      const now = performance.now()

      if (this.tween) this.#stepTween(now)
      else if (!this.reduced && this.orbiting && !this.userInteracting && !this.focused) {
        const angle = dt * 0.045
        const off = this.camera.position.clone().sub(this.controls.target)
        const s = new THREE.Spherical().setFromVector3(off)
        s.theta += angle
        this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s))
      }

      // 昼夜 lerp(只作用于地-天 scene;地下恒定)
      this.dn += (this.dnTarget - this.dn) * Math.min(1, dt * 1.6)
      this.sceneTop.background.copy(tmpColor.lerpColors(NIGHT.bg, DAY.bg, this.dn))
      this.sceneTop.fog.color.copy(this.sceneTop.background)
      this.hemi.color.lerpColors(NIGHT.hemiSky, DAY.hemiSky, this.dn)
      this.hemi.groundColor.lerpColors(NIGHT.hemiGround, DAY.hemiGround, this.dn)
      this.hemi.intensity = THREE.MathUtils.lerp(NIGHT.hemiInt, DAY.hemiInt, this.dn)
      this.dirLight.color.lerpColors(NIGHT.dirColor, DAY.dirColor, this.dn)
      this.dirLight.intensity = THREE.MathUtils.lerp(NIGHT.dirInt, DAY.dirInt, this.dn)

      // 锚点呼吸浮动(landmark 组轻微上下)
      const t = this.clock.elapsedTime
      if (!this.reduced) {
        for (let ri = 0; ri < this.regions.length; ri++) {
          const r = this.regions[ri]
          const entry = this.landmarkByRegion[r.id]
          if (!entry) continue
          entry.group.position.y = entry.baseY + Math.sin(t * 1.2 + ri * 1.7) * 0.18
        }
      }

      this.controls.update()
      this.renderer.render(this.layer === 'underground' ? this.sceneUnder : this.sceneTop, this.camera)
    }
    animate()
  }
}

export { World }
