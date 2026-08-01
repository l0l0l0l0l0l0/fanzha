/**
 * 诈园区（bomb-island）v6 跨局存档
 * - 图鉴解锁（沿用 v5 CODEX_STORAGE_KEY，向后兼容）
 * - 模块拆除累计（沿用 v5 MODULE_KILL_CUMULATIVE_KEY，向后兼容）
 * - 武器升级树选择（v6 新增）
 * - 道具升星进度（v6 新增）
 * - 剧情关卡进度（v6 新增）
 * - 每日挑战记录（v6 新增）
 * - 各模式最高分（v6 新增）
 * - 累计救援受害者数（v6 新增，用于受害者档案匹配）
 * - 最高评级（v6 新增）
 */
import type { BombGameMode, BombDifficulty, BombTierRating, WeaponKind, ItemId, PermanentUpgradeState, PermanentUpgradeId } from "./types";

// ============ 沿用 v5 兼容键 ============

const CODEX_STORAGE_KEY = "bomb-codex-unlocks-v1";
const MODULE_KILL_CUMULATIVE_KEY = "bomb-module-kill-cumulative-v1";

// ============ v6 新增存档键 ============

const V6_SAVE_KEY = "bomb-v6-save-1";

/** v6 跨局存档数据结构 */
export interface BombV6Save {
  /** 武器升级分支选择（key=WeaponKind, value=分支ID） */
  weaponBranches: Partial<Record<WeaponKind, string>>;
  /** 道具星级（key=ItemId, value=1-5） */
  itemStars: Partial<Record<ItemId, number>>;
  /** 道具升星碎片（key=ItemId, value=碎片数） */
  itemFragments: Partial<Record<ItemId, number>>;
  /** 累计击破模块数（用于武器升级树解锁判定） */
  totalModulesDestroyed: number;
  /** 剧情模式已通关关卡索引列表 */
  storyClearedStages: number[];
  /** 剧情模式最高解锁关卡索引 */
  storyMaxUnlockedIdx: number;
  /** 每日挑战历史记录（key=日期 YYYY-MM-DD, value=本日最高分） */
  dailyRecords: Record<string, number>;
  /** 各模式最高分（key=模式ID, value=最高分） */
  modeHighScores: Partial<Record<BombGameMode, number>>;
  /** 各难度最高分（key=难度ID, value=最高分） */
  difficultyHighScores: Partial<Record<BombDifficulty, number>>;
  /** 累计救援受害者数（用于受害者档案解锁） */
  totalVictimsRescued: number;
  /** 历史最高评级（F→SSS） */
  bestRating: BombTierRating;
  /** 历史最高综合得分 */
  bestScore: number;
  /** 累计游戏局数 */
  totalRuns: number;
  /** 累计击破波次数 */
  totalClearedWaves: number;
  /** 累计击破 Boss 数 */
  totalBossesDefeated: number;
  /** v10 跨局永久升级状态（key=PermanentUpgradeId, value=等级） */
  permanentUpgrades: PermanentUpgradeState;
  /** v10 跨局线索碎片银行（用于永久升级消耗） */
  clueFragmentBank: number;
}

/** 默认存档 */
function defaultSave(): BombV6Save {
  return {
    weaponBranches: {},
    itemStars: {},
    itemFragments: {},
    totalModulesDestroyed: 0,
    storyClearedStages: [],
    storyMaxUnlockedIdx: 0,
    dailyRecords: {},
    modeHighScores: {},
    difficultyHighScores: {},
    totalVictimsRescued: 0,
    bestRating: "F",
    bestScore: 0,
    totalRuns: 0,
    totalClearedWaves: 0,
    totalBossesDefeated: 0,
    permanentUpgrades: {},
    clueFragmentBank: 0,
  };
}

// ============ 存档读写 ============

/** 内存缓存（避免每次 JSON.parse） */
let _cache: BombV6Save | null = null;

/** 读取 v6 存档 */
export function loadV6Save(): BombV6Save {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(V6_SAVE_KEY);
    if (!raw) {
      _cache = defaultSave();
      return _cache;
    }
    const parsed = JSON.parse(raw) as Partial<BombV6Save>;
    _cache = { ...defaultSave(), ...parsed };
    return _cache;
  } catch {
    _cache = defaultSave();
    return _cache;
  }
}

/** 写入 v6 存档（自动合并内存缓存） */
export function saveV6Save(save: BombV6Save): void {
  _cache = save;
  try {
    localStorage.setItem(V6_SAVE_KEY, JSON.stringify(save));
  } catch { /* ignore quota errors */ }
}

/** 更新部分字段并写入 */
export function updateV6Save(patch: Partial<BombV6Save>): BombV6Save {
  const cur = loadV6Save();
  const next = { ...cur, ...patch };
  saveV6Save(next);
  return next;
}

// ============ 图鉴解锁（v5 兼容） ============

export function loadCodexUnlocks(): Set<string> {
  try {
    const raw = localStorage.getItem(CODEX_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

export function saveCodexUnlocks(set: Set<string>): void {
  try { localStorage.setItem(CODEX_STORAGE_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

// ============ 模块拆除累计（v5 兼容） ============

export function loadModuleKillCumulative(): Record<string, number> {
  try {
    const raw = localStorage.getItem(MODULE_KILL_CUMULATIVE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch { return {}; }
}

export function saveModuleKillCumulative(map: Record<string, number>): void {
  try { localStorage.setItem(MODULE_KILL_CUMULATIVE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

// ============ 便捷访问函数 ============

/** 取指定武器的已选分支ID */
export function getWeaponBranch(weapon: WeaponKind): string | undefined {
  return loadV6Save().weaponBranches[weapon];
}

/** 设置指定武器的分支选择 */
export function setWeaponBranch(weapon: WeaponKind, branchId: string): void {
  const save = loadV6Save();
  save.weaponBranches[weapon] = branchId;
  saveV6Save(save);
}

/** 取指定道具的当前星级（默认 1★） */
export function getItemStar(id: ItemId): number {
  return loadV6Save().itemStars[id] ?? 1;
}

/** 取指定道具的当前碎片数 */
export function getItemFragments(id: ItemId): number {
  return loadV6Save().itemFragments[id] ?? 0;
}

/** 增加道具碎片（拆除模块时调用），返回是否升星 */
export function addItemFragments(id: ItemId, amount: number, fragmentsNeededForNextStar: number): { starUp: boolean; newStar: number } {
  const save = loadV6Save();
  const cur = save.itemFragments[id] ?? 0;
  const next = cur + amount;
  save.itemFragments[id] = next;
  const curStar = save.itemStars[id] ?? 1;
  let starUp = false;
  let newStar = curStar;
  if (curStar < 5 && next >= fragmentsNeededForNextStar) {
    save.itemStars[id] = curStar + 1;
    save.itemFragments[id] = next - fragmentsNeededForNextStar;
    starUp = true;
    newStar = curStar + 1;
  }
  saveV6Save(save);
  return { starUp, newStar };
}

/** 累计模块拆除数 +1（用于武器升级树解锁） */
export function incrementModulesDestroyed(): number {
  const save = loadV6Save();
  save.totalModulesDestroyed = (save.totalModulesDestroyed ?? 0) + 1;
  saveV6Save(save);
  return save.totalModulesDestroyed;
}

/** 累计救援数 +N */
export function addVictimsRescued(n: number): number {
  const save = loadV6Save();
  save.totalVictimsRescued = (save.totalVictimsRescued ?? 0) + n;
  saveV6Save(save);
  return save.totalVictimsRescued;
}

/** 标记剧情关卡已通关，解锁下一关 */
export function clearStoryStage(idx: number): void {
  const save = loadV6Save();
  if (!save.storyClearedStages.includes(idx)) {
    save.storyClearedStages.push(idx);
  }
  save.storyMaxUnlockedIdx = Math.max(save.storyMaxUnlockedIdx, idx + 1);
  saveV6Save(save);
}

/** 取剧情模式最高解锁关卡索引 */
export function getStoryMaxUnlocked(): number {
  return loadV6Save().storyMaxUnlockedIdx ?? 0;
}

/** 提交每日挑战分数（保留本日最高） */
export function submitDailyScore(dateKey: string, score: number): { isNewRecord: boolean; prevBest: number } {
  const save = loadV6Save();
  const prev = save.dailyRecords[dateKey] ?? 0;
  const isNewRecord = score > prev;
  if (isNewRecord) {
    save.dailyRecords[dateKey] = score;
    saveV6Save(save);
  }
  return { isNewRecord, prevBest: prev };
}

/** 提交模式最高分 */
export function submitModeScore(mode: BombGameMode, score: number): { isNewRecord: boolean; prevBest: number } {
  const save = loadV6Save();
  const prev = save.modeHighScores[mode] ?? 0;
  const isNewRecord = score > prev;
  if (isNewRecord) {
    save.modeHighScores[mode] = score;
    saveV6Save(save);
  }
  return { isNewRecord, prevBest: prev };
}

/** 提交难度最高分 */
export function submitDifficultyScore(difficulty: BombDifficulty, score: number): { isNewRecord: boolean; prevBest: number } {
  const save = loadV6Save();
  const prev = save.difficultyHighScores[difficulty] ?? 0;
  const isNewRecord = score > prev;
  if (isNewRecord) {
    save.difficultyHighScores[difficulty] = score;
    saveV6Save(save);
  }
  return { isNewRecord, prevBest: prev };
}

/** 提交评级（更新历史最高） */
export function submitRating(rating: BombTierRating, score: number): { isNewRecord: boolean } {
  const save = loadV6Save();
  const isNewRecord = score > (save.bestScore ?? 0);
  if (isNewRecord) {
    save.bestScore = score;
    save.bestRating = rating;
    saveV6Save(save);
  }
  return { isNewRecord };
}

/** 局结束统计：累计 +1 局、+N 波次、+N Boss */
export function recordRunComplete(clearedWaves: number, bossesDefeated: number): void {
  const save = loadV6Save();
  save.totalRuns = (save.totalRuns ?? 0) + 1;
  save.totalClearedWaves = (save.totalClearedWaves ?? 0) + clearedWaves;
  save.totalBossesDefeated = (save.totalBossesDefeated ?? 0) + bossesDefeated;
  saveV6Save(save);
}

/** 取模式最高分（无则 0） */
export function getModeHighScore(mode: BombGameMode): number {
  return loadV6Save().modeHighScores[mode] ?? 0;
}

/** 取难度最高分（无则 0） */
export function getDifficultyHighScore(difficulty: BombDifficulty): number {
  return loadV6Save().difficultyHighScores[difficulty] ?? 0;
}

// ============ v10 跨局永久成长树 ============

/** 取永久升级状态 */
export function getPermanentUpgrades(): PermanentUpgradeState {
  return loadV6Save().permanentUpgrades ?? {};
}

/** 取线索碎片银行余额 */
export function getClueFragmentBank(): number {
  return loadV6Save().clueFragmentBank ?? 0;
}

/** 存入线索碎片到跨局银行（局结束时调用） */
export function depositClueFragments(n: number): number {
  const save = loadV6Save();
  save.clueFragmentBank = Math.max(0, (save.clueFragmentBank ?? 0) + n);
  saveV6Save(save);
  return save.clueFragmentBank;
}

/** 永久升级：消耗碎片提升节点等级 */
export function upgradePermanentNode(id: PermanentUpgradeId, cost: number): { success: boolean; newLevel: number; bank: number } {
  const save = loadV6Save();
  if ((save.clueFragmentBank ?? 0) < cost) {
    return { success: false, newLevel: save.permanentUpgrades[id] ?? 0, bank: save.clueFragmentBank ?? 0 };
  }
  save.clueFragmentBank -= cost;
  save.permanentUpgrades[id] = (save.permanentUpgrades[id] ?? 0) + 1;
  saveV6Save(save);
  return { success: true, newLevel: save.permanentUpgrades[id], bank: save.clueFragmentBank };
}

// ============================================================
// ============ v9 全面升级存档（新键 + 迁移） ============
// ============================================================

import type {
  BombDailyTaskProgress, CannonSlotId, ParkLayerKind, RTSUpgradeState,
} from "./types";

const V9_SAVE_KEY = "bomb-v9-save-1";

/** v9 跨局存档：Boss 图鉴 / 每日任务 / 季节活动 / 多炮位解锁 / RTS 历史 */
export interface BombV9Save {
  /** 已击败 Boss 图鉴 ID 集合（E3） */
  bossCodexDefeated: string[];
  /** 每日任务归属日期 key（YYYY-MM-DD） */
  dailyTaskDateKey: string;
  /** 每日任务进度列表（G1） */
  dailyTaskProgress: BombDailyTaskProgress[];
  /** 已通关季节活动 ID 列表（E4） */
  seasonalEventsCleared: string[];
  /** 已解锁炮位 ID 列表（S1，初始含 left/center） */
  unlockedCannons: CannonSlotId[];
  /** 历史 RTS 升级选择（最近一局，仅供"常用 build"展示，不参与战斗） */
  lastRTSBuild: RTSUpgradeState;
  /** 累计线索碎片总数（跨局统计，用于成就） */
  totalClueFragments: number;
  /** 累计知识弹幕触发数（T1 跨局统计） */
  totalKnowledgeTips: number;
  /** 累计案例时间线条目数（T2 跨局统计） */
  totalCaseTimelineEntries: number;
}

/** v9 默认存档 */
function defaultV9Save(): BombV9Save {
  return {
    bossCodexDefeated: [],
    dailyTaskDateKey: "",
    dailyTaskProgress: [],
    seasonalEventsCleared: [],
    unlockedCannons: ["left", "center"],
    lastRTSBuild: {},
    totalClueFragments: 0,
    totalKnowledgeTips: 0,
    totalCaseTimelineEntries: 0,
  };
}

/** v9 内存缓存 */
let _v9Cache: BombV9Save | null = null;

/** 从 v6 存档迁移到 v9（保留有意义的字段；v6 无对应字段的用默认值） */
function migrateFromV6(v6: BombV6Save): BombV9Save {
  const v9 = defaultV9Save();
  // v6 的 storyClearedStages / bestRating 等保留在 v6 键中不动；
  // v9 仅做增量字段，避免双写。这里只做一次性兜底迁移。
  v9.totalClueFragments = 0;
  // 已击败 Boss 数映射（粗略：按 totalBossesDefeated 数量补前 N 个）
  const bossList = ["den-0", "den-1", "kokang-0", "kokang-1", "hq-0", "hq-1", "dubai-0", "dubai-1", "wafrica-0", "wafrica-1", "abyss-0", "abyss-1"];
  const defeated = Math.min(v6.totalBossesDefeated ?? 0, bossList.length);
  v9.bossCodexDefeated = bossList.slice(0, defeated);
  return v9;
}

/** 读取 v9 存档（含 v6 迁移兜底） */
export function loadV9Save(): BombV9Save {
  if (_v9Cache) return _v9Cache;
  try {
    const raw = localStorage.getItem(V9_SAVE_KEY);
    if (!raw) {
      const v6 = loadV6Save();
      _v9Cache = migrateFromV6(v6);
      // 首次自动写入
      try { localStorage.setItem(V9_SAVE_KEY, JSON.stringify(_v9Cache)); } catch { /* ignore */ }
      return _v9Cache;
    }
    const parsed = JSON.parse(raw) as Partial<BombV9Save>;
    _v9Cache = { ...defaultV9Save(), ...parsed };
    return _v9Cache;
  } catch {
    _v9Cache = defaultV9Save();
    return _v9Cache;
  }
}

/** 写入 v9 存档 */
export function saveV9Save(save: BombV9Save): void {
  _v9Cache = save;
  try { localStorage.setItem(V9_SAVE_KEY, JSON.stringify(save)); } catch { /* ignore quota */ }
}

/** 更新部分字段并写入 */
export function updateV9Save(patch: Partial<BombV9Save>): BombV9Save {
  const cur = loadV9Save();
  const next = { ...cur, ...patch };
  saveV9Save(next);
  return next;
}

// ============ E3 Boss 图鉴 ============

/** 标记 Boss 已击败（入图鉴） */
export function markBossDefeated(bossId: string): { isNew: boolean } {
  const save = loadV9Save();
  if (save.bossCodexDefeated.includes(bossId)) return { isNew: false };
  save.bossCodexDefeated.push(bossId);
  saveV9Save(save);
  return { isNew: true };
}

/** 取已击败 Boss ID 集合 */
export function getDefeatedBosses(): Set<string> {
  return new Set(loadV9Save().bossCodexDefeated);
}

// ============ G1 每日任务进度 ============

/** 取今日任务进度（日期变更时重置） */
export function getDailyTaskProgress(todayKey: string): BombDailyTaskProgress[] {
  const save = loadV9Save();
  if (save.dailyTaskDateKey !== todayKey) {
    // 日期变更：重置进度
    save.dailyTaskDateKey = todayKey;
    save.dailyTaskProgress = [];
    saveV9Save(save);
    return [];
  }
  return save.dailyTaskProgress;
}

/** 更新任务进度（+n，封顶 target） */
export function updateDailyTaskProgress(taskId: string, target: number, increment: number): BombDailyTaskProgress {
  const save = loadV9Save();
  let p = save.dailyTaskProgress.find(t => t.taskId === taskId);
  if (!p) {
    p = { taskId, progress: 0, claimed: false };
    save.dailyTaskProgress.push(p);
  }
  p.progress = Math.min(target, p.progress + increment);
  saveV9Save(save);
  return p;
}

/** 领取任务奖励（标记 claimed） */
export function claimDailyTask(taskId: string): boolean {
  const save = loadV9Save();
  const p = save.dailyTaskProgress.find(t => t.taskId === taskId);
  if (!p || p.claimed) return false;
  p.claimed = true;
  saveV9Save(save);
  return true;
}

// ============ E4 季节活动 ============

/** 标记季节活动已通关 */
export function markSeasonalEventCleared(eventId: string): { isNew: boolean } {
  const save = loadV9Save();
  if (save.seasonalEventsCleared.includes(eventId)) return { isNew: false };
  save.seasonalEventsCleared.push(eventId);
  saveV9Save(save);
  return { isNew: true };
}

/** 取已通关季节活动 ID 集合 */
export function getClearedSeasonalEvents(): Set<string> {
  return new Set(loadV9Save().seasonalEventsCleared);
}

// ============ S1 多炮位解锁 ============

/** 解锁炮位 */
export function unlockCannon(slotId: CannonSlotId): { isNew: boolean } {
  const save = loadV9Save();
  if (save.unlockedCannons.includes(slotId)) return { isNew: false };
  save.unlockedCannons.push(slotId);
  saveV9Save(save);
  return { isNew: true };
}

/** 取已解锁炮位 ID 列表 */
export function getUnlockedCannons(): CannonSlotId[] {
  return loadV9Save().unlockedCannons;
}

// ============ v9 跨局统计 ============

/** 累计线索碎片 +n */
export function addClueFragments(n: number): number {
  const save = loadV9Save();
  save.totalClueFragments = (save.totalClueFragments ?? 0) + n;
  saveV9Save(save);
  return save.totalClueFragments;
}

/** 累计知识弹幕 +1 */
export function incrementKnowledgeTips(): number {
  const save = loadV9Save();
  save.totalKnowledgeTips = (save.totalKnowledgeTips ?? 0) + 1;
  saveV9Save(save);
  return save.totalKnowledgeTips;
}

/** 记录最近 RTS build（仅供展示） */
export function recordRTSBuild(state: RTSUpgradeState): void {
  const save = loadV9Save();
  save.lastRTSBuild = state;
  saveV9Save(save);
}

/** 累计案例时间线条目 +n */
export function addCaseTimelineEntries(n: number): number {
  const save = loadV9Save();
  save.totalCaseTimelineEntries = (save.totalCaseTimelineEntries ?? 0) + n;
  saveV9Save(save);
  return save.totalCaseTimelineEntries;
}
