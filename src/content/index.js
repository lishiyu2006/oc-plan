import worldData from '../../content/world.json'
import charactersData from '../../content/characters.json'

// 世界观板块(content/world.json 驱动)
export const regions = worldData
export const getRegion = (id) => regions.find((r) => r.id === id)

// 人物(content/characters.json 驱动)
export const characters = charactersData
export const getCharacter = (id) => characters.find((c) => c.id === id)
