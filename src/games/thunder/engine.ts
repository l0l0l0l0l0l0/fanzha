import { GameEngine } from "@/engine/GameEngine";
import { ParticleSystem } from "@/engine/Particle";
import { postFX } from "@/engine/PostFX";
import { playSfx, startBGM, stopBGM, type BgmName } from "@/engine/Audio";
import type { GameCanvas } from "@/platform/web";
import {
  clamp,
  clearCanvas,
  drawText,
  drawGrid,
} from "@/engine/Renderer";
import { Theme } from "@/ui/Theme";
import type { GameEvent, GameResultPayload } from "@/types";
import { randomTip } from "@/data/tips";
import {
  ENEMIES,
  WAVES,
  POWERUPS,
  BOSS,
  ULTIMATE_BOSS,
  pickRandomBoss,
  titleFor,
  WEAPON_XP_TABLE,
  weaponXpForKill,
  ACHIEVEMENTS,
  WEAPON_BRANCHES,
  DIFFICULTIES,
  THUNDER_THEMES,
  themeForWave,
  ROGUELIKE_BUFFS,
  ROGUELIKE_POOL_BY_RARITY,
  ROGUELIKE_RARITY_WEIGHTS,
  ULTIMATE_MAX_CHARGE,
  ULTIMATE_DURATION,
  ULTIMATE_DPS,
  ULTIMATE_CHARGE_PER_DAMAGE,
  CHARGE_FULL_TIME,
  CHARGE_MIN_TIME,
  CHARGE_DMG_MULTIPLIER,
  CHARGE_RADIUS,
  DASH_DISTANCE,
  DASH_DURATION,
  DASH_CD,
  DASH_INVINCIBLE,
  THUNDER_SAVE_KEY,
  defaultThunderSave,
  dailySeedFor,
  mulberry32,
  generateEndlessWave,
  ANTIFRAUD_MANTRAS,
  DEATH_CAUSE_BY_ENEMY,
  // v3 升级导入
  CHARACTERS,
  CHARACTER_MAP,
  isCharacterUnlocked,
  EQUIPMENT_MAP,
  rollEquipmentDrop,
  getAwakening,
  // v4 升级导入
  computeTalentEffect,
  computeSetBonus,
  getUnlockedTalents,
  BOSS_RUSH_CONFIG,
  generateBossRushSequence,
  getBossDefById,
  RANDOM_BOSSES,
  insertLeaderboardEntry,
  dailyKey,
  weeklyKey,
  // v5 升级导入
  GRAZE_CONFIG,
  COUNTER_ADVANTAGE_MUL,
  COUNTER_DISADVANTAGE_MUL,
  getCounterRelation,
  DRONES,
  rankTierForPoints,
  computeRankDelta,
  applyRankResult,
  RANK_TIER_MAP,
  weeklyModifierFor,
  SURVIVAL_TARGETS,
  THUNDER_SKIN_MAP,
  CASE_THEATER_MAP,
  DAILY_QUESTS,
  getTodayQuestProgress,
  updateQuestProgress,
  DEATH_CAUSE_V5,
  generateSurvivalWave,
  // v6 升级导入
  THUNDER_BOSS_AI_DIALOGS,
  THUNDER_MANTRA_CHAINS,
  THUNDER_FRAUD_ARCHIVES,
  THUNDER_SEASON_PASS,
  THUNDER_SUPER_AWAKENINGS,
  V6_PARRY_CONFIG,
  V6_COMBINED_PATTERN_CONFIG,
  FULL_MANTRA_TEXT,
  getBossAIDialogByBossId,
  getBossAIDialogById,
  getFraudArchiveByBossId,
  calcSeasonPassProgress,
  getSuperAwakening,
  // v7 升级导入
  V7_STORY_RANK_MULTIPLIER,
  V7_STORY_REWARD_TALENT_POINTS,
  V7_RPG_REWARD_TALENT_POINTS_PER_BUST,
  V7_LESSON_REWARD_TALENT_POINTS_BONUS,
  V7_ADAPTIVE_INITIAL_SKILL,
  V7_PROCEDURAL_DAILY_SEED_BASE,
} from "./data";
// v7 子系统模块
import {
  THUNDER_ADAPTIVE_CONFIG,
  initAdaptiveState,
  updateSkillScore,
  calcTrend,
  applyAdaptiveToDifficulty,
} from "./adaptiveAI";
import {
  THUNDER_PROCEDURAL_CONFIG,
  pickPatternForBossHp,
} from "./procedural";
import {
  THUNDER_CERTIFICATES,
  getAllCertificateProgress,
  getNewlyUnlockedCertificates,
  calcCertificateProgressValue,
} from "./certificate";
import {
  THUNDER_STORY_CAMPAIGN,
  THUNDER_STORY_NARRATIVE_LINES,
  getStoryStageById,
  calcStageRank,
  getNextStageId,
  getStoryProgress,
} from "./story";
import {
  getRPGScenarioById,
  calcRPGEnding,
  pickRandomRPGScenario,
} from "./rpgScenarios";
import { buildAnalyticsDashboard } from "./analytics";
import { calcOverallMastery } from "./knowledgeGraph";
import { getAllLessonChapters, getLessonChapterById } from "./lessons";
import type { AchievementStats, ThunderFinalStats } from "./data";
import { MAX_HP, HP_PER_YUANBAO } from "./types";
import type {
  WeaponLevel,
  PowerupKind,
  ThunderHud,
  BossDef,
  BossAttackPattern,
  BranchOption,
  WeaponBranch,
  WeaponBranchLevel,
  Difficulty,
  DifficultyConfig,
  ThunderMode,
  ThunderThemeDef,
  RoguelikeBuffKind,
  RoguelikeOption,
  ActiveRoguelikeBuff,
  BossEntranceStage,
  ThunderEngineOptions,
  ThunderSaveData,
  WaveEntry,
  CharacterDef,
  CharacterId,
  EquipmentDef,
  EquipEffect,
  WeaponAwakeningDef,
  // v4 升级类型
  ThunderTalentNodeDef,
  EquipSetBonus,
  BossRushStageResult,
  BossRushResult,
  ThunderLeaderboardEntry,
  GhostRecord,
  // v5 升级类型
  DroneKind,
  DroneState,
  DroneDef,
  SurvivalTargetState,
  BossPhaseDef,
  CounterRelation,
  ThunderSkinDef,
  // v6 升级类型
  ThunderBossAIDialog,
  ThunderBossAIDialogNode,
  ThunderBossAIDialogChoice,
  ThunderHudBossAIDialogState,
  ThunderMantraChainDef,
  ThunderHudMantraChainState,
  ThunderFraudArchive,
  ThunderHudSeasonPassState,
  ThunderParryState,
  ThunderSuperAwakeningDef,
  ThunderSuperAwakeningState,
  ThunderSeasonPassReward,
  // v7 升级类型
  ThunderStoryStageDef,
  ThunderStoryStageKind,
  ThunderStoryEndingDef,
  ThunderHudStoryState,
  ThunderLessonChapterDef,
  ThunderLessonSectionDef,
  ThunderLessonSectionKind,
  ThunderLessonQuizQuestion,
  ThunderHudLessonState,
  ThunderRPGScenarioDef,
  ThunderRPGNodeDef,
  ThunderRPGNodeKind,
  ThunderRPGChoiceDef,
  ThunderRPGEndingDef,
  ThunderHudRPGState,
  ThunderProceduralPatternParams,
  ThunderProceduralConfig,
  ThunderAdaptiveState,
  ThunderAdaptiveConfig,
  ThunderCertificateDef,
  ThunderCertificateProgress,
  ThunderAbilityRadar,
  ThunderWeaknessReport,
  ThunderAnalyticsDashboard,
} from "./types";
import { InputManager } from "@/engine/Input";

const W = 540;
const H = 960;
const ACCENT = "#00E5FF";

const SHIP_Y = 820;
const SHIP_R = 22;

// 伤害以「铜元宝」为单位（HP_PER_YUANBAO = 4）
const DMG_BULLET = HP_PER_YUANBAO;       // 4
const DMG_BODY = HP_PER_YUANBAO * 2;     // 8
const DMG_BOSS_BODY = HP_PER_YUANBAO * 3;// 12

interface Player {
  x: number;
  y: number;
  tx: number;
  ty: number;
  weapon: WeaponLevel;
  hp: number;
  appCharges: number;     // 国家反诈APP 护盾剩余吸收次数
  raids: number;          // 公安反诈突击次数
  fireCd: number;
  invincibleUntil: number;
  overseasUntil: number;  // 不接境外来电：免疫弹幕
  awarenessUntil: number; // 反诈意识觉醒：顶档火力 + 双倍伤害
  hotlineUntil: number;   // 96110热线：净化弹幕
  bankFreezeUntil: number;// 银行止付：减伤
  adUntil: number;        // 反诈宣传员：连击不掉+自动拾取
  slowMoUntil: number;    // 时间减速：剩余秒数
  weaponXp: number;       // 武器经验
  weaponBranch: WeaponBranch;       // 武器分支（新增）
  weaponBranchLevel: WeaponBranchLevel; // 武器分支等级（新增）
  /** 武器分支经验（v3 觉醒用） */
  branchXp: number;
  // ===== v2 升级：操作扩展 + 大招 =====
  /** 大招充能值 0..ULTIMATE_MAX_CHARGE */
  ultCharge: number;
  /** 大招激活剩余秒数（>0 时正在释放雷霆审判） */
  ultActiveUntil: number;
  /** 是否正在蓄力（A4） */
  charging: boolean;
  /** 蓄力开始时间（this.t 时刻） */
  chargeStartedAt: number;
  /** 蓄力进度 0..1 */
  chargeProgress: number;
  /** 闪避冲刺剩余冷却秒数 */
  dashCd: number;
  /** 闪避冲刺剩余无敌秒数 */
  dashInvincibleUntil: number;
  /** 闪避冲刺方向 x */
  dashDirX: number;
  /** 闪避冲刺方向 y */
  dashDirY: number;
  /** 闪避冲刺剩余持续秒数（>0 时正在冲刺位移） */
  dashActiveUntil: number;
  /** 上次按下方向键的时间（用于检测双击触发闪避） */
  lastKeyTime: number;
  /** 上次按下的方向键 */
  lastKeyDir: "up" | "down" | "left" | "right" | null;
  /** 护盾再生计时器（Roguelike shieldRegen） */
  shieldRegenTimer: number;
  // ===== v6 升级：格挡反击（P1） =====
  /** 格挡剩余冷却秒数（0=可用） */
  parryCd: number;
  /** 完美格挡窗口剩余秒数（>0 时格挡触发反弹） */
  parryPerfectWindow: number;
  /** 格挡护盾持续秒数（>0 时正在格挡） */
  parryShieldUntil: number;
}

interface Enemy {
  uid: number;
  def: (typeof ENEMIES)[string];
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  shootCd: number;
  phase: number;
  born: number;
  hitFlash: number; // 受击高光剩余秒
  shield: number;       // 当前护盾值（0 表示无盾）
  maxShield: number;    // 最大护盾值（用于绘制）
  shieldFlash: number;  // 护盾受击高光剩余秒
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  size: number;
  from: "player" | "enemy";
  life: number;
  pierce?: boolean;   // 穿透（激光武器，新增）
  hitCd?: number;     // 穿透命中冷却（避免连续命中同一目标，新增）
  homing?: boolean;   // 追踪（追踪导弹，新增）
  /** v3：命中爆炸（觉醒效果） */
  explode?: boolean;
  /** v3：爆炸半径 */
  explodeRadius?: number;
}

interface Powerup {
  x: number;
  y: number;
  vy: number;
  kind: PowerupKind;
  born: number;
}

interface Boss {
  def: BossDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phase: number;
  fireCd: number;
  moveDir: number;
  spawnCd: number;
  enterUntil: number;
  hitFlash: number;
  /** 当前攻击模式索引 */
  patternIdx: number;
  /** 螺旋弹幕角度累积 */
  spiralAngle: number;
  /** 是否已被击败 */
  defeated?: boolean;
  enraged: boolean;        // 是否已进入狂暴
  laserSweepAngle: number; // 激光扫射当前角度
  laserSweepUntil: number; // 激光扫射结束时间
  laserSweepActive: boolean;
  // ===== v2 升级：登场 CG（C1） =====
  /** 登场 CG 阶段 */
  entranceStage: BossEntranceStage;
  /** 登场 CG 阶段切换时间 */
  entranceStageUntil: number;
  /** 登场 CG 起始时间 */
  entranceStartedAt: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  vx: number;    // 速度
  vy: number;
  gravity: number;
}

/** 冲击波（酷炫爆炸用） */
interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export class ThunderEngine extends GameEngine {
  private particles = new ParticleSystem();
  private input: InputManager;
  /** 方向键按下状态（上下左右） */
  private keys = { up: false, down: false, left: false, right: false };
  private keyDownCb: (e: KeyboardEvent) => void;
  private keyUpCb: (e: KeyboardEvent) => void;
  private player: Player = {
    x: W / 2,
    y: SHIP_Y,
    tx: W / 2,
    ty: SHIP_Y,
    weapon: 1,
    hp: MAX_HP,
    appCharges: 0,
    raids: 1,
    fireCd: 0,
    invincibleUntil: 0,
    overseasUntil: 0,
    awarenessUntil: 0,
    hotlineUntil: 0,
    bankFreezeUntil: 0,
    adUntil: 0,
    slowMoUntil: 0,
    weaponXp: 0,
    weaponBranch: "normal",
    weaponBranchLevel: 0,
    branchXp: 0,
    // v2 升级
    ultCharge: 0,
    ultActiveUntil: 0,
    charging: false,
    chargeStartedAt: 0,
    chargeProgress: 0,
    dashCd: 0,
    dashInvincibleUntil: 0,
    dashDirX: 0,
    dashDirY: 0,
    dashActiveUntil: 0,
    lastKeyTime: 0,
    lastKeyDir: null,
    shieldRegenTimer: 0,
    parryCd: 0,
    parryPerfectWindow: 0,
    parryShieldUntil: 0,
  };
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private powerups: Powerup[] = [];
  private floats: FloatingText[] = [];
  private shocks: Shockwave[] = [];
  private boss: Boss | null = null;
  private wave = 0;
  private spawnQueue: { typeId: string; at: number; spawned: boolean }[] = [];
  private waveActive = false;
  private prepUntil = 0;
  private t = 0;
  private score = 0;
  private lastWeaponDropScore = 0; // 上次武器道具掉落时的分数（新增）
  private combo = 0;
  private maxCombo = 0;
  private comboUntil = 0;
  private over = false;
  private phase: "battle" | "boss" | "branch" | "roguelike" | "won" | "lost" | "entrance" | "defeat" = "battle";
  /** 分支选择：当前要进入的下一波 idx */
  private branchNextWave = 0;
  /** 分支选择：当前是第几次分支（1 / 2，用于显示） */
  private branchRound = 0;
  /** 分支选项缓存（每次进入 branch 阶段生成） */
  private branchOptions: BranchOption[] = [];
  private result: GameResultPayload | null = null;
  private uidSeq = 1;
  private shakeUntil = 0;
  private raidFlashUntil = 0;
  private startedAt = 0;
  private bustedCount = 0;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private bossEnterAt = 0;
  private freezeUntil = 0; // 证据固定：全场冻结
  private hitstopUntil = 0; // 击打感：命中时短暂卡帧
  private bossesDefeated = 0; // 已击败 BOSS 数（用于终极 BOSS 判定）
  private phaseTransitionUntil = 0;
  private phaseTransitionText = "";
  private unlockedAchievements = new Set<string>();
  private achievementToast: { name: string; desc: string; emoji: string; until: number } | null = null;
  // ===== v2 升级状态字段 =====
  private opts: ThunderEngineOptions;
  private difficultyCfg: DifficultyConfig;
  private endless = false;
  private endlessScale = 1;
  private currentTheme: ThunderThemeDef;
  private roguelikeBuffs: ActiveRoguelikeBuff[] = [];
  private roguelikeOptions: RoguelikeOption[] = [];
  private roguelikeNextWave = 0;
  private save: ThunderSaveData;
  private killStats: Record<string, number> = {};
  private bossKillTimes: { name: string; atSec: number; fraudType: string; emoji: string }[] = [];
  private comboHistory: { t: number; combo: number }[] = [];
  private deathCause: { fraudType: string; emoji: string; name: string; identifyDetail?: string[]; protectList?: string[]; caseStory?: string } | null = null;
  private bossDefeatSlowmoUntil = 0;
  private bossDefeatIdentify: { name: string; identifyDetail?: string[]; protectList?: string[]; caseStory?: string; emoji: string; fraudType: string } | null = null;
  private mantraTexts: { text: string; until: number }[] = [];
  private lastMantraCombo = 0;
  private rng: () => number;
  private releasedCodexIds = new Set<string>();
  /** v2 升级：追踪最后造成伤害的敌人/BOSS（用于死亡复盘 B2） */
  private lastDamageTypeId: string | null = null;
  private lastDamageBoss: BossDef | null = null;
  // ===== v3 升级：角色 / 装备 / 觉醒 =====
  /** 当前角色定义 */
  private character: CharacterDef;
  /** 角色针对的诈骗类型（缓存，用于伤害加成） */
  private charFraudTypes: string[] = [];
  /** 角色对特定诈骗类型的伤害加成比例 */
  private charFraudBonus = 0;
  /** 已装备的配件定义列表 */
  private equippedEquipments: EquipmentDef[] = [];
  /** 聚合装备效果（缓存） */
  private equipAgg: EquipEffect = {};
  /** 本局已掉落的装备（引擎→场景事件队列） */
  private pendingEquipDrops: { equipmentId: string; fromBoss: string }[] = [];
  /** 本局觉醒触发标记（用于一次性 toast） */
  private awakeningToast: { name: string; mantra: string; emoji: string; until?: number } | null = null;
  /** v3：装备回血累积器（小数累积为整数回血） */
  private _regenAcc = 0;

  // ===== v4 升级状态字段：天赋树 / 套装 / BossRush / 影子 =====
  /** 当前角色已激活的天赋节点列表（缓存） */
  private talentNodes: ThunderTalentNodeDef[] = [];
  /** 聚合天赋效果（缓存） */
  private talentAgg: EquipEffect = {};
  /** 当前装备套装效果（无套装为 null） */
  private setBonus: EquipSetBonus | null = null;
  /** BossRush 模式：本局 BOSS 序列 */
  private bossRushBossIds: string[] = [];
  /** BossRush 模式：当前阶段索引（0-based） */
  private bossRushStageIdx = 0;
  /** BossRush 模式：各战结果 */
  private bossRushStageResults: BossRushStageResult[] = [];
  /** BossRush 模式：阶段开始时间（用于计时） */
  private bossRushStageStartedAt = 0;
  /** BossRush 模式：累计得分 */
  private bossRushTotalScore = 0;
  /** BossRush 模式：累计用时 */
  private bossRushTotalTimeSec = 0;
  /** BossRush 模式：下一阶段开始时间（休息结束后切换，0=无待启动） */
  private bossRushNextStageAt = 0;
  /** BossRush 模式：下一阶段索引（待启动时使用） */
  private bossRushNextStageIdx = -1;
  /** 影子挑战：当前分数 vs 影子分数 */
  private ghostProgress: { ghostScore: number; currentScore: number; ahead: boolean; ghostCharacter: string } | null = null;
  /** 影子挑战：本局操作记录（采样） */
  private ghostInputs: { t: number; x: number; y: number; bomb: boolean; ult: boolean }[] = [];
  /** 影子挑战：上次采样时间 */
  private lastGhostSampleT = 0;

  // ===== v4 升级：动态 BGM 状态 =====
  /** 当前播放的 BGM（用于去重切换） */
  private currentBgm: BgmName = "battle";
  /** 大招释放前的 BGM（释放后恢复） */
  private bgmBeforeUlt: BgmName = "battle";
  /** 大招就绪提示是否已播（避免反复触发） */
  private ultReadyAnnounced = false;
  /** 大招激活结束时刻（用于检测大招结束并恢复 BGM） */
  private ultActiveUntilPrev = 0;

  // ===== v5 升级状态字段：擦弹 / 无人机 / BOSS阶段 / 新模式 / 皮肤 / 案例 =====
  /** 擦弹充能 0..1 */
  private grazeCharge = 0;
  /** 本局累计擦弹数 */
  private grazeCount = 0;
  /** 擦弹奖励激活结束时刻 */
  private grazeBoostUntil = 0;
  /** 已擦弹的子弹集合（避免同一子弹重复计擦弹） */
  private grazedBullets = new WeakSet<Bullet>();
  /** 无人机列表 */
  private drones: DroneState[] = [];
  /** 无人机 uid 序列 */
  private droneUidSeq = 1;
  /** BOSS 当前阶段序号（1-based） */
  private bossPhaseNum = 1;
  /** BOSS 已触发过的阶段集合（避免重复触发） */
  private bossPhasesTriggered = new Set<number>();
  /** BOSS 变身闪光结束时刻 */
  private bossTransformFlashUntil = 0;
  /** BOSS 变身警示语（一次性） */
  private bossTransformWarning: string | null = null;
  /** 生存模式保护目标 */
  private survivalTarget: SurvivalTargetState | null = null;
  /** 周常修饰符 */
  private weeklyModifier = weeklyModifierFor();
  /** 当前皮肤定义 */
  private skin: ThunderSkinDef = THUNDER_SKIN_MAP["default"];
  /** 案例剧场触发标记（BOSS 击败后一次性） */
  private caseTheaterTrigger: { bossName: string; caseStory: string; identifyDetail?: string[]; protectList?: string[]; emoji: string; fraudType: string } | null = null;
  /** 段位赛结算结果（结算时填充） */
  private rankResult: { delta: number; newPoints: number; newTier: import("./types").ThunderRankTier; tierUp: boolean; tierDown: boolean } | null = null;
  /** 极限挑战：禁用道具掉落 */
  private noPowerups = false;

  // ===== v6 升级状态字段：BOSS AI 对话 / 口诀连招 / 溯源档案 / 通行证 / 格挡 / 超觉醒 =====
  /** S1：当前 BOSS AI 对话剧本（null=未激活） */
  private bossAIDialog: ThunderBossAIDialog | null = null;
  /** S1：当前对话节点（null=对话未开始或已结束） */
  private bossAIDialogNode: ThunderBossAIDialogNode | null = null;
  /** S1：对话 HUD 状态（场景层读取，null=不显示对话 UI） */
  private bossAIDialogState: ThunderHudBossAIDialogState | null = null;
  /** S1：本局 AI 对话识破次数 */
  private aiDialogBustedCount = 0;
  /** S1：是否启用 BOSS AI 对话 */
  private enableBossAIDialog = true;
  /** S1：对话结束后自动关闭时刻（>0 时倒计时关闭对话 UI） */
  private bossAIDialogCloseAt = 0;
  /** S2：已解锁的口诀列表（按触发顺序） */
  private unlockedMantras: ThunderMantraChainDef[] = [];
  /** S2：当前激活的口诀（null=无激活） */
  private activeMantra: ThunderMantraChainDef | null = null;
  /** S2：口诀激活结束时刻 */
  private activeMantraUntil = 0;
  /** S2：本局口诀连招触发次数 */
  private mantraTriggeredCount = 0;
  /** S2：是否启用口诀连招 */
  private enableMantraChain = true;
  /** S3：本局已解锁的档案触发列表（场景层一次性消费） */
  private fraudArchiveTrigger: ThunderFraudArchive | null = null;
  /** S3：本局已解锁的档案列表（用于结算页展示） */
  private unlockedArchivesThisRun: ThunderFraudArchive[] = [];
  /** S3：是否启用诈骗溯源档案 */
  private enableFraudArchive = true;
  /** S4：本局获得赛季通行证经验 */
  private seasonPassGainedExp = 0;
  /** S4：本局通行证升级解锁的奖励列表（场景层消费） */
  private seasonPassUnlockedRewards: ThunderSeasonPassReward[] = [];
  /** S4：是否启用赛季通行证 */
  private enableSeasonPass = true;
  /** P1：本局格挡成功次数 */
  private parryCount = 0;
  /** P1：是否启用格挡反击 */
  private enableParry = true;
  /** P1：是否触发了完美格挡（一次性，场景层消费） */
  private parryPerfectTriggered = false;
  /** P2：BOSS 当前激活的组合弹幕模式列表 */
  private bossActiveCombinedPatterns: BossAttackPattern[] = [];
  /** P2：是否启用组合弹幕 */
  private enableCombinedPatterns = true;
  /** P4：当前超觉醒定义（null=未超觉醒） */
  private superAwakening: ThunderSuperAwakeningDef | null = null;
  /** P4：超觉醒大招充能 0..1 */
  private superAwakeningUltCharge = 0;
  /** P4：是否启用超觉醒 */
  private enableSuperAwakening = true;
  /** P4：超觉醒大招是否就绪（一次性 toast） */
  private superAwakeningUltReadyAnnounced = false;
  // ===== v7 升级状态字段 =====
  /** v7 自适应 AI：是否启用动态难度 */
  private enableAdaptiveAI = true;
  /** v7 自适应 AI：当前动态难度状态 */
  private adaptiveState!: ThunderAdaptiveState;
  /** v7 程序化弹幕：是否启用 */
  private enableProceduralPatterns = true;
  /** v7 程序化弹幕：当前配置 */
  private proceduralConfig!: ThunderProceduralConfig;
  /** v7 程序化弹幕：本局使用的种子 */
  private proceduralSeedUsed = 0;
  /** v7 程序化弹幕：当前 BOSS 使用的程序化模式（null=使用预设） */
  private currentProceduralPattern: ThunderProceduralPatternParams | null = null;
  /** v7 证书：本局开始时的进度快照（certId → 进度值，用于结束时对比新解锁） */
  private certificateProgressSnapshot: Record<string, number> = {};
  /** v7 证书：本局新解锁的证书列表 */
  private unlockedCertificatesThisRun: ThunderCertificateDef[] = [];
  /** v7 剧情模式：当前关卡定义（mode="story" 时有效） */
  private currentStoryStage: ThunderStoryStageDef | null = null;
  /** v7 剧情模式：当前对白索引（narrative 关卡用） */
  private storyNarrativeLineIdx = 0;
  /** v7 剧情模式：本关评价 */
  private storyRank: "S" | "A" | "B" | "C" | null = null;
  /** v7 RPG 模式：当前剧本（mode="rpg" 时有效） */
  private currentRPGScenario: ThunderRPGScenarioDef | null = null;
  /** v7 RPG 模式：当前节点 */
  private currentRPGNode: ThunderRPGNodeDef | null = null;
  /** v7 RPG 模式：累计识破红旗数 */
  private rpgBustScore = 0;
  /** v7 RPG 模式：对话历史 */
  private rpgHistory: ThunderHudRPGState["history"] = [];
  /** v7 RPG 模式：是否已结束 */
  private rpgEnded = false;
  /** v7 RPG 模式：当前结局 */
  private currentRPGEnding: ThunderRPGEndingDef | null = null;
  /** v7 课程模式：当前章节（mode="lesson" 时有效） */
  private currentLessonChapter: ThunderLessonChapterDef | null = null;
  /** v7 课程模式：当前小节索引 */
  private lessonSectionIdx = 0;
  /** v7 课程模式：测验当前题索引 */
  private lessonQuizIdx = 0;
  /** v7 课程模式：测验答对数 */
  private lessonQuizCorrect = 0;
  /** v7 一次性 toast（证书解锁/RPG 结局等） */
  private v7Toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  /** v7 自适应 AI：本局技能评分变化（结算时填充） */
  private adaptiveSkillDelta = 0;

  constructor(canvas: GameCanvas, options?: ThunderEngineOptions) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    this.opts = options ?? { difficulty: "normal", mode: "campaign" };
    this.difficultyCfg = DIFFICULTIES[this.opts.difficulty];
    this.currentTheme = themeForWave(0);
    this.save = ThunderEngine.loadSave();
    this.rng = this.opts.mode === "daily" ? mulberry32(this.opts.dailySeed ?? dailySeedFor(new Date())) : Math.random;
    // 应用难度到玩家初始 HP
    this.player.hp = Math.round(MAX_HP * this.difficultyCfg.playerHpMul);
    // v3 升级：初始化角色与装备
    this.initCharacterAndEquipment();
    // v4 升级：初始化天赋树效果 + 套装效果 + BossRush + 影子
    this.initV4Upgrades();
    // v5 升级：初始化新模式（周常/生存/极限/段位赛）+ 皮肤
    this.initV5Upgrades();
    // v6 升级：初始化新系统（BOSS AI 对话/口诀连招/溯源档案/通行证/格挡/超觉醒）
    this.initV6Upgrades();
    // v7 升级：初始化新系统（剧情/课程/RPG/自适应AI/程序化弹幕/证书/数据仪表板）
    this.initV7Upgrades();
    this.startedAt = performance.now();
    this.input = new InputManager(canvas);
    this.input.attach(this);
    this.input.setHandlers({
      onDrag: (_x, _y, _dx, _dy, id) => {
        const p = this.input.getPos(id);
        if (!p) return;
        if (this.isPaused) return;
        this.player.tx = clamp(p.x, SHIP_R, W - SHIP_R);
        this.player.ty = clamp(p.y, H * 0.5, H - SHIP_R);
      },
    });
    // 方向键监听：上下左右控制战机 + 双击触发闪避（A4）
    this.keyDownCb = (e: KeyboardEvent) => {
      if (this.over || this.isPaused) return;
      let dir: "up" | "down" | "left" | "right" | null = null;
      switch (e.key) {
        case "ArrowUp": dir = "up"; break;
        case "ArrowDown": dir = "down"; break;
        case "ArrowLeft": dir = "left"; break;
        case "ArrowRight": dir = "right"; break;
        case " ": case "Spacebar":
          // 空格：蓄力射击（A4）
          e.preventDefault();
          if (!this.player.charging && this.player.dashCd <= 0) {
            this.player.charging = true;
            this.player.chargeStartedAt = this.t;
            this.player.chargeProgress = 0;
          }
          return;
      }
      if (dir) {
        e.preventDefault();
        if (dir === "up") this.keys.up = true;
        else if (dir === "down") this.keys.down = true;
        else if (dir === "left") this.keys.left = true;
        else if (dir === "right") this.keys.right = true;
        // 双击检测：300ms 内同方向再按 → 触发闪避冲刺（A4）
        const now = this.t;
        if (this.player.lastKeyDir === dir && now - this.player.lastKeyTime < 0.3 && this.player.dashCd <= 0) {
          this.tryDash(dir);
        }
        this.player.lastKeyTime = now;
        this.player.lastKeyDir = dir;
      }
    };
    this.keyUpCb = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp": this.keys.up = false; break;
        case "ArrowDown": this.keys.down = false; break;
        case "ArrowLeft": this.keys.left = false; break;
        case "ArrowRight": this.keys.right = false; break;
        case " ": case "Spacebar":
          // 释放蓄力射击（A4）
          if (this.player.charging) this.releaseCharge();
          break;
      }
    };
    window.addEventListener("keydown", this.keyDownCb);
    window.addEventListener("keyup", this.keyUpCb);
    // v4：BossRush 模式跳过普通波次，直接开启第一阶段 BOSS 战
    if (this.opts.mode === "bossRush") {
      this.startBossRushStage(0, 1.0);
    } else {
      this.startWave(0, 1.5);
    }
    startBGM("battle"); // 开局播放战斗 BGM
    this.currentBgm = "battle";
    this.addDestroy(() => {
      this.input.destroy();
      stopBGM();
      window.removeEventListener("keydown", this.keyDownCb);
      window.removeEventListener("keyup", this.keyUpCb);
    });
  }

  /** v4 升级：动态 BGM 切换（去重，避免重复启动同一首） */
  private switchBgm(name: BgmName): void {
    if (this.currentBgm === name) return;
    this.currentBgm = name;
    startBGM(name);
  }

  // ===== v2 升级：本地存档读写（D1） =====
  private static loadSave(): ThunderSaveData {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(THUNDER_SAVE_KEY) : null;
      if (raw) return { ...defaultThunderSave(), ...JSON.parse(raw) } as ThunderSaveData;
    } catch { /* ignore */ }
    return defaultThunderSave();
  }

  private persistSave(): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(THUNDER_SAVE_KEY, JSON.stringify(this.save));
      }
    } catch { /* ignore */ }
  }

  // ===== v3 升级：角色 / 装备 / 觉醒 =====

  /** 初始化角色被动 + 装备效果（构造时调用） */
  private initCharacterAndEquipment(): void {
    const charId: CharacterId = (this.opts.characterId as CharacterId) ?? "swat";
    // 兜底：未解锁或无效时回退到 swat
    this.character = (CHARACTER_MAP[charId] && isCharacterUnlocked(charId, this.save))
      ? CHARACTER_MAP[charId]
      : CHARACTER_MAP.swat;
    // 缓存角色诈骗类型加成
    for (const p of this.character.passives) {
      if (p.kind === "dmgToFraudTypes" && p.fraudTypes && p.value) {
        this.charFraudTypes = p.fraudTypes.slice();
        this.charFraudBonus = p.value;
      }
    }
    // 加载装备定义
    const eqIds = this.opts.equipmentIds ?? {};
    const slots: ("weaponChip" | "shieldCore" | "moveModule")[] = ["weaponChip", "shieldCore", "moveModule"];
    this.equippedEquipments = [];
    for (const slot of slots) {
      const id = eqIds[slot];
      if (id && EQUIPMENT_MAP[id]) {
        this.equippedEquipments.push(EQUIPMENT_MAP[id]);
      }
    }
    // 聚合装备效果
    this.equipAgg = this.aggregateEquipEffects();
    // 应用角色被动到玩家初始状态
    const p = this.player;
    for (const passive of this.character.passives) {
      switch (passive.kind) {
        case "shieldStart":
          p.appCharges = Math.max(p.appCharges, passive.value ?? 0);
          break;
        case "ultChargeStart":
          p.ultCharge = Math.max(p.ultCharge, passive.value ?? 0);
          break;
        case "branchStart":
          if (passive.branch) {
            p.weaponBranch = passive.branch;
            p.weaponBranchLevel = passive.branchLevel ?? 1;
          }
          break;
        // scoreBoost / dropBoost / hpRegenWave / dmgToFraudTypes 在运行时动态读取
      }
    }
    // 应用装备效果到玩家初始状态
    if (this.equipAgg.shieldCharges) {
      p.appCharges = Math.max(p.appCharges, this.equipAgg.shieldCharges);
    }
  }

  /**
   * v4 升级：初始化天赋树 / 套装效果 / BossRush 模式 / 影子挑战
   * 在 initCharacterAndEquipment 之后调用
   */
  private initV4Upgrades(): void {
    const charId = this.character.id;
    // 1. 天赋树效果
    if (this.opts.enableTalents !== false) {
      this.talentNodes = getUnlockedTalents(charId, this.save);
      this.talentAgg = computeTalentEffect(charId, this.save);
    }
    // 2. 装备套装效果
    this.setBonus = computeSetBonus(this.opts.equipmentIds ?? {});
    // 3. BossRush 模式初始化
    if (this.opts.mode === "bossRush") {
      this.bossRushBossIds = this.opts.bossRushBossIds ?? generateBossRushSequence(this.rng);
      this.bossRushStageIdx = 0;
      this.bossRushStageResults = [];
      this.bossRushStageStartedAt = this.t;
      this.bossRushTotalScore = 0;
      this.bossRushTotalTimeSec = 0;
    }
    // 4. 影子挑战初始化
    if (this.opts.ghostRecord) {
      const ghost = this.opts.ghostRecord;
      this.ghostProgress = {
        ghostScore: ghost.score,
        currentScore: 0,
        ahead: false,
        ghostCharacter: ghost.characterName,
      };
    }
    // 5. 应用天赋 + 套装效果到玩家初始状态
    const p = this.player;
    // 天赋护盾
    if (this.talentAgg.shieldCharges) {
      p.appCharges = Math.max(p.appCharges, this.talentAgg.shieldCharges);
    }
    // 套装护盾
    if (this.setBonus?.effect.shieldCharges) {
      p.appCharges = Math.max(p.appCharges, this.setBonus.effect.shieldCharges);
    }
    // 天赋大招充能
    if (this.talentAgg.ultChargeMul && this.talentAgg.ultChargeMul > 1) {
      // 不直接加充能，而是通过 ultChargeMul 在运行时加速
    }
  }

  /** v5 升级：初始化新模式 + 皮肤 */
  private initV5Upgrades(): void {
    // 1. 皮肤加载（纯视觉，不改数值）
    const skinId = this.opts.skinId ?? this.save.equippedSkin ?? "default";
    if (THUNDER_SKIN_MAP[skinId]) {
      this.skin = THUNDER_SKIN_MAP[skinId];
    }
    // 2. 生存模式：初始化保护目标
    if (this.opts.mode === "survival") {
      const targetDef = SURVIVAL_TARGETS[0];
      const hpOverride = this.opts.survivalTargetHp ?? targetDef.maxHp;
      this.survivalTarget = {
        def: targetDef,
        hp: hpOverride,
        maxHp: hpOverride,
        x: targetDef.xRatio * W,
        y: targetDef.yRatio * H,
        hitFlash: 0,
      };
    }
    // 3. 极限挑战：禁用道具掉落
    if (this.opts.mode === "challenge" && this.opts.challengeNoPowerups !== false) {
      this.noPowerups = true;
    }
    // 4. 段位赛：标记当前段位（结算时计算 delta）
    if (this.opts.mode === "ranked") {
      this.rankResult = null;
    }
    // 5. 周常修饰符已在字段初始化时通过 weeklyModifierFor() 获取
    //    周常 lowHp：玩家初始 HP 减半
    if (this.weeklyModifier.kind === "lowHp" && this.weeklyModifier.value) {
      this.player.hp = Math.max(1, Math.round(this.player.hp * this.weeklyModifier.value));
    }
  }

  // =========================================================================
  // ===== v6 升级：BOSS AI 对话 / 口诀连招 / 溯源档案 / 通行证 / ===========
  // ===== 格挡反击 / 组合弹幕 / 超觉醒 ====================================
  // =========================================================================

  /** v6：初始化所有 v6 新系统状态（构造时调用） */
  private initV6Upgrades(): void {
    // 读取开关选项（默认全部启用）
    this.enableBossAIDialog = this.opts.enableBossAIDialog !== false;
    this.enableMantraChain = this.opts.enableMantraChain !== false;
    this.enableFraudArchive = this.opts.enableFraudArchive !== false;
    this.enableSeasonPass = this.opts.enableSeasonPass !== false;
    this.enableParry = this.opts.enableParry !== false;
    this.enableCombinedPatterns = this.opts.enableCombinedPatterns !== false;
    this.enableSuperAwakening = this.opts.enableSuperAwakening !== false;
    // 同步存档标量到 seasonPass 对象（兼容旧存档）
    if (this.save.seasonPass) {
      if (this.save.seasonPassLevel && this.save.seasonPassLevel > 1) this.save.seasonPass.level = this.save.seasonPassLevel;
      if (this.save.seasonPassExp) this.save.seasonPass.exp = this.save.seasonPassExp;
      if (this.save.seasonPassElite) this.save.seasonPass.elite = this.save.seasonPassElite;
    }
    // P4：检查当前武器分支是否已超觉醒（存档记录）
    this.refreshSuperAwakening();
  }

  // =========================================================================
  // ===== v7 升级：剧情 / 课程 / RPG / 自适应AI / 程序化弹幕 / ============
  // ===== 证书 / 数据仪表板 ================================================
  // =========================================================================

  /** v7：初始化所有 v7 新系统状态（构造时调用） */
  private initV7Upgrades(): void {
    // 1) 读取开关选项（默认全部启用）
    this.enableAdaptiveAI = this.opts.enableAdaptiveAI !== false;
    this.enableProceduralPatterns = this.opts.enableProceduralPatterns !== false;

    // 2) 初始化自适应 AI 状态（基于存档技能评分或测试覆盖值）
    const baseSkill = typeof this.opts.adaptiveSkillOverride === "number"
      ? this.opts.adaptiveSkillOverride
      : (typeof this.save.adaptiveSkillScore === "number" ? this.save.adaptiveSkillScore : V7_ADAPTIVE_INITIAL_SKILL);
    this.adaptiveState = initAdaptiveState(baseSkill);
    // 应用自适应难度到当前难度配置（叠加倍率）
    if (this.enableAdaptiveAI) {
      this.difficultyCfg = applyAdaptiveToDifficulty(this.opts.difficulty, this.adaptiveState);
      // 同步玩家初始 HP（难度变化后重新计算）
      this.player.hp = Math.round(MAX_HP * this.difficultyCfg.playerHpMul);
    }

    // 3) 初始化程序化弹幕配置（每日挑战使用固定种子）
    const seed = this.opts.proceduralSeed
      ?? (this.opts.mode === "daily" ? (this.opts.dailySeed ?? V7_PROCEDURAL_DAILY_SEED_BASE) : Math.floor(this.rng() * 1e9));
    this.proceduralSeedUsed = seed;
    this.proceduralConfig = {
      ...THUNDER_PROCEDURAL_CONFIG,
      enabled: this.enableProceduralPatterns,
      seed,
      difficultyFactor: this.adaptiveState.difficultyMul,
    };

    // 4) 证书进度快照（本局开始时 certId → 进度值，用于结束时对比新解锁）
    this.certificateProgressSnapshot = {};
    for (const c of THUNDER_CERTIFICATES) {
      this.certificateProgressSnapshot[c.id] = calcCertificateProgressValue(c, this.save);
    }

    // 5) 剧情模式：加载起始关卡
    if (this.opts.mode === "story") {
      const startId = this.opts.storyStartStageId
        ?? getNextStageId(this.save.storyCurrentChapter > 0 ? `STORY-${String(this.save.storyCurrentChapter).padStart(2, "0")}` : "")
        ?? "STORY-01";
      this.currentStoryStage = getStoryStageById(startId) ?? null;
      this.storyNarrativeLineIdx = 0;
    }

    // 6) RPG 模式：加载剧本
    if (this.opts.mode === "rpg") {
      const scenarioId = this.opts.rpgScenarioId;
      this.currentRPGScenario = scenarioId ? (getRPGScenarioById(scenarioId) ?? null) : pickRandomRPGScenario();
      if (this.currentRPGScenario) {
        const startNode = this.currentRPGScenario.nodes.find((n) => n.id === this.currentRPGScenario!.startNodeId)
          ?? this.currentRPGScenario.nodes[0];
        this.currentRPGNode = startNode ?? null;
        this.rpgBustScore = 0;
        this.rpgHistory = [];
        this.rpgEnded = false;
        this.currentRPGEnding = null;
      }
    }

    // 7) 课程模式：加载章节
    if (this.opts.mode === "lesson") {
      const chapterId = this.opts.lessonChapterId;
      if (chapterId) {
        this.currentLessonChapter = getLessonChapterById(chapterId) ?? null;
      } else {
        // 默认取首个未通关章节
        const cleared = new Set(this.save.lessonClearedChapters);
        this.currentLessonChapter = getAllLessonChapters().find((c) => !cleared.has(c.id)) ?? getAllLessonChapters()[0] ?? null;
      }
      this.lessonSectionIdx = 0;
      this.lessonQuizIdx = 0;
      this.lessonQuizCorrect = 0;
    }
  }

  /** v7：每帧更新 v7 子系统（自适应难度/程序化弹幕/证书检查） */
  private updateV7Systems(dt: number): void {
    // 自适应 AI：根据当前局内表现微调难度倍率（趋势分析在结算时更新评分）
    if (this.enableAdaptiveAI && !this.over) {
      // 局内动态难度仅做轻微浮动（基于当前 HP 与连击），最终评分调整在结算时进行
      const hpRatio = this.player.hp / MAX_HP;
      const comboBoost = Math.min(0.15, this.combo * 0.01); // 连击越高，难度微升（上限 +15%）
      const hpPenalty = (1 - hpRatio) * 0.1; // HP 越低，难度微降（上限 -10%）
      const targetMul = this.adaptiveState.difficultyMul + comboBoost - hpPenalty;
      // 平滑过渡到目标倍率
      this.adaptiveState.difficultyMul += (targetMul - this.adaptiveState.difficultyMul) * Math.min(1, dt * 0.5);
      this.proceduralConfig.difficultyFactor = this.adaptiveState.difficultyMul;
    }

    // 程序化弹幕：BOSS 战时根据 HP 选择程序化模式
    if (this.enableProceduralPatterns && this.boss && this.boss.entranceStage === "done" && !this.over) {
      const hpRatio = this.boss.hp / this.boss.maxHp;
      if (hpRatio < this.proceduralConfig.hpThreshold) {
        // BOSS HP 低于阈值时，生成/刷新程序化弹幕模式
        const pattern = pickPatternForBossHp(this.rng, hpRatio, this.proceduralConfig.difficultyFactor);
        if (!this.currentProceduralPattern || this.currentProceduralPattern.id !== pattern.id) {
          this.currentProceduralPattern = pattern;
        }
      }
    }

    // v7 toast 到期清除
    if (this.v7Toast && this.t >= this.v7Toast.until) {
      this.v7Toast = null;
    }
  }

  /** v7：显示一次性 toast（证书解锁/RPG 结局等） */
  private showV7Toast(text: string, tone: "good" | "bad" | "info"): void {
    this.v7Toast = { text, tone, until: this.t + 3 };
  }

  /** v7：构建剧情模式 HUD 状态 */
  private buildStoryHud(): ThunderHudStoryState | null {
    const stage = this.currentStoryStage;
    if (!stage) return null;
    const lines = THUNDER_STORY_NARRATIVE_LINES[stage.id] ?? [];
    const idx = this.storyNarrativeLineIdx;
    const line = lines[idx];
    const stageCleared = this.save.storyClearedStages.includes(stage.id);
    return {
      stageId: stage.id,
      chapter: stage.chapter,
      stageName: stage.name,
      stageKind: stage.kind,
      intro: stage.intro,
      narrativeActive: stage.kind === "narrative",
      narrativeLineIdx: lines.length > 0 ? idx : undefined,
      narrativeTotalLines: lines.length > 0 ? lines.length : undefined,
      currentNarrativeText: line?.text,
      currentNarrativeSpeaker: line?.speaker,
      passScore: stage.passScore,
      rankSScore: stage.rankSScore,
      rankAScore: stage.rankAScore,
      rankBScore: stage.rankBScore,
      recommendedCharacter: stage.recommendedCharacterId,
      stageCleared,
      rank: this.storyRank ?? undefined,
    };
  }

  /** v7：构建 RPG 模式 HUD 状态 */
  private buildRPGHud(): ThunderHudRPGState | null {
    const scenario = this.currentRPGScenario;
    const node = this.currentRPGNode;
    if (!scenario || !node) return null;
    return {
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      currentNodeId: node.id,
      nodeKind: node.kind,
      currentScene: node.scene,
      currentSpeaker: node.speaker,
      currentText: node.text,
      currentChoices: node.choices ?? [],
      history: this.rpgHistory.slice(-20),
      bustScore: this.rpgBustScore,
      passThreshold: scenario.passThreshold,
      deconstructRevealed: false,
      currentDeconstruct: node.deconstruct,
      ended: this.rpgEnded,
      endingId: this.currentRPGEnding?.id,
      ending: this.currentRPGEnding ?? undefined,
    };
  }

  /** v7：构建课程模式 HUD 状态 */
  private buildLessonHud(): ThunderHudLessonState | null {
    const chapter = this.currentLessonChapter;
    if (!chapter) return null;
    const section = chapter.sections[this.lessonSectionIdx];
    if (!section) return null;
    const inQuiz = section.kind === "quiz";
    const totalQuiz = section.quizQuestions?.length ?? 0;
    const currentQuiz = inQuiz ? section.quizQuestions?.[this.lessonQuizIdx] : undefined;
    const chapterProgress = chapter.sections.length > 0 ? (this.lessonSectionIdx + 1) / chapter.sections.length : 0;
    return {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionKind: section.kind,
      sectionContent: section.content,
      keyPoints: section.keyPoints ?? [],
      inQuiz,
      quizQuestionIdx: inQuiz ? this.lessonQuizIdx : undefined,
      quizTotal: inQuiz ? totalQuiz : undefined,
      currentQuiz,
      quizCorrect: inQuiz ? this.lessonQuizCorrect : undefined,
      chapterProgress,
      chapterCleared: this.save.lessonClearedChapters.includes(chapter.id),
    };
  }

  /** v7：RPG 选择选项（场景层调用） */
  chooseRPGChoice(choiceIdx: number): void {
    if (this.opts.mode !== "rpg" || this.rpgEnded) return;
    const node = this.currentRPGNode;
    const scenario = this.currentRPGScenario;
    if (!node || !scenario || !node.choices) return;
    const choice = node.choices[choiceIdx];
    if (!choice) return;
    // 记录历史
    this.rpgHistory.push({ speaker: node.speaker, text: node.text, isPlayer: false });
    this.rpgHistory.push({ text: choice.text, isPlayer: true, verdict: choice.verdict });
    // 识破加分
    if (choice.bust && choice.bustScore) {
      this.rpgBustScore += choice.bustScore;
    }
    // 跳转下一节点
    if (choice.nextNodeId) {
      const next = scenario.nodes.find((n) => n.id === choice.nextNodeId);
      if (next) {
        this.currentRPGNode = next;
        // 若为结局节点，结算
        if (next.isEnding || next.kind === "ending") {
          this.finishRPG(next.endingId);
        }
      }
    } else {
      // nextNodeId 为 null = 进入结局（根据 bustScore 计算）
      this.finishRPG();
    }
    this.emitHud();
  }

  /** v7：结束 RPG 剧本，计算结局 */
  private finishRPG(endingId?: string): void {
    const scenario = this.currentRPGScenario;
    if (!scenario || this.rpgEnded) return;
    this.rpgEnded = true;
    const ending = endingId
      ? (scenario.endings.find((e) => e.id === endingId) ?? null)
      : calcRPGEnding(this.rpgBustScore, scenario);
    this.currentRPGEnding = ending;
    // 记录存档
    if (!this.save.rpgClearedScenarios.includes(scenario.id)) {
      this.save.rpgClearedScenarios.push(scenario.id);
      this.save.totalRPGCleared = (this.save.totalRPGCleared ?? 0) + 1;
    }
    if (ending && !this.save.rpgUnlockedEndings.includes(ending.id)) {
      this.save.rpgUnlockedEndings.push(ending.id);
    }
    // 奖励天赋点（按识破红旗数）
    const reward = this.rpgBustScore * V7_RPG_REWARD_TALENT_POINTS_PER_BUST;
    if (reward > 0) {
      this.save.talentPoints += reward;
      this.save.totalTalentPointsEarned += reward;
    }
    this.showV7Toast(`剧本完成：${ending?.title ?? "结局"}（识破 ${this.rpgBustScore} 处）`, "good");
    this.persistSave();
  }

  /** v7：推进剧情对白（narrative 关卡，场景层调用） */
  advanceStoryNarrative(): void {
    if (this.opts.mode !== "story" || !this.currentStoryStage) return;
    const lines = THUNDER_STORY_NARRATIVE_LINES[this.currentStoryStage.id] ?? [];
    if (this.storyNarrativeLineIdx < lines.length - 1) {
      this.storyNarrativeLineIdx++;
      this.emitHud();
    }
  }

  /** v7：课程模式 - 推进到下一小节（场景层调用） */
  advanceLessonSection(): void {
    if (this.opts.mode !== "lesson" || !this.currentLessonChapter) return;
    const chapter = this.currentLessonChapter;
    if (this.lessonSectionIdx < chapter.sections.length - 1) {
      this.lessonSectionIdx++;
      this.lessonQuizIdx = 0;
      this.lessonQuizCorrect = 0;
      this.emitHud();
    } else {
      // 章节通关
      this.finishLessonChapter();
    }
  }

  /** v7：课程模式 - 回答测验题目（场景层调用） */
  answerLessonQuiz(optionIdx: number): void {
    if (this.opts.mode !== "lesson" || !this.currentLessonChapter) return;
    const section = this.currentLessonChapter.sections[this.lessonSectionIdx];
    if (!section || section.kind !== "quiz" || !section.quizQuestions) return;
    const q = section.quizQuestions[this.lessonQuizIdx];
    if (!q) return;
    if (optionIdx === q.answer) {
      this.lessonQuizCorrect++;
    }
    if (this.lessonQuizIdx < section.quizQuestions.length - 1) {
      this.lessonQuizIdx++;
      this.emitHud();
    } else {
      // 测验完成，推进到下一小节
      this.advanceLessonSection();
    }
  }

  /** v7：完成课程章节 */
  private finishLessonChapter(): void {
    const chapter = this.currentLessonChapter;
    if (!chapter) return;
    if (!this.save.lessonClearedChapters.includes(chapter.id)) {
      this.save.lessonClearedChapters.push(chapter.id);
      this.save.totalLessonsCleared = (this.save.totalLessonsCleared ?? 0) + 1;
      // 奖励天赋点
      this.save.talentPoints += chapter.rewardTalentPoints + V7_LESSON_REWARD_TALENT_POINTS_BONUS;
      this.save.totalTalentPointsEarned += chapter.rewardTalentPoints + V7_LESSON_REWARD_TALENT_POINTS_BONUS;
    }
    // 更新章节最高分
    const score = this.lessonQuizCorrect;
    this.save.lessonBestScores[chapter.id] = Math.max(this.save.lessonBestScores[chapter.id] ?? 0, score);
    this.showV7Toast(`章节通关：${chapter.title}`, "good");
    this.persistSave();
  }

  /** v7：结算时更新自适应 AI 评分与剧情/RPG 进度（win/lose 时调用） */
  private settleV7Meta(win: boolean): void {
    const durationSec = (performance.now() - this.startedAt) / 1000;
    const perfect = win && this.player.hp >= MAX_HP * 0.9;

    // 1) 自适应 AI：更新技能评分
    if (this.enableAdaptiveAI) {
      const { newScore, delta } = updateSkillScore(this.adaptiveState.skillScore, {
        score: this.score,
        win,
        mode: this.opts.mode,
        durationSec,
        perfect,
        bustCount: this.bustedCount,
      });
      this.adaptiveSkillDelta = delta;
      this.save.adaptiveSkillScore = newScore;
      this.adaptiveState.skillScore = newScore;
      // 更新趋势
      this.adaptiveState.lastDelta = delta;
      this.adaptiveState.trend = calcTrend(this.save.adaptiveRecentRuns);
      // 记录本局到最近表现
      this.save.adaptiveRecentRuns.push({
        mode: this.opts.mode,
        score: this.score,
        win,
        skillDelta: delta,
        at: new Date().toISOString(),
      });
      if (this.save.adaptiveRecentRuns.length > 10) {
        this.save.adaptiveRecentRuns = this.save.adaptiveRecentRuns.slice(-10);
      }
      this.save.adaptiveProfileVersion = (this.save.adaptiveProfileVersion ?? 0) + 1;
    }

    // 2) 剧情模式：通关记录
    if (this.opts.mode === "story" && this.currentStoryStage && win) {
      const stage = this.currentStoryStage;
      if (!this.save.storyClearedStages.includes(stage.id)) {
        this.save.storyClearedStages.push(stage.id);
      }
      // 计算评价
      const rank = calcStageRank(this.score, stage);
      this.storyRank = rank;
      // 奖励天赋点（按评价倍率）
      const baseReward = stage.isEnding
        ? V7_STORY_REWARD_TALENT_POINTS.ending
        : (stage.isBranch ? V7_STORY_REWARD_TALENT_POINTS.branch : V7_STORY_REWARD_TALENT_POINTS.main);
      const reward = Math.round(baseReward * V7_STORY_RANK_MULTIPLIER[rank]);
      this.save.talentPoints += reward;
      this.save.totalTalentPointsEarned += reward;
      // 更新章节进度
      const nextId = getNextStageId(stage.id);
      if (nextId) {
        const nextStage = getStoryStageById(nextId);
        if (nextStage) {
          this.save.storyCurrentChapter = nextStage.chapter;
        }
      }
      // 结局解锁
      if (stage.isEnding && stage.endingId && !this.save.storyUnlockedEndings.includes(stage.endingId)) {
        this.save.storyUnlockedEndings.push(stage.endingId);
      }
      this.showV7Toast(`关卡通关：${stage.name}（${rank} 级）`, "good");
    }

    // 3) 知识图谱：基于本局击杀更新掌握度
    if (this.bustedCount > 0) {
      const mastery = this.save.knowledgeMastery;
      // 每击杀一个敌人提升相关节点掌握度（简化：按击杀分布小幅提升）
      for (const typeId of Object.keys(this.killStats)) {
        const nodeKey = `kn_${typeId}`;
        mastery[nodeKey] = Math.min(1, (mastery[nodeKey] ?? 0) + 0.05 * this.killStats[typeId]);
      }
      this.save.knowledgeMastery = mastery;
      const totalUnlocked = Object.values(mastery).filter((v) => v >= 1).length;
      this.save.totalKnowledgeNodesUnlocked = totalUnlocked;
    }

    // 4) 证书：检查新解锁
    const newlyUnlocked = getNewlyUnlockedCertificates(this.save, this.certificateProgressSnapshot);
    if (newlyUnlocked.length > 0) {
      this.unlockedCertificatesThisRun = newlyUnlocked;
      for (const cert of newlyUnlocked) {
        if (!this.save.unlockedCertificates.includes(cert.id)) {
          this.save.unlockedCertificates.push(cert.id);
        }
      }
      this.showV7Toast(`解锁新证书：${newlyUnlocked.map((c) => c.name).join("、")}`, "good");
    }
  }

  /** v7：获取数据仪表板（场景层 / 结算页调用） */
  getAnalyticsDashboard(): ThunderAnalyticsDashboard {
    return buildAnalyticsDashboard(this.save);
  }

  private refreshSuperAwakening(): void {
    if (!this.enableSuperAwakening) {
      this.superAwakening = null;
      return;
    }
    const p = this.player;
    if (p.weaponBranch === "normal" || p.weaponBranchLevel < 6) {
      this.superAwakening = null;
      return;
    }
    const level = p.weaponBranchLevel === 6 ? 6 : 7;
    const def = getSuperAwakening(p.weaponBranch, level);
    this.superAwakening = def ?? null;
    if (def && !this.save.superAwakenedBranches.includes(p.weaponBranch)) {
      this.save.superAwakenedBranches.push(p.weaponBranch);
    }
    this.emitHud();
  }

  // ===== S1：BOSS AI 对话识破 =====

  /** S1：触发 BOSS AI 对话（HP < 20% 时调用） */
  private triggerBossAIDialog(): void {
    if (!this.enableBossAIDialog) return;
    const b = this.boss;
    if (!b || this.bossAIDialog) return; // 已激活则跳过
    const dialogId = b.def.aiDialogId;
    if (!dialogId) return;
    const dialog = getBossAIDialogById(dialogId);
    if (!dialog) return;
    this.bossAIDialog = dialog;
    // 进入起始节点
    const startNode = dialog.nodes.find((n) => n.id === dialog.startNodeId) ?? dialog.nodes[0];
    this.bossAIDialogNode = startNode;
    this.bossAIDialogState = this.buildAIDialogState(startNode, 0, 0, [], null);
    // 视觉提示：BOSS 进入「最终话术」阶段
    postFX.flash("#FF00E5", 0.4, 3);
    postFX.glitch(0.8, 3);
    postFX.shake(8, 12);
    this.toast = { text: `⚠ ${b.def.name} 进入最终话术识破！`, tone: "bad", until: this.t + 2.5 };
    this.particles.spawnBurst(b.x, b.y, "#FF00E5", { ring: true, sparks: 24, dots: 30, speed: 280, life: 1.0, size: 4, color2: b.def.color });
    playSfx("boss");
    this.emitHud();
  }

  /** S1：构建对话 HUD 状态 */
  private buildAIDialogState(
    node: ThunderBossAIDialogNode,
    bustScore: number,
    turnCount: number,
    turns: ThunderHudBossAIDialogState["turns"],
    lastFeedback: string | null,
  ): ThunderHudBossAIDialogState {
    const dialog = this.bossAIDialog!;
    const bossLine = node.bossLines[Math.floor(this.rng() * node.bossLines.length)] ?? "";
    return {
      dialogId: dialog.id,
      dialogTitle: dialog.title,
      currentNodeId: node.id,
      turns,
      currentBossLine: bossLine,
      currentRedFlag: node.redFlag,
      currentTactic: node.tactic ?? "",
      bustScore,
      passThreshold: dialog.passThreshold,
      turnCount,
      maxTurns: dialog.maxTurns,
      ended: false,
      currentChoices: node.choices,
      lastFeedback,
    };
  }

  /**
   * S1：玩家选择对话回复（场景层调用）
   * @param choiceIndex 选项索引（0-based）
   */
  answerBossAIDialog(choiceIndex: number): void {
    if (!this.bossAIDialog || !this.bossAIDialogNode || !this.bossAIDialogState) return;
    if (this.bossAIDialogState.ended) return;
    const node = this.bossAIDialogNode;
    const choice = node.choices[choiceIndex];
    if (!choice) return;
    const dialog = this.bossAIDialog;
    const state = this.bossAIDialogState;
    // 追加玩家回复到对话历史
    const newTurns = state.turns.concat([
      { from: "boss" as const, text: state.currentBossLine, tactic: state.currentTactic },
      { from: "player" as const, text: choice.text, feedback: choice.feedback },
    ]);
    // 计算新分数与轮次
    const newBustScore = state.bustScore + (choice.bust && choice.bustScore ? choice.bustScore : 0);
    const newTurnCount = state.turnCount + 1;
    // 选错时 BOSS 回血
    if (choice.verdict === "wrong" && choice.bossHealRatio && this.boss) {
      const heal = Math.floor(this.boss.maxHp * choice.bossHealRatio);
      this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + heal);
      this.floats.push({
        x: this.boss.x, y: this.boss.y - 30, text: `BOSS 回血 +${heal}`,
        color: "#FF00E5", life: 1.2, maxLife: 1.2, size: 14,
        vx: 0, vy: -30, gravity: 0,
      });
      postFX.flash("#FF00E5", 0.3, 2);
    }
    // 识破时奖励分数
    if (choice.bust && choice.bustScore) {
      this.score += choice.bustScore * 200;
      this.floats.push({
        x: W / 2, y: H / 2, text: `识破 +${choice.bustScore * 200}`,
        color: "#52C41A", life: 1.2, maxLife: 1.2, size: 18,
        vx: 0, vy: -40, gravity: 0,
      });
      playSfx("good");
    }
    // 检查对话是否结束
    const nextNodeId = choice.nextNodeId;
    const isEnd = !nextNodeId || newTurnCount >= dialog.maxTurns;
    if (isEnd) {
      // 结束对话：根据识破分数判定结局
      const busted = newBustScore >= dialog.passThreshold;
      this.bossAIDialogState = {
        ...state,
        turns: newTurns,
        bustScore: newBustScore,
        turnCount: newTurnCount,
        ended: true,
        ending: busted ? "busted" : "scammed",
        endingDesc: busted ? dialog.passMantra : dialog.failTip,
        lastFeedback: choice.feedback ?? null,
      };
      this.aiDialogBustedCount += busted ? 1 : 0;
      this.save.totalAIDialogBusted += busted ? 1 : 0;
      if (busted && dialog.passMantra) {
        this.mantraTexts.push({ text: dialog.passMantra, until: this.t + 3.5 });
        if (this.mantraTexts.length > 6) this.mantraTexts.shift();
        postFX.flash("#52C41A", 0.5, 3);
        // 识破成功：BOSS 受到额外伤害
        if (this.boss) {
          const extraDmg = Math.floor(this.boss.maxHp * 0.15);
          this.boss.hp -= extraDmg;
          this.floats.push({
            x: this.boss.x, y: this.boss.y - 30, text: `识破重创 -${extraDmg}`,
            color: "#52C41A", life: 1.5, maxLife: 1.5, size: 18,
            vx: 0, vy: -40, gravity: 0,
          });
          if (this.boss.hp <= 0) this.killBoss();
        }
      } else if (!busted && dialog.failTip) {
        this.toast = { text: `识破失败：${dialog.failTip}`, tone: "bad", until: this.t + 3 };
        postFX.flash("#E5353B", 0.4, 2);
      }
      // 1.5 秒后自动关闭对话 UI（基于引擎时间，兼容小游戏环境）
      this.bossAIDialogCloseAt = this.t + 1.5;
    } else {
      // 推进到下一节点
      const nextNode = dialog.nodes.find((n) => n.id === nextNodeId);
      if (nextNode) {
        this.bossAIDialogNode = nextNode;
        this.bossAIDialogState = this.buildAIDialogState(nextNode, newBustScore, newTurnCount, newTurns, choice.feedback ?? null);
      } else {
        // 节点不存在：直接结束
        this.bossAIDialogState = {
          ...state,
          turns: newTurns,
          bustScore: newBustScore,
          turnCount: newTurnCount,
          ended: true,
          ending: newBustScore >= dialog.passThreshold ? "busted" : "scammed",
          endingDesc: dialog.passMantra,
          lastFeedback: choice.feedback ?? null,
        };
      }
    }
    this.emitHud();
  }

  // ===== S2：反诈口诀连招 =====

  /** S2：检查并触发口诀连招（每次 combo 增长时调用） */
  private checkMantraChain(): void {
    if (!this.enableMantraChain) return;
    const combo = this.combo;
    for (const def of THUNDER_MANTRA_CHAINS) {
      // 已解锁则跳过
      if (this.unlockedMantras.some((m) => m.mantra === def.mantra)) continue;
      if (combo >= def.comboThreshold) {
        this.unlockedMantras.push(def);
        this.activeMantra = def;
        this.activeMantraUntil = this.t + def.boostDuration;
        this.mantraTriggeredCount += 1;
        this.save.totalMantraTriggered += 1;
        // 飘字
        this.mantraTexts.push({ text: `${def.emoji} ${def.mantra}`, until: this.t + 3 });
        if (this.mantraTexts.length > 6) this.mantraTexts.shift();
        // 全屏伤害（对全屏敌方造成比例伤害）
        if (def.screenDamageRatio > 0) {
          this.dealScreenDamage(def.screenDamageRatio);
        }
        // 视觉
        postFX.flash(def.color, 0.5, 3);
        postFX.glitch(0.5, 2);
        postFX.shake(8, 12);
        this.spawnShock(W / 2, H / 2, 320, def.color, 5);
        this.particles.spawnBurst(this.player.x, this.player.y, def.color, { ring: true, sparks: 30, dots: 36, speed: 320, life: 1.0, size: 5, color2: "#FFD666" });
        this.toast = { text: `口诀连招：${def.mantra}（分数 ×${def.scoreMul}）`, tone: "good", until: this.t + 2.5 };
        playSfx("achievement");
        // 完整口诀集齐时额外奖励
        if (def.comboThreshold === 50) {
          this.score += 5000;
          this.floats.push({
            x: W / 2, y: H / 2 - 60, text: "完整口诀！+5000",
            color: "#FFD700", life: 2, maxLife: 2, size: 22,
            vx: 0, vy: -30, gravity: 0,
          });
          postFX.flash("#FFD700", 0.8, 4);
        }
      }
    }
  }

  /** S2：对全屏敌方造成比例伤害（口诀连招触发） */
  private dealScreenDamage(ratio: number): void {
    // 对所有敌人造成当前血量比例伤害
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dmg = Math.ceil(e.hp * ratio);
      e.hp -= dmg;
      e.hitFlash = 0.2;
      if (e.hp <= 0) this.killEnemy(i, false);
    }
    // 对 BOSS 造成最大血量比例伤害（较低，避免直接秒杀）
    if (this.boss && this.t >= this.boss.enterUntil) {
      const bossDmg = Math.floor(this.boss.maxHp * ratio * 0.3);
      this.boss.hp -= bossDmg;
      this.boss.hitFlash = 0.3;
      this.particles.spawnText(this.boss.x, this.boss.y - 30, `-${bossDmg}`, "#FFD700", { size: 16, life: 0.8 });
      if (this.boss.hp <= 0) this.killBoss();
    }
  }

  // ===== S3：诈骗溯源档案 =====

  /** S3：BOSS 击败后解锁档案（killBoss 调用） */
  private unlockFraudArchive(bossDef: BossDef): void {
    if (!this.enableFraudArchive) return;
    const archiveId = bossDef.archiveId;
    if (!archiveId) return;
    const archive = getFraudArchiveByBossId(bossDef.id);
    if (!archive) return;
    // 标记到存档（首次解锁）
    if (!this.save.unlockedFraudArchives.includes(archiveId)) {
      this.save.unlockedFraudArchives.push(archiveId);
    }
    // 触发档案展示（场景层一次性消费）
    this.fraudArchiveTrigger = archive;
    this.unlockedArchivesThisRun.push(archive);
    this.emit({ type: "log", text: `[ARCHIVE_UNLOCK]${archiveId}` });
  }

  // ===== S4：赛季通行证 =====

  /** S4：增加赛季通行证经验（killBoss / win 时调用） */
  private addSeasonPassExp(amount: number): void {
    if (!this.enableSeasonPass) return;
    if (amount <= 0) return;
    const before = this.save.seasonPass.level;
    this.save.seasonPass.exp += amount;
    this.seasonPassGainedExp += amount;
    // 检查升级
    let level = this.save.seasonPass.level;
    while (level < THUNDER_SEASON_PASS.maxLevel) {
      const nextTier = THUNDER_SEASON_PASS.tiers.find((t) => t.level > level);
      if (!nextTier) break;
      if (this.save.seasonPass.exp >= nextTier.requiredExp) {
        level += 1;
        this.save.seasonPass.level = level;
        // 解锁奖励
        const tier = THUNDER_SEASON_PASS.tiers.find((t) => t.level === level);
        if (tier) {
          if (tier.freeReward) this.seasonPassUnlockedRewards.push(tier.freeReward);
          if (this.save.seasonPass.elite && tier.eliteReward) this.seasonPassUnlockedRewards.push(tier.eliteReward);
        }
      } else {
        break;
      }
    }
    // 同步标量字段（兼容旧存档读取）
    this.save.seasonPassLevel = this.save.seasonPass.level;
    this.save.seasonPassExp = this.save.seasonPass.exp;
    this.save.seasonPassElite = this.save.seasonPass.elite;
    // 升级提示
    if (this.save.seasonPass.level > before) {
      this.toast = { text: `🏆 赛季通行证升级！Lv.${this.save.seasonPass.level}`, tone: "good", until: this.t + 3 };
      postFX.flash("#FFD700", 0.5, 3);
      this.particles.spawnBurst(this.player.x, this.player.y, "#FFD700", { ring: true, sparks: 24, dots: 30, speed: 280, life: 1.0, size: 5, color2: "#FF7A1A" });
      playSfx("achievement");
    }
  }

  // ===== P1：格挡反击 =====

  /**
   * P1：玩家触发格挡（场景层调用）
   * 完美格挡窗口内可反弹子弹；窗口外仅格挡减伤
   */
  triggerParry(): void {
    if (!this.enableParry) return;
    const p = this.player;
    if (p.parryCd > 0) return;
    if (this.over || this.isPaused) return;
    // 进入格挡状态：开启完美窗口 + 护盾持续
    p.parryCd = V6_PARRY_CONFIG.cooldownMax;
    p.parryPerfectWindow = V6_PARRY_CONFIG.perfectWindowMax;
    p.parryShieldUntil = this.t + V6_PARRY_CONFIG.shieldDuration;
    // 视觉
    this.particles.spawnBurst(p.x, p.y, "#00E5FF", { ring: true, sparks: 16, dots: 20, speed: 200, life: 0.5, size: 4, color2: "#FFFFFF" });
    this.spawnShock(p.x, p.y, 80, "#00E5FF", 4);
    postFX.flash("#00E5FF", 0.2, 2);
    playSfx("good");
    this.emitHud();
  }

  /** P1：更新格挡状态（每帧调用） */
  private updateParry(dt: number): void {
    if (!this.enableParry) return;
    const p = this.player;
    if (p.parryCd > 0) p.parryCd = Math.max(0, p.parryCd - dt);
    if (p.parryPerfectWindow > 0) p.parryPerfectWindow = Math.max(0, p.parryPerfectWindow - dt);
    // 完美格挡触发标记一次性消费（场景层读取后清除）
    // 由子弹碰撞检测中调用 onParryHit
  }

  /** P1：子弹命中玩家时检查格挡（碰撞检测调用） */
  private onParryHit(bullet: { x: number; y: number; damage: number; color: string }): { blocked: boolean; reflected: boolean; reflectDmg: number } {
    if (!this.enableParry) return { blocked: false, reflected: false, reflectDmg: 0 };
    const p = this.player;
    if (this.t >= p.parryShieldUntil) return { blocked: false, reflected: false, reflectDmg: 0 };
    // 在格挡护盾持续时间内
    const perfect = p.parryPerfectWindow > 0;
    if (perfect) {
      // 完美格挡：反弹伤害 + 回血
      const reflectDmg = Math.round(bullet.damage * V6_PARRY_CONFIG.reflectMul);
      this.parryCount += 1;
      this.save.totalParryCount += 1;
      this.parryPerfectTriggered = true;
      // 回血
      this.player.hp = Math.min(MAX_HP, this.player.hp + V6_PARRY_CONFIG.healOnPerfect);
      this.particles.spawnText(this.player.x, this.player.y - 30, `完美格挡 +${V6_PARRY_CONFIG.healOnPerfect}HP`, "#52C41A", { size: 14, life: 1 });
      // 反弹特效：在玩家位置生成反弹子弹射向最近敌人/BOSS
      const target = this.findNearestEnemyOrBoss();
      if (target) {
        const dx = target.x - this.player.x;
        const dy = target.y - this.player.y;
        const d = Math.hypot(dx, dy) || 1;
        this.bullets.push({
          x: this.player.x, y: this.player.y - 20,
          vx: (dx / d) * 600, vy: (dy / d) * 600,
          damage: reflectDmg, color: "#00E5FF", size: 8, from: "player", life: 3,
          pierce: true, hitCd: 0,
        });
      }
      // 视觉
      this.spawnShock(this.player.x, this.player.y, 120, "#00E5FF", 5);
      postFX.flash("#00E5FF", 0.3, 3);
      postFX.shake(4, 8);
      // 完美格挡后立即结束护盾（一次性）
      p.parryShieldUntil = 0;
      p.parryPerfectWindow = 0;
      playSfx("good");
      return { blocked: true, reflected: true, reflectDmg };
    }
    // 普通格挡：减伤（伤害减半，不反弹）
    return { blocked: true, reflected: false, reflectDmg: 0 };
  }

  /** P1：查找最近敌人或 BOSS（用于反弹子弹目标） */
  private findNearestEnemyOrBoss(): { x: number; y: number } | null {
    const px = this.player.x;
    const py = this.player.y;
    let nearest: { x: number; y: number; dist: number } | null = null;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - px, e.y - py);
      if (!nearest || d < nearest.dist) nearest = { x: e.x, y: e.y, dist: d };
    }
    if (this.boss && this.t >= this.boss.enterUntil) {
      const d = Math.hypot(this.boss.x - px, this.boss.y - py);
      if (!nearest || d < nearest.dist) nearest = { x: this.boss.x, y: this.boss.y, dist: d };
    }
    return nearest ? { x: nearest.x, y: nearest.y } : null;
  }

  // ===== P2：组合弹幕 =====

  /** P2：更新 BOSS 组合弹幕状态（updateBoss 调用） */
  private updateCombinedPatterns(dt: number): void {
    if (!this.enableCombinedPatterns) return;
    const b = this.boss;
    if (!b || b.entranceStage !== "done") return;
    const hpRatio = b.hp / b.maxHp;
    // HP < 50% 且 BOSS 已有 combinedPatterns 定义时激活
    if (hpRatio < V6_COMBINED_PATTERN_CONFIG.triggerBossHpThreshold && b.def.combinedPatterns && b.def.combinedPatterns.length > 0) {
      if (this.bossActiveCombinedPatterns.length === 0) {
        // 首次激活组合弹幕
        this.bossActiveCombinedPatterns = b.def.combinedPatterns.slice(0, V6_COMBINED_PATTERN_CONFIG.maxCombinedPatterns);
        this.toast = { text: `⚠ ${b.def.name} 启动组合弹幕！`, tone: "bad", until: this.t + 2 };
        postFX.flash("#FF00E5", 0.4, 3);
        postFX.glitch(0.5, 2);
      }
    }
  }

  /** P2：发射组合弹幕（bossFire 调用，在主弹幕之后追加） */
  private fireCombinedPatterns(): void {
    if (!this.enableCombinedPatterns) return;
    const b = this.boss;
    if (!b || this.bossActiveCombinedPatterns.length === 0) return;
    const col = b.def.color;
    const dmg = (b.def.ultimate ? DMG_BULLET + 2 : DMG_BULLET) * 0.7; // 组合弹幕单发伤害较低
    for (const pattern of this.bossActiveCombinedPatterns) {
      switch (pattern) {
        case "crossFire": {
          // 交叉火力：两组垂直方向弹幕
          for (let i = 0; i < 4; i++) {
            const a1 = (i / 4) * Math.PI * 2;
            const a2 = a1 + Math.PI / 4;
            this.bullets.push({
              x: b.x, y: b.y, vx: Math.cos(a1) * 200, vy: Math.sin(a1) * 200,
              damage: dmg, color: "#FF00E5", size: 5, from: "enemy", life: 4,
            });
            this.bullets.push({
              x: b.x, y: b.y, vx: Math.cos(a2) * 200, vy: Math.sin(a2) * 200,
              damage: dmg, color: col, size: 5, from: "enemy", life: 4,
            });
          }
          break;
        }
        case "ringBurst": {
          // 环形爆发：多层圆环弹幕
          const n = 12;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            this.bullets.push({
              x: b.x, y: b.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
              damage: dmg, color: "#FFD700", size: 5, from: "enemy", life: 4,
            });
          }
          break;
        }
        case "waveDash": {
          // 波浪冲刺：扇形弹幕 + BOSS 小幅位移
          const dx = this.player.x - b.x;
          const dy = this.player.y - b.y;
          const baseA = Math.atan2(dy, dx);
          for (let i = -2; i <= 2; i++) {
            const a = baseA + i * 0.2;
            this.bullets.push({
              x: b.x, y: b.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
              damage: dmg, color: "#5BA3F0", size: 5, from: "enemy", life: 4,
            });
          }
          // BOSS 小幅冲刺
          b.x += b.moveDir * 30;
          if (b.x < 80) { b.x = 80; b.moveDir = 1; }
          else if (b.x > W - 80) { b.x = W - 80; b.moveDir = -1; }
          break;
        }
        // 其他模式沿用 bossFire 主逻辑，不在此重复
      }
    }
  }

  // ===== P4：武器超觉醒 =====

  /**
   * P4：玩家触发超觉醒大招（场景层调用）
   * 需要充能满且已超觉醒
   */
  triggerSuperAwakeningUlt(): void {
    if (!this.enableSuperAwakening || !this.superAwakening) return;
    if (this.superAwakeningUltCharge < 1) return;
    if (this.over || this.isPaused) return;
    const ult = this.superAwakening.effect.ultimate;
    if (!ult) return;
    // 重置充能
    this.superAwakeningUltCharge = 0;
    this.superAwakeningUltReadyAnnounced = false;
    // 范围伤害
    const radius = ult.radius;
    const dmg = ult.damage;
    // 对所有敌人造成伤害
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < radius) {
        e.hp -= dmg;
        e.hitFlash = 0.3;
        if (e.hp <= 0) this.killEnemy(i, false);
      }
    }
    // 对 BOSS 造成伤害
    if (this.boss && this.t >= this.boss.enterUntil) {
      const d = Math.hypot(this.boss.x - this.player.x, this.boss.y - this.player.y);
      if (d < radius * 1.3) {
        this.boss.hp -= dmg;
        this.boss.hitFlash = 0.4;
        this.particles.spawnText(this.boss.x, this.boss.y - 30, `-${dmg}`, "#FF00E5", { size: 18, life: 1 });
        if (this.boss.hp <= 0) this.killBoss();
      }
    }
    // 视觉：超大范围爆炸
    this.spawnShock(this.player.x, this.player.y, radius, this.superAwakening.emoji ? "#FF00E5" : "#FFD700", 8);
    this.spawnShock(this.player.x, this.player.y, radius * 0.7, "#FFFFFF", 6);
    this.particles.spawnBurst(this.player.x, this.player.y, "#FF00E5", { ring: true, sparks: 50, dots: 60, speed: 440, life: 1.4, size: 6, color2: "#FFD700" });
    postFX.flash("#FF00E5", 0.8, 4);
    postFX.glitch(1.0, 4);
    postFX.shake(15, 18);
    this.hitstopUntil = this.t + 0.3;
    this.toast = { text: `${this.superAwakening.emoji} ${ult.name}！`, tone: "good", until: this.t + 3 };
    playSfx("bomb");
    this.emitHud();
  }

  /** P4：超觉醒大招充能（每次造成伤害时调用） */
  private chargeSuperAwakeningUlt(amount: number): void {
    if (!this.enableSuperAwakening || !this.superAwakening) return;
    if (this.superAwakeningUltCharge >= 1) return;
    const ult = this.superAwakening.effect.ultimate;
    if (!ult) return;
    this.superAwakeningUltCharge = Math.min(1, this.superAwakeningUltCharge + amount / (ult.cooldown * 60));
    // 充能满时一次性提示
    if (this.superAwakeningUltCharge >= 1 && !this.superAwakeningUltReadyAnnounced) {
      this.superAwakeningUltReadyAnnounced = true;
      this.toast = { text: `${this.superAwakening.emoji} 超觉醒大招就绪！`, tone: "good", until: this.t + 2.5 };
      this.particles.spawnBurst(this.player.x, this.player.y, "#FF00E5", { ring: true, sparks: 16, dots: 20, speed: 200, life: 0.6, size: 4 });
      playSfx("good");
    }
  }

  // ===== v6 HUD 辅助方法 =====

  /** S2：下一档口诀阈值（用于 HUD 显示进度） */
  private nextMantraThreshold(): number {
    for (const def of THUNDER_MANTRA_CHAINS) {
      if (this.unlockedMantras.some((m) => m.mantra === def.mantra)) continue;
      return def.comboThreshold;
    }
    return THUNDER_MANTRA_CHAINS[THUNDER_MANTRA_CHAINS.length - 1]?.comboThreshold ?? 50;
  }

  /** S2：下一档口诀文本（用于 HUD 提示） */
  private nextMantraText(): string {
    for (const def of THUNDER_MANTRA_CHAINS) {
      if (this.unlockedMantras.some((m) => m.mantra === def.mantra)) continue;
      return def.mantra;
    }
    return FULL_MANTRA_TEXT;
  }

  /** S4：构建赛季通行证 HUD 状态 */
  private buildSeasonPassHud(): ThunderHudSeasonPassState {
    const sp = this.save.seasonPass;
    const { progress, expToNext } = calcSeasonPassProgress(sp.level, sp.exp);
    return {
      level: sp.level,
      exp: sp.exp,
      expToNext,
      progress,
      elite: sp.elite,
      gainedExp: this.seasonPassGainedExp,
    };
  }

  // ===== v6 统一更新入口 =====

  /** v6：每帧更新所有 v6 系统（update 调用） */
  private updateV6Systems(dt: number): void {
    // P1：格挡状态更新
    this.updateParry(dt);
    // S2：口诀激活到期清除
    if (this.activeMantra && this.t >= this.activeMantraUntil) {
      this.activeMantra = null;
    }
    // S1：对话结束后自动关闭 UI（基于引擎时间）
    if (this.bossAIDialogCloseAt > 0 && this.t >= this.bossAIDialogCloseAt) {
      this.bossAIDialogCloseAt = 0;
      if (this.bossAIDialogState?.ended) {
        this.bossAIDialog = null;
        this.bossAIDialogNode = null;
        this.bossAIDialogState = null;
        this.emitHud();
      }
    }
    // S1：BOSS AI 对话触发检测（HP < 20%）
    if (this.boss && this.boss.entranceStage === "done" && !this.bossAIDialog) {
      const hpRatio = this.boss.hp / this.boss.maxHp;
      if (hpRatio < 0.2 && hpRatio > 0) {
        this.triggerBossAIDialog();
      }
    }
    // P2：组合弹幕状态更新
    this.updateCombinedPatterns(dt);
    // P4：超觉醒存在时持续显示（无需每帧逻辑）
    void dt;
  }

  /** 聚合所有已装备配件的效果 */
  private aggregateEquipEffects(): EquipEffect {
    const agg: EquipEffect = {};
    let dmgMul = 1;
    let critRate = 0;
    let pierce = 0;
    let multishot = 0;
    let shieldCharges = 0;
    let dmgReduce = 0;
    let moveSpeedMul = 1;
    let dashCdMul = 1;
    let ultChargeMul = 1;
    let dropMul = 1;
    let scoreMul = 1;
    let hpRegen = 0;
    for (const e of this.equippedEquipments) {
      const f = e.effect;
      if (f.dmgMul) dmgMul *= f.dmgMul;
      if (f.critRate) critRate += f.critRate;
      if (f.pierce) pierce += f.pierce;
      if (f.multishot) multishot += f.multishot;
      if (f.shieldCharges) shieldCharges += f.shieldCharges;
      if (f.dmgReduce) dmgReduce += f.dmgReduce;
      if (f.moveSpeedMul) moveSpeedMul *= f.moveSpeedMul;
      if (f.dashCdMul) dashCdMul *= f.dashCdMul;
      if (f.ultChargeMul) ultChargeMul *= f.ultChargeMul;
      if (f.dropMul) dropMul *= f.dropMul;
      if (f.scoreMul) scoreMul *= f.scoreMul;
      if (f.hpRegen) hpRegen += f.hpRegen;
    }
    agg.dmgMul = dmgMul;
    agg.critRate = critRate;
    agg.pierce = pierce;
    agg.multishot = multishot;
    agg.shieldCharges = shieldCharges;
    agg.dmgReduce = Math.min(0.6, dmgReduce); // 减伤上限 60%
    agg.moveSpeedMul = moveSpeedMul;
    agg.dashCdMul = dashCdMul;
    agg.ultChargeMul = ultChargeMul;
    agg.dropMul = dropMul;
    agg.scoreMul = scoreMul;
    agg.hpRegen = hpRegen;
    return agg;
  }

  /** v3：计算对敌方的最终伤害（角色加成 + 装备倍率 + 暴击 + v4 天赋/套装） */
  private computeHitDamage(baseDmg: number, fraudType: string): { dmg: number; crit: boolean } {
    let dmg = baseDmg;
    // 装备伤害倍率
    if (this.equipAgg.dmgMul) dmg *= this.equipAgg.dmgMul;
    // v4 天赋伤害倍率
    if (this.talentAgg.dmgMul) dmg *= this.talentAgg.dmgMul;
    // v4 套装伤害倍率
    if (this.setBonus?.effect.dmgMul) dmg *= this.setBonus.effect.dmgMul;
    // 角色对特定诈骗类型加成
    if (this.charFraudTypes.length > 0 && this.charFraudTypes.includes(fraudType)) {
      dmg *= 1 + this.charFraudBonus;
    }
    // v5 三角克制：武器分支 vs 诈骗类型
    const relation = getCounterRelation(this.player.weaponBranch, fraudType);
    if (relation === "advantage") {
      dmg *= COUNTER_ADVANTAGE_MUL;
    } else if (relation === "disadvantage") {
      dmg *= COUNTER_DISADVANTAGE_MUL;
    }
    // 武器觉醒伤害倍率
    const awaken = this.currentAwakening();
    if (awaken) dmg *= awaken.effect.dmgMul;
    // v6 升级：P4 超觉醒伤害倍率（6/7 级，叠加于普通觉醒之上）
    if (this.superAwakening) dmg *= this.superAwakening.effect.dmgMul;
    // 暴击：装备 + 天赋
    const critRate = (this.equipAgg.critRate ?? 0) + (this.talentAgg.critRate ?? 0);
    const crit = critRate > 0 && Math.random() < critRate;
    if (crit) dmg *= 2;
    return { dmg, crit };
  }

  /**
   * v4：聚合所有效果（装备 + 天赋 + 套装）到单一 EquipEffect
   * 用于运行时读取移速/减伤/掉落/积分等属性
   */
  private allAggEffects(): EquipEffect {
    const eq = this.equipAgg;
    const ta = this.talentAgg;
    const sb = this.setBonus?.effect ?? {};
    return {
      dmgMul: (eq.dmgMul ?? 1) * (ta.dmgMul ?? 1) * (sb.dmgMul ?? 1),
      critRate: (eq.critRate ?? 0) + (ta.critRate ?? 0),
      pierce: (eq.pierce ?? 0) + (ta.pierce ?? 0),
      multishot: (eq.multishot ?? 0) + (ta.multishot ?? 0),
      shieldCharges: (eq.shieldCharges ?? 0) + (ta.shieldCharges ?? 0) + (sb.shieldCharges ?? 0),
      dmgReduce: Math.min(0.6, (eq.dmgReduce ?? 0) + (ta.dmgReduce ?? 0) + (sb.dmgReduce ?? 0)),
      moveSpeedMul: (eq.moveSpeedMul ?? 1) * (ta.moveSpeedMul ?? 1) * (sb.moveSpeedMul ?? 1),
      dashCdMul: (eq.dashCdMul ?? 1) * (ta.dashCdMul ?? 1),
      ultChargeMul: (eq.ultChargeMul ?? 1) * (ta.ultChargeMul ?? 1) * (sb.ultChargeMul ?? 1),
      dropMul: (eq.dropMul ?? 1) * (ta.dropMul ?? 1) * (sb.dropMul ?? 1),
      scoreMul: (eq.scoreMul ?? 1) * (ta.scoreMul ?? 1) * (sb.scoreMul ?? 1),
      hpRegen: (eq.hpRegen ?? 0) + (ta.hpRegen ?? 0) + (sb.hpRegen ?? 0),
    };
  }

  /** v3：当前武器觉醒定义（level >= 4 时存在） */
  private currentAwakening(): WeaponAwakeningDef | undefined {
    const p = this.player;
    return getAwakening(p.weaponBranch, p.weaponBranchLevel);
  }

  /** v3：角色分数倍率（scoreBoost 被动 + v4 装备/天赋/套装 scoreMul） */
  private getCharacterScoreMul(): number {
    let mul = 1;
    for (const p of this.character.passives) {
      if (p.kind === "scoreBoost" && p.value) mul *= 1 + p.value;
    }
    const all = this.allAggEffects();
    if (all.scoreMul) mul *= all.scoreMul;
    return mul;
  }

  /** v3：角色道具掉落倍率（dropBoost 被动 + v4 装备/天赋/套装 dropMul） */
  private getCharacterDropMul(): number {
    let mul = 1;
    for (const p of this.character.passives) {
      if (p.kind === "dropBoost" && p.value) mul *= 1 + p.value;
    }
    const all = this.allAggEffects();
    if (all.dropMul) mul *= all.dropMul;
    return mul;
  }

  /** v3+v4：移速倍率（装备 + 天赋 + 套装） */
  private getEquipMoveSpeedMul(): number {
    return this.allAggEffects().moveSpeedMul ?? 1;
  }

  /** v3+v4：闪避冷却倍率（装备 + 天赋） */
  private getEquipDashCdMul(): number {
    return this.allAggEffects().dashCdMul ?? 1;
  }

  /** v3+v4：大招充能倍率（装备 + 天赋 + 套装） */
  private getEquipUltChargeMul(): number {
    return this.allAggEffects().ultChargeMul ?? 1;
  }

  /** v3+v4：减伤比例（装备 + 天赋 + 套装，上限 60%） */
  private getEquipDmgReduce(): number {
    return this.allAggEffects().dmgReduce ?? 0;
  }

  /** v3+v4：每秒回血（装备 + 天赋 + 套装） */
  private getEquipHpRegen(): number {
    return this.allAggEffects().hpRegen ?? 0;
  }

  /** v3+v4：额外穿透数（装备 + 天赋） */
  private getEquipPierce(): number {
    return this.allAggEffects().pierce ?? 0;
  }

  /** v3+v4：额外多发数（装备 + 天赋） */
  private getEquipMultishot(): number {
    return this.allAggEffects().multishot ?? 0;
  }

  // ===== v2 升级：闪避冲刺（A4） =====
  /** 更新蓄力进度 + 闪避冷却 */
  private updateChargeDash(dt: number): void {
    const p = this.player;
    // 蓄力进度
    if (p.charging) {
      const elapsed = this.t - p.chargeStartedAt;
      p.chargeProgress = Math.min(1, elapsed / CHARGE_FULL_TIME);
      if (p.chargeProgress >= 1) {
        // 蓄满自动微震
        if (Math.random() < 0.4) postFX.shake(2, 8);
      }
    }
    // 闪避冷却
    if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
    // 冲刺位移插值
    if (this.t < p.dashActiveUntil) {
      // 冲刺期间加速跟随目标
      p.x += (p.tx - p.x) * Math.min(1, dt * 20);
      p.y += (p.ty - p.y) * Math.min(1, dt * 20);
    }
  }

  private tryDash(dir: "up" | "down" | "left" | "right"): void {
    const p = this.player;
    if (p.dashCd > 0) return;
    const dx = dir === "left" ? -1 : dir === "right" ? 1 : 0;
    const dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
    p.dashDirX = dx;
    p.dashDirY = dy;
    p.dashCd = DASH_CD * this.getEquipDashCdMul(); // v3：装备闪避冷却加成
    p.dashInvincibleUntil = this.t + DASH_INVINCIBLE;
    p.dashActiveUntil = this.t + DASH_DURATION;
    // 立即位移
    const moveSpeedMul = (1 + this.getBuffStack("moveSpeedUp") * 0.15) * this.getEquipMoveSpeedMul();
    const dist = DASH_DISTANCE * moveSpeedMul;
    p.tx = clamp(p.tx + dx * dist, SHIP_R, W - SHIP_R);
    p.ty = clamp(p.ty + dy * dist, H * 0.5, H - SHIP_R);
    // 视觉
    this.particles.spawnBurst(p.x, p.y, "#00E5FF", { ring: true, sparks: 12, dots: 10, speed: 180, life: 0.4, size: 3 });
    postFX.flash("#00E5FF", 0.15, 2);
    playSfx("good");
  }

  // ===== v2 升级：释放蓄力射击（A4） =====
  private releaseCharge(): void {
    const p = this.player;
    if (!p.charging) return;
    const progress = p.chargeProgress;
    p.charging = false;
    p.chargeProgress = 0;
    if (progress < 0.25) return; // 蓄力不足，不发射
    const baseDmg = (10 + this.effectiveWeapon() * 2);
    const dmg = Math.round(baseDmg * CHARGE_DMG_MULTIPLIER * progress);
    // 蓄满 → 范围爆炸；未蓄满 → 单发强力弹
    if (progress >= 1) {
      // 范围爆炸：对屏幕上所有敌人/BOSS 造成伤害
      this.spawnShock(p.x, p.y, CHARGE_RADIUS * 1.5, "#FFD666", 5);
      this.particles.spawnBurst(p.x, p.y - 20, "#FFD666", { ring: true, sparks: 24, dots: 30, speed: 320, life: 0.8, size: 5, color2: "#FF7A1A" });
      postFX.flash("#FFD666", 0.4, 2);
      postFX.shake(6, 10);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < CHARGE_RADIUS) {
          e.hp -= dmg;
          e.hitFlash = 0.15;
          if (e.hp <= 0) this.killEnemy(i, false);
        }
      }
      if (this.boss && this.t >= this.boss.enterUntil) {
        const d = Math.hypot(this.boss.x - p.x, this.boss.y - p.y);
        if (d < CHARGE_RADIUS * 1.3) {
          this.boss.hp -= dmg;
          this.boss.hitFlash = 0.2;
          if (this.boss.hp <= 0) this.killBoss();
        }
      }
      playSfx("bomb");
    } else {
      // 单发强力穿透弹
      this.bullets.push({
        x: p.x, y: p.y - 20, vx: 0, vy: -800,
        damage: dmg, color: "#FFD666", size: 8, from: "player", life: 2,
        pierce: true, hitCd: 0,
      });
      this.particles.spawnBeam(p.x, p.y - 20, -Math.PI / 2, "#FFD666", { len: 500, life: 0.3, size: 8 });
      playSfx("laser");
    }
  }

  // ===== v2 升级：大招 - 雷霆审判（A5） =====
  /** 累积大招充能（玩家造成伤害时调用） */
  private chargeUltimate(amount: number): void {
    if (this.player.ultActiveUntil > this.t) return; // 大招期间不再累积
    const mul = this.difficultyCfg.ultChargeMul * (1 + this.getBuffStack("ultBoost") * 0.3) * this.getEquipUltChargeMul();
    const before = this.player.ultCharge;
    this.player.ultCharge = Math.min(ULTIMATE_MAX_CHARGE, this.player.ultCharge + amount * mul);
    // v4 升级：大招首次充满 → 切换至 ultReady 氛围曲（一次性提示）
    if (!this.ultReadyAnnounced && before < ULTIMATE_MAX_CHARGE && this.player.ultCharge >= ULTIMATE_MAX_CHARGE) {
      this.ultReadyAnnounced = true;
      this.bgmBeforeUlt = this.currentBgm;
      this.switchBgm("ultReady");
    }
  }

  /** 释放雷霆审判（公开 API，由场景大招按钮调用） */
  triggerUltimate(): void { this.useUltimate(); }

  useUltimate(): void {
    const p = this.player;
    if (p.ultCharge < ULTIMATE_MAX_CHARGE || p.ultActiveUntil > this.t) return;
    p.ultCharge = 0;
    p.ultActiveUntil = this.t + ULTIMATE_DURATION;
    this.ultActiveUntilPrev = p.ultActiveUntil; // v4：记录大招结束时刻，用于检测结束后恢复 BGM
    this.shakeUntil = this.t + 0.6;
    postFX.flash("#FF00E5", 0.6, 2);
    postFX.glitch(0.8, 4);
    postFX.shake(14, 20);
    this.spawnShock(W / 2, H / 2, 400, "#FF00E5", 7);
    this.spawnShock(W / 2, H / 2, 280, "#FFD666", 5);
    this.particles.spawnBurst(W / 2, H / 2, "#FF00E5", { ring: true, sparks: 40, dots: 50, speed: 500, life: 1.2, size: 6, color2: "#FFD666" });
    // 立即清空敌方弹幕
    this.bullets = this.bullets.filter((b) => b.from !== "enemy");
    playSfx("bomb");
    this.toast = { text: "⚡ 雷霆审判启动！全屏持续伤害 4 秒", tone: "good", until: this.t + 2.5 };
    this.emitHud();
  }

  /** v4 升级：检测大招结束并恢复 BGM + 重置就绪标志（每帧由 update 调用） */
  private updateUltBgmState(): void {
    // 大招刚结束：恢复之前的 BGM
    if (this.ultActiveUntilPrev > 0 && this.t >= this.ultActiveUntilPrev && this.currentBgm === "ultReady") {
      this.ultActiveUntilPrev = 0;
      this.ultReadyAnnounced = false;
      // 恢复到当前应有曲目（BOSS 战中→bossBattle，否则 battle）
      const target: BgmName = this.boss && this.boss.entranceStage === "done" ? "bossBattle" : "battle";
      this.switchBgm(target);
    }
  }

  // ===== v2 升级：Roguelike Buff 池（A3） =====
  /** 进入 Roguelike 选择阶段（每波结束触发，与分支增援并存） */
  private enterRoguelike(nextWaveIdx: number): void {
    // 分支增援阶段（wave 1/4）不触发 Roguelike，避免冲突
    if (this.wave === 1 || this.wave === 4) return;
    this.roguelikeNextWave = nextWaveIdx;
    this.phase = "roguelike";
    this.waveActive = false;
    this.roguelikeOptions = this.rollRoguelikeOptions();
    postFX.flash("#FFD666", 0.3, 2);
    playSfx("good");
    this.emitHud();
  }

  /** 随机抽取 2 个 Roguelike 选项 */
  private rollRoguelikeOptions(): RoguelikeOption[] {
    const pool: RoguelikeBuffKind[] = [];
    // 按稀有度加权抽取
    for (let i = 0; i < 2; i++) {
      const r = this.rng();
      let rarity: "common" | "rare" | "epic" = "common";
      if (r < ROGUELIKE_RARITY_WEIGHTS.epic) rarity = "epic";
      else if (r < ROGUELIKE_RARITY_WEIGHTS.epic + ROGUELIKE_RARITY_WEIGHTS.rare) rarity = "rare";
      const candidates = ROGUELIKE_POOL_BY_RARITY[rarity].filter((k) => {
        const def = ROGUELIKE_BUFFS[k];
        if (!def.stackable) {
          // 不可叠加的，已拥有则不再出现
          return !this.roguelikeBuffs.some((b) => b.kind === k);
        }
        // 可叠加的，未达最大层数可出现
        const cur = this.getBuffStack(k);
        return cur < (def.maxStack ?? 1);
      });
      const pick = candidates.length > 0 ? candidates[Math.floor(this.rng() * candidates.length)] : ROGUELIKE_POOL_BY_RARITY.common[Math.floor(this.rng() * ROGUELIKE_POOL_BY_RARITY.common.length)];
      if (!pool.includes(pick)) pool.push(pick);
    }
    return pool.map((kind) => {
      const def = ROGUELIKE_BUFFS[kind];
      const cur = this.getBuffStack(kind);
      return {
        kind: def.kind, name: def.name, emoji: def.emoji, desc: def.desc, color: def.color, rarity: def.rarity,
        currentStack: cur, maxStack: def.maxStack,
      };
    });
  }

  /** 玩家选择 Roguelike Buff（由场景调用） */
  chooseRoguelike(kind: RoguelikeBuffKind): void {
    if (this.phase !== "roguelike") return;
    const def = ROGUELIKE_BUFFS[kind];
    if (!def) return;
    const existing = this.roguelikeBuffs.find((b) => b.kind === kind);
    if (existing) {
      if (def.stackable) existing.stack = Math.min(def.maxStack ?? 99, existing.stack + 1);
    } else {
      this.roguelikeBuffs.push({ kind: def.kind, name: def.name, emoji: def.emoji, color: def.color, stack: 1 });
    }
    this.toast = { text: `${def.emoji} 获得 ${def.name}${def.stackable ? ` ×${this.getBuffStack(kind)}` : ""}`, tone: "good", until: this.t + 2 };
    postFX.flash(def.color, 0.4, 2);
    this.particles.spawnBurst(this.player.x, this.player.y, def.color, { ring: true, sparks: 18, dots: 22, speed: 240, life: 0.8, size: 4 });
    playSfx("good");
    // 进入下一波
    this.phase = "battle";
    this.startWave(this.roguelikeNextWave, 2.0);
  }

  /** 获取指定 buff 的当前叠加层数 */
  private getBuffStack(kind: RoguelikeBuffKind): number {
    const b = this.roguelikeBuffs.find((x) => x.kind === kind);
    return b ? b.stack : 0;
  }

  // ===== v2 升级：暂停 / 重开（D4） =====
  pause(): void {
    if (this.over) return;
    super.pause();
    this.emitHud();
  }
  resume(): void {
    if (this.over) return;
    super.resume();
    this.emitHud();
  }

  // ===== v2 升级：难度/模式/主题访问器 =====
  getDifficulty(): DifficultyConfig { return this.difficultyCfg; }
  getMode(): ThunderMode { return this.opts.mode; }
  getTheme(): ThunderThemeDef { return this.currentTheme; }
  isEndless(): boolean { return this.endless; }
  getSave(): ThunderSaveData { return this.save; }

  private startWave(idx: number, prep: number): void {
    this.wave = idx;
    this.waveActive = false;
    this.prepUntil = this.t + prep;
    // v3：社区民警被动 — 每波开始回血（上一波清场的奖励）
    if (idx > 0) {
      for (const passive of this.character.passives) {
        if (passive.kind === "hpRegenWave" && passive.value) {
          const before = this.player.hp;
          this.player.hp = Math.min(MAX_HP, this.player.hp + passive.value);
          if (this.player.hp > before) {
            this.particles.spawnText(this.player.x, this.player.y - 30, `+${this.player.hp - before}`, "#52C41A", { size: 14, life: 0.8 });
          }
          break;
        }
      }
    }
    // v2 升级：主题切换（C3）— 每波根据 themeForWave 更新
    const newTheme = themeForWave(idx);
    if (newTheme !== this.currentTheme) {
      this.currentTheme = newTheme;
      this.phaseTransitionText = `${newTheme.emoji} ${newTheme.name}`;
      this.phaseTransitionUntil = this.t + 1.5;
      postFX.flash(newTheme.nebulaColors[0].startsWith("#") ? newTheme.nebulaColors[0] : `#${newTheme.nebulaColors[0]}`, 0.3, 2);
    }
    // v2 升级：无尽模式动态波次生成（A1）— idx >= WAVES.length 时自动生成
    // v5 升级：生存模式使用专属波次生成器（向保护目标推进的密集波次）
    let wave: WaveEntry[];
    if (this.opts.mode === "survival") {
      this.endless = true;
      this.endlessScale = 1 + idx * 0.12;
      wave = generateSurvivalWave(idx, this.rng);
    } else if (idx >= WAVES.length) {
      this.endless = true;
      this.endlessScale = 1 + (idx - WAVES.length + 1) * 0.15;
      wave = generateEndlessWave(idx, this.rng);
    } else {
      wave = WAVES[idx];
    }
    if (!wave) return;
    this.spawnQueue = [];
    for (const entry of wave) {
      const def = ENEMIES[entry.typeId];
      if (!def) continue;
      for (let i = 0; i < entry.count; i++) {
        this.spawnQueue.push({
          typeId: entry.typeId,
          at: this.prepUntil + entry.delay + i * entry.interval,
          spawned: false,
        });
      }
    }
    if (idx > 0) {
      const waveLabel = this.endless ? `无尽波次 ${idx + 1 - WAVES.length}` : `反诈波次 ${idx + 1}`;
      this.toast = {
        text: `${waveLabel}：${Array.from(new Set(wave.map((e) => ENEMIES[e.typeId].name))).join(" / ")}`,
        tone: "info",
        until: this.t + 2.5,
      };
      postFX.flash(ACCENT, 0.2, 2);
      this.particles.spawn({ x: W / 2, y: 40, count: 1, speed: 0, life: 0.8, size: 30, color: ACCENT, type: "ring", ringWidth: 3 });
    }
    this.checkAchievements();
    this.emitHud();
  }

  /** 进入分支增援选择阶段 */
  private enterBranch(nextWaveIdx: number): void {
    this.branchNextWave = nextWaveIdx;
    this.branchRound += 1;
    this.phase = "branch";
    this.waveActive = false;
    // 固定 3 个选项（顺序固定，便于场景渲染）
    this.branchOptions = [
      { id: "weapon", emoji: "🔫", title: "武器升级", desc: "武器等级 +1（封顶 4 级）", color: "#FFB020" },
      { id: "shield", emoji: "🛡", title: "护盾补给", desc: "HP +10 · 反诈APP护盾 +2", color: "#1AD670" },
      { id: "tactical", emoji: "⚡", title: "战术优势", desc: "公安突击 +1 · 开局 6 秒时间减速", color: "#B388FF" },
    ];
    this.phaseTransitionText = `BRANCH · 增援路线 ${this.branchRound}/2`;
    this.phaseTransitionUntil = this.t + 1.5;
    postFX.flash("#FF00E5", 0.3, 2);
    playSfx("good");
    this.emitHud();
  }

  /**
   * 玩家选择分支增援
   * 由场景调用：根据选项 id 应用 buff，然后进入下一波
   */
  chooseBranch(optionId: BranchOption["id"]): void {
    if (this.phase !== "branch") return;
    const opt = this.branchOptions.find((o) => o.id === optionId);
    if (!opt) return;
    if (optionId === "weapon") {
      // 武器升级（封顶 4）
      const newW = Math.min(4, this.player.weapon + 1) as WeaponLevel;
      this.player.weapon = newW;
      this.player.weaponXp = 0;
      this.toast = { text: `🔫 武器升级至 Lv.${newW}`, tone: "good", until: this.t + 2.5 };
    } else if (optionId === "shield") {
      // 护盾补给
      this.player.hp = Math.min(MAX_HP, this.player.hp + 10);
      this.player.appCharges += 2;
      this.toast = { text: `🛡 HP +10 · 护盾 +2`, tone: "good", until: this.t + 2.5 };
    } else if (optionId === "tactical") {
      // 战术优势
      this.player.raids += 1;
      this.player.slowMoUntil = this.t + 6;
      this.toast = { text: `⚡ 公安突击 +1 · 6 秒减速`, tone: "good", until: this.t + 2.5 };
    }
    postFX.flash(opt.color, 0.4, 2);
    this.particles.spawnBurst(this.player.x, this.player.y, opt.color, { ring: true, sparks: 18, dots: 20, speed: 240, life: 0.8, size: 4 });
    playSfx("good");
    // 进入下一波
    this.phase = "battle";
    this.startWave(this.branchNextWave, 2.5);
  }

  private spawnEnemy(typeId: string): void {
    const def = ENEMIES[typeId];
    if (!def) return;
    const x = 40 + this.rng() * (W - 80);
    // v2 升级：应用难度乘子 + 无尽模式缩放
    const hpMul = this.difficultyCfg.enemyHpMul * this.endlessScale;
    const speedMul = this.difficultyCfg.enemySpeedMul * (this.endless ? 1 + (this.endlessScale - 1) * 0.5 : 1);
    const fireMul = this.difficultyCfg.enemyFireMul;
    // v5 周常修饰符：fastEnemy 提速 / eliteFlood 全精英
    const wkly = this.weeklyModifier;
    const speedBoost = wkly.kind === "fastEnemy" ? (wkly.value ?? 1.5) : 1;
    const fireBoost = wkly.kind === "fastEnemy" ? 0.7 : 1; // 0.7 = 频率 +30%
    const eliteFlood = wkly.kind === "eliteFlood";
    const hp = Math.round(def.hp * hpMul);
    const baseShield = def.shield ? Math.round(def.shield * hpMul) : 0;
    const shield = eliteFlood ? Math.max(baseShield, Math.round(def.hp * 0.5 * hpMul)) : baseShield;
    this.enemies.push({
      uid: this.uidSeq++,
      def,
      x,
      y: -30,
      vx: 0,
      vy: def.speed * speedMul * speedBoost,
      hp,
      maxHp: hp,
      shootCd: (def.shootInterval ?? 0) * fireMul * fireBoost,
      phase: 0,
      born: this.t,
      hitFlash: 0,
      shield,
      maxShield: shield,
      shieldFlash: 0,
    });
  }

  /** 公安反诈突击（替代旧 bomb，更名但保留按钮入口） */
  useBomb(): void {
    this.useRaid();
  }

  useRaid(): void {
    if (this.over || this.player.raids <= 0) return;
    this.player.raids -= 1;
    this.raidFlashUntil = this.t + 0.6;
    this.shakeUntil = this.t + 0.4;
    postFX.flash("#FF7A1A", 0.6, 2);
    postFX.shake(12, 18);
    postFX.glitch(0.7, 4);
    // 中心冲击波 + 粒子爆裂
    this.spawnShock(W / 2, H / 2, 320, "#FF7A1A", 6);
    this.spawnShock(W / 2, H / 2, 220, "#FFD666", 4);
    this.particles.spawnBurst(W / 2, H / 2, "#FF7A1A", { ring: true, sparks: 28, dots: 36, speed: 420, life: 1, size: 5, color2: "#FFD666" });
    // 清空敌方弹幕
    for (const b of this.bullets) {
      if (b.from === "enemy") {
        this.particles.spawn({ x: b.x, y: b.y, count: 4, speed: 120, life: 0.3, size: 2, color: "#FF7A1A" });
      }
    }
    this.bullets = this.bullets.filter((b) => b.from !== "enemy");
    // 重创所有敌人
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hp -= 200;
      e.hitFlash = 0.15;
      if (e.hp <= 0) this.killEnemy(i, true);
    }
    // 重创 BOSS
    if (this.boss) {
      this.boss.hp -= 260;
      this.boss.hitFlash = 0.2;
      this.particles.spawn({ x: this.boss.x, y: this.boss.y, count: 30, speed: 280, life: 0.8, size: 4, color: "#FFD666" });
    }
    playSfx("bomb");
    this.emitHud();
  }

  private spawnShock(x: number, y: number, maxR: number, color: string, width: number): void {
    this.shocks.push({ x, y, r: 0, maxR, life: 0.5, maxLife: 0.5, color, width });
  }

  protected update(dt: number): void {
    this.t += dt;
    this.particles.update(dt);
    this.updateFloats(dt);
    this.updateShocks(dt);

    if (this.over) return;
    // v2 升级：暂停时冻结所有逻辑（D4）
    if (this.isPaused) return;

    // v6 升级：统一更新 v6 系统（格挡冷却/口诀到期/AI 对话触发/组合弹幕）
    this.updateV6Systems(dt);
    // v7 升级：统一更新 v7 系统（自适应难度/程序化弹幕/证书检查）
    this.updateV7Systems(dt);

    // 时间减速：仅影响敌方/BOSS/弹幕运动，玩家正常
    const slowFactor = (this.t < this.player.slowMoUntil) ? 0.3 : 1.0;
    const adjDt = dt * slowFactor;

    // 击打感：hitstop 期间冻结敌方/BOSS/弹幕，但粒子继续
    const inHitstop = this.t < this.hitstopUntil;
    if (inHitstop) {
      // 仅更新玩家移动与自动开火
      this.applyKeyboardMove(dt);
      const p = this.player;
      p.x += (p.tx - p.x) * Math.min(1, dt * 12);
      p.y += (p.ty - p.y) * Math.min(1, dt * 12);
      p.fireCd -= dt;
      if (p.fireCd <= 0) {
        p.fireCd = this.fireRateFor(this.effectiveWeapon());
        this.firePlayerBullets();
      }
      this.updateBullets(adjDt);
      return;
    }

    // v2 升级：分支/Roguelike 选择阶段：暂停游戏逻辑，玩家可移动
    if (this.phase === "branch" || this.phase === "roguelike") {
      this.applyKeyboardMove(dt);
      const p = this.player;
      p.x += (p.tx - p.x) * Math.min(1, dt * 12);
      p.y += (p.ty - p.y) * Math.min(1, dt * 12);
      // v2 升级：蓄力进度 + 闪避冷却仍更新（选择阶段也可操作）
      this.updateChargeDash(dt);
      return;
    }

    // 受击高光衰减
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.shieldFlash > 0) e.shieldFlash -= dt;
    }
    if (this.boss && this.boss.hitFlash > 0) this.boss.hitFlash -= dt;

    // 方向键输入 → 更新目标位置
    this.applyKeyboardMove(dt);
    // Player movement
    const p = this.player;
    p.x += (p.tx - p.x) * Math.min(1, dt * 12);
    p.y += (p.ty - p.y) * Math.min(1, dt * 12);

    // v2 升级：蓄力进度 + 闪避冷却
    this.updateChargeDash(dt);

    // v3：装备每秒回血
    const hpRegen = this.getEquipHpRegen();
    if (hpRegen > 0 && p.hp < MAX_HP) {
      this._regenAcc = (this._regenAcc ?? 0) + hpRegen * dt;
      if (this._regenAcc >= 1) {
        const heal = Math.floor(this._regenAcc);
        this._regenAcc -= heal;
        p.hp = Math.min(MAX_HP, p.hp + heal);
      }
    }

    // v4：影子挑战 — 采样玩家操作 + 更新进度
    this.updateGhostSampling(dt);

    // v4 升级：动态 BGM — 检测大招结束并恢复曲目
    this.updateUltBgmState();

    // v4：BossRush 模式 — 休息结束后启动下一阶段
    if (this.bossRushNextStageAt > 0 && this.t >= this.bossRushNextStageAt) {
      const idx = this.bossRushNextStageIdx;
      this.bossRushNextStageAt = 0;
      this.bossRushNextStageIdx = -1;
      this.startBossRushStage(idx, 0.5);
      return;
    }

    // Auto fire（蓄力时不自动开火）
    if (!p.charging) {
      p.fireCd -= dt;
      if (p.fireCd <= 0) {
        p.fireCd = this.fireRateFor(this.effectiveWeapon());
        this.firePlayerBullets();
      }
    }

    if (this.t > this.comboUntil) this.combo = 0;

    // Wave management
    if (!this.waveActive && this.t >= this.prepUntil) {
      this.waveActive = true;
    }
    if (this.waveActive && this.phase === "battle") {
      for (const s of this.spawnQueue) {
        if (!s.spawned && this.t >= s.at) {
          s.spawned = true;
          this.spawnEnemy(s.typeId);
        }
      }
      const allSpawned = this.spawnQueue.every((s) => s.spawned);
      if (allSpawned && this.enemies.length === 0) {
        // v2 升级：波次完成流程
        // - idx 3 (Wave 4) 清空 → 随机 BOSS
        // - idx 5 (Wave 6) 清空 → 终极 BOSS
        // - idx 9 (Wave 10) 清空 → 终极 BOSS（后转无尽）
        // - idx 1/4 (Wave 2/5) 清空 → 分支增援
        // - idx 2/6/7/8 (Wave 3/7/8/9) 清空 → Roguelike Buff 选择
        // - 无尽模式每 5 波（idx 14,19,24...）→ BOSS
        if (this.wave === 3) {
          this.spawnBoss(false);
        } else if (this.wave === 5) {
          this.spawnBoss(true);
        } else if (this.endless && (this.wave - WAVES.length + 1) % 5 === 0) {
          // 无尽模式每 5 波 BOSS
          this.spawnBoss(true);
        } else if (!this.endless && (this.wave + 1) % 10 === 0) {
          // 第 10 波 BOSS
          this.spawnBoss(true);
        } else if (this.wave === 1 || this.wave === 4) {
          // 分支增援选择
          this.enterBranch(this.wave + 1);
        } else if ([2, 6, 7, 8].includes(this.wave) || (this.endless && (this.wave - WAVES.length + 1) % 5 !== 0 && (this.wave - WAVES.length + 1) % 3 === 0)) {
          // Roguelike Buff 选择（战役 wave 3/7/8/9 + 无尽每 3 波）
          this.enterRoguelike(this.wave + 1);
        } else {
          // 直接进入下一波
          this.startWave(this.wave + 1, 2.5);
        }
      }
    }

    // 注：分支选择阶段已在 update() 开头 early-return，此处不会到达 branch 阶段

    const frozen = this.t < this.freezeUntil;
    this.updateEnemies(adjDt, frozen);
    this.updateBoss(adjDt, frozen);
    this.updateLaserSweep(dt);
    this.updateBullets(adjDt);
    this.updatePowerups(dt);
    // v5 无人机更新
    this.updateDrones(adjDt, frozen);
    // v5 生存模式：保护目标更新
    this.updateSurvivalTarget(adjDt, frozen);
    // v2 升级：大招 - 雷霆审判持续伤害（A5）
    if (this.player.ultActiveUntil > this.t) {
      const ultDmg = ULTIMATE_DPS * dt;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        this.enemies[i].hp -= ultDmg;
        this.enemies[i].hitFlash = 0.1;
        if (this.enemies[i].hp <= 0) this.killEnemy(i, true);
      }
      if (this.boss && this.boss.entranceStage === "done") {
        this.boss.hp -= ultDmg;
        this.boss.hitFlash = 0.1;
        if (this.boss.hp <= 0) this.killBoss();
      }
      // 大招期间持续视觉
      if (Math.random() < 0.3) {
        const px = this.rng() * W;
        const py = 100 + this.rng() * (H - 200);
        this.particles.spawnBurst(px, py, "#FF00E5", { sparks: 6, dots: 8, speed: 200, life: 0.5, size: 3, color2: "#FFD666" });
        this.spawnShock(px, py, 50, "#FF00E5", 3);
      }
      postFX.flash("#FF00E5", 0.15, 6);
    }
    // 银行止付：持续扣敌方血（每秒）
    if (this.t < this.player.bankFreezeUntil) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        this.enemies[i].hp -= 10 * dt;
        if (this.enemies[i].hp <= 0) this.killEnemy(i, true);
      }
      if (this.boss) this.boss.hp -= 15 * dt;
    }
    // 反诈宣传员：自动拾取道具
    if (this.t < this.player.adUntil) {
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        const dx = pu.x - this.player.x;
        const dy = pu.y - this.player.y;
        if (Math.hypot(dx, dy) < 120) {
          // 磁吸效果
          pu.x += (this.player.x - pu.x) * dt * 8;
          pu.y += (this.player.y - pu.y) * dt * 8;
          if (Math.hypot(dx, dy) < SHIP_R + 16) {
            this.applyPowerup(pu.kind);
            this.powerups.splice(i, 1);
            playSfx("pickup");
          }
        }
      }
    }
    // v2 升级：护盾再生（Roguelike shieldRegen）
    if (this.getBuffStack("shieldRegen") > 0) {
      this.player.shieldRegenTimer += dt;
      const interval = 10 / this.getBuffStack("shieldRegen");
      if (this.player.shieldRegenTimer >= interval && this.player.appCharges < 3) {
        this.player.shieldRegenTimer = 0;
        this.player.appCharges += 1;
        this.particles.spawnBurst(this.player.x, this.player.y, "#00E5FF", { ring: true, sparks: 10, dots: 8, speed: 180, life: 0.5, size: 3 });
        this.toast = { text: "🛡 护盾再生 +1", tone: "good", until: this.t + 1.5 };
      }
    }
    this.checkCollisions();
    // 武器分支掉落：每 500 分自动触发（新增）
    if (this.score >= this.lastWeaponDropScore + 500) {
      this.lastWeaponDropScore += 500;
      this.grantWeaponBranchDrop();
    }
  }

  /** 武器分支掉落：首次自动选取，后续升级/循环切换（新增） */
  private grantWeaponBranchDrop(): void {
    const p = this.player;
    const branches: Exclude<WeaponBranch, "normal">[] = ["spread", "laser", "homing"];
    let awakened = false;
    if (p.weaponBranch === "normal") {
      // 首次：自动选取散射
      p.weaponBranch = "spread";
      p.weaponBranchLevel = 1;
    } else if (p.weaponBranchLevel < 3) {
      // 升级当前分支
      p.weaponBranchLevel = (p.weaponBranchLevel + 1) as WeaponBranchLevel;
    } else if (p.weaponBranchLevel === 3 && this.canAwakenCurrentBranch()) {
      // v3：觉醒到 4 级
      p.weaponBranchLevel = 4;
      awakened = true;
    } else if (p.weaponBranchLevel === 4) {
      // v3：觉醒 4 → 5
      p.weaponBranchLevel = 5;
      awakened = true;
    } else if (p.weaponBranchLevel === 5 && this.canSuperAwakenCurrentBranch(6)) {
      // v6：超觉醒 5 → 6
      p.weaponBranchLevel = 6;
      awakened = true;
    } else if (p.weaponBranchLevel === 6 && this.canSuperAwakenCurrentBranch(7)) {
      // v6：超觉醒 6 → 7
      p.weaponBranchLevel = 7;
      awakened = true;
    } else {
      // 已满级（7 或无法觉醒）：循环切换到下一分支
      const idx = branches.indexOf(p.weaponBranch as Exclude<WeaponBranch, "normal">);
      const next = branches[(idx + 1) % branches.length];
      p.weaponBranch = next;
      p.weaponBranchLevel = 1;
    }
    const def = WEAPON_BRANCHES[p.weaponBranch as Exclude<WeaponBranch, "normal">];
    // v6 升级：超觉醒（6/7 级）独立特效分支
    if (awakened && (p.weaponBranchLevel === 6 || p.weaponBranchLevel === 7)) {
      this.refreshSuperAwakening();
      const sa = this.superAwakening;
      if (sa) {
        this.toast = { text: `${sa.emoji} 超觉醒！${sa.name}`, tone: "good", until: this.t + 3.5 };
        this.awakeningToast = { name: sa.name, mantra: sa.mantra, emoji: sa.emoji, until: this.t + 4 };
        this.mantraTexts.push({ text: sa.mantra, until: this.t + 4 });
        if (this.mantraTexts.length > 6) this.mantraTexts.shift();
        if (!this.save.superAwakenedBranches.includes(p.weaponBranch)) {
          this.save.superAwakenedBranches.push(p.weaponBranch);
        }
        playSfx("achievement");
        postFX.flash("#FF00E5", 0.8, 4);
        postFX.glitch(1.0, 4);
        postFX.shake(14, 18);
        this.particles.spawnBurst(p.x, p.y, "#FF00E5", { ring: true, sparks: 50, dots: 60, speed: 440, life: 1.4, size: 6, color2: "#FFD700" });
        this.spawnShock(p.x, p.y, 280, "#FFD700", 7);
        this.spawnShock(p.x, p.y, 200, "#FF00E5", 6);
      }
    } else if (awakened) {
      // v3：觉醒特效
      const awaken = this.currentAwakening();
      if (awaken) {
        this.toast = { text: `${awaken.emoji} 觉醒！${awaken.name}`, tone: "good", until: this.t + 3 };
        // v4 升级：修复 until 字段（之前缺失导致 HUD 永远不显示觉醒 toast）
        this.awakeningToast = { name: awaken.name, mantra: awaken.mantra, emoji: awaken.emoji, until: this.t + 3.5 };
        // 觉醒口诀飘字
        this.mantraTexts.push({ text: awaken.mantra, until: this.t + 3.5 });
        // 记录到存档（永久觉醒）
        if (!this.save.awakenedBranches.includes(p.weaponBranch)) {
          this.save.awakenedBranches.push(p.weaponBranch);
        }
        playSfx("achievement");
        postFX.flash(awaken.emoji ? "#FF00E5" : def.color, 0.6, 3);
        postFX.glitch(0.6, 3); // v4 升级：觉醒 glitch 强化电影感
        postFX.shake(10, 14); // v4 升级：震屏增强
        this.particles.spawnBurst(p.x, p.y, "#FF00E5", { ring: true, sparks: 30, dots: 36, speed: 320, life: 1.2, size: 5, color2: def.color });
        // v4 升级：增加金色冲击波环，强化觉醒仪式感
        this.spawnShock(p.x, p.y, 200, "#FFD666", 6);
        this.spawnShock(p.x, p.y, 140, "#FF00E5", 5);
      } else {
        this.toast = { text: `${def.emoji} ${def.name} Lv.${p.weaponBranchLevel}`, tone: "good", until: this.t + 2 };
        playSfx("weaponUp");
        postFX.flash(def.color, 0.3, 2);
        this.particles.spawnBurst(p.x, p.y, def.color, { ring: true, sparks: 16, dots: 20, speed: 200, life: 0.8, size: 4 });
      }
    } else {
      this.toast = { text: `${def.emoji} ${def.name} Lv.${p.weaponBranchLevel}`, tone: "good", until: this.t + 2 };
      playSfx("weaponUp");
      postFX.flash(def.color, 0.3, 2);
      this.particles.spawnBurst(p.x, p.y, def.color, { ring: true, sparks: 16, dots: 20, speed: 200, life: 0.8, size: 4 });
    }
    this.persistSave();
    this.emitHud();
  }

  /** v3：当前分支是否可觉醒（3 级 + 击败过 BOSS） */
  private canAwakenCurrentBranch(): boolean {
    const p = this.player;
    if (p.weaponBranch === "normal") return false;
    if (p.weaponBranchLevel < 3) return false;
    // 永久觉醒条件：累计击败 1 个 BOSS
    return this.save.totalBossKills >= 1;
  }

  /** v6：判断当前武器分支是否可超觉醒到指定等级（6 或 7） */
  private canSuperAwakenCurrentBranch(targetLevel: 6 | 7): boolean {
    if (!this.enableSuperAwakening) return false;
    const p = this.player;
    if (p.weaponBranch === "normal") return false;
    if (p.weaponBranchLevel < 5) return false;
    // 超觉醒定义必须存在
    const def = getSuperAwakening(p.weaponBranch, targetLevel);
    if (!def) return false;
    // 6 级：需已 5 级 + 累计击败 3 个 BOSS
    if (targetLevel === 6) {
      return this.save.totalBossKills >= 3;
    }
    // 7 级：需已 6 级 + 累计击败 6 个 BOSS
    if (targetLevel === 7) {
      return this.save.totalBossKills >= 6;
    }
    return false;
  }

  private effectiveWeapon(): WeaponLevel {
    return this.t < this.player.awarenessUntil ? 4 : this.player.weapon;
  }

  /** 方向键输入：直接更新 player.tx/ty（与拖拽共存，按下时优先于拖拽） */
  private applyKeyboardMove(dt: number): void {
    const k = this.keys;
    if (!k.up && !k.down && !k.left && !k.right) return;
    let dx = 0;
    let dy = 0;
    if (k.left) dx -= 1;
    if (k.right) dx += 1;
    if (k.up) dy -= 1;
    if (k.down) dy += 1;
    const len = Math.hypot(dx, dy);
    if (len <= 0) return;
    // 对角线归一化
    dx /= len;
    dy /= len;
    const speed = 420 * this.getEquipMoveSpeedMul(); // v3：装备移速加成
    const moveX = dx * speed * dt;
    const moveY = dy * speed * dt;
    const p = this.player;
    p.tx = clamp(p.tx + moveX, SHIP_R, W - SHIP_R);
    p.ty = clamp(p.ty + moveY, H * 0.5, H - SHIP_R);
  }

  private fireRateFor(weapon: WeaponLevel): number {
    return 0.18 - weapon * 0.015;
  }

  private firePlayerBullets(): void {
    const p = this.player;
    // 武器分支（新增）：优先使用分支武器
    if (p.weaponBranch !== "normal" && p.weaponBranchLevel > 0) {
      switch (p.weaponBranch) {
        case "spread": this.fireSpread(); return;
        case "laser": this.fireLaser(); return;
        case "homing": this.fireHoming(); return;
      }
    }
    const aware = this.t < p.awarenessUntil;
    const dmg = (10 + this.effectiveWeapon() * 2) * (aware ? 2 : 1);
    const col = aware ? "#FF5A60" : ACCENT;
    const speed = 700;
    const shots: { x: number; vx: number }[] = [];
    switch (this.effectiveWeapon()) {
      case 1:
        shots.push({ x: p.x, vx: 0 });
        break;
      case 2:
        shots.push({ x: p.x - 8, vx: 0 });
        shots.push({ x: p.x + 8, vx: 0 });
        break;
      case 3:
        shots.push({ x: p.x, vx: 0 });
        shots.push({ x: p.x - 14, vx: -60 });
        shots.push({ x: p.x + 14, vx: 60 });
        break;
      case 4:
        shots.push({ x: p.x - 6, vx: 0 });
        shots.push({ x: p.x + 6, vx: 0 });
        shots.push({ x: p.x - 16, vx: -100 });
        shots.push({ x: p.x + 16, vx: 100 });
        break;
    }
    for (const s of shots) {
      this.bullets.push({
        x: s.x,
        y: p.y - 20,
        vx: s.vx,
        vy: -speed,
        damage: dmg,
        color: col,
        size: 4,
        from: "player",
        life: 2,
      });
    }
    playSfx("shoot");
  }

  /** 散射武器（新增）：3/5/7 向散射，覆盖广，单发伤害 60% */
  private fireSpread(): void {
    const p = this.player;
    const aware = this.t < p.awarenessUntil;
    const baseDmg = (10 + this.effectiveWeapon() * 2) * (aware ? 2 : 1);
    const dmg = Math.round(baseDmg * 0.6);
    const col = aware ? "#FF5A60" : "#FFB020";
    const speed = 680;
    const lvl = p.weaponBranchLevel;
    // v3：觉醒等级扩展弹幕数
    let n: number;
    let spread: number;
    let size = 4;
    let homing = false;
    if (lvl <= 1) { n = 3; spread = 0.26; }
    else if (lvl === 2) { n = 5; spread = 0.52; }
    else if (lvl === 3) { n = 7; spread = 0.78; }
    else if (lvl === 4) { n = 9; spread = 0.9; size = 6; } // 风暴散射
    else { n = 11; spread = 1.05; size = 7; homing = true; } // 反诈风暴
    // v3：装备额外多发
    n += this.getEquipMultishot();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = -Math.PI / 2 + (t - 0.5) * spread;
      this.bullets.push({
        x: p.x, y: p.y - 20,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        damage: dmg, color: col, size, from: "player", life: 2,
        homing: homing || undefined, hitCd: homing ? 0 : undefined,
      });
    }
    playSfx("shoot");
  }

  /** 激光武器（新增）：穿透光束，高伤害 150%，使用 spawnBeam 视觉 */
  private fireLaser(): void {
    const p = this.player;
    const aware = this.t < p.awarenessUntil;
    const baseDmg = (10 + this.effectiveWeapon() * 2) * (aware ? 2 : 1);
    const dmg = Math.round(baseDmg * 1.5);
    const col = aware ? "#FF5A60" : "#FF00E5";
    const speed = 1000;
    const lvl = p.weaponBranchLevel;
    // v3：觉醒等级扩展光束数与宽度
    let n = lvl; // 1/2/3 道
    let size = 6;
    let explode = false;
    let explodeRadius = 0;
    if (lvl === 4) { n = 4; size = 9; } // 等离子激光
    else if (lvl === 5) { n = 5; size = 11; explode = true; explodeRadius = 60; } // 识破光束
    // v3：装备额外多发
    n += this.getEquipMultishot();
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 12;
      this.bullets.push({
        x: p.x + off, y: p.y - 20,
        vx: 0, vy: -speed,
        damage: dmg, color: col, size, from: "player", life: 1.5,
        pierce: true, hitCd: 0,
        explode: explode || undefined, explodeRadius: explodeRadius || undefined,
      });
      // 光束视觉（spawnBeam）
      this.particles.spawnBeam(p.x + off, p.y - 20, -Math.PI / 2, col, { len: 600, life: 0.2, size });
    }
    playSfx("laser");
  }

  /** 追踪武器（新增）：追踪导弹，中伤害 100%，使用 spawnTrail 尾迹 */
  private fireHoming(): void {
    const p = this.player;
    const aware = this.t < p.awarenessUntil;
    const baseDmg = (10 + this.effectiveWeapon() * 2) * (aware ? 2 : 1);
    const dmg = baseDmg;
    const col = aware ? "#FF5A60" : "#52C41A";
    const speed = 320;
    const lvl = p.weaponBranchLevel;
    // v3：觉醒等级扩展导弹数
    let n = lvl; // 1/2/3 发
    let explode = false;
    let explodeRadius = 0;
    if (lvl === 4) { n = lvl + 1; } // 智能导弹群
    else if (lvl === 5) { n = lvl + 2; explode = true; explodeRadius = 50; } // 雷霆审判导弹
    // v3：装备额外多发
    n += this.getEquipMultishot();
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 14;
      this.bullets.push({
        x: p.x + off, y: p.y - 20,
        vx: 0, vy: -speed,
        damage: dmg, color: col, size: 5, from: "player", life: 4,
        homing: true, hitCd: 0,
        explode: explode || undefined, explodeRadius: explodeRadius || undefined,
      });
    }
    playSfx("shoot");
  }

  private updateEnemies(dt: number, frozen: boolean): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (frozen) continue; // 证据固定：冻结
      const age = this.t - e.born;
      if (e.def.pattern === "zigzag") {
        e.vx = Math.sin(age * 3) * 120;
      } else if (e.def.pattern === "miner") {
        e.vx = Math.sin(age * 1.5) * 60;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = clamp(e.x, 20, W - 20);
      if (e.def.shootInterval && e.y > 0 && e.y < H * 0.6) {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = e.def.shootInterval;
          this.enemyShoot(e);
        }
      }
      if (e.y > H + 40) {
        this.enemies.splice(i, 1);
      }
    }
  }

  private enemyShoot(e: Enemy): void {
    if (e.def.pattern === "shooter") {
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      this.bullets.push({
        x: e.x, y: e.y, vx: (dx / d) * 260, vy: (dy / d) * 260,
        damage: DMG_BULLET, color: "#E5353B", size: 5, from: "enemy", life: 4,
      });
    } else if (e.def.pattern === "miner") {
      this.bullets.push({
        x: e.x, y: e.y + 10, vx: 0, vy: 80,
        damage: DMG_BULLET, color: "#1AD670", size: 6, from: "enemy", life: 6,
      });
    } else if (e.def.pattern === "zigzag" && e.def.shootInterval) {
      // invest 虚假投资：散射两发
      for (const off of [-0.25, 0.25]) {
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const a = Math.atan2(dy, dx) + off;
        this.bullets.push({
          x: e.x, y: e.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
          damage: DMG_BULLET, color: "#B388FF", size: 5, from: "enemy", life: 4,
        });
      }
    }
    playSfx("tick");
  }

  /**
   * v4：BossRush 模式 — 开启指定阶段的 BOSS 战
   * 从 bossRushBossIds 序列中按 idx 取 BOSS，最后一战可为终极 BOSS
   */
  private startBossRushStage(idx: number, prep: number): void {
    this.bossRushStageIdx = idx;
    this.bossRushStageStartedAt = this.t;
    this.waveActive = false;
    this.prepUntil = this.t + prep;
    this.phase = "battle";
    const bossId = this.bossRushBossIds[idx];
    const isFinal = idx === this.bossRushBossIds.length - 1;
    this.spawnBossRush(bossId, isFinal);
    this.emitHud();
  }

  /** v4：按 BOSS id 直接生成（BossRush 用） */
  private spawnBossRush(bossId: string, ultimate: boolean): void {
    const def = getBossDefById(bossId) ?? RANDOM_BOSSES[0];
    this.phase = "entrance";
    this.bossEnterAt = this.t;
    const hpMul = this.difficultyCfg.bossHpMul;
    const maxHp = Math.round(def.hp * hpMul);
    this.boss = {
      def,
      x: W / 2,
      y: -60,
      hp: maxHp,
      maxHp,
      phase: 1,
      fireCd: 1.5,
      moveDir: 1,
      spawnCd: 4,
      enterUntil: this.t + 2,
      hitFlash: 0,
      patternIdx: 0,
      spiralAngle: 0,
      enraged: false,
      laserSweepAngle: 0,
      laserSweepUntil: 0,
      laserSweepActive: false,
      entranceStage: "warn",
      entranceStageUntil: this.t + 1.2,
      entranceStartedAt: this.t,
    };
    const tag = ultimate ? "⚡最终战⚡" : `BOSS RUSH ${this.bossRushStageIdx + 1}/${this.bossRushBossIds.length}`;
    this.toast = {
      text: `${tag}：${def.name} · ${def.fraudType}`,
      tone: "bad",
      until: this.t + 3.5,
    };
    postFX.glitch(0.8, 3);
    postFX.flash(def.color, 0.4, 2);
    postFX.shake(10, 14);
    playSfx("boss");
    // v4 升级：动态 BGM — BossRush 阶段开场切换至紧张预告曲
    this.switchBgm("tense");
    this.emitHud();
  }

  private spawnBoss(ultimate: boolean): void {
    this.phase = "entrance";
    this.bossEnterAt = this.t;
    const def: BossDef = ultimate ? ULTIMATE_BOSS : pickRandomBoss(this.rng);
    // v2 升级：应用难度乘子 + 无尽模式缩放
    const hpMul = this.difficultyCfg.bossHpMul * (this.endless ? this.endlessScale : 1);
    const maxHp = Math.round(def.hp * hpMul);
    this.boss = {
      def,
      x: W / 2,
      y: -60,
      hp: maxHp,
      maxHp,
      phase: 1,
      fireCd: 1.5,
      moveDir: 1,
      spawnCd: 4,
      enterUntil: this.t + 2,
      hitFlash: 0,
      patternIdx: 0,
      spiralAngle: 0,
      enraged: false,
      laserSweepAngle: 0,
      laserSweepUntil: 0,
      laserSweepActive: false,
      // v2 升级：登场 CG（C1）
      entranceStage: "warn",
      entranceStageUntil: this.t + 1.2,
      entranceStartedAt: this.t,
    };
    const tag = ultimate ? "⚡终极BOSS⚡" : "BOSS";
    this.toast = {
      text: `${tag} 来袭：${def.name} · ${def.fraudType}`,
      tone: "bad",
      until: this.t + 3.5,
    };
    // 登场 CG：预警闪屏（C1）
    postFX.glitch(0.8, 3);
    postFX.flash(def.color, 0.4, 2);
    postFX.shake(10, 14);
    playSfx("boss");
    // v4 升级：动态 BGM — BOSS 登场切换至紧张预告曲
    this.switchBgm("tense");
    this.emitHud();
  }

  private updateBoss(dt: number, frozen: boolean): void {
    const b = this.boss;
    if (!b) return;
    if (frozen) return; // 证据固定：冻结 BOSS
    // v2 升级：登场 CG 阶段推进（C1）
    if (b.entranceStage !== "done") {
      if (this.t >= b.entranceStageUntil) {
        if (b.entranceStage === "warn") {
          b.entranceStage = "flash";
          b.entranceStageUntil = this.t + 0.4;
          postFX.flash(b.def.color, 0.6, 3);
          postFX.glitch(0.8, 2);
          postFX.shake(8, 12);
        } else if (b.entranceStage === "flash") {
          b.entranceStage = "zoom";
          b.entranceStageUntil = this.t + 0.6;
          postFX.flash("#FFFFFF", 0.4, 2);
        } else if (b.entranceStage === "zoom") {
          b.entranceStage = "title";
          b.entranceStageUntil = this.t + 1.2;
          if (b.def.entranceTitle) {
            this.toast = { text: b.def.entranceTitle, tone: "bad", until: this.t + 2.5 };
          }
          if (b.def.entranceWarning) {
            this.floats.push({
              x: W / 2, y: H / 2 - 40, text: b.def.entranceWarning,
              color: b.def.color, life: 1.5, maxLife: 1.5, size: 20,
              vx: 0, vy: -20, gravity: 0,
            });
          }
        } else if (b.entranceStage === "title") {
          b.entranceStage = "done";
          this.phase = "boss";
          postFX.flash(b.def.color, 0.3, 2);
          // v4 升级：动态 BGM — BOSS 战正式开始，切换至 BossBattle 激烈曲
          this.switchBgm("bossBattle");
        }
        this.emitHud();
      }
      // 登场期间 BOSS 从屏幕外滑入
      if (this.t < b.enterUntil) {
        b.y += ((120 - b.y) / Math.max(0.01, b.enterUntil - this.t)) * dt;
        return;
      }
      return; // CG 期间不进行攻击/移动
    }
    if (this.t < b.enterUntil) {
      b.y += ((120 - b.y) / Math.max(0.01, b.enterUntil - this.t)) * dt;
      return;
    }
    b.y = 120;
    // v2 升级：BOSS 战回血（Roguelike healOnBoss）
    if (this.getBuffStack("healOnBoss") > 0 && this.player.hp < MAX_HP) {
      this.player.hp = Math.min(MAX_HP, this.player.hp + this.getBuffStack("healOnBoss") * dt);
    }
    // 阶段 3：狂暴 erratic 移动（更快 + 随机反向，新增）
    if (b.phase === 3) {
      b.x += b.moveDir * 140 * b.def.speedMul * dt;
      if (this.rng() < 0.02) b.moveDir *= -1;
    } else {
      b.x += b.moveDir * 80 * b.def.speedMul * dt;
    }
    if (b.x < 80) { b.x = 80; b.moveDir = 1; }
    else if (b.x > W - 80) { b.x = W - 80; b.moveDir = -1; }
    const ratio = b.hp / b.maxHp;
    const newPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (newPhase !== b.phase) {
      this.phaseTransitionUntil = this.t + 1.2;
      this.phaseTransitionText = `PHASE ${newPhase}/3`;
      b.phase = newPhase;
      b.patternIdx = (b.patternIdx + 1) % b.def.patterns.length; // 阶段切换攻击模式
      this.shakeUntil = this.t + 0.3;
      this.hitstopUntil = this.t + 0.15; // 阶段切换 hitstop
      this.particles.spawnBurst(b.x, b.y, "#FFD666", { sparks: 24, dots: 18, speed: 240, life: 0.8, size: 4, color2: b.def.color });
      this.spawnShock(b.x, b.y, 180, "#FFD666", 4);
      if (newPhase === 2) {
        // 阶段 2：spread shots + 更快移动 + phase 音效 + glitch(0.5)
        playSfx("phase");
        postFX.glitch(0.5, 2);
        postFX.flash(b.def.color, 0.3, 3);
        postFX.shake(8, 12);
      } else if (newPhase === 3) {
        // 阶段 3：狂暴 — rapid fire + erratic + phase+boss 音效 + glitch(0.8) + shake(12)
        playSfx("phase");
        playSfx("boss");
        postFX.glitch(0.8, 3);
        postFX.flash("#FF00E5", 0.4, 3);
        postFX.shake(12, 16);
        b.enraged = true;
        this.particles.spawnBurst(b.x, b.y, "#FF00E5", { ring: true, sparks: 30, dots: 36, speed: 320, life: 1.0, size: 5, color2: "#FFD666" });
        this.spawnShock(b.x, b.y, 220, "#FF00E5", 5);
      }
      this.toast = { text: `${b.def.name} 狂暴阶段 ${newPhase}/3`, tone: "bad", until: this.t + 2 };
    }
    // v5 多阶段变身：检查 def.phases 定义的自定义变身阶段
    if (b.def.phases && b.def.phases.length > 0) {
      const hpRatio = b.hp / b.maxHp;
      for (const phaseDef of b.def.phases) {
        if (this.bossPhasesTriggered.has(phaseDef.phase)) continue;
        if (hpRatio <= phaseDef.hpThreshold) {
          // 触发变身
          this.bossPhasesTriggered.add(phaseDef.phase);
          this.bossPhaseNum = phaseDef.phase;
          // 追加攻击模式
          if (phaseDef.extraPatterns) {
            for (const pat of phaseDef.extraPatterns) {
              if (!b.def.patterns.includes(pat)) b.def.patterns.push(pat);
            }
          }
          // 应用速度/频率倍率
          if (phaseDef.speedMul) b.def.speedMul = phaseDef.speedMul;
          // 变身视觉
          this.bossTransformFlashUntil = this.t + 0.6;
          this.bossTransformWarning = phaseDef.warningText ?? null;
          postFX.flash(phaseDef.flashColor ?? "#FF00E5", 0.5, 3);
          postFX.glitch(0.8, 3);
          postFX.shake(12, 16);
          this.spawnShock(b.x, b.y, 240, phaseDef.flashColor ?? "#FF00E5", 5);
          this.particles.spawnBurst(b.x, b.y, phaseDef.flashColor ?? "#FF00E5", { ring: true, sparks: 30, dots: 36, speed: 320, life: 1.0, size: 5, color2: phaseDef.color ?? b.def.color });
          if (phaseDef.warningText) {
            this.floats.push({
              x: W / 2, y: H / 2 - 40, text: phaseDef.warningText,
              color: phaseDef.flashColor ?? "#FF00E5", life: 2, maxLife: 2, size: 18,
              vx: 0, vy: -15, gravity: 0,
            });
          }
          playSfx("boss");
          this.emitHud();
        }
      }
    }
    b.fireCd -= dt;
    if (b.fireCd <= 0) {
      const baseCd = b.phase === 1 ? 1.2 : b.phase === 2 ? 0.9 : 0.6;
      b.fireCd = b.enraged ? baseCd * 0.65 : baseCd;
      this.bossFire();
    }
    // 召唤小怪：阶段2+ 且模式含 summon
    if (b.phase >= 2 && b.def.patterns.includes("summon")) {
      b.spawnCd -= dt;
      if (b.spawnCd <= 0) {
        b.spawnCd = b.def.ultimate ? 3 : 4;
        const summonId = b.def.summonType ?? "script";
        const summonDef = ENEMIES[summonId] ?? ENEMIES.script;
        for (const off of [-40, 40]) {
          this.enemies.push({
            uid: this.uidSeq++,
            def: summonDef,
            x: b.x + off, y: b.y + 30,
            vx: off < 0 ? -40 : 40, vy: 100,
            hp: summonDef.hp, maxHp: summonDef.hp,
            shootCd: 0, phase: 0, born: this.t, hitFlash: 0,
            shield: summonDef.shield ?? 0,
            maxShield: summonDef.shield ?? 0,
            shieldFlash: 0,
          });
        }
      }
    }
  }

  private bossFire(): void {
    const b = this.boss!;
    const pattern: BossAttackPattern = b.def.patterns[b.patternIdx % b.def.patterns.length];
    const col = b.def.color;
    const dmg = b.def.ultimate ? DMG_BULLET + 2 : DMG_BULLET;
    switch (pattern) {
      case "spread": {
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        const baseA = Math.atan2(dy, dx);
        const n = b.phase === 3 ? 7 : b.phase === 2 ? 5 : 3;
        for (let i = -(n - 1) / 2; i <= (n - 1) / 2; i++) {
          const a = baseA + i * 0.18;
          this.bullets.push({
            x: b.x, y: b.y + 30, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280,
            damage: dmg, color: col, size: 6, from: "enemy", life: 4,
          });
        }
        break;
      }
      case "spiral": {
        const n = b.phase === 3 ? 14 : b.phase === 2 ? 10 : 6;
        b.spiralAngle += 0.5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + b.spiralAngle;
          this.bullets.push({
            x: b.x, y: b.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
            damage: dmg, color: col, size: 5, from: "enemy", life: 4,
          });
        }
        break;
      }
      case "rain": {
        const n = b.phase === 3 ? 8 : 5;
        for (let i = 0; i < n; i++) {
          const x = 40 + Math.random() * (W - 80);
          this.bullets.push({
            x, y: b.y + 20, vx: 0, vy: 180 + Math.random() * 80,
            damage: dmg, color: col, size: 6, from: "enemy", life: 5,
          });
        }
        break;
      }
      case "beam": {
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        const baseA = Math.atan2(dy, dx);
        const n = 3;
        for (let i = 0; i < n; i++) {
          const a = baseA + (i - 1) * 0.06;
          this.bullets.push({
            x: b.x, y: b.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420,
            damage: dmg, color: col, size: 7, from: "enemy", life: 3,
          });
        }
        // spawnBeam 视觉：光束预警（新增）
        this.particles.spawnBeam(b.x, b.y, baseA, col, { len: 400, life: 0.3, size: 5 });
        break;
      }
      case "homing": {
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const n = b.phase >= 2 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 0.3;
          const a = Math.atan2(dy, dx) + off;
          this.bullets.push({
            x: b.x, y: b.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
            damage: dmg, color: "#FFD666", size: 6, from: "enemy", life: 5,
          });
        }
        break;
      }
      case "summon": {
        // 召唤模式：发射少量弹幕 + 不在此处召唤（由 updateBoss 处理召唤）
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + this.t;
          this.bullets.push({
            x: b.x, y: b.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
            damage: dmg, color: col, size: 5, from: "enemy", life: 4,
          });
        }
        break;
      }
      case "laserSweep": {
        // 启动持续 1.5 秒的激光扫射
        b.laserSweepActive = true;
        b.laserSweepUntil = this.t + 1.5;
        b.laserSweepAngle = -Math.PI / 4; // 起始角度
        playSfx("laser");
        break;
      }
    }
    // v6 升级：P2 组合弹幕（在主弹幕之后追加）
    this.fireCombinedPatterns();
    playSfx("tick");
  }

  /** 激光扫射：更新角度与玩家命中判定 */
  private updateLaserSweep(dt: number): void {
    const b = this.boss;
    if (!b || !b.laserSweepActive) return;
    if (this.t >= b.laserSweepUntil) {
      b.laserSweepActive = false;
      return;
    }
    // 扫射角度从 -π/4 扫到 π/4 + π/2（覆盖下半圆）
    const progress = 1 - (b.laserSweepUntil - this.t) / 1.5;
    b.laserSweepAngle = -Math.PI / 4 + progress * Math.PI;
    // 检测玩家是否在激光线上
    const laserLen = 600;
    const ax = b.x, ay = b.y;
    const bx = ax + Math.cos(b.laserSweepAngle) * laserLen;
    const by = ay + Math.sin(b.laserSweepAngle) * laserLen;
    const p = this.player;
    // 点到线段距离
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len2));
    const px = ax + dx * t, py = ay + dy * t;
    const dist = Math.hypot(p.x - px, p.y - py);
    if (dist < 18 && this.t >= p.invincibleUntil) {
      this.hitPlayer(HP_PER_YUANBAO); // 4 伤害
    }
    void dt;
  }

  /** 激光扫射：绘制 */
  private drawLaserSweep(ctx: CanvasRenderingContext2D): void {
    const b = this.boss;
    if (!b || !b.laserSweepActive) return;
    const laserLen = 600;
    const ex = b.x + Math.cos(b.laserSweepAngle) * laserLen;
    const ey = b.y + Math.sin(b.laserSweepAngle) * laserLen;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // 外层光晕
    ctx.strokeStyle = "rgba(255,0,229,0.3)";
    ctx.lineWidth = 18;
    ctx.shadowColor = "#FF00E5";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // 内层激光
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // 末端爆点
    ctx.fillStyle = "#FF00E5";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(ex, ey, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      // 追踪导弹：寻找最近敌人并转向（新增）
      if (b.homing) {
        const target = this.findNearestTarget(b.x, b.y);
        if (target) {
          const dx = target.x - b.x;
          const dy = target.y - b.y;
          const ta = Math.atan2(dy, dx);
          const ca = Math.atan2(b.vy, b.vx);
          let da = ta - ca;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          const turn = Math.sign(da) * Math.min(Math.abs(da), 4 * dt);
          const a = ca + turn;
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(a) * sp;
          b.vy = Math.sin(a) * sp;
        }
        // 追踪导弹尾迹（spawnTrail）
        const sp = Math.hypot(b.vx, b.vy);
        const a = Math.atan2(b.vy, b.vx);
        this.particles.spawnTrail(b.x, b.y, b.color, { speed: sp * 0.5, angle: a, life: 0.4, size: 3, len: 6 });
      }
      // 穿透命中冷却衰减（新增）
      if (b.hitCd !== undefined && b.hitCd > 0) b.hitCd -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        this.bullets.splice(i, 1);
      }
    }
  }

  /** 寻找最近的敌方目标（用于追踪弹，新增） */
  private findNearestTarget(x: number, y: number): { x: number; y: number } | null {
    let nearest: { x: number; y: number } | null = null;
    let minD = Infinity;
    for (const e of this.enemies) {
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < minD) { minD = d; nearest = { x: e.x, y: e.y }; }
    }
    if (this.boss && this.t >= this.boss.enterUntil) {
      const d = (this.boss.x - x) ** 2 + (this.boss.y - y) ** 2;
      if (d < minD) { minD = d; nearest = { x: this.boss.x, y: this.boss.y }; }
    }
    return nearest;
  }

  private updatePowerups(dt: number): void {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.y += 80 * dt;
      if (p.y > H + 20) {
        this.powerups.splice(i, 1);
      }
    }
  }

  /** v5 无人机更新：跟随玩家环绕 + 自动开火 / 护盾恢复 */
  private updateDrones(dt: number, frozen: boolean): void {
    if (this.drones.length === 0) return;
    const p = this.player;
    // 环绕半径与角速度
    const orbitR = 44;
    const angularSpeed = 1.6;
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      // 过期移除
      if (this.t > d.until) {
        this.drones.splice(i, 1);
        this.particles.spawn({ x: d.x, y: d.y, count: 8, speed: 120, life: 0.4, size: 3, color: DRONES[d.def].color });
        continue;
      }
      // 环绕跟随：多架无人机均匀分布
      const angleOffset = (i / Math.max(1, this.drones.length)) * Math.PI * 2;
      d.offsetAngle += angularSpeed * dt;
      const targetX = p.x + Math.cos(d.offsetAngle + angleOffset) * orbitR;
      const targetY = p.y - 30 + Math.sin(d.offsetAngle + angleOffset) * orbitR * 0.6;
      // 平滑跟随
      d.x += (targetX - d.x) * Math.min(1, dt * 8);
      d.y += (targetY - d.y) * Math.min(1, dt * 8);
      // 冻结期间不开火
      if (frozen) continue;
      const def = DRONES[d.def];
      d.fireCd -= dt;
      if (d.fireCd <= 0) {
        d.fireCd = def.fireInterval;
        if (def.kind === "shieldpod") {
          // 护盾无人机：每 fireInterval 秒恢复 1 层反诈APP护盾（上限 3）
          if (p.appCharges < 3) {
            p.appCharges += 1;
            this.particles.spawnBurst(d.x, d.y, def.color, { ring: true, sparks: 8, dots: 6, speed: 140, life: 0.4, size: 3 });
            this.spawnShock(d.x, d.y, 60, def.color, 2);
          }
        } else {
          // 机枪/激光无人机：向前方开火，伤害为玩家基础伤害 * dmgMul
          const baseDmg = (10 + this.effectiveWeapon() * 2);
          const dmg = Math.max(1, Math.round(baseDmg * def.dmgMul));
          if (def.branch === "laser") {
            // 激光无人机：穿透
            this.bullets.push({
              x: d.x, y: d.y - 10,
              vx: 0, vy: -900,
              damage: dmg, color: def.color, size: 5, from: "player", life: 1.5,
              pierce: true, hitCd: 0,
            });
            this.particles.spawnBeam(d.x, d.y - 10, -Math.PI / 2, def.color, { len: 400, life: 0.15, size: 4 });
            playSfx("laser");
          } else {
            // 机枪无人机：双发直射
            for (const off of [-6, 6]) {
              this.bullets.push({
                x: d.x + off, y: d.y - 10,
                vx: 0, vy: -640,
                damage: dmg, color: def.color, size: 3, from: "player", life: 1.5,
              });
            }
            playSfx("shoot");
          }
        }
      }
    }
    this.emitHud();
  }

  /** v5 生存模式：保护目标更新 — 受击检测 + 失败判定 */
  private updateSurvivalTarget(dt: number, _frozen: boolean): void {
    if (!this.survivalTarget) return;
    const t = this.survivalTarget;
    // 衰减受击高光
    if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt);
    // 敌方子弹 vs 保护目标
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.from !== "enemy") continue;
      const dx = b.x - t.x;
      const dy = b.y - t.y;
      if (Math.hypot(dx, dy) < t.def.radius + 6) {
        this.bullets.splice(i, 1);
        t.hp -= b.damage;
        t.hitFlash = 0.2;
        this.particles.spawn({ x: b.x, y: b.y, count: 5, speed: 120, life: 0.3, size: 3, color: "#FF4D4F" });
        this.floats.push({
          x: t.x, y: t.y - 30, text: `-${b.damage}`,
          color: "#FF4D4F", life: 0.8, maxLife: 0.8, size: 14, vx: 0, vy: -30, gravity: 0,
        });
      }
    }
    // 敌方机体碰撞保护目标
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (Math.hypot(dx, dy) < t.def.radius + 20) {
        t.hp -= 8;
        t.hitFlash = 0.3;
        e.hp -= 60;
        e.hitFlash = 0.15;
        if (e.hp <= 0) this.killEnemy(i, false);
        this.spawnShock(t.x, t.y, 80, "#FF4D4F", 3);
        this.particles.spawnBurst(t.x, t.y, "#FF4D4F", { sparks: 10, dots: 8, speed: 180, life: 0.5, size: 4 });
      }
    }
    // 保护目标被摧毁 = 失败
    if (t.hp <= 0) {
      t.hp = 0;
      this.loseSurvival();
    }
    this.emitHud();
  }

  /** v5 生存模式失败结算 — 保护目标被摧毁 */
  private loseSurvival(): void {
    if (this.over) return;
    // 设置生存模式专属死亡原因
    if (this.survivalTarget) {
      this.deathCause = {
        fraudType: "保护目标失守",
        emoji: this.survivalTarget.def.emoji,
        name: `${this.survivalTarget.def.name}被摧毁`,
        identifyDetail: ["保护目标 HP 归零 = 任务失败", "优先拦截靠近目标的敌人", "使用公安反诈突击清场保命"],
        protectList: ["关注保护目标 HP，及时回防", "利用 96110 热线净化弹幕", "保留大招应对密集波次"],
        caseStory: `${this.survivalTarget.def.lore}本次防守失败，敌方突破防线。`,
      };
    }
    postFX.flash("#FF4D4F", 0.6, 4);
    postFX.shake(16, 20);
    if (this.survivalTarget) {
      this.particles.spawnBurst(this.survivalTarget.x, this.survivalTarget.y, "#FF4D4F", { ring: true, sparks: 40, dots: 50, speed: 320, life: 1.2, size: 6, color2: "#FFD666" });
    }
    // 复用通用失败结算流程
    this.lose();
  }

  private updateFloats(dt: number): void {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.vy += f.gravity * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
  }

  private updateShocks(dt: number): void {
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.life -= dt;
      const k = 1 - s.life / s.maxLife;
      s.r = s.maxR * k;
      if (s.life <= 0) this.shocks.splice(i, 1);
    }
  }

  private checkCollisions(): void {
    const p = this.player;
    const overseas = this.t < p.overseasUntil;
    const hotline = this.t < p.hotlineUntil; // 96110：净化弹幕
    // Player bullets vs enemies / boss
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.from !== "player") continue;
      // 穿透命中冷却：冷却期内跳过碰撞（避免连续命中同一目标，新增）
      if (b.hitCd !== undefined && b.hitCd > 0) continue;
      // vs boss
      if (this.boss && this.t >= this.boss.enterUntil) {
        const boss = this.boss;
        const dx = b.x - boss.x;
        const dy = b.y - boss.y;
        if (Math.abs(dx) < 50 && Math.abs(dy) < 50) {
          // v3：应用角色/装备/觉醒/暴击伤害
          const { dmg, crit } = this.computeHitDamage(b.damage, boss.def.fraudType);
          boss.hp -= dmg;
          boss.hitFlash = 0.12;
          this.spawnHitSpark(b.x, b.y, b.color);
          // BOSS 伤害数字（暴击时更醒目）
          this.particles.spawnText(boss.x + (Math.random() - 0.5) * 40, boss.y - 30, `${crit ? "暴击 " : ""}-${Math.ceil(dmg)}`, crit ? "#FF00E5" : "#FFD666", { size: crit ? 16 : 12, life: 0.6 });
          // v3：觉醒爆炸（命中 BOSS 时也触发范围伤害）
          if (b.explode && b.explodeRadius) {
            this.explodeAt(b.x, b.y, b.explodeRadius, b.damage * 0.5, b.color);
          }
          // BOSS 命中 hitstop（增强击打感）
          if (this.hitstopUntil < this.t) this.hitstopUntil = this.t + 0.04;
          // v6 升级：P4 超觉醒大招充能（命中 BOSS 时累积）
          this.chargeSuperAwakeningUlt(dmg);
          // 穿透子弹：进入冷却而非销毁（新增）
          if (b.pierce) { b.hitCd = 0.15; } else { this.bullets.splice(i, 1); }
          if (boss.hp <= 0) this.killBoss();
          continue;
        }
      }
      // vs enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const hitR = e.def.elite ? 26 : 22;
        if (Math.hypot(dx, dy) < hitR) {
          if (e.shield > 0) {
            // v3：护盾也吃加成伤害
            const { dmg } = this.computeHitDamage(b.damage, e.def.fraudType);
            e.shield -= dmg;
            e.shieldFlash = 0.12;
            this.particles.spawn({ x: b.x, y: b.y, count: 8, speed: 180, life: 0.35, size: 3, color: "#9D4EDD", type: "spark", friction: 0.92 });
            this.particles.spawn({ x: b.x, y: b.y, count: 1, speed: 0, life: 0.3, size: 8, color: "#9D4EDD", type: "ring", ringWidth: 2 });
            playSfx("shieldBreak");
            // 穿透子弹：进入冷却而非销毁（新增）
            if (b.pierce) { b.hitCd = 0.15; } else { this.bullets.splice(i, 1); }
            if (e.shield <= 0) {
              e.shield = 0;
              this.particles.spawnBurst(e.x, e.y, "#9D4EDD", { ring: true, sparks: 12, dots: 14, speed: 220, life: 0.6, size: 3 });
            }
          } else {
            // v3：应用角色/装备/觉醒/暴击伤害
            const { dmg, crit } = this.computeHitDamage(b.damage, e.def.fraudType);
            e.hp -= dmg;
            e.hitFlash = 0.12;
            this.spawnHitSpark(b.x, b.y, b.color);
            if (crit) {
              this.particles.spawnText(e.x, e.y - 14, "暴击!", "#FF00E5", { size: 12, life: 0.5 });
            }
            // v3：觉醒爆炸
            if (b.explode && b.explodeRadius) {
              this.explodeAt(b.x, b.y, b.explodeRadius, b.damage * 0.5, b.color);
            }
            // 穿透子弹：进入冷却而非销毁（新增）
            if (b.pierce) { b.hitCd = 0.15; } else { this.bullets.splice(i, 1); }
            if (e.hp <= 0) this.killEnemy(j, false);
          }
          break;
        }
      }
    }
    // 96110热线：净化所有敌方子弹
    if (hotline) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.from !== "enemy") continue;
        this.particles.spawn({ x: b.x, y: b.y, count: 4, speed: 100, life: 0.3, size: 2, color: "#00E5FF" });
        this.bullets.splice(i, 1);
      }
    }
    // Enemy bullets vs player（不接境外来电/96110时免疫弹幕）
    if (!overseas && !hotline && this.t >= p.invincibleUntil) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.from !== "enemy") continue;
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const dist = Math.hypot(dx, dy);
        // v5 擦弹检测：在擦弹半径内但未命中飞船，且该子弹未被计过擦弹
        if (dist < GRAZE_CONFIG.radius && dist >= SHIP_R && !this.grazedBullets.has(b)) {
          this.grazedBullets.add(b);
          this.grazeCharge = Math.min(GRAZE_CONFIG.chargeMax, this.grazeCharge + GRAZE_CONFIG.chargePerGraze);
          this.grazeCount += 1;
          this.particles.spawn({ x: b.x, y: b.y, count: 3, speed: 80, life: 0.25, size: 2, color: "#FFD666" });
          // 充能满触发擦弹奖励
          if (this.grazeCharge >= GRAZE_CONFIG.chargeMax) {
            this.grazeCharge = 0;
            this.grazeBoostUntil = this.t + GRAZE_CONFIG.boostDuration;
            this.toast = { text: "擦弹奖励：分数倍率提升！", tone: "good", until: this.t + 1.5 };
            this.spawnShock(p.x, p.y, 80, "#FFD666", 2);
          }
          this.emitHud();
        }
        if (dist < SHIP_R) {
          // v6 升级：P1 格挡反击检测（在造成伤害前判定）
          const parryResult = this.onParryHit(b);
          if (parryResult.blocked) {
            this.bullets.splice(i, 1);
            // 普通格挡：伤害减半
            if (!parryResult.reflected) {
              const reducedDmg = Math.ceil(b.damage * 0.5);
              const src = this.lastDamageTypeId ? { typeId: this.lastDamageTypeId } : this.boss ? { boss: this.boss.def } : undefined;
              this.hitPlayer(reducedDmg, src);
            }
            // 完美格挡：无伤害 + 已反弹子弹
            break;
          }
          this.bullets.splice(i, 1);
          // v2 升级：传递伤害来源（用于死亡复盘）
          const src = this.lastDamageTypeId ? { typeId: this.lastDamageTypeId } : this.boss ? { boss: this.boss.def } : undefined;
          this.hitPlayer(b.damage, src);
          break;
        }
      }
    } else if (overseas && !hotline) {
      // 不接境外来电：摧毁靠近的敌方子弹并化为粒子
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.from !== "enemy") continue;
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (Math.hypot(dx, dy) < SHIP_R + 26) {
          this.bullets.splice(i, 1);
          this.particles.spawn({ x: b.x, y: b.y, count: 4, speed: 100, life: 0.3, size: 2, color: "#3B7FEF" });
        }
      }
    }
    // Enemy body collision with player
    if (this.t >= p.invincibleUntil) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (Math.hypot(dx, dy) < SHIP_R + 20) {
          e.hp -= 50;
          e.hitFlash = 0.15;
          if (e.hp <= 0) this.killEnemy(i, false);
          this.hitPlayer(DMG_BODY, { typeId: e.def.id });
          break;
        }
      }
    }
    // Powerup pickup
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      const dx = pu.x - p.x;
      const dy = pu.y - p.y;
      if (Math.hypot(dx, dy) < SHIP_R + 16) {
        this.applyPowerup(pu.kind);
        this.powerups.splice(i, 1);
        playSfx("pickup");
      }
    }
    // Boss body collision with player
    if (this.boss && this.t >= this.boss.enterUntil && this.t >= p.invincibleUntil) {
      const boss = this.boss;
      if (Math.abs(boss.x - p.x) < 55 && Math.abs(boss.y - p.y) < 55) {
        this.hitPlayer(DMG_BOSS_BODY, { boss: boss.def });
      }
    }
  }

  /** 命中火花：小光环 + 火花 + 闪点 */
  private spawnHitSpark(x: number, y: number, color: string): void {
    this.particles.spawn({ x, y, count: 1, speed: 0, life: 0.25, size: 6, color, type: "ring", ringWidth: 2 });
    this.particles.spawn({ x, y, count: 5, speed: 140, life: 0.3, size: 2.4, color, type: "spark", friction: 0.92 });
    this.particles.spawn({ x, y, count: 3, speed: 80, life: 0.25, size: 2, color: "#FFFFFF" });
  }

  /** v3：觉醒爆炸 — 对范围内敌方造成 AOE 伤害 */
  private explodeAt(x: number, y: number, radius: number, dmg: number, color: string): void {
    // 视觉
    this.particles.spawnBurst(x, y, color, { ring: true, sparks: 18, dots: 22, speed: 280, life: 0.6, size: 4 });
    this.spawnShock(x, y, radius * 2, color, 4);
    postFX.flash(color, 0.15, 4);
    // 范围伤害：敌方
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const e = this.enemies[j];
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius) {
        const { dmg: finalDmg } = this.computeHitDamage(dmg, e.def.fraudType);
        if (e.shield > 0) {
          e.shield -= finalDmg;
          if (e.shield <= 0) e.shield = 0;
        } else {
          e.hp -= finalDmg;
          if (e.hp <= 0) this.killEnemy(j, false);
        }
      }
    }
    // 范围伤害：BOSS
    if (this.boss && this.t >= this.boss.enterUntil) {
      const bd = Math.hypot(this.boss.x - x, this.boss.y - y);
      if (bd < radius) {
        const { dmg: finalDmg } = this.computeHitDamage(dmg, this.boss.def.fraudType);
        this.boss.hp -= finalDmg;
        this.boss.hitFlash = 0.12;
        if (this.boss.hp <= 0) this.killBoss();
      }
    }
  }

  private hitPlayer(dmg: number, source?: { typeId?: string; boss?: BossDef }): void {
    const p = this.player;
    // v2 升级：追踪死亡原因（B2）
    if (source?.typeId) this.lastDamageTypeId = source.typeId;
    else if (source?.boss) this.lastDamageBoss = source.boss;
    // 国家反诈APP 护盾优先吸收
    if (p.appCharges > 0) {
      p.appCharges -= 1;
      p.invincibleUntil = this.t + 0.8;
      this.shakeUntil = this.t + 0.2;
      this.particles.spawnBurst(p.x, p.y, "#00E5FF", { ring: true, sparks: 16, dots: 12, speed: 220, life: 0.6, size: 3 });
      this.spawnShock(p.x, p.y, 70, "#00E5FF", 3);
      postFX.flash("#00E5FF", 0.25, 3);
      postFX.shake(4, 10);
      this.toast = {
        text: p.appCharges > 0 ? `国家反诈APP 抵挡！剩余 ${p.appCharges} 次` : "国家反诈APP 护盾耗尽",
        tone: "info",
        until: this.t + 1.5,
      };
      playSfx("hit");
      this.emitHud();
      return;
    }
    // v2 升级：闪避冲刺无敌（A4）
    if (this.t < p.dashInvincibleUntil) {
      this.particles.spawnBurst(p.x, p.y, "#00E5FF", { ring: true, sparks: 8, dots: 6, speed: 160, life: 0.4, size: 2 });
      this.emitHud();
      return;
    }
    // 银行止付：伤害减半 + v3 装备减伤
    const bankMul = this.t < p.bankFreezeUntil ? 0.5 : 1;
    const equipReduce = this.getEquipDmgReduce();
    const actualDmg = Math.ceil(dmg * bankMul * (1 - equipReduce));
    p.hp = Math.max(0, p.hp - actualDmg);
    p.invincibleUntil = this.t + 1.2;
    p.weapon = Math.max(1, p.weapon - 1) as WeaponLevel;
    // 反诈宣传员或连击守护：连击不掉
    if (this.t >= p.adUntil && this.getBuffStack("comboShield") === 0) this.combo = 0;
    this.shakeUntil = this.t + 0.4;
    this.hitstopUntil = this.t + 0.08; // 受击 hitstop
    this.particles.spawnBurst(p.x, p.y, "#E5353B", { ring: true, sparks: 22, dots: 18, speed: 280, life: 0.8, size: 4, color2: "#FFD666" });
    this.spawnShock(p.x, p.y, 90, "#E5353B", 3);
    postFX.flash("#E5353B", 0.4, 2);
    postFX.glitch(0.5, 3);
    postFX.shake(8, 14);
    playSfx("bad");
    if (p.hp <= 0) {
      this.lose();
    } else {
      const ybLost = actualDmg / HP_PER_YUANBAO;
      const hint = this.t < p.bankFreezeUntil ? "（银行止付减半）" : "";
      this.toast = {
        text: `被击中！损失 ${ybLost} 个铜元宝${hint}（剩余 ${p.hp} 生命值）`,
        tone: "bad",
        until: this.t + 2,
      };
    }
    this.emitHud();
  }

  private killEnemy(idx: number, byRaid: boolean): void {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    const mult = this.scoreMultiplier();
    // v3：应用角色分数倍率 + 装备分数倍率
    const charMul = this.getCharacterScoreMul();
    const gained = Math.round(e.def.score * mult * charMul);
    this.score += gained;
    this.bustedCount += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboUntil = this.t + 2;
    // v3：累计诈骗类型击杀数（用于角色解锁条件）
    const ft = e.def.fraudType;
    this.save.fraudKills[ft] = (this.save.fraudKills[ft] ?? 0) + 1;
    // v2 升级：击杀分布统计 + 连击历史（C4 结算页用）
    this.killStats[e.def.id] = (this.killStats[e.def.id] ?? 0) + 1;
    this.comboHistory.push({ t: (performance.now() - this.startedAt) / 1000, combo: this.combo });
    if (this.comboHistory.length > 200) this.comboHistory.shift();
    // v2 升级：连击高潮口诀飘字（B3）— 每 10 连击触发一次
    if (this.combo > 0 && this.combo % 10 === 0 && this.combo !== this.lastMantraCombo) {
      this.lastMantraCombo = this.combo;
      const mantra = ANTIFRAUD_MANTRAS[Math.floor(this.rng() * ANTIFRAUD_MANTRAS.length)];
      this.mantraTexts.push({ text: mantra, until: this.t + 2.5 });
      if (this.mantraTexts.length > 4) this.mantraTexts.shift();
    }
    // v6 升级：S2 反诈口诀连招触发检测（连击 5/10/20/50）
    this.checkMantraChain();
    // 酷炫爆炸：多层 burst + 冲击波 + 闪屏（连击越高越华丽）
    const comboBoost = Math.min(2, this.combo / 10);
    this.particles.spawnBurst(e.x, e.y, e.def.color, { ring: true, sparks: 12 + Math.floor(comboBoost * 8), dots: 18, speed: 220 + comboBoost * 60, life: 0.7, size: 3.5, color2: "#FFD666" });
    this.particles.spawn({ x: e.x, y: e.y, count: 8, speed: 160, life: 0.6, size: 3, color: "#FFFFFF", type: "spark", friction: 0.93 });
    this.spawnShock(e.x, e.y, 60, e.def.color, 3);
    postFX.flash("#00E5FF", 0.12, 4);
    // 连击 hitstop（每5连击短暂卡帧）
    if (this.combo % 5 === 0 && this.hitstopUntil < this.t) this.hitstopUntil = this.t + 0.05;
    if (!byRaid) {
      this.floats.push({
        x: e.x, y: e.y - 10,
        text: `+${gained}${this.combo > 1 ? ` ×${this.combo}` : ""}`,
        color: this.combo >= 10 ? "#FF00E5" : this.combo >= 5 ? "#FF7A1A" : "#FFD666",
        life: 0.9, maxLife: 0.9, size: 14,
        vx: (this.rng() - 0.5) * 40,
        vy: -80 - this.rng() * 30,
        gravity: 120,
      });
    }
    playSfx("explode");
    // v2 升级：大招充能（A5）— 每次击杀获得充能
    this.chargeUltimate(e.def.score * 0.05);
    // 武器经验
    this.addWeaponXp(weaponXpForKill(e.def.score));
    // v3：武器分支经验（觉醒用）
    this.addBranchXp(weaponXpForKill(e.def.score));
    // v2 升级：Roguelike 掉落加成 + 难度掉落倍率 + v3 角色掉落倍率
    const dropBoost = 1 + this.getBuffStack("dropBoost") * 0.3;
    const dropRate = (e.def.dropRate ?? 0) * this.difficultyCfg.dropMul * dropBoost * this.getCharacterDropMul();
    // v5 极限挑战 / 周常 noPowerups 修饰符：禁用道具掉落
    const powerupsBlocked = this.noPowerups || this.weeklyModifier.kind === "noPowerups";
    if (e.def.dropRate && this.rng() < dropRate && !powerupsBlocked) {
      this.dropPowerup(e.x, e.y);
    }
    this.checkAchievements();
    this.emitHud();
  }

  /** 分数倍率：基于 combo（最高 3.0）+ v5 擦弹奖励 + 周常修饰符 */
  private scoreMultiplier(): number {
    let mul = Math.min(3.0, 1.0 + this.combo * 0.05);
    // v5 擦弹奖励：激活期间分数倍率提升
    if (this.t < this.grazeBoostUntil) {
      mul *= GRAZE_CONFIG.boostScoreMul;
    }
    // v5 周常修饰符分数倍率
    mul *= this.weeklyModifier.scoreMul;
    return mul;
  }

  /** 武器经验累积与自动升级 */
  private addWeaponXp(xp: number): void {
    if (this.player.weapon >= 4) return;
    this.player.weaponXp += xp;
    const maxXp = WEAPON_XP_TABLE[this.player.weapon].xpMax;
    if (maxXp > 0 && this.player.weaponXp >= maxXp) {
      this.player.weaponXp = 0;
      this.player.weapon = Math.min(4, this.player.weapon + 1) as WeaponLevel;
      this.toast = { text: `武器升级 → LV${this.player.weapon}（XP 满）`, tone: "good", until: this.t + 2 };
      postFX.flash("#FFD666", 0.4, 2);
      this.particles.spawnBurst(this.player.x, this.player.y, "#FFD666", { ring: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4, color2: "#FF7A1A" });
      this.spawnShock(this.player.x, this.player.y, 100, "#FFD666", 4);
      playSfx("weaponUp");
    }
  }

  /** v3：武器分支经验累积（用于觉醒提示，觉醒本身通过道具触发） */
  private addBranchXp(xp: number): void {
    if (this.player.weaponBranch === "normal") return;
    if (this.player.weaponBranchLevel >= 5) return;
    this.player.branchXp += xp;
  }

  /** 成就检测：里程碑触发 */
  private checkAchievements(): void {
    const stats: AchievementStats = {
      bustedCount: this.bustedCount,
      maxCombo: this.maxCombo,
      bossesDefeated: this.bossesDefeated,
      wave: this.wave + 1,
      hp: this.player.hp,
      maxHp: MAX_HP,
      score: this.score,
    };
    for (const a of ACHIEVEMENTS) {
      if (this.unlockedAchievements.has(a.id)) continue;
      if (a.check(stats)) {
        this.unlockedAchievements.add(a.id);
        this.achievementToast = { name: a.name, desc: a.desc, emoji: a.emoji, until: this.t + 3 };
        postFX.flash("#FFD666", 0.3, 2);
        this.particles.spawnBurst(this.player.x, this.player.y, "#FFD666", { ring: true, sparks: 16, dots: 20, speed: 240, life: 0.8, size: 4 });
        playSfx("achievement");
        break; // 一次只触发一个
      }
    }
  }

  private dropPowerup(x: number, y: number): void {
    const r = Math.random();
    let kind: PowerupKind;
    if (r < 0.13) kind = "weapon";
    else if (r < 0.26) kind = "antifraudApp";
    else if (r < 0.38) kind = "blockOverseas";
    else if (r < 0.48) kind = "policeRaid";
    else if (r < 0.58) kind = "smsFirewall";
    else if (r < 0.67) kind = "evidenceLock";
    else if (r < 0.74) kind = "fraudAwareness";
    else if (r < 0.80) kind = "lifePack";
    else if (r < 0.86) kind = "hotline96110";
    else if (r < 0.91) kind = "bankFreeze";
    else if (r < 0.95) kind = "awarenessAd";
    else if (r < 0.98) kind = "timeSlow";
    else kind = "phish"; // 陷阱 ~2%
    this.powerups.push({ x, y, vy: 90, kind, born: this.t });
  }

  private applyPowerup(kind: PowerupKind): void {
    const p = this.player;
    const def = POWERUPS[kind];
    let tone: "good" | "bad" | "info" = "good";
    switch (kind) {
      case "weapon":
        if (p.weapon < 4) {
          p.weapon = (p.weapon + 1) as WeaponLevel;
          this.toast = { text: `火力升级 → LV${p.weapon}`, tone: "good", until: this.t + 1.5 };
        } else {
          this.score += 200;
          this.toast = { text: "火力已满级，+200 分", tone: "good", until: this.t + 1.5 };
        }
        break;
      case "antifraudApp":
        p.appCharges = 3;
        this.toast = { text: "国家反诈APP 已安装：盾牌护盾 ×3", tone: "good", until: this.t + 1.8 };
        break;
      case "blockOverseas":
        p.overseasUntil = this.t + 5;
        this.toast = { text: "不接境外来电：5 秒免疫敌方弹幕", tone: "good", until: this.t + 1.8 };
        break;
      case "policeRaid":
        p.raids = Math.min(5, p.raids + 1);
        this.toast = { text: `公安反诈突击 +1（共 ${p.raids}）`, tone: "good", until: this.t + 1.5 };
        break;
      case "smsFirewall": {
        // 摧毁所有敌方子弹，每发化为反击弹幕伤害最近敌人
        const enemyBullets = this.bullets.filter((b) => b.from === "enemy");
        this.bullets = this.bullets.filter((b) => b.from !== "enemy");
        for (const b of enemyBullets) {
          this.particles.spawn({ x: b.x, y: b.y, count: 5, speed: 140, life: 0.3, size: 2, color: "#52C41A" });
        }
        // 反击：对全场敌人造成伤害
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          this.enemies[i].hp -= 60;
          this.enemies[i].hitFlash = 0.15;
          if (this.enemies[i].hp <= 0) this.killEnemy(i, true);
        }
        if (this.boss) {
          this.boss.hp -= 80;
          this.boss.hitFlash = 0.15;
        }
        this.spawnShock(p.x, p.y, 120, "#52C41A", 3);
        this.toast = { text: "短信防火墙：摧毁弹幕并反击！", tone: "good", until: this.t + 1.8 };
        break;
      }
      case "evidenceLock":
        this.freezeUntil = this.t + 3;
        this.toast = { text: "证据固定：全场敌方冻结 3 秒", tone: "good", until: this.t + 1.8 };
        // 冻结视觉：蓝紫色冲击波
        this.spawnShock(W / 2, H / 2, 360, "#B388FF", 4);
        postFX.flash("#B388FF", 0.2, 2);
        break;
      case "fraudAwareness":
        p.awarenessUntil = this.t + 6;
        this.toast = { text: "反诈意识觉醒：6 秒顶档火力 + 双倍伤害", tone: "good", until: this.t + 1.8 };
        break;
      case "lifePack":
        p.hp = Math.min(MAX_HP, p.hp + 8);
        this.toast = { text: `生命补给 +8（剩余 ${p.hp}）`, tone: "good", until: this.t + 1.5 };
        break;
      case "phish":
        p.weapon = Math.max(1, p.weapon - 1) as WeaponLevel;
        tone = "bad";
        this.toast = { text: "误拾钓鱼链接！武器降级", tone: "bad", until: this.t + 2 };
        this.shakeUntil = this.t + 0.3;
        break;
      case "hotline96110": {
        // 96110反诈热线：3秒全屏净化弹幕 + 锁定最强敌人造成大伤害
        p.hotlineUntil = this.t + 3;
        // 立即净化所有敌方子弹
        for (const b of this.bullets) {
          if (b.from === "enemy") {
            this.particles.spawn({ x: b.x, y: b.y, count: 4, speed: 100, life: 0.3, size: 2, color: "#00E5FF" });
          }
        }
        this.bullets = this.bullets.filter((b) => b.from !== "enemy");
        // 锁定最强敌人/BOSS
        this.spawnShock(W / 2, H / 2, 380, "#00E5FF", 5);
        if (this.boss) {
          this.boss.hp -= 150;
          this.boss.hitFlash = 0.2;
          this.particles.spawnBurst(this.boss.x, this.boss.y, "#00E5FF", { ring: true, sparks: 20, dots: 16, speed: 260, life: 0.8, size: 4 });
        } else {
          // 对血最多的敌人造成大量伤害
          let strongest: Enemy | null = null;
          for (const e of this.enemies) if (!strongest || e.hp > strongest.hp) strongest = e;
          if (strongest) {
            strongest.hp -= 200;
            strongest.hitFlash = 0.2;
            const idx = this.enemies.indexOf(strongest);
            if (strongest.hp <= 0 && idx >= 0) this.killEnemy(idx, true);
          }
        }
        this.toast = { text: "96110反诈热线：净化弹幕+锁定强敌！", tone: "good", until: this.t + 2 };
        postFX.flash("#00E5FF", 0.3, 2);
        break;
      }
      case "bankFreeze": {
        // 银行紧急止付：5秒敌方伤害减半 + 持续扣敌方血
        p.bankFreezeUntil = this.t + 5;
        // 立即对所有敌人造成小额伤害
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          this.enemies[i].hp -= 40;
          this.enemies[i].hitFlash = 0.15;
          if (this.enemies[i].hp <= 0) this.killEnemy(i, true);
        }
        if (this.boss) { this.boss.hp -= 60; this.boss.hitFlash = 0.15; }
        this.spawnShock(W / 2, H / 2, 320, "#FFD666", 4);
        this.toast = { text: "银行紧急止付：5秒减伤+持续扣血", tone: "good", until: this.t + 2 };
        postFX.flash("#FFD666", 0.25, 2);
        break;
      }
      case "awarenessAd":
        // 反诈宣传员：8秒连击不掉 + 自动拾取道具
        p.adUntil = this.t + 8;
        this.toast = { text: "反诈宣传员：8秒连击不掉+自动拾取", tone: "good", until: this.t + 2 };
        this.spawnShock(p.x, p.y, 120, "#52C41A", 3);
        postFX.flash("#52C41A", 0.2, 2);
        break;
      case "timeSlow":
        this.player.slowMoUntil = this.t + 3;
        this.toast = { text: "时间减速：3 秒内敌方减速 70%", tone: "good", until: this.t + 1.8 };
        postFX.flash("#9D4EDD", 0.3, 2);
        this.spawnShock(this.player.x, this.player.y, 140, "#9D4EDD", 4);
        playSfx("timeSlow");
        break;
      // ===== v5 新增道具 =====
      case "droneDeploy": {
        // 召唤一架机枪无人机伴随作战 15 秒
        const droneDef = DRONES.gunpod;
        this.drones.push({
          def: "gunpod",
          x: this.player.x,
          y: this.player.y - 30,
          fireCd: 0,
          until: this.t + droneDef.duration,
          offsetAngle: 0,
        });
        this.toast = { text: `${droneDef.name} 伴随作战 15 秒`, tone: "good", until: this.t + 1.8 };
        this.spawnShock(this.player.x, this.player.y, 100, "#00E5FF", 3);
        break;
      }
      case "shieldBurst": {
        // 清屏敌方子弹 + 获得 2 层反诈APP护盾
        for (let i = this.bullets.length - 1; i >= 0; i--) {
          const b = this.bullets[i];
          if (b.from !== "enemy") continue;
          this.particles.spawn({ x: b.x, y: b.y, count: 5, speed: 150, life: 0.35, size: 3, color: "#FFD666" });
          this.bullets.splice(i, 1);
        }
        this.player.appCharges = Math.max(this.player.appCharges, 2);
        this.spawnShock(this.player.x, this.player.y, 200, "#FFD666", 4);
        this.toast = { text: "护盾爆发：清屏弹幕 + 护盾 ×2", tone: "good", until: this.t + 1.8 };
        postFX.flash("#FFD666", 0.3, 2);
        break;
      }
    }
    if (tone === "good") playSfx("good");
    void def;
    this.emitHud();
  }

  private killBoss(): void {
    if (!this.boss) return;
    const b = this.boss;
    this.bustedCount += 10;
    this.score += Math.round((b.def.ultimate ? 5000 : 3000) * this.difficultyCfg.scoreMul);
    this.bossesDefeated += 1;
    // v2 升级：存档持久化 + 图鉴解锁（B5/D1）
    if (!this.save.defeatedBosses.includes(b.def.id)) {
      this.save.defeatedBosses.push(b.def.id);
    }
    this.save.totalBossKills += 1;
    if (b.def.codexId && !this.releasedCodexIds.has(b.def.codexId)) {
      this.releasedCodexIds.add(b.def.codexId);
      this.emit({ type: "log", text: `[CODEX_UNLOCK]${b.def.codexId}` });
    }
    // v6 升级：S3 诈骗溯源档案解锁（BOSS 击败后触发）
    this.unlockFraudArchive(b.def);
    // v6 升级：S4 赛季通行证经验（每击败 BOSS +expPerBoss）
    this.addSeasonPassExp(THUNDER_SEASON_PASS.expPerBoss);
    // v6 升级：P2 清空 BOSS 组合弹幕状态
    this.bossActiveCombinedPatterns = [];
    // v6 升级：S1 关闭可能仍激活的 BOSS AI 对话
    this.bossAIDialog = null;
    this.bossAIDialogNode = null;
    this.bossAIDialogState = null;
    this.bossKillTimes.push({
      name: b.def.name,
      atSec: (performance.now() - this.startedAt) / 1000,
      fraudType: b.def.fraudType,
      emoji: b.def.emoji,
    });
    // v3 升级：BOSS 击败必定掉落装备
    const dropId = rollEquipmentDrop(this.opts.difficulty, this.rng);
    this.save.ownedEquipments.push(dropId);
    this.pendingEquipDrops.push({ equipmentId: dropId, fromBoss: b.def.name });
    const dropDef = EQUIPMENT_MAP[dropId];
    if (dropDef) {
      this.emit({ type: "log", text: `[EQUIP_DROP]${dropId}` });
      // 装备掉落飘字（教育向：展示装备 lore）
      this.floats.push({
        x: b.x, y: b.y,
        text: `${dropDef.emoji} ${dropDef.name}`,
        color: dropDef.color,
        life: 2.5, maxLife: 2.5, size: 16,
        vx: 0, vy: -40, gravity: 0,
      });
    }
    // v2 升级：BOSS 击败慢镜头 + 识别清单（B4）
    this.bossDefeatSlowmoUntil = this.t + 2.5;
    this.bossDefeatIdentify = {
      name: b.def.name,
      identifyDetail: b.def.identifyDetail,
      protectList: b.def.protectList,
      caseStory: b.def.caseStory,
      emoji: b.def.emoji,
      fraudType: b.def.fraudType,
    };
    // v5 案例剧场触发：首次击败该 BOSS 时标记（场景层可读取并播放分镜）
    if (b.def.caseStory && !this.save.watchedCaseTheater.includes(b.def.id)) {
      this.caseTheaterTrigger = {
        bossName: b.def.name,
        caseStory: b.def.caseStory,
        identifyDetail: b.def.identifyDetail,
        protectList: b.def.protectList,
        emoji: b.def.emoji,
        fraudType: b.def.fraudType,
      };
      this.save.watchedCaseTheater.push(b.def.id);
    }
    // BOSS 击杀：超大连续爆炸 + 冲击波（spec：massive spawnBurst with shockwave）
    this.particles.spawnBurst(b.x, b.y, "#FFD666", { ring: true, sparks: 50, dots: 60, speed: 440, life: 1.4, size: 6, color2: b.def.color });
    this.particles.spawnBurst(b.x, b.y, b.def.color, { ring: false, sparks: 26, dots: 30, speed: 280, life: 1.2, size: 4 });
    this.spawnShock(b.x, b.y, 320, "#FFD666", 6);
    this.spawnShock(b.x, b.y, 240, b.def.color, 5);
    // spec：flash("#FFD666", 0.6) + glitch(0.8) + shake(15) + win sfx
    postFX.flash("#FFD666", 0.6, 2);
    postFX.glitch(0.8, 3);
    postFX.shake(15, 16);
    playSfx("win");
    // v4 升级：动态 BGM — BOSS 击败后恢复战斗曲（BossRush 模式除外，由阶段切换控制）
    if (this.opts.mode !== "bossRush") {
      this.switchBgm("battle");
    }
    this.shakeUntil = this.t + 0.8;
    this.hitstopUntil = this.t + 0.3; // BOSS 击杀大 hitstop
    // 展示反诈识破要点
    const tip = b.def.identify[Math.floor(this.rng() * b.def.identify.length)];
    const nextWaveIdx = this.wave + 1;
    const isLastCampaignWave = nextWaveIdx >= WAVES.length;
    this.boss = null;
    // v4：BossRush 模式 — 阶段推进 / 通关结算
    if (this.opts.mode === "bossRush") {
      this.handleBossRushStageClear(b.def, tip);
      this.persistSave();
      this.checkAchievements();
      this.emitHud();
      return;
    }
    if (isLastCampaignWave && !this.endless) {
      // v2 升级：第 10 波 BOSS 击败 → 进入无尽模式（A1）
      this.endless = true;
      this.endlessScale = 1.2;
      this.phase = "battle";
      this.toast = { text: `战役胜利！进入无尽模式 · ${tip}`, tone: "good", until: this.t + 4 };
      this.phaseTransitionText = "ENDLESS · 无尽模式";
      this.phaseTransitionUntil = this.t + 2.0;
      postFX.flash("#FF00E5", 0.5, 2);
      this.startWave(nextWaveIdx, 3.0);
    } else {
      // 继续下一波
      this.phase = "battle";
      this.toast = { text: `${b.def.name}已击败！${tip}`, tone: "good", until: this.t + 3.5 };
      postFX.flash("#52C41A", 0.3, 2);
      this.startWave(nextWaveIdx, 3.0);
    }
    // v4：BOSS 击败奖励天赋点（普通模式每只 +1）
    this.awardTalentPoints(1);
    this.persistSave();
    this.checkAchievements();
    this.emitHud();
  }

  /**
   * v4：BossRush 阶段击败处理
   * - 记录本战结果（用时/剩余 HP）
   * - 奖励天赋点
   * - 若为最后一战 → 通关结算；否则进入下一阶段（恢复 HP）
   */
  private handleBossRushStageClear(bossDef: BossDef, tip: string): void {
    const stageTime = this.t - this.bossRushStageStartedAt;
    const stageIdx = this.bossRushStageIdx;
    const isFinal = stageIdx === this.bossRushBossIds.length - 1;
    const stageResult: BossRushStageResult = {
      stage: stageIdx + 1,
      bossId: bossDef.id,
      bossName: bossDef.name,
      timeSec: stageTime,
      hpLeft: this.player.hp,
      maxHp: MAX_HP,
      win: true,
    };
    this.bossRushStageResults.push(stageResult);
    this.bossRushTotalTimeSec += stageTime;
    this.bossRushTotalScore += this.score;
    // 阶段奖励天赋点
    this.awardTalentPoints(BOSS_RUSH_CONFIG.talentPointPerStage);

    if (isFinal) {
      // 通关结算
      this.awardTalentPoints(BOSS_RUSH_CONFIG.clearTalentPoints);
      const result: BossRushResult = {
        cleared: true,
        totalTimeSec: this.bossRushTotalTimeSec,
        totalScore: this.bossRushTotalScore,
        stages: this.bossRushStageResults.slice(),
        talentPointsGained:
          BOSS_RUSH_CONFIG.talentPointPerStage * this.bossRushStageResults.length +
          BOSS_RUSH_CONFIG.clearTalentPoints,
      };
      // 更新 BossRush 最佳记录
      const prev = this.save.bossRushBest[this.opts.difficulty];
      if (!prev || result.totalTimeSec < prev.totalTimeSec || (result.totalTimeSec === prev.totalTimeSec && result.totalScore > prev.totalScore)) {
        this.save.bossRushBest = { ...this.save.bossRushBest, [this.opts.difficulty]: result };
      }
      this.win();
      return;
    }
    // 中间阶段：恢复 HP，进入下一战
    const restoreHp = Math.round(MAX_HP * BOSS_RUSH_CONFIG.hpRestoreRatio);
    this.player.hp = Math.min(MAX_HP, this.player.hp + restoreHp);
    this.player.appCharges = Math.max(this.player.appCharges, 1);
    this.toast = {
      text: `第 ${stageIdx + 1} 战击败 ${bossDef.name}！HP +${restoreHp} · ${tip}`,
      tone: "good",
      until: this.t + 3.5,
    };
    postFX.flash("#52C41A", 0.3, 2);
    // 休息 BOSS_RUSH_CONFIG.restSec 秒后开启下一战（由 update 循环驱动，暂停时不会推进）
    const nextIdx = stageIdx + 1;
    this.phaseTransitionText = `BOSS RUSH · 下一战 ${nextIdx + 1}/${this.bossRushBossIds.length}`;
    this.phaseTransitionUntil = this.t + BOSS_RUSH_CONFIG.restSec;
    this.bossRushNextStageIdx = nextIdx;
    this.bossRushNextStageAt = this.t + BOSS_RUSH_CONFIG.restSec;
    this.phase = "battle"; // 休息阶段保持在 battle，但无敌人
  }

  /** v4：奖励天赋点（跨局保留） */
  private awardTalentPoints(n: number): void {
    if (n <= 0) return;
    this.save.talentPoints += n;
    this.save.totalTalentPointsEarned += n;
    this.floats.push({
      x: this.player.x, y: this.player.y - 40,
      text: `✨ +${n} 天赋点`,
      color: "#B388FF",
      life: 2.0, maxLife: 2.0, size: 16,
      vx: 0, vy: -30, gravity: 0,
    });
  }

  /** v3：记录角色使用次数（跨局保留，用于统计/成就） */
  private recordCharacterUsage(): void {
    const id = this.character.id;
    this.save.characterUsage = {
      ...this.save.characterUsage,
      [id]: (this.save.characterUsage[id] ?? 0) + 1,
    };
  }

  /**
   * v4：影子挑战采样
   * - 每 0.15s 采样一次玩家位置 + 大招/炸弹状态
   * - 实时更新 ghostProgress（当前分数 vs 影子分数）
   */
  private updateGhostSampling(dt: number): void {
    // 更新影子进度
    if (this.ghostProgress) {
      this.ghostProgress.currentScore = this.score;
      this.ghostProgress.ahead = this.score > this.ghostProgress.ghostScore;
    }
    // 采样操作（无论是否挑战影子，都记录以备生成本局影子）
    if (this.t - this.lastGhostSampleT < 0.15) return;
    this.lastGhostSampleT = this.t;
    this.ghostInputs.push({
      t: this.t,
      x: this.player.x,
      y: this.player.y,
      bomb: false,
      ult: this.player.ultActiveUntil > this.t,
    });
  }

  /**
   * v4：本局结束写入排行榜 + 影子记录
   * 在 win()/lose() 持久化之前调用
   */
  private recordRunToLeaderboardAndGhost(win: boolean): void {
    const durationSec = (performance.now() - this.startedAt) / 1000;
    const date = dailyKey();
    const entry: ThunderLeaderboardEntry = {
      mode: this.opts.mode,
      difficulty: this.opts.difficulty,
      score: this.score,
      wave: this.opts.mode === "bossRush"
        ? this.bossRushStageResults.length
        : this.wave + 1,
      maxCombo: this.maxCombo,
      bossKills: this.bossesDefeated,
      durationSec,
      date,
      characterName: this.character.name,
    };
    // 写入每日 / 每周 / 全时段排行榜
    const dk = date;
    const wk = weeklyKey();
    const lb = this.save.leaderboard;
    lb.daily[dk] = insertLeaderboardEntry(lb.daily[dk] ?? [], entry);
    lb.weekly[wk] = insertLeaderboardEntry(lb.weekly[wk] ?? [], entry);
    lb.allTime = insertLeaderboardEntry(lb.allTime, entry);
    // 影子记录：仅保留分数 > 0 的局，最多 20 条
    if (this.score > 0 && this.ghostInputs.length > 0) {
      const ghost: GhostRecord = {
        id: `ghost_${Date.now()}`,
        mode: this.opts.mode,
        difficulty: this.opts.difficulty,
        score: this.score,
        inputs: this.ghostInputs.slice(0, 600), // 限制回放数据量
        characterName: this.character.name,
        date,
      };
      this.save.ghostRecords = [...this.save.ghostRecords, ghost].slice(-20);
    }
    // BossRush 模式：失败时也记录部分结果（用于显示已通过的阶段）
    if (this.opts.mode === "bossRush" && !win && this.bossRushStageResults.length > 0) {
      const partial: BossRushResult = {
        cleared: false,
        totalTimeSec: this.bossRushTotalTimeSec + (this.t - this.bossRushStageStartedAt),
        totalScore: this.bossRushTotalScore + this.score,
        stages: this.bossRushStageResults.slice(),
        talentPointsGained:
          BOSS_RUSH_CONFIG.talentPointPerStage * this.bossRushStageResults.length,
      };
      // 不覆盖已通关的最佳记录
      if (!this.save.bossRushBest[this.opts.difficulty]?.cleared) {
        this.save.bossRushBest = { ...this.save.bossRushBest, [this.opts.difficulty]: partial };
      }
    }
  }

  /** v5 结算：段位积分 + 每日任务 + 擦弹统计 + 模式最佳记录 */
  private settleV5Meta(win: boolean): void {
    // 1. 累计擦弹数（统计用）
    this.save.totalGrazeCount += this.grazeCount;
    // 2. 段位赛结算
    if (this.opts.mode === "ranked") {
      this.rankResult = computeRankDelta(this.save, win, this.score);
      applyRankResult(this.save, this.rankResult);
    }
    // 3. 周常挑战最佳记录 + 计数
    if (this.opts.mode === "weekly") {
      this.save.weeklyBestScore = Math.max(this.save.weeklyBestScore, this.score);
      this.save.weeklyPlayCount += 1;
    }
    // 4. 生存模式最高波次
    if (this.opts.mode === "survival" && win) {
      this.save.bestSurvivalWave = Math.max(this.save.bestSurvivalWave, this.wave + 1);
    }
    // 5. 极限挑战最高分
    if (this.opts.mode === "challenge") {
      this.save.bestChallengeScore = Math.max(this.save.bestChallengeScore, this.score);
    }
    // 6. 每日任务进度更新（按 kind 推送本局最终值）
    getTodayQuestProgress(this.save); // 确保当日任务初始化
    updateQuestProgress(this.save, "graze", this.grazeCount);
    updateQuestProgress(this.save, "kill", this.bustedCount);
    updateQuestProgress(this.save, "boss", this.bossesDefeated);
    updateQuestProgress(this.save, "combo", this.maxCombo);
    updateQuestProgress(this.save, "score", this.score);
    updateQuestProgress(this.save, "wave", this.wave + 1);
  }

  private win(): void {
    if (this.over) return;
    this.over = true;
    this.phase = "won";
    // v2 升级：持久化存档（D1）
    this.save.bestScore = Math.max(this.save.bestScore, this.score);
    this.save.bestCombo = Math.max(this.save.bestCombo, this.maxCombo);
    this.save.totalBusted += this.bustedCount;
    this.save.totalPlayTime += (performance.now() - this.startedAt) / 1000;
    // v6 升级：S4 赛季通行证结算经验（基础经验 + BOSS 经验已在 killBoss 累计，此处补发通关奖励）
    this.addSeasonPassExp(THUNDER_SEASON_PASS.baseExpPerRun);
    // v3：记录角色使用次数
    this.recordCharacterUsage();
    // v4：写入排行榜 + 影子记录 + BossRush 部分结果
    this.recordRunToLeaderboardAndGhost(true);
    // v5：段位赛结算 + 每日任务进度 + 擦弹统计
    this.settleV5Meta(true);
    // v7：结算自适应 AI 评分 / 剧情通关 / 知识图谱 / 证书解锁
    this.settleV7Meta(true);
    this.persistSave();
    this.result = {
      gameId: "thunder",
      win: true,
      score: this.score + Math.floor(this.player.hp / HP_PER_YUANBAO) * 300,
      bustedCount: this.bustedCount,
      tipId: randomTip(5).id,
      stats: this.buildFinalStats(true),
    };
    postFX.flash("#52C41A", 0.5, 2);
    playSfx("win");
    this.emit({ type: "result", payload: this.result });
    this.emitHud();
  }

  /** 构建本局最终统计（C4 专属结算页用） */
  private buildFinalStats(win: boolean): ThunderFinalStats {
    const stats: ThunderFinalStats = {
      score: this.score,
      maxCombo: this.maxCombo,
      bustedCount: this.bustedCount,
      bossesDefeated: this.bossesDefeated,
      wave: this.wave + 1,
      endless: this.endless,
      endlessScale: this.endlessScale,
      difficulty: this.opts.difficulty,
      mode: this.opts.mode,
      elapsedSec: (performance.now() - this.startedAt) / 1000,
      killStats: { ...this.killStats },
      bossKillTimes: this.bossKillTimes.slice(),
      comboHistory: this.comboHistory.slice(),
      win,
      deathCause: this.deathCause ?? undefined,
    };
    // v4：BossRush 模式附加阶段结果
    if (this.opts.mode === "bossRush" && this.bossRushStageResults.length > 0) {
      stats.bossRushStages = this.bossRushStageResults.map((r) => ({
        stage: r.stage,
        bossName: r.bossName,
        timeSec: r.timeSec,
        emoji: getBossDefById(r.bossId)?.emoji ?? "🎯",
      }));
      stats.bossRushTotalTimeSec = this.bossRushTotalTimeSec;
    }
    // v5：填充擦弹 / 段位 / 案例剧场数据
    stats.grazeCount = this.grazeCount;
    if (this.rankResult) {
      stats.rankDelta = this.rankResult.delta;
      stats.rankTierUp = this.rankResult.tierUp;
      stats.rankTierDown = this.rankResult.tierDown;
      const newTierDef = RANK_TIER_MAP[this.rankResult.newTier];
      stats.rankNewTierName = newTierDef.name;
      stats.rankNewTierEmoji = newTierDef.emoji;
    }
    if (this.caseTheaterTrigger) {
      stats.caseTheaterTrigger = this.caseTheaterTrigger;
    }
    // v6 升级：填充 v6 结算统计
    stats.parryCount = this.parryCount;
    stats.mantraTriggeredCount = this.mantraTriggeredCount;
    stats.aiDialogBustedCount = this.aiDialogBustedCount;
    if (this.unlockedArchivesThisRun.length > 0) {
      stats.unlockedArchives = this.unlockedArchivesThisRun.slice();
    }
    if (this.seasonPassGainedExp > 0) {
      stats.seasonPassGainedExp = this.seasonPassGainedExp;
    }
    if (this.seasonPassUnlockedRewards.length > 0) {
      stats.seasonPassUnlockedRewards = this.seasonPassUnlockedRewards.slice();
    }
    // v7 升级：填充 v7 结算统计
    if (this.opts.mode === "story" && this.currentStoryStage) {
      stats.storyStageCleared = win;
      stats.storyRank = this.storyRank ?? undefined;
      if (this.currentStoryStage.isEnding && this.currentStoryStage.endingId) {
        stats.storyEndingUnlocked = this.currentStoryStage.endingId;
      }
    }
    if (this.opts.mode === "rpg" && this.currentRPGScenario) {
      stats.rpgBustScore = this.rpgBustScore;
      if (this.currentRPGEnding) stats.rpgEndingId = this.currentRPGEnding.id;
    }
    if (this.enableAdaptiveAI) {
      stats.adaptiveSkillDelta = this.adaptiveSkillDelta;
      stats.adaptiveDifficultyMul = this.adaptiveState?.difficultyMul;
    }
    if (this.enableProceduralPatterns) {
      stats.proceduralSeedUsed = this.proceduralSeedUsed;
    }
    if (this.unlockedCertificatesThisRun.length > 0) {
      stats.unlockedCertificates = this.unlockedCertificatesThisRun.map((c) => c.id);
    }
    return stats;
  }

  private lose(): void {
    if (this.over) return;
    this.over = true;
    this.phase = "lost";
    // v2 升级：设置死亡原因（B2 死亡复盘）
    if (this.lastDamageBoss) {
      const b = this.lastDamageBoss;
      this.deathCause = {
        fraudType: b.fraudType,
        emoji: b.emoji,
        name: b.name,
        identifyDetail: b.identifyDetail,
        protectList: b.protectList,
        caseStory: b.caseStory,
      };
    } else if (this.lastDamageTypeId) {
      const cause = DEATH_CAUSE_BY_ENEMY[this.lastDamageTypeId];
      const def = ENEMIES[this.lastDamageTypeId];
      if (cause && def) {
        this.deathCause = {
          fraudType: cause.fraudType,
          emoji: def.emoji,
          name: def.name,
          identifyDetail: cause.identifyDetail,
          protectList: cause.protectList,
          caseStory: cause.caseStory,
        };
      }
    }
    // v2 升级：持久化存档（D1）
    this.save.bestScore = Math.max(this.save.bestScore, this.score);
    this.save.bestCombo = Math.max(this.save.bestCombo, this.maxCombo);
    if (this.endless) {
      this.save.bestEndlessWave = Math.max(this.save.bestEndlessWave, this.wave + 1 - WAVES.length);
    }
    this.save.totalBusted += this.bustedCount;
    this.save.totalPlayTime += (performance.now() - this.startedAt) / 1000;
    // v4：写入排行榜 + 影子记录 + BossRush 部分结果
    this.recordRunToLeaderboardAndGhost(false);
    // v5：段位赛结算 + 每日任务进度 + 擦弹统计
    this.settleV5Meta(false);
    // v6 升级：S4 赛季通行证结算经验（失败也给 30% 基础经验）
    this.addSeasonPassExp(Math.floor(THUNDER_SEASON_PASS.baseExpPerRun * 0.3));
    // v7：结算自适应 AI 评分 / 知识图谱 / 证书解锁（失败也更新评分与统计）
    this.settleV7Meta(false);
    this.persistSave();
    this.result = {
      gameId: "thunder",
      win: false,
      score: this.score,
      bustedCount: this.bustedCount,
      tipId: randomTip(4).id,
      stats: this.buildFinalStats(false),
    };
    postFX.flash("#E5353B", 0.5, 2);
    postFX.glitch(0.8, 4);
    postFX.shake(12, 20);
    playSfx("lose");
    this.emit({ type: "result", payload: this.result });
    this.emitHud();
  }

  private emitHud(): void {
    const { title, gap } = titleFor(this.score);
    const hud: ThunderHud = {
      hp: this.player.hp,
      maxHp: MAX_HP,
      shield: this.player.appCharges > 0,
      appCharges: this.player.appCharges,
      overseasUntil: Math.max(0, this.player.overseasUntil - this.t),
      awarenessUntil: Math.max(0, this.player.awarenessUntil - this.t),
      freezeUntil: Math.max(0, this.freezeUntil - this.t),
      hotlineUntil: Math.max(0, this.player.hotlineUntil - this.t),
      bankFreezeUntil: Math.max(0, this.player.bankFreezeUntil - this.t),
      adUntil: Math.max(0, this.player.adUntil - this.t),
      slowMoUntil: Math.max(0, this.player.slowMoUntil - this.t),
      raids: this.player.raids,
      score: this.score,
      titleName: title.name,
      titleColor: title.color,
      nextTitleGap: gap,
      combo: this.combo,
      weapon: this.effectiveWeapon(),
      weaponXp: this.player.weaponXp,
      weaponXpMax: WEAPON_XP_TABLE[this.player.weapon].xpMax,
      weaponBranch: this.player.weaponBranch,
      weaponBranchLevel: this.player.weaponBranchLevel,
      scoreMultiplier: this.scoreMultiplier(),
      phase: this.phase,
      bossHp: this.boss ? Math.ceil(this.boss.hp) : undefined,
      bossMax: this.boss ? this.boss.maxHp : undefined,
      bossPhase: this.boss?.phase,
      bossName: this.boss?.def.name,
      bossFraudType: this.boss?.def.fraudType,
      bossEnraged: this.boss?.enraged,
      wave: this.wave + 1,
      totalWaves: WAVES.length,
      phaseTransitionUntil: this.phaseTransitionUntil > this.t ? this.phaseTransitionUntil - this.t : 0,
      phaseTransitionText: this.phaseTransitionText,
      achievement: this.achievementToast && this.t < this.achievementToast.until
        ? { name: this.achievementToast.name, desc: this.achievementToast.desc, emoji: this.achievementToast.emoji }
        : undefined,
      branchOptions: this.phase === "branch" ? this.branchOptions.slice() : undefined,
      branchWave: this.branchRound,
      // ===== v2 升级字段 =====
      difficulty: this.opts.difficulty,
      mode: this.opts.mode,
      endless: this.endless,
      endlessScale: this.endlessScale,
      theme: this.currentTheme.id,
      ultimateCharge: this.player.ultCharge / ULTIMATE_MAX_CHARGE,
      ultimateReady: this.player.ultCharge >= ULTIMATE_MAX_CHARGE,
      chargeProgress: this.player.charging ? this.player.chargeProgress : 0,
      charging: this.player.charging,
      dashCd: Math.max(0, this.player.dashCd),
      dashInvincibleUntil: Math.max(0, this.player.dashInvincibleUntil - this.t),
      roguelikeBuffs: this.roguelikeBuffs.slice(),
      roguelikeOptions: this.phase === "roguelike" ? this.roguelikeOptions.slice() : undefined,
      paused: this.isPaused,
      bossEntranceStage: this.boss?.entranceStage,
      bossEntranceUntil: this.boss ? Math.max(0, this.boss.entranceStageUntil - this.t) : undefined,
      bossDefeatSlowmoUntil: this.bossDefeatSlowmoUntil > this.t ? this.bossDefeatSlowmoUntil - this.t : 0,
      bossDefeatIdentify: this.bossDefeatSlowmoUntil > this.t ? this.bossDefeatIdentify ?? undefined : undefined,
      shipDamaged: this.player.hp < MAX_HP * 0.3,
      killStats: { ...this.killStats },
      maxCombo: this.maxCombo,
      bossesDefeated: this.bossesDefeated,
      elapsedSec: (performance.now() - this.startedAt) / 1000,
      deathCause: this.over && !this.result?.win ? this.deathCause ?? undefined : undefined,
      mantraTexts: this.mantraTexts.filter((m) => m.until > this.t),
      // ===== v3 升级字段 =====
      characterId: this.character.id,
      characterName: this.character.name,
      characterEmoji: this.character.emoji,
      characterFraudTypes: this.charFraudTypes.slice(),
      equippedEquipments: this.equippedEquipments.map((e) => ({ slot: e.slot, name: e.name, emoji: e.emoji })),
      weaponAwakened: this.player.weaponBranchLevel >= 4,
      awakeningName: this.currentAwakening()?.name,
      awakeningToast: this.awakeningToast && this.awakeningToast.until && this.t < this.awakeningToast.until
        ? { name: this.awakeningToast.name, mantra: this.awakeningToast.mantra, emoji: this.awakeningToast.emoji }
        : undefined,
      // ===== v4 升级字段 =====
      talentBuffs: this.talentNodes.map((n) => ({ name: n.name, emoji: n.emoji, branch: n.branch })),
      setBonus: this.setBonus
        ? { name: this.setBonus.name, desc: this.setBonus.desc, emoji: "✨", rarity: this.setBonus.rarity }
        : null,
      bossRush: this.opts.mode === "bossRush"
        ? {
            stage: this.bossRushStageIdx + 1,
            totalStages: this.bossRushBossIds.length,
            timeSec: this.bossRushTotalTimeSec + (this.t - this.bossRushStageStartedAt),
            stageResults: this.bossRushStageResults.map((r) => ({
              stage: r.stage, bossName: r.bossName, timeSec: r.timeSec, emoji: getBossDefById(r.bossId)?.emoji ?? "🎯",
            })),
          }
        : undefined,
      ghostProgress: this.ghostProgress
        ? { ...this.ghostProgress }
        : null,
      talentPoints: this.save.talentPoints,
      // ===== v5 升级字段 =====
      grazeCharge: this.grazeCharge,
      grazeCount: this.grazeCount,
      grazeBoostUntil: Math.max(0, this.grazeBoostUntil - this.t),
      counterRelation: this.boss
        ? getCounterRelation(this.player.weaponBranch, this.boss.def.fraudType)
        : (this.enemies[0] ? getCounterRelation(this.player.weaponBranch, this.enemies[0].def.fraudType) : "neutral"),
      drones: this.drones.map((d) => {
        const def = DRONES[d.def];
        return { kind: d.def, name: def.name, emoji: def.emoji };
      }),
      droneUntil: this.drones.length > 0 ? Math.max(0, Math.min(...this.drones.map((d) => d.until - this.t))) : 0,
      bossPhaseNum: this.boss ? this.bossPhaseNum : undefined,
      bossPhaseTotal: this.boss?.def.phases ? this.boss.def.phases.length + 1 : undefined,
      bossTransformFlash: this.bossTransformFlashUntil > this.t ? this.bossTransformFlashUntil - this.t : 0,
      bossTransformWarning: this.bossTransformWarning,
      protectHp: this.survivalTarget?.hp,
      protectMaxHp: this.survivalTarget?.maxHp,
      protectEmoji: this.survivalTarget?.def.emoji,
      noPowerups: this.noPowerups,
      rankName: this.opts.mode === "ranked" ? RANK_TIER_MAP[rankTierForPoints(this.save.rankPoints).id].name : undefined,
      rankEmoji: this.opts.mode === "ranked" ? RANK_TIER_MAP[rankTierForPoints(this.save.rankPoints).id].emoji : undefined,
      rankDelta: this.rankResult?.delta,
      caseTheaterTrigger: this.caseTheaterTrigger ?? undefined,
      // ===== v6 升级字段 =====
      bossAIDialog: this.bossAIDialogState
        ? {
            dialogId: this.bossAIDialogState.dialogId,
            dialogTitle: this.bossAIDialogState.dialogTitle,
            currentNodeId: this.bossAIDialogState.currentNodeId,
            turns: this.bossAIDialogState.turns.slice(-6), // 仅保留最近 6 轮避免过大
            currentBossLine: this.bossAIDialogState.currentBossLine,
            currentRedFlag: this.bossAIDialogState.currentRedFlag,
            currentTactic: this.bossAIDialogState.currentTactic,
            bustScore: this.bossAIDialogState.bustScore,
            passThreshold: this.bossAIDialogState.passThreshold,
            turnCount: this.bossAIDialogState.turnCount,
            maxTurns: this.bossAIDialogState.maxTurns,
            ended: this.bossAIDialogState.ended,
            ending: this.bossAIDialogState.ending,
            endingDesc: this.bossAIDialogState.endingDesc,
            currentChoices: this.bossAIDialogState.currentChoices,
            lastFeedback: this.bossAIDialogState.lastFeedback ?? null,
          }
        : null,
      mantraChain: {
        combo: this.combo,
        nextThreshold: this.nextMantraThreshold(),
        nextMantra: this.nextMantraText(),
        unlockedMantras: this.unlockedMantras.map((m) => m.mantra),
        activeMantra: this.activeMantra?.mantra ?? null,
        activeUntil: this.activeMantra ? Math.max(0, this.activeMantraUntil - this.t) : 0,
        fullMantraUnlocked: this.unlockedMantras.some((m) => m.comboThreshold === 50),
        fullMantra: FULL_MANTRA_TEXT,
      },
      fraudArchiveTrigger: this.fraudArchiveTrigger,
      seasonPass: this.buildSeasonPassHud(),
      parry: {
        parrying: this.t < this.player.parryShieldUntil,
        cooldown: Math.max(0, this.player.parryCd),
        cooldownMax: V6_PARRY_CONFIG.cooldownMax,
        perfectWindow: Math.max(0, this.player.parryPerfectWindow),
        perfectWindowMax: V6_PARRY_CONFIG.perfectWindowMax,
        reflectMul: V6_PARRY_CONFIG.reflectMul,
        perfectTriggered: this.parryPerfectTriggered,
      },
      superAwakening: this.superAwakening
        ? {
            branch: this.player.weaponBranch,
            level: this.player.weaponBranchLevel as 6 | 7,
            name: this.superAwakening.name,
            emoji: this.superAwakening.emoji,
            ultimateCharge: this.superAwakeningUltCharge,
            ultimateReady: this.superAwakeningUltCharge >= 1,
            ultimateName: this.superAwakening.effect.ultimate?.name ?? "",
          }
        : null,
      bossActiveCombinedPatterns: this.bossActiveCombinedPatterns.slice(),
      parryCount: this.parryCount,
      mantraTriggeredCount: this.mantraTriggeredCount,
      aiDialogBustedCount: this.aiDialogBustedCount,
      // ===== v7 升级字段 =====
      story: this.buildStoryHud(),
      rpg: this.buildRPGHud(),
      lesson: this.buildLessonHud(),
      adaptiveDifficultyMul: this.adaptiveState?.difficultyMul,
      adaptiveSkillScore: this.adaptiveState?.skillScore,
      proceduralPatternId: this.currentProceduralPattern?.id ?? null,
      proceduralSeed: this.proceduralSeedUsed,
      v7Toast: this.v7Toast && this.t < this.v7Toast.until ? { ...this.v7Toast } : null,
    };
    // v6：完美格挡触发标记一次性消费（场景层读取后清除）
    if (this.parryPerfectTriggered) this.parryPerfectTriggered = false;
    // v6：档案触发标记一次性消费（场景层读取后清除）
    if (this.fraudArchiveTrigger) this.fraudArchiveTrigger = null;
    // v3：觉醒 toast 一次性消费（显示 3 秒后清除）
    if (this.awakeningToast) {
      if (!this.awakeningToast.until) this.awakeningToast.until = this.t + 3;
      if (this.t >= this.awakeningToast.until) this.awakeningToast = null;
    }
    this.emit({ type: "hud", payload: hud as unknown as Record<string, string | number> });
    if (this.toast && this.t < this.toast.until) {
      this.emit({ type: "toast", text: this.toast.text, tone: this.toast.tone });
    }
  }

  protected render(): void {
    const ctx = this.ctx;
    const shaking = this.t < this.shakeUntil;
    const sx = shaking ? (Math.random() - 0.5) * 8 : 0;
    const sy = shaking ? (Math.random() - 0.5) * 8 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    clearCanvas(ctx, W, H, "#070E1F");
    this.drawNebula(ctx);
    drawGrid(ctx, W, H, 32, "rgba(0,229,255,0.05)");
    this.drawStars(ctx);

    // 冻结视觉色调
    if (this.t < this.freezeUntil) {
      ctx.fillStyle = "rgba(179,136,255,0.10)";
      ctx.fillRect(0, 0, W, H);
    }

    // 冲击波（在敌人下方画）
    this.drawShocks(ctx);

    // Powerups
    for (const pu of this.powerups) {
      const def = POWERUPS[pu.kind];
      const wob = Math.sin((this.t - pu.born) * 4) * 2;
      ctx.save();
      ctx.translate(pu.x, pu.y + wob);
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fillStyle = def.color + "22";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
      if (def.trap) ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.emoji, 0, 0);
      ctx.restore();
    }

    // Enemies
    for (const e of this.enemies) this.drawEnemy3D(ctx, e);
    // Boss
    if (this.boss) this.drawBoss3D(ctx, this.boss);
    // 激光扫射（覆盖在 BOSS 之上）
    this.drawLaserSweep(ctx);

    // Bullets
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // v5 无人机伴随渲染
    for (const d of this.drones) {
      const ddef = DRONES[d.def];
      const pulse = Math.sin(this.t * 6) * 0.3 + 0.7;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = ddef.color + "22";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = ddef.color;
      ctx.shadowColor = ddef.color;
      ctx.shadowBlur = 8 * pulse;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ddef.emoji, 0, 0);
      ctx.restore();
    }

    // v5 生存模式保护目标渲染
    if (this.survivalTarget) {
      const t = this.survivalTarget;
      const flash = t.hitFlash > 0 ? t.hitFlash / 0.3 : 0;
      ctx.save();
      ctx.translate(t.x, t.y);
      // 外圈光晕
      ctx.beginPath();
      ctx.arc(0, 0, t.def.radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(82,196,26,${0.15 + flash * 0.3})`;
      ctx.fill();
      // 主体
      ctx.lineWidth = 3;
      ctx.strokeStyle = flash > 0 ? "#FF4D4F" : "#52C41A";
      ctx.shadowColor = flash > 0 ? "#FF4D4F" : "#52C41A";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, t.def.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.def.emoji, 0, -2);
      ctx.restore();
    }

    // Player ship (3D)
    if (!this.over || this.phase === "won") this.drawShip3D(ctx);

    this.particles.render(ctx);

    // Floating texts
    for (const f of this.floats) {
      const alpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      drawText(ctx, f.text, f.x, f.y, {
        size: f.size,
        color: f.color,
        weight: "900",
        align: "center",
        shadow: { color: f.color, blur: 6 },
      });
      ctx.globalAlpha = 1;
    }

    // Raid flash
    if (this.t < this.raidFlashUntil) {
      const alpha = (this.raidFlashUntil - this.t) / 0.6;
      ctx.fillStyle = `rgba(255,122,26,${alpha * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD on canvas
    this.drawCanvasHud(ctx);

    // Prep countdown
    if (!this.waveActive && this.phase === "battle" && !this.over) {
      const remaining = Math.max(0, this.prepUntil - this.t);
      drawText(ctx, `反诈波次 ${this.wave + 1}`, W / 2, H / 2 - 30, {
        size: 28, color: ACCENT, weight: "900", align: "center",
        shadow: { color: ACCENT, blur: 14 },
      });
      drawText(ctx, `${remaining.toFixed(1)}s`, W / 2, H / 2 + 10, {
        size: 40, color: "#F0F4FF", weight: "900", align: "center",
        font: Theme.fonts.mono,
        shadow: { color: "#00E5FF", blur: 12 },
      });
    }

    // 阶段切换：屏幕扭曲色调
    if (this.t < this.phaseTransitionUntil) {
      const alpha = (this.phaseTransitionUntil - this.t) / 1.2;
      ctx.fillStyle = `rgba(255,0,229,${alpha * 0.15})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  private drawShocks(ctx: CanvasRenderingContext2D): void {
    if (this.shocks.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of this.shocks) {
      const alpha = Math.max(0, s.life / s.maxLife);
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * (0.4 + alpha * 0.6);
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    const t = this.t;
    // Layer 1 (far): 50 stars, slow scroll, dim, size 1
    ctx.fillStyle = "#FFFFFF";
    for (let i = 0; i < 50; i++) {
      const x = (i * 137 + 23) % W;
      const y = ((i * 211 + t * 20) % H);
      ctx.globalAlpha = 0.2 + (i % 3) * 0.07;
      ctx.fillRect(x, y, 1, 1);
    }
    // Layer 2 (mid): 30 stars, medium scroll, normal, size 1-2
    for (let i = 0; i < 30; i++) {
      const x = (i * 197 + 41) % W;
      const y = ((i * 313 + t * 50) % H);
      const s = (i % 2) + 1;
      ctx.globalAlpha = 0.4 + (i % 4) * 0.1;
      ctx.fillRect(x, y, s, s);
    }
    // Layer 3 (near): 15 stars, fast scroll, bright with glow, size 2-3
    for (let i = 0; i < 15; i++) {
      const x = (i * 263 + 73) % W;
      const y = ((i * 419 + t * 100) % H);
      const s = (i % 2) + 2;
      ctx.globalAlpha = 0.6 + (i % 5) * 0.08;
      ctx.shadowColor = "#FFFFFF";
      ctx.shadowBlur = 4;
      ctx.fillRect(x, y, s, s);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /** 星云背景：2-3 个柔和移动的径向渐变（紫/青/蓝） */
  private drawNebula(ctx: CanvasRenderingContext2D): void {
    const t = this.t;
    const clouds = [
      { bx: W * 0.3, by: H * 0.25, color: "157,78,221", scale: 1.0 },   // 紫
      { bx: W * 0.7, by: H * 0.6, color: "0,229,255", scale: 1.2 },     // 青
      { bx: W * 0.4, by: H * 0.85, color: "59,127,239", scale: 0.9 },   // 蓝
    ];
    for (const c of clouds) {
      const x = c.bx + Math.sin(t * 0.15 + c.bx) * 30;
      const y = c.by + Math.cos(t * 0.12 + c.by) * 24;
      const r = 220 * c.scale;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c.color},0.18)`);
      g.addColorStop(0.5, `rgba(${c.color},0.06)`);
      g.addColorStop(1, `rgba(${c.color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  /** 3D 反诈战机：分层渐变 + 高光 + 引擎焰 */
  private drawShip3D(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const blink = this.t < p.invincibleUntil && Math.floor(this.t * 12) % 2 === 0;
    if (blink) return;
    const aware = this.t < p.awarenessUntil;
    const overseas = this.t < p.overseasUntil;
    ctx.save();
    ctx.translate(p.x, p.y);

    // 反诈意识光环
    if (aware) {
      const r = SHIP_R + 14 + Math.sin(this.t * 10) * 3;
      const g = ctx.createRadialGradient(0, 0, SHIP_R, 0, 0, r + 8);
      g.addColorStop(0, "rgba(255,90,96,0)");
      g.addColorStop(0.7, "rgba(255,90,96,0.25)");
      g.addColorStop(1, "rgba(255,90,96,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
      ctx.fill();
    }
    // 不接境外来电：旋转蓝环
    if (overseas) {
      ctx.save();
      ctx.rotate(this.t * 2);
      ctx.strokeStyle = "#3B7FEF";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#3B7FEF";
      ctx.shadowBlur = 12;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, SHIP_R + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // 国家反诈APP 护盾
    if (p.appCharges > 0) {
      const r = SHIP_R + 8 + Math.sin(this.t * 6) * 2;
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      // 护盾次数小点
      ctx.shadowBlur = 0;
      for (let i = 0; i < p.appCharges; i++) {
        const a = -Math.PI / 2 + (i - (p.appCharges - 1) / 2) * 0.4;
        ctx.fillStyle = "#00E5FF";
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (r + 4), Math.sin(a) * (r + 4), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 96110热线：红色脉冲环 + 信号波纹
    if (this.t < p.hotlineUntil) {
      const pulse = (this.t * 2) % 1;
      const r = SHIP_R + 16 + pulse * 18;
      ctx.strokeStyle = `rgba(255,59,107,${1 - pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      // 中心红环
      ctx.strokeStyle = "#FF3B6B";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#FF3B6B";
      ctx.shadowBlur = 10;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, SHIP_R + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }
    // 银行止付：绿色护盾环（金融盾牌）
    if (this.t < p.bankFreezeUntil) {
      ctx.save();
      ctx.rotate(this.t * -1.5);
      const r = SHIP_R + 6;
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, "#52C41A");
      g.addColorStop(0.5, "#A0FF80");
      g.addColorStop(1, "#1F7A0A");
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.shadowColor = "#52C41A";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    // 反诈宣传员：金色光环 + 拾取磁吸粒子
    if (this.t < p.adUntil) {
      const r = SHIP_R + 22 + Math.sin(this.t * 5) * 4;
      const g = ctx.createRadialGradient(0, 0, SHIP_R, 0, 0, r);
      g.addColorStop(0, "rgba(255,176,32,0)");
      g.addColorStop(0.6, "rgba(255,176,32,0.2)");
      g.addColorStop(1, "rgba(255,176,32,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // 旋转金粒
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 6;
      for (let i = 0; i < 4; i++) {
        const a = this.t * 3 + (i / 4) * Math.PI * 2;
        const rr = SHIP_R + 18;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // 引擎焰（后部）
    const flameLen = 16 + Math.random() * 6;
    const fg = ctx.createLinearGradient(0, 14, 0, 14 + flameLen);
    fg.addColorStop(0, "#FFFFFF");
    fg.addColorStop(0.3, "#FFD666");
    fg.addColorStop(1, "rgba(255,122,26,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-7, 14);
    ctx.lineTo(0, 14 + flameLen);
    ctx.lineTo(7, 14);
    ctx.closePath();
    ctx.fill();

    // 后翼（深色，透视梯形）
    ctx.fillStyle = "#0A4A6E";
    ctx.beginPath();
    ctx.moveTo(-20, 12);
    ctx.lineTo(20, 12);
    ctx.lineTo(14, 18);
    ctx.lineTo(-14, 18);
    ctx.closePath();
    ctx.fill();

    // 侧翼（3D 渐变）
    const wingCol = aware ? "#FF5A60" : ACCENT;
    const wgL = ctx.createLinearGradient(-22, 0, -8, 0);
    wgL.addColorStop(0, wingCol);
    wgL.addColorStop(1, "#0A4A6E");
    ctx.fillStyle = wgL;
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-22, 12);
    ctx.lineTo(-14, 14);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    const wgR = ctx.createLinearGradient(8, 0, 22, 0);
    wgR.addColorStop(0, "#0A4A6E");
    wgR.addColorStop(1, wingCol);
    ctx.fillStyle = wgR;
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.lineTo(22, 12);
    ctx.lineTo(14, 14);
    ctx.lineTo(6, 6);
    ctx.closePath();
    ctx.fill();

    // 机身（3D 渐变菱形）
    const bodyG = ctx.createLinearGradient(-10, -22, 10, 14);
    bodyG.addColorStop(0, "#9FE3FF");
    bodyG.addColorStop(0.5, wingCol);
    bodyG.addColorStop(1, "#0A4A6E");
    ctx.fillStyle = bodyG;
    ctx.shadowColor = wingCol;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(-9, 6);
    ctx.lineTo(-5, 14);
    ctx.lineTo(5, 14);
    ctx.lineTo(9, 6);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // 机身高光
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-4, 2);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();

    // 驾驶舱（3D 椭圆 + 高光）
    const cockG = ctx.createRadialGradient(-1, -8, 1, 0, -6, 6);
    cockG.addColorStop(0, "#FFFFFF");
    cockG.addColorStop(0.6, "#3B7FEF");
    cockG.addColorStop(1, "#0A1929");
    ctx.fillStyle = cockG;
    ctx.beginPath();
    ctx.ellipse(0, -6, 4.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 3D 敌方形象：投影 + 球体渐变 + 高光 + emoji */
  private drawEnemy3D(ctx: CanvasRenderingContext2D, e: Enemy): void {
    // 投影
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 18, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(e.x, e.y);
    // 精英敌人：外光环 + 旋转尖刺
    if (e.def.elite) {
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fillStyle = e.def.color + "11";
      ctx.fill();
      ctx.save();
      ctx.rotate(this.t * 1.5);
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.shadowColor = e.def.color;
      ctx.shadowBlur = 8;
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22);
        ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    // 外发光环
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fillStyle = e.def.color + "22";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = e.def.color;
    ctx.shadowColor = e.def.color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3D 球体（径向渐变）
    const sg = ctx.createRadialGradient(-6, -6, 2, 0, 0, 18);
    sg.addColorStop(0, "#FFFFFF");
    sg.addColorStop(0.35, e.def.color);
    sg.addColorStop(1, "#0A1929");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    // 受击高光（白色覆盖）
    if (e.hitFlash > 0) {
      ctx.globalAlpha = clamp(e.hitFlash / 0.12, 0, 1);
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // emoji
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.def.emoji, 0, 0);
    ctx.restore();

    // 护盾环（紫色）
    if (e.shield > 0) {
      ctx.save();
      ctx.strokeStyle = "#9D4EDD";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#9D4EDD";
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.6 + Math.sin(this.t * 8) * 0.2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 24, 0, Math.PI * 2);
      ctx.stroke();
      // 护盾闪光
      if (e.shieldFlash > 0) {
        ctx.globalAlpha = e.shieldFlash / 0.12;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 24, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 护盾分段刻度
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2 + this.t * 0.5;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * 22, e.y + Math.sin(a) * 22);
        ctx.lineTo(e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26);
        ctx.stroke();
      }
      ctx.restore();
    }

    // HP bar
    if (e.hp < e.maxHp) {
      const w = 36;
      const x = e.x - w / 2;
      const y = e.y - 28;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = "#E5353B";
      ctx.fillRect(x, y, w * (e.hp / e.maxHp), 3);
    }
  }

  /** 3D BOSS：多层光环 + 旋转环 + 形状核心 + 阶段色 */
  private drawBoss3D(ctx: CanvasRenderingContext2D, b: Boss): void {
    // 阶段色：阶段越高越亮/越红
    const baseColor = b.def.color;
    const phaseColor = b.phase === 1 ? baseColor : b.phase === 2 ? "#FF7A1A" : "#FF00E5";
    // 投影
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 48, 52, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(b.x, b.y);

    // 外层光环
    const auraG = ctx.createRadialGradient(0, 0, 30, 0, 0, 60);
    auraG.addColorStop(0, phaseColor + "44");
    auraG.addColorStop(1, phaseColor + "00");
    ctx.fillStyle = auraG;
    ctx.beginPath();
    ctx.arc(0, 0, b.def.ultimate ? 68 : 58, 0, Math.PI * 2);
    ctx.fill();

    // 狂暴红色脉冲环
    if (b.enraged) {
      const pulse = (Math.sin(this.t * 8) + 1) / 2;
      ctx.save();
      ctx.strokeStyle = "#FF00E5";
      ctx.lineWidth = 3 + pulse * 2;
      ctx.shadowColor = "#FF00E5";
      ctx.shadowBlur = 16 + pulse * 8;
      ctx.globalAlpha = 0.7 + pulse * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // 旋转外环
    ctx.save();
    ctx.rotate(this.t * 1.2);
    ctx.strokeStyle = phaseColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = phaseColor;
    ctx.shadowBlur = 14;
    ctx.setLineDash([18, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 反向旋转内环
    ctx.save();
    ctx.rotate(-this.t * 1.8);
    ctx.strokeStyle = "#FFD666";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();

    // 形状外框（3D 渐变，根据 def.shape）
    const shapeG = ctx.createLinearGradient(-40, -40, 40, 40);
    shapeG.addColorStop(0, "#FFFFFF");
    shapeG.addColorStop(0.4, phaseColor);
    shapeG.addColorStop(1, "#3A0010");
    ctx.fillStyle = shapeG;
    ctx.shadowColor = phaseColor;
    ctx.shadowBlur = b.def.ultimate ? 22 : 16;
    this.drawBossShape(ctx, b.def.shape, 40);
    ctx.shadowBlur = 0;

    // 核心球体（径向渐变）
    const coreG = ctx.createRadialGradient(-8, -8, 4, 0, 0, 34);
    coreG.addColorStop(0, "#FFFFFF");
    coreG.addColorStop(0.4, phaseColor);
    coreG.addColorStop(1, "#0A0010");
    ctx.fillStyle = coreG;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();

    // 受击高光
    if (b.hitFlash > 0) {
      ctx.globalAlpha = clamp(b.hitFlash / 0.12, 0, 1);
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // emoji
    ctx.font = b.def.ultimate ? "46px sans-serif" : "40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.def.emoji, 0, 0);

    // 阶段标识 + 终极标记
    ctx.font = "900 14px 'JetBrains Mono', monospace";
    ctx.fillStyle = b.def.ultimate ? "#FF00E5" : "#FFD666";
    ctx.fillText(b.def.ultimate ? `⚡P${b.phase}⚡` : `P${b.phase}`, 0, -42);
    ctx.restore();

    // Boss HP bar (top)
    const barX = 60;
    const barY = 56;
    const barW = W - 120;
    const barH = 10;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = phaseColor;
    ctx.strokeRect(barX, barY, barW, barH);
    const ratio = clamp(b.hp / b.maxHp, 0, 1);
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, phaseColor);
    grad.addColorStop(1, "#FFD666");
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    const ultTag = b.def.ultimate ? "⚡终极⚡ " : "";
    drawText(ctx, `${ultTag}${b.def.name} · ${Math.ceil(b.hp)}/${b.maxHp}`, W / 2, barY - 6, {
      size: 11, color: "#F0F4FF", weight: "700", align: "center",
      font: Theme.fonts.mono,
    });
  }

  /** 根据 shape 绘制 BOSS 外框 */
  private drawBossShape(ctx: CanvasRenderingContext2D, shape: BossDef["shape"], r: number): void {
    ctx.beginPath();
    switch (shape) {
      case "hex": {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }
      case "skull": {
        // 骷髅头：圆顶 + 下颌
        ctx.arc(0, -4, r, Math.PI, 0);
        ctx.lineTo(r * 0.7, r * 0.4);
        ctx.lineTo(r * 0.35, r * 0.2);
        ctx.lineTo(0, r * 0.5);
        ctx.lineTo(-r * 0.35, r * 0.2);
        ctx.lineTo(-r * 0.7, r * 0.4);
        ctx.closePath();
        break;
      }
      case "crown": {
        // 皇冠：底座 + 3 尖角
        ctx.moveTo(-r, r * 0.4);
        ctx.lineTo(-r, -r * 0.2);
        ctx.lineTo(-r * 0.55, -r * 0.9);
        ctx.lineTo(-r * 0.2, -r * 0.3);
        ctx.lineTo(0, -r);
        ctx.lineTo(r * 0.2, -r * 0.3);
        ctx.lineTo(r * 0.55, -r * 0.9);
        ctx.lineTo(r, -r * 0.2);
        ctx.lineTo(r, r * 0.4);
        ctx.closePath();
        break;
      }
      case "eye": {
        // 眼睛形：椭圆
        ctx.ellipse(0, 0, r, r * 0.65, 0, 0, Math.PI * 2);
        break;
      }
      case "tower": {
        // 塔形：底宽顶窄
        ctx.moveTo(-r * 0.8, r);
        ctx.lineTo(-r * 0.5, -r * 0.8);
        ctx.lineTo(-r * 0.3, -r);
        ctx.lineTo(r * 0.3, -r);
        ctx.lineTo(r * 0.5, -r * 0.8);
        ctx.lineTo(r * 0.8, r);
        ctx.closePath();
        break;
      }
    }
    ctx.fill();
  }

  private drawCanvasHud(ctx: CanvasRenderingContext2D): void {
    // 顶部中央：分数 + 称号
    drawText(ctx, this.score.toLocaleString(), W / 2, 30, {
      size: 22, color: "#F0F4FF", weight: "900", align: "center",
      font: Theme.fonts.mono,
      shadow: { color: ACCENT, blur: 8 },
    });
    const { title } = titleFor(this.score);
    drawText(ctx, title.name, W / 2, 48, {
      size: 12, color: title.color, weight: "900", align: "center",
      shadow: { color: title.color, blur: 6 },
    });

    // 左上：道具状态
    let ly = 22;
    if (this.player.appCharges > 0) {
      drawText(ctx, `🛡×${this.player.appCharges}`, 16, ly, {
        size: 12, color: "#00E5FF", weight: "700",
        font: Theme.fonts.mono,
      });
      ly += 16;
    }
    if (this.t < this.player.overseasUntil) {
      drawText(ctx, `📵 ${Math.ceil(this.player.overseasUntil - this.t)}s`, 16, ly, {
        size: 12, color: "#3B7FEF", weight: "700",
        font: Theme.fonts.mono,
      });
      ly += 16;
    }
    if (this.t < this.player.awarenessUntil) {
      drawText(ctx, `🧠 ${Math.ceil(this.player.awarenessUntil - this.t)}s`, 16, ly, {
        size: 12, color: "#FF5A60", weight: "700",
        font: Theme.fonts.mono,
      });
      ly += 16;
    }
    if (this.t < this.freezeUntil) {
      drawText(ctx, `📸 ${Math.ceil(this.freezeUntil - this.t)}s`, 16, ly, {
        size: 12, color: "#B388FF", weight: "700",
        font: Theme.fonts.mono,
      });
      ly += 16;
    }
    if (this.t < this.player.hotlineUntil) {
      drawText(ctx, `📞 ${Math.ceil(this.player.hotlineUntil - this.t)}s`, 16, ly, {
        size: 12, color: "#FF3B6B", weight: "700",
        font: Theme.fonts.mono,
        shadow: { color: "#FF3B6B", blur: 4 },
      });
      ly += 16;
    }
    if (this.t < this.player.bankFreezeUntil) {
      drawText(ctx, `🏦 ${Math.ceil(this.player.bankFreezeUntil - this.t)}s`, 16, ly, {
        size: 12, color: "#52C41A", weight: "700",
        font: Theme.fonts.mono,
        shadow: { color: "#52C41A", blur: 4 },
      });
      ly += 16;
    }
    if (this.t < this.player.adUntil) {
      drawText(ctx, `📢 ${Math.ceil(this.player.adUntil - this.t)}s`, 16, ly, {
        size: 12, color: "#FFB020", weight: "700",
        font: Theme.fonts.mono,
        shadow: { color: "#FFB020", blur: 4 },
      });
    }

    // BOSS身份（顶部右侧标签）
    if (this.boss && this.boss.def) {
      const def = this.boss.def;
      const label = def.ultimate ? "终极BOSS" : "电诈BOSS";
      drawText(ctx, `${label}·${def.name}`, W - 16, 22, {
        size: 11, color: def.ultimate ? "#FF3B6B" : "#E5353B", weight: "900", align: "right",
        font: Theme.fonts.mono,
        shadow: { color: def.ultimate ? "#FF3B6B" : "#E5353B", blur: 6 },
      });
      drawText(ctx, def.fraudType, W - 16, 38, {
        size: 9, color: "#FF8A8A", weight: "600", align: "right",
        font: Theme.fonts.mono,
      });
    }

    // 连击（左下）
    if (this.combo >= 2) {
      drawText(ctx, `COMBO ×${this.combo}`, 24, H - 32, {
        size: 14, color: "#FFD666", weight: "900",
        font: Theme.fonts.mono,
        shadow: { color: "#FFD666", blur: 8 },
      });
    }

    // 武器 + 武器分支 + 突击次数（左下）
    drawText(ctx, `WPN LV${this.effectiveWeapon()}`, 24, H - 16, {
      size: 11, color: ACCENT, weight: "700",
      font: Theme.fonts.mono,
    });
    // 武器分支显示（新增）
    if (this.player.weaponBranch !== "normal" && this.player.weaponBranchLevel > 0) {
      const bd = WEAPON_BRANCHES[this.player.weaponBranch as Exclude<WeaponBranch, "normal">];
      drawText(ctx, `${bd.emoji}${bd.name} Lv.${this.player.weaponBranchLevel}`, 24, H - 48, {
        size: 11, color: bd.color, weight: "700",
        font: Theme.fonts.mono,
        shadow: { color: bd.color, blur: 4 },
      });
    }
    drawText(ctx, `RAID ×${this.player.raids}`, W - 24, H - 16, {
      size: 11, color: "#FF7A1A", weight: "700", align: "right",
      font: Theme.fonts.mono,
    });
    // 操作提示（底部中央）
    drawText(ctx, "↑↓←→ / 拖拽 移动战机", W / 2, H - 16, {
      size: 10, color: "rgba(159,227,255,0.5)", weight: "500", align: "center",
      font: Theme.fonts.mono,
    });

    // 波次（右下）
    drawText(ctx, `反诈波次 ${this.wave + 1}/${WAVES.length}`, W - 24, H - 32, {
      size: 11, color: this.phase === "boss" ? "#E5353B" : "#7A8FB0",
      weight: "700", align: "right", font: Theme.fonts.mono,
    });
    if (this.phase === "boss") {
      drawText(ctx, "BOSS战", W - 24, H - 48, {
        size: 11, color: "#E5353B", weight: "900", align: "right",
        font: Theme.fonts.mono,
        shadow: { color: "#E5353B", blur: 6 },
      });
    }
  }
}
