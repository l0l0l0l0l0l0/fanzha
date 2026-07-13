# GitHub Pages 部署改造方案

## Context

当前项目是一个抖音小游戏（Canvas 2D 渲染、`tt.*` 平台 API、esbuild 打包出 `game.js`）。用户希望改为纯 Web 项目部署到 GitHub Pages（项目仓库，URL 形如 `https://<user>.github.io/<repo>/`）。

架构上的好消息：所有平台 API 都已通过 [src/platform/tt.ts](file:///Users/leeonliang/Desktop/AI/game/src/platform/tt.ts) 抽象，业务代码 18 处统一从 `@/platform/tt` 导入（[SceneDirector](file:///Users/leeonliang/Desktop/AI/game/src/ui/SceneDirector.ts)、[Input](file:///Users/leeonliang/Desktop/AI/game/src/engine/Input.ts)、[Audio](file:///Users/leeonliang/Desktop/AI/game/src/engine/Audio.ts)、各 [scenes](file:///Users/leeonliang/Desktop/AI/game/src/scenes) 等）。这意味着只要替换这一份平台实现 + 调整构建配置，业务代码无需改动。

## 用户决策

| 决策点 | 选择 |
|---|---|
| 仓库类型 | 项目仓库 → 用相对路径 `./app.js` 避免硬编码仓库名 |
| 抖音版本 | 只保留 Web → 删除抖音产物、配置、tt.ts |
| 横屏处理 | 桌面横屏铺满 → 画布跟随窗口尺寸，需修改 SceneDirector 监听 resize |
| 部署方式 | gh-pages 分支手动部署 → 添加 `gh-pages` npm 包 + `deploy` 脚本 |

## 改造步骤

### 1. 清理抖音残留

删除以下文件/目录（与 Web 部署无关）：

- 根目录 4 个中文子项目目录：`拆岛/`、`雷霆反诈/`、`职业经理人/`、`是男人就反诈/`（早期独立子项目，`src/` 不引用，已确认无 import 关系）
- 抖音产物：`game.js`、`game.js.map`
- 抖音配置：`game.json`、`project.config.json`
- 旧构建配置：`esbuild.config.mjs`（将重写）

### 2. 平台层重写

**新建 [src/platform/web.ts](file:///Users/leeonliang/Desktop/AI/game/src/platform/web.ts)**，与 `tt.ts` 同签名，用浏览器原生 API 实现：

| API | Web 实现 |
|---|---|
| `createCanvas()` | 首次调用创建主 `<canvas>` 并 append 到 body（CSS 充满 viewport）；后续调用返回 `document.createElement('canvas')` 离屏画布 |
| `getSystemInfo()` | 返回 `window.innerWidth/innerHeight/devicePixelRatio`，缓存 + resize 时更新 |
| `getMenuButtonLayout()` | Web 无胶囊，返回屏幕外虚拟值（不影响渲染） |
| `onTouchStart/Move/End/Cancel` + `off*` | 主 canvas 上 `addEventListener`，把 `touchstart/move/end/cancel` 和 `mousedown/move/up`（桌面端 identifier=0）统一映射为 `TouchEvent` 接口；维护回调 Set 支持 off |
| `onResize(cb)` / `offResize(cb)` | 新增接口：`window.addEventListener('resize', cb)`，回调里调用 `getSystemInfo.invalidateCache()` |
| `getStorageSync/setStorageSync/removeStorageSync` | `localStorage.getItem/setItem/removeItem`（JSON 序列化） |
| `createAudioContext()` | `new (window.AudioContext \|\| webkitAudioContext)()` |
| `loadFont/initFonts` | `FontFace` API + Google Fonts CDN（ZCOOL KuaiLe、Noto Sans SC、JetBrains Mono），不依赖本地字体文件 |
| `shareAppMessage` | `navigator.share` 优先，回退 `clipboard.writeText` |
| `vibrateShort/Long` | `navigator.vibrate(15/200)` |
| `showModal` | `window.confirm` → 返回 `{confirm, cancel}` |
| `setOrientation` | noop（桌面横屏铺满方案下不强制旋转） |
| `onHide/onShow` | `document.addEventListener('visibilitychange')` |
| `exitMiniProgram` | noop + console 提示 |
| `log/warn/error` | `console.*` |
| 类型导出 | `GameCanvas`、`SystemInfo`、`MenuButtonLayout`、`TouchData`、`TouchEvent`（与 tt.ts 一致） |

**删除 `src/platform/tt.ts`**。

**全局替换** `@/platform/tt` → `@/platform/web`（18 处 import，分布在 `src/main.ts`、`src/ui/SceneDirector.ts`、`src/engine/{Input,Audio,GameEngine}.ts`、`src/store/platformStore.ts`、`src/games/{bombIsland,thunder,manager,fraudBuster}/engine.ts`、`src/scenes/{Thunder,FraudBuster,BombIslandBattle,ManagerDeploy,ManagerBattle}Scene.ts`、`src/scenes/ResultOverlay.ts`）。

### 3. 横屏铺满 - SceneDirector 改造

修改 [src/ui/SceneDirector.ts](file:///Users/leeonliang/Desktop/AI/game/src/ui/SceneDirector.ts)：

- 构造函数：抽出"按当前 systemInfo 设置 canvas 尺寸 + scale dpr"的逻辑为私有方法 `resizeDisplay()`
- `start()`：新增 `onResize(this.resizeCb)` 订阅
- `stop()`：新增 `offResize(this.resizeCb)` 取消订阅
- `resizeCb`：调用 `resizeDisplay()` 更新 screenW/H + displayCanvas.width/height + displayCtx.scale(dpr)

这样窗口 resize 时画布跟随，横屏游戏（炸岛 960×540、经理人战斗 960×540）在桌面宽屏窗口里直接 contain 铺满。

### 4. Web 构建配置

**重写 [esbuild.config.mjs](file:///Users/leeonliang/Desktop/AI/game/esbuild.config.mjs)**：

```js
const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "web-build/app.js",
  platform: "browser",      // 关键：从 "neutral" 改为 "browser"
  format: "iife",            // 浏览器直接加载
  target: "es2020",
  sourcemap: isWatch ? "inline" : "linked",
  minify: !isWatch,
  treeShaking: true,
  legalComments: "none",
  plugins: [aliasPlugin],   // 保留 @/ alias
  resolveExtensions: EXTENSIONS,
  define: { "process.env.NODE_ENV": isWatch ? '"development"' : '"production"' },
};
```

`@/` alias 插件保留不变。

### 5. HTML 入口

**新建 `web-build/index.html`**：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>反诈街机</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0A1929; }
    canvas { display: block; touch-action: none; }
    #loading { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; color: #00E5FF; font: 700 18px "Noto Sans SC", sans-serif; }
  </style>
</head>
<body>
  <div id="loading">正在启动反诈街机…</div>
  <script src="./app.js"></script>
</body>
</html>
```

关键点：
- `./app.js` 相对路径 → 项目仓库子路径 `/<repo>/` 下也能正确加载
- `touch-action: none` 防止移动端触摸滚动干扰游戏
- `viewport-fit=cover` 适配刘海屏

### 6. package.json

修改 scripts：

```json
{
  "scripts": {
    "dev": "node esbuild.config.mjs --watch",
    "build": "node esbuild.config.mjs",
    "preview": "npx serve web-build -l 5173",
    "deploy": "gh-pages -d web-build -m \"deploy: web build\""
  },
  "devDependencies": {
    "esbuild": "^0.28.1",
    "gh-pages": "^6.1.0",
    "typescript": "~5.8.3"
  }
}
```

移除 `@types/node`（web 构建不需要）。

### 7. .gitignore

追加：

```
web-build/app.js
web-build/app.js.map
```

`web-build/index.html` 入库（手写）；构建产物不入库，部署时由 CI 或本地 `pnpm build && pnpm deploy` 生成。

### 8. README

更新为 Web 版本：项目简介、`pnpm install`、`pnpm dev` 本地开发、`pnpm build` 构建、`pnpm deploy` 部署到 GitHub Pages（含仓库 Settings → Pages → Source 设为 `gh-pages` 分支的说明）。

## 关键文件清单

| 操作 | 文件 |
|---|---|
| 新建 | `src/platform/web.ts` |
| 删除 | `src/platform/tt.ts` |
| 修改（import 路径） | 18 处 `@/platform/tt` → `@/platform/web` |
| 修改（resize 订阅） | [src/ui/SceneDirector.ts](file:///Users/leeonliang/Desktop/AI/game/src/ui/SceneDirector.ts) |
| 重写 | [esbuild.config.mjs](file:///Users/leeonliang/Desktop/AI/game/esbuild.config.mjs) |
| 新建 | `web-build/index.html` |
| 修改 | [package.json](file:///Users/leeonliang/Desktop/AI/game/package.json) |
| 修改 | [.gitignore](file:///Users/leeonliang/Desktop/AI/game/.gitignore) |
| 重写 | [README.md](file:///Users/leeonliang/Desktop/AI/game/README.md) |
| 删除 | `game.js`, `game.js.map`, `game.json`, `project.config.json`, `拆岛/`, `雷霆反诈/`, `职业经理人/`, `是男人就反诈/` |

## 验证

1. **构建**：`pnpm install && pnpm build` → 产出 `web-build/app.js`
2. **本地预览**：`pnpm preview` → 浏览器打开 `http://localhost:5173`
3. **功能测试**（四个游戏全过一遍）：
   - HubScene 主菜单：四个游戏卡片可点击进入
   - 是男人就反诈：竖屏，下落 + 选择反诈选项
   - 雷霆反诈：竖屏，飞机射击
   - 炸岛：横屏铺满，弹弓拖拽
   - 职业经理人：部署（竖屏）→ 战斗（横屏铺满）→ 结算
4. **横屏铺满**：进入炸岛战斗场景，桌面宽屏浏览器窗口里画面应横向铺满；拖拽窗口大小，画面应跟随 resize
5. **触摸/鼠标兼容**：移动端触摸可玩，桌面端鼠标可玩
6. **存档**：玩一局后刷新页面，进度应保留（localStorage）
7. **音效**：点击有声音（浏览器需要先有用户交互才能播放音频，HubScene 点击进入游戏即触发）
8. **部署**：`pnpm deploy` → 推送 `web-build/` 到 `gh-pages` 分支 → GitHub 仓库 Settings → Pages → Source 设为 `gh-pages` 分支 `/` 根目录 → 等待几分钟后访问 `https://<user>.github.io/<repo>/`

## 已知限制

- `setOrientation` 在 Web 上是 noop，移动端竖屏手机访问横屏游戏时画面会被 letterbox（建议用桌面浏览器或旋转手机）
- 字体通过 Google Fonts CDN 加载，首次访问可能有 FOUT；CDN 不可达时回退系统字体
- `showModal` 用 `window.confirm`，样式简陋但功能正确
- 抖音特有能力（分享卡片、关注、视频激励）不可用，对应函数为 noop
