import type { FBDailyTask } from "../types";

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
