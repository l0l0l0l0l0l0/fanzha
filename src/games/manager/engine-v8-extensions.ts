/**
 * v8 扩展系统 · 数据表 + 渲染常量 + 系统文档
 *
 * 本文件集中管理 v8「全面升级」引入的模块级常量与文档，降低 engine.ts 体积。
 * v8 方法（update/render/交互入口）仍保留在 ManagerEngine 类内，因其需访问
 * 25+ private 字段（agents/enemies/floats/particles/score/energy 等），完整抽取
 * 会导致大量字段被迫改为 public，破坏封装。采用保守策略：仅抽取数据层。
 *
 * v8 系统包含四大子系统：
 * 1. 受害人营救（Victim Rescue）：地图随机出现 NPC，敌人接触触发洗脑进度，
 *    探员靠近可逆转化解救。营救加分+能量，沦陷扣分。
 * 2. 话术气泡（Speech Bubbles）：行走中的敌人头顶周期性出现诈骗话术，
 *    玩家点击对应口诀槽击破，击破后敌人易伤+即时扣血；超时未击破则回血加速。
 * 3. 战术指令（Tactical Commands）：每探员可下达 5 种指令
 *    （focusFire/retreat/reload/taunt/overdrive），各有冷却与即时效果。
 * 4. 卡牌大招（Card Skills）：每波重抽手牌，每探员 1 张卡，消耗能量释放。
 *
 * 此外还有案例五步复盘（Case Breakdown）：击破 BOSS 后触发答题，答对加分。
 */

import type {
  CounterspellDef,
  SpeechBubble,
  VictimNPC,
  TacticalCommandState,
  CardSkillDef,
  CaseBreakdownDef,
  VictimRescueConfig,
} from "./types";

// ====================================================================
// v8 话术气泡文本表
// ====================================================================

/**
 * v8 话术气泡文本（按敌人 fraudType 索引）。
 * 用于"话术气泡实时拆穿"系统：敌人头顶冒出对应话术，玩家需选对反诈口诀击破。
 * v10 新增 2026 新型诈骗话术（DeepSeek 仿冒 / AI 实时换脸）。
 */
export const SPEECH_TEXTS: Record<string, string> = {
  "话术脚本诈骗": "您好，这里是客服，您的订单异常…",
  "冒充客服诈骗": "商品质量问题，为您双倍退款…",
  "冒充公检法诈骗": "您涉嫌洗钱，请配合调查到安全账户验资",
  "杀猪盘情感诈骗": "宝贝，跟单稳赚不赔，一起投资吧",
  "钓鱼网站盗刷": "银行积分即将清零，点击兑换…",
  "买卖银行卡洗钱": "高价租你的银行卡，月入 2000",
  "跨境电诈": "你在境外有未处理的违法记录",
  "AI 换脸冒充熟人": "（视频）是我，急用钱转我一下",
  "虚假投资平台诈骗": "内部渠道年化 30%，跟老师操作",
  "冒充领导熟人转账": "在开会不便接电话，帮我转钱给客户",
  "ETC 过期短信诈骗": "您的 ETC 已禁用，点击补办",
  "假冒客服退费诈骗": "退还您课程费用，请共享屏幕指导",
  "假冒注销校园贷诈骗": "不注销校园贷影响征信，请配合处理",
  "虚假招聘押金诈骗": "录用需缴纳押金，入职后返还",
  "二手演唱会票务诈骗": "内部渠道票，转账后秒发",
  "机票退改签诈骗": "航班取消，点击链接办理退改签",
  "虚构亲友意外诈骗": "你亲戚出事了，赶紧转手术费",
  // v10 新增：2026 新型诈骗话术
  "DeepSeek 大模型仿冒客服": "您好，DeepSeek 官方助手，账户异常开通会员扣费 800 元",
  "AI 实时换脸冒充熟人": "（视频通话）是我，急用钱，先转我 5 万",
};

// ====================================================================
// v8 渲染常量（drawSpeechBubbles / drawVictims 使用）
// ====================================================================

/** 话术气泡宽度 */
export const BUBBLE_W = 150;
/** 话术气泡高度 */
export const BUBBLE_H = 32;
/** 话术气泡圆角 */
export const BUBBLE_RADIUS = 6;
/** 话术气泡三角指示器偏移 */
export const BUBBLE_ARROW_H = 6;

/** 受害人洗脑进度环半径 */
export const VICTIM_RING_R = 16;
/** 受害人洗脑进度环线宽 */
export const VICTIM_RING_LW = 3;
/** 受害人 emoji 字号 */
export const VICTIM_EMOJI_SIZE = 18;

/** 话术气泡淡出阈值（剩余时间 <= 1.5s 开始淡出） */
export const BUBBLE_FADE_THRESHOLD = 1.5;
/** 话术气泡进度条警告阈值（ratio > 0.4 显示绿色，否则红色） */
export const BUBBLE_WARN_RATIO = 0.4;

// ====================================================================
// v8 系统状态接口（文档用途 —— 标注 v8 方法在 ManagerEngine 上的依赖）
// ====================================================================

/**
 * v8 系统依赖契约（文档用，非运行时约束）。
 * 标注 v8 方法需要访问的 ManagerEngine 字段/方法，为未来完整抽取提供参考。
 * @internal
 */
export interface V8EngineAccess {
  // v8 专属状态（如未来抽取，这些字段应迁移到 V8Systems 类）
  victims: VictimNPC[];
  victimSeq: number;
  victimRescueConfig: VictimRescueConfig | null;
  victimsRescued: number;
  victimsLost: number;
  speechBubbles: SpeechBubble[];
  bubbleSeq: number;
  counterspellSlots: CounterspellDef[];
  counterspellCooldowns: number[];
  selectedAgentIdx: number | null;
  tacticalCommandStates: TacticalCommandState[];
  cardHand: CardSkillDef[];
  cardHandSeed: string;
  pendingCaseBreakdown: CaseBreakdownDef | null;
  lastBreakdownCorrect: boolean | null;
  speechBubblesBroken: number;
  cardSkillsUsed: number;
  tacticalCommandsUsed: number;

  // 引擎核心字段（v8 方法读写）
  readonly t: number;
  readonly score: number;
  readonly energy: number;
  readonly over: boolean;
  readonly upgradeReady: boolean;
  readonly mode: string;
  readonly level: number;
  readonly wave: number;

  // 核心方法
  emitHud(): void;
  hasModifier(id: string): boolean;
}
