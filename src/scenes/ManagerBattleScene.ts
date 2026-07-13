/**
 * 「反诈职业经理人」战斗阶段
 * 引擎画布 960×540 横屏，进入时 setOrientation("landscape")
 * Scene 负责大招按钮 + 重新部署 + 结算
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawButton, drawProgressBar, drawToast, hitTest, type Rect } from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { ManagerEngine } from "@/games/manager/engine";
import type { ManagerHud, DeploySlot } from "@/games/manager/types";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { ManagerDeployScene } from "./ManagerDeployScene";
import { HubScene } from "./HubScene";
import type { GameEvent, GameResultPayload } from "@/types";

export class ManagerBattleScene extends GameShellScene {
  private engine: ManagerEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private deployment: DeploySlot[] = [];
  private hud: ManagerHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedUlt = false;
  private pressedRedeploy = false;
  private t = 0;
  private pulse = 0;

  getGameTitle(): string { return "反诈职业经理人"; }
  getGameSubtitle(): string { return "MANAGER"; }
  getAccent(): string { return Theme.accents.manager; }

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    this.deployment = (params?.deployment as DeploySlot[]) ?? [];
    setOrientation("landscape");
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new ManagerEngine(canvas, this.deployment);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    engine.start();
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      this.hud = e.payload as unknown as ManagerHud;
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
    this.pulse += dt;
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 3) this.toast = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  private getUltButtonRect(screenW: number, screenH: number): Rect {
    return { x: screenW - 100, y: screenH - 24 - 56 - 12, w: 84, h: 56 };
  }

  private getRedeployButtonRect(screenW: number, screenH: number): Rect {
    return { x: 16, y: screenH - 24 - 56 - 12, w: 84, h: 56 };
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.engineCanvas && this.engine) {
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // 顶部状态
    if (this.hud) {
      this.renderStats(ctx, screenW);
    }

    // 大招按钮
    const ultBtn = this.getUltButtonRect(screenW, screenH);
    const ultReady = this.hud?.ultReady ?? false;
    drawButton(ctx, ultBtn.x, ultBtn.y, ultBtn.w, ultBtn.h, "大招", {
      variant: ultReady ? "primary" : "ghost",
      accent: this.getAccent(),
      pressed: this.pressedUlt,
    });
    if (ultReady) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 4);
      ctx.strokeStyle = withAlpha(this.getAccent(), pulse);
      ctx.lineWidth = 2;
      ctx.shadowColor = this.getAccent();
      ctx.shadowBlur = 12;
      ctx.strokeRect(ultBtn.x, ultBtn.y, ultBtn.w, ultBtn.h);
      ctx.restore();
    }

    // 重新部署按钮
    const redeployBtn = this.getRedeployButtonRect(screenW, screenH);
    drawButton(ctx, redeployBtn.x, redeployBtn.y, redeployBtn.w, redeployBtn.h, "重部署", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedRedeploy,
    });
    drawIcon(ctx, "rotate", redeployBtn.x + redeployBtn.w - 16, redeployBtn.y + 6, 12, Theme.colors.ink.muted);

    // Toast
    if (this.toast) {
      const tw = screenW - 32;
      const th = 48;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "指挥通讯");
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 52;
    ctx.save();
    // 基地 HP
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("基地", 16, y);
    drawProgressBar(ctx, 16, y + 14, 120, 10, hud.baseHp / hud.baseMax,
      hud.baseHp / hud.baseMax < 0.3 ? Theme.colors.warn.DEFAULT : Theme.colors.safe.DEFAULT);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${hud.baseHp}/${hud.baseMax}`, 142, y + 14);

    // 波次
    ctx.textAlign = "center";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("WAVE", screenW / 2, y);
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.getAccent();
    ctx.shadowColor = withAlpha(this.getAccent(), 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(`${hud.wave}/${hud.totalWaves}`, screenW / 2, y + 14);
    ctx.shadowBlur = 0;

    // 能量
    ctx.textAlign = "right";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("能量", screenW - 16, y);
    drawProgressBar(ctx, screenW - 136, y + 14, 120, 10, hud.energy / 100, this.getAccent());
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = hud.ultReady ? this.getAccent() : Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText(`${Math.floor(hud.energy)}%`, screenW - 16, y + 26);

    // 分数
    ctx.textAlign = "left";
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`SCORE ${hud.score} · 敌 ${hud.enemiesLeft}`, 16, y + 28);
    ctx.restore();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const ultBtn = this.getUltButtonRect(screenW, screenH);
    const redeployBtn = this.getRedeployButtonRect(screenW, screenH);

    if (type === "start") {
      if (hitTest(x, y, ultBtn)) { this.pressedUlt = true; return true; }
      if (hitTest(x, y, redeployBtn)) { this.pressedRedeploy = true; return true; }
      return false;
    } else if (type === "end") {
      if (this.pressedUlt && hitTest(x, y, ultBtn)) {
        this.engine?.triggerUlt();
        playSfx("click");
        vibrateShort();
      } else if (this.pressedRedeploy && hitTest(x, y, redeployBtn)) {
        playSfx("click");
        setOrientation("portrait");
        this.director.replace(new ManagerDeployScene(this.director));
      }
      this.pressedUlt = false;
      this.pressedRedeploy = false;
      return true;
    }
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
