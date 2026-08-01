import type { FBKnowledgeNode } from "../types";

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
