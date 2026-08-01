/**
 * 诈园区（bomb-island）v6 升级数据层
 * - 5 模式配置（剧情/每日/极速/硬核）
 * - 5 关剧情关卡定义
 * - 真实案例档案库（FBCaseArchive 复用）
 * - 受害者档案库（FBVictimProfile 复用）
 * - 知识图谱布局
 * - 武器升级树（每武器 3 分支）
 * - 道具升星配置（1-5★）
 * - 每日挑战规则池
 * - 反诈行动评级阈值
 */
import type {
  BombStoryStage, BombCaseArchive, BombVictimProfile,
  BombKnowledgeNode, WeaponUpgradeTree, ItemStarDef,
  BombDailyRule, BombTierRating, WeaponKind, ItemId,
  ParkTierDef,
} from "./types";
import { PARK_TIERS, TIER_BOSSES } from "./data";

// ============ v6 剧情模式：5 关线性剧本 ============

/**
 * 剧情战役 5 关：从湄公河行动到总部决战，每关固定档位+Boss+通关条件。
 * 关卡设计参考真实反诈大事件：湄公河行动 → 缅北扫荡 → 妙瓦底解救 → 总部决战 → 全球收网
 */
export const STORY_STAGES: BombStoryStage[] = [
  {
    idx: 0, id: "stage-1", name: "第一关：湄公河行动",
    intro: "情报显示妙瓦底园区正在大量骗取国人资金。反诈意大利炮已部署就位，先拿'血汗工厂主'开刀，给电诈集团一个下马威！",
    outro: "血汗工厂主落网！解救多名被困受害者。但据供述，这只是冰山一角……",
    tierStructure: "den", bossIdx: 0, passWaves: 3, passDestroyRate: 0.7,
    themeColor: "#9FE3FF", icon: "🌊", caseArchiveId: "case-myanmar-1",
  },
  {
    idx: 1, id: "stage-2", name: "第二关：缅北扫荡",
    intro: "缅北武装集团以武力掩护大规模电诈窝点。武装头目放出狠话：'有本事就来打！'。是时候让他们见识反诈正义联盟的火力了。",
    outro: "缅北武装头目被击溃！缴获大量作案工具。但洗钱水房老板带着资金逃向了总部……",
    tierStructure: "kokang", bossIdx: 0, passWaves: 4, passDestroyRate: 0.75,
    rule: "Boss 反击频率 +20%",
    themeColor: "#FFB020", icon: "🎯", caseArchiveId: "case-kokang-1",
  },
  {
    idx: 2, id: "stage-3", name: "第三关：妙瓦底解救",
    intro: "话术培训师仍在妙瓦底操纵情感骗术，多名受害者被困铁笼。这次行动不仅要击败 Boss，更要尽可能解救更多受害者！",
    outro: "话术培训师落网！被困受害者全部解救。线索指向跨境电诈首脑所在的总部核心……",
    tierStructure: "den", bossIdx: 1, passWaves: 5, passDestroyRate: 0.8,
    rule: "必须救援至少 5 名受害者",
    themeColor: "#FF7A1A", icon: "🔓", caseArchiveId: "case-myanmar-2",
  },
  {
    idx: 3, id: "stage-4", name: "第四关：总部决战",
    intro: "反诈联盟兵临总部核心，跨境电诈首脑亲自坐镇。他拥有 AI 换脸伪装、全方位导弹覆盖，是迄今为止最强对手。",
    outro: "首脑被击败！但暗网数据王带着大量个人信息试图从迪拜园区转出……必须立即追击！",
    tierStructure: "hq", bossIdx: 0, passWaves: 6, passDestroyRate: 0.85,
    rule: "首脑 3 阶段全开·无道具补给",
    themeColor: "#B388FF", icon: "👑", caseArchiveId: "case-hq-1",
  },
  {
    idx: 4, id: "stage-5", name: "第五关：全球收网",
    intro: "最终决战！迪拜园区洗钱网络 + 西非庞氏骗局跨洲中转，反诈联盟发起全球同步收网行动。这一战，彻底摧毁电诈集团的全球链条！",
    outro: "电诈集团全球链条被彻底摧毁！所有首脑落网，受害者获救，资金追回。全民反诈，天下无诈！",
    tierStructure: "wafrica", bossIdx: 1, passWaves: 8, passDestroyRate: 0.9,
    rule: "双 Boss 轮战·地狱难度",
    themeColor: "#E5353B", icon: "🌍", caseArchiveId: "case-wafrica-1",
  },
];

/** 获取剧情关卡 */
export function getStoryStage(idx: number): BombStoryStage | null {
  return STORY_STAGES[idx] ?? null;
}

/** 获取剧情关卡的园区档位定义 */
export function getStoryTier(stage: BombStoryStage): ParkTierDef {
  return PARK_TIERS.find(t => t.structure === stage.tierStructure) ?? PARK_TIERS[0];
}

/** 获取剧情关卡的 Boss 定义 */
export function getStoryBoss(stage: BombStoryStage) {
  const list = TIER_BOSSES[stage.tierStructure];
  return list[stage.bossIdx] ?? list[0];
}

// ============ v6 真实案例档案库 ============

/**
 * 真实案例档案：击败 Boss 后展示，按园区档位关联。
 * 复用 fraudBuster 的 FBCaseArchive 结构，强化反诈教育属性。
 */
export const CASE_ARCHIVES: Record<string, BombCaseArchive> = {
  "case-myanmar-1": {
    title: "妙瓦底电诈园区：境外高薪招聘陷阱",
    date: "2023-08-15",
    source: "国家反诈中心",
    takeaway: "境外高薪招聘信息几乎都是电诈陷阱",
    body: "不法分子以'月入数万包吃住'为诱饵，将受害者骗至妙瓦底等境外电诈园区，没收护照、限制人身自由，强迫从事电信诈骗。受害者遭受殴打、电击、关水牢等虐待。",
    hotline: "12308",
    points: [
      "境外高薪招聘信息几乎都是电诈陷阱",
      "被诱骗至园区应立即联系中国驻当地使馆",
      "拨打 12308 领事保护热线 24 小时求助",
    ],
    tierStructure: "den",
  },
  "case-myanmar-2": {
    title: "杀猪盘话术：网恋交友诱导投资",
    date: "2024-03-22",
    source: "公安部刑侦局",
    takeaway: "网恋对象引导投资/赌博的，几乎都是诈骗",
    body: "电诈园区话术师编写标准化'养猪'剧本，通过社交平台伪装成成功人士与受害者建立感情，再以'内幕消息/稳赚不赔'诱导投资虚假平台，最终卷款跑路。",
    hotline: "96110",
    points: [
      "网恋对象引导投资/赌博的，几乎都是诈骗",
      "投资平台无法提现时已被骗，应立即报警",
      "96110 来电务必接听，可能正在被骗",
    ],
    tierStructure: "den",
  },
  "case-kokang-1": {
    title: "缅北武装电诈集团：暴力掩护下的跨境犯罪",
    date: "2023-11-07",
    source: "公安部新闻",
    takeaway: "武装集团控制下的电诈窝点将被依法铲除",
    body: "缅北地区武装集团以武力掩护大规模电诈窝点，配备武装看守防止人员逃脱。该集团涉及网络赌博、冒充客服、投资理财等多种诈骗，案值达数百亿元。",
    hotline: "96110",
    points: [
      "武装集团控制下的电诈窝点将被依法铲除",
      "网络赌博十赌十输，后台可操纵输赢",
      "跨境联合执法持续打击境外电诈集团",
    ],
    tierStructure: "kokang",
  },
  "case-hq-1": {
    title: "跨境电诈首脑：数罪并罚从重惩处",
    date: "2024-07-30",
    source: "最高人民法院",
    takeaway: "组织领导电诈集团将数罪并罚、从重惩处",
    body: "跨境电诈集团首脑组织领导诈骗、非法拘禁、故意伤害、洗钱等多类犯罪，涉案金额巨大、受害者众多。依法将被数罪并罚、从重惩处，最高可判无期徒刑。",
    hotline: "110",
    points: [
      "组织领导电诈集团将数罪并罚、从重惩处",
      "涉案金额特别巨大可判十年以上至无期",
      "主动投案自首、检举立功可依法从轻处理",
    ],
    tierStructure: "hq",
  },
  "case-dubai-1": {
    title: "虚拟币洗钱：链上不是法外之地",
    date: "2024-09-12",
    source: "公安部经侦局",
    takeaway: "虚拟货币交易全链路可追溯",
    body: "迪拜园区通过虚拟货币混币器、跨链桥、OTC 商户将被骗资金洗白。提供 USDT 帮助换汇的'跑分客'同样涉嫌掩饰、隐瞒犯罪所得罪，最高可判 7 年有期徒刑。",
    hotline: "96110",
    points: [
      "虚拟货币交易全链路可追溯，不要心存侥幸",
      "出借钱包地址帮人收款 = 协助洗钱",
      "境外资产转移须合规申报，否则涉嫌洗钱罪",
    ],
    tierStructure: "dubai",
  },
  "case-wafrica-1": {
    title: "跨洲诈骗中转：犯罪链条全球化",
    date: "2025-01-20",
    source: "国际刑警组织中国国家中心局",
    takeaway: "跨国电诈集团首脑将被引渡回国受审",
    body: "跨洲中转王以'跨国贸易'为掩护，将诈骗资金经多个国家中转洗白，并协调各地诈骗团伙分工。我国与多国建立反诈执法合作机制，联合打击跨境电诈，引渡首脑归案。",
    hotline: "110",
    points: [
      "跨国电诈集团首脑将被引渡回国受审",
      "跨国贸易合同须核实对方资质与资金来源",
      "联合执法持续推进，跨境电诈无处遁形",
    ],
    tierStructure: "wafrica",
  },
  // 兜底默认档案
  "default": {
    title: "反诈行动档案",
    date: "2026-01-01",
    source: "国家反诈中心",
    takeaway: "全民反诈，天下无诈",
    body: "反诈意大利炮行动持续中。每一次出击，都让电诈集团无处遁形。",
    hotline: "96110",
    points: ["96110 来电务必接听", "不轻信、不转账、不泄露"],
    tierStructure: "den",
  },
};

/** 取案例档案（兜底默认） */
export function getCaseArchive(id?: string): BombCaseArchive {
  if (!id) return CASE_ARCHIVES.default;
  return CASE_ARCHIVES[id] ?? CASE_ARCHIVES.default;
}

// ============ v6 受害者档案库 ============

/**
 * 9 种受害者档案：救援达到一定数量后解锁。
 * 复用 fraudBuster 的 FBVictimProfile 设计，按心理弱点分类。
 */
export const VICTIM_PROFILES: BombVictimProfile[] = [
  {
    typeId: "GREED", name: "贪婪型受害者", color: "#FFD666",
    desc: "你容易被'高收益、稳赚不赔'话术吸引，对利益诱惑防御力较低。",
    weakness: ["greed", "scarcity"],
    vulnerableScenes: ["杀猪盘", "虚假投资", "刷单返利", "虚假中奖"],
    advice: [
      "牢记'保本与高收益不可兼得'",
      "任何'稳赚不赔'都是诈骗",
      "投资只认持牌金融机构",
    ],
    severity: 0, unlockAtRescued: 5,
  },
  {
    typeId: "FEAR", name: "恐惧型受害者", color: "#E5353B",
    desc: "你容易被'拘捕、影响征信、案件保密'等恐吓话术压迫，慌乱中容易服从。",
    weakness: ["fear", "authority"],
    vulnerableScenes: ["冒充公检法", "注销校园贷", "冒充客服"],
    advice: [
      "公检法不会电话办案，更无'安全账户'",
      "挂断后拨打 96110 核实",
      "征信不能靠转账'注销'",
    ],
    severity: 0, unlockAtRescued: 10,
  },
  {
    typeId: "TRUST", name: "信任型受害者", color: "#52C41A",
    desc: "你过于相信'熟人、领导、客服'的身份伪装，缺乏二次核实习惯。",
    weakness: ["trust", "authority"],
    vulnerableScenes: ["冒充熟人/领导", "冒充客服退款", "冒充老师收费"],
    advice: [
      "换号+不方便接电话+代转=冒充领导标配",
      "任何'理赔'都到官方 APP 核实",
      "家长群缴费务必电话核实",
    ],
    severity: 0, unlockAtRescued: 15,
  },
  {
    typeId: "INTIMACY", name: "情感型受害者", color: "#FF7A1A",
    desc: "你容易被'嘘寒问暖、情感亲密'建立依赖，对'带你赚钱'防备不足。",
    weakness: ["intimacy", "greed"],
    vulnerableScenes: ["杀猪盘", "网恋交友", "甜言蜜语诈骗"],
    advice: [
      "优质异性主动带投资=杀猪盘",
      "不见面只网恋+谈钱=高危",
      "保密参与'漏洞'套利=诈骗",
    ],
    severity: 0, unlockAtRescued: 20,
  },
  {
    typeId: "URGENCY", name: "紧迫型受害者", color: "#FF5A60",
    desc: "你在'截止时间、名额有限、立即执行'等紧迫氛围下容易仓促决策。",
    weakness: ["urgency", "scarcity"],
    vulnerableScenes: ["虚假退票", "双11理赔", "冒充老师收费"],
    advice: [
      "越催越急越要冷静",
      "限时优惠/名额有限是常用话术",
      "挂断电话给自己 30 秒思考",
    ],
    severity: 0, unlockAtRescued: 25,
  },
  {
    typeId: "CURIOSITY", name: "好奇型受害者", color: "#00E5FF",
    desc: "你对'扫码领取、免费送、内部消息'等好奇心诱饵防备不足。",
    weakness: ["curiosity", "greed"],
    vulnerableScenes: ["虚假红包", "免费送皮肤", "数字人民币钓鱼"],
    advice: [
      "陌生链接一律不点",
      "免费送/扫码领=钓鱼",
      "不明二维码不要扫",
    ],
    severity: 0, unlockAtRescued: 30,
  },
  {
    typeId: "INVEST", name: "投资型受害者", color: "#B388FF",
    desc: "你对'内幕消息、稳赚项目'过于信任，缺乏对平台的合规核查。",
    weakness: ["greed", "trust"],
    vulnerableScenes: ["虚拟币杀猪盘", "庞氏骗局", "虚假理财"],
    advice: [
      "我国禁止虚拟币交易业务",
      "保本高息=庞氏骗局",
      "理财只认持牌机构",
    ],
    severity: 0, unlockAtRescued: 35,
  },
  {
    typeId: "AUTHORITY", name: "权威型受害者", color: "#FFB020",
    desc: "你对'公检法、银行、政府'等权威身份天然服从，缺乏质疑精神。",
    weakness: ["authority", "fear"],
    vulnerableScenes: ["冒充公检法", "冒充银行", "冒充政府补贴"],
    advice: [
      "权威机构不会电话要求转账",
      "政府补贴不靠电话办理",
      "遇到'安全账户'立即挂断",
    ],
    severity: 0, unlockAtRescued: 40,
  },
  {
    typeId: "SUNK", name: "沉没成本型受害者", color: "#9FE3FF",
    desc: "你已经投入资金后，明知可疑仍继续追加，希望'回本'。",
    weakness: ["sunkCost", "greed"],
    vulnerableScenes: ["杀猪盘后期", "投资平台提现受阻", "刷单连单"],
    advice: [
      "提现要交钱=100% 诈骗",
      "及时止损比追回更重要",
      "已被骗立即报警，不要继续转账",
    ],
    severity: 0, unlockAtRescued: 50,
  },
];

/** 根据累计救援数匹配受害者档案（达到 unlockAtRescued 阈值时解锁） */
export function matchVictimProfile(totalRescued: number): BombVictimProfile | null {
  let matched: BombVictimProfile | null = null;
  for (const p of VICTIM_PROFILES) {
    if (totalRescued >= p.unlockAtRescued) matched = p;
  }
  return matched;
}

// ============ v6 知识图谱布局 ============

/**
 * 知识图谱节点布局：结算页交互式展示，关联模块类型。
 * 全局掌握度 = 各节点 mastery 加权平均。
 */
export const KNOWLEDGE_GRAPH_LAYOUT: BombKnowledgeNode[] = [
  // 妙瓦底园区组
  { id: "kg-den-1", name: "杀猪盘", category: "妙瓦底", correct: 0, total: 0, mastery: 0, x: 0.20, y: 0.25, links: ["kg-den-2", "kg-hq-1"] },
  { id: "kg-den-2", name: "境外高薪招聘", category: "妙瓦底", correct: 0, total: 0, mastery: 0, x: 0.30, y: 0.18, links: ["kg-den-1"] },
  { id: "kg-den-3", name: "裸聊敲诈", category: "妙瓦底", correct: 0, total: 0, mastery: 0, x: 0.15, y: 0.35, links: ["kg-den-1"] },
  // 缅北园区组
  { id: "kg-kokang-1", name: "冒充客服", category: "缅北", correct: 0, total: 0, mastery: 0, x: 0.45, y: 0.30, links: ["kg-kokang-2", "kg-den-1"] },
  { id: "kg-kokang-2", name: "网络赌博", category: "缅北", correct: 0, total: 0, mastery: 0, x: 0.55, y: 0.22, links: ["kg-kokang-1"] },
  { id: "kg-kokang-3", name: "冒充熟人", category: "缅北", correct: 0, total: 0, mastery: 0, x: 0.50, y: 0.40, links: ["kg-kokang-1"] },
  // 总部园区组
  { id: "kg-hq-1", name: "冒充公检法", category: "总部", correct: 0, total: 0, mastery: 0, x: 0.65, y: 0.30, links: ["kg-hq-2", "kg-den-1"] },
  { id: "kg-hq-2", name: "民族资产解冻", category: "总部", correct: 0, total: 0, mastery: 0, x: 0.70, y: 0.20, links: ["kg-hq-1"] },
  { id: "kg-hq-3", name: "刷单返利", category: "总部", correct: 0, total: 0, mastery: 0, x: 0.75, y: 0.35, links: ["kg-hq-1"] },
  // 迪拜园区组
  { id: "kg-dubai-1", name: "虚拟币洗钱", category: "迪拜", correct: 0, total: 0, mastery: 0, x: 0.80, y: 0.25, links: ["kg-dubai-2", "kg-wafrica-1"] },
  { id: "kg-dubai-2", name: "拉盘砸盘", category: "迪拜", correct: 0, total: 0, mastery: 0, x: 0.85, y: 0.40, links: ["kg-dubai-1"] },
  // 西非园区组
  { id: "kg-wafrica-1", name: "庞氏骗局", category: "西非", correct: 0, total: 0, mastery: 0, x: 0.90, y: 0.30, links: ["kg-dubai-1"] },
  { id: "kg-wafrica-2", name: "跨洲中转", category: "西非", correct: 0, total: 0, mastery: 0, x: 0.88, y: 0.50, links: ["kg-wafrica-1"] },
  // v6 新增模块对应节点
  { id: "kg-new-1", name: "虚假直播带货", category: "新型", correct: 0, total: 0, mastery: 0, x: 0.40, y: 0.55, links: ["kg-den-1"] },
  { id: "kg-new-2", name: "暗网数据黑市", category: "新型", correct: 0, total: 0, mastery: 0, x: 0.60, y: 0.55, links: ["kg-hq-1"] },
];

/** 模块类型 → 知识图谱节点 ID */
export const MODULE_TO_KG_NODE: Record<string, string> = {
  floor:      "kg-den-1",   // 杀猪盘
  dorm:       "kg-den-2",   // 境外高薪招聘
  cell:       "kg-den-3",   // 裸聊敲诈
  antenna:    "kg-kokang-1",// 冒充客服
  casino:     "kg-kokang-2",// 网络赌博
  wall:       "kg-kokang-3",// 冒充熟人
  fortress:   "kg-hq-1",    // 冒充公检法
  foundation: "kg-hq-2",    // 民族资产解冻
  server:     "kg-hq-3",    // 刷单返利
  minefarm:   "kg-dubai-1", // 虚拟币洗钱
  liveRoom:   "kg-new-1",   // 虚假直播带货
  darkweb:    "kg-new-2",   // 暗网数据黑市
  shock:      "kg-hq-1",    // 冒充反诈中心·保证金 → 归到公检法组
  cage:       "kg-den-3",   // 两卡犯罪 → 归到裸聊敲诈组
  guard:      "kg-kokang-2",// 冒充军警采购 → 归到网络赌博组（武装掩护）
};

/** 构建知识图谱（基于本局拆除统计） */
export function buildKnowledgeGraph(
  moduleKillStats: Partial<Record<string, number>>,
  moduleEncounterStats: Partial<Record<string, number>>,
): { nodes: BombKnowledgeNode[]; overallMastery: number } {
  const nodes = KNOWLEDGE_GRAPH_LAYOUT.map(n => ({ ...n }));
  let totalCorrect = 0;
  let totalAll = 0;
  for (const node of nodes) {
    // 反向映射：节点 ID → 模块类型
    const moduleType = Object.entries(MODULE_TO_KG_NODE).find(([, id]) => id === node.id)?.[0];
    if (!moduleType) continue;
    const correct = moduleKillStats[moduleType] ?? 0;
    const total = moduleEncounterStats[moduleType] ?? 0;
    node.correct = correct;
    node.total = total;
    node.mastery = total > 0 ? Math.min(1, correct / Math.max(1, total)) : 0;
    totalCorrect += correct;
    totalAll += total;
  }
  const overallMastery = totalAll > 0 ? totalCorrect / totalAll : 0;
  return { nodes, overallMastery };
}

// ============ v6 武器升级树（每武器 3 分支） ============

/**
 * 6 种武器 × 3 分支 = 18 种升级路径，玩家每武器只能选 1 分支。
 * 解锁条件：累计击破模块数达 unlockCost 时可选。
 */
export const WEAPON_UPGRADE_TREES: WeaponUpgradeTree[] = [
  {
    weapon: "standard",
    branches: [
      { id: "std-shotgun", name: "散弹强化", desc: "多管+1·伤害+10%", fireRateMul: 1.0, damageMul: 1.1, multishotBonus: 1, unlockCost: 30 },
      { id: "std-rapid", name: "速射强化", desc: "射速+25%·伤害-5%", fireRateMul: 1.25, damageMul: 0.95, multishotBonus: 0, unlockCost: 50 },
      { id: "std-pierce", name: "穿甲强化", desc: "穿透 2 模块·伤害+5%", fireRateMul: 1.0, damageMul: 1.05, multishotBonus: 0, special: "pierce", unlockCost: 70 },
    ],
  },
  {
    weapon: "cluster",
    branches: [
      { id: "clu-bigger", name: "大爆炸", desc: "子爆破+2·范围+30%", fireRateMul: 1.0, damageMul: 1.15, multishotBonus: 0, special: "explode", unlockCost: 40 },
      { id: "clu-rapid", name: "速射集束", desc: "射速+20%", fireRateMul: 1.2, damageMul: 1.0, multishotBonus: 0, unlockCost: 60 },
      { id: "clu-burn", name: "燃烧集束", desc: "附加燃烧 DoT", fireRateMul: 1.0, damageMul: 0.9, multishotBonus: 0, special: "burn", unlockCost: 80 },
    ],
  },
  {
    weapon: "emp",
    branches: [
      { id: "emp-longer", name: "持续强化", desc: "减速+1 秒", fireRateMul: 1.0, damageMul: 1.0, multishotBonus: 0, unlockCost: 35 },
      { id: "emp-chain", name: "连锁电磁", desc: "连锁至相邻模块", fireRateMul: 1.0, damageMul: 1.1, multishotBonus: 0, special: "chain", unlockCost: 65 },
      { id: "emp-damage", name: "高爆电磁", desc: "伤害+50%", fireRateMul: 1.0, damageMul: 1.5, multishotBonus: 0, unlockCost: 75 },
    ],
  },
  {
    weapon: "incendiary",
    branches: [
      { id: "inc-longer", name: "持续燃烧", desc: "燃烧区+2 秒", fireRateMul: 1.0, damageMul: 1.0, multishotBonus: 0, unlockCost: 40 },
      { id: "inc-damage", name: "炽焰强化", desc: "DPS+50%", fireRateMul: 1.0, damageMul: 1.5, multishotBonus: 0, unlockCost: 70 },
      { id: "inc-spread", name: "扩散燃烧", desc: "范围+50%", fireRateMul: 1.0, damageMul: 1.0, multishotBonus: 0, special: "explode", unlockCost: 80 },
    ],
  },
  {
    weapon: "laserCannon",
    branches: [
      { id: "laser-pierce", name: "深度穿透", desc: "穿透+2 模块", fireRateMul: 1.0, damageMul: 1.0, multishotBonus: 0, special: "pierce", unlockCost: 50 },
      { id: "laser-rapid", name: "速射激光", desc: "CD-30%", fireRateMul: 1.3, damageMul: 0.9, multishotBonus: 0, unlockCost: 70 },
      { id: "laser-overload", name: "过载激光", desc: "伤害+40%", fireRateMul: 1.0, damageMul: 1.4, multishotBonus: 0, unlockCost: 90 },
    ],
  },
  {
    weapon: "missileRain",
    branches: [
      { id: "mr-more", name: "导弹+2", desc: "导弹数+2", fireRateMul: 1.0, damageMul: 1.0, multishotBonus: 0, unlockCost: 60 },
      { id: "mr-homing", name: "制导强化", desc: "导弹追踪", fireRateMul: 1.0, damageMul: 1.0, multishotBonus: 0, special: "homing", unlockCost: 80 },
      { id: "mr-bigger", name: "重磅导弹", desc: "单发伤害+60%", fireRateMul: 1.0, damageMul: 1.6, multishotBonus: 0, unlockCost: 100 },
    ],
  },
];

/** 取指定武器的升级树 */
export function getWeaponTree(weapon: WeaponKind): WeaponUpgradeTree | null {
  return WEAPON_UPGRADE_TREES.find(t => t.weapon === weapon) ?? null;
}

// ============ v6 道具升星配置（1-5★） ============

/**
 * 11 种道具 × 5 星级。升星碎片由拆除模块掉落。
 * 1★=基础，5★=封顶。CD 更短、伤害更高、时长更长。
 */
export const ITEM_STAR_DEFS: Record<ItemId, ItemStarDef> = {
  bomb: { id: "bomb", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.0, fragmentsNeeded: 20, name: "2★" },
    { star: 3, cdMul: 0.8, damageMul: 1.5, durationMul: 1.0, fragmentsNeeded: 50, name: "3★" },
    { star: 4, cdMul: 0.7, damageMul: 1.8, durationMul: 1.0, fragmentsNeeded: 100, name: "4★" },
    { star: 5, cdMul: 0.6, damageMul: 2.2, durationMul: 1.0, fragmentsNeeded: 200, name: "5★" },
  ]},
  missile: { id: "missile", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.0, fragmentsNeeded: 25, name: "2★" },
    { star: 3, cdMul: 0.8, damageMul: 1.5, durationMul: 1.0, fragmentsNeeded: 60, name: "3★" },
    { star: 4, cdMul: 0.7, damageMul: 1.8, durationMul: 1.0, fragmentsNeeded: 120, name: "4★" },
    { star: 5, cdMul: 0.6, damageMul: 2.2, durationMul: 1.0, fragmentsNeeded: 240, name: "5★" },
  ]},
  fireRain: { id: "fireRain", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.1, fragmentsNeeded: 30, name: "2★" },
    { star: 3, cdMul: 0.85, damageMul: 1.4, durationMul: 1.2, fragmentsNeeded: 70, name: "3★" },
    { star: 4, cdMul: 0.75, damageMul: 1.7, durationMul: 1.3, fragmentsNeeded: 140, name: "4★" },
    { star: 5, cdMul: 0.65, damageMul: 2.0, durationMul: 1.5, fragmentsNeeded: 280, name: "5★" },
  ]},
  incendiary: { id: "incendiary", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.1, fragmentsNeeded: 28, name: "2★" },
    { star: 3, cdMul: 0.8, damageMul: 1.4, durationMul: 1.2, fragmentsNeeded: 65, name: "3★" },
    { star: 4, cdMul: 0.7, damageMul: 1.7, durationMul: 1.3, fragmentsNeeded: 130, name: "4★" },
    { star: 5, cdMul: 0.6, damageMul: 2.0, durationMul: 1.5, fragmentsNeeded: 260, name: "5★" },
  ]},
  drone: { id: "drone", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.1, fragmentsNeeded: 32, name: "2★" },
    { star: 3, cdMul: 0.85, damageMul: 1.4, durationMul: 1.2, fragmentsNeeded: 75, name: "3★" },
    { star: 4, cdMul: 0.75, damageMul: 1.7, durationMul: 1.3, fragmentsNeeded: 150, name: "4★" },
    { star: 5, cdMul: 0.65, damageMul: 2.0, durationMul: 1.5, fragmentsNeeded: 300, name: "5★" },
  ]},
  laser: { id: "laser", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.0, fragmentsNeeded: 26, name: "2★" },
    { star: 3, cdMul: 0.8, damageMul: 1.5, durationMul: 1.0, fragmentsNeeded: 62, name: "3★" },
    { star: 4, cdMul: 0.7, damageMul: 1.8, durationMul: 1.0, fragmentsNeeded: 125, name: "4★" },
    { star: 5, cdMul: 0.6, damageMul: 2.2, durationMul: 1.0, fragmentsNeeded: 250, name: "5★" },
  ]},
  meteor: { id: "meteor", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.0, fragmentsNeeded: 30, name: "2★" },
    { star: 3, cdMul: 0.85, damageMul: 1.4, durationMul: 1.0, fragmentsNeeded: 70, name: "3★" },
    { star: 4, cdMul: 0.75, damageMul: 1.7, durationMul: 1.0, fragmentsNeeded: 140, name: "4★" },
    { star: 5, cdMul: 0.65, damageMul: 2.0, durationMul: 1.0, fragmentsNeeded: 280, name: "5★" },
  ]},
  arrowRain: { id: "arrowRain", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.1, fragmentsNeeded: 24, name: "2★" },
    { star: 3, cdMul: 0.8, damageMul: 1.5, durationMul: 1.2, fragmentsNeeded: 58, name: "3★" },
    { star: 4, cdMul: 0.7, damageMul: 1.8, durationMul: 1.3, fragmentsNeeded: 115, name: "4★" },
    { star: 5, cdMul: 0.6, damageMul: 2.2, durationMul: 1.5, fragmentsNeeded: 230, name: "5★" },
  ]},
  swords: { id: "swords", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.0, fragmentsNeeded: 40, name: "2★" },
    { star: 3, cdMul: 0.8, damageMul: 1.5, durationMul: 1.0, fragmentsNeeded: 90, name: "3★" },
    { star: 4, cdMul: 0.7, damageMul: 1.8, durationMul: 1.0, fragmentsNeeded: 180, name: "4★" },
    { star: 5, cdMul: 0.6, damageMul: 2.2, durationMul: 1.0, fragmentsNeeded: 360, name: "5★" },
  ]},
  // v6 新增道具
  signalJam: { id: "signalJam", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.0, durationMul: 1.2, fragmentsNeeded: 35, name: "2★" },
    { star: 3, cdMul: 0.8, damageMul: 1.0, durationMul: 1.4, fragmentsNeeded: 80, name: "3★" },
    { star: 4, cdMul: 0.7, damageMul: 1.0, durationMul: 1.6, fragmentsNeeded: 160, name: "4★" },
    { star: 5, cdMul: 0.6, damageMul: 1.0, durationMul: 2.0, fragmentsNeeded: 320, name: "5★" },
  ]},
  airStrike: { id: "airStrike", levels: [
    { star: 1, cdMul: 1.0, damageMul: 1.0, durationMul: 1.0, fragmentsNeeded: 0, name: "1★" },
    { star: 2, cdMul: 0.9, damageMul: 1.2, durationMul: 1.1, fragmentsNeeded: 38, name: "2★" },
    { star: 3, cdMul: 0.85, damageMul: 1.4, durationMul: 1.2, fragmentsNeeded: 85, name: "3★" },
    { star: 4, cdMul: 0.75, damageMul: 1.7, durationMul: 1.3, fragmentsNeeded: 170, name: "4★" },
    { star: 5, cdMul: 0.65, damageMul: 2.0, durationMul: 1.5, fragmentsNeeded: 340, name: "5★" },
  ]},
};

/** 取指定道具的星级配置 */
export function getItemStarDef(id: ItemId): ItemStarDef {
  return ITEM_STAR_DEFS[id] ?? ITEM_STAR_DEFS.bomb;
}

/** 取指定星级的参数 */
export function getItemStarLevel(id: ItemId, star: number) {
  const def = getItemStarDef(id);
  const idx = Math.min(def.levels.length - 1, Math.max(0, star - 1));
  return def.levels[idx];
}

// ============ v6 每日挑战规则池 ============

/**
 * 每日挑战规则池：根据日期 seed 轮换。
 * 共 7 条规则，每周循环。
 */
export const DAILY_RULES: BombDailyRule[] = [
  {
    id: "dr-1", name: "燃烧弹禁用", desc: "今日燃烧弹被禁用·Boss 血量 -20%",
    disabledWeapons: ["incendiary"], bossHpMul: 0.8, startWave: 1, maxWave: 15, rewardMul: 1.2,
  },
  {
    id: "dr-2", name: "道具封锁", desc: "今日所有道具被禁用·Boss 血量 -40%",
    disabledItems: ["bomb", "missile", "fireRain", "incendiary", "drone", "laser", "meteor", "arrowRain", "swords", "signalJam", "airStrike"],
    bossHpMul: 0.6, startWave: 1, maxWave: 15, rewardMul: 2.0,
  },
  {
    id: "dr-3", name: "Boss 狂暴", desc: "今日 Boss 血量 +50%·反击频率 +30%",
    bossHpMul: 1.5, startWave: 1, maxWave: 15, rewardMul: 1.8,
  },
  {
    id: "dr-4", name: "激光炮专精", desc: "今日仅激光炮/导弹雨可用·Boss 血量 -30%",
    disabledWeapons: ["standard", "cluster", "emp", "incendiary"],
    bossHpMul: 0.7, startWave: 1, maxWave: 15, rewardMul: 1.5,
  },
  {
    id: "dr-5", name: "速攻模式", desc: "今日起始波次 5·Boss 血量 -30%",
    bossHpMul: 0.7, startWave: 5, maxWave: 15, rewardMul: 1.4,
  },
  {
    id: "dr-6", name: "终极挑战", desc: "今日 Boss 血量 +80%·所有道具 CD +30%",
    bossHpMul: 1.8, startWave: 1, maxWave: 15, rewardMul: 2.5,
  },
  {
    id: "dr-7", name: "硬核反击", desc: "今日 Boss 反击频率 +50%·Boss 血量 -10%",
    bossHpMul: 0.9, startWave: 1, maxWave: 15, rewardMul: 1.6,
  },
];

/** 根据日期 key 取每日规则（YYYY-MM-DD → 规则） */
export function getDailyRule(dateKey: string): BombDailyRule {
  // 简单 hash：把日期字符的 charCode 求和，对规则数取模
  let sum = 0;
  for (let i = 0; i < dateKey.length; i++) sum += dateKey.charCodeAt(i);
  return DAILY_RULES[sum % DAILY_RULES.length];
}

/** 取今日日期 key（YYYY-MM-DD） */
export function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ============ v6 反诈行动评级 ============

/**
 * F→SSS 评级阈值（综合得分）：
 * 综合得分 = 拆除率 × 1000 + 救援数 × 50 + 最高连击 × 10 + 最高 DPS × 0.1
 */
export const TIER_RATING_THRESHOLDS: Array<{ rating: BombTierRating; threshold: number; color: string }> = [
  { rating: "F",   threshold: 0,     color: "#888888" },
  { rating: "D",   threshold: 500,   color: "#FF5A2A" },
  { rating: "C",   threshold: 1000,  color: "#FFB020" },
  { rating: "B",   threshold: 1500,  color: "#FFD666" },
  { rating: "A",   threshold: 2200,  color: "#52C41A" },
  { rating: "S",   threshold: 3000,  color: "#00E5FF" },
  { rating: "SS",  threshold: 4000,  color: "#B388FF" },
  { rating: "SSS", threshold: 5500,  color: "#FF7A1A" },
];

/** 计算综合得分与评级 */
export function calculateRating(params: {
  destroyRate: number;
  victimsRescued: number;
  maxCombo: number;
  maxDps: number;
  perfectRun: boolean;
}): { score: number; rating: BombTierRating; ratingColor: string } {
  let score = params.destroyRate * 1000
    + params.victimsRescued * 50
    + params.maxCombo * 10
    + params.maxDps * 0.1;
  if (params.perfectRun) score *= 1.2;
  let rating: BombTierRating = "F";
  let ratingColor = "#888888";
  for (const t of TIER_RATING_THRESHOLDS) {
    if (score >= t.threshold) {
      rating = t.rating;
      ratingColor = t.color;
    }
  }
  return { score: Math.round(score), rating, ratingColor };
}

// ============ v6 模式标签 ============

export const MODE_LABELS: Record<string, string> = {
  endless: "无尽模式",
  story: "剧情战役",
  daily: "每日挑战",
  speedrun: "极速模式",
  hardcore: "硬核模式",
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  hell: "地狱",
};

/** 玩家铭言池（战报分享卡用） */
export const PLAYER_MOTTOS: string[] = [
  "全民反诈，天下无诈",
  "反诈出击，摧毁园区",
  "守护钱包，从我做起",
  "96110 接听，诈骗现形",
  "反诈正义，无远弗届",
  "摧毁电诈，人人有责",
  "识骗防骗，永不上当",
  "一炮一园区，反诈护家国",
];

/** 随机取一句铭言 */
export function randomMotto(): string {
  return PLAYER_MOTTOS[Math.floor(Math.random() * PLAYER_MOTTOS.length)];
}
