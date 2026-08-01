/**
 * 诈园区（bomb-island）v9 全面升级数据层
 * - S2 园区分层（外墙/内墙/核心/金库）
 * - S1 多炮位部署初始配置
 * - S3 战中 RTS 升级科技树
 * - E3 Boss 图鉴收藏
 * - E4 季节性活动关卡
 * - G1 每日任务池
 * - G2 本地排行榜 NPC 占位
 * - G3 96110 热线剧本
 * - G4 反诈工具箱
 * - T2 案例时间线构建器
 */
import type {
  ParkLayerDef, ParkLayerState, ParkLayerKind,
  CannonSlot, CannonSlotId,
  RTSUpgradeNode, RTSUpgradeId, RTSUpgradeState,
  BombBossCodexEntry,
  BombDailyTask, BombDailyTaskProgress, BombTaskType,
  BombLocalRankEntry,
  BombHotlineScript,
  BombToolItem, BombToolType,
  BombSeasonalEvent, BombSeason,
  BombCaseTimelineEntry,
  BombTierRating, BombGameMode,
  ModuleType, WeaponKind,
  // v10 新增类型
  DynamicEventDef, DynamicEventKind, DynamicEventChoice,
  WaveGapQuizState,
  PermanentUpgradeNode, PermanentUpgradeId, PermanentUpgradeState,
  SynergySkillKind, CannonSynergyState,
} from "./types";
import { TIER_BOSSES, PARK_TIERS, MODULE_KNOWLEDGE } from "./data";
import { getCaseArchive } from "./dataV2";

// ============ S2：园区分层定义 ============

/**
 * 园区分层：将所有模块类型映射到 4 层（外墙/内墙/核心/金库）。
 * 炮位自动瞄准"最近未拆层"，逐层击破后解锁线索碎片奖励。
 */
export const PARK_LAYERS: ParkLayerDef[] = [
  {
    kind: "outer", name: "外墙", emoji: "🧱", order: 0, color: "#9FE3FF",
    moduleTypes: ["wall", "antenna", "foundation"],
    clueFragments: 3,
    knowledgeTip: "外墙是电诈园区的第一道屏障——任何境外高薪招聘都是陷阱",
  },
  {
    kind: "inner", name: "内墙", emoji: "🏰", order: 1, color: "#FFB020",
    moduleTypes: ["dorm", "guard", "fortress", "floor"],
    clueFragments: 4,
    knowledgeTip: "内墙藏着电诈工位与苦工宿舍——被诱骗者已被限制人身自由",
  },
  {
    kind: "core", name: "核心", emoji: "⚙", order: 2, color: "#FF5A2A",
    moduleTypes: ["cage", "cell", "shock", "server", "liveRoom", "casino"],
    clueFragments: 6,
    knowledgeTip: "核心区是暴力胁迫与电诈窝点所在——组织者将数罪并罚",
  },
  {
    kind: "vault", name: "金库", emoji: "💰", order: 3, color: "#FFD666",
    moduleTypes: ["darkweb", "minefarm", "aiFactory", "idForge"],
    clueFragments: 8,
    knowledgeTip: "金库负责洗钱与身份伪造——链上全程可追溯，无处遁形",
  },
];

/** 模块类型 → 所属层（运行时聚合 HP 用） */
export const MODULE_TO_LAYER: Record<string, ParkLayerKind> = (() => {
  const map: Record<string, ParkLayerKind> = {};
  for (const layer of PARK_LAYERS) {
    for (const mt of layer.moduleTypes) map[mt] = layer.kind;
  }
  return map;
})();

/** 取模块所属层（默认 core） */
export function layerOfModule(type: string): ParkLayerKind {
  return MODULE_TO_LAYER[type] ?? "core";
}

/** 根据模块列表构建分层运行时状态 */
export function buildParkLayers(modules: Array<{ type: string; hp: number; maxHp: number; demolished: boolean }>): ParkLayerState[] {
  const states: Record<ParkLayerKind, ParkLayerState> = {
    outer:  { kind: "outer",  name: "外墙", emoji: "🧱", color: "#9FE3FF", hp: 0, maxHp: 0, cleared: false, destroyPct: 0, order: 0 },
    inner:  { kind: "inner",  name: "内墙", emoji: "🏰", color: "#FFB020", hp: 0, maxHp: 0, cleared: false, destroyPct: 0, order: 1 },
    core:   { kind: "core",   name: "核心", emoji: "⚙", color: "#FF5A2A", hp: 0, maxHp: 0, cleared: false, destroyPct: 0, order: 2 },
    vault:  { kind: "vault",  name: "金库", emoji: "💰", color: "#FFD666", hp: 0, maxHp: 0, cleared: false, destroyPct: 0, order: 3 },
  };
  for (const m of modules) {
    const k = layerOfModule(m.type);
    const s = states[k];
    s.maxHp += m.maxHp;
    if (!m.demolished) s.hp += m.hp;
  }
  for (const k of ["outer", "inner", "core", "vault"] as ParkLayerKind[]) {
    const s = states[k];
    s.destroyPct = s.maxHp > 0 ? 1 - s.hp / s.maxHp : 1;
    s.cleared = s.maxHp > 0 && s.hp <= 0;
  }
  return [states.outer, states.inner, states.core, states.vault];
}

/** 取最近未拆层（炮位自动瞄准用）：从外向内 */
export function nearestIntactLayer(layers: ParkLayerState[]): ParkLayerKind | null {
  for (const s of layers) {
    if (!s.cleared && s.maxHp > 0) return s.kind;
  }
  return null;
}

// ============ S1：多炮位部署初始配置 ============

/** 初始炮位配置（左/中/右三炮位坐标） */
export const CANNON_SLOTS_INIT: Array<Omit<CannonSlot, "muzzleUntil" | "recoil" | "fireAcc">> = [
  { id: "left",   name: "左翼炮", emoji: "🎯", x: 200, y: 452, weapon: "standard",  ammo: -1, level: 1, active: true,  preferLayer: null },
  { id: "center", name: "主炮",   emoji: "💥", x: 300, y: 432, weapon: "standard",  ammo: -1, level: 1, active: true,  preferLayer: null },
  { id: "right",  name: "右翼炮", emoji: "🚀", x: 400, y: 452, weapon: "standard",  ammo: -1, level: 1, active: false, preferLayer: null },
];

/** 默认炮位间距（用于解锁后布局） */
export const CANNON_FIRE_INTERVAL_BASE = 0.32; // 单炮位基础发射间隔（秒），比原 0.18 略慢以平衡 3 炮

/** 取激活炮位数 */
export function countActiveCannons(slots: CannonSlot[]): number {
  return slots.filter(s => s.active).length;
}

// ============ S3：战中 RTS 升级科技树 ============

/** RTS 升级节点定义（波次间隙面板抽取 3 个供选） */
export const RTS_UPGRADE_NODES: RTSUpgradeNode[] = [
  {
    id: "fireRate", name: "急速装填", desc: "所有炮位射速 +12%", icon: "⚡",
    costPerLevel: 3, maxLevel: 5,
    params: { fireRateMul: 0.88 },
  },
  {
    id: "damage", name: "高爆弹头", desc: "炮弹伤害 +15%", icon: "💥",
    costPerLevel: 3, maxLevel: 5,
    params: { damageMul: 1.15 },
  },
  {
    id: "multishot", name: "多管齐射", desc: "每炮位 +1 多管", icon: "🎯",
    costPerLevel: 5, maxLevel: 3,
    params: { multishotBonus: 1 },
  },
  {
    id: "crit", name: "精准暴击", desc: "15% 概率暴击 ×2", icon: "✨",
    costPerLevel: 4, maxLevel: 3,
    params: { critChance: 0.15 },
  },
  {
    id: "overdriveGain", name: "过载充能", desc: "过载获取 +20%", icon: "🔋",
    costPerLevel: 3, maxLevel: 5,
    params: { overdriveMul: 1.2 },
  },
  {
    id: "cdReduction", name: "快速冷却", desc: "道具 CD -10%", icon: "❄",
    costPerLevel: 4, maxLevel: 5,
    params: { cdMul: 0.9 },
  },
  {
    id: "fragmentBonus", name: "线索搜寻", desc: "线索碎片掉落 +25%", icon: "🔍",
    costPerLevel: 3, maxLevel: 3,
    params: { fragmentMul: 1.25 },
  },
  {
    id: "cannonUnlock", name: "部署新炮位", desc: "解锁并激活下一炮位", icon: "🛡",
    costPerLevel: 12, maxLevel: 2,
    params: {},
    unlockHint: "解锁右翼炮 / 提升炮位等级",
  },
];

/** RTS 升级节点 Map */
export const RTS_NODE_MAP: Record<RTSUpgradeId, RTSUpgradeNode> = (() => {
  const map = {} as Record<RTSUpgradeId, RTSUpgradeNode>;
  for (const n of RTS_UPGRADE_NODES) map[n.id] = n;
  return map;
})();

/** 从所有节点中随机抽取 N 个可升级的（未达 maxLevel）作为面板待选项 */
export function pickRTSOfferings(state: RTSUpgradeState, count = 3): RTSUpgradeId[] {
  const available = RTS_UPGRADE_NODES.filter(n => (state[n.id] ?? 0) < n.maxLevel);
  // Fisher-Yates 抽取
  const arr = available.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length)).map(n => n.id);
}

/** 取某升级当前等级（默认 0） */
export function getRTSLevel(state: RTSUpgradeState, id: RTSUpgradeId): number {
  return state[id] ?? 0;
}

/** 计算某升级总倍率（fireRateMul/damageMul 等连乘） */
export function rtsMultiplier(state: RTSUpgradeState, id: RTSUpgradeId, key: "fireRateMul" | "damageMul" | "overdriveMul" | "cdMul" | "fragmentMul"): number {
  const lv = getRTSLevel(state, id);
  if (lv <= 0) return 1;
  const node = RTS_NODE_MAP[id];
  const per = node.params[key];
  if (!per) return 1;
  return Math.pow(per, lv);
}

/** 取多管加成总数 */
export function rtsMultishotBonus(state: RTSUpgradeState): number {
  return getRTSLevel(state, "multishot") * (RTS_NODE_MAP["multishot"].params.multishotBonus ?? 0);
}

/** 取暴击率 */
export function rtsCritChance(state: RTSUpgradeState): number {
  return getRTSLevel(state, "crit") * (RTS_NODE_MAP["crit"].params.critChance ?? 0);
}

// ============ E3：Boss 图鉴收藏 ============

/** Boss 图鉴：从 TIER_BOSSES 自动生成全部条目 */
export const BOSS_CODEX: BombBossCodexEntry[] = (() => {
  const entries: BombBossCodexEntry[] = [];
  for (const tier of PARK_TIERS) {
    const list = TIER_BOSSES[tier.structure];
    list.forEach((b, idx) => {
      entries.push({
        bossId: `${tier.structure}-${idx}`,
        bossName: b.bossName,
        identity: b.identity,
        emoji: b.emoji,
        tierStructure: tier.structure,
        scamType: tier.briefing.scamType,
        realPrototype: b.caseStudy.title + "：" + b.caseStudy.body,
        defeatReward: `解锁案例档案 + ${b.caseStudy.points.length} 条防骗要点`,
        skillName: b.skillName,
        defeated: false,
      });
    });
  }
  return entries;
})();

/** 取全部 Boss 图鉴（含解锁状态） */
export function getBossCodex(defeatedIds: Set<string>): BombBossCodexEntry[] {
  return BOSS_CODEX.map(e => ({ ...e, defeated: defeatedIds.has(e.bossId) }));
}

/** 取已击败 Boss 数 / 总数 */
export function getBossCodexProgress(defeatedIds: Set<string>): { unlocked: number; total: number } {
  return { unlocked: defeatedIds.size, total: BOSS_CODEX.length };
}

// ============ G1：每日任务系统 ============

/** 每日任务候选池（每日随机抽 3 个） */
export const DAILY_TASK_POOL: BombDailyTask[] = [
  { id: "dt-destroy-30", name: "拆楼狂魔", desc: "拆除 30 个电诈模块", icon: "🏗", type: "destroyModules", target: 30, rewardScore: 1500, rewardFragments: 8 },
  { id: "dt-destroy-60", name: "拆迁大队", desc: "拆除 60 个电诈模块", icon: "🚧", type: "destroyModules", target: 60, rewardScore: 3200, rewardFragments: 15 },
  { id: "dt-rescue-5", name: "解救行动", desc: "救援 5 名被困受害者", icon: "🔓", type: "rescueVictims", target: 5, rewardScore: 2000, rewardFragments: 10 },
  { id: "dt-combo-20", name: "连击大师", desc: "达成 20 连击", icon: "🔥", type: "combo", target: 20, rewardScore: 1800, rewardFragments: 9 },
  { id: "dt-combo-50", name: "连击王者", desc: "达成 50 连击", icon: "⚡", type: "combo", target: 50, rewardScore: 4000, rewardFragments: 18 },
  { id: "dt-perfect-3", name: "完美波次", desc: "3 波完美不丢血", icon: "💎", type: "perfectWave", target: 3, rewardScore: 2400, rewardFragments: 12 },
  { id: "dt-boss-2", name: "首脑猎手", desc: "击败 2 个 Boss", icon: "👑", type: "clearBoss", target: 2, rewardScore: 3000, rewardFragments: 14 },
  { id: "dt-item-6", name: "道具专家", desc: "使用 6 次道具", icon: "🛠", type: "useItem", target: 6, rewardScore: 1200, rewardFragments: 6 },
  { id: "dt-destroy-cage", name: "铁笼克星", desc: "拆除 8 个铁笼/小黑屋", icon: "⛓", type: "destroyType", target: 8, params: { moduleType: "cage" }, rewardScore: 1600, rewardFragments: 8 },
  { id: "dt-destroy-dorm", name: "解救苦工", desc: "拆除 8 个苦工宿舍", icon: "🏠", type: "destroyType", target: 8, params: { moduleType: "dorm" }, rewardScore: 1600, rewardFragments: 8 },
  { id: "dt-destroy-minefarm", name: "断链行动", desc: "拆除 5 个虚拟币矿场", icon: "⛏", type: "destroyType", target: 5, params: { moduleType: "minefarm" }, rewardScore: 2200, rewardFragments: 11 },
  { id: "dt-destroy-aifactory", name: "破伪者", desc: "拆除 5 个 AI 换脸工厂", icon: "🤖", type: "destroyType", target: 5, params: { moduleType: "aiFactory" }, rewardScore: 2400, rewardFragments: 12 },
  { id: "dt-clear-story", name: "剧情推进", desc: "通关任意剧情关卡", icon: "📖", type: "clearMode", target: 1, params: { mode: "story" }, rewardScore: 3500, rewardFragments: 16 },
  { id: "dt-clear-hardcore", name: "硬核挑战", desc: "通关硬核模式", icon: "💀", type: "clearMode", target: 1, params: { mode: "hardcore" }, rewardScore: 5000, rewardFragments: 22 },
];

/** 日期 key（YYYY-MM-DD） */
export function getTodayKeyBomb(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 基于日期 seed 的确定性随机（每日全网同一份） */
function seededPick<T>(arr: T[], seed: number, count: number): T[] {
  const out: T[] = [];
  const pool = arr.slice();
  let s = seed;
  for (let i = 0; i < count && pool.length > 0; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const idx = s % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/** 取今日 3 个每日任务（每日固定，全网同一份） */
export function getTodayBombTasks(): BombDailyTask[] {
  const today = getTodayKeyBomb();
  // 日期 hash 作为 seed
  const seed = today.split("-").map(Number).reduce((a, b) => a * 31 + b, 7);
  return seededPick(DAILY_TASK_POOL, seed, 3);
}

// ============ G2：本地排行榜 NPC 占位 ============

/** NPC 排行榜占位（玩家成绩插入后排序） */
export const LOCAL_RANK_NPCS: Omit<BombLocalRankEntry, "rank">[] = [
  { name: "反诈先锋·老王", isPlayer: false, score: 86400, rating: "SSS", gameMode: "endless", date: "2026-07-20", perfect: true },
  { name: "炮兵连长·赵", isPlayer: false, score: 71200, rating: "SS",  gameMode: "story",   date: "2026-07-22", perfect: false },
  { name: "96110 接线员", isPlayer: false, score: 65800, rating: "SS",  gameMode: "endless", date: "2026-07-24", perfect: false },
  { name: "退役炮长·李", isPlayer: false, score: 54300, rating: "S",   gameMode: "speedrun", date: "2026-07-25", perfect: false },
  { name: "反诈志愿者", isPlayer: false, score: 42100, rating: "S",   gameMode: "endless", date: "2026-07-26", perfect: false },
  { name: "社区民警·周", isPlayer: false, score: 35600, rating: "A",   gameMode: "daily",   date: "2026-07-27", perfect: false },
  { name: "银行柜员·陈", isPlayer: false, score: 28400, rating: "A",   gameMode: "endless", date: "2026-07-28", perfect: false },
  { name: "宝妈反诈达人", isPlayer: false, score: 19200, rating: "B",   gameMode: "endless", date: "2026-07-28", perfect: false },
  { name: "退休教师·孙", isPlayer: false, score: 12800, rating: "B",   gameMode: "endless", date: "2026-07-29", perfect: false },
  { name: "新手炮兵·小张", isPlayer: false, score: 6400,  rating: "C",   gameMode: "endless", date: "2026-07-29", perfect: false },
];

/** 构建排行榜：玩家成绩插入 NPC 列表后排序取前 N */
export function buildLocalRank(playerEntry: Omit<BombLocalRankEntry, "rank">, topN = 10): BombLocalRankEntry[] {
  const all = [...LOCAL_RANK_NPCS, playerEntry];
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, topN).map((e, i) => ({ ...e, rank: i + 1 }));
}

// ============ G3：96110 热线模拟剧本 ============

export const HOTLINE_SCRIPTS: BombHotlineScript[] = [
  {
    id: "hotline-scammer", title: "怀疑遭遇冒充公检法", scenario: "你刚接到自称'公安局'的电话，称你涉嫌洗钱需配合调查到'安全账户'，是否拨打 96110 核实？",
    tierStructure: "kokang", startNodeId: "n1",
    nodes: [
      { id: "n1", operator: "您好，这里是 96110 反诈专线。请问遇到什么情况？",
        choices: [
          { text: "对方自称公安，让我转到安全账户", next: "n2", verdict: "right", feedback: "正确：公检法不会电话办案，更无'安全账户'" },
          { text: "对方说deepfake视频通话让我转账", next: "n3", verdict: "right", feedback: "正确：AI 换脸也是诈骗，挂断回拨原号核实" },
          { text: "我已转账，怎么办", next: "n4", verdict: "warn", feedback: "紧急：立即报警并申请紧急止付" },
        ] },
      { id: "n2", operator: "这是典型冒充公检法诈骗。公检法办案不会通过电话、微信，更不会要求转账到'安全账户'。请立即挂断，不要再接听对方电话。",
        choices: [
          { text: "明白了，挂断拉黑", next: null, ending: "verified", feedback: "正确处置" },
          { text: "但对方有我的身份证号", next: "n5", verdict: "warn", feedback: "身份证号泄露不等于涉案，是骗子吓唬你的手段" },
        ] },
      { id: "n3", operator: "这是 AI 换脸诈骗。视频通话也可能是伪造的，务必通过原有渠道（如回拨原号、当面核实）确认对方身份。任何'紧急转账'都要警惕。",
        choices: [
          { text: "已通过原号核实，确认是骗子", next: null, ending: "verified", feedback: "正确处置" },
          { text: "对方催得很急", next: "n6", verdict: "warn", feedback: "越催越急越要冷静，挂断给自己 30 秒思考" },
        ] },
      { id: "n4", operator: "请立即拨打 110 报警，并告知转账时间、金额、对方账户。警方可启动紧急止付。同时保存所有聊天记录、转账凭证作为证据。",
        choices: [
          { text: "立即报警", next: null, ending: "scam", feedback: "已受损：报警+止付+保留证据" },
        ] },
      { id: "n5", operator: "身份证号泄露不等于涉案。骗子通过非法渠道获取个人信息后冒充公检法恐吓你。真正的执法机关不会要求转账。",
        choices: [
          { text: "明白了，挂断拉黑", next: null, ending: "verified", feedback: "正确处置" },
        ] },
      { id: "n6", operator: "紧迫感是诈骗的核心话术之一。挂断电话，喝杯水，给自己 30 秒思考。任何要求'立即执行'的转账都是诈骗。",
        choices: [
          { text: "冷静核实后确认是骗子", next: null, ending: "verified", feedback: "正确处置" },
        ] },
    ],
    takeaways: [
      "公检法不会电话办案，更无'安全账户'",
      "AI 换脸视频也可能是伪造的，回拨原号核实",
      "紧迫感是诈骗话术，挂断给自己 30 秒思考",
      "96110 来电务必接听，可能正在被骗",
    ],
  },
  {
    id: "hotline-invest", title: "怀疑遭遇虚假投资理财", scenario: "网恋对象/群友推荐'稳赚不赔'的投资平台，你已充值但无法提现，是否拨打 96110？",
    tierStructure: "dubai", startNodeId: "i1",
    nodes: [
      { id: "i1", operator: "您好，96110 反诈专线。请描述您遇到的理财平台情况。",
        choices: [
          { text: "网恋对象推荐，平台无法提现", next: "i2", verdict: "right", feedback: "正确：这是典型杀猪盘" },
          { text: "群里老师带单，稳赚不赔", next: "i3", verdict: "right", feedback: "正确：保本高息=庞氏骗局" },
        ] },
      { id: "i2", operator: "这是典型杀猪盘诈骗。骗子伪装成优质异性建立感情后诱导投资虚假平台，前期允许小额提现获取信任，大额充值后平台即'系统维护'无法提现。",
        choices: [
          { text: "立即停止转账并报警", next: null, ending: "verified", feedback: "正确处置" },
          { text: "对方说交保证金就能提现", next: "i4", verdict: "warn", feedback: "再次转账=二次诈骗，立即停止" },
        ] },
      { id: "i3", operator: "这是庞氏骗局/虚假理财。任何承诺'保本高息、稳赚不赔'的都是诈骗，正规金融产品均不保本。请立即停止投入并报警。",
        choices: [
          { text: "明白了，报警", next: null, ending: "verified", feedback: "正确处置" },
        ] },
      { id: "i4", operator: "'交保证金/解冻金才能提现'是二次诈骗话术，绝不能再转账。请保存证据并立即拨打 110 报警。",
        choices: [
          { text: "立即报警并保留证据", next: null, ending: "scam", feedback: "已受损：报警+保留证据" },
        ] },
    ],
    takeaways: [
      "杀猪盘：网恋对象带投资=诈骗",
      "保本高息=庞氏骗局",
      "'交保证金才能提现'是二次诈骗",
      "理财只认持牌金融机构",
    ],
  },
  {
    id: "hotline-ai", title: "怀疑遭遇 AI 换脸诈骗", scenario: "收到'领导/亲友'视频通话要求紧急转账，对方长相声音都很像，是否拨打 96110？",
    tierStructure: "abyss", startNodeId: "a1",
    nodes: [
      { id: "a1", operator: "您好，96110。AI 换脸诈骗近期高发，请描述对方要求。",
        choices: [
          { text: "领导视频让我代转款给客户", next: "a2", verdict: "right", feedback: "正确：换号+代转=冒充领导标配" },
          { text: "亲友视频说急需用钱", next: "a3", verdict: "right", feedback: "正确：AI 可换脸熟人" },
        ] },
      { id: "a2", operator: "这是典型冒充领导诈骗，且叠加 AI 换脸。请立即挂断，通过原有渠道（公司座机、当面）核实领导身份。任何'代转款'都要警惕。",
        choices: [
          { text: "已通过原号核实，确认是骗子", next: null, ending: "verified", feedback: "正确处置" },
        ] },
      { id: "a3", operator: "AI 可换脸+拟声伪造亲友。请挂断后回拨亲友原号核实，或当面确认。任何'紧急转账'都要二次核实。",
        choices: [
          { text: "回拨原号核实，确认是骗子", next: null, ending: "verified", feedback: "正确处置" },
          { text: "对方说手机坏了用新号", next: "a4", verdict: "warn", feedback: "换号+急借钱=冒充熟人诈骗" },
        ] },
      { id: "a4", operator: "'换号+不方便接电话+急借钱'是冒充熟人诈骗的三大特征。务必通过其他渠道（共同亲友、原号）核实身份后再决定。",
        choices: [
          { text: "已核实，确认是骗子", next: null, ending: "verified", feedback: "正确处置" },
        ] },
    ],
    takeaways: [
      "AI 换脸视频也可能是伪造的",
      "回拨原号核实是唯一正确做法",
      "换号+急借钱=冒充熟人诈骗",
      "任何'紧急转账'都要二次核实",
    ],
  },
];

/** 取热线剧本 by ID */
export function getHotlineScript(id: string): BombHotlineScript | undefined {
  return HOTLINE_SCRIPTS.find(s => s.id === id);
}

// ============ G4：反诈工具箱 ============

export const TOOLBOX_ITEMS: BombToolItem[] = [
  {
    id: "tool-selfcheck", name: "账号自查清单", icon: "📋", type: "selfCheck",
    desc: "怀疑自己正在被骗？按清单逐项排查",
    steps: [
      "对方是否催促'立即转账'？紧迫感是诈骗核心话术",
      "是否要求'共享屏幕'操作手机/银行APP？共享屏幕=诈骗",
      "是否要求提供验证码/密码？任何机构都不会索要",
      "是否通过陌生链接下载APP？非官方应用商店下载=高危",
      "是否承诺'稳赚不赔/保本高息'？高收益=高风险或诈骗",
      "是否'换号+急借钱'？换号借钱=冒充熟人诈骗",
    ],
    contact: "96110",
    applicableScenes: ["冒充客服", "杀猪盘", "冒充公检法", "AI 换脸"],
  },
  {
    id: "tool-report", name: "举报指引", icon: "📞", type: "report",
    desc: "遇到诈骗如何正确举报",
    steps: [
      "立即拨打 96110 反诈专线（全国统一）",
      "提供骗子电话、账号、转账凭证等关键信息",
      "下载'国家反诈中心'APP 一键举报",
      "保存聊天记录、通话录音作为证据",
      "涉及资金立即拨打 110 报警",
    ],
    contact: "96110 / 110",
    applicableScenes: ["所有诈骗类型"],
  },
  {
    id: "tool-emergency", name: "紧急止付流程", icon: "🚨", type: "emergency",
    desc: "已转账怎么办？黄金 30 分钟止付",
    steps: [
      "立即拨打 110 报警，告知转账时间、金额、对方账户",
      "联系自己银行客服申请紧急止付（黄金 30 分钟内）",
      "提供对方完整银行卡号、开户行信息",
      "警方启动反诈资金预警，拦截涉案账户",
      "保留所有转账凭证、聊天记录",
    ],
    contact: "110 / 银行客服",
    applicableScenes: ["已转账的所有诈骗"],
  },
  {
    id: "tool-hotline", name: "反诈专线", icon: "☎", type: "hotline",
    desc: "96110 反诈专线使用指南",
    steps: [
      "96110 是全国反诈预警专线，务必接听",
      "96110 来电说明您可能正在被骗或已转账",
      "96110 不会要求您转账或提供验证码",
      "96110 不会要求'安全账户'或'案件保密'",
      "若漏接，请立即回拨当地反诈中心",
    ],
    contact: "96110",
    applicableScenes: ["所有诈骗类型"],
  },
  {
    id: "tool-verify", name: "官方核实渠道", icon: "✅", type: "verify",
    desc: "如何正确核实对方身份",
    steps: [
      "银行/平台：拨打官方客服电话（认准官网，非对方提供号码）",
      "公检法：到当地公安机关当面核实，不通过电话办案",
      "亲友/领导：回拨原号或当面核实，不信'换号'说辞",
      "客服退款：到官方APP内核实订单，不点陌生链接",
      "投资平台：到证监会/银保监会官网核查是否持牌",
    ],
    contact: "官方客服 / 110",
    applicableScenes: ["冒充客服", "冒充公检法", "冒充熟人", "虚假投资"],
  },
];

/** 取工具箱 by 类型 */
export function getToolsByType(type: BombToolType): BombToolItem[] {
  return TOOLBOX_ITEMS.filter(t => t.type === type);
}

// ============ E4：季节性活动关卡 ============

export const SEASONAL_EVENTS: BombSeasonalEvent[] = [
  {
    id: "event-spring", name: "春节红包季·反诈守岁", icon: "🧧", season: "springFestival",
    activeMonths: [1, 2],
    intro: "春节是红包诈骗、退票诈骗高发期。电诈园区借'春节福利'诱骗点击钓鱼链接，反诈联盟发起守岁行动！",
    outro: "春节反诈守岁成功！天下无诈，阖家团圆。",
    tierStructure: "den", passWaves: 4, passDestroyRate: 0.75, themeColor: "#E5353B", rewardExp: 200,
    rewardAchievementId: "ach-spring-2026",
  },
  {
    id: "event-school", name: "开学季·护苗行动", icon: "🎒", season: "schoolOpen",
    activeMonths: [8, 9],
    intro: "开学季是冒充老师收费、校园贷诈骗高发期。反诈联盟护苗行动，守护学生群体！",
    outro: "护苗行动成功！开学无诈，学子安心。",
    tierStructure: "kokang", passWaves: 4, passDestroyRate: 0.78, themeColor: "#FFB020", rewardExp: 220,
    rewardAchievementId: "ach-school-2026",
  },
  {
    id: "event-double11", name: "双11·反诈护航", icon: "🛒", season: "double11",
    activeMonths: [10, 11],
    intro: "双11购物季是冒充客服退款、虚假红包、刷单返利诈骗集中爆发期。反诈联盟全程护航！",
    outro: "双11反诈护航成功！购物无忧，天下无诈。",
    tierStructure: "dubai", passWaves: 5, passDestroyRate: 0.8, themeColor: "#FF7A1A", rewardExp: 250,
    rewardAchievementId: "ach-double11-2026",
  },
  {
    id: "event-summer", name: "暑期兼职·破诈行动", icon: "🏖", season: "summerJob",
    activeMonths: [6, 7, 8],
    intro: "暑期兼职诈骗（刷单/高薪招工）高发。电诈园区以'轻松日结'诱骗学生群体，反诈联盟发起破诈行动！",
    outro: "暑期破诈行动成功！兼职无诈，青春无忧。",
    tierStructure: "wafrica", passWaves: 5, passDestroyRate: 0.82, themeColor: "#00E5FF", rewardExp: 240,
    rewardAchievementId: "ach-summer-2026",
  },
  {
    id: "event-yearend", name: "年终理财·守财行动", icon: "💰", season: "yearEnd",
    activeMonths: [12, 1],
    intro: "年终是虚假理财、庞氏骗局、杀猪盘收割高发期。反诈联盟守财行动，守护年终钱包！",
    outro: "守财行动成功！年终无诈，财源稳固。",
    tierStructure: "abyss", passWaves: 6, passDestroyRate: 0.85, themeColor: "#1DE9B6", rewardExp: 300,
    rewardAchievementId: "ach-yearend-2026",
  },
];

/** 取当前月份（1-12） */
export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

/** 取当前活动季节事件（按月份匹配，可多个） */
export function getActiveSeasonalEvents(): BombSeasonalEvent[] {
  const m = getCurrentMonth();
  return SEASONAL_EVENTS.filter(e => e.activeMonths.includes(m));
}

/** 取活动季节名（用于 HUD 标签） */
export function getActiveSeasonLabel(): BombSeason | null {
  const m = getCurrentMonth();
  for (const e of SEASONAL_EVENTS) {
    if (e.activeMonths.includes(m)) return e.season;
  }
  return null;
}

// ============ T2：案例时间线构建器 ============

/**
 * 根据本局遭遇的 Boss 击败事件构建案例时间线（结算页展示）。
 * entries: 局内击破 Boss 的事件列表（按时间排序）
 */
export function buildCaseTimeline(entries: Array<{ atSec: number; caseArchiveId: string; tierStructure?: ParkLayerDef["kind"] | string }>): BombCaseTimelineEntry[] {
  return entries.map(e => {
    const archive = getCaseArchive(e.caseArchiveId);
    return {
      atSec: e.atSec,
      title: archive.title,
      desc: archive.takeaway,
      caseArchiveId: e.caseArchiveId,
      tierStructure: e.tierStructure as any,
    };
  });
}

// ============ T1：知识弹幕（模块拆除时触发） ============

/** 取模块拆除时的知识弹幕（沿用 MODULE_KNOWLEDGE） */
export function getModuleKnowledgeTip(type: string): { tip: string; color: string } | null {
  return MODULE_KNOWLEDGE[type] ?? null;
}

/** 取分层拆除时的知识弹幕 */
export function getLayerKnowledgeTip(layer: ParkLayerKind): string {
  const def = PARK_LAYERS.find(l => l.kind === layer);
  return def?.knowledgeTip ?? "";
}

// ============================================================
// ============ v10 全面升级数据 ============
// ============================================================

// ============ B1：连携大招配置 ============

/** 连携大招配置表 */
export const SYNERGY_SKILLS: Record<SynergySkillKind, {
  name: string; emoji: string; desc: string; color: string;
  /** 即时伤害（对当前层） */
  instantDamage?: number;
  /** 持续秒数 */
  duration?: number;
  /** 持续 DPS */
  dps?: number;
}> = {
  tripleBarrage: {
    name: "三炮齐射·破甲", emoji: "🎯", color: "#FFD666",
    desc: "3 炮位同时聚焦当前层，瞬时造成高额伤害并破除该层 20% 防御",
    instantDamage: 35,
  },
  layerBreak: {
    name: "破甲穿层", emoji: "⚡", color: "#00E5FF",
    desc: "无视当前层防御，直击下一层 5 秒，造成持续伤害",
    duration: 5, dps: 12,
  },
  crossfire: {
    name: "交叉火力", emoji: "🔥", color: "#FF5A60",
    desc: "3 炮位交叉扫射全园 3 秒，对所有层造成持续伤害",
    duration: 3, dps: 18,
  },
};

/** 根据当前瞄准层推荐连携大招类型 */
export function recommendSynergySkill(aimLayer: ParkLayerKind | null): SynergySkillKind {
  if (aimLayer === "vault") return "tripleBarrage";   // 金库层用瞬时爆发
  if (aimLayer === "core") return "layerBreak";        // 核心层用穿层
  return "crossfire";                                    // 外墙/内墙用交叉火力
}

// ============ B2：波次间隙动态事件池 ============

/** 动态事件候选池（波次间隙随机抽取 1 个） */
export const DYNAMIC_EVENTS: DynamicEventDef[] = [
  {
    id: "de-counterattack", kind: "counterattack", icon: "⚔", color: "#E5353B",
    title: "诈骗反扑", knowledgePoint: "反诈中心 96110",
    scenario: "园区 Boss 派出敢死队反扑炮兵阵地！侦察兵报告 3 分钟后抵达，你如何应对？",
    choices: [
      {
        text: "启动信号屏蔽，让敢死队迷失方向",
        result: "信号屏蔽成功！敢死队迷失方向，下波 Boss 反击减弱 20%",
        fragmentReward: 5, overdriveReward: 20, nextWaveHpMul: 0.8, optimal: true,
      },
      {
        text: "集中火力优先清剿敢死队",
        result: "击退敢死队但消耗弹药，下波小怪增加 2 个",
        fragmentReward: 3, nextWaveMinionBonus: 2,
      },
      {
        text: "无视反扑，继续炮击园区",
        result: "敢死队干扰炮兵，下波道具 CD 增加 30%",
        fragmentReward: -2,
      },
    ],
  },
  {
    id: "de-victim", kind: "victimRescue", icon: "🔓", color: "#52C41A",
    title: "受害者求救", knowledgePoint: "12308 领事保护热线",
    scenario: "园区内 5 名被困人员发出求救信号！他们即将被转移，你如何救援？",
    choices: [
      {
        text: "协调 12308 领事保护热线，引导安全撤离",
        result: "领事馆介入！5 名受害者安全获救，奖励 10 碎片",
        fragmentReward: 10, overdriveReward: 15, optimal: true,
      },
      {
        text: "派无人机空投物资支援",
        result: "物资空投成功，受害者暂时安全但未能脱困，奖励 4 碎片",
        fragmentReward: 4,
      },
      {
        text: "强攻救援，不顾代价",
        result: "强攻导致 2 名受害者受伤，但 3 人获救，奖励 3 碎片",
        fragmentReward: 3,
      },
    ],
  },
  {
    id: "de-informant", kind: "informant", icon: "🕵", color: "#9FE3FF",
    title: "线人情报", knowledgePoint: "国家反诈中心 APP",
    scenario: "园区内部线人发来加密情报：下波 Boss 的弱点位置。但情报可能是陷阱，你如何处理？",
    choices: [
      {
        text: "通过国家反诈中心 APP 核实线人身份",
        result: "线人身份核实无误！情报准确，下波 Boss 血量降低 15%",
        fragmentReward: 6, nextWaveHpMul: 0.85, optimal: true,
      },
      {
        text: "直接相信情报，集中攻击弱点",
        result: "情报部分准确，下波 Boss 血量降低 5% 但小怪增加 1 个",
        fragmentReward: 2, nextWaveHpMul: 0.95, nextWaveMinionBonus: 1,
      },
      {
        text: "不信情报，按原计划进攻",
        result: "谨慎应对无奖励，但避免陷阱风险",
        fragmentReward: 0,
      },
    ],
  },
  {
    id: "de-fakestream", kind: "fakeStream", icon: "📱", color: "#FF7A1A",
    title: "假主播干扰", knowledgePoint: "直播带货诈骗识别",
    scenario: "园区派出假主播在短视频平台直播干扰炮兵信号！假主播假冒'反诈官方'散布误导信息，你如何反制？",
    choices: [
      {
        text: "在直播间举报虚假信息，引导观众安装反诈 APP",
        result: "举报成功！直播间被封禁，下波道具 CD 减少 20%，奖励 8 碎片",
        fragmentReward: 8, overdriveReward: 10, optimal: true,
      },
      {
        text: "技术屏蔽直播信号",
        result: "信号屏蔽成功但短暂影响炮兵，下波射速降低 10%",
        fragmentReward: 4,
      },
      {
        text: "忽略假主播，继续炮击",
        result: "假主播持续干扰，下波道具 CD 增加 20%",
        fragmentReward: -1,
      },
    ],
  },
];

/** 随机抽取一个动态事件 */
export function pickDynamicEvent(): DynamicEventDef {
  return DYNAMIC_EVENTS[Math.floor(Math.random() * DYNAMIC_EVENTS.length)];
}

// ============ C1：波次间隙知识问答题库 ============

/** 知识问答候选池（波次间隙答对充能过载槽） */
export const WAVE_GAP_QUIZZES: Omit<WaveGapQuizState, "selectedIdx" | "answered">[] = [
  {
    question: "接到自称'96110'的电话要求你转账核实账户，应该？",
    options: ["按对方要求转账核实", "挂断后回拨 96110 核实", "提供银行卡号配合", "告知验证码完成核验"],
    correctIdx: 1,
    explain: "96110 是反诈预警专线，绝不会要求转账或提供验证码。如有疑虑，挂断后回拨 96110 核实。",
    knowledgePoint: "96110 反诈专线",
    rewardOverdrive: 25, rewardFragments: 3,
  },
  {
    question: "境外'高薪招工'月薪 3-5 万，包机票包住宿，最可能是什么？",
    options: ["优质海外工作机会", "电诈园区陷阱", "正规劳务输出", "政府扶持项目"],
    correctIdx: 1,
    explain: "境外高薪招工+包机票+保密=电诈园区诱骗套路。务必通过正规渠道核实，遇险拨打 12308。",
    knowledgePoint: "境外高薪招工陷阱",
    rewardOverdrive: 25, rewardFragments: 3,
  },
  {
    question: "AI 实时换脸视频通话中'领导'急令代转账，正确的做法是？",
    options: ["视频确认是本人立即转", "挂断后用通讯录原号码核实", "先转一半稳住领导", "按领导指引共享屏幕"],
    correctIdx: 1,
    explain: "AI 换脸可伪造视频通话。任何视频中的转账要求，都必须挂断后用通讯录原号码核实。",
    knowledgePoint: "AI 换脸诈骗识别",
    rewardOverdrive: 25, rewardFragments: 3,
  },
  {
    question: "以下哪个是'刷单返利'诈骗的核心特征？",
    options: ["前几单按时返佣建立信任", "需要缴纳个税才能提现", "客服主动退款", "官方 APP 推送通知"],
    correctIdx: 0,
    explain: "刷单诈骗先小额返利建立信任，随后要求垫付大额资金后'卡单'跑路。刷单本身违法，任何返利都是诱饵。",
    knowledgePoint: "刷单返利诈骗",
    rewardOverdrive: 25, rewardFragments: 3,
  },
  {
    question: "被诱骗至境外电诈园区后，应优先联系哪个热线求助？",
    options: ["12345 市民热线", "12308 领事保护热线", "12315 消费者热线", "12333 社保热线"],
    correctIdx: 1,
    explain: "12308 是中国领事保护热线，24 小时受理海外中国公民求助。被诱骗至电诈园区应立即联系使馆。",
    knowledgePoint: "12308 领事保护",
    rewardOverdrive: 25, rewardFragments: 3,
  },
  {
    question: "公检法不会通过电话办案，以下哪项是诈骗话术？",
    options: ["请到当地派出所面谈", "案件保密，不得告诉家人", "通过官方渠道核实", "法院传票将邮寄送达"],
    correctIdx: 1,
    explain: "'案件保密不得告诉家人'是冒充公检法诈骗的标准话术，目的是切断你核实真伪的渠道。公检法不电话办案。",
    knowledgePoint: "冒充公检法诈骗",
    rewardOverdrive: 25, rewardFragments: 3,
  },
];

/** 随机抽取一道知识问答 */
export function pickWaveGapQuiz(): Omit<WaveGapQuizState, "selectedIdx" | "answered"> {
  return WAVE_GAP_QUIZZES[Math.floor(Math.random() * WAVE_GAP_QUIZZES.length)];
}

// ============ D2：跨局永久成长树 ============

/** 永久升级节点配置表 */
export const PERMANENT_UPGRADES: PermanentUpgradeNode[] = [
  {
    id: "pFireRate", name: "炮膛强化", icon: "🔧", maxLevel: 5,
    desc: "永久提升炮位射速（每级 +5%）",
    costs: [20, 40, 70, 120, 200],
    params: { fireRateMul: 0.95 },
  },
  {
    id: "pDamage", name: "弹药升级", icon: "💥", maxLevel: 5,
    desc: "永久提升炮弹伤害（每级 +8%）",
    costs: [25, 50, 85, 140, 230],
    params: { damageMul: 1.08 },
  },
  {
    id: "pOverdriveGain", name: "过载优化", icon: "⚡", maxLevel: 3,
    desc: "永久提升过载槽获取速率（每级 +15%）",
    costs: [30, 60, 100],
    params: { overdriveMul: 1.15 },
  },
  {
    id: "pSynergyGain", name: "连携增幅", icon: "🎯", maxLevel: 3,
    desc: "永久提升连携充能速率（每级 +20%）",
    costs: [35, 70, 120],
    params: { synergyMul: 1.2 },
  },
  {
    id: "pFragmentBonus", name: "情报网络", icon: "💎", maxLevel: 5,
    desc: "永久提升线索碎片掉落（每级 +10%）",
    costs: [20, 40, 70, 120, 200],
    params: { fragmentMul: 1.1 },
  },
  {
    id: "pStartCannon", name: "炮位部署", icon: "🏗", maxLevel: 2,
    desc: "开局即解锁左/右炮位（每级解锁 1 个）",
    costs: [80, 150],
    params: {},
  },
  {
    id: "pStartWeapon", name: "武器预装", icon: "🔫", maxLevel: 3,
    desc: "开局武器等级提升（每级 +1）",
    costs: [50, 100, 180],
    params: {},
  },
  {
    id: "pRevive", name: "紧急撤退", icon: "🚁", maxLevel: 1,
    desc: "每局可紧急撤退 1 次（保留 50% 积分重开）",
    costs: [200],
    params: {},
  },
];

/** 永久升级节点 Map */
export const PERMANENT_UPGRADE_MAP: Record<PermanentUpgradeId, PermanentUpgradeNode> =
  PERMANENT_UPGRADES.reduce((m, n) => { m[n.id] = n; return m; }, {} as Record<PermanentUpgradeId, PermanentUpgradeNode>);

/** 取永久升级等级（0=未升级） */
export function getPermanentLevel(state: PermanentUpgradeState, id: PermanentUpgradeId): number {
  return state[id] ?? 0;
}

/** 取永久升级的累积乘数（如 fireRateMul 的总效果） */
export function permanentMul(state: PermanentUpgradeState, id: PermanentUpgradeId, key: keyof PermanentUpgradeNode["params"]): number {
  const node = PERMANENT_UPGRADE_MAP[id];
  const lv = getPermanentLevel(state, id);
  const per = node.params[key];
  if (!per) return 1;
  return Math.pow(per, lv);
}

/** 计算升级到下一级所需碎片 */
export function permanentUpgradeCost(state: PermanentUpgradeState, id: PermanentUpgradeId): number {
  const node = PERMANENT_UPGRADE_MAP[id];
  const lv = getPermanentLevel(state, id);
  if (lv >= node.maxLevel) return -1; // 已满级
  return node.costs[lv];
}

/** 判断是否可升级 */
export function canPermanentUpgrade(state: PermanentUpgradeState, id: PermanentUpgradeId, fragments: number): boolean {
  const cost = permanentUpgradeCost(state, id);
  return cost > 0 && fragments >= cost;
}

// ============================================================
// ============ v11 全面升级数据层 ============
// ============================================================

// ============ A1：Boss 审判庭剧本（12 个 Boss 各配 2 题） ============

import type {
  BossTrialDef, PactDef, IndustryChainDef,
  VictimStoryCard, DebriefScenario, WeatherParticleConfig,
  BombStoryMultiEnding, QTEDef, HotspotCase,
} from "./types";

/** Boss 审判庭配置表（key = bossId） */
export const BOSS_TRIALS: Record<string, BossTrialDef> = {
  // ===== 妙瓦底 den =====
  "den-0": {
    bossId: "den-0", themeColor: "#FF7A1A",
    indictment: "被告人涉嫌在境外设立电诈窝点，组织他人实施电信网络诈骗，并限制人身自由。",
    questions: [
      {
        id: "den-0-q1", question: "该 Boss 在妙瓦底设立电诈窝点，主要触犯哪项罪名？",
        options: [
          { text: "诈骗罪（刑法第266条）", correct: true, explain: "以非法占有为目的，虚构事实骗取他人财物，构成诈骗罪。", statute: "刑法第266条" },
          { text: "盗窃罪（刑法第264条）", correct: false, explain: "盗窃是秘密窃取，诈骗是受害人基于错误认识主动交付，二者不同。" },
          { text: "侵占罪（刑法第270条）", correct: false, explain: "侵占是将代为保管的他人财物非法占为己有，不符本案。" },
          { text: "抢劫罪（刑法第263条）", correct: false, explain: "抢劫是当场使用暴力/胁迫强行劫取，本案是诈骗。" },
        ],
        knowledgePoint: "诈骗罪与财产犯罪区分",
      },
      {
        id: "den-0-q2", question: "该窝点限制受害者人身自由，额外触犯：",
        options: [
          { text: "非法拘禁罪（刑法第238条）", correct: true, explain: "非法限制他人人身自由即构成非法拘禁，致人重伤死亡加重处罚。", statute: "刑法第238条" },
          { text: "绑架罪（刑法第239条）", correct: false, explain: "绑架需以勒索财物为目的扣押人质，本案是拘禁强迫劳动。" },
          { text: "拐卖妇女儿童罪（刑法第240条）", correct: false, explain: "拐卖以出卖为目的，本案是拘禁从事电诈。" },
          { text: "不构成犯罪，仅行政拘留", correct: false, explain: "限制人身自由已达刑事立案标准，非行政违法。" },
        ],
        knowledgePoint: "非法拘禁罪认定",
      },
    ],
    verdict: "数罪并罚：诈骗罪 + 非法拘禁罪，依法从重处罚。",
    mistrialHint: "记住：境外电诈窝点常涉及诈骗罪与非法拘禁罪数罪并罚。",
    rewardFragments: 8, rewardOverdrive: 30,
  },
  "den-1": {
    bossId: "den-1", themeColor: "#FFB020",
    indictment: "被告人负责培训电诈话术，组织他人实施诈骗活动。",
    questions: [
      {
        id: "den-1-q1", question: "话术培训师在共同犯罪中属于：",
        options: [
          { text: "诈骗罪共犯（教唆/帮助犯）", correct: true, explain: "为诈骗活动提供话术培训，是诈骗罪的帮助犯，按共犯论处。", statute: "刑法第25条、第266条" },
          { text: "无罪，仅是工作", correct: false, explain: "明知是诈骗仍提供帮助，构成共犯。" },
          { text: "传授犯罪方法罪", correct: false, explain: "本案主要罪名是诈骗共犯，传授方法罪是想象竞合从重。" },
          { text: "非法经营罪", correct: false, explain: "非法经营是扰乱市场秩序，与本案无关。" },
        ],
        knowledgePoint: "共同犯罪认定",
      },
    ],
    verdict: "诈骗罪共犯，按其所参与的全部诈骗数额处罚。",
    mistrialHint: "为诈骗提供话术/技术/培训均为共犯，勿存侥幸。",
    rewardFragments: 6, rewardOverdrive: 25,
  },
  // ===== 缅北 kokang =====
  "kokang-0": {
    bossId: "kokang-0", themeColor: "#E5353B",
    indictment: "被告人涉嫌组织、领导跨境电诈集团，并武装掩护犯罪。",
    questions: [
      {
        id: "kokang-0-q1", question: "组织、领导电诈集团，应认定为：",
        options: [
          { text: "犯罪集团的首要分子（按集团所犯全部罪行处罚）", correct: true, explain: "组织领导犯罪集团进行犯罪活动，是首要分子，按集团全部罪行处罚。", statute: "刑法第26条" },
          { text: "一般参与者，从轻处罚", correct: false, explain: "组织领导者非一般参与，应从重处罚。" },
          { text: "单位犯罪", correct: false, explain: "本案是自然人共同犯罪，非单位犯罪。" },
          { text: "聚众斗殴罪", correct: false, explain: "与聚众斗殴无关。" },
        ],
        knowledgePoint: "犯罪集团首要分子",
      },
      {
        id: "kokang-0-q2", question: "武装掩护电诈活动，可能触犯：",
        options: [
          { text: "非法持有枪支弹药罪（刑法第128条）", correct: true, explain: "非法持有枪支弹药即构成此罪，武装掩护从重处罚。", statute: "刑法第128条" },
          { text: "私藏枪支不构成犯罪", correct: false, explain: "非法持有/私藏枪支弹药均构成犯罪。" },
          { text: "仅违反治安管理处罚法", correct: false, explain: "持枪已达刑事立案标准。" },
          { text: "武装叛乱罪", correct: false, explain: "武装叛乱是危害国家安全罪，本案是普通刑事犯罪。" },
        ],
        knowledgePoint: "涉枪犯罪",
      },
    ],
    verdict: "诈骗罪（首要分子）+ 非法持有枪支弹药罪，数罪并罚从重处罚。",
    mistrialHint: "武装掩护电诈涉枪犯罪，数罪并罚从重。",
    rewardFragments: 10, rewardOverdrive: 35,
  },
  "kokang-1": {
    bossId: "kokang-1", themeColor: "#B388FF",
    indictment: "被告人运营洗钱水房，为电诈所得资金进行转移、取现。",
    questions: [
      {
        id: "kokang-1-q1", question: "为电诈资金提供转账/取现服务，构成：",
        options: [
          { text: "掩饰、隐瞒犯罪所得罪（刑法第312条）", correct: true, explain: "明知是犯罪所得而掩饰隐瞒，构成此罪；电诈资金流转即适用。", statute: "刑法第312条" },
          { text: "洗钱罪（刑法第191条）", correct: false, explain: "洗钱罪针对毒品/黑社会/恐怖等七类上游犯罪，普通诈骗适用312条。" },
          { text: "帮助信息网络犯罪活动罪", correct: false, explain: "帮信罪是提供技术/广告/支付帮助，本案是资金掩饰隐瞒。" },
          { text: "无罪，只是代办", correct: false, explain: "转账取现涉嫌掩饰隐瞒犯罪所得罪。" },
        ],
        knowledgePoint: "掩饰隐瞒犯罪所得罪",
      },
    ],
    verdict: "掩饰、隐瞒犯罪所得罪，情节严重从重处罚。",
    mistrialHint: "为电诈资金转账取现=掩饰隐瞒犯罪所得罪。",
    rewardFragments: 8, rewardOverdrive: 30,
  },
  // ===== 总部 hq =====
  "hq-0": {
    bossId: "hq-0", themeColor: "#7B5CFF",
    indictment: "被告人系跨境电诈集团首脑，组织策划跨国诈骗活动。",
    questions: [
      {
        id: "hq-0-q1", question: "跨境电诈集团首脑适用《反电信网络诈骗法》时，下列说法正确的是：",
        options: [
          { text: "构成诈骗罪，依刑法从重处罚，并承担民事责任", correct: true, explain: "反诈法是行政法补充，刑事仍依刑法诈骗罪从重处罚。", statute: "反电信网络诈骗法第38条、刑法第266条" },
          { text: "仅承担行政处罚", correct: false, explain: "首脑刑事责任必须追究，不能以行政代替刑事。" },
          { text: "可不追究刑事责任", correct: false, explain: "组织策划跨境诈骗必追刑责。" },
          { text: "由当地司法机关处理", correct: false, explain: "中国有管辖权，可依属人/保护管辖追诉。" },
        ],
        knowledgePoint: "反电信网络诈骗法",
      },
    ],
    verdict: "诈骗罪（首要分子）从重处罚，并处没收财产。",
    mistrialHint: "反诈法不替代刑法，跨境首脑依刑法从重处罚。",
    rewardFragments: 12, rewardOverdrive: 40,
  },
  "hq-1": {
    bossId: "hq-1", themeColor: "#00E5FF",
    indictment: "被告人运营暗网数据交易平台，非法买卖公民个人信息。",
    questions: [
      {
        id: "hq-1-q1", question: "非法买卖公民个人信息，构成：",
        options: [
          { text: "侵犯公民个人信息罪（刑法第253条之一）", correct: true, explain: "违反国家规定买卖公民个人信息，情节严重构成此罪。", statute: "刑法第253条之一" },
          { text: "盗窃罪", correct: false, explain: "信息非有形财物，不适用盗窃罪。" },
          { text: "非法获取计算机信息系统数据罪", correct: false, explain: "本案是个人信息买卖，适用253条之一更准确。" },
          { text: "无罪", correct: false, explain: "情节严重即构成犯罪。" },
        ],
        knowledgePoint: "侵犯公民个人信息罪",
      },
    ],
    verdict: "侵犯公民个人信息罪，情节特别严重从重处罚。",
    mistrialHint: "买卖公民个人信息=侵犯公民个人信息罪。",
    rewardFragments: 10, rewardOverdrive: 35,
  },
  // ===== 迪拜 dubai =====
  "dubai-0": {
    bossId: "dubai-0", themeColor: "#FFD666",
    indictment: "被告人作为白手套，协助将电诈所得资金通过虚拟币跨境转移。",
    questions: [
      {
        id: "dubai-0-q1", question: "协助以虚拟币转移电诈资金境外，构成：",
        options: [
          { text: "掩饰、隐瞒犯罪所得罪（刑法第312条）", correct: true, explain: "通过虚拟币转移犯罪所得，构成掩饰隐瞒犯罪所得罪。", statute: "刑法第312条" },
          { text: "洗钱罪（刑法第191条）", correct: false, explain: "诈骗非洗钱罪七类上游犯罪，适用312条。" },
          { text: "无罪，虚拟币交易合法", correct: false, explain: "明知是犯罪所得仍转移即构成犯罪。" },
          { text: "非法经营罪", correct: false, explain: "本案是掩饰隐瞒，非经营行为。" },
        ],
        knowledgePoint: "虚拟币洗钱认定",
      },
    ],
    verdict: "掩饰、隐瞒犯罪所得罪，跨境转移从重处罚。",
    mistrialHint: "虚拟币转移电诈资金=掩饰隐瞒犯罪所得罪。",
    rewardFragments: 10, rewardOverdrive: 35,
  },
  "dubai-1": {
    bossId: "dubai-1", themeColor: "#FFB020",
    indictment: "被告人运营虚拟币操盘平台，实施庞氏骗局诈骗投资者。",
    questions: [
      {
        id: "dubai-1-q1", question: "以高息虚拟币理财为名实施庞氏骗局，构成：",
        options: [
          { text: "集资诈骗罪（刑法第192条）", correct: true, explain: "以非法占有为目的，使用诈骗方法非法集资，构成集资诈骗罪。", statute: "刑法第192条" },
          { text: "非法吸收公众存款罪", correct: false, explain: "非法吸收是不具有非法占有目的，本案以非法占有为目的。" },
          { text: "诈骗罪（刑法第266条）", correct: false, explain: "集资诈骗是特别条款，优先适用。" },
          { text: "组织、领导传销活动罪", correct: false, explain: "传销需层级返利结构，本案是庞氏骗局。" },
        ],
        knowledgePoint: "集资诈骗罪",
      },
    ],
    verdict: "集资诈骗罪，数额特别巨大从重处罚。",
    mistrialHint: "虚拟币高息理财庞氏骗局=集资诈骗罪。",
    rewardFragments: 10, rewardOverdrive: 35,
  },
  // ===== 西非 wafrica =====
  "wafrica-0": {
    bossId: "wafrica-0", themeColor: "#FF5A2A",
    indictment: "被告人组织庞氏资金盘，跨境诈骗中国受害者。",
    questions: [
      {
        id: "wafrica-0-q1", question: "组织庞氏资金盘诈骗，下列正确的是：",
        options: [
          { text: "集资诈骗罪或诈骗罪，依规模与手段认定", correct: true, explain: "面向不特定公众集资诈骗定集资诈骗罪；特定对象可定诈骗罪。", statute: "刑法第192条、第266条" },
          { text: "仅民事纠纷", correct: false, explain: "以非法占有为目的已构成刑事犯罪。" },
          { text: "组织、领导传销活动罪", correct: false, explain: "无层级返利结构不构成传销。" },
          { text: "非法经营罪", correct: false, explain: "本案是诈骗类犯罪。" },
        ],
        knowledgePoint: "庞氏骗局定性",
      },
    ],
    verdict: "集资诈骗罪（或诈骗罪），数额特别巨大从重处罚。",
    mistrialHint: "庞氏资金盘依规模定集资诈骗罪或诈骗罪。",
    rewardFragments: 10, rewardOverdrive: 35,
  },
  "wafrica-1": {
    bossId: "wafrica-1", themeColor: "#1AD670",
    indictment: "被告人负责跨境资金中转，协助电诈资金外流。",
    questions: [
      {
        id: "wafrica-1-q1", question: "协助电诈资金跨境中转，构成：",
        options: [
          { text: "掩饰、隐瞒犯罪所得罪", correct: true, explain: "明知是犯罪所得而协助转移，构成掩饰隐瞒犯罪所得罪。", statute: "刑法第312条" },
          { text: "走私普通货物罪", correct: false, explain: "资金中转非走私货物。" },
          { text: "逃汇罪", correct: false, explain: "逃汇是违规将外汇转移境外，本案是掩饰隐瞒。" },
          { text: "无罪", correct: false, explain: "协助转移犯罪所得即构成犯罪。" },
        ],
        knowledgePoint: "跨境资金中转定性",
      },
    ],
    verdict: "掩饰、隐瞒犯罪所得罪，跨境从重处罚。",
    mistrialHint: "协助电诈资金跨境中转=掩饰隐瞒犯罪所得罪。",
    rewardFragments: 8, rewardOverdrive: 30,
  },
  // ===== 暗网深渊 abyss =====
  "abyss-0": {
    bossId: "abyss-0", themeColor: "#B388FF",
    indictment: "被告人运营 AI 换脸工厂，制作 Deepfake 内容实施诈骗。",
    questions: [
      {
        id: "abyss-0-q1", question: "利用 AI 换脸技术伪造他人身份实施诈骗，构成：",
        options: [
          { text: "诈骗罪（刑法第266条），从重处罚", correct: true, explain: "AI 换脸是诈骗手段，仍定诈骗罪，但利用新技术可从重。", statute: "刑法第266条" },
          { text: "仅侵犯肖像权，民事赔偿", correct: false, explain: "用于诈骗已达刑事立案标准。" },
          { text: "编造、故意传播虚假信息罪", correct: false, explain: "本案是诈骗，非单纯编造虚假信息。" },
          { text: "非法使用窃听窃照器材罪", correct: false, explain: "本案是 AI 换脸诈骗，非窃听窃照。" },
        ],
        knowledgePoint: "AI 换脸诈骗定性",
      },
      {
        id: "abyss-0-q2", question: "制作 AI 换脸淫秽内容并传播，额外触犯：",
        options: [
          { text: "制作、传播淫秽物品牟利罪（刑法第363条）", correct: true, explain: "制作传播淫秽物品牟利，构成此罪。", statute: "刑法第363条" },
          { text: "侮辱罪", correct: false, explain: "侮辱罪需捏造事实公然侮辱，本案是淫秽物品。" },
          { text: "诽谤罪", correct: false, explain: "诽谤需捏造事实，本案是淫秽物品犯罪。" },
          { text: "侵犯公民个人信息罪", correct: false, explain: "本案是淫秽物品犯罪。" },
        ],
        knowledgePoint: "Deepfake 淫秽内容犯罪",
      },
    ],
    verdict: "诈骗罪 + 制作传播淫秽物品牟利罪，数罪并罚从重处罚。",
    mistrialHint: "AI 换脸诈骗+淫秽内容，数罪并罚。",
    rewardFragments: 12, rewardOverdrive: 40,
  },
  "abyss-1": {
    bossId: "abyss-1", themeColor: "#FF5A8A",
    indictment: "被告人运营虚拟身份车间，批量伪造身份证件用于电诈。",
    questions: [
      {
        id: "abyss-1-q1", question: "批量伪造居民身份证件，构成：",
        options: [
          { text: "伪造、变造居民身份证件罪（刑法第280条第3款）", correct: true, explain: "伪造变造居民身份证件即构成此罪。", statute: "刑法第280条第3款" },
          { text: "伪造国家机关公文罪", correct: false, explain: "身份证件适用280条第3款特别规定。" },
          { text: "无罪，仅是 PS", correct: false, explain: "伪造身份证件已构成犯罪。" },
          { text: "诈骗罪", correct: false, explain: "伪造身份证件本身已构罪，诈骗是后续行为。" },
        ],
        knowledgePoint: "伪造身份证件罪",
      },
    ],
    verdict: "伪造居民身份证件罪 + 诈骗罪，数罪并罚。",
    mistrialHint: "批量伪造身份证=伪造身份证件罪。",
    rewardFragments: 10, rewardOverdrive: 35,
  },
};

/** 取 Boss 审判庭配置 */
export function getBossTrial(bossId: string): BossTrialDef | null {
  return BOSS_TRIALS[bossId] ?? null;
}

/** 随机抽取一道未答过的审判题（引擎用：按 currentQuestionIdx 顺序取） */
export function getTrialQuestion(trial: BossTrialDef, idx: number): BossTrialDef["questions"][number] | null {
  return trial.questions[idx] ?? null;
}

// ============ A2：QTE 预设配置池 ============

/** QTE 预设池（按 Boss 阶段/濒死触发，引擎按场景选择） */
export const QTE_PRESETS: QTEDef[] = [
  {
    kind: "rapidTap", prompt: "集中火力！快速点击屏幕！", duration: 3, target: 12,
    successDamage: 80, successOverdrive: 40,
    failPenaltyDebuffDur: 4, failDebuff: "weaponJam",
  },
  {
    kind: "swipeSlash", prompt: "致命一击！向 Boss 方向快速滑动！", duration: 2, target: 1,
    successDamage: 120, successOverdrive: 50,
    failPenaltyDebuffDur: 5, failDebuff: "comboBreak",
  },
  {
    kind: "holdAim", prompt: "锁定弱点！长按蓄力！", duration: 2.5, target: 2,
    successDamage: 100, successOverdrive: 45,
    failPenaltyDebuffDur: 4, failDebuff: "visionJam",
  },
  {
    kind: "tapBurst", prompt: "暴击时机！点击屏幕中央！", duration: 1.5, target: 1,
    successDamage: 90, successOverdrive: 35,
    failPenaltyDebuffDur: 3, failDebuff: "cdLock",
  },
];

/** 取随机 QTE 预设（trigger 由调用方在构造 QTEState 时注入） */
export function pickQTE(): QTEDef {
  return QTE_PRESETS[Math.floor(Math.random() * QTE_PRESETS.length)];
}

// ============ A3：Roguelike 契约池 ============

/** 契约池（波次间隙随机抽取 3 个供玩家选择） */
export const PACT_POOL: PactDef[] = [
  {
    id: "pact-ash", name: "灰烬契约", emoji: "🔥", color: "#FF5A2A", rarity: "common",
    desc: "道具伤害降低 20%，但线索碎片掉率提升 60%。",
    cost: "道具伤害 -20%", gain: "碎片掉率 +60%",
    effect: { itemDamageMul: 0.8, fragmentMul: 1.6 },
  },
  {
    id: "pact-iron", name: "钢铁契约", emoji: "⚒", color: "#9FE3FF", rarity: "common",
    desc: "炮兵射速降低 15%，但 Boss 血量降低 10%。",
    cost: "射速 -15%", gain: "Boss 血量 -10%",
    effect: { fireRateMul: 0.85, bossHpMul: 0.9 },
  },
  {
    id: "pact-thorn", name: "荆棘契约", emoji: "🌹", color: "#FF5A8A", rarity: "rare",
    desc: "道具 CD 延长 25%，但过载获取提升 80%。",
    cost: "道具 CD +25%", gain: "过载获取 +80%",
    effect: { itemCdMul: 1.25, overdriveMul: 1.8 },
  },
  {
    id: "pact-abyss", name: "深渊契约", emoji: "🌌", color: "#B388FF", rarity: "rare",
    desc: "Boss 反击频率提升 20%，但连携充能提升 100%。",
    cost: "Boss 反击 +20%", gain: "连携充能 +100%",
    effect: { counterMul: 1.2, synergyMul: 2.0 },
  },
  {
    id: "pact-gold", name: "黄金契约", emoji: "💰", color: "#FFD666", rarity: "epic",
    desc: "炮兵射速降低 25%、道具伤害降低 25%，但碎片掉率 +120%、过载 +60%。",
    cost: "射速 -25%、道具伤害 -25%", gain: "碎片 +120%、过载 +60%",
    effect: { fireRateMul: 0.75, itemDamageMul: 0.75, fragmentMul: 2.2, overdriveMul: 1.6 },
  },
  {
    id: "pact-storm", name: "风暴契约", emoji: "⛈", color: "#00E5FF", rarity: "epic",
    desc: "道具 CD 延长 30%、Boss 反击 +15%，但 Boss 血量 -15%、连携充能 +80%。",
    cost: "道具 CD +30%、Boss 反击 +15%", gain: "Boss 血量 -15%、连携 +80%",
    effect: { itemCdMul: 1.3, counterMul: 1.15, bossHpMul: 0.85, synergyMul: 1.8 },
  },
];

/** 随机抽取 N 个不重复契约 */
export function pickPacts(n: number): PactDef[] {
  const pool = [...PACT_POOL];
  const out: PactDef[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

// ============ B1：诈骗产业链映射（6 档园区） ============

/** 产业链配置表（key = tier structure） */
export const INDUSTRY_CHAINS: Record<string, IndustryChainDef> = {
  den: {
    tierStructure: "den", primaryStage: "recruit",
    secondaryStages: ["script"],
    narrative: "妙瓦底园区是诈骗产业链的【引流招募】环节——以高薪招聘诱骗受害者偷渡入局，再以话术培训将其转化为施害者。园区同时承担话术培训职能，是被诱骗者变为加害者的转化站。",
    upstream: undefined, downstream: "kokang",
    relatedCrimes: ["组织偷越国（边）境罪", "诈骗罪", "非法拘禁罪"],
  },
  kokang: {
    tierStructure: "kokang", primaryStage: "script",
    secondaryStages: ["recruit", "launder"],
    narrative: "缅北园区是诈骗产业链的【话术培训与执行】核心环节——武装掩护大规模电诈工位，同时兼营洗钱水房。是产业链中犯罪规模最大、暴力程度最高的环节。",
    upstream: "den", downstream: "hq",
    relatedCrimes: ["诈骗罪", "非法拘禁罪", "非法持有枪支弹药罪", "掩饰隐瞒犯罪所得罪"],
  },
  hq: {
    tierStructure: "hq", primaryStage: "script",
    secondaryStages: ["launder"],
    narrative: "总部园区是诈骗产业链的【策划与数据中枢】——制定全球诈骗剧本，运营暗网数据交易平台，买卖公民个人信息。是产业链的大脑，向下输出剧本与数据。",
    upstream: "kokang", downstream: "dubai",
    relatedCrimes: ["诈骗罪", "侵犯公民个人信息罪", "帮助信息网络犯罪活动罪"],
  },
  dubai: {
    tierStructure: "dubai", primaryStage: "launder",
    secondaryStages: ["cashout"],
    narrative: "迪拜园区是诈骗产业链的【洗钱流转枢纽】——白手套通过虚拟币、地下钱庄将电诈资金洗白跨境转移。是资金外流的关键闸口。",
    upstream: "hq", downstream: "wafrica",
    relatedCrimes: ["掩饰隐瞒犯罪所得罪", "洗钱罪", "集资诈骗罪"],
  },
  wafrica: {
    tierStructure: "wafrica", primaryStage: "cashout",
    secondaryStages: ["launder"],
    narrative: "西非园区是诈骗产业链的【提现分赃终端】——庞氏资金盘收割后，资金经跨洲中转最终分赃。是产业链末端，受害者资金至此彻底流失。",
    upstream: "dubai", downstream: undefined,
    relatedCrimes: ["集资诈骗罪", "诈骗罪", "掩饰隐瞒犯罪所得罪"],
  },
  abyss: {
    tierStructure: "abyss", primaryStage: "script",
    secondaryStages: ["recruit", "launder"],
    narrative: "暗网深渊是诈骗产业链的【技术黑产供给站】——AI 换脸工厂伪造身份与音视频，虚拟身份车间批量造假证。为整条产业链提供技术弹药，是新型电诈的源头。",
    upstream: undefined, downstream: "hq",
    relatedCrimes: ["诈骗罪", "伪造身份证件罪", "制作传播淫秽物品牟利罪", "侵犯公民个人信息罪"],
  },
};

/** 取园区产业链定位 */
export function getIndustryChain(tierStructure: string): IndustryChainDef | null {
  return INDUSTRY_CHAINS[tierStructure] ?? null;
}

// ============ B4：暗网深渊子档位 Boss 扩展 ============

/** 暗网深渊子档位映射（在 abyss 档位内进一步区分）
 *  abyss-0 = aiFactory (AI 换脸工厂)
 *  abyss-1 = idForge (虚拟身份车间)
 *  abyss-2 = deepfakeLab (Deepfake 实验室，v11 新增)
 */
export const ABYSS_SUB_MAP: Record<string, "aiFactory" | "idForge" | "deepfakeLab"> = {
  "abyss-0": "aiFactory",
  "abyss-1": "idForge",
  "abyss-2": "deepfakeLab",
};

/** 暗网深渊子档位名称 */
export const ABYSS_SUB_NAMES: Record<"aiFactory" | "idForge" | "deepfakeLab", { name: string; emoji: string; color: string }> = {
  aiFactory: { name: "AI 换脸工厂", emoji: "🎭", color: "#B388FF" },
  idForge: { name: "虚拟身份车间", emoji: "🪪", color: "#FF5A8A" },
  deepfakeLab: { name: "Deepfake 实验室", emoji: "🔬", color: "#00E5FF" },
};

// ============ D1：受害者归家故事卡 ============

/** 受害者故事卡池（救援数达阈值时按序解锁） */
export const VICTIM_STORIES: VictimStoryCard[] = [
  {
    id: "vs-001", alias: "小陈（化名）", themeColor: "#9FE3FF", hotline: "96110",
    title: "应届生的归途",
    profile: "22 岁应届毕业生，被\"境外高薪客服\"广告诱骗",
    experience: "小陈毕业后在招聘群看到\"东南亚客服月薪 2 万\"广告，偷渡至妙瓦底后被没收手机、拘禁于电诈工位，被迫每天工作 16 小时实施诈骗。3 次试图逃跑均被追回毒打。",
    returnHome: "在中缅联合执法行动中被解救，由使馆协助办证返乡。归国当日父亲在机场老泪纵横。",
    currentStatus: "已返乡与家人团聚，配合警方调查取证，目前正在学习新媒体运营。",
    message: "谢谢你们轰开那道铁门——我以为再也回不来了。请告诉更多年轻人：境外高薪招聘都是陷阱。",
  },
  {
    id: "vs-002", alias: "阿芳（化名）", themeColor: "#FF5A8A", hotline: "96110",
    title: "单亲妈妈的回家路",
    profile: "35 岁单亲妈妈，被\"海外保姆月薪 1.8 万\"诱骗",
    experience: "为给女儿攒学费，阿芳轻信海外保姆招聘，偷渡后被辗转卖到 3 个园区，被迫从事杀猪盘话术。家人收到她最后一条信息是\"妈妈对不起\"。",
    returnHome: "国际刑警联合行动解救，遣返后与 8 岁女儿抱头痛哭。女儿说\"妈妈你瘦了好多\"。",
    currentStatus: "已返乡接受心理康复治疗，女儿所在学校免除了其学杂费。",
    message: "我的女儿终于等到我回家了。请别让另一个妈妈经历这些。",
  },
  {
    id: "vs-003", alias: "阿明（化名）", themeColor: "#FFD666", hotline: "12308",
    title: "程序员的反思",
    profile: "28 岁程序员，被\"海外技术总监年薪百万\"诱骗",
    experience: "阿明以为是去迪拜做技术总监，落地后被没收护照，被迫开发虚拟币诈骗平台。曾试图在代码中留后门报警被发现，遭电击惩罚。",
    returnHome: "通过使馆领事保护通道（12308）获救，回国后主动投案自首，协助警方摧毁诈骗平台。",
    currentStatus: "因自首且有重大立功表现被从轻处理，现为反诈志愿者，向同行宣讲反诈。",
    message: "技术不应成为诈骗工具。我用教训换来的觉悟：凡是\"境外技术岗\"先打 12308 核实。",
  },
  {
    id: "vs-004", alias: "李叔（化名）", themeColor: "#1AD670", hotline: "96110",
    title: "退休老人的觉醒",
    profile: "62 岁退休工人，被\"养老理财高息\"诱骗",
    experience: "李叔被拉入\"养老理财群\"，前期小额返利后投入全部养老金 38 万，平台跑路。老伴气病住院，一度想轻生。",
    returnHome: "经警方紧急止付追回 22 万，剩余资金仍在追缴。社区反诈志愿者定期上门陪伴。",
    currentStatus: "已成为社区反诈宣传员，每周在小区给老人讲反诈课。",
    message: "高息理财把我半辈子积蓄差点卷光。现在我用我的经历提醒更多老伙计。",
  },
  {
    id: "vs-005", alias: "小雨（化名）", themeColor: "#B388FF", hotline: "96110",
    title: "大学生的觉醒",
    profile: "20 岁大学生，被\"刷单兼职日入 500\"诱骗",
    experience: "小雨想赚生活费，从刷单小单 30 元返利开始，被诱导垫付 8000 元\"解冻保证金\"，随后被拉黑。不敢告诉家人，失眠一个月。",
    returnHome: "在室友鼓励下报警，警方顺线打掉一个刷单团伙。学校心理老师介入辅导。",
    currentStatus: "已追回部分损失，成立校园反诈社团，新生入学必讲反诈课。",
    message: "刷单就是诈骗，前期返利都是诱饵。希望学弟学妹们别重蹈我的覆辙。",
  },
  {
    id: "vs-006", alias: "王姐（化名）", themeColor: "#FFB020", hotline: "96110",
    title: "家庭主妇的醒悟",
    profile: "40 岁家庭主妇，被\"冒充公检法\"诈骗",
    experience: "接到自称\"公安局\"电话，称其涉嫌洗钱需配合调查。在恐惧中按指示转账\"安全账户\"验资，被骗 56 万——这是全家买房的首付。",
    returnHome: "报警后警方紧急止付冻结 31 万，但 25 万已被转移。丈夫没有责怪，全家一起面对。",
    currentStatus: "已追回 31 万，剩余资金追缴中。王姐成为社区反诈讲师，专讲\"冒充公检法\"识别。",
    message: "公检法不会电话办案，更没有\"安全账户\"。我的恐惧差点毁了整个家。",
  },
];

/** 按救援数阈值取故事（救援数越多解锁越多） */
export function getVictimStoryByRescueCount(rescued: number): VictimStoryCard | null {
  // 每 8 名救援解锁一个故事，循环展示
  if (rescued < 8) return null;
  const idx = Math.min(Math.floor(rescued / 8) - 1, VICTIM_STORIES.length - 1);
  return VICTIM_STORIES[idx];
}

// ============ D3：骗子视角复盘剧本 ============

/** 骗子视角复盘剧本池（按园区档位匹配） */
export const DEBRIEF_SCENARIOS: DebriefScenario[] = [
  {
    id: "db-den", tierStructure: "den", title: "妙瓦底招聘骗子的复盘",
    villainMonologue: "我没想到你们能攻进来——我们的招聘广告写得那么完美，\"月入 2 万包食宿\"，多少年轻人抢着来。",
    debriefPoints: [
      { scriptStep: "在招聘群发\"境外高薪\"广告，包装成正规公司", playerCountermeasure: "玩家识破\"境外高薪招聘=电诈陷阱\"，未点击/未投递", lesson: "境外高薪招聘一律是陷阱，认准正规招聘平台核实企业资质。" },
      { scriptStep: "要求偷渡出境，规避边检", playerCountermeasure: "玩家记住\"12308 领事保护热线\"，知道偷渡违法且无保障", lesson: "任何要求偷渡出境的工作都是犯罪，遇困打 12308。" },
      { scriptStep: "没收手机身份证，限制人身自由", playerCountermeasure: "玩家在最初阶段就拒绝，不让骗子有机会控制", lesson: "人身自由一旦失去极难脱身，预防胜于救援。" },
    ],
    villainLesson: "唉，只要年轻人不贪高薪、不信境外招聘，我的工厂就招不到人。这次输在你们反诈意识太强。",
    knowledgePoints: ["境外高薪招聘", "12308 领事保护", "偷越国境罪"],
  },
  {
    id: "db-kokang", tierStructure: "kokang", title: "缅北武装骗子的复盘",
    villainMonologue: "我们武装到牙齿，没想到还是被你们攻破了。我们的杀猪盘剧本那么完美……",
    debriefPoints: [
      { scriptStep: "用高富帅/白富美人设主动加好友，快速暧昧", playerCountermeasure: "玩家识破\"快速暧昧+荐投资=杀猪盘\"", lesson: "网恋对象快速暧昧并引导投资，100% 是杀猪盘。" },
      { scriptStep: "引导下载非正规投资 APP，前期小额返利", playerCountermeasure: "玩家拒绝下载非正规平台 APP", lesson: "投资只认官方平台，非正规 APP 入金=诈骗。" },
      { scriptStep: "提现要求缴\"税费\"\"解冻金\"", playerCountermeasure: "玩家知道\"提现前要交钱=100% 诈骗\"，立即报警", lesson: "提现不收税费/解冻金，要交钱就是诈骗。" },
    ],
    villainLesson: "杀猪盘三件套：高富帅+稳赚不赔+提现要钱。只要玩家记住这三点，我们一个都骗不到。",
    knowledgePoints: ["杀猪盘识别", "非正规平台风险", "提现缴税诈骗"],
  },
  {
    id: "db-hq", tierStructure: "hq", title: "跨境首脑的复盘",
    villainMonologue: "我们的剧本是数据驱动的，每天调整话术……没想到你们能识破所有变种。",
    debriefPoints: [
      { scriptStep: "买卖公民个人信息，精准画像受害者", playerCountermeasure: "玩家保护个人信息，不轻易填写身份证+银行卡", lesson: "信息即画像，任何\"领现金\"要身份证+银行卡都是钓鱼。" },
      { scriptStep: "冒充公检法/客服，利用权威压迫", playerCountermeasure: "玩家知道\"公检法不电话办案\"，挂断回拨官方核实", lesson: "权威来电一律挂断回拨官方号码核实。" },
      { scriptStep: "制造紧迫感，催促立即转账", playerCountermeasure: "玩家不因紧迫感仓促决策，先冷静核实", lesson: "紧迫感是诈骗标志，越急越要冷静。" },
    ],
    villainLesson: "数据+权威+紧迫感，曾经百试百灵。现在你们什么都核实，我们无计可施。",
    knowledgePoints: ["信息保护", "权威诈骗识别", "紧迫感抵抗"],
  },
  {
    id: "db-dubai", tierStructure: "dubai", title: "白手套洗钱的复盘",
    villainMonologue: "我的虚拟币洗钱链路那么隐蔽……你们怎么追到的？",
    debriefPoints: [
      { scriptStep: "诱导受害者购买 USDT 转账", playerCountermeasure: "玩家知道\"虚拟币转账不可逆\"，拒绝向陌生人转 USDT", lesson: "USDT 转账不可逆，向陌生人转币=资金永久损失。" },
      { scriptStep: "通过多个钱包地址混币转移", playerCountermeasure: "玩家不参与\"代挖/代转\"，不交出助记词", lesson: "代挖稳赚是资金盘，助记词=钱包密码不可泄露。" },
      { scriptStep: "境外交易所提币要求缴\"个税/认证金\"", playerCountermeasure: "玩家识破\"提现前要交钱=诈骗\"", lesson: "交易所提币不收个税/认证金，要交钱就是诈骗。" },
    ],
    villainLesson: "链上可追溯，混币也躲不过警方追踪。只要受害者不转 USDT、不交助记词，我就洗不动钱。",
    knowledgePoints: ["虚拟币诈骗", "助记词保护", "链上可追溯"],
  },
  {
    id: "db-wafrica", tierStructure: "wafrica", title: "庞氏主谋的复盘",
    villainMonologue: "我的资金盘日化 2% 看起来那么诱人……没想到你们一个都不上当。",
    debriefPoints: [
      { scriptStep: "宣传\"日化 2%、保本保收益\"", playerCountermeasure: "玩家识破\"保本+高收益\"自相矛盾", lesson: "保本与高收益不可兼得，任何\"保本高收益\"都是骗局。" },
      { scriptStep: "前期小额提现建立信任", playerCountermeasure: "玩家不因前期提现成功而加大投入", lesson: "前期提现是诱饵，加大投入即跑路。" },
      { scriptStep: "拉人头返利，扩散受害", playerCountermeasure: "玩家拒绝拉家人朋友入局", lesson: "拉人头返利是传销结构，扩散即共犯。" },
    ],
    villainLesson: "资金盘的本质是用新钱还旧钱。只要没人加投、没人拉人，盘就转不起来。",
    knowledgePoints: ["资金盘识别", "保本高收益悖论", "传销结构"],
  },
  {
    id: "db-abyss", tierStructure: "abyss", title: "AI 换脸师的复盘",
    villainMonologue: "我的 Deepfake 几可乱真……你们怎么识破的？",
    debriefPoints: [
      { scriptStep: "用 AI 换脸冒充亲友视频通话借款", playerCountermeasure: "玩家要求对方做特定动作（如转头/挡脸）验证", lesson: "视频通话也可能是 AI 换脸，要求做特定动作验证。" },
      { scriptStep: "用 AI 仿声冒充领导电话紧急转账", playerCountermeasure: "玩家挂断后回拨领导原号码核实", lesson: "AI 可仿声，紧急转账要求一律回拨核实。" },
      { scriptStep: "制作 Deepfake 淫秽内容敲诈", playerCountermeasure: "玩家不私下发送面部照片/视频，遇敲诈立即报警", lesson: "不向陌生人发送面部素材，遇 Deepfake 敲诈立即报警不转账。" },
    ],
    villainLesson: "AI 换脸再真也有破绽，只要你们多一道核实，我的技术就失效了。",
    knowledgePoints: ["AI 换脸识别", "AI 仿声核实", "Deepfake 敲诈应对"],
  },
];

/** 按园区档位取复盘剧本 */
export function getDebriefByTier(tierStructure: string): DebriefScenario | null {
  return DEBRIEF_SCENARIOS.find(d => d.tierStructure === tierStructure) ?? null;
}

// ============ C2：天气粒子视觉配置 ============

/** 天气粒子配置表（key = WeatherKind） */
export const WEATHER_PARTICLES: Record<string, WeatherParticleConfig> = {
  sunny:     { weather: "sunny",     particleType: "sun",       count: 12,  color: "#FFE680", speedMul: 0.3,  size: 3, flicker: false },
  storm:     { weather: "storm",     particleType: "rain",      count: 120, color: "#9FE3FF", speedMul: 2.5,  size: 2, flicker: false },
  thunder:   { weather: "thunder",   particleType: "lightning", count: 4,   color: "#FFFFFF", speedMul: 1.0,  size: 6, flicker: true  },
  fog:       { weather: "fog",       particleType: "fog",       count: 30,  color: "#C8D0D8", speedMul: 0.4,  size: 40, flicker: false },
  sandstorm: { weather: "sandstorm", particleType: "sand",      count: 150, color: "#FFB020", speedMul: 3.0,  size: 2, flicker: false },
  aurora:    { weather: "aurora",    particleType: "aurora",    count: 20,  color: "#7BFFC8", speedMul: 0.6,  size: 30, flicker: true  },
};

/** 取天气粒子配置 */
export function getWeatherParticles(weather: string): WeatherParticleConfig | null {
  return WEATHER_PARTICLES[weather] ?? null;
}

// ============ A4：多结局剧情配置 ============

/** 多结局剧情配置（示例：诈园区主线故事） */
export const STORY_MULTI_ENDING: BombStoryMultiEnding = {
  storyId: "bomb-main-story",
  branchNodes: [
    {
      id: "branch-1", triggerStageIdx: 2, title: "线人接头",
      scene: "打入园区内部的线人发来情报：妙瓦底园区下周将有一批新受害者被诱骗入境。你可以选择立即行动，或先搜集更多证据。",
      choices: [
        { text: "立即协调多国警方联合行动，争分夺秒救人", leadsTo: "normal", result: "行动成功但部分证据未固定，Boss 侥幸逃脱一部分", nextStageBossHpMul: 1.0, optimal: false },
        { text: "先固定完整证据链，再申请联合执法", leadsTo: "true", result: "证据链完整，一网打尽，Boss 被从重处罚", nextStageBossHpMul: 0.85, optimal: true },
        { text: "派卧底深入园区内部接应", leadsTo: "hidden", result: "卧底冒险成功，但过程惊险，解锁隐藏剧情", nextStageBossHpMul: 0.9, optimal: false },
      ],
    },
    {
      id: "branch-2", triggerStageIdx: 4, title: "资金链追踪",
      scene: "在迪拜园区发现跨境资金流向暗网。你可以选择追资金、追人，或追技术源头。",
      choices: [
        { text: "追资金链，冻结境外账户", leadsTo: "normal", result: "冻结部分账户，但技术源头未除，诈骗变种再生", nextStageBossHpMul: 1.0, optimal: false },
        { text: "追技术源头，攻入暗网深渊", leadsTo: "true", result: "直捣 AI 换脸工厂，根除新型电诈源头", nextStageBossHpMul: 0.85, optimal: true },
        { text: "追人，跨境抓捕首脑", leadsTo: "hidden", result: "首脑落网但技术外流，解锁隐藏结局", nextStageBossHpMul: 0.9, optimal: false },
      ],
    },
  ],
  endings: [
    { type: "normal", name: "正典结局·执法先锋", desc: "你以反诈警力身份捣毁多个园区，拯救无数受害者。诈骗虽未根除，但你已成为反诈标杆。", unlockCondition: "任意一次分支选择非最优", rewardFragments: 50, themeColor: "#1AD670" },
    { type: "hidden", name: "隐藏结局·卧底档案", desc: "你以卧底身份深入虎穴，付出巨大代价换来核心证据。你的档案被永久封存，但江湖流传你的传说。", unlockCondition: "两次分支均选择\"卧底/追人\"路径", rewardFragments: 80, themeColor: "#B388FF" },
    { type: "true", name: "真结局·根除源头", desc: "你不仅捣毁所有园区，更根除了 AI 换脸工厂这一新型电诈源头。诈骗集团就此瓦解，你被授予\"反诈先锋\"勋章。", unlockCondition: "两次分支均选择最优（固定证据链+追技术源头）", rewardFragments: 120, themeColor: "#FFD666" },
  ],
};

/** 取多结局剧情配置 */
export function getStoryMultiEnding(): BombStoryMultiEnding {
  return STORY_MULTI_ENDING;
}

/** 根据分支选择记录计算结局类型 */
export function resolveStoryEnding(choiceOptimalFlags: boolean[]): { type: "normal" | "hidden" | "true"; ending: BombStoryMultiEnding["endings"][number] } {
  const allOptimal = choiceOptimalFlags.length > 0 && choiceOptimalFlags.every(v => v);
  const allHidden = choiceOptimalFlags.length > 0 && choiceOptimalFlags.every(v => v === false);
  const multi = STORY_MULTI_ENDING;
  if (allOptimal) {
    return { type: "true", ending: multi.endings.find(e => e.type === "true")! };
  }
  if (allHidden) {
    return { type: "hidden", ending: multi.endings.find(e => e.type === "hidden")! };
  }
  return { type: "normal", ending: multi.endings.find(e => e.type === "normal")! };
}

// ============ B2：反诈热点案例池 ============

/** 反诈热点案例池（按园区档位匹配，Boss 击败后展示最新案例） */
export const HOTSPOT_CASES: HotspotCase[] = [
  {
    id: "hs-001", tierStructure: "den", scamType: "境外高薪招聘诈骗",
    title: "公安部联合缅甸警方捣毁妙瓦底电诈园区",
    date: "2026-07-15", source: "公安部新闻通报",
    summary: "中缅泰三方联合执法，捣毁妙瓦底地区电诈窝点 12 个，抓获嫌疑人 230 余名，解救被困人员 87 名。",
    takeaway: "境外高薪招聘是电诈陷阱，勿信勿往；被困人员可联系使馆求助。",
    hotline: "12308", severity: 5,
  },
  {
    id: "hs-002", tierStructure: "kokang", scamType: "杀猪盘",
    title: "缅北杀猪盘集团覆灭记",
    date: "2026-06-20", source: "国家反诈中心通报",
    summary: "警方跨境追捕，打掉一个在缅北运营的杀猪盘集团，涉案金额超 3 亿元，受害者遍布全国。",
    takeaway: "网恋+荐投资=杀猪盘；提现要交钱=100% 诈骗。",
    hotline: "96110", severity: 5,
  },
  {
    id: "hs-003", tierStructure: "hq", scamType: "侵犯公民个人信息",
    title: "暗网数据交易平台被打掉",
    date: "2026-05-08", source: "网信办联合公安部通报",
    summary: "警方打掉一个暗网公民个人信息交易平台，查获个人信息 1.2 亿条，抓获嫌疑人 45 名。",
    takeaway: "个人信息即画像，任何\"领现金\"要身份证+银行卡都是钓鱼。",
    hotline: "96110", severity: 4,
  },
  {
    id: "hs-004", tierStructure: "dubai", scamType: "虚拟币洗钱",
    title: "跨境虚拟币洗钱团伙被捣毁",
    date: "2026-04-12", source: "央行联合公安部通报",
    summary: "警方破获一个通过 USDT 跨境洗钱团伙，洗钱规模超 10 亿元，冻结涉案账户 200 余个。",
    takeaway: "USDT 转账不可逆，向陌生人转币=资金永久损失。",
    hotline: "96110", severity: 5,
  },
  {
    id: "hs-005", tierStructure: "wafrica", scamType: "庞氏资金盘",
    title: "西非庞氏资金盘跨国诈骗案",
    date: "2026-03-25", source: "公安部国际刑警联合通报",
    summary: "国际刑警联合行动，打掉一个在西非运营的庞氏资金盘，涉案金额超 5 亿元，受害者 10 万余人。",
    takeaway: "保本+高收益自相矛盾，前期返利是诱饵，加大投入即跑路。",
    hotline: "96110", severity: 5,
  },
  {
    id: "hs-006", tierStructure: "abyss", scamType: "AI 换脸诈骗",
    title: "AI 换脸冒充亲友诈骗案",
    date: "2026-07-01", source: "国家反诈中心预警",
    summary: "骗子利用 AI 换脸技术冒充受害者亲友视频通话借款，单案最高被骗 80 万元。警方提醒视频通话要求做特定动作验证。",
    takeaway: "视频通话也可能是 AI 换脸，要求做特定动作验证；紧急借款一律回拨核实。",
    hotline: "96110", severity: 5,
  },
  {
    id: "hs-007", tierStructure: "abyss", scamType: "Deepfake 敲诈",
    title: "Deepfake 淫秽内容敲勒案",
    date: "2026-06-05", source: "公安部通报",
    summary: "犯罪团伙用 AI 合成受害者面部淫秽内容进行敲诈，涉案 200 余起。警方提醒不向陌生人发送面部素材，遇敲诈立即报警。",
    takeaway: "不向陌生人发送面部素材，遇 Deepfake 敲诈立即报警不转账。",
    hotline: "110", severity: 5,
  },
];

/** 按园区档位取最新热点案例（无匹配则取全局最新） */
export function getHotspotByTier(tierStructure: string): HotspotCase | null {
  const matches = HOTSPOT_CASES.filter(c => c.tierStructure === tierStructure);
  if (matches.length > 0) {
    // 按日期降序取最新
    return matches.sort((a, b) => b.date.localeCompare(a.date))[0];
  }
  // 兜底：取全局最新
  const sorted = [...HOTSPOT_CASES].sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0] ?? null;
}

