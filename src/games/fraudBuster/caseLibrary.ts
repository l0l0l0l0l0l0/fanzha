/**
 * 案例库百科（C2 教育功能）
 *
 * 聚合题库（QUESTION_BANK + NEW_QUESTIONS）的 question.caseArchive
 * 与图鉴（FB_CODEX + CODEX_ENTRIES_V5）的 codex.caseArchives，
 * 构建统一可查询的真实案例库。
 *
 * 设计目标：
 * - 0 副作用：所有查询纯读，不写存档
 * - 多维过滤：支持 typeId / source / severity / psychology / 日期 / 关键词
 * - 去重：同一案例标题+日期只保留一条（题库优先于图鉴）
 * - 反查：保留 fromQuestionId / fromCodex 用于跳转原题或图鉴
 */
import type {
  FBCaseLibraryEntry,
  FBCaseLibraryFilter,
  FBCodexEntry,
  FBQuestion,
  FBPsychology,
} from "./types";
import { QUESTION_BANK } from "./data";
import { NEW_QUESTIONS, FB_CODEX, CODEX_ENTRIES_V5 } from "./dataV2";

// ============ 数据聚合 ============

/** 合并所有图鉴条目（FB_CODEX + CODEX_ENTRIES_V5） */
const ALL_CODEX: FBCodexEntry[] = [...FB_CODEX, ...CODEX_ENTRIES_V5];

/** 合并所有题库（legacy + 新题库） */
const ALL_QUESTIONS: FBQuestion[] = [...QUESTION_BANK, ...NEW_QUESTIONS];

/**
 * 构建完整的案例库条目列表（聚合题库 + 图鉴）。
 * 去重规则：同一 (title + date) 组合只保留一条，题库来源优先。
 */
function buildCaseLibrary(): FBCaseLibraryEntry[] {
  const entries: FBCaseLibraryEntry[] = [];
  const seen = new Set<string>();

  // 第一遍：遍历题库 caseArchive（题库优先）
  for (const q of ALL_QUESTIONS) {
    if (!q.caseArchive) continue;
    const ca = q.caseArchive;
    const dedupKey = `${ca.title}::${ca.date}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const codex = ALL_CODEX.find((e) => e.typeId === q.typeId);
    entries.push({
      id: `CL-Q-${q.typeId}-${entries.length + 1}`,
      typeId: q.typeId,
      typeName: codex?.name ?? q.type,
      typeIcon: codex?.icon ?? "📋",
      title: ca.title,
      date: ca.date,
      source: ca.source,
      url: ca.url,
      takeaway: ca.takeaway,
      fromQuestionId: q.id,
      fromCodex: false,
      severity: q.severity,
      psychology: q.psychology,
      knowledgePoints: q.knowledgePoints,
    });
  }

  // 第二遍：遍历图鉴 caseArchives（补充题库未覆盖的案例）
  for (const codex of ALL_CODEX) {
    if (!codex.caseArchives || codex.caseArchives.length === 0) continue;
    for (const ca of codex.caseArchives) {
      const dedupKey = `${ca.title}::${ca.date}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      entries.push({
        id: `CL-C-${codex.typeId}-${entries.length + 1}`,
        typeId: codex.typeId,
        typeName: codex.name,
        typeIcon: codex.icon,
        title: ca.title,
        date: ca.date,
        source: ca.source,
        url: ca.url,
        takeaway: ca.takeaway,
        fromCodex: true,
        severity: undefined, // 图鉴无 severity，由关联题目推断
        psychology: codex.psychology,
        knowledgePoints: codex.knowledgePoint ? [codex.knowledgePoint] : undefined,
      });
    }
  }

  // 按日期降序排序（最新案例在前）
  entries.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  return entries;
}

/** 案例库缓存（模块级单例，首次访问时构建） */
let CASE_LIBRARY_CACHE: FBCaseLibraryEntry[] | null = null;

/**
 * 获取完整案例库（懒加载 + 缓存）。
 * 案例库在首次访问时构建，后续直接返回缓存。
 */
export function getAllCases(): FBCaseLibraryEntry[] {
  if (CASE_LIBRARY_CACHE === null) {
    CASE_LIBRARY_CACHE = buildCaseLibrary();
  }
  return CASE_LIBRARY_CACHE;
}

/** 重置案例库缓存（仅用于测试或题库热更新场景） */
export function resetCaseLibraryCache(): void {
  CASE_LIBRARY_CACHE = null;
}

// ============ 查询与过滤 ============

/**
 * 按过滤器查询案例库。
 * 所有过滤条件均为 AND 关系，空字段不过滤。
 */
export function queryCases(filter: FBCaseLibraryFilter): FBCaseLibraryEntry[] {
  const all = getAllCases();
  return all.filter((entry) => matchFilter(entry, filter));
}

/** 判断单条案例是否匹配过滤器 */
function matchFilter(entry: FBCaseLibraryEntry, filter: FBCaseLibraryFilter): boolean {
  // 按诈骗类型 ID 过滤
  if (filter.typeIds && filter.typeIds.length > 0) {
    if (!filter.typeIds.includes(entry.typeId)) return false;
  }
  // 按来源机构过滤
  if (filter.sources && filter.sources.length > 0) {
    if (!filter.sources.some((s) => entry.source.includes(s))) return false;
  }
  // 按严重度下限过滤
  if (filter.minSeverity !== undefined && filter.minSeverity > 0) {
    if ((entry.severity ?? 0) < filter.minSeverity) return false;
  }
  // 按心理手法过滤（案例的 psychology 需包含过滤条件中的任一手法）
  if (filter.psychology && filter.psychology.length > 0) {
    const entryPsy = entry.psychology ?? [];
    if (!filter.psychology.some((p) => entryPsy.includes(p))) return false;
  }
  // 按日期范围过滤（YYYY-MM 字符串比较）
  if (filter.dateFrom && entry.date < filter.dateFrom) return false;
  if (filter.dateTo && entry.date > filter.dateTo) return false;
  // 关键词搜索（标题 + takeaway 模糊匹配，不区分大小写）
  if (filter.keyword && filter.keyword.trim()) {
    const kw = filter.keyword.trim().toLowerCase();
    const title = entry.title.toLowerCase();
    const takeaway = entry.takeaway.toLowerCase();
    if (!title.includes(kw) && !takeaway.includes(kw)) return false;
  }
  return true;
}

/** 按 ID 查询单条案例 */
export function getCaseById(id: string): FBCaseLibraryEntry | undefined {
  return getAllCases().find((e) => e.id === id);
}

/** 按诈骗类型 ID 查询该类型所有案例 */
export function getCasesByType(typeId: string): FBCaseLibraryEntry[] {
  return getAllCases().filter((e) => e.typeId === typeId);
}

/**
 * 按原题 ID 反查案例（用于答错小课堂跳转）。
 * 返回该题关联的案例，若无则返回 undefined。
 */
export function getCaseByQuestionId(questionId: string): FBCaseLibraryEntry | undefined {
  return getAllCases().find((e) => e.fromQuestionId === questionId);
}

// ============ 统计与元信息 ============

/** 案例库统计信息（用于 UI 展示总览） */
export interface FBCaseLibraryStats {
  /** 案例总数 */
  total: number;
  /** 来自题库的案例数 */
  fromQuestions: number;
  /** 来自图鉴的案例数 */
  fromCodex: number;
  /** 覆盖的诈骗类型数 */
  typeCount: number;
  /** 来源机构列表（去重） */
  sources: string[];
  /** 最早案例日期 */
  earliestDate: string;
  /** 最新案例日期 */
  latestDate: string;
}

/** 获取案例库统计信息 */
export function getCaseLibraryStats(): FBCaseLibraryStats {
  const all = getAllCases();
  const typeSet = new Set<string>();
  const sourceSet = new Set<string>();
  let fromQ = 0;
  let fromC = 0;
  let earliest = "9999-99";
  let latest = "0000-00";

  for (const e of all) {
    typeSet.add(e.typeId);
    sourceSet.add(e.source);
    if (e.fromCodex) fromC++;
    else fromQ++;
    if (e.date < earliest) earliest = e.date;
    if (e.date > latest) latest = e.date;
  }

  return {
    total: all.length,
    fromQuestions: fromQ,
    fromCodex: fromC,
    typeCount: typeSet.size,
    sources: [...sourceSet].sort(),
    earliestDate: earliest === "9999-99" ? "" : earliest,
    latestDate: latest === "0000-00" ? "" : latest,
  };
}

/**
 * 获取所有来源机构列表（用于 UI 过滤器选项）。
 */
export function getAllSources(): string[] {
  const set = new Set<string>();
  for (const e of getAllCases()) set.add(e.source);
  return [...set].sort();
}

/**
 * 获取所有出现过的心理手法列表（用于 UI 过滤器选项）。
 */
export function getAllPsychology(): FBPsychology[] {
  const set = new Set<FBPsychology>();
  for (const e of getAllCases()) {
    if (e.psychology) for (const p of e.psychology) set.add(p);
  }
  return [...set];
}
