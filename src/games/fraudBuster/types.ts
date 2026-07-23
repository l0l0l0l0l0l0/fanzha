export type FBCardType = "chat" | "call" | "transfer" | "popup" | "sms" | "video";

/** 题型：单选 / 判断 / 多选 */
export type FBQuestionKind = "single" | "judge" | "multi";

/** 道具类型：原4种 + 新增2种（提示/撤销） */
export type FBItemType = "freeze" | "fifty" | "skip" | "double" | "hint" | "undo";

/** 特殊波次事件类型 */
export type FBSpecialEvent =
  | "double"        // 双重诈骗：同屏2题连答
  | "timeCompress"  // 时间压缩：倒计时减半
  | "shuffle"       // 选项乱序：选项位置随机打乱
  | "mixedTrueFalse";// 真假混杂：混入正常(非诈骗)情境需判断

/** Boss 技能类型 */
export type FBBossSkill =
  | "shuffleOptions" // 打乱选项顺序
  | "hideTimer"      // 隐藏倒计时
  | "summonMinion"   // 召唤小怪（额外1题）
  | "lockItem";      // 封印道具1题

/** 多选题题面：贴合电信诈骗套路 */
export interface FBQuestion {
  id: string;
  typeId: string;
  type: string;
  /** 题级溯源：真实文章出处（标题+发布日期+作者/账号），用于内容核查 */
  source?: string;
  cardType: FBCardType;
  /** 题型，默认 single（4选1） */
  kind?: FBQuestionKind;
  title: string;
  body: string;
  options: string[]; // 单选/判断/多选
  /** 单选/判断题的正确选项索引 */
  answer?: number;
  /** 多选题的正确选项索引列表 */
  answers?: number[];
  /** 风险选项索引列表：选中后额外惩罚（更生动） */
  risk?: number[];
  explain: string;
  cues: string[];
  difficulty: number; // 1-4
  /** 连锁题组ID：同一组的题目按 chainStep 顺序出现 */
  chainGroup?: string;
  /** 连锁题步骤：1=首题，2=追问 */
  chainStep?: number;
  /** 是否为正常(非诈骗)情境（mixedTrueFalse 事件用） */
  isNormal?: boolean;
}

/** 猛男等级（右上角强壮男性图标）：随积分晋升，错答削弱 */
export interface ManTier {
  level: number; // 0-7
  name: string;
  minScore: number;
  color: string;
}

/** Boss 诈骗首脑：每 20 波出现一次，需连续答对 2-3 题击破 */
export interface FBBoss {
  id: string;
  /** Boss 名称（如"跨国诈骗集团首脑"） */
  name: string;
  /** 基础血量（2-3） */
  hp: number;
  /** 嘲讽话术（玩家未命中时出现） */
  taunts: string[];
  /** 视觉主题色 */
  theme: "red" | "purple" | "gold";
  /** Boss 技能列表（每题随机触发1个） */
  skills?: FBBossSkill[];
}

export interface FBHud {
  wave: number;
  score: number;
  combo: number;
  stamina: number;
  maxStamina: number;
  manLevel: number;
  manName: string;
  manColor: string;
  busted: number;
  /** 当前题剩余时间比 0-1 */
  timerRatio: number;
  /** 当前题选项（供场景画按钮） */
  options: string[];
  /** 是否有题在展示 */
  hasQuestion: boolean;
  /** 题型名 */
  qType: string;
  /** 题型 kind */
  qKind: FBQuestionKind;
  /** 风险选项索引列表 */
  riskIdx: number[];
  /** 多选题已选中索引（用于多选切换） */
  multiSelected: number[];
  /** 单选/判断题已选未提交索引（null=未选） */
  pendingIdx: number | null;
  /** 答题后揭示：玩家所选（null=未答） */
  selectedIdx: number | null;
  /** 答题后揭示：正确选项（null=未答） */
  correctIdx: number | null;
  /** 多选题正确答案列表（揭示时使用） */
  correctIdxList: number[];
  /** 是否触发了风险选项惩罚动画 */
  riskTriggered: boolean;
  /** 诈骗分子挑衅文案（高压/错答时出现，null=不显示） */
  taunt: string | null;
  /** 心跳强度 0..1（倒计时紧迫度，驱动红屏脉动） */
  heartbeat: number;
  /** 道具数量（6种） */
  items: { freeze: number; fifty: number; skip: number; double: number; hint: number; undo: number };
  /** 50-50 移除的选项索引（揭示态高亮置灰） */
  fiftyRemoved: number[];
  /** 提示道具高亮的选项索引（倾向正确的1个） */
  hintHighlighted: number[];
  /** 时间冻结剩余秒数（>0 表示生效中） */
  freezeRemaining: number;
  /** 双倍分剩余题数（>0 表示生效中） */
  doubleRemaining: number;
  /** Boss 战是否进行中（每 20 波触发） */
  bossActive?: boolean;
  /** Boss 名称 */
  bossName?: string;
  /** Boss 当前血量 */
  bossHp?: number;
  /** Boss 最大血量 */
  bossMaxHp?: number;
  /** Boss 当前激活技能（null=无） */
  bossSkill?: FBBossSkill | null;
  /** 道具被封印（Boss lockItem 技能） */
  itemLocked?: boolean;
  /** 当前特殊波次事件（null=普通波次） */
  specialEvent?: FBSpecialEvent | null;
  /** 连锁题步骤（1=首题，2=追问，null=非连锁） */
  chainStep?: number;
  /** 是否为正常(非诈骗)情境 */
  isNormal?: boolean;
  /** 选项显示顺序（shuffle 事件/Boss 技能打乱后） */
  optionOrder?: number[];
}

/** 游戏统计数据：用于结算页展示 */
export interface FBStats {
  /** 总答题数 */
  totalAnswered: number;
  /** 正确数 */
  correctCount: number;
  /** 错误数（含超时） */
  wrongCount: number;
  /** 最高连击 */
  maxCombo: number;
  /** Boss 击破数 */
  bossDefeated: number;
  /** 各诈骗类型正确率统计 */
  byType: Record<string, { correct: number; total: number }>;
  /** 道具使用次数 */
  itemsUsed: number;
  /** 连锁题完成数 */
  chainCompleted: number;
  /** 特殊波次通过数 */
  specialCleared: number;
}
