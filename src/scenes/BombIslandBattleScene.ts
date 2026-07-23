/**
 * 「诈园区」战斗场景（薄壳）
 * 引擎画布 960×540 横屏，引擎 InputManager 处理道具栏点击
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawToast } from "@/ui/widgets";
import { BombIslandEngine } from "@/games/bombIsland/engine";
import type { ParkHud } from "@/games/bombIsland/types";
import { setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import type { GameEvent, GameResultPayload } from "@/types";

export class BombIslandBattleScene extends GameShellScene {
  private engine: BombIslandEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private hud: ParkHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private t = 0;
  private pulse = 0;

  getGameTitle(): string { return "诈园区"; }
  getGameSubtitle(): string { return "SCAM PARK"; }
  getAccent(): string { return Theme.accents["bomb-island"]; }

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    setOrientation("landscape");
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new BombIslandEngine(canvas);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    // 由 updateGame/renderGame 同步驱动，消除双 RAF 撕裂闪烁
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      this.hud = e.payload as unknown as ParkHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 3 };
      this.toastTimer = 0;
    } else if (e.type === "result") {
      this.onResult(e.payload);
    }
  }

  private onResult(result: GameResultPayload): void {
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director)),
    });
  }

  private retry(): void {
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.spawnEngine();
  }

  pause(): void {
    super.pause();
    this.engine?.pause();
  }
  resume(): void {
    super.resume();
    this.engine?.resume();
  }

  protected updateGame(dt: number): void {
    // 同步驱动引擎 update（与场景同帧，杜绝撕裂）
    this.engine?.stepUpdate(dt);
    this.t += dt;
    this.pulse += dt;
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 3) this.toast = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 同步引擎暂停状态（覆盖用户按暂停按钮的场景）
    if (this.paused) this.engine?.pause();
    else this.engine?.resume();

    // 引擎画布 blit
    if (this.engineCanvas && this.engine) {
      // 同步驱动引擎渲染，确保 engineCanvas 在 blit 前已完成本帧绘制
      this.engine.stepRender();
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // 天气徽章（顶部中央）
    if (this.hud) {
      this.renderWeatherBadge(ctx, screenW);
    }

    // Toast
    if (this.toast) {
      const tw = screenW - 32;
      const th = 48;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "炮兵通讯");
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  /** 天气徽章：顶部中央，显示当前天气与影响 */
  private renderWeatherBadge(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const w = 220;
    const h = 32;
    const x = (screenW - w) / 2;
    const y = 14;
    const color = hud.weatherColor;
    ctx.save();
    // 背景
    ctx.fillStyle = "rgba(15, 34, 54, 0.88)";
    ctx.fillRect(x, y, w, h);
    // 边框（脉冲）
    const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 + pulse * 6;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    // 左侧标签条
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3, h);
    // emoji
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(hud.weatherEmoji, x + 10, y + h / 2 + 1);
    // 名称
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.fillText(`天气 · ${hud.weatherName}`, x + 34, y + h / 2);
    ctx.shadowBlur = 0;
    // 描述
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#FFFFFF", 0.7);
    ctx.fillText(hud.weatherDesc, x + 100, y + h / 2 + 1);
    ctx.restore();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    // 无外壳级触摸处理 — 交给引擎 InputManager 处理道具栏点击
    return false;
  }

  exit(): void {
    super.exit();
    setOrientation("portrait");
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.engineCanvas = null;
    this.resultOverlay = null;
  }
}
