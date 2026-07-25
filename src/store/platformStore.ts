/**
 * 平台状态管理（模块单例 + tt 存储）
 * 替代 Zustand + localStorage 的 usePlatformStore.ts
 * 进度 / 成就 / 每日挑战 / 设置 / 段位
 */
import { getStorageSync, setStorageSync } from "@/platform/web";
import type { GameId } from "@/types";
import { ACHIEVEMENTS, type Achievement, type AchievementContext } from "@/data/achievements";
import { CODEX } from "@/data/codex";
import type { ManagerMode } from "@/games/manager/types";

export type Rank =
  | "反诈小白"
  | "略有警觉"
  | "是男人"
  | "反诈达人"
  | "反诈教头"
  | "反诈之神";

export interface DailyRecord {
  score: number;
  wave: number;
}

/** 学习系统进度 */
export interface LearningProgress {
  /** 已完成课程的 typeId 列表 */
  completedLessons: string[];
  /** 累计答对的学习题数 */
  learningCorrectCount: number;
  /** 累计学习答题次数 */
  learningTotalCount: number;
}

/** v2：剧情模式进度 */
export interface StoryProgress {
  /** 当前章节索引（0-based） */
  currentChapter: number;
  /** 已完成的节点 ID 列表 */
  completedNodes: string[];
}

/** v2：资源系统 */
export interface Resources {
  coins: number;
  energy: number;
  fragments: number;
}

/** v2：每日签到 */
export interface DailyCheckIn {
  lastCheckIn: string;
  streak: number;
  totalClaimed: number;
}

/** v2：每日任务 */
export interface DailyQuestState {
  date: string;
  quests: { id: string; progress: number; target: number; claimed: boolean }[];
}

/**
 * v3：反诈职业经理人模块持久化进度
 * 涵盖：最高关卡 / 无尽波数 / 探员熟练度 / 4 模式最高分 / 每日挑战 / BOSS 击杀
 */
export interface ManagerProgression {
  /** 当前解锁的最高关卡（1..3，0 表示尚未通关任何关卡） */
  maxLevel: number;
  /** 无尽模式（endlessRush）最高坚持波数 */
  bestWave: number;
  /** 各探员击杀熟练度（key = agentId，value = 累计击杀数） */
  agentMastery: Record<string, number>;
  /** 各模式最高分（5 种模式） */
  modeHighScores: Record<ManagerMode, number>;
  /** 累计完成每日挑战次数 */
  dailyChallengesCompleted: number;
  /** 累计击杀 BOSS 次数（含 bossRush 模式 BOSS 与关卡 mini-boss） */
  totalBossKills: number;
}

/** v3 默认 manager 进度 */
const DEFAULT_MANAGER: ManagerProgression = {
  maxLevel: 0,
  bestWave: 0,
  agentMastery: {},
  modeHighScores: {
    classic: 0,
    timeTrial: 0,
    bossRush: 0,
    endlessRush: 0,
    daily: 0,
  },
  dailyChallengesCompleted: 0,
  totalBossKills: 0,
};

interface PlatformState {
  totalFoolsBusted: number;
  totalPlayTimeSec: number;
  unlockedCodex: string[];
  bestScores: Record<GameId, number>;
  totalGames: number;
  settings: { sound: boolean; haptics: boolean };
  unlockedAchievements: string[];
  gamesPlayed: GameId[];
  daily: Record<string, DailyRecord>;
  learning: LearningProgress;
  // v2 新增
  story: StoryProgress;
  resources: Resources;
  dailyCheckIn: DailyCheckIn;
  dailyQuests: DailyQuestState;
  // v3 新增：反诈职业经理人模块进度
  manager: ManagerProgression;
  /** 存档版本号（用于后续结构迁移） */
  version: number;
}

/** 图鉴总数（用于成就/进度计算，单一数据源） */
export const CODEX_TOTAL = CODEX.length;

const STORAGE_KEY = "anti-fraud-platform";
/** 当前存档版本：升级结构时递增，load 时据此迁移 */
const SCHEMA_VERSION = 2;

const defaultState: PlatformState = {
  totalFoolsBusted: 0,
  totalPlayTimeSec: 0,
  unlockedCodex: [],
  bestScores: {
    "fraud-buster": 0,
    manager: 0,
    thunder: 0,
    "bomb-island": 0,
  },
  totalGames: 0,
  settings: { sound: true, haptics: true },
  unlockedAchievements: [],
  gamesPlayed: [],
  daily: {},
  learning: {
    completedLessons: [],
    learningCorrectCount: 0,
    learningTotalCount: 0,
  },
  story: {
    currentChapter: 0,
    completedNodes: [],
  },
  resources: {
    coins: 0,
    energy: 3,
    fragments: 0,
  },
  dailyCheckIn: {
    lastCheckIn: "",
    streak: 0,
    totalClaimed: 0,
  },
  dailyQuests: {
    date: "",
    quests: [],
  },
  manager: JSON.parse(JSON.stringify(DEFAULT_MANAGER)),
  version: SCHEMA_VERSION,
};

/**
 * 安全取数：非有限数或缺失时返回默认值，并夹取到 [min, max]
 * 修复 `Number(x) ?? def` 无法兜底 NaN 的隐患
 */
function safeNum(v: unknown, def: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

/** 安全取正整数（用于计数/资源） */
function safeInt(v: unknown, def: number): number {
  return Math.max(0, Math.floor(safeNum(v, def, 0)));
}

/** 安全字符串数组：过滤非字符串项 */
function safeStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function rankFromBusted(n: number): Rank {
  if (n >= 500) return "反诈之神";
  if (n >= 200) return "反诈教头";
  if (n >= 100) return "反诈达人";
  if (n >= 50) return "是男人";
  if (n >= 10) return "略有警觉";
  return "反诈小白";
}

/** 段位进度：当前值、下一档门槛、进度比 */
export function rankProgress(n: number): {
  rank: Rank;
  next: Rank | null;
  ratio: number;
  current: number;
  threshold: number;
} {
  const tiers: [number, Rank][] = [
    [500, "反诈之神"],
    [200, "反诈教头"],
    [100, "反诈达人"],
    [50, "是男人"],
    [10, "略有警觉"],
    [0, "反诈小白"],
  ];
  for (let i = 0; i < tiers.length; i++) {
    const [threshold, rank] = tiers[i];
    if (n >= threshold) {
      const nextTier = i > 0 ? tiers[i - 1] : null;
      const nextThreshold = nextTier ? nextTier[0] : threshold;
      const ratio = nextTier ? (n - threshold) / (nextThreshold - threshold) : 1;
      return {
        rank,
        next: nextTier ? nextTier[1] : null,
        ratio: Math.min(1, ratio),
        current: n,
        threshold: nextThreshold,
      };
    }
  }
  return { rank: "反诈小白", next: "略有警觉", ratio: n / 10, current: n, threshold: 10 };
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

class PlatformStore {
  state: PlatformState = JSON.parse(JSON.stringify(defaultState));
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    const saved = getStorageSync(STORAGE_KEY) as Partial<PlatformState> | null;
    if (saved && typeof saved === "object") {
      const savedLearning = (saved as { learning?: Partial<LearningProgress> }).learning;
      const savedStory = (saved as { story?: Partial<StoryProgress> }).story;
      const savedResources = (saved as { resources?: Partial<Resources> }).resources;
      const savedCheckIn = (saved as { dailyCheckIn?: Partial<DailyCheckIn> }).dailyCheckIn;
      const savedQuests = (saved as { dailyQuests?: Partial<DailyQuestState> }).dailyQuests;
      const savedManager = (saved as { manager?: Partial<ManagerProgression> }).manager;
      // 校验 bestScores：只保留已知 GameId 的数值
      const validBestScores = { ...defaultState.bestScores };
      if (saved.bestScores && typeof saved.bestScores === "object") {
        for (const k of Object.keys(defaultState.bestScores)) {
          validBestScores[k as GameId] = safeInt(
            (saved.bestScores as Record<string, unknown>)[k],
            0
          );
        }
      }
      // 校验 daily 记录：过滤非法结构
      const validDaily: Record<string, DailyRecord> = {};
      if (saved.daily && typeof saved.daily === "object") {
        for (const [k, v] of Object.entries(saved.daily)) {
          if (v && typeof v === "object") {
            const rec = v as Partial<DailyRecord>;
            validDaily[k] = {
              score: safeInt(rec.score, 0),
              wave: safeInt(rec.wave, 0),
            };
          }
        }
      }
      // 校验 settings：布尔值兜底
      const savedSettings: Partial<{ sound: unknown; haptics: unknown }> =
        (saved.settings && typeof saved.settings === "object")
          ? saved.settings as { sound: unknown; haptics: unknown }
          : {};
      const settings = {
        sound: typeof savedSettings.sound === "boolean" ? savedSettings.sound : true,
        haptics: typeof savedSettings.haptics === "boolean" ? savedSettings.haptics : true,
      };
      // v3：校验 manager 进度（旧存档可能缺失，使用默认值兜底）
      const validManager: ManagerProgression = JSON.parse(JSON.stringify(DEFAULT_MANAGER));
      if (savedManager && typeof savedManager === "object") {
        validManager.maxLevel = safeInt(savedManager.maxLevel, 0);
        validManager.bestWave = safeInt(savedManager.bestWave, 0);
        validManager.dailyChallengesCompleted = safeInt(savedManager.dailyChallengesCompleted, 0);
        validManager.totalBossKills = safeInt(savedManager.totalBossKills, 0);
        // agentMastery：只保留 string→number 的合法映射
        if (savedManager.agentMastery && typeof savedManager.agentMastery === "object") {
          const mastery: Record<string, number> = {};
          for (const [k, v] of Object.entries(savedManager.agentMastery)) {
            if (typeof k === "string") mastery[k] = safeInt(v, 0);
          }
          validManager.agentMastery = mastery;
        }
        // modeHighScores：仅保留已知 ManagerMode 的数值
        if (savedManager.modeHighScores && typeof savedManager.modeHighScores === "object") {
          for (const k of Object.keys(DEFAULT_MANAGER.modeHighScores) as ManagerMode[]) {
            validManager.modeHighScores[k] = safeInt(
              (savedManager.modeHighScores as Record<string, unknown>)[k],
              0
            );
          }
        }
      }
      this.state = {
        ...defaultState,
        ...saved,
        // 顶层计数器校验（覆盖 spread 可能带入的 NaN/非法值）
        totalFoolsBusted: safeInt(saved.totalFoolsBusted, 0),
        totalPlayTimeSec: safeInt(saved.totalPlayTimeSec, 0),
        totalGames: safeInt(saved.totalGames, 0),
        bestScores: validBestScores,
        settings,
        unlockedCodex: safeStrArr(saved.unlockedCodex),
        unlockedAchievements: safeStrArr(saved.unlockedAchievements),
        // gamesPlayed 仅保留合法 GameId
        gamesPlayed: safeStrArr(saved.gamesPlayed).filter((g) =>
          Object.prototype.hasOwnProperty.call(defaultState.bestScores, g)
        ) as GameId[],
        daily: validDaily,
        learning: {
          completedLessons: safeStrArr(savedLearning?.completedLessons),
          learningCorrectCount: safeInt(savedLearning?.learningCorrectCount, 0),
          learningTotalCount: safeInt(savedLearning?.learningTotalCount, 0),
        },
        story: {
          currentChapter: safeInt(savedStory?.currentChapter, 0),
          completedNodes: safeStrArr(savedStory?.completedNodes),
        },
        resources: {
          coins: safeInt(savedResources?.coins, 0),
          // 修复：原 `Number(x) ?? 3` 在 x 为 undefined→NaN 时不会回退到 3
          energy: safeInt(savedResources?.energy, 3),
          fragments: safeInt(savedResources?.fragments, 0),
        },
        dailyCheckIn: {
          lastCheckIn: typeof savedCheckIn?.lastCheckIn === "string" ? savedCheckIn.lastCheckIn : "",
          streak: safeInt(savedCheckIn?.streak, 0),
          totalClaimed: safeInt(savedCheckIn?.totalClaimed, 0),
        },
        dailyQuests: {
          date: typeof savedQuests?.date === "string" ? savedQuests.date : "",
          quests: Array.isArray(savedQuests?.quests)
            ? savedQuests!.quests
                .filter(
                  (q) => q && typeof q === "object" && typeof q.id === "string"
                )
                .map((q) => ({
                  id: String(q.id),
                  progress: safeInt(q.progress, 0),
                  target: safeInt(q.target, 0),
                  claimed: typeof q.claimed === "boolean" ? q.claimed : false,
                }))
            : [],
        },
        manager: validManager,
        version: SCHEMA_VERSION,
      };
    }
    this.loaded = true;
  }

  private save(): void {
    // 写入前补全版本号，便于后续迁移
    this.state.version = SCHEMA_VERSION;
    setStorageSync(STORAGE_KEY, this.state);
  }

  /**
   * 记录一局游戏，返回本次新解锁的成就
   */
  recordGame(data: {
    gameId: GameId;
    score: number;
    busted?: number;
    unlockedTypes?: string[];
    durationSec: number;
    win?: boolean;
    wave?: number;
    maxCombo?: number;
    destroyRate?: number;
    daily?: boolean;
  }): Achievement[] {
    const { gameId, score, busted = 0, unlockedTypes = [], durationSec } = data;
    const best = Math.max(this.state.bestScores[gameId] || 0, score);
    const merged = Array.from(new Set([...this.state.unlockedCodex, ...unlockedTypes]));
    const played = this.state.gamesPlayed.includes(gameId)
      ? this.state.gamesPlayed
      : [...this.state.gamesPlayed, gameId];

    this.state = {
      ...this.state,
      totalFoolsBusted: this.state.totalFoolsBusted + busted,
      totalPlayTimeSec: this.state.totalPlayTimeSec + durationSec,
      unlockedCodex: merged,
      bestScores: { ...this.state.bestScores, [gameId]: best },
      totalGames: this.state.totalGames + 1,
      gamesPlayed: played,
    };

    // 每日挑战记录
    if (data.daily) {
      const key = todayKey();
      const prev = this.state.daily[key];
      if (!prev || score > prev.score) {
        this.state.daily = {
          ...this.state.daily,
          [key]: { score, wave: data.wave ?? 0 },
        };
      }
    }

    const unlocked = this.checkAchievements({
      gameId,
      win: data.win ?? false,
      score,
      wave: data.wave,
      maxCombo: data.maxCombo,
      destroyRate: data.destroyRate,
      daily: data.daily,
    });
    this.save();
    return unlocked;
  }

  private buildContext(lastGame: AchievementContext["lastGame"]): AchievementContext {
    // 按课程分级统计课程总数
    const basicLessonsTotal = CODEX.filter((c) => c.courseLevel === "basic").length;
    const intermediateLessonsTotal = CODEX.filter((c) => c.courseLevel === "intermediate").length;
    const advancedLessonsTotal = CODEX.filter((c) => c.courseLevel === "advanced").length;
    return {
      totalFoolsBusted: this.state.totalFoolsBusted,
      totalGames: this.state.totalGames,
      unlockedCodexCount: this.state.unlockedCodex.length,
      codexTotal: CODEX_TOTAL,
      gamesPlayed: this.state.gamesPlayed,
      dailyCompletedCount: Object.keys(this.state.daily).length,
      completedLessons: this.state.learning.completedLessons,
      learningCorrectCount: this.state.learning.learningCorrectCount,
      learningTotalCount: this.state.learning.learningTotalCount,
      basicLessonsTotal,
      intermediateLessonsTotal,
      advancedLessonsTotal,
      lastGame,
      // v3：manager 模块进度
      managerMaxLevel: this.state.manager.maxLevel,
      managerBestWave: this.state.manager.bestWave,
      managerAgentMastery: this.state.manager.agentMastery,
      managerDailyCompletedCount: this.state.manager.dailyChallengesCompleted,
      managerBossKills: this.state.manager.totalBossKills,
    };
  }

  /**
   * 记录一次学习答题，返回本次新解锁的成就
   * @param typeId 当前课程的反诈类型 ID
   * @param correct 本次答对题数
   * @param total 本次答题总题数
   * @param completed 是否完成本课程（达成完成条件时调用方传入 true）
   */
  recordLearning(data: {
    typeId: string;
    correct: number;
    total: number;
    completed?: boolean;
  }): Achievement[] {
    const { typeId, correct, total, completed = false } = data;
    const completedLessons = completed && !this.state.learning.completedLessons.includes(typeId)
      ? [...this.state.learning.completedLessons, typeId]
      : this.state.learning.completedLessons;
    this.state = {
      ...this.state,
      learning: {
        completedLessons,
        learningCorrectCount: this.state.learning.learningCorrectCount + correct,
        learningTotalCount: this.state.learning.learningTotalCount + total,
      },
    };
    const unlocked = this.checkAchievements(null);
    this.save();
    return unlocked;
  }

  /** 学习进度（用于学习中心展示） */
  learningProgress(): LearningProgress & {
    basicTotal: number;
    intermediateTotal: number;
    advancedTotal: number;
    completedBasic: number;
    completedIntermediate: number;
    completedAdvanced: number;
  } {
    const basic = CODEX.filter((c) => c.courseLevel === "basic");
    const intermediate = CODEX.filter((c) => c.courseLevel === "intermediate");
    const advanced = CODEX.filter((c) => c.courseLevel === "advanced");
    const set = new Set(this.state.learning.completedLessons);
    return {
      ...this.state.learning,
      basicTotal: basic.length,
      intermediateTotal: intermediate.length,
      advancedTotal: advanced.length,
      completedBasic: basic.filter((c) => set.has(c.typeId)).length,
      completedIntermediate: intermediate.filter((c) => set.has(c.typeId)).length,
      completedAdvanced: advanced.filter((c) => set.has(c.typeId)).length,
    };
  }

  /** 检查并解锁成就，返回新解锁列表 */
  checkAchievements(lastGame: AchievementContext["lastGame"] = null): Achievement[] {
    const ctx = this.buildContext(lastGame);
    const newly: Achievement[] = [];
    for (const a of ACHIEVEMENTS) {
      if (this.state.unlockedAchievements.includes(a.id)) continue;
      if (a.check(ctx)) {
        this.state.unlockedAchievements = [...this.state.unlockedAchievements, a.id];
        newly.push(a);
      }
    }
    if (newly.length > 0) this.save();
    return newly;
  }

  achievementProgress(): { unlocked: number; total: number } {
    return { unlocked: this.state.unlockedAchievements.length, total: ACHIEVEMENTS.length };
  }

  todayDaily(): DailyRecord | null {
    return this.state.daily[todayKey()] ?? null;
  }

  toggleSound(): void {
    this.state.settings = { ...this.state.settings, sound: !this.state.settings.sound };
    this.save();
  }

  toggleHaptics(): void {
    this.state.settings = { ...this.state.settings, haptics: !this.state.settings.haptics };
    this.save();
  }

  resetProgress(): void {
    this.state = { ...JSON.parse(JSON.stringify(defaultState)), settings: this.state.settings };
    this.save();
  }

  // ============ v2：剧情模式 ============

  /** 完成剧情节点 */
  completeStoryNode(nodeId: string): void {
    if (this.state.story.completedNodes.includes(nodeId)) return;
    this.state.story = {
      ...this.state.story,
      completedNodes: [...this.state.story.completedNodes, nodeId],
    };
    this.save();
  }

  /** 推进到下一章 */
  advanceStoryChapter(chapterIdx: number): void {
    this.state.story = {
      ...this.state.story,
      currentChapter: Math.max(this.state.story.currentChapter, chapterIdx),
    };
    this.save();
  }

  /** 剧情进度 */
  storyProgress(): StoryProgress {
    return { ...this.state.story };
  }

  // ============ v2：资源系统 ============

  /** 增加资源 */
  addResources(r: Partial<Resources>): void {
    this.state.resources = {
      coins: this.state.resources.coins + (r.coins ?? 0),
      energy: this.state.resources.energy + (r.energy ?? 0),
      fragments: this.state.resources.fragments + (r.fragments ?? 0),
    };
    this.save();
  }

  /** 消耗资源，返回是否成功 */
  spendResources(r: Partial<Resources>): boolean {
    if (r.coins && this.state.resources.coins < r.coins) return false;
    if (r.energy && this.state.resources.energy < r.energy) return false;
    if (r.fragments && this.state.resources.fragments < r.fragments) return false;
    this.state.resources = {
      coins: this.state.resources.coins - (r.coins ?? 0),
      energy: this.state.resources.energy - (r.energy ?? 0),
      fragments: this.state.resources.fragments - (r.fragments ?? 0),
    };
    this.save();
    return true;
  }

  // ============ v2：每日签到 ============

  /** 检查今日是否可签到 */
  canCheckInToday(): boolean {
    return this.state.dailyCheckIn.lastCheckIn !== todayKey();
  }

  /** 执行签到，返回奖励资源 */
  doDailyCheckIn(): { coins: number; energy: number; fragments: number; day: number } | null {
    if (!this.canCheckInToday()) return null;
    const today = todayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const isStreak = this.state.dailyCheckIn.lastCheckIn === yKey;
    const newStreak = isStreak ? this.state.dailyCheckIn.streak + 1 : 1;
    const dayInCycle = ((newStreak - 1) % 7) + 1; // 1..7 循环
    // 奖励梯度
    const rewards = [
      { coins: 50, energy: 1, fragments: 0 },   // day 1
      { coins: 80, energy: 1, fragments: 0 },   // day 2
      { coins: 100, energy: 1, fragments: 1 },  // day 3
      { coins: 120, energy: 2, fragments: 0 },  // day 4
      { coins: 150, energy: 2, fragments: 1 },  // day 5
      { coins: 200, energy: 2, fragments: 2 },  // day 6
      { coins: 300, energy: 3, fragments: 3 },  // day 7
    ];
    const reward = rewards[dayInCycle - 1];
    this.state.dailyCheckIn = {
      lastCheckIn: today,
      streak: newStreak,
      totalClaimed: this.state.dailyCheckIn.totalClaimed + 1,
    };
    this.addResources(reward);
    return { ...reward, day: dayInCycle };
  }

  /** 当前签到周期内的天数（1..7） */
  checkInDayInCycle(): number {
    return ((this.state.dailyCheckIn.streak - 1) % 7) + 1;
  }

  // ============ v2：每日任务 ============

  /** 初始化或重置当日任务（每日首次调用时） */
  ensureDailyQuests(questDefs: { id: string; target: number }[]): void {
    const today = todayKey();
    if (this.state.dailyQuests.date === today && this.state.dailyQuests.quests.length > 0) return;
    this.state.dailyQuests = {
      date: today,
      quests: questDefs.map((q) => ({ id: q.id, progress: 0, target: q.target, claimed: false })),
    };
    this.save();
  }

  /** 更新任务进度 */
  updateDailyQuest(questId: string, progress: number): void {
    const q = this.state.dailyQuests.quests.find((x) => x.id === questId);
    if (q && !q.claimed) {
      q.progress = Math.min(q.target, q.progress + progress);
      this.save();
    }
  }

  /** 领取任务奖励 */
  claimDailyQuest(questId: string, reward: { coins?: number; energy?: number; fragments?: number }): boolean {
    const q = this.state.dailyQuests.quests.find((x) => x.id === questId);
    if (!q || q.claimed || q.progress < q.target) return false;
    q.claimed = true;
    this.addResources(reward);
    return true;
  }

  // ============ v3：反诈职业经理人模块进度 ============

  /**
   * 记录一局经理人游戏，更新模块进度并返回新解锁的成就
   * 该方法会更新：4 模式最高分 / 最高关卡 / 无尽波数 / 探员熟练度 / BOSS 击杀 / 每日挑战计数
   * 注意：本方法不会自动调用 recordGame()；调用方应先调用本方法，再调用 recordGame()
   * 以确保 bestScores 与 totalFoolsBusted 等全局字段同步更新
   */
  recordManagerGame(data: {
    mode: ManagerMode;
    score: number;
    win: boolean;
    /** 当前关卡（classic 模式 1..3；其他模式 0） */
    level?: number;
    /** 当前波数（endlessRush 用绝对波数；bossRush 用 BOSS 索引 + 1） */
    wave?: number;
    /** 本局击杀数（按探员 id 分桶） */
    killsByAgent?: Record<string, number>;
    /** 本局击杀 BOSS 次数 */
    bossKills?: number;
    /** 是否完成每日挑战（仅 mode === "daily" 时记入） */
    dailyCompleted?: boolean;
  }): Achievement[] {
    const m = this.state.manager;
    // 1. 模式最高分
    const prevModeHigh = m.modeHighScores[data.mode] ?? 0;
    if (data.score > prevModeHigh) {
      m.modeHighScores = { ...m.modeHighScores, [data.mode]: data.score };
    }
    // 2. 最高关卡（classic 模式，win 且 level > 当前记录）
    if (data.mode === "classic" && data.win && data.level && data.level > m.maxLevel) {
      m.maxLevel = data.level;
    }
    // 3. 无尽模式波数
    if (data.mode === "endlessRush" && data.wave && data.wave > m.bestWave) {
      m.bestWave = data.wave;
    }
    // 4. 探员熟练度
    if (data.killsByAgent) {
      const newMastery = { ...m.agentMastery };
      for (const [agentId, kills] of Object.entries(data.killsByAgent)) {
        if (typeof agentId === "string") {
          newMastery[agentId] = (newMastery[agentId] ?? 0) + Math.max(0, kills);
        }
      }
      m.agentMastery = newMastery;
    }
    // 5. BOSS 击杀
    if (data.bossKills && data.bossKills > 0) {
      m.totalBossKills += data.bossKills;
    }
    // 6. 每日挑战计数
    if (data.mode === "daily" && data.dailyCompleted) {
      m.dailyChallengesCompleted += 1;
    }
    this.state.manager = { ...m };

    // 触发成就检查（使用 manager 专属 lastGame 上下文）
    const ctx = this.buildContext({
      gameId: "manager",
      win: data.win,
      score: data.score,
      wave: data.wave,
      daily: data.mode === "daily",
    });
    // 补充 managerLastGame 信息
    (ctx as AchievementContext).managerLastGame = {
      mode: data.mode,
      score: data.score,
      wave: data.wave,
      win: data.win,
      bossKills: data.bossKills,
    };
    const newly: Achievement[] = [];
    for (const a of ACHIEVEMENTS) {
      if (this.state.unlockedAchievements.includes(a.id)) continue;
      if (a.check(ctx)) {
        this.state.unlockedAchievements = [...this.state.unlockedAchievements, a.id];
        newly.push(a);
      }
    }
    this.save();
    return newly;
  }

  /** 经理人模块进度（只读视图，用于场景展示） */
  managerProgress(): ManagerProgression & {
    /** 探员熟练度排序后的列表（高 → 低） */
    masteryRanking: { agentId: string; kills: number }[];
    /** 累计所有探员击杀总数 */
    totalAgentKills: number;
  } {
    const m = this.state.manager;
    const masteryRanking = Object.entries(m.agentMastery)
      .map(([agentId, kills]) => ({ agentId, kills }))
      .sort((a, b) => b.kills - a.kills);
    const totalAgentKills = masteryRanking.reduce((s, r) => s + r.kills, 0);
    return { ...m, masteryRanking, totalAgentKills };
  }

  rank(): Rank {
    return rankFromBusted(this.state.totalFoolsBusted);
  }
}

export const platformStore = new PlatformStore();
