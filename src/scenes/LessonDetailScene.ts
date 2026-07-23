/**
 * 单课详情场景
 * 三态：intro（学习卡片）→ quiz（答题）→ result（成绩）
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
import { getLesson, type Lesson } from "@/data/lessons";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import { ParticleSystem } from "@/engine/Particle";
import type { FBQuestion } from "@/games/fraudBuster/types";

type Phase = "intro" | "quiz" | "reveal" | "result";

export class LessonDetailScene extends Scene {
  private lesson: Lesson | null = null;
  private phase: Phase = "intro";
  private scrollY = 0;
  private contentH = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;
  private dragDist = 0;
  private pressedButton: string | null = null;
  private t = 0;
  private particles = new ParticleSystem();

  // 测验状态
  private quizIndex = 0;
  private quizCorrect = 0;
  private quizWrong = 0;
  private selectedIdx: number | null = null;
  private multiSelected: number[] = [];
  private answered = false;
  private currentQuestion: FBQuestion | null = null;
  private revealAt = 0;
  private resultCorrect = 0;
  private resultTotal = 0;
  private newAchievements: string[] = [];

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    const typeId = params?.typeId as string;
    this.lesson = getLesson(typeId) ?? null;
    this.phase = "intro";
    this.scrollY = 0;
    this.quizIndex = 0;
    this.quizCorrect = 0;
    this.quizWrong = 0;
    if (this.lesson && this.lesson.quiz.length > 0) {
      this.currentQuestion = this.lesson.quiz[0];
    }
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    this.particles.update(dt);
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);
    this.particles.render(ctx);

    if (!this.lesson) {
      this.renderError(ctx, screenW, screenH);
      this.renderTopBar(ctx, screenW);
      return;
    }

    ctx.save();
    ctx.translate(0, -this.scrollY);

    if (this.phase === "intro") {
      this.renderIntro(ctx, screenW);
    } else if (this.phase === "quiz" || this.phase === "reveal") {
      this.renderQuiz(ctx, screenW);
    } else if (this.phase === "result") {
      this.renderResult(ctx, screenW);
    }

    ctx.restore();

    this.renderTopBar(ctx, screenW);
    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderError(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.warn.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("课程加载失败", screenW / 2, screenH / 2);
    ctx.restore();
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

    if (!this.lesson) return;
    const title = this.phase === "intro" ? this.lesson.codex.name
      : this.phase === "result" ? "课程完成"
      : `测验 ${this.quizIndex + 1}/${this.lesson.quiz.length}`;
    ctx.save();
    ctx.font = `700 15px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(Theme.colors.neon.DEFAULT, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(title, screenW / 2, 22);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(this.lesson.codex.catchphrase, screenW / 2, 40);
    ctx.restore();
  }

  // ============ Phase: intro（学习卡片） ============
  private renderIntro(ctx: CanvasRenderingContext2D, screenW: number): void {
    if (!this.lesson) return;
    const pad = 16;
    const w = screenW - pad * 2;
    let y = 72;
    const lesson = this.lesson;
    const accent = this.levelAccent(lesson.level);

    // Hero：类型大图标 + 名称 + catchphrase 警示语 + slogan + source
    // 高度从 110 扩到 132，腾出 catchphrase 警示大字位置
    const heroH = 132;
    drawPanel(ctx, pad, y, w, heroH, { borderColor: withAlpha(accent, 0.45) });
    drawNeonCorners(ctx, pad, y, w, heroH, accent, undefined, undefined, 8);

    // 类型图标 emoji — 字号从 48 提升到 56
    ctx.save();
    ctx.font = `56px ${Theme.fonts.body}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(lesson.codex.icon, pad + 14, y + 14);
    ctx.restore();

    ctx.save();
    // 名称 — 字号从 22 提升到 24
    ctx.font = `700 24px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 10;
    ctx.fillText(lesson.codex.name, pad + 92, y + 14);
    ctx.shadowBlur = 0;

    // catchphrase 警示大字 — 新增，用 warn 色高亮 + 阴影
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.warn.DEFAULT;
    ctx.shadowColor = withAlpha(Theme.colors.warn.DEFAULT, 0.45);
    ctx.shadowBlur = 8;
    ctx.fillText(`⚠ ${lesson.codex.catchphrase}`, pad + 92, y + 46);
    ctx.shadowBlur = 0;

    // slogan — muted 色辅助说明
    if (lesson.codex.slogan) {
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      this.wrapText(ctx, lesson.codex.slogan, pad + 92, y + 68, w - 108, 16);
    }

    // 来源 — 显式溯源标注
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.fillText(`来源 · ${lesson.codex.source}`, pad + 14, y + heroH - 18);
    ctx.restore();

    y += heroH + 14;

    // 识别要点
    drawHudLabel(ctx, pad, y, "// IDENTIFY POINTS · 识别要点", withAlpha(accent, 0.8));
    y += 16;
    drawPanel(ctx, pad, y, w, lesson.codex.points.length * 26 + 18, { borderColor: withAlpha(accent, 0.25) });
    lesson.codex.points.forEach((pt, i) => {
      const py = y + 14 + i * 26;
      ctx.save();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(pad + 16, py + 6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `400 13px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      this.wrapText(ctx, pt, pad + 28, py, w - 44, 18);
      ctx.restore();
    });
    y += lesson.codex.points.length * 26 + 18 + 14;

    // 应对方法
    drawHudLabel(ctx, pad, y, "// RESPONSE · 正确应对", withAlpha(Theme.colors.safe.DEFAULT, 0.8));
    y += 16;
    const responseH = 56;
    drawPanel(ctx, pad, y, w, responseH, {
      borderColor: withAlpha(Theme.colors.safe.DEFAULT, 0.3),
      bgColor: withAlpha(Theme.colors.safe.DEFAULT, 0.05),
    });
    ctx.save();
    drawIcon(ctx, "shield", pad + 14, y + 14, 18, Theme.colors.safe.DEFAULT);
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.wrapText(ctx, lesson.codex.response, pad + 40, y + 16, w - 56, 18);
    ctx.restore();
    y += responseH + 16;

    // 锦囊
    if (lesson.tips.length > 0) {
      drawHudLabel(ctx, pad, y, "// TIPS · 反诈锦囊", withAlpha(Theme.colors.flag.DEFAULT, 0.8));
      y += 16;
      for (const tip of lesson.tips) {
        const tipH = 64;
        drawPanel(ctx, pad, y, w, tipH, { borderColor: withAlpha(Theme.colors.flag.DEFAULT, 0.2) });
        ctx.save();
        ctx.font = `700 12px ${Theme.fonts.display}`;
        ctx.fillStyle = Theme.colors.flag.DEFAULT;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(tip.title, pad + 12, y + 10);
        ctx.font = `400 11px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        this.wrapText(ctx, tip.body, pad + 12, y + 28, w - 24, 14);
        ctx.restore();
        y += tipH + 8;
      }
      y += 8;
    }

    // 测验预告
    drawHudLabel(ctx, pad, y, "// QUIZ · 通关测验", withAlpha(accent, 0.8));
    y += 16;
    drawPanel(ctx, pad, y, w, 80, { borderColor: withAlpha(accent, 0.3) });
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`共 ${lesson.quiz.length} 道题，答对 ${lesson.passCorrect} 题即通过`, pad + 12, y + 14);
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("通过后该课程标记为已完成，并累计学习成就", pad + 12, y + 36);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.fillText("答错不扣分 · 重点关注解析", pad + 12, y + 56);
    ctx.restore();
    y += 80 + 16;

    // 开始测验按钮
    const btnW = w;
    const btnH = 52;
    const startBtn: Rect = { x: pad, y, w: btnW, h: btnH };
    drawButton(ctx, startBtn.x, startBtn.y, startBtn.w, startBtn.h, "开始测验", {
      variant: "primary",
      accent,
      pressed: this.pressedButton === "start",
      fontSize: 18,
      subText: `START QUIZ · ${lesson.quiz.length} QUESTIONS`,
    });
    y += btnH + 24;

    this.contentH = y;
  }

  // ============ Phase: quiz / reveal ============
  private renderQuiz(ctx: CanvasRenderingContext2D, screenW: number): void {
    if (!this.lesson || !this.currentQuestion) return;
    const pad = 16;
    const w = screenW - pad * 2;
    let y = 72;
    const q = this.currentQuestion;
    const accent = this.levelAccent(this.lesson.level);

    // 进度条
    const ratio = this.quizIndex / this.lesson.quiz.length;
    drawProgressBar(ctx, pad, y, w, 4, ratio, accent);
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`第 ${this.quizIndex + 1} 题 / 共 ${this.lesson.quiz.length} 题`, pad, y + 10);
    ctx.textAlign = "right";
    ctx.fillStyle = accent;
    ctx.fillText(`已答对 ${this.quizCorrect}`, pad + w, y + 10);
    ctx.restore();
    y += 30;

    // 题目卡片
    const cardH = 220;
    drawPanel(ctx, pad, y, w, cardH, { borderColor: withAlpha(accent, 0.4) });
    drawNeonCorners(ctx, pad, y, w, cardH, accent, undefined, undefined, 6);

    // 标题（场景描述）
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`[${this.lesson.codex.icon} ${q.type}] · ${this.cardTypeLabel(q.cardType)}`, pad + 14, y + 14);
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.fillText(q.title, pad + 14, y + 30);
    ctx.restore();

    // 题面
    ctx.save();
    ctx.font = `400 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const bodyH = this.wrapText(ctx, q.body, pad + 14, y + 56, w - 28, 20);
    ctx.restore();

    // 风险提示线索
    if (q.cues && q.cues.length > 0) {
      ctx.save();
      let cx = pad + 14;
      const cy = y + cardH - 28;
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("线索：", cx, cy);
      cx += 36;
      for (const cue of q.cues.slice(0, 4)) {
        const r = drawBadge(ctx, cx, cy - 2, cue, withAlpha(Theme.colors.warn.DEFAULT, 0.1), withAlpha(Theme.colors.warn.DEFAULT, 0.8));
        cx += r.w + 4;
      }
      ctx.restore();
    }

    y += cardH + 14;

    // 选项
    const isMulti = q.kind === "multi";
    const opts = q.options;
    const optH = 48;
    const optGap = 8;
    for (let i = 0; i < opts.length; i++) {
      const optY = y + i * (optH + optGap);
      this.renderOption(ctx, pad, optY, w, optH, i, opts[i], accent, isMulti);
    }
    y += opts.length * (optH + optGap) + 14;

    // 提交按钮 / 解析区
    if (this.phase === "reveal") {
      // 答案解析
      const explainH = 100;
      drawPanel(ctx, pad, y, w, explainH, {
        borderColor: withAlpha(this.answered && this.lastAnswerCorrect() ? Theme.colors.safe.DEFAULT : Theme.colors.warn.DEFAULT, 0.4),
        bgColor: withAlpha(this.answered && this.lastAnswerCorrect() ? Theme.colors.safe.DEFAULT : Theme.colors.warn.DEFAULT, 0.06),
      });
      ctx.save();
      ctx.font = `700 13px ${Theme.fonts.display}`;
      ctx.fillStyle = this.lastAnswerCorrect() ? Theme.colors.safe.DEFAULT : Theme.colors.warn.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(this.lastAnswerCorrect() ? "✓ 答对了" : "✗ 答错了", pad + 12, y + 12);
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      this.wrapText(ctx, q.explain, pad + 12, y + 34, w - 24, 18);
      ctx.restore();
      y += explainH + 14;

      // 出处溯源（题级真实文章出处，用于内容核查）
      if (q.source) {
        ctx.save();
        ctx.strokeStyle = withAlpha(accent, 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pad + 8, y + 2);
        ctx.lineTo(pad + 8, y + 14);
        ctx.stroke();
        ctx.font = `400 11px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const srcH = this.wrapText(ctx, "来源：" + q.source, pad + 14, y, w - 28, 16);
        ctx.restore();
        y += srcH + 14;
      }

      // 下一题按钮
      const isLast = this.quizIndex >= this.lesson.quiz.length - 1;
      const nextBtn: Rect = { x: pad, y, w, h: 48 };
      drawButton(ctx, nextBtn.x, nextBtn.y, nextBtn.w, nextBtn.h, isLast ? "查看结果" : "下一题", {
        variant: "primary",
        accent,
        pressed: this.pressedButton === "next",
        fontSize: 16,
      });
      y += 48 + 24;
    } else {
      // 提交按钮
      const canSubmit = isMulti ? this.multiSelected.length > 0 : this.selectedIdx !== null;
      const submitBtn: Rect = { x: pad, y, w, h: 48 };
      drawButton(ctx, submitBtn.x, submitBtn.y, submitBtn.w, submitBtn.h, "提交答案", {
        variant: canSubmit ? "primary" : "ghost",
        accent,
        pressed: this.pressedButton === "submit",
        fontSize: 16,
      });
      y += 48 + 24;
    }

    this.contentH = y;
  }

  private renderOption(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    idx: number, text: string, accent: string, isMulti: boolean
  ): void {
    const q = this.currentQuestion!;
    const isReveal = this.phase === "reveal";
    const isSelected = isMulti ? this.multiSelected.includes(idx) : this.selectedIdx === idx;
    const isCorrect = isMulti ? (q.answers ?? []).includes(idx) : q.answer === idx;
    const isRisk = (q.risk ?? []).includes(idx);

    let bg: string = Theme.colors.bg.panel;
    let border = withAlpha(Theme.colors.bg.line, 0.8);
    let textColor: string = Theme.colors.ink.DEFAULT;
    let label = String.fromCharCode(65 + idx);
    let labelColor: string = Theme.colors.ink.muted;

    if (isReveal) {
      if (isCorrect) {
        bg = withAlpha(Theme.colors.safe.DEFAULT, 0.12);
        border = Theme.colors.safe.DEFAULT;
        textColor = Theme.colors.safe.glow;
        labelColor = Theme.colors.safe.DEFAULT;
      } else if (isSelected && !isCorrect) {
        bg = withAlpha(Theme.colors.warn.DEFAULT, 0.1);
        border = Theme.colors.warn.DEFAULT;
        textColor = Theme.colors.warn.glow;
        labelColor = Theme.colors.warn.DEFAULT;
      } else if (isRisk) {
        bg = withAlpha(Theme.colors.warn.DEFAULT, 0.05);
        border = withAlpha(Theme.colors.warn.DEFAULT, 0.4);
      }
    } else if (isSelected) {
      bg = withAlpha(accent, 0.1);
      border = accent;
      labelColor = accent;
    }

    const pressed = this.pressedButton === `opt-${idx}`;
    drawPanel(ctx, x, y, w, h, { borderColor: border, bgColor: bg, cut: 6 });
    if (pressed) {
      drawNeonCorners(ctx, x, y, w, h, accent, undefined, undefined, 6);
    }

    // 选项标签 A/B/C/D
    ctx.save();
    ctx.fillStyle = withAlpha(labelColor, 0.18);
    ctx.beginPath();
    ctx.arc(x + 22, y + h / 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = labelColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 22, y + h / 2);
    ctx.restore();

    // 选项文本
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.wrapText(ctx, text, x + 44, y + 10, w - 60, 16);
    ctx.restore();

    // 状态标记
    if (isReveal && isCorrect) {
      drawIcon(ctx, "check", x + w - 22, y + h / 2 - 8, 16, Theme.colors.safe.DEFAULT);
    } else if (isReveal && isSelected && !isCorrect) {
      drawIcon(ctx, "x", x + w - 22, y + h / 2 - 8, 16, Theme.colors.warn.DEFAULT);
    } else if (isMulti && isSelected) {
      drawIcon(ctx, "check", x + w - 22, y + h / 2 - 8, 16, accent);
    }
  }

  private cardTypeLabel(cardType: string): string {
    const map: Record<string, string> = {
      chat: "聊天", call: "来电", transfer: "转账", popup: "弹窗", sms: "短信", video: "视频",
    };
    return map[cardType] ?? cardType;
  }

  private lastAnswerCorrect(): boolean {
    if (!this.currentQuestion) return false;
    const q = this.currentQuestion;
    if (q.kind === "multi") {
      const correct = (q.answers ?? []).slice().sort().join(",");
      const sel = this.multiSelected.slice().sort().join(",");
      return correct === sel;
    }
    return this.selectedIdx === q.answer;
  }

  // ============ Phase: result ============
  private renderResult(ctx: CanvasRenderingContext2D, screenW: number): void {
    if (!this.lesson) return;
    const pad = 16;
    const w = screenW - pad * 2;
    let y = 80;
    const accent = this.levelAccent(this.lesson.level);
    const passed = this.resultCorrect >= this.lesson.passCorrect;
    const color = passed ? Theme.colors.safe.DEFAULT : Theme.colors.warn.DEFAULT;

    // 大图标 + 文案
    drawPanel(ctx, pad, y, w, 160, { borderColor: withAlpha(color, 0.5) });
    drawNeonCorners(ctx, pad, y, w, 160, color, undefined, undefined, 10);

    ctx.save();
    ctx.font = `48px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.lesson.codex.icon, screenW / 2, y + 14);
    ctx.font = `700 24px ${Theme.fonts.display}`;
    ctx.fillStyle = color;
    ctx.shadowColor = withAlpha(color, 0.5);
    ctx.shadowBlur = 14;
    ctx.fillText(passed ? "课程通过" : "再接再厉", screenW / 2, y + 72);
    ctx.shadowBlur = 0;
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(this.lesson.codex.name, screenW / 2, y + 108);
    ctx.restore();
    y += 174;

    // 成绩
    drawHudLabel(ctx, pad, y, "// SCORE · 成绩", withAlpha(accent, 0.8));
    y += 16;
    drawPanel(ctx, pad, y, w, 96, { borderColor: withAlpha(accent, 0.3) });
    ctx.save();
    ctx.font = `700 36px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(color, 0.4);
    ctx.shadowBlur = 10;
    ctx.fillText(`${this.resultCorrect} / ${this.resultTotal}`, screenW / 2, y + 16);
    ctx.shadowBlur = 0;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`正确率 ${Math.round((this.resultCorrect / Math.max(1, this.resultTotal)) * 100)}%`, screenW / 2, y + 64);
    ctx.restore();
    y += 96 + 16;

    // 新成就
    if (this.newAchievements.length > 0) {
      drawHudLabel(ctx, pad, y, "// ACHIEVEMENT UNLOCKED · 新成就", withAlpha(Theme.colors.flag.DEFAULT, 0.9));
      y += 16;
      for (const id of this.newAchievements) {
        const r: Rect = { x: pad, y, w, h: 48 };
        drawPanel(ctx, r.x, r.y, r.w, r.h, {
          borderColor: withAlpha(Theme.colors.flag.DEFAULT, 0.5),
          bgColor: withAlpha(Theme.colors.flag.DEFAULT, 0.06),
        });
        drawIcon(ctx, "trophy", r.x + 14, r.y + 14, 20, Theme.colors.flag.DEFAULT);
        ctx.save();
        ctx.font = `700 13px ${Theme.fonts.display}`;
        ctx.fillStyle = Theme.colors.flag.DEFAULT;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("解锁新成就", r.x + 42, r.y + 10);
        ctx.font = `400 11px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.fillText(id, r.x + 42, r.y + 28);
        ctx.restore();
        y += 56;
      }
      y += 8;
    }

    // 按钮：再测一次 / 返回学习中心
    const btnH = 48;
    const gap = 8;
    const btnW = (w - gap) / 2;
    const retryBtn: Rect = { x: pad, y, w: btnW, h: btnH };
    const backBtn: Rect = { x: pad + btnW + gap, y, w: btnW, h: btnH };
    drawButton(ctx, retryBtn.x, retryBtn.y, retryBtn.w, retryBtn.h, "再测一次", {
      variant: "ghost", accent,
      pressed: this.pressedButton === "retry",
    });
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "返回中心", {
      variant: "primary", accent,
      pressed: this.pressedButton === "done",
    });
    y += btnH + 24;

    this.contentH = y;
  }

  private levelAccent(level: string): string {
    if (level === "basic") return Theme.colors.safe.DEFAULT;
    if (level === "intermediate") return Theme.colors.neon.DEFAULT;
    return Theme.colors.flag.DEFAULT;
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    let line = "";
    let yy = y;
    let lines = 0;
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = ch;
        yy += lineHeight;
        lines++;
      } else {
        line = test;
      }
    }
    if (line) { ctx.fillText(line, x, yy); lines++; }
    return lines * lineHeight;
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenH = this.director.screenHeight;
    const backBtn: Rect = { x: 12, y: 12, w: 40, h: 32 };

    if (type === "start") {
      this.dragDist = 0;
      if (hitTest(x, y, backBtn)) { this.pressedButton = "back"; return true; }

      // 各阶段按钮
      const pad = 16;
      const w = this.director.screenWidth - pad * 2;

      if (this.phase === "intro") {
        const startBtn = this.introStartButtonRect(pad, w);
        if (startBtn && hitTest(x, y, { x: startBtn.x, y: startBtn.y - this.scrollY, w: startBtn.w, h: startBtn.h })) {
          this.pressedButton = "start";
          return true;
        }
      } else if (this.phase === "quiz") {
        // 选项
        const q = this.currentQuestion;
        if (q) {
          const cardTop = 72 + 30;
          const cardH = 220;
          const optsStart = cardTop + cardH + 14;
          const optH = 48;
          const optGap = 8;
          for (let i = 0; i < q.options.length; i++) {
            const optY = optsStart + i * (optH + optGap);
            const optRect: Rect = { x: pad, y: optY - this.scrollY, w, h: optH };
            if (hitTest(x, y, optRect)) { this.pressedButton = `opt-${i}`; return true; }
          }
          // 提交按钮
          const submitY = optsStart + q.options.length * (optH + optGap) + 14;
          const submitRect: Rect = { x: pad, y: submitY - this.scrollY, w, h: 48 };
          if (hitTest(x, y, submitRect)) { this.pressedButton = "submit"; return true; }
        }
      } else if (this.phase === "reveal") {
        const nextBtn = this.revealNextButtonRect(pad, w);
        if (nextBtn && hitTest(x, y, { x: nextBtn.x, y: nextBtn.y - this.scrollY, w: nextBtn.w, h: nextBtn.h })) {
          this.pressedButton = "next";
          return true;
        }
      } else if (this.phase === "result") {
        const btns = this.resultButtonRects(pad, w);
        if (hitTest(x, y, { x: btns.retry.x, y: btns.retry.y - this.scrollY, w: btns.retry.w, h: btns.retry.h })) {
          this.pressedButton = "retry"; return true;
        }
        if (hitTest(x, y, { x: btns.done.x, y: btns.done.y - this.scrollY, w: btns.done.w, h: btns.done.h })) {
          this.pressedButton = "done"; return true;
        }
      }

      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      this.isDragging = true;
      return true;
    } else if (type === "move") {
      if (this.isDragging) {
        const dy = y - this.dragStartY;
        this.dragDist = Math.max(this.dragDist, Math.abs(dy));
        // quiz/reveal 阶段不滚动（内容已限制在屏内）
        if (this.phase === "intro" || this.phase === "result") {
          this.scrollY = Math.max(0, Math.min(Math.max(0, this.contentH - screenH + 40), this.dragStartScroll - dy));
        }
      }
      return false;
    } else if (type === "end") {
      if (this.pressedButton === "back" && hitTest(x, y, backBtn)) {
        playSfx("click");
        this.director.pop("slide");
        postFX.flash(Theme.colors.neon.DEFAULT, 0.3);
      } else if (this.pressedButton === "start") {
        playSfx("click");
        this.startQuiz();
      } else if (this.pressedButton === "submit") {
        this.submitAnswer();
      } else if (this.pressedButton && this.pressedButton.startsWith("opt-")) {
        const idx = parseInt(this.pressedButton.slice(4));
        this.toggleOption(idx);
      } else if (this.pressedButton === "next") {
        playSfx("click");
        this.nextQuestion();
      } else if (this.pressedButton === "retry") {
        playSfx("click");
        this.startQuiz();
      } else if (this.pressedButton === "done") {
        playSfx("click");
        this.director.pop("slide");
        postFX.flash(Theme.colors.neon.DEFAULT, 0.3);
      }
      this.pressedButton = null;
      this.isDragging = false;
      return false;
    }
    return false;
  }

  private introStartButtonRect(pad: number, w: number): Rect | null {
    // 估算 y 位置（与 renderIntro 一致）
    if (!this.lesson) return null;
    const lesson = this.lesson;
    // hero 高度从 110 扩到 132，故 hero 段从 124 改为 146（132+14）
    let y = 72 + 146 + 16 + 16; // hero + 识别要点 label
    y += lesson.codex.points.length * 26 + 18 + 14; // 识别要点 panel
    y += 16 + 56 + 16; // response label + panel
    if (lesson.tips.length > 0) {
      y += 16 + lesson.tips.length * (64 + 8) + 8;
    }
    y += 16 + 80 + 16; // quiz 预告 label + panel
    return { x: pad, y, w, h: 52 };
  }

  private revealNextButtonRect(pad: number, w: number): Rect | null {
    if (!this.lesson || !this.currentQuestion) return null;
    const cardTop = 72 + 30;
    const cardH = 220;
    const optsStart = cardTop + cardH + 14;
    const optH = 48;
    const optGap = 8;
    const opts = this.currentQuestion.options;
    const submitY = optsStart + opts.length * (optH + optGap) + 14;
    const explainH = 100;
    const nextY = submitY + explainH + 14;
    return { x: pad, y: nextY, w, h: 48 };
  }

  private resultButtonRects(pad: number, w: number): { retry: Rect; done: Rect } {
    const gap = 8;
    const btnW = (w - gap) / 2;
    const btnH = 48;
    let y = 80 + 174 + 16 + 16 + 96 + 16;
    if (this.newAchievements.length > 0) {
      y += 16 + this.newAchievements.length * 56 + 8;
    }
    return {
      retry: { x: pad, y, w: btnW, h: btnH },
      done: { x: pad + btnW + gap, y, w: btnW, h: btnH },
    };
  }

  // ============ 测验逻辑 ============
  private startQuiz(): void {
    if (!this.lesson) return;
    this.quizIndex = 0;
    this.quizCorrect = 0;
    this.quizWrong = 0;
    this.selectedIdx = null;
    this.multiSelected = [];
    this.answered = false;
    this.currentQuestion = this.lesson.quiz[0] ?? null;
    this.phase = "quiz";
    this.scrollY = 0;
    postFX.flash(Theme.colors.neon.DEFAULT, 0.3);
  }

  private toggleOption(idx: number): void {
    if (!this.currentQuestion || this.phase !== "quiz") return;
    const q = this.currentQuestion;
    if (q.kind === "multi") {
      if (this.multiSelected.includes(idx)) {
        this.multiSelected = this.multiSelected.filter((i) => i !== idx);
      } else {
        this.multiSelected = [...this.multiSelected, idx];
      }
      playSfx("click");
    } else {
      this.selectedIdx = idx;
      playSfx("click");
    }
  }

  private submitAnswer(): void {
    if (!this.currentQuestion || this.phase !== "quiz") return;
    const q = this.currentQuestion;
    const isMulti = q.kind === "multi";
    const hasSel = isMulti ? this.multiSelected.length > 0 : this.selectedIdx !== null;
    if (!hasSel) return;

    this.answered = true;
    const correct = this.lastAnswerCorrect();
    if (correct) {
      this.quizCorrect++;
      playSfx("good");
      postFX.flash(Theme.colors.safe.DEFAULT, 0.4);
      this.spawnBurst(Theme.colors.safe.DEFAULT, 24);
    } else {
      this.quizWrong++;
      playSfx("bad");
      postFX.shake(8, 0.3);
      postFX.flash(Theme.colors.warn.DEFAULT, 0.4);
    }
    this.phase = "reveal";
    this.revealAt = this.t;
  }

  private nextQuestion(): void {
    if (!this.lesson) return;
    if (this.quizIndex >= this.lesson.quiz.length - 1) {
      this.finishQuiz();
      return;
    }
    this.quizIndex++;
    this.currentQuestion = this.lesson.quiz[this.quizIndex];
    this.selectedIdx = null;
    this.multiSelected = [];
    this.answered = false;
    this.phase = "quiz";
  }

  private finishQuiz(): void {
    if (!this.lesson) return;
    this.resultCorrect = this.quizCorrect;
    this.resultTotal = this.lesson.quiz.length;
    const passed = this.quizCorrect >= this.lesson.passCorrect;
    const newly = platformStore.recordLearning({
      typeId: this.lesson.typeId,
      correct: this.quizCorrect,
      total: this.lesson.quiz.length,
      completed: passed,
    });
    this.newAchievements = newly.map((a) => a.name);
    this.phase = "result";
    this.scrollY = 0;
    if (passed) {
      playSfx("win");
      postFX.flash(Theme.colors.safe.DEFAULT, 0.6);
      this.spawnBurst(Theme.colors.flag.DEFAULT, 60);
    } else {
      playSfx("bad");
    }
  }

  private spawnBurst(color: string, count: number): void {
    const cx = this.director.screenWidth / 2;
    const cy = this.director.screenHeight / 2;
    for (let i = 0; i < count; i++) {
      this.particles.spawn({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 60,
        count: 1,
        speed: 80 + Math.random() * 120,
        life: 0.8 + Math.random() * 0.6,
        size: 1.5 + Math.random() * 2,
        color,
        spread: Math.PI * 2,
        angle: Math.random() * Math.PI * 2,
        friction: 0.92,
      });
    }
  }
}
