/**
 * 平台状态管理（模块单例 + tt 存储）
 * 替代 Zustand + localStorage 的 usePlatformStore.ts
 * 进度 / 成就 / 每日挑战 / 设置 / 段位
 */
import { getStorageSync, setStorageSync } from "@/platform/web";
import type { GameId } from "@/types";
import { ACHIEVEMENTS, type Achievement, type AchievementContext } from "@/data/achievements";
import { CODEX } from "@/data/codex";
import { AGENTS } from "@/games/manager/data";
import type { ManagerMode, ManagerMetaProgression, TalentBranch, CodexCategory, WrongQuestionRecord, BattleReplayRecord } from "@/games/manager/types";
import type { ThunderMode, Difficulty } from "@/games/thunder/types";

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
    tower: 0,
    challenge: 0,
    senior: 0,
  },
  dailyChallengesCompleted: 0,
  totalBossKills: 0,
};

/**
 * v6 默认 manager 元进度（跨局保留）
 * 默认解锁前 6 名探员（shen/lin/zhou/wang/su/chen），后 4 名需反诈积分解锁
 * v7 新增：错题记录 / 口诀收集 / 案例解锁 / 排行榜 / 引导 / 可访问性 / 剧情 / 事件选择
 */
const DEFAULT_MANAGER_META: ManagerMetaProgression = {
  coins: 0,
  intel: 0,
  caseFiles: 0,
  antiFraudPoints: 0,
  talentPoints: 0,
  unlockedAgents: AGENTS.filter((a) => !a.unlockCost).map((a) => a.id),
  ownedSkins: AGENTS.filter((a) => !a.unlockCost).map((a) => `${a.id}_default`).filter((id) => id !== "fayi_default" && id !== "yuce_default" && id !== "kuajing_default" && id !== "jianwei_default"),
  agentSkins: {},
  agentTalents: {},
  ownedRelics: [],
  equippedRelics: [],
  ownedEquipment: [],
  agentEquipment: {},
  enemyCodex: [],
  agentCodex: AGENTS.filter((a) => !a.unlockCost).map((a) => `codex_agent_${a.id}`),
  caseCodex: [],
  quizCorrectCount: 0,
  quizTotalCount: 0,
  towerFloor: 1,
  towerMaxFloor: 1,
  seasonNumber: 1,
  seasonScore: 0,
  weeklyCompleted: [],
  seasonStartDate: "",
  totalKills: 0,
  totalUltUsed: 0,
  totalBossKills: 0,
  // ===== v7 新增默认值 =====
  quizWrongRecords: {},
  collectedTerms: [],
  unlockedCases: [],
  leaderboard: {
    daily: { date: "", score: 0, rank: 0 },
    weekly: { weekKey: "", score: 0, rank: 0 },
    season: { score: 0, rank: 0 },
  },
  tutorialCompleted: {
    deploy: false,
    battle: false,
    progression: false,
    codex: false,
    season: false,
  },
  accessibility: {
    colorBlindMode: false,
    fontSize: "medium",
  },
  completedStoryChapters: [],
  towerEventChoices: {},
  // ===== v8 全面升级新增默认值 =====
  completedAgentStoryQuests: [],
  selectedRegionId: null,
  completedStoryStages: [],
  caseBreakdownCorrectCount: 0,
  caseBreakdownTotalCount: 0,
  speechBubblesBroken: 0,
  victimsRescuedTotal: 0,
  victimsLostTotal: 0,
  tacticalCommandsUsed: 0,
  cardSkillsUsed: 0,
  // ===== v9 全面升级新增默认值 =====
  relicShards: {},
  unlockedRecipes: [],
  // ===== v9 Phase 4.3 全面升级新增默认值 =====
  wrongQuestions: {},
  quizClearedLevels: [],
  quizHighScores: {},
  // ===== v10 全面升级新增默认值 =====
  learnedFraudTipsThisRun: [],
  learnedFraudTipsTotal: 0,
  // ===== v11 全面升级新增默认值 =====
  weaknessIntel: [],
  completedVictimSimScenarios: [],
  victimSimBestRanks: {},
  battleReplays: [],
  customDifficulty: {
    enemyHpMul: 1.0,
    enemySpeedMul: 1.0,
    enemyDmgMul: 1.0,
    spawnIntervalMul: 1.0,
    startEnergy: 100,
    baseHpMul: 1.0,
  },
  customDifficultyPreset: "normal",
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
  // v6 新增：反诈职业经理人模块跨局元进度（资源/天赋/遗物/装备/图鉴/赛季/爬塔）
  managerMeta: ManagerMetaProgression;
  /** 存档版本号（用于后续结构迁移） */
  version: number;
}

/** 图鉴总数（用于成就/进度计算，单一数据源） */
export const CODEX_TOTAL = CODEX.length;

const STORAGE_KEY = "anti-fraud-platform";
/**
 * 当前存档版本：升级结构时递增，load 时据此迁移
 * - v3：v6 manager 元进度（资源/天赋/遗物/装备/图鉴/赛季/爬塔）
 * - v4：v7 全面升级（错题记录/口诀收集/案例解锁/排行榜/引导/可访问性/剧情/事件选择）
 * - v5：v10 全面升级（managerMeta 字段完整性兜底 + 新增 F87/F88 案例解锁兼容 + 反诈知识点统计字段）
 * - v6：v11 全面升级（弱点情报/受害人模拟/战斗回放/自定义难度）
 */
const SCHEMA_VERSION = 6;

const defaultState: PlatformState = {
  totalFoolsBusted: 0,
  totalPlayTimeSec: 0,
  unlockedCodex: [],
  bestScores: {
    "fraud-buster": 0,
    manager: 0,
    thunder: 0,
    "bomb-island": 0,
    "chat-detective": 0,
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
  managerMeta: JSON.parse(JSON.stringify(DEFAULT_MANAGER_META)),
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
      const savedMeta = (saved as { managerMeta?: Partial<ManagerMetaProgression> }).managerMeta;
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
      // v6：校验 managerMeta（旧存档缺失时使用默认值兜底，实现 v2→v3 平滑迁移）
      const validMeta: ManagerMetaProgression = JSON.parse(JSON.stringify(DEFAULT_MANAGER_META));
      if (savedMeta && typeof savedMeta === "object") {
        // 资源类
        validMeta.coins = safeInt(savedMeta.coins, 0);
        validMeta.intel = safeInt(savedMeta.intel, 0);
        validMeta.caseFiles = safeInt(savedMeta.caseFiles, 0);
        validMeta.antiFraudPoints = safeInt(savedMeta.antiFraudPoints, 0);
        validMeta.talentPoints = safeInt(savedMeta.talentPoints, 0);
        // 列表类
        validMeta.unlockedAgents = safeStrArr(savedMeta.unlockedAgents);
        // 确保默认 6 探员始终解锁
        for (const id of DEFAULT_MANAGER_META.unlockedAgents) {
          if (!validMeta.unlockedAgents.includes(id)) validMeta.unlockedAgents.push(id);
        }
        validMeta.ownedSkins = safeStrArr(savedMeta.ownedSkins);
        validMeta.ownedRelics = safeStrArr(savedMeta.ownedRelics);
        validMeta.equippedRelics = safeStrArr(savedMeta.equippedRelics).slice(0, 3); // 最多 3 件
        validMeta.ownedEquipment = safeStrArr(savedMeta.ownedEquipment);
        validMeta.enemyCodex = safeStrArr(savedMeta.enemyCodex);
        validMeta.agentCodex = safeStrArr(savedMeta.agentCodex);
        validMeta.caseCodex = safeStrArr(savedMeta.caseCodex);
        validMeta.weeklyCompleted = safeStrArr(savedMeta.weeklyCompleted);
        // 答题/爬塔/赛季/统计
        validMeta.quizCorrectCount = safeInt(savedMeta.quizCorrectCount, 0);
        validMeta.quizTotalCount = safeInt(savedMeta.quizTotalCount, 0);
        validMeta.towerFloor = Math.max(1, safeInt(savedMeta.towerFloor, 1));
        validMeta.towerMaxFloor = Math.max(1, safeInt(savedMeta.towerMaxFloor, 1));
        validMeta.seasonNumber = safeInt(savedMeta.seasonNumber, 1);
        validMeta.seasonScore = safeInt(savedMeta.seasonScore, 0);
        validMeta.seasonStartDate = typeof savedMeta.seasonStartDate === "string" ? savedMeta.seasonStartDate : "";
        validMeta.totalKills = safeInt(savedMeta.totalKills, 0);
        validMeta.totalUltUsed = safeInt(savedMeta.totalUltUsed, 0);
        validMeta.totalBossKills = safeInt(savedMeta.totalBossKills, 0);
        // 映射类（agentTalents / agentSkins / agentEquipment）：保留合法键值
        if (savedMeta.agentTalents && typeof savedMeta.agentTalents === "object") {
          const talents: ManagerMetaProgression["agentTalents"] = {};
          for (const [agentId, branchMap] of Object.entries(savedMeta.agentTalents)) {
            if (typeof agentId === "string" && branchMap && typeof branchMap === "object") {
              const bm: Partial<Record<TalentBranch, number>> = {};
              for (const [b, v] of Object.entries(branchMap as Record<string, unknown>)) {
                if (b === "offense" || b === "defense" || b === "support") {
                  bm[b as TalentBranch] = safeInt(v, 0);
                }
              }
              if (Object.keys(bm).length > 0) talents[agentId] = bm;
            }
          }
          validMeta.agentTalents = talents;
        }
        if (savedMeta.agentSkins && typeof savedMeta.agentSkins === "object") {
          const skins: Record<string, string> = {};
          for (const [k, v] of Object.entries(savedMeta.agentSkins)) {
            if (typeof k === "string" && typeof v === "string") skins[k] = v;
          }
          validMeta.agentSkins = skins;
        }
        if (savedMeta.agentEquipment && typeof savedMeta.agentEquipment === "object") {
          const eq: Record<string, string> = {};
          for (const [k, v] of Object.entries(savedMeta.agentEquipment)) {
            if (typeof k === "string" && typeof v === "string") eq[k] = v;
          }
          validMeta.agentEquipment = eq;
        }
        // ===== v7 全面升级新增字段迁移 =====
        // 错题记录：quizId → 连续错误次数
        if (savedMeta.quizWrongRecords && typeof savedMeta.quizWrongRecords === "object") {
          const wrongRec: Record<string, number> = {};
          for (const [k, v] of Object.entries(savedMeta.quizWrongRecords)) {
            if (typeof k === "string") wrongRec[k] = safeInt(v, 0);
          }
          validMeta.quizWrongRecords = wrongRec;
        }
        // 口诀收集索引列表（number[]，0..35）
        if (Array.isArray(savedMeta.collectedTerms)) {
          validMeta.collectedTerms = savedMeta.collectedTerms
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n >= 0 && n < 36);
        }
        // 案例解锁列表
        validMeta.unlockedCases = safeStrArr(savedMeta.unlockedCases);
        // 排行榜记录
        if (savedMeta.leaderboard && typeof savedMeta.leaderboard === "object") {
          const lb = savedMeta.leaderboard as {
            daily?: { date?: unknown; score?: unknown; rank?: unknown };
            weekly?: { weekKey?: unknown; score?: unknown; rank?: unknown };
            season?: { score?: unknown; rank?: unknown };
          };
          validMeta.leaderboard = {
            daily: {
              date: typeof lb.daily?.date === "string" ? lb.daily.date : "",
              score: safeInt(lb.daily?.score, 0),
              rank: safeInt(lb.daily?.rank, 0),
            },
            weekly: {
              weekKey: typeof lb.weekly?.weekKey === "string" ? lb.weekly.weekKey : "",
              score: safeInt(lb.weekly?.score, 0),
              rank: safeInt(lb.weekly?.rank, 0),
            },
            season: {
              score: safeInt(lb.season?.score, 0),
              rank: safeInt(lb.season?.rank, 0),
            },
          };
        }
        // 引导完成状态
        if (savedMeta.tutorialCompleted && typeof savedMeta.tutorialCompleted === "object") {
          const tc = savedMeta.tutorialCompleted as Record<string, unknown>;
          validMeta.tutorialCompleted = {
            deploy: typeof tc.deploy === "boolean" ? tc.deploy : false,
            battle: typeof tc.battle === "boolean" ? tc.battle : false,
            progression: typeof tc.progression === "boolean" ? tc.progression : false,
            codex: typeof tc.codex === "boolean" ? tc.codex : false,
            season: typeof tc.season === "boolean" ? tc.season : false,
          };
        }
        // 可访问性设置
        if (savedMeta.accessibility && typeof savedMeta.accessibility === "object") {
          const acc = savedMeta.accessibility as { colorBlindMode?: unknown; fontSize?: unknown };
          validMeta.accessibility = {
            colorBlindMode: typeof acc.colorBlindMode === "boolean" ? acc.colorBlindMode : false,
            fontSize: acc.fontSize === "small" || acc.fontSize === "large" ? acc.fontSize : "medium",
          };
        }
        // 剧情章节完成列表
        validMeta.completedStoryChapters = safeStrArr(savedMeta.completedStoryChapters);
        // 爬塔事件选择记录（floor → optionId）
        if (savedMeta.towerEventChoices && typeof savedMeta.towerEventChoices === "object") {
          const choices: Record<number, string> = {};
          for (const [k, v] of Object.entries(savedMeta.towerEventChoices)) {
            const floorNum = Number(k);
            if (Number.isFinite(floorNum) && typeof v === "string") {
              choices[Math.floor(floorNum)] = v;
            }
          }
          validMeta.towerEventChoices = choices;
        }
        // ===== v8 全面升级新增字段校验 =====
        validMeta.completedAgentStoryQuests = safeStrArr(savedMeta.completedAgentStoryQuests);
        validMeta.selectedRegionId = typeof savedMeta.selectedRegionId === "string" ? savedMeta.selectedRegionId : null;
        validMeta.completedStoryStages = safeStrArr(savedMeta.completedStoryStages);
        validMeta.caseBreakdownCorrectCount = safeInt(savedMeta.caseBreakdownCorrectCount, 0);
        validMeta.caseBreakdownTotalCount = safeInt(savedMeta.caseBreakdownTotalCount, 0);
        validMeta.speechBubblesBroken = safeInt(savedMeta.speechBubblesBroken, 0);
        validMeta.victimsRescuedTotal = safeInt(savedMeta.victimsRescuedTotal, 0);
        validMeta.victimsLostTotal = safeInt(savedMeta.victimsLostTotal, 0);
        validMeta.tacticalCommandsUsed = safeInt(savedMeta.tacticalCommandsUsed, 0);
        validMeta.cardSkillsUsed = safeInt(savedMeta.cardSkillsUsed, 0);

        // ===== v9 全面升级新增字段校验与迁移 =====
        // 遗物碎片池迁移：旧存档无 relicShards，从旧 ownedRelics 补偿 3 碎片/件（保值不丢）
        if (savedMeta.relicShards && typeof savedMeta.relicShards === "object") {
          const shards: Record<string, number> = {};
          for (const [k, v] of Object.entries(savedMeta.relicShards)) {
            if (typeof k === "string") shards[k] = safeInt(v, 0);
          }
          validMeta.relicShards = shards;
        } else if (validMeta.ownedRelics.length > 0) {
          // v8→v9 迁移：每件旧遗物补偿 3 碎片（可立即合成或保留）
          const shards: Record<string, number> = {};
          for (const rid of validMeta.ownedRelics) {
            shards[rid] = (shards[rid] ?? 0) + 3;
          }
          validMeta.relicShards = shards;
        } else {
          validMeta.relicShards = {};
        }
        validMeta.unlockedRecipes = safeStrArr(savedMeta.unlockedRecipes);

        // ===== v9 Phase 4.3 全面升级新增字段校验与迁移 =====
        // 错题本：结构化对象，逐条校验
        if (savedMeta.wrongQuestions && typeof savedMeta.wrongQuestions === "object") {
          const wq: Record<string, WrongQuestionRecord> = {};
          for (const [k, v] of Object.entries(savedMeta.wrongQuestions)) {
            if (typeof k !== "string" || !v || typeof v !== "object") continue;
            const r = v as Partial<WrongQuestionRecord>;
            const source = r.source === "quiz" || r.source === "dialog" || r.source === "case" || r.source === "battle"
              ? r.source : "quiz";
            const qtype = r.questionType === "single" || r.questionType === "multi" || r.questionType === "judge" || r.questionType === "branch"
              ? r.questionType : "single";
            wq[k] = {
              questionId: typeof r.questionId === "string" ? r.questionId : k,
              source,
              questionType: qtype,
              questionText: typeof r.questionText === "string" ? r.questionText : "",
              options: Array.isArray(r.options) ? r.options.filter((x): x is string => typeof x === "string") : [],
              correctAnswer: typeof r.correctAnswer === "string" ? r.correctAnswer : "",
              lastWrongAnswer: typeof r.lastWrongAnswer === "string" ? r.lastWrongAnswer : "",
              wrongCount: safeInt(r.wrongCount, 1),
              firstWrongAt: safeInt(r.firstWrongAt, Date.now()),
              lastWrongAt: safeInt(r.lastWrongAt, Date.now()),
              category: typeof r.category === "string" ? r.category : "",
              relatedCaseId: typeof r.relatedCaseId === "string" ? r.relatedCaseId : undefined,
              explanation: typeof r.explanation === "string" ? r.explanation : undefined,
            };
          }
          validMeta.wrongQuestions = wq;
        } else {
          validMeta.wrongQuestions = {};
        }
        validMeta.quizClearedLevels = safeStrArr(savedMeta.quizClearedLevels);
        if (savedMeta.quizHighScores && typeof savedMeta.quizHighScores === "object") {
          const hs: Record<string, number> = {};
          for (const [k, v] of Object.entries(savedMeta.quizHighScores)) {
            if (typeof k === "string") hs[k] = safeInt(v, 0);
          }
          validMeta.quizHighScores = hs;
        } else {
          validMeta.quizHighScores = {};
        }
      }
      // ===== v5 迁移：v10 新增字段兜底（避免旧存档字段缺失导致的 undefined 访问）=====
      // 反诈知识点统计：本局/累计学到
      const m = validMeta as ManagerMetaProgression & {
        learnedFraudTipsThisRun?: unknown;
        learnedFraudTipsTotal?: unknown;
      };
      if (m.learnedFraudTipsThisRun === undefined || !Array.isArray(m.learnedFraudTipsThisRun)) {
        (validMeta as ManagerMetaProgression & {
          learnedFraudTipsThisRun?: string[];
        }).learnedFraudTipsThisRun = [];
      }
      if (typeof m.learnedFraudTipsTotal !== "number" || !Number.isFinite(m.learnedFraudTipsTotal)) {
        (validMeta as ManagerMetaProgression & {
          learnedFraudTipsTotal?: number;
        }).learnedFraudTipsTotal = 0;
      }
      // ===== v6 迁移：v11 新增字段兜底（弱点情报/受害人模拟/战斗回放/自定义难度）=====
      const m11 = validMeta as ManagerMetaProgression & {
        weaknessIntel?: unknown;
        completedVictimSimScenarios?: unknown;
        victimSimBestRanks?: unknown;
        battleReplays?: unknown;
        customDifficulty?: unknown;
        customDifficultyPreset?: unknown;
      };
      if (!Array.isArray(m11.weaknessIntel)) {
        (validMeta as ManagerMetaProgression & { weaknessIntel?: unknown[] }).weaknessIntel = [];
      }
      if (!Array.isArray(m11.completedVictimSimScenarios)) {
        (validMeta as ManagerMetaProgression & { completedVictimSimScenarios?: unknown[] }).completedVictimSimScenarios = [];
      }
      if (!m11.victimSimBestRanks || typeof m11.victimSimBestRanks !== "object") {
        (validMeta as ManagerMetaProgression & { victimSimBestRanks?: Record<string, string> }).victimSimBestRanks = {};
      }
      if (!Array.isArray(m11.battleReplays)) {
        (validMeta as ManagerMetaProgression & { battleReplays?: unknown[] }).battleReplays = [];
      }
      if (!m11.customDifficulty || typeof m11.customDifficulty !== "object") {
        (validMeta as ManagerMetaProgression & {
          customDifficulty?: {
            enemyHpMul: number; enemySpeedMul: number; enemyDmgMul: number;
            spawnIntervalMul: number; startEnergy: number; baseHpMul: number;
          };
        }).customDifficulty = {
          enemyHpMul: 1.0, enemySpeedMul: 1.0, enemyDmgMul: 1.0,
          spawnIntervalMul: 1.0, startEnergy: 100, baseHpMul: 1.0,
        };
      }
      if (typeof m11.customDifficultyPreset !== "string") {
        (validMeta as ManagerMetaProgression & { customDifficultyPreset?: string }).customDifficultyPreset = "normal";
      }
      // 确保 v8/v9 后续字段存在（防旧存档缺失）
      if (!Array.isArray(validMeta.completedAgentStoryQuests)) {
        validMeta.completedAgentStoryQuests = [];
      }
      if (typeof validMeta.selectedRegionId !== "string") {
        validMeta.selectedRegionId = null;
      }
      if (!Array.isArray(validMeta.completedStoryStages)) {
        validMeta.completedStoryStages = [];
      }
      if (typeof validMeta.caseBreakdownCorrectCount !== "number") {
        validMeta.caseBreakdownCorrectCount = 0;
      }
      if (typeof validMeta.caseBreakdownTotalCount !== "number") {
        validMeta.caseBreakdownTotalCount = 0;
      }
      if (typeof validMeta.speechBubblesBroken !== "number") {
        validMeta.speechBubblesBroken = 0;
      }
      if (typeof validMeta.victimsRescuedTotal !== "number") {
        validMeta.victimsRescuedTotal = 0;
      }
      if (typeof validMeta.victimsLostTotal !== "number") {
        validMeta.victimsLostTotal = 0;
      }
      if (typeof validMeta.tacticalCommandsUsed !== "number") {
        validMeta.tacticalCommandsUsed = 0;
      }
      if (typeof validMeta.cardSkillsUsed !== "number") {
        validMeta.cardSkillsUsed = 0;
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
        managerMeta: validMeta,
        version: SCHEMA_VERSION,
      };
    }
    this.loaded = true;
  }

  /** 持久化当前 state 到存储（引擎在 meta 更新后调用） */
  save(): void {
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

  /**
   * v4：记录一局雷霆反诈游戏
   * 雷霆模块自身已通过 THUNDER_SAVE_KEY 持久化（天赋点/排行榜/影子/BossRush 最佳），
   * 本方法负责平台级进度：bestScores / 成就 / 每日挑战 / 累计统计。
   * 返回本次新解锁的成就。
   */
  recordThunderGame(data: {
    mode: ThunderMode;
    difficulty: Difficulty;
    score: number;
    win?: boolean;
    wave?: number;
    endless?: boolean;
    maxCombo?: number;
    bossKills?: number;
    defeatedBossIds?: string[];
    busted?: number;
    durationSec: number;
    dailyCompleted?: boolean;
  }): Achievement[] {
    // 解锁本局击败 BOSS 对应的图鉴条目
    const unlockedTypes: string[] = [];
    if (data.defeatedBossIds && data.defeatedBossIds.length > 0) {
      // BOSS 击败解锁由引擎在战斗过程中已通过 codexId 联动，此处仅做兜底
      // 不重复解锁，避免与引擎事件冲突
    }
    return this.recordGame({
      gameId: "thunder",
      score: data.score,
      busted: data.busted ?? 0,
      unlockedTypes,
      durationSec: data.durationSec,
      win: data.win ?? false,
      wave: data.wave,
      maxCombo: data.maxCombo,
      daily: data.dailyCompleted ?? false,
    });
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

    // v6：同步更新 managerMeta 跨局统计（反诈积分 / 总击杀 / 总 BOSS）
    const meta = this.state.managerMeta;
    let kills = 0;
    if (data.killsByAgent) {
      for (const v of Object.values(data.killsByAgent)) kills += Math.max(0, v);
    }
    // 反诈积分：基础 1 分/击杀 + 50 分/BOSS + 模式加成
    const modeBonus: Record<ManagerMode, number> = {
      classic: 1.2, timeTrial: 1.0, bossRush: 1.5, endlessRush: 1.3,
      daily: 1.8, tower: 1.6, challenge: 2.0, senior: 1.5,
    };
    const pointsGained = Math.floor(
      kills * (modeBonus[data.mode] ?? 1.0) + (data.bossKills ?? 0) * 50
    );
    meta.antiFraudPoints += pointsGained;
    meta.totalKills += kills;
    if (data.bossKills && data.bossKills > 0) {
      meta.totalBossKills += data.bossKills;
    }
    // 金币掉落（按击杀数 + 模式加成）
    meta.coins += Math.floor(kills * 2 * (modeBonus[data.mode] ?? 1.0));
    this.state.managerMeta = { ...meta };

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

  // ============ v6：反诈职业经理人模块跨局元进度 ============

  /** 元进度（只读视图） */
  managerMetaProgress(): ManagerMetaProgression {
    return { ...this.state.managerMeta };
  }

  /** v8：设置当前选中地区（持久化） */
  setSelectedRegion(regionId: string): void {
    this.state.managerMeta.selectedRegionId = regionId;
    this.save();
  }

  /** v10：统一给 managerMeta 增加金币（替代各场景散落的内联累加） */
  addManagerCoins(amount: number): void {
    if (!Number.isFinite(amount) || amount === 0) return;
    const meta = this.state.managerMeta;
    meta.coins = Math.max(0, meta.coins + Math.floor(amount));
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** 探员是否已解锁 */
  isAgentUnlocked(agentId: string): boolean {
    return this.state.managerMeta.unlockedAgents.includes(agentId);
  }

  /** 解锁探员（消耗反诈积分），返回是否成功 */
  unlockAgent(agentId: string, cost: number): boolean {
    const meta = this.state.managerMeta;
    if (meta.unlockedAgents.includes(agentId)) return true;
    if (meta.antiFraudPoints < cost) return false;
    meta.antiFraudPoints -= cost;
    meta.unlockedAgents = [...meta.unlockedAgents, agentId];
    meta.agentCodex = Array.from(new Set([...meta.agentCodex, `codex_agent_${agentId}`]));
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  /** 解锁天赋节点（消耗天赋点），返回是否成功 */
  unlockTalentNode(agentId: string, branch: TalentBranch, tier: number, cost: number): boolean {
    const meta = this.state.managerMeta;
    if (meta.talentPoints < cost) return false;
    const current = meta.agentTalents[agentId]?.[branch] ?? 0;
    if (tier <= current) return false; // 已解锁
    if (tier !== current + 1) return false; // 必须按层级顺序
    meta.talentPoints -= cost;
    meta.agentTalents = {
      ...meta.agentTalents,
      [agentId]: { ...(meta.agentTalents[agentId] ?? {}), [branch]: tier },
    };
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  /** 反诈积分兑换天赋点（100:1） */
  convertPointsToTalent(points: number): boolean {
    const meta = this.state.managerMeta;
    if (meta.antiFraudPoints < points || points < 100) return false;
    meta.antiFraudPoints -= points;
    meta.talentPoints += Math.floor(points / 100);
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  /** 装备/卸下遗物（最多 3 件） */
  toggleRelic(relicId: string): boolean {
    const meta = this.state.managerMeta;
    if (!meta.ownedRelics.includes(relicId)) return false;
    if (meta.equippedRelics.includes(relicId)) {
      meta.equippedRelics = meta.equippedRelics.filter((r) => r !== relicId);
    } else {
      if (meta.equippedRelics.length >= 3) return false;
      meta.equippedRelics = [...meta.equippedRelics, relicId];
    }
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  /** 获得遗物（BOSS 击破 / 爬塔奖励 / 答题奖励） */
  grantRelic(relicId: string): void {
    const meta = this.state.managerMeta;
    if (!meta.ownedRelics.includes(relicId)) {
      meta.ownedRelics = [...meta.ownedRelics, relicId];
      this.state.managerMeta = { ...meta };
      this.save();
    }
  }

  /** 探员装备 / 卸下装备 */
  equipAgentEquipment(agentId: string, equipmentId: string | null): boolean {
    const meta = this.state.managerMeta;
    if (equipmentId !== null && !meta.ownedEquipment.includes(equipmentId)) return false;
    if (equipmentId === null) {
      const { [agentId]: _removed, ...rest } = meta.agentEquipment;
      void _removed;
      meta.agentEquipment = rest;
    } else {
      // 同一装备只能给一个探员
      for (const [aid, eid] of Object.entries(meta.agentEquipment)) {
        if (eid === equipmentId && aid !== agentId) return false;
      }
      meta.agentEquipment = { ...meta.agentEquipment, [agentId]: equipmentId };
    }
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  /** 合成装备（消耗材料） */
  craftEquipment(equipmentId: string, cost: Record<string, number>): boolean {
    const meta = this.state.managerMeta;
    if (meta.ownedEquipment.includes(equipmentId)) return true;
    if (cost.coins && meta.coins < cost.coins) return false;
    if (cost.intel && meta.intel < cost.intel) return false;
    if (cost.caseFiles && meta.caseFiles < cost.caseFiles) return false;
    if (cost.coins) meta.coins -= cost.coins;
    if (cost.intel) meta.intel -= cost.intel;
    if (cost.caseFiles) meta.caseFiles -= cost.caseFiles;
    meta.ownedEquipment = [...meta.ownedEquipment, equipmentId];
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  /** 解锁图鉴条目 */
  unlockCodexEntry(codexId: string, category: CodexCategory): void {
    const meta = this.state.managerMeta;
    const list = category === "enemy" ? meta.enemyCodex
      : category === "agent" ? meta.agentCodex
      : meta.caseCodex;
    if (list.includes(codexId)) return;
    if (category === "enemy") meta.enemyCodex = [...meta.enemyCodex, codexId];
    else if (category === "agent") meta.agentCodex = [...meta.agentCodex, codexId];
    else meta.caseCodex = [...meta.caseCodex, codexId];
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** v11：取 managerMeta 引用（引擎层读取弱点情报/回放等用） */
  managerMetaRef(): ManagerMetaProgression {
    return this.state.managerMeta;
  }

  /** v11：解锁弱点情报（受害人模拟通关后调用，持久化） */
  unlockWeaknessIntel(enemyTypeId: string, scenarioId: string, damageBonus: number): void {
    const meta = this.state.managerMeta;
    if (meta.weaknessIntel.some((w) => w.enemyTypeId === enemyTypeId)) return;
    meta.weaknessIntel = [...meta.weaknessIntel, {
      scenarioId, enemyTypeId, damageBonus, unlockedAt: Date.now(),
    }];
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** v11：保存战斗回放（仅保留最近 3 局） */
  saveBattleReplay(record: BattleReplayRecord): void {
    const meta = this.state.managerMeta;
    meta.battleReplays = [record, ...meta.battleReplays].slice(0, 3);
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** v11：记录受害人模拟完成（含最佳评级） */
  recordVictimSimResult(scenarioId: string, rank: "S" | "A" | "B" | "C" | "D"): void {
    const meta = this.state.managerMeta;
    if (!meta.completedVictimSimScenarios.includes(scenarioId)) {
      meta.completedVictimSimScenarios = [...meta.completedVictimSimScenarios, scenarioId];
    }
    const rankOrder: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
    const prev = meta.victimSimBestRanks[scenarioId];
    if (!prev || rankOrder[rank] > rankOrder[prev]) {
      meta.victimSimBestRanks = { ...meta.victimSimBestRanks, [scenarioId]: rank };
    }
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** v11：设置自定义难度（预设档位 + 自定义配置，持久化） */
  setCustomDifficulty(preset: import("@/games/manager/types").CustomDifficultyPreset, config?: import("@/games/manager/types").CustomDifficultyConfig): void {
    const meta = this.state.managerMeta;
    meta.customDifficultyPreset = preset;
    if (preset === "custom" && config) {
      meta.customDifficulty = { ...config };
    } else {
      // easy/normal/hard：以预设档位覆盖自定义配置，保持一致
      meta.customDifficulty = { ...meta.customDifficulty };
    }
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** 记录战间答题 */
  recordQuizAnswer(correct: boolean): void {
    const meta = this.state.managerMeta;
    meta.quizTotalCount += 1;
    if (correct) meta.quizCorrectCount += 1;
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** 记录爬塔进度（到达某层） */
  recordTowerFloor(floor: number, isWin: boolean): void {
    const meta = this.state.managerMeta;
    meta.towerFloor = isWin ? floor + 1 : meta.towerFloor;
    if (floor > meta.towerMaxFloor) meta.towerMaxFloor = floor;
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** 增加赛季积分 */
  addSeasonScore(n: number): void {
    const meta = this.state.managerMeta;
    meta.seasonScore += Math.max(0, n);
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** 完成周常任务（标记已领取） */
  completeWeeklyQuest(questId: string): void {
    const meta = this.state.managerMeta;
    if (!meta.weeklyCompleted.includes(questId)) {
      meta.weeklyCompleted = [...meta.weeklyCompleted, questId];
      this.state.managerMeta = { ...meta };
      this.save();
    }
  }

  /** 探员大招使用次数累加（用于解锁皮肤等） */
  recordUltUsed(): void {
    const meta = this.state.managerMeta;
    meta.totalUltUsed += 1;
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** 获得皮肤 */
  grantSkin(skinId: string): void {
    const meta = this.state.managerMeta;
    if (!meta.ownedSkins.includes(skinId)) {
      meta.ownedSkins = [...meta.ownedSkins, skinId];
      this.state.managerMeta = { ...meta };
      this.save();
    }
  }

  /** 设置探员当前皮肤 */
  setAgentSkin(agentId: string, skinId: string): boolean {
    const meta = this.state.managerMeta;
    if (!meta.ownedSkins.includes(skinId)) return false;
    meta.agentSkins = { ...meta.agentSkins, [agentId]: skinId };
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  // ============ v7 全面升级：错题记录 / 口诀 / 案例 / 排行榜 / 引导 / 可访问性 / 剧情 / 事件 ============

  /**
   * 记录战间答题（v7 扩展：同时维护错题记录）
   * - 答对：错题计数 -1（减到 0 时移除）
   * - 答错：错题计数 +1
   */
  recordQuizAnswerV7(correct: boolean, quizId: string): void {
    const meta = this.state.managerMeta;
    meta.quizTotalCount += 1;
    if (correct) {
      meta.quizCorrectCount += 1;
      // 错题计数递减
      const cur = meta.quizWrongRecords[quizId] ?? 0;
      if (cur > 0) {
        const next = cur - 1;
        if (next <= 0) {
          const { [quizId]: _r, ...rest } = meta.quizWrongRecords;
          void _r;
          meta.quizWrongRecords = rest;
        } else {
          meta.quizWrongRecords = { ...meta.quizWrongRecords, [quizId]: next };
        }
      }
    } else {
      // 错题计数递增
      meta.quizWrongRecords = {
        ...meta.quizWrongRecords,
        [quizId]: (meta.quizWrongRecords[quizId] ?? 0) + 1,
      };
    }
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** 收集反诈口诀（idx 0..35） */
  collectTerm(idx: number): boolean {
    const meta = this.state.managerMeta;
    if (meta.collectedTerms.includes(idx)) return false;
    meta.collectedTerms = [...meta.collectedTerms, idx].sort((a, b) => a - b);
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  /** 解锁真实案例 */
  unlockCase(caseId: string): boolean {
    const meta = this.state.managerMeta;
    if (meta.unlockedCases.includes(caseId)) return false;
    meta.unlockedCases = [...meta.unlockedCases, caseId];
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  /**
   * 更新排行榜（每日/每周/赛季）
   * 仅当新分数高于旧分数时更新，返回是否破纪录
   */
  updateLeaderboard(type: "daily" | "weekly" | "season", score: number, key: string): boolean {
    const meta = this.state.managerMeta;
    if (type === "daily") {
      const cur = meta.leaderboard.daily;
      if (key !== cur.date || score > cur.score) {
        meta.leaderboard = {
          ...meta.leaderboard,
          daily: { date: key, score, rank: 0 },
        };
        this.state.managerMeta = { ...meta };
        this.save();
        return true;
      }
    } else if (type === "weekly") {
      const cur = meta.leaderboard.weekly;
      if (key !== cur.weekKey || score > cur.score) {
        meta.leaderboard = {
          ...meta.leaderboard,
          weekly: { weekKey: key, score, rank: 0 },
        };
        this.state.managerMeta = { ...meta };
        this.save();
        return true;
      }
    } else {
      const cur = meta.leaderboard.season;
      if (score > cur.score) {
        meta.leaderboard = {
          ...meta.leaderboard,
          season: { score, rank: 0 },
        };
        this.state.managerMeta = { ...meta };
        this.save();
        return true;
      }
    }
    return false;
  }

  /** 标记引导完成 */
  completeTutorial(step: "deploy" | "battle" | "progression" | "codex" | "season"): void {
    const meta = this.state.managerMeta;
    if (meta.tutorialCompleted[step]) return;
    meta.tutorialCompleted = { ...meta.tutorialCompleted, [step]: true };
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** 设置可访问性选项 */
  setAccessibility(opts: Partial<{ colorBlindMode: boolean; fontSize: "small" | "medium" | "large" }>): void {
    const meta = this.state.managerMeta;
    meta.accessibility = {
      colorBlindMode: opts.colorBlindMode ?? meta.accessibility.colorBlindMode,
      fontSize: opts.fontSize ?? meta.accessibility.fontSize,
    };
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /** 完成剧情章节 */
  completeStoryChapter(chapterId: string): boolean {
    const meta = this.state.managerMeta;
    if (meta.completedStoryChapters.includes(chapterId)) return false;
    meta.completedStoryChapters = [...meta.completedStoryChapters, chapterId];
    this.state.managerMeta = { ...meta };
    this.save();
    return true;
  }

  /** 记录爬塔事件选择（用于复盘） */
  recordTowerEventChoice(floor: number, optionId: string): void {
    const meta = this.state.managerMeta;
    meta.towerEventChoices = { ...meta.towerEventChoices, [floor]: optionId };
    this.state.managerMeta = { ...meta };
    this.save();
  }

  // ============ v9 Phase 4.3：错题本 + 知识闯关 ============

  /**
   * 记录一次答题结果到结构化错题本
   * - 答对：wrongCount-- （降到 0 移除条目）
   * - 答错：新增或更新条目，wrongCount++ 并刷新 lastWrongAt
   * @returns 更新后的该题错次（0 表示已移除）
   */
  recordWrongQuestion(data: {
    questionId: string;
    source: WrongQuestionRecord["source"];
    questionType: WrongQuestionRecord["questionType"];
    questionText: string;
    options: string[];
    correctAnswer: string;
    userAnswer: string;
    category: string;
    relatedCaseId?: string;
    explanation?: string;
    correct: boolean;
  }): number {
    const meta = this.state.managerMeta;
    const key = `${data.source}::${data.questionId}`;
    const now = Date.now();
    const wq = { ...meta.wrongQuestions };
    if (data.correct) {
      // 答对：递减，到 0 移除
      const cur = wq[key];
      if (cur) {
        const next = cur.wrongCount - 1;
        if (next <= 0) {
          const { [key]: _r, ...rest } = wq;
          void _r;
          meta.wrongQuestions = rest;
        } else {
          meta.wrongQuestions = { ...wq, [key]: { ...cur, wrongCount: next } };
        }
      }
    } else {
      // 答错：新增或更新
      const cur = wq[key];
      meta.wrongQuestions = {
        ...wq,
        [key]: {
          questionId: data.questionId,
          source: data.source,
          questionType: data.questionType,
          questionText: data.questionText,
          options: data.options,
          correctAnswer: data.correctAnswer,
          lastWrongAnswer: data.userAnswer,
          wrongCount: (cur?.wrongCount ?? 0) + 1,
          firstWrongAt: cur?.firstWrongAt ?? now,
          lastWrongAt: now,
          category: data.category,
          relatedCaseId: data.relatedCaseId,
          explanation: data.explanation,
        },
      };
    }
    this.state.managerMeta = { ...meta };
    this.save();
    return meta.wrongQuestions[key]?.wrongCount ?? 0;
  }

  /** 获取错题本所有条目（按最近答错时间排序） */
  getWrongQuestions(): WrongQuestionRecord[] {
    return Object.values(this.state.managerMeta.wrongQuestions)
      .sort((a, b) => b.lastWrongAt - a.lastWrongAt);
  }

  /** 按来源筛选错题 */
  getWrongQuestionsBySource(source: WrongQuestionRecord["source"]): WrongQuestionRecord[] {
    return this.getWrongQuestions().filter((q) => q.source === source);
  }

  /** 错题本统计：按来源分桶 */
  getWrongQuestionStats(): Record<WrongQuestionRecord["source"], number> {
    const stats: Record<WrongQuestionRecord["source"], number> = {
      quiz: 0, dialog: 0, case: 0, battle: 0,
    };
    for (const q of Object.values(this.state.managerMeta.wrongQuestions)) {
      stats[q.source] += 1;
    }
    return stats;
  }

  /** 清空错题本（用于设置中的"重置错题本"） */
  clearWrongQuestions(): void {
    const meta = this.state.managerMeta;
    meta.wrongQuestions = {};
    this.state.managerMeta = { ...meta };
    this.save();
  }

  /**
   * 记录知识闯关通关
   * @returns 是否为新通关（用于触发奖励）
   */
  recordQuizLevelCleared(levelId: string, score: number): boolean {
    const meta = this.state.managerMeta;
    const isNew = !meta.quizClearedLevels.includes(levelId);
    const prevScore = meta.quizHighScores[levelId] ?? 0;
    if (isNew) {
      meta.quizClearedLevels = [...meta.quizClearedLevels, levelId];
    }
    if (score > prevScore) {
      meta.quizHighScores = { ...meta.quizHighScores, [levelId]: score };
    }
    this.state.managerMeta = { ...meta };
    this.save();
    return isNew || score > prevScore;
  }

  /** 知识闯关：某关卡是否已通关 */
  isQuizLevelCleared(levelId: string): boolean {
    return this.state.managerMeta.quizClearedLevels.includes(levelId);
  }

  /** 知识闯关：获取某关卡最高分 */
  getQuizHighScore(levelId: string): number {
    return this.state.managerMeta.quizHighScores[levelId] ?? 0;
  }

  /** 知识闯关：获取已通关数量 */
  getQuizClearedCount(): number {
    return this.state.managerMeta.quizClearedLevels.length;
  }

  /**
   * v9 Phase 4.3：直接累加 managerMeta 中的资源字段
   * 用于知识闯关等非战斗场景发放情报/反诈积分奖励
   * （金币/碎片走 addResources，本方法仅处理 managerMeta 独有字段）
   */
  addManagerMetaResources(data: { intel?: number; antiFraudPoints?: number; caseFiles?: number; talentPoints?: number }): void {
    const meta = this.state.managerMeta;
    if (data.intel) meta.intel += Math.max(0, data.intel);
    if (data.antiFraudPoints) meta.antiFraudPoints += Math.max(0, data.antiFraudPoints);
    if (data.caseFiles) meta.caseFiles += Math.max(0, data.caseFiles);
    if (data.talentPoints) meta.talentPoints += Math.max(0, data.talentPoints);
    this.state.managerMeta = { ...meta };
    this.save();
  }

  rank(): Rank {
    return rankFromBusted(this.state.totalFoolsBusted);
  }
}

export const platformStore = new PlatformStore();
