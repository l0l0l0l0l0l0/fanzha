import type { EnemyTypeDef, PowerupDef, WaveEntry, PowerupKind, Title, BossDef, WeaponLevel, WeaponBranch, WeaponBranchDef } from "./types";
import type {
  Difficulty,
  DifficultyConfig,
  ThunderMode,
  ThunderTheme,
  ThunderThemeDef,
  RoguelikeBuffKind,
  RoguelikeBuffDef,
  CharacterId,
  CharacterDef,
  EquipSlot,
  EquipRarity,
  EquipmentDef,
  WeaponAwakeningDef,
  WeaponBranchLevel,
} from "./types";

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
    caseStory: "王女士在交友软件结识「外籍军官」，对方以「内部漏洞稳赚」诱导其向虚假平台转账 87 万元，提现时被要求缴纳「解冻金」方知受骗。",
    identifyDetail: [
      "「稳赚不赔」「内部漏洞」是杀猪盘核心话术",
      "提现要求交「解冻金」「税费」「保证金」=100% 诈骗",
      "优质异性主动加好友 + 带投资 + 要求保密 = 杀猪盘三件套",
    ],
    protectList: [
      "任何「稳收益」投资平台先在国家反诈APP核实",
      "提现要交钱的平台立即停止操作并保留证据",
      "拨打 96110 或前往辖区派出所咨询",
    ],
    targetGroup: "单身青年 / 大龄未婚 / 离异人士",
    codexId: "pig-butcher",
    entranceTitle: "PIG BUTCHER",
    entranceWarning: "「稳赚不赔」的完美男友，正在等你入圈",
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
    caseStory: "李阿姨接到「+86 区号」来电，对方自称市公安局，称其涉嫌洗钱需配合调查，通过屏幕共享转走其账户 53 万元。",
    identifyDetail: [
      "公检法不会通过电话、QQ、微信办案",
      "不存在所谓的「安全账户」，要求转账即诈骗",
      "AI 换脸可伪造警官形象，视频讯问均为假冒",
    ],
    protectList: [
      "立即挂断电话，自行拨打 110 或 96110 核实",
      "拒绝屏幕共享、拒绝下载未知 APP",
      "任何要求转账到「安全账户」的均是诈骗",
    ],
    targetGroup: "中老年人 / 退休人员 / 在校学生",
    codexId: "fake-police",
    entranceTitle: "FAKE AUTHORITY",
    entranceWarning: "「涉嫌洗钱需配合调查」—— 假警察的恐吓话术",
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
    caseStory: "张先生接到「+86 95XXX」来电，对方自称某电商客服，称其订单有质量问题需办理「理赔」，诱导其开启屏幕共享后转走 12 万元。",
    identifyDetail: [
      "正规客服不会要求开启屏幕共享",
      "验证码 = 密码，任何索要验证码的都是诈骗",
      "「影响征信」「自动扣费」是恐吓话术",
    ],
    protectList: [
      "挂断电话，通过官方 APP / 官网核实订单",
      "拒绝共享屏幕，拒绝下载会议类 APP",
      "验证码绝不告知任何人",
    ],
    targetGroup: "网购用户 / 宝妈 / 上班族",
    codexId: "fake-cs",
    entranceTitle: "FAKE SUPPORT",
    entranceWarning: "「您的订单有质量问题」—— 假客服的理赔陷阱",
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
    caseStory: "陈先生被拉入「内部投资群」，群内每日晒盈利，他向「导师」提供的虚假平台入金 35 万元，平台随后无法登录。",
    identifyDetail: [
      "「内幕消息 + 稳定收益 + 晒盈利截图」是虚假投资三件套",
      "「日化 5%」远超正常理财，必是资金盘",
      "非正规渠道入金、提现需交钱的 = 诈骗",
    ],
    protectList: [
      "理财只在持牌金融机构官方渠道操作",
      "警惕「导师带单」「内部群」",
      "高收益必有高风险，「保本高息」是骗局",
    ],
    targetGroup: "中产白领 / 投资新手 / 退休人员",
    codexId: "fake-invest",
    entranceTitle: "FAKE INVESTMENT",
    entranceWarning: "「日化 5% 稳赚不赔」—— 资金盘的暴利话术",
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
  caseStory: "跨境电诈集团通过精准信息实施「杀猪盘 + 冒充公检法 + 虚假投资」复合诈骗，单案涉案金额超千万元，受害人遍布全国。",
  identifyDetail: [
    "真警察绝不会电话要求转账到「安全账户」",
    "公检法不会通过 QQ/微信发送「逮捕令」「通缉令」",
    "要求视频讯问、屏幕共享的都是假冒",
    "凡是要验证码、密码、短信的全部是诈骗",
    "96110 是全国反诈专线，来电务必接听",
  ],
  protectList: [
    "下载国家反诈中心 APP 并开启预警",
    "96110 来电必须接听，可能是劝阻电话",
    "不轻信陌生来电，不点击未知链接",
    "个人信息、验证码、密码绝不外泄",
    "遭遇诈骗立即拨打 110 报警并保留证据",
  ],
  targetGroup: "全人群（高发于 18-60 岁）",
  codexId: "cross-border-syndicate",
  entranceTitle: "THE KINGPIN",
  entranceWarning: "跨境电诈集团首脑登场 — 全民反诈，终极对决",
};

/** 兼容旧引用 */
export const BOSS = ULTIMATE_BOSS;

/** 随机选取一个非终极 BOSS */
export function pickRandomBoss(rng: () => number = Math.random): BossDef {
  return RANDOM_BOSSES[Math.floor(rng() * RANDOM_BOSSES.length)];
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

// ===========================================================================
// ===== v2 全面升级数据 ====================================================
// ===========================================================================

/** 难度配置表（A2 难度系统） */
export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  normal: {
    id: "normal",
    name: "普通",
    desc: "标准难度，适合新手熟悉反诈套路",
    color: "#52C41A",
    enemyHpMul: 1.0,
    enemySpeedMul: 1.0,
    enemyFireMul: 1.0,
    dropMul: 1.0,
    bossHpMul: 1.0,
    playerHpMul: 1.0,
    scoreMul: 1.0,
    ultChargeMul: 1.0,
  },
  hard: {
    id: "hard",
    name: "困难",
    desc: "敌人更强、掉落更少，适合反诈老兵",
    color: "#FFB020",
    enemyHpMul: 1.4,
    enemySpeedMul: 1.15,
    enemyFireMul: 0.8,
    dropMul: 0.85,
    bossHpMul: 1.3,
    playerHpMul: 0.89, // 32 HP
    scoreMul: 1.5,
    ultChargeMul: 0.9,
  },
  nightmare: {
    id: "nightmare",
    name: "噩梦",
    desc: "电诈集团全火力，仅推荐反诈精英挑战",
    color: "#FF00E5",
    enemyHpMul: 1.85,
    enemySpeedMul: 1.3,
    enemyFireMul: 0.65,
    dropMul: 0.7,
    bossHpMul: 1.7,
    playerHpMul: 0.78, // 28 HP
    scoreMul: 2.2,
    ultChargeMul: 0.8,
  },
};

/** 难度列表（顺序） */
export const DIFFICULTY_LIST: DifficultyConfig[] = [
  DIFFICULTIES.normal,
  DIFFICULTIES.hard,
  DIFFICULTIES.nightmare,
];

/** 关卡主题配置（C3 关卡主题切换） */
export const THUNDER_THEMES: ThunderThemeDef[] = [
  {
    id: "city",
    name: "城市夜空",
    desc: "都市反诈第一线",
    bgColor: "#070E1F",
    gridColor: "rgba(0,229,255,0.05)",
    nebulaColors: ["157,78,221", "0,229,255", "59,127,239"],
    startWave: 1,
    emoji: "🌃",
  },
  {
    id: "border",
    name: "边境口岸",
    desc: "拦截跨境电诈",
    bgColor: "#0E1A0E",
    gridColor: "rgba(82,196,26,0.06)",
    nebulaColors: ["82,196,26", "255,176,32", "60,180,75"],
    startWave: 3,
    emoji: "🛡",
  },
  {
    id: "cyber",
    name: "网络空间",
    desc: "追击 AI 换脸伪警",
    bgColor: "#1A0820",
    gridColor: "rgba(255,0,229,0.06)",
    nebulaColors: ["255,0,229", "157,78,221", "255,90,96"],
    startWave: 5,
    emoji: "🌐",
  },
  {
    id: "overseas",
    name: "境外园区",
    desc: "直捣电诈集团总部",
    bgColor: "#1F0A0A",
    gridColor: "rgba(229,53,59,0.07)",
    nebulaColors: ["229,53,59", "255,122,26", "255,0,229"],
    startWave: 7,
    emoji: "🏢",
  },
];

/** 根据波次获取主题 */
export function themeForWave(waveIdx: number): ThunderThemeDef {
  // waveIdx 是 0-based
  let theme = THUNDER_THEMES[0];
  for (const t of THUNDER_THEMES) {
    if (waveIdx + 1 >= t.startWave) theme = t;
  }
  return theme;
}

/** Roguelike Buff 定义表（A3） */
export const ROGUELIKE_BUFFS: Record<RoguelikeBuffKind, RoguelikeBuffDef> = {
  critUp:       { kind: "critUp",       name: "识破之眼",   emoji: "🎯", color: "#FF00E5", desc: "暴击率 +15%（暴击 2 倍伤害）",            rarity: "rare",  stackable: true,  maxStack: 3 },
  pierceUp:     { kind: "pierceUp",     name: "穿透弹头",   emoji: "➡",  color: "#00E5FF", desc: "子弹穿透 +1 个敌人",                      rarity: "rare",  stackable: true,  maxStack: 2 },
  lifesteal:    { kind: "lifesteal",    name: "反诈回血",   emoji: "❤",  color: "#E5353B", desc: "吸血 8%（每次命中回 1 HP）",              rarity: "epic",  stackable: true,  maxStack: 3 },
  chainLight:   { kind: "chainLight",   name: "连锁识破",   emoji: "⚡",  color: "#FFD666", desc: "命中后跳到附近敌人（最多 2 跳）",        rarity: "epic",  stackable: true,  maxStack: 2 },
  multiShot:    { kind: "multiShot",    name: "多发齐射",   emoji: "🔱",  color: "#FFB020", desc: "同时多发 +1 颗子弹",                      rarity: "common",stackable: true,  maxStack: 3 },
  damageUp:     { kind: "damageUp",     name: "火力强化",   emoji: "💥",  color: "#FF7A1A", desc: "伤害 +20%",                               rarity: "common",stackable: true,  maxStack: 4 },
  fireRateUp:   { kind: "fireRateUp",   name: "射速提升",   emoji: "🔄",  color: "#3B7FEF", desc: "射速 +20%",                               rarity: "common",stackable: true,  maxStack: 3 },
  moveSpeedUp:  { kind: "moveSpeedUp",  name: "机动强化",   emoji: "👟",  color: "#52C41A", desc: "移速 +15%",                               rarity: "common",stackable: true,  maxStack: 3 },
  shieldRegen:  { kind: "shieldRegen",  name: "护盾再生",   emoji: "🛡",  color: "#00E5FF", desc: "反诈APP护盾每 10 秒恢复 1 层",            rarity: "rare",  stackable: true,  maxStack: 2 },
  scoreBoost:   { kind: "scoreBoost",   name: "积分加成",   emoji: "💰",  color: "#FFD666", desc: "分数 +25%",                               rarity: "common",stackable: true,  maxStack: 3 },
  ultBoost:     { kind: "ultBoost",     name: "审判充能",   emoji: "⚖",  color: "#FF00E5", desc: "大招充能速度 +30%",                       rarity: "rare",  stackable: true,  maxStack: 2 },
  thorns:       { kind: "thorns",       name: "反伤护甲",   emoji: "🌵",  color: "#52C41A", desc: "受击时反伤 30%",                          rarity: "rare",  stackable: true,  maxStack: 3 },
  dropBoost:    { kind: "dropBoost",    name: "战利品+ ",   emoji: "🎁",  color: "#B388FF", desc: "道具掉落率 +30%",                         rarity: "common",stackable: true,  maxStack: 2 },
  healOnBoss:   { kind: "healOnBoss",   name: "BOSS战回血", emoji: "✨",  color: "#1AD670", desc: "BOSS 战中每秒回 1 HP",                    rarity: "epic",  stackable: false },
  comboShield:  { kind: "comboShield",  name: "连击守护",   emoji: "🔗",  color: "#FF7AB8", desc: "连击不会因受击而中断",                    rarity: "rare",  stackable: false },
};

/** 按 rarity 分组的 buff 池（用于随机抽取） */
export const ROGUELIKE_POOL_BY_RARITY: Record<RoguelikeBuffDef["rarity"], RoguelikeBuffKind[]> = {
  common: ["multiShot", "damageUp", "fireRateUp", "moveSpeedUp", "scoreBoost", "dropBoost"],
  rare:  ["critUp", "pierceUp", "shieldRegen", "ultBoost", "thorns", "comboShield"],
  epic:  ["lifesteal", "chainLight", "healOnBoss"],
};

/** Roguelike 抽取权重（common 60%, rare 30%, epic 10%） */
export const ROGUELIKE_RARITY_WEIGHTS: Record<RoguelikeBuffDef["rarity"], number> = {
  common: 0.6,
  rare: 0.3,
  epic: 0.1,
};

/** 大招配置（A5 雷霆审判） */
export const ULTIMATE_MAX_CHARGE = 100;
export const ULTIMATE_DURATION = 4;          // 持续 4 秒
export const ULTIMATE_DPS = 80;              // 每秒伤害
export const ULTIMATE_CHARGE_PER_DAMAGE = 0.4; // 玩家每点伤害产生 0.4 充能

/** 蓄力射击配置（A4） */
export const CHARGE_FULL_TIME = 1.2;         // 蓄满需 1.2 秒
export const CHARGE_MIN_TIME = 0.3;          // 最小蓄力时间
export const CHARGE_DMG_MULTIPLIER = 3.0;    // 蓄满伤害倍率
export const CHARGE_RADIUS = 80;             // 蓄满爆炸半径

/** 闪避冲刺配置（A4） */
export const DASH_DISTANCE = 180;            // 冲刺距离（像素）
export const DASH_DURATION = 0.2;            // 冲刺持续秒数
export const DASH_CD = 1.5;                  // 冷却秒数
export const DASH_INVINCIBLE = 0.3;          // 无敌秒数

/** 本地存档键（D1） */
export const THUNDER_SAVE_KEY = "thunder_save_v2";

/** 默认存档 */
export function defaultThunderSave(): import("./types").ThunderSaveData {
  return {
    bestScore: 0,
    bestCombo: 0,
    bestEndlessWave: 0,
    defeatedBosses: [],
    totalBossKills: 0,
    totalBusted: 0,
    totalPlayTime: 0,
    unlockedBranches: [],
    // v3 升级
    unlockedCharacters: ["swat"],
    equippedCharacter: "swat",
    ownedEquipments: [],
    equippedEquipments: {},
    awakenedBranches: [],
    characterUsage: {},
    fraudKills: {},
  };
}

/**
 * 读取存档快照（v3 新增）：用于引擎创建前的 UI 展示（角色解锁状态、已装备配件等）
 * 与 ThunderEngine.loadSave 逻辑保持一致
 */
export function loadThunderSaveSnapshot(): import("./types").ThunderSaveData {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(THUNDER_SAVE_KEY) : null;
    if (raw) return { ...defaultThunderSave(), ...JSON.parse(raw) } as import("./types").ThunderSaveData;
  } catch { /* ignore */ }
  return defaultThunderSave();
}

/**
 * 持久化角色/装备选择到存档（v3 新增）
 * 在引擎创建前调用，引擎构造时会读取到最新的 equippedCharacter/equippedEquipments
 */
export function persistThunderEquipSelection(patch: {
  equippedCharacter?: import("./types").CharacterId;
  equippedEquipments?: { weaponChip?: string; shieldCore?: string; moveModule?: string };
}): void {
  try {
    if (typeof localStorage === "undefined") return;
    const save = loadThunderSaveSnapshot();
    if (patch.equippedCharacter) save.equippedCharacter = patch.equippedCharacter;
    if (patch.equippedEquipments) save.equippedEquipments = { ...save.equippedEquipments, ...patch.equippedEquipments };
    localStorage.setItem(THUNDER_SAVE_KEY, JSON.stringify(save));
  } catch { /* ignore */ }
}

/** 每日种子生成（D3 每日挑战） */
export function dailySeedFor(date: Date): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  // 简单哈希
  return (y * 10000 + m * 100 + d) % 2147483647;
}

/** 基于种子的伪随机数生成器（Mulberry32） */
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

/** 无尽模式动态波次生成（A1） */
export function generateEndlessWave(waveIdx: number, rng: () => number): WaveEntry[] {
  // waveIdx 是 0-based，从第 11 波（idx=10）开始
  const scale = 1 + (waveIdx - 9) * 0.12;
  const allTypes = Object.keys(ENEMIES);
  const entries: WaveEntry[] = [];
  const groupCount = 3 + Math.floor((waveIdx - 10) / 3);
  for (let g = 0; g < Math.min(groupCount, 5); g++) {
    const typeId = allTypes[Math.floor(rng() * allTypes.length)];
    const def = ENEMIES[typeId];
    if (!def) continue;
    const count = Math.max(3, Math.floor(4 * scale + rng() * 4));
    entries.push({
      typeId,
      count,
      interval: Math.max(0.3, 0.8 - (waveIdx - 10) * 0.02),
      delay: g * 2,
    });
  }
  return entries;
}

/** 反诈口诀库（B3 连击高潮飘字） */
export const ANTIFRAUD_MANTRAS: string[] = [
  "96110 来电务必接听",
  "验证码 = 密码",
  "公检法无「安全账户」",
  "稳赚不赔 = 诈骗",
  "提现要交钱 = 诈骗",
  "屏幕共享 = 诈骗",
  "AI 换脸可伪造",
  "天上不会掉馅饼",
  "刷单返利 = 诈骗",
  "高息保本 = 资金盘",
  "客服主动理赔 = 诈骗",
  "陌生人发的链接不点",
];

/** 死亡原因候选文案（B2 死亡复盘，根据击杀玩家的来源） */
export const DEATH_CAUSE_BY_ENEMY: Record<string, { fraudType: string; identifyDetail: string[]; protectList: string[]; caseStory: string }> = {
  script: {
    fraudType: "杀猪盘诈骗",
    identifyDetail: ["「稳赚不赔」「内部漏洞」是核心话术", "提现要交钱 = 100% 诈骗"],
    protectList: ["任何「稳收益」平台先在反诈APP核实", "拨打 96110 咨询"],
    caseStory: "受害人被「稳赚不赔」话术诱导，向虚假平台转账后无法提现。",
  },
  fakecs: {
    fraudType: "冒充客服诈骗",
    identifyDetail: ["正规客服不会要求屏幕共享", "验证码绝不外泄"],
    protectList: ["挂断后通过官方APP核实", "拒绝下载会议类APP"],
    caseStory: "受害人被「订单异常理赔」诱导开启屏幕共享，账户资金被转走。",
  },
  threat: {
    fraudType: "冒充公检法诈骗",
    identifyDetail: ["公检法不电话办案", "无「安全账户」"],
    protectList: ["挂断后自行拨打 110", "拒绝屏幕共享"],
    caseStory: "受害人被「涉嫌洗钱」恐吓，按指示转账到「安全账户」后失联。",
  },
  phishmine: {
    fraudType: "钓鱼网站诈骗",
    identifyDetail: ["陌生链接不点", "认准官方域名"],
    protectList: ["核实网址是否为官方", "输入密码前确认安全证书"],
    caseStory: "受害人点击短信中的「ETC 失效」链接，输入银行卡信息后资金被盗。",
  },
  brushing: {
    fraudType: "刷单返利诈骗",
    identifyDetail: ["刷单本身违法", "「垫付返利」= 诈骗"],
    protectList: ["拒绝任何刷单兼职", "小额返利是诱饵"],
    caseStory: "受害人做「刷单任务」获小利后，被要求大额垫付，本金无法取回。",
  },
  invest: {
    fraudType: "虚假投资理财诈骗",
    identifyDetail: ["「日化 5%」必是资金盘", "非正规渠道入金 = 诈骗"],
    protectList: ["理财只在持牌机构操作", "警惕「导师带单」"],
    caseStory: "受害人被拉入「内部投资群」，向虚假平台入金后平台无法登录。",
  },
  pie: {
    fraudType: "虚假福利诈骗",
    identifyDetail: ["天上不会掉馅饼", "「免费送」需付邮费 = 诈骗"],
    protectList: ["警惕陌生福利", "不点击未知链接"],
    caseStory: "受害人参与「免费送」活动，被诱导付邮费后未收到任何物品。",
  },
  phonebrush: {
    fraudType: "刷单返利诈骗",
    identifyDetail: ["手机刷单 = 诈骗", "「躺赚」是诱饵"],
    protectList: ["拒绝刷单类APP", "不下载未知应用"],
    caseStory: "受害人下载「刷单APP」做任务，被诱导充值后APP无法登录。",
  },
  bitcoin: {
    fraudType: "跑分洗钱诈骗",
    identifyDetail: ["「跑分」涉嫌帮信罪", "出借账户 = 违法"],
    protectList: ["不出借银行卡/支付宝", "警惕「躺赚」兼职"],
    caseStory: "受害人出借银行卡「跑分」获小利，后被刑拘，涉案流水超百万。",
  },
  guarantee: {
    fraudType: "虚假百万保障诈骗",
    identifyDetail: ["「百万保障」不会到期扣费", "微信/支付宝无此业务"],
    protectList: ["挂断后官方核实", "不开启屏幕共享"],
    caseStory: "受害人被「百万保障到期扣费」恐吓，按指示操作后账户资金被转走。",
  },
  pigboy: {
    fraudType: "杀猪盘诈骗",
    identifyDetail: ["完美男友教理财 = 杀猪盘", "「稳赚」是诱饵"],
    protectList: ["警惕陌生异性加好友", "不参与未知平台投资"],
    caseStory: "受害人与「外籍军官」网恋，被诱导投资后无法提现，损失数十万。",
  },
  deepfake: {
    fraudType: "AI换脸诈骗",
    identifyDetail: ["AI 换脸可伪造亲人/领导", "视频通话也可能是假的"],
    protectList: ["多重验证（声音+问题）", "当面或电话核实"],
    caseStory: "受害人收到「领导」视频通话要求转账，实为AI换脸伪造。",
  },
  fakeLottery: {
    fraudType: "虚假中奖诈骗",
    identifyDetail: ["未参与的中奖 = 诈骗", "「先税后奖」= 诈骗"],
    protectList: ["核实中奖信息来源", "不预交任何费用"],
    caseStory: "受害人收到「中奖通知」，被诱导交「税费」后失联。",
  },
};

/** 引擎→场景：本局最终结算统计（C4 专属结算页用） */
export interface ThunderFinalStats {
  score: number;
  maxCombo: number;
  bustedCount: number;
  bossesDefeated: number;
  wave: number;
  endless: boolean;
  endlessScale: number;
  difficulty: Difficulty;
  mode: ThunderMode;
  elapsedSec: number;
  killStats: Record<string, number>;
  bossKillTimes: { name: string; atSec: number; fraudType: string; emoji: string }[];
  comboHistory: { t: number; combo: number }[];
  win: boolean;
  deathCause?: { fraudType: string; emoji: string; name: string; identifyDetail?: string[]; protectList?: string[]; caseStory?: string };
}

// ===========================================================================
// ===== v3 升级数据：角色 / 装备 / 武器觉醒 =================================
// ===========================================================================

/**
 * 角色表（v3 新增）：5 位反诈专家
 * 解锁条件与教育里程碑绑定（识破数/击败特定敌人/时长），强化教育属性
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: "swat",
    name: "反诈特警",
    title: "ANTI-FRAUD SWAT",
    emoji: "🚔",
    color: "#00E5FF",
    desc: "受过专业反诈训练的一线特警，擅长应对杀猪盘与冒充公检法诈骗。",
    expertise: "杀猪盘诈骗 / 冒充公检法诈骗",
    tips: [
      "「稳赚不赔」是杀猪盘核心话术",
      "公检法不会电话办案，无「安全账户」",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.15, fraudTypes: ["杀猪盘诈骗", "冒充公检法诈骗"] },
      { kind: "shieldStart", value: 1 },
    ],
    unlockDesc: "默认解锁",
    default: true,
  },
  {
    id: "cyber",
    name: "网安专家",
    title: "CYBER SECURITY",
    emoji: "💻",
    color: "#9D4EDD",
    desc: "精通 AI 换脸与钓鱼网站识别的网络安全专家，能看穿数字伪装。",
    expertise: "AI换脸诈骗 / 钓鱼网站诈骗",
    tips: [
      "AI 换脸可伪造亲人/领导，视频通话也可能是假的",
      "陌生链接不点，认准官方域名",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.2, fraudTypes: ["AI换脸诈骗", "钓鱼网站诈骗"] },
      { kind: "branchStart", branch: "laser", branchLevel: 1 },
    ],
    unlockDesc: "累计识破 30 名诈骗分子后解锁",
  },
  {
    id: "volunteer",
    name: "反诈志愿者",
    title: "VOLUNTEER",
    emoji: "🦺",
    color: "#52C41A",
    desc: "热心公益的反诈宣传志愿者，积分与道具获取能力突出，适合长期作战。",
    expertise: "全类型诈骗（宣传防范）",
    tips: [
      "下载国家反诈中心 APP 并开启预警",
      "96110 来电务必接听",
    ],
    passives: [
      { kind: "scoreBoost", value: 0.2 },
      { kind: "dropBoost", value: 0.25 },
    ],
    unlockDesc: "累计识破 100 名诈骗分子后解锁",
  },
  {
    id: "banker",
    name: "银行风控员",
    title: "BANK RISK",
    emoji: "🏦",
    color: "#FFD666",
    desc: "银行风控专家，专治虚假投资与刷单返利，对资金盘有敏锐嗅觉。",
    expertise: "虚假投资理财诈骗 / 刷单返利诈骗",
    tips: [
      "「日化 5%」远超正常理财，必是资金盘",
      "刷单本身违法，「垫付返利」= 诈骗",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.2, fraudTypes: ["虚假投资理财诈骗", "刷单返利诈骗"] },
      { kind: "ultChargeStart", value: 30 },
    ],
    unlockDesc: "击败任意 BOSS 后解锁",
  },
  {
    id: "officer",
    name: "社区民警",
    title: "COMMUNITY POLICE",
    emoji: "👮",
    color: "#3B7FEF",
    desc: "扎根社区的民警，擅长应对冒充客服诈骗，每波结束自动恢复生命。",
    expertise: "冒充客服诈骗",
    tips: [
      "正规客服不会要求屏幕共享",
      "验证码 = 密码，绝不外泄",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.15, fraudTypes: ["冒充客服诈骗"] },
      { kind: "hpRegenWave", value: 2 },
    ],
    unlockDesc: "累计游戏 600 秒后解锁",
  },
];

/** 角色 id → 定义查找表 */
export const CHARACTER_MAP: Record<CharacterId, CharacterDef> = CHARACTERS.reduce(
  (acc, c) => { acc[c.id] = c; return acc; },
  {} as Record<CharacterId, CharacterDef>,
);

/** 角色解锁条件检查（基于存档） */
export function isCharacterUnlocked(id: CharacterId, save: import("./types").ThunderSaveData): boolean {
  if (id === "swat") return true;
  switch (id) {
    case "cyber":     return save.totalBusted >= 30;
    case "volunteer": return save.totalBusted >= 100;
    case "banker":    return save.totalBossKills >= 1;
    case "officer":   return save.totalPlayTime >= 600;
    default:          return false;
  }
}

/**
 * 装备表（v3 新增）：3 个槽位，每槽位 3 件装备（common/rare/epic）
 * 命名与 lore 均贴合反诈知识，强化教育属性
 */
export const EQUIPMENTS: EquipmentDef[] = [
  // ===== 武器芯片 =====
  {
    id: "chip_crit_eye",
    slot: "weaponChip",
    name: "识破之眼芯片",
    emoji: "🎯",
    rarity: "rare",
    color: "#FF00E5",
    desc: "暴击率 +15%（暴击 2 倍伤害）",
    lore: "「识破」是反诈第一防线：凡是要验证码、密码的全部是诈骗。",
    effect: { critRate: 0.15 },
  },
  {
    id: "chip_pierce_sword",
    slot: "weaponChip",
    name: "反诈利剑芯片",
    emoji: "⚔",
    rarity: "rare",
    color: "#00E5FF",
    desc: "子弹穿透 +1",
    lore: "一剑穿透话术伪装：公检法不会通过 QQ/微信发送「逮捕令」。",
    effect: { pierce: 1 },
  },
  {
    id: "chip_multi_guard",
    slot: "weaponChip",
    name: "群防群治芯片",
    emoji: "🔱",
    rarity: "common",
    color: "#FFB020",
    desc: "多发 +1，伤害 +10%",
    lore: "群防群治，全民反诈：陌生人发的链接不点、不信、不转账。",
    effect: { multishot: 1, dmgMul: 1.1 },
  },
  // ===== 护盾核心 =====
  {
    id: "core_antifraud_app",
    slot: "shieldCore",
    name: "反诈APP核心",
    emoji: "🛡",
    rarity: "epic",
    color: "#00E5FF",
    desc: "反诈APP护盾 +2 层，减伤 10%",
    lore: "下载国家反诈中心 APP 并开启预警，是抵御诈骗的第一道屏障。",
    effect: { shieldCharges: 2, dmgReduce: 0.1 },
  },
  {
    id: "core_bank_freeze",
    slot: "shieldCore",
    name: "银行止付核心",
    emoji: "🏦",
    rarity: "rare",
    color: "#FFD666",
    desc: "减伤 15%，每秒回 0.5 HP",
    lore: "遭遇诈骗立即拨打 110 报警，可申请银行紧急止付。",
    effect: { dmgReduce: 0.15, hpRegen: 0.5 },
  },
  {
    id: "core_hotline_96110",
    slot: "shieldCore",
    name: "96110热线核心",
    emoji: "📞",
    rarity: "common",
    color: "#52C41A",
    desc: "减伤 8%，大招充能 +20%",
    lore: "96110 是全国反诈专线，来电务必接听，可能是劝阻电话。",
    effect: { dmgReduce: 0.08, ultChargeMul: 1.2 },
  },
  // ===== 移动装置 =====
  {
    id: "move_dash_booster",
    slot: "moveModule",
    name: "闪避推进器",
    emoji: "👟",
    rarity: "rare",
    color: "#3B7FEF",
    desc: "闪避冷却 -25%，移速 +10%",
    lore: "「挂断电话」是最快的闪避：不轻信陌生来电，自行核实。",
    effect: { dashCdMul: 0.75, moveSpeedMul: 1.1 },
  },
  {
    id: "move_radar_warn",
    slot: "moveModule",
    name: "预警雷达",
    emoji: "📡",
    rarity: "common",
    color: "#FF7A1A",
    desc: "道具掉落 +20%，移速 +5%",
    lore: "预警雷达如反诈意识：天上不会掉馅饼，高息保本 = 资金盘。",
    effect: { dropMul: 1.2, moveSpeedMul: 1.05 },
  },
  {
    id: "move_ult_engine",
    slot: "moveModule",
    name: "审判引擎",
    emoji: "⚡",
    rarity: "epic",
    color: "#FF00E5",
    desc: "大招充能 +30%，移速 +8%",
    lore: "雷霆审判之下，无诈可遁：全民反诈，天下无诈。",
    effect: { ultChargeMul: 1.3, moveSpeedMul: 1.08 },
  },
];

/** 装备 id → 定义查找表 */
export const EQUIPMENT_MAP: Record<string, EquipmentDef> = EQUIPMENTS.reduce(
  (acc, e) => { acc[e.id] = e; return acc; },
  {} as Record<string, EquipmentDef>,
);

/** 按槽位分组的装备列表 */
export const EQUIPMENTS_BY_SLOT: Record<EquipSlot, EquipmentDef[]> = {
  weaponChip: EQUIPMENTS.filter((e) => e.slot === "weaponChip"),
  shieldCore: EQUIPMENTS.filter((e) => e.slot === "shieldCore"),
  moveModule: EQUIPMENTS.filter((e) => e.slot === "moveModule"),
};

/** 稀有度权重（common 55%, rare 30%, epic 15%） */
export const EQUIP_RARITY_WEIGHTS: Record<EquipRarity, number> = {
  common: 0.55,
  rare: 0.3,
  epic: 0.15,
};

/** 稀有度标签 */
export const EQUIP_RARITY_LABEL: Record<EquipRarity, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
};

/** 槽位标签 */
export const EQUIP_SLOT_LABEL: Record<EquipSlot, string> = {
  weaponChip: "武器芯片",
  shieldCore: "护盾核心",
  moveModule: "移动装置",
};

/**
 * BOSS 击败掉落装备（按难度决定稀有度倾向）
 * 返回装备 id（必定掉落 1 件）
 */
export function rollEquipmentDrop(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): string {
  // 难度越高，高稀有度概率越大
  const epicBoost = difficulty === "nightmare" ? 0.15 : difficulty === "hard" ? 0.08 : 0;
  const rareBoost = difficulty === "nightmare" ? 0.1 : difficulty === "hard" ? 0.05 : 0;
  const r = rng();
  let rarity: EquipRarity;
  if (r < EQUIP_RARITY_WEIGHTS.epic + epicBoost) {
    rarity = "epic";
  } else if (r < EQUIP_RARITY_WEIGHTS.epic + epicBoost + EQUIP_RARITY_WEIGHTS.rare + rareBoost) {
    rarity = "rare";
  } else {
    rarity = "common";
  }
  // 随机选槽位
  const slots: EquipSlot[] = ["weaponChip", "shieldCore", "moveModule"];
  const slot = slots[Math.floor(rng() * slots.length)];
  const pool = EQUIPMENTS_BY_SLOT[slot].filter((e) => e.rarity === rarity);
  if (pool.length === 0) {
    // 兜底：该稀有度无货，降级取该槽位任意一件
    const fallback = EQUIPMENTS_BY_SLOT[slot];
    return fallback[Math.floor(rng() * fallback.length)].id;
  }
  return pool[Math.floor(rng() * pool.length)].id;
}

/**
 * 武器觉醒表（v3 新增）：每个分支 4/5 级觉醒形态
 * 觉醒后子弹视觉与机制质变
 */
export const WEAPON_AWAKENINGS: WeaponAwakeningDef[] = [
  // 散射觉醒
  {
    branch: "spread",
    level: 4,
    name: "风暴散射",
    emoji: "🌀",
    desc: "5 向散射 + 子弹更大，覆盖更广",
    mantra: "群防群治，全民反诈",
    effect: { dmgMul: 1.3, extraProjectiles: 2 },
  },
  {
    branch: "spread",
    level: 5,
    name: "反诈风暴",
    emoji: "🌪",
    desc: "7 向散射 + 子弹追踪",
    mantra: "全民反诈，天下无诈",
    effect: { dmgMul: 1.6, extraProjectiles: 4, homing: true },
  },
  // 激光觉醒
  {
    branch: "laser",
    level: 4,
    name: "等离子激光",
    emoji: "🔆",
    desc: "激光更宽 + 穿透 +1",
    mantra: "一剑穿透话术伪装",
    effect: { dmgMul: 1.4, pierce: 1 },
  },
  {
    branch: "laser",
    level: 5,
    name: "识破光束",
    emoji: "💫",
    desc: "激光命中爆炸 + 范围伤害",
    mantra: "识破一切伪装，让诈骗无处遁形",
    effect: { dmgMul: 1.8, explode: true, explodeRadius: 60 },
  },
  // 追踪觉醒
  {
    branch: "homing",
    level: 4,
    name: "智能导弹群",
    emoji: "🚀",
    desc: "多发 +1 + 伤害 +30%",
    mantra: "精准打击电诈集团",
    effect: { dmgMul: 1.3, extraProjectiles: 1 },
  },
  {
    branch: "homing",
    level: 5,
    name: "雷霆审判导弹",
    emoji: "🎯",
    desc: "多发 +2 + 命中爆炸",
    mantra: "雷霆审判，诈骗终结",
    effect: { dmgMul: 1.7, extraProjectiles: 2, explode: true, explodeRadius: 50 },
  },
];

/** 觉醒查找表：branch + level → 定义 */
export const AWAKENING_MAP: Record<string, WeaponAwakeningDef> = WEAPON_AWAKENINGS.reduce(
  (acc, a) => { acc[`${a.branch}-${a.level}`] = a; return acc; },
  {} as Record<string, WeaponAwakeningDef>,
);

/** 获取某分支某等级的觉醒定义（level < 4 返回 undefined） */
export function getAwakening(branch: WeaponBranch, level: WeaponBranchLevel): WeaponAwakeningDef | undefined {
  if (level < 4 || branch === "normal") return undefined;
  return AWAKENING_MAP[`${branch}-${level}`];
}

/** 武器分支经验表（v3 新增）：1-5 级所需 XP */
export const BRANCH_XP_TABLE: Record<number, number> = {
  1: 0,    // 1 级无需 XP（选择即获得）
  2: 40,   // 升到 2 级需累计 40 XP
  3: 90,   // 升到 3 级需累计 90 XP
  4: 160,  // 觉醒到 4 级需累计 160 XP
  5: 260,  // 觉醒到 5 级需累计 260 XP
};

/** 分支升级所需 XP（从 currentLevel 升到 currentLevel+1） */
export function branchXpToNext(currentLevel: WeaponBranchLevel): number {
  return BRANCH_XP_TABLE[currentLevel + 1] ?? Infinity;
}

/** 觉醒条件：分支达到 3 级满 XP + 击败过 1 个 BOSS（存档中 awakenedBranches 已记录则永久觉醒） */
export function canAwaken(
  branch: WeaponBranch,
  branchLevel: WeaponBranchLevel,
  branchXp: number,
  save: import("./types").ThunderSaveData,
): boolean {
  if (branch === "normal") return false;
  if (branchLevel < 3) return false;
  if (branchXp < BRANCH_XP_TABLE[4]) return false;
  if (save.totalBossKills < 1) return false;
  return true;
}
