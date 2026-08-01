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
  FBCodexEntry, FBHotlineScript, FBStoryStage, FBGameMode,
  FBDailyTask, FBSeasonalEvent, FBLocalRankEntry, FBFraudToolItem,
  FBDeconstructScenario, FBAIDialogScenario,
} from "./types";
import type { FBBoss as FBBossType } from "./types";

// ============ C1/C2：外置 JSON 题库导入 ============
// esbuild 原生支持 JSON 导入，实现题库与代码分离
import newCases2026 from "./questions/new-cases-2026.json";
import branchScenarios from "./questions/branch-scenarios.json";
import cases2026V2 from "./questions/cases-2026-v2.json";
import cases2026V3 from "./questions/cases-2026-v3.json";
import crisisQuestions from "./questions/crisis-questions.json";
import evidenceQuestions from "./questions/evidence-questions.json";
import cases2026H2 from "./questions/cases-2026-h2.json";
import cases2026H3 from "./questions/cases-2026-h3.json";
import cases2026V4 from "./questions/cases-2026-v4.json";
import cases2026V5 from "./questions/cases-2026-v5.json";
import deconstructScenarios from "./questions/deconstruct-scenarios.json";

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
  // v4 新增节点（补充 v2/v4 题库用到但缺失的知识点）
  // AI 技术类扩展
  { id: "KP-AI-REALTIME-DEEPFAKE", name: "AI实时换脸", category: "AI技术类", x: 0.42, y: 0.22, links: ["KP-AI-DEEPFAKE", "KP-AI-DIGITAL-HUMAN"] },
  { id: "KP-AI-DIGITAL-HUMAN", name: "AI数字人直播", category: "AI技术类", x: 0.46, y: 0.38, links: ["KP-AI-REALTIME-DEEPFAKE", "KP-LIVE-COMMERCE"] },
  { id: "KP-AI-IMPERSONATION", name: "大模型仿冒客服", category: "AI技术类", x: 0.62, y: 0.40, links: ["KP-AI-VOICE", "KP-CUSTOMER-SERVICE"] },
  // 新型支付/虚拟资产类扩展
  { id: "KP-CRYPTO", name: "USDT虚拟币诈骗", category: "新型支付类", x: 0.68, y: 0.85, links: ["KP-DCEP", "KP-NFT", "KP-CROSS-BORDER-FX"] },
  { id: "KP-NFT", name: "数字藏品NFT骗局", category: "新型支付类", x: 0.82, y: 0.85, links: ["KP-CRYPTO"] },
  { id: "KP-CROSS-BORDER-FX", name: "跨境换汇诈骗", category: "新型支付类", x: 0.88, y: 0.65, links: ["KP-CRYPTO"] },
  // 电商/平台类扩展
  { id: "KP-LIVE-COMMERCE", name: "直播带货诈骗", category: "电商类", x: 0.58, y: 0.55, links: ["KP-DOUBLE11", "KP-SECONDHAND"] },
  { id: "KP-SECONDHAND", name: "二手平台诈骗", category: "电商类", x: 0.45, y: 0.65, links: ["KP-LIVE-COMMERCE", "KP-DOUBLE11"] },
  { id: "KP-FLIGHT-REFUND", name: "航班改签钓鱼", category: "季节性类", x: 0.40, y: 0.80, links: ["KP-SPRING-TRAVEL"] },
  // 招聘/未成年人类
  { id: "KP-FAKE-JOB", name: "虚假招聘/培训贷", category: "利益诱惑类", x: 0.65, y: 0.55, links: ["KP-BRUSH-ORDER", "KP-MINOR-TIPPING"] },
  { id: "KP-MINOR-TIPPING", name: "未成年打赏/代练", category: "利益诱惑类", x: 0.55, y: 0.72, links: ["KP-FAKE-JOB", "KP-SCHOOL-OPEN"] },
  { id: "KP-MINOR-REFUND", name: "未成年人代退款", category: "利益诱惑类", x: 0.50, y: 0.85, links: ["KP-MINOR-TIPPING"] },
  // 其他扩展
  { id: "KP-MONEY-LAUNDERING", name: "跑分洗钱招募", category: "冒充类", x: 0.10, y: 0.50, links: ["KP-IMPERSONATION"] },
  { id: "KP-VTUBER", name: "虚拟主播打赏返利", category: "利益诱惑类", x: 0.72, y: 0.58, links: ["KP-PIG-BUTCHERING", "KP-MINOR-TIPPING"] },
  { id: "KP-PENSION", name: "养老金认证钓鱼", category: "季节性类", x: 0.08, y: 0.78, links: ["KP-SPRING-TRAVEL"] },
  { id: "KP-INFO-COLLECT", name: "信息采集钓鱼", category: "新型支付类", x: 0.92, y: 0.45, links: ["KP-DCEP"] },
  { id: "KP-CUSTOMER-SERVICE", name: "冒充客服退款", category: "冒充类", x: 0.36, y: 0.50, links: ["KP-IMPERSONATION", "KP-DOUBLE11"] },
  // v5 新增：二次诈骗类
  { id: "KP-RECOVERY-SCAM", name: "二次诈骗/追回骗局", category: "冒充类", x: 0.15, y: 0.35, links: ["KP-IMPERSONATION", "KP-PIG-BUTCHERING", "KP-BRUSH-ORDER"] },
];

/** 诈骗大类配色 */
export const KNOWLEDGE_GRAPH_COLORS: Record<string, string> = {
  "冒充类": "#E5353B",
  "利益诱惑类": "#FFD666",
  "AI技术类": "#00E5FF",
  "季节性类": "#52C41A",
  "新型支付类": "#FF7A1A",
  "电商类": "#B388FF",
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

// ============ v3 升级：反诈图鉴（FBCodexEntry） ============
/**
 * FraudBuster 专属图鉴：覆盖题库中所有诈骗类型（F01-F96 + B01-B03 分支情景）。
 * 与全局 src/data/codex.ts 互补：本图鉴聚焦 FraudBuster 题库覆盖范围，
 * 增加心理手法标签、知识点关联、案例档案等 FraudBuster 专属教育字段。
 */
export const FB_CODEX: FBCodexEntry[] = [
  {
    typeId: "F01", name: "冒充公检法", icon: "🚔",
    catchphrase: "电话办案 = 诈骗", slogan: "公检法不电话办案，无安全账户",
    points: [
      "公检法不会通过电话办案",
      "不存在\"安全账户\"，不会被要求转账\"自证清白\"",
      "真警察会让你到公安机关当面配合",
      "不会让你下载陌生 APP 进行\"资金清查\"",
    ],
    response: "挂断并拨打 96110 核实，必要时到就近派出所",
    source: "公安部刑事侦查局",
    courseLevel: "basic",
    psychology: ["authority", "fear", "urgency"],
    knowledgePoint: "KP-IMPERSONATION",
    caseArchives: [
      { title: "冒充公检法转账安全账户案", date: "2025-03", source: "国家反诈中心通报", takeaway: "公检法不电话办案，更无\"安全账户\"。" },
    ],
  },
  {
    typeId: "F02", name: "杀猪盘", icon: "🐷",
    catchphrase: "稳赚不赔 = 杀猪", slogan: "优质异性带投资必杀",
    points: [
      "高富帅/白富美主动加好友且快速暧昧",
      "引导到非正规平台投资，小额提现成功",
      "大额提现需缴\"税\"\"解冻金\"",
      "\"保密参与漏洞套利\"是核心话术",
    ],
    response: "不下载陌生APP，不向个人账户转账，投资认准持牌机构",
    source: "国家反诈中心",
    courseLevel: "basic",
    psychology: ["intimacy", "trust", "greed"],
    knowledgePoint: "KP-PIG-BUTCHERING",
    caseArchives: [
      { title: "小红书理财导师杀猪盘案", date: "2026-01", source: "上海反诈中心通报", takeaway: "短视频平台理财引流=杀猪盘，不下载不转账。" },
    ],
  },
  {
    typeId: "F03", name: "刷单返利", icon: "💰",
    catchphrase: "凡是刷单都是违法", slogan: "刷单即诈骗，垫付是陷阱",
    points: [
      "凡是刷单都是违法，前几单返利诱你加大投入",
      "\"卡单/操作失误\"要求继续垫付",
      "\"解冻金\"是标准话术，越垫越深",
      "点赞关注返佣也是刷单引流",
    ],
    response: "拒绝任何刷单，已转账立即 96110",
    source: "国家反诈中心",
    courseLevel: "basic",
    psychology: ["greed", "sunkCost", "conformity"],
    knowledgePoint: "KP-BRUSH-ORDER",
    caseArchives: [
      { title: "暑期学生兼职刷单诈骗案", date: "2025-07", source: "教育部联合反诈中心通报", takeaway: "学生兼职刷单=诈骗，点赞关注返佣是诱饵。" },
    ],
  },
  {
    typeId: "F78", name: "AI换脸视频诈骗", icon: "🤖",
    catchphrase: "眼见不为实 = AI换脸", slogan: "3秒素材即可克隆",
    points: [
      "AI换脸可伪造亲友视频通话",
      "口型与声音略有偏差、画面卡顿是破绽",
      "AI拟声可克隆子女/客服声音",
      "回拨原号码核实是铁律",
    ],
    response: "挂断视频，通过原号码电话核实，必要时面对面确认",
    source: "国家反诈中心 / 公安部刑事侦查局",
    courseLevel: "advanced",
    psychology: ["urgency", "trust", "intimacy", "fear"],
    knowledgePoint: "KP-AI-DEEPFAKE",
    caseArchives: [
      { title: "AI换脸冒充亲友借款案", date: "2025-03", source: "国家反诈中心通报", takeaway: "视频通话也可伪造，遇涉及转账务必二次电话核实。" },
      { title: "AI拟声冒充子女骗培训费案", date: "2025-09", source: "教育部联合反诈中心通报", takeaway: "开学季高发，AI可克隆子女声音，回拨原号码是铁律。" },
    ],
  },
  {
    typeId: "F79", name: "数字人民币钓鱼", icon: "🪙",
    catchphrase: "兑换码链接 = 钓鱼", slogan: "数字人民币只走官方APP",
    points: [
      "数字人民币红包只在官方APP内领取",
      "陌生链接要求输密码验证码均为钓鱼",
      "官方域名是 cn 冠名，非官方域名一律不点",
      "兑换码不通过短信链接发放",
    ],
    response: "关闭页面，登录数字人民币官方APP核实",
    source: "央行数字货币研究所 / 深圳公安",
    courseLevel: "intermediate",
    psychology: ["greed", "curiosity"],
    knowledgePoint: "KP-DCEP",
    season: ["springFestival"],
    caseArchives: [
      { title: "数字人民币红包兑换码钓鱼案", date: "2025-10", source: "央行数字货币研究所 / 深圳公安", takeaway: "数字人民币只走官方APP，任何兑换码链接都是钓鱼。" },
    ],
  },
  {
    typeId: "F80", name: "短视频平台杀猪盘", icon: "📱",
    catchphrase: "私信带理财 = 杀猪盘", slogan: "短视频引流+下载APP = 诈骗",
    points: [
      "短视频平台私信推荐\"理财导师\"是杀猪盘新引流",
      "群里晒单动辄日入过万都是托",
      "任何非正规平台投资都是诈骗",
      "不下载陌生APP，不向个人账户转账",
    ],
    response: "拉黑举报，不下载陌生APP，投资认准持牌机构",
    source: "上海反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "conformity", "trust"],
    knowledgePoint: "KP-PIG-BUTCHERING",
    caseArchives: [
      { title: "小红书理财导师杀猪盘案", date: "2026-01", source: "上海反诈中心通报", takeaway: "短视频平台理财引流=杀猪盘，不下载不转账。" },
    ],
  },
  {
    typeId: "F81", name: "AI客服仿声诈骗", icon: "📞",
    catchphrase: "官方声音也可伪造", slogan: "挂断回拨官方号码",
    points: [
      "AI可仿造支付宝/银行/快递客服声音",
      "官方客服不会索要密码验证码",
      "不会要求共享屏幕操作",
      "挂断后拨打官方号码（95188/95588等）核实",
    ],
    response: "挂断电话，通过官方APP或官方客服电话核实",
    source: "杭州反诈中心通报",
    courseLevel: "advanced",
    psychology: ["authority", "fear", "urgency"],
    knowledgePoint: "KP-AI-VOICE",
    caseArchives: [
      { title: "AI仿声冒充客服诈骗案", date: "2026-02", source: "杭州反诈中心通报", takeaway: "AI可仿造客服声音，挂断回拨官方号码是唯一正确做法。" },
    ],
  },
  {
    typeId: "F82", name: "春运退票诈骗", icon: "🚄",
    catchphrase: "陌生链接退票 = 钓鱼", slogan: "退票只认 12306 官方渠道",
    points: [
      "官方域名是 12306.cn，其他域名都是钓鱼",
      "退票退款不通过陌生链接",
      "不会要求填写完整银行卡信息",
      "短信中的客服电话不轻信",
    ],
    response: "登录 12306 官方APP或拨打 12306 核实",
    source: "铁路公安联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["urgency", "fear"],
    knowledgePoint: "KP-SPRING-TRAVEL",
    season: ["springTravel", "springFestival"],
    caseArchives: [
      { title: "春运火车票退改签诈骗案", date: "2026-01", source: "铁路公安联合反诈中心通报", takeaway: "退票只认12306官方渠道，陌生链接一律不点。" },
    ],
  },
  {
    typeId: "F83", name: "双11虚假快递理赔", icon: "📦",
    catchphrase: "共享屏幕理赔 = 诈骗", slogan: "购物APP内核实物流",
    points: [
      "双11理赔不要求共享屏幕",
      "共享屏幕=交出密码验证码",
      "不会要求下载会议APP操作退款",
      "购物APP内可查看真实物流与理赔通道",
    ],
    response: "挂断电话，登录购物APP核实物流与售后",
    source: "国家邮政局联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["urgency", "greed"],
    knowledgePoint: "KP-DOUBLE11",
    season: ["double11"],
    caseArchives: [
      { title: "双11虚假快递理赔诈骗案", date: "2025-11", source: "国家邮政局联合反诈中心通报", takeaway: "双11理赔不共享屏幕，购物APP内核实。" },
    ],
  },
  {
    typeId: "F84", name: "暑期兼职刷单", icon: "🏖",
    catchphrase: "学生兼职刷单 = 诈骗", slogan: "点赞返佣是诱饵",
    points: [
      "\"学生专属\"\"日结300-800\"是刷单诈骗引流",
      "任何点赞关注返佣都是诈骗",
      "刷单本身违法",
      "拉同学一起做=扩大受害面",
    ],
    response: "删除短信，不添加陌生微信，不参与刷单",
    source: "教育部联合反诈中心通报",
    courseLevel: "basic",
    psychology: ["greed", "conformity"],
    knowledgePoint: "KP-SUMMER-JOB",
    season: ["summerJob"],
    caseArchives: [
      { title: "暑期学生兼职刷单诈骗案", date: "2025-07", source: "教育部联合反诈中心通报", takeaway: "学生兼职刷单=诈骗，点赞关注返佣是诱饵。" },
    ],
  },
  {
    typeId: "F85", name: "年终虚假理财", icon: "📊",
    catchphrase: "保本高收益 = 诈骗", slogan: "保本与高收益不可兼得",
    points: [
      "任何\"保本保息\"承诺高收益的都是诈骗",
      "年化18%以上几乎必然是骗局",
      "\"仅剩最后名额\"是稀缺暗示话术",
      "投资只认持牌金融机构",
    ],
    response: "关闭广告，到银行或持牌券商核实理财产品",
    source: "银保监会联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "scarcity", "authority"],
    knowledgePoint: "KP-YEAR-END",
    season: ["yearEnd"],
    caseArchives: [
      { title: "年终虚假理财产品诈骗案", date: "2025-12", source: "银保监会联合反诈中心通报", takeaway: "保本与高收益不可兼得，年终理财认准持牌机构。" },
    ],
  },
  {
    typeId: "F86", name: "开学季冒充老师收费", icon: "🎓",
    catchphrase: "家长群扫码缴费 = 诈骗", slogan: "缴费务必电话核实",
    points: [
      "头像和昵称可被完美克隆",
      "\"截止今天18点\"是紧迫施压话术",
      "家长群缴费务必电话核实",
      "不扫陌生二维码",
    ],
    response: "电话联系班主任本人核实，到校财务窗口缴费",
    source: "教育部联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["authority", "urgency", "conformity"],
    knowledgePoint: "KP-SCHOOL-OPEN",
    season: ["schoolOpen"],
    caseArchives: [
      { title: "开学季冒充班主任收费诈骗案", date: "2025-09", source: "教育部联合反诈中心通报", takeaway: "家长群缴费电话核实，不扫陌生二维码。" },
    ],
  },
  {
    typeId: "F87", name: "DeepSeek大模型仿冒客服", icon: "🧠",
    catchphrase: "AI官方助手 = 仿冒", slogan: "扣费关闭到官方渠道核实",
    points: [
      "DeepSeek等大模型不会主动电话\"扣费\"",
      "\"共享屏幕关闭会员\"是诈骗话术",
      "账户扣费问题到官方APP核实",
      "不轻信\"官方助手\"身份",
    ],
    response: "挂断电话，登录DeepSeek官方渠道核实账户状态",
    source: "国家反诈中心通报",
    courseLevel: "advanced",
    psychology: ["authority", "fear", "urgency"],
    knowledgePoint: "KP-AI-VOICE",
    caseArchives: [
      { title: "DeepSeek大模型仿冒客服诈骗案", date: "2026-03", source: "国家反诈中心通报", takeaway: "大模型官方不会电话扣费，到官方渠道核实。" },
    ],
  },
  // ===== v4 新增图鉴：F88-F96（v2 题库覆盖但图鉴缺失） =====
  {
    typeId: "F88", name: "USDT虚拟币代挖诈骗", icon: "💵",
    catchphrase: "代挖稳赚 = 资金盘", slogan: "虚拟币不保本不代挖",
    points: [
      "USDT代挖是典型资金盘，前期提现是诱饵",
      "任何\"提现缴税\"\"认证金\"都是诈骗",
      "助记词=私钥=资产控制权，不可泄露",
      "认准正规交易所，不参与场外交易",
    ],
    response: "拒绝代挖，不转账USDT，认准正规交易所",
    source: "央行联合公安部通报",
    courseLevel: "advanced",
    psychology: ["greed", "conformity", "sunkCost"],
    knowledgePoint: "KP-CRYPTO",
    caseArchives: [
      { title: "USDT代挖资金盘跑路案", date: "2026-02", source: "央行联合公安部通报", takeaway: "USDT代挖稳赚是资金盘，虚拟币投资不保本不代挖。" },
    ],
  },
  {
    typeId: "F89", name: "12306候补加速包", icon: "🚄",
    catchphrase: "加速包 = 诈骗", slogan: "12306无加速包功能",
    points: [
      "12306官方无\"加速包\"功能",
      "候补成功率仅与订单时间和余票有关",
      "不存在\"内部退票\"\"优先通道费\"",
      "退款自动原路返回，无需任何操作",
    ],
    response: "登录12306官方APP核实，不点陌生链接",
    source: "铁路公安联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["urgency", "scarcity", "greed"],
    knowledgePoint: "KP-SPRING-TRAVEL",
    season: ["springTravel", "springFestival"],
    caseArchives: [
      { title: "12306候补加速包诈骗案", date: "2026-01", source: "铁路公安联合反诈中心通报", takeaway: "12306无加速包功能，候补仅与时间和余票有关。" },
    ],
  },
  {
    typeId: "F90", name: "航班改签钓鱼", icon: "✈️",
    catchphrase: "改签领补偿 = 诈骗", slogan: "航班变动只认官方APP",
    points: [
      "航班改签只在航空公司官方APP完成",
      "任何\"改签领补偿金填银行卡\"都是诈骗",
      "不收\"差价到指定账户\"，费用在官方渠道支付",
      "延误险走保险合同理赔，非\"民航局发链接\"",
    ],
    response: "拨打航空公司官方客服核实（如国航95583）",
    source: "民航局联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["urgency", "greed", "fear"],
    knowledgePoint: "KP-FLIGHT-REFUND",
    caseArchives: [
      { title: "航班改签领补偿金诈骗案", date: "2026-03", source: "民航局联合反诈中心通报", takeaway: "航班变动只认航空公司官方APP/客服，陌生链接不点。" },
    ],
  },
  {
    typeId: "F91", name: "数字藏品NFT发售骗局", icon: "🖼️",
    catchphrase: "保本回购+10倍 = 骗局", slogan: "国内数字藏品不可炒作",
    points: [
      "保本与高收益不可兼得",
      "国内数字藏品不可二级市场炒作",
      "\"连接钱包+授权\"=交出NFT控制权",
      "提现要交\"个税\"\"认证金\"=100%诈骗",
    ],
    response: "拒绝参与，国内数字藏品不炒作，跑路走公安+法院",
    source: "文旅部联合反诈中心通报",
    courseLevel: "advanced",
    psychology: ["greed", "scarcity", "conformity", "sunkCost"],
    knowledgePoint: "KP-NFT",
    caseArchives: [
      { title: "数字藏品保本回购骗局", date: "2026-02", source: "文旅部联合反诈中心通报", takeaway: "国内数字藏品不可炒作，保本回购+10倍收益是骗局。" },
    ],
  },
  {
    typeId: "F92", name: "虚拟主播打赏返利", icon: "🎤",
    catchphrase: "打赏返现 = 诈骗", slogan: "正规主播不私下返利",
    points: [
      "任何\"打赏返现\"都是诈骗",
      "\"生日回馈\"\"PK返利\"是打赏返利变种",
      "正规打赏在平台内完成（如B站充电）",
      "助理代打赏+先转账=诈骗",
    ],
    response: "拒绝返利，打赏只走平台官方功能",
    source: "B站联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "intimacy", "conformity"],
    knowledgePoint: "KP-VTUBER",
    caseArchives: [
      { title: "虚拟主播打赏返利诈骗案", date: "2026-02", source: "B站联合反诈中心通报", takeaway: "打赏返利是诈骗，正规主播不会私下返利。" },
    ],
  },
  {
    typeId: "F93", name: "未成年人游戏代退款", icon: "🎮",
    catchphrase: "代退 = 盗号/二次诈骗", slogan: "退款走官方专属通道",
    points: [
      "未成年人退款走\"腾讯未成年人保护\"官方公众号",
      "不收\"工本费\"，不要求共享屏幕",
      "身份证照片不可外泄，黑中介涉嫌违法",
      "\"100%退款教程\"\"资料费\"都是诈骗话术",
    ],
    response: "到游戏官方客服申请退款，不找代退中介",
    source: "腾讯联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "trust", "sunkCost"],
    knowledgePoint: "KP-MINOR-REFUND",
    caseArchives: [
      { title: "未成年人游戏代退款诈骗案", date: "2026-02", source: "公安部联合游戏厂商通报", takeaway: "未成年人游戏退款走官方渠道，任何代退都是诈骗或盗号。" },
    ],
  },
  {
    typeId: "F94", name: "跨境电商刷单保证金", icon: "📦",
    catchphrase: "代运营+垫付 = 刷单", slogan: "正规跨境电商免费学习",
    points: [
      "\"代运营+垫付保证金\"是刷单诈骗变种",
      "\"卡单\"\"解冻保证金\"是标准话术",
      "正规跨境电商平台均提供免费官方学习渠道",
      "\"0经验躺赚月入过万\"是引流话术",
    ],
    response: "到亚马逊\"卖家大学\"等官方渠道免费学习",
    source: "公安部联合海关总署通报",
    courseLevel: "intermediate",
    psychology: ["greed", "trust", "sunkCost", "conformity"],
    knowledgePoint: "KP-CROSS-BORDER",
    caseArchives: [
      { title: "跨境电商代运营保证金诈骗案", date: "2026-02", source: "公安部联合海关总署通报", takeaway: "代运营+垫付保证金是刷单诈骗变种，任何垫付都是诈骗。" },
    ],
  },
  {
    typeId: "F95", name: "AI养老金资格认证钓鱼", icon: "👴",
    catchphrase: "陌生链接认证 = 钓鱼", slogan: "养老金认证走电子社保卡",
    points: [
      "养老金认证走\"电子社保卡\"\"掌上12333\"官方APP",
      "社保局不电话要求下载APP，不要求保密",
      "不扫楼下张贴的二维码",
      "养老金认证不能\"代办\"，本人人脸识别",
    ],
    response: "挂断拨打12333社保热线核实",
    source: "人社部联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["authority", "fear", "urgency"],
    knowledgePoint: "KP-PENSION",
    season: ["yearEnd"],
    caseArchives: [
      { title: "AI养老金资格认证钓鱼案", date: "2026-01", source: "人社部联合反诈中心通报", takeaway: "养老金认证走电子社保卡等官方APP，任何陌生链接人脸识别都是钓鱼。" },
    ],
  },
  {
    typeId: "F96", name: "答题领现金信息采集", icon: "📝",
    catchphrase: "领现金要身份证+银行卡 = 钓鱼", slogan: "正规答题不要求核心信息",
    points: [
      "\"答题领现金\"是新型信息采集钓鱼",
      "服务密码+身份证后6位=交出账户控制权",
      "孩子信息=精准画像，可能被用于针对性诈骗",
      "短信验证码=账户密码，不可填写",
    ],
    response: "拒绝填写核心信息，关闭页面",
    source: "网信办联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "curiosity", "conformity"],
    knowledgePoint: "KP-INFO-COLLECT",
    caseArchives: [
      { title: "答题领现金信息采集钓鱼案", date: "2026-02", source: "网信办联合反诈中心通报", takeaway: "答题领现金是信息采集钓鱼，任何领现金要求身份证+银行卡都是钓鱼。" },
    ],
  },
  // ===== v4 新增图鉴：F45-F52（2026 新型诈骗） =====
  {
    typeId: "F45", name: "AI实时换脸视频通话", icon: "🎬",
    catchphrase: "视频急令转账 = AI换脸", slogan: "挂断+原号码核实",
    points: [
      "AI实时换脸可伪造视频通话",
      "眨眼频率低、口型偏差、轮廓变形、画面卡顿是破绽",
      "\"麦克风坏了只能打字\"是规避语音破绽的话术",
      "视频不是身份证明，转账必走二次核实",
    ],
    response: "挂断视频，用通讯录原号码电话核实",
    source: "公安部联合网信办通报",
    courseLevel: "advanced",
    psychology: ["urgency", "authority", "trust"],
    knowledgePoint: "KP-AI-REALTIME-DEEPFAKE",
    caseArchives: [
      { title: "AI实时换脸冒充领导代转账案", date: "2026-05", source: "公安部联合网信办通报", takeaway: "AI实时换脸可伪造视频通话，转账务必挂断后用原号码核实。" },
    ],
  },
  {
    typeId: "F46", name: "短视频直播带货诈骗", icon: "📱",
    catchphrase: "加微信付款 = 脱离担保", slogan: "直播购物只在平台内",
    points: [
      "引导脱离平台私下交易是核心话术",
      "\"平台手续费高\"\"加微信便宜\"是诈骗话术",
      "1元秒杀苹果手机+粉丝晒单都是托",
      "正规直播购物全流程在平台内，担保交易",
    ],
    response: "只在正规直播平台内下单支付",
    source: "市场监管总局联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "urgency", "scarcity", "conformity"],
    knowledgePoint: "KP-LIVE-COMMERCE",
    caseArchives: [
      { title: "直播间1元秒杀诈骗案", date: "2026-03", source: "市场监管总局联合反诈中心通报", takeaway: "直播购物只在平台内交易，加微信付款=脱离担保=诈骗。" },
    ],
  },
  {
    typeId: "F47", name: "二手平台\"客服\"诈骗", icon: "🛒",
    catchphrase: "保证金/解冻金 = 诈骗", slogan: "二手平台客服只在APP内",
    points: [
      "二手平台客服只在APP内沟通",
      "任何\"保证金\"\"解冻金\"都是诈骗",
      "订单状态只在官方APP查看，扫码激活=钓鱼",
      "退款在APP内原路返回，链接填银行卡=钓鱼",
    ],
    response: "登录闲鱼/转转APP官方客服核实",
    source: "市场监管总局联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["urgency", "fear", "authority"],
    knowledgePoint: "KP-SECONDHAND",
    caseArchives: [
      { title: "闲鱼解冻保证金诈骗案", date: "2026-02", source: "市场监管总局联合反诈中心通报", takeaway: "二手平台客服只在APP内沟通，任何保证金解冻金都是诈骗。" },
    ],
  },
  {
    typeId: "F48", name: "银行卡跑分洗钱招募", icon: "💳",
    catchphrase: "租卡日500 = 帮信罪", slogan: "出租银行卡最高判3年",
    points: [
      "出租银行卡/收款码过账=跑分洗钱",
      "涉嫌帮助信息网络犯罪活动罪，最高判3年",
      "帮转账走账涉嫌洗钱罪，最高判7年",
      "征信受损终身，银行卡被冻结",
    ],
    response: "拒绝租卡/帮转账，任何走账抽成都违法",
    source: "公安部刑事侦查局通报",
    courseLevel: "advanced",
    psychology: ["greed", "conformity"],
    knowledgePoint: "KP-MONEY-LAUNDERING",
    caseArchives: [
      { title: "租卡跑分洗钱帮信案", date: "2026-02", source: "公安部刑事侦查局通报", takeaway: "出租银行卡跑分=帮信罪，最高判3年，任何租卡赚外快都是违法。" },
    ],
  },
  {
    typeId: "F49", name: "未成年人网络打赏/游戏代练诈骗", icon: "👾",
    catchphrase: "代练要账号密码 = 盗号", slogan: "未成年人打赏可申诉退还",
    points: [
      "代练要求账号密码+定金=盗号诈骗",
      "诱导未成年人巨额打赏+返现是诈骗",
      "未成年人打赏可凭证据向平台申诉退还",
      "正规平台内消费+家长监护是唯一正确做法",
    ],
    response: "拒绝代练，未成年人打赏向平台申诉退还",
    source: "网信办联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "intimacy", "conformity"],
    knowledgePoint: "KP-MINOR-TIPPING",
    season: ["schoolOpen"],
    caseArchives: [
      { title: "游戏代练盗号诈骗案", date: "2026-02", source: "公安部联合游戏厂商通报", takeaway: "代练要账号密码+定金=盗号诈骗，账号密码不可外泄。" },
    ],
  },
  {
    typeId: "F50", name: "虚假招聘/培训贷诈骗", icon: "💼",
    catchphrase: "先交费 = 诈骗", slogan: "正规招聘不收任何费用",
    points: [
      "正规招聘不收培训费/服装费/押金/工本费",
      "培训贷是新型招聘诈骗，公司跑路贷款仍需偿还",
      "0经验日结800+扫码加微信是引流话术",
      "核实公司营业执照与招聘资质",
    ],
    response: "拒绝交费/办贷，核实公司资质",
    source: "人社部联合银保监会通报",
    courseLevel: "intermediate",
    psychology: ["greed", "trust", "sunkCost"],
    knowledgePoint: "KP-FAKE-JOB",
    season: ["summerJob", "schoolOpen"],
    caseArchives: [
      { title: "高薪兼职培训费诈骗案", date: "2026-06", source: "人社部联合反诈中心通报", takeaway: "正规招聘不收任何费用，任何先交费后上岗都是诈骗。" },
    ],
  },
  {
    typeId: "F51", name: "跨境换汇/USDT场外诈骗", icon: "💱",
    catchphrase: "私下换汇 = 诈骗+洗钱", slogan: "换汇只走银行",
    points: [
      "私下跨境换汇是诈骗+洗钱",
      "场外USDT先打币后付款=诈骗",
      "\"汇率比银行高5%\"是诈骗话术",
      "换汇只走银行等持牌机构",
    ],
    response: "到银行办理购汇/结汇，拒绝私下换汇",
    source: "外汇管理局联合反诈中心通报",
    courseLevel: "advanced",
    psychology: ["greed", "trust", "conformity"],
    knowledgePoint: "KP-CROSS-BORDER-FX",
    caseArchives: [
      { title: "私下跨境换汇诈骗案", date: "2026-04", source: "外汇管理局联合反诈中心通报", takeaway: "私下换汇是诈骗+洗钱，换汇只走银行等持牌机构。" },
    ],
  },
  {
    typeId: "F52", name: "AI数字人直播诈骗", icon: "🤖",
    catchphrase: "不眨眼+动作循环 = AI数字人", slogan: "打赏返现+保本投资=三重诈骗",
    points: [
      "AI数字人特征：从不眨眼、动作循环、话术机械",
      "打赏返现+保本投资+AI数字人=三重诈骗",
      "直播打赏只走平台官方礼物功能",
      "AI数字人带货+脱离平台交易=诈骗",
    ],
    response: "拒绝打赏返现/保本投资，只在平台内交易",
    source: "网信办联合反诈中心通报",
    courseLevel: "advanced",
    psychology: ["greed", "intimacy", "conformity", "curiosity"],
    knowledgePoint: "KP-AI-DIGITAL-HUMAN",
    caseArchives: [
      { title: "AI数字人直播打赏诈骗案", date: "2026-05", source: "网信办联合反诈中心通报", takeaway: "AI数字人直播打赏返现=诈骗，不眨眼/动作循环是AI特征。" },
    ],
  },
  // ===== v5 新增图鉴：F98-F106（2026 H2 最新型诈骗） =====
  {
    typeId: "F98", name: "AI视频合成诈骗升级版", icon: "🎬",
    catchphrase: "实时换脸+语音克隆 = 组合拳", slogan: "视频+声音都可伪造",
    points: [
      "AI实时换脸+语音克隆组合，逼真度大幅提升",
      "眨眼频率低、口型偏差、轮廓变形是破绽",
      "\"麦克风坏了只能打字\"是规避语音破绽的话术",
      "转账务必挂断后用通讯录原号码核实",
    ],
    response: "挂断视频，用通讯录原号码电话核实，多重确认",
    source: "公安部联合网信办通报",
    courseLevel: "advanced",
    psychology: ["urgency", "authority", "trust", "intimacy"],
    knowledgePoint: "KP-AI-REALTIME-DEEPFAKE",
    caseArchives: [
      { title: "AI换脸+拟声冒充领导代转账案", date: "2026-07", source: "公安部联合网信办通报", takeaway: "AI实时换脸+语音克隆组合拳，转账必走二次核实。" },
    ],
  },
  {
    typeId: "F99", name: "大模型助手仿冒诈骗", icon: "🧠",
    catchphrase: "AI助手扣费关闭 = 仿冒", slogan: "大模型不主动电话扣费",
    points: [
      "DeepSeek/ChatGPT/文心等大模型不主动电话\"扣费\"",
      "\"共享屏幕关闭会员\"是诈骗话术",
      "\"误开Pro会员每月扣99\"是标准剧本",
      "账户状态到官方APP/官网核实",
    ],
    response: "挂断电话，登录大模型官方渠道核实账户状态",
    source: "国家反诈中心通报",
    courseLevel: "advanced",
    psychology: ["authority", "fear", "urgency"],
    knowledgePoint: "KP-AI-IMPERSONATION",
    caseArchives: [
      { title: "DeepSeek大模型仿冒客服诈骗案", date: "2026-08", source: "国家反诈中心通报", takeaway: "大模型官方不电话扣费，共享屏幕关闭=诈骗。" },
    ],
  },
  {
    typeId: "F100", name: "元宇宙虚拟资产骗局", icon: "🌐",
    catchphrase: "元宇宙地块+保本回购 = 骗局", slogan: "虚拟资产炒作=诈骗",
    points: [
      "\"元宇宙地块\"\"虚拟房产\"在国内不可炒作",
      "保本回购+限量发售+拉人头=资金盘",
      "\"连接钱包授权\"=交出资产控制权",
      "国内虚拟资产交易不受法律保护",
    ],
    response: "拒绝参与，国内虚拟资产不可炒作，跑路走公安+法院",
    source: "文旅部联合网信办通报",
    courseLevel: "advanced",
    psychology: ["greed", "scarcity", "conformity", "sunkCost"],
    knowledgePoint: "KP-NFT",
    caseArchives: [
      { title: "元宇宙地块发售资金盘跑路案", date: "2026-09", source: "文旅部联合网信办通报", takeaway: "元宇宙虚拟资产炒作=资金盘，保本回购是话术。" },
    ],
  },
  {
    typeId: "F101", name: "加密货币空投钓鱼", icon: "🪙",
    catchphrase: "空投领币+授权 = 盗钱包", slogan: "不连接陌生合约",
    points: [
      "\"USDT空投\"\"BTC领取\"是钱包钓鱼",
      "\"连接钱包授权\"=交出私钥控制权",
      "助记词=私钥=资产，永不外泄",
      "正规空投在官方交易所进行，不需连接钱包",
    ],
    response: "拒绝连接陌生合约，不输入助记词，认准正规交易所",
    source: "央行联合公安部通报",
    courseLevel: "advanced",
    psychology: ["greed", "curiosity", "conformity"],
    knowledgePoint: "KP-CRYPTO",
    caseArchives: [
      { title: "USDT空投钓鱼盗币案", date: "2026-08", source: "央行联合公安部通报", takeaway: "空投钓鱼+钱包授权=盗币，助记词永不外泄。" },
    ],
  },
  {
    typeId: "F102", name: "跨境电商代运营新变种", icon: "📦",
    catchphrase: "代运营+保证金 = 刷单变种", slogan: "正规跨境电商免费学习",
    points: [
      "\"TikTok Shop/Amazon代运营+垫付\"是刷单变种",
      "\"0经验躺赚月入过万\"是引流话术",
      "\"卡单解冻保证金\"是标准话术",
      "正规平台均提供免费官方学习渠道",
    ],
    response: "到Amazon卖家大学/TikTok Academy等官方渠道免费学习",
    source: "公安部联合海关总署通报",
    courseLevel: "intermediate",
    psychology: ["greed", "trust", "sunkCost", "conformity"],
    knowledgePoint: "KP-CROSS-BORDER-FX",
    caseArchives: [
      { title: "跨境电商代运营保证金诈骗案", date: "2026-09", source: "公安部联合海关总署通报", takeaway: "代运营+垫付保证金=刷单诈骗变种。" },
    ],
  },
  {
    typeId: "F103", name: "AI数字人直播带货诈骗", icon: "📹",
    catchphrase: "AI主播+1元秒杀 = 诈骗", slogan: "直播购物只在平台内",
    points: [
      "AI数字人主播特征：不眨眼、动作循环、话术机械",
      "\"1元秒杀苹果手机\"+粉丝晒单都是托",
      "引导加微信脱离平台交易=诈骗",
      "正规直播购物全流程在平台内担保交易",
    ],
    response: "只在正规直播平台内下单支付，不加微信私下交易",
    source: "市场监管总局联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "urgency", "scarcity", "conformity"],
    knowledgePoint: "KP-AI-DIGITAL-HUMAN",
    caseArchives: [
      { title: "AI数字人直播1元秒杀诈骗案", date: "2026-10", source: "市场监管总局联合反诈中心通报", takeaway: "AI数字人直播带货+脱离平台交易=诈骗。" },
    ],
  },
  {
    typeId: "F104", name: "智能养老设备诈骗", icon: "👴",
    catchphrase: "智能音箱+健康监测 = 骗老人", slogan: "养老设备到正规渠道买",
    points: [
      "冒充民政/街道推销\"智能养老设备\"是诈骗",
      "\"政府补贴免费送\"+邮费到付套信息",
      "智能音箱可能植入窃听后门",
      "养老设备到正规医院/民政指定渠道购买",
    ],
    response: "挂断电话，到街道办/民政热线12349核实",
    source: "民政部联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["authority", "trust", "greed", "fear"],
    knowledgePoint: "KP-PENSION",
    caseArchives: [
      { title: "智能养老设备诈骗案", date: "2026-10", source: "民政部联合反诈中心通报", takeaway: "免费送养老设备+邮费到付=套信息，到正规渠道购买。" },
    ],
  },
  {
    typeId: "F105", name: "未成年人游戏诈骗升级版", icon: "🎮",
    catchphrase: "免费皮肤+盗号+盗刷 = 组合拳", slogan: "不拿家长手机操作",
    points: [
      "免费送皮肤+索要账号密码=盗号",
      "引导开通亲情支付/免密支付盗刷家长账户",
      "伪造官方通知威胁\"拘留父母\"是话术",
      "不在家长手机上操作陌生链接/二维码",
    ],
    response: "不扫陌生二维码，不拿家长手机操作，遇威胁立即告知家长",
    source: "教育部联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "fear", "curiosity", "trust"],
    knowledgePoint: "KP-MINOR-TIPPING",
    caseArchives: [
      { title: "未成年人免费皮肤诈骗升级案", date: "2026-11", source: "教育部联合反诈中心通报", takeaway: "免费皮肤+盗号+盗刷家长账户=组合拳诈骗。" },
    ],
  },
  {
    typeId: "F106", name: "二次诈骗（追回骗局）", icon: "🔄",
    catchphrase: "帮你追回损失 = 二次诈骗", slogan: "追赃只走公安正规渠道",
    points: [
      "自称\"黑客\"\"律师\"\"内部渠道\"帮你追回被骗资金=二次诈骗",
      "前期收取\"技术服务费\"\"保证金\"是话术",
      "正规追赃走公安/法院，不收前期费用",
      "被骗后到就近派出所报案，不在网上找\"追回服务\"",
    ],
    response: "拒绝任何\"追回服务\"，到就近派出所报案，通过公安正规渠道追赃",
    source: "公安部刑事侦查局",
    courseLevel: "advanced",
    psychology: ["sunkCost", "trust", "urgency", "fear"],
    knowledgePoint: "KP-RECOVERY-SCAM",
    caseArchives: [
      { title: "二次诈骗追回骗局案", date: "2026-12", source: "公安部刑事侦查局", takeaway: "帮你追回损失=二次诈骗，追赃只走公安正规渠道。" },
    ],
  },
];

/** 根据 typeId 查询图鉴条目 */
export function getFBCodexEntry(typeId: string): FBCodexEntry | undefined {
  return FB_CODEX.find((e) => e.typeId === typeId);
}

/** 根据存档 byType 标注图鉴的 encountered/mastery 字段 */
export function annotateCodexWithStats(
  codex: FBCodexEntry[],
  byType: Record<string, { correct: number; total: number }>,
): FBCodexEntry[] {
  return codex.map((e) => {
    const stat = byType[e.typeId];
    const encountered = !!stat && stat.total > 0;
    const mastery = stat && stat.total > 0 ? stat.correct / stat.total : 0;
    return { ...e, encountered, mastery };
  });
}

// ============ v3 升级：96110 模拟通话剧本 ============
/**
 * 96110 反诈专线模拟通话器：玩家选择疑似遭遇的诈骗类型，
 * 接线员引导玩家核实关键点，最终给出"是否诈骗"判定。
 * 每个剧本对应一种诈骗类型，强化"挂断→96110核实"的肌肉记忆。
 */
export const HOTLINE_SCRIPTS_96110: FBHotlineScript[] = [
  {
    id: "HL-IMPOLICE", title: "怀疑遭遇冒充公检法",
    scenario: "你刚接到自称\"市局刑侦支队\"的电话，称你名下银行卡涉嫌洗钱，要求转账到\"安全账户\"清查。",
    typeId: "F01", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，这里是 96110 反诈专线。请描述一下对方说了什么？",
        choices: [
          { text: "对方说涉嫌洗钱，要转账到安全账户", next: "s2", verdict: "right", feedback: "这是典型的冒充公检法话术。" },
          { text: "对方让我下载APP做资金清查", next: "s2", verdict: "right", feedback: "下载陌生APP\"资金清查\"同样是诈骗套路。" },
          { text: "我已转账了，怎么办？", next: "s3", verdict: "warn", feedback: "请立即保留证据并到就近派出所报案。" },
        ],
      },
      {
        id: "s2",
        operator: "请记住：公检法不会电话办案，更不存在\"安全账户\"。对方还做了什么？",
        choices: [
          { text: "准确报出我的身份证号", next: "s3", verdict: "warn", feedback: "身份证号泄露需警惕，但不会改变诈骗性质。" },
          { text: "让我保密不能告诉家人", next: "s3", verdict: "right", feedback: "\"案件保密\"是核心话术，目的是阻止你寻求帮助。" },
          { text: "我没转账，已挂断", next: null, verdict: "right", ending: "verified", feedback: "正确处置！公检法不电话办案，挂断拨打96110核实是唯一正确做法。" },
        ],
      },
      {
        id: "s3",
        operator: "请到就近派出所当面核实，并下载国家反诈中心APP。如已转账，请保留所有聊天/转账记录作为证据。",
        choices: [
          { text: "好的，我立即去派出所", next: null, verdict: "right", ending: "verified", feedback: "正确！真警察会让你当面配合，不会让你转账。" },
          { text: "我再回拨那个号码确认", next: null, verdict: "wrong", ending: "scam", feedback: "错误！回拨骗子号码只会被进一步操控。请拨打96110或到派出所。" },
        ],
      },
    ],
    takeaways: [
      "公检法不会电话办案，更不存在\"安全账户\"",
      "真警察会让你到公安机关当面配合",
      "遇疑拨打 96110，不上当不转账",
    ],
  },
  {
    id: "HL-PIG", title: "怀疑遭遇杀猪盘",
    scenario: "网友带你投资，小额已提现，现在要求大额入金才能\"博高收益\"。",
    typeId: "F02", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方的引流方式？",
        choices: [
          { text: "交友软件认识的，暧昧后带我投资", next: "s2", verdict: "right", feedback: "情感铺垫+投资引流是杀猪盘标配。" },
          { text: "短视频平台理财导师拉群", next: "s2", verdict: "right", feedback: "短视频平台也是杀猪盘新引流渠道。" },
          { text: "已经提现成功了几次", next: "s2", verdict: "warn", feedback: "小额提现是诱饵，大额必然无法提现。" },
        ],
      },
      {
        id: "s2",
        operator: "提现时是否要求缴\"税\"或\"解冻金\"？",
        choices: [
          { text: "是，要交8%税+解冻金", next: "s3", verdict: "right", feedback: "提现要交钱=100%诈骗，立即停止转账。" },
          { text: "还没有提现，准备大额入金", next: "s3", verdict: "warn", feedback: "请立即停止入金，平台是诈骗平台。" },
          { text: "对方说保密别告诉别人", next: "s3", verdict: "right", feedback: "\"保密参与漏洞套利\"是核心话术。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即停止一切转账，保留所有聊天/转账记录，到就近派出所报案。已损失的钱追回难度大，止损才是赢家。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据是唯一正确路径。" },
          { text: "我想再投点把本金提回来", next: null, verdict: "wrong", ending: "scam", feedback: "错误！任何继续转账都是扩大损失。已损失的钱追不回。" },
        ],
      },
    ],
    takeaways: [
      "优质异性带投资=杀猪盘",
      "提现要交\"税\"\"解冻金\"=100%诈骗",
      "止损+报警+保留证据，已损失的钱追不回",
    ],
  },
  {
    id: "HL-BRUSH", title: "怀疑遭遇刷单诈骗",
    scenario: "做点赞关注任务已返佣几单，客服要求垫付500做连单，称返650。",
    typeId: "F03", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下任务流程？",
        choices: [
          { text: "点赞关注已返佣5-10元", next: "s2", verdict: "warn", feedback: "小额返佣是诱饵，下一步必然要求垫付。" },
          { text: "客服让我垫付500做连单", next: "s2", verdict: "right", feedback: "\"连单任务\"\"垫付\"是刷单诈骗核心话术。" },
          { text: "我已垫付3000，卡单要再垫付", next: "s3", verdict: "warn", feedback: "请立即停止转账并报警。" },
        ],
      },
      {
        id: "s2",
        operator: "刷单本身违法，前几单返利只为诱你加大投入。\"垫付连单\"=诈骗。",
        choices: [
          { text: "退群不做了", next: null, verdict: "right", ending: "verified", feedback: "正确！刷单即诈骗，及时止损。" },
          { text: "已经垫付500了，再做单回本", next: "s3", verdict: "wrong", feedback: "错误！\"卡单\"\"解冻\"是标准话术，越垫越深。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即报警并保留证据。任何\"继续转账才能提现\"的话术都是诈骗。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损报警是唯一出路。" },
          { text: "找客服理论要回本金", next: null, verdict: "wrong", ending: "scam", feedback: "错误！客服就是骗子，理论只会被进一步操控。" },
        ],
      },
    ],
    takeaways: [
      "刷单本身违法，返佣是诱饵",
      "\"垫付连单\"\"卡单解冻\"是标准话术",
      "止损+报警+保留证据，不继续转账",
    ],
  },
  {
    id: "HL-DEEPFAKE", title: "怀疑遭遇AI换脸/拟声",
    scenario: "收到\"子女\"语音急要培训费，或\"老友\"视频借款，画面声音都很像。",
    typeId: "F78", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方联系你的方式？",
        choices: [
          { text: "语音消息，声音像子女", next: "s2", verdict: "right", feedback: "AI拟声可克隆声音，3秒素材即可。" },
          { text: "视频通话，画面是本人", next: "s2", verdict: "right", feedback: "AI换脸可伪造视频，注意口型/光线破绽。" },
          { text: "已转账给对方", next: "s3", verdict: "warn", feedback: "请立即报警并联系银行尝试止付。" },
        ],
      },
      {
        id: "s2",
        operator: "AI换脸/拟声诈骗高发。请回拨原号码核实，切勿直接转账。",
        choices: [
          { text: "回拨原号码核实", next: null, verdict: "right", ending: "verified", feedback: "正确！回拨原号码是核实身份的铁律。" },
          { text: "视频里是本人放心转", next: null, verdict: "wrong", ending: "scam", feedback: "错误！AI换脸可伪造视频，必须二次电话核实。" },
          { text: "对方说手机丢了借同学的", next: "s3", verdict: "warn", feedback: "\"借同学手机\"是典型话术，更需核实。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天/转账记录。AI诈骗追赃难度大，止损优先。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "AI可换脸/拟声，3秒素材即可克隆",
      "回拨原号码电话核实是铁律",
      "口型偏差/画面卡顿/光线不自然是破绽",
    ],
  },
  {
    id: "HL-SPRING-TRAVEL", title: "怀疑遭遇春运退票诈骗",
    scenario: "收到\"铁路客服\"短信称列车停运，要求点击链接退票退款，需填银行卡信息。",
    typeId: "F82", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请告诉我短信里的链接是什么域名？",
        choices: [
          { text: "12306-refund.xyz 之类", next: "s2", verdict: "right", feedback: "非 12306.cn 域名一律是钓鱼。" },
          { text: "已点击并填了银行卡信息", next: "s3", verdict: "warn", feedback: "请立即冻结银行卡并报警。" },
          { text: "短信里有客服电话让我打", next: "s2", verdict: "warn", feedback: "短信中的客服电话不可信。" },
        ],
      },
      {
        id: "s2",
        operator: "官方退票只走 12306 官方APP或 12306.cn。任何其他域名都是钓鱼。",
        choices: [
          { text: "登录12306官方APP核实", next: null, verdict: "right", ending: "verified", feedback: "正确！退票只认12306官方渠道。" },
          { text: "按短信提示填银行卡退款", next: null, verdict: "wrong", ending: "scam", feedback: "错误！填银行卡信息=泄露卡号密码，资金将被盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即拨打银行客服冻结银行卡，并到就近派出所报案。",
        choices: [
          { text: "好的，我立即冻结银行卡", next: null, verdict: "right", ending: "verified", feedback: "正确！止付+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "退票只认 12306 官方APP或 12306.cn",
      "陌生链接一律不点，不填银行卡信息",
      "已泄露卡信息立即冻结银行卡+报警",
    ],
  },
];

/** 根据 ID 查询 96110 剧本 */
export function getHotlineScript(id: string): FBHotlineScript | undefined {
  return HOTLINE_SCRIPTS_96110.find((s) => s.id === id);
}

// ============ v3 升级：剧情模式关卡配置 ============
/**
 * 剧情模式：6 关线性剧本，难度递进。
 * 每关从题库筛选特定诈骗类型的题目，最后关卡有 Boss 战。
 * 关卡主题色与图标区分，营造 RPG 推进感。
 */
export const STORY_STAGES: FBStoryStage[] = [
  {
    idx: 0, id: "ST-01", name: "第一关 · 初识骗术",
    intro: "新手反诈战士上岗！先熟悉最常见的诈骗套路：冒充公检法、刷单返利、杀猪盘。",
    outro: "恭喜通关！基础骗术已识破，下一关将面对更复杂的套路。",
    questionIds: ["F01-001", "F01-002", "F03-001", "F03-003", "F02-001", "F02-003"],
    passCorrect: 4, themeColor: "#1AD670", icon: "🔰",
  },
  {
    idx: 1, id: "ST-02", name: "第二关 · 客服陷阱",
    intro: "冒充客服退款、注销校园贷、虚假理赔...这些\"专业\"话术你能识破吗？",
    outro: "通关成功！客服类诈骗套路已被你掌握。",
    questionIds: ["F81-001", "F83-001", "F04-001", "F04-002", "F04-003", "F05-001"],
    passCorrect: 4, themeColor: "#00E5FF", icon: "📞",
  },
  {
    idx: 2, id: "ST-03", name: "第三关 · 利益诱惑",
    intro: "高收益理财、年终限享、内部消息...贪婪是最大的弱点。",
    outro: "你已识破利益诱惑类诈骗，向下一关进发！",
    questionIds: ["F85-001", "F80-001", "F02-002", "F10-001", "F10-002", "F11-001"],
    passCorrect: 4, themeColor: "#FFD666", icon: "💰",
  },
  {
    idx: 3, id: "ST-04", name: "第四关 · 季节陷阱",
    intro: "春运退票、双11理赔、暑期兼职、开学收费...季节性诈骗防不胜防。",
    outro: "通关成功！你已掌握各季节高发诈骗套路。",
    questionIds: ["F82-001", "F83-001", "F84-001", "F86-001", "F79-001", "F85-001"],
    passCorrect: 4, themeColor: "#FF7A1A", icon: "📅",
  },
  {
    idx: 4, id: "ST-05", name: "第五关 · AI 新型诈骗",
    intro: "AI换脸、AI拟声、DeepSeek仿冒...新技术带来的新型诈骗，难度最高！",
    outro: "太强了！你已识破AI新型诈骗，最终Boss在等你！",
    questionIds: ["F78-001", "F78-002", "F81-001", "F87-001", "F87-002", "F87-003"],
    passCorrect: 4, themeColor: "#B388FF", icon: "🤖",
  },
  {
    idx: 5, id: "ST-06", name: "最终关 · Boss 决战",
    intro: "跨境诈骗集团首脑出现！连续答对击败Boss，成为真正的反诈大师！",
    outro: "你击败了诈骗集团首脑，通关剧情模式！",
    questionIds: ["F01-003", "F02-002", "F78-001", "F87-001", "B01-001", "B02-001"],
    bossId: "BW-03", passCorrect: 5, themeColor: "#FF3B6B", icon: "👑",
  },
  // ===== v5 支线关卡：6 关支线 + 1 隐藏结局 =====
  {
    idx: 6, id: "BT-01", name: "支线 · AI换脸实战特训",
    intro: "AI换脸、AI拟声、AI视频合成……最新AI诈骗技术全演练，你能全部识破吗？",
    outro: "AI诈骗全部识破！你已掌握AI时代反诈核心技能。",
    questionIds: ["F78-001", "F78-002", "F81-001", "F98-001", "F98-002", "F98-003"],
    passCorrect: 5, themeColor: "#B388FF", icon: "🎬",
    isBranch: true, unlockCondition: "主线第5关通关解锁",
  },
  {
    idx: 7, id: "BT-02", name: "支线 · 数字货币陷阱",
    intro: "数字人民币钓鱼、USDT代挖、空投钓鱼……虚拟货币世界暗藏杀机。",
    outro: "数字货币陷阱全部识破！你的虚拟资产安全了。",
    questionIds: ["F79-001", "F88-001", "F88-002", "F101-001", "F101-002", "F101-003"],
    passCorrect: 5, themeColor: "#FF7A1A", icon: "🪙",
    isBranch: true, unlockCondition: "主线第3关通关解锁",
  },
  {
    idx: 8, id: "BT-03", name: "支线 · 直播电商黑幕",
    intro: "短视频杀猪盘、直播带货诈骗、AI数字人直播……电商新玩法背后的骗局。",
    outro: "直播电商黑幕揭开！你是精明的消费者。",
    questionIds: ["F80-001", "F46-001", "F46-002", "F103-001", "F103-002", "F103-003"],
    passCorrect: 5, themeColor: "#FFD666", icon: "📹",
    isBranch: true, unlockCondition: "主线第2关通关解锁",
  },
  {
    idx: 9, id: "BT-04", name: "支线 · 未成年人守护",
    intro: "开学季冒充老师、游戏代练盗号、免费皮肤诈骗……守护未成年人的零花钱。",
    outro: "未成年人守护成功！你是反诈好家长。",
    questionIds: ["F86-001", "F49-001", "F49-002", "F105-001", "F105-002", "F105-003"],
    passCorrect: 5, themeColor: "#52C41A", icon: "🛡",
    isBranch: true, unlockCondition: "主线第4关通关解锁",
  },
  {
    idx: 10, id: "BT-05", name: "支线 · 养老反诈防线",
    intro: "养老金认证钓鱼、智能养老设备诈骗、元宇宙虚拟资产……银发族的反诈防线。",
    outro: "养老反诈防线筑牢！父母的钱袋子安全了。",
    questionIds: ["F95-001", "F95-002", "F104-001", "F104-002", "F100-001", "F104-003"],
    passCorrect: 5, themeColor: "#E5353B", icon: "👴",
    isBranch: true, unlockCondition: "主线第1关通关解锁",
  },
  {
    idx: 11, id: "BT-06", name: "隐藏结局 · 二次诈骗陷阱",
    intro: "被骗后上网搜\"追回损失\"，自称黑客/律师/内部渠道帮你追回资金……这是最阴险的二次诈骗！",
    outro: "隐藏结局解锁！你识破了二次诈骗——追回骗局，成为真正的反诈大师！",
    questionIds: ["F106-001", "F106-002", "F106-003", "F106-004", "F106-005"],
    passCorrect: 4, themeColor: "#FF00E5", icon: "🔄",
    isBranch: true, isHiddenEnding: true, endingType: "hidden",
    unlockCondition: "全部6条支线通关解锁",
  },
];

/** v5：获取所有支线关卡 */
export function getBranchStages(): FBStoryStage[] {
  return STORY_STAGES.filter((s) => s.isBranch);
}

/** v5：获取隐藏结局关卡 */
export function getHiddenEndingStages(): FBStoryStage[] {
  return STORY_STAGES.filter((s) => s.isHiddenEnding);
}

/** 获取指定关卡 */
export function getStoryStage(idx: number): FBStoryStage | undefined {
  return STORY_STAGES.find((s) => s.idx === idx);
}

/** 根据题目 ID 列表从全题库查找题目（剧情模式用） */
export function pickQuestionsByIds(allQuestions: FBQuestion[], ids: string[]): FBQuestion[] {
  const map = new Map(allQuestions.map((q) => [q.id, q]));
  return ids.map((id) => map.get(id)).filter((q): q is FBQuestion => !!q);
}

// ============ v3 升级：每日挑战题库种子 ============
/**
 * 每日挑战：基于日期 key 稳定哈希选取 10 题。
 * 同一日期全网玩家拿到相同题目，便于排行榜对比。
 * 算法：dateKey hash → 起始偏移 → 按固定步长循环取 10 题。
 */
export function pickDailyQuestions(allQuestions: FBQuestion[], dateKey: string, count = 10): FBQuestion[] {
  if (allQuestions.length === 0) return [];
  // 稳定哈希 dateKey → 数值
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  // 起始偏移 + 步长，保证分布
  const start = hash % allQuestions.length;
  // 步长与 allQuestions.length 互质可保证不重复（取质数）
  const step = 7;
  const result: FBQuestion[] = [];
  const seen = new Set<string>();
  let idx = start;
  while (result.length < count && seen.size < allQuestions.length) {
    const q = allQuestions[idx % allQuestions.length];
    if (!seen.has(q.id)) {
      seen.add(q.id);
      result.push(q);
    }
    idx = (idx + step) % allQuestions.length;
  }
  return result;
}

/** 生成每日挑战日期 key（YYYY-MM-DD） */
export function dailyKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ============ v3 升级：游戏模式中文名/图标/提示 ============

export const FB_MODE_LABELS: Record<FBGameMode, string> = {
  endless: "无尽模式",
  story: "剧情战役",
  speedrun: "极速闯关",
  hardcore: "硬核生存",
  daily: "每日挑战",
  review: "错题噩梦",
  aiBattle: "AI 对战",
  versus: "双人对战",
  deconstruct: "骗局拆解",
};

export const FB_MODE_ICONS: Record<FBGameMode, string> = {
  endless: "🌊",
  story: "📖",
  speedrun: "⚡",
  hardcore: "💀",
  daily: "📅",
  review: "📝",
  aiBattle: "🤖",
  versus: "⚔️",
  deconstruct: "🔬",
};

export const FB_MODE_DESCRIPTIONS: Record<FBGameMode, string> = {
  endless: "经典模式，波次无尽，难度递增。坚持到第 60 波成为反诈王者。",
  story: "6 关线性剧本，每关固定题组+最终Boss战。剧情通关解锁成就。",
  speedrun: "30 题 / 5 分钟，按正确率+剩余时间排名。极限手速挑战。",
  hardcore: "1 点体力、无道具、答错即终局。最高连对记录你的硬核实力。",
  daily: "每日 10 题，全网同一份。建立你的每日反诈习惯。",
  review: "基于历史错题生成 20 题强化训练，专攻薄弱环节。",
  aiBattle: "与 AI 骗子多轮对话识破，识别关键红旗。沉浸式反诈对抗。",
  versus: "同设备双人轮流答题，答对攻击对方血量。亲子/师生/情侣反诈教育。",
  deconstruct: "观看完整骗子剧本，逐句拆解话术目的与心理手法。反向强化识诈能力。",
};

export const FB_MODE_HINTS: Record<FBGameMode, string | null> = {
  endless: null,
  story: "通关所需最低正确数：4/5 题",
  speedrun: "30 题 · 5 分钟 · 限时闯关",
  hardcore: "⚠ 答错即终局 · 无道具 · 1 点体力",
  daily: "每日 10 题 · 全网同一份",
  review: "错题强化训练 · 清除 20 题",
  aiBattle: "🤖 多轮对话 · 识破红旗 · 限时对抗",
  versus: "⚔️ 双人轮流 · 答对攻击 · HP 先归零者负",
  deconstruct: "🔬 逐句拆解 · 识别话术 · 学习反诈",
};

/** 极速模式：总题数与时长（秒） */
export const SPEEDRUN_CONFIG = { totalQuestions: 30, durationSec: 300 };

/** 每日挑战：题数 */
export const DAILY_CONFIG = { totalQuestions: 10 };

/** 错题噩梦：题数 */
export const REVIEW_NIGHTMARE_CONFIG = { totalQuestions: 20 };

// ============ v3 升级：战报分享铭言池 ============

/** 战报分享卡随机铭言（结算页分享时随机选一条） */
export const BATTLE_REPORT_MOTTOS: string[] = [
  "反诈不是游戏，是必修课。",
  "识破一次诈骗，守护一个家庭。",
  "你的警惕，是骗子最怕的武器。",
  "不轻信、不转账、不透露。",
  "96110，反诈专线记心间。",
  "AI 可换脸，警惕不能换。",
  "保本与高收益不可兼得。",
  "止损才是赢家，已损失的钱追不回。",
  "公检法不电话办案，无安全账户。",
  "回拨原号码，核实最可靠。",
  "视频不是身份证明，转账必须二次核实。",
  "脱离平台交易无担保，加微信转账=诈骗。",
  "租卡跑分=帮信罪，最高判3年。",
  "正规招聘不收任何费用。",
  "换汇只走银行，私下换汇=诈骗+洗钱。",
];

// ============ v4 升级：每日任务系统 ============

/**
 * 每日任务池：每天从中稳定哈希选取 3 个任务。
 * 任务类型覆盖识破数/连击/类型/道具/模式通关/Boss击破。
 */
export const DAILY_TASK_POOL: FBDailyTask[] = [
  { id: "DT-BUST5", name: "识破5起诈骗", desc: "本日识破5起诈骗", icon: "🎯", type: "bustCount", target: 5, rewardScore: 200, rewardExp: 50 },
  { id: "DT-BUST10", name: "识破10起诈骗", desc: "本日识破10起诈骗", icon: "💯", type: "bustCount", target: 10, rewardScore: 500, rewardExp: 100 },
  { id: "DT-COMBO5", name: "5连击", desc: "达成5连击", icon: "⚡", type: "combo", target: 5, rewardScore: 150, rewardExp: 40 },
  { id: "DT-COMBO10", name: "10连击", desc: "达成10连击", icon: "🔥", type: "combo", target: 10, rewardScore: 300, rewardExp: 80 },
  { id: "DT-BUST-PIG", name: "识破杀猪盘", desc: "识破1起杀猪盘", icon: "🐷", type: "bustType", target: 1, params: { typeId: "F02" }, rewardScore: 200, rewardExp: 50 },
  { id: "DT-BUST-AI", name: "识破AI诈骗", desc: "识破1起AI换脸/拟声诈骗", icon: "🤖", type: "bustType", target: 1, params: { typeId: "F78" }, rewardScore: 250, rewardExp: 60 },
  { id: "DT-BUST-BRUSH", name: "识破刷单", desc: "识破1起刷单诈骗", icon: "💰", type: "bustType", target: 1, params: { typeId: "F03" }, rewardScore: 200, rewardExp: 50 },
  { id: "DT-ITEM3", name: "使用3次道具", desc: "本日使用3次道具", icon: "🧰", type: "useItem", target: 3, rewardScore: 150, rewardExp: 40 },
  { id: "DT-BOSS1", name: "击败1个Boss", desc: "本日击败1个诈骗首脑", icon: "🗡️", type: "bossDefeat", target: 1, rewardScore: 400, rewardExp: 100 },
  { id: "DT-CLEAR-DAILY", name: "完成每日挑战", desc: "完成1次每日挑战模式", icon: "📅", type: "clearMode", target: 1, params: { mode: "daily" }, rewardScore: 300, rewardExp: 80 },
  { id: "DT-CLEAR-HARDCORE", name: "硬核生存5题", desc: "硬核模式答对5题", icon: "💀", type: "clearMode", target: 5, params: { mode: "hardcore" }, rewardScore: 500, rewardExp: 120 },
  { id: "DT-BUST-DEEPFAKE", name: "识破实时换脸", desc: "识破1起AI实时换脸", icon: "🎬", type: "bustType", target: 1, params: { typeId: "F45" }, rewardScore: 300, rewardExp: 70 },
];

/** 根据日期 key 稳定选取 3 个每日任务 */
export function pickDailyTasks(dateKey: string, count = 3): FBDailyTask[] {
  if (DAILY_TASK_POOL.length === 0) return [];
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const result: FBDailyTask[] = [];
  const seen = new Set<number>();
  let idx = hash % DAILY_TASK_POOL.length;
  while (result.length < count && seen.size < DAILY_TASK_POOL.length) {
    const task = DAILY_TASK_POOL[idx % DAILY_TASK_POOL.length];
    if (!seen.has(idx % DAILY_TASK_POOL.length)) {
      seen.add(idx % DAILY_TASK_POOL.length);
      result.push(task);
    }
    idx = (idx + 7) % DAILY_TASK_POOL.length;
  }
  return result;
}

// ============ v4 升级：节日活动关卡 ============

/**
 * 节日活动：按月份限时开放，独立题组+限定奖励。
 * 每个活动关联一个季节，开放月份内可挑战。
 */
export const SEASONAL_EVENTS: FBSeasonalEvent[] = [
  {
    id: "SE-SPRING", name: "春节反诈守岁战", icon: "🧧", season: "springFestival",
    activeMonths: [1, 2],
    intro: "春节红包季，骗子也来\"拜年\"。识破春运退票、红包钓鱼、冒充客服等春节高发诈骗！",
    outro: "恭喜守岁成功！你的春节反诈战绩已记录。",
    questionIds: ["F89-001", "F89-002", "F89-005", "F90-001", "F79-001", "F04-001", "C01-003", "C01-006"],
    passCorrect: 5, themeColor: "#FF3B6B", rewardExp: 200, rewardAchievementId: "se_spring",
  },
  {
    id: "SE-DOUBLE11", name: "双11反诈购物节", icon: "🛒", season: "double11",
    activeMonths: [10, 11],
    intro: "双11购物狂欢，骗子也在\"冲业绩\"。识破虚假理赔、直播带货、二手平台等购物诈骗！",
    outro: "购物节反诈通关！你的钱包安全了。",
    questionIds: ["F83-001", "F46-001", "F46-002", "F47-001", "F47-002", "F04-002", "C01-005", "E01-008"],
    passCorrect: 5, themeColor: "#FF7A1A", rewardExp: 200, rewardAchievementId: "se_double11",
  },
  {
    id: "SE-SCHOOL", name: "开学季反诈第一课", icon: "🎓", season: "schoolOpen",
    activeMonths: [8, 9],
    intro: "开学季，学生群体高发诈骗齐上阵。识破代练盗号、未成年人打赏、虚假招聘、培训贷！",
    outro: "开学季反诈第一课通关！守护好自己的零花钱。",
    questionIds: ["F86-001", "F49-001", "F49-002", "F50-001", "F50-002", "F96-004", "C01-007", "E01-006"],
    passCorrect: 5, themeColor: "#52C41A", rewardExp: 200, rewardAchievementId: "se_school",
  },
  {
    id: "SE-SUMMER", name: "暑期反诈训练营", icon: "🏖", season: "summerJob",
    activeMonths: [6, 7, 8],
    intro: "暑期兼职季，刷单、培训贷、跑分洗钱高发。识破暑期学生群体高发诈骗！",
    outro: "暑期训练营毕业！你的反诈技能提升了。",
    questionIds: ["F84-001", "F03-001", "F50-001", "F48-001", "F48-002", "C01-010", "E01-003", "B06-001"],
    passCorrect: 5, themeColor: "#00E5FF", rewardExp: 200, rewardAchievementId: "se_summer",
  },
  {
    id: "SE-YEAREND", name: "年终反诈理财保卫战", icon: "📊", season: "yearEnd",
    activeMonths: [12, 1],
    intro: "年终理财季，保本高收益、养老金钓鱼、虚假理财高发。守护好你的年终奖！",
    outro: "年终理财保卫战胜利！你的财富安全了。",
    questionIds: ["F85-001", "F95-001", "F95-002", "F88-001", "F02-002", "C01-009", "C01-006", "B01-001"],
    passCorrect: 5, themeColor: "#FFD666", rewardExp: 200, rewardAchievementId: "se_yearend",
  },
];

/** 获取当前月份开放的节日活动列表 */
export function activeSeasonalEvents(date = new Date()): FBSeasonalEvent[] {
  const m = date.getMonth() + 1;
  return SEASONAL_EVENTS.filter((e) => e.activeMonths.includes(m));
}

/** 根据 ID 查询节日活动 */
export function getSeasonalEvent(id: string): FBSeasonalEvent | undefined {
  return SEASONAL_EVENTS.find((e) => e.id === id);
}

// ============ v4 升级：本地排行榜（无后端，NPC 模拟） ============

/**
 * 本地排行榜 NPC 假数据：预置 15 个 NPC，营造竞争氛围。
 * 玩家分数插入后按分数排序，NPC 分数固定（不随时间变化）。
 * NPC 名字使用反诈主题化命名，避免真实人名。
 */
export const LOCAL_RANK_NPC: Omit<FBLocalRankEntry, "rank">[] = [
  { name: "反诈先锋·李探长", isPlayer: false, score: 58200, rankName: "反诈宗师", rankIcon: "🌟", gameMode: "endless", date: "2026-07-25", perfect: true },
  { name: "识诈达人·王警官", isPlayer: false, score: 52100, rankName: "反诈大师", rankIcon: "👑", gameMode: "endless", date: "2026-07-24", perfect: false },
  { name: "反诈尖兵·张同学", isPlayer: false, score: 47800, rankName: "反诈大师", rankIcon: "👑", gameMode: "speedrun", date: "2026-07-26", perfect: false },
  { name: "反诈精英·陈师傅", isPlayer: false, score: 42500, rankName: "反诈专家", rankIcon: "🏅", gameMode: "endless", date: "2026-07-23", perfect: false },
  { name: "反诈老兵·刘大爷", isPlayer: false, score: 38900, rankName: "反诈专家", rankIcon: "🏅", gameMode: "endless", date: "2026-07-22", perfect: false },
  { name: "识诈高手·赵阿姨", isPlayer: false, score: 34200, rankName: "反诈精英", rankIcon: "🎖️", gameMode: "daily", date: "2026-07-26", perfect: false },
  { name: "反诈新兵·小明", isPlayer: false, score: 28500, rankName: "反诈精英", rankIcon: "🎖️", gameMode: "endless", date: "2026-07-25", perfect: false },
  { name: "反诈战士·大壮", isPlayer: false, score: 23800, rankName: "反诈尖兵", rankIcon: "⚔️", gameMode: "hardcore", date: "2026-07-24", perfect: false },
  { name: "识诈能手·小红", isPlayer: false, score: 19200, rankName: "反诈尖兵", rankIcon: "⚔️", gameMode: "endless", date: "2026-07-23", perfect: false },
  { name: "反诈学徒·阿强", isPlayer: false, score: 15600, rankName: "反诈新兵", rankIcon: "🛡️", gameMode: "endless", date: "2026-07-22", perfect: false },
  { name: "反诈新人·小李", isPlayer: false, score: 12300, rankName: "反诈新兵", rankIcon: "🛡️", gameMode: "daily", date: "2026-07-26", perfect: false },
  { name: "识诈学徒·小王", isPlayer: false, score: 9800, rankName: "见习", rankIcon: "🔰", gameMode: "endless", date: "2026-07-21", perfect: false },
  { name: "反诈萌新·小张", isPlayer: false, score: 6500, rankName: "见习", rankIcon: "🔰", gameMode: "endless", date: "2026-07-20", perfect: false },
  { name: "识诈新人·小陈", isPlayer: false, score: 4200, rankName: "学徒", rankIcon: "📘", gameMode: "endless", date: "2026-07-19", perfect: false },
  { name: "反诈小白·小赵", isPlayer: false, score: 2800, rankName: "学徒", rankIcon: "📘", gameMode: "endless", date: "2026-07-18", perfect: false },
];

/** 生成本地排行榜（NPC + 玩家自己，按分数降序，取前 20） */
export function buildLocalRank(playerEntry: Omit<FBLocalRankEntry, "rank">): FBLocalRankEntry[] {
  const all = [...LOCAL_RANK_NPC, playerEntry];
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, 20).map((e, i) => ({ ...e, rank: i + 1 }));
}

// ============ v4 升级：反诈工具箱 ============

/**
 * 反诈工具箱：账号自查/举报指引/紧急止付/反诈专线/官方核实渠道。
 * 玩家可在主界面随时查阅，强化实战应对能力。
 */
export const FRAUD_TOOLBOX: FBFraudToolItem[] = [
  {
    id: "TOOL-SELFCHECK", name: "账号安全自查", icon: "🔍", type: "selfCheck",
    desc: "怀疑账号泄露？按清单逐项自查。",
    steps: [
      "检查微信/QQ/支付宝/银行APP登录设备，移除陌生设备",
      "修改核心账号密码（微信/支付宝/银行/邮箱）",
      "开启二次验证（短信/人脸/指纹）",
      "检查银行卡余额与流水，发现异常立即冻结",
      "检查手机是否安装陌生APP，卸载可疑应用",
      "检查短信验证码是否被拦截，联系运营商开通防拦截",
    ],
    contact: "各平台官方客服",
    applicableScenes: ["账号疑似泄露", "收到陌生验证码", "手机丢失后"],
  },
  {
    id: "TOOL-REPORT", name: "诈骗举报指引", icon: "📢", type: "report",
    desc: "遭遇诈骗如何正确举报？",
    steps: [
      "保留所有证据：聊天记录/转账记录/对方账号/电话号码",
      "拨打 96110 反诈专线举报",
      "到就近派出所报案，提交证据材料",
      "在\"国家反诈中心\"APP内举报涉案APP/网址/电话",
      "向涉案平台举报对方账号（微信/QQ/银行等）",
      "如涉及银行卡，立即联系银行冻结对方账户",
    ],
    contact: "96110 / 110",
    applicableScenes: ["遭遇诈骗", "发现诈骗线索", "可疑电话/短信"],
  },
  {
    id: "TOOL-EMERGENCY", name: "紧急止付流程", icon: "🚨", type: "emergency",
    desc: "已转账？黄金10分钟止付指南。",
    steps: [
      "立即联系转账银行客服，申请紧急冻结对方账户（黄金10分钟）",
      "拨打 96110 反诈专线，提供对方账户信息",
      "立即到就近派出所报案，提交转账凭证",
      "在\"国家反诈中心\"APP举报，触发反诈拦截",
      "如通过支付宝/微信转账，立即在平台申诉冻结",
      "保留所有证据，配合警方调查",
    ],
    contact: "96110 / 银行客服 / 110",
    applicableScenes: ["已转账", "已泄露银行卡", "已泄露验证码"],
  },
  {
    id: "TOOL-HOTLINE", name: "反诈专线速查", icon: "📞", type: "hotline",
    desc: "记住这些电话，关键时刻能救急。",
    steps: [
      "96110 —— 国家反诈中心专线（反诈咨询/举报/预警）",
      "110 —— 报警电话（紧急情况/已转账）",
      "12321 —— 网络不良与垃圾信息举报中心",
      "12381 —— 涉诈预警劝阻短信系统",
      "95588 / 95533 等 —— 各银行官方客服（冻结账户）",
      "95188 —— 支付宝官方客服",
    ],
    contact: "96110 / 110",
    applicableScenes: ["怀疑诈骗", "已遭遇诈骗", "反诈咨询"],
  },
  {
    id: "TOOL-VERIFY", name: "官方核实渠道", icon: "✅", type: "verify",
    desc: "不确定是否诈骗？走官方渠道核实。",
    steps: [
      "公检法相关：挂断后拨打 96110 或到就近派出所核实",
      "银行/支付相关：登录官方APP或拨打官方客服核实",
      "电商/快递相关：登录购物APP核实订单与物流",
      "12306/航班相关：登录12306/航司官方APP核实",
      "DeepSeek/AI相关：登录官方域名 deepseek.com 核实",
      "熟人/领导相关：换号+电话核实，不轻信单一渠道",
    ],
    contact: "各平台官方APP/客服",
    applicableScenes: ["收到可疑电话", "收到可疑短信", "收到可疑链接"],
  },
];

/** 根据 ID 查询工具箱条目 */
export function getFraudTool(id: string): FBFraudToolItem | undefined {
  return FRAUD_TOOLBOX.find((t) => t.id === id);
}

// ============ v4 升级：96110 通话剧本扩充 ============
/**
 * 补充 v2/v4 新增诈骗类型的 96110 剧本，覆盖 F88-F96 + F45-F52。
 * 每个剧本强化"挂断→96110核实"的肌肉记忆。
 */
export const HOTLINE_SCRIPTS_V4: FBHotlineScript[] = [
  {
    id: "HL-SECONDHAND", title: "怀疑遭遇二手平台诈骗",
    scenario: "闲鱼卖手机时\"客服\"称买家付款冻结，需缴纳2000元解冻保证金。",
    typeId: "F47", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"客服\"是怎么联系您的？",
        choices: [
          { text: "闲鱼私信发的消息", next: "s2", verdict: "warn", feedback: "闲鱼客服只在APP内沟通，私信可能是冒充。" },
          { text: "已经转账2000元保证金", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没转账，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "闲鱼客服只在APP内沟通，不收任何保证金/解冻金。请登录闲鱼APP核实订单状态。",
        choices: [
          { text: "登录闲鱼APP核实", next: null, verdict: "right", ending: "verified", feedback: "正确！闲鱼客服只在APP内，任何保证金都是诈骗。" },
          { text: "按客服指引转账保证金", next: null, verdict: "wrong", ending: "scam", feedback: "错误！任何保证金/解冻金都是诈骗，转账后被拉黑。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天/转账记录作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "闲鱼客服只在APP内沟通",
      "任何保证金/解冻金都是诈骗",
      "订单状态只在官方APP查看",
    ],
  },
  {
    id: "HL-DEEPFAKE-REALTIME", title: "怀疑遭遇AI实时换脸",
    scenario: "视频通话中\"领导\"急令代转账5万元，画面逼真但眨眼偏少。",
    typeId: "F45", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方是怎么联系您的？",
        choices: [
          { text: "视频通话，画面是领导", next: "s2", verdict: "right", feedback: "AI实时换脸可伪造视频通话。" },
          { text: "已转账5万元", next: "s3", verdict: "warn", feedback: "请立即报警并联系银行止付。" },
          { text: "挂断了来核实", next: "s2", verdict: "right", feedback: "正确！挂断核实是关键防线。" },
        ],
      },
      {
        id: "s2",
        operator: "AI实时换脸可伪造视频通话。请用通讯录原号码电话核实，切勿直接转账。",
        choices: [
          { text: "用通讯录原号码核实", next: null, verdict: "right", ending: "verified", feedback: "正确！原号码核实是铁律。" },
          { text: "视频里是本人放心转", next: null, verdict: "wrong", ending: "scam", feedback: "错误！AI换脸可伪造视频，必须二次电话核实。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系银行申请紧急止付，并到就近派出所报案。AI诈骗追赃难度大，止损优先。",
        choices: [
          { text: "好的，我立即止付报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止付+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "AI实时换脸可伪造视频通话",
      "用通讯录原号码电话核实是铁律",
      "眨眼频率低/画面卡顿是破绽",
    ],
  },
  {
    id: "HL-FAKE-JOB", title: "怀疑遭遇虚假招聘/培训贷",
    scenario: "面试通过后公司要求交1980元培训费，或协助办理19800元培训贷。",
    typeId: "F50", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下公司要求您做什么？",
        choices: [
          { text: "先交1980元培训费", next: "s2", verdict: "right", feedback: "正规招聘不收任何费用。" },
          { text: "办19800元培训贷", next: "s2", verdict: "right", feedback: "培训贷是新型招聘诈骗。" },
          { text: "已交费/办贷", next: "s3", verdict: "warn", feedback: "请立即报警并向劳动监察投诉。" },
        ],
      },
      {
        id: "s2",
        operator: "正规招聘不收培训费/服装费/押金/工本费，不要求办贷。请拒绝并核实公司营业执照。",
        choices: [
          { text: "拒绝交费，核实公司资质", next: null, verdict: "right", ending: "verified", feedback: "正确！正规招聘不收费不办贷。" },
          { text: "交费入职博高薪", next: null, verdict: "wrong", ending: "scam", feedback: "错误！先交费=诈骗，交费后公司跑路。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即报警并向劳动监察部门投诉，保留合同/转账记录作为证据。如已办贷，联系银保监会投诉。",
        choices: [
          { text: "好的，我立即报警投诉", next: null, verdict: "right", ending: "verified", feedback: "正确！报警+劳动监察+银保监会投诉。" },
        ],
      },
    ],
    takeaways: [
      "正规招聘不收任何费用",
      "培训贷是新型招聘诈骗",
      "已交费立即报警+劳动监察投诉",
    ],
  },
  {
    id: "HL-LAUNDERING", title: "怀疑遭遇跑分洗钱招募",
    scenario: "群里\"租卡日500\"招募，要求提供银行卡号密码参与资金过账。",
    typeId: "F48", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方招募的内容？",
        choices: [
          { text: "租银行卡日入500", next: "s2", verdict: "right", feedback: "出租银行卡跑分=帮信罪。" },
          { text: "帮转账抽成5%", next: "s2", verdict: "right", feedback: "帮转账走账=洗钱罪。" },
          { text: "已提供银行卡号密码", next: "s3", verdict: "warn", feedback: "请立即冻结银行卡并报警。" },
        ],
      },
      {
        id: "s2",
        operator: "出租银行卡/帮转账走账=跑分洗钱，涉嫌帮信罪（最高3年）或洗钱罪（最高7年）。请立即拒绝。",
        choices: [
          { text: "拒绝参与，退群", next: null, verdict: "right", ending: "verified", feedback: "正确！跑分洗钱涉嫌犯罪，拒绝是唯一正确做法。" },
          { text: "试试看赚外快", next: null, verdict: "wrong", ending: "scam", feedback: "错误！跑分洗钱涉嫌刑事犯罪，征信受损终身。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系银行冻结银行卡，并到就近派出所报案说明情况。主动配合调查可减轻责任。",
        choices: [
          { text: "好的，我立即冻结报警", next: null, verdict: "right", ending: "verified", feedback: "正确！冻结+报警+配合调查。" },
        ],
      },
    ],
    takeaways: [
      "出租银行卡=帮信罪最高判3年",
      "帮转账走账=洗钱罪最高判7年",
      "已参与立即冻结+报警+配合调查",
    ],
  },
  {
    id: "HL-REFUND", title: "怀疑遭遇冒充客服退款",
    scenario: "自称淘宝客服称商品质量问题需退款理赔，要求共享屏幕操作。",
    typeId: "F04", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"客服\"是怎么引导您操作的？",
        choices: [
          { text: "要求下载会议APP共享屏幕", next: "s2", verdict: "right", feedback: "共享屏幕=诈骗标准动作。" },
          { text: "已共享屏幕并输入验证码", next: "s3", verdict: "warn", feedback: "请立即停止共享并报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "正规退款只原路退回支付账户，不要求共享屏幕、不下载APP、不验证流水。请通过淘宝官方APP核实订单。",
        choices: [
          { text: "挂断，登录淘宝官方APP核实", next: null, verdict: "right", ending: "verified", feedback: "正确！官方APP核实是唯一可信渠道。" },
          { text: "按客服指引共享屏幕理赔", next: null, verdict: "wrong", ending: "scam", feedback: "错误！共享屏幕会泄露密码验证码，资金秒被盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即关闭共享屏幕，联系银行冻结账户，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即报警止付", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "正规退款只原路退回支付账户",
      "共享屏幕=诈骗，不下载会议APP",
      "挂断→96110核实→官方渠道核实",
    ],
  },
  {
    id: "HL-INVEST", title: "怀疑遭遇虚假投资理财",
    scenario: "微信群里\"导师\"荐股，引导下载非正规APP投资。",
    typeId: "F05", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"导师\"是怎么引导您投资的？",
        choices: [
          { text: "下载非正规APP，群内晒单日入过万", next: "s2", verdict: "right", feedback: "晒单都是托，非正规APP=诈骗。" },
          { text: "已充值5万元无法提现", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没充值，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "任何非正规平台投资都是诈骗，群内晒单动辄日入过万都是托。投资认准持牌金融机构。",
        choices: [
          { text: "卸载APP，退群举报", next: null, verdict: "right", ending: "verified", feedback: "正确！非正规平台投资=诈骗。" },
          { text: "再投10万凑够VIP提现", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"凑够才能提现\"是典型连环套，越投越多。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天记录、转账凭证、APP截图作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "非正规平台投资=诈骗",
      "群内晒单日入过万都是托",
      "投资认准持牌金融机构",
    ],
  },
  {
    id: "HL-BOSS", title: "怀疑遭遇冒充熟人/领导",
    scenario: "领导换号加微信，称开会不方便接电话，急令代转5万元。",
    typeId: "F06", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"领导\"是怎么联系您的？",
        choices: [
          { text: "换新微信号加好友，称开会不便接电话", next: "s2", verdict: "right", feedback: "换号+不接电话=冒充典型特征。" },
          { text: "已转账5万元", next: "s3", verdict: "warn", feedback: "请立即报警并联系银行止付。" },
          { text: "要求电话核实被拒", next: "s2", verdict: "right", feedback: "正确！电话核实是关键防线。" },
        ],
      },
      {
        id: "s2",
        operator: "换号加微信+不接电话+急令转账=冒充领导典型话术。请用通讯录原号码电话核实。",
        choices: [
          { text: "用通讯录原号码电话核实", next: null, verdict: "right", ending: "verified", feedback: "正确！原号码核实是铁律。" },
          { text: "领导说急事立即转", next: null, verdict: "wrong", ending: "scam", feedback: "错误！越急越要核实，急令转账=诈骗。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留微信聊天记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警止付", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "换号+不接电话=冒充典型话术",
      "急令转账务必电话核实原号码",
      "转账前面对面或电话二次确认",
    ],
  },
  {
    id: "HL-CREDIT", title: "怀疑遭遇注销校园贷/征信修复",
    scenario: "自称银监会工作人员称校园贷未注销影响征信。",
    typeId: "F07", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方是怎么引导您操作的？",
        choices: [
          { text: "自称银监会，要求转账到安全账户注销", next: "s2", verdict: "right", feedback: "银监会不会要求转账注销。" },
          { text: "已转账3万元注销贷款", next: "s3", verdict: "warn", feedback: "请立即报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "银监会不会电话要求注销校园贷，更不会要求转账到\"安全账户\"。征信只能通过央行征信中心官方渠道查询修复。",
        choices: [
          { text: "挂断，登录央行征信中心官网核实", next: null, verdict: "right", ending: "verified", feedback: "正确！征信只认央行官方渠道。" },
          { text: "按对方指引转账注销", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"安全账户\"=诈骗账户，转账即失。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留通话记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "银监会不电话要求注销校园贷",
      "征信修复只走央行官方渠道",
      "任何\"安全账户\"都是诈骗",
    ],
  },
  {
    id: "HL-DCEP", title: "怀疑遭遇数字人民币钓鱼",
    scenario: "群里发数字人民币红包兑换码，扫码跳转非官方页面。",
    typeId: "F79", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下红包兑换码是怎么出现的？",
        choices: [
          { text: "群里扫码跳转非官方页面要求输密码", next: "s2", verdict: "right", feedback: "非官方页面=钓鱼。" },
          { text: "已输入密码和验证码", next: "s3", verdict: "warn", feedback: "请立即冻结账户并报警。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "数字人民币红包只在官方APP内领取，兑换码不通过链接发放。任何要求输密码验证码的页面都是钓鱼。",
        choices: [
          { text: "关闭页面，登录数字人民币官方APP", next: null, verdict: "right", ending: "verified", feedback: "正确！数字人民币只走官方APP。" },
          { text: "扫码领红包输密码", next: null, verdict: "wrong", ending: "scam", feedback: "错误！陌生链接输密码=钱包被盗。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系银行冻结账户，登录数字人民币官方APP修改密码，并到就近派出所报案。",
        choices: [
          { text: "好的，我立即冻结报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "数字人民币红包只在官方APP内领取",
      "兑换码不通过链接发放",
      "任何要求输密码的页面都是钓鱼",
    ],
  },
  {
    id: "HL-SHORT-PIG", title: "怀疑遭遇短视频平台杀猪盘",
    scenario: "小红书私信推荐理财导师，群内晒单日入过万。",
    typeId: "F80", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"理财导师\"是怎么联系您的？",
        choices: [
          { text: "短视频私信推荐，群内晒单日入过万", next: "s2", verdict: "right", feedback: "短视频引流=杀猪盘新变种。" },
          { text: "已下载APP并充值", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "短视频平台私信推荐\"理财导师\"是杀猪盘新引流，群内晒单都是托。任何非正规平台投资都是诈骗。",
        choices: [
          { text: "拉黑举报，不下载陌生APP", next: null, verdict: "right", ending: "verified", feedback: "正确！短视频理财引流=杀猪盘。" },
          { text: "试试看投1万赚回再撤", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"先小赚再大亏\"是杀猪盘经典套路。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留私信、群聊、转账记录、APP截图作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "短视频私信理财引流=杀猪盘",
      "群内晒单日入过万都是托",
      "不下载陌生APP，投资认准持牌机构",
    ],
  },
  {
    id: "HL-AI-SERVICE", title: "怀疑遭遇AI客服仿声诈骗",
    scenario: "自称支付宝客服称花呗异常，声音像官方录音。",
    typeId: "F81", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"客服\"是怎么引导您操作的？",
        choices: [
          { text: "声音像官方录音，要求处理花呗异常", next: "s2", verdict: "right", feedback: "AI可仿造官方客服声音。" },
          { text: "已按指引输入验证码", next: "s3", verdict: "warn", feedback: "请立即冻结账户并报警止付。" },
          { text: "挂断来核实", next: "s2", verdict: "right", feedback: "正确！挂断核实是关键。" },
        ],
      },
      {
        id: "s2",
        operator: "AI可仿造支付宝/银行/快递客服声音，官方客服不会索要密码验证码，不会要求共享屏幕。请挂断后拨打95188核实。",
        choices: [
          { text: "挂断，拨打95188核实", next: null, verdict: "right", ending: "verified", feedback: "正确！挂断回拨官方号码是铁律。" },
          { text: "声音是官方的处理一下", next: null, verdict: "wrong", ending: "scam", feedback: "错误！AI可仿造官方声音，必须回拨核实。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系支付宝/银行冻结账户，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即冻结报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "AI可仿造官方客服声音",
      "官方客服不索要密码验证码",
      "挂断回拨95188/95588等官方号码核实",
    ],
  },
  {
    id: "HL-DOUBLE11", title: "怀疑遭遇双11虚假快递理赔",
    scenario: "双11快递丢失双倍赔偿，要求下载会议APP共享屏幕。",
    typeId: "F83", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"快递理赔\"是怎么引导您操作的？",
        choices: [
          { text: "称快递丢失双倍赔偿，要求共享屏幕", next: "s2", verdict: "right", feedback: "理赔+共享屏幕=诈骗。" },
          { text: "已共享屏幕并付款", next: "s3", verdict: "warn", feedback: "请立即停止共享并报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "快递理赔只通过官方渠道原路退回，不要求下载会议APP、不共享屏幕、不验证流水。请登录购物APP核实物流。",
        choices: [
          { text: "挂断，登录购物APP核实物流", next: null, verdict: "right", ending: "verified", feedback: "正确！官方APP核实是唯一可信渠道。" },
          { text: "按客服指引共享屏幕理赔", next: null, verdict: "wrong", ending: "scam", feedback: "错误！共享屏幕会泄露验证码，资金秒被盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即关闭共享屏幕，联系银行冻结账户，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即报警止付", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "快递理赔只通过官方渠道原路退回",
      "理赔+共享屏幕=诈骗",
      "购物APP核实物流是唯一可信渠道",
    ],
  },
  {
    id: "HL-YEAREND", title: "怀疑遭遇年终虚假理财",
    scenario: "年终限享内部理财年化18%保本保息最后10名额。",
    typeId: "F85", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"内部理财\"是怎么推销的？",
        choices: [
          { text: "年终限享年化18%保本保息最后10名额", next: "s2", verdict: "right", feedback: "保本保息+高收益=诈骗。" },
          { text: "已转账认购10万元", next: "s3", verdict: "warn", feedback: "请立即报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "任何承诺保本保息且年化超8%的理财都是诈骗，\"内部名额\"\"限享\"是饥饿营销话术。投资认准持牌金融机构。",
        choices: [
          { text: "拒绝认购，举报拉黑", next: null, verdict: "right", ending: "verified", feedback: "正确！保本保息+高收益=诈骗。" },
          { text: "抢最后名额认购", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"最后名额\"是饥饿营销，转账即失。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天记录、转账凭证、宣传截图作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "保本保息+年化超8%=诈骗",
      "\"内部名额\"\"限享\"是饥饿营销话术",
      "投资认准持牌金融机构",
    ],
  },
  {
    id: "HL-SCHOOL-FEE", title: "怀疑遭遇开学季冒充老师收费",
    scenario: "家长群班主任发消息收资料费298元扫码缴纳。",
    typeId: "F86", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"班主任\"是怎么收费的？",
        choices: [
          { text: "家长群发消息收资料费298元扫码", next: "s2", verdict: "right", feedback: "群内扫码收费=冒充典型。" },
          { text: "已扫码付款298元", next: "s3", verdict: "warn", feedback: "请立即报警并提醒群内其他家长。" },
          { text: "要求电话核实被拒", next: "s2", verdict: "right", feedback: "正确！电话核实是关键。" },
        ],
      },
      {
        id: "s2",
        operator: "学校收费不会通过家长群扫码收取，更不会要求私下转账。请电话联系班主任原号码核实。",
        choices: [
          { text: "电话联系班主任原号码核实", next: null, verdict: "right", ending: "verified", feedback: "正确！电话核实原号码是铁律。" },
          { text: "群里都交了我也交", next: null, verdict: "wrong", ending: "scam", feedback: "错误！群里\"都交了\"可能是托，务必电话核实。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，并在家长群提醒其他家长警惕，保留聊天记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警并提醒群内家长", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+提醒他人。" },
        ],
      },
    ],
    takeaways: [
      "学校收费不通过家长群扫码收取",
      "群内扫码收费=冒充典型话术",
      "电话联系班主任原号码核实",
    ],
  },
  {
    id: "HL-DEEPSEEK", title: "怀疑遭遇DeepSeek大模型仿冒客服",
    scenario: "自称DeepSeek客服称误开会员每月扣费，要求共享屏幕关闭。",
    typeId: "F87", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"DeepSeek客服\"是怎么引导您操作的？",
        choices: [
          { text: "称误开会员每月扣费，要求共享屏幕关闭", next: "s2", verdict: "right", feedback: "扣费+共享屏幕=诈骗。" },
          { text: "已共享屏幕并输入验证码", next: "s3", verdict: "warn", feedback: "请立即停止共享并报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "DeepSeek不会电话联系用户关闭会员，更不会要求共享屏幕。任何\"误开会员扣费\"都是诈骗话术。请通过官方APP或官网核实。",
        choices: [
          { text: "挂断，登录DeepSeek官方渠道核实", next: null, verdict: "right", ending: "verified", feedback: "正确！官方渠道核实是唯一可信方式。" },
          { text: "按客服指引共享屏幕关闭", next: null, verdict: "wrong", ending: "scam", feedback: "错误！共享屏幕会泄露密码验证码，资金秒被盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即关闭共享屏幕，联系银行冻结账户，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即报警止付", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "DeepSeek不会电话联系关闭会员",
      "\"误开会员扣费\"是诈骗话术",
      "共享屏幕=诈骗标准动作",
    ],
  },
  {
    id: "HL-USDT", title: "怀疑遭遇USDT虚拟币代挖诈骗",
    scenario: "网友推荐USDT代挖稳赚，提现需缴认证金。",
    typeId: "F88", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"代挖\"是怎么引导您操作的？",
        choices: [
          { text: "USDT代挖稳赚，提现需缴认证金", next: "s2", verdict: "right", feedback: "提现要认证金=诈骗。" },
          { text: "已缴认证金仍无法提现", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "国内虚拟币交易已全面禁止，任何USDT代挖稳赚都是诈骗，提现需缴认证金/解冻金是典型连环套。",
        choices: [
          { text: "拒绝缴金，卸载APP报警", next: null, verdict: "right", ending: "verified", feedback: "正确！提现要认证金=诈骗。" },
          { text: "再缴认证金试一次提现", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"再缴一次就能提\"是连环套，越缴越多。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天记录、转账凭证、APP截图作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "国内虚拟币交易已全面禁止",
      "USDT代挖稳赚=诈骗",
      "提现需缴认证金是典型连环套",
    ],
  },
  {
    id: "HL-FLIGHT", title: "怀疑遭遇航班改签钓鱼",
    scenario: "短信称航班取消改签领补偿金，点击链接填银行卡。",
    typeId: "F90", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"航班改签\"是怎么引导您操作的？",
        choices: [
          { text: "短信称航班取消，点链接领补偿金填卡", next: "s2", verdict: "right", feedback: "改签+补偿金+链接=钓鱼。" },
          { text: "已点击链接填写银行卡和验证码", next: "s3", verdict: "warn", feedback: "请立即冻结银行卡并报警。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "航班改签只通过航司官方APP或客服电话办理，不通过短信链接，补偿金不会要求填银行卡密码验证码。请拨打航司官方客服核实。",
        choices: [
          { text: "挂断，拨打航司官方客服核实", next: null, verdict: "right", ending: "verified", feedback: "正确！航司官方客服是唯一可信渠道。" },
          { text: "点链接领补偿金填卡", next: null, verdict: "wrong", ending: "scam", feedback: "错误！链接是钓鱼页面，填卡即盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系银行冻结银行卡，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即冻结报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "航班改签只通过航司官方渠道办理",
      "短信链接领补偿金=钓鱼",
      "补偿金不会要求填银行卡密码验证码",
    ],
  },
  {
    id: "HL-NFT", title: "怀疑遭遇数字藏品NFT发售骗局",
    scenario: "数字藏品保本回购10倍收益，提现要交个税。",
    typeId: "F91", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"数字藏品\"是怎么推销的？",
        choices: [
          { text: "保本回购10倍收益，提现要交个税", next: "s2", verdict: "right", feedback: "保本回购+高收益=诈骗。" },
          { text: "已购藏品并交了\"个税\"", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "国内数字藏品禁止金融化、证券化，任何承诺保本回购、10倍收益的都是诈骗，提现要交个税/解冻金是连环套。",
        choices: [
          { text: "拒绝购买，举报平台", next: null, verdict: "right", ending: "verified", feedback: "正确！数字藏品保本回购=诈骗。" },
          { text: "抢购等10倍回购", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"保本回购\"是话术，转账即失。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留平台截图、聊天记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "国内数字藏品禁止金融化证券化",
      "保本回购+10倍收益=诈骗",
      "提现要交个税是典型连环套",
    ],
  },
  {
    id: "HL-PENSION", title: "怀疑遭遇AI养老金资格认证钓鱼",
    scenario: "自称社保局要求下载APP做人脸识别认证养老金。",
    typeId: "F95", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"社保局\"是怎么引导您操作的？",
        choices: [
          { text: "要求下载APP做人脸识别认证养老金", next: "s2", verdict: "right", feedback: "下载APP+人脸识别=钓鱼。" },
          { text: "已下载APP并完成人脸识别", next: "s3", verdict: "warn", feedback: "请立即卸载APP并报警。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "社保局不会要求下载非官方APP做人脸识别，养老金资格认证通过\"掌上12333\"或当地人社APP办理。任何陌生APP人脸识别都是钓鱼。",
        choices: [
          { text: "挂断，登录\"掌上12333\"核实", next: null, verdict: "right", ending: "verified", feedback: "正确！官方APP核实是唯一可信渠道。" },
          { text: "按对方指引下载APP认证", next: null, verdict: "wrong", ending: "scam", feedback: "错误！陌生APP会窃取人脸信息盗刷账户。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即卸载该APP，联系银行冻结关联账户，并到就近派出所报案。",
        choices: [
          { text: "好的，我立即卸载报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "社保局不要求下载非官方APP",
      "养老金认证通过\"掌上12333\"办理",
      "陌生APP人脸识别=钓鱼",
    ],
  },
  {
    id: "HL-LIVE-SHOP", title: "怀疑遭遇短视频直播带货诈骗",
    scenario: "直播间1元秒杀苹果手机，加微信私下交易。",
    typeId: "F46", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"秒杀\"是怎么引导您交易的？",
        choices: [
          { text: "1元秒杀苹果手机，加微信私下交易", next: "s2", verdict: "right", feedback: "私下交易=诈骗。" },
          { text: "已微信转账货款被拉黑", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "正规直播带货只在平台内下单付款，任何加微信私下交易都是诈骗，1元秒杀苹果手机明显低于市场价=话术。",
        choices: [
          { text: "拒绝私下交易，平台内下单", next: null, verdict: "right", ending: "verified", feedback: "正确！私下交易=诈骗。" },
          { text: "加微信转账抢秒杀", next: null, verdict: "wrong", ending: "scam", feedback: "错误！私下转账无平台保障，被骗后拉黑失联。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留直播间截图、微信聊天记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "正规直播带货只在平台内交易",
      "加微信私下交易=诈骗",
      "1元秒杀明显低于市场价=话术",
    ],
  },
  {
    id: "HL-MINOR-GAME", title: "怀疑遭遇未成年人网络打赏/游戏代练",
    scenario: "孩子拿家长手机给主播打赏，代练要账号密码。",
    typeId: "F49", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下孩子是怎么被引导的？",
        choices: [
          { text: "主播诱导打赏，代练要账号密码", next: "s2", verdict: "right", feedback: "索要账号密码=诈骗。" },
          { text: "已支付大额打赏/提供账号密码", next: "s3", verdict: "warn", feedback: "请立即冻结账户并报警。" },
          { text: "及时发现来核实", next: "s2", verdict: "right", feedback: "正确！及时发现是关键。" },
        ],
      },
      {
        id: "s2",
        operator: "未成年人打赏可联系平台申请退款，代练索要账号密码是盗号诈骗。请立即修改支付密码，开启未成年人模式。",
        choices: [
          { text: "修改密码，联系平台申请退款", next: null, verdict: "right", ending: "verified", feedback: "正确！未成年人打赏可申请退款。" },
          { text: "提供账号密码让代练上分", next: null, verdict: "wrong", ending: "scam", feedback: "错误！账号密码一旦泄露，装备皮肤即被盗。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即修改支付密码、冻结关联账户，联系平台申请退款，并到就近派出所报案。",
        choices: [
          { text: "好的，我立即修改密码报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "未成年人打赏可联系平台申请退款",
      "代练索要账号密码=盗号诈骗",
      "开启未成年人模式，保管支付密码",
    ],
  },
];

/** 合并 v3 + v4 的 96110 剧本 */
export const ALL_HOTLINE_SCRIPTS: FBHotlineScript[] = [...HOTLINE_SCRIPTS_96110, ...HOTLINE_SCRIPTS_V4];

/** 根据 ID 查询 96110 剧本（覆盖 v3 + v4） */
export function getHotlineScriptV4(id: string): FBHotlineScript | undefined {
  return ALL_HOTLINE_SCRIPTS.find((s) => s.id === id);
}

// ============ v5 升级：新模式配置常量 ============

/** AI 对战模式配置 */
export const AI_BATTLE_CONFIG = {
  /** 默认每局限时（秒） */
  durationSec: 180,
  /** 通关阈值：识破红旗数 */
  defaultPassThreshold: 3,
  /** 最大轮次 */
  maxTurns: 12,
};

/** 双人对战模式配置 */
export const VERSUS_CONFIG = {
  /** 每位玩家初始血量 */
  initialHp: 100,
  /** 答对攻击伤害 */
  damageOnCorrect: 20,
  /** 连击额外伤害（每连击+5） */
  comboBonusDamage: 5,
  /** 答错自伤 */
  selfDamageOnWrong: 10,
  /** 总题数 */
  totalQuestions: 15,
  /** 玩家1默认配置 */
  p1: { name: "玩家1", icon: "🦸", color: "#1AD670" },
  /** 玩家2默认配置 */
  p2: { name: "玩家2", icon: "🦹", color: "#E5353B" },
};

/** 骗局拆解模式配置 */
export const DECONSTRUCT_CONFIG = {
  /** 每行自动播放间隔（毫秒） */
  autoPlayInterval: 3500,
  /** 是否默认自动播放 */
  autoPlayDefault: false,
};

// ============ v5 升级：智能错题画像 ============

import type { FBWeaknessReport, FBKnowledgeStat } from "./types";
import { QUESTION_BANK } from "./data";
import type { FBSaveData } from "./storage";

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

// ============ v5 升级：F97-F115 图鉴条目 ============
// 新增 9 种 2026 H3 诈骗类型图鉴
export const CODEX_ENTRIES_V5: FBCodexEntry[] = [
  {
    typeId: "F107", name: "AI实时换脸视频通话升级版", icon: "🎬",
    catchphrase: "视频急令转账 = AI换脸", slogan: "挂断+原号码核实",
    points: [
      "AI实时换脸可伪造视频通话，2026年技术升级破绽更少",
      "眨眼频率低、口型偏差、耳廓边缘、阴影方向是破绽",
      "\"麦克风坏了只能打字\"是规避语音破绽的话术",
      "\"信号不好切换语音\"是规避视频破绽的话术",
    ],
    response: "挂断视频，用通讯录原号码电话核实",
    source: "公安部联合网信办通报",
    courseLevel: "advanced",
    psychology: ["urgency", "authority", "trust"],
    knowledgePoint: "KP-AI-REALTIME-DEEPFAKE-V2",
    caseArchives: [
      { title: "AI实时换脸冒充领导代转账案", date: "2026-07", source: "公安部联合网信办通报", takeaway: "AI实时换脸技术升级，转账务必挂断后用原号码核实。" },
    ],
  },
  {
    typeId: "F108", name: "数字人民币钱包钓鱼", icon: "💰",
    catchphrase: "数字人民币红包领取 = 钓鱼", slogan: "只认官方数字人民币APP",
    points: [
      "数字人民币红包只在官方APP内领取",
      "\"数字人民币账户认证过期\"是钓鱼话术",
      "\"数字人民币兑换USDT通道\"结合虚拟币骗局",
      "官方域名不是数字人民币相关仿冒域名",
    ],
    response: "登录数字人民币官方APP核实",
    source: "央行数字货币研究所联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "urgency", "authority"],
    knowledgePoint: "KP-DCEP-V2",
    caseArchives: [
      { title: "数字人民币红包试点钓鱼案", date: "2026-08", source: "央行数字货币研究所通报", takeaway: "数字人民币红包只在官方APP领取，陌生链接都是钓鱼。" },
    ],
  },
  {
    typeId: "F109", name: "AI招聘面试诈骗", icon: "💼",
    catchphrase: "AI面试下载会议软件 = 诈骗", slogan: "正规招聘不收任何费用",
    points: [
      "AI视频面试要求下载会议软件共享屏幕=诈骗",
      "\"AI智能面试系统\"要求人脸识别+身份证+银行卡建档=诈骗",
      "\"高薪远程工作\"先垫付设备费/培训费=诈骗",
      "正规招聘不收任何费用，不要求共享屏幕",
    ],
    response: "拒绝共享屏幕和缴费，到正规招聘平台核实",
    source: "人社部联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "authority", "trust"],
    knowledgePoint: "KP-AI-RECRUIT",
    caseArchives: [
      { title: "AI招聘面试共享屏幕盗刷案", date: "2026-08", source: "人社部联合反诈中心通报", takeaway: "AI面试要求共享屏幕=诈骗，正规招聘不收任何费用。" },
    ],
  },
  {
    typeId: "F110", name: "AI客服退款升级版", icon: "📞",
    catchphrase: "AI仿声客服退款 = 诈骗", slogan: "退款只在官方APP",
    points: [
      "AI仿声已能模拟专业客服音色，2026年技术升级",
      "\"商品甲醛超标退款\"+共享屏幕=诈骗",
      "\"快递丢失理赔\"+下载理赔APP=诈骗",
      "退款只在官方APP内完成，不要求共享屏幕",
    ],
    response: "挂断，登录淘宝/京东/拼多多官方APP核实",
    source: "市场监管总局联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["authority", "urgency", "fear"],
    knowledgePoint: "KP-AI-REFUND-V2",
    caseArchives: [
      { title: "AI仿声客服甲醛退款案", date: "2026-08", source: "市场监管总局联合反诈中心通报", takeaway: "AI仿声客服退款=诈骗，退款只在官方APP完成。" },
    ],
  },
  {
    typeId: "F111", name: "跨境虚拟币洗钱陷阱", icon: "🌐",
    catchphrase: "代收代付 = 帮信罪", slogan: "不出租不出借账户",
    points: [
      "\"USDT跑分\"\"代收代付\"涉嫌帮信罪，最高判3年",
      "\"海外商家代收\"利用玩家账户洗钱",
      "\"数字货币兑换现金\"线下交易被抢劫/诈骗",
      "不出租不出借个人账户，不参与代收代付",
    ],
    response: "拒绝代收代付，不参与任何形式的跑分",
    source: "公安部联合央行通报",
    courseLevel: "advanced",
    psychology: ["greed", "conformity"],
    knowledgePoint: "KP-CRYPTO-LAUNDER",
    caseArchives: [
      { title: "USDT跑分帮信罪案", date: "2026-08", source: "公安部联合央行通报", takeaway: "代收代付=帮信罪，不出租不出借账户。" },
    ],
  },
  {
    typeId: "F112", name: "未成年人AI绘画付费陷阱", icon: "🎨",
    catchphrase: "AI绘画课9.9元 = 续费陷阱", slogan: "家长保管支付密码",
    points: [
      "\"AI绘画课9.9元体验\"诱导续费高价课程",
      "\"AI生成孩子专属动画\"付费后盗用家长账户",
      "\"AI绘画作品参赛\"要求缴费+家长银行卡",
      "家长保管支付密码，开启未成年人模式",
    ],
    response: "拒绝续费，联系平台申请退款，保管支付密码",
    source: "教育部联合反诈中心通报",
    courseLevel: "basic",
    psychology: ["greed", "curiosity", "intimacy"],
    knowledgePoint: "KP-AI-PAINTING",
    caseArchives: [
      { title: "AI绘画课续费陷阱案", date: "2026-08", source: "教育部联合反诈中心通报", takeaway: "AI绘画课9.9元是续费陷阱，家长保管支付密码。" },
    ],
  },
  {
    typeId: "F113", name: "外卖退款保障险钓鱼", icon: "🍱",
    catchphrase: "退款保障险 = 钓鱼", slogan: "外卖退款在APP内",
    points: [
      "美团/饿了么仿冒客服\"退款保障险\"钓鱼",
      "\"外卖吃出异物理赔\"要求共享屏幕=诈骗",
      "\"商家关停退款\"要求扫码激活=钓鱼",
      "外卖退款在官方APP内完成，不要求共享屏幕",
    ],
    response: "登录美团/饿了么官方APP核实",
    source: "市场监管总局联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["urgency", "greed", "authority"],
    knowledgePoint: "KP-TAKEOUT-REFUND",
    caseArchives: [
      { title: "外卖退款保障险钓鱼案", date: "2026-08", source: "市场监管总局联合反诈中心通报", takeaway: "外卖退款在APP内完成，退款保障险是钓鱼。" },
    ],
  },
  {
    typeId: "F114", name: "短视频涨粉代理诈骗", icon: "📹",
    catchphrase: "AI智能涨粉 = 诈骗", slogan: "正规涨粉靠内容不靠付费",
    points: [
      "\"AI智能涨粉\"代理加盟，垫付保证金=诈骗",
      "\"短视频带货培训\"0元学习后强制续费",
      "\"百万粉丝账号代运营\"先付费后跑路",
      "正规涨粉靠内容运营，不靠付费代运营",
    ],
    response: "拒绝垫付保证金，到正规平台学习运营",
    source: "网信办联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["greed", "conformity", "authority"],
    knowledgePoint: "KP-SHORTVIDEO-FANS",
    caseArchives: [
      { title: "AI智能涨粉代理诈骗案", date: "2026-08", source: "网信办联合反诈中心通报", takeaway: "AI智能涨粉是诈骗，正规涨粉靠内容不靠付费。" },
    ],
  },
  {
    typeId: "F115", name: "AI殡葬诈骗/清明钓鱼", icon: "🪦",
    catchphrase: "云端祭扫付费 = 诈骗", slogan: "殡葬业务走正规渠道",
    points: [
      "\"云端祭扫\"平台收费后跑路",
      "\"殡葬补贴\"陌生链接钓鱼",
      "\"AI复活逝者声音\"付费后盗信息",
      "\"墓地升级\"冒充陵园客服",
    ],
    response: "殡葬业务走正规陵园/民政部门，不点陌生链接",
    source: "民政部联合反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["urgency", "fear", "intimacy", "greed"],
    knowledgePoint: "KP-AI-FUNERAL",
    season: ["springFestival"],
    caseArchives: [
      { title: "云端祭扫收费跑路案", date: "2026-04", source: "民政部联合反诈中心通报", takeaway: "云端祭扫付费=诈骗，殡葬业务走正规渠道。" },
    ],
  },
  // ===== v6 升级：2026 Q3-Q4 新型诈骗（F116-F123） =====
  {
    typeId: "F116", name: "AI实时换脸视频通话", icon: "🎥",
    catchphrase: "陌生号码视频通话催转账 = 换脸诈骗", slogan: "原号码回拨独立核实",
    points: [
      "AI实时换脸可伪造亲人/领导面容视频通话",
      "通话时长很短就挂断（怕露馅）",
      "频繁催促转账/绕过流程",
      "拒绝长时间交流或换角度",
    ],
    response: "陌生号码视频通话催转账，立即挂断用通讯录原号码回拨核实",
    source: "公安部反诈中心通报",
    courseLevel: "advanced",
    psychology: ["urgency", "fear", "authority", "intimacy"],
    knowledgePoint: "KP-AI-DEEPFAKE",
    season: ["all"],
    caseArchives: [
      { title: "AI换脸冒充亲属车祸诈骗案", date: "2026-09", source: "公安部反诈中心通报", takeaway: "陌生号码短时通话催转账，必须原号码回拨核实。" },
      { title: "AI换脸冒充CEO视频转账诈骗案", date: "2026-10", source: "国家反诈中心通报", takeaway: "紧急转账必须独立核实，不能因视频面容真实就绕过流程。" },
    ],
  },
  {
    typeId: "F117", name: "数字人民币钱包权限委托诈骗", icon: "🪙",
    catchphrase: "权限委托+代为操作 = 诈骗", slogan: "数字人民币无权限委托功能",
    points: [
      "数字人民币官方域名是 cbdc.cn，陌生域名都是钓鱼",
      "数字人民币钱包无'权限委托'功能",
      "任何'代为操作钱包'都是诈骗",
      "钱包问题只能到银行网点或官方APP处理",
    ],
    response: "挂断到银行网点或官方APP核实，不下载指定APP不开通权限委托",
    source: "央行反诈联合通报",
    courseLevel: "intermediate",
    psychology: ["authority", "fear", "urgency", "greed"],
    knowledgePoint: "KP-DCEP-VERIFY",
    season: ["all"],
    caseArchives: [
      { title: "仿冒数字人民币红包钓鱼案", date: "2026-08", source: "央行数字货币研究所通报", takeaway: "数字人民币官方域名是 cbdc.cn，红包仅通过官方APP发放。" },
      { title: "数字人民币权限委托诈骗案", date: "2026-09", source: "央行反诈联合通报", takeaway: "数字人民币钱包无'权限委托'功能，任何要求代为操作的都是诈骗。" },
    ],
  },
  {
    typeId: "F118", name: "加密货币杀猪盘", icon: "💰",
    catchphrase: "USDT量化+稳赚不赔 = 假交易所", slogan: "提现缴税=100%诈骗",
    points: [
      "自建假交易所APP显示虚假盈利",
      "提现时以'通道税/解冻金/反洗钱认证金'连环收费",
      "加密货币提现无需缴税，缴税=诈骗",
      "只认主流交易所（币安/欧易），不下载私人链接APP",
    ],
    response: "卸载自建APP立即举报，加密货币提现无需缴税",
    source: "公安部经侦局通报",
    courseLevel: "advanced",
    psychology: ["greed", "sunkCost", "trust", "conformity"],
    knowledgePoint: "KP-CRYPTO-PIG",
    season: ["all"],
    caseArchives: [
      { title: "QuantX假交易所USDT杀猪盘案", date: "2026-09", source: "公安部经侦局通报", takeaway: "加密货币交易所只认主流平台，任何'提现缴税/解冻金'都是诈骗信号。" },
    ],
  },
  {
    typeId: "F119", name: "AI代写论文诈骗", icon: "📝",
    catchphrase: "AI代写包过 = 诈骗+学术不端", slogan: "自行完成或寻求老师指导",
    points: [
      "收定金后人消失是核心套路",
      "交付低质AI生成内容被查重判定",
      "'退款'承诺不兑现",
      "学术不端违反校规，可能被开除学籍",
    ],
    response: "拒绝并自行完成或寻求老师指导，加入群/微信后会被持续诈骗",
    source: "教育部高校司通报",
    courseLevel: "basic",
    psychology: ["greed", "scarcity", "conformity"],
    knowledgePoint: "KP-AI-GHOSTWRITE",
    season: ["schoolOpen"],
    caseArchives: [
      { title: "AI代写毕业论文诈骗案", date: "2026-09", source: "教育部高校司通报", takeaway: "AI代写论文既违反学术诚信，又是高发诈骗。收定金后失联是核心套路。" },
    ],
  },
  {
    typeId: "F120", name: "AI假新闻引流诈骗", icon: "📰",
    catchphrase: "明星塌房内部视频 = 引流陷阱", slogan: "扫码绑卡1元试用=隐藏续费",
    points: [
      "AI合成明星不实视频/图片作诱饵",
      "扫码后诱导绑卡'1元试用'，3天后自动续费",
      "AI假新闻特征：手指异常/独家爆料/情绪煽动/扭曲文字",
      "权威媒体跟进才是真新闻特征",
    ],
    response: "关闭弹窗，到正规平台核实新闻，不扫码不绑卡",
    source: "网信办联合公安部通报",
    courseLevel: "intermediate",
    psychology: ["curiosity", "greed", "scarcity", "conformity"],
    knowledgePoint: "KP-AI-FAKENEWS",
    season: ["all"],
    caseArchives: [
      { title: "AI合成明星塌房视频引流诈骗案", date: "2026-08", source: "网信办联合公安部通报", takeaway: "AI可低成本合成明星假视频，扫码绑卡'1元试用'是隐藏续费陷阱。" },
    ],
  },
  {
    typeId: "F121", name: "外卖理赔屏幕共享诈骗", icon: "🍱",
    catchphrase: "理赔需屏幕共享 = 诈骗", slogan: "理赔到官方APP客服核实",
    points: [
      "骗子准确报出订单信息（数据泄露）",
      "主动理赔获取信任",
      "屏幕共享窃取银行APP密码/验证码",
      "任何'理赔需屏幕共享'都是诈骗",
    ],
    response: "挂断到美团/饿了么官方APP客服核实，理赔不要求屏幕共享",
    source: "国家反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["trust", "authority", "greed"],
    knowledgePoint: "KP-FOOD-CLAIM",
    season: ["all"],
    caseArchives: [
      { title: "外卖理赔屏幕共享诈骗案", date: "2026-09", source: "国家反诈中心通报", takeaway: "理赔不会要求屏幕共享，任何'共享屏幕领钱'都是诈骗。" },
    ],
  },
  {
    typeId: "F122", name: "共享屏幕清退会员诈骗", icon: "🖥",
    catchphrase: "远程协助清退会员 = 诈骗", slogan: "会员管理在APP内自助完成",
    points: [
      "诱导下载ToDesk/向日葵等远程协助软件",
      "远程查看手机所有内容",
      "读出验证码即可转走资金",
      "任何'会员问题需远程协助'都是诈骗",
    ],
    response: "挂断到APP内自助关闭自动续费，验证码绝不读给任何人",
    source: "公安部反诈中心通报",
    courseLevel: "intermediate",
    psychology: ["authority", "fear", "urgency"],
    knowledgePoint: "KP-MEMBERSHIP-REFUND",
    season: ["all"],
    caseArchives: [
      { title: "ToDesk远程协助清退会员诈骗案", date: "2026-10", source: "公安部反诈中心通报", takeaway: "远程协助软件+读验证码=资金被转走的标配。会员管理不会要求远程协助。" },
    ],
  },
  {
    typeId: "F123", name: "直播间虚假竞拍诈骗", icon: "🔨",
    catchphrase: "0元起拍+追加费用 = 连环诈骗", slogan: "正规拍卖行费用提前公示",
    points: [
      "用'0元起拍'诱导低价中标",
      "再以'鉴定费/保证金/通关费'连环收费",
      "征信恐吓（直播间拍卖无征信接入）",
      "'最后一步'永远有下一步",
    ],
    response: "退出直播间，到正规拍卖行核实，不扫码不转账",
    source: "市场监管总局通报",
    courseLevel: "intermediate",
    psychology: ["greed", "scarcity", "sunkCost", "conformity"],
    knowledgePoint: "KP-LIVE-AUCTION",
    season: ["all"],
    caseArchives: [
      { title: "直播间虚假古董竞拍诈骗案", date: "2026-09", source: "市场监管总局通报", takeaway: "0元起拍+追加鉴定费/保证金是直播间诈骗标配，正规拍卖不会私下追加费用。" },
    ],
  },
];

