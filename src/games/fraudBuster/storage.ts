/**
 * 反诈游戏（FraudBuster）存档系统：localStorage 持久化。
 * 本模块独立于 fraudBuster 的 engine/scene/data/types，不引入其他游戏模块，
 * 仅依赖浏览器 localStorage，所有 IO 均 try/catch 包裹，失败回退默认值。
 */

// ============ 存档数据结构 ============

export interface FBSaveData {
  /** 历史最高分 */
  highScore: number;
  /** 历史最高波次 */
  highWave: number;
  /** 累计识破诈骗数（即答对题数累计） */
  totalBusted: number;
  /** 累计 Boss 击破数 */
  totalBossDefeated: number;
  /** 累计游戏局数 */
  totalRuns: number;
  /** 当前段位 ID（见下方 FBRANKS） */
  rankId: string;
  /** 已解锁成就 ID 列表 */
  unlockedAchievements: string[];
  /** 各诈骗类型累计答题正确率 byType */
  byType: Record<string, { correct: number; total: number }>;
  /** 上次游戏时间戳 ISO */
  lastPlayedAt: string;
  // ===== 全面升级 v2 新增字段 =====
  /** 道具升级等级（B4：每种道具 1-3 级，key 为 FBItemType 字符串） */
  itemUpgradeLevels: Record<string, number>;
  /** 道具升级累计投入积分（B4，用于升级消耗） */
  itemUpgradeSpent: number;
  /** Boss 周挑战状态（A6，null=未参与本周） */
  bossWeek: FBSaveBossWeek | null;
  /** 错题复盘已清除的题目 ID（A5，避免重复出现） */
  reviewClearedIds: string[];
  /** 累计分支题完成数（B3） */
  totalBranchCompleted: number;
  /** 累计 AI 语音题答对数（A2） */
  totalAudioCorrect: number;
}

/** Boss 周挑战存档（A6，避免与 types 循环依赖，结构一致） */
export interface FBSaveBossWeek {
  weekKey: string;
  bossId: string;
  defeats: number;
  bestScore: number;
  rewardsClaimed: number;
}

// ============ 段位系统 ============

export interface FBRank {
  id: string;
  name: string;
  /** 解锁所需累计识破数 */
  minBusted: number;
  color: string;
  /** emoji 图标 */
  icon: string;
  /** 段位口号 */
  slogan: string;
}

/** 8 个段位，按累计识破数 busted 解锁 */
export const FBRANKS: FBRank[] = [
  { id: "R0", name: "学徒",     minBusted: 0,    color: "#5A6B85", icon: "📘", slogan: "万丈高楼平地起，识诈防骗从今始。" },
  { id: "R1", name: "见习",     minBusted: 50,   color: "#9FE3FF", icon: "🔰", slogan: "初识骗术轮廓，警惕之心已生。" },
  { id: "R2", name: "反诈新兵", minBusted: 200,  color: "#52C41A", icon: "🛡️", slogan: "披甲上阵，诈骗套路一眼穿。" },
  { id: "R3", name: "反诈尖兵", minBusted: 500,  color: "#00E5FF", icon: "⚔️", slogan: "锋芒初露，骗局在你面前无所遁形。" },
  { id: "R4", name: "反诈精英", minBusted: 1000, color: "#FFD666", icon: "🎖️", slogan: "百战精锐，骗术再巧也难逃法眼。" },
  { id: "R5", name: "反诈专家", minBusted: 2000, color: "#FF7A1A", icon: "🏅", slogan: "炉火纯青，识骗于未然。" },
  { id: "R6", name: "反诈大师", minBusted: 4000, color: "#FF5A60", icon: "👑", slogan: "登峰造极，诈骗克星，名扬天下。" },
  { id: "R7", name: "反诈宗师", minBusted: 8000, color: "#FF00E5", icon: "🌟", slogan: "宗师之境，护一方百姓，万骗不侵。" },
];

/** 返回当前累计识破数对应的段位 */
export function rankFor(busted: number): FBRank {
  let cur = FBRANKS[0];
  for (const r of FBRANKS) if (busted >= r.minBusted) cur = r;
  return cur;
}

// ============ 成就系统 ============

export interface FBAchievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** 基于存档判断是否解锁 */
  check: (save: FBSaveData) => boolean;
}

/** 10 个成就 + 6 个 v2 升级成就 */
export const FBACHIEVEMENTS: FBAchievement[] = [
  { id: "first_blood", name: "首战告捷", desc: "完成第一局反诈对战",         icon: "🎯", check: (s) => s.totalRuns >= 1 },
  { id: "wave_10",     name: "反诈先锋", desc: "单局坚持到第 10 波",         icon: "🌊", check: (s) => s.highWave >= 10 },
  { id: "wave_30",     name: "反诈勇者", desc: "单局坚持到第 30 波",         icon: "⚡", check: (s) => s.highWave >= 30 },
  { id: "wave_60",     name: "反诈王者", desc: "单局坚持到第 60 波",         icon: "👑", check: (s) => s.highWave >= 60 },
  { id: "score_5k",    name: "初露锋芒", desc: "单局得分达到 5,000",         icon: "💰", check: (s) => s.highScore >= 5000 },
  { id: "score_20k",   name: "反诈大师", desc: "单局得分达到 20,000",        icon: "🏆", check: (s) => s.highScore >= 20000 },
  { id: "score_50k",   name: "反诈之神", desc: "单局得分达到 50,000",        icon: "⭐", check: (s) => s.highScore >= 50000 },
  { id: "boss_5",      name: "Boss猎人", desc: "累计击破 5 个诈骗首脑",      icon: "🗡️", check: (s) => s.totalBossDefeated >= 5 },
  { id: "bust_500",    name: "百战不殆", desc: "累计识破 500 起诈骗",        icon: "💯", check: (s) => s.totalBusted >= 500 },
  // perfect_run：局内统计由 engine 临时判定并传入，存档层只占位，永不在 check 中自动解锁
  { id: "perfect_run", name: "完美一局", desc: "单局全程零失误通关",         icon: "✨", check: () => false },
  // ===== v2 升级成就 =====
  { id: "item_max",    name: "神兵利器", desc: "将任一道具升级至满级",       icon: "🔧", check: (s) => Object.values(s.itemUpgradeLevels ?? {}).some((lv) => lv >= 3) },
  { id: "item_allmax", name: "全副武装", desc: "所有道具升级至满级",         icon: "🛡️", check: (s) => Object.values(s.itemUpgradeLevels ?? {}).every((lv) => lv >= 3) },
  { id: "branch_10",   name: "情景大师", desc: "累计完成 10 次分支情景",     icon: "🎬", check: (s) => s.totalBranchCompleted >= 10 },
  { id: "audio_20",    name: "听音辨诈", desc: "累计答对 20 道 AI 语音题",   icon: "👂", check: (s) => s.totalAudioCorrect >= 20 },
  { id: "boss_week",   name: "周挑战者", desc: "击败本周 Boss 周挑战首脑",   icon: "📅", check: (s) => !!s.bossWeek && s.bossWeek.defeats >= 1 },
  { id: "review_50",   name: "补漏达人", desc: "错题复盘累计清除 50 题",      icon: "📝", check: (s) => s.reviewClearedIds.length >= 50 },
];

// ============ 存档 IO ============

const FB_SAVE_KEY = "fanzha:fb:save:v1";

/** 默认存档：所有数字 0，rankId "R0"，数组空，byType 空，lastPlayedAt 空字符串 */
export function defaultFBSave(): FBSaveData {
  return {
    highScore: 0,
    highWave: 0,
    totalBusted: 0,
    totalBossDefeated: 0,
    totalRuns: 0,
    rankId: "R0",
    unlockedAchievements: [],
    byType: {},
    lastPlayedAt: "",
    itemUpgradeLevels: { freeze: 1, fifty: 1, skip: 1, double: 1, hint: 1, undo: 1 },
    itemUpgradeSpent: 0,
    bossWeek: null,
    reviewClearedIds: [],
    totalBranchCompleted: 0,
    totalAudioCorrect: 0,
  };
}

/** 从 localStorage 读取存档，失败返回默认值不抛错 */
export function loadFBSave(): FBSaveData {
  try {
    const raw = localStorage.getItem(FB_SAVE_KEY);
    if (!raw) return defaultFBSave();
    const parsed = JSON.parse(raw) as Partial<FBSaveData>;
    if (!parsed || typeof parsed !== "object") return defaultFBSave();
    // 向后兼容：合并新字段（旧存档无 v2 字段时补默认值）
    const def = defaultFBSave();
    return {
      ...def,
      ...parsed,
      itemUpgradeLevels: { ...def.itemUpgradeLevels, ...(parsed.itemUpgradeLevels ?? {}) },
      byType: parsed.byType ?? {},
      unlockedAchievements: parsed.unlockedAchievements ?? [],
      reviewClearedIds: parsed.reviewClearedIds ?? [],
      bossWeek: parsed.bossWeek ?? null,
    };
  } catch {
    return defaultFBSave();
  }
}

/** 写入 localStorage，try/catch 包裹 */
export function saveFBSave(data: FBSaveData): void {
  try {
    localStorage.setItem(FB_SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[fb:storage] saveFBSave failed", e);
  }
}

/** 清空存档 */
export function resetFBSave(): void {
  try {
    localStorage.removeItem(FB_SAVE_KEY);
  } catch (e) {
    console.warn("[fb:storage] resetFBSave failed", e);
  }
}

// ============ 局后结算更新 ============

export interface FBRunStats {
  score: number;
  wave: number;
  busted: number;
  bossDefeated: number;
  byType: Record<string, { correct: number; total: number }>;
  // ===== v2 升级新增字段 =====
  branchCompleted?: number;
  audioCorrect?: number;
  seasonalEncountered?: number;
  bossWeekDefeated?: number;
  reviewCleared?: number;
  /** 本局清除的错题 ID（A5） */
  clearedWrongIds?: string[];
  /** 本局击败的 Boss 周 Boss ID（A6） */
  bossWeekBossId?: string;
}

export interface FBRunUpdateResult {
  save: FBSaveData;
  /** 本次新解锁的成就 ID 列表 */
  newAchievements: string[];
  /** 是否晋级段位（无变化或降级均为 null） */
  rankUp: FBRank | null;
}

/**
 * 局结束后更新存档：
 * - 累加 totalBusted / totalBossDefeated / totalRuns / byType
 * - 取 max 更新 highScore / highWave
 * - 累加 v2 字段：branchCompleted / audioCorrect / reviewClearedIds
 * - 更新 Boss 周状态（A6）
 * - 重算 rankId，若与之前不同则视为晋级
 * - 对比"之前未解锁、现在解锁"的差集，收集 newAchievements
 * - 写回 localStorage 并返回结果
 */
export function updateFBSaveAfterRun(runStats: FBRunStats): FBRunUpdateResult {
  const save = loadFBSave();
  const prevRankId = save.rankId;
  const prevUnlocked = new Set(save.unlockedAchievements);

  // 累计 / 取最大值
  save.highScore = Math.max(save.highScore, runStats.score);
  save.highWave = Math.max(save.highWave, runStats.wave);
  save.totalBusted += runStats.busted;
  save.totalBossDefeated += runStats.bossDefeated;
  save.totalRuns += 1;

  // byType 累加（不覆盖）
  for (const typeId of Object.keys(runStats.byType)) {
    const inc = runStats.byType[typeId];
    const cur = save.byType[typeId] ?? { correct: 0, total: 0 };
    cur.correct += inc.correct;
    cur.total += inc.total;
    save.byType[typeId] = cur;
  }

  // v2 字段累加
  if (runStats.branchCompleted) save.totalBranchCompleted += runStats.branchCompleted;
  if (runStats.audioCorrect) save.totalAudioCorrect += runStats.audioCorrect;
  if (runStats.clearedWrongIds && runStats.clearedWrongIds.length > 0) {
    const existing = new Set(save.reviewClearedIds);
    for (const id of runStats.clearedWrongIds) existing.add(id);
    save.reviewClearedIds = [...existing];
  }

  // Boss 周挑战状态更新（A6）
  if (runStats.bossWeekBossId) {
    const weekKey = currentBossWeekKey();
    const cur = save.bossWeek && save.bossWeek.weekKey === weekKey ? save.bossWeek : { weekKey, bossId: runStats.bossWeekBossId, defeats: 0, bestScore: 0, rewardsClaimed: 0 };
    cur.defeats += runStats.bossWeekDefeated ?? 0;
    cur.bestScore = Math.max(cur.bestScore, runStats.score);
    save.bossWeek = cur;
  }

  // 重算段位
  const newRank = rankFor(save.totalBusted);
  save.rankId = newRank.id;

  // 成就差集：之前未解锁 && 现在 check 通过
  const newAchievements: string[] = [];
  for (const a of FBACHIEVEMENTS) {
    if (!prevUnlocked.has(a.id) && a.check(save)) {
      newAchievements.push(a.id);
    }
  }
  if (newAchievements.length > 0) {
    save.unlockedAchievements = [...prevUnlocked, ...newAchievements];
  }

  save.lastPlayedAt = new Date().toISOString();

  saveFBSave(save);

  // 段位晋级判断：rankId 变化即晋级（本系统累计识破只增不减，故仅可能升级）
  const rankUp = prevRankId !== newRank.id ? newRank : null;

  return { save, newAchievements, rankUp };
}

// ============ v2 升级辅助函数 ============

/** 计算当前 ISO 周次 key（YYYY-Www） */
export function currentBossWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNum = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** 升级道具（B4）：消耗积分提升等级，返回是否成功 */
export function upgradeItem(type: string, cost: number): boolean {
  const save = loadFBSave();
  const curLv = save.itemUpgradeLevels[type] ?? 1;
  if (curLv >= 3) return false; // 已满级
  // 用累计识破数作为"积分"池（不直接扣分，而是要求达到阈值）
  if (save.totalBusted < cost) return false;
  save.itemUpgradeLevels[type] = curLv + 1;
  save.itemUpgradeSpent += cost;
  saveFBSave(save);
  return true;
}

/** 获取道具当前等级（1-3） */
export function getItemLevel(type: string): number {
  const save = loadFBSave();
  return save.itemUpgradeLevels[type] ?? 1;
}

/** 标记错题已清除（A5） */
export function markWrongReviewed(questionIds: string[]): void {
  if (questionIds.length === 0) return;
  const save = loadFBSave();
  const existing = new Set(save.reviewClearedIds);
  for (const id of questionIds) existing.add(id);
  save.reviewClearedIds = [...existing];
  saveFBSave(save);
}
