/**
 * 主页场景
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawStatCard, drawModalOverlay,
  drawScanlineOverlay, drawHudLabel, drawBadge, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon, drawLogo, type IconName } from "@/ui/icons";
import { GAMES } from "@/data/games";
import { platformStore } from "@/store/platformStore";
import { setMuted } from "@/engine/Audio";
import { playSfx } from "@/engine/Audio";
import { BriefingScene } from "./BriefingScene";

const COVER_ICON: Record<string, IconName> = {
  phone: "phone",
  tactic: "users",
  ship: "shield",
  bomb: "bomb",
};

export class HubScene extends Scene {
  private scrollY = 0;
  private contentH = 1200;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;
  private confirmReset = false;
  private pressedButton: string | null = null;

  enter(): void {
    super.enter();
    this.scrollY = 0;
  }

  update(dt: number): void {
    super.update(dt);
    // 更新内容高度（基于屏幕尺寸）
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    // 滚动内容
    ctx.save();
    ctx.translate(0, -this.scrollY);
    this.renderContent(ctx, screenW, screenH);
    ctx.restore();

    // 固定顶部导航栏
    this.renderTopBar(ctx, screenW);

    // 扫描线覆盖
    drawScanlineOverlay(ctx, screenW, screenH);

    // 重置确认弹窗
    if (this.confirmReset) {
      this.renderResetModal(ctx, screenW, screenH);
    }
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    // 背景
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.85)";
    ctx.fillRect(0, 0, screenW, 56);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, 55, screenW, 1);
    ctx.restore();

    // Logo
    drawLogo(ctx, 16, 12, 32, false);

    // 音效按钮
    const soundBtn = this.getSoundButtonRect(screenW);
    drawButton(ctx, soundBtn.x, soundBtn.y, soundBtn.w, soundBtn.h, "", {
      variant: "ghost",
      accent: platformStore.state.settings.sound ? Theme.colors.neon.DEFAULT : Theme.colors.ink.dim,
    });
    drawIcon(
      ctx,
      platformStore.state.settings.sound ? "volumeOn" : "volumeOff",
      soundBtn.x + soundBtn.w / 2 - 10, soundBtn.y + soundBtn.h / 2 - 10, 20,
      platformStore.state.settings.sound ? Theme.colors.neon.DEFAULT : Theme.colors.ink.dim
    );

    // 重置按钮
    const resetBtn = this.getResetButtonRect(screenW);
    drawButton(ctx, resetBtn.x, resetBtn.y, resetBtn.w, resetBtn.h, "", {
      variant: "ghost",
      accent: this.pressedButton === "reset" ? Theme.colors.warn.glow : Theme.colors.ink.muted,
      pressed: this.pressedButton === "reset",
    });
    drawIcon(ctx, "trash", resetBtn.x + resetBtn.w / 2 - 10, resetBtn.y + resetBtn.h / 2 - 10, 20, Theme.colors.ink.muted);
  }

  private renderContent(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const pad = 16;
    let y = 80;

    // ===== Hero 区域 =====
    // 系统状态标签
    drawHudLabel(ctx, pad, y, "● SYSTEM ONLINE · 反诈系统已激活", Theme.colors.warn.DEFAULT);
    y += 20;

    // 标题
    ctx.save();
    ctx.font = `700 40px ${Theme.fonts.display}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText("反诈", pad, y);
    const w1 = ctx.measureText("反诈").width;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.shadowColor = "rgba(0, 229, 255, 0.4)";
    ctx.shadowBlur = 16;
    ctx.fillText("游戏", pad + w1 + 4, y);
    const w2 = ctx.measureText("游戏").width;
    ctx.shadowBlur = 0;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText("平台", pad + w1 + w2 + 8, y);
    ctx.restore();
    y += 50;

    // 副标题
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("// ANTI-FRAUD ARCADE · 在娱乐中识破套路", pad, y);
    y += 16;
    ctx.fillText("// 4 款反诈主题游戏 · 公益科普 · 全民反诈 天下无诈", pad, y);
    y += 24;
    ctx.restore();

    // 徽章
    let bx = pad;
    const badges = [
      { text: "96110 反诈专线", bg: "rgba(27,95,204,0.15)", fg: Theme.colors.neon.DEFAULT },
      { text: "国家反诈中心", bg: "rgba(229,53,59,0.15)", fg: Theme.colors.warn.DEFAULT },
      { text: "12321 举报", bg: "rgba(82,196,26,0.15)", fg: Theme.colors.safe.DEFAULT },
    ];
    for (const b of badges) {
      const r = drawBadge(ctx, bx, y, b.text, b.bg, b.fg);
      bx += r.w + 8;
    }
    y += 32;

    // ===== 数据看板 =====
    const stat = platformStore.state;
    const rank = platformStore.rank();
    const statW = (screenW - pad * 2 - 8) / 2;
    const stats = [
      { label: "累计识破诈骗", value: String(stat.totalFoolsBusted), unit: "次", color: Theme.colors.neon.DEFAULT },
      { label: "当前段位", value: rank, color: Theme.colors.flag.DEFAULT },
      { label: "已解锁图鉴", value: String(stat.unlockedCodex.length), unit: "/ 12 类", color: Theme.colors.safe.DEFAULT },
      { label: "累计游戏", value: String(stat.totalGames), unit: `局`, color: Theme.colors.police.DEFAULT },
    ];
    for (let i = 0; i < stats.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = pad + col * (statW + 8);
      const sy = y + row * 84;
      drawStatCard(ctx, sx, sy, statW, 76, stats[i]);
    }
    y += 84 * 2 + 16;

    // ===== 任务标题 =====
    drawHudLabel(ctx, pad, y, "SELECT MISSION", Theme.colors.ink.muted);
    y += 14;
    ctx.save();
    ctx.font = `700 24px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("选择作战任务", pad, y);
    y += 36;
    ctx.restore();

    // ===== 游戏卡片墙 =====
    const cardW = screenW - pad * 2;
    const cardH = 120;
    for (let i = 0; i < GAMES.length; i++) {
      const g = GAMES[i];
      const cardY = y + i * (cardH + 12);
      this.renderGameCard(ctx, pad, cardY, cardW, cardH, g, i);
    }
    y += GAMES.length * (cardH + 12) + 8;

    // ===== 内容来源声明 =====
    drawPanel(ctx, pad, y, cardW, 100, { borderColor: Theme.colors.bg.line });
    drawIcon(ctx, "phone", pad + 12, y + 12, 16, Theme.colors.neon.DEFAULT);
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lines = [
      "内容来源声明 · 本平台所有反诈内容依据国家反诈中心、",
      "公安部刑事侦查局、人民银行、外交部领事保护中心公开",
      "资料整理改编。游戏内具体案例均为脱敏虚构。",
      "反诈专线 96110 · 举报渠道 12321 · 领事保护 12308",
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, pad + 36, y + 14 + i * 16);
    });
    ctx.restore();

    y += 116;
    this.contentH = y;
  }

  private renderGameCard(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    game: typeof GAMES[0], index: number
  ): void {
    const isPressed = this.pressedButton === `card-${index}`;
    const accent = game.accent;

    drawPanel(ctx, x, y, w, h, {
      borderColor: withAlpha(accent, 0.4),
      cut: 8,
    });

    // 顶部渐变线
    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, accent);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, 1);
    ctx.restore();

    // 左侧图标区
    const iconBoxSize = h - 24;
    ctx.save();
    ctx.fillStyle = withAlpha(accent, 0.12);
    ctx.fillRect(x + 12, y + 12, iconBoxSize, iconBoxSize);
    ctx.strokeStyle = withAlpha(accent, 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 12, y + 12, iconBoxSize, iconBoxSize);
    ctx.restore();
    drawIcon(ctx, COVER_ICON[game.cover] || "shield", x + 12 + 8, y + 12 + 8, iconBoxSize - 16, accent);

    // 右侧内容
    const contentX = x + 12 + iconBoxSize + 16;
    const contentW = w - (iconBoxSize + 40);

    // 标题
    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(game.title, contentX, y + 14);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 副标题
    drawHudLabel(ctx, contentX, y + 38, game.subtitle, Theme.colors.ink.muted);

    // 标签
    let tx = contentX;
    const ty = y + 58;
    for (const tag of game.tags.slice(0, 3)) {
      const r = drawBadge(ctx, tx, ty, tag, withAlpha(accent, 0.12), withAlpha(accent, 0.9));
      tx += r.w + 6;
    }

    // Tagline
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(game.tagline, contentX, y + 82);
    ctx.restore();

    // 难度星标 + 最高分
    const best = platformStore.state.bestScores[game.id] || 0;
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    const diffStr = "★".repeat(game.difficulty) + "☆".repeat(5 - game.difficulty);
    ctx.fillText(diffStr, x + w - 12, y + h - 24);
    if (best > 0) {
      ctx.fillStyle = accent;
      ctx.fillText(`BEST ${best.toLocaleString()}`, x + w - 12, y + h - 12);
    }
    ctx.restore();
  }

  private renderResetModal(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawModalOverlay(ctx, screenW, screenH);
    const w = Math.min(320, screenW - 32);
    const h = 180;
    const x = (screenW - w) / 2;
    const y = (screenH - h) / 2;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(Theme.colors.warn.DEFAULT, 0.6) });

    drawIcon(ctx, "trash", x + 16, y + 16, 18, Theme.colors.warn.DEFAULT);
    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("重置所有进度？", x + 42, y + 18);
    ctx.restore();

    ctx.save();
    ctx.font = `400 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("将清除累计识破诈骗数、段位、图鉴解锁、", x + 16, y + 56);
    ctx.fillText("最高分等所有数据，且不可恢复。", x + 16, y + 76);
    ctx.restore();

    // 按钮
    const btnW = (w - 32 - 8) / 2;
    const btnH = 36;
    const btnY = y + h - btnH - 16;
    const cancelRect: Rect = { x: x + 16, y: btnY, w: btnW, h: btnH };
    const confirmRect: Rect = { x: x + 16 + btnW + 8, y: btnY, w: btnW, h: btnH };
    drawButton(ctx, cancelRect.x, cancelRect.y, cancelRect.w, cancelRect.h, "取消", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "cancel-reset",
    });
    drawButton(ctx, confirmRect.x, confirmRect.y, confirmRect.w, confirmRect.h, "确认重置", {
      variant: "danger",
      pressed: this.pressedButton === "confirm-reset",
    });
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    if (this.confirmReset) {
      const w = Math.min(320, screenW - 32);
      const h = 180;
      const mx = (screenW - w) / 2;
      const my = (screenH - h) / 2;
      const btnW = (w - 32 - 8) / 2;
      const btnH = 36;
      const btnY = my + h - btnH - 16;
      const cancelRect: Rect = { x: mx + 16, y: btnY, w: btnW, h: btnH };
      const confirmRect: Rect = { x: mx + 16 + btnW + 8, y: btnY, w: btnW, h: btnH };

      if (type === "start") {
        if (hitTest(x, y, cancelRect)) { this.pressedButton = "cancel-reset"; return true; }
        if (hitTest(x, y, confirmRect)) { this.pressedButton = "confirm-reset"; return true; }
        return true; // 拦截背景点击
      } else if (type === "end") {
        if (this.pressedButton === "cancel-reset" && hitTest(x, y, cancelRect)) {
          this.confirmReset = false;
          playSfx("click");
        } else if (this.pressedButton === "confirm-reset" && hitTest(x, y, confirmRect)) {
          platformStore.resetProgress();
          this.confirmReset = false;
          playSfx("bad");
        }
        this.pressedButton = null;
        return true;
      }
      return true;
    }

    // 顶部按钮（固定，不随滚动）
    const soundBtn = this.getSoundButtonRect(screenW);
    const resetBtn = this.getResetButtonRect(screenW);

    if (type === "start") {
      if (hitTest(x, y, soundBtn)) {
        this.pressedButton = "sound";
        return true;
      }
      if (hitTest(x, y, resetBtn)) {
        this.pressedButton = "reset";
        return true;
      }

      // 游戏卡片
      const pad = 16;
      const cardW = screenW - pad * 2;
      const cardH = 120;
      let cardStartY = this.getCardStartY(screenW);
      for (let i = 0; i < GAMES.length; i++) {
        const cardRect: Rect = { x: pad, y: cardStartY + i * (cardH + 12) - this.scrollY, w: cardW, h: cardH };
        if (hitTest(x, y, cardRect)) {
          this.pressedButton = `card-${i}`;
          return true;
        }
      }

      // 滚动拖拽
      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      this.isDragging = true;
      return false; // 不消费，允许滚动
    } else if (type === "move") {
      if (this.isDragging) {
        const dy = y - this.dragStartY;
        this.scrollY = Math.max(0, Math.min(this.contentH - screenH, this.dragStartScroll - dy));
      }
      return false;
    } else if (type === "end") {
      if (this.pressedButton === "sound") {
        platformStore.toggleSound();
        setMuted(!platformStore.state.settings.sound);
        playSfx("click");
      } else if (this.pressedButton === "reset") {
        this.confirmReset = true;
        playSfx("click");
      } else if (this.pressedButton && this.pressedButton.startsWith("card-")) {
        const idx = parseInt(this.pressedButton.slice(5));
        const pad = 16;
        const cardW = screenW - pad * 2;
        const cardH = 120;
        const cardStartY = this.getCardStartY(screenW);
        const cardRect: Rect = { x: pad, y: cardStartY + idx * (cardH + 12) - this.scrollY, w: cardW, h: cardH };
        if (hitTest(x, y, cardRect)) {
          playSfx("click");
          this.director.replace(new BriefingScene(this.director), { gameId: GAMES[idx].id });
        }
      }
      this.pressedButton = null;
      this.isDragging = false;
      return false;
    }
    return false;
  }

  private getSoundButtonRect(screenW: number): Rect {
    return { x: screenW - 96, y: 12, w: 36, h: 32 };
  }

  private getResetButtonRect(screenW: number): Rect {
    return { x: screenW - 52, y: 12, w: 36, h: 32 };
  }

  private getCardStartY(screenW: number): number {
    // 计算 Hero + Stats 区域的高度
    // 80 (top offset) + 20 + 50 + 16 + 16 + 24 + 32 + 84*2 + 16 + 14 + 36
    return 388;
  }
}
