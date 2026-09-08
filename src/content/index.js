import worldData from '../../content/world.json'
import charactersData from '../../content/characters.json'

// public/ 下的本地资源(如 characters/ling.jpg、world/aria-isles.jpg)在
// GitHub Pages 子路径部署时必须拼 import.meta.env.BASE_URL;外链(http/https)原样保留
const BASE = import.meta.env.BASE_URL || '/'
const withBase = (url) =>
  url && !/^(https?:)?\/\//.test(url) ? BASE + url.replace(/^\/+/, '') : url

// 世界观场景模型(world.json.models):top = 天空+地表,under = 地下
export const worldModels = {
  top: worldData.models.top ? withBase(worldData.models.top) : '',
  under: worldData.models.under ? withBase(worldData.models.under) : '',
}

// 世界观板块(world.json.regions 驱动)
export const regions = worldData.regions.map((r) => ({ ...r, image: withBase(r.image) }))
export const getRegion = (id) => regions.find((r) => r.id === id)

// 人物(content/characters.json 驱动)
export const characters = charactersData.map((c) => ({
  ...c,
  photo: withBase(c.photo),
  illustrations: (c.illustrations || []).map(withBase),
}))
export const getCharacter = (id) => characters.find((c) => c.id === id)
