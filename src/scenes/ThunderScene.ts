/**
 * 「雷霆反诈」游戏场景
 * 引擎画布 540×960 竖屏，引擎 InputManager 处理飞船拖拽
 * Scene 负责炸弹按钮（consumedTouchIds 防冲突）+ Boss HP 条 + 结算
 *
 * 升级版新增 UI：
 *  - 阶段切换全屏 overlay（PHASE 2/3 等）
 *  - 连击脉冲显示
 *  - 武器经验条 + 满级标识
 *  - 分数倍率 pill（基于 combo）
 *  - 成就 toast（滑入/淡出动画）
 *  - BOSS 狂暴警示
 *  - 时间减速全屏色调 + 指示器
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawButton, drawProgressBar, drawToast, drawNeonCorners, hitTest, type Rect } from "@/ui/widgets";
import { ThunderEngine } from "@/games/thunder/engine";
import { BOSS } from "@/games/thunder/data";
import { HP_PER_YUANBAO, MAX_HP } from "@/games/thunder/types";
import type { ThunderHud } from "@/games/thunder/types";
import { playSfx } from "@/engine/Audio";
import { vibrateShort } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import type { GameEvent, GameResultPayload } from "@/types";

interface AchData { name: string; desc: string; emoji: string; }

export class ThunderScene extends GameShellScene {
  private engine: ThunderEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private hud: ThunderHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedBomb = false;
  private pressedBranchIdx: number | null = null;
  private t = 0;

  // 新增动效状态
  private prevCombo = 0;
  private comboPulseT = 99; // 距离上次 combo 增加的秒数（初始大值=无脉冲）
  private achData: AchData | null = null;
  private achT = 0; // 当前成就显示计时
  private achFadingOut = false;

  getGameTitle(): string { return "雷霆反诈"; }
  getGameSubtitle(): string { return "THUNDER"; }
  getAccent(): string { return Theme.accents.thunder; }

  enter(): void {
    super.enter();
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new ThunderEngine(canvas);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    // 由 updateGame/renderGame 同步驱动，消除双 RAF 撕裂闪烁
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      const newHud = e.payload as unknown as ThunderHud;
      // 检测 combo 增加 → 触发脉冲
      if (newHud.combo > this.prevCombo) {
        this.comboPulseT = 0;
      }
      this.prevCombo = newHud.combo;
      // 检测成就变化
      const newAch = newHud.achievement;
      if (newAch) {
        if (!this.achData || this.achData.name !== newAch.name) {
          this.achData = { name: newAch.name, desc: newAch.desc, emoji: newAch.emoji };
          this.achT = 0;
          this.achFadingOut = false;
        }
      } else if (this.achData && !this.achFadingOut) {
        // 引擎清除了 achievement → 进入淡出
        this.achFadingOut = true;
        this.achT = 0;
      }
      this.hud = newHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 3 };
      this.toastTimer = 0;
    } else if (e.type === "result") {
      this.onResult(e.payload);
    }
  }

  private onResult(result: GameResultPayload): void {
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director)),
    });
  }

  private retry(): void {
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.prevCombo = 0;
    this.comboPulseT = 99;
    this.achData = null;
    this.achT = 0;
    this.achFadingOut = false;
    this.pressedBomb = false;
    this.pressedBranchIdx = null;
    this.spawnEngine();
  }

  protected updateGame(dt: number): void {
    // 同步驱动引擎 update（与场景同帧，杜绝撕裂）
    this.engine?.stepUpdate(dt);
    this.t += dt;
    this.comboPulseT += dt;
    // 成就 toast 计时
    if (this.achData) {
      this.achT += dt;
      if (this.achFadingOut && this.achT >= 0.3) {
        // 淡出完成
        this.achData = null;
        this.achFadingOut = false;
        this.achT = 0;
      }
    }
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 3) this.toast = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  private getBombButtonRect(screenW: number, screenH: number): Rect {
    return { x: screenW - 76, y: screenH - 24 - 64 - 12, w: 64, h: 64 };
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.engineCanvas && this.engine) {
      // 同步驱动引擎渲染，确保 engineCanvas 在 blit 前已完成本帧绘制
      this.engine.stepRender();
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // 时间减速全屏色调
    if (this.hud && this.hud.slowMoUntil > 0) {
      this.renderSlowMoOverlay(ctx, screenW, screenH);
    }

    // Boss HP 条（含狂暴警示）
    if (this.hud && this.hud.phase === "boss" && this.hud.bossHp !== undefined && this.hud.bossMax) {
      this.renderBossBar(ctx, screenW);
    }

    // 状态信息（称号/积分/武器XP/生命值）
    if (this.hud) {
      this.renderStats(ctx, screenW);
    }

    // 公安反诈突击按钮
    const bombBtn = this.getBombButtonRect(screenW, screenH);
    const raids = this.hud?.raids ?? 0;
    drawButton(ctx, bombBtn.x, bombBtn.y, bombBtn.w, bombBtn.h, "", {
      variant: "hard", accent: raids > 0 ? "#FF7A1A" : Theme.colors.bg.line,
      pressed: this.pressedBomb,
    });
    ctx.save();
    ctx.font = "26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = raids > 0 ? 1 : 0.4;
    ctx.fillText("🚔", bombBtn.x + bombBtn.w / 2, bombBtn.y + bombBtn.h / 2 - 6);
    ctx.restore();
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = raids > 0 ? "#FFD666" : Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`×${raids}`, bombBtn.x + bombBtn.w / 2, bombBtn.y + bombBtn.h - 12);
    ctx.restore();
    // 突击按钮小标签
    ctx.save();
    ctx.font = `500 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = raids > 0 ? "#FF7A1A" : Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("反诈突击", bombBtn.x + bombBtn.w / 2, bombBtn.y - 8);
    ctx.restore();

    // 连击数显示（中央顶部）
    if (this.hud && this.hud.combo >= 2) {
      this.renderCombo(ctx, screenW);
    }

    // 时间减速指示徽章
    if (this.hud && this.hud.slowMoUntil > 0) {
      this.renderSlowMoBadge(ctx, screenW);
    }

    // 成就 toast（滑入式）
    this.renderAchievementToast(ctx, screenW);

    // Toast 通讯
    if (this.toast) {
      const tw = screenW - 32;
      const th = 56;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "战机通讯");
    }

    // 阶段切换全屏 overlay（最上层）
    this.renderPhaseTransition(ctx, screenW, screenH);

    // 分支增援选择 overlay（仅在 branch 阶段显示）
    if (this.hud && this.hud.phase === "branch" && this.hud.branchOptions) {
      this.renderBranchChoice(ctx, screenW, screenH);
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  /** 分支增援选择 overlay：3 个可点击选项卡片 */
  private renderBranchChoice(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const options = hud.branchOptions!;
    // 全屏暗化遮罩
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.78)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 顶部标题
    const titleY = screenH * 0.18;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 10;
    ctx.fillText("BRANCH · 增援路线选择", screenW / 2, titleY - 22);
    ctx.shadowBlur = 0;
    ctx.font = `900 24px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FF00E5";
    ctx.shadowBlur = 18;
    ctx.fillText(`选择第 ${(hud.branchWave ?? 1)} 波增援`, screenW / 2, titleY + 8);
    ctx.shadowBlur = 0;
    // 副标
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("点击卡片选择一项增援（一次性）", screenW / 2, titleY + 32);

    // 3 个卡片纵向排列
    const cardW = Math.min(320, screenW - 48);
    const cardH = 92;
    const gap = 14;
    const totalH = cardH * 3 + gap * 2;
    const startY = (screenH - totalH) / 2 + 30;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const rect = this.getBranchOptionRect(i, screenW, screenH);
      const pressed = this.pressedBranchIdx === i;
      // 卡片背景
      ctx.fillStyle = pressed ? withAlpha(opt.color, 0.22) : "rgba(20, 36, 58, 0.92)";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      // 边框（霓虹色）
      ctx.strokeStyle = opt.color;
      ctx.lineWidth = pressed ? 2 : 1;
      ctx.shadowColor = opt.color;
      ctx.shadowBlur = pressed ? 16 : 8;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.shadowBlur = 0;
      // 四角括号
      drawNeonCorners(ctx, rect.x, rect.y, rect.w, rect.h, opt.color, 10, 2, 6);
      // emoji 大图
      ctx.font = "32px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opt.emoji, rect.x + 36, rect.y + rect.h / 2);
      // 标题
      ctx.font = `700 16px ${Theme.fonts.body}`;
      ctx.fillStyle = opt.color;
      ctx.textAlign = "left";
      ctx.fillText(opt.title, rect.x + 72, rect.y + 28);
      // 描述
      ctx.font = `400 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.fillText(opt.desc, rect.x + 72, rect.y + 52);
      // 序号
      ctx.font = `900 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(opt.color, 0.7);
      ctx.textAlign = "right";
      ctx.fillText(`0${i + 1}`, rect.x + rect.w - 12, rect.y + 14);
    }
    ctx.restore();
  }

  /** 分支选项矩形 */
  private getBranchOptionRect(idx: number, screenW: number, screenH: number): Rect {
    const cardW = Math.min(320, screenW - 48);
    const cardH = 92;
    const gap = 14;
    const totalH = cardH * 3 + gap * 2;
    const startY = (screenH - totalH) / 2 + 30;
    const x = (screenW - cardW) / 2;
    const y = startY + idx * (cardH + gap);
    return { x, y, w: cardW, h: cardH };
  }

  /** 阶段切换全屏 overlay */
  private renderPhaseTransition(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.hud || !this.hud.phaseTransitionUntil || this.hud.phaseTransitionUntil <= 0) return;
    const remaining = this.hud.phaseTransitionUntil;
    const TOTAL = 1.5;
    const progress = Math.max(0, Math.min(1, 1 - remaining / TOTAL)); // 0→1
    // alpha 曲线：先快速上升，再缓慢下降
    let alpha: number;
    if (progress < 0.2) alpha = progress / 0.2;
    else alpha = Math.max(0, 1 - (progress - 0.2) / 0.8);
    // scale 曲线：从 0.6 放大到 1.0
    const scale = 0.6 + progress * 0.4;

    ctx.save();
    // 全屏 magenta 色调
    ctx.fillStyle = withAlpha("#FF00E5", alpha * 0.12);
    ctx.fillRect(0, 0, screenW, screenH);
    // 上下渐变光带
    const grad = ctx.createLinearGradient(0, 0, 0, screenH);
    grad.addColorStop(0, withAlpha("#FF00E5", alpha * 0.25));
    grad.addColorStop(0.5, "transparent");
    grad.addColorStop(1, withAlpha("#00E5FF", alpha * 0.25));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);

    // 中央大字
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    // 副标
    ctx.font = `400 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 12;
    ctx.fillText("PHASE SHIFT", 0, -60);
    // 主标
    ctx.font = `900 56px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FF00E5";
    ctx.shadowBlur = 24;
    ctx.fillText(this.hud.phaseTransitionText ?? "", 0, 0);
    // 装饰线
    ctx.shadowBlur = 0;
    ctx.strokeStyle = withAlpha("#FF00E5", 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-120, 40);
    ctx.lineTo(120, 40);
    ctx.stroke();
    ctx.restore();
  }

  /** 连击数显示（顶部中央，>=2 才显示） */
  private renderCombo(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    if (hud.combo < 2) return;
    // 脉冲：刚增加时 1.3x，0.4s 内回到 1.0
    const pulse = Math.max(0, 1 - this.comboPulseT / 0.4);
    const scale = 1 + pulse * 0.3;
    const alpha = Math.min(1, hud.combo / 5 + 0.4);

    const cx = screenW / 2;
    const cy = 70;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    // "COMBO" 小标
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("COMBO", 0, -16);
    // 数字（颜色随 combo 升级）
    const comboColor = hud.combo >= 15 ? "#FF00E5" : hud.combo >= 8 ? "#FFD666" : "#00E5FF";
    ctx.font = `900 28px ${Theme.fonts.display}`;
    ctx.fillStyle = comboColor;
    ctx.shadowColor = comboColor;
    ctx.shadowBlur = 14;
    ctx.fillText(`×${hud.combo}`, 0, 6);
    ctx.restore();
  }

  /** 成就 toast（滑入式卡片） */
  private renderAchievementToast(ctx: CanvasRenderingContext2D, screenW: number): void {
    if (!this.achData) return;
    // 滑入：0 → 0.3s 滑入；停留；淡出：0 → 0.3s
    let offsetX: number;
    let alpha: number;
    if (this.achFadingOut) {
      const p = Math.min(1, this.achT / 0.3);
      offsetX = p * 80;
      alpha = 1 - p;
    } else if (this.achT < 0.3) {
      const p = this.achT / 0.3;
      offsetX = (1 - p) * 80;
      alpha = p;
    } else {
      offsetX = 0;
      alpha = 1;
    }
    const cardW = 260;
    const cardH = 64;
    const x = (screenW - cardW) / 2 + offsetX;
    const y = 130;

    ctx.save();
    ctx.globalAlpha = alpha;
    // 背景
    ctx.fillStyle = "rgba(15, 34, 54, 0.92)";
    ctx.fillRect(x, y, cardW, cardH);
    // 左侧金色条
    ctx.fillStyle = "#FFD666";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, 4, cardH);
    ctx.shadowBlur = 0;
    // 四角霓虹括号
    drawNeonCorners(ctx, x, y, cardW, cardH, "#FFD666", 10, 3, 8);

    // emoji
    ctx.font = "28px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.achData.emoji, x + 28, y + cardH / 2);
    // "成就达成" 标签
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "left";
    ctx.fillText("ACHIEVEMENT UNLOCKED", x + 56, y + 14);
    // 名称
    ctx.font = `700 15px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(this.achData.name, x + 56, y + 30);
    // 描述
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(this.achData.desc, x + 56, y + 48);
    ctx.restore();
  }

  /** 时间减速全屏色调 + 边缘脉冲 */
  private renderSlowMoOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(120, 144, 255, 0.08)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 边缘脉冲
    const pulse = 0.4 + Math.sin(this.t * 6) * 0.2;
    ctx.strokeStyle = withAlpha("#7890FF", pulse);
    ctx.lineWidth = 2;
    ctx.shadowColor = "#7890FF";
    ctx.shadowBlur = 16;
    ctx.strokeRect(2, 2, screenW - 4, screenH - 4);
    ctx.restore();
  }

  /** 时间减速指示徽章（左下） */
  private renderSlowMoBadge(ctx: CanvasRenderingContext2D, _screenW: number): void {
    const hud = this.hud!;
    const remaining = hud.slowMoUntil;
    const x = 16;
    const y = 124;
    const w = 122;
    const h = 22;
    const pulse = 0.5 + Math.sin(this.t * 8) * 0.3;
    ctx.save();
    ctx.fillStyle = "rgba(120, 144, 255, 0.18)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = withAlpha("#7890FF", pulse);
    ctx.lineWidth = 1;
    ctx.shadowColor = "#7890FF";
    ctx.shadowBlur = 8;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("⏱", x + 6, y + h / 2);
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`时间减速 ${remaining.toFixed(1)}s`, x + 22, y + h / 2 + 1);
    ctx.restore();
  }

  private renderBossBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const barY = 96;
    const barW = screenW - 32;
    const barH = 12;
    const ratio = (hud.bossHp ?? 0) / (hud.bossMax ?? 1);
    const phaseColor = (hud.bossPhase ?? 1) === 1 ? Theme.colors.warn.DEFAULT : (hud.bossPhase ?? 1) === 2 ? "#FF7A1A" : "#FF00E5";
    const enraged = hud.bossEnraged ?? false;
    ctx.save();
    if (enraged) {
      // BOSS 狂暴警示
      const pulse = 0.5 + Math.sin(this.t * 10) * 0.5;
      ctx.font = `900 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF00E5";
      ctx.shadowColor = "#FF00E5";
      ctx.shadowBlur = 10 * pulse;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`⚠ BOSS 狂暴 · ${hud.bossName ?? BOSS.name}`, 16, barY - 30);
      ctx.shadowBlur = 0;
      // 警示条纹
      ctx.fillStyle = withAlpha("#FF00E5", pulse * 0.3);
      ctx.fillRect(0, barY - 18, screenW, 2);
    } else {
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = phaseColor;
      ctx.shadowColor = phaseColor;
      ctx.shadowBlur = 6;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`BOSS · ${hud.bossName ?? BOSS.name} · 阶段 ${hud.bossPhase ?? 1}/3`, 16, barY - 16);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    drawProgressBar(ctx, 16, barY, barW, barH, ratio, enraged ? "#FF00E5" : phaseColor);
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(hud.bossFraudType ?? BOSS.fraudType, screenW - 16, barY - 14);
    ctx.restore();
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 52;
    ctx.save();

    // 左上：称号 + 积分
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("TITLE", 16, y - 6);
    ctx.font = `900 15px ${Theme.fonts.body}`;
    ctx.fillStyle = hud.titleColor;
    ctx.shadowColor = withAlpha(hud.titleColor, 0.5);
    ctx.shadowBlur = 8;
    ctx.fillText(hud.titleName, 16, y + 6);
    ctx.shadowBlur = 0;

    // 积分 + 倍率 pill
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.getAccent();
    const scoreText = `${hud.score.toLocaleString()} 分`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(scoreText, 16, y + 26);
    // 倍率 pill（>1.0 时显示）
    if (hud.scoreMultiplier > 1.0) {
      const scoreW = ctx.measureText(scoreText).width;
      const pillX = 16 + scoreW + 8;
      const pillY = y + 24;
      const pillW = 42;
      const pillH = 16;
      const multColor = hud.scoreMultiplier >= 2 ? "#FF00E5" : "#FFD666";
      ctx.fillStyle = withAlpha(multColor, 0.18);
      ctx.fillRect(pillX, pillY, pillW, pillH);
      ctx.strokeStyle = multColor;
      ctx.lineWidth = 1;
      ctx.shadowColor = multColor;
      ctx.shadowBlur = 6;
      ctx.strokeRect(pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1);
      ctx.shadowBlur = 0;
      ctx.font = `900 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = multColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`×${hud.scoreMultiplier.toFixed(2)}`, pillX + pillW / 2, pillY + pillH / 2 + 0.5);
    }

    // 武器 XP 条（在积分下方）
    if (hud.weapon < 4 && hud.weaponXpMax > 0) {
      const xpY = y + 44;
      const xpW = 140;
      const xpH = 4;
      const xpRatio = Math.max(0, Math.min(1, hud.weaponXp / hud.weaponXpMax));
      // 背景
      ctx.fillStyle = Theme.colors.bg.line;
      ctx.fillRect(16, xpY, xpW, xpH);
      // 进度
      ctx.fillStyle = this.getAccent();
      ctx.shadowColor = this.getAccent();
      ctx.shadowBlur = 6;
      ctx.fillRect(16, xpY, xpW * xpRatio, xpH);
      ctx.shadowBlur = 0;
      // 标签
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`WEAPON LV${hud.weapon} · ${hud.weaponXp}/${hud.weaponXpMax}`, 16, xpY + 6);
    } else if (hud.weapon >= 4) {
      // 满级显示
      ctx.font = `900 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 8;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("★ WEAPON MAX LV4", 16, y + 44);
      ctx.shadowBlur = 0;
    }

    // 下一称号缺口
    if (hud.nextTitleGap > 0) {
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`距下一称号 ${hud.nextTitleGap} 分`, 16, y + 60);
    } else {
      ctx.font = `900 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("已达最高称号", 16, y + 60);
    }

    // 右上：铜元宝生命值（36）
    const totalPips = MAX_HP / HP_PER_YUANBAO; // 9
    const alivePips = Math.ceil(hud.hp / HP_PER_YUANBAO);
    const pipW = 14;
    const pipGap = 3;
    const rowW = totalPips * pipW + (totalPips - 1) * pipGap;
    const rowX = screenW - 16 - rowW;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("LIVES · 铜元宝", screenW - 16, y - 6);
    for (let i = 0; i < totalPips; i++) {
      const px = rowX + i * (pipW + pipGap);
      const alive = i < alivePips;
      this.drawYuanbao(ctx, px + pipW / 2, y + 14, pipW, alive);
    }
    // 数字
    ctx.font = `700 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = hud.hp <= HP_PER_YUANBAO ? Theme.colors.warn.DEFAULT : "#FFD666";
    ctx.shadowColor = withAlpha(ctx.fillStyle as string, 0.4);
    ctx.shadowBlur = 6;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${hud.hp}/${hud.maxHp}`, screenW - 16, y + 30);
    ctx.shadowBlur = 0;
    // 国家反诈APP 护盾提示
    if (hud.appCharges > 0) {
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(`🛡 反诈APP ×${hud.appCharges}`, screenW - 16, y + 48);
    }
    ctx.restore();
  }

  /** 绘制铜元宝（船型元宝），alive=亮铜色，否则暗 */
  private drawYuanbao(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, alive: boolean): void {
    const hw = w / 2;
    const h = w * 0.62;
    ctx.save();
    ctx.translate(cx, cy);
    if (alive) {
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 5;
    }
    // 元宝主体（船型）
    ctx.beginPath();
    ctx.moveTo(-hw, h * 0.15);
    ctx.quadraticCurveTo(-hw, -h * 0.5, -hw * 0.45, -h * 0.35);
    ctx.quadraticCurveTo(0, -h * 0.15, hw * 0.45, -h * 0.35);
    ctx.quadraticCurveTo(hw, -h * 0.5, hw, h * 0.15);
    ctx.quadraticCurveTo(hw * 0.5, h * 0.45, 0, h * 0.32);
    ctx.quadraticCurveTo(-hw * 0.5, h * 0.45, -hw, h * 0.15);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.45);
    if (alive) {
      grad.addColorStop(0, "#FFE9A0");
      grad.addColorStop(0.5, "#E8A93A");
      grad.addColorStop(1, "#9C5B12");
    } else {
      grad.addColorStop(0, "#4A4030");
      grad.addColorStop(0.5, "#33291A");
      grad.addColorStop(1, "#1F1810");
    }
    ctx.fillStyle = grad;
    ctx.fill();
    // 顶部小圆凸起（元宝口）
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.05, hw * 0.32, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = alive ? "rgba(255,233,160,0.85)" : "rgba(80,70,55,0.6)";
    ctx.fill();
    if (alive) {
      ctx.strokeStyle = "#FFD666";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const bombBtn = this.getBombButtonRect(screenW, screenH);

    // 分支选择阶段：优先处理 3 个选项卡片点击，屏蔽其他游戏交互
    if (this.hud && this.hud.phase === "branch" && this.hud.branchOptions) {
      if (type === "start") {
        for (let i = 0; i < this.hud.branchOptions.length; i++) {
          if (hitTest(x, y, this.getBranchOptionRect(i, screenW, screenH))) {
            this.pressedBranchIdx = i;
            return true;
          }
        }
        return true; // 分支阶段消费所有 touch，避免误触发飞船拖拽
      } else if (type === "end") {
        if (this.pressedBranchIdx !== null) {
          const idx = this.pressedBranchIdx;
          const rect = this.getBranchOptionRect(idx, screenW, screenH);
          if (hitTest(x, y, rect)) {
            const opt = this.hud.branchOptions[idx];
            this.engine?.chooseBranch(opt.id);
            playSfx("click");
            vibrateShort();
          }
          this.pressedBranchIdx = null;
        }
        return true;
      }
      return true;
    }

    if (type === "start") {
      if (hitTest(x, y, bombBtn)) {
        this.pressedBomb = true;
        return true; // 消费 touch，防止 InputManager 拖拽
      }
      return false; // 未命中按钮，交给引擎 InputManager 处理拖拽
    } else if (type === "end") {
      if (this.pressedBomb && hitTest(x, y, bombBtn)) {
        this.engine?.useBomb();
        playSfx("click");
        vibrateShort();
      }
      this.pressedBomb = false;
      return true;
    }
    return false;
  }

  exit(): void {
    super.exit();
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.engineCanvas = null;
    this.resultOverlay = null;
  }
}
