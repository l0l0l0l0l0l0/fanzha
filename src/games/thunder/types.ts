export type WeaponLevel = 1 | 2 | 3 | 4;

/** 武器分支类型（新增）：normal=未选择, spread=散射, laser=激光, homing=追踪 */
export type WeaponBranch = "normal" | "spread" | "laser" | "homing";

/** 武器分支等级（新增）：0=未选择, 1-3=普通等级, 4-5=觉醒等级（v3） */
export type WeaponBranchLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** 武器分支定义（新增） */
export interface WeaponBranchDef {
  id: WeaponBranch;
  name: string;
  emoji: string;
  color: string;
  desc: string;
}

/** BOSS 攻击模式 */
export type BossAttackPattern =
  | "spread"      // 扇形散射
  | "spiral"      // 螺旋弹幕
  | "rain"        // 区域弹雨
  | "beam"        // 集束光束
  | "summon"      // 召唤小怪
  | "homing"      // 追踪弹
  | "laserSweep"; // 激光扫射（新增）

/**
 * 特色电诈 BOSS 定义
 * 每个 BOSS 代表一种典型电诈类型，拥有独特形象、攻击模式与反诈知识点
 */
export interface BossDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  color: string;
  fraudType: string;
  /** 攻击模式组合（按阶段轮换） */
  patterns: BossAttackPattern[];
  /** 移动速度倍率 */
  speedMul: number;
  /** 召唤小怪 typeId */
  summonType?: string;
  /** 反诈识破要点 */
  identify: string[];
  /** 是否终极 BOSS */
  ultimate?: boolean;
  /** 外观形状 */
  shape: "hex" | "skull" | "crown" | "eye" | "tower";
  // ===== v2 升级：真实案例 + 教育属性（B1/B2/B4） =====
  /** 真实案例简述（1-2 句话，用于死亡复盘与击败展示） */
  caseStory?: string;
  /** 详细识别口诀（3-5 条，比 identify 更结构化） */
  identifyDetail?: string[];
  /** 防护清单（玩家应采取的行动，如 "挂断后拨打 96110"） */
  protectList?: string[];
  /** 高发人群标签（如 "单身青年/老年人/宝妈"） */
  targetGroup?: string;
  /** 关联的全局图鉴 codexId（击败后解锁，B5 联动） */
  codexId?: string;
  /** 登场 CG 文案（分镜式登场副标，C1） */
  entranceTitle?: string;
  /** 登场 CG 警示语 */
  entranceWarning?: string;
}

/**
 * 反诈道具（强力工具）
 * - antifraudApp：国家反诈APP（盾牌形象），可吸收多次伤害
 * - blockOverseas：不接境外来电，持续秒数内免疫敌方弹幕
 * - policeRaid：公安反诈突击，全屏清场 + 重创敌方
 * - smsFirewall：短信防火墙，摧毁敌方子弹并反击
 * - evidenceLock：证据固定，冻结全场敌方 3s
 * - fraudAwareness：反诈意识觉醒，临时火力顶档 + 双倍伤害
 * - weapon：火力升级
 * - lifePack：生命补给（回复 HP）
 * - phish：钓鱼链接陷阱（降级武器）
 * - hotline96110：96110反诈热线，3秒全屏净化所有敌方弹幕+锁定最强敌人
 * - bankFreeze：银行紧急止付，5秒内敌方所有伤害减半+持续扣敌方血
 * - awarenessAd：反诈宣传员，8秒内连击不掉+自动拾取道具
 * - timeSlow：时间减速（新增），3 秒内敌方/弹幕全部减速 70%
 */
export type PowerupKind =
  | "weapon"
  | "antifraudApp"
  | "blockOverseas"
  | "policeRaid"
  | "smsFirewall"
  | "evidenceLock"
  | "fraudAwareness"
  | "lifePack"
  | "phish" // 钓鱼链接 - 陷阱
  | "hotline96110"
  | "bankFreeze"
  | "awarenessAd"
  | "timeSlow"; // 时间减速（新增）

export interface PowerupDef {
  kind: PowerupKind;
  emoji: string;
  color: string;
  label: string;
  desc: string;
  trap?: boolean;
}

export interface EnemyTypeDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  score: number;
  color: string;
  fraudType: string;
  pattern: "straight" | "zigzag" | "shooter" | "miner";
  shootInterval?: number;
  dropRate?: number;
  /** 护盾值：先破盾再扣血（新增） */
  shield?: number;
  /** 是否精英敌人（更大、更亮光环） */
  elite?: boolean;
}

export interface WaveEntry {
  typeId: string;
  count: number;
  interval: number;
  delay: number;
}

/** 称号体系：随积分晋升的荣誉称号 */
export interface Title {
  id: string;
  name: string;
  minScore: number;
  color: string;
}

export const MAX_HP = 36;
/** 每个铜元宝代表的 HP（36 / 4 = 9 个元宝） */
export const HP_PER_YUANBAO = 4;

export interface ThunderHud {
  hp: number;
  maxHp: number;
  shield: boolean;
  /** 国家反诈APP 护盾剩余吸收次数 */
  appCharges: number;
  /** 不接境外来电：剩余免疫秒数 */
  overseasUntil: number;
  /** 反诈意识觉醒：剩余秒数（>0 时火力顶档 + 双倍伤害） */
  awarenessUntil: number;
  /** 证据固定：剩余冻结秒数 */
  freezeUntil: number;
  /** 96110热线：剩余净化秒数 */
  hotlineUntil: number;
  /** 银行止付：剩余减伤秒数 */
  bankFreezeUntil: number;
  /** 反诈宣传员：剩余秒数 */
  adUntil: number;
  /** 时间减速：剩余秒数（新增） */
  slowMoUntil: number;
  raids: number;
  score: number;
  /** 当前称号 */
  titleName: string;
  titleColor: string;
  /** 下一称号还需多少分（无下一档时为 0） */
  nextTitleGap: number;
  combo: number;
  weapon: WeaponLevel;
  /** 武器经验（0..xpMax，满则自动升级，新增） */
  weaponXp: number;
  /** 武器升级所需经验（新增） */
  weaponXpMax: number;
  /** 分数倍率（基于 combo，新增） */
  scoreMultiplier: number;
  /** 武器分支（新增）：normal/spread/laser/homing */
  weaponBranch?: string;
  /** 武器分支等级（新增）：0-3 */
  weaponBranchLevel?: number;
  phase: "battle" | "boss" | "branch" | "roguelike" | "won" | "lost" | "entrance" | "defeat";
  bossHp?: number;
  bossMax?: number;
  bossPhase?: number;
  /** 当前 BOSS 名称 */
  bossName?: string;
  /** 当前 BOSS 诈骗类型 */
  bossFraudType?: string;
  /** BOSS 是否狂暴（HP < 30%，新增） */
  bossEnraged?: boolean;
  wave: number;
  totalWaves: number;
  /** 阶段切换动画剩余秒数（>0 时显示全屏 overlay，新增） */
  phaseTransitionUntil?: number;
  /** 阶段切换文字（如 "PHASE 2/3"，新增） */
  phaseTransitionText?: string;
  /** 成就解锁提示（一次性，新增） */
  achievement?: { name: string; desc: string; emoji: string };
  /** 分支选择：当 phase === "branch" 时输出的 3 个增援选项 */
  branchOptions?: BranchOption[];
  /** 分支选择阶段：当前关卡序号（用于显示 "第 N 波增援"） */
  branchWave?: number;
  // ===== v2 升级字段 =====
  /** 当前难度（D 难度系统） */
  difficulty?: Difficulty;
  /** 当前模式（A1 模式选择） */
  mode?: ThunderMode;
  /** 是否处于无尽模式（10 波后自动转入） */
  endless?: boolean;
  /** 无尽模式当前难度阶梯（1.0 起步，每波递增） */
  endlessScale?: number;
  /** 当前关卡主题（C3 关卡主题切换） */
  theme?: ThunderTheme;
  /** 大招充能进度 0..1（A5 雷霆审判） */
  ultimateCharge?: number;
  /** 大招是否可用（>=1 时可释放） */
  ultimateReady?: boolean;
  /** 蓄力射击进度 0..1（A4 操作扩展） */
  chargeProgress?: number;
  /** 是否正在蓄力 */
  charging?: boolean;
  /** 闪避冲刺剩余冷却秒数（A4） */
  dashCd?: number;
  /** 闪避冲刺剩余无敌秒数（A4） */
  dashInvincibleUntil?: number;
  /** 当前已激活的 Roguelike Buff 列表（A3） */
  roguelikeBuffs?: ActiveRoguelikeBuff[];
  /** Roguelike 选择阶段：当 phase === "roguelike" 时输出的 2 个选项 */
  roguelikeOptions?: RoguelikeOption[];
  /** 暂停状态（D4） */
  paused?: boolean;
  /** BOSS 登场 CG 阶段（C1） */
  bossEntranceStage?: BossEntranceStage;
  /** BOSS 登场 CG 剩余秒数 */
  bossEntranceUntil?: number;
  /** BOSS 击败慢镜头剩余秒数（B4） */
  bossDefeatSlowmoUntil?: number;
  /** BOSS 击败展示的识别清单（B4） */
  bossDefeatIdentify?: { name: string; identifyDetail?: string[]; protectList?: string[]; caseStory?: string; emoji: string; fraudType: string };
  /** 战机受损形态（HP < 30% 时 true，C2） */
  shipDamaged?: boolean;
  /** 本局击杀分布（按敌人 typeId 统计，C4 结算页用） */
  killStats?: Record<string, number>;
  /** 本局最高连击（C4 结算页用） */
  maxCombo?: number;
  /** 本局已击败 BOSS 数 */
  bossesDefeated?: number;
  /** 本局时长（秒，C4 结算页用） */
  elapsedSec?: number;
  /** 死亡原因（B2 死亡复盘用：被 XX 诈骗击中） */
  deathCause?: { fraudType: string; emoji: string; name: string; identifyDetail?: string[]; protectList?: string[]; caseStory?: string };
  /** 口诀飘字队列（B3，引擎推送到场景渲染） */
  mantraTexts?: { text: string; until: number }[];
  // ===== v3 升级：角色 / 装备 / 觉醒 =====
  /** 当前角色 id */
  characterId?: string;
  /** 当前角色名 */
  characterName?: string;
  /** 当前角色 emoji */
  characterEmoji?: string;
  /** 当前角色针对的诈骗类型（伤害加成提示） */
  characterFraudTypes?: string[];
  /** 已装备配件名（槽位 → 名） */
  equippedEquipments?: { slot: string; name: string; emoji: string }[];
  /** 武器是否已觉醒 */
  weaponAwakened?: boolean;
  /** 觉醒形态名（如 "风暴散射"） */
  awakeningName?: string;
  /** 觉醒提示 toast（一次性） */
  awakeningToast?: { name: string; mantra: string; emoji: string };
}

/** 分支增援选项 */
export interface BranchOption {
  id: "weapon" | "shield" | "tactical";
  emoji: string;
  title: string;
  desc: string;
  color: string;
}

// ===== v2 升级类型定义 =====

/** 难度等级（A2 难度系统） */
export type Difficulty = "normal" | "hard" | "nightmare";

/** 难度配置 */
export interface DifficultyConfig {
  id: Difficulty;
  name: string;
  desc: string;
  color: string;
  /** 敌人血量倍率 */
  enemyHpMul: number;
  /** 敌人速度倍率 */
  enemySpeedMul: number;
  /** 敌人攻击频率倍率（越小越快） */
  enemyFireMul: number;
  /** 道具掉落倍率 */
  dropMul: number;
  /** BOSS 血量倍率 */
  bossHpMul: number;
  /** 玩家初始 HP 倍率 */
  playerHpMul: number;
  /** 分数倍率 */
  scoreMul: number;
  /** 大招充能倍率（越高越快） */
  ultChargeMul: number;
}

/** 游戏模式（A1 模式选择） */
export type ThunderMode = "campaign" | "endless" | "daily";

/** 关卡主题（C3 关卡主题切换） */
export type ThunderTheme = "city" | "border" | "cyber" | "overseas";

/** 主题配置 */
export interface ThunderThemeDef {
  id: ThunderTheme;
  name: string;
  desc: string;
  /** 背景主色 */
  bgColor: string;
  /** 网格色 */
  gridColor: string;
  /** 星云色组合（RGB 字符串） */
  nebulaColors: [string, string, string];
  /** 主题起始波次 */
  startWave: number;
  /** 主题图标 */
  emoji: string;
}

/** Roguelike Buff 类型（A3） */
export type RoguelikeBuffKind =
  | "critUp"        // 暴击率 +15%
  | "pierceUp"      // 子弹穿透 +1
  | "lifesteal"     // 吸血 8%
  | "chainLight"    // 连锁闪电（命中后跳到附近敌人）
  | "multiShot"     // 多发 +1
  | "damageUp"      // 伤害 +20%
  | "fireRateUp"    // 射速 +20%
  | "moveSpeedUp"   // 移速 +15%
  | "shieldRegen"   // 护盾自动恢复
  | "scoreBoost"    // 分数 +25%
  | "ultBoost"      // 大招充能 +30%
  | "thorns"        // 反伤 30%
  | "dropBoost"     // 掉落率 +30%
  | "healOnBoss"    // BOSS 战每秒回血
  | "comboShield";  // 连击不被打断

/** Roguelike Buff 定义 */
export interface RoguelikeBuffDef {
  kind: RoguelikeBuffKind;
  name: string;
  emoji: string;
  color: string;
  desc: string;
  /** 稀有度：common/rare/epic */
  rarity: "common" | "rare" | "epic";
  /** 是否可叠加 */
  stackable: boolean;
  /** 最大叠加层数 */
  maxStack?: number;
}

/** 已激活的 Roguelike Buff 实例 */
export interface ActiveRoguelikeBuff {
  kind: RoguelikeBuffKind;
  name: string;
  emoji: string;
  color: string;
  /** 当前层数 */
  stack: number;
}

/** Roguelike 选择选项 */
export interface RoguelikeOption {
  kind: RoguelikeBuffKind;
  name: string;
  emoji: string;
  desc: string;
  color: string;
  rarity: "common" | "rare" | "epic";
  /** 若玩家已有该 buff，显示当前层数 / 最大层数 */
  currentStack?: number;
  maxStack?: number;
}

/** BOSS 登场 CG 阶段（C1） */
export type BossEntranceStage =
  | "warn"    // 预警条阶段
  | "flash"   // 闪屏阶段
  | "zoom"    // 慢推近阶段
  | "title"   // 名称特写阶段
  | "done";   // CG 结束

/** 雷霆审判大招状态（A5） */
export interface UltimateState {
  /** 当前充能值 0..ULTIMATE_MAX */
  charge: number;
  /** 是否就绪 */
  ready: boolean;
  /** 大招激活剩余秒数（>0 时正在释放） */
  activeUntil: number;
}

/** 蓄力射击状态（A4） */
export interface ChargeState {
  /** 是否正在蓄力 */
  charging: boolean;
  /** 蓄力进度 0..1 */
  progress: number;
  /** 蓄力开始时间 */
  startedAt: number;
  /** 蓄力满阈值（秒） */
  fullThreshold: number;
}

/** 闪避冲刺状态（A4） */
export interface DashState {
  /** 剩余冷却秒数 */
  cd: number;
  /** 冷却总时长 */
  cdMax: number;
  /** 冲刺剩余无敌秒数 */
  invincibleUntil: number;
  /** 冲刺方向 */
  dirX: number;
  dirY: number;
}

/** 本地存档数据（D1） */
export interface ThunderSaveData {
  /** 历史最高分 */
  bestScore: number;
  /** 历史最高连击 */
  bestCombo: number;
  /** 历史最高波次（无尽模式） */
  bestEndlessWave: number;
  /** 已击败的 BOSS id 列表 */
  defeatedBosses: string[];
  /** 累计击败 BOSS 数 */
  totalBossKills: number;
  /** 累计识破数 */
  totalBusted: number;
  /** 累计游戏时长（秒） */
  totalPlayTime: number;
  /** 已解锁的武器分支 */
  unlockedBranches: WeaponBranch[];
  /** 最近一次每日挑战日期（YYYY-MM-DD） */
  lastDailyDate?: string;
  /** 最近一次每日挑战种子 */
  lastDailySeed?: number;
  // ===== v3 升级：角色 / 装备 / 觉醒 =====
  /** 已解锁的角色 id 列表 */
  unlockedCharacters: CharacterId[];
  /** 当前装备的角色 id */
  equippedCharacter: CharacterId;
  /** 已拥有的装备 id 列表（可重复，按掉落顺序记录） */
  ownedEquipments: string[];
  /** 当前装备的配件 id（按槽位） */
  equippedEquipments: { weaponChip?: string; shieldCore?: string; moveModule?: string };
  /** 已觉醒的武器分支（达成觉醒条件后记录，跨局保留） */
  awakenedBranches: WeaponBranch[];
  /** 各角色累计使用次数（用于统计/成就） */
  characterUsage: Partial<Record<CharacterId, number>>;
  /** 各诈骗类型累计击杀数（用于角色解锁条件判断） */
  fraudKills: Record<string, number>;
}

/** 引擎初始化选项（v2 升级，由场景传入） */
export interface ThunderEngineOptions {
  difficulty: Difficulty;
  mode: ThunderMode;
  /** 每日种子（仅 daily 模式） */
  dailySeed?: number;
  // ===== v3 升级：角色 / 装备 =====
  /** 选择的角色 id（默认 swat） */
  characterId?: CharacterId;
  /** 装备的配件 id 列表（按槽位，最多 3 件） */
  equipmentIds?: { weaponChip?: string; shieldCore?: string; moveModule?: string };
}

/** 引擎事件：图鉴解锁（B5 联动） */
export interface CodexUnlockEvent {
  codexId: string;
  source: "thunder";
}

/** 引擎事件：本地存档更新（D1） */
export interface SaveDataUpdateEvent {
  save: ThunderSaveData;
}

// ===========================================================================
// ===== v3 升级类型定义：角色 / 装备 / 武器觉醒 ============================
// ===========================================================================

/** 角色 id（v3 新增）：5 位反诈专家 */
export type CharacterId = "swat" | "cyber" | "volunteer" | "banker" | "officer";

/** 角色被动类型 */
export type CharacterPassiveKind =
  | "shieldStart"      // 初始获得反诈APP护盾
  | "scoreBoost"       // 积分加成
  | "dropBoost"        // 道具掉落加成
  | "ultChargeStart"   // 初始大招充能
  | "hpRegenWave"      // 每波回血
  | "branchStart"      // 初始武器分支
  | "dmgToFraudTypes"; // 对特定诈骗类型伤害加成

/** 角色被动效果 */
export interface CharacterPassive {
  kind: CharacterPassiveKind;
  /** 数值参数（如加成比例、回血量） */
  value?: number;
  /** 针对的诈骗类型列表（dmgToFraudTypes 用） */
  fraudTypes?: string[];
  /** 初始武器分支（branchStart 用） */
  branch?: WeaponBranch;
  /** 初始武器分支等级（branchStart 用） */
  branchLevel?: WeaponBranchLevel;
}

/** 角色定义（v3 新增）：反诈专家 */
export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  emoji: string;
  color: string;
  /** 角色描述（教育向，介绍其反诈专长） */
  desc: string;
  /** 专长应对的诈骗类型（教育向） */
  expertise: string;
  /** 识别要点（教育向，2-3 条） */
  tips: string[];
  /** 被动技能列表 */
  passives: CharacterPassive[];
  /** 解锁条件描述（UI 显示） */
  unlockDesc: string;
  /** 是否默认解锁 */
  default?: boolean;
}

/** 装备槽位（v3 新增） */
export type EquipSlot = "weaponChip" | "shieldCore" | "moveModule";

/** 装备稀有度 */
export type EquipRarity = "common" | "rare" | "epic";

/** 装备效果（数值加成） */
export interface EquipEffect {
  dmgMul?: number;        // 伤害倍率（1.1 = +10%）
  critRate?: number;      // 暴击率（0.15 = +15%）
  pierce?: number;        // 穿透数
  multishot?: number;     // 额外多发数
  shieldCharges?: number; // 反诈APP护盾层数
  dmgReduce?: number;     // 减伤比例（0.15 = -15%）
  moveSpeedMul?: number;  // 移速倍率
  dashCdMul?: number;     // 闪避冷却倍率（0.8 = -20%）
  ultChargeMul?: number;  // 大招充能倍率
  dropMul?: number;       // 道具掉落倍率
  scoreMul?: number;      // 积分倍率
  hpRegen?: number;       // 每秒回血
}

/** 装备定义（v3 新增）：反诈配件 */
export interface EquipmentDef {
  id: string;
  slot: EquipSlot;
  name: string;
  emoji: string;
  rarity: EquipRarity;
  color: string;
  /** 效果说明（玩家可读） */
  desc: string;
  /** 反诈知识文案（教育向，装备掉落/查看时展示） */
  lore: string;
  /** 数值效果 */
  effect: EquipEffect;
}

/** 武器觉醒定义（v3 新增）：分支等级 4-5 的觉醒形态 */
export interface WeaponAwakeningDef {
  branch: Exclude<WeaponBranch, "normal">;
  level: 4 | 5;
  name: string;
  emoji: string;
  desc: string;
  /** 觉醒后的反诈口诀（达成觉醒时飘字） */
  mantra: string;
  /** 觉醒效果 */
  effect: {
    dmgMul: number;           // 伤害倍率
    extraProjectiles?: number; // 额外弹幕数
    pierce?: number;          // 穿透数
    homing?: boolean;         // 追踪
    explode?: boolean;        // 爆炸
    explodeRadius?: number;   // 爆炸半径
  };
}

/** v3 升级：本局掉落装备事件（引擎 → 场景） */
export interface EquipmentDropEvent {
  equipmentId: string;
  fromBoss: string;
}

/** v3 升级：角色解锁事件（引擎 → 场景） */
export interface CharacterUnlockEvent {
  characterId: CharacterId;
}

/** v3 升级：武器觉醒事件（引擎 → 场景） */
export interface WeaponAwakenEvent {
  branch: WeaponBranch;
  awakeningName: string;
  mantra: string;
}
