export type WeaponLevel = 1 | 2 | 3 | 4;

/** 武器分支类型（新增）：normal=未选择, spread=散射, laser=激光, homing=追踪 */
export type WeaponBranch = "normal" | "spread" | "laser" | "homing";

/** 武器分支等级（新增）：0=未选择, 1-3=普通等级, 4-5=觉醒等级（v3）, 6-7=超觉醒等级（v6） */
export type WeaponBranchLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 武器分支定义（新增） */
export interface WeaponBranchDef {
  id: WeaponBranch;
  name: string;
  emoji: string;
  color: string;
  desc: string;
}

/**
 * BOSS 攻击模式
 */
export type BossAttackPattern =
  | "spread"      // 扇形散射
  | "spiral"      // 螺旋弹幕
  | "rain"        // 区域弹雨
  | "beam"        // 集束光束
  | "summon"      // 召唤小怪
  | "homing"      // 追踪弹
  | "laserSweep"  // 激光扫射（新增）
  // ===== v6 升级：组合弹幕模式 =====
  | "crossFire"   // 交叉火力（两种弹幕叠加）
  | "ringBurst"   // 环形爆发（多层圆环弹幕）
  | "waveDash";   // 波浪冲刺（移动+扇形弹幕）

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
  // ===== v5 升级：BOSS 多阶段变身 =====
  /** 多阶段变身定义（按 HP 阈值触发，空则单阶段） */
  phases?: BossPhaseDef[];
  // ===== v6 升级：BOSS AI 对话 / 溯源档案 / 组合弹幕 =====
  /** BOSS AI 对话剧本 ID（HP < 20% 时触发最终话术识破，对应 ThunderBossAIDialog.id） */
  aiDialogId?: string;
  /** 关联的诈骗溯源档案 ID（击败后解锁，对应 ThunderFraudArchive.id） */
  archiveId?: string;
  /** 组合弹幕模式：当 BOSS 进入第 2 阶段后，可同时触发的弹幕模式叠加 */
  combinedPatterns?: BossAttackPattern[];
  /** BOSS 超觉醒阶段定义（HP < 10% 触发，独立于 phases） */
  superPhase?: BossPhaseDef;
}

/** BOSS 变身阶段定义（v5 新增）：HP 低于阈值时切换形态 */
export interface BossPhaseDef {
  /** 阶段序号（1-based，从第 2 阶段开始定义） */
  phase: number;
  /** 触发 HP 阈值（0..1，HP 低于此比例时变身） */
  hpThreshold: number;
  /** 变身后名称前缀（如 "狂暴" / "终极"） */
  namePrefix: string;
  /** 变身后 emoji */
  emoji?: string;
  /** 变身后颜色 */
  color?: string;
  /** 变身后追加的攻击模式 */
  extraPatterns?: BossAttackPattern[];
  /** 变身后速度倍率 */
  speedMul?: number;
  /** 变身后弹幕频率倍率（越小越快） */
  fireMul?: number;
  /** 变身全屏闪光色 */
  flashColor?: string;
  /** 变身警示语 */
  warningText?: string;
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
  | "timeSlow" // 时间减速（新增）
  // ===== v5 新增道具 =====
  | "droneDeploy"   // 无人机部署：召唤一架伴随无人机
  | "shieldBurst";  // 护盾爆发：清屏弹幕 + 临时护盾

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
  // ===== v4 升级：天赋树 / 套装 / BossRush / 影子 =====
  /** 已激活的天赋节点列表（用于 HUD 显示） */
  talentBuffs?: { name: string; emoji: string; branch: string }[];
  /** 当前装备套装效果（无套装为 null） */
  setBonus?: { name: string; desc: string; emoji: string; rarity: string } | null;
  /** BossRush 模式专属：当前阶段 / 总阶段 / 累计用时 */
  bossRush?: { stage: number; totalStages: number; timeSec: number; stageResults: { stage: number; bossName: string; timeSec: number; emoji: string }[] };
  /** 影子挑战：当前分数 vs 影子分数 */
  ghostProgress?: { ghostScore: number; currentScore: number; ahead: boolean; ghostCharacter: string } | null;
  /** 天赋点余额（场景层显示） */
  talentPoints?: number;
  // ===== v5 升级：擦弹 / 无人机 / 克制 / BOSS阶段 / 新模式 =====
  /** 擦弹充能进度 0..1（满可触发擦弹奖励） */
  grazeCharge?: number;
  /** 本局累计擦弹数（结算用） */
  grazeCount?: number;
  /** 擦弹奖励激活剩余秒数（>0 时分数倍率提升） */
  grazeBoostUntil?: number;
  /** 当前武器分支对当前主流诈骗类型的克制关系（"advantage"|"disadvantage"|"neutral"） */
  counterRelation?: "advantage" | "disadvantage" | "neutral";
  /** 无人机列表（HUD 显示） */
  drones?: { kind: string; name: string; emoji: string }[];
  /** 无人机剩余存在秒数（>0 时有伴随无人机） */
  droneUntil?: number;
  /** BOSS 当前阶段序号（1-based，多阶段变身用） */
  bossPhaseNum?: number;
  /** BOSS 总阶段数 */
  bossPhaseTotal?: number;
  /** BOSS 变身闪光剩余秒数（全屏闪光提示） */
  bossTransformFlash?: number;
  /** BOSS 变身警示语（变身时一次性飘字） */
  bossTransformWarning?: string;
  /** 生存模式：保护目标剩余 HP */
  protectHp?: number;
  /** 生存模式：保护目标最大 HP */
  protectMaxHp?: number;
  /** 生存模式：保护目标 emoji */
  protectEmoji?: string;
  /** 极限挑战：是否禁用道具 */
  noPowerups?: boolean;
  /** 段位赛：当前段位名 */
  rankName?: string;
  /** 段位赛：当前段位 emoji */
  rankEmoji?: string;
  /** 段位赛：本局段位积分变化（结算时填充） */
  rankDelta?: number;
  /** 案例剧场触发标记（BOSS 击败后一次性） */
  caseTheaterTrigger?: { bossName: string; caseStory: string; identifyDetail?: string[]; protectList?: string[]; emoji: string; fraudType: string };
  // ===== v6 升级字段 =====
  /** BOSS AI 对话状态（HP < 20% 时激活，null=未激活） */
  bossAIDialog?: ThunderHudBossAIDialogState | null;
  /** 反诈口诀连招状态（连击 5/10/20/50 触发） */
  mantraChain?: ThunderHudMantraChainState | null;
  /** 诈骗溯源档案触发标记（BOSS 击败后一次性） */
  fraudArchiveTrigger?: ThunderFraudArchive | null;
  /** 赛季通行证进度（HUD 顶部展示） */
  seasonPass?: ThunderHudSeasonPassState | null;
  /** 格挡反击状态（P1 新操作） */
  parry?: ThunderParryState | null;
  /** 武器超觉醒状态（6-7 级） */
  superAwakening?: ThunderSuperAwakeningState | null;
  /** BOSS 当前组合弹幕模式列表（P2，多模式叠加） */
  bossActiveCombinedPatterns?: BossAttackPattern[];
  /** 本局累计格挡成功次数（结算用） */
  parryCount?: number;
  /** 本局累计口诀连招触发次数（结算用） */
  mantraTriggeredCount?: number;
  /** 本局累计 AI 对话识破次数（结算用） */
  aiDialogBustedCount?: number;
  // ===== v7 升级字段 =====
  /** v7 剧情战役状态（mode="story" 时有效） */
  story?: ThunderHudStoryState | null;
  /** v7 RPG 剧本状态（mode="rpg" 时有效） */
  rpg?: ThunderHudRPGState | null;
  /** v7 自适应 AI 当前动态难度倍率（>1 加难，<1 减难，1=标准） */
  adaptiveDifficultyMul?: number;
  /** v7 自适应 AI 玩家技能评分（0..100） */
  adaptiveSkillScore?: number;
  /** v7 程序化弹幕：当前 BOSS 使用的程序化模式 ID（null=使用预设模式） */
  proceduralPatternId?: string | null;
  /** v7 程序化弹幕：当前种子 */
  proceduralSeed?: number;
  /** v7 课程模式状态（mode="lesson" 时有效） */
  lesson?: ThunderHudLessonState | null;
  /** v7 一次性 toast：v7 子系统触发提示（如证书解锁/RPG 结局） */
  v7Toast?: { text: string; tone: "good" | "bad" | "info"; until: number } | null;
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

/** 游戏模式（A1 模式选择，v4 新增 bossRush，v5 新增 weekly/survival/challenge/ranked，v7 新增 story/lesson/rpg/analytics） */
export type ThunderMode = "campaign" | "endless" | "daily" | "bossRush" | "weekly" | "survival" | "challenge" | "ranked" | "story" | "lesson" | "rpg" | "analytics";

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
  // ===== v4 升级：天赋树 / 套装 / BossRush / 排行榜 / 影子 =====
  /** 天赋点（跨局保留，BOSS 击败 / BossRush 通关获得） */
  talentPoints: number;
  /** 已解锁天赋节点：characterId → branch → 已解锁最高 tier */
  characterTalents: ThunderTalentState;
  /** BossRush 最佳记录（按 difficulty 分桶） */
  bossRushBest: Partial<Record<Difficulty, BossRushResult>>;
  /** 本地排行榜（每日/每周/全时段 top 10） */
  leaderboard: ThunderLeaderboard;
  /** 影子挑战记录（用于异步 PVP） */
  ghostRecords: GhostRecord[];
  /** v4 累计获得天赋点（统计用） */
  totalTalentPointsEarned: number;
  // ===== v5 升级：擦弹 / 无人机 / 赛季 / 任务 / 皮肤 / 案例 / 周常 =====
  /** 累计擦弹数（统计用） */
  totalGrazeCount: number;
  /** 当前赛季 id（如 "S1"） */
  currentSeasonId: string;
  /** 当前段位积分 */
  rankPoints: number;
  /** 当前段位 tier id（如 "silver"） */
  rankTier: string;
  /** 当前赛季最高段位积分 */
  seasonBestPoints: number;
  /** 历史最高段位 tier id */
  peakRankTier: string;
  /** 赛季结算历史：seasonId → 最终段位 */
  seasonHistory: Record<string, { tier: string; points: number; date: string }>;
  /** 每日任务：日期键 → 任务进度列表 */
  dailyQuests: Record<string, ThunderQuestProgress[]>;
  /** 最近一次每日任务日期（YYYY-MM-DD） */
  lastQuestDate?: string;
  /** 已解锁皮肤 id 列表 */
  unlockedSkins: string[];
  /** 当前装备的皮肤 id */
  equippedSkin: string;
  /** 周常挑战：本周修饰符 id */
  weeklyModifierId?: string;
  /** 周常挑战：本周最佳记录 */
  weeklyBestScore: number;
  /** 周常挑战：本周已挑战次数 */
  weeklyPlayCount: number;
  /** 已观看的案例剧场 bossId 列表（避免重复强制观看） */
  watchedCaseTheater: string[];
  /** 生存模式最高波次 */
  bestSurvivalWave: number;
  /** 极限挑战最高分 */
  bestChallengeScore: number;
  /** v5 累计获得皮肤数（统计用） */
  totalSkinsEarned: number;
  // ===== v6 升级新增字段 =====
  /** 已解锁的诈骗溯源档案 ID 列表（S3，BOSS 击败后解锁） */
  unlockedFraudArchives: string[];
  /** 赛季通行证状态（S4） */
  seasonPass: ThunderSeasonPassSave;
  /** 已超觉醒的武器分支（P4，6-7 级） */
  superAwakenedBranches: WeaponBranch[];
  /** v6 累计格挡成功次数（统计用，P1） */
  totalParryCount: number;
  /** v6 累计口诀连招触发次数（统计用，S2） */
  totalMantraTriggered: number;
  /** v6 累计 BOSS AI 对话识破次数（统计用，S1） */
  totalAIDialogBusted: number;
  /** v6 当前赛季通行证等级 */
  seasonPassLevel: number;
  /** v6 当前赛季通行证经验 */
  seasonPassExp: number;
  /** v6 是否购买精英通行证（本赛季） */
  seasonPassElite: boolean;
  // ===== v7 升级新增字段 =====
  /** v7 剧情战役进度：已通关关卡 ID 列表（按顺序） */
  storyClearedStages: string[];
  /** v7 剧情战役：已解锁的结局 ID 列表 */
  storyUnlockedEndings: string[];
  /** v7 剧情战役：当前章节索引（用于"继续剧情"） */
  storyCurrentChapter: number;
  /** v7 课程系统：已通关章节 ID 列表 */
  lessonClearedChapters: string[];
  /** v7 课程系统：各章节测验最高分 */
  lessonBestScores: Record<string, number>;
  /** v7 RPG 剧本：已完成的剧本 ID 列表 */
  rpgClearedScenarios: string[];
  /** v7 RPG 剧本：已解锁的结局 ID 列表 */
  rpgUnlockedEndings: string[];
  /** v7 知识图谱：各节点掌握度快照（nodeId → 0..1） */
  knowledgeMastery: Record<string, number>;
  /** v7 自适应 AI：玩家行为画像版本号（每次更新自增） */
  adaptiveProfileVersion: number;
  /** v7 自适应 AI：玩家技能评分（0..100，综合表现） */
  adaptiveSkillScore: number;
  /** v7 自适应 AI：最近 10 局表现记录（用于趋势分析） */
  adaptiveRecentRuns: Array<{ mode: ThunderMode; score: number; win: boolean; skillDelta: number; at: string }>;
  /** v7 证书系统：已颁发的证书 ID 列表 */
  unlockedCertificates: string[];
  /** v7 证书系统：各证书进度（certId → 当前进度值） */
  certificateProgress: Record<string, number>;
  /** v7 累计完成 RPG 剧本数（统计用） */
  totalRPGCleared: number;
  /** v7 累计完成课程章节数（统计用） */
  totalLessonsCleared: number;
  /** v7 累计解锁知识图谱节点数（统计用） */
  totalKnowledgeNodesUnlocked: number;
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
  // ===== v4 升级：BossRush / 影子 =====
  /** BossRush 模式：本局挑战的 BOSS 序列（id 列表，按出战顺序） */
  bossRushBossIds?: string[];
  /** BossRush 模式：是否为最后一战（含终极 BOSS） */
  bossRushFinalStage?: boolean;
  /** 影子挑战：用于回放的影子记录 */
  ghostRecord?: GhostRecord;
  /** v4：是否启用天赋树效果（默认 true，关闭则忽略存档天赋） */
  enableTalents?: boolean;
  // ===== v5 升级选项 =====
  /** 周常挑战：本周修饰符 id */
  weeklyModifierId?: string;
  /** 生存模式：保护目标初始 HP */
  survivalTargetHp?: number;
  /** 极限挑战：禁用道具 */
  challengeNoPowerups?: boolean;
  /** 段位赛：是否启用段位积分结算 */
  rankedMode?: boolean;
  /** v5：装备的皮肤 id */
  skinId?: string;
  // ===== v6 升级选项 =====
  /** 是否启用 BOSS AI 对话识破（S1，默认 true） */
  enableBossAIDialog?: boolean;
  /** 是否启用反诈口诀连招（S2，默认 true） */
  enableMantraChain?: boolean;
  /** 是否启用格挡反击操作（P1，默认 true） */
  enableParry?: boolean;
  /** 是否启用组合弹幕（P2，默认 true，仅 BOSS 第 2 阶段后生效） */
  enableCombinedPatterns?: boolean;
  /** 是否启用超觉醒 6-7 级（P4，默认 true，需存档已觉醒） */
  enableSuperAwakening?: boolean;
  /** 是否启用诈骗溯源档案解锁（S3，默认 true） */
  enableFraudArchive?: boolean;
  /** 是否启用赛季通行证经验结算（S4，默认 true） */
  enableSeasonPass?: boolean;
  // ===== v7 升级选项 =====
  /** v7 剧情战役：本局开始的关卡 ID（用于"继续剧情"） */
  storyStartStageId?: string;
  /** v7 剧情战役：是否为支线关卡 */
  storyIsBranch?: boolean;
  /** v7 RPG 模式：本局挑战的剧本 ID */
  rpgScenarioId?: string;
  /** v7 自适应 AI：是否启用动态难度调整（默认 true） */
  enableAdaptiveAI?: boolean;
  /** v7 自适应 AI：玩家技能评分覆盖（用于测试） */
  adaptiveSkillOverride?: number;
  /** v7 程序化弹幕：是否启用程序化生成（默认 true，仅 BOSS 战生效） */
  enableProceduralPatterns?: boolean;
  /** v7 程序化弹幕：种子（同种子生成相同弹幕，用于每日挑战） */
  proceduralSeed?: number;
  /** v7 课程模式：本局学习的章节 ID */
  lessonChapterId?: string;
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

/** 角色 id（v3 新增，v5 扩展至 7 位）：5+2 位反诈专家 */
export type CharacterId = "swat" | "cyber" | "volunteer" | "banker" | "officer" | "streamer" | "student";

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

// ===========================================================================
// ===== v4 升级类型定义：天赋树 / 装备套装 / BossRush / 排行榜 / 影子挑战 ===
// ===========================================================================

/** 天赋分支（v4 新增）：攻 / 防 / 辅 */
export type ThunderTalentBranch = "offense" | "defense" | "support";

/** 天赋节点定义（v4 新增） */
export interface ThunderTalentNodeDef {
  /** 节点 id（同角色内唯一） */
  id: string;
  /** 所属分支 */
  branch: ThunderTalentBranch;
  /** 层级 1..5（必须按层级顺序解锁） */
  tier: 1 | 2 | 3 | 4 | 5;
  /** 节点名称 */
  name: string;
  /** 节点 emoji */
  emoji: string;
  /** 描述（玩家可读） */
  desc: string;
  /** 解锁消耗天赋点 */
  cost: number;
  /** 数值效果 */
  effect: EquipEffect;
  /** 反诈知识文案（教育向） */
  lore?: string;
}

/** 天赋树（v4 新增）：每个角色 3 分支 × 5 节点 */
export interface ThunderTalentTree {
  characterId: CharacterId;
  nodes: ThunderTalentNodeDef[];
}

/** 已激活天赋快照（v4 新增）：characterId → branch → tier */
export type ThunderTalentState = Partial<
  Record<CharacterId, Partial<Record<ThunderTalentBranch, number>>>
>;

/** 装备套装效果（v4 新增）：3 件同稀有度触发 */
export interface EquipSetBonus {
  /** 套装稀有度门槛 */
  rarity: EquipRarity;
  /** 套装名称 */
  name: string;
  /** 描述 */
  desc: string;
  /** 数值效果 */
  effect: EquipEffect;
  /** 特殊机制标识（用于引擎额外逻辑） */
  special?: "shieldRegen" | "ultBurst" | "ghostTrail" | "thornsAura";
}

/** BossRush 配置（v4 新增） */
export interface BossRushConfig {
  /** 连战 BOSS 数量 */
  totalStages: number;
  /** 是否包含终极 BOSS（最后一战） */
  includeUltimate: boolean;
  /** 每战间隔秒数（恢复/补给） */
  restSec: number;
  /** 每战 HP 恢复比例（0..1） */
  hpRestoreRatio: number;
  /** 每战奖励天赋点 */
  talentPointPerStage: number;
  /** 通关奖励天赋点 */
  clearTalentPoints: number;
}

/** BossRush 单战结果（v4 新增） */
export interface BossRushStageResult {
  /** 第几战（1-based） */
  stage: number;
  /** BOSS id */
  bossId: string;
  /** BOSS 名称 */
  bossName: string;
  /** 用时（秒） */
  timeSec: number;
  /** 剩余 HP */
  hpLeft: number;
  /** 最大 HP */
  maxHp: number;
  /** 是否胜利 */
  win: boolean;
}

/** BossRush 总结果（v4 新增） */
export interface BossRushResult {
  /** 是否通关 */
  cleared: boolean;
  /** 总用时（秒） */
  totalTimeSec: number;
  /** 总得分 */
  totalScore: number;
  /** 各战结果 */
  stages: BossRushStageResult[];
  /** 获得天赋点 */
  talentPointsGained: number;
}

/** 排行榜条目（v4 新增） */
export interface ThunderLeaderboardEntry {
  /** 模式 */
  mode: ThunderMode;
  /** 难度 */
  difficulty: Difficulty;
  /** 分数 */
  score: number;
  /** 波数 / BOSS 战数 */
  wave: number;
  /** 最大连击 */
  maxCombo: number;
  /** 击败 BOSS 数 */
  bossKills: number;
  /** 用时（秒） */
  durationSec: number;
  /** 完成日期（YYYY-MM-DD） */
  date: string;
  /** 角色名（用于显示） */
  characterName: string;
}

/** 排行榜（v4 新增）：分模式 + 分时间段 */
export interface ThunderLeaderboard {
  /** 每日 top 10（按日期键） */
  daily: Record<string, ThunderLeaderboardEntry[]>;
  /** 每周 top 10（按周键 YYYY-Www） */
  weekly: Record<string, ThunderLeaderboardEntry[]>;
  /** 全时段 top 10 */
  allTime: ThunderLeaderboardEntry[];
}

/** 影子记录（v4 新增）：异步 PVP 挑战的"幽灵" */
export interface GhostRecord {
  /** 记录 id */
  id: string;
  /** 模式 */
  mode: ThunderMode;
  /** 难度 */
  difficulty: Difficulty;
  /** 分数 */
  score: number;
  /** 玩家操作时间戳序列（用于回放） */
  inputs: { t: number; x: number; y: number; bomb: boolean; ult: boolean }[];
  /** 角色名 */
  characterName: string;
  /** 完成日期 */
  date: string;
}

// ===========================================================================
// ===== v5 升级类型定义：擦弹 / 三角克制 / 无人机 / 赛季 / 任务 / 皮肤 ======
// ===== / 案例剧场 / 周常修饰符 / 生存防守 ===================================
// ===========================================================================

/** 三角克制关系（v5 新增）：散射→追踪→激光→散射 循环克制 */
export type CounterRelation = "advantage" | "disadvantage" | "neutral";

/** 擦弹奖励配置（v5 新增） */
export interface GrazeConfig {
  /** 擦弹判定半径（像素，子弹中心到飞船中心的距离区间） */
  radius: number;
  /** 每次擦弹获得充能值 */
  chargePerGraze: number;
  /** 充能满阈值（0..1） */
  chargeMax: number;
  /** 擦弹奖励持续秒数 */
  boostDuration: number;
  /** 擦弹奖励期间分数倍率 */
  boostScoreMul: number;
}

/** 无人机类型（v5 新增） */
export type DroneKind = "gunpod" | "laserpod" | "shieldpod";

/** 无人机定义（v5 新增）：伴随战机作战的辅助单位 */
export interface DroneDef {
  kind: DroneKind;
  name: string;
  emoji: string;
  color: string;
  desc: string;
  /** 武器分支（决定开火模式） */
  branch: WeaponBranch;
  /** 伤害倍率 */
  dmgMul: number;
  /** 开火间隔（秒） */
  fireInterval: number;
  /** 持续存在秒数（0 = 永久到本局结束） */
  duration: number;
  /** 反诈知识文案（教育向） */
  lore: string;
}

/** 无人机实例状态（引擎内部） */
export interface DroneState {
  def: DroneKind;
  x: number;
  y: number;
  fireCd: number;
  until: number;
  /** 跟随偏移角度 */
  offsetAngle: number;
}

/** 段位 tier（v5 新增）：青铜→宗师 */
export type ThunderRankTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master"
  | "grandmaster";

/** 段位定义（v5 新增） */
export interface ThunderRankTierDef {
  id: ThunderRankTier;
  name: string;
  emoji: string;
  color: string;
  /** 最低积分门槛 */
  minPoints: number;
  /** 该段位胜利基础加分 */
  winGain: number;
  /** 该段位失败基础扣分 */
  loseLoss: number;
}

/** 赛季定义（v5 新增） */
export interface ThunderSeason {
  id: string;
  name: string;
  /** 赛季开始日期 YYYY-MM-DD */
  startDate: string;
  /** 赛季结束日期 YYYY-MM-DD */
  endDate: string;
  desc: string;
}

/** 每日任务定义（v5 新增） */
export interface ThunderQuestDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  /** 目标进度 */
  target: number;
  /** 任务类型 */
  kind: "graze" | "kill" | "boss" | "combo" | "score" | "wave";
  /** 奖励天赋点 */
  rewardTalentPoints: number;
  /** 奖励皮肤 id（可选） */
  rewardSkinId?: string;
}

/** 每日任务进度（v5 新增） */
export interface ThunderQuestProgress {
  questId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

/** 飞船皮肤定义（v5 新增）：纯视觉，不改数值 */
export interface ThunderSkinDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  desc: string;
  /** 飞船主色 */
  shipColor: string;
  /** 飞船描边色 */
  shipStroke: string;
  /** 引擎尾焰色 */
  engineFlame: string;
  /** 子弹色 */
  bulletColor: string;
  /** 解锁条件描述 */
  unlockDesc: string;
  /** 是否默认解锁 */
  default?: boolean;
}

/** 案例剧场定义（v5 新增）：BOSS 击败后的沉浸式案例回放 */
export interface CaseTheaterDef {
  bossId: string;
  /** 剧场标题 */
  title: string;
  /** 分镜列表（按顺序播放） */
  scenes: {
    /** 分镜标题 */
    title: string;
    /** 分镜文案 */
    text: string;
    /** 分镜 emoji/图标 */
    emoji: string;
    /** 该分镜持续秒数 */
    duration: number;
  }[];
  /** 结尾口诀 */
  mantra?: string;
  /** 关联诈骗类型 */
  fraudType: string;
}

/** 周常修饰符定义（v5 新增）：每周轮换的特殊规则 */
export interface WeeklyModifierDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** 修饰符类型 */
  kind: "doubleScore" | "noPowerups" | "bossOnly" | "fastEnemy" | "lowHp" | "eliteFlood";
  /** 数值参数 */
  value?: number;
  /** 颜色 */
  color: string;
  /** 该修饰符下分数倍率 */
  scoreMul: number;
}

/** 生存模式保护目标（v5 新增） */
export interface SurvivalTargetDef {
  /** 目标 id */
  id: string;
  /** 目标名称（如「反诈宣传点」「社区警务室」） */
  name: string;
  emoji: string;
  /** 最大 HP */
  maxHp: number;
  /** 目标位置 x（0..1 比例） */
  xRatio: number;
  /** 目标位置 y（0..1 比例） */
  yRatio: number;
  /** 半径 */
  radius: number;
  /** 反诈知识文案 */
  lore: string;
}

/** 生存模式保护目标状态（引擎内部） */
export interface SurvivalTargetState {
  def: SurvivalTargetDef;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** 受击高光剩余秒 */
  hitFlash: number;
}

/** 教学新手关定义（v5 新增） */
export interface TutorialStageDef {
  id: string;
  title: string;
  desc: string;
  /** 教学步骤 */
  steps: {
    text: string;
    emoji: string;
    /** 等待玩家完成的动作 */
    waitFor?: "move" | "shoot" | "dash" | "ult" | "powerup" | "continue";
  }[];
  /** 完成奖励 */
  rewardDesc: string;
}

/** v5 引擎事件：段位积分变化 */
export interface RankPointsChangeEvent {
  delta: number;
  newPoints: number;
  newTier: ThunderRankTier;
  tierUp: boolean;
  tierDown: boolean;
}

/** v5 引擎事件：任务进度更新 */
export interface QuestProgressEvent {
  questId: string;
  progress: number;
  target: number;
  completed: boolean;
}

// ===========================================================================
// ===== v6 升级类型定义：BOSS AI 对话 / 口诀连招 / 溯源档案 / 通行证 ========
// ===== / 格挡反击 / 组合弹幕 / 超觉醒 ======================================
// ===========================================================================

/** v6：BOSS AI 对话节点（S1） */
export interface ThunderBossAIDialogNode {
  /** 节点 ID */
  id: string;
  /** BOSS 台词（可多条，按权重随机选 1 条） */
  bossLines: string[];
  /** 话术标签（如"权威压迫"/"利益诱惑"/"案件保密"） */
  tactic?: string;
  /** 利用的心理手法 */
  psychology?: string[];
  /** 该节点的红旗等级 0-5 */
  redFlag: number;
  /** 玩家可选回复 */
  choices: ThunderBossAIDialogChoice[];
}

/** v6：BOSS AI 对话玩家选项（S1） */
export interface ThunderBossAIDialogChoice {
  /** 玩家回复文本 */
  text: string;
  /** 下一节点 ID（null=对话结束） */
  nextNodeId?: string | null;
  /** 该回复是否为识破（正确识破话术） */
  bust?: boolean;
  /** 识破分数（加到玩家分数） */
  bustScore?: number;
  /** 该回复的评价 */
  verdict?: "right" | "warn" | "wrong";
  /** 评价说明（揭示时展示） */
  feedback?: string;
  /** 选错时 BOSS 回血比例（0..1，仅 verdict=wrong 时生效） */
  bossHealRatio?: number;
}

/** v6：BOSS AI 对话剧本（S1，对应 data.ts 中 THUNDER_BOSS_AI_DIALOGS） */
export interface ThunderBossAIDialog {
  /** 剧本 ID（与 BossDef.aiDialogId 对应） */
  id: string;
  /** 关联 BOSS ID */
  bossId: string;
  /** 剧本标题 */
  title: string;
  /** 触发条件描述（如"BOSS HP < 20% 时触发最终话术"） */
  triggerDesc: string;
  /** 骗子人设描述 */
  persona: string;
  /** 最大轮次 */
  maxTurns: number;
  /** 通关阈值：识破红旗数 */
  passThreshold: number;
  /** 起始节点 ID */
  startNodeId: string;
  /** 节点列表 */
  nodes: ThunderBossAIDialogNode[];
  /** 通关口诀（识破成功后飘字） */
  passMantra?: string;
  /** 失败提示（识破失败时展示） */
  failTip?: string;
}

/** v6：BOSS AI 对话 HUD 状态（S1） */
export interface ThunderHudBossAIDialogState {
  /** 当前剧本 ID */
  dialogId: string;
  /** 当前剧本标题 */
  dialogTitle: string;
  /** 当前节点 ID */
  currentNodeId: string;
  /** 已发生对话轮次（含 BOSS 与玩家） */
  turns: Array<{ from: "boss" | "player" | "system"; text: string; tactic?: string; feedback?: string }>;
  /** 当前轮次 BOSS 台词（高亮） */
  currentBossLine: string;
  /** 当前节点红旗等级 */
  currentRedFlag: number;
  /** 当前话术标签 */
  currentTactic: string;
  /** 玩家累计识破红旗数 */
  bustScore: number;
  /** 通关阈值 */
  passThreshold: number;
  /** 已用轮次 */
  turnCount: number;
  /** 最大轮次 */
  maxTurns: number;
  /** 是否已结束 */
  ended: boolean;
  /** 结局类型 */
  ending?: "busted" | "scammed" | "timeout";
  /** 结局说明 */
  endingDesc?: string;
  /** 当前节点可选回复 */
  currentChoices: ThunderBossAIDialogChoice[];
  /** 揭示态：上次选择的反馈（null=未揭示） */
  lastFeedback?: string | null;
}

/** v6：反诈口诀连招定义（S2） */
export interface ThunderMantraChainDef {
  /** 连击阈值（达到此连击数触发） */
  comboThreshold: number;
  /** 口诀文本（4 字） */
  mantra: string;
  /** 口诀完整版（连击满 50 时拼成的完整口号） */
  fullMantra: string;
  /** 触发后奖励：分数倍率 */
  scoreMul: number;
  /** 触发后奖励：全屏伤害比例（0..1，对全屏敌方） */
  screenDamageRatio: number;
  /** 触发后奖励：持续秒数 */
  boostDuration: number;
  /** 口诀配色 */
  color: string;
  /** 口诀 emoji */
  emoji: string;
}

/** v6：反诈口诀连招 HUD 状态（S2） */
export interface ThunderHudMantraChainState {
  /** 当前连击数 */
  combo: number;
  /** 下一档口诀阈值 */
  nextThreshold: number;
  /** 下一档口诀文本 */
  nextMantra: string;
  /** 已解锁的口诀列表（按触发顺序） */
  unlockedMantras: string[];
  /** 当前激活的口诀（null=无激活） */
  activeMantra?: string | null;
  /** 当前激活口诀剩余秒数 */
  activeUntil?: number;
  /** 完整口诀是否已集齐（连击 ≥ 50） */
  fullMantraUnlocked: boolean;
  /** 完整口诀文本 */
  fullMantra: string;
}

/** v6：诈骗溯源档案（S3） */
export interface ThunderFraudArchive {
  /** 档案 ID（与 BossDef.archiveId 对应） */
  id: string;
  /** 关联 BOSS ID */
  bossId: string;
  /** 诈骗类型名 */
  fraudType: string;
  /** 案例标题 */
  title: string;
  /** 案例发生日期（YYYY-MM 或 YYYY-Qx） */
  date: string;
  /** 来源机构 */
  source: string;
  /** 案例链接（可选） */
  url?: string;
  /** 案例简述（1-2 句话） */
  caseStory: string;
  /** 关键启示（一句话） */
  takeaway: string;
  /** 详细识别要点（3-5 条） */
  identifyDetail: string[];
  /** 防护清单（玩家应采取的行动） */
  protectList: string[];
  /** 高发人群 */
  targetGroup?: string;
  /** 关联的全局图鉴 codexId（双向联动） */
  codexId?: string;
}

/** v6：赛季通行证档位奖励（S4） */
export interface ThunderSeasonPassTier {
  /** 等级（1-based） */
  level: number;
  /** 所需累计经验 */
  requiredExp: number;
  /** 免费轨道奖励 */
  freeReward?: ThunderSeasonPassReward;
  /** 精英轨道奖励 */
  eliteReward?: ThunderSeasonPassReward;
}

/** v6：赛季通行证奖励（S4） */
export interface ThunderSeasonPassReward {
  /** 奖励类型 */
  type: "talentPoint" | "skin" | "title" | "bossRushToken" | "goldCoin";
  /** 数量 */
  amount: number;
  /** 奖励 ID（如 skinId） */
  rewardId?: string;
  /** 奖励名称 */
  name: string;
  /** 奖励 emoji */
  emoji: string;
}

/** v6：赛季通行证定义（S4） */
export interface ThunderSeasonPassDef {
  /** 赛季 ID（与 ThunderSeason.id 对应） */
  seasonId: string;
  /** 通行证名称 */
  name: string;
  /** 总等级数 */
  maxLevel: number;
  /** 每局基础经验 */
  baseExpPerRun: number;
  /** 每击败 BOSS 额外经验 */
  expPerBoss: number;
  /** 每完美波次额外经验 */
  expPerPerfectWave: number;
  /** 档位列表 */
  tiers: ThunderSeasonPassTier[];
}

/** v6：赛季通行证存档（S4） */
export interface ThunderSeasonPassSave {
  /** 当前等级 */
  level: number;
  /** 当前经验 */
  exp: number;
  /** 是否购买精英通行证 */
  elite: boolean;
  /** 已领取的免费奖励等级列表 */
  claimedFreeTiers: number[];
  /** 已领取的精英奖励等级列表 */
  claimedEliteTiers: number[];
}

/** v6：赛季通行证 HUD 状态（S4） */
export interface ThunderHudSeasonPassState {
  /** 当前等级 */
  level: number;
  /** 当前经验 */
  exp: number;
  /** 当前等级所需经验 */
  expToNext: number;
  /** 进度比 0..1 */
  progress: number;
  /** 是否精英 */
  elite: boolean;
  /** 本局获得经验 */
  gainedExp: number;
}

/** v6：格挡反击状态（P1） */
export interface ThunderParryState {
  /** 是否正在格挡（按住中） */
  parrying: boolean;
  /** 格挡剩余冷却秒数（0=可用） */
  cooldown: number;
  /** 冷却总时长 */
  cooldownMax: number;
  /** 完美格挡窗口剩余秒数（>0 时格挡触发反弹） */
  perfectWindow: number;
  /** 完美格挡窗口总时长 */
  perfectWindowMax: number;
  /** 格挡成功反弹伤害倍率 */
  reflectMul: number;
  /** 是否触发了完美格挡（一次性，场景层消费） */
  perfectTriggered: boolean;
}

/** v6：武器超觉醒定义（P4，6-7 级） */
export interface ThunderSuperAwakeningDef {
  /** 武器分支 */
  branch: Exclude<WeaponBranch, "normal">;
  /** 等级（6 或 7） */
  level: 6 | 7;
  /** 超觉醒名称 */
  name: string;
  /** emoji */
  emoji: string;
  /** 描述 */
  desc: string;
  /** 超觉醒口诀（达成时飘字） */
  mantra: string;
  /** 觉醒条件描述（如"该分支累计击杀 500 敌人"） */
  unlockCondition: string;
  /** 超觉醒效果 */
  effect: {
    dmgMul: number;             // 伤害倍率
    extraProjectiles?: number;   // 额外弹幕数
    pierce?: number;            // 穿透数
    homing?: boolean;           // 追踪
    explode?: boolean;          // 爆炸
    explodeRadius?: number;     // 爆炸半径
    /** v6 新增：超觉醒专属大招 */
    ultimate?: {
      name: string;
      damage: number;
      radius: number;
      cooldown: number;
    };
  };
}

/** v6：武器超觉醒 HUD 状态（P4） */
export interface ThunderSuperAwakeningState {
  /** 当前超觉醒分支 */
  branch: WeaponBranch;
  /** 超觉醒等级（6 或 7） */
  level: 6 | 7;
  /** 超觉醒名称 */
  name: string;
  /** emoji */
  emoji: string;
  /** 超觉醒大招充能进度 0..1 */
  ultimateCharge: number;
  /** 大招是否就绪 */
  ultimateReady: boolean;
  /** 大招名称 */
  ultimateName: string;
}

/** v6 引擎事件：诈骗溯源档案解锁 */
export interface FraudArchiveUnlockEvent {
  archiveId: string;
  bossId: string;
  source: "thunder";
}

/** v6 引擎事件：赛季通行证等级提升 */
export interface SeasonPassLevelUpEvent {
  newLevel: number;
  unlockedRewards: ThunderSeasonPassReward[];
}

// ===========================================================================
// ===== v7 升级类型定义：剧情战役 / 课程章节 / 知识图谱 / RPG剧本 ============
// ===== / 程序化弹幕 / 自适应AI / 证书 / 数据仪表板 =========================
// ===========================================================================

// ============ v7-A：剧情战役模式（story mode） ============

/** v7 剧情关卡类型 */
export type ThunderStoryStageKind = "combat" | "boss" | "narrative" | "tutorial" | "branchChoice";

/** v7 剧情关卡定义（线性叙事 + 支线分支） */
export interface ThunderStoryStageDef {
  /** 关卡 ID（如 STORY-01） */
  id: string;
  /** 章节序号（1-based，用于显示"第 N 章"） */
  chapter: number;
  /** 关卡名（如"第一章：暗流涌动"） */
  name: string;
  /** 关卡类型 */
  kind: ThunderStoryStageKind;
  /** 剧情简介（关卡开始前展示） */
  intro: string;
  /** 剧情结尾文案（通关后展示） */
  outro: string;
  /** 关卡主题 */
  theme: ThunderTheme;
  /** 关卡难度（覆盖全局难度，用于剧情平衡） */
  difficulty: Difficulty;
  /** 关卡敌人波次配置（combat/boss 类型） */
  waves?: WaveEntry[][];
  /** 关卡 BOSS ID（boss 类型） */
  bossId?: string;
  /** 关卡推荐角色 */
  recommendedCharacterId?: CharacterId;
  /** 通关所需最低分数 */
  passScore: number;
  /** 通关所需最低波次 */
  passWave: number;
  /** S 级评价所需分数 */
  rankSScore: number;
  /** A 级评价所需分数 */
  rankAScore: number;
  /** B 级评价所需分数 */
  rankBScore: number;
  /** 主题色 */
  themeColor: string;
  /** 关卡图标 emoji */
  icon: string;
  /** 教育向知识点（通关后解锁） */
  learningPoints: string[];
  /** 是否为支线关卡 */
  isBranch?: boolean;
  /** 解锁条件描述（支线关卡显示） */
  unlockCondition?: string;
  /** 通关后解锁的支线关卡 ID 列表 */
  unlocksStages?: string[];
  /** 是否为结局关卡（通关后展示结局） */
  isEnding?: boolean;
  /** 结局 ID（isEnding=true 时有效） */
  endingId?: string;
}

/** v7 剧情结局类型 */
export type ThunderStoryEndingType = "true" | "good" | "normal" | "bad" | "hidden";

/** v7 剧情结局定义 */
export interface ThunderStoryEndingDef {
  /** 结局 ID */
  id: string;
  /** 结局类型 */
  type: ThunderStoryEndingType;
  /** 结局标题（如"真相结局：雷霆扫穴"） */
  title: string;
  /** 结局描述（通关后展示） */
  desc: string;
  /** 结局寄语（教育向） */
  lesson: string;
  /** 结局图标 emoji */
  icon: string;
  /** 结局主题色 */
  color: string;
  /** 解锁条件描述 */
  unlockCondition: string;
}

/** v7 剧情战役 HUD 状态 */
export interface ThunderHudStoryState {
  /** 当前关卡 ID */
  stageId: string;
  /** 当前章节序号 */
  chapter: number;
  /** 当前关卡名 */
  stageName: string;
  /** 关卡类型 */
  stageKind: ThunderStoryStageKind;
  /** 剧情简介（开始时展示） */
  intro: string;
  /** 是否在剧情对白阶段（narrative 类型关卡） */
  narrativeActive: boolean;
  /** 当前对白索引（narrative 关卡用） */
  narrativeLineIdx?: number;
  /** 总对白数 */
  narrativeTotalLines?: number;
  /** 当前对白文本 */
  currentNarrativeText?: string;
  /** 当前对白发言方 */
  currentNarrativeSpeaker?: string;
  /** 通关所需最低分数 */
  passScore: number;
  /** S/A/B 级评分线 */
  rankSScore: number;
  rankAScore: number;
  rankBScore: number;
  /** 本关推荐角色 */
  recommendedCharacter?: string;
  /** 是否已通关本关 */
  stageCleared: boolean;
  /** 本关评价（通关时填入） */
  rank?: "S" | "A" | "B" | "C";
}

/** v7 剧情战役配置 */
export interface ThunderStoryCampaign {
  /** 战役 ID */
  id: string;
  /** 战役名（如"雷霆行动：跨境追击"） */
  name: string;
  /** 战役简介 */
  desc: string;
  /** 关卡列表（按章节顺序） */
  stages: ThunderStoryStageDef[];
  /** 结局列表 */
  endings: ThunderStoryEndingDef[];
}

// ============ v7-B：课程章节系统（lesson mode） ============

/** v7 课程章节小节类型 */
export type ThunderLessonSectionKind =
  | "reading"   // 阅读材料
  | "video"     // 视频教学（占位，描述为主）
  | "caseStudy" // 案例分析
  | "quiz"      // 章节测验
  | "practice"; // 实战练习（链接到游戏模式）

/** v7 课程小节定义 */
export interface ThunderLessonSectionDef {
  /** 小节 ID */
  id: string;
  /** 小节标题 */
  title: string;
  /** 小节类型 */
  kind: ThunderLessonSectionKind;
  /** 小节内容（阅读文本/案例描述） */
  content: string;
  /** 关键要点（3-5 条） */
  keyPoints: string[];
  /** 关联诈骗类型 ID */
  fraudTypeId?: string;
  /** 关联图鉴 codexId（双向联动） */
  codexId?: string;
  /** 关联知识图谱节点 ID */
  knowledgeNodeId?: string;
  /** 实战练习模式（practice 类型） */
  practiceMode?: ThunderMode;
  /** 实战练习关卡 ID（practice 类型） */
  practiceStageId?: string;
  /** 章节测验题目（quiz 类型） */
  quizQuestions?: ThunderLessonQuizQuestion[];
  /** 预计学习时长（分钟） */
  durationMin: number;
}

/** v7 课程测验题目 */
export interface ThunderLessonQuizQuestion {
  /** 题目 ID */
  id: string;
  /** 题干 */
  question: string;
  /** 选项 */
  options: string[];
  /** 正确选项索引 */
  answer: number;
  /** 解析 */
  explain: string;
  /** 关联知识图谱节点 */
  knowledgeNodeId?: string;
}

/** v7 课程章节定义 */
export interface ThunderLessonChapterDef {
  /** 章节 ID */
  id: string;
  /** 章节序号 */
  chapter: number;
  /** 章节标题（如"第一章：识破冒充公检法"） */
  title: string;
  /** 章节简介 */
  intro: string;
  /** 章节难度 */
  level: "basic" | "intermediate" | "advanced";
  /** 关联诈骗类型 ID */
  fraudTypeId: string;
  /** 关联 BOSS ID（章节末尾实战） */
  relatedBossId?: string;
  /** 章节小节列表 */
  sections: ThunderLessonSectionDef[];
  /** 通关所需掌握度（0..1） */
  passMastery: number;
  /** 章节主题色 */
  themeColor: string;
  /** 章节图标 */
  icon: string;
  /** 解锁条件：前置章节 ID */
  prerequisiteChapterId?: string;
  /** 通关奖励：天赋点 */
  rewardTalentPoints: number;
  /** 通关奖励：证书 ID（首次通关） */
  rewardCertificateId?: string;
}

/** v7 课程模式 HUD 状态 */
export interface ThunderHudLessonState {
  /** 当前章节 ID */
  chapterId: string;
  /** 当前章节标题 */
  chapterTitle: string;
  /** 当前小节 ID */
  sectionId: string;
  /** 当前小节标题 */
  sectionTitle: string;
  /** 当前小节类型 */
  sectionKind: ThunderLessonSectionKind;
  /** 当前小节内容 */
  sectionContent: string;
  /** 关键要点 */
  keyPoints: string[];
  /** 是否在测验中（quiz 类型） */
  inQuiz: boolean;
  /** 当前测验题目索引 */
  quizQuestionIdx?: number;
  /** 测验总题数 */
  quizTotal?: number;
  /** 当前测验题目 */
  currentQuiz?: ThunderLessonQuizQuestion;
  /** 测验已答对数 */
  quizCorrect?: number;
  /** 章节进度（0..1） */
  chapterProgress: number;
  /** 章节是否已通关 */
  chapterCleared: boolean;
}

// ============ v7-C：知识图谱（knowledge graph） ============

/** v7 知识图谱节点分类 */
export type ThunderKnowledgeCategory =
  | "recognition"  // 识别能力
  | "psychology"   // 心理防御
  | "procedure"    // 应对流程
  | "law"          // 法律法规
  | "tool";        // 反诈工具

/** v7 知识图谱节点 */
export interface ThunderKnowledgeNodeDef {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点分类 */
  category: ThunderKnowledgeCategory;
  /** 关联诈骗类型 ID */
  fraudTypeId?: string;
  /** 节点描述（知识点说明） */
  desc: string;
  /** 关联图鉴 codexId */
  codexId?: string;
  /** 关联课程小节 ID（点击节点跳转学习） */
  lessonSectionId?: string;
  /** 节点坐标 X（0..1，用于图谱布局） */
  x: number;
  /** 节点坐标 Y（0..1） */
  y: number;
  /** 解锁条件：前置节点 ID 列表 */
  prerequisiteNodeIds?: string[];
  /** 节点图标 */
  icon: string;
  /** 节点主题色 */
  color: string;
}

/** v7 知识图谱连线 */
export interface ThunderKnowledgeEdgeDef {
  /** 起点节点 ID */
  from: string;
  /** 终点节点 ID */
  to: string;
  /** 连线类型 */
  type: "prerequisite" | "related" | "counter";
  /** 连线标签 */
  label?: string;
}

/** v7 知识图谱节点状态（玩家掌握度） */
export interface ThunderKnowledgeNodeState {
  /** 节点 ID */
  nodeId: string;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 掌握度 0..1 */
  mastery: number;
  /** 正确数 */
  correct: number;
  /** 总数 */
  total: number;
}

/** v7 知识图谱 */
export interface ThunderKnowledgeGraph {
  /** 节点列表 */
  nodes: ThunderKnowledgeNodeDef[];
  /** 连线列表 */
  edges: ThunderKnowledgeEdgeDef[];
  /** 全局掌握度 0..1 */
  overallMastery: number;
  /** 已解锁节点数 */
  unlockedCount: number;
  /** 总节点数 */
  totalCount: number;
}

// ============ v7-D：第一人称 RPG 剧本（rpg mode） ============

/** v7 RPG 剧本节点类型 */
export type ThunderRPGNodeKind =
  | "narrative"   // 旁白叙述
  | "dialogue"    // 对话选择
  | "decision"    // 关键决策
  | "examine"     // 检查证据
  | "ending";     // 结局

/** v7 RPG 剧本节点 */
export interface ThunderRPGNodeDef {
  /** 节点 ID */
  id: string;
  /** 节点类型 */
  kind: ThunderRPGNodeKind;
  /** 场景描述 */
  scene: string;
  /** 发言方（dialogue 类型） */
  speaker?: string;
  /** 对白/旁白文本 */
  text: string;
  /** 玩家可选选项（dialogue/decision 类型） */
  choices?: ThunderRPGChoiceDef[];
  /** 心理手法标签（教育向） */
  psychology?: string[];
  /** 红旗等级 0-5 */
  redFlag?: number;
  /** 拆解说明（揭示态展示） */
  deconstruct?: string;
  /** 是否为结局节点 */
  isEnding?: boolean;
  /** 结局 ID（isEnding=true 时有效） */
  endingId?: string;
}

/** v7 RPG 选项定义 */
export interface ThunderRPGChoiceDef {
  /** 选项文本 */
  text: string;
  /** 下一节点 ID（null=进入结局） */
  nextNodeId?: string | null;
  /** 是否为识破选项 */
  bust?: boolean;
  /** 识破得分 */
  bustScore?: number;
  /** 评价 */
  verdict?: "right" | "warn" | "wrong";
  /** 评价说明 */
  feedback?: string;
  /** 心理手法标签 */
  psychology?: string[];
}

/** v7 RPG 结局定义 */
export interface ThunderRPGEndingDef {
  /** 结局 ID */
  id: string;
  /** 结局类型 */
  type: "perfect" | "good" | "normal" | "bad" | "secret";
  /** 结局标题 */
  title: string;
  /** 结局描述 */
  desc: string;
  /** 教育向寄语 */
  lesson: string;
  /** 结局图标 */
  icon: string;
  /** 结局主题色 */
  color: string;
}

/** v7 RPG 剧本定义 */
export interface ThunderRPGScenarioDef {
  /** 剧本 ID */
  id: string;
  /** 关联诈骗类型 ID */
  fraudTypeId: string;
  /** 诈骗类型名 */
  fraudType: string;
  /** 剧本标题 */
  title: string;
  /** 难度 1-4 */
  difficulty: number;
  /** 场景简介 */
  scenario: string;
  /** 玩家身份（第一人称视角） */
  playerRole: string;
  /** 剧本标签 */
  tags?: string[];
  /** 节点列表 */
  nodes: ThunderRPGNodeDef[];
  /** 起始节点 ID */
  startNodeId: string;
  /** 结局列表 */
  endings: ThunderRPGEndingDef[];
  /** 通关阈值：识破红旗数 */
  passThreshold: number;
  /** 推荐学习课程章节 ID */
  relatedLessonId?: string;
  /** 通关奖励：天赋点 */
  rewardTalentPoints: number;
}

/** v7 RPG 模式 HUD 状态 */
export interface ThunderHudRPGState {
  /** 当前剧本 ID */
  scenarioId: string;
  /** 当前剧本标题 */
  scenarioTitle: string;
  /** 当前节点 ID */
  currentNodeId: string;
  /** 当前节点类型 */
  nodeKind: ThunderRPGNodeKind;
  /** 当前场景描述 */
  currentScene: string;
  /** 当前发言方 */
  currentSpeaker?: string;
  /** 当前对白文本 */
  currentText: string;
  /** 当前选项列表 */
  currentChoices: ThunderRPGChoiceDef[];
  /** 已发生对话历史 */
  history: Array<{ speaker?: string; text: string; isPlayer: boolean; verdict?: string }>;
  /** 累计识破红旗数 */
  bustScore: number;
  /** 通关阈值 */
  passThreshold: number;
  /** 是否已揭示拆解说明 */
  deconstructRevealed: boolean;
  /** 当前拆解说明 */
  currentDeconstruct?: string;
  /** 是否已结束 */
  ended: boolean;
  /** 结局 ID */
  endingId?: string;
  /** 结局数据 */
  ending?: ThunderRPGEndingDef;
  /** 上次选择反馈 */
  lastFeedback?: string;
}

// ============ v7-E：程序化 BOSS 弹幕生成 ============

/** v7 程序化弹幕模式参数 */
export interface ThunderProceduralPatternParams {
  /** 模式 ID（用于 HUD 显示） */
  id: string;
  /** 模式名称 */
  name: string;
  /** 弹幕基础类型 */
  basePattern: BossAttackPattern;
  /** 子弹数量 */
  bulletCount: number;
  /** 子弹速度 */
  bulletSpeed: number;
  /** 发射间隔（秒） */
  fireInterval: number;
  /** 扇形角度（spread 类型，弧度） */
  spreadAngle?: number;
  /** 螺旋圈数（spiral 类型） */
  spiralTurns?: number;
  /** 螺旋方向（1=顺时针, -1=逆时针） */
  spiralDir?: number;
  /** 半径范围（ring 类型） */
  ringRadius?: number;
  /** 是否追踪玩家 */
  homing?: boolean;
  /** 追踪强度 */
  homingStrength?: number;
  /** 颜色 */
  color: string;
  /** 难度系数 0..1（影响伤害/速度） */
  difficultyFactor: number;
}

/** v7 程序化弹幕生成配置 */
export interface ThunderProceduralConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 全局种子 */
  seed: number;
  /** BOSS HP 阈值触发（< 此比例时启用更复杂模式） */
  hpThreshold: number;
  /** 最大同时叠加模式数 */
  maxCombined: number;
  /** 难度系数（来自自适应 AI 或全局难度） */
  difficultyFactor: number;
}

// ============ v7-F：自适应难度 AI ============

/** v7 玩家行为画像 */
export interface ThunderPlayerProfile {
  /** 画像版本号 */
  version: number;
  /** 综合技能评分 0..100 */
  skillScore: number;
  /** 反应速度评分 0..100（基于擦弹/格挡数据） */
  reflexScore: number;
  /** 决策准确度 0..100（基于答对率/识破率） */
  decisionScore: number;
  /** 资源管理 0..100（道具/大招使用效率） */
  resourceScore: number;
  /** 持久力 0..100（基于长局表现衰减） */
  enduranceScore: number;
  /** 最近 10 局表现 */
  recentRuns: Array<{
    mode: ThunderMode;
    score: number;
    win: boolean;
    skillDelta: number;
    at: string;
  }>;
  /** 弱点诈骗类型 ID（正确率最低） */
  weakestFraudTypeId?: string;
  /** 弱点诈骗类型正确率 */
  weakestFraudTypeRate?: number;
  /** 强项诈骗类型 ID */
  strongestFraudTypeId?: string;
  /** 推荐训练模式 */
  recommendedMode?: ThunderMode;
  /** 推荐训练关卡 ID */
  recommendedStageId?: string;
}

/** v7 自适应难度状态 */
export interface ThunderAdaptiveState {
  /** 当前技能评分 */
  skillScore: number;
  /** 当前动态难度倍率 */
  difficultyMul: number;
  /** 敌人血量倍率 */
  enemyHpMul: number;
  /** 敌人速度倍率 */
  enemySpeedMul: number;
  /** 敌人攻击频率倍率 */
  enemyFireMul: number;
  /** 道具掉落倍率 */
  dropMul: number;
  /** BOSS 血量倍率 */
  bossHpMul: number;
  /** 上一局表现趋势（"improving"/"stable"/"declining"） */
  trend: "improving" | "stable" | "declining";
  /** 上一局技能评分变化 */
  lastDelta: number;
}

/** v7 自适应 AI 配置 */
export interface ThunderAdaptiveConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 评分范围 */
  minSkillScore: number;
  maxSkillScore: number;
  /** 难度倍率范围 */
  minDifficultyMul: number;
  maxDifficultyMul: number;
  /** 单局评分变化上限（防止剧烈波动） */
  maxDeltaPerRun: number;
  /** 趋势分析窗口（局数） */
  trendWindow: number;
}

// ============ v7-G：反诈能力认证证书 ============

/** v7 证书类型 */
export type ThunderCertificateType =
  | "storyMaster"      // 剧情通关大师
  | "lessonGraduate"   // 课程毕业
  | "rpgExpert"        // RPG 剧本专家
  | "knowledgeSage"    // 知识图谱大师
  | "bossSlayer"       // BOSS 击败者
  | "perfectStreak"    // 完美连胜
  | "scholar"          // 反诈学者（综合）
  | "guardian";        // 反诈守护者（最高荣誉）

/** v7 证书难度等级 */
export type ThunderCertificateLevel = "bronze" | "silver" | "gold" | "platinum" | "diamond";

/** v7 证书定义 */
export interface ThunderCertificateDef {
  /** 证书 ID */
  id: string;
  /** 证书类型 */
  type: ThunderCertificateType;
  /** 证书名称（如"反诈学者·金"） */
  name: string;
  /** 证书图标 emoji */
  icon: string;
  /** 证书主题色 */
  color: string;
  /** 证书难度等级 */
  level: ThunderCertificateLevel;
  /** 证书简短描述 */
  desc: string;
  /** 颁发条件说明（玩家可见） */
  condition: string;
  /** 证书价值主张（颁发时展示的祝贺语） */
  citation: string;
  /** 目标进度值 */
  target: number;
  /** 关联模式（如果证书绑定特定模式） */
  relatedMode?: ThunderMode;
  /** 关联章节/关卡 ID（如果证书绑定特定内容） */
  relatedId?: string;
}

/** v7 证书进度 */
export interface ThunderCertificateProgress {
  /** 证书 ID */
  certId: string;
  /** 当前进度值 */
  current: number;
  /** 目标值 */
  target: number;
  /** 进度比 0..1 */
  ratio: number;
  /** 是否已完成 */
  completed: boolean;
  /** 是否已颁发 */
  issued: boolean;
  /** 进度描述（如"3/5 章节通关"） */
  label: string;
}

// ============ v7-H：数据仪表板 ============

/** v7 能力雷达图维度 */
export type ThunderAbilityDimension =
  | "recognition"  // 识别能力
  | "defense"      // 防御能力
  | "reflex"       // 反应速度
  | "knowledge"    // 知识广度
  | "decision"     // 决策能力
  | "endurance";   // 持久力

/** v7 能力雷达图 */
export interface ThunderAbilityRadar {
  /** 各维度得分 0..100 */
  dimensions: Record<ThunderAbilityDimension, number>;
  /** 综合评分 0..100 */
  overall: number;
  /** 评级（S/A/B/C/D） */
  grade: "S" | "A" | "B" | "C" | "D";
  /** 评级描述 */
  gradeDesc: string;
}

/** v7 弱点报告 */
export interface ThunderWeaknessReport {
  /** 最弱诈骗类型 ID */
  weakestFraudTypeId?: string;
  /** 最弱诈骗类型名 */
  weakestFraudTypeName?: string;
  /** 最弱类型正确率 0..1 */
  weakestFraudTypeRate?: number;
  /** 最弱能力维度 */
  weakestDimension?: ThunderAbilityDimension;
  /** 最弱维度得分 */
  weakestDimensionScore?: number;
  /** 推荐训练模式 */
  recommendedMode?: ThunderMode;
  /** 推荐训练关卡 ID */
  recommendedStageId?: string;
  /** 推荐学习章节 ID */
  recommendedLessonId?: string;
  /** 报告生成日期 */
  reportDate: string;
  /** 严重度描述（"高发"/"中发"/"低发"） */
  severityLabel: string;
}

/** v7 数据仪表板 */
export interface ThunderAnalyticsDashboard {
  /** 能力雷达图 */
  abilityRadar: ThunderAbilityRadar;
  /** 弱点报告 */
  weaknessReport: ThunderWeaknessReport;
  /** 玩家行为画像 */
  playerProfile: ThunderPlayerProfile;
  /** 累计统计 */
  totals: {
    /** 累计游戏时长（秒） */
    totalPlayTime: number;
    /** 累计击败 BOSS 数 */
    totalBossKills: number;
    /** 累计识破数 */
    totalBusted: number;
    /** 累计擦弹数 */
    totalGraze: number;
    /** 累计格挡数 */
    totalParry: number;
    /** 累计完成 RPG 剧本数 */
    totalRPGCleared: number;
    /** 累计完成课程章节数 */
    totalLessonsCleared: number;
  };
  /** 各诈骗类型击杀分布 */
  fraudKillsByType: Record<string, number>;
  /** 各模式胜率 */
  winRateByMode: Record<string, { wins: number; total: number; rate: number }>;
  /** 最近 30 天活跃日期 */
  recentActiveDates: string[];
}

// ============ v7 引擎事件 ============

/** v7 引擎事件：剧情关卡通关 */
export interface StoryStageClearedEvent {
  stageId: string;
  rank: "S" | "A" | "B" | "C";
  endingUnlocked?: string;
}

/** v7 引擎事件：RPG 剧本结局 */
export interface RPGEndingEvent {
  scenarioId: string;
  endingId: string;
  bustScore: number;
}

/** v7 引擎事件：证书解锁 */
export interface CertificateUnlockEvent {
  certId: string;
  certName: string;
  certLevel: ThunderCertificateLevel;
}

/** v7 引擎事件：知识图谱节点解锁 */
export interface KnowledgeNodeUnlockEvent {
  nodeId: string;
  nodeName: string;
}
