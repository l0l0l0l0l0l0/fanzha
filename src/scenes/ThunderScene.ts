/**
 * 「雷霆反诈」游戏场景
 * 引擎画布 540×960 竖屏，引擎 InputManager 处理飞船拖拽
 * Scene 负责炸弹按钮（consumedTouchIds 防冲突）+ Boss HP 条 + 结算
 *
 * 升级版新增 UI：
 *  - 难度/模式选择 overlay（进场）
 *  - Roguelike Buff 选择 overlay（每波结束）
 *  - 大招按钮（雷霆审判）
 *  - 暂停 overlay
 *  - 专属结算页（ThunderResultOverlay）
 *  - 阶段切换全屏 overlay（PHASE 2/3 等）
 *  - 连击脉冲显示 + 武器经验条 + 分数倍率 pill
 *  - 成就 toast + BOSS 狂暴警示 + 时间减速全屏色调
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawButton, drawProgressBar, drawToast, drawNeonCorners, hitTest, type Rect } from "@/ui/widgets";
import { ThunderEngine } from "@/games/thunder/engine";
import {
  BOSS,
  DIFFICULTY_LIST,
  THUNDER_THEMES,
  CHARACTERS,
  CHARACTER_MAP,
  EQUIPMENTS_BY_SLOT,
  EQUIPMENT_MAP,
  EQUIP_RARITY_LABEL,
  EQUIP_SLOT_LABEL,
  isCharacterUnlocked,
  loadThunderSaveSnapshot,
  persistThunderEquipSelection,
  persistThunderSave,
  TALENT_TREE,
  TALENT_BY_BRANCH,
  canUnlockTalent,
  unlockTalent,
  // v5 升级导入
  THUNDER_SKINS,
  DAILY_QUESTS,
  getTodayQuestProgress,
} from "@/games/thunder/data";
import { HP_PER_YUANBAO, MAX_HP } from "@/games/thunder/types";
import type {
  ThunderHud,
  Difficulty,
  ThunderMode,
  ThunderEngineOptions,
  RoguelikeBuffKind,
  ThunderTheme,
  ThunderThemeDef,
  CharacterId,
  EquipmentDef,
  EquipSlot,
  ThunderSaveData,
  ThunderTalentBranch,
  ThunderTalentNodeDef,
  // v6 升级类型导入
  ThunderBossAIDialogChoice,
  // v7 升级类型导入
  ThunderKnowledgeCategory,
} from "@/games/thunder/types";
// v7 升级：子场景入口数据
import {
  THUNDER_STORY_CAMPAIGN,
  isStageUnlocked,
  getStoryProgress,
} from "@/games/thunder/story";
import {
  getAllLessonChapters,
  isChapterUnlocked,
} from "@/games/thunder/lessons";
import { THUNDER_RPG_SCENARIOS } from "@/games/thunder/rpgScenarios";
import {
  THUNDER_KNOWLEDGE_NODES,
  THUNDER_KNOWLEDGE_EDGES,
  getNodesByCategory,
  calcOverallMastery,
} from "@/games/thunder/knowledgeGraph";
import {
  THUNDER_CERTIFICATES,
  getAllCertificateProgress,
  CERT_LEVEL_COLOR,
} from "@/games/thunder/certificate";
import { playSfx } from "@/engine/Audio";
import { vibrateShort } from "@/platform/web";
import { ThunderResultOverlay } from "./ThunderResultOverlay";
import { HubScene } from "./HubScene";
import { platformStore } from "@/store/platformStore";
import type { GameEvent, GameResultPayload } from "@/types";

/** 主题查找表（按 id） */
const THEME_MAP: Record<ThunderTheme, ThunderThemeDef> = THUNDER_THEMES.reduce(
  (acc, t) => { acc[t.id] = t; return acc; },
  {} as Record<ThunderTheme, ThunderThemeDef>,
);

/** 文本换行辅助（逐字符测量，兼容中英混排） */
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

/** 雷霆 BOSS codexId → 全局 CODEX typeId 映射（用于图鉴解锁接入） */
const THUNDER_CODEX_MAP: Record<string, string> = {
  "pig-butcher": "F02",            // 杀猪盘
  "fake-police": "F01",            // 冒充公检法
  "fake-cs": "F04",                // 冒充客服退款
  "fake-invest": "F05",            // 虚假投资理财
  "cross-border-syndicate": "F35", // 境外高薪招工诱骗（跨境电诈）
};

interface AchData { name: string; desc: string; emoji: string; }

export class ThunderScene extends GameShellScene {
  private engine: ThunderEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private hud: ThunderHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ThunderResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedBomb = false;
  private pressedBranchIdx: number | null = null;
  private pressedRoguelikeIdx: number | null = null;
  private pressedUltimate = false;
  private pressedPause = false;
  private pressedDifficultyIdx: number | null = null;
  // v6 升级：格挡 / 超觉醒大招 / AI 对话选项按下状态
  private pressedParry = false;
  private pressedSuperUlt = false;
  private pressedAIDialogChoiceIdx: number | null = null;
  private pressedArchiveClose = false;
  private t = 0;
  // v6 升级：AI 对话揭示态本地计时（选项反馈展示时长）
  private aiDialogFeedbackT = 0;
  // v6 升级：本地缓存的诈骗溯源档案（引擎一次性触发，场景层持续显示直到玩家关闭）
  private localFraudArchive: ThunderHud["fraudArchiveTrigger"] = null;

  // v2 升级：难度/模式选择状态
  private selectedDifficulty: Difficulty = "normal";
  private selectedMode: ThunderMode = "campaign";
  private showDifficultySelect = true;
  // v3 升级：分页选择（难度/角色/装备）
  private selectTab: "difficulty" | "character" | "equipment" | "talent" | "meta" = "difficulty";
  private pressedTabIdx: number | null = null;
  // v3 升级：角色/装备选择状态（从存档读取初始值）
  private selectedCharacter: CharacterId = "swat";
  private equippedEquipments: { weaponChip?: string; shieldCore?: string; moveModule?: string } = {};
  private pressedCharacterIdx: number | null = null;
  private pressedEquipSlotIdx: number | null = null;
  private pressedEquipChoiceIdx: number | null = null;
  private saveSnapshot: ThunderSaveData | null = null;

  // v2 升级：本局收集的图鉴解锁 codexId（从引擎 log 事件提取，结算时传入 recordGame）
  private collectedCodexTypeIds: string[] = [];

  // 新增动效状态
  private prevCombo = 0;
  private comboPulseT = 99; // 距离上次 combo 增加的秒数（初始大值=无脉冲）
  private achData: AchData | null = null;
  private achT = 0; // 当前成就显示计时
  private achFadingOut = false;

  // v7 升级：子场景入口状态
  /** 剧情模式选中的关卡 ID（null=使用引擎默认"继续剧情"） */
  private selectedStoryStageId: string | null = null;
  /** 课程模式选中的章节 ID（null=使用引擎默认） */
  private selectedLessonChapterId: string | null = null;
  /** RPG 模式选中的剧本 ID（null=随机） */
  private selectedRPGScenarioId: string | null = null;
  /** v7 子选择项按下索引（按下高亮） */
  private pressedV7SubIdx: number | null = null;
  /** v7 资料视图：null=不显示，"knowledge"=知识图谱，"certificate"=证书陈列 */
  private v7View: "knowledge" | "certificate" | null = null;
  /** v7 资料视图纵向滚动偏移（用于内容超出屏幕时拖拽滚动） */
  private v7ViewScroll = 0;
  /** v7 资料视图拖拽起点（用于计算滚动增量） */
  private v7ViewDragStartY: number | null = null;
  /** v7 资料视图拖拽起始滚动偏移 */
  private v7ViewDragStartScroll = 0;

  getGameTitle(): string { return "雷霆反诈"; }
  getGameSubtitle(): string { return "THUNDER"; }
  getAccent(): string { return Theme.accents.thunder; }

  enter(): void {
    super.enter();
    // v2 升级：先显示难度选择 overlay，玩家确认后再 spawnEngine
    this.showDifficultySelect = true;
    // v3 升级：读取存档快照，初始化角色/装备选择状态
    this.saveSnapshot = loadThunderSaveSnapshot();
    this.selectedCharacter = this.saveSnapshot.equippedCharacter ?? "swat";
    // 兜底：若存档角色未解锁，回退到 swat
    if (!isCharacterUnlocked(this.selectedCharacter, this.saveSnapshot)) {
      this.selectedCharacter = "swat";
    }
    this.equippedEquipments = { ...this.saveSnapshot.equippedEquipments };
    this.selectTab = "difficulty";
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    // v3 升级：持久化角色/装备选择到存档，并传入引擎选项
    persistThunderEquipSelection({
      equippedCharacter: this.selectedCharacter,
      equippedEquipments: this.equippedEquipments,
    });
    const options: ThunderEngineOptions = {
      difficulty: this.selectedDifficulty,
      mode: this.selectedMode,
      characterId: this.selectedCharacter,
      equipmentIds: this.equippedEquipments,
      // v7 升级：传入子场景入口选择
      storyStartStageId: this.selectedMode === "story" ? this.selectedStoryStageId ?? undefined : undefined,
      lessonChapterId: this.selectedMode === "lesson" ? this.selectedLessonChapterId ?? undefined : undefined,
      rpgScenarioId: this.selectedMode === "rpg" ? this.selectedRPGScenarioId ?? undefined : undefined,
    };
    const engine = new ThunderEngine(canvas, options);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    // 由 updateGame/renderGame 同步驱动，消除双 RAF 撕裂闪烁
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      const newHud = e.payload as unknown as ThunderHud;
      // 检测 combo 增加 → 触发脉冲
      if (newHud.combo > this.prevCombo) {
        this.comboPulseT = 0;
      }
      this.prevCombo = newHud.combo;
      // 检测成就变化
      const newAch = newHud.achievement;
      if (newAch) {
        if (!this.achData || this.achData.name !== newAch.name) {
          this.achData = { name: newAch.name, desc: newAch.desc, emoji: newAch.emoji };
          this.achT = 0;
          this.achFadingOut = false;
        }
      } else if (this.achData && !this.achFadingOut) {
        // 引擎清除了 achievement → 进入淡出
        this.achFadingOut = true;
        this.achT = 0;
      }
      // v6 升级：捕获一次性 fraudArchiveTrigger（引擎 emit 后即清空，场景层缓存以持续显示）
      if (newHud.fraudArchiveTrigger && !this.localFraudArchive) {
        this.localFraudArchive = newHud.fraudArchiveTrigger;
      }
      // v6 升级：检测 AI 对话反馈态变化，启动本地揭示计时
      if (newHud.bossAIDialog?.lastFeedback && this.aiDialogFeedbackT <= 0) {
        this.aiDialogFeedbackT = 1.2;
      }
      this.hud = newHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 3 };
      this.toastTimer = 0;
    } else if (e.type === "log") {
      // v2 升级：捕获图鉴解锁事件，映射 codexId → 全局 CODEX typeId
      const m = e.text.match(/^\[CODEX_UNLOCK\](.+)$/);
      if (m && m[1]) {
        const typeId = THUNDER_CODEX_MAP[m[1]] ?? m[1];
        if (!this.collectedCodexTypeIds.includes(typeId)) {
          this.collectedCodexTypeIds.push(typeId);
        }
      }
    } else if (e.type === "result") {
      this.onResult(e.payload);
    }
  }

  private onResult(result: GameResultPayload): void {
    // v2 升级：将本局收集的图鉴解锁传入 result，供 ThunderResultOverlay 调用 recordGame
    (result as GameResultPayload & { unlockedTypes?: string[] }).unlockedTypes = this.collectedCodexTypeIds.slice();
    // v2 升级：先记录 thunder 模块进度（更新 thunder 持久化字段 + 触发 thunder 专属成就）
    const stats = result.stats as { difficulty?: Difficulty; mode?: ThunderMode; maxCombo?: number; bossesDefeated?: number; wave?: number; endless?: boolean; elapsedSec?: number } | undefined;
    const engineSave = this.engine?.getSave();
    if (stats && engineSave) {
      platformStore.recordThunderGame({
        mode: stats.mode ?? "campaign",
        difficulty: stats.difficulty ?? "normal",
        score: result.score,
        win: result.win,
        wave: stats.wave,
        endless: stats.endless,
        maxCombo: stats.maxCombo,
        bossKills: stats.bossesDefeated,
        defeatedBossIds: engineSave.defeatedBosses,
        busted: result.bustedCount ?? 0,
        durationSec: stats.elapsedSec ?? 0,
        dailyCompleted: stats.mode === "daily" && result.win,
      });
    }
    this.resultOverlay = new ThunderResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director)),
    });
  }

  private retry(): void {
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.prevCombo = 0;
    this.comboPulseT = 99;
    this.achData = null;
    this.achT = 0;
    this.achFadingOut = false;
    this.pressedBomb = false;
    this.pressedBranchIdx = null;
    this.pressedRoguelikeIdx = null;
    this.pressedUltimate = false;
    this.pressedPause = false;
    // v6 升级：重置 v6 按钮与对话状态
    this.pressedParry = false;
    this.pressedSuperUlt = false;
    this.pressedAIDialogChoiceIdx = null;
    this.pressedArchiveClose = false;
    this.aiDialogFeedbackT = 0;
    this.localFraudArchive = null;
    // v2 升级：重置图鉴收集
    this.collectedCodexTypeIds = [];
    // v2 升级：重开时回到难度选择
    this.showDifficultySelect = true;
    // v3 升级：重置分页与选择状态（重新读取存档）
    this.saveSnapshot = loadThunderSaveSnapshot();
    this.selectedCharacter = this.saveSnapshot.equippedCharacter ?? "swat";
    if (!isCharacterUnlocked(this.selectedCharacter, this.saveSnapshot)) {
      this.selectedCharacter = "swat";
    }
    this.equippedEquipments = { ...this.saveSnapshot.equippedEquipments };
    this.selectTab = "difficulty";
    this.pressedTabIdx = null;
    this.pressedCharacterIdx = null;
    this.pressedEquipSlotIdx = null;
    this.pressedEquipChoiceIdx = null;
    // v7 升级：重置子场景入口状态
    this.pressedV7SubIdx = null;
    this.v7View = null;
    this.v7ViewScroll = 0;
    this.v7ViewDragStartY = null;
  }

  protected updateGame(dt: number): void {
    // v2 升级：难度选择阶段不更新引擎
    if (!this.showDifficultySelect) {
      this.engine?.stepUpdate(dt);
    }
    this.t += dt;
    this.comboPulseT += dt;
    // 成就 toast 计时
    if (this.achData) {
      this.achT += dt;
      if (this.achFadingOut && this.achT >= 0.3) {
        // 淡出完成
        this.achData = null;
        this.achFadingOut = false;
        this.achT = 0;
      }
    }
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 3) this.toast = null;
    }
    // v6 升级：AI 对话揭示态计时（反馈展示 1.2s 后自动消失，由引擎清空 lastFeedback）
    if (this.aiDialogFeedbackT > 0) {
      this.aiDialogFeedbackT -= dt;
      if (this.aiDialogFeedbackT <= 0) {
        this.aiDialogFeedbackT = 0;
      }
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  private getBombButtonRect(screenW: number, screenH: number): Rect {
    return { x: screenW - 76, y: screenH - 24 - 64 - 12, w: 64, h: 64 };
  }

  /** v2 升级：大招按钮矩形（左下角） */
  private getUltimateButtonRect(screenW: number, screenH: number): Rect {
    return { x: 12, y: screenH - 24 - 64 - 12, w: 64, h: 64 };
  }

  /** v2 升级：暂停按钮矩形（右上角） */
  private getThunderPauseButtonRect(screenW: number): Rect {
    return { x: screenW - 44, y: 12, w: 32, h: 32 };
  }

  /** v6 升级：格挡按钮矩形（左下角大招按钮上方） */
  private getParryButtonRect(_screenW: number, screenH: number): Rect {
    return { x: 12, y: screenH - 24 - 64 - 12 - 64 - 8, w: 64, h: 64 };
  }

  /** v6 升级：超觉醒大招按钮矩形（右下角反诈突击按钮上方） */
  private getSuperUltButtonRect(screenW: number, screenH: number): Rect {
    return { x: screenW - 76, y: screenH - 24 - 64 - 12 - 64 - 8, w: 64, h: 64 };
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // v2 升级：难度选择 overlay（进场优先）
    if (this.showDifficultySelect) {
      this.renderDifficultySelect(ctx, screenW, screenH);
      return;
    }

    if (this.engineCanvas && this.engine) {
      // 同步驱动引擎渲染，确保 engineCanvas 在 blit 前已完成本帧绘制
      this.engine.stepRender();
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // v2 升级：主题视觉色调（C3）
    this.renderThemeTint(ctx, screenW, screenH);

    // v2 升级：战机受损警示（C2，HP < 30% 时红色边缘脉冲）
    this.renderShipDamagedWarning(ctx, screenW, screenH);

    // 时间减速全屏色调
    if (this.hud && this.hud.slowMoUntil > 0) {
      this.renderSlowMoOverlay(ctx, screenW, screenH);
    }

    // Boss HP 条（含狂暴警示）
    if (this.hud && this.hud.phase === "boss" && this.hud.bossHp !== undefined && this.hud.bossMax) {
      this.renderBossBar(ctx, screenW);
    }

    // 状态信息（称号/积分/武器XP/生命值）
    if (this.hud) {
      this.renderStats(ctx, screenW);
      // v4：BossRush 进度 / 影子挑战 / 天赋&套装
      this.renderV4Hud(ctx, screenW, screenH);
      // v5：擦弹 / 无人机 / 克制 / BOSS阶段 / 保护目标 / 段位 / 案例剧场
      this.renderV5Hud(ctx, screenW, screenH);
    }

    // 公安反诈突击按钮
    const bombBtn = this.getBombButtonRect(screenW, screenH);
    const raids = this.hud?.raids ?? 0;
    drawButton(ctx, bombBtn.x, bombBtn.y, bombBtn.w, bombBtn.h, "", {
      variant: "hard", accent: raids > 0 ? "#FF7A1A" : Theme.colors.bg.line,
      pressed: this.pressedBomb,
    });
    ctx.save();
    ctx.font = "26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = raids > 0 ? 1 : 0.4;
    ctx.fillText("🚔", bombBtn.x + bombBtn.w / 2, bombBtn.y + bombBtn.h / 2 - 6);
    ctx.restore();
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = raids > 0 ? "#FFD666" : Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`×${raids}`, bombBtn.x + bombBtn.w / 2, bombBtn.y + bombBtn.h - 12);
    ctx.restore();
    // 突击按钮小标签
    ctx.save();
    ctx.font = `500 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = raids > 0 ? "#FF7A1A" : Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("反诈突击", bombBtn.x + bombBtn.w / 2, bombBtn.y - 8);
    ctx.restore();

    // v2 升级：大招按钮（雷霆审判）
    this.renderUltimateButton(ctx, screenW, screenH);

    // v2 升级：暂停按钮
    this.renderPauseButton(ctx, screenW);

    // 连击数显示（中央顶部）
    if (this.hud && this.hud.combo >= 2) {
      this.renderCombo(ctx, screenW);
    }

    // 时间减速指示徽章
    if (this.hud && this.hud.slowMoUntil > 0) {
      this.renderSlowMoBadge(ctx, screenW);
    }

    // 成就 toast（滑入式）
    this.renderAchievementToast(ctx, screenW);

    // Toast 通讯
    if (this.toast) {
      const tw = screenW - 32;
      const th = 56;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "战机通讯");
    }

    // 阶段切换全屏 overlay（最上层）
    this.renderPhaseTransition(ctx, screenW, screenH);

    // v2 升级：BOSS 登场 CG 全屏 overlay（C1）
    this.renderBossEntranceCG(ctx, screenW, screenH);

    // v4 升级：武器觉醒 CG 全屏 overlay（电影标题 + 金色光晕）
    this.renderAwakeningCG(ctx, screenW, screenH);

    // v2 升级：口诀飘字（B3，引擎推送的 mantraTexts）
    this.renderMantraTexts(ctx, screenW, screenH);

    // 分支增援选择 overlay（仅在 branch 阶段显示）
    if (this.hud && this.hud.phase === "branch" && this.hud.branchOptions) {
      this.renderBranchChoice(ctx, screenW, screenH);
    }

    // v2 升级：Roguelike Buff 选择 overlay
    if (this.hud && this.hud.phase === "roguelike" && this.hud.roguelikeOptions) {
      this.renderRoguelikeChoice(ctx, screenW, screenH);
    }

    // v2 升级：暂停 overlay
    if (this.hud?.paused) {
      this.renderThunderPauseOverlay(ctx, screenW, screenH);
    }

    // v2 升级：BOSS 击败慢镜头 overlay（B4，展示识别清单 + 案例 + 防护）
    this.renderBossDefeatSlowmo(ctx, screenW, screenH);

    // v6 升级：新系统渲染（赛季通行证 / 口诀连招 / 格挡按钮 / 超觉醒 / 组合弹幕 / AI 对话 / 档案）
    this.renderV6Hud(ctx, screenW, screenH);
    // v7 升级：新系统渲染（剧情对白 / RPG 选项 / 课程测验 / 数据仪表板 / 自适应AI / 证书 / v7Toast）
    this.renderV7Hud(ctx, screenW, screenH);

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  /** 分支增援选择 overlay：3 个可点击选项卡片 */
  private renderBranchChoice(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const options = hud.branchOptions!;
    // 全屏暗化遮罩
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.78)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 顶部标题
    const titleY = screenH * 0.18;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 10;
    ctx.fillText("BRANCH · 增援路线选择", screenW / 2, titleY - 22);
    ctx.shadowBlur = 0;
    ctx.font = `900 24px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FF00E5";
    ctx.shadowBlur = 18;
    ctx.fillText(`选择第 ${(hud.branchWave ?? 1)} 波增援`, screenW / 2, titleY + 8);
    ctx.shadowBlur = 0;
    // 副标
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("点击卡片选择一项增援（一次性）", screenW / 2, titleY + 32);

    // 3 个卡片纵向排列
    const cardW = Math.min(320, screenW - 48);
    const cardH = 92;
    const gap = 14;
    const totalH = cardH * 3 + gap * 2;
    const startY = (screenH - totalH) / 2 + 30;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const rect = this.getBranchOptionRect(i, screenW, screenH);
      const pressed = this.pressedBranchIdx === i;
      // 卡片背景
      ctx.fillStyle = pressed ? withAlpha(opt.color, 0.22) : "rgba(20, 36, 58, 0.92)";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      // 边框（霓虹色）
      ctx.strokeStyle = opt.color;
      ctx.lineWidth = pressed ? 2 : 1;
      ctx.shadowColor = opt.color;
      ctx.shadowBlur = pressed ? 16 : 8;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.shadowBlur = 0;
      // 四角括号
      drawNeonCorners(ctx, rect.x, rect.y, rect.w, rect.h, opt.color, 10, 2, 6);
      // emoji 大图
      ctx.font = "32px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opt.emoji, rect.x + 36, rect.y + rect.h / 2);
      // 标题
      ctx.font = `700 16px ${Theme.fonts.body}`;
      ctx.fillStyle = opt.color;
      ctx.textAlign = "left";
      ctx.fillText(opt.title, rect.x + 72, rect.y + 28);
      // 描述
      ctx.font = `400 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.fillText(opt.desc, rect.x + 72, rect.y + 52);
      // 序号
      ctx.font = `900 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(opt.color, 0.7);
      ctx.textAlign = "right";
      ctx.fillText(`0${i + 1}`, rect.x + rect.w - 12, rect.y + 14);
    }
    ctx.restore();
  }

  /** 分支选项矩形 */
  private getBranchOptionRect(idx: number, screenW: number, screenH: number): Rect {
    const cardW = Math.min(320, screenW - 48);
    const cardH = 92;
    const gap = 14;
    const totalH = cardH * 3 + gap * 2;
    const startY = (screenH - totalH) / 2 + 30;
    const x = (screenW - cardW) / 2;
    const y = startY + idx * (cardH + gap);
    return { x, y, w: cardW, h: cardH };
  }

  /** 阶段切换全屏 overlay */
  private renderPhaseTransition(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.hud || !this.hud.phaseTransitionUntil || this.hud.phaseTransitionUntil <= 0) return;
    const remaining = this.hud.phaseTransitionUntil;
    const TOTAL = 1.5;
    const progress = Math.max(0, Math.min(1, 1 - remaining / TOTAL)); // 0→1
    // alpha 曲线：先快速上升，再缓慢下降
    let alpha: number;
    if (progress < 0.2) alpha = progress / 0.2;
    else alpha = Math.max(0, 1 - (progress - 0.2) / 0.8);
    // scale 曲线：从 0.6 放大到 1.0
    const scale = 0.6 + progress * 0.4;

    ctx.save();
    // 全屏 magenta 色调
    ctx.fillStyle = withAlpha("#FF00E5", alpha * 0.12);
    ctx.fillRect(0, 0, screenW, screenH);
    // 上下渐变光带
    const grad = ctx.createLinearGradient(0, 0, 0, screenH);
    grad.addColorStop(0, withAlpha("#FF00E5", alpha * 0.25));
    grad.addColorStop(0.5, "transparent");
    grad.addColorStop(1, withAlpha("#00E5FF", alpha * 0.25));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);

    // 中央大字
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    // 副标
    ctx.font = `400 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 12;
    ctx.fillText("PHASE SHIFT", 0, -60);
    // 主标
    ctx.font = `900 56px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FF00E5";
    ctx.shadowBlur = 24;
    ctx.fillText(this.hud.phaseTransitionText ?? "", 0, 0);
    // 装饰线
    ctx.shadowBlur = 0;
    ctx.strokeStyle = withAlpha("#FF00E5", 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-120, 40);
    ctx.lineTo(120, 40);
    ctx.stroke();
    ctx.restore();
  }

  /** 连击数显示（顶部中央，>=2 才显示） */
  private renderCombo(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    if (hud.combo < 2) return;
    // 脉冲：刚增加时 1.3x，0.4s 内回到 1.0
    const pulse = Math.max(0, 1 - this.comboPulseT / 0.4);
    const scale = 1 + pulse * 0.3;
    const alpha = Math.min(1, hud.combo / 5 + 0.4);

    const cx = screenW / 2;
    const cy = 70;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    // "COMBO" 小标
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("COMBO", 0, -16);
    // 数字（颜色随 combo 升级）
    const comboColor = hud.combo >= 15 ? "#FF00E5" : hud.combo >= 8 ? "#FFD666" : "#00E5FF";
    ctx.font = `900 28px ${Theme.fonts.display}`;
    ctx.fillStyle = comboColor;
    ctx.shadowColor = comboColor;
    ctx.shadowBlur = 14;
    ctx.fillText(`×${hud.combo}`, 0, 6);
    ctx.restore();
  }

  /** 成就 toast（滑入式卡片） */
  private renderAchievementToast(ctx: CanvasRenderingContext2D, screenW: number): void {
    if (!this.achData) return;
    // 滑入：0 → 0.3s 滑入；停留；淡出：0 → 0.3s
    let offsetX: number;
    let alpha: number;
    if (this.achFadingOut) {
      const p = Math.min(1, this.achT / 0.3);
      offsetX = p * 80;
      alpha = 1 - p;
    } else if (this.achT < 0.3) {
      const p = this.achT / 0.3;
      offsetX = (1 - p) * 80;
      alpha = p;
    } else {
      offsetX = 0;
      alpha = 1;
    }
    const cardW = 260;
    const cardH = 64;
    const x = (screenW - cardW) / 2 + offsetX;
    const y = 130;

    ctx.save();
    ctx.globalAlpha = alpha;
    // 背景
    ctx.fillStyle = "rgba(15, 34, 54, 0.92)";
    ctx.fillRect(x, y, cardW, cardH);
    // 左侧金色条
    ctx.fillStyle = "#FFD666";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, 4, cardH);
    ctx.shadowBlur = 0;
    // 四角霓虹括号
    drawNeonCorners(ctx, x, y, cardW, cardH, "#FFD666", 10, 3, 8);

    // emoji
    ctx.font = "28px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.achData.emoji, x + 28, y + cardH / 2);
    // "成就达成" 标签
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "left";
    ctx.fillText("ACHIEVEMENT UNLOCKED", x + 56, y + 14);
    // 名称
    ctx.font = `700 15px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(this.achData.name, x + 56, y + 30);
    // 描述
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(this.achData.desc, x + 56, y + 48);
    ctx.restore();
  }

  /** 时间减速全屏色调 + 边缘脉冲 */
  private renderSlowMoOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(120, 144, 255, 0.08)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 边缘脉冲
    const pulse = 0.4 + Math.sin(this.t * 6) * 0.2;
    ctx.strokeStyle = withAlpha("#7890FF", pulse);
    ctx.lineWidth = 2;
    ctx.shadowColor = "#7890FF";
    ctx.shadowBlur = 16;
    ctx.strokeRect(2, 2, screenW - 4, screenH - 4);
    ctx.restore();
  }

  /** 时间减速指示徽章（左下） */
  private renderSlowMoBadge(ctx: CanvasRenderingContext2D, _screenW: number): void {
    const hud = this.hud!;
    const remaining = hud.slowMoUntil;
    const x = 16;
    const y = 124;
    const w = 122;
    const h = 22;
    const pulse = 0.5 + Math.sin(this.t * 8) * 0.3;
    ctx.save();
    ctx.fillStyle = "rgba(120, 144, 255, 0.18)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = withAlpha("#7890FF", pulse);
    ctx.lineWidth = 1;
    ctx.shadowColor = "#7890FF";
    ctx.shadowBlur = 8;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("⏱", x + 6, y + h / 2);
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`时间减速 ${remaining.toFixed(1)}s`, x + 22, y + h / 2 + 1);
    ctx.restore();
  }

  /** v4：BossRush 进度 / 影子挑战 / 天赋&套装 HUD */
  private renderV4Hud(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number): void {
    const hud = this.hud;
    if (!hud) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // BossRush 阶段进度（顶部中央）
    if (hud.bossRush) {
      const br = hud.bossRush;
      const x = screenW / 2;
      const y = 130;
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF00E5";
      ctx.shadowColor = "#FF00E5";
      ctx.shadowBlur = 8;
      ctx.fillText(`BOSS RUSH ${br.stage}/${br.totalStages} · ⏱${br.timeSec.toFixed(1)}s`, x, y);
      ctx.shadowBlur = 0;
      // 已通关阶段小圆点
      const dotW = 8;
      const gap = 4;
      const totalDotsW = br.totalStages * dotW + (br.totalStages - 1) * gap;
      let dx = x - totalDotsW / 2;
      for (let i = 0; i < br.totalStages; i++) {
        const done = i < br.stage - 1;
        const cur = i === br.stage - 1;
        ctx.fillStyle = done ? "#52C41A" : cur ? "#FFD666" : "rgba(120,120,120,0.4)";
        ctx.beginPath();
        ctx.arc(dx + dotW / 2, y + 14, dotW / 2, 0, Math.PI * 2);
        ctx.fill();
        dx += dotW + gap;
      }
    }

    // 影子挑战进度（顶部偏下）
    if (hud.ghostProgress) {
      const gp = hud.ghostProgress;
      const x = screenW / 2;
      const y = hud.bossRush ? 156 : 130;
      const color = gp.ahead ? "#52C41A" : "#FF5A60";
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = color;
      const arrow = gp.ahead ? "▲" : "▼";
      ctx.fillText(`${arrow} 影子挑战 vs ${gp.ghostCharacter}：${gp.currentScore} / ${gp.ghostScore}`, x, y);
    }

    // 天赋 + 套装（左下角，紧凑）
    const talentBuffs = hud.talentBuffs ?? [];
    const setBonus = hud.setBonus;
    if (talentBuffs.length > 0 || setBonus) {
      const x = 16;
      let y = _screenH - 150;
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.textAlign = "left";
      // 套装
      if (setBonus) {
        ctx.fillStyle = "#FFD666";
        ctx.fillText(`✨ 套装：${setBonus.name}`, x, y);
        y += 12;
      }
      // 天赋（最多显示 3 个）
      const showTalents = talentBuffs.slice(0, 3);
      for (const t of showTalents) {
        ctx.fillStyle = t.branch === "offense" ? "#FF5A60" : t.branch === "defense" ? "#3B7FEF" : "#B388FF";
        ctx.fillText(`${t.emoji} ${t.name}`, x, y);
        y += 12;
      }
      if (talentBuffs.length > 3) {
        ctx.fillStyle = "rgba(180,180,180,0.7)";
        ctx.fillText(`+${talentBuffs.length - 3}`, x, y);
      }
    }
    ctx.restore();
  }

  // v5：擦弹 / 无人机 / 克制 / BOSS阶段 / 保护目标 / 段位 / 案例剧场
  private renderV5Hud(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud;
    if (!hud) return;
    ctx.save();
    const roundRect = (x: number, y: number, w: number, h: number, r: number): void => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    // ===== 3a. 擦弹充能指示（左下角，反诈突击按钮上方）=====
    if (hud.grazeCharge !== undefined) {
      const baseY = screenH - 100; // 反诈/大招按钮顶部
      const barX = 16;
      const barW = 80;
      const barH = 6;
      const barY = baseY - 12;
      // 标签
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("擦弹", barX, barY - 7);
      // 背景
      ctx.fillStyle = Theme.colors.bg.line;
      ctx.fillRect(barX, barY, barW, barH);
      // 前景
      const charge = Math.max(0, Math.min(1, hud.grazeCharge));
      ctx.fillStyle = "#FFD666";
      ctx.fillRect(barX, barY, barW * charge, barH);
      // 激活：金色光晕脉冲 + ×1.5
      if ((hud.grazeBoostUntil ?? 0) > 0) {
        const pulse = 0.5 + Math.sin(this.t * 10) * 0.5;
        ctx.save();
        ctx.shadowColor = "#FFD666";
        ctx.shadowBlur = 12 * pulse;
        ctx.fillStyle = "#FFD666";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.restore();
        ctx.font = `900 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#FFD666";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("×1.5", barX + barW + 6, barY + barH / 2);
      }
    }

    // ===== 3b. 无人机状态指示（擦弹条上方）=====
    const drones = hud.drones ?? [];
    if (drones.length > 0) {
      const baseY = screenH - 100;
      const rowY = baseY - 32;
      const r = 8;
      let dx = 16;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < drones.length; i++) {
        const d = drones[i];
        // 圆圈背景
        ctx.beginPath();
        ctx.arc(dx + r, rowY, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(20, 36, 58, 0.92)";
        ctx.fill();
        ctx.strokeStyle = "#3B7FEF";
        ctx.lineWidth = 1;
        ctx.stroke();
        // emoji
        ctx.font = `12px sans-serif`;
        ctx.fillStyle = Theme.colors.ink.DEFAULT;
        ctx.fillText(d.emoji, dx + r, rowY + 0.5);
        dx += r * 2 + 4;
      }
      // 剩余秒数
      const remain = Math.max(0, Math.ceil(hud.droneUntil ?? 0));
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#3B7FEF";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${remain}s`, dx, rowY);
    }

    // ===== 3c. 克制关系指示（BOSS HP 条下方，顶部中央）=====
    const rel = hud.counterRelation;
    if (rel === "advantage" || rel === "disadvantage") {
      const adv = rel === "advantage";
      const color = adv ? "#52C41A" : "#FF4D4F";
      const text = adv ? "克制▲" : "被克▼";
      const bw = 56;
      const bh = 18;
      const bx = (screenW - bw) / 2;
      const by = 114; // BOSS HP 条 barY(96)+barH(12)+6
      ctx.save();
      ctx.fillStyle = withAlpha(color, 0.18);
      roundRect(bx, by, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, bx + bw / 2, by + bh / 2 + 0.5);
      ctx.restore();
    }

    // ===== 3d. BOSS 阶段指示（BOSS HP 条右侧）=====
    const phaseTotal = hud.bossPhaseTotal;
    if (phaseTotal && phaseTotal > 1) {
      const phaseNum = hud.bossPhaseNum ?? 1;
      const dotR = 4;
      const gap = 4;
      const totalW = phaseTotal * dotR * 2 + (phaseTotal - 1) * gap;
      let dpx = screenW - 16 - totalW;
      const dpy = 123; // 与克制徽章垂直居中对齐
      ctx.save();
      for (let i = 0; i < phaseTotal; i++) {
        const reached = i < phaseNum;
        ctx.beginPath();
        ctx.arc(dpx + dotR, dpy, dotR, 0, Math.PI * 2);
        if (reached) {
          ctx.fillStyle = "#FFD666";
          ctx.fill();
        } else {
          ctx.fillStyle = Theme.colors.bg.line;
          ctx.fill();
          ctx.strokeStyle = "#FFD666";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        dpx += dotR * 2 + gap;
      }
      ctx.restore();
    }

    // ===== 3e. 生存目标 HP 条（底部中央，反诈突击按钮左侧）=====
    if (hud.protectHp !== undefined && hud.protectMaxHp) {
      const ratio = Math.max(0, Math.min(1, hud.protectHp / hud.protectMaxHp));
      const color = ratio > 0.5 ? "#52C41A" : ratio > 0.25 ? "#FFD666" : "#FF4D4F";
      const barW = 100;
      const barH = 8;
      const emojiW = 16;
      const rowX = (screenW - (emojiW + 4 + barW)) / 2;
      const barY = screenH - 44;
      // 标签
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("保护目标", screenW / 2, barY - 8);
      // emoji
      ctx.font = `12px sans-serif`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.fillText(hud.protectEmoji ?? "🛡️", rowX + emojiW / 2, barY + barH / 2);
      // 背景条
      ctx.fillStyle = Theme.colors.bg.line;
      ctx.fillRect(rowX + emojiW + 4, barY, barW, barH);
      // 前景条
      ctx.fillStyle = color;
      ctx.fillRect(rowX + emojiW + 4, barY, barW * ratio, barH);
    }

    // ===== 3f. 段位显示（积分/称号下方）=====
    if (hud.rankName) {
      const rx = 16;
      const ry = 126; // renderStats 的 nextTitleGap(y+60=112) 下方
      const text = `${hud.rankEmoji ?? ""} ${hud.rankName}`;
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      const tw = ctx.measureText(text).width;
      const pw = tw + 12;
      const ph = 16;
      ctx.save();
      ctx.fillStyle = withAlpha("#B388FF", 0.18);
      roundRect(rx, ry, pw, ph, 8);
      ctx.fill();
      ctx.strokeStyle = "#B388FF";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#B388FF";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, rx + 6, ry + ph / 2 + 0.5);
      ctx.restore();
      // 段位积分变化
      if (hud.rankDelta !== undefined && hud.rankDelta !== 0) {
        const delta = hud.rankDelta;
        const dColor = delta > 0 ? "#52C41A" : "#FF4D4F";
        const dText = delta > 0 ? `+${delta}` : `${delta}`;
        ctx.font = `700 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = dColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(dText, rx + pw + 6, ry + ph / 2 + 0.5);
      }
    }

    // ===== 3g. 案例剧场触发提示（屏幕中央卡片）=====
    if (hud.caseTheaterTrigger) {
      const ct = hud.caseTheaterTrigger;
      const cardW = 300;
      const cardH = 120;
      const cardX = (screenW - cardW) / 2;
      const cardY = (screenH - cardH) / 2;
      const pulse = 0.5 + Math.sin(this.t * 4) * 0.5;
      ctx.save();
      // 卡片背景
      ctx.fillStyle = "rgba(7,14,31,0.92)";
      roundRect(cardX, cardY, cardW, cardH, 10);
      ctx.fill();
      ctx.strokeStyle = withAlpha("#FFD666", 0.6 + pulse * 0.4);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 标题
      ctx.font = `900 13px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 8;
      ctx.fillText(`案例剧场 · ${ct.bossName} ${ct.emoji}`, cardX + cardW / 2, cardY + 20);
      ctx.shadowBlur = 0;
      // 案情（按宽度截断到 2 行）
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const maxW = cardW - 24;
      const story = ct.caseStory ?? "";
      const lines: string[] = [];
      let cur = "";
      for (const chr of story) {
        if (ctx.measureText(cur + chr).width > maxW) {
          lines.push(cur);
          cur = chr;
          if (lines.length >= 2) break;
        } else {
          cur += chr;
        }
      }
      if (lines.length < 2 && cur) lines.push(cur);
      if (lines.length > 0 && lines.join("").length < story.length) {
        lines[lines.length - 1] += "…";
      }
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], cardX + cardW / 2, cardY + 48 + i * 14);
      }
      // 底部提示
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha("#00E5FF", 0.6 + pulse * 0.4);
      ctx.fillText("点击查看详情", cardX + cardW / 2, cardY + cardH - 14);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderBossBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const barY = 96;
    const barW = screenW - 32;
    const barH = 12;
    const ratio = (hud.bossHp ?? 0) / (hud.bossMax ?? 1);
    const phaseColor = (hud.bossPhase ?? 1) === 1 ? Theme.colors.warn.DEFAULT : (hud.bossPhase ?? 1) === 2 ? "#FF7A1A" : "#FF00E5";
    const enraged = hud.bossEnraged ?? false;
    ctx.save();
    if (enraged) {
      // BOSS 狂暴警示
      const pulse = 0.5 + Math.sin(this.t * 10) * 0.5;
      ctx.font = `900 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF00E5";
      ctx.shadowColor = "#FF00E5";
      ctx.shadowBlur = 10 * pulse;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`⚠ BOSS 狂暴 · ${hud.bossName ?? BOSS.name}`, 16, barY - 30);
      ctx.shadowBlur = 0;
      // 警示条纹
      ctx.fillStyle = withAlpha("#FF00E5", pulse * 0.3);
      ctx.fillRect(0, barY - 18, screenW, 2);
    } else {
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = phaseColor;
      ctx.shadowColor = phaseColor;
      ctx.shadowBlur = 6;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`BOSS · ${hud.bossName ?? BOSS.name} · 阶段 ${hud.bossPhase ?? 1}/3`, 16, barY - 16);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    drawProgressBar(ctx, 16, barY, barW, barH, ratio, enraged ? "#FF00E5" : phaseColor);
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(hud.bossFraudType ?? BOSS.fraudType, screenW - 16, barY - 14);
    ctx.restore();
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 52;
    ctx.save();

    // 左上：称号 + 积分
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("TITLE", 16, y - 6);
    ctx.font = `900 15px ${Theme.fonts.body}`;
    ctx.fillStyle = hud.titleColor;
    ctx.shadowColor = withAlpha(hud.titleColor, 0.5);
    ctx.shadowBlur = 8;
    ctx.fillText(hud.titleName, 16, y + 6);
    ctx.shadowBlur = 0;

    // 积分 + 倍率 pill
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.getAccent();
    const scoreText = `${hud.score.toLocaleString()} 分`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(scoreText, 16, y + 26);
    // 倍率 pill（>1.0 时显示）
    if (hud.scoreMultiplier > 1.0) {
      const scoreW = ctx.measureText(scoreText).width;
      const pillX = 16 + scoreW + 8;
      const pillY = y + 24;
      const pillW = 42;
      const pillH = 16;
      const multColor = hud.scoreMultiplier >= 2 ? "#FF00E5" : "#FFD666";
      ctx.fillStyle = withAlpha(multColor, 0.18);
      ctx.fillRect(pillX, pillY, pillW, pillH);
      ctx.strokeStyle = multColor;
      ctx.lineWidth = 1;
      ctx.shadowColor = multColor;
      ctx.shadowBlur = 6;
      ctx.strokeRect(pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1);
      ctx.shadowBlur = 0;
      ctx.font = `900 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = multColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`×${hud.scoreMultiplier.toFixed(2)}`, pillX + pillW / 2, pillY + pillH / 2 + 0.5);
    }

    // 武器 XP 条（在积分下方）
    if (hud.weapon < 4 && hud.weaponXpMax > 0) {
      const xpY = y + 44;
      const xpW = 140;
      const xpH = 4;
      const xpRatio = Math.max(0, Math.min(1, hud.weaponXp / hud.weaponXpMax));
      // 背景
      ctx.fillStyle = Theme.colors.bg.line;
      ctx.fillRect(16, xpY, xpW, xpH);
      // 进度
      ctx.fillStyle = this.getAccent();
      ctx.shadowColor = this.getAccent();
      ctx.shadowBlur = 6;
      ctx.fillRect(16, xpY, xpW * xpRatio, xpH);
      ctx.shadowBlur = 0;
      // 标签
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`WEAPON LV${hud.weapon} · ${hud.weaponXp}/${hud.weaponXpMax}`, 16, xpY + 6);
    } else if (hud.weapon >= 4) {
      // 满级显示
      ctx.font = `900 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 8;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("★ WEAPON MAX LV4", 16, y + 44);
      ctx.shadowBlur = 0;
    }

    // 下一称号缺口
    if (hud.nextTitleGap > 0) {
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`距下一称号 ${hud.nextTitleGap} 分`, 16, y + 60);
    } else {
      ctx.font = `900 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("已达最高称号", 16, y + 60);
    }

    // 右上：铜元宝生命值（36）
    const totalPips = MAX_HP / HP_PER_YUANBAO; // 9
    const alivePips = Math.ceil(hud.hp / HP_PER_YUANBAO);
    const pipW = 14;
    const pipGap = 3;
    const rowW = totalPips * pipW + (totalPips - 1) * pipGap;
    const rowX = screenW - 16 - rowW;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("LIVES · 铜元宝", screenW - 16, y - 6);
    for (let i = 0; i < totalPips; i++) {
      const px = rowX + i * (pipW + pipGap);
      const alive = i < alivePips;
      this.drawYuanbao(ctx, px + pipW / 2, y + 14, pipW, alive);
    }
    // 数字
    ctx.font = `700 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = hud.hp <= HP_PER_YUANBAO ? Theme.colors.warn.DEFAULT : "#FFD666";
    ctx.shadowColor = withAlpha(ctx.fillStyle as string, 0.4);
    ctx.shadowBlur = 6;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${hud.hp}/${hud.maxHp}`, screenW - 16, y + 30);
    ctx.shadowBlur = 0;
    // 国家反诈APP 护盾提示
    if (hud.appCharges > 0) {
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(`🛡 反诈APP ×${hud.appCharges}`, screenW - 16, y + 48);
    }
    ctx.restore();
  }

  /** 绘制铜元宝（船型元宝），alive=亮铜色，否则暗 */
  private drawYuanbao(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, alive: boolean): void {
    const hw = w / 2;
    const h = w * 0.62;
    ctx.save();
    ctx.translate(cx, cy);
    if (alive) {
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 5;
    }
    // 元宝主体（船型）
    ctx.beginPath();
    ctx.moveTo(-hw, h * 0.15);
    ctx.quadraticCurveTo(-hw, -h * 0.5, -hw * 0.45, -h * 0.35);
    ctx.quadraticCurveTo(0, -h * 0.15, hw * 0.45, -h * 0.35);
    ctx.quadraticCurveTo(hw, -h * 0.5, hw, h * 0.15);
    ctx.quadraticCurveTo(hw * 0.5, h * 0.45, 0, h * 0.32);
    ctx.quadraticCurveTo(-hw * 0.5, h * 0.45, -hw, h * 0.15);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.45);
    if (alive) {
      grad.addColorStop(0, "#FFE9A0");
      grad.addColorStop(0.5, "#E8A93A");
      grad.addColorStop(1, "#9C5B12");
    } else {
      grad.addColorStop(0, "#4A4030");
      grad.addColorStop(0.5, "#33291A");
      grad.addColorStop(1, "#1F1810");
    }
    ctx.fillStyle = grad;
    ctx.fill();
    // 顶部小圆凸起（元宝口）
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.05, hw * 0.32, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = alive ? "rgba(255,233,160,0.85)" : "rgba(80,70,55,0.6)";
    ctx.fill();
    if (alive) {
      ctx.strokeStyle = "#FFD666";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    // v2 升级：难度选择阶段
    if (this.showDifficultySelect) {
      return this.handleDifficultyTouch(type, x, y, screenW, screenH);
    }

    // v2 升级：暂停 overlay 优先处理
    if (this.hud?.paused) {
      return this.handlePauseTouch(type, x, y, screenW, screenH);
    }

    // v7 升级：v7 模式交互优先处理（剧情对白/RPG选项/课程测验/数据仪表板）
    if (this.hud && (this.hud.story || this.hud.rpg || this.hud.lesson || this.hud.mode === "analytics")) {
      return this.handleV7Touch(type, x, y, screenW, screenH);
    }

    // v2 升级：Roguelike 选择阶段
    if (this.hud && this.hud.phase === "roguelike" && this.hud.roguelikeOptions) {
      if (type === "start") {
        for (let i = 0; i < this.hud.roguelikeOptions.length; i++) {
          if (hitTest(x, y, this.getRoguelikeOptionRect(i, screenW, screenH))) {
            this.pressedRoguelikeIdx = i;
            return true;
          }
        }
        return true;
      } else if (type === "end") {
        if (this.pressedRoguelikeIdx !== null) {
          const idx = this.pressedRoguelikeIdx;
          const rect = this.getRoguelikeOptionRect(idx, screenW, screenH);
          if (hitTest(x, y, rect) && this.hud.roguelikeOptions[idx]) {
            const kind = this.hud.roguelikeOptions[idx].kind as RoguelikeBuffKind;
            this.engine?.chooseRoguelike(kind);
            playSfx("click");
            vibrateShort();
          }
          this.pressedRoguelikeIdx = null;
        }
        return true;
      }
      return true;
    }

    // v6 升级：诈骗溯源档案卡片显示时，点击任意位置关闭（消费所有 touch）
    if (this.localFraudArchive) {
      if (type === "start") {
        this.pressedArchiveClose = true;
      } else if (type === "end" && this.pressedArchiveClose) {
        this.localFraudArchive = null;
        this.pressedArchiveClose = false;
        playSfx("click");
        vibrateShort();
      }
      return true;
    }

    // v6 升级：BOSS AI 对话激活时，优先处理选项点击（消费所有 touch）
    const aiDialog = this.hud?.bossAIDialog;
    if (aiDialog && !aiDialog.ended && this.aiDialogFeedbackT <= 0) {
      if (type === "start") {
        // 计算选项矩形（与 renderAIDialogOverlay 保持一致）
        const boxW = screenW - 16;
        const boxX = 8;
        const boxH = 320;
        const boxY = screenH - boxH - 8;
        const lineY = boxY + 48;
        // 估算红旗条位置（bossLine 最多 4 行）
        const bossLineText = (aiDialog.currentTactic ? `【${aiDialog.currentTactic}】` : "") + aiDialog.currentBossLine;
        const lineCount = Math.max(1, Math.min(4, Math.ceil(bossLineText.length / 22)));
        const rfBarY = lineY + lineCount * 16 + 8;
        const choicesY = rfBarY + 24;
        const choiceH = 40;
        const choiceGap = 6;
        const choiceW = boxW - 16;
        for (let i = 0; i < aiDialog.currentChoices.length; i++) {
          const cy = choicesY + i * (choiceH + choiceGap);
          if (hitTest(x, y, { x: boxX + 8, y: cy, w: choiceW, h: choiceH })) {
            this.pressedAIDialogChoiceIdx = i;
            return true;
          }
        }
        return true;
      } else if (type === "end") {
        if (this.pressedAIDialogChoiceIdx !== null) {
          const idx = this.pressedAIDialogChoiceIdx;
          // 重新计算矩形进行命中检测
          const boxW2 = screenW - 16;
          const boxX2 = 8;
          const boxH2 = 320;
          const boxY2 = screenH - boxH2 - 8;
          const lineY2 = boxY2 + 48;
          const bossLineText2 = (aiDialog.currentTactic ? `【${aiDialog.currentTactic}】` : "") + aiDialog.currentBossLine;
          const lineCount2 = Math.max(1, Math.min(4, Math.ceil(bossLineText2.length / 22)));
          const rfBarY2 = lineY2 + lineCount2 * 16 + 8;
          const choicesY2 = rfBarY2 + 24;
          const choiceH2 = 40;
          const choiceGap2 = 6;
          const choiceW2 = boxW2 - 16;
          const cy2 = choicesY2 + idx * (choiceH2 + choiceGap2);
          if (hitTest(x, y, { x: boxX2 + 8, y: cy2, w: choiceW2, h: choiceH2 })) {
            this.engine?.answerBossAIDialog(idx);
            playSfx("click");
            vibrateShort();
          }
          this.pressedAIDialogChoiceIdx = null;
        }
        return true;
      }
      return true;
    }

    // 分支选择阶段：优先处理 3 个选项卡片点击，屏蔽其他游戏交互
    if (this.hud && this.hud.phase === "branch" && this.hud.branchOptions) {
      if (type === "start") {
        for (let i = 0; i < this.hud.branchOptions.length; i++) {
          if (hitTest(x, y, this.getBranchOptionRect(i, screenW, screenH))) {
            this.pressedBranchIdx = i;
            return true;
          }
        }
        return true; // 分支阶段消费所有 touch，避免误触发飞船拖拽
      } else if (type === "end") {
        if (this.pressedBranchIdx !== null) {
          const idx = this.pressedBranchIdx;
          const rect = this.getBranchOptionRect(idx, screenW, screenH);
          if (hitTest(x, y, rect)) {
            const opt = this.hud.branchOptions[idx];
            this.engine?.chooseBranch(opt.id);
            playSfx("click");
            vibrateShort();
          }
          this.pressedBranchIdx = null;
        }
        return true;
      }
      return true;
    }

    const bombBtn = this.getBombButtonRect(screenW, screenH);
    const ultBtn = this.getUltimateButtonRect(screenW, screenH);
    const pauseBtn = this.getThunderPauseButtonRect(screenW);
    // v6 升级：格挡按钮 & 超觉醒大招按钮
    const parryBtn = this.getParryButtonRect(screenW, screenH);
    const superUltBtn = this.getSuperUltButtonRect(screenW, screenH);
    const hasParry = !!this.hud?.parry;
    const hasSuperUlt = !!this.hud?.superAwakening;

    if (type === "start") {
      if (hitTest(x, y, bombBtn)) {
        this.pressedBomb = true;
        return true;
      }
      if (hitTest(x, y, ultBtn)) {
        this.pressedUltimate = true;
        return true;
      }
      if (hasParry && hitTest(x, y, parryBtn)) {
        this.pressedParry = true;
        // v6：格挡按下立即触发（按下即触发，不是释放时）
        this.engine?.triggerParry();
        playSfx("click");
        vibrateShort();
        return true;
      }
      if (hasSuperUlt && hitTest(x, y, superUltBtn)) {
        this.pressedSuperUlt = true;
        return true;
      }
      if (hitTest(x, y, pauseBtn)) {
        this.pressedPause = true;
        return true;
      }
      return false; // 未命中按钮，交给引擎 InputManager 处理拖拽
    } else if (type === "end") {
      if (this.pressedBomb && hitTest(x, y, bombBtn)) {
        this.engine?.useBomb();
        playSfx("click");
        vibrateShort();
      }
      if (this.pressedUltimate && hitTest(x, y, ultBtn)) {
        this.engine?.triggerUltimate();
        playSfx("click");
        vibrateShort();
      }
      if (this.pressedSuperUlt && hasSuperUlt && hitTest(x, y, superUltBtn)) {
        this.engine?.triggerSuperAwakeningUlt();
        playSfx("click");
        vibrateShort();
      }
      if (this.pressedPause && hitTest(x, y, pauseBtn)) {
        this.engine?.pause();
        playSfx("click");
        vibrateShort();
      }
      this.pressedBomb = false;
      this.pressedUltimate = false;
      this.pressedParry = false;
      this.pressedSuperUlt = false;
      this.pressedPause = false;
      return true;
    }
    return false;
  }

  // ===== v2 升级：难度选择 overlay =====
  private getDifficultyCardRect(idx: number, screenW: number, screenH: number): Rect {
    const cardW = Math.min(280, screenW - 48);
    const cardH = 78;
    const gap = 12;
    const totalH = cardH * 3 + gap * 2;
    const startY = (screenH - totalH) / 2 + 40;
    const x = (screenW - cardW) / 2;
    const y = startY + idx * (cardH + gap);
    return { x, y, w: cardW, h: cardH };
  }

  private getModeButtonRect(idx: number, screenW: number): Rect {
    // v7：支持 12 个模式按钮，每行 4 个，多行排列
    const perRow = 4;
    const btnW = 72;
    const gap = 6;
    const rowGap = 6;
    const totalW = btnW * perRow + gap * (perRow - 1);
    const startX = (screenW - totalW) / 2;
    const row = Math.floor(idx / perRow);
    const col = idx % perRow;
    return { x: startX + col * (btnW + gap), y: 140 + row * (32 + rowGap), w: btnW, h: 32 };
  }

  private getStartButtonRect(screenW: number, screenH: number): Rect {
    const w = Math.min(240, screenW - 48);
    const h = 48;
    return { x: (screenW - w) / 2, y: screenH - 80, w, h };
  }

  /** v7：处理 v7 模式触摸交互（剧情对白/RPG选项/课程测验/数据仪表板） */
  private handleV7Touch(type: "start" | "move" | "end", x: number, y: number, screenW: number, screenH: number): boolean {
    const hud = this.hud;
    if (!hud) return false;

    // 数据仪表板模式：点击任意位置返回模式选择
    if (hud.mode === "analytics") {
      if (type === "end") {
        // 销毁引擎，回到难度/模式选择界面
        if (this.engine) { this.engine.destroy(); this.engine = null; }
        this.showDifficultySelect = true;
        playSfx("click");
      }
      return true; // 消费所有 touch
    }

    // 剧情模式：narrative 关卡点击底部对话框推进对白
    if (hud.story && hud.story.narrativeActive) {
      const boxH = 120;
      const boxY = screenH - boxH - 12;
      const boxRect = { x: 12, y: boxY, w: screenW - 24, h: boxH };
      if (type === "end" && hitTest(x, y, boxRect)) {
        this.engine?.advanceStoryNarrative();
        playSfx("click");
      }
      return true; // narrative 阶段消费所有 touch，避免误触发飞船拖拽
    }

    // RPG 模式：点击选项
    if (hud.rpg && !hud.rpg.ended && hud.rpg.currentChoices.length > 0) {
      const rpg = hud.rpg;
      const boxH = Math.min(280, 80 + rpg.currentChoices.length * 44);
      const boxY = screenH - boxH - 12;
      const choicesY = boxY + 76;
      const choiceH = 38;
      const choiceGap = 4;
      const choiceW = screenW - 24 - 24;
      if (type === "end") {
        for (let i = 0; i < rpg.currentChoices.length; i++) {
          const cy = choicesY + i * (choiceH + choiceGap);
          if (hitTest(x, y, { x: 24, y: cy, w: choiceW, h: choiceH })) {
            this.engine?.chooseRPGChoice(i);
            playSfx("click");
            vibrateShort();
            break;
          }
        }
      }
      return true; // RPG 阶段消费所有 touch
    }

    // 课程模式：内容阅读点击推进 / 测验点击选项
    if (hud.lesson) {
      const lesson = hud.lesson;
      if (lesson.inQuiz && lesson.currentQuiz) {
        // 测验模式：点击选项答题
        const baseH = 120;
        const boxH = baseH + lesson.currentQuiz.options.length * 36;
        const boxY = screenH - boxH - 12;
        const optY = boxY + 62;
        const optH = 32;
        const optGap = 4;
        const optW = screenW - 24 - 24;
        if (type === "end") {
          for (let i = 0; i < lesson.currentQuiz.options.length; i++) {
            const oy = optY + i * (optH + optGap);
            if (hitTest(x, y, { x: 24, y: oy, w: optW, h: optH })) {
              this.engine?.answerLessonQuiz(i);
              playSfx("click");
              break;
            }
          }
        }
        return true;
      } else {
        // 阅读模式：点击内容区域推进到下一小节
        const boxH = 100;
        const boxY = screenH - boxH - 12;
        const boxRect = { x: 12, y: boxY, w: screenW - 24, h: boxH };
        if (type === "end" && hitTest(x, y, boxRect)) {
          this.engine?.advanceLessonSection();
          playSfx("click");
        }
        return true;
      }
    }

    return false;
  }

  private handleDifficultyTouch(type: "start" | "move" | "end", x: number, y: number, screenW: number, screenH: number): boolean {
    // v7 升级：资料视图 overlay 优先处理（覆盖全屏，消费所有 touch）
    if (this.v7View) {
      return this.handleV7ViewTouch(type, x, y, screenW, screenH);
    }
    if (type === "start") {
      // v3 升级：Tab 切换（优先处理）
      const tabIds: typeof this.selectTab[] = ["difficulty", "character", "equipment", "talent"];
      for (let i = 0; i < tabIds.length; i++) {
        if (hitTest(x, y, this.getSelectTabRect(i, screenW))) {
          this.pressedTabIdx = i;
          return true;
        }
      }
      // 各 Tab 内容
      if (this.selectTab === "difficulty") {
        // v7 升级：资料入口按钮（知识图谱 / 证书陈列）
        for (let i = 0; i < 2; i++) {
          if (hitTest(x, y, this.getV7ViewButtonRect(i, screenW))) {
            this.v7View = i === 0 ? "knowledge" : "certificate";
            this.v7ViewScroll = 0;
            this.v7ViewDragStartY = null;
            playSfx("click");
            vibrateShort();
            return true;
          }
        }
        // v7 升级：剧情/课程/RPG 子选择项
        if (this.selectedMode === "story" || this.selectedMode === "lesson" || this.selectedMode === "rpg") {
          const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
          const items = this.collectV7SubItems(this.selectedMode, save);
          const startY = 312;
          const itemH = 38;
          const gap = 4;
          for (let i = 0; i < items.length; i++) {
            if (hitTest(x, y, this.getV7SubItemRect(i, screenW, startY, itemH, gap))) {
              if (!items[i].locked) {
                this.pressedV7SubIdx = i;
              }
              return true;
            }
          }
        }
        // 难度卡片（仅非 v7 可玩模式时显示，但触摸仍保留兼容）
        for (let i = 0; i < DIFFICULTY_LIST.length; i++) {
          if (hitTest(x, y, this.getDifficultyCardRect(i, screenW, screenH))) {
            this.pressedDifficultyIdx = i;
            this.selectedDifficulty = DIFFICULTY_LIST[i].id;
            playSfx("click");
            return true;
          }
        }
        // 模式按钮（v7：12 模式，含剧情/课程/RPG/数据）
        const modes: ThunderMode[] = ["campaign", "endless", "daily", "bossRush", "weekly", "survival", "challenge", "ranked", "story", "lesson", "rpg", "analytics"];
        for (let i = 0; i < modes.length; i++) {
          if (hitTest(x, y, this.getModeButtonRect(i, screenW))) {
            this.selectedMode = modes[i];
            // 切换模式时重置 v7 子选择（避免跨模式串选）
            this.pressedV7SubIdx = null;
            playSfx("click");
            return true;
          }
        }
      } else if (this.selectTab === "character") {
        // 角色卡片
        const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
        for (let i = 0; i < CHARACTERS.length; i++) {
          if (hitTest(x, y, this.getCharacterCardRect(i, screenW, screenH))) {
            const c = CHARACTERS[i];
            if (isCharacterUnlocked(c.id, save)) {
              this.pressedCharacterIdx = i;
              this.selectedCharacter = c.id;
              playSfx("click");
            } else {
              playSfx("bad");
            }
            return true;
          }
        }
      } else if (this.selectTab === "equipment") {
        // 装备选择卡片
        const slots: EquipSlot[] = ["weaponChip", "shieldCore", "moveModule"];
        for (let s = 0; s < slots.length; s++) {
          const list = EQUIPMENTS_BY_SLOT[slots[s]];
          for (let i = 0; i < list.length; i++) {
            if (hitTest(x, y, this.getEquipChoiceRect(s, i, screenW))) {
              const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
              const owned = save.ownedEquipments.includes(list[i].id);
              if (owned) {
                this.pressedEquipSlotIdx = s;
                this.pressedEquipChoiceIdx = i;
                // 切换装备：再次点击同件则卸下
                if (this.equippedEquipments[slots[s]] === list[i].id) {
                  delete this.equippedEquipments[slots[s]];
                } else {
                  this.equippedEquipments[slots[s]] = list[i].id;
                }
                playSfx("click");
              } else {
                playSfx("bad");
              }
              return true;
            }
          }
        }
      } else if (this.selectTab === "talent") {
        // v4：天赋节点点击 → 尝试解锁
        const branches: ThunderTalentBranch[] = ["offense", "defense", "support"];
        const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
        for (let b = 0; b < branches.length; b++) {
          for (let tier = 1; tier <= 5; tier++) {
            if (hitTest(x, y, this.getTalentNodeRect(b, tier, screenW, screenH))) {
              if (canUnlockTalent(this.selectedCharacter, branches[b], tier, save)) {
                unlockTalent(this.selectedCharacter, branches[b], tier, save);
                persistThunderSave(save);
                this.saveSnapshot = save;
                playSfx("good");
                vibrateShort();
              } else {
                playSfx("bad");
              }
              return true;
            }
          }
        }
      } else if (this.selectTab === "meta") {
        // v5：皮肤选择点击
        const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
        const skinW = Math.min(100, (screenW - 48 - 24) / 4);
        const skinH = 60;
        const skinGap = 8;
        const skinStartY = 128 + 22;
        for (let i = 0; i < THUNDER_SKINS.length; i++) {
          const skin = THUNDER_SKINS[i];
          const col = i % 4;
          const row = Math.floor(i / 4);
          const sx = 24 + col * (skinW + skinGap);
          const sy = skinStartY + row * (skinH + skinGap);
          if (hitTest(x, y, { x: sx, y: sy, w: skinW, h: skinH })) {
            const unlocked = skin.default || save.unlockedSkins.includes(skin.id);
            if (unlocked) {
              save.equippedSkin = skin.id;
              persistThunderSave(save);
              this.saveSnapshot = save;
              playSfx("good");
              vibrateShort();
            } else {
              playSfx("bad");
            }
            return true;
          }
        }
      }
      // 开始按钮
      if (hitTest(x, y, this.getStartButtonRect(screenW, screenH))) {
        return true;
      }
      return true;
    } else if (type === "end") {
      // v3 升级：Tab 切换确认
      if (this.pressedTabIdx !== null) {
        const tabIds: typeof this.selectTab[] = ["difficulty", "character", "equipment", "talent", "meta"];
        if (hitTest(x, y, this.getSelectTabRect(this.pressedTabIdx, screenW))) {
          this.selectTab = tabIds[this.pressedTabIdx];
          playSfx("click");
          vibrateShort();
        }
        this.pressedTabIdx = null;
        return true;
      }
      // v7 升级：剧情/课程/RPG 子选择项释放 → 确认选择
      if (this.pressedV7SubIdx !== null) {
        const idx = this.pressedV7SubIdx;
        this.pressedV7SubIdx = null;
        const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
        const items = this.collectV7SubItems(this.selectedMode, save);
        const startY = 312;
        const itemH = 38;
        const gap = 4;
        if (hitTest(x, y, this.getV7SubItemRect(idx, screenW, startY, itemH, gap)) && items[idx] && !items[idx].locked) {
          const id = items[idx].id;
          if (this.selectedMode === "story") this.selectedStoryStageId = id;
          else if (this.selectedMode === "lesson") this.selectedLessonChapterId = id;
          else if (this.selectedMode === "rpg") this.selectedRPGScenarioId = id;
          playSfx("good");
          vibrateShort();
        }
        return true;
      }
      // 开始按钮
      if (hitTest(x, y, this.getStartButtonRect(screenW, screenH))) {
        this.showDifficultySelect = false;
        this.spawnEngine();
        playSfx("good");
        vibrateShort();
      }
      this.pressedDifficultyIdx = null;
      this.pressedCharacterIdx = null;
      this.pressedEquipSlotIdx = null;
      this.pressedEquipChoiceIdx = null;
      return true;
    }
    return true;
  }

  /** v7 资料视图 overlay 触摸：关闭按钮 + 内容拖拽滚动 */
  private handleV7ViewTouch(type: "start" | "move" | "end", x: number, y: number, screenW: number, screenH: number): boolean {
    const close = this.getV7ViewCloseRect(screenW);
    const contentTop = 70;
    const contentBottom = screenH - 56;
    if (type === "start") {
      if (hitTest(x, y, close)) {
        // 标记关闭（end 时确认）
        this.v7ViewDragStartY = null;
        return true;
      }
      // 内容区拖拽滚动
      if (y >= contentTop && y <= contentBottom) {
        this.v7ViewDragStartY = y;
        this.v7ViewDragStartScroll = this.v7ViewScroll;
      }
      return true;
    } else if (type === "move") {
      if (this.v7ViewDragStartY !== null) {
        this.v7ViewScroll = this.v7ViewDragStartScroll - (y - this.v7ViewDragStartY);
      }
      return true;
    } else {
      // end
      if (hitTest(x, y, close)) {
        this.v7View = null;
        this.v7ViewScroll = 0;
        this.v7ViewDragStartY = null;
        playSfx("click");
        vibrateShort();
      }
      this.v7ViewDragStartY = null;
      return true;
    }
  }

  private handlePauseTouch(type: "start" | "move" | "end", x: number, y: number, screenW: number, screenH: number): boolean {
    const resumeBtn = { x: screenW / 2 - 100, y: screenH / 2, w: 90, h: 40 } as Rect;
    const restartBtn = { x: screenW / 2 + 10, y: screenH / 2, w: 90, h: 40 } as Rect;
    const backBtn = { x: screenW / 2 - 70, y: screenH / 2 + 56, w: 140, h: 40 } as Rect;
    if (type === "end") {
      if (hitTest(x, y, resumeBtn)) {
        this.engine?.resume();
        playSfx("click");
        vibrateShort();
      } else if (hitTest(x, y, restartBtn)) {
        this.retry();
        playSfx("click");
        vibrateShort();
      } else if (hitTest(x, y, backBtn)) {
        this.director.replace(new HubScene(this.director));
        playSfx("click");
        vibrateShort();
      }
      return true;
    }
    return true;
  }

  /** v2 升级：Roguelike 选项矩形 */
  private getRoguelikeOptionRect(idx: number, screenW: number, screenH: number): Rect {
    const cardW = Math.min(320, screenW - 48);
    const cardH = 110;
    const gap = 14;
    const totalH = cardH * 2 + gap;
    const startY = (screenH - totalH) / 2 + 30;
    const x = (screenW - cardW) / 2;
    const y = startY + idx * (cardH + gap);
    return { x, y, w: cardW, h: cardH };
  }

  // ===== v2/v3 升级：分页式选择 overlay 渲染 =====
  private renderDifficultySelect(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 深色背景
    ctx.fillStyle = "#070E1F";
    ctx.fillRect(0, 0, screenW, screenH);
    // 星云装饰
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#00E5FF";
    ctx.beginPath();
    ctx.arc(screenW * 0.2, screenH * 0.15, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FF00E5";
    ctx.beginPath();
    ctx.arc(screenW * 0.8, screenH * 0.8, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 标题
    const titleMap: Record<typeof this.selectTab, string> = {
      difficulty: "选择难度与模式",
      character: "选择反诈角色",
      equipment: "装备配件装配",
      talent: "天赋树加点",
      meta: "皮肤与每日任务",
    };
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 10;
    ctx.fillText("THUNDER · 雷霆反诈", screenW / 2, 36);
    ctx.shadowBlur = 0;
    ctx.font = `900 24px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FF00E5";
    ctx.shadowBlur = 16;
    ctx.fillText(titleMap[this.selectTab], screenW / 2, 64);
    ctx.shadowBlur = 0;
    ctx.restore();

    // v3 升级：分页 Tab 栏
    this.renderSelectTabs(ctx, screenW);

    // 内容区
    if (this.selectTab === "difficulty") {
      this.renderDifficultyTab(ctx, screenW, screenH);
    } else if (this.selectTab === "character") {
      this.renderCharacterTab(ctx, screenW, screenH);
    } else if (this.selectTab === "equipment") {
      this.renderEquipmentTab(ctx, screenW, screenH);
    } else if (this.selectTab === "talent") {
      this.renderTalentTab(ctx, screenW, screenH);
    } else if (this.selectTab === "meta") {
      this.renderMetaTab(ctx, screenW, screenH);
    }

    // 开始按钮（v7：按模式切换文案）
    const startBtn = this.getStartButtonRect(screenW, screenH);
    const startLabelMap: Partial<Record<ThunderMode, string>> = {
      story: "进入剧情", lesson: "开始学习", rpg: "进入剧本", analytics: "进入仪表板",
    };
    drawButton(ctx, startBtn.x, startBtn.y, startBtn.w, startBtn.h, startLabelMap[this.selectedMode] ?? "开始作战", {
      variant: "hard",
      accent: "#FF00E5",
    });
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.fillText("操作：方向键移动 · 空格蓄力 · 双击方向键闪避", screenW / 2, screenH - 24);
    ctx.restore();

    // v7 升级：资料视图 overlay（覆盖全屏，最后绘制）
    if (this.v7View) {
      this.renderV7ViewOverlay(ctx, screenW, screenH);
    }
  }

  /** v3 升级：分页 Tab 栏渲染 */
  private renderSelectTabs(ctx: CanvasRenderingContext2D, screenW: number): void {
    const tabs: { id: typeof this.selectTab; label: string; emoji: string }[] = [
      { id: "difficulty", label: "难度", emoji: "🎯" },
      { id: "character", label: "角色", emoji: "🚔" },
      { id: "equipment", label: "装备", emoji: "⚙" },
      { id: "talent", label: "天赋", emoji: "✨" },
      { id: "meta", label: " Meta", emoji: "🎭" },
    ];
    const tabW = 64;
    const gap = 6;
    const totalW = tabW * tabs.length + gap * (tabs.length - 1);
    const startX = (screenW - totalW) / 2;
    const y = 88;
    for (let i = 0; i < tabs.length; i++) {
      const rect = { x: startX + i * (tabW + gap), y, w: tabW, h: 30 } as Rect;
      const selected = this.selectTab === tabs[i].id;
      const pressed = this.pressedTabIdx === i;
      drawButton(ctx, rect.x, rect.y, rect.w, rect.h, `${tabs[i].emoji} ${tabs[i].label}`, {
        variant: "hard",
        accent: selected ? "#00E5FF" : Theme.colors.bg.line,
        pressed: selected || pressed,
      });
    }
  }

  /** v3 升级：Tab 矩形（用于触摸命中） */
  private getSelectTabRect(idx: number, screenW: number): Rect {
    const tabW = 64;
    const gap = 6;
    const count = 5; // v5：5 个 Tab
    const totalW = tabW * count + gap * (count - 1);
    const startX = (screenW - totalW) / 2;
    return { x: startX + idx * (tabW + gap), y: 88, w: tabW, h: 30 };
  }

  /** v2 升级：难度 Tab 内容渲染 */
  private renderDifficultyTab(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 模式选择标签
    ctx.save();
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.fillText("游戏模式", screenW / 2, 128);
    ctx.restore();

    // 模式按钮（v7：12 模式，竖向滚动列表）
    const modes: ThunderMode[] = ["campaign", "endless", "daily", "bossRush", "weekly", "survival", "challenge", "ranked", "story", "lesson", "rpg", "analytics"];
    const modeLabels: Record<ThunderMode, string> = {
      campaign: "战役", endless: "无尽", daily: "每日", bossRush: "BOSS连战",
      weekly: "周常", survival: "生存", challenge: "极限", ranked: "段位赛",
      story: "剧情", lesson: "课程", rpg: "RPG", analytics: "数据",
    };
    for (let i = 0; i < modes.length; i++) {
      const rect = this.getModeButtonRect(i, screenW);
      const selected = this.selectedMode === modes[i];
      drawButton(ctx, rect.x, rect.y, rect.w, rect.h, modeLabels[modes[i]], {
        variant: "hard",
        accent: selected ? "#00E5FF" : Theme.colors.bg.line,
        pressed: selected,
      });
    }

    // v7 升级：资料入口按钮（知识图谱 / 证书陈列），独立第 4 行
    this.renderV7ViewButtons(ctx, screenW);

    // v7 升级：剧情/课程/RPG 模式 → 渲染子选择面板；数据模式 → 渲染提示；其余 → 难度卡片
    if (this.selectedMode === "story" || this.selectedMode === "lesson" || this.selectedMode === "rpg") {
      this.renderV7SubSelectPanel(ctx, screenW, screenH);
    } else if (this.selectedMode === "analytics") {
      this.renderV7AnalyticsHint(ctx, screenW, screenH);
    } else {
      // 难度卡片
      for (let i = 0; i < DIFFICULTY_LIST.length; i++) {
        const d = DIFFICULTY_LIST[i];
        const rect = this.getDifficultyCardRect(i, screenW, screenH);
        const selected = this.selectedDifficulty === d.id;
        const pressed = this.pressedDifficultyIdx === i;
        ctx.fillStyle = selected ? withAlpha(d.color, 0.18) : "rgba(20, 36, 58, 0.92)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = d.color;
        ctx.lineWidth = selected ? 2 : 1;
        ctx.shadowColor = d.color;
        ctx.shadowBlur = selected ? 16 : 6;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        ctx.shadowBlur = 0;
        drawNeonCorners(ctx, rect.x, rect.y, rect.w, rect.h, d.color, 10, 2, 6);
        ctx.save();
        ctx.font = `700 18px ${Theme.fonts.display}`;
        ctx.fillStyle = d.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(d.name, rect.x + 16, rect.y + 14);
        ctx.font = `400 11px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.DEFAULT;
        ctx.fillText(d.desc, rect.x + 16, rect.y + 40);
        ctx.font = `500 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = withAlpha(d.color, 0.8);
        ctx.fillText(`敌HP×${d.enemyHpMul}  BOSS HP×${d.bossHpMul}  积分×${d.scoreMul}`, rect.x + 16, rect.y + 58);
        ctx.restore();
        if (pressed) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.restore();
        }
      }
    }
  }

  // ===== v7 升级：子场景入口渲染 =====

  /** v7 资料入口按钮（知识图谱 / 证书陈列），位于模式按钮下方第 4 行 */
  private renderV7ViewButtons(ctx: CanvasRenderingContext2D, screenW: number): void {
    const labels = ["🧠 知识图谱", "🏅 证书陈列"];
    for (let i = 0; i < labels.length; i++) {
      const rect = this.getV7ViewButtonRect(i, screenW);
      const active = (i === 0 && this.v7View === "knowledge") || (i === 1 && this.v7View === "certificate");
      drawButton(ctx, rect.x, rect.y, rect.w, rect.h, labels[i], {
        variant: "hard",
        accent: active ? "#FFD666" : Theme.colors.bg.line,
        pressed: active,
      });
    }
  }

  /** v7 资料入口按钮矩形（2 个并排） */
  private getV7ViewButtonRect(idx: number, screenW: number): Rect {
    const btnW = 150;
    const gap = 12;
    const totalW = btnW * 2 + gap;
    const startX = (screenW - totalW) / 2;
    return { x: startX + idx * (btnW + gap), y: 254, w: btnW, h: 30 };
  }

  /** v7 数据仪表板模式提示（点击开始进入仪表板） */
  private renderV7AnalyticsHint(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = [
      "数据仪表板：能力雷达 · 弱点报告 · 行为画像",
      "点击下方「开始作战」进入数据分析视图",
    ];
    const centerY = (screenH - 80) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], screenW / 2, centerY - 12 + i * 18);
    }
    // 简要进度摘要
    const storyProg = getStoryProgress(save.storyClearedStages);
    const certCount = save.unlockedCertificates.length;
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.fillText(
      `剧情 ${storyProg.cleared}/${storyProg.total}  ·  课程 ${save.lessonClearedChapters.length}/6  ·  RPG ${save.totalRPGCleared}/6  ·  证书 ${certCount}/8`,
      screenW / 2, centerY + 28,
    );
    ctx.restore();
  }

  /** v7 子选择面板：剧情关卡 / 课程章节 / RPG 剧本 */
  private renderV7SubSelectPanel(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
    const mode = this.selectedMode;

    // 收集当前模式的可选项
    const items = this.collectV7SubItems(mode, save);
    if (items.length === 0) return;

    // 标题
    ctx.save();
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const titleMap: Record<string, string> = {
      story: "剧情战役 · 选择关卡",
      lesson: "反诈课程 · 选择章节",
      rpg: "RPG 剧本 · 选择场景",
    };
    ctx.fillText(titleMap[mode] ?? "选择", screenW / 2, 294);
    ctx.restore();

    // 列表项
    const startY = 312;
    const itemH = 38;
    const gap = 4;
    for (let i = 0; i < items.length; i++) {
      const rect = this.getV7SubItemRect(i, screenW, startY, itemH, gap);
      const it = items[i];
      const selected = it.selected;
      const pressed = this.pressedV7SubIdx === i;
      const locked = it.locked;

      // 背景
      ctx.fillStyle = selected ? withAlpha(it.color, 0.20) : "rgba(20, 36, 58, 0.92)";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = locked ? Theme.colors.bg.line : it.color;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.shadowColor = locked ? "transparent" : it.color;
      ctx.shadowBlur = selected ? 12 : 4;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.shadowBlur = 0;

      // 图标
      ctx.save();
      ctx.font = "18px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = locked ? 0.4 : 1;
      ctx.fillText(it.icon, rect.x + 10, rect.y + rect.h / 2);
      ctx.restore();

      // 名称 + 副标
      ctx.save();
      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = locked ? Theme.colors.ink.dim : (selected ? it.color : Theme.colors.ink.DEFAULT);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(it.title, rect.x + 36, rect.y + 6);
      ctx.font = `400 9px ${Theme.fonts.body}`;
      ctx.fillStyle = locked ? Theme.colors.ink.dim : Theme.colors.ink.muted;
      ctx.fillText(it.subtitle, rect.x + 36, rect.y + 22);
      ctx.restore();

      // 右侧状态标记
      ctx.save();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      if (locked) {
        ctx.font = `500 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.fillText("🔒 未解锁", rect.x + rect.w - 10, rect.y + rect.h / 2);
      } else if (it.cleared) {
        ctx.font = `700 11px ${Theme.fonts.display}`;
        ctx.fillStyle = "#52C41A";
        const mark = it.rank ? `★${it.rank}` : "✓ 通关";
        ctx.fillText(mark, rect.x + rect.w - 10, rect.y + rect.h / 2);
      } else if (selected) {
        ctx.font = `500 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#00E5FF";
        ctx.fillText("已选", rect.x + rect.w - 10, rect.y + rect.h / 2);
      }
      ctx.restore();

      if (pressed) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      }
    }
  }

  /** v7 子选择项矩形 */
  private getV7SubItemRect(idx: number, screenW: number, startY: number, itemH: number, gap: number): Rect {
    const w = Math.min(320, screenW - 48);
    const x = (screenW - w) / 2;
    return { x, y: startY + idx * (itemH + gap), w, h: itemH };
  }

  /** 收集当前 v7 模式的可选项（统一结构） */
  private collectV7SubItems(
    mode: ThunderMode,
    save: ThunderSaveData,
  ): Array<{
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    color: string;
    locked: boolean;
    cleared: boolean;
    rank?: "S" | "A" | "B" | "C";
    selected: boolean;
  }> {
    if (mode === "story") {
      const stages = THUNDER_STORY_CAMPAIGN.stages;
      return stages.map((s) => {
        const unlocked = isStageUnlocked(s.id, save.storyClearedStages);
        const cleared = save.storyClearedStages.includes(s.id);
        return {
          id: s.id,
          title: s.name,
          subtitle: s.isBranch ? `支线 · ${s.unlockCondition ?? ""}` : `第 ${s.chapter} 章 · ${s.kind === "boss" ? "BOSS 战" : s.kind === "narrative" ? "剧情对白" : "战斗"}`,
          icon: s.icon,
          color: s.themeColor,
          locked: !unlocked,
          cleared,
          selected: this.selectedStoryStageId === s.id,
        };
      });
    }
    if (mode === "lesson") {
      const chapters = getAllLessonChapters();
      return chapters.map((c) => {
        const unlocked = isChapterUnlocked(c.id, save.lessonClearedChapters);
        const cleared = save.lessonClearedChapters.includes(c.id);
        const levelLabel = c.level === "basic" ? "基础" : c.level === "intermediate" ? "进阶" : "高级";
        return {
          id: c.id,
          title: c.title,
          subtitle: `第 ${c.chapter} 章 · ${levelLabel} · ${c.sections.length} 小节`,
          icon: c.icon,
          color: c.themeColor,
          locked: !unlocked,
          cleared,
          selected: this.selectedLessonChapterId === c.id,
        };
      });
    }
    if (mode === "rpg") {
      return THUNDER_RPG_SCENARIOS.map((s) => {
        const cleared = save.rpgClearedScenarios.includes(s.id);
        return {
          id: s.id,
          title: s.title,
          subtitle: `${s.fraudType} · 难度 ${"★".repeat(s.difficulty)} · ${s.playerRole}`,
          icon: "🎭",
          color: "#B388FF",
          locked: false,
          cleared,
          selected: this.selectedRPGScenarioId === s.id,
        };
      });
    }
    return [];
  }

  /** v7 资料视图全屏 overlay（知识图谱 / 证书陈列） */
  private renderV7ViewOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.v7View) return;
    // 深色遮罩
    ctx.save();
    ctx.fillStyle = "rgba(7, 14, 31, 0.98)";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    if (this.v7View === "knowledge") {
      this.renderV7KnowledgeOverlay(ctx, screenW, screenH);
    } else {
      this.renderV7CertificateOverlay(ctx, screenW, screenH);
    }

    // 关闭按钮
    const close = this.getV7ViewCloseRect(screenW);
    drawButton(ctx, close.x, close.y, close.w, close.h, "✕ 返回", {
      variant: "hard",
      accent: "#FF00E5",
    });
  }

  /** 关闭按钮矩形 */
  private getV7ViewCloseRect(screenW: number): Rect {
    return { x: screenW - 88, y: 16, w: 72, h: 30 };
  }

  /** 知识图谱 overlay：按分类展示节点 + 掌握度 */
  private renderV7KnowledgeOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
    const mastery = save.knowledgeMastery;
    const overall = calcOverallMastery(mastery);
    const categories: { id: ThunderKnowledgeCategory; name: string; emoji: string; color: string }[] = [
      { id: "recognition", name: "识别能力", emoji: "🔍", color: "#E5353B" },
      { id: "psychology", name: "心理防御", emoji: "🧠", color: "#FA541C" },
      { id: "procedure", name: "应对流程", emoji: "📋", color: "#1890FF" },
      { id: "law", name: "法律法规", emoji: "⚖️", color: "#52C41A" },
      { id: "tool", name: "反诈工具", emoji: "🛠️", color: "#722ED1" },
    ];

    // 标题
    ctx.save();
    ctx.font = `900 20px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 12;
    ctx.fillText("🧠 反诈知识图谱", 16, 20);
    ctx.shadowBlur = 0;
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`共 ${THUNDER_KNOWLEDGE_NODES.length} 节点 · ${THUNDER_KNOWLEDGE_EDGES.length} 连线 · 总掌握度 ${Math.round(overall * 100)}%`, 16, 46);
    ctx.restore();

    // 滚动内容区域
    const clipTop = 70;
    const clipBottom = screenH - 56;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, clipTop, screenW, clipBottom - clipTop);
    ctx.clip();

    let cursorY = clipTop + 8 - this.v7ViewScroll;
    const padX = 16;
    const cardW = screenW - padX * 2;

    for (const cat of categories) {
      const nodes = getNodesByCategory(cat.id);
      if (nodes.length === 0) continue;
      // 分类标题
      ctx.save();
      ctx.font = `700 13px ${Theme.fonts.display}`;
      ctx.fillStyle = cat.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      if (cursorY > clipTop - 30 && cursorY < clipBottom) {
        ctx.fillText(`${cat.emoji} ${cat.name}`, padX, cursorY);
      }
      ctx.restore();
      cursorY += 22;

      // 节点卡片
      for (const n of nodes) {
        const nodeMastery = mastery[n.id] ?? 0;
        const unlocked = nodeMastery > 0 || (n.prerequisiteNodeIds?.length === 0 || !n.prerequisiteNodeIds);
        const h = 56;
        if (cursorY > clipTop - h && cursorY < clipBottom) {
          // 背景
          ctx.fillStyle = "rgba(20, 36, 58, 0.92)";
          ctx.fillRect(padX, cursorY, cardW, h);
          ctx.strokeStyle = unlocked ? n.color : Theme.colors.bg.line;
          ctx.lineWidth = 1;
          ctx.strokeRect(padX + 0.5, cursorY + 0.5, cardW - 1, h - 1);
          // 图标
          ctx.save();
          ctx.font = "20px sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.globalAlpha = unlocked ? 1 : 0.4;
          ctx.fillText(n.icon, padX + 10, cursorY + h / 2);
          ctx.restore();
          // 名称
          ctx.save();
          ctx.font = `700 12px ${Theme.fonts.display}`;
          ctx.fillStyle = unlocked ? n.color : Theme.colors.ink.dim;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(n.name, padX + 38, cursorY + 8);
          // 描述（截断）
          ctx.font = `400 9px ${Theme.fonts.body}`;
          ctx.fillStyle = unlocked ? Theme.colors.ink.muted : Theme.colors.ink.dim;
          const descLines = wrapText(ctx, n.desc, cardW - 50);
          ctx.fillText(descLines[0] ?? "", padX + 38, cursorY + 24);
          ctx.restore();
          // 掌握度条
          drawProgressBar(ctx, padX + 38, cursorY + h - 12, cardW - 50, 4, nodeMastery, unlocked ? n.color : Theme.colors.bg.line);
        }
        cursorY += h + 6;
      }
      cursorY += 6;
    }

    // 记录内容总高度用于滚动钳制
    this.v7KnowledgeContentH = cursorY + this.v7ViewScroll - clipTop;
    ctx.restore();

    // 钳制滚动范围
    const maxScroll = Math.max(0, this.v7KnowledgeContentH - (clipBottom - clipTop));
    this.v7ViewScroll = Math.max(0, Math.min(this.v7ViewScroll, maxScroll));
  }

  /** 知识图谱内容高度缓存（用于滚动钳制） */
  private v7KnowledgeContentH = 0;

  /** 证书陈列 overlay */
  private renderV7CertificateOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
    const progress = getAllCertificateProgress(save);
    const unlockedSet = new Set(save.unlockedCertificates);

    // 标题
    ctx.save();
    ctx.font = `900 20px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 12;
    ctx.fillText("🏅 反诈能力证书", 16, 20);
    ctx.shadowBlur = 0;
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    const issuedCount = progress.filter((p) => p.issued).length;
    ctx.fillText(`已颁发 ${issuedCount}/${THUNDER_CERTIFICATES.length} · 完整收集解锁隐藏成就`, 16, 46);
    ctx.restore();

    // 滚动内容
    const clipTop = 70;
    const clipBottom = screenH - 56;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, clipTop, screenW, clipBottom - clipTop);
    ctx.clip();

    const padX = 16;
    const cardW = screenW - padX * 2;
    const cardH = 88;
    const gap = 10;
    let cursorY = clipTop + 8 - this.v7ViewScroll;

    for (let i = 0; i < THUNDER_CERTIFICATES.length; i++) {
      const cert = THUNDER_CERTIFICATES[i];
      const prog = progress.find((p) => p.certId === cert.id);
      const issued = unlockedSet.has(cert.id);
      const h = cardH;
      if (cursorY > clipTop - h && cursorY < clipBottom) {
        // 背景
        ctx.fillStyle = issued ? withAlpha(cert.color, 0.14) : "rgba(20, 36, 58, 0.92)";
        ctx.fillRect(padX, cursorY, cardW, h);
        ctx.strokeStyle = issued ? cert.color : Theme.colors.bg.line;
        ctx.lineWidth = issued ? 2 : 1;
        ctx.shadowColor = issued ? cert.color : "transparent";
        ctx.shadowBlur = issued ? 12 : 0;
        ctx.strokeRect(padX + 0.5, cursorY + 0.5, cardW - 1, h - 1);
        ctx.shadowBlur = 0;
        if (issued) drawNeonCorners(ctx, padX, cursorY, cardW, h, cert.color, 10, 2, 6);

        // 图标（已颁发有光晕）
        ctx.save();
        ctx.font = "30px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = issued ? 1 : 0.4;
        if (issued) {
          ctx.shadowColor = cert.color;
          ctx.shadowBlur = 10;
        }
        ctx.fillText(cert.icon, padX + 12, cursorY + 30);
        ctx.shadowBlur = 0;
        ctx.restore();

        // 名称 + 等级标签
        ctx.save();
        ctx.font = `700 14px ${Theme.fonts.display}`;
        ctx.fillStyle = issued ? cert.color : Theme.colors.ink.dim;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(cert.name, padX + 50, cursorY + 10);
        // 等级标签
        const levelColor = CERT_LEVEL_COLOR[cert.level];
        ctx.font = `500 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = issued ? levelColor : Theme.colors.ink.dim;
        ctx.fillText(`【${cert.level === "gold" ? "金" : cert.level === "silver" ? "银" : "铜"}】${cert.condition}`, padX + 50, cursorY + 28);
        // 描述
        ctx.font = `400 9px ${Theme.fonts.body}`;
        ctx.fillStyle = issued ? Theme.colors.ink.muted : Theme.colors.ink.dim;
        const descLines = wrapText(ctx, cert.desc, cardW - 60);
        ctx.fillText(descLines[0] ?? "", padX + 50, cursorY + 44);
        ctx.restore();

        // 进度条 + 进度文字
        if (prog) {
          drawProgressBar(ctx, padX + 50, cursorY + h - 14, cardW - 60, 5, prog.ratio, issued ? cert.color : Theme.colors.bg.line);
          ctx.save();
          ctx.font = `500 8px ${Theme.fonts.mono}`;
          ctx.fillStyle = issued ? "#52C41A" : Theme.colors.ink.muted;
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillText(issued ? "✓ 已颁发" : prog.label, padX + cardW - 8, cursorY + h - 4);
          ctx.restore();
        }
      }
      cursorY += h + gap;
    }

    this.v7CertificateContentH = cursorY + this.v7ViewScroll - clipTop;
    ctx.restore();

    const maxScroll = Math.max(0, this.v7CertificateContentH - (clipBottom - clipTop));
    this.v7ViewScroll = Math.max(0, Math.min(this.v7ViewScroll, maxScroll));
  }

  /** 证书陈列内容高度缓存 */
  private v7CertificateContentH = 0;

  /** v3 升级：角色 Tab 内容渲染（含教育文案：专长/被动/反诈 tips） */
  private renderCharacterTab(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
    // 角色卡片列表
    for (let i = 0; i < CHARACTERS.length; i++) {
      const c = CHARACTERS[i];
      const rect = this.getCharacterCardRect(i, screenW, screenH);
      const unlocked = isCharacterUnlocked(c.id, save);
      const selected = this.selectedCharacter === c.id;
      const pressed = this.pressedCharacterIdx === i;
      // 背景
      ctx.fillStyle = selected ? withAlpha(c.color, 0.18) : "rgba(20, 36, 58, 0.92)";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      // 边框
      ctx.strokeStyle = unlocked ? c.color : Theme.colors.bg.line;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.shadowColor = unlocked ? c.color : "#444";
      ctx.shadowBlur = selected ? 16 : 6;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.shadowBlur = 0;
      if (unlocked) drawNeonCorners(ctx, rect.x, rect.y, rect.w, rect.h, c.color, 10, 2, 6);
      // emoji 大图
      ctx.save();
      ctx.font = "32px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = unlocked ? 1 : 0.4;
      ctx.fillText(c.emoji, rect.x + 32, rect.y + 32);
      ctx.restore();
      // 角色名 + 副标
      ctx.save();
      ctx.font = `700 15px ${Theme.fonts.display}`;
      ctx.fillStyle = unlocked ? c.color : Theme.colors.ink.dim;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(c.name, rect.x + 64, rect.y + 12);
      ctx.font = `500 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(unlocked ? c.color : "#666", 0.8);
      ctx.fillText(c.title, rect.x + 64, rect.y + 30);
      // 专长标签
      ctx.font = `400 9px ${Theme.fonts.body}`;
      ctx.fillStyle = unlocked ? Theme.colors.ink.DEFAULT : Theme.colors.ink.dim;
      ctx.fillText(`专长：${c.expertise}`, rect.x + 64, rect.y + 44);
      ctx.restore();
      // 反诈 tips（教育文案）
      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = unlocked ? "#FFD666" : Theme.colors.ink.dim;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const tipLines = wrapText(ctx, `💡 ${c.tips[0]}`, rect.w - 80);
      ctx.fillText(tipLines[0] ?? "", rect.x + 64, rect.y + 60);
      ctx.restore();
      // 解锁条件 / 已选标记
      if (!unlocked) {
        ctx.save();
        ctx.font = `500 8px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#FF7A1A";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText("🔒 " + c.unlockDesc, rect.x + rect.w - 10, rect.y + 10);
        ctx.restore();
      } else if (selected) {
        ctx.save();
        ctx.font = `700 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#52C41A";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText("✓ 已选用", rect.x + rect.w - 10, rect.y + 10);
        ctx.restore();
      }
      if (pressed) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      }
    }
    // 底部教育提示
    this.renderCharacterEducationFooter(ctx, screenW, screenH);
  }

  /** v3 升级：角色详情底部教育文案（被动技能 + 反诈口诀） */
  private renderCharacterEducationFooter(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const c = CHARACTER_MAP[this.selectedCharacter] ?? CHARACTER_MAP.swat;
    const footerY = screenH - 130;
    const footerH = 42;
    const footerW = Math.min(360, screenW - 32);
    const footerX = (screenW - footerW) / 2;
    // 背景框
    ctx.save();
    ctx.fillStyle = "rgba(8, 20, 40, 0.92)";
    ctx.fillRect(footerX, footerY, footerW, footerH);
    ctx.strokeStyle = withAlpha(c.color, 0.6);
    ctx.lineWidth = 1;
    ctx.strokeRect(footerX + 0.5, footerY + 0.5, footerW - 1, footerH - 1);
    // 被动技能标签
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = c.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`【${c.name} · 被动】`, footerX + 10, footerY + 6);
    // 被动描述
    const passiveTexts = c.passives.map((p) => this.describePassive(p));
    ctx.font = `400 9px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(passiveTexts.join("  |  "), footerX + 10, footerY + 20);
    // 第二条 tips
    if (c.tips[1]) {
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.fillText(`💡 ${c.tips[1]}`, footerX + 10, footerY + 32);
    }
    ctx.restore();
  }

  /** v3 升级：被动技能文案转可读描述 */
  private describePassive(p: import("@/games/thunder/types").CharacterPassive): string {
    switch (p.kind) {
      case "dmgToFraudTypes":
        return `对${p.fraudTypes?.join("/") ?? "特定诈骗"}伤害 +${Math.round((p.value ?? 0) * 100)}%`;
      case "shieldStart":
        return `初始反诈APP护盾 +${p.value ?? 0} 层`;
      case "scoreBoost":
        return `积分 +${Math.round((p.value ?? 0) * 100)}%`;
      case "dropBoost":
        return `道具掉落 +${Math.round((p.value ?? 0) * 100)}%`;
      case "ultChargeStart":
        return `初始大招充能 +${p.value ?? 0}`;
      case "hpRegenWave":
        return `每波结束回血 ${p.value ?? 0} HP`;
      case "branchStart":
        return `初始武器分支：${p.branch ?? "normal"}`;
      default:
        return p.kind;
    }
  }

  /** v3 升级：角色卡片矩形 */
  private getCharacterCardRect(idx: number, screenW: number, screenH: number): Rect {
    const cardW = Math.min(360, screenW - 32);
    const cardH = 78;
    const gap = 8;
    const startY = 130;
    const x = (screenW - cardW) / 2;
    const y = startY + idx * (cardH + gap);
    return { x, y, w: cardW, h: cardH };
  }

  /** v3 升级：装备 Tab 内容渲染（3 个槽位 + 已拥有装备选择 + 教育文案） */
  private renderEquipmentTab(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
    const ownedIds = new Set(save.ownedEquipments);
    const slots: EquipSlot[] = ["weaponChip", "shieldCore", "moveModule"];
    // 每个槽位一个区块：槽位标题 + 当前装备 + 可选装备列表
    for (let s = 0; s < slots.length; s++) {
      const slot = slots[s];
      const slotRect = this.getEquipSlotBlockRect(s, screenW);
      // 槽位标题
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#00E5FF";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`【${EQUIP_SLOT_LABEL[slot]}】`, slotRect.x, slotRect.y);
      ctx.restore();
      // 该槽位所有装备（横向 3 列）
      const list = EQUIPMENTS_BY_SLOT[slot];
      const currentId = this.equippedEquipments[slot];
      for (let i = 0; i < list.length; i++) {
        const eq = list[i];
        const rect = this.getEquipChoiceRect(s, i, screenW);
        const owned = ownedIds.has(eq.id) || eq.id === currentId;
        const selected = currentId === eq.id;
        const pressed = this.pressedEquipSlotIdx === s && this.pressedEquipChoiceIdx === i;
        // 背景
        ctx.fillStyle = selected ? withAlpha(eq.color, 0.22) : owned ? "rgba(20, 36, 58, 0.92)" : "rgba(40, 30, 30, 0.6)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        // 边框
        ctx.strokeStyle = owned ? eq.color : Theme.colors.bg.line;
        ctx.lineWidth = selected ? 2 : 1;
        ctx.shadowColor = owned ? eq.color : "#444";
        ctx.shadowBlur = selected ? 12 : 4;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        ctx.shadowBlur = 0;
        // emoji
        ctx.save();
        ctx.font = "20px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = owned ? 1 : 0.4;
        ctx.fillText(eq.emoji, rect.x + rect.w / 2, rect.y + 16);
        // 稀有度标签
        ctx.font = `500 7px ${Theme.fonts.mono}`;
        ctx.fillStyle = eq.color;
        ctx.fillText(EQUIP_RARITY_LABEL[eq.rarity], rect.x + rect.w / 2, rect.y + 34);
        // 选中标记
        if (selected) {
          ctx.font = `700 8px ${Theme.fonts.mono}`;
          ctx.fillStyle = "#52C41A";
          ctx.fillText("✓", rect.x + rect.w - 8, rect.y + 8);
        } else if (!owned) {
          ctx.font = `700 8px ${Theme.fonts.mono}`;
          ctx.fillStyle = "#FF7A1A";
          ctx.fillText("🔒", rect.x + rect.w - 8, rect.y + 8);
        }
        ctx.restore();
        if (pressed) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.restore();
        }
      }
      // 当前装备详情（教育文案 lore）
      const currentEq = currentId ? EQUIPMENT_MAP[currentId] : undefined;
      if (currentEq) {
        ctx.save();
        ctx.font = `400 9px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.DEFAULT;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`${currentEq.name}：${currentEq.desc}`, slotRect.x, slotRect.y + slotRect.h - 22);
        ctx.font = `400 8px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#FFD666";
        const loreLines = wrapText(ctx, `💡 ${currentEq.lore}`, slotRect.w);
        ctx.fillText(loreLines[0] ?? "", slotRect.x, slotRect.y + slotRect.h - 10);
        ctx.restore();
      } else {
        ctx.save();
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("未装备（击败 BOSS 可掉落配件）", slotRect.x, slotRect.y + slotRect.h - 14);
        ctx.restore();
      }
    }
    // 底部教育提示
    this.renderEquipmentEducationFooter(ctx, screenW, screenH);
  }

  /** v3 升级：装备槽位区块矩形 */
  private getEquipSlotBlockRect(slotIdx: number, screenW: number): Rect {
    const blockW = Math.min(360, screenW - 32);
    const blockH = 92;
    const gap = 8;
    const startY = 124;
    const x = (screenW - blockW) / 2;
    const y = startY + slotIdx * (blockH + gap);
    return { x, y, w: blockW, h: blockH };
  }

  /** v3 升级：装备选择卡片矩形（槽位内横向排列） */
  private getEquipChoiceRect(slotIdx: number, choiceIdx: number, screenW: number): Rect {
    const block = this.getEquipSlotBlockRect(slotIdx, screenW);
    const choiceW = 76;
    const choiceH = 48;
    const gap = 6;
    const totalW = choiceW * 3 + gap * 2;
    const startX = block.x + (block.w - totalW) / 2;
    return { x: startX + choiceIdx * (choiceW + gap), y: block.y + 16, w: choiceW, h: choiceH };
  }

  // ===== v4 升级：天赋树 Tab =====

  /** 天赋节点命中矩形：3 分支（列）× 5 层（行） */
  private getTalentNodeRect(branchIdx: number, tier: number, screenW: number, _screenH: number): Rect {
    const branches = 3;
    const nodeW = 96;
    const nodeH = 56;
    const gapX = 12;
    const gapY = 10;
    const totalW = nodeW * branches + gapX * (branches - 1);
    const startX = (screenW - totalW) / 2;
    const startY = 200;
    return {
      x: startX + branchIdx * (nodeW + gapX),
      y: startY + (tier - 1) * (nodeH + gapY),
      w: nodeW,
      h: nodeH,
    };
  }

  /** v4：天赋树 Tab 渲染 */
  private renderTalentTab(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
    const charId = this.selectedCharacter;
    const charDef = CHARACTER_MAP[charId];
    const branches: ThunderTalentBranch[] = ["offense", "defense", "support"];
    const branchLabels: Record<ThunderTalentBranch, string> = {
      offense: "攻系 💥",
      defense: "防系 🛡",
      support: "辅系 ✨",
    };
    const branchColors: Record<ThunderTalentBranch, string> = {
      offense: "#FF5A60",
      defense: "#3B7FEF",
      support: "#B388FF",
    };
    const charState = save.characterTalents[charId] ?? {};

    // 顶部信息：角色名 + 天赋点余额
    ctx.save();
    ctx.font = `600 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${charDef?.emoji ?? ""} ${charDef?.name ?? ""} 的天赋树`, screenW / 2, 178);
    ctx.font = `500 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#B388FF";
    ctx.fillText(`✨ 天赋点：${save.talentPoints}`, screenW / 2, 196);
    ctx.restore();

    // 分支标题
    for (let b = 0; b < branches.length; b++) {
      const rect = this.getTalentNodeRect(b, 1, screenW, screenH);
      ctx.save();
      ctx.font = `600 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = branchColors[branches[b]];
      ctx.textAlign = "center";
      ctx.fillText(branchLabels[branches[b]], rect.x + rect.w / 2, rect.y - 12);
      ctx.restore();
    }

    // 节点
    for (let b = 0; b < branches.length; b++) {
      const branch = branches[b];
      const currentTier = charState[branch] ?? 0;
      const nodes = TALENT_BY_BRANCH[branch];
      for (const node of nodes) {
        const rect = this.getTalentNodeRect(b, node.tier, screenW, screenH);
        const unlocked = node.tier <= currentTier;
        const canUnlock = canUnlockTalent(charId, branch, node.tier, save);
        const isNext = node.tier === currentTier + 1;

        ctx.save();
        // 背景
        ctx.fillStyle = unlocked
          ? withAlpha(branchColors[branch], 0.22)
          : isNext
            ? "rgba(8, 20, 40, 0.92)"
            : "rgba(8, 12, 24, 0.7)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        // 边框
        ctx.strokeStyle = unlocked
          ? branchColors[branch]
          : isNext
            ? (canUnlock ? "#FFD666" : "rgba(120,120,120,0.5)")
            : "rgba(80,80,80,0.4)";
        ctx.lineWidth = unlocked ? 2 : (isNext && canUnlock ? 2 : 1);
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        // 文字
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 12px ${Theme.fonts.mono}`;
        ctx.fillStyle = unlocked ? "#FFFFFF" : (isNext ? "#FFD666" : "rgba(140,140,140,0.7)");
        ctx.fillText(`${node.emoji} ${node.name}`, rect.x + rect.w / 2, rect.y + 14);
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = unlocked ? "rgba(220,220,220,0.9)" : "rgba(120,120,120,0.7)";
        // 描述截断
        const desc = node.desc.length > 14 ? node.desc.slice(0, 13) + "…" : node.desc;
        ctx.fillText(desc, rect.x + rect.w / 2, rect.y + 30);
        // 消耗 / 状态
        ctx.font = `600 9px ${Theme.fonts.mono}`;
        if (unlocked) {
          ctx.fillStyle = "#52C41A";
          ctx.fillText("✓ 已解锁", rect.x + rect.w / 2, rect.y + 45);
        } else if (isNext) {
          ctx.fillStyle = canUnlock ? "#FFD666" : "#888";
          ctx.fillText(`消耗 ${node.cost} 点${canUnlock ? "（可解锁）" : ""}`, rect.x + rect.w / 2, rect.y + 45);
        } else {
          ctx.fillStyle = "rgba(100,100,100,0.6)";
          ctx.fillText(`需先解锁上层`, rect.x + rect.w / 2, rect.y + 45);
        }
        ctx.restore();
      }
    }

    // 底部教育文案：当前角色专长 + 反诈知识
    const footerY = screenH - 130;
    const footerH = 42;
    const footerW = Math.min(360, screenW - 32);
    const footerX = (screenW - footerW) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(8, 20, 40, 0.92)";
    ctx.fillRect(footerX, footerY, footerW, footerH);
    ctx.strokeStyle = withAlpha("#B388FF", 0.6);
    ctx.lineWidth = 1;
    ctx.strokeRect(footerX + 0.5, footerY + 0.5, footerW - 1, footerH - 1);
    ctx.fillStyle = "#B388FF";
    ctx.font = `600 10px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("天赋点获取：击败 BOSS +1 · BOSS连战每阶段 +2 / 通关 +5", footerX + footerW / 2, footerY + 14);
    ctx.fillStyle = "rgba(200,200,200,0.85)";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    const tip = charDef?.tips?.[0] ?? "识破话术，精准打击";
    ctx.fillText(tip, footerX + footerW / 2, footerY + 30);
    ctx.restore();
  }

  /** v5 Meta Tab：皮肤选择 + 每日任务 */
  private renderMetaTab(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const save = this.saveSnapshot ?? loadThunderSaveSnapshot();
    let cy = 128;
    // ===== 皮肤选择区 =====
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("🎭 飞船皮肤", 24, cy);
    cy += 22;
    const skinW = Math.min(100, (screenW - 48 - 24) / 4);
    const skinH = 60;
    const skinGap = 8;
    for (let i = 0; i < THUNDER_SKINS.length; i++) {
      const skin = THUNDER_SKINS[i];
      const col = i % 4;
      const row = Math.floor(i / 4);
      const sx = 24 + col * (skinW + skinGap);
      const sy = cy + row * (skinH + skinGap);
      const unlocked = skin.default || save.unlockedSkins.includes(skin.id);
      const equipped = save.equippedSkin === skin.id;
      ctx.save();
      // 卡片背景
      ctx.fillStyle = equipped ? withAlpha(skin.shipColor, 0.18) : "rgba(8,20,40,0.85)";
      ctx.fillRect(sx, sy, skinW, skinH);
      ctx.strokeStyle = equipped ? skin.shipColor : withAlpha(Theme.colors.bg.line, 0.6);
      ctx.lineWidth = equipped ? 2 : 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, skinW - 1, skinH - 1);
      // emoji
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = unlocked ? 1 : 0.3;
      ctx.fillText(skin.emoji, sx + skinW / 2, sy + 20);
      // 名称
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = unlocked ? skin.shipColor : Theme.colors.ink.dim;
      ctx.fillText(skin.name, sx + skinW / 2, sy + 40);
      // 状态
      ctx.font = `500 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = equipped ? "#52C41A" : unlocked ? Theme.colors.ink.muted : "#FF4D4F";
      ctx.fillText(equipped ? "已装备" : unlocked ? "点击装备" : "未解锁", sx + skinW / 2, sy + 52);
      ctx.restore();
    }
    cy += Math.ceil(THUNDER_SKINS.length / 4) * (skinH + skinGap) + 12;
    ctx.restore();

    // ===== 每日任务区 =====
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("📋 每日任务", 24, cy);
    cy += 22;
    const quests = getTodayQuestProgress(save);
    for (let i = 0; i < quests.length; i++) {
      const q = quests[i];
      const def = DAILY_QUESTS.find((d) => d.id === q.questId);
      if (!def) continue;
      const qy = cy + i * 44;
      // 背景
      ctx.fillStyle = "rgba(8,20,40,0.7)";
      ctx.fillRect(24, qy, screenW - 48, 38);
      ctx.strokeStyle = q.completed ? withAlpha("#52C41A", 0.5) : withAlpha(Theme.colors.bg.line, 0.4);
      ctx.lineWidth = 1;
      ctx.strokeRect(24.5, qy + 0.5, screenW - 49, 37);
      // emoji + 名称
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = q.completed ? "#52C41A" : Theme.colors.ink.DEFAULT;
      ctx.fillText(def.emoji, 32, qy + 6);
      ctx.font = `600 11px ${Theme.fonts.mono}`;
      ctx.fillText(def.name, 52, qy + 8);
      // 进度条
      const barX = 32;
      const barY = qy + 24;
      const barW = screenW - 48 - 16 - 60;
      const barH = 6;
      drawProgressBar(ctx, barX, barY, barW, barH, Math.min(1, q.progress / def.target), "#00E5FF");
      // 进度文字
      ctx.font = `500 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = q.completed ? "#52C41A" : Theme.colors.ink.muted;
      ctx.textAlign = "right";
      ctx.fillText(`${Math.min(q.progress, def.target)}/${def.target}`, screenW - 32, qy + 22);
      // 奖励
      ctx.font = `500 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "right";
      ctx.fillText(`+${def.rewardTalentPoints}点`, screenW - 32, qy + 8);
    }
    cy += quests.length * 44 + 8;
    ctx.restore();
    void screenH;
  }

  /** v3 升级：装备底部教育文案（配件 lore + 反诈口诀） */
  private renderEquipmentEducationFooter(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const footerY = screenH - 130;
    const footerH = 42;
    const footerW = Math.min(360, screenW - 32);
    const footerX = (screenW - footerW) / 2;
    const slots: EquipSlot[] = ["weaponChip", "shieldCore", "moveModule"];
    const equipped = slots
      .map((s) => (this.equippedEquipments[s] ? EQUIPMENT_MAP[this.equippedEquipments[s]!] : null))
      .filter((e): e is EquipmentDef => !!e);
    ctx.save();
    ctx.fillStyle = "rgba(8, 20, 40, 0.92)";
    ctx.fillRect(footerX, footerY, footerW, footerH);
    ctx.strokeStyle = withAlpha("#FFD666", 0.6);
    ctx.lineWidth = 1;
    ctx.strokeRect(footerX + 0.5, footerY + 0.5, footerW - 1, footerH - 1);
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`已装备 ${equipped.length}/3 件 · 击败 BOSS 解锁更多`, footerX + 10, footerY + 6);
    // 当前已装备装备的 lore 摘要
    if (equipped.length > 0) {
      const loreText = equipped[0].lore;
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      const lines = wrapText(ctx, `💡 ${loreText}`, footerW - 20);
      ctx.fillText(lines[0] ?? "", footerX + 10, footerY + 20);
      if (lines[1]) ctx.fillText(lines[1], footerX + 10, footerY + 31);
    } else {
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText("💡 装备配件可强化战机，更承载反诈知识", footerX + 10, footerY + 20);
      ctx.fillText("击败 BOSS 后必定掉落一件配件", footerX + 10, footerY + 31);
    }
    ctx.restore();
  }

  /** v2 升级：大招按钮渲染 */
  private renderUltimateButton(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const rect = this.getUltimateButtonRect(screenW, screenH);
    const charge = this.hud?.ultimateCharge ?? 0;
    const ready = this.hud?.ultimateReady ?? false;
    const accent = ready ? "#FF00E5" : Theme.colors.bg.line;
    drawButton(ctx, rect.x, rect.y, rect.w, rect.h, "", {
      variant: "hard",
      accent,
      pressed: this.pressedUltimate,
    });
    // 充能进度环
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.strokeStyle = ready ? "#FF00E5" : "#3B7FEF";
    ctx.lineWidth = 3;
    ctx.shadowColor = ready ? "#FF00E5" : "#3B7FEF";
    ctx.shadowBlur = ready ? 16 : 6;
    ctx.beginPath();
    ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // 图标
    ctx.save();
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = ready ? 1 : 0.5;
    ctx.fillText("⚡", rect.x + rect.w / 2, rect.y + rect.h / 2 - 6);
    ctx.restore();
    // 标签
    ctx.save();
    ctx.font = `500 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = ready ? "#FF00E5" : Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ready ? "雷霆审判" : `${Math.floor(charge * 100)}%`, rect.x + rect.w / 2, rect.y + rect.h - 12);
    ctx.restore();
  }

  /** v2 升级：暂停按钮渲染 */
  private renderPauseButton(ctx: CanvasRenderingContext2D, screenW: number): void {
    const rect = this.getThunderPauseButtonRect(screenW);
    ctx.save();
    ctx.strokeStyle = this.pressedPause ? "#00E5FF" : Theme.colors.ink.muted;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    ctx.fillStyle = this.pressedPause ? "#00E5FF" : Theme.colors.ink.DEFAULT;
    // 暂停图标（两竖线）
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.fillRect(cx - 6, cy - 7, 4, 14);
    ctx.fillRect(cx + 2, cy - 7, 4, 14);
    ctx.restore();
  }

  /** v2 升级：Roguelike Buff 选择 overlay */
  private renderRoguelikeChoice(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const options = hud.roguelikeOptions!;
    // 全屏暗化
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.82)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 顶部标题
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 10;
    ctx.fillText("ROGUELIKE · 反诈强化", screenW / 2, screenH * 0.18 - 22);
    ctx.shadowBlur = 0;
    ctx.font = `900 24px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 18;
    ctx.fillText("选择一项强化", screenW / 2, screenH * 0.18 + 8);
    ctx.shadowBlur = 0;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("点击卡片选择（二选一）", screenW / 2, screenH * 0.18 + 32);
    // 卡片
    const rarityLabel: Record<string, string> = { common: "普通", rare: "稀有", epic: "史诗" };
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const rect = this.getRoguelikeOptionRect(i, screenW, screenH);
      const pressed = this.pressedRoguelikeIdx === i;
      // 背景
      ctx.fillStyle = pressed ? withAlpha(opt.color, 0.22) : "rgba(20, 36, 58, 0.92)";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      // 边框
      ctx.strokeStyle = opt.color;
      ctx.lineWidth = pressed ? 2 : 1;
      ctx.shadowColor = opt.color;
      ctx.shadowBlur = pressed ? 16 : 8;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.shadowBlur = 0;
      drawNeonCorners(ctx, rect.x, rect.y, rect.w, rect.h, opt.color, 10, 2, 6);
      // emoji 大图
      ctx.font = "36px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opt.emoji, rect.x + 40, rect.y + rect.h / 2);
      // 稀有度徽章
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = opt.color;
      ctx.textAlign = "left";
      ctx.fillText(rarityLabel[opt.rarity] ?? opt.rarity, rect.x + 80, rect.y + 16);
      // 名称
      ctx.font = `700 17px ${Theme.fonts.body}`;
      ctx.fillStyle = opt.color;
      ctx.fillText(opt.name + (opt.currentStack ? ` ×${opt.currentStack}/${opt.maxStack}` : ""), rect.x + 80, rect.y + 36);
      // 描述
      ctx.font = `400 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.fillText(opt.desc, rect.x + 80, rect.y + 60);
      // 序号
      ctx.font = `900 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(opt.color, 0.6);
      ctx.textAlign = "right";
      ctx.fillText(`0${i + 1}`, rect.x + rect.w - 12, rect.y + 16);
    }
    ctx.restore();
  }

  /** v2 升级：暂停 overlay */
  private renderThunderPauseOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.85)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 标题
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED · 已暂停", screenW / 2, screenH / 2 - 80);
    ctx.font = `900 28px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 16;
    ctx.fillText("作战暂停", screenW / 2, screenH / 2 - 50);
    ctx.shadowBlur = 0;
    // 按钮：继续 / 重开
    const resumeBtn = { x: screenW / 2 - 100, y: screenH / 2, w: 90, h: 40 } as Rect;
    const restartBtn = { x: screenW / 2 + 10, y: screenH / 2, w: 90, h: 40 } as Rect;
    const backBtn = { x: screenW / 2 - 70, y: screenH / 2 + 56, w: 140, h: 40 } as Rect;
    drawButton(ctx, resumeBtn.x, resumeBtn.y, resumeBtn.w, resumeBtn.h, "继续", { variant: "hard", accent: "#52C41A" });
    drawButton(ctx, restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, "重开", { variant: "hard", accent: "#FFB020" });
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "返回大厅", { variant: "hard", accent: Theme.colors.ink.muted });
    ctx.restore();
  }

  // ===== v2 升级：场景视觉增强（C1/C2/C3 + B3/B4） =====

  /** 主题视觉色调（C3）：根据当前 wave 主题叠加柔色调 */
  private renderThemeTint(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.hud || !this.hud.theme) return;
    const theme = THEME_MAP[this.hud.theme];
    if (!theme) return;
    ctx.save();
    // 顶部主题标签条（轻微存在感）
    const tint = theme.nebulaColors[0];
    // 顶部渐变光带
    const grad = ctx.createLinearGradient(0, 0, 0, 80);
    grad.addColorStop(0, `rgba(${tint},0.18)`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, 80);
    // 主题徽章（左上角，在 stats 之上偏右一点不挡称号）
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = `rgba(${tint},0.9)`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${theme.emoji} ${theme.name}`, screenW - 56, 22);
    ctx.restore();
  }

  /** 战机受损警示（C2）：HP < 30% 时红色边缘脉冲 + DANGER 徽章 */
  private renderShipDamagedWarning(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.hud?.shipDamaged) return;
    const pulse = 0.35 + Math.sin(this.t * 6) * 0.25;
    ctx.save();
    // 四边红色 vignette
    const grad = ctx.createRadialGradient(
      screenW / 2, screenH / 2, screenH * 0.3,
      screenW / 2, screenH / 2, screenH * 0.75,
    );
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, `rgba(229,53,59,${0.35 + pulse * 0.2})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);
    // 顶部 DANGER 徽章
    const bw = 110;
    const bh = 20;
    const bx = (screenW - bw) / 2;
    const by = 124;
    ctx.fillStyle = `rgba(229,53,59,${0.2 + pulse * 0.2})`;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = `rgba(229,53,59,${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 1;
    ctx.shadowColor = "#E5353B";
    ctx.shadowBlur = 10;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.shadowBlur = 0;
    ctx.font = `900 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FF5A60";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚠ SHIP DAMAGED", bx + bw / 2, by + bh / 2 + 1);
    ctx.restore();
  }

  /** BOSS 登场 CG 全屏 overlay（C1）：根据 entranceStage 渲染预警/闪屏/标题特写 */
  private renderBossEntranceCG(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.hud) return;
    const stage = this.hud.bossEntranceStage;
    if (!stage || stage === "done") return;
    const remaining = this.hud.bossEntranceUntil ?? 0;
    const bossName = this.hud.bossName ?? BOSS.name;
    const bossFraud = this.hud.bossFraudType ?? BOSS.fraudType;
    const bossColor = BOSS.color;

    ctx.save();
    if (stage === "warn") {
      // 顶部预警条：红色条纹横向闪烁
      const alpha = 0.5 + Math.sin(this.t * 20) * 0.3;
      ctx.fillStyle = `rgba(229,53,59,${alpha * 0.5})`;
      ctx.fillRect(0, screenH * 0.18, screenW, 4);
      ctx.fillRect(0, screenH * 0.82, screenW, 4);
      // 中央 ⚠ 预警图标
      ctx.font = `900 14px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF5A60";
      ctx.shadowColor = "#FF5A60";
      ctx.shadowBlur = 12;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚠ WARNING · 高危电诈目标接近", screenW / 2, screenH * 0.2);
      ctx.shadowBlur = 0;
    } else if (stage === "flash") {
      // 闪屏阶段：白色快速闪烁
      const alpha = 0.3 + Math.sin(this.t * 30) * 0.4;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, alpha) * 0.5})`;
      ctx.fillRect(0, 0, screenW, screenH);
    } else if (stage === "zoom" || stage === "title") {
      // 慢推近 + 名称特写：黑色 vignette + 大字 BOSS 名称
      const totalZoom = 0.6;
      const totalTitle = 1.2;
      const dur = stage === "zoom" ? totalZoom : totalTitle;
      const progress = Math.max(0, Math.min(1, 1 - remaining / dur));
      // vignette
      const grad = ctx.createRadialGradient(
        screenW / 2, screenH / 2, screenH * 0.2,
        screenW / 2, screenH / 2, screenH * 0.7,
      );
      grad.addColorStop(0, "transparent");
      grad.addColorStop(1, `rgba(0,0,0,${0.6 * progress})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, screenW, screenH);
      // 中央文字
      const alpha = stage === "title" ? 1 : Math.min(1, progress * 1.5);
      const scale = 0.7 + progress * 0.3;
      ctx.translate(screenW / 2, screenH / 2);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      // 副标：诈骗类型
      ctx.font = `400 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(bossColor, 0.85);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = bossColor;
      ctx.shadowBlur = 10;
      ctx.fillText(`TARGET LOCKED · ${bossFraud}`, 0, -60);
      ctx.shadowBlur = 0;
      // 主标：BOSS 名称
      ctx.font = `900 36px ${Theme.fonts.display}`;
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = bossColor;
      ctx.shadowBlur = 24;
      ctx.fillText(bossName, 0, -10);
      ctx.shadowBlur = 0;
      // 装饰横线
      ctx.strokeStyle = withAlpha(bossColor, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-100, 30);
      ctx.lineTo(100, 30);
      ctx.stroke();
      // 提示
      ctx.font = `500 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("BOSS 登场 · 准备反诈作战", 0, 50);
    }
    ctx.restore();
  }

  /** v4 升级：武器觉醒 CG 全屏 overlay — 金色光晕 + AWAKENING 电影标题 + 口诀 */
  private renderAwakeningCG(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.hud?.awakeningToast) return;
    const at = this.hud.awakeningToast;
    // 觉醒 CG 总时长 3.5s，基于本地 t 与 HUD 推送时刻估算进度
    // 由于 awakeningToast 不携带起始时刻，用 mantraTexts[0].until 反推（引擎同步推送）
    const mantraUntil = this.hud.mantraTexts?.[0]?.until ?? 0;
    if (mantraUntil <= 0) return;
    const TOTAL = 3.5;
    const remaining = Math.max(0, mantraUntil - this.t);
    if (remaining <= 0) return;
    const progress = Math.max(0, Math.min(1, 1 - remaining / TOTAL));

    ctx.save();
    // 全屏金色光晕 vignette
    const grad = ctx.createRadialGradient(
      screenW / 2, screenH / 2, screenH * 0.15,
      screenW / 2, screenH / 2, screenH * 0.7,
    );
    grad.addColorStop(0, "rgba(255,214,102,0.22)");
    grad.addColorStop(0.6, "rgba(255,0,229,0.08)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);

    // 电影黑边（前 0.3s 滑入，最后 0.4s 滑出）
    const lbMaxH = screenH * 0.12;
    let lbH: number;
    if (progress < 0.1) lbH = lbMaxH * (progress / 0.1);
    else if (progress > 0.85) lbH = lbMaxH * Math.max(0, (1 - progress) / 0.15);
    else lbH = lbMaxH;
    if (lbH > 0.5) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, screenW, lbH);
      ctx.fillRect(0, screenH - lbH, screenW, lbH);
    }

    // 中央标题区
    const alpha = progress < 0.15 ? progress / 0.15 : progress > 0.85 ? Math.max(0, (1 - progress) / 0.15) : 1;
    ctx.globalAlpha = alpha;
    ctx.translate(screenW / 2, screenH * 0.4);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 副标：AWAKENING
    const subScale = 0.8 + Math.min(1, progress / 0.3) * 0.2;
    ctx.save();
    ctx.scale(subScale, subScale);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#FFD666", 0.85);
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 8;
    ctx.fillText("WEAPON AWAKENING", 0, -56);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 主标：觉醒名称（缩放脉冲）
    const titleScale = progress < 0.25 ? 0.6 + (progress / 0.25) * 0.6 : 1.2 - Math.min(1, (progress - 0.25) / 0.4) * 0.2;
    ctx.save();
    ctx.scale(titleScale, titleScale);
    ctx.font = `900 30px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FF00E5";
    ctx.shadowBlur = 20 + Math.sin(this.t * 6) * 4;
    ctx.fillText(`${at.emoji} ${at.name}`, 0, -16);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 装饰横线
    const lineW = 120;
    ctx.strokeStyle = withAlpha("#FFD666", 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-lineW, 14);
    ctx.lineTo(lineW, 14);
    ctx.stroke();

    // 口诀（觉醒 mantra）
    ctx.font = `700 14px ${Theme.fonts.body}`;
    ctx.fillStyle = "#FFD666";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 10;
    ctx.fillText(`「${at.mantra}」`, 0, 40);
    ctx.shadowBlur = 0;

    // 底部提示
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("反诈力量觉醒 · 识破一切话术", 0, 64);

    ctx.restore();
  }

  /** 口诀飘字（B3）：渲染引擎推送的反诈口诀为浮动文字 */
  private renderMantraTexts(ctx: CanvasRenderingContext2D, _screenW: number, screenH: number): void {
    if (!this.hud?.mantraTexts || this.hud.mantraTexts.length === 0) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 依次从屏幕中央偏上向下排列，每条间隔 28px
    const baseY = screenH * 0.42;
    const gap = 28;
    for (let i = 0; i < this.hud.mantraTexts.length; i++) {
      const m = this.hud.mantraTexts[i];
      // 基于 until 估算 life：以最近一次推送为基准，这里直接用 i 作为层级
      // 用 sin 营造轻微浮动
      const y = baseY + i * gap + Math.sin(this.t * 2 + i) * 2;
      // 颜色随位置：第 0 条最亮（金色），其余青色
      const color = i === 0 ? "#FFD666" : "#00E5FF";
      ctx.font = i === 0 ? `900 18px ${Theme.fonts.display}` : `700 14px ${Theme.fonts.body}`;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = i === 0 ? 14 : 8;
      ctx.fillText(m.text, _screenW / 2, y);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /** BOSS 击败慢镜头 overlay（B4）：展示识别清单 + 真实案例 + 防护清单 */
  private renderBossDefeatSlowmo(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.hud || !this.hud.bossDefeatSlowmoUntil || this.hud.bossDefeatSlowmoUntil <= 0) return;
    if (!this.hud.bossDefeatIdentify) return;
    const di = this.hud.bossDefeatIdentify;
    const TOTAL = 2.5;
    const remaining = this.hud.bossDefeatSlowmoUntil;
    const progress = Math.max(0, Math.min(1, 1 - remaining / TOTAL));
    // alpha 曲线：0~0.15 淡入，0.85~1.0 淡出
    let alpha: number;
    if (progress < 0.15) alpha = progress / 0.15;
    else if (progress > 0.85) alpha = Math.max(0, (1 - progress) / 0.15);
    else alpha = 1;
    // y 偏移：从下方滑入 30px
    const slideY = 30 * (1 - Math.min(1, progress / 0.3));

    ctx.save();
    ctx.globalAlpha = alpha;
    // 全屏金色暗化
    ctx.fillStyle = "rgba(8,14,30,0.55)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 顶部金色光带
    const grad = ctx.createLinearGradient(0, 0, 0, screenH);
    grad.addColorStop(0, "rgba(255,214,102,0.18)");
    grad.addColorStop(0.5, "transparent");
    grad.addColorStop(1, "rgba(255,214,102,0.10)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);

    // v4 升级：电影黑边（letterbox）— 前 0.2s 滑入，0.8~1.0 滑出
    const lbMaxH = screenH * 0.1; // 黑边最大高度
    let lbH: number;
    if (progress < 0.2) lbH = lbMaxH * (progress / 0.2);
    else if (progress > 0.8) lbH = lbMaxH * Math.max(0, (1 - progress) / 0.2);
    else lbH = lbMaxH;
    if (lbH > 0.5) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, screenW, lbH);
      ctx.fillRect(0, screenH - lbH, screenW, lbH);
    }

    // v4 升级："FRAUD BUSTED" 电影标题脉冲（前 0.6s 显示）
    if (progress < 0.6) {
      const fp = progress / 0.6; // 0..1
      const fAlpha = Math.min(1, fp < 0.15 ? fp / 0.15 : Math.max(0.4, 1 - (fp - 0.15) / 0.85 * 0.6));
      const fScale = 1.4 - fp * 0.4; // 1.4 → 1.0
      ctx.save();
      ctx.globalAlpha = alpha * fAlpha;
      ctx.translate(screenW / 2, screenH * 0.25);
      ctx.scale(fScale, fScale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha("#FFD666", 0.85);
      ctx.fillText("ANTI-FRAUD OPERATION", 0, -22);
      ctx.font = `900 28px ${Theme.fonts.display}`;
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 18;
      ctx.fillText("FRAUD BUSTED", 0, 4);
      ctx.shadowBlur = 0;
      // 装饰横线
      ctx.strokeStyle = withAlpha("#FFD666", 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-80, 24);
      ctx.lineTo(80, 24);
      ctx.stroke();
      ctx.restore();
    }

    // 中央卡片
    const w = Math.min(360, screenW - 32);
    const h = this.bossDefeatPanelH(di);
    const px = (screenW - w) / 2;
    const py = Math.max(8, (screenH - h) / 2) + slideY;

    // 卡片背景
    ctx.fillStyle = "rgba(12,26,46,0.94)";
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = withAlpha("#FFD666", 0.6);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 14;
    ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    drawNeonCorners(ctx, px, py, w, h, "#FFD666", 10, 2, 8);

    // 标题
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#FFD666", 0.8);
    ctx.fillText("BOSS DEFEATED · 反诈识破", px + w / 2, py + 14);
    ctx.font = `900 22px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFD666";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 14;
    ctx.fillText(`${di.emoji} ${di.name}`, px + w / 2, py + 30);
    ctx.shadowBlur = 0;
    ctx.font = `700 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(di.fraudType, px + w / 2, py + 60);

    // 分隔线
    const sepY = py + 82;
    const lg = ctx.createLinearGradient(px + 16, sepY, px + w - 16, sepY);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, withAlpha("#FFD666", 0.5));
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(px + 16, sepY, w - 32, 1);

    let cy = sepY + 12;
    const padX = 16;

    // 真实案例
    if (di.caseStory) {
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "left";
      ctx.fillText("真实案例", px + padX, cy);
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
      const lines = wrapText(ctx, di.caseStory, w - padX * 2);
      lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, px + padX, cy + 16 + i * 15));
      cy += 16 + Math.min(2, lines.length) * 15 + 8;
    }

    // 识别要点
    const identify = di.identifyDetail ?? [];
    if (identify.length > 0) {
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF5A60";
      ctx.fillText("识别要点", px + padX, cy);
      ctx.font = `400 11px ${Theme.fonts.body}`;
      let iy = cy + 16;
      for (const item of identify.slice(0, 3)) {
        ctx.fillStyle = "#FF5A60";
        ctx.fillText("▸", px + padX, iy);
        ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
        const lines = wrapText(ctx, item, w - padX * 2 - 14);
        lines.slice(0, 1).forEach((line) => ctx.fillText(line, px + padX + 14, iy));
        iy += 15;
      }
      cy = iy + 4;
    }

    // 防护清单
    const protect = di.protectList ?? [];
    if (protect.length > 0) {
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("防护清单", px + padX, cy);
      ctx.font = `400 11px ${Theme.fonts.body}`;
      let py2 = cy + 16;
      for (const item of protect.slice(0, 3)) {
        ctx.fillStyle = Theme.colors.safe.DEFAULT;
        ctx.fillText("✓", px + padX, py2);
        ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
        const lines = wrapText(ctx, item, w - padX * 2 - 14);
        lines.slice(0, 1).forEach((line) => ctx.fillText(line, px + padX + 14, py2));
        py2 += 15;
      }
    }

    // 底部小提示
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.fillText("— 反诈知识已收录至图鉴 —", px + w / 2, py + h - 16);

    ctx.restore();
  }

  /** 计算 BOSS 击败展示卡片高度 */
  private bossDefeatPanelH(di: NonNullable<ThunderHud["bossDefeatIdentify"]>): number {
    let h = 82; // 标题区
    h += 12; // 分隔线
    if (di.caseStory) h += 16 + 2 * 15 + 8;
    const identify = di.identifyDetail ?? [];
    if (identify.length > 0) h += 16 + Math.min(3, identify.length) * 15 + 4;
    const protect = di.protectList ?? [];
    if (protect.length > 0) h += 16 + Math.min(3, protect.length) * 15;
    h += 24; // 底部留白 + 提示
    return h;
  }

  // ===== v6 升级：新系统渲染入口 =====

  /** v6 升级：统一渲染 v6 新系统 UI */
  private renderV6Hud(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud;
    if (!hud) return;
    ctx.save();
    const roundRect = (x: number, y: number, w: number, h: number, r: number): void => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    // 1. 赛季通行证进度条（顶部，BOSS HP 条下方）
    this.renderSeasonPassBar(ctx, screenW, roundRect);
    // 2. 口诀连招（连击数下方，已解锁口诀列表 + 下一档提示）
    this.renderMantraChainHud(ctx, screenW);
    // 3. BOSS 组合弹幕警示（BOSS HP 条附近）
    this.renderCombinedPatternsBadge(ctx, screenW);
    // 4. 格挡按钮（左下角，大招按钮上方）
    this.renderParryButton(ctx, screenW, screenH);
    // 5. 超觉醒大招按钮（右下角，反诈突击按钮上方）
    this.renderSuperAwakeningButton(ctx, screenW, screenH);
    // 6. 诈骗溯源档案解锁卡片（屏幕中央）
    this.renderFraudArchiveCard(ctx, screenW, screenH, roundRect);
    // 7. BOSS AI 对话 overlay（底部弹窗，最上层）
    this.renderAIDialogOverlay(ctx, screenW, screenH, roundRect);

    ctx.restore();
  }

  // =========================================================================
  // ===== v7 升级场景层：剧情 / 课程 / RPG / 数据仪表板 / ================
  // ===== 自适应 AI / 证书 / v7Toast ======================================
  // =========================================================================

  /** v7：统一渲染 v7 子系统 HUD */
  private renderV7Hud(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud;
    if (!hud) return;
    ctx.save();
    const roundRect = (x: number, y: number, w: number, h: number, r: number): void => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    // 1. 自适应 AI 难度倍率徽章（右上角小标）
    if (hud.adaptiveDifficultyMul !== undefined && hud.mode && hud.mode !== "analytics") {
      this.renderAdaptiveBadge(ctx, screenW, hud.adaptiveDifficultyMul, hud.adaptiveSkillScore ?? 0);
    }

    // 2. v7 Toast（证书解锁 / RPG 结局 / 章节通关等一次性提示）
    if (hud.v7Toast) {
      this.renderV7Toast(ctx, screenW, hud.v7Toast);
    }

    // 3. 剧情模式：对白 overlay（narrative 关卡）
    if (hud.story && hud.story.narrativeActive) {
      this.renderStoryNarrative(ctx, screenW, screenH, hud.story, roundRect);
    }

    // 4. RPG 模式：剧本选项 overlay
    if (hud.rpg) {
      this.renderRPGOverlay(ctx, screenW, screenH, hud.rpg, roundRect);
    }

    // 5. 课程模式：内容/测验 overlay
    if (hud.lesson) {
      this.renderLessonOverlay(ctx, screenW, screenH, hud.lesson, roundRect);
    }

    // 6. 数据仪表板模式：全屏数据视图
    if (hud.mode === "analytics") {
      this.renderAnalyticsOverlay(ctx, screenW, screenH, roundRect);
    }

    ctx.restore();
  }

  /** v7：自适应 AI 难度倍率徽章 */
  private renderAdaptiveBadge(ctx: CanvasRenderingContext2D, screenW: number, diffMul: number, skillScore: number): void {
    const w = 76;
    const h = 22;
    const x = screenW - w - 8;
    const y = 34;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    // 难度倍率颜色：>1 偏红，<1 偏绿，=1 中性
    const color = diffMul > 1.1 ? "#FF6B6B" : diffMul < 0.9 ? "#52C41A" : "#00E5FF";
    ctx.fillStyle = color;
    ctx.font = `600 9px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("ADAPTIVE", x + 6, y + h / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFF";
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillText(`×${diffMul.toFixed(2)}`, x + w - 6, y + h / 2);
    ctx.restore();
  }

  /** v7：一次性 Toast 提示 */
  private renderV7Toast(ctx: CanvasRenderingContext2D, screenW: number, toast: { text: string; tone: "good" | "bad" | "info"; until: number }): void {
    const tw = screenW - 32;
    const th = 48;
    const ty = 112;
    drawToast(ctx, 16, ty, tw, th, toast.text, toast.tone, "v7 系统");
  }

  /** v7：剧情对白 overlay（narrative 关卡，底部对话框） */
  private renderStoryNarrative(
    ctx: CanvasRenderingContext2D,
    _screenW: number,
    screenH: number,
    story: NonNullable<ThunderHud["story"]>,
    roundRect: (x: number, y: number, w: number, h: number, r: number) => void,
  ): void {
    const boxW = _screenW - 24;
    const boxH = 120;
    const boxX = 12;
    const boxY = screenH - boxH - 12;
    ctx.save();
    // 半透明背景
    ctx.fillStyle = "rgba(8, 12, 24, 0.92)";
    roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = story.stageKind === "narrative" ? "#00E5FF" : "#FFD666";
    ctx.lineWidth = 1;
    ctx.stroke();
    // 发言方
    const speaker = story.currentNarrativeSpeaker ?? "旁白";
    ctx.fillStyle = "#00E5FF";
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(speaker, boxX + 12, boxY + 10);
    // 对白文本（自动换行）
    if (story.currentNarrativeText) {
      ctx.fillStyle = "#E8E8E8";
      ctx.font = `400 13px ${Theme.fonts.mono}`;
      const maxW = boxW - 24;
      const lines = this.wrapTextR(ctx, story.currentNarrativeText, maxW);
      for (let i = 0; i < Math.min(4, lines.length); i++) {
        ctx.fillText(lines[i], boxX + 12, boxY + 30 + i * 18);
      }
    }
    // 进度提示
    if (story.narrativeTotalLines && story.narrativeLineIdx !== undefined) {
      ctx.fillStyle = "#666";
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.textAlign = "right";
      ctx.fillText(`${story.narrativeLineIdx + 1}/${story.narrativeTotalLines}`, boxX + boxW - 12, boxY + 10);
    }
    // 点击继续提示
    ctx.fillStyle = "#FFD666";
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("点击继续 ▶", boxX + boxW - 12, boxY + boxH - 8);
    ctx.restore();
  }

  /** v7：RPG 剧本 overlay（底部场景描述 + 选项列表） */
  private renderRPGOverlay(
    ctx: CanvasRenderingContext2D,
    _screenW: number,
    screenH: number,
    rpg: NonNullable<ThunderHud["rpg"]>,
    roundRect: (x: number, y: number, w: number, h: number, r: number) => void,
  ): void {
    const boxW = _screenW - 24;
    const boxH = rpg.ended ? 100 : Math.min(280, 80 + rpg.currentChoices.length * 44);
    const boxX = 12;
    const boxY = screenH - boxH - 12;
    ctx.save();
    // 背景
    ctx.fillStyle = "rgba(8, 12, 24, 0.92)";
    roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = "#FF5A8A";
    ctx.lineWidth = 1;
    ctx.stroke();
    // 场景描述
    ctx.fillStyle = "#FF5A8A";
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`【${rpg.scenarioTitle}】`, boxX + 12, boxY + 8);
    // 当前文本
    if (rpg.currentText) {
      ctx.fillStyle = "#E8E8E8";
      ctx.font = `400 12px ${Theme.fonts.mono}`;
      const maxW = boxW - 24;
      const lines = this.wrapTextR(ctx, rpg.currentText, maxW);
      const textY = rpg.currentSpeaker ? boxY + 26 : boxY + 24;
      if (rpg.currentSpeaker) {
        ctx.fillStyle = "#00E5FF";
        ctx.font = `600 11px ${Theme.fonts.mono}`;
        ctx.fillText(rpg.currentSpeaker + ":", boxX + 12, textY);
        ctx.fillStyle = "#E8E8E8";
        ctx.font = `400 12px ${Theme.fonts.mono}`;
      }
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        ctx.fillText(lines[i], boxX + 12, textY + 16 + i * 16);
      }
    }
    // 识破红旗进度
    ctx.fillStyle = "#FFD666";
    ctx.font = `600 10px ${Theme.fonts.mono}`;
    ctx.textAlign = "right";
    ctx.fillText(`识破 ${rpg.bustScore}/${rpg.passThreshold}`, boxX + boxW - 12, boxY + 8);
    // 选项列表
    if (!rpg.ended && rpg.currentChoices.length > 0) {
      const choicesY = boxY + 76;
      const choiceH = 38;
      const choiceGap = 4;
      const choiceW = boxW - 24;
      for (let i = 0; i < rpg.currentChoices.length; i++) {
        const cy = choicesY + i * (choiceH + choiceGap);
        const choice = rpg.currentChoices[i];
        ctx.fillStyle = choice.bust ? "rgba(82, 196, 26, 0.15)" : "rgba(255,255,255,0.06)";
        roundRect(boxX + 12, cy, choiceW, choiceH, 4);
        ctx.fill();
        ctx.strokeStyle = choice.bust ? "#52C41A" : "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = choice.bust ? "#52C41A" : "#CCC";
        ctx.font = `400 11px ${Theme.fonts.mono}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const choiceLines = this.wrapTextR(ctx, choice.text, choiceW - 16);
        ctx.fillText(choiceLines[0] ?? choice.text, boxX + 20, cy + choiceH / 2);
      }
    }
    // 结局展示
    if (rpg.ended && rpg.ending) {
      ctx.fillStyle = rpg.ending.color;
      ctx.font = `700 14px ${Theme.fonts.mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rpg.ending.title, boxX + boxW / 2, boxY + 50);
      ctx.fillStyle = "#999";
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      const lessonLines = this.wrapTextR(ctx, rpg.ending.lesson, boxW - 24);
      for (let i = 0; i < Math.min(2, lessonLines.length); i++) {
        ctx.fillText(lessonLines[i], boxX + boxW / 2, boxY + 72 + i * 14);
      }
    }
    ctx.restore();
  }

  /** v7：课程模式 overlay（内容阅读 / 测验答题） */
  private renderLessonOverlay(
    ctx: CanvasRenderingContext2D,
    _screenW: number,
    screenH: number,
    lesson: NonNullable<ThunderHud["lesson"]>,
    roundRect: (x: number, y: number, w: number, h: number, r: number) => void,
  ): void {
    const boxW = _screenW - 24;
    const baseH = lesson.inQuiz ? 120 : 100;
    const boxH = lesson.inQuiz && lesson.currentQuiz ? baseH + lesson.currentQuiz.options.length * 36 : baseH;
    const boxX = 12;
    const boxY = screenH - boxH - 12;
    ctx.save();
    // 背景
    ctx.fillStyle = "rgba(8, 12, 24, 0.92)";
    roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = "#1AD670";
    ctx.lineWidth = 1;
    ctx.stroke();
    // 章节标题
    ctx.fillStyle = "#1AD670";
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`【${lesson.chapterTitle}】${lesson.sectionTitle}`, boxX + 12, boxY + 8);
    // 章节进度
    ctx.fillStyle = "#666";
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.textAlign = "right";
    ctx.fillText(`进度 ${Math.round(lesson.chapterProgress * 100)}%`, boxX + boxW - 12, boxY + 8);
    // 内容
    if (!lesson.inQuiz && lesson.sectionContent) {
      ctx.fillStyle = "#E8E8E8";
      ctx.font = `400 12px ${Theme.fonts.mono}`;
      const lines = this.wrapTextR(ctx, lesson.sectionContent, boxW - 24);
      for (let i = 0; i < Math.min(4, lines.length); i++) {
        ctx.fillText(lines[i], boxX + 12, boxY + 28 + i * 16);
      }
      // 点击继续
      ctx.fillStyle = "#FFD666";
      ctx.font = `500 10px ${Theme.fonts.mono}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("点击继续 ▶", boxX + boxW - 12, boxY + boxH - 8);
    }
    // 测验
    if (lesson.inQuiz && lesson.currentQuiz) {
      const q = lesson.currentQuiz;
      ctx.fillStyle = "#FFF";
      ctx.font = `500 12px ${Theme.fonts.mono}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const qLines = this.wrapTextR(ctx, q.question, boxW - 24);
      for (let i = 0; i < Math.min(2, qLines.length); i++) {
        ctx.fillText(qLines[i], boxX + 12, boxY + 28 + i * 16);
      }
      // 选项
      const optY = boxY + 62;
      const optH = 32;
      const optGap = 4;
      const optW = boxW - 24;
      for (let i = 0; i < q.options.length; i++) {
        const oy = optY + i * (optH + optGap);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        roundRect(boxX + 12, oy, optW, optH, 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#CCC";
        ctx.font = `400 11px ${Theme.fonts.mono}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const optLines = this.wrapTextR(ctx, `${String.fromCharCode(65 + i)}. ${q.options[i]}`, optW - 16);
        ctx.fillText(optLines[0] ?? "", boxX + 20, oy + optH / 2);
      }
      // 题号
      if (lesson.quizQuestionIdx !== undefined && lesson.quizTotal) {
        ctx.fillStyle = "#666";
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(`第 ${lesson.quizQuestionIdx + 1}/${lesson.quizTotal} 题`, boxX + boxW - 12, boxY + 8);
      }
    }
    ctx.restore();
  }

  /** v7：数据仪表板 overlay（全屏数据视图） */
  private renderAnalyticsOverlay(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
    _roundRect: (x: number, y: number, w: number, h: number, r: number) => void,
  ): void {
    const dashboard = this.engine?.getAnalyticsDashboard();
    if (!dashboard) return;
    ctx.save();
    // 全屏暗色背景
    ctx.fillStyle = "rgba(8, 12, 24, 0.96)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 标题
    ctx.fillStyle = "#00E5FF";
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("反诈能力数据中心", screenW / 2, 16);
    // 技能评分
    const radar = dashboard.abilityRadar;
    ctx.fillStyle = "#FFD666";
    ctx.font = `700 24px ${Theme.fonts.mono}`;
    ctx.fillText(`${Math.round(radar.overall)}`, screenW / 2, 42);
    ctx.fillStyle = "#999";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillText(`综合技能评分 · ${radar.grade} 级`, screenW / 2, 72);
    // 六维雷达图
    const dims = radar.dimensions;
    const dimKeys = Object.keys(dims) as Array<keyof typeof dims>;
    const radarCx = screenW / 2;
    const radarCy = 160;
    const radarR = 70;
    ctx.strokeStyle = "rgba(0, 229, 255, 0.2)";
    ctx.lineWidth = 1;
    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      ctx.arc(radarCx, radarCy, (radarR * r) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 雷达多边形
    ctx.beginPath();
    for (let i = 0; i < dimKeys.length; i++) {
      const angle = (Math.PI * 2 * i) / dimKeys.length - Math.PI / 2;
      const val = dims[dimKeys[i]] ?? 0;
      const px = radarCx + Math.cos(angle) * radarR * (val / 100);
      const py = radarCy + Math.sin(angle) * radarR * (val / 100);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 229, 255, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 维度标签
    const dimNames: Record<string, string> = {
      recognition: "识别", defense: "防御", reflex: "反应",
      knowledge: "知识", decision: "决策", endurance: "持久",
    };
    ctx.fillStyle = "#CCC";
    ctx.font = `500 9px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < dimKeys.length; i++) {
      const angle = (Math.PI * 2 * i) / dimKeys.length - Math.PI / 2;
      const lx = radarCx + Math.cos(angle) * (radarR + 14);
      const ly = radarCy + Math.sin(angle) * (radarR + 14);
      ctx.fillText(dimNames[dimKeys[i]] ?? dimKeys[i], lx, ly);
    }
    // 弱点报告
    const weakY = 250;
    ctx.fillStyle = "#FF5A8A";
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("薄弱项分析", 16, weakY);
    const wr = dashboard.weaknessReport;
    ctx.fillStyle = "#E8E8E8";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    if (wr.weakestFraudTypeName) {
      ctx.fillText(`最弱类型：${wr.weakestFraudTypeName}（${wr.severityLabel}）`, 16, weakY + 18);
    }
    if (wr.weakestDimension) {
      const weakDimName = dimNames[wr.weakestDimension] ?? wr.weakestDimension;
      ctx.fillText(`最弱维度：${weakDimName}`, 16, weakY + 34);
    }
    if (wr.recommendedMode) {
      const modeNames: Record<string, string> = {
        campaign: "战役", endless: "无尽", daily: "每日", story: "剧情",
        lesson: "课程", rpg: "RPG", bossRush: "BOSS连战",
      };
      ctx.fillStyle = "#FFD666";
      ctx.fillText(`推荐训练：${modeNames[wr.recommendedMode] ?? wr.recommendedMode}`, 16, weakY + 50);
    }
    // 累计统计
    const statY = 320;
    ctx.fillStyle = "#52C41A";
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.fillText("累计成就", 16, statY);
    ctx.fillStyle = "#CCC";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    const t = dashboard.totals;
    ctx.fillText(`游戏时长：${Math.floor(t.totalPlayTime / 60)} 分钟`, 16, statY + 18);
    ctx.fillText(`击败 BOSS：${t.totalBossKills} · 识破：${t.totalBusted}`, 16, statY + 34);
    ctx.fillText(`RPG 通关：${t.totalRPGCleared} · 课程通关：${t.totalLessonsCleared}`, 16, statY + 50);
    // 证书数（从存档读取）
    const save = this.engine?.getSave();
    if (save) {
      const certCount = save.unlockedCertificates?.length ?? 0;
      ctx.fillText(`获得证书：${certCount} 枚`, 16, statY + 66);
    }
    // 返回提示
    ctx.fillStyle = "#666";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("点击任意位置返回模式选择", screenW / 2, screenH - 12);
    ctx.restore();
  }

  /** v7：文本自动换行辅助 */
  private wrapTextR(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    if (!text) return [];
    const chars = Array.from(text);
    const lines: string[] = [];
    let current = "";
    for (const ch of chars) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current.length > 0) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines;
  }

  /** v6 升级：赛季通行证进度条（顶部细条） */
  private renderSeasonPassBar(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    roundRect: (x: number, y: number, w: number, h: number, r: number) => void,
  ): void {
    const sp = this.hud?.seasonPass;
    if (!sp) return;
    const barX = 16;
    const barY = 116; // BOSS HP 条（y=96, h=12）下方
    const barW = screenW - 32;
    const barH = 16;
    const progress = Math.max(0, Math.min(1, sp.progress));
    const eliteColor = "#FFD666";
    const freeColor = "#3B7FEF";
    const accent = sp.elite ? eliteColor : freeColor;

    ctx.save();
    // 背景
    ctx.fillStyle = "rgba(7,14,31,0.72)";
    roundRect(barX, barY, barW, barH, 8);
    ctx.fill();
    // 进度条填充
    const fillW = Math.max(0, (barW - 2) * progress);
    if (fillW > 0) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.85;
      roundRect(barX + 1, barY + 1, fillW, barH - 2, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 边框
    ctx.strokeStyle = withAlpha(accent, 0.6);
    ctx.lineWidth = 1;
    roundRect(barX, barY, barW, barH, 8);
    ctx.stroke();
    // 等级标签
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`SP Lv.${sp.level}${sp.elite ? " ★" : ""}`, barX + 6, barY + barH / 2);
    // 经验标签
    ctx.textAlign = "right";
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const expText = sp.gainedExp > 0
      ? `${Math.floor(sp.exp)}/${sp.expToNext}  +${sp.gainedExp}`
      : `${Math.floor(sp.exp)}/${sp.expToNext}`;
    ctx.fillText(expText, barX + barW - 6, barY + barH / 2);
    ctx.restore();
  }

  /** v6 升级：口诀连招 HUD（连击下方） */
  private renderMantraChainHud(ctx: CanvasRenderingContext2D, screenW: number): void {
    const mc = this.hud?.mantraChain;
    if (!mc) return;
    // 已解锁口诀列表（紧凑显示）
    const unlocked = mc.unlockedMantras ?? [];
    if (unlocked.length === 0 && mc.combo < 2) return;

    const pillX = 16;
    const pillY = 144; // 赛季通行证条（y=116, h=16）下方
    const pillH = 18;
    ctx.save();
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // 已解锁口诀 pill
    let cx = pillX;
    if (unlocked.length > 0) {
      for (const mantra of unlocked) {
        const w = ctx.measureText(mantra).width + 14;
        ctx.fillStyle = "rgba(0,229,255,0.18)";
        ctx.strokeStyle = withAlpha("#00E5FF", 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 7, pillY);
        ctx.arcTo(cx + w, pillY, cx + w, pillY + pillH, 7);
        ctx.arcTo(cx + w, pillY + pillH, cx, pillY + pillH, 7);
        ctx.arcTo(cx, pillY + pillH, cx, pillY, 7);
        ctx.arcTo(cx, pillY, cx + w, pillY, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#00E5FF";
        ctx.fillText(mantra, cx + 7, pillY + pillH / 2);
        cx += w + 4;
        if (cx > screenW - 80) break;
      }
    }
    // 完整口诀已集齐标记
    if (mc.fullMantraUnlocked) {
      const mark = "★ 全口诀";
      const w = ctx.measureText(mark).width + 12;
      ctx.fillStyle = "rgba(255,214,102,0.22)";
      ctx.strokeStyle = withAlpha("#FFD666", 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 6, pillY);
      ctx.arcTo(cx + w, pillY, cx + w, pillY + pillH, 6);
      ctx.arcTo(cx + w, pillY + pillH, cx, pillY + pillH, 6);
      ctx.arcTo(cx, pillY + pillH, cx, pillY, 6);
      ctx.arcTo(cx, pillY, cx + w, pillY, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#FFD666";
      ctx.fillText(mark, cx + 6, pillY + pillH / 2);
    } else {
      // 下一档口诀提示
      const next = mc.nextMantra ?? "";
      if (next) {
        const remain = Math.max(0, (mc.nextThreshold ?? 0) - mc.combo);
        const hint = `→ ${next} (${remain})`;
        ctx.fillStyle = withAlpha("#FFD666", 0.85);
        ctx.fillText(hint, cx, pillY + pillH / 2);
      }
    }

    // 当前激活口诀（屏幕中央偏上飘字）
    if (mc.activeMantra) {
      const remain = mc.activeUntil ?? 0;
      const pulse = 0.5 + Math.sin(this.t * 8) * 0.5;
      ctx.font = `900 22px ${Theme.fonts.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 14 + pulse * 8;
      ctx.fillText(mc.activeMantra, screenW / 2, 184);
      ctx.shadowBlur = 0;
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha("#FFFFFF", 0.7);
      ctx.fillText(`×${remain.toFixed(1)}s`, screenW / 2, 204);
    }
    ctx.restore();
  }

  /** v6 升级：BOSS 组合弹幕警示标签 */
  private renderCombinedPatternsBadge(ctx: CanvasRenderingContext2D, screenW: number): void {
    const patterns = this.hud?.bossActiveCombinedPatterns;
    if (!patterns || patterns.length === 0) return;
    const labels: Record<string, string> = {
      crossFire: "交叉火力",
      ringBurst: "环形爆发",
      waveDash: "波浪冲刺",
      spread: "扇形散射",
      spiral: "螺旋弹幕",
      rain: "区域弹雨",
      beam: "集束光束",
      summon: "召唤小怪",
      homing: "追踪弹",
      laserSweep: "激光扫射",
    };
    const pillY = 224; // 口诀连招下方
    let cx = 16;
    const pillH = 16;
    ctx.save();
    ctx.font = `700 8px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    // 警示前缀
    const prefix = "⚠ 组合弹幕";
    const pw = ctx.measureText(prefix).width + 12;
    ctx.fillStyle = "rgba(255,0,229,0.20)";
    ctx.strokeStyle = withAlpha("#FF00E5", 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 6, pillY);
    ctx.arcTo(cx + pw, pillY, cx + pw, pillY + pillH, 6);
    ctx.arcTo(cx + pw, pillY + pillH, cx, pillY + pillH, 6);
    ctx.arcTo(cx, pillY + pillH, cx, pillY, 6);
    ctx.arcTo(cx, pillY, cx + pw, pillY, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#FF00E5";
    ctx.fillText(prefix, cx + 6, pillY + pillH / 2);
    cx += pw + 4;
    // 各模式标签
    for (const p of patterns) {
      const label = labels[p] ?? p;
      const w = ctx.measureText(label).width + 10;
      ctx.fillStyle = "rgba(255,122,26,0.18)";
      ctx.strokeStyle = withAlpha("#FF7A1A", 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 5, pillY);
      ctx.arcTo(cx + w, pillY, cx + w, pillY + pillH, 5);
      ctx.arcTo(cx + w, pillY + pillH, cx, pillY + pillH, 5);
      ctx.arcTo(cx, pillY + pillH, cx, pillY, 5);
      ctx.arcTo(cx, pillY, cx + w, pillY, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#FF7A1A";
      ctx.fillText(label, cx + 5, pillY + pillH / 2);
      cx += w + 3;
      if (cx > screenW - 60) break;
    }
    ctx.restore();
  }

  /** v6 升级：格挡按钮（左下角大招按钮上方） */
  private renderParryButton(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const parry = this.hud?.parry;
    if (!parry) return;
    const rect = this.getParryButtonRect(screenW, screenH);
    const ready = parry.cooldown <= 0;
    const perfect = parry.perfectWindow > 0;
    const accent = perfect ? "#00E5FF" : ready ? "#3B7FEF" : Theme.colors.bg.line;
    drawButton(ctx, rect.x, rect.y, rect.w, rect.h, "", {
      variant: "hard",
      accent,
      pressed: this.pressedParry,
    });
    ctx.save();
    // 完美格挡窗口高亮环
    if (perfect) {
      const pulse = 0.5 + Math.sin(this.t * 20) * 0.5;
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 12 + pulse * 8;
      ctx.beginPath();
      ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // 图标
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = ready ? 1 : 0.45;
    ctx.fillText("🛡️", rect.x + rect.w / 2, rect.y + rect.h / 2 - 6);
    ctx.globalAlpha = 1;
    // 标签
    ctx.font = `500 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = perfect ? "#00E5FF" : ready ? "#3B7FEF" : Theme.colors.ink.dim;
    ctx.fillText(perfect ? "完美!" : ready ? "格挡" : `${parry.cooldown.toFixed(1)}s`, rect.x + rect.w / 2, rect.y + rect.h - 12);
    ctx.restore();
  }

  /** v6 升级：超觉醒大招按钮（右下角反诈突击按钮上方） */
  private renderSuperAwakeningButton(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const sa = this.hud?.superAwakening;
    if (!sa) return;
    const rect = this.getSuperUltButtonRect(screenW, screenH);
    const ready = sa.ultimateReady;
    const accent = ready ? "#FF00E5" : Theme.colors.bg.line;
    drawButton(ctx, rect.x, rect.y, rect.w, rect.h, "", {
      variant: "hard",
      accent,
      pressed: this.pressedSuperUlt,
    });
    ctx.save();
    // 充能进度环
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.strokeStyle = ready ? "#FF00E5" : "#9B59FF";
    ctx.lineWidth = 3;
    ctx.shadowColor = ready ? "#FF00E5" : "#9B59FF";
    ctx.shadowBlur = ready ? 16 : 6;
    ctx.beginPath();
    ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (sa.ultimateCharge ?? 0));
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // 图标
    ctx.save();
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = ready ? 1 : 0.5;
    ctx.fillText(sa.emoji || "🌟", rect.x + rect.w / 2, rect.y + rect.h / 2 - 6);
    ctx.globalAlpha = 1;
    ctx.restore();
    // 标签
    ctx.save();
    ctx.font = `500 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = ready ? "#FF00E5" : Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = ready ? sa.ultimateName : `${Math.floor((sa.ultimateCharge ?? 0) * 100)}%`;
    // 截断过长标签
    const maxW = rect.w - 4;
    let displayLabel = label;
    if (ctx.measureText(label).width > maxW) {
      displayLabel = ready ? "大招" : label;
    }
    ctx.fillText(displayLabel, rect.x + rect.w / 2, rect.y + rect.h - 12);
    ctx.restore();
  }

  /** v6 升级：诈骗溯源档案解锁卡片（屏幕中央，使用本地缓存持续显示） */
  private renderFraudArchiveCard(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
    roundRect: (x: number, y: number, w: number, h: number, r: number) => void,
  ): void {
    const archive = this.localFraudArchive;
    if (!archive) return;
    const cardW = Math.min(340, screenW - 32);
    const cardH = 200;
    const cardX = (screenW - cardW) / 2;
    const cardY = (screenH - cardH) / 2;
    const pulse = 0.5 + Math.sin(this.t * 4) * 0.5;

    ctx.save();
    // 半透明遮罩
    ctx.fillStyle = "rgba(7,14,31,0.78)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 卡片背景
    ctx.fillStyle = "rgba(12,26,46,0.96)";
    roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = withAlpha("#00E5FF", 0.6 + pulse * 0.4);
    ctx.lineWidth = 1.5;
    roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.stroke();
    // 标题栏
    ctx.fillStyle = withAlpha("#00E5FF", 0.15);
    roundRect(cardX, cardY, cardW, 36, 12);
    ctx.fill();
    ctx.font = `900 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 8;
    ctx.fillText(`📁 诈骗溯源档案 · ${archive.title}`, cardX + cardW / 2, cardY + 18);
    ctx.shadowBlur = 0;
    // 元信息
    ctx.font = `600 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    const metaY = cardY + 48;
    ctx.fillText(`类型：${archive.fraudType}`, cardX + 12, metaY);
    ctx.fillText(`日期：${archive.date}`, cardX + 12, metaY + 14);
    ctx.textAlign = "right";
    ctx.fillText(`来源：${archive.source}`, cardX + cardW - 12, metaY);
    if (archive.targetGroup) {
      ctx.fillText(`高发：${archive.targetGroup}`, cardX + cardW - 12, metaY + 14);
    }
    // 案例简述
    ctx.textAlign = "left";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const storyLines = wrapText(ctx, archive.caseStory, cardW - 24);
    const storyStartY = cardY + 86;
    for (let i = 0; i < Math.min(2, storyLines.length); i++) {
      ctx.fillText(storyLines[i], cardX + 12, storyStartY + i * 14);
    }
    // 关键启示
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    const takeawayY = storyStartY + 32;
    const tkLines = wrapText(ctx, `💡 ${archive.takeaway}`, cardW - 24);
    for (let i = 0; i < Math.min(2, tkLines.length); i++) {
      ctx.fillText(tkLines[i], cardX + 12, takeawayY + i * 14);
    }
    // 底部关闭提示
    const closeY = cardY + cardH - 18;
    ctx.font = `600 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#00E5FF", 0.6 + pulse * 0.4);
    ctx.textAlign = "center";
    ctx.fillText("点击任意位置关闭", cardX + cardW / 2, closeY);
    ctx.restore();
  }

  /** v6 升级：BOSS AI 对话 overlay（底部弹窗） */
  private renderAIDialogOverlay(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
    roundRect: (x: number, y: number, w: number, h: number, r: number) => void,
  ): void {
    const dialog = this.hud?.bossAIDialog;
    if (!dialog) return;
    const showFeedback = this.aiDialogFeedbackT > 0 && dialog.lastFeedback;
    // 全屏半透明遮罩（对话激活时暂停游戏视觉，但不真正暂停引擎——对话期间仍可被攻击，需玩家快速决策）
    ctx.save();
    ctx.fillStyle = "rgba(7,14,31,0.65)";
    ctx.fillRect(0, 0, screenW, screenH);

    // 底部对话框
    const boxH = showFeedback ? 260 : 320;
    const boxW = screenW - 16;
    const boxX = 8;
    const boxY = screenH - boxH - 8;
    // 背景
    ctx.fillStyle = "rgba(12,26,46,0.97)";
    roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = withAlpha("#FF00E5", 0.7);
    ctx.lineWidth = 1.5;
    roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.stroke();

    // 标题栏
    ctx.fillStyle = withAlpha("#FF00E5", 0.15);
    roundRect(boxX, boxY, boxW, 32, 12);
    ctx.fill();
    ctx.font = `900 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FF00E5";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FF00E5";
    ctx.shadowBlur = 8;
    ctx.fillText(`⚠ ${dialog.dialogTitle}`, boxX + 12, boxY + 16);
    ctx.shadowBlur = 0;
    // 红旗等级 & 进度
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFD666";
    const rfText = `红旗 ${dialog.bustScore}/${dialog.passThreshold}  轮次 ${dialog.turnCount}/${dialog.maxTurns}`;
    ctx.fillText(rfText, boxX + boxW - 12, boxY + 16);

    // BOSS 台词区
    const lineY = boxY + 48;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#FFFFFF", 0.95);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const tacticTag = dialog.currentTactic ? `【${dialog.currentTactic}】` : "";
    const bossLine = `${tacticTag}${dialog.currentBossLine}`;
    const lines = wrapText(ctx, bossLine, boxW - 24);
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      ctx.fillText(lines[i], boxX + 12, lineY + i * 16);
    }
    // 红旗等级条
    const rfBarY = lineY + Math.min(4, lines.length) * 16 + 8;
    const rfBarW = boxW - 24;
    const rfBarH = 4;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(boxX + 12, rfBarY, rfBarW, rfBarH);
    const rfRatio = Math.min(1, dialog.currentRedFlag / 5);
    ctx.fillStyle = rfRatio >= 0.8 ? "#FF00E5" : rfRatio >= 0.5 ? "#FF7A1A" : "#FFD666";
    ctx.fillRect(boxX + 12, rfBarY, rfBarW * rfRatio, rfBarH);
    // 红旗等级文字
    ctx.font = `600 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`当前红旗等级 ${dialog.currentRedFlag}/5`, boxX + 12, rfBarY + 8);

    // 反馈区（揭示态）
    if (showFeedback) {
      const fbY = rfBarY + 24;
      ctx.fillStyle = "rgba(0,229,255,0.10)";
      roundRect(boxX + 8, fbY, boxW - 16, boxH - (fbY - boxY) - 12, 8);
      ctx.fill();
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#00E5FF";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("💡 识破反馈", boxX + 14, fbY + 8);
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const fbLines = wrapText(ctx, dialog.lastFeedback ?? "", boxW - 28);
      for (let i = 0; i < Math.min(5, fbLines.length); i++) {
        ctx.fillText(fbLines[i], boxX + 14, fbY + 26 + i * 14);
      }
    } else if (dialog.ended) {
      // 对话已结束：展示结局说明
      const endY = rfBarY + 24;
      const endingColor = dialog.ending === "busted" ? "#00E5FF" : dialog.ending === "scammed" ? "#FF00E5" : "#FFD666";
      ctx.fillStyle = withAlpha(endingColor, 0.12);
      roundRect(boxX + 8, endY, boxW - 16, boxH - (endY - boxY) - 12, 8);
      ctx.fill();
      ctx.font = `900 13px ${Theme.fonts.display}`;
      ctx.fillStyle = endingColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const endingTitle = dialog.ending === "busted" ? "✓ 识破成功" : dialog.ending === "scammed" ? "✗ 识破失败" : "⏱ 超时";
      ctx.fillText(endingTitle, boxX + boxW / 2, endY + 24);
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const endLines = wrapText(ctx, dialog.endingDesc ?? "", boxW - 28);
      for (let i = 0; i < Math.min(4, endLines.length); i++) {
        ctx.fillText(endLines[i], boxX + boxW / 2, endY + 50 + i * 14);
      }
    } else {
      // 选项列表
      const choicesY = rfBarY + 24;
      const choices: ThunderBossAIDialogChoice[] = dialog.currentChoices ?? [];
      const choiceH = 40;
      const choiceGap = 6;
      const choiceW = boxW - 16;
      choices.forEach((choice, idx) => {
        const cy = choicesY + idx * (choiceH + choiceGap);
        const pressed = this.pressedAIDialogChoiceIdx === idx;
        const verdictColor = choice.verdict === "right" ? "#00E5FF" : choice.verdict === "warn" ? "#FFD666" : choice.verdict === "wrong" ? "#FF00E5" : "#3B7FEF";
        // 选项背景
        ctx.fillStyle = pressed ? withAlpha(verdictColor, 0.28) : "rgba(255,255,255,0.06)";
        roundRect(boxX + 8, cy, choiceW, choiceH, 8);
        ctx.fill();
        ctx.strokeStyle = withAlpha(verdictColor, pressed ? 0.9 : 0.4);
        ctx.lineWidth = pressed ? 1.5 : 1;
        roundRect(boxX + 8, cy, choiceW, choiceH, 8);
        ctx.stroke();
        // 选项序号
        ctx.font = `900 12px ${Theme.fonts.mono}`;
        ctx.fillStyle = verdictColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`${idx + 1}.`, boxX + 16, cy + choiceH / 2);
        // 选项文本
        ctx.font = `400 11px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.DEFAULT;
        const choiceLines = wrapText(ctx, choice.text, choiceW - 36);
        ctx.fillText(choiceLines[0] ?? "", boxX + 32, cy + choiceH / 2);
        // 识破标记
        if (choice.bust) {
          ctx.font = `700 9px ${Theme.fonts.mono}`;
          ctx.fillStyle = "#00E5FF";
          ctx.textAlign = "right";
          ctx.fillText("✓ 识破", boxX + 8 + choiceW - 10, cy + choiceH / 2);
        }
      });
    }
    ctx.restore();
  }

  exit(): void {
    super.exit();
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.engineCanvas = null;
    this.resultOverlay = null;
  }
}
