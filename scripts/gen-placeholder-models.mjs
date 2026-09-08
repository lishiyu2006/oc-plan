// 生成占位 AETHERION glTF 测试模型(dev 联调用,非最终资产)。
// 用法:node scripts/gen-placeholder-models.mjs
// 产出:public/world/models/aetherion-top.glb(天空+地表)、aetherion-under.glb(地下)
// 结构:每层一个大岛平面,12 个板块以「名字=region.id」的 Group 锚点 + 锥形 landmark 实体。
// 真实模型到位后:Blender 导出同名锚点结构,替换 models URL(见 ADR-0001/0002)。
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// GLTFExporter 内部依赖浏览器 FileReader;node 下用 Blob.arrayBuffer 垫一个最小实现
if (!globalThis.FileReader) {
  class FileReaderShim {
    constructor() {
      this.result = null
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf
        this.onloadend?.()
      })
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        // 与浏览器一致的 data:...;base64, 前缀
        let bin = ''
        const bytes = new Uint8Array(buf)
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        this.result = `data:application/octet-stream;base64,${btoa(bin)}`
        this.onloadend?.()
      })
    }
  }
  globalThis.FileReader = FileReaderShim
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const world = JSON.parse(readFileSync(join(root, 'content/world.json'), 'utf8'))
const outDir = join(root, 'public/world/models')
mkdirSync(outDir, { recursive: true })

const out = (name) => join(outDir, name)

// 把 region.x/z(旧程序化时代坐标)直接作为锚点水平位置,便于与旧大陆观感连续
// 注:world.json 已移除 x/z(ADR-0001 锚点契约);无坐标时按层内序号环形摆放
function makeRegionAnchor(region, yFloor, idx, totalInLayer) {
  const group = new THREE.Group()
  group.name = region.id
  let x = 0, z = 0
  if (Number.isFinite(region.x) && Number.isFinite(region.z)) {
    x = region.x
    z = region.z
  } else {
    // 环形均布(半径 12),仅占位联调用
    const a = (idx / Math.max(totalInLayer, 1)) * Math.PI * 2 - Math.PI / 2
    x = Math.cos(a) * 12
    z = Math.sin(a) * 12
  }
  group.position.set(x, yFloor, z)

  // landmark 实体:彩色锥柱(占位;真实模型里换成地标本体,仍包在同名 Group 内)
  const geo = new THREE.ConeGeometry(1.6, 5, 8)
  const mat = new THREE.MeshStandardMaterial({ color: region.color, flatShading: true, emissive: region.color, emissiveIntensity: 0.7 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 2.6
  mesh.name = `${region.id}-landmark`
  group.add(mesh)
  return group
}

// ---- top 场景:地表圆盘 + 每个板块锚点(y 与层适配)----
const topScene = new THREE.Scene()
const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(26, 28, 2, 64),
  new THREE.MeshStandardMaterial({ color: '#4b5847', flatShading: true, roughness: 1 }),
)
ground.position.y = -1
ground.name = 'ground'
topScene.add(ground)

// 天空/地表高度常量(与 src/three/config.js 保持一致的语义:地表 y≈0,天空 y≈14)
const SURFACE_Y = 0
const SKY_Y = 14
{
  let i = 0
  const inLayer = world.regions.filter((r) => r.layer !== 'underground').length
  for (const r of world.regions) {
    if (r.layer === 'underground') continue
    const y = r.layer === 'sky' ? SKY_Y : SURFACE_Y
    topScene.add(makeRegionAnchor(r, y, i++, inLayer))
  }
}

// ---- under 场景:地下圆盘 + underground 板块锚点(y≈-8~-14)----
const underScene = new THREE.Scene()
const dome = new THREE.Mesh(
  new THREE.CylinderGeometry(26, 28, 2, 64),
  new THREE.MeshStandardMaterial({ color: '#3a3456', flatShading: true, roughness: 1 }),
)
dome.position.y = -9
dome.name = 'ground'
underScene.add(dome)
const UNDER_Y = -8.5
{
  let i = 0
  const inLayer = world.regions.filter((r) => r.layer === 'underground').length
  for (const r of world.regions) {
    if (r.layer !== 'underground') continue
    underScene.add(makeRegionAnchor(r, UNDER_Y, i++, inLayer))
  }
}

const exporter = new GLTFExporter()
const opts = { binary: true }
async function exportScene(scene, file) {
  const buf = await exporter.parseAsync(scene, opts)
  writeFileSync(file, Buffer.from(buf))
  console.log(`written ${file} (${buf.byteLength} bytes)`)
}

await exportScene(topScene, out('aetherion-top.glb'))
await exportScene(underScene, out('aetherion-under.glb'))
console.log('done')
