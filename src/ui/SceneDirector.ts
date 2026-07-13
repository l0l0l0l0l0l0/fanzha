/**
 * 场景管理器 + 主循环 + 触摸路由 + Letterbox blit
 *
 * 职责：
 * 1. 创建并管理显示画布（首次 tt.createCanvas()）
 * 2. 维护场景栈，提供 push/replace/pop 导航
 * 3. requestAnimationFrame 主循环驱动当前场景
 * 4. 全局 tt.onTouch* 路由到当前场景的 handleTouch
 * 5. 提供 createOffscreenCanvas 给游戏场景创建引擎画布
 * 6. blitContain：将引擎离屏画布按 contain 模式 blit 到显示画布（letterbox）
 * 7. screenToLocal：屏幕坐标 → 引擎画布坐标（letterbox 逆变换）
 * 8. consumedTouchIds：解决 Scene 按钮 vs 引擎 InputManager 拖拽的触摸冲突
 */
import type { Scene } from "./Scene";
import { consumedTouchIds } from "@/engine/touchState";
import {
  createCanvas,
  getSystemInfo,
  getMenuButtonLayout,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  offTouchStart,
  offTouchMove,
  offTouchEnd,
  offTouchCancel,
  onResize,
  offResize,
  onHide,
  onShow,
  type GameCanvas,
  type TouchEvent as TTTouchEvent,
} from "@/platform/web";

export class SceneDirector {
  private displayCanvas: GameCanvas;
  private displayCtx: CanvasRenderingContext2D;
  private screenW: number;
  private screenH: number;
  private dpr: number;

  private sceneStack: Scene[] = [];
  private current: Scene | null = null;
  private lastTs = 0;
  private rafId = 0;
  private running = false;
  private paused = false;

  /** 被场景按钮消费的触摸 ID（引擎 InputManager 应忽略这些触摸） */
  public consumedTouchIds = consumedTouchIds;

  private touchStartCb: (e: TTTouchEvent) => void;
  private touchMoveCb: (e: TTTouchEvent) => void;
  private touchEndCb: (e: TTTouchEvent) => void;
  private touchCancelCb: (e: TTTouchEvent) => void;
  private hideCb: () => void;
  private showCb: () => void;
  private resizeCb: () => void;

  constructor() {
    this.displayCanvas = createCanvas();
    this.displayCtx = this.displayCanvas.getContext("2d");
    this.resizeDisplay();

    this.touchStartCb = (e) => this.dispatchTouch("start", e);
    this.touchMoveCb = (e) => this.dispatchTouch("move", e);
    this.touchEndCb = (e) => this.dispatchTouch("end", e);
    this.touchCancelCb = (e) => this.dispatchTouch("end", e);
    this.hideCb = () => this.onHide();
    this.showCb = () => this.onShow();
    this.resizeCb = () => this.resizeDisplay();
  }

  /** 按当前窗口尺寸重设显示画布尺寸（resize 时调用） */
  private resizeDisplay(): void {
    const info = getSystemInfo();
    this.screenW = info.screenWidth;
    this.screenH = info.screenHeight;
    this.dpr = info.pixelRatio;
    this.displayCanvas.width = this.screenW * this.dpr;
    this.displayCanvas.height = this.screenH * this.dpr;
    this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.displayCtx.scale(this.dpr, this.dpr);
  }

  get screenWidth(): number { return this.screenW; }
  get screenHeight(): number { return this.screenH; }
  get currentScene(): Scene | null { return this.current; }

  /** 推入新场景（保留前一个在栈中） */
  push(scene: Scene, params?: Record<string, unknown>): void {
    if (this.current) this.sceneStack.push(this.current);
    this.current = scene;
    scene.enter(params);
  }

  /** 替换当前场景（不保留前一个） */
  replace(scene: Scene, params?: Record<string, unknown>): void {
    if (this.current) this.current.exit();
    this.current = scene;
    scene.enter(params);
  }

  /** 弹出当前场景，回到上一个 */
  pop(): void {
    if (this.current) this.current.exit();
    this.current = this.sceneStack.pop() ?? null;
    if (this.current) this.current.enter();
  }

  /** 启动主循环和触摸监听 */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);

    onTouchStart(this.touchStartCb);
    onTouchMove(this.touchMoveCb);
    onTouchEnd(this.touchEndCb);
    onTouchCancel(this.touchCancelCb);
    onResize(this.resizeCb);
    onHide(this.hideCb);
    onShow(this.showCb);
  }

  /** 停止主循环和触摸监听 */
  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    offTouchStart(this.touchStartCb);
    offTouchMove(this.touchMoveCb);
    offTouchEnd(this.touchEndCb);
    offTouchCancel(this.touchCancelCb);
    offResize(this.resizeCb);
  }

  /** 创建离屏画布（供游戏引擎使用） */
  createOffscreenCanvas(): GameCanvas {
    return createCanvas();
  }

  /**
   * 将引擎离屏画布按 contain 模式 blit 到显示画布
   * 居中缩放，上下/左右留黑边（#0A1929）
   */
  blitContain(src: GameCanvas, ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const srcW = src.width;
    const srcH = src.height;
    const scale = Math.min(screenW / srcW, screenH / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const offsetX = (screenW - drawW) / 2;
    const offsetY = (screenH - drawH) / 2;

    // 黑边填充
    ctx.fillStyle = "#0A1929";
    ctx.fillRect(0, 0, screenW, screenH);
    // blit
    ctx.drawImage(src as unknown as CanvasImageSource, offsetX, offsetY, drawW, drawH);
  }

  /**
   * 屏幕逻辑坐标 → 引擎画布本地坐标（letterbox 逆变换）
   */
  screenToLocal(x: number, y: number, canvasW: number, canvasH: number): { x: number; y: number } {
    const scale = Math.min(this.screenW / canvasW, this.screenH / canvasH);
    const offsetX = (this.screenW - canvasW * scale) / 2;
    const offsetY = (this.screenH - canvasH * scale) / 2;
    return {
      x: (x - offsetX) / scale,
      y: (y - offsetY) / scale,
    };
  }

  /** 安全区域（避开状态栏） */
  get safeArea() {
    const info = getSystemInfo();
    return {
      top: info.statusBarHeight || 0,
      bottom: 0,
      left: 0,
      right: 0,
    };
  }

  /** 胶囊按钮布局（右上角） */
  get menuButton() {
    return getMenuButtonLayout();
  }

  private loop = (ts: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (this.paused || !this.current) {
      this.lastTs = ts;
      return;
    }
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.current.update(dt);
    this.current.render(this.displayCtx, this.screenW, this.screenH);
  };

  private dispatchTouch(type: "start" | "move" | "end", e: TTTouchEvent): void {
    if (!this.current) return;
    for (const t of e.changedTouches) {
      const id = t.identifier;
      if (type === "start") {
        // 新触摸开始，先让场景尝试消费
        const consumed = this.current.handleTouch("start", t.clientX, t.clientY, id);
        if (consumed) this.consumedTouchIds.add(id);
      } else if (type === "move") {
        if (this.consumedTouchIds.has(id)) {
          // 已消费的触摸，通知场景 move（用于按钮高亮等），但仍标记为消费
          this.current.handleTouch("move", t.clientX, t.clientY, id);
        }
        // 未消费的触摸由引擎 InputManager 处理（它自己监听了 tt.onTouchMove）
      } else if (type === "end") {
        if (this.consumedTouchIds.has(id)) {
          this.current.handleTouch("end", t.clientX, t.clientY, id);
          this.consumedTouchIds.delete(id);
        }
        // 未消费的触摸由引擎 InputManager 处理
      }
    }
  }

  private onHide(): void {
    this.paused = true;
    this.current?.pause();
  }

  private onShow(): void {
    this.paused = false;
    this.lastTs = performance.now();
    this.current?.resume();
  }
}
