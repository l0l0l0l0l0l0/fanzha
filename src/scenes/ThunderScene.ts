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
} from "@/games/thunder/types";
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
  private t = 0;

  // v2 升级：难度/模式选择状态
  private selectedDifficulty: Difficulty = "normal";
  private selectedMode: ThunderMode = "campaign";
  private showDifficultySelect = true;
  // v3 升级：分页选择（难度/角色/装备）
  private selectTab: "difficulty" | "character" | "equipment" = "difficulty";
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

    if (type === "start") {
      if (hitTest(x, y, bombBtn)) {
        this.pressedBomb = true;
        return true;
      }
      if (hitTest(x, y, ultBtn)) {
        this.pressedUltimate = true;
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
      if (this.pressedPause && hitTest(x, y, pauseBtn)) {
        this.engine?.pause();
        playSfx("click");
        vibrateShort();
      }
      this.pressedBomb = false;
      this.pressedUltimate = false;
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
    const btnW = 96;
    const gap = 8;
    const totalW = btnW * 3 + gap * 2;
    const startX = (screenW - totalW) / 2;
    return { x: startX + idx * (btnW + gap), y: 140, w: btnW, h: 32 };
  }

  private getStartButtonRect(screenW: number, screenH: number): Rect {
    const w = Math.min(240, screenW - 48);
    const h = 48;
    return { x: (screenW - w) / 2, y: screenH - 80, w, h };
  }

  private handleDifficultyTouch(type: "start" | "move" | "end", x: number, y: number, screenW: number, screenH: number): boolean {
    if (type === "start") {
      // v3 升级：Tab 切换（优先处理）
      const tabIds: typeof this.selectTab[] = ["difficulty", "character", "equipment"];
      for (let i = 0; i < tabIds.length; i++) {
        if (hitTest(x, y, this.getSelectTabRect(i, screenW))) {
          this.pressedTabIdx = i;
          return true;
        }
      }
      // 各 Tab 内容
      if (this.selectTab === "difficulty") {
        // 难度卡片
        for (let i = 0; i < DIFFICULTY_LIST.length; i++) {
          if (hitTest(x, y, this.getDifficultyCardRect(i, screenW, screenH))) {
            this.pressedDifficultyIdx = i;
            this.selectedDifficulty = DIFFICULTY_LIST[i].id;
            playSfx("click");
            return true;
          }
        }
        // 模式按钮
        const modes: ThunderMode[] = ["campaign", "endless", "daily"];
        for (let i = 0; i < modes.length; i++) {
          if (hitTest(x, y, this.getModeButtonRect(i, screenW))) {
            this.selectedMode = modes[i];
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
      }
      // 开始按钮
      if (hitTest(x, y, this.getStartButtonRect(screenW, screenH))) {
        return true;
      }
      return true;
    } else if (type === "end") {
      // v3 升级：Tab 切换确认
      if (this.pressedTabIdx !== null) {
        const tabIds: typeof this.selectTab[] = ["difficulty", "character", "equipment"];
        if (hitTest(x, y, this.getSelectTabRect(this.pressedTabIdx, screenW))) {
          this.selectTab = tabIds[this.pressedTabIdx];
          playSfx("click");
          vibrateShort();
        }
        this.pressedTabIdx = null;
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
    } else {
      this.renderEquipmentTab(ctx, screenW, screenH);
    }

    // 开始按钮
    const startBtn = this.getStartButtonRect(screenW, screenH);
    drawButton(ctx, startBtn.x, startBtn.y, startBtn.w, startBtn.h, "开始作战", {
      variant: "hard",
      accent: "#FF00E5",
    });
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.fillText("操作：方向键移动 · 空格蓄力 · 双击方向键闪避", screenW / 2, screenH - 24);
    ctx.restore();
  }

  /** v3 升级：分页 Tab 栏渲染 */
  private renderSelectTabs(ctx: CanvasRenderingContext2D, screenW: number): void {
    const tabs: { id: typeof this.selectTab; label: string; emoji: string }[] = [
      { id: "difficulty", label: "难度", emoji: "🎯" },
      { id: "character", label: "角色", emoji: "🚔" },
      { id: "equipment", label: "装备", emoji: "⚙" },
    ];
    const tabW = 96;
    const gap = 8;
    const totalW = tabW * 3 + gap * 2;
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
    const tabW = 96;
    const gap = 8;
    const totalW = tabW * 3 + gap * 2;
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

    // 模式按钮
    const modes: ThunderMode[] = ["campaign", "endless", "daily"];
    const modeLabels: Record<ThunderMode, string> = { campaign: "战役", endless: "无尽", daily: "每日" };
    for (let i = 0; i < modes.length; i++) {
      const rect = this.getModeButtonRect(i, screenW);
      const selected = this.selectedMode === modes[i];
      drawButton(ctx, rect.x, rect.y, rect.w, rect.h, modeLabels[modes[i]], {
        variant: "hard",
        accent: selected ? "#00E5FF" : Theme.colors.bg.line,
        pressed: selected,
      });
    }

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

  exit(): void {
    super.exit();
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.engineCanvas = null;
    this.resultOverlay = null;
  }
}
