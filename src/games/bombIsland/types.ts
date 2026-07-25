/**
 * 诈园区（bomb-island）类型定义
 * 无尽波次围攻：反诈意大利炮自动发射 + 左侧道具栏 + 模块化电诈园区综合体
 */

export type ItemId =
  | "bomb"
  | "missile"
  | "fireRain"
  | "incendiary"
  | "drone"
  | "laser"
  | "meteor"
  | "arrowRain"
  | "swords";

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
  | "swords"; // 终极汇聚爆破

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
  structure: "den" | "kokang" | "hq";
}

/** BOSS 反击干扰类型：不伤害炮兵，改为 debuff 玩家 */
export type CounterDebuff =
  | "cdLock"        // 道具 CD 暂时锁定（不刷新）
  | "weaponJam"     // 武器射速暂时降低
  | "itemDisable"   // 随机道具暂时失效
  | "visionJam";    // 屏幕干扰（视觉污染）

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
}

export interface ItemState {
  id: ItemId;
  cdLeft: number; // 剩余冷却秒数，0 = 可用
  cd: number; // 总冷却
}

export type ParkPhase = "fight" | "clearing" | "lost";

/** 天气系统：4 种天气，每 2 波切换一次 */
export type WeatherKind = "sunny" | "storm" | "thunder" | "fog";

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

/** 武器类型：标准弹 / 集束弹 / 电磁弹 / 燃烧弹 */
export type WeaponKind = "standard" | "cluster" | "emp" | "incendiary";

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
}
