/**
 * 反诈答题 PK 场景
 * 1v1 回合制对战：玩家 vs AI 诈骗分子
 * 复用 fraudBuster 题库
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawPanel, drawButton, drawProgressBar, drawHudLabel, drawBadge, drawNeonCorners,
  drawScanlineOverlay, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { QUESTION_BANK, pickQuestion } from "@/games/fraudBuster/data";
import type { FBQuestion } from "@/games/fraudBuster/types";
import {
  OPPONENTS, PLAYER_MAX_HP, ULTIMATE_MAX, ULTIMATE_GAIN_PER_CORRECT,
  ANSWER_TIME_LIMIT, playerDamage, PLAYER_SELF_DAMAGE,
  aiDamage, aiAnswerCorrect, aiReactTime, playerTitle,
  PLAYER_ULTIMATES, AI_ULTIMATE_NAMES,
  CHAIN_BUST_MULTIPLIER, CONFUSE_DURATION, TIMER_REDUCTION,
  pickLine, shuffledIndices,
  type Opponent, type PlayerUltimate, type AIUltimate,
} from "@/games/quizFight/data";
import { playSfx, startBGM, stopBGM } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import { ParticleSystem } from "@/engine/Particle";
import { roundRect } from "@/engine/Renderer";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import type { GameResultPayload } from "@/types";
import { platformStore } from "@/store/platformStore";

type Phase = "intro" | "answering" | "reveal" | "stageClear" | "defeat" | "victory";

const LETTERS = ["A", "B", "C", "D"];

export class QuizFightScene extends GameShellScene {
  private phase: Phase = "intro";
  private stageIdx = 0;
  private opponent: Opponent = OPPONENTS[0];
  private playerHp = PLAYER_MAX_HP;
  private opponentHp = 0;
  private ultimate = 0;
  /** 已激活的玩家大招（将在下一题生效） */
  private pendingUltimate: PlayerUltimate | null = null;
  private currentQuestion: FBQuestion | null = null;
  private selectedIdx: number | null = null;
  private answered = false;
  private answerTimer = 0;
  private aiReactTime = 0;
  private aiCorrect = false;
  private revealTimer = 0;
  private stagesCleared = 0;
  private totalCorrect = 0;
  private totalDamageDealt = 0;
  private startedAt = 0;
  private usedQuestions = new Set<string>();
  private t = 0;
  private particles = new ParticleSystem();
  private resultOverlay: ResultOverlay | null = null;
  private pressedOpt: number | null = null;
  private pressedSubmit = false;
  /** 当前按下的玩家大招按钮（null=无） */
  private pressedUltButton: PlayerUltimate | null = null;
  private pressedContinue = false;
  /** 飘字 toast */
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  /** 屏幕坐标的对战信息（用于粒子定位） */
  private opponentScreenPos = { x: 0, y: 0 };

  // ============ AI 大招状态 ============
  /** 待触发的 AI 大招（将在下一题生效） */
  private pendingAIUltimate: AIUltimate | null = null;
  /** 主大招是否已触发（避免重复触发） */
  private aiUltTriggered = false;
  /** 次级大招是否已触发（boss 用） */
  private aiSecondaryTriggered = false;

  // ============ 大招特效状态（answering 阶段生效） ============
  /** 混淆剩余秒数（>0 表示选项被打乱显示） */
  private confuseTimer = 0;
  /** 选项显示顺序映射：displayIdx → originalIdx（混淆期间使用） */
  private shuffledOrder: number[] = [];
  /** 玩家答题时间减少秒数（施压） */
  private timerReduction = 0;
  /** 时间锁定激活（AI 本题无法造成伤害） */
  private timeLockActive = false;
  /** 真相揭示激活（本题显示答案线索） */
  private truthRevealActive = false;

  getGameTitle(): string { return "反诈答题 PK"; }
  getGameSubtitle(): string { return "QUIZ FIGHT"; }
  getAccent(): string { return Theme.accents["fraud-buster"] || "#1AD670"; }

  enter(): void {
    super.enter();
    this.startStage(0);
    this.startedAt = performance.now();
    // v2：进入战斗场景切换战斗 BGM
    startBGM("battle");
  }

  exit(): void {
    super.exit();
    // 离开场景时停止 BGM（Hub 会重新启动 hub BGM）
    stopBGM();
  }

  private startStage(idx: number): void {
    this.stageIdx = idx;
    this.opponent = OPPONENTS[idx];
    this.opponentHp = this.opponent.maxHp;
    this.phase = "intro";
    this.selectedIdx = null;
    this.answered = false;
    this.pendingUltimate = null;
    // 重置 AI 大招状态（每关独立）
    this.pendingAIUltimate = null;
    this.aiUltTriggered = false;
    this.aiSecondaryTriggered = false;
    this.confuseTimer = 0;
    this.shuffledOrder = [];
    this.timerReduction = 0;
    this.timeLockActive = false;
    this.truthRevealActive = false;
    playSfx("click");
  }

  /**
   * 抽取下一题
   * @param forceHarder 是否强制抽取更难的题（终极诈骗效果用）
   */
  private pickNextQuestion(forceHarder = false): FBQuestion {
    // 优先从对手偏好的类型中抽；找不到则全库随机
    const preferred = this.opponent.preferredTypes;
    const wave = Math.min(3, 1 + this.stageIdx);
    for (let tries = 0; tries < 5; tries++) {
      const q = pickQuestion(wave, this.usedQuestions);
      if (!this.usedQuestions.has(q.id)) {
        // 终极诈骗：强制更难（difficulty >= 3）
        if (forceHarder && q.difficulty < 3 && tries < 4) continue;
        // 50% 概率优先选偏好类型
        if (!forceHarder && tries < 3 && Math.random() < 0.6 && !preferred.includes(q.typeId as never)) continue;
        this.usedQuestions.add(q.id);
        return q;
      }
    }
    // fallback（pickQuestion 内部已处理全库回退，此处为防御性兜底）
    const fallback = pickQuestion(wave, new Set<string>());
    if (!this.usedQuestions.has(fallback.id)) this.usedQuestions.add(fallback.id);
    return fallback;
  }

  private startAnswering(): void {
    // 应用待生效的 AI 大招（决定本题出题方式）
    let forceHarder = false;
    if (this.pendingAIUltimate === "pressure") {
      this.timerReduction = TIMER_REDUCTION;
    } else if (this.pendingAIUltimate === "ultimateScam") {
      forceHarder = true;
    }

    this.currentQuestion = this.pickNextQuestion(forceHarder);
    // 混淆需要根据本题实际选项数生成映射
    if (this.pendingAIUltimate === "confuse") {
      this.confuseTimer = CONFUSE_DURATION;
      this.shuffledOrder = shuffledIndices(this.currentQuestion.options.length);
    }
    this.selectedIdx = null;
    this.answered = false;
    this.answerTimer = 0;
    this.aiReactTime = aiReactTime(this.opponent);
    this.aiCorrect = aiAnswerCorrect(this.opponent);

    // 应用待生效的玩家大招
    if (this.pendingUltimate === "timeLock") {
      this.timeLockActive = true;
      postFX.flash("#00E5FF", 0.4);
      playSfx("timeSlow");
      this.spawnUltName("时间锁定", "#00E5FF");
      this.spawnBurst("#00E5FF", 24);
    } else if (this.pendingUltimate === "truthReveal") {
      this.truthRevealActive = true;
      postFX.flash(Theme.colors.flag.DEFAULT, 0.4);
      playSfx("achievement");
      this.spawnUltName("真相揭示", Theme.colors.flag.DEFAULT);
      this.spawnBurst(Theme.colors.flag.DEFAULT, 24);
    }
    // chainBust 不在此处生效，留到 submitAnswer 时计算伤害

    this.phase = "answering";
    playSfx("click");
  }

  private submitAnswer(): void {
    if (!this.currentQuestion || this.selectedIdx === null) return;
    const q = this.currentQuestion;
    const correct = this.selectedIdx === q.answer;
    const reactTime = this.answerTimer;
    // 连环识破：3 倍伤害
    const multiplier = this.pendingUltimate === "chainBust" ? CHAIN_BUST_MULTIPLIER : 1;

    if (correct) {
      const dmg = playerDamage(reactTime, q.difficulty, multiplier);
      this.opponentHp = Math.max(0, this.opponentHp - dmg);
      this.totalDamageDealt += dmg;
      this.totalCorrect++;
      // 答对获得大招槽积累（连环识破已消耗，不再扣减积累）
      this.ultimate = Math.min(ULTIMATE_MAX, this.ultimate + ULTIMATE_GAIN_PER_CORRECT);
      // 连环识破特效
      if (this.pendingUltimate === "chainBust") {
        this.spawnUltName("连环识破！", Theme.colors.warn.glow);
        postFX.flash(Theme.colors.warn.glow, 0.4);
        playSfx("weaponUp");
        this.spawnBurst(Theme.colors.warn.glow, 30);
      }
      // 伤害数字飘字
      this.spawnDamageText(Math.round(dmg), this.opponentScreenPos.x, this.opponentScreenPos.y, Theme.colors.warn.glow);
      playSfx("good");
      postFX.flash(Theme.colors.safe.DEFAULT, 0.3);
      this.spawnBurst(Theme.colors.safe.DEFAULT, 20);
      // 对手受伤台词
      const hurt = pickLine(this.opponent.hurtLines);
      this.toast = {
        text: hurt ? `反诈正确！-${Math.round(dmg)} HP · "${hurt}"` : `反诈正确！造成 ${Math.round(dmg)} 点伤害`,
        tone: "good",
        until: this.t + 2,
      };
    } else {
      this.playerHp = Math.max(0, this.playerHp - PLAYER_SELF_DAMAGE);
      playSfx("bad");
      postFX.shake(8, 0.3);
      postFX.flash(Theme.colors.warn.DEFAULT, 0.3);
      // 自损数字飘字（玩家位置左下）
      this.spawnDamageText(PLAYER_SELF_DAMAGE, this.director.screenWidth * 0.25, 100, Theme.colors.warn.DEFAULT);
      this.toast = { text: `答错！自损 ${PLAYER_SELF_DAMAGE} 点`, tone: "bad", until: this.t + 2 };
    }

    // AI 行动：时间锁定激活时，对手本题无法造成伤害
    if (this.aiCorrect && !this.timeLockActive) {
      const aiDmg = aiDamage(this.stageIdx + 1, q.difficulty);
      this.playerHp = Math.max(0, this.playerHp - aiDmg);
      // 对手挑衅台词
      const attack = pickLine(this.opponent.attackLines);
      this.toast = {
        text: attack
          ? (correct ? `对手答对，反伤 ${aiDmg} · "${attack}"` : `对手答对，你被反诈 ${aiDmg} · "${attack}"`)
          : (correct ? `对手答对，反伤 ${aiDmg}` : `对手答对，你被反诈 ${aiDmg}`),
        tone: "bad",
        until: this.t + 2,
      };
      // AI 伤害数字飘字（玩家位置）
      this.spawnDamageText(aiDmg, this.director.screenWidth * 0.25, 100, this.opponent.accent);
      postFX.shake(6, 0.25);
    } else if (this.timeLockActive) {
      // 时间锁定生效，AI 无法行动
      this.toast = {
        text: correct ? `时间锁定！对手被冻结，无法反击` : `时间锁定！对手被冻结`,
        tone: "info",
        until: this.t + 2,
      };
    }

    // 清除玩家大招 pending（无论是否命中，单次有效）
    this.pendingUltimate = null;
    // 清除 AI 大招 pending（已生效）
    this.pendingAIUltimate = null;
    // 清除本题生效的特效状态
    this.timeLockActive = false;
    this.truthRevealActive = false;
    this.confuseTimer = 0;
    this.shuffledOrder = [];
    this.timerReduction = 0;

    this.answered = true;
    this.phase = "reveal";
    this.revealTimer = 0;

    // 检查并触发 AI 大招（HP 阈值）
    this.checkAIUltimateTrigger();
  }

  /**
   * 检查对手 HP 是否低于大招阈值，触发主/次级大招
   * 在 submitAnswer 后调用（HP 已更新）
   */
  private checkAIUltimateTrigger(): void {
    const hpRatio = this.opponentHp / this.opponent.maxHp;
    // 主大招
    if (
      !this.aiUltTriggered &&
      this.opponent.ultimate &&
      this.opponent.ultThreshold !== undefined &&
      hpRatio <= this.opponent.ultThreshold
    ) {
      this.aiUltTriggered = true;
      this.triggerAIUltimate(this.opponent.ultimate);
    }
    // 次级大招（boss 用）
    if (
      !this.aiSecondaryTriggered &&
      this.opponent.secondaryUltimate &&
      this.opponent.secondaryUltThreshold !== undefined &&
      hpRatio <= this.opponent.secondaryUltThreshold
    ) {
      this.aiSecondaryTriggered = true;
      this.triggerAIUltimate(this.opponent.secondaryUltimate);
    }
  }

  /**
   * 触发 AI 大招：设置 pendingAIUltimate，下一题生效
   * 同时播放视觉/音效反馈
   */
  private triggerAIUltimate(ult: AIUltimate): void {
    this.pendingAIUltimate = ult;
    const name = AI_ULTIMATE_NAMES[ult];
    // 大招名称飘字（对手位置）
    this.spawnUltName(name, this.opponent.accent);
    switch (ult) {
      case "confuse":
        // 混淆：轻微 glitch
        postFX.glitch(0.3, 2);
        postFX.flash(this.opponent.accent, 0.3);
        playSfx("laser");
        this.spawnBurst(this.opponent.accent, 20);
        this.toast = { text: `对手发动【${name}】！下题选项将被混淆`, tone: "bad", until: this.t + 2.4 };
        break;
      case "pressure":
        // 施压：中度 glitch
        postFX.glitch(0.4, 2);
        postFX.flash(Theme.colors.warn.DEFAULT, 0.35);
        playSfx("boss");
        this.spawnBurst(Theme.colors.warn.DEFAULT, 24);
        this.toast = { text: `对手发动【${name}】！下题答题时间减少 ${TIMER_REDUCTION} 秒`, tone: "bad", until: this.t + 2.4 };
        break;
      case "ultimateScam":
        // 终极诈骗：强 glitch + 红色 flash
        postFX.glitch(0.7, 3);
        postFX.flash("#E5353B", 0.5);
        postFX.shake(10, 0.4);
        playSfx("boss");
        playSfx("shieldBreak");
        this.spawnBurst("#E5353B", 40);
        this.spawnBurst("#FF00E5", 20);
        this.toast = { text: `对手发动【${name}】！下题将替换为更难的题`, tone: "bad", until: this.t + 2.8 };
        break;
    }
  }

  /**
   * 激活玩家大招：扣除大招槽，设置 pendingUltimate
   * 仅在 charge >= cost 时可调用
   */
  private activatePlayerUltimate(ult: PlayerUltimate): void {
    const info = PLAYER_ULTIMATES.find((u) => u.id === ult);
    if (!info) return;
    if (this.ultimate < info.cost) return;
    if (this.pendingUltimate === ult) {
      // 已激活，再次点击取消（退还大招槽）
      this.pendingUltimate = null;
      this.ultimate += info.cost;
      if (this.ultimate > ULTIMATE_MAX) this.ultimate = ULTIMATE_MAX;
      playSfx("click");
      return;
    }
    this.ultimate -= info.cost;
    this.pendingUltimate = ult;
    playSfx("weaponUp");
    postFX.flash(Theme.colors.flag.DEFAULT, 0.3);
    this.spawnUltName(info.name, Theme.colors.flag.DEFAULT);
  }

  /** 当前生效的答题时限（受施压影响） */
  private get effectiveAnswerTimeLimit(): number {
    return Math.max(3, ANSWER_TIME_LIMIT - this.timerReduction);
  }

  private nextTurn(): void {
    // 检查胜负
    if (this.opponentHp <= 0) {
      // 击败对手
      this.stagesCleared = this.stageIdx + 1;
      if (this.stageIdx >= OPPONENTS.length - 1) {
        // 全胜
        this.phase = "victory";
        this.finishGame(true);
      } else {
        this.phase = "stageClear";
        playSfx("win");
        postFX.flash(Theme.colors.flag.DEFAULT, 0.5);
        this.spawnBurst(Theme.colors.flag.DEFAULT, 50);
      }
      return;
    }
    if (this.playerHp <= 0) {
      // 玩家失败
      this.phase = "defeat";
      this.finishGame(false);
      return;
    }
    // 继续下一题
    this.startAnswering();
  }

  private finishGame(win: boolean): void {
    const durationSec = (performance.now() - this.startedAt) / 1000;
    const result: GameResultPayload = {
      gameId: "quiz-fight",
      win,
      score: this.totalDamageDealt + this.stagesCleared * 100,
      bustedCount: this.totalCorrect,
      tipId: "tip-001",
    };
    // 记录到 store
    const newly = platformStore.recordGame({
      gameId: "quiz-fight",
      score: result.score,
      busted: this.totalCorrect,
      unlockedTypes: this.collectUnlockedTypes(),
      durationSec,
      win,
    });
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director), undefined, "slide"),
    });
    if (win) {
      playSfx("win");
      postFX.flash(Theme.colors.flag.DEFAULT, 0.6);
      this.spawnBurst(Theme.colors.flag.DEFAULT, 80);
    } else {
      playSfx("bad");
      postFX.flash(Theme.colors.warn.DEFAULT, 0.5);
    }
  }

  private collectUnlockedTypes(): string[] {
    // 玩家通关的诈骗类型解锁
    const types = new Set<string>();
    if (this.currentQuestion) types.add(this.currentQuestion.typeId);
    for (const q of this.usedQuestions) {
      const found = QUESTION_BANK.find((x) => x.id === q);
      if (found) types.add(found.typeId);
    }
    return Array.from(types);
  }

  private retry(): void {
    this.resultOverlay = null;
    this.playerHp = PLAYER_MAX_HP;
    this.opponentHp = 0;
    this.ultimate = 0;
    this.pendingUltimate = null;
    this.pendingAIUltimate = null;
    this.aiUltTriggered = false;
    this.aiSecondaryTriggered = false;
    this.confuseTimer = 0;
    this.shuffledOrder = [];
    this.timerReduction = 0;
    this.timeLockActive = false;
    this.truthRevealActive = false;
    this.stagesCleared = 0;
    this.totalCorrect = 0;
    this.totalDamageDealt = 0;
    this.usedQuestions.clear();
    this.startedAt = performance.now();
    this.startStage(0);
  }

  protected updateGame(dt: number): void {
    this.t += dt;
    this.particles.update(dt);

    if (this.phase === "answering") {
      this.answerTimer += dt;
      // 混淆特效倒计时
      if (this.confuseTimer > 0) {
        this.confuseTimer -= dt;
        if (this.confuseTimer <= 0) {
          this.confuseTimer = 0;
          this.shuffledOrder = [];
        }
      }
      if (this.answerTimer >= this.effectiveAnswerTimeLimit) {
        // 超时算答错
        this.selectedIdx = -1;
        this.submitAnswer();
      }
    } else if (this.phase === "reveal") {
      this.revealTimer += dt;
      // 自动 2 秒后进入下一回合
      if (this.revealTimer >= 2.4) {
        this.nextTurn();
      }
    }

    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 背景
    ctx.fillStyle = Theme.colors.bg.deep;
    ctx.fillRect(0, 48, screenW, screenH - 48 - 24);

    // 对战信息：双 HP 条 + 头像
    this.renderBattleHeader(ctx, screenW);
    // 对手气泡
    this.renderOpponentArea(ctx, screenW, screenH);
    // 大招槽
    this.renderUltimateBar(ctx, screenW, screenH);

    // 主要内容区
    if (this.phase === "intro") {
      this.renderIntroOverlay(ctx, screenW, screenH);
    } else if (this.phase === "answering" || this.phase === "reveal") {
      this.renderQuestion(ctx, screenW, screenH);
      this.renderOptions(ctx, screenW, screenH);
    } else if (this.phase === "stageClear") {
      this.renderStageClearOverlay(ctx, screenW, screenH);
    }

    // 粒子
    this.particles.render(ctx);

    // Toast
    if (this.toast && this.t < this.toast.until) {
      this.renderToast(ctx, screenW);
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderBattleHeader(ctx: CanvasRenderingContext2D, screenW: number): void {
    const y = 56;
    const h = 60;
    const pad = 16;
    const barW = (screenW - pad * 2 - 80) / 2;

    // 玩家区（左）
    drawPanel(ctx, pad, y, barW, h, { borderColor: withAlpha(Theme.colors.safe.DEFAULT, 0.3) });
    ctx.save();
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.safe.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("玩家 · " + playerTitle(this.stagesCleared).name, pad + 12, y + 8);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${this.playerHp}/${PLAYER_MAX_HP}`, pad + 12, y + 24);
    ctx.restore();
    drawProgressBar(ctx, pad + 12, y + 42, barW - 24, 8, this.playerHp / PLAYER_MAX_HP, Theme.colors.safe.DEFAULT);

    // 中央 VS / 关卡
    const cx = screenW / 2;
    ctx.save();
    ctx.font = `900 22px ${Theme.fonts.display}`;
    ctx.fillStyle = this.opponent.accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(this.opponent.accent, 0.5);
    ctx.shadowBlur = 12;
    ctx.fillText(`VS`, cx, y + h / 2);
    ctx.shadowBlur = 0;
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`STAGE ${this.stageIdx + 1}/${OPPONENTS.length}`, cx, y + h - 6);
    ctx.restore();

    // 对手区（右）
    const ox = pad + barW + 80;
    drawPanel(ctx, ox, y, barW, h, { borderColor: withAlpha(this.opponent.accent, 0.45) });
    ctx.save();
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = this.opponent.accent;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(this.opponent.name, ox + barW - 12, y + 8);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${this.opponentHp}/${this.opponent.maxHp}`, ox + barW - 12, y + 24);
    ctx.restore();
    drawProgressBar(ctx, ox + 12, y + 42, barW - 24, 8, this.opponentHp / this.opponent.maxHp, this.opponent.accent);

    // 记录对手头像位置用于粒子
    this.opponentScreenPos = { x: ox + barW / 2, y: y + h + 60 };
  }

  private renderOpponentArea(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.phase === "intro" || this.phase === "stageClear") return;
    const cx = screenW / 2;
    const y = 132;

    // 对手头像（大 emoji + 边框）
    const avatarSize = 64;
    const ax = cx - avatarSize / 2;
    ctx.save();
    // 时间锁定激活时，头像周围用青色冰冻光环
    if (this.timeLockActive) {
      ctx.fillStyle = withAlpha("#00E5FF", 0.18);
      ctx.beginPath();
      ctx.arc(cx, y + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha("#00E5FF", 0.7);
      ctx.lineWidth = 2;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 10 + Math.sin(this.t * 5) * 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = withAlpha(this.opponent.accent, 0.12);
      ctx.beginPath();
      ctx.arc(cx, y + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(this.opponent.accent, 0.4);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // 头像 emoji（时间锁定时灰度感——叠加青色透明层）
    ctx.font = `48px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.opponent.avatar, cx, y + avatarSize / 2 + 4);
    if (this.timeLockActive) {
      ctx.fillStyle = withAlpha("#00E5FF", 0.25);
      ctx.beginPath();
      ctx.arc(cx, y + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 状态/挑衅
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.timeLockActive ? "#00E5FF" : Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let stateText = "";
    if (this.timeLockActive) {
      stateText = `❄ 时间锁定 · 对手被冻结`;
    } else if (this.phase === "answering") {
      stateText = `正在出题… · ${this.opponent.role}`;
    } else if (this.phase === "reveal") {
      stateText = this.aiCorrect ? `对手答对了！` : `对手答错了…`;
    }
    ctx.fillText(stateText, cx, y + avatarSize + 8);
    ctx.restore();

    void ax;
  }

  private renderUltimateBar(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const y = screenH - 24 - 50;
    const h = 36;
    const pad = 12;
    const w = screenW - pad * 2;
    const ratio = this.ultimate / ULTIMATE_MAX;

    // 整体面板：作为 3 个按钮的容器
    const ready = this.ultimate >= 50; // 至少能启用连环识破
    drawPanel(ctx, pad, y, w, h, {
      borderColor: ready ? withAlpha(Theme.colors.flag.DEFAULT, 0.5) : withAlpha(Theme.colors.bg.line, 0.8),
      bgColor: Theme.colors.bg.panel,
      cut: 4,
    });

    // 进度填充（作为底色显示大招槽积累）
    if (ratio > 0) {
      ctx.save();
      roundRect(ctx, pad + 2, y + 2, (w - 4) * ratio, h - 4, 3);
      ctx.fillStyle = withAlpha(Theme.colors.flag.DEFAULT, 0.18);
      ctx.fill();
      ctx.restore();
    }

    // 顶部细线进度条
    ctx.save();
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.6);
    ctx.fillRect(pad, y, w, 2);
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.shadowColor = Theme.colors.flag.DEFAULT;
    ctx.shadowBlur = ready ? 6 + Math.sin(this.t * 6) * 2 : 0;
    ctx.fillRect(pad, y, w * ratio, 2);
    ctx.restore();

    // 3 个大招按钮
    const btnGap = 4;
    const btnW = (w - btnGap * (PLAYER_ULTIMATES.length - 1)) / PLAYER_ULTIMATES.length;
    for (let i = 0; i < PLAYER_ULTIMATES.length; i++) {
      const info = PLAYER_ULTIMATES[i];
      const bx = pad + i * (btnW + btnGap);
      const canAfford = this.ultimate >= info.cost;
      const isSelected = this.pendingUltimate === info.id;
      this.renderUltimateButton(ctx, bx, y + 4, btnW, h - 8, info.id, info.name, info.cost, canAfford, isSelected);
    }
  }

  /** 渲染单个大招按钮 */
  private renderUltimateButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    id: PlayerUltimate, name: string, cost: number,
    canAfford: boolean, isSelected: boolean,
  ): void {
    const accent = Theme.colors.flag.DEFAULT;
    const dim = Theme.colors.ink.dim;
    const pressed = this.pressedUltButton === id;

    // 选中态：填充背景 + 脉冲发光
    if (isSelected) {
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8 + Math.sin(this.t * 8) * 3;
      ctx.fillStyle = withAlpha(accent, 0.25);
      roundRect(ctx, x, y, w, h, 4);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    } else if (canAfford) {
      // 可用但未选中：细边框
      ctx.save();
      ctx.strokeStyle = withAlpha(accent, 0.55);
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, w, h, 4);
      ctx.stroke();
      ctx.restore();
    } else {
      // 不可用：极暗边框
      ctx.save();
      ctx.strokeStyle = withAlpha(dim, 0.4);
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, w, h, 4);
      ctx.stroke();
      ctx.restore();
    }

    // 按下态：轻微下沉
    const offsetY = pressed ? 1 : 0;

    // 大招名称
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = isSelected ? accent : (canAfford ? Theme.colors.ink.DEFAULT : dim);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(name, x + w / 2, y + 4 + offsetY);
    ctx.restore();

    // 消耗值
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = isSelected ? withAlpha(accent, 0.9) : (canAfford ? withAlpha(accent, 0.7) : dim);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${cost}%`, x + w / 2, y + h - 3 + offsetY);
    ctx.restore();
  }

  private renderIntroOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const cx = screenW / 2;
    const y = 220;

    // 大头像 + 名称 + 介绍
    ctx.save();
    ctx.font = `80px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(this.opponent.accent, 0.5);
    ctx.shadowBlur = 20;
    ctx.fillText(this.opponent.avatar, cx, y);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.opponent.accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`STAGE ${this.stageIdx + 1} · ${this.opponent.role}`, cx, y + 56);
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.shadowColor = withAlpha(this.opponent.accent, 0.4);
    ctx.shadowBlur = 10;
    ctx.fillText(this.opponent.name, cx, y + 74);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 对话气泡
    const bubbleW = screenW - 64;
    const bubbleH = 60;
    const bx = (screenW - bubbleW) / 2;
    const by = y + 116;
    drawPanel(ctx, bx, by, bubbleW, bubbleH, {
      borderColor: withAlpha(this.opponent.accent, 0.45),
      bgColor: withAlpha(this.opponent.accent, 0.06),
    });
    ctx.save();
    ctx.font = `400 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`"${this.opponent.intro}"`, cx, by + bubbleH / 2);
    ctx.restore();

    // 开始按钮
    const btnW = screenW - 64;
    const btnH = 48;
    const btnY = by + bubbleH + 24;
    drawButton(ctx, bx, btnY, btnW, btnH, "开始对战", {
      variant: "primary", accent: this.opponent.accent,
      pressed: this.pressedContinue,
      fontSize: 16,
      subText: "START BATTLE",
    });
  }

  private renderStageClearOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const cx = screenW / 2;
    const y = 200;

    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`STAGE ${this.stageIdx + 1} CLEARED`, cx, y);
    ctx.font = `700 28px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.shadowColor = withAlpha(Theme.colors.flag.DEFAULT, 0.5);
    ctx.shadowBlur = 16;
    ctx.fillText(`击败 ${this.opponent.name}`, cx, y + 18);
    ctx.shadowBlur = 0;
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`"${this.opponent.defeat}"`, cx, y + 64);
    ctx.restore();

    // 继续按钮
    const btnW = screenW - 64;
    const btnH = 48;
    const bx = (screenW - btnW) / 2;
    const by = y + 116;
    drawButton(ctx, bx, by, btnW, btnH, "挑战下一关", {
      variant: "primary", accent: Theme.colors.flag.DEFAULT,
      pressed: this.pressedContinue,
      fontSize: 16,
      subText: `NEXT STAGE · ${Math.min(this.stageIdx + 2, OPPONENTS.length)}/${OPPONENTS.length}`,
    });
  }

  private renderQuestion(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.currentQuestion) return;
    const q = this.currentQuestion;
    const pad = 16;
    const w = screenW - pad * 2;
    const y = 210;
    const cardH = 140;

    // 真相揭示激活时，题目边框高亮金色
    const borderColor = this.truthRevealActive
      ? Theme.colors.flag.DEFAULT
      : withAlpha(this.opponent.accent, 0.35);
    drawPanel(ctx, pad, y, w, cardH, { borderColor });
    drawNeonCorners(ctx, pad, y, w, cardH,
      this.truthRevealActive ? Theme.colors.flag.DEFAULT : this.opponent.accent,
      undefined, undefined, 4);

    // 标题
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`[${q.type}] · ${q.cardType}`, pad + 12, y + 10);
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = this.truthRevealActive ? Theme.colors.flag.DEFAULT : this.opponent.accent;
    ctx.fillText(q.title, pad + 12, y + 26);
    // 题面
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    this.wrapText(ctx, q.body, pad + 12, y + 52, w - 24, 18);
    ctx.restore();

    // 真相揭示：显示线索（从 cues 中取第一条）
    if (this.truthRevealActive && q.cues.length > 0) {
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.flag.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.shadowColor = withAlpha(Theme.colors.flag.DEFAULT, 0.5);
      ctx.shadowBlur = 6;
      const hint = `💡 线索：${q.cues[0]}`;
      this.wrapText(ctx, hint, pad + 12, y + cardH - 36, w - 24, 14);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 倒计时（answering 阶段）——使用 effectiveAnswerTimeLimit（施压会减少）
    if (this.phase === "answering") {
      const limit = this.effectiveAnswerTimeLimit;
      const remaining = Math.max(0, limit - this.answerTimer);
      const ratio = remaining / limit;
      const barY = y + cardH - 18;
      const barW = w - 24;
      ctx.save();
      ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.6);
      ctx.fillRect(pad + 12, barY, barW, 4);
      const color = ratio > 0.5 ? Theme.colors.safe.DEFAULT
        : ratio > 0.25 ? Theme.colors.flag.DEFAULT
        : Theme.colors.warn.DEFAULT;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillRect(pad + 12, barY, barW * ratio, 4);
      ctx.shadowBlur = 0;
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = color;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      // 施压激活时倒计时变红
      const prefix = this.timerReduction > 0 ? "⚠ " : "";
      ctx.fillText(`${prefix}${remaining.toFixed(1)}s`, pad + w - 12, barY - 14);
      ctx.restore();
    } else if (this.phase === "reveal" && q.source) {
      // 揭示态：在题卡底部单行显示题级来源（超出宽度省略），供内容核查
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const maxW = w - 24;
      let line = "来源：" + q.source;
      if (ctx.measureText(line).width > maxW) {
        while (line.length > 1 && ctx.measureText(line + "…").width > maxW) {
          line = line.slice(0, -1);
        }
        line += "…";
      }
      ctx.fillText(line, pad + 12, y + cardH - 10);
      ctx.restore();
    }
  }

  private renderOptions(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.currentQuestion) return;
    const q = this.currentQuestion;
    const pad = 16;
    const w = screenW - pad * 2;
    const optsStartY = 360;
    const optH = 46;
    const optGap = 8;
    const isReveal = this.phase === "reveal";
    // 混淆激活期间使用 shuffledOrder 映射显示位置→原始索引
    const confused = this.confuseTimer > 0 && this.shuffledOrder.length === q.options.length;

    for (let i = 0; i < q.options.length; i++) {
      const oy = optsStartY + i * (optH + optGap);
      // 原始索引：混淆时按 shuffledOrder 映射；否则就是 i
      const originalIdx = confused ? this.shuffledOrder[i] : i;
      this.renderOption(ctx, pad, oy, w, optH, i, originalIdx, q.options[originalIdx], isReveal, confused);
    }

    // 混淆提示
    if (confused) {
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = this.opponent.accent;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = withAlpha(this.opponent.accent, 0.5);
      ctx.shadowBlur = 4;
      ctx.fillText(`⚠ 混淆中 ${this.confuseTimer.toFixed(1)}s`, pad + w, optsStartY - 4);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 提交/下一题按钮
    const actionY = optsStartY + q.options.length * (optH + optGap) + 12;
    const actionH = 42;
    if (isReveal) {
      const remaining = Math.max(0, 2.4 - this.revealTimer);
      drawButton(ctx, pad, actionY, w, actionH, `下一回合 (${remaining.toFixed(1)}s)`, {
        variant: "primary", accent: this.opponent.accent,
        pressed: this.pressedContinue,
        fontSize: 14,
      });
    } else {
      const canSubmit = this.selectedIdx !== null;
      drawButton(ctx, pad, actionY, w, actionH, "提交答案", {
        variant: canSubmit ? "primary" : "ghost",
        accent: this.opponent.accent,
        pressed: this.pressedSubmit,
        fontSize: 14,
      });
    }
  }

  private renderOption(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    displayIdx: number, originalIdx: number, text: string, isReveal: boolean, confused: boolean
  ): void {
    if (!this.currentQuestion) return;
    const q = this.currentQuestion;
    // selectedIdx 存储的是原始索引
    const isSelected = this.selectedIdx === originalIdx;
    const isCorrect = q.answer === originalIdx;
    const isTimeout = this.selectedIdx === -1;
    const accent = this.opponent.accent;

    let bg: string = Theme.colors.bg.panel;
    let border: string = withAlpha(Theme.colors.bg.line, 0.8);
    let textColor: string = Theme.colors.ink.DEFAULT;
    let labelColor: string = Theme.colors.ink.muted;

    if (isReveal) {
      if (isCorrect) {
        bg = withAlpha(Theme.colors.safe.DEFAULT, 0.12);
        border = Theme.colors.safe.DEFAULT;
        textColor = Theme.colors.safe.glow;
        labelColor = Theme.colors.safe.DEFAULT;
      } else if (isSelected && !isCorrect) {
        bg = withAlpha(Theme.colors.warn.DEFAULT, 0.1);
        border = Theme.colors.warn.DEFAULT;
        textColor = Theme.colors.warn.glow;
        labelColor = Theme.colors.warn.DEFAULT;
      }
    } else if (isSelected) {
      bg = withAlpha(accent, 0.1);
      border = accent;
      labelColor = accent;
    } else if (isTimeout) {
      bg = withAlpha(Theme.colors.warn.DEFAULT, 0.06);
    }

    // 混淆期间，pressedOpt 存储的是显示位置；否则存储原始索引
    const pressed = confused
      ? this.pressedOpt === displayIdx
      : this.pressedOpt === originalIdx;

    drawPanel(ctx, x, y, w, h, { borderColor: border, bgColor: bg, cut: 6 });
    if (pressed) drawNeonCorners(ctx, x, y, w, h, accent, undefined, undefined, 4);

    // 字母徽章——使用显示位置的字母（混淆时 A/B/C/D 与原选项不一致）
    ctx.save();
    ctx.fillStyle = withAlpha(labelColor, 0.18);
    ctx.beginPath();
    ctx.arc(x + 22, y + h / 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = labelColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(LETTERS[displayIdx], x + 22, y + h / 2);
    ctx.restore();

    // 选项文本
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.wrapText(ctx, text, x + 44, y + 10, w - 56, 16);
    ctx.restore();

    // 状态图标
    if (isReveal && isCorrect) {
      drawIcon(ctx, "check", x + w - 22, y + h / 2 - 8, 16, Theme.colors.safe.DEFAULT);
    } else if (isReveal && isSelected && !isCorrect) {
      drawIcon(ctx, "x", x + w - 22, y + h / 2 - 8, 16, Theme.colors.warn.DEFAULT);
    }
  }

  private renderToast(ctx: CanvasRenderingContext2D, screenW: number): void {
    if (!this.toast) return;
    const pad = 16;
    const w = screenW - pad * 2;
    const h = 32;
    const y = 124;
    const tone = this.toast.tone;
    const color = tone === "good" ? Theme.colors.safe.DEFAULT
      : tone === "bad" ? Theme.colors.warn.DEFAULT
      : Theme.colors.neon.DEFAULT;
    drawPanel(ctx, pad, y, w, h, {
      borderColor: withAlpha(color, 0.5),
      bgColor: withAlpha(color, 0.08),
    });
    ctx.save();
    ctx.font = `500 12px ${Theme.fonts.body}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.toast.text, pad + w / 2, y + h / 2);
    ctx.restore();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    let line = "";
    let yy = y;
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = ch;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  private spawnBurst(color: string, count: number): void {
    const cx = this.opponentScreenPos.x;
    const cy = this.opponentScreenPos.y;
    for (let i = 0; i < count; i++) {
      this.particles.spawn({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 60,
        count: 1,
        speed: 80 + Math.random() * 120,
        life: 0.8 + Math.random() * 0.6,
        size: 1.5 + Math.random() * 2,
        color,
        spread: Math.PI * 2,
        angle: Math.random() * Math.PI * 2,
        friction: 0.92,
      });
    }
  }

  /** 飘字：伤害数字 */
  private spawnDamageText(dmg: number, x: number, y: number, color: string): void {
    this.particles.spawnText(x, y, `-${dmg}`, color, { size: 18, life: 1.1 });
  }

  /** 飘字：大招名称（屏幕顶部居中） */
  private spawnUltName(name: string, color: string): void {
    this.particles.spawnText(this.director.screenWidth / 2, 70, name, color, { size: 22, life: 1.6 });
  }

  /**
   * 命中检测：返回被点击的大招按钮 id，未命中返回 null
   * 坐标布局与 renderUltimateBar 保持一致（pad=12）
   */
  private hitTestUltimateButton(x: number, y: number, screenW: number, screenH: number): PlayerUltimate | null {
    const barY = screenH - 24 - 50;
    const h = 36;
    const pad = 12;
    const w = screenW - pad * 2;
    const btnGap = 4;
    const btnW = (w - btnGap * (PLAYER_ULTIMATES.length - 1)) / PLAYER_ULTIMATES.length;
    const btnH = h - 8;
    const btnY = barY + 4;
    if (y < btnY || y > btnY + btnH) return null;
    for (let i = 0; i < PLAYER_ULTIMATES.length; i++) {
      const bx = pad + i * (btnW + btnGap);
      if (x >= bx && x <= bx + btnW) {
        return PLAYER_ULTIMATES[i].id;
      }
    }
    return null;
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const pad = 16;

    if (type === "start") {
      // 大招按钮点击（3 个并排按钮，仅在 answering/reveal 阶段可激活）
      const ultBtn = this.hitTestUltimateButton(x, y, screenW, screenH);
      if (ultBtn) {
        const info = PLAYER_ULTIMATES.find((u) => u.id === ultBtn);
        if (info && this.ultimate >= info.cost && (this.phase === "answering" || this.phase === "reveal")) {
          this.pressedUltButton = ultBtn;
          return true;
        }
      }

      if (this.phase === "intro") {
        const btnW = screenW - 64;
        const btnH = 48;
        const bx = (screenW - btnW) / 2;
        const by = 220 + 116 + 60 + 24;
        const btnRect: Rect = { x: bx, y: by, w: btnW, h: btnH };
        if (hitTest(x, y, btnRect)) { this.pressedContinue = true; return true; }
      } else if (this.phase === "stageClear") {
        const btnW = screenW - 64;
        const btnH = 48;
        const bx = (screenW - btnW) / 2;
        const by = 200 + 116;
        const btnRect: Rect = { x: bx, y: by, w: btnW, h: btnH };
        if (hitTest(x, y, btnRect)) { this.pressedContinue = true; return true; }
      } else if (this.phase === "answering") {
        // 选项：按显示位置 i 检测（混淆时 i 不等于原始索引）
        const optsStartY = 360;
        const optH = 46;
        const optGap = 8;
        const q = this.currentQuestion;
        if (q) {
          for (let i = 0; i < q.options.length; i++) {
            const oy = optsStartY + i * (optH + optGap);
            const optRect: Rect = { x: pad, y: oy, w: screenW - pad * 2, h: optH };
            if (hitTest(x, y, optRect)) { this.pressedOpt = i; return true; }
          }
          // 提交
          const actionY = optsStartY + q.options.length * (optH + optGap) + 12;
          const actionRect: Rect = { x: pad, y: actionY, w: screenW - pad * 2, h: 42 };
          if (hitTest(x, y, actionRect)) { this.pressedSubmit = true; return true; }
        }
      } else if (this.phase === "reveal") {
        // 下一回合
        const optsStartY = 360;
        const optH = 46;
        const optGap = 8;
        const q = this.currentQuestion;
        if (q) {
          const actionY = optsStartY + q.options.length * (optH + optGap) + 12;
          const actionRect: Rect = { x: pad, y: actionY, w: screenW - pad * 2, h: 42 };
          if (hitTest(x, y, actionRect)) { this.pressedContinue = true; return true; }
        }
      }
      return false;
    } else if (type === "end") {
      // 大招按钮释放：激活对应大招（重新校验释放位置仍在同一按钮）
      if (this.pressedUltButton) {
        const ult = this.pressedUltButton;
        const info = PLAYER_ULTIMATES.find((u) => u.id === ult);
        const btn = this.hitTestUltimateButton(x, y, screenW, screenH);
        if (btn === ult && info && this.ultimate >= info.cost && (this.phase === "answering" || this.phase === "reveal")) {
          this.activatePlayerUltimate(ult);
        }
        this.pressedUltButton = null;
        return true;
      }
      if (this.pressedContinue) {
        if (this.phase === "intro") {
          playSfx("click");
          this.startAnswering();
        } else if (this.phase === "stageClear") {
          playSfx("click");
          this.startStage(this.stageIdx + 1);
        } else if (this.phase === "reveal") {
          playSfx("click");
          this.nextTurn();
        }
        this.pressedContinue = false;
        return true;
      }
      if (this.pressedSubmit && this.phase === "answering" && this.selectedIdx !== null) {
        playSfx("click");
        this.submitAnswer();
        this.pressedSubmit = false;
        return true;
      }
      if (this.pressedOpt !== null && this.phase === "answering") {
        const i = this.pressedOpt;
        const optsStartY = 360;
        const optH = 46;
        const optGap = 8;
        const q = this.currentQuestion;
        if (q) {
          const oy = optsStartY + i * (optH + optGap);
          const optRect: Rect = { x: pad, y: oy, w: screenW - pad * 2, h: optH };
          if (hitTest(x, y, optRect)) {
            // 混淆时按显示位置 i 映射回原始索引；否则直接使用 i
            const confused = this.confuseTimer > 0 && this.shuffledOrder.length === q.options.length;
            this.selectedIdx = confused ? this.shuffledOrder[i] : i;
            playSfx("click");
          }
        }
        this.pressedOpt = null;
        return true;
      }
      this.pressedOpt = null;
      this.pressedSubmit = false;
      this.pressedContinue = false;
      this.pressedUltButton = null;
      return false;
    }
    return false;
  }
}
