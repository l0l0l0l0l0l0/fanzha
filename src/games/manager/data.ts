import type {
  AgentDef, EnemyDef, Wave, WaveEntry, BossRushDef, ManagerMode, UpgradeChoice,
  LevelDef, CultAgentDef, Element, DailyModifier, LevelTheme, BossPhase,
} from "./types";

// ====================================================================
// 元素系统：5 系循环相克
// 法律 → 恐吓 → 情感 → 洗钱 → 技术 → 法律
// 攻击克制方 +50% 伤害；被克制方 -25% 伤害（仅作用于敌人攻击探员时考虑）
// ====================================================================

export const ELEMENTS: Record<Element, {
  name: string;
  emoji: string;
  color: string;
  /** 克制的元素 */
  counters: Element;
  desc: string;
}> = {
  law: {
    name: "法律",
    emoji: "⚖️",
    color: "#1B5FCC",
    counters: "threat",
    desc: "克制恐吓（公检法诈骗）",
  },
  tech: {
    name: "技术",
    emoji: "💻",
    color: "#00E5FF",
    counters: "law",
    desc: "克制法律（黑客反查）",
  },
  emotion: {
    name: "情感",
    emoji: "💕",
    color: "#FF7AB8",
    counters: "money",
    desc: "克制洗钱（情感拆穿）",
  },
  threat: {
    name: "恐吓",
    emoji: "📞",
    color: "#E5353B",
    counters: "emotion",
    desc: "克制情感（恐吓压制）",
  },
  money: {
    name: "洗钱",
    emoji: "💳",
    color: "#B388FF",
    counters: "tech",
    desc: "克制技术（金流切断）",
  },
};

/** 元素克制倍率：attacker 攻击 defender */
export function elementMul(attacker: Element, defender: Element): number {
  if (ELEMENTS[attacker].counters === defender) return 1.5; // 强效
  if (ELEMENTS[defender].counters === attacker) return 0.75; // 弱效
  return 1.0;
}

/** 模式元信息：用于选择 UI 与开场提示 */
export const MODE_META: Record<ManagerMode, { label: string; tagline: string; desc: string; accent: string }> = {
  classic: {
    label: "经典战役",
    tagline: "3 关卡 · 递进",
    desc: "通关 社区→市级→跨境 三级反诈，每关解锁养成探员。",
    accent: "#FFB020",
  },
  timeTrial: {
    label: "限时挑战",
    tagline: "60 秒高分",
    desc: "60 秒内尽可能多击败敌人，得分翻倍。基地失守即败。",
    accent: "#1AD670",
  },
  bossRush: {
    label: "BOSS Rush",
    tagline: "5 个电诈首脑",
    desc: "连续挑战 5 个电诈 BOSS，每只都有召唤/狂暴/三阶段技能。",
    accent: "#E5353B",
  },
  endlessRush: {
    label: "无尽 Rush",
    tagline: "无止境浪潮",
    desc: "敌人随波数无限增强，撑得越久分越高。死战到底。",
    accent: "#B388FF",
  },
  daily: {
    label: "每日挑战",
    tagline: "今日限定词缀",
    desc: "每日固定种子 + 3 个随机修饰符，完成获额外积分。",
    accent: "#FFD666",
  },
};

export const AGENTS: AgentDef[] = [
  {
    id: "shen",
    name: "资金链斩断师",
    role: "资金斩断",
    emoji: "🔫",
    hp: 120,
    attack: 22,
    range: 220,
    fireRate: 2.2,
    projectileSpeed: 520,
    color: "#FF7A1A",
    ult: "资金穿透",
    ultDesc: "对一整排诈骗资金链造成 250% 伤害",
    bio: "刑侦老炮，专攻杀猪盘资金链追踪与冻结",
    element: "law",
    silhouette: "assault",
    ultDef: {
      kind: "pierce",
      name: "资金穿透",
      desc: "对前方一整排诈骗资金链造成 250% 攻击力伤害",
      value: 2.5,
    },
  },
  {
    id: "lin",
    name: "话术识别员",
    role: "话术识别",
    emoji: "📡",
    hp: 80,
    attack: 14,
    range: 360,
    fireRate: 1.6,
    projectileSpeed: 620,
    color: "#00E5FF",
    ult: "信号拦截",
    ultDesc: "拦截诈骗信号，全场减速 3 秒，受伤 +50%",
    slow: 0.5,
    bio: "反诈中心 96110 话务员，识破每一句陷阱话术",
    element: "tech",
    silhouette: "comms",
    ultDef: {
      kind: "slowAll",
      name: "信号拦截",
      desc: "拦截诈骗信号，全场敌人减速 3 秒且受伤 +50%",
      value: 0.5,
      duration: 3,
    },
  },
  {
    id: "zhou",
    name: "网安追踪师",
    role: "网安追踪",
    emoji: "💻",
    hp: 90,
    attack: 18,
    range: 280,
    fireRate: 1.1,
    projectileSpeed: 480,
    color: "#B388FF",
    ult: "数据围剿",
    ultDesc: "在最强诈骗源位置引爆 AOE 100 半径",
    splash: 80,
    bio: "网安工程师，黑进过 7 个电诈窝点服务器",
    element: "tech",
    silhouette: "tech",
    ultDef: {
      kind: "aoe",
      name: "数据围剿",
      desc: "在最强诈骗源位置引爆 AOE 100 半径，造成 200% 伤害",
      value: 2.0,
      radius: 100,
    },
  },
  {
    id: "wang",
    name: "社区宣防员",
    role: "社区宣防",
    emoji: "👵",
    hp: 140,
    attack: 10,
    range: 200,
    fireRate: 1.4,
    projectileSpeed: 360,
    color: "#52C41A",
    ult: "全民防线",
    ultDesc: "全队回血 40% + 基地护盾 30%",
    bio: "社区反诈志愿者，专拆甜言蜜语与保健品骗局",
    element: "emotion",
    silhouette: "social",
    ultDef: {
      kind: "healShield",
      name: "全民防线",
      desc: "全队回血 40% + 基地护盾 30%",
      value: 0.4,
    },
  },
  {
    id: "su",
    name: "数据猎查师",
    role: "数据猎查",
    emoji: "📊",
    hp: 85,
    attack: 28,
    range: 300,
    fireRate: 1.0,
    projectileSpeed: 540,
    color: "#FFD666",
    ult: "精准锁定",
    ultDesc: "暴击率 +60%，暴击伤害 +50%，持续 5 秒",
    crit: 0.6,
    bio: "用数据模型锁定诈骗团伙资金流向",
    element: "law",
    silhouette: "sniper",
    ultDef: {
      kind: "critBuff",
      name: "精准锁定",
      desc: "全队暴击率 +60% / 暴击伤害 +50%，持续 5 秒",
      value: 0.6,
      duration: 5,
    },
  },
  {
    id: "chen",
    name: "卧底侦查员",
    role: "卧底侦查",
    emoji: "🥷",
    hp: 100,
    attack: 32,
    range: 160,
    fireRate: 0.9,
    projectileSpeed: 700,
    color: "#E5353B",
    ult: "暗影收网",
    ultDesc: "瞬移到最强诈骗头目身边，造成 500% 单体伤害",
    bio: "卧底三年，潜伏在跨境电诈园区",
    element: "threat",
    silhouette: "stealth",
    ultDef: {
      kind: "assassinate",
      name: "暗影收网",
      desc: "瞬移到最强诈骗头目身边，造成 500% 单体伤害",
      value: 5.0,
    },
  },
];

/**
 * 反诈术语映射：敌人 typeId → 击杀时飘字"识破：xxx"
 * 用于强化"在持续游戏中学习反诈常识"的反馈
 */
export const FRAUD_TERMS: Record<string, string> = {
  robot: "话术即诈骗",
  popup: "客服不主动",
  threat: "公检法不电办",
  sweet: "网恋不转账",
  phish: "不点陌生链",
  farmer: "不租售两卡",
  boss_farmer: "断卡行动",
  boss_sweet: "杀猪盘必破",
  boss_popup: "假客服必挂",
  boss_threat: "假警官必假",
  boss_kingpin: "跨境必究",
};

export const ENEMIES: Record<string, EnemyDef> = {
  robot: {
    id: "robot",
    name: "话术机器人",
    emoji: "🤖",
    hp: 50,
    speed: 60,
    damage: 8,
    reward: 80,
    color: "#9FE3FF",
    fraudType: "话术脚本诈骗",
    element: "tech",
    ability: "none",
    shape: "hexagon",
  },
  popup: {
    id: "popup",
    name: "假客服弹窗",
    emoji: "💬",
    hp: 80,
    speed: 50,
    damage: 12,
    reward: 120,
    color: "#FFB020",
    fraudType: "冒充客服诈骗",
    element: "emotion",
    ability: "taunt",
    shape: "window",
  },
  threat: {
    id: "threat",
    name: "恐吓语音",
    emoji: "📞",
    hp: 130,
    speed: 40,
    damage: 18,
    reward: 180,
    color: "#E5353B",
    fraudType: "冒充公检法诈骗",
    element: "threat",
    ability: "fear",
    shape: "phone",
  },
  sweet: {
    id: "sweet",
    name: "甜言蜜语",
    emoji: "💕",
    hp: 90,
    speed: 55,
    damage: 10,
    reward: 150,
    color: "#FF7AB8",
    fraudType: "杀猪盘情感诈骗",
    heal: 12,
    element: "emotion",
    ability: "heal",
    shape: "heart",
  },
  phish: {
    id: "phish",
    name: "钓鱼链接",
    emoji: "🎣",
    hp: 60,
    speed: 80,
    damage: 14,
    reward: 130,
    color: "#1AD670",
    fraudType: "钓鱼网站盗刷",
    element: "tech",
    ability: "speedBoost",
    shape: "hook",
  },
  farmer: {
    id: "farmer",
    name: "卡农",
    emoji: "💳",
    hp: 220,
    speed: 35,
    damage: 28,
    reward: 400,
    color: "#B388FF",
    fraudType: "买卖银行卡洗钱",
    element: "money",
    ability: "shield",
    shape: "card",
  },
};

export const WAVES: Wave[] = [
  // Wave 1: 话术机器人 + 钓鱼链接
  {
    enemies: [
      { typeId: "robot", count: 4, interval: 1.2, lane: 0, delay: 0 },
      { typeId: "robot", count: 3, interval: 1.4, lane: 2, delay: 1 },
      { typeId: "phish", count: 3, interval: 1.6, lane: 1, delay: 2 },
    ],
  },
  // Wave 2: 假客服 + 甜言蜜语 + 话术机器人
  {
    enemies: [
      { typeId: "popup", count: 4, interval: 1.1, lane: 1, delay: 0 },
      { typeId: "sweet", count: 3, interval: 1.5, lane: 0, delay: 1.5 },
      { typeId: "robot", count: 4, interval: 1.0, lane: 2, delay: 3 },
      { typeId: "phish", count: 3, interval: 1.3, lane: 0, delay: 5 },
    ],
  },
  // Wave 3: 恐吓语音 + 甜言蜜语 + 卡农 boss
  {
    enemies: [
      { typeId: "threat", count: 3, interval: 1.4, lane: 0, delay: 0 },
      { typeId: "sweet", count: 3, interval: 1.3, lane: 1, delay: 1 },
      { typeId: "popup", count: 4, interval: 1.0, lane: 2, delay: 2 },
      { typeId: "farmer", count: 1, interval: 1, lane: 1, delay: 4 },
      { typeId: "threat", count: 2, interval: 1.2, lane: 2, delay: 6 },
    ],
  },
];

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}

/**
 * BOSSrush 模式 5 个特色电诈首脑
 * v3：每只 BOSS 三阶段（60% / 30% 触发）
 */
export const BOSS_RUSH_BOSSES: BossRushDef[] = [
  {
    id: "boss_farmer",
    name: "卡农王 · 钱叔",
    emoji: "💳",
    hp: 900,
    speed: 26,
    damage: 38,
    reward: 800,
    color: "#B388FF",
    fraudType: "洗钱卡农头目",
    scale: 1.7,
    summonTypeId: "farmer",
    summonInterval: 5,
    summonCount: 1,
    summonLane: 0,
    enrageAtHp: 0.4,
    enrageSpeedMul: 1.7,
    enrageDamageMul: 1.4,
    skillName: "召唤卡农",
    skillDesc: "每 5 秒召唤一名卡农协战",
    element: "money",
    shape: "card",
    phases: [
      { atHp: 0.6, name: "金流加速", desc: "召唤间隔 -30%", effect: "doubleSummon", value: 0.7 },
      { atHp: 0.3, name: "洗钱狂暴", desc: "速度 ×1.7，伤害 ×1.4", effect: "enrage" },
    ],
  },
  {
    id: "boss_sweet",
    name: "杀猪盘操盘手 · 婉清",
    emoji: "💔",
    hp: 780,
    speed: 34,
    damage: 30,
    reward: 900,
    color: "#FF7AB8",
    fraudType: "情感诈骗首脑",
    scale: 1.5,
    summonTypeId: "sweet",
    summonInterval: 3.2,
    summonCount: 2,
    summonLane: 2,
    enrageAtHp: 0.5,
    enrageSpeedMul: 1.6,
    enrageDamageMul: 1.3,
    skillName: "甜言召唤",
    skillDesc: "每 3.2 秒召唤两只甜言蜜语",
    element: "emotion",
    shape: "heart",
    phases: [
      { atHp: 0.6, name: "情感陷阱", desc: "召唤数 ×2", effect: "doubleSummon", value: 2 },
      { atHp: 0.3, name: "绝望反扑", desc: "速度 ×1.6，伤害 ×1.3", effect: "enrage" },
    ],
  },
  {
    id: "boss_popup",
    name: "假客服大师 · 客服007",
    emoji: "💬",
    hp: 1000,
    speed: 24,
    damage: 32,
    reward: 1000,
    color: "#FFB020",
    fraudType: "冒充客服首脑",
    scale: 1.6,
    summonTypeId: "popup",
    summonInterval: 2.8,
    summonCount: 2,
    summonLane: 1,
    enrageAtHp: 0.45,
    enrageSpeedMul: 1.5,
    enrageDamageMul: 1.5,
    skillName: "弹窗轰炸",
    skillDesc: "高频召唤假客服弹窗干扰",
    element: "emotion",
    shape: "window",
    phases: [
      { atHp: 0.6, name: "弹窗风暴", desc: "召唤间隔 -40%", effect: "doubleSummon", value: 0.6 },
      { atHp: 0.3, name: "弹窗自愈", desc: "每秒回血 1%", effect: "healSelf", value: 0.01 },
    ],
  },
  {
    id: "boss_threat",
    name: "恐吓语音王 · 假警官",
    emoji: "📞",
    hp: 880,
    speed: 38,
    damage: 48,
    reward: 1100,
    color: "#E5353B",
    fraudType: "冒充公检法首脑",
    scale: 1.6,
    summonTypeId: "threat",
    summonInterval: 4.5,
    summonCount: 1,
    summonLane: 0,
    enrageAtHp: 0.55,
    enrageSpeedMul: 1.9,
    enrageDamageMul: 1.6,
    skillName: "拘捕威胁",
    skillDesc: "高伤害冲锋，狂暴后伤害翻倍",
    element: "threat",
    shape: "phone",
    phases: [
      { atHp: 0.6, name: "拘捕威胁", desc: "召唤数 ×2", effect: "doubleSummon", value: 2 },
      { atHp: 0.3, name: "极限狂暴", desc: "速度 ×1.9，伤害 ×1.6", effect: "enrage" },
    ],
  },
  {
    id: "boss_kingpin",
    name: "跨境电诈首脑 · 缅北枭雄",
    emoji: "👑",
    hp: 1500,
    speed: 30,
    damage: 55,
    reward: 2000,
    color: "#FF3B6B",
    fraudType: "跨境电诈终极首脑",
    scale: 2.0,
    summonTypeId: "farmer",
    summonInterval: 3.5,
    summonCount: 2,
    summonLane: 1,
    enrageAtHp: 0.6,
    enrageSpeedMul: 2.0,
    enrageDamageMul: 1.8,
    skillName: "全军压境",
    skillDesc: "终极 BOSS · 狂暴后化身杀戮机器",
    element: "money",
    shape: "crown",
    phases: [
      { atHp: 0.7, name: "全军压境", desc: "召唤 ×2 + 间隔 -30%", effect: "doubleSummon", value: 2 },
      { atHp: 0.4, name: "金钟护体", desc: "获得 30% 减伤护盾", effect: "shield", value: 0.3 },
      { atHp: 0.15, name: "末日狂暴", desc: "速度 ×2.0，伤害 ×1.8", effect: "enrage" },
    ],
  },
];

/**
 * 无尽 Rush 模式：随波数 scaling
 * 每 3 波提升一档：HP+40% / 速度+10% / 伤害+25% / 奖励+50%
 */
export function endlessScaling(absWave: number): {
  hpMul: number;
  speedMul: number;
  dmgMul: number;
  rewardMul: number;
  tier: number;
} {
  const tier = Math.floor(absWave / 3);
  return {
    hpMul: 1 + tier * 0.4,
    speedMul: 1 + tier * 0.1,
    dmgMul: 1 + tier * 0.25,
    rewardMul: 1 + tier * 0.5,
    tier,
  };
}

/**
 * 限时挑战模式：60 秒持续刷怪表（按时间窗调度）
 * 每 8 秒一段，难度递增
 */
export const TIME_TRIAL_SPAWN: { typeId: string; lane: number; at: number; }[] = [
  // 0-8s 机器人轻压
  { typeId: "robot", lane: 0, at: 0.5 },
  { typeId: "robot", lane: 1, at: 1.5 },
  { typeId: "robot", lane: 2, at: 2.5 },
  { typeId: "phish", lane: 1, at: 4 },
  { typeId: "robot", lane: 0, at: 5.5 },
  { typeId: "phish", lane: 2, at: 7 },
  // 8-16s 客服 + 甜言
  { typeId: "popup", lane: 1, at: 8.5 },
  { typeId: "popup", lane: 0, at: 10 },
  { typeId: "sweet", lane: 2, at: 11.5 },
  { typeId: "popup", lane: 1, at: 13 },
  { typeId: "sweet", lane: 0, at: 14.5 },
  // 16-26s 恐吓语音 + 钓鱼
  { typeId: "threat", lane: 0, at: 16.5 },
  { typeId: "phish", lane: 1, at: 18 },
  { typeId: "threat", lane: 2, at: 19.5 },
  { typeId: "popup", lane: 0, at: 21 },
  { typeId: "threat", lane: 1, at: 22.5 },
  { typeId: "phish", lane: 2, at: 24.5 },
  // 26-40s 卡农 + 综合压境
  { typeId: "farmer", lane: 1, at: 26.5 },
  { typeId: "popup", lane: 0, at: 28 },
  { typeId: "sweet", lane: 2, at: 29.5 },
  { typeId: "threat", lane: 0, at: 31 },
  { typeId: "farmer", lane: 1, at: 33 },
  { typeId: "popup", lane: 2, at: 35 },
  { typeId: "threat", lane: 0, at: 37 },
  { typeId: "sweet", lane: 1, at: 39 },
  // 40-60s 终极冲击
  { typeId: "farmer", lane: 1, at: 41 },
  { typeId: "threat", lane: 0, at: 43 },
  { typeId: "farmer", lane: 2, at: 45 },
  { typeId: "popup", lane: 0, at: 47 },
  { typeId: "threat", lane: 1, at: 49 },
  { typeId: "sweet", lane: 2, at: 51 },
  { typeId: "farmer", lane: 0, at: 53 },
  { typeId: "threat", lane: 1, at: 55 },
  { typeId: "farmer", lane: 2, at: 57 },
  { typeId: "threat", lane: 0, at: 59 },
];

/** 限时挑战时长（秒） */
export const TIME_TRIAL_DURATION = 60;
/** 限时挑战得分倍率 */
export const TIME_TRIAL_SCORE_MUL = 2;

/**
 * 探员升级系统（v5 分支迷宫版：击杀资源 → 升级守卫）
 * - 阈值下调 350 → 250，让玩家更频繁体验升级爽感
 * - 上限提升 5 → 8，给后期Build更多成长空间
 * - 升级池扩展 5 → 8 项（新增 doubleShot/pierce/vampire）
 */
export const UPGRADE_XP_THRESHOLD = 250;
/** 探员升级系统：每局最多升级次数（v5：8 次） */
export const UPGRADE_MAX_COUNT = 8;

/**
 * 探员升级系统：8 个固定选项池（全局强化所有探员）
 * - 升级时从池中随机抽 3 个不重复选项供玩家选择
 * - v5 分支迷宫版新增 doubleShot（双发）/ pierce（穿透弹）/ vampire（吸血）
 * - 数值全面上调，强化"爽感"
 */
export const UPGRADE_CHOICES: UpgradeChoice[] = [
  {
    id: "attack",
    emoji: "⚔",
    title: "重拳出击",
    desc: "全体探员攻击力 +35%，诈骗零容忍",
    color: "#E5353B",
  },
  {
    id: "firerate",
    emoji: "⚡",
    title: "闪电拦截",
    desc: "全体探员射速 +28%，96110 极速响应",
    color: "#FFD666",
  },
  {
    id: "range",
    emoji: "🎯",
    title: "全网追踪",
    desc: "全体探员射程 +25%，天眼锁定诈骗",
    color: "#00E5FF",
  },
  {
    id: "crit",
    emoji: "💥",
    title: "一眼识破",
    desc: "暴击率 +18%，暴击伤害 +60%，识破套路",
    color: "#FF7AB8",
  },
  {
    id: "hpregen",
    emoji: "❤",
    title: "反诈免疫",
    desc: "每秒回血 4 点，反诈意识持续强化",
    color: "#52C41A",
  },
  {
    id: "doubleShot",
    emoji: "🎯🎯",
    title: "双向取证",
    desc: "每次射击额外发射一枚投射物（伤害 60%）",
    color: "#FF8A3D",
  },
  {
    id: "pierce",
    emoji: "➤",
    title: "一查到底",
    desc: "投射物命中后不消失，可穿透至多 2 个敌人",
    color: "#B388FF",
  },
  {
    id: "vampire",
    emoji: "🩸",
    title: "资金追回",
    desc: "造成伤害时为最近的探员回血 15%",
    color: "#FF4D6D",
  },
];

/**
 * 从 UPGRADE_CHOICES 池中随机抽取 N 个不重复选项
 * v4 迷宫版：升级时调用，呈现"三选一"的随机强化
 */
export function pickUpgradeChoices(count: number): UpgradeChoice[] {
  const pool = UPGRADE_CHOICES.slice();
  const picked: UpgradeChoice[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

// ====================================================================
// 关卡（层级）系统：3 级递进 · 社区反诈 → 市级反诈 → 跨境反诈
// v3：每关附视觉主题
// ====================================================================

/** 社区反诈主题：暖色街区 */
const THEME_RESIDENTIAL: LevelTheme = {
  bgDeep: "#0E1F18",
  gridColor: "rgba(82,196,26,0.05)",
  roadColor: "rgba(82,196,26,0.06)",
  roadLine: "rgba(255,214,102,0.18)",
  silhouetteColor: "rgba(82,196,26,0.12)",
  decoration: "residential",
  decorEmojis: ["🌳", "🏠", "🏪", "🏫", "🚔", "📢", "🛡", "灯"],
};

/** 市级反诈主题：冷色都市夜景 */
const THEME_CITY: LevelTheme = {
  bgDeep: "#0A1929",
  gridColor: "rgba(0,229,255,0.06)",
  roadColor: "rgba(0,229,255,0.05)",
  roadLine: "rgba(255,176,32,0.22)",
  silhouetteColor: "rgba(0,229,255,0.18)",
  decoration: "city",
  decorEmojis: ["🏢", "🌃", "🏬", "📡", "🛡", "岗", "监", "塔"],
};

/** 跨境反诈主题：暗紫边境丛林 */
const THEME_BORDER: LevelTheme = {
  bgDeep: "#1A0E2E",
  gridColor: "rgba(179,136,255,0.07)",
  roadColor: "rgba(229,53,59,0.06)",
  roadLine: "rgba(179,136,255,0.22)",
  silhouetteColor: "rgba(179,136,255,0.18)",
  decoration: "border",
  decorEmojis: ["🌴", "⚠️", "🚧", "🚁", "🛂", "🛰", "雷", "界"],
};

/**
 * 3 级关卡配置
 * - Level 1 社区反诈：基础话术与钓鱼，10 波过关
 * - Level 2 市级反诈：进阶情感与恐吓，15 波过关
 * - Level 3 跨境反诈：全类型 + mini-boss，20 波后无尽
 */
export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "社区反诈",
    subtitle: "社区级 · 基础话术与钓鱼",
    accent: "#52C41A",
    targetWave: 10,
    enemyTypes: ["robot", "popup", "phish"],
    hpMul: 1.0,
    speedMul: 0.9,
    dmgMul: 0.8,
    rewardMul: 1.0,
    spawnIntervalMul: 1.2,
    countMul: 0.8,
    hasBoss: false,
    unlockCultAgentIdx: 0,
    theme: THEME_RESIDENTIAL,
  },
  {
    id: 2,
    name: "市级反诈",
    subtitle: "市级 · 进阶情感与恐吓",
    accent: "#FFB020",
    targetWave: 15,
    enemyTypes: ["robot", "popup", "phish", "sweet", "threat"],
    hpMul: 1.3,
    speedMul: 1.0,
    dmgMul: 1.0,
    rewardMul: 1.2,
    spawnIntervalMul: 1.0,
    countMul: 1.0,
    hasBoss: false,
    unlockCultAgentIdx: 1,
    theme: THEME_CITY,
  },
  {
    id: 3,
    name: "跨境反诈",
    subtitle: "跨境 · 全类型 + BOSS 压境",
    accent: "#E5353B",
    targetWave: 20,
    enemyTypes: ["robot", "popup", "phish", "sweet", "threat", "farmer"],
    hpMul: 1.6,
    speedMul: 1.1,
    dmgMul: 1.3,
    rewardMul: 1.5,
    spawnIntervalMul: 0.85,
    countMul: 1.2,
    hasBoss: true,
    unlockCultAgentIdx: 2,
    theme: THEME_BORDER,
  },
];

/** 最大关卡数 */
export const MAX_LEVEL = LEVELS.length;

// ====================================================================
// 养成探员系统：3 种被动增益型探员
// ====================================================================

/**
 * 养成探员定义
 * - 巡查员：减速附近敌人（光环）
 * - 分析师：提升得分获取
 * - 技术员：揭示敌人弱点（伤害加成）
 */
export const CULT_AGENTS: CultAgentDef[] = [
  {
    id: "patroller",
    name: "巡查督导员",
    role: "街面巡查",
    emoji: "🚔",
    color: "#00E5FF",
    desc: "减速附近诈骗源",
    buff: "slow",
    buffPerLevel: 0.15,
    range: 130,
  },
  {
    id: "analyst",
    name: "情报分析师",
    role: "情报分析",
    emoji: "📊",
    color: "#FFD666",
    desc: "提升战果得分",
    buff: "score",
    buffPerLevel: 0.2,
  },
  {
    id: "tech",
    name: "技侦支援员",
    role: "技侦支援",
    emoji: "🔧",
    color: "#B388FF",
    desc: "揭示诈骗弱点",
    buff: "weakness",
    buffPerLevel: 0.15,
  },
];

/** 养成探员最高等级 */
export const CULT_AGENT_MAX_LEVEL = 3;

/**
 * 养成探员升级所需分数（按目标等级索引）
 * - 索引 0：1→2 级，消耗 500 分
 * - 索引 1：2→3 级，消耗 1000 分
 */
export const CULT_UPGRADE_COST: number[] = [500, 1000];

/** 养成探员在场上的 3 个槽位坐标（引擎画布 960×540 内） */
export const CULT_AGENT_SLOT_X: number[] = [400, 480, 560];
export const CULT_AGENT_SLOT_Y = 95;

/**
 * 根据关卡与绝对波次（1-indexed）程序化生成波次配置
 * - 复用 WAVES 模板循环，按关卡筛选敌人类型并叠加 scaling
 * - 关卡 3 每 5 波追加一个 farmer（mini-boss）
 */
export function generateWave(level: LevelDef, absWave: number): Wave {
  const template = WAVES[(absWave - 1) % WAVES.length] ?? WAVES[0];
  // 难度随波次递增：每 4 波多 1 个敌人
  const waveBonus = Math.floor(absWave / 4);
  const entries: WaveEntry[] = [];
  for (const e of template.enemies) {
    const allowed = level.enemyTypes.includes(e.typeId);
    // 不允许的类型替换为关卡允许的类型（按波次轮换，增加多样性）
    const typeId = allowed
      ? e.typeId
      : level.enemyTypes[absWave % level.enemyTypes.length];
    entries.push({
      typeId,
      count: Math.max(1, Math.round(e.count * level.countMul) + waveBonus),
      interval: Math.max(0.4, e.interval * level.spawnIntervalMul),
      lane: e.lane,
      delay: e.delay,
    });
  }
  // 关卡 3 且每 5 波：加入 farmer（mini-boss）
  if (level.hasBoss && absWave % 5 === 0) {
    entries.push({
      typeId: "farmer",
      count: 1,
      interval: 1,
      lane: 1,
      delay: 3,
    });
  }
  return { enemies: entries };
}

// ====================================================================
// v3 新增：连击系统配置
// ====================================================================

/** 连击系统配置（v5：showThreshold 3 → 2，更早进入连击爽感） */
export const COMBO_CONFIG = {
  /** 每次击杀提供的连击数增量 */
  incrementPerKill: 1,
  /** 连击失效时间（秒） */
  decaySec: 2.5,
  /** 每级连击倍率增量 */
  mulPerStep: 0.15,
  /** 连击倍率上限 */
  maxMul: 2.5,
  /** 连击数显示阈值（>=N 才显示 HUD） */
  showThreshold: 2,
} as const;

/** 根据连击数计算倍率 */
export function comboMul(count: number): number {
  return Math.min(COMBO_CONFIG.maxMul, 1 + count * COMBO_CONFIG.mulPerStep);
}

// ====================================================================
// v3 新增：每日挑战修饰符
// ====================================================================

export const DAILY_MODIFIERS: DailyModifier[] = [
  {
    id: "bossOnly",
    name: "全员 BOSS",
    desc: "每波第 3 个敌人变成 mini-BOSS（HP ×3）",
    severity: 3,
    effect: { kind: "bossOnly" },
    emoji: "👹",
    color: "#E5353B",
  },
  {
    id: "noUlt",
    name: "禁大招",
    desc: "能量无法积累，无法释放大招",
    severity: 3,
    effect: { kind: "noUlt" },
    emoji: "🚫",
    color: "#7A8FB0",
  },
  {
    id: "speedyEnemies",
    name: "电诈加速",
    desc: "所有敌人速度 +40%",
    severity: 2,
    effect: { kind: "speedyEnemies", mul: 1.4 },
    emoji: "💨",
    color: "#FF7A1A",
  },
  {
    id: "doubleHp",
    name: "诈骗加固",
    desc: "所有敌人 HP ×2",
    severity: 2,
    effect: { kind: "doubleHp" },
    emoji: "🛡️",
    color: "#00E5FF",
  },
  {
    id: "noHeal",
    name: "无援作战",
    desc: "探员无法回血，但攻击力 +50%",
    severity: 2,
    effect: { kind: "noHeal", agentMul: 1.5 },
    emoji: "💔",
    color: "#FF7AB8",
  },
  {
    id: "instantUlt",
    name: "大招即发",
    desc: "开局即满能量，可立即放大",
    severity: 1,
    effect: { kind: "instantUlt" },
    emoji: "⚡",
    color: "#FFD666",
  },
  {
    id: "fastWaves",
    name: "潮涌来袭",
    desc: "刷怪间隔 -30%",
    severity: 2,
    effect: { kind: "fastWaves", mul: 0.7 },
    emoji: "🌊",
    color: "#1AD670",
  },
  {
    id: "timeLimit",
    name: "90 秒倒计时",
    desc: "必须在 90 秒内通关，否则失败",
    severity: 3,
    effect: { kind: "timeLimit", sec: 90 },
    emoji: "⏰",
    color: "#FF3B5C",
  },
  {
    id: "noUpgrades",
    name: "原形毕露",
    desc: "禁用探员升级系统",
    severity: 1,
    effect: { kind: "noUpgrades" },
    emoji: "🔒",
    color: "#B388FF",
  },
  {
    id: "oneLane",
    name: "单道作战",
    desc: "所有敌人集中在中间道",
    severity: 1,
    effect: { kind: "oneLane", lane: 1 },
    emoji: "🎯",
    color: "#00E5FF",
  },
];

/**
 * 根据日期字符串生成确定性每日修饰符
 * 算法：用日期做种子，按权重抽 3 个不重复修饰符
 */
export function dailyModifiersForSeed(seed: string): DailyModifier[] {
  // 简易字符串哈希 → 数值种子
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  // 用 Mulberry32 派生伪随机
  const rng = () => {
    h |= 0; h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = DAILY_MODIFIERS.slice();
  const picked: DailyModifier[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

/** 每日挑战分数倍率（按修饰符严重度之和计算） */
export function dailyScoreMul(mods: DailyModifier[]): number {
  const sevSum = mods.reduce((s, m) => s + m.severity, 0);
  return 1 + sevSum * 0.3; // 严重度 3 + 3 + 3 = 9 → 倍率 3.7
}

// ====================================================================
// v3 新增：BOSS 阶段触发逻辑辅助
// ====================================================================

/**
 * 根据当前 HP 比例计算 BOSS 阶段索引
 * @returns 当前阶段索引（0 = 初始，未触发任何阶段切换）
 */
export function bossPhaseIndex(def: BossRushDef, hpRatio: number): number {
  if (!def.phases || def.phases.length === 0) return 0;
  let idx = 0;
  for (let i = 0; i < def.phases.length; i++) {
    if (hpRatio <= def.phases[i].atHp) idx = i + 1;
  }
  return idx;
}

/** 应用 BOSS 阶段效果到运行时（返回新属性倍率） */
export function applyBossPhase(
  phase: BossPhase,
  baseSpeed: number,
  baseDamage: number,
  baseSummonInterval: number,
  baseSummonCount: number,
): {
  speed: number;
  damage: number;
  summonInterval: number;
  summonCount: number;
  healPerSec: number;
  damageReduction: number;
} {
  let speed = baseSpeed;
  let damage = baseDamage;
  let summonInterval = baseSummonInterval;
  let summonCount = baseSummonCount;
  let healPerSec = 0;
  let damageReduction = 0;
  switch (phase.effect) {
    case "enrage":
      // 注：enrage 的具体倍率由 BossRushDef 的 enrageSpeedMul/enrageDamageMul 决定，调用方处理
      break;
    case "doubleSummon":
      summonCount = baseSummonCount * (phase.value ?? 2);
      summonInterval = baseSummonInterval * 0.7;
      break;
    case "healSelf":
      healPerSec = phase.value ?? 0.01;
      break;
    case "speedBurst":
      speed = baseSpeed * (phase.value ?? 1.5);
      break;
    case "shield":
      damageReduction = phase.value ?? 0.3;
      break;
  }
  return { speed, damage, summonInterval, summonCount, healPerSec, damageReduction };
}
