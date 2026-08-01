import type {
  ThunderAnalyticsDashboard, ThunderAbilityRadar, ThunderWeaknessReport,
  ThunderPlayerProfile, ThunderAbilityDimension, ThunderSaveData, ThunderMode,
} from "./types";

// ===========================================================================
// ===== v7 升级：数据仪表板 / 能力雷达 / 弱点报告 / 玩家画像 =================
// ===========================================================================

/** 能力雷达图 6 维度定义 */
export const THUNDER_ABILITY_DIMENSIONS: { key: ThunderAbilityDimension; name: string; desc: string }[] = [
  { key: "recognition", name: "识别能力", desc: "识破电诈话术、辨认诈骗类型的能力" },
  { key: "defense",     name: "防御能力", desc: "抵挡弹幕、击败 BOSS 的战斗防御表现" },
  { key: "reflex",      name: "反应速度", desc: "擦弹与格挡等瞬间反应操作" },
  { key: "knowledge",   name: "知识广度", desc: "反诈知识图谱与课程掌握程度" },
  { key: "decision",    name: "决策能力", desc: "RPG 剧本中的识破决策准确度" },
  { key: "endurance",   name: "持久力",   desc: "长局/无尽模式的持续作战表现" },
];

/** 返回能力维度列表 */
export function getAbilityDimensions(): { key: ThunderAbilityDimension; name: string; desc: string }[] {
  return THUNDER_ABILITY_DIMENSIONS;
}

/** 取当天日期 YYYY-MM-DD（本地时区） */
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 限定数值到 [lo, hi] 区间 */
function clampNum(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * 根据分数返回评级
 * S(>=85) / A(>=70) / B(>=55) / C(>=40) / D(<40)
 */
export function getAbilityGrade(score: number): { grade: ThunderAbilityRadar["grade"]; desc: string } {
  if (score >= 85) return { grade: "S", desc: "反诈大师：综合能力卓越" };
  if (score >= 70) return { grade: "A", desc: "反诈专家：能力出色" };
  if (score >= 55) return { grade: "B", desc: "反诈能手：基础扎实" };
  if (score >= 40) return { grade: "C", desc: "反诈学员：仍需提升" };
  return { grade: "D", desc: "反诈新手：建议系统学习" };
}

/**
 * 构建能力雷达图：基于存档数据计算各维度得分 0..100
 */
export function buildAbilityRadar(save: ThunderSaveData): ThunderAbilityRadar {
  // ===== recognition 识别能力：识破数 + 诈骗类型多样性 =====
  // totalBusted 每 10 次 = 1 分，上限 60
  const bustedScore = clampNum((save.totalBusted || 0) / 10, 0, 60);
  // fraudKills 覆盖类型数：每覆盖一种 = 5 分，上限 40（8 种即满分）
  const fraudTypeCount = Object.keys(save.fraudKills || {}).filter(k => (save.fraudKills[k] || 0) > 0).length;
  const diversityScore = clampNum(fraudTypeCount * 5, 0, 40);
  const recognition = clampNum(bustedScore + diversityScore, 0, 100);

  // ===== defense 防御能力：BOSS 击杀 + 无尽波次 =====
  // totalBossKills 每 1 只 = 2 分，上限 60
  const bossKillScore = clampNum((save.totalBossKills || 0) * 2, 0, 60);
  // bestEndlessWave 每 1 波 = 4 分，上限 40
  const endlessWaveScore = clampNum((save.bestEndlessWave || 0) * 4, 0, 40);
  const defense = clampNum(bossKillScore + endlessWaveScore, 0, 100);

  // ===== reflex 反应速度：擦弹 + 格挡 =====
  // totalGrazeCount 每 10 次 = 1 分，上限 50
  const grazeScore = clampNum((save.totalGrazeCount || 0) / 10, 0, 50);
  // totalParryCount 每 5 次 = 1 分，上限 50
  const parryScore = clampNum((save.totalParryCount || 0) / 5, 0, 50);
  const reflex = clampNum(grazeScore + parryScore, 0, 100);

  // ===== knowledge 知识广度：图谱掌握度 + 课程章节数 =====
  // knowledgeMastery 平均掌握度 * 60
  const masteryValues = Object.values(save.knowledgeMastery || {});
  const avgMastery = masteryValues.length > 0
    ? masteryValues.reduce((s, v) => s + v, 0) / masteryValues.length
    : 0;
  const masteryScore = clampNum(avgMastery * 60, 0, 60);
  // lessonClearedChapters 每章 = 8 分，上限 40
  const lessonScore = clampNum((save.lessonClearedChapters?.length || 0) * 8, 0, 40);
  const knowledge = clampNum(masteryScore + lessonScore, 0, 100);

  // ===== decision 决策能力：RPG 剧本数 + 完美通关率 =====
  // rpgClearedScenarios 每本 = 15 分，上限 60
  const rpgScore = clampNum((save.rpgClearedScenarios?.length || 0) * 15, 0, 60);
  // 完美通关率：存档未单独记录 perfect 标记，以最近 10 局胜率近似
  const recentRuns = save.adaptiveRecentRuns || [];
  const winRate = recentRuns.length > 0
    ? recentRuns.filter(r => r.win).length / recentRuns.length
    : 0;
  const winRateScore = clampNum(winRate * 40, 0, 40);
  const decision = clampNum(rpgScore + winRateScore, 0, 100);

  // ===== endurance 持久力：游戏时长 + 无尽波次 =====
  // totalPlayTime 每 600 秒 = 1 分，上限 60（约 100 分钟满分）
  const playTimeScore = clampNum((save.totalPlayTime || 0) / 600, 0, 60);
  const enduranceWaveScore = clampNum((save.bestEndlessWave || 0) * 4, 0, 40);
  const endurance = clampNum(playTimeScore + enduranceWaveScore, 0, 100);

  const dimensions: Record<ThunderAbilityDimension, number> = {
    recognition,
    defense,
    reflex,
    knowledge,
    decision,
    endurance,
  };

  // ===== overall：6 维度加权平均 =====
  // 权重：识别 0.20 / 防御 0.15 / 反应 0.20 / 知识 0.15 / 决策 0.15 / 持久 0.15
  const overall = clampNum(
    recognition * 0.2 +
    defense * 0.15 +
    reflex * 0.2 +
    knowledge * 0.15 +
    decision * 0.15 +
    endurance * 0.15,
    0, 100,
  );

  const { grade, desc } = getAbilityGrade(overall);

  return { dimensions, overall, grade, gradeDesc: desc };
}

/** 根据最弱诈骗类型 ID 推荐学习章节 */
function recommendLessonForFraud(fraudTypeId?: string): string | undefined {
  if (!fraudTypeId) return undefined;
  // 简单映射：诈骗类型 → 章节前缀，实际可由 data.ts 扩展
  return `LESSON-${fraudTypeId}-01`;
}

/**
 * 构建弱点报告
 */
export function buildWeaknessReport(save: ThunderSaveData): ThunderWeaknessReport {
  // ===== 最弱诈骗类型：fraudKills 中击杀最少的类型 =====
  const fraudKills = save.fraudKills || {};
  const fraudEntries = Object.entries(fraudKills).filter(([, n]) => n > 0);
  let weakestFraudTypeId: string | undefined;
  let weakestFraudTypeRate: number | undefined;
  if (fraudEntries.length > 0) {
    const totalKills = fraudEntries.reduce((s, [, n]) => s + n, 0);
    // 按 kills 升序取第一个（击杀最少 = 最弱）
    fraudEntries.sort((a, b) => a[1] - b[1]);
    weakestFraudTypeId = fraudEntries[0][0];
    // 击杀占比越低 = 越弱（以占比近似正确率反比）
    weakestFraudTypeRate = totalKills > 0 ? fraudEntries[0][1] / totalKills : 0;
  }

  // ===== 最弱能力维度 =====
  const radar = buildAbilityRadar(save);
  let weakestDimension: ThunderAbilityDimension | undefined;
  let weakestDimensionScore: number | undefined;
  let minScore = Infinity;
  (Object.keys(radar.dimensions) as ThunderAbilityDimension[]).forEach(k => {
    const v = radar.dimensions[k];
    if (v < minScore) {
      minScore = v;
      weakestDimension = k;
      weakestDimensionScore = v;
    }
  });

  // ===== 推荐训练模式与关卡 =====
  let recommendedMode: ThunderMode | undefined;
  let recommendedStageId: string | undefined;
  if (weakestDimension === "recognition") {
    recommendedMode = "campaign";
    recommendedStageId = "STORY-01";
  } else if (weakestDimension === "defense") {
    recommendedMode = "bossRush";
  } else if (weakestDimension === "reflex") {
    recommendedMode = "challenge";
  } else if (weakestDimension === "knowledge") {
    recommendedMode = "lesson";
    recommendedStageId = "LESSON-01";
  } else if (weakestDimension === "decision") {
    recommendedMode = "rpg";
  } else if (weakestDimension === "endurance") {
    recommendedMode = "endless";
  }

  // ===== 严重度：基于最弱维度得分 =====
  let severityLabel: string;
  if (weakestDimensionScore === undefined || weakestDimensionScore < 30) {
    severityLabel = "高发";
  } else if (weakestDimensionScore < 60) {
    severityLabel = "中发";
  } else {
    severityLabel = "低发";
  }

  return {
    weakestFraudTypeId,
    weakestFraudTypeRate,
    weakestDimension,
    weakestDimensionScore,
    recommendedMode,
    recommendedStageId,
    recommendedLessonId: recommendLessonForFraud(weakestFraudTypeId),
    reportDate: todayStr(),
    severityLabel,
  };
}

/**
 * 构建玩家画像
 */
export function buildPlayerProfile(save: ThunderSaveData): ThunderPlayerProfile {
  // ===== skillScore：综合技能评分 =====
  const skillScore = clampNum(save.adaptiveSkillScore || 0, 0, 100);

  // ===== reflexScore：擦弹 + 格挡评分（各占 50%） =====
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

  // ===== 推荐训练：复用弱点报告 =====
  const weakness = buildWeaknessReport(save);

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
    recommendedMode: weakness.recommendedMode,
    recommendedStageId: weakness.recommendedStageId,
  };
}

/**
 * 构建完整数据仪表板
 */
export function buildAnalyticsDashboard(save: ThunderSaveData): ThunderAnalyticsDashboard {
  const abilityRadar = buildAbilityRadar(save);
  const weaknessReport = buildWeaknessReport(save);
  const playerProfile = buildPlayerProfile(save);

  // ===== 累计统计 =====
  const totals = {
    totalPlayTime: save.totalPlayTime || 0,
    totalBossKills: save.totalBossKills || 0,
    totalBusted: save.totalBusted || 0,
    totalGraze: save.totalGrazeCount || 0,
    totalParry: save.totalParryCount || 0,
    totalRPGCleared: save.totalRPGCleared || 0,
    totalLessonsCleared: save.totalLessonsCleared || 0,
  };

  // ===== 各模式胜率：从 adaptiveRecentRuns 按模式聚合 =====
  const recentRuns = save.adaptiveRecentRuns || [];
  const winRateByMode: Record<string, { wins: number; total: number; rate: number }> = {};
  for (const r of recentRuns) {
    const key = r.mode;
    if (!winRateByMode[key]) winRateByMode[key] = { wins: 0, total: 0, rate: 0 };
    winRateByMode[key].total++;
    if (r.win) winRateByMode[key].wins++;
  }
  Object.keys(winRateByMode).forEach(k => {
    const m = winRateByMode[k];
    m.rate = m.total > 0 ? m.wins / m.total : 0;
  });

  // ===== 最近 30 天活跃日期：从 adaptiveRecentRuns 提取 =====
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const dateSet = new Set<string>();
  for (const r of recentRuns) {
    // r.at 形如 YYYY-MM-DD 或 ISO 字符串
    const t = Date.parse(r.at);
    if (!Number.isNaN(t) && now - t <= thirtyDaysMs) {
      const d = new Date(t);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dateSet.add(`${y}-${m}-${day}`);
    }
  }
  const recentActiveDates = Array.from(dateSet).sort();

  return {
    abilityRadar,
    weaknessReport,
    playerProfile,
    totals,
    fraudKillsByType: { ...(save.fraudKills || {}) },
    winRateByMode,
    recentActiveDates,
  };
}

// ===== analytics.ts · v7 数据仪表板模块结束 =====
