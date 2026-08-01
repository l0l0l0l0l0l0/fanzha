import type { FBItemType } from "../types";

/** 道具中文名 */
export function itemLabel(type: FBItemType): string {
  switch (type) {
    case "freeze": return "❄ 时间冻结";
    case "fifty": return "🧰 50-50";
    case "skip": return "⏭ 跳过";
    case "double": return "✨ 双倍分";
    case "hint": return "💡 提示";
    case "undo": return "↩ 撤销";
  }
}

/** 道具图例 emoji */
export function itemEmoji(type: FBItemType): string {
  switch (type) {
    case "freeze": return "❄";
    case "fifty": return "🧰";
    case "skip": return "⏭";
    case "double": return "✨";
    case "hint": return "💡";
    case "undo": return "↩";
  }
}
