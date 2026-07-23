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
  | "assassinate"; // 暗影刺杀：瞬移到最强敌人身边一击

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
  | "speedBoost"; // 低血量加速（钓鱼链接）

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
  silhouette: "assault" | "comms" | "tech" | "social" | "sniper" | "stealth";
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
  shape: "hexagon" | "window" | "phone" | "heart" | "hook" | "card" | "crown";
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

/** 反诈职业经理人五种模式（v3：新增 daily 每日挑战） */
export type ManagerMode = "classic" | "timeTrial" | "bossRush" | "endlessRush" | "daily";

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
  shape: "hexagon" | "window" | "phone" | "heart" | "hook" | "card" | "crown";
  /** BOSS 三阶段技能（HP 100% / 60% / 30% 触发） */
  phases?: BossPhase[];
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
  effect: "enrage" | "doubleSummon" | "healSelf" | "speedBurst" | "shield";
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
}
