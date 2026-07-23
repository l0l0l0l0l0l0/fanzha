/**
 * 「反诈职业经理人」战斗阶段
 * 引擎画布 960×540 横屏，进入时 setOrientation("landscape")
 * Scene 负责大招按钮 + 重新部署 + 模式 HUD（BOSS 血条/限时倒计时/无尽波数） + 结算
 * v3：连击 HUD / 元素克制提示 / BOSS 阶段 / 每日挑战 / 探员独有大招 / 持久化
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawButton, drawProgressBar, drawToast, drawNeonCorners, hitTest, type Rect } from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { ManagerEngine } from "@/games/manager/engine";
import type { ManagerHud, DeploySlot, ManagerMode, AgentUpgradeKind } from "@/games/manager/types";
import { MODE_META } from "@/games/manager/data";
import type { MazeDef } from "@/games/manager/maze";
import { roundRect } from "@/engine/Renderer";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { ManagerDeployScene } from "./ManagerDeployScene";
import { HubScene } from "./HubScene";
import { platformStore } from "@/store/platformStore";
import type { GameEvent, GameResultPayload } from "@/types";

export class ManagerBattleScene extends GameShellScene {
  private engine: ManagerEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private deployment: DeploySlot[] = [];
  private mode: ManagerMode = "classic";
  /** v4：部署阶段传入的迷宫（与玩家岗哨位布局一致） */
  private maze: MazeDef | null = null;
  private hud: ManagerHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedUlt = false;
  private pressedRedeploy = false;
  private pressedUpgradeIdx: number | null = null;
  private t = 0;
  private pulse = 0;

  getGameTitle(): string { return "反诈职业经理人"; }
  getGameSubtitle(): string { return "MANAGER"; }
  getAccent(): string {
    return MODE_META[this.mode]?.accent ?? Theme.accents.manager;
  }

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    this.deployment = (params?.deployment as DeploySlot[]) ?? [];
    this.mode = (params?.mode as ManagerMode) ?? "classic";
    this.maze = (params?.maze as MazeDef | undefined) ?? null;
    setOrientation("landscape");
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new ManagerEngine(canvas, this.deployment, this.mode, this.maze ?? undefined);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    // 由 updateGame/renderGame 同步驱动，消除双 RAF 撕裂闪烁
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      this.hud = e.payload as unknown as ManagerHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 3 };
      this.toastTimer = 0;
    } else if (e.type === "result") {
      this.onResult(e.payload);
    }
  }

  private onResult(result: GameResultPayload): void {
    // v3：记录经理人模块进度
    if (this.engine) {
      const progress = this.engine.getProgressData();
      const isDailyWin = this.mode === "daily" && result.win;
      platformStore.recordManagerGame({
        mode: progress.mode,
        score: progress.score,
        win: progress.win,
        level: progress.level,
        wave: progress.wave,
        killsByAgent: progress.killsByAgent,
        bossKills: progress.bossKills,
        dailyCompleted: isDailyWin,
      });
    }
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
    this.pressedUlt = false;
    this.pressedRedeploy = false;
    this.pressedUpgradeIdx = null;
    this.spawnEngine();
  }

  protected updateGame(dt: number): void {
    // 同步驱动引擎 update（与场景同帧，杜绝撕裂）
    this.engine?.stepUpdate(dt);
    this.t += dt;
    this.pulse += dt;
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 3) this.toast = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  private getUltButtonRect(screenW: number, screenH: number): Rect {
    return { x: screenW - 16 - 110, y: screenH - 24 - 56 - 12, w: 110, h: 56 };
  }

  private getRedeployButtonRect(screenW: number, screenH: number): Rect {
    return { x: 16, y: screenH - 24 - 56 - 12, w: 84, h: 56 };
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.engineCanvas && this.engine) {
      // 同步驱动引擎渲染，确保 engineCanvas 在 blit 前已完成本帧绘制
      this.engine.stepRender();
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // 顶部状态
    if (this.hud) {
      this.renderStats(ctx, screenW);
      // v3：连击 HUD（能量条下方，右对齐）
      this.drawComboHud(ctx, screenW, this.hud);
      // v3：元素克制提示（屏幕中央偏上，短暂浮动）
      this.drawElementalHint(ctx, screenW, this.hud);
    }

    // 大招按钮（v3：显示探员大招名 + emoji 副标题 + 描述）
    const ultBtn = this.getUltButtonRect(screenW, screenH);
    const ultReady = this.hud?.ultReady ?? false;
    const ultName = this.hud?.ultName;
    const ultEmoji = this.hud?.ultEmoji ?? "";
    const ultMainText = ultReady ? (ultName ?? "大招") : "能量蓄积中";
    drawButton(ctx, ultBtn.x, ultBtn.y, ultBtn.w, ultBtn.h, ultMainText, {
      variant: ultReady ? "primary" : "ghost",
      accent: this.getAccent(),
      pressed: this.pressedUlt,
      subText: `${ultEmoji} 大招`,
      fontSize: 13,
    });
    if (ultReady) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 4);
      ctx.strokeStyle = withAlpha(this.getAccent(), pulse);
      ctx.lineWidth = 2;
      ctx.shadowColor = this.getAccent();
      ctx.shadowBlur = 12;
      ctx.strokeRect(ultBtn.x, ultBtn.y, ultBtn.w, ultBtn.h);
      ctx.restore();
    }
    // v3：大招描述（按钮下方一行小字，截断 20 字）
    if (this.hud?.ultDesc) {
      const desc = this.hud.ultDesc.length > 20 ? this.hud.ultDesc.slice(0, 20) + "…" : this.hud.ultDesc;
      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(this.getAccent(), 0.6);
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(desc, ultBtn.x + ultBtn.w, ultBtn.y + ultBtn.h + 2);
      ctx.restore();
    }

    // 重新部署按钮
    const redeployBtn = this.getRedeployButtonRect(screenW, screenH);
    drawButton(ctx, redeployBtn.x, redeployBtn.y, redeployBtn.w, redeployBtn.h, "重部署", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedRedeploy,
    });
    drawIcon(ctx, "rotate", redeployBtn.x + redeployBtn.w - 16, redeployBtn.y + 6, 12, Theme.colors.ink.muted);

    // Toast
    if (this.toast) {
      const tw = screenW - 32;
      const th = 48;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "指挥通讯");
    }

    // 探员升级阶段 overlay（最上层）
    if (this.hud && this.hud.phase === "upgrade" && this.hud.upgradeChoices) {
      this.renderUpgradeChoice(ctx, screenW, screenH);
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  /** 探员升级选择 overlay：3 个可点击选项卡片 */
  private renderUpgradeChoice(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const choices = hud.upgradeChoices!;
    // 全屏暗化遮罩
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.82)";
    ctx.fillRect(0, 0, screenW, screenH);
    // 顶部标题
    const titleY = screenH * 0.18;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 10;
    ctx.fillText("资源强化 · 击杀获取资源升级守卫", screenW / 2, titleY - 22);
    ctx.shadowBlur = 0;
    ctx.font = `900 22px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 16;
    ctx.fillText(`选择第 ${hud.upgradeCount + 1}/${hud.upgradeMax} 次强化`, screenW / 2, titleY + 6);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("击杀敌人积累资源 · 三选一全局强化（永久作用于所有探员）", screenW / 2, titleY + 28);

    // 3 个卡片横向排列（横屏布局）
    const cardW = Math.min(220, (screenW - 80) / 3);
    const cardH = 160;
    const gap = 16;
    const totalW = cardW * 3 + gap * 2;
    const startX = (screenW - totalW) / 2;
    const startY = (screenH - cardH) / 2 + 30;
    for (let i = 0; i < choices.length; i++) {
      const opt = choices[i];
      const rect = this.getUpgradeChoiceRect(i, screenW);
      const pressed = this.pressedUpgradeIdx === i;
      // 卡片背景
      ctx.fillStyle = pressed ? withAlpha(opt.color, 0.22) : "rgba(20, 36, 58, 0.92)";
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
      ctx.fill();
      // 边框
      ctx.strokeStyle = opt.color;
      ctx.lineWidth = pressed ? 2 : 1;
      ctx.shadowColor = opt.color;
      ctx.shadowBlur = pressed ? 16 : 8;
      roundRect(ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 四角括号
      drawNeonCorners(ctx, rect.x, rect.y, rect.w, rect.h, opt.color, 12, 3, 6);
      // emoji 大图
      ctx.font = "44px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opt.emoji, rect.x + rect.w / 2, rect.y + 44);
      // 标题
      ctx.font = `700 16px ${Theme.fonts.body}`;
      ctx.fillStyle = opt.color;
      ctx.shadowColor = opt.color;
      ctx.shadowBlur = 6;
      ctx.fillText(opt.title, rect.x + rect.w / 2, rect.y + 88);
      ctx.shadowBlur = 0;
      // 描述
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.fillText(opt.desc, rect.x + rect.w / 2, rect.y + 112);
      // 序号
      ctx.font = `900 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(opt.color, 0.6);
      ctx.fillText(`0${i + 1}`, rect.x + rect.w / 2, rect.y + rect.h - 14);
    }
    ctx.restore();
  }

  /** 升级选项矩形（横屏 3 列） */
  private getUpgradeChoiceRect(idx: number, screenW: number): Rect {
    const cardW = Math.min(220, (screenW - 80) / 3);
    const cardH = 160;
    const gap = 16;
    const totalW = cardW * 3 + gap * 2;
    const startX = (screenW - totalW) / 2;
    const screenH = this.director.screenHeight;
    const startY = (screenH - cardH) / 2 + 30;
    const x = startX + idx * (cardW + gap);
    return { x, y: startY, w: cardW, h: cardH };
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 52;
    ctx.save();
    // 基地 HP
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("基地", 16, y);
    drawProgressBar(ctx, 16, y + 14, 120, 10, hud.baseHp / hud.baseMax,
      hud.baseHp / hud.baseMax < 0.3 ? Theme.colors.warn.DEFAULT : Theme.colors.safe.DEFAULT);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${hud.baseHp}/${hud.baseMax}`, 142, y + 14);

    // v3：每日挑战 HUD（基地 HP 下方，左上角垂直徽章）
    const dailyActive = hud.mode === "daily" && !!hud.dailyModifiers;
    if (dailyActive) {
      this.drawDailyHud(ctx, screenW, hud, y);
    }

    // 中央：根据模式显示不同内容
    ctx.textAlign = "center";
    if (hud.mode === "bossRush") {
      // BOSSrush：显示当前 BOSS 血条
      this.drawBossHud(ctx, screenW, hud, y);
    } else if (hud.mode === "timeTrial") {
      // 限时挑战：显示倒计时
      this.drawTimeTrialHud(ctx, screenW, hud, y);
    } else if (hud.mode === "endlessRush") {
      // 无尽 Rush：显示绝对波数与 TIER
      this.drawEndlessHud(ctx, screenW, hud, y);
    } else {
      // 经典：波次进度
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("WAVE", screenW / 2, y);
      ctx.font = `700 16px ${Theme.fonts.mono}`;
      ctx.fillStyle = this.getAccent();
      ctx.shadowColor = withAlpha(this.getAccent(), 0.4);
      ctx.shadowBlur = 8;
      ctx.fillText(`${hud.wave}/${hud.totalWaves}`, screenW / 2, y + 14);
      ctx.shadowBlur = 0;
      // v3：波次预警（来袭警告）
      if (hud.waveProgress < 0.3) {
        const blink = Math.sin(this.pulse * 6) > 0 ? 1 : 0.25;
        ctx.font = `700 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = withAlpha("#E5353B", blink);
        ctx.shadowColor = "#E5353B";
        ctx.shadowBlur = 6;
        ctx.fillText("⚠ 敌人来袭", screenW / 2, y + 30);
        ctx.shadowBlur = 0;
      }
    }

    // 能量
    ctx.textAlign = "right";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("能量", screenW - 16, y);
    drawProgressBar(ctx, screenW - 136, y + 14, 120, 10, hud.energy / 100, this.getAccent());
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = hud.ultReady ? this.getAccent() : Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText(`${Math.floor(hud.energy)}%`, screenW - 16, y + 26);

    // 分数（左下角小字；每日模式下移至每日徽章下方）
    const scoreY = dailyActive ? y + 94 : y + 28;
    ctx.textAlign = "left";
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`SCORE ${hud.score} · 敌 ${hud.enemiesLeft}`, 16, scoreY);
    // 模式标签（右下角小字）
    ctx.textAlign = "right";
    ctx.fillStyle = withAlpha(this.getAccent(), 0.7);
    ctx.fillText(hud.modeLabel, screenW - 16, y + 28);

    // 探员资源条（底部中央，仅未达上限时显示）
    if (hud.upgradeCount < hud.upgradeMax) {
      const xpW = 200;
      const xpX = (screenW - xpW) / 2;
      const xpY = y + 44;
      const xpH = 6;
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = hud.upgradeReady ? "#FFD666" : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(
        hud.upgradeReady
          ? `✨ 升级就绪 ${hud.upgradeCount}/${hud.upgradeMax}`
          : `资源 ${hud.upgradeXp}/${hud.upgradeXpMax} · LV ${hud.upgradeCount}/${hud.upgradeMax}`,
        screenW / 2, xpY - 12,
      );
      // 资源条背景
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, xpX, xpY, xpW, xpH, 3);
      ctx.fill();
      // 资源进度
      const xpRatio = hud.upgradeReady ? 1 : Math.min(1, hud.upgradeXp / hud.upgradeXpMax);
      const xpColor = hud.upgradeReady ? "#FFD666" : "#B388FF";
      ctx.fillStyle = xpColor;
      ctx.shadowColor = xpColor;
      ctx.shadowBlur = hud.upgradeReady ? 10 + Math.sin(this.pulse * 6) * 4 : 4;
      roundRect(ctx, xpX, xpY, xpW * xpRatio, xpH, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // 已达升级上限
      ctx.font = `900 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 6;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`★ 守卫满级 LV${hud.upgradeMax}`, screenW / 2, y + 42);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /** BOSSrush 模式：当前 BOSS 血条 + 名称 + 进度 */
  private drawBossHud(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud, y: number): void {
    const barW = 220;
    const barX = (screenW - barW) / 2;
    // 上方：BOSS 进度
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = hud.bossEnraged ? "#E5353B" : "#FFB020";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = hud.bossEnraged ? "#E5353B" : "#FFB020";
    ctx.shadowBlur = 6;
    ctx.fillText(`BOSS RUSH · ${hud.bossIdx! + 1}/${hud.bossTotal}`, screenW / 2, y - 2);
    ctx.shadowBlur = 0;
    // BOSS 名称 + emoji
    if (hud.bossName) {
      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = "#FFD666";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 8;
      const emoji = hud.bossEmoji ?? "";
      const enragedTag = hud.bossEnraged ? "  ⚠ 狂暴" : "";
      ctx.fillText(`${emoji} ${hud.bossName}${enragedTag}`, screenW / 2, y + 12);
      ctx.shadowBlur = 0;
    } else {
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("下一 BOSS 来袭…", screenW / 2, y + 12);
    }
    // BOSS 血条
    const barY = y + 28;
    const barH = 8;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fill();
    if (hud.bossHp !== undefined && hud.bossMaxHp) {
      const ratio = Math.max(0, hud.bossHp / hud.bossMaxHp);
      const color = hud.bossEnraged ? "#E5353B" : ratio > 0.5 ? "#FFB020" : "#FF7AB8";
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      roundRect(ctx, barX, barY, barW * ratio, barH, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 边框
      ctx.strokeStyle = "#FFD666";
      ctx.lineWidth = 1;
      roundRect(ctx, barX, barY, barW, barH, 4);
      ctx.stroke();
    }
    // 技能
    if (hud.bossSkill) {
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.fillText(`技能：${hud.bossSkill}`, screenW / 2, barY + barH + 2);
    }
    // v3：BOSS 阶段 HUD（血条下方）
    this.drawBossPhaseHud(ctx, screenW, 0, hud, y);
  }

  /** v3：BOSS 三阶段提示（血条下方：阶段名 + 3 阶段进度点） */
  private drawBossPhaseHud(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number, hud: ManagerHud, baseY: number): void {
    if (hud.mode !== "bossRush" || !hud.bossName) return;
    const phaseY = baseY + 50;
    const phaseIdx = hud.bossPhaseIdx ?? 0;
    // 阶段名（警告色 + 脉冲发光）
    if (hud.bossPhaseName) {
      const pulse = 0.6 + 0.4 * Math.sin(this.pulse * 6);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#E5353B";
      ctx.shadowColor = "#E5353B";
      ctx.shadowBlur = 6 + 8 * pulse;
      ctx.globalAlpha = 0.7 + 0.3 * pulse;
      ctx.fillText(`⚡ ${hud.bossPhaseName}`, screenW / 2, phaseY);
      ctx.restore();
    }
    // 3 阶段进度点
    const dotR = 3;
    const gap = 10;
    const totalW = 3 * dotR * 2 + 2 * gap;
    const startX = screenW / 2 - totalW / 2 + dotR;
    const dotY = phaseY + 20;
    for (let i = 0; i < 3; i++) {
      const cx = startX + i * (dotR * 2 + gap);
      const isPast = i < phaseIdx;
      const isCurrent = i === phaseIdx;
      ctx.save();
      if (isPast) {
        ctx.fillStyle = "#E5353B";
        ctx.shadowColor = "#E5353B";
        ctx.shadowBlur = 4;
      } else if (isCurrent) {
        const blink = Math.sin(this.pulse * 8) > 0 ? 1 : 0.25;
        ctx.fillStyle = withAlpha("#E5353B", blink);
        ctx.shadowColor = "#E5353B";
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = Theme.colors.ink.dim;
      }
      ctx.beginPath();
      ctx.arc(cx, dotY, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** v3：连击 HUD（能量条下方约 20px，右对齐，脉冲发光） */
  private drawComboHud(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud): void {
    if (!hud.comboActive) return;
    const count = hud.comboCount ?? 0;
    const mul = hud.comboMul ?? 1;
    const max = hud.comboMax ?? 0;
    const x = screenW - 16;
    // 能量条 y+14（=66），高 10，结束 76；下方约 20px → y=96
    const y = 96;
    const color = count >= 10 ? "#FF7A1A" : "#FFD666";
    const pulseBlur = 6 + 8 * (0.5 + 0.5 * Math.sin(this.pulse * 6));
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.font = `900 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = pulseBlur;
    ctx.fillText(`${count} COMBO ×${mul.toFixed(1)}`, x, y);
    ctx.shadowBlur = 0;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(color, 0.7);
    ctx.fillText(`MAX ${max}`, x, y + 20);
    ctx.restore();
  }

  /** v3：元素克制提示（屏幕中央偏上 y=70，短暂浮动 + 淡出） */
  private drawElementalHint(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud): void {
    const hint = hud.lastElementalHint;
    if (!hint) return;
    const age = this.t - hint.at;
    if (age < 0 || age >= 1) return;
    const alpha = Math.max(0, 1 - age);
    const yBase = 70;
    const yOff = -10 * Math.sin(this.t * 4);
    const text = hint.kind === "strong"
      ? `⚡ 强效！${hint.from} → ${hint.from}克制${hint.to}`
      : `▽ 弱效 ${hint.to} → ${hint.to}克制${hint.from}`;
    const color = hint.kind === "strong" ? "#1AD670" : "#E5353B";
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 14px ${Theme.fonts.body}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(text, screenW / 2, yBase + yOff);
    ctx.restore();
  }

  /** v3：每日挑战 HUD（左上角，基地 HP 下方，垂直 3 修饰符徽章） */
  private drawDailyHud(ctx: CanvasRenderingContext2D, _screenW: number, hud: ManagerHud, baseY: number): void {
    if (hud.mode !== "daily" || !hud.dailyModifiers) return;
    const mods = hud.dailyModifiers;
    const x = 16;
    const y0 = baseY + 28; // 基地 HP 条下方
    ctx.save();
    // 顶部标题
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 4;
    ctx.fillText(`DAILY · ${hud.dailySeed ?? ""}`, x, y0);
    ctx.shadowBlur = 0;
    // 3 个修饰符徽章（垂直排列）
    const badgeX = x;
    const badgeW = 130;
    const badgeH = 14;
    const gap = 3;
    for (let i = 0; i < mods.length && i < 3; i++) {
      const m = mods[i];
      const by = y0 + 14 + i * (badgeH + gap);
      // 背景
      ctx.fillStyle = withAlpha(m.color, 0.15);
      roundRect(ctx, badgeX, by, badgeW, badgeH, 3);
      ctx.fill();
      // 边框
      ctx.strokeStyle = withAlpha(m.color, 0.6);
      ctx.lineWidth = 1;
      roundRect(ctx, badgeX + 0.5, by + 0.5, badgeW - 1, badgeH - 1, 3);
      ctx.stroke();
      // emoji
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(m.emoji, badgeX + 6, by + badgeH / 2);
      // 名称（缩写 4 字）
      const shortName = m.name.length > 4 ? m.name.slice(0, 4) : m.name;
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = m.color;
      ctx.fillText(shortName, badgeX + 22, by + badgeH / 2);
    }
    ctx.restore();
  }

  /** 限时挑战：大倒计时 */
  private drawTimeTrialHud(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud, y: number): void {
    const sec = hud.timeLeft ?? 0;
    const low = sec < 10;
    const pulse = low ? 0.7 + 0.3 * Math.sin(this.pulse * 8) : 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("TIME TRIAL · 限时挑战", screenW / 2, y - 2);
    ctx.font = `900 ${Math.round(20 * pulse)}px ${Theme.fonts.mono}`;
    ctx.fillStyle = low ? "#E5353B" : this.getAccent();
    ctx.shadowColor = low ? "#E5353B" : this.getAccent();
    ctx.shadowBlur = low ? 14 : 8;
    ctx.fillText(`${sec.toFixed(1)}s`, screenW / 2, y + 12);
    ctx.shadowBlur = 0;
    // 进度条
    const barW = 160;
    const barX = (screenW - barW) / 2;
    const barY = y + 36;
    const barH = 6;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();
    const ratio = Math.max(0, Math.min(1, sec / 60));
    const color = sec < 10 ? "#E5353B" : sec < 30 ? "#FFD666" : this.getAccent();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    roundRect(ctx, barX, barY, barW * ratio, barH, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /** 无尽 Rush：绝对波数 + TIER */
  private drawEndlessHud(ctx: CanvasRenderingContext2D, screenW: number, hud: ManagerHud, y: number): void {
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#B388FF";
    ctx.shadowColor = "#B388FF";
    ctx.shadowBlur = 6;
    ctx.fillText(`ENDLESS RUSH · TIER ${hud.rushTier}`, screenW / 2, y - 2);
    ctx.shadowBlur = 0;
    ctx.font = `900 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#B388FF";
    ctx.shadowColor = "#B388FF";
    ctx.shadowBlur = 10;
    ctx.fillText(`WAVE ${hud.endlessWave}`, screenW / 2, y + 12);
    ctx.shadowBlur = 0;
    // TIER 进度（每 3 波升一级）
    const tierWave = (hud.endlessWave ?? 1) % 3;
    const barW = 120;
    const barX = (screenW - barW) / 2;
    const barY = y + 36;
    const barH = 5;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, barX, barY, barW, barH, 2.5);
    ctx.fill();
    ctx.fillStyle = "#B388FF";
    roundRect(ctx, barX, barY, barW * (tierWave / 3), barH, 2.5);
    ctx.fill();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const ultBtn = this.getUltButtonRect(screenW, screenH);
    const redeployBtn = this.getRedeployButtonRect(screenW, screenH);

    // 探员升级阶段：优先处理 3 个选项卡片点击，屏蔽其他游戏交互
    if (this.hud && this.hud.phase === "upgrade" && this.hud.upgradeChoices) {
      if (type === "start") {
        for (let i = 0; i < this.hud.upgradeChoices.length; i++) {
          if (hitTest(x, y, this.getUpgradeChoiceRect(i, screenW))) {
            this.pressedUpgradeIdx = i;
            return true;
          }
        }
        return true; // 升级阶段消费所有 touch
      } else if (type === "end") {
        if (this.pressedUpgradeIdx !== null) {
          const idx = this.pressedUpgradeIdx;
          const rect = this.getUpgradeChoiceRect(idx, screenW);
          if (hitTest(x, y, rect)) {
            const choice = this.hud.upgradeChoices[idx];
            this.engine?.chooseUpgrade(choice.id as AgentUpgradeKind);
            playSfx("click");
            vibrateShort();
          }
          this.pressedUpgradeIdx = null;
        }
        return true;
      }
      return true;
    }

    if (type === "start") {
      if (hitTest(x, y, ultBtn)) { this.pressedUlt = true; return true; }
      if (hitTest(x, y, redeployBtn)) { this.pressedRedeploy = true; return true; }
      return false;
    } else if (type === "end") {
      if (this.pressedUlt && hitTest(x, y, ultBtn)) {
        this.engine?.triggerUlt();
        playSfx("click");
        vibrateShort();
      } else if (this.pressedRedeploy && hitTest(x, y, redeployBtn)) {
        playSfx("click");
        setOrientation("portrait");
        this.director.replace(new ManagerDeployScene(this.director));
      }
      this.pressedUlt = false;
      this.pressedRedeploy = false;
      return true;
    }
    return false;
  }

  exit(): void {
    super.exit();
    setOrientation("portrait");
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.engineCanvas = null;
    this.resultOverlay = null;
  }
}
