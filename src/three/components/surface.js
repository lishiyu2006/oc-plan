import * as THREE from 'three'

import { H_SCALE, ISLE } from '../config.js'
import { fbm, heightAt, inFrost, isleHeightAt, noise, vegNoise } from '../noise.js'

/* ================================================================
 * 地表 + 天空内容(全部塞进 sceneTop):大陆地形/树木/晶簇/魔力光点/
 * 星空/环海光雨/悬浮岛/光桥/王门离岛/断境长城
 * 注意:随 ADR-0001 此文件 M3 起删除,改由 glTF 场景加载。
 * ================================================================ */

function buildTerrain(scene) {
  // 48×48:边缘伸到半径 24 的深海,地形平面边界藏进雾距,不与海面产生接缝
  const geo = new THREE.PlaneGeometry(48, 48, 256, 256)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = heightAt(x, z)
    pos.setY(i, h * H_SCALE)
    if (inFrost(x, z) && h > -0.02) {
      // 冰原:雪白 → 冰蓝微渐变,随噪声起伏
      const g = noise(x * 0.35 + 9.1, z * 0.35 + 2.7)
      c.setHSL(0.54 + g * 0.04, 0.16 + g * 0.14, 0.8 + g * 0.12)
    } else if (h < -0.16) c.set('#0b1f26')
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

function buildTrees(scene, regions) {
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
    if (inFrost(x, z)) continue // 冰原不种树
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
  inst.frustumCulled = false // 实例散布全大陆,包围球不可靠,防止拉近时被误剔除
  scene.add(inst)
}

function buildCrystalCluster(scene, cx, cz, color, n = 6, spread = 1.6) {
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
    gem.frustumCulled = false
    group.add(gem)
  }
  scene.add(group)
  return group
}

function buildParticles(scene) {
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
  const points = new THREE.Points(
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
  points.frustumCulled = false
  scene.add(points)
  return points
}

function buildStars(scene) {
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
  const stars = new THREE.Points(
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
  stars.frustumCulled = false
  scene.add(stars)
  return stars
}

function buildRimRain(scene) {
  // 世界之界:环海之外、虚空边界一圈向下坠落的光雨
  const n = 700
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = 25.3 + noise(i * 0.9, 1.1) * 1.8
    arr[i * 3] = Math.cos(a) * r
    arr[i * 3 + 1] = -12 + noise(i, 5.5) * 20
    arr[i * 3 + 2] = Math.sin(a) * r
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  const rain = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: '#e8e4d8',
      size: 0.3,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  rain.frustumCulled = false
  scene.add(rain)
  return rain
}

function buildIsland(scene, x, z, y, tall = false) {
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
  g.traverse((o) => {
    o.frustumCulled = false
  })
  scene.add(g)
  return { node: g, baseY: y }
}

function buildBridge(scene, a, b) {
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

/* ---------- 古境王门离岛:独立小陆地 + 巨石之门 + 双环 ---------- */
function buildIslet(scene) {
  const size = ISLE.r * 2 + 2
  const geo = new THREE.PlaneGeometry(size, size, 48, 48)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i)
    const lz = pos.getZ(i)
    const h = isleHeightAt(ISLE.x + lx, ISLE.z + lz)
    pos.setY(i, h * H_SCALE)
    if (h < -0.16) c.set('#0b1f26')
    else if (h < 0.0) c.set('#256069')
    else if (h < 0.06) c.set('#8a8471') // 风化浅滩
    else if (h < 0.26) c.set('#5c5f52')
    else c.set('#6a675c') // 石灰岩顶
    const j = (noise(lx * 3.1 + 40, lz * 3.1) - 0.5) * 0.05
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
  mesh.position.set(ISLE.x, 0, ISLE.z)
  mesh.frustumCulled = false
  scene.add(mesh)
}

/**
 * 王门离岛上的巨石之门 + 门内通道 + 高空悬浮巨环。
 * 返回 { portal, skyRing },供动画循环驱动(门环缓转/巨环自转浮动)。
 */
function buildKingsgate(scene) {
  const gy = Math.max(isleHeightAt(ISLE.x, ISLE.z), 0.06) * H_SCALE
  const g = new THREE.Group()
  g.position.set(ISLE.x, gy, ISLE.z)
  g.rotation.y = Math.atan2(-ISLE.x, -ISLE.z) // 门面向大陆

  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#7d786a',
    flatShading: true,
    roughness: 0.95,
  })
  // 风化石柱:三段堆叠,逐段收窄 + 错位
  const pillar = (px) => {
    const p = new THREE.Group()
    let y = 0
    for (let i = 0; i < 3; i++) {
      const segH = 1.55 - i * 0.12
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.15 - i * 0.12, segH, 1.35 - i * 0.1),
        stoneMat,
      )
      box.position.set(
        px + (noise(i, px) - 0.5) * 0.14,
        y + segH / 2,
        (noise(px, i) - 0.5) * 0.12,
      )
      box.rotation.y = (noise(i * 2.1, px) - 0.5) * 0.1
      p.add(box)
      y += segH * 0.99
    }
    return p
  }
  g.add(pillar(-1.75), pillar(1.75))
  // 门楣:两块横板错落堆叠(断裂风化感)
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.85, 1.5), stoneMat)
  lintel.position.y = 4.75
  lintel.rotation.z = 0.02
  const lintel2 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.6, 1.3), stoneMat)
  lintel2.position.set(-0.3, 5.45, 0)
  lintel2.rotation.z = -0.03
  g.add(lintel, lintel2)

  // 门内竖放发光圆环(异界通道)
  const portal = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.09, 10, 48),
    new THREE.MeshStandardMaterial({
      color: '#8a8060',
      emissive: '#c8b890',
      emissiveIntensity: 1.4,
      flatShading: true,
    }),
  )
  portal.position.y = 2.6
  g.add(portal)
  // 门内微光盘(通道辉光)
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.32, 32),
    new THREE.MeshBasicMaterial({
      color: '#c8b890',
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  disc.position.y = 2.6
  g.add(disc)
  const gateLight = new THREE.PointLight('#c8b890', 14, 11, 2)
  gateLight.position.y = 2.6
  g.add(gateLight)

  // 高空水平悬浮巨环(永转 + 缓慢浮动)
  const skyRing = new THREE.Group()
  skyRing.position.y = 10.5
  const skyRingMesh = new THREE.Mesh(
    new THREE.TorusGeometry(4.1, 0.16, 10, 64),
    new THREE.MeshStandardMaterial({
      color: '#8a8060',
      emissive: '#d8c88e',
      emissiveIntensity: 1.5,
      flatShading: true,
    }),
  )
  skyRingMesh.rotation.x = Math.PI / 2
  skyRing.add(skyRingMesh)
  g.add(skyRing)

  g.traverse((o) => {
    o.frustumCulled = false
  })
  scene.add(g)
  return { portal, skyRing }
}

/* ---------- 断境长城:高原崖边的古城墙遗迹 + 断裂塔楼 + 云海 ---------- */
function archWallGeo(w, h, arches = 1) {
  // 矩形墙板 + 底部拱形门洞(Shape 挖洞后 Extrude)
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.lineTo(-w / 2, h)
  s.closePath()
  const r = 0.4
  const ay = 1.05
  const offsets = arches === 2 ? [-0.55, 0.55] : [0]
  for (const ox of offsets) {
    const hole = new THREE.Path()
    hole.moveTo(ox - r, 0)
    hole.lineTo(ox - r, ay)
    hole.absarc(ox, ay, r, Math.PI, 0, true)
    hole.lineTo(ox + r, 0)
    hole.closePath()
    s.holes.push(hole)
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: false })
  geo.translate(0, 0, -0.4)
  return geo
}

/** 返回云海 mesh 数组,供动画循环漂移驱动。 */
function buildSunderwall(scene, regions) {
  const region = regions.find((r) => r.id === 'sunderwall')
  if (!region) return []
  const WX = region.x
  const WZ = region.z
  const g = new THREE.Group()
  g.position.set(WX, 0, WZ)
  g.rotation.y = Math.atan2(WX, WZ) // 局部 +z 朝崖外(海的方向),墙沿局部 x 绵延
  const cosY = Math.cos(g.rotation.y)
  const sinY = Math.sin(g.rotation.y)
  const groundAt = (lx, lz) => heightAt(WX + lx * cosY + lz * sinY, WZ - lx * sinY + lz * cosY)
  const stoneCol = new THREE.Color('#8fa8a0')
  const stoneMat = (dk) =>
    new THREE.MeshStandardMaterial({
      color: stoneCol.clone().offsetHSL(0, 0, dk),
      flatShading: true,
      roughness: 0.95,
    })
  const grassMat = new THREE.MeshStandardMaterial({ color: '#5c6b52', flatShading: true, roughness: 1 })

  // 4 段墙板:高低错落 + 错位微旋转(风化),其中一段开双拱门
  const segs = [
    { lx: -3.3, w: 2.2, h: 2.5, arches: 1 },
    { lx: -1.1, w: 2.2, h: 2.1, arches: 1 },
    { lx: 1.1, w: 2.2, h: 2.8, arches: 2 },
    { lx: 3.3, w: 2.2, h: 2.3, arches: 1 },
  ]
  segs.forEach((sg, i) => {
    const wall = new THREE.Mesh(archWallGeo(sg.w, sg.h, sg.arches), stoneMat((noise(i, 4) - 0.5) * 0.1))
    wall.position.set(sg.lx + (noise(i, 1) - 0.5) * 0.12, groundAt(sg.lx, 0) * H_SCALE - 0.15, (noise(i, 2) - 0.5) * 0.2)
    wall.rotation.set(0, (noise(i, 3) - 0.5) * 0.08, (noise(i, 5) - 0.5) * 0.05)
    g.add(wall)
    // 顶部长草:几撮小锥
    const gn = 2 + (i % 2)
    for (let j = 0; j < gn; j++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), grassMat)
      tuft.position.set(
        sg.lx + (noise(i * 7, j) - 0.5) * sg.w * 0.8,
        wall.position.y + sg.h + 0.1,
        (noise(j, i * 3) - 0.5) * 0.6,
      )
      tuft.rotation.z = (noise(i, j * 9) - 0.5) * 0.3
      g.add(tuft)
    }
  })

  // 两端断裂塔楼:左塔高(顶块歪斜),右塔矮(彻底塌断,旁边倒着残块)
  const tower = (lx, baseH) => {
    const t = new THREE.Group()
    const gy = groundAt(lx, 0) * H_SCALE - 0.2
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, baseH, 7), stoneMat(-0.05))
    base.position.y = baseH / 2
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, 1.1, 7), stoneMat(0.02))
    top.position.set(0.08, baseH + 0.45, 0)
    top.rotation.set(0.06, 0.3, 0.16) // 断裂后歪斜的顶层
    t.add(base, top)
    t.position.set(lx, gy, 0)
    return t
  }
  g.add(tower(-5.2, 2.7), tower(5.4, 1.6))
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.9), stoneMat(-0.02))
  fallen.position.set(6.4, groundAt(6.4, 0.8) * H_SCALE + 0.15, 0.8)
  fallen.rotation.set(0.2, 0.5, 0.28)
  g.add(fallen)

  // 崖外云海:几片半透明白色扁球,缓慢漂移
  const wallClouds = []
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#dfe8ea',
    transparent: true,
    opacity: 0.32,
    roughness: 1,
    depthWrite: false,
  })
  const baseY = heightAt(WX, WZ) * H_SCALE
  for (let i = 0; i < 5; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(1.3 + noise(i, 7) * 1.1, 8, 6), cloudMat)
    const lx = -4.5 + i * 2.2 + (noise(i, 3) - 0.5) * 1.6
    cl.position.set(lx, baseY - 0.8 - noise(i, 9) * 1.4, 3.4 + noise(i, 5) * 2.8)
    cl.scale.set(2.0, 0.42, 1.15)
    cl.userData.baseX = lx
    cl.userData.phase = i * 1.3
    wallClouds.push(cl)
    g.add(cl)
  }

  g.traverse((o) => {
    o.frustumCulled = false
  })
  scene.add(g)
  return wallClouds
}

export { buildBridge, buildCrystalCluster, buildIsland, buildIslet, buildKingsgate, buildParticles, buildRimRain, buildStars, buildSunderwall, buildTerrain, buildTrees }
