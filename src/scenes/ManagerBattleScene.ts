/**
 * 「反诈职业经理人」战斗阶段
 * 引擎画布 960×540 横屏，进入时 setOrientation("landscape")
 * Scene 负责大招按钮 + 重新部署 + 模式 HUD（BOSS 血条/限时倒计时/无尽波数） + 结算
 * v3：连击 HUD / 元素克制提示 / BOSS 阶段 / 每日挑战 / 探员独有大招 / 持久化
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawButton, drawProgressBar, drawToast, drawNeonCorners, drawPanel, hitTest, type Rect } from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { ManagerEngine } from "@/games/manager/engine";
import type {
  ManagerHud, DeploySlot, ManagerMode, AgentUpgradeKind,
  DialogueLine, TacticalDeviceKind, ChallengeAffix,
  TacticalCommandKind,
} from "@/games/manager/types";
import {
  MODE_META, TACTICAL_DEVICES, ELEMENT_REACTIONS,
  BOSS_RUSH_BOSSES, getBossDialogue, seasonRankFromScore,
  TACTICAL_COMMANDS, AGENTS,
} from "@/games/manager/data";
import { getCaseByEnemyId, STORY_CHAPTERS } from "@/games/manager/data.v7";
import type { RealCaseDef } from "@/games/manager/types";
import type { V7ManagerReportData } from "@/utils/battleReport";
import type { MazeDef } from "@/games/manager/maze";
import { MAZE_CELL, MAZE_COLS, MAZE_ROWS, MAZE_OFFSET_X, MAZE_OFFSET_Y } from "@/games/manager/maze";
import { roundRect } from "@/engine/Renderer";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import { TutorialOverlay } from "./TutorialOverlay";
import { fontScale } from "./AccessibilityOverlay";
import { platformStore } from "@/store/platformStore";
import type { GameEvent, GameResultPayload } from "@/types";

export class ManagerBattleScene extends GameShellScene {
  private engine: ManagerEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private deployment: DeploySlot[] = [];
  private mode: ManagerMode = "classic";
  /** v4：部署阶段传入的迷宫（与玩家岗哨位布局一致） */
  private maze: MazeDef | null = null;
  /** v8：classic 模式下指定的起始关卡（1..4） */
  private startLevel: number | undefined = undefined;
  private hud: ManagerHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  /** v7 D1：战斗新手引导（首次进入时展示） */
  private tutorialOverlay: TutorialOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedUlt = false;
  private pressedRedeploy = false;
  /** v11：重部署目标格按压中（pickingTarget 模式下点击棋盘时置位） */
  private pressedRedeployTarget = false;
  private pressedUpgradeIdx: number | null = null;
  private t = 0;
  private pulse = 0;

  // ===== v6 Phase 3：战间答题 UI =====
  private pressedQuizIdx: number | null = null;

  // ===== v7：爬塔事件 UI =====
  private pressedEventOptionIdx: number | null = null;

  // ===== v6 Phase 3：战术装置 UI =====
  private pressedDeviceIdx: number | null = null;
  private pressedTacticalPause = false;
  /** 当前处于"放置模式"的装置索引（下次点击战场区域放置） */
  private placingDeviceIdx: number | null = null;

  // ===== v6 Phase 3：BOSS 对话 UI =====
  private bossDialogue: { lines: DialogueLine[]; idx: number } | null = null;
  private bossDialoguePhase: "intro" | "outro" | null = null;
  /** 上一帧的 bossName（用于检测 BOSS 出现 → 触发 intro） */
  private prevBossName: string | undefined = undefined;
  /** 上一帧的 bossHp（用于检测 BOSS 死亡 → 触发 outro） */
  private prevBossHp: number | undefined = undefined;
  /** 已触发过 intro 的 bossName 集合（避免重复触发） */
  private introTriggeredBosses = new Set<string>();

  // ===== v6 Phase 3：极限挑战词缀（仅 challenge 模式，由 DeployScene 传入用于 HUD 展示） =====
  private challengeAffixes: ChallengeAffix[] = [];

  // ===== v8 全面升级：UI 交互状态 =====
  /** 当前选中的话术气泡 id（点击口诀槽时击破此气泡） */
  private selectedBubbleId: number | null = null;
  /** 卡牌手牌按压索引 */
  private pressedCardIdx: number | null = null;
  /** 口诀槽按压索引 */
  private pressedCounterspellIdx: number | null = null;
  /** 战术指令按钮按压索引 */
  private pressedCommandIdx: number | null = null;
  /** 案例复盘步骤按压索引 */
  private pressedBreakdownIdx: number | null = null;
  /** 探员选择按压索引（点击探员头像选中） */
  private pressedAgentIdx: number | null = null;
  /** v8：案例复盘答题时间戳（答题后 1.8s 自动关闭 overlay） */
  private caseBreakdownAnsweredAt: number | null = null;

  getGameTitle(): string { return "反诈职业经理人"; }
  getGameSubtitle(): string { return "MANAGER"; }
  getAccent(): string {
    return MODE_META[this.mode]?.accent ?? Theme.accents.manager;
  }

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    this.deployment = (params?.deployment as DeploySlot[]) ?? [];
    this.mode = (params?.mode as ManagerMode) ?? "classic";
    this.maze = (params?.maze as MazeDef | undefined) ?? null;
    this.challengeAffixes = (params?.challengeAffixes as ChallengeAffix[] | undefined) ?? [];
    this.startLevel = (params?.startLevel as number | undefined) ?? undefined;
    setOrientation("landscape");
    this.spawnEngine();
    // v7 D1：首次进入战斗展示新手引导
    this.tutorialOverlay = TutorialOverlay.maybeCreate(this.director, {
      step: "battle",
      title: "战斗阶段",
      emoji: "⚔️",
      accent: Theme.accents.manager,
      tips: [
        { emoji: "🎯", text: "探员自动攻击范围内敌人，无需操作" },
        { emoji: "💥", text: "能量满后点击右下「大招」释放探员终极技" },
        { emoji: "👹", text: "BOSS 出现时顶部显示血条，击败解锁真实案例" },
        { emoji: "📜", text: "每 5 波弹出战间答题，答对加分并收集口诀" },
      ],
    });
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new ManagerEngine(canvas, this.deployment, this.mode, this.maze ?? undefined, this.startLevel);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    // 由 updateGame/renderGame 同步驱动，消除双 RAF 撕裂闪烁
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      const hud = e.payload as unknown as ManagerHud;
      this.hud = hud;
      // v6 Phase 3：BOSS 对话触发检测
      this.detectBossDialogue(hud);
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 3 };
      this.toastTimer = 0;
    } else if (e.type === "result") {
      this.onResult(e.payload);
    }
  }

  /**
   * v6 Phase 3：BOSS 对话触发
   * - intro：bossName 从 undefined → 有值时触发（每个 BOSS 仅触发一次）
   * - outro：bossHp 从有值 → undefined 时触发（bossRush 模式下 BOSS 死亡）
   * 通过 bossName 在 BOSS_RUSH_BOSSES 中查找 bossId，再取 getBossDialogue
   */
  private detectBossDialogue(hud: ManagerHud): void {
    // 对话进行中不触发新对话
    if (this.bossDialogue) return;
    const name = hud.bossName;
    const hp = hud.bossHp;
    // intro：BOSS 出现（name 从 undefined → 有值，且 hp > 0）
    if (name && !this.prevBossName && hp !== undefined && hp > 0 && !this.introTriggeredBosses.has(name)) {
      this.introTriggeredBosses.add(name);
      this.triggerBossDialogue(name, "intro");
    }
    // outro：BOSS 死亡（hp 从有值 → undefined，且之前有 name）
    if (this.prevBossHp !== undefined && hp === undefined && this.prevBossName) {
      this.triggerBossDialogue(this.prevBossName, "outro");
    }
    this.prevBossName = name;
    this.prevBossHp = hp;
  }

  /** 通过 bossName 查找 bossId 并触发对话 */
  private triggerBossDialogue(bossName: string, phase: "intro" | "outro"): void {
    const boss = BOSS_RUSH_BOSSES.find((b) => b.name === bossName);
    if (!boss) return;
    const dialogue = getBossDialogue(boss.id);
    if (!dialogue) return;
    const lines = phase === "intro" ? dialogue.intro : dialogue.outro;
    if (!lines || lines.length === 0) return;
    this.bossDialogue = { lines, idx: 0 };
    this.bossDialoguePhase = phase;
  }

  private onResult(result: GameResultPayload): void {
    // v3：记录经理人模块进度
    let realCase: RealCaseDef | undefined;
    // v7：战报分享数据（仅 manager 模块填充）
    let v7ManagerData: V7ManagerReportData | undefined;
    if (this.engine) {
      const progress = this.engine.getProgressData();
      const isDailyWin = this.mode === "daily" && result.win;
      platformStore.recordManagerGame({
        mode: progress.mode,
        score: progress.score,
        win: progress.win,
        level: progress.level,
        wave: progress.wave,
        killsByAgent: progress.killsByAgent,
        bossKills: progress.bossKills,
        dailyCompleted: isDailyWin,
      });
      // v7：取本局最后击破的 BOSS 关联真实案例
      if (progress.lastDefeatedBossId) {
        realCase = getCaseByEnemyId(progress.lastDefeatedBossId);
        // 解锁案例到档案（持久化）
        if (realCase) {
          platformStore.unlockCase(realCase.id);
        }
      }
      // v7：更新排行榜（每日/每周/赛季）
      const now = new Date();
      const dailyKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const weekKey = `${now.getFullYear()}-W${String(Math.ceil(((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7))).padStart(2, "0")}`;
      platformStore.updateLeaderboard("daily", progress.score, dailyKey);
      platformStore.updateLeaderboard("weekly", progress.score, weekKey);
      platformStore.updateLeaderboard("season", progress.score, "");

      // v7：组装战报分享数据
      const meta = platformStore.managerMetaProgress();
      const modeLabel = MODE_META[progress.mode]?.label ?? progress.mode;
      const seasonRank = progress.score > 0 ? String(seasonRankFromScore(meta.seasonScore)) : "";
      v7ManagerData = {
        mode: progress.mode,
        modeLabel,
        towerFloor: progress.mode === "tower" ? progress.towerFloor : 0,
        realCase,
        newlyCollectedTerms: progress.newlyCollectedTerms,
        seasonRank,
        seasonScore: meta.seasonScore,
        leaderboardDailyRank: meta.leaderboard.daily.rank || 0,
        leaderboardWeeklyRank: meta.leaderboard.weekly.rank || 0,
      };

      // v7 B4：bossRush 模式下击败 BOSS → 自动标记对应剧情章节完成
      if (progress.mode === "bossRush" && progress.lastDefeatedBossId) {
        const matchedChapter = STORY_CHAPTERS.find(
          (c) => c.bossId === progress.lastDefeatedBossId && !meta.completedStoryChapters.includes(c.id),
        );
        if (matchedChapter) {
          platformStore.completeStoryChapter(matchedChapter.id);
        }
      }
    }
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director)),
      // v10 P0-1d：结算页串联渲染"真实案例 + 本局学到的反诈知识点"
      // - 有 realCase：先案例面板，下方 16px 处再渲染知识点面板
      // - 无 realCase：仅渲染知识点面板（确保教育闭环始终可见）
      renderExtraStats: (ctx, x, y, w) => {
        let cursorY = y;
        if (realCase) {
          const caseH = this.renderRealCasePanel(ctx, x, cursorY, w, realCase!);
          cursorY += caseH + 16;
        }
        // v10：从 result.stats 读取本局学到的反诈知识点
        const tips = readLearnedTipsFromStats(result.stats);
        if (tips.length > 0) {
          const tipsH = this.renderLearnedTipsPanel(ctx, x, cursorY, w, tips);
          cursorY += tipsH + 8;
        }
        return cursorY - y;
      },
      // v7：战报分享数据
      v7ManagerData,
    });
  }

  /**
   * v7：结算页真实案例面板
   * 展示案例标题、年份、摘要、涉案金额、受害群体、破获单位、反诈提示、96110
   */
  private renderRealCasePanel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number,
    realCase: RealCaseDef,
  ): number {
    const accent = realCase.color;
    const panelH = 168;

    // 背景
    ctx.save();
    ctx.fillStyle = withAlpha(accent, 0.06);
    roundRect(ctx, x, y, w, panelH, 8);
    ctx.fill();
    ctx.restore();
    // 左边框
    ctx.save();
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 3, panelH);
    ctx.restore();

    // 标题行：emoji + 案件标题 + 年份徽章
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${realCase.emoji}  ${realCase.title}`, x + 12, y + 10);
    ctx.restore();
    // 年份
    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${realCase.year} · 真实案例`, x + w - 12, y + 12);
    ctx.restore();

    // 摘要正文（换行）
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const summaryLines = wrapText(ctx, realCase.summary, w - 24);
    summaryLines.forEach((line, i) => ctx.fillText(line, x + 12, y + 34 + i * 15));
    ctx.restore();

    // 关键数据行：涉案金额 / 受害群体 / 破获单位
    const statsY = y + 34 + summaryLines.length * 15 + 6;
    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.warn.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`💰 涉案 ${formatAmount(realCase.amount)}`, x + 12, statsY);
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.95);
    ctx.fillText(`👤 ${realCase.victim}`, x + 12 + 120, statsY);
    ctx.fillText(`🛡️ ${realCase.bustedBy}`, x + 12, statsY + 16);
    ctx.restore();

    // 反诈提示
    const tipY = statsY + 36;
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`💡 ${realCase.tip}`, x + 12, tipY);
    ctx.restore();

    // 96110 热线徽章
    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.warn.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`☎ ${realCase.hotline}`, x + 12, tipY + 20);
    ctx.restore();

    return panelH;
  }

  /**
   * v10 P0-1d：本局学到的反诈知识点面板
   * - 渲染为彩色 chip 网格（按击破敌人的 fraudType 去重）
   * - 底部展示累计已学知识点数（跨局统计 learnedFraudTipsTotal）
   * - 强化"战斗即学习"的教育闭环
   */
  private renderLearnedTipsPanel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number,
    tips: string[],
  ): number {
    if (tips.length === 0) return 0;
    const meta = platformStore.managerMetaProgress();
    const totalLearned = meta.learnedFraudTipsTotal;

    // 面板高度：标题(28) + chip 区(根据数量) + 累计行(20) + padding
    const chipH = 22;
    const chipGap = 6;
    const chipPadX = 8;
    const maxRowW = w - 24;
    // 估算行数：先按平均 chip 宽 80px 估算
    const estRows = Math.max(1, Math.ceil(tips.length * 90 / maxRowW));
    const panelH = 28 + estRows * (chipH + chipGap) + 24 + 12;

    // 背景
    ctx.save();
    ctx.fillStyle = "rgba(82, 196, 26, 0.06)";
    roundRect(ctx, x, y, w, panelH, 8);
    ctx.fill();
    ctx.restore();
    // 左边框（绿色，象征学习）
    ctx.save();
    ctx.fillStyle = "#52C41A";
    ctx.fillRect(x, y, 3, panelH);
    ctx.restore();

    // 标题
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = "#52C41A";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`📚 本局学到的反诈知识点（${tips.length} 条）`, x + 12, y + 10);
    ctx.restore();

    // chip 网格
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `600 10px ${Theme.fonts.body}`;
    const chipColors = ["#52C41A", "#00B8D9", "#9D6BFF", "#FFB020", "#FF7AB8", "#5BC0DE"];
    let cursorX = x + 12;
    let cursorY = y + 32 + chipH / 2;
    const rowTopY = cursorY - chipH / 2;
    let curRowTop = rowTopY;
    for (let i = 0; i < tips.length; i++) {
      const tip = tips[i];
      const color = chipColors[i % chipColors.length];
      const textW = ctx.measureText(tip).width;
      const cw = textW + chipPadX * 2;
      // 换行检测
      if (cursorX + cw > x + w - 12) {
        cursorX = x + 12;
        cursorY += chipH + chipGap;
        curRowTop = cursorY - chipH / 2;
      }
      // chip 背景
      ctx.fillStyle = withAlpha(color, 0.16);
      roundRect(ctx, cursorX, curRowTop, cw, chipH, 4);
      ctx.fill();
      // chip 文字
      ctx.fillStyle = color;
      ctx.fillText(tip, cursorX + chipPadX, cursorY);
      cursorX += cw + chipGap;
    }
    ctx.restore();

    // 底部累计行
    const footY = y + panelH - 22;
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`累计已学 ${totalLearned} 条反诈知识点（跨局统计）`, x + 12, footY);
    ctx.restore();

    return panelH;
  }

  private retry(): void {
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.pressedUlt = false;
    this.pressedRedeploy = false;
    this.pressedRedeployTarget = false;
    this.pressedUpgradeIdx = null;
    // v6 Phase 3：重置新增 UI 状态
    this.pressedQuizIdx = null;
    // v7：重置爬塔事件 UI 状态
    this.pressedEventOptionIdx = null;
    this.pressedDeviceIdx = null;
    this.pressedTacticalPause = false;
    this.placingDeviceIdx = null;
    this.bossDialogue = null;
    this.bossDialoguePhase = null;
    this.prevBossName = undefined;
    this.prevBossHp = undefined;
    this.introTriggeredBosses.clear();
    // v8：重置新增 UI 状态
    this.pressedCardIdx = null;
    this.pressedCounterspellIdx = null;
    this.pressedCommandIdx = null;
    this.pressedBreakdownIdx = null;
    this.pressedAgentIdx = null;
    this.selectedBubbleId = null;
    this.caseBreakdownAnsweredAt = null;
    this.spawnEngine();
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
    if (this.resultOverlay) this.resultOverlay.update(dt);
    if (this.tutorialOverlay?.active) this.tutorialOverlay.update(dt);
    // v8：案例复盘答题后自动关闭 overlay（露出底层结算页）
    if (this.caseBreakdownAnsweredAt !== null && this.t - this.caseBreakdownAnsweredAt > 1.8) {
      this.engine?.dismissCaseBreakdown();
      this.caseBreakdownAnsweredAt = null;
      this.pressedBreakdownIdx = null;
    }
  }

  private getUltButtonRect(screenW: number, screenH: number): Rect {
    return { x: screenW - 16 - 110, y: screenH - 24 - 56 - 12, w: 110, h: 56 };
  }

  private getRedeployButtonRect(screenW: number, screenH: number): Rect {
    return { x: 16, y: screenH - 24 - 56 - 12, w: 84, h: 56 };
  }

  /** v6 Phase 3：战术装置图标矩形（3 个，位于大招按钮左侧，紧密横排） */
  private getTacticalDeviceRect(idx: number, screenW: number, screenH: number): Rect {
    // 布局：[device0][device1][device2][pause] 紧靠大招按钮左侧
    const ultBtn = this.getUltButtonRect(screenW, screenH);
    const pauseW = 44;
    const deviceW = 44;
    const gap = 8;
    // pause 在最右（紧邻 ult），device 2/1/0 依次向左
    const pauseX = ultBtn.x - gap - pauseW;
    const deviceRightBase = pauseX - gap;
    const x = deviceRightBase - (idx + 1) * deviceW - idx * gap;
    return { x, y: ultBtn.y, w: deviceW, h: ultBtn.h };
  }

  /** v6 Phase 3：战术暂停按钮矩形（位于 3 个装置图标右侧、大招按钮左侧） */
  private getTacticalPauseRect(screenW: number, screenH: number): Rect {
    const ultBtn = this.getUltButtonRect(screenW, screenH);
    const pauseW = 44;
    const gap = 8;
    return { x: ultBtn.x - gap - pauseW, y: ultBtn.y, w: pauseW, h: ultBtn.h };
  }

  // ===== v8：按钮矩形辅助 =====

  /** v8：卡牌手牌矩形（最多 3 张，位于大招按钮上方） */
  private getCardRect(idx: number, screenW: number, screenH: number): Rect {
    const ultBtn = this.getUltButtonRect(screenW, screenH);
    const cardW = 72;
    const cardH = 88;
    const gap = 6;
    const total = this.hud?.cardHand?.cards.length ?? 0;
    const totalW = total * cardW + Math.max(0, total - 1) * gap;
    const startX = ultBtn.x + ultBtn.w - totalW;
    return { x: startX + idx * (cardW + gap), y: ultBtn.y - cardH - 8, w: cardW, h: cardH };
  }

  /** v8 简化：口诀槽矩形（2 个，居中于重部署按钮上方，仅 BOSS 战显示） */
  private getCounterspellRect(idx: number, screenW: number, screenH: number): Rect {
    const redeployBtn = this.getRedeployButtonRect(screenW, screenH);
    const slotW = 96;
    const slotH = 44;
    const gap = 8;
    const totalW = 2 * slotW + gap;
    const startX = redeployBtn.x + (redeployBtn.w - totalW) / 2;
    return { x: startX + idx * (slotW + gap), y: redeployBtn.y - slotH - 8, w: slotW, h: slotH };
  }

  /** v8：战术指令按钮矩形（5 个，选中探员时显示于屏幕左侧中部） */
  private getTacticalCommandRect(idx: number, screenW: number, _screenH: number): Rect {
    const btnW = 56;
    const btnH = 40;
    const gap = 6;
    return { x: 16 + idx * (btnW + gap), y: 60, w: btnW, h: btnH };
  }

  /** v8：案例复盘步骤矩形（5 个，垂直排列于 overlay 卡片内） */
  private getCaseBreakdownStepRect(idx: number, screenW: number, screenH: number): Rect {
    const cardW = Math.min(480, screenW - 64);
    const cardH = 360;
    const cardX = (screenW - cardW) / 2;
    const cardY = (screenH - cardH) / 2;
    const stepH = 44;
    const stepGap = 6;
    const stepW = cardW - 48;
    const stepX = cardX + 24;
    const stepStartY = cardY + 100;
    return { x: stepX, y: stepStartY + idx * (stepH + stepGap), w: stepW, h: stepH };
  }

  /** v8：探员头像矩形（部署列表，位于底部按钮栏上方，用于选中下达战术指令） */
  private getAgentPortraitRect(idx: number, screenW: number, screenH: number): Rect {
    const redeployBtn = this.getRedeployButtonRect(screenW, screenH);
    const portraitW = 36;
    const portraitH = 36;
    const gap = 4;
    const startX = redeployBtn.x + redeployBtn.w + 8;
    return { x: startX + idx * (portraitW + gap), y: redeployBtn.y, w: portraitW, h: portraitH };
  }

  /** v6 Phase 3：战间答题选项矩形（4 个，垂直排列，中央卡片内） */
  private getQuizOptionRect(idx: number, screenW: number, screenH: number): Rect {
    const cardW = Math.min(440, screenW - 64);
    const cardH = 320;
    const cardX = (screenW - cardW) / 2;
    const cardY = (screenH - cardH) / 2;
    // 题目区占 cardY+60..cardY+150，选项从 cardY+160 开始
    const optH = 44;
    const optGap = 8;
    const optW = cardW - 48;
    const optX = cardX + 24;
    const optStartY = cardY + 160;
    return { x: optX, y: optStartY + idx * (optH + optGap), w: optW, h: optH };
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.engineCanvas && this.engine) {
      // 同步驱动引擎渲染，确保 engineCanvas 在 blit 前已完成本帧绘制
      this.engine.stepRender();
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // 顶部状态
    if (this.hud) {
      this.renderStats(ctx, screenW);
      // v3：连击 HUD（能量条下方，右对齐）
      this.drawComboHud(ctx, screenW, this.hud);
      // v3：元素克制提示（屏幕中央偏上，短暂浮动）
      this.drawElementalHint(ctx, screenW, this.hud);
      // v11 D3：系统事件流左侧面板（元素反应/敌人AI/羁绊/弱点情报）
      this.drawSystemEvents(ctx, screenW, this.hud);
      // v6 Phase 3：元素反应 / 技能链激活提示（连击 HUD 下方）
      this.drawActiveEffects(ctx, screenW, this.hud);
      // v6 Phase 3：极限挑战词缀徽章（左下角，重部署按钮上方）
      if (this.challengeAffixes.length > 0) {
        this.drawChallengeAffixBadges(ctx, screenW, screenH);
      }
    }

    // 大招按钮（v3：显示探员大招名 + emoji 副标题 + 描述）
    const ultBtn = this.getUltButtonRect(screenW, screenH);
    const ultReady = this.hud?.ultReady ?? false;
    const ultName = this.hud?.ultName;
    const ultEmoji = this.hud?.ultEmoji ?? "";
    const ultMainText = ultReady ? (ultName ?? "大招") : "能量蓄积中";
    drawButton(ctx, ultBtn.x, ultBtn.y, ultBtn.w, ultBtn.h, ultMainText, {
      variant: ultReady ? "primary" : "ghost",
      accent: this.getAccent(),
      pressed: this.pressedUlt,
      subText: `${ultEmoji} 大招`,
      fontSize: 13,
    });
    if (ultReady) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 4);
      ctx.strokeStyle = withAlpha(this.getAccent(), pulse);
      ctx.lineWidth = 2;
      ctx.shadowColor = this.getAccent();
      ctx.shadowBlur = 12;
      ctx.strokeRect(ultBtn.x, ultBtn.y, ultBtn.w, ultBtn.h);
      ctx.restore();
    }
    // v3：大招描述（按钮下方一行小字，截断 20 字）
    if (this.hud?.ultDesc) {
      const desc = this.hud.ultDesc.length > 20 ? this.hud.ultDesc.slice(0, 20) + "…" : this.hud.ultDesc;
      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(this.getAccent(), 0.6);
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(desc, ultBtn.x + ultBtn.w, ultBtn.y + ultBtn.h + 2);
      ctx.restore();
    }

    // v11：重部署按钮（战斗中花费能量移动探员；显示费用/就绪/取消态）
    const redeployBtn = this.getRedeployButtonRect(screenW, screenH);
    const picking = this.hud?.redeployState?.pickingTarget === true;
    const redeployReady = this.hud?.redeployReady ?? false;
    const redeployCost = this.hud?.redeployCost ?? 30;
    const redeployAccent = picking ? "#FF4D4F" : (redeployReady ? "#00E5FF" : Theme.colors.ink.muted);
    const redeployLabel = picking ? "取消" : `重部署·${redeployCost}`;
    drawButton(ctx, redeployBtn.x, redeployBtn.y, redeployBtn.w, redeployBtn.h, redeployLabel, {
      variant: (picking || redeployReady) ? "primary" : "ghost",
      accent: redeployAccent,
      pressed: this.pressedRedeploy,
      fontSize: 11,
    });
    drawIcon(ctx, "rotate", redeployBtn.x + redeployBtn.w - 16, redeployBtn.y + 6, 12, redeployAccent);
    // v11：重部署选目标模式提示（屏幕中央偏上，半透明）
    if (picking) {
      ctx.save();
      ctx.font = `700 13px ${Theme.fonts.body}`;
      ctx.fillStyle = redeployAccent;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = redeployAccent;
      ctx.shadowBlur = 10;
      const blink = 0.6 + 0.4 * Math.sin(this.pulse * 6);
      ctx.globalAlpha = blink;
      ctx.fillText("🔄 点击棋盘空岗哨位移动探员（再次点击按钮取消）", screenW / 2, screenH / 2 - 40);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // v6 Phase 3：战术装置图标（3 个）+ 战术暂停按钮（大招按钮左侧）
    this.renderTacticalDevices(ctx, screenW, screenH);

    // v6 Phase 3：放置模式提示（屏幕中央偏上，半透明）
    if (this.placingDeviceIdx !== null) {
      const def = TACTICAL_DEVICES[this.placingDeviceIdx];
      if (def) {
        ctx.save();
        ctx.font = `700 13px ${Theme.fonts.body}`;
        ctx.fillStyle = def.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 10;
        const blink = 0.6 + 0.4 * Math.sin(this.pulse * 6);
        ctx.globalAlpha = blink;
        ctx.fillText(`${def.emoji} 点击战场放置「${def.name}」`, screenW / 2, screenH / 2 - 40);
        ctx.globalAlpha = 1;
        ctx.font = `400 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.shadowBlur = 0;
        ctx.fillText("再次点击装置图标可取消", screenW / 2, screenH / 2 - 22);
        ctx.restore();
      }
    }

    // Toast
    if (this.toast) {
      const tw = screenW - 32;
      const th = 48;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "指挥通讯");
    }

    // 探员升级阶段 overlay（最上层）
    if (this.hud && this.hud.phase === "upgrade" && this.hud.upgradeChoices) {
      this.renderUpgradeChoice(ctx, screenW, screenH);
    }

    // v6 Phase 3：BOSS 对话框（升级选择之上，答题之下）
    if (this.bossDialogue) {
      this.renderBossDialogue(ctx, screenW, screenH);
    }

    // v6 Phase 3：战间答题 overlay（最高优先级，最上层）
    if (this.hud?.pendingQuiz) {
      this.renderQuizOverlay(ctx, screenW, screenH);
    }

    // v7：爬塔 Roguelike 事件 overlay（与答题同级，互斥显示）
    if (this.hud?.pendingTowerEvent) {
      this.renderTowerEventOverlay(ctx, screenW, screenH);
    }

    // ===== v8 全面升级 UI =====
    // 卡牌手牌（大招按钮上方）
    this.drawCardHand(ctx, screenW, screenH);
    // 口诀槽（重部署按钮上方）
    this.drawCounterspellSlots(ctx, screenW, screenH);
    // 探员头像栏（用于选中下达战术指令）
    this.drawAgentPortraits(ctx, screenW, screenH);
    // 战术指令面板（选中探员时显示）
    this.drawTacticalCommands(ctx, screenW, screenH);
    // 受害人营救计数（顶部小面板）
    this.drawVictimRescueHud(ctx, screenW);

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }

    // v8：案例五步复盘 overlay —— 绘制于结算之上，答题后自动关闭露出结算
    if (this.hud?.pendingCaseBreakdown) {
      this.renderCaseBreakdownOverlay(ctx, screenW, screenH);
    }

    // v7 D1：新手引导覆盖层（最后绘制，置顶）
    if (this.tutorialOverlay?.active) {
      this.tutorialOverlay.render(ctx, screenW, screenH);
    }
  }

  /** 探员升级选择 overlay：3 个可点击选项卡片 */
  private renderUpgradeChoice(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const choices = hud.upgradeChoices!;
    // 全屏暗化遮罩
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.82)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 顶部标题
    const titleY = screenH * 0.18;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 10;
    ctx.fillText("资源强化 · 击杀获取资源升级守卫", screenW / 2, titleY - 22);
    ctx.shadowBlur = 0;
    ctx.font = `900 22px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 16;
    ctx.fillText(`选择第 ${hud.upgradeCount + 1}/${hud.upgradeMax} 次强化`, screenW / 2, titleY + 6);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("击杀敌人积累资源 · 三选一全局强化（永久作用于所有探员）", screenW / 2, titleY + 28);

    // 3 个卡片横向排列（横屏布局）
    const cardW = Math.min(220, (screenW - 80) / 3);
    const cardH = 160;
    const gap = 16;
    const totalW = cardW * 3 + gap * 2;
    const startX = (screenW - totalW) / 2;
    const startY = (screenH - cardH) / 2 + 30;
    for (let i = 0; i < choices.length; i++) {
      const opt = choices[i];
      const rect = this.getUpgradeChoiceRect(i, screenW);
      const pressed = this.pressedUpgradeIdx === i;
      // 卡片背景
      ctx.fillStyle = pressed ? withAlpha(opt.color, 0.22) : "rgba(20, 36, 58, 0.92)";
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
      ctx.fill();
      // 边框
      ctx.strokeStyle = opt.color;
      ctx.lineWidth = pressed ? 2 : 1;
      ctx.shadowColor = opt.color;
      ctx.shadowBlur = pressed ? 16 : 8;
      roundRect(ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 四角括号
      drawNeonCorners(ctx, rect.x, rect.y, rect.w, rect.h, opt.color, 12, 3, 6);
      // emoji 大图
      ctx.font = "44px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opt.emoji, rect.x + rect.w / 2, rect.y + 44);
      // 标题
      ctx.font = `700 16px ${Theme.fonts.body}`;
      ctx.fillStyle = opt.color;
      ctx.shadowColor = opt.color;
      ctx.shadowBlur = 6;
      ctx.fillText(opt.title, rect.x + rect.w / 2, rect.y + 88);
      ctx.shadowBlur = 0;
      // 描述
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.fillText(opt.desc, rect.x + rect.w / 2, rect.y + 112);
      // 序号
      ctx.font = `900 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(opt.color, 0.6);
      ctx.fillText(`0${i + 1}`, rect.x + rect.w / 2, rect.y + rect.h - 14);
    }
    ctx.restore();
  }

  /** 升级选项矩形（横屏 3 列） */
  private getUpgradeChoiceRect(idx: number, screenW: number): Rect {
    const cardW = Math.min(220, (screenW - 80) / 3);
    const cardH = 160;
    const gap = 16;
    const totalW = cardW * 3 + gap * 2;
    const startX = (screenW - totalW) / 2;
    const screenH = this.director.screenHeight;
    const startY = (screenH - cardH) / 2 + 30;
    const x = startX + idx * (cardW + gap);
    return { x, y: startY, w: cardW, h: cardH };
  }

  // ====================================================================
  // v6 Phase 3 任务 1.1：战间答题 overlay
  // ====================================================================

  /** 渲染战间答题：半透明遮罩 + 中央卡片 + 题目 + 4 选项 + 难度/类型标签 */
  private renderQuizOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const quiz = this.hud?.pendingQuiz;
    if (!quiz) return;
    const isRetry = this.hud?.pendingQuizIsRetry === true;
    // 半透明遮罩（让玩家能看到底层但不被分散注意力）
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.78)";
    ctx.fillRect(0, 0, screenW, screenH);

    const cardW = Math.min(440, screenW - 64);
    const cardH = 320;
    const cardX = (screenW - cardW) / 2;
    const cardY = (screenH - cardH) / 2;
    // v7：错题重练时使用警示色边框
    const quizAccent = isRetry ? "#FF7AB8" : Theme.colors.flag.DEFAULT;
    // 卡片背景
    drawPanel(ctx, cardX, cardY, cardW, cardH, {
      bgColor: "rgba(15, 34, 54, 0.96)",
      borderColor: quizAccent,
      borderWidth: 2,
    });
    drawNeonCorners(ctx, cardX, cardY, cardW, cardH, quizAccent, 14, 3, 8);

    // 顶部标签栏：难度 ⭐ + 反诈类型
    const tagY = cardY + 14;
    const stars = "⭐".repeat(quiz.difficulty);
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = quizAccent;
    ctx.shadowColor = quizAccent;
    ctx.shadowBlur = 6;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`难度 ${stars}`, cardX + 20, tagY);
    ctx.shadowBlur = 0;
    ctx.textAlign = "right";
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.fillText(`反诈类型 · ${quiz.fraudType}`, cardX + cardW - 20, tagY);

    // 标题（v7：错题重练时显示提示）
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "center";
    ctx.fillText(isRetry ? "// 错题重练 · 巩固反诈知识" : "// 战间答题 · 答对获得反诈 buff", screenW / 2, cardY + 40);

    // 题目文本（多行换行）
    ctx.font = `500 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const qLines = wrapText(ctx, quiz.question, cardW - 48);
    let qy = cardY + 64;
    for (const line of qLines) {
      ctx.fillText(line, cardX + 24, qy);
      qy += 18;
    }

    // 4 个选项按钮（垂直排列）
    for (let i = 0; i < quiz.options.length && i < 4; i++) {
      const rect = this.getQuizOptionRect(i, screenW, screenH);
      const pressed = this.pressedQuizIdx === i;
      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        bgColor: pressed ? "rgba(0, 229, 255, 0.18)" : "rgba(20, 36, 58, 0.92)",
        borderColor: pressed ? Theme.colors.neon.DEFAULT : withAlpha(Theme.colors.bg.line, 0.8),
        borderWidth: pressed ? 2 : 1,
      });
      // 序号徽章
      ctx.font = `900 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = pressed ? Theme.colors.neon.DEFAULT : Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String.fromCharCode(65 + i), rect.x + 12, rect.y + rect.h / 2);
      // 选项文本（截断）
      const optText = quiz.options[i];
      const maxW = rect.w - 36;
      ctx.font = `500 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const fitText = fitTextWidth(ctx, optText, maxW);
      ctx.fillText(fitText, rect.x + 28, rect.y + rect.h / 2);
    }
    ctx.restore();
  }

  // ====================================================================
  // v7：爬塔 Roguelike 事件 overlay
  // ====================================================================

  /** 渲染爬塔事件：半透明遮罩 + 情景描述 + 选项卡片 */
  private renderTowerEventOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const evt = this.hud?.pendingTowerEvent;
    if (!evt) return;
    const accent = evt.color;
    // 半透明遮罩
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.82)";
    ctx.fillRect(0, 0, screenW, screenH);

    const cardW = Math.min(460, screenW - 64);
    const cardH = 360;
    const cardX = (screenW - cardW) / 2;
    const cardY = (screenH - cardH) / 2;
    // 卡片背景
    drawPanel(ctx, cardX, cardY, cardW, cardH, {
      bgColor: "rgba(15, 34, 54, 0.96)",
      borderColor: accent,
      borderWidth: 2,
    });
    drawNeonCorners(ctx, cardX, cardY, cardW, cardH, accent, 14, 3, 8);

    // 顶部标签：第 X 层 · 事件类型
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`第 ${evt.floor} 层 · 爬塔事件`, cardX + 20, cardY + 16);
    ctx.shadowBlur = 0;
    ctx.textAlign = "right";
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("ROGUELIKE EVENT", cardX + cardW - 20, cardY + 16);

    // 标题
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "center";
    ctx.fillText("// 情景抉择 · 影响后续战局", screenW / 2, cardY + 42);

    // emoji + 事件标题
    ctx.font = "36px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(evt.emoji, screenW / 2, cardY + 80);
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.fillText(evt.title, screenW / 2, cardY + 112);
    ctx.shadowBlur = 0;

    // 情景描述（多行换行）
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const storyLines = wrapText(ctx, evt.story, cardW - 48);
    let sy = cardY + 138;
    for (const line of storyLines) {
      ctx.fillText(line, cardX + 24, sy);
      sy += 17;
    }

    // 选项按钮（垂直排列）
    for (let i = 0; i < evt.options.length; i++) {
      const rect = this.getTowerEventOptionRect(i, evt.options.length, screenW, screenH);
      const opt = evt.options[i];
      const pressed = this.pressedEventOptionIdx === i;
      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        bgColor: pressed ? withAlpha(accent, 0.22) : "rgba(20, 36, 58, 0.92)",
        borderColor: pressed ? accent : withAlpha(Theme.colors.bg.line, 0.8),
        borderWidth: pressed ? 2 : 1,
      });
      // emoji
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(opt.emoji, rect.x + 12, rect.y + rect.h / 2);
      // 标签
      ctx.font = `700 13px ${Theme.fonts.body}`;
      ctx.fillStyle = pressed ? accent : Theme.colors.ink.DEFAULT;
      ctx.fillText(opt.label, rect.x + 38, rect.y + rect.h / 2 - 7);
      // 描述
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText(opt.desc, rect.x + 38, rect.y + rect.h / 2 + 8);
    }
    ctx.restore();
  }

  /** 爬塔事件选项矩形（垂直排列，自适应数量） */
  private getTowerEventOptionRect(idx: number, total: number, screenW: number, screenH: number): Rect {
    const cardW = Math.min(460, screenW - 64);
    const cardX = (screenW - cardW) / 2;
    const cardH = 360;
    const cardY = (screenH - cardH) / 2;
    const optW = cardW - 40;
    const optH = 48;
    const gap = 8;
    // 选项区域起始 Y（在情景描述下方）
    const storyEstimateH = 60; // 预留情景描述高度
    const optsStartY = cardY + 138 + storyEstimateH + 8;
    const totalOptsH = total * optH + (total - 1) * gap;
    const startY = optsStartY + Math.max(0, (cardY + cardH - 20 - optsStartY - totalOptsH) / 2);
    return { x: cardX + 20, y: startY + idx * (optH + gap), w: optW, h: optH };
  }

  // ====================================================================
  // v6 Phase 3 任务 1.2：战术装置 UI
  // ====================================================================

  /** 渲染战术装置图标（3 个）+ 战术暂停按钮 */
  private renderTacticalDevices(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const devices = this.hud?.tacticalDevices ?? [];
    // 3 个装置图标
    for (let i = 0; i < TACTICAL_DEVICES.length; i++) {
      const def = TACTICAL_DEVICES[i];
      const state = devices[i];
      const rect = this.getTacticalDeviceRect(i, screenW, screenH);
      const pressed = this.pressedDeviceIdx === i;
      const placing = this.placingDeviceIdx === i;
      const cooldownLeft = state?.cooldownLeft ?? 0;
      const cooling = cooldownLeft > 0;
      // 背景
      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        bgColor: placing ? withAlpha(def.color, 0.28) : (pressed ? withAlpha(def.color, 0.18) : "rgba(15, 34, 54, 0.85)"),
        borderColor: placing ? def.color : (cooling ? withAlpha(def.color, 0.3) : withAlpha(def.color, 0.55)),
        borderWidth: placing ? 2 : 1,
      });
      // 放置模式脉冲边框
      if (placing) {
        const blink = 0.5 + 0.5 * Math.sin(this.pulse * 6);
        ctx.save();
        ctx.strokeStyle = withAlpha(def.color, blink);
        ctx.lineWidth = 2;
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 12;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      }
      // emoji 大图标
      ctx.save();
      ctx.font = `22px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = cooling ? 0.5 : 1;
      ctx.fillText(def.emoji, rect.x + rect.w / 2, rect.y + 18);
      ctx.globalAlpha = 1;
      // 装置名（底部小字）
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = cooling ? withAlpha(def.color, 0.5) : def.color;
      ctx.fillText(def.name, rect.x + rect.w / 2, rect.y + rect.h - 8);
      ctx.restore();
      // 冷却进度环（在 emoji 右上角小圆环）
      if (cooling) {
        const cx = rect.x + rect.w - 8;
        const cy = rect.y + 8;
        const r = 8;
        const cdTotal = def.cooldown;
        const ratio = Math.max(0, Math.min(1, cooldownLeft / cdTotal));
        ctx.save();
        ctx.strokeStyle = withAlpha(Theme.colors.bg.line, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (1 - ratio) * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // 剩余秒数
        ctx.save();
        ctx.font = `700 7px ${Theme.fonts.mono}`;
        ctx.fillStyle = def.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${Math.ceil(cooldownLeft)}`, cx, cy + r + 6);
        ctx.restore();
      }
    }
    // 战术暂停按钮
    const pauseRect = this.getTacticalPauseRect(screenW, screenH);
    const pauseRemaining = this.hud?.tacticalPauseRemaining ?? 0;
    const pauseDisabled = pauseRemaining <= 0;
    const pauseColor = "#00E5FF";
    drawPanel(ctx, pauseRect.x, pauseRect.y, pauseRect.w, pauseRect.h, {
      bgColor: this.pressedTacticalPause ? withAlpha(pauseColor, 0.22) : "rgba(15, 34, 54, 0.85)",
      borderColor: pauseDisabled ? withAlpha(pauseColor, 0.25) : withAlpha(pauseColor, 0.6),
      borderWidth: 1,
    });
    ctx.save();
    ctx.font = `20px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = pauseDisabled ? 0.4 : 1;
    ctx.fillText("⏸", pauseRect.x + pauseRect.w / 2, pauseRect.y + 18);
    ctx.globalAlpha = 1;
    ctx.font = `700 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = pauseDisabled ? withAlpha(pauseColor, 0.4) : pauseColor;
    ctx.fillText(pauseDisabled ? "已用" : "暂停", pauseRect.x + pauseRect.w / 2, pauseRect.y + pauseRect.h - 8);
    // 剩余次数徽章
    if (pauseRemaining > 0) {
      ctx.font = `900 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = pauseColor;
      ctx.shadowColor = pauseColor;
      ctx.shadowBlur = 4;
      ctx.fillText(`×${pauseRemaining}`, pauseRect.x + pauseRect.w / 2, pauseRect.y + 32);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // ====================================================================
  // v6 Phase 3 任务 1.3：BOSS 对话框
  // ====================================================================

  /** 渲染 BOSS 对话框：底部对话框，显示当前一行，点击屏幕前进 */
  private renderBossDialogue(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const dlg = this.bossDialogue;
    if (!dlg) return;
    const line = dlg.lines[dlg.idx];
    if (!line) {
      this.bossDialogue = null;
      this.bossDialoguePhase = null;
      return;
    }
    // 半透明遮罩（轻量，让玩家能看到战场）
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.45)";
    ctx.fillRect(0, 0, screenW, screenH);

    // 对话框（底部，留出底部按钮栏空间）
    const boxW = Math.min(640, screenW - 32);
    const boxH = 96;
    const boxX = (screenW - boxW) / 2;
    const boxY = screenH - 24 - 56 - 12 - boxH - 12;
    drawPanel(ctx, boxX, boxY, boxW, boxH, {
      bgColor: "rgba(8, 16, 30, 0.96)",
      borderColor: line.color,
      borderWidth: 2,
    });
    drawNeonCorners(ctx, boxX, boxY, boxW, boxH, line.color, 12, 3, 6);

    // 说话者头像区（左侧色块 + emoji）
    const avatarSize = 56;
    const avatarX = boxX + 12;
    const avatarY = boxY + (boxH - avatarSize) / 2;
    ctx.save();
    ctx.fillStyle = withAlpha(line.color, 0.18);
    roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 8);
    ctx.fill();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = line.color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.font = `28px ${Theme.fonts.body}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 0;
    ctx.fillText(line.emoji, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    ctx.restore();

    // 说话者名 + 立场标签
    const textX = avatarX + avatarSize + 14;
    const textW = boxX + boxW - textX - 16;
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = line.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = line.color;
    ctx.shadowBlur = 4;
    const sideTag = line.side === "enemy" ? "  ⚠ 敌方" : "  ✓ 我方";
    ctx.fillText(line.speaker + sideTag, textX, boxY + 12);
    ctx.shadowBlur = 0;
    // 台词（多行换行）
    ctx.font = `500 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const lines = wrapText(ctx, line.text, textW);
    let ty = boxY + 34;
    for (const ln of lines) {
      ctx.fillText(ln, textX, ty);
      ty += 18;
    }
    ctx.restore();

    // 进度指示 + 继续提示（右下角闪烁）
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${dlg.idx + 1}/${dlg.lines.length}`, boxX + boxW - 12, boxY + boxH - 8);
    const blink = Math.sin(this.pulse * 5) > 0 ? 1 : 0.3;
    ctx.fillStyle = withAlpha(Theme.colors.neon.DEFAULT, blink);
    ctx.fillText("点击屏幕继续 ▼", boxX + boxW - 90, boxY + boxH - 8);
    ctx.restore();
    ctx.restore();
  }

  // ====================================================================
  // v6 Phase 3 任务 1.4：元素反应激活提示
  // ====================================================================

  /** 渲染当前激活的元素反应（连击 HUD 下方，小图标行） */
  private drawActiveEffects(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud): void {
    const reactions = hud.activeElementReactions ?? [];
    if (reactions.length === 0) return;
    // 位置：连击 HUD（y=96）下方，右对齐
    const y = 120;
    const xRight = screenW - 16;
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    let cursorX = xRight;
    // 元素反应
    for (let i = reactions.length - 1; i >= 0; i--) {
      const r = reactions[i];
      const def = ELEMENT_REACTIONS.find((e) => e.kind === r.kind);
      const color = def?.color ?? Theme.colors.neon.DEFAULT;
      const emoji = def?.emoji ?? "✨";
      const name = def?.name ?? r.kind;
      const text = `${emoji} ${name} ${r.remaining.toFixed(1)}s`;
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      const tw = ctx.measureText(text).width;
      const bx = cursorX - tw - 12;
      ctx.fillStyle = withAlpha(color, 0.15);
      roundRect(ctx, bx, y - 8, tw + 12, 16, 3);
      ctx.fill();
      ctx.strokeStyle = withAlpha(color, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.fillText(text, cursorX - 6, y);
      ctx.shadowBlur = 0;
      cursorX = bx - 6;
    }
    ctx.restore();
  }

  /** v6 Phase 3：极限挑战词缀徽章（左下角，重部署按钮上方，垂直排列） */
  private drawChallengeAffixBadges(ctx: CanvasRenderingContext2D, _screenW: number, screenH: number): void {
    const affixes = this.challengeAffixes;
    if (affixes.length === 0) return;
    const x = 16;
    const badgeH = 14;
    const badgeW = 110;
    const gap = 3;
    // 重部署按钮上方
    const redeployBtn = this.getRedeployButtonRect(_screenW, screenH);
    const baseY = redeployBtn.y - 8 - affixes.length * (badgeH + gap);
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let i = 0; i < affixes.length; i++) {
      const a = affixes[i];
      const by = baseY + i * (badgeH + gap);
      ctx.fillStyle = withAlpha(a.color, 0.15);
      roundRect(ctx, x, by, badgeW, badgeH, 3);
      ctx.fill();
      ctx.strokeStyle = withAlpha(a.color, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `400 9px ${Theme.fonts.body}`;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(a.emoji, x + 5, by + badgeH / 2);
      ctx.font = `700 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = a.color;
      ctx.fillText(a.name, x + 20, by + badgeH / 2);
    }
    ctx.restore();
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 52;
    const fs = fontScale(); // v7 D5：字号缩放
    const cbMode = platformStore.managerMetaProgress().accessibility.colorBlindMode;
    ctx.save();
    // 基地 HP
    ctx.font = `400 ${Math.round(10 * fs)}px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("基地", 16, y);
    drawProgressBar(ctx, 16, y + 14, 120, 10, hud.baseHp / hud.baseMax,
      hud.baseHp / hud.baseMax < 0.3 ? Theme.colors.warn.DEFAULT : Theme.colors.safe.DEFAULT);
    // v7 D5：色弱模式下基地 HP 附加文字标签
    if (cbMode) {
      ctx.font = `700 ${Math.round(9 * fs)}px ${Theme.fonts.mono}`;
      ctx.fillStyle = hud.baseHp / hud.baseMax < 0.3 ? Theme.colors.warn.DEFAULT : Theme.colors.safe.DEFAULT;
      ctx.fillText(hud.baseHp / hud.baseMax < 0.3 ? "危" : "稳", 16, y + 26);
    }
    ctx.font = `400 ${Math.round(9 * fs)}px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${hud.baseHp}/${hud.baseMax}`, 142, y + 14);

    // v3：每日挑战 HUD（基地 HP 下方，左上角垂直徽章）
    const dailyActive = hud.mode === "daily" && !!hud.dailyModifiers;
    if (dailyActive) {
      this.drawDailyHud(ctx, screenW, hud, y);
    }

    // 中央：根据模式显示不同内容
    ctx.textAlign = "center";
    if (hud.mode === "bossRush") {
      // BOSSrush：显示当前 BOSS 血条
      this.drawBossHud(ctx, screenW, hud, y);
    } else if (hud.mode === "timeTrial") {
      // 限时挑战：显示倒计时
      this.drawTimeTrialHud(ctx, screenW, hud, y);
    } else if (hud.mode === "endlessRush") {
      // 无尽 Rush：显示绝对波数与 TIER
      this.drawEndlessHud(ctx, screenW, hud, y);
    } else {
      // 经典：波次进度
      ctx.font = `400 ${Math.round(10 * fs)}px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("反诈波次", screenW / 2, y);
      ctx.font = `700 ${Math.round(16 * fs)}px ${Theme.fonts.mono}`;
      ctx.fillStyle = this.getAccent();
      ctx.shadowColor = withAlpha(this.getAccent(), 0.4);
      ctx.shadowBlur = 8;
      ctx.fillText(`${hud.wave}/${hud.totalWaves}`, screenW / 2, y + 14);
      ctx.shadowBlur = 0;
      // v3：波次预警（来袭警告）
      if (hud.waveProgress < 0.3) {
        const blink = Math.sin(this.pulse * 6) > 0 ? 1 : 0.25;
        ctx.font = `700 ${Math.round(9 * fs)}px ${Theme.fonts.mono}`;
        ctx.fillStyle = withAlpha("#E5353B", blink);
        ctx.shadowColor = "#E5353B";
        ctx.shadowBlur = 6;
        ctx.fillText("⚠ 敌人来袭", screenW / 2, y + 30);
        ctx.shadowBlur = 0;
      }
    }

    // 能量
    ctx.textAlign = "right";
    ctx.font = `400 ${Math.round(10 * fs)}px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("能量", screenW - 16, y);
    drawProgressBar(ctx, screenW - 136, y + 14, 120, 10, hud.energy / 100, this.getAccent());
    ctx.font = `400 ${Math.round(9 * fs)}px ${Theme.fonts.mono}`;
    ctx.fillStyle = hud.ultReady ? this.getAccent() : Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText(`${Math.floor(hud.energy)}%`, screenW - 16, y + 26);

    // 分数（左下角小字；每日模式下移至每日徽章下方）
    const scoreY = dailyActive ? y + 94 : y + 28;
    ctx.textAlign = "left";
    ctx.font = `400 ${Math.round(9 * fs)}px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`SCORE ${hud.score} · 敌 ${hud.enemiesLeft}`, 16, scoreY);
    // 模式标签（右下角小字）
    ctx.textAlign = "right";
    ctx.fillStyle = withAlpha(this.getAccent(), 0.7);
    ctx.fillText(hud.modeLabel, screenW - 16, y + 28);

    // 探员资源条（底部中央，仅未达上限时显示）
    if (hud.upgradeCount < hud.upgradeMax) {
      const xpW = 200;
      const xpX = (screenW - xpW) / 2;
      const xpY = y + 44;
      const xpH = 6;
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = hud.upgradeReady ? "#FFD666" : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(
        hud.upgradeReady
          ? `✨ 升级就绪 ${hud.upgradeCount}/${hud.upgradeMax}`
          : `资源 ${hud.upgradeXp}/${hud.upgradeXpMax} · LV ${hud.upgradeCount}/${hud.upgradeMax}`,
        screenW / 2, xpY - 12,
      );
      // 资源条背景
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, xpX, xpY, xpW, xpH, 3);
      ctx.fill();
      // 资源进度
      const xpRatio = hud.upgradeReady ? 1 : Math.min(1, hud.upgradeXp / hud.upgradeXpMax);
      const xpColor = hud.upgradeReady ? "#FFD666" : "#B388FF";
      ctx.fillStyle = xpColor;
      ctx.shadowColor = xpColor;
      ctx.shadowBlur = hud.upgradeReady ? 10 + Math.sin(this.pulse * 6) * 4 : 4;
      roundRect(ctx, xpX, xpY, xpW * xpRatio, xpH, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // 已达升级上限
      ctx.font = `900 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 6;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`★ 守卫满级 LV${hud.upgradeMax}`, screenW / 2, y + 42);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /** BOSSrush 模式：当前 BOSS 血条 + 名称 + 进度 */
  private drawBossHud(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud, y: number): void {
    const barW = 220;
    const barX = (screenW - barW) / 2;
    const fs = fontScale(); // v7 D5：字号缩放
    const cbMode = platformStore.managerMetaProgress().accessibility.colorBlindMode;
    // 上方：BOSS 进度
    ctx.font = `700 ${Math.round(10 * fs)}px ${Theme.fonts.mono}`;
    ctx.fillStyle = hud.bossEnraged ? "#E5353B" : "#FFB020";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = hud.bossEnraged ? "#E5353B" : "#FFB020";
    ctx.shadowBlur = 6;
    ctx.fillText(`BOSS RUSH · ${hud.bossIdx! + 1}/${hud.bossTotal}`, screenW / 2, y - 2);
    ctx.shadowBlur = 0;
    // BOSS 名称 + emoji
    if (hud.bossName) {
      ctx.font = `700 ${Math.round(12 * fs)}px ${Theme.fonts.display}`;
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 8;
      const emoji = hud.bossEmoji ?? "";
      const enragedTag = hud.bossEnraged ? "  ⚠ 狂暴" : "";
      ctx.fillText(`${emoji} ${hud.bossName}${enragedTag}`, screenW / 2, y + 12);
      ctx.shadowBlur = 0;
    } else {
      ctx.font = `400 ${Math.round(10 * fs)}px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("下一 BOSS 来袭…", screenW / 2, y + 12);
    }
    // BOSS 血条
    const barY = y + 28;
    const barH = 8;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fill();
    if (hud.bossHp !== undefined && hud.bossMaxHp) {
      const ratio = Math.max(0, hud.bossHp / hud.bossMaxHp);
      const color = hud.bossEnraged ? "#E5353B" : ratio > 0.5 ? "#FFB020" : "#FF7AB8";
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      roundRect(ctx, barX, barY, barW * ratio, barH, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 边框
      ctx.strokeStyle = "#FFD666";
      ctx.lineWidth = 1;
      roundRect(ctx, barX, barY, barW, barH, 4);
      ctx.stroke();
      // v7 D5：色弱模式下血条右侧附加 HP 数值文字
      if (cbMode) {
        ctx.font = `700 ${Math.round(9 * fs)}px ${Theme.fonts.mono}`;
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`${hud.bossHp}`, barX + barW + 6, barY + barH / 2);
      }
    }
    // 技能
    if (hud.bossSkill) {
      ctx.font = `400 ${Math.round(9 * fs)}px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.fillText(`技能：${hud.bossSkill}`, screenW / 2, barY + barH + 2);
    }
    // v3：BOSS 阶段 HUD（血条下方）
    this.drawBossPhaseHud(ctx, screenW, 0, hud, y);
  }

  /** v3：BOSS 三阶段提示（血条下方：阶段名 + 3 阶段进度点） */
  private drawBossPhaseHud(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number, hud: ManagerHud, baseY: number): void {
    if (hud.mode !== "bossRush" || !hud.bossName) return;
    const phaseY = baseY + 50;
    const phaseIdx = hud.bossPhaseIdx ?? 0;
    // 阶段名（警告色 + 脉冲发光）
    if (hud.bossPhaseName) {
      const pulse = 0.6 + 0.4 * Math.sin(this.pulse * 6);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#E5353B";
      ctx.shadowColor = "#E5353B";
      ctx.shadowBlur = 6 + 8 * pulse;
      ctx.globalAlpha = 0.7 + 0.3 * pulse;
      ctx.fillText(`⚡ ${hud.bossPhaseName}`, screenW / 2, phaseY);
      ctx.restore();
    }
    // 3 阶段进度点
    const dotR = 3;
    const gap = 10;
    const totalW = 3 * dotR * 2 + 2 * gap;
    const startX = screenW / 2 - totalW / 2 + dotR;
    const dotY = phaseY + 20;
    for (let i = 0; i < 3; i++) {
      const cx = startX + i * (dotR * 2 + gap);
      const isPast = i < phaseIdx;
      const isCurrent = i === phaseIdx;
      ctx.save();
      if (isPast) {
        ctx.fillStyle = "#E5353B";
        ctx.shadowColor = "#E5353B";
        ctx.shadowBlur = 4;
      } else if (isCurrent) {
        const blink = Math.sin(this.pulse * 8) > 0 ? 1 : 0.25;
        ctx.fillStyle = withAlpha("#E5353B", blink);
        ctx.shadowColor = "#E5353B";
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = Theme.colors.ink.dim;
      }
      ctx.beginPath();
      ctx.arc(cx, dotY, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** v3：连击 HUD（能量条下方约 20px，右对齐，脉冲发光） */
  private drawComboHud(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud): void {
    if (!hud.comboActive) return;
    const count = hud.comboCount ?? 0;
    const mul = hud.comboMul ?? 1;
    const max = hud.comboMax ?? 0;
    const x = screenW - 16;
    // 能量条 y+14（=66），高 10，结束 76；下方约 20px → y=96
    const y = 96;
    const color = count >= 10 ? "#FF7A1A" : "#FFD666";
    const pulseBlur = 6 + 8 * (0.5 + 0.5 * Math.sin(this.pulse * 6));
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.font = `900 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = pulseBlur;
    ctx.fillText(`${count} COMBO ×${mul.toFixed(1)}`, x, y);
    ctx.shadowBlur = 0;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(color, 0.7);
    ctx.fillText(`MAX ${max}`, x, y + 20);
    ctx.restore();
  }

  /** v3：元素克制提示（屏幕中央偏上 y=70，短暂浮动 + 淡出） */
  private drawElementalHint(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud): void {
    const hint = hud.lastElementalHint;
    if (!hint) return;
    const age = this.t - hint.at;
    if (age < 0 || age >= 1) return;
    const alpha = Math.max(0, 1 - age);
    const yBase = 70;
    const yOff = -10 * Math.sin(this.t * 4);
    const text = hint.kind === "strong"
      ? `⚡ 强效！${hint.from} → ${hint.from}克制${hint.to}`
      : `▽ 弱效 ${hint.to} → ${hint.to}克制${hint.from}`;
    const color = hint.kind === "strong" ? "#1AD670" : "#E5353B";
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 14px ${Theme.fonts.body}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(text, screenW / 2, yBase + yOff);
    ctx.restore();
  }

  /**
   * v11 D3：系统事件流左侧面板渲染
   * - 左侧 x=4 起，y=108 起（顶部状态栏下方），向下堆叠最多 4 条
   * - 每条卡片：彩色左边框 + 半透明深色背景 + emoji/标题（行1）+ 描述（行2）
   * - 按剩余 TTL 淡出；新事件有左滑入场动画
   * - 替代 v10 居中 toast（避免遮挡中央波次/BOSS HUD）
   */
  private drawSystemEvents(ctx: CanvasRenderingContext2D, _screenW: number, hud: ManagerHud): void {
    const events = hud.recentSystemEvents;
    if (!events || events.length === 0) return;

    const panelX = 4;
    const panelW = 176;
    // daily 模式下左上角有修饰符徽章（延伸至 y≈148），面板下移避免遮挡
    const yBase = hud.mode === "daily" ? 154 : 108;
    const rowH = 42;
    const rowGap = 4;
    const maxRows = 4;
    const visible = events.slice(0, maxRows);

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (let i = 0; i < visible.length; i++) {
      const ev = visible[i];
      const elapsed = this.t - ev.at;
      const ratio = Math.max(0, Math.min(1, 1 - elapsed / ev.ttl));
      // 淡出：最后 30% 时间快速消退
      const alpha = ratio > 0.3 ? 1 : Math.max(0, ratio / 0.3);
      // 入场动画：前 0.3 秒从左滑入
      const slideIn = Math.min(1, elapsed / 0.3);
      const offsetX = (1 - slideIn) * -12;

      const y = yBase + i * (rowH + rowGap);
      const x = panelX + offsetX;

      // 卡片背景（半透明深色）
      ctx.globalAlpha = alpha * 0.82;
      ctx.fillStyle = "rgba(8, 18, 32, 0.92)";
      roundRect(ctx, x, y, panelW, rowH, 5);
      ctx.fill();

      // 彩色左边框（事件类型标识）
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ev.color;
      ctx.fillRect(x, y, 3, rowH);

      // 顶部高光
      ctx.globalAlpha = alpha * 0.15;
      ctx.fillStyle = ev.color;
      roundRect(ctx, x + 3, y, panelW - 3, rowH, 5);
      ctx.fill();

      // 行 1：emoji + 标题
      ctx.globalAlpha = alpha;
      ctx.font = `700 11px ${Theme.fonts.body}`;
      ctx.fillStyle = ev.color;
      ctx.shadowColor = ev.color;
      ctx.shadowBlur = 4;
      const title = ev.title.length > 14 ? ev.title.slice(0, 13) + "…" : ev.title;
      ctx.fillText(`${ev.emoji} ${title}`, x + 10, y + 6);
      ctx.shadowBlur = 0;

      // 行 2：描述（截断 24 字）
      ctx.font = `400 9px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.7);
      const desc = ev.desc.length > 26 ? ev.desc.slice(0, 24) + "…" : ev.desc;
      ctx.fillText(desc, x + 10, y + 22);

      // 剩余时间细条（底部 2px 进度条，直观显示 TTL）
      const barW = panelW - 16;
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + 8, y + rowH - 6, barW, 2);
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = ev.color;
      ctx.fillRect(x + 8, y + rowH - 6, barW * ratio, 2);
    }

    ctx.restore();
  }

  /** v3：每日挑战 HUD（左上角，基地 HP 条下方，垂直 3 修饰符徽章） */
  private drawDailyHud(ctx: CanvasRenderingContext2D, _screenW: number, hud: ManagerHud, baseY: number): void {
    if (hud.mode !== "daily" || !hud.dailyModifiers) return;
    const mods = hud.dailyModifiers;
    const x = 16;
    const y0 = baseY + 28; // 基地 HP 条下方
    ctx.save();
    // 顶部标题
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 4;
    ctx.fillText(`DAILY · ${hud.dailySeed ?? ""}`, x, y0);
    ctx.shadowBlur = 0;
    // 3 个修饰符徽章（垂直排列）
    const badgeX = x;
    const badgeW = 130;
    const badgeH = 14;
    const gap = 3;
    for (let i = 0; i < mods.length && i < 3; i++) {
      const m = mods[i];
      const by = y0 + 14 + i * (badgeH + gap);
      // 背景
      ctx.fillStyle = withAlpha(m.color, 0.15);
      roundRect(ctx, badgeX, by, badgeW, badgeH, 3);
      ctx.fill();
      // 边框
      ctx.strokeStyle = withAlpha(m.color, 0.6);
      ctx.lineWidth = 1;
      roundRect(ctx, badgeX + 0.5, by + 0.5, badgeW - 1, badgeH - 1, 3);
      ctx.stroke();
      // emoji
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(m.emoji, badgeX + 6, by + badgeH / 2);
      // 名称（缩写 4 字）
      const shortName = m.name.length > 4 ? m.name.slice(0, 4) : m.name;
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = m.color;
      ctx.fillText(shortName, badgeX + 22, by + badgeH / 2);
    }
    ctx.restore();
  }

  /** 限时挑战：大倒计时 */
  private drawTimeTrialHud(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud, y: number): void {
    const sec = hud.timeLeft ?? 0;
    const low = sec < 10;
    const pulse = low ? 0.7 + 0.3 * Math.sin(this.pulse * 8) : 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("TIME TRIAL · 限时挑战", screenW / 2, y - 2);
    ctx.font = `900 ${Math.round(20 * pulse)}px ${Theme.fonts.mono}`;
    ctx.fillStyle = low ? "#E5353B" : this.getAccent();
    ctx.shadowColor = low ? "#E5353B" : this.getAccent();
    ctx.shadowBlur = low ? 14 : 8;
    ctx.fillText(`${sec.toFixed(1)}s`, screenW / 2, y + 12);
    ctx.shadowBlur = 0;
    // 进度条
    const barW = 160;
    const barX = (screenW - barW) / 2;
    const barY = y + 36;
    const barH = 6;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();
    const ratio = Math.max(0, Math.min(1, sec / 60));
    const color = sec < 10 ? "#E5353B" : sec < 30 ? "#FFD666" : this.getAccent();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    roundRect(ctx, barX, barY, barW * ratio, barH, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /** 无尽 Rush：绝对波数 + TIER */
  private drawEndlessHud(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud, y: number): void {
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#B388FF";
    ctx.shadowColor = "#B388FF";
    ctx.shadowBlur = 6;
    ctx.fillText(`ENDLESS RUSH · TIER ${hud.rushTier}`, screenW / 2, y - 2);
    ctx.shadowBlur = 0;
    ctx.font = `900 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#B388FF";
    ctx.shadowColor = "#B388FF";
    ctx.shadowBlur = 10;
    ctx.fillText(`反诈波次 ${hud.endlessWave}`, screenW / 2, y + 12);
    ctx.shadowBlur = 0;
    // TIER 进度（每 3 波升一级）
    const tierWave = (hud.endlessWave ?? 1) % 3;
    const barW = 120;
    const barX = (screenW - barW) / 2;
    const barY = y + 36;
    const barH = 5;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, barX, barY, barW, barH, 2.5);
    ctx.fill();
    ctx.fillStyle = "#B388FF";
    roundRect(ctx, barX, barY, barW * (tierWave / 3), barH, 2.5);
    ctx.fill();
  }

  // ====================================================================
  // v8 全面升级：UI 渲染方法
  // ====================================================================

  /** v8：卡牌手牌渲染（大招按钮上方，最多 3 张） */
  private drawCardHand(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hand = this.hud?.cardHand;
    if (!hand || hand.cards.length === 0) return;
    for (let i = 0; i < hand.cards.length; i++) {
      const card = hand.cards[i];
      const rect = this.getCardRect(i, screenW, screenH);
      const playable = hand.playable[i];
      const pressed = this.pressedCardIdx === i;
      // 卡牌背景
      ctx.save();
      ctx.globalAlpha = playable ? 1 : 0.5;
      ctx.fillStyle = pressed ? withAlpha(card.color, 0.85) : "#1a1a2e";
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
      ctx.fill();
      ctx.strokeStyle = card.color;
      ctx.lineWidth = pressed ? 2 : 1.5;
      ctx.stroke();
      // 稀有度光晕
      if (playable) {
        const pulse = 0.4 + 0.3 * Math.sin(this.pulse * 3 + i);
        ctx.shadowColor = card.color;
        ctx.shadowBlur = 8 * pulse;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.shadowBlur = 0;
      }
      // emoji
      ctx.font = `700 22px ${Theme.fonts.body}`;
      ctx.fillStyle = card.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(card.emoji, rect.x + rect.w / 2, rect.y + 20);
      // 名称（截断）
      ctx.font = `700 9px ${Theme.fonts.body}`;
      ctx.fillStyle = "#FFF";
      const name = card.name.length > 6 ? card.name.slice(0, 6) + "…" : card.name;
      ctx.fillText(name, rect.x + rect.w / 2, rect.y + 44);
      // 费用
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = playable ? "#FFD666" : "#666";
      ctx.fillText(`${card.cost}⚡`, rect.x + rect.w / 2, rect.y + 62);
      // 稀有度条
      const rarityColors: Record<string, string> = { common: "#999", rare: "#4FC3F7", epic: "#B388FF", legendary: "#FFD666" };
      ctx.fillStyle = rarityColors[card.rarity] ?? "#999";
      ctx.fillRect(rect.x + 4, rect.y + rect.h - 4, rect.w - 8, 3);
      ctx.restore();
    }
  }

  /** v8 简化：口诀槽渲染（重部署按钮上方，2 个，仅 BOSS 战显示） */
  private drawCounterspellSlots(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const slots = this.hud?.counterspellSlots;
    if (!slots || slots.slots.length === 0) return;
    for (let i = 0; i < slots.slots.length; i++) {
      const cs = slots.slots[i];
      const cd = slots.cooldowns[i] ?? 0;
      const rect = this.getCounterspellRect(i, screenW, screenH);
      const pressed = this.pressedCounterspellIdx === i;
      const onCooldown = cd > 0;
      ctx.save();
      ctx.globalAlpha = onCooldown ? 0.4 : 1;
      ctx.fillStyle = pressed ? withAlpha(cs.color, 0.85) : "#1a1a2e";
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
      ctx.fill();
      ctx.strokeStyle = cs.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // emoji + 口诀文本
      ctx.font = `700 11px ${Theme.fonts.body}`;
      ctx.fillStyle = cs.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${cs.emoji} ${cs.text}`, rect.x + rect.w / 2, rect.y + rect.h / 2);
      // 冷却覆盖
      if (onCooldown) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
        ctx.fill();
        ctx.fillStyle = "#FFD666";
        ctx.font = `700 11px ${Theme.fonts.mono}`;
        ctx.fillText(`${cd.toFixed(1)}s`, rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
      ctx.restore();
    }
  }

  /** v8：探员头像栏渲染（重部署按钮右侧，用于选中下达战术指令） */
  private drawAgentPortraits(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const agents = this.hud?.agents;
    if (!agents || agents.length === 0) return;
    const selectedIdx = this.hud?.selectedAgentIdx ?? null;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const rect = this.getAgentPortraitRect(i, screenW, screenH);
      const pressed = this.pressedAgentIdx === i;
      const selected = selectedIdx === i;
      ctx.save();
      // 头像背景
      ctx.fillStyle = a.alive ? (pressed ? "#FFD666" : "#2a2a4e") : "#333";
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
      ctx.fill();
      ctx.strokeStyle = selected ? "#FFD666" : a.alive ? "#4FC3F7" : "#666";
      ctx.lineWidth = selected ? 2.5 : 1;
      ctx.stroke();
      if (selected) {
        ctx.shadowColor = "#FFD666";
        ctx.shadowBlur = 8;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.shadowBlur = 0;
      }
      // 探员 emoji（居中）
      const def = AGENTS.find((ag) => ag.id === a.id);
      const emoji = def?.emoji ?? "?";
      ctx.font = `700 18px ${Theme.fonts.body}`;
      ctx.fillStyle = a.alive ? "#FFF" : "#666";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, rect.x + rect.w / 2, rect.y + rect.h / 2 - 3);
      // HP 条
      if (a.alive) {
        const hpRatio = Math.max(0, a.hp / a.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(rect.x + 2, rect.y + rect.h - 5, rect.w - 4, 3);
        ctx.fillStyle = hpRatio > 0.5 ? "#52C41A" : hpRatio > 0.25 ? "#FFB020" : "#E5353B";
        ctx.fillRect(rect.x + 2, rect.y + rect.h - 5, (rect.w - 4) * hpRatio, 3);
      }
      ctx.restore();
    }
  }

  /** v8：战术指令面板渲染（选中探员时显示 5 个指令按钮） */
  private drawTacticalCommands(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const selectedIdx = this.hud?.selectedAgentIdx;
    const cmdState = this.hud?.tacticalCommandState;
    if (selectedIdx === null || selectedIdx === undefined || !cmdState) return;
    for (let i = 0; i < TACTICAL_COMMANDS.length; i++) {
      const cmd = TACTICAL_COMMANDS[i];
      const rect = this.getTacticalCommandRect(i, screenW, screenH);
      const cd = cmdState.cooldowns[cmd.kind] ?? 0;
      const active = cmdState.activeKind === cmd.kind;
      const pressed = this.pressedCommandIdx === i;
      const onCooldown = cd > 0;
      ctx.save();
      ctx.globalAlpha = onCooldown ? 0.4 : 1;
      ctx.fillStyle = active ? cmd.color : pressed ? withAlpha(cmd.color, 0.7) : "#1a1a2e";
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
      ctx.fill();
      ctx.strokeStyle = cmd.color;
      ctx.lineWidth = active ? 2 : 1;
      ctx.stroke();
      if (active) {
        ctx.shadowColor = cmd.color;
        ctx.shadowBlur = 8;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.shadowBlur = 0;
      }
      ctx.font = `700 10px ${Theme.fonts.body}`;
      ctx.fillStyle = active ? "#FFF" : cmd.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${cmd.emoji}${cmd.name}`, rect.x + rect.w / 2, rect.y + rect.h / 2);
      if (onCooldown) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
        ctx.fill();
        ctx.fillStyle = "#FFD666";
        ctx.font = `700 9px ${Theme.fonts.mono}`;
        ctx.fillText(`${cd.toFixed(0)}s`, rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
      ctx.restore();
    }
  }

  /** v8：受害人营救计数（顶部小面板） */
  private drawVictimRescueHud(ctx: CanvasRenderingContext2D, screenW: number): void {
    const rescued = this.hud?.victimsRescued ?? 0;
    const lost = this.hud?.victimsLost ?? 0;
    if (rescued === 0 && lost === 0) return;
    ctx.save();
    const x = screenW / 2 - 60;
    const y = 56;
    const w = 120;
    const h = 22;
    ctx.fillStyle = "rgba(26,26,46,0.85)";
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.font = `700 11px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#52C41A";
    ctx.fillText(`✓${rescued}`, x + 30, y + h / 2);
    ctx.fillStyle = "#E5353B";
    ctx.fillText(`✗${lost}`, x + 70, y + h / 2);
    ctx.fillStyle = "#FFD666";
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillText("营救", x + 100, y + h / 2);
    ctx.restore();
  }

  /** v8：案例五步复盘 overlay（胜利时显示，玩家选择拦截点） */
  private renderCaseBreakdownOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const breakdown = this.hud?.pendingCaseBreakdown;
    if (!breakdown) return;
    const answered = this.hud?.lastBreakdownCorrect !== null && this.hud?.lastBreakdownCorrect !== undefined;
    ctx.save();
    // 遮罩
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 卡片
    const cardW = Math.min(480, screenW - 64);
    const cardH = 360;
    const cardX = (screenW - cardW) / 2;
    const cardY = (screenH - cardH) / 2;
    ctx.fillStyle = "#1a1a2e";
    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = "#FFB020";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 标题
    ctx.font = `700 14px ${Theme.fonts.body}`;
    ctx.fillStyle = "#FFB020";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(breakdown.title, screenW / 2, cardY + 16);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("选择最关键的拦截点（答对获奖励）", screenW / 2, cardY + 38);
    // 步骤列表
    for (let i = 0; i < breakdown.steps.length; i++) {
      const step = breakdown.steps[i];
      const rect = this.getCaseBreakdownStepRect(i, screenW, screenH);
      const pressed = this.pressedBreakdownIdx === i;
      const isCorrect = answered && i === breakdown.correctInterceptIdx;
      const isWrong = answered && this.hud?.lastBreakdownCorrect === false && i === this.pressedBreakdownIdx;
      ctx.fillStyle = isCorrect ? "rgba(82,196,26,0.25)" : isWrong ? "rgba(229,53,59,0.25)" : pressed ? "rgba(255,176,32,0.2)" : "rgba(255,255,255,0.05)";
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
      ctx.fill();
      ctx.strokeStyle = isCorrect ? "#52C41A" : isWrong ? "#E5353B" : "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `700 11px ${Theme.fonts.body}`;
      ctx.fillStyle = "#FFF";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${step.order}. ${step.name}`, rect.x + 10, rect.y + 14);
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText(step.desc.length > 32 ? step.desc.slice(0, 32) + "…" : step.desc, rect.x + 10, rect.y + 30);
    }
    ctx.restore();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    // v7 D1：新手引导最高优先级
    if (this.tutorialOverlay?.active) {
      return this.tutorialOverlay.handleTouch(type, x, y);
    }
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    // v8：案例五步复盘 overlay（绘制于结算之上，优先拦截触摸）
    if (this.hud?.pendingCaseBreakdown) {
      const breakdown = this.hud.pendingCaseBreakdown;
      const answered = this.caseBreakdownAnsweredAt !== null;
      if (type === "start" && !answered) {
        for (let i = 0; i < breakdown.steps.length; i++) {
          if (hitTest(x, y, this.getCaseBreakdownStepRect(i, screenW, screenH))) {
            this.pressedBreakdownIdx = i;
            return true;
          }
        }
        return true; // 复盘阶段消费所有 touch
      } else if (type === "end" && !answered) {
        if (this.pressedBreakdownIdx !== null) {
          const idx = this.pressedBreakdownIdx;
          const rect = this.getCaseBreakdownStepRect(idx, screenW, screenH);
          if (hitTest(x, y, rect)) {
            this.engine?.answerCaseBreakdown(idx);
            this.caseBreakdownAnsweredAt = this.t;
            playSfx("click");
            vibrateShort();
          }
          this.pressedBreakdownIdx = null;
        }
        return true;
      }
      return true; // 复盘 overlay 存在时消费所有 touch
    }
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const ultBtn = this.getUltButtonRect(screenW, screenH);
    const redeployBtn = this.getRedeployButtonRect(screenW, screenH);

    // ===== 触摸优先级 1：战间答题（最高，屏蔽其他交互） =====
    if (this.hud?.pendingQuiz) {
      if (type === "start") {
        for (let i = 0; i < 4; i++) {
          if (hitTest(x, y, this.getQuizOptionRect(i, screenW, screenH))) {
            this.pressedQuizIdx = i;
            return true;
          }
        }
        return true; // 答题阶段消费所有 touch
      } else if (type === "end") {
        if (this.pressedQuizIdx !== null) {
          const idx = this.pressedQuizIdx;
          const rect = this.getQuizOptionRect(idx, screenW, screenH);
          if (hitTest(x, y, rect)) {
            this.engine?.answerQuiz(idx);
            playSfx("click");
            vibrateShort();
          }
          this.pressedQuizIdx = null;
        }
        return true;
      }
      return true;
    }

    // ===== v7：触摸优先级 1.5：爬塔事件（与答题同级，互斥） =====
    if (this.hud?.pendingTowerEvent) {
      const evt = this.hud.pendingTowerEvent;
      if (type === "start") {
        for (let i = 0; i < evt.options.length; i++) {
          if (hitTest(x, y, this.getTowerEventOptionRect(i, evt.options.length, screenW, screenH))) {
            this.pressedEventOptionIdx = i;
            return true;
          }
        }
        return true; // 事件阶段消费所有 touch
      } else if (type === "end") {
        if (this.pressedEventOptionIdx !== null) {
          const idx = this.pressedEventOptionIdx;
          const rect = this.getTowerEventOptionRect(idx, evt.options.length, screenW, screenH);
          if (hitTest(x, y, rect)) {
            const opt = evt.options[idx];
            this.engine?.resolveTowerEvent(opt.id);
            playSfx("click");
            vibrateShort();
          }
          this.pressedEventOptionIdx = null;
        }
        return true;
      }
      return true;
    }

    // ===== 触摸优先级 2：BOSS 对话（点击屏幕任意位置前进） =====
    if (this.bossDialogue) {
      if (type === "end") {
        const dlg = this.bossDialogue;
        const nextIdx = dlg.idx + 1;
        if (nextIdx >= dlg.lines.length) {
          // 对话结束
          this.bossDialogue = null;
          this.bossDialoguePhase = null;
        } else {
          dlg.idx = nextIdx;
        }
        playSfx("click");
        vibrateShort();
        return true; // 消费 touch
      }
      return true; // 对话进行中消费所有 touch
    }

    // ===== 触摸优先级 3：探员升级阶段 =====
    if (this.hud && this.hud.phase === "upgrade" && this.hud.upgradeChoices) {
      if (type === "start") {
        for (let i = 0; i < this.hud.upgradeChoices.length; i++) {
          if (hitTest(x, y, this.getUpgradeChoiceRect(i, screenW))) {
            this.pressedUpgradeIdx = i;
            return true;
          }
        }
        return true; // 升级阶段消费所有 touch
      } else if (type === "end") {
        if (this.pressedUpgradeIdx !== null) {
          const idx = this.pressedUpgradeIdx;
          const rect = this.getUpgradeChoiceRect(idx, screenW);
          if (hitTest(x, y, rect)) {
            const choice = this.hud.upgradeChoices[idx];
            this.engine?.chooseUpgrade(choice.id as AgentUpgradeKind);
            playSfx("click");
            vibrateShort();
          }
          this.pressedUpgradeIdx = null;
        }
        return true;
      }
      return true;
    }

    // ===== 触摸优先级 4：战术装置放置模式（点击战场区域放置） =====
    if (this.placingDeviceIdx !== null) {
      const placingIdx = this.placingDeviceIdx;
      const deviceRect = this.getTacticalDeviceRect(placingIdx, screenW, screenH);
      // 点击同一个装置图标 → 取消放置模式
      if (type === "start" && hitTest(x, y, deviceRect)) {
        this.pressedDeviceIdx = placingIdx;
        return true;
      }
      if (type === "end") {
        if (this.pressedDeviceIdx === placingIdx && hitTest(x, y, deviceRect)) {
          // 取消放置模式
          this.placingDeviceIdx = null;
          this.pressedDeviceIdx = null;
          playSfx("click");
          vibrateShort();
          return true;
        }
        // 点击战场区域（非底部按钮栏、非顶部 HUD）→ 放置装置
        const inBottomBar = y > redeployBtn.y - 4;
        const inTopBar = y < 52;
        if (!inBottomBar && !inTopBar) {
          const def = TACTICAL_DEVICES[placingIdx];
          if (def) {
            const ok = this.engine?.placeTacticalDevice(def.kind as TacticalDeviceKind, x, y) ?? false;
            if (ok) {
              playSfx("click");
              vibrateShort();
            }
            // 无论成功与否，退出放置模式
            this.placingDeviceIdx = null;
            this.pressedDeviceIdx = null;
            return true;
          }
        }
        // 其他情况也退出放置模式
        this.placingDeviceIdx = null;
        this.pressedDeviceIdx = null;
        return true;
      }
      return true; // 放置模式中消费所有 touch
    }

    // ===== v11：触摸优先级 4.5 —— 重部署目标格选取（pickingTarget 模态） =====
    if (this.hud?.redeployState?.pickingTarget) {
      const redeployBtn = this.getRedeployButtonRect(screenW, screenH);
      const inBottomBar = y > redeployBtn.y - 4;
      if (type === "start") {
        // 点击重部署按钮 → 取消（在 priority 5 之前消费，避免触发 beginRedeploy 二次进入）
        if (hitTest(x, y, redeployBtn)) { this.pressedRedeploy = true; return true; }
        // 点击棋盘区域（非底栏）→ 标记目标格按压
        if (!inBottomBar) { this.pressedRedeployTarget = true; return true; }
        return true; // 其余区域消费，不响应
      } else if (type === "end") {
        if (this.pressedRedeploy && hitTest(x, y, redeployBtn)) {
          // 再次点击重部署按钮 → 取消
          this.engine?.cancelRedeploy();
          playSfx("click");
          vibrateShort();
        } else if (this.pressedRedeployTarget) {
          // 选取目标格：屏幕坐标 → 引擎坐标 → 格子坐标
          const local = this.director.screenToLocal(x, y, 960, 540);
          const col = Math.floor((local.x - MAZE_OFFSET_X) / MAZE_CELL);
          const row = Math.floor((local.y - MAZE_OFFSET_Y) / MAZE_CELL);
          const selIdx = this.hud?.redeployState?.selectedAgentIdx;
          if (selIdx !== null && selIdx !== undefined && col >= 0 && col < MAZE_COLS && row >= 0 && row < MAZE_ROWS) {
            this.engine?.redeployAgent(selIdx, col, row);
            playSfx("click");
            vibrateShort();
          } else {
            // 越界 → 取消
            this.engine?.cancelRedeploy();
          }
        }
        this.pressedRedeploy = false;
        this.pressedRedeployTarget = false;
        return true;
      }
      return true;
    }

    // ===== 触摸优先级 5：v8 卡牌/口诀槽/探员头像/战术指令 + 大招/重部署/战术装置/暂停 =====
    if (type === "start") {
      // v8：卡牌手牌
      const cardHand = this.hud?.cardHand;
      if (cardHand && cardHand.cards.length > 0) {
        for (let i = 0; i < cardHand.cards.length; i++) {
          if (hitTest(x, y, this.getCardRect(i, screenW, screenH))) {
            this.pressedCardIdx = i;
            return true;
          }
        }
      }
      // v8：口诀槽
      const csSlots = this.hud?.counterspellSlots;
      if (csSlots && csSlots.slots.length > 0) {
        for (let i = 0; i < csSlots.slots.length; i++) {
          if (hitTest(x, y, this.getCounterspellRect(i, screenW, screenH))) {
            this.pressedCounterspellIdx = i;
            return true;
          }
        }
      }
      // v8：探员头像
      const agents = this.hud?.agents;
      if (agents && agents.length > 0) {
        for (let i = 0; i < agents.length; i++) {
          if (hitTest(x, y, this.getAgentPortraitRect(i, screenW, screenH))) {
            this.pressedAgentIdx = i;
            return true;
          }
        }
      }
      // v8：战术指令（仅选中探员时可用）
      const selectedAgentIdx = this.hud?.selectedAgentIdx;
      if (selectedAgentIdx !== null && selectedAgentIdx !== undefined && this.hud?.tacticalCommandState) {
        for (let i = 0; i < TACTICAL_COMMANDS.length; i++) {
          if (hitTest(x, y, this.getTacticalCommandRect(i, screenW, screenH))) {
            this.pressedCommandIdx = i;
            return true;
          }
        }
      }
      if (hitTest(x, y, ultBtn)) { this.pressedUlt = true; return true; }
      if (hitTest(x, y, redeployBtn)) { this.pressedRedeploy = true; return true; }
      // 战术装置图标
      for (let i = 0; i < TACTICAL_DEVICES.length; i++) {
        if (hitTest(x, y, this.getTacticalDeviceRect(i, screenW, screenH))) {
          this.pressedDeviceIdx = i;
          return true;
        }
      }
      // 战术暂停按钮
      const pauseRect = this.getTacticalPauseRect(screenW, screenH);
      if (hitTest(x, y, pauseRect)) { this.pressedTacticalPause = true; return true; }
      // v8：点击引擎区域内的话术气泡（选中以便精准击破）
      if (this.hud?.speechBubbles && this.hud.speechBubbles.length > 0) {
        const local = this.director.screenToLocal(x, y, 960, 540);
        for (const b of this.hud.speechBubbles) {
          // 气泡命中区：engine 坐标系，bw=150, bh=32, bx=b.x-75, by=b.y-32
          if (local.x >= b.x - 75 && local.x <= b.x + 75 && local.y >= b.y - 34 && local.y <= b.y + 4) {
            this.selectedBubbleId = b.id;
            playSfx("click");
            vibrateShort();
            return true;
          }
        }
      }
      return false;
    } else if (type === "end") {
      // v8：卡牌大招
      if (this.pressedCardIdx !== null) {
        const idx = this.pressedCardIdx;
        const rect = this.getCardRect(idx, screenW, screenH);
        if (hitTest(x, y, rect)) {
          const playable = this.hud?.cardHand?.playable[idx] ?? false;
          if (playable) {
            this.engine?.castCardSkill(idx);
            playSfx("bomb");
            vibrateShort();
          } else {
            playSfx("click");
          }
        }
        this.pressedCardIdx = null;
        // 卡牌点击后不再处理其他按钮
        this.pressedUlt = false;
        this.pressedRedeploy = false;
        this.pressedDeviceIdx = null;
        this.pressedTacticalPause = false;
        this.pressedCounterspellIdx = null;
        this.pressedAgentIdx = null;
        this.pressedCommandIdx = null;
        return true;
      }
      // v8：口诀槽击破
      if (this.pressedCounterspellIdx !== null) {
        const idx = this.pressedCounterspellIdx;
        const rect = this.getCounterspellRect(idx, screenW, screenH);
        if (hitTest(x, y, rect)) {
          const cd = this.hud?.counterspellSlots?.cooldowns[idx] ?? 0;
          if (cd <= 0) {
            this.engine?.popSpeechBubbleBySlot(idx, this.selectedBubbleId ?? undefined);
            playSfx("click");
            vibrateShort();
            // 击破后清除选中
            this.selectedBubbleId = null;
          } else {
            playSfx("click");
          }
        }
        this.pressedCounterspellIdx = null;
        this.pressedUlt = false;
        this.pressedRedeploy = false;
        this.pressedDeviceIdx = null;
        this.pressedTacticalPause = false;
        this.pressedAgentIdx = null;
        this.pressedCommandIdx = null;
        return true;
      }
      // v8：探员头像选中（toggle）
      if (this.pressedAgentIdx !== null) {
        const idx = this.pressedAgentIdx;
        const rect = this.getAgentPortraitRect(idx, screenW, screenH);
        if (hitTest(x, y, rect)) {
          const cur = this.hud?.selectedAgentIdx ?? null;
          this.engine?.selectAgent(cur === idx ? null : idx);
          playSfx("click");
          vibrateShort();
        }
        this.pressedAgentIdx = null;
        this.pressedUlt = false;
        this.pressedRedeploy = false;
        this.pressedDeviceIdx = null;
        this.pressedTacticalPause = false;
        this.pressedCommandIdx = null;
        return true;
      }
      // v8：战术指令下达
      if (this.pressedCommandIdx !== null) {
        const idx = this.pressedCommandIdx;
        const rect = this.getTacticalCommandRect(idx, screenW, screenH);
        if (hitTest(x, y, rect)) {
          const cmd = TACTICAL_COMMANDS[idx];
          const selIdx = this.hud?.selectedAgentIdx;
          if (cmd && selIdx !== null && selIdx !== undefined) {
            const ok = this.engine?.useTacticalCommand(selIdx, cmd.kind) ?? false;
            playSfx(ok ? "click" : "click");
            vibrateShort();
          }
        }
        this.pressedCommandIdx = null;
        this.pressedUlt = false;
        this.pressedRedeploy = false;
        this.pressedDeviceIdx = null;
        this.pressedTacticalPause = false;
        return true;
      }
      if (this.pressedUlt && hitTest(x, y, ultBtn)) {
        this.engine?.triggerUlt();
        playSfx("click");
        vibrateShort();
      } else if (this.pressedRedeploy && hitTest(x, y, redeployBtn)) {
        // v11：进入重部署选目标模式（需先选中一名探员）
        const selIdx = this.hud?.selectedAgentIdx;
        if (selIdx === null || selIdx === undefined) {
          this.toast = { text: "请先选中一名探员再重部署", tone: "bad", until: this.t + 2 };
          playSfx("click");
        } else if (this.hud?.redeployReady) {
          this.engine?.beginRedeploy(selIdx);
          playSfx("click");
          vibrateShort();
        } else {
          this.toast = { text: "能量不足，无法重部署", tone: "bad", until: this.t + 2 };
          playSfx("click");
        }
      } else if (this.pressedDeviceIdx !== null) {
        const idx = this.pressedDeviceIdx;
        const rect = this.getTacticalDeviceRect(idx, screenW, screenH);
        if (hitTest(x, y, rect)) {
          // 检查冷却：冷却中不可进入放置模式
          const state = this.hud?.tacticalDevices?.[idx];
          const cooling = (state?.cooldownLeft ?? 0) > 0;
          if (!cooling) {
            // 进入放置模式
            this.placingDeviceIdx = idx;
          }
          playSfx(cooling ? "click" : "click");
          vibrateShort();
        }
      } else if (this.pressedTacticalPause) {
        const pauseRect = this.getTacticalPauseRect(screenW, screenH);
        if (hitTest(x, y, pauseRect)) {
          this.engine?.toggleTacticalPause();
          playSfx("click");
          vibrateShort();
        }
      }
      this.pressedUlt = false;
      this.pressedRedeploy = false;
      this.pressedDeviceIdx = null;
      this.pressedTacticalPause = false;
      return true;
    }
    return false;
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

// ====================================================================
// v6 Phase 3：文本辅助函数（局部，用于答题/对话多行换行 + 选项截断）
// ====================================================================

/** 按字符宽度换行（中文按字符逐个测量） */
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

/** 截断文本到指定宽度（超出加 "…"） */
function fitTextWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const test = text.slice(0, mid) + "…";
    if (ctx.measureText(test).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? text.slice(0, lo) + "…" : "…";
}

/** v7：格式化涉案金额（元 → 万/亿） */
function formatAmount(yuan: number): string {
  if (yuan >= 100000000) {
    return `${(yuan / 100000000).toFixed(yuan % 100000000 === 0 ? 0 : 2)} 亿`;
  }
  if (yuan >= 10000) {
    return `${(yuan / 10000).toFixed(yuan % 10000 === 0 ? 0 : 1)} 万`;
  }
  return `${yuan}`;
}

/**
 * v10 P0-1d：从 GameResultPayload.stats 中安全读取 learnedFraudTips 数组
 * - stats 类型为 unknown，需做类型守卫
 * - 兼容 engine 写入的 { learnedFraudTips: string[] } 结构
 */
function readLearnedTipsFromStats(stats: unknown): string[] {
  if (!stats || typeof stats !== "object") return [];
  const s = stats as { learnedFraudTips?: unknown };
  if (Array.isArray(s.learnedFraudTips)) {
    return s.learnedFraudTips.filter((t): t is string => typeof t === "string");
  }
  return [];
}
