import type { GameEvent } from "@/types";
import type { GameCanvas } from "@/platform/web";

type Handler = (e: GameEvent) => void;

export abstract class GameEngine {
  protected canvas: GameCanvas;
  protected ctx: CanvasRenderingContext2D;
  protected running = false;
  private paused = false;
  private lastTs = 0;
  private rafId = 0;
  private handlers = new Set<Handler>();
  private destroyHandlers: (() => void)[] = [];

  constructor(canvas: GameCanvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  pause(): void {
    this.paused = true;
  }
  resume(): void {
    if (this.paused) {
      this.paused = false;
      this.lastTs = performance.now();
    }
  }
  get isPaused() {
    return this.paused;
  }

  destroy(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.handlers.clear();
    this.destroyHandlers.forEach((fn) => fn());
    this.destroyHandlers = [];
  }

  on(fn: Handler): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  protected emit(e: GameEvent): void {
    this.handlers.forEach((h) => h(e));
  }

  protected addDestroy(fn: () => void): void {
    this.destroyHandlers.push(fn);
  }

  protected abstract update(dt: number): void;
  protected abstract render(): void;

  private loop = (ts: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (this.paused) {
      this.lastTs = ts;
      return;
    }
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.update(dt);
    this.render();
  };
}
