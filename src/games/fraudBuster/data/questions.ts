import type { FBQuestion, FBDeconstructScenario } from "../types";
import newCases2026 from "../questions/new-cases-2026.json";
import branchScenarios from "../questions/branch-scenarios.json";
import cases2026V2 from "../questions/cases-2026-v2.json";
import cases2026V3 from "../questions/cases-2026-v3.json";
import crisisQuestions from "../questions/crisis-questions.json";
import evidenceQuestions from "../questions/evidence-questions.json";
import cases2026H2 from "../questions/cases-2026-h2.json";
import cases2026H3 from "../questions/cases-2026-h3.json";
import cases2026V4 from "../questions/cases-2026-v4.json";
import cases2026V5 from "../questions/cases-2026-v5.json";
import deconstructScenarios from "../questions/deconstruct-scenarios.json";

/** v2/v3/v4/v5/v6 新增题库（2025-2026 案例 + AI 语音 + 分支情景 + 2026 新型诈骗 + 危机决策 + 证据判断 + 2026 H2/H3/Q3-Q4 最新诈骗 + v5 2026 新型诈骗大类 F124-F127） */
export const NEW_QUESTIONS: FBQuestion[] = [
  ...(newCases2026 as FBQuestion[]),
  ...(branchScenarios as FBQuestion[]),
  ...(cases2026V2 as FBQuestion[]),
  ...(cases2026V3 as FBQuestion[]),
  ...(crisisQuestions as FBQuestion[]),
  ...(evidenceQuestions as FBQuestion[]),
  ...(cases2026H2 as FBQuestion[]),
  ...(cases2026H3 as FBQuestion[]),
  ...(cases2026V4 as FBQuestion[]),
  ...(cases2026V5 as FBQuestion[]),
];

// ============ v5 升级：骗局拆解剧本库 ============
/** 12 个完整骗子剧本（v6 新增 5 个），每句标注话术目的+心理手法+拆解说明 */
export const DECONSTRUCT_SCENARIOS: FBDeconstructScenario[] = deconstructScenarios as FBDeconstructScenario[];

/** 根据 ID 查询骗局拆解剧本 */
export function getDeconstructScenario(id: string): FBDeconstructScenario | undefined {
  return DECONSTRUCT_SCENARIOS.find((s) => s.id === id);
}
