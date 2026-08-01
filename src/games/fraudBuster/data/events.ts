import type { FBSeasonalEvent } from "../types";

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
