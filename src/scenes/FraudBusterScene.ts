/**
 * 「是男人就反诈」游戏场景
 * 引擎画布 480×800 竖屏，Scene 负责按钮判断 + Toast + 结算
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawButton, drawToast, hitTest, type Rect } from "@/ui/widgets";
import { FraudBusterEngine } from "@/games/fraudBuster/engine";
import { playSfx } from "@/engine/Audio";
import { vibrateShort } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import type { GameEvent, GameResultPayload } from "@/types";

interface FBHud {
  wave: number;
  score: number;
  combo: number;
  shield: number;
  busted: number;
  rank: string;
}

export class FraudBusterScene extends GameShellScene {
  private engine: FraudBusterEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private hud: FBHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedBtn: "fraud" | "pass" | null = null;
  private t = 0;

  getGameTitle(): string { return "是男人就反诈"; }
  getGameSubtitle(): string { return "FRAUD BUSTER"; }
  getAccent(): string { return Theme.accents["fraud-buster"]; }

  enter(): void {
    super.enter();
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new FraudBusterEngine(canvas);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    engine.start();
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      this.hud = e.payload as unknown as FBHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 2.5 };
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
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.spawnEngine();
  }

  protected updateGame(dt: number): void {
    this.t += dt;
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 2.5) this.toast = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.engineCanvas && this.engine) {
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // 顶部 HUD 信息（波数/分数/护盾）
    if (this.hud) {
      this.renderStats(ctx, screenW);
    }

    // 底部双按钮（避开底部权威条 24px）
    const btnY = screenH - 24 - 56 - 12;
    const btnW = (screenW - 16 * 3) / 2;
    const fraudBtn: Rect = { x: 16, y: btnY, w: btnW, h: 56 };
    const passBtn: Rect = { x: 16 * 2 + btnW, y: btnY, w: btnW, h: 56 };

    drawButton(ctx, fraudBtn.x, fraudBtn.y, fraudBtn.w, fraudBtn.h, "举报", {
      variant: "danger", pressed: this.pressedBtn === "fraud", subText: "REPORT · 是诈骗",
    });
    drawButton(ctx, passBtn.x, passBtn.y, passBtn.w, passBtn.h, "通过", {
      variant: "hard", accent: Theme.colors.safe.DEFAULT,
      pressed: this.pressedBtn === "pass", subText: "PASS · 不是诈骗",
    });

    // Toast
    if (this.toast) {
      const tw = screenW - 32;
      const th = 56;
      const ty = 60;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "反诈提示");
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 56;
    ctx.save();
    // 波数
    ctx.font = `700 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.getAccent();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(this.getAccent(), 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(`WAVE ${hud.wave}`, 16, y);
    ctx.shadowBlur = 0;
    // 分数
    ctx.font = `400 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`SCORE`, 16, y + 24);
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(`${hud.score}`, 60, y + 22);
    // 护盾
    ctx.textAlign = "right";
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("SHIELD", screenW - 16, y + 4);
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = hud.shield <= 1 ? Theme.colors.warn.DEFAULT : Theme.colors.flag.DEFAULT;
    ctx.fillText("♥".repeat(Math.max(0, hud.shield)), screenW - 16, y + 20);
    // 连击
    if (hud.combo > 1) {
      ctx.textAlign = "center";
      ctx.font = `700 14px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.flag.DEFAULT;
      ctx.fillText(`×${hud.combo} COMBO`, screenW / 2, y + 8);
    }
    ctx.restore();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    // 结算时全屏消费
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }

    const screenH = this.director.screenHeight;
    const screenW = this.director.screenWidth;
    const btnY = screenH - 24 - 56 - 12;
    const btnW = (screenW - 16 * 3) / 2;
    const fraudBtn: Rect = { x: 16, y: btnY, w: btnW, h: 56 };
    const passBtn: Rect = { x: 16 * 2 + btnW, y: btnY, w: btnW, h: 56 };

    if (type === "start") {
      if (hitTest(x, y, fraudBtn)) { this.pressedBtn = "fraud"; return true; }
      if (hitTest(x, y, passBtn)) { this.pressedBtn = "pass"; return true; }
      return false;
    } else if (type === "end") {
      if (this.pressedBtn === "fraud" && hitTest(x, y, fraudBtn)) {
        this.engine?.judge("fraud");
        playSfx("click");
        vibrateShort();
      } else if (this.pressedBtn === "pass" && hitTest(x, y, passBtn)) {
        this.engine?.judge("pass");
        playSfx("click");
        vibrateShort();
      }
      this.pressedBtn = null;
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
