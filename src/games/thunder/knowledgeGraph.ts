import type {
  ThunderKnowledgeGraph,
  ThunderKnowledgeNodeDef,
  ThunderKnowledgeEdgeDef,
  ThunderKnowledgeNodeState,
  ThunderKnowledgeCategory,
} from "./types";

/**
 * v7 升级 · 反诈知识图谱
 *
 * 图谱把反诈能力拆成五个分类：识别 / 心理 / 流程 / 法律 / 工具，
 * 节点之间用前置、关联、克制三种连线编织成网。
 * 玩家掌握度驱动节点解锁，推荐下一批学习目标。
 */

// ===========================================================================
// ===== 知识节点（20 个，覆盖 5 个分类）=====================================
// ===========================================================================

export const THUNDER_KNOWLEDGE_NODES: ThunderKnowledgeNodeDef[] = [
  // ---------- 识别能力 recognition（5）----------
  {
    id: "KN-001",
    name: "识别冒充公检法",
    category: "recognition",
    fraudTypeId: "F01",
    desc:
      "公检法不会通过电话、微信、视频做笔录，更不会设立“安全账户”要求你转账自证清白。识别要点：逮捕令/通缉令多为伪造、要求独处与屏幕共享、最终落点必是转账。挂断后拨 96110 核实。",
    codexId: "CODEX-F01",
    lessonSectionId: "CHAPTER-01-S01",
    x: 0.1,
    y: 0.1,
    prerequisiteNodeIds: ["KN-006", "KN-008", "KN-018"],
    icon: "📜",
    color: "#E5353B",
  },
  {
    id: "KN-002",
    name: "识别杀猪盘",
    category: "recognition",
    fraudTypeId: "F02",
    desc:
      "情感诱导 + 虚假投资平台，分找猪、养猪、喂料、屠宰、杀猪五步。识别要点：网恋对象引导投资、承诺保本高收益、小额提现尝甜头后大额无法提现。任何“稳赚不赔”都是骗局。",
    codexId: "CODEX-F02",
    lessonSectionId: "CHAPTER-02-S01",
    x: 0.24,
    y: 0.1,
    prerequisiteNodeIds: ["KN-007", "KN-009"],
    icon: "🐖",
    color: "#FF7A1A",
  },
  {
    id: "KN-003",
    name: "识别刷单诈骗",
    category: "recognition",
    fraudTypeId: "F03",
    desc:
      "刷单违反《反不正当竞争法》，“刷单兼职”四字即骗局信号。套路：小额返现甜头→垫付返佣→连单加码→“操作错误”冻结→“保证金”收割。凡是先垫钱再返佣的兼职一律拉黑。",
    codexId: "CODEX-F03",
    lessonSectionId: "CHAPTER-03-S01",
    x: 0.1,
    y: 0.24,
    prerequisiteNodeIds: ["KN-007"],
    icon: "🧾",
    color: "#52C41A",
  },
  {
    id: "KN-004",
    name: "识别 AI 换脸拟声",
    category: "recognition",
    fraudTypeId: "F45",
    desc:
      "AI 只需几秒语音即可克隆声音、几张照片即可实时换脸。识别法：让对方挥手/快速转头/做夸张表情，模型会露馅。涉及转账的视频请求，挂断后用存档号码回拨核实，别用来电号码。",
    codexId: "CODEX-F45",
    lessonSectionId: "CHAPTER-04-S01",
    x: 0.24,
    y: 0.24,
    prerequisiteNodeIds: ["KN-001", "KN-009"],
    icon: "🤖",
    color: "#B388FF",
  },
  {
    id: "KN-005",
    name: "识别钓鱼链接",
    category: "recognition",
    desc:
      "钓鱼链接常伪装成银行、快递、电商、政务短信，诱导点击后窃取账号密码与验证码。识别要点：短链接/非常规域名、催促“账户异常”、要求填写完整密码与验证码。官方不会短信索要验证码。",
    codexId: "CODEX-PHISH",
    lessonSectionId: "CHAPTER-03-S01",
    x: 0.17,
    y: 0.34,
    prerequisiteNodeIds: ["KN-016"],
    icon: "🎣",
    color: "#13C2C2",
  },

  // ---------- 心理防御 psychology（4）----------
  {
    id: "KN-006",
    name: "恐惧施压应对",
    category: "psychology",
    desc:
      "骗子用“涉嫌犯罪”“逮捕令”制造恐慌，让你失去判断力。应对：深呼吸、拒绝独处、不慌转。记住公检法不会电话办案、没有安全账户。恐惧越强，越要停下来拨打 96110 求证。",
    codexId: "CODEX-PSY-FEAR",
    lessonSectionId: "CHAPTER-01-S01",
    x: 0.76,
    y: 0.1,
    icon: "😱",
    color: "#FA541C",
  },
  {
    id: "KN-007",
    name: "贪婪诱惑应对",
    category: "psychology",
    desc:
      "骗子用“高收益”“日结返佣”“内幕渠道”勾起贪念。应对：牢记“保本高收益=骗局”、年化超 8% 即高风险。任何让你“先尝甜头再加大投入”的模式，都是收割前奏，捂紧钱包。",
    codexId: "CODEX-PSY-GREED",
    lessonSectionId: "CHAPTER-02-S01",
    x: 0.9,
    y: 0.1,
    icon: "💰",
    color: "#FAAD14",
  },
  {
    id: "KN-008",
    name: "权威压迫应对",
    category: "psychology",
    desc:
      "骗子冒充领导、上级、公职人员，用身份压你服从。应对：真权威不怕核实，挂断后用存档号码回拨；对“紧急转账”“代付合同款”等要求，必须走第二条独立渠道确认，多打一通电话成本极低。",
    codexId: "CODEX-PSY-AUTH",
    lessonSectionId: "CHAPTER-01-S03",
    x: 0.76,
    y: 0.24,
    icon: "👮",
    color: "#2F54EB",
  },
  {
    id: "KN-009",
    name: "情感亲密应对",
    category: "psychology",
    desc:
      "骗子用嘘寒问暖、恋爱人设建立情感依赖，再引导投资或借钱。应对：网恋对象只要提“投资”“借钱”就高度可疑；家人哭诉要钱，先挂断用其他渠道联系本人或共同亲友核实，别被情绪牵着走。",
    codexId: "CODEX-PSY-LOVE",
    lessonSectionId: "CHAPTER-02-S01",
    x: 0.9,
    y: 0.24,
    icon: "❤️",
    color: "#EB2F96",
  },

  // ---------- 应对流程 procedure（4）----------
  {
    id: "KN-010",
    name: "96110 拨打流程",
    category: "procedure",
    desc:
      "96110 是全国反诈专线，接到此号码来电务必接听。主动核实流程：拨通后说清疑似诈骗类型、对方账号/电话、转账情况，工作人员会研判并指导下一步。建议把 96110 存入通讯录，遇事先打这一通。",
    codexId: "CODEX-PROC-96110",
    lessonSectionId: "CHAPTER-06-S03",
    x: 0.4,
    y: 0.42,
    prerequisiteNodeIds: ["KN-018"],
    icon: "☎️",
    color: "#1890FF",
  },
  {
    id: "KN-011",
    name: "紧急止付流程",
    category: "procedure",
    desc:
      "发现被骗黄金止付时间仅几分钟到几小时。流程：立即拨 110，说清转账时间、金额、对方账户、转出方式，警方通过反诈平台向银行发起紧急止付；同步拨 96110 登记涉案信息，越快越可能追回。",
    codexId: "CODEX-PROC-FREEZE",
    lessonSectionId: "CHAPTER-06-S03",
    x: 0.55,
    y: 0.42,
    prerequisiteNodeIds: ["KN-010", "KN-020"],
    icon: "🛑",
    color: "#F5222D",
  },
  {
    id: "KN-012",
    name: "报警取证流程",
    category: "procedure",
    desc:
      "被骗后立即保存聊天记录、转账凭证、骗子账号、通话录音、完整时间线，这些是取证追赃关键证据。到辖区派出所做笔录，提供完整证据链。切勿删除与骗子的任何记录，也不要自行“钓鱼”取证。",
    codexId: "CODEX-PROC-EVID",
    lessonSectionId: "CHAPTER-06-S04",
    x: 0.4,
    y: 0.56,
    prerequisiteNodeIds: ["KN-010"],
    icon: "📝",
    color: "#722ED1",
  },
  {
    id: "KN-013",
    name: "银行冻结流程",
    category: "procedure",
    desc:
      "紧急止付后，配合警方持《协助冻结财产通知书》到银行办理账户冻结，防止骗子转移资金。本人账户被盗刷，应立即联系银行客服口头挂失，再补办书面手续。冻结有时效，需关注续冻。",
    codexId: "CODEX-PROC-BANK",
    lessonSectionId: "CHAPTER-06-S03",
    x: 0.55,
    y: 0.56,
    prerequisiteNodeIds: ["KN-011", "KN-020"],
    icon: "🏦",
    color: "#08979C",
  },

  // ---------- 法律法规 law（3）----------
  {
    id: "KN-014",
    name: "反电信网络诈骗法",
    category: "law",
    desc:
      "《中华人民共和国反电信网络诈骗法》2022 年 12 月施行，明确电信、金融、互联网行业反诈职责，规定对涉诈号码、账户可采取限制措施，并对组织、策划、实施电诈者依法追责，是反诈核心法律武器。",
    codexId: "CODEX-LAW-ANTIFRAUD",
    lessonSectionId: "CHAPTER-06-S01",
    x: 0.1,
    y: 0.72,
    icon: "⚖️",
    color: "#5B8C00",
  },
  {
    id: "KN-015",
    name: "个人信息保护法",
    category: "law",
    desc:
      "《个人信息保护法》2021 年 11 月施行，规定处理个人信息须告知同意、最小必要。骗子掌握你的身份证号、住址、开卡行等信息多来自泄露。依法保护个人信息，不轻易在陌生链接、App 中填写，是防诈第一道闸。",
    codexId: "CODEX-LAW-PIPL",
    lessonSectionId: "CHAPTER-01-S02",
    x: 0.24,
    y: 0.72,
    icon: "🔒",
    color: "#237804",
  },
  {
    id: "KN-016",
    name: "网络安全法",
    category: "law",
    desc:
      "《网络安全法》2017 年 6 月施行，要求网络运营者保障数据安全、落实实名制。对个人而言，它提示我们：不点击不明链接、不下载来源不明 App、不在公共 WiFi 下操作敏感账户，是守好网络入口的关键。",
    codexId: "CODEX-LAW-CSL",
    lessonSectionId: "CHAPTER-03-S01",
    x: 0.17,
    y: 0.86,
    icon: "🛡️",
    color: "#0050B3",
  },

  // ---------- 反诈工具 tool（4）----------
  {
    id: "KN-017",
    name: "国家反诈中心 APP",
    category: "tool",
    desc:
      "国家反诈中心 App 由公安部刑事侦查局开发，具备涉诈来电预警、App 自检、举报报案、反诈学习等功能。开启“来电预警”权限可对疑似诈骗来电/短信实时提醒。建议全员安装并保持后台运行。",
    codexId: "CODEX-TOOL-APP",
    lessonSectionId: "CHAPTER-01-S05",
    x: 0.76,
    y: 0.72,
    icon: "📱",
    color: "#1D39C4",
  },
  {
    id: "KN-018",
    name: "96110 反诈专线",
    category: "tool",
    desc:
      "96110 是全国统一的反诈预警劝阻专线。接到 96110 来电务必接听，说明你正遭遇诈骗风险。主动核实也可拨打 96110，工作人员研判后会指导应对。它与 110 报警分工：96110 偏预警劝阻，110 偏立案处置。",
    codexId: "CODEX-TOOL-HOTLINE",
    lessonSectionId: "CHAPTER-01-S01",
    x: 0.9,
    y: 0.72,
    icon: "📞",
    color: "#096DD9",
  },
  {
    id: "KN-019",
    name: "12381 涉诈预警",
    category: "tool",
    desc:
      "12381 是工信部涉诈预警短信端口，配合反诈中心向潜在受害人推送预警短信。收到 12381 预警短信说明你正与涉诈号码/账号接触，应立即停止联系与转账。该短信免费、权威，不会带任何链接。",
    codexId: "CODEX-TOOL-SMS",
    lessonSectionId: "CHAPTER-06-S01",
    x: 0.76,
    y: 0.86,
    icon: "📨",
    color: "#7CB305",
  },
  {
    id: "KN-020",
    name: "银行风控系统",
    category: "tool",
    desc:
      "银行风控系统对异常转账（大额、深夜、向涉诈账户汇款）会触发拦截与延时到账，并提示核实。转账时遇到风控提醒不要绕开，这往往是最后的拦截机会。发现被盗刷，立即联系银行客服口头挂失并报警。",
    codexId: "CODEX-TOOL-RISK",
    lessonSectionId: "CHAPTER-06-S03",
    x: 0.9,
    y: 0.86,
    icon: "💳",
    color: "#531DAB",
  },
];

// ===========================================================================
// ===== 知识连线（25+ 条：prerequisite / related / counter）================
// ===========================================================================

export const THUNDER_KNOWLEDGE_EDGES: ThunderKnowledgeEdgeDef[] = [
  // ----- prerequisite 前置依赖（与 prerequisiteNodeIds 一致）-----
  { from: "KN-006", to: "KN-001", type: "prerequisite", label: "前置" },
  { from: "KN-008", to: "KN-001", type: "prerequisite", label: "前置" },
  { from: "KN-018", to: "KN-001", type: "prerequisite", label: "前置" },
  { from: "KN-007", to: "KN-002", type: "prerequisite", label: "前置" },
  { from: "KN-009", to: "KN-002", type: "prerequisite", label: "前置" },
  { from: "KN-007", to: "KN-003", type: "prerequisite", label: "前置" },
  { from: "KN-001", to: "KN-004", type: "prerequisite", label: "前置" },
  { from: "KN-009", to: "KN-004", type: "prerequisite", label: "前置" },
  { from: "KN-016", to: "KN-005", type: "prerequisite", label: "前置" },
  { from: "KN-018", to: "KN-010", type: "prerequisite", label: "前置" },
  { from: "KN-010", to: "KN-011", type: "prerequisite", label: "前置" },
  { from: "KN-020", to: "KN-011", type: "prerequisite", label: "前置" },
  { from: "KN-010", to: "KN-012", type: "prerequisite", label: "前置" },
  { from: "KN-011", to: "KN-013", type: "prerequisite", label: "前置" },
  { from: "KN-020", to: "KN-013", type: "prerequisite", label: "前置" },

  // ----- related 关联 -----
  { from: "KN-001", to: "KN-002", type: "related", label: "关联" },
  { from: "KN-001", to: "KN-004", type: "related", label: "关联" },
  { from: "KN-002", to: "KN-003", type: "related", label: "关联" },
  { from: "KN-005", to: "KN-017", type: "related", label: "关联" },
  { from: "KN-006", to: "KN-008", type: "related", label: "关联" },
  { from: "KN-007", to: "KN-009", type: "related", label: "关联" },
  { from: "KN-010", to: "KN-018", type: "related", label: "关联" },
  { from: "KN-011", to: "KN-013", type: "related", label: "关联" },
  { from: "KN-011", to: "KN-020", type: "related", label: "关联" },
  { from: "KN-014", to: "KN-016", type: "related", label: "关联" },
  { from: "KN-015", to: "KN-016", type: "related", label: "关联" },

  // ----- counter 克制 -----
  { from: "KN-017", to: "KN-001", type: "counter", label: "克制" },
  { from: "KN-017", to: "KN-005", type: "counter", label: "克制" },
  { from: "KN-018", to: "KN-001", type: "counter", label: "克制" },
  { from: "KN-019", to: "KN-002", type: "counter", label: "克制" },
  { from: "KN-020", to: "KN-003", type: "counter", label: "克制" },
  { from: "KN-014", to: "KN-006", type: "counter", label: "克制" },
];

// ===========================================================================
// ===== 知识图谱总表（初始值）===============================================
// ===========================================================================

export const THUNDER_KNOWLEDGE_GRAPH: ThunderKnowledgeGraph = {
  nodes: THUNDER_KNOWLEDGE_NODES,
  edges: THUNDER_KNOWLEDGE_EDGES,
  overallMastery: 0,
  unlockedCount: 0,
  totalCount: THUNDER_KNOWLEDGE_NODES.length,
};

// ===========================================================================
// ===== 辅助函数 ============================================================
// ===========================================================================

/** 按 ID 获取节点 */
export function getKnowledgeNodeById(id: string): ThunderKnowledgeNodeDef | undefined {
  return THUNDER_KNOWLEDGE_NODES.find((n) => n.id === id);
}

/** 按分类获取节点列表 */
export function getNodesByCategory(category: ThunderKnowledgeCategory): ThunderKnowledgeNodeDef[] {
  return THUNDER_KNOWLEDGE_NODES.filter((n) => n.category === category);
}

/**
 * 判断单个节点是否解锁。
 * 解锁条件：无前置节点，或所有前置节点的掌握度都 > 0。
 * masteryMap: nodeId → 0..1 掌握度
 */
export function isNodeUnlocked(nodeId: string, masteryMap: Record<string, number>): boolean {
  const node = getKnowledgeNodeById(nodeId);
  if (!node) return false;
  const prereqs = node.prerequisiteNodeIds ?? [];
  if (prereqs.length === 0) return true;
  for (const pid of prereqs) {
    const m = masteryMap[pid];
    if (typeof m !== "number" || m <= 0) return false;
  }
  return true;
}

/** 获取所有已解锁节点 */
export function getUnlockedNodes(masteryMap: Record<string, number>): ThunderKnowledgeNodeDef[] {
  return THUNDER_KNOWLEDGE_NODES.filter((n) => isNodeUnlocked(n.id, masteryMap));
}

/**
 * 计算全局掌握度：所有节点掌握度的均值（0..1）。
 * 未记录的节点按 0 计。
 */
export function calcOverallMastery(masteryMap: Record<string, number>): number {
  const total = THUNDER_KNOWLEDGE_NODES.length;
  if (total === 0) return 0;
  let sum = 0;
  for (const n of THUNDER_KNOWLEDGE_NODES) {
    const m = masteryMap[n.id];
    sum += typeof m === "number" && m > 0 ? Math.min(1, m) : 0;
  }
  return Math.min(1, sum / total);
}

/**
 * 根据玩家掌握度构建完整图谱快照。
 * 会重新计算 overallMastery 与 unlockedCount。
 */
export function buildKnowledgeGraph(masteryMap: Record<string, number>): ThunderKnowledgeGraph {
  const unlockedCount = getUnlockedNodes(masteryMap).length;
  return {
    nodes: THUNDER_KNOWLEDGE_NODES,
    edges: THUNDER_KNOWLEDGE_EDGES,
    overallMastery: calcOverallMastery(masteryMap),
    unlockedCount,
    totalCount: THUNDER_KNOWLEDGE_NODES.length,
  };
}

/**
 * 推荐下一批学习节点：已解锁且掌握度 < 1 的节点，按掌握度升序排列。
 * limit 默认 5。
 */
export function getRecommendedNodes(
  masteryMap: Record<string, number>,
  limit = 5,
): ThunderKnowledgeNodeDef[] {
  const candidates = THUNDER_KNOWLEDGE_NODES.filter((n) => {
    if (!isNodeUnlocked(n.id, masteryMap)) return false;
    const m = masteryMap[n.id];
    const score = typeof m === "number" ? m : 0;
    return score < 1;
  });
  candidates.sort((a, b) => {
    const ma = typeof masteryMap[a.id] === "number" ? (masteryMap[a.id] as number) : 0;
    const mb = typeof masteryMap[b.id] === "number" ? (masteryMap[b.id] as number) : 0;
    if (ma !== mb) return ma - mb;
    return a.id.localeCompare(b.id);
  });
  return candidates.slice(0, Math.max(0, limit));
}

// ===== 文件末尾标识：knowledgeGraph.ts (v7 反诈知识图谱) =====
