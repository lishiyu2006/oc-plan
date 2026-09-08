// Web 层唯一入口(three.js 隔离边界):
// 宿主只能从这里 import { World },不接触任何 three 内部模块。
export { World } from './World.js'
