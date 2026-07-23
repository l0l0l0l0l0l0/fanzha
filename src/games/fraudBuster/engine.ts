import { GameEngine } from "@/engine/GameEngine";
import { ParticleSystem } from "@/engine/Particle";
import { postFX } from "@/engine/PostFX";
import { playSfx } from "@/engine/Audio";
import type { GameCanvas } from "@/platform/web";
import {
  clamp,
  clearCanvas,
  drawText,
  wrapText,
  roundRect,
  drawGrid,
} from "@/engine/Renderer";
import { Theme } from "@/ui/Theme";
import type { GameEvent, GameResultPayload } from "@/types";
import { randomTip } from "@/data/tips";
import {
  QUESTION_BANK, pickQuestion, waveConfig, manTierFor,
  SCAMMER_TAUNTS, SCAMMER_MOCKS, isBossWave, pickBoss,
  isSpecialWave, pickSpecialEvent, specialEventName, specialEventDesc,
  pickChainFollowUp, pickNormalQuestion,
} from "./data";
import type { FBQuestion, FBHud, FBQuestionKind, FBItemType, FBBoss, FBSpecialEvent, FBBossSkill, FBStats } from "./types";

const W = 800;
const H = 480;
const ACCENT = "#1AD670";

/** 道具中文名 */
export function itemLabel(type: FBItemType): string {
  switch (type) {
    case "freeze": return "❄ 时间冻结";
    case "fifty": return "🧰 50-50";
    case "skip": return "⏭ 跳过";
    case "double": return "✨ 双倍分";
    case "hint": return "💡 提示";
    case "undo": return "↩ 撤销";
  }
}

/** 道具图例 emoji */
export function itemEmoji(type: FBItemType): string {
  switch (type) {
    case "freeze": return "❄";
    case "fifty": return "🧰";
    case "skip": return "⏭";
    case "double": return "✨";
    case "hint": return "💡";
    case "undo": return "↩";
  }
}

// 卡片位于左半区，选项按钮由场景在右半区绘制（同一画布坐标系，避免错位遮挡）
const CARD_X = 20;
const CARD_Y = 80;
const CARD_W = 360;
const CARD_H = 380;
const CARD_CX = CARD_X + CARD_W / 2; // 200
const CARD_CY = CARD_Y + CARD_H / 2; // 270

const MAX_STAMINA = 3;

interface Card {
  q: FBQuestion;
  spawnTs: number;
  duration: number;
  entered: number;
  exited: number;
  state: "in" | "show" | "reveal" | "out";
  /** 单选/判断题：玩家所选索引（原始索引，非显示顺序） */
  selectedIdx: number | null;
  /** 单选/判断题：已选未提交索引（原始索引，null=未选） */
  pendingIdx: number | null;
  /** 多选题：玩家所选索引列表（原始索引） */
  multiSelected: number[];
  /** 是否正确 */
  correct: boolean;
  /** 是否触发风险惩罚 */
  riskTriggered: boolean;
  /** 50-50 道具移除的错误选项索引 */
  fiftyRemoved: number[];
  /** 提示道具高亮的选项索引 */
  hintHighlighted: number[];
  /** 是否通过跳过道具判定为正确（避免触发 fx） */
  skippedViaItem: boolean;
  /** 选项显示顺序：optionOrder[displayIdx] = originalIdx（shuffle 后打乱） */
  optionOrder: number[];
  /** 连锁题组ID */
  chainGroup?: string;
  /** 是否为连锁追问 */
  isChainFollowUp?: boolean;
}

export class FraudBusterEngine extends GameEngine {
  private particles = new ParticleSystem();
  private state = {
    wave: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    stamina: MAX_STAMINA,
    busted: 0,
    over: false,
  };
  /** 道具系统：6 种道具数量 */
  private items: { freeze: number; fifty: number; skip: number; double: number; hint: number; undo: number } = {
    freeze: 1, fifty: 1, skip: 1, double: 1, hint: 1, undo: 1,
  };
  /** 时间冻结剩余秒数 */
  private freezeRemaining = 0;
  /** 双倍分剩余题数 */
  private doubleRemaining = 0;
  private current: Card | null = null;
  private usedIds = new Set<string>();
  private nextSpawnAt = 0;
  private t = 0;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private shakeUntil = 0;
  private result: GameResultPayload | null = null;
  private startedAt = 0;
  private revealUntil = 0;
  private manHurtUntil = 0;
  private grainSeed = 0;
  /** 诈骗分子挑衅文案及持续到的时间 */
  private taunt: { text: string; until: number } | null = null;
  /** 屏幕裂纹：错答/风险触发，随时间淡出 */
  private crack: { until: number; seed: number } | null = null;
  /** 当前心跳强度（0..1，倒计时越紧越强） */
  private heartbeat = 0;
  /** hit-stop 剩余秒：答对/命中瞬间冻结游戏逻辑一小段时间，强化击中顿挫感（粒子/弹动仍播） */
  private hitStopRemain = 0;
  /** 卡片弹动脉冲：答对/命中时设为 1，衰减到 0，驱动卡片 scale 弹动 */
  private cardPulse = 0;
  /** Boss 首脑状态：每 20 波触发，需连续答对 2-3 题击破 */
  private boss: {
    def: FBBoss;
    hp: number;
    maxHp: number;
    active: boolean;
    defeated: boolean;
  } | null = null;

  // ===== 新增状态 =====
  /** 统计数据 */
  private stats: FBStats = {
    totalAnswered: 0,
    correctCount: 0,
    wrongCount: 0,
    maxCombo: 0,
    bossDefeated: 0,
    byType: {},
    itemsUsed: 0,
    chainCompleted: 0,
    specialCleared: 0,
  };
  /** 当前特殊波次事件（null=普通波次） */
  private specialEvent: FBSpecialEvent | null = null;
  /** 特殊事件是否已激活（用于防止重复触发） */
  private specialEventActive = false;
  /** 待触发的连锁题组ID（答对首题后设为组ID，下一题加载追问） */
  private chainPending: string | null = null;
  /** 当前 Boss 技能（每题随机触发1个，null=无） */
  private bossSkill: FBBossSkill | null = null;
  /** 道具被封印（Boss lockItem 技能，1题有效） */
  private itemLocked = false;
  /** 特殊事件通知文案（用于显示事件名称） */
  private specialEventToast: { text: string; until: number } | null = null;

  constructor(canvas: GameCanvas) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    this.startedAt = performance.now();
    this.nextSpawnAt = 0.6;
  }

  /**
   * 场景按钮入口：选择第 idx 个选项
   * - 单选/判断：点击即自动提交（不再有 pending/确认环节）
   * - 多选题：切换选中状态后判定
   *   · 选中任一错误选项 → 立即提交（判错）
   *   · 已选集合 == 正确答案集合 → 自动提交（判对）
   *   · 否则继续等待玩家选择
   */
  answer(idx: number): void {
    if (this.state.over || !this.current) return;
    const c = this.current;
    if (c.state !== "show") return;
    const kind = c.q.kind ?? "single";
    if (kind === "multi") {
      // 多选题：切换选中状态
      const i = c.multiSelected.indexOf(idx);
      if (i >= 0) c.multiSelected.splice(i, 1);
      else c.multiSelected.push(idx);
      playSfx("tick");
      this.emitHud();
      // === 自动提交判定 ===
      const correctSet = new Set(c.q.answers ?? []);
      const hasWrong = c.multiSelected.some((s) => !correctSet.has(s));
      if (hasWrong) {
        // 选到错误选项：立即提交（判错）
        this.submit();
        return;
      }
      // 无错误选项：检查是否已选全所有正确答案
      if (correctSet.size > 0 && c.multiSelected.length >= correctSet.size) {
        this.submit();
        return;
      }
      return;
    }
    // single / judge：点击即自动提交（取消原 pendingIdx 切换）
    c.pendingIdx = idx;
    playSfx("tick");
    this.submit();
  }

  /** 统一提交按钮入口：单选/判断用 pendingIdx，多选用 multiSelected */
  submit(): void {
    if (this.state.over || !this.current) return;
    const c = this.current;
    if (c.state !== "show") return;
    const kind = c.q.kind ?? "single";
    if (kind === "multi") {
      if (c.multiSelected.length === 0) {
        playSfx("bad");
        return;
      }
      this.revealCard(-1);
    } else {
      if (c.pendingIdx === null) {
        playSfx("bad");
        return;
      }
      this.revealCard(c.pendingIdx);
    }
  }

  /** 多选题提交按钮入口（兼容旧调用，转发到 submit） */
  submitMulti(): void {
    this.submit();
  }

  /**
   * 使用道具
   * - freeze：当前题倒计时暂停 5 秒
   * - fifty：随机移除 2 个错误选项（仅 single/judge 题型）
   * - skip：直接判定为正确但不得分（combo +1）
   * - double：本题及下一题答对得分翻倍
   * - hint：高亮1个倾向正确的选项（不移除，仅标记）
   * - undo：恢复1点体力（不超过上限）
   */
  useItem(type: FBItemType): void {
    if (this.state.over) return;
    // Boss lockItem 技能封印道具
    if (this.itemLocked && type !== "undo") {
      playSfx("bad");
      this.toast = { text: "🔒 道具被 Boss 封印！本题无法使用道具", tone: "bad", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    if (this.items[type] <= 0) {
      playSfx("bad");
      return;
    }
    if (type === "skip") {
      // 跳过需有题在展示
      if (!this.current || this.current.state !== "show") { playSfx("bad"); return; }
      this.items.skip -= 1;
      this.stats.itemsUsed += 1;
      this.skipCurrent();
      return;
    }
    if (type === "fifty") {
      // 50-50 需有题在展示，且仅 single/judge
      if (!this.current || this.current.state !== "show") { playSfx("bad"); return; }
      const kind = this.current.q.kind ?? "single";
      if (kind === "multi") { playSfx("bad"); return; }
      const correct = this.current.q.answer ?? -1;
      const wrongs = this.current.q.options.map((_, i) => i).filter((i) => i !== correct);
      if (wrongs.length < 2) { playSfx("bad"); return; }
      // 随机选 2 个错误项
      const shuffled = wrongs.sort(() => Math.random() - 0.5);
      this.current.fiftyRemoved = shuffled.slice(0, 2);
      this.items.fifty -= 1;
      this.stats.itemsUsed += 1;
      playSfx("good");
      this.toast = { text: "🧰 50-50 已移除 2 个错误选项", tone: "info", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    if (type === "freeze") {
      if (!this.current || this.current.state !== "show") { playSfx("bad"); return; }
      if (this.freezeRemaining > 0) { playSfx("bad"); return; }
      this.freezeRemaining = 5;
      this.items.freeze -= 1;
      this.stats.itemsUsed += 1;
      playSfx("good");
      postFX.flash("#00E5FF", 0.25, 2);
      this.toast = { text: "❄ 时间冻结 5 秒", tone: "info", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    if (type === "double") {
      if (!this.current || this.current.state !== "show") { playSfx("bad"); return; }
      if (this.doubleRemaining > 0) { playSfx("bad"); return; }
      this.doubleRemaining = 2;
      this.items.double -= 1;
      this.stats.itemsUsed += 1;
      playSfx("good");
      postFX.flash("#FFD666", 0.25, 2);
      this.toast = { text: "✨ 双倍分已激活（本题 + 下一题）", tone: "info", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    if (type === "hint") {
      // 提示：高亮1个正确倾向的选项（不移除，仅视觉标记）
      if (!this.current || this.current.state !== "show") { playSfx("bad"); return; }
      const kind = this.current.q.kind ?? "single";
      if (kind === "multi") { playSfx("bad"); return; }
      if (this.current.hintHighlighted.length > 0) { playSfx("bad"); return; }
      const correct = this.current.q.answer ?? -1;
      // 高亮正确选项（给玩家一个明确提示）
      this.current.hintHighlighted = [correct];
      this.items.hint -= 1;
      this.stats.itemsUsed += 1;
      playSfx("good");
      postFX.flash("#B388FF", 0.2, 2);
      this.toast = { text: "💡 提示：已高亮正确选项", tone: "info", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    if (type === "undo") {
      // 撤销：恢复1点体力（不超过上限），任何时候可用
      if (this.state.stamina >= MAX_STAMINA) { playSfx("bad"); return; }
      this.state.stamina += 1;
      this.items.undo -= 1;
      this.stats.itemsUsed += 1;
      playSfx("good");
      postFX.flash("#52C41A", 0.25, 2);
      this.toast = { text: "↩ 已恢复 1 点体力", tone: "good", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
  }

  /** 打乱题目选项顺序（返回新 question 副本，不修改原题） */
  private shuffleQuestionOptions(q: FBQuestion): FBQuestion {
    const indices = q.options.map((_, i) => i);
    // Fisher-Yates 洗牌
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const newOptions = indices.map((i) => q.options[i]);
    // 构建 旧索引→新位置 的映射
    const oldToNew = new Map<number, number>();
    indices.forEach((oldIdx, newIdx) => oldToNew.set(oldIdx, newIdx));
    const newAnswer = q.answer !== undefined ? oldToNew.get(q.answer) : undefined;
    const newAnswers = q.answers?.map((oldIdx) => oldToNew.get(oldIdx)!);
    const newRisk = q.risk?.map((oldIdx) => oldToNew.get(oldIdx)!);
    return {
      ...q,
      options: newOptions,
      answer: newAnswer,
      answers: newAnswers,
      risk: newRisk,
    };
  }

  /** 跳过当前题：直接判为正确，combo +1，但 score 不增加 */
  private skipCurrent(): void {
    const c = this.current;
    if (!c) return;
    c.selectedIdx = -2;
    c.state = "reveal";
    c.correct = true;
    c.riskTriggered = false;
    c.skippedViaItem = true;
    this.revealUntil = this.t + 0.8;
    this.state.combo += 1;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    // Boss 模式：跳过也算命中（Boss 扣血）
    if (this.boss?.active) {
      this.handleBossReveal(c, true);
      this.emitHud();
      return;
    }
    this.toast = { text: `⏭ 已跳过 · ${c.q.explain}`, tone: "info", until: this.t + 2.2 };
    // 不触发 burst fx，仅提示
    playSfx("good");
    this.emitHud();
  }

  /** 揭示答题结果（单选 idx 直接传入；多选 idx 传 -1 用 multiSelected） */
  private revealCard(idx: number): void {
    const c = this.current;
    if (!c) return;
    const kind = c.q.kind ?? "single";
    c.selectedIdx = kind === "multi" ? -1 : idx;
    c.state = "reveal";
    this.revealUntil = this.t + 1.0;
    // 判定正确性
    if (kind === "multi") {
      const correct = (c.q.answers ?? []).slice().sort().join(",");
      const picked = c.multiSelected.slice().sort().join(",");
      c.correct = correct === picked && c.multiSelected.length > 0;
      // 风险触发：选中任意 risk 选项
      const riskList = c.q.risk ?? [];
      c.riskTriggered = c.multiSelected.some((i) => riskList.includes(i));
    } else {
      c.correct = idx === (c.q.answer ?? -1);
      const riskList = c.q.risk ?? [];
      c.riskTriggered = riskList.includes(idx);
    }
    // ===== 统计追踪（非跳过道具） =====
    if (!c.skippedViaItem) {
      this.stats.totalAnswered += 1;
      const typeId = c.q.typeId;
      const prev = this.stats.byType[typeId] ?? { correct: 0, total: 0 };
      prev.total += 1;
      if (c.correct) prev.correct += 1;
      this.stats.byType[typeId] = prev;
    }
    // Boss 模式：单独处理命中/未命中，不走常规计分与扣血
    if (this.boss?.active) {
      if (c.correct && !c.skippedViaItem) {
        this.stats.correctCount += 1;
      } else if (!c.correct && !c.skippedViaItem) {
        this.stats.wrongCount += 1;
      }
      this.handleBossReveal(c, c.correct);
      this.emitHud();
      return;
    }
    if (c.correct) {
      const speedBonus = clamp((c.duration - (this.t - c.spawnTs)) / c.duration, 0, 1) * 40;
      const base = Math.floor(100 + this.state.wave * 12 + speedBonus + (kind === "multi" ? 30 : kind === "judge" ? 20 : 0));
      this.state.combo += 1;
      this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.state.combo);
      if (!c.skippedViaItem) this.stats.correctCount += 1;
      const comboMul = 1 + Math.min(2, this.state.combo * 0.12);
      let gain = Math.floor(base * comboMul);
      // 特殊事件 double：本波次答对得分翻倍
      const specialDouble = this.specialEvent === "double";
      // 双倍分道具：本题答对翻倍（跳过道具不计）
      if (this.doubleRemaining > 0 && !c.skippedViaItem) {
        gain *= 2;
        this.doubleRemaining -= 1;
        this.toast = { text: `✨ 双倍分！+${gain} · ${c.q.explain}`, tone: "good", until: this.t + 2.6 };
      } else if (specialDouble && !c.skippedViaItem) {
        gain *= 2;
        this.toast = { text: `⚡ 双重诈骗奖励翻倍！+${gain} · ${c.q.explain}`, tone: "good", until: this.t + 2.6 };
      } else if (c.skippedViaItem) {
        // 跳过：不得分
        gain = 0;
      } else {
        this.toast = { text: c.q.explain, tone: "good", until: this.t + 2.4 };
      }
      // 连锁题：首题答对，设置 chainPending 触发追问
      if (c.chainGroup && c.q.chainStep === 1) {
        this.chainPending = c.chainGroup;
        this.toast = { text: `🔗 连锁追问即将到来！${c.q.explain}`, tone: "info", until: this.t + 2.4 };
      }
      // 连锁题追问答对：连锁完成 +1，额外奖励
      if (c.isChainFollowUp) {
        this.stats.chainCompleted += 1;
        const chainBonus = 80;
        gain += chainBonus;
        this.particles.spawnText(CARD_CX, CARD_CY - 64, `🔗 连锁完成 +${chainBonus}`, "#B388FF", { size: 14, life: 1.0 });
      }
      this.state.score += gain;
      this.state.busted += 1;
      // 飘字：浮动得分
      if (gain > 0) {
        this.particles.spawnText(CARD_CX, CARD_CY - 40, `+${gain}`, ACCENT, { size: 16, life: 0.8 });
      }
      this.particles.spawnBurst(CARD_CX, CARD_CY, ACCENT, { ring: true, sparks: 16, dots: 18, speed: 240, life: 0.8, size: 4, color2: "#FFD666" });
      postFX.flash(ACCENT, 0.2, 4);
      playSfx("good");
      // 击中顿挫感：短暂冻结 + 卡片弹动（爽感强化）
      this.hitStopRemain = 0.06;
      this.cardPulse = 1;
    } else {
      this.state.combo = 0;
      if (!c.skippedViaItem) this.stats.wrongCount += 1;
      // 风险选项：扣 2 血；普通错答：扣 1 血
      const penalty = c.riskTriggered ? 2 : 1;
      this.state.stamina -= penalty;
      this.manHurtUntil = this.t + 0.6;
      const wrong = c.riskTriggered ? `⚠ 风险选项！扣除 ${penalty} 点体力。` : "错答！正确答案将高亮显示。";
      this.toast = { text: `${wrong} ${c.q.explain}`, tone: "bad", until: this.t + 2.8 };
      this.shakeUntil = this.t + 0.35;
      // 诈骗分子嘲讽 + 屏幕裂纹（压迫感）
      this.taunt = { text: SCAMMER_MOCKS[Math.floor(Math.random() * SCAMMER_MOCKS.length)], until: this.t + 2.6 };
      this.crack = { until: this.t + 1.4, seed: Math.floor(Math.random() * 9999) };
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#E5353B", { ring: true, sparks: 20, dots: 22, speed: 300, life: 0.8, size: 4, color2: "#FFB020" });
      postFX.flash("#E5353B", 0.4, 2);
      postFX.glitch(0.45, 3);
      postFX.shake(7, 14);
      playSfx("bad");
    }
    this.emitHud();
  }

  private gameOver(): void {
    if (this.state.over) return;
    this.state.over = true;
    // 同步最终 maxCombo
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.state.maxCombo);
    this.result = {
      gameId: "fraud-buster",
      win: false,
      score: this.state.score,
      wave: this.state.wave,
      bustedCount: this.state.busted,
      maxCombo: this.state.maxCombo,
      tipId: randomTip(this.state.wave).id,
      stats: { ...this.stats, byType: { ...this.stats.byType } },
    };
    postFX.flash("#E5353B", 0.5, 2);
    postFX.glitch(0.8, 4);
    postFX.shake(10, 16);
    playSfx("lose");
    this.emit({ type: "result", payload: this.result });
  }

  protected update(dt: number): void {
    // hit-stop：冻结游戏逻辑（t/状态机/spawn），但粒子与卡片弹动继续，
    // 营造答对瞬间的顿挫感。解冻后 t 继续推进，倒计时不会因冻结而少算。
    this.particles.update(dt);
    if (this.cardPulse > 0) this.cardPulse = Math.max(0, this.cardPulse - dt * 4);
    if (this.hitStopRemain > 0) {
      this.hitStopRemain = Math.max(0, this.hitStopRemain - dt);
      return;
    }
    this.t += dt;
    this.grainSeed += 1;

    // 道具：时间冻结——推进 spawnTs 抵消倒计时（仅 show 态生效）
    if (this.freezeRemaining > 0) {
      if (this.current && this.current.state === "show") {
        this.current.spawnTs += dt;
      }
      this.freezeRemaining = Math.max(0, this.freezeRemaining - dt);
      if (this.freezeRemaining === 0) this.emitHud();
    }

    // 心跳强度：随倒计时紧迫度上升（压迫感）
    this.heartbeat = this.computeHeartbeat();
    // 高压时偶发诈骗挑衅（无嘲讽时）
    if (this.heartbeat > 0.55 && this.taunt === null && Math.random() < 0.012) {
      this.taunt = { text: SCAMMER_TAUNTS[Math.floor(Math.random() * SCAMMER_TAUNTS.length)], until: this.t + 1.8 };
    }
    if (this.taunt && this.t >= this.taunt.until) this.taunt = null;
    if (this.crack && this.t >= this.crack.until) this.crack = null;

    if (this.current) {
      const c = this.current;
      if (c.state === "in") {
        c.entered = Math.min(1, c.entered + dt * 4);
        if (c.entered >= 1) c.state = "show";
      } else if (c.state === "show") {
        const elapsed = this.t - c.spawnTs;
        if (elapsed >= c.duration) {
          if (this.boss?.active) {
            // Boss 战超时：Boss 回血/嘲讽，不扣体力，不会结束游戏
            c.selectedIdx = null;
            c.pendingIdx = null;
            c.multiSelected = [];
            c.correct = false;
            c.riskTriggered = false;
            c.state = "reveal";
            this.revealUntil = this.t + 1.0;
            this.handleBossReveal(c, false);
            this.emitHud();
          } else {
            // 常规超时：按错答处理
            c.selectedIdx = null;
            c.pendingIdx = null;
            c.multiSelected = [];
            c.correct = false;
            c.riskTriggered = false;
            c.state = "reveal";
            this.revealUntil = this.t + 1.0;
            this.state.combo = 0;
            this.state.stamina -= 1;
            this.manHurtUntil = this.t + 0.6;
            this.toast = { text: `超时未作答！${c.q.explain}`, tone: "bad", until: this.t + 2.6 };
            this.shakeUntil = this.t + 0.35;
            // 超时也触发诈骗嘲讽 + 裂纹
            this.taunt = { text: SCAMMER_MOCKS[Math.floor(Math.random() * SCAMMER_MOCKS.length)], until: this.t + 2.4 };
            this.crack = { until: this.t + 1.2, seed: Math.floor(Math.random() * 9999) };
            this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFB020", { sparks: 14, dots: 16, speed: 240, life: 0.7, size: 3, color2: "#E5353B" });
            postFX.flash("#FFB020", 0.32, 3);
            postFX.glitch(0.3, 2);
            postFX.shake(6, 12);
            playSfx("bad");
            this.emitHud();
          }
        }
      } else if (c.state === "reveal") {
        if (this.t >= this.revealUntil) {
          if (this.boss?.active && !this.boss.defeated) {
            // Boss 战继续：加载下一题，不退出卡片
            this.loadNextBossQuestion();
          } else {
            c.state = "out";
            c.exited = 0;
            // Boss 已击败：清除 Boss 状态
            if (this.boss?.defeated) this.boss = null;
            if (this.state.stamina <= 0) this.gameOver();
          }
        }
      } else if (c.state === "out") {
        c.exited = Math.min(1, c.exited + dt * 4);
        if (c.exited >= 1) {
          // 特殊波次答对统计
          if (this.specialEvent && c.correct) {
            this.stats.specialCleared += 1;
          }
          this.state.wave += 1;
          // 特殊波次结束：清除事件状态
          if (this.specialEvent) {
            this.specialEvent = null;
            this.specialEventActive = false;
          }
          // 每 10 wave 奖励随机道具
          if (this.state.wave % 10 === 0) {
            this.grantRandomItem();
          }
          this.current = null;
          this.nextSpawnAt = this.t + 0.4;
          this.emitHud();
        }
      }
    } else if (!this.state.over) {
      if (this.t >= this.nextSpawnAt) this.spawnCard();
    }
    // 特殊事件提示过期清理
    if (this.specialEventToast && this.t >= this.specialEventToast.until) {
      this.specialEventToast = null;
    }
  }

  private spawnCard(): void {
    // Boss 波次（每 20 波）：生成 Boss 卡片
    if (isBossWave(this.state.wave) && !this.boss?.active) {
      this.spawnBoss();
      return;
    }
    const cfg = waveConfig(this.state.wave);
    // ===== 题目选择策略 =====
    // 1. 连锁追问优先：上题答对设置了 chainPending
    // 2. 特殊波次 mixedTrueFalse：使用正常情境题
    // 3. 首次进入特殊波次：触发事件提示
    // 4. 默认：常规题目
    let q: FBQuestion;
    let isChainFollowUp = false;
    let chainGroup: string | undefined;

    // 连锁追问优先
    if (this.chainPending) {
      const followUp = pickChainFollowUp(this.chainPending, this.usedIds);
      if (followUp) {
        q = followUp;
        this.usedIds.add(q.id);
        isChainFollowUp = true;
        chainGroup = this.chainPending;
        this.chainPending = null;
      } else {
        // 找不到追问，回退常规
        this.chainPending = null;
        q = pickQuestion(this.state.wave, this.usedIds);
        this.usedIds.add(q.id);
      }
    } else {
      // 特殊波次检测与提示
      if (isSpecialWave(this.state.wave) && !this.specialEventActive) {
        this.specialEvent = pickSpecialEvent(this.state.wave);
        this.specialEventActive = true;
        const evName = specialEventName(this.specialEvent);
        const evDesc = specialEventDesc(this.specialEvent);
        this.specialEventToast = { text: `⚡ 特殊波次：${evName} · ${evDesc}`, until: this.t + 3.0 };
        this.toast = { text: `⚡ 特殊波次：${evName}`, tone: "info", until: this.t + 2.4 };
        postFX.flash("#B388FF", 0.3, 2);
        // 紫色冲击波 + 事件名飘字，强化特殊波次登场感
        this.particles.spawnBurst(CARD_CX, CARD_CY, "#B388FF", { ring: true, sparks: 16, dots: 18, speed: 260, life: 0.9, size: 4, color2: "#FFB020", shockwave: true });
        this.particles.spawnText(CARD_CX, CARD_CY - 60, `⚡ ${evName}`, "#B388FF", { size: 18, life: 1.2 });
        playSfx("boss");
      }

      // mixedTrueFalse 事件：使用正常情境题
      if (this.specialEvent === "mixedTrueFalse") {
        const normalQ = pickNormalQuestion(this.usedIds);
        if (normalQ) {
          q = normalQ;
          this.usedIds.add(q.id);
        } else {
          q = pickQuestion(this.state.wave, this.usedIds);
          this.usedIds.add(q.id);
        }
      } else {
        q = pickQuestion(this.state.wave, this.usedIds);
        this.usedIds.add(q.id);
      }
    }

    if (this.usedIds.size > QUESTION_BANK.length - 4) {
      this.usedIds = new Set(Array.from(this.usedIds).slice(-6));
    }

    // ===== 特殊事件效果应用 =====
    let finalQ = q;
    let optionOrder: number[] = q.options.map((_, i) => i);
    // shuffle 事件：打乱选项
    if (this.specialEvent === "shuffle") {
      finalQ = this.shuffleQuestionOptions(q);
      optionOrder = finalQ.options.map((_, i) => i);
    }
    // timeCompress 事件：倒计时减半
    let duration = cfg.duration;
    if (this.specialEvent === "timeCompress") {
      duration = Math.max(2, cfg.duration / 2);
    }

    this.current = {
      q: finalQ,
      spawnTs: this.t,
      duration,
      entered: 0,
      exited: 0,
      state: "in",
      selectedIdx: null,
      pendingIdx: null,
      multiSelected: [],
      correct: false,
      riskTriggered: false,
      fiftyRemoved: [],
      hintHighlighted: [],
      optionOrder,
      skippedViaItem: false,
      chainGroup,
      isChainFollowUp,
    };
    playSfx("tick");
    this.emitHud();
  }

  /** 生成 Boss 首脑：出场特效 + 第一道题 */
  private spawnBoss(): void {
    const def = pickBoss(this.state.wave);
    const hp = def.hp;
    this.boss = { def, hp, maxHp: hp, active: true, defeated: false };
    // Boss 战初始：清除特殊事件状态，重置道具封印
    this.specialEvent = null;
    this.specialEventActive = false;
    this.itemLocked = false;
    this.bossSkill = null;
    // Boss 出场：故障 + 红闪 + 震屏 + 冲击波粒子 + boss 音效
    postFX.glitch(0.8, 4);
    postFX.flash("#E5353B", 0.5, 2);
    postFX.shake(8, 12);
    this.particles.spawnBurst(CARD_CX, CARD_CY, "#E5353B", { ring: true, sparks: 24, dots: 28, speed: 320, life: 1.0, size: 5, color2: "#FFD666", shockwave: true });
    this.particles.spawnText(CARD_CX, CARD_CY - 70, `☠ ${def.name}`, "#E5353B", { size: 20, life: 1.4 });
    playSfx("boss");
    this.taunt = { text: `☠ ${def.name} 出现了！`, until: this.t + 2.6 };
    // 生成第一道题卡片
    const cfg = waveConfig(this.state.wave);
    const q = pickQuestion(this.state.wave, this.usedIds);
    this.usedIds.add(q.id);
    if (this.usedIds.size > QUESTION_BANK.length - 4) {
      this.usedIds = new Set(Array.from(this.usedIds).slice(-6));
    }
    this.current = {
      q,
      spawnTs: this.t,
      duration: cfg.duration,
      entered: 0,
      exited: 0,
      state: "in",
      selectedIdx: null,
      pendingIdx: null,
      multiSelected: [],
      correct: false,
      riskTriggered: false,
      fiftyRemoved: [],
      hintHighlighted: [],
      optionOrder: q.options.map((_, i) => i),
      skippedViaItem: false,
    };
    // Boss 第一题也触发技能
    this.triggerBossSkill();
    this.emitHud();
  }

  /** Boss 战：加载下一道题（卡片不退出，仅刷新题目） */
  private loadNextBossQuestion(): void {
    const c = this.current;
    if (!c) return;
    const q = pickQuestion(this.state.wave, this.usedIds);
    this.usedIds.add(q.id);
    if (this.usedIds.size > QUESTION_BANK.length - 4) {
      this.usedIds = new Set(Array.from(this.usedIds).slice(-6));
    }
    c.q = q;
    c.spawnTs = this.t;
    c.duration = waveConfig(this.state.wave).duration;
    c.state = "show";
    c.selectedIdx = null;
    c.pendingIdx = null;
    c.multiSelected = [];
    c.correct = false;
    c.riskTriggered = false;
    c.fiftyRemoved = [];
    c.hintHighlighted = [];
    c.optionOrder = q.options.map((_, i) => i);
    c.skippedViaItem = false;
    // 每题触发随机 Boss 技能
    this.triggerBossSkill();
    playSfx("tick");
    this.emitHud();
  }

  /**
   * 触发随机 Boss 技能（每题1个）
   * - shuffleOptions：打乱当前题选项
   * - hideTimer：隐藏倒计时（仅视觉，由 HUD bossSkill 标记）
   * - summonMinion：Boss 回血1点（增加难度）
   * - lockItem：封印道具1题
   */
  private triggerBossSkill(): void {
    if (!this.boss?.active || !this.boss.def.skills || this.boss.def.skills.length === 0) {
      this.bossSkill = null;
      this.itemLocked = false;
      return;
    }
    const skills = this.boss.def.skills;
    const skill = skills[Math.floor(Math.random() * skills.length)];
    this.bossSkill = skill;
    // 重置道具封印（仅 lockItem 时设为 true）
    this.itemLocked = false;

    if (skill === "shuffleOptions" && this.current) {
      this.current.q = this.shuffleQuestionOptions(this.current.q);
      this.current.optionOrder = this.current.q.options.map((_, i) => i);
      this.toast = { text: "🌀 Boss 技能：选项被打乱！", tone: "bad", until: this.t + 2.0 };
    } else if (skill === "hideTimer") {
      this.toast = { text: "🕶 Boss 技能：倒计时被隐藏！", tone: "bad", until: this.t + 2.0 };
    } else if (skill === "summonMinion") {
      // 召唤小怪：Boss 回血1点（不超过上限）
      if (this.boss.hp < this.boss.maxHp) {
        this.boss.hp += 1;
        this.particles.spawnText(CARD_CX, CARD_CY - 80, "🌀 召唤小怪！Boss 回血", "#E5353B", { size: 14, life: 1.2 });
      }
      this.toast = { text: "🌀 Boss 技能：召唤小怪回血！", tone: "bad", until: this.t + 2.0 };
    } else if (skill === "lockItem") {
      this.itemLocked = true;
      this.toast = { text: "🔒 Boss 技能：道具被封印！", tone: "bad", until: this.t + 2.0 };
    }
    postFX.flash("#E5353B", 0.25, 2);
  }

  /**
   * Boss 战答题处理：命中扣血 / 未命中回血或嘲讽
   * 答错不扣体力，不会结束游戏
   */
  private handleBossReveal(c: Card, correct: boolean): void {
    if (!this.boss) return;
    if (correct) {
      // 命中：Boss 扣血
      this.boss.hp -= 1;
      this.particles.spawnText(CARD_CX, CARD_CY - 40, "HIT!", "#FFD666", { size: 22, life: 0.9 });
      this.particles.spawnText(CARD_CX, CARD_CY - 10, "-1", "#E5353B", { size: 18, life: 0.9 });
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, sparks: 18, dots: 20, speed: 280, life: 0.8, size: 4, color2: "#E5353B" });
      postFX.flash("#FFD666", 0.25, 3);
      postFX.shake(5, 10);
      playSfx("hit");
      // Boss 命中顿挫：冻结 + 卡片弹动
      this.hitStopRemain = 0.07;
      this.cardPulse = 1;
      if (this.boss.hp <= 0) {
        this.boss.defeated = true;
        this.defeatBoss();
      } else {
        this.toast = { text: `命中！${this.boss.def.name} HP ${this.boss.hp}/${this.boss.maxHp}`, tone: "good", until: this.t + 1.6 };
      }
    } else {
      // 未命中：Boss 回血（概率）或嘲讽，不扣体力
      const healed = this.boss.hp < this.boss.maxHp && Math.random() < 0.5;
      if (healed) {
        this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + 1);
        this.particles.spawnText(CARD_CX, CARD_CY - 40, "HEAL", "#E5353B", { size: 18, life: 0.9 });
      } else {
        this.particles.spawnText(CARD_CX, CARD_CY - 40, "MISS", "#7A8FB0", { size: 18, life: 0.9 });
      }
      const tauntText = this.boss.def.taunts[Math.floor(Math.random() * this.boss.def.taunts.length)];
      this.taunt = { text: tauntText, until: this.t + 2.4 };
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#E5353B", { sparks: 12, dots: 14, speed: 200, life: 0.7, size: 3 });
      postFX.glitch(0.35, 3);
      postFX.shake(4, 8);
      playSfx("bad");
      this.toast = { text: `未命中！${healed ? "Boss 回血" : tauntText}`, tone: "bad", until: this.t + 1.8 };
    }
  }

  /** Boss 击破：大爆炸 + 奖励分 + 2 个随机道具 */
  private defeatBoss(): void {
    if (!this.boss) return;
    const wave = this.state.wave;
    const bonus = 500 + wave * 10;
    this.state.score += bonus;
    this.stats.bossDefeated += 1;
    // Boss 击破：清除技能状态
    this.bossSkill = null;
    this.itemLocked = false;
    // 大爆炸：冲击波 + 双层粒子 + 慢镜头 hit-stop
    this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, sparks: 30, dots: 36, speed: 360, life: 1.2, size: 5, color2: "#E5353B", shockwave: true });
    this.particles.spawnBurst(CARD_CX, CARD_CY, "#E5353B", { sparks: 24, dots: 28, speed: 300, life: 1.0, size: 4, color2: "#FFD666" });
    // 第三层：金色环爆（强化击破华丽度）
    this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFFFFF", { ring: true, sparks: 14, dots: 0, speed: 420, life: 0.6, size: 3 });
    this.particles.spawnText(CARD_CX, CARD_CY - 60, `BOSS 击破！+${bonus}`, "#FFD666", { size: 20, life: 1.6 });
    postFX.flash("#FFD666", 0.6, 2);
    postFX.shake(12, 16);
    postFX.glitch(0.8, 4);
    playSfx("boss");
    // 慢镜头：较长 hit-stop 营造击破瞬间的史诗感
    this.hitStopRemain = 0.18;
    this.cardPulse = 1;
    setTimeout(() => playSfx("win"), 400);
    // 奖励 2 个随机道具（静默发放，不覆盖击败提示）
    const keys: FBItemType[] = ["freeze", "fifty", "skip", "double", "hint", "undo"];
    for (let i = 0; i < 2; i++) {
      const pick = keys[Math.floor(Math.random() * keys.length)];
      this.items[pick] += 1;
    }
    this.toast = { text: `🏆 击破 ${this.boss.def.name}！奖励 +${bonus} 分 · 2 个道具`, tone: "good", until: this.t + 3.0 };
    this.boss.active = false;
  }

  /** 每 10 wave 奖励：随机一个道具 +1 */
  private grantRandomItem(): void {
    const keys: FBItemType[] = ["freeze", "fifty", "skip", "double", "hint", "undo"];
    const pick = keys[Math.floor(Math.random() * keys.length)];
    this.items[pick] += 1;
    this.toast = {
      text: `🎁 战功奖励：${itemLabel(pick)} +1`,
      tone: "info",
      until: this.t + 2.4,
    };
    playSfx("good");
    postFX.flash("#FFD666", 0.3, 2);
  }

  /** 心跳强度 0..1：倒计时剩余越少越强，揭示态归零 */
  private computeHeartbeat(): number {
    const c = this.current;
    if (!c || (c.state !== "show" && c.state !== "in")) return 0;
    const ratio = clamp(1 - (this.t - c.spawnTs) / c.duration, 0, 1);
    // ratio<0.5 开始心跳，<0.25 急跳
    if (ratio > 0.5) return 0;
    if (ratio > 0.25) return (0.5 - ratio) / 0.25 * 0.5; // 0..0.5
    return 0.5 + (0.25 - ratio) / 0.25 * 0.5; // 0.5..1
  }

  private emitHud(): void {
    const tier = manTierFor(this.state.score);
    const c = this.current;
    // Boss hideTimer 技能：倒计时强制显示满（视觉隐藏）
    const hideTimer = this.bossSkill === "hideTimer" && this.boss?.active;
    const timerRatio = c && (c.state === "show" || c.state === "in")
      ? (hideTimer ? 1 : clamp(1 - (this.t - c.spawnTs) / c.duration, 0, 1))
      : c && c.state === "reveal" ? 0 : 1;
    const kind: FBQuestionKind = c ? (c.q.kind ?? "single") : "single";
    const hud: FBHud = {
      wave: this.state.wave,
      score: this.state.score,
      combo: this.state.combo,
      stamina: this.state.stamina,
      maxStamina: MAX_STAMINA,
      manLevel: tier.level,
      manName: tier.name,
      manColor: tier.color,
      busted: this.state.busted,
      timerRatio,
      options: c ? c.q.options : [],
      hasQuestion: !!c && (c.state === "show" || c.state === "in" || c.state === "reveal"),
      qType: c ? c.q.type : "",
      qKind: kind,
      riskIdx: c ? (c.q.risk ?? []) : [],
      multiSelected: c ? c.multiSelected.slice() : [],
      pendingIdx: c && c.state === "show" ? c.pendingIdx : null,
      selectedIdx: c && c.state === "reveal" ? c.selectedIdx : null,
      correctIdx: c && c.state === "reveal" ? (c.q.answer ?? null) : null,
      correctIdxList: c && c.state === "reveal" ? (c.q.answers ?? []) : [],
      riskTriggered: c ? c.riskTriggered : false,
      taunt: this.taunt && this.t < this.taunt.until ? this.taunt.text : null,
      heartbeat: this.heartbeat,
      items: { ...this.items },
      fiftyRemoved: c ? c.fiftyRemoved.slice() : [],
      hintHighlighted: c ? c.hintHighlighted.slice() : [],
      freezeRemaining: this.freezeRemaining,
      doubleRemaining: this.doubleRemaining,
      bossActive: this.boss?.active ?? false,
      bossName: this.boss?.active ? this.boss.def.name : undefined,
      bossHp: this.boss?.active ? this.boss.hp : undefined,
      bossMaxHp: this.boss?.active ? this.boss.maxHp : undefined,
      bossSkill: this.boss?.active ? this.bossSkill : null,
      itemLocked: this.itemLocked,
      specialEvent: this.specialEvent,
      chainStep: c ? (c.q.chainStep ?? (c.isChainFollowUp ? 2 : null)) : null,
      isNormal: c ? !!c.q.isNormal : false,
      optionOrder: c ? c.optionOrder.slice() : [],
    };
    this.emit({ type: "hud", payload: hud as unknown as Record<string, string | number> });
    if (this.toast && this.t < this.toast.until) {
      this.emit({ type: "toast", text: this.toast.text, tone: this.toast.tone });
    }
  }

  protected render(): void {
    const ctx = this.ctx;
    const shaking = this.t < this.shakeUntil;
    const sx = shaking ? (Math.random() - 0.5) * 8 : 0;
    const sy = shaking ? (Math.random() - 0.5) * 8 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // 背景
    clearCanvas(ctx, W, H, "#070E1F");
    drawGrid(ctx, W, H, 28, "rgba(0,229,255,0.05)");
    this.drawGrain(ctx);
    this.drawScanlines(ctx);

    // 压迫感暗角（随倒计时收紧）
    this.drawPressureVignette(ctx);

    // 顶部科技框
    this.drawTechHeader(ctx);

    // 当前卡片
    if (this.current) {
      this.drawCard(ctx, this.current);
    } else if (!this.state.over) {
      drawText(ctx, `WAVE ${this.state.wave}`, CARD_CX, H / 2, {
        size: 26, color: ACCENT, weight: "900", align: "center",
        shadow: { color: ACCENT, blur: 14 },
      });
      drawText(ctx, "准备就绪…", CARD_CX, H / 2 + 36, {
        size: 13, color: "#7A8FB0", weight: "500", align: "center",
      });
    }

    this.particles.render(ctx);

    // 心跳红屏脉动（压迫感）：与心跳节拍同步
    this.drawHeartbeatPulse(ctx);
    // 屏幕裂纹（错答/风险触发）
    this.drawScreenCrack(ctx);

    ctx.restore();
  }

  /** 心跳红屏脉动：心跳越强，红屏越明显，模拟紧张压迫 */
  private drawHeartbeatPulse(ctx: CanvasRenderingContext2D): void {
    if (this.heartbeat <= 0) return;
    // 双拍节律：t 缩放到 ~1.1s 一周期，前拍强后拍弱
    const beat = (this.t % 1.1) / 1.1;
    let amp: number;
    if (beat < 0.12) amp = Math.sin((beat / 0.12) * Math.PI);            // 主拍
    else if (beat > 0.22 && beat < 0.34) amp = Math.sin(((beat - 0.22) / 0.12) * Math.PI) * 0.55; // 副拍
    else amp = 0;
    const alpha = this.heartbeat * amp * 0.32;
    if (alpha <= 0.004) return;
    ctx.save();
    const g = ctx.createRadialGradient(CARD_CX, CARD_CY, H * 0.2, CARD_CX, CARD_CY, H * 0.7);
    g.addColorStop(0, "rgba(229,53,59,0)");
    g.addColorStop(1, `rgba(229,53,59,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /** 屏幕裂纹：错答/风险触发后短暂覆盖，强化压迫感 */
  private drawScreenCrack(ctx: CanvasRenderingContext2D): void {
    if (!this.crack) return;
    const remain = this.crack.until - this.t;
    if (remain <= 0) return;
    const alpha = clamp(remain / 1.4, 0, 1) * 0.7;
    const seed = this.crack.seed;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.shadowColor = `rgba(229,53,59,${alpha})`;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    // 中心向外的几条主裂纹 + 分叉
    const cx = CARD_CX + (seed % 40) - 20;
    const cy = CARD_CY + (seed % 30) - 15;
    const branches = 5;
    for (let i = 0; i < branches; i++) {
      const baseAng = (i / branches) * Math.PI * 2 + (seed % 7) * 0.3;
      let x = cx, y = cy;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 4 + (i % 2);
      for (let s = 0; s < segs; s++) {
        const ang = baseAng + (Math.sin(seed + i * 3 + s) * 0.5);
        const len = 22 + ((seed + i * 7 + s * 13) % 28);
        x += Math.cos(ang) * len;
        y += Math.sin(ang) * len;
        ctx.lineTo(x, y);
        // 分叉
        if (s === 1 && i % 2 === 0) {
          const bx = x + Math.cos(ang + 0.9) * 18;
          const by = y + Math.sin(ang + 0.9) * 18;
          ctx.moveTo(x, y);
          ctx.lineTo(bx, by);
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
    // 中心冲击点
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 颗粒感：每帧随机噪点 */
  private drawGrain(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const n = 140;
    for (let i = 0; i < n; i++) {
      const x = (i * 53 + this.grainSeed * 7) % W;
      const y = (i * 89 + this.grainSeed * 11) % H;
      const a = 0.02 + ((i * 13 + this.grainSeed) % 7) * 0.008;
      ctx.fillStyle = `rgba(180,220,255,${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }

  /** 扫描线 */
  private drawScanlines(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#00E5FF";
    const off = (this.t * 30) % 4;
    for (let y = -off; y < H; y += 4) {
      ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();
  }

  /** 压迫感暗角：倒计时越少越暗越红，越紧迫暗角越向中心收缩 */
  private drawPressureVignette(ctx: CanvasRenderingContext2D): void {
    const c = this.current;
    let pressure = 0;
    if (c && (c.state === "show" || c.state === "in")) {
      pressure = 1 - clamp(1 - (this.t - c.spawnTs) / c.duration, 0, 1);
    }
    if (pressure <= 0.05) return;
    // 收缩半径：压力越大暗角越向中心逼近（以卡片为中心）
    const innerR = H * (0.28 - pressure * 0.14);
    const outerR = H * (0.64 - pressure * 0.06);
    const alpha = pressure * 0.6;
    const g = ctx.createRadialGradient(CARD_CX, CARD_CY, innerR, CARD_CX, CARD_CY, outerR);
    g.addColorStop(0, "rgba(0,0,0,0)");
    const edge = pressure > 0.7 ? `rgba(229,53,59,${alpha})` : `rgba(0,0,0,${alpha})`;
    g.addColorStop(1, edge);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 高压红脉（与心跳同步，压迫感更强）
    if (pressure > 0.6) {
      const pulse = this.heartbeat > 0
        ? (Math.sin((this.t % 1.1) / 1.1 * Math.PI * 2) * 0.5 + 0.5)
        : (Math.sin(this.t * 14) + 1) / 2;
      const k = (pressure - 0.6) / 0.4; // 0..1
      ctx.fillStyle = `rgba(229,53,59,${0.04 + pulse * 0.08 * k})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawTechHeader(ctx: CanvasRenderingContext2D): void {
    // 顶部装饰横线 + 角标
    ctx.strokeStyle = "rgba(0,229,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, 70);
    ctx.lineTo(W - 16, 70);
    ctx.stroke();
    // 角标
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    const corners: [number, number, number, number][] = [
      [8, 8, 1, 1], [W - 8, 8, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * 14);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * 14, y);
      ctx.stroke();
    }
  }

  private drawCard(ctx: CanvasRenderingContext2D, c: Card): void {
    const cardX = CARD_X;
    const cardY = CARD_Y;
    const cardW = CARD_W;
    const cardH = CARD_H;
    let y = cardY;
    let alpha = 1;
    let scale = 1;

    if (c.state === "in") {
      const ease = 1 - Math.pow(1 - c.entered, 3);
      y = cardY + (1 - ease) * 70;
      alpha = ease;
      scale = 0.94 + ease * 0.06;
    } else if (c.state === "out") {
      const ease = c.exited * c.exited;
      y = cardY + ease * 50;
      alpha = 1 - ease;
      scale = 1 - ease * 0.25;
    }

    // Boss 卡片视觉：boss 存在即生效（含击败后的揭示动画期）
    const isBoss = !!this.boss;
    const accent = isBoss ? "#E5353B" : "#00E5FF";
    // Boss 卡片：略微放大 + 故障感微偏移
    if (isBoss) {
      scale *= 1.06;
    }
    // 击中弹动：cardPulse 驱动 scale 瞬间放大再回弹（爽感）
    scale *= 1 + this.cardPulse * 0.08;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(CARD_CX, y + cardH / 2);
    ctx.scale(scale, scale);
    ctx.translate(-CARD_CX, -(y + cardH / 2));
    // Boss 卡片故障感：随机水平微偏移
    if (isBoss) {
      ctx.translate((Math.random() - 0.5) * 3, 0);
    }

    // 投影
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, cardX, y, cardW, cardH, 14);
    ctx.fillStyle = "#0A1929";
    ctx.fill();
    ctx.restore();

    // 3D 斜面边框（亮上左、暗下右）：Boss 用红色调
    const bevel = ctx.createLinearGradient(cardX, y, cardX + cardW, y + cardH);
    if (isBoss) {
      bevel.addColorStop(0, "rgba(255,120,120,0.6)");
      bevel.addColorStop(0.5, "rgba(229,53,59,0.2)");
      bevel.addColorStop(1, "rgba(60,0,0,0.5)");
    } else {
      bevel.addColorStop(0, "rgba(159,227,255,0.5)");
      bevel.addColorStop(0.5, "rgba(0,229,255,0.15)");
      bevel.addColorStop(1, "rgba(0,0,0,0.4)");
    }
    roundRect(ctx, cardX, y, cardW, cardH, 14);
    ctx.lineWidth = 2;
    ctx.strokeStyle = bevel;
    ctx.stroke();

    // Boss 红色脉冲外边框
    if (isBoss) {
      const pulse = 0.5 + Math.sin(this.t * 6) * 0.5;
      ctx.save();
      ctx.shadowColor = "#E5353B";
      ctx.shadowBlur = 10 + pulse * 8;
      ctx.strokeStyle = `rgba(229,53,59,${0.6 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      roundRect(ctx, cardX - 2, y - 2, cardW + 4, cardH + 4, 16);
      ctx.stroke();
      ctx.restore();
    }

    // 内层面板渐变：Boss 用更暗红的底色
    const panel = ctx.createLinearGradient(0, y, 0, y + cardH);
    if (isBoss) {
      panel.addColorStop(0, "#2A1320");
      panel.addColorStop(1, "#1A0A12");
    } else {
      panel.addColorStop(0, "#13294A");
      panel.addColorStop(1, "#0C1B33");
    }
    roundRect(ctx, cardX + 4, y + 4, cardW - 8, cardH - 8, 11);
    ctx.fillStyle = panel;
    ctx.fill();

    // 顶部强调条
    const topBar = ctx.createLinearGradient(cardX, y, cardX + cardW, y);
    topBar.addColorStop(0, isBoss ? "rgba(229,53,59,0)" : "rgba(0,229,255,0)");
    topBar.addColorStop(0.5, accent);
    topBar.addColorStop(1, isBoss ? "rgba(229,53,59,0)" : "rgba(0,229,255,0)");
    ctx.fillStyle = topBar;
    roundRect(ctx, cardX + 10, y + 4, cardW - 20, 2, 1);
    ctx.fill();

    // Boss 头部：名称 + 血条（占顶部 28px，后续内容下移）
    const headerH = isBoss ? 28 : 0;
    if (isBoss && this.boss) {
      this.drawBossHeader(ctx, cardX, y + 6, cardW, this.boss);
    }

    // 卡片类型 + 倒计时
    const typeLabel = this.cardTypeLabel(c.q.cardType);
    drawText(ctx, typeLabel, cardX + 16, y + 22 + headerH, {
      size: 11, color: accent, weight: "700", font: Theme.fonts.mono,
    });
    drawText(ctx, c.q.type, cardX + 16, y + 40 + headerH, {
      size: 14, color: "#F0F4FF", weight: "700",
    });

    // 倒计时进度条（Boss hideTimer 技能隐藏）
    const hideTimer = this.bossSkill === "hideTimer" && this.boss?.active;
    const elapsed = clamp(this.t - c.spawnTs, 0, c.duration);
    const progress = c.state === "reveal" ? 0 : 1 - elapsed / c.duration;
    const barX = cardX + cardW - 92;
    const barY = y + 20;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, barX, barY, 76, 6, 3);
    ctx.fill();
    if (!hideTimer) {
      const barColor = progress > 0.5 ? ACCENT : progress > 0.25 ? "#FFD666" : "#E5353B";
      ctx.fillStyle = barColor;
      ctx.shadowColor = barColor;
      ctx.shadowBlur = 6;
      roundRect(ctx, barX, barY, 76 * progress, 6, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
      drawText(ctx, `${Math.max(0, c.duration - elapsed).toFixed(1)}s`, barX + 76, barY + 4, {
        size: 10, color: barColor, weight: "700", align: "right", font: Theme.fonts.mono,
      });
    } else {
      drawText(ctx, "🕶 --.-s", barX + 76, barY + 4, {
        size: 10, color: "#7A8FB0", weight: "700", align: "right", font: Theme.fonts.mono,
      });
    }
    ctx.restore();

    // ===== 状态徽章（连锁/特殊事件/Boss技能/正常情境）=====
    this.drawCardBadges(ctx, c, cardX, y + 44 + headerH, cardW);

    // 内容（Boss 卡片因头部占位整体下移）
    this.drawCardContent(ctx, c, cardX + 18, y + 66 + headerH, cardW - 36, accent);

    // 科技角标
    this.drawCardCorners(ctx, cardX, y, cardW, cardH, accent);

    ctx.restore();
  }

  /** 卡片状态徽章：连锁追问/特殊事件/Boss技能/正常情境 */
  private drawCardBadges(ctx: CanvasRenderingContext2D, c: Card, x: number, y: number, w: number): void {
    const badges: { text: string; color: string }[] = [];
    // 连锁追问
    if (c.isChainFollowUp) {
      badges.push({ text: "🔗 连锁追问", color: "#B388FF" });
    } else if (c.q.chainStep === 1) {
      badges.push({ text: "🔗 连锁题", color: "#B388FF" });
    }
    // 特殊事件
    if (this.specialEvent) {
      const evName = specialEventName(this.specialEvent);
      badges.push({ text: `⚡ ${evName}`, color: "#FFB020" });
    }
    // Boss 技能
    if (this.bossSkill && this.boss?.active) {
      const skillText = this.bossSkillLabel(this.bossSkill);
      badges.push({ text: skillText, color: "#E5353B" });
    }
    // 正常情境（mixedTrueFalse）
    if (c.q.isNormal) {
      badges.push({ text: "✓ 正常情境", color: "#52C41A" });
    }
    if (badges.length === 0) return;
    // 横向排布在卡片右上区域
    let bx = x + w - 8;
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = badges.length - 1; i >= 0; i--) {
      const b = badges[i];
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      const tw = ctx.measureText(b.text).width + 14;
      const bxBadge = bx - tw;
      roundRect(ctx, bxBadge, y, tw, 16, 8);
      ctx.fillStyle = "rgba(10,25,41,0.7)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = b.color;
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, bxBadge + tw - 7, y + 8);
      bx = bxBadge - 6;
    }
    ctx.restore();
  }

  /** Boss 技能中文标签 */
  private bossSkillLabel(skill: FBBossSkill): string {
    switch (skill) {
      case "shuffleOptions": return "🌀 选项打乱";
      case "hideTimer": return "🕶 隐藏倒计时";
      case "summonMinion": return "🌀 召唤小怪";
      case "lockItem": return "🔒 道具封印";
    }
  }

  /** Boss 头部：名称（居中红色）+ 分段血条 */
  private drawBossHeader(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, boss: { def: FBBoss; hp: number; maxHp: number; active: boolean; defeated: boolean }): void {
    // Boss 名称（居中，红色发光）
    drawText(ctx, `☠ ${boss.def.name}`, x + w / 2, y + 4, {
      size: 14, color: "#E5353B", weight: "900", align: "center",
      shadow: { color: "#E5353B", blur: 8 },
    });
    // 分段血条（避开右侧倒计时区域）
    const hpX = x + 16;
    const hpW = w - 116; // 右侧留 100px 给倒计时
    const hpY = y + 16;
    const segW = hpW / boss.maxHp;
    ctx.save();
    for (let i = 0; i < boss.maxHp; i++) {
      const filled = i < boss.hp;
      if (filled) {
        ctx.fillStyle = "#E5353B";
        ctx.shadowColor = "#E5353B";
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = "rgba(229,53,59,0.15)";
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(hpX + i * segW + 1, hpY, segW - 2, 5);
    }
    ctx.shadowBlur = 0;
    // HP 数字
    drawText(ctx, `HP ${Math.max(0, boss.hp)}/${boss.maxHp}`, hpX + hpW + 4, hpY + 3, {
      size: 9, color: "#E5353B", weight: "700", font: Theme.fonts.mono, baseline: "middle",
    });
    ctx.restore();
  }

  private drawCardCorners(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const s = 12;
    const corners: [number, number, number, number][] = [
      [x + 2, y + 2, 1, 1], [x + w - 2, y + 2, -1, 1],
      [x + 2, y + h - 2, 1, -1], [x + w - 2, y + h - 2, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * s);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * s, cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 卡片内容：拟真手机 UI
   * chat=微信聊天 / call=来电界面 / video=视频通话 / sms=短信通知 / transfer=转账页 / popup=浏览器弹窗
   */
  private drawCardContent(
    ctx: CanvasRenderingContext2D,
    c: Card,
    x: number,
    y: number,
    w: number,
    accent: string
  ): void {
    const q = c.q;
    // 分隔线
    ctx.strokeStyle = "rgba(0,229,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    const bodyY = y + 8;
    const bodyColor = "#F0F4FF";

    if (q.cardType === "call" || q.cardType === "video") {
      this.drawCallScreen(ctx, q, x, bodyY, w, accent, q.cardType === "video");
    } else if (q.cardType === "sms") {
      this.drawSmsScreen(ctx, q, x, bodyY, w, bodyColor);
    } else if (q.cardType === "transfer") {
      this.drawTransferScreen(ctx, q, x, bodyY, w, bodyColor);
    } else if (q.cardType === "popup") {
      this.drawPopupScreen(ctx, q, x, bodyY, w, bodyColor);
    } else {
      this.drawChatScreen(ctx, q, x, bodyY, w, accent, bodyColor);
    }
  }

  /** 微信聊天界面：绿色顶栏 + 头像 + 接收消息气泡 + 输入提示 */
  private drawChatScreen(ctx: CanvasRenderingContext2D, q: FBQuestion, x: number, y: number, w: number, accent: string, bodyColor: string): void {
    // ===== 微信顶栏 =====
    const headerH = 32;
    ctx.save();
    roundRect(ctx, x, y, w, headerH, 6);
    const headerG = ctx.createLinearGradient(x, y, x, y + headerH);
    headerG.addColorStop(0, "#2E2E2E");
    headerG.addColorStop(1, "#1F1F1F");
    ctx.fillStyle = headerG;
    ctx.fill();
    ctx.restore();
    // 返回箭头
    ctx.save();
    ctx.strokeStyle = "#52C41A";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 16);
    ctx.lineTo(x + 9, y + 16);
    ctx.lineTo(x + 14, y + 11);
    ctx.moveTo(x + 9, y + 16);
    ctx.lineTo(x + 14, y + 21);
    ctx.stroke();
    ctx.restore();
    drawText(ctx, q.title, x + w / 2, y + 16, {
      size: 12, color: "#F0F4FF", weight: "700", align: "center", max: 22,
    });
    // 右上"…"菜单
    drawText(ctx, "⋯", x + w - 14, y + 16, { size: 16, color: "#52C41A", weight: "900", align: "right", baseline: "middle" });

    // ===== 聊天区域 =====
    const chatY = y + headerH + 10;
    // 时间戳
    drawText(ctx, this.formatChatTime(), x + w / 2, chatY, {
      size: 9, color: "#7A8FB0", weight: "500", align: "center", font: Theme.fonts.mono,
    });

    // 头像（左侧，微信绿色）
    const avX = x + 8;
    const avY = chatY + 14;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avX + 14, avY + 14, 14, 0, Math.PI * 2);
    const av = ctx.createLinearGradient(avX, avY, avX + 28, avY + 28);
    av.addColorStop(0, "#73D13D");
    av.addColorStop(1, "#389E0D");
    ctx.fillStyle = av;
    ctx.fill();
    // 头像内文字
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 12px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", avX + 14, avY + 14);
    ctx.restore();

    // 消息气泡（白色，左侧）
    ctx.save();
    ctx.font = "500 12px 'Noto Sans SC', sans-serif";
    const maxBubbleW = w - 60;
    const textWidth = ctx.measureText(q.body).width;
    const lines = Math.max(1, Math.ceil(textWidth / maxBubbleW));
    const bubbleH = Math.max(40, 18 + lines * 18);
    const bubbleW = Math.min(maxBubbleW, textWidth + 24);
    const bubbleX = avX + 32;
    const bubbleY = avY;
    roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 6);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    // 气泡小尖角
    ctx.beginPath();
    ctx.moveTo(bubbleX, bubbleY + 10);
    ctx.lineTo(bubbleX - 6, bubbleY + 14);
    ctx.lineTo(bubbleX, bubbleY + 18);
    ctx.closePath();
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();
    // 气泡内文字
    wrapText(ctx, q.body, bubbleX + 10, bubbleY + 14, maxBubbleW - 20, 17, { size: 12, color: "#1F1F1F", weight: "500" });

    // "对方正在输入…"三点动画（紧张感）
    const typingY = bubbleY + bubbleH + 12;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const ph = ((this.t * 2.4) + i * 0.25) % 1.2;
      const a = ph < 0.6 ? Math.sin((ph / 0.6) * Math.PI) : 0;
      ctx.fillStyle = `rgba(82,196,26,${0.3 + a * 0.55})`;
      ctx.beginPath();
      ctx.arc(avX + 14 + i * 8, typingY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    drawText(ctx, "对方正在输入…", avX + 42, typingY, { size: 9, color: "#7A8FB0", weight: "500", baseline: "middle" });
    ctx.restore();
  }

  /** 来电/视频通话界面：深色背景 + 大头像 + 接听/挂断按钮 */
  private drawCallScreen(ctx: CanvasRenderingContext2D, q: FBQuestion, x: number, y: number, w: number, accent: string, isVideo: boolean): void {
    const cx = x + w / 2;
    // 深色渐变背景（模拟通话界面）
    ctx.save();
    roundRect(ctx, x, y, w, 290, 8);
    const bgG = ctx.createLinearGradient(0, y, 0, y + 290);
    if (isVideo) {
      bgG.addColorStop(0, "#0A0A0A");
      bgG.addColorStop(1, "#1A1A2E");
    } else {
      bgG.addColorStop(0, "#1A1A2E");
      bgG.addColorStop(1, "#0A0A14");
    }
    ctx.fillStyle = bgG;
    ctx.fill();
    ctx.restore();

    if (isVideo) {
      // 视频通话：右上小窗（自己的画面）
      ctx.save();
      roundRect(ctx, x + w - 64, y + 10, 54, 40, 4);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      drawText(ctx, "ME", x + w - 37, y + 30, { size: 9, color: "rgba(255,255,255,0.5)", weight: "700", align: "center", font: Theme.fonts.mono });
      ctx.restore();
    }

    // 来电铃声脉冲：3 圈向外扩散
    const avatarY = y + 60;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const phase = ((this.t * 1.2) + i / 3) % 1;
      const r = 32 + phase * 40;
      const a = (1 - phase) * 0.4;
      ctx.strokeStyle = isVideo ? `rgba(82,196,26,${a})` : `rgba(0,229,255,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, avatarY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 大头像
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, avatarY, 32, 0, Math.PI * 2);
    const ag = ctx.createRadialGradient(cx - 8, avatarY - 8, 4, cx, avatarY, 32);
    ag.addColorStop(0, "#FFFFFF");
    ag.addColorStop(0.4, isVideo ? "#52C41A" : accent);
    ag.addColorStop(1, "#0A1929");
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.fillStyle = "#0A1929";
    ctx.font = "900 24px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", cx, avatarY);
    ctx.restore();

    // 来电者名称
    drawText(ctx, q.title, cx, avatarY + 56, { size: 15, color: "#F0F4FF", weight: "700", align: "center", max: 26 });
    // "来电中"/"视频通话中"呼吸闪烁
    const blink = 0.5 + Math.sin(this.t * 5) * 0.5;
    drawText(ctx, isVideo ? "📹 视频通话邀请…" : "📞 来电中…", cx, avatarY + 78, {
      size: 11, color: isVideo ? "#52C41A" : accent, weight: "500", align: "center", font: Theme.fonts.mono,
      shadow: { color: isVideo ? "#52C41A" : accent, blur: 4 + blink * 6 },
    });

    // 消息内容（在按钮上方）
    wrapText(ctx, q.body, x + 16, avatarY + 100, w - 32, 18, { size: 12, color: "rgba(240,244,255,0.85)", weight: "500", align: "center" });

    // 底部接听/挂断按钮
    const btnY = avatarY + 150;
    // 接听（绿色）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx - 50, btnY, 22, 0, Math.PI * 2);
    const acceptG = ctx.createRadialGradient(cx - 50, btnY, 4, cx - 50, btnY, 22);
    acceptG.addColorStop(0, "#73D13D");
    acceptG.addColorStop(1, "#389E0D");
    ctx.fillStyle = acceptG;
    ctx.fill();
    // 电话图标
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "16px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📞", cx - 50, btnY);
    ctx.restore();
    drawText(ctx, "接听", cx - 50, btnY + 32, { size: 10, color: "#52C41A", weight: "700", align: "center" });

    // 挂断（红色）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx + 50, btnY, 22, 0, Math.PI * 2);
    const declineG = ctx.createRadialGradient(cx + 50, btnY, 4, cx + 50, btnY, 22);
    declineG.addColorStop(0, "#FF7875");
    declineG.addColorStop(1, "#CF1322");
    ctx.fillStyle = declineG;
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "16px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📵", cx + 50, btnY);
    ctx.restore();
    drawText(ctx, "挂断", cx + 50, btnY + 32, { size: 10, color: "#E5353B", weight: "700", align: "center" });
  }

  /** 短信通知：iOS 风格通知横幅 */
  private drawSmsScreen(ctx: CanvasRenderingContext2D, q: FBQuestion, x: number, y: number, w: number, bodyColor: string): void {
    // 通知卡片背景（半透明深色，iOS 风格）
    const cardH = 96;
    ctx.save();
    roundRect(ctx, x, y, w, cardH, 10);
    const g = ctx.createLinearGradient(x, y, x, y + cardH);
    g.addColorStop(0, "rgba(40,40,50,0.92)");
    g.addColorStop(1, "rgba(28,28,36,0.92)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    // 应用图标（左上，圆角方块）
    ctx.save();
    roundRect(ctx, x + 10, y + 12, 28, 28, 6);
    const iconG = ctx.createLinearGradient(x + 10, y + 12, x + 38, y + 40);
    iconG.addColorStop(0, "#FFD666");
    iconG.addColorStop(1, "#FA8C16");
    ctx.fillStyle = iconG;
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 14px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📨", x + 24, y + 26);
    ctx.restore();

    // 应用名 + 时间（图标右侧）
    drawText(ctx, "短信", x + 46, y + 16, { size: 11, color: "#7A8FB0", weight: "700", baseline: "top" });
    drawText(ctx, "现在", x + 46, y + 30, { size: 9, color: "#4A5D7A", weight: "500", baseline: "top", font: Theme.fonts.mono });

    // 标题（发件人，醒目）
    drawText(ctx, q.title, x + 46, y + 46, { size: 12, color: "#F0F4FF", weight: "700", max: 24 });

    // 消息预览
    wrapText(ctx, q.body, x + 12, y + 66, w - 24, 16, { size: 11, color: bodyColor, weight: "500" });
  }

  /** 转账页面：银行/支付宝风格 */
  private drawTransferScreen(ctx: CanvasRenderingContext2D, q: FBQuestion, x: number, y: number, w: number, bodyColor: string): void {
    // 顶栏（橙色，支付宝/银行风格）
    const headerH = 36;
    ctx.save();
    roundRect(ctx, x, y, w, headerH, 6);
    const headerG = ctx.createLinearGradient(x, y, x, y + headerH);
    headerG.addColorStop(0, "#FA8C16");
    headerG.addColorStop(1, "#D46B08");
    ctx.fillStyle = headerG;
    ctx.fill();
    ctx.restore();
    drawText(ctx, "💸 转账确认", x + 14, y + 18, { size: 13, color: "#FFFFFF", weight: "700", baseline: "middle" });
    drawText(ctx, "⚠", x + w - 14, y + 18, { size: 14, color: "#FFFFFF", weight: "900", align: "right", baseline: "middle" });

    // 转账信息区域
    const infoY = y + headerH + 12;
    ctx.save();
    roundRect(ctx, x, infoY, w, 110, 8);
    ctx.fillStyle = "#3A2410";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,176,32,0.4)";
    ctx.stroke();
    ctx.restore();

    // 收款方
    drawText(ctx, "收款方", x + 14, infoY + 14, { size: 10, color: "#FFB020", weight: "700", font: Theme.fonts.mono, baseline: "top" });
    drawText(ctx, q.title, x + 14, infoY + 28, { size: 12, color: "#F0F4FF", weight: "700", max: 26, baseline: "top" });

    // 转账金额（醒目大字）
    drawText(ctx, "转账金额", x + 14, infoY + 52, { size: 10, color: "#FFB020", weight: "700", font: Theme.fonts.mono, baseline: "top" });
    // 随机生成金额样式
    const amount = this.extractAmount(q.body) || "5,000.00";
    drawText(ctx, `¥ ${amount}`, x + 14, infoY + 68, { size: 22, color: "#FFD666", weight: "900", baseline: "top", shadow: { color: "#FFB020", blur: 6 } });

    // 消息内容（风险提示）
    wrapText(ctx, q.body, x + 14, infoY + 96, w - 28, 16, { size: 11, color: bodyColor, weight: "500" });

    // 底部确认按钮（橙色，醒目）
    const btnY = infoY + 122;
    ctx.save();
    roundRect(ctx, x + 20, btnY, w - 40, 32, 16);
    const btnG = ctx.createLinearGradient(x, btnY, x, btnY + 32);
    btnG.addColorStop(0, "#FFB020");
    btnG.addColorStop(1, "#FA8C16");
    ctx.fillStyle = btnG;
    ctx.fill();
    ctx.restore();
    drawText(ctx, "确认转账", x + w / 2, btnY + 16, { size: 13, color: "#FFFFFF", weight: "900", align: "center", baseline: "middle" });
  }

  /** 浏览器弹窗：URL 栏 + 警告对话框 */
  private drawPopupScreen(ctx: CanvasRenderingContext2D, q: FBQuestion, x: number, y: number, w: number, bodyColor: string): void {
    // 浏览器 URL 栏
    const urlH = 28;
    ctx.save();
    roundRect(ctx, x, y, w, urlH, 4);
    ctx.fillStyle = "#2A2A2A";
    ctx.fill();
    ctx.restore();
    // 返回/前进按钮
    drawText(ctx, "‹", x + 10, y + 14, { size: 16, color: "#7A8FB0", weight: "900", baseline: "middle" });
    drawText(ctx, "›", x + 24, y + 14, { size: 16, color: "#4A5D7A", weight: "900", baseline: "middle" });
    // URL 输入框
    ctx.save();
    roundRect(ctx, x + 38, y + 4, w - 48, urlH - 8, 8);
    ctx.fillStyle = "#1A1A1A";
    ctx.fill();
    ctx.restore();
    drawText(ctx, "⚠ http://security-alert.win", x + 46, y + 14, { size: 10, color: "#FF6B6B", weight: "700", baseline: "middle", font: Theme.fonts.mono });

    // 弹窗对话框
    const popY = y + urlH + 12;
    const popH = 130;
    ctx.save();
    roundRect(ctx, x, popY, w, popH, 8);
    const popG = ctx.createLinearGradient(0, popY, 0, popY + popH);
    popG.addColorStop(0, "#3A1A1A");
    popG.addColorStop(1, "#2A1010");
    ctx.fillStyle = popG;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#E5353B";
    ctx.stroke();
    ctx.restore();

    // 警告图标（大）
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 24, popY + 24, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#E5353B";
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 16px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", x + 24, popY + 24);
    ctx.restore();

    // 弹窗标题
    drawText(ctx, "⚠ 安全警告", x + 46, popY + 18, { size: 13, color: "#E5353B", weight: "900", baseline: "top" });
    drawText(ctx, q.title, x + 46, popY + 34, { size: 10, color: "#7A8FB0", weight: "500", baseline: "top", max: 26 });

    // 弹窗正文
    wrapText(ctx, q.body, x + 14, popY + 54, w - 28, 16, { size: 12, color: bodyColor, weight: "500" });

    // 底部按钮（确认=红/取消=灰）
    const btnY = popY + popH - 30;
    ctx.save();
    // 确认按钮
    roundRect(ctx, x + w / 2 + 6, btnY, w / 2 - 16, 24, 4);
    ctx.fillStyle = "#E5353B";
    ctx.fill();
    ctx.restore();
    drawText(ctx, "立即处理", x + w / 2 + 6 + (w / 2 - 16) / 2, btnY + 12, { size: 11, color: "#FFFFFF", weight: "700", align: "center", baseline: "middle" });
    // 取消按钮
    ctx.save();
    roundRect(ctx, x + 10, btnY, w / 2 - 16, 24, 4);
    ctx.fillStyle = "#3A3A3A";
    ctx.fill();
    ctx.restore();
    drawText(ctx, "忽略", x + 10 + (w / 2 - 16) / 2, btnY + 12, { size: 11, color: "#7A8FB0", weight: "700", align: "center", baseline: "middle" });
  }

  /** 从消息体提取金额（用于转账页显示） */
  private extractAmount(body: string): string | null {
    const m = body.match(/(\d[\d,]*\.?\d*)\s*[元块]/);
    if (m) return m[1];
    const m2 = body.match(/(\d[\d,]*\.?\d*)/);
    return m2 ? m2[1] : null;
  }

  /** 当前时间格式化（微信聊天时间戳） */
  private formatChatTime(): string {
    const d = new Date();
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  }

  private cardTypeLabel(t: FBQuestion["cardType"]): string {
    switch (t) {
      case "chat": return "💬 CHAT · 聊天消息";
      case "call": return "📞 INCOMING · 来电";
      case "video": return "📹 VIDEO · 视频通话";
      case "transfer": return "💸 TRANSFER · 资金操作";
      case "popup": return "⚠ POPUP · 网页弹窗";
      case "sms": return "📨 SMS · 短信通知";
    }
  }
}
