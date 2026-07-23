import type { EnemyTypeDef, PowerupDef, WaveEntry, PowerupKind, Title, BossDef, WeaponLevel, WeaponBranch, WeaponBranchDef } from "./types";

/** 荣誉称号体系：随积分逐级晋升 */
export const TITLES: Title[] = [
  { id: "recruit",   name: "反诈新兵",   minScore: 0,     color: "#7A8FB0" },
  { id: "guardian",  name: "反诈卫士",   minScore: 500,   color: "#52C41A" },
  { id: "vanguard",  name: "反诈先锋",   minScore: 1500,  color: "#00E5FF" },
  { id: "warrior",   name: "反诈勇士",   minScore: 3000,  color: "#3B7FEF" },
  { id: "knight",    name: "反诈骑士",   minScore: 5000,  color: "#FFD666" },
  { id: "general",   name: "反诈将领",   minScore: 8000,  color: "#FF7A1A" },
  { id: "commander", name: "反诈统帅",   minScore: 12000, color: "#B388FF" },
  { id: "legend",    name: "反诈传奇",   minScore: 18000, color: "#FF5A60" },
  { id: "demigod",   name: "反诈神将",   minScore: 28000, color: "#FF00E5" },
];

/** 取当前称号与下一档缺口 */
export function titleFor(score: number): { title: Title; next?: Title; gap: number } {
  let cur = TITLES[0];
  let next: Title | undefined;
  for (let i = 0; i < TITLES.length; i++) {
    if (score >= TITLES[i].minScore) {
      cur = TITLES[i];
      next = TITLES[i + 1];
    }
  }
  const gap = next ? Math.max(0, next.minScore - score) : 0;
  return { title: cur, next, gap };
}

/** 敌方形象命名贴合电信诈骗套路 */
export const ENEMIES: Record<string, EnemyTypeDef> = {
  script: {
    id: "script",
    name: "杀猪盘话术",
    emoji: "💬",
    hp: 20,
    speed: 120,
    score: 60,
    color: "#9FE3FF",
    fraudType: "杀猪盘诈骗",
    pattern: "straight",
    dropRate: 0.18,
  },
  fakecs: {
    id: "fakecs",
    name: "冒充客服",
    emoji: "🎧",
    hp: 35,
    speed: 90,
    score: 100,
    color: "#FFB020",
    fraudType: "冒充客服诈骗",
    pattern: "zigzag",
    dropRate: 0.22,
  },
  threat: {
    id: "threat",
    name: "冒充公检法",
    emoji: "📜",
    hp: 60,
    speed: 60,
    score: 160,
    color: "#E5353B",
    fraudType: "冒充公检法诈骗",
    pattern: "shooter",
    shootInterval: 1.8,
    dropRate: 0.3,
  },
  phishmine: {
    id: "phishmine",
    name: "钓鱼链接",
    emoji: "🎣",
    hp: 40,
    speed: 70,
    score: 140,
    color: "#1AD670",
    fraudType: "钓鱼网站诈骗",
    pattern: "miner",
    shootInterval: 2.4,
    dropRate: 0.25,
  },
  brushing: {
    id: "brushing",
    name: "刷单返利",
    emoji: "💰",
    hp: 16,
    speed: 150,
    score: 90,
    color: "#FFD666",
    fraudType: "刷单返利诈骗",
    pattern: "straight",
    dropRate: 0.16,
  },
  invest: {
    id: "invest",
    name: "虚假投资",
    emoji: "📈",
    hp: 55,
    speed: 78,
    score: 170,
    color: "#B388FF",
    fraudType: "虚假投资理财诈骗",
    pattern: "zigzag",
    shootInterval: 2.6,
    dropRate: 0.26,
  },
  pie: {
    id: "pie",
    name: "天上掉馅饼",
    emoji: "🥞",
    hp: 14,
    speed: 165,
    score: 80,
    color: "#FFC53D",
    fraudType: "虚假福利诈骗",
    pattern: "straight",
    dropRate: 0.15,
  },
  phonebrush: {
    id: "phonebrush",
    name: "刷单返利好赚钱",
    emoji: "📱",
    hp: 24,
    speed: 130,
    score: 110,
    color: "#FF7AB8",
    fraudType: "刷单返利诈骗",
    pattern: "zigzag",
    dropRate: 0.2,
  },
  bitcoin: {
    id: "bitcoin",
    name: "跑分洗钱来钱快",
    emoji: "🪙",
    hp: 48,
    speed: 65,
    score: 200,
    color: "#F7931A",
    fraudType: "跑分洗钱诈骗",
    pattern: "miner",
    shootInterval: 2.2,
    dropRate: 0.28,
  },
  guarantee: {
    id: "guarantee",
    name: "百万保障没取消要扣费",
    emoji: "📋",
    hp: 70,
    speed: 55,
    score: 220,
    color: "#FF4D4F",
    fraudType: "虚假百万保障诈骗",
    pattern: "shooter",
    shootInterval: 1.6,
    dropRate: 0.32,
  },
  pigboy: {
    id: "pigboy",
    name: "完美“男友教我理财”",
    emoji: "🐷",
    hp: 90,
    speed: 72,
    score: 280,
    color: "#FF85C0",
    fraudType: "杀猪盘诈骗",
    pattern: "zigzag",
    shootInterval: 2.0,
    dropRate: 0.34,
  },
  /** 精英敌人：AI 换脸伪警（新增），带护盾 */
  deepfake: {
    id: "deepfake",
    name: "AI换脸伪警",
    emoji: "🤖",
    hp: 60,
    shield: 50,
    speed: 50,
    score: 320,
    color: "#9D4EDD",
    fraudType: "AI换脸诈骗",
    pattern: "shooter",
    shootInterval: 1.4,
    dropRate: 0.42,
    elite: true,
  },
  /** 精英敌人：虚假中奖链接（新增），高血量带护盾 */
  fakeLottery: {
    id: "fakeLottery",
    name: "虚假中奖通知",
    emoji: "🎰",
    hp: 50,
    shield: 40,
    speed: 88,
    score: 260,
    color: "#FF006E",
    fraudType: "虚假中奖诈骗",
    pattern: "zigzag",
    shootInterval: 2.2,
    dropRate: 0.38,
    elite: true,
  },
};

export const WAVES: WaveEntry[][] = [
  // Wave 1
  [
    { typeId: "script", count: 6, interval: 0.8, delay: 0 },
    { typeId: "fakecs", count: 3, interval: 1.4, delay: 3 },
    { typeId: "pie", count: 4, interval: 0.6, delay: 5 },
  ],
  // Wave 2
  [
    { typeId: "brushing", count: 5, interval: 0.6, delay: 0 },
    { typeId: "phishmine", count: 3, interval: 1.3, delay: 2 },
    { typeId: "fakecs", count: 4, interval: 1.0, delay: 5 },
    { typeId: "phonebrush", count: 4, interval: 0.7, delay: 7 },
  ],
  // Wave 3
  [
    { typeId: "fakecs", count: 4, interval: 0.9, delay: 0 },
    { typeId: "threat", count: 3, interval: 1.4, delay: 2 },
    { typeId: "invest", count: 3, interval: 1.2, delay: 4 },
    { typeId: "script", count: 6, interval: 0.6, delay: 6 },
    { typeId: "pie", count: 6, interval: 0.4, delay: 8 },
  ],
  // Wave 4（随机BOSS前哨，引入精英敌人）
  [
    { typeId: "brushing", count: 8, interval: 0.5, delay: 0 },
    { typeId: "threat", count: 4, interval: 1.1, delay: 3 },
    { typeId: "deepfake", count: 2, interval: 2.0, delay: 4 },
    { typeId: "invest", count: 4, interval: 1.0, delay: 5 },
    { typeId: "phishmine", count: 4, interval: 0.9, delay: 7 },
    { typeId: "bitcoin", count: 4, interval: 1.0, delay: 9 },
  ],
  // Wave 5（随机BOSS战）
  [
    { typeId: "script", count: 6, interval: 0.7, delay: 0 },
    { typeId: "fakecs", count: 4, interval: 1.0, delay: 3 },
    { typeId: "guarantee", count: 3, interval: 1.2, delay: 5 },
    { typeId: "fakeLottery", count: 2, interval: 1.8, delay: 6 },
    { typeId: "phonebrush", count: 5, interval: 0.6, delay: 7 },
  ],
  // Wave 6（终极BOSS前哨，精英云集）
  [
    { typeId: "brushing", count: 10, interval: 0.4, delay: 0 },
    { typeId: "threat", count: 5, interval: 0.9, delay: 3 },
    { typeId: "deepfake", count: 3, interval: 1.6, delay: 4 },
    { typeId: "invest", count: 5, interval: 0.8, delay: 5 },
    { typeId: "phishmine", count: 5, interval: 0.7, delay: 7 },
    { typeId: "pigboy", count: 4, interval: 1.0, delay: 9 },
    { typeId: "fakeLottery", count: 3, interval: 1.2, delay: 10 },
    { typeId: "guarantee", count: 3, interval: 1.1, delay: 11 },
  ],
  // Wave 7（终极BOSS击败后继续，新增）
  [
    { typeId: "script", count: 8, interval: 0.5, delay: 0 },
    { typeId: "fakecs", count: 5, interval: 0.8, delay: 3 },
    { typeId: "threat", count: 4, interval: 1.0, delay: 5 },
    { typeId: "deepfake", count: 3, interval: 1.5, delay: 7 },
  ],
  // Wave 8（新增）
  [
    { typeId: "brushing", count: 10, interval: 0.4, delay: 0 },
    { typeId: "invest", count: 5, interval: 0.9, delay: 3 },
    { typeId: "guarantee", count: 4, interval: 1.0, delay: 5 },
    { typeId: "fakeLottery", count: 3, interval: 1.4, delay: 7 },
  ],
  // Wave 9（新增）
  [
    { typeId: "phonebrush", count: 8, interval: 0.5, delay: 0 },
    { typeId: "pigboy", count: 4, interval: 1.2, delay: 3 },
    { typeId: "bitcoin", count: 5, interval: 0.8, delay: 5 },
    { typeId: "deepfake", count: 4, interval: 1.0, delay: 7 },
    { typeId: "fakeLottery", count: 3, interval: 1.3, delay: 9 },
  ],
  // Wave 10（BOSS 战，新增）
  [
    { typeId: "script", count: 6, interval: 0.6, delay: 0 },
    { typeId: "threat", count: 4, interval: 1.0, delay: 3 },
  ],
];

/** 随机 BOSS 池：Wave 4 结束后随机选一个 */
export const RANDOM_BOSSES: BossDef[] = [
  {
    id: "pigkiller",
    name: "杀猪盘操盘手",
    emoji: "🐷",
    hp: 800,
    color: "#FF7AB8",
    fraudType: "杀猪盘诈骗",
    patterns: ["spread", "homing", "summon"],
    speedMul: 1.2,
    summonType: "brushing",
    shape: "skull",
    identify: [
      "「稳赚不赔」是杀猪盘核心话术",
      "提现要交「解冻金」「税费」=100% 诈骗",
      "优质异性主动带投资+保密 = 杀猪盘",
    ],
  },
  {
    id: "fakecop",
    name: "冒充公检法师",
    emoji: "📜",
    hp: 900,
    color: "#E5353B",
    fraudType: "冒充公检法诈骗",
    patterns: ["beam", "spread", "summon", "laserSweep"],
    speedMul: 0.9,
    summonType: "threat",
    shape: "hex",
    identify: [
      "公检法不会电话办案，更无「安全账户」",
      "AI换脸可伪造警官形象，挂断拨打 96110",
      "要求屏幕共享、下载APP的全部是假冒",
    ],
  },
  {
    id: "fakeservice",
    name: "冒充客服头目",
    emoji: "🎧",
    hp: 700,
    color: "#FFB020",
    fraudType: "冒充客服诈骗",
    patterns: ["spiral", "rain", "homing"],
    speedMul: 1.4,
    summonType: "fakecs",
    shape: "eye",
    identify: [
      "客服不会要求共享屏幕",
      "验证码即密码，索要验证码的全是诈骗",
      "「影响征信」是恐吓，官方渠道核实",
    ],
  },
  {
    id: "falseinvest",
    name: "虚假投资操盘手",
    emoji: "📈",
    hp: 850,
    color: "#B388FF",
    fraudType: "虚假投资理财诈骗",
    patterns: ["spiral", "beam", "summon"],
    speedMul: 1.0,
    summonType: "invest",
    shape: "tower",
    identify: [
      "「内幕+稳收益+晒盈利」是虚假投资三件套",
      "「日化5%」远超正常理财，是资金盘",
      "非正规渠道入金 = 诈骗",
    ],
  },
];

/** 终极 BOSS：Wave 6 结束后固定出现 */
export const ULTIMATE_BOSS: BossDef = {
  id: "kingpin",
  name: "跨境电诈集团首脑",
  emoji: "🕴",
  hp: 1600,
  color: "#FF00E5",
  fraudType: "跨境电信诈骗集团",
  patterns: ["spiral", "rain", "beam", "homing", "summon", "laserSweep"],
  speedMul: 1.1,
  summonType: "threat",
  shape: "crown",
  ultimate: true,
  identify: [
    "真警察绝不会电话要求转账到「安全账户」",
    "公检法不会通过 QQ/微信发送「逮捕令」",
    "要求视频讯问、屏幕共享的都是假冒",
    "凡是要验证码、密码的全部是诈骗",
    "96110 是全国反诈专线，来电务必接听",
  ],
};

/** 兼容旧引用 */
export const BOSS = ULTIMATE_BOSS;

/** 随机选取一个非终极 BOSS */
export function pickRandomBoss(): BossDef {
  return RANDOM_BOSSES[Math.floor(Math.random() * RANDOM_BOSSES.length)];
}

/** 反诈道具（强力工具效果） */
export const POWERUPS: Record<PowerupKind, PowerupDef> = {
  weapon: { kind: "weapon", emoji: "⚡", color: "#FFD666", label: "火力升级", desc: "火力 +1（最高 4 级）" },
  antifraudApp: { kind: "antifraudApp", emoji: "🛡", color: "#00E5FF", label: "国家反诈APP", desc: "盾牌护盾，可吸收 3 次伤害" },
  blockOverseas: { kind: "blockOverseas", emoji: "📵", color: "#3B7FEF", label: "不接境外来电", desc: "5 秒内免疫所有敌方弹幕" },
  policeRaid: { kind: "policeRaid", emoji: "🚔", color: "#FF7A1A", label: "公安反诈突击", desc: "全屏清场 + 重创所有敌方" },
  smsFirewall: { kind: "smsFirewall", emoji: "🧱", color: "#52C41A", label: "短信防火墙", desc: "摧毁敌方子弹并反击伤害" },
  evidenceLock: { kind: "evidenceLock", emoji: "📸", color: "#B388FF", label: "证据固定", desc: "冻结全场敌方 3 秒" },
  fraudAwareness: { kind: "fraudAwareness", emoji: "🧠", color: "#FF5A60", label: "反诈意识觉醒", desc: "6 秒火力顶档 + 双倍伤害" },
  lifePack: { kind: "lifePack", emoji: "❤", color: "#E5353B", label: "生命补给", desc: "回复 8 点生命值" },
  phish: { kind: "phish", emoji: "🎣", color: "#1AD670", label: "钓鱼链接", desc: "陷阱！武器降级", trap: true },
  hotline96110: { kind: "hotline96110", emoji: "📞", color: "#00E5FF", label: "96110反诈热线", desc: "3 秒全屏净化弹幕+锁定最强敌人" },
  bankFreeze: { kind: "bankFreeze", emoji: "🏦", color: "#FFD666", label: "银行紧急止付", desc: "5 秒敌方伤害减半+持续扣血" },
  awarenessAd: { kind: "awarenessAd", emoji: "📢", color: "#52C41A", label: "反诈宣传员", desc: "8 秒连击不掉+自动拾取道具" },
  timeSlow: { kind: "timeSlow", emoji: "⏱", color: "#9D4EDD", label: "时间减速", desc: "3 秒内敌方/弹幕全部减速 70%" },
};

/** 武器经验系统（新增）：每级所需 XP 与伤害加成 */
export const WEAPON_XP_TABLE: Record<WeaponLevel, { xpMax: number; dmgBonus: number }> = {
  1: { xpMax: 30, dmgBonus: 0 },
  2: { xpMax: 60, dmgBonus: 4 },
  3: { xpMax: 100, dmgBonus: 8 },
  4: { xpMax: 0, dmgBonus: 14 }, // 已满级
};

/** 武器分支定义（新增）：3 条升级路线
 * - spread 散射：3 向散射，覆盖广，单发伤害低
 * - laser 激光：穿透光束，高伤害，覆盖窄
 * - homing 追踪：追踪导弹，中伤害，自动锁敌
 * 每个分支可升级 3 级
 */
export const WEAPON_BRANCHES: Record<Exclude<WeaponBranch, "normal">, WeaponBranchDef> = {
  spread: {
    id: "spread",
    name: "散射",
    emoji: "🔱",
    color: "#FFB020",
    desc: "3 向散射，覆盖广，单发伤害低",
  },
  laser: {
    id: "laser",
    name: "激光",
    emoji: "🔦",
    color: "#FF00E5",
    desc: "穿透光束，高伤害，覆盖窄",
  },
  homing: {
    id: "homing",
    name: "追踪",
    emoji: "🎯",
    color: "#52C41A",
    desc: "追踪导弹，中伤害，自动锁敌",
  },
};

/** 击杀获得武器经验值（按敌人 score 比例） */
export function weaponXpForKill(enemyScore: number): number {
  return Math.max(1, Math.round(enemyScore / 30));
}

/** 成就定义（新增）：里程碑触发 */
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  /** 触发条件：函数判断 */
  check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  bustedCount: number;
  maxCombo: number;
  bossesDefeated: number;
  wave: number;
  hp: number;
  maxHp: number;
  score: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_blood", name: "首战告捷", desc: "击破首个诈骗分子", emoji: "🩸", check: (s) => s.bustedCount >= 1 },
  { id: "combo_10", name: "连击高手", desc: "达成 10 连击", emoji: "🔥", check: (s) => s.maxCombo >= 10 },
  { id: "combo_25", name: "连击大师", desc: "达成 25 连击", emoji: "⚡", check: (s) => s.maxCombo >= 25 },
  { id: "kill_50", name: "反诈先锋", desc: "识破 50 名诈骗分子", emoji: "🛡", check: (s) => s.bustedCount >= 50 },
  { id: "kill_100", name: "反诈精英", desc: "识破 100 名诈骗分子", emoji: "🎯", check: (s) => s.bustedCount >= 100 },
  { id: "boss_slayer", name: "BOSS终结者", desc: "击败一个 BOSS", emoji: "👑", check: (s) => s.bossesDefeated >= 1 },
  { id: "flawless_wave", name: "无伤通关", desc: "满血通过一波", emoji: "💎", check: (s) => s.wave >= 2 && s.hp >= s.maxHp },
  { id: "score_10k", name: "万分达人", desc: "单局获得 10000 分", emoji: "💰", check: (s) => s.score >= 10000 },
];
