import type { FBSeason, FBQuestion } from "../types";

// ============ A4：季节性逻辑 ============

/** 当前季节（按月份判定） */
export function currentSeason(date = new Date()): FBSeason {
  const m = date.getMonth() + 1; // 1-12
  if (m === 1 || m === 2) return "springFestival"; // 春节+春运
  if (m >= 6 && m <= 8) return "summerJob";        // 暑期兼职
  if (m === 8 || m === 9) return "schoolOpen";     // 开学季
  if (m === 10 || m === 11) return "double11";     // 双11
  if (m === 12 || m === 1) return "yearEnd";       // 年终理财
  return "all";
}

/** 季节中文名 */
export const SEASON_LABELS: Record<FBSeason, string> = {
  springFestival: "春节红包季",
  schoolOpen: "开学季",
  double11: "双11购物季",
  springTravel: "春运退票季",
  summerJob: "暑期兼职季",
  yearEnd: "年终理财季",
  all: "全年通用",
};

/** 季节图标 */
export const SEASON_ICONS: Record<FBSeason, string> = {
  springFestival: "🧧",
  schoolOpen: "🎓",
  double11: "🛒",
  springTravel: "🚄",
  summerJob: "🏖",
  yearEnd: "📊",
  all: "🔄",
};

// ============ A1：案例溯源辅助 ============

/** 收集本局所有遭遇题目的案例档案 */
export function collectCaseArchives(questions: FBQuestion[]) {
  return questions
    .map((q) => q.caseArchive)
    .filter((a): a is NonNullable<typeof a> => !!a);
}
