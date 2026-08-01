/**
 * 「是男人就反诈」v6 升级：新模式的核心逻辑
 * - 反诈侦探（detective）：多证据链交叉推理还原诈骗剧本
 *
 * 本模块为独立 Runner，由 engine.ts 在 gameMode === "detective" 时委托调用，
 * 不修改 engine 既有逻辑，实现"模块化扩展"。
 *
 * 设计原则：
 * 1. 玩法分 5 阶段：briefing（简报）→ evidence（证据浏览）→ reasoning（推理问答）→ summary（复盘）→ archived（归档）
 * 2. 证据浏览限时（默认 90 秒），超时自动进入推理
 * 3. 推理问答递进式 4 题（identify → locate → reconstruct → prevent）
 * 4. 推理得分 = 答对题数 / 总题数 × 100，>=60 视为破案
 * 5. 破局点定位：locate 阶段答对即标记 breakingPointFound
 */
import type {
  FBDetectiveCase,
  FBDetectiveEvidence,
  FBDetectiveQuestion,
  FBHudDetectiveState,
  FBStats,
} from "./types";
import { DETECTIVE_CONFIG } from "./data/modes";

// ============ 案件数据 ============

import detectiveCases from "./questions/detective-cases.json";

/** 全部侦探案件（6 个，覆盖 F01/F02/F03/F45/F78/F87） */
export const DETECTIVE_CASES: FBDetectiveCase[] = detectiveCases as FBDetectiveCase[];

/** 根据 ID 查询案件 */
export function getDetectiveCase(caseId: string): FBDetectiveCase | undefined {
  return DETECTIVE_CASES.find((c) => c.id === caseId);
}

/** 随机选取一个案件（未指定 caseId 时使用） */
export function pickDetectiveCase(caseId?: string): FBDetectiveCase {
  if (caseId) {
    const found = getDetectiveCase(caseId);
    if (found) return found;
  }
  return DETECTIVE_CASES[Math.floor(Math.random() * DETECTIVE_CASES.length)];
}

// ============ 反诈侦探 Runner ============

/** 答题结果 */
export interface DetectiveAnswerResult {
  /** 是否正确 */
  correct: boolean;
  /** 该问题解析 */
  explain: string;
  /** 是否答错且锁定（lockOnWrong） */
  locked: boolean;
  /** 是否触发破局点发现 */
  breakingPointFound: boolean;
  /** 是否所有问题已答完 */
  allAnswered: boolean;
}

/**
 * 反诈侦探模式 Runner
 * - 管理 5 阶段流转
 * - 证据浏览倒计时
 * - 推理问答判定（single/multi/sort/link）
 * - 破案评分与归档
 */
export class DetectiveRunner {
  private currentCase: FBDetectiveCase;
  private stage: FBHudDetectiveState["stage"] = "briefing";
  private evidenceRemainSec: number;
  private viewedEvidenceIds: string[] = [];
  private selectedEvidenceId: string | null = null;
  private currentQuestionIdx = 0;
  private answeredQuestions: Array<{ questionId: string; correct: boolean; playerAnswer: number | number[] }> = [];
  private breakingPointFound = false;
  private ended = false;
  private endingDesc = "";
  private lastAnswerResult: DetectiveAnswerResult | null = null;
  /** 当前问题是否已锁定（答错且 lockOnWrong） */
  private currentLocked = false;

  constructor(caseId?: string) {
    this.currentCase = pickDetectiveCase(caseId);
    this.evidenceRemainSec = this.currentCase.evidenceReviewSec ?? DETECTIVE_CONFIG.defaultEvidenceReviewSec;
  }

  // ===== 阶段流转 =====

  /** 进入证据浏览阶段（从 briefing 调用） */
  enterEvidenceStage(): void {
    if (this.stage !== "briefing") return;
    this.stage = "evidence";
  }

  /** 进入推理问答阶段（从 evidence 调用，或证据超时自动调用） */
  enterReasoningStage(): void {
    if (this.stage !== "evidence") return;
    this.stage = "reasoning";
    this.selectedEvidenceId = null;
    this.currentQuestionIdx = 0;
    this.currentLocked = false;
  }

  /** 进入复盘阶段（答完所有问题后调用） */
  enterSummaryStage(): void {
    if (this.stage !== "reasoning") return;
    this.stage = "summary";
    const score = this.getReasoningScore();
    const solved = score >= DETECTIVE_CONFIG.passScore;
    this.ended = true;
    this.endingDesc = solved
      ? `破案成功！推理得分 ${score}，已还原诈骗剧本并定位破局点。`
      : `推理得分 ${score}，未达破案及格线（${DETECTIVE_CONFIG.passScore}），建议复盘重玩。`;
  }

  /** 归档案件（从 summary 调用，标记为已结案） */
  archiveCase(): void {
    if (this.stage !== "summary") return;
    this.stage = "archived";
  }

  // ===== 证据浏览 =====

  /** 选择证据查看 */
  selectEvidence(evidenceId: string): void {
    if (this.stage !== "evidence") return;
    this.selectedEvidenceId = evidenceId;
    if (!this.viewedEvidenceIds.includes(evidenceId)) {
      this.viewedEvidenceIds.push(evidenceId);
    }
  }

  /** 关闭当前证据查看 */
  closeEvidence(): void {
    this.selectedEvidenceId = null;
  }

  /** 证据浏览倒计时（每帧/每秒调用） */
  tickEvidenceTimer(deltaSec: number): boolean {
    if (this.stage !== "evidence") return false;
    this.evidenceRemainSec = Math.max(0, this.evidenceRemainSec - deltaSec);
    if (this.evidenceRemainSec <= 0) {
      // 超时自动进入推理阶段
      this.enterReasoningStage();
      return true;
    }
    return false;
  }

  // ===== 推理问答 =====

  /**
   * 回答当前推理问题
   * @param playerAnswer 单选为 number，多选为 number[]，排序为 number[]，连线为 number[]
   */
  answerQuestion(playerAnswer: number | number[]): DetectiveAnswerResult {
    if (this.stage !== "reasoning" || this.currentLocked) {
      return {
        correct: false,
        explain: "",
        locked: this.currentLocked,
        breakingPointFound: this.breakingPointFound,
        allAnswered: false,
      };
    }

    const question = this.getCurrentQuestion();
    if (!question) {
      return {
        correct: false,
        explain: "",
        locked: false,
        breakingPointFound: this.breakingPointFound,
        allAnswered: true,
      };
    }

    const correct = this.checkAnswer(question, playerAnswer);

    // 记录答题结果
    this.answeredQuestions.push({
      questionId: question.id,
      correct,
      playerAnswer,
    });

    // locate 阶段答对则标记破局点发现
    if (correct && question.stage === "locate") {
      this.breakingPointFound = true;
    }

    // lockOnWrong：答错锁定不允许重试
    const locked = !correct && !!question.lockOnWrong;
    this.currentLocked = locked;

    const allAnswered = this.currentQuestionIdx >= this.currentCase.reasoningQuestions.length - 1;

    this.lastAnswerResult = {
      correct,
      explain: question.explain,
      locked,
      breakingPointFound: this.breakingPointFound,
      allAnswered,
    };

    return this.lastAnswerResult;
  }

  /** 进入下一题（答对或主动跳过） */
  nextQuestion(): boolean {
    if (this.stage !== "reasoning") return false;
    if (this.currentQuestionIdx >= this.currentCase.reasoningQuestions.length - 1) {
      // 所有问题答完，进入复盘
      this.enterSummaryStage();
      return false;
    }
    this.currentQuestionIdx++;
    this.currentLocked = false;
    this.lastAnswerResult = null;
    return true;
  }

  /** 检查答案是否正确（支持 single/multi/sort/link） */
  private checkAnswer(question: FBDetectiveQuestion, playerAnswer: number | number[]): boolean {
    switch (question.kind) {
      case "single": {
        if (typeof playerAnswer !== "number") return false;
        return playerAnswer === question.answer;
      }
      case "multi": {
        if (!Array.isArray(playerAnswer)) return false;
        const correct = question.answers ?? [];
        if (playerAnswer.length !== correct.length) return false;
        const playerSet = new Set(playerAnswer);
        return correct.every((idx) => playerSet.has(idx));
      }
      case "sort": {
        if (!Array.isArray(playerAnswer)) return false;
        const correct = question.sortCorrect ?? [];
        if (playerAnswer.length !== correct.length) return false;
        return playerAnswer.every((val, i) => val === correct[i]);
      }
      case "link": {
        if (!Array.isArray(playerAnswer)) return false;
        const correct = question.linkPairing ?? [];
        if (playerAnswer.length !== correct.length) return false;
        return playerAnswer.every((val, i) => val === correct[i]);
      }
      default:
        return false;
    }
  }

  // ===== 状态查询 =====

  /** 计算推理得分 0-100 */
  getReasoningScore(): number {
    const total = this.currentCase.reasoningQuestions.length;
    if (total === 0) return 0;
    const correctCount = this.answeredQuestions.filter((a) => a.correct).length;
    return Math.round((correctCount / total) * 100);
  }

  /** 是否破案 */
  isCaseSolved(): boolean {
    return this.getReasoningScore() >= DETECTIVE_CONFIG.passScore;
  }

  isOver(): boolean { return this.ended; }
  getCase(): FBDetectiveCase { return this.currentCase; }
  getStage(): FBHudDetectiveState["stage"] { return this.stage; }
  getCurrentQuestion(): FBDetectiveQuestion | null {
    return this.currentCase.reasoningQuestions[this.currentQuestionIdx] ?? null;
  }
  getCurrentQuestionIdx(): number { return this.currentQuestionIdx; }
  getTotalQuestions(): number { return this.currentCase.reasoningQuestions.length; }
  getViewedEvidenceIds(): string[] { return this.viewedEvidenceIds; }
  getSelectedEvidence(): FBDetectiveEvidence | null {
    if (!this.selectedEvidenceId) return null;
    return this.currentCase.evidences.find((e) => e.id === this.selectedEvidenceId) ?? null;
  }
  getEvidenceRemainSec(): number { return this.evidenceRemainSec; }
  getBreakingPointFound(): boolean { return this.breakingPointFound; }
  getLastAnswerResult(): DetectiveAnswerResult | null { return this.lastAnswerResult; }
  isCurrentLocked(): boolean { return this.currentLocked; }
  getEndingDesc(): string { return this.endingDesc; }

  getHud(): FBHudDetectiveState {
    return {
      caseId: this.currentCase.id,
      caseTitle: this.currentCase.title,
      stage: this.stage,
      evidenceRemainSec: this.evidenceRemainSec,
      evidenceTotalSec: this.currentCase.evidenceReviewSec ?? DETECTIVE_CONFIG.defaultEvidenceReviewSec,
      viewedEvidenceIds: [...this.viewedEvidenceIds],
      selectedEvidenceId: this.selectedEvidenceId,
      currentQuestionIdx: this.currentQuestionIdx,
      totalQuestions: this.currentCase.reasoningQuestions.length,
      answeredQuestions: [...this.answeredQuestions],
      reasoningScore: this.getReasoningScore(),
      caseSolved: this.isCaseSolved(),
      breakingPointFound: this.breakingPointFound,
      ended: this.ended,
      endingDesc: this.endingDesc,
    };
  }

  getStats(): Partial<FBStats> {
    const score = this.getReasoningScore();
    const solved = this.isCaseSolved();
    return {
      detectiveScore: score,
      detectiveSolved: solved,
      detectiveBreakingPoints: this.breakingPointFound ? 1 : 0,
      correctCount: this.answeredQuestions.filter((a) => a.correct).length,
      wrongCount: this.answeredQuestions.filter((a) => !a.correct).length,
      totalAnswered: this.answeredQuestions.length,
    };
  }
}
