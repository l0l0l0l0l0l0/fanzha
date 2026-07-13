# 反诈街机 · Anti-Fraud Arcade

四个反诈主题小游戏的 Web 街机平台，部署在 GitHub Pages。

| 游戏 | 玩法灵感 | 类型 |
|---|---|---|
| 是男人就反诈 | 《是男人就下一百层》 | 竖屏 / 下落 + 反诈选择 |
| 反诈职业经理人 | 团建经理人类 | 竖屏部署 + 横屏战斗 |
| 雷霆反诈 | 《雷霆战机》 | 竖屏 / 弹幕射击 |
| 炸岛 | 弹弓投射 | 横屏 / 物理弹射 |

## 技术栈

- TypeScript + Canvas 2D（自研 SceneDirector/Scene/Engine 框架）
- esbuild 打包，输出 `web-build/app.js`
- 平台抽象层 [src/platform/web.ts](src/platform/web.ts) 封装浏览器 API，业务代码零平台耦合
- localStorage 存档

## 本地开发

```bash
pnpm install          # 安装依赖
pnpm dev              # 监听构建（esbuild watch）
pnpm preview          # 静态服务器预览 http://localhost:5173
```

开发时建议同时开两个终端：一个跑 `pnpm dev` 持续构建，一个跑 `pnpm preview` 提供静态服务，浏览器打开 `http://localhost:5173`。

## 构建

```bash
pnpm build            # 产出 web-build/app.js（minify + sourcemap）
```

构建产物在 `web-build/` 目录：`index.html`（入库）+ `app.js` / `app.js.map`（gitignore，构建时生成）。

## 部署到 GitHub Pages

本项目用 `gh-pages` 分支手动部署。

### 一次性配置

1. 推送代码到 GitHub 仓库
2. 仓库 Settings → Pages → Source 选 **Deploy from a branch**
3. Branch 选 `gh-pages` / `(root)` → Save

### 部署命令

```bash
pnpm build            # 先构建
pnpm deploy:web       # 推送 web-build/ 到 gh-pages 分支
```

`pnpm deploy:web` 会把 `web-build/` 目录内容推送到 `gh-pages` 分支根目录。部署完成后约 1-2 分钟生效。

访问地址：`https://<你的用户名>.github.io/<仓库名>/`

> 资源用相对路径 `./app.js`，无论是项目仓库（`/<repo>/`）还是用户站点（`/`）都能正常工作。

## 项目结构

```
src/
├── platform/web.ts         # 浏览器平台适配层（canvas/touch/storage/audio/font...）
├── engine/                  # GameEngine 基类、Input、Renderer、Audio、Particle
├── ui/                      # SceneDirector、Scene 基类、Theme、widgets、icons
├── scenes/                  # Hub/Briefing/各游戏 Select+Battle/Result 场景
├── games/                   # 四个游戏的引擎实现
│   ├── fraudBuster/
│   ├── manager/
│   ├── thunder/
│   └── bombIsland/
├── data/                    # 反诈信息数据（codex/fraudScenes/tips/games）
├── store/platformStore.ts   # 全局进度存档
└── main.ts                  # 入口
```

## 已知限制

- `setOrientation` 在 Web 上是 noop，移动端竖屏手机访问横屏游戏时画面会被 letterbox，建议用桌面浏览器或旋转手机
- 字体通过 Google Fonts CDN 加载，首次访问可能有 FOUT；CDN 不可达时回退系统字体
- `showModal` 用 `window.confirm`，样式简陋但功能正确
