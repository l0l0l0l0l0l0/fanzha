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
  // ===== v3 升级新增字段（游戏模式） =====
  /** 剧情模式：已通关关卡索引列表（0-based，如 [0,1,2] 表示前 3 关已通关） */
  storyClearedStages: number[];
  /** 剧情模式：当前正在挑战的关卡索引（null=未开始） */
  storyCurrentStage: number | null;
  /** 极速模式：最佳用时（秒，越短越好，仅完美通关 30 题后记录） */
  speedrunBestTime: number;
  /** 极速模式：最佳正确数 */
  speedrunBestCorrect: number;
  /** 硬核模式：最高连对题数（ Hardcore 答错即终局） */
  hardcoreBestStreak: number;
  /** 每日挑战历史：日期 key -> 当日正确数（仅保留最近 30 天） */
  dailyHistory: Record<string, number>;
  /** 错题噩梦模式：累计清除题数 */
  reviewNightmareTotalCleared: number;
  /** 累计完美一局次数（零失误通关） */
  perfectRunCount: number;
  // ===== v4 升级新增字段（每日任务/节日活动/本地排行榜） =====
  /** 每日任务：当前日期 key（YYYY-MM-DD），与今天不符则重置 */
  dailyTasksDate: string;
  /** 每日任务进度列表（仅当天有效，跨天重置） */
  dailyTaskProgress: FBDailyTaskProgressSave[];
  /** 节日活动：已通关活动 ID 列表（首次通关解锁奖励，不重复领取） */
  seasonalEventCleared: string[];
  /** 节日活动通关记录：活动 ID -> 最佳分数 */
  seasonalEventBestScores: Record<string, number>;
  /** 本地排行榜：玩家各模式历史最佳分数条目（mode -> 条目） */
  localRankBest: Record<string, FBLocalRankEntrySave>;
  /** 累计每日任务奖励领取次数（统计） */
  totalDailyTaskClaimed: number;
  // ===== v6 升级新增字段（教育功能：证书系统 + 拆解/AI 对战进度追踪） =====
  /** 已通关的骗局拆解剧本 ID 列表（用于"拆解专家"证书条件） */
  deconstructClearedIds: string[];
  /** 已通关的 AI 对战剧本 ID 列表（用于"AI 克星"证书条件） */
  aiBattleClearedIds: string[];
  /** 硬核模式完美通关次数（零失误通关 hardcore，用于"硬核完美"证书条件） */
  hardcorePerfectCount: number;
  /** 已颁发的反诈证书记录列表（C1 教育功能） */
  certificates: FBCertificateRecord[];
  // ===== v6 升级新增字段（反诈侦探模式） =====
  /** 已破案的反诈侦探案件 ID 列表（用于案件归档与重玩标记） */
  detectiveSolvedCases: string[];
  /** 反诈侦探模式累计推理得分（每局累加，用于排行榜与成就） */
  detectiveTotalScore: number;
  /** 反诈侦探模式累计破案数 */
  detectiveSolvedCount: number;
}

/** 反诈证书存档记录（精简版，仅存档用；完整定义见 types.ts FBCertificate） */
export interface FBCertificateRecord {
  /** 证书 ID（与 certificate.ts 中 CERT_DEFS 的 id 对应） */
  id: string;
  /** 颁发时间戳 ISO */
  issuedAt: string;
}

/** 每日任务进度存档（精简版，仅存档用） */
export interface FBDailyTaskProgressSave {
  taskId: string;
  progress: number;
  claimed: boolean;
}

/** 本地排行榜存档条目（精简版，仅存玩家自己的最佳记录） */
export interface FBLocalRankEntrySave {
  name: string;
  score: number;
  rankName: string;
  rankIcon: string;
  gameMode: string;
  date: string;
  perfect: boolean;
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
    // v3 游戏模式字段
    storyClearedStages: [],
    storyCurrentStage: null,
    speedrunBestTime: 0,
    speedrunBestCorrect: 0,
    hardcoreBestStreak: 0,
    dailyHistory: {},
    reviewNightmareTotalCleared: 0,
    perfectRunCount: 0,
    // v4 字段
    dailyTasksDate: "",
    dailyTaskProgress: [],
    seasonalEventCleared: [],
    seasonalEventBestScores: {},
    localRankBest: {},
    totalDailyTaskClaimed: 0,
    // v6 字段（教育功能：证书系统 + 拆解/AI 对战进度追踪）
    deconstructClearedIds: [],
    aiBattleClearedIds: [],
    hardcorePerfectCount: 0,
    certificates: [],
    // v6 字段（反诈侦探模式）
    detectiveSolvedCases: [],
    detectiveTotalScore: 0,
    detectiveSolvedCount: 0,
  };
}

/** 从 localStorage 读取存档，失败返回默认值不抛错 */
export function loadFBSave(): FBSaveData {
  try {
    const raw = localStorage.getItem(FB_SAVE_KEY);
    if (!raw) return defaultFBSave();
    const parsed = JSON.parse(raw) as Partial<FBSaveData>;
    if (!parsed || typeof parsed !== "object") return defaultFBSave();
    // 向后兼容：合并新字段（旧存档无 v2/v3 字段时补默认值）
    const def = defaultFBSave();
    return {
      ...def,
      ...parsed,
      itemUpgradeLevels: { ...def.itemUpgradeLevels, ...(parsed.itemUpgradeLevels ?? {}) },
      byType: parsed.byType ?? {},
      unlockedAchievements: parsed.unlockedAchievements ?? [],
      reviewClearedIds: parsed.reviewClearedIds ?? [],
      bossWeek: parsed.bossWeek ?? null,
      // v3 字段合并
      storyClearedStages: parsed.storyClearedStages ?? [],
      storyCurrentStage: parsed.storyCurrentStage ?? null,
      dailyHistory: parsed.dailyHistory ?? {},
      // v4 字段合并
      dailyTasksDate: parsed.dailyTasksDate ?? "",
      dailyTaskProgress: parsed.dailyTaskProgress ?? [],
      seasonalEventCleared: parsed.seasonalEventCleared ?? [],
      seasonalEventBestScores: parsed.seasonalEventBestScores ?? {},
      localRankBest: parsed.localRankBest ?? {},
      totalDailyTaskClaimed: parsed.totalDailyTaskClaimed ?? 0,
      // v6 字段合并（教育功能）
      deconstructClearedIds: parsed.deconstructClearedIds ?? [],
      aiBattleClearedIds: parsed.aiBattleClearedIds ?? [],
      hardcorePerfectCount: parsed.hardcorePerfectCount ?? 0,
      certificates: parsed.certificates ?? [],
      // v6 字段合并（反诈侦探模式）
      detectiveSolvedCases: parsed.detectiveSolvedCases ?? [],
      detectiveTotalScore: parsed.detectiveTotalScore ?? 0,
      detectiveSolvedCount: parsed.detectiveSolvedCount ?? 0,
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
  // ===== v4 升级新增字段（每日任务/节日活动/本地排行榜） =====
  /** 本局最大连击数（每日任务 combo 类型用） */
  maxCombo?: number;
  /** 本局使用道具次数（每日任务 useItem 类型用） */
  itemUsedCount?: number;
  /** 本局游戏模式（每日任务 clearMode / 本地排行榜用） */
  gameMode?: string;
  /** 本局是否完美一局（零失误，本地排行榜 perfect 标记） */
  perfectRun?: boolean;
  /** 本局段位名（本地排行榜显示用） */
  rankName?: string;
  /** 本局段位图标（本地排行榜显示用） */
  rankIcon?: string;
  /** 本局是否通关节日活动（活动 ID） */
  seasonalEventClearedId?: string;
  /** 本局节日活动得分 */
  seasonalEventScore?: number;
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

  // v4 每日任务进度更新（跨天自动重置）
  ensureDailyTasksFresh(save);
  updateDailyTaskProgressFromRun(save, runStats);

  // v4 节日活动通关记录
  if (runStats.seasonalEventClearedId && runStats.seasonalEventScore !== undefined) {
    if (!save.seasonalEventCleared.includes(runStats.seasonalEventClearedId)) {
      save.seasonalEventCleared.push(runStats.seasonalEventClearedId);
    }
    const prev = save.seasonalEventBestScores[runStats.seasonalEventClearedId] ?? 0;
    save.seasonalEventBestScores[runStats.seasonalEventClearedId] = Math.max(prev, runStats.seasonalEventScore);
  }

  // v4 本地排行榜：玩家各模式历史最佳
  if (runStats.gameMode && runStats.score > 0) {
    const mode = runStats.gameMode;
    const prev = save.localRankBest[mode];
    if (!prev || runStats.score > prev.score) {
      save.localRankBest[mode] = {
        name: prev?.name ?? "我",
        score: runStats.score,
        rankName: runStats.rankName ?? "反诈新兵",
        rankIcon: runStats.rankIcon ?? "🛡️",
        gameMode: mode,
        date: dailyKey(),
        perfect: runStats.perfectRun ?? false,
      };
    }
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

// ============ v4 升级辅助函数：每日任务/节日活动/本地排行榜 ============

/** 生成每日日期 key（YYYY-MM-DD），与 dataV2.ts 的 dailyKey 保持一致 */
export function dailyKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 确保每日任务进度与当前日期一致：若存档中日期与今天不符，重置进度。
 * 在 updateFBSaveAfterRun / getDailyTaskProgress 调用前执行。
 */
export function ensureDailyTasksFresh(save: FBSaveData, dateKey?: string): void {
  const today = dateKey ?? dailyKey();
  if (save.dailyTasksDate !== today) {
    save.dailyTasksDate = today;
    save.dailyTaskProgress = [];
  }
}

/**
 * 根据 FBRunStats 增量更新每日任务进度。
 * 任务定义由 dataV2.ts 的 pickDailyTasks 提供，本函数仅按 task.type 增量累计。
 * @param save 存档（已 ensureDailyTasksFresh）
 * @param runStats 局后统计
 */
function updateDailyTaskProgressFromRun(save: FBSaveData, runStats: FBRunStats): void {
  // 本函数仅按 task.type 累计进度，task 列表由外部传入或从 save.dailyTaskProgress 读取
  // 由于存档中仅保存进度，task 定义需由调用方（scene/engine）在调用前注入 save.dailyTaskProgress
  // 这里按已有进度条目累加：根据 task.id 前缀判断类型
  for (const entry of save.dailyTaskProgress) {
    if (entry.claimed) continue;
    const id = entry.taskId;
    if (id.startsWith("DT-BUST") && !id.includes("BUST-")) {
      // DT-BUST5 / DT-BUST10：识破数
      entry.progress += runStats.busted;
    } else if (id.startsWith("DT-BUST-")) {
      // DT-BUST-PIG / DT-BUST-AI 等：识破指定类型
      // 由 runStats.byType 增量，但需要 typeId 映射，这里不展开，由 scene 层显式调用 incrementDailyTask
      // 本函数仅处理通用类型
    } else if (id.startsWith("DT-COMBO")) {
      entry.progress = Math.max(entry.progress, runStats.maxCombo ?? 0);
    } else if (id.startsWith("DT-ITEM")) {
      entry.progress += runStats.itemUsedCount ?? 0;
    } else if (id.startsWith("DT-BOSS")) {
      entry.progress += runStats.bossDefeated;
    } else if (id.startsWith("DT-CLEAR")) {
      // 通关指定模式：仅当本局模式匹配且通关时 +1
      // 通关判定由 scene 层决定并设置 runStats.gameMode + cleared 标记
      // 这里简化：若 mode 匹配则 +1（cleared 判定由 scene 层在调用前过滤）
      if (id === "DT-CLEAR-DAILY" && runStats.gameMode === "daily") {
        entry.progress += 1;
      } else if (id === "DT-CLEAR-HARDCORE" && runStats.gameMode === "hardcore") {
        entry.progress += runStats.busted; // hardcore 答对 N 题
      }
    }
  }
}

/**
 * 显式递增指定任务的进度（用于 bustType 类型任务，scene 层知道 typeId）。
 * @param taskId 任务 ID
 * @param delta 增量
 */
export function incrementDailyTask(taskId: string, delta: number): void {
  const save = loadFBSave();
  ensureDailyTasksFresh(save);
  const entry = save.dailyTaskProgress.find((e) => e.taskId === taskId);
  if (entry && !entry.claimed) {
    entry.progress += delta;
    saveFBSave(save);
  }
}

/**
 * 初始化今日每日任务进度条目（若未存在）。
 * 由 scene 层在玩家进入主界面时调用，传入今日选中的任务 ID 列表。
 * @param taskIds 今日任务 ID 列表
 */
export function initDailyTasks(taskIds: string[]): void {
  const save = loadFBSave();
  ensureDailyTasksFresh(save);
  for (const id of taskIds) {
    if (!save.dailyTaskProgress.find((e) => e.taskId === id)) {
      save.dailyTaskProgress.push({ taskId: id, progress: 0, claimed: false });
    }
  }
  saveFBSave(save);
}

/**
 * 读取今日每日任务进度（自动跨天重置）。
 * @param taskIds 今日任务 ID 列表（由 dataV2.ts 的 pickDailyTasks 选取）
 */
export function getDailyTaskProgress(taskIds: string[]): FBDailyTaskProgressSave[] {
  const save = loadFBSave();
  ensureDailyTasksFresh(save);
  // 若进度条目缺失，自动补齐（不写回，避免读操作产生副作用）
  const existing = new Map(save.dailyTaskProgress.map((e) => [e.taskId, e]));
  return taskIds.map((id) => existing.get(id) ?? { taskId: id, progress: 0, claimed: false });
}

/**
 * 领取每日任务奖励：标记 claimed 并返回是否领取成功。
 * 奖励发放（积分/经验）由 scene 层处理，本函数仅标记状态。
 * @param taskId 任务 ID
 * @param target 任务目标值（判断 progress >= target）
 */
export function claimDailyTaskReward(taskId: string, target: number): boolean {
  const save = loadFBSave();
  ensureDailyTasksFresh(save);
  const entry = save.dailyTaskProgress.find((e) => e.taskId === taskId);
  if (!entry || entry.claimed || entry.progress < target) return false;
  entry.claimed = true;
  save.totalDailyTaskClaimed += 1;
  saveFBSave(save);
  return true;
}

// ============ v4 节日活动辅助函数 ============

/** 检查节日活动是否已通关（首次通关解锁奖励） */
export function isSeasonalEventCleared(eventId: string): boolean {
  const save = loadFBSave();
  return save.seasonalEventCleared.includes(eventId);
}

/** 获取节日活动最佳分数（0=未通关） */
export function getSeasonalEventBestScore(eventId: string): number {
  const save = loadFBSave();
  return save.seasonalEventBestScores[eventId] ?? 0;
}

/**
 * 标记节日活动通关（由 scene 层在玩家通关活动后调用）。
 * 返回是否首次通关（用于发放首次奖励）。
 * @param eventId 活动 ID
 * @param score 本局分数
 */
export function markSeasonalEventCleared(eventId: string, score: number): boolean {
  const save = loadFBSave();
  const isFirst = !save.seasonalEventCleared.includes(eventId);
  if (isFirst) save.seasonalEventCleared.push(eventId);
  const prev = save.seasonalEventBestScores[eventId] ?? 0;
  save.seasonalEventBestScores[eventId] = Math.max(prev, score);
  saveFBSave(save);
  return isFirst;
}

// ============ v4 本地排行榜辅助函数 ============

/**
 * 提交本局分数到本地排行榜（玩家各模式历史最佳）。
 * 由 updateFBSaveAfterRun 内部已处理，本函数供 scene 层显式调用（如活动模式）。
 * 返回是否刷新最佳记录。
 */
export function submitLocalRankEntry(
  mode: string,
  score: number,
  rankName: string,
  rankIcon: string,
  perfect: boolean,
  name = "我",
): boolean {
  const save = loadFBSave();
  const prev = save.localRankBest[mode];
  if (!prev || score > prev.score) {
    save.localRankBest[mode] = { name, score, rankName, rankIcon, gameMode: mode, date: dailyKey(), perfect };
    saveFBSave(save);
    return true;
  }
  return false;
}

/** 读取玩家指定模式的历史最佳分数条目（null=无记录） */
export function getLocalRankBest(mode: string): FBLocalRankEntrySave | null {
  const save = loadFBSave();
  return save.localRankBest[mode] ?? null;
}

/** 读取玩家所有模式的历史最佳分数条目 */
export function getAllLocalRankBest(): Record<string, FBLocalRankEntrySave> {
  const save = loadFBSave();
  return save.localRankBest;
}

// ============ v6 升级辅助函数：拆解/AI 对战进度 + 证书系统 ============

/**
 * 标记骗局拆解剧本通关（v6：用于"拆解专家"证书条件）。
 * 返回是否首次通关。
 * @param scenarioId 剧本 ID（DC-001 等）
 */
export function markDeconstructCleared(scenarioId: string): boolean {
  const save = loadFBSave();
  const isFirst = !save.deconstructClearedIds.includes(scenarioId);
  if (isFirst) {
    save.deconstructClearedIds.push(scenarioId);
    saveFBSave(save);
  }
  return isFirst;
}

/**
 * 标记 AI 对战剧本通关（v6：用于"AI 克星"证书条件）。
 * 返回是否首次通关。
 * @param scenarioId 剧本 ID（AI-001 等）
 */
export function markAIBattleCleared(scenarioId: string): boolean {
  const save = loadFBSave();
  const isFirst = !save.aiBattleClearedIds.includes(scenarioId);
  if (isFirst) {
    save.aiBattleClearedIds.push(scenarioId);
    saveFBSave(save);
  }
  return isFirst;
}

/**
 * 记录硬核模式完美通关（v6：用于"硬核完美"证书条件）。
 * 由 engine 在 hardcore 模式零失误通关后调用。
 */
export function incrementHardcorePerfect(): void {
  const save = loadFBSave();
  save.hardcorePerfectCount += 1;
  saveFBSave(save);
}

/** 读取已通关拆解剧本 ID 列表 */
export function getDeconstructClearedIds(): string[] {
  return loadFBSave().deconstructClearedIds;
}

/** 读取已通关 AI 对战剧本 ID 列表 */
export function getAIBattleClearedIds(): string[] {
  return loadFBSave().aiBattleClearedIds;
}

/** 读取硬核模式完美通关次数 */
export function getHardcorePerfectCount(): number {
  return loadFBSave().hardcorePerfectCount;
}

/**
 * 颁发反诈证书（v6 教育功能 C1）。
 * 若该证书已颁发则跳过，返回 false；首次颁发则记录并返回 true。
 * @param certId 证书 ID（与 certificate.ts 的 CERT_DEFS.id 对应）
 */
export function issueCertificate(certId: string): boolean {
  const save = loadFBSave();
  if (save.certificates.find((c) => c.id === certId)) return false;
  save.certificates.push({ id: certId, issuedAt: new Date().toISOString() });
  saveFBSave(save);
  return true;
}

/** 读取已颁发的证书记录列表 */
export function getCertificates(): FBCertificateRecord[] {
  return loadFBSave().certificates;
}

/** 检查指定证书是否已颁发 */
export function hasCertificate(certId: string): boolean {
  return loadFBSave().certificates.some((c) => c.id === certId);
}

// ============ v6 升级辅助函数：反诈侦探模式 ============

/**
 * 标记反诈侦探案件破案（v6：用于案件归档与重玩标记）。
 * 返回是否首次破案。
 * @param caseId 案件 ID（DET-001 等）
 * @param score 本局推理得分 0-100
 */
export function markDetectiveSolved(caseId: string, score: number): boolean {
  const save = loadFBSave();
  const isFirst = !save.detectiveSolvedCases.includes(caseId);
  if (isFirst) {
    save.detectiveSolvedCases.push(caseId);
    save.detectiveSolvedCount += 1;
  }
  save.detectiveTotalScore += score;
  saveFBSave(save);
  return isFirst;
}

/** 读取已破案的反诈侦探案件 ID 列表 */
export function getDetectiveSolvedCases(): string[] {
  return loadFBSave().detectiveSolvedCases;
}

/** 读取反诈侦探模式累计推理得分 */
export function getDetectiveTotalScore(): number {
  return loadFBSave().detectiveTotalScore;
}

/** 读取反诈侦探模式累计破案数 */
export function getDetectiveSolvedCount(): number {
  return loadFBSave().detectiveSolvedCount;
}

/** 检查指定案件是否已破案 */
export function isDetectiveSolved(caseId: string): boolean {
  return loadFBSave().detectiveSolvedCases.includes(caseId);
}
