/**
 * 「是男人就反诈」游戏场景
 * 引擎画布 800×480 横屏，卡片在左半区，选项按钮在右半区（同一画布坐标系，避免错位遮挡）
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawToast, hitTest, type Rect } from "@/ui/widgets";
import { FraudBusterEngine, itemEmoji, itemLabel } from "@/games/fraudBuster/engine";
import { MAN_TIERS } from "@/games/fraudBuster/data";
import { roundRect } from "@/engine/Renderer";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import type { GameEvent, GameResultPayload } from "@/types";
import type { FBHud, FBItemType, FBStats, FBSpecialEvent, FBBossSkill } from "@/games/fraudBuster/types";

const LETTERS = ["A", "B", "C", "D"];
const JUDGE_LETTERS = ["✓", "✗"];

// 画布尺寸（与引擎一致）
const CANVAS_W = 800;
const CANVAS_H = 480;
// 右半区选项面板
const OPT_X = 410;
const OPT_W = 370;

// 道具按钮（画布顶部右半区，6 个按钮 - 紧凑布局）
const ITEM_TYPES: FBItemType[] = ["freeze", "fifty", "skip", "double", "hint", "undo"];
const ITEM_BTN_W = 58;
const ITEM_BTN_H = 36;
const ITEM_BTN_GAP = 4;
const ITEM_BTN_Y = 12;
const ITEM_BTN_X = OPT_X + (OPT_W - (ITEM_BTN_W * 6 + ITEM_BTN_GAP * 5)) / 2;

// 特殊事件中文名映射
const SPECIAL_EVENT_NAMES: Record<FBSpecialEvent, string> = {
  double: "双重诈骗",
  timeCompress: "时间压缩",
  shuffle: "选项乱序",
  mixedTrueFalse: "真假混杂",
};
const SPECIAL_EVENT_ICONS: Record<FBSpecialEvent, string> = {
  double: "⚡",
  timeCompress: "⏱",
  shuffle: "🔀",
  mixedTrueFalse: "🎭",
};
// Boss 技能中文名映射
const BOSS_SKILL_NAMES: Record<FBBossSkill, string> = {
  shuffleOptions: "选项打乱",
  hideTimer: "隐藏倒计时",
  summonMinion: "召唤小怪",
  lockItem: "封印道具",
};

export class FraudBusterScene extends GameShellScene {
  private engine: FraudBusterEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private hud: FBHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedOpt: number | null = null;
  private pressedSubmit = false;
  private pressedItem: FBItemType | null = null;
  private t = 0;
  /** 上一次 HUD 的连击数，用于判定本次答题对错并触发 fx */
  private prevCombo = 0;
  /** 得分跳动：显示值追逐真实值，营造滚动爽感 */
  private displayScore = 0;
  /** 得分脉冲：得分增加时 >0，衰减到 0，驱动数字放大发光 */
  private scorePulse = 0;

  getGameTitle(): string { return "是男人就反诈"; }
  getGameSubtitle(): string { return "FRAUD BUSTER"; }
  getAccent(): string { return Theme.accents["fraud-buster"]; }

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new FraudBusterEngine(canvas);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    // 不调用 engine.start()：改为由 updateGame/renderGame 同步驱动，
    // 与 SceneDirector 主循环同帧，消除双 RAF 撕裂闪烁。
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      const newHud = e.payload as unknown as FBHud;
      this.maybeTriggerComboFx(newHud);
      this.hud = newHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 2.5 };
      this.toastTimer = 0;
    } else if (e.type === "result") {
      this.onResult(e.payload);
    }
  }

  /**
   * 根据 HUD combo 变化触发 fx 反馈（与引擎 postFX 互补，叠加更强烈的瞬时反馈）
   * - combo 增长 = 答对：色阶粒子爆发 + 冲击环；≥3 飘字 ×N COMBO（色阶递进）
   * - 里程碑（每 5）：大字 + 双层粒子 + 强震屏 + 闪屏，营造"越打越燃"的爽感
   * - 色阶升级（进入更高档）：额外小爆发提示
   * - combo 归零 = 答错：强震屏 + 红闪
   */
  private maybeTriggerComboFx(hud: FBHud): void {
    const combo = hud.combo;
    if (combo > this.prevCombo) {
      const { cx, cy } = this.cardCenterScreen();
      const color = this.comboColor(combo);
      // 答对：色阶粒子爆发 + 冲击环（强度随 combo 递增）
      const burstCount = 14 + Math.min(combo, 12) * 2;
      const burstSpeed = 200 + Math.min(combo, 12) * 18;
      this.fx.burst(cx, cy, color, burstCount, burstSpeed);
      this.fx.ring(cx, cy, color, 80 + Math.min(combo, 12) * 4, 0.45);
      if (combo >= 3) {
        this.fx.popText(cx, cy - 30, `×${combo} COMBO`, {
          color,
          size: 22 + Math.min(combo, 12) * 1.2,
          duration: 0.85,
          vy: -55,
        });
      }
      // 里程碑（每 5 连击）：大字 + 双层粒子 + 强震屏 + 闪屏
      if (combo >= 5 && combo % 5 === 0) {
        this.fx.shake(0.4 + Math.min(combo, 20) * 0.01);
        this.fx.flash(color, 0.22, 0.3);
        this.fx.popText(cx, cy - 70, `COMBO ×${combo}!`, {
          color,
          size: 30,
          duration: 1.0,
          vy: -40,
        });
        // 副色粒子二次爆发
        this.fx.burst(cx, cy, "#FFD666", 18, 280);
        this.fx.ring(cx, cy, "#FFD666", 120, 0.55);
      } else if (this.comboColor(combo) !== this.comboColor(this.prevCombo) && this.prevCombo >= 2) {
        // 色阶升级（进入更高档）：轻量提示爆发
        this.fx.burst(cx, cy, color, 10, 220);
        this.fx.popText(cx, cy - 56, "LEVEL UP!", { color, size: 16, duration: 0.7, vy: -45 });
      }
    } else if (combo === 0 && this.prevCombo > 0) {
      // 答错：强震屏 + 红闪
      this.fx.shake(0.6);
      this.fx.flash("#E5353B", 0.32, 0.3);
      const { cx, cy } = this.cardCenterScreen();
      this.fx.burst(cx, cy, "#E5353B", 18, 260);
    }
    this.prevCombo = combo;
  }

  /** 卡片中心在屏幕坐标系下的位置（用于 fx 飘字/粒子/冲击环定位） */
  private cardCenterScreen(): { cx: number; cy: number } {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const tr = this.getBlitTransform(screenW, screenH);
    // CARD_CX = 200, CARD_CY = 270（与 engine.ts 一致）
    return { cx: tr.offsetX + 200 * tr.scale, cy: tr.offsetY + 270 * tr.scale };
  }

  /**
   * 连击色阶：combo 越高颜色越烈，配合 HUD 与 fx 营造"越打越燃"的爽感。
   * 2 绿 / 3-4 金 / 5-7 橙 / 8-11 紫 / 12+ 红
   */
  private comboColor(combo: number): string {
    if (combo >= 12) return "#FF3B6B";
    if (combo >= 8) return "#B388FF";
    if (combo >= 5) return "#FF7A1A";
    if (combo >= 3) return "#FFD666";
    return "#1AD670";
  }

  private onResult(result: GameResultPayload): void {
    // 胜负闪光（与引擎 postFX 互补，叠加更明显反馈）
    if (result.win) {
      this.fx.flash("#1AD670", 0.28, 0.4);
    } else {
      this.fx.flash("#E5353B", 0.38, 0.5);
      this.fx.shake(0.5);
    }
    // 提取反诈专属详细统计（由 engine 通过 stats 字段传入）
    const stats = result.stats as FBStats | undefined;
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director), undefined, "slide"),
      renderExtraStats: stats
        ? (ctx, x, y, w) => this.renderFraudStats(ctx, x, y, w, stats)
        : undefined,
    });
  }

  /**
   * 渲染反诈专属详细统计（在结算面板底部追加）
   * 布局：3×2 数据小卡 + 弱项类型条形图
   * 返回绘制内容总高度，用于面板加高
   */
  private renderFraudStats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, stats: FBStats): number {
    const total = stats.totalAnswered || 0;
    const accuracy = total > 0 ? Math.round((stats.correctCount / total) * 100) : 0;

    // 标题
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("本局战报 · ANTI-FRAUD STATS", x, y);
    ctx.restore();

    // 3×2 数据小卡（每格 W=(w-2*8)/3, H=36）
    const gridY = y + 18;
    const cellGap = 8;
    const cellW = (w - cellGap * 2) / 3;
    const cellH = 38;
    const cells: Array<{ label: string; value: string; color: string }> = [
      { label: "准确率", value: `${accuracy}%`, color: accuracy >= 80 ? "#1AD670" : accuracy >= 60 ? "#FFD666" : "#E5353B" },
      { label: "最高连击", value: `×${stats.maxCombo}`, color: "#FF7A1A" },
      { label: "Boss 击破", value: `${stats.bossDefeated}`, color: "#E5353B" },
      { label: "道具使用", value: `${stats.itemsUsed}`, color: "#00E5FF" },
      { label: "连锁完成", value: `${stats.chainCompleted}`, color: "#FFD666" },
      { label: "特殊通过", value: `${stats.specialCleared}`, color: "#B388FF" },
    ];
    for (let i = 0; i < cells.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = x + col * (cellW + cellGap);
      const cy = gridY + row * (cellH + cellGap);
      const c = cells[i];
      ctx.save();
      // 卡片背景
      roundRect(ctx, cx, cy, cellW, cellH, 6);
      ctx.fillStyle = "rgba(10,25,41,0.6)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(c.color, 0.45);
      roundRect(ctx, cx, cy, cellW, cellH, 6);
      ctx.stroke();
      // 数值
      ctx.font = `900 16px ${Theme.fonts.mono}`;
      ctx.fillStyle = c.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = withAlpha(c.color, 0.5);
      ctx.shadowBlur = 6;
      ctx.fillText(c.value, cx + cellW / 2, cy + 14);
      ctx.shadowBlur = 0;
      // 标签
      ctx.font = `500 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText(c.label, cx + cellW / 2, cy + 30);
      ctx.restore();
    }

    // 弱项类型条形图（取正确率最低的3个类型）
    const typeY = gridY + 2 * (cellH + cellGap) + 6;
    const byType = stats.byType || {};
    const types = Object.entries(byType).filter(([, v]) => v && v.total > 0);
    types.sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
    const weakTypes = types.slice(0, 3);

    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(weakTypes.length > 0 ? "需加强防范" : "暂无类型统计", x, typeY);
    ctx.restore();

    let barY = typeY + 16;
    const barH = 12;
    const barGap = 6;
    for (const [typeName, data] of weakTypes) {
      const rate = data.total > 0 ? data.correct / data.total : 0;
      const rateColor = rate >= 0.8 ? "#1AD670" : rate >= 0.5 ? "#FFD666" : "#E5353B";
      // 类型名
      ctx.save();
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const label = typeName.length > 10 ? typeName.slice(0, 10) + "…" : typeName;
      ctx.fillText(label, x, barY + barH / 2);
      // 进度条背景
      const barX = x + 96;
      const barW = w - 96 - 40;
      roundRect(ctx, barX, barY, barW, barH, 6);
      ctx.fillStyle = "rgba(10,25,41,0.6)";
      ctx.fill();
      // 进度条填充
      const fillW = Math.max(2, barW * rate);
      roundRect(ctx, barX, barY, fillW, barH, 6);
      ctx.fillStyle = withAlpha(rateColor, 0.8);
      ctx.fill();
      // 百分比
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = rateColor;
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(rate * 100)}%`, x + w, barY + barH / 2);
      ctx.restore();
      barY += barH + barGap;
    }

    // 总高度 = 标题(18) + 2行卡片(2*(38+8)) + 弱项标题(16) + 3个条形(3*(12+6))
    return 18 + 2 * (cellH + cellGap) + 16 + 3 * (barH + barGap);
  }

  private retry(): void {
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.pressedOpt = null;
    this.pressedSubmit = false;
    this.pressedItem = null;
    this.prevCombo = 0;
    this.displayScore = 0;
    this.scorePulse = 0;
    this.fx.clear();
    this.spawnEngine();
  }

  protected updateGame(dt: number): void {
    // 同步驱动引擎 update（与场景同帧，杜绝撕裂）
    this.engine?.stepUpdate(dt);
    this.t += dt;
    // 得分数字滚动追逐（爽感：分数跳动）
    this.updateScoreRoll(dt);
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 2.5) this.toast = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  /**
   * 得分数字滚动追逐：displayScore 向真实 score 逼近，
   * 差值越大滚得越快；检测到得分增加触发脉冲（数字放大发光）。
   */
  private updateScoreRoll(dt: number): void {
    const target = this.hud?.score ?? 0;
    if (target > this.displayScore) {
      const diff = target - this.displayScore;
      // 指数追逐，差值越大越快，但封顶避免瞬移
      const step = Math.min(diff, Math.max(diff * 8 * dt + 2 * dt, 1));
      this.displayScore = Math.min(target, this.displayScore + step);
      // 新增得分（非初始同步）触发脉冲
      if (this.displayScore > 0.5 && this.scorePulse < 0.001) this.scorePulse = 1;
    } else if (target < this.displayScore) {
      // 分数下降（罕见）：快速对齐
      this.displayScore = target;
    }
    if (this.scorePulse > 0) {
      this.scorePulse = Math.max(0, this.scorePulse - dt * 3.2);
    }
  }

  /** 选项按钮矩形（画布坐标，右半区垂直居中） */
  private getOptionRects(kind: "single" | "judge" | "multi"): Rect[] {
    const isJudge = kind === "judge";
    const count = isJudge ? 2 : 4;
    const btnH = isJudge ? 72 : 60;
    const gap = 10;
    const submitH = 44;
    const total = count * btnH + (count - 1) * gap + gap + submitH;
    const startY = (CANVAS_H - total) / 2;
    const rects: Rect[] = [];
    for (let i = 0; i < count; i++) {
      rects.push({ x: OPT_X, y: startY + i * (btnH + gap), w: OPT_W, h: btnH });
    }
    return rects;
  }

  /** 提交按钮矩形（画布坐标，所有题型统一显示） */
  private getSubmitRect(kind: "single" | "judge" | "multi"): Rect {
    const rects = this.getOptionRects(kind);
    const last = rects[rects.length - 1];
    return { x: OPT_X, y: last.y + last.h + 10, w: OPT_W, h: 44 };
  }

  /** 计算 blitContain 变换（屏幕坐标 → 画布坐标的逆变换参数） */
  private getBlitTransform(screenW: number, screenH: number): { scale: number; offsetX: number; offsetY: number } {
    const cw = this.engineCanvas?.width ?? CANVAS_W;
    const ch = this.engineCanvas?.height ?? CANVAS_H;
    const scale = Math.min(screenW / cw, screenH / ch);
    const offsetX = (screenW - cw * scale) / 2;
    const offsetY = (screenH - ch * scale) / 2;
    return { scale, offsetX, offsetY };
  }

  /** 道具按钮矩形（画布坐标，顶部右半区水平排布） */
  private getItemRect(type: FBItemType): Rect {
    const idx = ITEM_TYPES.indexOf(type);
    return {
      x: ITEM_BTN_X + idx * (ITEM_BTN_W + ITEM_BTN_GAP),
      y: ITEM_BTN_Y,
      w: ITEM_BTN_W,
      h: ITEM_BTN_H,
    };
  }

  /** 道具按钮是否可用 */
  private isItemEnabled(type: FBItemType, hud: FBHud): boolean {
    if (hud.items[type] <= 0) return false;
    if (hud.selectedIdx !== null) return false; // 揭示态不可用
    if (!hud.hasQuestion) return false;
    // Boss lockItem 技能封印道具（undo 例外，可恢复体力）
    if (hud.itemLocked && type !== "undo") return false;
    // fifty 仅 single/judge
    if (type === "fifty" && hud.qKind === "multi") return false;
    // fifty 已用过本道题
    if (type === "fifty" && hud.fiftyRemoved.length > 0) return false;
    // freeze 已生效中
    if (type === "freeze" && hud.freezeRemaining > 0) return false;
    // double 已生效中
    if (type === "double" && hud.doubleRemaining > 0) return false;
    // hint 已用过本道题
    if (type === "hint" && hud.hintHighlighted.length > 0) return false;
    // undo 仅在体力未满时可用
    if (type === "undo" && hud.stamina >= hud.maxStamina) return false;
    return true;
  }

  /** 渲染 6 个道具按钮（紧凑布局：emoji 左 + 数量/状态 右） */
  private drawItemButtons(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    for (const type of ITEM_TYPES) {
      const r = this.getItemRect(type);
      const count = hud.items[type] ?? 0;
      const enabled = this.isItemEnabled(type, hud);
      const pressed = this.pressedItem === type;
      const active = (type === "freeze" && hud.freezeRemaining > 0)
        || (type === "double" && hud.doubleRemaining > 0)
        || (type === "hint" && hud.hintHighlighted.length > 0);
      // Boss 封印态：除 undo 外全部视觉锁住
      const locked = !!hud.itemLocked && type !== "undo";
      const color = type === "freeze" ? "#00E5FF"
        : type === "fifty" ? "#FFD666"
        : type === "skip" ? "#B388FF"
        : type === "double" ? "#FF7A1A"
        : type === "hint" ? "#B388FF"
        : "#52C41A";

      ctx.save();
      if (pressed && enabled) ctx.translate(0, 1);
      // 背景
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      if (locked) {
        ctx.fillStyle = "#1A0E0E";
      } else if (active) {
        const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        g.addColorStop(0, withAlpha(color, 0.4));
        g.addColorStop(1, withAlpha(color, 0.14));
        ctx.fillStyle = g;
      } else if (enabled) {
        const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        g.addColorStop(0, "#1B3A5A");
        g.addColorStop(1, "#0A1929");
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = "#0A1626";
      }
      ctx.fill();
      // 边框
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = locked ? "rgba(229,53,59,0.5)"
        : enabled ? color : "rgba(122,143,176,0.3)";
      if (active) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10 + Math.sin(this.t * 6) * 3;
      } else if (enabled && !locked) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
      }
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 顶部色条（active 状态视觉强化）
      if (active) {
        ctx.fillStyle = color;
        roundRect(ctx, r.x + 4, r.y + 2, r.w - 8, 2, 1);
        ctx.fill();
      }
      // emoji 图标（左）
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = locked ? "rgba(122,143,176,0.4)"
        : enabled ? "#FFFFFF" : "rgba(122,143,176,0.5)";
      ctx.fillText(itemEmoji(type), r.x + 14, r.y + r.h / 2);
      // 数量徽章 / 持续状态（右）
      ctx.textAlign = "right";
      if (locked) {
        // 封印态显示锁标
        ctx.font = `700 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = "rgba(229,53,59,0.8)";
        ctx.fillText("🔒", r.x + r.w - 6, r.y + r.h / 2);
      } else if (active) {
        ctx.font = `700 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = color;
        const remain = type === "freeze"
          ? `${hud.freezeRemaining.toFixed(1)}s`
          : type === "double"
            ? `×${hud.doubleRemaining}`
            : "ON";
        ctx.fillText(remain, r.x + r.w - 6, r.y + r.h / 2);
      } else {
        ctx.font = `900 12px ${Theme.fonts.mono}`;
        ctx.fillStyle = enabled ? color : "rgba(122,143,176,0.5)";
        ctx.fillText(`×${count}`, r.x + r.w - 6, r.y + r.h / 2);
      }
      ctx.restore();
    }
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 同步驱动引擎渲染：确保 engineCanvas 在 blitContain 之前已完成本帧绘制，
    // 与 SceneDirector 主循环同帧，消除双 RAF 撕裂闪烁。
    if (this.engineCanvas && this.engine) {
      this.engine.stepRender();
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // 顶部 HUD（屏幕坐标，位于顶部栏下方）
    if (this.hud) {
      this.renderStats(ctx, screenW);
    }

    // 特殊波次事件指示器（屏幕坐标，顶部中央下方）
    if (this.hud && this.hud.specialEvent) {
      this.drawSpecialEventBanner(ctx, screenW, this.hud.specialEvent);
    }

    // 连锁题指示器（屏幕坐标，紧贴特殊事件下方）
    if (this.hud && this.hud.chainStep) {
      this.drawChainIndicator(ctx, screenW, this.hud.chainStep);
    }

    // Boss 技能指示器（屏幕坐标）
    if (this.hud && this.hud.bossActive && this.hud.bossSkill) {
      this.drawBossSkillIndicator(ctx, screenW, this.hud.bossSkill);
    }

    // 诈骗分子挑衅横幅（高压/错答时出现，压迫感+代入感）
    if (this.hud && this.hud.taunt) {
      this.drawTauntBanner(ctx, screenW, this.hud.taunt);
    }

    // 心跳边缘红脉（压迫感）：HUD 层叠加，与引擎心跳同步
    if (this.hud && this.hud.heartbeat > 0.3) {
      this.drawHeartbeatEdge(ctx, screenW, screenH, this.hud.heartbeat);
    }

    // 选项按钮 + 倒计时（画布坐标，应用 blitContain 变换，与卡片同坐标系）
    if (this.hud && this.hud.hasQuestion) {
      const tr = this.getBlitTransform(screenW, screenH);
      ctx.save();
      ctx.translate(tr.offsetX, tr.offsetY);
      ctx.scale(tr.scale, tr.scale);

      const kind = this.hud.qKind;
      const rects = this.getOptionRects(kind);
      const isRevealing = this.hud.selectedIdx !== null;
      for (let i = 0; i < rects.length; i++) {
        this.drawOptionButton(ctx, rects[i], i, this.hud, isRevealing, kind);
      }
      const subRect = this.getSubmitRect(kind);
      this.drawAutoSubmitHint(ctx, subRect, this.hud, isRevealing);
      // 倒计时压迫条（画布坐标）
      this.drawCountdownBar(ctx, this.hud);
      // 道具按钮（画布顶部右半区）
      this.drawItemButtons(ctx, this.hud);

      ctx.restore();
    }

    // Toast（屏幕坐标）
    if (this.toast) {
      const tw = screenW - 32;
      const th = 56;
      // 有诈骗挑衅横幅时，toast 下移避免遮挡
      const ty = this.hud && this.hud.taunt ? 140 : 116;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "反诈提示");
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  /** 特殊波次事件横幅：紫色脉动胶囊，提示当前事件类型 */
  private drawSpecialEventBanner(ctx: CanvasRenderingContext2D, screenW: number, event: FBSpecialEvent): void {
    const name = SPECIAL_EVENT_NAMES[event];
    const icon = SPECIAL_EVENT_ICONS[event];
    const text = `${icon} 特殊波次 · ${name}`;
    ctx.save();
    ctx.font = `900 12px ${Theme.fonts.mono}`;
    const tw = ctx.measureText(text).width + 36;
    const x = (screenW - tw) / 2;
    const y = 70;
    const h = 22;
    // 脉动透明度
    const pulse = 0.7 + Math.sin(this.t * 4) * 0.3;
    // 胶囊背景
    roundRect(ctx, x, y, tw, h, 11);
    const g = ctx.createLinearGradient(x, y, x + tw, y);
    g.addColorStop(0, "rgba(179,136,255,0.32)");
    g.addColorStop(0.5, "rgba(120,60,200,0.45)");
    g.addColorStop(1, "rgba(179,136,255,0.32)");
    ctx.fillStyle = g;
    ctx.globalAlpha = pulse;
    ctx.fill();
    ctx.globalAlpha = 1;
    // 边框
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(179,136,255,0.9)";
    ctx.shadowColor = "#B388FF";
    ctx.shadowBlur = 8;
    roundRect(ctx, x, y, tw, h, 11);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 文字
    ctx.fillStyle = "#E0CCFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + tw / 2, y + h / 2 + 1);
    ctx.restore();
  }

  /** 连锁题指示器：金色胶囊，显示当前步骤 1/2 或 2/2 */
  private drawChainIndicator(ctx: CanvasRenderingContext2D, screenW: number, step: number): void {
    const text = `🔗 情景连锁 ${step}/2`;
    ctx.save();
    ctx.font = `900 11px ${Theme.fonts.mono}`;
    const tw = ctx.measureText(text).width + 24;
    const x = (screenW - tw) / 2;
    const y = 96;
    const h = 18;
    roundRect(ctx, x, y, tw, h, 9);
    ctx.fillStyle = "rgba(255,214,102,0.18)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,214,102,0.85)";
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 6;
    roundRect(ctx, x, y, tw, h, 9);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = step === 2 ? "#FFD666" : "#FFE9A8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + tw / 2, y + h / 2 + 1);
    ctx.restore();
  }

  /** Boss 技能指示器：红色胶囊，显示当前激活的 Boss 技能 */
  private drawBossSkillIndicator(ctx: CanvasRenderingContext2D, screenW: number, skill: FBBossSkill): void {
    const name = BOSS_SKILL_NAMES[skill];
    const text = `⚠ Boss 技能 · ${name}`;
    ctx.save();
    ctx.font = `900 11px ${Theme.fonts.mono}`;
    const tw = ctx.measureText(text).width + 28;
    // 紧贴右上角下方（避开猛男图标）
    const x = screenW - tw - 88;
    const y = 70;
    const h = 20;
    const pulse = 0.7 + Math.sin(this.t * 8) * 0.3;
    roundRect(ctx, x, y, tw, h, 10);
    ctx.fillStyle = `rgba(229,53,59,${0.35 * pulse})`;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(229,53,59,0.95)";
    ctx.shadowColor = "#E5353B";
    ctx.shadowBlur = 8;
    roundRect(ctx, x, y, tw, h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFC0C0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + tw / 2, y + h / 2 + 1);
    ctx.restore();
  }

  /** 倒计时压迫条：画布右侧竖条 + 卡片区中央数字（画布坐标） */
  private drawCountdownBar(ctx: CanvasRenderingContext2D, hud: FBHud): void {
    if (!hud.hasQuestion || hud.selectedIdx !== null) return;
    const ratio = hud.timerRatio;
    if (ratio <= 0) return;
    // 右侧竖条（画布右边缘）
    const barX = CANVAS_W - 10;
    const barY = 80;
    const barH = CANVAS_H - 160;
    const barW = 6;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();
    const fillH = barH * ratio;
    const color = ratio > 0.5 ? "#1AD670" : ratio > 0.25 ? "#FFD666" : "#E5353B";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = ratio < 0.3 ? 12 : 6;
    roundRect(ctx, barX, barY + barH - fillH, barW, fillH, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 卡片区中央倒计时数字（高压时）
    if (ratio < 0.3) {
      const secs = Math.max(0, ratio * (hud.qKind === "multi" ? 7 : 5)).toFixed(1);
      const pulse = 0.7 + Math.sin(this.t * 14) * 0.3;
      ctx.font = `900 ${Math.round(48 * pulse)}px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#E5353B";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#E5353B";
      ctx.shadowBlur = 18;
      ctx.fillText(secs, 200, CANVAS_H / 2 - 60);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /** 诈骗分子挑衅横幅：故障红条 + 抖动文字，强化压迫感与代入感 */
  private drawTauntBanner(ctx: CanvasRenderingContext2D, screenW: number, taunt: string): void {
    const w = screenW - 40;
    const h = 34;
    const x = 20;
    const y = 96;
    ctx.save();
    // 抖动偏移（故障感）
    const jx = (Math.random() - 0.5) * 2.4;
    const jy = (Math.random() - 0.5) * 1.2;
    ctx.translate(jx, jy);
    // 背景：故障红渐变
    roundRect(ctx, x, y, w, h, 6);
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, "rgba(229,53,59,0.85)");
    g.addColorStop(0.5, "rgba(120,10,20,0.92)");
    g.addColorStop(1, "rgba(229,53,59,0.85)");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(229,53,59,0.7)";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    // 边框
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,90,96,0.9)";
    roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();
    // 色差文字（RGB 错位，故障感）
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 14px ${Theme.fonts.mono}`;
    const cx = x + w / 2;
    const cy = y + h / 2 + 1;
    ctx.fillStyle = "rgba(0,229,255,0.7)";
    ctx.fillText(taunt, cx - 1.5, cy);
    ctx.fillStyle = "rgba(255,0,80,0.7)";
    ctx.fillText(taunt, cx + 1.5, cy);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(taunt, cx, cy);
    // 左侧“⚠”标记
    ctx.textAlign = "left";
    ctx.font = `900 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.fillText("⚠ 诈骗来电", x + 10, cy);
    ctx.restore();
  }

  /** 心跳边缘红脉：屏幕四边红色脉动，压迫感 */
  private drawHeartbeatEdge(ctx: CanvasRenderingContext2D, screenW: number, screenH: number, hb: number): void {
    // 与引擎心跳节律同步（~1.1s 周期）
    const beat = (this.t % 1.1) / 1.1;
    let amp: number;
    if (beat < 0.12) amp = Math.sin((beat / 0.12) * Math.PI);
    else if (beat > 0.22 && beat < 0.34) amp = Math.sin(((beat - 0.22) / 0.12) * Math.PI) * 0.55;
    else amp = 0;
    const alpha = hb * amp * 0.5;
    if (alpha <= 0.01) return;
    ctx.save();
    const thickness = 36;
    // 上边
    let g = ctx.createLinearGradient(0, 0, 0, thickness);
    g.addColorStop(0, `rgba(229,53,59,${alpha})`);
    g.addColorStop(1, "rgba(229,53,59,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, screenW, thickness);
    // 下边
    g = ctx.createLinearGradient(0, screenH - thickness, 0, screenH);
    g.addColorStop(0, "rgba(229,53,59,0)");
    g.addColorStop(1, `rgba(229,53,59,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, screenH - thickness, screenW, thickness);
    // 左边
    g = ctx.createLinearGradient(0, 0, thickness, 0);
    g.addColorStop(0, `rgba(229,53,59,${alpha})`);
    g.addColorStop(1, "rgba(229,53,59,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, thickness, screenH);
    // 右边
    g = ctx.createLinearGradient(screenW - thickness, 0, screenW, 0);
    g.addColorStop(0, "rgba(229,53,59,0)");
    g.addColorStop(1, `rgba(229,53,59,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(screenW - thickness, 0, thickness, screenH);
    ctx.restore();
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 24;
    ctx.save();

    // 左上：WAVE + 体力
    ctx.font = `900 22px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.getAccent();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(this.getAccent(), 0.45);
    ctx.shadowBlur = 8;
    ctx.fillText(`反诈波次 ${hud.wave}`, 16, y);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("STAMINA", 16, y + 30);
    // 体力：3 个盾/心
    for (let i = 0; i < hud.maxStamina; i++) {
      const sx = 16 + i * 20;
      const sy = y + 44;
      const filled = i < hud.stamina;
      this.drawHeart(ctx, sx + 6, sy + 6, filled);
    }

    // 右上：强壮猛男图标（分值）
    const manCx = screenW - 44;
    const manCy = y + 30;
    const hurt = hud.stamina <= 1;
    this.drawMan3D(ctx, manCx, manCy, 40, hud.manLevel, hud.manColor, hurt);
    // 等级名
    ctx.textAlign = "center";
    ctx.font = `900 13px ${Theme.fonts.display}`;
    ctx.fillStyle = hud.manColor;
    ctx.shadowColor = withAlpha(hud.manColor, 0.5);
    ctx.shadowBlur = 6;
    ctx.fillText(hud.manName, manCx, manCy + 34);
    ctx.shadowBlur = 0;
    // 分值（跳动数字：displayScore 追逐真实值，得分变化时脉冲放大发光）
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("SCORE", manCx, manCy + 50);
    const pulse = this.scorePulse;
    const scoreScale = 1 + pulse * 0.35;
    const scoreColor = pulse > 0.05 ? "#FFD666" : Theme.colors.ink.DEFAULT;
    ctx.save();
    ctx.translate(manCx, manCy + 62);
    ctx.scale(scoreScale, scoreScale);
    ctx.font = `900 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = scoreColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (pulse > 0.05) {
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 10 * pulse;
    }
    ctx.fillText(`${Math.round(this.displayScore)}`, 0, 0);
    ctx.restore();

    // 连击（顶部中央）：色阶递进 + 高连击脉动放大
    if (hud.combo > 1) {
      const comboColor = this.comboColor(hud.combo);
      // 高连击呼吸脉动（combo≥5 起），越连越燃
      const breathe = hud.combo >= 5 ? 1 + Math.sin(this.t * 8) * 0.06 * Math.min(1, hud.combo / 12) : 1;
      // 字号随连击递增（封顶 28）
      const size = Math.min(28, 16 + Math.min(hud.combo, 12) * 0.9);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(screenW / 2, y + 10);
      ctx.scale(breathe, breathe);
      ctx.font = `900 ${size}px ${Theme.fonts.display}`;
      ctx.fillStyle = comboColor;
      ctx.shadowColor = withAlpha(comboColor, 0.6);
      ctx.shadowBlur = 10 + Math.min(hud.combo, 12);
      ctx.fillText(`×${hud.combo} COMBO`, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 题型标签（顶部中央下方）+ kind 标签
    if (hud.hasQuestion && hud.qType) {
      ctx.textAlign = "center";
      ctx.font = `500 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText(hud.qType, screenW / 2, y + 30);
      // kind 标签
      const kindLabel = hud.qKind === "judge" ? "判断题" : hud.qKind === "multi" ? "多选题（全选对才得分）" : "单选题";
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = hud.qKind === "multi" ? "#FFD666" : hud.qKind === "judge" ? "#B388FF" : Theme.colors.ink.muted;
      ctx.fillText(kindLabel, screenW / 2, y + 44);
    }
    ctx.restore();
  }

  /** 3D 猛男图标：随等级变壮，颜色随等级，受伤变红抖动，常驻呼吸+屈臂动效 */
  private drawMan3D(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, level: number, color: string, hurt: boolean): void {
    const tier = MAN_TIERS[level] ?? MAN_TIERS[0];
    const k = level / 7; // 0..1 强壮度
    const bulk = 3 + k * 5; // 肢体粗细
    const shoulderW = size * (0.32 + k * 0.14);
    ctx.save();
    // 受伤抖动
    if (hurt) {
      ctx.translate(Math.sin(this.t * 40) * 1.2, 0);
    }
    // 呼吸：胸腔随呼吸微微起伏（代入感）
    const breath = 1 + Math.sin(this.t * 2.2) * 0.04;
    ctx.translate(cx, cy);
    ctx.scale(breath, breath);
    ctx.translate(-cx, -cy);
    // 屈臂脉动：高级别时二头肌周期性收紧（更强壮感）
    const flex = 0.5 + Math.sin(this.t * 1.6) * 0.5; // 0..1
    // 光环
    const aura = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, size * 0.9);
    aura.addColorStop(0, withAlpha(color, 0.25 + k * 0.1));
    aura.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.9, 0, Math.PI * 2);
    ctx.fill();

    const bodyColor = hurt ? "#E5353B" : color;
    ctx.strokeStyle = bodyColor;
    ctx.fillStyle = bodyColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = 8;

    const neckY = cy - size * 0.22;
    const hipY = cy + size * 0.22;
    const headCy = cy - size * 0.4;
    // 头
    ctx.beginPath();
    ctx.arc(cx, headCy, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
    // 颈
    ctx.lineWidth = bulk * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, headCy + size * 0.1);
    ctx.lineTo(cx, neckY);
    ctx.stroke();
    // 肩 + 躯干
    ctx.lineWidth = bulk;
    ctx.beginPath();
    ctx.moveTo(cx, neckY);
    ctx.lineTo(cx, hipY);
    ctx.stroke();
    // 肩膀横梁
    ctx.lineWidth = bulk * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW, neckY + size * 0.04);
    ctx.lineTo(cx + shoulderW, neckY + size * 0.04);
    ctx.stroke();
    // 胸肌两块
    ctx.beginPath();
    ctx.arc(cx - shoulderW * 0.45, neckY + size * 0.14, size * (0.08 + k * 0.05), 0, Math.PI * 2);
    ctx.arc(cx + shoulderW * 0.45, neckY + size * 0.14, size * (0.08 + k * 0.05), 0, Math.PI * 2);
    ctx.fill();
    // 手臂（屈臂上举 flex）
    ctx.lineWidth = bulk * (1 + k * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW, neckY + size * 0.04);
    ctx.lineTo(cx - shoulderW * 1.25, cy - size * 0.02);
    ctx.lineTo(cx - shoulderW * 1.05, cy - size * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + shoulderW, neckY + size * 0.04);
    ctx.lineTo(cx + shoulderW * 1.25, cy - size * 0.02);
    ctx.lineTo(cx + shoulderW * 1.05, cy - size * 0.2);
    ctx.stroke();
    // 二头肌凸起（随屈臂脉动收缩鼓起，更强壮感）
    if (k > 0.2) {
      const bicepR = size * (0.05 + k * 0.05) * (1 + flex * 0.25);
      ctx.beginPath();
      ctx.arc(cx - shoulderW * 1.2, cy - size * 0.06, bicepR, 0, Math.PI * 2);
      ctx.arc(cx + shoulderW * 1.2, cy - size * 0.06, bicepR, 0, Math.PI * 2);
      ctx.fill();
    }
    // 腿
    ctx.lineWidth = bulk * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.46);
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.46);
    ctx.stroke();

    ctx.shadowBlur = 0;
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(cx - size * 0.04, headCy - size * 0.03, size * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // 等级条（小）
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(ctx, cx - size * 0.4, cy + size * 0.55, size * 0.8, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = tier.color;
    roundRect(ctx, cx - size * 0.4, cy + size * 0.55, size * 0.8 * k, 3, 1.5);
    ctx.fill();
    ctx.restore();
  }

  private drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, filled: boolean): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-7, -2, -7, -8, 0, -4);
    ctx.bezierCurveTo(7, -8, 7, -2, 0, 4);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = "#E5353B";
      ctx.shadowColor = "#E5353B";
      ctx.shadowBlur = 6;
    } else {
      ctx.fillStyle = "#1B3A5A";
    }
    ctx.fill();
    ctx.restore();
  }

  private drawOptionButton(ctx: CanvasRenderingContext2D, r: Rect, idx: number, hud: FBHud, revealing: boolean, kind: "single" | "judge" | "multi"): void {
    const text = hud.options[idx] ?? "";
    const isRisk = hud.riskIdx.includes(idx);
    const isMultiSelected = hud.multiSelected.includes(idx);
    const isPending = kind !== "multi" && hud.pendingIdx === idx;
    // 50-50 道具移除的选项
    const isRemoved = hud.fiftyRemoved.includes(idx);
    // 揭示态：判断正确/错误
    let isCorrect = false;
    let isWrongSel = false;
    if (revealing) {
      if (kind === "multi") {
        // 多选揭示：正确答案列表中的 = correct；玩家选了但不在正确列表 = wrong
        isCorrect = hud.correctIdxList.includes(idx);
        isWrongSel = isMultiSelected && !hud.correctIdxList.includes(idx);
      } else {
        isCorrect = hud.correctIdx === idx;
        isWrongSel = hud.selectedIdx === idx && hud.correctIdx !== idx;
      }
    }
    const pressed = this.pressedOpt === idx;

    let baseColor = "#13294A";
    let edgeColor = "rgba(0,229,255,0.4)";
    let textColor = "#F0F4FF";
    let glow = false;
    if (isRemoved) {
      // 50-50 移除：置灰 + 划线
      baseColor = "#0A1626"; edgeColor = "rgba(122,143,176,0.2)"; textColor = "rgba(122,143,176,0.4)";
    } else if (isCorrect) { baseColor = "#0F3A24"; edgeColor = "#1AD670"; glow = true; textColor = "#9FFFC0"; }
    else if (isWrongSel) { baseColor = "#3A1414"; edgeColor = "#E5353B"; glow = true; textColor = "#FFC0C0"; }
    else if (revealing) { baseColor = "#0E1E36"; edgeColor = "rgba(0,229,255,0.15)"; textColor = "#7A8FB0"; }
    else if (kind === "multi" && isMultiSelected) {
      // 多选题已选中（非揭示态）：高亮橙色
      baseColor = "#3A2A0A"; edgeColor = "#FFD666"; glow = true; textColor = "#FFD666";
    } else if (isPending) {
      // 单选/判断题已选未提交：高亮橙色（与多选已选统一）
      baseColor = "#3A2A0A"; edgeColor = "#FFD666"; glow = true; textColor = "#FFD666";
    } else if (isRisk && !revealing) {
      // 风险选项：警示色（仅给玩家隐约提示，不直接说明）
      baseColor = "#1F0E1A"; edgeColor = "rgba(229,53,59,0.35)"; textColor = "#F0F4FF";
    }

    ctx.save();
    if (pressed && !revealing) ctx.translate(0, 1);
    // 投影
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = pressed ? 4 : 10;
    ctx.shadowOffsetY = pressed ? 2 : 5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, baseColor);
    g.addColorStop(1, "#0A1626");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 斜面边框（3D 立体感）
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = edgeColor;
    if (glow) { ctx.shadowColor = edgeColor; ctx.shadowBlur = 10; }
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 字母徽章（判断题用 ✓/✗，多选题用方块■/空，单选用 A/B/C/D）
    const badgeR = kind === "judge" ? 20 : 16;
    const bx = r.x + 26;
    const by = r.y + r.h / 2;
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, badgeR);
    if (isCorrect) {
      bg.addColorStop(0, "#1AD670"); bg.addColorStop(1, "#0A5A30");
    } else if (isWrongSel) {
      bg.addColorStop(0, "#E5353B"); bg.addColorStop(1, "#5A0E0E");
    } else if (kind === "multi" && isMultiSelected && !revealing) {
      bg.addColorStop(0, "#FFD666"); bg.addColorStop(1, "#7A4A0A");
    } else if (isPending) {
      bg.addColorStop(0, "#FFD666"); bg.addColorStop(1, "#7A4A0A");
    } else if (kind === "judge") {
      bg.addColorStop(0, idx === 0 ? "#1AD670" : "#E5353B");
      bg.addColorStop(1, idx === 0 ? "#0A5A30" : "#5A0E0E");
    } else {
      bg.addColorStop(0, "#1B4A6E"); bg.addColorStop(1, "#0A2535");
    }
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.font = `900 ${kind === "judge" ? 20 : 14}px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const letter = kind === "judge" ? JUDGE_LETTERS[idx] : LETTERS[idx];
    ctx.fillText(letter, bx, by);

    // 风险标识（仅揭示后显示）
    if (isRisk && revealing && (isWrongSel || kind === "multi")) {
      ctx.font = "700 12px sans-serif";
      ctx.fillStyle = "#FF3B6B";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("⚠ 风险", r.x + 52, by - 10);
    }

    // 选项文字
    ctx.font = `500 ${kind === "judge" ? 16 : 14}px ${Theme.fonts.body}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const offsetX = kind === "judge" ? 56 : 52;
    this.drawClampedText(ctx, text, r.x + offsetX, by, r.w - offsetX - 20);
    // 50-50 移除：文字上划删除线
    if (isRemoved) {
      const tw = ctx.measureText(text.length > 18 ? text.slice(0, 18) : text).width;
      ctx.strokeStyle = "rgba(122,143,176,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x + offsetX, by - 6);
      ctx.lineTo(r.x + offsetX + Math.min(tw, r.w - offsetX - 20), by - 6);
      ctx.stroke();
    }

    // 正确/错误标记
    if (isCorrect) {
      ctx.font = "700 14px sans-serif";
      ctx.fillStyle = "#1AD670";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("✓", r.x + r.w - 14, by);
    } else if (isWrongSel) {
      ctx.font = "700 14px sans-serif";
      ctx.fillStyle = "#E5353B";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("✗", r.x + r.w - 14, by);
    }
    ctx.restore();
  }

  /**
   * 自动提交提示横幅（取代原提交按钮）
   * - 揭示态：显示"· 已作答 ·"
   * - 单选/判断 show 态：提示点击即提交
   * - 多选 show 态：提示选错即判错、选全正确自动提交，并显示已选数量
   */
  private drawAutoSubmitHint(ctx: CanvasRenderingContext2D, r: Rect, hud: FBHud, revealing: boolean): void {
    const kind = hud.qKind;
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, "rgba(26,214,112,0.10)");
    g.addColorStop(1, "rgba(10,25,41,0.55)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(26,214,112,0.4)";
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.stroke();

    // 文案
    let label: string;
    let color = "#1AD670";
    if (revealing) {
      label = "· 已作答 ·";
      color = "#7A8FB0";
    } else if (kind === "multi") {
      const selCount = hud.multiSelected.length;
      label = selCount === 0
        ? "⚡ 多选 · 选错即判错，选全正确自动提交"
        : `⚡ 已选 ${selCount} 项 · 继续选择 / 选错即时判错`;
    } else {
      label = "⚡ 点击选项即自动提交";
    }
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(color, 0.5);
    ctx.shadowBlur = 4;
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawClampedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number): void {
    let t = text;
    if (ctx.measureText(t).width > maxW) {
      while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
      t = t + "…";
    }
    ctx.fillText(t, x, y);
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const hud = this.hud;
    if (!hud || !hud.hasQuestion) return false;
    // 屏幕坐标 → 画布坐标（选项按钮在画布坐标系，右半区）
    const cw = this.engineCanvas?.width ?? CANVAS_W;
    const ch = this.engineCanvas?.height ?? CANVAS_H;
    const local = this.director.screenToLocal(x, y, cw, ch);
    const lx = local.x;
    const ly = local.y;
    const kind = hud.qKind;
    const rects = this.getOptionRects(kind);
    const isRevealing = hud.selectedIdx !== null;

    if (type === "start") {
      if (isRevealing) return false;
      // 道具按钮（优先判定，避免被选项区域吞掉）
      for (const it of ITEM_TYPES) {
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.pressedItem = it;
          return true;
        }
      }
      // 选项点击（屏蔽 50-50 移除的选项；点击即自动提交，由 engine 判定）
      for (let i = 0; i < rects.length; i++) {
        if (hud.fiftyRemoved.includes(i)) continue;
        if (hitTest(lx, ly, rects[i])) { this.pressedOpt = i; return true; }
      }
      return false;
    } else if (type === "end") {
      if (isRevealing) {
        this.pressedOpt = null;
        this.pressedSubmit = false;
        this.pressedItem = null;
        return true;
      }
      // 道具按钮
      if (this.pressedItem) {
        const it = this.pressedItem;
        const r = this.getItemRect(it);
        if (hitTest(lx, ly, r) && this.isItemEnabled(it, hud)) {
          this.engine?.useItem(it);
          playSfx("click");
          vibrateShort();
        }
        this.pressedItem = null;
        return true;
      }
      // 选项：点击即触发 engine.answer()（自动提交逻辑由 engine 处理）
      if (this.pressedOpt !== null) {
        const i = this.pressedOpt;
        if (hitTest(lx, ly, rects[i]) && !hud.fiftyRemoved.includes(i)) {
          this.engine?.answer(i);
          playSfx("click");
          vibrateShort();
        }
        this.pressedOpt = null;
      }
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
