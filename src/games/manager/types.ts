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
  // ===== v9 新增 =====
  /** v9：敌人 AI 行为树（缺省=patrol 巡逻，向后兼容） */
  aiBehavior?: EnemyAIBehavior;
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

export type ManagerPhase = "deploy" | "battle" | "upgrade" | "won" | "lost" | "shop" | "investigation";

/** 反诈职业经理人模式（v6：新增 tower 爬塔 / challenge 极限挑战；v9：新增 senior 适老模式） */
export type ManagerMode = "classic" | "timeTrial" | "bossRush" | "endlessRush" | "daily" | "tower" | "challenge" | "senior";

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

  // ===== v8 全面升级新增 =====
  /** 受害人营救：当前在场受害人列表（含进度与状态） */
  victims?: VictimHudEntry[];
  /** 受害人营救：累计成功营救数 */
  victimsRescued?: number;
  /** 受害人营救：累计沦陷数 */
  victimsLost?: number;
  /** 话术气泡：当前可点击击破的气泡列表 */
  speechBubbles?: { id: number; enemyUid: number; text: string; x: number; y: number; remaining: number }[];
  /** 话术气泡：当前可用的 4 个反诈口诀槽 */
  counterspellSlots?: CounterspellSlotHud;
  /** 战术指令：选中的探员（部署索引），未选中为 null */
  selectedAgentIdx?: number | null;
  /** 战术指令：该探员的指令状态 */
  tacticalCommandState?: TacticalCommandState | null;
  /** 卡牌大招：当前手牌 */
  cardHand?: CardHandHud;
  /** 案例五步复盘：本局结算待展示的复盘（仅 phase==="won" 时输出） */
  pendingCaseBreakdown?: CaseBreakdownDef;
  /** 案例五步复盘：上次答题是否答对（用于结算页 UI） */
  lastBreakdownCorrect?: boolean;
  /** v9：分支式调查运行时状态（phase==="investigation" 时输出） */
  pendingInvestigation?: InvestigationState;

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
  // ===== v9 升级新增 =====
  /** 遗物碎片池（key = relicId, value = 碎片数） */
  relicShards?: Record<string, number>;
  /** v9：战间遗物商店待选（仅 phase === "shop" 时输出） */
  pendingRelicShop?: RelicShopOffer[];
  /** v9：当前可合成的配方列表（供 UI 高亮） */
  craftableRecipes?: string[];
  /** v9：敌人 AI 警报（最近触发的敌人特殊行为，供 UI 提示） */
  lastEnemyAIEvent?: { kind: EnemyAIBehaviorKind; enemyUid: number; at: number } | null;
  /** v9：探员羁绊运行时状态（供 UI 渲染羁绊等级与进度） */
  bonds?: { id: string; name: string; color: string; level: 0 | 1 | 2 | 3; kills: number; nextKills: number; bothDeployed: boolean }[];

  // ===== v10 升级新增：系统事件通知（让已实现但 UI 无感的系统被玩家感知）=====
  /**
   * v10：最近触发的"高光时刻"事件队列（最多保留 3 条，3 秒后过期）
   * - 元素反应触发、技能链触发、敌人 AI 特殊行为、羁绊升级
   * - 由 engine push，由 ManagerBattleScene 在画面顶部中偏上展示为 toast 列表
   */
  recentSystemEvents?: SystemEventToast[];

  // ===== v11 升级新增 =====
  /** v11：当前迷宫的地形图层（null=该迷宫无地形，回退普通格） */
  terrainLayer?: TerrainLayer | null;
  /** v11：探员重部署状态（null=未启用重部署） */
  redeployState?: RedeployState | null;
  /** v11：重部署消耗能量（默认 30，UI 展示用） */
  redeployCost?: number;
  /** v11：重部署是否可用（能量足够且未在放置模式） */
  redeployReady?: boolean;
  /** v11：当前激活的弱点情报列表（受害人模拟解锁，对该类型敌人 +20% 伤害） */
  activeWeaknessIntel?: { enemyTypeId: string; damageBonus: number; desc: string }[];
  /** v11：自定义难度配置（仅 custom 模式生效） */
  customDifficulty?: CustomDifficultyConfig;
}

/** v10：系统事件通知单条 */
export interface SystemEventToast {
  /** 事件类型 */
  kind: "elementReaction" | "enemyAI" | "bondUpgrade" | "counterspell" | "victimRescue" | "weaknessIntel";
  /** 标题（如"元素反应：蒸汽隐匿"） */
  title: string;
  /** 副标题/简述（如"水+火触发，探员无敌 2 秒"） */
  desc: string;
  /** emoji 图标 */
  emoji: string;
  /** 主题色 */
  color: string;
  /** 触发时间戳（秒） */
  at: number;
  /** 持续时间（秒，超时由 engine 自动剔除） */
  ttl: number;
}

// ====================================================================
// v9 升级：遗物合成系统 · 战间商店offer
// ====================================================================

/** v9：战间遗物商店 offer（每 5 波弹出，三选一） */
export interface RelicShopOffer {
  /** 商品 id */
  id: string;
  /** 商品类型：完整遗物 / 碎片包 / 合成配方 */
  kind: "relic" | "shardPack" | "recipe";
  /** 关联遗物 id（relic/recipe 类型用） */
  relicId?: string;
  /** 碎片数量（shardPack 类型用） */
  shardCount?: number;
  /** 碎片对应的遗物 id（shardPack 类型用） */
  shardForRelicId?: string;
  /** 显示名称 */
  name: string;
  /** emoji 图标 */
  emoji: string;
  /** 描述 */
  desc: string;
  /** 主题色 */
  color: string;
  /** 价格（金币） */
  price: number;
  /** 稀有度（relic 类型用） */
  rarity?: RelicRarity;
  /** 层级（relic 类型用） */
  tier?: RelicTier;
}

// ====================================================================
// v9 升级：敌人 AI 行为树系统
// 替代 v6 的 EnemyAbility 静态修饰，敌人现可在运行时动态切换行为
// ====================================================================

/** v9：敌人 AI 行为类型 */
export type EnemyAIBehaviorKind =
  | "patrol"        // 巡逻：默认沿路径走（向后兼容）
  | "flank"         // 绕侧：检测到前方有探员时绕路到侧翼
  | "rush"          // 群冲：低血量时呼叫附近同类型敌人一起加速
  | "disguise"      // 伪装：间歇性伪装成正常NPC（减速但无法被攻击）
  | "enrage"        // 狂暴：低血量时攻击力+50%、速度+30%
  | "split"         // 分裂：死亡时分裂为 2 个小怪
  | "teleport"      // 瞬移：低血量瞬移到出口附近
  | "fearAura"      // 恐惧光环：附近探员射速 -30%
  | "healAura"      // 治疗光环：附近敌人每秒回血
  | "reflect";      // 反弹：反射 20% 投射物伤害

/** v9：敌人 AI 行为定义（运行时由 engine 读取） */
export interface EnemyAIBehavior {
  /** 主行为类型 */
  kind: EnemyAIBehaviorKind;
  /** 触发条件（缺省=一直生效） */
  trigger?: {
    /** 触发血量百分比阈值（0..1，低于此值触发） */
    belowHpRatio?: number;
    /** 触发概率（0..1，每次检测时判定） */
    chance?: number;
    /** 触发冷却（秒） */
    cooldown?: number;
  };
  /** 行为参数 */
  params?: {
    /** 加速倍率（rush/enrage 用） */
    speedMul?: number;
    /** 攻击力倍率（enrage 用） */
    damageMul?: number;
    /** 治疗量（healAura 用，每秒） */
    healPerSec?: number;
    /** 恐惧半径（fearAura 用） */
    auraRadius?: number;
    /** 反弹比例（reflect 用） */
    reflectRatio?: number;
    /** 分裂后小怪 typeId（split 用） */
    splitTypeId?: string;
    /** 伪装持续时间（disguise 用） */
    disguiseDuration?: number;
    /** 瞬移目标距离出口（teleport 用，格子数） */
    teleportToExitDist?: number;
  };
  /** 副行为（低血量时切换到此行为，缺省=无） */
  secondary?: EnemyAIBehaviorKind;
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

/** v9：遗物层级（1=基础 / 2=中级合成 / 3=顶级合成） */
export type RelicTier = 1 | 2 | 3;

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
  // ===== v9 遗物合成系统新增 =====
  /** 层级：1=基础（掉落/购买）/ 2=中级（3 个 tier-1 合成）/ 3=顶级（3 个 tier-2 合成） */
  tier: RelicTier;
  /** 合成配方（tier 2/3 必填，tier 1 无） */
  recipe?: RelicRecipe;
  /** 拆解获得的碎片数（tier 1=2, tier 2=6, tier 3=18，缺省按 tier 推算） */
  decomposeShards?: number;
}

/** v9：遗物合成配方 */
export interface RelicRecipe {
  /** 合成所需的前置遗物 id（3 个，必须为下一层 tier） */
  ingredients: [string, string, string];
  /** 合成所需金币 */
  coinCost: number;
  /** 合成所需情报币（tier 3 才需要） */
  intelCost?: number;
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
  | { kind: "dailyLuck"; value: number }               // 每日挑战运气 +
  // ===== v9 tier 2/3 新增效果 =====
  | { kind: "doubleStartEnergy"; value: number }       // 开局能量 +（翻倍型，tier 2+）
  | { kind: "ultPowerMul"; value: number }             // 大招威力倍率（tier 2+）
  | { kind: "agentInvulnFirst3s"; }                    // 开局 3 秒探员无敌（tier 3）
  | { kind: "bossDamageMul"; value: number }           // 对 BOSS 伤害倍率（tier 2+）
  | { kind: "cooldownReduce"; value: number }          // 战术装置冷却缩减（tier 2+）
  | { kind: "reviveTwice"; };                          // 复活两次（tier 3）

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
  /** v9：遗物碎片池（key = relicId, value = 碎片数；3 碎片可合成 1 件完整遗物） */
  relicShards: Record<string, number>;
  /** v9：已解锁的合成配方 id 列表（tier 2/3 遗物解锁后可见） */
  unlockedRecipes: string[];

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

  // ===== v8 全面升级新增 =====
  /** 已完成的探员支线 agentId 列表 */
  completedAgentStoryQuests: string[];
  /** 玩家选择的地区 id（null = 未选择，使用默认） */
  selectedRegionId: string | null;
  /** 已完成的主线章节单关 id 列表（格式：chapterId-stageOrder） */
  completedStoryStages: string[];
  /** 案例五步复盘：累计答对次数 */
  caseBreakdownCorrectCount: number;
  /** 案例五步复盘：累计参与次数 */
  caseBreakdownTotalCount: number;
  /** 话术气泡：累计击破数 */
  speechBubblesBroken: number;
  /** 受害人营救：累计成功营救数 */
  victimsRescuedTotal: number;
  /** 受害人营救：累计沦陷数 */
  victimsLostTotal: number;
  /** 战术指令：累计使用次数 */
  tacticalCommandsUsed: number;
  /** 卡牌大招：累计释放次数 */
  cardSkillsUsed: number;

  // ===== v9 Phase 4.3 全面升级新增：错题本 + 知识闯关 =====
  /**
   * 错题本（结构化记录，跨场景统一）
   * key = `${source}::${questionId}`，value = 错题详情
   * - 同一题多次答错只更新 wrongCount / lastWrongAt，不重复入条
   * - 答对一次后 wrongCount-- ，降到 0 时移除该条
   */
  wrongQuestions: Record<string, WrongQuestionRecord>;
  /** 知识闯关：已通关关卡 id 列表（用于解锁判定） */
  quizClearedLevels: string[];
  /** 知识闯关：每个关卡的最高分（levelId → score） */
  quizHighScores: Record<string, number>;

  // ===== v10 全面升级新增 =====
  /** v10：本局学到的反诈知识点 id 列表（一局结束后清空，结算页展示用） */
  learnedFraudTipsThisRun: string[];
  /** v10：累计学到的反诈知识点数（跨局统计，用于成就/段位） */
  learnedFraudTipsTotal: number;

  // ===== v11 升级新增 =====
  /** v11：已解锁的弱点情报列表（受害人模拟通关解锁，塔防中对该敌人 +20% 伤害） */
  weaknessIntel: WeaknessIntelRecord[];
  /** v11：已通关的受害人模拟剧本 id 列表 */
  completedVictimSimScenarios: string[];
  /** v11：受害人模拟最高评级记录（scenarioId → "S"/"A"/"B"/"C"/"D"） */
  victimSimBestRanks: Record<string, "S" | "A" | "B" | "C" | "D">;
  /** v11：战斗回放记录（最近 3 局，FIFO，超过自动剔除） */
  battleReplays: BattleReplayRecord[];
  /** v11：自定义难度配置（持久化） */
  customDifficulty: CustomDifficultyConfig;
  /** v11：当前自定义难度预设档位 */
  customDifficultyPreset: CustomDifficultyPreset;
}

/** v9 Phase 4.3：错题本单条记录 */
export interface WrongQuestionRecord {
  /** 题目 id（在 source 命名空间内唯一） */
  questionId: string;
  /** 来源场景：quiz=知识闯关 / dialog=AI对话 / case=案例复盘 / battle=战间答题 */
  source: "quiz" | "dialog" | "case" | "battle";
  /** 题目类型：single=单选 / multi=多选 / judge=判断 / branch=分支选择 */
  questionType: "single" | "multi" | "judge" | "branch";
  /** 题干（用于复习展示，避免依赖外部数据查询） */
  questionText: string;
  /** 选项文本数组（用于复习展示） */
  options: string[];
  /** 正确答案索引（single/judge 为单个；multi 为多个，用逗号分隔） */
  correctAnswer: string;
  /** 玩家上次的错误答案索引（同上格式） */
  lastWrongAnswer: string;
  /** 错误次数（连续错误累加，答对一次递减） */
  wrongCount: number;
  /** 首次答错时间戳（ms） */
  firstWrongAt: number;
  /** 最近答错时间戳（ms） */
  lastWrongAt: number;
  /** 知识点分类（如 "冒充客服" / "AI换脸" / "公检法" 等） */
  category: string;
  /** 关联的反诈案例 id（可选，用于追溯） */
  relatedCaseId?: string;
  /** 简短解析（可选） */
  explanation?: string;
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
  | "resourceTrade"     // 资源交易：用金币换情报
  // ===== v9 新增 =====
  | "shop"              // 商店层：花费分数购买遗物/血量/能量
  | "mysteryBox"        // 神秘宝箱：风险与收益并存
  | "agentEncounter";   // 探员遭遇：临时协同或解锁情报

/** 事件选项 */
export interface TowerEventOption {
  id: string;
  label: string;
  desc: string;
  emoji: string;
  /** 选项后果 */
  outcome: TowerEventOutcome;
  /** v9：商店购买所需分数（仅 shop 类用；不足则引擎拒绝并提示） */
  cost?: number;
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
  | { kind: "skip" }
  // ===== v9 新增 =====
  | { kind: "agentHp"; value: number }          // 全探员回血（百分比 0..1）
  | { kind: "freeUpgrade" }                      // 立即触发一次免费升级
  | { kind: "bondsKills"; value: number };       // 羁绊击杀进度推进（加速羁绊升级）

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

// ====================================================================
// v8 全面升级：受害人营救系统
// 地图随机出现潜在受害人 NPC，敌人接触触发"洗脑进度条"
// 探员靠近或击破洗脑者可在进度满前救下受害人
// ====================================================================

/** 受害人 NPC 状态 */
export interface VictimNPC {
  /** 唯一 id */
  id: number;
  /** 当前位置（画布坐标） */
  x: number;
  y: number;
  /** 关联迷宫航点索引（受害人居于路径某点附近） */
  waypointIdx: number;
  /** 受害人类型 emoji */
  emoji: string;
  /** 受害人画像标签（老年/学生/白领/财务…） */
  demographic: string;
  /** 关联的高发诈骗类型 id（决定洗脑者敌人类型） */
  fraudTypeId: string;
  /** 当前洗脑进度 0..1（0 = 未被洗脑，1 = 完全沦陷） */
  brainwashProgress: number;
  /** 洗脑速度（每秒进度增量） */
  brainwashRate: number;
  /** 当前正在洗脑该受害人的敌人 uid（无则 null） */
  brainwashingBy: number | null;
  /** 是否已被成功营救 */
  rescued: boolean;
  /** 是否已沦陷（洗脑完成） */
  lost: boolean;
  /** 营救奖励（基础分数） */
  rewardScore: number;
  /** 营救奖励（反诈积分） */
  rewardAntiFraudPoints: number;
  /** 出现时间戳（秒） */
  spawnedAt: number;
  /** 存活时间（秒，超时自动撤离） */
  lifeSpan: number;
}

/** 受害人营救配置 */
export interface VictimRescueConfig {
  /** 每波生成受害人数量 */
  perWave: number;
  /** 受害人画像池（按关卡筛选） */
  demographics: string[];
  /** 洗脑触发距离（敌人距受害人此距离内开始洗脑） */
  triggerRange: number;
  /** 探员营救距离（探员距受害人此距离内每秒降低洗脑进度） */
  rescueRange: number;
  /** 探员每秒降低洗脑进度 */
  rescueRate: number;
  /** 受害人存活时间（秒） */
  lifeSpan: number;
}

/** HUD 中暴露给场景的受害人信息 */
export interface VictimHudEntry {
  id: number;
  emoji: string;
  demographic: string;
  progress: number;
  state: "idle" | "brainwashing" | "rescued" | "lost";
  x: number;
  y: number;
}

// ====================================================================
// v8 全面升级：话术气泡实时拆穿系统
// 敌人边走边冒话术气泡，玩家点击对应反诈口诀击破 + 易伤 buff
// ====================================================================

/** 话术气泡定义 */
export interface SpeechBubble {
  /** 唯一 id */
  id: number;
  /** 关联敌人 uid */
  enemyUid: number;
  /** 话术内容（诈骗话术） */
  text: string;
  /** 该话术对应的反诈口诀 id（玩家需点击此口诀击破） */
  counterspellId: string;
  /** 气泡出现时间戳（秒） */
  appearedAt: number;
  /** 气泡持续时间（秒，超时未击破则强化敌人） */
  duration: number;
  /** 气泡位置（画布坐标，渲染于敌人头顶） */
  x: number;
  y: number;
  /** 是否已被击破 */
  broken: boolean;
}

/** 反诈口诀定义（玩家可点击的口诀按钮） */
export interface CounterspellDef {
  /** 口诀 id */
  id: string;
  /** 口诀文本（如"公检法不电办"） */
  text: string;
  /** 关联诈骗类型（决定能击破哪些话术气泡） */
  fraudTypeIds: string[];
  /** emoji 图标 */
  emoji: string;
  /** 主题色 */
  color: string;
  /** 击破气泡后对敌人施加的易伤比例（如 0.3 = 受伤+30%） */
  vulnerabilityBonus: number;
  /** 易伤持续时间（秒） */
  vulnerabilityDuration: number;
}

/** HUD 中暴露给场景的口诀槽信息 */
export interface CounterspellSlotHud {
  /** 当前可用的 2 个口诀（从全池中按当前敌人类型动态抽取；仅 BOSS 战激活） */
  slots: CounterspellDef[];
  /** 每个口诀的冷却剩余时间（秒） */
  cooldowns: number[];
}

// ====================================================================
// v8 全面升级：战术指令系统
// 玩家可对单个探员下达短指令（集火/后撤/换弹/嘲讽），带冷却
// ====================================================================

/** 战术指令类型 */
export type TacticalCommandKind =
  | "focusFire"   // 集火：下次攻击伤害 +80%，5 秒内射速 +20%
  | "retreat"     // 后撤：探员向后位移 60px，期间无法攻击，3 秒后回位
  | "reload"      // 换弹：立即重置冷却 + 下 3 次攻击穿透 +1
  | "taunt"       // 嘲讽：5 秒内吸引范围内敌人改向自己（牺牲护盾换时间）
  | "overdrive";  // 过载：5 秒内攻击 +50% 但每秒损血 8%

/** 战术指令定义 */
export interface TacticalCommandDef {
  kind: TacticalCommandKind;
  name: string;
  emoji: string;
  desc: string;
  color: string;
  /** 持续时间（秒） */
  duration: number;
  /** 冷却时间（秒） */
  cooldown: number;
}

/** 战术指令运行时状态（每探员一个） */
export interface TacticalCommandState {
  /** 当前激活的指令类型 */
  activeKind: TacticalCommandKind | null;
  /** 激活剩余时间（秒） */
  activeRemaining: number;
  /** 冷却剩余时间（秒，按 kind 索引） */
  cooldowns: Record<TacticalCommandKind, number>;
}

// ====================================================================
// v8 全面升级：卡牌式大招系统
// 保留能量基础（能量满后可抽牌），每探员 3 张牌随机抽 1 张释放
// 既增加策略性又不破坏现有 12 种 UltKind 数值平衡
// ====================================================================

/** 卡牌大招定义（基于现有 UltKind 扩展，每探员 3 张牌） */
export interface CardSkillDef {
  /** 卡牌 id */
  id: string;
  /** 关联探员 id */
  agentId: string;
  /** 卡牌名称 */
  name: string;
  /** 卡牌描述 */
  desc: string;
  /** 卡牌稀有度 */
  rarity: RelicRarity;
  /** emoji 图标 */
  emoji: string;
  /** 主题色 */
  color: string;
  /** 释放费用（消耗能量值；保留能量基础，每探员基础 100 能量） */
  cost: number;
  /** 卡牌效果（复用现有 UltKind 但参数可变体） */
  effect: CardSkillEffect;
}

/** 卡牌效果（在 UltDef 基础上扩展，允许数值变体） */
export type CardSkillEffect =
  | { kind: "pierce"; dmgMul: number; lane: number }
  | { kind: "slowAll"; slowMul: number; duration: number; vulnBonus: number }
  | { kind: "aoe"; dmgMul: number; radius: number }
  | { kind: "healShield"; healRatio: number; shieldRatio: number }
  | { kind: "critBuff"; critRate: number; critDmg: number; duration: number }
  | { kind: "assassinate"; dmgMul: number }
  | { kind: "summon"; ratio: number; duration: number }
  | { kind: "freeze"; duration: number; vulnBonus: number }
  | { kind: "timeWarp"; slowMul: number; duration: number }
  | { kind: "shieldWall"; shieldRatio: number; duration: number }
  // v8 新增：组合型卡牌（高稀有度）
  | { kind: "aoePlusSlow"; dmgMul: number; radius: number; slowMul: number; slowDuration: number }
  | { kind: "healPlusCrit"; healRatio: number; critRate: number; duration: number };

/** HUD 中暴露给场景的手牌信息 */
export interface CardHandHud {
  /** 当前手牌（最多 3 张，每探员一张） */
  cards: CardSkillDef[];
  /** 每张卡的可用状态（能量是否足够） */
  playable: boolean[];
  /** 当前能量（0..100） */
  energy: number;
}

// ====================================================================
// v9 升级：案例分支式调查系统（重做 v8 五步单选拦截点）
// 玩家扮演反诈干警，在五阶段调查中各选调查方向，多分支多结局
// 向后兼容：保留 correctInterceptIdx（v8 旧数据用），v9 新数据用 investigation
// ====================================================================

/** v9：案件分支式调查定义 */
export interface CaseBreakdownDef {
  /** 关联真实案例 id */
  caseId: string;
  /** 案件标题 */
  title: string;
  /** 五个步骤（接触 → 信任 → 诱导 → 转账 → 拉黑） */
  steps: CaseBreakdownStep[];
  /** v8 保留：正确的拦截点 step 索引（0..4），v9 旧数据兼容用 */
  correctInterceptIdx: number;
  /** 答对解锁的奖励 */
  reward: { score: number; antiFraudPoints: number; relicId?: string };
  // ===== v9 分支式调查新增 =====
  /** v9：分支式调查剧本（缺省=回退到 v8 五步单选模式） */
  investigation?: CaseInvestigation;
}

/** 案件单步定义 */
export interface CaseBreakdownStep {
  /** 步骤序号（1..5） */
  order: number;
  /** 步骤名称 */
  name: string;
  /** 步骤描述（情景） */
  desc: string;
  /** 该步骤的预警信号 */
  warningSign: string;
  /** 该步骤的正确应对 */
  correctAction: string;
}

/** v9：分支式调查剧本（每阶段 2-4 个调查方向，多结局） */
export interface CaseInvestigation {
  /** 起始节点 id */
  startNodeId: string;
  /** 调查节点列表（按 id 索引） */
  nodes: CaseInvestigationNode[];
  /** 结局列表 */
  endings: CaseInvestigationEnding[];
}

/** v9：调查节点（一个节点 = 一个调查阶段） */
export interface CaseInvestigationNode {
  /** 节点 id */
  id: string;
  /** 阶段标题（如"第一阶段：接触来源调查"） */
  title: string;
  /** 案情进展描述 */
  scene: string;
  /** 可选调查方向（2-4 个） */
  choices: CaseInvestigationChoice[];
}

/** v9：调查选项 */
export interface CaseInvestigationChoice {
  /** 选项文本 */
  text: string;
  /** emoji 图标 */
  emoji: string;
  /** 该选项的评价：perfect=最佳拦截 / ok=正确但非最佳 / warn=方向有偏 / wrong=错误判断 */
  verdict: "perfect" | "ok" | "warn" | "wrong";
  /** 评价说明（干警视角的反馈） */
  feedback: string;
  /** 下一节点 id（null=直接进入结局判定） */
  nextNodeId?: string | null;
  /** 该选项积累的"证据值"（累加影响结局评级） */
  evidenceDelta?: number;
  /** 该选项积累的"受害人损失值"（累加影响结局评级，越低越好） */
  lossDelta?: number;
}

/** v9：调查结局（基于累计证据值与损失值判定） */
export interface CaseInvestigationEnding {
  /** 结局 id */
  id: string;
  /** 结局评级：S/A/B/C/D 五级 */
  rank: "S" | "A" | "B" | "C" | "D";
  /** 结局标题 */
  title: string;
  /** 结局描述（干警视角总结） */
  desc: string;
  /** 触发条件：累计证据值 ≥ 此值 */
  minEvidence: number;
  /** 触发条件：累计损失值 ≤ 此值 */
  maxLoss: number;
  /** 该结局的奖励倍率（0..2，乘以 reward 基础值） */
  rewardMul: number;
  /** 法律定性提示 */
  legalCharacterization: string;
  /** 96110 提示 */
  hotline: string;
}

/** v9：分支式调查运行时状态（engine 维护，供 UI 渲染） */
export interface InvestigationState {
  /** 关联案例 id（如 case_robot） */
  caseId: string;
  /** 调查剧本 */
  investigation: CaseInvestigation;
  /** 当前节点 id */
  currentNodeId: string;
  /** 累计证据值 */
  evidence: number;
  /** 累计损失值 */
  loss: number;
  /** 历史选择记录（nodeId → choiceIdx） */
  history: { nodeId: string; choiceIdx: number; feedback: string }[];
  /** 已完成的结局（null=进行中；非空=已结算） */
  ending: CaseInvestigationEnding | null;
  /** 上次选择后的反馈文案（供 UI 临时展示） */
  lastFeedback?: string;
}

// ====================================================================
// v8 全面升级：探员个人支线
// 每探员 1 条 3-5 战故事任务，完成解锁专属皮肤/天赋节点
// ====================================================================

/** 探员支线任务定义 */
export interface AgentStoryQuest {
  /** 关联探员 id */
  agentId: string;
  /** 支线标题 */
  title: string;
  /** 支线简介 */
  summary: string;
  /** 战斗章节（3-5 战） */
  chapters: AgentStoryChapter[];
  /** 完成奖励 */
  reward: { skinId?: string; talentPoints: number; relicId?: string };
}

/** 支线单章 */
export interface AgentStoryChapter {
  /** 章节序号 */
  order: number;
  /** 章节标题 */
  title: string;
  /** 剧情对白（战前） */
  prologue: DialogueLine[];
  /** 剧情对白（战后） */
  epilogue: DialogueLine[];
  /** 敌人波次配置 */
  waveSeed: string;
  /** 推荐战力 */
  recommendedPower: number;
  /** 该章 BOSS id（如有） */
  bossId?: string;
}

// ====================================================================
// v8 全面升级：地区高发诈骗数据
// 玩家选择城市，首页推送当地当月高发诈骗类型
// 数据来源：基于公开报道整理的内置 JSON（按月切换，模拟实时数据）
// ====================================================================

/** 地区定义 */
export interface RegionDef {
  /** 地区 id */
  id: string;
  /** 地区名称 */
  name: string;
  /** emoji 图标 */
  emoji: string;
  /** 高发诈骗类型 id 列表（按月份切换） */
  monthlyFraudTypes: Record<string, string[]>; // key = "YYYY-MM"
  /** 该地区反诈中心名称 */
  antiFraudCenter: string;
}

// ====================================================================
// v8 全面升级：章节式主线剧情（8 章）
// 把现有 8 BOSS 对白扩展为 8 章完整剧情（每章 5-8 关）
// ====================================================================

/** 主线章节定义（扩展 StoryChapterDef） */
export interface StoryChapterFull extends StoryChapterDef {
  /** 章节包含的关卡序列（5-8 关） */
  stages: StoryStageDef[];
  /** 章节完成后解锁的内容 */
  unlocks: {
    agentId?: string;
    skinId?: string;
    relicId?: string;
    caseId?: string;
  };
}

/** 主线章节单关 */
export interface StoryStageDef {
  /** 关卡序号 */
  order: number;
  /** 关卡名称 */
  title: string;
  /** 关卡难度（1..5） */
  difficulty: number;
  /** 关联敌人/BOSS id */
  refEnemyId: string;
  /** 推荐战力 */
  recommendedPower: number;
  /** 战前对白（短） */
  brief: DialogueLine[];
  /** 战后对白（短） */
  debrief: DialogueLine[];
}

// ====================================================================
// v8 全面升级：扩展 ManagerHud 字段
// ====================================================================

// （以下字段通过声明合并追加到 ManagerHud；为避免修改现有接口，
//   改为在 ManagerHud 中新增可选字段。直接在原 interface 中追加。）

// ====================================================================
// v9 全面升级：探员羁绊系统
// 同时部署有羁绊关系的两名探员时触发协同效果，3 级递进
// 等级随同局累计击杀数解锁：5 / 15 / 30
// ====================================================================

/** 羁绊等级 */
export type BondLevel = 1 | 2 | 3;

/** 羁绊效果类型 */
export type BondEffectKind =
  | "attackUp"       // 双方攻击力 +%（百分比 0..1）
  | "firerateUp"     // 双方射速 +%
  | "rangeUp"        // 双方射程 +%
  | "critUp"         // 双方暴击率 +%（绝对值加到暴击率）
  | "healLink"       // 任一方造成伤害时为对方回血（value = 伤害的百分比）
  | "shieldLink"     // 任一方受击时为对方叠加护盾（value = 护盾占最大血量百分比）
  | "elementLink"    // 元素反应触发时额外伤害（value = 额外伤害倍率）
  | "ultChargeUp"    // 大招充能速度 +%
  | "comboBoost";    // 连击倍率额外 +

/** 羁绊单级效果 */
export interface BondLevelEffect {
  /** 羁绊等级 */
  level: BondLevel;
  /** 触发所需同局累计击杀数 */
  requiredKills: number;
  /** 效果类型 */
  effect: BondEffectKind;
  /** 效果数值（百分比 0..1 或绝对值，视 effect 语义） */
  value: number;
  /** 该等级解锁时的协同台词 */
  bondLine: string;
}

/** 探员羁绊定义 */
export interface AgentBond {
  /** 羁绊 id */
  id: string;
  /** 羁绊名称 */
  name: string;
  /** 羁绊主题色 */
  color: string;
  /** 关联的两名探员 id（无序对） */
  agentIds: [string, string];
  /** 羁绊背景故事 */
  story: string;
  /** 3 级递进效果 */
  levels: BondLevelEffect[];
}

/** 运行时羁绊状态（同局内） */
export interface BondRuntimeState {
  /** 羁绊 id */
  bondId: string;
  /** 当前已达成等级（0=未激活，1/2/3） */
  currentLevel: 0 | 1 | 2 | 3;
  /** 同局累计击杀数（用于判定升级） */
  kills: number;
  /** 双方探员在场标记 */
  bothDeployed: boolean;
}

// ====================================================================
// v11 升级 · 方向 B：地形系统（高地/瓶颈/陷阱/安全岛）
// 在 MazeDef 之上叠加地形图层，影响探员与敌人
// ====================================================================

/** v11：地形类型 */
export type TerrainKind =
  | "highland"    // 高地：探员射程 +30%、伤害 +15%
  | "chokepoint"  // 瓶颈：AOE 伤害 +30%，敌人减速 20%
  | "trap"        // 陷阱：敌人经过每秒损失 8% 最大血量
  | "safeIsland"  // 安全岛：探员无敌且每秒回血 5%
  | "normal";     // 普通格（缺省）

/** v11：地形定义（叠加在迷宫格子之上） */
export interface TerrainTile {
  /** 格子 col */
  col: number;
  /** 格子 row */
  row: number;
  /** 地形类型 */
  kind: TerrainKind;
  /** 主题色（渲染用） */
  color: string;
  /** emoji 图标（渲染用，可选） */
  emoji?: string;
}

/** v11：地形图层（每迷宫一个，按格子键索引） */
export interface TerrainLayer {
  /** 关联迷宫 id */
  mazeId: string;
  /** 地形格子列表 */
  tiles: TerrainTile[];
  /** 格子键 "c,r" → TerrainTile */
  tileMap: Map<string, TerrainTile>;
}

/** v11：探员重部署指令运行时状态 */
export interface RedeployState {
  /** 待移动的探员部署索引（null=未选中） */
  selectedAgentIdx: number | null;
  /** 本次重部署消耗能量 */
  cost: number;
  /** 是否处于"选目标格"模式 */
  pickingTarget: boolean;
}

// ====================================================================
// v11 升级 · 方向 C：受害者视角分支剧情（沉浸式第一人称模拟）
// ====================================================================

/** v11：受害者模拟剧本节点 */
export interface VictimSimNode {
  /** 节点 id */
  id: string;
  /** 阶段标题（如"第一阶段：陌生来电"） */
  title: string;
  /** 第一人称场景描述（玩家代入受害人视角） */
  scene: string;
  /** 该节点的诈骗话术（骗子说的话） */
  scammerLine: string;
  /** 话术利用的心理手法 */
  psychology: string[];
  /** 该节点的红旗等级 0-5 */
  redFlag: number;
  /** 玩家可选应对（2-4 个） */
  choices: VictimSimChoice[];
}

/** v11：受害者模拟选项 */
export interface VictimSimChoice {
  /** 选项文本 */
  text: string;
  /** emoji 图标 */
  emoji: string;
  /** 评价：perfect=最佳应对 / ok=正确但非最佳 / warn=有风险 / wrong=致命错误 */
  verdict: "perfect" | "ok" | "warn" | "wrong";
  /** 评价说明（受害人视角的反馈） */
  feedback: string;
  /** 下一节点 id（null=进入结局判定） */
  nextNodeId?: string | null;
  /** 该选项积累的"警觉值"（越高越好） */
  awarenessDelta?: number;
  /** 该选项积累的"损失值"（越低越好） */
  lossDelta?: number;
}

/** v11：受害者模拟结局 */
export interface VictimSimEnding {
  /** 结局 id */
  id: string;
  /** 结局评级：S/A/B/C/D 五级 */
  rank: "S" | "A" | "B" | "C" | "D";
  /** 结局类型 */
  kind: "busted" | "rescued" | "partialLoss" | "totalLoss";
  /** 结局标题 */
  title: string;
  /** 结局描述 */
  desc: string;
  /** 触发条件：累计警觉值 ≥ 此值 */
  minAwareness: number;
  /** 触发条件：累计损失值 ≤ 此值 */
  maxLoss: number;
  /** 该结局的弱点情报奖励：对应 manager 敌人 typeId，塔防中对该敌人 +20% 伤害 */
  weaknessIntel?: {
    /** 关联 manager 敌人 typeId */
    enemyTypeId: string;
    /** 伤害加成比例（0.2 = +20%） */
    damageBonus: number;
    /** 情报描述 */
    desc: string;
  };
  /** 96110 提示 */
  hotline: string;
}

/** v11：受害者模拟剧本 */
export interface VictimSimScenario {
  /** 剧本 id */
  id: string;
  /** 关联诈骗类型 id（与 fraudBuster typeId 对应，如 F116/F117/F118） */
  typeId: string;
  /** 诈骗类型名 */
  typeName: string;
  /** 剧本标题 */
  title: string;
  /** 受害人画像标签（如"独居老人"/"职场新人"/"宝妈"） */
  victimProfile: string;
  /** 难度 1-4 */
  difficulty: number;
  /** 场景简介 */
  scenario: string;
  /** 起始节点 id */
  startNodeId: string;
  /** 节点列表 */
  nodes: VictimSimNode[];
  /** 结局列表 */
  endings: VictimSimEnding[];
  /** 完成后学习要点 */
  takeaways: string[];
}

// ====================================================================
// v11 升级 · 方向 D：战斗回放 / 数据仪表盘 / 自定义难度
// ====================================================================

/** v11：战斗回放快照（一帧） */
export interface BattleReplayFrame {
  /** 局内时间戳（秒） */
  t: number;
  /** 当时分数 */
  score: number;
  /** 当时基地血量 */
  baseHp: number;
  /** 当时波次 */
  wave: number;
  /** 当时连击数 */
  combo: number;
  /** 当时存活敌人数量 */
  enemyCount: number;
  /** 当时事件（如击杀/大招释放/元素反应） */
  event?: string;
}

/** v11：战斗回放记录 */
export interface BattleReplayRecord {
  /** 局 id（时间戳） */
  runId: string;
  /** 模式 */
  mode: ManagerMode;
  /** 模式中文名 */
  modeLabel: string;
  /** 最终分数 */
  finalScore: number;
  /** 胜负 */
  win: boolean;
  /** 总波次 */
  totalWaves: number;
  /** 用时（秒） */
  durationSec: number;
  /** 出战探员 id 列表 */
  agentIds: string[];
  /** 关联诈骗类型命中统计 */
  fraudTypeStats: Record<string, { kills: number; leaked: number }>;
  /** 关键事件时间轴 */
  timeline: BattleReplayFrame[];
  /** 生成时间戳（ms） */
  createdAt: number;
}

/** v11：自定义难度调节（独立于 challenge 词缀） */
export interface CustomDifficultyConfig {
  /** 敌人血量倍率（0.5..2.0，默认 1.0） */
  enemyHpMul: number;
  /** 敌人速度倍率（0.5..2.0，默认 1.0） */
  enemySpeedMul: number;
  /** 敌人伤害倍率（0.5..2.0，默认 1.0） */
  enemyDmgMul: number;
  /** 刷怪间隔倍率（0.5..2.0，越小越密集，默认 1.0） */
  spawnIntervalMul: number;
  /** 初始能量（50..200，默认 100） */
  startEnergy: number;
  /** 基地血量倍率（0.5..2.0，默认 1.0） */
  baseHpMul: number;
}

/** v11：自定义难度的预设档位 */
export type CustomDifficultyPreset = "easy" | "normal" | "hard" | "custom";

// ====================================================================
// v11 升级 · 方向 D：扩展 ManagerHud（地形 / 重部署 / 自定义难度）
// ====================================================================

// 以下字段通过可选属性追加到 ManagerHud（在原 interface 内追加）

// ====================================================================
// v11 升级 · 方向 C：扩展 ManagerMetaProgression（弱点情报解锁）
// ====================================================================

/** v11：弱点情报记录（受害人模拟通关后解锁） */
export interface WeaknessIntelRecord {
  /** 关联受害人模拟剧本 id */
  scenarioId: string;
  /** 关联 manager 敌人 typeId */
  enemyTypeId: string;
  /** 伤害加成比例（0.2 = +20%） */
  damageBonus: number;
  /** 解锁时间戳（ms） */
  unlockedAt: number;
}

