import { GameEngine } from "@/engine/GameEngine";
import { ParticleSystem } from "@/engine/Particle";
import { postFX } from "@/engine/PostFX";
import { playSfx, startBGM } from "@/engine/Audio";
import type { GameCanvas } from "@/platform/web";
import {
  clamp,
  clearCanvas,
  drawText,
  roundRect,
  drawGrid,
  clipPath,
} from "@/engine/Renderer";
import { Theme } from "@/ui/Theme";
import type { GameEvent, GameResultPayload } from "@/types";
import { randomTip } from "@/data/tips";
import {
  AGENTS, ENEMIES, WAVES, getAgent,
  BOSS_RUSH_BOSSES, endlessScaling,
  TIME_TRIAL_SPAWN, TIME_TRIAL_DURATION, TIME_TRIAL_SCORE_MUL,
  MODE_META, UPGRADE_XP_THRESHOLD, UPGRADE_MAX_COUNT, UPGRADE_CHOICES,
  pickUpgradeChoices,
  LEVELS, MAX_LEVEL, CULT_AGENTS, CULT_AGENT_MAX_LEVEL,
  CULT_UPGRADE_COST, CULT_AGENT_SLOT_X, CULT_AGENT_SLOT_Y, generateWave,
  ELEMENTS, elementMul, COMBO_CONFIG, comboMul,
  dailyModifiersForSeed, dailyScoreMul, bossPhaseIndex, applyBossPhase,
  FRAUD_TERMS,
  // v6：全面升级新增数据/函数
  TACTICAL_DEVICES, SKILL_LINKS, ELEMENT_REACTIONS, QUIZ_BANK,
  TALENT_TREES, RELICS, EQUIPMENT, AGENT_SKINS, CHALLENGE_AFFIXES,
  getTowerFloor, seasonRankFromScore, activeSkillLinks, pickQuiz,
  detectElementReactions, getTalentTree, getRelic, getEquipment,
  TOWER_MAX_FLOOR,
} from "./data";
// v7：全面升级新增
import { pickAdaptiveQuiz, getTermsForBossKill, getTermsForTowerFloor, getTermsForTotalKills, TOWER_EVENTS, getCaseById } from "./data.v7";
import type {
  DeploySlot, ManagerHud, ManagerMode, BossRushDef, AgentUpgradeKind,
  CultAgentState, ComboState, DailyModifier, Element,
  EnemyDef, AgentDef, LevelTheme, UpgradeChoice,
  // v6：全面升级新增类型
  TacticalDeviceKind, TacticalDeviceDef, SkillLink, ElementReactionDef, QuizQuestion,
  TalentTree, RelicDef, EquipmentDef, AgentSkin, TalentBranch,
  ElementReactionKind, ChallengeAffix,
  // v7：爬塔事件
  TowerEventDef, TowerEventOutcome,
} from "./types";
import { platformStore } from "@/store/platformStore";
import {
  type MazeDef, type Pt, STATIC_MAZES, getInitialMaze, getLevelMaze, remapSlotsToMaze,
  cellCenter, pickRandomPath, MAZE_CELL, MAZE_COLS, MAZE_ROWS, MAZE_OFFSET_X, MAZE_OFFSET_Y,
  cellTerm, MAZE_TERMS,
} from "./maze";

const W = 960;
const H = 540;
const ACCENT = "#FFB020";

/** v4：旧版直线车道常量已废弃，所有位置由迷宫网格决定 */

interface DeployedAgent {
  id: string;
  def: AgentDef;
  row: number;
  col: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  cooldown: number;
  flashUntil: number;
  // ===== v6 全面升级新增 =====
  /** 临时护盾到期时间（shieldWall 大招 / 装备） */
  shieldUntil?: number;
  /** 临时护盾数值 */
  shieldValue?: number;
  /** 无敌到期时间（steam 元素反应 / 召唤体） */
  invulnUntil?: number;
  /** 召唤体到期时间（summon 大招，到期后移除） */
  summonUntil?: number;
  /** 暴击率加成（天赋/装备） */
  bonusCritRate?: number;
  /** 暴击伤害加成（天赋/装备） */
  bonusCritDmg?: number;
  /** 元素伤害加成表（天赋 elementBonus） */
  bonusElementDmg?: Partial<Record<Element, number>>;
  /** 大招充能倍率（天赋 ultChargeMul） */
  ultChargeMul?: number;
  /** 大招威力倍率（天赋 ultPowerMul） */
  ultPowerMul?: number;
}

interface Enemy {
  uid: number;
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  slowUntil: number;
  /** v4：当前目标航点索引（沿 maze.waypoints 前进）；保留作为兜底/进度估算 */
  pathIdx: number;
  /** v5：本敌人专属路径（生成时由 pickRandomPath 抽取） */
  myWaypoints: Pt[];
  /** v5：本敌人专属路径当前航点索引 */
  myPathIdx: number;
  wobble: number;
  radius: number;
  bossRef?: BossRushDef;
  enraged?: boolean;
  summonTimer?: number;
  /** v3: 护盾是否已消耗（shield 技能） */
  shieldConsumed?: boolean;
  /** v3: BOSS 当前阶段索引 */
  bossPhaseIdx?: number;
  /** v3: BOSS 每秒回血（healSelf 阶段） */
  bossHealPerSec?: number;
  /** v3: BOSS 伤害减免（shield 阶段） */
  bossDmgReduction?: number;
  /** v7: 受击白闪时间戳（命中反馈爽感） */
  hitFlashUntil?: number;
  // ===== v6 全面升级新增 =====
  /** 隐身到期时间（invisible 能力，期间无法被攻击） */
  invisibleUntil?: number;
  /** 上次瞬移时间（teleport 能力） */
  lastTeleportAt?: number;
  /** 反射伤害比例（reflect 能力） */
  reflectPct?: number;
  /** 狂暴叠加层数（enrage 能力） */
  enrageStacks?: number;
  /** 冻结到期时间（freeze 大招，期间无法移动） */
  frozenUntil?: number;
}

interface Projectile {
  x: number;
  y: number;
  tx: number;
  ty: number;
  target: Enemy | null;
  speed: number;
  damage: number;
  color: string;
  splash: number;
  life: number;
  /** v3: 拖尾轨迹点 */
  trail: { x: number; y: number; life: number }[];
  /** v3: 发射者元素（用于命中时计算克制） */
  element: Element;
  /** v3: 发射者 id（用于熟练度统计） */
  agentId: string;
  /** v4：是否暴击（用于视觉） */
  crit: boolean;
  /** v5：穿透弹剩余穿透次数（pierce 升级） */
  pierceLeft: number;
  /** v5：吸血来源探员位置（用于 vampire 升级回血定位） */
  fromX: number;
  fromY: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export class ManagerEngine extends GameEngine {
  private particles = new ParticleSystem();
  private base = { hp: 100, max: 100 };
  private wave = 0;
  private score = 0;
  private energy = 0;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private floats: FloatingText[] = [];
  private agents: DeployedAgent[] = [];
  private spawnQueue: { typeId: string; lane: number; at: number; spawned: boolean }[] = [];
  private waveActive = false;
  private prepUntil = 0;
  private t = 0;
  private slowUntil = 0;
  private ultFlashUntil = 0;
  private shakeUntil = 0;
  /** v5：BOSS 击杀慢动作（剩余秒数，期间游戏 dt 缩放至 0.35） */
  private slowmoUntil = 0;
  private over = false;
  private result: GameResultPayload | null = null;
  private uidSeq = 1;
  private startedAt = 0;
  private bustedCount = 0;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;

  /** 模式相关字段 */
  private mode: ManagerMode;
  private modeLabel: string;
  private timeLeft = 0;
  private trialStartT = 0;
  private trialSpawnDone = false;
  private bossIdx = 0;
  private currentBoss: BossRushDef | null = null;
  private endlessAbsWave = 0;

  /** 探员升级系统 */
  private upgradeXp = 0;
  private upgradeCount = 0;
  private upgrades: AgentUpgradeKind[] = [];
  private upgradeReady = false;
  /** v4：当前升级可选的 3 个随机选项 */
  private currentUpgradeChoices: UpgradeChoice[] = [];

  /** 关卡系统 */
  private level = 1;
  private maxLevel = MAX_LEVEL;
  private levelTransitionUntil = 0;

  /** v4：迷宫地图（单入口 → 单出口） */
  private maze: MazeDef;

  /** 养成探员 */
  private cultAgents: CultAgentState[] = CULT_AGENTS.map((def, i) => ({
    id: def.id,
    def,
    level: 1,
    maxLevel: CULT_AGENT_MAX_LEVEL,
    unlocked: i === 0,
    x: CULT_AGENT_SLOT_X[i],
    y: CULT_AGENT_SLOT_Y,
  }));

  // ===== v3 新增字段 =====
  /** 连击状态 */
  private combo: ComboState = {
    count: 0,
    lastKillAt: 0,
    multiplier: 1,
    maxCount: 0,
    decaySec: COMBO_CONFIG.decaySec,
  };
  /** 每日挑战修饰符 */
  private dailyModifiers: DailyModifier[] = [];
  /** 每日种子（YYYY-MM-DD） */
  private dailySeed = "";
  /** BOSS 当前阶段名称 */
  private bossPhaseName = "";
  /** 暴击 buff（critBuff 大招） */
  private critBuffUntil = 0;
  private critBuffRate = 0;
  private critBuffDmgMul = 1;
  /** 受伤加深（slowAll 大招） */
  private vulnUntil = 0;
  private vulnMul = 1;
  /** 基地护盾（healShield 大招） */
  private baseShield = 0;
  /** 本局各探员击杀统计（用于持久化） */
  private killsByAgent: Record<string, number> = {};
  /** 本局击杀 BOSS 次数（用于持久化） */
  private bossKillsThisGame = 0;
  /** v7：本局最后击破的 BOSS id（用于结算页真实案例展示） */
  private lastDefeatedBossId: string | null = null;
  /** v7：本局新收集的口诀索引列表（仅 collectTerm 返回 true 时追加，用于战报分享） */
  private newlyCollectedTerms: number[] = [];
  /** 元素克制提示（最近一次） */
  private lastElementalHint: { kind: "strong" | "weak"; from: string; to: string; at: number } | null = null;
  /** 大招使用次数（用于成就统计） */
  private ultCount = 0;

  // ===== v6 全面升级：Phase 2.1 战术装置 + 战术暂停 + 元素反应 =====
  /** 已放置的战术装置列表 */
  private tacticalDevices: { kind: TacticalDeviceKind; x: number; y: number; placedAt: number; cooldownUntil: number }[] = [];
  /** 各装置冷却截止时间（按 kind 索引） */
  private deviceCooldowns: Record<TacticalDeviceKind, number> = { barrier: 0, decoy: 0, emp: 0 };
  /** 战术暂停剩余次数（每局 1 次） */
  private tacticalPauseRemaining = 1;
  /** 战术暂停截止时间（期间游戏 dt × 0.3） */
  private tacticalPauseUntil = 0;
  /** 已激活的元素反应列表 */
  private elementReactions: { def: ElementReactionDef; activatedAt: number; x: number; y: number }[] = [];

  // ===== v6 全面升级：Phase 2.2 技能链 + 战间答题 =====
  /** 当前激活的技能链状态（部署探员组合满足时初始化） */
  private activeSkillLinkStates: { link: SkillLink; lastTriggeredAt: number }[] = [];
  /** 待答的战间答题（null 表示无） */
  private pendingQuiz: QuizQuestion | null = null;
  /** v7：当前待答题目是否为错题重练（用于 UI 高亮） */
  private pendingQuizIsRetry = false;
  /** v7：爬塔待处理的事件（null 表示无，tower 模式每 5 层触发） */
  private pendingTowerEvent: TowerEventDef | null = null;
  /** 答题 buff 截止时间 */
  private quizBuffUntil = 0;
  /** 答题 buff 内容（攻击加成） */
  private quizBuff: { attackPct: number } | null = null;
  /** 本局答对题数（用于持久化） */
  private quizCorrectCount = 0;

  // ===== v6 全面升级：Phase 2.3 天赋/遗物/装备 =====
  /** 当前装备的遗物 id 列表（从元进度读取） */
  private equippedRelics: string[] = [];
  /** 探员装备映射（agentId → equipmentId） */
  private agentEquipmentMap: Record<string, string> = {};
  /** 探员天赋映射（agentId → branch → 已解锁层级） */
  private agentTalentsMap: Record<string, Partial<Record<TalentBranch, number>>> = {};
  /** 探员皮肤映射（agentId → skinId） */
  private agentSkinsMap: Record<string, string> = {};
  /** 能量回复倍率（遗物 energyRegenMul） */
  private energyRegenMul = 1;
  /** 得分倍率（遗物 scoreMul） */
  private scoreMul = 1;
  /** 金币掉落倍率（遗物 coinMul） */
  private coinMul = 1;
  /** 探员每秒回血（遗物 agentHpRegen） */
  private agentHpRegen = 0;
  /** 连击衰减延长秒数（遗物 comboDecayExtend） */
  private comboDecayExtend = 0;
  /** 投射物是否穿透所有敌人（遗物 pierceAll） */
  private pierceAll = false;
  /** 首次命中免疫标记（遗物 firstHitFree） */
  private firstHitFreeConsumed = false;
  /** 复活是否可用（遗物 reviveOnce） */
  private reviveOnceAvailable = false;
  /** 全队伤害加成截止时间（元素反应 resonance / 技能链 buff） */
  private damageBoostUntil = 0;
  private damageBoostMul = 1;
  /** 时间扭曲截止时间（timeWarp 大招，期间 gdt × 0.5） */
  private timeWarpUntil = 0;
  /** 当前爬塔层数（tower 模式，默认 0） */
  private towerFloor = 0;
  /** 当前激活的极限词缀 */
  private challengeAffixes: ChallengeAffix[] = [];
  /** 额外升级次数上限（由遗物 extraUpgrade 提供） */
  private upgradeMaxCountBonus = 0;

  constructor(
    canvas: GameCanvas,
    deployment: DeploySlot[],
    mode: ManagerMode = "classic",
    maze?: MazeDef,
  ) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    this.startedAt = performance.now();
    this.mode = mode;
    this.modeLabel = MODE_META[mode].label;

    // v4：初始化迷宫（按模式/关卡选取）
    const seed = `${Date.now()}-${Math.random()}`;
    this.maze = maze ?? getInitialMaze(mode, this.level, seed);

    // v6：读取跨局元进度（天赋/遗物/装备/皮肤），在 placeAgents 前完成以便应用加成
    this.initMetaProgression();

    this.placeAgents(deployment);
    startBGM("battle");

    if (mode === "bossRush") {
      this.base.max = 150;
      this.base.hp = 150;
      this.startBossWave(0, 2);
    } else if (mode === "timeTrial") {
      this.timeLeft = TIME_TRIAL_DURATION;
      this.trialStartT = this.t;
      this.waveActive = true;
      this.prepUntil = 0;
      this.buildTrialSpawnQueue();
    } else if (mode === "endlessRush") {
      this.startEndlessWave(0, 1.5);
    } else if (mode === "tower") {
      // v7：爬塔模式 — 从第 1 层开始
      this.base.max = 200;
      this.base.hp = 200;
      this.startTowerFloor(1, 2);
    } else if (mode === "daily") {
      // 每日挑战：生成确定性修饰符 + 使用 classic 波次结构
      this.dailySeed = this.getDailySeed();
      this.dailyModifiers = dailyModifiersForSeed(this.dailySeed);
      // instantUlt 修饰符：开局满能量
      if (this.hasModifier("instantUlt")) this.energy = 100;
      // timeLimit 修饰符：设置倒计时
      const tl = this.getModifierEffect<{ kind: "timeLimit"; sec: number }>("timeLimit");
      if (tl) this.timeLeft = tl.sec;
      this.startWave(0, 2);
    } else {
      this.startWave(0, 1.5);
    }
  }

  // ====================================================================
  // v6：跨局元进度初始化（天赋/遗物/装备/皮肤 + 遗物开局效果）
  // ====================================================================

  /** 读取 platformStore 元进度，应用遗物开局效果与运行时倍率 */
  private initMetaProgression(): void {
    const meta = platformStore.managerMetaProgress();
    this.equippedRelics = meta.equippedRelics ?? [];
    this.agentEquipmentMap = meta.agentEquipment ?? {};
    this.agentTalentsMap = meta.agentTalents ?? {};
    this.agentSkinsMap = meta.agentSkins ?? {};
    this.towerFloor = meta.towerFloor ?? 0;

    // 遗物开局效果 + 运行时倍率
    let startEnergy = 0;
    let startShield = 0;
    let extraUpgrade = 0;
    for (const relicId of this.equippedRelics) {
      const relic = getRelic(relicId);
      if (!relic) continue;
      const eff = relic.effect;
      switch (eff.kind) {
        case "startEnergy": startEnergy += eff.value; break;
        case "startShield": startShield = Math.max(startShield, eff.value); break;
        case "extraUpgrade": extraUpgrade += eff.value; break;
        case "energyRegenMul": this.energyRegenMul *= eff.value; break;
        case "scoreMul": this.scoreMul *= eff.value; break;
        case "coinMul": this.coinMul *= eff.value; break;
        case "agentHpRegen": this.agentHpRegen += eff.value; break;
        case "comboDecayExtend": this.comboDecayExtend += eff.value; break;
        case "pierceAll": this.pierceAll = true; break;
        case "firstHitFree": this.firstHitFreeConsumed = false; break;
        case "reviveOnce": this.reviveOnceAvailable = true; break;
        default: break;
      }
    }
    // 应用开局能量
    if (startEnergy > 0) this.energy = Math.max(this.energy, Math.min(100, startEnergy));
    // 应用开局基地护盾
    if (startShield > 0) this.baseShield = Math.max(this.baseShield, this.base.max * startShield);
    // 应用额外升级次数（扩展 upgradeMax 上限）
    if (extraUpgrade > 0) this.upgradeMaxCountBonus = extraUpgrade;
    // 连击衰减延长
    if (this.comboDecayExtend > 0) {
      this.combo.decaySec = COMBO_CONFIG.decaySec + this.comboDecayExtend;
    }
  }

  // ====================================================================
  // v3：每日挑战辅助方法
  // ====================================================================

  private getDailySeed(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private hasModifier(id: string): boolean {
    return this.dailyModifiers.some((m) => m.id === id);
  }

  private getModifierEffect<T extends DailyModifier["effect"]>(kind: string): T | null {
    const m = this.dailyModifiers.find((m) => m.effect.kind === kind);
    return m ? (m.effect as T) : null;
  }

  // ====================================================================
  // 限时挑战刷怪队列
  // ====================================================================

  private buildTrialSpawnQueue(): void {
    this.spawnQueue = TIME_TRIAL_SPAWN.map((s) => ({
      typeId: s.typeId,
      lane: s.lane,
      at: this.trialStartT + s.at,
      spawned: false,
    }));
    this.trialSpawnDone = false;
  }

  // ====================================================================
  // 波次管理
  // ====================================================================

  private startBossWave(idx: number, prepSec: number): void {
    this.wave = idx;
    this.bossIdx = idx;
    this.waveActive = false;
    this.prepUntil = this.t + prepSec;
    const boss = BOSS_RUSH_BOSSES[idx];
    if (!boss) return;
    this.currentBoss = boss;
    this.bossPhaseName = "";
    this.spawnQueue = [{
      typeId: `__boss__:${boss.id}`,
      lane: 1,
      at: this.prepUntil,
      spawned: false,
    }];
    this.toast = {
      text: `BOSS ${idx + 1}/${BOSS_RUSH_BOSSES.length}：${boss.name} — ${boss.skillDesc}`,
      tone: "bad",
      until: this.t + 3,
    };
    // v7：BOSS 来袭 —— 保留 flash（关键事件）+ 粒子警示，移除 glitch 避免叠加
    postFX.flash("#E5353B", 0.35, 1.8);
    this.particles.spawnBurst(W / 2, H / 2, "#E5353B", { ring: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4 });
  }

  private startEndlessWave(absWave: number, prepSec: number): void {
    this.endlessAbsWave = absWave;
    this.wave = absWave % WAVES.length;
    this.waveActive = false;
    this.prepUntil = this.t + prepSec;
    const wave = WAVES[this.wave];
    if (!wave) return;
    this.spawnQueue = [];
    const fastWaves = this.mode === "daily" ? this.getModifierEffect<{ kind: "fastWaves"; mul: number }>("fastWaves")?.mul ?? 1 : 1;
    for (const entry of wave.enemies) {
      for (let i = 0; i < entry.count; i++) {
        this.spawnQueue.push({
          typeId: entry.typeId,
          lane: entry.lane,
          at: this.prepUntil + (entry.delay + i * entry.interval) * fastWaves,
          spawned: false,
        });
      }
    }
    if (absWave > 0) {
      const s = endlessScaling(absWave);
      this.toast = {
        text: `无尽反诈波次 ${absWave + 1} · TIER ${s.tier + 1} · 敌人 HP×${s.hpMul.toFixed(1)} 伤害×${s.dmgMul.toFixed(2)}`,
        tone: "info",
        until: this.t + 3,
      };
      // v6：移除每波 flash，改为顶部粒子提示
      this.particles.spawnBurst(W / 2, 40, "#B388FF", { ring: true, sparks: 10, dots: 12, speed: 180, life: 0.6, size: 3 });
    }
  }

  /** v4：按迷宫岗哨位部署探员（col/row 为网格坐标） */
  private placeAgents(deployment: DeploySlot[]): void {
    for (const slot of deployment) {
      if (!slot.agentId) continue;
      const def = getAgent(slot.agentId);
      if (!def) continue;
      const pt = cellCenter(slot.col, slot.row);
      // v6：创建 def 副本以应用天赋/装备加成（避免污染共享 AGENTS 定义）
      const effectiveDef: AgentDef = { ...def };
      const agent: DeployedAgent = {
        id: slot.agentId,
        def: effectiveDef,
        row: slot.row,
        col: slot.col,
        x: pt.x,
        y: pt.y,
        hp: effectiveDef.hp,
        maxHp: effectiveDef.hp,
        alive: true,
        cooldown: 0,
        flashUntil: 0,
      };
      // v6：应用天赋树 + 装备效果（修改 effectiveDef 与 agent 加成字段）
      this.applyAgentProgression(agent);
      this.agents.push(agent);
    }

    // v6：初始化技能链（基于已部署探员组合）
    const deployedIds = this.agents.map((a) => a.id);
    const links = activeSkillLinks(deployedIds);
    this.activeSkillLinkStates = links.map((link) => ({ link, lastTriggeredAt: -Infinity }));
    // onDeploy 触发：部署时立即触发一次
    for (const state of this.activeSkillLinkStates) {
      if (state.link.trigger.kind === "onDeploy") {
        this.triggerSkillLink(state);
      }
    }
  }

  // ====================================================================
  // v6：天赋树 + 装备效果应用
  // ====================================================================

  /** 对单个探员应用已解锁层级的天赋效果 + 装备效果 */
  private applyAgentProgression(agent: DeployedAgent): void {
    const def = agent.def;
    let attackFlat = 0;
    let attackPct = 0;
    let hpFlat = 0;
    let hpPct = 0;
    let rangePct = 0;
    let fireratePct = 0;
    let bonusCritRate = 0;
    let bonusCritDmg = 0;
    const bonusElementDmg: Partial<Record<Element, number>> = {};
    let ultChargeMul = 1;
    let ultPowerMul = 1;

    // 天赋树：遍历已解锁层级
    const talents = this.agentTalentsMap[agent.id];
    if (talents) {
      const tree = getTalentTree(agent.id);
      if (tree) {
        for (const branch of ["offense", "defense", "support"] as TalentBranch[]) {
          const unlockedTier = talents[branch] ?? 0;
          if (unlockedTier <= 0) continue;
          const nodes = tree.branches[branch];
          for (const node of nodes) {
            if (node.tier > unlockedTier) break;
            this.applyTalentEffect(node.effect, {
              addAttackFlat: (v) => { attackFlat += v; },
              addAttackPct: (v) => { attackPct += v; },
              addHpFlat: (v) => { hpFlat += v; },
              addHpPct: (v) => { hpPct += v; },
              addRangePct: (v) => { rangePct += v; },
              addFireratePct: (v) => { fireratePct += v; },
              addCritRate: (v) => { bonusCritRate += v; },
              addCritDmg: (v) => { bonusCritDmg += v; },
              addElementBonus: (el, v) => { bonusElementDmg[el] = (bonusElementDmg[el] ?? 0) + v; },
              mulUltCharge: (v) => { ultChargeMul *= v; },
              mulUltPower: (v) => { ultPowerMul *= v; },
            });
          }
        }
      }
    }

    // 装备效果
    const equipId = this.agentEquipmentMap[agent.id];
    if (equipId) {
      const equip = getEquipment(equipId);
      if (equip && (!equip.agentId || equip.agentId === agent.id)) {
        this.applyEquipmentEffect(equip.effect, {
          addAttackFlat: (v) => { attackFlat += v; },
          addAttackPct: (v) => { attackPct += v; },
          addHpFlat: (v) => { hpFlat += v; },
          addCritRate: (v) => { bonusCritRate += v; },
          addCritDmg: (v) => { bonusCritDmg += v; },
          addRangeFlat: (v) => { def.range = Math.max(0, def.range + v); },
          addFireratePct: (v) => { fireratePct += v; },
          addSplash: (v) => { def.splash = (def.splash ?? 0) + v; },
          addPierce: (v) => { void v; /* 装备穿透在 fireProjectile 中按需读取 */ },
          addLifesteal: (v) => { void v; /* 装备吸血暂不实现独立逻辑 */ },
          addSlowOnHit: (v, dur) => { void v; void dur; /* 装备减速命中暂不实现独立逻辑 */ },
        });
      }
    }

    // 汇总应用到 effectiveDef
    def.attack = Math.max(0, (def.attack + attackFlat) * (1 + attackPct));
    def.hp = Math.max(1, (def.hp + hpFlat) * (1 + hpPct));
    def.range = Math.max(0, def.range * (1 + rangePct));
    def.fireRate = Math.max(0.01, def.fireRate * (1 + fireratePct));
    agent.hp = def.hp;
    agent.maxHp = def.hp;
    if (bonusCritRate > 0) agent.bonusCritRate = bonusCritRate;
    if (bonusCritDmg > 0) agent.bonusCritDmg = bonusCritDmg;
    if (Object.keys(bonusElementDmg).length > 0) agent.bonusElementDmg = bonusElementDmg;
    if (ultChargeMul !== 1) agent.ultChargeMul = ultChargeMul;
    if (ultPowerMul !== 1) agent.ultPowerMul = ultPowerMul;
  }

  /** 天赋效果分发器 */
  private applyTalentEffect(
    eff: TalentTree["branches"]["offense"][number]["effect"],
    cb: {
      addAttackFlat: (v: number) => void;
      addAttackPct: (v: number) => void;
      addHpFlat: (v: number) => void;
      addHpPct: (v: number) => void;
      addRangePct: (v: number) => void;
      addFireratePct: (v: number) => void;
      addCritRate: (v: number) => void;
      addCritDmg: (v: number) => void;
      addElementBonus: (el: Element, v: number) => void;
      mulUltCharge: (v: number) => void;
      mulUltPower: (v: number) => void;
    },
  ): void {
    switch (eff.kind) {
      case "attackFlat": cb.addAttackFlat(eff.value); break;
      case "attackPct": cb.addAttackPct(eff.value); break;
      case "hpFlat": cb.addHpFlat(eff.value); break;
      case "hpPct": cb.addHpPct(eff.value); break;
      case "rangePct": cb.addRangePct(eff.value); break;
      case "fireratePct": cb.addFireratePct(eff.value); break;
      case "critRate": cb.addCritRate(eff.value); break;
      case "critDmg": cb.addCritDmg(eff.value); break;
      case "elementBonus": cb.addElementBonus(eff.element, eff.value); break;
      case "ultChargeMul": cb.mulUltCharge(eff.value); break;
      case "ultPowerMul": cb.mulUltPower(eff.value); break;
      case "cooldownReduce": break; // 战术装置冷却缩减在 placeTacticalDevice 中读取
    }
  }

  /** 装备效果分发器 */
  private applyEquipmentEffect(
    eff: EquipmentDef["effect"],
    cb: {
      addAttackFlat: (v: number) => void;
      addAttackPct: (v: number) => void;
      addHpFlat: (v: number) => void;
      addCritRate: (v: number) => void;
      addCritDmg: (v: number) => void;
      addRangeFlat: (v: number) => void;
      addFireratePct: (v: number) => void;
      addSplash: (v: number) => void;
      addPierce: (v: number) => void;
      addLifesteal: (v: number) => void;
      addSlowOnHit: (v: number, dur: number) => void;
    },
  ): void {
    switch (eff.kind) {
      case "attackFlat": cb.addAttackFlat(eff.value); break;
      case "attackPct": cb.addAttackPct(eff.value); break;
      case "hpFlat": cb.addHpFlat(eff.value); break;
      case "critRate": cb.addCritRate(eff.value); break;
      case "critDmg": cb.addCritDmg(eff.value); break;
      case "rangeFlat": cb.addRangeFlat(eff.value); break;
      case "fireratePct": cb.addFireratePct(eff.value); break;
      case "splash": cb.addSplash(eff.value); break;
      case "pierce": cb.addPierce(eff.value); break;
      case "lifesteal": cb.addLifesteal(eff.value); break;
      case "slowOnHit": cb.addSlowOnHit(eff.value, eff.duration); break;
    }
  }

  private startWave(waveIdx: number, prepSec: number): void {
    this.wave = waveIdx;
    this.waveActive = false;
    this.prepUntil = this.t + prepSec;
    const wave = this.mode === "classic" || this.mode === "daily"
      ? generateWave(LEVELS[this.level - 1], waveIdx + 1)
      : WAVES[waveIdx];
    if (!wave) return;
    this.spawnQueue = [];
    const fastWaves = this.mode === "daily" ? this.getModifierEffect<{ kind: "fastWaves"; mul: number }>("fastWaves")?.mul ?? 1 : 1;
    for (const entry of wave.enemies) {
      for (let i = 0; i < entry.count; i++) {
        this.spawnQueue.push({
          typeId: entry.typeId,
          lane: entry.lane,
          at: this.prepUntil + (entry.delay + i * entry.interval) * fastWaves,
          spawned: false,
        });
      }
    }
    if (waveIdx > 0 && this.t >= this.levelTransitionUntil) {
      this.toast = {
        text: `反诈波次 ${waveIdx + 1} 来袭：${wave.enemies
          .map((e) => ENEMIES[e.typeId]?.name ?? e.typeId)
          .join(" / ")}`,
        tone: "info",
        until: this.t + 3,
      };
      // v6：移除每波 flash（战斗中波次密集时累积闪屏），改为边缘粒子提示
      this.particles.spawnBurst(W / 2, 40, ACCENT, { ring: true, sparks: 10, dots: 12, speed: 180, life: 0.6, size: 3 });
    }
  }

  /**
   * v7：爬塔模式 — 启动指定楼层的波次
   * - BOSS 层（每 10 层）：生成楼层对应 BOSS
   * - 普通层：生成 1-3 波普通敌人（按楼层难度）
   */
  private startTowerFloor(floor: number, prepSec: number): void {
    this.towerFloor = floor;
    const tf = getTowerFloor(floor);
    this.wave = floor - 1;
    this.waveActive = false;
    this.prepUntil = this.t + prepSec;
    this.spawnQueue = [];

    if (tf.isBoss && tf.bossId) {
      // BOSS 层：复用 bossRush 的 BOSS 生成逻辑
      const boss = BOSS_RUSH_BOSSES.find((b) => b.id === tf.bossId);
      if (boss) {
        this.currentBoss = boss;
        this.bossPhaseName = "";
        this.spawnQueue.push({
          typeId: `__boss__:${boss.id}`,
          lane: 1,
          at: this.prepUntil,
          spawned: false,
        });
        this.toast = {
          text: `第 ${floor} 层 BOSS：${boss.name} — ${boss.skillDesc}`,
          tone: "bad",
          until: this.t + 3,
        };
        postFX.flash("#E5353B", 0.35, 1.8);
        this.particles.spawnBurst(W / 2, H / 2, "#E5353B", { ring: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4 });
      }
    } else {
      // 普通层：从 WAVES 池中取一波，应用楼层倍率（spawnEnemy 中处理）
      const waveIdx = (floor - 1) % WAVES.length;
      const wave = WAVES[waveIdx];
      if (wave) {
        for (const entry of wave.enemies) {
          for (let i = 0; i < entry.count; i++) {
            this.spawnQueue.push({
              typeId: entry.typeId,
              lane: entry.lane,
              at: this.prepUntil + (entry.delay + i * entry.interval),
              spawned: false,
            });
          }
        }
      }
      this.toast = {
        text: `第 ${floor} 层 · ${tf.name}`,
        tone: "info",
        until: this.t + 2.5,
      };
    }
  }

  /** v7：爬塔模式 — 楼层推进（波次清空后调用） */
  private advanceTowerFloor(): void {
    const nextFloor = this.towerFloor + 1;
    if (nextFloor > TOWER_MAX_FLOOR) {
      this.win();
      return;
    }
    const tf = getTowerFloor(nextFloor);
    // v7：每 5 层（非 BOSS 层）触发 Roguelike 事件
    if (tf.hasReward && !tf.isBoss) {
      const evt = TOWER_EVENTS.find((e) => e.floor === nextFloor);
      if (evt) {
        this.pendingTowerEvent = evt;
        this.emitHud();
        return; // 等待玩家选择后再推进
      }
    }
    // v7：检查楼层里程碑口诀解锁
    this.checkTermUnlocksForTowerFloor(nextFloor);
    this.startTowerFloor(nextFloor, 2);
  }

  /**
   * v7：爬塔事件 — 玩家选择选项后调用
   * 应用选项后果，清除 pendingTowerEvent，推进到下一层
   */
  resolveTowerEvent(optionId: string): void {
    const evt = this.pendingTowerEvent;
    if (!evt) return;
    const option = evt.options.find((o) => o.id === optionId);
    if (!option) return;

    // 记录选择到元进度
    platformStore.recordTowerEventChoice(evt.floor, optionId);

    // 应用后果
    this.applyTowerEventOutcome(option.outcome);

    // 清除事件状态
    this.pendingTowerEvent = null;

    // 推进到下一层
    const nextFloor = this.towerFloor + 1;
    if (nextFloor > TOWER_MAX_FLOOR) {
      this.win();
      return;
    }
    this.checkTermUnlocksForTowerFloor(nextFloor);
    this.startTowerFloor(nextFloor, 1.5);
    this.emitHud();
  }

  /** v7：应用爬塔事件后果 */
  private applyTowerEventOutcome(outcome: TowerEventOutcome): void {
    switch (outcome.kind) {
      case "coins":
        this.score += outcome.value;
        this.floats.push({
          x: W / 2, y: H / 2 - 40, text: `+${outcome.value} 金币`,
          color: "#FFD666", life: 1.5, maxLife: 1.5, size: 18,
        });
        break;
      case "intel":
        this.score += outcome.value * 20;
        this.floats.push({
          x: W / 2, y: H / 2 - 40, text: `+${outcome.value} 情报`,
          color: "#00E5FF", life: 1.5, maxLife: 1.5, size: 18,
        });
        break;
      case "hp":
        this.base.hp = Math.max(1, Math.min(this.base.max, this.base.hp + outcome.value));
        this.floats.push({
          x: W / 2, y: H / 2 - 40,
          text: outcome.value > 0 ? `+${outcome.value} 基地血量` : `${outcome.value} 基地血量`,
          color: outcome.value > 0 ? "#52C41A" : "#E5353B", life: 1.5, maxLife: 1.5, size: 18,
        });
        break;
      case "energy":
        this.energy = Math.min(100, this.energy + outcome.value);
        this.floats.push({
          x: W / 2, y: H / 2 - 40, text: `+${outcome.value} 能量`,
          color: "#FFB020", life: 1.5, maxLife: 1.5, size: 18,
        });
        break;
      case "score":
        this.score += outcome.value;
        this.floats.push({
          x: W / 2, y: H / 2 - 40, text: `+${outcome.value} 分`,
          color: "#FFD666", life: 1.5, maxLife: 1.5, size: 18,
        });
        break;
      case "relic": {
        const relic = getRelic(outcome.relicId);
        if (relic) {
          this.equippedRelics.push(relic.id);
          // 内联应用遗物效果（与 initMetaProgression 一致）
          const eff = relic.effect;
          switch (eff.kind) {
            case "startEnergy": this.energy = Math.min(100, this.energy + eff.value); break;
            case "startShield": this.baseShield = Math.max(this.baseShield, this.base.max * eff.value); break;
            case "extraUpgrade": this.upgradeMaxCountBonus += eff.value; break;
            case "energyRegenMul": this.energyRegenMul *= eff.value; break;
            case "scoreMul": this.scoreMul *= eff.value; break;
            case "coinMul": this.coinMul *= eff.value; break;
            case "agentHpRegen": this.agentHpRegen += eff.value; break;
            case "comboDecayExtend":
              this.comboDecayExtend += eff.value;
              this.combo.decaySec = COMBO_CONFIG.decaySec + this.comboDecayExtend;
              break;
            case "pierceAll": this.pierceAll = true; break;
            case "firstHitFree": this.firstHitFreeConsumed = false; break;
            case "reviveOnce": this.reviveOnceAvailable = true; break;
            default: break;
          }
          this.toast = { text: `获得遗物：${relic.name}`, tone: "good", until: this.t + 3 };
        }
        break;
      }
      case "codex":
        platformStore.unlockCodexEntry(outcome.codexId, "case");
        this.toast = { text: `图鉴解锁`, tone: "good", until: this.t + 2.5 };
        break;
      case "case": {
        const realCase = getCaseById(outcome.caseId);
        if (realCase) {
          platformStore.unlockCase(realCase.id);
          this.toast = { text: `案例解锁：${realCase.title}`, tone: "good", until: this.t + 3 };
        }
        break;
      }
      case "term": {
        if (platformStore.collectTerm(outcome.termIdx)) {
          const term = MAZE_TERMS[outcome.termIdx] ?? `口诀 ${outcome.termIdx}`;
          this.floats.push({
            x: W / 2, y: H / 2 - 60, text: `📜 收集口诀：${term}`,
            color: "#FFD666", life: 2.2, maxLife: 2.2, size: 16,
          });
        }
        break;
      }
      case "skip":
        // 无效果
        break;
    }
  }

  /** v4：关卡推进 —— 切换迷宫并重映射守卫岗哨位 */
  private advanceLevel(): void {
    this.level += 1;
    const newLevel = LEVELS[this.level - 1];
    const cultIdx = newLevel.unlockCultAgentIdx;
    const unlockedAgent = this.cultAgents[cultIdx];
    if (unlockedAgent) unlockedAgent.unlocked = true;

    // v4：切换到新关卡的迷宫
    this.maze = getLevelMaze(this.level);
    // v4：将现有守卫重映射到新迷宫最近的岗哨位
    const oldSlots: DeploySlot[] = this.agents.map((a) => ({
      col: a.col, row: a.row, agentId: a.id,
    }));
    const newSlots = remapSlotsToMaze(oldSlots, this.maze);
    // 更新探员坐标
    this.agents = [];
    for (const s of newSlots) {
      if (!s.agentId) continue;
      const def = getAgent(s.agentId);
      if (!def) continue;
      const pt = cellCenter(s.col, s.row);
      // 保留旧探员的 hp 状态
      const oldAgent = oldSlots.find((o) => o.agentId === s.agentId);
      const oldIdx = this.agents.length;
      void oldIdx;
      this.agents.push({
        id: s.agentId,
        def,
        row: s.row,
        col: s.col,
        x: pt.x,
        y: pt.y,
        hp: def.hp,
        maxHp: def.hp,
        alive: true,
        cooldown: 0,
        flashUntil: 0,
      });
    }

    const prepSec = 2.5;
    this.levelTransitionUntil = this.t + prepSec;

    // v7：关卡切换 —— 保留 flash（关键事件），强度略降
    postFX.flash(newLevel.accent, 0.5, 1.5);
    postFX.shake(8, 10);
    playSfx("phase");
    this.particles.spawnBurst(W / 2, H / 2, newLevel.accent, {
      shockwave: true, ring: true, sparks: 40, dots: 50,
      speed: 380, life: 1.3, size: 6, color2: "#FFD666",
    });
    this.particles.spawnText(W / 2, H / 2 - 40, `LEVEL ${this.level}`, newLevel.accent, { size: 32, life: 1.6 });
    this.particles.spawnText(W / 2, H / 2 + 10, newLevel.name, "#FFFFFF", { size: 20, life: 1.6 });
    this.particles.spawnText(W / 2, H / 2 + 50, this.maze.name, "#00E5FF", { size: 14, life: 1.6 });

    this.toast = {
      text: unlockedAgent
        ? `进入 ${newLevel.name}！${unlockedAgent.def.name} 已加入 · ${this.maze.name}`
        : `进入 ${newLevel.name}！${this.maze.name}`,
      tone: "good",
      until: this.t + 3,
    };

    this.startWave(this.wave + 1, prepSec);
  }

  // ====================================================================
  // 养成探员升级
  // ====================================================================

  upgradeCultAgent(id: string): void {
    const agent = this.cultAgents.find((c) => c.id === id);
    if (!agent || !agent.unlocked || agent.level >= agent.maxLevel) return;
    const costIdx = agent.level - 1;
    const cost = CULT_UPGRADE_COST[costIdx] ?? Infinity;
    if (this.score < cost) return;
    this.score -= cost;
    agent.level += 1;
    // v7：养成探员升级 —— 保留 flash（关键事件）
    postFX.flash(agent.def.color, 0.35, 1.8);
    playSfx("weaponUp");
    this.particles.spawnBurst(agent.x, agent.y, agent.def.color, {
      ring: true, sparks: 16, dots: 20, speed: 240, life: 0.8, size: 4, color2: "#FFD666",
    });
    this.particles.spawnText(agent.x, agent.y - 30, `LV ${agent.level}`, agent.def.color, { size: 18, life: 1.0 });
    this.toast = {
      text: `${agent.def.emoji} ${agent.def.name} 升级至 LV ${agent.level}！`,
      tone: "good",
      until: this.t + 2.5,
    };
    this.emitHud();
  }

  private tryCultUpgrade(): void {
    // noUpgrades 修饰符：禁用升级
    if (this.mode === "daily" && this.hasModifier("noUpgrades")) return;
    let target: CultAgentState | null = null;
    for (const c of this.cultAgents) {
      if (!c.unlocked || c.level >= c.maxLevel) continue;
      if (!target || c.level < target.level) {
        target = c;
      }
    }
    if (!target) return;
    const costIdx = target.level - 1;
    const cost = CULT_UPGRADE_COST[costIdx] ?? Infinity;
    if (this.score >= cost) {
      this.upgradeCultAgent(target.id);
    }
  }

  // ====================================================================
  // 敌人生成（v5：每个敌人从分支图迷宫抽取独立路径）
  // ====================================================================

  /**
   * v5：为本敌人抽取一条 entrance→exit 的随机路径并转为像素航点
   * - 调用 maze.ts 的 pickRandomPath，敌人在岔路口会走不同的分支
   * - 首个航点是入口（敌人初始位置），后续航点为目标
   * - 失败时回退到 maze.waypoints（兼容保护）
   */
  private pickEnemyWaypoints(): { wps: Pt[]; startIdx: number } {
    const cells = pickRandomPath(this.maze, Math.random);
    if (cells.length >= 2) {
      const wps: Pt[] = cells.map((c) => cellCenter(c.col, c.row));
      return { wps, startIdx: 1 };
    }
    // 回退：用 maze.waypoints
    return { wps: this.maze.waypoints, startIdx: 1 };
  }

  /** v5：从指定 x 位置起，找到路径上最接近该 x 的航点索引（用于 BOSS 召唤小怪） */
  private nearestWaypointIdx(wps: Pt[], x: number, y: number): number {
    let nearestIdx = 1;
    let nearestDist = Infinity;
    for (let i = 1; i < wps.length; i++) {
      const wp = wps[i];
      const d = Math.hypot(wp.x - x, wp.y - y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    return nearestIdx;
  }

  private spawnEnemy(typeId: string, lane: number): void {
    void lane; // v4：lane 字段保留兼容但不再使用，所有敌人从迷宫入口进入
    if (typeId.startsWith("__boss__:")) {
      const bossId = typeId.split(":")[1];
      const boss = BOSS_RUSH_BOSSES.find((b) => b.id === bossId);
      if (!boss) return;
      const radius = 20 * boss.scale;
      const { wps, startIdx } = this.pickEnemyWaypoints();
      this.enemies.push({
        uid: this.uidSeq++,
        def: {
          id: boss.id,
          name: boss.name,
          emoji: boss.emoji,
          hp: boss.hp,
          speed: boss.speed,
          damage: boss.damage,
          reward: boss.reward,
          color: boss.color,
          fraudType: boss.fraudType,
          element: boss.element,
          ability: "none",
          shape: boss.shape,
        },
        x: this.maze.entrancePt.x,
        y: this.maze.entrancePt.y,
        hp: boss.hp,
        maxHp: boss.hp,
        slowUntil: 0,
        pathIdx: startIdx, // 兼容字段
        myWaypoints: wps,
        myPathIdx: startIdx,
        wobble: Math.random() * Math.PI * 2,
        radius,
        bossRef: boss,
        enraged: false,
        summonTimer: boss.summonInterval ?? 0,
        bossPhaseIdx: 0,
      });
      // v7：移除 spawn 时的 flash（战斗中频繁生成小怪/BOSS 会叠加闪屏），改用粒子
      this.particles.spawnBurst(this.maze.entrancePt.x, this.maze.entrancePt.y, boss.color, { ring: true, sparks: 16, dots: 20, speed: 240, life: 0.8, size: 4 });
      playSfx("hit");
      return;
    }

    let def = ENEMIES[typeId];
    if (!def) return;

    // 关卡 scaling
    let hpMul = 1, speedMul = 1, dmgMul = 1, rewardMul = 1;
    if (this.mode === "classic" || this.mode === "daily") {
      const lv = LEVELS[this.level - 1];
      hpMul = lv.hpMul;
      speedMul = lv.speedMul;
      dmgMul = lv.dmgMul;
      rewardMul = lv.rewardMul;
    } else if (this.mode === "endlessRush") {
      const s = endlessScaling(this.endlessAbsWave);
      hpMul = s.hpMul; speedMul = s.speedMul; dmgMul = s.dmgMul; rewardMul = s.rewardMul;
    } else if (this.mode === "tower") {
      // v7：爬塔模式 — 按当前层数应用难度倍率
      const tf = getTowerFloor(this.towerFloor);
      hpMul = tf.hpMul; speedMul = tf.speedMul; dmgMul = tf.dmgMul; rewardMul = tf.rewardMul;
    }
    if (this.mode === "timeTrial") {
      speedMul = 1.15;
    }

    // v3：每日修饰符
    if (this.mode === "daily") {
      if (this.hasModifier("speedyEnemies")) {
        const eff = this.getModifierEffect<{ kind: "speedyEnemies"; mul: number }>("speedyEnemies");
        if (eff) speedMul *= eff.mul;
      }
      if (this.hasModifier("doubleHp")) hpMul *= 2;
      if (this.hasModifier("bossOnly")) {
        const spawnedCount = this.spawnQueue.filter((s) => s.spawned).length;
        if (spawnedCount > 0 && spawnedCount % 3 === 2) {
          hpMul *= 3;
          rewardMul *= 2;
        }
      }
    }

    const scaledDef: EnemyDef = {
      ...def,
      hp: Math.round(def.hp * hpMul),
      speed: def.speed * speedMul,
      damage: Math.round(def.damage * dmgMul),
      reward: Math.round(def.reward * rewardMul),
    };

    const { wps, startIdx } = this.pickEnemyWaypoints();
    this.enemies.push({
      uid: this.uidSeq++,
      def: scaledDef,
      x: this.maze.entrancePt.x,
      y: this.maze.entrancePt.y,
      hp: scaledDef.hp,
      maxHp: scaledDef.hp,
      slowUntil: 0,
      pathIdx: startIdx,
      myWaypoints: wps,
      myPathIdx: startIdx,
      wobble: Math.random() * Math.PI * 2,
      radius: 20,
      shieldConsumed: false,
    });
  }

  /** v5：在指定位置生成敌人（BOSS 召唤小怪用），抽取独立路径并定位到最近航点 */
  private spawnEnemyAt(typeId: string, lane: number, x: number): void {
    void lane;
    const def = ENEMIES[typeId];
    if (!def) return;
    const { wps, startIdx } = this.pickEnemyWaypoints();
    // 找到距离生成 x 最近的航点作为 myPathIdx 起点
    const nearestIdx = this.nearestWaypointIdx(wps, x, this.maze.entrancePt.y);
    const startWp = wps[nearestIdx] ?? wps[startIdx];
    this.enemies.push({
      uid: this.uidSeq++,
      def,
      x,
      y: startWp.y,
      hp: def.hp,
      maxHp: def.hp,
      slowUntil: 0,
      pathIdx: nearestIdx,
      myWaypoints: wps,
      myPathIdx: nearestIdx,
      wobble: Math.random() * Math.PI * 2,
      radius: 20,
      shieldConsumed: false,
    });
  }

  // ====================================================================
  // v3：探员独有大招（6 种）
  // ====================================================================

  triggerUlt(): void {
    if (this.over || this.energy < 100 || this.upgradeReady) return;
    if (this.mode === "daily" && this.hasModifier("noUlt")) return;
    const ultAgent = this.agents.find((a) => a.alive);
    if (!ultAgent) return;
    const ultDef = ultAgent.def.ultDef;

    this.energy = 0;
    this.ultFlashUntil = this.t + 0.8;
    this.shakeUntil = this.t + 0.5;
    this.ultCount += 1;

    // v7：大招视觉 —— 保留主 flash（关键事件），移除 glitch（易叠加闪屏），强化粒子
    postFX.flash("#FFD666", 0.5, 2.2);
    postFX.shake(12, 16);
    // 中心爆点
    this.particles.spawnBurst(W / 2, H / 2, "#FFD666", { ring: true, shockwave: true, sparks: 40, dots: 50, speed: 420, life: 1.2, size: 6, color2: ultAgent.def.color });
    // 探员身上二次爆发（强化"主角感"）
    this.particles.spawnBurst(ultAgent.x, ultAgent.y, ultAgent.def.color, { ring: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4, color2: "#FFFFFF" });
    // v5：径向光束粒子（模拟大招光束辐射）
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.particles.spawn({
        x: ultAgent.x, y: ultAgent.y,
        count: 6, speed: 500, life: 0.5, size: 4, color: ultDef.kind === "pierce" ? "#FF7A1A" : "#FFD666",
        angle,
      });
    }

    switch (ultDef.kind) {
      case "pierce": this.ultPierce(ultAgent, ultDef.value); break;
      case "slowAll": this.ultSlowAll(ultDef.value, ultDef.duration ?? 3); break;
      case "aoe": this.ultAoe(ultAgent, ultDef.value, ultDef.radius ?? 100); break;
      case "healShield": this.ultHealShield(ultDef.value); break;
      case "critBuff": this.ultCritBuff(ultDef.value, ultDef.duration ?? 5); break;
      case "assassinate": this.ultAssassinate(ultAgent, ultDef.value); break;
      // v6 新增大招
      case "summon": this.ultSummon(ultAgent, ultDef.value, ultDef.duration ?? 8); break;
      case "freeze": this.ultFreeze(ultDef.duration ?? 2); break;
      case "timeWarp": this.ultTimeWarp(ultDef.duration ?? 4); break;
      case "shieldWall": this.ultShieldWall(ultDef.value); break;
    }

    // v6：记录大招使用到 platformStore + onUlt 技能链触发
    platformStore.recordUltUsed();
    this.checkSkillLinksOnUlt(ultAgent.id);

    // v5：大招名称浮字 —— 双层描边效果（先画阴影层再画主层）
    this.floats.push({
      x: W / 2,
      y: H / 2 - 8,
      text: ultDef.name + "！",
      color: ultAgent.def.color,
      life: 1.6,
      maxLife: 1.6,
      size: 28,
    });
    this.floats.push({
      x: W / 2,
      y: H / 2 + 22,
      text: ultDef.desc.slice(0, 18),
      color: "#FFD666",
      life: 1.4,
      maxLife: 1.4,
      size: 12,
    });
    playSfx("bomb");
    this.emitHud();
  }

  /** v4：穿透射击 —— 改为径向范围伤害（覆盖 agent.range * 1.3 内所有敌人） */
  private ultPierce(agent: DeployedAgent, value: number): void {
    const dmg = agent.def.attack * value;
    const radius = agent.def.range * this.upgradeMul("range") * 1.3;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - agent.x, e.y - agent.y);
      if (d <= radius) {
        e.hp -= dmg * (1 - d / radius * 0.2); // 距离轻微衰减
        e.slowUntil = this.t + 1.5;
        this.particles.spawnBurst(e.x, e.y, "#FF7A1A", { sparks: 12, dots: 8, speed: 200, life: 0.6, size: 3 });
      }
    }
    // 穿透光束视觉：从探员向出口方向发射
    // v7：移除 sub-ult flash（主大招已 flash，子技能不再叠加）
    playSfx("laser");
  }

  /** 信号干扰：全场减速 + 受伤加深 */
  private ultSlowAll(slowMul: number, duration: number): void {
    this.slowUntil = this.t + duration;
    this.vulnUntil = this.t + duration;
    this.vulnMul = 1.5;
    for (const e of this.enemies) {
      e.slowUntil = this.t + duration;
      this.particles.spawnBurst(e.x, e.y, "#00E5FF", { sparks: 8, dots: 8, speed: 140, life: 0.6, size: 3 });
    }
    playSfx("timeSlow");
  }

  /** 数据风暴：在最强敌人位置 AOE 爆炸 */
  private ultAoe(agent: DeployedAgent, value: number, radius: number): void {
    let strongest: Enemy | null = null;
    for (const e of this.enemies) {
      if (!strongest || e.hp > strongest.hp) strongest = e;
    }
    if (!strongest) return;
    const dmg = agent.def.attack * value;
    const cx = strongest.x, cy = strongest.y;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - cx, e.y - cy);
      if (d < radius) {
        e.hp -= dmg * (1 - d / radius * 0.3);
        this.particles.spawnBurst(e.x, e.y, "#B388FF", { sparks: 10, dots: 8, speed: 180, life: 0.6, size: 3 });
      }
    }
    this.particles.spawnBurst(cx, cy, "#B388FF", { shockwave: true, ring: true, sparks: 30, dots: 40, speed: 350, life: 1.0, size: 5, color2: "#FFD666" });
    // v7：移除 sub-ult flash
    playSfx("explode");
  }

  /** 全民防线：全队回血 + 基地护盾 */
  private ultHealShield(healRatio: number): void {
    for (const a of this.agents) {
      if (a.alive) {
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * healRatio);
        this.particles.spawnBurst(a.x, a.y, "#52C41A", { ring: true, sparks: 12, dots: 14, speed: 180, life: 0.8, size: 3 });
      }
    }
    this.baseShield = Math.max(this.baseShield, this.base.max * 0.3);
    // v7：移除 sub-ult flash
    playSfx("shieldBreak");
  }

  /** 精准狙击：暴击率 + 暴击伤害加成 */
  private ultCritBuff(critRate: number, duration: number): void {
    this.critBuffUntil = this.t + duration;
    this.critBuffRate = critRate;
    this.critBuffDmgMul = 1.5;
    for (const a of this.agents) {
      if (a.alive) {
        this.particles.spawnBurst(a.x, a.y, "#FFD666", { sparks: 10, dots: 12, speed: 160, life: 0.6, size: 3 });
      }
    }
    // v7：移除 sub-ult flash
    playSfx("weaponUp");
  }

  /** 暗影刺杀：瞬移到最强敌人身边，一击 */
  private ultAssassinate(agent: DeployedAgent, value: number): void {
    let strongest: Enemy | null = null;
    for (const e of this.enemies) {
      if (!strongest || e.hp > strongest.hp) strongest = e;
    }
    if (!strongest) return;
    const dmg = agent.def.attack * value;
    strongest.hp -= dmg;
    this.particles.spawnBurst(agent.x, agent.y, "#E5353B", { sparks: 14, dots: 10, speed: 220, life: 0.5, size: 3 });
    this.particles.spawnBurst(strongest.x, strongest.y, "#E5353B", { shockwave: true, ring: true, sparks: 28, dots: 34, speed: 340, life: 0.9, size: 4, color2: "#FFD666" });
    // v7：移除 sub-ult flash + glitch
    playSfx("laser");
  }

  // ====================================================================
  // v6 新大招：summon / freeze / timeWarp / shieldWall
  // ====================================================================

  /** 召唤：创建一个临时探员（属性 = 主战探员 × value），duration 秒后消失 */
  private ultSummon(agent: DeployedAgent, value: number, duration: number): void {
    const summonDef: AgentDef = {
      ...agent.def,
      id: `${agent.id}_summon`,
      name: `${agent.def.name}(召唤)`,
      attack: Math.max(0, agent.def.attack * value),
      hp: Math.max(1, agent.def.hp * value),
    };
    const ox = (Math.random() - 0.5) * 40;
    const oy = (Math.random() - 0.5) * 40;
    this.agents.push({
      id: summonDef.id,
      def: summonDef,
      row: agent.row,
      col: agent.col,
      x: agent.x + ox,
      y: agent.y + oy,
      hp: summonDef.hp,
      maxHp: summonDef.hp,
      alive: true,
      cooldown: 0,
      flashUntil: 0,
      summonUntil: this.t + duration,
    });
    this.particles.spawnBurst(agent.x + ox, agent.y + oy, agent.def.color, { ring: true, sparks: 20, dots: 24, speed: 260, life: 0.8, size: 4 });
    playSfx("good");
  }

  /** 冰冻：全场敌人冻结（无法移动），持续 duration 秒 */
  private ultFreeze(duration: number): void {
    for (const e of this.enemies) {
      e.frozenUntil = this.t + duration;
      e.slowUntil = this.t + duration;
      this.particles.spawnBurst(e.x, e.y, "#B388FF", { sparks: 8, dots: 8, speed: 120, life: 0.6, size: 3 });
    }
    playSfx("timeSlow");
  }

  /** 时间扭曲：敌人时间减慢 50%，持续 duration 秒 */
  private ultTimeWarp(duration: number): void {
    this.timeWarpUntil = this.t + duration;
    playSfx("timeSlow");
  }

  /** 盾墙：所有探员获得 maxHp × value 的临时护盾 */
  private ultShieldWall(value: number): void {
    for (const a of this.agents) {
      if (!a.alive) continue;
      const shield = Math.max(0, a.maxHp * value);
      a.shieldUntil = this.t + 9999; // 持续到被消耗
      a.shieldValue = (a.shieldValue ?? 0) + shield;
      this.particles.spawnBurst(a.x, a.y, "#A8E6CF", { ring: true, sparks: 12, dots: 14, speed: 180, life: 0.8, size: 3 });
    }
    playSfx("shieldBreak");
  }

  // ====================================================================
  // v6 Phase 2.1：战术装置 + 战术暂停 + 元素反应
  // ====================================================================

  /** 放置战术装置（检查冷却 + 实例化 + 触发效果），返回是否放置成功 */
  placeTacticalDevice(kind: TacticalDeviceKind, x: number, y: number): boolean {
    if (this.over) return false;
    // challenge 模式 noDevices 词缀禁用
    if (this.hasAffix("noDevices")) return false;
    const def = TACTICAL_DEVICES.find((d) => d.kind === kind);
    if (!def) return false;
    if (this.t < (this.deviceCooldowns[kind] ?? 0)) return false;
    // 计算冷却（含天赋 cooldownReduce）
    const cdReduce = this.cooldownReduceTotal();
    const cooldown = Math.max(0, def.cooldown * (1 - cdReduce));
    this.deviceCooldowns[kind] = this.t + cooldown;
    const placedAt = this.t;
    const cooldownUntil = this.deviceCooldowns[kind];
    this.tacticalDevices.push({ kind, x, y, placedAt, cooldownUntil });
    // 立即触发效果
    this.applyTacticalDeviceEffect(def, x, y);
    this.particles.spawnBurst(x, y, def.color, { ring: true, sparks: 16, dots: 18, speed: 220, life: 0.8, size: 4 });
    this.emitHud();
    return true;
  }

  /** 切换战术暂停（每局 1 次，8 秒慢动作 0.3x），返回是否激活 */
  toggleTacticalPause(): boolean {
    if (this.over || this.tacticalPauseRemaining <= 0) return false;
    if (this.hasAffix("noPause")) return false;
    this.tacticalPauseRemaining -= 1;
    this.tacticalPauseUntil = this.t + 8;
    postFX.flash("#00E5FF", 0.35, 1.8);
    this.particles.spawnBurst(W / 2, H / 2, "#00E5FF", { ring: true, sparks: 24, dots: 28, speed: 320, life: 1.0, size: 5 });
    this.emitHud();
    return true;
  }

  /** 应用单个战术装置的即时/持续效果 */
  private applyTacticalDeviceEffect(def: TacticalDeviceDef, x: number, y: number): void {
    const eff = def.effect;
    const radius = def.radius;
    if (eff.kind === "slow") {
      for (const e of this.enemies) {
        if (Math.hypot(e.x - x, e.y - y) <= radius) {
          e.slowUntil = Math.max(e.slowUntil, this.t + def.duration);
        }
      }
    } else if (eff.kind === "stun") {
      for (const e of this.enemies) {
        if (Math.hypot(e.x - x, e.y - y) <= radius) {
          e.frozenUntil = Math.max(e.frozenUntil ?? 0, this.t + eff.duration);
          e.slowUntil = Math.max(e.slowUntil, this.t + eff.duration);
        }
      }
    }
    // taunt 效果在 updateTacticalDevices 中持续重定向敌人目标
  }

  /** 更新战术装置：到期移除 + 嘲讽目标重定向 */
  private updateTacticalDevices(dt: number): void {
    void dt;
    for (let i = this.tacticalDevices.length - 1; i >= 0; i--) {
      const dev = this.tacticalDevices[i];
      const def = TACTICAL_DEVICES.find((d) => d.kind === dev.kind);
      if (!def) { this.tacticalDevices.splice(i, 1); continue; }
      if (this.t - dev.placedAt >= def.duration) {
        this.tacticalDevices.splice(i, 1);
        continue;
      }
      // decoy 嘲讽：范围内敌人改向诱饵移动
      if (def.effect.kind === "taunt") {
        for (const e of this.enemies) {
          if (Math.hypot(e.x - dev.x, e.y - dev.y) <= def.radius) {
            const dx = dev.x - e.x;
            const dy = dev.y - e.y;
            const dist = Math.hypot(dx, dy) || 1;
            const step = Math.min(dist, e.def.speed * 0.016);
            e.x += (dx / dist) * step;
            e.y += (dy / dist) * step;
          }
        }
      }
    }
  }

  /** 检测并触发元素反应（基于当前部署探员的元素分布） */
  private detectAndTriggerElementReactions(): void {
    const agentElements = this.agents
      .filter((a) => a.alive && !a.summonUntil)
      .map((a) => a.def.element);
    if (agentElements.length === 0) return;
    const triggered = detectElementReactions(agentElements);
    // 移除已过期且不在新触发列表中的反应
    this.elementReactions = this.elementReactions.filter((r) => {
      const expired = this.t - r.activatedAt >= r.def.duration;
      if (expired) return false;
      return true;
    });
    // 新增未激活的反应
    for (const def of triggered) {
      const alreadyActive = this.elementReactions.some((r) => r.def.kind === def.kind);
      if (alreadyActive) continue;
      // 计算反应中心点（默认最强敌人位置，无敌人时屏幕中心）
      let cx = W / 2, cy = H / 2;
      let strongest: Enemy | null = null;
      for (const e of this.enemies) {
        if (!strongest || e.hp > strongest.hp) strongest = e;
      }
      if (strongest) { cx = strongest.x; cy = strongest.y; }
      this.elementReactions.push({ def, activatedAt: this.t, x: cx, y: cy });
      this.applyElementReaction(def, cx, cy);
    }
  }

  /** 应用单个元素反应的场地效果 */
  private applyElementReaction(def: ElementReactionDef, x: number, y: number): void {
    const eff = def.effect;
    switch (eff.kind) {
      case "agentInvuln":
        for (const a of this.agents) {
          if (a.alive) a.invulnUntil = this.t + eff.duration;
        }
        break;
      case "enemyStun": {
        for (const e of this.enemies) {
          if (Math.hypot(e.x - x, e.y - y) <= eff.radius) {
            e.frozenUntil = Math.max(e.frozenUntil ?? 0, this.t + eff.duration);
            e.slowUntil = Math.max(e.slowUntil, this.t + eff.duration);
          }
        }
        break;
      }
      case "enemySlow":
        for (const e of this.enemies) {
          e.slowUntil = Math.max(e.slowUntil, this.t + eff.duration);
        }
        break;
      case "enemyBurn":
        // 持续灼烧在 updateEnemies 中按帧应用（此处仅记录）
        break;
      case "enemyChain":
        // 受伤加深在 applyHit 中读取 elementReactions 判断
        break;
      case "damageBoost":
        this.damageBoostUntil = this.t + eff.duration;
        this.damageBoostMul = eff.mul;
        break;
    }
    this.particles.spawnBurst(x, y, def.color, { ring: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4 });
    this.floats.push({ x, y: y - 20, text: def.name + "！", color: def.color, life: 1.0, maxLife: 1.0, size: 16 });
  }

  // ====================================================================
  // v6 Phase 2.2：技能链触发 + 战间答题
  // ====================================================================

  /** 触发技能链（检查冷却 + 应用效果） */
  private triggerSkillLink(state: { link: SkillLink; lastTriggeredAt: number }): void {
    if (this.t - state.lastTriggeredAt < state.link.cooldown) return;
    state.lastTriggeredAt = this.t;
    this.applySkillLinkEffect(state.link);
    this.particles.spawnBurst(W / 2, H / 2 - 40, state.link.color, { ring: true, sparks: 18, dots: 22, speed: 260, life: 0.9, size: 4 });
    this.floats.push({
      x: W / 2, y: H / 2 - 60, text: state.link.emoji + " " + state.link.name,
      color: state.link.color, life: 1.4, maxLife: 1.4, size: 18,
    });
    this.emitHud();
  }

  /** 应用技能链效果 */
  private applySkillLinkEffect(link: SkillLink): void {
    const eff = link.effect;
    switch (eff.kind) {
      case "aoe": {
        let strongest: Enemy | null = null;
        for (const e of this.enemies) {
          if (!strongest || e.hp > strongest.hp) strongest = e;
        }
        if (!strongest) return;
        const baseDmg = this.agents.filter((a) => a.alive).reduce((s, a) => s + a.def.attack, 0) * eff.dmgMul;
        const cx = strongest.x, cy = strongest.y;
        for (const e of this.enemies) {
          if (Math.hypot(e.x - cx, e.y - cy) <= eff.radius) {
            e.hp -= baseDmg;
            this.particles.spawnBurst(e.x, e.y, link.color, { sparks: 8, dots: 6, speed: 160, life: 0.5, size: 3 });
          }
        }
        this.particles.spawnBurst(cx, cy, link.color, { shockwave: true, ring: true, sparks: 24, dots: 30, speed: 320, life: 0.9, size: 4 });
        break;
      }
      case "healAll": {
        for (const a of this.agents) {
          if (a.alive) {
            a.hp = Math.min(a.maxHp, a.hp + a.maxHp * eff.ratio);
            this.particles.spawnBurst(a.x, a.y, "#52C41A", { sparks: 8, dots: 10, speed: 140, life: 0.6, size: 3 });
          }
        }
        break;
      }
      case "buff": {
        this.damageBoostUntil = Math.max(this.damageBoostUntil, this.t + eff.duration);
        this.damageBoostMul = Math.max(this.damageBoostMul, 1 + eff.attackPct);
        break;
      }
      case "debuff": {
        for (const e of this.enemies) {
          e.slowUntil = Math.max(e.slowUntil, this.t + eff.duration);
        }
        break;
      }
      case "energy": {
        this.energy = clamp(this.energy + eff.value, 0, 100);
        break;
      }
    }
  }

  /** 检查 onKill/onCombo 触发的技能链 */
  private checkSkillLinksOnKill(agentId: string): void {
    for (const state of this.activeSkillLinkStates) {
      const trig = state.link.trigger;
      if (trig.kind === "onKill" && trig.agentId === agentId) {
        this.triggerSkillLink(state);
      }
      if (trig.kind === "onCombo" && this.combo.count >= trig.count) {
        this.triggerSkillLink(state);
      }
    }
  }

  /** 检查 onUlt 触发的技能链 */
  private checkSkillLinksOnUlt(agentId: string): void {
    for (const state of this.activeSkillLinkStates) {
      const trig = state.link.trigger;
      if (trig.kind === "onUlt" && trig.agentId === agentId) {
        this.triggerSkillLink(state);
      }
    }
  }

  /** 战间答题：波次结束时检查是否需要出题（每 5 波） */
  private checkQuizOnWaveEnd(clearedWave: number): void {
    if (clearedWave > 0 && clearedWave % 5 === 0 && !this.pendingQuiz) {
      const seed = this.dailySeed || "default";
      // v7：自适应答题 — 优先重练错题（连续错误 ≥ 2 次）
      const wrongRecords = platformStore.managerMetaProgress().quizWrongRecords;
      const { question, isRetry } = pickAdaptiveQuiz(
        (w, s) => pickQuiz(w, s),
        wrongRecords,
        clearedWave,
        seed,
      );
      this.pendingQuiz = question;
      this.pendingQuizIsRetry = isRetry;
      this.emitHud();
    }
  }

  /** 提交答题答案，返回是否正确 */
  answerQuiz(optionIdx: number): boolean {
    if (!this.pendingQuiz) return false;
    const quiz = this.pendingQuiz;
    const correct = optionIdx === quiz.correctIdx;
    this.pendingQuiz = null;
    if (correct) {
      this.quizCorrectCount += 1;
      // 答对应用 buff：攻击 +20% 持续 15s 或 +30 能量（取能量较低时给能量）
      if (this.energy < 50) {
        this.energy = clamp(this.energy + 30, 0, 100);
      } else {
        this.quizBuffUntil = this.t + 15;
        this.quizBuff = { attackPct: 0.2 };
      }
      this.floats.push({ x: W / 2, y: H / 2, text: "✓ 答对！获得反诈 buff", color: "#52C41A", life: 1.6, maxLife: 1.6, size: 18 });
      this.particles.spawnBurst(W / 2, H / 2, "#52C41A", { ring: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4 });
    } else {
      this.floats.push({ x: W / 2, y: H / 2, text: "✗ 答错：" + quiz.explanation.slice(0, 24), color: "#E5353B", life: 1.8, maxLife: 1.8, size: 14 });
    }
    // 记录到 platformStore（v7：同时维护错题记录）
    platformStore.recordQuizAnswerV7(correct, quiz.id);
    this.pendingQuizIsRetry = false;
    this.emitHud();
    return correct;
  }

  // ====================================================================
  // v6 Phase 2.3 辅助：遗物/词缀查询
  // ====================================================================

  /** 当前是否激活某极限词缀 */
  private hasAffix(id: string): boolean {
    return this.challengeAffixes.some((a) => a.id === id);
  }

  /** 当前是否装备了指定效果类型的遗物 */
  private hasRelicEffect(kind: string): boolean {
    for (const relicId of this.equippedRelics) {
      const relic = getRelic(relicId);
      if (relic && relic.effect.kind === kind) return true;
    }
    return false;
  }

  /** 战术装置冷却缩减总和（来自天赋 cooldownReduce） */
  private cooldownReduceTotal(): number {
    let total = 0;
    for (const a of this.agents) {
      const talents = this.agentTalentsMap[a.id];
      if (!talents) continue;
      const tree = getTalentTree(a.id);
      if (!tree) continue;
      for (const branch of ["offense", "defense", "support"] as TalentBranch[]) {
        const tier = talents[branch] ?? 0;
        for (const node of tree.branches[branch]) {
          if (node.tier > tier) break;
          if (node.effect.kind === "cooldownReduce") total += node.effect.value;
        }
      }
    }
    return Math.min(0.8, total);
  }

  // ====================================================================
  // 主更新循环
  // ====================================================================

  protected update(dt: number): void {
    this.t += dt;
    this.particles.update(dt);
    this.updateFloats(dt);

    if (this.over) return;

    // 探员升级阶段：暂停游戏
    if (this.upgradeReady) {
      this.emitHud();
      return;
    }

    // 限时挑战 / 每日 timeLimit：倒计时
    if (this.mode === "timeTrial" || (this.mode === "daily" && this.hasModifier("timeLimit"))) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        if (this.mode === "daily") {
          this.lose();
        } else {
          this.win();
        }
        return;
      }
    }

    // v3：连击衰减检查
    if (this.combo.count > 0 && this.t - this.combo.lastKillAt > this.combo.decaySec) {
      this.combo.count = 0;
      this.combo.multiplier = 1;
    }

    // 波次管理
    if (!this.waveActive && this.t >= this.prepUntil) {
      this.waveActive = true;
    }
    if (this.waveActive) {
      for (const s of this.spawnQueue) {
        if (!s.spawned && this.t >= s.at) {
          s.spawned = true;
          this.spawnEnemy(s.typeId, s.lane);
        }
      }
      const allSpawned = this.spawnQueue.every((s) => s.spawned);
      if (allSpawned && this.enemies.length === 0) {
        // v6：战间答题 —— 暂停波次推进直到答题完成
        if (this.pendingQuiz) {
          this.emitHud();
          return;
        }
        // v7：爬塔事件 —— 暂停波次推进直到玩家选择
        if (this.pendingTowerEvent) {
          this.emitHud();
          return;
        }
        if (this.mode === "bossRush") {
          // v6：战间答题（bossRush 按 bossIdx 计）
          this.checkQuizOnWaveEnd(this.bossIdx + 1);
          if (this.pendingQuiz) { this.emitHud(); return; }
          if (this.bossIdx + 1 < BOSS_RUSH_BOSSES.length) {
            this.startBossWave(this.bossIdx + 1, 2.5);
          } else {
            this.win();
            return;
          }
        } else if (this.mode === "endlessRush") {
          this.checkQuizOnWaveEnd(this.endlessAbsWave + 1);
          if (this.pendingQuiz) { this.emitHud(); return; }
          this.startEndlessWave(this.endlessAbsWave + 1, 2);
        } else if (this.mode === "tower") {
          // v7：爬塔模式 — 楼层推进
          this.checkQuizOnWaveEnd(this.towerFloor);
          if (this.pendingQuiz) { this.emitHud(); return; }
          this.advanceTowerFloor();
        } else if (this.mode === "classic" || this.mode === "daily") {
          const clearedWave = this.wave + 1;
          // v6：战间答题
          this.checkQuizOnWaveEnd(clearedWave);
          if (this.pendingQuiz) { this.emitHud(); return; }
          const currentLevel = LEVELS[this.level - 1];
          if (this.level < this.maxLevel && clearedWave >= currentLevel.targetWave) {
            this.advanceLevel();
          } else if (this.level >= this.maxLevel && clearedWave >= currentLevel.targetWave) {
            this.win();
            return;
          } else {
            this.startWave(this.wave + 1, 3);
          }
        }
      }
    }

    // v6：战术暂停 / 时间扭曲 —— 游戏逻辑减速（UI/粒子不减速）
    let gdt = this.gameDt(dt);
    if (this.t < this.tacticalPauseUntil) gdt *= 0.3;
    if (this.t < this.timeWarpUntil) gdt *= 0.5;
    // v6：更新战术装置（嘲讽重定向 + 到期移除）
    this.updateTacticalDevices(gdt);
    // v6：检测元素反应（基于部署探员元素分布）
    this.detectAndTriggerElementReactions();
    this.updateEnemies(gdt);
    this.updateBossLogic(gdt);
    this.updateAgents(gdt);
    this.updateProjectiles(gdt);
    this.updateEnergy(dt);
  }

  /** v5：BOSS 击杀慢动作期间的游戏 dt（其余部分用原始 dt） */
  private gameDt(dt: number): number {
    return this.t < this.slowmoUntil ? dt * 0.35 : dt;
  }

  // ====================================================================
  // v3：BOSS 三阶段逻辑
  // ====================================================================

  private updateBossLogic(dt: number): void {
    if (this.mode !== "bossRush") return;
    for (const e of this.enemies) {
      if (!e.bossRef) continue;

      // 召唤
      if (e.summonTimer !== undefined && e.bossRef.summonTypeId) {
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          let summonInterval = e.bossRef.summonInterval ?? 5;
          let summonCount = e.bossRef.summonCount ?? 1;
          const lane = e.bossRef.summonLane ?? 1;

          if (e.bossPhaseIdx !== undefined && e.bossPhaseIdx > 0 && e.bossRef.phases) {
            const phase = e.bossRef.phases[e.bossPhaseIdx - 1];
            if (phase) {
              const applied = applyBossPhase(
                phase, e.def.speed, e.def.damage, summonInterval, summonCount
              );
              summonInterval = applied.summonInterval;
              summonCount = applied.summonCount;
            }
          }

          e.summonTimer = summonInterval;
          for (let i = 0; i < summonCount; i++) {
            this.spawnEnemyAt(e.bossRef.summonTypeId, lane, e.x - 30 - i * 20);
          }
          this.toast = {
            text: `${e.bossRef.name} 发动【${e.bossRef.skillName}】`,
            tone: "bad",
            until: this.t + 1.6,
          };
          // v7：移除召唤小怪时的 flash（BOSS 战频繁召唤会叠加闪屏），改用粒子
          this.particles.spawnBurst(e.x, e.y, e.bossRef.color, { ring: true, sparks: 12, dots: 14, speed: 200, life: 0.6, size: 3 });
        }
      }

      // v3：三阶段触发检测
      if (e.bossRef.phases && e.bossRef.phases.length > 0) {
        const hpRatio = e.hp / e.maxHp;
        const newPhaseIdx = bossPhaseIndex(e.bossRef, hpRatio);
        if (newPhaseIdx !== e.bossPhaseIdx) {
          e.bossPhaseIdx = newPhaseIdx;
          if (newPhaseIdx > 0) {
            const phase = e.bossRef.phases[newPhaseIdx - 1];
            this.bossPhaseName = phase.name;
            this.triggerBossPhase(e, phase);
          }
        }
      }

      // v3：healSelf 阶段持续回血
      if (e.bossHealPerSec && e.bossHealPerSec > 0) {
        e.hp = Math.min(e.maxHp, e.hp + e.bossHealPerSec * e.maxHp * dt);
      }

      // 旧版狂暴检测（兼容无 phases 的 BOSS）
      if (!e.bossRef.phases && !e.enraged && e.bossRef.enrageAtHp !== undefined) {
        if (e.hp / e.maxHp <= e.bossRef.enrageAtHp) {
          this.triggerBossEnrage(e);
        }
      }
    }
  }

  /** 触发 BOSS 阶段效果 */
  private triggerBossPhase(e: Enemy, phase: NonNullable<BossRushDef["phases"]>[number]): void {
    const boss = e.bossRef!;
    switch (phase.effect) {
      case "enrage":
        e.enraged = true;
        e.def = {
          ...e.def,
          speed: e.def.speed * (boss.enrageSpeedMul ?? 1.5),
          damage: Math.round(e.def.damage * (boss.enrageDamageMul ?? 1.5)),
        };
        break;
      case "doubleSummon":
        break;
      case "healSelf":
        e.bossHealPerSec = phase.value ?? 0.01;
        break;
      case "speedBurst":
        e.def = { ...e.def, speed: e.def.speed * (phase.value ?? 1.5) };
        break;
      case "shield":
        e.bossDmgReduction = phase.value ?? 0.3;
        break;
    }
    this.toast = {
      text: `⚠ ${boss.name} 进入【${phase.name}】${phase.desc}`,
      tone: "bad",
      until: this.t + 2.5,
    };
    // v8：BOSS 阶段切换 —— 仅 shake + 粒子（阶段可在单场 BOSS 战连续触发 3 次，flash 会累积闪屏）
    postFX.shake(7, 12);
    playSfx("phase");
    this.particles.spawnBurst(e.x, e.y, "#E5353B", { ring: true, sparks: 28, dots: 34, speed: 300, life: 1.0, size: 4, color2: boss.color });
  }

  /** 旧版狂暴触发（兼容） */
  private triggerBossEnrage(e: Enemy): void {
    const boss = e.bossRef!;
    e.enraged = true;
    e.def = {
      ...e.def,
      speed: e.def.speed * (boss.enrageSpeedMul ?? 1.5),
      damage: Math.round(e.def.damage * (boss.enrageDamageMul ?? 1.5)),
    };
    this.toast = {
      text: `⚠ ${boss.name} 狂暴！速度×${boss.enrageSpeedMul ?? 1.5} 伤害×${boss.enrageDamageMul ?? 1.5}`,
      tone: "bad",
      until: this.t + 2.5,
    };
    // v8：狂暴触发 —— 仅 shake + 粒子（与阶段切换同理，避免 flash 累积）
    postFX.shake(7, 12);
    playSfx("bad");
    this.particles.spawnBurst(e.x, e.y, "#E5353B", { ring: true, sparks: 28, dots: 34, speed: 300, life: 1.0, size: 4, color2: boss.color });
  }

  // ====================================================================
  // v5：敌人更新 —— 沿本敌人专属航点前进（分支图迷宫，多路并存）
  // ====================================================================

  private updateEnemies(dt: number): void {
    const slowed = this.t < this.slowUntil;
    const patroller = this.cultAgents.find((c) => c.def.buff === "slow" && c.unlocked);
    const patrollerRange = patroller ? (patroller.def.range ?? 100) + patroller.level * 20 : 0;
    const patrollerSlow = patroller ? patroller.def.buffPerLevel * patroller.level : 0;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      let speed = e.def.speed;
      // v6：freeze 大招 / frozenUntil —— 冻结期间无法移动
      if (this.t < (e.frozenUntil ?? 0)) {
        speed = 0;
      } else if (slowed || this.t < e.slowUntil) {
        speed *= 0.4;
      }
      if (patroller && Math.hypot(e.x - patroller.x, e.y - patroller.y) < patrollerRange) {
        e.slowUntil = Math.max(e.slowUntil, this.t + 0.2);
        speed *= (1 - patrollerSlow);
      }

      // v3：speedBoost 技能（低血量加速）
      if (e.def.ability === "speedBoost" && e.hp / e.maxHp < 0.3) {
        speed *= 1.5;
      }

      // v6：invisible 能力 —— 每 4 秒隐身 1.5 秒（初始化周期）
      if (e.def.ability === "invisible") {
        if (e.invisibleUntil === undefined) e.invisibleUntil = this.t + 4;
        if (this.t >= e.invisibleUntil && this.t >= e.invisibleUntil + 1.5) {
          // 隐身结束，进入下一个周期
          e.invisibleUntil = this.t + 4;
        }
      }

      // v6：teleport 能力 —— hp < 30% 时每 3 秒瞬移到出口附近（pathIdx += 3）
      if (e.def.ability === "teleport" && e.hp / e.maxHp < 0.3) {
        const lastTp = e.lastTeleportAt ?? 0;
        if (this.t - lastTp >= 3) {
          e.lastTeleportAt = this.t;
          const wps = e.myWaypoints.length >= 2 ? e.myWaypoints : this.maze.waypoints;
          const jump = Math.min(3, wps.length - (e.myWaypoints.length >= 2 ? e.myPathIdx : e.pathIdx) - 1);
          if (jump > 0) {
            if (e.myWaypoints.length >= 2) e.myPathIdx += jump;
            else e.pathIdx += jump;
            const newTarget = wps[e.myWaypoints.length >= 2 ? e.myPathIdx : e.pathIdx];
            if (newTarget) { e.x = newTarget.x; e.y = newTarget.y; }
            this.particles.spawnBurst(e.x, e.y, "#9D6BFF", { ring: true, sparks: 12, dots: 14, speed: 200, life: 0.6, size: 3 });
          }
        }
      }

      // v6：元素反应 burn —— 范围内敌人每秒受 dmgPerSec 伤害
      for (const r of this.elementReactions) {
        if (r.def.effect.kind === "enemyBurn" && this.t - r.activatedAt < r.def.duration) {
          if (Math.hypot(e.x - r.x, e.y - r.y) <= r.def.effect.radius) {
            e.hp -= r.def.effect.dmgPerSec * dt;
            if (Math.random() < 0.1) {
              this.particles.spawn({ x: e.x, y: e.y, count: 2, speed: 60, life: 0.3, size: 2, color: "#FF7A1A" });
            }
          }
        }
      }

      // v6：burn 致死检查
      if (e.hp <= 0) {
        this.killEnemy(e, "__burn__");
        continue;
      }

      // v5：沿本敌人专属航点前进（支持分支迷宫，多敌人走不同路）
      const wps = e.myWaypoints.length >= 2 ? e.myWaypoints : this.maze.waypoints;
      const idx = e.myWaypoints.length >= 2 ? e.myPathIdx : e.pathIdx;
      if (idx < wps.length) {
        const target = wps[idx];
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) {
          // 到达当前航点，前进到下一个
          if (e.myWaypoints.length >= 2) e.myPathIdx += 1;
          else e.pathIdx += 1;
        } else {
          const step = Math.min(dist, speed * dt);
          e.x += (dx / dist) * step;
          e.y += (dy / dist) * step;
        }
      }
      e.wobble += dt * 6;

      // v3：heal 技能（治疗光环，按距离判定）
      if (e.def.ability === "heal" || e.def.heal) {
        const healAmt = e.def.heal ?? 8;
        for (const other of this.enemies) {
          if (other !== e && Math.hypot(other.x - e.x, other.y - e.y) < 60) {
            other.hp = Math.min(other.maxHp, other.hp + healAmt * dt);
          }
        }
      }

      // v5：到达出口（走完所有航点）—— 同步两个索引避免逻辑分叉
      const finished = e.myWaypoints.length >= 2 ? e.myPathIdx >= wps.length : e.pathIdx >= wps.length;
      if (finished) {
        // 同步 pathIdx 以兼容外部读取
        e.pathIdx = wps.length;
        let dmg = e.def.damage;
        // v6：enrage 能力 —— 狂暴层数增加到达出口伤害（每层 +20%）
        if (e.enrageStacks && e.enrageStacks > 0) {
          dmg *= (1 + 0.2 * e.enrageStacks);
        }
        // v6：firstHitFree 遗物 —— 首次命中免疫（仅对基地首次受伤）
        if (!this.firstHitFreeConsumed && this.hasRelicEffect("firstHitFree")) {
          this.firstHitFreeConsumed = true;
          dmg = 0;
          this.floats.push({ x: this.maze.exitPt.x, y: this.maze.exitPt.y - 20, text: "初次免疫！", color: "#FF7AB8", life: 1.0, maxLife: 1.0, size: 14 });
        }
        if (this.baseShield > 0) {
          const absorbed = Math.min(this.baseShield, dmg);
          this.baseShield -= absorbed;
          dmg -= absorbed;
        }
        this.base.hp -= dmg;
        this.shakeUntil = this.t + 0.25;
        this.enemies.splice(i, 1);
        this.particles.spawnBurst(this.maze.exitPt.x, this.maze.exitPt.y, "#E5353B", { sparks: 16, dots: 18, speed: 240, life: 0.8, size: 4, color2: "#FFB020" });
        // v7：移除突破防线时的 flash（连续突破会叠加闪屏），仅保留 shake + 粒子
        postFX.shake(5, 10);
        playSfx("hit");
        this.toast = {
          text: `${e.def.name} 突破防线！基地 -${Math.round(dmg)}`,
          tone: "bad",
          until: this.t + 2,
        };
        if (this.base.hp <= 0) {
          this.base.hp = 0;
          this.lose();
          return;
        }
      }
    }
  }

  // ====================================================================
  // v4：探员更新 —— 距离判定 + 暴击升级 + 回血升级
  // ====================================================================

  private updateAgents(dt: number): void {
    const fireRateMul = this.upgradeMul("firerate");
    const noHeal = this.mode === "daily" && this.hasModifier("noHeal");
    const noHealMul = noHeal ? 1.5 : 1;
    // v4：hpregen 升级 —— 每秒回血
    const regenPerSec = this.upgradeMul("hpregen") > 0
      ? (this.upgradeMul("hpregen") - 1) * 10 // 每级 +4 hp/s（0.04 * 10 = 0.4... 调整为 *10）
      : 0;

    for (const a of this.agents) {
      if (!a.alive) continue;

      // v6：召唤体到期移除
      if (a.summonUntil !== undefined && this.t >= a.summonUntil) {
        a.alive = false;
        this.particles.spawnBurst(a.x, a.y, a.def.color, { sparks: 10, dots: 12, speed: 160, life: 0.5, size: 3 });
        continue;
      }

      // v4：hpregen 回血
      if (regenPerSec > 0 && a.hp < a.maxHp) {
        a.hp = Math.min(a.maxHp, a.hp + regenPerSec * dt);
      }
      // v6：遗物 agentHpRegen —— 每秒回血
      if (this.agentHpRegen > 0 && a.hp < a.maxHp) {
        a.hp = Math.min(a.maxHp, a.hp + this.agentHpRegen * dt);
      }

      // v3：fear 技能（附近恐吓语音 → 射速 -30%）—— 按距离判定
      let agentFireMul = fireRateMul;
      for (const e of this.enemies) {
        if (e.def.ability === "fear" && Math.hypot(e.x - a.x, e.y - a.y) < 150) {
          agentFireMul *= 0.7;
          break;
        }
      }

      a.cooldown -= dt * agentFireMul;
      if (a.cooldown <= 0) {
        const target = this.findTarget(a);
        if (target) {
          a.cooldown = 1 / a.def.fireRate;
          a.flashUntil = this.t + 0.08;
          this.fireProjectile(a, target, noHealMul);
        }
      }
    }
  }

  /** v5：距离判定寻敌 —— 在射程内选路径进度最大（最靠近出口）的敌人 */
  private findTarget(a: DeployedAgent): Enemy | null {
    const rangeMul = this.upgradeMul("range");
    const effectiveRange = a.def.range * rangeMul;
    let best: Enemy | null = null;
    let bestProgress = -1;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - a.x, e.y - a.y);
      if (d > effectiveRange) continue;

      // v3：taunt 技能（假客服弹窗吸引投射物）—— 优先攻击
      if (e.def.ability === "taunt") {
        return e;
      }

      // v6：invisible 能力 —— 隐身期间（invisibleUntil 起 1.5 秒）无法被攻击
      if (e.def.ability === "invisible") {
        const invStart = e.invisibleUntil ?? 0;
        if (this.t >= invStart && this.t < invStart + 1.5) {
          continue;
        }
      }

      // v5：用路径进度（0..1）作为优先级，兼容不同长度的分支路径
      const wpsLen = e.myWaypoints.length >= 2 ? e.myWaypoints.length : this.maze.waypoints.length;
      const curIdx = e.myWaypoints.length >= 2 ? e.myPathIdx : e.pathIdx;
      const progress = wpsLen > 0 ? curIdx / wpsLen : 0;
      if (progress > bestProgress || (progress === bestProgress && d < bestDist)) {
        bestProgress = progress;
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private fireProjectile(a: DeployedAgent, target: Enemy, noHealMul: number): void {
    // v3：暴击计算（含 critBuff 大招 + v4 crit 升级）
    let critRate = a.def.crit ?? 0;
    let critMul = 1.8;
    if (this.t < this.critBuffUntil) {
      critRate += this.critBuffRate;
      critMul = 1.8 * this.critBuffDmgMul;
    }
    // v4：crit 升级加成（每级 +18% 暴击率，+60% 暴击伤害）
    const critUpgradeCount = this.upgrades.filter((u) => u === "crit").length;
    critRate += critUpgradeCount * 0.18;
    critMul += critUpgradeCount * 0.6;
    // v6：天赋/装备暴击加成
    critRate += a.bonusCritRate ?? 0;
    critMul += a.bonusCritDmg ?? 0;
    const isCrit = Math.random() < critRate;
    const crit = isCrit ? critMul : 1;

    // v5：pierce 升级 —— 每级 +1 穿透次数；v6：pierceAll 遗物穿透所有
    const pierceUpgradeCount = this.upgrades.filter((u) => u === "pierce").length;
    const pierceLeft = this.pierceAll ? 9999 : pierceUpgradeCount * 1;

    // v6：全队伤害加成（resonance 元素反应 / 技能链 buff / 答题 buff）
    let dmgBoost = 1;
    if (this.t < this.damageBoostUntil) dmgBoost *= this.damageBoostMul;
    if (this.t < this.quizBuffUntil && this.quizBuff) dmgBoost *= (1 + this.quizBuff.attackPct);

    const attackMul = this.upgradeMul("attack") * noHealMul * dmgBoost;
    this.spawnProjectile(a, target, a.def.attack * crit * attackMul, isCrit, pierceLeft, a.def.splash ?? 0);

    // v5：doubleShot 升级 —— 额外发射一枚投射物（60% 伤害），目标为同一次寻敌中次近的敌人
    const doubleShotCount = this.upgrades.filter((u) => u === "doubleShot").length;
    if (doubleShotCount > 0) {
      const secondary = this.findSecondaryTarget(a, target);
      if (secondary) {
        this.spawnProjectile(a, secondary, a.def.attack * crit * attackMul * 0.6, isCrit, pierceLeft, a.def.splash ?? 0);
      } else {
        // 没有次目标，再打一发到主目标
        this.spawnProjectile(a, target, a.def.attack * crit * attackMul * 0.6, isCrit, pierceLeft, a.def.splash ?? 0);
      }
    }
    playSfx("shoot");
  }

  /** v5：发射一枚投射物的工厂方法（统一字段，含 pierceLeft/fromX/fromY） */
  private spawnProjectile(
    a: DeployedAgent, target: Enemy, damage: number, isCrit: boolean,
    pierceLeft: number, splash: number,
  ): void {
    this.projectiles.push({
      x: a.x,
      y: a.y - 4,
      tx: target.x,
      ty: target.y,
      target,
      speed: a.def.projectileSpeed,
      damage,
      color: isCrit ? "#FFD666" : a.def.color,
      splash,
      life: 2,
      trail: [],
      element: a.def.element,
      agentId: a.id,
      crit: isCrit,
      pierceLeft,
      fromX: a.x,
      fromY: a.y,
    });
  }

  /** v5：doubleShot 升级 —— 在射程内寻找次近的敌人（跳过主目标） */
  private findSecondaryTarget(a: DeployedAgent, primary: Enemy): Enemy | null {
    const rangeMul = this.upgradeMul("range");
    const effectiveRange = a.def.range * rangeMul;
    let best: Enemy | null = null;
    let bestProgress = -1;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (e === primary) continue;
      const d = Math.hypot(e.x - a.x, e.y - a.y);
      if (d > effectiveRange) continue;
      if (e.def.ability === "taunt") return e;
      const wpsLen = e.myWaypoints.length >= 2 ? e.myWaypoints.length : this.maze.waypoints.length;
      const curIdx = e.myWaypoints.length >= 2 ? e.myPathIdx : e.pathIdx;
      const progress = wpsLen > 0 ? curIdx / wpsLen : 0;
      if (progress > bestProgress || (progress === bestProgress && d < bestDist)) {
        bestProgress = progress;
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  // ====================================================================
  // 投射物更新（v3：含拖尾）
  // ====================================================================

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }
      p.trail.push({ x: p.x, y: p.y, life: 0.25 });
      if (p.trail.length > 12) p.trail.shift();
      for (const tr of p.trail) tr.life -= dt;
      p.trail = p.trail.filter((tr) => tr.life > 0);

      if (p.target && p.target.hp > 0) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      } else {
        // v5：pierce 升级 —— 当前目标死亡/无效时，尝试寻找下一个目标继续穿透
        if (p.pierceLeft > 0) {
          const next = this.findPierceTarget(p);
          if (next) {
            p.target = next;
            p.tx = next.x;
            p.ty = next.y;
            p.pierceLeft -= 1;
          } else {
            p.target = null;
            // 沿原方向继续飞行直至 life 耗尽
          }
        } else {
          p.target = null;
        }
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) {
        this.applyHit(p);
        // v5：pierce 升级 —— 命中后不消失，转向下一个敌人
        if (p.pierceLeft > 0 && p.life > 0) {
          const next = this.findPierceTarget(p);
          if (next) {
            p.target = next;
            p.tx = next.x;
            p.ty = next.y;
            p.pierceLeft -= 1;
            continue;
          }
        }
        this.projectiles.splice(i, 1);
        continue;
      }
      const vx = (dx / dist) * p.speed;
      const vy = (dy / dist) * p.speed;
      p.x += vx * dt;
      p.y += vy * dt;
    }
  }

  /** v5：pierce 升级 —— 寻找投射物前方锥形区域内、非当前目标的下一个敌人 */
  private findPierceTarget(p: Projectile): Enemy | null {
    // 投射物飞行方向
    const dirX = p.tx - p.fromX;
    const dirY = p.ty - p.fromY;
    const dirLen = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / dirLen;
    const uy = dirY / dirLen;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (e === p.target || e.hp <= 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 200) continue; // 只在 200px 范围内寻找
      // 前向投影（>0 表示在前方）
      const fwd = dx * ux + dy * uy;
      if (fwd < -20) continue; // 允许少许后方
      // 评分：前向距离优先，越近越好
      const score = fwd - dist * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  // ====================================================================
  // 命中处理（v3：元素克制 / 护盾 / 受伤加深）
  // ====================================================================

  private applyHit(p: Projectile): void {
    if (!p.target) return;
    const e = p.target;
    const tech = this.cultAgents.find((c) => c.def.buff === "weakness" && c.unlocked);
    const techMul = tech ? (1 + tech.def.buffPerLevel * tech.level) : 1;

    const elemMul = elementMul(p.element, e.def.element);
    const vulnMul = this.t < this.vulnUntil ? this.vulnMul : 1;
    const bossReduction = e.bossDmgReduction ?? 0;
    let shieldMul = 1;
    if (e.def.ability === "shield" && !e.shieldConsumed) {
      shieldMul = 0.5;
      e.shieldConsumed = true;
      this.particles.spawnBurst(e.x, e.y, "#00E5FF", { sparks: 8, dots: 6, speed: 120, life: 0.4, size: 2 });
      playSfx("shieldBreak");
    }

    // v6：天赋 elementBonus —— 发射探员的元素伤害加成
    const firingAgent = this.agents.find((a) => a.id === p.agentId);
    const elementBonusMul = firingAgent?.bonusElementDmg?.[p.element] ?? 0;

    // v6：元素反应 conductivity —— 范围内敌人受伤 +50%
    let chainMul = 1;
    for (const r of this.elementReactions) {
      if (r.def.effect.kind === "enemyChain" && this.t - r.activatedAt < r.def.duration) {
        if (Math.hypot(e.x - r.x, e.y - r.y) <= r.def.effect.radius) {
          chainMul *= r.def.effect.dmgMul;
        }
      }
    }

    const totalDmg = p.damage * techMul * (elemMul + elementBonusMul) * vulnMul * (1 - bossReduction) * shieldMul * chainMul;
    e.hp -= totalDmg;

    // v6：reflect 能力 —— 反射 20% 伤害给最近探员（探员护盾优先吸收）
    if (e.def.ability === "reflect" && totalDmg > 0) {
      const reflectDmg = totalDmg * 0.2;
      let nearest: DeployedAgent | null = null;
      let nd = Infinity;
      for (const a of this.agents) {
        if (!a.alive) continue;
        const d = Math.hypot(a.x - e.x, a.y - e.y);
        if (d < nd) { nd = d; nearest = a; }
      }
      if (nearest) {
        let actualDmg = reflectDmg;
        // 探员护盾吸收
        if (nearest.shieldValue && nearest.shieldValue > 0 && this.t < (nearest.shieldUntil ?? 0)) {
          const absorbed = Math.min(nearest.shieldValue, actualDmg);
          nearest.shieldValue -= absorbed;
          actualDmg -= absorbed;
        }
        // 无敌期间不受伤害
        if (this.t < (nearest.invulnUntil ?? 0)) actualDmg = 0;
        if (actualDmg > 0) {
          nearest.hp -= actualDmg;
          if (nearest.hp <= 0) {
            nearest.hp = 0;
            nearest.alive = false;
          }
          this.particles.spawnBurst(nearest.x, nearest.y, "#E5353B", { sparks: 6, dots: 6, speed: 120, life: 0.4, size: 2 });
        }
      }
    }
    // v7：受击白闪（0.08 秒，爽感命中反馈）
    e.hitFlashUntil = this.t + 0.08;

    // v7：伤害飘字（每次命中都显示，强化打击感）
    if (totalDmg >= 1) {
      const dmgColor = p.crit ? "#FF7AB8" : elemMul > 1 ? "#FFD666" : "#FFFFFF";
      this.floats.push({
        x: e.x + (Math.random() - 0.5) * 16,
        y: e.y - e.radius - 6,
        text: p.crit ? `${Math.round(totalDmg)}!` : `${Math.round(totalDmg)}`,
        color: dmgColor,
        life: 0.5, maxLife: 0.5,
        size: p.crit ? 16 : 12,
      });
    }

    // v5：vampire 升级 —— 造成伤害时为最近的探员回血 15%
    const vampireCount = this.upgrades.filter((u) => u === "vampire").length;
    if (vampireCount > 0 && totalDmg > 0) {
      const healAmount = totalDmg * 0.15 * vampireCount;
      // 找到距离命中点最近的存活探员
      let nearestAgent: DeployedAgent | null = null;
      let nearestDist = Infinity;
      for (const a of this.agents) {
        if (!a.alive) continue;
        const d = Math.hypot(a.x - p.fromX, a.y - p.fromY);
        if (d < nearestDist) {
          nearestDist = d;
          nearestAgent = a;
        }
      }
      if (nearestAgent && nearestAgent.hp < nearestAgent.maxHp) {
        const before = nearestAgent.hp;
        nearestAgent.hp = Math.min(nearestAgent.maxHp, nearestAgent.hp + healAmount);
        const healed = nearestAgent.hp - before;
        if (healed > 0.5) {
          this.floats.push({
            x: nearestAgent.x, y: nearestAgent.y - 24, text: `+${Math.round(healed)}`,
            color: "#FF4D6D", life: 0.6, maxLife: 0.6, size: 10,
          });
          this.particles.spawn({
            x: nearestAgent.x, y: nearestAgent.y - 8, count: 3, speed: 60, life: 0.5, size: 2, color: "#FF4D6D",
          });
        }
      }
    }

    if (elemMul !== 1) {
      this.lastElementalHint = {
        kind: elemMul > 1 ? "strong" : "weak",
        from: p.element,
        to: e.def.element,
        at: this.t,
      };
      if (elemMul > 1) {
        this.floats.push({
          x: e.x, y: e.y - 20, text: "强效!", color: "#FFD666",
          life: 0.6, maxLife: 0.6, size: 12,
        });
      }
    }

    // v4：暴击飘字
    if (p.crit) {
      this.floats.push({
        x: e.x, y: e.y - 32, text: "暴击!", color: "#FF7AB8",
        life: 0.5, maxLife: 0.5, size: 11,
      });
    }

    this.particles.spawn({
      x: e.x, y: e.y, count: 6, speed: 120, life: 0.4, size: 2, color: p.color,
    });

    if (p.splash > 0) {
      for (const other of this.enemies) {
        if (other === e) continue;
        const d = Math.hypot(other.x - e.x, other.y - e.y);
        if (d < p.splash) {
          other.hp -= p.damage * 0.5 * elemMul;
        }
      }
      this.particles.spawn({
        x: e.x, y: e.y, count: 20, speed: 200, life: 0.6, size: 3, color: p.color,
      });
    }

    if (e.hp <= 0) {
      this.killEnemy(e, p.agentId);
    }
  }

  // ====================================================================
  // 击杀处理（v4：资源系统 + 连击 + 熟练度）
  // ====================================================================

  private killEnemy(e: Enemy, agentId: string): void {
    const idx = this.enemies.indexOf(e);
    if (idx < 0) return;
    this.enemies.splice(idx, 1);

    // v3：连击更新
    this.combo.count += 1;
    this.combo.lastKillAt = this.t;
    this.combo.maxCount = Math.max(this.combo.maxCount, this.combo.count);
    this.combo.multiplier = comboMul(this.combo.count);

    // v3：探员熟练度追踪
    this.killsByAgent[agentId] = (this.killsByAgent[agentId] ?? 0) + 1;

    // 得分计算
    const mul = this.mode === "timeTrial" ? TIME_TRIAL_SCORE_MUL : 1;
    const analyst = this.cultAgents.find((c) => c.def.buff === "score" && c.unlocked);
    const scoreMul = analyst ? (1 + analyst.def.buffPerLevel * analyst.level) : 1;
    const comboScoreMul = this.combo.multiplier;
    const dailyMul = this.mode === "daily" ? dailyScoreMul(this.dailyModifiers) : 1;
    // v6：遗物 scoreMul 加成
    const gained = Math.round(e.def.reward * mul * scoreMul * comboScoreMul * dailyMul * this.scoreMul);
    this.score += gained;
    this.bustedCount += 1;

    // v3：noUlt 修饰符不积累能量
    // v6：大招能量积累加速 8→12，让大招更频繁（爽感）+ ultChargeMul 天赋加成
    if (!(this.mode === "daily" && this.hasModifier("noUlt"))) {
      // 找到击杀探员的 ultChargeMul
      const killer = this.agents.find((a) => a.id === agentId);
      const chargeMul = killer?.ultChargeMul ?? 1;
      this.energy = clamp(this.energy + 12 * chargeMul, 0, 100);
    }

    // v6：技能链触发检测（onKill + onCombo）
    this.checkSkillLinksOnKill(agentId);

    // v6：新敌人能力 —— split（分裂）+ enrage（附近敌人狂暴）
    this.handleEnemyDeathAbilities(e);

    // v7：击杀粒子加密 + 每次击杀都带小环爆（强化"打爆"反馈）
    this.particles.spawnBurst(e.x, e.y, e.def.color, { ring: true, sparks: 20, dots: 26, speed: 280, life: 0.85, size: 3, color2: "#FFD666" });
    // v7：高连击仅在关键节点触发 shake（已由 PostFX 冷却节流），完全移除 glitch
    if (this.combo.count >= 8) {
      postFX.shake(3, 8);
      this.particles.spawnBurst(e.x, e.y, "#FFD666", { ring: true, sparks: 18, dots: 22, speed: 320, life: 0.9, size: 4 });
    }
    if (this.combo.count >= 15) {
      // 极高连击：仅粒子爆发，不触发 glitch（根治高连击闪屏）
      this.particles.spawnBurst(e.x, e.y, "#FF7AB8", { ring: true, shockwave: true, sparks: 24, dots: 28, speed: 360, life: 1.0, size: 5 });
    }
    // v7：连击里程碑大字横幅（10/20/30...）—— 强化爽感高潮
    if (this.combo.count >= 10 && this.combo.count % 10 === 0) {
      const milestoneColor = this.combo.count >= 30 ? "#FF7AB8" : this.combo.count >= 20 ? "#FFD666" : "#00E5FF";
      this.floats.push({
        x: W / 2, y: H / 2 - 40,
        text: `${this.combo.count} COMBO!`,
        color: milestoneColor, life: 1.2, maxLife: 1.2, size: 28,
      });
      // 里程碑额外粒子爆发（屏幕中心放射）
      this.particles.spawnBurst(W / 2, H / 2, milestoneColor, { ring: true, shockwave: true, sparks: 30, dots: 36, speed: 400, life: 1.1, size: 5 });
      postFX.shake(5, 10);
    }

    // 飘字：分数 + 连击提示
    this.floats.push({
      x: e.x, y: e.y - 10, text: `+${gained}`,
      color: comboScoreMul > 1.5 ? "#FFD666" : "#FFFFFF",
      life: 0.8, maxLife: 0.8, size: 16,
    });
    // v9：反诈识破反馈 —— 击杀时飘字"识破：xxx"，强化反诈常识学习
    const fraudTermKey = e.bossRef?.id ?? e.def.id;
    const fraudTerm = FRAUD_TERMS[fraudTermKey];
    if (fraudTerm) {
      this.floats.push({
        x: e.x, y: e.y - 44, text: `识破：${fraudTerm}`,
        color: "#1AD670", life: 1.4, maxLife: 1.4, size: 11,
      });
    }
    if (this.combo.count >= COMBO_CONFIG.showThreshold) {
      this.floats.push({
        x: e.x, y: e.y - 28, text: `${this.combo.count} COMBO ×${comboScoreMul.toFixed(1)}`,
        color: this.combo.count >= 10 ? "#FF7AB8" : "#FFD666", life: 0.7, maxLife: 0.7,
        size: this.combo.count >= 10 ? 13 : 11,
      });
    }

    playSfx("explode");

    // v4：探员升级系统（击杀资源 → 升级守卫）
    // v6：遗物 extraUpgrade 扩展升级上限
    const effectiveUpgradeMax = UPGRADE_MAX_COUNT + this.upgradeMaxCountBonus;
    if (this.upgradeCount < effectiveUpgradeMax && !(this.mode === "daily" && this.hasModifier("noUpgrades"))) {
      this.upgradeXp = clamp(this.upgradeXp + Math.round(e.def.reward * 0.5), 0, UPGRADE_XP_THRESHOLD);
      if (this.upgradeXp >= UPGRADE_XP_THRESHOLD) {
        this.enterUpgrade();
      }
    }

    this.tryCultUpgrade();

    // BOSS 死亡
    if (e.bossRef) {
      this.bossKillsThisGame += 1;
      // v7：记录最后击破的 BOSS id（用于结算页真实案例展示）
      this.lastDefeatedBossId = e.bossRef.id;
      // v5：BOSS 击杀慢动作（1.2 秒）—— 强化爽感
      // v6：慢动作延长 1.2→1.8 秒，强化击破瞬间戏剧感
      this.slowmoUntil = this.t + 1.8;
      this.particles.spawnBurst(e.x, e.y, e.bossRef.color, { ring: true, shockwave: true, sparks: 50, dots: 60, speed: 460, life: 1.4, size: 7, color2: "#FFD666" });
      // 二次爆发（更密集的金色闪光，强化击破瞬间）
      this.particles.spawnBurst(e.x, e.y, "#FFD666", { ring: true, sparks: 30, dots: 36, speed: 360, life: 1.0, size: 5, color2: "#FFFFFF" });
      postFX.flash("#FFD666", 0.7, 2);
      postFX.glitch(0.8, 4);
      postFX.shake(16, 22);
      this.floats.push({
        x: e.x, y: e.y - 40, text: `BOSS 击破！+${gained}`,
        color: "#FFD666", life: 1.8, maxLife: 1.8, size: 22,
      });
      this.floats.push({
        x: e.x, y: e.y - 14, text: "SLOW MOTION",
        color: "#FF7AB8", life: 1.2, maxLife: 1.2, size: 11,
      });
      this.toast = {
        text: `击破 ${e.bossRef.name}！召唤小怪四散溃逃`,
        tone: "good",
        until: this.t + 2.5,
      };
      playSfx("win");
      for (const minion of this.enemies) {
        if (!minion.bossRef) {
          this.particles.spawnBurst(minion.x, minion.y, "#7A8FB0", { sparks: 6, dots: 8, speed: 160, life: 0.5, size: 2 });
        }
      }
      this.enemies = this.enemies.filter((m) => m.bossRef);
      // v7：击破 BOSS 时检查口诀解锁
      this.checkTermUnlocksForBoss(e.bossRef.id);
    }
  }

  // ====================================================================
  // v7：反诈口诀收集（击杀 BOSS / 爬塔里程碑 / 总击杀里程碑触发）
  // ====================================================================

  /** 检查 BOSS 击破触发的口诀解锁 */
  private checkTermUnlocksForBoss(bossId: string): void {
    const termIndices = getTermsForBossKill(bossId);
    for (const idx of termIndices) {
      if (platformStore.collectTerm(idx)) {
        this.newlyCollectedTerms.push(idx);
        const term = MAZE_TERMS[idx] ?? `口诀 ${idx}`;
        this.floats.push({
          x: W / 2, y: H / 2 - 60,
          text: `📜 收集口诀：${term}`,
          color: "#FFD666", life: 2.2, maxLife: 2.2, size: 16,
        });
      }
    }
  }

  /** 检查爬塔楼层里程碑触发的口诀解锁 */
  private checkTermUnlocksForTowerFloor(floor: number): void {
    const termIndices = getTermsForTowerFloor(floor);
    for (const idx of termIndices) {
      if (platformStore.collectTerm(idx)) {
        this.newlyCollectedTerms.push(idx);
        const term = MAZE_TERMS[idx] ?? `口诀 ${idx}`;
        this.floats.push({
          x: W / 2, y: H / 2 - 60,
          text: `📜 收集口诀：${term}`,
          color: "#FFD666", life: 2.2, maxLife: 2.2, size: 16,
        });
      }
    }
  }

  /** 检查总击杀里程碑触发的口诀解锁（游戏结束时调用） */
  private checkTermUnlocksForTotalKills(): void {
    // 预估总击杀：已存储的 + 本局击杀（recordManagerGame 尚未调用）
    const storedKills = platformStore.managerMetaProgress().totalKills;
    const projectedTotal = storedKills + this.bustedCount;
    const termIndices = getTermsForTotalKills(projectedTotal);
    for (const idx of termIndices) {
      if (platformStore.collectTerm(idx)) {
        this.newlyCollectedTerms.push(idx);
        const term = MAZE_TERMS[idx] ?? `口诀 ${idx}`;
        this.floats.push({
          x: W / 2, y: H / 2 - 80,
          text: `📜 收集口诀：${term}`,
          color: "#FFD666", life: 2.4, maxLife: 2.4, size: 16,
        });
      }
    }
  }

  // ====================================================================
  // v6：新敌人能力 —— split（分裂）+ enrage（附近敌人狂暴）
  // ====================================================================

  /** 敌人死亡时触发的被动能力（split / enrage） */
  private handleEnemyDeathAbilities(e: Enemy): void {
    // split：分裂为 2 个小怪（hp = maxHp × 0.3）
    if (e.def.ability === "split" && !e.bossRef) {
      for (let i = 0; i < 2; i++) {
        const splitDef: EnemyDef = {
          ...e.def,
          id: `${e.def.id}_split`,
          name: `${e.def.name}(分裂)`,
          hp: Math.max(1, Math.round(e.maxHp * 0.3)),
          ability: "none",
        };
        const { wps, startIdx } = this.pickEnemyWaypoints();
        const ox = (Math.random() - 0.5) * 30;
        const oy = (Math.random() - 0.5) * 30;
        this.enemies.push({
          uid: this.uidSeq++,
          def: splitDef,
          x: e.x + ox,
          y: e.y + oy,
          hp: splitDef.hp,
          maxHp: splitDef.hp,
          slowUntil: 0,
          pathIdx: startIdx,
          myWaypoints: wps,
          myPathIdx: startIdx,
          wobble: Math.random() * Math.PI * 2,
          radius: 14,
          shieldConsumed: false,
        });
        this.particles.spawnBurst(e.x + ox, e.y + oy, e.def.color, { sparks: 8, dots: 10, speed: 160, life: 0.5, size: 2 });
      }
    }

    // enrage：附近敌人死亡时，自身 attack +20%（累计，作用于到达出口伤害）
    for (const other of this.enemies) {
      if (other === e) continue;
      if (other.def.ability === "enrage" && Math.hypot(other.x - e.x, other.y - e.y) < 100) {
        other.enrageStacks = (other.enrageStacks ?? 0) + 1;
        this.particles.spawnBurst(other.x, other.y, "#E5353B", { sparks: 6, dots: 8, speed: 140, life: 0.4, size: 2 });
      }
    }
  }

  // ====================================================================
  // v4：探员升级阶段（5 选 3 随机）
  // ====================================================================

  private enterUpgrade(): void {
    this.upgradeReady = true;
    this.currentUpgradeChoices = pickUpgradeChoices(3);
    this.toast = {
      text: `✨ 资源满！选择一项全局强化（${this.upgradeCount + 1}/${UPGRADE_MAX_COUNT + this.upgradeMaxCountBonus}）`,
      tone: "good",
      until: this.t + 3,
    };
    // v7：升级触发 —— 保留 flash（关键事件）+ 粒子
    postFX.flash("#FFD666", 0.35, 1.8);
    this.particles.spawnBurst(W / 2, H / 2, "#FFD666", { ring: true, sparks: 20, dots: 24, speed: 260, life: 0.9, size: 4 });
    this.emitHud();
  }

  chooseUpgrade(kind: AgentUpgradeKind): void {
    if (!this.upgradeReady) return;
    this.upgradeReady = false;
    this.upgradeCount += 1;
    this.upgrades.push(kind);
    this.upgradeXp = 0;
    const choice = this.currentUpgradeChoices.find((c) => c.id === kind);
    if (choice) {
      this.toast = { text: `${choice.emoji} ${choice.title}！${choice.desc}`, tone: "good", until: this.t + 2.5 };
      for (const a of this.agents) {
        if (a.alive) {
          this.particles.spawnBurst(a.x, a.y, choice.color, { ring: true, sparks: 12, dots: 14, speed: 200, life: 0.7, size: 3 });
        }
      }
      postFX.flash(choice.color, 0.3, 1.5);
    }
    this.currentUpgradeChoices = [];
    playSfx("good");
    this.emitHud();
  }

  /** v5：升级倍率（新增 doubleShot / pierce / vampire 在 fireProjectile/applyHit 中直接读 upgrades 计数） */
  private upgradeMul(kind: AgentUpgradeKind): number {
    const count = this.upgrades.filter((u) => u === kind).length;
    if (kind === "attack") return 1 + 0.35 * count;
    if (kind === "firerate") return 1 + 0.28 * count;
    if (kind === "range") return 1 + 0.25 * count;
    if (kind === "crit") return 1 + 0.18 * count; // 暴击率加成（实际应用在 fireProjectile）
    if (kind === "hpregen") return 1 + 0.04 * count; // 每级 +4% 上限的回血（实际在 updateAgents 用）
    // v5：以下三项的"倍率"不参与属性乘算，仅在 fireProjectile/applyHit 内通过 upgrades.filter() 计数生效
    if (kind === "doubleShot") return 1 + count; // >1 表示已激活
    if (kind === "pierce") return 1 + count; // >1 表示已激活
    if (kind === "vampire") return 1 + count; // >1 表示已激活
    return 1;
  }

  private updateEnergy(dt: number): void {
    if (this.mode === "daily" && this.hasModifier("noUlt")) return;
    // v5：BOSSrush 模式下能量积累加速（×1.8）—— 更频繁的大招 = 更快节奏的 BOSS 战
    const energyMul = this.mode === "bossRush" ? 1.8 : 1;
    // v6：遗物 energyRegenMul 加成
    this.energy = clamp(this.energy + dt * 2 * energyMul * this.energyRegenMul, 0, 100);
    this.emitHud();
  }

  private updateFloats(dt: number): void {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= dt * 40;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
  }

  // ====================================================================
  // 胜负结算
  // ====================================================================

  private win(): void {
    if (this.over) return;
    this.over = true;
    const bonus = Math.floor(this.base.hp * 5);
    const timeBonus = this.mode === "timeTrial" ? Math.floor(this.timeLeft * 10) : 0;
    const dailyMul = this.mode === "daily" ? dailyScoreMul(this.dailyModifiers) : 1;
    const finalScore = Math.round((this.score + bonus + timeBonus) * dailyMul);
    this.result = {
      gameId: "manager",
      win: true,
      score: finalScore,
      bustedCount: this.bustedCount,
      wave: this.mode === "endlessRush" ? this.endlessAbsWave + 1
        : this.mode === "bossRush" ? this.bossIdx + 1
        : this.wave + 1,
      tipId: randomTip(7).id,
    };
    const msg = this.mode === "timeTrial"
      ? `坚持到底！时间奖励 +${timeBonus}`
      : this.mode === "bossRush"
      ? "全部电诈首脑已伏法！"
      : this.mode === "endlessRush"
      ? `无尽坚守：反诈波次 ${this.endlessAbsWave + 1} · TIER ${endlessScaling(this.endlessAbsWave).tier + 1}`
      : this.mode === "daily"
      ? `每日挑战完成！分数 ×${dailyMul.toFixed(1)}`
      : "诈骗团伙全军覆没！";
    this.toast = { text: msg, tone: "good", until: this.t + 3 };
    postFX.flash("#52C41A", 0.5, 2);
    this.particles.spawnBurst(W / 2, H / 2, "#52C41A", { ring: true, sparks: 30, dots: 40, speed: 320, life: 1.2, size: 5, color2: "#FFD666" });
    playSfx("win");
    // v7：游戏结束时检查总击杀里程碑口诀解锁
    this.checkTermUnlocksForTotalKills();
    this.emit({ type: "result", payload: this.result });
  }

  private lose(): void {
    if (this.over) return;
    // v6：reviveOnce 遗物 —— 基地失守时复活一次（30% 血）
    if (this.reviveOnceAvailable && this.base.hp <= 0) {
      this.reviveOnceAvailable = false;
      this.base.hp = Math.max(1, Math.round(this.base.max * 0.3));
      this.baseShield = Math.max(this.baseShield, this.base.max * 0.2);
      this.toast = { text: "💗 复活装置启动！基地恢复 30% 生命", tone: "good", until: this.t + 3 };
      postFX.flash("#FF3B6B", 0.5, 2);
      this.particles.spawnBurst(W / 2, H / 2, "#FF3B6B", { ring: true, shockwave: true, sparks: 40, dots: 50, speed: 380, life: 1.2, size: 6, color2: "#FFD666" });
      playSfx("shieldBreak");
      this.emitHud();
      return;
    }
    this.over = true;
    this.result = {
      gameId: "manager",
      win: false,
      score: this.score,
      bustedCount: this.bustedCount,
      wave: this.mode === "endlessRush" ? this.endlessAbsWave + 1
        : this.mode === "bossRush" ? this.bossIdx + 1
        : this.mode === "timeTrial" ? Math.ceil(TIME_TRIAL_DURATION - this.timeLeft)
        : (this.mode === "classic" || this.mode === "daily") ? this.wave + 1
        : undefined,
      tipId: randomTip(3).id,
    };
    // v7：失败 —— 保留 flash + shake，移除 glitch（避免失败瞬间叠加故障闪烁）
    postFX.flash("#E5353B", 0.45, 2);
    postFX.shake(10, 16);
    playSfx("lose");
    // v7：游戏结束时检查总击杀里程碑口诀解锁
    this.checkTermUnlocksForTotalKills();
    this.emit({ type: "result", payload: this.result });
  }

  // ====================================================================
  // HUD 发射
  // ====================================================================

  private emitHud(): void {
    const bossEnemy = this.enemies.find((e) => e.bossRef);
    const endlessTier = this.mode === "endlessRush" ? endlessScaling(this.endlessAbsWave).tier : undefined;
    const ultAgent = this.agents.find((a) => a.alive);

    const hud: ManagerHud = {
      phase: this.over ? (this.result?.win ? "won" : "lost") : this.upgradeReady ? "upgrade" : "battle",
      baseHp: Math.ceil(this.base.hp),
      baseMax: this.base.max,
      wave: this.wave + 1,
      totalWaves: this.mode === "bossRush" ? BOSS_RUSH_BOSSES.length
        : this.mode === "endlessRush" ? Infinity
        : this.mode === "timeTrial" ? 1
        : (this.mode === "classic" || this.mode === "daily")
          ? (this.level < this.maxLevel ? LEVELS[this.level - 1].targetWave : Infinity)
          : WAVES.length,
      score: this.score,
      enemiesLeft: this.enemies.length + this.spawnQueue.filter((s) => !s.spawned).length,
      energy: Math.floor(this.energy),
      ultReady: this.energy >= 100 && !(this.mode === "daily" && this.hasModifier("noUlt")),
      agents: this.agents.map((a) => ({
        id: a.id, hp: Math.ceil(a.hp), maxHp: a.maxHp, alive: a.alive,
      })),
      waveProgress: this.spawnQueue.length
        ? this.spawnQueue.filter((s) => s.spawned).length / this.spawnQueue.length
        : 0,
      mode: this.mode,
      modeLabel: this.modeLabel,
      timeLeft: (this.mode === "timeTrial" || (this.mode === "daily" && this.hasModifier("timeLimit")))
        ? Math.max(0, this.timeLeft) : undefined,
      bossName: bossEnemy?.bossRef?.name,
      bossEmoji: bossEnemy?.bossRef?.emoji,
      bossHp: bossEnemy ? Math.ceil(bossEnemy.hp) : undefined,
      bossMaxHp: bossEnemy?.bossRef?.hp,
      bossEnraged: bossEnemy?.enraged,
      bossSkill: bossEnemy?.bossRef?.skillName,
      bossIdx: this.mode === "bossRush" ? this.bossIdx : undefined,
      bossTotal: this.mode === "bossRush" ? BOSS_RUSH_BOSSES.length : undefined,
      endlessWave: this.mode === "endlessRush" ? this.endlessAbsWave + 1 : undefined,
      rushTier: endlessTier !== undefined ? endlessTier + 1 : undefined,
      upgradeXp: this.upgradeXp,
      upgradeXpMax: UPGRADE_XP_THRESHOLD,
      upgradeReady: this.upgradeReady,
      upgradeCount: this.upgradeCount,
      upgradeMax: UPGRADE_MAX_COUNT + this.upgradeMaxCountBonus,
      // v4：使用当前随机抽出的 3 个选项
      upgradeChoices: this.upgradeReady ? this.currentUpgradeChoices.slice() : undefined,
      agentUpgrades: this.agents.map((a) => ({
        id: a.id, level: this.upgrades.length, upgrades: this.upgrades.slice(),
      })),
      level: this.level,
      maxLevel: this.maxLevel,
      levelName: LEVELS[this.level - 1]?.name,
      levelAccent: LEVELS[this.level - 1]?.accent,
      levelTargetWave: LEVELS[this.level - 1]?.targetWave,
      levelTransitioning: this.t < this.levelTransitionUntil,
      cultAgents: this.cultAgents.map((c) => ({
        id: c.id, name: c.def.name, emoji: c.def.emoji, color: c.def.color,
        level: c.level, maxLevel: c.maxLevel, unlocked: c.unlocked,
        buff: c.def.buff, buffValue: c.def.buffPerLevel * c.level, desc: c.def.desc,
      })),
      cultUpgradeReady: (() => {
        const t = this.cultAgents.find((x) => x.unlocked && x.level < x.maxLevel);
        if (!t) return false;
        const cost = CULT_UPGRADE_COST[t.level - 1] ?? Infinity;
        return this.score >= cost;
      })(),
      cultUpgradeCost: (() => {
        const t = this.cultAgents.find((x) => x.unlocked && x.level < x.maxLevel);
        if (!t) return undefined;
        return CULT_UPGRADE_COST[t.level - 1] ?? Infinity;
      })(),
      cultUpgradeTargetId: this.cultAgents.find((x) => x.unlocked && x.level < x.maxLevel)?.id,

      // ===== v3 新增 =====
      comboCount: this.combo.count,
      comboMul: this.combo.multiplier,
      comboActive: this.combo.count >= COMBO_CONFIG.showThreshold,
      comboMax: this.combo.maxCount,
      dailyModifiers: this.dailyModifiers.length > 0 ? this.dailyModifiers : undefined,
      dailySeed: this.dailySeed || undefined,
      bossPhaseIdx: bossEnemy?.bossPhaseIdx,
      bossPhaseName: this.bossPhaseName || undefined,
      ultName: ultAgent?.def.ultDef.name,
      ultDesc: ultAgent?.def.ultDef.desc,
      ultEmoji: ultAgent?.def.emoji,
      lastElementalHint: this.lastElementalHint && this.t - this.lastElementalHint.at < 1
        ? this.lastElementalHint : undefined,

      // ===== v4 迷宫版新增 =====
      mazeName: this.maze.name,
      mazeAccent: this.maze.accent,
      resourceTotal: this.upgradeXp,

      // ===== v6 全面升级新增 =====
      // Phase 2.1：战术装置 / 战术暂停 / 元素反应
      tacticalDevices: TACTICAL_DEVICES.map((d) => ({
        kind: d.kind,
        remaining: this.tacticalDevices.filter((dev) => dev.kind === d.kind).length > 0 ? 1 : 0,
        cooldownLeft: Math.max(0, (this.deviceCooldowns[d.kind] ?? 0) - this.t),
      })),
      tacticalPauseRemaining: this.tacticalPauseRemaining,
      activeElementReactions: this.elementReactions
        .filter((r) => this.t - r.activatedAt < r.def.duration)
        .map((r) => ({ kind: r.def.kind as ElementReactionKind, remaining: Math.max(0, r.def.duration - (this.t - r.activatedAt)) })),

      // Phase 2.2：技能链 / 战间答题
      activeSkillLinks: this.activeSkillLinkStates
        .filter((s) => this.t - s.lastTriggeredAt < 3)
        .map((s) => ({ id: s.link.id, name: s.link.name, remaining: Math.max(0, 3 - (this.t - s.lastTriggeredAt)) })),
      pendingQuiz: this.pendingQuiz ?? undefined,
      pendingQuizIsRetry: this.pendingQuiz ? this.pendingQuizIsRetry : undefined,
      // v7：爬塔事件
      pendingTowerEvent: this.pendingTowerEvent ?? undefined,
      quizBuffUntil: this.quizBuffUntil > this.t ? this.quizBuffUntil : undefined,

      // Phase 2.3：遗物 / 装备 / 皮肤 / 爬塔 / 词缀
      towerFloor: this.towerFloor || undefined,
      challengeAffixes: this.challengeAffixes.length > 0 ? this.challengeAffixes : undefined,
      equippedRelics: this.equippedRelics,
      agentEquipment: this.agentEquipmentMap,
      agentSkins: this.agentSkinsMap,
    };
    this.emit({ type: "hud", payload: hud as unknown as Record<string, string | number> });
    if (this.toast && this.t < this.toast.until) {
      this.emit({ type: "toast", text: this.toast.text, tone: this.toast.tone });
    }
  }

  // ====================================================================
  // v4：渲染（迷宫路径 / 岗哨位 / 入口出口 / 角色剪影 / 敌人形状 / 拖尾）
  // ====================================================================

  protected render(): void {
    const ctx = this.ctx;
    const shaking = this.t < this.shakeUntil;
    const sx = shaking ? (Math.random() - 0.5) * 6 : 0;
    const sy = shaking ? (Math.random() - 0.5) * 6 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // v4：关卡主题背景 + 迷宫
    this.drawThemedBackground(ctx);

    // v4：迷宫路径与岗哨位
    this.drawMaze(ctx);

    // 基地（在出口位置）
    this.drawBase(ctx);

    // 生成区域（在入口位置）
    this.drawEntrance(ctx);

    this.drawCultAgents(ctx);

    // 探员（v3：剪影）
    for (const a of this.agents) {
      this.drawAgent(ctx, a);
    }

    // 敌人（v3：形状）
    for (const e of this.enemies) {
      this.drawEnemy(ctx, e);
    }

    // 投射物（v3：拖尾）
    this.drawProjectiles(ctx);

    this.particles.render(ctx);

    // 飘字
    for (const f of this.floats) {
      const alpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      drawText(ctx, f.text, f.x, f.y, {
        size: f.size, color: f.color, weight: "900", align: "center",
        shadow: { color: f.color, blur: 8 },
      });
      ctx.globalAlpha = 1;
    }

    // 大招闪光
    if (this.t < this.ultFlashUntil) {
      const alpha = (this.ultFlashUntil - this.t) / 0.6;
      ctx.fillStyle = `rgba(255,214,102,${alpha * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 准备倒计时
    this.drawPrepOverlay(ctx);

    // v6：连击流光边框（连击越高边框越亮、颜色越炫）
    this.drawComboBorder(ctx);

    ctx.restore();
  }

  /** v8：关卡主题背景 —— 每关独立渐变 + 主题氛围层 + 网格 + 装饰 */
  private drawThemedBackground(ctx: CanvasRenderingContext2D): void {
    const theme = LEVELS[this.level - 1]?.theme;
    const bgDeep = theme?.bgDeep ?? "#0A1929";
    const gridColor = theme?.gridColor ?? "rgba(0,229,255,0.05)";
    const decoration = theme?.decoration ?? "city";

    // v8：每关独立垂直渐变背景（取代纯色 fillRect，增加纵深感）
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    const rgb = this.hexToRgb(bgDeep);
    switch (decoration) {
      case "residential":
        // 社区：顶部暖绿微亮 → 底部深绿（街灯感）
        grad.addColorStop(0, `rgba(${rgb},1)`);
        grad.addColorStop(0.4, `rgba(${rgb},1)`);
        grad.addColorStop(1, `rgba(${this.shiftRgb(rgb, -12, -8, -6)},1)`);
        break;
      case "city":
        // 都市：顶部青色微亮 → 底部深蓝（霓虹夜空感）
        grad.addColorStop(0, `rgba(${this.shiftRgb(rgb, 6, 10, 16)},1)`);
        grad.addColorStop(0.5, `rgba(${rgb},1)`);
        grad.addColorStop(1, `rgba(${this.shiftRgb(rgb, -6, -4, 0)},1)`);
        break;
      case "border":
        // 边境：顶部暗紫 → 底部暗红（危险边境感）
        grad.addColorStop(0, `rgba(${rgb},1)`);
        grad.addColorStop(0.6, `rgba(${rgb},1)`);
        grad.addColorStop(1, `rgba(${this.shiftRgb(rgb, 16, -6, -10)},1)`);
        break;
      default:
        grad.addColorStop(0, bgDeep);
        grad.addColorStop(1, bgDeep);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawGrid(ctx, W, H, 32, gridColor);

    // v8：主题氛围层（每关独有的环境光效）
    this.drawThemeAmbient(ctx, decoration);

    // v8：远景装饰（多层视差）
    if (theme) {
      this.drawDecorations(ctx, theme);
    }
  }

  /**
   * v8：主题氛围层 —— 每关独有的环境光效
   * - residential：散落暖光点（街灯/窗户灯光）
   * - city：横向霓虹光带（都市灯轨）
   * - border：边缘警示斜纹（边境警戒区）
   */
  private drawThemeAmbient(ctx: CanvasRenderingContext2D, decoration: string): void {
    const t = this.t;
    ctx.save();
    switch (decoration) {
      case "residential": {
        // 散落暖光点（街灯感），缓慢闪烁
        ctx.globalCompositeOperation = "lighter";
        const lamps = 14;
        for (let i = 0; i < lamps; i++) {
          const seed = i * 137.5;
          const x = (seed * 2.3) % W;
          const y = ((seed * 1.7) % (H * 0.7)) + 20;
          const flicker = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 0.9);
          const r = 3 + flicker * 2;
          const a = 0.08 + flicker * 0.06;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
          g.addColorStop(0, `rgba(255,200,80,${a})`);
          g.addColorStop(1, "rgba(255,200,80,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "city": {
        // 横向霓虹光带（都市灯轨），缓慢上下扫动
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 3; i++) {
          const baseY = 60 + i * 80 + Math.sin(t * 0.3 + i) * 8;
          const g = ctx.createLinearGradient(0, baseY - 20, 0, baseY + 20);
          const color = i === 0 ? "0,229,255" : i === 1 ? "255,176,32" : "179,136,255";
          g.addColorStop(0, `rgba(${color},0)`);
          g.addColorStop(0.5, `rgba(${color},0.04)`);
          g.addColorStop(1, `rgba(${color},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, baseY - 20, W, 40);
        }
        break;
      }
      case "border": {
        // 顶部/底部边缘警示斜纹（缓慢移动）
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = "#E5353B";
        ctx.lineWidth = 12;
        const off = (t * 20) % 40;
        for (let x = -40; x < W + 40; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x + off, 0);
          ctx.lineTo(x + off + 20, 20);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + off, H);
          ctx.lineTo(x + off + 20, H - 20);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  /**
   * v8：RGB 偏移工具（用于渐变配色，避免引入额外色库）
   * 输入 "r,g,b" 字符串 + 各通道偏移量，返回新的 "r,g,b" 字符串
   */
  private shiftRgb(rgbStr: string, dr: number, dg: number, db: number): string {
    const parts = rgbStr.split(",").map((s) => parseInt(s.trim(), 10));
    if (parts.length !== 3) return rgbStr;
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    return `${clamp(parts[0] + dr)},${clamp(parts[1] + dg)},${clamp(parts[2] + db)}`;
  }

  /**
   * v7：绘制分支迷宫（全面视觉升级）
   * - 路径格子按"危险→安全"红→青渐变填充 + 脉动呼吸
   * - 每条 edge 三层描边：底层粗发光 + 中层流动虚线 + 顶层能量粒子流
   * - 岔路口能量场：核心光球 + 3 段旋转弧 + 外环脉冲
   * - 岗哨位呼吸光圈：脉动虚线方框 + 占据时高亮
   * - 入口传送门：危险脉冲 + 螺旋粒子 + 环形警示
   * - 出口护盾光环：多层旋转环 + 信号光柱 + 防御脉冲
   */
  private drawMaze(ctx: CanvasRenderingContext2D): void {
    const mazeAccent = this.maze.accent;
    const accentRgb = this.hexToRgb(mazeAccent);
    const t = this.t;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);

    // 1) 路径格子渐变填充：入口(红/危险) → 出口(青/安全) + 脉动
    const entCell = this.maze.entrance;
    const extCell = this.maze.exit;
    const totalDist = Math.abs(entCell.col - extCell.col) + Math.abs(entCell.row - extCell.row) || 1;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const cell of this.maze.pathCells) {
      const distFromEnt = Math.abs(cell.col - entCell.col) + Math.abs(cell.row - entCell.row);
      const ratio = Math.min(1, distFromEnt / totalDist);
      // 红 (229,53,59) → 青 (0,229,255)
      const r = Math.round(229 * (1 - ratio) + 0 * ratio);
      const g = Math.round(53 * (1 - ratio) + 229 * ratio);
      const b = Math.round(59 * (1 - ratio) + 255 * ratio);
      const x = MAZE_OFFSET_X + cell.col * MAZE_CELL;
      const y = MAZE_OFFSET_Y + cell.row * MAZE_CELL;
      // v7：脉动呼吸（靠近入口的格子脉冲更强，制造"危险涌动"感）
      const cellPulse = 0.08 + (1 - ratio) * 0.06 * (0.5 + 0.5 * Math.sin(t * 4 + distFromEnt * 0.3));
      ctx.fillStyle = `rgba(${r},${g},${b},${cellPulse})`;
      ctx.fillRect(x, y, MAZE_CELL, MAZE_CELL);
      // v9：反诈术语 —— 每格一句短口诀，低透明度不干扰战斗，强化学习曝光
      const term = cellTerm(cell.col, cell.row);
      const termAlpha = 0.30 + (1 - ratio) * 0.12 * (0.5 + 0.5 * Math.sin(t * 2 + distFromEnt * 0.2));
      ctx.font = "7px sans-serif";
      ctx.fillStyle = `rgba(255,255,255,${termAlpha})`;
      ctx.fillText(term, x + MAZE_CELL / 2, y + MAZE_CELL / 2);
    }
    ctx.restore();

    // 2) 路径三层描边：底层发光 + 中层流动虚线 + 顶层能量粒子流
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const edge of this.maze.edges) {
      if (edge.cells.length < 2) continue;
      const cx = (c: { col: number; row: number }) => MAZE_OFFSET_X + c.col * MAZE_CELL + MAZE_CELL / 2;
      const cy = (c: { col: number; row: number }) => MAZE_OFFSET_Y + c.row * MAZE_CELL + MAZE_CELL / 2;
      // 2a) 底层发光描边（粗、半透明、带 shadowBlur 制造光晕）
      ctx.strokeStyle = `rgba(${accentRgb},0.18)`;
      ctx.lineWidth = 10;
      ctx.shadowColor = mazeAccent;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx(edge.cells[0]), cy(edge.cells[0]));
      for (let i = 1; i < edge.cells.length; i++) {
        ctx.lineTo(cx(edge.cells[i]), cy(edge.cells[i]));
      }
      ctx.stroke();
      // 2b) 中层流动虚线（细、亮、动画 offset 制造"能量流动"感）
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(${accentRgb},0.6)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -t * 40;
      ctx.stroke();
      ctx.setLineDash([]);
      // 2c) v7：顶层能量粒子流 —— 沿路径移动的发光小点（每条 edge 2-3 颗）
      const pts = edge.cells.map((c) => ({ x: cx(c), y: cy(c) }));
      const segLens: number[] = [];
      let totalLen = 0;
      for (let i = 1; i < pts.length; i++) {
        const dl = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        segLens.push(dl);
        totalLen += dl;
      }
      if (totalLen > 0) {
        const particleCount = Math.min(3, Math.max(1, Math.floor(totalLen / 80)));
        for (let pi = 0; pi < particleCount; pi++) {
          // 每颗粒子有自己的相位偏移
          const phase = (t * 60 + pi * (totalLen / particleCount)) % totalLen;
          let acc = 0;
          let px = pts[0].x, py = pts[0].y;
          for (let si = 0; si < segLens.length; si++) {
            if (acc + segLens[si] >= phase) {
              const localT = (phase - acc) / segLens[si];
              px = pts[si].x + (pts[si + 1].x - pts[si].x) * localT;
              py = pts[si].y + (pts[si + 1].y - pts[si].y) * localT;
              break;
            }
            acc += segLens[si];
          }
          // 发光粒子（加性混合 + 光晕）
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = `rgba(${accentRgb},0.9)`;
          ctx.shadowColor = mazeAccent;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(px, py, 2.5 + pulse * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalCompositeOperation = "source-over";
        }
      }
      // 2d) v8：路径流向箭头（chevrons，指示敌人流动方向 entrance → exit）
      // 沿路径前移的 V 形箭头，强化"敌人潮涌"方向感与爽感
      if (totalLen > 24) {
        const arrowCount = totalLen > 140 ? 2 : 1;
        const spacing = totalLen / arrowCount;
        const flowPhase = (t * 30) % spacing;
        for (let ai = 0; ai < arrowCount; ai++) {
          let pos = ai * spacing + flowPhase;
          if (pos < 10) pos = 10;
          if (pos > totalLen - 10) pos = totalLen - 10;
          // 定位 + 切线方向
          let acc2 = 0;
          let ax = pts[0].x, ay = pts[0].y;
          let dx = 1, dy = 0;
          for (let si = 0; si < segLens.length; si++) {
            if (acc2 + segLens[si] >= pos) {
              const localT = (pos - acc2) / segLens[si];
              ax = pts[si].x + (pts[si + 1].x - pts[si].x) * localT;
              ay = pts[si].y + (pts[si + 1].y - pts[si].y) * localT;
              const sdx = pts[si + 1].x - pts[si].x;
              const sdy = pts[si + 1].y - pts[si].y;
              const sl = Math.hypot(sdx, sdy) || 1;
              dx = sdx / sl;
              dy = sdy / sl;
              break;
            }
            acc2 += segLens[si];
          }
          const size = 5 + pulse * 1.2;
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(Math.atan2(dy, dx));
          ctx.strokeStyle = `rgba(${accentRgb},${0.55 + pulse * 0.25})`;
          ctx.lineWidth = 1.8;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.shadowColor = mazeAccent;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(0, -size);
          ctx.lineTo(size, 0);
          ctx.lineTo(0, size);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 3) 岗哨位呼吸光圈（脉动虚线方框，空位才显示）
    ctx.save();
    const breath = 0.5 + 0.5 * Math.sin(t * 2.5);
    ctx.strokeStyle = `rgba(0,229,255,${0.15 + breath * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -t * 10;
    const half = MAZE_CELL / 2 - 2;
    for (const tile of this.maze.deployTiles) {
      const occupied = this.agents.find((a) => a.col === tile.col && a.row === tile.row);
      if (occupied) continue;
      ctx.strokeRect(tile.x - half, tile.y - half, half * 2, half * 2);
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 4) 岔路口能量场（核心光球 + 3 段旋转弧 + 外环脉冲）
    ctx.save();
    for (const node of this.maze.nodes) {
      if (node.kind === "entrance" || node.kind === "exit") continue;
      // v7：外环脉冲（扩散圈，每 2 秒一次）
      const ringPhase = (t * 0.5) % 1;
      const ringR2 = 12 + ringPhase * 16;
      ctx.strokeStyle = `rgba(${accentRgb},${(1 - ringPhase) * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, ringR2, 0, Math.PI * 2);
      ctx.stroke();
      // 核心光球
      ctx.fillStyle = `rgba(${accentRgb},${0.3 + pulse * 0.25})`;
      ctx.shadowColor = mazeAccent;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 5 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 3 段旋转弧（能量场环）
      ctx.strokeStyle = `rgba(${accentRgb},${0.45 + pulse * 0.2})`;
      ctx.lineWidth = 1.5;
      const ringR = 10 + pulse * 2;
      const rot = t * 1.5;
      for (let i = 0; i < 3; i++) {
        const a0 = rot + (i * Math.PI * 2) / 3;
        const a1 = a0 + Math.PI / 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringR, a0, a1);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 5) 入口传送门（诈骗窝点）
    this.drawEntrancePortal(ctx, this.maze.entrancePt, t, pulse);

    // 6) 出口护盾光环（反诈基地）
    this.drawExitShield(ctx, this.maze.exitPt, t, pulse);

    // 7) 迷宫名称（左上角，显示分支数/路径数）
    drawText(ctx, `🗺️ ${this.maze.name} · 分支 ${this.maze.nodes.length}节点/${this.maze.edges.length}边`, 16, 60, {
      size: 11, color: mazeAccent, weight: "700", align: "left",
      shadow: { color: mazeAccent, blur: 4 },
    });
    void clipPath;
  }

  /** v7：入口传送门（诈骗窝点）—— 危险脉冲环 + 螺旋粒子 + 扩散警示环
   *  v8：入口主题差异化（社区🚪/都市🏭/边境🌴） */
  private drawEntrancePortal(ctx: CanvasRenderingContext2D, ent: Pt, t: number, pulse: number): void {
    // v8：入口主题差异化
    const decoration = LEVELS[this.level - 1]?.theme?.decoration ?? "city";
    let entEmoji: string, entLabel: string;
    switch (decoration) {
      case "residential": entEmoji = "🚪"; entLabel = "可疑角落"; break;
      case "border": entEmoji = "🌴"; entLabel = "走私通道"; break;
      default: entEmoji = "🏭"; entLabel = "诈骗据点"; break;
    }
    ctx.save();
    // v7：扩散警示环（每 1.6 秒一波向外扩散，强化"敌情来袭"紧迫感）
    const ringPhase = (t * 0.625) % 1;
    const ringR = 18 + ringPhase * 28;
    ctx.strokeStyle = `rgba(229,53,59,${(1 - ringPhase) * 0.5})`;
    ctx.lineWidth = 2 * (1 - ringPhase) + 0.5;
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    // 危险脉冲光晕（径向渐变，更有层次）
    const auraR = 24 + pulse * 6;
    const grad = ctx.createRadialGradient(ent.x, ent.y, 4, ent.x, ent.y, auraR);
    grad.addColorStop(0, `rgba(229,53,59,${0.35 + pulse * 0.15})`);
    grad.addColorStop(0.6, `rgba(229,53,59,${0.15 + pulse * 0.08})`);
    grad.addColorStop(1, "rgba(229,53,59,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, auraR, 0, Math.PI * 2);
    ctx.fill();
    // 主环（带红色光晕）
    ctx.strokeStyle = "#E5353B";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#E5353B";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, 16, 0, Math.PI * 2);
    ctx.stroke();
    // v7：6 颗螺旋粒子绕圈（加性混合，更亮的吸入感）
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 8;
    for (let i = 0; i < 6; i++) {
      const a = t * 2.8 + (i * Math.PI) / 3;
      const r = 10 + Math.sin(t * 4 + i) * 4;
      const px = ent.x + Math.cos(a) * r;
      const py = ent.y + Math.sin(a) * r;
      ctx.fillStyle = "#FF6B6B";
      ctx.beginPath();
      ctx.arc(px, py, 2.5 + pulse * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(entEmoji, ent.x, ent.y);
    ctx.restore();
    drawText(ctx, entLabel, ent.x, ent.y - 34, {
      size: 10, color: "#E5353B", weight: "700", align: "center", font: Theme.fonts.mono,
      shadow: { color: "#E5353B", blur: 4 },
    });
  }

  /** v7：出口护盾光环（反诈基地）—— 多层旋转环 + 信号光柱 + 旋转护盾段
   *  v8：出口主题差异化（社区🏪警务室/都市🛡️反诈中心/边境🛂海关） */
  private drawExitShield(ctx: CanvasRenderingContext2D, exit: Pt, t: number, pulse: number): void {
    // v8：出口主题差异化
    const decoration = LEVELS[this.level - 1]?.theme?.decoration ?? "city";
    let extEmoji: string, extLabel: string;
    switch (decoration) {
      case "residential": extEmoji = "🏪"; extLabel = "社区警务室"; break;
      case "border": extEmoji = "🛂"; extLabel = "海关关卡"; break;
      default: extEmoji = "🛡️"; extLabel = "反诈中心"; break;
    }
    ctx.save();
    // v7：护盾光晕（径向渐变，更有层次感）
    const auraR = 26 + pulse * 5;
    const grad = ctx.createRadialGradient(exit.x, exit.y, 4, exit.x, exit.y, auraR);
    grad.addColorStop(0, `rgba(0,229,255,${0.3 + pulse * 0.12})`);
    grad.addColorStop(0.6, `rgba(0,229,255,${0.12 + pulse * 0.06})`);
    grad.addColorStop(1, "rgba(0,229,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, auraR, 0, Math.PI * 2);
    ctx.fill();
    // 主环（带青色光晕）
    ctx.strokeStyle = "#00E5FF";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    // 外层虚线环（反向旋转）
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = t * 30;
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, 24 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    // v7：旋转护盾段（4 段弧，正向缓慢旋转，防御感）
    ctx.strokeStyle = `rgba(0,229,255,${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 6;
    const segRot = t * 0.8;
    for (let i = 0; i < 4; i++) {
      const a0 = segRot + (i * Math.PI) / 2;
      const a1 = a0 + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(exit.x, exit.y, 21, a0, a1);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // 向上信号光柱（基地呼叫感，v7 加宽 + 双层）
    const beamGrad = ctx.createLinearGradient(exit.x, exit.y, exit.x, exit.y - 44);
    beamGrad.addColorStop(0, `rgba(0,229,255,${0.45 + pulse * 0.2})`);
    beamGrad.addColorStop(1, "rgba(0,229,255,0)");
    ctx.fillStyle = beamGrad;
    ctx.fillRect(exit.x - 3, exit.y - 44, 6, 44);
    // 核心亮线
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,255,255,${0.3 + pulse * 0.2})`;
    ctx.fillRect(exit.x - 1, exit.y - 44, 2, 44);
    ctx.globalCompositeOperation = "source-over";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(extEmoji, exit.x, exit.y);
    ctx.restore();
    drawText(ctx, extLabel, exit.x, exit.y - 34, {
      size: 10, color: "#00E5FF", weight: "700", align: "center", font: Theme.fonts.mono,
      shadow: { color: "#00E5FF", blur: 4 },
    });
  }

  /**
   * v6：连击流光边框
   * - 连击 ≥ showThreshold 时显示屏幕内发光边框
   * - 强度随连击数递增，颜色低连击金色→高连击粉色
   * - 双层描边（粗发光 + 细内线）+ 脉动呼吸
   */
  private drawComboBorder(ctx: CanvasRenderingContext2D): void {
    if (this.combo.count < COMBO_CONFIG.showThreshold) return;
    const t = this.t;
    // 连击强度归一化 0..1（showThreshold → 15+ 为满）
    const intensity = Math.min(1, (this.combo.count - COMBO_CONFIG.showThreshold + 1) / 14);
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    // 颜色：低连击金色，高连击粉色
    const color = this.combo.count >= 10 ? "#FF7AB8" : "#FFD666";
    const rgb = this.hexToRgb(color);
    const alpha = 0.25 + intensity * 0.35 + pulse * 0.15 * intensity;
    ctx.save();
    // 外层粗发光描边
    ctx.strokeStyle = `rgba(${rgb},${alpha})`;
    ctx.lineWidth = 3 + intensity * 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 + intensity * 12;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    // 内层细线（双层流光感）
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${rgb},${alpha * 0.5})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.restore();
  }

  /** v5：十六进制颜色转 "r,g,b" 字符串（用于 rgba 拼接） */
  private hexToRgb(hex: string): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return "255,255,255";
    return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
  }

  /**
   * v8：关卡装饰 —— 双层视差远景
   * - 远景层（y≈30）：小尺寸、低透明、慢速横移（建筑/树丛剪影）
   * - 近景层（y≈H-22）：稍大、略亮、快速横移（路灯/植被前景）
   * 装饰内容随 theme.decoration 切换，每关视觉辨识度更高
   */
  private drawDecorations(ctx: CanvasRenderingContext2D, theme: LevelTheme): void {
    const emojis = theme.decorEmojis;
    const silColor = theme.silhouetteColor;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 远景层：慢速、小、暗
    const farSpeed = 8;
    const farSpacing = 110;
    const farOffset = (this.t * farSpeed) % farSpacing;
    ctx.globalAlpha = 0.10;
    ctx.font = "18px sans-serif";
    ctx.fillStyle = silColor;
    for (let i = 0; i < Math.ceil(W / farSpacing) + 2; i++) {
      const x = ((i * farSpacing - farOffset) % (W + farSpacing)) - 30;
      const y = 28;
      const emoji = emojis[i % emojis.length];
      ctx.fillText(emoji, x, y);
    }

    // 近景层：快速、大、亮（底部前景剪影）
    const nearSpeed = 18;
    const nearSpacing = 140;
    const nearOffset = (this.t * nearSpeed) % nearSpacing;
    ctx.globalAlpha = 0.16;
    ctx.font = "22px sans-serif";
    ctx.fillStyle = silColor;
    for (let i = 0; i < Math.ceil(W / nearSpacing) + 2; i++) {
      const x = ((i * nearSpacing - nearOffset) % (W + nearSpacing)) - 40;
      const y = H - 18;
      const emoji = emojis[(i + 3) % emojis.length];
      ctx.fillText(emoji, x, y);
    }

    ctx.restore();
  }

  /** v4：基地护盾条（在画面左上角，迷宫上方） */
  private drawBase(ctx: CanvasRenderingContext2D): void {
    const hpRatio = this.base.hp / this.base.max;
    // 基地 HP 条（横向，在迷宫上方 HUD 区）
    const barX = 16, barY = 72, barW = 200, barH = 8;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(barX, barY, barW, barH);
    const hpColor = hpRatio > 0.5 ? "#52C41A" : hpRatio > 0.25 ? "#FFD666" : "#E5353B";
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    drawText(ctx, "基地", barX, barY - 6, {
      size: 9, color: "#00E5FF", weight: "700", align: "left", font: Theme.fonts.mono,
    });
    drawText(ctx, `${Math.ceil(this.base.hp)}/${this.base.max}`, barX + barW, barY - 6, {
      size: 9, color: hpColor, weight: "700", align: "right", font: Theme.fonts.mono,
    });

    // v3：基地护盾指示
    if (this.baseShield > 0) {
      const shieldRatio = this.baseShield / this.base.max;
      ctx.fillStyle = "#52C41A";
      ctx.fillRect(barX, barY + barH + 2, barW * shieldRatio, 3);
      drawText(ctx, `护盾 ${Math.ceil(this.baseShield)}`, barX + barW, barY + barH + 8, {
        size: 8, color: "#52C41A", weight: "700", align: "right", font: Theme.fonts.mono,
      });
    }
  }

  /** v4：入口生成区域指示（已在 drawMaze 中绘制，此处保留方法签名兼容） */
  private drawEntrance(ctx: CanvasRenderingContext2D): void {
    void ctx;
  }

  /** v3：探员绘制（含角色剪影） */
  private drawAgent(ctx: CanvasRenderingContext2D, a: DeployedAgent): void {
    const flash = this.t < a.flashUntil;
    ctx.save();
    ctx.translate(a.x, a.y);

    // 光环
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fillStyle = a.def.color + "22";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = a.def.color;
    if (flash) {
      ctx.shadowColor = a.def.color;
      ctx.shadowBlur = 14;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // v3：角色剪影
    this.drawAgentSilhouette(ctx, a.def.silhouette, a.def.color);

    // emoji
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(a.def.emoji, 0, 0);

    ctx.restore();

    // 射程指示
    if (flash) {
      ctx.strokeStyle = a.def.color + "33";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.def.range * this.upgradeMul("range"), 0, Math.PI * 2);
      ctx.stroke();
    }

    // v3：暴击 buff 视觉
    if (this.t < this.critBuffUntil) {
      ctx.strokeStyle = "#FFD666";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(a.x, a.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // HP 条
    const hpW = 40, hpH = 4;
    const hpX = a.x - hpW / 2, hpY = a.y - 32;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(hpX, hpY, hpW, hpH);
    ctx.fillStyle = a.def.color;
    ctx.fillRect(hpX, hpY, hpW * (a.hp / a.maxHp), hpH);

    // v3：元素图标
    const elemEmoji = ELEMENTS[a.def.element].emoji;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(elemEmoji, hpX + hpW + 2, hpY + 2);

    // 名字
    drawText(ctx, a.def.name, a.x, a.y + 32, {
      size: 11, color: "#F0F4FF", weight: "700", align: "center",
    });
    drawText(ctx, a.def.role, a.x, a.y + 44, {
      size: 9, color: "#7A8FB0", weight: "500", align: "center", font: Theme.fonts.mono,
    });
  }

  /** v3：探员剪影（6 种类型） */
  private drawAgentSilhouette(ctx: CanvasRenderingContext2D, type: string, color: string): void {
    ctx.save();
    ctx.strokeStyle = color + "66";
    ctx.lineWidth = 1.5;
    switch (type) {
      case "assault":
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(a) * 16, y = Math.sin(a) * 16;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      case "comms":
        for (let r = 10; r <= 18; r += 4) {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case "tech":
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(14, 0); ctx.lineTo(0, 18); ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.stroke();
        break;
      case "social":
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 8, Math.sin(a) * 8, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case "sniper":
        ctx.beginPath();
        ctx.moveTo(-18, 0); ctx.lineTo(18, 0);
        ctx.moveTo(0, -18); ctx.lineTo(0, 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "stealth":
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(15, 12); ctx.lineTo(-15, 12);
        ctx.closePath();
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  /** v3：养成探员绘制 */
  private drawCultAgents(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.cultAgents.length; i++) {
      const c = this.cultAgents[i];
      const x = CULT_AGENT_SLOT_X[i];
      const y = CULT_AGENT_SLOT_Y;
      c.x = x; c.y = y;

      if (!c.unlocked) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = "#7A8FB0";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#7A8FB0";
        ctx.fillText("🔒", x, y);
        ctx.restore();
        continue;
      }

      const pulse = 0.5 + 0.5 * Math.sin(this.t * 3 + i);
      ctx.save();
      if (c.def.buff === "slow") {
        const range = (c.def.range ?? 100) + c.level * 20;
        ctx.strokeStyle = c.def.color + "22";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(x - range, y); ctx.lineTo(x + range, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fillStyle = c.def.color + "22";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.def.color;
      ctx.shadowColor = c.def.color;
      ctx.shadowBlur = 8 + pulse * 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.def.emoji, x, y);
      ctx.restore();

      for (let lv = 0; lv < c.maxLevel; lv++) {
        const px = x - 12 + lv * 12, py = y + 24;
        ctx.fillStyle = lv < c.level ? c.def.color : "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      drawText(ctx, c.def.name, x, y + 36, { size: 9, color: c.def.color, weight: "700", align: "center" });
      drawText(ctx, c.def.desc, x, y + 47, { size: 8, color: "#7A8FB0", weight: "500", align: "center", font: Theme.fonts.mono });
    }
  }

  /** v3：敌人绘制（含形状） */
  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const r = e.radius ?? 20;
    const wob = Math.sin(e.wobble) * 3;
    const isBoss = !!e.bossRef;

    ctx.save();
    ctx.translate(e.x, e.y + wob);

    // BOSS 光环
    if (isBoss) {
      const auraColor = e.enraged ? "#E5353B" : e.bossRef!.color;
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
      const auraR = r + 10 + pulse * 6;
      const grad = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, auraR);
      grad.addColorStop(0, auraColor + "55");
      grad.addColorStop(1, auraColor + "00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, auraR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = auraColor + "AA";
      ctx.lineWidth = 2;
      const spikes = 8;
      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + this.t * 1.5;
        const r1 = r + 4, r2 = r + 12 + pulse * 4;
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      }
      ctx.stroke();
    }

    // v3：按形状绘制敌人
    this.drawEnemyShape(ctx, e.def.shape, r, e.def.color, isBoss);

    // v7：受击白闪覆盖（命中瞬间敌人整体高亮，强化打击感）
    if (e.hitFlashUntil !== undefined && this.t < e.hitFlashUntil) {
      const flashAlpha = (e.hitFlashUntil - this.t) / 0.08;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = flashAlpha * 0.8;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // emoji
    ctx.font = `${Math.round(r * 0.95)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.def.emoji, 0, 0);
    ctx.restore();

    // HP 条
    const hpW = isBoss ? r * 2.5 : 36;
    const hpH = isBoss ? 6 : 4;
    const hpX = e.x - hpW / 2, hpY = e.y - r - (isBoss ? 14 : 10);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(hpX, hpY, hpW, hpH);
    const hpRatio = clamp(e.hp / e.maxHp, 0, 1);
    let hpColor: string;
    if (isBoss) {
      hpColor = e.enraged ? "#E5353B" : hpRatio > 0.5 ? "#FFB020" : "#FF7AB8";
    } else {
      hpColor = hpRatio > 0.5 ? "#E5353B" : "#FFD666";
    }
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
    if (isBoss) {
      ctx.strokeStyle = "#FFD666";
      ctx.lineWidth = 1;
      ctx.strokeRect(hpX, hpY, hpW, hpH);
    }

    // 名字
    drawText(ctx, e.def.name, e.x, e.y + r + 12, {
      size: isBoss ? 12 : 10,
      color: isBoss ? "#FFD666" : "#F0F4FF",
      weight: "700", align: "center",
      shadow: isBoss ? { color: "#FFD666", blur: 6 } : undefined,
    });

    // BOSS 阶段名
    if (isBoss && this.bossPhaseName) {
      drawText(ctx, `【${this.bossPhaseName}】`, e.x, e.y + r + 26, {
        size: 10, color: "#E5353B", weight: "900", align: "center",
        shadow: { color: "#E5353B", blur: 6 },
      });
    } else if (isBoss && e.enraged) {
      drawText(ctx, "⚠ 狂暴", e.x, e.y + r + 26, {
        size: 10, color: "#E5353B", weight: "900", align: "center",
        shadow: { color: "#E5353B", blur: 6 },
      });
    }

    // v3：shield 未消耗时显示护盾光环
    if (e.def.ability === "shield" && !e.shieldConsumed) {
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 减速指示
    if (this.t < e.slowUntil || this.t < this.slowUntil) {
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** v3：敌人形状绘制（7 种 + crown） */
  private drawEnemyShape(ctx: CanvasRenderingContext2D, shape: string, r: number, color: string, isBoss: boolean): void {
    ctx.save();
    ctx.fillStyle = color + "22";
    ctx.lineWidth = isBoss ? 3 : 2;
    ctx.strokeStyle = color;
    if (isBoss) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }

    const drawShape = () => {
      ctx.beginPath();
      switch (shape) {
        case "hexagon":
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          break;
        case "window":
          ctx.rect(-r, -r, r * 2, r * 2);
          ctx.moveTo(-r, -r * 0.5);
          ctx.lineTo(r, -r * 0.5);
          break;
        case "phone":
          roundRect(ctx, -r * 0.6, -r, r * 1.2, r * 2, 4);
          break;
        case "heart":
          ctx.moveTo(0, r * 0.6);
          ctx.bezierCurveTo(r * 1.2, 0, r * 0.6, -r * 1.2, 0, -r * 0.4);
          ctx.bezierCurveTo(-r * 0.6, -r * 1.2, -r * 1.2, 0, 0, r * 0.6);
          break;
        case "hook":
          ctx.moveTo(0, -r);
          ctx.lineTo(0, r * 0.3);
          ctx.arc(r * 0.3, r * 0.3, r * 0.5, Math.PI, Math.PI * 0.5, true);
          break;
        case "card":
          roundRect(ctx, -r, -r * 0.65, r * 2, r * 1.3, 4);
          break;
        case "crown":
          ctx.moveTo(-r, r * 0.4);
          ctx.lineTo(-r, -r * 0.2);
          ctx.lineTo(-r * 0.5, r * 0.2);
          ctx.lineTo(0, -r * 0.6);
          ctx.lineTo(r * 0.5, r * 0.2);
          ctx.lineTo(r, -r * 0.2);
          ctx.lineTo(r, r * 0.4);
          ctx.closePath();
          break;
        default:
          ctx.arc(0, 0, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    };
    drawShape();
    ctx.restore();
  }

  /** v3：投射物绘制（含拖尾） */
  private drawProjectiles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.projectiles) {
      // v3：拖尾
      for (let i = 0; i < p.trail.length; i++) {
        const tr = p.trail[i];
        const alpha = (i / p.trail.length) * 0.5;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, 2 + i * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 主体
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.crit ? 12 : 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.crit ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /** 准备阶段覆盖层 */
  private drawPrepOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.waveActive || this.over) return;
    const remaining = Math.max(0, this.prepUntil - this.t);
    let title = `反诈波次 ${this.wave + 1} 来袭`;
    let titleColor = ACCENT;
    let subtitle = "";

    if ((this.mode === "classic" || this.mode === "daily") && this.t < this.levelTransitionUntil) {
      const lv = LEVELS[this.level - 1];
      title = `LEVEL ${this.level} · ${lv.name}`;
      titleColor = lv.accent;
      subtitle = `${lv.subtitle} · ${this.maze.name}`;
    } else if (this.mode === "bossRush" && this.currentBoss) {
      title = `BOSS ${this.bossIdx + 1}/${BOSS_RUSH_BOSSES.length} · ${this.currentBoss.name}`;
      titleColor = this.currentBoss.color;
    } else if (this.mode === "endlessRush") {
      const s = endlessScaling(this.endlessAbsWave);
      title = `无尽反诈波次 ${this.endlessAbsWave + 1} · TIER ${s.tier + 1}`;
      titleColor = "#B388FF";
    }

    drawText(ctx, title, W / 2, H / 2 - 30, {
      size: 26, color: titleColor, weight: "900", align: "center",
      shadow: { color: titleColor, blur: 14 },
    });
    drawText(ctx, `${remaining.toFixed(1)}s`, W / 2, H / 2 + 10, {
      size: 40, color: "#F0F4FF", weight: "900", align: "center",
      font: Theme.fonts.mono, shadow: { color: "#00E5FF", blur: 12 },
    });

    if (subtitle) {
      drawText(ctx, subtitle, W / 2, H / 2 + 50, {
        size: 13, color: "#F0F4FF", weight: "500", align: "center",
      });
    }

    if (this.mode === "bossRush" && this.currentBoss) {
      ctx.font = "48px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.currentBoss.emoji, W / 2, H / 2 - 80);
      drawText(ctx, `【${this.currentBoss.skillName}】${this.currentBoss.skillDesc}`, W / 2, H / 2 + 50, {
        size: 13, color: "#F0F4FF", weight: "500", align: "center",
      });
    }

    // v3：每日挑战修饰符展示
    if (this.mode === "daily" && this.dailyModifiers.length > 0 && this.wave === 0 && remaining > 1) {
      const mods = this.dailyModifiers;
      const modY = H / 2 + 90;
      mods.forEach((m, i) => {
        const mx = W / 2 - (mods.length - 1) * 60 + i * 120;
        drawText(ctx, m.emoji, mx, modY, { size: 20, color: m.color, align: "center" });
        drawText(ctx, m.name, mx, modY + 22, { size: 11, color: m.color, weight: "700", align: "center" });
      });
    }
  }

  // ====================================================================
  // v3：持久化数据导出（供场景调用 recordManagerGame）
  // ====================================================================

  getProgressData(): {
    mode: ManagerMode;
    score: number;
    win: boolean;
    level: number;
    wave: number;
    killsByAgent: Record<string, number>;
    bossKills: number;
    bustedCount: number;
    ultCount: number;
    // v6 全面升级新增
    towerFloor: number;
    challengeAffixes: ChallengeAffix[];
    quizCorrectCount: number;
    // v7 全面升级新增
    lastDefeatedBossId: string | null;
    newlyCollectedTerms: number[];
  } {
    return {
      mode: this.mode,
      score: this.result?.score ?? this.score,
      win: this.result?.win ?? false,
      level: this.level,
      wave: this.mode === "endlessRush" ? this.endlessAbsWave + 1
        : this.mode === "bossRush" ? this.bossIdx + 1
        : this.wave + 1,
      killsByAgent: { ...this.killsByAgent },
      bossKills: this.bossKillsThisGame,
      bustedCount: this.bustedCount,
      ultCount: this.ultCount,
      // v6 全面升级新增
      towerFloor: this.towerFloor,
      challengeAffixes: [...this.challengeAffixes],
      quizCorrectCount: this.quizCorrectCount,
      // v7 全面升级新增
      lastDefeatedBossId: this.lastDefeatedBossId,
      newlyCollectedTerms: [...this.newlyCollectedTerms],
    };
  }

  getResult(): GameResultPayload | null {
    return this.result;
  }
}
