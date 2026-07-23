/**
 * 成就殿堂场景
 * 全部成就网格展示：已解锁高亮 + 未解锁剪影
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import { Ease } from "@/engine/easing";
import {
  drawBackground, drawPanel, drawButton, drawScanlineOverlay,
  hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { ACHIEVEMENTS } from "@/data/achievements";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";

export class AchievementsScene extends Scene {
  private scrollY = 0;
  private contentH = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;
  private dragDist = 0;
  private pressedButton: string | null = null;
  private t = 0;

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    ctx.save();
    ctx.translate(0, -this.scrollY);
    this.renderContent(ctx, screenW);
    ctx.restore();

    // 顶栏
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, 56);
    grad.addColorStop(0, "rgba(10,25,41,0.95)");
    grad.addColorStop(1, "rgba(10,25,41,0.8)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, 56);
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 55, screenW, 1);
    ctx.restore();

    const backBtn: Rect = { x: 12, y: 12, w: 40, h: 32 };
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 12, backBtn.y + 8, 16, Theme.colors.ink.muted);

    const prog = platformStore.achievementProgress();
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("成就殿堂", screenW / 2, 22);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${prog.unlocked}/${prog.total} UNLOCKED`, screenW / 2, 40);
    ctx.restore();

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderContent(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const y = 72;
    const unlocked = platformStore.state.unlockedAchievements;
    const cols = 2;
    const gap = 10;
    const cardW = (screenW - pad * 2 - gap) / cols;
    const cardH = 92;

    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const a = ACHIEVEMENTS[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = pad + col * (cardW + gap);
      const cy = y + row * (cardH + gap);
      const isUnlocked = unlocked.includes(a.id);
      const enter = Ease.cubicOut(Math.min(1, Math.max(0, (this.enterT - i * 0.04) / 0.5)));

      ctx.save();
      ctx.globalAlpha = enter;
      ctx.translate(0, (1 - enter) * 16);

      drawPanel(ctx, x, cy, cardW, cardH, {
        borderColor: isUnlocked ? withAlpha(a.color, 0.55) : withAlpha(Theme.colors.bg.line, 0.8),
        bgColor: isUnlocked ? withAlpha(a.color, 0.07) : withAlpha(Theme.colors.bg.panel, 0.6),
        cut: 8,
      });

      // 图标
      const iconColor = isUnlocked ? a.color : Theme.colors.ink.dim;
      ctx.save();
      if (isUnlocked) {
        ctx.shadowColor = a.color;
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = withAlpha(iconColor, isUnlocked ? 0.18 : 0.1);
      ctx.beginPath();
      ctx.arc(x + 28, cy + 28, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawIcon(ctx, isUnlocked ? a.icon : "lock", x + 28 - 10, cy + 28 - 10, 20, iconColor);

      // 名称 + 描述
      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = `700 13px ${Theme.fonts.display}`;
      ctx.fillStyle = isUnlocked ? a.color : Theme.colors.ink.dim;
      ctx.fillText(a.name, x + 52, cy + 14);
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = isUnlocked ? Theme.colors.ink.muted : withAlpha(Theme.colors.ink.dim, 0.7);
      this.wrapText(ctx, a.desc, x + 12, cy + 52, cardW - 24, 14);
      ctx.restore();

      // 已解锁角标
      if (isUnlocked) {
        drawIcon(ctx, "check", x + cardW - 20, cy + 8, 12, a.color);
      }

      ctx.restore();
    }

    const rows = Math.ceil(ACHIEVEMENTS.length / cols);
    this.contentH = y + rows * (cardH + gap) + 30;
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    let line = "";
    let yy = y;
    for (const ch of text) {
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

  handleTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenH = this.director.screenHeight;
    const backBtn: Rect = { x: 12, y: 12, w: 40, h: 32 };

    if (type === "start") {
      this.dragDist = 0;
      if (hitTest(x, y, backBtn)) { this.pressedButton = "back"; return true; }
      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      this.isDragging = true;
      return true; // 消费触摸以接收 move/end 实现拖拽滚动
    } else if (type === "move") {
      if (this.isDragging) {
        const dy = y - this.dragStartY;
        this.dragDist = Math.max(this.dragDist, Math.abs(dy));
        this.scrollY = Math.max(0, Math.min(Math.max(0, this.contentH - screenH + 40), this.dragStartScroll - dy));
      }
      return false;
    } else if (type === "end") {
      if (this.pressedButton === "back" && hitTest(x, y, backBtn)) {
        playSfx("click");
        this.director.pop("slide");
      }
      this.pressedButton = null;
      this.isDragging = false;
      return false;
    }
    return false;
  }
}
