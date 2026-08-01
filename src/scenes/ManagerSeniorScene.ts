/**
 * 适老模式（ManagerSeniorScene）
 * v9 Phase 4.1：专为老年玩家设计的案例教学模式
 * - 大字号（24-40px）、高对比度、慢节奏
 * - 案例教学为主，操作简化（3 选 1 大按钮）
 * - 每题展示真实案例 → 选择应对方式 → 显示解析
 * - 无时间压力，答错也显示正确答案与解释
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawBackground, drawPanel, hitTest } from "@/ui/widgets";
import { REAL_CASES } from "@/games/manager/data.v7";
import type { RealCaseDef } from "@/games/manager/types";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort } from "@/platform/web";
import { ManagerDeployScene } from "./ManagerDeployScene";

// ============ 适老模式专用设计令牌 ============
// 字号比常规场景大 60-80%，确保老年玩家无障碍阅读

const FONT_TITLE = 44;      // 页面标题
const FONT_CASE_TITLE = 36; // 案例标题
const FONT_BODY = 26;       // 正文（案例描述）
const FONT_TIP = 24;        // 解析提示
const FONT_BTN = 30;        // 按钮文字
const FONT_META = 20;       // 进度/辅助信息

const COLOR_CORRECT = "#52C41A";   // 答对 - 绿色
const COLOR_WRONG = "#E5353B";     // 答错 - 红色
const COLOR_CASE = "#FFB020";      // 案例主题色
const COLOR_ACTION = "#1B5FCC";    // 应对选项色

// ============ 场景状态 ============

type SeniorPhase = "intro" | "study" | "choose" | "explain" | "done";

/** 单道题目的运行时数据 */
interface SeniorQuestion {
  case: RealCaseDef;
  /** 3 个选项（1 正确 + 2 干扰） */
  options: SeniorOption[];
  /** 正确选项 id */
  correctId: string;
}

interface SeniorOption {
  id: string;
  text: string;
  emoji: string;
  correct: boolean;
}

// ============ 场景类 ============

export class ManagerSeniorScene extends Scene {
  private phase: SeniorPhase = "intro";
  private questions: SeniorQuestion[] = [];
  private currentIdx = 0;
  private score = 0;
  /** 当前阶段选中的选项 id（choose 阶段） */
  private selectedId: string | null = null;
  /** 当前题目是否答对 */
  private lastCorrect = false;
  /** 按钮按下状态（触摸反馈） */
  private pressedBtn: string | null = null;
  /** 入场/状态切换动画进度 */
  private phaseT = 0;

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    this.phase = "intro";
    this.phaseT = 0;
    this.currentIdx = 0;
    this.score = 0;
    this.selectedId = null;
    this.lastCorrect = false;
    this.pressedBtn = null;
    // 从 REAL_CASES 中选取 8 题（混合经典与 2024-2026 新型诈骗）
    this.questions = this.buildQuestions();
  }

  update(dt: number): void {
    super.update(dt);
    this.phaseT += dt;
  }

  // ============ 题目生成 ============

  private buildQuestions(): SeniorQuestion[] {
    // 选取 8 题：4 道经典 + 4 道 2024-2026 新型
    const classic = REAL_CASES.filter((c) => c.year < "2024").slice(0, 4);
    const modern = REAL_CASES.filter((c) => c.year >= "2024").slice(0, 4);
    const selected = [...classic, ...modern];
    return selected.map((c) => this.makeQuestion(c));
  }

  /** 根据案例生成 3 选 1 题目（1 正确 + 2 干扰） */
  private makeQuestion(c: RealCaseDef): SeniorQuestion {
    // 正确选项：从 tip 提取核心动作
    const correctText = this.shortenTip(c.tip);
    const correct: SeniorOption = {
      id: "opt_correct",
      text: correctText,
      emoji: "✅",
      correct: true,
    };

    // 干扰选项：从通用错误行为池中选取 2 个
    const wrongPool = this.getWrongOptions(c);
    const wrongs = wrongPool.slice(0, 2);

    // 随机打乱顺序
    const options = [correct, ...wrongs];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return { case: c, options, correctId: "opt_correct" };
  }

  /** 将 tip 缩短为 20 字以内的行动建议 */
  private shortenTip(tip: string): string {
    // tip 格式通常为"关键词。详细说明。"，取第一句
    const first = tip.split("。")[0];
    return first.length > 20 ? first.slice(0, 18) + "…" : first;
  }

  /** 根据案例类型生成干扰选项 */
  private getWrongOptions(c: RealCaseDef): SeniorOption[] {
    // 通用错误行为池
    const pool: SeniorOption[] = [
      { id: "w_transfer", text: "按对方要求转账", emoji: "💸", correct: false },
      { id: "w_screen", text: "开启屏幕共享", emoji: "📱", correct: false },
      { id: "w_code", text: "提供验证码", emoji: "🔑", correct: false },
      { id: "w_link", text: "点击短信链接", emoji: "🔗", correct: false },
      { id: "w_trust", text: "相信对方身份", emoji: "🤝", correct: false },
      { id: "w_hurry", text: "立即配合操作", emoji: "⚡", correct: false },
      { id: "w_card", text: "告知银行卡号", emoji: "💳", correct: false },
      { id: "w_meet", text: "线下见面交易", emoji: "🚶", correct: false },
    ];
    // 打乱后返回
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ============ 渲染 ============

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    switch (this.phase) {
      case "intro":
        this.renderIntro(ctx, screenW, screenH);
        break;
      case "study":
        this.renderStudy(ctx, screenW, screenH);
        break;
      case "choose":
        this.renderChoose(ctx, screenW, screenH);
        break;
      case "explain":
        this.renderExplain(ctx, screenW, screenH);
        break;
      case "done":
        this.renderDone(ctx, screenW, screenH);
        break;
    }
  }

  // ---- intro：欢迎页 ----

  private renderIntro(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const cx = sw / 2;
    // 入场动画
    const ease = Math.min(1, this.phaseT / 0.5);
    const alpha = ease;
    ctx.save();
    ctx.globalAlpha = alpha;

    // 大标题
    ctx.font = `900 ${FONT_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = Theme.colors.neon.DEFAULT;
    ctx.shadowBlur = 20;
    ctx.fillText("🛡️ 反诈学堂", cx, sh * 0.22);
    ctx.shadowBlur = 0;

    // 副标题
    ctx.font = `700 ${FONT_BODY}px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText("学案例 · 识骗局 · 守钱袋", cx, sh * 0.32);

    // 说明
    ctx.font = `400 ${FONT_TIP}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    const lines = [
      "本模式专为长辈设计",
      "大字号 · 慢节奏 · 案例教学",
      "共 8 道真实案例，答错也会显示解析",
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, cx, sh * 0.42 + i * 40);
    });

    // 开始按钮
    const btnW = 320;
    const btnH = 80;
    const btnX = cx - btnW / 2;
    const btnY = sh * 0.68;
    this.drawBigButton(ctx, btnX, btnY, btnW, btnH, "开始学习 ▶", COLOR_ACTION, "start");

    // 返回按钮
    const backW = 200;
    const backH = 56;
    const backX = cx - backW / 2;
    const backY = btnY + btnH + 24;
    this.drawBigButton(ctx, backX, backY, backW, backH, "← 返回菜单", Theme.colors.ink.dim, "back", FONT_BTN * 0.7);

    ctx.restore();
  }

  // ---- study：案例展示页 ----

  private renderStudy(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const q = this.questions[this.currentIdx];
    if (!q) return;
    const c = q.case;
    const cx = sw / 2;

    // 顶部进度
    this.renderProgress(ctx, sw, sh);

    // 案例标题区
    const cardY = sh * 0.16;
    const cardH = sh * 0.62;
    const cardX = sw * 0.06;
    const cardW = sw * 0.88;

    drawPanel(ctx, cardX, cardY, cardW, cardH, {
      borderColor: c.color,
      borderWidth: 3,
      bgColor: withAlpha(c.color, 0.08),
    });

    // 顶部色条
    ctx.fillStyle = c.color;
    ctx.fillRect(cardX, cardY, cardW, 5);

    // emoji 大图标
    ctx.font = `900 72px ${Theme.fonts.display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.emoji, cx, cardY + 60);

    // 案例标题
    ctx.font = `700 ${FONT_CASE_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = c.color;
    ctx.fillText(c.title, cx, cardY + 120);

    // 年份标签
    ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${c.year} 年 · ${c.victim}`, cx, cardY + 155);

    // 案例描述（自动换行）
    ctx.font = `400 ${FONT_BODY}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const summaryLines = this.wrapText(ctx, c.summary, cardW - 60);
    const summaryStartY = cardY + 185;
    summaryLines.forEach((line, i) => {
      ctx.fillText(line, cardX + 30, summaryStartY + i * 38);
    });

    // 提示用户阅读后继续
    const nextY = cardY + cardH - 80;
    const btnW = 280;
    const btnH = 64;
    this.drawBigButton(ctx, cx - btnW / 2, nextY, btnW, btnH, "我已了解，下一步 ▶", COLOR_ACTION, "next", FONT_BTN * 0.8);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  }

  // ---- choose：选择应对方式 ----

  private renderChoose(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const q = this.questions[this.currentIdx];
    if (!q) return;
    const c = q.case;
    const cx = sw / 2;

    // 顶部进度
    this.renderProgress(ctx, sw, sh);

    // 问题
    ctx.font = `700 ${FONT_CASE_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = COLOR_CASE;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("遇到这种情况应该怎么办？", cx, sh * 0.16);

    // 案例简述（小字提醒）
    ctx.font = `400 ${FONT_META}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    const brief = c.summary.length > 40 ? c.summary.slice(0, 38) + "…" : c.summary;
    ctx.fillText(`${c.emoji} ${brief}`, cx, sh * 0.22);

    // 3 个选项按钮（纵向排列，大按钮）
    const optW = sw * 0.76;
    const optH = 72;
    const optGap = 20;
    const startY = sh * 0.30;

    for (let i = 0; i < q.options.length; i++) {
      const opt = q.options[i];
      const oy = startY + i * (optH + optGap);
      const ox = cx - optW / 2;
      const isPressed = this.pressedBtn === `opt_${i}`;
      this.drawOptionButton(ctx, ox, oy, optW, optH, opt, i, isPressed);
    }
  }

  // ---- explain：解析页 ----

  private renderExplain(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const q = this.questions[this.currentIdx];
    if (!q) return;
    const c = q.case;
    const cx = sw / 2;

    // 顶部进度
    this.renderProgress(ctx, sw, sh);

    // 答对/答错标识
    const resultColor = this.lastCorrect ? COLOR_CORRECT : COLOR_WRONG;
    const resultText = this.lastCorrect ? "✅ 回答正确！" : "❌ 答错了，请注意！";
    ctx.font = `900 ${FONT_CASE_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = resultColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = resultColor;
    ctx.shadowBlur = 12;
    ctx.fillText(resultText, cx, sh * 0.16);
    ctx.shadowBlur = 0;

    // 解析卡片
    const cardY = sh * 0.24;
    const cardH = sh * 0.56;
    const cardX = sw * 0.06;
    const cardW = sw * 0.88;

    drawPanel(ctx, cardX, cardY, cardW, cardH, {
      borderColor: resultColor,
      borderWidth: 2,
      bgColor: withAlpha(resultColor, 0.06),
    });

    // 正确做法
    ctx.font = `700 ${FONT_BODY}px ${Theme.fonts.display}`;
    ctx.fillStyle = COLOR_CORRECT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("✅ 正确做法：", cardX + 24, cardY + 20);

    ctx.font = `400 ${FONT_TIP}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const tipLines = this.wrapText(ctx, c.tip, cardW - 48);
    tipLines.forEach((line, i) => {
      ctx.fillText(line, cardX + 24, cardY + 56 + i * 34);
    });

    // 96110 提示
    const tipEndY = cardY + 56 + tipLines.length * 34 + 16;
    ctx.font = `700 ${FONT_TIP}px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.fillText("📞 96110 提醒：", cardX + 24, tipEndY);

    ctx.font = `400 ${FONT_TIP}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const hotLines = this.wrapText(ctx, c.hotline, cardW - 48);
    hotLines.forEach((line, i) => {
      ctx.fillText(line, cardX + 24, tipEndY + 36 + i * 34);
    });

    // 涉案金额（教育意义）
    const hotEndY = tipEndY + 36 + hotLines.length * 34 + 16;
    if (c.amount > 0) {
      ctx.font = `400 ${FONT_META}px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      const amountStr = c.amount >= 10000
        ? `涉案金额：${(c.amount / 10000).toFixed(1)} 万元`
        : `涉案金额：${c.amount} 元`;
      ctx.fillText(`💰 ${amountStr}  |  破案：${c.bustedBy}`, cardX + 24, hotEndY);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 下一步按钮
    const isLast = this.currentIdx >= this.questions.length - 1;
    const btnText = isLast ? "查看总结 ▶" : "下一题 ▶";
    const btnW = 280;
    const btnH = 64;
    this.drawBigButton(ctx, cx - btnW / 2, sh * 0.84, btnW, btnH, btnText, COLOR_ACTION, "next_explain", FONT_BTN * 0.8);
  }

  // ---- done：总结页 ----

  private renderDone(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const cx = sw / 2;
    const total = this.questions.length;
    const correct = this.score;
    const pct = Math.round((correct / total) * 100);

    // 评价
    let rating = "";
    let ratingColor = "";
    if (pct === 100) { rating = "🏆 反诈达人！"; ratingColor = "#FFD666"; }
    else if (pct >= 75) { rating = "🥈 防骗能手！"; ratingColor = COLOR_CORRECT; }
    else if (pct >= 50) { rating = "🥉 继续加油！"; ratingColor = COLOR_CASE; }
    else { rating = "📚 需要学习！"; ratingColor = COLOR_WRONG; }

    ctx.font = `900 ${FONT_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = ratingColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = ratingColor;
    ctx.shadowBlur = 16;
    ctx.fillText(rating, cx, sh * 0.18);
    ctx.shadowBlur = 0;

    // 分数
    ctx.font = `700 ${FONT_CASE_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(`答对 ${correct} / ${total} 题`, cx, sh * 0.30);

    ctx.font = `400 ${FONT_BODY}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`正确率 ${pct}%`, cx, sh * 0.37);

    // 鼓励语
    ctx.font = `400 ${FONT_TIP}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    const encourage = pct >= 75
      ? "您已具备较强的防骗意识！"
      : "多看案例，才能识破骗局。再练一次吧！";
    ctx.fillText(encourage, cx, sh * 0.44);

    // 按钮
    const btnW = 260;
    const btnH = 72;
    const gap = 24;
    const retryX = cx - btnW - gap / 2;
    const backX = cx + gap / 2;
    const btnY = sh * 0.56;

    this.drawBigButton(ctx, retryX, btnY, btnW, btnH, "🔄 再练一次", COLOR_ACTION, "retry");
    this.drawBigButton(ctx, backX, btnY, btnW, btnH, "← 返回菜单", Theme.colors.ink.dim, "back", FONT_BTN * 0.8);

    // 96110 提醒
    ctx.font = `400 ${FONT_META}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.fillText("📞 遇到诈骗请拨打 96110", cx, sh * 0.72);
  }

  // ============ 辅助渲染 ============

  private renderProgress(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const total = this.questions.length;
    const idx = this.currentIdx + 1;
    ctx.font = `700 ${FONT_META}px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`第 ${idx} / ${total} 题`, sw / 2, 16);

    // 进度条
    const barW = sw * 0.6;
    const barH = 6;
    const barX = (sw - barW) / 2;
    const barY = 44;
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(barX, barY, barW, barH);
    const fillW = barW * (idx / total);
    ctx.fillStyle = COLOR_CASE;
    ctx.fillRect(barX, barY, fillW, barH);
  }

  /** 绘制大按钮（适老专用，比常规按钮更大更清晰） */
  private drawBigButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    text: string, color: string, id: string, fontSize: number = FONT_BTN,
  ): void {
    const pressed = this.pressedBtn === id;
    const offsetY = pressed ? 2 : 0;

    ctx.save();
    // 背景
    ctx.fillStyle = pressed ? withAlpha(color, 0.85) : color;
    this.roundRectPath(ctx, x, y + offsetY, w, h, 12);
    ctx.fill();

    // 边框高光
    ctx.strokeStyle = withAlpha(color, 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();

    // 文字
    ctx.font = `700 ${fontSize}px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 4;
    ctx.fillText(text, x + w / 2, y + offsetY + h / 2);
    ctx.restore();
  }

  /** 绘制选项按钮（choose 阶段） */
  private drawOptionButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    opt: SeniorOption, idx: number, pressed: boolean,
  ): void {
    const offsetY = pressed ? 2 : 0;
    ctx.save();
    // 背景
    ctx.fillStyle = pressed ? withAlpha(COLOR_ACTION, 0.2) : withAlpha(Theme.colors.bg.card, 0.8);
    this.roundRectPath(ctx, x, y + offsetY, w, h, 10);
    ctx.fill();

    // 边框
    ctx.strokeStyle = pressed ? COLOR_ACTION : Theme.colors.bg.line;
    ctx.lineWidth = pressed ? 3 : 1.5;
    ctx.stroke();

    // emoji
    ctx.font = `900 32px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(opt.emoji, x + 20, y + offsetY + h / 2);

    // 文字
    ctx.font = `400 ${FONT_BTN}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(opt.text, x + 64, y + offsetY + h / 2);
    ctx.restore();
  }

  /** 圆角矩形路径 */
  private roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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

  /** 中文文本换行 */
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

  // ============ 触摸交互 ============

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
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

  /** 命中测试：返回按钮 id 或 null */
  private hitTestButton(x: number, y: number): string | null {
    const sw = this.director.screenWidth;
    const sh = this.director.screenHeight;
    const cx = sw / 2;

    switch (this.phase) {
      case "intro": {
        const btnW = 320, btnH = 80;
        const btnX = cx - btnW / 2, btnY = sh * 0.68;
        if (hitTest(x, y, { x: btnX, y: btnY, w: btnW, h: btnH })) return "start";
        const backW = 200, backH = 56;
        const backX = cx - backW / 2, backY = btnY + btnH + 24;
        if (hitTest(x, y, { x: backX, y: backY, w: backW, h: backH })) return "back";
        return null;
      }

      case "study": {
        const btnW = 280, btnH = 64;
        const cardY = sh * 0.16, cardH = sh * 0.62;
        const btnX = cx - btnW / 2, btnY = cardY + cardH - 80;
        if (hitTest(x, y, { x: btnX, y: btnY, w: btnW, h: btnH })) return "next";
        return null;
      }

      case "choose": {
        const q = this.questions[this.currentIdx];
        if (!q) return null;
        const optW = sw * 0.76, optH = 72, optGap = 20;
        const startY = sh * 0.30;
        for (let i = 0; i < q.options.length; i++) {
          const oy = startY + i * (optH + optGap);
          const ox = cx - optW / 2;
          if (hitTest(x, y, { x: ox, y: oy, w: optW, h: optH })) return `opt_${i}`;
        }
        return null;
      }

      case "explain": {
        const btnW = 280, btnH = 64;
        const btnX = cx - btnW / 2, btnY = sh * 0.84;
        if (hitTest(x, y, { x: btnX, y: btnY, w: btnW, h: btnH })) return "next_explain";
        return null;
      }

      case "done": {
        const btnW = 260, btnH = 72, gap = 24;
        const retryX = cx - btnW - gap / 2, backX = cx + gap / 2, btnY = sh * 0.56;
        if (hitTest(x, y, { x: retryX, y: btnY, w: btnW, h: btnH })) return "retry";
        if (hitTest(x, y, { x: backX, y: btnY, w: btnW, h: btnH })) return "back";
        return null;
      }
    }
    return null;
  }

  /** 按钮按下处理 */
  private onButtonPress(btn: string): void {
    playSfx("click");
    vibrateShort();

    switch (btn) {
      case "start":
        this.phase = "study";
        this.phaseT = 0;
        break;

      case "next":
        // study → choose
        this.phase = "choose";
        this.phaseT = 0;
        this.selectedId = null;
        break;

      case "next_explain":
        // explain → 下一题 or done
        if (this.currentIdx >= this.questions.length - 1) {
          this.phase = "done";
          this.phaseT = 0;
          // 保存最高分
          this.saveScore();
        } else {
          this.currentIdx++;
          this.phase = "study";
          this.phaseT = 0;
          this.selectedId = null;
        }
        break;

      case "retry":
        this.phase = "intro";
        this.phaseT = 0;
        this.currentIdx = 0;
        this.score = 0;
        this.selectedId = null;
        this.questions = this.buildQuestions();
        break;

      case "back":
        this.director.replace(new ManagerDeployScene(this.director));
        break;
    }

    // choose 阶段选项处理
    if (btn.startsWith("opt_")) {
      const idx = parseInt(btn.split("_")[1]);
      const q = this.questions[this.currentIdx];
      if (!q || isNaN(idx) || idx < 0 || idx >= q.options.length) return;
      const opt = q.options[idx];
      this.selectedId = opt.id;
      this.lastCorrect = opt.correct;
      if (opt.correct) {
        this.score++;
        playSfx("good");
      } else {
        playSfx("bad");
      }
      // 进入解析阶段
      this.phase = "explain";
      this.phaseT = 0;
    }
  }

  /** 保存适老模式分数到平台存档 */
  private saveScore(): void {
    const prog = platformStore.managerProgress();
    const prev = prog.modeHighScores.senior ?? 0;
    if (this.score > prev) {
      prog.modeHighScores.senior = this.score;
      platformStore.save();
    }
  }
}
