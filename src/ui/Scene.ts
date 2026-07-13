/**
 * 场景基类
 * 所有场景（Hub/Briefing/Game/Result）继承此类
 */
import type { SceneDirector } from "./SceneDirector";

export abstract class Scene {
  protected director: SceneDirector;
  /** 进入场景后经过的时间（秒），用于入场动画 */
  protected enterT = 0;

  constructor(director: SceneDirector) {
    this.director = director;
  }

  /** 进入场景时调用 */
  enter(params?: Record<string, unknown>): void {
    this.enterT = 0;
  }

  /** 离开场景时调用，清理资源 */
  exit(): void {}

  /** 每帧逻辑更新 */
  update(dt: number): void {
    this.enterT += dt;
  }

  /** 每帧渲染到显示画布（逻辑像素坐标系） */
  abstract render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void;

  /**
   * 触摸事件（坐标为屏幕逻辑像素）
   * @returns true 表示该触摸已被消费（加入 consumedTouchIds，引擎 InputManager 将忽略）
   */
  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    return false;
  }

  /** 暂停（小游戏切入后台时） */
  pause(): void {}

  /** 恢复（小游戏切回前台时） */
  resume(): void {}
}
