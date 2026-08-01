import type { FBGameMode } from "../types";

// ============ v3 升级：游戏模式中文名/图标/提示 ============

export const FB_MODE_LABELS: Record<FBGameMode, string> = {
  endless: "无尽模式",
  story: "剧情战役",
  speedrun: "极速闯关",
  hardcore: "硬核生存",
  daily: "每日挑战",
  review: "错题噩梦",
  aiBattle: "AI 对战",
  versus: "双人对战",
  deconstruct: "骗局拆解",
  detective: "反诈侦探",
};

export const FB_MODE_ICONS: Record<FBGameMode, string> = {
  endless: "🌊",
  story: "📖",
  speedrun: "⚡",
  hardcore: "💀",
  daily: "📅",
  review: "📝",
  aiBattle: "🤖",
  versus: "⚔️",
  deconstruct: "🔬",
  detective: "🔍",
};

export const FB_MODE_DESCRIPTIONS: Record<FBGameMode, string> = {
  endless: "经典模式，波次无尽，难度递增。坚持到第 60 波成为反诈王者。",
  story: "6 关线性剧本，每关固定题组+最终Boss战。剧情通关解锁成就。",
  speedrun: "30 题 / 5 分钟，按正确率+剩余时间排名。极限手速挑战。",
  hardcore: "1 点体力、无道具、答错即终局。最高连对记录你的硬核实力。",
  daily: "每日 10 题，全网同一份。建立你的每日反诈习惯。",
  review: "基于历史错题生成 20 题强化训练，专攻薄弱环节。",
  aiBattle: "与 AI 骗子多轮对话识破，识别关键红旗。沉浸式反诈对抗。",
  versus: "同设备双人轮流答题，答对攻击对方血量。亲子/师生/情侣反诈教育。",
  deconstruct: "观看完整骗子剧本，逐句拆解话术目的与心理手法。反向强化识诈能力。",
  detective: "接警后多源证据链交叉推理，还原诈骗剧本，定位破局点。沉浸式侦探推理。",
};

export const FB_MODE_HINTS: Record<FBGameMode, string | null> = {
  endless: null,
  story: "通关所需最低正确数：4/5 题",
  speedrun: "30 题 · 5 分钟 · 限时闯关",
  hardcore: "⚠ 答错即终局 · 无道具 · 1 点体力",
  daily: "每日 10 题 · 全网同一份",
  review: "错题强化训练 · 清除 20 题",
  aiBattle: "🤖 多轮对话 · 识破红旗 · 限时对抗",
  versus: "⚔️ 双人轮流 · 答对攻击 · HP 先归零者负",
  deconstruct: "🔬 逐句拆解 · 识别话术 · 学习反诈",
  detective: "🔍 多源证据 · 交叉推理 · 定位破局点",
};

/** 极速模式：总题数与时长（秒） */
export const SPEEDRUN_CONFIG = { totalQuestions: 30, durationSec: 300 };

/** 每日挑战：题数 */
export const DAILY_CONFIG = { totalQuestions: 10 };

/** 错题噩梦：题数 */
export const REVIEW_NIGHTMARE_CONFIG = { totalQuestions: 20 };

// ============ v3 升级：战报分享铭言池 ============

/** 战报分享卡随机铭言（结算页分享时随机选一条） */
export const BATTLE_REPORT_MOTTOS: string[] = [
  "反诈不是游戏，是必修课。",
  "识破一次诈骗，守护一个家庭。",
  "你的警惕，是骗子最怕的武器。",
  "不轻信、不转账、不透露。",
  "96110，反诈专线记心间。",
  "AI 可换脸，警惕不能换。",
  "保本与高收益不可兼得。",
  "止损才是赢家，已损失的钱追不回。",
  "公检法不电话办案，无安全账户。",
  "回拨原号码，核实最可靠。",
  "视频不是身份证明，转账必须二次核实。",
  "脱离平台交易无担保，加微信转账=诈骗。",
  "租卡跑分=帮信罪，最高判3年。",
  "正规招聘不收任何费用。",
  "换汇只走银行，私下换汇=诈骗+洗钱。",
];
// ============ v5 升级：新模式配置常量 ============

/** AI 对战模式配置 */
export const AI_BATTLE_CONFIG = {
  /** 默认每局限时（秒） */
  durationSec: 180,
  /** 通关阈值：识破红旗数 */
  defaultPassThreshold: 3,
  /** 最大轮次 */
  maxTurns: 12,
};

/** 双人对战模式配置 */
export const VERSUS_CONFIG = {
  /** 每位玩家初始血量 */
  initialHp: 100,
  /** 答对攻击伤害 */
  damageOnCorrect: 20,
  /** 连击额外伤害（每连击+5） */
  comboBonusDamage: 5,
  /** 答错自伤 */
  selfDamageOnWrong: 10,
  /** 总题数 */
  totalQuestions: 15,
  /** 玩家1默认配置 */
  p1: { name: "玩家1", icon: "🦸", color: "#1AD670" },
  /** 玩家2默认配置 */
  p2: { name: "玩家2", icon: "🦹", color: "#E5353B" },
};

/** 骗局拆解模式配置 */
export const DECONSTRUCT_CONFIG = {
  /** 每行自动播放间隔（毫秒） */
  autoPlayInterval: 3500,
  /** 是否默认自动播放 */
  autoPlayDefault: false,
};

/** 反诈侦探模式配置 */
export const DETECTIVE_CONFIG = {
  /** 证据浏览默认时限（秒） */
  defaultEvidenceReviewSec: 90,
  /** 破案及格分（0-100） */
  passScore: 60,
  /** 每题权重（推理得分 = 答对题数 / 总题数 * 100） */
  scorePerQuestion: 20,
};
