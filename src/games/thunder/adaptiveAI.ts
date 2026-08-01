import type {
  ThunderAdaptiveState, ThunderAdaptiveConfig, ThunderPlayerProfile,
  ThunderSaveData, ThunderMode, Difficulty, DifficultyConfig,
} from "./types";

// ===========================================================================
// ===== v7 升级：自适应难度 AI ===============================================
// ===========================================================================

/** 自适应 AI 全局配置 */
export const THUNDER_ADAPTIVE_CONFIG: ThunderAdaptiveConfig = {
  enabled: true,
  minSkillScore: 0,
  maxSkillScore: 100,
  minDifficultyMul: 0.7,   // 弱玩家减难 30%
  maxDifficultyMul: 1.5,   // 强玩家加难 50%
  maxDeltaPerRun: 8,       // 单局最多变化 8 分
  trendWindow: 10,
};

/** 限定数值到 [lo, hi] */
function clampNum(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * 计算难度倍率：skillScore 0..100 → minDifficultyMul..maxDifficultyMul
 * 50 分对应 1.0（标准难度），使用分段线性插值保证平滑
 */
export function calcDifficultyMul(
  skillScore: number,
  config: ThunderAdaptiveConfig = THUNDER_ADAPTIVE_CONFIG,
): number {
  const s = clampNum(skillScore, config.minSkillScore, config.maxSkillScore);
  // 分段线性插值：0→min, 50→1.0, 100→max
  if (s <= 50) {
    // 低位段：min → 1.0（s/50 比例）
    return config.minDifficultyMul + (s / 50) * (1.0 - config.minDifficultyMul);
  }
  // 高位段：1.0 → max（(s-50)/50 比例）
  return 1.0 + ((s - 50) / 50) * (config.maxDifficultyMul - 1.0);
}

/**
 * 根据难度倍率计算各维度倍率
 * 以 difficultyMul = 1.0 为标准，各维度按公式线性偏移
 */
export function calcDifficultyMultipliers(difficultyMul: number): {
  enemyHpMul: number;
  enemySpeedMul: number;
  enemyFireMul: number;
  dropMul: number;
  bossHpMul: number;
} {
  // enemyHpMul: 0.8 + 0.4 * (mul - 1)，标准 1.0
  const enemyHpMul = 0.8 + 0.4 * (difficultyMul - 1);
  // enemySpeedMul: 0.85 + 0.3 * (mul - 1)
  const enemySpeedMul = 0.85 + 0.3 * (difficultyMul - 1);
  // enemyFireMul: 0.9 + 0.2 * (mul - 1)（越小越快）
  const enemyFireMul = 0.9 + 0.2 * (difficultyMul - 1);
  // dropMul: 1.2 - 0.4 * (mul - 1)（弱玩家掉落更多）
  const dropMul = 1.2 - 0.4 * (difficultyMul - 1);
  // bossHpMul: 0.7 + 0.6 * (mul - 1)
  const bossHpMul = 0.7 + 0.6 * (difficultyMul - 1);
  return { enemyHpMul, enemySpeedMul, enemyFireMul, dropMul, bossHpMul };
}

/**
 * 根据初始技能评分构建自适应状态
 */
export function initAdaptiveState(skillScore: number): ThunderAdaptiveState {
  const difficultyMul = calcDifficultyMul(skillScore);
  const m = calcDifficultyMultipliers(difficultyMul);
  return {
    skillScore: clampNum(skillScore, 0, 100),
    difficultyMul,
    enemyHpMul: m.enemyHpMul,
    enemySpeedMul: m.enemySpeedMul,
    enemyFireMul: m.enemyFireMul,
    dropMul: m.dropMul,
    bossHpMul: m.bossHpMul,
    trend: "stable",
    lastDelta: 0,
  };
}

/**
 * 根据本局表现更新技能评分
 * - 胜利 +2~+5，失败 -2~-5，完美胜利 +8
 * - delta 限制在 [-maxDeltaPerRun, +maxDeltaPerRun]，避免剧烈波动
 * - newScore 限制在 [0, 100]
 */
export function updateSkillScore(
  currentScore: number,
  runResult: {
    score: number;
    win: boolean;
    mode: ThunderMode;
    durationSec: number;
    perfect: boolean;
    bustCount: number;
  },
  config: ThunderAdaptiveConfig = THUNDER_ADAPTIVE_CONFIG,
): { newScore: number; delta: number } {
  let delta: number;

  if (runResult.win && runResult.perfect) {
    // 完美胜利：固定 +8
    delta = 8;
  } else if (runResult.win) {
    // 普通胜利：+2..+5
    // 基础 +2，高分 +1，识破多 +1，速通 +1
    delta = 2;
    if (runResult.score > 5000) delta += 1;
    if (runResult.bustCount >= 5) delta += 1;
    if (runResult.durationSec > 0 && runResult.durationSec < 120) delta += 1;
    delta = clampNum(delta, 2, 5);
  } else {
    // 失败：-2..-5
    // 基础 -2，低分 -1，速死 -1，零识破 -1
    delta = -2;
    if (runResult.score < 1000) delta -= 1;
    if (runResult.durationSec > 0 && runResult.durationSec < 60) delta -= 1;
    if (runResult.bustCount === 0) delta -= 1;
    delta = clampNum(delta, -5, -2);
  }

  // 限制单局变化幅度，避免剧烈波动
  delta = clampNum(delta, -config.maxDeltaPerRun, config.maxDeltaPerRun);

  // 新分数限制在 [minSkillScore, maxSkillScore]
  const newScore = clampNum(currentScore + delta, config.minSkillScore, config.maxSkillScore);
  // 实际 delta 可能因边界裁剪而与理论值不同
  const realDelta = newScore - currentScore;

  return { newScore, delta: realDelta };
}

/**
 * 分析最近 10 局趋势
 * 计算最近 5 局 vs 之前 5 局的平均 skillDelta
 * - 改善 > 2 = "improving"
 * - 下降 > 2 = "declining"
 * - 其他 = "stable"
 */
export function calcTrend(
  recentRuns: ThunderPlayerProfile["recentRuns"],
): "improving" | "stable" | "declining" {
  if (!recentRuns || recentRuns.length === 0) return "stable";
  // 取最近 trendWindow（默认 10）局
  const window = recentRuns.slice(-THUNDER_ADAPTIVE_CONFIG.trendWindow);
  if (window.length < 2) return "stable";

  // 拆成前半段与后半段（各 5 局，不足时按中点拆分）
  const mid = Math.floor(window.length / 2);
  const prevSlice = window.slice(0, mid);
  const recentSlice = window.slice(mid);
  if (prevSlice.length === 0 || recentSlice.length === 0) return "stable";

  const avg = (arr: typeof window) =>
    arr.reduce((s, r) => s + (r.skillDelta || 0), 0) / arr.length;
  const avgPrev = avg(prevSlice);
  const avgRecent = avg(recentSlice);
  const diff = avgRecent - avgPrev;

  // 改善 > 2 = improving，下降 > 2 = declining
  if (diff > 2) return "improving";
  if (diff < -2) return "declining";
  return "stable";
}

/** 基础难度配置（本地副本，避免依赖 data.ts 产生循环引用） */
const BASE_DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  normal: {
    id: "normal", name: "普通", desc: "标准难度", color: "#52C41A",
    enemyHpMul: 1.0, enemySpeedMul: 1.0, enemyFireMul: 1.0,
    dropMul: 1.0, bossHpMul: 1.0, playerHpMul: 1.0, scoreMul: 1.0, ultChargeMul: 1.0,
  },
  hard: {
    id: "hard", name: "困难", desc: "敌人更强", color: "#FF7A1A",
    enemyHpMul: 1.3, enemySpeedMul: 1.2, enemyFireMul: 0.85,
    dropMul: 0.9, bossHpMul: 1.4, playerHpMul: 0.85, scoreMul: 1.3, ultChargeMul: 0.9,
  },
  nightmare: {
    id: "nightmare", name: "噩梦", desc: "极限挑战", color: "#FF4D4F",
    enemyHpMul: 1.7, enemySpeedMul: 1.4, enemyFireMul: 0.7,
    dropMul: 0.8, bossHpMul: 1.8, playerHpMul: 0.7, scoreMul: 1.6, ultChargeMul: 0.8,
  },
};

/**
 * 将自适应倍率应用到基础难度配置，返回调整后的 DifficultyConfig
 * 敌人 HP/速度/开火/掉落/BOSS HP 维度叠加自适应倍率
 * playerHpMul / scoreMul / ultChargeMul 保留基础值（不受自适应影响）
 */
export function applyAdaptiveToDifficulty(
  baseDifficulty: Difficulty,
  state: ThunderAdaptiveState,
): DifficultyConfig {
  const base = BASE_DIFFICULTY_CONFIGS[baseDifficulty] || BASE_DIFFICULTY_CONFIGS.normal;
  // 各维度倍率叠加：基础 * 自适应
  return {
    ...base,
    enemyHpMul: base.enemyHpMul * state.enemyHpMul,
    enemySpeedMul: base.enemySpeedMul * state.enemySpeedMul,
    enemyFireMul: base.enemyFireMul * state.enemyFireMul,
    dropMul: base.dropMul * state.dropMul,
    bossHpMul: base.bossHpMul * state.bossHpMul,
  };
}

/**
 * 根据玩家画像推荐下一步内容
 * 优先级：技能低→课程；弱点诈骗类型→RPG；剧情未完→剧情；课程未完→课程；RPG 未完→RPG；高分→段位赛；默认→无尽
 */
export function getRecommendedContent(save: ThunderSaveData): {
  mode: ThunderMode;
  stageId?: string;
  reason: string;
} {
  const skillScore = clampNum(save.adaptiveSkillScore || 0, 0, 100);
  const lessonCount = save.lessonClearedChapters?.length || 0;
  const rpgCount = save.rpgClearedScenarios?.length || 0;
  const storyCount = save.storyClearedStages?.length || 0;

  // 1) 技能评分低 → 课程学习（打基础）
  if (skillScore < 30) {
    return {
      mode: "lesson",
      stageId: `LESSON-${String(lessonCount + 1).padStart(2, "0")}`,
      reason: "技能评分较低，建议先通过课程系统学习反诈基础知识",
    };
  }

  // 2) 弱点诈骗类型 → RPG 剧本训练决策
  const fraudKills = save.fraudKills || {};
  const fraudEntries = Object.entries(fraudKills).filter(([, n]) => n > 0);
  if (fraudEntries.length > 0) {
    fraudEntries.sort((a, b) => a[1] - b[1]);
    const weakest = fraudEntries[0][0];
    const totalKills = fraudEntries.reduce((s, [, n]) => s + n, 0);
    // 弱点类型击杀占比低于 10% → 针对性 RPG 训练
    if (totalKills > 0 && fraudEntries[0][1] / totalKills < 0.1) {
      return {
        mode: "rpg",
        stageId: `RPG-${weakest}-01`,
        reason: `针对最弱诈骗类型 ${weakest} 进行 RPG 剧本识破训练`,
      };
    }
  }

  // 3) 剧情进度不足 → 继续剧情战役
  if (storyCount < 10) {
    return {
      mode: "story",
      stageId: `STORY-${String(storyCount + 1).padStart(2, "0")}`,
      reason: "推进剧情战役，解锁更多反诈知识点与结局",
    };
  }

  // 4) 课程章节未通关 → 学习课程
  if (lessonCount < 8) {
    return {
      mode: "lesson",
      stageId: `LESSON-${String(lessonCount + 1).padStart(2, "0")}`,
      reason: "继续完成课程章节，提升反诈知识广度",
    };
  }

  // 5) RPG 剧本未完成 → 挑战 RPG
  if (rpgCount < 5) {
    return {
      mode: "rpg",
      stageId: `RPG-${String(rpgCount + 1).padStart(2, "0")}`,
      reason: "挑战 RPG 剧本，锻炼识破决策能力",
    };
  }

  // 6) 高分玩家 → 段位赛/极限挑战
  if (skillScore >= 70) {
    return {
      mode: "ranked",
      reason: "技能出色，挑战段位赛检验真实水平",
    };
  }

  // 7) 默认 → 无尽模式练习
  return {
    mode: "endless",
    reason: "通过无尽模式持续提升持久力与综合表现",
  };
}

/**
 * 从存档构建玩家画像（独立实现，避免与 analytics.ts 循环依赖）
 */
export function buildPlayerProfileFromSave(save: ThunderSaveData): ThunderPlayerProfile {
  // ===== skillScore：综合技能评分 =====
  const skillScore = clampNum(save.adaptiveSkillScore || 0, 0, 100);

  // ===== reflexScore：擦弹 + 格挡（各占 50%） =====
  const reflexScore = clampNum(
    (save.totalGrazeCount || 0) / 10 * 0.5 + (save.totalParryCount || 0) / 5 * 0.5,
    0, 100,
  );

  // ===== decisionScore：RPG 识破率（rpgClearedScenarios + totalBusted 推算） =====
  const decisionScore = clampNum(
    clampNum((save.rpgClearedScenarios?.length || 0) * 10, 0, 50) +
    clampNum((save.totalBusted || 0) / 10, 0, 50),
    0, 100,
  );

  // ===== resourceScore：道具/大招使用评分（talentPoints + playTime 推算） =====
  const resourceScore = clampNum(
    clampNum((save.talentPoints || 0) / 2, 0, 50) +
    clampNum((save.totalPlayTime || 0) / 1200, 0, 50),
    0, 100,
  );

  // ===== enduranceScore：长局表现评分（playTime + bestEndlessWave） =====
  const enduranceScore = clampNum(
    clampNum((save.totalPlayTime || 0) / 600, 0, 50) +
    clampNum((save.bestEndlessWave || 0) * 2.5, 0, 50),
    0, 100,
  );

  // ===== 弱点/强项诈骗类型 =====
  const fraudKills = save.fraudKills || {};
  const fraudEntries = Object.entries(fraudKills).filter(([, n]) => n > 0);
  let weakestFraudTypeId: string | undefined;
  let weakestFraudTypeRate: number | undefined;
  let strongestFraudTypeId: string | undefined;
  if (fraudEntries.length > 0) {
    const totalKills = fraudEntries.reduce((s, [, n]) => s + n, 0);
    fraudEntries.sort((a, b) => a[1] - b[1]);
    weakestFraudTypeId = fraudEntries[0][0];
    weakestFraudTypeRate = totalKills > 0 ? fraudEntries[0][1] / totalKills : 0;
    strongestFraudTypeId = fraudEntries[fraudEntries.length - 1][0];
  }

  // ===== 推荐训练：复用推荐内容 =====
  const rec = getRecommendedContent(save);

  return {
    version: save.adaptiveProfileVersion || 0,
    skillScore,
    reflexScore,
    decisionScore,
    resourceScore,
    enduranceScore,
    recentRuns: (save.adaptiveRecentRuns || []).slice(-10),
    weakestFraudTypeId,
    weakestFraudTypeRate,
    strongestFraudTypeId,
    recommendedMode: rec.mode,
    recommendedStageId: rec.stageId,
  };
}

// ===== adaptiveAI.ts · v7 自适应难度 AI 模块结束 =====
