/**
 * 成就系统定义
 * 跨游戏累计 + 单局表现 + 每日挑战 + 学习系统
 */
import type { GameId } from "@/types";
import type { IconName } from "@/ui/icons";

export interface AchievementContext {
  totalFoolsBusted: number;
  totalGames: number;
  unlockedCodexCount: number;
  codexTotal: number;
  gamesPlayed: GameId[];
  dailyCompletedCount: number;
  /** 学习系统：已完成的课程 typeId 列表 */
  completedLessons: string[];
  /** 学习系统：累计答对的学习题数 */
  learningCorrectCount: number;
  /** 学习系统：累计学习答题次数 */
  learningTotalCount: number;
  /** 学习系统：初阶课程总数 */
  basicLessonsTotal: number;
  /** 学习系统：中阶课程总数 */
  intermediateLessonsTotal: number;
  /** 学习系统：高阶课程总数 */
  advancedLessonsTotal: number;
  lastGame: {
    gameId: GameId;
    win: boolean;
    score: number;
    wave?: number;
    maxCombo?: number;
    destroyRate?: number;
    daily?: boolean;
  } | null;
  // ===== v3：反诈职业经理人模块进度（可选） =====
  /** 经理人模块：当前解锁的最高关卡（1..3，0 表示未通关） */
  managerMaxLevel?: number;
  /** 经理人模块：无尽模式最高坚持波数 */
  managerBestWave?: number;
  /** 经理人模块：各探员累计击杀熟练度（key = agentId） */
  managerAgentMastery?: Record<string, number>;
  /** 经理人模块：累计完成每日挑战次数 */
  managerDailyCompletedCount?: number;
  /** 经理人模块：累计击杀 BOSS 次数 */
  managerBossKills?: number;
  /** 经理人模块：最近一局的模式与表现 */
  managerLastGame?: {
    mode: string;
    score: number;
    wave?: number;
    win: boolean;
    ultCount?: number;
    bossKills?: number;
  };
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  /** 达成后奖励称号展示色 */
  color: string;
  check: (ctx: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ===== 识破累计类 =====
  {
    id: "first-bust",
    name: "初露锋芒",
    desc: "首次识破一次诈骗",
    icon: "zap",
    color: "#1AD670",
    check: (c) => c.totalFoolsBusted >= 1,
  },
  {
    id: "bust-10",
    name: "反诈新手",
    desc: "累计识破 10 次诈骗",
    icon: "shield",
    color: "#1AD670",
    check: (c) => c.totalFoolsBusted >= 10,
  },
  {
    id: "bust-50",
    name: "反诈先锋",
    desc: "累计识破 50 次诈骗",
    icon: "shield",
    color: "#00E5FF",
    check: (c) => c.totalFoolsBusted >= 50,
  },
  {
    id: "bust-200",
    name: "反诈精英",
    desc: "累计识破 200 次诈骗",
    icon: "award",
    color: "#FFB020",
    check: (c) => c.totalFoolsBusted >= 200,
  },
  {
    id: "bust-500",
    name: "天下无诈",
    desc: "累计识破 500 次诈骗",
    icon: "trophy",
    color: "#FFD666",
    check: (c) => c.totalFoolsBusted >= 500,
  },

  // ===== 是男人就反诈（fraud-buster）单局类 =====
  {
    id: "combo-10",
    name: "十连识破",
    desc: "「是男人就反诈」单局达成 10 连击",
    icon: "target",
    color: "#1AD670",
    check: (c) => c.lastGame?.gameId === "fraud-buster" && (c.lastGame.maxCombo ?? 0) >= 10,
  },
  {
    id: "wave-30",
    name: "站稳脚跟",
    desc: "「是男人就反诈」单局达到 30 波",
    icon: "crosshair",
    color: "#1AD670",
    check: (c) => c.lastGame?.gameId === "fraud-buster" && (c.lastGame.wave ?? 0) >= 30,
  },
  {
    id: "wave-100",
    name: "是真男人",
    desc: "「是男人就反诈」单局达到 100 波",
    icon: "award",
    color: "#FFD666",
    check: (c) => c.lastGame?.gameId === "fraud-buster" && (c.lastGame.wave ?? 0) >= 100,
  },

  // ===== 其他游戏单局类 =====
  {
    id: "manager-win",
    name: "金牌经理人",
    desc: "「反诈职业经理人」赢得一场战斗",
    icon: "users",
    color: "#FFB020",
    check: (c) => c.lastGame?.gameId === "manager" && c.lastGame.win,
  },

  // ===== v3：反诈职业经理人深度成就（持久化进度） =====
  {
    id: "manager-first-boss",
    name: "首战告捷",
    desc: "「反诈职业经理人」首次击杀任意 BOSS",
    icon: "zap",
    color: "#1AD670",
    check: (c) => (c.managerBossKills ?? 0) >= 1,
  },
  {
    id: "manager-boss-hunter",
    name: "猎魔专家",
    desc: "「反诈职业经理人」累计击杀 20 个 BOSS",
    icon: "crosshair",
    color: "#FF7A1A",
    check: (c) => (c.managerBossKills ?? 0) >= 20,
  },
  {
    id: "manager-clear-3",
    name: "跨境反诈专家",
    desc: "「反诈职业经理人」通关最高关卡（跨境反诈）",
    icon: "trophy",
    color: "#FFD666",
    check: (c) => (c.managerMaxLevel ?? 0) >= 3,
  },
  {
    id: "manager-endless-30",
    name: "无尽守门人",
    desc: "「反诈职业经理人」无尽模式坚持 30 波",
    icon: "flame",
    color: "#FFB020",
    check: (c) => (c.managerBestWave ?? 0) >= 30,
  },
  {
    id: "manager-daily-7",
    name: "每日特训",
    desc: "「反诈职业经理人」累计完成 7 次每日挑战",
    icon: "calendar",
    color: "#00E5FF",
    check: (c) => (c.managerDailyCompletedCount ?? 0) >= 7,
  },
  {
    id: "manager-mastery-200",
    name: "王牌探员",
    desc: "「反诈职业经理人」任一探员熟练度达到 200 击杀",
    icon: "star",
    color: "#FFD666",
    check: (c) => {
      const m = c.managerAgentMastery;
      if (!m) return false;
      return Object.values(m).some((v) => v >= 200);
    },
  },
  {
    id: "thunder-win",
    name: "雷霆执法官",
    desc: "「雷霆反诈」击败假警察局长",
    icon: "zap",
    color: "#00E5FF",
    check: (c) => c.lastGame?.gameId === "thunder" && c.lastGame.win,
  },
  {
    id: "bomb-perfect",
    name: "夷为平地",
    desc: "「诈园区」单局摧毁率达到 100%",
    icon: "bomb",
    color: "#FF7A1A",
    check: (c) => c.lastGame?.gameId === "bomb-island" && (c.lastGame.destroyRate ?? 0) >= 1,
  },
  {
    id: "quiz-fight-win",
    name: "答题擂主",
    desc: "「反诈答题 PK」首次击败对手",
    icon: "star",
    color: "#00E5FF",
    check: (c) => c.lastGame?.gameId === "quiz-fight" && c.lastGame.win,
  },

  // ===== 全能与图鉴类 =====
  {
    id: "all-games",
    name: "全能反诈员",
    desc: "体验过全部五款游戏",
    icon: "star",
    color: "#00E5FF",
    check: (c) => c.gamesPlayed.length >= 5,
  },
  {
    id: "codex-half",
    name: "图鉴收藏家",
    desc: "解锁一半以上诈骗图鉴",
    icon: "book",
    color: "#FFB020",
    check: (c) => c.unlockedCodexCount >= Math.ceil(c.codexTotal / 2),
  },
  {
    id: "codex-all",
    name: "反诈百科全书",
    desc: "解锁全部诈骗图鉴",
    icon: "book",
    color: "#FFD666",
    check: (c) => c.unlockedCodexCount >= c.codexTotal,
  },

  // ===== 每日挑战类 =====
  {
    id: "daily-1",
    name: "每日打卡",
    desc: "完成 1 次每日挑战",
    icon: "clock",
    color: "#1AD670",
    check: (c) => c.dailyCompletedCount >= 1,
  },
  {
    id: "daily-7",
    name: "坚持不懈",
    desc: "累计完成 7 次每日挑战",
    icon: "clock",
    color: "#FFD666",
    check: (c) => c.dailyCompletedCount >= 7,
  },

  // ===== 学习系统成就 =====
  {
    id: "learning-first",
    name: "开学第一课",
    desc: "完成首节反诈学习课程",
    icon: "book",
    color: "#1AD670",
    check: (c) => c.completedLessons.length >= 1,
  },
  {
    id: "learning-basic",
    name: "初阶毕业",
    desc: "完成全部初阶课程（F01-F08）",
    icon: "shield",
    color: "#00E5FF",
    check: (c) => c.basicLessonsTotal > 0 && c.completedLessons.length >= c.basicLessonsTotal,
  },
  {
    id: "learning-intermediate",
    name: "中阶进阶",
    desc: "完成初阶 + 中阶全部课程",
    icon: "award",
    color: "#FFB020",
    check: (c) =>
      c.basicLessonsTotal > 0 &&
      c.intermediateLessonsTotal > 0 &&
      c.completedLessons.length >= c.basicLessonsTotal + c.intermediateLessonsTotal,
  },
  {
    id: "learning-advanced",
    name: "反诈学者",
    desc: "完成全部初/中/高阶课程",
    icon: "trophy",
    color: "#FFD666",
    check: (c) =>
      c.basicLessonsTotal > 0 &&
      c.intermediateLessonsTotal > 0 &&
      c.advancedLessonsTotal > 0 &&
      c.completedLessons.length >=
        c.basicLessonsTotal + c.intermediateLessonsTotal + c.advancedLessonsTotal,
  },
  {
    id: "learning-quiz-10",
    name: "判断题训练 10 题",
    desc: "在学习系统中累计答对 10 道题",
    icon: "check",
    color: "#1AD670",
    check: (c) => c.learningCorrectCount >= 10,
  },
  {
    id: "learning-quiz-50",
    name: "判断题训练 50 题",
    desc: "在学习系统中累计答对 50 道题",
    icon: "target",
    color: "#00E5FF",
    check: (c) => c.learningCorrectCount >= 50,
  },
  {
    id: "learning-quiz-100",
    name: "百题无错",
    desc: "在学习系统中累计答对 100 道题",
    icon: "award",
    color: "#FFD666",
    check: (c) => c.learningCorrectCount >= 100,
  },
  {
    id: "learning-accuracy",
    name: "慧眼如炬",
    desc: "累计学习答题 30 次且正确率 ≥ 90%",
    icon: "crosshair",
    color: "#FF7A1A",
    check: (c) =>
      c.learningTotalCount >= 30 && c.learningCorrectCount / Math.max(1, c.learningTotalCount) >= 0.9,
  },
  {
    id: "learning-codex-25",
    name: "图鉴大师",
    desc: "解锁 25 类诈骗图鉴",
    icon: "book",
    color: "#FFD666",
    check: (c) => c.unlockedCodexCount >= 25,
  },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
