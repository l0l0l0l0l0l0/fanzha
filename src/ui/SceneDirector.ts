/**
 * 场景管理器 + 主循环 + 触摸路由 + Letterbox blit + 场景过渡动画
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
 * 9. 场景过渡：replace/push/pop 时旧画面快照 + 新场景实况叠加动画
 * 10. 全局 PostFX 后处理（CRT/色差/glitch/屏闪/震屏/霓虹边框）
 *
 * 自适应逻辑分辨率：
 * - 逻辑高度恒定 896（纵向布局基准），逻辑宽度按设备自适应
 * - 手机端：414×896，舞台铺满全屏（原行为）
 * - 桌面端：按显示器宽高比自适应宽度（414..1600）×896，舞台铺满全屏
 *   游戏界面真正适配 PC 宽屏，不再中间竖屏窄条 + 两侧空置装饰
 * - 横屏游戏引擎画布（如 960×540）在宽逻辑空间下铺满率更高，减少黑边
 */
import type { Scene } from "./Scene";
import { consumedTouchIds } from "@/engine/touchState";
import { postFX } from "@/engine/PostFX";
import { Ease } from "@/engine/easing";
import { Theme } from "@/ui/Theme";
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
  offHide,
  onShow,
  offShow,
  type GameCanvas,
  type TouchEvent as TTTouchEvent,
} from "@/platform/web";
import { viewport, isDesktopLayout, computeDesktopLogicalW, BASE_LOGICAL_W, type StageRect } from "@/platform/viewport";

export type TransitionKind = "fade" | "glitch" | "slide" | "none";

interface ActiveTransition {
  kind: TransitionKind;
  t: number;
  duration: number;
  snapshot: GameCanvas;
}

/**
 * 逻辑分辨率：高度恒定 896（纵向布局基准），宽度自适应
 * - 手机端：414（竖屏，舞台铺满全屏）
 * - 桌面端：按显示器宽高比自适应（414..1600），舞台铺满全屏
 *   游戏界面真正适配 PC 宽屏，不再中间竖屏窄条 + 两侧空置装饰
 */
const LOGICAL_H = 896;

/** DPR 上限：避免高分屏超大画布爆内存（PostFX 在 dpr>2 时亦降级） */
const DPR_CAP = 2;

export class SceneDirector {
  private displayCanvas: GameCanvas;
  private displayCtx: CanvasRenderingContext2D;
  /** v3：窗口物理 CSS 尺寸（displayCanvas 的 CSS 像素尺寸） */
  private displayW: number;
  private displayH: number;
  /** 自适应逻辑宽度（手机 414 / 桌面按宽高比自适应） */
  private logicalW = BASE_LOGICAL_W;
  /** 固定逻辑高度（场景纵向布局基准） */
  private readonly screenH = LOGICAL_H;
  private dpr: number;

  /** 场景渲染目标离屏画布（logicalW×896 逻辑像素，物理像素 = logicalW*dpr × 896*dpr） */
  private sceneCanvas: GameCanvas;
  private sceneCtx: CanvasRenderingContext2D;

  /** 舞台矩形（CSS px），桌面/手机均为整个窗口 */
  private stage: StageRect = { x: 0, y: 0, w: 1, h: 1 };
  /** 是否处于桌面/宽屏布局（决定逻辑宽度是否自适应） */
  private desktopLayout = false;

  private sceneStack: Scene[] = [];
  private current: Scene | null = null;
  private lastTs = 0;
  private rafId = 0;
  private running = false;
  private paused = false;
  /** 主循环连续异常计数（用于防卡死熔断） */
  private errorStreak = 0;

  private transition: ActiveTransition | null = null;

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
    const dctx = this.displayCanvas.getContext("2d", { alpha: true });
    if (!dctx) throw new Error("Display canvas 2D context unavailable");
    this.displayCtx = dctx;
    // v3：创建独立的场景离屏画布（不 append 到 DOM）
    // 通过 createCanvas 创建会复用 mainCanvas，因此直接 createElement 绕过
    const sc = (typeof document !== "undefined")
      ? document.createElement("canvas")
      : (createCanvas() as unknown as HTMLCanvasElement);
    sc.width = BASE_LOGICAL_W;
    sc.height = LOGICAL_H;
    this.sceneCanvas = sc as unknown as GameCanvas;
    const sctx = this.sceneCanvas.getContext("2d", { alpha: true });
    if (!sctx) throw new Error("Scene canvas 2D context unavailable");
    this.sceneCtx = sctx;
    this.displayW = 1;
    this.displayH = 1;
    this.dpr = 1;
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
    this.displayW = Math.max(1, info.screenWidth);
    this.displayH = Math.max(1, info.screenHeight);
    // DPR 上限保护：避免高分屏超大画布爆内存
    this.dpr = Math.min(Math.max(1, info.pixelRatio || 1), DPR_CAP);
    // 显示画布：物理像素 = CSS 尺寸 × dpr
    this.displayCanvas.width = Math.max(1, Math.round(this.displayW * this.dpr));
    this.displayCanvas.height = Math.max(1, Math.round(this.displayH * this.dpr));
    // displayCtx 维持 CSS 像素空间（兼容现有场景对 ctx 的 scale 假设）
    this.displayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.displayCtx.scale(this.dpr, this.dpr);
    // 自适应逻辑宽度：桌面端按宽高比推导，手机端保持 414
    this.desktopLayout = isDesktopLayout(this.displayW, this.displayH);
    this.logicalW = this.desktopLayout
      ? computeDesktopLogicalW(this.displayW, this.displayH)
      : BASE_LOGICAL_W;
    // 场景离屏画布：物理像素 = 逻辑尺寸 × dpr
    this.sceneCanvas.width = Math.max(1, Math.round(this.logicalW * this.dpr));
    this.sceneCanvas.height = Math.max(1, Math.round(LOGICAL_H * this.dpr));
    this.sceneCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.sceneCtx.scale(this.dpr, this.dpr);
    // 计算舞台矩形并同步 viewport
    this.computeStage();
    // PostFX 在 displayCtx（CSS 像素空间）之上叠加后处理
    postFX.resize(this.displayW, this.displayH, this.dpr);
  }

  /**
   * 计算舞台矩形并同步到 viewport 单例
   * - 桌面/宽屏：舞台 = 整个窗口（逻辑宽度已按宽高比自适应，铺满全屏无黑边）
   *   超宽屏逻辑宽度封顶时，contain 缩放会在左右留少量深色边，无装饰
   * - 手机竖屏：舞台 = 整个窗口（行为不变）
   */
  private computeStage(): void {
    this.stage = { x: 0, y: 0, w: this.displayW, h: this.displayH };
    viewport.setStage(this.stage);
    viewport.setLogicalW(this.logicalW);
  }

  get screenWidth(): number { return this.logicalW; }
  get screenHeight(): number { return this.screenH; }
  /** 窗口物理 CSS 尺寸（仅 PostFX / 过渡动画用） */
  get displayWidth(): number { return this.displayW; }
  get displayHeight(): number { return this.displayH; }
  get currentScene(): Scene | null { return this.current; }
  /** 暴露逻辑分辨率供场景按需引用 */
  get logicalWidth(): number { return this.logicalW; }
  get logicalHeight(): number { return LOGICAL_H; }

  /**
   * 捕获当前显示画面快照（过渡动画用）
   * v4 修复：原 createCanvas() 复用 mainCanvas（即 displayCanvas 自身），
   * 后续 snap.width=... 会重置并清空显示画布，导致过渡动画时画面闪烁/丢失。
   * 改为直接 createElement 创建独立 canvas（与 createOffscreenCanvas 同模式）。
   */
  private snapshot(): GameCanvas {
    if (typeof document === "undefined") {
      // 非 DOM 环境：回退到 createCanvas（行为退化但不阻塞过渡）
      const snap = createCanvas();
      const sctx = snap.getContext("2d");
      sctx.drawImage(this.displayCanvas as unknown as CanvasImageSource, 0, 0);
      return snap;
    }
    const snap = document.createElement("canvas");
    snap.width = Math.max(1, this.displayCanvas.width);
    snap.height = Math.max(1, this.displayCanvas.height);
    const sctx = snap.getContext("2d");
    if (!sctx) {
      // 极端情况：上下文获取失败，返回空 canvas 避免崩溃
      return snap as unknown as GameCanvas;
    }
    sctx.drawImage(this.displayCanvas as unknown as CanvasImageSource, 0, 0);
    return snap as unknown as GameCanvas;
  }

  private beginTransition(kind: TransitionKind): void {
    if (kind === "none" || !this.current) {
      this.transition = null;
      return;
    }
    const duration = kind === "glitch" ? 0.5 : kind === "slide" ? 0.42 : 0.35;
    this.transition = { kind, t: 0, duration, snapshot: this.snapshot() };
  }

  /** 推入新场景（保留前一个场景在栈中） */
  push(scene: Scene, params?: Record<string, unknown>, transition: TransitionKind = "fade"): void {
    this.beginTransition(transition);
    if (this.current) this.sceneStack.push(this.current);
    this.current = scene;
    scene.enter(params);
  }

  /** 替换当前场景（不保留前一个） */
  replace(scene: Scene, params?: Record<string, unknown>, transition: TransitionKind = "fade"): void {
    this.beginTransition(transition);
    if (this.current) this.current.exit();
    this.current = scene;
    scene.enter(params);
  }

  /** 弹出当前场景，回到上一个 */
  pop(transition: TransitionKind = "fade"): void {
    this.beginTransition(transition);
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
    offHide(this.hideCb);
    offShow(this.showCb);
  }

  /** 创建离屏画布（供游戏引擎使用） */
  createOffscreenCanvas(): GameCanvas {
    // v3 修复：原 createCanvas() 复用 mainCanvas，会让引擎重置主显示画布尺寸。
    // 直接 createElement 返回独立 canvas（仅 DOM 端有效；引擎内部会用 ctx 绘制）
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = 480;
      return c as unknown as GameCanvas;
    }
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
   * 逻辑坐标 → 引擎画布本地坐标（contain 逆变换）
   * 输入坐标假定已经是逻辑坐标系内的值
   * （SceneDirector.dispatchTouch 已做窗口坐标 → 逻辑坐标的转换）
   */
  screenToLocal(x: number, y: number, canvasW: number, canvasH: number): { x: number; y: number } {
    const scale = Math.min(this.logicalW / canvasW, this.screenH / canvasH);
    const offsetX = (this.logicalW - canvasW * scale) / 2;
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

    // 主循环错误兜底：单帧 update/render 异常不致整个游戏卡死
    try {
      this.current.update(dt);
      // 场景渲染到离屏 sceneCanvas（自适应逻辑宽度 × 896 逻辑坐标系）
      // 清屏（透明）避免上一帧残留
      this.sceneCtx.clearRect(0, 0, this.logicalW, this.screenH);
      this.current.render(this.sceneCtx, this.logicalW, this.screenH);
    } catch (err) {
      this.handleLoopError("update/render", err);
      // 仍尝试合成画面，避免黑屏
    }

    try {
      // 合成显示画布
      // 1) 全屏底色
      this.displayCtx.fillStyle = Theme.colors.bg.deep;
      this.displayCtx.fillRect(0, 0, this.displayW, this.displayH);
      // 2) sceneCanvas contain 到舞台（全屏；超宽屏封顶时左右留少量深色边）
      this.blitSceneToStage();
      // 3) 全局后处理 FX（CRT/色差/glitch/屏闪/震屏/霓虹边框）
      postFX.update(dt);
      postFX.render(this.displayCtx, this.displayCanvas as unknown as CanvasImageSource);
      // 4) 场景过渡动画（在 postFX 之上叠加旧画面消退）
      this.renderTransition(dt);
      // 本帧无异常，重置连续错误计数
      this.errorStreak = 0;
    } catch (err) {
      this.handleLoopError("composite", err);
    }
  };

  /**
   * 把 sceneCanvas（logicalW×896）contain 缩放到舞台矩形
   * 桌面端逻辑宽度按宽高比自适应，多数情况铺满全屏无黑边；
   * 超宽屏封顶时左右留少量深色边（已由全屏底色覆盖）。
   */
  private blitSceneToStage(): void {
    const s = this.stage;
    if (s.w <= 0 || s.h <= 0) return;
    const srcW = this.logicalW;
    const srcH = LOGICAL_H;
    const scale = Math.min(s.w / srcW, s.h / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const offX = s.x + (s.w - drawW) / 2;
    const offY = s.y + (s.h - drawH) / 2;
    // blit
    this.displayCtx.drawImage(
      this.sceneCanvas as unknown as CanvasImageSource,
      offX, offY, drawW, drawH
    );
  }

  /**
   * 主循环异常熔断：连续异常超过阈值则停循环，避免刷屏报错
   */
  private handleLoopError(stage: string, err: unknown): void {
    this.errorStreak++;
    console.error(`[SceneDirector] loop error @ ${stage} (#${this.errorStreak})`, err);
    if (this.errorStreak > 60) {
      console.error("[SceneDirector] too many consecutive errors, stopping loop");
      this.running = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
    }
  }

  /** 过渡动画：新场景已实况渲染，旧快照在其上消退 */
  private renderTransition(dt: number): void {
    const tr = this.transition;
    if (!tr) return;
    tr.t += dt;
    const p = Math.min(1, tr.t / tr.duration);
    const ctx = this.displayCtx;
    // v3：过渡动画作用在 displayCanvas（窗口 CSS 像素空间）
    const w = this.displayW;
    const h = this.displayH;
    const snap = tr.snapshot as unknown as CanvasImageSource;

    ctx.save();
    if (tr.kind === "fade") {
      ctx.globalAlpha = 1 - Ease.quadOut(p);
      ctx.drawImage(snap, 0, 0, w, h);
    } else if (tr.kind === "slide") {
      const ease = Ease.cubicOut(p);
      ctx.drawImage(snap, -w * ease, 0, w, h);
      // 边缘霓虹光带
      const edgeX = w * (1 - ease);
      const grad = ctx.createLinearGradient(edgeX - 60, 0, edgeX, 0);
      grad.addColorStop(0, "rgba(0,229,255,0)");
      grad.addColorStop(1, `rgba(0,229,255,${0.35 * (1 - p)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(edgeX - 60, 0, 60, h);
    } else if (tr.kind === "glitch") {
      // 故障切片：旧画面切成横条随机错位，逐步透明
      const alpha = 1 - p;
      const slices = 14;
      const sliceH = h / slices;
      for (let i = 0; i < slices; i++) {
        const jitter = (Math.sin(i * 12.9898 + p * 40) * 43758.5453) % 1;
        const dx = jitter * 90 * (1 - p) * (i % 2 === 0 ? 1 : -1);
        ctx.globalAlpha = alpha * (0.4 + 0.6 * ((i * 7 + Math.floor(p * 10)) % 3) / 2);
        ctx.drawImage(
          snap,
          0, (i * sliceH) * this.dpr, this.displayCanvas.width, sliceH * this.dpr,
          dx, i * sliceH, w, sliceH
        );
      }
      // 扫描线闪烁
      if (p < 0.7) {
        ctx.globalAlpha = 0.12 * (1 - p);
        ctx.fillStyle = "#00E5FF";
        const bandY = ((p * 7) % 1) * h;
        ctx.fillRect(0, bandY, w, 3);
      }
    }
    ctx.restore();

    if (p >= 1) this.transition = null;
  }

  private dispatchTouch(type: "start" | "move" | "end", e: TTTouchEvent): void {
    if (!this.current) return;
    // 过渡动画期间吞掉输入，防误触
    if (this.transition && this.transition.t < this.transition.duration * 0.6) return;
    for (const t of e.changedTouches) {
      const id = t.identifier;
      // 将窗口 CSS 坐标 → 逻辑坐标（contain 逆变换）
      // 场景接收到的坐标恒为逻辑坐标系，与 director.screenWidth/screenHeight 一致
      const local = this.windowToLogical(t.clientX, t.clientY);
      if (type === "start") {
        // 新触摸开始，先让场景尝试消费
        const consumed = this.current.handleTouch("start", local.x, local.y, id);
        if (consumed) this.consumedTouchIds.add(id);
      } else if (type === "move") {
        if (this.consumedTouchIds.has(id)) {
          // 已消费的触摸，通知场景 move（用于按钮高亮等），但仍标记为消费
          this.current.handleTouch("move", local.x, local.y, id);
        }
        // 未消费的触摸由引擎 InputManager 处理（它自己监听了 tt.onTouchMove）
      } else if (type === "end") {
        if (this.consumedTouchIds.has(id)) {
          this.current.handleTouch("end", local.x, local.y, id);
          this.consumedTouchIds.delete(id);
        }
        // 未消费的触摸由引擎 InputManager 处理
      }
    }
  }

  /**
   * 窗口 CSS 坐标 → 逻辑坐标
   * 委托给 viewport 单例，与 InputManager.clientToEngineLocal 共享同一舞台变换，
   * 保证按钮命中（场景坐标系）与拖拽（引擎画布坐标系）一致。
   */
  windowToLogical(x: number, y: number): { x: number; y: number } {
    return viewport.clientToLogical(x, y);
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
