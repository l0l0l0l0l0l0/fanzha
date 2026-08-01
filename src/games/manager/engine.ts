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
  TACTICAL_DEVICES, ELEMENT_REACTIONS, QUIZ_BANK,
  TALENT_TREES, RELICS, EQUIPMENT, AGENT_SKINS, CHALLENGE_AFFIXES,
  getTowerFloor, seasonRankFromScore, pickQuiz,
  detectElementReactions, getTalentTree, getRelic, getEquipment,
  TOWER_MAX_FLOOR,
  // v8：全面升级新增数据/函数
  COUNTERSPELLS, TACTICAL_COMMANDS, VICTIM_RESCUE_CONFIGS,
  VICTIM_DEMOGRAPHIC_EMOJI, VICTIM_DEMOGRAPHIC_FRAUD,
  pickCounterspellSlots, getTacticalCommand, bossElementToCounterspellId,
} from "./data";
// v7：全面升级新增
import { pickAdaptiveQuiz, getTermsForBossKill, getTermsForTowerFloor, getTermsForTotalKills, TOWER_EVENTS, getCaseById } from "./data.v7";
// v8：全面升级新增
import {
  drawHand, getCaseBreakdownByEnemyId, getCaseInvestigation,
  // v9：探员羁绊
  AGENT_BONDS, getBondBetween,
  // v10 P0-1c：案例微型复盘
  pickRandomCaseMiniQuiz,
} from "./data.v8";
// v11：全面升级新增（敌人/BOSS/案例/受害人模拟/自定义难度）
import {
  getV11CaseBreakdownByEnemyId,
  getVictimSimScenario, getVictimSimScenarioByTypeId,
  VICTIM_SIM_SCENARIOS_V11, CUSTOM_DIFFICULTY_PRESETS, getPresetConfig,
} from "./data";
// v8 扩展系统：数据表 + 渲染常量（保守抽取，方法仍保留在引擎类内）
import {
  SPEECH_TEXTS,
  BUBBLE_W, BUBBLE_H, BUBBLE_RADIUS, BUBBLE_ARROW_H,
  VICTIM_RING_R, VICTIM_RING_LW, VICTIM_EMOJI_SIZE,
  BUBBLE_FADE_THRESHOLD, BUBBLE_WARN_RATIO,
} from "./engine-v8-extensions";
import type {
  DeploySlot, ManagerHud, ManagerMode, BossRushDef, AgentUpgradeKind,
  CultAgentState, ComboState, DailyModifier, Element,
  EnemyDef, AgentDef, LevelTheme, UpgradeChoice,
  // v6：全面升级新增类型
  TacticalDeviceKind, TacticalDeviceDef, ElementReactionDef, QuizQuestion,
  TalentTree, RelicDef, EquipmentDef, AgentSkin, TalentBranch,
  ElementReactionKind, ChallengeAffix,
  // v7：爬塔事件
  TowerEventDef, TowerEventOutcome,
  // v8：全面升级新增类型
  VictimNPC, SpeechBubble, CounterspellDef, CounterspellSlotHud,
  TacticalCommandKind, TacticalCommandDef, TacticalCommandState,
  CardSkillDef, CardSkillEffect, CardHandHud,
  CaseBreakdownDef, VictimHudEntry, VictimRescueConfig,
  // v9：全面升级新增类型
  EnemyAIBehaviorKind, RelicShopOffer, InvestigationState, CaseInvestigation,
  // v9：探员羁绊
  AgentBond, BondRuntimeState, BondEffectKind,
  // v10：系统事件通知
  SystemEventToast,
  // v11：地形 + 重部署 + 回放
  TerrainKind, RedeployState, BattleReplayFrame, BattleReplayRecord,
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
  // ===== v8 全面升级新增 =====
  /** reload 指令剩余穿透次数 */
  _v8ReloadPierceLeft?: number;
  // ===== v9 全面升级新增 =====
  /** 受恐惧光环影响到期时间（fearAura，期间射速 -30%） */
  _v9FearedUntil?: number;
}

/** v9：探员当前已应用的羁绊 buff 快照（用于增量重算） */
interface BondBuffSnapshot {
  attackPct: number;
  fireratePct: number;
  rangePct: number;
  critRate: number;
  ultChargePct: number;
  comboBoost: number;
  healLinkPct: number;
  shieldLinkPct: number;
  elementLinkMul: number;
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
  // ===== v8 全面升级新增 =====
  /** 口诀击破施加的易伤到期时间 */
  _v8VulnUntil?: number;
  /** 口诀击破施加的易伤倍率（如 1.3 = 受伤+30%） */
  _v8VulnMul?: number;
  /** taunt 指令吸引目标 x（敌人临时改向该坐标） */
  _v8TauntBy?: number;
  /** taunt 指令吸引到期时间 */
  _v8TauntUntil?: number;
  // ===== v9 全面升级新增：AI 行为树运行时字段 =====
  /** 伪装到期时间（disguise 行为，期间无法被攻击且减速） */
  _v9DisguiseUntil?: number;
  /** AI 冷却到期时间（通用，disguise/rush/flank/teleport 触发冷却） */
  _v9AiCooldownUntil?: number;
  /** 当前生效行为（secondary 切换后；缺省=用 def.aiBehavior.kind） */
  _v9ActiveKind?: EnemyAIBehaviorKind;
  /** rush 加速到期时间（被附近同类 rush 波及） */
  _v9RushUntil?: number;
  /** rush 加速倍率 */
  _v9RushMul?: number;
  /** flank 侧向偏移（绕侧时临时偏移 y） */
  _v9FlankOffset?: number;
  /** flank 偏移到期时间 */
  _v9FlankUntil?: number;
  /** enrage 出口伤害倍率（狂暴时增加到达出口伤害） */
  _v9EnrageDmgMul?: number;
  /** 已触发 split（避免重复分裂） */
  _v9SplitDone?: boolean;
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
  // ===== v9：探员羁绊运行时状态 =====
  /** 当前局激活的羁绊状态（仅双方均部署的羁绊） */
  private bondStates: BondRuntimeState[] = [];
  /** 每探员已应用的羁绊 buff 快照（用于增量重算，避免重复乘算） */
  private bondAppliedBuffs: Map<string, BondBuffSnapshot> = new Map();
  /** v9：最近触发的敌人 AI 事件（供 HUD 警报展示） */
  private lastEnemyAIEvent: { kind: EnemyAIBehaviorKind; enemyUid: number; at: number } | null = null;
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

  // ===== v6 全面升级：Phase 2.2 战间答题 =====
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
  // ===== v9 全面升级：遗物商店 + 合成系统 =====
  /** 当前商店待选 offer（非空表示商店激活） */
  private pendingRelicShopOffers: RelicShopOffer[] = [];
  /** 下次触发遗物商店的波数（每 5 波触发） */
  private relicShopWaveTrigger = 5;
  // ===== v9 全面升级：案例分支式调查 =====
  /** 当前调查运行时状态（非空表示调查激活，phase==="investigation"） */
  private pendingInvestigation: InvestigationState | null = null;

  // ===== v10 升级：系统事件通知队列（让玩家感知已实现的元素反应/技能链/敌人AI/羁绊）=====
  /** 最近的系统高光事件（最多保留 3 条，超时自动剔除） */
  private recentSystemEvents: SystemEventToast[] = [];

  // ===== v10 升级：本局学到的反诈知识点（按击破敌人的 fraudType 收集）=====
  /** 本局击破的敌人 fraudType 集合（去重，结算页展示用） */
  private learnedFraudTipsThisRun: string[] = [];

  /** v11：本局已解锁图鉴的敌人 typeId 集合（避免重复解锁） */
  private releasedEnemyCodexIds: Set<string> = new Set();

  // ===== v8 全面升级：受害人营救 / 话术气泡 / 战术指令 / 卡牌大招 / 案例复盘 =====
  /** 受害人 NPC 列表（地图随机出现，敌人接触触发洗脑） */
  private victims: VictimNPC[] = [];
  /** 受害人 id 自增序列 */
  private victimSeq = 1;
  /** 受害人营救配置（按当前关卡读取） */
  private victimRescueConfig: VictimRescueConfig | null = null;
  /** 本局累计营救数（用于结算） */
  private victimsRescued = 0;
  /** 本局累计沦陷数（用于结算） */
  private victimsLost = 0;
  /** 话术气泡列表（敌人头顶，玩家点击口诀击破） */
  private speechBubbles: SpeechBubble[] = [];
  /** 气泡 id 自增序列 */
  private bubbleSeq = 1;
  /** 反诈口诀槽（2 个，按当前敌人类型动态抽取；仅 BOSS 战激活） */
  private counterspellSlots: CounterspellDef[] = [];
  /** 各口诀槽冷却剩余时间（秒，与 slots 索引对齐） */
  private counterspellCooldowns: number[] = [0, 0];
  /** 当前选中的探员索引（部署列表下标，null = 未选中） */
  private selectedAgentIdx: number | null = null;
  /** 各探员的战术指令状态（与 agents 数组对齐） */
  private tacticalCommandStates: TacticalCommandState[] = [];
  /** v11：重部署状态（null=未启用；选中探员后进入选目标格模式） */
  private redeployState: RedeployState | null = null;
  /** v11：重部署能量消耗 */
  private readonly redeployCost = 30;
  /** v11：本局激活的弱点情报列表（受害人模拟解锁，对该类型敌人 +20% 伤害） */
  private activeWeaknessIntel: { enemyTypeId: string; damageBonus: number; desc: string }[] = [];
  /** v11：自定义难度配置（仅 custom 预设生效，null=用默认/关卡倍率） */
  private customDifficultyCfg: import("./types").CustomDifficultyConfig | null = null;
  /** v11：战斗回放帧序列（每 2 秒采样 + 关键事件追加） */
  private replayFrames: BattleReplayFrame[] = [];
  /** v11：上次采样回放帧的时间（秒） */
  private lastReplayFrameT = -10;
  /** v11：诈骗类型击杀/泄漏统计（fraudType → {kills, leaked}） */
  private fraudTypeStats: Record<string, { kills: number; leaked: number }> = {};
  /** 当前手牌（每探员 1 张，最多 3 张） */
  private cardHand: CardSkillDef[] = [];
  /** 手牌抽牌种子（每波结束重新抽牌） */
  private cardHandSeed = "";
  /** 待展示的案例五步复盘（仅 win 后输出到 HUD） */
  private pendingCaseBreakdown: CaseBreakdownDef | null = null;
  /** 上次案例复盘答题是否答对 */
  private lastBreakdownCorrect: boolean | null = null;
  /** 本局泡泡击破数（用于结算） */
  private speechBubblesBroken = 0;
  /** 本局卡牌释放次数（用于结算） */
  private cardSkillsUsed = 0;
  /** 本局战术指令使用次数（用于结算） */
  private tacticalCommandsUsed = 0;

  constructor(
    canvas: GameCanvas,
    deployment: DeploySlot[],
    mode: ManagerMode = "classic",
    maze?: MazeDef,
    startLevel?: number,
  ) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    this.startedAt = performance.now();
    this.mode = mode;
    this.modeLabel = MODE_META[mode].label;
    // v8：支持指定起始关卡（classic 模式下由部署场景选择已解锁关卡）
    if (startLevel && startLevel >= 1 && startLevel <= MAX_LEVEL) {
      this.level = startLevel;
    }

    // v4：初始化迷宫（按模式/关卡选取）
    const seed = `${Date.now()}-${Math.random()}`;
    this.maze = maze ?? getInitialMaze(mode, this.level, seed);

    // v6：读取跨局元进度（天赋/遗物/装备/皮肤），在 placeAgents 前完成以便应用加成
    this.initMetaProgression();
    // v11：从存档加载已解锁的弱点情报（受害人模拟解锁的 +20% 伤害）
    this.loadWeaknessIntelFromStore();
    // v11：从存档加载自定义难度配置（独立于 challenge 词缀）
    this.loadCustomDifficultyFromStore();

    this.placeAgents(deployment);
    // v8：初始化战术指令状态（与 agents 对齐）
    this.initTacticalCommandStates();
    // v8：初始化口诀槽 + 受害人营救配置 + 抽手牌
    this.initV8Systems();
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

    // v11：应用自定义难度（独立于 challenge 词缀，作用于所有模式）
    // - baseHpMul：在模式专属 base.max 之上叠加（bossRush 150 / tower 200 / 默认 100）
    // - startEnergy：作为初始能量下限（受 [0,100] 夹取，与遗物/修饰符叠加取最大）
    if (this.customDifficultyCfg) {
      const cfg = this.customDifficultyCfg;
      this.base.max = Math.max(1, Math.round(this.base.max * cfg.baseHpMul));
      this.base.hp = this.base.max;
      this.energy = Math.max(this.energy, clamp(cfg.startEnergy, 0, 100));
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
  // v8：全面升级系统初始化（受害人 / 话术气泡 / 战术指令 / 卡牌大招）
  // ====================================================================

  /** 初始化战术指令状态（每探员一份，与 agents 数组对齐） */
  private initTacticalCommandStates(): void {
    this.tacticalCommandStates = this.agents.map(() => ({
      activeKind: null,
      activeRemaining: 0,
      cooldowns: {
        focusFire: 0, retreat: 0, reload: 0, taunt: 0, overdrive: 0,
      },
    }));
  }

  /** 初始化 v8 系统：口诀槽 + 受害人配置 + 手牌 */
  private initV8Systems(): void {
    // 受害人营救配置：classic/daily 按当前关卡读取；bossRush/endlessRush/tower 用 level=3
    const cfgLevel = (this.mode === "classic" || this.mode === "daily")
      ? this.level
      : (this.mode === "bossRush" || this.mode === "endlessRush" || this.mode === "tower") ? 3 : 1;
    this.victimRescueConfig = VICTIM_RESCUE_CONFIGS[cfgLevel] ?? VICTIM_RESCUE_CONFIGS[1];
    // 口诀槽：根据当前敌人诈骗类型池动态抽取 4 个
    this.refreshCounterspellSlots();
    // 手牌：从已部署探员每人 3 张中随机抽 1 张
    this.redrawCardHand();
  }

  /** 根据当前场上敌人类型刷新口诀槽（每波结束调用一次；BOSS 在场时确保 BOSS 口诀在槽位中） */
  private refreshCounterspellSlots(): void {
    const activeFraudTypes = new Set<string>();
    for (const e of this.enemies) {
      activeFraudTypes.add(e.def.fraudType);
    }
    // 没有敌人时，按当前关卡的敌人类型池抽取
    if (activeFraudTypes.size === 0) {
      const lv = LEVELS[this.level - 1];
      const typeIds = lv?.enemyTypes ?? [];
      for (const tid of typeIds) {
        const def = ENEMIES[tid];
        if (def) activeFraudTypes.add(def.fraudType);
      }
    }
    // v8 简化：BOSS 在场时，按 BOSS element 兜底映射口诀，确保 BOSS 口诀在槽位中
    const bossOnField = this.enemies.find((e) => e.bossRef);
    if (bossOnField && bossOnField.bossRef) {
      const csId = bossElementToCounterspellId(bossOnField.bossRef.element);
      const bossCs = COUNTERSPELLS.find((c) => c.id === csId);
      if (bossCs) {
        for (const ft of bossCs.fraudTypeIds) activeFraudTypes.add(ft);
      }
    }
    this.counterspellSlots = pickCounterspellSlots(
      Array.from(activeFraudTypes),
      `${this.mode}-${this.level}-${this.wave}-${this.cardHandSeed}`,
    );
    this.counterspellCooldowns = [0, 0];
  }

  /** 重新抽手牌（每波结束 + 卡牌释放后调用） */
  private redrawCardHand(): void {
    const deployedIds = this.agents.filter((a) => a.alive).map((a) => a.id);
    if (deployedIds.length === 0) {
      this.cardHand = [];
      return;
    }
    this.cardHandSeed = `${this.mode}-${this.level}-${this.wave}-${this.t.toFixed(2)}`;
    this.cardHand = drawHand(deployedIds, this.cardHandSeed);
  }

  /**
   * v8：波次开始时触发 —— 生成受害人 + 刷新口诀槽 + 重抽手牌
   * 由各 startXxxWave 方法在设置完 spawnQueue 后调用
   */
  private onV8WaveStart(): void {
    // 1) 生成受害人 NPC（仅 classic/daily/tower/endlessRush 模式，bossRush 不生成以避免干扰 BOSS 战）
    if (this.mode !== "bossRush" && this.victimRescueConfig) {
      this.spawnVictimsForWave();
    }
    // 2) 刷新口诀槽（按当前敌人诈骗类型池）
    this.refreshCounterspellSlots();
    // 3) 重抽手牌
    this.redrawCardHand();
  }

  /** 为当前波生成受害人 NPC（数量由 victimRescueConfig.perWave 决定） */
  private spawnVictimsForWave(): void {
    const cfg = this.victimRescueConfig;
    if (!cfg) return;
    for (let i = 0; i < cfg.perWave; i++) {
      // 在迷宫路径中段随机选一个航点附近放置受害人
      const wps = this.maze.waypoints;
      if (wps.length < 2) continue;
      const idx = Math.floor(wps.length * (0.3 + Math.random() * 0.4));
      const wp = wps[idx];
      if (!wp) continue;
      // 在航点附近偏移 30-50px（避开路径中心，模拟"路人"）
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 20;
      const demographic = cfg.demographics[Math.floor(Math.random() * cfg.demographics.length)] ?? "路人";
      const fraudTypeId = VICTIM_DEMOGRAPHIC_FRAUD[demographic] ?? "钓鱼网站盗刷";
      const emoji = VICTIM_DEMOGRAPHIC_EMOJI[demographic] ?? "👤";
      this.victims.push({
        id: this.victimSeq++,
        x: wp.x + Math.cos(angle) * dist,
        y: wp.y + Math.sin(angle) * dist,
        waypointIdx: idx,
        emoji,
        demographic,
        fraudTypeId,
        brainwashProgress: 0,
        brainwashRate: 0.15 + Math.random() * 0.05, // 15-20%/秒
        brainwashingBy: null,
        rescued: false,
        lost: false,
        rewardScore: 200,
        rewardAntiFraudPoints: 20,
        spawnedAt: this.t,
        lifeSpan: cfg.lifeSpan,
      });
    }
  }

  // ====================================================================
  // v8：受害人营救 / 话术气泡 / 战术指令 / 卡牌大招 —— 更新逻辑
  // ====================================================================

  /** v8：更新受害人状态（洗脑进度 / 营救 / 沦陷 / 超时撤离） */
  private updateVictims(dt: number): void {
    const cfg = this.victimRescueConfig;
    if (!cfg) return;
    for (let i = this.victims.length - 1; i >= 0; i--) {
      const v = this.victims[i];
      if (v.rescued || v.lost) {
        // 营救/沦陷后短暂保留 0.8s 再移除（供 HUD 动画收尾）
        if (this.t - v.spawnedAt > v.lifeSpan + 0.8 || (v.rescued && this.t - v.spawnedAt > v.lifeSpan)) {
          this.victims.splice(i, 1);
        }
        continue;
      }
      // 超时自动撤离（未被洗脑也未被营救）
      if (this.t - v.spawnedAt > v.lifeSpan) {
        this.victims.splice(i, 1);
        continue;
      }
      // 检查是否有敌人在洗脑范围内
      let brainwashing = false;
      let nearestEnemyD = Infinity;
      for (const e of this.enemies) {
        if (e.frozenUntil && this.t < e.frozenUntil) continue;
        const d = Math.hypot(e.x - v.x, e.y - v.y);
        if (d < cfg.triggerRange && d < nearestEnemyD) {
          nearestEnemyD = d;
          v.brainwashingBy = e.uid;
          v.brainwashProgress += v.brainwashRate * dt;
          brainwashing = true;
        }
      }
      if (!brainwashing) v.brainwashingBy = null;
      // 检查是否有探员在营救范围内
      let rescuing = false;
      for (const a of this.agents) {
        if (!a.alive) continue;
        const d = Math.hypot(a.x - v.x, a.y - v.y);
        if (d < cfg.rescueRange) {
          v.brainwashProgress = Math.max(0, v.brainwashProgress - cfg.rescueRate * dt);
          rescuing = true;
          break;
        }
      }
      // 洗脑进度满 → 沦陷
      if (v.brainwashProgress >= 1) {
        v.lost = true;
        this.victimsLost++;
        this.floats.push({ x: v.x, y: v.y - 16, text: "洗脑成功", color: "#E5353B", life: 1.2, maxLife: 1.2, size: 14 });
        this.particles.spawnBurst(v.x, v.y, "#E5353B", { sparks: 8, dots: 6, speed: 120, life: 0.5, size: 2 });
        playSfx("lose");
      }
      // 洗脑进度归零且曾被洗脑 → 营救成功
      if (rescuing && v.brainwashProgress <= 0 && (v.brainwashingBy !== null || v.spawnedAt < this.t)) {
        v.rescued = true;
        this.victimsRescued++;
        this.score += v.rewardScore;
        this.energy = clamp(this.energy + 8, 0, 100);
        this.floats.push({ x: v.x, y: v.y - 16, text: `营救+${v.rewardScore}`, color: "#52C41A", life: 1.2, maxLife: 1.2, size: 14 });
        this.particles.spawnBurst(v.x, v.y, "#52C41A", { ring: true, sparks: 12, dots: 10, speed: 160, life: 0.7, size: 3 });
        playSfx("good");
      }
    }
  }

  /** v8：更新话术气泡 —— 为行走中的敌人周期性生成话术气泡，超时未击破则强化敌人 */
  private updateSpeechBubbles(dt: number): void {
    // 移除已击破/超时/关联敌人已死的气泡
    for (let i = this.speechBubbles.length - 1; i >= 0; i--) {
      const b = this.speechBubbles[i];
      const enemy = this.enemies.find((e) => e.uid === b.enemyUid);
      if (b.broken || !enemy) {
        this.speechBubbles.splice(i, 1);
        continue;
      }
      // 跟随敌人位置
      b.x = enemy.x;
      b.y = enemy.y - enemy.radius - 18;
      // 超时未击破 → 强化敌人（加速 + 回血），然后移除气泡
      if (this.t - b.appearedAt > b.duration) {
        enemy.slowUntil = 0; // 解除减速
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.05);
        this.speechBubbles.splice(i, 1);
        this.floats.push({ x: enemy.x, y: enemy.y - 14, text: "话术得逞", color: "#E5353B", life: 1.0, maxLife: 1.0, size: 12 });
      }
    }
    // v8 简化：只为 BOSS 敌人周期性生成气泡（普通波次无口诀交互，专注塔防+答题）
    for (const e of this.enemies) {
      if (!e.bossRef) continue;
      const hasBubble = this.speechBubbles.some((b) => b.enemyUid === e.uid && !b.broken);
      if (hasBubble) continue;
      // 概率生成：基于 dt 的累积，约每 5-8 秒一个
      if (Math.random() < dt * 0.18) {
        this.spawnSpeechBubble(e);
      }
    }
  }

  /** 为敌人生成一条话术气泡（BOSS 战时按 element 兜底匹配口诀） */
  private spawnSpeechBubble(e: Enemy): void {
    let cs = COUNTERSPELLS.find((c) => c.fraudTypeIds.includes(e.def.fraudType));
    // BOSS 的 fraudType 通常是自定义首脑类型，不在口诀池中 → 按 element 兜底映射
    if (!cs && e.bossRef) {
      const csId = bossElementToCounterspellId(e.bossRef.element);
      cs = COUNTERSPELLS.find((c) => c.id === csId);
    }
    if (!cs) return;
    const text = SPEECH_TEXTS[e.def.fraudType] ?? `${e.def.fraudType}…`;
    this.speechBubbles.push({
      id: this.bubbleSeq++,
      enemyUid: e.uid,
      text,
      counterspellId: cs.id,
      appearedAt: this.t,
      duration: 5,
      x: e.x,
      y: e.y - e.radius - 18,
      broken: false,
    });
  }

  /** v8：更新战术指令状态（激活剩余时间 + 冷却递减） */
  private updateTacticalCommandStates(dt: number): void {
    for (let i = 0; i < this.tacticalCommandStates.length; i++) {
      const s = this.tacticalCommandStates[i];
      if (!s) continue;
      if (s.activeKind && s.activeRemaining > 0) {
        s.activeRemaining = Math.max(0, s.activeRemaining - dt);
        if (s.activeRemaining <= 0) {
          // 指令结束：处理后撤回位等收尾
          const a = this.agents[i];
          if (a && s.activeKind === "retreat") {
            // 回位由 updateAgents 中的 retreatOffset 自然衰减处理
          }
          s.activeKind = null;
        }
        // overdrive：每秒损血 8%
        if (s.activeKind === "overdrive" && i < this.agents.length) {
          const a = this.agents[i];
          if (a && a.alive) {
            a.hp -= a.maxHp * 0.08 * dt;
            if (a.hp <= 0) {
              a.hp = 0;
              a.alive = false;
              this.particles.spawnBurst(a.x, a.y, "#FF3B6B", { sparks: 14, dots: 10, speed: 180, life: 0.6, size: 3 });
            }
          }
        }
      }
      // 冷却递减
      (Object.keys(s.cooldowns) as TacticalCommandKind[]).forEach((k) => {
        if (s.cooldowns[k] > 0) s.cooldowns[k] = Math.max(0, s.cooldowns[k] - dt);
      });
    }
  }

  /** v8：口诀冷却递减 */
  private updateCounterspellCooldowns(dt: number): void {
    for (let i = 0; i < this.counterspellCooldowns.length; i++) {
      if (this.counterspellCooldowns[i] > 0) {
        this.counterspellCooldowns[i] = Math.max(0, this.counterspellCooldowns[i] - dt);
      }
    }
  }

  // ====================================================================
  // v8：玩家交互入口（由 ManagerBattleScene 调用）
  // ====================================================================

  /** v8：选中探员（用于下达战术指令）；idx 为部署列表下标 */
  selectAgent(idx: number | null): void {
    if (this.over) return;
    if (idx !== null && (idx < 0 || idx >= this.agents.length)) return;
    this.selectedAgentIdx = idx;
    this.emitHud();
  }

  /** v8：对选中探员下达战术指令 */
  useTacticalCommand(agentIdx: number, kind: TacticalCommandKind): boolean {
    if (this.over) return false;
    const agent = this.agents[agentIdx];
    if (!agent || !agent.alive) return false;
    const state = this.tacticalCommandStates[agentIdx];
    if (!state) return false;
    if (state.cooldowns[kind] > 0) return false;
    const def = getTacticalCommand(kind);
    if (!def) return false;

    state.activeKind = kind;
    state.activeRemaining = def.duration;
    state.cooldowns[kind] = def.cooldown;
    this.tacticalCommandsUsed++;

    // 即时效果
    switch (kind) {
      case "focusFire":
        // 射速 +20% / 下次攻击 +80% —— 在 updateAgents 中读取 activeKind 应用
        this.particles.spawnBurst(agent.x, agent.y, "#E5353B", { ring: true, sparks: 10, dots: 8, speed: 160, life: 0.5, size: 3 });
        break;
      case "retreat":
        // 后撤 60px（向基地方向 = 向出口/高 x 方向偏移）
        agent.x += 60;
        this.particles.spawnBurst(agent.x, agent.y, "#00E5FF", { sparks: 10, dots: 8, speed: 140, life: 0.5, size: 3 });
        break;
      case "reload":
        // 立即重置冷却 + 下 3 次穿透 +1（存入 pierceLeft 临时字段）
        agent.cooldown = 0;
        agent._v8ReloadPierceLeft = 3;
        this.particles.spawnBurst(agent.x, agent.y, "#FFD666", { ring: true, sparks: 10, dots: 8, speed: 160, life: 0.5, size: 3 });
        break;
      case "taunt":
        // 吸引范围内敌人改向自己（简化：附近敌人路径目标临时指向该探员）
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - agent.x, e.y - agent.y);
          if (d < 180) {
            e._v8TauntBy = agent.x;
            e._v8TauntUntil = this.t + def.duration;
          }
        }
        this.particles.spawnBurst(agent.x, agent.y, "#FF8A3D", { ring: true, sparks: 12, dots: 10, speed: 180, life: 0.6, size: 3 });
        break;
      case "overdrive":
        // 攻击 +50% 在 updateAgents 读取；损血在 updateTacticalCommandStates 处理
        this.particles.spawnBurst(agent.x, agent.y, "#FF3B6B", { ring: true, sparks: 12, dots: 10, speed: 180, life: 0.6, size: 3 });
        break;
    }
    this.floats.push({ x: agent.x, y: agent.y - 20, text: def.name, color: def.color, life: 0.8, maxLife: 0.8, size: 12 });
    this.emitHud();
    return true;
  }

  /** v8：点击口诀槽击破话术气泡 */
  popSpeechBubble(bubbleId: number, slotIdx: number): boolean {
    if (this.over) return false;
    const bubble = this.speechBubbles.find((b) => b.id === bubbleId && !b.broken);
    if (!bubble) return false;
    const slot = this.counterspellSlots[slotIdx];
    if (!slot) return false;
    if (this.counterspellCooldowns[slotIdx] > 0) return false;
    if (slot.id !== bubble.counterspellId) {
      // 口诀不匹配 —— 给予轻微负反馈（不进入冷却）
      this.floats.push({ x: bubble.x, y: bubble.y, text: "口诀不符", color: "#FFB020", life: 0.8, maxLife: 0.8, size: 11 });
      this.emitHud();
      return false;
    }
    // 击破成功
    bubble.broken = true;
    this.speechBubblesBroken++;
    this.counterspellCooldowns[slotIdx] = 2.5; // 2.5s 冷却
    const enemy = this.enemies.find((e) => e.uid === bubble.enemyUid);
    if (enemy) {
      // 施加易伤（复用 vulnUntil/vulnMul，但这里改为单敌人易伤标记）
      enemy._v8VulnUntil = this.t + slot.vulnerabilityDuration;
      enemy._v8VulnMul = 1 + slot.vulnerabilityBonus;
      enemy.hp -= enemy.def.hp * 0.1; // 即时扣除 10% 最大生命作为击破奖励伤害
      this.particles.spawnBurst(enemy.x, enemy.y, slot.color, { ring: true, sparks: 14, dots: 10, speed: 200, life: 0.7, size: 3 });
      this.floats.push({ x: enemy.x, y: enemy.y - 16, text: `识破·${slot.text}`, color: slot.color, life: 1.0, maxLife: 1.0, size: 13 });
    }
    this.score += 50;
    this.energy = clamp(this.energy + 5, 0, 100);
    playSfx("good");
    this.emitHud();
    return true;
  }

  /**
   * v8：按口诀槽自动击破 —— 玩家直接点槽位时使用
   * 优先击破 preferredBubbleId（若匹配该槽口诀），否则自动寻找第一个
   * 匹配该槽 counterspellId 的未击破气泡。无需玩家先选气泡。
   */
  popSpeechBubbleBySlot(slotIdx: number, preferredBubbleId?: number): boolean {
    if (this.over) return false;
    const slot = this.counterspellSlots[slotIdx];
    if (!slot) return false;
    if (this.counterspellCooldowns[slotIdx] > 0) return false;
    // 优先使用玩家选中的气泡（若匹配）
    if (preferredBubbleId !== undefined && preferredBubbleId !== null) {
      const pref = this.speechBubbles.find((b) => b.id === preferredBubbleId && !b.broken);
      if (pref && pref.counterspellId === slot.id) {
        return this.popSpeechBubble(pref.id, slotIdx);
      }
    }
    // 自动寻找第一个匹配的未击破气泡
    const target = this.speechBubbles.find((b) => !b.broken && b.counterspellId === slot.id);
    if (target) {
      return this.popSpeechBubble(target.id, slotIdx);
    }
    // 无匹配：若存在任意未击破气泡，提示口诀不符
    const anyBubble = this.speechBubbles.find((b) => !b.broken);
    if (anyBubble) {
      this.floats.push({ x: anyBubble.x, y: anyBubble.y, text: "口诀不符", color: "#FFB020", life: 0.8, maxLife: 0.8, size: 11 });
      this.emitHud();
    }
    return false;
  }

  /** v8：释放卡牌大招（保留能量基础，消耗卡牌 cost） */
  castCardSkill(cardIdx: number): boolean {
    if (this.over || this.upgradeReady) return false;
    if (this.mode === "daily" && this.hasModifier("noUlt")) return false;
    const card = this.cardHand[cardIdx];
    if (!card) return false;
    if (this.energy < card.cost) return false;
    const agent = this.agents.find((a) => a.alive && a.id === card.agentId);
    if (!agent) return false;

    // 扣能量 + 移除手牌
    this.energy -= card.cost;
    this.cardHand.splice(cardIdx, 1);
    this.cardSkillsUsed++;
    this.ultCount += 1;
    this.ultFlashUntil = this.t + 0.5;
    this.shakeUntil = this.t + 0.3;

    // 视觉
    postFX.flash(card.color, 0.35, 1.6);
    postFX.shake(8, 12);
    this.particles.spawnBurst(agent.x, agent.y, card.color, { ring: true, shockwave: true, sparks: 24, dots: 30, speed: 320, life: 0.9, size: 5, color2: "#FFD666" });

    // 效果（复用 ult 辅助方法，按 CardSkillEffect 派发）
    this.applyCardSkillEffect(card.effect, agent);

    platformStore.recordUltUsed();
    this.floats.push({ x: W / 2, y: H / 2 - 8, text: card.name + "！", color: card.color, life: 1.4, maxLife: 1.4, size: 24 });
    playSfx("bomb");
    this.emitHud();
    return true;
  }

  /** v8 软合并：统一卡牌效果派发（triggerUlt 和 castCardSkill 共用） */
  private applyCardSkillEffect(eff: CardSkillEffect, agent: DeployedAgent): void {
    switch (eff.kind) {
      case "pierce": this.ultPierce(agent, eff.dmgMul); break;
      case "slowAll": this.ultSlowAll(eff.slowMul, eff.duration); this.vulnMul = 1 + eff.vulnBonus; break;
      case "aoe": this.ultAoe(agent, eff.dmgMul, eff.radius); break;
      case "healShield": this.ultHealShield(eff.healRatio); this.baseShield = Math.max(this.baseShield, this.base.max * eff.shieldRatio); break;
      case "critBuff": this.ultCritBuff(eff.critRate, eff.duration); this.critBuffDmgMul = eff.critDmg; break;
      case "assassinate": this.ultAssassinate(agent, eff.dmgMul); break;
      case "summon": this.ultSummon(agent, eff.ratio, eff.duration); break;
      case "freeze": this.ultFreeze(eff.duration); this.vulnUntil = this.t + eff.duration; this.vulnMul = 1 + eff.vulnBonus; break;
      case "timeWarp": this.ultTimeWarp(eff.duration); break;
      case "shieldWall": this.ultShieldWall(eff.shieldRatio); break;
      case "aoePlusSlow":
        this.ultAoe(agent, eff.dmgMul, eff.radius);
        this.slowUntil = this.t + eff.slowDuration;
        for (const e of this.enemies) e.slowUntil = this.t + eff.slowDuration;
        break;
      case "healPlusCrit":
        this.ultHealShield(eff.healRatio);
        this.ultCritBuff(eff.critRate, eff.duration);
        break;
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
    // v8：刷新口诀槽 + 重抽手牌（BOSS 战不生成受害人）
    this.refreshCounterspellSlots();
    this.redrawCardHand();
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
    const siFactor = this.spawnIntervalFactor();
    for (const entry of wave.enemies) {
      for (let i = 0; i < entry.count; i++) {
        this.spawnQueue.push({
          typeId: entry.typeId,
          lane: entry.lane,
          at: this.prepUntil + (entry.delay + i * entry.interval) * fastWaves * siFactor,
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
    // v8：波次开始触发（受害人 + 口诀 + 手牌）
    this.onV8WaveStart();
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

    // v9：初始化探员羁绊（检测双方均部署的羁绊）并应用首级 buff
    this.initBonds();
    this.refreshBondBuffs();
  }

  // ====================================================================
  // v11：地形系统 + 探员重部署
  // ====================================================================

  /** v11：取探员所在格子的地形类型（normal=无地形） */
  private agentTerrainKind(a: DeployedAgent): TerrainKind {
    const layer = this.maze.terrainLayer;
    if (!layer) return "normal";
    const tile = layer.tileMap.get(`${a.col},${a.row}`);
    return tile?.kind ?? "normal";
  }

  /** v11：取敌人所在格子的地形类型（按像素坐标反查格子） */
  private enemyTerrainKind(e: Enemy): TerrainKind {
    const layer = this.maze.terrainLayer;
    if (!layer) return "normal";
    const col = Math.floor((e.x - MAZE_OFFSET_X) / MAZE_CELL);
    const row = Math.floor((e.y - MAZE_OFFSET_Y) / MAZE_CELL);
    const tile = layer.tileMap.get(`${col},${row}`);
    return tile?.kind ?? "normal";
  }

  /** v11：探员是否在高地（射程 +30%、伤害 +15%） */
  private agentOnHighland(a: DeployedAgent): boolean {
    return this.agentTerrainKind(a) === "highland";
  }

  /** v11：探员是否在安全岛（无敌 + 每秒回血 5%） */
  private agentOnSafeIsland(a: DeployedAgent): boolean {
    return this.agentTerrainKind(a) === "safeIsland";
  }

  /**
   * v11：探员重部署 —— 将已部署探员移动到新岗哨位
   * - 消耗能量（默认 30）
   * - 目标格必须是有效岗哨位且无其他探员占据
   * - 返回 true=成功，false=失败（能量不足/目标无效）
   */
  redeployAgent(agentIdx: number, targetCol: number, targetRow: number): boolean {
    if (agentIdx < 0 || agentIdx >= this.agents.length) return false;
    const agent = this.agents[agentIdx];
    if (!agent || !agent.alive) return false;
    // 能量校验
    if (this.energy < this.redeployCost) {
      this.toast = { text: "能量不足，无法重部署", tone: "bad", until: this.t + 1.5 };
      return false;
    }
    // 目标格必须是有效岗哨位
    const targetKey = `${targetCol},${targetRow}`;
    if (!this.maze.deploySet.has(targetKey)) {
      this.toast = { text: "目标格非岗哨位", tone: "bad", until: this.t + 1.2 };
      return false;
    }
    // 目标格不能被其他探员占据
    for (const other of this.agents) {
      if (other === agent || !other.alive) continue;
      if (other.col === targetCol && other.row === targetRow) {
        this.toast = { text: "目标格已有探员", tone: "bad", until: this.t + 1.2 };
        return false;
      }
    }
    // 执行重部署
    this.energy = Math.max(0, this.energy - this.redeployCost);
    agent.col = targetCol;
    agent.row = targetRow;
    const pt = cellCenter(targetCol, targetRow);
    agent.x = pt.x;
    agent.y = pt.y;
    // 视觉反馈
    this.particles.spawnBurst(pt.x, pt.y, "#00E5FF", { ring: true, sparks: 16, dots: 14, speed: 220, life: 0.7, size: 4, color2: "#FFD666" });
    this.toast = { text: `${agent.def.name} 重部署完成`, tone: "good", until: this.t + 1.5 };
    this.redeployState = null;
    this.emitHud();
    return true;
  }

  /** v11：进入重部署选目标模式（UI 调用：选中探员后启动） */
  beginRedeploy(agentIdx: number): boolean {
    if (agentIdx < 0 || agentIdx >= this.agents.length) return false;
    const agent = this.agents[agentIdx];
    if (!agent || !agent.alive) return false;
    if (this.energy < this.redeployCost) {
      this.toast = { text: `重部署需 ${this.redeployCost} 能量`, tone: "bad", until: this.t + 1.5 };
      this.emitHud();
      return false;
    }
    this.redeployState = {
      selectedAgentIdx: agentIdx,
      cost: this.redeployCost,
      pickingTarget: true,
    };
    this.emitHud();
    return true;
  }

  /** v11：取消重部署（UI 调用：Esc / 点击空白） */
  cancelRedeploy(): void {
    if (this.redeployState) {
      this.redeployState = null;
      this.emitHud();
    }
  }

  // ====================================================================
  // v11：弱点情报系统（方向 C —— 受害者模拟解锁，战斗中对该类型敌人 +20% 伤害）
  // ====================================================================

  /**
   * v11：解锁弱点情报（受害人模拟通关后调用）
   * - 同一敌人类型仅解锁一次，重复调用幂等
   * - 持久化到 platformStore，并在本局立即生效
   */
  unlockWeaknessIntel(enemyTypeId: string, scenarioId: string, desc?: string): void {
    if (this.activeWeaknessIntel.some((w) => w.enemyTypeId === enemyTypeId)) return;
    const def = ENEMIES[enemyTypeId];
    const entry = {
      enemyTypeId,
      damageBonus: 0.2, // +20% 伤害
      desc: desc ?? `识破「${def?.name ?? enemyTypeId}」弱点：该类型诈骗伤害 +20%`,
    };
    this.activeWeaknessIntel.push(entry);
    // 持久化到跨局存档
    platformStore.unlockWeaknessIntel(enemyTypeId, scenarioId, entry.damageBonus);
    this.pushSystemEvent({
      kind: "weaknessIntel",
      title: `弱点情报解锁 · ${def?.name ?? enemyTypeId}`,
      desc: `该类型诈骗伤害 +${Math.round(entry.damageBonus * 100)}%`,
      emoji: "💡",
      color: "#FFD666",
      at: this.t,
      ttl: 3,
    });
    this.emitHud();
  }

  /** v11：从存档加载已解锁的弱点情报到本局（战斗开始时调用） */
  private loadWeaknessIntelFromStore(): void {
    const saved = platformStore.managerMetaRef().weaknessIntel ?? [];
    for (const item of saved) {
      if (!this.activeWeaknessIntel.some((w) => w.enemyTypeId === item.enemyTypeId)) {
        const def = ENEMIES[item.enemyTypeId];
        this.activeWeaknessIntel.push({
          enemyTypeId: item.enemyTypeId,
          damageBonus: item.damageBonus ?? 0.2,
          desc: `识破「${def?.name ?? item.enemyTypeId}」弱点：该类型诈骗伤害 +${Math.round((item.damageBonus ?? 0.2) * 100)}%`,
        });
      }
    }
  }

  /** v11：取目标敌人的弱点情报伤害倍率（1.0=无情报，1.2=有情报） */
  private weaknessDmgMul(enemyTypeId: string): number {
    const intel = this.activeWeaknessIntel.find((w) => w.enemyTypeId === enemyTypeId);
    return intel ? (1 + intel.damageBonus) : 1;
  }

  /** v11：从存档加载自定义难度配置（normal 预设视为无加成，保持 HUD 干净） */
  private loadCustomDifficultyFromStore(): void {
    const meta = platformStore.managerMetaRef();
    const preset = meta.customDifficultyPreset ?? "normal";
    if (preset === "normal") {
      this.customDifficultyCfg = null;
      return;
    }
    if (preset === "custom") {
      this.customDifficultyCfg = meta.customDifficulty ? { ...meta.customDifficulty } : null;
    } else {
      this.customDifficultyCfg = getPresetConfig(preset);
    }
  }

  /** v11：刷怪间隔倍率（越小越密集，默认 1.0） */
  private spawnIntervalFactor(): number {
    return this.customDifficultyCfg?.spawnIntervalMul ?? 1;
  }

  // ====================================================================
  // v11：战斗回放系统（方向 D —— 记录最近 3 局关键帧 + 诈骗类型统计）
  // ====================================================================

  /** v11：采样一帧回放（每 2 秒由 update 调用，或关键事件追加） */
  private recordReplayFrame(event?: string): void {
    const frame: BattleReplayFrame = {
      t: Math.round(this.t * 10) / 10,
      score: this.score,
      baseHp: Math.ceil(this.base.hp),
      wave: this.wave + 1,
      combo: this.combo.count,
      enemyCount: this.enemies.length,
      event,
    };
    this.replayFrames.push(frame);
    // 上限 120 帧（约 4 分钟），超出丢弃最早
    if (this.replayFrames.length > 120) this.replayFrames.shift();
  }

  /** v11：累计诈骗类型击杀（killEnemy 调用） */
  private recordFraudKill(fraudType: string): void {
    if (!this.fraudTypeStats[fraudType]) {
      this.fraudTypeStats[fraudType] = { kills: 0, leaked: 0 };
    }
    this.fraudTypeStats[fraudType].kills += 1;
  }

  /** v11：累计诈骗类型泄漏（敌人到达基地时调用） */
  private recordFraudLeak(fraudType: string): void {
    if (!this.fraudTypeStats[fraudType]) {
      this.fraudTypeStats[fraudType] = { kills: 0, leaked: 0 };
    }
    this.fraudTypeStats[fraudType].leaked += 1;
  }

  /** v11：战斗结束时构建回放记录并持久化（win/lose 调用） */
  private finalizeBattleReplay(win: boolean): void {
    const record: BattleReplayRecord = {
      runId: `${Date.now()}`,
      mode: this.mode,
      modeLabel: this.modeLabel,
      finalScore: this.score,
      win,
      totalWaves: this.mode === "bossRush"
        ? BOSS_RUSH_BOSSES.length
        : this.mode === "endlessRush"
          ? this.endlessAbsWave + 1
          : this.wave + 1,
      durationSec: Math.round((performance.now() - this.startedAt) / 1000),
      agentIds: this.agents.map((a) => a.id),
      fraudTypeStats: this.fraudTypeStats,
      timeline: this.replayFrames.slice(),
      createdAt: Date.now(),
    };
    platformStore.saveBattleReplay(record);
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

  // ====================================================================
  // v9：探员羁绊系统 —— 初始化 / 重算 / 击杀升级 / 运行时钩子
  // ====================================================================

  /** 空快照常量（用于默认值） */
  private static readonly EMPTY_BOND_SNAPSHOT: BondBuffSnapshot = {
    attackPct: 0, fireratePct: 0, rangePct: 0, critRate: 0,
    ultChargePct: 0, comboBoost: 0, healLinkPct: 0, shieldLinkPct: 0, elementLinkMul: 0,
  };

  /** 部署完成后初始化羁绊状态：仅双方均部署的羁绊激活（等待击杀解锁等级） */
  private initBonds(): void {
    this.bondStates = [];
    this.bondAppliedBuffs.clear();
    const deployedIds = this.agents.map((a) => a.id);
    let anyActive = false;
    for (const bond of AGENT_BONDS) {
      const both = bond.agentIds.every((id) => deployedIds.includes(id));
      this.bondStates.push({
        bondId: bond.id,
        currentLevel: 0,
        kills: 0,
        bothDeployed: both,
      });
      if (both) {
        anyActive = true;
        this.floats.push({
          x: W / 2, y: H / 2 + 40,
          text: `羁绊激活：${bond.name}`,
          color: bond.color, life: 1.6, maxLife: 1.6, size: 14,
        });
      }
    }
    if (anyActive) playSfx("shieldBreak");
  }

  /** 聚合指定探员当前所有激活羁绊的 buff（1..currentLevel 效果叠加） */
  private getBondBuffsForAgent(agentId: string): BondBuffSnapshot {
    const snap: BondBuffSnapshot = {
      attackPct: 0, fireratePct: 0, rangePct: 0, critRate: 0,
      ultChargePct: 0, comboBoost: 0, healLinkPct: 0, shieldLinkPct: 0, elementLinkMul: 0,
    };
    for (const bs of this.bondStates) {
      if (!bs.bothDeployed || bs.currentLevel <= 0) continue;
      const bond = AGENT_BONDS.find((b) => b.id === bs.bondId);
      if (!bond || !bond.agentIds.includes(agentId)) continue;
      for (const lvl of bond.levels) {
        if (lvl.level > bs.currentLevel) break;
        switch (lvl.effect) {
          case "attackUp": snap.attackPct += lvl.value; break;
          case "firerateUp": snap.fireratePct += lvl.value; break;
          case "rangeUp": snap.rangePct += lvl.value; break;
          case "critUp": snap.critRate += lvl.value; break;
          case "ultChargeUp": snap.ultChargePct += lvl.value; break;
          case "comboBoost": snap.comboBoost += lvl.value; break;
          case "healLink": snap.healLinkPct += lvl.value; break;
          case "shieldLink": snap.shieldLinkPct += lvl.value; break;
          case "elementLink": snap.elementLinkMul += lvl.value; break;
        }
      }
    }
    return snap;
  }

  /** 读取探员当前已应用的羁绊 buff 快照（运行时钩子用） */
  private bondBuffOf(agentId: string): BondBuffSnapshot {
    return this.bondAppliedBuffs.get(agentId) ?? ManagerEngine.EMPTY_BOND_SNAPSHOT;
  }

  /** 重新计算并增量应用羁绊 stat buff（部署后 / 升级时调用） */
  private refreshBondBuffs(): void {
    for (const a of this.agents) {
      const desired = this.getBondBuffsForAgent(a.id);
      const applied = this.bondAppliedBuffs.get(a.id) ?? ManagerEngine.EMPTY_BOND_SNAPSHOT;
      const def = a.def;
      // 乘算类：先还原已应用的比例，再乘新的
      const rev = (cur: number, pct: number) => (pct > 0 ? cur / (1 + pct) : cur);
      def.attack = Math.max(0, rev(def.attack, applied.attackPct) * (1 + desired.attackPct));
      def.fireRate = Math.max(0.01, rev(def.fireRate, applied.fireratePct) * (1 + desired.fireratePct));
      def.range = Math.max(0, rev(def.range, applied.rangePct) * (1 + desired.rangePct));
      // 加算类（暴击率）：差值替换
      const baseCrit = (a.bonusCritRate ?? 0) - applied.critRate;
      a.bonusCritRate = baseCrit + desired.critRate;
      // 乘算类（大招充能倍率）：还原再乘
      const baseChargeMul = rev(a.ultChargeMul ?? 1, applied.ultChargePct);
      a.ultChargeMul = baseChargeMul * (1 + desired.ultChargePct);
      this.bondAppliedBuffs.set(a.id, desired);
    }
  }

  /** 击杀时推进羁绊进度，达阈值则升级并飘字（由 killEnemy 调用） */
  private onBondKill(): void {
    for (const bs of this.bondStates) {
      if (!bs.bothDeployed) continue;
      bs.kills += 1;
      if (bs.currentLevel >= 3) continue;
      const bond = AGENT_BONDS.find((b) => b.id === bs.bondId);
      if (!bond) continue;
      const nextLevel = (bs.currentLevel + 1) as 1 | 2 | 3;
      const nextLvlDef = bond.levels.find((l) => l.level === nextLevel);
      if (!nextLvlDef || bs.kills < nextLvlDef.requiredKills) continue;
      bs.currentLevel = nextLevel;
      this.refreshBondBuffs();
      this.floats.push({
        x: W / 2, y: H / 2 - 60,
        text: `【${bond.name}】Lv.${nextLevel} ${nextLvlDef.bondLine}`,
        color: bond.color, life: 2.2, maxLife: 2.2, size: 16,
      });
      this.particles.spawnBurst(W / 2, H / 2 - 60, bond.color, { ring: true, sparks: 18, dots: 22, speed: 260, life: 0.9, size: 4 });
      playSfx("shieldBreak");
      // v10：羁绊升级 → push 系统事件通知
      this.pushSystemEvent({
        kind: "bondUpgrade",
        title: `羁绊升级 · ${bond.name}`,
        desc: `Lv.${nextLevel} ${nextLvlDef.bondLine}`,
        emoji: "🤝",
        color: bond.color,
        at: this.t,
        ttl: 3,
      });
    }
  }

  /**
   * v10：push 一条系统事件通知到 recentSystemEvents 队列
   * - 最多保留 3 条，超出按 FIFO 剔除
   * - 超时（at + ttl < this.t）的条目在 emitHud 时自动剔除
   * - 同时给 floats 留一条飘字（即时反馈）
   */
  private pushSystemEvent(ev: SystemEventToast): void {
    this.recentSystemEvents.push(ev);
    if (this.recentSystemEvents.length > 3) {
      this.recentSystemEvents.shift();
    }
    this.floats.push({
      x: W / 2, y: 90 + this.recentSystemEvents.length * 22,
      text: `${ev.emoji} ${ev.title}`,
      color: ev.color, life: Math.min(ev.ttl, 1.6), maxLife: 1.6, size: 14,
    });
  }

  /** 全队羁绊连击加成总和（comboBoost） */
  private totalBondComboBoost(): number {
    let boost = 0;
    for (const bs of this.bondStates) {
      if (bs.currentLevel <= 0) continue;
      const bond = AGENT_BONDS.find((b) => b.id === bs.bondId);
      if (!bond) continue;
      for (const lvl of bond.levels) {
        if (lvl.level > bs.currentLevel) break;
        if (lvl.effect === "comboBoost") boost += lvl.value;
      }
    }
    return boost;
  }

  /** 全队羁绊元素共鸣倍率总和（elementLink） */
  private totalBondElementLinkMul(): number {
    let mul = 0;
    for (const bs of this.bondStates) {
      if (bs.currentLevel <= 0) continue;
      const bond = AGENT_BONDS.find((b) => b.id === bs.bondId);
      if (!bond) continue;
      for (const lvl of bond.levels) {
        if (lvl.level > bs.currentLevel) break;
        if (lvl.effect === "elementLink") mul += lvl.value;
      }
    }
    return mul;
  }

  /** healLink：取造成伤害探员的羁绊搭档（用于伤害转治疗） */
  private bondHealTarget(agentId: string): { target: DeployedAgent; pct: number } | null {
    const snap = this.bondBuffOf(agentId);
    if (snap.healLinkPct <= 0) return null;
    for (const bs of this.bondStates) {
      if (bs.currentLevel <= 0) continue;
      const bond = AGENT_BONDS.find((b) => b.id === bs.bondId);
      if (!bond || !bond.agentIds.includes(agentId)) continue;
      const hasHealLink = bond.levels.some((l) => l.level <= bs.currentLevel && l.effect === "healLink");
      if (!hasHealLink) continue;
      const partnerId = bond.agentIds.find((id) => id !== agentId);
      if (!partnerId) continue;
      const partner = this.agents.find((a) => a.id === partnerId && a.alive);
      if (partner) return { target: partner, pct: snap.healLinkPct };
    }
    return null;
  }

  /** shieldLink：受击探员的羁绊搭档获得护盾（受击时调用） */
  private applyBondShieldLink(damaged: DeployedAgent): void {
    const snap = this.bondBuffOf(damaged.id);
    if (snap.shieldLinkPct <= 0) return;
    for (const bs of this.bondStates) {
      if (bs.currentLevel <= 0) continue;
      const bond = AGENT_BONDS.find((b) => b.id === bs.bondId);
      if (!bond || !bond.agentIds.includes(damaged.id)) continue;
      const hasShieldLink = bond.levels.some((l) => l.level <= bs.currentLevel && l.effect === "shieldLink");
      if (!hasShieldLink) continue;
      const partnerId = bond.agentIds.find((id) => id !== damaged.id);
      if (!partnerId) continue;
      const partner = this.agents.find((a) => a.id === partnerId && a.alive);
      if (!partner) continue;
      const shieldAmount = partner.maxHp * snap.shieldLinkPct;
      partner.shieldValue = (partner.shieldValue ?? 0) + shieldAmount;
      partner.shieldUntil = this.t + 4;
      this.particles.spawnBurst(partner.x, partner.y, "#00E5FF", { sparks: 6, dots: 6, speed: 100, life: 0.5, size: 2 });
    }
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
    const siFactor = this.spawnIntervalFactor();
    for (const entry of wave.enemies) {
      for (let i = 0; i < entry.count; i++) {
        this.spawnQueue.push({
          typeId: entry.typeId,
          lane: entry.lane,
          at: this.prepUntil + (entry.delay + i * entry.interval) * fastWaves * siFactor,
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
    // v8：波次开始触发（受害人 + 口诀 + 手牌）
    this.onV8WaveStart();
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
        const siFactor = this.spawnIntervalFactor();
        for (const entry of wave.enemies) {
          for (let i = 0; i < entry.count; i++) {
            this.spawnQueue.push({
              typeId: entry.typeId,
              lane: entry.lane,
              at: this.prepUntil + (entry.delay + i * entry.interval) * siFactor,
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
    // v8：波次开始触发（受害人 + 口诀 + 手牌）
    this.onV8WaveStart();
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
    // v9：解耦事件触发与 hasReward —— 任意非 BOSS 层若有事件定义即触发
    if (!tf.isBoss) {
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

    // v9：商店购买 cost 校验 —— 分数不足则拒绝并提示，不推进楼层
    if (option.cost !== undefined && this.score < option.cost) {
      this.toast = { text: `分数不足！需要 ${option.cost} 分`, tone: "bad", until: this.t + 2 };
      this.emitHud();
      return;
    }
    if (option.cost !== undefined) {
      this.score -= option.cost;
    }

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
      // ===== v9 新增后果 =====
      case "agentHp": {
        const healPct = outcome.value;
        let count = 0;
        for (const a of this.agents) {
          if (!a.alive) continue;
          const amount = Math.round(a.maxHp * healPct);
          a.hp = Math.min(a.maxHp, a.hp + amount);
          count += 1;
        }
        if (count > 0) {
          this.particles.spawnBurst(W / 2, H / 2, "#52C41A", { ring: true, sparks: 16, dots: 20, speed: 240, life: 0.8, size: 4 });
        }
        this.floats.push({ x: W / 2, y: H / 2 - 40, text: `全探员回血 ${Math.round(healPct * 100)}%`, color: "#52C41A", life: 1.5, maxLife: 1.5, size: 18 });
        break;
      }
      case "freeUpgrade":
        // 立即触发一次免费升级（不消耗 XP）
        if (this.upgradeCount < UPGRADE_MAX_COUNT + this.upgradeMaxCountBonus) {
          this.enterUpgrade();
          this.toast = { text: "免费升级！", tone: "good", until: this.t + 2.5 };
        } else {
          // 已满级则折算成分数
          this.score += 800;
          this.floats.push({ x: W / 2, y: H / 2 - 40, text: `+800 分（升级已满）`, color: "#FFD666", life: 1.5, maxLife: 1.5, size: 18 });
        }
        break;
      case "bondsKills": {
        // 推进羁绊击杀进度（加速羁绊升级）
        for (let i = 0; i < outcome.value; i++) {
          this.onBondKill();
        }
        this.floats.push({ x: W / 2, y: H / 2 - 40, text: `羁绊进度 +${outcome.value}`, color: "#FF7AB8", life: 1.5, maxLife: 1.5, size: 18 });
        break;
      }
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

    // v11：自定义难度倍率（独立于 challenge 词缀，叠加在关卡/模式 scaling 之上）
    if (this.customDifficultyCfg) {
      const cfg = this.customDifficultyCfg;
      hpMul *= cfg.enemyHpMul;
      speedMul *= cfg.enemySpeedMul;
      dmgMul *= cfg.enemyDmgMul;
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
  // v3：探员独有大招（v8 软合并：统一为 CardSkill 释放）
  // ====================================================================

  triggerUlt(): void {
    if (this.over || this.energy < 100 || this.upgradeReady) return;
    if (this.mode === "daily" && this.hasModifier("noUlt")) return;
    // v8 软合并：大招按钮统一为 CardSkill 释放（自动选第一张可用卡牌）
    const availableIdx = this.cardHand.findIndex((c) =>
      this.agents.some((a) => a.alive && a.id === c.agentId),
    );
    if (availableIdx === -1) return;
    const card = this.cardHand[availableIdx];
    const ultAgent = this.agents.find((a) => a.alive && a.id === card.agentId);
    if (!ultAgent) return;

    // 能量清零（保留大招"满 100 释放"的门槛）+ 移除手牌
    this.energy = 0;
    this.cardHand.splice(availableIdx, 1);
    this.cardSkillsUsed++;
    this.ultFlashUntil = this.t + 0.8;
    this.shakeUntil = this.t + 0.5;
    this.ultCount += 1;

    // v7：大招视觉 —— 保留主 flash（关键事件），强化粒子
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
        count: 6, speed: 500, life: 0.5, size: 4, color: card.effect.kind === "pierce" ? "#FF7A1A" : "#FFD666",
        angle,
      });
    }

    // v8 软合并：复用统一卡牌效果派发
    this.applyCardSkillEffect(card.effect, ultAgent);

    // v6：记录大招使用到 platformStore
    platformStore.recordUltUsed();

    // v5：大招名称浮字 —— 双层描边效果（先画阴影层再画主层）
    this.floats.push({
      x: W / 2,
      y: H / 2 - 8,
      text: card.name + "！",
      color: card.color,
      life: 1.6,
      maxLife: 1.6,
      size: 28,
    });
    this.floats.push({
      x: W / 2,
      y: H / 2 + 22,
      text: card.desc.slice(0, 18),
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
    // v10：元素反应 → push 系统事件通知
    this.pushSystemEvent({
      kind: "elementReaction",
      title: `元素反应 · ${def.name}`,
      desc: def.desc,
      emoji: def.emoji,
      color: def.color,
      at: this.t,
      ttl: 3,
    });

    // v9：羁绊 elementLink —— 元素反应触发时附加额外范围伤害
    const elemLinkMul = this.totalBondElementLinkMul();
    if (elemLinkMul > 0) {
      const bonusDmg = Math.round(elemLinkMul * 80);
      let hitCount = 0;
      for (const en of this.enemies) {
        if (Math.hypot(en.x - x, en.y - y) <= 120) {
          en.hp -= bonusDmg;
          hitCount += 1;
        }
      }
      if (hitCount > 0) {
        this.floats.push({ x, y: y - 42, text: `羁绊共鸣 +${bonusDmg}`, color: "#FFD666", life: 1.0, maxLife: 1.0, size: 13 });
        this.particles.spawnBurst(x, y, "#FFD666", { ring: true, sparks: 14, dots: 16, speed: 240, life: 0.7, size: 3 });
      }
    }
  }

  /** 战间答题：波次结束时检查是否需要出题（每 5 波；每 10 波插入案例微型复盘） */
  private checkQuizOnWaveEnd(clearedWave: number): void {
    if (clearedWave > 0 && clearedWave % 5 === 0 && !this.pendingQuiz) {
      const seed = this.dailySeed || "default";
      const wrongQuestions = platformStore.managerMetaProgress().wrongQuestions;
      // v10 P0-1c：每 10 波（20/30/40...）插入"案例最佳拦截点"微型复盘
      // 优先重练案例错题（如存在 wrongCount≥1 的 case 来源错题），否则生成新案例题
      const isCaseWave = clearedWave % 10 === 0;
      if (isCaseWave) {
        // 先尝试重练 case 来源错题
        const retryResult = pickAdaptiveQuiz(
          (w, s) => pickQuiz(w, s),
          wrongQuestions,
          clearedWave,
          seed,
          "case",
        );
        if (retryResult.isRetry) {
          this.pendingQuiz = retryResult.question;
          this.pendingQuizIsRetry = true;
          this.emitHud();
          return;
        }
        // 无 case 错题可重练，生成新案例题
        const caseQuiz = pickRandomCaseMiniQuiz();
        if (caseQuiz) {
          this.pendingQuiz = caseQuiz;
          this.pendingQuizIsRetry = false;
          this.emitHud();
          return;
        }
      }
      // v10：直接消费 v9 结构化错题本 wrongQuestions（含题面），真正还原错题重练
      const { question, isRetry } = pickAdaptiveQuiz(
        (w, s) => pickQuiz(w, s),
        wrongQuestions,
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
    // v10 P0-1c：判断本题是否为案例微型复盘（id 前缀 miniCase_）
    const isCaseQuiz = quiz.id.startsWith("miniCase_");
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
      // v10 P0-1c：案例复盘答对额外给反诈积分
      if (isCaseQuiz) {
        platformStore.state.managerMeta.antiFraudPoints += 15;
        this.floats.push({ x: W / 2, y: H / 2, text: "✓ 案例复盘答对！+15 反诈积分", color: "#FFB020", life: 2.0, maxLife: 2.0, size: 16 });
      }
      this.floats.push({ x: W / 2, y: H / 2, text: "✓ 答对！获得反诈 buff", color: "#52C41A", life: 1.6, maxLife: 1.6, size: 18 });
      this.particles.spawnBurst(W / 2, H / 2, "#52C41A", { ring: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4 });
    } else {
      this.floats.push({ x: W / 2, y: H / 2, text: "✗ 答错：" + quiz.explanation.slice(0, 24), color: "#E5353B", life: 1.8, maxLife: 1.8, size: 14 });
    }
    // v10：双写错题本，保证 v7/v9 两套记录同步
    // - recordQuizAnswerV7：维护旧版 quizWrongRecords（仅次数，向后兼容）
    // - recordWrongQuestion：维护 v9 结构化 wrongQuestions（含题面，供错题重练还原）
    // v10 P0-1c：案例复盘题 source 标记为 "case"，与战间知识题 "battle" 区分
    platformStore.recordQuizAnswerV7(correct, quiz.id);
    platformStore.recordWrongQuestion({
      questionId: quiz.id,
      source: isCaseQuiz ? "case" : "battle",
      questionType: "single",
      questionText: quiz.question,
      options: quiz.options,
      correctAnswer: String(quiz.correctIdx),
      userAnswer: String(optionIdx),
      category: quiz.fraudType,
      explanation: quiz.explanation,
      correct,
    });
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
          // v9：战间遗物商店（每 5 波）
          if (this.pendingRelicShopOffers.length > 0) { this.emitHud(); return; }
          if (this.endlessAbsWave + 1 >= this.relicShopWaveTrigger) {
            this.relicShopWaveTrigger += 5;
            this.openRelicShop();
            return;
          }
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
          // v9：战间遗物商店（每 5 波，答题之后触发）
          if (this.pendingRelicShopOffers.length > 0) { this.emitHud(); return; }
          if (clearedWave >= this.relicShopWaveTrigger) {
            this.relicShopWaveTrigger += 5;
            this.openRelicShop();
            return;
          }
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
    // v8：更新受害人 / 话术气泡 / 战术指令 / 口诀冷却
    this.updateVictims(gdt);
    this.updateSpeechBubbles(gdt);
    this.updateTacticalCommandStates(dt);
    this.updateCounterspellCooldowns(dt);
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

  // ====================================================================
  // v9：敌人 AI 行为树 —— 移动相关行为（disguise/enrage/rush/flank/teleport）
  // 返回修正后的 speed；光环类（fearAura/healAura）由 applyV9Auras 处理
  // reflect/split 分别在 projectile 命中和 killEnemy 中处理
  // ====================================================================

  /** v9：记录敌人 AI 事件（供 HUD 警报展示，最近一次） */
  private recordAIEvent(kind: EnemyAIBehaviorKind, enemyUid: number): void {
    this.lastEnemyAIEvent = { kind, enemyUid, at: this.t };
    // v10：敌人 AI 特殊行为 → push 系统事件通知（让玩家感知敌人有 AI 而非纯走位）
    const aiLabels: Record<EnemyAIBehaviorKind, { emoji: string; title: string }> = {
      patrol: { emoji: "🚶", title: "敌人巡逻" },
      flank: { emoji: "🌀", title: "敌人绕侧" },
      rush: { emoji: "💨", title: "敌人群冲" },
      disguise: { emoji: "🎭", title: "敌人伪装" },
      enrage: { emoji: "🔥", title: "敌人狂暴" },
      split: { emoji: "✂️", title: "敌人分裂" },
      teleport: { emoji: "⚡", title: "敌人瞬移" },
      fearAura: { emoji: "😱", title: "恐惧光环" },
      healAura: { emoji: "💚", title: "治疗光环" },
      reflect: { emoji: "🛡️", title: "伤害反弹" },
    };
    const label = aiLabels[kind];
    if (label) {
      this.pushSystemEvent({
        kind: "enemyAI",
        title: label.title,
        desc: `敌人 #${enemyUid} 触发 ${kind} 行为`,
        emoji: label.emoji,
        color: "#FFB020",
        at: this.t,
        ttl: 2.5,
      });
    }
  }

  private applyV9AI(e: Enemy, baseSpeed: number): number {
    const ai = e.def.aiBehavior;
    if (!ai) return baseSpeed;

    let speed = baseSpeed;
    const hpRatio = e.hp / e.maxHp;

    // 副行为切换：低血量时切换到 secondary（如 farmer enrage → rush）
    if (ai.secondary && ai.trigger?.belowHpRatio && hpRatio < ai.trigger.belowHpRatio) {
      if (e._v9ActiveKind !== ai.secondary) {
        e._v9ActiveKind = ai.secondary;
        this.particles.spawnBurst(e.x, e.y, "#FF3B6B", { ring: true, sparks: 10, dots: 12, speed: 180, life: 0.5, size: 3 });
        this.floats.push({ x: e.x, y: e.y - 32, text: "狂暴!", color: "#E5353B", life: 0.8, maxLife: 0.8, size: 12 });
      }
    }

    const activeKind = e._v9ActiveKind ?? ai.kind;

    switch (activeKind) {
      case "disguise": {
        // 间歇伪装：触发时设置 disguiseUntil，期间无法被攻击且减速
        if (this.t >= (e._v9AiCooldownUntil ?? 0)) {
          const chance = ai.trigger?.chance ?? 0.3;
          const cd = ai.trigger?.cooldown ?? 4;
          if (Math.random() < chance) {
            const dur = ai.params?.disguiseDuration ?? 1.5;
            e._v9DisguiseUntil = this.t + dur;
            e._v9AiCooldownUntil = this.t + dur + cd;
            this.particles.spawnBurst(e.x, e.y, "#A8E6CF", { sparks: 6, dots: 8, speed: 100, life: 0.4, size: 2 });
            this.recordAIEvent("disguise", e.uid);
          } else {
            e._v9AiCooldownUntil = this.t + cd;
          }
        }
        if (this.t < (e._v9DisguiseUntil ?? 0)) {
          speed *= 0.4; // 伪装期间减速
        }
        break;
      }
      case "enrage": {
        // 低血量狂暴：speed+damage 倍率（出口伤害用 _v9EnrageDmgMul）
        const threshold = ai.trigger?.belowHpRatio ?? 0.5;
        if (hpRatio < threshold) {
          const sm = ai.params?.speedMul ?? 1.3;
          const dm = ai.params?.damageMul ?? 1.5;
          speed *= sm;
          e._v9EnrageDmgMul = dm;
          this.recordAIEvent("enrage", e.uid);
        }
        break;
      }
      case "rush": {
        // 群冲：低血量时，给附近同类加速
        const threshold = ai.trigger?.belowHpRatio ?? 0.5;
        if (hpRatio < threshold && this.t >= (e._v9AiCooldownUntil ?? 0)) {
          const sm = ai.params?.speedMul ?? 1.5;
          const cd = ai.trigger?.cooldown ?? 3;
          e._v9AiCooldownUntil = this.t + cd;
          for (const other of this.enemies) {
            if (other === e) continue;
            if (other.def.id === e.def.id && Math.hypot(other.x - e.x, other.y - e.y) < 150) {
              other._v9RushUntil = this.t + 2;
              other._v9RushMul = sm;
            }
          }
          this.particles.spawnBurst(e.x, e.y, "#FF3B6B", { ring: true, sparks: 10, dots: 12, speed: 180, life: 0.5, size: 3 });
          this.recordAIEvent("rush", e.uid);
        }
        // 自身或被波及的 rush 加速
        if (this.t < (e._v9RushUntil ?? 0)) {
          speed *= (e._v9RushMul ?? 1);
        }
        break;
      }
      case "flank": {
        // 绕侧：间歇切换侧向偏移，模拟绕路到侧翼
        if (this.t >= (e._v9AiCooldownUntil ?? 0)) {
          const chance = ai.trigger?.chance ?? 0.4;
          const cd = ai.trigger?.cooldown ?? 2;
          if (Math.random() < chance) {
            e._v9AiCooldownUntil = this.t + cd;
            e._v9FlankOffset = (Math.random() < 0.5 ? -1 : 1) * 35;
            e._v9FlankUntil = this.t + 1.5;
            this.recordAIEvent("flank", e.uid);
          } else {
            e._v9AiCooldownUntil = this.t + cd;
          }
        }
        break;
      }
      case "teleport": {
        // 低血量瞬移到出口附近
        const threshold = ai.trigger?.belowHpRatio ?? 0.3;
        if (hpRatio < threshold && this.t >= (e._v9AiCooldownUntil ?? 0)) {
          const cd = ai.trigger?.cooldown ?? 3;
          e._v9AiCooldownUntil = this.t + cd;
          const wps = e.myWaypoints.length >= 2 ? e.myWaypoints : this.maze.waypoints;
          const dist = ai.params?.teleportToExitDist ?? 3;
          const jump = Math.min(dist, wps.length - (e.myWaypoints.length >= 2 ? e.myPathIdx : e.pathIdx) - 1);
          if (jump > 0) {
            if (e.myWaypoints.length >= 2) e.myPathIdx += jump;
            else e.pathIdx += jump;
            const newTarget = wps[e.myWaypoints.length >= 2 ? e.myPathIdx : e.pathIdx];
            if (newTarget) { e.x = newTarget.x; e.y = newTarget.y; }
            this.particles.spawnBurst(e.x, e.y, "#9D6BFF", { ring: true, sparks: 12, dots: 14, speed: 200, life: 0.6, size: 3 });
            this.recordAIEvent("teleport", e.uid);
          }
        }
        break;
      }
      case "patrol":
      case "fearAura":
      case "healAura":
      case "reflect":
      case "split":
        // patrol=默认移动；fearAura/healAura=applyV9Auras；reflect=projectile命中；split=killEnemy
        break;
    }

    return speed;
  }

  // ====================================================================
  // v9：光环类行为 —— fearAura（探员射速 -30%）+ healAura（附近敌人回血）
  // 在 updateEnemies 循环外调用一次
  // ====================================================================

  private applyV9Auras(dt: number): void {
    const fearSources: { x: number; y: number; r: number }[] = [];
    const healSources: { x: number; y: number; r: number; hps: number }[] = [];
    for (const e of this.enemies) {
      const ai = e.def.aiBehavior;
      if (!ai) continue;
      const kind = e._v9ActiveKind ?? ai.kind;
      if (kind === "fearAura") {
        fearSources.push({ x: e.x, y: e.y, r: ai.params?.auraRadius ?? 120 });
      } else if (kind === "healAura") {
        healSources.push({ x: e.x, y: e.y, r: ai.params?.auraRadius ?? 100, hps: ai.params?.healPerSec ?? 6 });
      }
    }
    // fearAura：标记探员受恐惧（updateAgents 读取 _v9FearedUntil 降低射速）
    if (fearSources.length > 0) {
      for (const a of this.agents) {
        if (!a.alive) continue;
        let feared = false;
        for (const s of fearSources) {
          if (Math.hypot(a.x - s.x, a.y - s.y) < s.r) { feared = true; break; }
        }
        if (feared) a._v9FearedUntil = this.t + 0.3;
      }
    }
    // healAura：附近敌人每秒回血
    if (healSources.length > 0) {
      for (const e of this.enemies) {
        for (const s of healSources) {
          if (Math.hypot(e.x - s.x, e.y - s.y) < s.r) {
            e.hp = Math.min(e.maxHp, e.hp + s.hps * dt);
          }
        }
      }
    }
  }

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

      // v9：敌人 AI 行为树 —— 应用移动相关行为（disguise/enrage/rush/flank/teleport）
      speed = this.applyV9AI(e, speed);

      // v11：地形效果 —— 瓶颈减速 20%；陷阱每秒损 8% 最大血量
      const eTerrain = this.enemyTerrainKind(e);
      if (eTerrain === "chokepoint") {
        speed *= 0.8;
      } else if (eTerrain === "trap") {
        const trapDmg = e.maxHp * 0.08 * dt;
        e.hp -= trapDmg;
        if (Math.random() < 0.15) {
          this.particles.spawn({ x: e.x, y: e.y, count: 2, speed: 50, life: 0.3, size: 2, color: "#FF4081" });
        }
        if (e.hp <= 0) {
          this.killEnemy(e, "__trap__");
          continue;
        }
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
      // v8：taunt 指令 —— 被嘲讽时改向嘲讽探员位置
      const tauntActive = e._v8TauntUntil !== undefined && this.t < e._v8TauntUntil && e._v8TauntBy !== undefined;
      if (tauntActive) {
        const dx = e._v8TauntBy! - e.x;
        const dist = Math.abs(dx);
        if (dist > 4) {
          const step = Math.min(dist, speed * dt);
          e.x += Math.sign(dx) * step;
        }
      } else if (idx < wps.length) {
        const target = wps[idx];
        const dx = target.x - e.x;
        // v9：flank 行为 —— 绕侧时临时偏移 y 目标，模拟绕路到侧翼
        const flankOffset = (this.t < (e._v9FlankUntil ?? 0)) ? (e._v9FlankOffset ?? 0) : 0;
        const dy = (target.y + flankOffset) - e.y;
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
        // v9：AI enrage 行为 —— 低血量狂暴时到达出口伤害倍率
        if (e._v9EnrageDmgMul && e._v9EnrageDmgMul > 1) {
          dmg *= e._v9EnrageDmgMul;
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

    // v9：光环类行为 —— fearAura（标记探员）+ healAura（敌人回血），循环外调用一次
    this.applyV9Auras(dt);
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

      // v11：安全岛地形 —— 无敌 + 每秒回血 5%
      if (this.agentOnSafeIsland(a)) {
        a.invulnUntil = this.t + 0.2; // 滚动续期无敌
        if (a.hp < a.maxHp) {
          a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.05 * dt);
        }
      }

      // v3：fear 技能（附近恐吓语音 → 射速 -30%）—— 按距离判定
      let agentFireMul = fireRateMul;
      for (const e of this.enemies) {
        if (e.def.ability === "fear" && Math.hypot(e.x - a.x, e.y - a.y) < 150) {
          agentFireMul *= 0.7;
          break;
        }
      }
      // v9：fearAura 行为 —— 受恐惧光环影响时射速 -30%
      if (this.t < (a._v9FearedUntil ?? 0)) {
        agentFireMul *= 0.7;
      }

      // v8：战术指令 buff —— focusFire 射速 +20%；retreat 期间无法攻击
      const agentIdx = this.agents.indexOf(a);
      const cmdState = agentIdx >= 0 ? this.tacticalCommandStates[agentIdx] : undefined;
      if (cmdState?.activeKind === "focusFire") agentFireMul *= 1.2;
      if (cmdState?.activeKind === "retreat") {
        // 后撤期间无法攻击，并逐步回位（向原位反向移动）
        a.x -= 20 * dt;
        continue;
      }

      a.cooldown -= dt * agentFireMul;
      if (a.cooldown <= 0) {
        const target = this.findTarget(a);
        if (target) {
          a.cooldown = 1 / a.def.fireRate;
          a.flashUntil = this.t + 0.08;
          // v8：overdrive 攻击 +50%
          const overdriveMul = cmdState?.activeKind === "overdrive" ? 1.5 : 1;
          this.fireProjectile(a, target, noHealMul * overdriveMul);
        }
      }
    }
  }

  /** v5：距离判定寻敌 —— 在射程内选路径进度最大（最靠近出口）的敌人 */
  private findTarget(a: DeployedAgent): Enemy | null {
    const rangeMul = this.upgradeMul("range");
    // v11：高地地形射程 +30%
    const terrainRangeMul = this.agentOnHighland(a) ? 1.3 : 1;
    const effectiveRange = a.def.range * rangeMul * terrainRangeMul;
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
    let pierceLeft = this.pierceAll ? 9999 : pierceUpgradeCount * 1;
    // v8：reload 指令 —— 下 3 次攻击穿透 +1
    if (a._v8ReloadPierceLeft && a._v8ReloadPierceLeft > 0) {
      pierceLeft += 1;
      a._v8ReloadPierceLeft -= 1;
    }

    // v6：全队伤害加成（resonance 元素反应 / 技能链 buff / 答题 buff）
    let dmgBoost = 1;
    if (this.t < this.damageBoostUntil) dmgBoost *= this.damageBoostMul;
    if (this.t < this.quizBuffUntil && this.quizBuff) dmgBoost *= (1 + this.quizBuff.attackPct);

    const attackMul = this.upgradeMul("attack") * noHealMul * dmgBoost;
    // v11：高地地形伤害 +15%
    const terrainDmgMul = this.agentOnHighland(a) ? 1.15 : 1;
    // v11：瓶颈地形 AOE 范围 +30%（探员在瓶颈格时溅射扩大）
    const terrainSplashMul = this.agentTerrainKind(a) === "chokepoint" ? 1.3 : 1;
    // v11：弱点情报 —— 对该类型敌人 +20% 伤害
    const weakMul = this.weaknessDmgMul(target.def.id);
    this.spawnProjectile(a, target, a.def.attack * crit * attackMul * terrainDmgMul * weakMul, isCrit, pierceLeft, (a.def.splash ?? 0) * terrainSplashMul);

    // v5：doubleShot 升级 —— 额外发射一枚投射物（60% 伤害），目标为同一次寻敌中次近的敌人
    const doubleShotCount = this.upgrades.filter((u) => u === "doubleShot").length;
    if (doubleShotCount > 0) {
      const secondary = this.findSecondaryTarget(a, target);
      const secWeakMul = secondary ? this.weaknessDmgMul(secondary.def.id) : weakMul;
      const secDmg = a.def.attack * crit * attackMul * terrainDmgMul * secWeakMul * 0.6;
      const secSplash = (a.def.splash ?? 0) * terrainSplashMul;
      if (secondary) {
        this.spawnProjectile(a, secondary, secDmg, isCrit, pierceLeft, secSplash);
      } else {
        // 没有次目标，再打一发到主目标
        this.spawnProjectile(a, target, secDmg, isCrit, pierceLeft, secSplash);
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
    // v8：口诀击破施加的单敌人易伤
    const v8VulnMul = (e._v8VulnUntil && this.t < e._v8VulnUntil) ? (e._v8VulnMul ?? 1) : 1;
    // v9：disguise 行为 —— 伪装期间无法被攻击（伤害为 0，不触发反射）
    const v9DisguiseActive = this.t < (e._v9DisguiseUntil ?? 0);
    const effectiveDmg = v9DisguiseActive ? 0 : totalDmg * v8VulnMul;
    e.hp -= effectiveDmg;
    if (v9DisguiseActive) {
      this.particles.spawn({ x: e.x, y: e.y, count: 4, speed: 80, life: 0.3, size: 2, color: "#A8E6CF" });
    }

    // v9：羁绊 healLink —— 造成伤害时为羁绊搭档回血
    if (effectiveDmg > 0) {
      const heal = this.bondHealTarget(p.agentId);
      if (heal) {
        const amount = effectiveDmg * heal.pct;
        heal.target.hp = Math.min(heal.target.maxHp, heal.target.hp + amount);
        this.particles.spawnBurst(heal.target.x, heal.target.y, "#52C41A", { sparks: 4, dots: 4, speed: 80, life: 0.4, size: 2 });
      }
    }

    // v6/v9：reflect 能力/AI 行为 —— 反射伤害给最近探员（探员护盾优先吸收）
    const hasReflectAbility = e.def.ability === "reflect";
    const v9ReflectAi = e.def.aiBehavior?.kind === "reflect";
    if ((hasReflectAbility || v9ReflectAi) && effectiveDmg > 0) {
      const reflectRatio = v9ReflectAi ? (e.def.aiBehavior?.params?.reflectRatio ?? 0.2) : 0.2;
      const reflectDmg = effectiveDmg * reflectRatio;
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
          // v9：羁绊 shieldLink —— 受击时为羁绊搭档叠加护盾
          this.applyBondShieldLink(nearest);
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

    // v10：收集本局击破的敌人 fraudType（去重，结算页展示"本局学到的反诈知识点"）
    if (e.def.fraudType && !this.learnedFraudTipsThisRun.includes(e.def.fraudType)) {
      this.learnedFraudTipsThisRun.push(e.def.fraudType);
    }

    // v11：首次击杀该类型敌人时解锁对应图鉴条目（含 v11 新敌人）
    if (e.def.codexId && !this.releasedEnemyCodexIds.has(e.def.id)) {
      this.releasedEnemyCodexIds.add(e.def.id);
      platformStore.unlockCodexEntry(e.def.codexId, "enemy");
    }

    // v3：连击更新
    this.combo.count += 1;
    this.combo.lastKillAt = this.t;
    this.combo.maxCount = Math.max(this.combo.maxCount, this.combo.count);
    this.combo.multiplier = comboMul(this.combo.count);
    // v9：羁绊 comboBoost —— 连击倍率额外加成
    const bondComboBoost = this.totalBondComboBoost();
    if (bondComboBoost > 0) this.combo.multiplier += bondComboBoost;

    // v9：羁绊击杀进度推进（达阈值升级）
    this.onBondKill();

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
    // v9：AI split 行为 —— 分裂为 splitTypeId 指定的小怪（优先于 v6 ability，避免重复触发）
    const v9SplitAi = e.def.aiBehavior?.kind === "split";
    const v6SplitAbility = e.def.ability === "split";
    if (v9SplitAi && !e.bossRef && !e._v9SplitDone) {
      const splitTypeId = e.def.aiBehavior?.params?.splitTypeId ?? e.def.id;
      const splitBaseDef = ENEMIES[splitTypeId];
      if (splitBaseDef) {
        for (let i = 0; i < 2; i++) {
          const splitDef: EnemyDef = {
            ...splitBaseDef,
            id: `${splitBaseDef.id}_split`,
            name: `${splitBaseDef.name}(分裂)`,
            hp: Math.max(1, Math.round(e.maxHp * 0.3)),
            ability: "none",
            aiBehavior: undefined, // 分裂体不再携带 split 行为，避免无限递归
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
            _v9SplitDone: true, // 分裂体标记，防止再次分裂
          });
          this.particles.spawnBurst(e.x + ox, e.y + oy, splitBaseDef.color, { sparks: 8, dots: 10, speed: 160, life: 0.5, size: 2 });
        }
      }
    } else if (v6SplitAbility && !v9SplitAi && !e.bossRef) {
      // v6：split 能力 —— 分裂为 2 个自身副本（hp = maxHp × 0.3）
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

  // ====================================================================
  // v9：遗物合成系统 —— 合成 / 拆解 / 战间商店
  // ====================================================================

  /** v9：合成遗物（消耗 3 个 ingredient + 金币/情报，写入 managerMeta） */
  craftRelic(relicId: string): boolean {
    const relic = getRelic(relicId);
    if (!relic || !relic.recipe || relic.tier < 2) return false;
    const meta = platformStore.state.managerMeta;
    const unlockedRecipes = meta.unlockedRecipes ?? [];
    if (!unlockedRecipes.includes(relicId)) return false;
    // 检查 ingredient 是否都拥有
    const ownedSet = new Set(meta.ownedRelics ?? []);
    for (const ing of relic.recipe.ingredients) {
      if (!ownedSet.has(ing)) return false;
    }
    // 检查金币/情报
    if ((meta.coins ?? 0) < relic.recipe.coinCost) return false;
    if (relic.recipe.intelCost && (meta.intel ?? 0) < relic.recipe.intelCost) return false;
    // 扣除 ingredient（从 ownedRelics 移除）
    const newOwned = (meta.ownedRelics ?? []).filter((id) => !relic.recipe!.ingredients.includes(id));
    // 扣除金币/情报
    meta.coins = (meta.coins ?? 0) - relic.recipe.coinCost;
    if (relic.recipe.intelCost) meta.intel = (meta.intel ?? 0) - relic.recipe.intelCost;
    // 添加合成遗物
    newOwned.push(relicId);
    meta.ownedRelics = newOwned;
    // 从装备中移除被消耗的 ingredient
    meta.equippedRelics = (meta.equippedRelics ?? []).filter((id) => !relic.recipe!.ingredients.includes(id));
    platformStore.save();
    this.toast = { text: `🔆 合成成功！获得 ${relic.name}`, tone: "good", until: this.t + 2.5 };
    this.particles.spawnBurst(W / 2, H / 2, relic.color, { ring: true, shockwave: true, sparks: 24, dots: 28, speed: 320, life: 1.0, size: 4 });
    postFX.flash(relic.color, 0.4, 1.8);
    playSfx("good");
    this.emitHud();
    return true;
  }

  /** v9：拆解遗物（获得碎片，tier 1=2, tier 2=6, tier 3=18） */
  decomposeRelic(relicId: string): boolean {
    const relic = getRelic(relicId);
    if (!relic) return false;
    const meta = platformStore.state.managerMeta;
    const owned = meta.ownedRelics ?? [];
    if (!owned.includes(relicId)) return false;
    const shards = relic.decomposeShards ?? (relic.tier === 3 ? 18 : relic.tier === 2 ? 6 : 2);
    // 移除遗物
    meta.ownedRelics = owned.filter((id) => id !== relicId);
    meta.equippedRelics = (meta.equippedRelics ?? []).filter((id) => id !== relicId);
    // 增加碎片
    const shardMap = { ...(meta.relicShards ?? {}) };
    shardMap[relicId] = (shardMap[relicId] ?? 0) + shards;
    meta.relicShards = shardMap;
    platformStore.save();
    this.toast = { text: `🔧 拆解 ${relic.name}，获得 ${shards} 碎片`, tone: "info", until: this.t + 2 };
    this.emitHud();
    return true;
  }

  /** v9：用碎片合成遗物（集齐 N 碎片可拼出完整遗物，tier 1=5 碎片, tier 2=15, tier 3=40） */
  craftRelicFromShards(relicId: string): boolean {
    const relic = getRelic(relicId);
    if (!relic) return false;
    const meta = platformStore.state.managerMeta;
    const shardMap = meta.relicShards ?? {};
    const need = relic.tier === 3 ? 40 : relic.tier === 2 ? 15 : 5;
    if ((shardMap[relicId] ?? 0) < need) return false;
    shardMap[relicId] = (shardMap[relicId] ?? 0) - need;
    meta.relicShards = shardMap;
    if (!(meta.ownedRelics ?? []).includes(relicId)) {
      meta.ownedRelics = [...(meta.ownedRelics ?? []), relicId];
    }
    platformStore.save();
    this.toast = { text: `🔧 碎片拼合成功！获得 ${relic.name}`, tone: "good", until: this.t + 2.5 };
    this.particles.spawnBurst(W / 2, H / 2, relic.color, { ring: true, sparks: 18, dots: 22, speed: 280, life: 0.9, size: 4 });
    playSfx("good");
    this.emitHud();
    return true;
  }

  /** v9：开启战间遗物商店（每 5 波触发，三选一） */
  private openRelicShop(): void {
    const meta = platformStore.state.managerMeta;
    const offers: RelicShopOffer[] = [];
    const ownedRelics = new Set(meta.ownedRelics ?? []);
    const ownedRecipes = new Set(meta.unlockedRecipes ?? []);
    // 候选池：未拥有的 tier 1 遗物 + 未解锁的 tier 2/3 配方 + 碎片包
    const tier1Pool = RELICS.filter((r) => r.tier === 1 && !ownedRelics.has(r.id));
    const recipePool = RELICS.filter((r) => r.tier >= 2 && r.recipe && !ownedRecipes.has(r.id));
    // 随机抽取 3 个 offer
    const offerSlots: RelicShopOffer[] = [];
    // 槽 1：tier 1 遗物（如果有未拥有的）
    if (tier1Pool.length > 0) {
      const r = tier1Pool[Math.floor(Math.random() * tier1Pool.length)];
      offerSlots.push({
        id: `offer_${r.id}`, kind: "relic", relicId: r.id,
        name: r.name, emoji: r.emoji, desc: r.desc, color: r.color,
        price: 150, rarity: r.rarity, tier: r.tier,
      });
    }
    // 槽 2：配方（tier 2/3）或碎片包
    if (recipePool.length > 0 && Math.random() < 0.6) {
      const r = recipePool[Math.floor(Math.random() * recipePool.length)];
      offerSlots.push({
        id: `offer_recipe_${r.id}`, kind: "recipe", relicId: r.id,
        name: `${r.name} 配方`, emoji: "📜", desc: `解锁合成：${r.name}`, color: "#9D6BFF",
        price: r.tier === 3 ? 300 : 200, tier: r.tier,
      });
    } else {
      // 碎片包：随机选一个 tier 1 遗物的碎片
      const shardTarget = RELICS.filter((r) => r.tier === 1)[Math.floor(Math.random() * 12)];
      offerSlots.push({
        id: `offer_shard_${shardTarget.id}`, kind: "shardPack",
        shardForRelicId: shardTarget.id, shardCount: 3,
        name: `${shardTarget.name} 碎片×3`, emoji: "🔧", desc: `3 个 ${shardTarget.name} 碎片`, color: "#FFB020",
        price: 80,
      });
    }
    // 槽 3：必出碎片包或 tier 1 遗物（保底）
    if (tier1Pool.length > 0 && Math.random() < 0.5) {
      const r = tier1Pool[Math.floor(Math.random() * tier1Pool.length)];
      offerSlots.push({
        id: `offer_${r.id}_2`, kind: "relic", relicId: r.id,
        name: r.name, emoji: r.emoji, desc: r.desc, color: r.color,
        price: 150, rarity: r.rarity, tier: r.tier,
      });
    } else {
      const shardTarget = RELICS.filter((r) => r.tier === 1)[Math.floor(Math.random() * 12)];
      offerSlots.push({
        id: `offer_shard_${shardTarget.id}_2`, kind: "shardPack",
        shardForRelicId: shardTarget.id, shardCount: 5,
        name: `${shardTarget.name} 碎片×5`, emoji: "🔧", desc: `5 个 ${shardTarget.name} 碎片`, color: "#FFB020",
        price: 120,
      });
    }
    this.pendingRelicShopOffers = offerSlots;
    this.toast = { text: "🏪 战间商店开启！三选一购买", tone: "good", until: this.t + 3 };
    postFX.flash("#FFB020", 0.3, 1.5);
    this.emitHud();
  }

  /** v9：购买战间商店 offer */
  buyRelicShopOffer(offerId: string): boolean {
    const offer = this.pendingRelicShopOffers.find((o) => o.id === offerId);
    if (!offer) return false;
    const meta = platformStore.state.managerMeta;
    if ((meta.coins ?? 0) < offer.price) {
      this.toast = { text: "金币不足！", tone: "bad", until: this.t + 1.5 };
      return false;
    }
    meta.coins = (meta.coins ?? 0) - offer.price;
    if (offer.kind === "relic" && offer.relicId) {
      if (!(meta.ownedRelics ?? []).includes(offer.relicId)) {
        meta.ownedRelics = [...(meta.ownedRelics ?? []), offer.relicId];
      }
      this.toast = { text: `✨ 获得 ${offer.name}！`, tone: "good", until: this.t + 2.5 };
    } else if (offer.kind === "recipe" && offer.relicId) {
      if (!(meta.unlockedRecipes ?? []).includes(offer.relicId)) {
        meta.unlockedRecipes = [...(meta.unlockedRecipes ?? []), offer.relicId];
      }
      this.toast = { text: `📜 解锁配方：${offer.name}`, tone: "good", until: this.t + 2.5 };
    } else if (offer.kind === "shardPack" && offer.shardForRelicId) {
      const shardMap = { ...(meta.relicShards ?? {}) };
      shardMap[offer.shardForRelicId] = (shardMap[offer.shardForRelicId] ?? 0) + (offer.shardCount ?? 3);
      meta.relicShards = shardMap;
      this.toast = { text: `🔧 获得 ${offer.name}`, tone: "good", until: this.t + 2 };
    }
    platformStore.save();
    this.particles.spawnBurst(W / 2, H / 2, offer.color, { ring: true, sparks: 16, dots: 20, speed: 240, life: 0.8, size: 4 });
    playSfx("good");
    this.pendingRelicShopOffers = [];
    this.emitHud();
    return true;
  }

  /** v9：跳过战间商店（不购买，继续下一波） */
  closeRelicShop(): void {
    this.pendingRelicShopOffers = [];
    this.emitHud();
  }

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
      // v10：本局学到的反诈知识点（按击破敌人 fraudType 去重）
      stats: { learnedFraudTips: [...this.learnedFraudTipsThisRun] },
    };
    // v10：写入跨局统计
    this.commitLearnedFraudTips();
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
    // v8：案例五步复盘 —— 优先用本局最后击破的 BOSS id，否则按当前关卡取代表性案例
    const refId = this.lastDefeatedBossId
      ?? (this.mode === "bossRush" ? this.currentBoss?.id : undefined)
      ?? LEVELS[this.level - 1]?.enemyTypes[0]
      ?? "robot";
    // v11：先查 v8 案例五步复盘，fallback 到 v11 新增案例
    this.pendingCaseBreakdown = getCaseBreakdownByEnemyId(refId)
      ?? getV11CaseBreakdownByEnemyId(refId)
      ?? null;
    // v9：启动分支式调查（与五步复盘并存，调查优先展示；caseId 用 case_ 前缀）
    const caseId = `case_${refId}`;
    this.startInvestigation(caseId);
    this.emit({ type: "result", payload: this.result });
    this.emitHud();
  }

  /** v8：案例五步复盘答题 —— 玩家选择拦截点（step 索引 0..4） */
  answerCaseBreakdown(stepIdx: number): boolean {
    if (!this.pendingCaseBreakdown) return false;
    const correct = stepIdx === this.pendingCaseBreakdown.correctInterceptIdx;
    this.lastBreakdownCorrect = correct;
    if (correct) {
      this.score += this.pendingCaseBreakdown.reward.score;
      platformStore.state.managerMeta.antiFraudPoints += this.pendingCaseBreakdown.reward.antiFraudPoints;
      this.floats.push({ x: W / 2, y: H / 2, text: `复盘答对！+${this.pendingCaseBreakdown.reward.score}分`, color: "#52C41A", life: 2.0, maxLife: 2.0, size: 18 });
      this.particles.spawnBurst(W / 2, H / 2, "#52C41A", { ring: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4 });
    } else {
      const correctStep = this.pendingCaseBreakdown.steps[this.pendingCaseBreakdown.correctInterceptIdx];
      this.floats.push({ x: W / 2, y: H / 2, text: `正确拦截点：${correctStep?.name ?? ""}`, color: "#FFB020", life: 2.2, maxLife: 2.2, size: 14 });
    }
    this.emitHud();
    return correct;
  }

  /** v8：关闭案例复盘 overlay（玩家答题后由 Scene 调用，露出底层结算页） */
  dismissCaseBreakdown(): void {
    this.pendingCaseBreakdown = null;
    this.lastBreakdownCorrect = undefined;
    this.emitHud();
  }

  // ====================================================================
  // v9：案例分支式调查 —— 5 阶段分支选择，累计证据/损失，S/A/B/C/D 评级
  // ====================================================================

  /** v9：启动分支式调查（由 win() 触发，caseId 来自最后击破的 BOSS/敌人） */
  private startInvestigation(caseId: string): void {
    let investigation = getCaseInvestigation(caseId);
    // v10：boss_xxx 形式回退到 enemyTypeId（boss_deepseek → case_deepseekFake）
    if (!investigation && caseId.startsWith("case_boss_")) {
      const bossToEnemyCase: Record<string, string> = {
        "case_boss_deepseek": "case_deepseekFake",
        "case_boss_aiface": "case_aiFaceSwap",
      };
      const mapped = bossToEnemyCase[caseId];
      if (mapped) investigation = getCaseInvestigation(mapped);
    }
    if (!investigation) return;
    this.pendingInvestigation = {
      caseId,
      investigation,
      currentNodeId: investigation.startNodeId,
      evidence: 0,
      loss: 0,
      history: [],
      ending: null,
    };
    this.emitHud();
  }

  /** v9：调查选择 —— 玩家在当前节点选择一个选项，累计 evidence/loss，推进到下一节点或结算 */
  answerInvestigation(choiceIdx: number): boolean {
    if (!this.pendingInvestigation || this.pendingInvestigation.ending) return false;
    const st = this.pendingInvestigation;
    const node = st.investigation.nodes.find((n) => n.id === st.currentNodeId);
    if (!node || choiceIdx < 0 || choiceIdx >= node.choices.length) return false;
    const choice = node.choices[choiceIdx];
    // 累计证据/损失
    st.evidence += choice.evidenceDelta ?? 0;
    st.loss += choice.lossDelta ?? 0;
    st.history.push({ nodeId: st.currentNodeId, choiceIdx, feedback: choice.feedback });
    st.lastFeedback = choice.feedback;
    // 推进到下一节点或结算
    if (choice.nextNodeId === null || choice.nextNodeId === undefined) {
      // 进入结局判定
      this.finishInvestigation();
    } else {
      st.currentNodeId = choice.nextNodeId;
    }
    this.emitHud();
    return true;
  }

  /** v9：调查结算 —— 根据累计 evidence/loss 匹配最高评级结局，发放奖励 */
  private finishInvestigation(): void {
    if (!this.pendingInvestigation) return;
    const st = this.pendingInvestigation;
    // 按 minEvidence 降序、maxLoss 升序匹配最佳结局
    const sorted = [...st.investigation.endings].sort((a, b) => {
      // 优先匹配 minEvidence 高的，其次 maxLoss 低的
      if (b.minEvidence !== a.minEvidence) return b.minEvidence - a.minEvidence;
      return a.maxLoss - b.maxLoss;
    });
    let chosen = sorted[sorted.length - 1]; // 兜底：最低评级
    for (const e of sorted) {
      if (st.evidence >= e.minEvidence && st.loss <= e.maxLoss) {
        chosen = e;
        break;
      }
    }
    st.ending = chosen;
    // 发放奖励：基础分 × rewardMul
    const baseReward = 500;
    const gained = Math.round(baseReward * chosen.rewardMul);
    this.score += gained;
    platformStore.state.managerMeta.antiFraudPoints += Math.round(50 * chosen.rewardMul);
    platformStore.state.managerMeta.caseBreakdownCorrectCount += chosen.rank === "S" || chosen.rank === "A" ? 1 : 0;
    platformStore.state.managerMeta.caseBreakdownTotalCount += 1;
    platformStore.save();
    this.floats.push({
      x: W / 2, y: H / 2 - 30,
      text: `调查评级 ${chosen.rank}！+${gained} 分`,
      color: chosen.rank === "S" ? "#FFD666" : chosen.rank === "A" ? "#52C41A" : "#FFB020",
      life: 2.5, maxLife: 2.5, size: 22,
    });
    this.particles.spawnBurst(W / 2, H / 2, chosen.rank === "S" ? "#FFD666" : "#52C41A", {
      ring: true, shockwave: true, sparks: 28, dots: 34, speed: 340, life: 1.1, size: 5,
    });
    postFX.flash(chosen.rank === "S" ? "#FFD666" : "#52C41A", 0.4, 2.0);
    playSfx("win");
    this.emitHud();
  }

  /** v9：关闭调查 overlay（玩家查看结局后由 Scene 调用） */
  dismissInvestigation(): void {
    this.pendingInvestigation = null;
    this.emitHud();
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
      // v10：本局学到的反诈知识点（即使失败也保留，强化"失败也是学习"教育意义）
      stats: { learnedFraudTips: [...this.learnedFraudTipsThisRun] },
    };
    // v10：写入跨局统计
    this.commitLearnedFraudTips();
    // v7：失败 —— 保留 flash + shake，移除 glitch（避免失败瞬间叠加故障闪烁）
    postFX.flash("#E5353B", 0.45, 2);
    postFX.shake(10, 16);
    playSfx("lose");
    // v7：游戏结束时检查总击杀里程碑口诀解锁
    this.checkTermUnlocksForTotalKills();
    this.emit({ type: "result", payload: this.result });
  }

  /**
   * v10：把本局学到的反诈知识点写入跨局统计
   * - 累加 learnedFraudTipsTotal
   * - 合并到 learnedFraudTipsThisRun（持久化，供 Hub/Progression 展示）
   * - 清空本局临时集合（避免下次开局污染）
   */
  private commitLearnedFraudTips(): void {
    const tips = this.learnedFraudTipsThisRun;
    if (tips.length === 0) return;
    const meta = platformStore.state.managerMeta;
    // 累计计数（按知识点种类数累加，避免同一知识点重复计数）
    meta.learnedFraudTipsTotal += tips.length;
    // 合并到持久化本局列表（供 Hub 展示最近一次学习记录；上限 50 条防膨胀）
    const merged = Array.from(new Set([...(meta.learnedFraudTipsThisRun ?? []), ...tips]));
    meta.learnedFraudTipsThisRun = merged.slice(-50);
    platformStore.save();
    // 清空本局临时集合（下次开局从 0 开始）
    this.learnedFraudTipsThisRun = [];
  }

  // ====================================================================
  // HUD 发射
  // ====================================================================

  private emitHud(): void {
    const bossEnemy = this.enemies.find((e) => e.bossRef);
    const endlessTier = this.mode === "endlessRush" ? endlessScaling(this.endlessAbsWave).tier : undefined;
    // v8 软合并：大招名称/描述从第一张可用手牌取（不再用 UltDef）
    const ultCard = this.cardHand.find((c) =>
      this.agents.some((a) => a.alive && a.id === c.agentId),
    );

    const hud: ManagerHud = {
      phase: this.over ? (this.result?.win ? "won" : "lost")
        : this.pendingInvestigation ? "investigation"
        : this.pendingRelicShopOffers.length > 0 ? "shop"
        : this.upgradeReady ? "upgrade" : "battle",
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
      ultName: ultCard?.name,
      ultDesc: ultCard?.desc,
      ultEmoji: ultCard?.emoji,
      lastElementalHint: this.lastElementalHint && this.t - this.lastElementalHint.at < 1
        ? this.lastElementalHint : undefined,
      // v10：系统事件通知（剔除超时后输出，最多 3 条）
      recentSystemEvents: (() => {
        const fresh = this.recentSystemEvents.filter((e) => e.at + e.ttl >= this.t);
        this.recentSystemEvents = fresh;
        return fresh.length > 0 ? fresh : undefined;
      })(),

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

      // Phase 2.2：战间答题
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
      // ===== v9 全面升级新增 =====
      pendingRelicShop: this.pendingRelicShopOffers.length > 0 ? this.pendingRelicShopOffers : undefined,
      pendingInvestigation: this.pendingInvestigation ?? undefined,
      lastEnemyAIEvent: this.lastEnemyAIEvent ?? undefined,
      // v9：探员羁绊运行时状态
      bonds: this.bondStates.length > 0
        ? this.bondStates.map((bs) => {
            const bond = AGENT_BONDS.find((b) => b.id === bs.bondId);
            const nextLvl = bond?.levels.find((l) => l.level === bs.currentLevel + 1);
            return {
              id: bs.bondId,
              name: bond?.name ?? bs.bondId,
              color: bond?.color ?? "#FFD666",
              level: bs.currentLevel,
              kills: bs.kills,
              nextKills: nextLvl?.requiredKills ?? 0,
              bothDeployed: bs.bothDeployed,
            };
          })
        : undefined,

      // ===== v8 全面升级新增 =====
      // 受害人营救
      victims: this.victims.map((v) => ({
        id: v.id,
        emoji: v.emoji,
        demographic: v.demographic,
        progress: v.brainwashProgress,
        state: v.rescued ? "rescued" as const : v.lost ? "lost" as const : v.brainwashingBy !== null ? "brainwashing" as const : "idle" as const,
        x: v.x,
        y: v.y,
      })),
      victimsRescued: this.victimsRescued,
      victimsLost: this.victimsLost,
      // 话术气泡
      speechBubbles: this.speechBubbles.filter((b) => !b.broken).map((b) => ({
        id: b.id,
        enemyUid: b.enemyUid,
        text: b.text,
        x: b.x,
        y: b.y,
        remaining: Math.max(0, b.duration - (this.t - b.appearedAt)),
      })),
      // 反诈口诀槽（v8 简化：仅 BOSS 在场时输出，普通波次不显示）
      counterspellSlots: this.enemies.some((e) => e.bossRef)
        ? { slots: this.counterspellSlots, cooldowns: this.counterspellCooldowns }
        : undefined,
      // 战术指令
      selectedAgentIdx: this.selectedAgentIdx,
      tacticalCommandState: this.selectedAgentIdx !== null && this.selectedAgentIdx >= 0
        ? this.tacticalCommandStates[this.selectedAgentIdx] ?? null
        : null,
      // 卡牌大招手牌
      cardHand: {
        cards: this.cardHand,
        playable: this.cardHand.map((c) => this.energy >= c.cost),
        energy: Math.floor(this.energy),
      },
      // 案例五步复盘（仅胜利时输出）
      pendingCaseBreakdown: this.pendingCaseBreakdown ?? undefined,
      lastBreakdownCorrect: this.lastBreakdownCorrect ?? undefined,

      // ===== v11 升级新增 =====
      // 地形图层（null=该迷宫无地形）
      terrainLayer: this.maze.terrainLayer ?? null,
      // 重部署状态
      redeployState: this.redeployState,
      redeployCost: this.redeployCost,
      redeployReady: this.energy >= this.redeployCost && this.redeployState === null,
      // 弱点情报（C4 填充，默认空）
      activeWeaknessIntel: this.activeWeaknessIntel.length > 0
        ? this.activeWeaknessIntel.map((w) => ({ enemyTypeId: w.enemyTypeId, damageBonus: w.damageBonus, desc: w.desc }))
        : undefined,
      // 自定义难度（D4 填充）
      customDifficulty: this.customDifficultyCfg ?? undefined,
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

    // v8：话术气泡（敌人头顶）
    this.drawSpeechBubbles(ctx);

    // v8：受害人 NPC（emoji + 洗脑进度条）
    this.drawVictims(ctx);

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

    // 1b) v11：地形图层（叠加在路径格之上，半透明色块 + emoji 标识）
    if (this.maze.terrainLayer) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const tile of this.maze.terrainLayer.tiles) {
        const x = MAZE_OFFSET_X + tile.col * MAZE_CELL;
        const y = MAZE_OFFSET_Y + tile.row * MAZE_CELL;
        // 地形色块（脉动呼吸）
        const breathe = 0.5 + 0.5 * Math.sin(t * 2 + tile.col * 0.7 + tile.row * 0.5);
        ctx.globalAlpha = 0.55 + 0.25 * breathe;
        ctx.fillStyle = tile.color;
        ctx.fillRect(x, y, MAZE_CELL, MAZE_CELL);
        ctx.globalAlpha = 1;
        // 边框（地形类型色）
        ctx.strokeStyle = tile.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.5, y + 0.5, MAZE_CELL - 1, MAZE_CELL - 1);
        // emoji 标识
        if (tile.emoji) {
          ctx.font = `${Math.max(10, Math.floor(MAZE_CELL * 0.4))}px sans-serif`;
          ctx.globalAlpha = 0.85;
          ctx.fillText(tile.emoji, x + MAZE_CELL / 2, y + MAZE_CELL / 2);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }

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

  /** v8：话术气泡绘制 —— 敌人头顶气泡 + 剩余时间环 */
  private drawSpeechBubbles(ctx: CanvasRenderingContext2D): void {
    for (const b of this.speechBubbles) {
      if (b.broken) continue;
      const remaining = Math.max(0, b.duration - (this.t - b.appearedAt));
      const alpha = Math.min(1, remaining / BUBBLE_FADE_THRESHOLD);
      ctx.globalAlpha = alpha;
      // 气泡背景
      const bx = b.x - BUBBLE_W / 2;
      const by = b.y - BUBBLE_H;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.strokeStyle = "#E5353B";
      ctx.lineWidth = 1.5;
      roundRect(ctx, bx, by, BUBBLE_W, BUBBLE_H, BUBBLE_RADIUS);
      ctx.fill();
      ctx.stroke();
      // 小三角指向敌人
      ctx.beginPath();
      ctx.moveTo(b.x - 5, by + BUBBLE_H);
      ctx.lineTo(b.x + 5, by + BUBBLE_H);
      ctx.lineTo(b.x, by + BUBBLE_H + BUBBLE_ARROW_H);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      // 话术文本
      drawText(ctx, b.text, b.x, by + 16, { size: 10, color: "#333", weight: "600", align: "center" });
      // 剩余时间进度条
      const ratio = remaining / b.duration;
      ctx.fillStyle = "rgba(229,53,59,0.25)";
      ctx.fillRect(bx + 4, by + BUBBLE_H - 4, BUBBLE_W - 8, 3);
      ctx.fillStyle = ratio > BUBBLE_WARN_RATIO ? "#52C41A" : "#E5353B";
      ctx.fillRect(bx + 4, by + BUBBLE_H - 4, (BUBBLE_W - 8) * ratio, 3);
      ctx.globalAlpha = 1;
    }
  }

  /** v8：受害人 NPC 绘制 —— emoji + 洗脑进度环 */
  private drawVictims(ctx: CanvasRenderingContext2D): void {
    for (const v of this.victims) {
      const cfg = this.victimRescueConfig;
      // 受害人 emoji
      drawText(ctx, v.emoji, v.x, v.y, { size: VICTIM_EMOJI_SIZE, color: "#FFFFFF", align: "center" });
      // 状态标识
      if (v.rescued) {
        drawText(ctx, "✓", v.x + 12, v.y - 8, { size: 12, color: "#52C41A", weight: "900" });
        continue;
      }
      if (v.lost) {
        drawText(ctx, "✗", v.x + 12, v.y - 8, { size: 12, color: "#E5353B", weight: "900" });
        continue;
      }
      // 洗脑进度环（仅在被洗脑时显示）
      if (v.brainwashProgress > 0.01) {
        ctx.beginPath();
        ctx.arc(v.x, v.y, VICTIM_RING_R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.brainwashProgress);
        ctx.strokeStyle = v.brainwashProgress > 0.6 ? "#E5353B" : "#FFB020";
        ctx.lineWidth = VICTIM_RING_LW;
        ctx.stroke();
        // 背景环
        ctx.beginPath();
        ctx.arc(v.x, v.y, VICTIM_RING_R, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = VICTIM_RING_LW;
        ctx.stroke();
      }
      // 营救范围提示（仅当探员靠近时）
      if (cfg) {
        for (const a of this.agents) {
          if (!a.alive) continue;
          if (Math.hypot(a.x - v.x, a.y - v.y) < cfg.rescueRange) {
            ctx.beginPath();
            ctx.arc(v.x, v.y, cfg.rescueRange, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(82,196,26,0.3)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            break;
          }
        }
      }
    }
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
