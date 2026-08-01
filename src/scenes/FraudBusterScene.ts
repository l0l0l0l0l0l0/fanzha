/**
 * 「是男人就反诈」游戏场景
 * 引擎画布 800×480 横屏，卡片在左半区，选项按钮在右半区（同一画布坐标系，避免错位遮挡）
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawToast, hitTest, type Rect } from "@/ui/widgets";
import { FraudBusterEngine, itemEmoji, itemLabel } from "@/games/fraudBuster/engine";
import { MAN_TIERS, QUESTION_BANK } from "@/games/fraudBuster/data";
import { roundRect } from "@/engine/Renderer";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import { FBCodexScene } from "./FBCodexScene";
import { FBHotlineScene } from "./FBHotlineScene";
import type { GameEvent, GameResultPayload } from "@/types";
import type { FBHud, FBItemType, FBStats, FBSpecialEvent, FBBossSkill, FBQuestionKind, FBDifficulty, FBPsychology, FBVictimProfile, FBKnowledgeGraph, FBCaseArchive, FBGameMode, FBWrongRecord, FBHudAIDialogState, FBHudDeconstructState, FBHudVSState, FBHudDetectiveState, FBDetectiveCase, FBDetectiveEvidence, FBDetectiveQuestion } from "@/games/fraudBuster/types";
import { FBRANKS, FBACHIEVEMENTS, loadFBSave } from "@/games/fraudBuster/storage";
import { KNOWLEDGE_GRAPH_COLORS, FB_MODE_LABELS, FB_MODE_ICONS, FB_MODE_DESCRIPTIONS, FB_MODE_HINTS, STORY_STAGES, VICTIM_PROFILES } from "@/games/fraudBuster/dataV2";
import type { FBReportData } from "@/utils/battleReport";
import {
  LETTERS, JUDGE_LETTERS, CANVAS_W, CANVAS_H, CARD_X, CARD_Y, CARD_W, CARD_H,
  OPT_X, OPT_W, ITEM_TYPES, ITEM_BTN_W, ITEM_BTN_H, ITEM_BTN_GAP, ITEM_BTN_Y, ITEM_BTN_X,
  DIFF_BTN_W, DIFF_BTN_H, DIFF_BTN_GAP, DIFFICULTY_DEFS,
  MODE_BTN_W, MODE_BTN_H, MODE_BTN_GAP_X, MODE_BTN_GAP_Y, MODE_ORDER, MODE_COLORS,
  EDU_BTN_W, EDU_BTN_H, EDU_BTN_GAP, EDU_BTN_Y, EDU_ENTRIES,
  ULT_BTN_W, ULT_BTN_H, ULT_BTN_X, ULT_BTN_Y,
  SPECIAL_EVENT_NAMES, SPECIAL_EVENT_ICONS, BOSS_SKILL_NAMES, PSYCHOLOGY_LABELS,
} from "./fbSceneConstants";

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
  /** 上一次 HUD 的猛男段位等级，用于检测段位升级触发仪式 */
  private prevManLevel = 0;
  /** v3 Phase 3.4：段位升级仪式状态（null=未激活，>0=剩余展示时长秒） */
  private rankCeremony: { level: number; name: string; color: string; until: number; startT: number } | null = null;
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
  /** 游戏状态：modeSelect=模式选择层(入口), ready=难度选择界面, playing=游戏进行中 */
  private gameState: "modeSelect" | "ready" | "playing" = "modeSelect";
  /** 难度按钮按下态 */
  private pressedDifficulty: FBDifficulty | null = null;
  /** v3 模式选择按钮按下态 */
  private pressedMode: FBGameMode | null = null;
  /** v3 Phase 4 教育入口按钮按下态 */
  private pressedEdu: "codex" | "hotline" | null = null;
  /** v3 返回按钮按下态（modeSelect / ready 通用） */
  private pressedBack = false;
  /** v3 当前选中的模式（用于 endless → ready 流转时记忆） */
  private selectedMode: FBGameMode = "endless";
  /** v3 内存中的错题记录（用于 review 模式入口判断） */
  private lastWrongRecords: FBWrongRecord[] = [];
  /** v3 上次游玩的剧情关卡索引（用于 retry 重启同一关） */
  private lastStoryStageIdx = 0;
  /** 大招按钮按下态 */
  private pressedUltimate = false;
  /** 提交按钮按下态（fill/link/sort 题型） */
  private pressedSubmitBtn = false;
  /** v5 升级：新模式按钮按下态（ai0/vs0/dcNext/dcSkip 等） */
  private pressedV5Btn: string | null = null;
  /** 连线题：当前选中的左列项索引（null=未选） */
  private linkSelLeftIdx: number | null = null;
  /** 排序题：当前选中的项索引（null=未选） */
  private sortSelIdx: number | null = null;
  // ===== v6 侦探模式：推理答题中间态 =====
  /** 侦探多选题：已选选项索引列表 */
  private detectiveMultiSel: number[] = [];
  /** 侦探排序题：已选顺序索引列表 */
  private detectiveSortSeq: number[] = [];
  /** 侦探连线题：已配对 [左,右] 列表 */
  private detectiveLinkPairs: Array<[number, number]> = [];
  /** 侦探连线题：当前选中的左列索引（null=未选） */
  private detectiveLinkSelLeft: number | null = null;

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
      this.maybeTriggerRankUpCeremony(newHud);
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

  /**
   * v3 Phase 3.4：检测段位升级并触发仪式
   * - 比较 hud.manLevel 与 prevManLevel，递增即触发
   * - 仪式持续 2.5s：全屏金光 + 大字 + 粒子爆发 + 强震屏 + 闪屏
   * - 同时触发 fx 系列特效（与 maybeTriggerComboFx 互补）
   */
  private maybeTriggerRankUpCeremony(hud: FBHud): void {
    const curLevel = hud.manLevel;
    if (curLevel > this.prevManLevel && this.prevManLevel >= 0) {
      // 段位升级！
      this.rankCeremony = {
        level: curLevel,
        name: hud.manName,
        color: hud.manColor,
        until: this.t + 2.5,
        startT: this.t,
      };
      // 强烈 fx：金光闪屏 + 强震屏 + 双层粒子爆发
      this.fx.flash("#FFD666", 0.45, 0.6);
      this.fx.shake(0.8);
      const { cx, cy } = this.cardCenterScreen();
      // 第一层：金色粒子爆发
      this.fx.burst(cx, cy, "#FFD666", 36, 320);
      this.fx.ring(cx, cy, "#FFD666", 140, 0.7);
      // 第二层：段位色粒子爆发
      this.fx.burst(cx, cy, hud.manColor, 24, 280);
      this.fx.ring(cx, cy, hud.manColor, 100, 0.6);
      // 飘字：段位名
      this.fx.popText(cx, cy - 80, `▲ ${hud.manName}`, {
        color: "#FFD666",
        size: 28,
        duration: 1.5,
        vy: -30,
      });
      playSfx("good");
      vibrateShort();
    }
    this.prevManLevel = curLevel;
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
    // v2/v3：捕获错题记录到内存（用于复盘入口 + 模式选择层 review 入口判断）
    const wrongRecords = stats?.wrongRecords ?? [];
    if (wrongRecords.length > 0) {
      this.lastWrongRecords = wrongRecords;
    }
    const hasWrongRecords = wrongRecords.length > 0;
    // v3：构建是男人就反诈专属战报数据（模式 / 完美一局 / 受害者档案 / 案例档案 / 知识掌握度）
    const fbReportData = this.buildFBReportData(stats);
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director), undefined, "slide"),
      renderExtraStats: stats
        ? (ctx, x, y, w) => this.renderFraudStats(ctx, x, y, w, stats)
        : undefined,
      // v2：错题复盘入口（A5，仅有错题时显示）
      onReview: hasWrongRecords ? () => this.startReviewMode(wrongRecords) : undefined,
      reviewLabel: hasWrongRecords ? `📝 错题复盘 · ${wrongRecords.length} 题补漏挑战` : undefined,
      // v3：反诈战报分享卡专属数据
      fbReportData,
    });
  }

  /**
   * v3：构建是男人就反诈专属战报分享数据
   * 从 engine 注入的 FBStats 中提取模式、完美一局、受害者档案、案例档案、知识掌握度等
   * 用于战报卡 PNG 导出与分享文案
   */
  private buildFBReportData(stats: FBStats | undefined): FBReportData | undefined {
    if (!stats) return undefined;
    const mode = stats.gameMode ?? "endless";
    const modeLabel = FB_MODE_LABELS[mode] ?? "无尽模式";
    const modeIcon = FB_MODE_ICONS[mode] ?? "🌊";
    const perfectRun = !!stats.perfectRun;
    // 知识掌握度：优先用知识图谱的整体掌握度，否则按知识点统计计算
    let knowledgeMastery = 0;
    if (stats.knowledgeGraph?.overallMastery !== undefined) {
      knowledgeMastery = stats.knowledgeGraph.overallMastery;
    } else if (stats.knowledgeStats && stats.knowledgeStats.length > 0) {
      const tot = stats.knowledgeStats.reduce((s, k) => s + k.total, 0);
      const cor = stats.knowledgeStats.reduce((s, k) => s + k.correct, 0);
      knowledgeMastery = tot > 0 ? cor / tot : 0;
    }
    return {
      mode,
      modeLabel,
      modeIcon,
      perfectRun,
      victimProfile: stats.victimProfile,
      caseArchives: stats.caseArchives,
      knowledgeMastery,
      modeStats: {
        storyStagesCleared: stats.storyStagesCleared,
        storyStageIdx: stats.storyStageIdx,
        speedrunDuration: stats.speedrunDuration,
        speedrunCorrect: stats.speedrunCorrect,
        speedrunTotal: stats.speedrunTotal,
        hardcoreCorrect: stats.hardcoreCorrect,
        dailyKey: stats.dailyKey,
        dailyCorrect: stats.dailyCorrect,
        reviewNightmareCleared: stats.reviewNightmareCleared,
      },
    };
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
    this.pressedDifficulty = null;
    this.pressedUltimate = false;
    this.pressedSubmitBtn = false;
    this.linkSelLeftIdx = null;
    this.sortSelIdx = null;
    this.fx.clear();
    this.spawnEngine();
    // v3：根据上次模式智能重启（retry = 再来一局同模式）
    const mode = this.selectedMode;
    if (mode === "endless") {
      // endless 仍需选难度
      this.gameState = "ready";
    } else if (mode === "story") {
      // 剧情模式：重启同一关
      this.engine?.startMode("story", { storyStageIdx: this.lastStoryStageIdx });
      this.gameState = "playing";
    } else if (mode === "review") {
      // 错题噩梦：复用内存错题（不足则引擎自动补足）
      if (this.lastWrongRecords.length > 0) {
        const reviewQs = this.wrongRecordsToQuestions(this.lastWrongRecords);
        this.engine?.startMode("review", { reviewQuestions: reviewQs });
        this.gameState = "playing";
      } else {
        this.gameState = "modeSelect";
      }
    } else {
      // speedrun / hardcore / daily：直接重启
      this.engine?.startMode(mode);
      this.gameState = "playing";
    }
    playSfx("click");
    vibrateShort();
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

  /** v3 模式选择按钮矩形（画布坐标，3 列 × 2 行网格） */
  private getModeRect(mode: FBGameMode): Rect {
    const totalW = MODE_BTN_W * 3 + MODE_BTN_GAP_X * 2;
    const startX = (CANVAS_W - totalW) / 2;
    const startY = 130; // 标题之下，固定起点为教育入口行让出底部空间
    const idx = MODE_ORDER.indexOf(mode);
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    return {
      x: startX + col * (MODE_BTN_W + MODE_BTN_GAP_X),
      y: startY + row * (MODE_BTN_H + MODE_BTN_GAP_Y),
      w: MODE_BTN_W,
      h: MODE_BTN_H,
    };
  }

  /** v3 Phase 4：教育入口按钮矩形（底部 2 列） */
  private getEduBtnRect(id: "codex" | "hotline"): Rect {
    const totalW = EDU_BTN_W * 2 + EDU_BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    const idx = EDU_ENTRIES.findIndex((e) => e.id === id);
    return {
      x: startX + idx * (EDU_BTN_W + EDU_BTN_GAP),
      y: EDU_BTN_Y,
      w: EDU_BTN_W,
      h: EDU_BTN_H,
    };
  }

  /** v3 返回按钮矩形（modeSelect 左上角 / ready 状态左上角，画布坐标） */
  private getBackBtnRect(): Rect {
    return { x: 16, y: 16, w: 80, h: 32 };
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

    // v3 Phase 3.4：Boss 战背景（动态首脑剪影 + 主题色光晕）
    if (this.gameState === "playing" && this.hud?.bossActive) {
      this.drawBossBackground(ctx, screenW, screenH, this.hud);
    }

    // ===== modeSelect 状态：模式选择层（v3 入口） =====
    if (this.gameState === "modeSelect") {
      const tr = this.getBlitTransform(screenW, screenH);
      ctx.save();
      ctx.translate(tr.offsetX, tr.offsetY);
      ctx.scale(tr.scale, tr.scale);
      this.drawModeSelect(ctx);
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

    // ===== v5/v6 升级：新模式专用渲染（不使用常规卡片/选项流） =====
    if (this.gameState === "playing" && this.hud && (this.hud.aiDialog || this.hud.deconstruct || this.hud.versus || this.hud.detective)) {
      const tr = this.getBlitTransform(screenW, screenH);
      ctx.save();
      ctx.translate(tr.offsetX, tr.offsetY);
      ctx.scale(tr.scale, tr.scale);
      if (this.hud.aiDialog) this.drawAIBattle(ctx, this.hud.aiDialog);
      else if (this.hud.deconstruct) this.drawDeconstruct(ctx, this.hud.deconstruct);
      else if (this.hud.versus) this.drawVersus(ctx, this.hud.versus);
      else if (this.hud.detective) this.drawDetective(ctx, this.hud.detective);
      // v5 视觉升级：在画布坐标系内渲染引擎粒子（识破/攻击/拆解揭示等触发）
      this.engine?.renderV5Particles(ctx);
      // v5 霓虹边光：基于当前模式色的动态边框
      this.drawV5NeonEdge(ctx);
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

    // v3 Phase 3.4：段位升级仪式（全屏覆盖层，最上层之一）
    if (this.rankCeremony && this.t < this.rankCeremony.until) {
      this.drawRankCeremony(ctx, screenW, screenH);
    } else if (this.rankCeremony && this.t >= this.rankCeremony.until) {
      this.rankCeremony = null;
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

  /** v3 模式选择界面（modeSelect 状态，画布坐标） */
  private drawModeSelect(ctx: CanvasRenderingContext2D): void {
    // 半透明遮罩
    ctx.save();
    ctx.fillStyle = "rgba(7,14,31,0.92)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // 顶部光晕
    const glow = ctx.createRadialGradient(CANVAS_W / 2, 80, 0, CANVAS_W / 2, 80, 300);
    glow.addColorStop(0, withAlpha(this.getAccent(), 0.18));
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();

    // 标题
    ctx.save();
    ctx.font = `900 30px ${Theme.fonts.display}`;
    ctx.fillStyle = this.getAccent();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(this.getAccent(), 0.5);
    ctx.shadowBlur = 16;
    ctx.fillText("选择模式", CANVAS_W / 2, 70);
    ctx.shadowBlur = 0;
    ctx.font = `400 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("SELECT GAME MODE · 10 种玩法", CANVAS_W / 2, 100);
    ctx.restore();

    // 返回按钮（左上角）
    this.drawBackButton(ctx, this.getBackBtnRect());

    // 读取存档用于展示进度
    const save = loadFBSave();
    const todayKey = this.getTodayDailyKey();

    // 6 个模式卡片
    for (const mode of MODE_ORDER) {
      const r = this.getModeRect(mode);
      const color = MODE_COLORS[mode];
      const pressed = this.pressedMode === mode;
      const icon = FB_MODE_ICONS[mode];
      const label = FB_MODE_LABELS[mode];
      const desc = FB_MODE_DESCRIPTIONS[mode];
      const hint = FB_MODE_HINTS[mode];
      const locked = mode === "review" && this.lastWrongRecords.length === 0;

      ctx.save();
      if (pressed) ctx.translate(0, 2);
      // 背景
      roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      if (locked) {
        g.addColorStop(0, "rgba(60,70,90,0.3)");
        g.addColorStop(1, "rgba(10,15,25,0.6)");
      } else {
        g.addColorStop(0, withAlpha(color, 0.22));
        g.addColorStop(1, "rgba(10,25,41,0.8)");
      }
      ctx.fillStyle = g;
      ctx.fill();
      // 边框（脉动发光，锁定态灰暗）
      const pulse = locked ? 0 : 0.6 + Math.sin(this.t * 3 + MODE_ORDER.indexOf(mode) * 1.2) * 0.4;
      ctx.lineWidth = 2;
      ctx.strokeStyle = locked ? "rgba(122,143,176,0.4)" : color;
      ctx.shadowColor = locked ? "transparent" : color;
      ctx.shadowBlur = locked ? 0 : 6 + pulse * 8;
      roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 左侧色条
      ctx.fillStyle = locked ? "rgba(122,143,176,0.4)" : color;
      ctx.fillRect(r.x, r.y, 4, r.h);

      // 图标（左上）
      ctx.font = `24px ${Theme.fonts.display}`;
      ctx.fillStyle = locked ? "rgba(122,143,176,0.6)" : color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(icon, r.x + 12, r.y + 8);

      // 模式名（右上）
      ctx.font = `900 16px ${Theme.fonts.display}`;
      ctx.fillStyle = locked ? "rgba(122,143,176,0.7)" : color;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(label, r.x + r.w - 12, r.y + 10);

      // 描述（中部，单行截断）
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = locked ? "rgba(122,143,176,0.5)" : withAlpha(Theme.colors.ink.DEFAULT, 0.85);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const descLines = this.wrapTextCanvas(ctx, desc, r.w - 24, 1);
      descLines.forEach((line, i) => ctx.fillText(line, r.x + 12, r.y + 32 + i * 12));

      // 进度/提示行（底部）
      const progY = r.y + r.h - 16;
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = locked ? "rgba(229,53,59,0.8)" : withAlpha(color, 0.9);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      let progText = "";
      if (locked) {
        progText = "🔒 需先有错题";
      } else if (hint) {
        progText = hint;
      }
      if (progText) {
        ctx.fillText(progText, r.x + 12, progY);
      }
      // 模式专属进度（右侧）
      ctx.textAlign = "right";
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
      let progRight = "";
      if (!locked) {
        switch (mode) {
          case "story": {
            const cleared = save.storyClearedStages.length;
            const total = STORY_STAGES.length;
            progRight = `${cleared}/${total} 关`;
            break;
          }
          case "speedrun":
            progRight = save.speedrunBestCorrect > 0
              ? `最佳 ${save.speedrunBestCorrect}/${30}`
              : "未挑战";
            break;
          case "hardcore":
            progRight = save.hardcoreBestStreak > 0
              ? `连对 ${save.hardcoreBestStreak}`
              : "未挑战";
            break;
          case "daily":
            progRight = save.dailyHistory[todayKey] !== undefined
              ? `今日 ${save.dailyHistory[todayKey]}/10`
              : "今日未做";
            break;
          case "review":
            progRight = `已清 ${save.reviewNightmareTotalCleared}`;
            break;
          case "aiBattle":
            progRight = save.aiBattleClearedIds.length > 0
              ? `识破 ${save.aiBattleClearedIds.length}`
              : "未挑战";
            break;
          case "deconstruct":
            progRight = save.deconstructClearedIds.length > 0
              ? `拆解 ${save.deconstructClearedIds.length}`
              : "未挑战";
            break;
          case "detective":
            progRight = save.detectiveSolvedCount > 0
              ? `破案 ${save.detectiveSolvedCount}`
              : "未挑战";
            break;
          case "endless":
          default:
            progRight = `完美 ${save.perfectRunCount} 次`;
            break;
        }
      }
      if (progRight) {
        ctx.fillText(progRight, r.x + r.w - 12, progY);
      }
      ctx.restore();
    }

    // v3 Phase 4：教育入口行（底部 2 个大按钮）
    this.drawEduRow(ctx);

    // 底部提示
    ctx.save();
    ctx.font = `500 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("选择模式开始挑战 · 错题噩梦需先在其他模式答错题目", CANVAS_W / 2, CANVAS_H - 16);
    ctx.restore();
  }

  /** v3 Phase 4：渲染教育入口行（图鉴 + 96110 通话器） */
  private drawEduRow(ctx: CanvasRenderingContext2D): void {
    // 分隔线（与模式卡视觉区隔）
    ctx.save();
    ctx.strokeStyle = withAlpha(Theme.colors.bg.line, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, EDU_BTN_Y - 10);
    ctx.lineTo(CANVAS_W - 60, EDU_BTN_Y - 10);
    ctx.stroke();
    // 左侧标签
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("// 教育中心 · LEARNING HUB", CANVAS_W / 2, EDU_BTN_Y - 18);
    ctx.restore();

    for (const entry of EDU_ENTRIES) {
      const r = this.getEduBtnRect(entry.id);
      const pressed = this.pressedEdu === entry.id;

      ctx.save();
      if (pressed) ctx.translate(0, 2);
      // 背景
      roundRect(ctx, r.x, r.y, r.w, r.h, 10);
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, withAlpha(entry.color, 0.2));
      g.addColorStop(1, "rgba(10,25,41,0.85)");
      ctx.fillStyle = g;
      ctx.fill();
      // 边框（脉动）
      const pulse = 0.6 + Math.sin(this.t * 2.5 + entry.id.length) * 0.4;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = entry.color;
      ctx.shadowColor = entry.color;
      ctx.shadowBlur = 4 + pulse * 4;
      roundRect(ctx, r.x, r.y, r.w, r.h, 10);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 左侧色条
      ctx.fillStyle = entry.color;
      ctx.fillRect(r.x, r.y, 3, r.h);

      // 图标（左侧大字）
      ctx.font = `24px ${Theme.fonts.display}`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(entry.icon, r.x + 14, r.y + r.h / 2);

      // 标题（左上）
      ctx.font = `900 16px ${Theme.fonts.display}`;
      ctx.fillStyle = entry.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(entry.label, r.x + 48, r.y + 10);

      // 描述（左下，小字）
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.8);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(entry.desc, r.x + 48, r.y + 32);

      // 右侧箭头
      ctx.font = `700 18px ${Theme.fonts.mono}`;
      ctx.fillStyle = entry.color;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("›", r.x + r.w - 14, r.y + r.h / 2);

      ctx.restore();
    }
  }

  /** 画布文本换行（返回最多 maxLines 行） */
  private wrapTextCanvas(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
        if (lines.length >= maxLines - 1) break;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    // 截断超长末行
    if (lines.length > 0) {
      let last = lines[lines.length - 1];
      while (last.length > 0 && ctx.measureText(last + "…").width > maxWidth) {
        last = last.slice(0, -1);
      }
      if (lines[lines.length - 1] !== last) lines[lines.length - 1] = last + "…";
    }
    return lines;
  }

  /** v3 返回按钮绘制 */
  private drawBackButton(ctx: CanvasRenderingContext2D, r: Rect): void {
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = "rgba(20,35,55,0.8)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = withAlpha(Theme.colors.ink.muted, 0.6);
    ctx.stroke();
    ctx.font = `600 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← 返回", r.x + r.w / 2, r.y + r.h / 2);
    ctx.restore();
  }

  /** 获取今日日期 key（YYYY-MM-DD） */
  private getTodayDailyKey(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ===== v5 升级：三种新模式渲染与输入 =====

  /** AI 对战：聊天式多轮对话识破 */
  private drawAIBattle(ctx: CanvasRenderingContext2D, s: FBHudAIDialogState): void {
    // 深色背景 + 红色光晕（骗子压迫感）
    ctx.fillStyle = "#0A0F1E";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const glow = ctx.createRadialGradient(CANVAS_W / 2, 240, 0, CANVAS_W / 2, 240, 360);
    glow.addColorStop(0, "rgba(229,53,59,0.12)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 顶部信息栏
    ctx.save();
    ctx.fillStyle = "rgba(229,53,59,0.12)";
    ctx.fillRect(0, 0, CANVAS_W, 52);
    ctx.font = `900 16px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FF5A60";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🤖 AI 对战 · 多轮识破", 16, 26);
    // 识破进度
    ctx.textAlign = "right";
    ctx.font = `700 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.fillText(`识破 ${s.bustScore}/${s.passThreshold}`, CANVAS_W - 16, 18);
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.font = `500 11px ${Theme.fonts.mono}`;
    ctx.fillText(`轮次 ${s.turnCount}/${s.maxTurns}`, CANVAS_W - 16, 38);
    ctx.restore();

    // 剧本标题
    ctx.save();
    ctx.font = `600 12px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.7);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.scenarioTitle, CANVAS_W / 2, 64);
    ctx.restore();

    // 对话区：显示最近 4 轮（scammer 左 / player 右）
    const recent = s.turns.slice(-8);
    let chatY = 86;
    const chatBottom = 320;
    for (const turn of recent) {
      if (chatY >= chatBottom) break;
      const isScammer = turn.from === "scammer";
      const bubbleW = Math.min(380, Math.max(180, turn.text.length * 9 + 28));
      const bubbleH = this.measureBubbleHeight(ctx, turn.text, bubbleW - 24);
      const bx = isScammer ? 16 : CANVAS_W - 16 - bubbleW;
      // 气泡
      ctx.save();
      roundRect(ctx, bx, chatY, bubbleW, bubbleH, 10);
      ctx.fillStyle = isScammer ? "rgba(229,53,59,0.18)" : "rgba(26,214,112,0.18)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isScammer ? "rgba(229,53,59,0.6)" : "rgba(26,214,112,0.6)";
      ctx.stroke();
      // 文本
      ctx.fillStyle = isScammer ? "#FFB0B8" : "#9FE3C0";
      ctx.font = `500 12px ${Theme.fonts.body}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const lines = this.wrapTextCanvas(ctx, turn.text, bubbleW - 24, 4);
      lines.forEach((line, i) => ctx.fillText(line, bx + 12, chatY + 10 + i * 15));
      ctx.restore();
      chatY += bubbleH + 8;
    }

    // 当前骗子台词（高亮 + 红旗等级 + 话术标签）
    if (!s.ended) {
      const curY = 330;
      ctx.save();
      // 红旗等级条
      if (s.currentRedFlag > 0) {
        const rfColor = s.currentRedFlag >= 4 ? "#E5353B" : s.currentRedFlag >= 2 ? "#FFB020" : "#FFD666";
        ctx.fillStyle = rfColor;
        ctx.font = `700 10px ${Theme.fonts.mono}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`🔴 红旗 ${s.currentRedFlag}/5`, 16, curY);
        if (s.currentTactic) {
          ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
          ctx.fillText(`话术：${s.currentTactic}`, 100, curY);
        }
      }
      // 当前骗子气泡
      const curBubbleH = 46;
      // v5 视觉升级：红旗等级越高，气泡红光脉动越强（压迫感）
      const rfPulse = s.currentRedFlag >= 4
        ? 0.7 + ((Math.sin(this.t * 6) + 1) / 2) * 0.3  // 高红旗：快速脉动
        : s.currentRedFlag >= 2
          ? 0.5 + ((Math.sin(this.t * 4) + 1) / 2) * 0.2 // 中红旗：中速脉动
          : 0.4;                                          // 低红旗：稳定
      roundRect(ctx, 16, curY + 12, CANVAS_W - 32, curBubbleH, 10);
      ctx.fillStyle = `rgba(229,53,59,${0.18 + rfPulse * 0.12})`;
      ctx.fill();
      ctx.lineWidth = 2 + (s.currentRedFlag >= 4 ? 1 : 0);
      ctx.strokeStyle = "#E5353B";
      ctx.shadowColor = "#E5353B";
      ctx.shadowBlur = 8 + rfPulse * 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFE0E4";
      ctx.font = `600 13px ${Theme.fonts.body}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const scammerLines = this.wrapTextCanvas(ctx, s.currentScammerLine, CANVAS_W - 64, 2);
      scammerLines.forEach((line, i) => ctx.fillText(line, 28, curY + 12 + curBubbleH / 2 - (scammerLines.length - 1) * 8 + i * 16));
      ctx.restore();
    } else {
      // 结局展示
      ctx.save();
      const endColor = s.ending === "busted" ? "#1AD670" : "#E5353B";
      ctx.font = `900 22px ${Theme.fonts.display}`;
      ctx.fillStyle = endColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = endColor;
      ctx.shadowBlur = 16;
      ctx.fillText(s.ending === "busted" ? "🎉 识破骗局！" : "⚠ 未能识破", CANVAS_W / 2, 340);
      ctx.shadowBlur = 0;
      ctx.font = `500 12px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
      const endLines = this.wrapTextCanvas(ctx, s.endingDesc ?? "", CANVAS_W - 64, 3);
      endLines.forEach((line, i) => ctx.fillText(line, CANVAS_W / 2, 376 + i * 16));
      ctx.restore();
    }

    // 选项按钮
    if (!s.ended) {
      const choices = s.currentChoices;
      const rects = this.getAIBattleChoiceRects(choices.length);
      for (let i = 0; i < choices.length && i < rects.length; i++) {
        this.drawAIBattleChoice(ctx, rects[i], choices[i].text, i);
      }
    }
  }

  /** 骗局拆解：剧本逐句拆解 */
  private drawDeconstruct(ctx: CanvasRenderingContext2D, s: FBHudDeconstructState): void {
    ctx.fillStyle = "#0E0A1E";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const glow = ctx.createRadialGradient(CANVAS_W / 2, 240, 0, CANVAS_W / 2, 240, 360);
    glow.addColorStop(0, "rgba(124,77,255,0.14)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 顶部信息栏
    ctx.save();
    ctx.fillStyle = "rgba(124,77,255,0.14)";
    ctx.fillRect(0, 0, CANVAS_W, 52);
    ctx.font = `900 16px ${Theme.fonts.display}`;
    ctx.fillStyle = "#B388FF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🔍 骗局拆解 · 反向学习", 16, 26);
    ctx.textAlign = "right";
    ctx.font = `700 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.fillText(`红旗 ${s.totalRedFlags}`, CANVAS_W - 16, 18);
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.font = `500 11px ${Theme.fonts.mono}`;
    ctx.fillText(`进度 ${s.currentLineIdx + 1}/${s.totalLines}`, CANVAS_W - 16, 38);
    ctx.restore();

    // 剧本对白区（滚动展示已揭示行）
    const lines = s.revealedLines;
    let y = 64;
    const bottom = s.summaryShown ? 300 : 380;
    for (let i = 0; i < lines.length; i++) {
      if (y >= bottom) break;
      const line = lines[i];
      const isScammer = line.from === "scammer";
      const isSystem = line.from === "system";
      const bubbleW = isSystem ? CANVAS_W - 64 : Math.min(420, Math.max(200, line.text.length * 9 + 28));
      const bx = isSystem ? 32 : isScammer ? 16 : CANVAS_W - 16 - bubbleW;
      const bubbleH = this.measureBubbleHeight(ctx, line.text, bubbleW - 24);
      // 气泡
      ctx.save();
      roundRect(ctx, bx, y, bubbleW, bubbleH, 10);
      if (isSystem) {
        ctx.fillStyle = "rgba(122,143,176,0.14)";
      } else if (isScammer) {
        ctx.fillStyle = "rgba(229,53,59,0.16)";
      } else {
        ctx.fillStyle = "rgba(26,134,214,0.16)";
      }
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isSystem ? "rgba(122,143,176,0.4)" : isScammer ? "rgba(229,53,59,0.5)" : "rgba(26,134,214,0.5)";
      ctx.stroke();
      // 发言方标签
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = isScammer ? "#FF8A8F" : isSystem ? Theme.colors.ink.muted : "#7AB8E5";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const speaker = isScammer ? "骗子" : isSystem ? "系统" : "受害者";
      ctx.fillText(speaker, bx + 10, y + 5);
      // 文本
      ctx.fillStyle = isScammer ? "#FFD0D4" : isSystem ? withAlpha(Theme.colors.ink.muted, 0.9) : "#C8E0F5";
      ctx.font = `500 12px ${Theme.fonts.body}`;
      const textLines = this.wrapTextCanvas(ctx, line.text, bubbleW - 24, 4);
      textLines.forEach((tl, j) => ctx.fillText(tl, bx + 10, y + 18 + j * 15));
      ctx.restore();
      y += bubbleH + 6;
      // 拆解说明（仅当前行且已揭示）
      if (i === s.currentLineIdx && s.deconstructRevealed && line.deconstruct) {
        ctx.save();
        const dW = CANVAS_W - 32;
        const dH = this.measureBubbleHeight(ctx, line.deconstruct, dW - 24) + 8;
        // v5 视觉升级：拆解揭示金光脉动（呼吸效果）
        const dcPulse = 0.6 + ((Math.sin(this.t * 3.5) + 1) / 2) * 0.4;
        roundRect(ctx, 16, y, dW, dH, 8);
        ctx.fillStyle = `rgba(255,214,102,${0.12 + dcPulse * 0.08})`;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#FFD666";
        ctx.shadowColor = "#FFD666";
        ctx.shadowBlur = 6 + dcPulse * 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#FFE9A8";
        ctx.font = `600 11px ${Theme.fonts.body}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("💡 拆解", 26, y + 6);
        const dLines = this.wrapTextCanvas(ctx, line.deconstruct, dW - 48, 4);
        dLines.forEach((dl, j) => ctx.fillText(dl, 70, y + 6 + j * 15));
        ctx.restore();
        y += dH + 6;
      }
    }

    // 总结
    if (s.summaryShown && s.summary) {
      ctx.save();
      const sy = 308;
      roundRect(ctx, 16, sy, CANVAS_W - 32, 96, 10);
      const g = ctx.createLinearGradient(0, sy, 0, sy + 96);
      g.addColorStop(0, "rgba(26,214,112,0.18)");
      g.addColorStop(1, "rgba(10,25,41,0.8)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#1AD670";
      ctx.stroke();
      ctx.font = `900 14px ${Theme.fonts.display}`;
      ctx.fillStyle = "#1AD670";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("✅ 拆解总结", 28, sy + 10);
      ctx.font = `500 11px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
      ctx.fillText(`致命红旗 ${s.summary.totalRedFlags} 个 · 核心教训：${s.summary.lesson}`, 28, sy + 32);
      const cueLines = this.wrapTextCanvas(ctx, "关键识别词：" + s.summary.keyCues.join("、"), CANVAS_W - 64, 2);
      cueLines.forEach((cl, j) => ctx.fillText(cl, 28, sy + 52 + j * 15));
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
      ctx.fillText(`易受害人群：${s.summary.victimProfile}`, 28, sy + 82);
      ctx.restore();
    }

    // 底部按钮
    if (!s.summaryShown) {
      const nextR = this.getDeconstructBtnRect("next");
      const skipR = this.getDeconstructBtnRect("skip");
      this.drawV5ActionButton(ctx, nextR, s.deconstructRevealed ? "▶ 下一句" : "💡 显示拆解", "#7C4DFF", this.pressedV5Btn === "dcNext");
      this.drawV5ActionButton(ctx, skipR, "⏭ 跳过结尾", withAlpha(Theme.colors.ink.muted, 0.9), this.pressedV5Btn === "dcSkip", true);
    } else {
      const doneR = this.getDeconstructBtnRect("next");
      this.drawV5ActionButton(ctx, doneR, "✓ 完成学习", "#1AD670", this.pressedV5Btn === "dcNext");
    }
  }

  /** 双人对战：同设备双人轮流答题 */
  private drawVersus(ctx: CanvasRenderingContext2D, s: FBHudVSState): void {
    ctx.fillStyle = "#0E1208";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const glow = ctx.createRadialGradient(CANVAS_W / 2, 240, 0, CANVAS_W / 2, 240, 360);
    glow.addColorStop(0, "rgba(255,176,32,0.12)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 双人血量条
    this.drawVSPlayerBar(ctx, s.p1, 16, 12, true);
    this.drawVSPlayerBar(ctx, s.p2, CANVAS_W - 16 - 360, 12, false);
    // VS 标志
    ctx.save();
    ctx.font = `900 20px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFB020";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FFB020";
    ctx.shadowBlur = 10;
    ctx.fillText("VS", CANVAS_W / 2, 36);
    ctx.shadowBlur = 0;
    ctx.restore();

    if (s.ended) {
      // 结局
      ctx.save();
      const winColor = s.winner === "P1" ? s.p1.color : s.winner === "P2" ? s.p2.color : "#FFB020";
      const winName = s.winner === "P1" ? s.p1.name : s.winner === "P2" ? s.p2.name : "平局";
      ctx.font = `900 28px ${Theme.fonts.display}`;
      ctx.fillStyle = winColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = winColor;
      ctx.shadowBlur = 18;
      ctx.fillText(s.winner === "draw" ? "🤝 平局！" : `🏆 ${winName} 获胜！`, CANVAS_W / 2, 240);
      ctx.shadowBlur = 0;
      ctx.font = `600 14px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
      ctx.fillText(`${s.p1.name} 答对 ${s.p1.correct} · ${s.p2.name} 答对 ${s.p2.correct}`, CANVAS_W / 2, 282);
      ctx.restore();
      return;
    }

    // 当前回合提示
    const curP = s.currentTurn === "P1" ? s.p1 : s.p2;
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.body}`;
    ctx.fillStyle = curP.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`◀ ${curP.name} 的回合 ▶ 答对攻击对方，答错自伤`, CANVAS_W / 2, 78);
    ctx.restore();

    // 题目
    const q = s.currentQuestion;
    if (q) {
      ctx.save();
      // 题目卡片
      roundRect(ctx, 16, 96, CANVAS_W - 32, 120, 10);
      ctx.fillStyle = "rgba(10,25,41,0.7)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = withAlpha(curP.color, 0.5);
      ctx.stroke();
      ctx.font = `700 13px ${Theme.fonts.display}`;
      ctx.fillStyle = curP.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(q.title, 28, 106);
      ctx.font = `500 12px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
      const bodyLines = this.wrapTextCanvas(ctx, q.body, CANVAS_W - 64, 4);
      bodyLines.forEach((bl, i) => ctx.fillText(bl, 28, 128 + i * 16));
      ctx.restore();

      // 选项按钮（2×2 网格）
      const rects = this.getVersusOptionRects(q.options.length);
      for (let i = 0; i < q.options.length && i < rects.length; i++) {
        this.drawVersusOption(ctx, rects[i], q.options[i], i, curP.color);
      }
    }

    // 上一回合反馈
    if (s.lastResult) {
      ctx.save();
      const lr = s.lastResult;
      const fbColor = lr.correct ? "#1AD670" : "#E5353B";
      ctx.font = `700 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = fbColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const targetName = lr.target === "P1" ? s.p1.name : s.p2.name;
      ctx.fillText(lr.correct ? `${targetName} -${lr.damage} HP` : `${targetName} -${lr.damage} HP（自伤）`, CANVAS_W / 2, 460);
      ctx.restore();
    }
  }

  /** 测量气泡高度（用于动态布局） */
  private measureBubbleHeight(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): number {
    const lines = this.wrapTextCanvas(ctx, text, maxWidth, 4);
    return 16 + lines.length * 15;
  }

  /** AI 对战选项按钮矩形 */
  private getAIBattleChoiceRects(count: number): Rect[] {
    const rects: Rect[] = [];
    const w = CANVAS_W - 32;
    const h = 44;
    const gap = 8;
    const startY = 400;
    for (let i = 0; i < count; i++) {
      rects.push({ x: 16, y: startY + i * (h + gap), w, h });
    }
    return rects;
  }

  /** 绘制 AI 对战选项按钮 */
  private drawAIBattleChoice(ctx: CanvasRenderingContext2D, r: Rect, text: string, idx: number): void {
    const pressed = this.pressedV5Btn === `ai${idx}`;
    ctx.save();
    if (pressed) ctx.translate(0, 2);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, "rgba(26,214,112,0.16)");
    g.addColorStop(1, "rgba(10,25,41,0.8)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pressed ? "#1AD670" : "rgba(26,214,112,0.5)";
    if (pressed) {
      ctx.shadowColor = "#1AD670";
      ctx.shadowBlur = 8;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#9FE3C0";
    ctx.font = `600 13px ${Theme.fonts.body}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const lines = this.wrapTextCanvas(ctx, text, r.w - 36, 2);
    lines.forEach((line, i) => ctx.fillText(line, r.x + 14, r.y + r.h / 2 - (lines.length - 1) * 8 + i * 16));
    ctx.restore();
  }

  /** 骗局拆解按钮矩形 */
  private getDeconstructBtnRect(id: "next" | "skip"): Rect {
    if (id === "next") return { x: 16, y: 404, w: 360, h: 52 };
    return { x: 392, y: 404, w: CANVAS_W - 392 - 16, h: 52 };
  }

  /** 双人对战选项矩形（2×2 网格） */
  private getVersusOptionRects(count: number): Rect[] {
    const rects: Rect[] = [];
    const cols = count <= 2 ? 1 : 2;
    const rows = Math.ceil(count / cols);
    const gap = 10;
    const totalW = CANVAS_W - 32;
    const w = cols === 1 ? totalW : (totalW - gap) / 2;
    const h = rows === 1 ? 56 : 52;
    const startY = 226;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      rects.push({
        x: 16 + col * (w + gap),
        y: startY + row * (h + gap),
        w,
        h,
      });
    }
    return rects;
  }

  /** 绘制双人对战选项 */
  private drawVersusOption(ctx: CanvasRenderingContext2D, r: Rect, text: string, idx: number, color: string): void {
    const pressed = this.pressedV5Btn === `vs${idx}`;
    ctx.save();
    if (pressed) ctx.translate(0, 2);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, withAlpha(color, 0.14));
    g.addColorStop(1, "rgba(10,25,41,0.8)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pressed ? color : withAlpha(color, 0.5);
    if (pressed) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 选项字母
    ctx.fillStyle = color;
    ctx.font = `900 16px ${Theme.fonts.display}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(LETTERS[idx] ?? String(idx + 1), r.x + 12, r.y + r.h / 2);
    // 选项文本
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    ctx.font = `500 12px ${Theme.fonts.body}`;
    const lines = this.wrapTextCanvas(ctx, text, r.w - 48, 2);
    lines.forEach((line, i) => ctx.fillText(line, r.x + 36, r.y + r.h / 2 - (lines.length - 1) * 8 + i * 16));
    ctx.restore();
  }

  // ===== v6 反诈侦探模式渲染 =====

  /** 侦探模式主渲染入口 */
  private drawDetective(ctx: CanvasRenderingContext2D, s: FBHudDetectiveState): void {
    // 背景
    ctx.fillStyle = "#08111E";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const glow = ctx.createRadialGradient(CANVAS_W / 2, 240, 0, CANVAS_W / 2, 240, 360);
    glow.addColorStop(0, "rgba(0,229,255,0.10)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    switch (s.stage) {
      case "briefing": this.drawDetectiveBriefing(ctx, s); break;
      case "evidence": this.drawDetectiveEvidence(ctx, s); break;
      case "reasoning": this.drawDetectiveReasoning(ctx, s); break;
      case "summary":
      case "archived": this.drawDetectiveSummary(ctx, s); break;
    }
  }

  /** 侦探顶部信息栏 */
  private drawDetectiveTopBar(ctx: CanvasRenderingContext2D, leftLabel: string, rightText: string, rightColor: string): void {
    ctx.save();
    ctx.fillStyle = "rgba(0,229,255,0.10)";
    ctx.fillRect(0, 0, CANVAS_W, 44);
    ctx.font = `900 14px ${Theme.fonts.display}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(leftLabel, 16, 22);
    ctx.textAlign = "right";
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = rightColor;
    ctx.fillText(rightText, CANVAS_W - 16, 22);
    ctx.restore();
  }

  /** 简报阶段 */
  private drawDetectiveBriefing(ctx: CanvasRenderingContext2D, s: FBHudDetectiveState): void {
    const runner = this.engine?.getDetectiveRunner();
    if (!runner) return;
    const c = runner.getCase();
    this.drawDetectiveTopBar(ctx, "🔍 反诈侦探 · 案件简报", `${c.id} · 难度${"★".repeat(c.difficulty)}`, "#FFD666");

    // 案件标题
    ctx.save();
    ctx.font = `900 18px ${Theme.fonts.display}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 8;
    const titleLines = this.wrapTextCanvas(ctx, c.title, CANVAS_W - 64, 2);
    titleLines.forEach((line, i) => ctx.fillText(line, CANVAS_W / 2, 54 + i * 22));
    ctx.shadowBlur = 0;
    ctx.restore();

    // 简报卡片
    ctx.save();
    const bx = 16, by = 104, bw = CANVAS_W - 32, bh = 200;
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fillStyle = "rgba(10,25,41,0.7)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = withAlpha("#00E5FF", 0.4);
    ctx.stroke();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("📋 接警简报", bx + 12, by + 10);
    ctx.font = `500 12px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    const briefLines = this.wrapTextCanvas(ctx, c.briefing, bw - 24, 9);
    briefLines.forEach((line, i) => ctx.fillText(line, bx + 12, by + 32 + i * 16));
    ctx.restore();

    // 受害者画像标签
    const vp = VICTIM_PROFILES.find((p) => p.typeId === c.victimProfileId);
    if (vp) {
      ctx.save();
      const vy = 314, vw = CANVAS_W - 32, vh = 56;
      roundRect(ctx, 16, vy, vw, vh, 8);
      ctx.fillStyle = withAlpha(vp.color, 0.10);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = withAlpha(vp.color, 0.5);
      ctx.stroke();
      ctx.font = `20px ${Theme.fonts.display}`;
      ctx.fillStyle = vp.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("🎯", 28, vy + 28);
      ctx.font = `800 13px ${Theme.fonts.display}`;
      ctx.fillStyle = vp.color;
      ctx.fillText(vp.name, 56, vy + 18);
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
      const vpLines = this.wrapTextCanvas(ctx, vp.desc, vw - 80, 2);
      vpLines.forEach((line, i) => ctx.fillText(line, 56, vy + 36 + i * 12));
      ctx.restore();
    }

    // 开始调查按钮
    const btnR = this.getDetectiveBtnRect("primary");
    this.drawV5ActionButton(ctx, btnR, "🔍 开始调查 →", "#00E5FF", this.pressedV5Btn === "dtPrimary");
  }

  /** 证据浏览阶段 */
  private drawDetectiveEvidence(ctx: CanvasRenderingContext2D, s: FBHudDetectiveState): void {
    const runner = this.engine?.getDetectiveRunner();
    if (!runner) return;
    const c = runner.getCase();
    const timerPct = Math.max(0, s.evidenceRemainSec / s.evidenceTotalSec);
    const timerColor = timerPct > 0.5 ? "#00E5FF" : timerPct > 0.25 ? "#FFD666" : "#E5353B";
    this.drawDetectiveTopBar(ctx, "🔍 证据收集 · 点击查看详情", `⏱ ${Math.ceil(s.evidenceRemainSec)}s · ${s.viewedEvidenceIds.length}/${c.evidences.length}`, timerColor);

    // 倒计时条
    ctx.save();
    ctx.fillStyle = "rgba(10,25,41,0.6)";
    ctx.fillRect(0, 44, CANVAS_W, 4);
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 44, CANVAS_W * timerPct, 4);
    if (timerPct < 0.25) {
      ctx.shadowColor = timerColor;
      ctx.shadowBlur = 6 + Math.sin(this.t * 8) * 4;
      ctx.fillRect(0, 44, CANVAS_W * timerPct, 4);
    }
    ctx.restore();

    // 证据列表（左侧）
    const listX = 16, listY = 56, listW = 230;
    const evCount = c.evidences.length;
    const evH = Math.min(70, (368 - (evCount - 1) * 6) / evCount);
    for (let i = 0; i < evCount; i++) {
      const ev = c.evidences[i];
      const r = { x: listX, y: listY + i * (evH + 6), w: listW, h: evH };
      const viewed = s.viewedEvidenceIds.includes(ev.id);
      const selected = s.selectedEvidenceId === ev.id;
      const tagColor = ev.tag === "key" ? "#FFD666" : ev.tag === "misleading" ? "#FF7A1A" : "#7AB8E5";

      ctx.save();
      if (this.pressedV5Btn === `dtEv${i}`) ctx.translate(0, 2);
      roundRect(ctx, r.x, r.y, r.w, r.h, 8);
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, selected ? withAlpha("#00E5FF", 0.22) : "rgba(10,25,41,0.7)");
      g.addColorStop(1, "rgba(10,18,30,0.85)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeStyle = selected ? "#00E5FF" : withAlpha(tagColor, 0.4);
      if (selected) { ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 8; }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 类型图标
      const evIcon: Record<string, string> = { chat: "💬", transfer: "💳", call: "📞", link: "🔗", screenshot: "📷", audio: "🎙" };
      ctx.font = `18px ${Theme.fonts.display}`;
      ctx.fillStyle = tagColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(evIcon[ev.kind] ?? "📄", r.x + 10, r.y + 8);
      // 标题
      ctx.font = `700 11px ${Theme.fonts.body}`;
      ctx.fillStyle = selected ? "#00E5FF" : withAlpha(Theme.colors.ink.DEFAULT, 0.9);
      const tl = this.wrapTextCanvas(ctx, ev.title, r.w - 50, 2);
      tl.forEach((line, j) => ctx.fillText(line, r.x + 34, r.y + 8 + j * 14));
      // 标签
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = tagColor;
      ctx.textAlign = "right";
      const tagLabel = ev.tag === "key" ? "关键" : ev.tag === "misleading" ? "误导" : "常规";
      ctx.fillText(tagLabel, r.x + r.w - 10, r.y + 8);
      // 已查看标记
      if (viewed) {
        ctx.font = `600 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#1AD670";
        ctx.textAlign = "right";
        ctx.fillText("✓ 已查看", r.x + r.w - 10, r.y + r.h - 14);
      }
      ctx.restore();
    }

    // 证据详情（右侧）
    const dx = 256, dy = 56, dw = CANVAS_W - 256 - 16, dh = 340;
    ctx.save();
    roundRect(ctx, dx, dy, dw, dh, 10);
    ctx.fillStyle = "rgba(6,14,26,0.85)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = withAlpha("#00E5FF", 0.3);
    ctx.stroke();
    const selectedEv = runner.getSelectedEvidence();
    if (selectedEv) {
      this.drawDetectiveEvidenceDetail(ctx, selectedEv, dx, dy, dw, dh);
    } else {
      ctx.font = `500 12px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.7);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const hintLines = [
        "👈 点击左侧证据查看详情",
        "",
        "🔑 关键证据（金）揭露诈骗核心话术",
        "⚠ 误导证据（橙）需谨慎判断",
        "📋 常规证据（蓝）提供背景信息",
      ];
      hintLines.forEach((line, i) => ctx.fillText(line, dx + dw / 2, dy + dh / 2 - 48 + i * 22));
    }
    ctx.restore();

    // 进入推理按钮
    const btnR = this.getDetectiveBtnRect("primary");
    const allViewed = s.viewedEvidenceIds.length >= c.evidences.length;
    this.drawV5ActionButton(ctx, btnR, allViewed ? "🧠 进入推理 →" : "🧠 跳过证据，直接推理 →", "#00E5FF", this.pressedV5Btn === "dtPrimary");
  }

  /** 证据详情内容渲染（按 kind 分支） */
  private drawDetectiveEvidenceDetail(ctx: CanvasRenderingContext2D, ev: FBDetectiveEvidence, x: number, y: number, w: number, h: number): void {
    // 标题
    ctx.save();
    ctx.font = `800 13px ${Theme.fonts.display}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const tl = this.wrapTextCanvas(ctx, ev.title, w - 24, 2);
    tl.forEach((line, i) => ctx.fillText(line, x + 12, y + 10 + i * 16));
    // 标签条
    const tagColor = ev.tag === "key" ? "#FFD666" : ev.tag === "misleading" ? "#FF7A1A" : "#7AB8E5";
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = tagColor;
    ctx.textAlign = "right";
    const tagLabel = ev.tag === "key" ? "🔑 关键证据" : ev.tag === "misleading" ? "⚠ 误导证据" : "📋 常规证据";
    ctx.fillText(tagLabel, x + w - 12, y + 12);
    ctx.restore();

    // 内容区
    const cy = y + 42, ch = h - 42 - (ev.revealedCues && ev.revealedCues.length ? 28 : 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 8, cy, w - 16, ch);
    ctx.clip();

    const p = ev.payload;
    if (p.kind === "chat") {
      // 聊天气泡
      let by = cy + 6;
      for (const msg of p.messages) {
        const isMe = msg.from === "me";
        const isSys = msg.from === "system";
        const bw = isSys ? w - 40 : Math.min(280, Math.max(160, msg.text.length * 8 + 24));
        const bx = isSys ? x + 20 : isMe ? x + w - 16 - bw : x + 16;
        const bh = this.measureBubbleHeight(ctx, msg.text, bw - 20) + 4;
        if (by + bh > cy + ch) break;
        ctx.save();
        roundRect(ctx, bx, by, bw, bh, 8);
        ctx.fillStyle = isSys ? "rgba(122,143,176,0.14)" : isMe ? "rgba(0,229,255,0.14)" : "rgba(229,53,59,0.16)";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = isSys ? "rgba(122,143,176,0.3)" : isMe ? "rgba(0,229,255,0.4)" : "rgba(229,53,59,0.4)";
        ctx.stroke();
        ctx.font = `600 8px ${Theme.fonts.mono}`;
        ctx.fillStyle = isSys ? Theme.colors.ink.muted : isMe ? "#7AD8E5" : "#FF8A8F";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(isSys ? "系统" : isMe ? "受害者" : "骗子", bx + 8, by + 3);
        if (msg.time) {
          ctx.textAlign = "right";
          ctx.fillText(msg.time, bx + bw - 8, by + 3);
        }
        ctx.font = `500 10px ${Theme.fonts.body}`;
        ctx.fillStyle = isSys ? withAlpha(Theme.colors.ink.muted, 0.9) : isMe ? "#C8EAF5" : "#FFD0D4";
        const ml = this.wrapTextCanvas(ctx, msg.text, bw - 20, 4);
        ml.forEach((line, j) => ctx.fillText(line, bx + 8, by + 16 + j * 13));
        ctx.restore();
        by += bh + 4;
      }
    } else if (p.kind === "transfer") {
      // 转账流水
      let ry = cy + 6;
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      for (const f of p.flows) {
        if (ry + 40 > cy + ch) break;
        ctx.save();
        roundRect(ctx, x + 12, ry, w - 24, 36, 6);
        ctx.fillStyle = "rgba(229,53,59,0.10)";
        ctx.fill();
        ctx.strokeStyle = "rgba(229,53,59,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#FF8A8F";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`${f.time}`, x + 18, ry + 4);
        ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
        ctx.font = `500 10px ${Theme.fonts.body}`;
        const fl = this.wrapTextCanvas(ctx, `${f.from} → ${f.to}`, w - 80, 1);
        ctx.fillText(fl[0] ?? "", x + 60, ry + 4);
        ctx.font = `700 12px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#E5353B";
        ctx.textAlign = "right";
        ctx.fillText(f.amount, x + w - 18, ry + 4);
        if (f.note) {
          ctx.font = `400 9px ${Theme.fonts.mono}`;
          ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
          ctx.textAlign = "right";
          ctx.fillText(f.note, x + w - 18, ry + 22);
        }
        ctx.restore();
        ry += 42;
      }
    } else if (p.kind === "call") {
      // 通话录音
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`📞 来电号码：${p.callerNumber}`, x + 12, cy + 8);
      ctx.fillText(`⏱ 时长：${Math.floor(p.duration / 60)}'${String(p.duration % 60).padStart(2, "0")}"`, x + 12, cy + 24);
      if (p.isSyntheticVoice) {
        ctx.fillStyle = "#FF7A1A";
        ctx.fillText("⚠ AI 合成语音", x + 12, cy + 40);
      }
      // 转录文本
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
      const tl2 = this.wrapTextCanvas(ctx, `"${p.transcript}"`, w - 24, 12);
      tl2.forEach((line, i) => ctx.fillText(line, x + 12, cy + 60 + i * 14));
    } else if (p.kind === "link") {
      // 链接分析
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = p.isPhishing ? "#E5353B" : "#1AD670";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(p.isPhishing ? "⚠ 钓鱼链接" : "✓ 正常链接", x + 12, cy + 8);
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF8A8F";
      ctx.fillText(`URL: ${p.url}`, x + 12, cy + 26);
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
      const sl = this.wrapTextCanvas(ctx, `截图：${p.screenshotDesc}`, w - 24, 3);
      sl.forEach((line, i) => ctx.fillText(line, x + 12, cy + 44 + i * 14));
      const dl = this.wrapTextCanvas(ctx, `域名分析：${p.domainAnalysis}`, w - 24, 5);
      dl.forEach((line, i) => ctx.fillText(line, x + 12, cy + 44 + sl.length * 14 + i * 14));
    } else if (p.kind === "screenshot") {
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = p.tampered ? "#FF7A1A" : "#1AD670";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(p.tampered ? "⚠ 疑似篡改截图" : "✓ 截图", x + 12, cy + 8);
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
      const dl = this.wrapTextCanvas(ctx, p.desc, w - 24, 2);
      dl.forEach((line, i) => ctx.fillText(line, x + 12, cy + 26 + i * 14));
      let dy2 = cy + 26 + dl.length * 14;
      for (const d of p.details) {
        if (dy2 + 14 > cy + ch) break;
        ctx.font = `500 10px ${Theme.fonts.body}`;
        ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
        const dl2 = this.wrapTextCanvas(ctx, `• ${d}`, w - 24, 1);
        ctx.fillText(dl2[0] ?? "", x + 12, dy2);
        dy2 += 16;
      }
    } else if (p.kind === "audio") {
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#00E5FF";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`🎙 ${p.clip.label}`, x + 12, cy + 8);
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
      ctx.fillText(`时长 ${p.clip.duration}s · ${p.clip.isSynthetic ? "AI 合成" : "真人"}`, x + 12, cy + 24);
      if (p.clip.synthTech) {
        ctx.fillStyle = "#FF7A1A";
        ctx.fillText(`技术：${p.clip.synthTech}`, x + 12, cy + 40);
      }
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
      const tl3 = this.wrapTextCanvas(ctx, `"${p.clip.transcript}"`, w - 24, 10);
      tl3.forEach((line, i) => ctx.fillText(line, x + 12, cy + 60 + i * 14));
    }
    ctx.restore();

    // 揭露要点
    if (ev.revealedCues && ev.revealedCues.length) {
      ctx.save();
      const cueY = y + h - 24;
      ctx.fillStyle = "rgba(255,214,102,0.08)";
      ctx.fillRect(x + 8, cueY, w - 16, 20);
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const cueText = "💡 揭露：" + ev.revealedCues.join("、");
      const cl = this.wrapTextCanvas(ctx, cueText, w - 24, 1);
      ctx.fillText(cl[0] ?? "", x + 12, cueY + 10);
      ctx.restore();
    }
  }

  /** 推理问答阶段 */
  private drawDetectiveReasoning(ctx: CanvasRenderingContext2D, s: FBHudDetectiveState): void {
    const runner = this.engine?.getDetectiveRunner();
    if (!runner) return;
    const q = runner.getCurrentQuestion();
    if (!q) return;
    const lastResult = runner.getLastAnswerResult();
    const answered = lastResult !== null;
    const stageNames: Record<string, string> = { identify: "识别", locate: "定位", reconstruct: "还原", prevent: "防范" };
    this.drawDetectiveTopBar(ctx, `🔍 推理问答 · ${stageNames[q.stage] ?? q.stage}阶段`, `题 ${s.currentQuestionIdx + 1}/${s.totalQuestions} · 得分 ${s.reasoningScore}`, "#00E5FF");

    // 问题卡片
    ctx.save();
    const qx = 16, qy = 52, qw = CANVAS_W - 32, qh = 68;
    roundRect(ctx, qx, qy, qw, qh, 10);
    ctx.fillStyle = "rgba(10,25,41,0.7)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = withAlpha("#00E5FF", 0.4);
    ctx.stroke();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const qTypeLabel: Record<string, string> = { single: "单选", multi: "多选", sort: "排序", link: "连线" };
    ctx.fillText(`[${qTypeLabel[q.kind] ?? q.kind}]`, qx + 12, qy + 8);
    ctx.font = `600 12px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.95);
    const ql = this.wrapTextCanvas(ctx, q.question, qw - 24, 3);
    ql.forEach((line, i) => ctx.fillText(line, qx + 12, qy + 26 + i * 15));
    ctx.restore();

    // 选项区
    const optY = 130;
    const optH = CANVAS_H - 130 - 76;
    if (!answered) {
      this.drawDetectiveOptions(ctx, q, qx, optY, qw, optH);
    } else {
      this.drawDetectiveFeedback(ctx, q, lastResult, qx, optY, qw, optH);
    }

    // 底部按钮
    const btnR = this.getDetectiveBtnRect("primary");
    if (answered) {
      const isLast = s.currentQuestionIdx >= s.totalQuestions - 1;
      this.drawV5ActionButton(ctx, btnR, isLast ? "📋 查看复盘 →" : "▶ 下一题 →", "#00E5FF", this.pressedV5Btn === "dtPrimary");
    } else {
      // 多选/排序/连线需要提交按钮
      if (q.kind === "multi" || q.kind === "sort" || q.kind === "link") {
        let canSubmit = false;
        if (q.kind === "multi") canSubmit = this.detectiveMultiSel.length > 0;
        else if (q.kind === "sort") canSubmit = this.detectiveSortSeq.length === q.options.length;
        else canSubmit = this.detectiveLinkPairs.length === (q.linkLeft?.length ?? 0);
        this.drawV5ActionButton(ctx, btnR, canSubmit ? "✓ 提交答案" : "请选择...", canSubmit ? "#00E5FF" : "rgba(122,143,176,0.6)", this.pressedV5Btn === "dtPrimary", !canSubmit);
      } else {
        this.drawV5ActionButton(ctx, btnR, "点击选项作答", "rgba(122,143,176,0.6)", false, true);
      }
    }
  }

  /** 绘制推理选项（未答题态） */
  private drawDetectiveOptions(ctx: CanvasRenderingContext2D, q: FBDetectiveQuestion, x: number, y: number, w: number, h: number): void {
    if (q.kind === "single") {
      // 单选：垂直列表
      const rects = this.getDetectiveOptionRects(q.options.length, y);
      for (let i = 0; i < q.options.length; i++) {
        this.drawDetectiveOptionBtn(ctx, rects[i], q.options[i], i, "single", this.pressedV5Btn === `dtOpt${i}`);
      }
    } else if (q.kind === "multi") {
      const rects = this.getDetectiveOptionRects(q.options.length, y);
      for (let i = 0; i < q.options.length; i++) {
        const sel = this.detectiveMultiSel.includes(i);
        this.drawDetectiveOptionBtn(ctx, rects[i], q.options[i], i, "multi", this.pressedV5Btn === `dtOpt${i}`, sel);
      }
    } else if (q.kind === "sort") {
      const rects = this.getDetectiveOptionRects(q.options.length, y);
      for (let i = 0; i < q.options.length; i++) {
        const orderIdx = this.detectiveSortSeq.indexOf(i);
        this.drawDetectiveOptionBtn(ctx, rects[i], q.options[i], i, "sort", this.pressedV5Btn === `dtOpt${i}`, false, orderIdx);
      }
    } else if (q.kind === "link") {
      // 连线题：左右两列
      const leftCount = q.linkLeft?.length ?? 0;
      const rightCount = q.linkRight?.length ?? 0;
      const colW = (w - 24) / 2;
      const leftX = x + 8, rightX = x + 8 + colW + 8;
      const itemH = Math.min(48, (h - 16) / Math.max(leftCount, rightCount) - 6);
      for (let i = 0; i < leftCount; i++) {
        const r = { x: leftX, y: y + i * (itemH + 6), w: colW, h: itemH };
        const paired = this.detectiveLinkPairs.find(([l]) => l === i);
        const isSel = this.detectiveLinkSelLeft === i;
        this.drawDetectiveLinkBtn(ctx, r, q.linkLeft![i], i, "left", this.pressedV5Btn === `dtLinkL${i}`, isSel, paired !== undefined);
      }
      for (let i = 0; i < rightCount; i++) {
        const r = { x: rightX, y: y + i * (itemH + 6), w: colW, h: itemH };
        const paired = this.detectiveLinkPairs.find(([, rr]) => rr === i);
        this.drawDetectiveLinkBtn(ctx, r, q.linkRight![i], i, "right", this.pressedV5Btn === `dtLinkR${i}`, false, paired !== undefined);
      }
      // 连线
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#00E5FF";
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 4;
      for (const [l, r] of this.detectiveLinkPairs) {
        const ly = y + l * (itemH + 6) + itemH / 2;
        const ry = y + r * (itemH + 6) + itemH / 2;
        ctx.beginPath();
        ctx.moveTo(leftX + colW, ly);
        ctx.lineTo(rightX, ry);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  /** 选项按钮（single/multi/sort） */
  private drawDetectiveOptionBtn(ctx: CanvasRenderingContext2D, r: Rect, text: string, idx: number, kind: "single" | "multi" | "sort", pressed: boolean, selected = false, orderIdx = -1): void {
    ctx.save();
    if (pressed) ctx.translate(0, 2);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, selected ? withAlpha("#00E5FF", 0.18) : "rgba(10,25,41,0.7)");
    g.addColorStop(1, "rgba(10,18,30,0.85)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.strokeStyle = selected ? "#00E5FF" : withAlpha("#00E5FF", 0.4);
    if (selected) { ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 8; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 左侧标记
    if (kind === "multi") {
      ctx.font = `700 14px ${Theme.fonts.mono}`;
      ctx.fillStyle = selected ? "#00E5FF" : withAlpha(Theme.colors.ink.muted, 0.6);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(selected ? "☑" : "☐", r.x + 16, r.y + r.h / 2);
    } else if (kind === "sort") {
      ctx.font = `800 14px ${Theme.fonts.display}`;
      ctx.fillStyle = orderIdx >= 0 ? "#FFD666" : withAlpha(Theme.colors.ink.muted, 0.5);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(orderIdx >= 0 ? String(orderIdx + 1) : "·", r.x + 16, r.y + r.h / 2);
    } else {
      ctx.font = `900 14px ${Theme.fonts.display}`;
      ctx.fillStyle = "#00E5FF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(LETTERS[idx] ?? String(idx + 1), r.x + 16, r.y + r.h / 2);
    }
    // 文本
    ctx.font = `500 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const lines = this.wrapTextCanvas(ctx, text, r.w - 40, 2);
    lines.forEach((line, i) => ctx.fillText(line, r.x + 32, r.y + r.h / 2 - (lines.length - 1) * 8 + i * 15));
    ctx.restore();
  }

  /** 连线题选项按钮 */
  private drawDetectiveLinkBtn(ctx: CanvasRenderingContext2D, r: Rect, text: string, idx: number, side: "left" | "right", pressed: boolean, selected: boolean, paired: boolean): void {
    ctx.save();
    if (pressed) ctx.translate(0, 2);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, selected ? withAlpha("#00E5FF", 0.22) : paired ? withAlpha("#1AD670", 0.14) : "rgba(10,25,41,0.7)");
    g.addColorStop(1, "rgba(10,18,30,0.85)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.strokeStyle = selected ? "#00E5FF" : paired ? "#1AD670" : withAlpha("#00E5FF", 0.3);
    if (selected) { ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 8; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `500 10px ${Theme.fonts.body}`;
    ctx.fillStyle = paired ? "#9FE3C0" : withAlpha(Theme.colors.ink.DEFAULT, 0.9);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = this.wrapTextCanvas(ctx, text, r.w - 16, 2);
    lines.forEach((line, i) => ctx.fillText(line, r.x + r.w / 2, r.y + r.h / 2 - (lines.length - 1) * 7 + i * 14));
    ctx.restore();
  }

  /** 答题反馈（已答题态） */
  private drawDetectiveFeedback(ctx: CanvasRenderingContext2D, q: FBDetectiveQuestion, result: { correct: boolean; explain: string; breakingPointFound: boolean }, x: number, y: number, w: number, h: number): void {
    // 结果标题
    ctx.save();
    ctx.font = `900 18px ${Theme.fonts.display}`;
    ctx.fillStyle = result.correct ? "#1AD670" : "#E5353B";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = result.correct ? "#1AD670" : "#E5353B";
    ctx.shadowBlur = 10;
    ctx.fillText(result.correct ? "✅ 回答正确！" : "❌ 回答错误", CANVAS_W / 2, y);
    ctx.shadowBlur = 0;
    if (result.breakingPointFound && result.correct) {
      ctx.font = `800 13px ${Theme.fonts.display}`;
      ctx.fillStyle = "#FFD666";
      ctx.fillText("🎯 破局点已定位！", CANVAS_W / 2, y + 26);
    }
    ctx.restore();

    // 正确答案
    ctx.save();
    const ay = y + 50;
    roundRect(ctx, x, ay, w, 56, 8);
    ctx.fillStyle = "rgba(10,25,41,0.6)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha(Theme.colors.ink.muted, 0.3);
    ctx.stroke();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let answerText = "";
    if (q.kind === "single") answerText = q.options[q.answer ?? 0] ?? "";
    else if (q.kind === "multi") answerText = (q.answers ?? []).map((i) => q.options[i]).join("、");
    else if (q.kind === "sort") answerText = (q.sortCorrect ?? []).map((i, n) => `${n + 1}.${q.options[i]}`).join(" → ");
    else if (q.kind === "link") answerText = (q.linkPairing ?? []).map((r, l) => `${q.linkLeft?.[l]}↔${q.linkRight?.[r]}`).join("  ");
    const al = this.wrapTextCanvas(ctx, `正确答案：${answerText}`, w - 24, 2);
    al.forEach((line, i) => ctx.fillText(line, x + 12, ay + 8 + i * 14));
    ctx.restore();

    // 解析
    ctx.save();
    const ey = ay + 64;
    roundRect(ctx, x, ey, w, h - 114, 8);
    ctx.fillStyle = result.correct ? "rgba(26,214,112,0.08)" : "rgba(229,53,59,0.08)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = result.correct ? withAlpha("#1AD670", 0.3) : withAlpha("#E5353B", 0.3);
    ctx.stroke();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = result.correct ? "#1AD670" : "#FF8A8F";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("💡 解析", x + 12, ey + 8);
    ctx.font = `500 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    const el = this.wrapTextCanvas(ctx, q.explain, w - 24, 8);
    el.forEach((line, i) => ctx.fillText(line, x + 12, ey + 26 + i * 15));
    ctx.restore();
  }

  /** 复盘阶段 */
  private drawDetectiveSummary(ctx: CanvasRenderingContext2D, s: FBHudDetectiveState): void {
    const runner = this.engine?.getDetectiveRunner();
    if (!runner) return;
    const c = runner.getCase();
    const solved = s.caseSolved;
    this.drawDetectiveTopBar(ctx, "🔍 案件复盘 · 真相还原", `推理得分 ${s.reasoningScore} · ${solved ? "✅ 破案" : "❌ 未破案"}`, solved ? "#1AD670" : "#E5353B");

    // 结果横幅
    ctx.save();
    ctx.font = `900 20px ${Theme.fonts.display}`;
    ctx.fillStyle = solved ? "#1AD670" : "#E5353B";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = solved ? "#1AD670" : "#E5353B";
    ctx.shadowBlur = 12;
    ctx.fillText(solved ? "🏆 破案成功！" : "📋 继续努力", CANVAS_W / 2, 52);
    ctx.shadowBlur = 0;
    if (s.endingDesc) {
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
      ctx.fillText(s.endingDesc, CANVAS_W / 2, 80);
    }
    ctx.restore();

    // 时间线卡片
    ctx.save();
    const tx = 16, ty = 102, tw = CANVAS_W - 32, th = 200;
    roundRect(ctx, tx, ty, tw, th, 10);
    ctx.fillStyle = "rgba(10,25,41,0.7)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = withAlpha("#00E5FF", 0.3);
    ctx.stroke();
    ctx.font = `800 12px ${Theme.fonts.display}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("📅 诈骗剧本时间线", tx + 12, ty + 10);
    ctx.font = `500 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
    const tl = c.caseSummary.timeline;
    const maxLines = Math.floor((th - 30) / 14);
    tl.slice(0, maxLines).forEach((line, i) => {
      const wl = this.wrapTextCanvas(ctx, line, tw - 28, 1);
      ctx.fillText(wl[0] ?? "", tx + 12, ty + 30 + i * 14);
    });
    ctx.restore();

    // 心理弱点 + 教训
    ctx.save();
    const py = 310, pw = CANVAS_W - 32, ph = 64;
    roundRect(ctx, 16, py, pw, ph, 8);
    ctx.fillStyle = "rgba(255,214,102,0.08)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha("#FFD666", 0.3);
    ctx.stroke();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const psychLabels = c.caseSummary.psychology.map((p) => PSYCHOLOGY_LABELS[p] ?? p).join("、");
    ctx.fillText(`🎯 心理弱点：${psychLabels}`, 28, py + 8);
    ctx.font = `500 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    const ll = this.wrapTextCanvas(ctx, `💡 核心教训：${c.caseSummary.lesson}`, pw - 24, 2);
    ll.forEach((line, i) => ctx.fillText(line, 28, py + 26 + i * 14));
    ctx.restore();

    // 归档按钮
    const btnR = this.getDetectiveBtnRect("primary");
    this.drawV5ActionButton(ctx, btnR, s.stage === "archived" ? "✓ 已归档" : "📁 归档结案 →", s.stage === "archived" ? "rgba(122,143,176,0.6)" : "#1AD670", this.pressedV5Btn === "dtPrimary", s.stage === "archived");
  }

  /** 侦探按钮矩形 */
  private getDetectiveBtnRect(id: "primary"): Rect {
    if (id === "primary") return { x: 16, y: CANVAS_H - 64, w: CANVAS_W - 32, h: 52 };
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  /** 侦探推理选项矩形（垂直列表） */
  private getDetectiveOptionRects(count: number, startY: number): Rect[] {
    const rects: Rect[] = [];
    const gap = 8;
    const w = CANVAS_W - 32;
    const h = Math.min(50, (CANVAS_H - 76 - startY - (count - 1) * gap) / count);
    for (let i = 0; i < count; i++) {
      rects.push({ x: 16, y: startY + i * (h + gap), w, h });
    }
    return rects;
  }

  /** 侦探推理选项触摸检测 */
  private getDetectiveOptionAt(lx: number, ly: number, count: number, startY: number): number {
    const rects = this.getDetectiveOptionRects(count, startY);
    for (let i = 0; i < rects.length; i++) {
      if (hitTest(lx, ly, rects[i])) return i;
    }
    return -1;
  }

  /** 侦探模式触摸处理 */
  private handleDetectiveTouch(type: "start" | "move" | "end", lx: number, ly: number, s: FBHudDetectiveState): boolean {
    const runner = this.engine?.getDetectiveRunner();
    if (!runner) return false;

    if (s.stage === "briefing") {
      const btnR = this.getDetectiveBtnRect("primary");
      if (type === "start" && hitTest(lx, ly, btnR)) { this.pressedV5Btn = "dtPrimary"; return true; }
      if (type === "end" && this.pressedV5Btn === "dtPrimary") {
        this.pressedV5Btn = null;
        if (hitTest(lx, ly, btnR)) {
          this.engine?.enterEvidenceStage();
          playSfx("click");
          vibrateShort();
          return true;
        }
      }
      return false;
    }

    if (s.stage === "evidence") {
      const c = runner.getCase();
      const evCount = c.evidences.length;
      const evH = Math.min(70, (368 - (evCount - 1) * 6) / evCount);
      // 证据列表
      if (type === "start") {
        for (let i = 0; i < evCount; i++) {
          const r = { x: 16, y: 56 + i * (evH + 6), w: 230, h: evH };
          if (hitTest(lx, ly, r)) { this.pressedV5Btn = `dtEv${i}`; return true; }
        }
        const btnR = this.getDetectiveBtnRect("primary");
        if (hitTest(lx, ly, btnR)) { this.pressedV5Btn = "dtPrimary"; return true; }
      } else if (type === "end") {
        const pressed = this.pressedV5Btn;
        this.pressedV5Btn = null;
        if (pressed && pressed.startsWith("dtEv")) {
          const idx = Number(pressed.slice(4));
          if (!Number.isNaN(idx) && idx < evCount) {
            const r = { x: 16, y: 56 + idx * (evH + 6), w: 230, h: evH };
            if (hitTest(lx, ly, r)) {
              this.engine?.selectDetectiveEvidence(c.evidences[idx].id);
              playSfx("click");
              vibrateShort();
              return true;
            }
          }
        }
        if (pressed === "dtPrimary") {
          const btnR = this.getDetectiveBtnRect("primary");
          if (hitTest(lx, ly, btnR)) {
            this.engine?.enterReasoningStage();
            playSfx("good");
            vibrateShort();
            return true;
          }
        }
      }
      return false;
    }

    if (s.stage === "reasoning") {
      const q = runner.getCurrentQuestion();
      if (!q) return false;
      const answered = runner.getLastAnswerResult() !== null;
      const optStartY = 130;

      if (answered) {
        // 只响应"下一题"按钮
        const btnR = this.getDetectiveBtnRect("primary");
        if (type === "start" && hitTest(lx, ly, btnR)) { this.pressedV5Btn = "dtPrimary"; return true; }
        if (type === "end" && this.pressedV5Btn === "dtPrimary") {
          this.pressedV5Btn = null;
          if (hitTest(lx, ly, btnR)) {
            // 重置答题中间态
            this.detectiveMultiSel = [];
            this.detectiveSortSeq = [];
            this.detectiveLinkPairs = [];
            this.detectiveLinkSelLeft = null;
            this.engine?.nextDetectiveQuestion();
            playSfx("click");
            vibrateShort();
            return true;
          }
        }
        return false;
      }

      // 未答题：处理选项
      if (q.kind === "single") {
        const idx = this.getDetectiveOptionAt(lx, ly, q.options.length, optStartY);
        if (type === "start" && idx >= 0) { this.pressedV5Btn = `dtOpt${idx}`; return true; }
        if (type === "end") {
          const pressed = this.pressedV5Btn;
          this.pressedV5Btn = null;
          if (pressed && pressed.startsWith("dtOpt")) {
            const pi = Number(pressed.slice(5));
            if (pi === idx && idx >= 0) {
              this.engine?.answerDetectiveQuestion(idx);
              playSfx("click");
              vibrateShort();
              return true;
            }
          }
        }
      } else if (q.kind === "multi") {
        const idx = this.getDetectiveOptionAt(lx, ly, q.options.length, optStartY);
        if (type === "start" && idx >= 0) { this.pressedV5Btn = `dtOpt${idx}`; return true; }
        if (type === "end") {
          const pressed = this.pressedV5Btn;
          this.pressedV5Btn = null;
          // 提交按钮
          const btnR = this.getDetectiveBtnRect("primary");
          if (pressed === "dtPrimary" && hitTest(lx, ly, btnR)) {
            if (this.detectiveMultiSel.length > 0) {
              this.engine?.answerDetectiveQuestion([...this.detectiveMultiSel]);
              playSfx("click");
              vibrateShort();
              return true;
            }
          }
          // 选项切换
          if (pressed && pressed.startsWith("dtOpt")) {
            const pi = Number(pressed.slice(5));
            if (pi === idx && idx >= 0) {
              const sel = this.detectiveMultiSel.indexOf(idx);
              if (sel >= 0) this.detectiveMultiSel.splice(sel, 1);
              else this.detectiveMultiSel.push(idx);
              playSfx("click");
              vibrateShort();
              return true;
            }
          }
        }
        // 提交按钮
        if (type === "start") {
          const btnR = this.getDetectiveBtnRect("primary");
          if (hitTest(lx, ly, btnR) && this.detectiveMultiSel.length > 0) { this.pressedV5Btn = "dtPrimary"; return true; }
        }
      } else if (q.kind === "sort") {
        const idx = this.getDetectiveOptionAt(lx, ly, q.options.length, optStartY);
        if (type === "start" && idx >= 0) { this.pressedV5Btn = `dtOpt${idx}`; return true; }
        if (type === "end") {
          const pressed = this.pressedV5Btn;
          this.pressedV5Btn = null;
          // 提交按钮
          const btnR = this.getDetectiveBtnRect("primary");
          if (pressed === "dtPrimary" && hitTest(lx, ly, btnR)) {
            if (this.detectiveSortSeq.length === q.options.length) {
              this.engine?.answerDetectiveQuestion([...this.detectiveSortSeq]);
              playSfx("click");
              vibrateShort();
              return true;
            }
          }
          // 选项点击：加入序列（如已存在则移除其后的所有）
          if (pressed && pressed.startsWith("dtOpt")) {
            const pi = Number(pressed.slice(5));
            if (pi === idx && idx >= 0) {
              const exist = this.detectiveSortSeq.indexOf(idx);
              if (exist >= 0) {
                this.detectiveSortSeq = this.detectiveSortSeq.slice(0, exist);
              } else {
                this.detectiveSortSeq.push(idx);
              }
              playSfx("click");
              vibrateShort();
              return true;
            }
          }
        }
        if (type === "start") {
          const btnR = this.getDetectiveBtnRect("primary");
          if (hitTest(lx, ly, btnR) && this.detectiveSortSeq.length === q.options.length) { this.pressedV5Btn = "dtPrimary"; return true; }
        }
      } else if (q.kind === "link") {
        const leftCount = q.linkLeft?.length ?? 0;
        const rightCount = q.linkRight?.length ?? 0;
        const w = CANVAS_W - 32;
        const colW = (w - 24) / 2;
        const h = CANVAS_H - 130 - 76;
        const itemH = Math.min(48, (h - 16) / Math.max(leftCount, rightCount) - 6);
        const leftX = 24, rightX = 24 + colW + 8;

        if (type === "start") {
          // 左列
          for (let i = 0; i < leftCount; i++) {
            const r = { x: leftX, y: 130 + i * (itemH + 6), w: colW, h: itemH };
            if (hitTest(lx, ly, r)) { this.pressedV5Btn = `dtLinkL${i}`; return true; }
          }
          // 右列
          for (let i = 0; i < rightCount; i++) {
            const r = { x: rightX, y: 130 + i * (itemH + 6), w: colW, h: itemH };
            if (hitTest(lx, ly, r)) { this.pressedV5Btn = `dtLinkR${i}`; return true; }
          }
          // 提交
          const btnR = this.getDetectiveBtnRect("primary");
          if (hitTest(lx, ly, btnR) && this.detectiveLinkPairs.length === leftCount) { this.pressedV5Btn = "dtPrimary"; return true; }
        } else if (type === "end") {
          const pressed = this.pressedV5Btn;
          this.pressedV5Btn = null;
          // 提交
          const btnR = this.getDetectiveBtnRect("primary");
          if (pressed === "dtPrimary" && hitTest(lx, ly, btnR)) {
            if (this.detectiveLinkPairs.length === leftCount) {
              this.engine?.answerDetectiveQuestion(this.detectiveLinkPairs.map(([, r]) => r));
              playSfx("click");
              vibrateShort();
              return true;
            }
          }
          // 左列选择
          if (pressed && pressed.startsWith("dtLinkL")) {
            const li = Number(pressed.slice(7));
            if (!Number.isNaN(li) && li < leftCount) {
              const r = { x: leftX, y: 130 + li * (itemH + 6), w: colW, h: itemH };
              if (hitTest(lx, ly, r)) {
                // 移除已有的配对
                this.detectiveLinkPairs = this.detectiveLinkPairs.filter(([l]) => l !== li);
                this.detectiveLinkSelLeft = li;
                playSfx("click");
                vibrateShort();
                return true;
              }
            }
          }
          // 右列配对
          if (pressed && pressed.startsWith("dtLinkR") && this.detectiveLinkSelLeft !== null) {
            const ri = Number(pressed.slice(7));
            if (!Number.isNaN(ri) && ri < rightCount) {
              const r = { x: rightX, y: 130 + ri * (itemH + 6), w: colW, h: itemH };
              if (hitTest(lx, ly, r)) {
                // 移除右列已有配对
                this.detectiveLinkPairs = this.detectiveLinkPairs.filter(([, rr]) => rr !== ri);
                this.detectiveLinkPairs.push([this.detectiveLinkSelLeft, ri]);
                this.detectiveLinkSelLeft = null;
                playSfx("click");
                vibrateShort();
                return true;
              }
            }
          }
        }
      }
      return false;
    }

    if (s.stage === "summary" || s.stage === "archived") {
      const btnR = this.getDetectiveBtnRect("primary");
      if (type === "start" && hitTest(lx, ly, btnR) && s.stage === "summary") { this.pressedV5Btn = "dtPrimary"; return true; }
      if (type === "end" && this.pressedV5Btn === "dtPrimary") {
        this.pressedV5Btn = null;
        if (hitTest(lx, ly, btnR) && s.stage === "summary") {
          this.engine?.archiveDetectiveCase();
          playSfx("achievement");
          vibrateShort();
          return true;
        }
      }
      return false;
    }

    return false;
  }

  /** 绘制双人对战玩家血量条 */
  private drawVSPlayerBar(ctx: CanvasRenderingContext2D, p: FBHudVSState["p1"], x: number, y: number, leftAlign: boolean): void {
    const w = 360;
    const h = 52;
    ctx.save();
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = "rgba(10,25,41,0.7)";
    ctx.fill();
    // v5 视觉升级：当前回合玩家边光脉动（呼吸 + 强化 shadow）
    const turnPulse = p.isTurn ? (0.6 + ((Math.sin(this.t * 4) + 1) / 2) * 0.4) : 0;
    ctx.lineWidth = p.isTurn ? 2.5 : 2;
    ctx.strokeStyle = p.isTurn ? p.color : withAlpha(p.color, 0.3);
    if (p.isTurn) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8 + turnPulse * 8;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // v5 视觉升级：当前回合玩家顶部高亮条
    if (p.isTurn) {
      ctx.fillStyle = withAlpha(p.color, 0.35 * turnPulse);
      ctx.fillRect(x + 2, y + 2, w - 4, 3);
    }
    // 头像 + 名字
    ctx.font = `24px ${Theme.fonts.display}`;
    ctx.fillStyle = p.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(p.icon, x + 10, y + h / 2);
    ctx.font = `800 14px ${Theme.fonts.display}`;
    ctx.fillStyle = p.isTurn ? p.color : withAlpha(Theme.colors.ink.DEFAULT, 0.7);
    ctx.fillText(p.name, x + 40, y + 16);
    // HP 数字
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(`${p.hp}/${p.maxHp}`, x + 40, y + 36);
    // HP 条
    const barX = x + 100;
    const barW = w - 110;
    const barH = 10;
    const barY = y + h / 2 - barH / 2;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(ctx, barX, barY, barW, barH, 5);
    ctx.fill();
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    if (hpRatio > 0) {
      // v5 视觉升级：HP 条渐变 + 当前回合发光
      const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      hpGrad.addColorStop(0, p.color);
      hpGrad.addColorStop(1, withAlpha(p.color, 0.7));
      ctx.fillStyle = hpGrad;
      if (p.isTurn) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
      }
      roundRect(ctx, barX, barY, Math.max(2, barW * hpRatio), barH, 5);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /** 通用 v5 操作按钮 */
  private drawV5ActionButton(ctx: CanvasRenderingContext2D, r: Rect, text: string, color: string, pressed: boolean, muted = false): void {
    ctx.save();
    if (pressed) ctx.translate(0, 2);
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, muted ? "rgba(60,70,90,0.3)" : withAlpha(color, 0.18));
    g.addColorStop(1, "rgba(10,25,41,0.85)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = muted ? "rgba(122,143,176,0.5)" : color;
    if (!muted && pressed) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = muted ? withAlpha(Theme.colors.ink.DEFAULT, 0.7) : color;
    ctx.font = `800 15px ${Theme.fonts.display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
    ctx.restore();
  }

  /**
   * v5 视觉升级：动态霓虹边光
   * - 基于当前模式色（aiBattle=品红 / versus=橙 / deconstruct=紫）
   * - 脉动呼吸 + 四角括号强化"赛博终端"感
   * - HUD 红旗等级 ≥4 时叠加红色脉冲（压迫感）
   */
  private drawV5NeonEdge(ctx: CanvasRenderingContext2D): void {
    const hud = this.hud;
    if (!hud) return;
    let color = "#00E5FF";
    let pulseStrength = 0.35;
    if (hud.aiDialog) {
      color = MODE_COLORS.aiBattle;
      // 红旗等级越高，压迫感越强
      const rf = hud.aiDialog.currentRedFlag ?? 0;
      if (rf >= 4) { color = "#E5353B"; pulseStrength = 0.55; }
      else if (rf >= 2) { pulseStrength = 0.45; }
    } else if (hud.versus) {
      color = MODE_COLORS.versus;
      pulseStrength = 0.45;
    } else if (hud.deconstruct) {
      color = MODE_COLORS.deconstruct;
      // 拆解揭示时短暂金光
      if (hud.deconstruct.deconstructRevealed) { color = "#FFD666"; pulseStrength = 0.5; }
    } else if (hud.detective) {
      color = MODE_COLORS.detective;
      // 破局点发现时金光，复盘时绿光
      if (hud.detective.breakingPointFound) { color = "#FFD666"; pulseStrength = 0.5; }
      if (hud.detective.stage === "summary") { color = "#1AD670"; pulseStrength = 0.45; }
    }
    const pulse = (Math.sin(this.t * 3) + 1) / 2; // 0..1
    const alpha = pulseStrength * (0.55 + pulse * 0.45);
    ctx.save();
    // 四角括号 + 边缘渐变光晕
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withAlpha(color, alpha);
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + pulse * 6;
    const inset = 4;
    const len = 28;
    // 左上
    ctx.beginPath();
    ctx.moveTo(inset, inset + len); ctx.lineTo(inset, inset); ctx.lineTo(inset + len, inset);
    // 右上
    ctx.moveTo(CANVAS_W - inset - len, inset); ctx.lineTo(CANVAS_W - inset, inset); ctx.lineTo(CANVAS_W - inset, inset + len);
    // 左下
    ctx.moveTo(inset, CANVAS_H - inset - len); ctx.lineTo(inset, CANVAS_H - inset); ctx.lineTo(inset + len, CANVAS_H - inset);
    // 右下
    ctx.moveTo(CANVAS_W - inset - len, CANVAS_H - inset); ctx.lineTo(CANVAS_W - inset, CANVAS_H - inset); ctx.lineTo(CANVAS_W - inset, CANVAS_H - inset - len);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 边缘内发光（顶部 + 底部细条）
    const barH = 2;
    const grad = ctx.createLinearGradient(0, 0, 0, barH * 4);
    grad.addColorStop(0, withAlpha(color, alpha * 0.7));
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, barH * 4);
    const gradB = ctx.createLinearGradient(0, CANVAS_H, 0, CANVAS_H - barH * 4);
    gradB.addColorStop(0, withAlpha(color, alpha * 0.7));
    gradB.addColorStop(1, "transparent");
    ctx.fillStyle = gradB;
    ctx.fillRect(0, CANVAS_H - barH * 4, CANVAS_W, barH * 4);
    ctx.restore();
  }

  /** v5 模式触摸处理总入口 */
  private handleV5Touch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const cw = this.engineCanvas?.width ?? CANVAS_W;
    const ch = this.engineCanvas?.height ?? CANVAS_H;
    const local = this.director.screenToLocal(x, y, cw, ch);
    const lx = local.x;
    const ly = local.y;
    const hud = this.hud;
    if (!hud) return false;

    if (hud.aiDialog) {
      const s = hud.aiDialog;
      if (s.ended) return false;
      const rects = this.getAIBattleChoiceRects(s.currentChoices.length);
      if (type === "start") {
        for (let i = 0; i < rects.length; i++) {
          if (hitTest(lx, ly, rects[i])) {
            this.pressedV5Btn = `ai${i}`;
            return true;
          }
        }
      } else if (type === "end") {
        const pressed = this.pressedV5Btn;
        this.pressedV5Btn = null;
        if (pressed && pressed.startsWith("ai")) {
          const idx = Number(pressed.slice(2));
          if (!Number.isNaN(idx) && idx < rects.length && hitTest(lx, ly, rects[idx])) {
            this.engine?.chooseAIDialog(idx);
            playSfx("click");
            vibrateShort();
            this.triggerAIBattleFx();
            return true;
          }
        }
      }
      return false;
    }

    if (hud.deconstruct) {
      const s = hud.deconstruct;
      const nextR = this.getDeconstructBtnRect("next");
      const skipR = this.getDeconstructBtnRect("skip");
      if (type === "start") {
        if (hitTest(lx, ly, nextR)) { this.pressedV5Btn = "dcNext"; return true; }
        if (!s.summaryShown && hitTest(lx, ly, skipR)) { this.pressedV5Btn = "dcSkip"; return true; }
      } else if (type === "end") {
        const pressed = this.pressedV5Btn;
        this.pressedV5Btn = null;
        if (pressed === "dcNext" && hitTest(lx, ly, nextR)) {
          this.engine?.advanceDeconstruct();
          playSfx("click");
          vibrateShort();
          this.triggerDeconstructFx();
          return true;
        }
        if (pressed === "dcSkip" && hitTest(lx, ly, skipR)) {
          this.engine?.skipDeconstructToEnd();
          playSfx("click");
          vibrateShort();
          this.triggerDeconstructFx();
          return true;
        }
      }
      return false;
    }

    if (hud.versus) {
      const s = hud.versus;
      if (s.ended) return false;
      const q = s.currentQuestion;
      if (!q) return false;
      const rects = this.getVersusOptionRects(q.options.length);
      if (type === "start") {
        for (let i = 0; i < rects.length; i++) {
          if (hitTest(lx, ly, rects[i])) {
            this.pressedV5Btn = `vs${i}`;
            return true;
          }
        }
      } else if (type === "end") {
        const pressed = this.pressedV5Btn;
        this.pressedV5Btn = null;
        if (pressed && pressed.startsWith("vs")) {
          const idx = Number(pressed.slice(2));
          if (!Number.isNaN(idx) && idx < rects.length && hitTest(lx, ly, rects[idx])) {
            this.engine?.answerVersus(idx);
            playSfx("click");
            vibrateShort();
            this.triggerVersusFx();
            return true;
          }
        }
      }
      return false;
    }

    if (hud.detective) {
      return this.handleDetectiveTouch(type, lx, ly, hud.detective);
    }

    return false;
  }

  /**
   * v5 视觉升级：AI 对战屏幕级 FX
   * - 识破红旗：金色粒子爆发 + 冲击环 + "识破 +N" 飘字
   * - 错误选择：红色粒子 + 强震屏 + "⚠ 被识破" 飘字
   * - 结局：通关金光/失败红光大爆发
   */
  private triggerAIBattleFx(): void {
    const r = this.engine?.v5Result;
    if (!r || r.kind !== "aiBattle") return;
    const { cx, cy } = this.cardCenterScreen();
    if (r.ended) {
      // 结局：大爆发
      if (r.ending === "busted") {
        this.fx.burst(cx, cy, "#FFD666", 32, 340);
        this.fx.ring(cx, cy, "#FFD666", 160, 0.7);
        this.fx.popText(cx, cy - 60, "识破骗局！", { color: "#FFD666", size: 28, duration: 1.4, vy: -40 });
        this.fx.flash("#FFD666", 0.35, 0.5);
        this.fx.shake(0.7);
      } else {
        this.fx.burst(cx, cy, "#E5353B", 28, 300);
        this.fx.ring(cx, cy, "#E5353B", 140, 0.6);
        this.fx.popText(cx, cy - 60, "未能识破", { color: "#E5353B", size: 26, duration: 1.4, vy: -40 });
        this.fx.flash("#E5353B", 0.4, 0.5);
        this.fx.shake(0.9);
      }
      return;
    }
    if (r.bust) {
      // 识破红旗
      const gain = r.bustScoreDelta || 1;
      this.fx.burst(cx, cy, "#FFD666", 18, 260);
      this.fx.ring(cx, cy, "#FFD666", 110, 0.5);
      this.fx.popText(cx, cy - 40, `识破 +${gain}`, { color: "#FFD666", size: 22, duration: 0.9, vy: -55 });
      this.fx.flash("#FFD666", 0.18, 0.25);
      this.fx.shake(0.3);
    } else if (r.verdict === "wrong") {
      // 错误选择
      this.fx.burst(cx, cy, "#E5353B", 16, 240);
      this.fx.popText(cx, cy - 30, "⚠ 误判", { color: "#E5353B", size: 20, duration: 0.9, vy: -50 });
      this.fx.flash("#E5353B", 0.3, 0.3);
      this.fx.shake(0.6);
    }
  }

  /**
   * v5 视觉升级：骗局拆解屏幕级 FX
   * - 显示拆解：金色冲击环 + "💡 拆解" 飘字
   * - 高红旗对白：红色弱闪 + "⚠ 红旗 N" 飘字
   * - 显示总结：金光大爆发 + "拆解完成" 飘字
   */
  private triggerDeconstructFx(): void {
    const r = this.engine?.v5Result;
    if (!r || r.kind !== "deconstruct") return;
    const { cx, cy } = this.cardCenterScreen();
    if (r.ended) {
      this.fx.burst(cx, cy, "#1AD670", 24, 280);
      this.fx.ring(cx, cy, "#1AD670", 140, 0.6);
      this.fx.popText(cx, cy - 50, "拆解完成", { color: "#1AD670", size: 24, duration: 1.2, vy: -45 });
      this.fx.flash("#1AD670", 0.3, 0.5);
      this.fx.shake(0.5);
      return;
    }
    if (r.action === "showDeconstruct") {
      this.fx.burst(cx, cy, "#FFD666", 14, 200);
      this.fx.ring(cx, cy, "#FFD666", 100, 0.45);
      this.fx.popText(cx, cy - 30, "💡 拆解", { color: "#FFD666", size: 18, duration: 0.8, vy: -50 });
      this.fx.flash("#FFD666", 0.15, 0.25);
    } else if (r.action === "showSummary") {
      this.fx.burst(cx, cy, "#1AD670", 22, 280);
      this.fx.ring(cx, cy, "#1AD670", 130, 0.6);
      this.fx.popText(cx, cy - 40, "拆解总结", { color: "#1AD670", size: 22, duration: 1.0, vy: -50 });
      this.fx.flash("#1AD670", 0.28, 0.4);
      this.fx.shake(0.5);
    } else if (r.action === "showLine" && r.lineRedFlag >= 4) {
      // 高红旗对白：警示
      this.fx.popText(cx, cy - 30, `⚠ 红旗 ${r.lineRedFlag}/5`, { color: "#E5353B", size: 18, duration: 0.9, vy: -45 });
      this.fx.flash("#E5353B", 0.18, 0.3);
      this.fx.shake(0.35);
    }
  }

  /**
   * v5 视觉升级：双人对战屏幕级 FX
   * - 答对攻击：玩家色粒子爆发 + 冲击环 + "-N HP" 飘字指向对手
   * - 答错自伤：红色粒子 + "自伤 -N" 飘字
   * - 结局：金光大爆发 + "获胜" 飘字
   */
  private triggerVersusFx(): void {
    const r = this.engine?.v5Result;
    if (!r || r.kind !== "versus") return;
    const { cx, cy } = this.cardCenterScreen();
    const hud = this.hud;
    if (r.ended) {
      const winnerName = r.ending === "P1" ? (hud?.versus?.p1.name ?? "P1")
        : r.ending === "P2" ? (hud?.versus?.p2.name ?? "P2")
        : "平局";
      const winColor = r.ending === "P1" ? (hud?.versus?.p1.color ?? "#FFB020")
        : r.ending === "P2" ? (hud?.versus?.p2.color ?? "#FFB020")
        : "#FFD666";
      this.fx.burst(cx, cy, winColor, 32, 340);
      this.fx.ring(cx, cy, winColor, 160, 0.7);
      this.fx.popText(cx, cy - 60, `${winnerName} 获胜！`, { color: winColor, size: 28, duration: 1.4, vy: -40 });
      this.fx.flash(winColor, 0.35, 0.5);
      this.fx.shake(0.7);
      return;
    }
    if (r.correct) {
      // 攻击命中对手
      const targetColor = r.target === "P1" ? (hud?.versus?.p1.color ?? "#FFB020") : (hud?.versus?.p2.color ?? "#FFB020");
      const targetName = r.target === "P1" ? (hud?.versus?.p1.name ?? "P1") : (hud?.versus?.p2.name ?? "P2");
      // 受击方位置（左/右半屏）
      const tx = r.target === "P1" ? cx - 120 : cx + 120;
      this.fx.burst(tx, cy, targetColor, 18, 260);
      this.fx.ring(tx, cy, targetColor, 110, 0.5);
      this.fx.popText(tx, cy - 40, `-${r.damage} HP`, { color: targetColor, size: 22, duration: 0.9, vy: -55 });
      this.fx.shake(0.4);
    } else {
      // 答错自伤
      const sx = r.target === "P1" ? cx - 120 : cx + 120;
      this.fx.burst(sx, cy, "#E5353B", 16, 240);
      this.fx.popText(sx, cy - 30, `自伤 -${r.damage}`, { color: "#E5353B", size: 20, duration: 0.9, vy: -50 });
      this.fx.flash("#E5353B", 0.25, 0.3);
      this.fx.shake(0.5);
    }
  }

  /** 难度选择界面（ready 状态，画布坐标） */
  private drawDifficultySelect(ctx: CanvasRenderingContext2D): void {
    // 半透明遮罩
    ctx.save();
    ctx.fillStyle = "rgba(7,14,31,0.85)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();

    // 返回按钮（左上角，回到模式选择）
    this.drawBackButton(ctx, this.getBackBtnRect());

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
    ctx.fillText(`SELECT DIFFICULTY · ${FB_MODE_ICONS[this.selectedMode]} ${FB_MODE_LABELS[this.selectedMode]}`, CANVAS_W / 2, 152);
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

  /**
   * v3 Phase 3.4：Boss 战背景（动态首脑剪影 + 主题色光晕）
   * 屏幕坐标系绘制，覆盖在 engine canvas 之上但半透明，不遮挡卡片与选项
   * - 全屏主题色径向光晕（红紫渐变，脉动）
   * - 右上角 Boss 剪影（几何造型 + 浮动动画 + 红眼）
   * - 屏幕边缘"邪恶能量"粒子飘动
   * - 顶部 Boss 名称 + HP 条（若引擎未绘制）
   */
  private drawBossBackground(ctx: CanvasRenderingContext2D, screenW: number, screenH: number, hud: FBHud): void {
    const bossName = hud.bossName ?? "诈骗首脑";
    const bossHp = hud.bossHp ?? 0;
    const bossMaxHp = hud.bossMaxHp ?? 1;
    const hpRatio = Math.max(0, Math.min(1, bossHp / bossMaxHp));

    // 主题色：红紫渐变（危险+阴谋）
    const colorRed = "#E5353B";
    const colorPurple = "#B388FF";
    const colorGold = "#FFD666";

    // ===== 1. 全屏径向光晕（从右上角扩散，脉动） =====
    const pulse = 0.6 + Math.sin(this.t * 2) * 0.4;
    ctx.save();
    const glowCx = screenW * 0.85;
    const glowCy = screenH * 0.2;
    const glowR = Math.max(screenW, screenH) * 0.7;
    const glow = ctx.createRadialGradient(glowCx, glowCy, 0, glowCx, glowCy, glowR);
    glow.addColorStop(0, withAlpha(colorRed, 0.18 * pulse));
    glow.addColorStop(0.4, withAlpha(colorPurple, 0.08 * pulse));
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    // ===== 2. Boss 剪影（右上角，几何造型 + 浮动 + 红眼） =====
    const bobY = Math.sin(this.t * 1.5) * 6;
    const silhouetteCx = screenW - 100;
    const silhouetteCy = 130 + bobY;
    const silhouetteScale = Math.min(screenW, screenH) / 480;

    ctx.save();
    ctx.globalAlpha = 0.55;
    // 头部（圆形）
    const headR = 36 * silhouetteScale;
    const headGrad = ctx.createRadialGradient(silhouetteCx, silhouetteCy - 10, 0, silhouetteCx, silhouetteCy, headR);
    headGrad.addColorStop(0, withAlpha(colorPurple, 0.85));
    headGrad.addColorStop(1, withAlpha(colorRed, 0.6));
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(silhouetteCx, silhouetteCy, headR, 0, Math.PI * 2);
    ctx.fill();
    // 边框光晕
    ctx.lineWidth = 2;
    ctx.strokeStyle = withAlpha(colorRed, 0.7 * pulse);
    ctx.shadowColor = colorRed;
    ctx.shadowBlur = 16 * pulse;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 肩膀（梯形）
    ctx.fillStyle = withAlpha(colorPurple, 0.5);
    ctx.beginPath();
    const shoulderY = silhouetteCy + headR * 0.8;
    const shoulderW = headR * 2.4;
    ctx.moveTo(silhouetteCx - shoulderW / 2, shoulderY + 30 * silhouetteScale);
    ctx.lineTo(silhouetteCx - headR * 0.7, shoulderY);
    ctx.lineTo(silhouetteCx + headR * 0.7, shoulderY);
    ctx.lineTo(silhouetteCx + shoulderW / 2, shoulderY + 30 * silhouetteScale);
    ctx.closePath();
    ctx.fill();

    // 红眼（双眼，闪烁）
    const eyeBlink = 0.5 + Math.sin(this.t * 6) * 0.5;
    ctx.fillStyle = withAlpha("#FF0050", eyeBlink);
    ctx.shadowColor = "#FF0050";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(silhouetteCx - 10 * silhouetteScale, silhouetteCy - 4, 3, 0, Math.PI * 2);
    ctx.arc(silhouetteCx + 10 * silhouetteScale, silhouetteCy - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // ===== 3. Boss 名称 + HP 条（顶部中央，覆盖在引擎之上） =====
    const barW = Math.min(280, screenW * 0.4);
    const barH = 8;
    const barX = (screenW - barW) / 2;
    const barY = 56;
    ctx.save();
    // 名称
    ctx.font = `900 14px ${Theme.fonts.display}`;
    ctx.fillStyle = colorRed;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = colorRed;
    ctx.shadowBlur = 10 * pulse;
    ctx.fillText(`☠ ${bossName}`, screenW / 2, barY - 18);
    ctx.shadowBlur = 0;
    // HP 条背景
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    // HP 条填充（HP 越低越红越亮）
    const hpColor = hpRatio > 0.5 ? colorPurple : hpRatio > 0.25 ? colorGold : colorRed;
    ctx.fillStyle = hpColor;
    ctx.shadowColor = hpColor;
    ctx.shadowBlur = 8;
    roundRect(ctx, barX, barY, barW * hpRatio, barH, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    // HP 条边框
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha(colorRed, 0.6);
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.stroke();
    // HP 文字
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${bossHp} / ${bossMaxHp}`, screenW / 2, barY + barH / 2 + 1);
    ctx.restore();

    // ===== 4. 屏幕边缘"邪恶能量"粒子（随机闪烁红紫小点） =====
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const seed = i * 1.7;
      const px = (Math.sin(this.t * 0.8 + seed) * 0.5 + 0.5) * screenW;
      const py = (Math.cos(this.t * 0.6 + seed * 2) * 0.5 + 0.5) * screenH;
      const pAlpha = (Math.sin(this.t * 3 + seed * 5) * 0.5 + 0.5) * 0.6;
      const pColor = i % 2 === 0 ? colorRed : colorPurple;
      ctx.fillStyle = withAlpha(pColor, pAlpha);
      ctx.shadowColor = pColor;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // ===== 5. 屏幕边缘暗角（红色压迫感，叠加在心跳边缘之上） =====
    ctx.save();
    const vignette = ctx.createRadialGradient(screenW / 2, screenH / 2, screenH * 0.3, screenW / 2, screenH / 2, screenH * 0.7);
    vignette.addColorStop(0, "transparent");
    vignette.addColorStop(1, withAlpha(colorRed, 0.18 * pulse));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, screenW, screenH);
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

  /**
   * v3 Phase 3.4：段位升级仪式渲染（全屏覆盖层）
   * - 全屏金光径向渐变（淡入淡出）
   * - 中央大字：▲ 段位名（缩放+发光动画）
   * - 副标题：RANK UP! Lv.N
   * - 持续彩屑粒子（持续整个仪式时长）
   * - 屏幕边缘金色光线放射
   */
  private drawRankCeremony(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.rankCeremony) return;
    const c = this.rankCeremony;
    const elapsed = this.t - c.startT;
    const totalDur = c.until - c.startT;
    const progress = Math.min(1, elapsed / totalDur);
    // 淡入淡出曲线：0-0.2 淡入，0.2-0.8 持续，0.8-1.0 淡出
    let alpha: number;
    if (progress < 0.2) alpha = progress / 0.2;
    else if (progress > 0.8) alpha = (1 - progress) / 0.2;
    else alpha = 1;
    alpha = Math.max(0, Math.min(1, alpha));

    const cx = screenW / 2;
    const cy = screenH / 2;
    const goldColor = "#FFD666";

    // ===== 1. 全屏金光径向渐变 =====
    ctx.save();
    const glowR = Math.max(screenW, screenH) * 0.8;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0, withAlpha(goldColor, 0.35 * alpha));
    glow.addColorStop(0.4, withAlpha(c.color, 0.15 * alpha));
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    // ===== 2. 屏幕边缘金色光线放射（8 道） =====
    ctx.save();
    ctx.translate(cx, cy);
    const rayLen = Math.max(screenW, screenH);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + this.t * 0.5;
      const rayWidth = 30 + Math.sin(this.t * 3 + i) * 10;
      ctx.save();
      ctx.rotate(angle);
      const rayG = ctx.createLinearGradient(0, 0, rayLen, 0);
      rayG.addColorStop(0, withAlpha(goldColor, 0.25 * alpha));
      rayG.addColorStop(0.5, withAlpha(goldColor, 0.08 * alpha));
      rayG.addColorStop(1, "transparent");
      ctx.fillStyle = rayG;
      ctx.beginPath();
      ctx.moveTo(0, -rayWidth / 2);
      ctx.lineTo(rayLen, -rayWidth / 8);
      ctx.lineTo(rayLen, rayWidth / 8);
      ctx.lineTo(0, rayWidth / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // ===== 3. 中央大字：▲ 段位名（缩放+发光） =====
    const scaleAnim = progress < 0.3
      ? 0.5 + (progress / 0.3) * 0.5 + Math.sin(progress * Math.PI * 3) * 0.05 // 入场弹性
      : 1.0 + Math.sin((progress - 0.3) * Math.PI * 4) * 0.03; // 持续微脉动
    ctx.save();
    ctx.translate(cx, cy - 20);
    ctx.scale(scaleAnim, scaleAnim);
    ctx.globalAlpha = alpha;
    // 描边
    ctx.font = `900 48px ${Theme.fonts.display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#0A1929";
    ctx.strokeText(`▲ ${c.name}`, 0, 0);
    // 填充
    ctx.fillStyle = goldColor;
    ctx.shadowColor = goldColor;
    ctx.shadowBlur = 24;
    ctx.fillText(`▲ ${c.name}`, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    // ===== 4. 副标题：RANK UP! Lv.N =====
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `700 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = c.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = c.color;
    ctx.shadowBlur = 12;
    ctx.fillText(`RANK UP! · Lv.${c.level}`, cx, cy + 30);
    ctx.shadowBlur = 0;
    ctx.restore();

    // ===== 5. 持续彩屑粒子（每帧生成几个，飘落） =====
    if (progress < 0.85) {
      const colors = ["#FFD666", "#00E5FF", c.color, "#FF7A1A", "#B388FF"];
      for (let i = 0; i < 3; i++) {
        const px = cx + (Math.random() - 0.5) * screenW * 0.6;
        const py = cy + (Math.random() - 0.5) * screenH * 0.4;
        ctx.save();
        const pColor = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillStyle = withAlpha(pColor, 0.8);
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 6;
        const pSize = 2 + Math.random() * 3;
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
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
    // ===== modeSelect 状态：模式选择层 =====
    if (this.gameState === "modeSelect") {
      return this.handleModeTouch(type, x, y);
    }
    // ===== ready 状态：难度选择 =====
    if (this.gameState === "ready") {
      return this.handleDifficultyTouch(type, x, y);
    }
    // ===== v5/v6 升级：新模式输入处理 =====
    if (this.gameState === "playing" && this.hud && (this.hud.aiDialog || this.hud.deconstruct || this.hud.versus || this.hud.detective)) {
      return this.handleV5Touch(type, x, y);
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
      // 返回按钮（回到模式选择）
      if (hitTest(local.x, local.y, this.getBackBtnRect())) {
        this.pressedBack = true;
        return true;
      }
      for (const def of DIFFICULTY_DEFS) {
        const r = this.getDifficultyRect(def.id);
        if (hitTest(local.x, local.y, r)) {
          this.pressedDifficulty = def.id;
          return true;
        }
      }
      return false;
    } else if (type === "end") {
      // 返回按钮释放
      if (this.pressedBack) {
        this.pressedBack = false;
        if (hitTest(local.x, local.y, this.getBackBtnRect())) {
          this.gameState = "modeSelect";
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      const pressed = this.pressedDifficulty;
      this.pressedDifficulty = null;
      if (pressed) {
        const r = this.getDifficultyRect(pressed);
        if (hitTest(local.x, local.y, r)) {
          this.engine?.setDifficulty(pressed);
          this.engine?.startMode("endless");
          this.gameState = "playing";
          playSfx("click");
          vibrateShort();
        }
      }
      return true;
    }
    return false;
  }

  /** v3 模式选择触摸处理（modeSelect 状态） */
  private handleModeTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const cw = this.engineCanvas?.width ?? CANVAS_W;
    const ch = this.engineCanvas?.height ?? CANVAS_H;
    const local = this.director.screenToLocal(x, y, cw, ch);
    if (type === "start") {
      // 返回按钮（回到 Hub）
      if (hitTest(local.x, local.y, this.getBackBtnRect())) {
        this.pressedBack = true;
        return true;
      }
      // v3 Phase 4：教育入口按钮
      for (const entry of EDU_ENTRIES) {
        const r = this.getEduBtnRect(entry.id);
        if (hitTest(local.x, local.y, r)) {
          this.pressedEdu = entry.id;
          return true;
        }
      }
      for (const mode of MODE_ORDER) {
        const locked = mode === "review" && this.lastWrongRecords.length === 0;
        if (locked) continue;
        const r = this.getModeRect(mode);
        if (hitTest(local.x, local.y, r)) {
          this.pressedMode = mode;
          return true;
        }
      }
      return false;
    } else if (type === "end") {
      // 返回按钮释放
      if (this.pressedBack) {
        this.pressedBack = false;
        if (hitTest(local.x, local.y, this.getBackBtnRect())) {
          this.director.replace(new HubScene(this.director), undefined, "slide");
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      // v3 Phase 4：教育入口按钮释放
      if (this.pressedEdu) {
        const id = this.pressedEdu;
        this.pressedEdu = null;
        const r = this.getEduBtnRect(id);
        if (hitTest(local.x, local.y, r)) {
          this.openEduScene(id);
        }
        return true;
      }
      const pressed = this.pressedMode;
      this.pressedMode = null;
      if (pressed) {
        const r = this.getModeRect(pressed);
        if (hitTest(local.x, local.y, r)) {
          this.startMode(pressed);
        }
      }
      return true;
    }
    return false;
  }

  /** v3 Phase 4：打开教育场景（图鉴 / 96110 通话器） */
  private openEduScene(id: "codex" | "hotline"): void {
    playSfx("click");
    vibrateShort();
    if (id === "codex") {
      this.director.push(new FBCodexScene(this.director), undefined, "slide");
    } else {
      this.director.push(new FBHotlineScene(this.director), undefined, "slide");
    }
  }

  /**
   * v3 启动指定游戏模式
   * - endless → 进入 ready 状态选难度
   * - story → 从存档读取下一个未通关关卡（全部通关则重玩第 1 关）
   * - speedrun / hardcore / daily → 直接启动
   * - review → 复用内存错题记录启动
   */
  private startMode(mode: FBGameMode): void {
    this.selectedMode = mode;
    if (mode === "endless") {
      // endless 仍需选难度
      this.gameState = "ready";
      playSfx("click");
      vibrateShort();
      return;
    }
    if (mode === "story") {
      // 找到第一个未通关的关卡
      const save = loadFBSave();
      const cleared = new Set(save.storyClearedStages);
      let stageIdx = 0;
      for (let i = 0; i < STORY_STAGES.length; i++) {
        if (!cleared.has(i)) { stageIdx = i; break; }
        if (i === STORY_STAGES.length - 1) stageIdx = 0; // 全通关则重玩第 1 关
      }
      this.lastStoryStageIdx = stageIdx;
      this.engine?.startMode("story", { storyStageIdx: stageIdx });
      this.gameState = "playing";
      playSfx("click");
      vibrateShort();
      return;
    }
    if (mode === "review") {
      if (this.lastWrongRecords.length === 0) {
        this.toast = { text: "暂无错题，请先在其他模式答错题目", tone: "bad", until: this.t + 2.5 };
        this.toastTimer = 0;
        return;
      }
      const reviewQs = this.wrongRecordsToQuestions(this.lastWrongRecords);
      this.engine?.startMode("review", { reviewQuestions: reviewQs });
      this.gameState = "playing";
      playSfx("click");
      vibrateShort();
      return;
    }
    // speedrun / hardcore / daily
    this.engine?.startMode(mode);
    this.gameState = "playing";
    playSfx("click");
    vibrateShort();
  }

  /** 将错题记录转换为题目数组（按 questionId 从题库查找） */
  private wrongRecordsToQuestions(records: FBWrongRecord[]): import("@/games/fraudBuster/types").FBQuestion[] {
    return records
      .map((r) => QUESTION_BANK.find((q) => q.id === r.questionId))
      .filter((q): q is NonNullable<typeof q> => !!q);
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
