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
import { MAN_TIERS } from "./data";
import type { FBQuestion, FBHud, FBHudSecondCard, FBQuestionKind, FBItemType, FBBoss, FBSpecialEvent, FBBossSkill, FBStats, FBDifficulty, FBWrongRecord, FBPsychology, FBSwipeDir, FBVictimProfile, FBKnowledgeGraph, FBCaseArchive, FBBranchStep, FBBranchChoice, FBAudioClip, FBSeason, FBHudBranchState, FBHudAudioState, FBGameMode, FBStoryStage, FBMiniLesson } from "./types";
import { updateFBSaveAfterRun, loadFBSave, getItemLevel, currentBossWeekKey, saveFBSave } from "./storage";
import { issuePendingCertificates } from "./certificate";
import { buildMiniLesson } from "./miniLesson";
import {
  matchVictimProfile, buildKnowledgeGraph, collectCaseArchives, getItemUpgradeDef, currentSeason, pickBossWeek,
  STORY_STAGES, getStoryStage, pickQuestionsByIds, pickDailyQuestions, dailyKey,
  FB_MODE_LABELS, FB_MODE_HINTS, SPEEDRUN_CONFIG, DAILY_CONFIG, REVIEW_NIGHTMARE_CONFIG,
  buildWeaknessReport,
} from "./dataV2";
import { AIBattleRunner, DeconstructRunner, VersusRunner } from "./v5Modes";
import { DetectiveRunner } from "./v6Modes";

import {
  W,
  H,
  ACCENT,
  CARD_X,
  CARD_Y,
  CARD_W,
  CARD_H,
  CARD_CX,
  CARD_CY,
  MAX_STAMINA,
  type Card,
} from "./engine/constants";
import { itemLabel, itemEmoji } from "./engine/helpers";

export { itemLabel, itemEmoji } from "./engine/helpers";

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
  /** v6：答错即时小课堂状态（available=可展示按钮, lesson=当前展示的教学卡） */
  private miniLessonAvailable = false;
  private miniLesson: FBMiniLesson | null = null;
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
    wrongRecords: [],
    knowledgeStats: [],
    ultimateUsed: 0,
    psychologyStats: {},
    tierDownCount: 0,
    dualCleared: 0,
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
  // ===== 全面升级新增状态 =====
  /** 上一帧段位等级（用于检测段位变化，触发升级/掉段特效） */
  private prevManLevel = 0;
  /** 段位变化方向（场景层一次性消费后置 null） */
  private manLevelDelta: "up" | "down" | null = null;
  /** 双重诈骗同屏双卡（dualMode=true 时长度为 2，否则为 0） */
  private dualCards: Card[] = [];
  /** 双重诈骗模式：两张卡均答对才得分翻倍 */
  private dualMode = false;
  /** 双卡模式下的答题结果记录（用于判定双对/单对/全错） */
  private dualResults: Array<"correct" | "wrong" | null> = [null, null];
  /** 滑动手势状态：当前正在滑动的卡位（0=主卡/左卡，1=右卡，null=未在滑动） */
  private swipingCardIdx: number | null = null;
  /** 滑动起始 x 坐标（画布坐标） */
  private swipeStartX = 0;
  /** 滑动当前 x 坐标（画布坐标） */
  private swipeCurX = 0;
  // ===== 包C/D/F 新增状态 =====
  /** 终极技能量 0..100（连击≥10 可释放反诈必杀技） */
  private ultimateEnergy = 0;
  /** 终极技是否就绪（能量满 100） */
  private ultimateReady = false;
  /** 答案模糊剩余秒（Boss answerBlur 技能） */
  private answerBlurRemaining = 0;
  /** 时间被偷取标记（Boss timeSteal 技能，本题生效） */
  private timeStolen = false;
  /** 急速连答剩余题数（rapidFire 事件） */
  private rapidFireRemaining = 0;
  /** 道具禁用波次标记（itemLock 事件） */
  private itemLockActive = false;
  /** 3D 卡片翻转进度（0..1，入场时翻转） */
  private cardFlipProgress = 0;
  /** 难度模式（包A，默认 normal） */
  private difficulty: FBDifficulty = "normal";
  // ===== v2 升级新增状态 =====
  /** 道具升级等级（B4，从存档加载，1-3） */
  private itemLevels: Record<string, number> = { freeze: 1, fifty: 1, skip: 1, double: 1, hint: 1, undo: 1 };
  /** 当前季节标签（A4） */
  private currentSeasonTag: import("./types").FBSeason | null = null;
  /** Boss 周挑战模式（A6） */
  private bossWeekActive = false;
  /** Boss 周 Boss ID（A6） */
  private bossWeekBossId: string | null = null;
  /** 本局遭遇的题目（用于案例档案收集 A1） */
  private encounteredQuestions: FBQuestion[] = [];
  /** 分支题状态（B3）：currentStepId / history / ended */
  private branchState: { stepId: string; history: Array<{ stepId: string; choiceText: string }>; ended: boolean; ending?: "safe" | "scammed" | "warning"; endingDesc?: string } | null = null;
  /** AI 语音题播放状态（A2） */
  private audioState: { playing: boolean; progress: number; finished: boolean } = { playing: false, progress: 0, finished: false };
  /** 错题复盘模式（A5） */
  private reviewMode = false;
  /** 错题复盘队列（A5） */
  private reviewQueue: FBQuestion[] = [];
  /** 错题复盘已清除 ID（A5） */
  private reviewClearedIds: string[] = [];
  // ===== v3 升级：游戏模式状态 =====
  /** 当前游戏模式（默认 endless） */
  private mode: FBGameMode = "endless";
  /** 模式题目队列（story/daily/review 共用，按顺序出题） */
  private modeQueue: FBQuestion[] = [];
  /** 模式队列当前索引 */
  private modeQueueIdx = 0;
  /** 模式开始时间戳（speedrun 用） */
  private modeStartTs = 0;
  /** 极速模式剩余秒数 */
  private speedrunRemain = 0;
  /** 极速模式已答题数 */
  private speedrunAnswered = 0;
  /** 极速模式正确数 */
  private speedrunCorrect = 0;
  /** 极速模式总题数 */
  private speedrunTotal = 0;
  /** 剧情模式当前关卡索引（null=未开始） */
  private storyStageIdx: number | null = null;
  /** 剧情模式当前关卡已答题数 */
  private storyStageAnswered = 0;
  /** 剧情模式当前关卡正确数 */
  private storyStageCorrect = 0;
  /** 每日挑战日期 key */
  private dailyKeyVal = "";
  /** 每日挑战已答题数 */
  private dailyAnswered = 0;
  /** 错题噩梦已答题数 */
  private reviewNightmareAnswered = 0;
  /** 错题噩梦清除题数 */
  private reviewNightmareCleared = 0;
  /** 硬核模式标记 */
  private hardcoreMode = false;
  /** 模式胜利标记（speedrun/story/daily/review 通关） */
  private modeWin = false;
  // ===== v5 升级：新模式 Runner 实例 =====
  /** AI 对战 Runner（mode="aiBattle" 时有效） */
  private aiBattleRunner: AIBattleRunner | null = null;
  /** 骗局拆解 Runner（mode="deconstruct" 时有效） */
  private deconstructRunner: DeconstructRunner | null = null;
  /** 双人对战 Runner（mode="versus" 时有效） */
  private versusRunner: VersusRunner | null = null;
  // ===== v6 升级：新模式 Runner 实例 =====
  /** 反诈侦探 Runner（mode="detective" 时有效） */
  private detectiveRunner: DetectiveRunner | null = null;

  constructor(canvas: GameCanvas) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    this.startedAt = performance.now();
    this.nextSpawnAt = 0.6;
    // ===== v2 升级初始化 =====
    // B4: 从存档加载道具升级等级
    const save = loadFBSave();
    this.itemLevels = { ...save.itemUpgradeLevels };
    // A4: 设置当前季节
    this.currentSeasonTag = currentSeason();
    // A6: 检查 Boss 周挑战（本周已击败则激活标记）
    const weekKey = currentBossWeekKey();
    if (save.bossWeek && save.bossWeek.weekKey === weekKey) {
      this.bossWeekBossId = save.bossWeek.bossId;
    }
  }

  // ===== v3 升级：游戏模式启动入口 =====

  /** 启动模式配置（由场景在 spawnEngine 后调用） */
  startMode(mode: FBGameMode, opts?: {
    storyStageIdx?: number;
    reviewQuestions?: FBQuestion[];
  }): void {
    this.mode = mode;
    this.modeQueue = [];
    this.modeQueueIdx = 0;
    this.modeStartTs = this.t;
    this.modeWin = false;

    switch (mode) {
      case "endless":
        // 默认模式，无需特殊处理
        break;
      case "story": {
        // 剧情模式：加载指定关卡的题目队列
        const stageIdx = opts?.storyStageIdx ?? 0;
        this.storyStageIdx = stageIdx;
        this.storyStageAnswered = 0;
        this.storyStageCorrect = 0;
        const stage = getStoryStage(stageIdx);
        if (stage) {
          this.modeQueue = pickQuestionsByIds(QUESTION_BANK, stage.questionIds);
        }
        break;
      }
      case "speedrun": {
        // 极速模式：30 题 / 5 分钟，从全题库随机
        this.speedrunRemain = SPEEDRUN_CONFIG.durationSec;
        this.speedrunAnswered = 0;
        this.speedrunCorrect = 0;
        this.speedrunTotal = SPEEDRUN_CONFIG.totalQuestions;
        // 从全题库（含 NEW_QUESTIONS）随机选取 30 题
        const allQs = QUESTION_BANK;
        const shuffled = [...allQs].sort(() => Math.random() - 0.5);
        this.modeQueue = shuffled.slice(0, Math.min(SPEEDRUN_CONFIG.totalQuestions, shuffled.length));
        break;
      }
      case "hardcore": {
        // 硬核模式：1 点体力、无道具、答错即终局
        this.hardcoreMode = true;
        this.state.stamina = 1;
        this.items = { freeze: 0, fifty: 0, skip: 0, double: 0, hint: 0, undo: 0 };
        // 题目从全题库随机，使用 wave 推进
        break;
      }
      case "daily": {
        // 每日挑战：基于日期 key 选取 10 题
        this.dailyKeyVal = dailyKey();
        this.dailyAnswered = 0;
        this.modeQueue = pickDailyQuestions(QUESTION_BANK, this.dailyKeyVal, DAILY_CONFIG.totalQuestions);
        break;
      }
      case "review": {
        // 错题噩梦：使用传入的错题队列（场景层从存档 wrongRecords 重建）
        const reviewQs = opts?.reviewQuestions ?? [];
        // 不足 20 题时用全题库随机补足
        const need = REVIEW_NIGHTMARE_CONFIG.totalQuestions - reviewQs.length;
        if (need > 0) {
          const fillers = QUESTION_BANK
            .filter((q) => !reviewQs.some((r) => r.id === q.id))
            .sort(() => Math.random() - 0.5)
            .slice(0, need);
          this.modeQueue = [...reviewQs, ...fillers];
        } else {
          this.modeQueue = reviewQs.slice(0, REVIEW_NIGHTMARE_CONFIG.totalQuestions);
        }
        this.reviewNightmareAnswered = 0;
        this.reviewNightmareCleared = 0;
        break;
      }
      // ===== v5 升级：三种新模式委托给独立 Runner =====
      case "aiBattle": {
        // AI 对战：与 AI 骗子多轮对话识破，不使用常规卡片状态机
        this.aiBattleRunner = new AIBattleRunner();
        // 这些模式不消耗护盾/连击/段位，重置为初始态避免误显示
        this.state.stamina = MAX_STAMINA;
        // 骗子来电铃声：代入感
        setTimeout(() => playSfx("phoneRing"), 300);
        break;
      }
      case "deconstruct": {
        // 骗局拆解：观看骗子剧本逐句拆解，纯教育模式
        this.deconstructRunner = new DeconstructRunner();
        this.state.stamina = MAX_STAMINA;
        // 拆解模式启动提示音
        setTimeout(() => playSfx("messageBeep"), 200);
        break;
      }
      case "versus": {
        // 双人对战：同设备双人轮流答题，答对攻击对方血量
        this.versusRunner = new VersusRunner();
        this.state.stamina = MAX_STAMINA;
        // 双人对战开始：战斗音效
        setTimeout(() => playSfx("versusHit"), 200);
        break;
      }
      // ===== v6 升级：反诈侦探模式委托给独立 Runner =====
      case "detective": {
        // 反诈侦探：多证据链交叉推理还原诈骗剧本
        this.detectiveRunner = new DetectiveRunner();
        this.state.stamina = MAX_STAMINA;
        // 侦探模式启动：接警音效
        setTimeout(() => playSfx("messageBeep"), 200);
        break;
      }
    }
    this.emitHud();
  }

  // ===== v5 升级：新模式输入入口（由场景调用，委托给 Runner） =====

  /** v5 模式操作结果：供场景层触发屏幕级 FX */
  v5Result: {
    kind: "aiBattle" | "deconstruct" | "versus" | null;
    /** AI 对战：是否识破红旗 */
    bust: boolean;
    /** AI 对战：本次选择判定 right/warn/wrong */
    verdict: string;
    /** AI 对战：本回合累计识破分变化（+N） */
    bustScoreDelta: number;
    /** 骗局拆解：本次动作 */
    action: "showLine" | "showDeconstruct" | "showSummary" | "ended" | null;
    /** 骗局拆解：当前行红旗等级（0-5） */
    lineRedFlag: number;
    /** 双人对战：本次答题是否正确 */
    correct: boolean;
    /** 双人对战：伤害值 */
    damage: number;
    /** 双人对战：受击方 */
    target: "P1" | "P2" | null;
    /** 是否触发结局 */
    ended: boolean;
    /** 结局类型（busted/scammed/timeout/draw 等） */
    ending: string | null;
  } = { kind: null, bust: false, verdict: "", bustScoreDelta: 0, action: null, lineRedFlag: 0, correct: false, damage: 0, target: null, ended: false, ending: null };

  /** AI 对战：玩家选择第 idx 个回复 */
  chooseAIDialog(idx: number): void {
    if (this.state.over || !this.aiBattleRunner) return;
    const prevBustScore = this.aiBattleRunner.getBustScore();
    const result = this.aiBattleRunner.choose(idx);
    const bustScoreDelta = this.aiBattleRunner.getBustScore() - prevBustScore;
    // 反馈音效：识破=redFlag+good，错误=bad，警告=messageBeep
    if (result.bust) {
      playSfx("redFlag");
      playSfx("good");
    } else if (result.verdict === "wrong") {
      playSfx("bad");
    } else {
      playSfx("messageBeep");
    }
    // 识破时给点视觉反馈
    if (result.bust) {
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, sparks: 10, dots: 12, speed: 200, life: 0.6, size: 3, color2: "#FFFFFF" });
    }
    // 错误选择触发 glitch 强化压迫感
    if (result.verdict === "wrong") {
      postFX.glitch(0.5, 2.5);
      postFX.flash("#E5353B", 0.3, 2);
      postFX.shake(5, 10);
    } else if (result.bust) {
      postFX.flash("#FFD666", 0.22, 1.6);
    }
    // 暴露结果给场景层
    const ended = this.aiBattleRunner.isOver();
    this.v5Result = {
      kind: "aiBattle", bust: result.bust, verdict: result.verdict, bustScoreDelta,
      action: null, lineRedFlag: this.aiBattleRunner.getCurrentNode().redFlag ?? 0,
      correct: false, damage: 0, target: null,
      ended, ending: ended ? (this.aiBattleRunner.getEnding() ?? null) : null,
    };
    if (ended) {
      // 结束：根据 ending 判定胜负
      this.modeWin = this.aiBattleRunner.getEnding() === "busted";
      // 通关时金光闪屏 + 强震屏
      if (this.modeWin) {
        postFX.flash("#FFD666", 0.5, 1.4);
        postFX.shake(8, 8);
        this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, shockwave: true, sparks: 24, dots: 28, speed: 320, life: 1.0, size: 4, color2: "#1AD670" });
      } else {
        postFX.flash("#E5353B", 0.5, 1.4);
        postFX.glitch(0.8, 3);
        postFX.shake(10, 8);
      }
      this.gameOver();
    } else {
      this.emitHud();
    }
  }

  /** 骗局拆解：推进到下一行 / 显示拆解 / 显示总结 */
  advanceDeconstruct(): void {
    if (this.state.over || !this.deconstructRunner) return;
    const res = this.deconstructRunner.advance();
    const line = this.deconstructRunner.getCurrentLine();
    const lineRedFlag = line?.redFlag ?? 0;
    if (res.action === "showLine") {
      // 新对白出现：消息提示音；若该行有高红旗，叠加警示
      playSfx("messageBeep");
      if (lineRedFlag >= 4) {
        playSfx("redFlag");
        postFX.glitch(0.35, 1.8);
        postFX.flash("#E5353B", 0.18, 1.2);
      }
    } else if (res.action === "showDeconstruct") {
      playSfx("good");
      // 拆解揭示：金色闪光 + 弱震屏
      postFX.flash("#FFD666", 0.2, 1.0);
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, sparks: 8, dots: 10, speed: 160, life: 0.6, size: 3 });
    } else if (res.action === "showSummary") {
      // 总结：金光闪屏 + 强震屏
      playSfx("achievement");
      postFX.flash("#1AD670", 0.35, 1.4);
      postFX.shake(6, 8);
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#1AD670", { ring: true, shockwave: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4, color2: "#FFD666" });
    }
    const ended = res.action === "ended" || this.deconstructRunner.isOver();
    this.v5Result = {
      kind: "deconstruct", bust: false, verdict: "", bustScoreDelta: 0,
      action: res.action, lineRedFlag,
      correct: false, damage: 0, target: null,
      ended, ending: ended ? "busted" : null,
    };
    if (ended) {
      // 拆解完成视为通关（教育模式）
      this.modeWin = true;
      this.gameOver();
    } else {
      this.emitHud();
    }
  }

  /** 骗局拆解：跳过到结尾 */
  skipDeconstructToEnd(): void {
    if (this.state.over || !this.deconstructRunner) return;
    this.deconstructRunner.skipToEnd();
    this.v5Result = {
      kind: "deconstruct", bust: false, verdict: "", bustScoreDelta: 0,
      action: "ended", lineRedFlag: 0,
      correct: false, damage: 0, target: null,
      ended: true, ending: "busted",
    };
    this.modeWin = true;
    this.gameOver();
  }

  // ===== v6 升级：反诈侦探模式输入入口（由场景调用，委托给 Runner） =====

  /** v6 模式操作结果：供场景层触发屏幕级 FX */
  v6Result: {
    kind: "detective" | null;
    /** 本次动作类型 */
    action: "enterEvidence" | "selectEvidence" | "closeEvidence" | "enterReasoning" | "answer" | "nextQuestion" | "enterSummary" | "archive" | "timeoutToReasoning" | null;
    /** 本次答题是否正确 */
    correct: boolean;
    /** 是否触发破局点发现 */
    breakingPointFound: boolean;
    /** 是否答错锁定 */
    locked: boolean;
    /** 是否所有问题答完 */
    allAnswered: boolean;
    /** 是否触发结局 */
    ended: boolean;
    /** 结局说明 */
    endingDesc: string;
  } = { kind: null, action: null, correct: false, breakingPointFound: false, locked: false, allAnswered: false, ended: false, endingDesc: "" };

  /** 侦探：进入证据浏览阶段（从简报调用） */
  enterEvidenceStage(): void {
    if (this.state.over || !this.detectiveRunner) return;
    this.detectiveRunner.enterEvidenceStage();
    playSfx("messageBeep");
    this.v6Result = {
      kind: "detective", action: "enterEvidence", correct: false,
      breakingPointFound: false, locked: false, allAnswered: false,
      ended: false, endingDesc: "",
    };
    this.emitHud();
  }

  /** 侦探：选择证据查看 */
  selectDetectiveEvidence(evidenceId: string): void {
    if (this.state.over || !this.detectiveRunner) return;
    this.detectiveRunner.selectEvidence(evidenceId);
    playSfx("messageBeep");
    this.v6Result = {
      kind: "detective", action: "selectEvidence", correct: false,
      breakingPointFound: this.detectiveRunner.getBreakingPointFound(),
      locked: false, allAnswered: false, ended: false, endingDesc: "",
    };
    this.emitHud();
  }

  /** 侦探：关闭当前证据查看 */
  closeDetectiveEvidence(): void {
    if (this.state.over || !this.detectiveRunner) return;
    this.detectiveRunner.closeEvidence();
    this.v6Result = {
      kind: "detective", action: "closeEvidence", correct: false,
      breakingPointFound: this.detectiveRunner.getBreakingPointFound(),
      locked: false, allAnswered: false, ended: false, endingDesc: "",
    };
    this.emitHud();
  }

  /** 侦探：进入推理问答阶段（从证据浏览调用） */
  enterReasoningStage(): void {
    if (this.state.over || !this.detectiveRunner) return;
    this.detectiveRunner.enterReasoningStage();
    playSfx("good");
    postFX.flash("#FFD666", 0.22, 1.0);
    this.v6Result = {
      kind: "detective", action: "enterReasoning", correct: false,
      breakingPointFound: this.detectiveRunner.getBreakingPointFound(),
      locked: false, allAnswered: false, ended: false, endingDesc: "",
    };
    this.emitHud();
  }

  /** 侦探：回答当前推理问题 */
  answerDetectiveQuestion(playerAnswer: number | number[]): void {
    if (this.state.over || !this.detectiveRunner) return;
    const result = this.detectiveRunner.answerQuestion(playerAnswer);
    // 音效与 FX 反馈
    if (result.correct) {
      playSfx("good");
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, sparks: 8, dots: 10, speed: 160, life: 0.6, size: 3 });
      if (result.breakingPointFound) {
        // 破局点发现：额外金光闪屏
        playSfx("achievement");
        postFX.flash("#FFD666", 0.35, 1.4);
        postFX.shake(6, 8);
        this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, shockwave: true, sparks: 20, dots: 24, speed: 280, life: 0.9, size: 4, color2: "#1AD670" });
      }
    } else {
      playSfx("bad");
      postFX.glitch(0.4, 2);
      postFX.flash("#E5353B", 0.25, 1.4);
      postFX.shake(6, 10);
    }
    const ended = result.allAnswered;
    this.v6Result = {
      kind: "detective", action: "answer", correct: result.correct,
      breakingPointFound: result.breakingPointFound, locked: result.locked,
      allAnswered: result.allAnswered, ended,
      endingDesc: ended ? this.detectiveRunner.getEndingDesc() : "",
    };
    if (ended) {
      // 所有问题答完 → 自动进入复盘
      this.detectiveRunner.enterSummaryStage();
      this.modeWin = this.detectiveRunner.isCaseSolved();
      if (this.modeWin) {
        postFX.flash("#FFD666", 0.5, 1.4);
        postFX.shake(8, 8);
        this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, shockwave: true, sparks: 24, dots: 28, speed: 320, life: 1.0, size: 4, color2: "#1AD670" });
      } else {
        postFX.flash("#E5353B", 0.5, 1.4);
        postFX.glitch(0.8, 3);
        postFX.shake(10, 8);
      }
      this.gameOver();
    } else {
      this.emitHud();
    }
  }

  /** 侦探：进入下一题（答对后或主动跳过） */
  nextDetectiveQuestion(): void {
    if (this.state.over || !this.detectiveRunner) return;
    const hasMore = this.detectiveRunner.nextQuestion();
    this.v6Result = {
      kind: "detective", action: "nextQuestion", correct: false,
      breakingPointFound: this.detectiveRunner.getBreakingPointFound(),
      locked: false, allAnswered: !hasMore,
      ended: !hasMore ? this.detectiveRunner.isOver() : false,
      endingDesc: !hasMore ? this.detectiveRunner.getEndingDesc() : "",
    };
    if (!hasMore) {
      // 所有问题答完 → 进入复盘（由 enterSummaryStage 内部处理）
      this.modeWin = this.detectiveRunner.isCaseSolved();
      this.gameOver();
    } else {
      playSfx("messageBeep");
      this.emitHud();
    }
  }

  /** 侦探：归档案件（从复盘调用，标记结案） */
  archiveDetectiveCase(): void {
    if (this.state.over || !this.detectiveRunner) return;
    this.detectiveRunner.archiveCase();
    playSfx("achievement");
    this.v6Result = {
      kind: "detective", action: "archive", correct: false,
      breakingPointFound: this.detectiveRunner.getBreakingPointFound(),
      locked: false, allAnswered: true, ended: true,
      endingDesc: this.detectiveRunner.getEndingDesc(),
    };
    this.emitHud();
  }

  /** 侦探：获取 Runner（供场景层查询案件详情、当前问题等） */
  getDetectiveRunner(): DetectiveRunner | null { return this.detectiveRunner; }

  /** 双人对战：当前回合玩家选择第 idx 个选项 */
  answerVersus(idx: number): void {
    if (this.state.over || !this.versusRunner) return;
    const result = this.versusRunner.answer(idx);
    if (result.correct) {
      playSfx("versusHit");
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#1AD670", { ring: true, sparks: 10, dots: 12, speed: 220, life: 0.6, size: 3 });
      postFX.shake(4, 8);
    } else {
      playSfx("bad");
      postFX.glitch(0.4, 2);
      postFX.flash("#E5353B", 0.25, 1.4);
      postFX.shake(6, 10);
    }
    const ended = this.versusRunner.isOver();
    this.v5Result = {
      kind: "versus", bust: false, verdict: "", bustScoreDelta: 0,
      action: null, lineRedFlag: 0,
      correct: result.correct, damage: result.damage, target: result.target,
      ended, ending: ended ? (this.versusRunner.getWinner() ?? "draw") : null,
    };
    if (ended) {
      // 完成即通关（双人模式以完成计，胜者在 stats 中）
      this.modeWin = true;
      postFX.flash("#FFD666", 0.45, 1.4);
      postFX.shake(8, 8);
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, shockwave: true, sparks: 24, dots: 28, speed: 320, life: 1.0, size: 4, color2: "#1AD670" });
      this.gameOver();
    } else {
      this.emitHud();
    }
  }

  /** 获取当前模式 */
  getMode(): FBGameMode { return this.mode; }

  /** 是否为模式胜利（speedrun/story/daily/review 通关） */
  isModeWin(): boolean { return this.modeWin; }

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
    // ===== v2: 分支题走独立流程（B3） =====
    if (kind === "branch") {
      this.chooseBranch(idx);
      return;
    }
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

  // ===== v2 升级：分支题选择（B3） =====
  /** 分支题：选择第 choiceIdx 个回复 */
  chooseBranch(choiceIdx: number): void {
    if (this.state.over || !this.current || !this.branchState || this.branchState.ended) return;
    const c = this.current;
    const steps = c.q.branchSteps ?? [];
    const curStep = steps.find((s) => s.id === this.branchState!.stepId);
    if (!curStep || choiceIdx < 0 || choiceIdx >= curStep.choices.length) return;
    const choice = curStep.choices[choiceIdx];
    // 记录历史
    this.branchState.history.push({ stepId: curStep.id, choiceText: choice.text });
    playSfx("tick");
    // 心理手法统计
    if (choice.psychology) {
      for (const p of choice.psychology) {
        const k = p as string;
        const cur = this.stats.psychologyStats[k] ?? { correct: 0, total: 0 };
        cur.total += 1;
        if (choice.safe) cur.correct += 1;
        this.stats.psychologyStats[k] = cur;
      }
    }
    if (choice.nextStep == null) {
      // 到达结局
      this.branchState.ended = true;
      this.branchState.ending = choice.ending ?? "warning";
      this.branchState.endingDesc = choice.endingDesc;
      // 判定对错：safe 结局=对，scammed=错，warning=半对
      if (choice.ending === "safe") {
        c.correct = true;
        this.onBranchComplete(true);
      } else if (choice.ending === "scammed") {
        c.correct = false;
        this.onBranchComplete(false);
      } else {
        // warning：算对但不加分
        c.correct = true;
        this.onBranchComplete(true, false);
      }
    } else {
      // 进入下一步
      this.branchState.stepId = choice.nextStep;
    }
    this.emitHud();
  }

  /** 分支题完成处理 */
  private onBranchComplete(correct: boolean, addScore = true): void {
    const c = this.current!;
    this.stats.branchCompleted = (this.stats.branchCompleted ?? 0) + 1;
    if (correct) {
      this.state.combo += 1;
      this.state.busted += 1;
      if (addScore) {
        const base = 100 + c.q.difficulty * 50;
        const comboBonus = Math.min(this.state.combo * 10, 200);
        this.state.score += base + comboBonus;
      }
      playSfx("good");
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#1AD670", { sparks: 12, dots: 14, speed: 180, life: 0.8, size: 3 });
    } else {
      this.state.combo = 0;
      this.state.stamina -= 1;
      playSfx("bad");
      postFX.shake(6, 10);
      this.recordWrong(c, "wrong");
      if (this.state.stamina <= 0) {
        this.gameOver();
        return;
      }
    }
    // 分支题完成后进入 reveal 然后下一题
    c.state = "reveal";
    c.flipProgress = 1;
    this.revealUntil = this.t + 2.0;
  }

  // ===== v2 升级：AI 语音题播放控制（A2） =====
  /** 切换音频播放 */
  toggleAudio(): void {
    if (this.state.over || !this.current) return;
    const c = this.current;
    if (c.q.cardType !== "audio" || !c.q.audioClip) return;
    if (this.audioState.finished) return;
    this.audioState.playing = !this.audioState.playing;
    playSfx("tick");
    // v3 升级：接入 Web Speech API 真实语音合成
    if (this.audioState.playing) {
      this.speakTTS(c.q.audioClip.transcript, c.q.audioClip.duration);
    } else {
      this.cancelTTS();
    }
    this.emitHud();
  }

  /** v3 升级：Web Speech API 语音合成（浏览器原生 TTS） */
  private speakTTS(text: string, duration: number): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "zh-CN";
      utter.rate = 0.95;
      utter.pitch = 1.0;
      utter.volume = 1.0;
      // 按 duration 调整速率（避免过长/过短）
      // Web Speech API 无精确时长控制，rate 已足够接近
      void duration;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("[fb:tts] speak failed", e);
    }
  }

  /** v3 升级：取消 TTS 播放 */
  private cancelTTS(): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.warn("[fb:tts] cancel failed", e);
    }
  }

  /** 构建分支题 HUD 状态（B3） */
  private buildBranchHud(c: Card): FBHudBranchState | null {
    if (!this.branchState || !c.q.branchSteps) return null;
    const curStep = c.q.branchSteps.find((s) => s.id === this.branchState!.stepId);
    if (!curStep) return null;
    return {
      currentStepId: curStep.id,
      currentTitle: curStep.title,
      currentScene: curStep.scene,
      choices: curStep.choices,
      history: this.branchState.history,
      ended: this.branchState.ended,
      ending: this.branchState.ending,
      endingDesc: this.branchState.endingDesc,
    };
  }

  /** 构建 AI 语音题 HUD 状态（A2） */
  private buildAudioHud(c: Card): FBHudAudioState | null {
    if (!c.q.audioClip) return null;
    return {
      playing: this.audioState.playing,
      progress: this.audioState.progress,
      finished: this.audioState.finished,
      transcript: c.q.audioClip.transcript,
      isSynthetic: c.q.audioClip.isSynthetic,
      synthTech: c.q.audioClip.synthTech,
    };
  }

  /** 统一提交按钮入口：单选/判断用 pendingIdx，多选用 multiSelected，填空/连线/排序用各自状态 */
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
    } else if (kind === "fill") {
      if (!c.fillInput || c.fillInput.trim().length === 0) {
        playSfx("bad");
        return;
      }
      this.revealCard(-2);
    } else if (kind === "link") {
      // 所有左列项都必须配对
      if (c.linkSel.length === 0 || c.linkSel.some((s) => s === -1)) {
        playSfx("bad");
        return;
      }
      this.revealCard(-3);
    } else if (kind === "sort") {
      if (c.sortArr.length === 0) {
        playSfx("bad");
        return;
      }
      this.revealCard(-4);
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

  // ===== 滑动手势接口（判断题专用：左滑=举报, 右滑=通过） =====

  /**
   * 开始滑动：记录起始位置
   * @param cardIdx 0=主卡/左卡, 1=右卡（双卡模式）
   */
  swipeStart(cardIdx: number): void {
    if (this.state.over) return;
    const c = cardIdx === 0 ? this.current : this.dualCards[1];
    if (!c || c.state !== "show") return;
    const kind = c.q.kind ?? "single";
    if (kind !== "judge") return;
    this.swipingCardIdx = cardIdx;
    this.emitHud();
  }

  /**
   * 滑动中更新偏移比：驱动卡片视觉跟随手指
   * @param offsetRatio -1..1（负=左滑, 正=右滑）
   */
  swipeMove(offsetRatio: number): void {
    if (this.swipingCardIdx === null) return;
    const c = this.swipingCardIdx === 0 ? this.current : this.dualCards[1];
    if (!c) return;
    c.swipeOffset = Math.max(-1, Math.min(1, offsetRatio));
    this.emitHud();
  }

  /**
   * 滑动释放：达到阈值则提交判定，否则回弹
   * 阈值：|offset| >= 0.35
   */
  swipeEnd(): void {
    if (this.swipingCardIdx === null) return;
    const cardIdx = this.swipingCardIdx;
    const c = cardIdx === 0 ? this.current : this.dualCards[1];
    this.swipingCardIdx = null;
    if (!c || c.state !== "show") return;
    const offset = c.swipeOffset;
    const threshold = 0.35;
    if (Math.abs(offset) < threshold) {
      // 未达阈值：回弹归零
      c.swipeOffset = 0;
      this.emitHud();
      return;
    }
    // 达到阈值：判定方向
    // 左滑 = 举报 = 选项 0（"正确：是诈骗"）
    // 右滑 = 通过 = 选项 1（"错误：非诈骗"）
    const dir: FBSwipeDir = offset < 0 ? "left" : "right";
    const answerIdx = dir === "left" ? 0 : 1;
    c.swipeOffset = 0; // 提交后归零，进入翻转
    if (cardIdx === 0) {
      this.answer(answerIdx);
    } else {
      // 双卡模式第二张卡：直接判定
      this.answerDualCard(1, answerIdx);
    }
  }

  /** 取消滑动（手指离开卡片区域或被中断） */
  swipeCancel(): void {
    if (this.swipingCardIdx === null) return;
    const c = this.swipingCardIdx === 0 ? this.current : this.dualCards[1];
    this.swipingCardIdx = null;
    if (c) c.swipeOffset = 0;
    this.emitHud();
  }

  // ===== 双重诈骗同屏双卡接口 =====

  /**
   * 双卡模式下回答第二张卡（索引 1）
   * 答案判定与主卡一致，但两张卡均答对才得分翻倍
   */
  private answerDualCard(idx: number, answerIdx: number): void {
    if (!this.dualMode || idx >= this.dualCards.length) return;
    const c = this.dualCards[idx];
    if (!c || c.state !== "show") return;
    c.pendingIdx = answerIdx;
    this.revealDualCard(idx, answerIdx);
  }

  /** 双卡模式揭示某张卡：判定 + 翻转，双卡均完成后统一结算 */
  private revealDualCard(idx: number, answerIdx: number): void {
    const c = this.dualCards[idx];
    if (!c) return;
    c.selectedIdx = answerIdx;
    c.state = "reveal";
    c.flipProgress = 0;
    const correct = answerIdx === (c.q.answer ?? -1);
    c.correct = correct;
    const riskList = c.q.risk ?? [];
    c.riskTriggered = riskList.includes(answerIdx);
    // 记录结果
    this.dualResults[idx] = correct ? "correct" : "wrong";
    // 统计
    this.stats.totalAnswered += 1;
    const typeId = c.q.typeId;
    const prev = this.stats.byType[typeId] ?? { correct: 0, total: 0 };
    prev.total += 1;
    if (correct) prev.correct += 1;
    this.stats.byType[typeId] = prev;
    if (correct) this.stats.correctCount += 1;
    else {
      this.stats.wrongCount += 1;
      this.recordWrong(c, "wrong");
    }
    // 视觉反馈
    if (correct) {
      this.particles.spawnBurst(idx === 0 ? CARD_CX : CARD_CX + 400, CARD_CY, ACCENT, { ring: true, sparks: 12, dots: 14, speed: 220, life: 0.7, size: 3, color2: "#FFD666" });
      playSfx("good");
    } else {
      this.particles.spawnBurst(idx === 0 ? CARD_CX : CARD_CX + 400, CARD_CY, "#E5353B", { ring: true, sparks: 14, dots: 16, speed: 260, life: 0.7, size: 3, color2: "#FFB020" });
      postFX.glitch(0.3, 2);
      playSfx("bad");
    }
    // 检查双卡是否均已作答
    if (this.dualResults[0] !== null && this.dualResults[1] !== null) {
      this.settleDualCards();
    }
    this.emitHud();
  }

  /** 双卡模式结算：双对得分翻倍，任一错则扣分扣血 */
  private settleDualCards(): void {
    const bothCorrect = this.dualResults[0] === "correct" && this.dualResults[1] === "correct";
    const baseScore = 200 + this.state.wave * 15;
    if (bothCorrect) {
      const gain = baseScore * 2; // 双倍奖励
      this.state.score += gain;
      this.state.busted += 2;
      this.state.combo += 1;
      this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.state.combo);
      this.stats.dualCleared += 1;
      this.particles.spawnText(CARD_CX + 200, CARD_CY - 60, `双卡全中！+${gain}`, "#FFD666", { size: 18, life: 1.4 });
      this.particles.spawnBurst(CARD_CX + 200, CARD_CY, "#FFD666", { ring: true, sparks: 24, dots: 28, speed: 320, life: 1.0, size: 4, color2: ACCENT, shockwave: true });
      postFX.flash("#FFD666", 0.4, 3);
      postFX.shake(6, 12);
      this.toast = { text: `⚡ 双重诈骗全中！+${gain} · 双倍奖励`, tone: "good", until: this.t + 2.6 };
    } else {
      // 任一错：扣血扣分
      this.state.combo = 0;
      this.state.stamina -= 1;
      this.manHurtUntil = this.t + 0.6;
      const prevScore = this.state.score;
      this.state.score = Math.max(0, this.state.score - 60);
      const lostScore = prevScore - this.state.score;
      this.shakeUntil = this.t + 0.35;
      this.taunt = { text: SCAMMER_MOCKS[Math.floor(Math.random() * SCAMMER_MOCKS.length)], until: this.t + 2.4 };
      this.crack = { until: this.t + 1.2, seed: Math.floor(Math.random() * 9999) };
      this.particles.spawnText(CARD_CX + 200, CARD_CY - 40, `-${lostScore}`, "#E5353B", { size: 18, life: 1.0 });
      this.toast = { text: `双重诈骗失败！扣 ${lostScore} 分。${this.dualCards[0]?.q.explain ?? ""}`, tone: "bad", until: this.t + 2.8 };
      postFX.flash("#E5353B", 0.4, 2);
      postFX.glitch(0.4, 3);
      postFX.shake(7, 14);
    }
    // 安排双卡退出
    setTimeout(() => {
      this.dualCards = [];
      this.dualMode = false;
      this.dualResults = [null, null];
      this.current = null;
      this.nextSpawnAt = this.t + 0.5;
      this.emitHud();
    }, 1100);
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
    // v3 升级：硬核模式禁用所有道具
    if (this.hardcoreMode) {
      playSfx("bad");
      this.toast = { text: "💀 硬核模式：道具已封印！", tone: "bad", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    // Boss lockItem 技能封印道具
    if (this.itemLocked && type !== "undo") {
      playSfx("bad");
      this.toast = { text: "🔒 道具被 Boss 封印！本题无法使用道具", tone: "bad", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    // itemLock 特殊事件：本波次禁用所有道具（undo 例外）
    if (this.itemLockActive && type !== "undo") {
      playSfx("bad");
      this.toast = { text: "🚫 道具禁用波次！纯靠判断", tone: "bad", until: this.t + 1.6 };
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
      // 50-50 需有题在展示，且仅 single/judge/crisis（evidence 题答案在 evidenceAnswer，不支持）
      if (!this.current || this.current.state !== "show") { playSfx("bad"); return; }
      const kind = this.current.q.kind ?? "single";
      if (kind === "multi" || kind === "evidence") { playSfx("bad"); return; }
      const correct = this.current.q.answer ?? -1;
      const wrongs = this.current.q.options.map((_, i) => i).filter((i) => i !== correct);
      if (wrongs.length < 2) { playSfx("bad"); return; }
      // B4: 根据升级等级移除错误选项
      const lv = this.itemLevels.fifty ?? 1;
      const def = getItemUpgradeDef("fifty", lv);
      const removeCount = def?.params.remove ?? 2;
      const shuffled = wrongs.sort(() => Math.random() - 0.5);
      this.current.fiftyRemoved = removeCount >= 99 ? shuffled : shuffled.slice(0, Math.min(removeCount, wrongs.length));
      this.items.fifty -= 1;
      this.stats.itemsUsed += 1;
      playSfx("good");
      const label = lv >= 3 ? "必中" : lv >= 2 ? "75-25" : "50-50";
      this.toast = { text: `🧰 ${label} 已移除 ${this.current.fiftyRemoved.length} 个错误选项`, tone: "info", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    if (type === "freeze") {
      if (!this.current || this.current.state !== "show") { playSfx("bad"); return; }
      if (this.freezeRemaining > 0) { playSfx("bad"); return; }
      // B4: 根据升级等级决定冻结时长
      const lv = this.itemLevels.freeze ?? 1;
      const def = getItemUpgradeDef("freeze", lv);
      const freezeSec = def?.params.duration ?? 5;
      this.freezeRemaining = freezeSec;
      this.items.freeze -= 1;
      this.stats.itemsUsed += 1;
      playSfx("good");
      postFX.flash("#00E5FF", 0.25, 2);
      const label = lv >= 3 ? "绝对零度" : lv >= 2 ? "寒冰屏障" : "冰霜新星";
      this.toast = { text: `❄ ${label} 时间冻结 ${freezeSec} 秒`, tone: "info", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    if (type === "double") {
      if (!this.current || this.current.state !== "show") { playSfx("bad"); return; }
      if (this.doubleRemaining > 0) { playSfx("bad"); return; }
      // B4: 根据升级等级决定倍数与题数
      const lv = this.itemLevels.double ?? 1;
      const def = getItemUpgradeDef("double", lv);
      const count = def?.params.count ?? 1;
      this.doubleRemaining = count;
      this.items.double -= 1;
      this.stats.itemsUsed += 1;
      playSfx("good");
      postFX.flash("#FFD666", 0.25, 2);
      const mult = def?.params.mult ?? 2;
      const label = lv >= 3 ? "五倍连击" : lv >= 2 ? "三倍分" : "双倍分";
      this.toast = { text: `✨ ${label} 已激活（下 ${count} 题 ×${mult}）`, tone: "info", until: this.t + 1.6 };
      this.emitHud();
      return;
    }
    if (type === "hint") {
      // 提示：高亮正确倾向的选项（不移除，仅视觉标记）
      if (!this.current || this.current.state !== "show") { playSfx("bad"); return; }
      const kind = this.current.q.kind ?? "single";
      if (kind === "multi" || kind === "evidence") { playSfx("bad"); return; }
      if (this.current.hintHighlighted.length > 0) { playSfx("bad"); return; }
      const correct = this.current.q.answer ?? -1;
      // B4: 根据升级等级决定高亮行为
      const lv = this.itemLevels.hint ?? 1;
      const def = getItemUpgradeDef("hint", lv);
      if (def?.params.reveal) {
        // 满级：直接显示正确选项
        this.current.fiftyRemoved = this.current.q.options.map((_, i) => i).filter((i) => i !== correct);
        this.current.hintHighlighted = [correct];
        this.toast = { text: "💡 全知：已直接显示正确选项", tone: "info", until: this.t + 1.6 };
      } else {
        const hintCount = def?.params.count ?? 1;
        this.current.hintHighlighted = [correct];
        if (hintCount >= 2) {
          // 洞察：额外高亮一个排除项（帮助 narrowing）
          const wrongs = this.current.q.options.map((_, i) => i).filter((i) => i !== correct && !this.current!.fiftyRemoved.includes(i));
          if (wrongs.length > 0) this.current.hintHighlighted.push(wrongs[0]);
        }
        const label = lv >= 2 ? "洞察" : "提示";
        this.toast = { text: `💡 ${label}：已高亮正确倾向选项`, tone: "info", until: this.t + 1.6 };
      }
      this.items.hint -= 1;
      this.stats.itemsUsed += 1;
      playSfx("good");
      postFX.flash("#B388FF", 0.2, 2);
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

  /** 揭示答题结果（单选 idx 直接传入；多选 idx=-1；填空 idx=-2；连线 idx=-3；排序 idx=-4） */
  private revealCard(idx: number): void {
    const c = this.current;
    if (!c) return;
    const kind = c.q.kind ?? "single";
    c.selectedIdx = (kind === "multi" || kind === "fill" || kind === "link" || kind === "sort") ? -1 : idx;
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
    } else if (kind === "fill") {
      // 填空题：忽略大小写和首尾空格，匹配 fillAnswer 或 fillAccept 列表
      const ans = c.fillInput.trim().toLowerCase();
      const accept = [c.q.fillAnswer, ...(c.q.fillAccept ?? [])]
        .filter((s): s is string => !!s)
        .map((s) => s.trim().toLowerCase());
      c.correct = accept.includes(ans);
      c.riskTriggered = false;
    } else if (kind === "link") {
      // 连线题：linkPairing[i] = 右列原始下标对应左列第 i 项
      const pairing = c.q.linkPairing ?? [];
      c.correct = pairing.length === c.linkSel.length &&
        pairing.every((orig, i) => c.linkSel[i] === orig);
      c.riskTriggered = false;
    } else if (kind === "sort") {
      // 排序题：玩家排列与正确顺序完全一致
      const correct = c.q.sortCorrect ?? [];
      c.correct = correct.length === c.sortArr.length &&
        correct.every((v, i) => c.sortArr[i] === v);
      c.riskTriggered = false;
    } else if (kind === "evidence") {
      // v4: 证据判断题：玩家选中的消息索引与 evidenceAnswer 比对
      c.correct = idx === (c.q.evidenceAnswer ?? -1);
      c.riskTriggered = false;
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
    // ===== v3 升级：模式专属答题计数（非跳过道具） =====
    if (!c.skippedViaItem) {
      if (this.mode === "speedrun") {
        this.speedrunAnswered += 1;
        if (c.correct) this.speedrunCorrect += 1;
        // 极速模式：答完 30 题即胜利
        if (this.speedrunAnswered >= this.speedrunTotal) {
          this.triggerModeWin();
          return;
        }
      } else if (this.mode === "daily") {
        this.dailyAnswered += 1;
        if (this.dailyAnswered >= DAILY_CONFIG.totalQuestions) {
          this.triggerModeWin();
          return;
        }
      } else if (this.mode === "story") {
        this.storyStageAnswered += 1;
        if (c.correct) this.storyStageCorrect += 1;
      } else if (this.mode === "review") {
        this.reviewNightmareAnswered += 1;
        if (c.correct) this.reviewNightmareCleared += 1;
        if (this.reviewNightmareAnswered >= REVIEW_NIGHTMARE_CONFIG.totalQuestions) {
          this.triggerModeWin();
          return;
        }
      }
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
      // 大招能量增长（答对+12，combo≥5 额外+3）
      if (!c.skippedViaItem) {
        const energyGain = 12 + (this.state.combo >= 5 ? 3 : 0);
        this.ultimateEnergy = Math.min(100, this.ultimateEnergy + energyGain);
        if (this.ultimateEnergy >= 100 && !this.ultimateReady) {
          this.ultimateReady = true;
          playSfx("ultimate");
          postFX.flash("#FFD666", 0.4, 3);
          this.particles.spawnText(CARD_CX, CARD_CY - 90, "⚡ 必杀技就绪！", "#FFD666", { size: 18, life: 1.4 });
        }
        // 连击色阶升级提示
        const newTier = this.comboTierLevel(this.state.combo);
        const prevTier = this.comboTierLevel(this.state.combo - 1);
        if (newTier > prevTier && this.state.combo > 1) {
          playSfx("comboTier");
        }
      }
      // 心理手法统计（答对）
      this.trackPsychology(c.q, true);
    } else {
      this.state.combo = 0;
      if (!c.skippedViaItem) this.stats.wrongCount += 1;
      // 大招能量衰减（答错-20，不低于0）
      this.ultimateEnergy = Math.max(0, this.ultimateEnergy - 20);
      this.ultimateReady = false;
      // 错题记录（非跳过道具，最多保留 20 条）
      if (!c.skippedViaItem) {
        this.recordWrong(c, "wrong");
        playSfx("wrongRecord");
      }
      // 心理手法统计（答错）
      this.trackPsychology(c.q, false);
      // v3 升级：模式专属体力处理
      // - endless/hardcore：扣体力（hardcore 1 点体力即终局）
      // - story/daily/review/speedrun：不扣体力，答错仅扣分，队列耗尽才结束
      const penalty = c.riskTriggered ? 2 : 1;
      if (this.mode === "endless" || this.mode === "hardcore") {
        this.state.stamina -= penalty;
        this.manHurtUntil = this.t + 0.6;
      }
      // 错答掉段机制：错答扣分（风险 -100，普通 -50），分数不低于 0
      const scorePenalty = c.riskTriggered ? 100 : 50;
      const prevScore = this.state.score;
      this.state.score = Math.max(0, this.state.score - scorePenalty);
      const lostScore = prevScore - this.state.score;
      if (lostScore > 0) {
        this.particles.spawnText(CARD_CX, CARD_CY - 16, `-${lostScore}`, "#E5353B", { size: 18, life: 1.0 });
      }
      const wrong = c.riskTriggered ? `⚠ 风险选项！扣除 ${penalty} 点体力，扣 ${lostScore} 分。` : `错答！扣 ${lostScore} 分，正确答案将高亮显示。`;
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
    // v3 升级：游戏结束时取消 TTS
    this.cancelTTS();
    // 同步最终 maxCombo
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.state.maxCombo);
    // ===== v2 升级：计算受害者档案 / 知识图谱 / 案例档案 =====
    // B2: 受害者档案
    this.stats.victimProfile = matchVictimProfile(
      this.stats.psychologyStats,
      this.stats.wrongCount,
      this.stats.totalAnswered,
    );
    // B1: 知识图谱
    const knowledgeStats = this.aggregateKnowledgeStats();
    const kg = buildKnowledgeGraph(knowledgeStats);
    this.stats.knowledgeGraph = kg;
    // A1: 案例档案
    this.stats.caseArchives = collectCaseArchives(this.encounteredQuestions);
    // A2: AI 语音题答对数
    this.stats.audioCorrect = this.encounteredQuestions.filter(
      (q) => q.cardType === "audio",
    ).length > 0 ? this.stats.correctCount : 0;
    // B3: 分支题完成数（已在 onBranchComplete 累加）
    // ===== v3 升级：模式统计注入 =====
    this.stats.gameMode = this.mode;
    this.stats.perfectRun = this.stats.wrongCount === 0 && this.stats.totalAnswered > 0;
    if (this.mode === "speedrun") {
      this.stats.speedrunDuration = Math.round(this.t - this.modeStartTs);
      this.stats.speedrunCorrect = this.speedrunCorrect;
      this.stats.speedrunTotal = this.speedrunTotal;
    }
    if (this.mode === "story") {
      this.stats.storyStageIdx = this.storyStageIdx ?? undefined;
      this.stats.storyStagesCleared = this.modeWin ? (this.storyStageIdx ?? 0) + 1 : (this.storyStageIdx ?? 0);
    }
    if (this.mode === "daily") {
      this.stats.dailyKey = this.dailyKeyVal;
      this.stats.dailyCorrect = this.dailyAnswered - this.stats.wrongCount;
    }
    if (this.mode === "review") {
      this.stats.reviewNightmareCleared = this.reviewNightmareCleared;
    }
    // ===== v5 升级：新模式统计注入（从 Runner 合并） =====
    if (this.mode === "aiBattle" && this.aiBattleRunner) {
      const v5s = this.aiBattleRunner.getStats();
      this.stats.aiBattleBustScore = v5s.aiBattleBustScore;
      this.stats.aiBattleTurns = v5s.aiBattleTurns;
      this.stats.aiBattleEnding = v5s.aiBattleEnding;
      this.stats.totalAnswered = v5s.totalAnswered ?? 1;
      this.stats.correctCount = v5s.correctCount ?? 0;
      this.stats.wrongCount = v5s.wrongCount ?? 0;
      // AI 对战积分：识破红旗数 × 100
      this.state.score = (v5s.aiBattleBustScore ?? 0) * 100;
      this.state.wave = this.aiBattleRunner.getTurnCount();
      this.state.busted = v5s.aiBattleBustScore ?? 0;
    }
    if (this.mode === "deconstruct" && this.deconstructRunner) {
      const v5s = this.deconstructRunner.getStats();
      this.stats.deconstructCompleted = v5s.deconstructCompleted ?? 1;
      this.stats.deconstructRedFlags = v5s.deconstructRedFlags ?? 0;
      this.stats.totalAnswered = 1;
      this.stats.correctCount = 1;
      this.stats.wrongCount = 0;
      // 拆解积分：识别红旗数 × 50
      this.state.score = (v5s.deconstructRedFlags ?? 0) * 50;
      this.state.wave = this.deconstructRunner.getTotalLines();
      this.state.busted = v5s.deconstructRedFlags ?? 0;
    }
    if (this.mode === "versus" && this.versusRunner) {
      const v5s = this.versusRunner.getStats();
      this.stats.versusWinner = v5s.versusWinner ?? null;
      this.stats.versusP1Correct = v5s.versusP1Correct ?? 0;
      this.stats.versusP2Correct = v5s.versusP2Correct ?? 0;
      this.stats.totalAnswered = v5s.totalAnswered ?? 0;
      this.stats.correctCount = v5s.correctCount ?? 0;
      this.stats.wrongCount = v5s.wrongCount ?? 0;
      // 双人对战积分：两人答对总数 × 30
      this.state.score = (v5s.correctCount ?? 0) * 30;
      this.state.wave = this.versusRunner.getCurrentQuestionIdx() + 1;
      this.state.busted = v5s.correctCount ?? 0;
    }
    // ===== v6 升级：反诈侦探模式统计注入 =====
    if (this.mode === "detective" && this.detectiveRunner) {
      const v6s = this.detectiveRunner.getStats();
      this.stats.detectiveScore = v6s.detectiveScore ?? 0;
      this.stats.detectiveSolved = v6s.detectiveSolved ?? false;
      this.stats.detectiveBreakingPoints = v6s.detectiveBreakingPoints ?? 0;
      this.stats.totalAnswered = v6s.totalAnswered ?? 0;
      this.stats.correctCount = v6s.correctCount ?? 0;
      this.stats.wrongCount = v6s.wrongCount ?? 0;
      // 侦探积分：推理得分 × 20（破案额外 +500）
      this.state.score = (v6s.detectiveScore ?? 0) * 20 + (v6s.detectiveSolved ? 500 : 0);
      this.state.wave = this.detectiveRunner.getCurrentQuestionIdx() + 1;
      this.state.busted = v6s.correctCount ?? 0;
    }
    // ===== v5 升级：智能错题画像（基于存档生成本周弱点报告） =====
    try {
      const saveForReport = loadFBSave();
      this.stats.weaknessReport = buildWeaknessReport(saveForReport);
    } catch {
      this.stats.weaknessReport = undefined;
    }
    // ===== 存档系统：局后结算（累计识破/Boss/最高分/段位/成就） =====
    const saveResult = updateFBSaveAfterRun({
      score: this.state.score,
      wave: this.state.wave,
      busted: this.state.busted,
      bossDefeated: this.stats.bossDefeated,
      byType: this.stats.byType,
      branchCompleted: this.stats.branchCompleted ?? 0,
      audioCorrect: this.stats.audioCorrect ?? 0,
      seasonalEncountered: this.encounteredQuestions.filter((q) => (q.season ?? []).some((s) => s !== "all")).length,
      bossWeekDefeated: this.bossWeekActive && this.boss?.defeated ? 1 : 0,
      bossWeekBossId: this.bossWeekBossId ?? undefined,
      clearedWrongIds: this.reviewClearedIds,
    });
    // ===== v3 升级：模式专属存档更新 =====
    this.updateModeSave(saveResult.save);
    // 成就解锁音效 + 段位晋级音效
    if (saveResult.newAchievements.length > 0) {
      playSfx("achievementUnlock");
    }
    if (saveResult.rankUp) {
      playSfx("rankUp");
    }
    this.result = {
      gameId: "fraud-buster",
      win: this.modeWin,
      score: this.state.score,
      wave: this.state.wave,
      bustedCount: this.state.busted,
      maxCombo: this.state.maxCombo,
      tipId: randomTip(this.state.wave).id,
      stats: {
        ...this.stats,
        byType: { ...this.stats.byType },
        save: saveResult.save,
        newAchievements: saveResult.newAchievements,
        rankUp: saveResult.rankUp,
      },
    };
    if (this.modeWin) {
      // 模式胜利：金光 + 升调音效
      postFX.flash("#FFD666", 0.4, 2);
      postFX.shake(6, 10);
      playSfx("good");
      this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, sparks: 20, dots: 24, speed: 300, life: 1.2, size: 5, color2: "#FFFFFF", shockwave: true });
      this.particles.spawnText(CARD_CX, CARD_CY - 40, "🎉 通关！", "#FFD666", { size: 28, life: 1.6 });
    } else {
      postFX.flash("#E5353B", 0.5, 2);
      postFX.glitch(0.8, 4);
      postFX.shake(10, 16);
      playSfx("lose");
    }
    this.emit({ type: "result", payload: this.result });
  }

  /** v3 升级：模式专属存档更新（剧情/极速/硬核/每日/错题噩梦） */
  private updateModeSave(save: import("./storage").FBSaveData): void {
    let dirty = false;
    if (this.mode === "story" && this.modeWin && this.storyStageIdx !== null) {
      // 剧情模式通关：记录已通关关卡
      if (!save.storyClearedStages.includes(this.storyStageIdx)) {
        save.storyClearedStages.push(this.storyStageIdx);
        save.storyClearedStages.sort((a, b) => a - b);
        dirty = true;
      }
      // 自动推进到下一关
      const nextIdx = this.storyStageIdx + 1;
      if (nextIdx < STORY_STAGES.length) {
        save.storyCurrentStage = nextIdx;
        dirty = true;
      } else {
        // 全部通关：重置到 null（已通关全部）
        save.storyCurrentStage = null;
        dirty = true;
      }
    }
    if (this.mode === "speedrun" && this.modeWin) {
      // 极速模式：记录最佳用时（仅完美通关 30 题后记录）
      const duration = Math.round(this.t - this.modeStartTs);
      if (save.speedrunBestTime === 0 || duration < save.speedrunBestTime) {
        save.speedrunBestTime = duration;
        save.speedrunBestCorrect = this.speedrunCorrect;
        dirty = true;
      }
    }
    if (this.mode === "hardcore") {
      // 硬核模式：记录最高连对题数
      const streak = this.state.maxCombo;
      if (streak > save.hardcoreBestStreak) {
        save.hardcoreBestStreak = streak;
        dirty = true;
      }
      // v6：硬核完美通关计数（用于"硬核完美"证书）
      if (this.modeWin && this.stats.wrongCount === 0 && this.stats.totalAnswered > 0) {
        save.hardcorePerfectCount += 1;
        dirty = true;
      }
    }
    if (this.mode === "daily") {
      // 每日挑战：记录当日正确数（保留最近 30 天）
      if (!save.dailyHistory) save.dailyHistory = {};
      save.dailyHistory[this.dailyKeyVal] = this.dailyAnswered - this.stats.wrongCount;
      // 清理超过 30 天的历史
      const keys = Object.keys(save.dailyHistory).sort();
      while (keys.length > 30) {
        const oldKey = keys.shift();
        if (oldKey) delete save.dailyHistory[oldKey];
      }
      dirty = true;
    }
    if (this.mode === "review" && this.reviewNightmareCleared > 0) {
      // 错题噩梦：累加清除题数
      save.reviewNightmareTotalCleared += this.reviewNightmareCleared;
      dirty = true;
    }
    // 完美一局：零失误通关
    if (this.modeWin && this.stats.wrongCount === 0 && this.stats.totalAnswered > 0) {
      save.perfectRunCount += 1;
      dirty = true;
    }
    // v6：拆解剧本通关追踪（玩家看完剧本即视为完成）
    if (this.mode === "deconstruct" && this.deconstructRunner) {
      const scenarioId = this.deconstructRunner.getScenario().id;
      if (!save.deconstructClearedIds.includes(scenarioId)) {
        save.deconstructClearedIds.push(scenarioId);
        dirty = true;
      }
    }
    // v6：AI 对战剧本通关追踪（仅 modeWin 即识破骗局才算通关）
    if (this.mode === "aiBattle" && this.aiBattleRunner && this.modeWin) {
      const scenarioId = this.aiBattleRunner.getScenario().id;
      if (!save.aiBattleClearedIds.includes(scenarioId)) {
        save.aiBattleClearedIds.push(scenarioId);
        dirty = true;
      }
    }
    // v6：反诈侦探案件破案追踪（仅破案即 modeWin 才算通关）
    if (this.mode === "detective" && this.detectiveRunner && this.modeWin) {
      const caseId = this.detectiveRunner.getCase().id;
      const score = this.detectiveRunner.getReasoningScore();
      if (!save.detectiveSolvedCases.includes(caseId)) {
        save.detectiveSolvedCases.push(caseId);
        save.detectiveSolvedCount += 1;
        dirty = true;
      }
      save.detectiveTotalScore += score;
      dirty = true;
    }
    if (dirty) saveFBSave(save);
    // v6：颁发新解锁的反诈证书（在存档写入之后调用，避免覆盖）
    try {
      issuePendingCertificates();
    } catch (e) {
      console.warn("[fb:certificate] issuePendingCertificates failed", e);
    }
  }

  /** v3 升级：触发模式胜利（speedrun/story/daily/review 题队列耗尽时调用） */
  private triggerModeWin(): void {
    if (this.state.over) return;
    this.modeWin = true;
    // 延迟一帧后触发 gameOver（让最后一题的 reveal 完成）
    this.revealUntil = this.t + 0.8;
    // 标记当前卡片已退出，直接进入 gameOver 流程
    if (this.current) {
      this.current.state = "out";
      this.current.exited = 1;
    }
    this.current = null;
    this.gameOver();
  }

  /** 聚合知识点统计（从 byType 与 knowledgePoints 映射） */
  private aggregateKnowledgeStats(): Array<{ point: string; correct: number; total: number }> {
    const map: Record<string, { correct: number; total: number }> = {};
    for (const q of this.encounteredQuestions) {
      const kps = q.knowledgePoints ?? [];
      if (kps.length === 0) continue;
      // 查找本题是否答对（从 byType 近似，无法精确到题——用 typeId 正确率近似）
      const stat = this.stats.byType[q.typeId] ?? { correct: 0, total: 0 };
      const rate = stat.total > 0 ? stat.correct / stat.total : 0;
      for (const kp of kps) {
        const cur = map[kp] ?? { correct: 0, total: 0 };
        cur.total += 1;
        cur.correct += rate > 0.5 ? 1 : 0;
        map[kp] = cur;
      }
    }
    return Object.entries(map).map(([point, stat]) => ({ point, ...stat }));
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

    // ===== v5 升级：新模式不使用常规卡片状态机，跳过 spawn/timer/spawn 逻辑 =====
    // 仅保留粒子/t 推进与 hit-stop，HUD 由 Runner 驱动
    if (this.mode === "aiBattle" || this.mode === "deconstruct" || this.mode === "versus") {
      // 心跳强度保持低位（避免误触发红屏脉动）
      this.heartbeat = 0;
      return;
    }

    // ===== v6 升级：反诈侦探模式 =====
    if (this.mode === "detective") {
      this.heartbeat = 0;
      // 证据浏览阶段倒计时
      if (this.detectiveRunner && this.detectiveRunner.getStage() === "evidence") {
        const prevSec = Math.ceil(this.detectiveRunner.getEvidenceRemainSec());
        const timedOut = this.detectiveRunner.tickEvidenceTimer(dt);
        const newSec = Math.ceil(this.detectiveRunner.getEvidenceRemainSec());
        // 每秒触发一次 HUD 更新（倒计时显示）
        if (newSec !== prevSec || timedOut) {
          if (timedOut) {
            // 超时自动进入推理阶段
            playSfx("good");
            postFX.flash("#FFD666", 0.22, 1.0);
            this.v6Result = {
              kind: "detective", action: "timeoutToReasoning", correct: false,
              breakingPointFound: this.detectiveRunner.getBreakingPointFound(),
              locked: false, allAnswered: false, ended: false, endingDesc: "",
            };
          }
          this.emitHud();
        }
      }
      return;
    }

    // ===== v3 升级：极速模式倒计时 =====
    if (this.mode === "speedrun" && !this.state.over) {
      this.speedrunRemain = Math.max(0, this.speedrunRemain - dt);
      if (this.speedrunRemain <= 0) {
        // 时间到：触发 gameOver（未答完 30 题即失败）
        this.gameOver();
        return;
      }
      // 每秒触发一次 HUD 更新（避免每帧触发）
      if (Math.floor(this.speedrunRemain) !== Math.floor(this.speedrunRemain + dt)) {
        this.emitHud();
      }
    }

    // 道具：时间冻结——推进 spawnTs 抵消倒计时（仅 show 态生效）
    if (this.freezeRemaining > 0) {
      if (this.current && this.current.state === "show") {
        this.current.spawnTs += dt;
      }
      this.freezeRemaining = Math.max(0, this.freezeRemaining - dt);
      if (this.freezeRemaining === 0) this.emitHud();
    }

    // ===== v2: AI 语音题播放进度推进（A2） =====
    if (this.audioState.playing && this.current?.q.audioClip) {
      const dur = this.current.q.audioClip.duration;
      this.audioState.progress = Math.min(1, this.audioState.progress + dt / dur);
      if (this.audioState.progress >= 1) {
        this.audioState.playing = false;
        this.audioState.finished = true;
        // v3 升级：TTS 播放完成，取消 Web Speech
        this.cancelTTS();
      }
      this.emitHud();
    }

    // 心跳强度：随倒计时紧迫度上升（压迫感）
    this.heartbeat = this.computeHeartbeat();
    // 高压时偶发诈骗挑衅（无嘲讽时）
    if (this.heartbeat > 0.55 && this.taunt === null && Math.random() < 0.012) {
      this.taunt = { text: SCAMMER_TAUNTS[Math.floor(Math.random() * SCAMMER_TAUNTS.length)], until: this.t + 1.8 };
    }
    if (this.taunt && this.t >= this.taunt.until) this.taunt = null;
    if (this.crack && this.t >= this.crack.until) this.crack = null;

    // 双重诈骗同屏双卡：独立处理第二张卡的状态机
    if (this.dualMode && this.dualCards.length === 2) {
      this.updateDualSecondCard(dt);
    }

    if (this.current) {
      const c = this.current;
      if (c.state === "in") {
        c.entered = Math.min(1, c.entered + dt * 4);
        if (c.entered >= 1) c.state = "show";
      } else if (c.state === "show") {
        const elapsed = this.t - c.spawnTs;
        if (elapsed >= c.duration) {
          if (this.dualMode) {
            // 双卡模式超时：直接判定为错，触发 revealDualCard
            this.dualResults[0] = "wrong";
            c.selectedIdx = null;
            c.state = "reveal";
            c.flipProgress = 0;
            c.correct = false;
            // 检查双卡是否均已作答
            if (this.dualResults[0] !== null && this.dualResults[1] !== null) {
              this.settleDualCards();
            }
            this.emitHud();
          } else if (this.boss?.active) {
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
            // v3 升级：模式专属体力处理（仅 endless/hardcore 扣体力）
            if (this.mode === "endless" || this.mode === "hardcore") {
              this.state.stamina -= 1;
              this.manHurtUntil = this.t + 0.6;
            }
            // v3 升级：模式专属答题计数（超时也算答题）
            this.stats.totalAnswered += 1;
            this.stats.wrongCount += 1;
            const typeId = c.q.typeId;
            const prev = this.stats.byType[typeId] ?? { correct: 0, total: 0 };
            prev.total += 1;
            this.stats.byType[typeId] = prev;
            if (this.mode === "speedrun") {
              this.speedrunAnswered += 1;
              if (this.speedrunAnswered >= this.speedrunTotal) {
                this.triggerModeWin();
                return;
              }
            } else if (this.mode === "daily") {
              this.dailyAnswered += 1;
              if (this.dailyAnswered >= DAILY_CONFIG.totalQuestions) {
                this.triggerModeWin();
                return;
              }
            } else if (this.mode === "story") {
              this.storyStageAnswered += 1;
            } else if (this.mode === "review") {
              this.reviewNightmareAnswered += 1;
              if (this.reviewNightmareAnswered >= REVIEW_NIGHTMARE_CONFIG.totalQuestions) {
                this.triggerModeWin();
                return;
              }
            }
            // 超时扣分 -30（轻于错答，分数不低于 0）
            const prevScore = this.state.score;
            this.state.score = Math.max(0, this.state.score - 30);
            const lostScore = prevScore - this.state.score;
            if (lostScore > 0) {
              this.particles.spawnText(CARD_CX, CARD_CY - 16, `-${lostScore}`, "#FFB020", { size: 16, life: 1.0 });
            }
            // 记录超时到错题本
            this.recordWrong(c, "timeout");
            this.toast = { text: `超时未作答！扣 ${lostScore} 分。${c.q.explain}`, tone: "bad", until: this.t + 2.6 };
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
        // 3D 翻转进度推进：reveal 阶段 0→1，约 0.5 秒完成
        if (c.flipProgress < 1) {
          c.flipProgress = Math.min(1, c.flipProgress + dt * 2.2);
        }
        if (this.t >= this.revealUntil) {
          if (this.dualMode) {
            // 双卡模式：由 settleDualCards 的 setTimeout 控制退出，这里不处理
          } else if (this.boss?.active && !this.boss.defeated) {
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
          // rapidFire 事件：连答未结束则继续下一题（不推进 wave）
          if (this.specialEvent === "rapidFire" && this.rapidFireRemaining > 0) {
            this.rapidFireRemaining -= 1;
            if (this.rapidFireRemaining > 0) {
              // 继续下一题
              this.current = null;
              this.nextSpawnAt = this.t + 0.2;
              this.emitHud();
              return;
            }
          }
          this.state.wave += 1;
          // 特殊波次结束：清除事件状态
          if (this.specialEvent) {
            this.specialEvent = null;
            this.specialEventActive = false;
            this.rapidFireRemaining = 0;
            this.itemLockActive = false;
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
    // 答案模糊衰减（Boss answerBlur 技能）
    if (this.answerBlurRemaining > 0) {
      this.answerBlurRemaining = Math.max(0, this.answerBlurRemaining - dt);
      if (this.answerBlurRemaining === 0) this.emitHud();
    }
    // 3D 卡片翻转进度推进（入场时翻转半圈）
    if (this.current && this.current.state === "in") {
      this.cardFlipProgress = Math.min(1, this.cardFlipProgress + dt * 3);
    } else if (!this.current) {
      this.cardFlipProgress = 0;
    }
  }

  /** 双卡模式：更新第二张卡（dualCards[1]）的独立状态机 */
  private updateDualSecondCard(dt: number): void {
    const c = this.dualCards[1];
    if (!c) return;
    if (c.state === "in") {
      c.entered = Math.min(1, c.entered + dt * 4);
      if (c.entered >= 1) c.state = "show";
    } else if (c.state === "show") {
      const elapsed = this.t - c.spawnTs;
      if (elapsed >= c.duration) {
        // 第二张卡超时：判定为错
        this.dualResults[1] = "wrong";
        c.selectedIdx = null;
        c.state = "reveal";
        c.flipProgress = 0;
        c.correct = false;
        if (this.dualResults[0] !== null && this.dualResults[1] !== null) {
          this.settleDualCards();
        }
        this.emitHud();
      }
    } else if (c.state === "reveal") {
      // 3D 翻转进度推进
      if (c.flipProgress < 1) {
        c.flipProgress = Math.min(1, c.flipProgress + dt * 2.2);
      }
    }
  }

  /**
   * 生成双重诈骗同屏双卡（specialEvent === "double"）
   * - 两张判断题卡片，左右排列
   * - 各自独立倒计时，支持滑动手势
   * - 双对得分翻倍，任一错扣分扣血
   */
  private spawnDualCards(): void {
    const cfg = waveConfig(this.state.wave);
    // 选取两道判断题
    const judgePool = QUESTION_BANK.filter(
      (q) => !this.usedIds.has(q.id)
        && (q.kind ?? "single") === "judge"
        && q.difficulty <= cfg.maxDifficulty
        && !q.isNormal
        && q.chainStep !== 2
    );
    const fallback = QUESTION_BANK.filter(
      (q) => (q.kind ?? "single") === "judge" && !q.isNormal && q.chainStep !== 2
    );
    const pool = judgePool.length >= 2 ? judgePool : fallback;
    const q1 = pool[Math.floor(Math.random() * pool.length)];
    let q2 = pool[Math.floor(Math.random() * pool.length)];
    // 确保两题不同
    let attempts = 0;
    while (q2.id === q1.id && attempts < 10) {
      q2 = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    }
    this.usedIds.add(q1.id);
    this.usedIds.add(q2.id);
    if (this.usedIds.size > QUESTION_BANK.length - 4) {
      this.usedIds = new Set(Array.from(this.usedIds).slice(-6));
    }
    const duration = Math.max(4, cfg.duration * this.diffDurationMult()); // 双卡时长略宽裕
    const card1: Card = {
      q: q1, spawnTs: this.t, duration, entered: 0, exited: 0,
      state: "in", selectedIdx: null, pendingIdx: null, multiSelected: [],
      correct: false, riskTriggered: false, fiftyRemoved: [], hintHighlighted: [],
      optionOrder: q1.options.map((_, i) => i), skippedViaItem: false,
      flipProgress: 0, swipeOffset: 0, dualIndex: 0,
      fillInput: "", linkSel: [], linkRightOrder: [], sortArr: [],
    };
    const card2: Card = {
      q: q2, spawnTs: this.t, duration, entered: 0, exited: 0,
      state: "in", selectedIdx: null, pendingIdx: null, multiSelected: [],
      correct: false, riskTriggered: false, fiftyRemoved: [], hintHighlighted: [],
      optionOrder: q2.options.map((_, i) => i), skippedViaItem: false,
      flipProgress: 0, swipeOffset: 0, dualIndex: 1,
      fillInput: "", linkSel: [], linkRightOrder: [], sortArr: [],
    };
    this.dualCards = [card1, card2];
    this.dualMode = true;
    this.dualResults = [null, null];
    this.current = card1; // 主卡引用，保持兼容
    // 双重诈骗登场特效
    postFX.flash("#B388FF", 0.35, 2);
    this.particles.spawnBurst(CARD_CX, CARD_CY, "#B388FF", { ring: true, sparks: 18, dots: 20, speed: 280, life: 0.9, size: 4, color2: "#FFD666", shockwave: true });
    this.particles.spawnText(CARD_CX + 200, CARD_CY - 80, "⚡ 双重诈骗 · 同屏双卡", "#B388FF", { size: 16, life: 1.4 });
    playSfx("boss");
    this.toast = { text: "⚡ 双重诈骗：同屏双卡，左滑举报 / 右滑通过，双对得分翻倍！", tone: "info", until: this.t + 3.0 };
    this.emitHud();
  }

  private spawnCard(): void {
    // v6：新题开始时重置即时小课堂状态
    this.miniLessonAvailable = false;
    this.miniLesson = null;
    // ===== v3 升级：模式驱动出题（story/daily/review/speedrun 使用 modeQueue） =====
    // 这些模式跳过 Boss/特殊波次/连锁逻辑，按队列顺序出题
    const useModeQueue = (this.mode === "story" || this.mode === "daily" || this.mode === "review" || this.mode === "speedrun")
      && this.modeQueue.length > 0;
    if (useModeQueue) {
      if (this.modeQueueIdx >= this.modeQueue.length) {
        // 队列已耗尽：判定模式胜负
        if (this.mode === "story") {
          // 剧情模式：需达到 passCorrect 才算通关
          const stage = getStoryStage(this.storyStageIdx ?? 0);
          const passCorrect = stage?.passCorrect ?? 0;
          if (this.storyStageCorrect >= passCorrect) {
            this.triggerModeWin();
          } else {
            // 未达标：失败
            this.gameOver();
          }
        } else {
          // speedrun/daily/review：队列耗尽即胜利
          this.triggerModeWin();
        }
        return;
      }
      const q = this.modeQueue[this.modeQueueIdx];
      this.modeQueueIdx += 1;
      this.usedIds.add(q.id);
      this.encounteredQuestions.push(q);
      const cfg = waveConfig(this.state.wave);
      // 模式题目时长：固定 15 秒（speedrun 10 秒），不受难度/事件影响
      const duration = this.mode === "speedrun" ? 10 : 15;
      void cfg; // 模式不使用 cfg.duration
      this.current = {
        q,
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
        optionOrder: q.options.map((_, i) => i),
        skippedViaItem: false,
        flipProgress: 0,
        swipeOffset: 0,
        fillInput: "",
        linkSel: [],
        linkRightOrder: [],
        sortArr: [],
      };
      // 重置分支题状态（B3）
      if ((q.kind ?? "single") === "branch" && q.branchSteps) {
        this.branchState = {
          stepId: q.branchSteps[0]?.id ?? "",
          history: [],
          ended: false,
        };
      }
      // 重置音频播放状态（A2）
      if (q.cardType === "audio" && q.audioClip) {
        this.audioState = { playing: false, progress: 0, finished: false };
      }
      this.emitHud();
      return;
    }
    // Boss 波次（每 20 波）：生成 Boss 卡片
    if (isBossWave(this.state.wave) && !this.boss?.active) {
      this.spawnBoss();
      return;
    }
    // 双重诈骗事件：生成同屏双卡（真同屏双卡模式）
    if (this.specialEvent === "double" && !this.dualMode && !this.current) {
      this.spawnDualCards();
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
    let duration = cfg.duration * this.diffDurationMult();
    if (this.specialEvent === "timeCompress") {
      duration = Math.max(2, duration / 2);
    }
    // rapidFire 事件：每题时长缩短 40%
    if (this.specialEvent === "rapidFire") {
      duration = Math.max(3, duration * 0.6);
      if (this.rapidFireRemaining === 0) this.rapidFireRemaining = 3;
    }
    // itemLock 事件：本波次禁用所有道具
    if (this.specialEvent === "itemLock") {
      this.itemLockActive = true;
    }
    // v4: 危机决策题使用题面自定义限时（默认 5 秒），不受难度/事件影响
    if (q.kind === "crisis" && q.crisisTimeLimit) {
      duration = q.crisisTimeLimit;
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
      flipProgress: 0,
      swipeOffset: 0,
      fillInput: "",
      linkSel: [],
      linkRightOrder: [],
      sortArr: [],
    };
    // 连线题：打乱右列顺序，初始化玩家选择为 -1
    if (finalQ.kind === "link" && finalQ.linkRight && finalQ.linkLeft) {
      this.current.linkRightOrder = finalQ.linkRight.map((_, i) => i).sort(() => Math.random() - 0.5);
      this.current.linkSel = finalQ.linkLeft.map(() => -1);
    }
    // 排序题：初始排列为打乱后的选项顺序
    if (finalQ.kind === "sort" && finalQ.sortCorrect) {
      this.current.sortArr = finalQ.sortCorrect.slice().sort(() => Math.random() - 0.5);
    }
    // ===== v2 升级初始化 =====
    // A1: 追踪遭遇题目（用于案例档案收集）
    this.encounteredQuestions.push(finalQ);
    // B3: 分支题初始化状态
    if (finalQ.kind === "branch" && finalQ.branchSteps && finalQ.branchSteps.length > 0) {
      this.branchState = {
        stepId: finalQ.branchSteps[0].id,
        history: [],
        ended: false,
      };
    } else {
      this.branchState = null;
    }
    // A2: AI 语音题重置播放状态
    if (finalQ.cardType === "audio" && finalQ.audioClip) {
      this.audioState = { playing: false, progress: 0, finished: false };
    }
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
    // v4: 危机决策题使用自定义限时
    const bossDur = (q.kind === "crisis" && q.crisisTimeLimit) ? q.crisisTimeLimit : cfg.duration * this.diffDurationMult();
    this.current = {
      q,
      spawnTs: this.t,
      duration: bossDur,
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
      flipProgress: 0,
      swipeOffset: 0,
      fillInput: "",
      linkSel: [],
      linkRightOrder: [],
      sortArr: [],
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
    c.duration = (q.kind === "crisis" && q.crisisTimeLimit) ? q.crisisTimeLimit : waveConfig(this.state.wave).duration * this.diffDurationMult();
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
    c.flipProgress = 0;
    c.swipeOffset = 0;
    c.fillInput = "";
    c.linkSel = [];
    c.linkRightOrder = [];
    c.sortArr = [];
    // 重置上一题的 Boss 技能临时状态
    this.timeStolen = false;
    this.answerBlurRemaining = 0;
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
    } else if (skill === "timeSteal") {
      // 偷取时间：本题倒计时-3s（通过推进 spawnTs 实现）
      this.timeStolen = true;
      if (this.current) {
        this.current.spawnTs += 3;
      }
      this.particles.spawnText(CARD_CX, CARD_CY - 80, "⏱ -3s", "#E5353B", { size: 16, life: 1.0 });
      this.toast = { text: "⏱ Boss 技能：偷取 3 秒时间！", tone: "bad", until: this.t + 2.0 };
    } else if (skill === "answerBlur") {
      // 选项模糊：选项文字短暂模糊（持续 2.5s）
      this.answerBlurRemaining = 2.5;
      this.toast = { text: "🌫 Boss 技能：选项文字模糊！", tone: "bad", until: this.t + 2.0 };
    }
    postFX.flash("#E5353B", 0.25, 2);
    playSfx("bossSkill");
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

  /** 连击色阶等级 0-3（用于检测色阶升级播放音效） */
  private comboTierLevel(combo: number): number {
    if (combo >= 20) return 3;
    if (combo >= 10) return 2;
    if (combo >= 5) return 1;
    return 0;
  }

  /** 心理手法遭遇统计（教育分析：识别玩家心理弱点） */
  private trackPsychology(q: FBQuestion, correct: boolean): void {
    if (!q.psychology || q.psychology.length === 0) return;
    for (const tag of q.psychology) {
      const cur = this.stats.psychologyStats[tag] ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (correct) cur.correct += 1;
      this.stats.psychologyStats[tag] = cur;
    }
    // 更新最弱心理手法（正确率最低且至少遭遇 2 次）
    let weakest: string | undefined;
    let weakestRate = 1;
    for (const [tag, s] of Object.entries(this.stats.psychologyStats)) {
      if (s.total >= 2) {
        const rate = s.correct / s.total;
        if (rate < weakestRate) {
          weakestRate = rate;
          weakest = tag;
        }
      }
    }
    this.stats.weakestPsychology = weakest;
  }

  /** 记录错题到错题本（最多保留 20 条，FIFO） */
  private recordWrong(c: Card, kind: "wrong" | "timeout" | "risk"): void {
    const finalKind = c.riskTriggered && kind === "wrong" ? "risk" : kind;
    this.stats.wrongRecords.push({
      questionId: c.q.id,
      typeId: c.q.typeId,
      type: c.q.type,
      title: c.q.title,
      body: c.q.body,
      options: c.q.options,
      playerAnswer: c.selectedIdx ?? -1,
      correctAnswer: c.q.answer ?? -1,
      explain: c.q.explain,
      cues: c.q.cues,
      psychology: c.q.psychology,
      atTs: this.t,
      kind: finalKind,
    });
    if (this.stats.wrongRecords.length > 20) {
      this.stats.wrongRecords.shift();
    }
    // v6：标记可展示即时小课堂（供场景层在揭示态画"小课堂"按钮）
    this.miniLessonAvailable = true;
  }

  /**
   * v6 教育功能 C3：展示答错即时小课堂。
   * 由场景层在揭示态点击"小课堂"按钮时调用。
   * 基于当前答错的题目生成教学卡并填充 HUD。
   */
  showMiniLesson(): void {
    if (this.state.over) return;
    if (!this.miniLessonAvailable) return;
    const c = this.current ?? this.dualCards[0] ?? this.dualCards[1];
    if (!c) return;
    this.miniLesson = buildMiniLesson(c.q);
    this.emitHud();
  }

  /**
   * v6 教育功能 C3：关闭即时小课堂。
   * 由场景层点击教学卡"关闭"按钮时调用。
   */
  closeMiniLesson(): void {
    this.miniLesson = null;
    this.emitHud();
  }

  /**
   * 释放反诈必杀技（连击大招）：满能量时由场景层按钮触发
   * - 清空当前题为正确（得分翻倍 + 额外奖励）
   * - 全屏特效：金光爆发 + 粒子环 + 屏幕震动
   * - 重置能量为 0
   */
  useUltimate(): void {
    if (this.state.over || !this.ultimateReady) {
      playSfx("bad");
      return;
    }
    if (!this.current || this.current.state !== "show") {
      playSfx("bad");
      return;
    }
    const c = this.current;
    // 重置能量
    this.ultimateEnergy = 0;
    this.ultimateReady = false;
    this.stats.ultimateUsed += 1;
    // 判定为正确并触发揭示
    c.selectedIdx = c.q.answer ?? 0;
    c.correct = true;
    c.riskTriggered = false;
    c.skippedViaItem = true; // 标记为道具判定，避免重复统计
    c.state = "reveal";
    c.flipProgress = 0;
    this.revealUntil = this.t + 1.4;
    // 大招得分：基础 200 + 波次加成 + 连击加成
    const base = 200 + this.state.wave * 20 + this.state.combo * 15;
    this.state.score += base;
    this.state.combo += 1;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    this.state.busted += 1;
    // Boss 模式：大招额外扣 Boss 1 血
    if (this.boss?.active) {
      this.boss.hp = Math.max(0, this.boss.hp - 1);
    }
    // 全屏特效
    postFX.flash("#FFD666", 0.6, 4);
    postFX.shake(10, 18);
    postFX.glitch(0.3, 2);
    this.particles.spawnBurst(CARD_CX, CARD_CY, "#FFD666", { ring: true, sparks: 30, dots: 40, speed: 400, life: 1.2, size: 6, color2: "#FFFFFF" });
    this.particles.spawnText(CARD_CX, CARD_CY - 60, `⚡ 必杀技！+${base}`, "#FFD666", { size: 24, life: 1.6 });
    this.particles.spawnText(CARD_CX, CARD_CY - 30, "反诈必杀·一击识破！", "#FFFFFF", { size: 14, life: 1.4 });
    playSfx("ultimate");
    this.hitStopRemain = 0.1;
    this.cardPulse = 1;
    this.toast = { text: `⚡ 反诈必杀技释放！+${base} 分 · ${c.q.explain}`, tone: "good", until: this.t + 3.0 };
    this.emitHud();
  }

  /** 设置难度模式（开始界面调用，影响倒计时长度） */
  setDifficulty(d: FBDifficulty): void {
    this.difficulty = d;
  }

  // ===== v2 升级：Boss 周挑战模式（A6） =====
  /** 启动 Boss 周挑战：本周固定一个高难 Boss */
  startBossWeek(): void {
    const weekKey = currentBossWeekKey();
    const boss = pickBossWeek(weekKey);
    this.bossWeekActive = true;
    this.bossWeekBossId = boss.id;
    // 直接进入 Boss 战（跳过常规波次）
    this.state.wave = 20; // Boss 出现在第 20 波
    this.boss = { def: boss, hp: boss.hp, maxHp: boss.hp, active: true, defeated: false };
    this.specialEvent = null;
    this.specialEventActive = false;
    this.itemLocked = false;
    this.bossSkill = null;
    postFX.flash("#B388FF", 0.5, 3);
    postFX.shake(8, 14);
    this.particles.spawnBurst(CARD_CX, CARD_CY, "#B388FF", { ring: true, sparks: 20, dots: 24, speed: 300, life: 1.2, size: 5, color2: "#FFB020", shockwave: true });
    this.particles.spawnText(CARD_CX, CARD_CY - 60, `📅 Boss 周：${boss.name}`, "#B388FF", { size: 18, life: 1.8 });
    playSfx("boss");
    this.toast = { text: `📅 Boss 周挑战：${boss.name}`, tone: "info", until: this.t + 3.0 };
    this.emitHud();
  }

  // ===== v2 升级：错题复盘模式（A5） =====
  /** 启动错题复盘：用存档中的错题生成专属补漏关卡 */
  startReviewMode(wrongRecords: FBWrongRecord[]): void {
    if (wrongRecords.length === 0) return;
    this.reviewMode = true;
    // 从错题记录重建题目（简化：从 QUESTION_BANK 按 ID 查找）
    const allQuestions = QUESTION_BANK;
    this.reviewQueue = wrongRecords
      .map((r) => allQuestions.find((q) => q.id === r.questionId))
      .filter((q): q is FBQuestion => !!q)
      .slice(0, 5); // 最多 5 题
    if (this.reviewQueue.length === 0) return;
    this.state.wave = 1;
    this.usedIds.clear();
    this.toast = { text: `📝 错题复盘：${this.reviewQueue.length} 题补漏挑战`, tone: "info", until: this.t + 2.5 };
    // 立即生成第一道复盘题
    const q = this.reviewQueue.shift()!;
    this.usedIds.add(q.id);
    this.spawnReviewCard(q);
  }

  /** 生成复盘卡片（复用 spawnCard 的卡片结构，但题目固定） */
  private spawnReviewCard(q: FBQuestion): void {
    const optionOrder = q.options.map((_, i) => i);
    const duration = 15; // 复盘模式时长宽裕
    this.current = {
      q, spawnTs: this.t, duration, entered: 0, exited: 0, state: "in",
      selectedIdx: null, pendingIdx: null, multiSelected: [], correct: false,
      riskTriggered: false, fiftyRemoved: [], hintHighlighted: [], optionOrder,
      skippedViaItem: false, flipProgress: 0, swipeOffset: 0, fillInput: "",
      linkSel: [], linkRightOrder: [], sortArr: [],
    };
    if (q.kind === "link" && q.linkRight && q.linkLeft) {
      this.current.linkRightOrder = q.linkRight.map((_, i) => i).sort(() => Math.random() - 0.5);
      this.current.linkSel = q.linkLeft.map(() => -1);
    }
    if (q.kind === "sort" && q.sortCorrect) {
      this.current.sortArr = q.sortCorrect.slice().sort(() => Math.random() - 0.5);
    }
    this.encounteredQuestions.push(q);
    this.branchState = q.kind === "branch" && q.branchSteps ? { stepId: q.branchSteps[0].id, history: [], ended: false } : null;
    this.audioState = q.cardType === "audio" ? { playing: false, progress: 0, finished: false } : this.audioState;
    playSfx("tick");
    this.emitHud();
  }

  /** 填空题：设置玩家输入文本（场景层键盘输入调用） */
  setFillInput(text: string): void {
    if (this.state.over || !this.current || this.current.state !== "show") return;
    if ((this.current.q.kind ?? "single") !== "fill") return;
    this.current.fillInput = text;
    this.emitHud();
  }

  /** 连线题：为左列第 leftIdx 项选择右列显示位置 rightDisplayIdx 的项 */
  setLinkSel(leftIdx: number, rightDisplayIdx: number): void {
    if (this.state.over || !this.current || this.current.state !== "show") return;
    if ((this.current.q.kind ?? "single") !== "link") return;
    const c = this.current;
    if (leftIdx < 0 || leftIdx >= c.linkSel.length) return;
    if (rightDisplayIdx < 0 || rightDisplayIdx >= c.linkRightOrder.length) return;
    // 取消之前选过同一右列项的配对
    const rightOrig = c.linkRightOrder[rightDisplayIdx];
    for (let i = 0; i < c.linkSel.length; i++) {
      if (c.linkSel[i] === rightOrig) c.linkSel[i] = -1;
    }
    // 切换：再次点击同一配对则取消
    if (c.linkSel[leftIdx] === rightOrig) {
      c.linkSel[leftIdx] = -1;
    } else {
      c.linkSel[leftIdx] = rightOrig;
    }
    playSfx("tick");
    this.emitHud();
  }

  /** 排序题：交换排列中位置 i 和 j 的项 */
  swapSortItem(i: number, j: number): void {
    if (this.state.over || !this.current || this.current.state !== "show") return;
    if ((this.current.q.kind ?? "single") !== "sort") return;
    const arr = this.current.sortArr;
    if (i < 0 || i >= arr.length || j < 0 || j >= arr.length || i === j) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    playSfx("tick");
    this.emitHud();
  }

  /** 获取当前填空题正确答案文本（场景层揭示态显示用） */
  getCurrentFillAnswer(): string {
    if (!this.current) return "";
    return this.current.q.fillAnswer ?? "";
  }

  /** 难度倒计时乘数：easy=1.3 / normal=1.0 / hard=0.75 */
  private diffDurationMult(): number {
    if (this.difficulty === "easy") return 1.3;
    if (this.difficulty === "hard") return 0.75;
    return 1.0;
  }

  private emitHud(): void {
    const tier = manTierFor(this.state.score);
    const c = this.current;
    // 段位变化检测：比较当前 tier 与上一帧 prevManLevel
    if (tier.level !== this.prevManLevel) {
      this.manLevelDelta = tier.level > this.prevManLevel ? "up" : "down";
      if (this.manLevelDelta === "down") {
        this.stats.tierDownCount += 1;
        // 掉段特效：红闪 + 震屏 + 飘字
        postFX.flash("#E5353B", 0.5, 2);
        postFX.shake(8, 14);
        this.particles.spawnText(CARD_CX, 120, `▼ 段位下降 ${MAN_TIERS[this.prevManLevel]?.name ?? ""} → ${tier.name}`, "#E5353B", { size: 14, life: 1.8 });
      } else if (this.manLevelDelta === "up") {
        // 升级特效：金光 + 飘字
        postFX.flash("#FFD666", 0.4, 2);
        this.particles.spawnBurst(CARD_CX, 140, "#FFD666", { ring: true, sparks: 16, dots: 18, speed: 260, life: 1.0, size: 4, color2: "#FFFFFF" });
        this.particles.spawnText(CARD_CX, 120, `▲ 段位提升！${tier.name}`, "#FFD666", { size: 14, life: 1.8 });
      }
      this.prevManLevel = tier.level;
    } else {
      this.manLevelDelta = null;
    }
    // Boss hideTimer 技能：倒计时强制显示满（视觉隐藏）
    const hideTimer = this.bossSkill === "hideTimer" && this.boss?.active;
    const timerRatio = c && (c.state === "show" || c.state === "in")
      ? (hideTimer ? 1 : clamp(1 - (this.t - c.spawnTs) / c.duration, 0, 1))
      : c && c.state === "reveal" ? 0 : 1;
    const kind: FBQuestionKind = c ? (c.q.kind ?? "single") : "single";
    // 双卡模式：构建第二张卡的精简状态
    let secondCard: FBHudSecondCard | null = null;
    if (this.dualMode && this.dualCards.length === 2) {
      const s = this.dualCards[1];
      const sHideTimer = this.bossSkill === "hideTimer" && this.boss?.active;
      const sRatio = s && (s.state === "show" || s.state === "in")
        ? (sHideTimer ? 1 : clamp(1 - (this.t - s.spawnTs) / s.duration, 0, 1))
        : s && s.state === "reveal" ? 0 : 1;
      secondCard = {
        options: s.q.options,
        qType: s.q.type,
        qKind: s.q.kind ?? "single",
        title: s.q.title,
        body: s.q.body,
        cardType: s.q.cardType,
        timerRatio: sRatio,
        selectedIdx: s.state === "reveal" ? s.selectedIdx : null,
        correctIdx: s.state === "reveal" ? (s.q.answer ?? null) : null,
        riskTriggered: s.riskTriggered,
        swipeOffset: s.swipeOffset !== 0 ? s.swipeOffset : null,
        flipProgress: s.flipProgress,
        isNormal: !!s.q.isNormal,
        riskIdx: s.q.risk ?? [],
      };
    }
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
      // ===== 全面升级新增字段 =====
      dualMode: this.dualMode,
      second: secondCard,
      flipProgress: c ? c.flipProgress : 0,
      manLevelPrev: this.prevManLevel,
      manLevelDelta: this.manLevelDelta,
      swipeOffset: c && c.state === "show" && kind === "judge" ? (c.swipeOffset !== 0 ? c.swipeOffset : null) : null,
      swipeHint: !!c && c.state === "show" && kind === "judge" && c.swipeOffset === 0 && c.selectedIdx === null,
      wrongRecords: this.stats.wrongRecords.slice(),
      tierDownCount: this.stats.tierDownCount,
      dualCleared: this.stats.dualCleared,
      // ===== 包C/D/A 新增字段 =====
      ultimateReady: this.ultimateReady,
      ultimateEnergy: this.ultimateEnergy,
      answerBlur: this.answerBlurRemaining > 0,
      timeStolen: this.timeStolen,
      rapidFireRemaining: this.rapidFireRemaining,
      psychology: c ? c.q.psychology : undefined,
      fillInput: c ? c.fillInput : "",
      linkSel: c ? c.linkSel.slice() : [],
      linkRightOrder: c ? c.linkRightOrder.slice() : [],
      sortArr: c ? c.sortArr.slice() : [],
      linkLeft: c ? c.q.linkLeft : undefined,
      linkRight: c ? c.q.linkRight : undefined,
      difficulty: this.difficulty,
      // ===== v2 升级新增字段 =====
      itemLevels: this.itemLevels,
      branch: c && kind === "branch" ? this.buildBranchHud(c) : null,
      audio: c && c.q.cardType === "audio" ? this.buildAudioHud(c) : null,
      caseArchive: c && c.state === "reveal" ? (c.q.caseArchive ?? null) : null,
      seasonTag: this.currentSeasonTag,
      bossWeekActive: this.bossWeekActive,
      // ===== v3 升级：游戏模式字段 =====
      gameMode: this.mode,
      speedrunRemain: this.mode === "speedrun" ? this.speedrunRemain : undefined,
      speedrunTotal: this.mode === "speedrun" ? this.speedrunTotal : undefined,
      speedrunAnswered: this.mode === "speedrun" ? this.speedrunAnswered : undefined,
      storyStageIdx: this.mode === "story" ? (this.storyStageIdx ?? undefined) : undefined,
      storyStageName: this.mode === "story" ? getStoryStage(this.storyStageIdx ?? 0)?.name : undefined,
      storyStageTotal: this.mode === "story" ? (this.modeQueue.length || undefined) : undefined,
      storyStageAnswered: this.mode === "story" ? this.storyStageAnswered : undefined,
      dailyKey: this.mode === "daily" ? this.dailyKeyVal : undefined,
      modeHint: FB_MODE_HINTS[this.mode],
      // ===== v4 升级新增字段（危机决策/证据判断题） =====
      crisisRemainSec: c && kind === "crisis" ? Math.max(0, c.duration - (this.t - c.spawnTs)) : undefined,
      crisisTotalSec: c && kind === "crisis" ? c.duration : undefined,
      evidenceSelectedIdx: c && kind === "evidence" ? (c.state === "show" ? c.pendingIdx : c.selectedIdx) : undefined,
      evidenceMessages: c && kind === "evidence" ? c.q.evidenceImage : undefined,
      // ===== v5 升级新增字段（三种新模式 HUD 状态） =====
      aiDialog: this.aiBattleRunner ? this.aiBattleRunner.getHud() : null,
      deconstruct: this.deconstructRunner ? this.deconstructRunner.getHud() : null,
      versus: this.versusRunner ? this.versusRunner.getHud() : null,
      // ===== v6 升级新增字段（即时小课堂） =====
      miniLessonAvailable: this.miniLessonAvailable,
      miniLesson: this.miniLesson,
      // ===== v6 升级新增字段（反诈侦探模式 HUD） =====
      detective: this.detectiveRunner ? this.detectiveRunner.getHud() : null,
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

    // 当前卡片（双卡模式：同屏左右双卡）
    if (this.dualMode && this.dualCards.length === 2) {
      // 双卡分隔线 + 中央 VS 标记
      this.drawDualDivider(ctx);
      // 左卡（offsetX=0）：CARD_X=20 → 20~380
      this.drawCard(ctx, this.dualCards[0], 0);
      // 右卡（offsetX=400）：CARD_X+400=420 → 420~780
      this.drawCard(ctx, this.dualCards[1], 400);
    } else if (this.current) {
      this.drawCard(ctx, this.current);
    } else if (!this.state.over) {
      drawText(ctx, `反诈波次 ${this.state.wave}`, CARD_CX, H / 2, {
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

  /**
   * v5 升级：在 v5 模式渲染分支中渲染引擎粒子系统
   * FraudBusterScene 的 v5 渲染分支不调用 engine.render()，
   * 但识破/攻击等事件触发的粒子仍需可见，故暴露此入口。
   */
  renderV5Particles(ctx: CanvasRenderingContext2D): void {
    this.particles.render(ctx);
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

  private drawCard(ctx: CanvasRenderingContext2D, c: Card, offsetX = 0): void {
    const cardX = CARD_X + offsetX;
    const cardY = CARD_Y;
    const cardW = CARD_W;
    const cardH = CARD_H;
    const cardCx = CARD_CX + offsetX;
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
    // 3D 翻转：reveal 阶段 Y 轴翻转，flipProgress 0→1
    // 0~0.5 显示正面（scaleX: 1→0），0.5~1 显示反面（scaleX: 0→1）
    const flip = c.flipProgress;
    const flipScaleX = flip < 0.5 ? 1 - flip * 2 : (flip - 0.5) * 2;
    const showBack = flip >= 0.5;
    // 滑动偏移：判断题手势跟随手指
    const swipeShift = c.swipeOffset * 60; // 最大偏移 60px

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cardCx + swipeShift, y + cardH / 2);
    ctx.scale(scale * flipScaleX, scale);
    ctx.translate(-cardCx, -(y + cardH / 2));
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

    // 内容：3D 翻转到背面（reveal 且 flipProgress>=0.5）时显示答案揭示，否则显示题目
    if (showBack && c.state === "reveal") {
      this.drawCardReveal(ctx, c, cardX + 18, y + 66 + headerH, cardW - 36, accent);
    } else {
      this.drawCardContent(ctx, c, cardX + 18, y + 66 + headerH, cardW - 36, accent);
    }

    // 科技角标
    this.drawCardCorners(ctx, cardX, y, cardW, cardH, accent);

    ctx.restore();
  }

  /** 双卡模式中央分隔线 + VS 标记 */
  private drawDualDivider(ctx: CanvasRenderingContext2D): void {
    const midX = 400; // 画布中央
    ctx.save();
    // 竖直虚线
    ctx.strokeStyle = "rgba(179,136,255,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(midX, 84);
    ctx.lineTo(midX, 456);
    ctx.stroke();
    ctx.setLineDash([]);
    // 中央 VS 圆标
    const vsY = CARD_CY;
    ctx.beginPath();
    ctx.arc(midX, vsY, 18, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(midX, vsY, 2, midX, vsY, 18);
    g.addColorStop(0, "rgba(179,136,255,0.9)");
    g.addColorStop(1, "rgba(120,60,200,0.4)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#B388FF";
    ctx.shadowColor = "#B388FF";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `900 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VS", midX, vsY + 1);
    ctx.restore();
  }

  /**
   * 卡片背面（答案揭示面）：3D 翻转过半后显示
   * - 大号 ✓/✗ 判定图标
   * - 正确答案文本
   * - 玩家选择（若错误）
   * - 识别要点（cues）
   * - 96110 反诈提示
   */
  private drawCardReveal(ctx: CanvasRenderingContext2D, c: Card, x: number, y: number, w: number, accent: string): void {
    const q = c.q;
    // 分隔线
    ctx.strokeStyle = "rgba(0,229,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    // 顶部：判定结果大图标
    const iconY = y + 28;
    const iconColor = c.correct ? "#1AD670" : "#E5353B";
    const iconText = c.correct ? "✓" : "✗";
    const resultText = c.correct ? "识破诈骗！" : (c.riskTriggered ? "⚠ 触发风险！" : "判断失误");
    ctx.save();
    ctx.font = `900 42px ${Theme.fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = iconColor;
    ctx.shadowColor = iconColor;
    ctx.shadowBlur = 14;
    ctx.fillText(iconText, x + w / 2, iconY);
    ctx.shadowBlur = 0;
    ctx.font = `900 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = iconColor;
    ctx.fillText(resultText, x + w / 2, iconY + 32);
    ctx.restore();

    // 正确答案
    const ansY = iconY + 56;
    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#7A8FB0";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("正确答案", x, ansY);
    const correctIdx = q.answer ?? -1;
    const correctText = correctIdx >= 0 ? q.options[correctIdx] : "—";
    ctx.font = `700 12px 'Noto Sans SC', sans-serif`;
    ctx.fillStyle = "#1AD670";
    wrapText(ctx, correctText, x, ansY + 14, w, 16, { size: 12, color: "#1AD670", weight: "700" });
    ctx.restore();

    // 玩家选择（错误时显示）
    if (!c.correct && c.selectedIdx !== null && c.selectedIdx >= 0) {
      const playerY = ansY + 40;
      ctx.save();
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#7A8FB0";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("你的选择", x, playerY);
      ctx.font = `700 12px 'Noto Sans SC', sans-serif`;
      ctx.fillStyle = "#E5353B";
      wrapText(ctx, q.options[c.selectedIdx] ?? "—", x, playerY + 14, w, 16, { size: 12, color: "#E5353B", weight: "700" });
      ctx.restore();
    }

    // 识别要点（cues）
    if (q.cues && q.cues.length > 0) {
      const cuesY = ansY + (c.correct ? 40 : 76);
      ctx.save();
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("🔍 识别要点", x, cuesY);
      ctx.font = `500 11px 'Noto Sans SC', sans-serif`;
      ctx.fillStyle = "#F0F4FF";
      let cy = cuesY + 16;
      for (const cue of q.cues.slice(0, 3)) {
        ctx.fillText(`· ${cue}`, x, cy);
        cy += 16;
      }
      ctx.restore();
    }

    // 话术解析（心理操控手法标签）
    if (q.psychology && q.psychology.length > 0) {
      const psyY = ansY + (c.correct ? 96 : 132);
      ctx.save();
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#B388FF";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("🧠 话术解析", x, psyY);
      // 心理手法标签横排
      let bx = x;
      const by = psyY + 14;
      for (const tag of q.psychology.slice(0, 3)) {
        const label = this.psychologyLabel(tag);
        ctx.font = `700 9px ${Theme.fonts.mono}`;
        const tw = ctx.measureText(label).width + 10;
        roundRect(ctx, bx, by, tw, 14, 7);
        ctx.fillStyle = "rgba(179,136,255,0.15)";
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "rgba(179,136,255,0.6)";
        roundRect(ctx, bx, by, tw, 14, 7);
        ctx.stroke();
        ctx.fillStyle = "#D4B8FF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, bx + tw / 2, by + 7);
        bx += tw + 4;
        if (bx + 60 > x + w) break;
      }
      ctx.restore();
    }

    // 96110 反诈提示（底部）
    const tipY = y + 260;
    ctx.save();
    roundRect(ctx, x, tipY, w, 38, 6);
    const g = ctx.createLinearGradient(x, tipY, x, tipY + 38);
    g.addColorStop(0, "rgba(229,53,59,0.18)");
    g.addColorStop(1, "rgba(229,53,59,0.08)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(229,53,59,0.5)";
    roundRect(ctx, x, tipY, w, 38, 6);
    ctx.stroke();
    ctx.font = `900 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FF6B6B";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = "#E5353B";
    ctx.shadowBlur = 6;
    ctx.fillText("☎ 96110 反诈专线", x + w / 2, tipY + 6);
    ctx.shadowBlur = 0;
    ctx.font = `500 9px 'Noto Sans SC', sans-serif`;
    ctx.fillStyle = "#FFC0C0";
    ctx.fillText("遇诈即拨 · 快速止付", x + w / 2, tipY + 22);
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
      case "timeSteal": return "⏱ 偷取时间";
      case "answerBlur": return "🌫 选项模糊";
    }
  }

  /** 心理操控手法中文标签（话术解析） */
  private psychologyLabel(tag: FBPsychology): string {
    switch (tag) {
      case "urgency": return "紧迫施压";
      case "authority": return "权威恐吓";
      case "greed": return "贪婪诱惑";
      case "fear": return "恐惧施压";
      case "trust": return "信任建立";
      case "intimacy": return "情感亲密";
      case "curiosity": return "好奇心";
      case "conformity": return "从众压力";
      case "scarcity": return "稀缺暗示";
      case "sunkCost": return "沉没成本";
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
    } else if (q.cardType === "qrcode") {
      this.drawQrcodeScreen(ctx, q, x, bodyY, w, bodyColor);
    } else if (q.cardType === "voice") {
      this.drawVoiceScreen(ctx, q, x, bodyY, w, accent, bodyColor);
    } else if (q.cardType === "app") {
      this.drawAppScreen(ctx, q, x, bodyY, w, bodyColor);
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

  /** 二维码扫描界面：扫码框 + 伪装二维码 + 风险提示 */
  private drawQrcodeScreen(ctx: CanvasRenderingContext2D, q: FBQuestion, x: number, y: number, w: number, bodyColor: string): void {
    // 顶栏（深色，模拟扫码界面）
    const headerH = 32;
    ctx.save();
    roundRect(ctx, x, y, w, headerH, 6);
    const hg = ctx.createLinearGradient(x, y, x, y + headerH);
    hg.addColorStop(0, "#1A1A2E");
    hg.addColorStop(1, "#0A0A14");
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.restore();
    drawText(ctx, "📷 扫一扫", x + 14, y + 16, { size: 12, color: "#00E5FF", weight: "700", baseline: "middle" });
    drawText(ctx, "⚠", x + w - 14, y + 16, { size: 14, color: "#FFD666", weight: "900", align: "right", baseline: "middle" });

    // 扫码取景框（中央）
    const frameSize = 120;
    const frameX = x + (w - frameSize) / 2;
    const frameY = y + headerH + 16;
    ctx.save();
    // 暗色背景
    roundRect(ctx, x, frameY - 8, w, frameSize + 16, 4);
    ctx.fillStyle = "#0A0A14";
    ctx.fill();
    // 取景框边角
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 3;
    const cornerLen = 16;
    const corners: [number, number, number, number][] = [
      [frameX, frameY, 1, 1],
      [frameX + frameSize, frameY, -1, 1],
      [frameX, frameY + frameSize, 1, -1],
      [frameX + frameSize, frameY + frameSize, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * cornerLen);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * cornerLen, cy);
      ctx.stroke();
    }
    // 扫描线动画
    const scanY = frameY + ((this.t * 80) % frameSize);
    const scanG = ctx.createLinearGradient(frameX, scanY - 8, frameX, scanY + 8);
    scanG.addColorStop(0, "rgba(0,229,255,0)");
    scanG.addColorStop(0.5, "rgba(0,229,255,0.8)");
    scanG.addColorStop(1, "rgba(0,229,255,0)");
    ctx.fillStyle = scanG;
    ctx.fillRect(frameX, scanY - 8, frameSize, 16);
    ctx.restore();

    // 伪装二维码（取景框内）
    ctx.save();
    const cellSize = 8;
    const gridN = frameSize / cellSize;
    for (let i = 0; i < gridN; i++) {
      for (let j = 0; j < gridN; j++) {
        // 伪随机图案（基于固定种子，稳定不闪烁）
        const seed = (i * 31 + j * 17 + 7) % 7;
        if (seed < 3) {
          ctx.fillStyle = "#0A0A14";
        } else {
          ctx.fillStyle = "#E8E8E8";
        }
        ctx.fillRect(frameX + i * cellSize, frameY + j * cellSize, cellSize, cellSize);
      }
    }
    // 三个定位角（左上、右上、左下）
    const drawLocator = (lx: number, ly: number) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(lx, ly, 24, 24);
      ctx.fillStyle = "#FFF";
      ctx.fillRect(lx + 4, ly + 4, 16, 16);
      ctx.fillStyle = "#000";
      ctx.fillRect(lx + 8, ly + 8, 8, 8);
    };
    drawLocator(frameX + 4, frameY + 4);
    drawLocator(frameX + frameSize - 28, frameY + 4);
    drawLocator(frameX + 4, frameY + frameSize - 28);
    ctx.restore();

    // 识别结果提示
    const resultY = frameY + frameSize + 16;
    drawText(ctx, q.title, x + w / 2, resultY, {
      size: 12, color: "#FFD666", weight: "700", align: "center", max: 30,
    });
    // 内容（风险提示）
    wrapText(ctx, q.body, x + 12, resultY + 18, w - 24, 15, { size: 11, color: bodyColor, weight: "500", align: "center" });
  }

  /** 语音消息界面：聊天顶栏 + 语音气泡 + 波形动画 */
  private drawVoiceScreen(ctx: CanvasRenderingContext2D, q: FBQuestion, x: number, y: number, w: number, accent: string, bodyColor: string): void {
    // 顶栏（与聊天一致，深色）
    const headerH = 32;
    ctx.save();
    roundRect(ctx, x, y, w, headerH, 6);
    const hg = ctx.createLinearGradient(x, y, x, y + headerH);
    hg.addColorStop(0, "#2E2E2E");
    hg.addColorStop(1, "#1F1F1F");
    ctx.fillStyle = hg;
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
    drawText(ctx, q.title, x + w / 2, y + 16, { size: 12, color: "#F0F4FF", weight: "700", align: "center", max: 22 });
    drawText(ctx, "⋯", x + w - 14, y + 16, { size: 16, color: "#52C41A", weight: "900", align: "right", baseline: "middle" });

    // 时间戳
    const chatY = y + headerH + 10;
    drawText(ctx, this.formatChatTime(), x + w / 2, chatY, {
      size: 9, color: "#7A8FB0", weight: "500", align: "center", font: Theme.fonts.mono,
    });

    // 头像（左侧）
    const avX = x + 8;
    const avY = chatY + 14;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avX + 14, avY + 14, 14, 0, Math.PI * 2);
    const av = ctx.createLinearGradient(avX, avY, avX + 28, avY + 28);
    av.addColorStop(0, "#FF7A1A");
    av.addColorStop(1, "#D4380D");
    ctx.fillStyle = av;
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 12px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎤", avX + 14, avY + 14);
    ctx.restore();

    // 语音气泡（绿色，左侧）
    const bubbleX = avX + 32;
    const bubbleY = avY - 4;
    const bubbleW = 180;
    const bubbleH = 40;
    ctx.save();
    roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 8);
    const bg = ctx.createLinearGradient(bubbleX, bubbleY, bubbleX, bubbleY + bubbleH);
    bg.addColorStop(0, "#95DE64");
    bg.addColorStop(1, "#73D13D");
    ctx.fillStyle = bg;
    ctx.fill();
    // 气泡尖角
    ctx.beginPath();
    ctx.moveTo(bubbleX, bubbleY + 12);
    ctx.lineTo(bubbleX - 6, bubbleY + 16);
    ctx.lineTo(bubbleX, bubbleY + 20);
    ctx.closePath();
    ctx.fillStyle = "#73D13D";
    ctx.fill();
    ctx.restore();

    // 语音波形（动态跳动）
    ctx.save();
    const waveX = bubbleX + 12;
    const waveY = bubbleY + bubbleH / 2;
    const barCount = 18;
    const barW = 3;
    const barGap = 5;
    for (let i = 0; i < barCount; i++) {
      const phase = (this.t * 6 + i * 0.4) % (Math.PI * 2);
      const amp = (Math.sin(phase) * 0.5 + 0.5) * (0.4 + Math.sin(i * 0.7) * 0.3 + 0.3);
      const barH = Math.max(3, amp * 22);
      ctx.fillStyle = "#1F1F1F";
      ctx.fillRect(waveX + i * (barW + barGap), waveY - barH / 2, barW, barH);
    }
    ctx.restore();

    // 时长 + 播放图标（右侧）
    drawText(ctx, "▶ 0:03", bubbleX + bubbleW - 12, bubbleY + bubbleH / 2, {
      size: 10, color: "#1F1F1F", weight: "700", align: "right", baseline: "middle", font: Theme.fonts.mono,
    });

    // "未读"红点
    ctx.save();
    ctx.beginPath();
    ctx.arc(bubbleX + bubbleW + 8, bubbleY + bubbleH / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#E5353B";
    ctx.fill();
    ctx.restore();

    // 语音转文字提示（下方）
    const textY = bubbleY + bubbleH + 14;
    ctx.save();
    roundRect(ctx, avX + 32, textY, w - 60, 18, 4);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.restore();
    drawText(ctx, "💬 文字内容", avX + 42, textY + 9, { size: 10, color: "#7A8FB0", weight: "500", baseline: "middle" });
    // 语音转写的正文
    wrapText(ctx, q.body, avX + 32, textY + 22, w - 60, 14, { size: 10, color: bodyColor, weight: "500" });
  }

  /** APP 安装/权限界面：安装弹窗 + 权限列表 */
  private drawAppScreen(ctx: CanvasRenderingContext2D, q: FBQuestion, x: number, y: number, w: number, bodyColor: string): void {
    // 顶栏（系统状态栏样式）
    const headerH = 28;
    ctx.save();
    roundRect(ctx, x, y, w, headerH, 6);
    ctx.fillStyle = "#1A1A2E";
    ctx.fill();
    ctx.restore();
    drawText(ctx, "⚙ 应用安装", x + 14, y + 14, { size: 11, color: "#7A8FB0", weight: "700", baseline: "middle" });
    drawText(ctx, "⚠", x + w - 14, y + 14, { size: 14, color: "#FFD666", weight: "900", align: "right", baseline: "middle" });

    // APP 图标 + 名称（中央）
    const iconY = y + headerH + 18;
    const iconCx = x + w / 2;
    ctx.save();
    // 图标背景（带警告色调）
    roundRect(ctx, iconCx - 24, iconY, 48, 48, 12);
    const ig = ctx.createLinearGradient(iconCx - 24, iconY, iconCx + 24, iconY + 48);
    ig.addColorStop(0, "#FF7A1A");
    ig.addColorStop(1, "#D4380D");
    ctx.fillStyle = ig;
    ctx.fill();
    ctx.shadowColor = "#FF7A1A";
    ctx.shadowBlur = 12;
    roundRect(ctx, iconCx - 24, iconY, 48, 48, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 图标内文字
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 20px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📲", iconCx, iconY + 24);
    ctx.restore();

    // APP 名称
    drawText(ctx, q.title, iconCx, iconY + 60, {
      size: 13, color: "#F0F4FF", weight: "700", align: "center", max: 30,
    });
    drawText(ctx, "未知来源 · 风险应用", iconCx, iconY + 76, {
      size: 10, color: "#E5353B", weight: "700", align: "center", font: Theme.fonts.mono,
    });

    // 权限列表
    const permY = iconY + 96;
    ctx.save();
    roundRect(ctx, x, permY, w, 86, 6);
    ctx.fillStyle = "rgba(229,53,59,0.08)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(229,53,59,0.3)";
    roundRect(ctx, x, permY, w, 86, 6);
    ctx.stroke();
    ctx.restore();
    drawText(ctx, "⚠ 该应用将获取以下权限：", x + 12, permY + 12, {
      size: 10, color: "#FFD666", weight: "700", baseline: "top",
    });
    // 权限项
    const perms = ["📞 通讯录", "💬 短信读取", "📷 相机/相册", "📍 定位", "🔒 无障碍服务"];
    for (let i = 0; i < perms.length; i++) {
      const py = permY + 28 + i * 12;
      drawText(ctx, perms[i], x + 16, py, { size: 10, color: bodyColor, weight: "500", baseline: "top" });
      drawText(ctx, "✗", x + w - 16, py, { size: 11, color: "#E5353B", weight: "900", align: "right", baseline: "top" });
    }

    // 安装按钮（红色，醒目）
    const btnY = permY + 96;
    ctx.save();
    roundRect(ctx, x + 20, btnY, w - 40, 30, 15);
    const btnG = ctx.createLinearGradient(x, btnY, x, btnY + 30);
    btnG.addColorStop(0, "#FF4D4F");
    btnG.addColorStop(1, "#CF1322");
    ctx.fillStyle = btnG;
    ctx.fill();
    ctx.restore();
    drawText(ctx, "安装", x + w / 2, btnY + 15, { size: 12, color: "#FFFFFF", weight: "900", align: "center", baseline: "middle" });
  }

  private cardTypeLabel(t: FBQuestion["cardType"]): string {
    switch (t) {
      case "chat": return "💬 CHAT · 聊天消息";
      case "call": return "📞 INCOMING · 来电";
      case "video": return "📹 VIDEO · 视频通话";
      case "transfer": return "💸 TRANSFER · 资金操作";
      case "popup": return "⚠ POPUP · 网页弹窗";
      case "sms": return "📨 SMS · 短信通知";
      case "qrcode": return "📱 QR · 二维码";
      case "voice": return "🎙 VOICE · 语音消息";
      case "app": return "📲 APP · 安装/权限";
    }
  }
}
