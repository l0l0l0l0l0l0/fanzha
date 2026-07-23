/**
 * 反诈学习系统课程体系
 * 基于 codex 图鉴分三级：basic / intermediate / advanced
 * 每节课绑定 typeId，关联图鉴条目、锦囊、fraudBuster 题库
 */
import type { CodexEntry, FraudTypeId, AntiFraudTip } from "@/types";
import { codexByLevel } from "@/data/codex";
import { tipsByType } from "@/data/tips";
import { QUESTION_BANK } from "@/games/fraudBuster/data";
import type { FBQuestion } from "@/games/fraudBuster/types";

export type CourseLevel = "basic" | "intermediate" | "advanced";

export interface Lesson {
  /** 课程 ID（同 typeId，保证唯一） */
  id: string;
  /** 反诈类型 ID */
  typeId: FraudTypeId;
  /** 课程分级 */
  level: CourseLevel;
  /** 关联图鉴条目 */
  codex: CodexEntry;
  /** 关联锦囊 */
  tips: AntiFraudTip[];
  /** 测验题（来自 fraudBuster 题库，按 typeId 过滤；若不足 3 题则降级使用同级兜底题） */
  quiz: FBQuestion[];
  /** 完成本课程需要答对的题数（默认 = min(3, quiz.length)） */
  passCorrect: number;
}

export interface LessonTier {
  level: CourseLevel;
  title: string;
  subtitle: string;
  accent: string;
  lessons: Lesson[];
}

const LEVEL_META: Record<CourseLevel, { title: string; subtitle: string; accent: string }> = {
  basic: {
    title: "初阶 · 入门识诈",
    subtitle: "BASIC · 日常高频诈骗识别",
    accent: "#1AD670",
  },
  intermediate: {
    title: "中阶 · 套路辨诈",
    subtitle: "INTERMEDIATE · 套路较深需细辨",
    accent: "#00E5FF",
  },
  advanced: {
    title: "高阶 · 复杂防诈",
    subtitle: "ADVANCED · AI/复杂类诈骗防范",
    accent: "#FFB020",
  },
};

/**
 * 为指定 typeId 拉取测验题
 * 优先取该 typeId 直接命中的题；不足 3 题时，从同级其他 typeId 中补足
 */
function buildQuiz(typeId: FraudTypeId, level: CourseLevel): FBQuestion[] {
  const direct = QUESTION_BANK.filter((q) => q.typeId === typeId);
  if (direct.length >= 3) return direct.slice(0, 5);

  // 兜底：从同级的其他课程里随机抽取补足
  const sameLevelTypeIds = codexByLevel(level)
    .filter((c) => c.typeId !== typeId)
    .map((c) => c.typeId);
  const fallback = QUESTION_BANK.filter(
    (q) => q.typeId !== typeId && sameLevelTypeIds.includes(q.typeId as FraudTypeId)
  );
  // 简单去重 + 打乱
  const merged = [...direct];
  for (const q of fallback) {
    if (merged.length >= 3) break;
    if (!merged.find((m) => m.id === q.id)) merged.push(q);
  }
  return merged.slice(0, Math.min(5, Math.max(3, direct.length || 3)));
}

/** 构建完整课程 */
function buildLesson(codex: CodexEntry): Lesson {
  const level = codex.courseLevel ?? "basic";
  const quiz = buildQuiz(codex.typeId, level);
  return {
    id: codex.typeId,
    typeId: codex.typeId,
    level,
    codex,
    tips: tipsByType(codex.typeId),
    quiz,
    passCorrect: Math.min(3, quiz.length),
  };
}

/** 三级课程包（缓存，避免重复构建） */
let _tiers: LessonTier[] | null = null;

export function getLessonTiers(): LessonTier[] {
  if (_tiers) return _tiers;
  _tiers = (["basic", "intermediate", "advanced"] as CourseLevel[]).map((level) => {
    const meta = LEVEL_META[level];
    const lessons = codexByLevel(level).map(buildLesson);
    return { level, title: meta.title, subtitle: meta.subtitle, accent: meta.accent, lessons };
  });
  return _tiers;
}

/** 全部课程平铺 */
export function getAllLessons(): Lesson[] {
  return getLessonTiers().flatMap((t) => t.lessons);
}

/** 按 typeId 获取课程 */
export function getLesson(typeId: string): Lesson | undefined {
  return getAllLessons().find((l) => l.typeId === typeId);
}

/** 各级课程数（用于进度展示） */
export function lessonCounts(): { basic: number; intermediate: number; advanced: number; total: number } {
  const tiers = getLessonTiers();
  const basic = tiers[0].lessons.length;
  const intermediate = tiers[1].lessons.length;
  const advanced = tiers[2].lessons.length;
  return { basic, intermediate, advanced, total: basic + intermediate + advanced };
}
