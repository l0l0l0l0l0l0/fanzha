/**
 * 答错即时小课堂（C3 教育功能）
 *
 * 答错后揭示态展示的图文教学卡，包含：
 * - 诈骗类型图标与名称
 * - 核心知识点（3-5 条要点，来自关联图鉴）
 * - 心理操控手法解读（人话翻译，让玩家理解骗子如何操纵）
 * - 标准应对话术
 * - 关联图鉴 / 案例库跳转 ID
 *
 * 设计目标：
 * - 0 副作用：纯查询，不写存档
 * - 优雅降级：若图鉴/案例库无关联数据，仍能基于 question 自身字段生成教学卡
 * - 教育属性：心理学解读让玩家知其然更知其所以然
 */
import type { FBMiniLesson, FBQuestion, FBPsychology, FBCodexEntry } from "./types";
import { FB_CODEX, CODEX_ENTRIES_V5 } from "./dataV2";
import { getCaseByQuestionId } from "./caseLibrary";

// ============ 心理手法人话解读映射 ============

/** 心理手法 -> 人话解读（让玩家理解骗子如何利用该心理弱点） */
const PSYCHOLOGY_EXPLAIN_MAP: Record<FBPsychology, string> = {
  urgency: "紧迫感：故意制造'立即行动'的压力，让你来不及思考核实。",
  authority: "权威恐吓：冒充公检法/领导/客服，让你因服从权威而放弃判断。",
  greed: "贪婪诱惑：用'稳赚不赔''高收益'勾起贪念，让你只见利益不见风险。",
  fear: "恐惧施压：用'拘捕''涉案''影响征信'制造恐惧，让你失去理性。",
  trust: "信任建立：长期嘘寒问暖或精准信息铺垫，让你误以为对方可信。",
  intimacy: "情感亲密：扮演优质异性/知心朋友，用情感拉拢降低你的防线。",
  curiosity: "好奇心：用'内部消息''神秘机会'勾起好奇，引你上钩。",
  conformity: "从众压力：伪造群友晒单/多人参与，让你因'大家都做'而跟风。",
  scarcity: "稀缺性：'名额有限''即将修复''最后机会'，让你担心错过而冲动。",
  sunkCost: "沉没成本：利用你已投入的钱财，让你'为回本而继续转账'。",
};

// ============ 图鉴查找 ============

/** 合并所有图鉴条目（与 caseLibrary.ts 保持一致） */
const ALL_CODEX: FBCodexEntry[] = [...FB_CODEX, ...CODEX_ENTRIES_V5];

/** 按 typeId 查找图鉴条目（兼容 FB_CODEX + CODEX_ENTRIES_V5） */
function findCodexByTypeId(typeId: string): FBCodexEntry | undefined {
  return ALL_CODEX.find((e) => e.typeId === typeId);
}

// ============ 教学卡生成 ============

/**
 * 根据题目生成即时小课堂教学卡。
 * 优先从关联图鉴取教学要点，降级使用题目自身的 cues + explain。
 *
 * @param question 答错的题目
 * @returns 教学卡数据（永远返回非 null，优雅降级）
 */
export function buildMiniLesson(question: FBQuestion): FBMiniLesson {
  const codex = findCodexByTypeId(question.typeId);
  const caseEntry = getCaseByQuestionId(question.id);
  const psychology = question.psychology ?? codex?.psychology ?? [];

  // 心理手法人话解读
  const psychologyExplain = psychology.map((p) => PSYCHOLOGY_EXPLAIN_MAP[p] ?? `${p}：骗子利用该心理弱点操纵你。`);

  // 核心知识点：优先用图鉴 points，降级用题目 cues + explain
  let keyPoints: string[];
  if (codex && codex.points.length > 0) {
    keyPoints = codex.points.slice(0, 4);
  } else {
    // 降级：用题目 cues + explain 摘要
    keyPoints = [...(question.cues ?? [])];
    if (question.explain) {
      // 截取 explain 的第一句作为要点
      const firstSentence = question.explain.split(/[。！]/)[0];
      if (firstSentence) keyPoints.unshift(firstSentence);
    }
    keyPoints = keyPoints.slice(0, 4);
  }

  // 教学标题：优先用图鉴 catchphrase，降级用题目 type + "识破要点"
  const title = codex?.catchphrase ?? `识破"${question.type}"的关键`;

  // 标准应对话术：优先用图鉴 response，降级用 explain
  const response = codex?.response ?? question.explain ?? "遇到可疑情况，立即挂断并拨打 96110 核实。";

  return {
    questionId: question.id,
    typeId: question.typeId,
    typeName: codex?.name ?? question.type,
    typeIcon: codex?.icon ?? "📋",
    title,
    keyPoints,
    psychology,
    psychologyExplain,
    response,
    codexTypeId: question.typeId,
    caseLibraryId: caseEntry?.id,
  };
}

/**
 * 批量预生成多题的教学卡（用于错题本/复盘场景一次性渲染）。
 */
export function buildMiniLessons(questions: FBQuestion[]): FBMiniLesson[] {
  return questions.map((q) => buildMiniLesson(q));
}

// ============ 心理手法解读查询 ============

/** 获取单个心理手法的人话解读 */
export function getPsychologyExplain(p: FBPsychology): string {
  return PSYCHOLOGY_EXPLAIN_MAP[p] ?? `${p}：骗子利用该心理弱点操纵你。`;
}

/** 获取所有心理手法及其解读（用于 UI 列表展示） */
export function getAllPsychologyExplains(): Array<{ key: FBPsychology; explain: string }> {
  return (Object.keys(PSYCHOLOGY_EXPLAIN_MAP) as FBPsychology[]).map((key) => ({
    key,
    explain: PSYCHOLOGY_EXPLAIN_MAP[key],
  }));
}
