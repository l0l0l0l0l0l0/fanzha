import type { FBWeaknessReport } from "../types";
import type { FBSaveData } from "../storage";
import { QUESTION_BANK } from "../data";
import { dailyKey } from "./story";

// ============ v5 升级：智能错题画像 ============


/**
 * 基于存档 byType + psychologyStats 生成本周弱点报告。
 * 选取正确率最低的诈骗类型和心理手法，推荐 10 题针对性训练。
 */
export function buildWeaknessReport(save: FBSaveData): FBWeaknessReport {
  const today = dailyKey();
  // 收集 byType 正确率
  const typeStats = save.byType ?? {};
  let weakestTypeId: string | undefined;
  let weakestTypeName: string | undefined;
  let weakestTypeRate = 1;
  for (const [typeId, stat] of Object.entries(typeStats)) {
    if (stat.total < 2) continue; // 样本太少跳过
    const rate = stat.correct / stat.total;
    if (rate < weakestTypeRate) {
      weakestTypeRate = rate;
      weakestTypeId = typeId;
      // 从题库找类型名
      const q = QUESTION_BANK.find((x) => x.typeId === typeId);
      weakestTypeName = q?.type ?? typeId;
    }
  }

  // 收集 psychologyStats（存档中没有，由 engine 在局后注入 save 临时字段）
  // 这里读取 save 上次保存的 psychologyStats（如果有）
  const psychStats = (save as unknown as { psychologyStats?: Record<string, { correct: number; total: number }> }).psychologyStats ?? {};
  let weakestPsychology: string | undefined;
  let weakestPsychologyRate = 1;
  for (const [psy, stat] of Object.entries(psychStats)) {
    if (stat.total < 2) continue;
    const rate = stat.correct / stat.total;
    if (rate < weakestPsychologyRate) {
      weakestPsychologyRate = rate;
      weakestPsychology = psy;
    }
  }

  // 推荐训练题目：优先选弱点类型的题，补足 10 题
  const recommendedQuestionIds: string[] = [];
  if (weakestTypeId) {
    const typeQuestions = QUESTION_BANK
      .filter((q) => q.typeId === weakestTypeId && !save.reviewClearedIds.includes(q.id))
      .slice(0, 10);
    recommendedQuestionIds.push(...typeQuestions.map((q) => q.id));
  }
  // 不足 10 题用其他未清除题补齐
  if (recommendedQuestionIds.length < 10) {
    const fillers = QUESTION_BANK
      .filter((q) => !recommendedQuestionIds.includes(q.id) && !save.reviewClearedIds.includes(q.id))
      .slice(0, 10 - recommendedQuestionIds.length);
    recommendedQuestionIds.push(...fillers.map((q) => q.id));
  }

  // 弱点等级
  let severityLabel = "低发";
  if (weakestTypeRate < 0.4) severityLabel = "高发";
  else if (weakestTypeRate < 0.7) severityLabel = "中发";

  return {
    weakestTypeId,
    weakestTypeName,
    weakestTypeRate: weakestTypeRate === 1 ? undefined : weakestTypeRate,
    weakestPsychology,
    weakestPsychologyRate: weakestPsychologyRate === 1 ? undefined : weakestPsychologyRate,
    recommendedQuestionIds,
    reportDate: today,
    severityLabel,
  };
}

/**
 * 基于弱点报告生成针对性训练题组（10 题）。
 * 用于 review 模式升级：从随机错题改为智能错题画像。
 */
export function pickWeaknessTrainingQuestions(report: FBWeaknessReport, count = 10): string[] {
  if (report.recommendedQuestionIds.length >= count) {
    return report.recommendedQuestionIds.slice(0, count);
  }
  // 不足 count 题，用随机题补齐
  const existing = new Set(report.recommendedQuestionIds);
  const fillers = QUESTION_BANK
    .filter((q) => !existing.has(q.id))
    .map((q) => q.id)
    .slice(0, count - report.recommendedQuestionIds.length);
  return [...report.recommendedQuestionIds, ...fillers];
}
