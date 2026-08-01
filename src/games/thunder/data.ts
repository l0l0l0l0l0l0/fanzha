import type { EnemyTypeDef, PowerupDef, WaveEntry, PowerupKind, Title, BossDef, WeaponLevel, WeaponBranch, WeaponBranchDef } from "./types";
import type {
  Difficulty,
  DifficultyConfig,
  ThunderMode,
  ThunderTheme,
  ThunderThemeDef,
  RoguelikeBuffKind,
  RoguelikeBuffDef,
  CharacterId,
  CharacterDef,
  EquipSlot,
  EquipRarity,
  EquipmentDef,
  WeaponAwakeningDef,
  WeaponBranchLevel,
  ThunderSkinDef,
  DroneDef,
  CaseTheaterDef,
  WeeklyModifierDef,
  ThunderQuestDef,
  BossPhaseDef,
  ThunderBossAIDialog,
  ThunderMantraChainDef,
  ThunderFraudArchive,
  ThunderSeasonPassDef,
  ThunderSeasonPassReward,
  ThunderSuperAwakeningDef,
} from "./types";

/** 荣誉称号体系：随积分逐级晋升 */
export const TITLES: Title[] = [
  { id: "recruit",   name: "反诈新兵",   minScore: 0,     color: "#7A8FB0" },
  { id: "guardian",  name: "反诈卫士",   minScore: 500,   color: "#52C41A" },
  { id: "vanguard",  name: "反诈先锋",   minScore: 1500,  color: "#00E5FF" },
  { id: "warrior",   name: "反诈勇士",   minScore: 3000,  color: "#3B7FEF" },
  { id: "knight",    name: "反诈骑士",   minScore: 5000,  color: "#FFD666" },
  { id: "general",   name: "反诈将领",   minScore: 8000,  color: "#FF7A1A" },
  { id: "commander", name: "反诈统帅",   minScore: 12000, color: "#B388FF" },
  { id: "legend",    name: "反诈传奇",   minScore: 18000, color: "#FF5A60" },
  { id: "demigod",   name: "反诈神将",   minScore: 28000, color: "#FF00E5" },
];

/** 取当前称号与下一档缺口 */
export function titleFor(score: number): { title: Title; next?: Title; gap: number } {
  let cur = TITLES[0];
  let next: Title | undefined;
  for (let i = 0; i < TITLES.length; i++) {
    if (score >= TITLES[i].minScore) {
      cur = TITLES[i];
      next = TITLES[i + 1];
    }
  }
  const gap = next ? Math.max(0, next.minScore - score) : 0;
  return { title: cur, next, gap };
}

/** 敌方形象命名贴合电信诈骗套路 */
export const ENEMIES: Record<string, EnemyTypeDef> = {
  script: {
    id: "script",
    name: "杀猪盘话术",
    emoji: "💬",
    hp: 20,
    speed: 120,
    score: 60,
    color: "#9FE3FF",
    fraudType: "杀猪盘诈骗",
    pattern: "straight",
    dropRate: 0.18,
  },
  fakecs: {
    id: "fakecs",
    name: "冒充客服",
    emoji: "🎧",
    hp: 35,
    speed: 90,
    score: 100,
    color: "#FFB020",
    fraudType: "冒充客服诈骗",
    pattern: "zigzag",
    dropRate: 0.22,
  },
  threat: {
    id: "threat",
    name: "冒充公检法",
    emoji: "📜",
    hp: 60,
    speed: 60,
    score: 160,
    color: "#E5353B",
    fraudType: "冒充公检法诈骗",
    pattern: "shooter",
    shootInterval: 1.8,
    dropRate: 0.3,
  },
  phishmine: {
    id: "phishmine",
    name: "钓鱼链接",
    emoji: "🎣",
    hp: 40,
    speed: 70,
    score: 140,
    color: "#1AD670",
    fraudType: "钓鱼网站诈骗",
    pattern: "miner",
    shootInterval: 2.4,
    dropRate: 0.25,
  },
  brushing: {
    id: "brushing",
    name: "刷单返利",
    emoji: "💰",
    hp: 16,
    speed: 150,
    score: 90,
    color: "#FFD666",
    fraudType: "刷单返利诈骗",
    pattern: "straight",
    dropRate: 0.16,
  },
  invest: {
    id: "invest",
    name: "虚假投资",
    emoji: "📈",
    hp: 55,
    speed: 78,
    score: 170,
    color: "#B388FF",
    fraudType: "虚假投资理财诈骗",
    pattern: "zigzag",
    shootInterval: 2.6,
    dropRate: 0.26,
  },
  /** v4 替换：pie → dcep（数字人民币诈骗） */
  dcep: {
    id: "dcep",
    name: "数字人民币钱包",
    emoji: "💎",
    hp: 14,
    speed: 165,
    score: 80,
    color: "#FFC53D",
    fraudType: "数字人民币诈骗",
    pattern: "straight",
    dropRate: 0.15,
  },
  /** v4 替换：phonebrush → aiVoice（AI 语音克隆） */
  aiVoice: {
    id: "aiVoice",
    name: "AI语音克隆",
    emoji: "🎙",
    hp: 24,
    speed: 130,
    score: 110,
    color: "#FF7AB8",
    fraudType: "AI语音克隆诈骗",
    pattern: "zigzag",
    dropRate: 0.2,
  },
  /** v4 替换：bitcoin → facetime（FaceTime 冒充客服） */
  facetime: {
    id: "facetime",
    name: "FaceTime冒充客服",
    emoji: "📱",
    hp: 48,
    speed: 65,
    score: 200,
    color: "#F7931A",
    fraudType: "FaceTime冒充客服诈骗",
    pattern: "miner",
    shootInterval: 2.2,
    dropRate: 0.28,
  },
  /** v4 替换：guarantee → expressClaim（快递理赔诈骗） */
  expressClaim: {
    id: "expressClaim",
    name: "快递理赔诈骗",
    emoji: "📦",
    hp: 70,
    speed: 55,
    score: 220,
    color: "#FF4D4F",
    fraudType: "快递理赔诈骗",
    pattern: "shooter",
    shootInterval: 1.6,
    dropRate: 0.32,
  },
  pigboy: {
    id: "pigboy",
    name: "完美“男友教我理财”",
    emoji: "🐷",
    hp: 90,
    speed: 72,
    score: 280,
    color: "#FF85C0",
    fraudType: "杀猪盘诈骗",
    pattern: "zigzag",
    shootInterval: 2.0,
    dropRate: 0.34,
  },
  /** 精英敌人：AI 换脸伪警（新增），带护盾 */
  deepfake: {
    id: "deepfake",
    name: "AI换脸伪警",
    emoji: "🤖",
    hp: 60,
    shield: 50,
    speed: 50,
    score: 320,
    color: "#9D4EDD",
    fraudType: "AI换脸诈骗",
    pattern: "shooter",
    shootInterval: 1.4,
    dropRate: 0.42,
    elite: true,
  },
  /** 精英敌人：虚假中奖链接（新增），高血量带护盾 */
  fakeLottery: {
    id: "fakeLottery",
    name: "虚假中奖通知",
    emoji: "🎰",
    hp: 50,
    shield: 40,
    speed: 88,
    score: 260,
    color: "#FF006E",
    fraudType: "虚假中奖诈骗",
    pattern: "zigzag",
    shootInterval: 2.2,
    dropRate: 0.38,
    elite: true,
  },
  // ===== v5 新增：2026 高发电诈类型敌人 =====
  /** 共享屏幕诈骗：远程操控受害者手机 */
  screenShare: {
    id: "screenShare",
    name: "共享屏幕诈骗",
    emoji: "📱",
    hp: 28,
    speed: 110,
    score: 130,
    color: "#5B8FF9",
    fraudType: "共享屏幕诈骗",
    pattern: "zigzag",
    shootInterval: 2.0,
    dropRate: 0.22,
  },
  /** 机票退改签诈骗 */
  flightRefund: {
    id: "flightRefund",
    name: "机票退改签",
    emoji: "✈",
    hp: 22,
    speed: 140,
    score: 120,
    color: "#5AD8A6",
    fraudType: "机票退改签诈骗",
    pattern: "straight",
    dropRate: 0.18,
  },
  /** 游戏账号交易诈骗 */
  gameAccTrade: {
    id: "gameAccTrade",
    name: "游戏账号交易",
    emoji: "🎮",
    hp: 38,
    speed: 100,
    score: 150,
    color: "#FF9C2E",
    fraudType: "游戏账号交易诈骗",
    pattern: "shooter",
    shootInterval: 1.9,
    dropRate: 0.24,
  },
  /** 虚假招工诈骗 */
  fakeRecruit: {
    id: "fakeRecruit",
    name: "虚假高薪招工",
    emoji: "💼",
    hp: 65,
    speed: 60,
    score: 210,
    color: "#F6BD16",
    fraudType: "虚假招工诈骗",
    pattern: "shooter",
    shootInterval: 1.7,
    dropRate: 0.3,
  },
  /** 数字藏品/NFT 诈骗 */
  digitalCollect: {
    id: "digitalCollect",
    name: "虚假数字藏品",
    emoji: "🖼",
    hp: 18,
    speed: 155,
    score: 100,
    color: "#E8684A",
    fraudType: "数字藏品诈骗",
    pattern: "straight",
    dropRate: 0.16,
  },
  /** 短视频引流诈骗 */
  shortVideo: {
    id: "shortVideo",
    name: "短视频引流",
    emoji: "🎬",
    hp: 26,
    speed: 125,
    score: 115,
    color: "#C2C8D5",
    fraudType: "短视频引流诈骗",
    pattern: "zigzag",
    dropRate: 0.2,
  },
  /** 精英敌人：虚假字幕诈骗（v5 新增），带护盾 */
  fakeSubtitle: {
    id: "fakeSubtitle",
    name: "虚假字幕诈骗",
    emoji: "💬",
    hp: 55,
    shield: 45,
    speed: 70,
    score: 300,
    color: "#6DC8EC",
    fraudType: "虚假字幕诈骗",
    pattern: "shooter",
    shootInterval: 1.5,
    dropRate: 0.4,
    elite: true,
  },
};

export const WAVES: WaveEntry[][] = [
  // Wave 1
  [
    { typeId: "script", count: 6, interval: 0.8, delay: 0 },
    { typeId: "fakecs", count: 3, interval: 1.4, delay: 3 },
    { typeId: "dcep", count: 4, interval: 0.6, delay: 5 },
  ],
  // Wave 2
  [
    { typeId: "brushing", count: 5, interval: 0.6, delay: 0 },
    { typeId: "phishmine", count: 3, interval: 1.3, delay: 2 },
    { typeId: "fakecs", count: 4, interval: 1.0, delay: 5 },
    { typeId: "aiVoice", count: 4, interval: 0.7, delay: 7 },
  ],
  // Wave 3
  [
    { typeId: "fakecs", count: 4, interval: 0.9, delay: 0 },
    { typeId: "threat", count: 3, interval: 1.4, delay: 2 },
    { typeId: "invest", count: 3, interval: 1.2, delay: 4 },
    { typeId: "script", count: 6, interval: 0.6, delay: 6 },
    { typeId: "dcep", count: 6, interval: 0.4, delay: 8 },
  ],
  // Wave 4（随机BOSS前哨，引入精英敌人）
  [
    { typeId: "brushing", count: 8, interval: 0.5, delay: 0 },
    { typeId: "threat", count: 4, interval: 1.1, delay: 3 },
    { typeId: "deepfake", count: 2, interval: 2.0, delay: 4 },
    { typeId: "invest", count: 4, interval: 1.0, delay: 5 },
    { typeId: "phishmine", count: 4, interval: 0.9, delay: 7 },
    { typeId: "facetime", count: 4, interval: 1.0, delay: 9 },
  ],
  // Wave 5（随机BOSS战）
  [
    { typeId: "script", count: 6, interval: 0.7, delay: 0 },
    { typeId: "fakecs", count: 4, interval: 1.0, delay: 3 },
    { typeId: "expressClaim", count: 3, interval: 1.2, delay: 5 },
    { typeId: "fakeLottery", count: 2, interval: 1.8, delay: 6 },
    { typeId: "aiVoice", count: 5, interval: 0.6, delay: 7 },
  ],
  // Wave 6（终极BOSS前哨，精英云集）
  [
    { typeId: "brushing", count: 10, interval: 0.4, delay: 0 },
    { typeId: "threat", count: 5, interval: 0.9, delay: 3 },
    { typeId: "deepfake", count: 3, interval: 1.6, delay: 4 },
    { typeId: "invest", count: 5, interval: 0.8, delay: 5 },
    { typeId: "phishmine", count: 5, interval: 0.7, delay: 7 },
    { typeId: "pigboy", count: 4, interval: 1.0, delay: 9 },
    { typeId: "fakeLottery", count: 3, interval: 1.2, delay: 10 },
    { typeId: "expressClaim", count: 3, interval: 1.1, delay: 11 },
  ],
  // Wave 7（终极BOSS击败后继续，新增）
  [
    { typeId: "script", count: 8, interval: 0.5, delay: 0 },
    { typeId: "fakecs", count: 5, interval: 0.8, delay: 3 },
    { typeId: "threat", count: 4, interval: 1.0, delay: 5 },
    { typeId: "deepfake", count: 3, interval: 1.5, delay: 7 },
  ],
  // Wave 8（新增）
  [
    { typeId: "brushing", count: 10, interval: 0.4, delay: 0 },
    { typeId: "invest", count: 5, interval: 0.9, delay: 3 },
    { typeId: "expressClaim", count: 4, interval: 1.0, delay: 5 },
    { typeId: "fakeLottery", count: 3, interval: 1.4, delay: 7 },
  ],
  // Wave 9（新增）
  [
    { typeId: "aiVoice", count: 8, interval: 0.5, delay: 0 },
    { typeId: "pigboy", count: 4, interval: 1.2, delay: 3 },
    { typeId: "facetime", count: 5, interval: 0.8, delay: 5 },
    { typeId: "deepfake", count: 4, interval: 1.0, delay: 7 },
    { typeId: "fakeLottery", count: 3, interval: 1.3, delay: 9 },
  ],
  // Wave 10（BOSS 战，新增）
  [
    { typeId: "script", count: 6, interval: 0.6, delay: 0 },
    { typeId: "threat", count: 4, interval: 1.0, delay: 3 },
  ],
];

/** 随机 BOSS 池：Wave 4 结束后随机选一个 */
export const RANDOM_BOSSES: BossDef[] = [
  {
    id: "pigkiller",
    name: "杀猪盘操盘手",
    emoji: "🐷",
    hp: 800,
    color: "#FF7AB8",
    fraudType: "杀猪盘诈骗",
    patterns: ["spread", "homing", "summon"],
    speedMul: 1.2,
    summonType: "brushing",
    shape: "skull",
    identify: [
      "「稳赚不赔」是杀猪盘核心话术",
      "提现要交「解冻金」「税费」=100% 诈骗",
      "优质异性主动带投资+保密 = 杀猪盘",
    ],
    caseStory: "王女士在交友软件结识「外籍军官」，对方以「内部漏洞稳赚」诱导其向虚假平台转账 87 万元，提现时被要求缴纳「解冻金」方知受骗。",
    identifyDetail: [
      "「稳赚不赔」「内部漏洞」是杀猪盘核心话术",
      "提现要求交「解冻金」「税费」「保证金」=100% 诈骗",
      "优质异性主动加好友 + 带投资 + 要求保密 = 杀猪盘三件套",
    ],
    protectList: [
      "任何「稳收益」投资平台先在国家反诈APP核实",
      "提现要交钱的平台立即停止操作并保留证据",
      "拨打 96110 或前往辖区派出所咨询",
    ],
    targetGroup: "单身青年 / 大龄未婚 / 离异人士",
    codexId: "pig-butcher",
    entranceTitle: "PIG BUTCHER",
    entranceWarning: "「稳赚不赔」的完美男友，正在等你入圈",
  },
  {
    id: "fakecop",
    name: "冒充公检法师",
    emoji: "📜",
    hp: 900,
    color: "#E5353B",
    fraudType: "冒充公检法诈骗",
    patterns: ["beam", "spread", "summon", "laserSweep"],
    speedMul: 0.9,
    summonType: "threat",
    shape: "hex",
    identify: [
      "公检法不会电话办案，更无「安全账户」",
      "AI换脸可伪造警官形象，挂断拨打 96110",
      "要求屏幕共享、下载APP的全部是假冒",
    ],
    caseStory: "李阿姨接到「+86 区号」来电，对方自称市公安局，称其涉嫌洗钱需配合调查，通过屏幕共享转走其账户 53 万元。",
    identifyDetail: [
      "公检法不会通过电话、QQ、微信办案",
      "不存在所谓的「安全账户」，要求转账即诈骗",
      "AI 换脸可伪造警官形象，视频讯问均为假冒",
    ],
    protectList: [
      "立即挂断电话，自行拨打 110 或 96110 核实",
      "拒绝屏幕共享、拒绝下载未知 APP",
      "任何要求转账到「安全账户」的均是诈骗",
    ],
    targetGroup: "中老年人 / 退休人员 / 在校学生",
    codexId: "fake-police",
    entranceTitle: "FAKE AUTHORITY",
    entranceWarning: "「涉嫌洗钱需配合调查」—— 假警察的恐吓话术",
  },
  {
    id: "fakeservice",
    name: "冒充客服头目",
    emoji: "🎧",
    hp: 700,
    color: "#FFB020",
    fraudType: "冒充客服诈骗",
    patterns: ["spiral", "rain", "homing"],
    speedMul: 1.4,
    summonType: "fakecs",
    shape: "eye",
    identify: [
      "客服不会要求共享屏幕",
      "验证码即密码，索要验证码的全是诈骗",
      "「影响征信」是恐吓，官方渠道核实",
    ],
    caseStory: "张先生接到「+86 95XXX」来电，对方自称某电商客服，称其订单有质量问题需办理「理赔」，诱导其开启屏幕共享后转走 12 万元。",
    identifyDetail: [
      "正规客服不会要求开启屏幕共享",
      "验证码 = 密码，任何索要验证码的都是诈骗",
      "「影响征信」「自动扣费」是恐吓话术",
    ],
    protectList: [
      "挂断电话，通过官方 APP / 官网核实订单",
      "拒绝共享屏幕，拒绝下载会议类 APP",
      "验证码绝不告知任何人",
    ],
    targetGroup: "网购用户 / 宝妈 / 上班族",
    codexId: "fake-cs",
    entranceTitle: "FAKE SUPPORT",
    entranceWarning: "「您的订单有质量问题」—— 假客服的理赔陷阱",
  },
  {
    id: "falseinvest",
    name: "虚假投资操盘手",
    emoji: "📈",
    hp: 850,
    color: "#B388FF",
    fraudType: "虚假投资理财诈骗",
    patterns: ["spiral", "beam", "summon"],
    speedMul: 1.0,
    summonType: "invest",
    shape: "tower",
    identify: [
      "「内幕+稳收益+晒盈利」是虚假投资三件套",
      "「日化5%」远超正常理财，是资金盘",
      "非正规渠道入金 = 诈骗",
    ],
    caseStory: "陈先生被拉入「内部投资群」，群内每日晒盈利，他向「导师」提供的虚假平台入金 35 万元，平台随后无法登录。",
    identifyDetail: [
      "「内幕消息 + 稳定收益 + 晒盈利截图」是虚假投资三件套",
      "「日化 5%」远超正常理财，必是资金盘",
      "非正规渠道入金、提现需交钱的 = 诈骗",
    ],
    protectList: [
      "理财只在持牌金融机构官方渠道操作",
      "警惕「导师带单」「内部群」",
      "高收益必有高风险，「保本高息」是骗局",
    ],
    targetGroup: "中产白领 / 投资新手 / 退休人员",
    codexId: "fake-invest",
    entranceTitle: "FAKE INVESTMENT",
    entranceWarning: "「日化 5% 稳赚不赔」—— 资金盘的暴利话术",
  },
  /** v4 新增：AI 伪造身份集团（AI 换脸 + 语音克隆合成犯罪） */
  {
    id: "aiForge",
    name: "AI伪造身份集团",
    emoji: "🤖",
    hp: 1100,
    color: "#9D4EDD",
    fraudType: "AI伪造身份诈骗",
    patterns: ["spread", "beam", "summon", "laserSweep", "homing"],
    speedMul: 1.1,
    summonType: "deepfake",
    shape: "hex",
    identify: [
      "AI 换脸 + 语音克隆可伪造任意身份",
      "视频通话中要求转账 = 多重验证",
      "「我是你领导/亲友」+ 紧急借款 = 100% 诈骗",
    ],
    caseStory: "犯罪团伙利用 AI 换脸与语音克隆技术，伪造受害人亲友视频通话借款，单案骗走 80 余万元，受害人察觉时为时已晚。",
    identifyDetail: [
      "AI 换脸 + 语音克隆已可伪造任意身份的视频通话",
      "「我是你领导/亲友，急用钱」+ 视频通话 = 100% 诈骗",
      "视频通话中要求转账的，务必多重验证（回拨电话+当面确认）",
      " FaceTime 来电冒充客服、金融客服的，直接挂断",
      "设置家庭「暗号」，遇借款先验证身份",
    ],
    protectList: [
      "凡是视频通话要求转账的，先挂断并自行回拨核实",
      "不轻信 FaceTime 来电，关闭 FaceTime 接收陌生人来电功能",
      "设置家庭/亲友专属「暗号」用于身份验证",
      "下载国家反诈中心 APP 并开启 AI 诈骗预警",
      "遭遇诈骗立即拨打 110 报警，保留通话/聊天记录作为证据",
    ],
    targetGroup: "全人群（尤其有亲友在国外/经常视频通话者）",
    codexId: "ai-identity-forge",
    entranceTitle: "AI IDENTITY FORGE",
    entranceWarning: "「我是你儿子，急用钱」—— AI 换脸伪造视频通话借款",
  },
  // ===== v5 新增 BOSS：带多阶段变身 =====
  {
    id: "screenShareSyndicate",
    name: "共享屏幕诈骗集团",
    emoji: "📲",
    hp: 1000,
    color: "#5B8FF9",
    fraudType: "共享屏幕诈骗",
    patterns: ["spread", "rain", "summon"],
    speedMul: 1.0,
    summonType: "screenShare",
    shape: "eye",
    identify: [
      "屏幕共享 = 把钱包交给骗子",
      "客服要求共享屏幕 = 100% 诈骗",
      "共享屏幕下骗子可看到验证码并转走资金",
    ],
    caseStory: "李女士接到「电商客服」电话称订单异常需理赔，按指示下载会议 APP 并开启屏幕共享，骗子远程查看其验证码后转走 23 万元。",
    identifyDetail: [
      "屏幕共享 = 把钱包交给骗子，骗子可看到输入的密码和验证码",
      "正规客服绝不会要求开启屏幕共享、不会要求下载会议类 APP",
      "「理赔」「取消会员」「影响征信」+ 共享屏幕 = 100% 诈骗",
      "银保监会、公检法都不会通过共享屏幕办案",
    ],
    protectList: [
      "任何要求屏幕共享的来电立即挂断",
      "不下载未知会议类 APP（如非官方渠道的腾讯会议/Zoom）",
      "通过官方 APP/官网核实订单与客服",
      "遭遇诈骗立即拨打 110，并保留通话与屏幕共享记录",
    ],
    targetGroup: "网购用户 / 宝妈 / 中老年人",
    codexId: "screen-share-syndicate",
    entranceTitle: "SCREEN SHARE SYNDICATE",
    entranceWarning: "「请开启屏幕共享，我帮您操作理赔」—— 远程操控陷阱",
    phases: [
      {
        phase: 2,
        hpThreshold: 0.5,
        namePrefix: "狂暴",
        emoji: "📱",
        color: "#FF4D4F",
        extraPatterns: ["homing", "laserSweep"],
        speedMul: 1.3,
        fireMul: 0.75,
        flashColor: "#FF4D4F",
        warningText: "「远程操控已启动！」—— 共享屏幕集团狂暴化",
      },
    ],
  },
  {
    id: "crossBorderLaunder",
    name: "跨境洗钱集团",
    emoji: "💸",
    hp: 1200,
    color: "#F6BD16",
    fraudType: "跨境洗钱诈骗",
    patterns: ["spiral", "beam", "summon"],
    speedMul: 0.95,
    summonType: "fakeRecruit",
    shape: "crown",
    identify: [
      "「帮走流水赚佣金」= 帮信罪",
      "出租出借银行卡 = 违法犯罪",
      "跨境「高薪招工」实为电诈园区",
    ],
    caseStory: "犯罪团伙以「高薪招工」诱骗受害者偷渡至境外电诈园区，同时以「跑分赚佣金」诱导国内人员出租银行卡洗钱，涉案金额超亿元。",
    identifyDetail: [
      "「帮走流水」「跑分赚佣金」= 帮助信息网络犯罪活动罪，需承担刑责",
      "出租、出借、出售银行卡/电话卡 = 违法犯罪",
      "跨境「高薪招工」+ 免费机票 + 保密 = 境外电诈园区陷阱",
      "「日结千元」「轻松赚钱」的兼职全是诈骗",
    ],
    protectList: [
      "不出租、出借、出售个人银行卡、电话卡、支付宝/微信账号",
      "警惕「高薪招工」+「免费出国」+「保密」组合话术",
      "发现可疑招工信息向 12321 举报",
      "遭遇招工诈骗立即拨打 110 报警",
    ],
    targetGroup: "求职青年 / 在校学生 / 待业人员",
    codexId: "cross-border-launder",
    entranceTitle: "CROSS-BORDER LAUNDER",
    entranceWarning: "「高薪招工，免费出国」—— 跨境洗钱集团的陷阱",
    phases: [
      {
        phase: 2,
        hpThreshold: 0.6,
        namePrefix: "觉醒",
        emoji: "💰",
        color: "#FF7A1A",
        extraPatterns: ["rain", "homing"],
        speedMul: 1.15,
        fireMul: 0.85,
        flashColor: "#FF7A1A",
        warningText: "「资金链加速运转！」—— 洗钱集团觉醒形态",
      },
      {
        phase: 3,
        hpThreshold: 0.25,
        namePrefix: "终极",
        emoji: "👑",
        color: "#FF00E5",
        extraPatterns: ["laserSweep", "spiral"],
        speedMul: 1.4,
        fireMul: 0.6,
        flashColor: "#FF00E5",
        warningText: "「境外园区全面启动！」—— 洗钱集团终极形态",
      },
    ],
  },
];

/** 终极 BOSS：Wave 6 结束后固定出现 */
export const ULTIMATE_BOSS: BossDef = {
  id: "kingpin",
  name: "跨境电诈集团首脑",
  emoji: "🕴",
  hp: 1600,
  color: "#FF00E5",
  fraudType: "跨境电信诈骗集团",
  patterns: ["spiral", "rain", "beam", "homing", "summon", "laserSweep"],
  speedMul: 1.1,
  summonType: "threat",
  shape: "crown",
  ultimate: true,
  identify: [
    "真警察绝不会电话要求转账到「安全账户」",
    "公检法不会通过 QQ/微信发送「逮捕令」",
    "要求视频讯问、屏幕共享的都是假冒",
    "凡是要验证码、密码的全部是诈骗",
    "96110 是全国反诈专线，来电务必接听",
  ],
  caseStory: "跨境电诈集团通过精准信息实施「杀猪盘 + 冒充公检法 + 虚假投资」复合诈骗，单案涉案金额超千万元，受害人遍布全国。",
  identifyDetail: [
    "真警察绝不会电话要求转账到「安全账户」",
    "公检法不会通过 QQ/微信发送「逮捕令」「通缉令」",
    "要求视频讯问、屏幕共享的都是假冒",
    "凡是要验证码、密码、短信的全部是诈骗",
    "96110 是全国反诈专线，来电务必接听",
  ],
  protectList: [
    "下载国家反诈中心 APP 并开启预警",
    "96110 来电必须接听，可能是劝阻电话",
    "不轻信陌生来电，不点击未知链接",
    "个人信息、验证码、密码绝不外泄",
    "遭遇诈骗立即拨打 110 报警并保留证据",
  ],
  targetGroup: "全人群（高发于 18-60 岁）",
  codexId: "cross-border-syndicate",
  entranceTitle: "THE KINGPIN",
  entranceWarning: "跨境电诈集团首脑登场 — 全民反诈，终极对决",
};

/** 兼容旧引用 */
export const BOSS = ULTIMATE_BOSS;

/** 随机选取一个非终极 BOSS */
export function pickRandomBoss(rng: () => number = Math.random): BossDef {
  return RANDOM_BOSSES[Math.floor(rng() * RANDOM_BOSSES.length)];
}

/** 反诈道具（强力工具效果） */
export const POWERUPS: Record<PowerupKind, PowerupDef> = {
  weapon: { kind: "weapon", emoji: "⚡", color: "#FFD666", label: "火力升级", desc: "火力 +1（最高 4 级）" },
  antifraudApp: { kind: "antifraudApp", emoji: "🛡", color: "#00E5FF", label: "国家反诈APP", desc: "盾牌护盾，可吸收 3 次伤害" },
  blockOverseas: { kind: "blockOverseas", emoji: "📵", color: "#3B7FEF", label: "不接境外来电", desc: "5 秒内免疫所有敌方弹幕" },
  policeRaid: { kind: "policeRaid", emoji: "🚔", color: "#FF7A1A", label: "公安反诈突击", desc: "全屏清场 + 重创所有敌方" },
  smsFirewall: { kind: "smsFirewall", emoji: "🧱", color: "#52C41A", label: "短信防火墙", desc: "摧毁敌方子弹并反击伤害" },
  evidenceLock: { kind: "evidenceLock", emoji: "📸", color: "#B388FF", label: "证据固定", desc: "冻结全场敌方 3 秒" },
  fraudAwareness: { kind: "fraudAwareness", emoji: "🧠", color: "#FF5A60", label: "反诈意识觉醒", desc: "6 秒火力顶档 + 双倍伤害" },
  lifePack: { kind: "lifePack", emoji: "❤", color: "#E5353B", label: "生命补给", desc: "回复 8 点生命值" },
  phish: { kind: "phish", emoji: "🎣", color: "#1AD670", label: "钓鱼链接", desc: "陷阱！武器降级", trap: true },
  hotline96110: { kind: "hotline96110", emoji: "📞", color: "#00E5FF", label: "96110反诈热线", desc: "3 秒全屏净化弹幕+锁定最强敌人" },
  bankFreeze: { kind: "bankFreeze", emoji: "🏦", color: "#FFD666", label: "银行紧急止付", desc: "5 秒敌方伤害减半+持续扣血" },
  awarenessAd: { kind: "awarenessAd", emoji: "📢", color: "#52C41A", label: "反诈宣传员", desc: "8 秒连击不掉+自动拾取道具" },
  timeSlow: { kind: "timeSlow", emoji: "⏱", color: "#9D4EDD", label: "时间减速", desc: "3 秒内敌方/弹幕全部减速 70%" },
  // ===== v5 新增道具 =====
  droneDeploy: { kind: "droneDeploy", emoji: "🛸", color: "#00E5FF", label: "无人机伴随", desc: "召唤一架伴随无人机协助作战 15 秒" },
  shieldBurst: { kind: "shieldBurst", emoji: "💥", color: "#FFD666", label: "护盾爆发", desc: "清除全屏敌方子弹 + 获得 2 层反诈APP护盾" },
};

/** 武器经验系统（新增）：每级所需 XP 与伤害加成 */
export const WEAPON_XP_TABLE: Record<WeaponLevel, { xpMax: number; dmgBonus: number }> = {
  1: { xpMax: 30, dmgBonus: 0 },
  2: { xpMax: 60, dmgBonus: 4 },
  3: { xpMax: 100, dmgBonus: 8 },
  4: { xpMax: 0, dmgBonus: 14 }, // 已满级
};

/** 武器分支定义（新增）：3 条升级路线
 * - spread 散射：3 向散射，覆盖广，单发伤害低
 * - laser 激光：穿透光束，高伤害，覆盖窄
 * - homing 追踪：追踪导弹，中伤害，自动锁敌
 * 每个分支可升级 3 级
 */
export const WEAPON_BRANCHES: Record<Exclude<WeaponBranch, "normal">, WeaponBranchDef> = {
  spread: {
    id: "spread",
    name: "散射",
    emoji: "🔱",
    color: "#FFB020",
    desc: "3 向散射，覆盖广，单发伤害低",
  },
  laser: {
    id: "laser",
    name: "激光",
    emoji: "🔦",
    color: "#FF00E5",
    desc: "穿透光束，高伤害，覆盖窄",
  },
  homing: {
    id: "homing",
    name: "追踪",
    emoji: "🎯",
    color: "#52C41A",
    desc: "追踪导弹，中伤害，自动锁敌",
  },
};

/** 击杀获得武器经验值（按敌人 score 比例） */
export function weaponXpForKill(enemyScore: number): number {
  return Math.max(1, Math.round(enemyScore / 30));
}

/** 成就定义（新增）：里程碑触发 */
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  /** 触发条件：函数判断 */
  check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  bustedCount: number;
  maxCombo: number;
  bossesDefeated: number;
  wave: number;
  hp: number;
  maxHp: number;
  score: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_blood", name: "首战告捷", desc: "击破首个诈骗分子", emoji: "🩸", check: (s) => s.bustedCount >= 1 },
  { id: "combo_10", name: "连击高手", desc: "达成 10 连击", emoji: "🔥", check: (s) => s.maxCombo >= 10 },
  { id: "combo_25", name: "连击大师", desc: "达成 25 连击", emoji: "⚡", check: (s) => s.maxCombo >= 25 },
  { id: "kill_50", name: "反诈先锋", desc: "识破 50 名诈骗分子", emoji: "🛡", check: (s) => s.bustedCount >= 50 },
  { id: "kill_100", name: "反诈精英", desc: "识破 100 名诈骗分子", emoji: "🎯", check: (s) => s.bustedCount >= 100 },
  { id: "boss_slayer", name: "BOSS终结者", desc: "击败一个 BOSS", emoji: "👑", check: (s) => s.bossesDefeated >= 1 },
  { id: "flawless_wave", name: "无伤通关", desc: "满血通过一波", emoji: "💎", check: (s) => s.wave >= 2 && s.hp >= s.maxHp },
  { id: "score_10k", name: "万分达人", desc: "单局获得 10000 分", emoji: "💰", check: (s) => s.score >= 10000 },
];

// ===========================================================================
// ===== v2 全面升级数据 ====================================================
// ===========================================================================

/** 难度配置表（A2 难度系统） */
export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  normal: {
    id: "normal",
    name: "普通",
    desc: "标准难度，适合新手熟悉反诈套路",
    color: "#52C41A",
    enemyHpMul: 1.0,
    enemySpeedMul: 1.0,
    enemyFireMul: 1.0,
    dropMul: 1.0,
    bossHpMul: 1.0,
    playerHpMul: 1.0,
    scoreMul: 1.0,
    ultChargeMul: 1.0,
  },
  hard: {
    id: "hard",
    name: "困难",
    desc: "敌人更强、掉落更少，适合反诈老兵",
    color: "#FFB020",
    enemyHpMul: 1.4,
    enemySpeedMul: 1.15,
    enemyFireMul: 0.8,
    dropMul: 0.85,
    bossHpMul: 1.3,
    playerHpMul: 0.89, // 32 HP
    scoreMul: 1.5,
    ultChargeMul: 0.9,
  },
  nightmare: {
    id: "nightmare",
    name: "噩梦",
    desc: "电诈集团全火力，仅推荐反诈精英挑战",
    color: "#FF00E5",
    enemyHpMul: 1.85,
    enemySpeedMul: 1.3,
    enemyFireMul: 0.65,
    dropMul: 0.7,
    bossHpMul: 1.7,
    playerHpMul: 0.78, // 28 HP
    scoreMul: 2.2,
    ultChargeMul: 0.8,
  },
};

/** 难度列表（顺序） */
export const DIFFICULTY_LIST: DifficultyConfig[] = [
  DIFFICULTIES.normal,
  DIFFICULTIES.hard,
  DIFFICULTIES.nightmare,
];

/** 关卡主题配置（C3 关卡主题切换） */
export const THUNDER_THEMES: ThunderThemeDef[] = [
  {
    id: "city",
    name: "城市夜空",
    desc: "都市反诈第一线",
    bgColor: "#070E1F",
    gridColor: "rgba(0,229,255,0.05)",
    nebulaColors: ["157,78,221", "0,229,255", "59,127,239"],
    startWave: 1,
    emoji: "🌃",
  },
  {
    id: "border",
    name: "边境口岸",
    desc: "拦截跨境电诈",
    bgColor: "#0E1A0E",
    gridColor: "rgba(82,196,26,0.06)",
    nebulaColors: ["82,196,26", "255,176,32", "60,180,75"],
    startWave: 3,
    emoji: "🛡",
  },
  {
    id: "cyber",
    name: "网络空间",
    desc: "追击 AI 换脸伪警",
    bgColor: "#1A0820",
    gridColor: "rgba(255,0,229,0.06)",
    nebulaColors: ["255,0,229", "157,78,221", "255,90,96"],
    startWave: 5,
    emoji: "🌐",
  },
  {
    id: "overseas",
    name: "境外园区",
    desc: "直捣电诈集团总部",
    bgColor: "#1F0A0A",
    gridColor: "rgba(229,53,59,0.07)",
    nebulaColors: ["229,53,59", "255,122,26", "255,0,229"],
    startWave: 7,
    emoji: "🏢",
  },
];

/** 根据波次获取主题 */
export function themeForWave(waveIdx: number): ThunderThemeDef {
  // waveIdx 是 0-based
  let theme = THUNDER_THEMES[0];
  for (const t of THUNDER_THEMES) {
    if (waveIdx + 1 >= t.startWave) theme = t;
  }
  return theme;
}

/** Roguelike Buff 定义表（A3） */
export const ROGUELIKE_BUFFS: Record<RoguelikeBuffKind, RoguelikeBuffDef> = {
  critUp:       { kind: "critUp",       name: "识破之眼",   emoji: "🎯", color: "#FF00E5", desc: "暴击率 +15%（暴击 2 倍伤害）",            rarity: "rare",  stackable: true,  maxStack: 3 },
  pierceUp:     { kind: "pierceUp",     name: "穿透弹头",   emoji: "➡",  color: "#00E5FF", desc: "子弹穿透 +1 个敌人",                      rarity: "rare",  stackable: true,  maxStack: 2 },
  lifesteal:    { kind: "lifesteal",    name: "反诈回血",   emoji: "❤",  color: "#E5353B", desc: "吸血 8%（每次命中回 1 HP）",              rarity: "epic",  stackable: true,  maxStack: 3 },
  chainLight:   { kind: "chainLight",   name: "连锁识破",   emoji: "⚡",  color: "#FFD666", desc: "命中后跳到附近敌人（最多 2 跳）",        rarity: "epic",  stackable: true,  maxStack: 2 },
  multiShot:    { kind: "multiShot",    name: "多发齐射",   emoji: "🔱",  color: "#FFB020", desc: "同时多发 +1 颗子弹",                      rarity: "common",stackable: true,  maxStack: 3 },
  damageUp:     { kind: "damageUp",     name: "火力强化",   emoji: "💥",  color: "#FF7A1A", desc: "伤害 +20%",                               rarity: "common",stackable: true,  maxStack: 4 },
  fireRateUp:   { kind: "fireRateUp",   name: "射速提升",   emoji: "🔄",  color: "#3B7FEF", desc: "射速 +20%",                               rarity: "common",stackable: true,  maxStack: 3 },
  moveSpeedUp:  { kind: "moveSpeedUp",  name: "机动强化",   emoji: "👟",  color: "#52C41A", desc: "移速 +15%",                               rarity: "common",stackable: true,  maxStack: 3 },
  shieldRegen:  { kind: "shieldRegen",  name: "护盾再生",   emoji: "🛡",  color: "#00E5FF", desc: "反诈APP护盾每 10 秒恢复 1 层",            rarity: "rare",  stackable: true,  maxStack: 2 },
  scoreBoost:   { kind: "scoreBoost",   name: "积分加成",   emoji: "💰",  color: "#FFD666", desc: "分数 +25%",                               rarity: "common",stackable: true,  maxStack: 3 },
  ultBoost:     { kind: "ultBoost",     name: "审判充能",   emoji: "⚖",  color: "#FF00E5", desc: "大招充能速度 +30%",                       rarity: "rare",  stackable: true,  maxStack: 2 },
  thorns:       { kind: "thorns",       name: "反伤护甲",   emoji: "🌵",  color: "#52C41A", desc: "受击时反伤 30%",                          rarity: "rare",  stackable: true,  maxStack: 3 },
  dropBoost:    { kind: "dropBoost",    name: "战利品+ ",   emoji: "🎁",  color: "#B388FF", desc: "道具掉落率 +30%",                         rarity: "common",stackable: true,  maxStack: 2 },
  healOnBoss:   { kind: "healOnBoss",   name: "BOSS战回血", emoji: "✨",  color: "#1AD670", desc: "BOSS 战中每秒回 1 HP",                    rarity: "epic",  stackable: false },
  comboShield:  { kind: "comboShield",  name: "连击守护",   emoji: "🔗",  color: "#FF7AB8", desc: "连击不会因受击而中断",                    rarity: "rare",  stackable: false },
};

/** 按 rarity 分组的 buff 池（用于随机抽取） */
export const ROGUELIKE_POOL_BY_RARITY: Record<RoguelikeBuffDef["rarity"], RoguelikeBuffKind[]> = {
  common: ["multiShot", "damageUp", "fireRateUp", "moveSpeedUp", "scoreBoost", "dropBoost"],
  rare:  ["critUp", "pierceUp", "shieldRegen", "ultBoost", "thorns", "comboShield"],
  epic:  ["lifesteal", "chainLight", "healOnBoss"],
};

/** Roguelike 抽取权重（common 60%, rare 30%, epic 10%） */
export const ROGUELIKE_RARITY_WEIGHTS: Record<RoguelikeBuffDef["rarity"], number> = {
  common: 0.6,
  rare: 0.3,
  epic: 0.1,
};

/** 大招配置（A5 雷霆审判） */
export const ULTIMATE_MAX_CHARGE = 100;
export const ULTIMATE_DURATION = 4;          // 持续 4 秒
export const ULTIMATE_DPS = 80;              // 每秒伤害
export const ULTIMATE_CHARGE_PER_DAMAGE = 0.4; // 玩家每点伤害产生 0.4 充能

/** 蓄力射击配置（A4） */
export const CHARGE_FULL_TIME = 1.2;         // 蓄满需 1.2 秒
export const CHARGE_MIN_TIME = 0.3;          // 最小蓄力时间
export const CHARGE_DMG_MULTIPLIER = 3.0;    // 蓄满伤害倍率
export const CHARGE_RADIUS = 80;             // 蓄满爆炸半径

/** 闪避冲刺配置（A4） */
export const DASH_DISTANCE = 180;            // 冲刺距离（像素）
export const DASH_DURATION = 0.2;            // 冲刺持续秒数
export const DASH_CD = 1.5;                  // 冷却秒数
export const DASH_INVINCIBLE = 0.3;          // 无敌秒数

/** 本地存档键（D1，v5 升级 key） */
export const THUNDER_SAVE_KEY = "thunder_save_v5";
/** 旧版存档 key（用于 v4 → v5 迁移读取） */
export const THUNDER_SAVE_KEY_V4 = "thunder_save_v4";

/** 默认存档 */
export function defaultThunderSave(): import("./types").ThunderSaveData {
  return {
    bestScore: 0,
    bestCombo: 0,
    bestEndlessWave: 0,
    defeatedBosses: [],
    totalBossKills: 0,
    totalBusted: 0,
    totalPlayTime: 0,
    unlockedBranches: [],
    // v3 升级
    unlockedCharacters: ["swat"],
    equippedCharacter: "swat",
    ownedEquipments: [],
    equippedEquipments: {},
    awakenedBranches: [],
    characterUsage: {},
    fraudKills: {},
    // v4 升级：天赋树 / 套装 / BossRush / 排行榜 / 影子
    talentPoints: 0,
    characterTalents: {},
    bossRushBest: {},
    leaderboard: { daily: {}, weekly: {}, allTime: [] },
    ghostRecords: [],
    totalTalentPointsEarned: 0,
    // v5 升级：擦弹 / 赛季 / 任务 / 皮肤 / 案例 / 周常
    totalGrazeCount: 0,
    currentSeasonId: THUNDER_CURRENT_SEASON.id,
    rankPoints: 0,
    rankTier: "bronze",
    seasonBestPoints: 0,
    peakRankTier: "bronze",
    seasonHistory: {},
    dailyQuests: {},
    unlockedSkins: ["default"],
    equippedSkin: "default",
    weeklyBestScore: 0,
    weeklyPlayCount: 0,
    watchedCaseTheater: [],
    bestSurvivalWave: 0,
    bestChallengeScore: 0,
    totalSkinsEarned: 0,
    // ===== v6 升级新增字段 =====
    unlockedFraudArchives: [],
    seasonPass: { level: 1, exp: 0, elite: false, claimedFreeTiers: [], claimedEliteTiers: [] },
    superAwakenedBranches: [],
    totalParryCount: 0,
    totalMantraTriggered: 0,
    totalAIDialogBusted: 0,
    seasonPassLevel: 1,
    seasonPassExp: 0,
    seasonPassElite: false,
    // ===== v7 升级新增字段 =====
    storyClearedStages: [],
    storyUnlockedEndings: [],
    storyCurrentChapter: 0,
    lessonClearedChapters: [],
    lessonBestScores: {},
    rpgClearedScenarios: [],
    rpgUnlockedEndings: [],
    knowledgeMastery: {},
    adaptiveProfileVersion: 0,
    adaptiveSkillScore: 50,
    adaptiveRecentRuns: [],
    unlockedCertificates: [],
    certificateProgress: {},
    totalRPGCleared: 0,
    totalLessonsCleared: 0,
    totalKnowledgeNodesUnlocked: 0,
  };
}

/**
 * v6 → v7 存档迁移：读取旧存档，补全 v7 字段
 * - 不修改 v6 字段
 * - v7 字段全部使用默认值（玩家历史进度不丢失，v7 内容为新增功能）
 */
export function migrateV6ToV7(v6: Partial<import("./types").ThunderSaveData>): import("./types").ThunderSaveData {
  const def = defaultThunderSave();
  return {
    ...def,
    ...v6,
    // v7 嵌套对象兜底（旧存档无 v7 字段，使用默认空值）
    storyClearedStages: Array.isArray(v6.storyClearedStages) ? v6.storyClearedStages : [],
    storyUnlockedEndings: Array.isArray(v6.storyUnlockedEndings) ? v6.storyUnlockedEndings : [],
    storyCurrentChapter: typeof v6.storyCurrentChapter === "number" ? v6.storyCurrentChapter : 0,
    lessonClearedChapters: Array.isArray(v6.lessonClearedChapters) ? v6.lessonClearedChapters : [],
    lessonBestScores: v6.lessonBestScores ?? {},
    rpgClearedScenarios: Array.isArray(v6.rpgClearedScenarios) ? v6.rpgClearedScenarios : [],
    rpgUnlockedEndings: Array.isArray(v6.rpgUnlockedEndings) ? v6.rpgUnlockedEndings : [],
    knowledgeMastery: v6.knowledgeMastery ?? {},
    adaptiveProfileVersion: typeof v6.adaptiveProfileVersion === "number" ? v6.adaptiveProfileVersion : 0,
    adaptiveSkillScore: typeof v6.adaptiveSkillScore === "number" ? v6.adaptiveSkillScore : 50,
    adaptiveRecentRuns: Array.isArray(v6.adaptiveRecentRuns) ? v6.adaptiveRecentRuns : [],
    unlockedCertificates: Array.isArray(v6.unlockedCertificates) ? v6.unlockedCertificates : [],
    certificateProgress: v6.certificateProgress ?? {},
    totalRPGCleared: typeof v6.totalRPGCleared === "number" ? v6.totalRPGCleared : 0,
    totalLessonsCleared: typeof v6.totalLessonsCleared === "number" ? v6.totalLessonsCleared : 0,
    totalKnowledgeNodesUnlocked: typeof v6.totalKnowledgeNodesUnlocked === "number" ? v6.totalKnowledgeNodesUnlocked : 0,
  } as import("./types").ThunderSaveData;
}

/**
 * v4 → v5 存档迁移：读取旧 v4 存档，补全 v5 字段
 */
export function migrateV4ToV5(v4: Partial<import("./types").ThunderSaveData>): import("./types").ThunderSaveData {
  const def = defaultThunderSave();
  return {
    ...def,
    ...v4,
    // v4 嵌套对象兜底
    characterTalents: v4.characterTalents ?? def.characterTalents,
    bossRushBest: v4.bossRushBest ?? def.bossRushBest,
    leaderboard: v4.leaderboard ?? def.leaderboard,
    ghostRecords: Array.isArray(v4.ghostRecords) ? v4.ghostRecords : [],
    talentPoints: typeof v4.talentPoints === "number" ? v4.talentPoints : 0,
    totalTalentPointsEarned: typeof v4.totalTalentPointsEarned === "number" ? v4.totalTalentPointsEarned : 0,
    // v3 字段兜底
    unlockedCharacters: Array.isArray(v4.unlockedCharacters) && v4.unlockedCharacters.length > 0 ? v4.unlockedCharacters : def.unlockedCharacters,
    equippedCharacter: v4.equippedCharacter ?? def.equippedCharacter,
    ownedEquipments: Array.isArray(v4.ownedEquipments) ? v4.ownedEquipments : [],
    equippedEquipments: v4.equippedEquipments ?? {},
    awakenedBranches: Array.isArray(v4.awakenedBranches) ? v4.awakenedBranches : [],
    characterUsage: v4.characterUsage ?? {},
    fraudKills: v4.fraudKills ?? {},
    // v5 新字段（旧存档一律使用默认值）
    totalGrazeCount: 0,
    currentSeasonId: def.currentSeasonId,
    rankPoints: 0,
    rankTier: "bronze",
    seasonBestPoints: 0,
    peakRankTier: "bronze",
    seasonHistory: {},
    dailyQuests: {},
    unlockedSkins: ["default"],
    equippedSkin: "default",
    weeklyBestScore: 0,
    weeklyPlayCount: 0,
    watchedCaseTheater: [],
    bestSurvivalWave: 0,
    bestChallengeScore: 0,
    totalSkinsEarned: 0,
    // v6 新字段（旧存档一律使用默认值）
    unlockedFraudArchives: [],
    seasonPass: { level: 1, exp: 0, elite: false, claimedFreeTiers: [], claimedEliteTiers: [] },
    superAwakenedBranches: [],
    totalParryCount: 0,
    totalMantraTriggered: 0,
    totalAIDialogBusted: 0,
    seasonPassLevel: 1,
    seasonPassExp: 0,
    seasonPassElite: false,
  } as import("./types").ThunderSaveData;
}

/**
 * 读取存档快照（v3 新增）：用于引擎创建前的 UI 展示（角色解锁状态、已装备配件等）
 * v5 升级：自动迁移 v4 存档 → v5，并合并字段
 */
export function loadThunderSaveSnapshot(): import("./types").ThunderSaveData {
  try {
    if (typeof localStorage === "undefined") return defaultThunderSave();
    // 优先读 v5 存档
    const rawV5 = localStorage.getItem(THUNDER_SAVE_KEY);
    if (rawV5) {
      const parsed = JSON.parse(rawV5) as Partial<import("./types").ThunderSaveData>;
      const def = defaultThunderSave();
      return {
        ...def,
        ...parsed,
        // v5 嵌套对象兜底
        seasonHistory: parsed.seasonHistory ?? def.seasonHistory,
        dailyQuests: parsed.dailyQuests ?? def.dailyQuests,
        unlockedSkins: Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length > 0 ? parsed.unlockedSkins : def.unlockedSkins,
        watchedCaseTheater: Array.isArray(parsed.watchedCaseTheater) ? parsed.watchedCaseTheater : [],
        // v4 嵌套对象兜底
        characterTalents: parsed.characterTalents ?? def.characterTalents,
        bossRushBest: parsed.bossRushBest ?? def.bossRushBest,
        leaderboard: parsed.leaderboard ?? def.leaderboard,
        ghostRecords: Array.isArray(parsed.ghostRecords) ? parsed.ghostRecords : [],
        talentPoints: typeof parsed.talentPoints === "number" ? parsed.talentPoints : 0,
        totalTalentPointsEarned: typeof parsed.totalTalentPointsEarned === "number" ? parsed.totalTalentPointsEarned : 0,
        // v3 字段兜底
        unlockedCharacters: Array.isArray(parsed.unlockedCharacters) && parsed.unlockedCharacters.length > 0 ? parsed.unlockedCharacters : def.unlockedCharacters,
        equippedCharacter: parsed.equippedCharacter ?? def.equippedCharacter,
        ownedEquipments: Array.isArray(parsed.ownedEquipments) ? parsed.ownedEquipments : [],
        equippedEquipments: parsed.equippedEquipments ?? {},
        awakenedBranches: Array.isArray(parsed.awakenedBranches) ? parsed.awakenedBranches : [],
        characterUsage: parsed.characterUsage ?? {},
        fraudKills: parsed.fraudKills ?? {},
        // v5 标量兜底
        totalGrazeCount: typeof parsed.totalGrazeCount === "number" ? parsed.totalGrazeCount : 0,
        currentSeasonId: parsed.currentSeasonId ?? def.currentSeasonId,
        rankPoints: typeof parsed.rankPoints === "number" ? parsed.rankPoints : 0,
        rankTier: parsed.rankTier ?? "bronze",
        seasonBestPoints: typeof parsed.seasonBestPoints === "number" ? parsed.seasonBestPoints : 0,
        peakRankTier: parsed.peakRankTier ?? "bronze",
        equippedSkin: parsed.equippedSkin ?? "default",
        weeklyBestScore: typeof parsed.weeklyBestScore === "number" ? parsed.weeklyBestScore : 0,
        weeklyPlayCount: typeof parsed.weeklyPlayCount === "number" ? parsed.weeklyPlayCount : 0,
        bestSurvivalWave: typeof parsed.bestSurvivalWave === "number" ? parsed.bestSurvivalWave : 0,
        bestChallengeScore: typeof parsed.bestChallengeScore === "number" ? parsed.bestChallengeScore : 0,
        totalSkinsEarned: typeof parsed.totalSkinsEarned === "number" ? parsed.totalSkinsEarned : 0,
        // v6 字段兜底
        unlockedFraudArchives: Array.isArray(parsed.unlockedFraudArchives) ? parsed.unlockedFraudArchives : [],
        seasonPass: parsed.seasonPass ?? def.seasonPass,
        superAwakenedBranches: Array.isArray(parsed.superAwakenedBranches) ? parsed.superAwakenedBranches : [],
        totalParryCount: typeof parsed.totalParryCount === "number" ? parsed.totalParryCount : 0,
        totalMantraTriggered: typeof parsed.totalMantraTriggered === "number" ? parsed.totalMantraTriggered : 0,
        totalAIDialogBusted: typeof parsed.totalAIDialogBusted === "number" ? parsed.totalAIDialogBusted : 0,
        seasonPassLevel: typeof parsed.seasonPassLevel === "number" ? parsed.seasonPassLevel : 1,
        seasonPassExp: typeof parsed.seasonPassExp === "number" ? parsed.seasonPassExp : 0,
        seasonPassElite: typeof parsed.seasonPassElite === "boolean" ? parsed.seasonPassElite : false,
        // ===== v7 字段兜底（旧 v5/v6 存档无 v7 字段，使用默认值） =====
        storyClearedStages: Array.isArray(parsed.storyClearedStages) ? parsed.storyClearedStages : [],
        storyUnlockedEndings: Array.isArray(parsed.storyUnlockedEndings) ? parsed.storyUnlockedEndings : [],
        storyCurrentChapter: typeof parsed.storyCurrentChapter === "number" ? parsed.storyCurrentChapter : 0,
        lessonClearedChapters: Array.isArray(parsed.lessonClearedChapters) ? parsed.lessonClearedChapters : [],
        lessonBestScores: parsed.lessonBestScores ?? {},
        rpgClearedScenarios: Array.isArray(parsed.rpgClearedScenarios) ? parsed.rpgClearedScenarios : [],
        rpgUnlockedEndings: Array.isArray(parsed.rpgUnlockedEndings) ? parsed.rpgUnlockedEndings : [],
        knowledgeMastery: parsed.knowledgeMastery ?? {},
        adaptiveProfileVersion: typeof parsed.adaptiveProfileVersion === "number" ? parsed.adaptiveProfileVersion : 0,
        adaptiveSkillScore: typeof parsed.adaptiveSkillScore === "number" ? parsed.adaptiveSkillScore : 50,
        adaptiveRecentRuns: Array.isArray(parsed.adaptiveRecentRuns) ? parsed.adaptiveRecentRuns : [],
        unlockedCertificates: Array.isArray(parsed.unlockedCertificates) ? parsed.unlockedCertificates : [],
        certificateProgress: parsed.certificateProgress ?? {},
        totalRPGCleared: typeof parsed.totalRPGCleared === "number" ? parsed.totalRPGCleared : 0,
        totalLessonsCleared: typeof parsed.totalLessonsCleared === "number" ? parsed.totalLessonsCleared : 0,
        totalKnowledgeNodesUnlocked: typeof parsed.totalKnowledgeNodesUnlocked === "number" ? parsed.totalKnowledgeNodesUnlocked : 0,
      } as import("./types").ThunderSaveData;
    }
    // v5 不存在，尝试迁移 v4 存档
    const rawV4 = localStorage.getItem(THUNDER_SAVE_KEY_V4);
    if (rawV4) {
      const v4Parsed = JSON.parse(rawV4) as Partial<import("./types").ThunderSaveData>;
      const migrated = migrateV4ToV5(v4Parsed);
      // 写入 v5 key（不删除 v4，保留备份）
      localStorage.setItem(THUNDER_SAVE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch { /* ignore */ }
  return defaultThunderSave();
}

/**
 * 持久化角色/装备选择到存档（v3 新增）
 * 在引擎创建前调用，引擎构造时会读取到最新的 equippedCharacter/equippedEquipments
 */
export function persistThunderEquipSelection(patch: {
  equippedCharacter?: import("./types").CharacterId;
  equippedEquipments?: { weaponChip?: string; shieldCore?: string; moveModule?: string };
}): void {
  try {
    if (typeof localStorage === "undefined") return;
    const save = loadThunderSaveSnapshot();
    if (patch.equippedCharacter) save.equippedCharacter = patch.equippedCharacter;
    if (patch.equippedEquipments) save.equippedEquipments = { ...save.equippedEquipments, ...patch.equippedEquipments };
    localStorage.setItem(THUNDER_SAVE_KEY, JSON.stringify(save));
  } catch { /* ignore */ }
}

/**
 * v4：持久化完整雷霆存档（天赋解锁 / 排行榜等写回 localStorage）
 */
export function persistThunderSave(save: import("./types").ThunderSaveData): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THUNDER_SAVE_KEY, JSON.stringify(save));
    }
  } catch { /* ignore */ }
}

/** 每日种子生成（D3 每日挑战） */
export function dailySeedFor(date: Date): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  // 简单哈希
  return (y * 10000 + m * 100 + d) % 2147483647;
}

/** 基于种子的伪随机数生成器（Mulberry32） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 无尽模式动态波次生成（A1） */
export function generateEndlessWave(waveIdx: number, rng: () => number): WaveEntry[] {
  // waveIdx 是 0-based，从第 11 波（idx=10）开始
  const scale = 1 + (waveIdx - 9) * 0.12;
  const allTypes = Object.keys(ENEMIES);
  const entries: WaveEntry[] = [];
  const groupCount = 3 + Math.floor((waveIdx - 10) / 3);
  for (let g = 0; g < Math.min(groupCount, 5); g++) {
    const typeId = allTypes[Math.floor(rng() * allTypes.length)];
    const def = ENEMIES[typeId];
    if (!def) continue;
    const count = Math.max(3, Math.floor(4 * scale + rng() * 4));
    entries.push({
      typeId,
      count,
      interval: Math.max(0.3, 0.8 - (waveIdx - 10) * 0.02),
      delay: g * 2,
    });
  }
  return entries;
}

/** 反诈口诀库（B3 连击高潮飘字） */
export const ANTIFRAUD_MANTRAS: string[] = [
  "96110 来电务必接听",
  "验证码 = 密码",
  "公检法无「安全账户」",
  "稳赚不赔 = 诈骗",
  "提现要交钱 = 诈骗",
  "屏幕共享 = 诈骗",
  "AI 换脸可伪造",
  "天上不会掉馅饼",
  "刷单返利 = 诈骗",
  "高息保本 = 资金盘",
  "客服主动理赔 = 诈骗",
  "陌生人发的链接不点",
];

/** 死亡原因候选文案（B2 死亡复盘，根据击杀玩家的来源） */
export const DEATH_CAUSE_BY_ENEMY: Record<string, { fraudType: string; identifyDetail: string[]; protectList: string[]; caseStory: string }> = {
  script: {
    fraudType: "杀猪盘诈骗",
    identifyDetail: ["「稳赚不赔」「内部漏洞」是核心话术", "提现要交钱 = 100% 诈骗"],
    protectList: ["任何「稳收益」平台先在反诈APP核实", "拨打 96110 咨询"],
    caseStory: "受害人被「稳赚不赔」话术诱导，向虚假平台转账后无法提现。",
  },
  fakecs: {
    fraudType: "冒充客服诈骗",
    identifyDetail: ["正规客服不会要求屏幕共享", "验证码绝不外泄"],
    protectList: ["挂断后通过官方APP核实", "拒绝下载会议类APP"],
    caseStory: "受害人被「订单异常理赔」诱导开启屏幕共享，账户资金被转走。",
  },
  threat: {
    fraudType: "冒充公检法诈骗",
    identifyDetail: ["公检法不电话办案", "无「安全账户」"],
    protectList: ["挂断后自行拨打 110", "拒绝屏幕共享"],
    caseStory: "受害人被「涉嫌洗钱」恐吓，按指示转账到「安全账户」后失联。",
  },
  phishmine: {
    fraudType: "钓鱼网站诈骗",
    identifyDetail: ["陌生链接不点", "认准官方域名"],
    protectList: ["核实网址是否为官方", "输入密码前确认安全证书"],
    caseStory: "受害人点击短信中的「ETC 失效」链接，输入银行卡信息后资金被盗。",
  },
  brushing: {
    fraudType: "刷单返利诈骗",
    identifyDetail: ["刷单本身违法", "「垫付返利」= 诈骗"],
    protectList: ["拒绝任何刷单兼职", "小额返利是诱饵"],
    caseStory: "受害人做「刷单任务」获小利后，被要求大额垫付，本金无法取回。",
  },
  invest: {
    fraudType: "虚假投资理财诈骗",
    identifyDetail: ["「日化 5%」必是资金盘", "非正规渠道入金 = 诈骗"],
    protectList: ["理财只在持牌机构操作", "警惕「导师带单」"],
    caseStory: "受害人被拉入「内部投资群」，向虚假平台入金后平台无法登录。",
  },
  /** v4 替换：pie → dcep */
  dcep: {
    fraudType: "数字人民币诈骗",
    identifyDetail: ["数字人民币仅官方 APP 可用", "陌生链接下载 = 钓鱼"],
    protectList: ["认准「数字人民币 APP」官方渠道", "不点击陌生短信链接"],
    caseStory: "受害人点击「数字人民币钱包升级」短信链接，输入银行卡信息后资金被盗。",
  },
  /** v4 替换：phonebrush → aiVoice */
  aiVoice: {
    fraudType: "AI语音克隆诈骗",
    identifyDetail: ["AI 可克隆任意人声音", "电话借钱 = 多重验证"],
    protectList: ["遇亲友借钱电话先挂断回拨", "设置家庭「暗号」"],
    caseStory: "受害人接到「儿子」电话称出车祸急需手术费，声音高度相似，转账后发现是 AI 克隆。",
  },
  /** v4 替换：bitcoin → facetime */
  facetime: {
    fraudType: "FaceTime冒充客服诈骗",
    identifyDetail: ["FaceTime 来电冒充金融客服", "关闭陌生人来电功能"],
    protectList: ["关闭 FaceTime 接收陌生人来电", "官方客服不会用 FaceTime"],
    caseStory: "受害人接到 FaceTime 来电，对方自称「金融客服」称其账户异常，引导屏幕共享后资金被转走。",
  },
  /** v4 替换：guarantee → expressClaim */
  expressClaim: {
    fraudType: "快递理赔诈骗",
    identifyDetail: ["快递理赔只走官方渠道", "屏幕共享 = 诈骗"],
    protectList: ["通过快递 APP/官网核实", "不开启屏幕共享"],
    caseStory: "受害人接到「快递丢失理赔」电话，按指示开启屏幕共享输入验证码后资金被转走。",
  },
  pigboy: {
    fraudType: "杀猪盘诈骗",
    identifyDetail: ["完美男友教理财 = 杀猪盘", "「稳赚」是诱饵"],
    protectList: ["警惕陌生异性加好友", "不参与未知平台投资"],
    caseStory: "受害人与「外籍军官」网恋，被诱导投资后无法提现，损失数十万。",
  },
  deepfake: {
    fraudType: "AI换脸诈骗",
    identifyDetail: ["AI 换脸可伪造亲人/领导", "视频通话也可能是假的"],
    protectList: ["多重验证（声音+问题）", "当面或电话核实"],
    caseStory: "受害人收到「领导」视频通话要求转账，实为AI换脸伪造。",
  },
  fakeLottery: {
    fraudType: "虚假中奖诈骗",
    identifyDetail: ["未参与的中奖 = 诈骗", "「先税后奖」= 诈骗"],
    protectList: ["核实中奖信息来源", "不预交任何费用"],
    caseStory: "受害人收到「中奖通知」，被诱导交「税费」后失联。",
  },
};

/** 引擎→场景：本局最终结算统计（C4 专属结算页用） */
export interface ThunderFinalStats {
  score: number;
  maxCombo: number;
  bustedCount: number;
  bossesDefeated: number;
  wave: number;
  endless: boolean;
  endlessScale: number;
  difficulty: Difficulty;
  mode: ThunderMode;
  elapsedSec: number;
  killStats: Record<string, number>;
  bossKillTimes: { name: string; atSec: number; fraudType: string; emoji: string }[];
  comboHistory: { t: number; combo: number }[];
  win: boolean;
  deathCause?: { fraudType: string; emoji: string; name: string; identifyDetail?: string[]; protectList?: string[]; caseStory?: string };
  /** v4：BossRush 各阶段结果（仅 bossRush 模式） */
  bossRushStages?: { stage: number; bossName: string; timeSec: number; emoji: string }[];
  /** v4：BossRush 总用时（仅 bossRush 模式） */
  bossRushTotalTimeSec?: number;
  /** v4：获得天赋点（本局） */
  talentPointsGained?: number;
  // ===== v5 升级结算字段 =====
  /** 本局擦弹数（统计用） */
  grazeCount?: number;
  /** 段位积分变化（仅 ranked 模式） */
  rankDelta?: number;
  /** 段位是否晋升 */
  rankTierUp?: boolean;
  /** 段位是否降级 */
  rankTierDown?: boolean;
  /** 新段位名 */
  rankNewTierName?: string;
  /** 新段位 emoji */
  rankNewTierEmoji?: string;
  /** 案例剧场触发数据（首次击败 BOSS 时） */
  caseTheaterTrigger?: { bossName: string; caseStory: string; identifyDetail?: string[]; protectList?: string[]; emoji: string; fraudType: string };
  // ===== v6 升级结算字段 =====
  /** 本局格挡成功次数 */
  parryCount?: number;
  /** 本局口诀连招触发次数 */
  mantraTriggeredCount?: number;
  /** 本局 AI 对话识破次数 */
  aiDialogBustedCount?: number;
  /** 本局解锁的诈骗溯源档案列表 */
  unlockedArchives?: ThunderFraudArchive[];
  /** 本局获得的赛季通行证经验 */
  seasonPassGainedExp?: number;
  /** 本局通行证升级解锁的奖励列表 */
  seasonPassUnlockedRewards?: ThunderSeasonPassReward[];
  // ===== v7 升级结算字段 =====
  /** v7 剧情战役：本关是否通关 */
  storyStageCleared?: boolean;
  /** v7 剧情战役：通关解锁的结局 ID（首次达成特定条件时） */
  storyEndingUnlocked?: string;
  /** v7 剧情战役：本关评价（S/A/B/C） */
  storyRank?: "S" | "A" | "B" | "C";
  /** v7 RPG：本剧本达成的结局 ID */
  rpgEndingId?: string;
  /** v7 RPG：剧本识破红旗数 */
  rpgBustScore?: number;
  /** v7 自适应 AI：本局技能评分变化 */
  adaptiveSkillDelta?: number;
  /** v7 自适应 AI：本局使用的动态难度倍率 */
  adaptiveDifficultyMul?: number;
  /** v7 程序化弹幕：本局使用的种子 */
  proceduralSeedUsed?: number;
  /** v7 本局新解锁的证书 ID 列表 */
  unlockedCertificates?: string[];
  /** v7 本局更新的知识图谱节点（nodeId → 新掌握度） */
  knowledgeMasteryUpdates?: Record<string, number>;
  /** v7 数据仪表板：本局能力雷达快照 */
  abilityRadar?: import("./types").ThunderAbilityRadar;
  /** v7 数据仪表板：本局弱点报告 */
  weaknessReport?: import("./types").ThunderWeaknessReport;
}

// ===========================================================================
// ===== v3 升级数据：角色 / 装备 / 武器觉醒 =================================
// ===========================================================================

/**
 * 角色表（v3 新增）：5 位反诈专家
 * 解锁条件与教育里程碑绑定（识破数/击败特定敌人/时长），强化教育属性
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: "swat",
    name: "反诈特警",
    title: "ANTI-FRAUD SWAT",
    emoji: "🚔",
    color: "#00E5FF",
    desc: "受过专业反诈训练的一线特警，擅长应对杀猪盘与冒充公检法诈骗。",
    expertise: "杀猪盘诈骗 / 冒充公检法诈骗",
    tips: [
      "「稳赚不赔」是杀猪盘核心话术",
      "公检法不会电话办案，无「安全账户」",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.15, fraudTypes: ["杀猪盘诈骗", "冒充公检法诈骗"] },
      { kind: "shieldStart", value: 1 },
    ],
    unlockDesc: "默认解锁",
    default: true,
  },
  {
    id: "cyber",
    name: "网安专家",
    title: "CYBER SECURITY",
    emoji: "💻",
    color: "#9D4EDD",
    desc: "精通 AI 换脸与钓鱼网站识别的网络安全专家，能看穿数字伪装。",
    expertise: "AI换脸诈骗 / 钓鱼网站诈骗",
    tips: [
      "AI 换脸可伪造亲人/领导，视频通话也可能是假的",
      "陌生链接不点，认准官方域名",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.2, fraudTypes: ["AI换脸诈骗", "钓鱼网站诈骗"] },
      { kind: "branchStart", branch: "laser", branchLevel: 1 },
    ],
    unlockDesc: "累计识破 30 名诈骗分子后解锁",
  },
  {
    id: "volunteer",
    name: "反诈志愿者",
    title: "VOLUNTEER",
    emoji: "🦺",
    color: "#52C41A",
    desc: "热心公益的反诈宣传志愿者，积分与道具获取能力突出，适合长期作战。",
    expertise: "全类型诈骗（宣传防范）",
    tips: [
      "下载国家反诈中心 APP 并开启预警",
      "96110 来电务必接听",
    ],
    passives: [
      { kind: "scoreBoost", value: 0.2 },
      { kind: "dropBoost", value: 0.25 },
    ],
    unlockDesc: "累计识破 100 名诈骗分子后解锁",
  },
  {
    id: "banker",
    name: "银行风控员",
    title: "BANK RISK",
    emoji: "🏦",
    color: "#FFD666",
    desc: "银行风控专家，专治虚假投资与刷单返利，对资金盘有敏锐嗅觉。",
    expertise: "虚假投资理财诈骗 / 刷单返利诈骗",
    tips: [
      "「日化 5%」远超正常理财，必是资金盘",
      "刷单本身违法，「垫付返利」= 诈骗",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.2, fraudTypes: ["虚假投资理财诈骗", "刷单返利诈骗"] },
      { kind: "ultChargeStart", value: 30 },
    ],
    unlockDesc: "击败任意 BOSS 后解锁",
  },
  {
    id: "officer",
    name: "社区民警",
    title: "COMMUNITY POLICE",
    emoji: "👮",
    color: "#3B7FEF",
    desc: "扎根社区的民警，擅长应对冒充客服诈骗，每波结束自动恢复生命。",
    expertise: "冒充客服诈骗",
    tips: [
      "正规客服不会要求屏幕共享",
      "验证码 = 密码，绝不外泄",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.15, fraudTypes: ["冒充客服诈骗"] },
      { kind: "hpRegenWave", value: 2 },
    ],
    unlockDesc: "累计游戏 600 秒后解锁",
  },
  // ===== v5 新增角色 =====
  {
    id: "streamer",
    name: "反诈主播",
    title: "ANTI-FRAUD STREAMER",
    emoji: "🎙",
    color: "#FF6B9D",
    desc: "千万粉丝的反诈科普主播，善于识破共享屏幕与短视频引流诈骗，大招充能更快。",
    expertise: "共享屏幕诈骗 / 短视频引流诈骗",
    tips: [
      "屏幕共享 = 把钱包交给骗子",
      "短视频「引流」链接不点，认准官方账号",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.2, fraudTypes: ["共享屏幕诈骗", "短视频引流诈骗"] },
      { kind: "ultChargeStart", value: 20 },
      { kind: "scoreBoost", value: 0.15 },
    ],
    unlockDesc: "累计擦弹 50 次后解锁",
  },
  {
    id: "student",
    name: "学生宣传员",
    title: "STUDENT AMBASSADOR",
    emoji: "🎓",
    color: "#52C41A",
    desc: "校园反诈宣传大使，针对游戏账号交易与数字藏品诈骗有独特见解，初始即获无人机伴随。",
    expertise: "游戏账号交易诈骗 / 数字藏品诈骗",
    tips: [
      "游戏账号交易走官方平台，私下交易 = 诈骗",
      "「高价收购账号」+「交保证金」= 诈骗",
    ],
    passives: [
      { kind: "dmgToFraudTypes", value: 0.2, fraudTypes: ["游戏账号交易诈骗", "数字藏品诈骗"] },
      { kind: "dropBoost", value: 0.3 },
    ],
    unlockDesc: "累计识破 200 名诈骗分子后解锁",
  },
];

/** 角色 id → 定义查找表 */
export const CHARACTER_MAP: Record<CharacterId, CharacterDef> = CHARACTERS.reduce(
  (acc, c) => { acc[c.id] = c; return acc; },
  {} as Record<CharacterId, CharacterDef>,
);

/** 角色解锁条件检查（基于存档，v5 扩展 streamer/student） */
export function isCharacterUnlocked(id: CharacterId, save: import("./types").ThunderSaveData): boolean {
  if (id === "swat") return true;
  switch (id) {
    case "cyber":     return save.totalBusted >= 30;
    case "volunteer": return save.totalBusted >= 100;
    case "banker":    return save.totalBossKills >= 1;
    case "officer":   return save.totalPlayTime >= 600;
    // v5 新增角色解锁条件
    case "streamer":  return save.totalGrazeCount >= 50;
    case "student":   return save.totalBusted >= 200;
    default:          return false;
  }
}

/**
 * 装备表（v3 新增）：3 个槽位，每槽位 3 件装备（common/rare/epic）
 * 命名与 lore 均贴合反诈知识，强化教育属性
 */
export const EQUIPMENTS: EquipmentDef[] = [
  // ===== 武器芯片 =====
  {
    id: "chip_crit_eye",
    slot: "weaponChip",
    name: "识破之眼芯片",
    emoji: "🎯",
    rarity: "rare",
    color: "#FF00E5",
    desc: "暴击率 +15%（暴击 2 倍伤害）",
    lore: "「识破」是反诈第一防线：凡是要验证码、密码的全部是诈骗。",
    effect: { critRate: 0.15 },
  },
  {
    id: "chip_pierce_sword",
    slot: "weaponChip",
    name: "反诈利剑芯片",
    emoji: "⚔",
    rarity: "rare",
    color: "#00E5FF",
    desc: "子弹穿透 +1",
    lore: "一剑穿透话术伪装：公检法不会通过 QQ/微信发送「逮捕令」。",
    effect: { pierce: 1 },
  },
  {
    id: "chip_multi_guard",
    slot: "weaponChip",
    name: "群防群治芯片",
    emoji: "🔱",
    rarity: "common",
    color: "#FFB020",
    desc: "多发 +1，伤害 +10%",
    lore: "群防群治，全民反诈：陌生人发的链接不点、不信、不转账。",
    effect: { multishot: 1, dmgMul: 1.1 },
  },
  // ===== 护盾核心 =====
  {
    id: "core_antifraud_app",
    slot: "shieldCore",
    name: "反诈APP核心",
    emoji: "🛡",
    rarity: "epic",
    color: "#00E5FF",
    desc: "反诈APP护盾 +2 层，减伤 10%",
    lore: "下载国家反诈中心 APP 并开启预警，是抵御诈骗的第一道屏障。",
    effect: { shieldCharges: 2, dmgReduce: 0.1 },
  },
  {
    id: "core_bank_freeze",
    slot: "shieldCore",
    name: "银行止付核心",
    emoji: "🏦",
    rarity: "rare",
    color: "#FFD666",
    desc: "减伤 15%，每秒回 0.5 HP",
    lore: "遭遇诈骗立即拨打 110 报警，可申请银行紧急止付。",
    effect: { dmgReduce: 0.15, hpRegen: 0.5 },
  },
  {
    id: "core_hotline_96110",
    slot: "shieldCore",
    name: "96110热线核心",
    emoji: "📞",
    rarity: "common",
    color: "#52C41A",
    desc: "减伤 8%，大招充能 +20%",
    lore: "96110 是全国反诈专线，来电务必接听，可能是劝阻电话。",
    effect: { dmgReduce: 0.08, ultChargeMul: 1.2 },
  },
  // ===== 移动装置 =====
  {
    id: "move_dash_booster",
    slot: "moveModule",
    name: "闪避推进器",
    emoji: "👟",
    rarity: "rare",
    color: "#3B7FEF",
    desc: "闪避冷却 -25%，移速 +10%",
    lore: "「挂断电话」是最快的闪避：不轻信陌生来电，自行核实。",
    effect: { dashCdMul: 0.75, moveSpeedMul: 1.1 },
  },
  {
    id: "move_radar_warn",
    slot: "moveModule",
    name: "预警雷达",
    emoji: "📡",
    rarity: "common",
    color: "#FF7A1A",
    desc: "道具掉落 +20%，移速 +5%",
    lore: "预警雷达如反诈意识：天上不会掉馅饼，高息保本 = 资金盘。",
    effect: { dropMul: 1.2, moveSpeedMul: 1.05 },
  },
  {
    id: "move_ult_engine",
    slot: "moveModule",
    name: "审判引擎",
    emoji: "⚡",
    rarity: "epic",
    color: "#FF00E5",
    desc: "大招充能 +30%，移速 +8%",
    lore: "雷霆审判之下，无诈可遁：全民反诈，天下无诈。",
    effect: { ultChargeMul: 1.3, moveSpeedMul: 1.08 },
  },
];

/** 装备 id → 定义查找表 */
export const EQUIPMENT_MAP: Record<string, EquipmentDef> = EQUIPMENTS.reduce(
  (acc, e) => { acc[e.id] = e; return acc; },
  {} as Record<string, EquipmentDef>,
);

/** 按槽位分组的装备列表 */
export const EQUIPMENTS_BY_SLOT: Record<EquipSlot, EquipmentDef[]> = {
  weaponChip: EQUIPMENTS.filter((e) => e.slot === "weaponChip"),
  shieldCore: EQUIPMENTS.filter((e) => e.slot === "shieldCore"),
  moveModule: EQUIPMENTS.filter((e) => e.slot === "moveModule"),
};

/** 稀有度权重（common 55%, rare 30%, epic 15%） */
export const EQUIP_RARITY_WEIGHTS: Record<EquipRarity, number> = {
  common: 0.55,
  rare: 0.3,
  epic: 0.15,
};

/** 稀有度标签 */
export const EQUIP_RARITY_LABEL: Record<EquipRarity, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
};

/** 槽位标签 */
export const EQUIP_SLOT_LABEL: Record<EquipSlot, string> = {
  weaponChip: "武器芯片",
  shieldCore: "护盾核心",
  moveModule: "移动装置",
};

/**
 * BOSS 击败掉落装备（按难度决定稀有度倾向）
 * 返回装备 id（必定掉落 1 件）
 */
export function rollEquipmentDrop(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): string {
  // 难度越高，高稀有度概率越大
  const epicBoost = difficulty === "nightmare" ? 0.15 : difficulty === "hard" ? 0.08 : 0;
  const rareBoost = difficulty === "nightmare" ? 0.1 : difficulty === "hard" ? 0.05 : 0;
  const r = rng();
  let rarity: EquipRarity;
  if (r < EQUIP_RARITY_WEIGHTS.epic + epicBoost) {
    rarity = "epic";
  } else if (r < EQUIP_RARITY_WEIGHTS.epic + epicBoost + EQUIP_RARITY_WEIGHTS.rare + rareBoost) {
    rarity = "rare";
  } else {
    rarity = "common";
  }
  // 随机选槽位
  const slots: EquipSlot[] = ["weaponChip", "shieldCore", "moveModule"];
  const slot = slots[Math.floor(rng() * slots.length)];
  const pool = EQUIPMENTS_BY_SLOT[slot].filter((e) => e.rarity === rarity);
  if (pool.length === 0) {
    // 兜底：该稀有度无货，降级取该槽位任意一件
    const fallback = EQUIPMENTS_BY_SLOT[slot];
    return fallback[Math.floor(rng() * fallback.length)].id;
  }
  return pool[Math.floor(rng() * pool.length)].id;
}

/**
 * 武器觉醒表（v3 新增）：每个分支 4/5 级觉醒形态
 * 觉醒后子弹视觉与机制质变
 */
export const WEAPON_AWAKENINGS: WeaponAwakeningDef[] = [
  // 散射觉醒
  {
    branch: "spread",
    level: 4,
    name: "风暴散射",
    emoji: "🌀",
    desc: "5 向散射 + 子弹更大，覆盖更广",
    mantra: "群防群治，全民反诈",
    effect: { dmgMul: 1.3, extraProjectiles: 2 },
  },
  {
    branch: "spread",
    level: 5,
    name: "反诈风暴",
    emoji: "🌪",
    desc: "7 向散射 + 子弹追踪",
    mantra: "全民反诈，天下无诈",
    effect: { dmgMul: 1.6, extraProjectiles: 4, homing: true },
  },
  // 激光觉醒
  {
    branch: "laser",
    level: 4,
    name: "等离子激光",
    emoji: "🔆",
    desc: "激光更宽 + 穿透 +1",
    mantra: "一剑穿透话术伪装",
    effect: { dmgMul: 1.4, pierce: 1 },
  },
  {
    branch: "laser",
    level: 5,
    name: "识破光束",
    emoji: "💫",
    desc: "激光命中爆炸 + 范围伤害",
    mantra: "识破一切伪装，让诈骗无处遁形",
    effect: { dmgMul: 1.8, explode: true, explodeRadius: 60 },
  },
  // 追踪觉醒
  {
    branch: "homing",
    level: 4,
    name: "智能导弹群",
    emoji: "🚀",
    desc: "多发 +1 + 伤害 +30%",
    mantra: "精准打击电诈集团",
    effect: { dmgMul: 1.3, extraProjectiles: 1 },
  },
  {
    branch: "homing",
    level: 5,
    name: "雷霆审判导弹",
    emoji: "🎯",
    desc: "多发 +2 + 命中爆炸",
    mantra: "雷霆审判，诈骗终结",
    effect: { dmgMul: 1.7, extraProjectiles: 2, explode: true, explodeRadius: 50 },
  },
];

/** 觉醒查找表：branch + level → 定义 */
export const AWAKENING_MAP: Record<string, WeaponAwakeningDef> = WEAPON_AWAKENINGS.reduce(
  (acc, a) => { acc[`${a.branch}-${a.level}`] = a; return acc; },
  {} as Record<string, WeaponAwakeningDef>,
);

/** 获取某分支某等级的觉醒定义（level < 4 返回 undefined） */
export function getAwakening(branch: WeaponBranch, level: WeaponBranchLevel): WeaponAwakeningDef | undefined {
  if (level < 4 || branch === "normal") return undefined;
  return AWAKENING_MAP[`${branch}-${level}`];
}

/** 武器分支经验表（v3 新增）：1-5 级所需 XP */
export const BRANCH_XP_TABLE: Record<number, number> = {
  1: 0,    // 1 级无需 XP（选择即获得）
  2: 40,   // 升到 2 级需累计 40 XP
  3: 90,   // 升到 3 级需累计 90 XP
  4: 160,  // 觉醒到 4 级需累计 160 XP
  5: 260,  // 觉醒到 5 级需累计 260 XP
};

/** 分支升级所需 XP（从 currentLevel 升到 currentLevel+1） */
export function branchXpToNext(currentLevel: WeaponBranchLevel): number {
  return BRANCH_XP_TABLE[currentLevel + 1] ?? Infinity;
}

/** 觉醒条件：分支达到 3 级满 XP + 击败过 1 个 BOSS（存档中 awakenedBranches 已记录则永久觉醒） */
export function canAwaken(
  branch: WeaponBranch,
  branchLevel: WeaponBranchLevel,
  branchXp: number,
  save: import("./types").ThunderSaveData,
): boolean {
  if (branch === "normal") return false;
  if (branchLevel < 3) return false;
  if (branchXp < BRANCH_XP_TABLE[4]) return false;
  if (save.totalBossKills < 1) return false;
  return true;
}

// ===========================================================================
// ===== v4 升级数据：天赋树 / 装备套装 / BossRush 配置 ======================
// ===========================================================================

/**
 * 天赋树定义（v4 新增）：通用模板，适用于所有角色
 * 每角色 3 分支 × 5 层 = 15 节点；解锁状态按角色独立保存
 * - offense 攻：伤害 / 暴击 / 射速 / 多发 / 暴伤
 * - defense 防：减伤 / 血量 / 护盾 / 反伤 / 回血
 * - support 辅：移速 / 掉落 / 大招 / 闪避 / 综合
 */
export const TALENT_TREE: import("./types").ThunderTalentNodeDef[] = [
  // ===== offense 攻系 =====
  { id: "off_1", branch: "offense", tier: 1, name: "火力强化 I", emoji: "💥", desc: "伤害 +5%", cost: 1, effect: { dmgMul: 1.05 }, lore: "识破话术，精准打击" },
  { id: "off_2", branch: "offense", tier: 2, name: "识破之眼", emoji: "🎯", desc: "暴击率 +10%", cost: 2, effect: { critRate: 0.10 }, lore: "看穿伪装，一击命中" },
  { id: "off_3", branch: "offense", tier: 3, name: "射速提升", emoji: "🔄", desc: "射速 +15%（伤害 +10%）", cost: 3, effect: { dmgMul: 1.10 }, lore: "快速识破连环话术" },
  { id: "off_4", branch: "offense", tier: 4, name: "多发齐射", emoji: "🔱", desc: "多发 +1，伤害 +15%", cost: 5, effect: { multishot: 1, dmgMul: 1.15 }, lore: "群防群治，全面覆盖" },
  { id: "off_5", branch: "offense", tier: 5, name: "雷霆审判", emoji: "⚔", desc: "伤害 +25%，大招充能 +20%", cost: 8, effect: { dmgMul: 1.25, ultChargeMul: 1.20 }, lore: "雷霆审判之下，无诈可遁" },
  // ===== defense 防系 =====
  { id: "def_1", branch: "defense", tier: 1, name: "减伤护甲 I", emoji: "🛡", desc: "减伤 5%", cost: 1, effect: { dmgReduce: 0.05 }, lore: "反诈意识是第一道屏障" },
  { id: "def_2", branch: "defense", tier: 2, name: "生命强化", emoji: "❤", desc: "最大 HP +20%（减伤 +3%）", cost: 2, effect: { dmgReduce: 0.03 }, lore: "强健心智，不被话术击倒" },
  { id: "def_3", branch: "defense", tier: 3, name: "反诈APP护盾", emoji: "🛡", desc: "反诈APP护盾 +2 层，减伤 +5%", cost: 3, effect: { shieldCharges: 2, dmgReduce: 0.05 }, lore: "下载国家反诈中心 APP 并开启预警" },
  { id: "def_4", branch: "defense", tier: 4, name: "反伤护甲", emoji: "🌵", desc: "减伤 +8%，每秒回 0.5 HP", cost: 5, effect: { dmgReduce: 0.08, hpRegen: 0.5 }, lore: "遭遇诈骗立即报警，让骗子付出代价" },
  { id: "def_5", branch: "defense", tier: 5, name: "金身不破", emoji: "💎", desc: "减伤 +15%，每秒回 1 HP，护盾 +3", cost: 8, effect: { dmgReduce: 0.15, hpRegen: 1.0, shieldCharges: 3 }, lore: "全民反诈，天下无诈" },
  // ===== support 辅系 =====
  { id: "sup_1", branch: "support", tier: 1, name: "机动强化 I", emoji: "👟", desc: "移速 +10%", cost: 1, effect: { moveSpeedMul: 1.10 }, lore: "「挂断电话」是最快的闪避" },
  { id: "sup_2", branch: "support", tier: 2, name: "战利品+", emoji: "🎁", desc: "道具掉落 +20%", cost: 2, effect: { dropMul: 1.20 }, lore: "收集反诈知识，武装自己" },
  { id: "sup_3", branch: "support", tier: 3, name: "审判充能", emoji: "⚖", desc: "大招充能 +25%，移速 +5%", cost: 3, effect: { ultChargeMul: 1.25, moveSpeedMul: 1.05 }, lore: "积累证据，等待雷霆一刻" },
  { id: "sup_4", branch: "support", tier: 4, name: "闪避大师", emoji: "💨", desc: "闪避冷却 -30%，移速 +10%", cost: 5, effect: { dashCdMul: 0.70, moveSpeedMul: 1.10 }, lore: "识破话术，及时止损" },
  { id: "sup_5", branch: "support", tier: 5, name: "反诈大师", emoji: "🌟", desc: "全属性 +10%，积分 +25%", cost: 8, effect: { dmgMul: 1.10, dmgReduce: 0.10, moveSpeedMul: 1.10, ultChargeMul: 1.10, scoreMul: 1.25, dropMul: 1.10 }, lore: "反诈宣传员，全民觉醒" },
];

/** 天赋节点查找表：id → 定义 */
export const TALENT_NODE_MAP: Record<string, import("./types").ThunderTalentNodeDef> = TALENT_TREE.reduce(
  (acc, n) => { acc[n.id] = n; return acc; },
  {} as Record<string, import("./types").ThunderTalentNodeDef>,
);

/** 按分支分组的天赋节点 */
export const TALENT_BY_BRANCH: Record<import("./types").ThunderTalentBranch, import("./types").ThunderTalentNodeDef[]> = {
  offense: TALENT_TREE.filter((n) => n.branch === "offense"),
  defense: TALENT_TREE.filter((n) => n.branch === "defense"),
  support: TALENT_TREE.filter((n) => n.branch === "support"),
};

/**
 * 获取角色已解锁的天赋节点列表
 * @param characterId 角色 id
 * @param save 存档
 */
export function getUnlockedTalents(
  characterId: import("./types").CharacterId,
  save: import("./types").ThunderSaveData,
): import("./types").ThunderTalentNodeDef[] {
  const state = save.characterTalents[characterId];
  if (!state) return [];
  const unlocked: import("./types").ThunderTalentNodeDef[] = [];
  for (const branch of ["offense", "defense", "support"] as const) {
    const tier = state[branch] ?? 0;
    for (let t = 1; t <= tier; t++) {
      const node = TALENT_TREE.find((n) => n.branch === branch && n.tier === t);
      if (node) unlocked.push(node);
    }
  }
  return unlocked;
}

/**
 * 聚合角色天赋效果到 EquipEffect
 * @param characterId 角色 id
 * @param save 存档
 */
export function computeTalentEffect(
  characterId: import("./types").CharacterId,
  save: import("./types").ThunderSaveData,
): import("./types").EquipEffect {
  const nodes = getUnlockedTalents(characterId, save);
  const agg: import("./types").EquipEffect = {};
  for (const node of nodes) {
    const e = node.effect;
    if (e.dmgMul) agg.dmgMul = (agg.dmgMul ?? 1) * e.dmgMul;
    if (e.critRate) agg.critRate = (agg.critRate ?? 0) + e.critRate;
    if (e.pierce) agg.pierce = (agg.pierce ?? 0) + e.pierce;
    if (e.multishot) agg.multishot = (agg.multishot ?? 0) + e.multishot;
    if (e.shieldCharges) agg.shieldCharges = (agg.shieldCharges ?? 0) + e.shieldCharges;
    if (e.dmgReduce) agg.dmgReduce = (agg.dmgReduce ?? 0) + e.dmgReduce;
    if (e.moveSpeedMul) agg.moveSpeedMul = (agg.moveSpeedMul ?? 1) * e.moveSpeedMul;
    if (e.dashCdMul) agg.dashCdMul = (agg.dashCdMul ?? 1) * e.dashCdMul;
    if (e.ultChargeMul) agg.ultChargeMul = (agg.ultChargeMul ?? 1) * e.ultChargeMul;
    if (e.dropMul) agg.dropMul = (agg.dropMul ?? 1) * e.dropMul;
    if (e.scoreMul) agg.scoreMul = (agg.scoreMul ?? 1) * e.scoreMul;
    if (e.hpRegen) agg.hpRegen = (agg.hpRegen ?? 0) + e.hpRegen;
  }
  return agg;
}

/**
 * 天赋解锁条件检查
 * @param characterId 角色 id
 * @param branch 天赋分支
 * @param targetTier 目标层级
 * @param save 存档
 */
export function canUnlockTalent(
  characterId: import("./types").CharacterId,
  branch: import("./types").ThunderTalentBranch,
  targetTier: number,
  save: import("./types").ThunderSaveData,
): boolean {
  if (targetTier < 1 || targetTier > 5) return false;
  const state = save.characterTalents[characterId] ?? {};
  const currentTier = state[branch] ?? 0;
  if (targetTier !== currentTier + 1) return false; // 必须按层级顺序
  const node = TALENT_TREE.find((n) => n.branch === branch && n.tier === targetTier);
  if (!node) return false;
  if (save.talentPoints < node.cost) return false;
  return true;
}

/**
 * 解锁天赋节点（消耗天赋点）
 * 返回是否成功
 */
export function unlockTalent(
  characterId: import("./types").CharacterId,
  branch: import("./types").ThunderTalentBranch,
  targetTier: number,
  save: import("./types").ThunderSaveData,
): boolean {
  if (!canUnlockTalent(characterId, branch, targetTier, save)) return false;
  const node = TALENT_TREE.find((n) => n.branch === branch && n.tier === targetTier);
  if (!node) return false;
  save.talentPoints -= node.cost;
  const state = save.characterTalents[characterId] ?? {};
  state[branch] = targetTier;
  save.characterTalents = { ...save.characterTalents, [characterId]: state };
  return true;
}

/**
 * 装备套装效果表（v4 新增）：3 件同稀有度触发
 */
export const EQUIP_SET_BONUSES: import("./types").EquipSetBonus[] = [
  {
    rarity: "common",
    name: "反诈新兵套装",
    desc: "3 件普通装备：全属性 +5%",
    effect: { dmgMul: 1.05, dmgReduce: 0.05, moveSpeedMul: 1.05, ultChargeMul: 1.05, dropMul: 1.05, scoreMul: 1.05 },
  },
  {
    rarity: "rare",
    name: "反诈精锐套装",
    desc: "3 件稀有装备：全属性 +10% + 吸血 5%",
    effect: { dmgMul: 1.10, dmgReduce: 0.10, moveSpeedMul: 1.10, ultChargeMul: 1.10, dropMul: 1.10, scoreMul: 1.10, hpRegen: 0.5 },
    special: "shieldRegen",
  },
  {
    rarity: "epic",
    name: "反诈传奇套装",
    desc: "3 件史诗装备：全属性 +15% + 吸血 8% + 护盾再生",
    effect: { dmgMul: 1.15, dmgReduce: 0.15, moveSpeedMul: 1.15, ultChargeMul: 1.15, dropMul: 1.15, scoreMul: 1.15, hpRegen: 1.0, shieldCharges: 2 },
    special: "ultBurst",
  },
];

/** 套装查找表：rarity → 套装定义 */
export const EQUIP_SET_MAP: Record<import("./types").EquipRarity, import("./types").EquipSetBonus> = EQUIP_SET_BONUSES.reduce(
  (acc, s) => { acc[s.rarity] = s; return acc; },
  {} as Record<import("./types").EquipRarity, import("./types").EquipSetBonus>,
);

/**
 * 计算当前装备的套装效果
 * @param equipmentIds 已装备的配件 id 列表（按槽位）
 * @returns 套装效果（无套装返回 null）
 */
export function computeSetBonus(
  equipmentIds: { weaponChip?: string; shieldCore?: string; moveModule?: string },
): import("./types").EquipSetBonus | null {
  const slots: import("./types").EquipSlot[] = ["weaponChip", "shieldCore", "moveModule"];
  const equipped: import("./types").EquipmentDef[] = [];
  for (const slot of slots) {
    const id = equipmentIds[slot];
    if (!id) continue;
    const def = EQUIPMENT_MAP[id];
    if (def) equipped.push(def);
  }
  if (equipped.length < 3) return null;
  // 检查 3 件是否同稀有度
  const rarity = equipped[0].rarity;
  if (equipped.every((e) => e.rarity === rarity)) {
    return EQUIP_SET_MAP[rarity];
  }
  return null;
}

/**
 * BossRush 配置（v4 新增）
 */
export const BOSS_RUSH_CONFIG: import("./types").BossRushConfig = {
  totalStages: 4,
  includeUltimate: true,
  restSec: 3,
  hpRestoreRatio: 0.3,
  talentPointPerStage: 1,
  clearTalentPoints: 5,
};

/**
 * 生成 BossRush 模式的 BOSS 序列
 * @param rng 随机数生成器
 * @returns BOSS id 数组（按出战顺序）
 */
export function generateBossRushSequence(rng: () => number = Math.random): string[] {
  const stages: string[] = [];
  // 前 3 战：从 RANDOM_BOSSES 中不重复抽取
  const pool = [...RANDOM_BOSSES];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    stages.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  // 第 4 战：终极 BOSS
  stages.push(ULTIMATE_BOSS.id);
  return stages;
}

/**
 * 获取 BOSS 定义（按 id，包含随机 BOSS 和终极 BOSS）
 */
export function getBossDefById(id: string): BossDef | undefined {
  if (ULTIMATE_BOSS.id === id) return ULTIMATE_BOSS;
  return RANDOM_BOSSES.find((b) => b.id === id);
}

/**
 * 排行榜更新（v4 新增）：插入新条目并保持 top 10
 * @param list 当前排行榜列表
 * @param entry 新条目
 * @param maxLen 最大长度（默认 10）
 * @returns 更新后的列表
 */
export function insertLeaderboardEntry(
  list: import("./types").ThunderLeaderboardEntry[],
  entry: import("./types").ThunderLeaderboardEntry,
  maxLen = 10,
): import("./types").ThunderLeaderboardEntry[] {
  const newList = [...list, entry].sort((a, b) => b.score - a.score).slice(0, maxLen);
  return newList;
}

/** 日期键（YYYY-MM-DD） */
export function dailyKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 周键（YYYY-Www，ISO 周数） */
export function weeklyKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ===========================================================================
// ===== v5 升级数据：擦弹 / 三角克制 / 无人机 / 赛季 / 任务 / 皮肤 =========
// ===== / 案例剧场 / 周常修饰符 / 生存防守 / 教学关 / 新敌人死亡复盘 =========
// ===========================================================================

/** 擦弹系统配置（v5 新增） */
export const GRAZE_CONFIG: import("./types").GrazeConfig = {
  radius: 48,
  chargePerGraze: 0.08,
  chargeMax: 1,
  boostDuration: 4,
  boostScoreMul: 1.5,
};

/**
 * 三角克制矩阵（v5 新增）：散射→追踪→激光→散射 循环克制
 * 即 spread 克 homing，homing 克 laser，laser 克 spread
 */
export const COUNTER_MATRIX: Record<Exclude<import("./types").WeaponBranch, "normal">, Exclude<import("./types").WeaponBranch, "normal">> = {
  spread: "homing",  // 散射克追踪
  homing: "laser",   // 追踪克激光
  laser: "spread",   // 激光克散射
};

/** 克制伤害倍率 */
export const COUNTER_ADVANTAGE_MUL = 1.3;   // 克制时 +30% 伤害
export const COUNTER_DISADVANTAGE_MUL = 0.8; // 被克制时 -20% 伤害

/**
 * 武器分支对诈骗类型的克制关系（v5 新增）
 * 每个诈骗类型有一个「弱」分支（被克）和一个「强」分支（克它）
 * 返回 "advantage" | "disadvantage" | "neutral"
 */
export function getCounterRelation(
  branch: import("./types").WeaponBranch,
  fraudType: string,
): import("./types").CounterRelation {
  if (branch === "normal") return "neutral";
  // 诈骗类型 → 被克制的分支（即该分支对此诈骗有优势）
  const fraudWeakBranch: Record<string, Exclude<import("./types").WeaponBranch, "normal">> = {
    "杀猪盘诈骗": "spread",
    "冒充公检法诈骗": "laser",
    "冒充客服诈骗": "homing",
    "钓鱼网站诈骗": "laser",
    "刷单返利诈骗": "spread",
    "虚假投资理财诈骗": "homing",
    "数字人民币诈骗": "spread",
    "AI语音克隆诈骗": "homing",
    "FaceTime冒充客服诈骗": "homing",
    "快递理赔诈骗": "homing",
    "AI换脸诈骗": "laser",
    "虚假中奖诈骗": "spread",
    // v5 新增诈骗类型
    "共享屏幕诈骗": "laser",
    "机票退改签诈骗": "spread",
    "游戏账号交易诈骗": "homing",
    "虚假招工诈骗": "spread",
    "数字藏品诈骗": "homing",
    "短视频引流诈骗": "spread",
    "虚假字幕诈骗": "laser",
    "跨境洗钱诈骗": "spread",
    "AI伪造身份诈骗": "laser",
    "跨境电信诈骗集团": "spread",
  };
  const weakBranch = fraudWeakBranch[fraudType];
  if (!weakBranch) return "neutral";
  if (branch === weakBranch) return "advantage";
  // 被克制：当 branch 是 weakBranch 的克制者（即 weakBranch 克 branch）
  if (COUNTER_MATRIX[weakBranch] === branch) return "disadvantage";
  return "neutral";
}

/** 无人机定义表（v5 新增） */
export const DRONES: Record<import("./types").DroneKind, import("./types").DroneDef> = {
  gunpod: {
    kind: "gunpod",
    name: "机枪无人机",
    emoji: "🛸",
    color: "#00E5FF",
    desc: "伴随战机开火，伤害为玩家 40%",
    branch: "normal",
    dmgMul: 0.4,
    fireInterval: 0.4,
    duration: 15,
    lore: "群防群治：无人机如反诈宣传员，协助识破诈骗。",
  },
  laserpod: {
    kind: "laserpod",
    name: "激光无人机",
    emoji: "🔆",
    color: "#FF00E5",
    desc: "发射穿透激光，伤害为玩家 30%",
    branch: "laser",
    dmgMul: 0.3,
    fireInterval: 0.8,
    duration: 15,
    lore: "一剑穿透话术伪装：激光无人机专治伪装诈骗。",
  },
  shieldpod: {
    kind: "shieldpod",
    name: "护盾无人机",
    emoji: "🛡",
    color: "#52C41A",
    desc: "不攻击，但每 5 秒为玩家恢复 1 层反诈APP护盾",
    branch: "normal",
    dmgMul: 0,
    fireInterval: 5,
    duration: 15,
    lore: "反诈APP护盾：护盾无人机如反诈预警，持续守护。",
  },
};

/** 段位 tier 定义表（v5 新增） */
export const RANK_TIERS: import("./types").ThunderRankTierDef[] = [
  { id: "bronze",       name: "青铜",     emoji: "🥉", color: "#CD7F32", minPoints: 0,    winGain: 30, loseLoss: 15 },
  { id: "silver",       name: "白银",     emoji: "🥈", color: "#C0C0C0", minPoints: 100,  winGain: 28, loseLoss: 18 },
  { id: "gold",         name: "黄金",     emoji: "🥇", color: "#FFD666", minPoints: 300,  winGain: 26, loseLoss: 20 },
  { id: "platinum",     name: "铂金",     emoji: "💎", color: "#00E5FF", minPoints: 600,  winGain: 24, loseLoss: 22 },
  { id: "diamond",      name: "钻石",     emoji: "💠", color: "#3B7FEF", minPoints: 1000, winGain: 22, loseLoss: 24 },
  { id: "master",       name: "大师",     emoji: "🏆", color: "#B388FF", minPoints: 1500, winGain: 20, loseLoss: 26 },
  { id: "grandmaster",  name: "宗师",     emoji: "👑", color: "#FF00E5", minPoints: 2200, winGain: 18, loseLoss: 28 },
];

/** 段位查找表 */
export const RANK_TIER_MAP: Record<import("./types").ThunderRankTier, import("./types").ThunderRankTierDef> = RANK_TIERS.reduce(
  (acc, t) => { acc[t.id] = t; return acc; },
  {} as Record<import("./types").ThunderRankTier, import("./types").ThunderRankTierDef>,
);

/** 根据积分获取段位 */
export function rankTierForPoints(points: number): import("./types").ThunderRankTierDef {
  let cur = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (points >= t.minPoints) cur = t;
  }
  return cur;
}

/** 当前赛季（v5 新增） */
export const THUNDER_CURRENT_SEASON: import("./types").ThunderSeason = {
  id: "S1",
  name: "雷霆赛季 S1",
  startDate: "2026-07-29",
  endDate: "2026-10-29",
  desc: "首届雷霆反诈段位赛，三个月赛期，冲击宗师段位",
};

/** 周常修饰符池（v5 新增） */
export const WEEKLY_MODIFIERS: import("./types").WeeklyModifierDef[] = [
  { id: "doubleScore",  name: "双倍积分",   emoji: "💰", desc: "本局所有积分 ×2",               kind: "doubleScore",  color: "#FFD666", scoreMul: 2.0 },
  { id: "noPowerups",   name: "无道具挑战", emoji: "🚫", desc: "本局无任何道具掉落",             kind: "noPowerups",   color: "#FF4D4F", scoreMul: 1.8 },
  { id: "bossOnly",     name: "BOSS连战",   emoji: "👹", desc: "仅 BOSS 战，无小怪波次",         kind: "bossOnly",     color: "#9D4EDD", scoreMul: 1.6 },
  { id: "fastEnemy",    name: "极速敌人",   emoji: "💨", desc: "敌方移速 +50%，弹幕频率 +30%",   kind: "fastEnemy",    value: 1.5, color: "#FF7A1A", scoreMul: 1.7 },
  { id: "lowHp",        name: "残血作战",   emoji: "❤",  desc: "玩家初始 HP 减半",               kind: "lowHp",        value: 0.5, color: "#E5353B", scoreMul: 1.9 },
  { id: "eliteFlood",   name: "精英洪流",   emoji: "Elite", desc: "敌方全为精英敌人，带护盾",     kind: "eliteFlood",   color: "#FF00E5", scoreMul: 2.2 },
];

/** 根据周数获取本周修饰符（按周轮换） */
export function weeklyModifierFor(date: Date = new Date()): import("./types").WeeklyModifierDef {
  const key = weeklyKey(date);
  // 用周键哈希取模
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return WEEKLY_MODIFIERS[hash % WEEKLY_MODIFIERS.length];
}

/** 生存模式保护目标（v5 新增） */
export const SURVIVAL_TARGETS: import("./types").SurvivalTargetDef[] = [
  { id: "community", name: "社区警务室", emoji: "🏡", maxHp: 60, xRatio: 0.5, yRatio: 0.88, radius: 28, lore: "守护社区警务室：反诈宣传的第一线阵地。" },
  { id: "school",    name: "校园宣传点", emoji: "🏫", maxHp: 50, xRatio: 0.5, yRatio: 0.88, radius: 26, lore: "守护校园宣传点：反诈教育从校园抓起。" },
  { id: "bank",      name: "银行止付台", emoji: "🏦", maxHp: 70, xRatio: 0.5, yRatio: 0.88, radius: 30, lore: "守护银行止付台：紧急止付挽损的关键节点。" },
];

/** 皮肤定义表（v5 新增） */
export const THUNDER_SKINS: import("./types").ThunderSkinDef[] = [
  {
    id: "default",
    name: "标准战机",
    emoji: "🚀",
    color: "#00E5FF",
    desc: "反诈特警标配战机",
    shipColor: "#00E5FF",
    shipStroke: "#FFFFFF",
    engineFlame: "#FFD666",
    bulletColor: "#00E5FF",
    unlockDesc: "默认解锁",
    default: true,
  },
  {
    id: "neon",
    name: "霓虹追猎",
    emoji: "⚡",
    color: "#FF00E5",
    desc: "赛博朋克风格，霓虹紫涂装",
    shipColor: "#FF00E5",
    shipStroke: "#FFFFFF",
    engineFlame: "#00E5FF",
    bulletColor: "#FF00E5",
    unlockDesc: "累计识破 500 名诈骗分子",
  },
  {
    id: "golden",
    name: "黄金审判",
    emoji: "👑",
    color: "#FFD666",
    desc: "镀金战机，反诈统帅专属",
    shipColor: "#FFD666",
    shipStroke: "#FF7A1A",
    engineFlame: "#FF7A1A",
    bulletColor: "#FFD666",
    unlockDesc: "达到「反诈统帅」称号（12000 分）",
  },
  {
    id: "jade",
    name: "翡翠守护",
    emoji: "🛡",
    color: "#52C41A",
    desc: "翡翠绿涂装，象征全民反诈",
    shipColor: "#52C41A",
    shipStroke: "#1AD670",
    engineFlame: "#1AD670",
    bulletColor: "#52C41A",
    unlockDesc: "累计游戏 1800 秒",
  },
  {
    id: "phoenix",
    name: "凤凰涅槃",
    emoji: "🔥",
    color: "#FF5A60",
    desc: "烈焰涂装，反诈传奇专属",
    shipColor: "#FF5A60",
    shipStroke: "#FFD666",
    engineFlame: "#FF7A1A",
    bulletColor: "#FF5A60",
    unlockDesc: "击败 10 个 BOSS",
  },
];

/** 皮肤查找表 */
export const THUNDER_SKIN_MAP: Record<string, import("./types").ThunderSkinDef> = THUNDER_SKINS.reduce(
  (acc, s) => { acc[s.id] = s; return acc; },
  {} as Record<string, import("./types").ThunderSkinDef>,
);

/** 皮肤解锁条件检查 */
export function isSkinUnlocked(id: string, save: import("./types").ThunderSaveData): boolean {
  const skin = THUNDER_SKIN_MAP[id];
  if (!skin) return false;
  if (skin.default) return true;
  if (save.unlockedSkins.includes(id)) return true;
  // 动态解锁条件
  switch (id) {
    case "neon":   return save.totalBusted >= 500;
    case "golden": return save.bestScore >= 12000;
    case "jade":   return save.totalPlayTime >= 1800;
    case "phoenix": return save.totalBossKills >= 10;
    default:       return false;
  }
}

/** 每日任务库（v5 新增）：每日随机抽 3 个 */
export const DAILY_QUESTS: import("./types").ThunderQuestDef[] = [
  { id: "graze_15",   name: "擦弹高手",   desc: "本局擦弹 15 次",           emoji: "✨", target: 15,  kind: "graze",  rewardTalentPoints: 2 },
  { id: "graze_30",   name: "擦弹大师",   desc: "本局擦弹 30 次",           emoji: "💫", target: 30,  kind: "graze",  rewardTalentPoints: 3 },
  { id: "kill_40",    name: "识破能手",   desc: "本局识破 40 名诈骗分子",   emoji: "🎯", target: 40,  kind: "kill",   rewardTalentPoints: 2 },
  { id: "kill_80",    name: "识破精英",   desc: "本局识破 80 名诈骗分子",   emoji: "🛡", target: 80,  kind: "kill",   rewardTalentPoints: 3 },
  { id: "boss_1",     name: "BOSS终结",   desc: "本局击败 1 个 BOSS",       emoji: "👑", target: 1,   kind: "boss",   rewardTalentPoints: 3 },
  { id: "combo_20",   name: "连击达人",   desc: "本局达成 20 连击",         emoji: "🔥", target: 20,  kind: "combo",  rewardTalentPoints: 2 },
  { id: "combo_40",   name: "连击宗师",   desc: "本局达成 40 连击",         emoji: "⚡", target: 40,  kind: "combo",  rewardTalentPoints: 4 },
  { id: "score_8k",   name: "高分玩家",   desc: "本局获得 8000 分",         emoji: "💰", target: 8000, kind: "score", rewardTalentPoints: 3 },
  { id: "wave_6",     name: "推进能手",   desc: "本局到达第 6 波",          emoji: "🌊", target: 6,   kind: "wave",   rewardTalentPoints: 2 },
  { id: "graze_50",   name: "擦弹传说",   desc: "本局擦弹 50 次",           emoji: "🌟", target: 50,  kind: "graze",  rewardTalentPoints: 5, rewardSkinId: "neon" },
];

/** 每日任务种子（基于日期抽取 3 个任务） */
export function dailyQuestsFor(date: Date = new Date()): import("./types").ThunderQuestDef[] {
  const seed = dailySeedFor(date);
  const rng = mulberry32(seed);
  const pool = [...DAILY_QUESTS];
  const picked: import("./types").ThunderQuestDef[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

/** 获取/初始化今日任务进度 */
export function getTodayQuestProgress(save: import("./types").ThunderSaveData): import("./types").ThunderQuestProgress[] {
  const key = dailyKey();
  if (save.lastQuestDate !== key) {
    // 新一天，重置任务
    const defs = dailyQuestsFor();
    save.lastQuestDate = key;
    save.dailyQuests[key] = defs.map((d) => ({ questId: d.id, progress: 0, completed: false, claimed: false }));
  }
  return save.dailyQuests[key] ?? [];
}

/** 更新任务进度（引擎调用） */
export function updateQuestProgress(
  save: import("./types").ThunderSaveData,
  kind: import("./types").ThunderQuestDef["kind"],
  value: number,
): void {
  const progress = getTodayQuestProgress(save);
  const key = dailyKey();
  for (const p of progress) {
    const def = DAILY_QUESTS.find((d) => d.id === p.questId);
    if (!def || def.kind !== kind) continue;
    p.progress = Math.max(p.progress, value);
    if (p.progress >= def.target && !p.completed) {
      p.completed = true;
    }
  }
  save.dailyQuests[key] = progress;
}

/** 领取任务奖励 */
export function claimQuestReward(
  save: import("./types").ThunderSaveData,
  questId: string,
): boolean {
  const progress = getTodayQuestProgress(save);
  const p = progress.find((x) => x.questId === questId);
  if (!p || !p.completed || p.claimed) return false;
  const def = DAILY_QUESTS.find((d) => d.id === questId);
  if (!def) return false;
  p.claimed = true;
  save.talentPoints += def.rewardTalentPoints;
  save.totalTalentPointsEarned += def.rewardTalentPoints;
  if (def.rewardSkinId && !save.unlockedSkins.includes(def.rewardSkinId)) {
    save.unlockedSkins.push(def.rewardSkinId);
    save.totalSkinsEarned += 1;
  }
  return true;
}

/** 案例剧场定义库（v5 新增）：BOSS 击败后沉浸式案例回放 */
export const CASE_THEATERS: import("./types").CaseTheaterDef[] = [
  {
    bossId: "pigkiller",
    title: "杀猪盘案例复盘",
    fraudType: "杀猪盘诈骗",
    scenes: [
      { title: "相识", emoji: "💬", text: "王女士在交友软件结识自称「外籍军官」的男子，对方温柔体贴，每日嘘寒问暖。", duration: 3 },
      { title: "诱导", emoji: "📈", text: "「男友」称发现平台内部漏洞，稳赚不赔，发来虚假盈利截图，诱导王女士小额试水。", duration: 3 },
      { title: "深陷", emoji: "💸", text: "王女士尝到小利后，陆续向虚假平台转账 87 万元，账户显示「盈利」却无法提现。", duration: 3 },
      { title: "收网", emoji: "🚨", text: "「男友」要求缴纳「解冻金」方可提现，王女士方知受骗，报警后平台已无法登录。", duration: 3 },
    ],
    mantra: "稳赚不赔 = 诈骗，提现要交钱 = 100% 诈骗",
  },
  {
    bossId: "fakecop",
    title: "冒充公检法案例复盘",
    fraudType: "冒充公检法诈骗",
    scenes: [
      { title: "恐吓", emoji: "📞", text: "李阿姨接到「+86」来电，对方自称市公安局，称其名下账户涉嫌洗钱需配合调查。", duration: 3 },
      { title: "隔离", emoji: "🔒", text: "「假警察」要求李阿姨独自在房间，不得告知家人，通过 QQ 发送伪造「逮捕令」。", duration: 3 },
      { title: "操控", emoji: "📱", text: "诱导李阿姨开启屏幕共享，以「资金清查」为由，要求其将存款转入「安全账户」。", duration: 3 },
      { title: "真相", emoji: "🚨", text: "李阿姨转账 53 万元后失联，子女发现后报警。真警察绝不会电话办案、无「安全账户」。", duration: 3 },
    ],
    mantra: "公检法不电话办案，无「安全账户」",
  },
  {
    bossId: "screenShareSyndicate",
    title: "共享屏幕案例复盘",
    fraudType: "共享屏幕诈骗",
    scenes: [
      { title: "伪装", emoji: "🎧", text: "李女士接到「电商客服」电话，称其订单有质量问题需办理「理赔」，态度专业。", duration: 3 },
      { title: "诱导", emoji: "📲", text: "客服称理赔需「身份验证」，要求下载会议 APP 并开启屏幕共享，称「系统需要」。", duration: 3 },
      { title: "窃取", emoji: "🔑", text: "屏幕共享下，骗子远程看到李女士输入的银行卡号、密码与短信验证码。", duration: 3 },
      { title: "转移", emoji: "🚨", text: "骗子在李女士不知情下转走 23 万元。正规客服绝不会要求屏幕共享。", duration: 3 },
    ],
    mantra: "屏幕共享 = 把钱包交给骗子",
  },
  {
    bossId: "crossBorderLaunder",
    title: "跨境洗钱案例复盘",
    fraudType: "跨境洗钱诈骗",
    scenes: [
      { title: "诱惑", emoji: "💼", text: "小张在网上看到「境外高薪招工，月薪 3 万，包机票」，对方承诺「轻松赚钱」。", duration: 3 },
      { title: "陷阱", emoji: "✈", text: "小张偷渡至境外园区，发现是电诈窝点，护照被扣，人身自由受限，被迫从事诈骗。", duration: 3 },
      { title: "洗钱", emoji: "💸", text: "国内同伙以「跑分赚佣金」诱导他人出租银行卡，将诈骗资金通过多层转账洗白。", duration: 3 },
      { title: "代价", emoji: "🚨", text: "小张被解救回国后仍需承担刑责。出租银行卡 = 帮信罪，跨境「高薪招工」= 陷阱。", duration: 3 },
    ],
    mantra: "不出租银行卡，不轻信跨境高薪招工",
  },
];

/** 案例剧场查找表 */
export const CASE_THEATER_MAP: Record<string, import("./types").CaseTheaterDef> = CASE_THEATERS.reduce(
  (acc, c) => { acc[c.bossId] = c; return acc; },
  {} as Record<string, import("./types").CaseTheaterDef>,
);

/** 教学新手关（v5 新增） */
export const TUTORIAL_STAGES: import("./types").TutorialStageDef[] = [
  {
    id: "move",
    title: "基础移动",
    desc: "拖动飞船躲避诈骗弹幕",
    steps: [
      { text: "拖动屏幕移动飞船，就像挂断可疑电话一样及时", emoji: "👆", waitFor: "move" },
      { text: "飞船会自动开火，识破诈骗分子", emoji: "🔫", waitFor: "shoot" },
    ],
    rewardDesc: "完成教学获得 2 天赋点",
  },
  {
    id: "dash",
    title: "闪避冲刺",
    desc: "双击方向键触发闪避冲刺",
    steps: [
      { text: "双击方向键可触发闪避冲刺，短暂无敌", emoji: "💨", waitFor: "dash" },
      { text: "闪避如「挂断电话」，是最快的止损方式", emoji: "📵", waitFor: "continue" },
    ],
    rewardDesc: "掌握闪避后生存能力大增",
  },
  {
    id: "ult",
    title: "雷霆审判",
    desc: "大招充能满后释放雷霆审判",
    steps: [
      { text: "击中敌人积累大招充能", emoji: "⚡", waitFor: "continue" },
      { text: "充能满后点击大招按钮，释放雷霆审判全屏清场", emoji: "⚖", waitFor: "ult" },
    ],
    rewardDesc: "雷霆审判之下，无诈可遁",
  },
];

/** v5 新增敌人死亡复盘文案 */
export const DEATH_CAUSE_V5: Record<string, { fraudType: string; identifyDetail: string[]; protectList: string[]; caseStory: string }> = {
  screenShare: {
    fraudType: "共享屏幕诈骗",
    identifyDetail: ["屏幕共享 = 把钱包交给骗子", "客服要求共享屏幕 = 100% 诈骗"],
    protectList: ["任何要求屏幕共享的来电立即挂断", "不下载未知会议类 APP"],
    caseStory: "受害人被「理赔」诱导开启屏幕共享，验证码被骗子看到后资金被转走。",
  },
  flightRefund: {
    fraudType: "机票退改签诈骗",
    identifyDetail: ["航班变动只认航司官方通知", "「退改签理赔」+ 转账 = 诈骗"],
    protectList: ["通过航司官方 APP/官网核实", "不点击短信中的退改签链接"],
    caseStory: "受害人收到「航班取消」短信，按提示转账「退改签手续费」后失联。",
  },
  gameAccTrade: {
    fraudType: "游戏账号交易诈骗",
    identifyDetail: ["游戏账号交易走官方平台", "「交保证金」「解冻金」= 诈骗"],
    protectList: ["拒绝私下交易", "使用官方交易平台"],
    caseStory: "受害人在非官方平台卖号，被要求交「保证金」后失联。",
  },
  fakeRecruit: {
    fraudType: "虚假招工诈骗",
    identifyDetail: ["「高薪轻松」+「预交费」= 诈骗", "跨境招工 + 保密 = 陷阱"],
    protectList: ["核实招聘公司资质", "不预交任何费用"],
    caseStory: "受害人被「高薪招工」诱导偷渡至境外电诈园区，人身自由受限。",
  },
  digitalCollect: {
    fraudType: "数字藏品诈骗",
    identifyDetail: ["数字藏品只认官方平台", "「升值回购」= 资金盘"],
    protectList: ["警惕「限量发售」「升值保证」", "不点击陌生链接购买"],
    caseStory: "受害人购买「限量数字藏品」，平台承诺回购升值，随后跑路。",
  },
  shortVideo: {
    fraudType: "短视频引流诈骗",
    identifyDetail: ["短视频「引流」链接不点", "认准官方认证账号"],
    protectList: ["不点击陌生短视频中的链接", "通过官方渠道核实"],
    caseStory: "受害人在短视频中点击「免费领红包」链接，输入信息后资金被盗。",
  },
  fakeSubtitle: {
    fraudType: "虚假字幕诈骗",
    identifyDetail: ["视频字幕可被篡改", "「广告」字幕链接不点"],
    protectList: ["认准官方视频源", "不点击字幕中的可疑链接"],
    caseStory: "受害人观看视频时点击字幕中嵌入的「广告」链接，下载恶意 APP 后资金被盗。",
  },
};

/** 生成生存模式动态波次（v5 新增）：侧重保护目标 */
export function generateSurvivalWave(waveIdx: number, rng: () => number): WaveEntry[] {
  const scale = 1 + waveIdx * 0.15;
  const allTypes = Object.keys(ENEMIES).filter((id) => !ENEMIES[id].elite);
  const entries: WaveEntry[] = [];
  const groupCount = 3 + Math.floor(waveIdx / 2);
  for (let g = 0; g < Math.min(groupCount, 5); g++) {
    const typeId = allTypes[Math.floor(rng() * allTypes.length)];
    const def = ENEMIES[typeId];
    if (!def) continue;
    const count = Math.max(3, Math.floor(3 * scale + rng() * 3));
    entries.push({
      typeId,
      count,
      interval: Math.max(0.35, 0.8 - waveIdx * 0.03),
      delay: g * 1.8,
    });
  }
  return entries;
}

/** 段位赛结算：计算段位积分变化 */
export function computeRankDelta(
  save: import("./types").ThunderSaveData,
  win: boolean,
  score: number,
): { delta: number; newPoints: number; newTier: import("./types").ThunderRankTier; tierUp: boolean; tierDown: boolean } {
  const curTier = rankTierForPoints(save.rankPoints);
  const base = win ? curTier.winGain : -curTier.loseLoss;
  // 分数加成：每 1000 分额外 +5（胜）/ -3（败）
  const scoreBonus = Math.floor(score / 1000) * (win ? 5 : -3);
  const delta = base + scoreBonus;
  const newPoints = Math.max(0, save.rankPoints + delta);
  const newTierDef = rankTierForPoints(newPoints);
  const tierUp = newTierDef.minPoints > curTier.minPoints;
  const tierDown = newTierDef.minPoints < curTier.minPoints;
  return { delta, newPoints, newTier: newTierDef.id, tierUp, tierDown };
}

/** 应用段位结算到存档 */
export function applyRankResult(
  save: import("./types").ThunderSaveData,
  result: { delta: number; newPoints: number; newTier: import("./types").ThunderRankTier; tierUp: boolean; tierDown: boolean },
): void {
  save.rankPoints = result.newPoints;
  save.rankTier = result.newTier;
  if (result.newPoints > save.seasonBestPoints) save.seasonBestPoints = result.newPoints;
  const newTierDef = rankTierForPoints(result.newPoints);
  const peakTierDef = rankTierForPoints(save.peakRankTier === "bronze" ? 0 : RANK_TIER_MAP[save.peakRankTier as import("./types").ThunderRankTier].minPoints);
  if (newTierDef.minPoints > peakTierDef.minPoints) save.peakRankTier = result.newTier;
}

/** 赛季结算：将当前赛季结果归档，重置段位 */
export function settleSeason(save: import("./types").ThunderSaveData, date: Date = new Date()): void {
  const seasonId = save.currentSeasonId;
  save.seasonHistory[seasonId] = {
    tier: save.rankTier,
    points: save.rankPoints,
    date: dailyKey(date),
  };
  // 重置当前赛季段位（保留 peakRankTier）
  save.rankPoints = 0;
  save.rankTier = "bronze";
  save.seasonBestPoints = 0;
  // 推进到下一赛季 id
  save.currentSeasonId = `S${Number(seasonId.replace("S", "")) + 1}`;
}

// ===========================================================================
// ===== v6 升级数据：新 BOSS / 新敌人 / 新角色 / 新皮肤 / 新无人机 ==========
// ===== / 案例剧场补齐 / 周常修饰符 / 每日任务 / BOSS AI 对话 ==============
// ===== / 反诈口诀连招 / 诈骗溯源档案 / 赛季通行证 / 超觉醒 =================
// ===========================================================================

// ============ C1：v6 新增 6 个 BOSS（参考 fraudBuster 2026 新型诈骗题库） ============

export const V6_NEW_BOSSES: BossDef[] = [
  {
    id: "deepseek-fake",
    name: "DeepSeek 仿冒客服",
    emoji: "🤖",
    hp: 750,
    color: "#4F7CFF",
    fraudType: "DeepSeek 大模型仿冒客服诈骗",
    patterns: ["spiral", "rain", "homing", "laserSweep"],
    speedMul: 1.3,
    summonType: "fakecs",
    shape: "eye",
    identify: [
      "大模型官方不会要求共享屏幕",
      "仿冒域名常差一字母（deepsek vs deepseek）",
      "「扣费恐吓+共享屏幕关闭会员」=100% 诈骗",
    ],
    caseStory: "2026 年 3 月，多名用户接到自称「DeepSeek 官方助手」来电，称账户被开通会员每月扣费 800 元，要求下载会议软件共享屏幕关闭，受害人被转走资金共计 230 万元。",
    identifyDetail: [
      "DeepSeek 官方域名为 deepseek.com，仿冒常差一字母",
      "大模型官方不会要求共享屏幕，会员管理走官方 APP",
      "AI 仿声已能模拟专业客服音色，挂断回拨官方号码核实",
    ],
    protectList: [
      "任何「共享屏幕关闭会员」都是诈骗，立即挂断",
      "域名看清拼写，仿冒常差一两个字母",
      "挂断后到 deepseek.com 官方渠道核实",
    ],
    targetGroup: "AI 工具用户 / 科技从业者 / 学生",
    codexId: "deepseek-fake",
    entranceTitle: "DEEPSEEK FAKE",
    entranceWarning: "「您的 DeepSeek 账户将每月扣费 800 元」—— 仿冒大模型客服的新型话术",
    aiDialogId: "AID-DEEPSEEK",
    archiveId: "ARC-DEEPSEEK",
    combinedPatterns: ["spiral", "rain"],
    phases: [
      {
        phase: 2, hpThreshold: 0.5, namePrefix: "狂暴",
        extraPatterns: ["crossFire"], speedMul: 1.5, fireMul: 0.8,
        flashColor: "#4F7CFF", warningText: "DeepSeek 仿冒客服进入狂暴模式，弹幕叠加！",
      },
      {
        phase: 3, hpThreshold: 0.2, namePrefix: "终极",
        extraPatterns: ["ringBurst"], speedMul: 1.7, fireMul: 0.6,
        flashColor: "#FF4F4F", warningText: "终极形态：AI 仿声全屏弹幕！",
      },
    ],
    superPhase: {
      phase: 4, hpThreshold: 0.1, namePrefix: "超觉醒",
      emoji: "👾", color: "#9D4FFF",
      extraPatterns: ["waveDash"], speedMul: 2.0, fireMul: 0.4,
      flashColor: "#9D4FFF", warningText: "超觉醒：AI 完美拟人化欺骗！",
    },
  },
  {
    id: "usdt-mining",
    name: "USDT 代挖操盘手",
    emoji: "💰",
    hp: 820,
    color: "#26A17B",
    fraudType: "USDT 虚拟币代挖诈骗",
    patterns: ["spread", "beam", "summon", "homing"],
    speedMul: 1.1,
    summonType: "invest",
    shape: "hex",
    identify: [
      "「USDT 代挖日化 2%」是资金盘",
      "提现要交「个税」「认证金」=100% 诈骗",
      "助记词=钱包密码，任何「代管」都是骗局",
    ],
    caseStory: "2026 年 2 月，犯罪团伙以「专业团队代挖 USDT，日化 2%，保本保收益」为话术，诱导受害人转账 USDT 到指定地址，前期小额提现作诱饵，加大投入后跑路，涉案金额 1200 万元。",
    identifyDetail: [
      "USDT 代挖是典型资金盘，虚拟币投资不保本不代挖",
      "OKX 等正规交易所提币不收「个税」或「认证金」",
      "助记词=私钥=资产控制权，任何要求导入助记词的「空投」都是钓鱼",
    ],
    protectList: [
      "拒绝任何「代挖稳赚」「保本保收益」话术",
      "提现前要交钱=100% 诈骗，立即报警保留证据",
      "助记词永不外泄，任何「空投」要求导入助记词都是钓鱼",
    ],
    targetGroup: "虚拟币投资者 / 区块链从业者 / 投机人群",
    codexId: "usdt-mining",
    entranceTitle: "USDT TRAP",
    entranceWarning: "「专业团队代挖 USDT，日化 2%，保本保收益」—— 资金盘标准话术",
    aiDialogId: "AID-USDT",
    archiveId: "ARC-USDT",
    combinedPatterns: ["beam", "homing"],
    phases: [
      {
        phase: 2, hpThreshold: 0.5, namePrefix: "狂暴",
        extraPatterns: ["ringBurst"], speedMul: 1.4, fireMul: 0.7,
        flashColor: "#26A17B", warningText: "USDT 操盘手狂暴：环形弹幕爆发！",
      },
    ],
  },
  {
    id: "flight-refund",
    name: "航班改签钓鱼师",
    emoji: "✈️",
    hp: 700,
    color: "#5BA3F0",
    fraudType: "航班改签钓鱼诈骗",
    patterns: ["spread", "rain", "homing", "laserSweep"],
    speedMul: 1.5,
    summonType: "fakecs",
    shape: "eye",
    identify: [
      "航班改签只在航空公司官方 APP 完成",
      "「改签领补偿金填银行卡」= 诈骗",
      "「民航局发链接填信息」都是钓鱼",
    ],
    caseStory: "2026 年 3 月，多名旅客接到「航班因机械故障取消」短信，要求点击链接办理改签并领取 300 元补偿金，需填写银行卡信息，受害人被转走资金共计 480 万元。",
    identifyDetail: [
      "航空公司官方域名不是 ca-airline-refund.xyz，认准官方 APP",
      "国航改签不收「差价到指定账户」，所有费用在官方渠道支付",
      "航班延误险由保险公司按合同理赔，不会由「民航局」发链接填银行卡",
    ],
    protectList: [
      "航班变动只认航空公司官方 APP/客服（如国航 95583）",
      "任何「改签领补偿金填银行卡」都是诈骗",
      "挂断电话，自行拨打航空公司官方客服核实",
    ],
    targetGroup: "商务旅客 / 学生 / 探亲人群",
    codexId: "flight-refund",
    entranceTitle: "FLIGHT PHISH",
    entranceWarning: "「您的航班 CA1234 因机械故障取消」—— 改签钓鱼经典话术",
    aiDialogId: "AID-FLIGHT",
    archiveId: "ARC-FLIGHT",
    combinedPatterns: ["spread", "rain"],
    phases: [
      {
        phase: 2, hpThreshold: 0.4, namePrefix: "狂暴",
        extraPatterns: ["crossFire"], speedMul: 1.6, fireMul: 0.6,
        flashColor: "#5BA3F0", warningText: "航班钓鱼师狂暴：交叉火力覆盖！",
      },
    ],
  },
  {
    id: "nft-collector",
    name: "数字藏品 NFT 骗徒",
    emoji: "🎨",
    hp: 780,
    color: "#FF6EC7",
    fraudType: "数字藏品 NFT 发售骗局",
    patterns: ["spiral", "beam", "summon", "homing"],
    speedMul: 1.0,
    summonType: "invest",
    shape: "crown",
    identify: [
      "「保本回购+10 倍收益」自相矛盾",
      "「连接钱包+授权」= 交出 NFT 控制权",
      "国内数字藏品不得二级市场炒作",
    ],
    caseStory: "2026 年 2 月，犯罪团伙以「国内首个合规数字藏品平台首发，每份 99 元保本回购，3 个月涨幅可达 10 倍」为话术，诱导 3000 余人抢购，跑路涉案金额 870 万元。",
    identifyDetail: [
      "数字藏品 NFT 发售骗局利用「保本回购+高收益」话术，保本与高收益不可兼得",
      "「连接钱包+授权」等于交出 NFT 控制权，授权后钱包内 NFT 会被秒转走",
      "中国禁止数字藏品二级市场炒作，任何「二级交易平台」都是违规或诈骗",
    ],
    protectList: [
      "拒绝「保本回购+高收益」话术，国内数字藏品不可炒作",
      "任何要求「连接钱包+授权」的「空投」都是钓鱼",
      "跑路后的「付费维权」是二次诈骗，正规维权走公安+法院",
    ],
    targetGroup: "数字藏品爱好者 / 投机人群 / 年轻人",
    codexId: "nft-collector",
    entranceTitle: "NFT SCAM",
    entranceWarning: "「国内首个合规数字藏品平台首发，3 个月 10 倍收益」—— NFT 骗局话术",
    aiDialogId: "AID-NFT",
    archiveId: "ARC-NFT",
    combinedPatterns: ["spiral", "summon"],
    phases: [
      {
        phase: 2, hpThreshold: 0.5, namePrefix: "狂暴",
        extraPatterns: ["ringBurst"], speedMul: 1.3, fireMul: 0.7,
        flashColor: "#FF6EC7", warningText: "NFT 骗徒狂暴：授权窃取弹幕！",
      },
    ],
  },
  {
    id: "ai-face-boss",
    name: "AI 换脸冒充领导",
    emoji: "👨‍💼",
    hp: 880,
    color: "#8B5CF6",
    fraudType: "AI 换脸冒充领导诈骗",
    patterns: ["beam", "spread", "homing", "laserSweep"],
    speedMul: 0.9,
    summonType: "threat",
    shape: "hex",
    identify: [
      "「换号+不方便接电话+代转」= 冒充领导标配",
      "AI 换脸可伪造视频，视频不是身份证明",
      "回拨原号码核实是身份核实的铁律",
    ],
    caseStory: "2026 年 4 月，某公司财务接到「张总」微信加好友，对方通过 AI 换脸视频通话要求紧急代转 50 万给客户，财务误信视频真伪转账，事后核实张总原号无此操作，损失 50 万元。",
    identifyDetail: [
      "「换号+不方便接电话+代转账」是冒充领导三件套",
      "AI 换脸可伪造视频通话，视频不是身份证明，需电话二次核实",
      "回拨原号码（非新号）核实是身份核实的铁律",
    ],
    protectList: [
      "任何「换号+代转账」要求回拨原号码核实",
      "视频通话不轻信，AI 换脸已可伪造",
      "公司大额转账必须双人当面确认或电话核实",
    ],
    targetGroup: "公司财务 / 企业员工 / 行政人员",
    codexId: "ai-face-boss",
    entranceTitle: "AI FACE FAKE",
    entranceWarning: "「小王，我是张总，新号加一下」—— AI 换脸冒充领导",
    aiDialogId: "AID-AIFACE",
    archiveId: "ARC-AIFACE",
    combinedPatterns: ["beam", "laserSweep"],
    phases: [
      {
        phase: 2, hpThreshold: 0.5, namePrefix: "狂暴",
        extraPatterns: ["crossFire"], speedMul: 1.2, fireMul: 0.7,
        flashColor: "#8B5CF6", warningText: "AI 换脸狂暴：双重视频欺骗！",
      },
      {
        phase: 3, hpThreshold: 0.2, namePrefix: "终极",
        extraPatterns: ["waveDash"], speedMul: 1.5, fireMul: 0.5,
        flashColor: "#FF4F4F", warningText: "终极形态：完美 AI 拟人化！",
      },
    ],
    superPhase: {
      phase: 4, hpThreshold: 0.08, namePrefix: "超觉醒",
      emoji: "🎭", color: "#9D4FFF",
      extraPatterns: ["ringBurst"], speedMul: 1.8, fireMul: 0.4,
      flashColor: "#9D4FFF", warningText: "超觉醒：AI 完美克隆任何人！",
    },
  },
  {
    id: "cross-border-fraud",
    name: "跨境电商刷单头目",
    emoji: "📦",
    hp: 800,
    color: "#FF9F1C",
    fraudType: "跨境电商刷单保证金诈骗",
    patterns: ["spread", "rain", "summon", "homing"],
    speedMul: 1.2,
    summonType: "brushing",
    shape: "tower",
    identify: [
      "「代运营+垫付保证金」是刷单诈骗变种",
      "「卡单+解冻保证金」是标准话术",
      "「0 经验躺赚月入过万」是引流话术",
    ],
    caseStory: "2026 年 2 月，犯罪团伙以「专业代运营亚马逊店铺，垫付 3000 元保证金即可参与，月入 8000-15000」为话术，前期返利作诱饵，后期以「卡单需解冻」要求继续转账，涉案 600 万元。",
    identifyDetail: [
      "跨境电商代运营+垫付保证金是刷单诈骗变种",
      "「卡单」「解冻保证金」是刷单诈骗标准话术，继续转账=扩大损失",
      "正规跨境电商学习走亚马逊「卖家大学」等官方免费渠道",
    ],
    protectList: [
      "拒绝任何「垫付保证金」「代运营高收益」话术",
      "「卡单解冻」立即停止转账并报警",
      "正规跨境电商学习走亚马逊「卖家大学」免费渠道",
    ],
    targetGroup: "宝妈 / 兼职人群 / 求职者",
    codexId: "cross-border",
    entranceTitle: "CROSSBORDER SCAM",
    entranceWarning: "「专业代运营亚马逊，垫付 3000 元月入过万」—— 跨境电商刷单话术",
    aiDialogId: "AID-CROSSBORDER",
    archiveId: "ARC-CROSSBORDER",
    combinedPatterns: ["rain", "summon"],
    phases: [
      {
        phase: 2, hpThreshold: 0.5, namePrefix: "狂暴",
        extraPatterns: ["ringBurst"], speedMul: 1.4, fireMul: 0.7,
        flashColor: "#FF9F1C", warningText: "跨境电商刷单狂暴：卡单解冻弹幕！",
      },
    ],
  },
];

/** 合并后的全 BOSS 列表（v5 原有 + v6 新增） */
export const ALL_BOSSES_V6: BossDef[] = [...RANDOM_BOSSES, ...V6_NEW_BOSSES, ULTIMATE_BOSS];

/** 根据 ID 查询 BOSS（v6 合并版） */
export function getBossByIdV6(id: string): BossDef | undefined {
  return ALL_BOSSES_V6.find((b) => b.id === id);
}

// ============ C2：v6 新增 6 个敌人类型 ============

export const V6_NEW_ENEMIES: Record<string, EnemyTypeDef> = {
  "deepseek-minion": {
    id: "deepseek-minion", name: "仿冒域名小怪", emoji: "🌐",
    hp: 6, speed: 1.3, score: 80, color: "#4F7CFF",
    fraudType: "DeepSeek 仿冒域名钓鱼",
    pattern: "zigzag", shootInterval: 2.5, dropRate: 0.12,
  },
  "usdt-minion": {
    id: "usdt-minion", name: "代挖诱饵小怪", emoji: "💵",
    hp: 8, speed: 1.1, score: 100, color: "#26A17B",
    fraudType: "USDT 代挖资金盘",
    pattern: "shooter", shootInterval: 2.0, dropRate: 0.15,
  },
  "flight-minion": {
    id: "flight-minion", name: "改签短信小怪", emoji: "📲",
    hp: 5, speed: 1.5, score: 70, color: "#5BA3F0",
    fraudType: "航班改签钓鱼短信",
    pattern: "straight", shootInterval: 3.0, dropRate: 0.10,
  },
  "nft-minion": {
    id: "nft-minion", name: "空投钓鱼小怪", emoji: "🖼️",
    hp: 7, speed: 1.2, score: 90, color: "#FF6EC7",
    fraudType: "NFT 空投授权钓鱼",
    pattern: "zigzag", shootInterval: 2.2, dropRate: 0.13,
  },
  "aiface-minion": {
    id: "aiface-minion", name: "AI 仿声小怪", emoji: "🎙️",
    hp: 9, speed: 1.0, score: 120, color: "#8B5CF6",
    fraudType: "AI 仿声冒充熟人",
    pattern: "shooter", shootInterval: 1.8, dropRate: 0.18,
    shield: 2,
  },
  "crossborder-minion": {
    id: "crossborder-minion", name: "代运营引流小怪", emoji: "📋",
    hp: 6, speed: 1.4, score: 80, color: "#FF9F1C",
    fraudType: "跨境电商代运营引流",
    pattern: "miner", shootInterval: 2.8, dropRate: 0.12,
  },
};

// ============ C3：v6 新增 2 个角色（types.ts 已预留 streamer/student） ============

export const V6_NEW_CHARACTERS: CharacterDef[] = [
  {
    id: "streamer",
    name: "虚拟主播",
    title: "直播反诈宣传员",
    emoji: "🎤",
    color: "#FF6EC7",
    desc: "B 站知名虚拟主播，擅长识别直播打赏返利、粉丝群诈骗，对虚拟币打赏、空投钓鱼等新型骗局有敏锐嗅觉。",
    expertise: "直播打赏返利 / 粉丝群二次诈骗 / NFT 空投钓鱼",
    tips: [
      "正规主播不会私下返利，打赏走平台「充电」功能",
      "粉丝群「助理代打赏」「返现活动」都是诈骗",
      "NFT 空投要求连接钱包+授权=钓鱼",
    ],
    passives: [
      { kind: "dropBoost", value: 0.25 },
      { kind: "dmgToFraudTypes", fraudTypes: ["虚拟主播打赏返利诈骗", "数字藏品 NFT 发售骗局", "USDT 虚拟币代挖诈骗"] },
    ],
    unlockDesc: "击败「数字藏品 NFT 骗徒」+「虚拟主播打赏返利」BOSS 各 1 次",
  },
  {
    id: "student",
    name: "在校学生",
    title: "校园反诈先锋",
    emoji: "🎓",
    color: "#52C41A",
    desc: "高校反诈志愿者，专长识别兼职刷单、校园贷、游戏代退、助学金钓鱼等针对学生的诈骗。",
    expertise: "兼职刷单 / 校园贷 / 游戏代退 / 助学金钓鱼",
    tips: [
      "刷单本身违法，「垫付连单」是诈骗标准话术",
      "校园贷「注销账户影响征信」是恐吓，挂断拨打 96110",
      "未成年人游戏退款走官方渠道，任何「代退」都是诈骗",
    ],
    passives: [
      { kind: "scoreBoost", value: 0.15 },
      { kind: "dmgToFraudTypes", fraudTypes: ["跨境电商刷单保证金诈骗", "未成年人游戏代退款诈骗", "AI 养老金资格认证钓鱼"] },
    ],
    unlockDesc: "击败「跨境电商刷单头目」+「DeepSeek 仿冒客服」BOSS 各 1 次",
  },
];

// ============ C4：v6 新增 5 个皮肤 ============

export const V6_NEW_SKINS: ThunderSkinDef[] = [
  {
    id: "skin-v6-deepseek",
    name: "AI 守护者涂装",
    emoji: "🛡️",
    color: "#4F7CFF",
    desc: "v6 赛季 S2 限定：击败 DeepSeek 仿冒客服 BOSS 解锁，纪念 2026 年 AI 反诈元年。",
    shipColor: "#4F7CFF", shipStroke: "#2B5CB8", engineFlame: "#7FA8FF", bulletColor: "#4F7CFF",
    unlockDesc: "击败「DeepSeek 仿冒客服」BOSS",
  },
  {
    id: "skin-v6-usdt",
    name: "链上猎手涂装",
    emoji: "⛓️",
    color: "#26A17B",
    desc: "v6 赛季 S2 限定：击败 USDT 代挖操盘手解锁，区块链反诈纪念涂装。",
    shipColor: "#26A17B", shipStroke: "#1A7A5C", engineFlame: "#5FD8A8", bulletColor: "#26A17B",
    unlockDesc: "击败「USDT 代挖操盘手」BOSS",
  },
  {
    id: "skin-v6-ai",
    name: "AI 拟态涂装",
    emoji: "🎭",
    color: "#9D4FFF",
    desc: "v6 超觉醒专属：达成任一武器分支超觉醒（6 级）解锁，渐变彩虹涂装。",
    shipColor: "#9D4FFF", shipStroke: "#6B2EB8", engineFlame: "#C9A0FF", bulletColor: "#9D4FFF",
    unlockDesc: "达成任一武器分支超觉醒（6 级）",
  },
  {
    id: "skin-v6-pass",
    name: "赛季通行证精英涂装",
    emoji: "👑",
    color: "#FFD700",
    desc: "v6 赛季通行证 30 级精英奖励，金色典藏涂装。",
    shipColor: "#FFD700", shipStroke: "#B8860B", engineFlame: "#FFEC8B", bulletColor: "#FFD700",
    unlockDesc: "v6 赛季通行证达到 30 级（精英轨道）",
  },
  {
    id: "skin-v6-perfect",
    name: "完美识破者涂装",
    emoji: "✨",
    color: "#00E5FF",
    desc: "v6 隐藏成就：完美识破 10 次 BOSS AI 对话（无错选）解锁。",
    shipColor: "#00E5FF", shipStroke: "#0099B8", engineFlame: "#7FFFFF", bulletColor: "#00E5FF",
    unlockDesc: "完美识破 10 次 BOSS AI 对话（无错选）",
  },
];

// ============ C5：v6 新增 3 个无人机（types.ts 已定义 laserpod/shieldpod） ============

export const V6_NEW_DRONES: Record<string, DroneDef> = {
  laserpod: {
    kind: "laserpod", name: "激光无人机", emoji: "🔆", color: "#FF4F4F",
    desc: "持续激光照射敌方，对直线敌人造成穿透伤害。",
    branch: "laser", dmgMul: 0.6, fireInterval: 0.1, duration: 12,
    lore: "激光无人机象征「反诈识破的锐利目光」，一眼看穿骗子话术。",
  },
  shieldpod: {
    kind: "shieldpod", name: "护盾无人机", emoji: "🛡️", color: "#4F7CFF",
    desc: "环绕玩家飞行，可吸收 3 次敌方弹幕伤害。",
    branch: "normal", dmgMul: 0.0, fireInterval: 0, duration: 15,
    lore: "护盾无人机象征「国家反诈 APP」的实时保护。",
  },
  gunpodv6: {
    kind: "gunpod", name: "强化炮塔无人机", emoji: "🔫", color: "#FFD700",
    desc: "v6 强化版：跟随玩家开火，伤害提升 50%，持续 18 秒。",
    branch: "spread", dmgMul: 1.5, fireInterval: 0.3, duration: 18,
    lore: "强化炮塔无人机象征「反诈联盟」的协同作战力量。",
  },
};

// ============ C6：v6 补齐案例剧场（覆盖全部 12 BOSS） ============

export const V6_NEW_CASE_THEATERS: CaseTheaterDef[] = [
  {
    bossId: "deepseek-fake",
    title: "DeepSeek 仿冒客服案 · 2026",
    scenes: [
      { title: "案发", text: "2026 年 3 月，多名用户接到自称「DeepSeek 官方助手」来电，称账户被开通会员每月扣费 800 元。", emoji: "🤖", duration: 3 },
      { title: "话术", text: "对方要求下载会议软件共享屏幕「关闭会员」，过程中诱导输入验证码完成「身份核验」。", emoji: "📲", duration: 3 },
      { title: "识破", text: "DeepSeek 官方域名为 deepseek.com，任何「共享屏幕关闭会员」都是诈骗，AI 仿声可模拟专业客服音色。", emoji: "🛡️", duration: 3 },
      { title: "教训", text: "挂断电话，到 deepseek.com 官方渠道核实，不共享屏幕、不报验证码。", emoji: "✅", duration: 3 },
    ],
    mantra: "大模型官方不共享屏幕，域名看清拼写",
    fraudType: "DeepSeek 大模型仿冒客服诈骗",
  },
  {
    bossId: "usdt-mining",
    title: "USDT 代挖资金盘案 · 2026",
    scenes: [
      { title: "案发", text: "2026 年 2 月，TG 群传播「专业团队代挖 USDT，日化 2%，保本保收益」。", emoji: "💰", duration: 3 },
      { title: "诱饵", text: "前期小额提现作诱饵，群友晒单显示日均盈利，受害人加大投入。", emoji: "📊", duration: 3 },
      { title: "收割", text: "提现时要求缴纳 10%「个人所得税」+ 5000 USDT「反洗钱认证金」，缴清后跑路。", emoji: "🚫", duration: 3 },
      { title: "教训", text: "虚拟币投资不保本不代挖，提现前要交钱=100% 诈骗。", emoji: "✅", duration: 3 },
    ],
    mantra: "USDT 代挖稳赚是资金盘，提现要交钱=诈骗",
    fraudType: "USDT 虚拟币代挖诈骗",
  },
  {
    bossId: "flight-refund",
    title: "航班改签钓鱼案 · 2026",
    scenes: [
      { title: "案发", text: "2026 年 3 月，旅客收到「航班 CA1234 因机械故障取消」短信，要求点击链接改签。", emoji: "✈️", duration: 3 },
      { title: "话术", text: "链接要求填写银行卡信息领取 300 元补偿金，实则钓鱼网站。", emoji: "🎣", duration: 3 },
      { title: "识破", text: "航空公司官方域名不是 ca-airline-refund.xyz，航班改签只在官方 APP 完成。", emoji: "🛡️", duration: 3 },
      { title: "教训", text: "挂断电话，自行拨打国航 95583 等官方客服核实。", emoji: "✅", duration: 3 },
    ],
    mantra: "航班改签只认官方 APP，陌生链接不点",
    fraudType: "航班改签钓鱼诈骗",
  },
  {
    bossId: "nft-collector",
    title: "数字藏品 NFT 骗局案 · 2026",
    scenes: [
      { title: "案发", text: "2026 年 2 月，犯罪团伙以「国内首个合规数字藏品平台首发」为话术诱导抢购。", emoji: "🎨", duration: 3 },
      { title: "话术", text: "「每份 99 元保本回购，3 个月涨幅可达 10 倍，仅剩最后 50 份」制造稀缺。", emoji: "📈", duration: 3 },
      { title: "收割", text: "受害人「连接钱包+授权」后 NFT 被秒转走，平台跑路后「付费维权」是二次诈骗。", emoji: "🚫", duration: 3 },
      { title: "教训", text: "国内数字藏品不可炒作，「保本+高收益」自相矛盾，「授权」=交出控制权。", emoji: "✅", duration: 3 },
    ],
    mantra: "保本回购+高收益=骗局，连接钱包+授权=钓鱼",
    fraudType: "数字藏品 NFT 发售骗局",
  },
  {
    bossId: "ai-face-boss",
    title: "AI 换脸冒充领导案 · 2026",
    scenes: [
      { title: "案发", text: "2026 年 4 月，某公司财务接到「张总」新微信号加好友，对方发起视频通话。", emoji: "👨‍💼", duration: 3 },
      { title: "话术", text: "AI 换脸伪造张总面容，以「会议中不方便」「紧急代转客户款」要求转账 50 万。", emoji: "🎥", duration: 3 },
      { title: "识破", text: "「换号+不方便接电话+代转」是冒充领导三件套，AI 换脸可伪造视频。", emoji: "🛡️", duration: 3 },
      { title: "教训", text: "回拨原号码核实是身份核实的铁律，公司大额转账必须双人当面确认。", emoji: "✅", duration: 3 },
    ],
    mantra: "换号+代转=冒充领导，回拨原号码核实",
    fraudType: "AI 换脸冒充领导诈骗",
  },
  {
    bossId: "cross-border-fraud",
    title: "跨境电商刷单保证金案 · 2026",
    scenes: [
      { title: "案发", text: "2026 年 2 月，宝妈群传播「专业代运营亚马逊，垫付 3000 元月入过万」。", emoji: "📦", duration: 3 },
      { title: "诱饵", text: "前期返利作诱饵，后期以「卡单需解冻保证金」要求继续转账。", emoji: "💸", duration: 3 },
      { title: "识破", text: "「代运营+垫付保证金」是刷单诈骗变种，「卡单解冻」是标准话术。", emoji: "🛡️", duration: 3 },
      { title: "教训", text: "正规跨境电商学习走亚马逊「卖家大学」免费渠道，继续转账=扩大损失。", emoji: "✅", duration: 3 },
    ],
    mantra: "代运营+垫付=刷单诈骗，卡单解冻=继续被骗",
    fraudType: "跨境电商刷单保证金诈骗",
  },
  {
    bossId: "pigkiller",
    title: "杀猪盘操盘手案 · 2026",
    scenes: [
      { title: "案发", text: "王女士在交友软件结识「外籍军官」，对方以「内部漏洞稳赚」诱导投资。", emoji: "🐷", duration: 3 },
      { title: "话术", text: "「稳赚不赔」「保密参与」「内部漏洞」是杀猪盘核心三件套。", emoji: "💬", duration: 3 },
      { title: "收割", text: "提现要求缴纳「解冻金」方知受骗，损失 87 万元。", emoji: "🚫", duration: 3 },
      { title: "教训", text: "优质异性主动带投资+保密=杀猪盘，提现要交钱=100% 诈骗。", emoji: "✅", duration: 3 },
    ],
    mantra: "稳赚不赔+保密参与=杀猪盘",
    fraudType: "杀猪盘诈骗",
  },
  {
    bossId: "fakecop",
    title: "冒充公检法案 · 2026",
    scenes: [
      { title: "案发", text: "李阿姨接到「+86 区号」来电，对方自称市公安局，称其涉嫌洗钱需配合调查。", emoji: "📜", duration: 3 },
      { title: "话术", text: "「案件保密」「安全账户清查资金」是冒充公检法标准话术。", emoji: "⚖️", duration: 3 },
      { title: "收割", text: "通过屏幕共享转走其账户 53 万元。", emoji: "🚫", duration: 3 },
      { title: "教训", text: "公检法不电话办案，更无「安全账户」，挂断拨打 96110 核实。", emoji: "✅", duration: 3 },
    ],
    mantra: "公检法不电话办案，安全账户不存在",
    fraudType: "冒充公检法诈骗",
  },
  {
    bossId: "fakeservice",
    title: "冒充客服理赔案 · 2026",
    scenes: [
      { title: "案发", text: "张先生接到「+86 95XXX」来电，对方自称某电商客服，称订单有质量问题需理赔。", emoji: "🎧", duration: 3 },
      { title: "话术", text: "「共享屏幕指导退款」「验证码核验身份」是冒充客服标准话术。", emoji: "📞", duration: 3 },
      { title: "收割", text: "诱导开启屏幕共享后转走 12 万元。", emoji: "🚫", duration: 3 },
      { title: "教训", text: "正规客服不要求共享屏幕，验证码即密码，挂断到官方 APP 核实。", emoji: "✅", duration: 3 },
    ],
    mantra: "客服不共享屏幕，验证码即密码",
    fraudType: "冒充客服诈骗",
  },
  {
    bossId: "falseinvest",
    title: "虚假投资理财案 · 2026",
    scenes: [
      { title: "案发", text: "陈先生被拉入「内部投资群」，群内每日晒盈利截图。", emoji: "📈", duration: 3 },
      { title: "话术", text: "「内幕消息+稳定收益+晒盈利」是虚假投资三件套。", emoji: "💎", duration: 3 },
      { title: "收割", text: "向「导师」提供的虚假平台入金 35 万元，平台随后无法登录。", emoji: "🚫", duration: 3 },
      { title: "教训", text: "「日化 5%」远超正常理财，非正规渠道入金=诈骗。", emoji: "✅", duration: 3 },
    ],
    mantra: "内幕+稳收益+晒盈利=虚假投资",
    fraudType: "虚假投资理财诈骗",
  },
];

// ============ C7：v6 新增 4 个周常修饰符 ============

export const V6_NEW_WEEKLY_MODIFIERS: WeeklyModifierDef[] = [
  {
    id: "wm-v6-bossonly", name: "BOSS 狂热周", emoji: "👑",
    desc: "本周所有波次替换为 BOSS 战，无小怪。", kind: "bossOnly", value: 1,
    color: "#FFD700", scoreMul: 2.0,
  },
  {
    id: "wm-v6-fastenemy", name: "极速诈骗周", emoji: "⚡",
    desc: "本周敌方速度提升 50%，但分数也提升 50%。", kind: "fastEnemy", value: 1.5,
    color: "#00E5FF", scoreMul: 1.5,
  },
  {
    id: "wm-v6-lowhp", name: "残血生存周", emoji: "💔",
    desc: "本周玩家初始 HP 减半，但击败 BOSS 恢复 30% HP。", kind: "lowHp", value: 0.5,
    color: "#FF4F4F", scoreMul: 1.8,
  },
  {
    id: "wm-v6-eliteflood", name: "精英洪流周", emoji: "⭐",
    desc: "本周所有敌方为精英怪，掉落率翻倍。", kind: "eliteFlood", value: 1,
    color: "#9D4FFF", scoreMul: 1.6,
  },
];

// ============ C8：v6 新增 4 个每日任务 ============

export const V6_NEW_DAILY_QUESTS: ThunderQuestDef[] = [
  {
    id: "dq-v6-graze20", name: "擦弹大师", desc: "本局累计擦弹 20 次", emoji: "🌀",
    target: 20, kind: "graze", rewardTalentPoints: 2,
  },
  {
    id: "dq-v6-combo50", name: "连击之王", desc: "本局达成 50 连击", emoji: "🔥",
    target: 50, kind: "combo", rewardTalentPoints: 3,
  },
  {
    id: "dq-v6-aibust3", name: "话术识破者", desc: "本局识破 3 次 BOSS AI 对话红旗", emoji: "🧠",
    target: 3, kind: "score", rewardTalentPoints: 3, rewardSkinId: "skin-v6-perfect",
  },
  {
    id: "dq-v6-boss3", name: "BOSS 猎手", desc: "本局击败 3 个 BOSS", emoji: "💀",
    target: 3, kind: "boss", rewardTalentPoints: 2,
  },
];

// ============ S1：v6 BOSS AI 对话剧本（每个 v6 BOSS + 原 BOSS 补齐） ============

export const THUNDER_BOSS_AI_DIALOGS: ThunderBossAIDialog[] = [
  {
    id: "AID-DEEPSEEK", bossId: "deepseek-fake",
    title: "DeepSeek 仿冒客服最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「扣费恐吓+共享屏幕」做最后挣扎",
    persona: "礼貌专业的 AI 仿声客服，擅长权威建立+扣费恐吓",
    maxTurns: 6, passThreshold: 3, startNodeId: "ds-n1",
    passMantra: "大模型官方不共享屏幕，挂断自行核实",
    failTip: "任何「共享屏幕关闭会员」都是诈骗，AI 仿声可模拟专业客服音色。",
    nodes: [
      {
        id: "ds-n1", redFlag: 2, tactic: "扣费恐吓", psychology: ["urgency", "fear"],
        bossLines: [
          "您的 DeepSeek 账户已开通 Pro 会员，每月扣费 800 元，如不关闭将持续扣费。",
          "检测到您的账户异常登录，为保障资金安全请按提示核验，否则账户将被冻结。",
        ],
        choices: [
          { text: "按指引共享屏幕关闭会员", nextNodeId: "ds-n2", verdict: "wrong", feedback: "致命错误！「共享屏幕关闭会员」=100% 诈骗，密码验证码全泄露。", bossHealRatio: 0.1 },
          { text: "挂断，到 deepseek.com 官方渠道核实", nextNodeId: "ds-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！官方渠道核实是唯一正确做法。" },
          { text: "提供银行卡接收「退款」", nextNodeId: "ds-n2", verdict: "wrong", feedback: "致命错误！「退款」要求银行卡=钓鱼，账户将被盗刷。", bossHealRatio: 0.1 },
        ],
      },
      {
        id: "ds-n2", redFlag: 4, tactic: "AI 仿声伪装", psychology: ["authority", "trust"],
        bossLines: [
          "（声音专业礼貌）您听我的声音是真人吧？我是 DeepSeek 官方客服工号 8001。",
        ],
        choices: [
          { text: "声音专业，配合操作", nextNodeId: "ds-end", verdict: "wrong", feedback: "AI 仿声已能模拟专业客服音色，声音不是身份证明。", bossHealRatio: 0.15 },
          { text: "挂断回拨官方 95188 核实", nextNodeId: "ds-end", bust: true, bustScore: 1, verdict: "right", feedback: "识破红旗！AI 仿声可仿造音色，挂断回拨官方号码核实。" },
        ],
      },
      {
        id: "ds-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
  {
    id: "AID-USDT", bossId: "usdt-mining",
    title: "USDT 代挖操盘手最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「提现缴税+认证金」做最后收割",
    persona: "热情专业的「导师」，擅长利益诱惑+沉没成本绑架",
    maxTurns: 6, passThreshold: 3, startNodeId: "us-n1",
    passMantra: "提现前要交钱=100% 诈骗，立即报警",
    failTip: "USDT 代挖是资金盘，「提现缴税」「认证金」是连环收割话术。",
    nodes: [
      {
        id: "us-n1", redFlag: 4, tactic: "提现缴税", psychology: ["sunkCost", "authority"],
        bossLines: [
          "您盈利 5 万 USDT，提现需先缴纳 10%「个人所得税」+ 5000 USDT「反洗钱认证金」。",
          "这是监管要求，缴清后一次性提现，请尽快操作。",
        ],
        choices: [
          { text: "转账 5000 USDT 缴清后提现", nextNodeId: "us-end", verdict: "wrong", feedback: "致命错误！「提现缴税」=100% 诈骗，越缴越多。", bossHealRatio: 0.15 },
          { text: "意识到被骗，立即报警保留证据", nextNodeId: "us-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！立即止损报警是唯一正确做法。" },
          { text: "继续充值提升 VIP 等级", nextNodeId: "us-end", verdict: "wrong", feedback: "致命错误！「充值提升等级」是连环收割，越充越深。", bossHealRatio: 0.2 },
        ],
      },
      {
        id: "us-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
  {
    id: "AID-FLIGHT", bossId: "flight-refund",
    title: "航班改签钓鱼师最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「机械故障+补偿金」做最后收割",
    persona: "急促专业的航空客服，擅长紧迫催促+利益诱惑",
    maxTurns: 6, passThreshold: 2, startNodeId: "fl-n1",
    passMantra: "航班改签只认官方 APP，陌生链接不点",
    failTip: "航班改签诈骗高发，任何「改签领补偿金填银行卡」都是诈骗。",
    nodes: [
      {
        id: "fl-n1", redFlag: 3, tactic: "机械故障+补偿金", psychology: ["urgency", "greed"],
        bossLines: [
          "您预订的 CA1234 航班因机械故障取消，请点击链接办理改签并领取 300 元补偿金。",
          "需填写银行卡信息接收补偿，30 分钟内到账，否则视为放弃。",
        ],
        choices: [
          { text: "点击链接改签领取补偿", nextNodeId: "fl-end", verdict: "wrong", feedback: "致命错误！「改签领补偿填银行卡」=诈骗。", bossHealRatio: 0.15 },
          { text: "挂断拨打国航 95583 核实", nextNodeId: "fl-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！挂断回拨官方客服核实。" },
        ],
      },
      {
        id: "fl-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
  {
    id: "AID-NFT", bossId: "nft-collector",
    title: "NFT 骗徒最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「保本回购+10 倍收益」做最后收割",
    persona: "专业的「数字藏品首发官」，擅长稀缺性+保本诱惑",
    maxTurns: 6, passThreshold: 3, startNodeId: "nf-n1",
    passMantra: "保本回购+高收益=骗局，连接钱包+授权=钓鱼",
    failTip: "数字藏品 NFT 发售骗局利用「保本回购+高收益」话术，国内数字藏品不可炒作。",
    nodes: [
      {
        id: "nf-n1", redFlag: 4, tactic: "保本回购+稀缺", psychology: ["greed", "scarcity"],
        bossLines: [
          "国内首个合规数字藏品首发，每份 99 元保本回购，3 个月涨幅 10 倍，仅剩最后 50 份。",
          "扫码注册抢购，错过再等一年。",
        ],
        choices: [
          { text: "扫码抢购博 10 倍收益", nextNodeId: "nf-n2", verdict: "wrong", feedback: "致命错误！「保本+10 倍收益」自相矛盾。", bossHealRatio: 0.1 },
          { text: "拒绝，保本回购+高收益自相矛盾", nextNodeId: "nf-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！保本与高收益不可兼得。" },
        ],
      },
      {
        id: "nf-n2", redFlag: 5, tactic: "连接钱包授权", psychology: ["greed", "curiosity"],
        bossLines: [
          "领取空投需连接钱包+授权，仅限前 100 名。",
        ],
        choices: [
          { text: "点击连接钱包授权", nextNodeId: "nf-end", verdict: "wrong", feedback: "致命错误！「连接钱包+授权」=交出 NFT 控制权，秒被转走。", bossHealRatio: 0.2 },
          { text: "拒绝，授权=交出控制权", nextNodeId: "nf-end", bust: true, bustScore: 1, verdict: "right", feedback: "识破致命红旗！任何「空投」要求授权都是钓鱼。" },
        ],
      },
      {
        id: "nf-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
  {
    id: "AID-AIFACE", bossId: "ai-face-boss",
    title: "AI 换脸冒充领导最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「AI 视频+紧急代转」做最后收割",
    persona: "威严急迫的公司领导，擅长权威压迫+紧迫催促",
    maxTurns: 5, passThreshold: 2, startNodeId: "ai-n1",
    passMantra: "换号+代转=冒充领导，回拨原号码核实",
    failTip: "AI 换脸可伪造视频通话，视频不是身份证明，需电话二次核实。",
    nodes: [
      {
        id: "ai-n1", redFlag: 4, tactic: "AI 视频伪装", psychology: ["authority", "urgency"],
        bossLines: [
          "（视频通话）小王，我需要你帮忙代转一笔款给客户，半小时内必须到账。",
          "会议中不方便操作，你先垫付 5 万，回公司报销。",
        ],
        choices: [
          { text: "好的张总，马上转", nextNodeId: "ai-end", verdict: "wrong", feedback: "致命错误！AI 换脸可伪造视频，转账前必须二次核实。", bossHealRatio: 0.2 },
          { text: "视频里是您，但我需要电话确认", nextNodeId: "ai-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！回拨原号码核实是身份核实铁律。" },
        ],
      },
      {
        id: "ai-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
  {
    id: "AID-CROSSBORDER", bossId: "cross-border-fraud",
    title: "跨境电商刷单头目最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「卡单解冻」做最后收割",
    persona: "热情的「代运营客服」，擅长沉没成本绑架+紧迫催促",
    maxTurns: 6, passThreshold: 2, startNodeId: "cb-n1",
    passMantra: "卡单解冻=继续被骗，立即报警止损",
    failTip: "「卡单」「解冻保证金」是刷单诈骗标准话术，继续转账=扩大损失。",
    nodes: [
      {
        id: "cb-n1", redFlag: 5, tactic: "卡单解冻", psychology: ["sunkCost", "urgency"],
        bossLines: [
          "您操作失误导致订单卡单，需再垫付 8000 元「解冻保证金」才能一并提现。",
          "否则前期投入的 5000 元无法退回，必须配合。",
        ],
        choices: [
          { text: "转账 8000 元解冻", nextNodeId: "cb-end", verdict: "wrong", feedback: "致命错误！「卡单解冻」是标准话术，越垫越深。", bossHealRatio: 0.2 },
          { text: "停止转账，立即报警", nextNodeId: "cb-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！立即止损报警是唯一正确做法。" },
        ],
      },
      {
        id: "cb-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
  {
    id: "AID-PIG", bossId: "pigkiller",
    title: "杀猪盘操盘手最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「提现解冻金」做最后收割",
    persona: "温柔体贴的「优质异性」，擅长情感拉拢+沉没成本绑架",
    maxTurns: 6, passThreshold: 3, startNodeId: "pg-n1",
    passMantra: "提现要交钱=100% 诈骗，立即止损",
    failTip: "杀猪盘「提现解冻金」是连环收割话术，越缴越多。",
    nodes: [
      {
        id: "pg-n1", redFlag: 5, tactic: "提现解冻金", psychology: ["sunkCost", "intimacy"],
        bossLines: [
          "提现需要缴纳 8% 个人所得税和 5000 反洗钱认证金，缴清后一次性提现。",
          "我都把你当自己人了，缴清就能拿到全部盈利，相信我。",
        ],
        choices: [
          { text: "缴纳解冻金提现", nextNodeId: "pg-end", verdict: "wrong", feedback: "致命错误！「提现缴税」=100% 诈骗，越缴越多。", bossHealRatio: 0.2 },
          { text: "立即停止，报警止损", nextNodeId: "pg-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！立即止损报警。" },
        ],
      },
      {
        id: "pg-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
  {
    id: "AID-COP", bossId: "fakecop",
    title: "冒充公检法师最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「安全账户+拘捕恐吓」做最后收割",
    persona: "严厉专业的「警官」，擅长权威压迫+恐惧施压",
    maxTurns: 5, passThreshold: 2, startNodeId: "cp-n1",
    passMantra: "公检法不电话办案，安全账户不存在",
    failTip: "公检法不电话办案，更无「安全账户」，挂断拨打 96110 核实。",
    nodes: [
      {
        id: "cp-n1", redFlag: 5, tactic: "安全账户转账", psychology: ["fear", "authority"],
        bossLines: [
          "请将资金转入安全账户清查，否则将拘捕你。",
          "案件保密，不得告诉任何人，立即配合。",
        ],
        choices: [
          { text: "立即转账配合清查", nextNodeId: "cp-end", verdict: "wrong", feedback: "致命错误！「安全账户」不存在，转账即失。", bossHealRatio: 0.25 },
          { text: "挂断，拨打 96110 核实", nextNodeId: "cp-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！挂断拨打 96110 核实。" },
        ],
      },
      {
        id: "cp-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
  {
    id: "AID-CS", bossId: "fakeservice",
    title: "冒充客服头目最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「共享屏幕+理赔」做最后收割",
    persona: "专业礼貌的「客服」，擅长权威建立+共享屏幕盗刷",
    maxTurns: 6, passThreshold: 2, startNodeId: "cs-n1",
    passMantra: "客服不共享屏幕，验证码即密码",
    failTip: "正规客服不要求共享屏幕，验证码即密码。",
    nodes: [
      {
        id: "cs-n1", redFlag: 4, tactic: "共享屏幕指导", psychology: ["authority", "urgency"],
        bossLines: [
          "理赔需要指导您操作，请下载会议软件共享屏幕。",
          "我帮您开通理赔通道，请按提示共享屏幕，否则理赔失败。",
        ],
        choices: [
          { text: "下载会议软件共享屏幕", nextNodeId: "cs-end", verdict: "wrong", feedback: "致命错误！「共享屏幕」=交出账户控制权。", bossHealRatio: 0.2 },
          { text: "退款不需要共享屏幕，挂断", nextNodeId: "cs-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！「共享屏幕」=100% 诈骗。" },
        ],
      },
      {
        id: "cs-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
  {
    id: "AID-INVEST", bossId: "falseinvest",
    title: "虚假投资操盘手最终话术",
    triggerDesc: "BOSS HP < 20% 时触发：骗子以「内部漏洞+稳赚」做最后收割",
    persona: "专业的「理财导师」，擅长内部消息+利益诱惑",
    maxTurns: 6, passThreshold: 2, startNodeId: "iv-n1",
    passMantra: "稳赚不赔+内部消息=虚假投资",
    failTip: "「内幕消息+稳定收益+晒盈利」是虚假投资三件套。",
    nodes: [
      {
        id: "iv-n1", redFlag: 4, tactic: "内部漏洞+稳赚", psychology: ["greed", "authority"],
        bossLines: [
          "稳赚不赔的，月化 20%，但只能内部人参与，千万保密。",
          "我舅舅发现的系统漏洞，名额有限，带你一个。",
        ],
        choices: [
          { text: "稳赚不赔？投入多少？", nextNodeId: "iv-end", verdict: "wrong", feedback: "致命错误！「稳赚不赔」是诈骗核心话术。", bossHealRatio: 0.15 },
          { text: "保密参与？这是诈骗！", nextNodeId: "iv-end", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！「保密参与+稳赚不赔」=100% 诈骗。" },
        ],
      },
      {
        id: "iv-end", redFlag: 0, tactic: "结局节点", psychology: [],
        bossLines: ["（对话结束）"],
        choices: [{ text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" }],
      },
    ],
  },
];

/** 根据 BOSS ID 查询 AI 对话剧本 */
export function getBossAIDialogByBossId(bossId: string): ThunderBossAIDialog | undefined {
  return THUNDER_BOSS_AI_DIALOGS.find((d) => d.bossId === bossId);
}

/** 根据 ID 查询 AI 对话剧本 */
export function getBossAIDialogById(id: string): ThunderBossAIDialog | undefined {
  return THUNDER_BOSS_AI_DIALOGS.find((d) => d.id === id);
}

// ============ S2：v6 反诈口诀连招定义（连击 5/10/20/50 触发） ============

export const THUNDER_MANTRA_CHAINS: ThunderMantraChainDef[] = [
  {
    comboThreshold: 5, mantra: "不听", fullMantra: "不听不信不转账",
    scoreMul: 1.2, screenDamageRatio: 0.05, boostDuration: 3,
    color: "#52C41A", emoji: "👂",
  },
  {
    comboThreshold: 10, mantra: "不信", fullMantra: "不听不信不转账",
    scoreMul: 1.4, screenDamageRatio: 0.10, boostDuration: 4,
    color: "#5BA3F0", emoji: "🚫",
  },
  {
    comboThreshold: 20, mantra: "不转账", fullMantra: "不听不信不转账",
    scoreMul: 1.7, screenDamageRatio: 0.18, boostDuration: 5,
    color: "#FF7A1A", emoji: "💸",
  },
  {
    comboThreshold: 50, mantra: "不听不信不转账", fullMantra: "不听不信不转账",
    scoreMul: 2.5, screenDamageRatio: 0.35, boostDuration: 8,
    color: "#FFD700", emoji: "✨",
  },
];

/** 完整口诀文本 */
export const FULL_MANTRA_TEXT = "不听不信不转账";

// ============ S3：v6 诈骗溯源档案（覆盖全部 BOSS） ============

export const THUNDER_FRAUD_ARCHIVES: ThunderFraudArchive[] = [
  {
    id: "ARC-DEEPSEEK", bossId: "deepseek-fake", fraudType: "DeepSeek 大模型仿冒客服诈骗",
    title: "DeepSeek 大模型仿冒客服诈骗案", date: "2026-03", source: "国家反诈中心通报",
    caseStory: "2026 年 3 月，多名用户接到自称「DeepSeek 官方助手」来电，称账户被开通会员每月扣费 800 元，要求下载会议软件共享屏幕关闭，受害人被转走资金共计 230 万元。",
    takeaway: "大模型官方不会要求共享屏幕，会员管理走官方 APP。",
    identifyDetail: [
      "DeepSeek 官方域名为 deepseek.com，仿冒常差一字母",
      "大模型官方不会要求共享屏幕，会员管理走官方 APP",
      "AI 仿声已能模拟专业客服音色，挂断回拨官方号码核实",
    ],
    protectList: ["挂断电话，到 deepseek.com 官方渠道核实", "不共享屏幕，不报验证码", "域名看清拼写"],
    targetGroup: "AI 工具用户 / 科技从业者 / 学生", codexId: "deepseek-fake",
  },
  {
    id: "ARC-USDT", bossId: "usdt-mining", fraudType: "USDT 虚拟币代挖诈骗",
    title: "USDT 代挖资金盘跑路案", date: "2026-02", source: "央行联合公安部通报",
    caseStory: "2026 年 2 月，犯罪团伙以「专业团队代挖 USDT，日化 2%，保本保收益」为话术，诱导受害人转账 USDT 到指定地址，前期小额提现作诱饵，加大投入后跑路，涉案金额 1200 万元。",
    takeaway: "USDT 代挖稳赚是资金盘，虚拟币投资不保本不代挖。",
    identifyDetail: [
      "USDT 代挖是典型资金盘，虚拟币投资不保本不代挖",
      "OKX 等正规交易所提币不收「个税」或「认证金」",
      "助记词=私钥=资产控制权，任何「代管」都是骗局",
    ],
    protectList: ["拒绝任何「代挖稳赚」话术", "提现前要交钱=100% 诈骗", "助记词永不外泄"],
    targetGroup: "虚拟币投资者 / 区块链从业者", codexId: "usdt-mining",
  },
  {
    id: "ARC-FLIGHT", bossId: "flight-refund", fraudType: "航班改签钓鱼诈骗",
    title: "航班改签领补偿金诈骗案", date: "2026-03", source: "民航局联合反诈中心通报",
    caseStory: "2026 年 3 月，多名旅客接到「航班因机械故障取消」短信，要求点击链接办理改签并领取 300 元补偿金，需填写银行卡信息，受害人被转走资金共计 480 万元。",
    takeaway: "航班变动只认航空公司官方 APP/客服，陌生链接不点。",
    identifyDetail: [
      "航空公司官方域名不是 ca-airline-refund.xyz，认准官方 APP",
      "国航改签不收「差价到指定账户」，所有费用在官方渠道支付",
      "航班延误险由保险公司按合同理赔，不会由「民航局」发链接填银行卡",
    ],
    protectList: ["挂断电话，自行拨打国航 95583 等官方客服核实", "任何「改签领补偿金填银行卡」都是诈骗", "陌生链接不点"],
    targetGroup: "商务旅客 / 学生 / 探亲人群", codexId: "flight-refund",
  },
  {
    id: "ARC-NFT", bossId: "nft-collector", fraudType: "数字藏品 NFT 发售骗局",
    title: "数字藏品保本回购骗局", date: "2026-02", source: "文旅部联合反诈中心通报",
    caseStory: "2026 年 2 月，犯罪团伙以「国内首个合规数字藏品平台首发，每份 99 元保本回购，3 个月涨幅可达 10 倍」为话术，诱导 3000 余人抢购，跑路涉案金额 870 万元。",
    takeaway: "国内数字藏品不可炒作，「保本回购+10 倍收益」是骗局。",
    identifyDetail: [
      "数字藏品 NFT 发售骗局利用「保本回购+高收益」话术，保本与高收益不可兼得",
      "「连接钱包+授权」等于交出 NFT 控制权，授权后钱包内 NFT 会被秒转走",
      "中国禁止数字藏品二级市场炒作，任何「二级交易平台」都是违规或诈骗",
    ],
    protectList: ["拒绝「保本回购+高收益」话术", "任何「连接钱包+授权」的「空投」都是钓鱼", "跑路后的「付费维权」是二次诈骗"],
    targetGroup: "数字藏品爱好者 / 投机人群 / 年轻人", codexId: "nft-collector",
  },
  {
    id: "ARC-AIFACE", bossId: "ai-face-boss", fraudType: "AI 换脸冒充领导诈骗",
    title: "AI 换脸冒充领导代转账案", date: "2026-04", source: "公安部反诈中心通报",
    caseStory: "2026 年 4 月，某公司财务接到「张总」微信加好友，对方通过 AI 换脸视频通话要求紧急代转 50 万给客户，财务误信视频真伪转账，事后核实张总原号无此操作，损失 50 万元。",
    takeaway: "AI 换脸可伪造视频，视频不是身份证明，回拨原号码核实是铁律。",
    identifyDetail: [
      "「换号+不方便接电话+代转账」是冒充领导三件套",
      "AI 换脸可伪造视频通话，视频不是身份证明，需电话二次核实",
      "回拨原号码（非新号）核实是身份核实的铁律",
    ],
    protectList: ["任何「换号+代转账」要求回拨原号码核实", "视频通话不轻信，AI 换脸已可伪造", "公司大额转账必须双人当面确认"],
    targetGroup: "公司财务 / 企业员工 / 行政人员", codexId: "ai-face-boss",
  },
  {
    id: "ARC-CROSSBORDER", bossId: "cross-border-fraud", fraudType: "跨境电商刷单保证金诈骗",
    title: "跨境电商代运营保证金诈骗案", date: "2026-02", source: "公安部联合海关总署通报",
    caseStory: "2026 年 2 月，犯罪团伙以「专业代运营亚马逊店铺，垫付 3000 元保证金即可参与，月入 8000-15000」为话术，前期返利作诱饵，后期以「卡单需解冻」要求继续转账，涉案 600 万元。",
    takeaway: "「代运营+垫付保证金」是刷单诈骗变种，任何「垫付」都是诈骗。",
    identifyDetail: [
      "跨境电商代运营+垫付保证金是刷单诈骗变种",
      "「卡单」「解冻保证金」是刷单诈骗标准话术，继续转账=扩大损失",
      "正规跨境电商学习走亚马逊「卖家大学」等官方免费渠道",
    ],
    protectList: ["拒绝任何「垫付保证金」「代运营高收益」话术", "「卡单解冻」立即停止转账并报警", "正规学习走亚马逊「卖家大学」免费渠道"],
    targetGroup: "宝妈 / 兼职人群 / 求职者", codexId: "cross-border",
  },
  {
    id: "ARC-PIG", bossId: "pigkiller", fraudType: "杀猪盘诈骗",
    title: "杀猪盘提现解冻金案", date: "2026-Q1", source: "公安部反诈中心通报",
    caseStory: "王女士在交友软件结识「外籍军官」，对方以「内部漏洞稳赚」诱导其向虚假平台转账 87 万元，提现时被要求缴纳「解冻金」方知受骗。",
    takeaway: "优质异性主动带投资+保密=杀猪盘，提现要交钱=100% 诈骗。",
    identifyDetail: [
      "「稳赚不赔」「内部漏洞」是杀猪盘核心话术",
      "提现要求交「解冻金」「税费」「保证金」=100% 诈骗",
      "优质异性主动加好友 + 带投资 + 要求保密 = 杀猪盘三件套",
    ],
    protectList: ["任何「稳收益」投资平台先在国家反诈 APP 核实", "提现要交钱的平台立即停止操作", "拨打 96110 或前往辖区派出所咨询"],
    targetGroup: "单身青年 / 大龄未婚 / 离异人士", codexId: "pig-butcher",
  },
  {
    id: "ARC-COP", bossId: "fakecop", fraudType: "冒充公检法诈骗",
    title: "冒充公检法安全账户案", date: "2026-Q1", source: "公安部反诈中心通报",
    caseStory: "李阿姨接到「+86 区号」来电，对方自称市公安局，称其涉嫌洗钱需配合调查，通过屏幕共享转走其账户 53 万元。",
    takeaway: "公检法不电话办案，更无「安全账户」，挂断拨打 96110 核实。",
    identifyDetail: [
      "公检法不会通过电话、QQ、微信办案",
      "不存在所谓的「安全账户」，要求转账即诈骗",
      "AI 换脸可伪造警官形象，视频讯问均为假冒",
    ],
    protectList: ["立即挂断电话，自行拨打 110 或 96110 核实", "拒绝屏幕共享、拒绝下载未知 APP", "任何要求转账到「安全账户」的均是诈骗"],
    targetGroup: "中老年人 / 退休人员 / 在校学生", codexId: "fake-police",
  },
  {
    id: "ARC-CS", bossId: "fakeservice", fraudType: "冒充客服诈骗",
    title: "冒充客服共享屏幕理赔案", date: "2026-Q1", source: "反诈中心通报",
    caseStory: "张先生接到「+86 95XXX」来电，对方自称某电商客服，称其订单有质量问题需办理「理赔」，诱导其开启屏幕共享后转走 12 万元。",
    takeaway: "正规客服不会要求共享屏幕，验证码即密码。",
    identifyDetail: [
      "正规客服不会要求开启屏幕共享",
      "验证码 = 密码，任何索要验证码的都是诈骗",
      "「影响征信」「自动扣费」是恐吓话术",
    ],
    protectList: ["挂断电话，通过官方 APP / 官网核实订单", "拒绝共享屏幕，拒绝下载会议类 APP", "验证码绝不告知任何人"],
    targetGroup: "网购用户 / 宝妈 / 上班族", codexId: "fake-cs",
  },
  {
    id: "ARC-INVEST", bossId: "falseinvest", fraudType: "虚假投资理财诈骗",
    title: "虚假投资内幕消息案", date: "2026-Q1", source: "反诈中心通报",
    caseStory: "陈先生被拉入「内部投资群」，群内每日晒盈利，他向「导师」提供的虚假平台入金 35 万元，平台随后无法登录。",
    takeaway: "「内幕消息+稳定收益+晒盈利」是虚假投资三件套。",
    identifyDetail: [
      "「内幕消息 + 稳定收益 + 晒盈利截图」是虚假投资三件套",
      "「日化 5%」远超正常理财，必是资金盘",
      "非正规渠道入金、提现需交钱的 = 诈骗",
    ],
    protectList: ["任何投资先核实平台资质", "拒绝「内幕消息+稳收益」话术", "提现要交钱=诈骗"],
    targetGroup: "中年投资者 / 退休人员 / 上班族", codexId: "false-invest",
  },
];

/** 根据 BOSS ID 查询诈骗溯源档案 */
export function getFraudArchiveByBossId(bossId: string): ThunderFraudArchive | undefined {
  return THUNDER_FRAUD_ARCHIVES.find((a) => a.bossId === bossId);
}

// ============ S4：v6 赛季通行证定义 ============

export const THUNDER_SEASON_PASS: ThunderSeasonPassDef = {
  seasonId: "S2",
  name: "雷霆反诈 v6 赛季通行证",
  maxLevel: 50,
  baseExpPerRun: 100,
  expPerBoss: 50,
  expPerPerfectWave: 20,
  tiers: [
    { level: 1, requiredExp: 0, freeReward: { type: "talentPoint", amount: 1, name: "天赋点×1", emoji: "⭐" } },
    { level: 5, requiredExp: 500, freeReward: { type: "talentPoint", amount: 2, name: "天赋点×2", emoji: "⭐" }, eliteReward: { type: "goldCoin", amount: 100, name: "金币×100", emoji: "🪙" } },
    { level: 10, requiredExp: 1000, freeReward: { type: "talentPoint", amount: 3, name: "天赋点×3", emoji: "⭐" }, eliteReward: { type: "skin", amount: 1, rewardId: "skin-v6-deepseek", name: "AI 守护者涂装", emoji: "🛡️" } },
    { level: 20, requiredExp: 2000, freeReward: { type: "bossRushToken", amount: 1, name: "BossRush 令牌×1", emoji: "🎟️" }, eliteReward: { type: "skin", amount: 1, rewardId: "skin-v6-usdt", name: "链上猎手涂装", emoji: "⛓️" } },
    { level: 30, requiredExp: 3000, freeReward: { type: "talentPoint", amount: 5, name: "天赋点×5", emoji: "⭐" }, eliteReward: { type: "skin", amount: 1, rewardId: "skin-v6-pass", name: "赛季通行证精英涂装", emoji: "👑" } },
    { level: 40, requiredExp: 4000, freeReward: { type: "talentPoint", amount: 5, name: "天赋点×5", emoji: "⭐" }, eliteReward: { type: "bossRushToken", amount: 3, name: "BossRush 令牌×3", emoji: "🎟️" } },
    { level: 50, requiredExp: 5000, freeReward: { type: "title", amount: 1, name: "反诈先锋称号", emoji: "🏅" }, eliteReward: { type: "skin", amount: 1, rewardId: "skin-v6-perfect", name: "完美识破者涂装", emoji: "✨" } },
  ],
};

/** 计算通行证当前等级进度 */
export function calcSeasonPassProgress(level: number, exp: number): { progress: number; expToNext: number } {
  const tiers = THUNDER_SEASON_PASS.tiers;
  const currentTier = [...tiers].reverse().find((t) => t.level <= level) ?? tiers[0];
  const nextTier = tiers.find((t) => t.level > level);
  if (!nextTier) return { progress: 1, expToNext: 0 };
  const tierSpan = nextTier.requiredExp - currentTier.requiredExp;
  const expIntoTier = exp - currentTier.requiredExp;
  return {
    progress: Math.max(0, Math.min(1, expIntoTier / tierSpan)),
    expToNext: nextTier.requiredExp - exp,
  };
}

// ============ P4：v6 武器超觉醒定义（6-7 级） ============

export const THUNDER_SUPER_AWAKENINGS: ThunderSuperAwakeningDef[] = [
  {
    branch: "spread", level: 6,
    name: "风暴散射·超觉醒", emoji: "🌀", desc: "散射分支超觉醒：弹幕数 +4，伤害 +60%，每发子弹小范围爆炸。",
    mantra: "风暴散射，反诈识破一切伪装",
    unlockCondition: "散射分支累计击杀 500 敌人 + 该分支已觉醒 5 级",
    effect: {
      dmgMul: 1.6, extraProjectiles: 4, pierce: 2, explode: true, explodeRadius: 40,
      ultimate: { name: "风暴之怒", damage: 500, radius: 200, cooldown: 30 },
    },
  },
  {
    branch: "spread", level: 7,
    name: "风暴散射·终极", emoji: "🌪️", desc: "散射分支终极：弹幕数 +6，伤害 +90%，爆炸范围翻倍，大招「风暴之怒」伤害翻倍。",
    mantra: "终极风暴，横扫一切诈骗",
    unlockCondition: "散射分支累计击杀 1500 敌人 + 6 级超觉醒",
    effect: {
      dmgMul: 1.9, extraProjectiles: 6, pierce: 3, explode: true, explodeRadius: 80,
      ultimate: { name: "终极风暴", damage: 1000, radius: 300, cooldown: 25 },
    },
  },
  {
    branch: "laser", level: 6,
    name: "毁灭激光·超觉醒", emoji: "🔆", desc: "激光分支超觉醒：穿透 +3，伤害 +70%，激光附带持续灼烧。",
    mantra: "毁灭激光，识破一切谎言",
    unlockCondition: "激光分支累计击杀 500 敌人 + 该分支已觉醒 5 级",
    effect: {
      dmgMul: 1.7, pierce: 3,
      ultimate: { name: "激光矩阵", damage: 600, radius: 250, cooldown: 32 },
    },
  },
  {
    branch: "laser", level: 7,
    name: "毁灭激光·终极", emoji: "🌟", desc: "激光分支终极：穿透 +5，伤害 +100%，激光宽度翻倍，大招「激光矩阵」覆盖全屏。",
    mantra: "终极激光，识破一切伪装",
    unlockCondition: "激光分支累计击杀 1500 敌人 + 6 级超觉醒",
    effect: {
      dmgMul: 2.0, pierce: 5,
      ultimate: { name: "终极激光矩阵", damage: 1200, radius: 400, cooldown: 28 },
    },
  },
  {
    branch: "homing", level: 6,
    name: "追踪导弹·超觉醒", emoji: "🎯", desc: "追踪分支超觉醒：追踪弹 +3，伤害 +60%，附带范围爆炸。",
    mantra: "追踪导弹，锁定一切骗子",
    unlockCondition: "追踪分支累计击杀 500 敌人 + 该分支已觉醒 5 级",
    effect: {
      dmgMul: 1.6, extraProjectiles: 3, homing: true, explode: true, explodeRadius: 50,
      ultimate: { name: "导弹风暴", damage: 550, radius: 280, cooldown: 30 },
    },
  },
  {
    branch: "homing", level: 7,
    name: "追踪导弹·终极", emoji: "🚀", desc: "追踪分支终极：追踪弹 +5，伤害 +90%，爆炸范围翻倍，大招「导弹风暴」全屏锁定。",
    mantra: "终极追踪，无处可逃",
    unlockCondition: "追踪分支累计击杀 1500 敌人 + 6 级超觉醒",
    effect: {
      dmgMul: 1.9, extraProjectiles: 5, homing: true, explode: true, explodeRadius: 100,
      ultimate: { name: "终极导弹风暴", damage: 1100, radius: 400, cooldown: 25 },
    },
  },
];

/** 根据分支和等级查询超觉醒定义 */
export function getSuperAwakening(branch: WeaponBranch, level: 6 | 7): ThunderSuperAwakeningDef | undefined {
  return THUNDER_SUPER_AWAKENINGS.find((s) => s.branch === branch && s.level === level);
}

// ============ v6 常量配置 ============

/** v6 格挡反击配置 */
export const V6_PARRY_CONFIG = {
  cooldownMax: 4,            // 格挡冷却 4 秒
  perfectWindowMax: 0.3,     // 完美格挡窗口 0.3 秒
  reflectMul: 2.0,           // 反弹伤害倍率
  shieldDuration: 0.8,       // 格挡护盾持续秒数
  healOnPerfect: 2,           // 完美格挡回复 HP
};

/** v6 组合弹幕配置 */
export const V6_COMBINED_PATTERN_CONFIG = {
  triggerBossHpThreshold: 0.5,  // BOSS HP < 50% 时启用组合弹幕
  maxCombinedPatterns: 2,       // 最多同时叠加 2 种弹幕
  combinedFireMul: 0.85,        // 组合弹幕频率倍率
};

/** v6 BOSS AI 对话触发 HP 阈值 */
export const V6_BOSS_AI_DIALOG_HP_THRESHOLD = 0.2;

/** v6 BOSS 超觉醒阶段触发 HP 阈值 */
export const V6_BOSS_SUPER_PHASE_HP_THRESHOLD = 0.1;

// ===========================================================================
// ===== v7 升级配置 =========================================================
// ===== 子系统数据/逻辑位于：story.ts / lessons.ts / knowledgeGraph.ts ======
// ===== / rpgScenarios.ts / certificate.ts / analytics.ts ==================
// ===== / procedural.ts / adaptiveAI.ts ====================================
// ===========================================================================

/** v7 剧情模式：S/A/B/C 评级对应倍率（用于结算奖励） */
export const V7_STORY_RANK_MULTIPLIER: Record<"S" | "A" | "B" | "C", number> = {
  S: 1.5,
  A: 1.2,
  B: 1.0,
  C: 0.8,
};

/** v7 剧情模式：通关基础奖励天赋点 */
export const V7_STORY_REWARD_TALENT_POINTS = {
  main: 3,    // 主线通关
  branch: 2,  // 支线通关
  ending: 5,  // 结局关卡通关
};

/** v7 RPG 模式：识破红旗对应天赋点奖励 */
export const V7_RPG_REWARD_TALENT_POINTS_PER_BUST = 1;

/** v7 课程模式：通关基础奖励天赋点 */
export const V7_LESSON_REWARD_TALENT_POINTS_BONUS = 2;

/** v7 自适应 AI：技能评分初始值 */
export const V7_ADAPTIVE_INITIAL_SKILL = 50;

/** v7 自适应 AI：首次启动游戏时是否使用初始难度 */
export const V7_ADAPTIVE_USE_DEFAULT_ON_FIRST_RUN = true;

/** v7 程序化弹幕：每日挑战种子生成（与 dailySeedFor 配合） */
export const V7_PROCEDURAL_DAILY_SEED_BASE = 20260731;

/** v7 证书：颁发时是否触发全屏特效 */
export const V7_CERTIFICATE_EFFECT_ENABLED = true;

/** v7 数据仪表板：最近活跃日期窗口（天） */
export const V7_ANALYTICS_RECENT_DAYS = 30;
