# three.js 编码规范 

## 架构主线：Web 层不认识 three.js

项目分成两层：

- **Web 层**：`index.html` / `main.css` / `main.js`（或 React、Vue 等宿主应用）。
- **World 组件**：`src/World/` 整个文件夹。(本文件中World只是一个占位符)

三条边界规则：

1. Web 层只 import 一个东西：`src/World/World.js` 导出的 `World` 类。
2. 任何 `import ... from 'three'` 只允许出现在 `src/World/` 之内。
3. `src/World/` 对宿主一无所知：宿主只传一个容器元素，其余全部自理。整个文件夹应能原样搬进任何应用（原生页面、React、Vue……）。

### World 的两步接口

用户侧代码全貌（main.js）：

```js
import { World } from './World/World.js';

function main() {
  const container = document.querySelector('#scene-container');
  const world = new World(container); // 1. 创建实例
  world.render();                     // 2. 渲染场景
}

main();
```

扩展功能 = 给 World 增加显式方法，绝不开放内部对象。

## 目录与分类

```
src/World/
├─ World.js             组装者：构造 + render()，本身不含场景逻辑
├─ components/          能被放进场景的东西（物体/资产）
│  ├─ scene.js          createScene()
│  ├─ camera.js         createCamera()
│  ├─ cube.js           createCube()
│  └─ mainCharacter/    复杂物体的子目录（geometry.js / materials.js / animations.js …）
└─ systems/            作用在组件或其他系统上的东西
   ├─ renderer.js       createRenderer()
   └─ Resizer.js        类（文件名大写）
```

分类判定：

- 它是场景里的一个物体 / 资产 → `components`。
- 它是对组件或其他系统执行动作的东西（渲染、尺寸适配、动画循环）→ `systems`。
- 规模变大时再加新类目：`utilities`、`stores` 等。
- 复杂物体拆子目录、再拆子模块，别让任何文件长成"千行怪"。

## 模块写法约定

- 一文件一模块，ES module，文件底部 `export { ... }` 具名导出。
- 主体是创建函数 → 文件名小写（`camera.js`），导出 `createCamera()`：负责构造并返回实例，不含副作用。
- 主体是类 → 文件名首字母大写（`Resizer.js`），导出类本身。

工厂模板：

```js
import { Item } from 'three';

function createItem() {
  const instance = new Item();

  return instance;
}

export { createItem };
```

具体例子（物体组件：几何体 → 材质 → 网格）：

```js
// components/cube.js
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';

function createCube() {
  const geometry = new BoxGeometry(2, 2, 2); // 几何体
  const material = new MeshBasicMaterial();  // 材质
  const cube = new Mesh(geometry, material); // 网格

  return cube;
}

export { createCube };
```

几何体一律用无 Buffer 前缀的类（`BoxGeometry`）；`BoxBufferGeometry` 这类旧别名已被 three 移除。

## World 类骨架

```js
// World/World.js
import { createCamera } from './components/camera.js';
import { createCube } from './components/cube.js';
import { createScene } from './components/scene.js';

import { createRenderer } from './systems/renderer.js';
import { Resizer } from './systems/Resizer.js';

// World.js 内部随处可用，类外部（含 main.js）拿不到
let camera;
let scene;
let renderer;

class World {
  constructor(container) {
    camera = createCamera();
    scene = createScene();
    renderer = createRenderer();
    container.append(renderer.domElement); // canvas 挂进容器

    const cube = createCube(); // 只在构造期用到：普通局部变量
    scene.add(cube);

    new Resizer(container, camera, renderer);
  }

  render() {
    renderer.render(scene, camera); // 画一帧
  }
}

export { World };
```

取舍说明：

- 用模块作用域变量模拟私有字段；代价是两个 World 实例会互相覆盖变量 → 约定全程只创建一个 World 实例。
- 只活一个构造期的对象（如 cube）用普通局部变量：不上成员，不进模块作用域。

## 搭建顺序（新场景 / 新功能照此走）

1. `createScene()` —— 组件
2. `createCamera()` —— 组件；`aspect` 先填占位值 `1`，真实值留给 Resizer
3. `createRenderer()` —— 系统
4. 可视物体工厂（几何体 → 材质 → 网格）→ `scene.add(...)`
5. `new Resizer(container, camera, renderer)` —— 对齐容器
6. `render()` 里 `renderer.render(scene, camera)`

完成判据：

- 画面铺满容器且不变形；canvas 默认只有 300×150，没跑 Resizer 就会露馅。
- main.js 只有"两步接口"那几行，从 main.js 拿不到 scene / camera / renderer。

## Resizer：尺寸与视锥

```js
// systems/Resizer.js —— 文件名大写：因为主体是类
class Resizer {
  constructor(container, camera, renderer) {
    // 纵横比取自容器真实尺寸
    camera.aspect = container.clientWidth / container.clientHeight;

    // 改过 aspect/fov/near/far 后必须重算视锥（投影矩阵不会自动更新）
    camera.updateProjectionMatrix();

    // 渲染器及其 canvas 与容器同尺寸
    renderer.setSize(container.clientWidth, container.clientHeight);

    // 高分屏（移动端）清晰度
    renderer.setPixelRatio(window.devicePixelRatio);
  }
}

export { Resizer };
```

Resizer 之所以是类而非工厂函数：后续"窗口 resize 自动重算"等扩展加在它身上，为扩展留位。

## 常见坑速查

- canvas 默认 300×150：容器背景与场景背景同色时会掩盖"没铺满"的问题，调试时可临时把背景改成红色验证。
- `aspect` 依赖容器尺寸，别在工厂里猜值、别提前传容器——交给 Resizer。
- 场景背景色在 `createScene` 里设：`scene.background = new Color('skyblue')`。
- 相机视锥不自动重算：改 `aspect` / `fov` / `near` / `far` 任一，必须手动 `camera.updateProjectionMatrix()`。
