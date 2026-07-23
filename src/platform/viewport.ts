/**
 * 视口舞台状态 · 自适应逻辑分辨率
 *
 * 由 SceneDirector 在 resize 时写入舞台矩形（CSS px）与逻辑宽度，供：
 *  - SceneDirector.dispatchTouch：窗口 CSS → 逻辑坐标
 *  - InputManager.toLocal：窗口 CSS → 引擎画布本地坐标（复合变换）
 *
 * 设计要点：
 *  - 引擎画布（如 960×540）恒通过 director.blitContain 引擎→逻辑空间全量铺满
 *  - 手机端：逻辑宽度 = 414，舞台 = 整个窗口（原行为不变）
 *  - 桌面端：逻辑宽度按显示器宽高比自适应（414..1600），舞台铺满全屏，
 *    游戏界面真正适配 PC 宽屏，不再中间竖屏窄条 + 两侧空置
 */

export interface StageRect {
  /** 舞台在窗口 CSS 坐标系中的位置与尺寸 */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 固定逻辑高度（所有场景的纵向布局基准，恒定不变） */
export const LOGICAL_H = 896;
/** 手机端基础逻辑宽度 */
export const BASE_LOGICAL_W = 414;
/** 桌面端自适应逻辑宽度上限（防止超宽屏画布爆内存） */
export const MAX_LOGICAL_W = 1600;

class ViewportState {
  private stage: StageRect = { x: 0, y: 0, w: 1, h: 1 };
  /** 当前逻辑宽度（桌面端自适应，手机端 = 414） */
  private logicalW = BASE_LOGICAL_W;

  setStage(s: StageRect): void {
    this.stage = s;
  }

  getStage(): StageRect {
    return this.stage;
  }

  setLogicalW(w: number): void {
    this.logicalW = w;
  }

  getLogicalW(): number {
    return this.logicalW;
  }

  /** 窗口 CSS 坐标 → 逻辑坐标（contain 逆变换，含舞台偏移） */
  clientToLogical(x: number, y: number): { x: number; y: number } {
    const s = this.stage;
    if (s.w <= 0 || s.h <= 0) return { x: 0, y: 0 };
    const scale = Math.min(s.w / this.logicalW, s.h / LOGICAL_H);
    if (scale <= 0) return { x: 0, y: 0 };
    const drawW = this.logicalW * scale;
    const drawH = LOGICAL_H * scale;
    const offX = s.x + (s.w - drawW) / 2;
    const offY = s.y + (s.h - drawH) / 2;
    return { x: (x - offX) / scale, y: (y - offY) / scale };
  }

  /**
   * 窗口 CSS 坐标 → 引擎画布本地坐标
   * 复合变换：client → 逻辑空间 → 引擎画布 contain 逆变换
   * （引擎画布恒 contain 铺满逻辑空间）
   */
  clientToEngineLocal(
    x: number,
    y: number,
    canvasW: number,
    canvasH: number
  ): { x: number; y: number } {
    const logical = this.clientToLogical(x, y);
    if (canvasW <= 0 || canvasH <= 0) return { x: 0, y: 0 };
    const scale = Math.min(this.logicalW / canvasW, LOGICAL_H / canvasH);
    if (scale <= 0) return { x: 0, y: 0 };
    const drawW = canvasW * scale;
    const drawH = canvasH * scale;
    const offX = (this.logicalW - drawW) / 2;
    const offY = (LOGICAL_H - drawH) / 2;
    return { x: (logical.x - offX) / scale, y: (logical.y - offY) / scale };
  }
}

export const viewport = new ViewportState();

/**
 * 判定是否启用桌面/宽屏布局（自适应宽逻辑 + 全屏舞台）
 * - 横屏或近方形视口（宽 ≥ 高 × 0.9）且宽度足够时启用
 * - 竖屏手机（宽 < 高 × 0.9）保持 414 全屏铺满
 */
export function isDesktopLayout(displayW: number, displayH: number): boolean {
  return displayH > 0 && displayW >= displayH * 0.9 && displayW > 520;
}

/**
 * 计算桌面端自适应逻辑宽度
 * 按显示器宽高比推导，使场景画布比例与屏幕一致，铺满无黑边；
 * 超宽屏时封顶 MAX_LOGICAL_W 防止画布过大。
 */
export function computeDesktopLogicalW(displayW: number, displayH: number): number {
  if (displayH <= 0) return BASE_LOGICAL_W;
  const w = Math.round(LOGICAL_H * (displayW / displayH));
  return Math.max(BASE_LOGICAL_W, Math.min(w, MAX_LOGICAL_W));
}
