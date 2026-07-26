// ====================================================================
// 反诈职业经理人 · 类型定义（v3 全面升级版）
// 新增：元素克制 / 探员独有大招 / 敌人特殊技能 / 连击系统 / 每日挑战 / 关卡主题
// ====================================================================

/** 元素系：5 系循环相克 */
export type Element = "law" | "tech" | "emotion" | "threat" | "money";

/** 探员独有大招效果类型 */
export type UltKind =
  | "pierce"      // 穿透：对一整排敌人造成大量伤害
  | "slowAll"     // 信号干扰：全场减速 + 受伤加深
  | "aoe"         // 数据风暴：在最强敌人位置 AOE 爆炸
  | "healShield"  // 全民防线：全队回血 + 基地护盾
  | "critBuff"    // 精准狙击：暴击率翻倍 + 暴击伤害加成
  | "assassinate" // 暗影刺杀：瞬移到最强敌人身边一击
  // ===== v6 新增 =====
  | "summon"      // 召唤：召唤一个临时探员协战
  | "freeze"      // 冰冻：冻结全场敌人 2 秒
  | "timeWarp"    // 时间扭曲：敌人时间减慢 50%
  | "shieldWall";  // 盾墙：所有探员获得护盾

/** 大招定义：每个探员独有 */
export interface UltDef {
  kind: UltKind;
  name: string;
  desc: string;
  /** 数值参数（伤害倍率/治疗比例/暴击率等） */
  value: number;
  /** 持续时间（秒，buff 类用） */
  duration?: number;
  /** AOE 半径（aoe 类用） */
  radius?: number;
}

/** 敌人特殊技能 */
export type EnemyAbility =
  | "none"
  | "shield"     // 首次命中伤害减半（卡农）
  | "taunt"      // 嘲讽：吸引附近投射物（假客服）
  | "fear"       // 恐惧：附近探员射速 -30%（恐吓语音）
  | "heal"       // 治疗光环（甜言蜜语，已存在）
  | "speedBoost" // 低血量加速（钓鱼链接）
  // ===== v6 新增 =====
  | "split"      // 分裂：死亡时分裂为 2 个小怪
  | "invisible"  // 隐身：间歇性隐身，无法被攻击
  | "teleport"   // 瞬移：低血量瞬移到出口附近
  | "reflect"    // 反弹：反射 20% 投射物伤害
  | "enrage";    // 狂暴：附近敌人死亡时自身强化

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  emoji: string;
  hp: number;
  attack: number;
  range: number;
  fireRate: number;
  projectileSpeed: number;
  color: string;
  ult: string;
  ultDesc: string;
  splash?: number;
  slow?: number;
  crit?: number;
  bio: string;
  // ===== v3 新增 =====
  /** 元素系（决定克制关系） */
  element: Element;
  /** 独有大招定义 */
  ultDef: UltDef;
  /** 角色剪影类型（用于 Canvas 绘制） */
  silhouette: "assault" | "comms" | "tech" | "social" | "sniper" | "stealth" | "medic" | "drone";
  // ===== v6 新增 =====
  /** 探员解锁条件描述（仅可解锁探员） */
  unlockHint?: string;
  /** 探员解锁所需反诈积分 */
  unlockCost?: number;
  /** 是否为 v6 新增探员（用于图鉴分类） */
  isNew?: boolean;
}

export interface EnemyDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  damage: number;
  reward: number;
  color: string;
  fraudType: string;
  heal?: number;
  // ===== v3 新增 =====
  /** 元素系（决定弱点） */
  element: Element;
  /** 特殊技能 */
  ability: EnemyAbility;
  /** 敌人形状（用于 Canvas 绘制，crown 仅 BOSS 用） */
  shape: "hexagon" | "window" | "phone" | "heart" | "hook" | "card" | "crown"
    | "ghost" | "virus" | "mask" | "wallet" | "briefcase";
  // ===== v6 新增 =====
  /** 是否为 v6 新增敌人（用于图鉴分类） */
  isNew?: boolean;
  /** 击败解锁的图鉴 id */
  codexId?: string;
}

export interface WaveEntry {
  typeId: string;
  count: number;
  interval: number;
  lane: number; // 0/1/2
  delay: number;
}

export interface Wave {
  enemies: WaveEntry[];
}

export type ManagerPhase = "deploy" | "battle" | "upgrade" | "won" | "lost";

/** 反诈职业经理人模式（v6：新增 tower 爬塔 / challenge 极限挑战） */
export type ManagerMode = "classic" | "timeTrial" | "bossRush" | "endlessRush" | "daily" | "tower" | "challenge";

/** 探员升级类型：从 8 项中随机三选一全局强化（v5 分支迷宫版扩展） */
export type AgentUpgradeKind =
  | "attack"     // 攻击力 +
  | "firerate"   // 射速 +
  | "range"      // 射程 +
  | "crit"       // 暴击率 + / 暴击伤害 +
  | "hpregen"    // 探员每秒回血
  | "doubleShot" // 双发：每次射击额外发射一枚投射物
  | "pierce"     // 穿透弹：投射物命中后不消失，可穿透至多 N 个敌人
  | "vampire";   // 吸血：造成伤害时为最近的探员回血

/** 升级选项元数据 */
export interface UpgradeChoice {
  id: AgentUpgradeKind;
  emoji: string;
  title: string;
  desc: string;
  color: string;
}

/**
 * 部署槽位（v4 迷宫版：col/row 为迷宫网格坐标，参考 maze.ts 的 deployTiles）
 * - 旧版 3x3 网格语义已废弃
 * - 现指向迷宫的岗哨位（pathSet 之外、与路径 8 邻接的格子）
 */
export interface DeploySlot {
  row: number; // 迷宫行（0..MAZE_ROWS-1）
  col: number; // 迷宫列（0..MAZE_COLS-1）
  agentId: string | null;
}

/** BOSSrush 模式专用 BOSS 定义 */
export interface BossRushDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  damage: number;
  reward: number;
  color: string;
  fraudType: string;
  scale: number; // 视觉缩放
  /** 召唤小怪 typeId */
  summonTypeId?: string;
  summonInterval?: number;
  summonCount?: number;
  summonLane?: number;
  /** 狂暴触发血量百分比 0..1 */
  enrageAtHp?: number;
  enrageSpeedMul?: number;
  enrageDamageMul?: number;
  /** 技能名称与描述（HUD 展示） */
  skillName: string;
  skillDesc: string;
  // ===== v3 新增 =====
  /** BOSS 元素系（决定弱点） */
  element: Element;
  /** BOSS 形状（用于 Canvas 绘制，更显赫） */
  shape: "hexagon" | "window" | "phone" | "heart" | "hook" | "card" | "crown"
    | "ghost" | "virus" | "mask" | "wallet" | "briefcase";
  /** BOSS 三阶段技能（HP 100% / 60% / 30% 触发） */
  phases?: BossPhase[];
  /** BOSS 剧情对话（v6 新增：开战前 + 击破后） */
  dialogue?: BossDialogue;
  /** 是否为 v6 新增 BOSS（用于图鉴分类） */
  isNew?: boolean;
}

/** BOSS 阶段定义 */
export interface BossPhase {
  /** 触发血量百分比（0..1） */
  atHp: number;
  /** 阶段名称 */
  name: string;
  /** 阶段描述 */
  desc: string;
  /** 该阶段技能效果 */
  effect: "enrage" | "doubleSummon" | "healSelf" | "speedBurst" | "shield"
    | "teleport" | "split" | "invisible" | "reflect";
  /** 效果数值 */
  value?: number;
}

/**
 * 关卡（层级）定义：3 级递进难度
 * 社区反诈 → 市级反诈 → 跨境反诈
 */
export interface LevelDef {
  id: number;
  name: string;          // 社区反诈 / 市级反诈 / 跨境反诈
  subtitle: string;      // 副标题（过渡时展示）
  accent: string;        // 主题色
  /** 该关卡目标波数（绝对波数，1-indexed）；达到即过关 */
  targetWave: number;
  /** 该关卡允许出现的敌人 typeId 列表 */
  enemyTypes: string[];
  /** 敌人 HP 倍率 */
  hpMul: number;
  /** 敌人速度倍率 */
  speedMul: number;
  /** 敌人伤害倍率 */
  dmgMul: number;
  /** 敌人奖励倍率 */
  rewardMul: number;
  /** 刷怪间隔倍率（越小越密集） */
  spawnIntervalMul: number;
  /** 每波敌人数量倍率 */
  countMul: number;
  /** 是否包含 BOSS（farmer mini-boss） */
  hasBoss: boolean;
  /** 过关时解锁的养成探员索引（在 CULT_AGENTS 中的下标） */
  unlockCultAgentIdx: number;
  // ===== v3 新增 =====
  /** 关卡视觉主题（决定背景与道路样式） */
  theme: LevelTheme;
}

/** 关卡视觉主题：背景色 + 道路样式 + 装饰 */
export interface LevelTheme {
  /** 深色背景 */
  bgDeep: string;
  /** 网格颜色 */
  gridColor: string;
  /** 道路主色 */
  roadColor: string;
  /** 道路虚线色 */
  roadLine: string;
  /** 远景剪影色（建筑/树丛） */
  silhouetteColor: string;
  /** 装饰类型 */
  decoration: "residential" | "city" | "border";
  /** 装饰 emoji（远景点缀） */
  decorEmojis: string[];
}

/** 养成探员定义：被动增益型（区别于已部署的战斗探员） */
export interface CultAgentDef {
  id: string;
  name: string;       // 巡查员 / 分析师 / 技术员
  role: string;
  emoji: string;
  color: string;
  desc: string;
  /** 增益类型 */
  buff: "slow" | "score" | "weakness";
  /** 每级增益数值（slow=减速比例, score=得分加成, weakness=伤害加成） */
  buffPerLevel: number;
  /** 作用范围（slow 类型用，x 距离） */
  range?: number;
}

/** 养成探员运行时状态 */
export interface CultAgentState {
  id: string;
  def: CultAgentDef;
  level: number;       // 1..3
  maxLevel: number;
  unlocked: boolean;
  /** 在场上的 x 坐标（渲染用） */
  x: number;
  y: number;
}

// ====================================================================
// v3 新增：连击系统 / 每日挑战修饰符
// ====================================================================

/** 连击状态（运行时） */
export interface ComboState {
  /** 当前连击数 */
  count: number;
  /** 上次击杀时间（秒） */
  lastKillAt: number;
  /** 当前倍率（1.0..2.5） */
  multiplier: number;
  /** 最高连击数 */
  maxCount: number;
  /** 失效阈值（秒，无击杀则重置） */
  decaySec: number;
}

/** 每日挑战修饰符 */
export interface DailyModifier {
  id: string;
  name: string;
  desc: string;
  /** 严重度 1..3（影响分数倍率） */
  severity: 1 | 2 | 3;
  /** 修饰符效果（运行时由引擎读取） */
  effect: DailyModifierEffect;
  /** emoji 图标 */
  emoji: string;
  /** 主题色 */
  color: string;
}

/** 每日修饰符效果类型 */
export type DailyModifierEffect =
  | { kind: "bossOnly" }                       // 全员 BOSS：所有敌人变 BOSS（小规模）
  | { kind: "noUlt" }                          // 禁大招：能量无法积累
  | { kind: "speedyEnemies"; mul: number }     // 敌人加速
  | { kind: "doubleHp" }                        // 敌人血量翻倍
  | { kind: "noHeal"; agentMul: number }        // 探员无法回血，但攻击力 +50%
  | { kind: "instantUlt" }                      // 大招瞬发：开局即可放大
  | { kind: "fastWaves"; mul: number }          // 刷怪间隔缩短
  | { kind: "timeLimit"; sec: number }           // 时间限制：N 秒内通关
  | { kind: "noUpgrades" }                      // 禁用探员升级
  | { kind: "oneLane"; lane: number };           // 单道作战：仅 1 lane 刷怪

export interface ManagerHud {
  phase: ManagerPhase;
  baseHp: number;
  baseMax: number;
  wave: number;
  totalWaves: number;
  score: number;
  enemiesLeft: number;
  energy: number; // 0..100
  ultReady: boolean;
  agents: { id: string; hp: number; maxHp: number; alive: boolean }[];
  waveProgress: number;
  /** 新增：模式信息 */
  mode: ManagerMode;
  modeLabel: string;
  /** 限时挑战剩余秒数 */
  timeLeft?: number;
  /** BOSSrush 当前 BOSS */
  bossName?: string;
  bossEmoji?: string;
  bossHp?: number;
  bossMaxHp?: number;
  bossEnraged?: boolean;
  bossSkill?: string;
  bossIdx?: number;
  bossTotal?: number;
  /** 无尽 Rush 绝对波数与层级 */
  endlessWave?: number;
  rushTier?: number;
  /** 探员升级系统：当前经验值 */
  upgradeXp: number;
  /** 探员升级系统：升级所需经验值 */
  upgradeXpMax: number;
  /** 探员升级系统：是否可升级 */
  upgradeReady: boolean;
  /** 探员升级系统：当前已升级次数（v5 分支迷宫版：最多 8 次） */
  upgradeCount: number;
  /** 探员升级系统：升级上限 */
  upgradeMax: number;
  /** 升级阶段：3 个选项（仅 phase === "upgrade" 时输出） */
  upgradeChoices?: UpgradeChoice[];
  /** 各探员已获得升级（用于场景层显示等级） */
  agentUpgrades: { id: string; level: number; upgrades: AgentUpgradeKind[] }[];

  // ===== 关卡（层级）系统（新增可选字段） =====
  /** 当前关卡（1..maxLevel） */
  level?: number;
  /** 最大关卡数 */
  maxLevel?: number;
  /** 当前关卡名称（社区反诈 / 市级反诈 / 跨境反诈） */
  levelName?: string;
  /** 当前关卡主题色 */
  levelAccent?: string;
  /** 当前关卡目标波数（绝对） */
  levelTargetWave?: number;
  /** 关卡过渡中（场景可据此切换展示） */
  levelTransitioning?: boolean;

  // ===== 养成探员系统（新增可选字段） =====
  /** 养成探员列表（含解锁状态与等级） */
  cultAgents?: {
    id: string;
    name: string;
    emoji: string;
    color: string;
    level: number;
    maxLevel: number;
    unlocked: boolean;
    /** 增益类型标签 */
    buff: string;
    /** 当前增益数值（已按等级计算） */
    buffValue: number;
    /** 描述 */
    desc: string;
  }[];
  /** 养成探员可升级（分数达标） */
  cultUpgradeReady?: boolean;
  /** 养成探员下次升级所需分数 */
  cultUpgradeCost?: number;
  /** 即将升级的养成探员 id（分数达标时最低等级者） */
  cultUpgradeTargetId?: string;

  // ===== v3 新增：连击系统 =====
  /** 当前连击数 */
  comboCount?: number;
  /** 当前连击倍率 */
  comboMul?: number;
  /** 是否处于连击活跃状态（用于 HUD 高亮） */
  comboActive?: boolean;
  /** 最高连击数 */
  comboMax?: number;

  // ===== v3 新增：每日挑战 =====
  /** 每日挑战修饰符列表 */
  dailyModifiers?: DailyModifier[];
  /** 每日挑战 seed（YYYY-MM-DD） */
  dailySeed?: string;

  // ===== v3 新增：BOSS 阶段 =====
  /** BOSS 当前阶段索引（0/1/2） */
  bossPhaseIdx?: number;
  /** BOSS 阶段名称 */
  bossPhaseName?: string;

  // ===== v3 新增：探员独有大招信息 =====
  /** 大招名称 */
  ultName?: string;
  /** 大招描述 */
  ultDesc?: string;
  /** 大招 emoji 图标 */
  ultEmoji?: string;

  // ===== v3 新增：元素克制提示 =====
  /** 最近一次元素克制命中（"强效"/"弱效"） */
  lastElementalHint?: { kind: "strong" | "weak"; from: string; to: string; at: number };

  // ===== v4 迷宫版新增 =====
  /** 当前迷宫名称（社区防骗阵线 / 都市反诈中枢 / 跨境电诈围剿线 / 随机迷宫） */
  mazeName?: string;
  /** 当前迷宫主题色（道路/入口/出口） */
  mazeAccent?: string;
  /** 击杀获取资源总数（与 upgradeXp 同步，但语义上是"资源"） */
  resourceTotal?: number;

  // ===== v6 全面升级新增 =====
  /** 战术装置库存（剩余可放置数 + 冷却剩余时间） */
  tacticalDevices?: { kind: TacticalDeviceKind; remaining: number; cooldownLeft: number }[];
  /** 战术暂停剩余次数 */
  tacticalPauseRemaining?: number;
  /** 当前激活的技能链（用于 HUD 高亮） */
  activeSkillLinks?: { id: string; name: string; remaining: number }[];
  /** 当前激活的元素反应（场地效果） */
  activeElementReactions?: { kind: ElementReactionKind; remaining: number }[];
  /** 战间答题弹窗（仅答题待答时输出） */
  pendingQuiz?: QuizQuestion;
  /** v7：当前答题是否为错题重练（用于 UI 高亮） */
  pendingQuizIsRetry?: boolean;
  /** v7：爬塔 Roguelike 事件弹窗（仅 tower 模式事件待选时输出） */
  pendingTowerEvent?: TowerEventDef;
  /** 答题 buff 剩余时间 */
  quizBuffUntil?: number;
  /** 当前爬塔层数（tower 模式） */
  towerFloor?: number;
  /** 当前赛季信息 */
  seasonInfo?: { season: number; score: number; rank: string; weekCompleted: string[] };
  /** 当前激活的极限词缀 */
  challengeAffixes?: ChallengeAffix[];
  /** 当前装备的遗物（运行时效果已应用） */
  equippedRelics?: string[];
  /** 探员装备信息（agentId → 装备 id） */
  agentEquipment?: Record<string, string>;
  /** 探员皮肤信息（agentId → 皮肤 id） */
  agentSkins?: Record<string, string>;
}

// ====================================================================
// v6 全面升级：天赋树系统
// 每探员 3 系天赋（攻/防/辅），每系 5 节点，用反诈积分解锁
// ====================================================================

/** 天赋分支：攻 / 防 / 辅 */
export type TalentBranch = "offense" | "defense" | "support";

/** 天赋节点定义 */
export interface TalentNode {
  /** 节点 id（在探员 + 分支内唯一） */
  id: string;
  /** 所属分支 */
  branch: TalentBranch;
  /** 层级（1..5，需按顺序解锁） */
  tier: number;
  /** 节点名称 */
  name: string;
  /** 节点描述 */
  desc: string;
  /** 解锁消耗反诈积分 */
  cost: number;
  /** 效果类型（运行时由 engine 读取） */
  effect: TalentEffect;
  /** emoji 图标 */
  emoji: string;
}

/** 天赋效果 */
export type TalentEffect =
  | { kind: "attackFlat"; value: number }            // 攻击力 +
  | { kind: "attackPct"; value: number }             // 攻击力 % +
  | { kind: "hpFlat"; value: number }                // 生命值 +
  | { kind: "hpPct"; value: number }                 // 生命值 % +
  | { kind: "rangePct"; value: number }              // 射程 % +
  | { kind: "fireratePct"; value: number }           // 射速 % +
  | { kind: "critRate"; value: number }              // 暴击率 +
  | { kind: "critDmg"; value: number }               // 暴击伤害 +
  | { kind: "ultChargeMul"; value: number }          // 大招充能倍率
  | { kind: "ultPowerMul"; value: number }           // 大招威力倍率
  | { kind: "cooldownReduce"; value: number }        // 战术装置冷却缩减
  | { kind: "elementBonus"; element: Element; value: number }; // 元素伤害加成

/** 探员天赋树（3 分支 × 5 层） */
export interface TalentTree {
  /** 探员 id */
  agentId: string;
  /** 3 分支节点 */
  branches: Record<TalentBranch, TalentNode[]>;
}

// ====================================================================
// v6 全面升级：遗物系统（类杀戮尖塔，每局结束选 1 件下局携带）
// ====================================================================

/** 遗物稀有度 */
export type RelicRarity = "common" | "rare" | "epic" | "legendary";

/** 遗物定义 */
export interface RelicDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  rarity: RelicRarity;
  color: string;
  /** 效果（运行时由 engine 读取） */
  effect: RelicEffect;
  /** 来源：BOSS 击破 / 爬塔层 / 答题奖励 */
  source: "boss" | "tower" | "quiz" | "shop";
}

/** 遗物效果 */
export type RelicEffect =
  | { kind: "startEnergy"; value: number }            // 开局能量 +
  | { kind: "energyRegenMul"; value: number }         // 能量回复倍率
  | { kind: "scoreMul"; value: number }               // 得分倍率
  | { kind: "coinMul"; value: number }                // 金币掉落倍率
  | { kind: "startShield"; value: number }            // 开局基地护盾
  | { kind: "agentHpRegen"; value: number }           // 探员每秒回血
  | { kind: "firstHitFree"; }                          // 首次命中免疫
  | { kind: "pierceAll"; }                             // 投射物穿透所有敌人
  | { kind: "comboDecayExtend"; value: number }        // 连击衰减延长
  | { kind: "extraUpgrade"; value: number }            // 额外升级次数
  | { kind: "reviveOnce"; }                            // 复活一次（基地 30% 血）
  | { kind: "dailyLuck"; value: number };              // 每日挑战运气 +

// ====================================================================
// v6 全面升级：装备系统（每探员 2 槽位：武器 / 徽章）
// ====================================================================

/** 装备槽位 */
export type EquipmentSlot = "weapon" | "badge";

/** 装备定义 */
export interface EquipmentDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  slot: EquipmentSlot;
  rarity: RelicRarity;
  color: string;
  /** 适用探员 id（空表示通用） */
  agentId?: string;
  /** 效果 */
  effect: EquipmentEffect;
  /** 合成所需材料（按材料 id 索引数量） */
  craftCost?: Record<string, number>;
}

/** 装备效果 */
export type EquipmentEffect =
  | { kind: "attackFlat"; value: number }
  | { kind: "attackPct"; value: number }
  | { kind: "hpFlat"; value: number }
  | { kind: "critRate"; value: number }
  | { kind: "critDmg"; value: number }
  | { kind: "rangeFlat"; value: number }
  | { kind: "fireratePct"; value: number }
  | { kind: "splash"; value: number }
  | { kind: "pierce"; value: number }
  | { kind: "lifesteal"; value: number }
  | { kind: "slowOnHit"; value: number; duration: number };

// ====================================================================
// v6 全面升级：剧情对话系统（BOSS 战前 3-4 句对白）
// ====================================================================

/** 对白行 */
export interface DialogueLine {
  /** 说话者名称 */
  speaker: string;
  /** 说话者 emoji */
  emoji: string;
  /** 台词 */
  text: string;
  /** 头像色（用于对话框描边） */
  color: string;
  /** 立场：玩家方 / 敌方 */
  side: "player" | "enemy";
}

/** BOSS 剧情对话（开战前 + 击破后） */
export interface BossDialogue {
  /** 关联 BOSS id */
  bossId: string;
  /** 开战前对白 */
  intro: DialogueLine[];
  /** 击破后对白 */
  outro: DialogueLine[];
}

// ====================================================================
// v6 全面升级：战间答题系统（每 5 波弹一题，答对获 buff）
// ====================================================================

/** 答题题目 */
export interface QuizQuestion {
  id: string;
  /** 题目 */
  question: string;
  /** 4 个选项 */
  options: string[];
  /** 正确选项索引（0..3） */
  correctIdx: number;
  /** 解析（答错时展示） */
  explanation: string;
  /** 反诈类型标签 */
  fraudType: string;
  /** 难度 1..3 */
  difficulty: 1 | 2 | 3;
}

/** 答题 buff 效果 */
export type QuizBuff =
  | { kind: "attackPct"; value: number; duration: number }
  | { kind: "energy"; value: number }
  | { kind: "scoreMul"; value: number; duration: number }
  | { kind: "shield"; value: number };

// ====================================================================
// v6 全面升级：图鉴系统（敌人 / 探员 / 案件 三类）
// ====================================================================

/** 图鉴类别 */
export type CodexCategory = "enemy" | "agent" | "case";

/** 图鉴条目 */
export interface CodexEntry {
  id: string;
  category: CodexCategory;
  name: string;
  emoji: string;
  /** 简短描述 */
  short: string;
  /** 详细描述（图鉴页展开） */
  detail: string;
  /** 反诈知识点 */
  tip: string;
  /** 解锁条件描述 */
  unlockHint: string;
  /** 关联实体 id（敌人/探员/BOSS） */
  refId: string;
  /** 主题色 */
  color: string;
}

// ====================================================================
// v6 全面升级：战术装置系统（玩家可放置 3 种装置，限 3 个/局）
// ====================================================================

/** 战术装置类型 */
export type TacticalDeviceKind = "barrier" | "decoy" | "emp";

/** 战术装置定义 */
export interface TacticalDeviceDef {
  kind: TacticalDeviceKind;
  name: string;
  emoji: string;
  desc: string;
  color: string;
  /** 持续时间（秒） */
  duration: number;
  /** 冷却时间（秒） */
  cooldown: number;
  /** 效果半径 */
  radius: number;
  /** 效果 */
  effect: TacticalDeviceEffect;
}

/** 战术装置效果 */
export type TacticalDeviceEffect =
  | { kind: "slow"; mul: number }            // 减速
  | { kind: "taunt" }                         // 嘲讽吸引
  | { kind: "stun"; duration: number };       // 眩晕

// ====================================================================
// v6 全面升级：技能链系统（探员组合技）
// ====================================================================

/** 技能链定义 */
export interface SkillLink {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  color: string;
  /** 触发所需的探员 id 组合（同时部署） */
  requiredAgents: string[];
  /** 触发条件 */
  trigger: SkillLinkTrigger;
  /** 效果 */
  effect: SkillLinkEffect;
  /** 冷却时间（秒） */
  cooldown: number;
}

/** 技能链触发条件 */
export type SkillLinkTrigger =
  | { kind: "onDeploy" }                       // 部署时触发
  | { kind: "onUlt"; agentId: string }         // 某探员放大招时触发
  | { kind: "onCombo"; count: number }         // 连击达到 N 时触发
  | { kind: "onKill"; agentId: string };        // 某探员击杀时触发

/** 技能链效果 */
export type SkillLinkEffect =
  | { kind: "aoe"; radius: number; dmgMul: number }
  | { kind: "healAll"; ratio: number }
  | { kind: "buff"; attackPct: number; duration: number }
  | { kind: "debuff"; slowMul: number; duration: number }
  | { kind: "energy"; value: number };

// ====================================================================
// v6 全面升级：元素反应系统（5 系元素叠加触发场地效果）
// ====================================================================

/** 元素反应类型 */
export type ElementReactionKind =
  | "steam"          // 水+火 → 蒸汽隐匿（探员短暂无敌）
  | "overload"       // 电+水 → 范围眩晕
  | "freeze"         // 水+冰 → 减速强化
  | "burn"           // 火+草 → 持续灼烧
  | "conductivity"   // 电+金属 → 传导伤害
  | "resonance";     // 同元素叠加 → 共振增伤

/** 元素反应定义 */
export interface ElementReactionDef {
  kind: ElementReactionKind;
  name: string;
  emoji: string;
  desc: string;
  color: string;
  /** 触发所需元素组合 */
  requiredElements: [Element, Element];
  /** 持续时间（秒） */
  duration: number;
  /** 效果 */
  effect: ElementReactionEffect;
}

/** 元素反应效果 */
export type ElementReactionEffect =
  | { kind: "agentInvuln"; duration: number }       // 探员无敌
  | { kind: "enemyStun"; radius: number; duration: number }
  | { kind: "enemySlow"; mul: number; duration: number; radius: number }
  | { kind: "enemyBurn"; dmgPerSec: number; duration: number; radius: number }
  | { kind: "enemyChain"; dmgMul: number; radius: number }
  | { kind: "damageBoost"; mul: number; duration: number };

// ====================================================================
// v6 全面升级：爬塔模式（100 层递进迷宫）
// ====================================================================

/** 爬塔层数据 */
export interface TowerFloorDef {
  /** 层数 1..100 */
  floor: number;
  /** 层名称 */
  name: string;
  /** 敌人波数（1..3） */
  waves: number;
  /** 敌人 HP 倍率 */
  hpMul: number;
  /** 敌人速度倍率 */
  speedMul: number;
  /** 敌人伤害倍率 */
  dmgMul: number;
  /** 敌人奖励倍率 */
  rewardMul: number;
  /** 是否 BOSS 层（每 10 层） */
  isBoss: boolean;
  /** BOSS id（isBoss=true 时） */
  bossId?: string;
  /** 奖励层数（每 5 层） */
  hasReward: boolean;
  /** 奖励内容 */
  reward?: { coins?: number; intel?: number; relicId?: string };
}

// ====================================================================
// v6 全面升级：赛季 / 周常系统（前端 localStorage 模拟）
// ====================================================================

/** 赛季段位 */
export type SeasonRank =
  | "反诈新兵"
  | "反诈士官"
  | "反诈少尉"
  | "反诈上尉"
  | "反诈少校"
  | "反诈中校"
  | "反诈上校"
  | "反诈准将"
  | "反诈少将"
  | "反诈元帅";

/** 赛季信息 */
export interface SeasonInfo {
  /** 赛季编号（每月一赛季） */
  season: number;
  /** 当前积分 */
  score: number;
  /** 当前段位 */
  rank: SeasonRank;
  /** 本周已完成任务 */
  weeklyCompleted: string[];
  /** 赛季开始日期 */
  startDate: string;
}

/** 周常任务 */
export interface WeeklyQuest {
  id: string;
  name: string;
  desc: string;
  /** 目标值 */
  target: number;
  /** 奖励 */
  reward: { seasonScore: number; coins: number; relicId?: string };
  /** 进度 */
  progress: number;
  /** 是否已领取 */
  claimed: boolean;
}

// ====================================================================
// v6 全面升级：极限词缀系统（挑战模式专属）
// ====================================================================

/** 极限词缀 */
export interface ChallengeAffix {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  color: string;
  /** 严重度 1..3（影响积分倍率） */
  severity: 1 | 2 | 3;
  /** 效果 */
  effect: ChallengeAffixEffect;
}

/** 极限词缀效果 */
export type ChallengeAffixEffect =
  | { kind: "oneHp"; }                              // 1 血通关
  | { kind: "noUlt"; }                              // 禁大招
  | { kind: "randomAgents"; count: number }          // 随机探员
  | { kind: "noUpgrades"; }                          // 禁升级
  | { kind: "doubleEnemies"; }                       // 敌人翻倍
  | { kind: "fastEnemies"; mul: number }             // 敌人加速
  | { kind: "noDevices"; }                           // 禁战术装置
  | { kind: "noPause"; }                             // 禁战术暂停
  | { kind: "berserk"; mul: number }                 // 敌人狂暴
  | { kind: "fog"; };                                 // 战争迷雾

// ====================================================================
// v6 全面升级：探员皮肤系统
// ====================================================================

/** 探员皮肤定义 */
export interface AgentSkin {
  id: string;
  /** 关联探员 id */
  agentId: string;
  name: string;
  desc: string;
  /** 改变剪影类型 */
  silhouette?: "assault" | "comms" | "tech" | "social" | "sniper" | "stealth";
  /** 改变主题色 */
  color?: string;
  /** 改变大招特效色 */
  ultColor?: string;
  /** 解锁条件描述 */
  unlockHint: string;
  /** 稀有度 */
  rarity: RelicRarity;
}

// ====================================================================
// v6 全面升级：跨局持久化元进度（用于 platformStore）
// ====================================================================

/** 元进度（跨局保留） */
export interface ManagerMetaProgression {
  // ===== 资源 =====
  /** 金币（通用） */
  coins: number;
  /** 情报币（解锁剧情/图鉴） */
  intel: number;
  /** 案件卷宗（解锁天赋） */
  caseFiles: number;
  /** 反诈积分（解锁天赋点） */
  antiFraudPoints: number;
  /** 天赋点（可用） */
  talentPoints: number;

  // ===== 探员解锁 =====
  /** 已解锁探员 id 列表（原 6 探员默认解锁） */
  unlockedAgents: string[];
  /** 探员皮肤拥有列表 */
  ownedSkins: string[];
  /** 探员当前皮肤（agentId → skinId） */
  agentSkins: Record<string, string>;

  // ===== 天赋 =====
  /** 探员天赋分配（agentId → branch → 已解锁层级） */
  agentTalents: Record<string, Partial<Record<TalentBranch, number>>>;

  // ===== 遗物 =====
  /** 拥有的遗物 id 列表 */
  ownedRelics: string[];
  /** 当前装备的遗物 id 列表（最多 3 件） */
  equippedRelics: string[];

  // ===== 装备 =====
  /** 拥有的装备 id 列表 */
  ownedEquipment: string[];
  /** 探员装备（agentId → equipmentId） */
  agentEquipment: Record<string, string>;

  // ===== 图鉴 =====
  /** 已解锁敌人图鉴 */
  enemyCodex: string[];
  /** 已解锁探员图鉴 */
  agentCodex: string[];
  /** 已解锁案件图鉴 */
  caseCodex: string[];

  // ===== 答题 =====
  /** 累计答对题数 */
  quizCorrectCount: number;
  /** 累计答题次数 */
  quizTotalCount: number;

  // ===== 爬塔 =====
  /** 爬塔当前层数 */
  towerFloor: number;
  /** 爬塔最高层 */
  towerMaxFloor: number;

  // ===== 赛季 =====
  /** 赛季编号 */
  seasonNumber: number;
  /** 赛季积分 */
  seasonScore: number;
  /** 本周已完成任务 */
  weeklyCompleted: string[];
  /** 赛季开始日期 */
  seasonStartDate: string;

  // ===== 统计 =====
  /** 累计击杀数（跨局） */
  totalKills: number;
  /** 累计大招使用次数 */
  totalUltUsed: number;
  /** 累计 BOSS 击破数 */
  totalBossKills: number;

  // ===== v7 全面升级新增 =====
  /** 错题记录（题目 id → 连续错误次数，用于自适应难度与错题重练） */
  quizWrongRecords: Record<string, number>;
  /** 已收集的反诈口诀索引（对应 maze.ts MAZE_TERMS 的下标） */
  collectedTerms: number[];
  /** 已解锁的真实案例 id 列表（对应 REAL_CASES 数据） */
  unlockedCases: string[];
  /** 排行榜数据（前端模拟，按日/周/赛季） */
  leaderboard: {
    /** 每日最高分记录（key = YYYY-MM-DD） */
    daily: { date: string; score: number; rank: number };
    /** 每周最高分 */
    weekly: { weekKey: string; score: number; rank: number };
    /** 赛季最高分 */
    season: { score: number; rank: number };
  };
  /** 新手引导完成标记（按场景） */
  tutorialCompleted: {
    deploy: boolean;
    battle: boolean;
    progression: boolean;
    codex: boolean;
    season: boolean;
  };
  /** 可访问性设置 */
  accessibility: {
    /** 色弱模式（启用后状态信息辅以图标/文字） */
    colorBlindMode: boolean;
    /** 字号（small/medium/large） */
    fontSize: "small" | "medium" | "large";
  };
  /** 已完成的剧情战役章节 id 列表 */
  completedStoryChapters: string[];
  /** 爬塔事件层历史选择记录（floor → 选项 id，用于复盘） */
  towerEventChoices: Record<number, string>;
}

// ====================================================================
// v7 全面升级：真实案例还原系统
// 每关结算展示真实诈骗案例摘要 + 96110 提示
// ====================================================================

/** 真实案例定义（基于公开报道脱敏处理） */
export interface RealCaseDef {
  id: string;
  /** 关联敌人/BOSS typeId */
  refEnemyId: string;
  /** 案件标题 */
  title: string;
  /** 发生时间（年份） */
  year: string;
  /** 案件摘要（脱敏） */
  summary: string;
  /** 涉案金额（元，0 表示未知） */
  amount: number;
  /** 受害人群标签 */
  victim: string;
  /** 破案机关 */
  bustedBy: string;
  /** 反诈知识点 */
  tip: string;
  /** 96110 提示语 */
  hotline: string;
  /** 主题色 */
  color: string;
  /** emoji 图标 */
  emoji: string;
}

// ====================================================================
// v7 全面升级：反诈知识图谱（诈骗类型关联关系）
// ====================================================================

/** 知识图谱节点（基于 CodexEntry 扩展） */
export interface KnowledgeGraphNode {
  /** 关联 codexId */
  codexId: string;
  /** 节点类型 */
  kind: "fraudType" | "tactic" | "channel" | "target";
  /** 关联节点 id 列表（有向边） */
  links: string[];
  /** 关系描述（如"资金流向"/"演变自"/"常搭配"） */
  linkDesc: string[];
}

// ====================================================================
// v7 全面升级：Roguelike 事件层（爬塔非战斗事件）
// ====================================================================

/** 事件类型 */
export type TowerEventKind =
  | "victimRescue"      // 受害人求助：选择是否协助
  | "clueDiscovery"     // 线索发现：选择追查方向
  | "fraudQuiz"         // 反诈问答：答对获奖励
  | "moralChoice"       // 道德抉择：影响后续
  | "resourceTrade";    // 资源交易：用金币换情报

/** 事件选项 */
export interface TowerEventOption {
  id: string;
  label: string;
  desc: string;
  emoji: string;
  /** 选项后果 */
  outcome: TowerEventOutcome;
}

/** 事件后果 */
export type TowerEventOutcome =
  | { kind: "coins"; value: number }
  | { kind: "intel"; value: number }
  | { kind: "hp"; value: number }              // 基地血量
  | { kind: "energy"; value: number }
  | { kind: "score"; value: number }
  | { kind: "relic"; relicId: string }
  | { kind: "codex"; codexId: string }
  | { kind: "case"; caseId: string }
  | { kind: "term"; termIdx: number }           // 反诈口诀
  | { kind: "skip" };

/** 爬塔事件定义 */
export interface TowerEventDef {
  id: string;
  /** 触发层数（5/15/25/...，非 BOSS 层） */
  floor: number;
  /** 事件类型 */
  kind: TowerEventKind;
  /** 事件标题 */
  title: string;
  /** 事件描述（情景） */
  story: string;
  /** emoji 图标 */
  emoji: string;
  /** 主题色 */
  color: string;
  /** 选项列表（2-4 个） */
  options: TowerEventOption[];
}

// ====================================================================
// v7 全面升级：剧情战役模式（扩展 BOSS 剧情为关卡序列）
// ====================================================================

/** 剧情章节定义 */
export interface StoryChapterDef {
  id: string;
  /** 章节序号 */
  order: number;
  /** 章节标题 */
  title: string;
  /** 副标题 */
  subtitle: string;
  /** 关联 BOSS id */
  bossId: string;
  /** 章节前置剧情（过场对白） */
  prologue: DialogueLine[];
  /** 章节结尾剧情（过关后） */
  epilogue: DialogueLine[];
  /** 推荐战力（用于显示） */
  recommendedPower: number;
  /** 解锁条件（前置章节 id） */
  requires: string | null;
  /** 主题色 */
  accent: string;
  /** emoji 图标 */
  emoji: string;
  /** 章节背景描述 */
  background: string;
}

// ====================================================================
// v7 全面升级：排行榜系统（前端模拟）
// ====================================================================

/** 排行榜条目 */
export interface LeaderboardEntry {
  /** 玩家名（模拟对手用） */
  name: string;
  /** 头像 emoji */
  avatar: string;
  /** 分数 */
  score: number;
  /** 段位 */
  rank: string;
  /** 是否为当前玩家 */
  isPlayer: boolean;
  /** 模式 */
  mode: ManagerMode;
}

/** 排行榜类型 */
export type LeaderboardType = "daily" | "weekly" | "season";

// ====================================================================
// v7 全面升级：战报分享系统
// ====================================================================

/** 战报数据（用于生成分享图） */
export interface BattleReportData {
  /** 玩家段位 */
  playerRank: string;
  /** 模式 */
  mode: ManagerMode;
  /** 模式标签 */
  modeLabel: string;
  /** 分数 */
  score: number;
  /** 波数 */
  wave: number;
  /** 击杀数 */
  kills: number;
  /** BOSS 击破数 */
  bossKills: number;
  /** 最高连击 */
  maxCombo: number;
  /** 用时（秒） */
  durationSec: number;
  /** 胜负 */
  win: boolean;
  /** 出战探员 id 列表 */
  agentIds: string[];
  /** 反诈知识点（随机一条） */
  tip: string;
  /** 生成时间戳 */
  timestamp: number;
}
