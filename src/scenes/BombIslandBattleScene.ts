/**
 * 「诈园区」战斗场景（薄壳）
 * 引擎画布 960×540 横屏，引擎 InputManager 处理道具栏点击
 * 场景层叠加：天气徽章 / 撤退按钮 / 波次开场简报 / Boss 击破科普卡片
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawToast, drawModalOverlay, drawPanel, drawButton, hitTest, type Rect } from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { BombIslandEngine } from "@/games/bombIsland/engine";
import type { ParkHud, SpecialSkillKind, ModuleType, BombGameMode, BombDifficulty, RTSUpgradeId, RTSUpgradeNode } from "@/games/bombIsland/types";
import { MODE_LABELS, DIFFICULTY_LABELS } from "@/games/bombIsland/dataV2";
import { RTS_NODE_MAP, SYNERGY_SKILLS } from "@/games/bombIsland/dataV3";
import { setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import { playSfx } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import { roundRect } from "@/engine/Renderer";
import type {
  GameEvent, GameResultPayload,
  BossCodexPayload, WaveBriefingPayload,
} from "@/types";

export class BombIslandBattleScene extends GameShellScene {
  private engine: BombIslandEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private hud: ParkHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private t = 0;
  private pulse = 0;

  // 撤退按钮
  private pressedRetreat = false;
  private confirmRetreat = false;
  private pressedConfirmRetreatBtn: string | null = null;

  // v9 RTS 面板 / 多炮位触摸状态
  private pressedRtsNodeId: RTSUpgradeId | null = null;
  private pressedRtsSkip = false;
  private pressedCannonId: string | null = null;

  // v10 动态事件 / 知识问答触摸状态
  private pressedEventChoiceIdx: number | null = null;
  private pressedEventDismiss = false;
  private pressedQuizChoiceIdx: number | null = null;
  private pressedQuizDismiss = false;

  // Boss 击破科普卡片
  private bossCodex: { payload: BossCodexPayload; remain: number; enterT: number } | null = null;

  // 波次开场简报
  private waveBriefing: { payload: WaveBriefingPayload; remain: number; enterT: number } | null = null;

  // 最近一次结算结果（用于结算页额外统计渲染）
  private lastResult: GameResultPayload | null = null;

  // v9 模式配置（从 ModeScene 传入）
  private modeConfig: { mode?: BombGameMode; difficulty?: BombDifficulty; storyStageIdx?: number } = {};

  private static readonly RETREAT_BTN_W = 96;
  private static readonly RETREAT_BTN_H = 28;
  private static readonly BOSS_CODEX_DURATION = 6.0; // 秒
  private static readonly WAVE_BRIEFING_DURATION = 4.0; // 秒

  /** v4 模块类型 → emoji 映射（结算页战报用） */
  private static readonly MODULE_EMOJI: Record<ModuleType, string> = {
    antenna: "📡", floor: "🖥", server: "🗄", dorm: "🛏", fortress: "🏰",
    wall: "🚧", foundation: "🧱", shock: "⚡", cage: "🔒", cell: "🚪", guard: "🛡",
    // v6 新增模块
    liveRoom: "📹", casino: "🎰", darkweb: "🕸", minefarm: "⛏",
    // v9 新增模块（暗网深渊档）
    aiFactory: "🤖", idForge: "🆔",
  };
  /** v4 模块类型 → 中文名映射（结算页战报用） */
  private static readonly MODULE_LABEL: Record<ModuleType, string> = {
    antenna: "信号塔", floor: "工位", server: "服务器", dorm: "宿舍", fortress: "碉堡",
    wall: "铁丝网", foundation: "地基", shock: "电击室", cage: "铁笼", cell: "小黑屋", guard: "武装",
    // v6 新增模块
    liveRoom: "直播间", casino: "赌博机房", darkweb: "暗网服务器", minefarm: "虚拟币矿场",
    // v9 新增模块
    aiFactory: "AI换脸工厂", idForge: "身份车间",
  };

  getGameTitle(): string { return "诈园区"; }
  getGameSubtitle(): string { return "SCAM PARK"; }
  getAccent(): string { return Theme.accents["bomb-island"]; }

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    setOrientation("landscape");
    // v9：接收模式配置（mode/difficulty/storyStageIdx）
    this.modeConfig = {
      mode: params?.mode as BombGameMode | undefined,
      difficulty: params?.difficulty as BombDifficulty | undefined,
      storyStageIdx: params?.storyStageIdx as number | undefined,
    };
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    // v9：将模式配置传入引擎
    const engine = new BombIslandEngine(canvas, this.modeConfig);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    // 由 updateGame/renderGame 同步驱动，消除双 RAF 撕裂闪烁
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      this.hud = e.payload as unknown as ParkHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 3 };
      this.toastTimer = 0;
    } else if (e.type === "result") {
      this.onResult(e.payload);
    } else if (e.type === "bossCodex") {
      // Boss 击破科普：弹出卡片，自动消失或点击关闭
      this.bossCodex = {
        payload: e.payload,
        remain: BombIslandBattleScene.BOSS_CODEX_DURATION,
        enterT: 0,
      };
      postFX.flash("#52C41A", 0.3, 3);
    } else if (e.type === "waveBriefing") {
      // 波次开场简报：顶部横幅 4 秒
      this.waveBriefing = {
        payload: e.payload,
        remain: BombIslandBattleScene.WAVE_BRIEFING_DURATION,
        enterT: 0,
      };
    }
  }

  private onResult(result: GameResultPayload): void {
    this.lastResult = result;
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director)),
      renderExtraStats: (ctx, x, y, w) => this.renderExtraStats(ctx, x, y, w),
    });
  }

  /** 结算页额外统计：诈园区专属战报数据（v4 模块战报 + v5 DPS 折线图 / 饼图 / 救援数据 + v6 评级横幅 + v9 案例时间线/每日任务/Boss图鉴） */
  private renderExtraStats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): number {
    const stats = this.lastResult?.stats as
      | { clearedWaves?: number; totalDamage?: number; maxDps?: number; weaponLevel?: number;
          moduleKillCount?: number; moduleKillStats?: Partial<Record<ModuleType, number>>;
          // v5 字段
          dpsHistory?: number[]; minionsKilled?: number; victimsRescued?: number;
          codexUnlockedCount?: number; codexUnlockedIds?: string[]; bossPhaseMax?: number;
          // v6 字段
          rating?: string; ratingScore?: number; ratingColor?: string;
          gameMode?: string; difficulty?: string;
          matchedVictimTypeIds?: string[];
          fragmentsEarned?: number; starUps?: number;
          // v9 字段
          caseTimeline?: Array<{ atSec: number; caseArchiveId: string; tierStructure?: string; title?: string }>;
          bossCodexUnlockedIds?: string[];
          dailyTaskSnapshot?: Array<{ id: string; name: string; icon: string; progress: number; target: number; claimed: boolean }>;
          clueFragmentsEarned?: number; }
      | undefined;
    if (!stats) return 0;

    const hasModuleStats = (stats.moduleKillCount ?? 0) > 0;
    const hasDpsHistory = (stats.dpsHistory?.length ?? 0) >= 2;
    const hasRating = !!stats.rating;
    const hasCaseTimeline = (stats.caseTimeline?.length ?? 0) > 0;
    const hasDailyTasks = (stats.dailyTaskSnapshot?.length ?? 0) > 0;
    const hasBossCodex = (stats.bossCodexUnlockedIds?.length ?? 0) > 0;
    // v9 区块高度
    const caseTimelineH = hasCaseTimeline ? 24 + Math.min(3, stats.caseTimeline!.length) * 22 + 8 : 0;
    const dailyTaskH = hasDailyTasks ? 24 + stats.dailyTaskSnapshot!.length * 20 + 8 : 0;
    const bossCodexH = hasBossCodex ? 24 + 8 + 8 : 0; // 单行展示
    const v9H = caseTimelineH + dailyTaskH + bossCodexH;
    // 总高度：评级横幅 64 + 第一行 56 + (DPS图 70) + (饼图 86) + v9 区块
    const ratingH = hasRating ? 64 : 0;
    const h = ratingH + 56 + (hasDpsHistory ? 70 : 0) + (hasModuleStats ? 86 : 0) + v9H;

    // 整体外框
    ctx.save();
    ctx.fillStyle = "rgba(255, 122, 26, 0.06)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#FF7A1A";
    ctx.fillRect(x, y, 3, h);
    ctx.restore();

    let cursorY = y;

    // ===== v6 评级横幅 =====
    if (hasRating) {
      const rc = stats.ratingColor ?? "#888888";
      ctx.save();
      // 评级背景渐变
      const grad = ctx.createLinearGradient(x, cursorY, x + w, cursorY);
      grad.addColorStop(0, "rgba(255, 122, 26, 0.04)");
      grad.addColorStop(0.5, "rgba(0, 0, 0, 0.18)");
      grad.addColorStop(1, "rgba(255, 122, 26, 0.04)");
      ctx.fillStyle = grad;
      ctx.fillRect(x + 3, cursorY, w - 3, ratingH);
      // 评级边框
      ctx.strokeStyle = rc;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(x + 8, cursorY + 6, w - 16, ratingH - 12);
      ctx.globalAlpha = 1;
      ctx.restore();

      // 左侧：评级大字
      ctx.save();
      ctx.font = `700 36px ${Theme.fonts.display}`;
      ctx.fillStyle = rc;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = rc;
      ctx.shadowBlur = 12;
      ctx.fillText(stats.rating ?? "F", x + 44, cursorY + ratingH / 2);
      ctx.shadowBlur = 0;
      // 评级标签
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("RATING", x + 44, cursorY + ratingH - 10);
      ctx.restore();

      // 中间：综合得分
      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("综合得分", x + 84, cursorY + 14);
      ctx.font = `700 20px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.flag.DEFAULT;
      ctx.shadowColor = withAlpha(Theme.colors.flag.DEFAULT, 0.4);
      ctx.shadowBlur = 4;
      ctx.fillText(`${stats.ratingScore ?? 0}`, x + 84, cursorY + 28);
      ctx.shadowBlur = 0;
      ctx.restore();

      // 右侧：模式 + 难度 + 受害者档案
      ctx.save();
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      const modeLabel = stats.gameMode ? (MODE_LABELS[stats.gameMode] ?? stats.gameMode) : "";
      const diffLabel = stats.difficulty ? (DIFFICULTY_LABELS[stats.difficulty] ?? stats.difficulty) : "";
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.fillText(modeLabel, x + w - 12, cursorY + 12);
      if (diffLabel) {
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.fillText(diffLabel, x + w - 12, cursorY + 28);
      }
      // 受害者档案解锁数
      const victimCount = stats.matchedVictimTypeIds?.length ?? 0;
      if (victimCount > 0) {
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.safe.DEFAULT;
        ctx.fillText(`🆘 解锁受害者档案 ${victimCount}`, x + w - 12, cursorY + 42);
      }
      // 道具升星
      if ((stats.starUps ?? 0) > 0) {
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.flag.DEFAULT;
        ctx.fillText(`⭐ 升星 ${stats.starUps} 次`, x + w - 12, cursorY + 54);
      }
      ctx.restore();

      cursorY += ratingH;
    }

    // ===== 第 1 行：4 列核心数据 =====
    const colW = (w - 8) / 4;
    const items = [
      { label: "击破园区", value: `${stats.clearedWaves ?? 0}`, color: "#52C41A" },
      { label: "累计伤害", value: this.formatNum(stats.totalDamage ?? 0), color: "#FFD666" },
      { label: "最高 DPS", value: this.formatNum(stats.maxDps ?? 0), color: "#00E5FF" },
      { label: "武器等级", value: `LV${stats.weaponLevel ?? 1}`, color: "#FF7A1A" },
    ];
    for (let i = 0; i < items.length; i++) {
      const cx = x + 8 + i * colW;
      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(items[i].label, cx, cursorY + 10);
      ctx.font = `700 14px ${Theme.fonts.mono}`;
      ctx.fillStyle = items[i].color;
      ctx.shadowColor = items[i].color;
      ctx.shadowBlur = 4;
      ctx.fillText(items[i].value, cx, cursorY + 26);
      ctx.restore();
    }
    // v5 小徽章行（救援/小怪/图鉴）紧贴第 1 行下方
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const v5Badge = [
      `🆘 救援 ${stats.victimsRescued ?? 0}`,
      `🦹 击杀 ${stats.minionsKilled ?? 0}`,
      `📚 图鉴 ${stats.codexUnlockedCount ?? 0}`,
    ].join("   ·   ");
    ctx.fillText(v5Badge, x + 8, cursorY + 44);
    ctx.restore();

    cursorY += 56;

    // ===== 第 2 行：DPS 时间轴折线图 =====
    if (hasDpsHistory && stats.dpsHistory) {
      const chartH = 70;
      this.renderDpsTimelineChart(ctx, x + 8, cursorY, w - 16, chartH, stats.dpsHistory, stats.maxDps ?? 0);
      cursorY += chartH;
    }

    // ===== 第 3 行：模块战报饼图 + 图例 =====
    if (hasModuleStats && stats.moduleKillStats) {
      const pieH = 86;
      this.renderModulePieChart(ctx, x + 8, cursorY, w - 16, pieH, stats.moduleKillStats, stats.moduleKillCount ?? 0);
      cursorY += pieH;
    }

    // ===== v9 T2：案例时间线（本局遭遇的真实诈骗案例时间轴） =====
    if (hasCaseTimeline && stats.caseTimeline) {
      cursorY = this.renderCaseTimelineSection(ctx, x + 8, cursorY, w - 16, stats.caseTimeline, caseTimelineH);
    }

    // ===== v9 G1：每日任务完成情况 =====
    if (hasDailyTasks && stats.dailyTaskSnapshot) {
      cursorY = this.renderDailyTaskSection(ctx, x + 8, cursorY, w - 16, stats.dailyTaskSnapshot, dailyTaskH, stats.clueFragmentsEarned ?? 0);
    }

    // ===== v9 E3：Boss 图鉴新解锁 =====
    if (hasBossCodex && stats.bossCodexUnlockedIds) {
      cursorY = this.renderBossCodexSection(ctx, x + 8, cursorY, w - 16, stats.bossCodexUnlockedIds, bossCodexH);
    }

    return h;
  }

  /** v9 T2：案例时间线区块 */
  private renderCaseTimelineSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, timeline: Array<{ atSec: number; caseArchiveId: string; tierStructure?: string; title?: string }>, h: number): number {
    ctx.save();
    ctx.fillStyle = "rgba(0, 229, 255, 0.06)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#00E5FF";
    ctx.fillRect(x, y, 3, h);
    // 标题
    ctx.fillStyle = "#00E5FF";
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("📅 案例时间线 · 本局遭遇的真实诈骗", x + 10, y + 6);
    // 时间线条目（最多展示 3 条，避免过高）
    const showCount = Math.min(3, timeline.length);
    for (let i = 0; i < showCount; i++) {
      const e = timeline[i];
      const ey = y + 24 + i * 22;
      const mm = Math.floor(e.atSec / 60);
      const ss = Math.floor(e.atSec % 60);
      const timeStr = `${mm}:${ss.toString().padStart(2, "0")}`;
      // 时间点圆点
      ctx.fillStyle = "#00E5FF";
      ctx.beginPath();
      ctx.arc(x + 16, ey + 8, 3, 0, Math.PI * 2);
      ctx.fill();
      // 时间
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.fillText(timeStr, x + 24, ey + 4);
      // 园区档位 + 案例标题
      const tierLabel = e.tierStructure ? `[${e.tierStructure}] ` : "";
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.font = `500 10px ${Theme.fonts.mono}`;
      ctx.fillText(`${tierLabel}${e.title ?? e.caseArchiveId}`, x + 60, ey + 4);
    }
    if (timeline.length > 3) {
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.font = `500 9px ${Theme.fonts.mono}`;
      ctx.fillText(`…还有 ${timeline.length - 3} 条`, x + 24, y + 24 + 3 * 22);
    }
    ctx.restore();
    return y + h;
  }

  /** v9 G1：每日任务区块 */
  private renderDailyTaskSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, tasks: Array<{ id: string; name: string; icon: string; progress: number; target: number; claimed: boolean }>, h: number, fragments: number): number {
    ctx.save();
    ctx.fillStyle = "rgba(255, 214, 102, 0.05)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#FFD666";
    ctx.fillRect(x, y, 3, h);
    // 标题 + 碎片总数
    ctx.fillStyle = "#FFD666";
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("📋 每日任务进度", x + 10, y + 6);
    ctx.fillStyle = "#9FE3FF";
    ctx.textAlign = "right";
    ctx.fillText(`🔍 本局获 ${fragments} 碎片`, x + w - 8, y + 6);
    // 任务条目
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const ty = y + 24 + i * 20;
      const done = t.progress >= t.target;
      const pct = Math.min(1, t.progress / t.target);
      // 图标 + 名称
      ctx.fillStyle = done ? "#52C41A" : Theme.colors.ink.DEFAULT;
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${t.icon} ${t.name}`, x + 10, ty + 2);
      // 进度条
      const barX = x + w * 0.5;
      const barW = w * 0.35;
      const barH = 6;
      ctx.fillStyle = "rgba(120,120,120,0.25)";
      roundRect(ctx, barX, ty + 4, barW, barH, 2);
      ctx.fill();
      ctx.fillStyle = done ? "#52C41A" : "#FFD666";
      roundRect(ctx, barX, ty + 4, barW * pct, barH, 2);
      ctx.fill();
      // 进度数字
      ctx.fillStyle = done ? "#52C41A" : Theme.colors.ink.muted;
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.textAlign = "left";
      ctx.fillText(`${t.progress}/${t.target}`, x + w - 50, ty + 2);
      // 状态标记
      if (done && t.claimed) {
        ctx.fillStyle = "#52C41A";
        ctx.fillText("✓ 已领", x + w - 18, ty + 2);
      } else if (done) {
        ctx.fillStyle = "#FFD666";
        ctx.fillText("可领", x + w - 18, ty + 2);
      }
    }
    ctx.restore();
    return y + h;
  }

  /** v9 E3：Boss 图鉴新解锁区块 */
  private renderBossCodexSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, bossIds: string[], h: number): number {
    ctx.save();
    ctx.fillStyle = "rgba(179, 136, 255, 0.06)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#B388FF";
    ctx.fillRect(x, y, 3, h);
    // 标题
    ctx.fillStyle = "#B388FF";
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`👑 Boss 图鉴 · 新解锁 ${bossIds.length} 位`, x + 10, y + 6);
    // Boss ID 列表（单行展示）
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.font = `600 10px ${Theme.fonts.mono}`;
    const idStr = bossIds.map(id => `· ${id}`).join("   ");
    ctx.fillText(idStr, x + 10, y + 24);
    ctx.restore();
    return y + h;
  }

  /**
   * v5 DPS 时间轴折线图：横轴=时间（秒），纵轴=DPS。
   * 在画布上绘制坐标轴 + 渐变填充曲线 + 峰值标注。
   */
  private renderDpsTimelineChart(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    history: number[], maxDps: number,
  ): void {
    ctx.save();
    // 分隔线
    ctx.fillStyle = "rgba(255, 122, 26, 0.2)";
    ctx.fillRect(x, y, w, 1);

    // 标题
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`📈 DPS 时间轴 · 采样 ${history.length}s`, x, y + 4);

    // 图表区域
    const padL = 28, padR = 8, padT = 16, padB = 12;
    const cx = x + padL;
    const cy = y + padT;
    const cw = w - padL - padR;
    const ch = h - padT - padB;
    const peak = Math.max(maxDps, ...history, 1);

    // 网格 + Y 轴刻度（3 档）
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.font = `400 7px ${Theme.fonts.mono}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 3; i++) {
      const gy = cy + ch - (i / 3) * ch;
      ctx.beginPath();
      ctx.moveTo(cx, gy);
      ctx.lineTo(cx + cw, gy);
      ctx.stroke();
      const val = Math.round((i / 3) * peak);
      ctx.fillText(this.formatNum(val), cx - 3, gy);
    }

    // X 轴刻度（首/中/尾）
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const xLabels = [0, Math.floor(history.length / 2), history.length - 1];
    for (const t of xLabels) {
      if (t < 0) continue;
      const px = cx + (history.length <= 1 ? 0 : (t / (history.length - 1)) * cw);
      ctx.fillText(`${t}s`, px, cy + ch + 2);
    }

    // 渐变填充区域
    if (history.length >= 2) {
      const grad = ctx.createLinearGradient(0, cy, 0, cy + ch);
      grad.addColorStop(0, "rgba(0, 229, 255, 0.45)");
      grad.addColorStop(1, "rgba(0, 229, 255, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, cy + ch);
      for (let i = 0; i < history.length; i++) {
        const px = cx + (i / (history.length - 1)) * cw;
        const py = cy + ch - (history[i] / peak) * ch;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(cx + cw, cy + ch);
      ctx.closePath();
      ctx.fill();

      // 折线
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const px = cx + (i / (history.length - 1)) * cw;
        const py = cy + ch - (history[i] / peak) * ch;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 峰值点标注
      let peakIdx = 0;
      for (let i = 1; i < history.length; i++) if (history[i] > history[peakIdx]) peakIdx = i;
      const ppx = cx + (peakIdx / (history.length - 1)) * cw;
      const ppy = cy + ch - (history[peakIdx] / peak) * ch;
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(ppx, ppy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `700 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`峰 ${this.formatNum(history[peakIdx])}`, ppx, ppy - 4);
    }
    ctx.restore();
  }

  /**
   * v5 模块战报饼图：左侧饼图 + 右侧图例（按数量降序，最多 6 项，其余合并为"其他"）。
   */
  private renderModulePieChart(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    stats: Partial<Record<ModuleType, number>>, total: number,
  ): void {
    const PALETTE = ["#FF7A1A", "#00E5FF", "#52C41A", "#FFD666", "#B388FF", "#FF5A2A", "#7A8FB0"];
    ctx.save();
    // 分隔线
    ctx.fillStyle = "rgba(255, 122, 26, 0.2)";
    ctx.fillRect(x, y, w, 1);
    // 标题
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`📊 拆模块战报 · 共 ${total} 个`, x, y + 4);

    // 数据准备：降序排列
    const entries = (Object.entries(stats) as [ModuleType, number][])
      .filter(([, c]) => (c ?? 0) > 0)
      .sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 6);
    const restSum = entries.slice(6).reduce((s, [, c]) => s + c, 0);
    if (restSum > 0) top.push(["wall" as ModuleType, restSum]); // 复用 wall 作为"其他"占位

    // 饼图区域（左侧）
    const pieR = Math.min(h - 18, 36);
    const pcx = x + 12 + pieR;
    const pcy = y + h / 2 + 2;
    let acc = 0;
    for (let i = 0; i < top.length; i++) {
      const [, count] = top[i];
      const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
      acc += count;
      const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(pcx, pcy);
      ctx.arc(pcx, pcy, pieR, a0, a1);
      ctx.closePath();
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(10,20,38,0.9)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // 中心圆（甜甜圈效果）
    ctx.fillStyle = "rgba(10, 20, 38, 0.92)";
    ctx.beginPath();
    ctx.arc(pcx, pcy, pieR * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FF7A1A";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${total}`, pcx, pcy - 4);
    ctx.font = `400 7px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("总数", pcx, pcy + 7);

    // 图例区域（右侧）
    const legendX = x + 12 + pieR * 2 + 14;
    const legendW = w - (legendX - x) - 4;
    const lineH = 11;
    const maxLines = Math.floor((h - 8) / lineH);
    const shown = top.slice(0, maxLines);
    for (let i = 0; i < shown.length; i++) {
      const [mType, count] = shown[i];
      const ly = y + 10 + i * lineH;
      const isOther = i === top.length - 1 && restSum > 0;
      const emoji = isOther ? "▫" : (BombIslandBattleScene.MODULE_EMOJI[mType] || "▪");
      const label = isOther ? "其他" : (BombIslandBattleScene.MODULE_LABEL[mType] || mType);
      const pct = ((count / total) * 100).toFixed(0);
      // 色块
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fillRect(legendX, ly + 2, 8, 8);
      // 文本
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha("#FFFFFF", 0.88);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${emoji} ${label}`, legendX + 12, ly + 1);
      // 数值 + 百分比（右对齐）
      ctx.textAlign = "right";
      ctx.fillStyle = withAlpha("#FFFFFF", 0.6);
      ctx.fillText(`×${count}  ${pct}%`, legendX + legendW, ly + 1);
    }
    ctx.restore();
  }

  private formatNum(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${Math.round(n)}`;
  }

  private retry(): void {
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.bossCodex = null;
    this.waveBriefing = null;
    this.lastResult = null;
    this.confirmRetreat = false;
    this.pressedRetreat = false;
    this.pressedConfirmRetreatBtn = null;
    this.spawnEngine();
  }

  pause(): void {
    super.pause();
    this.engine?.pause();
  }
  resume(): void {
    super.resume();
    this.engine?.resume();
  }

  protected updateGame(dt: number): void {
    // 同步驱动引擎 update（与场景同帧，杜绝撕裂）
    this.engine?.stepUpdate(dt);
    this.t += dt;
    this.pulse += dt;
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 3) this.toast = null;
    }
    // Boss 击破科普卡片计时
    if (this.bossCodex) {
      this.bossCodex.enterT = Math.min(1, this.bossCodex.enterT + dt * 4);
      this.bossCodex.remain -= dt;
      if (this.bossCodex.remain <= 0) this.bossCodex = null;
    }
    // 波次开场简报计时
    if (this.waveBriefing) {
      this.waveBriefing.enterT = Math.min(1, this.waveBriefing.enterT + dt * 4);
      this.waveBriefing.remain -= dt;
      if (this.waveBriefing.remain <= 0) this.waveBriefing = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 同步引擎暂停状态（覆盖用户按暂停按钮的场景）
    if (this.paused) this.engine?.pause();
    else this.engine?.resume();

    // 引擎画布 blit
    if (this.engineCanvas && this.engine) {
      // 同步驱动引擎渲染，确保 engineCanvas 在 blit 前已完成本帧绘制
      this.engine.stepRender();
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // v4：Boss 专属技能全屏视觉覆盖（在天气徽章之前，作为底层全屏特效）
    if (this.hud?.specialSkillKind) {
      this.renderSpecialSkillOverlay(ctx, screenW, screenH);
    }

    // 天气徽章（顶部中央）
    if (this.hud) {
      this.renderWeatherBadge(ctx, screenW);
    }

    // v5：Boss 阶段指示器 + 小怪/受害者计数 badge
    if (this.hud && (this.hud.bossPhaseMax ?? 0) > 1) {
      this.renderV5StatusBadges(ctx, screenW);
    }

    // v9：分层 HP 条 / 多炮位 HUD / 知识弹幕横幅
    if (this.hud) {
      this.renderLayerHpBars(ctx, screenW);
      this.renderMultiCannonHud(ctx, screenW, screenH);
      this.renderKnowledgeBanner(ctx, screenW);
      // v10 B1：连携槽 UI（仅战斗阶段显示，波次间隙模态面板时不显示）
      if (this.hud.phase === "fight" && this.hud.waveGapPhase === "none") {
        this.renderSynergyGauge(ctx, screenW);
      }
    }

    // 撤退按钮（右上角，pause/sound 之下）
    this.renderRetreatButton(ctx, screenW);

    // v5：Boss 入场/击败 letterbox 特写（全屏覆盖，置于绝大多数 UI 之上）
    if (this.hud && ((this.hud.bossIntroRemain ?? 0) > 0 || (this.hud.bossDefeatRemain ?? 0) > 0)) {
      this.renderBossLetterbox(ctx, screenW, screenH);
    }

    // 波次开场简报横幅
    if (this.waveBriefing) {
      this.renderWaveBriefing(ctx, screenW, screenH);
    }

    // Toast
    if (this.toast) {
      const tw = screenW - 32;
      const th = 48;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "炮兵通讯");
    }

    // v9：波次间隙 RTS 升级面板（模态，暂停主循环）
    if (this.hud && this.hud.waveGapPhase === "rtsPanel") {
      this.renderRTSPanel(ctx, screenW, screenH);
    }
    // v10 B2：动态事件面板（模态，暂停主循环）
    if (this.hud && this.hud.waveGapPhase === "dynamicEvent") {
      this.renderDynamicEventPanel(ctx, screenW, screenH);
    }
    // v10 C1：知识问答面板（模态，暂停主循环）
    if (this.hud && this.hud.waveGapPhase === "quiz") {
      this.renderQuizPanel(ctx, screenW, screenH);
    }

    // Boss 击破科普卡片（覆盖层）
    if (this.bossCodex) {
      this.renderBossCodex(ctx, screenW, screenH);
    }

    // 撤退确认弹窗
    if (this.confirmRetreat) {
      this.renderRetreatConfirm(ctx, screenW, screenH);
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  /**
   * v4 Boss 专属技能全屏视觉覆盖
   * - cageTrap  铁笼困人：屏幕四边铁栏杆 + 顶部技能条
   * - shockJam  电击干扰：锯齿状电流纹路 + 中心闪光 + 顶部技能条
   * - deepfake  AI换脸：红蓝色相偏移重影 + 扫描线 + 顶部技能条
   */
  private renderSpecialSkillOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const kind = hud.specialSkillKind as SpecialSkillKind;
    const color = hud.specialSkillColor || "#FF5A2A";
    const remain = hud.specialSkillRemain || 0;
    const total = hud.specialSkillTotal || 1;
    const progress = Math.max(0, Math.min(1, remain / total));
    const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 8);

    ctx.save();

    // 半透明全屏着色遮罩（不阻挡视野，仅作氛围渲染）
    ctx.globalAlpha = 0.12 + pulse * 0.08;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.globalAlpha = 1;

    // 按 kind 渲染各自全屏特效
    if (kind === "cageTrap") {
      // 铁笼困人：屏幕左右两侧竖向铁栏杆
      const barCount = 14;
      const barW = 4;
      ctx.fillStyle = withAlpha(color, 0.75 + pulse * 0.25);
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      for (let i = 0; i < barCount; i++) {
        const y = (i / barCount) * screenH;
        // 左侧双列铁栏
        ctx.fillRect(0, y, 18, barW);
        ctx.fillRect(22, y, 4, barW);
        // 右侧双列铁栏
        ctx.fillRect(screenW - 22, y, 22, barW);
        ctx.fillRect(screenW - 26, y, 4, barW);
      }
      // 顶部底部横梁（固定上下两端封闭铁笼感）
      ctx.fillRect(0, 0, 26, barW);
      ctx.fillRect(0, screenH - barW, 26, barW);
      ctx.fillRect(screenW - 26, 0, 26, barW);
      ctx.fillRect(screenW - 26, screenH - barW, 26, barW);
      ctx.shadowBlur = 0;
    } else if (kind === "shockJam") {
      // 电击干扰：随机锯齿状电流线条
      ctx.strokeStyle = withAlpha(color, 0.6 + pulse * 0.4);
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      const lineCount = 6;
      for (let i = 0; i < lineCount; i++) {
        const seed = i * 100 + Math.floor(this.pulse * 12);
        const y = (seed * 37) % screenH;
        ctx.beginPath();
        let x = 0;
        let cy = y;
        ctx.moveTo(x, cy);
        while (x < screenW) {
          x += 20 + ((seed + x) % 30);
          cy += (((seed + x) % 40) - 20);
          ctx.lineTo(x, cy);
        }
        ctx.stroke();
      }
      // 中心闪光圆（模拟电击脉冲）
      const cx = screenW / 2, cy = screenH / 2;
      ctx.fillStyle = withAlpha(color, 0.2 * pulse);
      ctx.beginPath();
      ctx.arc(cx, cy, 80 + pulse * 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (kind === "deepfake") {
      // AI换脸：红蓝色相偏移重影（左右边缘）
      const offset = 3 + Math.round(pulse * 4);
      ctx.fillStyle = withAlpha("#FF0000", 0.28);
      ctx.fillRect(0, 0, offset, screenH);
      ctx.fillRect(screenW - offset, 0, offset, screenH);
      ctx.fillStyle = withAlpha("#00BFFF", 0.28);
      ctx.fillRect(offset, 0, offset, screenH);
      ctx.fillRect(screenW - offset * 2, 0, offset, screenH);
      // 顶部底部扫描线（模拟数字伪影）
      ctx.fillStyle = withAlpha(color, 0.3);
      const scanOffset = Math.floor(this.pulse * 20);
      for (let y = 0; y < screenH; y += 4) {
        if ((y + scanOffset) % 8 === 0) {
          ctx.fillRect(0, y, screenW, 1);
        }
      }
    }

    // 通用：顶部技能条（名称 + 倒计时进度条）
    const bannerW = 280;
    const bannerH = 36;
    const bx = (screenW - bannerW) / 2;
    const by = 56;
    ctx.fillStyle = "rgba(10, 25, 41, 0.92)";
    roundRect(ctx, bx, by, bannerW, bannerH, 6);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.8);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    roundRect(ctx, bx, by, bannerW, bannerH, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 左侧色条
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, 3, bannerH);
    // 技能名称
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.fillText(`⚠ ${hud.specialSkillName}`, bx + 12, by + bannerH / 2);
    ctx.shadowBlur = 0;
    // 倒计时进度条
    const barX = bx + 12;
    const barY = by + bannerH - 4;
    const barW2 = bannerW - 24;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(barX, barY, barW2, 2);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW2 * progress, 2);

    ctx.restore();
  }

  /** 天气徽章：顶部中央，显示当前天气与影响 */
  private renderWeatherBadge(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const w = 220;
    const h = 32;
    const x = (screenW - w) / 2;
    const y = 14;
    const color = hud.weatherColor;
    ctx.save();
    // 背景
    ctx.fillStyle = "rgba(15, 34, 54, 0.88)";
    ctx.fillRect(x, y, w, h);
    // 边框（脉冲）
    const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 + pulse * 6;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    // 左侧标签条
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3, h);
    // emoji
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(hud.weatherEmoji, x + 10, y + h / 2 + 1);
    // 名称
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.fillText(`天气 · ${hud.weatherName}`, x + 34, y + h / 2);
    ctx.shadowBlur = 0;
    // 描述
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#FFFFFF", 0.7);
    ctx.fillText(hud.weatherDesc, x + 100, y + h / 2 + 1);
    ctx.restore();
  }

  /** 撤退按钮：右上角，点击触发结算 */
  private renderRetreatButton(ctx: CanvasRenderingContext2D, screenW: number): void {
    if (this.resultOverlay) return; // 结算中隐藏
    const w = BombIslandBattleScene.RETREAT_BTN_W;
    const h = BombIslandBattleScene.RETREAT_BTN_H;
    const x = screenW - w - 12;
    const y = 48; // pause/sound 按钮（y=8,h=28）下方
    const accent = Theme.colors.warn.DEFAULT;
    drawButton(ctx, x, y, w, h, "撤退结算", {
      variant: "ghost", accent,
      pressed: this.pressedRetreat,
    });
    drawIcon(ctx, "flag", x + 8, y + h / 2 - 8, 12, accent);
  }

  private getRetreatButtonRect(screenW: number): Rect {
    return {
      x: screenW - BombIslandBattleScene.RETREAT_BTN_W - 12,
      y: 48,
      w: BombIslandBattleScene.RETREAT_BTN_W,
      h: BombIslandBattleScene.RETREAT_BTN_H,
    };
  }

  /**
   * v5 状态徽章组：Boss 阶段指示器 + 小怪计数 + 受害者救援计数。
   * 顶部中央偏下排列，仅当 Boss 拥有多阶段时显示。
   */
  private renderV5StatusBadges(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const phaseMax = hud.bossPhaseMax ?? 1;
    const phaseIdx = hud.bossPhase ?? 0;
    const phaseName = hud.bossPhaseName ?? "";
    const minionsActive = hud.minionsActive ?? 0;
    const victimsRescued = hud.victimsRescued ?? 0;
    const victimsActive = hud.victimsActive ?? 0;

    // 阶段指示器：3 个分段进度条 + 阶段名
    const badgeW = 200;
    const badgeH = 22;
    const bx = (screenW - badgeW) / 2;
    const by = 50;
    ctx.save();
    ctx.fillStyle = "rgba(10, 20, 38, 0.88)";
    ctx.fillRect(bx, by, badgeW, badgeH);
    ctx.fillStyle = "#FF7A1A";
    ctx.fillRect(bx, by, 2, badgeH);
    // 标签
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FF7A1A";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FF7A1A";
    ctx.shadowBlur = 4;
    ctx.fillText("BOSS 阶段", bx + 8, by + badgeH / 2);
    ctx.shadowBlur = 0;
    // 3 段进度块
    const segW = 28;
    const segGap = 3;
    const segsX = bx + 70;
    for (let i = 0; i < phaseMax; i++) {
      const sx = segsX + i * (segW + segGap);
      const done = i < phaseIdx;
      const active = i === phaseIdx;
      ctx.fillStyle = active
        ? "#FF7A1A"
        : done
        ? "rgba(82,196,26,0.7)"
        : "rgba(255,255,255,0.12)";
      ctx.fillRect(sx, by + 5, segW, badgeH - 10);
      if (active) {
        // 当前阶段脉冲发光
        const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 6);
        ctx.shadowColor = "#FF7A1A";
        ctx.shadowBlur = 6 + pulse * 6;
        ctx.fillStyle = `rgba(255,214,102,${0.3 + pulse * 0.3})`;
        ctx.fillRect(sx, by + 5, segW, badgeH - 10);
        ctx.shadowBlur = 0;
      }
      // 阶段编号
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = active || done ? "#0A1426" : "rgba(255,255,255,0.4)";
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}`, sx + segW / 2, by + badgeH / 2);
    }
    // 阶段名（右侧）
    ctx.font = `500 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#FFFFFF", 0.85);
    ctx.textAlign = "left";
    ctx.fillText(phaseName, segsX + phaseMax * (segW + segGap) + 4, by + badgeH / 2);
    ctx.restore();

    // 小怪计数 badge（右上，撤退按钮下方）
    if (minionsActive > 0) {
      const mx = screenW - 110;
      const my = 82;
      const mw = 98;
      const mh = 20;
      ctx.save();
      ctx.fillStyle = "rgba(60, 16, 28, 0.92)";
      ctx.fillRect(mx, my, mw, mh);
      ctx.fillStyle = "#FF5A2A";
      ctx.fillRect(mx, my, 2, mh);
      const mp = 0.5 + 0.5 * Math.sin(this.pulse * 10);
      ctx.shadowColor = "#FF5A2A";
      ctx.shadowBlur = 4 + mp * 6;
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF5A2A";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`🦹 来袭马仔 ×${minionsActive}`, mx + 8, my + mh / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 受害者救援计数 badge（左上，天气徽章下方对齐左侧）
    if (victimsRescued > 0 || victimsActive > 0) {
      const vx = 12;
      const vy = 82;
      const vw = 116;
      const vh = 20;
      ctx.save();
      ctx.fillStyle = "rgba(10, 30, 18, 0.92)";
      ctx.fillRect(vx, vy, vw, vh);
      ctx.fillStyle = "#52C41A";
      ctx.fillRect(vx, vy, 2, vh);
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#52C41A";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#52C41A";
      ctx.shadowBlur = 4;
      ctx.fillText(`🆘 已解救 ×${victimsRescued}`, vx + 8, vy + vh / 2);
      ctx.shadowBlur = 0;
      if (victimsActive > 0) {
        ctx.font = `500 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = withAlpha("#FFFFFF", 0.7);
        ctx.fillText(`(+${victimsActive} 逃离中)`, vx + 86, vy + vh / 2);
      }
      ctx.restore();
    }
  }

  /**
   * v5 Boss 入场/击败 letterbox 特写：
   * - 入场（bossIntroRemain > 0）：上下黑边 + Boss emoji 大图 + 名称 + 身份
   * - 击败（bossDefeatRemain > 0）：上下黑边 + 慢镜头暗化 + "BOSS 击破" 大字
   * 两者同时仅可能有一个 > 0（引擎保证互斥）。
   */
  private renderBossLetterbox(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const intro = hud.bossIntroRemain ?? 0;
    const defeat = hud.bossDefeatRemain ?? 0;
    if (intro <= 0 && defeat <= 0) return;

    // 黑边高度（占屏幕 18%）
    const barH = Math.round(screenH * 0.18);
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, screenW, barH);
    ctx.fillRect(0, screenH - barH, screenW, barH);

    if (intro > 0) {
      // 入场：淡入效果（intro 总时长 1.5s，前 0.4s 淡入）
      const total = 1.5;
      const elapsed = total - intro;
      const fadeIn = Math.min(1, elapsed / 0.4);
      const fadeOut = intro < 0.3 ? intro / 0.3 : 1;
      const alpha = Math.min(fadeIn, fadeOut);

      ctx.globalAlpha = alpha;
      // 全屏轻微暗化
      ctx.fillStyle = "rgba(8, 14, 28, 0.35)";
      ctx.fillRect(0, barH, screenW, screenH - barH * 2);

      // Boss emoji 大图（屏幕中央偏上）
      const cx = screenW / 2;
      const cy = screenH / 2 - 20;
      ctx.font = "96px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#FF7A1A";
      ctx.shadowBlur = 30;
      ctx.fillText(hud.bossEmoji, cx, cy);
      ctx.shadowBlur = 0;

      // BOSS 名称
      ctx.font = `900 26px ${Theme.fonts.display}`;
      ctx.fillStyle = "#FF7A1A";
      ctx.shadowColor = "#FF7A1A";
      ctx.shadowBlur = 16;
      ctx.fillText(hud.bossName, cx, cy + 70);
      ctx.shadowBlur = 0;

      // 身份副标题
      ctx.font = `400 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha("#FFFFFF", 0.8);
      ctx.fillText(hud.bossIdentity, cx, cy + 94);

      // 顶部 "BOSS 登场" 标签
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF5A2A";
      ctx.shadowColor = "#FF5A2A";
      ctx.shadowBlur = 8;
      ctx.fillText("⚠ BOSS 登场", cx, barH + 18);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    } else if (defeat > 0) {
      // 击败：慢镜头暗化 + "BOSS 击破" 大字（带消散效果）
      const total = 2.0;
      const elapsed = total - defeat;
      const fadeIn = Math.min(1, elapsed / 0.3);
      const fadeOut = defeat < 0.5 ? defeat / 0.5 : 1;
      const alpha = Math.min(fadeIn, fadeOut);

      ctx.globalAlpha = alpha;
      // 慢镜头暖色暗化
      ctx.fillStyle = "rgba(60, 20, 8, 0.45)";
      ctx.fillRect(0, barH, screenW, screenH - barH * 2);

      const cx = screenW / 2;
      const cy = screenH / 2;

      // 击破大字（带颤动）
      const shake = (Math.random() - 0.5) * 3;
      ctx.font = `900 48px ${Theme.fonts.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FF7A1A";
      ctx.shadowBlur = 24;
      ctx.fillText("BOSS 击破", cx + shake, cy - 16);

      // Boss 名称（已击败）
      ctx.font = `700 16px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha("#FFFFFF", 0.9);
      ctx.shadowBlur = 8;
      ctx.fillText(`${hud.bossEmoji} ${hud.bossName}`, cx, cy + 24);
      ctx.shadowBlur = 0;

      // 底部 "正在结算..." 提示
      ctx.font = `500 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha("#FFFFFF", 0.6);
      ctx.fillText("正在收网，结算中...", cx, screenH - barH - 14);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** 撤退确认弹窗：避免误触 */
  private renderRetreatConfirm(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawModalOverlay(ctx, screenW, screenH);
    const w = Math.min(320, screenW - 32);
    const h = 200;
    const x = (screenW - w) / 2;
    const y = (screenH - h) / 2;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(Theme.colors.warn.DEFAULT, 0.6), cut: 10 });

    drawIcon(ctx, "flag", x + 16, y + 16, 18, Theme.colors.warn.DEFAULT);
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("撤退并结算本局？", x + 42, y + 18);
    ctx.restore();

    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("将按当前进度结算：得分、击破波次、最高连击", x + 16, y + 52);
    ctx.fillText("将写入排行榜并展示反诈锦囊。", x + 16, y + 70);
    ctx.restore();

    // 当前进度摘要
    if (this.hud) {
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.accents["bomb-island"];
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`波次 ${this.hud.wave} · 得分 ${this.hud.score} · 击破 ${this.hud.clearedWaves ?? 0} 波`, x + 16, y + 96);
      ctx.restore();
    }

    const btnW = (w - 32 - 8) / 2;
    const btnH = 34;
    const btnY = y + h - btnH - 16;
    drawButton(ctx, x + 16, btnY, btnW, btnH, "继续战斗", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedConfirmRetreatBtn === "cancel",
    });
    drawButton(ctx, x + 16 + btnW + 8, btnY, btnW, btnH, "确认撤退", {
      variant: "primary", accent: Theme.colors.warn.DEFAULT,
      pressed: this.pressedConfirmRetreatBtn === "confirm",
    });
  }

  /** 波次开场简报：顶部横幅，显示诈骗类型与识别要点 */
  private renderWaveBriefing(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const wb = this.waveBriefing!;
    const p = wb.payload;
    const enter = wb.enterT;
    // 退出阶段：最后 0.5s 淡出
    const fadeOut = wb.remain < 0.5 ? wb.remain / 0.5 : 1;
    const alpha = Math.min(enter, fadeOut);
    const w = Math.min(520, screenW - 32);
    const h = 96;
    const x = (screenW - w) / 2;
    const y = 56 + (1 - enter) * -20; // 从上方滑入
    const accent = Theme.accents["bomb-island"];

    ctx.save();
    ctx.globalAlpha = alpha;
    // 背景
    ctx.fillStyle = "rgba(10, 25, 41, 0.92)";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    // 边框
    ctx.strokeStyle = withAlpha(accent, 0.7);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 左侧色条
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 4, h);

    // 标题：园区档位 + 诈骗类型
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`波次简报 · WAVE ${p.wave} · ${p.tierName}园区`, x + 14, y + 10);

    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    ctx.fillText(p.scamType, x + 14, y + 24);
    ctx.shadowBlur = 0;

    // 识别要点（3 条横排）
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha("#FFFFFF", 0.85);
    const pointW = (w - 28) / Math.min(3, p.points.length);
    for (let i = 0; i < Math.min(3, p.points.length); i++) {
      const px = x + 14 + i * pointW;
      // 要点序号圆点
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(px + 4, y + 60, 3, 0, Math.PI * 2);
      ctx.fill();
      // 要点文本（限制宽度，超出截断）
      ctx.fillStyle = withAlpha("#FFFFFF", 0.85);
      const text = p.points[i];
      const maxW = pointW - 14;
      let display = text;
      if (ctx.measureText(text).width > maxW) {
        for (let j = text.length - 1; j > 0; j--) {
          display = text.slice(0, j) + "…";
          if (ctx.measureText(display).width <= maxW) break;
        }
      }
      ctx.fillText(display, px + 12, y + 56);
    }

    // 倒计时进度条
    const progress = wb.remain / BombIslandBattleScene.WAVE_BRIEFING_DURATION;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(x, y + h - 3, w, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + h - 3, w * progress, 3);
    ctx.restore();
  }

  /** Boss 击破科普卡片：覆盖层，展示反诈案例 */
  private renderBossCodex(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const bc = this.bossCodex!;
    const p = bc.payload;
    const enter = bc.enterT;
    const fadeOut = bc.remain < 0.6 ? bc.remain / 0.6 : 1;
    const alpha = Math.min(enter, fadeOut);
    const accent = "#52C41A";

    // 半透明遮罩（不全黑，让玩家仍能看到战场）
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    const w = Math.min(440, screenW - 32);
    const h = 320;
    const x = (screenW - w) / 2;
    const y = Math.max(8, (screenH - h) / 2 + (1 - enter) * 30);

    ctx.save();
    ctx.globalAlpha = alpha;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(accent, 0.7), cut: 10 });

    // 顶部渐变线
    const lg = ctx.createLinearGradient(x, y, x + w, y);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, accent);
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, 2);

    // 顶部标签
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`BOSS 击破 · ${p.tierName}园区`, x + w / 2, y + 12);

    // Boss 名称（带 emoji 风格）
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10 + Math.sin(this.pulse * 3) * 4;
    ctx.fillText(`✓ ${p.bossName} 已被击溃`, x + w / 2, y + 26);
    ctx.shadowBlur = 0;

    // 案例标题
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("【反诈案例】", x + 16, y + 58);

    ctx.font = `700 13px ${Theme.fonts.body}`;
    ctx.fillStyle = "#FFD666";
    ctx.fillText(p.title, x + 86, y + 58);

    // 案例正文（换行）
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
    const bodyLines = wrapText(ctx, p.body, w - 32);
    let lineY = y + 84;
    for (const line of bodyLines) {
      ctx.fillText(line, x + 16, lineY);
      lineY += 16;
    }

    // 识别要点
    lineY += 6;
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.fillText("识别要点：", x + 16, lineY);
    lineY += 18;
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha("#FFFFFF", 0.9);
    for (const pt of p.points) {
      // 要点标记
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x + 22, lineY + 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = withAlpha("#FFFFFF", 0.9);
      ctx.fillText(pt, x + 30, lineY);
      lineY += 16;
    }

    // 热线条码徽章
    const badgeY = y + h - 38;
    const hotlineColor = p.hotline === "12308" ? "#1B5FCC" : p.hotline === "110" ? "#E5353B" : "#FFD666";
    drawHotlineBadge(ctx, x + 16, badgeY, p.hotline, hotlineColor);
    drawHotlineBadge(ctx, x + 16 + 110, badgeY, "96110", "#E5353B");

    // 倒计时进度条 + 关闭提示
    const progress = bc.remain / BombIslandBattleScene.BOSS_CODEX_DURATION;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(x, y + h - 4, w, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + h - 4, w * progress, 3);

    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("点击空白处关闭", x + w - 12, y + h - 10);

    ctx.restore();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    // 结算覆盖层优先
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }

    // 撤退确认弹窗
    if (this.confirmRetreat) {
      return this.handleRetreatConfirmTouch(type, x, y);
    }

    // v9：波次间隙 RTS 升级面板（模态，优先消费所有触摸）
    if (this.hud && this.hud.waveGapPhase === "rtsPanel") {
      return this.handleRTSTouch(type, x, y);
    }
    // v10 B2：动态事件面板（模态，优先消费所有触摸）
    if (this.hud && this.hud.waveGapPhase === "dynamicEvent") {
      return this.handleDynamicEventTouch(type, x, y);
    }
    // v10 C1：知识问答面板（模态，优先消费所有触摸）
    if (this.hud && this.hud.waveGapPhase === "quiz") {
      return this.handleQuizTouch(type, x, y);
    }

    // Boss 击破科普卡片：点击任意位置关闭
    if (this.bossCodex && type === "end") {
      this.bossCodex.remain = Math.min(this.bossCodex.remain, 0.5);
      playSfx("click");
      return true;
    }

    // v9：多炮位切换/开关按钮（战斗中）
    if (this.hud && this.hud.cannonSlots && type === "end") {
      if (this.handleCannonHudTouch(x, y)) return true;
    }

    // 撤退按钮
    const retreatRect = this.getRetreatButtonRect(this.director.screenWidth);
    if (type === "start") {
      if (hitTest(x, y, retreatRect)) {
        this.pressedRetreat = true;
        return true;
      }
    } else if (type === "end") {
      if (this.pressedRetreat && hitTest(x, y, retreatRect)) {
        this.pressedRetreat = false;
        this.confirmRetreat = true;
        playSfx("click");
        return true;
      }
      this.pressedRetreat = false;
    }

    // 无外壳级触摸处理 — 交给引擎 InputManager 处理道具栏点击
    return false;
  }

  private handleRetreatConfirmTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const w = Math.min(320, screenW - 32);
    const h = 200;
    const mx = (screenW - w) / 2;
    const my = (screenH - h) / 2;
    const btnW = (w - 32 - 8) / 2;
    const btnH = 34;
    const btnY = my + h - btnH - 16;
    const cancelRect: Rect = { x: mx + 16, y: btnY, w: btnW, h: btnH };
    const confirmRect: Rect = { x: mx + 16 + btnW + 8, y: btnY, w: btnW, h: btnH };

    if (type === "start") {
      if (hitTest(x, y, cancelRect)) { this.pressedConfirmRetreatBtn = "cancel"; return true; }
      if (hitTest(x, y, confirmRect)) { this.pressedConfirmRetreatBtn = "confirm"; return true; }
      return true; // 遮罩消费所有触摸
    } else if (type === "end") {
      const pressed = this.pressedConfirmRetreatBtn;
      this.pressedConfirmRetreatBtn = null;
      if (pressed === "cancel" && hitTest(x, y, cancelRect)) {
        this.confirmRetreat = false;
        playSfx("click");
      } else if (pressed === "confirm" && hitTest(x, y, confirmRect)) {
        this.confirmRetreat = false;
        playSfx("click");
        // 触发撤退结算
        this.engine?.retreat();
      }
      return true;
    }
    return true;
  }

  // ============================================================
  // ============ v9 渲染：知识弹幕 / 分层 HP / 多炮位 / RTS ============
  // ============================================================

  /** v9 T1：顶部知识弹幕横幅（拆模块/拆层时触发，3-4 秒显眼提示） */
  private renderKnowledgeBanner(ctx: CanvasRenderingContext2D, screenW: number): void {
    const remain = this.hud?.knowledgeTipRemain ?? 0;
    if (remain <= 0) return;
    const text = this.hud?.knowledgeTipText ?? "";
    if (!text) return;
    const w = Math.min(640, screenW - 32);
    const h = 40;
    const x = (screenW - w) / 2;
    const y = 96; // 天气徽章之下
    const alpha = Math.min(1, remain) * (remain < 0.5 ? remain / 0.5 : 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    // 背景：反诈蓝渐变 + 左侧图标块
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, Theme.colors.bg.panel);
    grad.addColorStop(0.5, withAlpha("#00E5FF", 0.18));
    grad.addColorStop(1, Theme.colors.bg.panel);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = withAlpha("#00E5FF", 0.6);
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();
    // 左侧图标
    ctx.fillStyle = "#00E5FF";
    ctx.font = `700 18px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📖", x + 22, y + h / 2);
    // 文本
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.font = `600 14px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.fillText(text, x + 44, y + h / 2);
    // 右侧倒计时进度条
    const pct = Math.max(0, Math.min(1, remain / 4));
    ctx.fillStyle = withAlpha("#00E5FF", 0.25);
    roundRect(ctx, x + w - 60, y + h / 2 - 2, 48, 4, 2);
    ctx.fill();
    ctx.fillStyle = "#00E5FF";
    roundRect(ctx, x + w - 60, y + h / 2 - 2, 48 * pct, 4, 2);
    ctx.fill();
    ctx.restore();
  }

  /** v9 S2：园区分层 HP 条（外墙/内墙/核心/金库 4 段，叠加在主 HP 条左侧） */
  private renderLayerHpBars(ctx: CanvasRenderingContext2D, _screenW: number): void {
    const layers = this.hud?.parkLayers;
    if (!layers || layers.length === 0) return;
    // 引擎画布 960×540，按比例缩放。分层条放在园区建筑下方
    const baseX = 635;
    const baseY = 482;
    const barW = 210;
    const gap = 3;
    const segH = 7;
    ctx.save();
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      const yy = baseY + i * (segH + gap);
      // 背景轨道
      ctx.fillStyle = withAlpha(l.color, 0.18);
      roundRect(ctx, baseX, yy, barW, segH, 2);
      ctx.fill();
      // HP 填充
      const pct = l.maxHp > 0 ? Math.max(0, l.hp / l.maxHp) : 0;
      ctx.fillStyle = l.cleared ? withAlpha("#52C41A", 0.35) : l.color;
      roundRect(ctx, baseX, yy, barW * pct, segH, 2);
      ctx.fill();
      // 层名 + emoji
      ctx.fillStyle = l.cleared ? withAlpha(Theme.colors.ink.muted, 0.6) : l.color;
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${l.emoji} ${l.name}`, baseX - 50, yy + segH / 2);
      // 已拆标记
      if (l.cleared) {
        ctx.fillStyle = "#52C41A";
        ctx.fillText("✓", baseX + barW + 6, yy + segH / 2);
      }
    }
    ctx.restore();
  }

  /** v9 S1：多炮位 HUD（底部炮位切换/开关按钮） */
  private renderMultiCannonHud(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number): void {
    const slots = this.hud?.cannonSlots;
    if (!slots || slots.length === 0) return;
    // 炮位按钮排布在画布左侧底部（主炮 300,432 左右）
    const btnW = 56, btnH = 28, gap = 6;
    const totalW = slots.length * btnW + (slots.length - 1) * gap;
    const startX = 200 - totalW / 2 + btnW / 2;
    const y = 506;
    ctx.save();
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const x = startX + i * (btnW + gap);
      const isActive = s.id === this.hud?.activeCannonId;
      const isUnlocked = s.active;
      const rect: Rect = { x: x - btnW / 2, y: y - btnH / 2, w: btnW, h: btnH };
      const pressed = this.pressedCannonId === s.id;
      // 背景
      let bg = withAlpha(Theme.colors.bg.panel, 0.85);
      if (isActive) bg = withAlpha("#FF7A1A", 0.85);
      else if (!isUnlocked) bg = withAlpha(Theme.colors.bg.panel, 0.5);
      ctx.fillStyle = bg;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
      ctx.fill();
      ctx.strokeStyle = isActive ? "#FFD666" : withAlpha(Theme.colors.ink.muted, 0.4);
      ctx.lineWidth = isActive ? 2 : 1;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
      ctx.stroke();
      if (pressed) {
        ctx.fillStyle = withAlpha("#FFFFFF", 0.15);
        roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
        ctx.fill();
      }
      // emoji + 名称
      ctx.fillStyle = isUnlocked ? Theme.colors.ink.DEFAULT : withAlpha(Theme.colors.ink.muted, 0.5);
      ctx.font = `700 13px ${Theme.fonts.mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.emoji, x, y - 4);
      ctx.font = `600 8px ${Theme.fonts.mono}`;
      ctx.fillText(s.name, x, y + 8);
      // 未解锁标记
      if (!isUnlocked) {
        ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.6);
        ctx.font = `600 7px ${Theme.fonts.mono}`;
        ctx.fillText("🔒", x + btnW / 2 - 8, y - btnH / 2 + 4);
      }
    }
    ctx.restore();
    // 提示文字
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.6);
    ctx.font = `500 8px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.fillText("点击切换操控炮位", 200, y - btnH / 2 - 6);
  }

  /** v9 多炮位按钮触摸命中测试 */
  private handleCannonHudTouch(x: number, y: number): boolean {
    const slots = this.hud?.cannonSlots;
    if (!slots) return false;
    const btnW = 56, btnH = 28, gap = 6;
    const totalW = slots.length * btnW + (slots.length - 1) * gap;
    const startX = 200 - totalW / 2 + btnW / 2;
    const by = 506;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const bx = startX + i * (btnW + gap);
      const rect: Rect = { x: bx - btnW / 2, y: by - btnH / 2, w: btnW, h: btnH };
      if (hitTest(x, y, rect)) {
        if (s.active && s.id !== this.hud?.activeCannonId) {
          this.engine?.setActiveCannon(s.id);
        }
        this.pressedCannonId = s.id;
        setTimeout(() => { this.pressedCannonId = null; }, 120);
        return true;
      }
    }
    return false;
  }

  /** v9 S3：波次间隙 RTS 升级面板（模态，3 个待选项 + 跳过按钮） */
  private renderRTSPanel(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const offerings = hud.rtsOfferings ?? [];
    const rtsState = hud.rtsUpgrades ?? {};
    const fragments = hud.clueFragments ?? 0;
    // 遮罩
    ctx.save();
    ctx.fillStyle = withAlpha("#000000", 0.55);
    ctx.fillRect(0, 0, screenW, screenH);
    // 面板
    const pw = Math.min(560, screenW - 32);
    const ph = Math.min(380, screenH - 32);
    const px = (screenW - pw) / 2;
    const py = (screenH - ph) / 2;
    drawPanel(ctx, px, py, pw, ph);
    // 标题
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("波次间隙 · 战术升级", px + pw / 2, py + 12);
    // 线索碎片余额
    ctx.fillStyle = "#9FE3FF";
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.fillText(`🔍 线索碎片: ${fragments}`, px + 16, py + 38);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.font = `500 11px ${Theme.fonts.mono}`;
    ctx.fillText("选择一项升级强化炮兵部队", px + 16, py + 58);
    // 3 个升级卡片
    const cardW = (pw - 32 - 16) / 3;
    const cardH = 150;
    const cardY = py + 88;
    for (let i = 0; i < offerings.length; i++) {
      const id = offerings[i];
      const node = RTS_NODE_MAP[id as RTSUpgradeId];
      const cx = px + 16 + i * (cardW + 8);
      const curLv = rtsState[id] ?? 0;
      const maxed = curLv >= node.maxLevel;
      const affordable = fragments >= node.costPerLevel;
      const rect: Rect = { x: cx, y: cardY, w: cardW, h: cardH };
      const pressed = this.pressedRtsNodeId === id;
      // 卡片背景
      let bg = withAlpha(Theme.colors.bg.panel, 0.9);
      if (maxed) bg = withAlpha("#52C41A", 0.15);
      else if (!affordable) bg = withAlpha(Theme.colors.bg.panel, 0.6);
      ctx.fillStyle = bg;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
      ctx.fill();
      ctx.strokeStyle = pressed ? "#FFD666" : withAlpha(node.icon === "🛡" ? "#00E5FF" : "#FF7A1A", 0.5);
      ctx.lineWidth = pressed ? 2.5 : 1.5;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
      ctx.stroke();
      // 图标
      ctx.font = `700 28px ${Theme.fonts.mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = maxed ? "#52C41A" : (affordable ? "#FFD666" : withAlpha(Theme.colors.ink.muted, 0.5));
      ctx.fillText(node.icon, cx + cardW / 2, cardY + 32);
      // 名称
      ctx.fillStyle = maxed ? "#52C41A" : Theme.colors.ink.DEFAULT;
      ctx.font = `700 14px ${Theme.fonts.mono}`;
      ctx.fillText(node.name, cx + cardW / 2, cardY + 60);
      // 描述
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
      ctx.font = `500 10px ${Theme.fonts.mono}`;
      this.wrapText(ctx, node.desc, cx + cardW / 2, cardY + 80, cardW - 12, 12);
      // 等级条
      const lvBarW = cardW - 24;
      const lvBarH = 5;
      const lvBarX = cx + 12;
      const lvBarY = cardY + 112;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.2);
      roundRect(ctx, lvBarX, lvBarY, lvBarW, lvBarH, 2);
      ctx.fill();
      ctx.fillStyle = "#00E5FF";
      roundRect(ctx, lvBarX, lvBarY, lvBarW * (curLv / node.maxLevel), lvBarH, 2);
      ctx.fill();
      // 费用 / 已满级
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = maxed ? "#52C41A" : (affordable ? "#9FE3FF" : "#E5353B");
      ctx.fillText(maxed ? "已满级" : `🔍 ${node.costPerLevel} 碎片`, cx + cardW / 2, cardY + 128);
      ctx.font = `500 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.7);
      ctx.fillText(`LV ${curLv}/${node.maxLevel}`, cx + cardW / 2, cardY + 140);
    }
    // 跳过按钮
    const skipW = 120, skipH = 32;
    const skipX = px + pw - skipW - 16;
    const skipY = py + ph - skipH - 14;
    drawButton(ctx, skipX, skipY, skipW, skipH, "跳过 ›", { variant: "ghost", pressed: this.pressedRtsSkip, accent: "#FF7A1A" });
    ctx.restore();
  }

  /** v9 RTS 面板触摸处理 */
  private handleRTSTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const hud = this.hud!;
    const offerings = hud.rtsOfferings ?? [];
    const pw = Math.min(560, screenW - 32);
    const ph = Math.min(380, screenH - 32);
    const px = (screenW - pw) / 2;
    const py = (screenH - ph) / 2;
    const cardW = (pw - 32 - 16) / 3;
    const cardH = 150;
    const cardY = py + 88;
    const skipW = 120, skipH = 32;
    const skipX = px + pw - skipW - 16;
    const skipY = py + ph - skipH - 14;
    if (type === "start") {
      // 升级卡片按下
      for (let i = 0; i < offerings.length; i++) {
        const cx = px + 16 + i * (cardW + 8);
        const rect: Rect = { x: cx, y: cardY, w: cardW, h: cardH };
        if (hitTest(x, y, rect)) { this.pressedRtsNodeId = offerings[i]; return true; }
      }
      // 跳过按下
      if (hitTest(x, y, { x: skipX, y: skipY, w: skipW, h: skipH })) {
        this.pressedRtsSkip = true;
        return true;
      }
      return true; // 模态消费所有触摸
    } else if (type === "end") {
      const pressed = this.pressedRtsNodeId;
      this.pressedRtsNodeId = null;
      const skipPressed = this.pressedRtsSkip;
      this.pressedRtsSkip = false;
      // 升级卡片释放
      if (pressed) {
        const idx = offerings.indexOf(pressed);
        if (idx >= 0) {
          const cx = px + 16 + idx * (cardW + 8);
          const rect: Rect = { x: cx, y: cardY, w: cardW, h: cardH };
          if (hitTest(x, y, rect)) {
            this.engine?.chooseRTSUpgrade(pressed);
            return true;
          }
        }
      }
      // 跳过释放
      if (skipPressed && hitTest(x, y, { x: skipX, y: skipY, w: skipW, h: skipH })) {
        this.engine?.skipRTSUpgrade();
        return true;
      }
      return true;
    }
    return true;
  }

  /** 简易文本换行绘制（用于 RTS 卡片描述） */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, lineH: number): void {
    const chars = text.split("");
    let line = "";
    let yy = cy;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        ctx.fillText(line, cx, yy);
        line = ch;
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  // ============ v10 B2：动态事件面板 ============

  /** v10 B2：波次间隙动态事件面板（模态：场景描述 + 选项卡片 + 结果/继续按钮） */
  private renderDynamicEventPanel(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const de = hud.dynamicEvent;
    if (!de) return;
    const ev = de.event;
    // 遮罩
    ctx.save();
    ctx.fillStyle = withAlpha("#000000", 0.6);
    ctx.fillRect(0, 0, screenW, screenH);
    // 面板
    const pw = Math.min(520, screenW - 32);
    const ph = Math.min(420, screenH - 32);
    const px = (screenW - pw) / 2;
    const py = (screenH - ph) / 2;
    drawPanel(ctx, px, py, pw, ph, { borderColor: withAlpha(ev.color, 0.5) });
    // 顶部色条
    ctx.fillStyle = ev.color;
    ctx.fillRect(px, py, pw, 3);
    // 标题行：图标 + 标题 + 知识点标签
    ctx.font = `700 20px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = ev.color;
    ctx.fillText(`${ev.icon} ${ev.title}`, px + 16, py + 14);
    // 知识点标签
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
    ctx.textAlign = "right";
    ctx.fillText(`📖 ${ev.knowledgePoint}`, px + pw - 16, py + 18);
    // 场景描述（换行）
    ctx.font = `500 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    this.wrapText(ctx, ev.scenario, px + 16, py + 48, pw - 32, 18);
    // 选项卡片（纵向排列）
    const choiceY = py + 120;
    const choiceH = 56;
    const choiceGap = 8;
    for (let i = 0; i < ev.choices.length; i++) {
      const c = ev.choices[i];
      const cy = choiceY + i * (choiceH + choiceGap);
      const cw = pw - 32;
      const cx = px + 16;
      const pressed = this.pressedEventChoiceIdx === i;
      const selected = de.selectedIdx === i;
      const resolved = de.resolved;
      // 卡片背景
      let bg = withAlpha(Theme.colors.bg.panel, 0.9);
      let border = withAlpha(ev.color, 0.3);
      if (selected && c.optimal) {
        bg = withAlpha("#52C41A", 0.15); border = "#52C41A";
      } else if (selected && !c.optimal) {
        bg = withAlpha("#E5353B", 0.12); border = "#E5353B";
      } else if (pressed) {
        border = ev.color;
      }
      ctx.fillStyle = bg;
      roundRect(ctx, cx, cy, cw, choiceH, 8);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = (pressed || selected) ? 2 : 1;
      roundRect(ctx, cx, cy, cw, choiceH, 8);
      ctx.stroke();
      // 选项序号
      ctx.font = `700 14px ${Theme.fonts.mono}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = selected ? (c.optimal ? "#52C41A" : "#E5353B") : ev.color;
      ctx.fillText(`${String.fromCharCode(65 + i)}`, cx + 12, cy + 12);
      // 选项文本
      ctx.font = `500 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      this.wrapText(ctx, c.text, cx + 32, cy + 12, cw - 44, 14);
      // 已解决时显示结果
      if (resolved && selected) {
        ctx.font = `500 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = c.optimal ? "#52C41A" : withAlpha(Theme.colors.ink.muted, 0.9);
        this.wrapText(ctx, `→ ${c.result}`, cx + 32, cy + 34, cw - 44, 12);
      }
    }
    // 已解决时显示继续按钮
    if (de.resolved) {
      const btnW = 140, btnH = 36;
      const btnX = px + (pw - btnW) / 2;
      const btnY = py + ph - btnH - 14;
      drawButton(ctx, btnX, btnY, btnW, btnH, "继续 ›", {
        variant: "primary", accent: ev.color, pressed: this.pressedEventDismiss,
      });
    }
    ctx.restore();
  }

  /** v10 B2：动态事件面板触摸处理 */
  private handleDynamicEventTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const hud = this.hud!;
    const de = hud.dynamicEvent;
    if (!de) return true;
    const pw = Math.min(520, screenW - 32);
    const ph = Math.min(420, screenH - 32);
    const px = (screenW - pw) / 2;
    const py = (screenH - ph) / 2;
    const choiceY = py + 120;
    const choiceH = 56;
    const choiceGap = 8;
    const btnW = 140, btnH = 36;
    const btnX = px + (pw - btnW) / 2;
    const btnY = py + ph - btnH - 14;
    if (type === "start") {
      // 已解决时点继续按钮
      if (de.resolved && hitTest(x, y, { x: btnX, y: btnY, w: btnW, h: btnH })) {
        this.pressedEventDismiss = true;
        return true;
      }
      // 未解决时点选项卡片
      if (!de.resolved) {
        for (let i = 0; i < de.event.choices.length; i++) {
          const cy = choiceY + i * (choiceH + choiceGap);
          if (hitTest(x, y, { x: px + 16, y: cy, w: pw - 32, h: choiceH })) {
            this.pressedEventChoiceIdx = i;
            return true;
          }
        }
      }
      return true; // 模态消费
    } else if (type === "end") {
      const dismissPressed = this.pressedEventDismiss;
      const choicePressed = this.pressedEventChoiceIdx;
      this.pressedEventDismiss = false;
      this.pressedEventChoiceIdx = null;
      if (dismissPressed && de.resolved && hitTest(x, y, { x: btnX, y: btnY, w: btnW, h: btnH })) {
        this.engine?.dismissDynamicEvent();
        return true;
      }
      if (choicePressed !== null && !de.resolved) {
        const cy = choiceY + choicePressed * (choiceH + choiceGap);
        if (hitTest(x, y, { x: px + 16, y: cy, w: pw - 32, h: choiceH })) {
          this.engine?.resolveDynamicEvent(choicePressed);
          return true;
        }
      }
      return true;
    }
    return true;
  }

  // ============ v10 C1：知识问答面板 ============

  /** v10 C1：波次间隙知识问答面板（模态：题目 + 选项 + 解析 + 继续按钮） */
  private renderQuizPanel(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const q = hud.waveGapQuiz;
    if (!q) return;
    const accent = "#00E5FF";
    // 遮罩
    ctx.save();
    ctx.fillStyle = withAlpha("#000000", 0.6);
    ctx.fillRect(0, 0, screenW, screenH);
    // 面板
    const pw = Math.min(520, screenW - 32);
    const ph = Math.min(440, screenH - 32);
    const px = (screenW - pw) / 2;
    const py = (screenH - ph) / 2;
    drawPanel(ctx, px, py, pw, ph, { borderColor: withAlpha(accent, 0.5) });
    // 顶部色条
    ctx.fillStyle = accent;
    ctx.fillRect(px, py, pw, 3);
    // 标题
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = accent;
    ctx.fillText("📋 反诈知识问答", px + 16, py + 14);
    // 知识点标签
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
    ctx.textAlign = "right";
    ctx.fillText(`📖 ${q.knowledgePoint}`, px + pw - 16, py + 18);
    // 题目（换行）
    ctx.font = `600 14px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    this.wrapText(ctx, q.question, px + 16, py + 44, pw - 32, 18);
    // 选项卡片
    const optY = py + 110;
    const optH = 48;
    const optGap = 8;
    for (let i = 0; i < q.options.length; i++) {
      const oy = optY + i * (optH + optGap);
      const ow = pw - 32;
      const ox = px + 16;
      const pressed = this.pressedQuizChoiceIdx === i;
      const selected = q.selectedIdx === i;
      const answered = q.answered;
      const isCorrect = i === q.correctIdx;
      // 卡片背景
      let bg = withAlpha(Theme.colors.bg.panel, 0.9);
      let border = withAlpha(accent, 0.3);
      if (answered && isCorrect) {
        bg = withAlpha("#52C41A", 0.15); border = "#52C41A";
      } else if (answered && selected && !isCorrect) {
        bg = withAlpha("#E5353B", 0.12); border = "#E5353B";
      } else if (pressed) {
        border = accent;
      }
      ctx.fillStyle = bg;
      roundRect(ctx, ox, oy, ow, optH, 8);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = (pressed || (answered && (isCorrect || selected))) ? 2 : 1;
      roundRect(ctx, ox, oy, ow, optH, 8);
      ctx.stroke();
      // 序号
      ctx.font = `700 13px ${Theme.fonts.mono}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const marker = answered && isCorrect ? "✓" : (answered && selected ? "✗" : String.fromCharCode(65 + i));
      ctx.fillStyle = answered && isCorrect ? "#52C41A" : (answered && selected ? "#E5353B" : accent);
      ctx.fillText(marker, ox + 12, oy + 14);
      // 选项文本
      ctx.font = `500 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.fillText(q.options[i], ox + 32, oy + 16);
    }
    // 已作答时显示解析
    if (q.answered) {
      const expY = optY + q.options.length * (optH + optGap) + 4;
      ctx.font = `500 11px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.95);
      ctx.textAlign = "left";
      this.wrapText(ctx, `💡 ${q.explain}`, px + 16, expY, pw - 32, 14);
      // 继续按钮
      const btnW = 140, btnH = 36;
      const btnX = px + (pw - btnW) / 2;
      const btnY = py + ph - btnH - 14;
      drawButton(ctx, btnX, btnY, btnW, btnH, "继续 ›", {
        variant: "primary", accent, pressed: this.pressedQuizDismiss,
      });
    }
    ctx.restore();
  }

  /** v10 C1：知识问答面板触摸处理 */
  private handleQuizTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const hud = this.hud!;
    const q = hud.waveGapQuiz;
    if (!q) return true;
    const pw = Math.min(520, screenW - 32);
    const ph = Math.min(440, screenH - 32);
    const px = (screenW - pw) / 2;
    const py = (screenH - ph) / 2;
    const optY = py + 110;
    const optH = 48;
    const optGap = 8;
    const btnW = 140, btnH = 36;
    const btnX = px + (pw - btnW) / 2;
    const btnY = py + ph - btnH - 14;
    if (type === "start") {
      if (q.answered && hitTest(x, y, { x: btnX, y: btnY, w: btnW, h: btnH })) {
        this.pressedQuizDismiss = true;
        return true;
      }
      if (!q.answered) {
        for (let i = 0; i < q.options.length; i++) {
          const oy = optY + i * (optH + optGap);
          if (hitTest(x, y, { x: px + 16, y: oy, w: pw - 32, h: optH })) {
            this.pressedQuizChoiceIdx = i;
            return true;
          }
        }
      }
      return true;
    } else if (type === "end") {
      const dismissPressed = this.pressedQuizDismiss;
      const choicePressed = this.pressedQuizChoiceIdx;
      this.pressedQuizDismiss = false;
      this.pressedQuizChoiceIdx = null;
      if (dismissPressed && q.answered && hitTest(x, y, { x: btnX, y: btnY, w: btnW, h: btnH })) {
        this.engine?.dismissQuiz();
        return true;
      }
      if (choicePressed !== null && !q.answered) {
        const oy = optY + choicePressed * (optH + optGap);
        if (hitTest(x, y, { x: px + 16, y: oy, w: pw - 32, h: optH })) {
          this.engine?.answerQuiz(choicePressed);
          return true;
        }
      }
      return true;
    }
    return true;
  }

  // ============ v10 B1：连携槽 UI ============

  /** v10 B1：连携充能槽 UI（战斗中常驻：充能进度条 + 大招状态） */
  private renderSynergyGauge(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const syn = hud.synergy;
    if (!syn) return;
    // 连携槽位置：屏幕底部中央偏上（引擎画布坐标 960×540）
    const gw = 180;
    const gh = 14;
    const gx = (screenW - gw) / 2;
    const gy = 500; // 引擎画布底部区域
    // 背景槽
    ctx.save();
    roundRect(ctx, gx, gy, gw, gh, gh / 2);
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.8);
    ctx.fill();
    // 充能进度
    const ratio = syn.energy / 100;
    if (ratio > 0) {
      const skillDef = SYNERGY_SKILLS[syn.availableSkill];
      const color = syn.ready ? "#FFD666" : skillDef.color;
      roundRect(ctx, gx, gy, gw * ratio, gh, gh / 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = syn.ready ? 12 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // 标签
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const skillDef = SYNERGY_SKILLS[syn.availableSkill];
    const label = syn.activeRemain > 0
      ? `${skillDef.emoji} ${skillDef.name} ${Math.ceil(syn.activeRemain)}s`
      : syn.ready
        ? `${skillDef.emoji} 连携就绪`
        : `连携 ${Math.floor(syn.energy)}%`;
    ctx.fillStyle = syn.ready ? "#FFD666" : withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(label, screenW / 2, gy - 2);
    ctx.restore();
  }

  exit(): void {
    super.exit();
    setOrientation("portrait");
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.engineCanvas = null;
    this.resultOverlay = null;
    this.bossCodex = null;
    this.waveBriefing = null;
  }
}

/** 热线徽章 */
function drawHotlineBadge(ctx: CanvasRenderingContext2D, x: number, y: number, hotline: string, color: string): void {
  ctx.save();
  ctx.fillStyle = withAlpha(color, 0.18);
  ctx.strokeStyle = withAlpha(color, 0.7);
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, 96, 22, 11);
  ctx.fill();
  ctx.stroke();
  ctx.font = `700 11px ${Theme.fonts.mono}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`📞 ${hotline}`, x + 48, y + 12);
  ctx.restore();
}

/** 文本换行辅助 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
