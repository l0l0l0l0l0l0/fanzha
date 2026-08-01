import type {
  AgentDef, EnemyDef, Wave, WaveEntry, BossRushDef, ManagerMode, UpgradeChoice,
  LevelDef, CultAgentDef, Element, DailyModifier, LevelTheme, BossPhase,
  // v6 全面升级新增类型
  TalentTree, TalentNode, TalentBranch, TalentEffect,
  RelicDef,
  // v9 升级新增类型
  RelicTier, EnemyAIBehavior,
  EquipmentDef,
  BossDialogue,
  QuizQuestion,
  CodexEntry,
  TacticalDeviceDef,
  ElementReactionDef,
  TowerFloorDef,
  WeeklyQuest,
  ChallengeAffix,
  AgentSkin,
  SeasonRank,
  SeasonInfo,
  // v8 全面升级新增类型
  CounterspellDef,
  TacticalCommandDef,
  VictimRescueConfig,
  // v11 全面升级新增类型（用于 helper 函数返回类型）
  RealCaseDef,
  CaseBreakdownDef,
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
  // ===== v6 新增模式 =====
  tower: {
    label: "爬塔挑战",
    tagline: "100 层递进",
    desc: "100 层递进迷宫，每 10 层一个 BOSS，每 5 层获奖励，登顶解锁限定皮肤。",
    accent: "#9D6BFF",
  },
  challenge: {
    label: "极限挑战",
    tagline: "自选词缀",
    desc: "自选 1-3 个极限词缀，词缀越严积分倍率越高，反诈极限玩家专属。",
    accent: "#FF3B6B",
  },
  // ===== v9 新增模式 =====
  senior: {
    label: "适老模式",
    tagline: "大字慢节奏 · 案例为主",
    desc: "专为老年玩家设计：大字号、慢节奏、案例教学为主，操作简化，重点识破话术。",
    accent: "#52C41A",
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
  // ===== v6 新增探员（4 名，覆盖新型诈骗） =====
  {
    id: "fayi",
    name: "法务审计师",
    role: "法务审计",
    emoji: "⚖️",
    hp: 110,
    attack: 20,
    range: 240,
    fireRate: 1.3,
    projectileSpeed: 500,
    color: "#3D8BFD",
    ult: "资金冻结",
    ultDesc: "冻结全场敌人 2 秒，期间受伤 +30%",
    bio: "注册会计师 + 法律顾问，专攻复杂资金链审计与冻结",
    element: "law",
    silhouette: "medic",
    ultDef: {
      kind: "freeze",
      name: "资金冻结",
      desc: "冻结全场敌人 2 秒，期间受伤 +30%",
      value: 2.0,
      duration: 2,
    },
    unlockHint: "反诈积分 500 解锁",
    unlockCost: 500,
    isNew: true,
  },
  {
    id: "yuce",
    name: "数据预测师",
    role: "数据预测",
    emoji: "🔮",
    hp: 75,
    attack: 16,
    range: 320,
    fireRate: 1.8,
    projectileSpeed: 580,
    color: "#00C9A7",
    ult: "时间扭曲",
    ultDesc: "敌人时间减慢 50%，持续 4 秒",
    bio: "AI 风控模型工程师，用机器学习预测诈骗团伙下一步行动",
    element: "tech",
    silhouette: "tech",
    ultDef: {
      kind: "timeWarp",
      name: "时间扭曲",
      desc: "敌人时间减慢 50%，持续 4 秒",
      value: 0.5,
      duration: 4,
    },
    unlockHint: "反诈积分 800 解锁",
    unlockCost: 800,
    isNew: true,
  },
  {
    id: "kuajing",
    name: "跨境联络官",
    role: "跨境联络",
    emoji: "🌐",
    hp: 130,
    attack: 24,
    range: 200,
    fireRate: 1.2,
    projectileSpeed: 460,
    color: "#FF8A3D",
    ult: "联合行动",
    ultDesc: "召唤一名临时探员协战 8 秒（属性 = 主战探员 70%）",
    bio: "国际刑警组织联络官，协调跨境联合执法行动",
    element: "threat",
    silhouette: "comms",
    ultDef: {
      kind: "summon",
      name: "联合行动",
      desc: "召唤一名临时探员协战 8 秒（属性 = 主战探员 70%）",
      value: 0.7,
      duration: 8,
    },
    unlockHint: "反诈积分 1200 解锁",
    unlockCost: 1200,
    isNew: true,
  },
  {
    id: "jianwei",
    name: "AI 鉴伪师",
    role: "AI 鉴伪",
    emoji: "🤖",
    hp: 95,
    attack: 22,
    range: 280,
    fireRate: 1.5,
    projectileSpeed: 620,
    color: "#A8E6CF",
    ult: "鉴伪护盾",
    ultDesc: "所有探员获得 50% 最大生命值的护盾，持续 5 秒",
    bio: "Deepfake 检测专家，识破每一帧 AI 换脸与合成语音",
    element: "tech",
    silhouette: "drone",
    ultDef: {
      kind: "shieldWall",
      name: "鉴伪护盾",
      desc: "所有探员获得 50% 最大生命值的护盾，持续 5 秒",
      value: 0.5,
      duration: 5,
    },
    unlockHint: "反诈积分 1500 解锁",
    unlockCost: 1500,
    isNew: true,
  },
  // ===== v8 新增探员（4 名，覆盖剩余高频诈骗类型） =====
  {
    id: "xiaoyuan",
    name: "校园宣讲官",
    role: "校园宣防",
    emoji: "🎓",
    hp: 120,
    attack: 18,
    range: 240,
    fireRate: 1.4,
    projectileSpeed: 480,
    color: "#5BC0DE",
    ult: "青春护盾",
    ultDesc: "为所有受害人 NPC 提供 3 秒无敌，并治愈 30% 洗脑进度",
    bio: "高校反诈宣讲员，专拆校园贷、刷单、虚假招聘陷阱",
    element: "emotion",
    silhouette: "social",
    ultDef: {
      kind: "shieldWall",
      name: "青春护盾",
      desc: "为所有受害人 NPC 提供 3 秒无敌，并治愈 30% 洗脑进度",
      value: 0.3,
      duration: 3,
    },
    unlockHint: "反诈积分 600 解锁",
    unlockCost: 600,
    isNew: true,
  },
  {
    id: "piaowu",
    name: "票务稽查员",
    role: "票务稽查",
    emoji: "🎫",
    hp: 90,
    attack: 26,
    range: 280,
    fireRate: 1.6,
    projectileSpeed: 560,
    color: "#FFC107",
    ult: "真票验真",
    ultDesc: "对全场'票务类'敌人造成 350% 伤害并禁锢 2 秒",
    bio: "文旅局票务稽查员，专治演唱会/机票二手票务诈骗",
    element: "law",
    silhouette: "assault",
    ultDef: {
      kind: "freeze",
      name: "真票验真",
      desc: "对全场'票务类'敌人造成 350% 伤害并禁锢 2 秒",
      value: 2.0,
      duration: 2,
    },
    unlockHint: "反诈积分 900 解锁",
    unlockCost: 900,
    isNew: true,
  },
  {
    id: "hangban",
    name: "航班护航员",
    role: "航班护航",
    emoji: "✈️",
    hp: 100,
    attack: 22,
    range: 300,
    fireRate: 1.2,
    projectileSpeed: 600,
    color: "#4FC3F7",
    ult: "航线拦截",
    ultDesc: "在最强敌人位置引爆 AOE 120，造成 220% 伤害并减速 50%",
    bio: "民航反诈联络员，专治机票退改签诈骗",
    element: "tech",
    silhouette: "comms",
    ultDef: {
      kind: "aoe",
      name: "航线拦截",
      desc: "在最强敌人位置引爆 AOE 120，造成 220% 伤害并减速 50%",
      value: 2.2,
      radius: 120,
    },
    unlockHint: "反诈积分 1000 解锁",
    unlockCost: 1000,
    isNew: true,
  },
  {
    id: "jiuyuan",
    name: "应急救助员",
    role: "应急救助",
    emoji: "🚑",
    hp: 130,
    attack: 16,
    range: 220,
    fireRate: 1.5,
    projectileSpeed: 440,
    color: "#FF7043",
    ult: "生命通道",
    ultDesc: "全队回血 35% + 复活 1 名已倒下探员（30% 血）",
    bio: "急救培训师，专拆虚构意外/急救诈骗",
    element: "emotion",
    silhouette: "medic",
    ultDef: {
      kind: "healShield",
      name: "生命通道",
      desc: "全队回血 35% + 复活 1 名已倒下探员（30% 血）",
      value: 0.35,
    },
    unlockHint: "反诈积分 1300 解锁",
    unlockCost: 1300,
    isNew: true,
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
  // ===== v6 新增 =====
  deepfake: "AI 换脸核实",
  investApp: "理财认持牌",
  fakeLeader: "领导转账核实",
  etcFraud: "ETC 官方办",
  refundFraud: "退费走官方",
  loanCancel: "注销校园贷是骗",
  boss_deepfake: "AI 诈骗必究",
  boss_invest: "虚假平台必崩",
  boss_loan: "校园贷骗局必破",
  // ===== v8 新增 =====
  fakeRecruit: "招聘不交钱",
  ticketFraud: "票务走平台",
  flightChange: "退改签走官方",
  fakeAccident: "意外必核实",
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
    // v9 AI：间歇伪装成正常通话（减速但无法被攻击），模拟话术机器人混入正常来电
    aiBehavior: {
      kind: "disguise",
      trigger: { chance: 0.2, cooldown: 5 },
      params: { disguiseDuration: 1.2 },
    },
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
    // v9 AI：绕侧，模拟弹窗从不同方向骚扰受害人
    aiBehavior: {
      kind: "flank",
      trigger: { chance: 0.5, cooldown: 2 },
    },
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
    // v9 AI：恐惧光环，附近探员射速 -30%，模拟恐吓压制
    aiBehavior: {
      kind: "fearAura",
      params: { auraRadius: 120 },
    },
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
    // v9 AI：治疗光环，附近敌人每秒回血，模拟"情感维持团伙"互相支撑
    aiBehavior: {
      kind: "healAura",
      params: { healPerSec: 6, auraRadius: 100 },
    },
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
    // v9 AI：绕侧，模拟钓鱼链接从不同渠道出现
    aiBehavior: {
      kind: "flank",
      trigger: { chance: 0.6, cooldown: 1.5 },
    },
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
    // v9 AI：低血量狂暴（速度+30%、伤害+50%），副行为 rush（呼喊附近卡农一起加速）
    aiBehavior: {
      kind: "enrage",
      trigger: { belowHpRatio: 0.5 },
      params: { speedMul: 1.3, damageMul: 1.5 },
      secondary: "rush",
    },
  },
  // ===== v6 新增敌人（6 种，覆盖新型诈骗） =====
  deepfake: {
    id: "deepfake",
    name: "AI 换脸",
    emoji: "🎭",
    hp: 110,
    speed: 55,
    damage: 16,
    reward: 200,
    color: "#A8E6CF",
    fraudType: "AI 换脸冒充熟人",
    element: "tech",
    ability: "invisible",
    shape: "virus",
    isNew: true,
    codexId: "codex_deepfake",
    // v9 AI：间歇伪装成正常 NPC（无法被攻击），完美还原"AI 换脸冒充熟人"特性
    aiBehavior: {
      kind: "disguise",
      trigger: { chance: 0.4, cooldown: 3 },
      params: { disguiseDuration: 2 },
    },
  },
  investApp: {
    id: "investApp",
    name: "虚假理财 APP",
    emoji: "📱",
    hp: 180,
    speed: 42,
    damage: 22,
    reward: 280,
    color: "#FF6B9D",
    fraudType: "虚假投资平台诈骗",
    element: "money",
    ability: "reflect",
    shape: "wallet",
    isNew: true,
    codexId: "codex_investApp",
    // v9 AI：反弹 20% 投射物伤害，模拟"虚假收益"诱惑投资人接盘后反噬
    aiBehavior: {
      kind: "reflect",
      params: { reflectRatio: 0.2 },
    },
  },
  fakeLeader: {
    id: "fakeLeader",
    name: "冒充领导",
    emoji: "👔",
    hp: 140,
    speed: 48,
    damage: 20,
    reward: 220,
    color: "#4ECDC4",
    fraudType: "冒充领导熟人转账",
    element: "emotion",
    ability: "taunt",
    shape: "mask",
    isNew: true,
    codexId: "codex_fakeLeader",
    // v9 AI：间歇伪装成正常 NPC（无法被攻击），模拟"冒充领导"混入正常工作群
    aiBehavior: {
      kind: "disguise",
      trigger: { chance: 0.3, cooldown: 5 },
      params: { disguiseDuration: 2.5 },
    },
  },
  etcFraud: {
    id: "etcFraud",
    name: "ETC 诈骗",
    emoji: "🚗",
    hp: 70,
    speed: 85,
    damage: 12,
    reward: 160,
    color: "#FFA07A",
    fraudType: "ETC 过期短信诈骗",
    element: "tech",
    ability: "speedBoost",
    shape: "briefcase",
    isNew: true,
    codexId: "codex_etcFraud",
    // v9 AI：低血量群冲（呼喊同类型敌人加速），模拟 ETC 诈骗短信病毒式扩散
    aiBehavior: {
      kind: "rush",
      trigger: { belowHpRatio: 0.4 },
      params: { speedMul: 1.6 },
    },
  },
  refundFraud: {
    id: "refundFraud",
    name: "退费诈骗",
    emoji: "💸",
    hp: 95,
    speed: 60,
    damage: 14,
    reward: 180,
    color: "#FFB347",
    fraudType: "假冒客服退费诈骗",
    element: "emotion",
    ability: "split",
    shape: "wallet",
    isNew: true,
    codexId: "codex_refundFraud",
    // v9 AI：死亡时分裂为 2 个假客服弹窗，模拟"退费诈骗连环套"
    aiBehavior: {
      kind: "split",
      params: { splitTypeId: "popup" },
    },
  },
  loanCancel: {
    id: "loanCancel",
    name: "注销校园贷",
    emoji: "📚",
    hp: 160,
    speed: 38,
    damage: 24,
    reward: 260,
    color: "#9B59B6",
    fraudType: "假冒注销校园贷诈骗",
    element: "threat",
    ability: "fear",
    shape: "briefcase",
    isNew: true,
    codexId: "codex_loanCancel",
    // v9 AI：恐惧光环（半径 140），模拟"影响征信"恐吓压制受害人
    aiBehavior: {
      kind: "fearAura",
      params: { auraRadius: 140 },
    },
  },
  // ===== v8 新增敌人（4 种，覆盖剩余高频诈骗） =====
  fakeRecruit: {
    id: "fakeRecruit",
    name: "虚假招聘",
    emoji: "📋",
    hp: 120,
    speed: 50,
    damage: 18,
    reward: 200,
    color: "#795548",
    fraudType: "虚假招聘押金诈骗",
    element: "emotion",
    ability: "taunt",
    shape: "briefcase",
    isNew: true,
    codexId: "codex_fakeRecruit",
    // v9 AI：绕侧，模拟虚假招聘从不同渠道（招聘网站/微信群/短信）接触受害人
    aiBehavior: {
      kind: "flank",
      trigger: { chance: 0.4, cooldown: 3 },
    },
  },
  ticketFraud: {
    id: "ticketFraud",
    name: "二手票务",
    emoji: "🎫",
    hp: 85,
    speed: 70,
    damage: 14,
    reward: 170,
    color: "#FFC107",
    fraudType: "二手演唱会票务诈骗",
    element: "tech",
    ability: "speedBoost",
    shape: "card",
    isNew: true,
    codexId: "codex_ticketFraud",
    // v9 AI：低血量群冲，模拟二手票务诈骗在演出前病毒式扩散
    aiBehavior: {
      kind: "rush",
      trigger: { belowHpRatio: 0.5 },
      params: { speedMul: 1.5 },
    },
  },
  flightChange: {
    id: "flightChange",
    name: "退改签",
    emoji: "✈️",
    hp: 100,
    speed: 58,
    damage: 16,
    reward: 190,
    color: "#4FC3F7",
    fraudType: "机票退改签诈骗",
    element: "tech",
    ability: "none",
    shape: "briefcase",
    isNew: true,
    codexId: "codex_flightChange",
    // v9 AI：绕侧，模拟"航班紧急退改签"从短信/电话/邮件多渠道催促受害人
    aiBehavior: {
      kind: "flank",
      trigger: { chance: 0.5, cooldown: 2 },
    },
  },
  fakeAccident: {
    id: "fakeAccident",
    name: "虚构意外",
    emoji: "🚑",
    hp: 150,
    speed: 44,
    damage: 22,
    reward: 240,
    color: "#FF7043",
    fraudType: "虚构亲友意外诈骗",
    element: "emotion",
    ability: "fear",
    shape: "heart",
    isNew: true,
    codexId: "codex_fakeAccident",
    // v9 AI：恐惧光环（半径 130），模拟"亲友出事"恐吓制造紧迫感
    aiBehavior: {
      kind: "fearAura",
      params: { auraRadius: 130 },
    },
  },
  // ===== v9 新增敌人（8 种，F45-F52，覆盖 2026 Q3-Q4 新型诈骗） =====
  aiVoiceClone: {
    id: "aiVoiceClone",
    name: "AI 语音克隆",
    emoji: "🎙️",
    hp: 120,
    speed: 52,
    damage: 18,
    reward: 210,
    color: "#7E57C2",
    fraudType: "AI 克隆亲人语音诈骗",
    element: "tech",
    ability: "invisible",
    shape: "virus",
    isNew: true,
    codexId: "codex_aiVoiceClone",
    // v9 AI：间歇伪装成正常 NPC（克隆亲人声音，受害人难辨真伪）
    aiBehavior: {
      kind: "disguise",
      trigger: { chance: 0.35, cooldown: 3.5 },
      params: { disguiseDuration: 1.8 },
    },
  },
  fakeLivestream: {
    id: "fakeLivestream",
    name: "虚假直播",
    emoji: "📺",
    hp: 90,
    speed: 65,
    damage: 14,
    reward: 180,
    color: "#FF4081",
    fraudType: "直播间虚假宣传诈骗",
    element: "emotion",
    ability: "taunt",
    shape: "window",
    isNew: true,
    codexId: "codex_fakeLivestream",
    // v9 AI：绕侧，模拟直播间从多渠道引流受害人
    aiBehavior: {
      kind: "flank",
      trigger: { chance: 0.45, cooldown: 2.2 },
    },
  },
  cryptoWalletPhish: {
    id: "cryptoWalletPhish",
    name: "钱包授权钓鱼",
    emoji: "🪙",
    hp: 75,
    speed: 78,
    damage: 16,
    reward: 190,
    color: "#00BCD4",
    fraudType: "数字货币钱包授权钓鱼",
    element: "tech",
    ability: "speedBoost",
    shape: "hook",
    isNew: true,
    codexId: "codex_cryptoWalletPhish",
    // v9 AI：低血量群冲，模拟授权链接病毒式扩散
    aiBehavior: {
      kind: "rush",
      trigger: { belowHpRatio: 0.4 },
      params: { speedMul: 1.55 },
    },
  },
  fakeGovApp: {
    id: "fakeGovApp",
    name: "政务 APP 仿冒",
    emoji: "🏛️",
    hp: 140,
    speed: 45,
    damage: 20,
    reward: 230,
    color: "#1565C0",
    fraudType: "仿冒国家政务 APP 诈骗",
    element: "law",
    ability: "shield",
    shape: "briefcase",
    isNew: true,
    codexId: "codex_fakeGovApp",
    // v9 AI：间歇伪装成正常 NPC（仿冒正规政务 APP，难辨真伪）
    aiBehavior: {
      kind: "disguise",
      trigger: { chance: 0.3, cooldown: 4.5 },
      params: { disguiseDuration: 2.2 },
    },
  },
  pensionFraud: {
    id: "pensionFraud",
    name: "养老理财",
    emoji: "👵",
    hp: 170,
    speed: 36,
    damage: 26,
    reward: 270,
    color: "#FF8A65",
    fraudType: "虚假养老理财诈骗",
    element: "emotion",
    ability: "fear",
    shape: "wallet",
    isNew: true,
    codexId: "codex_pensionFraud",
    // v9 AI：恐惧光环（半径 145），模拟"不投资养老金不够用"恐吓老年人
    aiBehavior: {
      kind: "fearAura",
      params: { auraRadius: 145 },
    },
  },
  shortDramaTrap: {
    id: "shortDramaTrap",
    name: "短剧连环扣",
    emoji: "🎬",
    hp: 100,
    speed: 56,
    damage: 16,
    reward: 200,
    color: "#AB47BC",
    fraudType: "短剧付费连环扣费诈骗",
    element: "tech",
    ability: "split",
    shape: "window",
    isNew: true,
    codexId: "codex_shortDramaTrap",
    // v9 AI：死亡时分裂为 2 个假客服弹窗，模拟"免费引流→连环扣费"
    aiBehavior: {
      kind: "split",
      params: { splitTypeId: "popup" },
    },
  },
  secondhandCutOrder: {
    id: "secondhandCutOrder",
    name: "二手切单",
    emoji: "🛒",
    hp: 95,
    speed: 62,
    damage: 15,
    reward: 190,
    color: "#26A69A",
    fraudType: "二手平台线下切单诈骗",
    element: "money",
    ability: "speedBoost",
    shape: "card",
    isNew: true,
    codexId: "codex_secondhandCutOrder",
    // v9 AI：绕侧，模拟骗子绕开平台私下交易切单
    aiBehavior: {
      kind: "flank",
      trigger: { chance: 0.5, cooldown: 1.8 },
    },
  },
  aiRefundVoice: {
    id: "aiRefundVoice",
    name: "AI 退货客服",
    emoji: "🤙",
    hp: 110,
    speed: 50,
    damage: 17,
    reward: 200,
    color: "#5C6BC0",
    fraudType: "AI 语音冒充客服退货诈骗",
    element: "tech",
    ability: "invisible",
    shape: "phone",
    isNew: true,
    codexId: "codex_aiRefundVoice",
    // v9 AI：间歇伪装成正常 NPC（AI 语音冒充客服，难辨真伪）
    aiBehavior: {
      kind: "disguise",
      trigger: { chance: 0.35, cooldown: 3.2 },
      params: { disguiseDuration: 2 },
    },
  },
  // ===== v10 新增：2026 新型诈骗敌人（桥接 fraudBuster F87/F45 案例库）=====
  deepseekFake: {
    id: "deepseekFake",
    name: "DeepSeek 仿冒客服",
    emoji: "🤖",
    hp: 140,
    speed: 46,
    damage: 22,
    reward: 260,
    color: "#00BFA5",
    fraudType: "DeepSeek 大模型仿冒客服",
    element: "tech",
    ability: "taunt",
    shape: "phone",
    isNew: true,
    codexId: "codex_deepseekFake",
    // v9 AI：低血量加速 + 群冲（模拟骗子得手前慌乱诱导）
    aiBehavior: {
      kind: "rush",
      trigger: { belowHpRatio: 0.4, cooldown: 4 },
      params: { speedMul: 1.5 },
      secondary: "disguise",
    },
  },
  aiFaceSwap: {
    id: "aiFaceSwap",
    name: "AI 换脸冒充熟人",
    emoji: "🎭",
    hp: 130,
    speed: 42,
    damage: 25,
    reward: 240,
    color: "#E91E63",
    fraudType: "AI 实时换脸冒充熟人",
    element: "emotion",
    ability: "invisible",
    shape: "mask",
    isNew: true,
    codexId: "codex_aiFaceSwap",
    // v9 AI：间歇隐身（模拟换脸视频通话，受害人难以识破）
    aiBehavior: {
      kind: "disguise",
      trigger: { chance: 0.4, cooldown: 2.8 },
      params: { disguiseDuration: 2.5 },
    },
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
  // ===== v6 新增 BOSS（3 个，覆盖新型诈骗） =====
  {
    id: "boss_deepfake",
    name: "AI 换脸师 · 镜像",
    emoji: "🎭",
    hp: 1100,
    speed: 32,
    damage: 42,
    reward: 1200,
    color: "#A8E6CF",
    fraudType: "AI 换脸冒充熟人首脑",
    scale: 1.6,
    summonTypeId: "deepfake",
    summonInterval: 4.0,
    summonCount: 2,
    summonLane: 1,
    enrageAtHp: 0.5,
    enrageSpeedMul: 1.6,
    enrageDamageMul: 1.4,
    skillName: "镜像伪装",
    skillDesc: "召唤 AI 换脸小怪，间歇隐身规避投射物",
    element: "tech",
    shape: "mask",
    phases: [
      { atHp: 0.6, name: "镜像分身", desc: "召唤数 ×2", effect: "doubleSummon", value: 2 },
      { atHp: 0.3, name: "镜中幻影", desc: "敌人间歇隐身 + 速度 ×1.6", effect: "invisible" },
    ],
    isNew: true,
  },
  {
    id: "boss_invest",
    name: "虚假平台 · 钱生钱",
    emoji: "💰",
    hp: 1300,
    speed: 28,
    damage: 46,
    reward: 1400,
    color: "#FF6B9D",
    fraudType: "虚假投资理财首脑",
    scale: 1.8,
    summonTypeId: "investApp",
    summonInterval: 3.5,
    summonCount: 2,
    summonLane: 0,
    enrageAtHp: 0.55,
    enrageSpeedMul: 1.5,
    enrageDamageMul: 1.5,
    skillName: "金流反噬",
    skillDesc: "召唤理财 APP 反弹 20% 投射物伤害",
    element: "money",
    shape: "wallet",
    phases: [
      { atHp: 0.6, name: "平台暴雷", desc: "召唤数 ×2", effect: "doubleSummon", value: 2 },
      { atHp: 0.3, name: "金钟反伤", desc: "敌人反射 20% 伤害 + 速度 ×1.5", effect: "reflect" },
    ],
    isNew: true,
  },
  {
    id: "boss_loan",
    name: "校园贷毒瘤 · 蜡笔老哥",
    emoji: "📚",
    hp: 980,
    speed: 36,
    damage: 50,
    reward: 1300,
    color: "#9B59B6",
    fraudType: "注销校园贷诈骗首脑",
    scale: 1.7,
    summonTypeId: "loanCancel",
    summonInterval: 3.8,
    summonCount: 2,
    summonLane: 2,
    enrageAtHp: 0.5,
    enrageSpeedMul: 1.7,
    enrageDamageMul: 1.5,
    skillName: "注销恐吓",
    skillDesc: "高伤冲锋 + 召唤注销校园贷小怪恐惧附近探员",
    element: "threat",
    shape: "briefcase",
    phases: [
      { atHp: 0.6, name: "连环恐吓", desc: "召唤数 ×2", effect: "doubleSummon", value: 2 },
      { atHp: 0.3, name: "末日冲锋", desc: "速度 ×1.7，伤害 ×1.5", effect: "enrage" },
    ],
    isNew: true,
  },
  // ===== v10 新增：2026 新型诈骗 BOSS（桥接 fraudBuster F87/F45 案例库）=====
  {
    id: "boss_deepseek",
    name: "DeepSeek 仿冒客服王 · AI 假助手",
    emoji: "🤖",
    hp: 1100,
    speed: 36,
    damage: 42,
    reward: 1300,
    color: "#00BFA5",
    fraudType: "DeepSeek 大模型仿冒客服",
    scale: 1.6,
    summonTypeId: "deepseekFake",
    summonInterval: 4,
    summonCount: 2,
    summonLane: 1,
    enrageAtHp: 0.45,
    enrageSpeedMul: 1.6,
    enrageDamageMul: 1.4,
    skillName: "AI 假客服诱导",
    skillDesc: "召唤 DeepSeek 仿冒客服 + 共享屏幕恐吓",
    element: "tech",
    shape: "phone",
    phases: [
      { atHp: 0.6, name: "AI 仿声", desc: "召唤数 ×2，间歇伪装难辨真伪", effect: "doubleSummon", value: 2 },
      { atHp: 0.3, name: "屏幕共享胁迫", desc: "速度 ×1.6，伤害 ×1.4", effect: "enrage" },
    ],
    dialogue: {
      bossId: "boss_deepseek",
      intro: [
        { speaker: "DeepSeek 仿冒客服王", emoji: "🤖", text: "您好，这里是 DeepSeek 官方助手，检测到您的账户异常登录。", color: "#00BFA5", side: "enemy" },
        { speaker: "探员队长", emoji: "🛡️", text: "DeepSeek 官方不会主动来电要求共享屏幕，这是 AI 仿冒。", color: "#1B5FCC", side: "player" },
        { speaker: "DeepSeek 仿冒客服王", emoji: "🤖", text: "不配合将冻结账户，立即下载会议软件共享屏幕核实！", color: "#00BFA5", side: "enemy" },
      ],
      outro: [
        { speaker: "探员队长", emoji: "🛡️", text: "AI 仿声再逼真，官方身份也必须走官方渠道核实。", color: "#1B5FCC", side: "player" },
        { speaker: "DeepSeek 仿冒客服王", emoji: "🤖", text: "语音可以克隆，话术可以照搬，但官方域名只有一个 deepseek.com。", color: "#00BFA5", side: "enemy" },
      ],
    },
    isNew: true,
  },
  {
    id: "boss_aiface",
    name: "AI 换脸操盘手 · 数字熟人",
    emoji: "🎭",
    hp: 1000,
    speed: 40,
    damage: 46,
    reward: 1400,
    color: "#E91E63",
    fraudType: "AI 实时换脸冒充熟人",
    scale: 1.55,
    summonTypeId: "aiFaceSwap",
    summonInterval: 3.5,
    summonCount: 2,
    summonLane: 2,
    enrageAtHp: 0.5,
    enrageSpeedMul: 1.8,
    enrageDamageMul: 1.5,
    skillName: "换脸视频诱导",
    skillDesc: "召唤 AI 换脸冒充熟人 + 视频通话伪装",
    element: "emotion",
    shape: "mask",
    phases: [
      { atHp: 0.6, name: "换脸视频", desc: "召唤数 ×2，间歇隐身难辨真伪", effect: "doubleSummon", value: 2 },
      { atHp: 0.3, name: "情感胁迫", desc: "速度 ×1.8，伤害 ×1.5", effect: "enrage" },
    ],
    dialogue: {
      bossId: "boss_aiface",
      intro: [
        { speaker: "AI 换脸操盘手", emoji: "🎭", text: "（视频通话）是我，急用钱，先转我 5 万。", color: "#E91E63", side: "enemy" },
        { speaker: "探员队长", emoji: "🛡️", text: "AI 实时换脸能伪造人脸和声音，单凭视频不能转账。", color: "#1B5FCC", side: "player" },
        { speaker: "AI 换脸操盘手", emoji: "🎭", text: "你看我脸你看我声音，还能有假？快转，急事！", color: "#E91E63", side: "enemy" },
      ],
      outro: [
        { speaker: "探员队长", emoji: "🛡️", text: "AI 换脸再像，也骗不过回拨电话这一关。", color: "#1B5FCC", side: "player" },
        { speaker: "AI 换脸操盘手", emoji: "🎭", text: "换脸易如反掌，验证难如登天，但只要慢一步就能识破我。", color: "#E91E63", side: "enemy" },
      ],
    },
    isNew: true,
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

/** v8 新增：校园反诈主题：清新学院风 */
const THEME_CAMPUS: LevelTheme = {
  bgDeep: "#0E2233",
  gridColor: "rgba(91,192,222,0.07)",
  roadColor: "rgba(91,192,222,0.06)",
  roadLine: "rgba(255,193,7,0.22)",
  silhouetteColor: "rgba(91,192,222,0.20)",
  decoration: "residential",
  decorEmojis: ["🏫", "📚", "🎓", "💻", "🛡", "宣", "防", "讲"],
};

/** v11 新增：AI 与数字资产反诈主题：暗夜赛博紫红（AI/区块链/元宇宙） */
const THEME_CYBER_AI: LevelTheme = {
  bgDeep: "#170A24",
  gridColor: "rgba(156,39,176,0.08)",
  roadColor: "rgba(0,188,212,0.06)",
  roadLine: "rgba(255,64,129,0.24)",
  silhouetteColor: "rgba(156,39,176,0.22)",
  decoration: "city",
  decorEmojis: ["🤖", "⛓️", "💎", "📡", "🛡", "AI", "链", "识"],
};

/**
 * 5 级关卡配置
 * - Level 1 社区反诈：基础话术与钓鱼，10 波过关
 * - Level 2 市级反诈：进阶情感与恐吓，15 波过关
 * - Level 3 跨境反诈：全类型 + mini-boss，20 波后无尽
 * - Level 4 校园反诈（v8 新增）：校园贷/虚假招聘/票务，12 波过关
 * - Level 5 数智反诈（v11 新增）：AI换脸/勒索/数字钱包/杀猪盘/元宇宙，20 波过关
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
  // ===== v8 新增：校园反诈关卡 =====
  {
    id: 4,
    name: "校园反诈",
    subtitle: "校园级 · 校园贷/虚假招聘/票务",
    accent: "#5BC0DE",
    targetWave: 12,
    enemyTypes: ["robot", "loanCancel", "fakeRecruit", "ticketFraud", "flightChange", "fakeAccident"],
    hpMul: 1.2,
    speedMul: 1.0,
    dmgMul: 0.9,
    rewardMul: 1.3,
    spawnIntervalMul: 1.0,
    countMul: 1.0,
    hasBoss: true,
    unlockCultAgentIdx: 0,
    theme: THEME_CAMPUS,
  },
  // ===== v11 新增：AI 与数字资产反诈关卡（2026 新型诈骗主战场） =====
  {
    id: 5,
    name: "数智反诈",
    subtitle: "AI纪元 · 换脸/勒索/数字钱包/元宇宙",
    accent: "#9C27B0",
    targetWave: 20,
    enemyTypes: [
      "aiRealtimeFaceSwap", "aiBlackmail", "deepfakeVideoCall",
      "digitalRmbAuth", "fakeDigitalWallet", "fakeSmartContract",
      "cryptoPigButcher", "nftAirdropPhish", "metaverseLand",
      "aiInvestAdvisor", "aiPhishingSite", "aiCustomerService",
    ],
    hpMul: 1.8,
    speedMul: 1.15,
    dmgMul: 1.4,
    rewardMul: 1.8,
    spawnIntervalMul: 0.8,
    countMul: 1.25,
    hasBoss: true,
    unlockCultAgentIdx: 2,
    theme: THEME_CYBER_AI,
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

// ====================================================================
// v6 全面升级：BOSS 剧情对话（8 个 BOSS × intro/outro 各 3-4 句）
// ====================================================================

export const BOSS_DIALOGUES: BossDialogue[] = [
  {
    bossId: "boss_farmer",
    intro: [
      { speaker: "钱叔", emoji: "💳", text: "年轻人，你查不到我的，银行卡都是别人名字。", color: "#B388FF", side: "enemy" },
      { speaker: "沈锋", emoji: "🔫", text: "断卡行动早已启动，你的卡池我们一清二楚。", color: "#FF7A1A", side: "player" },
      { speaker: "钱叔", emoji: "💳", text: "哼，金流走 7 道壳，你追得上吗？", color: "#B388FF", side: "enemy" },
    ],
    outro: [
      { speaker: "沈锋", emoji: "🔫", text: "7 层壳，全部冻结。从今天起你只剩 96110 一个号能打。", color: "#FF7A1A", side: "player" },
      { speaker: "钱叔", emoji: "💳", text: "……我认。但你们追不完所有卡农。", color: "#B388FF", side: "enemy" },
      { speaker: "苏岩", emoji: "📊", text: "数据会追完。下一个，已经在名单上。", color: "#FFD666", side: "player" },
    ],
  },
  {
    bossId: "boss_sweet",
    intro: [
      { speaker: "婉清", emoji: "💔", text: "哥哥，咱们存的恋爱基金，可别听外人瞎说。", color: "#FF7AB8", side: "enemy" },
      { speaker: "王婆婆", emoji: "👵", text: "甜言蜜语藏刀子，姑娘我见多了。", color: "#52C41A", side: "player" },
      { speaker: "婉清", emoji: "💔", text: "婆婆你不懂，这是真心。", color: "#FF7AB8", side: "enemy" },
    ],
    outro: [
      { speaker: "王婆婆", emoji: "👵", text: "真心不会让你转账。每一句甜话，都是钩子。", color: "#52C41A", side: "player" },
      { speaker: "婉清", emoji: "💔", text: "……下一个目标，还会有人上钩的。", color: "#FF7AB8", side: "enemy" },
      { speaker: "苏岩", emoji: "📊", text: "杀猪盘必破，下个窝点坐标已锁定。", color: "#FFD666", side: "player" },
    ],
  },
  {
    bossId: "boss_popup",
    intro: [
      { speaker: "客服007", emoji: "💬", text: "您好，您的订单异常，需要点击链接处理～", color: "#FFB020", side: "enemy" },
      { speaker: "林书影", emoji: "📡", text: "96110 不会主动发链接，挂了。", color: "#00E5FF", side: "player" },
      { speaker: "客服007", emoji: "💬", text: "哎呀别急嘛，链接里有您的赔付～", color: "#FFB020", side: "enemy" },
    ],
    outro: [
      { speaker: "林书影", emoji: "📡", text: "假客服必挂，真客服不催。弹窗一万次也无效。", color: "#00E5FF", side: "player" },
      { speaker: "客服007", emoji: "💬", text: "……脚本被识破，下个号再来。", color: "#FFB020", side: "enemy" },
    ],
  },
  {
    bossId: "boss_threat",
    intro: [
      { speaker: "假警官", emoji: "📞", text: "你涉嫌洗钱，立即按我说的操作，否则拘捕！", color: "#E5353B", side: "enemy" },
      { speaker: "陈默", emoji: "🥷", text: "公检法不电办，更不会让你转账到「安全账户」。", color: "#E5353B", side: "player" },
      { speaker: "假警官", emoji: "📞", text: "你敢挂？后果自负！", color: "#E5353B", side: "enemy" },
    ],
    outro: [
      { speaker: "陈默", emoji: "🥷", text: "挂了。你那张拘捕令是 PS 的，背景字体都对不上。", color: "#E5353B", side: "player" },
      { speaker: "假警官", emoji: "📞", text: "……你怎么知道？", color: "#E5353B", side: "enemy" },
      { speaker: "林书影", emoji: "📡", text: "因为你的剧本，96110 一天能接 200 个。", color: "#00E5FF", side: "player" },
    ],
  },
  {
    bossId: "boss_kingpin",
    intro: [
      { speaker: "缅北枭雄", emoji: "👑", text: "跨境？你们管不到这里。", color: "#FF3B6B", side: "enemy" },
      { speaker: "跨境联络官", emoji: "🌐", text: "国际刑警已经协调完毕，今天就是终点。", color: "#FF8A3D", side: "player" },
      { speaker: "缅北枭雄", emoji: "👑", text: "哼，我的园区千名「员工」，你们抓得完？", color: "#FF3B6B", side: "enemy" },
      { speaker: "陈默", emoji: "🥷", text: "卧底三年，名单我都带回去了。", color: "#E5353B", side: "player" },
    ],
    outro: [
      { speaker: "跨境联络官", emoji: "🌐", text: "跨境必究。你的园区今日清零。", color: "#FF8A3D", side: "player" },
      { speaker: "缅北枭雄", emoji: "👑", text: "……还会有下一个园区。", color: "#FF3B6B", side: "enemy" },
      { speaker: "沈锋", emoji: "🔫", text: "那就逐个清。反诈没有终点。", color: "#FF7A1A", side: "player" },
    ],
  },
  {
    bossId: "boss_deepfake",
    intro: [
      { speaker: "镜像", emoji: "🎭", text: "（模仿你母亲的声音）孩子，妈急用钱，转 5 万过来。", color: "#A8E6CF", side: "enemy" },
      { speaker: "AI 鉴伪师", emoji: "🤖", text: "AI 换脸。声纹有 3 处合成痕迹，视频眨眼频率异常。", color: "#A8E6CF", side: "player" },
      { speaker: "镜像", emoji: "🎭", text: "你识破了？那再看我这张脸——", color: "#A8E6CF", side: "enemy" },
    ],
    outro: [
      { speaker: "AI 鉴伪师", emoji: "🤖", text: "每一帧合成都有破绽，AI 鉴伪一直在升级。", color: "#A8E6CF", side: "player" },
      { speaker: "镜像", emoji: "🎭", text: "……技术也会进化。", color: "#A8E6CF", side: "enemy" },
      { speaker: "周衡", emoji: "💻", text: "那就比谁快。下一个换脸样本，已入库训练。", color: "#B388FF", side: "player" },
    ],
  },
  {
    bossId: "boss_invest",
    intro: [
      { speaker: "钱生钱", emoji: "💰", text: "稳赚不赔，年化 30%，老师带单，错过等一年。", color: "#FF6B9D", side: "enemy" },
      { speaker: "法务审计师", emoji: "⚖️", text: "持牌机构查询不到你，这不是理财，是资金盘。", color: "#3D8BFD", side: "player" },
      { speaker: "钱生钱", emoji: "💰", text: "你看群里晒单，谁都在赚～", color: "#FF6B9D", side: "enemy" },
    ],
    outro: [
      { speaker: "法务审计师", emoji: "⚖️", text: "理财认持牌，群里的晒单都是托。平台今天崩盘。", color: "#3D8BFD", side: "player" },
      { speaker: "钱生钱", emoji: "💰", text: "……本金已经转移。", color: "#FF6B9D", side: "enemy" },
      { speaker: "苏岩", emoji: "📊", text: "资金链我们追得到。下一个盘，提前预警。", color: "#FFD666", side: "player" },
    ],
  },
  {
    bossId: "boss_loan",
    intro: [
      { speaker: "蜡笔老哥", emoji: "📚", text: "同学，不注销校园贷影响征信，按我操作就能洗白。", color: "#9B59B6", side: "enemy" },
      { speaker: "数据预测师", emoji: "🔮", text: "校园贷注销是骗局。征信只能本人到央行查。", color: "#00C9A7", side: "player" },
      { speaker: "蜡笔老哥", emoji: "📚", text: "你懂什么？这可是内部政策！", color: "#9B59B6", side: "enemy" },
    ],
    outro: [
      { speaker: "数据预测师", emoji: "🔮", text: "校园贷骗局必破，「内部政策」是假的，恐吓是真的。", color: "#00C9A7", side: "player" },
      { speaker: "蜡笔老哥", emoji: "📚", text: "……新学期还有新生上钩。", color: "#9B59B6", side: "enemy" },
      { speaker: "王婆婆", emoji: "👵", text: "所以我们进校园宣讲，一届一届讲下去。", color: "#52C41A", side: "player" },
    ],
  },
];

/** 根据 BOSS id 取剧情对话 */
export function getBossDialogue(bossId: string): BossDialogue | undefined {
  return BOSS_DIALOGUES.find((d) => d.bossId === bossId);
}

// ====================================================================
// v6 全面升级：战间答题题库（25 题，覆盖 10+ 诈骗类型）
// 每波 5 的倍数弹出 1 题，答对获 buff
// ====================================================================

export const QUIZ_BANK: QuizQuestion[] = [
  {
    id: "q01",
    question: "接到自称「96110」的电话，对方说涉嫌洗钱要你转账到「安全账户」，该怎么办？",
    options: ["立即转账配合调查", "挂断并拨打 110 核实", "按对方要求下载 APP", "提供银行卡密码"],
    correctIdx: 1,
    explanation: "公检法不会电话办案，更不存在「安全账户」。96110 是反诈专线，不会让你转账。",
    fraudType: "冒充公检法",
    difficulty: 1,
  },
  {
    id: "q02",
    question: "网友推荐「稳赚不赔」的理财 APP，老师带单、群内晒单，下列判断正确的是？",
    options: ["立即跟单赚一笔", "先小额试水再加大投入", "持牌金融机构名录里查不到就是骗局", "把养老金 all in"],
    correctIdx: 2,
    explanation: "理财认持牌。可在证监会、银保监会官网核查机构资质，查不到的一律是资金盘。",
    fraudType: "虚假投资理财",
    difficulty: 2,
  },
  {
    id: "q03",
    question: "收到「ETC 过期/禁用」短信，附带链接要求补办，正确做法是？",
    options: ["点链接补办", "回拨短信中的电话", "通过 ETC 发行方官方 APP/客服核实", "把卡号发过去"],
    correctIdx: 2,
    explanation: "ETC 官方办。ETC 不会以短信链接形式索要银行卡、密码、验证码。",
    fraudType: "ETC 诈骗",
    difficulty: 1,
  },
  {
    id: "q04",
    question: "视频里「妈妈」说急用钱让你转 5 万，但画面有些卡顿，最稳妥的做法是？",
    options: ["立即转账", "换个话题问只有家人知道的事核实", "按对方要求下载借款 APP", "拉黑所有家人"],
    correctIdx: 1,
    explanation: "AI 换脸核实。换脸视频常有卡顿、眨眼异常。换话题问私密信息是最快的核实方式。",
    fraudType: "AI 换脸冒充熟人",
    difficulty: 3,
  },
  {
    id: "q05",
    question: "客服主动来电说「商品质量问题双倍退款」，要求下载会议 APP 共享屏幕，这是？",
    options: ["真客服，配合操作", "骗局，共享屏幕会泄露验证码", "把短信验证码读给对方加速办理", "把银行卡密码告诉对方"],
    correctIdx: 1,
    explanation: "退费走官方。共享屏幕=对方能看到你的所有验证码和密码，立即挂断并退出屏幕共享。",
    fraudType: "冒充客服退费",
    difficulty: 2,
  },
  {
    id: "q06",
    question: "初恋网恋对象聊了 3 个月，从未见面，今天让你转账一起「投资」买币，应该？",
    options: ["转账，真爱无价", "拒绝，并在平台举报", "借钱也要转", "把朋友也拉进来"],
    correctIdx: 1,
    explanation: "网恋不转账。杀猪盘核心是养-杀-收割，凡是没见过面就让你投资的，100% 是骗局。",
    fraudType: "杀猪盘情感诈骗",
    difficulty: 2,
  },
  {
    id: "q07",
    question: "自称「领导」加微信，让你帮忙转一笔钱给他「客户」，事后还你，怎么办？",
    options: ["立即转账帮领导办事", "换渠道（电话/当面）核实领导本人", "把同事也叫上一起转", "把公司账户信息发过去"],
    correctIdx: 1,
    explanation: "领导转账核实。冒充领导诈骗常用「在开会不方便接电话」阻挠核实，必须换渠道确认。",
    fraudType: "冒充领导熟人",
    difficulty: 2,
  },
  {
    id: "q08",
    question: "收到「校园贷记录影响征信，需注销」的电话，对方能报出你的身份证号，是否可信？",
    options: ["可信，立即配合注销", "不可信，征信只能本人到央行或官方渠道查询", "把银行卡给对方操作", "按指引网贷注销"],
    correctIdx: 1,
    explanation: "注销校园贷是骗。信息泄露不等于对方资质真实，「注销校园贷」本身就是伪需求。",
    fraudType: "注销校园贷",
    difficulty: 2,
  },
  {
    id: "q09",
    question: "短信附带的链接显示「银行积分兑换现金」，点了输入密码后钱没了，问题出在哪一步？",
    options: ["银行系统故障", "点击了钓鱼链接，输入了密码", "手机中毒", "运营商问题"],
    correctIdx: 1,
    explanation: "不点陌生链。钓鱼链接会伪装成银行页面套取密码，凡涉及输入密码的链接一律从官方 APP 进入。",
    fraudType: "钓鱼网站盗刷",
    difficulty: 1,
  },
  {
    id: "q10",
    question: "有人高价租你的银行卡/电话卡，每月 2000 元，应该？",
    options: ["租出去赚零花", "拒绝，买卖/出租两卡涉嫌帮信罪", "把亲戚的卡也介绍过去", "先租一张试试"],
    correctIdx: 1,
    explanation: "不租售两卡。出租银行卡给诈骗团伙走账，构成帮助信息网络犯罪活动罪，最高 3 年有期徒刑。",
    fraudType: "买卖银行卡洗钱",
    difficulty: 2,
  },
  {
    id: "q11",
    question: "陌生邮件附件是「面试通知.doc」，打开后要求「启用宏」，正确做法是？",
    options: ["启用宏查看", "删除邮件，不启用宏", "把附件转发给同事", "回复提供身份证"],
    correctIdx: 1,
    explanation: "陌生附件的「启用宏」常携带宏病毒，可窃取密码、加密文件。直接删除最稳妥。",
    fraudType: "钓鱼邮件",
    difficulty: 2,
  },
  {
    id: "q12",
    question: "中奖短信要求先交 200 元「手续费」才能领奖，下列说法正确的是？",
    options: ["先交钱拿大奖", "正规中奖不收费，是骗局", "把朋友也叫来分摊", "提供银行卡号接收"],
    correctIdx: 1,
    explanation: "正规中奖不收费。任何「先交钱才能领奖」的均为骗局，包括手续费、公证费、保证金。",
    fraudType: "中奖诈骗",
    difficulty: 1,
  },
  {
    id: "q13",
    question: "客服说你的快递丢了要理赔，让你下载 APP 开启「屏幕共享」指导操作，应该？",
    options: ["下载并共享屏幕", "拒绝，挂断后通过官方渠道核实", "把短信验证码读给对方", "把银行卡号给对方"],
    correctIdx: 1,
    explanation: "理赔走官方。屏幕共享=把手机控制权交给对方，所有验证码、密码都会被看到。",
    fraudType: "冒充快递理赔",
    difficulty: 2,
  },
  {
    id: "q14",
    question: "微信收到「朋友」借钱消息，最快的核实方式是？",
    options: ["直接转账", "语音/视频通话确认本人", "看头像一样就借", "把全部积蓄都借"],
    correctIdx: 1,
    explanation: "借钱必核身份。账号被盗用冒充熟人借钱非常常见，语音/视频核实是最快的拦截方式。",
    fraudType: "冒充熟人借钱",
    difficulty: 1,
  },
  {
    id: "q15",
    question: "贷款 APP 显示「额度已批，需先交 1000 元解冻费」才能提现，这是？",
    options: ["交解冻费拿贷款", "骗局，正规贷款不放贷前收费", "再交 2000 加速", "把身份证发过去"],
    correctIdx: 1,
    explanation: "正规贷款不放贷前收费。「解冻费/工本费/保证金」都是套路，交了就再也提不出来。",
    fraudType: "虚假网贷",
    difficulty: 2,
  },
  {
    id: "q16",
    question: "收到「刷单返现」任务，第 1 单返了 10 元，第 2 单让你垫 5000 元，是否继续？",
    options: ["继续垫 5000", "立即停止，前期返利是诱饵", "再拉朋友一起刷", "把信用卡额度刷满"],
    correctIdx: 1,
    explanation: "刷单本身违法，且 100% 是骗局。前期小额返利是为了套住你做大单，做大单必失本金。",
    fraudType: "刷单返利",
    difficulty: 2,
  },
  {
    id: "q17",
    question: "陌生人加 QQ 说「内部数据包赢彩票/赌球」，让你下载 APP 充值，下列判断正确的是？",
    options: ["充值跟单", "骗局，赌博+虚假平台双套", "把家里房产抵押跟单", "拉同事一起充"],
    correctIdx: 1,
    explanation: "内部数据是假，平台是真骗。后台操控输赢，充值后无法提现，是典型跨境赌博+诈骗。",
    fraudType: "跨境赌博诈骗",
    difficulty: 3,
  },
  {
    id: "q18",
    question: "在二手平台买演唱会门票，对方要求加微信私下转账，正确做法是？",
    options: ["加微信转账", "坚持平台担保交易", "把身份证发给对方", "先转 50% 定金"],
    correctIdx: 1,
    explanation: "私下交易无担保。一旦脱离平台，钱款无法追回，且门票可能是伪造或同一票卖多人。",
    fraudType: "二手票务诈骗",
    difficulty: 1,
  },
  {
    id: "q19",
    question: "陌生二维码扫出来是「红包」页面，要输入银行卡号+密码才能领取，应该？",
    options: ["输入领取", "拒绝，正规红包不索取密码", "把验证码也发过去", "把卡号给同事代领"],
    correctIdx: 1,
    explanation: "红包不索取密码。任何要求输入银行卡密码的「红包」都是钓鱼，扫码即套信息。",
    fraudType: "二维码钓鱼",
    difficulty: 1,
  },
  {
    id: "q20",
    question: "自称「航班通知」短信说航班取消，要求改签并收取改签费，应该？",
    options: ["按短信链接改签", "拨打航空公司官方客服核实", "把身份证号发过去", "把银行卡给对方退票"],
    correctIdx: 1,
    explanation: "航班改签走官方。骗子常利用真实航班信息行骗，「改签费/退票费」都是套取支付密码的诱饵。",
    fraudType: "机票退改签诈骗",
    difficulty: 2,
  },
  {
    id: "q21",
    question: "陌生人来电称你「涉嫌犯罪」，要求添加 QQ 接受「在线调查」，应该？",
    options: ["加 QQ 配合调查", "挂断，公检法不会用 QQ 办案", "按对方要求视频", "提供银行流水"],
    correctIdx: 1,
    explanation: "公检法不电办，更不会用 QQ/微信办案。所有「在线调查」都是为了让受害人主动操作转账。",
    fraudType: "冒充公检法",
    difficulty: 1,
  },
  {
    id: "q22",
    question: "收到「医保卡异常停用」短信，附链接要求补全信息，下列说法正确的是？",
    options: ["点链接补全", "骗局，医保局不通过短信链接采集信息", "把社保号发过去", "把密码告诉对方"],
    correctIdx: 1,
    explanation: "医保卡异常请到医保局官方渠道查询。短信链接多为钓鱼，目的在套取身份证、银行卡信息。",
    fraudType: "冒充医保社保",
    difficulty: 2,
  },
  {
    id: "q23",
    question: "电话里有人说「你孩子出车祸了，急需手术费 3 万」，第一时间应该？",
    options: ["立即转账救人", "挂断后直接联系孩子本人/学校核实", "把全部家当都转", "按对方要求不挂电话"],
    correctIdx: 1,
    explanation: "亲属出事必核实。骗子利用家人焦虑情绪，要求保持通话不让你核实，挂断后联系本人是第一步。",
    fraudType: "虚构意外诈骗",
    difficulty: 2,
  },
  {
    id: "q24",
    question: "在求职平台上，HR 让你下载第三方 APP 完成「入职测评」并交押金，这是？",
    options: ["下载并交押金", "骗局，正规招聘不收押金、不强制第三方 APP", "把身份证扫描件发过去", "把银行卡给对方"],
    correctIdx: 1,
    explanation: "招聘不收押金，入职不收费。第三方 APP 测评常是钓鱼或刷单引流，正规公司有自有招聘流程。",
    fraudType: "虚假招聘诈骗",
    difficulty: 2,
  },
  {
    id: "q25",
    question: "陌生号码发来彩信，附「看你老婆/老公的视频」链接，应该？",
    options: ["立即点开看", "删除，链接多为木马或勒索", "把链接转发给朋友", "输入密码查看"],
    correctIdx: 1,
    explanation: "隐私窥探+木马链接是常见组合。点开后可能导致手机被控、通讯录被读取、被勒索。",
    fraudType: "木马勒索",
    difficulty: 3,
  },
];

/** 按难度抽取题目（每 5 波弹 1 题，难度递增） */
export function pickQuiz(wave: number, seed: string): QuizQuestion {
  // 难度按波数决定：1-10 简单，11-20 中等，21+ 困难
  const difficulty = (wave <= 10 ? 1 : wave <= 20 ? 2 : 3) as 1 | 2 | 3;
  const pool = QUIZ_BANK.filter((q) => q.difficulty === difficulty);
  // 简单 seed-based 选择
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const idx = hash % pool.length;
  return pool[idx];
}

// ====================================================================
// v6 全面升级：战术装置系统（3 种，每局限 3 个）
// ====================================================================

export const TACTICAL_DEVICES: TacticalDeviceDef[] = [
  {
    kind: "barrier",
    name: "路障",
    emoji: "🚧",
    desc: "在指定位置放置路障，路径上敌人减速 60%，持续 4 秒",
    color: "#FFB020",
    duration: 4,
    cooldown: 12,
    radius: 50,
    effect: { kind: "slow", mul: 0.4 },
  },
  {
    kind: "decoy",
    name: "诱饵",
    emoji: "🎯",
    desc: "放置诱饵吸引附近敌人，嘲讽 5 秒，敌人改向诱饵移动",
    color: "#1AD670",
    duration: 5,
    cooldown: 18,
    radius: 120,
    effect: { kind: "taunt" },
  },
  {
    kind: "emp",
    name: "EMP 脉冲",
    emoji: "⚡",
    desc: "释放电磁脉冲，眩晕范围内敌人 2 秒，无法移动/攻击",
    color: "#00E5FF",
    duration: 2,
    cooldown: 22,
    radius: 100,
    effect: { kind: "stun", duration: 2 },
  },
];

// ====================================================================
// v6 全面升级：元素反应系统（5 系叠加触发场地效果）
// ====================================================================

export const ELEMENT_REACTIONS: ElementReactionDef[] = [
  {
    kind: "steam",
    name: "蒸汽隐匿",
    emoji: "💨",
    desc: "tech + emotion → 探员短暂无敌 2 秒",
    color: "#A8E6CF",
    requiredElements: ["tech", "emotion"],
    duration: 2,
    effect: { kind: "agentInvuln", duration: 2 },
  },
  {
    kind: "overload",
    name: "过载眩晕",
    emoji: "⚡",
    desc: "tech + threat → 范围 120 内敌人眩晕 1.5 秒",
    color: "#00E5FF",
    requiredElements: ["tech", "threat"],
    duration: 1.5,
    effect: { kind: "enemyStun", radius: 120, duration: 1.5 },
  },
  {
    kind: "freeze",
    name: "冰冻减速",
    emoji: "❄️",
    desc: "law + money → 路径敌人减速 60%（3 秒）",
    color: "#B388FF",
    requiredElements: ["law", "money"],
    duration: 3,
    effect: { kind: "enemySlow", mul: 0.4, duration: 3, radius: 9999 },
  },
  {
    kind: "burn",
    name: "灼烧连击",
    emoji: "🔥",
    desc: "threat + emotion → 范围 100 内敌人每秒受 15 点伤害（4 秒）",
    color: "#FF7A1A",
    requiredElements: ["threat", "emotion"],
    duration: 4,
    effect: { kind: "enemyBurn", dmgPerSec: 15, duration: 4, radius: 100 },
  },
  {
    kind: "conductivity",
    name: "传导伤害",
    emoji: "🔌",
    desc: "tech + money → 范围 120 内敌人受伤 +50%（3 秒）",
    color: "#FFD666",
    requiredElements: ["tech", "money"],
    duration: 3,
    effect: { kind: "enemyChain", dmgMul: 1.5, radius: 120 },
  },
  {
    kind: "resonance",
    name: "元素共振",
    emoji: "🌀",
    desc: "3+ 同元素探员 → 全队伤害 +30%（5 秒）",
    color: "#FF7AB8",
    requiredElements: ["law", "law"],
    duration: 5,
    effect: { kind: "damageBoost", mul: 1.3, duration: 5 },
  },
];

/** 检测当前部署探员触发的元素反应（按元素分布） */
export function detectElementReactions(agentElements: Element[]): ElementReactionDef[] {
  const triggered: ElementReactionDef[] = [];
  const counts: Record<Element, number> = { law: 0, tech: 0, emotion: 0, threat: 0, money: 0 };
  for (const e of agentElements) counts[e] = (counts[e] || 0) + 1;

  for (const reaction of ELEMENT_REACTIONS) {
    if (reaction.kind === "resonance") {
      // 任一元素 ≥ 3 即触发
      if (Object.values(counts).some((c) => c >= 3)) {
        triggered.push(reaction);
      }
    } else {
      const [a, b] = reaction.requiredElements;
      if (a === b) {
        if (counts[a] >= 2) triggered.push(reaction);
      } else {
        if (counts[a] >= 1 && counts[b] >= 1) triggered.push(reaction);
      }
    }
  }
  return triggered;
}

// ====================================================================
// v6 全面升级：天赋树（10 探员 × 3 分支 × 5 层）
// 通过紧凑配置 + builder 生成，避免冗余
// ====================================================================

/** 紧凑天赋节点配置（用于 builder） */
interface TalentSpec {
  branch: TalentBranch;
  tier: number;
  name: string;
  desc: string;
  cost: number;
  emoji: string;
  effect: TalentEffect;
}

/** 单探员天赋树 spec */
const TALENT_SPECS: Record<string, TalentSpec[]> = {
  shen: [
    // 攻系：资金斩断
    { branch: "offense", tier: 1, name: "审计入门", desc: "攻击力 +10", cost: 50, emoji: "⚔️", effect: { kind: "attackFlat", value: 10 } },
    { branch: "offense", tier: 2, name: "穿透弹", desc: "攻击力 +15%", cost: 120, emoji: "🎯", effect: { kind: "attackPct", value: 0.15 } },
    { branch: "offense", tier: 3, name: "资金链断裂", desc: "攻击力 +25", cost: 220, emoji: "⛓️", effect: { kind: "attackFlat", value: 25 } },
    { branch: "offense", tier: 4, name: "大招充能", desc: "大招充能倍率 +50%", cost: 380, emoji: "⚡", effect: { kind: "ultChargeMul", value: 1.5 } },
    { branch: "offense", tier: 5, name: "终极斩断", desc: "大招威力 +60%", cost: 600, emoji: "💥", effect: { kind: "ultPowerMul", value: 1.6 } },
    // 防系：刑侦老炮
    { branch: "defense", tier: 1, name: "防弹背心", desc: "生命值 +30", cost: 50, emoji: "🛡️", effect: { kind: "hpFlat", value: 30 } },
    { branch: "defense", tier: 2, name: "情报护甲", desc: "生命值 +15%", cost: 120, emoji: "🪖", effect: { kind: "hpPct", value: 0.15 } },
    { branch: "defense", tier: 3, name: "韧性", desc: "生命值 +60", cost: 220, emoji: "💪", effect: { kind: "hpFlat", value: 60 } },
    { branch: "defense", tier: 4, name: "战术冷却", desc: "战术装置冷却缩减 +20%", cost: 380, emoji: "⏱️", effect: { kind: "cooldownReduce", value: 0.2 } },
    { branch: "defense", tier: 5, name: "刑侦之躯", desc: "生命值 +25%", cost: 600, emoji: "🦾", effect: { kind: "hpPct", value: 0.25 } },
    // 辅系：法律专精
    { branch: "support", tier: 1, name: "范围扩展", desc: "射程 +10%", cost: 50, emoji: "🔭", effect: { kind: "rangePct", value: 0.1 } },
    { branch: "support", tier: 2, name: "射速训练", desc: "射速 +12%", cost: 120, emoji: "🔫", effect: { kind: "fireratePct", value: 0.12 } },
    { branch: "support", tier: 3, name: "法律克制", desc: "法律元素伤害 +30%", cost: 220, emoji: "⚖️", effect: { kind: "elementBonus", element: "law", value: 0.3 } },
    { branch: "support", tier: 4, name: "精准", desc: "暴击率 +15%", cost: 380, emoji: "🎯", effect: { kind: "critRate", value: 0.15 } },
    { branch: "support", tier: 5, name: "致命一击", desc: "暴击伤害 +50%", cost: 600, emoji: "☄️", effect: { kind: "critDmg", value: 0.5 } },
  ],
  lin: [
    { branch: "offense", tier: 1, name: "信号增强", desc: "攻击力 +8", cost: 50, emoji: "📡", effect: { kind: "attackFlat", value: 8 } },
    { branch: "offense", tier: 2, name: "干扰加深", desc: "大招充能 +40%", cost: 120, emoji: "⚡", effect: { kind: "ultChargeMul", value: 1.4 } },
    { branch: "offense", tier: 3, name: "高频信号", desc: "射速 +20%", cost: 220, emoji: "🎯", effect: { kind: "fireratePct", value: 0.2 } },
    { branch: "offense", tier: 4, name: "技术专精", desc: "技术元素伤害 +40%", cost: 380, emoji: "💻", effect: { kind: "elementBonus", element: "tech", value: 0.4 } },
    { branch: "offense", tier: 5, name: "全频阻断", desc: "大招威力 +70%", cost: 600, emoji: "💥", effect: { kind: "ultPowerMul", value: 1.7 } },
    { branch: "defense", tier: 1, name: "话务护盾", desc: "生命值 +20", cost: 50, emoji: "🛡️", effect: { kind: "hpFlat", value: 20 } },
    { branch: "defense", tier: 2, name: "远程布防", desc: "射程 +15%", cost: 120, emoji: "🔭", effect: { kind: "rangePct", value: 0.15 } },
    { branch: "defense", tier: 3, name: "韧性训练", desc: "生命值 +40", cost: 220, emoji: "💪", effect: { kind: "hpFlat", value: 40 } },
    { branch: "defense", tier: 4, name: "战术冷却", desc: "战术装置冷却缩减 +20%", cost: 380, emoji: "⏱️", effect: { kind: "cooldownReduce", value: 0.2 } },
    { branch: "defense", tier: 5, name: "96110 之盾", desc: "生命值 +25%", cost: 600, emoji: "🦾", effect: { kind: "hpPct", value: 0.25 } },
    { branch: "support", tier: 1, name: "射速训练", desc: "射速 +10%", cost: 50, emoji: "🔫", effect: { kind: "fireratePct", value: 0.1 } },
    { branch: "support", tier: 2, name: "暴击训练", desc: "暴击率 +12%", cost: 120, emoji: "🎯", effect: { kind: "critRate", value: 0.12 } },
    { branch: "support", tier: 3, name: "范围扩展", desc: "射程 +18%", cost: 220, emoji: "🔭", effect: { kind: "rangePct", value: 0.18 } },
    { branch: "support", tier: 4, name: "暴击强化", desc: "暴击伤害 +40%", cost: 380, emoji: "☄️", effect: { kind: "critDmg", value: 0.4 } },
    { branch: "support", tier: 5, name: "狙击大师", desc: "暴击率 +20%", cost: 600, emoji: "🎯", effect: { kind: "critRate", value: 0.2 } },
  ],
  // 其余 8 探员使用通用模板（按元素系定制 tier 3/4 的 elementBonus）
  zhou: buildGenericSpecs("zhou", "tech"),
  wang: buildGenericSpecs("wang", "emotion"),
  su: buildGenericSpecs("su", "law"),
  chen: buildGenericSpecs("chen", "threat"),
  fayi: buildGenericSpecs("fayi", "law"),
  yuce: buildGenericSpecs("yuce", "tech"),
  kuajing: buildGenericSpecs("kuajing", "threat"),
  jianwei: buildGenericSpecs("jianwei", "tech"),
};

/** 通用天赋模板：攻/防/辅三系五层，tier 3/4 按 element 加成 */
function buildGenericSpecs(_agentId: string, element: Element): TalentSpec[] {
  return [
    { branch: "offense", tier: 1, name: "攻击 I", desc: "攻击力 +8", cost: 50, emoji: "⚔️", effect: { kind: "attackFlat", value: 8 } },
    { branch: "offense", tier: 2, name: "攻击 II", desc: "攻击力 +12%", cost: 120, emoji: "🎯", effect: { kind: "attackPct", value: 0.12 } },
    { branch: "offense", tier: 3, name: `${ELEMENTS[element].name}专精`, desc: `${ELEMENTS[element].name}元素伤害 +30%`, cost: 220, emoji: ELEMENTS[element].emoji, effect: { kind: "elementBonus", element, value: 0.3 } },
    { branch: "offense", tier: 4, name: "大招充能", desc: "大招充能 +40%", cost: 380, emoji: "⚡", effect: { kind: "ultChargeMul", value: 1.4 } },
    { branch: "offense", tier: 5, name: "终极之力", desc: "大招威力 +60%", cost: 600, emoji: "💥", effect: { kind: "ultPowerMul", value: 1.6 } },
    { branch: "defense", tier: 1, name: "生命 I", desc: "生命值 +20", cost: 50, emoji: "🛡️", effect: { kind: "hpFlat", value: 20 } },
    { branch: "defense", tier: 2, name: "生命 II", desc: "生命值 +12%", cost: 120, emoji: "🪖", effect: { kind: "hpPct", value: 0.12 } },
    { branch: "defense", tier: 3, name: "生命 III", desc: "生命值 +50", cost: 220, emoji: "💪", effect: { kind: "hpFlat", value: 50 } },
    { branch: "defense", tier: 4, name: "战术冷却", desc: "战术装置冷却缩减 +20%", cost: 380, emoji: "⏱️", effect: { kind: "cooldownReduce", value: 0.2 } },
    { branch: "defense", tier: 5, name: "终极之躯", desc: "生命值 +22%", cost: 600, emoji: "🦾", effect: { kind: "hpPct", value: 0.22 } },
    { branch: "support", tier: 1, name: "射程 I", desc: "射程 +10%", cost: 50, emoji: "🔭", effect: { kind: "rangePct", value: 0.1 } },
    { branch: "support", tier: 2, name: "射速 I", desc: "射速 +10%", cost: 120, emoji: "🔫", effect: { kind: "fireratePct", value: 0.1 } },
    { branch: "support", tier: 3, name: "暴击 I", desc: "暴击率 +12%", cost: 220, emoji: "🎯", effect: { kind: "critRate", value: 0.12 } },
    { branch: "support", tier: 4, name: "暴击伤害", desc: "暴击伤害 +40%", cost: 380, emoji: "☄️", effect: { kind: "critDmg", value: 0.4 } },
    { branch: "support", tier: 5, name: "全能", desc: "攻击 +15% / 生命 +15%", cost: 600, emoji: "✨", effect: { kind: "attackPct", value: 0.15 } },
  ];
}

/** 由 spec 构建完整 TalentTree */
function buildTalentTree(agentId: string, specs: TalentSpec[]): TalentTree {
  const branches: Record<TalentBranch, TalentNode[]> = {
    offense: [],
    defense: [],
    support: [],
  };
  for (const s of specs) {
    branches[s.branch].push({
      id: `${agentId}_${s.branch}_${s.tier}`,
      branch: s.branch,
      tier: s.tier,
      name: s.name,
      desc: s.desc,
      cost: s.cost,
      effect: s.effect,
      emoji: s.emoji,
    });
  }
  // 按层级排序
  branches.offense.sort((a, b) => a.tier - b.tier);
  branches.defense.sort((a, b) => a.tier - b.tier);
  branches.support.sort((a, b) => a.tier - b.tier);
  return { agentId, branches };
}

export const TALENT_TREES: TalentTree[] = Object.entries(TALENT_SPECS).map(([agentId, specs]) =>
  buildTalentTree(agentId, specs)
);

/** 取探员天赋树 */
export function getTalentTree(agentId: string): TalentTree | undefined {
  return TALENT_TREES.find((t) => t.agentId === agentId);
}

// ====================================================================
// v6 全面升级：遗物系统（12 件，common → legendary）
// ====================================================================

export const RELICS: RelicDef[] = [
  // ===== Tier 1 基础遗物（12 件，向后兼容 v6/v7/v8 存档） =====
  { id: "relic_energy_cell", name: "能量电池", emoji: "🔋", desc: "开局能量 +30", rarity: "common", color: "#9FE3FF", effect: { kind: "startEnergy", value: 30 }, source: "boss", tier: 1, decomposeShards: 2 },
  { id: "relic_score_chip", name: "得分芯片", emoji: "📊", desc: "得分倍率 +20%", rarity: "common", color: "#FFD666", effect: { kind: "scoreMul", value: 1.2 }, source: "quiz", tier: 1, decomposeShards: 2 },
  { id: "relic_coin_magnet", name: "金币磁铁", emoji: "🧲", desc: "金币掉落倍率 +30%", rarity: "common", color: "#FFB020", effect: { kind: "coinMul", value: 1.3 }, source: "tower", tier: 1, decomposeShards: 2 },
  { id: "relic_regen_module", name: "回血模块", emoji: "💚", desc: "探员每秒回血 1.5", rarity: "rare", color: "#52C41A", effect: { kind: "agentHpRegen", value: 1.5 }, source: "boss", tier: 1, decomposeShards: 2 },
  { id: "relic_combo_extender", name: "连击稳定器", emoji: "🔗", desc: "连击衰减时间 +3 秒", rarity: "rare", color: "#1AD670", effect: { kind: "comboDecayExtend", value: 3 }, source: "quiz", tier: 1, decomposeShards: 2 },
  { id: "relic_extra_upgrade", name: "战术扩展", emoji: "⬆️", desc: "本局可额外升级 1 次", rarity: "rare", color: "#3D8BFD", effect: { kind: "extraUpgrade", value: 1 }, source: "tower", tier: 1, decomposeShards: 2 },
  { id: "relic_start_shield", name: "基地护盾", emoji: "🛡️", desc: "开局基地获得 30% 护盾", rarity: "rare", color: "#A8E6CF", effect: { kind: "startShield", value: 0.3 }, source: "boss", tier: 1, decomposeShards: 2 },
  { id: "relic_energy_reactor", name: "能量反应堆", emoji: "⚡", desc: "能量回复倍率 +50%", rarity: "epic", color: "#00E5FF", effect: { kind: "energyRegenMul", value: 1.5 }, source: "tower", tier: 1, decomposeShards: 2 },
  { id: "relic_pierce_all", name: "穿透弹幕", emoji: "➡️", desc: "所有投射物穿透所有敌人", rarity: "epic", color: "#FF7A1A", effect: { kind: "pierceAll" }, source: "boss", tier: 1, decomposeShards: 2 },
  { id: "relic_first_free", name: "初次免疫", emoji: "✨", desc: "首次受伤害免疫", rarity: "epic", color: "#FF7AB8", effect: { kind: "firstHitFree" }, source: "quiz", tier: 1, decomposeShards: 2 },
  { id: "relic_revive", name: "复活装置", emoji: "💗", desc: "基地失守时复活一次（30% 血）", rarity: "legendary", color: "#FF3B6B", effect: { kind: "reviveOnce" }, source: "boss", tier: 1, decomposeShards: 2 },
  { id: "relic_lucky_charm", name: "幸运符", emoji: "🍀", desc: "每日挑战运气 +30%（修饰符减一档）", rarity: "legendary", color: "#9D6BFF", effect: { kind: "dailyLuck", value: 0.3 }, source: "tower", tier: 1, decomposeShards: 2 },
  // ===== v9 Tier 2 中级遗物（6 件，3 个 tier-1 合成） =====
  {
    id: "relic_t2_fusion_core", name: "聚变核心", emoji: "🔆", desc: "开局能量 +60（双倍电池）", rarity: "epic", color: "#00E5FF",
    effect: { kind: "doubleStartEnergy", value: 60 }, source: "shop", tier: 2, decomposeShards: 6,
    recipe: { ingredients: ["relic_energy_cell", "relic_energy_reactor", "relic_regen_module"], coinCost: 800 },
  },
  {
    id: "relic_t2_ultima_lens", name: "必杀透镜", emoji: "🎯", desc: "大招威力 +40%", rarity: "epic", color: "#FF7A1A",
    effect: { kind: "ultPowerMul", value: 1.4 }, source: "shop", tier: 2, decomposeShards: 6,
    recipe: { ingredients: ["relic_pierce_all", "relic_combo_extender", "relic_score_chip"], coinCost: 800 },
  },
  {
    id: "relic_t2_boss_breaker", name: "首脑克星", emoji: "🗡️", desc: "对 BOSS 伤害 +50%", rarity: "epic", color: "#FF3B6B",
    effect: { kind: "bossDamageMul", value: 1.5 }, source: "shop", tier: 2, decomposeShards: 6,
    recipe: { ingredients: ["relic_revive", "relic_first_free", "relic_start_shield"], coinCost: 1000 },
  },
  {
    id: "relic_t2_tactical_cpu", name: "战术 CPU", emoji: "🧠", desc: "战术装置冷却缩减 30%", rarity: "epic", color: "#3D8BFD",
    effect: { kind: "cooldownReduce", value: 0.3 }, source: "shop", tier: 2, decomposeShards: 6,
    recipe: { ingredients: ["relic_extra_upgrade", "relic_combo_extender", "relic_coin_magnet"], coinCost: 800 },
  },
  {
    id: "relic_t2_golden_engine", name: "黄金引擎", emoji: "🌟", desc: "得分倍率 +40% / 金币 +50%", rarity: "legendary", color: "#FFD666",
    effect: { kind: "scoreMul", value: 1.4 }, source: "shop", tier: 2, decomposeShards: 6,
    recipe: { ingredients: ["relic_score_chip", "relic_coin_magnet", "relic_lucky_charm"], coinCost: 1200 },
  },
  {
    id: "relic_t2_eternal_guard", name: "永驻防线", emoji: "🛡️", desc: "开局基地护盾 50% / 探员每秒回血 3", rarity: "legendary", color: "#A8E6CF",
    effect: { kind: "startShield", value: 0.5 }, source: "shop", tier: 2, decomposeShards: 6,
    recipe: { ingredients: ["relic_start_shield", "relic_regen_module", "relic_first_free"], coinCost: 1000 },
  },
  // ===== v9 Tier 3 顶级遗物（4 件，3 个 tier-2 合成） =====
  {
    id: "relic_t3_singularity", name: "奇点核心", emoji: "⚪", desc: "开局能量 +100 / 大招威力 +60%", rarity: "legendary", color: "#00E5FF",
    effect: { kind: "doubleStartEnergy", value: 100 }, source: "shop", tier: 3, decomposeShards: 18,
    recipe: { ingredients: ["relic_t2_fusion_core", "relic_t2_ultima_lens", "relic_t2_tactical_cpu"], coinCost: 2000, intelCost: 20 },
  },
  {
    id: "relic_t3_invincible_3s", name: "三秒无敌", emoji: "✨", desc: "开局 3 秒探员无敌", rarity: "legendary", color: "#FF7AB8",
    effect: { kind: "agentInvulnFirst3s" }, source: "shop", tier: 3, decomposeShards: 18,
    recipe: { ingredients: ["relic_t2_eternal_guard", "relic_t2_boss_breaker", "relic_t2_fusion_core"], coinCost: 2000, intelCost: 20 },
  },
  {
    id: "relic_t3_double_revive", name: "不死之身", emoji: "💗", desc: "基地失守时复活两次（每次 30% 血）", rarity: "legendary", color: "#FF3B6B",
    effect: { kind: "reviveTwice" }, source: "shop", tier: 3, decomposeShards: 18,
    recipe: { ingredients: ["relic_t2_boss_breaker", "relic_t2_eternal_guard", "relic_t2_golden_engine"], coinCost: 2500, intelCost: 25 },
  },
  {
    id: "relic_t3_omniscience", name: "全知之眼", emoji: "👁️", desc: "对 BOSS 伤害 +80% / 战术冷却缩减 50%", rarity: "legendary", color: "#9D6BFF",
    effect: { kind: "bossDamageMul", value: 1.8 }, source: "shop", tier: 3, decomposeShards: 18,
    recipe: { ingredients: ["relic_t2_boss_breaker", "relic_t2_tactical_cpu", "relic_t2_ultima_lens"], coinCost: 2500, intelCost: 25 },
  },
];

export function getRelic(id: string): RelicDef | undefined {
  return RELICS.find((r) => r.id === id);
}

/** v9：获取遗物层级 */
export function getRelicTier(id: string): RelicTier {
  const r = RELICS.find((x) => x.id === id);
  return r?.tier ?? 1;
}

/** v9：获取可合成配方列表（玩家拥有所有 ingredient 时返回可合成目标 id） */
export function getCraftableRelics(ownedRelicIds: string[], unlockedRecipes: string[]): RelicDef[] {
  return RELICS.filter((r) => r.tier >= 2 && r.recipe && unlockedRecipes.includes(r.id))
    .filter((r) => {
      const owned = new Set(ownedRelicIds);
      return r.recipe!.ingredients.every((ing) => owned.has(ing));
    });
}

/** v9：获取遗物碎片拆解数量 */
export function getDecomposeShards(relicId: string): number {
  const r = RELICS.find((x) => x.id === relicId);
  if (!r) return 0;
  return r.decomposeShards ?? (r.tier === 1 ? 2 : r.tier === 2 ? 6 : 18);
}

// ====================================================================
// v6 全面升级：装备系统（16 件，weapon/badge × 4 稀有度）
// ====================================================================

export const EQUIPMENT: EquipmentDef[] = [
  // 武器 - 通用
  { id: "eq_wpn_standard", name: "标准手枪", emoji: "🔫", desc: "攻击力 +8", slot: "weapon", rarity: "common", color: "#9FE3FF", effect: { kind: "attackFlat", value: 8 }, craftCost: { coins: 200 } },
  { id: "eq_wpn_rapid", name: "速射手枪", emoji: "🔫", desc: "射速 +20%", slot: "weapon", rarity: "rare", color: "#00E5FF", effect: { kind: "fireratePct", value: 0.2 }, craftCost: { coins: 400, intel: 5 } },
  { id: "eq_wpn_longshot", name: "远程步枪", emoji: "🎯", desc: "射程 +40", slot: "weapon", rarity: "rare", color: "#3D8BFD", effect: { kind: "rangeFlat", value: 40 }, craftCost: { coins: 400, intel: 5 } },
  { id: "eq_wpn_critical", name: "暴击瞄具", emoji: "🎯", desc: "暴击率 +20%", slot: "weapon", rarity: "epic", color: "#FFD666", effect: { kind: "critRate", value: 0.2 }, craftCost: { coins: 800, intel: 15 } },
  { id: "eq_wpn_heavy", name: "重火力", emoji: "💥", desc: "攻击力 +25%", slot: "weapon", rarity: "epic", color: "#FF7A1A", effect: { kind: "attackPct", value: 0.25 }, craftCost: { coins: 800, intel: 15 } },
  { id: "eq_wpn_splash", name: "溅射弹", emoji: "💣", desc: "溅射半径 +30", slot: "weapon", rarity: "epic", color: "#FF3B6B", effect: { kind: "splash", value: 30 }, craftCost: { coins: 800, intel: 15 } },
  { id: "eq_wpn_pierce", name: "穿透弹", emoji: "➡️", desc: "投射物穿透 +2", slot: "weapon", rarity: "epic", color: "#B388FF", effect: { kind: "pierce", value: 2 }, craftCost: { coins: 800, intel: 15 } },
  { id: "eq_wpn_legendary", name: "终极武器", emoji: "🌟", desc: "攻击力 +30% / 暴击伤害 +60%", slot: "weapon", rarity: "legendary", color: "#FFD666", effect: { kind: "attackPct", value: 0.3 }, craftCost: { coins: 1500, intel: 30, caseFiles: 2 } },
  // 徽章 - 通用
  { id: "eq_bad_hp", name: "生命徽章", emoji: "💚", desc: "生命值 +40", slot: "badge", rarity: "common", color: "#52C41A", effect: { kind: "hpFlat", value: 40 }, craftCost: { coins: 200 } },
  { id: "eq_bad_crit_dmg", name: "暴伤徽章", emoji: "☄️", desc: "暴击伤害 +40%", slot: "badge", rarity: "rare", color: "#FF7A1A", effect: { kind: "critDmg", value: 0.4 }, craftCost: { coins: 400, intel: 5 } },
  { id: "eq_bad_attack", name: "攻击徽章", emoji: "⚔️", desc: "攻击力 +12", slot: "badge", rarity: "rare", color: "#E5353B", effect: { kind: "attackFlat", value: 12 }, craftCost: { coins: 400, intel: 5 } },
  { id: "eq_bad_lifesteal", name: "吸血徽章", emoji: "🩸", desc: "造成伤害 8% 回血给最近探员", slot: "badge", rarity: "epic", color: "#9B59B6", effect: { kind: "lifesteal", value: 0.08 }, craftCost: { coins: 800, intel: 15 } },
  { id: "eq_bad_slow", name: "减速徽章", emoji: "❄️", desc: "命中减速 30%（2 秒）", slot: "badge", rarity: "epic", color: "#00E5FF", effect: { kind: "slowOnHit", value: 0.3, duration: 2 }, craftCost: { coins: 800, intel: 15 } },
  { id: "eq_bad_firerate", name: "射速徽章", emoji: "🔫", desc: "射速 +15%", slot: "badge", rarity: "epic", color: "#A8E6CF", effect: { kind: "fireratePct", value: 0.15 }, craftCost: { coins: 800, intel: 15 } },
  // 探员专属
  { id: "eq_wpn_chen_exclusive", name: "陈默的匕首", emoji: "🗡️", desc: "陈默专属：攻击力 +35%", slot: "weapon", rarity: "legendary", color: "#E5353B", agentId: "chen", effect: { kind: "attackPct", value: 0.35 }, craftCost: { coins: 1500, intel: 30, caseFiles: 2 } },
  { id: "eq_bad_su_exclusive", name: "苏岩的数据盘", emoji: "💾", desc: "苏岩专属：暴击率 +25% / 暴击伤害 +40%", slot: "badge", rarity: "legendary", color: "#FFD666", agentId: "su", effect: { kind: "critRate", value: 0.25 }, craftCost: { coins: 1500, intel: 30, caseFiles: 2 } },
];

export function getEquipment(id: string): EquipmentDef | undefined {
  return EQUIPMENT.find((e) => e.id === id);
}

// ====================================================================
// v6 全面升级：探员皮肤系统（每探员 1-2 套稀有皮肤）
// ====================================================================

export const AGENT_SKINS: AgentSkin[] = [
  { id: "skin_shen_default", agentId: "shen", name: "刑侦本色", desc: "沈锋标准制服", unlockHint: "默认", rarity: "common" },
  { id: "skin_shen_formal", agentId: "shen", name: "审计礼服", desc: "正式场合的西装", color: "#1B5FCC", rarity: "rare", unlockHint: "反诈积分 1000" },
  { id: "skin_lin_default", agentId: "lin", name: "话务员", desc: "林书影标准制服", unlockHint: "默认", rarity: "common" },
  { id: "skin_lin_night", agentId: "lin", name: "夜班特勤", desc: "夜间值班深色装", color: "#0A1929", rarity: "rare", unlockHint: "反诈积分 1000" },
  { id: "skin_zhou_default", agentId: "zhou", name: "技术员", desc: "周衡标准工装", unlockHint: "默认", rarity: "common" },
  { id: "skin_zhou_hacker", agentId: "zhou", name: "白帽黑客", desc: "黑色连帽衫装束", color: "#00E5FF", rarity: "epic", unlockHint: "通关 BOSS Rush" },
  { id: "skin_wang_default", agentId: "wang", name: "社区志愿者", desc: "王婆婆标准装", unlockHint: "默认", rarity: "common" },
  { id: "skin_chen_default", agentId: "chen", name: "卧底便衣", desc: "陈默标准便衣", unlockHint: "默认", rarity: "common" },
  { id: "skin_chen_stealth", agentId: "chen", name: "潜行套装", desc: "夜行黑色战术服", color: "#0A1929", rarity: "epic", unlockHint: "爬塔 50 层" },
  { id: "skin_su_default", agentId: "su", name: "数据分析师", desc: "苏岩标准制服", unlockHint: "默认", rarity: "common" },
  { id: "skin_fayi_default", agentId: "fayi", name: "法务正装", desc: "法务审计师标准", unlockHint: "默认", rarity: "common" },
  { id: "skin_yuce_default", agentId: "yuce", name: "AI 工程师", desc: "数据预测师标准", unlockHint: "默认", rarity: "common" },
  { id: "skin_kuajing_default", agentId: "kuajing", name: "联络官", desc: "跨境联络官标准", unlockHint: "默认", rarity: "common" },
  { id: "skin_jianwei_default", agentId: "jianwei", name: "鉴伪师", desc: "AI 鉴伪师标准", unlockHint: "默认", rarity: "common" },
  { id: "skin_chen_legend", agentId: "chen", name: "暗影之王", desc: "传说级潜行装", color: "#FF3B6B", rarity: "legendary", unlockHint: "爬塔登顶 100 层" },
  { id: "skin_shen_legend", agentId: "shen", name: "断金之神", desc: "传说级审计礼服", color: "#FFD666", rarity: "legendary", unlockHint: "击破 50 个 BOSS" },
];

// ====================================================================
// v6 全面升级：图鉴系统（敌人 + 探员 + 案件 三类）
// ====================================================================

export const MANAGER_CODEX: CodexEntry[] = [
  // 敌人图鉴（12 条）
  { id: "codex_robot", category: "enemy", name: "话术机器人", emoji: "🤖", short: "话术脚本诈骗", detail: "使用预设话术脚本的自动拨号诈骗，规模化操作，常见于境外诈骗园区。", tip: "任何陌生电话中固定的'剧本式'话术，立即挂断。", unlockHint: "首次击杀话术机器人", refId: "robot", color: "#9FE3FF" },
  { id: "codex_popup", category: "enemy", name: "假客服弹窗", emoji: "💬", short: "冒充客服诈骗", detail: "通过弹窗/主动来电冒充客服，引导点击钓鱼链接或共享屏幕。", tip: "客服不主动。任何'商品异常/理赔'主动来电，一律挂断核实。", unlockHint: "首次击杀假客服弹窗", refId: "popup", color: "#FFB020" },
  { id: "codex_threat", category: "enemy", name: "恐吓语音", emoji: "📞", short: "冒充公检法诈骗", detail: "冒充公检法工作人员，以涉嫌犯罪为由恐吓受害人转账到'安全账户'。", tip: "公检法不电办。不存在'安全账户'。", unlockHint: "首次击杀恐吓语音", refId: "threat", color: "#E5353B" },
  { id: "codex_sweet", category: "enemy", name: "甜言蜜语", emoji: "💕", short: "杀猪盘情感诈骗", detail: "通过网恋建立情感后引导投资。'养猪'数月后'杀猪'收割。", tip: "网恋不转账。任何未见面就让你投资的，都是骗局。", unlockHint: "首次击杀甜言蜜语", refId: "sweet", color: "#FF7AB8" },
  { id: "codex_phish", category: "enemy", name: "钓鱼链接", emoji: "🎣", short: "钓鱼网站盗刷", detail: "通过伪装链接窃取银行卡账号密码，低血量加速是临死前的反扑。", tip: "不点陌生链。涉及密码的链接一律从官方 APP 进入。", unlockHint: "首次击杀钓鱼链接", refId: "phish", color: "#1AD670" },
  { id: "codex_farmer", category: "enemy", name: "卡农", emoji: "💳", short: "买卖银行卡洗钱", detail: "买卖/租借银行卡为诈骗团伙走账，首次命中减半是银行初次风控。", tip: "不租售两卡。出租两卡涉嫌帮信罪，最高 3 年有期徒刑。", unlockHint: "首次击杀卡农", refId: "farmer", color: "#B388FF" },
  { id: "codex_deepfake", category: "enemy", name: "AI 换脸", emoji: "🎭", short: "AI 换脸冒充熟人", detail: "使用 AI 换脸/合成语音冒充亲友视频通话，间歇隐身规避识别。", tip: "AI 换脸核实。换话题问私密信息是最快的核实方式。", unlockHint: "首次击杀 AI 换脸", refId: "deepfake", color: "#A8E6CF" },
  { id: "codex_investApp", category: "enemy", name: "虚假理财 APP", emoji: "📱", short: "虚假投资平台诈骗", detail: "高收益虚假理财平台，前期可小额提现建立信任，大额投入后平台跑路。", tip: "理财认持牌。证监会/银保监会官网可查机构资质。", unlockHint: "首次击杀虚假理财 APP", refId: "investApp", color: "#FF6B9D" },
  { id: "codex_fakeLeader", category: "enemy", name: "冒充领导", emoji: "👔", short: "冒充领导熟人转账", detail: "冒充领导/熟人加微信，以'在开会不便接电话'阻挠核实。", tip: "领导转账核实。换渠道（电话/当面）确认本人。", unlockHint: "首次击杀冒充领导", refId: "fakeLeader", color: "#4ECDC4" },
  { id: "codex_etcFraud", category: "enemy", name: "ETC 诈骗", emoji: "🚗", short: "ETC 过期短信诈骗", detail: "ETC 过期/禁用为由的钓鱼短信，高速移动是诱导快速点击。", tip: "ETC 官方办。ETC 不会以短信链接形式索要银行卡信息。", unlockHint: "首次击杀 ETC 诈骗", refId: "etcFraud", color: "#FFA07A" },
  { id: "codex_refundFraud", category: "enemy", name: "退费诈骗", emoji: "💸", short: "假冒客服退费诈骗", detail: "以商品质量问题/退款为由，引导下载屏幕共享 APP。分裂是连环套。", tip: "退费走官方。屏幕共享=对方能看到你所有验证码。", unlockHint: "首次击杀退费诈骗", refId: "refundFraud", color: "#FFB347" },
  { id: "codex_loanCancel", category: "enemy", name: "注销校园贷", emoji: "📚", short: "假冒注销校园贷诈骗", detail: "冒充金融监管，以注销校园贷记录为由恐吓学生网贷转账。", tip: "注销校园贷是骗。征信只能本人到央行或官方渠道查询。", unlockHint: "首次击杀注销校园贷", refId: "loanCancel", color: "#9B59B6" },
  // ===== v8 新增敌人图鉴（4 条） =====
  { id: "codex_fakeRecruit", category: "enemy", name: "虚假招聘", emoji: "📋", short: "虚假招聘押金诈骗", detail: "发布高薪轻松岗位，面试后以押金/培训费/服装费名义收费后跑路。", tip: "招聘不缴费。《劳动合同法》禁止用人单位收取任何费用。", unlockHint: "首次击杀虚假招聘", refId: "fakeRecruit", color: "#795548" },
  { id: "codex_ticketFraud", category: "enemy", name: "二手票务", emoji: "🎫", short: "二手演唱会票务诈骗", detail: "演出前发布低价二手票，付款后不发货或发送无效票。", tip: "二手票务认官方转赠渠道。私下转账无保障。", unlockHint: "首次击杀二手票务", refId: "ticketFraud", color: "#FFC107" },
  { id: "codex_flightChange", category: "enemy", name: "退改签", emoji: "✈️", short: "机票退改签诈骗", detail: "获取航班信息后精准发送退改签短信，诱导支付'差价'。", tip: "航班变动认官方 APP/电话。航司不会以短信链接索要银行卡。", unlockHint: "首次击杀退改签", refId: "flightChange", color: "#4FC3F7" },
  { id: "codex_fakeAccident", category: "enemy", name: "虚构意外", emoji: "🚑", short: "虚构亲友意外诈骗", detail: "冒充医院/警察称亲友出车祸，催促转账'手术费'。", tip: "亲友意外核实。先挂断，拨打亲属本人或 110 核实。", unlockHint: "首次击杀虚构意外", refId: "fakeAccident", color: "#FF7043" },
  // ===== v9 新增敌人图鉴（8 条，覆盖 2026 新型诈骗） =====
  { id: "codex_aiVoiceClone", category: "enemy", name: "AI 语音克隆", emoji: "🎙️", short: "AI 克隆亲人语音诈骗", detail: "用开源语音克隆模型，凭 10 秒语音素材合成亲人声音诈骗。", tip: "AI 拟声核实。电话借钱用私密问题（家事/童年昵称）核实。", unlockHint: "首次击杀 AI 语音克隆", refId: "aiVoiceClone", color: "#7E57C2" },
  { id: "codex_fakeLivestream", category: "enemy", name: "虚假直播", emoji: "📺", short: "直播间虚假宣传诈骗", detail: "雇托儿烘托气氛，将廉价商品包装成'大师真迹'高价售卖。", tip: "直播带货认官方店铺。托儿烘托+限时抢购+大师背书是诈骗三件套。", unlockHint: "首次击杀虚假直播", refId: "fakeLivestream", color: "#FF4081" },
  { id: "codex_cryptoWalletPhish", category: "enemy", name: "钱包授权钓鱼", emoji: "🪙", short: "数字货币钱包授权钓鱼", detail: "伪造空投页面诱导点击授权链接，授权后钱包资产被瞬间转走。", tip: "钱包授权需谨慎。'无限授权'等于交出钱包控制权。", unlockHint: "首次击杀钱包授权钓鱼", refId: "cryptoWalletPhish", color: "#00BCD4" },
  { id: "codex_fakeGovApp", category: "enemy", name: "政务 APP 仿冒", emoji: "🏛️", short: "仿冒国家政务 APP 诈骗", detail: "仿冒'国家反诈中心'等政务 APP，骗取身份信息后冒名网贷。", tip: "政务 APP 只在官方应用商店下载。短信链接下发的都是骗局。", unlockHint: "首次击杀政务 APP 仿冒", refId: "fakeGovApp", color: "#1565C0" },
  { id: "codex_pensionFraud", category: "enemy", name: "养老理财", emoji: "👵", short: "虚假养老理财诈骗", detail: "以'国家养老专项基金'名义承诺高息保本，吸收老人存款后跑路。", tip: "养老理财认持牌机构。年化超过 8% 的'保本'理财都是骗局。", unlockHint: "首次击杀养老理财", refId: "pensionFraud", color: "#FF8A65" },
  { id: "codex_shortDramaTrap", category: "enemy", name: "短剧连环扣", emoji: "🎬", short: "短剧付费连环扣费诈骗", detail: "免费看剧引流，默认勾选自动续费，退订入口深藏多级菜单。", tip: "短剧订阅看清条款。'免费试用'后必自动续费。", unlockHint: "首次击杀短剧连环扣", refId: "shortDramaTrap", color: "#AB47BC" },
  { id: "codex_secondhandCutOrder", category: "enemy", name: "二手切单", emoji: "🛒", short: "二手平台线下切单诈骗", detail: "以'平台手续费高'为由诱导私下交易，付款后拉黑。", tip: "二手交易不脱离平台。私下转账无平台担保。", unlockHint: "首次击杀二手切单", refId: "secondhandCutOrder", color: "#26A69A" },
  { id: "codex_aiRefundVoice", category: "enemy", name: "AI 退货客服", emoji: "🤙", short: "AI 语音冒充客服退货诈骗", detail: "AI 合成客服声音+撞库订单信息，诱导共享屏幕后转走资金。", tip: "客服不主动。AI 声音可合成，订单信息可撞库，唯官方 APP 可信。", unlockHint: "首次击杀 AI 退货客服", refId: "aiRefundVoice", color: "#5C6BC0" },
  // 探员图鉴（10 条）
  { id: "codex_agent_shen", category: "agent", name: "资金链斩断师 · 沈锋", emoji: "🔫", short: "刑侦老炮", detail: "刑侦老炮，专攻杀猪盘资金链追踪与冻结。", tip: "断卡行动针对的就是卡农洗钱链条。", unlockHint: "默认解锁", refId: "shen", color: "#FF7A1A" },
  { id: "codex_agent_lin", category: "agent", name: "话术识别员 · 林书影", emoji: "📡", short: "96110 话务员", detail: "反诈中心 96110 话务员，识破每一句陷阱话术。", tip: "96110 是反诈专线，可信赖，不会让你转账。", unlockHint: "默认解锁", refId: "lin", color: "#00E5FF" },
  { id: "codex_agent_zhou", category: "agent", name: "网安追踪师 · 周衡", emoji: "💻", short: "网安工程师", detail: "网安工程师，黑进过 7 个电诈窝点服务器。", tip: "网安追踪是反向定位电诈园区的核心手段。", unlockHint: "默认解锁", refId: "zhou", color: "#B388FF" },
  { id: "codex_agent_wang", category: "agent", name: "社区宣防员 · 王婆婆", emoji: "👵", short: "社区反诈志愿者", detail: "社区反诈志愿者，专拆甜言蜜语与保健品骗局。", tip: "社区宣讲是反诈'最后一公里'。", unlockHint: "默认解锁", refId: "wang", color: "#52C41A" },
  { id: "codex_agent_su", category: "agent", name: "数据猎查师 · 苏岩", emoji: "📊", short: "数据建模师", detail: "用数据模型锁定诈骗团伙资金流向。", tip: "数据预警可在受害人转账前拦截。", unlockHint: "默认解锁", refId: "su", color: "#FFD666" },
  { id: "codex_agent_chen", category: "agent", name: "卧底侦查员 · 陈默", emoji: "🥷", short: "卧底三年", detail: "卧底三年，潜伏在跨境电诈园区。", tip: "卧底取证是跨境联合执法的关键。", unlockHint: "默认解锁", refId: "chen", color: "#E5353B" },
  { id: "codex_agent_fayi", category: "agent", name: "法务审计师", emoji: "⚖️", short: "法务+审计", detail: "注册会计师+法律顾问，专攻复杂资金链审计与冻结。", tip: "复杂资金链审计是追赃挽损的关键。", unlockHint: "反诈积分 500 解锁", refId: "fayi", color: "#3D8BFD" },
  { id: "codex_agent_yuce", category: "agent", name: "数据预测师", emoji: "🔮", short: "AI 风控", detail: "AI 风控模型工程师，用机器学习预测诈骗团伙下一步行动。", tip: "AI 风控可在受害人转账前发出预警。", unlockHint: "反诈积分 800 解锁", refId: "yuce", color: "#00C9A7" },
  { id: "codex_agent_kuajing", category: "agent", name: "跨境联络官", emoji: "🌐", short: "国际刑警联络官", detail: "国际刑警组织联络官，协调跨境联合执法行动。", tip: "跨境电诈需国际执法协作机制。", unlockHint: "反诈积分 1200 解锁", refId: "kuajing", color: "#FF8A3D" },
  { id: "codex_agent_jianwei", category: "agent", name: "AI 鉴伪师", emoji: "🤖", short: "Deepfake 检测", detail: "Deepfake 检测专家，识破每一帧 AI 换脸与合成语音。", tip: "AI 换脸视频可被鉴伪技术识别，转账前务必电话核实。", unlockHint: "反诈积分 1500 解锁", refId: "jianwei", color: "#A8E6CF" },
  // 案件图鉴（8 条，对应 8 个 BOSS）
  { id: "codex_case_farmer", category: "case", name: "断卡行动 · 钱叔案", emoji: "💳", short: "洗钱卡农头目案", detail: "钱叔团伙通过 7 层壳公司租用 200+ 张银行卡，3 个月走账 1.2 亿。", tip: "出租银行卡给诈骗团伙走账，构成帮信罪。", unlockHint: "击破 BOSS 钱叔", refId: "boss_farmer", color: "#B388FF" },
  { id: "codex_case_sweet", category: "case", name: "杀猪盘 · 婉清案", emoji: "💔", short: "情感诈骗首脑案", detail: "婉清团伙伪装优质女性形象，3 个月内骗取 17 名受害人共 480 万。", tip: "杀猪盘必破，下个窝点数据已入库。", unlockHint: "击破 BOSS 婉清", refId: "boss_sweet", color: "#FF7AB8" },
  { id: "codex_case_popup", category: "case", name: "假客服 · 客服007案", emoji: "💬", short: "冒充客服首脑案", detail: "客服007团伙通过撞库获取订单信息，冒充客服双倍退款骗转。", tip: "假客服必挂。订单信息泄露不等于对方是真客服。", unlockHint: "击破 BOSS 客服007", refId: "boss_popup", color: "#FFB020" },
  { id: "codex_case_threat", category: "case", name: "假警官 · 拘捕令案", emoji: "📞", short: "冒充公检法首脑案", detail: "假警官团伙伪造拘捕令，PS 公章，48 小时内骗转 80 万。", tip: "公检法不电办，拘捕令不会通过电话/微信发送。", unlockHint: "击破 BOSS 假警官", refId: "boss_threat", color: "#E5353B" },
  { id: "codex_case_kingpin", category: "case", name: "跨境围剿 · 缅北枭雄案", emoji: "👑", short: "跨境电诈终极首脑案", detail: "缅北枭雄团伙园区 2000 人，3 年诈骗境内 12 亿，最终跨境联合执法清零。", tip: "跨境必究。国际刑警协调机制可破跨境电诈园区。", unlockHint: "击破 BOSS 缅北枭雄", refId: "boss_kingpin", color: "#FF3B6B" },
  { id: "codex_case_deepfake", category: "case", name: "AI 换脸 · 镜像案", emoji: "🎭", short: "AI 换脸冒充熟人首脑案", detail: "镜像团伙使用开源换脸模型，3 个月内冒充亲友视频诈骗 22 起。", tip: "AI 鉴伪一直在升级，换脸视频总有破绽。", unlockHint: "击破 BOSS 镜像", refId: "boss_deepfake", color: "#A8E6CF" },
  { id: "codex_case_invest", category: "case", name: "虚假平台 · 钱生钱案", emoji: "💰", short: "虚假投资理财首脑案", detail: "钱生钱虚假理财平台，高峰期 5 万投资人，跑路时未兑付 3.2 亿。", tip: "理财认持牌。群里晒单都是托。", unlockHint: "击破 BOSS 钱生钱", refId: "boss_invest", color: "#FF6B9D" },
  { id: "codex_case_loan", category: "case", name: "校园贷 · 蜡笔老哥案", emoji: "📚", short: "注销校园贷诈骗首脑案", detail: "蜡笔老哥团伙专盯大学生，伪造金融监管身份，2 个月内骗转 60 万。", tip: "校园贷骗局必破，征信只能本人到央行查。", unlockHint: "击破 BOSS 蜡笔老哥", refId: "boss_loan", color: "#9B59B6" },
];

export function getCodexEntry(id: string): CodexEntry | undefined {
  return MANAGER_CODEX.find((c) => c.id === id);
}

// ====================================================================
// v6 全面升级：爬塔模式（100 层，按公式生成 + BOSS 层定制）
// ====================================================================

const TOWER_BOSS_FLOOR_IDS: Record<number, string> = {
  10: "boss_farmer",
  20: "boss_sweet",
  30: "boss_popup",
  40: "boss_threat",
  50: "boss_deepfake",
  60: "boss_invest",
  70: "boss_loan",
  80: "boss_kingpin",
  90: "boss_farmer", // 二周目强化
  100: "boss_kingpin", // 终极
};

const TOWER_FLOOR_NAMES: Record<number, string> = {
  10: "断卡第一关",
  20: "杀猪盘屠场",
  30: "弹窗风暴",
  40: "假警官审判",
  50: "镜像迷宫",
  60: "金流反噬",
  70: "校园贷终焉",
  80: "跨境围剿",
  90: "二周目·断卡再起",
  100: "终极·电诈末日",
};

/** 生成爬塔层数据（运行时按需调用） */
export function getTowerFloor(floor: number): TowerFloorDef {
  const isBoss = floor % 10 === 0;
  const hasReward = floor % 5 === 0 && !isBoss;
  const tier = Math.floor(floor / 10);
  return {
    floor,
    name: TOWER_FLOOR_NAMES[floor] ?? `第 ${floor} 层`,
    waves: isBoss ? 1 : Math.min(3, 1 + Math.floor((floor - 1) / 25)),
    hpMul: 1 + floor * 0.08,
    speedMul: 1 + floor * 0.02,
    dmgMul: 1 + floor * 0.05,
    rewardMul: 1 + floor * 0.1,
    isBoss,
    bossId: isBoss ? TOWER_BOSS_FLOOR_IDS[floor] : undefined,
    hasReward,
    reward: hasReward
      ? {
          coins: 50 + floor * 10,
          intel: Math.floor(floor / 10),
          relicId: floor % 25 === 0 ? ["relic_energy_reactor", "relic_revive", "relic_lucky_charm"][Math.floor(floor / 25) - 1] : undefined,
        }
      : undefined,
  };
}

/** 爬塔总层数 */
export const TOWER_MAX_FLOOR = 100;

// ====================================================================
// v6 全面升级：周常任务（6 项，每周一刷新）
// ====================================================================

export const WEEKLY_QUESTS: WeeklyQuest[] = [
  { id: "wq_play_5", name: "周常演练", desc: "完成 5 局任意模式", target: 5, reward: { seasonScore: 100, coins: 200 }, progress: 0, claimed: false },
  { id: "wq_kill_200", name: "剿匪达标", desc: "击杀 200 名敌人", target: 200, reward: { seasonScore: 150, coins: 300 }, progress: 0, claimed: false },
  { id: "wq_boss_3", name: "首脑猎手", desc: "击破 3 个 BOSS", target: 3, reward: { seasonScore: 200, coins: 400, relicId: "relic_score_chip" }, progress: 0, claimed: false },
  { id: "wq_tower_10", name: "登塔 10 层", desc: "爬塔推进 10 层", target: 10, reward: { seasonScore: 200, coins: 400 }, progress: 0, claimed: false },
  { id: "wq_quiz_10", name: "学海无涯", desc: "答对 10 道战间题", target: 10, reward: { seasonScore: 150, coins: 300 }, progress: 0, claimed: false },
  { id: "wq_combo_30", name: "连击大师", desc: "达成 30 连击", target: 30, reward: { seasonScore: 250, coins: 500, relicId: "relic_combo_extender" }, progress: 0, claimed: false },
];

// ====================================================================
// v6 全面升级：极限词缀（10 个，挑战模式自选 1-3 个）
// ====================================================================

export const CHALLENGE_AFFIXES: ChallengeAffix[] = [
  { id: "affix_one_hp", name: "一血通关", desc: "基地只有 1 点血", emoji: "🩸", color: "#E5353B", severity: 3, effect: { kind: "oneHp" } },
  { id: "affix_no_ult", name: "禁大招", desc: "大招无法充能", emoji: "🚫", color: "#FF7A1A", severity: 2, effect: { kind: "noUlt" } },
  { id: "affix_random_agents", name: "随机探员", desc: "从所有探员中随机 6 名出战", emoji: "🎲", color: "#9D6BFF", severity: 2, effect: { kind: "randomAgents", count: 6 } },
  { id: "affix_no_upgrades", name: "禁升级", desc: "本局无法选择升级", emoji: "⬇️", color: "#FFB020", severity: 2, effect: { kind: "noUpgrades" } },
  { id: "affix_double_enemies", name: "敌海压境", desc: "敌人数量翻倍", emoji: "🌊", color: "#00E5FF", severity: 2, effect: { kind: "doubleEnemies" } },
  { id: "affix_fast_enemies", name: "极速敌人", desc: "敌人速度 +50%", emoji: "💨", color: "#1AD670", severity: 1, effect: { kind: "fastEnemies", mul: 1.5 } },
  { id: "affix_no_devices", name: "禁战术装置", desc: "无法使用战术装置", emoji: "🚧", color: "#B388FF", severity: 1, effect: { kind: "noDevices" } },
  { id: "affix_no_pause", name: "禁战术暂停", desc: "无法使用战术暂停", emoji: "⏸️", color: "#FF7AB8", severity: 1, effect: { kind: "noPause" } },
  { id: "affix_berserk", name: "全员狂暴", desc: "敌人攻击力 +50%", emoji: "🔥", color: "#FF3B6B", severity: 3, effect: { kind: "berserk", mul: 1.5 } },
  { id: "affix_fog", name: "战争迷雾", desc: "战场被迷雾覆盖，仅可见探员周围", emoji: "🌫️", color: "#9FE3FF", severity: 3, effect: { kind: "fog" } },
];

/** 极限词缀积分倍率（severity 1=0.3, 2=0.6, 3=1.0） */
export function challengeScoreMul(affixes: ChallengeAffix[]): number {
  return 1 + affixes.reduce((s, a) => s + a.severity * 0.3, 0);
}

// ====================================================================
// v6 全面升级：赛季段位映射（按积分）
// ====================================================================

export const SEASON_RANKS: { rank: SeasonRank; minScore: number }[] = [
  { rank: "反诈新兵", minScore: 0 },
  { rank: "反诈士官", minScore: 300 },
  { rank: "反诈少尉", minScore: 800 },
  { rank: "反诈上尉", minScore: 1500 },
  { rank: "反诈少校", minScore: 2500 },
  { rank: "反诈中校", minScore: 4000 },
  { rank: "反诈上校", minScore: 6000 },
  { rank: "反诈准将", minScore: 8500 },
  { rank: "反诈少将", minScore: 12000 },
  { rank: "反诈元帅", minScore: 18000 },
];

export function seasonRankFromScore(score: number): SeasonRank {
  let rank: SeasonRank = "反诈新兵";
  for (const r of SEASON_RANKS) {
    if (score >= r.minScore) rank = r.rank;
  }
  return rank;
}

// ====================================================================
// v8 全面升级：反诈口诀池（话术气泡实时拆穿系统）
// 玩家在战斗中可点击对应口诀击破敌人话术气泡 + 施加易伤
// 共 12 条口诀，覆盖全部 16 种敌人诈骗类型
// ====================================================================

export const COUNTERSPELLS: CounterspellDef[] = [
  { id: "cs_no_safe_account", text: "公检法不电办", fraudTypeIds: ["冒充公检法诈骗", "假冒注销校园贷诈骗"], emoji: "⚖️", color: "#1B5FCC", vulnerabilityBonus: 0.3, vulnerabilityDuration: 3 },
  { id: "cs_no_active_call", text: "客服不主动", fraudTypeIds: ["冒充客服诈骗", "假冒客服退费诈骗"], emoji: "💬", color: "#FFB020", vulnerabilityBonus: 0.3, vulnerabilityDuration: 3 },
  { id: "cs_no_transfer_love", text: "网恋不转账", fraudTypeIds: ["杀猪盘情感诈骗"], emoji: "💔", color: "#FF7AB8", vulnerabilityBonus: 0.35, vulnerabilityDuration: 3 },
  { id: "cs_no_strange_link", text: "不点陌生链", fraudTypeIds: ["钓鱼网站盗刷", "ETC 过期短信诈骗"], emoji: "🎣", color: "#1AD670", vulnerabilityBonus: 0.3, vulnerabilityDuration: 3 },
  { id: "cs_no_card_rent", text: "不租售两卡", fraudTypeIds: ["买卖银行卡洗钱"], emoji: "💳", color: "#B388FF", vulnerabilityBonus: 0.4, vulnerabilityDuration: 4 },
  { id: "cs_verify_face", text: "AI 换脸核实", fraudTypeIds: ["AI 换脸冒充熟人"], emoji: "🎭", color: "#A8E6CF", vulnerabilityBonus: 0.35, vulnerabilityDuration: 3 },
  { id: "cs_check_license", text: "理财认持牌", fraudTypeIds: ["虚假投资平台诈骗"], emoji: "💰", color: "#FF6B9D", vulnerabilityBonus: 0.35, vulnerabilityDuration: 3 },
  { id: "cs_verify_leader", text: "领导转账核实", fraudTypeIds: ["冒充领导熟人转账"], emoji: "👔", color: "#4ECDC4", vulnerabilityBonus: 0.3, vulnerabilityDuration: 3 },
  { id: "cs_etc_official", text: "ETC 官方办", fraudTypeIds: ["ETC 过期短信诈骗"], emoji: "🚗", color: "#FFA07A", vulnerabilityBonus: 0.3, vulnerabilityDuration: 3 },
  { id: "cs_refund_official", text: "退费走官方", fraudTypeIds: ["假冒客服退费诈骗"], emoji: "💸", color: "#FFB347", vulnerabilityBonus: 0.3, vulnerabilityDuration: 3 },
  { id: "cs_no_recruit_fee", text: "招聘不交钱", fraudTypeIds: ["虚假招聘押金诈骗"], emoji: "📋", color: "#795548", vulnerabilityBonus: 0.3, vulnerabilityDuration: 3 },
  { id: "cs_ticket_platform", text: "票务走平台", fraudTypeIds: ["二手演唱会票务诈骗", "机票退改签诈骗"], emoji: "🎫", color: "#FFC107", vulnerabilityBonus: 0.3, vulnerabilityDuration: 3 },
  { id: "cs_verify_accident", text: "意外必核实", fraudTypeIds: ["虚构亲友意外诈骗"], emoji: "🚑", color: "#FF7043", vulnerabilityBonus: 0.35, vulnerabilityDuration: 3 },
  { id: "cs_credit_self", text: "征信自己查", fraudTypeIds: ["假冒注销校园贷诈骗"], emoji: "📚", color: "#9B59B6", vulnerabilityBonus: 0.3, vulnerabilityDuration: 3 },
];

/**
 * v8 简化：BOSS element → 口诀 id 映射
 * BOSS 的 fraudType 通常是自定义首脑类型（如"洗钱卡农头目"），不在口诀池中
 * 按 BOSS 的 element 兜底映射到对应口诀，保证 BOSS 战有匹配口诀
 */
export function bossElementToCounterspellId(element: string): string {
  const map: Record<string, string> = {
    money: "cs_no_card_rent",       // 洗钱卡农王 → 不租售两卡
    emotion: "cs_no_transfer_love", // 杀猪盘首脑 → 网恋不转账
    tech: "cs_verify_face",         // 技术系 BOSS → AI 换脸核实
    legal: "cs_no_safe_account",    // 法律系 BOSS → 公检法不电办
    fear: "cs_verify_accident",     // 恐吓系 BOSS → 意外必核实
  };
  return map[element] ?? COUNTERSPELLS[0].id;
}

/** 根据当前敌人诈骗类型池动态抽取 2 个口诀（保证至少 1 个匹配；仅 BOSS 战激活） */
export function pickCounterspellSlots(activeFraudTypes: string[], seed: string): CounterspellDef[] {
  const matched = COUNTERSPELLS.filter((c) => c.fraudTypeIds.some((f) => activeFraudTypes.includes(f)));
  const unmatched = COUNTERSPELLS.filter((c) => !matched.includes(c));
  // 简易 seed-based 随机
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rng = () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const picked: CounterspellDef[] = [];
  const pool1 = matched.slice();
  const pool2 = unmatched.slice();
  // 至少 1 个匹配
  if (pool1.length > 0) {
    const idx = Math.floor(rng() * pool1.length);
    picked.push(pool1[idx]);
    pool1.splice(idx, 1);
  }
  // 再抽 1 个（优先匹配，不足用 unmatched 补）
  while (picked.length < 2 && (pool1.length > 0 || pool2.length > 0)) {
    const pool = pool1.length > 0 ? pool1 : pool2;
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

// ====================================================================
// v8 全面升级：战术指令系统（5 种指令，每探员独立冷却）
// ====================================================================

export const TACTICAL_COMMANDS: TacticalCommandDef[] = [
  { kind: "focusFire", name: "集火", emoji: "🎯", desc: "下次攻击伤害 +80%，5 秒内射速 +20%", color: "#E5353B", duration: 5, cooldown: 12 },
  { kind: "retreat", name: "后撤", emoji: "↩️", desc: "探员向后位移 60px，期间无法攻击，3 秒后回位", color: "#00E5FF", duration: 3, cooldown: 14 },
  { kind: "reload", name: "换弹", emoji: "🔄", desc: "立即重置冷却 + 下 3 次攻击穿透 +1", color: "#FFD666", duration: 3, cooldown: 10 },
  { kind: "taunt", name: "嘲讽", emoji: "📢", desc: "5 秒内吸引范围内敌人改向自己", color: "#FF8A3D", duration: 5, cooldown: 16 },
  { kind: "overdrive", name: "过载", emoji: "⚡", desc: "5 秒内攻击 +50% 但每秒损血 8%", color: "#FF3B6B", duration: 5, cooldown: 18 },
];

/** 取战术指令定义 */
export function getTacticalCommand(kind: TacticalCommandDef["kind"]): TacticalCommandDef | undefined {
  return TACTICAL_COMMANDS.find((c) => c.kind === kind);
}

// ====================================================================
// v8 全面升级：受害人营救配置（按关卡难度递增）
// ====================================================================

/** 各关卡的受害人营救配置（按 level id 索引） */
export const VICTIM_RESCUE_CONFIGS: Record<number, VictimRescueConfig> = {
  1: {
    perWave: 1,
    demographics: ["社区老人", "家庭主妇", "退休教师"],
    triggerRange: 60,
    rescueRange: 90,
    rescueRate: 0.4,
    lifeSpan: 20,
  },
  2: {
    perWave: 1,
    demographics: ["白领", "网购用户", "企业财务"],
    triggerRange: 65,
    rescueRange: 90,
    rescueRate: 0.35,
    lifeSpan: 18,
  },
  3: {
    perWave: 2,
    demographics: ["跨境务工家属", "投资者", "各年龄段"],
    triggerRange: 70,
    rescueRange: 95,
    rescueRate: 0.3,
    lifeSpan: 16,
  },
  4: {
    perWave: 2,
    demographics: ["在校大学生", "应届毕业生", "留学生"],
    triggerRange: 60,
    rescueRange: 95,
    rescueRate: 0.35,
    lifeSpan: 18,
  },
};

/** 受害人画像 emoji 映射 */
export const VICTIM_DEMOGRAPHIC_EMOJI: Record<string, string> = {
  "社区老人": "👵",
  "家庭主妇": "👩",
  "退休教师": "👨‍🦳",
  "白领": "👨‍💼",
  "网购用户": "🛒",
  "企业财务": "💼",
  "跨境务工家属": "🏭",
  "投资者": "📈",
  "各年龄段": "👤",
  "在校大学生": "🎓",
  "应届毕业生": "📜",
  "留学生": "✈️",
};

/** 受害人关联诈骗类型（按 demographic 匹配） */
export const VICTIM_DEMOGRAPHIC_FRAUD: Record<string, string> = {
  "社区老人": "杀猪盘情感诈骗",
  "家庭主妇": "假冒客服退费诈骗",
  "退休教师": "冒充公检法诈骗",
  "白领": "冒充领导熟人转账",
  "网购用户": "假冒客服退费诈骗",
  "企业财务": "冒充领导熟人转账",
  "跨境务工家属": "买卖银行卡洗钱",
  "投资者": "虚假投资平台诈骗",
  "各年龄段": "钓鱼网站盗刷",
  "在校大学生": "假冒注销校园贷诈骗",
  "应届毕业生": "虚假招聘押金诈骗",
  "留学生": "机票退改签诈骗",
};

// ====================================================================
// v11 全面升级集成：将 v11 新增数据合并到现有导出（运行时合并）
// 引擎层无需修改任何调用站点，ENEMIES / BOSS_RUSH_BOSSES / MANAGER_CODEX
// 已包含 v11 内容；helper 函数也已扩展为 v11 fallback。
// ====================================================================

import {
  ENEMIES_V11, BOSSES_V11, BOSS_DIALOGUES_V11,
  CODEX_V11_ENEMY, CODEX_V11_CASE, REAL_CASES_V11, CASE_BREAKDOWNS_V11,
  VICTIM_SIM_SCENARIOS_V11, CUSTOM_DIFFICULTY_PRESETS,
  getV11Enemy, getV11Boss, getV11BossDialogue,
  getV11RealCase, getV11CaseBreakdown,
  getV11CaseBreakdownByEnemyId,
  getVictimSimScenario, getVictimSimScenarioByTypeId, getPresetConfig,
} from "./data.v11";

// 合并 v11 敌人到 ENEMIES（运行时合并，引擎层无感知）
Object.assign(ENEMIES, ENEMIES_V11);
// 合并 v11 BOSS 到 BOSS_RUSH_BOSSES（BOSS Rush 模式现含 8+3=11 个 BOSS）
BOSS_RUSH_BOSSES.push(...BOSSES_V11);
// 合并 v11 BOSS 剧情对白到 BOSS_DIALOGUES（getBossDialogue 自动覆盖 v11）
BOSS_DIALOGUES.push(...BOSS_DIALOGUES_V11);
// 合并 v11 图鉴条目到 MANAGER_CODEX（图鉴现含 12+3=15 条新条目）
MANAGER_CODEX.push(...CODEX_V11_ENEMY, ...CODEX_V11_CASE);

/**
 * v11：统一敌人定义查询（兼容老调用站点 ENEMIES[tid]）
 * 因 ENEMIES 已合并 v11 数据，直接返回即可；保留此函数便于未来扩展
 */
export function getEnemyDef(typeId: string): EnemyDef | undefined {
  return ENEMIES[typeId];
}

/**
 * v11：统一案例五步复盘查询（先查 v8，再 fallback 到 v11）
 * 引擎层结算时调用此函数；保留 v8 老函数向后兼容
 */
export function getCaseBreakdownUnified(enemyId: string): CaseBreakdownDef | undefined {
  // v8 的 getCaseBreakdownByEnemyId 在 data.v8.ts 中，引擎已直接 import
  // 此处仅做 v11 fallback，引擎层在调用时先 v8 再 v11
  return getV11CaseBreakdownByEnemyId(enemyId);
}

/**
 * v11：统一真实案例查询（先查 v7，再 fallback 到 v11）
 */
export function getRealCaseUnified(caseId: string): RealCaseDef | undefined {
  return getV11RealCase(caseId);
}

// v11 re-exports（便于引擎层统一从 data.ts 导入）
export {
  ENEMIES_V11, BOSSES_V11, BOSS_DIALOGUES_V11,
  CODEX_V11_ENEMY, CODEX_V11_CASE, REAL_CASES_V11, CASE_BREAKDOWNS_V11,
  VICTIM_SIM_SCENARIOS_V11, CUSTOM_DIFFICULTY_PRESETS,
  getV11Enemy, getV11Boss, getV11BossDialogue, getV11RealCase,
  getV11CaseBreakdown, getV11CaseBreakdownByEnemyId,
  getVictimSimScenario, getVictimSimScenarioByTypeId, getPresetConfig,
};
