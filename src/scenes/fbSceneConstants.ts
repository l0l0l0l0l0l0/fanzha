/**
 * FraudBusterScene 场景常量定义
 * 从 FraudBusterScene.ts 拆分而来（阶段 1.1 技术债清理）
 */
import type { FBItemType, FBDifficulty, FBGameMode, FBSpecialEvent, FBBossSkill, FBPsychology } from "@/games/fraudBuster/types";

// 画布尺寸（与引擎一致）
export const CANVAS_W = 800;
export const CANVAS_H = 480;

// 卡片区域（与 engine.ts 一致，用于 drawCaseArchive 定位）
export const CARD_X = 20;
export const CARD_Y = 80;
export const CARD_W = 360;
export const CARD_H = 380;

// 右半区选项面板
export const OPT_X = 410;
export const OPT_W = 370;

// 选项字母
export const LETTERS = ["A", "B", "C", "D"];
export const JUDGE_LETTERS = ["✓", "✗"];

// 道具按钮（画布顶部右半区，6 个按钮 - 紧凑布局）
export const ITEM_TYPES: FBItemType[] = ["freeze", "fifty", "skip", "double", "hint", "undo"];
export const ITEM_BTN_W = 58;
export const ITEM_BTN_H = 36;
export const ITEM_BTN_GAP = 4;
export const ITEM_BTN_Y = 12;
export const ITEM_BTN_X = OPT_X + (OPT_W - (ITEM_BTN_W * 6 + ITEM_BTN_GAP * 5)) / 2;

// 难度选择按钮（ready 状态，画布坐标）
export const DIFF_BTN_W = 180;
export const DIFF_BTN_H = 80;
export const DIFF_BTN_GAP = 24;
export const DIFFICULTY_DEFS: { id: FBDifficulty; label: string; desc: string; color: string }[] = [
  { id: "easy", label: "简单", desc: "倒计时 ×1.3", color: "#1AD670" },
  { id: "normal", label: "普通", desc: "倒计时 ×1.0", color: "#00E5FF" },
  { id: "hard", label: "困难", desc: "倒计时 ×0.75", color: "#E5353B" },
];

// v3 模式选择按钮（modeSelect 状态，画布坐标，3 列 × 4 行网格，v6 升级扩容至 10 种模式）
export const MODE_BTN_W = 230;
export const MODE_BTN_H = 60;
export const MODE_BTN_GAP_X = 20;
export const MODE_BTN_GAP_Y = 6;
export const MODE_ORDER: FBGameMode[] = ["endless", "story", "speedrun", "hardcore", "daily", "review", "aiBattle", "versus", "deconstruct", "detective"];
export const MODE_COLORS: Record<FBGameMode, string> = {
  endless: "#00E5FF",
  story: "#B388FF",
  speedrun: "#FFD666",
  hardcore: "#E5353B",
  daily: "#52C41A",
  review: "#FF7A1A",
  aiBattle: "#FF00E5",
  versus: "#FFB020",
  deconstruct: "#7C4DFF",
  detective: "#00E5FF",
};

// v3 Phase 4：教育入口行（modeSelect 底部，2 个大按钮：图鉴 + 96110）
export const EDU_BTN_W = 354;
export const EDU_BTN_H = 56;
export const EDU_BTN_GAP = 12;
export const EDU_BTN_Y = 394;
export const EDU_ENTRIES: { id: "codex" | "hotline"; icon: string; label: string; desc: string; color: string }[] = [
  { id: "codex", icon: "📚", label: "反诈图鉴", desc: "浏览诈骗类型 · 防骗要点 · 案例档案", color: "#00E5FF" },
  { id: "hotline", icon: "📞", label: "96110 通话器", desc: "模拟反诈中心咨询 · 真实剧本 · TTS 朗读", color: "#1AD670" },
];

// 大招按钮（画布右下角）
export const ULT_BTN_W = 130;
export const ULT_BTN_H = 48;
export const ULT_BTN_X = CANVAS_W - ULT_BTN_W - 12;
export const ULT_BTN_Y = CANVAS_H - ULT_BTN_H - 12;

// 特殊事件中文名映射
export const SPECIAL_EVENT_NAMES: Record<FBSpecialEvent, string> = {
  double: "双重诈骗",
  timeCompress: "时间压缩",
  shuffle: "选项乱序",
  mixedTrueFalse: "真假混杂",
  rapidFire: "急速连答",
  itemLock: "道具禁用",
};
export const SPECIAL_EVENT_ICONS: Record<FBSpecialEvent, string> = {
  double: "⚡",
  timeCompress: "⏱",
  shuffle: "🔀",
  mixedTrueFalse: "🎭",
  rapidFire: "🔥",
  itemLock: "🔒",
};

// Boss 技能中文名映射
export const BOSS_SKILL_NAMES: Record<FBBossSkill, string> = {
  shuffleOptions: "选项打乱",
  hideTimer: "隐藏倒计时",
  summonMinion: "召唤小怪",
  lockItem: "封印道具",
  timeSteal: "偷取时间",
  answerBlur: "选项模糊",
};

// 心理操控手法中文名映射（与 engine.psychologyLabel 一致）
export const PSYCHOLOGY_LABELS: Record<FBPsychology, string> = {
  urgency: "紧迫施压",
  authority: "权威恐吓",
  greed: "贪婪诱惑",
  fear: "恐惧施压",
  trust: "信任建立",
  intimacy: "情感亲密",
  curiosity: "好奇心",
  conformity: "从众压力",
  scarcity: "稀缺暗示",
  sunkCost: "沉没成本",
};
