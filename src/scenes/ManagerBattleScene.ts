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
} from "@/games/manager/types";
import {
  MODE_META, TACTICAL_DEVICES, SKILL_LINKS, ELEMENT_REACTIONS,
  BOSS_RUSH_BOSSES, getBossDialogue, seasonRankFromScore,
} from "@/games/manager/data";
import { getCaseByEnemyId, STORY_CHAPTERS } from "@/games/manager/data.v7";
import type { RealCaseDef } from "@/games/manager/types";
import type { V7ManagerReportData } from "@/utils/battleReport";
import type { MazeDef } from "@/games/manager/maze";
import { roundRect } from "@/engine/Renderer";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { ManagerDeployScene } from "./ManagerDeployScene";
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
  private hud: ManagerHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  /** v7 D1：战斗新手引导（首次进入时展示） */
  private tutorialOverlay: TutorialOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedUlt = false;
  private pressedRedeploy = false;
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
    const engine = new ManagerEngine(canvas, this.deployment, this.mode, this.maze ?? undefined);
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
      // v7：结算页展示真实案例摘要 + 96110
      renderExtraStats: realCase
        ? (ctx, x, y, w) => this.renderRealCasePanel(ctx, x, y, w, realCase!)
        : undefined,
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

  private retry(): void {
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.pressedUlt = false;
    this.pressedRedeploy = false;
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

    // 重新部署按钮
    const redeployBtn = this.getRedeployButtonRect(screenW, screenH);
    drawButton(ctx, redeployBtn.x, redeployBtn.y, redeployBtn.w, redeployBtn.h, "重部署", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedRedeploy,
    });
    drawIcon(ctx, "rotate", redeployBtn.x + redeployBtn.w - 16, redeployBtn.y + 6, 12, Theme.colors.ink.muted);

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

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
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
  // v6 Phase 3 任务 1.4：元素反应 / 技能链激活提示
  // ====================================================================

  /** 渲染当前激活的元素反应 + 技能链（连击 HUD 下方，小图标行） */
  private drawActiveEffects(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud): void {
    const reactions = hud.activeElementReactions ?? [];
    const links = hud.activeSkillLinks ?? [];
    if (reactions.length === 0 && links.length === 0) return;
    // 位置：连击 HUD（y=96）下方，右对齐
    const y = 120;
    const xRight = screenW - 16;
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    let cursorX = xRight;
    // 技能链（先渲染，靠右）
    for (let i = links.length - 1; i >= 0; i--) {
      const link = links[i];
      const def = SKILL_LINKS.find((s) => s.id === link.id);
      const color = def?.color ?? Theme.colors.neon.DEFAULT;
      const emoji = def?.emoji ?? "🔗";
      const text = `${emoji} ${link.name} ${link.remaining.toFixed(1)}s`;
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
    // 元素反应（渲染在技能链左侧）
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

  /** v3：每日挑战 HUD（左上角，基地 HP 下方，垂直 3 修饰符徽章） */
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

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    // v7 D1：新手引导最高优先级
    if (this.tutorialOverlay?.active) {
      return this.tutorialOverlay.handleTouch(type, x, y);
    }
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
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

    // ===== 触摸优先级 5：大招/重部署/战术装置/暂停按钮 =====
    if (type === "start") {
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
      return false;
    } else if (type === "end") {
      if (this.pressedUlt && hitTest(x, y, ultBtn)) {
        this.engine?.triggerUlt();
        playSfx("click");
        vibrateShort();
      } else if (this.pressedRedeploy && hitTest(x, y, redeployBtn)) {
        playSfx("click");
        setOrientation("portrait");
        this.director.replace(new ManagerDeployScene(this.director));
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
