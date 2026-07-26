import type { FBSaveData, FBRank } from "./storage";

export type FBCardType =
  | "chat"
  | "call"
  | "transfer"
  | "popup"
  | "sms"
  | "video"
  | "qrcode"   // 二维码扫描页
  | "voice"    // 语音消息
  | "app"      // APP 安装/权限页
  | "audio"    // AI 拟声/换脸听音题（A2）
  | "branch";  // 第一人称分支情景（B3）

/** 题型：单选 / 判断 / 多选 / 填空 / 连线 / 排序 / 分支 */
export type FBQuestionKind = "single" | "judge" | "multi" | "fill" | "link" | "sort" | "branch";

/** 季节标签（A4：按月份加权抽题） */
export type FBSeason =
  | "springFestival"  // 春节红包季（1-2月）
  | "schoolOpen"      // 开学季（8-9月）
  | "double11"        // 双11购物季（10-11月）
  | "springTravel"    // 春运退票季（1-2月）
  | "summerJob"       // 暑期兼职季（6-8月）
  | "yearEnd"         // 年终理财季（12-1月）
  | "all";            // 全年通用

/** 道具类型：原4种 + 新增2种（提示/撤销） */
export type FBItemType = "freeze" | "fifty" | "skip" | "double" | "hint" | "undo";

/** 特殊波次事件类型 */
export type FBSpecialEvent =
  | "double"        // 双重诈骗：同屏2题连答
  | "timeCompress"  // 时间压缩：倒计时减半
  | "shuffle"       // 选项乱序：选项位置随机打乱
  | "mixedTrueFalse"// 真假混杂：混入正常(非诈骗)情境需判断
  | "rapidFire"     // 急速连答：3题连发，每题时长缩短
  | "itemLock";     // 道具禁用：本波次禁用所有道具

/** Boss 技能类型 */
export type FBBossSkill =
  | "shuffleOptions" // 打乱选项顺序
  | "hideTimer"      // 隐藏倒计时
  | "summonMinion"   // 召唤小怪（额外1题）
  | "lockItem"       // 封印道具1题
  | "timeSteal"      // 偷取时间：本题倒计时-3s
  | "answerBlur";    // 选项模糊：选项文字短暂模糊

/** 诈骗心理操控手法标签（用于教育属性升级） */
export type FBPsychology =
  | "urgency"      // 紧迫感
  | "authority"    // 权威恐吓
  | "greed"        // 贪婪诱惑
  | "fear"         // 恐惧施压
  | "trust"        // 信任建立
  | "intimacy"     // 情感亲密
  | "curiosity"    // 好奇心
  | "conformity"   // 从众压力
  | "scarcity"     // 稀缺性
  | "sunkCost";    // 沉没成本

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
  /** 心理操控手法标签（教育属性）：标注本题诈骗所利用的心理弱点 */
  psychology?: FBPsychology[];
  /** 关联反诈知识点 ID（用于结算雷达图）：与 CODEX 的 points 对应 */
  knowledgePoints?: string[];
  /** 填空题：正确答案文本（kind=fill 时使用） */
  fillAnswer?: string;
  /** 填空题：可接受的近义答案（不区分大小写/空格） */
  fillAccept?: string[];
  /** 连线题：左列项（与 right 配对，下标对应正确配对） */
  linkLeft?: string[];
  /** 连线题：右列项（顺序为打乱后呈现，配对关系由 linkPairing 指定） */
  linkRight?: string[];
  /** 连线题：正确配对，linkPairing[i] = 右列原始下标对应左列第 i 项 */
  linkPairing?: number[];
  /** 排序题：正确顺序的选项索引序列（玩家需按此顺序排列） */
  sortCorrect?: number[];
  // ===== 全面升级新增字段 =====
  /** 季节标签（A4：按月份加权抽题，缺省="all"） */
  season?: FBSeason[];
  /** AI 语音题：音频描述（A2，cardType="audio" 时使用） */
  audioClip?: FBAudioClip;
  /** 分支题：分支步骤定义（B3，kind="branch" 时使用） */
  branchSteps?: FBBranchStep[];
  /** 是否为分支题入口（B3） */
  isBranchEntry?: boolean;
  /** 案例溯源：真实案例元信息（A1，强化 source 字段的结构化展示） */
  caseArchive?: FBCaseArchive;
}

/** AI 语音/听音题音频描述（A2） */
export interface FBAudioClip {
  /** 音频描述：用于渲染"播放"按钮与波形 */
  label: string;
  /** 时长（秒） */
  duration: number;
  /** 是否为 AI 合成语音 */
  isSynthetic: boolean;
  /** 语音文本内容（渲染字幕用） */
  transcript: string;
  /** 合成技术提示（如"AI 拟声""Deepfake 换脸"） */
  synthTech?: string;
}

/** 分支题步骤（B3：第一人称情景模拟） */
export interface FBBranchStep {
  /** 步骤ID */
  id: string;
  /** 步骤标题 */
  title: string;
  /** 第一人称场景描述 */
  scene: string;
  /** 玩家可选回复（每个回复导向不同分支） */
  choices: FBBranchChoice[];
}

/** 分支题选项 */
export interface FBBranchChoice {
  /** 回复文本 */
  text: string;
  /** 该回复导向的下一步骤ID（null=结局） */
  nextStep?: string | null;
  /** 该回复是否为安全选择（正确路径） */
  safe?: boolean;
  /** 结局类型（nextStep=null 时生效） */
  ending?: "safe" | "scammed" | "warning";
  /** 结局说明 */
  endingDesc?: string;
  /** 该回复触发的心理手法标签 */
  psychology?: FBPsychology[];
}

/** 案例溯源档案（A1） */
export interface FBCaseArchive {
  /** 案例标题 */
  title: string;
  /** 发布日期 */
  date: string;
  /** 来源机构/账号 */
  source: string;
  /** 案例链接（可选） */
  url?: string;
  /** 关键启示 */
  takeaway: string;
}

/** 道具升级等级定义（B4） */
export interface FBItemUpgradeLevel {
  /** 等级 1-3 */
  level: number;
  /** 该等级名称 */
  name: string;
  /** 升级所需累计积分 */
  cost: number;
  /** 该等级效果描述 */
  effect: string;
  /** 道具参数（如 fifty: 移除错误选项数；freeze: 冻结秒数） */
  params: Record<string, number>;
}

/** 道具升级配置（B4） */
export interface FBItemUpgradeDef {
  type: FBItemType;
  levels: FBItemUpgradeLevel[];
}

/** 知识图谱节点（B1：替换雷达图） */
export interface FBKnowledgeNode {
  /** 知识点ID（对应 codex points） */
  id: string;
  /** 节点名称 */
  name: string;
  /** 诈骗大类（用于节点分组着色） */
  category: string;
  /** 正确数 */
  correct: number;
  /** 总数 */
  total: number;
  /** 掌握度 0..1 */
  mastery: number;
  /** 节点在图谱中的相对坐标 0..1 */
  x: number;
  y: number;
  /** 关联节点ID列表（连线） */
  links: string[];
}

/** 知识图谱（B1） */
export interface FBKnowledgeGraph {
  nodes: FBKnowledgeNode[];
  /** 全局掌握度 0..1 */
  overallMastery: number;
}

/** 受害者档案（B2：多分支结局） */
export interface FBVictimProfile {
  /** 档案类型ID */
  typeId: string;
  /** 档案名称（如"贪婪型受害者"） */
  name: string;
  /** 档案描述 */
  desc: string;
  /** 主要心理弱点 */
  weakness: FBPsychology[];
  /** 易受骗场景 */
  vulnerableScenes: string[];
  /** 防护建议 */
  advice: string[];
  /** 档案色调 */
  color: string;
  /** 严重度 0..1（错题越多越高） */
  severity: number;
}

/** Boss 周挑战状态（A6） */
export interface FBBossWeekState {
  /** 当前周次（ISO 周数） */
  weekKey: string;
  /** Boss ID */
  bossId: string;
  /** 本周击败次数 */
  defeats: number;
  /** 本周最佳分数 */
  bestScore: number;
  /** 已领取奖励次数 */
  rewardsClaimed: number;
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
  /** 当前难度模式（包A） */
  difficulty?: FBDifficulty;
  /** 连击大招能量 0..1（包C：combo≥10 可释放反诈必杀技） */
  ultimateReady: boolean;
  /** 终极技能量值 0..100 */
  ultimateEnergy: number;
  /** 答案模糊（Boss answerBlur 技能）：选项文字模糊中 */
  answerBlur?: boolean;
  /** 时间被偷取（Boss timeSteal 技能）：本题倒计时-3s 标记 */
  timeStolen?: boolean;
  /** 急速连答剩余题数（rapidFire 事件） */
  rapidFireRemaining?: number;
  /** 当前题心理操控手法（教育属性浮窗） */
  psychology?: string[];
  /** 填空题：玩家输入文本（kind=fill） */
  fillInput?: string;
  /** 连线题：玩家当前配对（linkSel[i] = 玩家为左列第 i 项选择的右列下标，-1=未选） */
  linkSel?: number[];
  /** 连线题：右列呈现顺序（打乱后） */
  linkRightOrder?: number[];
  /** 排序题：玩家当前排列（玩家拖动后的选项索引序列） */
  sortArr?: number[];
  /** 连线题：左列文本（kind=link） */
  linkLeft?: string[];
  /** 连线题：右列文本（kind=link，原始顺序，呈现顺序见 linkRightOrder） */
  linkRight?: string[];
  // ===== 全面升级新增字段 =====
  /** 双重诈骗同屏双卡模式（真同屏双卡） */
  dualMode?: boolean;
  /** 双重诈骗第二张卡的精简状态（dualMode=true 时有效） */
  second?: FBHudSecondCard | null;
  /** 当前主卡 3D 翻转进度 0..1（0=正面题目，1=反面答案） */
  flipProgress?: number;
  /** 上一帧段位等级（用于场景检测段位变化触发特效） */
  manLevelPrev?: number;
  /** 段位变化方向：up=升级, down=降级, null=无变化（场景层一次性消费） */
  manLevelDelta?: "up" | "down" | null;
  /** 判断题滑动手势进行中的偏移比 -1..1（负=左滑举报, 正=右滑通过），null=未在滑动 */
  swipeOffset?: number | null;
  /** 是否显示滑动手势引导（判断题且未操作时为 true） */
  swipeHint?: boolean;
  /** 错题本：本局累计错题记录 */
  wrongRecords?: FBWrongRecord[];
  /** 段位下降次数（统计） */
  tierDownCount?: number;
  /** 双重诈骗通过次数（统计） */
  dualCleared?: number;
  // ===== 全面升级 v2 新增字段 =====
  /** 道具升级等级（B4：每种道具 1-3 级） */
  itemLevels?: Record<FBItemType, number>;
  /** 当前分支题状态（B3，kind="branch" 时有效） */
  branch?: FBHudBranchState | null;
  /** AI 语音题播放状态（A2，cardType="audio" 时有效） */
  audio?: FBHudAudioState | null;
  /** 案例溯源展示（A1，揭示态展示真实案例出处） */
  caseArchive?: FBCaseArchive | null;
  /** 当前季节标签（A4，场景顶部展示） */
  seasonTag?: FBSeason | null;
  /** Boss 周挑战模式标记（A6） */
  bossWeekActive?: boolean;
}

/** 分支题 HUD 状态（B3） */
export interface FBHudBranchState {
  /** 当前步骤ID */
  currentStepId: string;
  /** 当前步骤标题 */
  currentTitle: string;
  /** 当前场景描述 */
  currentScene: string;
  /** 当前可选回复列表 */
  choices: FBBranchChoice[];
  /** 已走步骤历史（用于回看） */
  history: Array<{ stepId: string; choiceText: string }>;
  /** 是否已到达结局 */
  ended: boolean;
  /** 结局类型 */
  ending?: "safe" | "scammed" | "warning";
  /** 结局说明 */
  endingDesc?: string;
}

/** AI 语音题 HUD 状态（A2） */
export interface FBHudAudioState {
  /** 是否正在播放 */
  playing: boolean;
  /** 播放进度 0..1 */
  progress: number;
  /** 是否已播放完毕 */
  finished: boolean;
  /** 语音文本字幕 */
  transcript: string;
  /** 是否为 AI 合成 */
  isSynthetic: boolean;
  /** 合成技术提示 */
  synthTech?: string;
}

/** 滑动手势方向（判断题专用：左滑=举报, 右滑=通过） */
export type FBSwipeDir = "left" | "right";

/** 双重诈骗同屏第二张卡的精简 HUD 状态 */
export interface FBHudSecondCard {
  options: string[];
  qType: string;
  qKind: FBQuestionKind;
  title: string;
  body: string;
  cardType: FBCardType;
  /** 剩余时间比 0-1 */
  timerRatio: number;
  /** 玩家所选（null=未答） */
  selectedIdx: number | null;
  /** 正确选项（null=未答） */
  correctIdx: number | null;
  /** 是否触发风险惩罚 */
  riskTriggered: boolean;
  /** 滑动偏移比 -1..1（场景层滑动反馈） */
  swipeOffset: number | null;
  /** 3D 翻转进度 0..1 */
  flipProgress: number;
  isNormal: boolean;
  riskIdx: number[];
}

/** 难度模式（包A：难度选择） */
export type FBDifficulty = "easy" | "normal" | "hard";

/** 错题记录（包D：错题本） */
export interface FBWrongRecord {
  questionId: string;
  typeId: string;
  type: string;
  title: string;
  body: string;
  options: string[];
  playerAnswer: number | number[] | string;
  correctAnswer: number | number[] | string;
  explain: string;
  cues: string[];
  psychology?: string[];
  /** 错误时间戳（局内秒数） */
  atTs: number;
  /** 错误类型：错答 / 超时 / 风险触发 */
  kind: "wrong" | "timeout" | "risk";
}

/** 知识点掌握度（包D：雷达图） */
export interface FBKnowledgeStat {
  point: string;
  correct: number;
  total: number;
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
  /** 段位下降次数（错答掉段机制统计） */
  tierDownCount: number;
  /** 双重诈骗同屏双卡通过次数 */
  dualCleared: number;
  /** 错题记录（包D：错题本，最多保留 20 条） */
  wrongRecords: FBWrongRecord[];
  /** 知识点掌握度（包D：雷达图） */
  knowledgeStats: FBKnowledgeStat[];
  /** 终极技释放次数（包C） */
  ultimateUsed: number;
  /** 心理手法遭遇统计（包D：教育分析） */
  psychologyStats: Record<string, { correct: number; total: number }>;
  /** 心理手法最强弱点（包D：教育分析，正确率最低的手法） */
  weakestPsychology?: string;
  /** 局后存档数据（由 engine 在 gameOver 时注入） */
  save?: FBSaveData;
  /** 本局新解锁成就 ID 列表（由 engine 在 gameOver 时注入） */
  newAchievements?: string[];
  /** 段位晋级信息（由 engine 在 gameOver 时注入，无变化为 null） */
  rankUp?: FBRank | null;
  // ===== 全面升级 v2 新增统计 =====
  /** 知识图谱（B1：替换雷达图，结算页交互式展示） */
  knowledgeGraph?: FBKnowledgeGraph;
  /** 受害者档案（B2：多分支结局） */
  victimProfile?: FBVictimProfile;
  /** 案例档案列表（A1：本局遭遇的真实案例溯源） */
  caseArchives?: FBCaseArchive[];
  /** 分支题完成数（B3） */
  branchCompleted?: number;
  /** AI 语音题答对数（A2） */
  audioCorrect?: number;
  /** 季节性题目遇到数（A4） */
  seasonalEncountered?: number;
  /** Boss 周挑战击败数（A6） */
  bossWeekDefeated?: number;
  /** 错题复盘关卡通过数（A5） */
  reviewCleared?: number;
}
