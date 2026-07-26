/**
 * 「诈园区」战斗场景（薄壳）
 * 引擎画布 960×540 横屏，引擎 InputManager 处理道具栏点击
 * 场景层叠加：天气徽章 / 撤退按钮 / 波次开场简报 / Boss 击破科普卡片
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawToast, drawModalOverlay, drawPanel, drawButton, hitTest, type Rect } from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { BombIslandEngine } from "@/games/bombIsland/engine";
import type { ParkHud, SpecialSkillKind, ModuleType } from "@/games/bombIsland/types";
import { setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import { playSfx } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import { roundRect } from "@/engine/Renderer";
import type {
  GameEvent, GameResultPayload,
  BossCodexPayload, WaveBriefingPayload,
} from "@/types";

export class BombIslandBattleScene extends GameShellScene {
  private engine: BombIslandEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private hud: ParkHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private t = 0;
  private pulse = 0;

  // 撤退按钮
  private pressedRetreat = false;
  private confirmRetreat = false;
  private pressedConfirmRetreatBtn: string | null = null;

  // Boss 击破科普卡片
  private bossCodex: { payload: BossCodexPayload; remain: number; enterT: number } | null = null;

  // 波次开场简报
  private waveBriefing: { payload: WaveBriefingPayload; remain: number; enterT: number } | null = null;

  // 最近一次结算结果（用于结算页额外统计渲染）
  private lastResult: GameResultPayload | null = null;

  private static readonly RETREAT_BTN_W = 96;
  private static readonly RETREAT_BTN_H = 28;
  private static readonly BOSS_CODEX_DURATION = 6.0; // 秒
  private static readonly WAVE_BRIEFING_DURATION = 4.0; // 秒

  /** v4 模块类型 → emoji 映射（结算页战报用） */
  private static readonly MODULE_EMOJI: Record<ModuleType, string> = {
    antenna: "📡", floor: "🖥", server: "🗄", dorm: "🛏", fortress: "🏰",
    wall: "🚧", foundation: "🧱", shock: "⚡", cage: "🔒", cell: "🚪", guard: "🛡",
  };
  /** v4 模块类型 → 中文名映射（结算页战报用） */
  private static readonly MODULE_LABEL: Record<ModuleType, string> = {
    antenna: "信号塔", floor: "工位", server: "服务器", dorm: "宿舍", fortress: "碉堡",
    wall: "铁丝网", foundation: "地基", shock: "电击室", cage: "铁笼", cell: "小黑屋", guard: "武装",
  };

  getGameTitle(): string { return "诈园区"; }
  getGameSubtitle(): string { return "SCAM PARK"; }
  getAccent(): string { return Theme.accents["bomb-island"]; }

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    setOrientation("landscape");
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new BombIslandEngine(canvas);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    // 由 updateGame/renderGame 同步驱动，消除双 RAF 撕裂闪烁
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      this.hud = e.payload as unknown as ParkHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 3 };
      this.toastTimer = 0;
    } else if (e.type === "result") {
      this.onResult(e.payload);
    } else if (e.type === "bossCodex") {
      // Boss 击破科普：弹出卡片，自动消失或点击关闭
      this.bossCodex = {
        payload: e.payload,
        remain: BombIslandBattleScene.BOSS_CODEX_DURATION,
        enterT: 0,
      };
      postFX.flash("#52C41A", 0.3, 3);
    } else if (e.type === "waveBriefing") {
      // 波次开场简报：顶部横幅 4 秒
      this.waveBriefing = {
        payload: e.payload,
        remain: BombIslandBattleScene.WAVE_BRIEFING_DURATION,
        enterT: 0,
      };
    }
  }

  private onResult(result: GameResultPayload): void {
    this.lastResult = result;
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director)),
      renderExtraStats: (ctx, x, y, w) => this.renderExtraStats(ctx, x, y, w),
    });
  }

  /** 结算页额外统计：诈园区专属战报数据（含 v4 模块拆除战报） */
  private renderExtraStats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): number {
    const stats = this.lastResult?.stats as
      | { clearedWaves?: number; totalDamage?: number; maxDps?: number; weaponLevel?: number;
          moduleKillCount?: number; moduleKillStats?: Partial<Record<ModuleType, number>>; }
      | undefined;
    if (!stats) return 0;
    const hasModuleStats = (stats.moduleKillCount ?? 0) > 0;
    const h = hasModuleStats ? 96 : 56;
    ctx.save();
    ctx.fillStyle = "rgba(255, 122, 26, 0.06)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#FF7A1A";
    ctx.fillRect(x, y, 3, h);
    ctx.restore();
    const colW = (w - 8) / 4;
    const items = [
      { label: "击破园区", value: `${stats.clearedWaves ?? 0}`, color: "#52C41A" },
      { label: "累计伤害", value: this.formatNum(stats.totalDamage ?? 0), color: "#FFD666" },
      { label: "最高 DPS", value: this.formatNum(stats.maxDps ?? 0), color: "#00E5FF" },
      { label: "武器等级", value: `LV${stats.weaponLevel ?? 1}`, color: "#FF7A1A" },
    ];
    for (let i = 0; i < items.length; i++) {
      const cx = x + 8 + i * colW;
      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(items[i].label, cx, y + 10);
      ctx.font = `700 14px ${Theme.fonts.mono}`;
      ctx.fillStyle = items[i].color;
      ctx.shadowColor = items[i].color;
      ctx.shadowBlur = 4;
      ctx.fillText(items[i].value, cx, y + 26);
      ctx.restore();
    }
    // v4：模块拆除战报行（显示主要拆除的模块类型及数量，按数量降序取前 5）
    if (hasModuleStats && stats.moduleKillStats) {
      const rowY = y + 56;
      ctx.save();
      // 分隔线
      ctx.fillStyle = "rgba(255, 122, 26, 0.2)";
      ctx.fillRect(x + 8, rowY, w - 16, 1);
      // 左侧标签
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`📊 拆模块战报 · 共 ${stats.moduleKillCount} 个`, x + 8, rowY + 6);
      // 右侧横向排列主要模块类型
      const entries = Object.entries(stats.moduleKillStats) as [ModuleType, number][];
      entries.sort((a, b) => b[1] - a[1]);
      const top = entries.slice(0, 5);
      const startX = x + 140;
      const itemW = (w - 16 - 140) / Math.max(1, top.length);
      for (let i = 0; i < top.length; i++) {
        const [mType, count] = top[i];
        const mx = startX + i * itemW;
        const emoji = BombIslandBattleScene.MODULE_EMOJI[mType] || "▪";
        const label = BombIslandBattleScene.MODULE_LABEL[mType] || mType;
        ctx.font = `400 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = withAlpha("#FFFFFF", 0.85);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`${emoji} ${label}×${count}`, mx, rowY + 6);
      }
      ctx.restore();
    }
    return h;
  }

  private formatNum(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${Math.round(n)}`;
  }

  private retry(): void {
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.bossCodex = null;
    this.waveBriefing = null;
    this.lastResult = null;
    this.confirmRetreat = false;
    this.pressedRetreat = false;
    this.pressedConfirmRetreatBtn = null;
    this.spawnEngine();
  }

  pause(): void {
    super.pause();
    this.engine?.pause();
  }
  resume(): void {
    super.resume();
    this.engine?.resume();
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
    // Boss 击破科普卡片计时
    if (this.bossCodex) {
      this.bossCodex.enterT = Math.min(1, this.bossCodex.enterT + dt * 4);
      this.bossCodex.remain -= dt;
      if (this.bossCodex.remain <= 0) this.bossCodex = null;
    }
    // 波次开场简报计时
    if (this.waveBriefing) {
      this.waveBriefing.enterT = Math.min(1, this.waveBriefing.enterT + dt * 4);
      this.waveBriefing.remain -= dt;
      if (this.waveBriefing.remain <= 0) this.waveBriefing = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 同步引擎暂停状态（覆盖用户按暂停按钮的场景）
    if (this.paused) this.engine?.pause();
    else this.engine?.resume();

    // 引擎画布 blit
    if (this.engineCanvas && this.engine) {
      // 同步驱动引擎渲染，确保 engineCanvas 在 blit 前已完成本帧绘制
      this.engine.stepRender();
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // v4：Boss 专属技能全屏视觉覆盖（在天气徽章之前，作为底层全屏特效）
    if (this.hud?.specialSkillKind) {
      this.renderSpecialSkillOverlay(ctx, screenW, screenH);
    }

    // 天气徽章（顶部中央）
    if (this.hud) {
      this.renderWeatherBadge(ctx, screenW);
    }

    // 撤退按钮（右上角，pause/sound 之下）
    this.renderRetreatButton(ctx, screenW);

    // 波次开场简报横幅
    if (this.waveBriefing) {
      this.renderWaveBriefing(ctx, screenW, screenH);
    }

    // Toast
    if (this.toast) {
      const tw = screenW - 32;
      const th = 48;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "炮兵通讯");
    }

    // Boss 击破科普卡片（覆盖层）
    if (this.bossCodex) {
      this.renderBossCodex(ctx, screenW, screenH);
    }

    // 撤退确认弹窗
    if (this.confirmRetreat) {
      this.renderRetreatConfirm(ctx, screenW, screenH);
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  /**
   * v4 Boss 专属技能全屏视觉覆盖
   * - cageTrap  铁笼困人：屏幕四边铁栏杆 + 顶部技能条
   * - shockJam  电击干扰：锯齿状电流纹路 + 中心闪光 + 顶部技能条
   * - deepfake  AI换脸：红蓝色相偏移重影 + 扫描线 + 顶部技能条
   */
  private renderSpecialSkillOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const hud = this.hud!;
    const kind = hud.specialSkillKind as SpecialSkillKind;
    const color = hud.specialSkillColor || "#FF5A2A";
    const remain = hud.specialSkillRemain || 0;
    const total = hud.specialSkillTotal || 1;
    const progress = Math.max(0, Math.min(1, remain / total));
    const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 8);

    ctx.save();

    // 半透明全屏着色遮罩（不阻挡视野，仅作氛围渲染）
    ctx.globalAlpha = 0.12 + pulse * 0.08;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.globalAlpha = 1;

    // 按 kind 渲染各自全屏特效
    if (kind === "cageTrap") {
      // 铁笼困人：屏幕左右两侧竖向铁栏杆
      const barCount = 14;
      const barW = 4;
      ctx.fillStyle = withAlpha(color, 0.75 + pulse * 0.25);
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      for (let i = 0; i < barCount; i++) {
        const y = (i / barCount) * screenH;
        // 左侧双列铁栏
        ctx.fillRect(0, y, 18, barW);
        ctx.fillRect(22, y, 4, barW);
        // 右侧双列铁栏
        ctx.fillRect(screenW - 22, y, 22, barW);
        ctx.fillRect(screenW - 26, y, 4, barW);
      }
      // 顶部底部横梁（固定上下两端封闭铁笼感）
      ctx.fillRect(0, 0, 26, barW);
      ctx.fillRect(0, screenH - barW, 26, barW);
      ctx.fillRect(screenW - 26, 0, 26, barW);
      ctx.fillRect(screenW - 26, screenH - barW, 26, barW);
      ctx.shadowBlur = 0;
    } else if (kind === "shockJam") {
      // 电击干扰：随机锯齿状电流线条
      ctx.strokeStyle = withAlpha(color, 0.6 + pulse * 0.4);
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      const lineCount = 6;
      for (let i = 0; i < lineCount; i++) {
        const seed = i * 100 + Math.floor(this.pulse * 12);
        const y = (seed * 37) % screenH;
        ctx.beginPath();
        let x = 0;
        let cy = y;
        ctx.moveTo(x, cy);
        while (x < screenW) {
          x += 20 + ((seed + x) % 30);
          cy += (((seed + x) % 40) - 20);
          ctx.lineTo(x, cy);
        }
        ctx.stroke();
      }
      // 中心闪光圆（模拟电击脉冲）
      const cx = screenW / 2, cy = screenH / 2;
      ctx.fillStyle = withAlpha(color, 0.2 * pulse);
      ctx.beginPath();
      ctx.arc(cx, cy, 80 + pulse * 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (kind === "deepfake") {
      // AI换脸：红蓝色相偏移重影（左右边缘）
      const offset = 3 + Math.round(pulse * 4);
      ctx.fillStyle = withAlpha("#FF0000", 0.28);
      ctx.fillRect(0, 0, offset, screenH);
      ctx.fillRect(screenW - offset, 0, offset, screenH);
      ctx.fillStyle = withAlpha("#00BFFF", 0.28);
      ctx.fillRect(offset, 0, offset, screenH);
      ctx.fillRect(screenW - offset * 2, 0, offset, screenH);
      // 顶部底部扫描线（模拟数字伪影）
      ctx.fillStyle = withAlpha(color, 0.3);
      const scanOffset = Math.floor(this.pulse * 20);
      for (let y = 0; y < screenH; y += 4) {
        if ((y + scanOffset) % 8 === 0) {
          ctx.fillRect(0, y, screenW, 1);
        }
      }
    }

    // 通用：顶部技能条（名称 + 倒计时进度条）
    const bannerW = 280;
    const bannerH = 36;
    const bx = (screenW - bannerW) / 2;
    const by = 56;
    ctx.fillStyle = "rgba(10, 25, 41, 0.92)";
    roundRect(ctx, bx, by, bannerW, bannerH, 6);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.8);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    roundRect(ctx, bx, by, bannerW, bannerH, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 左侧色条
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, 3, bannerH);
    // 技能名称
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.fillText(`⚠ ${hud.specialSkillName}`, bx + 12, by + bannerH / 2);
    ctx.shadowBlur = 0;
    // 倒计时进度条
    const barX = bx + 12;
    const barY = by + bannerH - 4;
    const barW2 = bannerW - 24;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(barX, barY, barW2, 2);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW2 * progress, 2);

    ctx.restore();
  }

  /** 天气徽章：顶部中央，显示当前天气与影响 */
  private renderWeatherBadge(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const w = 220;
    const h = 32;
    const x = (screenW - w) / 2;
    const y = 14;
    const color = hud.weatherColor;
    ctx.save();
    // 背景
    ctx.fillStyle = "rgba(15, 34, 54, 0.88)";
    ctx.fillRect(x, y, w, h);
    // 边框（脉冲）
    const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 + pulse * 6;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    // 左侧标签条
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3, h);
    // emoji
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(hud.weatherEmoji, x + 10, y + h / 2 + 1);
    // 名称
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.fillText(`天气 · ${hud.weatherName}`, x + 34, y + h / 2);
    ctx.shadowBlur = 0;
    // 描述
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#FFFFFF", 0.7);
    ctx.fillText(hud.weatherDesc, x + 100, y + h / 2 + 1);
    ctx.restore();
  }

  /** 撤退按钮：右上角，点击触发结算 */
  private renderRetreatButton(ctx: CanvasRenderingContext2D, screenW: number): void {
    if (this.resultOverlay) return; // 结算中隐藏
    const w = BombIslandBattleScene.RETREAT_BTN_W;
    const h = BombIslandBattleScene.RETREAT_BTN_H;
    const x = screenW - w - 12;
    const y = 48; // pause/sound 按钮（y=8,h=28）下方
    const accent = Theme.colors.warn.DEFAULT;
    drawButton(ctx, x, y, w, h, "撤退结算", {
      variant: "ghost", accent,
      pressed: this.pressedRetreat,
    });
    drawIcon(ctx, "flag", x + 8, y + h / 2 - 8, 12, accent);
  }

  private getRetreatButtonRect(screenW: number): Rect {
    return {
      x: screenW - BombIslandBattleScene.RETREAT_BTN_W - 12,
      y: 48,
      w: BombIslandBattleScene.RETREAT_BTN_W,
      h: BombIslandBattleScene.RETREAT_BTN_H,
    };
  }

  /** 撤退确认弹窗：避免误触 */
  private renderRetreatConfirm(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawModalOverlay(ctx, screenW, screenH);
    const w = Math.min(320, screenW - 32);
    const h = 200;
    const x = (screenW - w) / 2;
    const y = (screenH - h) / 2;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(Theme.colors.warn.DEFAULT, 0.6), cut: 10 });

    drawIcon(ctx, "flag", x + 16, y + 16, 18, Theme.colors.warn.DEFAULT);
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("撤退并结算本局？", x + 42, y + 18);
    ctx.restore();

    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("将按当前进度结算：得分、击破波次、最高连击", x + 16, y + 52);
    ctx.fillText("将写入排行榜并展示反诈锦囊。", x + 16, y + 70);
    ctx.restore();

    // 当前进度摘要
    if (this.hud) {
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.accents["bomb-island"];
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`波次 ${this.hud.wave} · 得分 ${this.hud.score} · 击破 ${this.hud.clearedWaves ?? 0} 波`, x + 16, y + 96);
      ctx.restore();
    }

    const btnW = (w - 32 - 8) / 2;
    const btnH = 34;
    const btnY = y + h - btnH - 16;
    drawButton(ctx, x + 16, btnY, btnW, btnH, "继续战斗", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedConfirmRetreatBtn === "cancel",
    });
    drawButton(ctx, x + 16 + btnW + 8, btnY, btnW, btnH, "确认撤退", {
      variant: "primary", accent: Theme.colors.warn.DEFAULT,
      pressed: this.pressedConfirmRetreatBtn === "confirm",
    });
  }

  /** 波次开场简报：顶部横幅，显示诈骗类型与识别要点 */
  private renderWaveBriefing(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const wb = this.waveBriefing!;
    const p = wb.payload;
    const enter = wb.enterT;
    // 退出阶段：最后 0.5s 淡出
    const fadeOut = wb.remain < 0.5 ? wb.remain / 0.5 : 1;
    const alpha = Math.min(enter, fadeOut);
    const w = Math.min(520, screenW - 32);
    const h = 96;
    const x = (screenW - w) / 2;
    const y = 56 + (1 - enter) * -20; // 从上方滑入
    const accent = Theme.accents["bomb-island"];

    ctx.save();
    ctx.globalAlpha = alpha;
    // 背景
    ctx.fillStyle = "rgba(10, 25, 41, 0.92)";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    // 边框
    ctx.strokeStyle = withAlpha(accent, 0.7);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 左侧色条
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 4, h);

    // 标题：园区档位 + 诈骗类型
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`波次简报 · WAVE ${p.wave} · ${p.tierName}园区`, x + 14, y + 10);

    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    ctx.fillText(p.scamType, x + 14, y + 24);
    ctx.shadowBlur = 0;

    // 识别要点（3 条横排）
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha("#FFFFFF", 0.85);
    const pointW = (w - 28) / Math.min(3, p.points.length);
    for (let i = 0; i < Math.min(3, p.points.length); i++) {
      const px = x + 14 + i * pointW;
      // 要点序号圆点
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(px + 4, y + 60, 3, 0, Math.PI * 2);
      ctx.fill();
      // 要点文本（限制宽度，超出截断）
      ctx.fillStyle = withAlpha("#FFFFFF", 0.85);
      const text = p.points[i];
      const maxW = pointW - 14;
      let display = text;
      if (ctx.measureText(text).width > maxW) {
        for (let j = text.length - 1; j > 0; j--) {
          display = text.slice(0, j) + "…";
          if (ctx.measureText(display).width <= maxW) break;
        }
      }
      ctx.fillText(display, px + 12, y + 56);
    }

    // 倒计时进度条
    const progress = wb.remain / BombIslandBattleScene.WAVE_BRIEFING_DURATION;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(x, y + h - 3, w, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + h - 3, w * progress, 3);
    ctx.restore();
  }

  /** Boss 击破科普卡片：覆盖层，展示反诈案例 */
  private renderBossCodex(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const bc = this.bossCodex!;
    const p = bc.payload;
    const enter = bc.enterT;
    const fadeOut = bc.remain < 0.6 ? bc.remain / 0.6 : 1;
    const alpha = Math.min(enter, fadeOut);
    const accent = "#52C41A";

    // 半透明遮罩（不全黑，让玩家仍能看到战场）
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    const w = Math.min(440, screenW - 32);
    const h = 320;
    const x = (screenW - w) / 2;
    const y = Math.max(8, (screenH - h) / 2 + (1 - enter) * 30);

    ctx.save();
    ctx.globalAlpha = alpha;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(accent, 0.7), cut: 10 });

    // 顶部渐变线
    const lg = ctx.createLinearGradient(x, y, x + w, y);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, accent);
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, 2);

    // 顶部标签
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`BOSS 击破 · ${p.tierName}园区`, x + w / 2, y + 12);

    // Boss 名称（带 emoji 风格）
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10 + Math.sin(this.pulse * 3) * 4;
    ctx.fillText(`✓ ${p.bossName} 已被击溃`, x + w / 2, y + 26);
    ctx.shadowBlur = 0;

    // 案例标题
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("【反诈案例】", x + 16, y + 58);

    ctx.font = `700 13px ${Theme.fonts.body}`;
    ctx.fillStyle = "#FFD666";
    ctx.fillText(p.title, x + 86, y + 58);

    // 案例正文（换行）
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
    const bodyLines = wrapText(ctx, p.body, w - 32);
    let lineY = y + 84;
    for (const line of bodyLines) {
      ctx.fillText(line, x + 16, lineY);
      lineY += 16;
    }

    // 识别要点
    lineY += 6;
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.fillText("识别要点：", x + 16, lineY);
    lineY += 18;
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha("#FFFFFF", 0.9);
    for (const pt of p.points) {
      // 要点标记
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x + 22, lineY + 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = withAlpha("#FFFFFF", 0.9);
      ctx.fillText(pt, x + 30, lineY);
      lineY += 16;
    }

    // 热线条码徽章
    const badgeY = y + h - 38;
    const hotlineColor = p.hotline === "12308" ? "#1B5FCC" : p.hotline === "110" ? "#E5353B" : "#FFD666";
    drawHotlineBadge(ctx, x + 16, badgeY, p.hotline, hotlineColor);
    drawHotlineBadge(ctx, x + 16 + 110, badgeY, "96110", "#E5353B");

    // 倒计时进度条 + 关闭提示
    const progress = bc.remain / BombIslandBattleScene.BOSS_CODEX_DURATION;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(x, y + h - 4, w, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + h - 4, w * progress, 3);

    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("点击空白处关闭", x + w - 12, y + h - 10);

    ctx.restore();
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    // 结算覆盖层优先
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }

    // 撤退确认弹窗
    if (this.confirmRetreat) {
      return this.handleRetreatConfirmTouch(type, x, y);
    }

    // Boss 击破科普卡片：点击任意位置关闭
    if (this.bossCodex && type === "end") {
      this.bossCodex.remain = Math.min(this.bossCodex.remain, 0.5);
      playSfx("click");
      return true;
    }

    // 撤退按钮
    const retreatRect = this.getRetreatButtonRect(this.director.screenWidth);
    if (type === "start") {
      if (hitTest(x, y, retreatRect)) {
        this.pressedRetreat = true;
        return true;
      }
    } else if (type === "end") {
      if (this.pressedRetreat && hitTest(x, y, retreatRect)) {
        this.pressedRetreat = false;
        this.confirmRetreat = true;
        playSfx("click");
        return true;
      }
      this.pressedRetreat = false;
    }

    // 无外壳级触摸处理 — 交给引擎 InputManager 处理道具栏点击
    return false;
  }

  private handleRetreatConfirmTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const w = Math.min(320, screenW - 32);
    const h = 200;
    const mx = (screenW - w) / 2;
    const my = (screenH - h) / 2;
    const btnW = (w - 32 - 8) / 2;
    const btnH = 34;
    const btnY = my + h - btnH - 16;
    const cancelRect: Rect = { x: mx + 16, y: btnY, w: btnW, h: btnH };
    const confirmRect: Rect = { x: mx + 16 + btnW + 8, y: btnY, w: btnW, h: btnH };

    if (type === "start") {
      if (hitTest(x, y, cancelRect)) { this.pressedConfirmRetreatBtn = "cancel"; return true; }
      if (hitTest(x, y, confirmRect)) { this.pressedConfirmRetreatBtn = "confirm"; return true; }
      return true; // 遮罩消费所有触摸
    } else if (type === "end") {
      const pressed = this.pressedConfirmRetreatBtn;
      this.pressedConfirmRetreatBtn = null;
      if (pressed === "cancel" && hitTest(x, y, cancelRect)) {
        this.confirmRetreat = false;
        playSfx("click");
      } else if (pressed === "confirm" && hitTest(x, y, confirmRect)) {
        this.confirmRetreat = false;
        playSfx("click");
        // 触发撤退结算
        this.engine?.retreat();
      }
      return true;
    }
    return true;
  }

  exit(): void {
    super.exit();
    setOrientation("portrait");
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.engineCanvas = null;
    this.resultOverlay = null;
    this.bossCodex = null;
    this.waveBriefing = null;
  }
}

/** 热线徽章 */
function drawHotlineBadge(ctx: CanvasRenderingContext2D, x: number, y: number, hotline: string, color: string): void {
  ctx.save();
  ctx.fillStyle = withAlpha(color, 0.18);
  ctx.strokeStyle = withAlpha(color, 0.7);
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, 96, 22, 11);
  ctx.fill();
  ctx.stroke();
  ctx.font = `700 11px ${Theme.fonts.mono}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`📞 ${hotline}`, x + 48, y + 12);
  ctx.restore();
}

/** 文本换行辅助 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = text.split("");
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
