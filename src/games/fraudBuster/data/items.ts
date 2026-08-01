import type { FBItemUpgradeDef, FBItemType } from "../types";

// ============ B4：道具升级配置 ============
/** 6 种道具 × 3 级升级配置 */
export const ITEM_UPGRADE_DEFS: FBItemUpgradeDef[] = [
  {
    type: "freeze",
    levels: [
      { level: 1, name: "冰霜新星", cost: 0, effect: "冻结 3 秒", params: { duration: 3 } },
      { level: 2, name: "寒冰屏障", cost: 200, effect: "冻结 5 秒", params: { duration: 5 } },
      { level: 3, name: "绝对零度", cost: 600, effect: "冻结 8 秒", params: { duration: 8 } },
    ],
  },
  {
    type: "fifty",
    levels: [
      { level: 1, name: "50-50", cost: 0, effect: "移除 2 个错误选项", params: { remove: 2 } },
      { level: 2, name: "75-25", cost: 200, effect: "移除 3 个错误选项", params: { remove: 3 } },
      { level: 3, name: "必中", cost: 600, effect: "仅保留正确选项", params: { remove: 99 } },
    ],
  },
  {
    type: "skip",
    levels: [
      { level: 1, name: "跳过", cost: 0, effect: "跳过本题不计分", params: {} },
      { level: 2, name: "闪现", cost: 200, effect: "跳过并得半分", params: { halfScore: 1 } },
      { level: 3, name: "时空回溯", cost: 600, effect: "跳过并得满分", params: { fullScore: 1 } },
    ],
  },
  {
    type: "double",
    levels: [
      { level: 1, name: "双倍分", cost: 0, effect: "下 1 题双倍分", params: { count: 1 } },
      { level: 2, name: "三倍分", cost: 200, effect: "下 2 题三倍分", params: { count: 2, mult: 3 } },
      { level: 3, name: "五倍连击", cost: 600, effect: "下 3 题五倍分", params: { count: 3, mult: 5 } },
    ],
  },
  {
    type: "hint",
    levels: [
      { level: 1, name: "提示", cost: 0, effect: "高亮 1 个正确倾向选项", params: { count: 1 } },
      { level: 2, name: "洞察", cost: 200, effect: "高亮 2 个正确倾向选项", params: { count: 2 } },
      { level: 3, name: "全知", cost: 600, effect: "直接显示正确选项", params: { reveal: 1 } },
    ],
  },
  {
    type: "undo",
    levels: [
      { level: 1, name: "撤销", cost: 0, effect: "撤销本题选择（1 次）", params: { count: 1 } },
      { level: 2, name: "回滚", cost: 200, effect: "撤销本题选择（2 次）", params: { count: 2 } },
      { level: 3, name: "时间倒流", cost: 600, effect: "撤销并恢复 1 点护盾", params: { count: 99, heal: 1 } },
    ],
  },
];

/** 获取道具当前等级配置 */
export function getItemUpgradeDef(type: FBItemType, level: number) {
  const def = ITEM_UPGRADE_DEFS.find((d) => d.type === type);
  if (!def) return null;
  return def.levels.find((l) => l.level === level) ?? def.levels[0];
}
