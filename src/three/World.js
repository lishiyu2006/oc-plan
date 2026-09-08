import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { DAY, LAYER_VIEW, NIGHT, SAFE_RELAY, SKY_Y } from './config.js'
import { makeSea, animateSea } from './components/sea.js'
import { buildRegionMarkers, createMarkerGroups } from './components/markers.js'
import {
  buildBridge,
  buildCrystalCluster,
  buildIsland,
  buildIslet,
  buildKingsgate,
  buildParticles,
  buildRimRain,
  buildStars,
  buildSunderwall,
  buildTerrain,
  buildTrees,
} from './components/surface.js'
import { buildUnderground } from './components/underground.js'

/* ================================================================
 * World —— AETHERION 大陆引擎组装者。
 * 宿主(Vue 视图)只 import 本类:传入容器与资源,其余全自理。
 * 外部状态变化经回调外发:onLayer(当前层)、onSelect(选中的板块或 null)。
 * ================================================================ */

class World {
  /**
   * @param {HTMLElement} container 挂载 canvas 的容器
   * @param {object} opts
   * @param {Array} opts.regions world.json 板块数据(已含 image URL)
   * @param {HTMLElement} opts.wipeEl   切层笔画擦除元素
   * @param {HTMLElement} opts.wipeBd   切层背板元素
   * @param {boolean} opts.reduced      prefers-reduced-motion
   * @param {boolean} opts.dark         初始是否为暗色主题(3D 黑夜)
   * @param {(key: string) => void} [opts.onLayer] 当前层变化回调
   * @param {(region: object|null) => void} [opts.onSelect] 选中板块变化回调
   */
  constructor(container, opts = {}) {
    const { regions, wipeEl, wipeBd, reduced, dark, onLayer, onSelect } = opts
    this.container = container
    this.regions = regions
    this.wipeEl = wipeEl
    this.wipeBd = wipeBd
    this.reduced = !!reduced
    this.onLayer = onLayer
    this.onSelect = onSelect

    // ---- 运行期状态(替代原模块级 let)----
    this.renderer = null
    this.sceneTop = null
    this.sceneUnder = null
    this.camera = null
    this.controls = null
    this.clock = null
    this.rafId = 0
    this.hemi = null
    this.dirLight = null
    this.seaMesh = null
    this.underSeaMesh = null
    this.stars = null
    this.particles = null
    this.rimRain = null
    this.gatePortal = null // 王门门内发光圆环
    this.gateSky = null // 王门高空悬浮巨环(含浮动)
    this.wallClouds = [] // 断境长城崖外云海
    this.islands = []
    this.markerGroups = null
    this.gemsByLayer = { sky: [], surface: [], underground: [] }
    this.markerByRegion = {}
    this.raycaster = null
    this.pointer = null
    this.hovered = null
    this.tween = null
    this.focused = false
    this.orbiting = true
    this.userInteracting = false
    this.dn = 1 // day-night 插值:1 = 白天,0 = 黑夜
    this.dnTarget = 1
    this.layer = 'surface'
    this.hasSelection = false // 是否正展示板块面板
    this.listeners = []
    this.wiping = false

    this.#build()
    this.#wireInteraction()
    this.#syncDayNight(dark ? 0 : 1, true)
    this.#startLoop()
  }

  /* ---------- 内部工具 ---------- */
  #addListener(target, type, fn, opts) {
    target.addEventListener(type, fn, opts)
    this.listeners.push([target, type, fn])
  }

  /* ---------- 场景搭建(对应原 onMounted 主体) ---------- */
  #build() {
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

    // 层标记组(先入场景,marker 后填)
    this.markerGroups = createMarkerGroups(this.sceneTop, this.sceneUnder)

    // ----- 地表层(sceneTop) -----
    const top = this.sceneTop
    buildTerrain(top)
    this.seaMesh = makeSea(top, 170, -0.3, 56) // 加大海面,覆盖环海与外缘虚空
    buildTrees(top, this.regions)
    this.particles = buildParticles(top)
    this.stars = buildStars(top)
    this.rimRain = buildRimRain(top)
    buildCrystalCluster(top, -6, -5, '#d8c89a') // 星坠荒原水晶簇
    buildCrystalCluster(top, -7.5, -4, '#d8c89a', 5, 1.2)
    buildCrystalCluster(top, 3, -8, '#a8d8e8', 5, 1.5) // 冰原冰晶簇
    buildCrystalCluster(top, 0.5, -6.8, '#bfe6f2', 4, 1.2)
    buildIslet(top) // 古境王门离岛
    const { portal, skyRing } = buildKingsgate(top)
    this.gatePortal = portal
    this.gateSky = skyRing
    this.wallClouds = buildSunderwall(top, this.regions) // 断境长城

    // ----- 天空层(sceneTop):悬浮岛 + 光桥 + 灯塔 -----
    const isles = [
      [-7, -3, SKY_Y],
      [-5, -1, SKY_Y + 1],
      [-3, -3, SKY_Y + 0.2],
    ]
    isles.forEach(([x, z, y]) => this.islands.push(buildIsland(top, x, z, y)))
    buildBridge(top, isles[0], isles[1])
    buildBridge(top, isles[1], isles[2])
    this.islands.push(buildIsland(top, 5, 3, SKY_Y + 1.5, true)) // 天穹灯塔

    // ----- 地下层(sceneUnder):倒悬晶穹 + 暗海 -----
    const under = this.sceneUnder
    buildUnderground(under)
    this.underSeaMesh = makeSea(under, 70, -20, 40)
    this.underSeaMesh.material.emissive = new THREE.Color('#0e3a4d')
    this.underSeaMesh.material.emissiveIntensity = 0.5

    // ----- 板块标记 -----
    const { gemsByLayer, markerByRegion } = buildRegionMarkers(this.markerGroups, this.regions)
    this.gemsByLayer = gemsByLayer
    this.markerByRegion = markerByRegion
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
      this.focused = false // 用户拖拽即解除聚焦
    })
    this.#addListener(this.controls, 'end', () => {
      this.userInteracting = false
    })
    this.#addListener(renderer.domElement, 'pointerdown', (e) => {
      downX = e.clientX
      downY = e.clientY
    })
    this.#addListener(renderer.domElement, 'pointermove', (e) => {
      const rect = renderer.domElement.getBoundingClientRect()
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      this.raycaster.setFromCamera(this.pointer, camera)
      const hit = this.raycaster.intersectObjects(this.gemsByLayer[this.layer], false)[0]
      this.hovered = hit ? hit.object.userData.region : null
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
    })
    this.#addListener(renderer.domElement, 'click', (e) => {
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

  /* ---------- 对外接口 ---------- */

  /** 网站主题 → 昼夜目标(dark=true 即 3D 黑夜)。 */
  setDayNight(dark) {
    this.dnTarget = dark ? 0 : 1
  }

  /** 切层入口(视图层按钮调用)。 */
  setLayer(key) {
    this.#switchLayer(key)
  }

  /** 退出聚焦/关闭面板(点空白或面板关闭按钮)。 */
  exitFocus() {
    if (!this.focused && !this.hasSelection) return
    this.focused = false
    this.hasSelection = false
    this.onSelect?.(null)
    const v = LAYER_VIEW[this.layer]
    this.#flyTo(v.pos, v.tgt, 0.85)
  }

  /** 拾取聚焦:拉近到板块并回调选中。 */
  focusRegion(region) {
    const node = this.markerByRegion[region.id]
    if (!node) return
    const mPos = new THREE.Vector3()
    node.getWorldPosition(mPos)
    // 相机沿球面弧线拉近到板块附近(比平时自转快得多的旋转)
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
      this.onSelect?.(region) // 拉近到位后再滑出介绍面板
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
    const e = 1 - Math.pow(1 - k, 3) // easeOutCubic
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

  /* ---------- 交互:层切换 + 笔画擦除过渡 ---------- */
  #switchLayer(key) {
    if (key === this.layer || this.wiping) return
    const involvesUnder = this.layer === 'underground' || key === 'underground'
    // 天空↔地表(以及 prefers-reduced-motion):直接切换,无擦除、无相机飞行
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
      return
    }
    // 地上↔地下:笔画擦除动画。扫入 550ms + 全遮停顿 300ms + 扫出 550ms ≈ 1.4s
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
    // x:笔块右缘全局进度(0→1);u:到最近端点距离(决定速度→宽度);bdOp:背板不透明度
    const paint = (x, u, bdOp) => {
      // 速度 v = 0.5/√(2u):两端最快(笔块窄 0.15W),t=0.5 最慢(笔块宽 0.55W)
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
        const s = e / T_IN // 全局进度 0 → 0.5:x = 0.5√(2s)
        paint(0.5 * Math.sqrt(2 * s), Math.min(s, 1 - s), 0.92 * s)
      } else if (e < T_IN + T_HOLD) {
        // 全遮停顿 300ms:笔块停在中点(最宽),背板保持全遮
        if (!switched) {
          switched = true
          this.layer = key
          this.hasSelection = false
          this.focused = false
          this.onSelect?.(null)
          this.onLayer?.(key)
          this.tween = null
          // 相机先瞬移到高空中继点(避免旧层视角看到新场景"外部"),
          // 并在遮盖下同步预热渲染目标场景至少一帧(shader 编译/纹理上传在此完成),
          // 揭开时画面一定完整,不穿模、不黑闪
          this.camera.position.set(...SAFE_RELAY.pos)
          this.controls.target.set(...SAFE_RELAY.tgt)
          this.renderer.render(key === 'underground' ? this.sceneUnder : this.sceneTop, this.camera)
          const v = LAYER_VIEW[key]
          this.#flyTo(v.pos, v.tgt, 1.0) // 从中继点下降进入目标层(遮盖下已开始)
        }
        paint(0.5, 0.5, 0.92)
      } else if (e < TOTAL) {
        const s = (e - T_IN - T_HOLD) / T_OUT // 全局进度 0.5 → 1
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
  #startLoop() {
    this.clock = new THREE.Clock()
    const tmpColor = new THREE.Color()
    const animate = () => {
      this.rafId = requestAnimationFrame(animate)
      const dt = Math.min(this.clock.getDelta(), 0.05)
      const t = this.clock.elapsedTime
      const now = performance.now()

      // 相机:补间 > 用户交互 > 空闲缓慢自转
      if (this.tween) this.#stepTween(now)
      else if (!this.reduced && this.orbiting && !this.userInteracting && !this.focused) {
        const angle = dt * 0.045 // 平时自转(很慢)
        const off = this.camera.position.clone().sub(this.controls.target)
        const s = new THREE.Spherical().setFromVector3(off)
        s.theta += angle
        this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s))
      }

      // 昼夜 1s 左右 lerp,不硬切(只作用于地-天 scene;地下 scene 背景/光照恒定)
      this.dn += (this.dnTarget - this.dn) * Math.min(1, dt * 1.6)
      this.sceneTop.background.copy(tmpColor.lerpColors(NIGHT.bg, DAY.bg, this.dn))
      this.sceneTop.fog.color.copy(this.sceneTop.background)
      this.hemi.color.lerpColors(NIGHT.hemiSky, DAY.hemiSky, this.dn)
      this.hemi.groundColor.lerpColors(NIGHT.hemiGround, DAY.hemiGround, this.dn)
      this.hemi.intensity = THREE.MathUtils.lerp(NIGHT.hemiInt, DAY.hemiInt, this.dn)
      this.dirLight.color.lerpColors(NIGHT.dirColor, DAY.dirColor, this.dn)
      this.dirLight.intensity = THREE.MathUtils.lerp(NIGHT.dirInt, DAY.dirInt, this.dn)
      this.seaMesh.material.color.lerpColors(NIGHT.seaColor, DAY.seaColor, this.dn)
      this.seaMesh.material.opacity = THREE.MathUtils.lerp(NIGHT.seaOpacity, DAY.seaOpacity, this.dn)
      this.stars.material.opacity = THREE.MathUtils.lerp(NIGHT.starOp, DAY.starOp, this.dn)
      this.particles.material.opacity = THREE.MathUtils.lerp(NIGHT.particleOp, DAY.particleOp, this.dn)
      const emK = THREE.MathUtils.lerp(NIGHT.emissiveK, DAY.emissiveK, this.dn)

      const inUnder = this.layer === 'underground'

      // 元素动画(只更新当前层所属的 scene)
      if (!this.reduced) {
        if (inUnder) {
          animateSea(this.underSeaMesh, t * 0.7, 0.22)
        } else {
          animateSea(this.seaMesh, t, 0.16)
          for (let i = 0; i < this.islands.length; i++) {
            this.islands[i].node.position.y = this.islands[i].baseY + Math.sin(t * 0.5 + i * 1.3) * 0.35
            this.islands[i].node.rotation.y += dt * 0.04
          }
          const pp = this.particles.geometry.attributes.position
          for (let i = 0; i < pp.count; i++) {
            let y = pp.getY(i) + dt * 0.35
            if (y > 8) y = 0.4
            pp.setY(i, y)
          }
          pp.needsUpdate = true
          const rp = this.rimRain.geometry.attributes.position
          for (let i = 0; i < rp.count; i++) {
            let y = rp.getY(i) - dt * (1.2 + (i % 5) * 0.3)
            if (y < -14) y = 8
            rp.setY(i, y)
          }
          rp.needsUpdate = true
          // 古境王门:门内圆环缓转 + 高空巨环自转/浮动
          if (this.gatePortal) {
            this.gatePortal.rotation.z = t * 0.25
            this.gatePortal.material.emissiveIntensity = 1.3 + Math.sin(t * 1.1) * 0.35
          }
          if (this.gateSky) {
            this.gateSky.rotation.y = t * 0.12
            this.gateSky.position.y = 10.5 + Math.sin(t * 0.45) * 0.5
          }
          // 断境长城:崖外云海缓慢漂移
          for (const cl of this.wallClouds) {
            cl.position.x = cl.userData.baseX + Math.sin(t * 0.15 + cl.userData.phase) * 0.6
          }
        }
        for (const r of this.regions) {
          if (!r._node) continue
          r._node.position.y = r._baseY + Math.sin(t * 1.2 + r.x) * 0.18
          r._gem.rotation.y = t * 0.5
        }
      }

      // 浮标呼吸发光 + 悬停放大(地下层发光恒定,不随昼夜)
      for (const k of Object.keys(this.gemsByLayer)) {
        const kEm = k === 'underground' ? 1.0 : emK
        for (const gem of this.gemsByLayer[k]) {
          const r = gem.userData.region
          gem.material.emissiveIntensity =
            (0.65 + (this.reduced ? 0 : 0.35 * Math.sin(t * 2 + r.x))) * kEm
          const target = this.hovered && this.hovered.id === r.id ? 1.35 : 1
          gem.scale.setScalar(gem.scale.x + (target - gem.scale.x) * 0.15)
        }
      }

      this.controls.update()
      this.renderer.render(inUnder ? this.sceneUnder : this.sceneTop, this.camera)
    }
    animate()
  }
}

export { World }
