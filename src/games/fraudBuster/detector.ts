/**
 * 诈骗话术识别器（C4 教育功能）
 *
 * 纯本地关键词引擎，无需联网。输入可疑文本（聊天记录/短信/弹窗文案），
 * 即可识别潜在诈骗红旗、关联诈骗类型、给出风险等级与防护建议。
 *
 * 设计目标：
 * - 0 依赖，可被任意场景/工具页面调用
 * - 关键词库覆盖 F01-F123 全部诈骗类型的高频话术
 * - 输出结构化报告，便于 UI 渲染
 */
import type { FBPsychology } from "./types";

// ============ 关键词库 ============

/** 关键词条目：单条诈骗话术特征 */
export interface ScamKeyword {
  /** 关键词文本（小写匹配，支持中英文混合） */
  pattern: string;
  /** 该关键词所属诈骗类型 ID（与 codex typeId 对应） */
  typeId: string;
  /** 该关键词的红旗权重 1-5（5=致命红旗） */
  weight: number;
  /** 该关键词利用的心理手法 */
  psychology: FBPsychology[];
  /** 简短说明（为何这是诈骗信号） */
  note: string;
}

/**
 * 关键词库：覆盖 2026 年高发诈骗类型核心话术
 * 按诈骗类型分组，每组 3-8 个高频关键词
 */
export const SCAM_KEYWORDS: ScamKeyword[] = [
  // ===== 通用致命红旗（跨类型） =====
  { pattern: "安全账户", typeId: "F01", weight: 5, psychology: ["authority", "fear"], note: "央行无'安全账户'概念，任何要求转账至安全账户的都是诈骗。" },
  { pattern: "屏幕共享", typeId: "F121", weight: 5, psychology: ["authority", "trust"], note: "屏幕共享=交出手机控制权，密码验证码全泄露。" },
  { pattern: "共享屏幕", typeId: "F121", weight: 5, psychology: ["authority", "trust"], note: "共享屏幕=交出账户控制权，任何'共享屏幕领钱/理赔'都是诈骗。" },
  { pattern: "验证码", typeId: "F01", weight: 5, psychology: ["authority"], note: "验证码绝不读给任何人，读出即授权转账。" },
  { pattern: "稳赚不赔", typeId: "F02", weight: 5, psychology: ["greed"], note: "任何投资都不保本，'稳赚不赔'是诈骗核心话术。" },
  { pattern: "内部消息", typeId: "F02", weight: 4, psychology: ["greed", "trust"], note: "'内部消息'是诈骗信号，金融监管漏洞不可能让你薅羊毛。" },
  { pattern: "保密", typeId: "F01", weight: 4, psychology: ["fear", "authority"], note: "要求保密是诈骗信号，公检法不会要求保密转账。" },
  { pattern: "影响征信", typeId: "F01", weight: 4, psychology: ["fear"], note: "征信不能靠转账'注销'，影响征信话术多为诈骗。" },
  { pattern: "紧急", typeId: "F01", weight: 3, psychology: ["urgency"], note: "制造紧迫感是诈骗常见手法，任何'紧急转账'都需独立核实。" },

  // ===== F01 冒充公检法 =====
  { pattern: "涉嫌洗钱", typeId: "F01", weight: 5, psychology: ["fear", "authority"], note: "公检法不会电话办案，更无'安全账户'。" },
  { pattern: "刑侦支队", typeId: "F01", weight: 4, psychology: ["authority", "fear"], note: "公检法不会电话要求转账，挂断拨打 96110 核实。" },
  { pattern: "案件保密", typeId: "F01", weight: 4, psychology: ["fear"], note: "公检法办案有正规流程，不会电话要求保密转账。" },
  { pattern: "拘捕令", typeId: "F01", weight: 5, psychology: ["fear", "authority"], note: "拘捕令不会电话下达，公检法不电话办案。" },

  // ===== F02 杀猪盘 =====
  { pattern: "带你赚钱", typeId: "F02", weight: 4, psychology: ["greed", "intimacy"], note: "陌生人主动带你赚钱=杀猪盘开端。" },
  { pattern: "舅舅在监管", typeId: "F02", weight: 5, psychology: ["trust", "greed"], note: "'内部关系+监管漏洞'是杀猪盘核心话术。" },
  { pattern: "月化", typeId: "F02", weight: 4, psychology: ["greed"], note: "月化收益率话术多为诈骗，正规投资用年化。" },
  { pattern: "提现缴税", typeId: "F118", weight: 5, psychology: ["sunkCost", "greed"], note: "任何'提现缴税'都是诈骗，加密货币/投资提现无需缴税。" },
  { pattern: "通道税", typeId: "F118", weight: 5, psychology: ["sunkCost"], note: "'通道税'不存在，任何提现缴税都是诈骗。" },
  { pattern: "反洗钱认证金", typeId: "F118", weight: 5, psychology: ["sunkCost"], note: "'反洗钱认证金'是诈骗话术，正规平台无此费用。" },

  // ===== F03 刷单返利 =====
  { pattern: "刷单", typeId: "F03", weight: 5, psychology: ["greed"], note: "刷单本身违法，任何刷单返利都是诈骗。" },
  { pattern: "点赞返佣", typeId: "F03", weight: 4, psychology: ["greed"], note: "点赞返佣是诈骗诱饵，先小利后连环垫付。" },
  { pattern: "垫付", typeId: "F03", weight: 5, psychology: ["sunkCost", "greed"], note: "'垫付任务'是刷单诈骗核心，越垫越多。" },
  { pattern: "高额佣金", typeId: "F03", weight: 3, psychology: ["greed"], note: "高额佣金兼职多为诈骗，正规兼职不会先交钱。" },

  // ===== F116 AI 实时换脸视频通话 =====
  { pattern: "视频会议", typeId: "F116", weight: 3, psychology: ["urgency"], note: "结合'紧急转账'的视频会议可能是AI换脸诈骗。" },
  { pattern: "2分钟内", typeId: "F116", weight: 4, psychology: ["urgency"], note: "极短时间内的转账要求是诈骗信号，需独立核实。" },
  { pattern: "口头批准", typeId: "F116", weight: 5, psychology: ["authority"], note: "口头批准绕过流程=100%诈骗，正规流程需书面审批。" },
  { pattern: "超时丢单", typeId: "F116", weight: 4, psychology: ["urgency", "fear"], note: "责任威胁是诈骗信号，真领导会理解核实需求。" },

  // ===== F117 数字人民币权限委托 =====
  { pattern: "权限委托", typeId: "F117", weight: 5, psychology: ["authority", "trust"], note: "数字人民币无'权限委托'功能，开通=交出钱包控制权。" },
  { pattern: "代为操作", typeId: "F117", weight: 5, psychology: ["authority"], note: "任何'代为操作钱包'都100%是诈骗。" },
  { pattern: "测试金", typeId: "F117", weight: 4, psychology: ["greed"], note: "'测试金'是诈骗诱饵，正规金融无此流程。" },
  { pattern: "钱包风控升级", typeId: "F117", weight: 4, psychology: ["fear", "urgency"], note: "数字人民币官方不会主动电话索要操作，钱包问题到银行网点处理。" },

  // ===== F118 加密货币杀猪盘 =====
  { pattern: "USDT量化", typeId: "F118", weight: 4, psychology: ["greed", "trust"], note: "USDT量化+稳赚不赔=假交易所诈骗。" },
  { pattern: "连接钱包", typeId: "F118", weight: 5, psychology: ["greed", "curiosity"], note: "'连接钱包授权'是钓鱼，授权后钱包被瞬间转空。" },
  { pattern: "空投福利", typeId: "F118", weight: 4, psychology: ["greed", "scarcity"], note: "空投钓鱼泛滥，真正的空投不会要求授权操作。" },
  { pattern: "内部通道", typeId: "F118", weight: 5, psychology: ["greed", "trust"], note: "'内部通道'是诈骗话术，主流交易所无此概念。" },

  // ===== F119 AI 代写论文 =====
  { pattern: "AI代写", typeId: "F119", weight: 4, psychology: ["greed", "conformity"], note: "AI代写既违反学术诚信，又是高发诈骗。" },
  { pattern: "包过查重", typeId: "F119", weight: 4, psychology: ["greed"], note: "'包过查重'是诈骗引流话术，收定金后失联。" },

  // ===== F120 AI 假新闻引流 =====
  { pattern: "内部视频", typeId: "F120", weight: 4, psychology: ["curiosity", "scarcity"], note: "'内部视频'是引流陷阱，扫码绑卡是隐藏续费。" },
  { pattern: "1元试用", typeId: "F120", weight: 4, psychology: ["greed"], note: "1元试用3天后自动续费高额会员费且难以取消。" },
  { pattern: "明星塌房", typeId: "F120", weight: 3, psychology: ["curiosity"], note: "AI合成明星假视频引流，扫码绑卡是陷阱。" },

  // ===== F121 外卖理赔屏幕共享 =====
  { pattern: "主动理赔", typeId: "F121", weight: 3, psychology: ["trust", "greed"], note: "主动理赔获取信任，真实目的是屏幕共享窃取密码。" },
  { pattern: "食物变质理赔", typeId: "F121", weight: 3, psychology: ["trust"], note: "理赔到官方APP核实，不下载会议软件。" },

  // ===== F122 共享屏幕清退会员 =====
  { pattern: "清退会员", typeId: "F122", weight: 4, psychology: ["fear", "authority"], note: "会员管理在APP内自助完成，任何'清退会员'都是诈骗。" },
  { pattern: "误开通", typeId: "F122", weight: 4, psychology: ["fear"], note: "'误开通自动续费'是诈骗话术，会员管理在APP内。" },
  { pattern: "远程协助", typeId: "F122", weight: 5, psychology: ["authority"], note: "远程协助软件+读验证码=资金被转走标配。" },
  { pattern: "ToDesk", typeId: "F122", weight: 5, psychology: ["authority"], note: "客服要求下载ToDesk=100%诈骗，会员管理不会要求远程协助。" },
  { pattern: "向日葵", typeId: "F122", weight: 5, psychology: ["authority"], note: "客服要求下载向日葵=100%诈骗，远程协助=交出控制权。" },

  // ===== F123 直播间虚假竞拍 =====
  { pattern: "0元起拍", typeId: "F123", weight: 4, psychology: ["greed", "scarcity"], note: "0元起拍+追加费用是直播间诈骗标配。" },
  { pattern: "鉴定费", typeId: "F123", weight: 4, psychology: ["sunkCost"], note: "拍卖行不收鉴定费，中标后追加费用都是诈骗。" },
  { pattern: "保证金原路退回", typeId: "F123", weight: 4, psychology: ["sunkCost", "greed"], note: "'保证金原路退回'是诱饵，缴清后还有'最后一步'。" },
  { pattern: "通关费", typeId: "F123", weight: 5, psychology: ["sunkCost"], note: "文物出境正规流程不走直播间，'通关费'是诈骗。" },
  { pattern: "最后一步", typeId: "F123", weight: 5, psychology: ["sunkCost"], note: "'最后一步'永远有下一步，连环诈骗信号。" },

  // ===== 通用钓鱼/仿冒 =====
  { pattern: ".xyz", typeId: "F79", weight: 3, psychology: ["greed"], note: ".xyz/.top/.cc 等陌生域名多为钓鱼，认准官方域名。" },
  { pattern: ".top", typeId: "F79", weight: 3, psychology: ["greed"], note: "陌生域名多为钓鱼，官方链接认准 .com/.cn。" },
  { pattern: "点击链接", typeId: "F79", weight: 3, psychology: ["urgency"], note: "陌生短信中的'点击链接'多为钓鱼。" },
  { pattern: "24小时内有效", typeId: "F02", weight: 3, psychology: ["urgency", "scarcity"], note: "制造时间紧迫感是诈骗常见手法。" },
  { pattern: "名额有限", typeId: "F02", weight: 3, psychology: ["scarcity"], note: "'名额有限'是稀缺性诈骗话术。" },
  { pattern: "不要告诉", typeId: "F02", weight: 4, psychology: ["fear"], note: "要求保密是诈骗信号，正规事务不需要保密转账。" },
];

// ============ 风险等级定义 ============

/** 风险等级 0-5 */
export type RiskLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** 风险等级描述 */
export const RISK_LEVELS: Record<RiskLevel, { label: string; color: string; desc: string }> = {
  0: { label: "安全", color: "#52C41A", desc: "未识别到诈骗话术特征" },
  1: { label: "低风险", color: "#9FE3FF", desc: "存在少量可疑词汇，需警惕" },
  2: { label: "中风险", color: "#FFD666", desc: "存在多个可疑词汇，建议核实" },
  3: { label: "高风险", color: "#FF7A1A", desc: "存在明显诈骗话术，强烈建议停止操作" },
  4: { label: "极高风险", color: "#E5353B", desc: "存在致命诈骗红旗，立即停止操作并报警" },
  5: { label: "确认诈骗", color: "#FF00E5", desc: "100%诈骗信号，立即报警止损" },
};

// ============ 识别结果 ============

/** 单个命中关键词详情 */
export interface ScamHit {
  keyword: ScamKeyword;
  /** 命中文本片段（前后 20 字符上下文） */
  context: string;
  /** 命中位置（起始索引） */
  index: number;
}

/** 识别结果报告 */
export interface ScamDetectResult {
  /** 输入文本（截断至前 500 字符用于展示） */
  inputText: string;
  /** 风险等级 0-5 */
  riskLevel: RiskLevel;
  /** 总风险分（命中权重的加权和，去重后） */
  riskScore: number;
  /** 命中关键词列表（按权重降序） */
  hits: ScamHit[];
  /** 命中的诈骗类型 ID 列表（去重） */
  matchedTypeIds: string[];
  /** 命中的心理手法列表（去重） */
  matchedPsychology: FBPsychology[];
  /** 风险等级描述 */
  riskLabel: string;
  /** 风险颜色 */
  riskColor: string;
  /** 风险说明 */
  riskDesc: string;
  /** 防护建议（基于命中类型生成） */
  advice: string[];
}

// ============ 核心识别函数 ============

/**
 * 识别可疑文本中的诈骗话术
 *
 * @param text 待识别文本（聊天记录/短信/弹窗文案）
 * @returns 结构化识别报告
 */
export function detectScam(text: string): ScamDetectResult {
  const inputText = (text || "").slice(0, 500);
  const lowerText = inputText.toLowerCase();
  const hits: ScamHit[] = [];

  // 扫描关键词库
  for (const keyword of SCAM_KEYWORDS) {
    const pattern = keyword.pattern.toLowerCase();
    let idx = lowerText.indexOf(pattern);
    while (idx !== -1) {
      const start = Math.max(0, idx - 20);
      const end = Math.min(inputText.length, idx + pattern.length + 20);
      hits.push({
        keyword,
        context: inputText.slice(start, end),
        index: idx,
      });
      // 避免同一关键词在同一位置重复匹配
      idx = lowerText.indexOf(pattern, idx + pattern.length);
    }
  }

  // 按权重降序排序
  hits.sort((a, b) => b.keyword.weight - a.keyword.weight);

  // 计算风险分（同一 pattern 只算一次最高权重）
  const seenPatterns = new Set<string>();
  let riskScore = 0;
  for (const hit of hits) {
    if (!seenPatterns.has(hit.keyword.pattern)) {
      seenPatterns.add(hit.keyword.pattern);
      riskScore += hit.keyword.weight;
    }
  }

  // 计算风险等级
  const riskLevel: RiskLevel = computeRiskLevel(riskScore, hits);

  // 提取命中的诈骗类型（去重，按命中次数排序）
  const typeIdCount = new Map<string, number>();
  for (const hit of hits) {
    typeIdCount.set(hit.keyword.typeId, (typeIdCount.get(hit.keyword.typeId) || 0) + 1);
  }
  const matchedTypeIds = Array.from(typeIdCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  // 提取命中的心理手法（去重）
  const psychologySet = new Set<FBPsychology>();
  for (const hit of hits) {
    for (const p of hit.keyword.psychology) psychologySet.add(p);
  }
  const matchedPsychology = Array.from(psychologySet);

  // 生成防护建议
  const advice = generateAdvice(riskLevel, matchedTypeIds, hits);

  const riskInfo = RISK_LEVELS[riskLevel];

  return {
    inputText,
    riskLevel,
    riskScore,
    hits,
    matchedTypeIds,
    matchedPsychology,
    riskLabel: riskInfo.label,
    riskColor: riskInfo.color,
    riskDesc: riskInfo.desc,
    advice,
  };
}

/** 计算风险等级 */
function computeRiskLevel(riskScore: number, hits: ScamHit[]): RiskLevel {
  // 存在权重 5 的命中直接判定为确认诈骗
  if (hits.some((h) => h.keyword.weight >= 5)) {
    if (riskScore >= 15) return 5;
    if (riskScore >= 10) return 4;
    return 4;
  }
  if (riskScore >= 12) return 4;
  if (riskScore >= 8) return 3;
  if (riskScore >= 4) return 2;
  if (riskScore >= 1) return 1;
  return 0;
}

/** 生成防护建议 */
function generateAdvice(riskLevel: RiskLevel, typeIds: string[], hits: ScamHit[]): string[] {
  const advice: string[] = [];

  if (riskLevel === 0) {
    advice.push("未识别到明显诈骗话术，但仍需保持警惕，不轻易转账或提供个人信息。");
    return advice;
  }

  // 通用建议
  if (riskLevel >= 4) {
    advice.push("立即停止操作，拨打 110 或 96110 报警止损。");
    advice.push("保留聊天记录/短信作为证据，协助警方调查。");
  } else if (riskLevel >= 3) {
    advice.push("立即停止操作，挂断电话/关闭页面。");
    advice.push("通过官方渠道（APP/官网/电话）独立核实对方身份。");
  } else if (riskLevel >= 2) {
    advice.push("保持警惕，不轻易转账或提供个人信息。");
    advice.push("通过官方渠道核实对方身份和事项真实性。");
  } else {
    advice.push("注意识别可疑话术，不轻易相信陌生信息。");
  }

  // 基于命中类型的针对性建议
  if (typeIds.includes("F01")) {
    advice.push("公检法不会电话办案，更无'安全账户'，挂断拨打 96110 核实。");
  }
  if (typeIds.includes("F02") || typeIds.includes("F118")) {
    advice.push("任何'稳赚不赔'都是诈骗，投资只认持牌金融机构或主流交易所。");
  }
  if (typeIds.includes("F116")) {
    advice.push("AI换脸可伪造视频，紧急转账必须用通讯录原号码回拨核实。");
  }
  if (typeIds.includes("F117")) {
    advice.push("数字人民币无'权限委托'功能，钱包问题到银行网点处理。");
  }
  if (typeIds.includes("F118")) {
    advice.push("加密货币提现无需缴税，任何'通道税/反洗钱认证金'都是诈骗。");
  }
  if (typeIds.includes("F121") || typeIds.includes("F122")) {
    advice.push("屏幕共享/远程协助=交出手机控制权，验证码绝不读给任何人。");
  }
  if (typeIds.includes("F123")) {
    advice.push("正规拍卖行费用提前公示，任何'中标后追加费用'都是诈骗。");
  }

  // 基于心理手法的建议
  const psychologies = new Set<FBPsychology>();
  for (const hit of hits) {
    for (const p of hit.keyword.psychology) psychologies.add(p);
  }
  if (psychologies.has("urgency")) {
    advice.push("对方制造紧迫感，冷静思考后再决定，不被'紧急'裹挟。");
  }
  if (psychologies.has("authority")) {
    advice.push("对方冒充权威身份，通过独立渠道核实对方身份真实性。");
  }
  if (psychologies.has("greed")) {
    advice.push("对方利用利益诱惑，牢记'高收益=高风险'，'稳赚不赔'=诈骗。");
  }
  if (psychologies.has("fear")) {
    advice.push("对方利用恐惧施压，挂断电话冷静，不被'拘捕/冻结'吓倒。");
  }
  if (psychologies.has("sunkCost")) {
    advice.push("对方利用沉没成本心理，已损失的资金难以追回，立即止损报警。");
  }

  // 去重
  return Array.from(new Set(advice));
}

// ============ 工具函数 ============

/** 获取命中关键词的简短摘要（用于 UI 展示） */
export function getHitSummary(hits: ScamHit[]): string[] {
  return hits.slice(0, 8).map((h) => `"${h.keyword.pattern}" - ${h.keyword.note}`);
}

/** 检测是否包含致命红旗（权重>=5的关键词） */
export function hasFatalRedFlag(hits: ScamHit[]): boolean {
  return hits.some((h) => h.keyword.weight >= 5);
}

/** 获取命中的诈骗类型名（中文） */
export function getMatchedTypeNames(result: ScamDetectResult, codexLookup: (typeId: string) => string | undefined): string[] {
  return result.matchedTypeIds
    .map((id) => codexLookup(id))
    .filter((name): name is string => !!name);
}
