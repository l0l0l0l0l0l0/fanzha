/**
 * 知识闯关（ManagerQuizModeScene）
 * v9 Phase 4.3：5 关卡 × 10 题的反诈知识闯关
 * - 三种题型：single 单选 / multi 多选 / judge 判断
 * - 答错自动入错题本，答对递减错次
 * - 通关解锁下一关 + 奖励金币/情报/碎片/反诈积分
 * - 关卡选择 → 答题 → 结果三阶段
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawBackground, drawPanel, hitTest } from "@/ui/widgets";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ManagerDeployScene } from "./ManagerDeployScene";
import { QUIZ_LEVELS, type QuizModeLevel, type QuizModeQuestion } from "@/games/manager/quizData";

// ============ 字号令牌 ============

const FONT_TITLE = 30;
const FONT_SUBTITLE = 16;
const FONT_BODY = 16;
const FONT_QUESTION = 18;
const FONT_OPTION = 15;
const FONT_BTN = 17;
const FONT_META = 13;

const COLOR_PASS = "#52C41A";
const COLOR_FAIL = "#E5353B";
const COLOR_LOCK = "#7A8896";

// ============ 场景状态 ============

type QuizPhase = "select" | "play" | "result";

interface QuestionResult {
  questionId: string;
  correct: boolean;
  userAnswer: string;
}

export class ManagerQuizModeScene extends Scene {
  private phase: QuizPhase = "select";
  private currentLevel: QuizModeLevel | null = null;
  private currentQuestionIdx = 0;
  /** 当前题目的已选选项索引集合（multi 支持多选） */
  private selectedIdx: Set<number> = new Set();
  /** 是否已确认作答（确认后展示解析） */
  private answered = false;
  /** 答题结果记录 */
  private results: QuestionResult[] = [];
  /** 按下状态 */
  private pressedBtn: string | null = null;
  /** 入场动画 */
  private phaseT = 0;
  /** 答对题数 */
  private correctCount = 0;
  /** 结果阶段是否通关 */
  private passed = false;
  /** 是否为新通关（用于奖励提示） */
  private isNewClear = false;
  /** 上一帧渲染时的选项矩形缓存（避免 render 与 hitTest layout 不同步） */
  private lastOptionRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  /** 上一帧渲染时的底部按钮矩形（play 阶段） */
  private lastBottomBtnRect: { x: number; y: number; w: number; h: number } | null = null;

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.phase = "select";
    this.phaseT = 0;
    this.currentLevel = null;
    this.pressedBtn = null;
  }

  update(dt: number): void {
    super.update(dt);
    this.phaseT += dt;
  }

  // ============ 渲染入口 ============

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);
    switch (this.phase) {
      case "select":
        this.renderSelect(ctx, screenW, screenH);
        break;
      case "play":
        this.renderPlay(ctx, screenW, screenH);
        break;
      case "result":
        this.renderResult(ctx, screenW, screenH);
        break;
    }
  }

  // ============ select：关卡选择 ============

  private renderSelect(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const cx = sw / 2;

    // 标题
    ctx.font = `900 ${FONT_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = Theme.colors.neon.DEFAULT;
    ctx.shadowBlur = 12;
    ctx.fillText("🧠 知识闯关", cx, sh * 0.09);
    ctx.shadowBlur = 0;

    ctx.font = `400 ${FONT_SUBTITLE}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    const clearedCount = platformStore.getQuizClearedCount();
    ctx.fillText(`5 关卡 · 共 50 题 · 已通关 ${clearedCount}/5`, cx, sh * 0.14);

    // 错题本入口提示
    const wqStats = platformStore.getWrongQuestionStats();
    const totalWrong = wqStats.quiz + wqStats.dialog + wqStats.case + wqStats.battle;
    if (totalWrong > 0) {
      ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.warn.glow;
      ctx.fillText(`错题本：${totalWrong} 题（剧情→错题强化 可重练）`, cx, sh * 0.175);
    }

    // 关卡卡片（5 关卡纵向排列）
    const cardW = sw * 0.78;
    const cardH = 72;
    const cardGap = 10;
    const startY = sh * 0.22;

    for (let i = 0; i < QUIZ_LEVELS.length; i++) {
      const lv = QUIZ_LEVELS[i];
      const y = startY + i * (cardH + cardGap);
      const x = (sw - cardW) / 2;
      const isCleared = platformStore.isQuizLevelCleared(lv.id);
      const isLocked = !this.isLevelUnlocked(lv);
      const isPressed = this.pressedBtn === `lv_${i}`;
      const accent = isLocked ? COLOR_LOCK : lv.color;

      drawPanel(ctx, x, y, cardW, cardH, {
        borderColor: accent,
        borderWidth: isCleared ? 2 : 1,
        bgColor: withAlpha(accent, isLocked ? 0.04 : 0.08),
      });

      // emoji
      ctx.font = `900 36px ${Theme.fonts.display}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isLocked ? COLOR_LOCK : lv.color;
      ctx.fillText(isLocked ? "🔒" : lv.emoji, x + 16, y + cardH / 2);

      // 名称
      ctx.font = `700 ${FONT_BTN + 2}px ${Theme.fonts.display}`;
      ctx.fillStyle = isLocked ? COLOR_LOCK : lv.color;
      ctx.fillText(lv.name, x + 64, y + 22);

      // 副标题
      ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText(lv.subtitle, x + 64, y + 44);

      // 通关标记 / 高分 / 锁定原因
      ctx.textAlign = "right";
      if (isLocked) {
        ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
        ctx.fillStyle = COLOR_LOCK;
        ctx.fillText(`需通关「${QUIZ_LEVELS.find((l) => l.id === lv.prerequisite)?.name ?? "?"}」`, x + cardW - 16, y + cardH / 2);
      } else if (isCleared) {
        const hs = platformStore.getQuizHighScore(lv.id);
        ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
        ctx.fillStyle = COLOR_PASS;
        ctx.fillText(`✓ 已通关 · 最高 ${hs}`, x + cardW - 16, y + cardH / 2);
      } else {
        ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
        ctx.fillStyle = lv.color;
        ctx.fillText(`通关 ${lv.passCount}/${lv.questions.length} 题`, x + cardW - 16, y + cardH / 2);
      }

      if (isPressed) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, cardW, cardH);
      }
    }

    ctx.textAlign = "center";

    // 返回按钮
    const backW = 180;
    const backH = 44;
    const backX = cx - backW / 2;
    const backY = sh - 60;
    this.drawButton(ctx, backX, backY, backW, backH, "← 返回菜单", Theme.colors.ink.dim, "back");
  }

  // ============ play：答题阶段 ============

  private renderPlay(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    if (!this.currentLevel) return;
    const lv = this.currentLevel;
    const q = lv.questions[this.currentQuestionIdx];
    if (!q) return;
    const cx = sw / 2;

    // 顶部信息栏
    ctx.fillStyle = withAlpha(lv.color, 0.1);
    ctx.fillRect(0, 0, sw, 52);
    ctx.fillStyle = lv.color;
    ctx.fillRect(0, 52, sw, 2);

    ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = lv.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${lv.emoji} ${lv.name}`, 16, 26);

    // 进度
    ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.fillText(`第 ${this.currentQuestionIdx + 1} / ${lv.questions.length} 题`, cx, 26);

    // 当前正确数
    ctx.textAlign = "right";
    ctx.fillStyle = COLOR_PASS;
    ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillText(`✓ ${this.correctCount}`, sw - 16, 26);

    // 题型标签 + 题干
    const qStartY = 72;
    const typeLabel = q.type === "single" ? "单选" : q.type === "multi" ? "多选" : "判断";
    const typeColor = q.type === "single" ? "#1B5FCC" : q.type === "multi" ? "#9D6BFF" : "#FFB020";

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
    ctx.fillStyle = typeColor;
    ctx.fillText(`【${typeLabel}题】${q.category}`, 24, qStartY);

    // 题干（自动换行）
    ctx.font = `500 ${FONT_QUESTION}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const qLines = this.wrapText(ctx, q.question, sw - 48);
    qLines.forEach((line, i) => {
      ctx.fillText(line, 24, qStartY + 22 + i * 26);
    });

    // 选项
    const optStartY = qStartY + 22 + qLines.length * 26 + 16;
    const optW = sw - 48;
    const optH = 40;
    const optGap = 8;
    this.lastOptionRects = [];
    for (let i = 0; i < q.options.length; i++) {
      const oy = optStartY + i * (optH + optGap);
      const ox = 24;
      this.lastOptionRects.push({ x: ox, y: oy, w: optW, h: optH });
      this.drawOption(ctx, ox, oy, optW, optH, q, i);
    }

    // 解析（已作答时显示）
    if (this.answered) {
      const explainY = optStartY + q.options.length * (optH + optGap) + 12;
      const isCorrect = this.isAnswerCorrect(q);
      const explainColor = isCorrect ? COLOR_PASS : COLOR_FAIL;

      drawPanel(ctx, 24, explainY, sw - 48, 60, {
        borderColor: explainColor,
        borderWidth: 1,
        bgColor: withAlpha(explainColor, 0.08),
      });

      ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
      ctx.fillStyle = explainColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(isCorrect ? "✓ 答对！" : "✗ 答错", 36, explainY + 10);

      ctx.font = `400 ${FONT_META}px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const exLines = this.wrapText(ctx, q.explanation, sw - 48 - 24);
      exLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, 36, explainY + 30 + i * 16);
      });

      // 下一题按钮
      const btnW = 200;
      const btnH = 44;
      const btnX = (sw - btnW) / 2;
      const btnY = sh - 60;
      this.lastBottomBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
      const isLast = this.currentQuestionIdx >= lv.questions.length - 1;
      this.drawButton(ctx, btnX, btnY, btnW, btnH, isLast ? "查看结果 ▶" : "下一题 ▶", lv.color, "next");
    } else {
      // 提交按钮（multi 题需要选中至少一项）
      const btnW = 200;
      const btnH = 44;
      const btnX = (sw - btnW) / 2;
      const btnY = sh - 60;
      this.lastBottomBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
      const canSubmit = this.selectedIdx.size > 0;
      this.drawButton(
        ctx, btnX, btnY, btnW, btnH,
        "提交答案",
        canSubmit ? lv.color : Theme.colors.ink.dim,
        "submit",
        !canSubmit,
      );
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  }

  private drawOption(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    q: QuizModeQuestion, idx: number,
  ): void {
    const isSelected = this.selectedIdx.has(idx);
    const isPressed = this.pressedBtn === `opt_${idx}`;
    const isCorrect = this.answered && q.correct.split(",").map((s) => s.trim()).includes(String(idx));
    const isWrongPick = this.answered && isSelected && !isCorrect;

    let borderColor: string = Theme.colors.bg.line;
    let bgColor: string = withAlpha(Theme.colors.bg.card, 0.7);
    if (isSelected && !this.answered) {
      borderColor = q.type === "multi" ? "#9D6BFF" : "#1B5FCC";
      bgColor = withAlpha(borderColor, 0.12);
    } else if (isCorrect) {
      borderColor = COLOR_PASS;
      bgColor = withAlpha(COLOR_PASS, 0.15);
    } else if (isWrongPick) {
      borderColor = COLOR_FAIL;
      bgColor = withAlpha(COLOR_FAIL, 0.15);
    }

    const offsetY = isPressed ? 2 : 0;
    ctx.save();
    ctx.fillStyle = bgColor;
    this.roundRect(ctx, x, y + offsetY, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = (isSelected || isCorrect || isWrongPick) ? 2 : 1;
    ctx.stroke();

    // 选项标记：single/judge = A/B/C/D，multi = ☐/☑
    const label = q.type === "multi"
      ? (isSelected ? "☑" : "☐")
      : String.fromCharCode(65 + idx);

    ctx.font = `900 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = isCorrect ? COLOR_PASS : isWrongPick ? COLOR_FAIL : borderColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 14, y + offsetY + h / 2);

    // 选项文字
    ctx.font = `400 ${FONT_OPTION}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const optText = q.options[idx];
    const optLines = this.wrapText(ctx, optText, w - 50);
    optLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, x + 36, y + offsetY + h / 2 - (optLines.length - 1) * 8 + i * 16);
    });

    // 已作答时显示正确/错误标记
    if (this.answered) {
      ctx.textAlign = "right";
      if (isCorrect) {
        ctx.font = `900 18px ${Theme.fonts.display}`;
        ctx.fillStyle = COLOR_PASS;
        ctx.fillText("✓", x + w - 12, y + offsetY + h / 2);
      } else if (isWrongPick) {
        ctx.font = `900 18px ${Theme.fonts.display}`;
        ctx.fillStyle = COLOR_FAIL;
        ctx.fillText("✗", x + w - 12, y + offsetY + h / 2);
      }
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  // ============ result：结果页 ============

  private renderResult(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    if (!this.currentLevel) return;
    const lv = this.currentLevel;
    const cx = sw / 2;
    const total = lv.questions.length;
    const score = this.correctCount * 10; // 每题 10 分

    // 标题
    const titleColor = this.passed ? COLOR_PASS : COLOR_FAIL;
    const titleText = this.passed ? "🎉 通关成功！" : "💔 未通过";

    ctx.font = `900 ${FONT_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = titleColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = titleColor;
    ctx.shadowBlur = 14;
    ctx.fillText(titleText, cx, sh * 0.12);
    ctx.shadowBlur = 0;

    // 分数与统计
    ctx.font = `700 ${FONT_BTN + 6}px ${Theme.fonts.display}`;
    ctx.fillStyle = lv.color;
    ctx.fillText(`${score} 分`, cx, sh * 0.20);

    ctx.font = `400 ${FONT_BODY}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(`答对 ${this.correctCount} / ${total} · 通关需 ${lv.passCount} 题`, cx, sh * 0.26);

    // 奖励卡片
    if (this.passed) {
      const cardY = sh * 0.32;
      const cardH = sh * 0.22;
      const cardX = sw * 0.15;
      const cardW = sw * 0.70;

      drawPanel(ctx, cardX, cardY, cardW, cardH, {
        borderColor: COLOR_PASS,
        borderWidth: 2,
        bgColor: withAlpha(COLOR_PASS, 0.06),
      });

      ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
      ctx.fillStyle = COLOR_PASS;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${this.isNewClear ? "🎁 首通奖励" : "📊 通关奖励"}`, cardX + 20, cardY + 14);

      // 奖励项
      const rewards = lv.rewards;
      const items: Array<[string, number, string]> = [
        ["💰 金币", rewards.coins, "#FFD666"],
        ["📜 情报", rewards.intel, "#00E5FF"],
        ["🧩 碎片", rewards.fragments, "#9D6BFF"],
        ["⭐ 反诈积分", rewards.antiFraudPoints, "#FF8A3D"],
      ];
      const itemW = (cardW - 40) / items.length;
      items.forEach(([label, value, color], i) => {
        const ix = cardX + 20 + i * itemW;
        ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.fillText(label, ix, cardY + 50);
        ctx.font = `700 ${FONT_BTN + 4}px ${Theme.fonts.display}`;
        ctx.fillStyle = color;
        ctx.fillText(`+${value}`, ix, cardY + 70);
      });

      // 错题情况
      const wrongInThisRun = this.results.filter((r) => !r.correct).length;
      ctx.font = `400 ${FONT_META}px ${Theme.fonts.body}`;
      ctx.fillStyle = wrongInThisRun > 0 ? Theme.colors.warn.glow : Theme.colors.ink.muted;
      ctx.fillText(
        wrongInThisRun > 0
          ? `本局答错 ${wrongInThisRun} 题，已加入错题本可在「剧情→错题强化」重练`
          : "✨ 完美通关！本局无错题",
        cardX + 20,
        cardY + cardH - 22,
      );
    } else {
      // 未通关提示
      const cardY = sh * 0.32;
      const cardH = sh * 0.22;
      const cardX = sw * 0.15;
      const cardW = sw * 0.70;

      drawPanel(ctx, cardX, cardY, cardW, cardH, {
        borderColor: COLOR_FAIL,
        borderWidth: 2,
        bgColor: withAlpha(COLOR_FAIL, 0.06),
      });

      ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
      ctx.fillStyle = COLOR_FAIL;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("📚 再接再厉", cardX + 20, cardY + 14);

      ctx.font = `400 ${FONT_BODY}px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const tipLines = this.wrapText(ctx, `需答对 ${lv.passCount} 题方可通关。本局答错的题目已自动加入错题本，可在「剧情→错题强化」中针对性重练。`, cardW - 40);
      tipLines.forEach((line, i) => {
        ctx.fillText(line, cardX + 20, cardY + 50 + i * 22);
      });
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 按钮
    const btnW = 180;
    const btnH = 46;
    const gap = 16;
    const retryX = cx - btnW - gap / 2;
    const backX = cx + gap / 2;
    const btnY = sh * 0.78;

    this.drawButton(ctx, retryX, btnY, btnW, btnH, "🔄 再战一次", lv.color, "retry");
    this.drawButton(ctx, backX, btnY, btnW, btnH, "← 返回选关", Theme.colors.ink.dim, "to_select");

    // 96110
    ctx.font = `400 ${FONT_META}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.fillText("📞 遇到诈骗请拨打 96110", cx, sh * 0.90);
  }

  // ============ 触摸交互 ============

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (type === "start") {
      this.pressedBtn = this.hitTestButton(x, y);
      return this.pressedBtn !== null;
    }
    if (type === "end") {
      const btn = this.hitTestButton(x, y);
      if (btn && btn === this.pressedBtn) {
        this.onButtonPress(btn);
      }
      this.pressedBtn = null;
      return btn !== null;
    }
    return false;
  }

  private hitTestButton(x: number, y: number): string | null {
    const sw = this.director.screenWidth;
    const sh = this.director.screenHeight;
    const cx = sw / 2;

    switch (this.phase) {
      case "select": {
        const cardW = sw * 0.78;
        const cardH = 72;
        const cardGap = 10;
        const startY = sh * 0.22;
        for (let i = 0; i < QUIZ_LEVELS.length; i++) {
          const cy = startY + i * (cardH + cardGap);
          const cxi = (sw - cardW) / 2;
          if (hitTest(x, y, { x: cxi, y: cy, w: cardW, h: cardH })) return `lv_${i}`;
        }
        const backW = 180, backH = 44;
        const backX = cx - backW / 2, backY = sh - 60;
        if (hitTest(x, y, { x: backX, y: backY, w: backW, h: backH })) return "back";
        return null;
      }

      case "play": {
        // 复用上一帧渲染时缓存的选项矩形，避免 layout 估算偏差
        for (let i = 0; i < this.lastOptionRects.length; i++) {
          const r = this.lastOptionRects[i];
          if (hitTest(x, y, r)) return `opt_${i}`;
        }
        // 底部按钮
        if (this.lastBottomBtnRect && hitTest(x, y, this.lastBottomBtnRect)) {
          return this.answered ? "next" : "submit";
        }
        return null;
      }

      case "result": {
        const btnW = 180, btnH = 46, gap = 16;
        const retryX = cx - btnW - gap / 2, backX = cx + gap / 2, btnY = sh * 0.78;
        if (hitTest(x, y, { x: retryX, y: btnY, w: btnW, h: btnH })) return "retry";
        if (hitTest(x, y, { x: backX, y: btnY, w: btnW, h: btnH })) return "to_select";
        return null;
      }
    }
    return null;
  }

  private onButtonPress(btn: string): void {
    playSfx("click");
    vibrateShort();

    if (btn === "back") {
      this.director.replace(new ManagerDeployScene(this.director));
      return;
    }

    if (btn === "to_select") {
      this.phase = "select";
      this.phaseT = 0;
      this.currentLevel = null;
      this.results = [];
      this.correctCount = 0;
      return;
    }

    if (btn === "retry") {
      if (this.currentLevel) {
        this.startLevel(this.currentLevel);
      }
      return;
    }

    if (this.phase === "select" && btn.startsWith("lv_")) {
      const idx = parseInt(btn.split("_")[1]);
      if (!isNaN(idx) && idx >= 0 && idx < QUIZ_LEVELS.length) {
        const lv = QUIZ_LEVELS[idx];
        if (this.isLevelUnlocked(lv)) {
          this.startLevel(lv);
        }
      }
      return;
    }

    if (this.phase === "play") {
      if (btn.startsWith("opt_")) {
        if (this.answered) return;
        const idx = parseInt(btn.split("_")[1]);
        const q = this.currentLevel!.questions[this.currentQuestionIdx];
        if (q.type === "multi") {
          // 多选：切换选中
          if (this.selectedIdx.has(idx)) {
            this.selectedIdx.delete(idx);
          } else {
            this.selectedIdx.add(idx);
          }
        } else {
          // 单选/判断：唯一选中
          this.selectedIdx.clear();
          this.selectedIdx.add(idx);
        }
        return;
      }

      if (btn === "submit" && this.selectedIdx.size > 0) {
        this.submitAnswer();
        return;
      }

      if (btn === "next") {
        this.nextQuestion();
        return;
      }
    }
  }

  // ============ 答题逻辑 ============

  private startLevel(lv: QuizModeLevel): void {
    this.currentLevel = lv;
    this.currentQuestionIdx = 0;
    this.selectedIdx.clear();
    this.answered = false;
    this.results = [];
    this.correctCount = 0;
    this.phase = "play";
    this.phaseT = 0;
  }

  private submitAnswer(): void {
    if (!this.currentLevel) return;
    const q = this.currentLevel.questions[this.currentQuestionIdx];
    const userArr = Array.from(this.selectedIdx).sort((a, b) => a - b);
    const userAnswer = userArr.join(",");
    const correct = this.isAnswerCorrect(q);

    this.answered = true;
    this.results.push({ questionId: q.id, correct, userAnswer });

    if (correct) {
      this.correctCount += 1;
      playSfx("good");
    } else {
      playSfx("bad");
    }

    // 写入错题本（同时维护 wrongCount）
    platformStore.recordWrongQuestion({
      questionId: q.id,
      source: "quiz",
      questionType: q.type,
      questionText: q.question,
      options: q.options,
      correctAnswer: q.correct,
      userAnswer,
      category: q.category,
      relatedCaseId: q.relatedCaseId,
      explanation: q.explanation,
      correct,
    });

    // 同步 quizTotalCount / quizCorrectCount（与战间答题共用统计）
    platformStore.recordQuizAnswer(correct);
  }

  private nextQuestion(): void {
    if (!this.currentLevel) return;
    if (this.currentQuestionIdx >= this.currentLevel.questions.length - 1) {
      // 进入结果阶段
      this.finishLevel();
      return;
    }
    this.currentQuestionIdx += 1;
    this.selectedIdx.clear();
    this.answered = false;
  }

  private finishLevel(): void {
    if (!this.currentLevel) return;
    const lv = this.currentLevel;
    this.passed = this.correctCount >= lv.passCount;
    const score = this.correctCount * 10;
    if (this.passed) {
      this.isNewClear = platformStore.recordQuizLevelCleared(lv.id, score);
      // 发放奖励（首通发放全部；重复通关只发反诈积分 50%）
      if (this.isNewClear) {
        platformStore.addResources({
          coins: lv.rewards.coins,
          fragments: lv.rewards.fragments,
        });
        platformStore.addManagerMetaResources({
          intel: lv.rewards.intel,
          antiFraudPoints: lv.rewards.antiFraudPoints,
        });
      } else {
        platformStore.addManagerMetaResources({
          antiFraudPoints: Math.floor(lv.rewards.antiFraudPoints * 0.5),
        });
      }
    }
    this.phase = "result";
    this.phaseT = 0;
  }

  // ============ 辅助方法 ============

  private isLevelUnlocked(lv: QuizModeLevel): boolean {
    if (!lv.prerequisite) return true;
    return platformStore.isQuizLevelCleared(lv.prerequisite);
  }

  private isAnswerCorrect(q: QuizModeQuestion): boolean {
    const userArr = Array.from(this.selectedIdx).map((i) => String(i)).sort();
    const correctArr = q.correct.split(",").map((s) => s.trim()).sort();
    return userArr.length === correctArr.length && userArr.every((v, i) => v === correctArr[i]);
  }

  private drawButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    text: string, color: string, id: string,
    disabled = false,
  ): void {
    const pressed = this.pressedBtn === id;
    const offsetY = pressed ? 2 : 0;
    ctx.save();
    if (disabled) {
      ctx.fillStyle = withAlpha(Theme.colors.bg.card, 0.5);
    } else {
      ctx.fillStyle = pressed ? withAlpha(color, 0.8) : color;
    }
    this.roundRect(ctx, x, y + offsetY, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = disabled ? Theme.colors.bg.line : withAlpha(color, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = disabled ? Theme.colors.ink.dim : "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (!disabled) {
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 3;
    }
    ctx.fillText(text, x + w / 2, y + offsetY + h / 2);
    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let current = "";
    for (const ch of text) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }
}
