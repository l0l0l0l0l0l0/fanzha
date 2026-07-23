/**
 * 启动画面（Boot / Splash）
 * 盾牌 Logo 充能动画 + 故障字标题 + 进度条，约 2.4s 后进入 Hub
 * 点击可跳过
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import { Ease } from "@/engine/easing";
import { drawBackground, drawScanlineOverlay } from "@/ui/widgets";
import { drawLogo } from "@/ui/icons";
import { HubScene } from "./HubScene";

const BOOT_DURATION = 2.4;

export class BootScene extends Scene {
  private t = 0;
  private done = false;

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.t >= BOOT_DURATION && !this.done) {
      this.done = true;
      this.director.replace(new HubScene(this.director), undefined, "glitch");
    }
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);
    const cx = screenW / 2;
    const cy = screenH / 2 - 40;
    const p = Math.min(1, this.t / BOOT_DURATION);

    // Logo 充能入场
    const logoP = Math.min(1, this.t / 0.7);
    const logoScale = Ease.backOut(logoP);
    const logoSize = 96;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(logoScale, logoScale);
    // 充能光环
    const ringP = (this.t * 1.5) % 1;
    ctx.globalAlpha = (1 - ringP) * 0.5;
    ctx.strokeStyle = Theme.colors.neon.DEFAULT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, logoSize * 0.6 + ringP * 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawLogo(ctx, -logoSize / 2, -logoSize / 2, logoSize, false);
    ctx.restore();

    // 标题（故障抖动入场）
    if (this.t > 0.4) {
      const titleP = Math.min(1, (this.t - 0.4) / 0.5);
      const glitch = titleP < 1 ? (Math.random() - 0.5) * 4 * (1 - titleP) : 0;
      ctx.save();
      ctx.globalAlpha = titleP;
      ctx.font = `700 34px ${Theme.fonts.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // 色散重影
      if (titleP < 1) {
        ctx.fillStyle = "rgba(229,53,59,0.6)";
        ctx.fillText("反诈游戏平台", cx + glitch + 2, cy + 78);
        ctx.fillStyle = "rgba(0,229,255,0.6)";
        ctx.fillText("反诈游戏平台", cx + glitch - 2, cy + 78);
      }
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.shadowColor = withAlpha(Theme.colors.neon.DEFAULT, 0.5);
      ctx.shadowBlur = 14;
      ctx.fillText("反诈游戏平台", cx + glitch, cy + 78);
      ctx.restore();

      // 副标题
      ctx.save();
      ctx.globalAlpha = titleP * 0.8;
      ctx.font = `400 11px ${Theme.fonts.mono}`;
      ctx.textAlign = "center";
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("// ANTI-FRAUD ARCADE · 全民反诈 天下无诈", cx, cy + 108);
      ctx.restore();
    }

    // 进度条
    if (this.t > 0.3) {
      const barW = Math.min(220, screenW - 80);
      const barH = 3;
      const bx = cx - barW / 2;
      const by = screenH - 120;
      ctx.save();
      ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.6);
      ctx.fillRect(bx, by, barW, barH);
      const fillW = barW * Ease.quadInOut(p);
      ctx.shadowColor = Theme.colors.neon.DEFAULT;
      ctx.shadowBlur = 8;
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.fillRect(bx, by, fillW, barH);
      ctx.shadowBlur = 0;
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      // 反诈冷启动文案：与 HubScene.BOOT_LINES 呼应，逐阶段加载反诈元素
      const tips = [
        "loading codex.db · F01-F70 ...",
        "loading 全民防骗局 F26-F31 ...",
        "linking 96110 反诈专线 ...",
        "linking 12308 境外领保 · 110 ...",
        "calibrating 识破雷达 · 0.8 rad/s ...",
        "anti-fraud system online · 天下无诈",
      ];
      const tipIdx = Math.min(tips.length - 1, Math.floor(p * tips.length));
      ctx.fillText(tips[tipIdx], cx, by + 18);
      ctx.restore();
    }

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  handleTouch(type: "start" | "move" | "end"): boolean {
    if (type === "start" && this.t > 0.5 && !this.done) {
      this.done = true;
      this.director.replace(new HubScene(this.director), undefined, "glitch");
      return true;
    }
    return true;
  }
}
