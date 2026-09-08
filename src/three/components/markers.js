import * as THREE from 'three'

import { H_SCALE, SKY_Y, UNDER_DOME_Y, UNDER_SEA_Y } from '../config.js'
import { heightAt, isleHeightAt } from '../noise.js'

/* ================================================================
 * 板块标记:发光宝石 + 指向光束 + 板块点光
 * 按 region.layer 归入对应层 Group(sky/surface → sceneTop,underground → sceneUnder)
 * 注意:随 ADR-0001 此文件 M3 起重写(锚点寻址替代坐标 y 推算)。
 * ================================================================ */

/** 建空的层标记组并挂进场景(先于场景内容构建,保证层级在最前)。 */
function createMarkerGroups(sceneTop, sceneUnder) {
  const groups = {
    sky: new THREE.Group(),
    surface: new THREE.Group(),
    underground: new THREE.Group(),
  }
  sceneTop.add(groups.sky, groups.surface)
  sceneUnder.add(groups.underground)
  return groups
}

/** 逐板块建标记(位置 y 由层规则推算),并登记拾取/动画句柄。 */
function buildRegionMarkers(markerGroups, regions) {
  const gemsByLayer = { sky: [], surface: [], underground: [] }
  const markerByRegion = {}

  const buildMarker = (region, y) => {
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
    return gem
  }

  for (const r of regions) {
    let y
    if (r.id === 'kingsgate') y = Math.max(isleHeightAt(r.x, r.z) * H_SCALE, 0) + 1.4
    else if (r.layer === 'surface') y = Math.max(heightAt(r.x, r.z) * H_SCALE, 0) + 1.4
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

  return { gemsByLayer, markerByRegion }
}

export { buildRegionMarkers, createMarkerGroups }
