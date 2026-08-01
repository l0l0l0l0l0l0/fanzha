import type { FBVictimProfile, FBPsychology } from "../types";

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
