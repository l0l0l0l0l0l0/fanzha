/**
 * 「反诈职业经理人」数据仪表盘（v11 方向 D：系统整合与体验优化）
 * 横屏 Canvas UI：玩家综合反诈统计数据总览
 * - 顶部：返回 + 标题
 * - 滚动内容区：7 个数据卡片（霓虹边框）
 *   1. 战斗总览：击杀 / BOSS 击破 / 大招使用 / 无尽最高波数 / 最高关卡
 *   2. 学习准确率：答题正确率（进度条）+ 案例复盘正确率
 *   3. 受害人营救：营救数 / 沦陷数 / 营救率
 *   4. 受害者模拟：通关剧本数 + 各剧本最高评级（S/A/B/C/D）
 *   5. 弱点情报：已解锁条目数（每条塔防中 +20% 伤害）
 *   6. 模式最高分：8 种模式最高分列表
 *   7. 最近战斗回放：最近 3 局回放摘要
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawProgressBar, drawScanlineOverlay,
  drawNeonCorners, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import type { ManagerMode, BattleReplayRecord } from "@/games/manager/types";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { setOrientation } from "@/platform/web";

/** 仪表盘主题色（霓虹青） */
const ACCENT = "#00E5FF";

/** ManagerMode 中文标签 */
const MODE_LABEL: Record<ManagerMode, string> = {
  classic: "经典模式",
  timeTrial: "限时挑战",
  bossRush: "BOSS连战",
  endlessRush: "无尽模式",
  daily: "每日挑战",
  tower: "爬塔模式",
  challenge: "极限挑战",
  senior: "适老模式",
};

/** 全部模式（展示顺序） */
const ALL_MODES: ManagerMode[] = [
  "classic", "timeTrial", "bossRush", "endlessRush",
  "daily", "tower", "challenge", "senior",
];

/** 评级颜色 */
const RANK_COLOR: Record<"S" | "A" | "B" | "C" | "D", string> = {
  S: "#FFD666",
  A: "#00E5FF",
  B: "#52C41A",
  C: "#FFB020",
  D: "#E5353B",
};

/** 卡片左右边距 / 间距 */
const SIDE_MARGIN = 16;
const CARD_GAP = 12;
/** 顶部导航条高度 */
const TOP_BAR_H = 48;
/** 内容区起点 y（顶部栏之下留 8px 间隙） */
const CONTENT_START_Y = TOP_BAR_H + 8;

export class ManagerStatsScene extends Scene {
  private pressedButton: string | null = null;
  private scrollY = 0;
  private contentH = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.scrollY = 0;
    this.pressedButton = null;
  }

  // ====================================================================
  // 布局
  // ====================================================================

  private getBackBtnRect(): Rect {
    return { x: 8, y: 8, w: 56, h: 32 };
  }

  /** 双列卡片中某一列的宽度 */
  private getColW(screenW: number): number {
    return (screenW - SIDE_MARGIN * 2 - CARD_GAP) / 2;
  }

  // ====================================================================
  // 渲染
  // ====================================================================

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    // 顶部导航条
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.85)";
    ctx.fillRect(0, 0, screenW, TOP_BAR_H);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, TOP_BAR_H - 1, screenW, 1);
    ctx.restore();

    // 返回按钮
    const backBtn = this.getBackBtnRect();
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 12, backBtn.y + 8, 16, Theme.colors.ink.muted);

    // 标题
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(ACCENT, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("反诈档案 · 数据仪表盘", screenW / 2, TOP_BAR_H / 2);
    ctx.restore();

    // 滚动内容区
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, CONTENT_START_Y, screenW, screenH - CONTENT_START_Y);
    ctx.clip();
    ctx.translate(0, -this.scrollY);

    let y = CONTENT_START_Y;
    const colW = this.getColW(screenW);

    // 行 1：战斗总览（左） + 学习准确率（右）
    y = this.renderCombatOverview(ctx, SIDE_MARGIN, y, colW, screenW);
    this.renderLearningAccuracy(ctx, SIDE_MARGIN + colW + CARD_GAP, CONTENT_START_Y, colW, screenW);
    y += CARD_GAP;

    // 行 2：受害人营救（左） + 受害者模拟（右）
    const row2Y = y;
    y = this.renderVictimRescue(ctx, SIDE_MARGIN, row2Y, colW, screenW);
    this.renderVictimSim(ctx, SIDE_MARGIN + colW + CARD_GAP, row2Y, colW, screenW);
    y += CARD_GAP;

    // 行 3：弱点情报（左） + 模式最高分（右）
    const row3Y = y;
    y = this.renderWeaknessIntel(ctx, SIDE_MARGIN, row3Y, colW, screenW);
    this.renderModeHighScores(ctx, SIDE_MARGIN + colW + CARD_GAP, row3Y, colW, screenW);
    y += CARD_GAP;

    // 行 4：最近战斗回放（整行）
    y = this.renderRecentReplays(ctx, SIDE_MARGIN, y, screenW - SIDE_MARGIN * 2, screenW);

    this.contentH = y + 24 - CONTENT_START_Y;
    ctx.restore();

    // 滚动条提示（内容溢出时）
    const maxScroll = Math.max(0, this.contentH - (screenH - CONTENT_START_Y));
    if (maxScroll > 0) {
      const trackH = screenH - CONTENT_START_Y;
      const thumbH = Math.max(24, trackH * (trackH / this.contentH));
      const thumbY = CONTENT_START_Y + (trackH - thumbH) * (this.scrollY / maxScroll);
      ctx.save();
      ctx.fillStyle = withAlpha(ACCENT, 0.35);
      ctx.fillRect(screenW - 4, thumbY, 3, thumbH);
      ctx.restore();
    }

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  /** 渲染卡片标题行（emoji + 标题 + 右侧可选副文本） */
  private renderCardHeader(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number,
    emoji: string, title: string, rightText?: string,
  ): void {
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(ACCENT, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(`${emoji} ${title}`, x + 12, y + 10);
    ctx.shadowBlur = 0;
    if (rightText) {
      ctx.font = `500 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "right";
      ctx.fillText(rightText, x + w - 12, y + 12);
    }
    ctx.restore();
  }

  /** 渲染单个数值统计块（大数值 + 小标签） */
  private renderStatBlock(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number,
    value: string, label: string, color: string,
  ): void {
    ctx.save();
    ctx.font = `700 22px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(color, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(value, x + w / 2, y + 14);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(label, x + w / 2, y + 34);
    ctx.restore();
  }

  // ===== 1. 战斗总览 =====
  private renderCombatOverview(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _screenW: number,
  ): number {
    const h = 120;
    drawPanel(ctx, x, y, w, h, {
      bgColor: withAlpha(ACCENT, 0.04),
      borderColor: withAlpha(ACCENT, 0.5),
      borderWidth: 1.5,
    });
    drawNeonCorners(ctx, x, y, w, h, ACCENT, 10, 2, 5);

    this.renderCardHeader(ctx, x, y, w, "⚔️", "战斗总览");

    const meta = platformStore.managerMetaProgress();
    const prog = platformStore.managerProgress();
    const stats = [
      { value: String(meta.totalKills ?? 0), label: "累计击杀", color: ACCENT },
      { value: String(meta.totalBossKills ?? 0), label: "BOSS击破", color: "#FFD666" },
      { value: String(meta.totalUltUsed ?? 0), label: "大招释放", color: "#B388FF" },
      { value: String(prog.bestWave ?? 0), label: "无尽最高波", color: "#52C41A" },
      { value: String(prog.maxLevel ?? 0), label: "最高关卡", color: "#FF7AB8" },
    ];
    const blockW = (w - 24) / stats.length;
    for (let i = 0; i < stats.length; i++) {
      this.renderStatBlock(ctx, x + 12 + i * blockW, y + 44, blockW, stats[i].value, stats[i].label, stats[i].color);
    }
    return y + h;
  }

  // ===== 2. 学习准确率 =====
  private renderLearningAccuracy(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _screenW: number,
  ): number {
    const h = 120;
    drawPanel(ctx, x, y, w, h, {
      bgColor: withAlpha(ACCENT, 0.04),
      borderColor: withAlpha(ACCENT, 0.5),
      borderWidth: 1.5,
    });
    drawNeonCorners(ctx, x, y, w, h, ACCENT, 10, 2, 5);

    this.renderCardHeader(ctx, x, y, w, "📚", "学习准确率");

    const meta = platformStore.managerMetaProgress();
    const quizCorrect = meta.quizCorrectCount ?? 0;
    const quizTotal = meta.quizTotalCount ?? 0;
    const quizRate = quizTotal > 0 ? quizCorrect / quizTotal : 0;
    const caseCorrect = meta.caseBreakdownCorrectCount ?? 0;
    const caseTotal = meta.caseBreakdownTotalCount ?? 0;
    const caseRate = caseTotal > 0 ? caseCorrect / caseTotal : 0;

    ctx.save();
    // 答题正确率
    ctx.font = `500 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("答题正确率", x + 12, y + 40);
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "right";
    ctx.fillText(`${(quizRate * 100).toFixed(1)}%  (${quizCorrect}/${quizTotal})`, x + w - 12, y + 40);
    drawProgressBar(ctx, x + 12, y + 58, w - 24, 6, quizRate, ACCENT);
    // 案例复盘正确率
    ctx.font = `500 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.fillText("案例五步复盘正确率", x + 12, y + 74);
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FF7AB8";
    ctx.textAlign = "right";
    ctx.fillText(`${(caseRate * 100).toFixed(1)}%  (${caseCorrect}/${caseTotal})`, x + w - 12, y + 74);
    drawProgressBar(ctx, x + 12, y + 92, w - 24, 6, caseRate, "#FF7AB8");
    ctx.restore();
    return y + h;
  }

  // ===== 3. 受害人营救 =====
  private renderVictimRescue(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _screenW: number,
  ): number {
    const h = 120;
    drawPanel(ctx, x, y, w, h, {
      bgColor: withAlpha(ACCENT, 0.04),
      borderColor: withAlpha(ACCENT, 0.5),
      borderWidth: 1.5,
    });
    drawNeonCorners(ctx, x, y, w, h, ACCENT, 10, 2, 5);

    this.renderCardHeader(ctx, x, y, w, "🛟", "受害人营救");

    const meta = platformStore.managerMetaProgress();
    const rescued = meta.victimsRescuedTotal ?? 0;
    const lost = meta.victimsLostTotal ?? 0;
    const total = rescued + lost;
    const rescueRate = total > 0 ? rescued / total : 0;

    const blockW = (w - 24) / 3;
    this.renderStatBlock(ctx, x + 12, y + 44, blockW, String(rescued), "成功营救", Theme.colors.safe.DEFAULT);
    this.renderStatBlock(ctx, x + 12 + blockW, y + 44, blockW, String(lost), "不幸沦陷", Theme.colors.warn.DEFAULT);
    this.renderStatBlock(ctx, x + 12 + blockW * 2, y + 44, blockW, `${(rescueRate * 100).toFixed(1)}%`, "营救率", ACCENT);

    // 营救率进度条
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("营救率进度", x + 12, y + 92);
    drawProgressBar(ctx, x + 12, y + 106, w - 24, 5, rescueRate, Theme.colors.safe.DEFAULT);
    ctx.restore();
    return y + h;
  }

  // ===== 4. 受害者模拟 =====
  private renderVictimSim(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _screenW: number,
  ): number {
    const meta = platformStore.managerMetaProgress();
    const completed = meta.completedVictimSimScenarios ?? [];
    const bestRanks = meta.victimSimBestRanks ?? {};
    const rankEntries = Object.entries(bestRanks);
    // 高度自适应：标题 + 1 行完成数 + 评级行
    const h = 120;

    drawPanel(ctx, x, y, w, h, {
      bgColor: withAlpha(ACCENT, 0.04),
      borderColor: withAlpha(ACCENT, 0.5),
      borderWidth: 1.5,
    });
    drawNeonCorners(ctx, x, y, w, h, ACCENT, 10, 2, 5);

    this.renderCardHeader(ctx, x, y, w, "🎭", "受害者模拟", `通关 ${completed.length}`);

    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("各剧本最高评级：", x + 12, y + 40);
    ctx.restore();

    if (rankEntries.length === 0) {
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("暂无记录 · 完成受害人模拟解锁", x + w / 2, y + 80);
      ctx.restore();
    } else {
      // 评级徽章横排
      const badgeW = 36;
      const badgeGap = 6;
      const startX = x + 12;
      const badgeY = y + 60;
      const maxPerRow = Math.floor((w - 24 + badgeGap) / (badgeW + badgeGap));
      for (let i = 0; i < rankEntries.length; i++) {
        const [, rank] = rankEntries[i];
        const col = i % maxPerRow;
        const row = Math.floor(i / maxPerRow);
        const bx = startX + col * (badgeW + badgeGap);
        const by = badgeY + row * (badgeW + badgeGap);
        if (by + badgeW > y + h - 8) break; // 超出卡片截断
        const color = RANK_COLOR[rank] ?? ACCENT;
        drawPanel(ctx, bx, by, badgeW, badgeW, {
          bgColor: withAlpha(color, 0.15),
          borderColor: color,
          borderWidth: 1.5,
        });
        ctx.save();
        ctx.font = `700 18px ${Theme.fonts.display}`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fillText(rank, bx + badgeW / 2, by + badgeW / 2);
        ctx.restore();
      }
    }
    return y + h;
  }

  // ===== 5. 弱点情报 =====
  private renderWeaknessIntel(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _screenW: number,
  ): number {
    const meta = platformStore.managerMetaProgress();
    const list = meta.weaknessIntel ?? [];
    const h = 90;

    drawPanel(ctx, x, y, w, h, {
      bgColor: withAlpha(ACCENT, 0.04),
      borderColor: withAlpha(ACCENT, 0.5),
      borderWidth: 1.5,
    });
    drawNeonCorners(ctx, x, y, w, h, ACCENT, 10, 2, 5);

    this.renderCardHeader(ctx, x, y, w, "💡", "弱点情报");

    ctx.save();
    ctx.font = `700 22px ${Theme.fonts.mono}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(ACCENT, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(String(list.length), x + 12, y + 56);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("条已解锁", x + 36, y + 58);
    // 说明
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText("塔防中对相应敌人 +20% 伤害", x + w - 12, y + 58);
    ctx.restore();
    return y + h;
  }

  // ===== 6. 模式最高分 =====
  private renderModeHighScores(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _screenW: number,
  ): number {
    const prog = platformStore.managerProgress();
    const scores = prog.modeHighScores ?? ({} as Record<ManagerMode, number>);
    const h = 140;

    drawPanel(ctx, x, y, w, h, {
      bgColor: withAlpha(ACCENT, 0.04),
      borderColor: withAlpha(ACCENT, 0.5),
      borderWidth: 1.5,
    });
    drawNeonCorners(ctx, x, y, w, h, ACCENT, 10, 2, 5);

    this.renderCardHeader(ctx, x, y, w, "🏆", "模式最高分");

    // 2 列 × 4 行
    const colW = (w - 24) / 2;
    const rowH = 20;
    const startY = y + 38;
    for (let i = 0; i < ALL_MODES.length; i++) {
      const mode = ALL_MODES[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ex = x + 12 + col * colW;
      const ey = startY + row * rowH;
      const score = scores[mode] ?? 0;
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(MODE_LABEL[mode], ex, ey + rowH / 2);
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = score > 0 ? ACCENT : Theme.colors.ink.dim;
      ctx.textAlign = "right";
      ctx.fillText(String(score), ex + colW - 8, ey + rowH / 2);
      ctx.restore();
    }
    return y + h;
  }

  // ===== 7. 最近战斗回放 =====
  private renderRecentReplays(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _screenW: number,
  ): number {
    const meta = platformStore.managerMetaProgress();
    const replays = (meta.battleReplays ?? []) as BattleReplayRecord[];
    // 取最近 3 局（按时间倒序，原数组已 FIFO，末尾为最新）
    const recent = replays.slice(-3).reverse();
    const cardH = 64;
    const gap = 8;
    const headerH = 32;
    const h = headerH + (recent.length > 0 ? recent.length * cardH + (recent.length - 1) * gap : 56);

    drawPanel(ctx, x, y, w, h, {
      bgColor: withAlpha(ACCENT, 0.04),
      borderColor: withAlpha(ACCENT, 0.5),
      borderWidth: 1.5,
    });
    drawNeonCorners(ctx, x, y, w, h, ACCENT, 10, 2, 5);

    this.renderCardHeader(ctx, x, y, w, "🎬", "最近战斗回放", `共 ${replays.length} 局`);

    if (recent.length === 0) {
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("暂无回放记录 · 完成一局战斗后自动记录", x + w / 2, y + headerH + 28);
      ctx.restore();
      return y + h;
    }

    for (let i = 0; i < recent.length; i++) {
      const r = recent[i];
      const ry = y + headerH + i * (cardH + gap);
      this.renderReplayItem(ctx, x + 12, ry, w - 24, cardH, r);
    }
    return y + h;
  }

  /** 渲染单条回放摘要 */
  private renderReplayItem(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    r: BattleReplayRecord,
  ): void {
    const win = r.win;
    const resultColor = win ? Theme.colors.safe.DEFAULT : Theme.colors.warn.DEFAULT;
    const resultText = win ? "胜利" : "失败";

    drawPanel(ctx, x, y, w, h, {
      bgColor: "rgba(20, 30, 45, 0.6)",
      borderColor: withAlpha(resultColor, 0.4),
      borderWidth: 1,
    });
    // 左侧色条
    ctx.save();
    ctx.fillStyle = resultColor;
    ctx.fillRect(x, y, 3, h);
    // 模式 + 结果
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(r.modeLabel ?? r.mode ?? "—", x + 10, y + 8);
    // 结果徽章（右上）
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = resultColor;
    ctx.textAlign = "right";
    ctx.fillText(resultText, x + w - 8, y + 8);
    // 分数（大）
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String(r.finalScore ?? 0), x + 10, y + 38);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("分", x + 10 + ctx.measureText(String(r.finalScore ?? 0)).width + 4, y + 40);
    // 波数 / 用时
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    const waveTxt = `波次 ${r.totalWaves ?? 0}`;
    const durSec = r.durationSec ?? 0;
    const durTxt = `用时 ${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, "0")}`;
    ctx.fillText(`${waveTxt}   ${durTxt}`, x + 80, y + 38);
    // 诈骗类型命中统计摘要（前 2 项）
    const fraudStats = r.fraudTypeStats ?? {};
    const fraudEntries = Object.entries(fraudStats);
    if (fraudEntries.length > 0) {
      const summary = fraudEntries.slice(0, 2)
        .map(([tid, s]) => `${tid}:${s.kills ?? 0}杀`)
        .join("  ");
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "right";
      ctx.fillText(summary, x + w - 8, y + h - 12);
    }
    ctx.restore();
  }

  // ====================================================================
  // 触摸处理
  // ====================================================================

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    const screenH = this.director.screenHeight;

    if (type === "start") {
      // 返回按钮
      if (hitTest(x, y, this.getBackBtnRect())) {
        this.pressedButton = "back";
        return true;
      }
      // 否则视为滚动起点
      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      this.isDragging = true;
      return false;
    } else if (type === "move") {
      if (this.isDragging) {
        const dy = y - this.dragStartY;
        const maxScroll = Math.max(0, this.contentH - (screenH - CONTENT_START_Y));
        this.scrollY = Math.max(0, Math.min(maxScroll, this.dragStartScroll - dy));
      }
      return false;
    } else if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;
      this.isDragging = false;
      if (pressed === "back") {
        playSfx("click");
        this.director.pop();
        return true;
      }
      return false;
    }
    return false;
  }
}
