import * as THREE from 'three'

/* ================================================================
 * 海面(地表环海 + 地下暗海共用)
 * ================================================================ */

function makeSea(scene, size, y, segs) {
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
  mesh.frustumCulled = false
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

export { animateSea, makeSea }
