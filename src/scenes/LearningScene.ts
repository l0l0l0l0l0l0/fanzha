/**
 * 反诈学习中心场景
 * 三级课程列表：初阶 / 中阶 / 高阶，每节显示完成状态
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import { Ease } from "@/engine/easing";
import {
  drawBackground, drawPanel, drawButton, drawScanlineOverlay,
  drawProgressBar, drawHudLabel, drawBadge, drawNeonCorners,
  hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { getLessonTiers, type Lesson, type LessonTier } from "@/data/lessons";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import { LessonDetailScene } from "./LessonDetailScene";

export class LearningScene extends Scene {
  private scrollY = 0;
  private contentH = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;
  private dragDist = 0;
  private pressedButton: string | null = null;
  private t = 0;
  private tiers: LessonTier[] = [];

  enter(): void {
    super.enter();
    this.tiers = getLessonTiers();
    this.scrollY = 0;
  }

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

    this.renderTopBar(ctx, screenW);
    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, 56);
    grad.addColorStop(0, "rgba(10,25,41,0.95)");
    grad.addColorStop(1, "rgba(10,25,41,0.8)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, 56);
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 55, screenW, 1);
    ctx.restore();

    const backBtn: Rect = { x: 12, y: 12, w: 40, h: 32 };
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 12, backBtn.y + 8, 16, Theme.colors.ink.muted);

    const prog = platformStore.learningProgress();
    const totalDone = prog.completedLessons.length;
    const totalAll = prog.basicTotal + prog.intermediateTotal + prog.advancedTotal;

    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(Theme.colors.neon.DEFAULT, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("反诈学习中心", screenW / 2, 22);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${totalDone}/${totalAll} 课程已完成`, screenW / 2, 40);
    ctx.restore();
  }

  private renderContent(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    let y = 72;

    // ===== Hero：学习中心说明 =====
    drawPanel(ctx, pad, y, screenW - pad * 2, 92, {
      borderColor: withAlpha(Theme.colors.neon.DEFAULT, 0.3),
    });
    drawIcon(ctx, "book", pad + 14, y + 14, 22, Theme.colors.neon.DEFAULT);
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("从识诈到防诈 · 三阶进阶", pad + 44, y + 16);
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("逐节学习反诈图鉴 · 测验通过即完成课程", pad + 44, y + 38);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.fillText("// 答对 " + "" + "3 题即通过 · 累计学习可解锁段位与成就", pad + 44, y + 58);
    ctx.restore();

    // 整体进度条
    const prog = platformStore.learningProgress();
    const totalDone = prog.completedLessons.length;
    const totalAll = prog.basicTotal + prog.intermediateTotal + prog.advancedTotal;
    const overallRatio = totalAll > 0 ? totalDone / totalAll : 0;
    drawHudLabel(ctx, pad, y + 102, "OVERALL PROGRESS", Theme.colors.ink.muted);
    drawProgressBar(ctx, pad, y + 116, screenW - pad * 2, 6, overallRatio, Theme.colors.neon.DEFAULT);
    ctx.save();
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.floor(overallRatio * 100)}%`, screenW - pad, y + 100);
    ctx.restore();

    y += 142;

    // ===== 三级课程包 =====
    for (const tier of this.tiers) {
      y += this.renderTier(ctx, tier, pad, y, screenW);
      y += 16;
    }

    this.contentH = y + 40;
  }

  private renderTier(
    ctx: CanvasRenderingContext2D,
    tier: LessonTier,
    x: number, y: number,
    screenW: number
  ): number {
    const w = screenW - x * 2;
    const completedSet = new Set(platformStore.state.learning.completedLessons);
    const done = tier.lessons.filter((l) => completedSet.has(l.typeId)).length;
    const ratio = tier.lessons.length > 0 ? done / tier.lessons.length : 0;

    // 等级头部
    drawHudLabel(ctx, x, y, tier.subtitle, withAlpha(tier.accent, 0.8));
    ctx.save();
    ctx.font = `700 20px ${Theme.fonts.display}`;
    ctx.fillStyle = tier.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(tier.accent, 0.4);
    ctx.shadowBlur = 10;
    ctx.fillText(tier.title, x, y + 14);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 进度
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${done}/${tier.lessons.length}`, x + w - 2, y + 20);
    ctx.restore();

    drawProgressBar(ctx, x, y + 46, w, 4, ratio, tier.accent);

    let cy = y + 60;
    const gap = 8;
    const cols = 2;
    const cardW = (w - gap * (cols - 1)) / cols;
    const cardH = 88;

    for (let i = 0; i < tier.lessons.length; i++) {
      const lesson = tier.lessons[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = x + col * (cardW + gap);
      const cyy = cy + row * (cardH + gap);
      this.renderLessonCard(ctx, lesson, cx, cyy, cardW, cardH, tier.accent, i, completedSet);
    }

    const rows = Math.ceil(tier.lessons.length / cols);
    return 60 + rows * (cardH + gap);
  }

  private renderLessonCard(
    ctx: CanvasRenderingContext2D,
    lesson: Lesson,
    x: number, y: number, w: number, h: number,
    accent: string, index: number,
    completedSet: Set<string>
  ): void {
    const isCompleted = completedSet.has(lesson.typeId);
    const isPressed = this.pressedButton === `lesson-${lesson.typeId}`;
    const enter = Ease.cubicOut(Math.min(1, Math.max(0, (this.enterT - index * 0.03) / 0.5)));

    ctx.save();
    ctx.globalAlpha = enter;
    ctx.translate(0, (1 - enter) * 12);

    drawPanel(ctx, x, y, w, h, {
      borderColor: isCompleted ? withAlpha(accent, 0.55) : withAlpha(Theme.colors.bg.line, 0.7),
      bgColor: isCompleted ? withAlpha(accent, 0.06) : Theme.colors.bg.panel,
      cut: 8,
    });

    if (isPressed) {
      drawNeonCorners(ctx, x, y, w, h, accent, undefined, undefined, 8 + Math.sin(this.t * 8) * 4);
    }

    // 类型图标 emoji（codex.icon）— 字号从 28 提升到 36
    ctx.save();
    ctx.font = `36px ${Theme.fonts.body}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(lesson.codex.icon, x + 10, y + 10);
    ctx.restore();

    // 名称 — 字号从 13 提升到 14
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = isCompleted ? accent : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(lesson.codex.name, x + 54, y + 12);
    ctx.restore();

    // slogan — 用 accent 警示色加粗高亮（原 muted 改为 accent）
    if (lesson.codex.slogan) {
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = withAlpha(accent, 0.92);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      this.wrapText(ctx, lesson.codex.slogan, x + 54, y + 32, w - 64, 13);
      ctx.restore();
    }

    // 来源（小字 dim，左下角）— 新增显式来源标注
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const srcShort = lesson.codex.source.length > 18
      ? lesson.codex.source.slice(0, 17) + "…"
      : lesson.codex.source;
    ctx.fillText(`来源 · ${srcShort}`, x + 12, y + h - 18);
    ctx.restore();

    // 题数（右下角，与来源并排）
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(accent, 0.7);
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${lesson.quiz.length} 题`, x + w - 14, y + h - 18);
    ctx.restore();

    // 完成角标
    if (isCompleted) {
      const badgeR = drawBadge(ctx, x + w - 50, y + 10, "已完成", withAlpha(accent, 0.18), accent);
      drawIcon(ctx, "check", badgeR.x + 6, badgeR.y + 3, 10, accent);
    } else {
      drawIcon(ctx, "arrowRight", x + w - 18, y + 14, 10, Theme.colors.ink.dim);
    }

    ctx.restore();
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

      // 检查课程卡片点击（需要还原 scrollY 偏移）
      const pad = 16;
      const startY = 72 + 142; // hero 区域后
      let tierY = startY;
      for (const tier of this.tiers) {
        tierY += 60; // tier 头部
        const gap = 8;
        const cols = 2;
        const cardW = (this.director.screenWidth - pad * 2 - gap * (cols - 1)) / cols;
        const cardH = 88;
        const rows = Math.ceil(tier.lessons.length / cols);
        for (let i = 0; i < tier.lessons.length; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx = pad + col * (cardW + gap);
          const cyy = tierY + row * (cardH + gap);
          const cardRect: Rect = { x: cx, y: cyy - this.scrollY, w: cardW, h: cardH };
          if (hitTest(x, y, cardRect)) {
            this.pressedButton = `lesson-${tier.lessons[i].typeId}`;
            return true;
          }
        }
        tierY += rows * (cardH + gap) + 16;
      }

      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      this.isDragging = true;
      return true;
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
        postFX.flash(Theme.colors.neon.DEFAULT, 0.3);
      } else if (this.pressedButton && this.pressedButton.startsWith("lesson-")) {
        const typeId = this.pressedButton.slice(7);
        const lesson = this.tiers.flatMap((t) => t.lessons).find((l) => l.typeId === typeId);
        if (lesson) {
          playSfx("click");
          this.director.push(new LessonDetailScene(this.director), { typeId }, "slide");
        }
      }
      this.pressedButton = null;
      this.isDragging = false;
      return false;
    }
    return false;
  }
}
