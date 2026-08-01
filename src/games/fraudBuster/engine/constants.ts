import type { FBQuestion } from "../types";

export const W = 800;
export const H = 480;
export const ACCENT = "#1AD670";

// 卡片位于左半区，选项按钮由场景在右半区绘制（同一画布坐标系，避免错位遮挡）
export const CARD_X = 20;
export const CARD_Y = 80;
export const CARD_W = 360;
export const CARD_H = 380;
export const CARD_CX = CARD_X + CARD_W / 2; // 200
export const CARD_CY = CARD_Y + CARD_H / 2; // 270

export const MAX_STAMINA = 3;

export interface Card {
  q: FBQuestion;
  spawnTs: number;
  duration: number;
  entered: number;
  exited: number;
  state: "in" | "show" | "reveal" | "out";
  /** 单选/判断题：玩家所选索引（原始索引，非显示顺序） */
  selectedIdx: number | null;
  /** 单选/判断题：已选未提交索引（原始索引，null=未选） */
  pendingIdx: number | null;
  /** 多选题：玩家所选索引列表（原始索引） */
  multiSelected: number[];
  /** 是否正确 */
  correct: boolean;
  /** 是否触发风险惩罚 */
  riskTriggered: boolean;
  /** 50-50 道具移除的错误选项索引 */
  fiftyRemoved: number[];
  /** 提示道具高亮的选项索引 */
  hintHighlighted: number[];
  /** 是否通过跳过道具判定为正确（避免触发 fx） */
  skippedViaItem: boolean;
  /** 选项显示顺序：optionOrder[displayIdx] = originalIdx（shuffle 后打乱） */
  optionOrder: number[];
  /** 连锁题组ID */
  chainGroup?: string;
  /** 是否为连锁追问 */
  isChainFollowUp?: boolean;
  /** 3D 翻转进度 0..1（0=正面题目，1=反面答案），reveal 阶段推进 */
  flipProgress: number;
  /** 滑动手势偏移比 -1..1（判断题，负=左滑举报，正=右滑通过），0=未滑动 */
  swipeOffset: number;
  /** 双卡模式下的卡位索引（0=左卡，1=右卡），undefined=单卡模式 */
  dualIndex?: number;
  /** 填空题：玩家输入文本（kind=fill） */
  fillInput: string;
  /** 连线题：玩家配对 linkSel[i] = 玩家为左列第 i 项选择的右列下标，-1=未选 */
  linkSel: number[];
  /** 连线题：右列呈现顺序（打乱后的原始下标序列） */
  linkRightOrder: number[];
  /** 排序题：玩家当前排列（选项索引序列） */
  sortArr: number[];
}
