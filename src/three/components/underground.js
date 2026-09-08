import * as THREE from 'three'

import { UNDER_DOME_Y, UNDER_SEA_Y } from '../config.js'
import { noise } from '../noise.js'

/* ================================================================
 * 地下内容(塞进 sceneUnder):洞顶背板 / 倒悬钟乳石晶穹 / 海岸幽光
 * 注意:随 ADR-0001 此文件 M3 起删除,改由 glTF 场景加载。
 * ================================================================ */

function buildUnderground(scene) {
  // 洞顶背板(地下的天空);半径 22,切层相机从背板外俯视进入,不穿模
  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(22, 32),
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
    const r = noise(7.7, i * 0.61) * 18
    const s = 0.5 + noise(i, i * 3) * 1.6
    m.compose(
      new THREE.Vector3(Math.cos(a) * r, UNDER_DOME_Y - s * 1.1, Math.sin(a) * r),
      q,
      new THREE.Vector3(s * 0.6, s, s * 0.6),
    )
    inst.setMatrixAt(i, m)
    inst.setColorAt(i, col.setHSL(0.72 + noise(i, 9) * 0.08, 0.4, 0.5 + noise(9, i) * 0.2))
  }
  inst.frustumCulled = false
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
  glow.frustumCulled = false
  scene.add(glow)
}

export { buildUnderground }
