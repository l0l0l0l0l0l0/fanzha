import type {
  ThunderProceduralPatternParams, ThunderProceduralConfig, BossAttackPattern,
} from "./types";

// ===========================================================================
// ===== v7 升级：程序化 BOSS 弹幕生成器 ======================================
// ===========================================================================

/** 程序化弹幕全局配置 */
export const THUNDER_PROCEDURAL_CONFIG: ThunderProceduralConfig = {
  enabled: true,
  seed: 0,            // 运行时由 mulberry32 重置
  hpThreshold: 0.5,   // BOSS HP < 50% 启用更复杂模式
  maxCombined: 2,     // 最多同时叠加 2 种弹幕
  difficultyFactor: 0.5,
};

/** 弹幕模式中文名映射 */
export const PATTERN_NAME_MAP: Record<BossAttackPattern, string> = {
  spread:      "扇形散射",
  spiral:      "螺旋弹幕",
  rain:        "区域弹雨",
  beam:        "集束光束",
  summon:      "召唤小怪",
  homing:      "追踪弹",
  laserSweep:  "激光扫射",
  crossFire:   "交叉火力",
  ringBurst:   "环形爆发",
  waveDash:    "波浪冲刺",
};

/** 弹幕颜色调色板（8-10 个 hex） */
export const PATTERN_COLOR_PALETTE: string[] = [
  "#FF5A60", // 警示红
  "#FF7A1A", // 橙
  "#FFD666", // 金
  "#52C41A", // 安全绿
  "#00E5FF", // 青
  "#3B7FEF", // 蓝
  "#B388FF", // 紫
  "#FF00E5", // 品红
  "#FF4D4F", // 深红
  "#FAAD14", // 琥珀
];

/** 所有 BossAttackPattern 列表（用于随机选取） */
const ALL_PATTERNS: BossAttackPattern[] = [
  "spread", "spiral", "rain", "beam", "summon",
  "homing", "laserSweep", "crossFire", "ringBurst", "waveDash",
];

/**
 * Mulberry32 确定性随机数生成器（本地副本，避免与 data.ts 循环依赖）
 * 同种子生成相同序列，用于每日挑战复现
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 限定数值到 [lo, hi] */
function clampNum(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 从数组中按 rng 随机取一项 */
function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** 计算难度等级标签（1..5），用于命名 */
function levelOf(difficultyFactor: number): number {
  // difficultyFactor 0..1 → 1..5
  return clampNum(Math.floor(difficultyFactor * 4) + 1, 1, 5);
}

/**
 * 程序化生成单个弹幕模式
 * @param rng 随机数生成器
 * @param difficultyFactor 难度系数 0..1，影响子弹数量/速度/间隔
 * @param baseHpRatio BOSS 当前 HP 比例 0..1（保留供上层 HP 联动使用）
 */
export function generateProceduralPattern(
  rng: () => number,
  difficultyFactor: number,
  baseHpRatio: number,
): ThunderProceduralPatternParams {
  // 难度系数归一化到 0..1
  const df = clampNum(difficultyFactor, 0, 1);
  const basePattern = pick(rng, ALL_PATTERNS);
  const level = levelOf(df);
  // baseHpRatio 当前由上层 pickPatternForBossHp 用于调整有效难度，此处保留参数
  void baseHpRatio;

  // ===== 基础参数：随难度系数线性调整（保证平衡，不过难/过易） =====
  // bulletCount: 8..20（难度越高子弹越多）
  const bulletCount = Math.round(8 + df * 12);
  // bulletSpeed: 120..220（难度越高越快）
  const bulletSpeed = Math.round(120 + df * 100);
  // fireInterval: 1.5..0.7（难度越高间隔越短，越小越快）
  const fireInterval = Number((1.5 - df * 0.8).toFixed(2));

  // 颜色从调色板随机选
  const color = pick(rng, PATTERN_COLOR_PALETTE);

  const params: ThunderProceduralPatternParams = {
    id: "",
    name: "",
    basePattern,
    bulletCount,
    bulletSpeed,
    fireInterval,
    color,
    difficultyFactor: df,
  };

  // ===== 各 pattern 专属参数 =====
  switch (basePattern) {
    case "spread":
      // 扇形角度：0.5..1.5 弧度（约 28°..86°）
      params.spreadAngle = Number((0.5 + df * 1.0).toFixed(2));
      break;
    case "spiral":
      // 螺旋圈数 2..6，方向随机
      params.spiralTurns = 2 + Math.floor(df * 4);
      params.spiralDir = rng() < 0.5 ? 1 : -1;
      break;
    case "ringBurst":
      // 环形半径 80..160，环形需要更多子弹
      params.ringRadius = Math.round(80 + df * 80);
      params.bulletCount = Math.round(bulletCount * 1.5);
      break;
    case "homing":
      // 追踪弹：开启追踪，强度 0.2..0.6；数量略少以保持平衡
      params.homing = true;
      params.homingStrength = Number((0.2 + df * 0.4).toFixed(2));
      params.bulletCount = Math.max(4, Math.round(bulletCount * 0.6));
      break;
    case "rain":
      // 区域弹雨：子弹更多、速度略低
      params.bulletCount = Math.round(bulletCount * 1.4);
      params.bulletSpeed = Math.round(bulletSpeed * 0.85);
      break;
    case "beam":
      // 集束光束：子弹少但速度高
      params.bulletCount = Math.max(3, Math.round(bulletCount * 0.5));
      params.bulletSpeed = Math.round(bulletSpeed * 1.3);
      break;
    case "summon":
      // 召唤小怪：子弹极少
      params.bulletCount = Math.max(2, Math.round(bulletCount * 0.3));
      break;
    case "laserSweep":
      // 激光扫射：中等数量
      params.bulletCount = Math.round(bulletCount * 0.8);
      break;
    case "crossFire":
      // 交叉火力：子弹多
      params.bulletCount = Math.round(bulletCount * 1.3);
      break;
    case "waveDash":
      // 波浪冲刺：中等
      params.bulletCount = Math.round(bulletCount * 1.0);
      break;
  }

  // ===== 生成 ID 与名称 =====
  // ID 形如 "PROC-spread-001"，序号基于 rng
  const seq = String(Math.floor(rng() * 999) + 1).padStart(3, "0");
  params.id = `PROC-${basePattern}-${seq}`;
  params.name = `${PATTERN_NAME_MAP[basePattern]}·Lv${level}`;

  return params;
}

/**
 * 生成多个模式序列
 * @param rng 随机数生成器
 * @param count 序列长度
 * @param difficultyFactor 难度系数 0..1
 */
export function generatePatternSequence(
  rng: () => number,
  count: number,
  difficultyFactor: number,
): ThunderProceduralPatternParams[] {
  const out: ThunderProceduralPatternParams[] = [];
  for (let i = 0; i < Math.max(0, count); i++) {
    out.push(generateProceduralPattern(rng, difficultyFactor, 1));
  }
  return out;
}

/**
 * 计算单个模式难度评分 0..1
 * 综合子弹数量、速度、发射间隔，追踪弹额外加分
 */
export function getPatternDifficulty(pattern: ThunderProceduralPatternParams): number {
  // 归一化各参数：
  // bulletCount 0..24 → 0..1
  const countScore = clampNum(pattern.bulletCount / 24, 0, 1);
  // bulletSpeed 100..260 → 0..1
  const speedScore = clampNum((pattern.bulletSpeed - 100) / 160, 0, 1);
  // fireInterval 0.6..1.6 → 0..1（越小越难 → 越高）
  const intervalScore = clampNum((1.6 - pattern.fireInterval) / 1.0, 0, 1);
  // 追踪弹额外难度
  const homingBonus = pattern.homing ? 0.1 : 0;
  // 加权平均：数量 0.4 / 速度 0.3 / 间隔 0.3
  const score = countScore * 0.4 + speedScore * 0.3 + intervalScore * 0.3 + homingBonus;
  return clampNum(score, 0, 1);
}

/**
 * 组合模式总难度：平均值 + 叠加惩罚
 * 每多一个叠加模式，玩家认知负荷增加，总难度 +0.05
 */
export function combinedPatternDifficulty(patterns: ThunderProceduralPatternParams[]): number {
  if (patterns.length === 0) return 0;
  const sum = patterns.reduce((s, p) => s + getPatternDifficulty(p), 0);
  const avg = sum / patterns.length;
  // 叠加惩罚：每多一个模式 +0.05
  const penalty = (patterns.length - 1) * 0.05;
  return clampNum(avg + penalty, 0, 1);
}

/**
 * 根据 BOSS 当前 HP 比例选择弹幕（HP 越低难度越高）
 * @param rng 随机数生成器
 * @param hpRatio BOSS 当前 HP 比例 0..1
 * @param difficultyFactor 基础难度系数 0..1
 */
export function pickPatternForBossHp(
  rng: () => number,
  hpRatio: number,
  difficultyFactor: number,
): ThunderProceduralPatternParams {
  // hpRatio 1..0，HP 越低难度越高
  // 有效难度 = 基础难度 + (1 - hpRatio) * 0.3，上限 1
  const hpBoost = (1 - clampNum(hpRatio, 0, 1)) * 0.3;
  const effDifficulty = clampNum(difficultyFactor + hpBoost, 0, 1);
  return generateProceduralPattern(rng, effDifficulty, hpRatio);
}

// ===== procedural.ts · v7 程序化弹幕生成模块结束 =====
