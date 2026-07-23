import type { GameEngine } from "./GameEngine";
import type { GameCanvas } from "@/platform/web";
import {
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  offTouchStart,
  offTouchMove,
  offTouchEnd,
  offTouchCancel,
} from "@/platform/web";
import { viewport } from "@/platform/viewport";
import { consumedTouchIds } from "./touchState";

export interface Pointer {
  x: number;
  y: number;
  down: boolean;
}

export class InputManager {
  private canvas: GameCanvas;
  private pointers = new Map<number, Pointer>();
  private onClick?: (x: number, y: number) => void;
  private onDoubleClick?: (x: number, y: number) => void;
  private onDrag?: (x: number, y: number, dx: number, dy: number, id: number) => void;
  private lastClickTs = 0;
  private bound = false;
  private startCb: (e: any) => void;
  private moveCb: (e: any) => void;
  private endCb: (e: any) => void;
  private cancelCb: (e: any) => void;

  constructor(canvas: GameCanvas) {
    this.canvas = canvas;
    this.startCb = () => {};
    this.moveCb = () => {};
    this.endCb = () => {};
    this.cancelCb = () => {};
  }

  attach(_engine: GameEngine): void {
    if (!this.bound) {
      this.bind();
      this.bound = true;
    }
  }

  setHandlers(opts: {
    onClick?: (x: number, y: number) => void;
    onDoubleClick?: (x: number, y: number) => void;
    onDrag?: (x: number, y: number, dx: number, dy: number, id: number) => void;
  }): void {
    this.onClick = opts.onClick;
    this.onDoubleClick = opts.onDoubleClick;
    this.onDrag = opts.onDrag;
  }

  getPos(id = 0): Pointer | undefined {
    return this.pointers.get(id);
  }

  destroy(): void {
    if (this.bound) {
      offTouchStart(this.startCb);
      offTouchMove(this.moveCb);
      offTouchEnd(this.endCb);
      offTouchCancel(this.cancelCb);
      this.bound = false;
    }
    this.pointers.clear();
  }

  /**
   * 窗口 CSS 坐标 → 引擎画布本地坐标（复合 letterbox 逆变换）
   * 委托给 viewport 单例，正确处理桌面端居中竖屏舞台：
   *   client → 414×896 逻辑（舞台 contain 逆变换）→ 引擎画布（414×896 contain 逆变换）
   * 手机端舞台 = 全屏，退化为原单级 contain，行为不变。
   */
  private toLocal(clientX: number, clientY: number): { x: number; y: number } {
    return viewport.clientToEngineLocal(
      clientX,
      clientY,
      this.canvas.width,
      this.canvas.height
    );
  }

  private bind(): void {
    this.startCb = (e: any) => {
      for (const t of e.changedTouches) {
        if (consumedTouchIds.has(t.identifier)) continue;
        const { x, y } = this.toLocal(t.clientX, t.clientY);
        this.pointers.set(t.identifier, { x, y, down: true });
      }
    };
    this.moveCb = (e: any) => {
      for (const t of e.changedTouches) {
        if (consumedTouchIds.has(t.identifier)) continue;
        const p = this.pointers.get(t.identifier);
        if (!p) continue;
        const { x, y } = this.toLocal(t.clientX, t.clientY);
        const dx = x - p.x;
        const dy = y - p.y;
        p.x = x;
        p.y = y;
        if (p.down && this.onDrag) this.onDrag(x, y, dx, dy, t.identifier);
      }
    };
    this.endCb = (e: any) => {
      for (const t of e.changedTouches) {
        if (consumedTouchIds.has(t.identifier)) continue;
        const p = this.pointers.get(t.identifier);
        if (!p) continue;
        const { x, y } = this.toLocal(t.clientX, t.clientY);
        if (p.down && this.onClick) {
          this.onClick(x, y);
          const now = performance.now();
          if (now - this.lastClickTs < 280 && this.onDoubleClick) {
            this.onDoubleClick(x, y);
          }
          this.lastClickTs = now;
        }
        this.pointers.delete(t.identifier);
      }
    };
    this.cancelCb = (e: any) => {
      for (const t of e.changedTouches) {
        this.pointers.delete(t.identifier);
      }
    };

    onTouchStart(this.startCb);
    onTouchMove(this.moveCb);
    onTouchEnd(this.endCb);
    onTouchCancel(this.cancelCb);
  }
}
