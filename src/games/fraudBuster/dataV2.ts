/**
 * 「是男人就反诈」全面升级 v2 数据层
 * - 题库外置 JSON 导入（C1/C2）
 * - 受害者档案定义（B2）
 * - 道具升级配置（B4）
 * - 知识图谱布局（B1）
 * - Boss 周挑战配置（A6）
 * - 季节性逻辑（A4）
 * - 案例溯源辅助（A1）
 */
import type {
  FBQuestion, FBVictimProfile, FBItemUpgradeDef, FBItemType,
  FBKnowledgeNode, FBBoss, FBSeason, FBPsychology,
} from "./types";
import type { FBBoss as FBBossType } from "./types";

// ============ C1/C2：外置 JSON 题库导入 ============
// esbuild 原生支持 JSON 导入，实现题库与代码分离
import newCases2026 from "./questions/new-cases-2026.json";
import branchScenarios from "./questions/branch-scenarios.json";

/** v2 新增题库（2025-2026 案例 + AI 语音 + 分支情景） */
export const NEW_QUESTIONS: FBQuestion[] = [
  ...(newCases2026 as FBQuestion[]),
  ...(branchScenarios as FBQuestion[]),
];

// ============ B2：受害者档案定义 ============
/** 9 种受害者档案，按心理弱点分类，结算页根据错题分布匹配 */
export const VICTIM_PROFILES: FBVictimProfile[] = [
  {
    typeId: "GREED", name: "贪婪型受害者", color: "#FFD666",
    desc: "你容易被\"高收益、稳赚不赔\"话术吸引，对利益诱惑防御力较低。",
    weakness: ["greed", "scarcity"],
    vulnerableScenes: ["杀猪盘", "虚假投资", "刷单返利", "虚假中奖"],
    advice: [
      "牢记\"保本与高收益不可兼得\"",
      "任何\"稳赚不赔\"都是诈骗",
      "投资只认持牌金融机构",
    ],
    severity: 0,
  },
  {
    typeId: "FEAR", name: "恐惧型受害者", color: "#E5353B",
    desc: "你容易被\"拘捕、影响征信、案件保密\"等恐吓话术压迫，慌乱中容易服从。",
    weakness: ["fear", "authority"],
    vulnerableScenes: ["冒充公检法", "注销校园贷", "冒充客服"],
    advice: [
      "公检法不会电话办案，更无\"安全账户\"",
      "挂断后拨打 96110 核实",
      "征信不能靠转账\"注销\"",
    ],
    severity: 0,
  },
  {
    typeId: "TRUST", name: "信任型受害者", color: "#52C41A",
    desc: "你过于相信\"熟人、领导、客服\"的身份伪装，缺乏二次核实习惯。",
    weakness: ["trust", "authority"],
    vulnerableScenes: ["冒充熟人/领导", "冒充客服退款", "冒充老师收费"],
    advice: [
      "换号+不方便接电话+代转=冒充领导标配",
      "任何\"理赔\"都到官方 APP 核实",
      "家长群缴费务必电话核实",
    ],
    severity: 0,
  },
  {
    typeId: "INTIMACY", name: "情感型受害者", color: "#FF7A1A",
    desc: "你容易被\"嘘寒问暖、情感亲密\"建立依赖，对\"带你赚钱\"防备不足。",
    weakness: ["intimacy", "greed"],
    vulnerableScenes: ["杀猪盘", "网恋交友", "甜言蜜语诈骗"],
    advice: [
      "优质异性主动带投资=杀猪盘",
      "不见面只网恋+谈钱=高危",
      "保密参与\"漏洞\"套利=诈骗",
    ],
    severity: 0,
  },
  {
    typeId: "URGENCY", name: "紧迫型受害者", color: "#FF5A60",
    desc: "你在\"截止时间、名额有限、立即执行\"等紧迫氛围下容易仓促决策。",
    weakness: ["urgency", "scarcity"],
    vulnerableScenes: ["虚假退票", "双11理赔", "冒充老师收费"],
    advice: [
      "越催越急越要冷静",
      "限时优惠/名额有限是常用话术",
      "挂断电话给自己 30 秒思考",
    ],
    severity: 0,
  },
  {
    typeId: "CURIOSITY", name: "好奇型受害者", color: "#00E5FF",
    desc: "你对\"扫码领取、免费送、内部消息\"等好奇心诱饵防备不足。",
    weakness: ["curiosity", "greed"],
    vulnerableScenes: ["虚假红包", "免费送皮肤", "数字人民币钓鱼"],
    advice: [
      "陌生链接一律不点",
      "免费送绝版皮肤=盗号盗刷",
      "兑换码只在官方 APP 使用",
    ],
    severity: 0,
  },
  {
    typeId: "CONFORMITY", name: "从众型受害者", color: "#9FE3FF",
    desc: "你容易受\"群友晒单、大家都赚了\"等从众信号影响，缺乏独立判断。",
    weakness: ["conformity", "greed"],
    vulnerableScenes: ["杀猪盘群晒单", "刷单群", "虚假投资群"],
    advice: [
      "群里晒单都是托",
      "别人赚钱不代表你能赚",
      "拉人头返佣=传销式诈骗",
    ],
    severity: 0,
  },
  {
    typeId: "SUNKCOST", name: "沉没成本型受害者", color: "#FF00E5",
    desc: "你在已投入资金后容易\"继续垫付解冻\"，被沉没成本绑架无法止损。",
    weakness: ["sunkCost", "greed"],
    vulnerableScenes: ["刷单卡单", "杀猪盘提现受阻", "博彩输钱翻本"],
    advice: [
      "\"卡单\"\"解冻\"是标准话术",
      "任何继续转账都是扩大损失",
      "已损失的钱追不回，止损才是赢家",
    ],
    severity: 0,
  },
  {
    typeId: "IMMUNE", name: "反诈免疫者", color: "#1AD670",
    desc: "恭喜！你对各类诈骗手法有较强免疫力，继续保持警惕。",
    weakness: [],
    vulnerableScenes: [],
    advice: [
      "保持\"不轻信、不转账、不透露\"三不原则",
      "下载国家反诈中心 APP",
      "遇疑拨打 96110",
    ],
    severity: 0,
  },
];

/** 心理手法中文名映射（与 scene 一致） */
export const PSYCHOLOGY_LABELS_V2: Record<FBPsychology, string> = {
  urgency: "紧迫施压",
  authority: "权威恐吓",
  greed: "贪婪诱惑",
  fear: "恐惧施压",
  trust: "信任建立",
  intimacy: "情感亲密",
  curiosity: "好奇心",
  conformity: "从众压力",
  scarcity: "稀缺暗示",
  sunkCost: "沉没成本",
};

// ============ B4：道具升级配置 ============
/** 6 种道具 × 3 级升级配置 */
export const ITEM_UPGRADE_DEFS: FBItemUpgradeDef[] = [
  {
    type: "freeze",
    levels: [
      { level: 1, name: "冰霜新星", cost: 0, effect: "冻结 3 秒", params: { duration: 3 } },
      { level: 2, name: "寒冰屏障", cost: 200, effect: "冻结 5 秒", params: { duration: 5 } },
      { level: 3, name: "绝对零度", cost: 600, effect: "冻结 8 秒", params: { duration: 8 } },
    ],
  },
  {
    type: "fifty",
    levels: [
      { level: 1, name: "50-50", cost: 0, effect: "移除 2 个错误选项", params: { remove: 2 } },
      { level: 2, name: "75-25", cost: 200, effect: "移除 3 个错误选项", params: { remove: 3 } },
      { level: 3, name: "必中", cost: 600, effect: "仅保留正确选项", params: { remove: 99 } },
    ],
  },
  {
    type: "skip",
    levels: [
      { level: 1, name: "跳过", cost: 0, effect: "跳过本题不计分", params: {} },
      { level: 2, name: "闪现", cost: 200, effect: "跳过并得半分", params: { halfScore: 1 } },
      { level: 3, name: "时空回溯", cost: 600, effect: "跳过并得满分", params: { fullScore: 1 } },
    ],
  },
  {
    type: "double",
    levels: [
      { level: 1, name: "双倍分", cost: 0, effect: "下 1 题双倍分", params: { count: 1 } },
      { level: 2, name: "三倍分", cost: 200, effect: "下 2 题三倍分", params: { count: 2, mult: 3 } },
      { level: 3, name: "五倍连击", cost: 600, effect: "下 3 题五倍分", params: { count: 3, mult: 5 } },
    ],
  },
  {
    type: "hint",
    levels: [
      { level: 1, name: "提示", cost: 0, effect: "高亮 1 个正确倾向选项", params: { count: 1 } },
      { level: 2, name: "洞察", cost: 200, effect: "高亮 2 个正确倾向选项", params: { count: 2 } },
      { level: 3, name: "全知", cost: 600, effect: "直接显示正确选项", params: { reveal: 1 } },
    ],
  },
  {
    type: "undo",
    levels: [
      { level: 1, name: "撤销", cost: 0, effect: "撤销本题选择（1 次）", params: { count: 1 } },
      { level: 2, name: "回滚", cost: 200, effect: "撤销本题选择（2 次）", params: { count: 2 } },
      { level: 3, name: "时间倒流", cost: 600, effect: "撤销并恢复 1 点护盾", params: { count: 99, heal: 1 } },
    ],
  },
];

/** 获取道具当前等级配置 */
export function getItemUpgradeDef(type: FBItemType, level: number) {
  const def = ITEM_UPGRADE_DEFS.find((d) => d.type === type);
  if (!def) return null;
  return def.levels.find((l) => l.level === level) ?? def.levels[0];
}

// ============ B1：知识图谱布局 ============
/** 知识图谱节点布局（按诈骗大类分组，坐标 0..1 相对画布） */
export const KNOWLEDGE_GRAPH_LAYOUT: Array<{ id: string; name: string; category: string; x: number; y: number; links: string[] }> = [
  // 冒充类（左上）
  { id: "KP-IMPERSONATION", name: "冒充公检法", category: "冒充类", x: 0.18, y: 0.22, links: ["KP-POSHU", "KP-AI-DEEPFAKE"] },
  { id: "KP-POSHU", name: "冒充熟人/领导", category: "冒充类", x: 0.32, y: 0.18, links: ["KP-IMPERSONATION", "KP-SCHOOL-OPEN"] },
  { id: "KP-SCHOOL-OPEN", name: "冒充老师收费", category: "冒充类", x: 0.28, y: 0.38, links: ["KP-POSHU"] },
  // 利益诱惑类（右上）
  { id: "KP-PIG-BUTCHERING", name: "杀猪盘", category: "利益诱惑类", x: 0.72, y: 0.20, links: ["KP-INVEST", "KP-BRUSH-ORDER"] },
  { id: "KP-INVEST", name: "虚假投资理财", category: "利益诱惑类", x: 0.85, y: 0.30, links: ["KP-PIG-BUTCHERING", "KP-YEAR-END"] },
  { id: "KP-BRUSH-ORDER", name: "刷单返利", category: "利益诱惑类", x: 0.78, y: 0.45, links: ["KP-PIG-BUTCHERING", "KP-SUMMER-JOB"] },
  { id: "KP-YEAR-END", name: "年终虚假理财", category: "利益诱惑类", x: 0.92, y: 0.15, links: ["KP-INVEST"] },
  // AI 技术类（中上）
  { id: "KP-AI-DEEPFAKE", name: "AI 换脸视频", category: "AI技术类", x: 0.50, y: 0.12, links: ["KP-AI-VOICE", "KP-IMPERSONATION"] },
  { id: "KP-AI-VOICE", name: "AI 拟声诈骗", category: "AI技术类", x: 0.58, y: 0.28, links: ["KP-AI-DEEPFAKE"] },
  // 季节性类（左下）
  { id: "KP-SPRING-TRAVEL", name: "春运退票", category: "季节性类", x: 0.15, y: 0.65, links: ["KP-DOUBLE11"] },
  { id: "KP-DOUBLE11", name: "双11理赔", category: "季节性类", x: 0.30, y: 0.72, links: ["KP-SPRING-TRAVEL", "KP-SUMMER-JOB"] },
  { id: "KP-SUMMER-JOB", name: "暑期兼职", category: "季节性类", x: 0.20, y: 0.85, links: ["KP-BRUSH-ORDER", "KP-DOUBLE11"] },
  // 新型支付类（右下）
  { id: "KP-DCEP", name: "数字人民币钓鱼", category: "新型支付类", x: 0.75, y: 0.72, links: ["KP-DOUBLE11"] },
];

/** 诈骗大类配色 */
export const KNOWLEDGE_GRAPH_COLORS: Record<string, string> = {
  "冒充类": "#E5353B",
  "利益诱惑类": "#FFD666",
  "AI技术类": "#00E5FF",
  "季节性类": "#52C41A",
  "新型支付类": "#FF7A1A",
};

// ============ A6：Boss 周挑战配置 ============
/** Boss 周：每周固定一个高难 Boss（按 weekKey 哈希选取） */
export const BOSS_WEEK_POOL: FBBossType[] = [
  {
    id: "BW-01", name: "AI 换脸集团首脑", hp: 4, theme: "purple",
    taunts: ["我的换脸技术天衣无缝", "你能分辨真假吗？", "3 秒素材就够了"],
    skills: ["shuffleOptions", "answerBlur", "timeSteal", "hideTimer"],
  },
  {
    id: "BW-02", name: "跨境杀猪盘操盘手", hp: 4, theme: "red",
    taunts: ["猪已上钩", "提现？做梦吧", "你的钱是我的了"],
    skills: ["summonMinion", "lockItem", "timeSteal", "shuffleOptions"],
  },
  {
    id: "BW-03", name: "冒充公检法总指挥", hp: 5, theme: "gold",
    taunts: ["我是警官，你敢不配合？", "安全账户等着你", "案件保密别告诉家人"],
    skills: ["hideTimer", "lockItem", "answerBlur", "timeSteal"],
  },
  {
    id: "BW-04", name: "刷单返利矩阵头目", hp: 3, theme: "red",
    taunts: ["连单继续做", "解冻金交一下", "本金别想拿回"],
    skills: ["shuffleOptions", "summonMinion", "timeSteal"],
  },
];

/** 根据 weekKey 选取本周 Boss（稳定哈希，同一周固定） */
export function pickBossWeek(weekKey: string): FBBossType {
  let hash = 0;
  for (let i = 0; i < weekKey.length; i++) {
    hash = (hash * 31 + weekKey.charCodeAt(i)) >>> 0;
  }
  return BOSS_WEEK_POOL[hash % BOSS_WEEK_POOL.length];
}

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

// ============ B2：受害者档案匹配 ============

/** 根据心理手法错题统计匹配受害者档案 */
export function matchVictimProfile(
  psychologyStats: Record<string, { correct: number; total: number }>,
  wrongCount: number,
  totalAnswered: number,
): FBVictimProfile {
  // 若答对率极高，返回免疫者
  if (totalAnswered > 0 && wrongCount / totalAnswered < 0.15) {
    return { ...VICTIM_PROFILES.find((p) => p.typeId === "IMMUNE")!, severity: wrongCount / totalAnswered };
  }

  // 找出正确率最低的心理手法（错题最多的弱点）
  let weakest: FBPsychology | null = null;
  let weakestRate = 1;
  for (const [key, stat] of Object.entries(psychologyStats)) {
    if (stat.total === 0) continue;
    const rate = stat.correct / stat.total;
    if (rate < weakestRate) {
      weakestRate = rate;
      weakest = key as FBPsychology;
    }
  }

  if (!weakest) {
    return { ...VICTIM_PROFILES.find((p) => p.typeId === "IMMUNE")!, severity: 0 };
  }

  // 匹配包含该弱点的档案
  const matched = VICTIM_PROFILES.find((p) => p.weakness.includes(weakest!));
  if (!matched) {
    return { ...VICTIM_PROFILES.find((p) => p.typeId === "IMMUNE")!, severity: 0 };
  }

  // 严重度 = 错题率
  const severity = totalAnswered > 0 ? wrongCount / totalAnswered : 0;
  return { ...matched, severity };
}

// ============ B1：知识图谱聚合 ============

/** 根据知识点统计聚合为知识图谱 */
export function buildKnowledgeGraph(
  knowledgeStats: Array<{ point: string; correct: number; total: number }>,
): { nodes: FBKnowledgeNode[]; overallMastery: number } {
  const nodes: FBKnowledgeNode[] = KNOWLEDGE_GRAPH_LAYOUT.map((layout) => {
    const stat = knowledgeStats.find((s) => s.point === layout.id);
    const correct = stat?.correct ?? 0;
    const total = stat?.total ?? 0;
    const mastery = total > 0 ? correct / total : 0;
    return {
      id: layout.id,
      name: layout.name,
      category: layout.category,
      correct,
      total,
      mastery,
      x: layout.x,
      y: layout.y,
      links: layout.links,
    };
  });

  const totalCorrect = nodes.reduce((sum, n) => sum + n.correct, 0);
  const totalTotal = nodes.reduce((sum, n) => sum + n.total, 0);
  const overallMastery = totalTotal > 0 ? totalCorrect / totalTotal : 0;

  return { nodes, overallMastery };
}
