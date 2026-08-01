import type { FBStoryStage, FBQuestion } from "../types";

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
