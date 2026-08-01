import type { FBBoss as FBBossType } from "../types";

// ============ A6：Boss 周挑战配置 ============
/** Boss 周：每周固定一个高难 Boss（按 weekKey 哈希选取） */
export const BOSS_WEEK_POOL: FBBossType[] = [
  {
    id: "BW-01", name: "AI 换脸集团首脑", hp: 4, theme: "purple",
    taunts: ["我的换脸技术天衣无缝", "你能分辨真假吗？", "3 秒素材就够了"],
    skills: ["shuffleOptions", "answerBlur", "timeSteal", "hideTimer"],
  },
  {
    id: "BW-02", name: "跨境杀猪盘操盘手", hp: 4, theme: "red",
    taunts: ["猪已上钩", "提现？做梦吧", "你的钱是我的了"],
    skills: ["summonMinion", "lockItem", "timeSteal", "shuffleOptions"],
  },
  {
    id: "BW-03", name: "冒充公检法总指挥", hp: 5, theme: "gold",
    taunts: ["我是警官，你敢不配合？", "安全账户等着你", "案件保密别告诉家人"],
    skills: ["hideTimer", "lockItem", "answerBlur", "timeSteal"],
  },
  {
    id: "BW-04", name: "刷单返利矩阵头目", hp: 3, theme: "red",
    taunts: ["连单继续做", "解冻金交一下", "本金别想拿回"],
    skills: ["shuffleOptions", "summonMinion", "timeSteal"],
  },
];

/** 根据 weekKey 选取本周 Boss（稳定哈希，同一周固定） */
export function pickBossWeek(weekKey: string): FBBossType {
  let hash = 0;
  for (let i = 0; i < weekKey.length; i++) {
    hash = (hash * 31 + weekKey.charCodeAt(i)) >>> 0;
  }
  return BOSS_WEEK_POOL[hash % BOSS_WEEK_POOL.length];
}
