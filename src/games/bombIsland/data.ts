import type { ItemDef, ItemId, ParkTierDef, BombBossDef, WeatherDef, WeatherKind, WeaponDef, WeaponKind, MapLayoutDef } from "./types";

/** 9 种反诈道具：点击使用，CD 中无效；使用后对其他道具剩余 CD 折减 CD_REFRESH_PCT */
export const ITEMS: Record<ItemId, ItemDef> = {
  bomb: {
    id: "bomb", name: "反诈炮弹", emoji: "💥", color: "#FFD666",
    desc: "96110 精准爆破园区核心", cd: 8, overdrive: 22, effect: "blast", damageAbs: 100,
  },
  missile: {
    id: "missile", name: "96110 震慑", emoji: "📞", color: "#FF7A1A",
    desc: "反诈热线制导打击·震慑全场", cd: 10, overdrive: 20, effect: "homing", damageAbs: 100,
  },
  fireRain: {
    id: "fireRain", name: "警方突击", emoji: "🚔", color: "#FF5A2A",
    desc: "3 秒警力突击覆盖", cd: 14, overdrive: 18, effect: "fireRain", dpsAbs: 100, duration: 3,
  },
  incendiary: {
    id: "incendiary", name: "银行止付", emoji: "🏦", color: "#E5353B",
    desc: "4 秒冻结资金账户", cd: 12, overdrive: 16, effect: "burnZone", dpsAbs: 100, duration: 4,
  },
  drone: {
    id: "drone", name: "反诈无人机", emoji: "🛰", color: "#00E5FF",
    desc: "5 秒空中巡查扫射", cd: 16, overdrive: 24, effect: "drone", dpsAbs: 80, duration: 5,
  },
  laser: {
    id: "laser", name: "反诈 APP 光束", emoji: "🛡", color: "#B388FF",
    desc: "国家反诈中心扫描光束", cd: 11, overdrive: 18, effect: "laser", damageAbs: 100,
  },
  meteor: {
    id: "meteor", name: "法律铁锤", emoji: "⚖", color: "#FFB020",
    desc: "5 次依法重锤连坠", cd: 15, overdrive: 22, effect: "meteor", damageAbs: 100,
  },
  arrowRain: {
    id: "arrowRain", name: "网络封禁令", emoji: "🚫", color: "#52C41A",
    desc: "2 秒封堵诈骗通道", cd: 13, overdrive: 16, effect: "arrowRain", dpsAbs: 70, duration: 2,
  },
  swords: {
    id: "swords", name: "全民反诈风暴", emoji: "🌐", color: "#00E5FF",
    desc: "全民聚力终极扫荡", cd: 22, overdrive: 40, effect: "swords", damageAbs: 100,
  },
};

/** 道具栏渲染顺序（自上而下） */
export const ITEM_ORDER: ItemId[] = [
  "bomb", "missile", "fireRain", "incendiary", "drone",
  "laser", "meteor", "arrowRain", "swords",
];

/** 园区档位：每 2 波升档（妙瓦底 → 缅北 → 总部） */
export const PARK_TIERS: ParkTierDef[] = [
  { tier: 0, name: "妙瓦底", subtitle: "MYAWADDY", hpMul: 1.0, repairMul: 1.0, color: "#9FE3FF", structure: "den" },
  { tier: 1, name: "缅北中区", subtitle: "KOKANG", hpMul: 1.5, repairMul: 1.8, color: "#FFB020", structure: "kokang" },
  { tier: 2, name: "总部核心", subtitle: "HEADQUARTERS", hpMul: 2.2, repairMul: 2.6, color: "#B388FF", structure: "hq" },
];

/** 每 2 波升档时的 BOSS 身份（每档 2 个 BOSS，逐波强化） */
export const TIER_BOSSES: Record<ParkTierDef["structure"], BombBossDef[]> = {
  den: [
    {
      bossName: "血汗工厂主",
      identity: "妙瓦底电诈窝点操盘手",
      emoji: "👹",
      pattern: "droneSwarm",
      counterInterval: 8,
      counterShots: 3,
      counterDebuffDur: 2.5,
      skillName: "释放逃跑无人机",
      skillDesc: "每隔 8 秒释放 3 架干扰无人机，命中触发道具失效",
      enrageAt: 0.5,
      enrageMul: 1.6,
    },
    {
      bossName: "话术培训师",
      identity: "妙瓦底诈骗话术教练",
      emoji: "🎭",
      pattern: "commsJamming",
      counterInterval: 7,
      counterShots: 4,
      counterDebuffDur: 2.8,
      skillName: "信号干扰弹幕",
      skillDesc: "释放干扰弹幕触发屏幕扭曲，压制反诈炮兵射速",
      enrageAt: 0.5,
      enrageMul: 1.7,
    },
  ],
  kokang: [
    {
      bossName: "缅北武装头目",
      identity: "缅北中区武装集团首脑",
      emoji: "🔫",
      pattern: "artilleryBarrage",
      counterInterval: 6,
      counterShots: 5,
      counterDebuffDur: 3.0,
      skillName: "重炮齐射",
      skillDesc: "6 秒一次重炮齐射 5 发，命中锁定道具 CD",
      enrageAt: 0.55,
      enrageMul: 1.8,
    },
    {
      bossName: "洗钱水房老板",
      identity: "缅北洗钱水房操盘者",
      emoji: "💰",
      pattern: "missileSalvo",
      counterInterval: 5.5,
      counterShots: 6,
      counterDebuffDur: 3.2,
      skillName: "资金外逃导弹",
      skillDesc: "5.5 秒一次 6 发导弹齐射，干扰炮兵武器系统",
      enrageAt: 0.55,
      enrageMul: 1.9,
    },
  ],
  hq: [
    {
      bossName: "跨境电诈首脑",
      identity: "总部核心终极电诈大佬",
      emoji: "👑",
      pattern: "missileSalvo",
      counterInterval: 5,
      counterShots: 7,
      counterDebuffDur: 3.5,
      skillName: "全方位导弹覆盖",
      skillDesc: "5 秒一次 7 发导弹覆盖，装甲修复+多重干扰",
      enrageAt: 0.6,
      enrageMul: 2.0,
    },
    {
      bossName: "暗网数据王",
      identity: "总部暗网数据黑市掌门",
      emoji: "🕸",
      pattern: "artilleryBarrage",
      counterInterval: 4.5,
      counterShots: 8,
      counterDebuffDur: 3.8,
      skillName: "数据洪流重炮",
      skillDesc: "4.5 秒一次 8 发重炮，火力压制+全屏干扰",
      enrageAt: 0.6,
      enrageMul: 2.1,
    },
  ],
};

/** 取当前波次的 BOSS 定义（按 tier 和波次内序号循环） */
export function getBossForWave(wave: number): BombBossDef {
  const tier = getTierForWave(wave);
  const list = TIER_BOSSES[tier.structure];
  // 每 2 波升档，档位内 2 个 BOSS 轮换（wave-1）% 2
  const idx = (wave - 1) % list.length;
  return list[idx];
}

export function getTierForWave(wave: number): ParkTierDef {
  const idx = Math.min(PARK_TIERS.length - 1, Math.floor((wave - 1) / 2));
  return PARK_TIERS[idx];
}

/** 武器升级曲线：每清一波 +1 级，影响射速与伤害 */
export const WEAPON_BASE_INTERVAL = 0.18; // 升级：基础射速更快（原 0.25 → 0.18）
/** 每级射速提升比例（0.10 = 每级 +10% 射速，原 0.08） */
export const WEAPON_FIRE_GAIN_PER_LV = 0.10;
/** 武器最高等级 */
export const WEAPON_MAX_LEVEL = 10;

export function weaponFireInterval(level: number): number {
  const lv = Math.min(WEAPON_MAX_LEVEL, Math.max(1, level));
  return WEAPON_BASE_INTERVAL / (1 + (lv - 1) * WEAPON_FIRE_GAIN_PER_LV);
}

/**
 * 炮兵生命系统已移除（纯无尽模式）：炮兵不可被伤害。
 * 保留常量向后兼容，实际不再使用。
 */
export const CANNON_MAX_HP = 100;
export const CANNON_REGEN = 0;

// ============ 数值调参（爽感强化：高血量 + 自回血 + 废墟可重建） ============
// v3 升级：建筑血量提升 3 倍，自回血提升 2 倍，废墟随血条回复逐步重建

export const BASE_MAX_HP = 2_400_000; // 升血量×3：建筑血量很高（原 800_000 → 2_400_000）
export const BASE_REPAIR = 6000;      // 升修复×2：配合高血量让回血可见（原 3000 → 6000）
/** 每波 maxHP / repair 递增系数 */
export const WAVE_HP_GROWTH = 0.10;
export const WAVE_REPAIR_GROWTH = 0.10;

/**
 * 废墟重建触发阈值：当园区总 HP 占比 > 该值时，多余修复量进入"废墟重建池"。
 * 设计意图：玩家拆光一半模块后必须持续输出，否则园区会逐步重建已被拆除的模块，
 * 形成"打不死就回血"的压迫感与持续输出爽感。
 */
export const REBUILD_THRESHOLD = 0.55;
/** 废墟重建速率倍率（相对 BASE_REPAIR，控制单个废墟从 0→1 重建所需时间） */
export const REBUILD_RATE_MUL = 0.6;
/** 同屏最多并行重建的废墟数（避免一波全重建造成"打不完"的挫败感） */
export const REBUILD_MAX_PARALLEL = 2;

/** 使用道具 → 其他道具剩余 CD 折减比例 */
export const CD_REFRESH_PCT = 0.40;   // 升级：CD 折减更多（原 0.35 → 0.40）

/** 过载连击槽 */
export const OVERDRIVE_MAX = 100;
export const OVERDRIVE_DECAY = 8;     // 升级：衰减更慢（原 10 → 8）
export const OVERDRIVE_DURATION = 5;  // 升级：过载更久（原 4 → 5）
export const OVERDRIVE_FIRE_MULT = 3.0; // 升级：射速倍率更高（原 2.5 → 3.0）
export const OVERDRIVE_DMG_MULT = 2.5;  // 升级：伤害倍率更高（原 2.0 → 2.5）

/** 反诈炮兵自动发射（爽感强化：基础射速更快、多管齐射） */
export const BASE_FIRE_INTERVAL = 0.18; // s (≈5.5 发/秒，原 0.25)
export const SHELL_DAMAGE_PCT = 0.06;   // 每发占 maxHP 百分比（原 0.05）
export const SHELL_OVERDRIVE_GAIN = 3;  // 每发过载充能（原 2）
/** 多管齐射：每次发射的并行炮弹数（随武器等级递增） */
export const MULTISHOT_BASE = 1;
export const MULTISHOT_PER_LV = 0.4;    // 每级 +0.4 管，向取整靠拢
/** 取指定武器等级的多管数 */
export function multishotCount(level: number): number {
  const lv = Math.min(WEAPON_MAX_LEVEL, Math.max(1, level));
  return MULTISHOT_BASE + Math.floor((lv - 1) * MULTISHOT_PER_LV);
}

/**
 * 逃脱进度系统已移除（纯无尽模式）：玩家不会失败。
 * 保留常量向后兼容，escape 始终为 0。
 */
export const K_ESCAPE = 0;

export function maxHpForWave(wave: number): number {
  const tier = getTierForWave(wave);
  return Math.round(BASE_MAX_HP * tier.hpMul * (1 + (wave - 1) * WAVE_HP_GROWTH));
}

export function repairForWave(wave: number): number {
  const tier = getTierForWave(wave);
  return BASE_REPAIR * tier.repairMul * (1 + (wave - 1) * WAVE_REPAIR_GROWTH);
}

// ============ 模块 HP 基准（per-module，区别于 maxHpForWave 的园区总 HP） ============

/** 大型模块 HP 倍率（= baseHp，保留导出供 engine 兼容） */
export const MODULE_HP_LARGE = 1.0;
/** 中型模块 HP 倍率（电诈工位/苦工宿舍） */
export const MODULE_HP_MEDIUM_MUL = 0.6;
/** 小型模块 HP 倍率（信号塔/铁丝网/地基） */
export const MODULE_HP_SMALL_MUL = 0.3;

/** 每模块基础 HP：按波次/档位递增。园区总 HP = 各模块 HP 之和。 */
export function moduleHpBaseForWave(wave: number): number {
  const tier = getTierForWave(wave);
  // v3：模块基础 HP ×3（原 5000 → 15000），营造"建筑血量很高"的爽感
  return Math.round(15000 * tier.hpMul * (1 + (wave - 1) * WAVE_HP_GROWTH));
}

// ============ 过载多管加成 ============

/** 过载期间额外多管数 */
export const OVERDRIVE_MULTISHOT_BONUS = 2;

// ============ 绝对伤害值（engine 兼容：引擎以绝对值扣减模块 HP，封顶 100） ============

/** 武器单发绝对伤害（随等级递增，engine 端封顶 100） */
export function weaponDamageAbs(level: number): number {
  const lv = Math.min(WEAPON_MAX_LEVEL, Math.max(1, level));
  return Math.round(80 + (lv - 1) * 2.2);
}

/** 集束弹主爆破绝对伤害 */
export const CLUSTER_MAIN_DMG = 80;
/** 集束弹子爆破绝对伤害 */
export const CLUSTER_SUB_DMG = 50;
/** 电磁弹绝对伤害 */
export const EMP_DMG_ABS = 80;
/** 燃烧弹初始绝对伤害 */
export const INCENDIARY_DMG_ABS = 60;
/** 燃烧区每秒绝对 DPS */
export const INCENDIARY_ZONE_DPS = 50;

// ============ BOSS 反击干扰系统（不伤害炮兵，触发 debuff） ============

/** 各反击模式对应的 debuff 类型 */
export const PATTERN_DEBUFF: Record<BombBossDef["pattern"], import("./types").CounterDebuff> = {
  droneSwarm: "itemDisable",
  artilleryBarrage: "cdLock",
  commsJamming: "visionJam",
  missileSalvo: "weaponJam",
};

/** 各 debuff 的中文名 */
export const DEBUFF_NAMES: Record<import("./types").CounterDebuff, string> = {
  cdLock: "道具 CD 锁定",
  weaponJam: "武器射速压制",
  itemDisable: "道具失效",
  visionJam: "屏幕干扰",
};

/** 各 debuff 的 emoji */
export const DEBUFF_EMOJIS: Record<import("./types").CounterDebuff, string> = {
  cdLock: "🔒",
  weaponJam: "🔫",
  itemDisable: "🚫",
  visionJam: "👁",
};

/** 武器干扰时的射速倍率（0.5 = 射速减半） */
export const WEAPON_JAM_FIRE_MUL = 0.5;

// ============ 天气系统 ============

/** 4 种天气定义：影响炮兵射速 / 园区修复 / BOSS 反击 / 炮弹伤害 / 道具 CD */
export const WEATHERS: Record<WeatherKind, WeatherDef> = {
  sunny: {
    id: "sunny",
    name: "烈日",
    emoji: "☀",
    desc: "园区修复 +50% · 炮兵射速 +20%",
    color: "#FFB020",
    fireRateMul: 1.2,
    repairMul: 1.5,
    counterMul: 1.0,
    shellDmgMul: 1.0,
    cdMul: 1.0,
    escapeMul: 1.0,
  },
  storm: {
    id: "storm",
    name: "暴雨",
    emoji: "🌧",
    desc: "炮兵射速 -20% · 道具 CD -20%",
    color: "#5AB8FF",
    fireRateMul: 0.8,
    repairMul: 1.0,
    counterMul: 1.0,
    shellDmgMul: 1.0,
    cdMul: 0.8,
    escapeMul: 1.0,
  },
  thunder: {
    id: "thunder",
    name: "雷暴",
    emoji: "⛈",
    desc: "BOSS 反击 +30% · 炮弹伤害 +20%",
    color: "#B388FF",
    fireRateMul: 1.0,
    repairMul: 1.0,
    counterMul: 1.3,
    shellDmgMul: 1.2,
    cdMul: 1.0,
    escapeMul: 1.0,
  },
  fog: {
    id: "fog",
    name: "浓雾",
    emoji: "🌫",
    desc: "炮弹伤害 -15% · BOSS 反击 -30%",
    color: "#9FE3FF",
    fireRateMul: 1.0,
    repairMul: 1.0,
    counterMul: 0.7,
    shellDmgMul: 0.85,
    cdMul: 1.0,
    escapeMul: 1.0,
  },
};

const WEATHER_LIST: WeatherKind[] = ["sunny", "storm", "thunder", "fog"];

/**
 * 根据波次选择天气：每 2 波切换一次（奇数波同上一波，偶数波换新）
 * wave 1-2: 随机一种；wave 3-4: 换另一种；依次类推
 */
let lastWeatherIdx = -1;
export function pickWeather(wave: number): WeatherDef {
  const phase = Math.floor((wave - 1) / 2);
  // 同一 phase 内天气固定；进入新 phase 时换一种（避免连续相同）
  if (phase === 0 && lastWeatherIdx === -1) {
    lastWeatherIdx = Math.floor(Math.random() * WEATHER_LIST.length);
  } else if (phase > 0 && wave % 2 === 1) {
    // 新 phase 第一波：换一种不同的天气
    let idx = lastWeatherIdx;
    while (idx === lastWeatherIdx) {
      idx = Math.floor(Math.random() * WEATHER_LIST.length);
    }
    lastWeatherIdx = idx;
  }
  return WEATHERS[WEATHER_LIST[lastWeatherIdx]];
}

/** 重置天气状态（用于 retry） */
export function resetWeather(): void {
  lastWeatherIdx = -1;
}

// ============ 武器系统 ============

/** 4 种武器：标准弹 / 集束弹 / 电磁弹 / 燃烧弹 */
export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  standard: {
    id: "standard", name: "标准弹", emoji: "🎯", color: "#FFD666",
    desc: "中型爆破·无限弹药", maxAmmo: -1,
  },
  cluster: {
    id: "cluster", name: "集束弹", emoji: "🎇", color: "#FF7A1A",
    desc: "分裂 3 发子爆破·大范围", maxAmmo: 5,
  },
  emp: {
    id: "emp", name: "电磁弹", emoji: "⚡", color: "#00E5FF",
    desc: "减速敌人 2 秒·电磁脉冲", maxAmmo: 5,
  },
  incendiary: {
    id: "incendiary", name: "燃烧弹", emoji: "🔥", color: "#E5353B",
    desc: "3 秒燃烧区持续伤害", maxAmmo: 5,
  },
};

/** 武器渲染顺序（自左向右） */
export const WEAPON_ORDER: WeaponKind[] = ["standard", "cluster", "emp", "incendiary"];

/** 特殊武器初始弹药 */
export const SPECIAL_WEAPON_START_AMMO = 5;

/** 集束弹子爆破数 */
export const CLUSTER_SUB_COUNT = 3;
/** 集束弹子爆破偏移半径（像素） */
export const CLUSTER_SUB_OFFSET = 38;
/** 集束弹主爆破伤害倍率（相对标准） */
export const CLUSTER_MAIN_DMG_MULT = 0.3;
/** 集束弹子爆破伤害倍率（相对标准） */
export const CLUSTER_SUB_DMG_MULT = 0.3;

/** 电磁弹减速持续秒数 */
export const EMP_SLOW_DURATION = 2;
/** 电磁弹减速时园区修复倍率（0.3 = 修复降至 30%） */
export const EMP_REPAIR_MUL = 0.3;
/** 电磁弹减速时 BOSS 反击间隔倍率（1.8 = 反击变慢 80%） */
export const EMP_COUNTER_MUL = 1.8;
/** 电磁弹直接伤害倍率（相对标准） */
export const EMP_DMG_MULT = 0.5;

/** 燃烧弹区域持续秒数 */
export const INCENDIARY_ZONE_DURATION = 3;
/** 燃烧弹每秒伤害（占 maxHP 百分比） */
export const INCENDIARY_ZONE_DPS_PCT = 1.2;
/** 燃烧弹初始伤害倍率（相对标准） */
export const INCENDIARY_DMG_MULT = 0.4;

// ============ 公园地图系统 ============

/** 树木生命值 */
export const TREE_MAX_HP = 60;
/** 树木碰撞半径（像素） */
export const TREE_RADIUS = 18;
/** 玩家炮弹对树木单发伤害 */
export const TREE_DMG_PER_SHELL = 30;
/** BOSS 反击弹对树木单发伤害 */
export const TREE_DMG_PER_COUNTER = 15;

/** 3 种公园地图布局，每 MAP_CYCLE 波切换一次（循环） */
export const MAP_LAYOUTS: MapLayoutDef[] = [
  {
    id: "central", name: "中央公园", emoji: "🌳",
    // 开阔中央：树木环绕四周，中央留空
    trees: [
      { x: 240, y: 180 }, { x: 480, y: 130 }, { x: 620, y: 130 },
      { x: 880, y: 180 }, { x: 240, y: 360 }, { x: 880, y: 360 },
    ],
  },
  {
    id: "avenue", name: "林荫大道", emoji: "🛣",
    // 中央纵向林荫：树木沿中线排成大道
    trees: [
      { x: 490, y: 150 }, { x: 510, y: 200 }, { x: 490, y: 250 },
      { x: 510, y: 300 }, { x: 490, y: 350 }, { x: 510, y: 400 },
    ],
  },
  {
    id: "checker", name: "棋盘绿地", emoji: "🔲",
    // 棋盘格阵：交替排列的树木方阵
    trees: [
      { x: 280, y: 180 }, { x: 580, y: 180 }, { x: 880, y: 180 },
      { x: 430, y: 280 }, { x: 730, y: 280 },
      { x: 280, y: 380 }, { x: 580, y: 380 }, { x: 880, y: 380 },
    ],
  },
];

/** 地图切换周期（每 N 波换地图） */
export const MAP_CYCLE = 3;
/** 地图切换动画持续秒数 */
export const MAP_TRANSITION_DURATION = 1.5;

/** 根据波次取地图布局（循环切换） */
export function getMapForWave(wave: number): MapLayoutDef {
  const idx = Math.floor((wave - 1) / MAP_CYCLE) % MAP_LAYOUTS.length;
  return MAP_LAYOUTS[idx];
}
