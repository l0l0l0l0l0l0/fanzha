/**
 * 任务简报场景
 * 3 秒倒计时后自动进入游戏
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton,
  drawHudLabel, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon, drawLogo } from "@/ui/icons";
import { getGame } from "@/data/games";
import { playSfx } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import type { GameId } from "@/types";
import { FraudBusterScene } from "./FraudBusterScene";
import { ManagerDeployScene } from "./ManagerDeployScene";
import { ThunderScene } from "./ThunderScene";
import { BombIslandBattleScene } from "./BombIslandBattleScene";

const GAME_SCENE_FACTORIES: Record<GameId, (d: SceneDirector) => Scene> = {
  "fraud-buster": (d) => new FraudBusterScene(d),
  manager: (d) => new ManagerDeployScene(d),
  thunder: (d) => new ThunderScene(d),
  "bomb-island": (d) => new BombIslandBattleScene(d),
};

export class BriefingScene extends Scene {
  private gameId: GameId | null = null;
  private countdown = 3;
  private countdownTimer = 0;
  private entered = false;
  private pressedButton: string | null = null;
  private flashedFinalCountdown = false;

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    this.gameId = (params?.gameId as GameId) ?? null;
    this.countdown = 3;
    this.countdownTimer = 0;
    this.entered = false;
    this.flashedFinalCountdown = false;
  }

  update(dt: number): void {
    super.update(dt);
    if (this.entered || !this.gameId) return;
    this.countdownTimer += dt;
    // 倒计时最后 1 秒：警告闪屏
    if (this.countdown <= 1 && !this.flashedFinalCountdown) {
      this.flashedFinalCountdown = true;
      postFX.flash(Theme.colors.warn.DEFAULT, 0.15, 3);
    }
    if (this.countdownTimer >= 1) {
      this.countdownTimer -= 1;
      this.countdown -= 1;
      playSfx("tick");
      if (this.countdown <= 0) {
        this.entered = true;
        this.enterGame();
      }
    }
  }

  private enterGame(): void {
    if (!this.gameId) return;
    const scene = GAME_SCENE_FACTORIES[this.gameId](this.director);
    this.director.replace(scene);
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const game = this.gameId ? getGame(this.gameId) : null;
    if (!game) return;
    const accent = game.accent;
    // 入场动画：淡入 + 上移
    const t = Math.min(1, this.enterT * 2.5);
    const slideY = 40 * (1 - t);

    drawBackground(ctx, screenW, screenH);

    // 径向光晕
    ctx.save();
    const grad = ctx.createRadialGradient(screenW / 2, screenH / 2, 0, screenW / 2, screenH / 2, screenH * 0.6);
    grad.addColorStop(0, game.accentSoft);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    // 入场淡入包裹
    ctx.save();
    ctx.globalAlpha = t;
    ctx.translate(0, slideY);

    // 顶部导航栏
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.85)";
    ctx.fillRect(0, 0, screenW, 56);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, 55, screenW, 1);
    ctx.restore();

    // 返回按钮
    const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 12, backBtn.y + 8, 16, Theme.colors.ink.muted);
    drawHudLabel(ctx, backBtn.x + 32, backBtn.y + 11, "Hub");

    // Logo
    drawLogo(ctx, screenW / 2 - 16, 12, 32, false);

    // 倒计时
    ctx.save();
    ctx.font = `400 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.countdown <= 1 ? Theme.colors.warn.DEFAULT : Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`T-${String(this.countdown).padStart(2, "0")}`, screenW - 16, 28);
    ctx.restore();

    // 简报面板
    const pad = 20;
    const panelW = screenW - pad * 2;
    const panelX = pad;
    const panelY = 80;
    const panelH = screenH - panelY - 40;
    drawPanel(ctx, panelX, panelY, panelW, panelH, { borderColor: withAlpha(accent, 0.5), cut: 10 });

    // 顶部渐变线
    ctx.save();
    const lineGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
    lineGrad.addColorStop(0, "transparent");
    lineGrad.addColorStop(0.5, accent);
    lineGrad.addColorStop(1, "transparent");
    ctx.fillStyle = lineGrad;
    ctx.fillRect(panelX, panelY, panelW, 1);
    ctx.restore();

    let y = panelY + 20;

    // 任务标识
    const iconBox = 48;
    ctx.save();
    ctx.fillStyle = withAlpha(accent, 0.15);
    ctx.fillRect(panelX + 20, y, iconBox, iconBox);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 20, y, iconBox, iconBox);
    ctx.shadowColor = withAlpha(accent, 0.5);
    ctx.shadowBlur = 12;
    ctx.strokeRect(panelX + 20, y, iconBox, iconBox);
    ctx.restore();
    drawIcon(ctx, "alert", panelX + 20 + 12, y + 12, 24, accent);

    drawHudLabel(ctx, panelX + 80, y + 6, `MISSION BRIEFING · ${game.subtitle}`, Theme.colors.ink.muted);
    ctx.save();
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(game.title, panelX + 80, y + 22);
    ctx.restore();

    // 右上角水印：96110 反诈专线标识
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.warn.DEFAULT, 0.55);
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(Theme.colors.warn.DEFAULT, 0.3);
    ctx.shadowBlur = 6;
    ctx.fillText("☎ 96110 反诈专线", panelX + panelW - 16, y + 8);
    ctx.shadowBlur = 0;
    // 下方小字：来源标注
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.dim, 0.7);
    ctx.fillText("遇诈即拨 · 全天 24h", panelX + panelW - 16, y + 24);
    ctx.restore();

    y += iconBox + 20;

    // 描述
    ctx.save();
    ctx.font = `400 13px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.drawWrappedText(ctx, game.description, panelX + 20, y, panelW - 40, 18);
    y += 60;
    ctx.restore();

    // 反诈简报
    ctx.save();
    ctx.fillStyle = withAlpha(accent, 0.05);
    ctx.fillRect(panelX + 20, y, panelW - 40, 20 + game.briefing.points.length * 24);
    ctx.fillStyle = accent;
    ctx.fillRect(panelX + 20, y, 4, 20 + game.briefing.points.length * 24);
    ctx.restore();

    drawHudLabel(ctx, panelX + 32, y + 6, `▸ 反诈简报 · ${game.briefing.type}`, accent);
    y += 28;
    for (let i = 0; i < game.briefing.points.length; i++) {
      ctx.save();
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = accent;
      ctx.font = `400 11px ${Theme.fonts.mono}`;
      ctx.fillText(String(i + 1).padStart(2, "0"), panelX + 32, y);
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillText(game.briefing.points[i], panelX + 60, y);
      ctx.restore();
      y += 24;
    }
    y += 16;

    // 热线
    ctx.save();
    ctx.fillStyle = withAlpha(Theme.colors.warn.DEFAULT, 0.1);
    ctx.fillRect(panelX + 20, y, panelW - 40, 40);
    ctx.strokeStyle = withAlpha(Theme.colors.warn.DEFAULT, 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 20, y, panelW - 40, 40);
    ctx.restore();
    drawIcon(ctx, "phone", panelX + 28, y + 12, 16, Theme.colors.warn.DEFAULT);
    drawHudLabel(ctx, panelX + 52, y + 8, "紧急热线", Theme.colors.ink.muted);
    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.warn.DEFAULT;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(game.briefing.hotline, panelX + panelW - 28, y + 10);
    ctx.restore();
    y += 56;

    // 进入按钮
    const btnW = panelW - 40;
    const btnH = 44;
    const enterBtn: Rect = { x: panelX + 20, y: y, w: btnW, h: btnH };
    drawButton(ctx, enterBtn.x, enterBtn.y, enterBtn.w, enterBtn.h, "进入战场", {
      variant: "primary",
      accent: accent,
      pressed: this.pressedButton === "enter",
      subText: `ENTER ${game.subtitle}`,
    });

    // 水印级反诈装饰横幅：F01-F70 代表性 emoji + 反诈标语
    ctx.save();
    const watermarkY = y + btnH + 18;
    // 居中反诈 emoji 横幅（取图鉴中代表性图标）
    ctx.font = `18px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.dim, 0.45);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const emojis = "🚔 🐷 💰 📞 📈 👤 📜 🎮 🎁 🔞 🤖 🚑 🤲 ⌨ 💕 🧧 🎫 🪖 🪙 🛠 🪪 🎓";
    ctx.fillText(emojis, screenW / 2, watermarkY);
    // 下方小字：反诈口号
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.5);
    ctx.fillText("// F01-F70 · 全民反诈 · 天下无诈 //", screenW / 2, watermarkY + 18);
    ctx.restore();

    // 关闭入场淡入包裹
    ctx.restore();
  }

  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number, maxWidth: number, lineHeight: number
  ): void {
    const chars = text.split("");
    let line = "";
    let yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = ch;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
    const pad = 20;
    const panelW = screenW - pad * 2;
    const panelY = 80;
    const enterBtnY = panelY + 20 + 48 + 20 + 60 + 28 + 3 * 24 + 16 + 56;
    const enterBtn: Rect = { x: pad + 20, y: enterBtnY, w: panelW - 40, h: 44 };

    if (type === "start") {
      if (hitTest(x, y, backBtn)) {
        this.pressedButton = "back";
        return true;
      }
      if (hitTest(x, y, enterBtn)) {
        this.pressedButton = "enter";
        return true;
      }
      return false;
    } else if (type === "end") {
      if (this.pressedButton === "back" && hitTest(x, y, backBtn)) {
        playSfx("click");
        this.director.pop();
      } else if (this.pressedButton === "enter" && hitTest(x, y, enterBtn)) {
        playSfx("click");
        this.entered = true;
        this.enterGame();
      }
      this.pressedButton = null;
      return true;
    }
    return false;
  }
}
