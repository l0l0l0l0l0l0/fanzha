/**
 * 每日活动数据 · v2
 * 每日签到奖励 + 每日任务定义
 */

export interface DailyQuestDef {
  id: string;
  name: string;
  description: string;
  target: number;
  unit: string;
  reward: { coins?: number; energy?: number; fragments?: number };
  icon: "target" | "star" | "flame" | "lightning" | "shield";
}

/** 7 日签到奖励配置（与 platformStore.doDailyCheckIn 内的 rewards 保持一致） */
export const CHECK_IN_REWARDS: {
  day: number;
  coins: number;
  energy: number;
  fragments: number;
  label: string;
}[] = [
  { day: 1, coins: 50, energy: 1, fragments: 0, label: "日" },
  { day: 2, coins: 80, energy: 1, fragments: 0, label: "日" },
  { day: 3, coins: 100, energy: 1, fragments: 1, label: "日" },
  { day: 4, coins: 120, energy: 2, fragments: 0, label: "日" },
  { day: 5, coins: 150, energy: 2, fragments: 1, label: "日" },
  { day: 6, coins: 200, energy: 2, fragments: 2, label: "日" },
  { day: 7, coins: 300, energy: 3, fragments: 3, label: "豪华礼包" },
];

/** 每日任务定义（每日重置） */
export const DAILY_QUESTS: DailyQuestDef[] = [
  {
    id: "play-3-games",
    name: "识破达人",
    description: "完成 3 局任意游戏",
    target: 3,
    unit: "局",
    reward: { coins: 50 },
    icon: "target",
  },
  {
    id: "learn-2-lessons",
    name: "学习先锋",
    description: "完成 2 次学习答题",
    target: 2,
    unit: "次",
    reward: { energy: 1 },
    icon: "star",
  },
  {
    id: "score-500",
    name: "高分挑战",
    description: "单局得分超过 500",
    target: 1,
    unit: "次",
    reward: { fragments: 1 },
    icon: "lightning",
  },
  {
    id: "bust-10-frauds",
    name: "反诈卫士",
    description: "累计识破 10 次诈骗",
    target: 10,
    unit: "次",
    reward: { coins: 100, energy: 2 },
    icon: "shield",
  },
  {
    id: "streak-3",
    name: "坚持不懈",
    description: "连续签到 3 天",
    target: 3,
    unit: "天",
    reward: { coins: 100, fragments: 1 },
    icon: "flame",
  },
];
