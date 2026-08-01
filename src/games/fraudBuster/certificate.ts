/**
 * 反诈证书系统（C1 教育功能）
 *
 * 5 张多条件证书，覆盖识破里程碑 / 硬核完美 / 拆解专家 / AI 克星 / 段位大师。
 * 颁发逻辑：基于存档字段判断，达到条件即颁发（去重），由 engine/scene 在合适时机调用。
 *
 * 设计目标：
 * - 0 副作用查询：getCertificateProgress 不写存档，纯读
 * - 一次性颁发：issuePendingCertificates 检查所有证书并颁发新解锁的，返回新颁发列表
 * - 进度可视化：每张证书提供 current/target/ratio，供 UI 渲染进度条
 */
import type { FBCertificate, FBCertificateProgress, FBCertificateType } from "./types";
import {
  loadFBSave,
  issueCertificate,
  hasCertificate,
  type FBCertificateRecord,
} from "./storage";
import { DECONSTRUCT_SCENARIOS } from "./dataV2";
import { AI_DIALOG_SCENARIOS } from "./v5Modes";

// ============ 证书定义 ============

/**
 * 5 张反诈证书定义（v6 教育功能 C1）
 * 每张证书对应一个独立的颁发条件，难度递增。
 */
export const CERT_DEFS: FBCertificate[] = [
  {
    id: "CERT-BUST-2000",
    type: "bustMilestone",
    name: "识破宗师",
    icon: "🎯",
    color: "#FFD666",
    desc: "累计识破 2000 起诈骗，铸就火眼金睛",
    condition: "累计识破数达到 2000",
    citation: "你已识破 2000 起诈骗，骗术在你面前无所遁形。火眼金睛，名副其实。",
    level: "advanced",
  },
  {
    id: "CERT-HARDCORE-PERFECT",
    type: "hardcorePerfect",
    name: "硬核完美",
    icon: "💎",
    color: "#E5353B",
    desc: "在硬核模式（答错即终局）中零失误通关",
    condition: "完美通关硬核模式 1 次",
    citation: "硬核模式零失误通关，真正的反诈宗师。每一题都是生死抉择，你交出了完美答卷。",
    level: "master",
  },
  {
    id: "CERT-DECONSTRUCT-ALL",
    type: "deconstructAll",
    name: "拆解专家",
    icon: "🔬",
    color: "#52C41A",
    desc: "完成全部 12 个骗局拆解剧本，洞悉骗子话术骨架",
    condition: "通关全部 12 个骗局拆解剧本",
    citation: "12 个骗局剧本被你逐一拆解，骗子话术在你面前无处遁形。拆解专家，名副其实。",
    level: "intermediate",
  },
  {
    id: "CERT-AIBATTLE-ALL",
    type: "aiBattleAll",
    name: "AI 克星",
    icon: "🤖",
    color: "#9FE3FF",
    desc: "通关所有 8 个 AI 对战剧本，识破 AI 骗子所有话术",
    condition: "通关全部 8 个 AI 对战剧本",
    citation: "8 个 AI 骗子剧本被你逐一识破。AI 时代，你是反诈战线最锋利的尖刀。",
    level: "advanced",
  },
  {
    id: "CERT-RANK-R5",
    type: "rankMaster",
    name: "段位大师",
    icon: "👑",
    color: "#FF7A1A",
    desc: "达到反诈专家段位（R5），跻身顶尖反诈者行列",
    condition: "段位达到「反诈专家」(R5)",
    citation: "你已晋升为反诈专家，跻身顶尖反诈者行列。守护钱包，从守护认知开始。",
    level: "advanced",
  },
];

/** 段位 R5 的累计识破数阈值（与 storage.ts FBRANKS 中 R5 的 minBusted 一致） */
const RANK_R5_MIN_BUSTED = 2000;

/** 拆解剧本总数（与 deconstruct-scenarios.json 一致） */
const DECONSTRUCT_TOTAL = 12;

/** AI 对战剧本总数（与 v5Modes.ts AI_DIALOG_SCENARIOS 一致） */
const AI_BATTLE_TOTAL = 8;

// ============ 证书查询 ============

/** 获取所有证书定义 */
export function getAllCertificates(): FBCertificate[] {
  return CERT_DEFS;
}

/** 按 ID 获取证书定义 */
export function getCertificateById(certId: string): FBCertificate | undefined {
  return CERT_DEFS.find((c) => c.id === certId);
}

/** 按类型获取证书定义 */
export function getCertificateByType(type: FBCertificateType): FBCertificate | undefined {
  return CERT_DEFS.find((c) => c.type === type);
}

// ============ 进度计算 ============

/**
 * 计算指定证书的颁发进度（纯读，不写存档）。
 * 用于 UI 展示未完成证书的进度条。
 */
export function getCertificateProgress(certId: string): FBCertificateProgress {
  const save = loadFBSave();
  const cert = getCertificateById(certId);
  const issued = hasCertificate(certId);

  let current = 0;
  let target = 1;
  let label = "";

  switch (cert?.type) {
    case "bustMilestone": {
      current = save.totalBusted;
      target = 2000;
      label = `${current}/2000 识破`;
      break;
    }
    case "hardcorePerfect": {
      current = save.hardcorePerfectCount;
      target = 1;
      label = `${current}/1 次完美通关`;
      break;
    }
    case "deconstructAll": {
      current = save.deconstructClearedIds.length;
      target = DECONSTRUCT_TOTAL;
      label = `${current}/${DECONSTRUCT_TOTAL} 剧本`;
      break;
    }
    case "aiBattleAll": {
      current = save.aiBattleClearedIds.length;
      target = AI_BATTLE_TOTAL;
      label = `${current}/${AI_BATTLE_TOTAL} 剧本`;
      break;
    }
    case "rankMaster": {
      current = save.totalBusted;
      target = RANK_R5_MIN_BUSTED;
      label = `${current}/${RANK_R5_MIN_BUSTED} 识破(晋 R5)`;
      break;
    }
    default: {
      current = 0;
      target = 1;
      label = "0/1";
    }
  }

  const completed = current >= target;
  const ratio = target > 0 ? Math.min(1, current / target) : 0;

  return {
    certId,
    current,
    target,
    ratio,
    completed,
    issued,
    label,
  };
}

/**
 * 批量获取所有证书的进度（用于证书陈列页一次性渲染）。
 */
export function getAllCertificateProgress(): FBCertificateProgress[] {
  return CERT_DEFS.map((c) => getCertificateProgress(c.id));
}

// ============ 证书颁发 ============

/**
 * 检查所有证书并颁发新解锁的（一次性批量颁发）。
 * 由 engine 在局后结算 / scene 在拆解或 AI 对战通关后调用。
 *
 * @returns 新颁发的证书记录列表（已颁发的不会重复返回）
 */
export function issuePendingCertificates(): FBCertificateRecord[] {
  const newlyIssued: FBCertificateRecord[] = [];
  for (const cert of CERT_DEFS) {
    if (hasCertificate(cert.id)) continue;
    const progress = getCertificateProgress(cert.id);
    if (progress.completed) {
      const ok = issueCertificate(cert.id);
      if (ok) {
        newlyIssued.push({ id: cert.id, issuedAt: new Date().toISOString() });
      }
    }
  }
  return newlyIssued;
}

/**
 * 检查单张证书是否应该颁发（不实际颁发，仅查询）。
 * 用于 UI 在颁发前预览"即将获得"的证书。
 */
export function isCertificateReady(certId: string): boolean {
  if (hasCertificate(certId)) return false;
  return getCertificateProgress(certId).completed;
}

/**
 * 获取已颁发证书的完整信息列表（合并存档记录 + 定义）。
 * 用于证书陈列页展示已获得的证书（含颁发时间）。
 */
export function getIssuedCertificates(): Array<FBCertificate & { issuedAt: string }> {
  const save = loadFBSave();
  return save.certificates
    .map((rec) => {
      const def = getCertificateById(rec.id);
      if (!def) return null;
      return { ...def, issuedAt: rec.issuedAt };
    })
    .filter((x): x is FBCertificate & { issuedAt: string } => x !== null);
}

/** 读取拆解剧本总数（供 UI 展示分母） */
export function getDeconstructTotal(): number {
  return DECONSTRUCT_TOTAL;
}

/** 读取 AI 对战剧本总数（供 UI 展示分母） */
export function getAIBattleTotal(): number {
  return AI_BATTLE_TOTAL;
}

/**
 * 校验数据一致性：实际剧本数与常量是否匹配。
 * 用于开发期排查（如新增剧本后忘记更新常量）。
 */
export function validateCertificateCounts(): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  if (DECONSTRUCT_SCENARIOS.length !== DECONSTRUCT_TOTAL) {
    mismatches.push(
      `DECONSTRUCT_SCENARIOS.length(${DECONSTRUCT_SCENARIOS.length}) !== DECONSTRUCT_TOTAL(${DECONSTRUCT_TOTAL})`,
    );
  }
  if (AI_DIALOG_SCENARIOS.length !== AI_BATTLE_TOTAL) {
    mismatches.push(
      `AI_DIALOG_SCENARIOS.length(${AI_DIALOG_SCENARIOS.length}) !== AI_BATTLE_TOTAL(${AI_BATTLE_TOTAL})`,
    );
  }
  return { ok: mismatches.length === 0, mismatches };
}
