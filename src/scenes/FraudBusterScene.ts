/**
 * 「是男人就反诈」游戏场景
 * 引擎画布 800×480 横屏，卡片在左半区，选项按钮在右半区（同一画布坐标系，避免错位遮挡）
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawToast, hitTest, type Rect } from "@/ui/widgets";
import { FraudBusterEngine, itemEmoji, itemLabel } from "@/games/fraudBuster/engine";
import { MAN_TIERS } from "@/games/fraudBuster/data";
import { roundRect } from "@/engine/Renderer";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import type { GameEvent, GameResultPayload } from "@/types";
import type { FBHud, FBItemType, FBStats, FBSpecialEvent, FBBossSkill, FBQuestionKind, FBDifficulty, FBPsychology, FBVictimProfile, FBKnowledgeGraph, FBCaseArchive } from "@/games/fraudBuster/types";
import { FBRANKS, FBACHIEVEMENTS } from "@/games/fraudBuster/storage";
import { KNOWLEDGE_GRAPH_COLORS } from "@/games/fraudBuster/dataV2";

const LETTERS = ["A", "B", "C", "D"];
const JUDGE_LETTERS = ["✓", "✗"];

// 画布尺寸（与引擎一致）
const CANVAS_W = 800;
const CANVAS_H = 480;
// 卡片区域（与 engine.ts 一致，用于 drawCaseArchive 定位）
const CARD_X = 20;
const CARD_Y = 80;
const CARD_W = 360;
const CARD_H = 380;
// 右半区选项面板
const OPT_X = 410;
const OPT_W = 370;

// 道具按钮（画布顶部右半区，6 个按钮 - 紧凑布局）
const ITEM_TYPES: FBItemType[] = ["freeze", "fifty", "skip", "double", "hint", "undo"];
const ITEM_BTN_W = 58;
const ITEM_BTN_H = 36;
const ITEM_BTN_GAP = 4;
const ITEM_BTN_Y = 12;
const ITEM_BTN_X = OPT_X + (OPT_W - (ITEM_BTN_W * 6 + ITEM_BTN_GAP * 5)) / 2;

// 难度选择按钮（ready 状态，画布坐标）
const DIFF_BTN_W = 180;
const DIFF_BTN_H = 80;
const DIFF_BTN_GAP = 24;
const DIFFICULTY_DEFS: { id: FBDifficulty; label: string; desc: string; color: string }[] = [
  { id: "easy", label: "简单", desc: "倒计时 ×1.3", color: "#1AD670" },
  { id: "normal", label: "普通", desc: "倒计时 ×1.0", color: "#00E5FF" },
  { id: "hard", label: "困难", desc: "倒计时 ×0.75", color: "#E5353B" },
];

// 大招按钮（画布右下角）
const ULT_BTN_W = 130;
const ULT_BTN_H = 48;
const ULT_BTN_X = CANVAS_W - ULT_BTN_W - 12;
const ULT_BTN_Y = CANVAS_H - ULT_BTN_H - 12;

// 特殊事件中文名映射
const SPECIAL_EVENT_NAMES: Record<FBSpecialEvent, string> = {
  double: "双重诈骗",
  timeCompress: "时间压缩",
  shuffle: "选项乱序",
  mixedTrueFalse: "真假混杂",
  rapidFire: "急速连答",
  itemLock: "道具禁用",
};
const SPECIAL_EVENT_ICONS: Record<FBSpecialEvent, string> = {
  double: "⚡",
  timeCompress: "⏱",
  shuffle: "🔀",
  mixedTrueFalse: "🎭",
  rapidFire: "🔥",
  itemLock: "🔒",
};
// Boss 技能中文名映射
const BOSS_SKILL_NAMES: Record<FBBossSkill, string> = {
  shuffleOptions: "选项打乱",
  hideTimer: "隐藏倒计时",
  summonMinion: "召唤小怪",
  lockItem: "封印道具",
  timeSteal: "偷取时间",
  answerBlur: "选项模糊",
};
// 心理操控手法中文名映射（与 engine.psychologyLabel 一致）
const PSYCHOLOGY_LABELS: Record<FBPsychology, string> = {
  urgency: "紧迫施压",
  authority: "权威恐吓",
  greed: "贪婪诱惑",
  fear: "恐惧施压",
  trust: "信任建立",
  intimacy: "情感亲密",
  curiosity: "好奇心",
  conformity: "从众压力",
  scarcity: "稀缺暗示",
  sunkCost: "沉没成本",
};

export class FraudBusterScene extends GameShellScene {
  private engine: FraudBusterEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private hud: FBHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedOpt: number | null = null;
  private pressedSubmit = false;
  private pressedItem: FBItemType | null = null;
  private t = 0;
  /** 上一次 HUD 的连击数，用于判定本次答题对错并触发 fx */
  private prevCombo = 0;
  /** 得分跳动：显示值追逐真实值，营造滚动爽感 */
  private displayScore = 0;
  /** 得分脉冲：得分增加时 >0，衰减到 0，驱动数字放大发光 */
  private scorePulse = 0;
  // ===== 滑动手势状态（判断题专用） =====
  /** 当前滑动的触摸 ID（null=未在滑动） */
  private swipeTouchId: number | null = null;
  /** 滑动起始画布坐标 x */
  private swipeStartX = 0;
  /** 滑动起始画布坐标 y */
  private swipeStartY = 0;
  /** 滑动当前画布坐标 x */
  private swipeCurX = 0;
  /** 滑动当前画布坐标 y */
  private swipeCurY = 0;
  /** 正在滑动的卡位（0=左卡/主卡，1=右卡，null=未确定） */
  private swipeCardIdx: number | null = null;
  // ===== 新增状态 =====
  /** 游戏状态：ready=难度选择界面, playing=游戏进行中 */
  private gameState: "ready" | "playing" = "ready";
  /** 难度按钮按下态 */
  private pressedDifficulty: FBDifficulty | null = null;
  /** 大招按钮按下态 */
  private pressedUltimate = false;
  /** 提交按钮按下态（fill/link/sort 题型） */
  private pressedSubmitBtn = false;
  /** 连线题：当前选中的左列项索引（null=未选） */
  private linkSelLeftIdx: number | null = null;
  /** 排序题：当前选中的项索引（null=未选） */
  private sortSelIdx: number | null = null;

  getGameTitle(): string { return "是男人就反诈"; }
  getGameSubtitle(): string { return "FRAUD BUSTER"; }
  getAccent(): string { return Theme.accents["fraud-buster"]; }

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new FraudBusterEngine(canvas);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    // 不调用 engine.start()：改为由 updateGame/renderGame 同步驱动，
    // 与 SceneDirector 主循环同帧，消除双 RAF 撕裂闪烁。
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      const newHud = e.payload as unknown as FBHud;
      this.maybeTriggerComboFx(newHud);
      this.hud = newHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 2.5 };
      this.toastTimer = 0;
    } else if (e.type === "result") {
      this.onResult(e.payload);
    }
  }

  /**
   * 根据 HUD combo 变化触发 fx 反馈（与引擎 postFX 互补，叠加更强烈的瞬时反馈）
   * - combo 增长 = 答对：色阶粒子爆发 + 冲击环；≥3 飘字 ×N COMBO（色阶递进）
   * - 里程碑（每 5）：大字 + 双层粒子 + 强震屏 + 闪屏，营造"越打越燃"的爽感
   * - 色阶升级（进入更高档）：额外小爆发提示
   * - combo 归零 = 答错：强震屏 + 红闪
   */
  private maybeTriggerComboFx(hud: FBHud): void {
    const combo = hud.combo;
    if (combo > this.prevCombo) {
      const { cx, cy } = this.cardCenterScreen();
      const color = this.comboColor(combo);
      // 答对：色阶粒子爆发 + 冲击环（强度随 combo 递增）
      const burstCount = 14 + Math.min(combo, 12) * 2;
      const burstSpeed = 200 + Math.min(combo, 12) * 18;
      this.fx.burst(cx, cy, color, burstCount, burstSpeed);
      this.fx.ring(cx, cy, color, 80 + Math.min(combo, 12) * 4, 0.45);
      if (combo >= 3) {
        this.fx.popText(cx, cy - 30, `×${combo} COMBO`, {
          color,
          size: 22 + Math.min(combo, 12) * 1.2,
          duration: 0.85,
          vy: -55,
        });
      }
      // 里程碑（每 5 连击）：大字 + 双层粒子 + 强震屏 + 闪屏
      if (combo >= 5 && combo % 5 === 0) {
        this.fx.shake(0.4 + Math.min(combo, 20) * 0.01);
        this.fx.flash(color, 0.22, 0.3);
        this.fx.popText(cx, cy - 70, `COMBO ×${combo}!`, {
          color,
          size: 30,
          duration: 1.0,
          vy: -40,
        });
        // 副色粒子二次爆发
        this.fx.burst(cx, cy, "#FFD666", 18, 280);
        this.fx.ring(cx, cy, "#FFD666", 120, 0.55);
      } else if (this.comboColor(combo) !== this.comboColor(this.prevCombo) && this.prevCombo >= 2) {
        // 色阶升级（进入更高档）：轻量提示爆发
        this.fx.burst(cx, cy, color, 10, 220);
        this.fx.popText(cx, cy - 56, "LEVEL UP!", { color, size: 16, duration: 0.7, vy: -45 });
      }
    } else if (combo === 0 && this.prevCombo > 0) {
      // 答错：强震屏 + 红闪
      this.fx.shake(0.6);
      this.fx.flash("#E5353B", 0.32, 0.3);
      const { cx, cy } = this.cardCenterScreen();
      this.fx.burst(cx, cy, "#E5353B", 18, 260);
    }
    this.prevCombo = combo;
  }

  /** 卡片中心在屏幕坐标系下的位置（用于 fx 飘字/粒子/冲击环定位） */
  private cardCenterScreen(): { cx: number; cy: number } {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const tr = this.getBlitTransform(screenW, screenH);
    // CARD_CX = 200, CARD_CY = 270（与 engine.ts 一致）
    return { cx: tr.offsetX + 200 * tr.scale, cy: tr.offsetY + 270 * tr.scale };
  }

  /**
   * 连击色阶：combo 越高颜色越烈，配合 HUD 与 fx 营造"越打越燃"的爽感。
   * 2 绿 / 3-4 金 / 5-7 橙 / 8-11 紫 / 12+ 红
   */
  private comboColor(combo: number): string {
    if (combo >= 12) return "#FF3B6B";
    if (combo >= 8) return "#B388FF";
    if (combo >= 5) return "#FF7A1A";
    if (combo >= 3) return "#FFD666";
    return "#1AD670";
  }

  private onResult(result: GameResultPayload): void {
    // 胜负闪光（与引擎 postFX 互补，叠加更明显反馈）
    if (result.win) {
      this.fx.flash("#1AD670", 0.28, 0.4);
    } else {
      this.fx.flash("#E5353B", 0.38, 0.5);
      this.fx.shake(0.5);
    }
    // 提取反诈专属详细统计（由 engine 通过 stats 字段传入）
    const stats = result.stats as FBStats | undefined;
    // v2：捕获错题记录，用于复盘入口（A5）
    const wrongRecords = stats?.wrongRecords ?? [];
    const hasWrongRecords = wrongRecords.length > 0;
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director), undefined, "slide"),
      renderExtraStats: stats
        ? (ctx, x, y, w) => this.renderFraudStats(ctx, x, y, w, stats)
        : undefined,
      // v2：错题复盘入口（A5，仅有错题时显示）
      onReview: hasWrongRecords ? () => this.startReviewMode(wrongRecords) : undefined,
      reviewLabel: hasWrongRecords ? `📝 错题复盘 · ${wrongRecords.length} 题补漏挑战` : undefined,
    });
  }

  /**
   * v2：启动错题复盘模式（A5）
   * 重置场景状态后重建引擎，注入错题队列，直接进入 playing 状态。
   */
  private startReviewMode(wrongRecords: FBStats["wrongRecords"]): void {
    if (!wrongRecords || wrongRecords.length === 0) return;
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.pressedOpt = null;
    this.pressedSubmit = false;
    this.pressedItem = null;
    this.prevCombo = 0;
    this.displayScore = 0;
    this.scorePulse = 0;
    this.swipeTouchId = null;
    this.swipeCardIdx = null;
    this.pressedDifficulty = null;
    this.pressedUltimate = false;
    this.pressedSubmitBtn = false;
    this.linkSelLeftIdx = null;
    this.sortSelIdx = null;
    this.fx.clear();
    this.spawnEngine();
    // 注入错题队列并直接进入游戏（跳过难度选择）
    this.engine?.startReviewMode(wrongRecords);
    this.gameState = "playing";
    playSfx("click");
    vibrateShort();
  }

  /**
   * 渲染反诈专属详细统计（在结算面板底部追加）
   * 布局：3×2 数据小卡 + 弱项类型条形图 + 段位信息 + 心理弱点 + 错题本 + 成就解锁
   * 返回绘制内容总高度，用于面板加高
   */
  private renderFraudStats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: FBStats): number {
    const total = stats.totalAnswered || 0;
    const accuracy = total > 0 ? Math.round((stats.correctCount / total) * 100) : 0;
    let curY = y;

    // 标题
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("本局战报 · ANTI-FRAUD STATS", x, curY);
    ctx.restore();
    curY += 18;

    // 3×2 数据小卡（每格 W=(w-2*8)/3, H=36）
    const gridY = curY;
    const cellGap = 8;
    const cellW = (w - cellGap * 2) / 3;
    const cellH = 38;
    const cells: Array<{ label: string; value: string; color: string }> = [
      { label: "准确率", value: `${accuracy}%`, color: accuracy >= 80 ? "#1AD670" : accuracy >= 60 ? "#FFD666" : "#E5353B" },
      { label: "最高连击", value: `×${stats.maxCombo}`, color: "#FF7A1A" },
      { label: "Boss 击破", value: `${stats.bossDefeated}`, color: "#E5353B" },
      { label: "道具使用", value: `${stats.itemsUsed}`, color: "#00E5FF" },
      { label: "连锁完成", value: `${stats.chainCompleted}`, color: "#FFD666" },
      { label: "特殊通过", value: `${stats.specialCleared}`, color: "#B388FF" },
    ];
    for (let i = 0; i < cells.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = x + col * (cellW + cellGap);
      const cy = gridY + row * (cellH + cellGap);
      const c = cells[i];
      ctx.save();
      // 卡片背景
      roundRect(ctx, cx, cy, cellW, cellH, 6);
      ctx.fillStyle = "rgba(10,25,41,0.6)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(c.color, 0.45);
      roundRect(ctx, cx, cy, cellW, cellH, 6);
      ctx.stroke();
      // 数值
      ctx.font = `900 16px ${Theme.fonts.mono}`;
      ctx.fillStyle = c.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = withAlpha(c.color, 0.5);
      ctx.shadowBlur = 6;
      ctx.fillText(c.value, cx + cellW / 2, cy + 14);
      ctx.shadowBlur = 0;
      // 标签
      ctx.font = `500 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText(c.label, cx + cellW / 2, cy + 30);
      ctx.restore();
    }
    curY = gridY + 2 * (cellH + cellGap) + 6;

    // 弱项类型条形图（取正确率最低的3个类型）
    const byType = stats.byType || {};
    const types = Object.entries(byType).filter(([, v]) => v && v.total > 0);
    types.sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
    const weakTypes = types.slice(0, 3);

    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(weakTypes.length > 0 ? "需加强防范" : "暂无类型统计", x, curY);
    ctx.restore();
    curY += 16;

    const barH = 12;
    const barGap = 6;
    const weakBarCount = weakTypes.length > 0 ? weakTypes.length : 3;
    for (const [typeName, data] of weakTypes) {
      const rate = data.total > 0 ? data.correct / data.total : 0;
      const rateColor = rate >= 0.8 ? "#1AD670" : rate >= 0.5 ? "#FFD666" : "#E5353B";
      // 类型名
      ctx.save();
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const label = typeName.length > 10 ? typeName.slice(0, 10) + "…" : typeName;
      ctx.fillText(label, x, curY + barH / 2);
      // 进度条背景
      const barX = x + 96;
      const barW = w - 96 - 40;
      roundRect(ctx, barX, curY, barW, barH, 6);
      ctx.fillStyle = "rgba(10,25,41,0.6)";
      ctx.fill();
      // 进度条填充
      const fillW = Math.max(2, barW * rate);
      roundRect(ctx, barX, curY, fillW, barH, 6);
      ctx.fillStyle = withAlpha(rateColor, 0.8);
      ctx.fill();
      // 百分比
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = rateColor;
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(rate * 100)}%`, x + w, curY + barH / 2);
      ctx.restore();
      curY += barH + barGap;
    }
    // 无弱项时仍占位 3 行高度（保持与原布局一致）
    if (weakTypes.length === 0) curY += weakBarCount * (barH + barGap);
    curY += 4;

    // ===== 段位信息 =====
    curY = this.drawRankSection(ctx, x, curY, w, stats);
    curY += 4;

    // ===== 心理弱点分析 =====
    curY = this.drawPsychologySection(ctx, x, curY, w, stats);
    curY += 4;

    // ===== 错题本（仅在有错题时渲染） =====
    curY = this.drawWrongRecordsSection(ctx, x, curY, w, stats);

    // ===== 成就解锁（仅在有新成就时渲染） =====
    curY = this.drawNewAchievementsSection(ctx, x, curY, w, stats);
    curY += 4;

    // ===== v2 升级：受害者档案 / 知识图谱 / 案例档案 =====
    // B2: 受害者档案（多分支"被骗档案"结局）
    curY = this.drawVictimProfileSection(ctx, x, curY, w, stats);
    curY += 4;
    // B1: 知识图谱（替换雷达图，交互式掌握度展示）
    curY = this.drawKnowledgeGraphSection(ctx, x, curY, w, stats);
    curY += 4;
    // A1: 案例档案（本局遭遇的真实案例溯源）
    curY = this.drawCaseArchivesSection(ctx, x, curY, w, stats);

    return curY - y;
  }

  /** 段位信息行：当前段位图标+名称+口号，若晋级则显示晋升徽章 */
  private drawRankSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: FBStats): number {
    const save = stats.save;
    const rankUp = stats.rankUp ?? null;
    // 当前段位：优先用 rankUp（已晋级），否则从 save.rankId 查
    let curRank = null as null | { id: string; name: string; color: string; icon: string; slogan: string };
    if (rankUp) {
      curRank = rankUp;
    } else if (save?.rankId) {
      curRank = FBRANKS.find((r) => r.id === save.rankId) ?? null;
    }
    const sectionH = 30;

    ctx.save();
    // 小标题
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("段位 · RANK", x, y);
    ctx.restore();

    if (curRank) {
      // 段位背景条
      const rowY = y + 14;
      roundRect(ctx, x, rowY, w, sectionH - 14, 6);
      ctx.fillStyle = withAlpha(curRank.color, 0.1);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(curRank.color, 0.5);
      roundRect(ctx, x, rowY, w, sectionH - 14, 6);
      ctx.stroke();
      ctx.save();
      // 段位图标
      ctx.font = `700 13px ${Theme.fonts.mono}`;
      ctx.fillStyle = curRank.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(curRank.icon, x + 8, rowY + (sectionH - 14) / 2);
      // 段位名称
      ctx.font = `900 12px ${Theme.fonts.display}`;
      ctx.fillStyle = curRank.color;
      ctx.shadowColor = withAlpha(curRank.color, 0.5);
      ctx.shadowBlur = 4;
      ctx.fillText(curRank.name, x + 30, rowY + (sectionH - 14) / 2);
      ctx.shadowBlur = 0;
      // 口号（截断）
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      const slogan = curRank.slogan.length > 14 ? curRank.slogan.slice(0, 14) + "…" : curRank.slogan;
      ctx.fillText(slogan, x + 30 + ctx.measureText(curRank.name).width + 10, rowY + (sectionH - 14) / 2);
      // 晋升徽章
      if (rankUp) {
        const badgeX = x + w - 60;
        const badgeW = 56;
        roundRect(ctx, badgeX, rowY + 3, badgeW, sectionH - 14 - 6, 4);
        ctx.fillStyle = withAlpha("#FFD666", 0.2);
        ctx.fill();
        ctx.strokeStyle = "#FFD666";
        ctx.lineWidth = 1;
        roundRect(ctx, badgeX, rowY + 3, badgeW, sectionH - 14 - 6, 4);
        ctx.stroke();
        ctx.font = `900 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#FFD666";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "#FFD666";
        ctx.shadowBlur = 4;
        ctx.fillText("↑ 晋升", badgeX + badgeW / 2, rowY + (sectionH - 14) / 2);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("暂无段位信息", x, y + 16);
      ctx.restore();
    }
    return y + sectionH;
  }

  /** 心理弱点分析：展示正确率最低的心理手法 + 遭遇统计 */
  private drawPsychologySection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: FBStats): number {
    const psyStats = stats.psychologyStats || {};
    const entries = Object.entries(psyStats).filter(([, v]) => v && v.total > 0);
    entries.sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
    const weakest = entries[0];
    const weakestTag = stats.weakestPsychology ?? weakest?.[0];

    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("心理弱点 · PSYCHOLOGY", x, y);
    ctx.restore();

    const rowY = y + 14;
    const rowH = 28;
    if (weakestTag) {
      const label = PSYCHOLOGY_LABELS[weakestTag as FBPsychology] ?? weakestTag;
      const data = psyStats[weakestTag];
      const rate = data && data.total > 0 ? data.correct / data.total : 0;
      const rateColor = rate >= 0.8 ? "#1AD670" : rate >= 0.5 ? "#FFD666" : "#E5353B";
      const weakColor = "#E5353B";
      // 背景条
      roundRect(ctx, x, rowY, w, rowH, 6);
      ctx.fillStyle = withAlpha(weakColor, 0.08);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(weakColor, 0.4);
      roundRect(ctx, x, rowY, w, rowH, 6);
      ctx.stroke();
      ctx.save();
      // 弱点标签
      ctx.font = `900 12px ${Theme.fonts.display}`;
      ctx.fillStyle = weakColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.shadowColor = withAlpha(weakColor, 0.5);
      ctx.shadowBlur = 4;
      ctx.fillText("⚠ " + label, x + 8, rowY + rowH / 2);
      ctx.shadowBlur = 0;
      // 遭遇次数与正确率
      const totalNum = data?.total ?? 0;
      const correctNum = data?.correct ?? 0;
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = rateColor;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${correctNum}/${totalNum} · ${Math.round(rate * 100)}%`, x + w - 8, rowY + rowH / 2);
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("暂无心理弱点数据", x, rowY + 4);
      ctx.restore();
    }
    return rowY + rowH;
  }

  /** 错题本：展示最近错题（最多2条），含题名与错误类型 */
  private drawWrongRecordsSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: FBStats): number {
    const records = stats.wrongRecords ?? [];
    if (records.length === 0) return y;

    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`错题本 · WRONG BOOK (${records.length})`, x, y);
    ctx.restore();

    let itemY = y + 16;
    const itemH = 26;
    const itemGap = 4;
    const showCount = Math.min(records.length, 2);
    for (let i = 0; i < showCount; i++) {
      const r = records[i];
      const kindLabel = r.kind === "timeout" ? "超时" : r.kind === "risk" ? "风险" : "错答";
      const kindColor = r.kind === "timeout" ? "#FFD666" : r.kind === "risk" ? "#FF7A1A" : "#E5353B";
      ctx.save();
      // 背景
      roundRect(ctx, x, itemY, w, itemH, 4);
      ctx.fillStyle = "rgba(229,53,59,0.06)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(kindColor, 0.3);
      roundRect(ctx, x, itemY, w, itemH, 4);
      ctx.stroke();
      // 错误类型徽章
      const badgeW = 34;
      roundRect(ctx, x + 4, itemY + 5, badgeW, itemH - 10, 3);
      ctx.fillStyle = withAlpha(kindColor, 0.2);
      ctx.fill();
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = kindColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(kindLabel, x + 4 + badgeW / 2, itemY + itemH / 2);
      // 题名（截断）
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const titleMaxW = w - badgeW - 16;
      let title = r.title;
      if (ctx.measureText(title).width > titleMaxW) {
        while (title.length > 1 && ctx.measureText(title + "…").width > titleMaxW) title = title.slice(0, -1);
        title += "…";
      }
      ctx.fillText(title, x + 4 + badgeW + 8, itemY + itemH / 2);
      ctx.restore();
      itemY += itemH + itemGap;
    }
    if (records.length > showCount) {
      ctx.save();
      ctx.font = `500 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(`+${records.length - showCount} 更多…`, x + w, itemY);
      ctx.restore();
      itemY += 12;
    }
    return itemY;
  }

  /** 成就解锁：展示本局新解锁的 FB 成就芯片 */
  private drawNewAchievementsSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: FBStats): number {
    const newIds = stats.newAchievements ?? [];
    if (newIds.length === 0) return y;

    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`本局解锁 · ACHIEVEMENTS (${newIds.length})`, x, y);
    ctx.restore();

    const chipY = y + 16;
    const chipH = 20;
    let chipX = x;
    for (const id of newIds) {
      const a = FBACHIEVEMENTS.find((it) => it.id === id);
      if (!a) continue;
      ctx.save();
      ctx.font = `700 10px ${Theme.fonts.body}`;
      const textW = ctx.measureText(a.name).width;
      const chipW = textW + 30;
      // 超出宽度则换行（简单处理：超出则停止）
      if (chipX + chipW > x + w) break;
      roundRect(ctx, chipX, chipY, chipW, chipH, 10);
      ctx.fillStyle = withAlpha("#FFD666", 0.18);
      ctx.fill();
      ctx.strokeStyle = withAlpha("#FFD666", 0.7);
      ctx.lineWidth = 1;
      roundRect(ctx, chipX, chipY, chipW, chipH, 10);
      ctx.stroke();
      // 图标
      ctx.font = `700 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(a.icon, chipX + 11, chipY + chipH / 2);
      // 文字
      ctx.font = `700 10px ${Theme.fonts.body}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(a.name, chipX + 22, chipY + chipH / 2);
      ctx.restore();
      chipX += chipW + 6;
    }
    return chipY + chipH + 4;
  }

  /**
   * B2：受害者档案（多分支"被骗档案"结局）
   * 根据本局心理弱点错题分布匹配档案，展示档案名/描述/易受骗场景/防护建议。
   */
  private drawVictimProfileSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: FBStats): number {
    const profile = stats.victimProfile;
    if (!profile) return y;

    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("受害者档案 · VICTIM PROFILE", x, y);
    ctx.restore();

    let curY = y + 16;
    // 档案卡片
    const cardH = 8 + 14 + 12 + 14 + 12 + this.wrapTextCount(ctx, profile.desc, w - 16, `400 10px ${Theme.fonts.body}`) * 13 + 8 + profile.advice.length * 11 + 16;
    roundRect(ctx, x, curY, w, cardH, 6);
    ctx.fillStyle = withAlpha(profile.color, 0.08);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha(profile.color, 0.5);
    roundRect(ctx, x, curY, w, cardH, 6);
    ctx.stroke();
    // 左侧色条
    ctx.fillStyle = profile.color;
    ctx.fillRect(x, curY, 3, cardH);

    ctx.save();
    // 档案名 + 严重度
    ctx.font = `900 12px ${Theme.fonts.display}`;
    ctx.fillStyle = profile.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(profile.color, 0.5);
    ctx.shadowBlur = 4;
    ctx.fillText(profile.name, x + 10, curY + 8);
    ctx.shadowBlur = 0;
    // 严重度标签（右上角）
    if (profile.severity > 0) {
      const sevLabel = profile.severity < 0.15 ? "轻度" : profile.severity < 0.35 ? "中度" : "高度";
      const sevColor = profile.severity < 0.15 ? "#1AD670" : profile.severity < 0.35 ? "#FFD666" : "#E5353B";
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = sevColor;
      ctx.textAlign = "right";
      ctx.fillText(`风险: ${sevLabel} ${Math.round(profile.severity * 100)}%`, x + w - 8, curY + 10);
    }
    ctx.restore();

    // 描述
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const descLines = this.wrapText(ctx, profile.desc, w - 16);
    descLines.forEach((line, i) => ctx.fillText(line, x + 10, curY + 26 + i * 13));
    let textBottomY = curY + 26 + descLines.length * 13;
    ctx.restore();

    // 易受骗场景标签
    if (profile.vulnerableScenes.length > 0) {
      ctx.save();
      ctx.font = `500 9px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("易受骗场景:", x + 10, textBottomY + 2);
      let badgeX = x + 10 + ctx.measureText("易受骗场景:").width + 4;
      for (const scene of profile.vulnerableScenes) {
        const tw = ctx.measureText(scene).width;
        if (badgeX + tw + 8 > x + w - 8) break;
        roundRect(ctx, badgeX, textBottomY + 1, tw + 6, 11, 5);
        ctx.fillStyle = withAlpha(profile.color, 0.18);
        ctx.fill();
        ctx.font = `500 9px ${Theme.fonts.body}`;
        ctx.fillStyle = profile.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(scene, badgeX + 3, textBottomY + 7);
        badgeX += tw + 10;
      }
      ctx.restore();
      textBottomY += 14;
    }

    // 防护建议
    ctx.save();
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.safe.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("✔ 防护建议", x + 10, textBottomY + 2);
    ctx.font = `400 9px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.8);
    let advY = textBottomY + 14;
    for (const adv of profile.advice) {
      ctx.fillText("· " + adv, x + 14, advY);
      advY += 11;
    }
    ctx.restore();

    return curY + cardH;
  }

  /**
   * B1：知识图谱（替换雷达图）
   * 节点按布局坐标绘制，连线表示关联，颜色按掌握度渐变，边框按诈骗大类着色。
   */
  private drawKnowledgeGraphSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: FBStats): number {
    const kg = stats.knowledgeGraph;
    if (!kg || kg.nodes.length === 0) return y;

    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const overallPct = Math.round(kg.overallMastery * 100);
    ctx.fillText(`知识图谱 · KNOWLEDGE MAP (掌握度 ${overallPct}%)`, x, y);
    ctx.restore();

    const titleH = 16;
    const graphH = 96; // 图谱区域高度
    const graphY = y + titleH;
    const graphW = w;

    // 背景框
    ctx.save();
    roundRect(ctx, x, graphY, graphW, graphH, 6);
    ctx.fillStyle = "rgba(10,25,41,0.5)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha(Theme.colors.ink.muted, 0.3);
    roundRect(ctx, x, graphY, graphW, graphH, 6);
    ctx.stroke();
    ctx.restore();

    // 先画连线
    ctx.save();
    const nodePos = new Map<string, { px: number; py: number }>();
    for (const n of kg.nodes) {
      nodePos.set(n.id, { px: x + n.x * graphW, py: graphY + n.y * graphH });
    }
    for (const n of kg.nodes) {
      const from = nodePos.get(n.id)!;
      for (const linkId of n.links) {
        const to = nodePos.get(linkId);
        if (!to) continue;
        ctx.strokeStyle = withAlpha(Theme.colors.ink.muted, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(from.px, from.py);
        ctx.lineTo(to.px, to.py);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 画节点
    ctx.save();
    for (const n of kg.nodes) {
      const px = x + n.x * graphW;
      const py = graphY + n.y * graphH;
      const catColor = KNOWLEDGE_GRAPH_COLORS[n.category] ?? "#9FE3FF";
      // 掌握度颜色：0=红, 0.5=黄, 1=绿
      const masteryColor = n.total === 0
        ? "#5A6B85" // 未遇到：灰色
        : n.mastery >= 0.8 ? "#1AD670"
          : n.mastery >= 0.5 ? "#FFD666"
            : "#E5353B";
      const r = n.total > 0 ? 5 : 3;
      // 外圈：类别色
      ctx.beginPath();
      ctx.arc(px, py, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(catColor, 0.3);
      ctx.fill();
      // 内圈：掌握度色
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = masteryColor;
      ctx.shadowColor = withAlpha(masteryColor, 0.6);
      ctx.shadowBlur = n.total > 0 ? 4 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
      // 节点名（小字，仅总数>0或空间允许时显示）
      if (n.total > 0 || graphW > 200) {
        ctx.font = `500 8px ${Theme.fonts.body}`;
        ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, n.total > 0 ? 0.9 : 0.5);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = n.name.length > 5 ? n.name.slice(0, 4) + "…" : n.name;
        ctx.fillText(label, px, py + r + 2);
      }
    }
    ctx.restore();

    // 图例
    ctx.save();
    ctx.font = `500 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const legendY = graphY + graphH - 10;
    let legX = x + 6;
    const legends: Array<{ c: string; t: string }> = [
      { c: "#1AD670", t: "≥80%" },
      { c: "#FFD666", t: "≥50%" },
      { c: "#E5353B", t: "<50%" },
      { c: "#5A6B85", t: "未遇" },
    ];
    for (const lg of legends) {
      ctx.beginPath();
      ctx.arc(legX + 3, legendY + 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = lg.c;
      ctx.fill();
      ctx.fillText(lg.t, legX + 8, legendY);
      legX += 8 + ctx.measureText(lg.t).width + 8;
    }
    ctx.restore();

    return graphY + graphH;
  }

  /**
   * A1：案例档案（本局遭遇的真实案例溯源）
   * 展示案例标题、日期、来源、关键启示，强化教育属性。
   */
  private drawCaseArchivesSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: FBStats): number {
    const archives = stats.caseArchives ?? [];
    if (archives.length === 0) return y;

    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`案例档案 · CASE ARCHIVES (${archives.length})`, x, y);
    ctx.restore();

    let curY = y + 16;
    const itemH = 44;
    const itemGap = 4;
    const showCount = Math.min(archives.length, 3);
    for (let i = 0; i < showCount; i++) {
      const a = archives[i];
      ctx.save();
      // 背景
      roundRect(ctx, x, curY, w, itemH, 4);
      ctx.fillStyle = "rgba(0,229,255,0.05)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.3);
      roundRect(ctx, x, curY, w, itemH, 4);
      ctx.stroke();
      // 左侧溯源色条
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.fillRect(x, curY, 2, itemH);
      // 案例标题
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const titleText = a.title.length > 22 ? a.title.slice(0, 21) + "…" : a.title;
      ctx.fillText("📄 " + titleText, x + 8, curY + 6);
      // 日期 + 来源
      ctx.font = `500 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      const meta = `${a.date} · ${a.source}`;
      const metaText = meta.length > 28 ? meta.slice(0, 27) + "…" : meta;
      ctx.fillText(metaText, x + w - 8, curY + 8);
      // 关键启示
      ctx.font = `400 9px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const takeLines = this.wrapText(ctx, "启示: " + a.takeaway, w - 16);
      takeLines.slice(0, 2).forEach((line, li) => ctx.fillText(line, x + 8, curY + 22 + li * 11));
      ctx.restore();
      curY += itemH + itemGap;
    }
    if (archives.length > showCount) {
      ctx.save();
      ctx.font = `500 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`…还有 ${archives.length - showCount} 个案例`, x + w / 2, curY);
      ctx.restore();
      curY += 12;
    }
    return curY;
  }

  /** 辅助：文本换行（按字符宽度测量，使用传入的 ctx） */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const chars = text.split("");
    const lines: string[] = [];
    let line = "";
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /** 辅助：计算文本换行后的行数（指定字体，避免破坏当前 ctx 字体状态） */
  private wrapTextCount(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): number {
    ctx.save();
    ctx.font = font;
    const chars = text.split("");
    let line = "";
    let count = 0;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        count++;
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) count++;
    ctx.restore();
    return count;
  }

  private retry(): void {
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.pressedOpt = null;
    this.pressedSubmit = false;
    this.pressedItem = null;
    this.prevCombo = 0;
    this.displayScore = 0;
    this.scorePulse = 0;
    this.swipeTouchId = null;
    this.swipeCardIdx = null;
    this.gameState = "ready";
    this.pressedDifficulty = null;
    this.pressedUltimate = false;
    this.pressedSubmitBtn = false;
    this.linkSelLeftIdx = null;
    this.sortSelIdx = null;
    this.fx.clear();
    this.spawnEngine();
  }

  protected updateGame(dt: number): void {
    this.t += dt;
    // 仅在 playing 状态驱动引擎 update
    if (this.gameState === "playing") {
      this.engine?.stepUpdate(dt);
    }
    // 得分数字滚动追逐（爽感：分数跳动）
    this.updateScoreRoll(dt);
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 2.5) this.toast = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  /**
   * 得分数字滚动追逐：displayScore 向真实 score 逼近，
   * 差值越大滚得越快；检测到得分增加触发脉冲（数字放大发光）。
   */
  private updateScoreRoll(dt: number): void {
    const target = this.hud?.score ?? 0;
    if (target > this.displayScore) {
      const diff = target - this.displayScore;
      // 指数追逐，差值越大越快，但封顶避免瞬移
      const step = Math.min(diff, Math.max(diff * 8 * dt + 2 * dt, 1));
      this.displayScore = Math.min(target, this.displayScore + step);
      // 新增得分（非初始同步）触发脉冲
      if (this.displayScore > 0.5 && this.scorePulse < 0.001) this.scorePulse = 1;
    } else if (target < this.displayScore) {
      // 分数下降（罕见）：快速对齐
      this.displayScore = target;
    }
    if (this.scorePulse > 0) {
      this.scorePulse = Math.max(0, this.scorePulse - dt * 3.2);
    }
  }

  /** 选项按钮矩形（画布坐标，右半区垂直居中）。支持所有题型。 */
  private getOptionRects(kind: FBQuestionKind): Rect[] {
    if (kind === "fill") {
      // 填空题：1 个输入框
      const submitH = 44;
      const inputH = 60;
      const total = inputH + 10 + submitH;
      const startY = (CANVAS_H - total) / 2;
      return [{ x: OPT_X, y: startY, w: OPT_W, h: inputH }];
    }
    if (kind === "link") {
      // 连线题：左列项（竖向排列），右列由 getLinkRightRects 提供
      const count = this.hud?.linkLeft?.length ?? 4;
      const btnH = 50;
      const gap = 8;
      const submitH = 44;
      const total = count * btnH + (count - 1) * gap + gap + submitH;
      const startY = (CANVAS_H - total) / 2;
      const rects: Rect[] = [];
      const colW = (OPT_W - 16) / 2;
      for (let i = 0; i < count; i++) {
        rects.push({ x: OPT_X, y: startY + i * (btnH + gap), w: colW, h: btnH });
      }
      return rects;
    }
    if (kind === "sort") {
      // 排序题：竖向排列带序号
      const count = this.hud?.sortArr?.length ?? 4;
      const btnH = 50;
      const gap = 8;
      const submitH = 44;
      const total = count * btnH + (count - 1) * gap + gap + submitH;
      const startY = (CANVAS_H - total) / 2;
      const rects: Rect[] = [];
      for (let i = 0; i < count; i++) {
        rects.push({ x: OPT_X, y: startY + i * (btnH + gap), w: OPT_W, h: btnH });
      }
      return rects;
    }
    // single / judge / multi
    const isJudge = kind === "judge";
    const count = isJudge ? 2 : 4;
    const btnH = isJudge ? 72 : 60;
    const gap = 10;
    const submitH = 44;
    const total = count * btnH + (count - 1) * gap + gap + submitH;
    const startY = (CANVAS_H - total) / 2;
    const rects: Rect[] = [];
    for (let i = 0; i < count; i++) {
      rects.push({ x: OPT_X, y: startY + i * (btnH + gap), w: OPT_W, h: btnH });
    }
    return rects;
  }

  /** 连线题右列项矩形（画布坐标） */
  private getLinkRightRects(): Rect[] {
    const count = this.hud?.linkRightOrder?.length ?? 0;
    const btnH = 50;
    const gap = 8;
    const submitH = 44;
    const total = count * btnH + (count - 1) * gap + gap + submitH;
    const startY = (CANVAS_H - total) / 2;
    const rects: Rect[] = [];
    const colW = (OPT_W - 16) / 2;
    const rightX = OPT_X + colW + 16;
    for (let i = 0; i < count; i++) {
      rects.push({ x: rightX, y: startY + i * (btnH + gap), w: colW, h: btnH });
    }
    return rects;
  }

  /** 提交按钮矩形（画布坐标，所有题型统一显示） */
  private getSubmitRect(kind: FBQuestionKind): Rect {
    const rects = this.getOptionRects(kind);
    const last = rects[rects.length - 1];
    return { x: OPT_X, y: last.y + last.h + 10, w: OPT_W, h: 44 };
  }

  /** 大招按钮矩形（画布坐标，右下角） */
  private getUltimateRect(): Rect {
    return { x: ULT_BTN_X, y: ULT_BTN_Y, w: ULT_BTN_W, h: ULT_BTN_H };
  }

  /** 难度按钮矩形（画布坐标，水平居中） */
  private getDifficultyRect(id: FBDifficulty): Rect {
    const totalW = DIFF_BTN_W * 3 + DIFF_BTN_GAP * 2;
    const startX = (CANVAS_W - totalW) / 2;
    const idx = DIFFICULTY_DEFS.findIndex((d) => d.id === id);
    return { x: startX + idx * (DIFF_BTN_W + DIFF_BTN_GAP), y: (CANVAS_H - DIFF_BTN_H) / 2, w: DIFF_BTN_W, h: DIFF_BTN_H };
  }

  /** 计算 blitContain 变换（屏幕坐标 → 画布坐标的逆变换参数） */
  private getBlitTransform(screenW: number, screenH: number): { scale: number; offsetX: number; offsetY: number } {
    const cw = this.engineCanvas?.width ?? CANVAS_W;
    const ch = this.engineCanvas?.height ?? CANVAS_H;
    const scale = Math.min(screenW / cw, screenH / ch);
    const offsetX = (screenW - cw * scale) / 2;
    const offsetY = (screenH - ch * scale) / 2;
    return { scale, offsetX, offsetY };
  }

  /** 道具按钮矩形（画布坐标，顶部右半区水平排布） */
  private getItemRect(type: FBItemType): Rect {
    const idx = ITEM_TYPES.indexOf(type);
    return {
      x: ITEM_BTN_X + idx * (ITEM_BTN_W + ITEM_BTN_GAP),
      y: ITEM_BTN_Y,
      w: ITEM_BTN_W,
      h: ITEM_BTN_H,
    };
  }

  /** 道具按钮是否可用 */
  private isItemEnabled(type: FBItemType, hud: FBHud): boolean {
    if (hud.items[type] <= 0) return false;
    if (hud.selectedIdx !== null) return false; // 揭示态不可用
    if (!hud.hasQuestion) return false;
    // Boss lockItem 技能封印道具（undo 例外，可恢复体力）
    if (hud.itemLocked && type !== "undo") return false;
    // fifty 仅 single/judge
    if (type === "fifty" && hud.qKind === "multi") return false;
    // fifty 已用过本道题
    if (type === "fifty" && hud.fiftyRemoved.length > 0) return false;
    // freeze 已生效中
    if (type === "freeze" && hud.freezeRemaining > 0) return false;
    // double 已生效中
    if (type === "double" && hud.doubleRemaining > 0) return false;
    // hint 已用过本道题
    if (type === "hint" && hud.hintHighlighted.length > 0) return false;
    // undo 仅在体力未满时可用
    if (type === "undo" && hud.stamina >= hud.maxStamina) return false;
    return true;
  }

  /** 渲染 6 个道具按钮（紧凑布局：emoji 左 + 数量/状态 右） */
  private drawItemButtons(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    for (const type of ITEM_TYPES) {
      const r = this.getItemRect(type);
      const count = hud.items[type] ?? 0;
      const enabled = this.isItemEnabled(type, hud);
      const pressed = this.pressedItem === type;
      const active = (type === "freeze" && hud.freezeRemaining > 0)
        || (type === "double" && hud.doubleRemaining > 0)
        || (type === "hint" && hud.hintHighlighted.length > 0);
      // Boss 封印态：除 undo 外全部视觉锁住
      const locked = !!hud.itemLocked && type !== "undo";
      const color = type === "freeze" ? "#00E5FF"
        : type === "fifty" ? "#FFD666"
        : type === "skip" ? "#B388FF"
        : type === "double" ? "#FF7A1A"
        : type === "hint" ? "#B388FF"
        : "#52C41A";

      ctx.save();
      if (pressed && enabled) ctx.translate(0, 1);
      // 背景
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      if (locked) {
        ctx.fillStyle = "#1A0E0E";
      } else if (active) {
        const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        g.addColorStop(0, withAlpha(color, 0.4));
        g.addColorStop(1, withAlpha(color, 0.14));
        ctx.fillStyle = g;
      } else if (enabled) {
        const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        g.addColorStop(0, "#1B3A5A");
        g.addColorStop(1, "#0A1929");
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = "#0A1626";
      }
      ctx.fill();
      // 边框
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = locked ? "rgba(229,53,59,0.5)"
        : enabled ? color : "rgba(122,143,176,0.3)";
      if (active) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10 + Math.sin(this.t * 6) * 3;
      } else if (enabled && !locked) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
      }
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 顶部色条（active 状态视觉强化）
      if (active) {
        ctx.fillStyle = color;
        roundRect(ctx, r.x + 4, r.y + 2, r.w - 8, 2, 1);
        ctx.fill();
      }
      // emoji 图标（左）
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = locked ? "rgba(122,143,176,0.4)"
        : enabled ? "#FFFFFF" : "rgba(122,143,176,0.5)";
      ctx.fillText(itemEmoji(type), r.x + 14, r.y + r.h / 2);
      // 数量徽章 / 持续状态（右）
      ctx.textAlign = "right";
      if (locked) {
        // 封印态显示锁标
        ctx.font = `700 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = "rgba(229,53,59,0.8)";
        ctx.fillText("🔒", r.x + r.w - 6, r.y + r.h / 2);
      } else if (active) {
        ctx.font = `700 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = color;
        const remain = type === "freeze"
          ? `${hud.freezeRemaining.toFixed(1)}s`
          : type === "double"
            ? `×${hud.doubleRemaining}`
            : "ON";
        ctx.fillText(remain, r.x + r.w - 6, r.y + r.h / 2);
      } else {
        ctx.font = `900 12px ${Theme.fonts.mono}`;
        ctx.fillStyle = enabled ? color : "rgba(122,143,176,0.5)";
        ctx.fillText(`×${count}`, r.x + r.w - 6, r.y + r.h / 2);
      }
      ctx.restore();
    }
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 同步驱动引擎渲染：确保 engineCanvas 在 blitContain 之前已完成本帧绘制，
    // 与 SceneDirector 主循环同帧，消除双 RAF 撕裂闪烁。
    if (this.engineCanvas && this.engine) {
      this.engine.stepRender();
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // ===== ready 状态：难度选择界面 =====
    if (this.gameState === "ready") {
      const tr = this.getBlitTransform(screenW, screenH);
      ctx.save();
      ctx.translate(tr.offsetX, tr.offsetY);
      ctx.scale(tr.scale, tr.scale);
      this.drawDifficultySelect(ctx);
      ctx.restore();
      // Toast（屏幕坐标）
      if (this.toast) {
        const tw = screenW - 32;
        drawToast(ctx, 16, 116, tw, 56, this.toast.text, this.toast.tone, "反诈提示");
      }
      // 结算
      if (this.resultOverlay) {
        this.resultOverlay.render(ctx, screenW, screenH);
      }
      return;
    }

    // 顶部 HUD（屏幕坐标，位于顶部栏下方）
    if (this.hud) {
      this.renderStats(ctx, screenW);
    }

    // 特殊波次事件指示器（屏幕坐标，顶部中央下方）
    if (this.hud && this.hud.specialEvent) {
      this.drawSpecialEventBanner(ctx, screenW, this.hud.specialEvent);
    }

    // 连锁题指示器（屏幕坐标，紧贴特殊事件下方）
    if (this.hud && this.hud.chainStep) {
      this.drawChainIndicator(ctx, screenW, this.hud.chainStep);
    }

    // Boss 技能指示器（屏幕坐标）
    if (this.hud && this.hud.bossActive && this.hud.bossSkill) {
      this.drawBossSkillIndicator(ctx, screenW, this.hud.bossSkill);
    }

    // 诈骗分子挑衅横幅（高压/错答时出现，压迫感+代入感）
    if (this.hud && this.hud.taunt) {
      this.drawTauntBanner(ctx, screenW, this.hud.taunt);
    }

    // 心跳边缘红脉（压迫感）：HUD 层叠加，与引擎心跳同步
    if (this.hud && this.hud.heartbeat > 0.3) {
      this.drawHeartbeatEdge(ctx, screenW, screenH, this.hud.heartbeat);
    }

    // 选项按钮 + 倒计时（画布坐标，应用 blitContain 变换，与卡片同坐标系）
    if (this.hud && this.hud.hasQuestion) {
      const tr = this.getBlitTransform(screenW, screenH);
      ctx.save();
      ctx.translate(tr.offsetX, tr.offsetY);
      ctx.scale(tr.scale, tr.scale);

      const kind = this.hud.qKind;
      const isRevealing = this.hud.selectedIdx !== null;

      if (kind === "fill") {
        // 填空题 UI
        this.drawFillQuestion(ctx, this.hud, isRevealing);
      } else if (kind === "link") {
        // 连线题 UI
        this.drawLinkQuestion(ctx, this.hud, isRevealing);
      } else if (kind === "sort") {
        // 排序题 UI
        this.drawSortQuestion(ctx, this.hud, isRevealing);
      } else if (kind === "branch") {
        // v2 分支题 UI（B3）
        this.drawBranchQuestion(ctx, this.hud, isRevealing);
      } else if (kind !== "judge" || isRevealing) {
        // 单选/多选/判断揭示态：画选项按钮
        const rects = this.getOptionRects(kind);
        const safeKind = (kind === "single" || kind === "multi") ? kind : "single";
        for (let i = 0; i < rects.length; i++) {
          this.drawOptionButton(ctx, rects[i], i, this.hud, isRevealing, safeKind);
        }
        const subRect = this.getSubmitRect(kind);
        this.drawAutoSubmitHint(ctx, subRect, this.hud, isRevealing);
        // v2 AI 语音题：在选项上方画音频播放器（A2）
        if (this.hud.audio) {
          this.drawAudioPlayer(ctx, this.hud);
        }
      } else {
        // 判断题滑动提示（单卡/双卡）
        this.drawSwipeHints(ctx, this.hud);
      }

      // 双卡模式：第二张卡选项按钮（右半区）
      if (this.hud.dualMode && this.hud.second) {
        this.drawDualSecondCardOptions(ctx, this.hud);
      }

      // 倒计时压迫条（画布坐标，双卡模式跳过：每张卡已有独立倒计时）
      if (!this.hud.dualMode) {
        this.drawCountdownBar(ctx, this.hud);
      }
      // 道具按钮（画布顶部右半区）
      this.drawItemButtons(ctx, this.hud);

      // 大招按钮（画布右下角，ultimateReady 时显示）
      if (this.hud.ultimateReady) {
        this.drawUltimateButton(ctx, this.hud);
      }

      ctx.restore();
    }

    // Toast（屏幕坐标）
    if (this.toast) {
      const tw = screenW - 32;
      const th = 56;
      // 有诈骗挑衅横幅时，toast 下移避免遮挡
      const ty = this.hud && this.hud.taunt ? 140 : 116;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "反诈提示");
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  /** 难度选择界面（ready 状态，画布坐标） */
  private drawDifficultySelect(ctx: CanvasRenderingContext2D): void {
    // 半透明遮罩
    ctx.save();
    ctx.fillStyle = "rgba(7,14,31,0.85)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();

    // 标题
    ctx.save();
    ctx.font = `900 28px ${Theme.fonts.display}`;
    ctx.fillStyle = this.getAccent();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(this.getAccent(), 0.5);
    ctx.shadowBlur = 14;
    ctx.fillText("选择难度", CANVAS_W / 2, 120);
    ctx.shadowBlur = 0;
    ctx.font = `400 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("SELECT DIFFICULTY", CANVAS_W / 2, 152);
    ctx.restore();

    // 三个难度按钮
    for (const def of DIFFICULTY_DEFS) {
      const r = this.getDifficultyRect(def.id);
      const pressed = this.pressedDifficulty === def.id;
      ctx.save();
      if (pressed) ctx.translate(0, 2);
      // 背景
      roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, withAlpha(def.color, 0.25));
      g.addColorStop(1, "rgba(10,25,41,0.8)");
      ctx.fillStyle = g;
      ctx.fill();
      // 边框（脉动发光）
      const pulse = 0.6 + Math.sin(this.t * 3 + DIFFICULTY_DEFS.indexOf(def) * 1.5) * 0.4;
      ctx.lineWidth = 2;
      ctx.strokeStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8 + pulse * 6;
      roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 难度名
      ctx.font = `900 22px ${Theme.fonts.display}`;
      ctx.fillStyle = def.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.label, r.x + r.w / 2, r.y + r.h / 2 - 10);
      // 描述
      ctx.font = `500 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText(def.desc, r.x + r.w / 2, r.y + r.h / 2 + 16);
      ctx.restore();
    }

    // 底部提示
    ctx.save();
    ctx.font = `500 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("点击难度开始游戏 · 困难模式倒计时更短", CANVAS_W / 2, CANVAS_H - 60);
    ctx.restore();
  }

  /** 大招按钮（画布右下角，金色脉动 + 能量条） */
  private drawUltimateButton(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    const r = this.getUltimateRect();
    const pressed = this.pressedUltimate;
    const pulse = 0.6 + Math.sin(this.t * 6) * 0.4;
    ctx.save();
    if (pressed) ctx.translate(0, 2);
    // 背景
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, "rgba(255,214,102,0.35)");
    g.addColorStop(1, "rgba(120,80,0,0.6)");
    ctx.fillStyle = g;
    ctx.fill();
    // 金色脉动边框
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#FFD666";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 10 + pulse * 8;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // ⚡ 图标 + 文字
    ctx.font = `900 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 6;
    ctx.fillText("⚡ 必杀技", r.x + r.w / 2, r.y + r.h / 2 - 4);
    ctx.shadowBlur = 0;
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFE9A8";
    ctx.fillText("点击释放", r.x + r.w / 2, r.y + r.h / 2 + 12);
    ctx.restore();

    // 能量条（按钮左侧）
    const barW = 80;
    const barH = 8;
    const barX = r.x - barW - 8;
    const barY = r.y + r.h / 2 - barH / 2;
    ctx.save();
    // 背景
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fillStyle = "rgba(10,25,41,0.8)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,214,102,0.4)";
    ctx.lineWidth = 1;
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.stroke();
    // 填充
    const fillW = Math.max(2, barW * (hud.ultimateEnergy / 100));
    roundRect(ctx, barX, barY, fillW, barH, 4);
    ctx.fillStyle = "#FFD666";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    // 能量数值
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${Math.round(hud.ultimateEnergy)}/100`, barX + barW / 2, barY - 2);
    ctx.restore();
  }

  /** 填空题 UI（输入框 + 提交按钮） */
  private drawFillQuestion(ctx: CanvasRenderingContext2D, hud: FBHud, revealing: boolean): void {
    const rects = this.getOptionRects("fill");
    const inputR = rects[0];
    const subR = this.getSubmitRect("fill");
    const inputText = hud.fillInput ?? "";

    // 输入框
    ctx.save();
    roundRect(ctx, inputR.x, inputR.y, inputR.w, inputR.h, 10);
    const g = ctx.createLinearGradient(inputR.x, inputR.y, inputR.x, inputR.y + inputR.h);
    g.addColorStop(0, "#13294A");
    g.addColorStop(1, "#0A1929");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = revealing ? (hud.correctIdx === -2 ? "#1AD670" : "#E5353B") : "#00E5FF";
    ctx.shadowColor = ctx.strokeStyle as string;
    ctx.shadowBlur = 6;
    roundRect(ctx, inputR.x, inputR.y, inputR.w, inputR.h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 标签
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("✏ 输入答案", inputR.x + 12, inputR.y + 8);
    // 输入文本（光标闪烁）
    ctx.font = `700 18px ${Theme.fonts.body}`;
    ctx.fillStyle = revealing ? (hud.correctIdx === -2 ? "#9FFFC0" : "#FFC0C0") : "#F0F4FF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const displayText = revealing ? inputText : (inputText + (Math.sin(this.t * 4) > 0 ? "|" : " "));
    this.drawClampedText(ctx, displayText, inputR.x + 14, inputR.y + inputR.h / 2 + 6, inputR.w - 28);
    ctx.restore();

    // 揭示态：显示正确答案
    if (revealing) {
      ctx.save();
      const ansY = inputR.y + inputR.h + 4;
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#1AD670";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("正确答案: " + (this.engine?.getCurrentFillAnswer() ?? ""), inputR.x, ansY);
      ctx.restore();
    }

    // 提交按钮
    this.drawSubmitButton(ctx, subR, hud, revealing, "提交答案");
  }

  /** 连线题 UI（左列 + 右列 + 连线 + 提交） */
  private drawLinkQuestion(ctx: CanvasRenderingContext2D, hud: FBHud, revealing: boolean): void {
    const leftRects = this.getOptionRects("link");
    const rightRects = this.getLinkRightRects();
    const leftTexts = hud.linkLeft ?? [];
    const rightOrder = hud.linkRightOrder ?? [];
    const rightTexts = hud.linkRight ?? [];
    const linkSel = hud.linkSel ?? [];
    const subR = this.getSubmitRect("link");

    // 绘制连线（已配对的项之间画金色线）
    if (linkSel.length > 0) {
      ctx.save();
      ctx.strokeStyle = revealing ? "#FFD666" : "rgba(255,214,102,0.7)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 4;
      for (let i = 0; i < linkSel.length; i++) {
        const rightOrig = linkSel[i];
        if (rightOrig < 0) continue;
        // 找到右列原始下标 rightOrig 在 rightOrder 中的显示位置
        const displayIdx = rightOrder.indexOf(rightOrig);
        if (displayIdx < 0 || i >= leftRects.length || displayIdx >= rightRects.length) continue;
        const lr = leftRects[i];
        const rr = rightRects[displayIdx];
        ctx.beginPath();
        ctx.moveTo(lr.x + lr.w, lr.y + lr.h / 2);
        ctx.lineTo(rr.x, rr.y + rr.h / 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 左列
    for (let i = 0; i < leftRects.length && i < leftTexts.length; i++) {
      this.drawLinkItem(ctx, leftRects[i], leftTexts[i], i, "left", this.linkSelLeftIdx === i, linkSel[i] >= 0, revealing, hud);
    }
    // 右列（按 rightOrder 顺序）
    for (let i = 0; i < rightRects.length && i < rightOrder.length; i++) {
      const origIdx = rightOrder[i];
      const text = rightTexts[origIdx] ?? "";
      // 该右列项是否已被配对
      const paired = linkSel.includes(origIdx);
      this.drawLinkItem(ctx, rightRects[i], text, i, "right", false, paired, revealing, hud);
    }

    // 提交按钮
    this.drawSubmitButton(ctx, subR, hud, revealing, "提交配对");
  }

  /** 连线题单项按钮 */
  private drawLinkItem(ctx: CanvasRenderingContext2D, r: Rect, text: string, idx: number, side: "left" | "right", selected: boolean, paired: boolean, revealing: boolean, hud: FBHud): void {
    let baseColor = "#13294A";
    let edgeColor = "rgba(0,229,255,0.4)";
    let textColor = "#F0F4FF";
    if (selected) {
      baseColor = "#3A2A0A"; edgeColor = "#FFD666"; textColor = "#FFD666";
    } else if (paired) {
      baseColor = "#0F3A24"; edgeColor = "#1AD670"; textColor = "#9FFFC0";
    }
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, baseColor);
    g.addColorStop(1, "#0A1626");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = edgeColor;
    if (selected || paired) { ctx.shadowColor = edgeColor; ctx.shadowBlur = 8; }
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 文字
    ctx.font = `500 12px ${Theme.fonts.body}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    this.drawClampedText(ctx, text, r.x + r.w / 2, r.y + r.h / 2, r.w - 16);
    ctx.restore();
  }

  /** 排序题 UI（带序号列表 + 交换 + 提交） */
  private drawSortQuestion(ctx: CanvasRenderingContext2D, hud: FBHud, revealing: boolean): void {
    const rects = this.getOptionRects("sort");
    const sortArr = hud.sortArr ?? [];
    const options = hud.options ?? [];
    const subR = this.getSubmitRect("sort");

    for (let i = 0; i < rects.length && i < sortArr.length; i++) {
      const r = rects[i];
      const origIdx = sortArr[i];
      const text = options[origIdx] ?? "";
      const selected = this.sortSelIdx === i;
      let baseColor = "#13294A";
      let edgeColor = "rgba(0,229,255,0.4)";
      let textColor = "#F0F4FF";
      if (selected) {
        baseColor = "#3A2A0A"; edgeColor = "#FFD666"; textColor = "#FFD666";
      }
      ctx.save();
      roundRect(ctx, r.x, r.y, r.w, r.h, 8);
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, baseColor);
      g.addColorStop(1, "#0A1626");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = edgeColor;
      if (selected) { ctx.shadowColor = edgeColor; ctx.shadowBlur = 8; }
      roundRect(ctx, r.x, r.y, r.w, r.h, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 序号徽章
      const bx = r.x + 22;
      const by = r.y + r.h / 2;
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#FFD666" : "#1B4A6E";
      ctx.fill();
      ctx.font = `900 14px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, bx, by);
      // 选项文字
      ctx.font = `500 13px ${Theme.fonts.body}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      this.drawClampedText(ctx, text, r.x + 44, by, r.w - 56);
      ctx.restore();
    }

    // 提交按钮
    this.drawSubmitButton(ctx, subR, hud, revealing, "提交顺序");
  }

  /** 通用提交按钮（fill/link/sort 题型） */
  private drawSubmitButton(ctx: CanvasRenderingContext2D, r: Rect, hud: FBHud, revealing: boolean, label: string): void {
    const pressed = this.pressedSubmitBtn;
    ctx.save();
    if (pressed && !revealing) ctx.translate(0, 1);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    if (revealing) {
      g.addColorStop(0, "rgba(10,25,41,0.6)");
      g.addColorStop(1, "rgba(10,25,41,0.4)");
    } else {
      g.addColorStop(0, "rgba(26,214,112,0.25)");
      g.addColorStop(1, "rgba(10,80,40,0.5)");
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = revealing ? "rgba(122,143,176,0.3)" : "#1AD670";
    if (!revealing) { ctx.shadowColor = "#1AD670"; ctx.shadowBlur = 6; }
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = revealing ? "#7A8FB0" : "#1AD670";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(revealing ? "· 已作答 ·" : label, r.x + r.w / 2, r.y + r.h / 2);
    ctx.restore();
  }

  /** 双卡模式第二张卡选项按钮（画布右半区 x>400） */
  private drawDualSecondCardOptions(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    if (!hud.second) return;
    const second = hud.second;
    // 第二张卡在右半区（offsetX=400），选项按钮也应在右半区
    // 使用与主卡相同的布局，但偏移到右半区
    const isJudge = second.qKind === "judge";
    const isRevealing = second.selectedIdx !== null;
    if (isJudge && !isRevealing) return; // 判断题用滑动手势，不画选项按钮

    const count = second.options.length;
    const btnH = isJudge ? 60 : 52;
    const gap = 6;
    const total = count * btnH + (count - 1) * gap;
    const startY = (CANVAS_H - total) / 2;
    // 右半区选项：x 从 420 开始，宽度 160（不超出右卡区域 420~780）
    const dualOptX = 420;
    const dualOptW = 160;

    for (let i = 0; i < count; i++) {
      const r: Rect = { x: dualOptX, y: startY + i * (btnH + gap), w: dualOptW, h: btnH };
      const text = second.options[i] ?? "";
      const isCorrect = isRevealing && second.correctIdx === i;
      const isWrongSel = isRevealing && second.selectedIdx === i && second.correctIdx !== i;

      let baseColor = "#13294A";
      let edgeColor = "rgba(0,229,255,0.4)";
      let textColor = "#F0F4FF";
      if (isCorrect) { baseColor = "#0F3A24"; edgeColor = "#1AD670"; textColor = "#9FFFC0"; }
      else if (isWrongSel) { baseColor = "#3A1414"; edgeColor = "#E5353B"; textColor = "#FFC0C0"; }
      else if (isRevealing) { baseColor = "#0E1E36"; edgeColor = "rgba(0,229,255,0.15)"; textColor = "#7A8FB0"; }

      ctx.save();
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, baseColor);
      g.addColorStop(1, "#0A1626");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = edgeColor;
      if (isCorrect || isWrongSel) { ctx.shadowColor = edgeColor; ctx.shadowBlur = 8; }
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 字母徽章
      const bx = r.x + 16;
      const by = r.y + r.h / 2;
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.fillStyle = isCorrect ? "#1AD670" : isWrongSel ? "#E5353B" : "#1B4A6E";
      ctx.fill();
      ctx.font = `900 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(LETTERS[i] ?? `${i}`, bx, by);
      // 文字
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      this.drawClampedText(ctx, text, r.x + 32, by, r.w - 40);
      ctx.restore();
    }
  }

  /** 特殊波次事件横幅：紫色脉动胶囊，提示当前事件类型 */
  private drawSpecialEventBanner(ctx: CanvasRenderingContext2D, screenW: number, event: FBSpecialEvent): void {
    const name = SPECIAL_EVENT_NAMES[event];
    const icon = SPECIAL_EVENT_ICONS[event];
    const text = `${icon} 特殊波次 · ${name}`;
    ctx.save();
    ctx.font = `900 12px ${Theme.fonts.mono}`;
    const tw = ctx.measureText(text).width + 36;
    const x = (screenW - tw) / 2;
    const y = 70;
    const h = 22;
    // 脉动透明度
    const pulse = 0.7 + Math.sin(this.t * 4) * 0.3;
    // 胶囊背景
    roundRect(ctx, x, y, tw, h, 11);
    const g = ctx.createLinearGradient(x, y, x + tw, y);
    g.addColorStop(0, "rgba(179,136,255,0.32)");
    g.addColorStop(0.5, "rgba(120,60,200,0.45)");
    g.addColorStop(1, "rgba(179,136,255,0.32)");
    ctx.fillStyle = g;
    ctx.globalAlpha = pulse;
    ctx.fill();
    ctx.globalAlpha = 1;
    // 边框
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(179,136,255,0.9)";
    ctx.shadowColor = "#B388FF";
    ctx.shadowBlur = 8;
    roundRect(ctx, x, y, tw, h, 11);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 文字
    ctx.fillStyle = "#E0CCFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + tw / 2, y + h / 2 + 1);
    ctx.restore();
  }

  /** 连锁题指示器：金色胶囊，显示当前步骤 1/2 或 2/2 */
  private drawChainIndicator(ctx: CanvasRenderingContext2D, screenW: number, step: number): void {
    const text = `🔗 情景连锁 ${step}/2`;
    ctx.save();
    ctx.font = `900 11px ${Theme.fonts.mono}`;
    const tw = ctx.measureText(text).width + 24;
    const x = (screenW - tw) / 2;
    const y = 96;
    const h = 18;
    roundRect(ctx, x, y, tw, h, 9);
    ctx.fillStyle = "rgba(255,214,102,0.18)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,214,102,0.85)";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 6;
    roundRect(ctx, x, y, tw, h, 9);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = step === 2 ? "#FFD666" : "#FFE9A8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + tw / 2, y + h / 2 + 1);
    ctx.restore();
  }

  /** Boss 技能指示器：红色胶囊，显示当前激活的 Boss 技能 */
  private drawBossSkillIndicator(ctx: CanvasRenderingContext2D, screenW: number, skill: FBBossSkill): void {
    const name = BOSS_SKILL_NAMES[skill];
    const text = `⚠ Boss 技能 · ${name}`;
    ctx.save();
    ctx.font = `900 11px ${Theme.fonts.mono}`;
    const tw = ctx.measureText(text).width + 28;
    // 紧贴右上角下方（避开猛男图标）
    const x = screenW - tw - 88;
    const y = 70;
    const h = 20;
    const pulse = 0.7 + Math.sin(this.t * 8) * 0.3;
    roundRect(ctx, x, y, tw, h, 10);
    ctx.fillStyle = `rgba(229,53,59,${0.35 * pulse})`;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(229,53,59,0.95)";
    ctx.shadowColor = "#E5353B";
    ctx.shadowBlur = 8;
    roundRect(ctx, x, y, tw, h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFC0C0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + tw / 2, y + h / 2 + 1);
    ctx.restore();
  }

  /** 倒计时压迫条：画布右侧竖条 + 卡片区中央数字（画布坐标） */
  private drawCountdownBar(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    if (!hud.hasQuestion || hud.selectedIdx !== null) return;
    const ratio = hud.timerRatio;
    if (ratio <= 0) return;
    // 右侧竖条（画布右边缘）
    const barX = CANVAS_W - 10;
    const barY = 80;
    const barH = CANVAS_H - 160;
    const barW = 6;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();
    const fillH = barH * ratio;
    const color = ratio > 0.5 ? "#1AD670" : ratio > 0.25 ? "#FFD666" : "#E5353B";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = ratio < 0.3 ? 12 : 6;
    roundRect(ctx, barX, barY + barH - fillH, barW, fillH, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 卡片区中央倒计时数字（高压时）
    if (ratio < 0.3) {
      const secs = Math.max(0, ratio * (hud.qKind === "multi" ? 7 : 5)).toFixed(1);
      const pulse = 0.7 + Math.sin(this.t * 14) * 0.3;
      ctx.font = `900 ${Math.round(48 * pulse)}px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#E5353B";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#E5353B";
      ctx.shadowBlur = 18;
      ctx.fillText(secs, 200, CANVAS_H / 2 - 60);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // ===== v2 升级渲染方法 =====

  /** 分支题渲染（B3：第一人称情景模拟） */
  private drawBranchQuestion(ctx: CanvasRenderingContext2D, hud: FBHud, revealing: boolean): void {
    const branch = hud.branch;
    if (!branch) return;
    const x = OPT_X + 10;
    const y = 80;
    const w = OPT_W - 20;
    // 步骤标题
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = "#B388FF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`🎬 ${branch.currentTitle}`, x, y);
    ctx.restore();
    // 场景描述（换行）
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const sceneLines = this.wrapText(ctx, branch.currentScene, w - 16);
    sceneLines.forEach((line: string, i: number) => ctx.fillText(line, x + 8, y + 24 + i * 16));
    ctx.restore();
    // 选项按钮（回复选择）
    if (!branch.ended) {
      const choiceY = y + 24 + sceneLines.length * 16 + 12;
      const choiceH = 48;
      const choiceGap = 8;
      for (let i = 0; i < branch.choices.length; i++) {
        const cy = choiceY + i * (choiceH + choiceGap);
        const choice = branch.choices[i];
        const hover = this.pressedOpt === i;
        ctx.save();
        roundRect(ctx, x, cy, w, choiceH, 6);
        ctx.fillStyle = hover ? "rgba(179,136,255,0.25)" : "rgba(179,136,255,0.10)";
        ctx.fill();
        ctx.strokeStyle = "rgba(179,136,255,0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        // 回复文本
        ctx.save();
        ctx.font = `400 12px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.DEFAULT;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const lines = this.wrapText(ctx, choice.text, w - 24);
        lines.forEach((line: string, li: number) => ctx.fillText(line, x + 12, cy + 10 + li * 15));
        ctx.restore();
      }
    } else {
      // 结局展示
      const endY = y + 24 + sceneLines.length * 16 + 16;
      const endColor = branch.ending === "safe" ? "#1AD670" : branch.ending === "scammed" ? "#E5353B" : "#FFD666";
      ctx.save();
      roundRect(ctx, x, endY, w, 80, 6);
      ctx.fillStyle = `${endColor}22`;
      ctx.fill();
      ctx.strokeStyle = endColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `700 14px ${Theme.fonts.display}`;
      ctx.fillStyle = endColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const endingLabel = branch.ending === "safe" ? "✓ 安全结局" : branch.ending === "scammed" ? "✗ 被骗结局" : "⚠ 警示结局";
      ctx.fillText(endingLabel, x + 12, endY + 10);
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const endLines = this.wrapText(ctx, branch.endingDesc ?? "", w - 24);
      endLines.forEach((line: string, i: number) => ctx.fillText(line, x + 12, endY + 32 + i * 16));
      ctx.restore();
    }
    // 历史步骤断点
    if (branch.history.length > 0) {
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`步骤 ${branch.history.length + 1}`, x, y - 14);
      ctx.restore();
    }
  }

  /** AI 语音题播放器（A2） */
  private drawAudioPlayer(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    const audio = hud.audio;
    if (!audio) return;
    const x = OPT_X + 10;
    const y = 80;
    const w = OPT_W - 20;
    const h = 60;
    // 播放器背景
    ctx.save();
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = "rgba(0,229,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,229,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // 播放按钮
    const btnSize = 32;
    const btnX = x + 14;
    const btnY = y + (h - btnSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = audio.playing ? "#FFD666" : "#00E5FF";
    ctx.fill();
    ctx.restore();
    // 播放/暂停图标
    ctx.save();
    ctx.fillStyle = "#0A1929";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillText(audio.playing ? "⏸" : "▶", btnX + btnSize / 2, btnY + btnSize / 2 + 1);
    ctx.restore();
    // 波形/进度条
    const barX = btnX + btnSize + 14;
    const barW = w - btnSize - 42;
    const barY = y + h / 2 - 3;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, barX, barY, barW, 6, 3);
    ctx.fill();
    // 进度
    const progressW = barW * audio.progress;
    ctx.fillStyle = audio.isSynthetic ? "#FF7A1A" : "#00E5FF";
    roundRect(ctx, barX, barY, progressW, 6, 3);
    ctx.fill();
    ctx.restore();
    // 标签
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = audio.isSynthetic ? "#FF7A1A" : "#00E5FF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(audio.synthTech ?? (audio.isSynthetic ? "AI 合成" : "真实录音"), barX, y + 8);
    ctx.restore();
    // 字幕（播放中显示）
    if (audio.playing || audio.finished) {
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const lines = this.wrapText(ctx, audio.transcript, w - 16);
      lines.forEach((line: string, i: number) => ctx.fillText(line, x + 8, y + h + 6 + i * 15));
      ctx.restore();
    }
  }

  /** 案例溯源展示（A1：揭示态显示真实案例出处） */
  private drawCaseArchive(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    const archive = hud.caseArchive;
    if (!archive) return;
    const x = CARD_X + 8;
    const y = CARD_Y + CARD_H - 56;
    const w = CARD_W - 16;
    const h = 48;
    ctx.save();
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = "rgba(255,214,102,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,214,102,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // 案例图标 + 标题
    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`📋 ${archive.title}`, x + 8, y + 6);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${archive.date} · ${archive.source}`, x + 8, y + 20);
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const lines = this.wrapText(ctx, archive.takeaway, w - 16);
    lines.forEach((line: string, i: number) => ctx.fillText(line, x + 8, y + 34 + i * 12));
    ctx.restore();
  }

  /** 季节标签展示（A4：画布顶部居中） */
  private drawSeasonTag(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    const season = hud.seasonTag;
    if (!season) return;
    const labels: Record<string, string> = { springFestival: "🧧 春节红包季", schoolOpen: "🎓 开学季", double11: "🛒 双11购物季", springTravel: "🚄 春运退票季", summerJob: "🏖 暑期兼职季", yearEnd: "📊 年终理财季", all: "" };
    const label = labels[season] ?? "";
    if (!label) return;
    const x = CANVAS_W / 2 - 60;
    const y = 14;
    ctx.save();
    roundRect(ctx, x, y, 120, 20, 10);
    ctx.fillStyle = "rgba(0,229,255,0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,229,255,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 60, y + 10);
    ctx.restore();
  }

  /** Boss 周挑战横幅（A6：画布顶部） */
  private drawBossWeekBanner(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    if (!hud.bossWeekActive) return;
    const x = CANVAS_W / 2 - 80;
    const y = 38;
    ctx.save();
    roundRect(ctx, x, y, 160, 22, 11);
    ctx.fillStyle = "rgba(179,136,255,0.20)";
    ctx.fill();
    ctx.strokeStyle = "#B388FF";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = "#B388FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📅 Boss 周挑战", x + 80, y + 11);
    ctx.restore();
  }

  /**
   * 判断题滑动手势提示（画布坐标）
   * - 单卡模式：右半区显示左滑/右滑方向卡片
   * - 双卡模式：两张卡底部各显示滑动方向提示
   * - 滑动中：根据 swipeOffset 高亮对应方向
   */
  private drawSwipeHints(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    const isDual = !!hud.dualMode;
    const swipeOffset = hud.swipeOffset ?? 0;
    // 引导动画：未滑动时缓慢闪烁提示
    const hintPulse = 0.6 + Math.sin(this.t * 3) * 0.4;

    if (!isDual) {
      // 单卡模式：右半区显示两个方向大卡片
      const leftX = OPT_X + 10;
      const rightX = OPT_X + OPT_W / 2 + 10;
      const cardW = OPT_W / 2 - 20;
      const cardH = 180;
      const cardY = (CANVAS_H - cardH) / 2;
      // 左滑 = 举报（红色）
      this.drawSwipeDirCard(ctx, leftX, cardY, cardW, cardH, "left", swipeOffset, hintPulse);
      // 右滑 = 通过（绿色）
      this.drawSwipeDirCard(ctx, rightX, cardY, cardW, cardH, "right", swipeOffset, hintPulse);
      // 中央提示文字
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("← 左滑举报  ·  右滑通过 →", OPT_X + OPT_W / 2, cardY + cardH + 12);
      ctx.restore();
    } else {
      // 双卡模式：每张卡底部显示滑动提示
      const positions = [
        { cx: 200, label: "卡 1" },  // 左卡中心
        { cx: 600, label: "卡 2" },  // 右卡中心
      ];
      for (let i = 0; i < 2; i++) {
        const pos = positions[i];
        const offset = i === 0 ? swipeOffset : (hud.second?.swipeOffset ?? 0);
        const hintY = 440;
        ctx.save();
        ctx.font = `700 10px ${Theme.fonts.mono}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // 左滑提示
        const leftAlpha = offset < -0.05 ? 1 : hintPulse * 0.5;
        ctx.fillStyle = `rgba(229,53,59,${leftAlpha})`;
        ctx.fillText("← 举报", pos.cx - 50, hintY);
        // 右滑提示
        const rightAlpha = offset > 0.05 ? 1 : hintPulse * 0.5;
        ctx.fillStyle = `rgba(26,214,112,${rightAlpha})`;
        ctx.fillText("通过 →", pos.cx + 50, hintY);
        ctx.restore();
      }
    }
  }

  /** 单卡模式滑动方向卡片（左滑举报 / 右滑通过） */
  private drawSwipeDirCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: "left" | "right", swipeOffset: number, hintPulse: number): void {
    const isActive = dir === "left" ? swipeOffset < -0.05 : swipeOffset > 0.05;
    const color = dir === "left" ? "#E5353B" : "#1AD670";
    const icon = dir === "left" ? "🚫" : "✓";
    const label = dir === "left" ? "举报" : "通过";
    const arrow = dir === "left" ? "←" : "→";
    const alpha = isActive ? 1 : hintPulse * 0.6;

    ctx.save();
    // 背景
    roundRect(ctx, x, y, w, h, 10);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, `rgba(${dir === "left" ? "229,53,59" : "26,214,112"},${0.18 * alpha})`);
    g.addColorStop(1, `rgba(${dir === "left" ? "229,53,59" : "26,214,112"},${0.06 * alpha})`);
    ctx.fillStyle = g;
    ctx.fill();
    // 边框
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    ctx.strokeStyle = `rgba(${dir === "left" ? "229,53,59" : "26,214,112"},${alpha})`;
    if (isActive) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 大箭头
    ctx.font = `900 42px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(${dir === "left" ? "229,53,59" : "26,214,112"},${alpha})`;
    ctx.fillText(arrow, x + w / 2, y + 38);
    // 图标
    ctx.font = `28px sans-serif`;
    ctx.fillText(icon, x + w / 2, y + 84);
    // 标签
    ctx.font = `900 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = `rgba(${dir === "left" ? "255,120,120" : "120,255,180"},${alpha})`;
    ctx.fillText(label, x + w / 2, y + 124);
    // 说明
    ctx.font = `500 10px 'Noto Sans SC', sans-serif`;
    ctx.fillStyle = `rgba(240,244,255,${alpha * 0.7})`;
    ctx.fillText(dir === "left" ? "判定为诈骗" : "判定为正常", x + w / 2, y + 148);
    ctx.restore();
  }

  /** 诈骗分子挑衅横幅：故障红条 + 抖动文字，强化压迫感与代入感 */
  private drawTauntBanner(ctx: CanvasRenderingContext2D, screenW: number, taunt: string): void {
    const w = screenW - 40;
    const h = 34;
    const x = 20;
    const y = 96;
    ctx.save();
    // 抖动偏移（故障感）
    const jx = (Math.random() - 0.5) * 2.4;
    const jy = (Math.random() - 0.5) * 1.2;
    ctx.translate(jx, jy);
    // 背景：故障红渐变
    roundRect(ctx, x, y, w, h, 6);
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, "rgba(229,53,59,0.85)");
    g.addColorStop(0.5, "rgba(120,10,20,0.92)");
    g.addColorStop(1, "rgba(229,53,59,0.85)");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(229,53,59,0.7)";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    // 边框
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,90,96,0.9)";
    roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();
    // 色差文字（RGB 错位，故障感）
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 14px ${Theme.fonts.mono}`;
    const cx = x + w / 2;
    const cy = y + h / 2 + 1;
    ctx.fillStyle = "rgba(0,229,255,0.7)";
    ctx.fillText(taunt, cx - 1.5, cy);
    ctx.fillStyle = "rgba(255,0,80,0.7)";
    ctx.fillText(taunt, cx + 1.5, cy);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(taunt, cx, cy);
    // 左侧“⚠”标记
    ctx.textAlign = "left";
    ctx.font = `900 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.fillText("⚠ 诈骗来电", x + 10, cy);
    ctx.restore();
  }

  /** 心跳边缘红脉：屏幕四边红色脉动，压迫感 */
  private drawHeartbeatEdge(ctx: CanvasRenderingContext2D, screenW: number, screenH: number, hb: number): void {
    // 与引擎心跳节律同步（~1.1s 周期）
    const beat = (this.t % 1.1) / 1.1;
    let amp: number;
    if (beat < 0.12) amp = Math.sin((beat / 0.12) * Math.PI);
    else if (beat > 0.22 && beat < 0.34) amp = Math.sin(((beat - 0.22) / 0.12) * Math.PI) * 0.55;
    else amp = 0;
    const alpha = hb * amp * 0.5;
    if (alpha <= 0.01) return;
    ctx.save();
    const thickness = 36;
    // 上边
    let g = ctx.createLinearGradient(0, 0, 0, thickness);
    g.addColorStop(0, `rgba(229,53,59,${alpha})`);
    g.addColorStop(1, "rgba(229,53,59,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, screenW, thickness);
    // 下边
    g = ctx.createLinearGradient(0, screenH - thickness, 0, screenH);
    g.addColorStop(0, "rgba(229,53,59,0)");
    g.addColorStop(1, `rgba(229,53,59,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, screenH - thickness, screenW, thickness);
    // 左边
    g = ctx.createLinearGradient(0, 0, thickness, 0);
    g.addColorStop(0, `rgba(229,53,59,${alpha})`);
    g.addColorStop(1, "rgba(229,53,59,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, thickness, screenH);
    // 右边
    g = ctx.createLinearGradient(screenW - thickness, 0, screenW, 0);
    g.addColorStop(0, "rgba(229,53,59,0)");
    g.addColorStop(1, `rgba(229,53,59,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(screenW - thickness, 0, thickness, screenH);
    ctx.restore();
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 24;
    ctx.save();

    // 左上：WAVE + 体力
    ctx.font = `900 22px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.getAccent();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(this.getAccent(), 0.45);
    ctx.shadowBlur = 8;
    ctx.fillText(`反诈波次 ${hud.wave}`, 16, y);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("STAMINA", 16, y + 30);
    // 体力：3 个盾/心
    for (let i = 0; i < hud.maxStamina; i++) {
      const sx = 16 + i * 20;
      const sy = y + 44;
      const filled = i < hud.stamina;
      this.drawHeart(ctx, sx + 6, sy + 6, filled);
    }

    // 右上：强壮猛男图标（分值）
    const manCx = screenW - 44;
    const manCy = y + 30;
    const hurt = hud.stamina <= 1;
    this.drawMan3D(ctx, manCx, manCy, 40, hud.manLevel, hud.manColor, hurt);
    // 等级名
    ctx.textAlign = "center";
    ctx.font = `900 13px ${Theme.fonts.display}`;
    ctx.fillStyle = hud.manColor;
    ctx.shadowColor = withAlpha(hud.manColor, 0.5);
    ctx.shadowBlur = 6;
    ctx.fillText(hud.manName, manCx, manCy + 34);
    ctx.shadowBlur = 0;
    // 分值（跳动数字：displayScore 追逐真实值，得分变化时脉冲放大发光）
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("SCORE", manCx, manCy + 50);
    const pulse = this.scorePulse;
    const scoreScale = 1 + pulse * 0.35;
    const scoreColor = pulse > 0.05 ? "#FFD666" : Theme.colors.ink.DEFAULT;
    ctx.save();
    ctx.translate(manCx, manCy + 62);
    ctx.scale(scoreScale, scoreScale);
    ctx.font = `900 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = scoreColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (pulse > 0.05) {
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 10 * pulse;
    }
    ctx.fillText(`${Math.round(this.displayScore)}`, 0, 0);
    ctx.restore();

    // 连击（顶部中央）：色阶递进 + 高连击脉动放大
    if (hud.combo > 1) {
      const comboColor = this.comboColor(hud.combo);
      // 高连击呼吸脉动（combo≥5 起），越连越燃
      const breathe = hud.combo >= 5 ? 1 + Math.sin(this.t * 8) * 0.06 * Math.min(1, hud.combo / 12) : 1;
      // 字号随连击递增（封顶 28）
      const size = Math.min(28, 16 + Math.min(hud.combo, 12) * 0.9);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(screenW / 2, y + 10);
      ctx.scale(breathe, breathe);
      ctx.font = `900 ${size}px ${Theme.fonts.display}`;
      ctx.fillStyle = comboColor;
      ctx.shadowColor = withAlpha(comboColor, 0.6);
      ctx.shadowBlur = 10 + Math.min(hud.combo, 12);
      ctx.fillText(`×${hud.combo} COMBO`, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 题型标签（顶部中央下方）+ kind 标签
    if (hud.hasQuestion && hud.qType) {
      ctx.textAlign = "center";
      ctx.font = `500 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText(hud.qType, screenW / 2, y + 30);
      // kind 标签
      const kindLabel = hud.qKind === "judge" ? "判断题" : hud.qKind === "multi" ? "多选题（全选对才得分）" : "单选题";
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = hud.qKind === "multi" ? "#FFD666" : hud.qKind === "judge" ? "#B388FF" : Theme.colors.ink.muted;
      ctx.fillText(kindLabel, screenW / 2, y + 44);
    }
    ctx.restore();
  }

  /** 3D 猛男图标：随等级变壮，颜色随等级，受伤变红抖动，常驻呼吸+屈臂动效 */
  private drawMan3D(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, level: number, color: string, hurt: boolean): void {
    const tier = MAN_TIERS[level] ?? MAN_TIERS[0];
    const k = level / 7; // 0..1 强壮度
    const bulk = 3 + k * 5; // 肢体粗细
    const shoulderW = size * (0.32 + k * 0.14);
    ctx.save();
    // 受伤抖动
    if (hurt) {
      ctx.translate(Math.sin(this.t * 40) * 1.2, 0);
    }
    // 呼吸：胸腔随呼吸微微起伏（代入感）
    const breath = 1 + Math.sin(this.t * 2.2) * 0.04;
    ctx.translate(cx, cy);
    ctx.scale(breath, breath);
    ctx.translate(-cx, -cy);
    // 屈臂脉动：高级别时二头肌周期性收紧（更强壮感）
    const flex = 0.5 + Math.sin(this.t * 1.6) * 0.5; // 0..1
    // 光环
    const aura = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, size * 0.9);
    aura.addColorStop(0, withAlpha(color, 0.25 + k * 0.1));
    aura.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.9, 0, Math.PI * 2);
    ctx.fill();

    const bodyColor = hurt ? "#E5353B" : color;
    ctx.strokeStyle = bodyColor;
    ctx.fillStyle = bodyColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = 8;

    const neckY = cy - size * 0.22;
    const hipY = cy + size * 0.22;
    const headCy = cy - size * 0.4;
    // 头
    ctx.beginPath();
    ctx.arc(cx, headCy, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
    // 颈
    ctx.lineWidth = bulk * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, headCy + size * 0.1);
    ctx.lineTo(cx, neckY);
    ctx.stroke();
    // 肩 + 躯干
    ctx.lineWidth = bulk;
    ctx.beginPath();
    ctx.moveTo(cx, neckY);
    ctx.lineTo(cx, hipY);
    ctx.stroke();
    // 肩膀横梁
    ctx.lineWidth = bulk * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW, neckY + size * 0.04);
    ctx.lineTo(cx + shoulderW, neckY + size * 0.04);
    ctx.stroke();
    // 胸肌两块
    ctx.beginPath();
    ctx.arc(cx - shoulderW * 0.45, neckY + size * 0.14, size * (0.08 + k * 0.05), 0, Math.PI * 2);
    ctx.arc(cx + shoulderW * 0.45, neckY + size * 0.14, size * (0.08 + k * 0.05), 0, Math.PI * 2);
    ctx.fill();
    // 手臂（屈臂上举 flex）
    ctx.lineWidth = bulk * (1 + k * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW, neckY + size * 0.04);
    ctx.lineTo(cx - shoulderW * 1.25, cy - size * 0.02);
    ctx.lineTo(cx - shoulderW * 1.05, cy - size * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + shoulderW, neckY + size * 0.04);
    ctx.lineTo(cx + shoulderW * 1.25, cy - size * 0.02);
    ctx.lineTo(cx + shoulderW * 1.05, cy - size * 0.2);
    ctx.stroke();
    // 二头肌凸起（随屈臂脉动收缩鼓起，更强壮感）
    if (k > 0.2) {
      const bicepR = size * (0.05 + k * 0.05) * (1 + flex * 0.25);
      ctx.beginPath();
      ctx.arc(cx - shoulderW * 1.2, cy - size * 0.06, bicepR, 0, Math.PI * 2);
      ctx.arc(cx + shoulderW * 1.2, cy - size * 0.06, bicepR, 0, Math.PI * 2);
      ctx.fill();
    }
    // 腿
    ctx.lineWidth = bulk * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.46);
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.46);
    ctx.stroke();

    ctx.shadowBlur = 0;
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(cx - size * 0.04, headCy - size * 0.03, size * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // 等级条（小）
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(ctx, cx - size * 0.4, cy + size * 0.55, size * 0.8, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = tier.color;
    roundRect(ctx, cx - size * 0.4, cy + size * 0.55, size * 0.8 * k, 3, 1.5);
    ctx.fill();
    ctx.restore();
  }

  private drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, filled: boolean): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-7, -2, -7, -8, 0, -4);
    ctx.bezierCurveTo(7, -8, 7, -2, 0, 4);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = "#E5353B";
      ctx.shadowColor = "#E5353B";
      ctx.shadowBlur = 6;
    } else {
      ctx.fillStyle = "#1B3A5A";
    }
    ctx.fill();
    ctx.restore();
  }

  private drawOptionButton(ctx: CanvasRenderingContext2D, r: Rect, idx: number, hud: FBHud, revealing: boolean, kind: "single" | "judge" | "multi"): void {
    const text = hud.options[idx] ?? "";
    const isRisk = hud.riskIdx.includes(idx);
    const isMultiSelected = hud.multiSelected.includes(idx);
    const isPending = kind !== "multi" && hud.pendingIdx === idx;
    // 50-50 道具移除的选项
    const isRemoved = hud.fiftyRemoved.includes(idx);
    // 揭示态：判断正确/错误
    let isCorrect = false;
    let isWrongSel = false;
    if (revealing) {
      if (kind === "multi") {
        // 多选揭示：正确答案列表中的 = correct；玩家选了但不在正确列表 = wrong
        isCorrect = hud.correctIdxList.includes(idx);
        isWrongSel = isMultiSelected && !hud.correctIdxList.includes(idx);
      } else {
        isCorrect = hud.correctIdx === idx;
        isWrongSel = hud.selectedIdx === idx && hud.correctIdx !== idx;
      }
    }
    const pressed = this.pressedOpt === idx;

    let baseColor = "#13294A";
    let edgeColor = "rgba(0,229,255,0.4)";
    let textColor = "#F0F4FF";
    let glow = false;
    if (isRemoved) {
      // 50-50 移除：置灰 + 划线
      baseColor = "#0A1626"; edgeColor = "rgba(122,143,176,0.2)"; textColor = "rgba(122,143,176,0.4)";
    } else if (isCorrect) { baseColor = "#0F3A24"; edgeColor = "#1AD670"; glow = true; textColor = "#9FFFC0"; }
    else if (isWrongSel) { baseColor = "#3A1414"; edgeColor = "#E5353B"; glow = true; textColor = "#FFC0C0"; }
    else if (revealing) { baseColor = "#0E1E36"; edgeColor = "rgba(0,229,255,0.15)"; textColor = "#7A8FB0"; }
    else if (kind === "multi" && isMultiSelected) {
      // 多选题已选中（非揭示态）：高亮橙色
      baseColor = "#3A2A0A"; edgeColor = "#FFD666"; glow = true; textColor = "#FFD666";
    } else if (isPending) {
      // 单选/判断题已选未提交：高亮橙色（与多选已选统一）
      baseColor = "#3A2A0A"; edgeColor = "#FFD666"; glow = true; textColor = "#FFD666";
    } else if (isRisk && !revealing) {
      // 风险选项：警示色（仅给玩家隐约提示，不直接说明）
      baseColor = "#1F0E1A"; edgeColor = "rgba(229,53,59,0.35)"; textColor = "#F0F4FF";
    }

    ctx.save();
    if (pressed && !revealing) ctx.translate(0, 1);
    // 投影
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = pressed ? 4 : 10;
    ctx.shadowOffsetY = pressed ? 2 : 5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, baseColor);
    g.addColorStop(1, "#0A1626");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 斜面边框（3D 立体感）
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = edgeColor;
    if (glow) { ctx.shadowColor = edgeColor; ctx.shadowBlur = 10; }
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 字母徽章（判断题用 ✓/✗，多选题用方块■/空，单选用 A/B/C/D）
    const badgeR = kind === "judge" ? 20 : 16;
    const bx = r.x + 26;
    const by = r.y + r.h / 2;
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, badgeR);
    if (isCorrect) {
      bg.addColorStop(0, "#1AD670"); bg.addColorStop(1, "#0A5A30");
    } else if (isWrongSel) {
      bg.addColorStop(0, "#E5353B"); bg.addColorStop(1, "#5A0E0E");
    } else if (kind === "multi" && isMultiSelected && !revealing) {
      bg.addColorStop(0, "#FFD666"); bg.addColorStop(1, "#7A4A0A");
    } else if (isPending) {
      bg.addColorStop(0, "#FFD666"); bg.addColorStop(1, "#7A4A0A");
    } else if (kind === "judge") {
      bg.addColorStop(0, idx === 0 ? "#1AD670" : "#E5353B");
      bg.addColorStop(1, idx === 0 ? "#0A5A30" : "#5A0E0E");
    } else {
      bg.addColorStop(0, "#1B4A6E"); bg.addColorStop(1, "#0A2535");
    }
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.font = `900 ${kind === "judge" ? 20 : 14}px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const letter = kind === "judge" ? JUDGE_LETTERS[idx] : LETTERS[idx];
    ctx.fillText(letter, bx, by);

    // 风险标识（仅揭示后显示）
    if (isRisk && revealing && (isWrongSel || kind === "multi")) {
      ctx.font = "700 12px sans-serif";
      ctx.fillStyle = "#FF3B6B";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("⚠ 风险", r.x + 52, by - 10);
    }

    // 选项文字
    ctx.font = `500 ${kind === "judge" ? 16 : 14}px ${Theme.fonts.body}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const offsetX = kind === "judge" ? 56 : 52;
    this.drawClampedText(ctx, text, r.x + offsetX, by, r.w - offsetX - 20);
    // 50-50 移除：文字上划删除线
    if (isRemoved) {
      const tw = ctx.measureText(text.length > 18 ? text.slice(0, 18) : text).width;
      ctx.strokeStyle = "rgba(122,143,176,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x + offsetX, by - 6);
      ctx.lineTo(r.x + offsetX + Math.min(tw, r.w - offsetX - 20), by - 6);
      ctx.stroke();
    }

    // 正确/错误标记
    if (isCorrect) {
      ctx.font = "700 14px sans-serif";
      ctx.fillStyle = "#1AD670";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("✓", r.x + r.w - 14, by);
    } else if (isWrongSel) {
      ctx.font = "700 14px sans-serif";
      ctx.fillStyle = "#E5353B";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("✗", r.x + r.w - 14, by);
    }
    ctx.restore();
  }

  /**
   * 自动提交提示横幅（取代原提交按钮）
   * - 揭示态：显示"· 已作答 ·"
   * - 单选/判断 show 态：提示点击即提交
   * - 多选 show 态：提示选错即判错、选全正确自动提交，并显示已选数量
   */
  private drawAutoSubmitHint(ctx: CanvasRenderingContext2D, r: Rect, hud: FBHud, revealing: boolean): void {
    const kind = hud.qKind;
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, "rgba(26,214,112,0.10)");
    g.addColorStop(1, "rgba(10,25,41,0.55)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(26,214,112,0.4)";
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.stroke();

    // 文案
    let label: string;
    let color = "#1AD670";
    if (revealing) {
      label = "· 已作答 ·";
      color = "#7A8FB0";
    } else if (kind === "multi") {
      const selCount = hud.multiSelected.length;
      label = selCount === 0
        ? "⚡ 多选 · 选错即判错，选全正确自动提交"
        : `⚡ 已选 ${selCount} 项 · 继续选择 / 选错即时判错`;
    } else {
      label = "⚡ 点击选项即自动提交";
    }
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(color, 0.5);
    ctx.shadowBlur = 4;
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawClampedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number): void {
    let t = text;
    if (ctx.measureText(t).width > maxW) {
      while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
      t = t + "…";
    }
    ctx.fillText(t, x, y);
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    // ===== ready 状态：难度选择 =====
    if (this.gameState === "ready") {
      return this.handleDifficultyTouch(type, x, y);
    }
    const hud = this.hud;
    if (!hud || !hud.hasQuestion) return false;
    // 屏幕坐标 → 画布坐标
    const cw = this.engineCanvas?.width ?? CANVAS_W;
    const ch = this.engineCanvas?.height ?? CANVAS_H;
    const local = this.director.screenToLocal(x, y, cw, ch);
    const lx = local.x;
    const ly = local.y;
    const kind = hud.qKind;
    const isRevealing = hud.selectedIdx !== null;
    // 判断题使用滑动手势（单卡或双卡模式）
    const isJudgeSwipe = kind === "judge" && !isRevealing;
    // 双卡模式：判断题且 dualMode=true
    const isDual = !!hud.dualMode;

    // ===== 大招按钮（ultimateReady 时优先检测） =====
    if (hud.ultimateReady && type === "start" && !isRevealing) {
      const ultR = this.getUltimateRect();
      if (hitTest(lx, ly, ultR)) {
        this.pressedUltimate = true;
        return true;
      }
    }
    if (this.pressedUltimate && type === "end") {
      const ultR = this.getUltimateRect();
      this.pressedUltimate = false;
      if (hitTest(lx, ly, ultR)) {
        this.engine?.useUltimate();
        playSfx("click");
        vibrateShort();
      }
      return true;
    }

    // ===== 填空题：提交按钮 =====
    if (kind === "fill") {
      return this.handleFillTouch(type, lx, ly, hud, isRevealing);
    }
    // ===== 连线题：左/右列选择 + 提交 =====
    if (kind === "link") {
      return this.handleLinkTouch(type, lx, ly, hud, isRevealing);
    }
    // ===== 排序题：选中交换 + 提交 =====
    if (kind === "sort") {
      return this.handleSortTouch(type, lx, ly, hud, isRevealing);
    }

    // ===== 滑动手势处理（判断题专用） =====
    if (type === "start" && isJudgeSwipe) {
      // 道具按钮仍可点击（顶部区域，不与卡片重叠）
      for (const it of ITEM_TYPES) {
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.pressedItem = it;
          return true;
        }
      }
      // 判断题：记录滑动起点，确定哪张卡
      // 双卡模式：左卡 x<400，右卡 x>=400
      // 单卡模式：主卡（cardIdx=0）
      const cardIdx = isDual ? (lx < 400 ? 0 : 1) : 0;
      // 验证该卡是否可滑动（show 态 + judge 题）
      // 单卡模式仅 cardIdx=0 有效；双卡模式两张卡均可滑
      this.swipeTouchId = touchId;
      this.swipeStartX = lx;
      this.swipeStartY = ly;
      this.swipeCurX = lx;
      this.swipeCurY = ly;
      this.swipeCardIdx = cardIdx;
      this.engine?.swipeStart(cardIdx);
      return true;
    }

    if (type === "move" && this.swipeTouchId === touchId && this.swipeCardIdx !== null) {
      this.swipeCurX = lx;
      this.swipeCurY = ly;
      // 计算偏移比：以卡宽的一半为满偏移（-1..1）
      const cardHalfW = 180; // CARD_W/2
      const dx = this.swipeCurX - this.swipeStartX;
      const offsetRatio = Math.max(-1, Math.min(1, dx / cardHalfW));
      this.engine?.swipeMove(offsetRatio);
      return true;
    }

    if (type === "end" && this.swipeTouchId === touchId) {
      this.swipeTouchId = null;
      const cardIdx = this.swipeCardIdx;
      this.swipeCardIdx = null;
      if (cardIdx !== null) {
        this.engine?.swipeEnd();
        vibrateShort();
      }
      return true;
    }

    // ===== 常规按钮处理（非判断题，或揭示态） =====
    const rects = this.getOptionRects(kind);

    if (type === "start") {
      if (isRevealing) return false;
      // 道具按钮（优先判定）
      for (const it of ITEM_TYPES) {
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.pressedItem = it;
          return true;
        }
      }
      // 选项点击（屏蔽 50-50 移除的选项）
      for (let i = 0; i < rects.length; i++) {
        if (hud.fiftyRemoved.includes(i)) continue;
        if (hitTest(lx, ly, rects[i])) { this.pressedOpt = i; return true; }
      }
      return false;
    } else if (type === "end") {
      if (isRevealing) {
        this.pressedOpt = null;
        this.pressedSubmit = false;
        this.pressedItem = null;
        return true;
      }
      // 道具按钮
      if (this.pressedItem) {
        const it = this.pressedItem;
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.engine?.useItem(it);
          playSfx("click");
          vibrateShort();
        }
        this.pressedItem = null;
        return true;
      }
      // 选项：点击即触发 engine.answer()
      if (this.pressedOpt !== null) {
        const i = this.pressedOpt;
        if (hitTest(lx, ly, rects[i]) && !hud.fiftyRemoved.includes(i)) {
          this.engine?.answer(i);
          playSfx("click");
          vibrateShort();
        }
        this.pressedOpt = null;
      }
      return true;
    }
    return false;
  }

  /** 难度选择触摸处理（ready 状态） */
  private handleDifficultyTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const cw = this.engineCanvas?.width ?? CANVAS_W;
    const ch = this.engineCanvas?.height ?? CANVAS_H;
    const local = this.director.screenToLocal(x, y, cw, ch);
    if (type === "start") {
      for (const def of DIFFICULTY_DEFS) {
        const r = this.getDifficultyRect(def.id);
        if (hitTest(local.x, local.y, r)) {
          this.pressedDifficulty = def.id;
          return true;
        }
      }
      return false;
    } else if (type === "end") {
      const pressed = this.pressedDifficulty;
      this.pressedDifficulty = null;
      if (pressed) {
        const r = this.getDifficultyRect(pressed);
        if (hitTest(local.x, local.y, r)) {
          this.engine?.setDifficulty(pressed);
          this.gameState = "playing";
          playSfx("click");
          vibrateShort();
        }
      }
      return true;
    }
    return false;
  }

  /** 填空题触摸处理：提交按钮 */
  private handleFillTouch(type: "start" | "move" | "end", lx: number, ly: number, hud: FBHud, isRevealing: boolean): boolean {
    const subR = this.getSubmitRect("fill");
    if (type === "start") {
      if (isRevealing) return false;
      // 道具按钮
      for (const it of ITEM_TYPES) {
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.pressedItem = it;
          return true;
        }
      }
      if (hitTest(lx, ly, subR)) {
        this.pressedSubmitBtn = true;
        return true;
      }
      return false;
    } else if (type === "end") {
      if (isRevealing) {
        this.pressedItem = null;
        this.pressedSubmitBtn = false;
        return true;
      }
      // 道具按钮
      if (this.pressedItem) {
        const it = this.pressedItem;
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.engine?.useItem(it);
          playSfx("click");
          vibrateShort();
        }
        this.pressedItem = null;
        return true;
      }
      // 提交按钮
      if (this.pressedSubmitBtn) {
        this.pressedSubmitBtn = false;
        if (hitTest(lx, ly, subR)) {
          this.engine?.submit();
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      return true;
    }
    return false;
  }

  /** 连线题触摸处理：左/右列选择 + 提交 */
  private handleLinkTouch(type: "start" | "move" | "end", lx: number, ly: number, hud: FBHud, isRevealing: boolean): boolean {
    const leftRects = this.getOptionRects("link");
    const rightRects = this.getLinkRightRects();
    const subR = this.getSubmitRect("link");
    if (type === "start") {
      if (isRevealing) return false;
      // 道具按钮
      for (const it of ITEM_TYPES) {
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.pressedItem = it;
          return true;
        }
      }
      // 左列：选中
      for (let i = 0; i < leftRects.length; i++) {
        if (hitTest(lx, ly, leftRects[i])) {
          this.linkSelLeftIdx = this.linkSelLeftIdx === i ? null : i;
          return true;
        }
      }
      // 右列：配对（需先选中左列）
      if (this.linkSelLeftIdx !== null) {
        for (let i = 0; i < rightRects.length; i++) {
          if (hitTest(lx, ly, rightRects[i])) {
            this.engine?.setLinkSel(this.linkSelLeftIdx, i);
            this.linkSelLeftIdx = null;
            playSfx("click");
            vibrateShort();
            return true;
          }
        }
      }
      // 提交按钮
      if (hitTest(lx, ly, subR)) {
        this.pressedSubmitBtn = true;
        return true;
      }
      return false;
    } else if (type === "end") {
      if (isRevealing) {
        this.pressedItem = null;
        this.pressedSubmitBtn = false;
        return true;
      }
      // 道具按钮
      if (this.pressedItem) {
        const it = this.pressedItem;
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.engine?.useItem(it);
          playSfx("click");
          vibrateShort();
        }
        this.pressedItem = null;
        return true;
      }
      // 提交按钮
      if (this.pressedSubmitBtn) {
        this.pressedSubmitBtn = false;
        if (hitTest(lx, ly, subR)) {
          this.engine?.submit();
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      return true;
    }
    return false;
  }

  /** 排序题触摸处理：选中交换 + 提交 */
  private handleSortTouch(type: "start" | "move" | "end", lx: number, ly: number, hud: FBHud, isRevealing: boolean): boolean {
    const rects = this.getOptionRects("sort");
    const subR = this.getSubmitRect("sort");
    if (type === "start") {
      if (isRevealing) return false;
      // 道具按钮
      for (const it of ITEM_TYPES) {
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.pressedItem = it;
          return true;
        }
      }
      // 排序项：选中/交换
      for (let i = 0; i < rects.length; i++) {
        if (hitTest(lx, ly, rects[i])) {
          if (this.sortSelIdx === null) {
            // 第一次选中
            this.sortSelIdx = i;
          } else if (this.sortSelIdx === i) {
            // 再次点击取消选中
            this.sortSelIdx = null;
          } else {
            // 交换
            this.engine?.swapSortItem(this.sortSelIdx, i);
            this.sortSelIdx = null;
            playSfx("click");
            vibrateShort();
          }
          return true;
        }
      }
      // 提交按钮
      if (hitTest(lx, ly, subR)) {
        this.pressedSubmitBtn = true;
        return true;
      }
      return false;
    } else if (type === "end") {
      if (isRevealing) {
        this.pressedItem = null;
        this.pressedSubmitBtn = false;
        return true;
      }
      // 道具按钮
      if (this.pressedItem) {
        const it = this.pressedItem;
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.engine?.useItem(it);
          playSfx("click");
          vibrateShort();
        }
        this.pressedItem = null;
        return true;
      }
      // 提交按钮
      if (this.pressedSubmitBtn) {
        this.pressedSubmitBtn = false;
        if (hitTest(lx, ly, subR)) {
          this.engine?.submit();
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      return true;
    }
    return false;
  }

  /** 键盘输入处理：填空题字母/数字/Backspace/Enter */
  protected onKey(key: string): void {
    super.onKey(key);
    if (this.gameState !== "playing") return;
    const hud = this.hud;
    if (!hud || !hud.hasQuestion || hud.qKind !== "fill") return;
    if (hud.selectedIdx !== null) return; // 揭示态不处理
    if (key === "Backspace") {
      const cur = hud.fillInput ?? "";
      if (cur.length > 0) {
        this.engine?.setFillInput(cur.slice(0, -1));
      }
      return;
    }
    if (key === "Enter") {
      this.engine?.submit();
      return;
    }
    // 字母/数字键（单字符，非功能键）
    if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
      const cur = hud.fillInput ?? "";
      this.engine?.setFillInput(cur + key);
    }
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
