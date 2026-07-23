/**
 * 反诈答题 PK 数据
 * 5 个对手逐级难度，伤害公式，AI 答题概率
 * v2：玩家大招系统 + AI 大招系统
 */
import type { FraudTypeId } from "@/types";

// ============ 大招类型定义 ============

/** 玩家大招类型 */
export type PlayerUltimate = "chainBust" | "timeLock" | "truthReveal";

/** AI 大招类型 */
export type AIUltimate = "confuse" | "pressure" | "ultimateScam";

/** 玩家大招信息 */
export interface PlayerUltimateInfo {
  id: PlayerUltimate;
  /** 大招名称（中文） */
  name: string;
  /** 大招消耗（0..ULTIMATE_MAX） */
  cost: number;
  /** 描述 */
  desc: string;
}

/**
 * 玩家大招列表（按 cost 升序）
 * - 连环识破：下次答对造成 3 倍伤害，消耗 50%
 * - 时间锁定：下题对手无法行动（冻结），消耗 75%
 * - 真相揭示：下题揭示正确答案线索，消耗 100%
 */
export const PLAYER_ULTIMATES: PlayerUltimateInfo[] = [
  { id: "chainBust", name: "连环识破", cost: 50, desc: "下次答对造成 3 倍伤害" },
  { id: "timeLock", name: "时间锁定", cost: 75, desc: "下题对手无法行动" },
  { id: "truthReveal", name: "真相揭示", cost: 100, desc: "下题揭示答案线索" },
];

/** AI 大招名称映射 */
export const AI_ULTIMATE_NAMES: Record<AIUltimate, string> = {
  confuse: "混淆",
  pressure: "施压",
  ultimateScam: "终极诈骗",
};

// ============ 对手定义 ============

export interface Opponent {
  /** 关卡序号 1-5 */
  stage: number;
  /** 对手名称 */
  name: string;
  /** 头像 emoji */
  avatar: string;
  /** 对手身份描述 */
  role: string;
  /** HP 上限 */
  maxHp: number;
  /** AI 答题正确率（0..1） */
  accuracy: number;
  /** AI 平均反应时间（秒） */
  avgReact: number;
  /** 对手台词（开场） */
  intro: string;
  /** 对手台词（被击败） */
  defeat: string;
  /** 主用诈骗类型（用于选题偏好，可空） */
  preferredTypes: FraudTypeId[];
  /** 主题色 */
  accent: string;
  /** AI 主用大招（可选，未填则该对手无大招） */
  ultimate?: AIUltimate;
  /** 主大招触发 HP 阈值（0..1，对手当前 HP 占比 <= 此值时触发） */
  ultThreshold?: number;
  /** 次级大招（boss 可同时拥有两个大招，可选） */
  secondaryUltimate?: AIUltimate;
  /** 次级大招触发 HP 阈值 */
  secondaryUltThreshold?: number;
  /** 答对时挑衅台词（随机选一条） */
  attackLines?: string[];
  /** 受伤时台词（随机选一条） */
  hurtLines?: string[];
}

export const OPPONENTS: Opponent[] = [
  {
    stage: 1,
    name: "业余骗子·阿毛",
    avatar: "🤡",
    role: "路边传单兼职",
    maxHp: 80,
    accuracy: 0.45,
    avgReact: 6.5,
    intro: "哥，刷单日结 300，先来试试？",
    defeat: "怎么…怎么被识破了？",
    preferredTypes: ["F03", "F14"],
    accent: "#7A8FB0",
    // Stage 1-2：混淆——短暂打乱选项顺序
    ultimate: "confuse",
    ultThreshold: 0.5,
    attackLines: [
      "嘿嘿，又答对一题，钱到手！",
      "你看，这不就上钩了？",
      "哥，再来一题呗~",
    ],
    hurtLines: [
      "哎哟…这题被你看穿了",
      "你怎么知道的？！",
      "咳咳，偶尔失误而已…",
    ],
  },
  {
    stage: 2,
    name: "客服骗子·小丽",
    avatar: "📞",
    role: "假客服主管",
    maxHp: 100,
    accuracy: 0.55,
    avgReact: 5.5,
    intro: "您的快递丢失，请开通理赔通道…",
    defeat: "你…你居然不共享屏幕？",
    preferredTypes: ["F04", "F23"],
    accent: "#00E5FF",
    ultimate: "confuse",
    ultThreshold: 0.5,
    attackLines: [
      "理赔通道已开启，请配合~",
      "您的信息核对无误呢~",
      "屏幕共享一下就好啦~",
    ],
    hurtLines: [
      "啊？这都能被识破？",
      "客户怎么变聪明了…",
      "话术被破解了？！",
    ],
  },
  {
    stage: 3,
    name: "投资导师·陈总",
    avatar: "📈",
    role: "杀猪盘操盘手",
    maxHp: 120,
    accuracy: 0.65,
    avgReact: 4.5,
    intro: "内部漏洞稳赚不赔，带你一起赚。",
    defeat: "我的提现…全没了？！",
    preferredTypes: ["F02", "F05", "F20"],
    accent: "#FFD666",
    // Stage 3-4：施压——压缩玩家答题时间
    ultimate: "pressure",
    ultThreshold: 0.5,
    attackLines: [
      "跟上节奏，这单稳赚~",
      "内部消息，别外传哦",
      "再加仓，翻倍不是梦",
    ],
    hurtLines: [
      "这单…怎么亏了？",
      "止损止损！",
      "盘面失控了？！",
    ],
  },
  {
    stage: 4,
    name: "假警官·王队",
    avatar: "🚔",
    role: "冒充公检法",
    maxHp: 140,
    accuracy: 0.72,
    avgReact: 3.8,
    intro: "你涉嫌洗钱，把资金转入安全账户。",
    defeat: "96110…96110…我自首！",
    preferredTypes: ["F01", "F22", "F25"],
    accent: "#E5353B",
    ultimate: "pressure",
    ultThreshold: 0.5,
    attackLines: [
      "拒不配合，立即拘捕！",
      "安全账户，立即转账！",
      "案件保密，不得外传！",
    ],
    hurtLines: [
      "你…你敢查我？",
      "96110…怎么这么准",
      "身份暴露了？！",
    ],
  },
  {
    stage: 5,
    name: "电诈头目·黑老板",
    avatar: "🕶",
    role: "境外电诈园区首脑",
    maxHp: 180,
    accuracy: 0.82,
    avgReact: 3.0,
    intro: "想抓我？我的套路你识不破！",
    defeat: "全民反诈…天下无诈…我认栽。",
    preferredTypes: ["F11", "F28", "F30"],
    accent: "#FF00E5",
    // Stage 5 boss：双大招——70% 触发施压，40% 触发终极诈骗
    ultimate: "ultimateScam",
    ultThreshold: 0.4,
    secondaryUltimate: "pressure",
    secondaryUltThreshold: 0.7,
    attackLines: [
      "我的套路，无人能破！",
      "境外服务器，你抓不到的~",
      "全员就位，给我反向洗盘！",
      "AI 换脸、拟声，识得破吗？",
    ],
    hurtLines: [
      "哼…小伤而已",
      "卧底呢？给我查！",
      "这都能被识破…有意思",
      "全员进入二级戒备！",
    ],
  },
];

/** 玩家初始 HP */
export const PLAYER_MAX_HP = 100;

/** 大招槽满值 */
export const ULTIMATE_MAX = 100;

/** 每次答对获得的大招槽积累 */
export const ULTIMATE_GAIN_PER_CORRECT = 25;

/** 答题时限（秒） */
export const ANSWER_TIME_LIMIT = 8;

/** 连环识破伤害倍率 */
export const CHAIN_BUST_MULTIPLIER = 3;

/** 时间锁定持续秒数（回合制下意味着下题对手无法行动） */
export const TIME_LOCK_DURATION = 5;

/** 混淆特效持续秒数（选项被打乱显示的时间） */
export const CONFUSE_DURATION = 2;

/** 施压减少的玩家答题秒数 */
export const TIMER_REDUCTION = 3;

/**
 * 计算玩家答对的伤害
 * v2：useUltimate 参数已废弃，改为 multiplier 倍率
 * @param reactTime 玩家反应时间（秒）
 * @param difficulty 题目难度 1-4
 * @param multiplier 伤害倍率（默认 1；连环识破传 3）
 */
export function playerDamage(reactTime: number, difficulty: number, multiplier = 1): number {
  const speedBonus = Math.max(0, (ANSWER_TIME_LIMIT - reactTime)) * 1.5;
  const base = 12 + difficulty * 3 + speedBonus;
  const dmg = Math.min(35, base);
  return dmg * multiplier;
}

/** 玩家答错的自身伤害 */
export const PLAYER_SELF_DAMAGE = 10;

/** 大招回血量（v1 兼容字段，v2 玩家大招不再回血） */
export const ULTIMATE_HEAL = 15;

/** AI 答题正确时的伤害（受 stage 影响） */
export function aiDamage(stage: number, difficulty: number): number {
  return 8 + stage * 2 + difficulty;
}

/** AI 是否答对（随机） */
export function aiAnswerCorrect(opponent: Opponent): boolean {
  return Math.random() < opponent.accuracy;
}

/** AI 反应时间（围绕 avgReact 抖动） */
export function aiReactTime(opponent: Opponent): number {
  return Math.max(1.5, opponent.avgReact + (Math.random() - 0.5) * 1.5);
}

/** 随机从台词列表中取一条（空列表返回 null） */
export function pickLine(lines: string[] | undefined): string | null {
  if (!lines || lines.length === 0) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Fisher-Yates 洗牌：返回 [0, n) 的随机排列 */
export function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 玩家称号（按累计击败数） */
export function playerTitle(stagesCleared: number): { name: string; color: string } {
  if (stagesCleared >= 5) return { name: "反诈之神", color: "#FFD666" };
  if (stagesCleared >= 4) return { name: "反诈教头", color: "#FF7A1A" };
  if (stagesCleared >= 3) return { name: "反诈达人", color: "#00E5FF" };
  if (stagesCleared >= 2) return { name: "反诈先锋", color: "#1AD670" };
  if (stagesCleared >= 1) return { name: "反诈新手", color: "#7A8FB0" };
  return { name: "反诈小白", color: "#7A8FB0" };
}
