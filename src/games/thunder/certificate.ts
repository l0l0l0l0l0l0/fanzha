import type {
  ThunderCertificateDef,
  ThunderCertificateProgress,
  ThunderCertificateType,
  ThunderCertificateLevel,
} from "./types";
import type { ThunderSaveData } from "./types";

// ===========================================================================
// ===== v7 升级：反诈能力认证证书系统 ========================================
// 雷霆反诈·反诈能力认证：以证书形式记录玩家在各类反诈能力上的成长轨迹。
// 8 张证书覆盖剧情/课程/RPG/知识图谱/BOSS/连胜/学者/守护者，
// 前 6 张为单项能力证书，后 2 张为综合荣誉证书。
// ===========================================================================

/** 证书等级 → 主题色 */
export const CERT_LEVEL_COLOR: Record<ThunderCertificateLevel, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
  diamond: "#B9F2FF",
};

/**
 * v7 反诈能力认证证书列表（8 张，覆盖全部 ThunderCertificateType）
 * 等级从低到高：bronze → silver → gold → platinum → diamond
 */
export const THUNDER_CERTIFICATES: ThunderCertificateDef[] = [
  // ============ 剧情通关大师 ============
  {
    id: "CERT-STORY-MASTER",
    type: "storyMaster",
    name: "剧情通关大师·金",
    icon: "📖",
    color: CERT_LEVEL_COLOR.gold,
    level: "gold",
    desc: "完整体验雷霆反诈剧情战役全部关卡，见证反诈战士的成长故事。",
    condition: "通关全部 10 个剧情关卡",
    citation: "你走完了整条剧情线，从第一个敌人到最终结局——这不只是一场游戏，更是一次完整的反诈修行。每一关的故事，都藏着真实世界的影子。",
    target: 10,
    relatedMode: "story",
  },

  // ============ 课程毕业 ============
  {
    id: "CERT-LESSON-GRAD",
    type: "lessonGraduate",
    name: "反诈课程毕业生·银",
    icon: "🎓",
    color: CERT_LEVEL_COLOR.silver,
    level: "silver",
    desc: "系统学习全部 6 章反诈课程，从识别到应对全面掌握。",
    condition: "完成全部 6 个课程章节",
    citation: "毕业不是终点，而是反诈意识的起点。你用 6 章课程为自己装上了一副识破骗局的眼睛——这副眼睛，会陪你走很久。",
    target: 6,
    relatedMode: "lesson",
  },

  // ============ RPG 剧本专家 ============
  {
    id: "CERT-RPG-EXPERT",
    type: "rpgExpert",
    name: "RPG 剧本专家·金",
    icon: "🎭",
    color: CERT_LEVEL_COLOR.gold,
    level: "gold",
    desc: "以第一人称视角通关全部 6 个沉浸式反诈 RPG 剧本，在对话与决策中识破骗局。",
    condition: "通关全部 6 个 RPG 剧本",
    citation: "你在 6 段人生里做了 6 次正确的选择。那些剧本里的犹豫和顿悟，都会变成现实里的肌肉记忆——当你真的接到那通电话时，你会记得今天的故事。",
    target: 6,
    relatedMode: "rpg",
  },

  // ============ 知识图谱大师 ============
  {
    id: "CERT-KNOWLEDGE-SAGE",
    type: "knowledgeSage",
    name: "知识图谱大师·白金",
    icon: "🧠",
    color: CERT_LEVEL_COLOR.platinum,
    level: "platinum",
    desc: "掌握反诈知识图谱全部 20 个节点，从识别到流程、从心理到法律，全面贯通。",
    condition: "掌握 20 个知识图谱节点",
    citation: "知识不是孤岛，而是星图。你点亮了 20 颗星，也连出了属于自己的反诈宇宙——每一个节点，都是一次「原来如此」的瞬间。",
    target: 20,
  },

  // ============ BOSS 击败者 ============
  {
    id: "CERT-BOSS-SLAYER",
    type: "bossSlayer",
    name: "BOSS 击败者·铜",
    icon: "⚔️",
    color: CERT_LEVEL_COLOR.bronze,
    level: "bronze",
    desc: "在战斗中击败 8 个特色电诈 BOSS，用实力证明反诈不止是纸上谈兵。",
    condition: "击败 8 个 BOSS",
    citation: "每一场 BOSS 战都是一次套路拆解。你用火力击碎了它们的伪装，也用行动证明——反诈不只是听道理，更是真刀真枪的应对。",
    target: 8,
  },

  // ============ 完美连胜 ============
  {
    id: "CERT-PERFECT-STREAK",
    type: "perfectStreak",
    name: "完美连胜·金",
    icon: "🔥",
    color: CERT_LEVEL_COLOR.gold,
    level: "gold",
    desc: "最近 5 局全部完美通关，状态如日中天。",
    condition: "最近 5 局完美通关",
    citation: "连胜不是运气，是手感的沉淀。连续 5 局完美通关，说明反诈已经刻进了你的反应里——骗子最怕的，就是你这种状态在线的人。",
    target: 5,
  },

  // ============ 反诈学者（综合） ============
  {
    id: "CERT-SCHOLAR",
    type: "scholar",
    name: "反诈学者·白金",
    icon: "📚",
    color: CERT_LEVEL_COLOR.platinum,
    level: "platinum",
    desc: "获得 5 张其他类型证书，反诈能力全面开花。",
    condition: "获得 5 张其他类型证书",
    citation: "学者不是读得多，而是懂得融会贯通。你在 5 个领域都拿到了认证，意味着你不只有一招——你的反诈能力，已经立体了。",
    target: 5,
  },

  // ============ 反诈守护者（最高荣誉） ============
  {
    id: "CERT-GUARDIAN",
    type: "guardian",
    name: "反诈守护者·钻石",
    icon: "🛡️",
    color: CERT_LEVEL_COLOR.diamond,
    level: "diamond",
    desc: "获得全部 7 张其他证书，反诈能力的集大成者。",
    condition: "获得全部 7 张其他证书",
    citation: "守护者，是反诈之路的终点，也是新的起点。你集齐了 7 张证书，也集齐了 7 种守护自己和他人的能力——从今天起，你不只是反诈玩家，你是反诈守护者。把这身本事，带给身边的人吧。",
    target: 7,
  },
];

// ===========================================================================
// ===== v7 证书辅助函数 =====================================================
// ===========================================================================

/** 根据 ID 获取证书 */
export function getCertificateById(id: string): ThunderCertificateDef | undefined {
  return THUNDER_CERTIFICATES.find((c) => c.id === id);
}

/** 根据证书类型筛选 */
export function getCertificatesByType(type: ThunderCertificateType): ThunderCertificateDef[] {
  return THUNDER_CERTIFICATES.filter((c) => c.type === type);
}

/** 根据证书等级筛选 */
export function getCertificatesByLevel(level: ThunderCertificateLevel): ThunderCertificateDef[] {
  return THUNDER_CERTIFICATES.filter((c) => c.level === level);
}

/**
 * 计算证书当前进度数值（原始值，未归一化）
 * 各类型计算逻辑：
 *  - storyMaster: save.storyClearedStages.length（剧情通关关卡数）
 *  - lessonGraduate: save.lessonClearedChapters.length（课程通关章节数）
 *  - rpgExpert: save.rpgClearedScenarios.length（RPG 通关剧本数）
 *  - knowledgeSage: 掌握度 >= 1 的知识图谱节点数
 *  - bossSlayer: save.defeatedBosses.length（击败 BOSS 数）
 *  - perfectStreak: 最近 5 局中完美通关数（win=true 计为完美通关）
 *  - scholar: 已获得的其他类型证书数（从 save.unlockedCertificates 统计，排除自身）
 *  - guardian: 已获得的其他证书总数（从 save.unlockedCertificates 统计，排除自身）
 */
export function calcCertificateProgressValue(cert: ThunderCertificateDef, save: ThunderSaveData): number {
  switch (cert.type) {
    case "storyMaster":
      return save.storyClearedStages?.length ?? 0;
    case "lessonGraduate":
      return save.lessonClearedChapters?.length ?? 0;
    case "rpgExpert":
      return save.rpgClearedScenarios?.length ?? 0;
    case "knowledgeSage": {
      const mastery = save.knowledgeMastery ?? {};
      return Object.keys(mastery).filter((k) => mastery[k] >= 1).length;
    }
    case "bossSlayer":
      return save.defeatedBosses?.length ?? 0;
    case "perfectStreak": {
      // 取最近 5 局，统计完美通关数（win=true 视为完美通关）
      const runs = save.adaptiveRecentRuns ?? [];
      const recent5 = runs.slice(-5);
      return recent5.filter((r) => r.win).length;
    }
    case "scholar": {
      // 统计已获得的其他类型证书数（排除 scholar 自身）
      const unlocked = save.unlockedCertificates ?? [];
      return THUNDER_CERTIFICATES.filter(
        (c) => c.type !== "scholar" && unlocked.includes(c.id)
      ).length;
    }
    case "guardian": {
      // 统计已获得的其他证书总数（排除 guardian 自身）
      const unlocked = save.unlockedCertificates ?? [];
      return THUNDER_CERTIFICATES.filter(
        (c) => c.type !== "guardian" && unlocked.includes(c.id)
      ).length;
    }
    default:
      return 0;
  }
}

/**
 * 检查证书是否已完成（进度达标）
 * 注意：完成 ≠ 已颁发。完成表示条件满足，已颁发表示已写入 save.unlockedCertificates。
 */
export function checkCertificateUnlock(cert: ThunderCertificateDef, save: ThunderSaveData): boolean {
  return calcCertificateProgressValue(cert, save) >= cert.target;
}

/**
 * 计算证书完整进度（含进度比、完成状态、颁发状态、进度描述）
 */
export function calcCertificateProgress(cert: ThunderCertificateDef, save: ThunderSaveData): ThunderCertificateProgress {
  const current = calcCertificateProgressValue(cert, save);
  const target = cert.target;
  const ratio = target > 0 ? Math.min(1, current / target) : 0;
  const completed = current >= target;
  const issued = (save.unlockedCertificates ?? []).includes(cert.id);
  // 进度描述：根据证书类型生成可读文案
  let label: string;
  switch (cert.type) {
    case "storyMaster": label = `${current}/${target} 关卡通关`; break;
    case "lessonGraduate": label = `${current}/${target} 章节通关`; break;
    case "rpgExpert": label = `${current}/${target} 剧本通关`; break;
    case "knowledgeSage": label = `${current}/${target} 节点掌握`; break;
    case "bossSlayer": label = `${current}/${target} BOSS 击败`; break;
    case "perfectStreak": label = `最近 5 局完美 ${current}/${target}`; break;
    case "scholar": label = `${current}/${target} 证书获得`; break;
    case "guardian": label = `${current}/${target} 证书获得`; break;
    default: label = `${current}/${target}`;
  }
  return { certId: cert.id, current, target, ratio, completed, issued, label };
}

/** 返回所有证书的进度列表 */
export function getAllCertificateProgress(save: ThunderSaveData): ThunderCertificateProgress[] {
  return THUNDER_CERTIFICATES.map((c) => calcCertificateProgress(c, save));
}

/** 返回已颁发的证书列表（出现在 save.unlockedCertificates 中的） */
export function getUnlockedCertificates(save: ThunderSaveData): ThunderCertificateDef[] {
  const unlocked = save.unlockedCertificates ?? [];
  return THUNDER_CERTIFICATES.filter((c) => unlocked.includes(c.id));
}

/**
 * 返回本次新解锁的证书
 * 对比上次进度快照 prevProgress（certId → 进度值），找出"上次未完成、本次已完成"的证书。
 * 用于一局结束后弹出"证书解锁"提示。
 */
export function getNewlyUnlockedCertificates(
  save: ThunderSaveData,
  prevProgress: Record<string, number>
): ThunderCertificateDef[] {
  return THUNDER_CERTIFICATES.filter((c) => {
    const prevVal = prevProgress[c.id] ?? 0;
    const curVal = calcCertificateProgressValue(c, save);
    // 上次未达标，本次达标 = 新解锁
    return prevVal < c.target && curVal >= c.target;
  });
}

// ===== certificate.ts：v7 反诈能力认证证书系统结束 =====
