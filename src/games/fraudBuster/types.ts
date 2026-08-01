import type { FBSaveData, FBRank } from "./storage";

/**
 * 游戏模式（v3 升级）：
 * - endless：无尽波次（原模式，默认）
 * - story：剧情战役（5-8 关线性剧本，每关固定题组+Boss）
 * - speedrun：极速闯关（30 题 / 5 分钟，按正确率+剩余时间排名）
 * - hardcore：硬核生存（1 点体力、无道具、答错即终局）
 * - daily：每日挑战（每日 10 题，全网同一份）
 * - review：错题噩梦（基于历史错题生成 20 题强化训练）
 *
 * v5 升级新增模式：
 * - aiBattle：AI 对战（与 AI 骗子多轮对话识破，规则模板驱动）
 * - versus：双人对战（同设备双人轮流答题，答对攻击对方血量）
 * - deconstruct：骗局拆解（观看骗子剧本逐句拆解，标注话术目的+心理手法）
 *
 * v6 升级新增模式：
 * - detective：反诈侦探·案件推理（多证据链交叉推理还原诈骗剧本）
 */
export type FBGameMode = "endless" | "story" | "speedrun" | "hardcore" | "daily" | "review" | "aiBattle" | "versus" | "deconstruct" | "detective";

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
  | "branch"   // 第一人称分支情景（B3）
  | "live"     // 直播间页面（v4 新增：短视频/直播带货诈骗）
  | "secondhand" // 二手平台聊天页（v4 新增：闲鱼/转转诈骗）
  | "recruit";   // 招聘聊天页（v4 新增：虚假招聘/培训贷）

/** 题型：单选 / 判断 / 多选 / 填空 / 连线 / 排序 / 分支 / 危机决策 / 证据判断 */
export type FBQuestionKind = "single" | "judge" | "multi" | "fill" | "link" | "sort" | "branch" | "crisis" | "evidence";

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
  // ===== v4 升级新增字段 =====
  /** 危机决策题（kind=crisis）：限时秒数（默认 5 秒），超时按错误处理 */
  crisisTimeLimit?: number;
  /** 证据判断题（kind=evidence）：聊天/短信截图分镜描述（每行一条消息，渲染为对话气泡） */
  evidenceImage?: FBEvidenceMessage[];
  /** 证据判断题：玩家需选出的"诈骗话术"所在消息索引（单选） */
  evidenceAnswer?: number;
  /** 证据判断题：每条消息的标签（可选：normal/scam/cue） */
  evidenceTags?: Array<"normal" | "scam" | "cue">;
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
  // ===== v5 升级新增字段 =====
  /** 多维度标签（用于智能出题和过滤，如 ["AI", "换脸", "实时", "视频通话"]） */
  tags?: string[];
  /** 题目更新日期（YYYY-MM 或 YYYY-MM-DD，用于题库版本管理） */
  updateDate?: string;
  /** 严重度 1-5（影响智能出题权重，5=高危新型诈骗） */
  severity?: number;
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

/** 证据判断题（v4）：聊天/短信截图分镜消息（渲染为对话气泡） */
export interface FBEvidenceMessage {
  /** 消息发送方：me=玩家自己 / scammer=对方 / system=系统提示 */
  from: "me" | "scammer" | "system";
  /** 消息文本内容 */
  text: string;
  /** 消息时间戳（可选，渲染时间气泡） */
  time?: string;
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
  /** 季节标签（A4，场景顶部展示） */
  seasonTag?: FBSeason | null;
  /** Boss 周挑战模式标记（A6） */
  bossWeekActive?: boolean;
  // ===== v3 升级新增字段（游戏模式） =====
  /** 当前游戏模式（v3） */
  gameMode?: FBGameMode;
  /** 极速模式：剩余秒数（speedrun 专用） */
  speedrunRemain?: number;
  /** 极速模式：总题数 */
  speedrunTotal?: number;
  /** 极速模式：当前已答题数 */
  speedrunAnswered?: number;
  /** 剧情模式：当前关卡索引（0-based） */
  storyStageIdx?: number;
  /** 剧情模式：当前关卡名称 */
  storyStageName?: string;
  /** 剧情模式：当前关卡题数 */
  storyStageTotal?: number;
  /** 剧情模式：当前关卡已答题数 */
  storyStageAnswered?: number;
  /** 每日挑战：日期 key（YYYY-MM-DD） */
  dailyKey?: string;
  /** 模式专属提示文案（如硬核模式"答错即终局"） */
  modeHint?: string | null;
  // ===== v4 升级新增字段 =====
  /** 危机决策题：剩余秒数（kind=crisis，倒计时比 timerRatio 更直观） */
  crisisRemainSec?: number;
  /** 危机决策题：总时长秒数 */
  crisisTotalSec?: number;
  /** 证据判断题：玩家选中的消息索引（null=未选） */
  evidenceSelectedIdx?: number | null;
  /** 证据判断题：消息列表（渲染对话气泡用） */
  evidenceMessages?: FBEvidenceMessage[];
  /** 本局每日任务实时进度快照（结算时由 engine 注入） */
  dailyTaskSnapshot?: Array<{ id: string; name: string; icon: string; progress: number; target: number; claimed: boolean }>;
  // ===== v5 升级新增字段 =====
  /** AI 对战模式状态（gameMode="aiBattle" 时有效） */
  aiDialog?: FBHudAIDialogState | null;
  /** 骗局拆解模式状态（gameMode="deconstruct" 时有效） */
  deconstruct?: FBHudDeconstructState | null;
  /** 双人对战模式状态（gameMode="versus" 时有效） */
  versus?: FBHudVSState | null;
  /** 智能错题画像：本周弱点报告（结算时注入） */
  weaknessReport?: FBWeaknessReport | null;
  // ===== v6 升级新增字段（教育功能：即时小课堂） =====
  /** 是否可展示小课堂（答错后揭示态 true，供场景层画"小课堂"按钮） */
  miniLessonAvailable?: boolean;
  /** 当前展示的小课堂教学卡（null=未展示，非 null=正在展示教学卡） */
  miniLesson?: FBMiniLesson | null;
  // ===== v6 升级新增字段（反诈侦探模式） =====
  /** 反诈侦探模式状态（gameMode="detective" 时有效） */
  detective?: FBHudDetectiveState | null;
}

/** 智能错题画像：本周弱点报告（v5 升级） */
export interface FBWeaknessReport {
  /** 最弱诈骗类型 ID */
  weakestTypeId?: string;
  /** 最弱诈骗类型名 */
  weakestTypeName?: string;
  /** 最弱类型正确率 0..1 */
  weakestTypeRate?: number;
  /** 最弱心理手法 */
  weakestPsychology?: string;
  /** 最弱心理手法正确率 0..1 */
  weakestPsychologyRate?: number;
  /** 推荐训练题目 ID 列表（10 题，针对弱点） */
  recommendedQuestionIds: string[];
  /** 报告生成日期 */
  reportDate: string;
  /** 弱点等级描述（如"高发"/"中发"/"低发"） */
  severityLabel: string;
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
  // ===== v3 升级新增统计（游戏模式） =====
  /** 当前游戏模式 */
  gameMode?: FBGameMode;
  /** 极速模式：用时（秒） */
  speedrunDuration?: number;
  /** 极速模式：正确数 */
  speedrunCorrect?: number;
  /** 极速模式：总题数 */
  speedrunTotal?: number;
  /** 剧情模式：通关关卡数 */
  storyStagesCleared?: number;
  /** 剧情模式：当前关卡索引 */
  storyStageIdx?: number;
  /** 硬核模式：答对题数 */
  hardcoreCorrect?: number;
  /** 每日挑战：日期 key */
  dailyKey?: string;
  /** 每日挑战：正确数 */
  dailyCorrect?: number;
  /** 错题噩梦：清除题数 */
  reviewNightmareCleared?: number;
  /** 是否完美一局（零失误） */
  perfectRun?: boolean;
  // ===== v4 升级新增统计 =====
  /** 危机决策题答对数（kind=crisis） */
  crisisCorrect?: number;
  /** 证据判断题答对数（kind=evidence） */
  evidenceCorrect?: number;
  /** 本局完成的每日任务 ID 列表 */
  completedDailyTasks?: string[];
  /** 本局获得的赛季经验 */
  seasonExpGained?: number;
  /** 本局触发的节日活动 ID（若参与） */
  seasonalEventId?: string;
  // ===== v5 升级新增统计 =====
  /** AI 对战模式：本局识破红旗数 */
  aiBattleBustScore?: number;
  /** AI 对战模式：使用的对话轮次 */
  aiBattleTurns?: number;
  /** AI 对战模式：结局类型 */
  aiBattleEnding?: "busted" | "scammed" | "timeout";
  /** 骗局拆解模式：完成剧本数 */
  deconstructCompleted?: number;
  /** 骗局拆解模式：累计识别红旗数 */
  deconstructRedFlags?: number;
  /** 双人对战模式：胜者（P1/P2/draw） */
  versusWinner?: "P1" | "P2" | "draw" | null;
  /** 双人对战模式：P1 答对数 */
  versusP1Correct?: number;
  /** 双人对战模式：P2 答对数 */
  versusP2Correct?: number;
  /** 智能错题画像报告（结算页展示） */
  weaknessReport?: FBWeaknessReport;
  // ===== v6 升级新增统计（反诈侦探模式） =====
  /** 反诈侦探模式：本局推理得分 0-100 */
  detectiveScore?: number;
  /** 反诈侦探模式：是否破案 */
  detectiveSolved?: boolean;
  /** 反诈侦探模式：识破的破局点数 */
  detectiveBreakingPoints?: number;
}

// ============ v3 升级：教育功能数据结构 ============

/** 反诈图鉴条目（v3 教育功能，与全局 CODEX 互补，聚焦 FraudBuster 题库覆盖的诈骗类型） */
export interface FBCodexEntry {
  /** 诈骗类型 ID（与 question.typeId 对应，如 F01/F02/F35 等） */
  typeId: string;
  /** 诈骗类型名（如"冒充公检法"） */
  name: string;
  /** 图标 emoji */
  icon: string;
  /** 一句话核心警示（catchphrase） */
  catchphrase: string;
  /** 标语口号 */
  slogan: string;
  /** 防骗要点（3-5 条） */
  points: string[];
  /** 标准应对话术 */
  response: string;
  /** 来源机构 */
  source: string;
  /** 难度等级：basic / intermediate / advanced */
  courseLevel: "basic" | "intermediate" | "advanced";
  /** 心理操控手法标签（与 FBPsychology 对应） */
  psychology?: FBPsychology[];
  /** 关联知识点 ID（与 KNOWLEDGE_GRAPH_LAYOUT 对应） */
  knowledgePoint?: string;
  /** 季节标签（季节性诈骗类型标注） */
  season?: FBSeason[];
  /** 真实案例档案（图鉴底部展示） */
  caseArchives?: FBCaseArchive[];
  /** 是否已解锁（图鉴浏览场景根据存档 byType 是否遇到过该类型判定） */
  encountered?: boolean;
  /** 该类型累计正确率（来自存档 byType，0..1） */
  mastery?: number;
}

/** 96110 模拟通话话术节点（v3 教育功能：反诈中心接线员模拟对话） */
export interface FBHotlineNode {
  /** 节点 ID */
  id: string;
  /** 接线员台词 */
  operator: string;
  /** 玩家可选回复列表 */
  choices: FBHotlineChoice[];
}

/** 96110 通话选项 */
export interface FBHotlineChoice {
  /** 玩家回复文本 */
  text: string;
  /** 下一节点 ID（null=通话结束） */
  next?: string | null;
  /** 该回复的评价（正确/警告/错误） */
  verdict?: "right" | "warn" | "wrong";
  /** 评价说明 */
  feedback?: string;
  /** 是否为终结节点（next=null 且给出结论） */
  ending?: "verified" | "scam" | "uncertain";
}

/** 96110 模拟通话剧本（v3 教育功能） */
export interface FBHotlineScript {
  /** 剧本 ID */
  id: string;
  /** 剧本名称（如"怀疑遭遇冒充公检法"） */
  title: string;
  /** 触发场景描述（玩家遇到的诈骗类型简介） */
  scenario: string;
  /** 关联诈骗类型 ID（用于图鉴联动） */
  typeId: string;
  /** 起始节点 ID */
  startNodeId: string;
  /** 节点列表 */
  nodes: FBHotlineNode[];
  /** 完成后学习要点 */
  takeaways: string[];
}

/** 剧情模式关卡定义（v3：story mode 关卡配置） */
export interface FBStoryStage {
  /** 关卡索引（0-based） */
  idx: number;
  /** 关卡 ID */
  id: string;
  /** 关卡名（如"第一关：初识骗术"） */
  name: string;
  /** 关卡剧情简介 */
  intro: string;
  /** 关卡结束语（通关后展示） */
  outro: string;
  /** 题目 ID 白名单（从全题库中筛选） */
  questionIds: string[];
  /** 关卡 Boss ID（可选，最后关卡才有） */
  bossId?: string;
  /** 通关所需最低正确数 */
  passCorrect: number;
  /** 关卡主题色 */
  themeColor: string;
  /** 关卡图标 */
  icon: string;
  /** v5：是否为支线关卡 */
  isBranch?: boolean;
  /** v5：支线解锁条件描述（如"主线第3关完美通关"） */
  unlockCondition?: string;
  /** v5：是否为隐藏结局关卡 */
  isHiddenEnding?: boolean;
  /** v5：结局类型 */
  endingType?: "normal" | "hidden" | "true";
}

/** 战报分享卡数据（v3：Canvas 导出 PNG 用） */
export interface FBBattleReportCard {
  /** 玩家段位名 */
  rankName: string;
  /** 段位图标 */
  rankIcon: string;
  /** 段位颜色 */
  rankColor: string;
  /** 本局得分 */
  score: number;
  /** 本局波次 */
  wave: number;
  /** 本局识破数 */
  busted: number;
  /** 最高连击 */
  maxCombo: number;
  /** 游戏模式 */
  gameMode: FBGameMode;
  /** 模式中文名 */
  modeLabel: string;
  /** 受害者档案名（若匹配） */
  victimProfileName?: string;
  /** 完美一局标记 */
  perfectRun: boolean;
  /** 日期 */
  date: string;
  /** 玩家铭言（随机或自选） */
  motto: string;
}

// ============ v4 升级：每日任务系统 ============

/** 每日任务类型（触发条件） */
export type FBTaskType =
  | "bustCount"       // 识破 N 起诈骗
  | "bustType"        // 识破指定类型 N 起
  | "combo"           // 达成 N 连击
  | "perfectWave"     // 单波次完美（不丢血）
  | "useItem"         // 使用 N 次道具
  | "clearMode"       // 通关指定模式
  | "bossDefeat";     // 击败 N 个 Boss

/** 每日任务定义 */
export interface FBDailyTask {
  /** 任务 ID（稳定，用于存档记录） */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  desc: string;
  /** 任务图标 */
  icon: string;
  /** 任务类型 */
  type: FBTaskType;
  /** 目标数值（如识破 5 起） */
  target: number;
  /** 任务类型参数（如 bustType 的 typeId） */
  params?: { typeId?: string; mode?: FBGameMode };
  /** 奖励积分 */
  rewardScore: number;
  /** 奖励赛季经验 */
  rewardExp: number;
}

/** 每日任务进度（存档） */
export interface FBDailyTaskProgress {
  /** 任务 ID */
  taskId: string;
  /** 当前进度 */
  progress: number;
  /** 是否已领取奖励 */
  claimed: boolean;
}

// ============ v4 升级：节日活动关卡 ============

/** 节日活动定义（限时开放，独立题组+限定奖励） */
export interface FBSeasonalEvent {
  /** 活动 ID */
  id: string;
  /** 活动名称 */
  name: string;
  /** 活动图标 */
  icon: string;
  /** 关联季节 */
  season: FBSeason;
  /** 活动开放月份（1-12，多月份如 [1,2]） */
  activeMonths: number[];
  /** 活动简介 */
  intro: string;
  /** 通关结束语 */
  outro: string;
  /** 题目 ID 白名单 */
  questionIds: string[];
  /** 通关所需最低正确数 */
  passCorrect: number;
  /** 主题色 */
  themeColor: string;
  /** 奖励赛季经验 */
  rewardExp: number;
  /** 奖励成就 ID（首次通关解锁） */
  rewardAchievementId?: string;
}

// ============ v4 升级：本地排行榜（无后端） ============

/** 本地排行榜条目 */
export interface FBLocalRankEntry {
  /** 排名 */
  rank: number;
  /** 玩家名（玩家自己或 NPC） */
  name: string;
  /** 是否为玩家自己 */
  isPlayer: boolean;
  /** 分数 */
  score: number;
  /** 段位名 */
  rankName: string;
  /** 段位图标 */
  rankIcon: string;
  /** 游戏模式 */
  gameMode: FBGameMode;
  /** 日期（YYYY-MM-DD） */
  date: string;
  /** 是否为完美一局 */
  perfect: boolean;
}

// ============ v4 升级：反诈工具箱 ============

/** 反诈工具箱条目类型 */
export type FBToolType =
  | "selfCheck"    // 账号自查清单
  | "report"       // 举报指引
  | "emergency"    // 紧急止付流程
  | "hotline"      // 反诈专线
  | "verify";      // 官方核实渠道

/** 反诈工具箱条目 */
export interface FBFraudToolItem {
  /** 工具 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具图标 */
  icon: string;
  /** 工具类型 */
  type: FBToolType;
  /** 简短描述 */
  desc: string;
  /** 详细步骤/清单 */
  steps: string[];
  /** 关键电话/链接（如 96110、110） */
  contact?: string;
  /** 适用场景 */
  applicableScenes: string[];
}

// ============ v5 升级：骗局拆解模式（deconstruct） ============

/** 骗局拆解剧本单行对白 */
export interface FBDeconstructLine {
  /** 发言方：scammer=骗子 / victim=受害者 / system=系统提示 */
  from: "scammer" | "victim" | "system";
  /** 对白文本 */
  text: string;
  /** 话术目的（如"建立人设"/"利益诱惑"/"紧迫催促"/"权威压迫"） */
  tactic?: string;
  /** 利用的心理手法 */
  psychology?: FBPsychology[];
  /** 拆解说明（教玩家如何识别） */
  deconstruct?: string;
  /** 危险信号等级 0-5（0=正常对话，5=致命红旗） */
  redFlag?: number;
}

/** 骗局拆解剧本总结 */
export interface FBDeconstructSummary {
  /** 累计致命红旗数 */
  totalRedFlags: number;
  /** 关键识别词列表 */
  keyCues: string[];
  /** 易受害人群档案名 */
  victimProfile: string;
  /** 核心教训（一句话） */
  lesson: string;
}

/** 骗局拆解剧本（对应 deconstruct-scenarios.json） */
export interface FBDeconstructScenario {
  /** 剧本 ID（DC-001 等） */
  id: string;
  /** 关联诈骗类型 ID */
  typeId: string;
  /** 诈骗类型名 */
  type: string;
  /** 剧本标题 */
  title: string;
  /** 难度 1-4 */
  difficulty: number;
  /** 场景简介 */
  scenario: string;
  /** 预计时长（分钟） */
  duration?: number;
  /** 多维度标签 */
  tags?: string[];
  /** 更新日期 */
  updateDate?: string;
  /** 严重度 1-5 */
  severity?: number;
  /** 对白列表 */
  script: FBDeconstructLine[];
  /** 总结 */
  summary: FBDeconstructSummary;
}

// ============ v5 升级：AI 对战模式（aiBattle） ============

/** AI 对战对话轮次 */
export interface FBAIDialogTurn {
  /** 发言方：scammer=AI骗子 / player=玩家 / system=系统 */
  from: "scammer" | "player" | "system";
  /** 对白文本 */
  text: string;
  /** 该轮次的话术标签（骗子轮次） */
  tactic?: string;
  /** 该轮次利用的心理手法 */
  psychology?: FBPsychology[];
  /** 时间戳（局内秒数） */
  atTs?: number;
}

/** AI 对战剧本（规则模板驱动，预生成多轮对话树） */
export interface FBAIDialogScenario {
  /** 剧本 ID */
  id: string;
  /** 关联诈骗类型 ID */
  typeId: string;
  /** 诈骗类型名 */
  type: string;
  /** 剧本标题 */
  title: string;
  /** 难度 1-4 */
  difficulty: number;
  /** 场景简介 */
  scenario: string;
  /** 骗子人设描述（影响话术风格） */
  persona: string;
  /** 最大轮次（达到后强制结算） */
  maxTurns: number;
  /** 对话树节点 */
  nodes: FBAIDialogNode[];
  /** 起始节点 ID */
  startNodeId: string;
  /** 通关条件：识别的关键红旗数阈值 */
  passThreshold: number;
}

/** AI 对战对话节点 */
export interface FBAIDialogNode {
  /** 节点 ID */
  id: string;
  /** 骗子台词（可多条，按权重随机选1条） */
  scammerLines: string[];
  /** 话术标签 */
  tactic?: string;
  /** 心理手法 */
  psychology?: FBPsychology[];
  /** 该节点的红旗等级 0-5 */
  redFlag: number;
  /** 玩家可选回复（每条导向不同节点） */
  choices: FBAIDialogChoice[];
}

/** AI 对战玩家选项 */
export interface FBAIDialogChoice {
  /** 玩家回复文本 */
  text: string;
  /** 下一节点 ID（null=对话结束） */
  nextNodeId?: string | null;
  /** 该回复是否为"识破"（正确识别诈骗） */
  bust?: boolean;
  /** 该回复识别的红旗数（加到玩家分数） */
  bustScore?: number;
  /** 该回复的评价 */
  verdict?: "right" | "warn" | "wrong";
  /** 评价说明 */
  feedback?: string;
}

// ============ v5 升级：双人对战模式（versus） ============

/** 双人对战玩家状态 */
export interface FBVSPlayerState {
  /** 玩家标识（P1/P2） */
  id: "P1" | "P2";
  /** 显示名 */
  name: string;
  /** 血量 0-100 */
  hp: number;
  /** 最大血量 */
  maxHp: number;
  /** 本局答对数 */
  correct: number;
  /** 本局答错数 */
  wrong: number;
  /** 连击数 */
  combo: number;
  /** 是否当前回合 */
  isTurn: boolean;
  /** 段位图标（装饰用） */
  icon: string;
  /** 主题色 */
  color: string;
}

// ============ v5 升级：HUD 新增状态字段 ============

/** AI 对战 HUD 状态 */
export interface FBHudAIDialogState {
  /** 当前剧本 */
  scenarioId: string;
  /** 当前剧本标题 */
  scenarioTitle: string;
  /** 当前节点 ID */
  currentNodeId: string;
  /** 已发生对话轮次 */
  turns: FBAIDialogTurn[];
  /** 当前轮次骗子台词（高亮显示） */
  currentScammerLine: string;
  /** 当前节点红旗等级 */
  currentRedFlag: number;
  /** 当前话术标签 */
  currentTactic: string;
  /** 玩家累计识破红旗数 */
  bustScore: number;
  /** 通关阈值 */
  passThreshold: number;
  /** 已用轮次 */
  turnCount: number;
  /** 最大轮次 */
  maxTurns: number;
  /** 是否已结束 */
  ended: boolean;
  /** 结局类型 */
  ending?: "busted" | "scammed" | "timeout";
  /** 结局说明 */
  endingDesc?: string;
  /** 当前节点可选回复（供场景画按钮） */
  currentChoices: FBAIDialogChoice[];
}

/** 骗局拆解 HUD 状态 */
export interface FBHudDeconstructState {
  /** 当前剧本 */
  scenarioId: string;
  /** 当前展示的行索引 */
  currentLineIdx: number;
  /** 总行数 */
  totalLines: number;
  /** 当前行数据 */
  currentLine: FBDeconstructLine;
  /** 已展示的行（含拆解） */
  revealedLines: FBDeconstructLine[];
  /** 是否已展示拆解（false=仅显示对白，true=显示拆解说明） */
  deconstructRevealed: boolean;
  /** 是否已到达总结 */
  summaryShown: boolean;
  /** 总结数据 */
  summary: FBDeconstructSummary | null;
  /** 累计红旗数 */
  totalRedFlags: number;
}

/** 双人对战 HUD 状态 */
export interface FBHudVSState {
  /** 玩家1状态 */
  p1: FBVSPlayerState;
  /** 玩家2状态 */
  p2: FBVSPlayerState;
  /** 当前回合玩家 ID */
  currentTurn: "P1" | "P2";
  /** 总题数 */
  totalQuestions: number;
  /** 当前题索引 */
  currentQuestionIdx: number;
  /** 是否已结束 */
  ended: boolean;
  /** 胜者（null=平局或未结束） */
  winner: "P1" | "P2" | "draw" | null;
  /** 当前题目（ ended=false 时有效） */
  currentQuestion?: FBQuestion | null;
  /** 上一回合结果反馈（答对/答错 + 伤害） */
  lastResult?: { correct: boolean; damage: number; target: "P1" | "P2"; feedback: string } | null;
}

// ============ v6 升级：教育功能（证书系统 / 案例库百科 / 即时小课堂） ============

/** 反诈证书类型（5 张多条件证书，C1 教育功能） */
export type FBCertificateType =
  | "bustMilestone"   // 识破里程碑
  | "hardcorePerfect" // 硬核完美
  | "deconstructAll"  // 拆解专家
  | "aiBattleAll"     // AI 克星
  | "rankMaster";     // 段位大师

/** 反诈证书定义（完整结构，用于 UI 渲染） */
export interface FBCertificate {
  /** 证书 ID（稳定标识，如 CERT-BUST-2000） */
  id: string;
  /** 证书类型 */
  type: FBCertificateType;
  /** 证书名称（如"识破宗师"） */
  name: string;
  /** 证书图标 emoji */
  icon: string;
  /** 证书主题色（金/银/铜等，用于边框渲染） */
  color: string;
  /** 证书简短描述 */
  desc: string;
  /** 颁发条件说明（玩家可见） */
  condition: string;
  /** 证书价值主张（颁发时展示的祝贺语） */
  citation: string;
  /** 难度等级：basic / intermediate / advanced / master */
  level: "basic" | "intermediate" | "advanced" | "master";
}

/** 证书颁发进度（用于 UI 展示未完成证书的进度条） */
export interface FBCertificateProgress {
  /** 证书 ID */
  certId: string;
  /** 当前进度值 */
  current: number;
  /** 目标值 */
  target: number;
  /** 进度比 0..1 */
  ratio: number;
  /** 是否已完成（达到目标） */
  completed: boolean;
  /** 是否已颁发（completed && 已记录到存档） */
  issued: boolean;
  /** 进度描述（如"500/2000 识破"） */
  label: string;
}

/** 案例库百科条目（C2：聚合 caseArchives 构建可查询案例库） */
export interface FBCaseLibraryEntry {
  /** 案例唯一 ID（自动生成：typeId + 索引） */
  id: string;
  /** 关联诈骗类型 ID */
  typeId: string;
  /** 关联诈骗类型名 */
  typeName: string;
  /** 诈骗类型图标 */
  typeIcon: string;
  /** 案例标题 */
  title: string;
  /** 案例发布日期 */
  date: string;
  /** 来源机构 */
  source: string;
  /** 案例链接（可选） */
  url?: string;
  /** 关键启示 */
  takeaway: string;
  /** 来源题目 ID（用于反查原题） */
  fromQuestionId?: string;
  /** 来源图鉴条目（若来自 codex.caseArchives） */
  fromCodex?: boolean;
  /** 严重度 1-5（来自关联题目或图鉴） */
  severity?: number;
  /** 心理操控手法标签 */
  psychology?: FBPsychology[];
  /** 关联知识点 ID */
  knowledgePoints?: string[];
}

/** 案例库查询过滤器（C2） */
export interface FBCaseLibraryFilter {
  /** 按诈骗类型 ID 过滤（空=全部） */
  typeIds?: string[];
  /** 按来源机构过滤 */
  sources?: string[];
  /** 按严重度下限过滤（>=） */
  minSeverity?: number;
  /** 按心理手法过滤 */
  psychology?: FBPsychology[];
  /** 按日期范围过滤（YYYY-MM） */
  dateFrom?: string;
  dateTo?: string;
  /** 关键词搜索（标题 + takeaway 模糊匹配） */
  keyword?: string;
}

/** 即时小课堂教学卡（C3：答错后展示的图文教学） */
export interface FBMiniLesson {
  /** 关联题目 ID */
  questionId: string;
  /** 关联诈骗类型 ID */
  typeId: string;
  /** 诈骗类型名 */
  typeName: string;
  /** 诈骗类型图标 */
  typeIcon: string;
  /** 教学标题（如"识破'安全账户'陷阱"） */
  title: string;
  /** 核心知识点（3-5 条要点） */
  keyPoints: string[];
  /** 该诈骗利用的心理手法（教育属性） */
  psychology: FBPsychology[];
  /** 心理手法人话解读（如"恐惧：让你失去判断力"） */
  psychologyExplain: string[];
  /** 标准应对话术 */
  response: string;
  /** 关联图鉴 typeId（用于"查看图鉴"跳转） */
  codexTypeId: string;
  /** 关联案例库条目 ID（可选，用于查看真实案例） */
  caseLibraryId?: string;
}

// ============ v6 升级：反诈侦探模式（detective） ============

/** 反诈侦探案件（detective 模式）：多证据链交叉推理 */
export interface FBDetectiveCase {
  /** 案件 ID（如 DET-001） */
  id: string;
  /** 关联诈骗类型 ID（F01/F02/F87 等） */
  typeId: string;
  /** 诈骗类型名 */
  type: string;
  /** 案件标题 */
  title: string;
  /** 难度 1-4 */
  difficulty: number;
  /** 案情简报（接警时展示） */
  briefing: string;
  /** 受害者画像（复用 VICTIM_PROFILES 的 typeId） */
  victimProfileId: string;
  /** 证据收集时限（秒，默认 60） */
  evidenceReviewSec: number;
  /** 多源证据列表（至少 3 类证据） */
  evidences: FBDetectiveEvidence[];
  /** 推理问答列表（3-5 题，递进式） */
  reasoningQuestions: FBDetectiveQuestion[];
  /** 破局点：诈骗剧本的关键转折点 */
  breakingPoint: {
    /** 在 evidences 中的索引 */
    evidenceIdx: number;
    /** 在该证据内部的位置（如第几条消息，0-based） */
    innerIdx: number;
    /** 破局点说明 */
    desc: string;
  };
  /** 案件复盘 */
  caseSummary: {
    /** 完整诈骗剧本还原（按时间线） */
    timeline: string[];
    /** 利用的心理弱点（复用 FBPsychology） */
    psychology: FBPsychology[];
    /** 核心教训 */
    lesson: string;
    /** 关联案例档案（复用 FBCaseArchive） */
    caseArchive?: FBCaseArchive;
  };
  /** 多维度标签 */
  tags?: string[];
  /** 更新日期（YYYY-MM） */
  updateDate?: string;
  /** 严重度 1-5 */
  severity?: number;
}

/** 侦探案件证据片段（多源） */
export interface FBDetectiveEvidence {
  /** 证据 ID */
  id: string;
  /** 证据类型 */
  kind: "chat" | "transfer" | "call" | "link" | "screenshot" | "audio";
  /** 证据标题（如"与骗子聊天记录""银行转账流水"） */
  title: string;
  /** 证据内容（结构因 kind 而异） */
  payload: FBDetectiveEvidencePayload;
  /** 证据标签：key=关键证据 / misleading=误导证据 / normal=正常证据 */
  tag: "key" | "misleading" | "normal";
  /** 该证据揭露的诈骗话术要点 */
  revealedCues?: string[];
}

/** 证据内容（联合类型，按 kind 区分） */
export type FBDetectiveEvidencePayload =
  | { kind: "chat"; messages: FBEvidenceMessage[] }   // 复用现有 FBEvidenceMessage
  | { kind: "transfer"; flows: Array<{ from: string; to: string; amount: string; time: string; note?: string }> }
  | { kind: "call"; transcript: string; duration: number; callerNumber: string; isSyntheticVoice?: boolean }
  | { kind: "link"; url: string; screenshotDesc: string; domainAnalysis: string; isPhishing: boolean }
  | { kind: "screenshot"; desc: string; details: string[]; tampered: boolean }
  | { kind: "audio"; clip: FBAudioClip };  // 复用现有 FBAudioClip

/** 推理问答题（递进式 3-5 题） */
export interface FBDetectiveQuestion {
  /** 问题 ID */
  id: string;
  /** 问题类型 */
  kind: "single" | "multi" | "sort" | "link";
  /** 问题文本 */
  question: string;
  /** 选项 */
  options: string[];
  /** 单选/判断正确索引 */
  answer?: number;
  /** 多选正确索引列表 */
  answers?: number[];
  /** 排序正确序列 */
  sortCorrect?: number[];
  /** 连线题左列 */
  linkLeft?: string[];
  /** 连线题右列 */
  linkRight?: string[];
  /** 连线题正确配对 */
  linkPairing?: number[];
  /** 答错是否锁定（不允许重试） */
  lockOnWrong?: boolean;
  /** 解析 */
  explain: string;
  /** 该问题对应的推理阶段 */
  stage: "identify" | "locate" | "reconstruct" | "prevent";
}

/** 侦探模式 HUD 状态 */
export interface FBHudDetectiveState {
  /** 当前案件 ID */
  caseId: string;
  /** 案件标题 */
  caseTitle: string;
  /** 当前阶段 */
  stage: "briefing" | "evidence" | "reasoning" | "summary" | "archived";
  /** 证据浏览剩余秒数（evidence 阶段） */
  evidenceRemainSec: number;
  /** 证据总浏览秒数 */
  evidenceTotalSec: number;
  /** 已查看的证据 ID 列表 */
  viewedEvidenceIds: string[];
  /** 当前选中的证据 ID（null=未选中） */
  selectedEvidenceId: string | null;
  /** 当前推理问题索引 */
  currentQuestionIdx: number;
  /** 总问题数 */
  totalQuestions: number;
  /** 已回答问题结果 */
  answeredQuestions: Array<{ questionId: string; correct: boolean; playerAnswer: number | number[] }>;
  /** 推理得分 0-100 */
  reasoningScore: number;
  /** 是否已破案（reasoningScore >= 60） */
  caseSolved: boolean;
  /** 破局点是否被玩家选中 */
  breakingPointFound: boolean;
  /** 是否已结束 */
  ended: boolean;
  /** 结局说明 */
  endingDesc?: string;
}

