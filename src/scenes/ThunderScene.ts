/**
 * 「雷霆反诈」游戏场景
 * 引擎画布 540×960 竖屏，引擎 InputManager 处理飞船拖拽
 * Scene 负责炸弹按钮（consumedTouchIds 防冲突）+ Boss HP 条 + 结算
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawButton, drawProgressBar, drawToast, hitTest, type Rect } from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { ThunderEngine } from "@/games/thunder/engine";
import type { ThunderHud } from "@/games/thunder/types";
import { playSfx } from "@/engine/Audio";
import { vibrateShort } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import type { GameEvent, GameResultPayload } from "@/types";

export class ThunderScene extends GameShellScene {
  private engine: ThunderEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private hud: ThunderHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedBomb = false;
  private t = 0;

  getGameTitle(): string { return "雷霆反诈"; }
  getGameSubtitle(): string { return "THUNDER"; }
  getAccent(): string { return Theme.accents.thunder; }

  enter(): void {
    super.enter();
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new ThunderEngine(canvas);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    engine.start();
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      this.hud = e.payload as unknown as ThunderHud;
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

  protected updateGame(dt: number): void {
    this.t += dt;
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 3) this.toast = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  private getBombButtonRect(screenW: number, screenH: number): Rect {
    return { x: screenW - 76, y: screenH - 24 - 64 - 12, w: 64, h: 64 };
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.engineCanvas && this.engine) {
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // Boss HP 条
    if (this.hud && this.hud.phase === "boss" && this.hud.bossHp !== undefined && this.hud.bossMax) {
      this.renderBossBar(ctx, screenW);
    }

    // 状态信息
    if (this.hud) {
      this.renderStats(ctx, screenW);
    }

    // 炸弹按钮
    const bombBtn = this.getBombButtonRect(screenW, screenH);
    const bombs = this.hud?.bombs ?? 0;
    drawButton(ctx, bombBtn.x, bombBtn.y, bombBtn.w, bombBtn.h, "", {
      variant: "hard", accent: bombs > 0 ? Theme.colors.warn.DEFAULT : Theme.colors.bg.line,
      pressed: this.pressedBomb,
    });
    drawIcon(ctx, "bomb", bombBtn.x + bombBtn.w / 2 - 12, bombBtn.y + 10, 24,
      bombs > 0 ? Theme.colors.warn.DEFAULT : Theme.colors.ink.dim);
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = bombs > 0 ? Theme.colors.warn.DEFAULT : Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`×${bombs}`, bombBtn.x + bombBtn.w / 2, bombBtn.y + bombBtn.h - 14);
    ctx.restore();

    // Toast
    if (this.toast) {
      const tw = screenW - 32;
      const th = 56;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "战机通讯");
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  private renderBossBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const barY = 52;
    const barW = screenW - 32;
    const barH = 12;
    const ratio = (hud.bossHp ?? 0) / (hud.bossMax ?? 1);
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.warn.glow;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`BOSS · 假警察局长 · 阶段 ${hud.bossPhase ?? 1}/3`, 16, barY - 14);
    ctx.restore();
    drawProgressBar(ctx, 16, barY, barW, barH, ratio, Theme.colors.warn.DEFAULT);
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 52;
    ctx.save();
    // 生命
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("LIVES", 16, y);
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = hud.lives <= 1 ? Theme.colors.warn.DEFAULT : Theme.colors.safe.DEFAULT;
    ctx.fillText("♥".repeat(Math.max(0, hud.lives)), 16, y + 14);
    // 分数
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.fillText("SCORE", screenW / 2, y);
    ctx.font = `700 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.getAccent();
    ctx.shadowColor = withAlpha(this.getAccent(), 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(`${hud.score}`, screenW / 2, y + 14);
    ctx.shadowBlur = 0;
    // 波次
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText("WAVE", screenW - 16, y);
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(`${hud.wave}/${hud.totalWaves}`, screenW - 16, y + 14);
    ctx.restore();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const bombBtn = this.getBombButtonRect(screenW, screenH);

    if (type === "start") {
      if (hitTest(x, y, bombBtn)) {
        this.pressedBomb = true;
        return true; // 消费 touch，防止 InputManager 拖拽
      }
      return false; // 未命中按钮，交给引擎 InputManager 处理拖拽
    } else if (type === "end") {
      if (this.pressedBomb && hitTest(x, y, bombBtn)) {
        this.engine?.useBomb();
        playSfx("click");
        vibrateShort();
      }
      this.pressedBomb = false;
      return true;
    }
    return false;
  }

  exit(): void {
    super.exit();
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.engineCanvas = null;
    this.resultOverlay = null;
  }
}
