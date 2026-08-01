/**
 * 诈园区（bomb-island）类型定义
 * v6 全面升级：5 模式（无尽/剧情/每日/极速/硬核）+ 5 档园区 + 武器升级树 + 道具升星 + 案例档案/受害者档案/知识图谱
 */

// ============ v6 游戏模式 ============

/**
 * 游戏模式：
 * - endless：纯无尽（v5 默认，3 档循环）
 * - story：剧情战役（5-8 关线性剧本，每关固定 Boss+通关条件）
 * - daily：每日挑战（每日固定 seed + 特殊规则）
 * - speedrun：极速模式（3 分钟限时，按摧毁率+剩余时间评分）
 * - hardcore：硬核模式（Boss 一击放大招即终局，反诈炮只剩 1 滴民心）
 */
export type BombGameMode = "endless" | "story" | "daily" | "speedrun" | "hardcore";

/** 难度模式（v6 难度选择） */
export type BombDifficulty = "easy" | "normal" | "hard" | "hell";

/** 反诈行动评级（v6 结算页 F→SSS） */
export type BombTierRating = "F" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS";

export type ItemId =
  | "bomb"
  | "missile"
  | "fireRain"
  | "incendiary"
  | "drone"
  | "laser"
  | "meteor"
  | "arrowRain"
  | "swords"
  // ===== v6 新增道具 =====
  | "signalJam"  // 信号屏蔽：短期禁 Boss 反击
  | "airStrike"; // 空袭支援：直升机扫射

/** 道具效果类型，决定命中/持续逻辑 */
export type ItemEffect =
  | "blast" // 园区中心瞬时大爆破
  | "homing" // 制导打击
  | "fireRain" // 持续火雨 DoT
  | "burnZone" // 持续燃烧区 DoT
  | "drone" // 无人机扫射 DoT
  | "laser" // 即时横扫光束
  | "meteor" // 延时多陨石
  | "arrowRain" // 延时多段箭雨
  | "swords" // 终极汇聚爆破
  // ===== v6 新增效果 =====
  | "signalJam" // 信号屏蔽：短期禁 Boss 反击
  | "airStrike"; // 空袭支援：直升机持续扫射

export interface ItemDef {
  id: ItemId;
  name: string;
  emoji: string;
  color: string;
  desc: string;
  cd: number; // 冷却秒数
  overdrive: number; // 使用给予的过载值
  effect: ItemEffect;
  /** 瞬时类：绝对伤害（封顶 100/次） */
  damageAbs?: number;
  /** 持续类：绝对每秒伤害（封顶 100/秒） */
  dpsAbs?: number;
  /** 持续类时长（秒） */
  duration?: number;
}

/** 园区视觉/数值档位（随波次升档） */
export interface ParkTierDef {
  tier: number;
  name: string;
  subtitle: string;
  hpMul: number;
  repairMul: number;
  color: string;
  /** v6 扩展到 5 档：den=妙瓦底 / kokang=缅北 / hq=总部 / dubai=迪拜 / wafrica=西非
   *  v9 新增第 6 档：abyss=暗网深渊（元宇宙/AI 工厂主题） */
  structure: "den" | "kokang" | "hq" | "dubai" | "wafrica" | "abyss";
  /** 波次开场简报：该园区对应的诈骗类型与识别要点 */
  briefing: {
    scamType: string;
    points: string[];
  };
  // ===== v11 升级新增字段（可选，严格兼容） =====
  /** B1 产业链定位（结算页展示园区在诈骗产业链中的环节） */
  industryChain?: IndustryChainDef;
  /** B4 暗网深渊子档位（仅 structure="abyss" 时有效，区分 AI 工厂/虚拟身份/Deepfake 实验室） */
  abyssSubStructure?: AbyssSubStructure;
}

/** BOSS 反击干扰类型：不伤害炮兵，改为 debuff 玩家 */
export type CounterDebuff =
  | "cdLock"        // 道具 CD 暂时锁定（不刷新）
  | "weaponJam"     // 武器射速暂时降低
  | "itemDisable"   // 随机道具暂时失效
  | "visionJam"     // 屏幕干扰（视觉污染）
  // ===== v6 新增 debuff =====
  | "overdriveDrain" // 过载槽倒扣
  | "comboBreak";    // 连击重置

// ============ Boss 多阶段系统（v5 升级：3 阶段 + 召唤小怪） ============

/**
 * Boss 阶段定义：每个 Boss 拥有 3 个阶段，按 HP 阈值切换。
 * 切换时附带短暂视觉/逻辑变化，强化战斗节奏。
 */
export interface BossPhaseDef {
  /** 阶段序号 0/1/2 */
  phase: 0 | 1 | 2;
  /** 进入该阶段的 HP 占比阈值（≤该值时切换；阶段 0 始终为 1.0） */
  hpPct: number;
  /** 该阶段的反击模式（覆盖 BossDef 顶层 pattern） */
  pattern: "droneSwarm" | "artilleryBarrage" | "commsJamming" | "missileSalvo";
  /** 反击间隔（秒，越小越频繁） */
  counterInterval: number;
  /** 每次反击发射弹数 */
  counterShots: number;
  /** 反击 debuff 持续秒数 */
  counterDebuffDur: number;
  /** 阶段名称（如：阶段一·试探 / 阶段二·狂暴 / 阶段三·殊死） */
  phaseName: string;
  /** 阶段切换时的提示文本 */
  phaseTransitionText: string;
  /** 该阶段内反击频率倍率（≥1，阶段越高越快） */
  enrageMul: number;
}

// ============ 召唤小怪系统（v5） ============

/** 小怪种类：电诈园区内被派出来袭扰炮兵的低阶犯罪分子。
 * - fraud-minion 电诈马仔：普通移动，靠近炮兵施加 weaponJam
 * - card-farmer  洗钱卡农：移速较快，靠近炮兵施加 cdLock
 * - cyber-hacker 黑客学徒：远程发射反击弹，施加 visionJam
 * v6 新增：
 * - live-streamer 假主播：远程直播干扰，施加 comboBreak
 * - coin-broker  币圈中介：快速突进，施加 overdriveDrain
 */
export type MinionKind = "fraud-minion" | "card-farmer" | "cyber-hacker" | "live-streamer" | "coin-broker";

/** 召唤配置：Boss 阶段切换时触发 */
export interface SummonDef {
  /** 进入哪个阶段时召唤（1 = 阶段二开始时） */
  triggerPhase: 1 | 2;
  /** 一次召唤的数量 */
  count: number;
  /** 小怪种类 */
  kind: MinionKind;
  /** 单个小怪 HP（绝对值） */
  hpEach: number;
  /** 移动速度（像素/秒） */
  speed: number;
  /** 接近炮兵后的 debuff 持续时间 */
  debuffDur: number;
  /** 击杀奖励分数 */
  rewardScore: number;
  /** 击杀给予的过载充能 */
  rewardOverdrive: number;
  /** 召唤时是否提示 */
  announceText: string;
}

/** 小怪运行时实体 */
export interface Minion {
  id: number;
  kind: MinionKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  /** 0=向左移动中；1=已抵达炮兵区域自爆 */
  state: 0 | 1;
  /** 受击闪烁计时 */
  hitFlash: number;
  /** 攻击冷却（cyber-hacker 远程发射用） */
  attackCd: number;
  /** 已施加 debuff 标记（避免每帧重复施加） */
  debuffed: boolean;
  /** 出生动画进度 0→1 */
  spawnAnim: number;
}

// ============ 受害者救援系统（v5） ============

/**
 * 被解救的受害者：拆除 cage/cell/dorm 模块时释放，向左奔逃至画布外即救援成功。
 */
export interface Victim {
  id: number;
  x: number;
  y: number;
  /** 速度（像素/秒） */
  speed: number;
  /** 0=奔跑中；1=已安全逃脱 */
  state: 0 | 1;
  /** 奔跑动画相位（用于腿部摆动） */
  anim: number;
  /** 救援来源模块类型 */
  fromType: ModuleType;
}

// ============ Boss 专属反击技能（v4 升级：每档园区独有） ============

/**
 * Boss 专属技能类型：每档园区对应一种独特反击，强化反诈叙事
 * - cageTrap  妙瓦底·铁笼困人：模拟限制人身自由，触发 cdLock + 屏幕铁栏视觉
 * - shockJam  缅北·电击干扰：模拟暴力胁迫，触发 weaponJam + visionJam + 电流纹视觉
 * - deepfake  总部·AI换脸：模拟深度伪造，触发 itemDisable + visionJam + 色相偏移视觉
 * v6 新增：
 * - moneyLaunder 迪拜·白手套洗钱：模拟资金外流，触发 overdriveDrain + 金流粒子视觉
 * - ponziTrap    西非·庞氏收割：模拟崩盘抽底，触发 comboBreak + 红色崩盘视觉
 */
export type SpecialSkillKind = "cageTrap" | "shockJam" | "deepfake" | "moneyLaunder" | "ponziTrap";

/** Boss 专属技能定义 */
export interface BossSpecialSkill {
  /** 技能类型 */
  kind: SpecialSkillKind;
  /** 技能名称 */
  name: string;
  /** 技能描述（含反诈叙事） */
  desc: string;
  /** 触发 HP 阈值（0.5 = 园区总 HP 降到 50% 时首次触发） */
  triggerAtHpPct: number;
  /** 冷却时间（秒，首次触发后再次触发的间隔） */
  cooldown: number;
  /** 持续时间（秒） */
  duration: number;
  /** 视觉主色 */
  color: string;
  /** 触发的 debuff 列表（叠加到现有 debuff 系统） */
  debuffs: CounterDebuff[];
}

/** BOSS 反击弹（飞向玩家区域，触发 debuff） */
export interface CounterShell {
  x: number; y: number; vx: number; vy: number; life: number;
  /** 触发的 debuff 类型 */
  debuff: CounterDebuff;
  /** debuff 持续秒数 */
  duration: number;
  color: string; kind: "drone" | "shell" | "missile" | "jam";
  trail: { x: number; y: number }[];
}

/** 电诈 BOSS 身份：每个档位/波次的建筑本身就是 BOSS */
export interface BombBossDef {
  /** BOSS 名称（如：果敢四大家族·白家） */
  bossName: string;
  /** 反诈标识身份描述 */
  identity: string;
  /** emoji 形象 */
  emoji: string;
  /** 反击模式 */
  pattern: "droneSwarm" | "artilleryBarrage" | "commsJamming" | "missileSalvo";
  /** 反击间隔（秒） */
  counterInterval: number;
  /** 每次反击发射弹数 */
  counterShots: number;
  /** 反击 debuff 持续秒数（命中药兵区域后触发） */
  counterDebuffDur: number;
  /** BOSS 技能描述 */
  skillName: string;
  skillDesc: string;
  /** BOSS 阶段切换血线（0.5 表示 50% 切换） */
  enrageAt: number;
  /** 狂暴后反击频率倍率 */
  enrageMul: number;
  /** Boss 击破科普：真实反诈案例卡片，清波时展示 */
  caseStudy: {
    title: string;
    body: string;
    hotline: string;
    points: string[];
  };
  /** v4 升级：Boss 专属反击技能（每档园区独有，强化反诈叙事） */
  specialSkill: BossSpecialSkill;
  /** v5 升级：3 阶段定义（若提供则引擎按阶段切换 pattern/频率；否则回退到顶层字段） */
  phases?: BossPhaseDef[];
  /** v5 升级：召唤小怪配置（进入指定阶段时触发） */
  summon?: SummonDef;
  // ===== v11 升级新增字段（可选，严格兼容） =====
  /** A1 审判庭定义（Boss 击败后触发，关联 bossId） */
  trialId?: string;
  /** A2 QTE 配置（Boss 阶段切换/濒死时触发；缺省则该 Boss 无 QTE） */
  qte?: QTEDef;
}

export interface ItemState {
  id: ItemId;
  cdLeft: number; // 剩余冷却秒数，0 = 可用
  cd: number; // 总冷却
}

export type ParkPhase = "fight" | "clearing" | "lost";

/** 天气系统：4 种天气，每 2 波切换一次（v6 扩展到 6 种） */
export type WeatherKind = "sunny" | "storm" | "thunder" | "fog" | "sandstorm" | "aurora";

/** 天气定义 */
export interface WeatherDef {
  id: WeatherKind;
  name: string;
  emoji: string;
  desc: string;
  color: string;
  /** 炮兵射速倍率 */
  fireRateMul: number;
  /** 园区修复倍率 */
  repairMul: number;
  /** BOSS 反击频率倍率 */
  counterMul: number;
  /** 炮弹伤害倍率 */
  shellDmgMul: number;
  /** 道具 CD 倍率 */
  cdMul: number;
  /** 逃脱槽增速倍率 */
  escapeMul: number;
}

// ============ 武器系统 ============

/** 武器类型：标准弹 / 集束弹 / 电磁弹 / 燃烧弹（v6 扩展：激光炮 / 导弹雨） */
export type WeaponKind = "standard" | "cluster" | "emp" | "incendiary" | "laserCannon" | "missileRain";

/** 模块类型：决定特殊渲染与拆除时飘字的知识点
 * v6 新增：liveRoom 直播间 / casino 赌博机房 / darkweb 暗网服务器 / minefarm 虚拟币矿场
 * v9 新增：aiFactory AI 换脸工厂 / idForge 虚拟身份车间
 */
export type ModuleType =
  | "antenna" | "floor" | "server" | "dorm" | "fortress" | "wall"
  | "foundation" | "shock" | "cage" | "cell" | "guard"
  // ===== v6 新增模块 =====
  | "liveRoom"   // 直播间：虚假直播带货
  | "casino"     // 赌博机房：网络赌博后台
  | "darkweb"    // 暗网服务器：数据黑市
  | "minefarm"   // 虚拟币矿场：洗钱矿场
  // ===== v9 新增模块（暗网深渊档位专属） =====
  | "aiFactory"  // AI 换脸工厂：Deepfake 伪造
  | "idForge";  // 虚拟身份车间：批量伪造身份

/** 武器定义 */
export interface WeaponDef {
  id: WeaponKind;
  name: string;
  emoji: string;
  color: string;
  desc: string;
  /** 初始弹药（-1 = 无限） */
  maxAmmo: number;
}

/** 武器状态（HUD 用） */
export interface WeaponState {
  id: WeaponKind;
  name: string;
  emoji: string;
  color: string;
  /** 剩余弹药（-1 = 无限） */
  ammo: number;
  maxAmmo: number;
}

// ============ 公园地图系统 ============

/** 树木（障碍物 / 护盾） */
export interface TreeDef {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** 受击摇晃动画计时（>0 时摇晃） */
  shake: number;
}

/** 地图布局类型 */
export type MapLayoutKind = "central" | "avenue" | "checker";

/** 地图布局定义 */
export interface MapLayoutDef {
  id: MapLayoutKind;
  name: string;
  emoji: string;
  /** 树木初始坐标列表 */
  trees: { x: number; y: number }[];
}

export interface ParkHud {
  wave: number;
  tierName: string;
  tierSubtitle: string;
  /** BOSS 身份信息 */
  bossName: string;
  bossIdentity: string;
  bossEmoji: string;
  bossSkillName: string;
  bossEnraged: boolean;
  hp: number;
  maxHp: number;
  hpPct: number;
  /** 逃脱进度已移除（纯无尽模式），字段保留为 0 以向后兼容 */
  escape: number;
  overdrive: number; // 0..100
  overdriveActive: boolean;
  combo: number;
  score: number;
  items: ItemState[];
  phase: ParkPhase;
  /** 炮兵（玩家）生命已移除：纯无尽模式，炮兵不可被伤害。字段保留为满值向后兼容 */
  cannonHp: number;
  cannonMaxHp: number;
  /** 当前武器等级 */
  weaponLevel: number;
  /** 反击预警剩余秒（>0 表示即将反击） */
  counterWarn: number;
  /** 天气系统：当前天气 */
  weather: WeatherKind;
  weatherName: string;
  weatherEmoji: string;
  weatherDesc: string;
  weatherColor: string;
  // ---- 以下为新增可选字段（向后兼容） ----
  /** 当前武器 */
  weapon?: WeaponKind;
  weaponName?: string;
  weaponEmoji?: string;
  weaponColor?: string;
  /** 当前武器剩余弹药（-1 = 无限） */
  weaponAmmo?: number;
  /** 全部武器状态列表 */
  weapons?: WeaponState[];
  /** 公园地图系统 */
  mapId?: MapLayoutKind;
  mapName?: string;
  mapEmoji?: string;
  /** 地图切换进度（0..1，>0 表示正在切换） */
  mapTransition?: number;
  /** EMP 减速剩余秒数（>0 表示敌人被减速） */
  empSlow?: number;
  // ---- 升级新增字段 ----
  /** 本波累计伤害 */
  waveDamage?: number;
  /** 全局累计伤害 */
  totalDamage?: number;
  /** 实时 DPS（每秒伤害） */
  dps?: number;
  /** 最高 DPS 峰值 */
  maxDps?: number;
  /** 最高连击纪录 */
  maxCombo?: number;
  /** 已击破波数（成功拆除的园区数） */
  clearedWaves?: number;
  /** 园区破坏阶段（0=完好 1=75% 2=50% 3=25%） */
  destructionStage?: 0 | 1 | 2 | 3;
  // ---- v3 废墟重建系统 ----
  /** 当前正在重建的废墟模块数（0=无重建进行中） */
  repairingCount?: number;
  /** 已拆废墟总数（含未开始重建的） */
  rubbleCount?: number;
  /** 园区重建整体进度（0=无废墟/全部重建完成，1=全部废墟待重建） */
  rebuildActivity?: number;
  /** 最快重建中模块的进度（0..1，用于 HUD 进度条） */
  topRepairProgress?: number;
  /** CD 锁定剩余秒（>0 道具 CD 不刷新） */
  cdLockRemain?: number;
  /** 武器干扰剩余秒（>0 武器射速降低） */
  weaponJamRemain?: number;
  /** 道具失效剩余秒（>0 随机道具不可用） */
  itemDisableRemain?: number;
  /** 视觉干扰剩余秒（>0 屏幕扭曲） */
  visionJamRemain?: number;
  /** 当前失效的道具 id（itemDisable 期间） */
  disabledItemId?: ItemId | null;
  // ---- v4 升级：Boss 专属反击技能 ----
  /** 当前生效的专属技能类型（null = 无技能生效） */
  specialSkillKind?: SpecialSkillKind | null;
  /** 当前生效的专属技能名称 */
  specialSkillName?: string;
  /** 当前生效的专属技能视觉主色 */
  specialSkillColor?: string;
  /** 专属技能剩余秒数（>0 表示生效中） */
  specialSkillRemain?: number;
  /** 专属技能总持续时间（用于进度条） */
  specialSkillTotal?: number;
  /** 本局已拆除的模块数（按类型计数） */
  moduleKillCount?: number;
  /** 本局已拆除的模块类型统计（key=ModuleType, value=count） */
  moduleKillStats?: Partial<Record<ModuleType, number>>;
  // ---- v5 升级：Boss 多阶段 / 召唤小怪 / 受害者救援 / 过载大招 ----
  /** 当前 Boss 阶段序号（0/1/2） */
  bossPhase?: 0 | 1 | 2;
  /** Boss 总阶段数（恒为 3，用于 HUD 阶段指示器） */
  bossPhaseMax?: number;
  /** 当前阶段名称（如：阶段二·狂暴） */
  bossPhaseName?: string;
  /** 阶段切换动画剩余秒（>0 显示阶段切换横幅） */
  bossPhaseTransition?: number;
  /** 当前活动小怪数量（>0 时玩家需优先清除） */
  minionsActive?: number;
  /** 本局已击杀小怪总数 */
  minionsKilled?: number;
  /** 本局已救援受害者总数 */
  victimsRescued?: number;
  /** 当前正在奔逃的受害者数量 */
  victimsActive?: number;
  /** 过载槽是否就绪可主动释放（true = 显示大招按钮） */
  overdriveReady?: boolean;
  /** 过载大招剩余可用秒数（双模式：主动释放窗口，超过则自动转 buff） */
  overdriveManualWindow?: number;
  /** 本局累计图鉴解锁数量（用于结算页展示） */
  codexUnlockedCount?: number;
  /** 本局新解锁的图鉴条目 ID 列表（用于结算页弹卡片） */
  codexUnlockedIds?: string[];
  /** Boss 入场 letterbox 特写剩余秒（>0 时场景层渲染全屏黑边 + Boss 大头特写） */
  bossIntroRemain?: number;
  /** Boss 击败慢镜头 letterbox 剩余秒（>0 时场景层渲染全屏黑边 + 击败特写） */
  bossDefeatRemain?: number;
  // ---- v6 升级新增字段 ----
  /** 当前游戏模式（v6） */
  gameMode?: BombGameMode;
  /** 当前难度（v6） */
  difficulty?: BombDifficulty;
  /** 剧情模式：当前关卡索引（0-based） */
  storyStageIdx?: number;
  /** 剧情模式：当前关卡名称 */
  storyStageName?: string;
  /** 剧情模式：当前关卡波次数 */
  storyStageTotal?: number;
  /** 剧情模式：当前关卡已通关波次 */
  storyStageCleared?: number;
  /** 极速模式：剩余秒数 */
  speedrunRemain?: number;
  /** 极速模式：总时长 */
  speedrunTotal?: number;
  /** 硬核模式：民心值（1 滴，归零终局） */
  hardcoreMorale?: number;
  /** 每日挑战：日期 key（YYYY-MM-DD） */
  dailyKey?: string;
  /** 每日挑战：特殊规则名 */
  dailyRule?: string;
  /** 模式专属提示文案 */
  modeHint?: string | null;
  /** v6 道具升星：道具星级 1-5（key=ItemId） */
  itemStars?: Partial<Record<ItemId, number>>;
  /** v6 武器升级树：已解锁分支（key=WeaponKind, value=分支ID） */
  weaponBranch?: Partial<Record<WeaponKind, string>>;
  /** v6 Boss 击败案例弹窗剩余秒（>0 显示案例档案） */
  caseArchiveRemain?: number;
  /** v6 当前待展示的案例档案（Boss 击败时注入） */
  pendingCaseArchive?: BombCaseArchive | null;
  /** v6 受害者档案匹配提示剩余秒 */
  victimProfileHintRemain?: number;
  /** v6 当前匹配到的受害者档案名（救援数达阈值时触发） */
  matchedVictimProfile?: string | null;
  /** v6 反诈行动评级（结算时计算） */
  tierRating?: BombTierRating;
  /** v6 5 档园区当前档位名（妙瓦底/缅北/总部/迪拜/西非） */
  tierNameV6?: string;
  /** v6 过载槽倒扣剩余秒（overdriveDrain debuff） */
  overdriveDrainRemain?: number;
  /** v6 连击重置剩余秒（comboBreak debuff） */
  comboBreakRemain?: number;
  // ===== v9 全面升级新增字段 =====
  /** S1 多炮位部署：3 个炮位运行时状态 */
  cannonSlots?: CannonSlot[];
  /** S1 当前选中操控的炮位 ID（玩家点击切换） */
  activeCannonId?: CannonSlotId;
  /** S2 园区分层：4 层运行时状态 */
  parkLayers?: ParkLayerState[];
  /** S2 当前炮位自动瞄准的层（最近未拆层） */
  aimLayer?: ParkLayerKind | null;
  /** S3 RTS 升级面板：当前波次间隙阶段 */
  waveGapPhase?: WaveGapPhase;
  /** S3 当前线索碎片数（拆除模块/拆层奖励获得） */
  clueFragments?: number;
  /** S3 本局已选 RTS 升级状态 */
  rtsUpgrades?: RTSUpgradeState;
  /** S3 RTS 面板待选节点（波次间隙随机抽取 3 个） */
  rtsOfferings?: RTSUpgradeId[];
  /** T1 当前生效的知识弹幕（拆模块时触发，>0 显示） */
  knowledgeTipRemain?: number;
  /** T1 知识弹幕文本 */
  knowledgeTipText?: string;
  /** T2 本局案例时间线（结算注入） */
  caseTimeline?: BombCaseTimelineEntry[];
  /** E3 本局新击败的 Boss 图鉴 ID 列表（结算弹卡片） */
  bossCodexUnlockedIds?: string[];
  /** G1 本局每日任务实时进度快照（结算注入） */
  dailyTaskSnapshot?: Array<{ id: string; name: string; icon: string; progress: number; target: number; claimed: boolean }>;
  /** v9 当前活动季节事件 ID（若参与） */
  seasonalEventId?: string;
  // ===== v10 全面升级新增字段 =====
  /** B1 连携充能槽状态（3炮位同层聚焦充能，满后释放组合大招） */
  synergy?: CannonSynergyState | null;
  /** B2 波次间隙动态事件状态（诈骗反扑/受害者求救/线人情报/假主播） */
  dynamicEvent?: DynamicEventState | null;
  /** C1 波次间隙知识问答状态（答对充能过载槽） */
  waveGapQuiz?: WaveGapQuizState | null;
  /** D2 跨局永久成长树快照（结算页展示） */
  permanentUpgrades?: PermanentUpgradeState | null;
  /** v10 本局连携大招释放次数 */
  synergyUsed?: number;
  /** v10 本局动态事件完成数 */
  dynamicEventCleared?: number;
  /** v10 本局知识问答答对数 */
  quizCorrect?: number;
  // ===== v11 升级新增字段（可选，严格兼容） =====
  /** A1 Boss 审判庭状态（Boss 击败后触发；null=未在审判中） */
  trial?: BossTrialState | null;
  /** A2 QTE 状态（阶段切换/濒死时触发；null=未在 QTE 中） */
  qte?: QTEState | null;
  /** A3 契约状态（波次间隙展示；null=未在契约面板） */
  pact?: PactState | null;
  /** A4 当前剧情结局路径（normal/hidden/true；story 模式有效） */
  storyEndingPath?: BombStoryEndingType;
  /** A4 当前剧情分支节点（触发分支时注入） */
  storyBranchNode?: BombStoryBranchNode | null;
  /** A4 当前剧情结局（通关时注入） */
  storyEnding?: { type: BombStoryEndingType; name: string; desc: string; themeColor: string } | null;
  /** B1 当前园区产业链定位（结算页展示） */
  industryChain?: IndustryChainDef | null;
  /** B4 暗网深渊子档位（仅 abyss 档位有效） */
  abyssSubStructure?: AbyssSubStructure;
  /** C1 模块崩塌动画列表（场景层渲染用，仅记录正在崩塌的模块） */
  demolitionAnims?: Array<{ moduleId: string; state: DemolitionAnimState }>;
  /** D1 受害者归家故事卡（结算页展示；本局救援数达阈值时触发） */
  victimStory?: VictimStoryCard | null;
  /** D2 防骗力雷达（结算页展示） */
  abilityRadar?: AbilityRadar | null;
  /** D3 骗子视角复盘剧本（结算页"查看复盘"按钮入口） */
  debrief?: DebriefScenario | null;
  /** E1 战报二维码挑战数据（结算页展示） */
  battleReportQR?: BattleReportQR | null;
  /** E2 成就炫耀卡（解锁成就时弹卡） */
  achievementShowcase?: AchievementShowcaseCard | null;
  /** B2 反诈热点案例（Boss 击败后展示最新真实案例） */
  hotspotCase?: HotspotCase | null;
  /** v11 本局审判庭完美次数 */
  trialPerfectCount?: number;
  /** v11 本局 QTE 成功次数 */
  qteSuccessCount?: number;
  /** v11 本局签订契约数 */
  pactsSigned?: number;
}

// ============ v6 新增类型 ============

/** v6 真实案例档案（Boss 击败后展示，复用 fraudBuster FBCaseArchive 结构） */
export interface BombCaseArchive {
  /** 案例标题 */
  title: string;
  /** 发布日期 */
  date: string;
  /** 来源机构/账号 */
  source: string;
  /** 案例链接（可选） */
  url?: string;
  /** 关键启示 */
  takeaway: string;
  /** 详细描述 */
  body: string;
  /** 关联反诈热线 */
  hotline: string;
  /** 防骗要点 */
  points: string[];
  /** 关联园区档位 structure */
  tierStructure: ParkTierDef["structure"];
}

/** v6 受害者档案（救援后展示，复用 fraudBuster FBVictimProfile 结构） */
export interface BombVictimProfile {
  /** 档案类型ID */
  typeId: string;
  /** 档案名称（如"贪婪型受害者"） */
  name: string;
  /** 档案描述 */
  desc: string;
  /** 主要心理弱点（关联反诈心理手法） */
  weakness: string[];
  /** 易受骗场景 */
  vulnerableScenes: string[];
  /** 防护建议 */
  advice: string[];
  /** 档案色调 */
  color: string;
  /** 严重度 0..1（救援数越多越高） */
  severity: number;
  /** 解锁所需救援数 */
  unlockAtRescued: number;
}

/** v6 知识图谱节点（结算页交互式展示，替换简单统计） */
export interface BombKnowledgeNode {
  /** 知识点ID（关联模块类型） */
  id: string;
  /** 节点名称 */
  name: string;
  /** 诈骗大类（节点分组着色） */
  category: string;
  /** 正确数（拆除数） */
  correct: number;
  /** 总数（遭遇数） */
  total: number;
  /** 掌握度 0..1 */
  mastery: number;
  /** 节点相对坐标 0..1 */
  x: number;
  y: number;
  /** 关联节点ID列表 */
  links: string[];
}

/** v6 知识图谱 */
export interface BombKnowledgeGraph {
  nodes: BombKnowledgeNode[];
  /** 全局掌握度 0..1 */
  overallMastery: number;
}

/** v6 剧情模式关卡定义 */
export interface BombStoryStage {
  /** 关卡索引（0-based） */
  idx: number;
  /** 关卡 ID */
  id: string;
  /** 关卡名（如"第一关：湄公河行动"） */
  name: string;
  /** 关卡剧情简介 */
  intro: string;
  /** 关卡结束语（通关后展示） */
  outro: string;
  /** 关卡使用园区档位 */
  tierStructure: ParkTierDef["structure"];
  /** 关卡 Boss ID（在 TIER_BOSSES 中索引） */
  bossIdx: number;
  /** 通关所需波次数 */
  passWaves: number;
  /** 通关所需最低拆除率（0..1） */
  passDestroyRate: number;
  /** 关卡特殊规则（可选，如"禁用燃烧弹"） */
  rule?: string;
  /** 关卡主题色 */
  themeColor: string;
  /** 关卡图标 */
  icon: string;
  /** 关联案例档案 ID（通关后展示） */
  caseArchiveId?: string;
  // ===== v11 升级新增字段（可选，严格兼容；A4 多结局剧情） =====
  /** 该关卡是否为分支触发点（true 时引擎暂停并展示 BombStoryBranchNode） */
  isBranchTrigger?: boolean;
  /** 关联分支节点 ID（在 BombStoryMultiEnding.branchNodes 中查找） */
  branchNodeId?: string;
  /** 该关卡在哪种结局路径下出现（缺省=所有路径都出现） */
  endingPath?: BombStoryEndingType[];
}

/** v6 武器升级分支：每个武器 3 个分支可选其一 */
export interface WeaponUpgradeBranch {
  /** 分支 ID */
  id: string;
  /** 分支名（如"散弹强化"） */
  name: string;
  /** 分支描述 */
  desc: string;
  /** 分支效果：射速倍率 */
  fireRateMul: number;
  /** 分支效果：伤害倍率 */
  damageMul: number;
  /** 分支效果：多管加成 */
  multishotBonus: number;
  /** 分支效果：特殊属性（穿透/爆炸/燃烧等） */
  special?: "pierce" | "explode" | "burn" | "chain" | "homing";
  /** 解锁所需累计击破模块数 */
  unlockCost: number;
}

/** v6 武器升级树：每个武器 3 分支 */
export interface WeaponUpgradeTree {
  weapon: WeaponKind;
  /** 3 个分支，玩家只能选其一 */
  branches: WeaponUpgradeBranch[];
}

/** v6 道具升星配置：1-5 星 */
export interface ItemStarDef {
  /** 道具 ID */
  id: ItemId;
  /** 各星级配置（index 0 = 1星） */
  levels: Array<{
    star: number;
    /** 该星级 CD 倍率（<1 = CD 更短） */
    cdMul: number;
    /** 该星级伤害倍率（>1 = 伤害更高） */
    damageMul: number;
    /** 该星级效果时长倍率（>1 = 时长更长） */
    durationMul: number;
    /** 升级到该星所需碎片数 */
    fragmentsNeeded: number;
    /** 该星星级名 */
    name: string;
  }>;
}

/** v6 每日挑战规则 */
export interface BombDailyRule {
  /** 规则 ID */
  id: string;
  /** 规则名（如"武器禁用：燃烧弹"） */
  name: string;
  /** 规则描述 */
  desc: string;
  /** 禁用的武器（可选） */
  disabledWeapons?: WeaponKind[];
  /** 禁用的道具（可选） */
  disabledItems?: ItemId[];
  /** Boss 血量倍率 */
  bossHpMul: number;
  /** 起始波次 */
  startWave: number;
  /** 最大波次 */
  maxWave: number;
  /** 奖励倍率 */
  rewardMul: number;
}

/** v6 战报分享卡数据（Canvas 生成 PNG） */
export interface BombBattleReportCard {
  /** 玩家段位评级 */
  rating: BombTierRating;
  /** 评级颜色 */
  ratingColor: string;
  /** 本局得分 */
  score: number;
  /** 本局波次 */
  wave: number;
  /** 本局拆除模块数 */
  modulesDestroyed: number;
  /** 本局救援受害者数 */
  victimsRescued: number;
  /** 最高 DPS */
  maxDps: number;
  /** 最高连击 */
  maxCombo: number;
  /** 游戏模式 */
  gameMode: BombGameMode;
  /** 模式中文名 */
  modeLabel: string;
  /** 难度 */
  difficulty: BombDifficulty;
  /** 难度中文名 */
  difficultyLabel: string;
  /** 完美一局标记（无失误） */
  perfectRun: boolean;
  /** 日期 */
  date: string;
  /** 玩家铭言 */
  motto: string;
}

/** v6 难度配置 */
export interface BombDifficultyDef {
  id: BombDifficulty;
  name: string;
  /** Boss 血量倍率 */
  bossHpMul: number;
  /** 园区修复倍率 */
  repairMul: number;
  /** Boss 反击频率倍率（<1 = 更频繁） */
  counterIntervalMul: number;
  /** 小怪数量倍率 */
  minionCountMul: number;
  /** 道具 CD 倍率 */
  itemCdMul: number;
  /** 得分倍率 */
  scoreMul: number;
  /** 颜色 */
  color: string;
  /** 描述 */
  desc: string;
}

/** v6 游戏模式配置 */
export interface BombModeDef {
  id: BombGameMode;
  name: string;
  /** 模式描述 */
  desc: string;
  /** 模式提示 */
  hint: string;
  /** 模式图标 */
  icon: string;
  /** 模式主题色 */
  color: string;
  /** 是否需要选择难度 */
  needDifficulty: boolean;
  /** 模式最大波次（-1 = 无尽） */
  maxWave: number;
}

// ============================================================
// ============ v9 全面升级类型 ============
// ============================================================

// ============ S2：园区分层系统 ============

/** 园区分层：外墙 → 内墙 → 核心 → 金库，逐层击破解锁奖励 */
export type ParkLayerKind = "outer" | "inner" | "core" | "vault";

/** 分层定义：将模块按层分组，聚合 HP，给奖励 */
export interface ParkLayerDef {
  kind: ParkLayerKind;
  name: string;
  emoji: string;
  /** 该层包含的模块类型（用于聚合 HP/拆解统计） */
  moduleTypes: ModuleType[];
  /** 拆除该层完整奖励的线索碎片数（S3 RTS 用） */
  clueFragments: number;
  /** 拆除该层弹出的反诈知识弹幕（T1） */
  knowledgeTip: string;
  /** 层视觉主色 */
  color: string;
  /** HUD 中该层的纵向显示顺序（0=最外/最上，3=最内/最下） */
  order: number;
}

/** 分层运行时状态（HUD 用） */
export interface ParkLayerState {
  kind: ParkLayerKind;
  name: string;
  emoji: string;
  color: string;
  hp: number;
  maxHp: number;
  /** 该层是否已全拆（解锁奖励） */
  cleared: boolean;
  /** 该层拆除进度 0..1 */
  destroyPct: number;
  order: number;
}

// ============ S1：多炮位部署系统 ============

/** 炮位 ID：左 / 中 / 右 */
export type CannonSlotId = "left" | "center" | "right";

/** 单炮位运行时状态 */
export interface CannonSlot {
  id: CannonSlotId;
  name: string;
  emoji: string;
  /** 炮位 X 坐标 */
  x: number;
  /** 炮位 Y 坐标 */
  y: number;
  /** 该炮位当前武器 */
  weapon: WeaponKind;
  /** 该炮位武器剩余弹药（-1 = 无限） */
  ammo: number;
  /** 该炮位武器等级 */
  level: number;
  /** 是否激活（玩家可关闭以集中火力到其他炮位） */
  active: boolean;
  /** 优先瞄准的层（null = 自动瞄最近未拆层） */
  preferLayer: ParkLayerKind | null;
  /** 炮口闪光截止时间（this.t + duration） */
  muzzleUntil: number;
  /** 后坐力动画值 */
  recoil: number;
  /** 发射计时累积（达到 fireInterval 触发） */
  fireAcc: number;
}

// ============ S3：战中 RTS 升级面板 ============

/** RTS 升级节点 ID */
export type RTSUpgradeId =
  | "fireRate"        // 射速 +
  | "damage"          // 伤害 +
  | "multishot"       // 多管 +
  | "pierce"          // 穿透
  | "crit"            // 暴击
  | "chain"           // 连锁
  | "overdriveGain"   // 过载获取 +
  | "cdReduction"     // 道具 CD -
  | "fragmentBonus"   // 线索碎片掉落 +
  | "cannonUnlock";   // 解锁新炮位

/** RTS 升级节点定义 */
export interface RTSUpgradeNode {
  id: RTSUpgradeId;
  name: string;
  desc: string;
  icon: string;
  /** 每级花费线索碎片 */
  costPerLevel: number;
  /** 最大等级 */
  maxLevel: number;
  /** 每级效果参数 */
  params: {
    fireRateMul?: number;     // 每级射速倍率（<1 = 更快）
    damageMul?: number;       // 每级伤害倍率（>1）
    multishotBonus?: number;  // 每级额外多管数
    critChance?: number;       // 每级暴击率（0..1）
    overdriveMul?: number;    // 每级过载获取倍率
    cdMul?: number;            // 每级道具 CD 倍率（<1）
    fragmentMul?: number;     // 每级碎片掉落倍率
  };
  /** 升级分支提示（如"解锁右炮位"） */
  unlockHint?: string;
}

/** 玩家在 RTS 面板已选择的升级（key=RTSUpgradeId, value=等级） */
export type RTSUpgradeState = Partial<Record<RTSUpgradeId, number>>;

/** 波次间隙面板状态
 * v10 扩展：RTS面板 / 简报 / 动态事件 / 知识问答 交替出现
 * v11 扩展：Boss 审判庭 / 契约面板 / 剧情分支 */
export type WaveGapPhase = "none" | "rtsPanel" | "briefing" | "dynamicEvent" | "quiz" | "trial" | "pactPanel" | "storyBranch";

// ============ E3：Boss 图鉴收藏 ============

/** Boss 图鉴条目（击败后入图鉴） */
export interface BombBossCodexEntry {
  /** Boss 标识（与 TIER_BOSSES 索引关联） */
  bossId: string;
  /** Boss 名称 */
  bossName: string;
  /** 反诈身份描述 */
  identity: string;
  /** emoji 形象 */
  emoji: string;
  /** 所属园区档位 */
  tierStructure: ParkTierDef["structure"];
  /** 诈骗类型 */
  scamType: string;
  /** 真实原型档案（教育属性） */
  realPrototype: string;
  /** 击败奖励说明 */
  defeatReward: string;
  /** 专属技能名 */
  skillName: string;
  /** 是否已被击败（图鉴解锁） */
  defeated?: boolean;
}

// ============ G1：每日任务系统 ============

/** 每日任务触发类型 */
export type BombTaskType =
  | "destroyModules"   // 拆除 N 个模块
  | "destroyType"      // 拆除指定类型模块 N 个
  | "rescueVictims"    // 救援 N 名受害者
  | "combo"            // 达成 N 连击
  | "perfectWave"      // 单波完美（不丢血）
  | "clearBoss"        // 击败 N 个 Boss
  | "useItem"          // 使用 N 次道具
  | "clearMode";       // 通关指定模式

/** 每日任务定义 */
export interface BombDailyTask {
  id: string;
  name: string;
  desc: string;
  icon: string;
  type: BombTaskType;
  target: number;
  params?: { moduleType?: ModuleType; mode?: BombGameMode };
  rewardScore: number;
  rewardFragments: number;
}

/** 每日任务进度（存档） */
export interface BombDailyTaskProgress {
  taskId: string;
  progress: number;
  claimed: boolean;
}

// ============ G2：本地排行榜 ============

/** 本地排行榜条目（含 NPC 占位） */
export interface BombLocalRankEntry {
  rank: number;
  name: string;
  isPlayer: boolean;
  score: number;
  rating: BombTierRating;
  gameMode: BombGameMode;
  date: string;
  perfect: boolean;
}

// ============ G3：96110 热线模拟 ============

/** 96110 热线剧本节点 */
export interface BombHotlineNode {
  id: string;
  /** 接线员台词 */
  operator: string;
  choices: BombHotlineChoice[];
}

/** 96110 通话选项 */
export interface BombHotlineChoice {
  text: string;
  next?: string | null;
  verdict?: "right" | "warn" | "wrong";
  feedback?: string;
  ending?: "verified" | "scam" | "uncertain";
}

/** 96110 热线剧本 */
export interface BombHotlineScript {
  id: string;
  title: string;
  scenario: string;
  tierStructure: ParkTierDef["structure"];
  startNodeId: string;
  nodes: BombHotlineNode[];
  takeaways: string[];
}

// ============ G4：反诈工具箱 ============

export type BombToolType = "selfCheck" | "report" | "emergency" | "hotline" | "verify";

/** 反诈工具箱条目 */
export interface BombToolItem {
  id: string;
  name: string;
  icon: string;
  type: BombToolType;
  desc: string;
  steps: string[];
  contact?: string;
  applicableScenes: string[];
}

// ============ E4：季节性活动关卡 ============

/** 季节标识（月份驱动） */
export type BombSeason = "springFestival" | "schoolOpen" | "double11" | "summerJob" | "yearEnd" | "all";

/** 季节性活动关卡 */
export interface BombSeasonalEvent {
  id: string;
  name: string;
  icon: string;
  season: BombSeason;
  /** 开放月份（1-12） */
  activeMonths: number[];
  intro: string;
  outro: string;
  tierStructure: ParkTierDef["structure"];
  passWaves: number;
  passDestroyRate: number;
  themeColor: string;
  rewardExp: number;
  rewardAchievementId?: string;
}

// ============ T2：案例时间线 ============

/** 案例时间线条目（结算页展示本局遭遇的真实案例时间轴） */
export interface BombCaseTimelineEntry {
  /** 局内时间戳（秒） */
  atSec: number;
  /** 案例标题 */
  title: string;
  /** 简述 */
  desc: string;
  /** 关联案例档案 ID */
  caseArchiveId?: string;
  /** 关联园区档位 */
  tierStructure?: ParkTierDef["structure"];
}

// ============================================================
// ============ v10 全面升级类型 ============
// ============================================================

// ============ B1：炮位连携系统 ============

/** 连携大招类型：3炮位同层聚焦时触发不同组合技 */
export type SynergySkillKind =
  | "tripleBarrage"  // 三炮齐射：对当前层瞬时高额伤害
  | "layerBreak"     // 破甲穿层：无视层防御直击下一层
  | "crossfire";     // 交叉火力：持续扫射全园 3 秒

/** 连携充能槽运行时状态 */
export interface CannonSynergyState {
  /** 充能值 0..100 */
  energy: number;
  /** 是否就绪可释放（energy≥100） */
  ready: boolean;
  /** 当前可释放的大招类型（由当前瞄准层决定） */
  availableSkill: SynergySkillKind;
  /** 上次释放的大招类型（结算统计用） */
  lastSkill?: SynergySkillKind;
  /** 大招生效剩余秒数（>0 表示大招持续中） */
  activeRemain: number;
  /** 大招总持续秒数（用于进度条） */
  activeTotal: number;
  /** 上次同层聚焦时间戳（用于判定充能速率） */
  lastFocusTs: number;
}

// ============ B2：波次间隙动态事件 ============

/** 动态事件类型 */
export type DynamicEventKind =
  | "counterattack"  // 诈骗反扑：Boss 临时加强反击，玩家选应对策略
  | "victimRescue"   // 受害者求救：选择救援方式，成功奖励碎片
  | "informant"      // 线人情报：选择是否信任，影响下波难度
  | "fakeStream";    // 假主播干扰：选择反制方式，影响道具CD

/** 动态事件选项 */
export interface DynamicEventChoice {
  /** 选项文本 */
  text: string;
  /** 结果描述 */
  result: string;
  /** 奖励线索碎片数（可为负=惩罚） */
  fragmentReward: number;
  /** 奖励过载充能 */
  overdriveReward?: number;
  /** 下波 Boss 血量倍率修正（1=不变，>1=加强，<1=削弱） */
  nextWaveHpMul?: number;
  /** 下波小怪数量修正 */
  nextWaveMinionBonus?: number;
  /** 是否为最优选择 */
  optimal?: boolean;
}

/** 动态事件定义 */
export interface DynamicEventDef {
  /** 事件 ID */
  id: string;
  /** 事件类型 */
  kind: DynamicEventKind;
  /** 事件标题 */
  title: string;
  /** 事件场景描述 */
  scenario: string;
  /** emoji 图标 */
  icon: string;
  /** 主题色 */
  color: string;
  /** 关联诈骗知识点（教育属性） */
  knowledgePoint: string;
  /** 选项列表（2-3 个） */
  choices: DynamicEventChoice[];
}

/** 动态事件运行时状态（HUD 用） */
export interface DynamicEventState {
  /** 当前事件定义 */
  event: DynamicEventDef;
  /** 玩家所选选项索引（null=未选） */
  selectedIdx: number | null;
  /** 结果文本（选择后注入） */
  resultText: string;
  /** 是否已解决 */
  resolved: boolean;
}

// ============ C1：波次间隙知识问答 ============

/** 波次间隙知识问答状态 */
export interface WaveGapQuizState {
  /** 题目文本 */
  question: string;
  /** 选项列表 */
  options: string[];
  /** 正确选项索引 */
  correctIdx: number;
  /** 解析说明 */
  explain: string;
  /** 关联诈骗知识点 */
  knowledgePoint: string;
  /** 玩家所选（null=未选） */
  selectedIdx: number | null;
  /** 是否已作答 */
  answered: boolean;
  /** 答对奖励过载充能 */
  rewardOverdrive: number;
  /** 答对奖励线索碎片 */
  rewardFragments: number;
}

// ============ D2：跨局永久成长树 ============

/** 永久升级节点 ID */
export type PermanentUpgradeId =
  | "pFireRate"       // 永久射速 +
  | "pDamage"         // 永久伤害 +
  | "pOverdriveGain"  // 永久过载获取 +
  | "pSynergyGain"    // 永久连携充能 +
  | "pFragmentBonus"  // 永久碎片掉落 +
  | "pStartCannon"    // 开局解锁炮位
  | "pStartWeapon"    // 开局武器强化
  | "pRevive";        // 每局 1 次复活

/** 永久升级节点定义 */
export interface PermanentUpgradeNode {
  id: PermanentUpgradeId;
  name: string;
  desc: string;
  icon: string;
  /** 每级所需碎片（递增） */
  costs: number[];
  /** 最大等级 */
  maxLevel: number;
  /** 每级效果参数 */
  params: {
    fireRateMul?: number;
    damageMul?: number;
    overdriveMul?: number;
    synergyMul?: number;
    fragmentMul?: number;
  };
}

/** 永久升级状态（key=PermanentUpgradeId, value=等级） */
export type PermanentUpgradeState = Partial<Record<PermanentUpgradeId, number>>;

// ============================================================
// ============ v11 全面升级类型（严格向后兼容） ============
// ============================================================
// 设计原则：
// - 所有新字段在接口中以可选 `?` 追加，旧存档/旧调用方无感知
// - 新枚举值以联合类型扩展，不修改原值
// - 引擎层读取时统一做 `?? default` 兜底
// ============================================================

// ============ A1：Boss 审判庭系统 ============

/** 审判题选项 */
export interface BossTrialOption {
  /** 选项文本（如"诈骗罪（刑法第266条）"） */
  text: string;
  /** 是否为正确选项 */
  correct: boolean;
  /** 选项解析（为何对/错） */
  explain: string;
  /** 选项对应的法律条文引用（可选） */
  statute?: string;
}

/** 单道审判题（Boss 击败后触发） */
export interface BossTrialQuestion {
  /** 题目 ID */
  id: string;
  /** 题干（如"该 Boss 主要触犯哪项罪名？"） */
  question: string;
  /** 4 选 1 选项 */
  options: BossTrialOption[];
  /** 关联知识点 */
  knowledgePoint: string;
}

/** Boss 审判庭定义（每个 Boss 一组审判题） */
export interface BossTrialDef {
  /** 关联 Boss ID（与 TIER_BOSSES 索引对应） */
  bossId: string;
  /** 审判庭主题色 */
  themeColor: string;
  /** 检察院指控摘要 */
  indictment: string;
  /** 审判题列表（2-3 道，连续答对完成审判） */
  questions: BossTrialQuestion[];
  /** 正确审判后的宣判词 */
  verdict: string;
  /** 错误审判后的提示（教育属性） */
  mistrialHint: string;
  /** 全部答对奖励线索碎片 */
  rewardFragments: number;
  /** 全部答对奖励过载充能（下波生效） */
  rewardOverdrive: number;
}

/** 审判庭运行时状态（HUD 用） */
export interface BossTrialState {
  /** 当前审判的 Boss ID */
  bossId: string;
  /** 当前题目索引 */
  currentQuestionIdx: number;
  /** 总题数 */
  totalQuestions: number;
  /** 当前题目 */
  currentQuestion: BossTrialQuestion;
  /** 已答对数 */
  correctCount: number;
  /** 玩家所选（null=未选） */
  selectedIdx: number | null;
  /** 是否已答完所有题 */
  finished: boolean;
  /** 是否全部答对（完美审判） */
  perfect: boolean;
  /** 宣判/误判提示文本（结束时注入） */
  verdictText: string;
  /** 已获奖励碎片（结束时注入） */
  rewardedFragments: number;
  /** 已获奖励过载（结束时注入） */
  rewardedOverdrive: number;
}

// ============ A2：QTE 致命一击 ============

/** QTE 类型：不同手势对应不同演出 */
export type QTEKind = "tapBurst" | "swipeSlash" | "rapidTap" | "holdAim";

/** QTE 定义（Boss 阶段切换/濒死时触发） */
export interface QTEDef {
  /** QTE 类型 */
  kind: QTEKind;
  /** 提示文案（如"集中火力！连击屏幕！"） */
  prompt: string;
  /** 持续秒数 */
  duration: number;
  /** 目标值（rapidTap=点击次数，holdAim=持续秒数，tapBurst/swipeSlash=1） */
  target: number;
  /** 成功额外伤害（绝对值，封顶按规则） */
  successDamage: number;
  /** 成功奖励过载充能 */
  successOverdrive: number;
  /** 失败惩罚（Boss 反击 debuff 持续秒数） */
  failPenaltyDebuffDur: number;
  /** 失败触发的 debuff */
  failDebuff: CounterDebuff;
}

/** QTE 运行时状态（HUD 用） */
export interface QTEState {
  /** 当前 QTE 定义 */
  def: QTEDef;
  /** 剩余秒数 */
  remain: number;
  /** 总时长 */
  total: number;
  /** 当前进度（rapidTap=已点击次数，holdAim=已持续秒数，tapBurst/swipeSlash=0/1） */
  progress: number;
  /** 目标值 */
  target: number;
  /** 是否已完成（成功或失败） */
  finished: boolean;
  /** 是否成功 */
  success: boolean;
  /** 触发场景：phaseSwitch=阶段切换, nearDeath=濒死一击 */
  trigger: "phaseSwitch" | "nearDeath";
}

// ============ A3：Roguelike 契约系统 ============

/** 契约效果参数 */
export interface PactEffect {
  /** 道具伤害倍率（<1 = 削弱） */
  itemDamageMul?: number;
  /** 炮兵射速倍率（<1 = 削弱） */
  fireRateMul?: number;
  /** 道具 CD 倍率（>1 = 延长） */
  itemCdMul?: number;
  /** 碎片掉率倍率（>1 = 增益） */
  fragmentMul?: number;
  /** 过载获取倍率（>1 = 增益） */
  overdriveMul?: number;
  /** Boss 血量倍率（<1 = 削弱 Boss） */
  bossHpMul?: number;
  /** 反击频率倍率（>1 = 增强 Boss 反击） */
  counterMul?: number;
  /** 连携充能倍率（>1 = 增益） */
  synergyMul?: number;
}

/** 契约定义（以负面换正面） */
export interface PactDef {
  /** 契约 ID */
  id: string;
  /** 契约名（如"灰烬契约"） */
  name: string;
  /** 契约 emoji */
  emoji: string;
  /** 主题色 */
  color: string;
  /** 契约描述（人话说明代价与收益） */
  desc: string;
  /** 代价说明 */
  cost: string;
  /** 收益说明 */
  gain: string;
  /** 效果参数 */
  effect: PactEffect;
  /** 稀有度 */
  rarity: "common" | "rare" | "epic";
}

/** 契约运行时状态 */
export interface PactState {
  /** 当前已签订契约 ID 列表 */
  activePacts: string[];
  /** 当前待选契约（波次间隙注入） */
  offerings: PactDef[];
  /** 是否正在展示契约面板 */
  showing: boolean;
}

// ============ A4：多结局剧情模式 ============

/** 剧情结局类型（严格兼容：新增 endingType 字段可选） */
export type BombStoryEndingType = "normal" | "hidden" | "true";

/** 剧情分支节点：在关键关卡触发，影响后续走向 */
export interface BombStoryBranchNode {
  /** 节点 ID */
  id: string;
  /** 触发关卡索引 */
  triggerStageIdx: number;
  /** 分支标题 */
  title: string;
  /** 分支场景描述 */
  scene: string;
  /** 玩家可选选项 */
  choices: Array<{
    /** 选项文本 */
    text: string;
    /** 选择后导向的结局类型 */
    leadsTo: BombStoryEndingType;
    /** 选项结果说明 */
    result: string;
    /** 该选项对后续关卡的影响（Boss 血量倍率） */
    nextStageBossHpMul?: number;
    /** 是否为最优选择（真结局触发条件） */
    optimal?: boolean;
  }>;
}

/** 多结局剧情配置（严格兼容：在 BombStoryStage 末尾追加可选字段） */
export interface BombStoryMultiEnding {
  /** 关联剧情模式 ID */
  storyId: string;
  /** 分支节点列表（按 triggerStageIdx 排序） */
  branchNodes: BombStoryBranchNode[];
  /** 三种结局配置 */
  endings: Array<{
    type: BombStoryEndingType;
    name: string;
    desc: string;
    /** 触发条件：所有 optimal 选项都选对 = true 结局 */
    unlockCondition: string;
    /** 结局奖励碎片 */
    rewardFragments: number;
    /** 结局主题色 */
    themeColor: string;
  }>;
}

// ============ B1：诈骗产业链叙事 ============

/** 产业链环节 */
export type IndustryChainStage =
  | "recruit"      // 引流招募（高薪招聘/网恋引流）
  | "script"       // 话术培训（剧本/养号/包装）
  | "launder"      // 洗钱流转（卡农/虚拟币/地下钱庄）
  | "cashout";     // 提现分赃（取现/跨境转移）

/** 产业链定义（每档园区在产业链中的定位） */
export interface IndustryChainDef {
  /** 关联园区档位 */
  tierStructure: ParkTierDef["structure"];
  /** 该园区主要承担的产业链环节 */
  primaryStage: IndustryChainStage;
  /** 次要环节 */
  secondaryStages: IndustryChainStage[];
  /** 产业链叙事文本（结算页展示） */
  narrative: string;
  /** 上游园区档位（产业链流向） */
  upstream?: ParkTierDef["structure"];
  /** 下游园区档位 */
  downstream?: ParkTierDef["structure"];
  /** 关联法律罪名 */
  relatedCrimes: string[];
}

// ============ B4：暗网深渊子档位 ============

/** 暗网深渊子档位（扩展 abyss 档位） */
export type AbyssSubStructure =
  | "aiFactory"      // AI 换脸工厂
  | "idForge"        // 虚拟身份车间
  | "deepfakeLab";   // Deepfake 实验室

// ============ C1：模块逐帧崩塌动画 ============

/** 崩塌阶段：模块被击破后的多阶段动画 */
export type DemolitionStage = 0 | 1 | 2 | 3 | 4;
// 0=完好 | 1=裂痕出现 | 2=倾斜 | 3=倒塌中 | 4=扬尘稳定（废墟）

/** 崩塌动画运行时状态（附加到 BuildingModule） */
export interface DemolitionAnimState {
  /** 当前崩塌阶段 */
  stage: DemolitionStage;
  /** 当前阶段进度 0..1 */
  progress: number;
  /** 倾斜方向（-1=左倾，1=右倾，0=未定） */
  tiltDir: number;
  /** 倾斜角度（弧度） */
  tiltAngle: number;
  /** 烟尘粒子计数（渲染用） */
  dustParticles: number;
  /** 火星粒子计数 */
  sparkParticles: number;
}

// ============ C2：天气粒子视觉 ============

/** 天气粒子配置（渲染层用，不影响数值） */
export interface WeatherParticleConfig {
  /** 关联天气 */
  weather: WeatherKind;
  /** 粒子类型 */
  particleType: "rain" | "lightning" | "fog" | "sand" | "aurora" | "sun";
  /** 粒子数量 */
  count: number;
  /** 粒子颜色 */
  color: string;
  /** 粒子速度倍率 */
  speedMul: number;
  /** 粒子大小（像素） */
  size: number;
  /** 是否有闪烁效果（闪电/极光） */
  flicker: boolean;
}

// ============ D1：受害者归家故事卡 ============

/** 受害者归家故事卡（救援后/结算时展示） */
export interface VictimStoryCard {
  /** 故事 ID */
  id: string;
  /** 关联受害者档案 typeId（可选） */
  victimProfileId?: string;
  /** 故事标题 */
  title: string;
  /** 受害者化名 */
  alias: string;
  /** 受害者画像（如"被高薪诱骗的应届生"） */
  profile: string;
  /** 经历概述（被骗/被困经过） */
  experience: string;
  /** 归家经过（情感化叙事） */
  returnHome: string;
  /** 现状（如"已返乡与家人团聚，配合警方调查"） */
  currentStatus: string;
  /** 给玩家的话（感谢/寄语） */
  message: string;
  /** 关联反诈热线 */
  hotline: string;
  /** 主题色 */
  themeColor: string;
}

// ============ D2：防骗力 5 维雷达 ============

/** 防骗力 5 维度 */
export type AbilityRadarDimension =
  | "identify"    // 识别力：识破诈骗类型的能力
  | "refuse"      // 拒绝力：抵制高息/免费诱惑
  | "verify"      // 核实力：主动通过官方渠道核实
  | "alert"       // 警觉力：对紧迫感/权威压迫的抵抗
  | "spread";     // 传播力：分享/教育他人的能力

/** 防骗力雷达数据（结算页展示） */
export interface AbilityRadar {
  /** 5 维数值 0..100 */
  dimensions: Array<{
    dim: AbilityRadarDimension;
    score: number;
    /** 评级 S/A/B/C/D */
    grade: string;
  }>;
  /** 综合防骗力评分 0..100 */
  totalScore: number;
  /** 综合评级 */
  totalGrade: string;
  /** 雷达主题色 */
  themeColor: string;
}

// ============ D3：骗子视角复盘 ============

/** 骗子视角复盘剧本（结算后查看） */
export interface DebriefScenario {
  /** 剧本 ID */
  id: string;
  /** 关联园区档位 */
  tierStructure: ParkTierDef["structure"];
  /** 关联 Boss ID */
  bossId?: string;
  /** 剧本标题 */
  title: string;
  /** 骗子视角开场白 */
  villainMonologue: string;
  /** 复盘要点（从骗子角度解释为什么这波会被反击/失败） */
  debriefPoints: Array<{
    /** 骗子原本的剧本步骤 */
    scriptStep: string;
    /** 玩家做对了什么导致剧本失败 */
    playerCountermeasure: string;
    /** 教育属性：玩家应记住的防骗要点 */
    lesson: string;
  }>;
  /** 总结：骗子的"失败教训"（讽刺口吻） */
  villainLesson: string;
  /** 关联反诈知识点 */
  knowledgePoints: string[];
}

// ============ E1：战报二维码挑战 ============

/** 战报二维码挑战数据 */
export interface BattleReportQR {
  /** 挑战种子（序列化的园区配置） */
  seed: string;
  /** 种子对应的简短描述 */
  seedLabel: string;
  /** 生成日期 */
  date: string;
  /** 玩家在该种子的得分 */
  score: number;
  /** 玩家评级 */
  rating: BombTierRating;
  /** 二维码主题色 */
  themeColor: string;
  /** 挑战提示文案 */
  challengeText: string;
}

// ============ E2：成就炫耀卡 ============

/** 成就炫耀卡（解锁时生成可分享卡片） */
export interface AchievementShowcaseCard {
  /** 成就 ID */
  achievementId: string;
  /** 成就名称 */
  name: string;
  /** 成就图标 */
  icon: string;
  /** 成就描述 */
  desc: string;
  /** 解锁时间 */
  unlockedAt: string;
  /** 稀有度 */
  rarity: "common" | "rare" | "epic" | "legendary";
  /** 主题色 */
  themeColor: string;
  /** 祝贺语 */
  citation: string;
}

// ============ B2：反诈热点同步 ============

/** 反诈热点案例（Boss 击败后展示最新真实案例） */
export interface HotspotCase {
  /** 案例 ID */
  id: string;
  /** 关联园区档位（可选，用于匹配 Boss） */
  tierStructure?: ParkTierDef["structure"];
  /** 关联诈骗类型 */
  scamType: string;
  /** 案例标题 */
  title: string;
  /** 发布日期（YYYY-MM-DD） */
  date: string;
  /** 来源机构 */
  source: string;
  /** 案例摘要 */
  summary: string;
  /** 关键启示 */
  takeaway: string;
  /** 关联反诈热线 */
  hotline: string;
  /** 严重度 1-5 */
  severity: number;
}

