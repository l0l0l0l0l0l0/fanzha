import type { FBQuestion, FBQuestionKind, ManTier, FBBoss, FBSpecialEvent } from "./types";
// v2 升级：合并外置 JSON 题库（C1/C2 + A3 + A2 + B3）+ 季节性逻辑（A4）
import { NEW_QUESTIONS, currentSeason } from "./dataV2";

/**
 * 电信诈骗题库：以 codex 图鉴为准，共 25 类诈骗 + 判断题 + 多选题。
 * 覆盖：冒充公检法、杀猪盘、刷单返利、冒充客服退款、虚假投资理财、
 * 冒充熟人/领导、注销校园贷/征信修复、游戏账号/装备交易、虚假中奖、
 * 裸聊敲诈、AI换脸/拟声、虚构险情/事故、虚假慈善/众筹、兼职点赞/打字、
 * 网恋交友、虚假红包/集赞、游戏充值诈骗、冒充老师/学校、虚假贷款、
 * 网络赌博/博彩、二维码诈骗、冒充纪检/纪委、虚假退票/改签、
 * 虚假购物/二手交易、冒充反诈中心·保证金。
 */
// v5 升级：原内嵌题库外置到 questions/legacy-2025.json
import legacyQuestions from "./questions/legacy-2025.json";
export const QUESTION_BANK: FBQuestion[] = [...legacyQuestions] as FBQuestion[];

// ===== v2 升级：合并外置 JSON 题库（C1/C2 + A3 + A2 + B3） =====
QUESTION_BANK.push(...NEW_QUESTIONS);

/** 猛男等级：随积分晋升，错答也会因积分下降而削弱 */
export const MAN_TIERS: ManTier[] = [
  { level: 0, name: "弱不禁风", minScore: 0,    color: "#5A6B85" },
  { level: 1, name: "路人甲",   minScore: 250,  color: "#9FE3FF" },
  { level: 2, name: "初出茅庐", minScore: 700,  color: "#52C41A" },
  { level: 3, name: "渐入佳境", minScore: 1500, color: "#00E5FF" },
  { level: 4, name: "健硕猛男", minScore: 3000, color: "#FFD666" },
  { level: 5, name: "钢铁硬汉", minScore: 5500, color: "#FF7A1A" },
  { level: 6, name: "真男人",   minScore: 9000, color: "#FF5A60" },
  { level: 7, name: "反诈男神", minScore: 14000, color: "#FF00E5" },
];

export function manTierFor(score: number): ManTier {
  let cur = MAN_TIERS[0];
  for (const t of MAN_TIERS) if (score >= t.minScore) cur = t;
  return cur;
}

/** 诈骗分子挑衅话术：倒计时紧迫时出现，强化压迫感 */
export const SCAMMER_TAUNTS: string[] = [
  "快转账啊，错过这波就没啦~",
  "你的钱马上就是我的了，哈哈",
  "时间不多了哦，你慌不慌？",
  "96110 也救不了你这块肉~",
  "再不转账，后果自负！",
  "你猜对了吗？别挣扎了~",
  "稳赚不赔，你不动心吗？",
  "保密别告诉家人，听话~",
  "马上到账，再等一会儿嘛~",
  "你的验证码，是我的钥匙~",
];

/** 错答/风险选项触发时的嘲讽话术 */
export const SCAMMER_MOCKS: string[] = [
  "哈！上钩了！谢谢你的钱~",
  "又一个上当了，钱到手！",
  "看到了吗？这就是贪婪的代价。",
  "你的验证码真好用，谢啦~",
  "早就说稳赚不赔——对我而言。",
  "屏幕共享真香，你的账户真干净~",
  "安全账户？是我的账户！",
];

export interface WaveConfig {
  duration: number;
  maxDifficulty: number;
  disturbRate: number;
  /** 允许的题型（随波次解锁） */
  kinds: FBQuestionKind[];
  /** 是否倾向出现风险选项题（高压波次） */
  riskBoost: boolean;
}

/**
 * 难度梯度：随波次分阶段提升压力
 * - 1-5 波：12s，仅单选/判断（入门期）
 * - 6-15 波：10s，加入多选（进阶期）
 * - 16-30 波：8s，全题型，风险选项增多（高压期）
 * - 31+ 波：6s，全题型，极限压力
 */
export function waveConfig(wave: number): WaveConfig {
  let duration: number;
  let kinds: FBQuestionKind[];
  let riskBoost: boolean;
  let maxDifficulty: number;
  let disturbRate: number;

  if (wave <= 5) {
    // 入门期：单选/判断，时长宽裕
    duration = 12;
    kinds = ["single", "judge"];
    riskBoost = false;
    maxDifficulty = Math.min(2, 1 + Math.floor(wave / 3));
    disturbRate = 0.05 + wave * 0.01;
  } else if (wave <= 15) {
    // 进阶期：加入多选
    duration = 10;
    kinds = ["single", "judge", "multi"];
    riskBoost = false;
    maxDifficulty = Math.min(3, 2 + Math.floor((wave - 6) / 5));
    disturbRate = 0.1 + (wave - 6) * 0.015;
  } else if (wave <= 30) {
    // 高压期：加入填空题，风险选项增多（A2 AI 语音题由 pickQuestion 按 cardType 偏好插入）
    duration = 8;
    kinds = ["single", "judge", "multi", "fill"];
    riskBoost = true;
    maxDifficulty = Math.min(4, 3 + Math.floor((wave - 16) / 8));
    disturbRate = 0.25 + (wave - 16) * 0.01;
  } else {
    // 极限期：全题型（含连线/排序/分支情景 B3），最大压力
    duration = 6;
    kinds = ["single", "judge", "multi", "fill", "link", "sort", "branch"];
    riskBoost = true;
    maxDifficulty = 4;
    disturbRate = Math.min(0.5, 0.4 + (wave - 31) * 0.005);
  }

  return { duration, maxDifficulty, disturbRate, kinds, riskBoost };
}

export function pickQuestion(wave: number, usedIds: Set<string>): FBQuestion {
  const cfg = waveConfig(wave);
  const kindSet = new Set(cfg.kinds);
  // 按难度 + 题型筛选，排除连锁题追问（step 2）和正常情境题（由专门函数选取）
  const basePool = QUESTION_BANK.filter(
    (q) => !usedIds.has(q.id)
      && q.difficulty <= cfg.maxDifficulty
      && kindSet.has(q.kind ?? "single")
      && q.chainStep !== 2      // 连锁追问由 pickChainFollowUp 选取
      && !q.isNormal            // 正常情境题由 pickNormalQuestion 选取
  );
  // 高压波次：优先选择含风险选项的题目
  let pool = basePool;
  if (cfg.riskBoost) {
    const riskPool = basePool.filter((q) => (q.risk ?? []).length > 0);
    if (riskPool.length > 0 && Math.random() < 0.6) pool = riskPool;
  }
  // ===== v2 升级：季节性加权（A4） =====
  const curSeason = currentSeason();
  const seasonalPool = pool.filter((q) => (q.season ?? ["all"]).includes(curSeason));
  if (seasonalPool.length > 0 && Math.random() < 0.5) pool = seasonalPool;
  // ===== v2 升级：每 7 波偏好 AI 语音题（A2，cardType=audio） =====
  if (wave % 7 === 0) {
    const audioPool = pool.filter((q) => q.cardType === "audio");
    if (audioPool.length > 0) pool = audioPool;
  }
  // ===== v2 升级：分支情景题（B3，kind=branch）每 10 波偏好一次 =====
  if (wave % 10 === 0) {
    const branchPool = pool.filter((q) => q.kind === "branch");
    if (branchPool.length > 0) pool = branchPool;
  }
  // 逐级放宽：题型匹配 → 题型匹配无难度限制 → 全库（始终过滤 kindSet，避免新题型误入）
  const list = pool.length > 0
    ? pool
    : QUESTION_BANK.filter(
      (q) => !usedIds.has(q.id)
        && kindSet.has(q.kind ?? "single")
        && q.chainStep !== 2
        && !q.isNormal
    );
  const full = list.length > 0
    ? list
    : QUESTION_BANK.filter((q) => kindSet.has(q.kind ?? "single") && q.chainStep !== 2 && !q.isNormal);
  const fallback = full.length > 0
    ? full
    : QUESTION_BANK.filter((q) => kindSet.has(q.kind ?? "single") && q.chainStep !== 2 && !q.isNormal);
  return fallback[Math.floor(Math.random() * fallback.length)];
}

/** Boss 首脑图鉴：每 20 波循环出现，HP 与嘲讽随波次递增，各具技能 */
export const BOSSES: FBBoss[] = [
  {
    id: "B01",
    name: "跨国诈骗集团首脑",
    hp: 2,
    taunts: ["你以为抓得到我？", "我的网络遍及全球！", "小警察，别做梦了！", "96110？没用没用~"],
    theme: "red",
    skills: ["shuffleOptions", "hideTimer"],
  },
  {
    id: "B02",
    name: "暗网洗钱操盘手",
    hp: 3,
    taunts: ["钱已经洗白了，哈哈！", "追踪不到我的 IP~", "你的账户就是我的提款机。", "再快也追不上资金流转！"],
    theme: "purple",
    skills: ["lockItem", "summonMinion", "hideTimer"],
  },
  {
    id: "B03",
    name: "AI 换脸诈骗幕后主谋",
    hp: 3,
    taunts: ["我的脸连你都分不清~", "深度伪造，无所不能！", "你看到的都是我造的。", "连声音都是我合成的！"],
    theme: "gold",
    skills: ["shuffleOptions", "summonMinion", "lockItem"],
  },
  {
    id: "B04",
    name: "杀猪盘集团总舵主",
    hp: 3,
    taunts: ["猪养肥了才好宰~", "稳赚不赔，对你而言！", "感情？那只是我的工具。", "你猜不透我的套路。"],
    theme: "red",
    skills: ["shuffleOptions", "hideTimer", "summonMinion", "lockItem"],
  },
  {
    id: "B05",
    name: "虚拟币洗钱王",
    hp: 3,
    taunts: ["链上转账秒到账，你追得上？", "USDT 一过，钱就没影了~", "冷钱包热钱包，都是我的钱包！", "区块链匿名，你抓不到我。"],
    theme: "purple",
    skills: ["timeSteal", "lockItem", "summonMinion", "answerBlur"],
  },
  {
    id: "B06",
    name: "Deepfake 帝",
    hp: 3,
    taunts: ["我的脸，连你妈都认不出来~", "深度伪造，真假难辨！", "视频里那个人，是我造的。", "声音也能合成，信不信？"],
    theme: "gold",
    skills: ["answerBlur", "shuffleOptions", "timeSteal", "hideTimer"],
  },
];

/** 是否为 Boss 波次（每 20 波一次） */
export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % 20 === 0;
}

/** 选取 Boss：按波次循环 + HP 随波次递增（2-3） */
export function pickBoss(wave: number): FBBoss {
  const bossWaveIndex = Math.floor(wave / 20) - 1; // wave=20 → 0, wave=40 → 1 ...
  const base = BOSSES[bossWaveIndex % BOSSES.length];
  // HP 随波次递增：前两次 Boss 2 血，之后 3 血
  const hp = wave >= 40 ? 3 : 2;
  return { ...base, hp };
}

// ============ 特殊波次事件 ============

/** 是否为特殊波次（每 10 波一次，但不是 Boss 波次） */
export function isSpecialWave(wave: number): boolean {
  return wave > 0 && wave % 10 === 0 && !isBossWave(wave);
}

/** 特殊事件类型列表 */
export const SPECIAL_EVENTS: FBSpecialEvent[] = ["double", "timeCompress", "shuffle", "mixedTrueFalse", "rapidFire", "itemLock"];

/** 随机选取特殊事件 */
export function pickSpecialEvent(wave: number): FBSpecialEvent {
  // 前 20 波只出现较温和的事件
  const pool: FBSpecialEvent[] = wave <= 20
    ? ["shuffle", "mixedTrueFalse"]
    : wave <= 40
    ? ["shuffle", "mixedTrueFalse", "timeCompress", "rapidFire"]
    : SPECIAL_EVENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 特殊事件中文名 */
export function specialEventName(ev: FBSpecialEvent): string {
  switch (ev) {
    case "double": return "双重诈骗";
    case "timeCompress": return "时间压缩";
    case "shuffle": return "选项乱序";
    case "mixedTrueFalse": return "真假混杂";
    case "rapidFire": return "急速连答";
    case "itemLock": return "道具禁用";
  }
}

/** 特殊事件描述 */
export function specialEventDesc(ev: FBSpecialEvent): string {
  switch (ev) {
    case "double": return "连续答对2题，奖励翻倍！";
    case "timeCompress": return "倒计时减半，极速判断！";
    case "shuffle": return "选项位置被打乱，小心选择！";
    case "mixedTrueFalse": return "混入正常情境，需辨别真伪！";
    case "rapidFire": return "3题连发，每题时长缩短，速答！";
    case "itemLock": return "本波次禁用所有道具，纯靠判断！";
  }
}

// ============ 连锁题与正常情境题 ============

/** 选取连锁题首题（chainStep=1） */
export function pickChainQuestion(wave: number, usedIds: Set<string>): FBQuestion | null {
  const cfg = waveConfig(wave);
  const pool = QUESTION_BANK.filter(
    (q) => !usedIds.has(q.id)
      && q.chainGroup
      && q.chainStep === 1
      && q.difficulty <= cfg.maxDifficulty
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 选取连锁题追问（chainStep=2，同组） */
export function pickChainFollowUp(chainGroup: string, usedIds: Set<string>): FBQuestion | null {
  const pool = QUESTION_BANK.filter(
    (q) => !usedIds.has(q.id) && q.chainGroup === chainGroup && q.chainStep === 2
  );
  return pool.length > 0 ? pool[0] : null;
}

/** 选取正常情境题（isNormal=true） */
export function pickNormalQuestion(usedIds: Set<string>): FBQuestion | null {
  const pool = QUESTION_BANK.filter(
    (q) => !usedIds.has(q.id) && q.isNormal === true
  );
  if (pool.length === 0) {
    // 全用完了，重置正常情境题的 usedIds
    const allNormal = QUESTION_BANK.filter((q) => q.isNormal === true);
    return allNormal.length > 0 ? allNormal[Math.floor(Math.random() * allNormal.length)] : null;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 连锁题组总数 */
export const CHAIN_GROUPS = ["CHAIN01", "CHAIN02", "CHAIN03", "CHAIN04", "CHAIN05", "CHAIN06"];

