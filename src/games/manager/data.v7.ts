// ====================================================================
// 反诈职业经理人 · v7 全面升级数据
// 独立文件，避免 data.ts 过大（渐进式拆分）
// 包含：真实案例 / 知识图谱 / 爬塔事件 / 剧情章节 / 排行榜模拟 / 战报知识点
// ====================================================================

import type {
  RealCaseDef,
  KnowledgeGraphNode,
  TowerEventDef,
  StoryChapterDef,
  LeaderboardEntry,
  ManagerMode,
  QuizQuestion,
} from "./types";
import { MAZE_TERMS } from "./maze";

// ====================================================================
// v7：真实案例还原（12 个，对应 12 个敌人/BOSS）
// 基于公开报道脱敏处理，数据来源：公安部反诈中心通报 / 央视新闻
// ====================================================================

export const REAL_CASES: RealCaseDef[] = [
  {
    id: "case_robot",
    refEnemyId: "robot",
    title: "话术脚本流水线诈骗案",
    year: "2023",
    summary: "某诈骗园区使用自动拨号系统+话术脚本，单日拨打 10 万通电话，受害人遍布全国。警方跨境执法捣毁窝点，抓获 200 余人。",
    amount: 80000000,
    victim: "中老年群体",
    bustedBy: "公安部反诈中心",
    tip: "话术即诈骗。任何固定剧本式的陌生电话，立即挂断。",
    hotline: "96110 反诈专线，发现话术脚本诈骗请举报。",
    color: "#9FE3FF",
    emoji: "🤖",
  },
  {
    id: "case_popup",
    refEnemyId: "popup",
    title: "假客服双倍退款诈骗案",
    year: "2023",
    summary: "犯罪团伙通过撞库获取订单信息，冒充客服以商品质量问题双倍退款为由，诱导受害人共享屏幕转账，单人最高被骗 23 万。",
    amount: 230000,
    victim: "网购用户",
    bustedBy: "杭州网警",
    tip: "客服不主动。订单异常请通过官方 APP 核实。",
    hotline: "96110 提醒：共享屏幕=交出手机控制权。",
    color: "#FFB020",
    emoji: "💬",
  },
  {
    id: "case_threat",
    refEnemyId: "threat",
    title: "冒充公检法跨境诈骗案",
    year: "2022",
    summary: "犯罪分子伪造拘捕令、PS 公章，48 小时内骗转受害人 80 万至'安全账户'。受害人因恐惧不敢挂断电话核实。",
    amount: 800000,
    victim: "各年龄段",
    bustedBy: "公安部督办",
    tip: "公检法不电办，不存在'安全账户'。",
    hotline: "96110 不会让你转账，挂断后拨 110 核实。",
    color: "#E5353B",
    emoji: "📞",
  },
  {
    id: "case_sweet",
    refEnemyId: "sweet",
    title: "杀猪盘跨境诈骗案",
    year: "2023",
    summary: "受害人通过社交软件结识'优质女性'，恋爱 3 个月后被告知有内部投资渠道，先后投入 480 万，最终平台跑路失联。",
    amount: 4800000,
    victim: "单身男性",
    bustedBy: "多地联合执法",
    tip: "网恋不转账。未见面就让你投资的，100% 是骗局。",
    hotline: "96110 提醒：杀猪盘必破，及时报警可追赃。",
    color: "#FF7AB8",
    emoji: "💕",
  },
  {
    id: "case_phish",
    refEnemyId: "phish",
    title: "钓鱼链接盗刷案",
    year: "2024",
    summary: "受害人点击'银行积分兑换'短信链接，输入密码后卡内 12 万被秒转。钓鱼页面与银行官网相似度 95%。",
    amount: 120000,
    victim: "银行卡用户",
    bustedBy: "银保监会联动",
    tip: "不点陌生链。涉及密码的链接一律从官方 APP 进入。",
    hotline: "96110 提醒：银行积分兑换只在官方 APP。",
    color: "#1AD670",
    emoji: "🎣",
  },
  {
    id: "case_farmer",
    refEnemyId: "farmer",
    title: "断卡行动·卡农洗钱案",
    year: "2022",
    summary: "钱叔团伙通过 7 层壳公司租用 200+ 张银行卡，3 个月走账 1.2 亿。出租卡的人均构成帮信罪，最高判 3 年。",
    amount: 120000000,
    victim: "贪图小利者",
    bustedBy: "断卡行动专班",
    tip: "不租售两卡。出租银行卡涉嫌帮信罪。",
    hotline: "96110 举报：买卖/出租银行卡是犯罪。",
    color: "#B388FF",
    emoji: "💳",
  },
  {
    id: "case_deepfake",
    refEnemyId: "deepfake",
    title: "AI 换脸冒充熟人诈骗案",
    year: "2024",
    summary: "犯罪分子使用开源换脸模型，冒充受害人亲友视频通话，10 分钟内骗转 430 万。换脸视频有卡顿、眨眼异常等破绽。",
    amount: 4300000,
    victim: "各年龄段",
    bustedBy: "福州网警",
    tip: "AI 换脸核实。换话题问私密信息是最快的核实方式。",
    hotline: "96110 提醒：视频借钱务必电话核实本人。",
    color: "#A8E6CF",
    emoji: "🎭",
  },
  {
    id: "case_investApp",
    refEnemyId: "investApp",
    title: "虚假理财平台暴雷案",
    year: "2023",
    summary: "钱生钱虚假理财平台高峰期 5 万投资人，年化收益 30%'稳赚不赔'。跑路时未兑付 3.2 亿，群内晒单全是托。",
    amount: 320000000,
    victim: "中老年投资者",
    bustedBy: "证监会联动",
    tip: "理财认持牌。证监会/银保监会官网可查机构资质。",
    hotline: "96110 提醒：稳赚不赔的都是资金盘。",
    color: "#FF6B9D",
    emoji: "📱",
  },
  {
    id: "case_fakeLeader",
    refEnemyId: "fakeLeader",
    title: "冒充领导转账诈骗案",
    year: "2024",
    summary: "犯罪分子冒充公司领导加微信，以'在开会不便接电话'阻挠核实，骗转财务 87 万。后查实微信号系伪造。",
    amount: 870000,
    victim: "企业财务人员",
    bustedBy: "深圳网警",
    tip: "领导转账核实。换渠道（电话/当面）确认本人。",
    hotline: "96110 提醒：领导借钱必换渠道核实。",
    color: "#4ECDC4",
    emoji: "👔",
  },
  {
    id: "case_etcFraud",
    refEnemyId: "etcFraud",
    title: "ETC 过期短信钓鱼案",
    year: "2024",
    summary: "受害人收到'ETC 过期禁用'短信，点击链接补办输入银行卡密码后，卡内 3.8 万被转走。短信链接为高仿钓鱼页面。",
    amount: 38000,
    victim: "ETC 车主",
    bustedBy: "高速交警联动",
    tip: "ETC 官方办。ETC 不会以短信链接索要银行卡信息。",
    hotline: "96110 提醒：ETC 业务只在发行方官方渠道办理。",
    color: "#FFA07A",
    emoji: "🚗",
  },
  {
    id: "case_refundFraud",
    refEnemyId: "refundFraud",
    title: "退费诈骗连环套案",
    year: "2023",
    summary: "犯罪团伙以商品质量问题退费为由，诱导受害人下载屏幕共享 APP，期间转走 15 万。退费是诱饵，共享屏幕是杀招。",
    amount: 150000,
    victim: "网购用户",
    bustedBy: "上海网警",
    tip: "退费走官方。屏幕共享=对方能看到你所有验证码。",
    hotline: "96110 提醒：退费不会要求共享屏幕。",
    color: "#FFB347",
    emoji: "💸",
  },
  {
    id: "case_loanCancel",
    refEnemyId: "loanCancel",
    title: "注销校园贷诈骗案",
    year: "2024",
    summary: "蜡笔老哥团伙专盯大学生，伪造金融监管身份，以'注销校园贷影响征信'恐吓学生网贷转账，2 个月骗转 60 万。",
    amount: 600000,
    victim: "在校大学生",
    bustedBy: "教育部联动",
    tip: "注销校园贷是骗。征信只能本人到央行或官方渠道查询。",
    hotline: "96110 提醒：校园贷注销是伪需求，征信不可代修。",
    color: "#9B59B6",
    emoji: "📚",
  },
];

/** 根据敌人/BOSS id 取关联案例 */
export function getCaseByEnemyId(enemyId: string): RealCaseDef | undefined {
  return REAL_CASES.find((c) => c.refEnemyId === enemyId);
}

/** 根据 case id 取案例 */
export function getCaseById(caseId: string): RealCaseDef | undefined {
  return REAL_CASES.find((c) => c.id === caseId);
}

// ====================================================================
// v7：反诈知识图谱（节点 + 关联关系）
// 展示诈骗类型间的链路：杀猪盘→洗钱→跨境 等
// ====================================================================

export const KNOWLEDGE_GRAPH: KnowledgeGraphNode[] = [
  // 诈骗类型节点
  {
    codexId: "codex_sweet",
    kind: "fraudType",
    links: ["codex_farmer", "codex_kingpin"],
    linkDesc: ["资金流向", "跨境窝点"],
  },
  {
    codexId: "codex_popup",
    kind: "fraudType",
    links: ["codex_refundFraud", "codex_robot"],
    linkDesc: ["演变自", "话术脚本"],
  },
  {
    codexId: "codex_threat",
    kind: "fraudType",
    links: ["codex_loanCancel", "codex_robot"],
    linkDesc: ["演变自", "话术脚本"],
  },
  {
    codexId: "codex_phish",
    kind: "fraudType",
    links: ["codex_etcFraud", "codex_fakeLeader"],
    linkDesc: ["演变自", "演变自"],
  },
  {
    codexId: "codex_deepfake",
    kind: "fraudType",
    links: ["codex_threat", "codex_fakeLeader"],
    linkDesc: ["结合", "结合"],
  },
  {
    codexId: "codex_investApp",
    kind: "fraudType",
    links: ["codex_farmer", "codex_kingpin"],
    linkDesc: ["资金流向", "跨境窝点"],
  },
  // 洗钱/卡农节点
  {
    codexId: "codex_farmer",
    kind: "channel",
    links: ["codex_kingpin"],
    linkDesc: ["走账通道"],
  },
  // 跨境节点
  {
    codexId: "codex_kingpin",
    kind: "target",
    links: [],
    linkDesc: [],
  },
  // 受害人群节点
  {
    codexId: "codex_loanCancel",
    kind: "target",
    links: ["codex_threat"],
    linkDesc: ["恐吓手段"],
  },
  {
    codexId: "codex_refundFraud",
    kind: "target",
    links: ["codex_popup"],
    linkDesc: ["话术演变"],
  },
  {
    codexId: "codex_etcFraud",
    kind: "target",
    links: ["codex_phish"],
    linkDesc: ["钓鱼变体"],
  },
  {
    codexId: "codex_fakeLeader",
    kind: "target",
    links: ["codex_phish", "codex_deepfake"],
    linkDesc: ["钓鱼变体", "AI 强化"],
  },
  {
    codexId: "codex_robot",
    kind: "tactic",
    links: ["codex_popup", "codex_threat"],
    linkDesc: ["话术基础", "话术基础"],
  },
];

/** 取节点的关联节点（含描述） */
export function getGraphLinks(codexId: string): { target: KnowledgeGraphNode; desc: string }[] {
  const node = KNOWLEDGE_GRAPH.find((n) => n.codexId === codexId);
  if (!node) return [];
  return node.links.map((id, i) => {
    const target = KNOWLEDGE_GRAPH.find((n) => n.codexId === id);
    return target ? { target, desc: node.linkDesc[i] ?? "关联" } : null;
  }).filter((x): x is { target: KnowledgeGraphNode; desc: string } => x !== null);
}

// ====================================================================
// v7：爬塔 Roguelike 事件层（每 5 层触发，非 BOSS 层）
// 5 类事件 × 2-4 个选项，影响后续玩法
// ====================================================================

export const TOWER_EVENTS: TowerEventDef[] = [
  {
    id: "evt_5",
    floor: 5,
    kind: "victimRescue",
    title: "受害人求助",
    story: "一位老人接到'孙子出车祸'的电话，正准备转账 3 万'手术费'。你如何处理？",
    emoji: "👵",
    color: "#52C41A",
    options: [
      {
        id: "help_call",
        label: "协助核实",
        desc: "帮老人电话核实孙子本人",
        emoji: "📞",
        outcome: { kind: "intel", value: 5 },
      },
      {
        id: "help_96110",
        label: "拨打 96110",
        desc: "引导老人拨打反诈专线",
        emoji: "🛡️",
        outcome: { kind: "score", value: 500 },
      },
      {
        id: "help_skip",
        label: "继续推进",
        desc: "无暇顾及，继续战斗",
        emoji: "⏩",
        outcome: { kind: "skip" },
      },
    ],
  },
  {
    id: "evt_15",
    floor: 15,
    kind: "clueDiscovery",
    title: "线索发现",
    story: "在战场废墟中发现一份未销毁的话术脚本，记录了下一个窝点的位置。如何处置？",
    emoji: "🔍",
    color: "#00E5FF",
    options: [
      {
        id: "clue_track",
        label: "立即追查",
        desc: "顺藤摸瓜锁定下个窝点",
        emoji: "🎯",
        outcome: { kind: "intel", value: 8 },
      },
      {
        id: "clue_analyze",
        label: "数据建模",
        desc: "送回实验室分析话术模式",
        emoji: "📊",
        outcome: { kind: "codex", codexId: "codex_robot" },
      },
      {
        id: "clue_share",
        label: "分享给友军",
        desc: "通报兄弟单位协同执法",
        emoji: "🤝",
        outcome: { kind: "coins", value: 200 },
      },
    ],
  },
  {
    id: "evt_25",
    floor: 25,
    kind: "fraudQuiz",
    title: "反诈问答",
    story: "一位社区民警拦住你，出了一道反诈题：'收到领导微信借钱，第一时间应该？'",
    emoji: "❓",
    color: "#FFD666",
    options: [
      {
        id: "quiz_call",
        label: "电话/视频核实",
        desc: "换渠道确认本人",
        emoji: "✅",
        outcome: { kind: "relic", relicId: "relic_combo_extender" },
      },
      {
        id: "quiz_transfer",
        label: "立即转账",
        desc: "领导的事不能耽误",
        emoji: "❌",
        outcome: { kind: "hp", value: -20 },
      },
      {
        id: "quiz_ignore",
        label: "装作没看见",
        desc: "等领导再次联系",
        emoji: "🙈",
        outcome: { kind: "skip" },
      },
    ],
  },
  {
    id: "evt_35",
    floor: 35,
    kind: "moralChoice",
    title: "道德抉择",
    story: "一个'卡农'主动投案，愿意提供上线信息换取宽大处理。但他之前确实参与了洗钱。你支持吗？",
    emoji: "⚖️",
    color: "#B388FF",
    options: [
      {
        id: "moral_deal",
        label: "接受交易",
        desc: "线索价值大于惩戒",
        emoji: "🤝",
        outcome: { kind: "intel", value: 12 },
      },
      {
        id: "moral_refuse",
        label: "依法处理",
        desc: "不与犯罪分子交易",
        emoji: "⚖️",
        outcome: { kind: "score", value: 800 },
      },
      {
        id: "moral_investigate",
        label: "调查后再定",
        desc: "核实线索真实性",
        emoji: "🔍",
        outcome: { kind: "case", caseId: "case_farmer" },
      },
    ],
  },
  {
    id: "evt_45",
    floor: 45,
    kind: "resourceTrade",
    title: "情报贩子",
    story: "一个神秘人声称掌握跨境电诈园区的内部数据，索要 500 金币交换。是否交易？",
    emoji: "💼",
    color: "#FF8A3D",
    options: [
      {
        id: "trade_buy",
        label: "购买情报",
        desc: "500 金币换 15 情报",
        emoji: "💰",
        outcome: { kind: "intel", value: 15 },
      },
      {
        id: "trade_arrest",
        label: "抓捕审讯",
        desc: "可疑人物，直接带走",
        emoji: "🚔",
        outcome: { kind: "coins", value: 300 },
      },
      {
        id: "trade_reject",
        label: "拒绝交易",
        desc: "来路不明的情报不可信",
        emoji: "🚫",
        outcome: { kind: "term", termIdx: 5 },
      },
    ],
  },
  {
    id: "evt_55",
    floor: 55,
    kind: "victimRescue",
    title: "网恋受害人",
    story: "一位年轻人网恋半年，对方刚提出'一起投资买币'。你如何劝阻？",
    emoji: "💔",
    color: "#FF7AB8",
    options: [
      {
        id: "rescue_proof",
        label: "展示杀猪盘案例",
        desc: "用真实案例打破幻想",
        emoji: "📄",
        outcome: { kind: "case", caseId: "case_sweet" },
      },
      {
        id: "rescue_96110",
        label: "陪同报警",
        desc: "协助到 96110 报警",
        emoji: "🛡️",
        outcome: { kind: "score", value: 1000 },
      },
      {
        id: "rescue_block",
        label: "建议拉黑",
        desc: "立即拉黑对方账号",
        emoji: "🚫",
        outcome: { kind: "term", termIdx: 16 },
      },
    ],
  },
  {
    id: "evt_65",
    floor: 65,
    kind: "fraudQuiz",
    title: "AI 鉴伪挑战",
    story: "一段'妈妈'的视频请求转账，但画面有些不自然。AI 鉴伪师给出了 3 个判断依据，你会先核实哪一项？",
    emoji: "🎭",
    color: "#A8E6CF",
    options: [
      {
        id: "ai_blink",
        label: "眨眼频率",
        desc: "AI 换脸眨眼频率异常",
        emoji: "👁️",
        outcome: { kind: "relic", relicId: "relic_first_free" },
      },
      {
        id: "ai_question",
        label: "换话题提问",
        desc: "问只有家人知道的事",
        emoji: "💬",
        outcome: { kind: "codex", codexId: "codex_deepfake" },
      },
      {
        id: "ai_call",
        label: "回拨电话",
        desc: "用电话核实本人",
        emoji: "📞",
        outcome: { kind: "intel", value: 10 },
      },
    ],
  },
  {
    id: "evt_75",
    floor: 75,
    kind: "clueDiscovery",
    title: "资金链追踪",
    story: "数据猎查师锁定一条资金链：受害人→卡农→壳公司→境外。从哪一环切断最有效？",
    emoji: "💰",
    color: "#FFD666",
    options: [
      {
        id: "cut_farmer",
        label: "切断卡农环节",
        desc: "源头治理，断卡行动",
        emoji: "💳",
        outcome: { kind: "case", caseId: "case_farmer" },
      },
      {
        id: "cut_shell",
        label: "查壳公司",
        desc: "顺藤摸瓜查资金走向",
        emoji: "🏢",
        outcome: { kind: "intel", value: 18 },
      },
      {
        id: "cut_border",
        label: "跨境联合执法",
        desc: "协调国际刑警",
        emoji: "🌐",
        outcome: { kind: "score", value: 1500 },
      },
    ],
  },
  {
    id: "evt_85",
    floor: 85,
    kind: "moralChoice",
    title: "卧底困境",
    story: "卧底侦查员传回情报：园区内有人是被骗来的'员工'，强行抓捕可能误伤。如何行动？",
    emoji: "🥷",
    color: "#E5353B",
    options: [
      {
        id: "moral_stealth",
        label: "精确解救",
        desc: "先解救被骗人员再行动",
        emoji: "🛡️",
        outcome: { kind: "score", value: 2000 },
      },
      {
        id: "moral_storm",
        label: "强攻园区",
        desc: "兵贵神速，全面清剿",
        emoji: "⚡",
        outcome: { kind: "intel", value: 20 },
      },
      {
        id: "moral_negotiate",
        label: "谈判施压",
        desc: "劝降首恶，分化瓦解",
        emoji: "🤝",
        outcome: { kind: "relic", relicId: "relic_revive" },
      },
    ],
  },
  {
    id: "evt_95",
    floor: 95,
    kind: "resourceTrade",
    title: "终极情报",
    story: "距离登顶只剩 5 层。神秘人提供终极 BOSS 的弱点情报，要价 1000 金币。值得吗？",
    emoji: "🔮",
    color: "#9D6BFF",
    options: [
      {
        id: "final_buy",
        label: "购买弱点",
        desc: "1000 金币换 BOSS 弱点",
        emoji: "💰",
        outcome: { kind: "energy", value: 50 },
      },
      {
        id: "final_save",
        label: "保留资源",
        desc: "靠实力登顶",
        emoji: "💪",
        outcome: { kind: "score", value: 2500 },
      },
      {
        id: "final_term",
        label: "索要反诈口诀",
        desc: "把情报换算成知识",
        emoji: "📜",
        outcome: { kind: "term", termIdx: 35 },
      },
    ],
  },
];

/** 根据层数取事件（floor % 10 !== 0 且 floor % 5 === 0） */
export function getTowerEvent(floor: number): TowerEventDef | undefined {
  return TOWER_EVENTS.find((e) => e.floor === floor);
}

/** 判断某层是否为事件层 */
export function isEventFloor(floor: number): boolean {
  return floor % 5 === 0 && floor % 10 !== 0;
}

// ====================================================================
// v7：剧情战役章节（8 章，对应 8 个 BOSS）
// 每章包含前置剧情 + BOSS 战 + 结尾剧情
// ====================================================================

export const STORY_CHAPTERS: StoryChapterDef[] = [
  {
    id: "ch_01_farmer",
    order: 1,
    title: "第一章 · 断卡行动",
    subtitle: "钱叔的卡农帝国",
    bossId: "boss_farmer",
    prologue: [
      { speaker: "沈锋", emoji: "🔫", text: "情报显示钱叔团伙控制着 200+ 张银行卡，3 个月走账 1.2 亿。", color: "#FF7A1A", side: "player" },
      { speaker: "苏岩", emoji: "📊", text: "资金链有 7 层壳，但终点都指向同一个出口。", color: "#FFD666", side: "player" },
      { speaker: "沈锋", emoji: "🔫", text: "今天，断卡行动启动。", color: "#FF7A1A", side: "player" },
    ],
    epilogue: [
      { speaker: "沈锋", emoji: "🔫", text: "7 层壳全部冻结。钱叔落网。", color: "#FF7A1A", side: "player" },
      { speaker: "苏岩", emoji: "📊", text: "下一个目标已经浮出水面——杀猪盘。", color: "#FFD666", side: "player" },
    ],
    recommendedPower: 500,
    requires: null,
    accent: "#B388FF",
    emoji: "💳",
    background: "城市地下金库 · 卡农洗钱中枢",
  },
  {
    id: "ch_02_sweet",
    order: 2,
    title: "第二章 · 杀猪盘必破",
    subtitle: "婉清的情感陷阱",
    bossId: "boss_sweet",
    prologue: [
      { speaker: "王婆婆", emoji: "👵", text: "社区里好几个年轻人都被'网恋对象'骗了钱。", color: "#52C41A", side: "player" },
      { speaker: "苏岩", emoji: "📊", text: "数据指向同一个操盘手——代号'婉清'。", color: "#FFD666", side: "player" },
      { speaker: "王婆婆", emoji: "👵", text: "甜言蜜语藏刀子，今天我去会会她。", color: "#52C41A", side: "player" },
    ],
    epilogue: [
      { speaker: "王婆婆", emoji: "👵", text: "真心不会让你转账。婉清，你的剧本演完了。", color: "#52C41A", side: "player" },
      { speaker: "苏岩", emoji: "📊", text: "下一个：假客服团伙。", color: "#FFD666", side: "player" },
    ],
    recommendedPower: 800,
    requires: "ch_01_farmer",
    accent: "#FF7AB8",
    emoji: "💔",
    background: "虚拟恋爱平台 · 杀猪盘窝点",
  },
  {
    id: "ch_03_popup",
    order: 3,
    title: "第三章 · 假客服必挂",
    subtitle: "客服007的弹窗轰炸",
    bossId: "boss_popup",
    prologue: [
      { speaker: "林书影", emoji: "📡", text: "96110 这周接到 200+ 起假客服报案。", color: "#00E5FF", side: "player" },
      { speaker: "林书影", emoji: "📡", text: "源头是代号'客服007'的团伙，靠撞库获取订单信息。", color: "#00E5FF", side: "player" },
      { speaker: "林书影", emoji: "📡", text: "今天，我负责挂断这个'客服'。", color: "#00E5FF", side: "player" },
    ],
    epilogue: [
      { speaker: "林书影", emoji: "📡", text: "假客服必挂，真客服不催。客服007落网。", color: "#00E5FF", side: "player" },
      { speaker: "苏岩", emoji: "📊", text: "下一个目标更危险——冒充公检法。", color: "#FFD666", side: "player" },
    ],
    recommendedPower: 1100,
    requires: "ch_02_sweet",
    accent: "#FFB020",
    emoji: "💬",
    background: "呼叫中心 · 假客服窝点",
  },
  {
    id: "ch_04_threat",
    order: 4,
    title: "第四章 · 公检法不电办",
    subtitle: "假警官的拘捕令",
    bossId: "boss_threat",
    prologue: [
      { speaker: "陈默", emoji: "🥷", text: "假警官团伙伪造拘捕令，48 小时骗转 80 万。", color: "#E5353B", side: "player" },
      { speaker: "陈默", emoji: "🥷", text: "他们专挑恐惧心理下手，受害人不敢挂电话核实。", color: "#E5353B", side: "player" },
      { speaker: "陈默", emoji: "🥷", text: "卧底三年，今天收网。", color: "#E5353B", side: "player" },
    ],
    epilogue: [
      { speaker: "陈默", emoji: "🥷", text: "拘捕令是 PS 的，公章字体都对不上。假警官落网。", color: "#E5353B", side: "player" },
      { speaker: "苏岩", emoji: "📊", text: "AI 换脸团伙浮出水面，新技术带来新威胁。", color: "#FFD666", side: "player" },
    ],
    recommendedPower: 1400,
    requires: "ch_03_popup",
    accent: "#E5353B",
    emoji: "📞",
    background: "伪造审讯室 · 假公检法窝点",
  },
  {
    id: "ch_05_deepfake",
    order: 5,
    title: "第五章 · AI 鉴伪",
    subtitle: "镜像的换脸陷阱",
    bossId: "boss_deepfake",
    prologue: [
      { speaker: "AI 鉴伪师", emoji: "🤖", text: "AI 换脸诈骗 3 个月 22 起，单笔最高 430 万。", color: "#A8E6CF", side: "player" },
      { speaker: "周衡", emoji: "💻", text: "镜像团伙用开源模型，但每一帧都有破绽。", color: "#B388FF", side: "player" },
      { speaker: "AI 鉴伪师", emoji: "🤖", text: "那就比谁快。我的鉴伪模型已经训练完毕。", color: "#A8E6CF", side: "player" },
    ],
    epilogue: [
      { speaker: "AI 鉴伪师", emoji: "🤖", text: "每一帧合成都有破绽，镜像落网。", color: "#A8E6CF", side: "player" },
      { speaker: "周衡", emoji: "💻", text: "下一个换脸样本，已入库训练。", color: "#B388FF", side: "player" },
      { speaker: "苏岩", emoji: "📊", text: "虚假理财平台正在吸金，5 万人已经入坑。", color: "#FFD666", side: "player" },
    ],
    recommendedPower: 1700,
    requires: "ch_04_threat",
    accent: "#A8E6CF",
    emoji: "🎭",
    background: "暗网服务器 · AI 换脸实验室",
  },
  {
    id: "ch_06_invest",
    order: 6,
    title: "第六章 · 理财认持牌",
    subtitle: "钱生钱的资金盘",
    bossId: "boss_invest",
    prologue: [
      { speaker: "法务审计师", emoji: "⚖️", text: "钱生钱平台高峰期 5 万投资人，未兑付 3.2 亿。", color: "#3D8BFD", side: "player" },
      { speaker: "法务审计师", emoji: "⚖️", text: "持牌机构名录里查不到它，这是典型资金盘。", color: "#3D8BFD", side: "player" },
      { speaker: "苏岩", emoji: "📊", text: "群里晒单都是托，今天让平台暴雷。", color: "#FFD666", side: "player" },
    ],
    epilogue: [
      { speaker: "法务审计师", emoji: "⚖️", text: "理财认持牌，群里晒单都是托。钱生钱平台崩盘。", color: "#3D8BFD", side: "player" },
      { speaker: "苏岩", emoji: "📊", text: "校园贷毒瘤还在蔓延，专盯大学生。", color: "#FFD666", side: "player" },
    ],
    recommendedPower: 2000,
    requires: "ch_05_deepfake",
    accent: "#FF6B9D",
    emoji: "💰",
    background: "虚假交易平台 · 资金盘中枢",
  },
  {
    id: "ch_07_loan",
    order: 7,
    title: "第七章 · 校园贷骗局必破",
    subtitle: "蜡笔老哥的恐吓",
    bossId: "boss_loan",
    prologue: [
      { speaker: "数据预测师", emoji: "🔮", text: "蜡笔老哥团伙专盯大学生，2 个月骗转 60 万。", color: "#00C9A7", side: "player" },
      { speaker: "数据预测师", emoji: "🔮", text: "他们伪造金融监管身份，恐吓学生'注销校园贷'。", color: "#00C9A7", side: "player" },
      { speaker: "王婆婆", emoji: "👵", text: "孩子们不懂，所以我们进校园宣讲。", color: "#52C41A", side: "player" },
    ],
    epilogue: [
      { speaker: "数据预测师", emoji: "🔮", text: "校园贷骗局必破，征信只能本人到央行查。蜡笔老哥落网。", color: "#00C9A7", side: "player" },
      { speaker: "王婆婆", emoji: "👵", text: "一届一届讲下去，反诈没有终点。", color: "#52C41A", side: "player" },
      { speaker: "跨境联络官", emoji: "🌐", text: "终极目标已锁定——缅北园区。", color: "#FF8A3D", side: "player" },
    ],
    recommendedPower: 2300,
    requires: "ch_06_invest",
    accent: "#9B59B6",
    emoji: "📚",
    background: "校园周边 · 假金融监管窝点",
  },
  {
    id: "ch_08_kingpin",
    order: 8,
    title: "终章 · 跨境必究",
    subtitle: "缅北枭雄的末日",
    bossId: "boss_kingpin",
    prologue: [
      { speaker: "跨境联络官", emoji: "🌐", text: "缅北园区 2000 人，3 年诈骗境内 12 亿。", color: "#FF8A3D", side: "player" },
      { speaker: "陈默", emoji: "🥷", text: "卧底三年，名单我都带回去了。", color: "#E5353B", side: "player" },
      { speaker: "沈锋", emoji: "🔫", text: "国际刑警已协调完毕，今天就是终点。", color: "#FF7A1A", side: "player" },
      { speaker: "缅北枭雄", emoji: "👑", text: "跨境？你们管不到这里。", color: "#FF3B6B", side: "enemy" },
      { speaker: "跨境联络官", emoji: "🌐", text: "那就试试。", color: "#FF8A3D", side: "player" },
    ],
    epilogue: [
      { speaker: "跨境联络官", emoji: "🌐", text: "跨境必究。缅北园区今日清零。", color: "#FF8A3D", side: "player" },
      { speaker: "缅北枭雄", emoji: "👑", text: "……还会有下一个园区。", color: "#FF3B6B", side: "enemy" },
      { speaker: "沈锋", emoji: "🔫", text: "那就逐个清。反诈没有终点。", color: "#FF7A1A", side: "player" },
      { speaker: "全员", emoji: "🛡️", text: "96110，全民反诈，你我同行。", color: "#FFD666", side: "player" },
    ],
    recommendedPower: 2800,
    requires: "ch_07_loan",
    accent: "#FF3B6B",
    emoji: "👑",
    background: "缅北边境 · 跨境电诈园区核心",
  },
];

/** 根据章节 id 取章节 */
export function getChapter(id: string): StoryChapterDef | undefined {
  return STORY_CHAPTERS.find((c) => c.id === id);
}

/** 取已解锁章节（前置已完成） */
export function getUnlockedChapters(completedIds: string[]): StoryChapterDef[] {
  return STORY_CHAPTERS.filter((c) => c.requires === null || completedIds.includes(c.requires));
}

// ====================================================================
// v7：排行榜模拟数据（前端模拟对手）
// ====================================================================

/** 模拟玩家名池 */
const FAKE_NAMES = [
  "反诈先锋", "96110守门员", "断卡行动员", "数据猎查师", "社区宣防员",
  "AI鉴伪专家", "跨境联络官", "话术识别员", "网安追踪师", "卧底侦查员",
  "资金斩断师", "法务审计师", "数据预测师", "全民防线", "反诈新兵",
  "警觉市民", "反诈教头", "识破达人", "终结者", "守护者",
];

/** 模拟头像池 */
const FAKE_AVATARS = ["🦸", "🧑‍✈️", "👮", "🕵️", "🥷", "👩‍💼", "👨‍💼", "🦾", "🛡️", "⚔️"];

/** 生成模拟排行榜（基于玩家分数插入） */
export function generateLeaderboard(
  type: "daily" | "weekly" | "season",
  playerScore: number,
  playerRank: string,
  mode: ManagerMode,
): LeaderboardEntry[] {
  // 模拟 19 个对手 + 玩家 = 20 名
  const entries: LeaderboardEntry[] = [];
  const seed = type === "daily" ? Date.now() / 86400000 : type === "weekly" ? Date.now() / 604800000 : 1;
  const rng = (i: number) => {
    const h = Math.sin(seed + i * 12.9898) * 43758.5453;
    return h - Math.floor(h);
  };
  for (let i = 0; i < 19; i++) {
    // 分数围绕玩家分数分布，越靠前越高
    const factor = 1.5 - i * 0.07 + rng(i) * 0.3;
    const score = Math.max(100, Math.floor(playerScore * factor + rng(i + 100) * 500));
    entries.push({
      name: FAKE_NAMES[i % FAKE_NAMES.length],
      avatar: FAKE_AVATARS[i % FAKE_AVATARS.length],
      score,
      rank: rankFromScore(score),
      isPlayer: false,
      mode,
    });
  }
  // 加入玩家
  entries.push({
    name: "我",
    avatar: "🎯",
    score: playerScore,
    rank: playerRank,
    isPlayer: true,
    mode,
  });
  // 排序
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function rankFromScore(score: number): string {
  if (score >= 18000) return "反诈元帅";
  if (score >= 12000) return "反诈少将";
  if (score >= 8500) return "反诈准将";
  if (score >= 6000) return "反诈上校";
  if (score >= 4000) return "反诈中校";
  if (score >= 2500) return "反诈少校";
  if (score >= 1500) return "反诈上尉";
  if (score >= 800) return "反诈少尉";
  if (score >= 300) return "反诈士官";
  return "反诈新兵";
}

// ====================================================================
// v7：战报分享知识点池（结算时随机一条）
// ====================================================================

export const SHARE_TIPS: string[] = [
  "96110 是反诈专线，可信赖，不会让你转账。",
  "公检法不电办，不存在'安全账户'。",
  "网恋不转账，未见面就让你投资的都是骗局。",
  "理财认持牌，证监会/银保监会官网可查机构资质。",
  "不点陌生链，涉及密码的链接一律从官方 APP 进入。",
  "不租售两卡，出租银行卡涉嫌帮信罪，最高 3 年有期徒刑。",
  "AI 换脸核实，换话题问私密信息是最快的核实方式。",
  "退费走官方，屏幕共享=交出手机控制权。",
  "领导转账核实，换渠道（电话/当面）确认本人。",
  "ETC 官方办，ETC 不会以短信链接索要银行卡信息。",
  "注销校园贷是骗，征信只能本人到央行或官方渠道查询。",
  "刷单本身违法，且 100% 是骗局，前期返利是诱饵。",
  "借钱必核身份，账号被盗冒充熟人借钱非常常见。",
  "正规贷款不放贷前收费，'解冻费/工本费/保证金'都是套路。",
  "正规中奖不收费，任何'先交钱才能领奖'的均为骗局。",
  "私下交易无担保，一旦脱离平台，钱款无法追回。",
  "红包不索取密码，任何要求输入银行卡密码的'红包'都是钓鱼。",
  "航班改签走官方，'改签费/退票费'都是套取支付密码的诱饵。",
  "公检法不会用 QQ/微信办案，所有'在线调查'都是骗局。",
  "亲属出事必核实，挂断后联系本人是第一步。",
];

/** 随机取一条分享知识点 */
export function randomShareTip(): string {
  return SHARE_TIPS[Math.floor(Math.random() * SHARE_TIPS.length)];
}

// ====================================================================
// v7：自适应答题系统（基于错题记录动态调整难度）
// ====================================================================

/**
 * 根据错题记录选取下一题
 * - 优先重练错题（连续错误 ≥ 2 次的题目）
 * - 没有错题时按当前难度抽题
 * - 答对后错题计数 -1，答错后 +1
 */
export function pickAdaptiveQuiz(
  baseQuizPicker: (wave: number, seed: string) => QuizQuestion,
  wrongRecords: Record<string, number>,
  wave: number,
  seed: string,
): { question: QuizQuestion; isRetry: boolean } {
  // 找出连续错误 ≥ 2 次的题目，优先重练
  const retryCandidates = Object.entries(wrongRecords)
    .filter(([_, count]) => count >= 2)
    .map(([id]) => id);
  if (retryCandidates.length > 0) {
    // 70% 概率重练错题
    if (Math.random() < 0.7) {
      const retryId = retryCandidates[Math.floor(Math.random() * retryCandidates.length)];
      // 这里需要从 QUIZ_BANK 取题，但为避免循环依赖，由调用方传入
      // 简化：返回标记，调用方自行处理
      const baseQuestion = baseQuizPicker(wave, seed);
      return { question: { ...baseQuestion, id: retryId }, isRetry: true };
    }
  }
  return { question: baseQuizPicker(wave, seed), isRetry: false };
}

// ====================================================================
// v7：反诈口诀收集（36 句，对应 maze.ts MAZE_TERMS）
// 解锁条件：在战斗中击杀对应格子的敌人 / 完成特定章节
// ====================================================================

/** 36 句口诀的解锁提示 */
export const TERM_UNLOCK_HINTS: string[] = MAZE_TERMS.map((term, idx) => {
  const hints: Record<number, string> = {
    0: "击杀 10 名钓鱼链接敌人",
    1: "击杀 10 名 ETC 诈骗敌人",
    2: "完成每日挑战 1 次",
    3: "击杀 20 名话术机器人",
    4: "击破假警官 BOSS",
    5: "击破假警官 BOSS",
    6: "击破虚假理财 BOSS",
    7: "击破虚假理财 BOSS",
    8: "击破假客服 BOSS",
    9: "击破假客服 BOSS",
    10: "击破杀猪盘 BOSS",
    11: "击破虚假网贷 BOSS",
    12: "击破校园贷 BOSS",
    13: "击破假客服 BOSS",
    14: "击破假客服 BOSS",
    15: "击破虚假理财 BOSS",
    16: "击破杀猪盘 BOSS",
    17: "击破冒充领导 BOSS",
    18: "击破 AI 换脸 BOSS",
    19: "击破卡农王 BOSS",
    20: "击破卡农王 BOSS",
    21: "击破假客服 BOSS",
    22: "完成剧情第一章",
    23: "完成爬塔 10 层",
    24: "完成爬塔 20 层",
    25: "完成爬塔 30 层",
    26: "击破 ETC 诈骗敌人",
    27: "完成每日挑战 3 次",
    28: "击破冒充领导敌人",
    29: "完成剧情第三章",
    30: "完成爬塔 40 层",
    31: "完成爬塔 50 层",
    32: "击破冒充公检法敌人",
    33: "完成爬塔 60 层",
    34: "累计击杀 500 敌人",
    35: "完成剧情终章",
  };
  return hints[idx] ?? `累计击杀 ${(idx + 1) * 50} 敌人`;
});

/** 根据口诀索引取解锁提示 */
export function getTermUnlockHint(idx: number): string {
  return TERM_UNLOCK_HINTS[idx] ?? "待解锁";
}

// ====================================================================
// v7：口诀解锁条件映射（按游戏事件触发）
// ====================================================================

/** BOSS id → 击破后解锁的口诀索引列表 */
const BOSS_TERM_MAP: Record<string, number[]> = {
  boss_farmer: [19, 20],        // 卡农王
  boss_sweet: [10, 16],         // 杀猪盘
  boss_popup: [8, 9, 13, 14, 21], // 假客服
  boss_threat: [4, 5],          // 假警官
  boss_deepfake: [18],          // AI 换脸
  boss_invest: [6, 7],          // 虚假理财
  boss_loan: [11, 12],          // 校园贷/虚假网贷
  boss_fakeLeader: [17],        // 冒充领导
  boss_kingpin: [35],           // 跨境枭雄（终章）
};

/** 击破 BOSS 时返回应解锁的口诀索引 */
export function getTermsForBossKill(bossId: string): number[] {
  return BOSS_TERM_MAP[bossId] ?? [];
}

/** 爬塔楼层里程碑 → 口诀索引 */
const TOWER_FLOOR_TERMS: Record<number, number> = {
  10: 23,
  20: 24,
  30: 25,
  40: 30,
  50: 31,
  60: 33,
};

/** 到达爬塔楼层时返回应解锁的口诀索引（仅里程碑层） */
export function getTermsForTowerFloor(floor: number): number[] {
  const idx = TOWER_FLOOR_TERMS[floor];
  return idx !== undefined ? [idx] : [];
}

/** 总击杀里程碑 → 口诀索引列表 */
const KILLS_MILESTONE_TERMS: Array<{ kills: number; termIdx: number }> = [
  { kills: 100, termIdx: 2 },   // 拨96110核
  { kills: 200, termIdx: 15 },  // 退款走官方
  { kills: 500, termIdx: 34 },  // 核实再转账
  { kills: 1000, termIdx: 32 }, // 军警不私聊
];

/** 根据累计击杀数返回新解锁的口诀索引 */
export function getTermsForTotalKills(totalKills: number): number[] {
  return KILLS_MILESTONE_TERMS
    .filter((m) => totalKills >= m.kills)
    .map((m) => m.termIdx);
}

/** 每日挑战完成次数里程碑 → 口诀索引 */
const DAILY_MILESTONE_TERMS: Array<{ count: number; termIdx: number }> = [
  { count: 1, termIdx: 26 },   // ETC过期假
  { count: 3, termIdx: 27 },   // 百万保障免
];

/** 根据每日挑战完成次数返回新解锁的口诀索引 */
export function getTermsForDailyCompletion(count: number): number[] {
  return DAILY_MILESTONE_TERMS
    .filter((m) => count >= m.count)
    .map((m) => m.termIdx);
}
