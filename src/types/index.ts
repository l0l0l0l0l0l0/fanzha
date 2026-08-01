export type GameId = "fraud-buster" | "manager" | "thunder" | "bomb-island" | "chat-detective";

export interface GameMeta {
  id: GameId;
  title: string;
  subtitle: string;
  tagline: string;
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  accent: string;
  accentSoft: string;
  icon: string;
  cover: "phone" | "tactic" | "ship" | "bomb";
  description: string;
  briefing: {
    type: string;
    points: string[];
    hotline: string;
  };
}

/**
 * 反诈类型 ID：覆盖 25 类主流电信网络诈骗 + J01（判断题训练）+ M01（多选综合训练）
 * F01-F12 为基础类型（初阶课程），F13-F25 为进阶类型（中/高阶课程）
 */
export type FraudTypeId =
  // 基础 12 类（初阶）
  | "F01" | "F02" | "F03" | "F04" | "F05" | "F06"
  | "F07" | "F08" | "F09" | "F10" | "F11" | "F12"
  // 进阶 13 类（中/高阶）
  | "F13" | "F14" | "F15" | "F16" | "F17" | "F18"
  | "F19" | "F20" | "F21" | "F22" | "F23" | "F24" | "F25"
  // 全民防骗局专题（2026 暑期）：F26-F31
  | "F26" | "F27" | "F28" | "F29" | "F30" | "F31"
  // 国家反诈中心 / 终结诈骗专题（2026 暑期·续）：F32-F34
  | "F32" | "F33" | "F34"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F35-F37
  | "F35" | "F36" | "F37"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F38-F40
  | "F38" | "F39" | "F40"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F41-F43
  | "F41" | "F42" | "F43"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F44-F46
  | "F44" | "F45" | "F46"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F47-F49
  | "F47" | "F48" | "F49"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F50-F52
  | "F50" | "F51" | "F52"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F53-F55
  | "F53" | "F54" | "F55"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F56-F58
  | "F56" | "F57" | "F58"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F59-F61
  | "F59" | "F60" | "F61"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F62-F64
  | "F62" | "F63" | "F64"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F65-F67
  | "F65" | "F66" | "F67"
  // 真实来源扩展专题（2026-07·续，可核查公开通报）：F68-F70
  | "F68" | "F69" | "F70"
  // 特殊训练类
  | "J01" | "M01";

export interface FraudScene {
  id: string;
  typeId: FraudTypeId;
  type: string;
  difficulty: 1 | 2 | 3 | 4;
  isFraud: boolean;
  cardType: "chat" | "call" | "transfer" | "popup" | "sms" | "video";
  title: string;
  body: string;
  extra?: string[];
  cues?: string[];
  explain: string;
  source: string;
}

export interface CodexEntry {
  typeId: FraudTypeId;
  name: string;
  icon: string;
  catchphrase: string;
  points: string[];
  response: string;
  source: string;
  /** 学习系统：课程分级（不填则不进入学习路径） */
  courseLevel?: "basic" | "intermediate" | "advanced";
  /** 学习系统：该类反诈的典型案例 ID（链入 fraudBuster 题库） */
  exampleCaseIds?: string[];
  /** 学习系统：高押韵短句，用于学习卡片大字标题 */
  slogan?: string;
}

/** 反诈锦囊：可索引的科普短卡 */
export interface AntiFraudTip {
  id: string;
  title: string;
  body: string;
  source: string;
  /** 关联反诈类型 ID（可选，用于学习系统串联） */
  typeId?: FraudTypeId;
}

export type GameEvent =
  | { type: "score"; score: number }
  | { type: "wave"; wave: number }
  | { type: "combo"; combo: number }
  | { type: "shield"; shield: number }
  | { type: "lives"; lives: number }
  | { type: "hud"; payload: Record<string, string | number> }
  | { type: "toast"; text: string; tone: "good" | "bad" | "info" }
  | { type: "result"; payload: GameResultPayload }
  | { type: "log"; text: string }
  | { type: "bossCodex"; payload: BossCodexPayload }
  | { type: "waveBriefing"; payload: WaveBriefingPayload };

/** Boss 击破科普卡片：清波时由引擎 emit，场景层渲染覆盖卡片 */
export interface BossCodexPayload {
  /** Boss 名称 */
  bossName: string;
  /** 园区档位名（妙瓦底/缅北/总部） */
  tierName: string;
  /** 案例标题 */
  title: string;
  /** 案例正文 */
  body: string;
  /** 求助热线（如 12308/96110） */
  hotline: string;
  /** 识别要点列表 */
  points: string[];
}

/** 波次开场简报：每波开始时由引擎 emit，场景层渲染顶部横幅 */
export interface WaveBriefingPayload {
  /** 园区档位名 */
  tierName: string;
  /** 当前波次 */
  wave: number;
  /** 该园区对应的诈骗类型 */
  scamType: string;
  /** 识别要点（3 条） */
  points: string[];
}

export interface GameResultPayload {
  gameId: GameId;
  win: boolean;
  score: number;
  wave?: number;
  bustedCount?: number;
  destroyRate?: number;
  tipId: string;
  /** 最高连击数（可选，部分游戏提供） */
  maxCombo?: number;
  /** 游戏专属详细统计（如反诈 FBStats），由具体游戏填充 */
  stats?: unknown;
}
