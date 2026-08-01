/**
 * 结算卡片组件
 * 非独立 Scene，由各游戏场景持有并在 render 末尾叠加绘制
 * 进入时调用 platformStore.recordGame() 记录一次
 */
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawModalOverlay, drawPanel, drawButton, drawStatCard,
  drawHudLabel, drawBadge, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { getGame } from "@/data/games";
import { TIPS } from "@/data/tips";
import { platformStore } from "@/store/platformStore";
import { shareAppMessage, vibrateShort } from "@/platform/web";
import { canvasToBlob, shareImageWithFallback } from "@/platform/web";
import { renderBattleReportCanvas, type V7ManagerReportData, type FBReportData } from "@/utils/battleReport";
import { playSfx } from "@/engine/Audio";
import { ParticleSystem } from "@/engine/Particle";
import { postFX } from "@/engine/PostFX";
import { roundRect } from "@/engine/Renderer";
import type { Achievement } from "@/data/achievements";
import type { GameResultPayload } from "@/types";

export interface ResultOverlayCallbacks {
  onRetry?: () => void;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  /** 游戏专属额外统计渲染回调：返回绘制内容的高度（px），用于加高面板 */
  renderExtraStats?: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => number;
  /** v2：错题复盘入口回调（A5，提供时渲染"错题复盘"按钮） */
  onReview?: () => void;
  /** v2：错题复盘按钮文案 */
  reviewLabel?: string;
  /** v7：反诈职业经理人专属战报数据（仅 manager 模块传入，战报图追加 v7 区块） */
  v7ManagerData?: V7ManagerReportData;
  /** v3：是男人就反诈专属战报数据（仅 fraudBuster 模块传入，战报图追加 v3 区块） */
  fbReportData?: FBReportData;
}

export class ResultOverlay {
  private director: SceneDirector;
  private result: GameResultPayload;
  private cb: ResultOverlayCallbacks;
  private recorded = false;
  private enterT = 0;
  private pulse = 0;
  private pressedButton: string | null = null;
  /** 分数滚动显示值（lerp 向真实值） */
  private displayedScore = 0;
  private particles = new ParticleSystem();
  /** 失败 glitch 只触发一次的守门 */
  private lostGlitchDone = false;
  /** 本局新解锁的成就列表（由 recordGame 返回） */
  private unlockedAchievements: Achievement[] = [];
  /** 是否破纪录（在 recordOnce 前捕获） */
  private isNewRecord = false;
  /** v2：分享状态 */
  private shareState: "idle" | "busy" | "done" = "idle";
  private shareMessage = "";
  private shareStateUntil = 0;
  /** v3 Phase 3.4：完美一局庆祝状态 */
  private perfectBurstDone = false;
  private perfectMotto: string;

  constructor(director: SceneDirector, result: GameResultPayload, cb: ResultOverlayCallbacks = {}) {
    this.director = director;
    this.result = result;
    this.cb = cb;
    this.perfectMotto = PERFECT_MOTTOS[Math.floor(Math.random() * PERFECT_MOTTOS.length)];
    this.recordOnce();
  }

  /** v3 Phase 3.4：是否完美一局（零失误通关） */
  private get perfectRun(): boolean {
    return !!this.cb.fbReportData?.perfectRun && this.result.win;
  }

  private recordOnce(): void {
    if (this.recorded) return;
    this.recorded = true;
    const r = this.result;
    // 捕获是否破纪录（recordGame 会更新 bestScores）
    const prevBest = platformStore.state.bestScores[r.gameId] || 0;
    this.isNewRecord = r.score > prevBest && r.score > 0;
    // v3：从 stats.byType 提取本局遭遇的诈骗类型 ID，用于图鉴解锁
    const unlockedTypes = this.extractEncounteredTypes(r.stats);
    // 完整字段传入，触发各种成就判定
    this.unlockedAchievements = platformStore.recordGame({
      gameId: r.gameId,
      score: r.score,
      busted: r.bustedCount ?? 0,
      durationSec: 0,
      win: r.win,
      wave: r.wave,
      destroyRate: r.destroyRate,
      unlockedTypes,
    });
    if (this.unlockedAchievements.length > 0) {
      playSfx("good");
    }
  }

  /** v3：从游戏专属 stats 中提取遭遇的诈骗类型 ID（用于图鉴解锁） */
  private extractEncounteredTypes(stats: unknown): string[] {
    if (!stats || typeof stats !== "object") return [];
    const s = stats as { byType?: Record<string, { correct: number; total: number }> };
    if (!s.byType) return [];
    return Object.keys(s.byType).filter((k) => s.byType![k].total > 0);
  }

  /** v10：从 manager 游戏 stats 中提取本局学到的反诈知识点列表 */
  private extractLearnedFraudTips(): string[] {
    if (this.result.gameId !== "manager") return [];
    const stats = this.result.stats as { learnedFraudTips?: string[] } | undefined;
    if (!stats || !Array.isArray(stats.learnedFraudTips)) return [];
    return stats.learnedFraudTips.filter((t): t is string => typeof t === "string");
  }

  update(dt: number): void {
    this.enterT = Math.min(1, this.enterT + dt * 4);
    this.pulse += dt;
    // 分数滚动 lerp
    this.displayedScore += (this.result.score - this.displayedScore) * Math.min(1, dt * 6);
    // 粒子更新
    this.particles.update(dt);
    // 胜利彩屑：从屏幕顶部飘落
    if (this.result.win && this.enterT > 0.5) {
      const screenW = this.director.screenWidth;
      const screenH = this.director.screenHeight;
      // v3 Phase 3.4：完美一局使用金色主调 + 加密粒子 + 双向飘落
      const perfect = this.perfectRun;
      const palette = perfect
        ? ["#FFD666", "#FFE699", "#FFC53D", "#FFFBCC", "#FFF1B8"]
        : ["#FFD666", "#00E5FF", "#52C41A", "#FF7A1A"];
      const spawnCount = perfect ? 5 : 2;
      for (let i = 0; i < spawnCount; i++) {
        // 完美一局：顶部 + 左右两侧同时飘落，呈"金雨"效果
        const fromSide = perfect && Math.random() < 0.35;
        let sx: number, sy: number, sAngle: number;
        if (fromSide) {
          const fromLeft = Math.random() < 0.5;
          sx = fromLeft ? -10 : screenW + 10;
          sy = Math.random() * screenH * 0.6;
          sAngle = fromLeft
            ? Math.PI / 3 + (Math.random() - 0.5) * 0.4
            : (2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.4;
        } else {
          sx = Math.random() * screenW;
          sy = -10;
          sAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        }
        this.particles.spawn({
          x: sx,
          y: sy,
          count: 1,
          speed: 70 + Math.random() * 60,
          life: 2.4 + Math.random() * 1.2,
          size: 3 + Math.random() * (perfect ? 3 : 2),
          color: palette[Math.floor(Math.random() * palette.length)],
          type: "debris",
          gravity: 90,
          friction: 0.99,
          angle: sAngle,
        });
      }
    }
    // v3 Phase 3.4：完美一局开场金色爆发（仅触发一次）
    if (this.perfectRun && this.enterT > 0.3 && !this.perfectBurstDone) {
      this.perfectBurstDone = true;
      const cx = this.director.screenWidth / 2;
      const cy = this.director.screenHeight / 2;
      // 金色环形爆发
      this.particles.spawn({
        x: cx, y: cy, count: 32, speed: 220, life: 1.2,
        size: 4, color: "#FFD666", type: "spark",
        gravity: 0, friction: 0.94, angle: 0,
        spread: Math.PI * 2,
      });
      // 二次爆发：白金混色
      this.particles.spawn({
        x: cx, y: cy, count: 18, speed: 140, life: 1.6,
        size: 3, color: "#FFF1B8", type: "spark",
        gravity: 0, friction: 0.96, angle: 0,
        spread: Math.PI * 2,
      });
      // 金色闪屏
      postFX.flash("#FFD666", 0.5, 0.6);
    }
    // 失败 glitch：只触发一次
    if (!this.result.win && this.enterT > 0.3 && !this.lostGlitchDone) {
      this.lostGlitchDone = true;
      postFX.glitch(0.6, 3);
      postFX.flash("#E5353B", 0.3, 3);
    }
    // v2：分享状态超时复位
    if (this.shareState === "done" && this.pulse > this.shareStateUntil) {
      this.shareState = "idle";
      this.shareMessage = "";
    }
  }

  /** 是否已激活（有 result 即激活） */
  get active(): boolean { return true; }

  handleTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const rects = this.getButtonRects(screenW, screenH);

    if (type === "start") {
      // 分享进行中时禁止重复点击
      if (this.shareState === "busy") return true;
      for (const [name, rect] of Object.entries(rects)) {
        if (hitTest(x, y, rect)) { this.pressedButton = name; return true; }
      }
      return true; // 遮罩层消费所有触摸
    } else if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;
      if (pressed && rects[pressed] && hitTest(x, y, rects[pressed])) {
        playSfx("click");
        vibrateShort();
        if (pressed === "retry" && this.cb.onRetry) this.cb.onRetry();
        else if (pressed === "next" && this.cb.onNext) this.cb.onNext();
        else if (pressed === "back" && this.cb.onBack) this.cb.onBack();
        else if (pressed === "review" && this.cb.onReview) this.cb.onReview();
        else if (pressed === "share") {
          this.handleShare();
        }
        return true;
      }
      return true;
    }
    return true;
  }

  /** v2：处理分享 — 生成战报图并调用 Web Share / 下载 */
  private async handleShare(): Promise<void> {
    if (this.shareState === "busy") return;
    this.shareState = "busy";
    this.shareMessage = "生成战报...";
    try {
      const canvas = renderBattleReportCanvas({
        result: this.result,
        unlockedAchievements: this.unlockedAchievements,
        v7ManagerData: this.cb.v7ManagerData,
        fbReportData: this.cb.fbReportData,
      });
      const blob = await canvasToBlob(canvas, "image/png");
      if (!blob) {
        throw new Error("canvasToBlob 返回空");
      }
      const game = getGame(this.result.gameId);
      const filename = `anti-fraud-${this.result.gameId}-${Date.now()}.png`;
      const text = this.buildShareText();
      const result = await shareImageWithFallback({
        title: "反诈战报 · ANTI-FRAUD ARCADE",
        text,
        blob,
        filename,
      });
      this.shareMessage = result === "shared" ? "已分享"
        : result === "downloaded" ? "已保存到下载"
        : "已复制到剪贴板";
      postFX.flash(Theme.colors.neon.DEFAULT, 0.3);
    } catch (e) {
      console.warn("[share] 战报生成失败", e);
      // 回退到纯文本分享
      shareAppMessage({ title: this.buildShareText() });
      this.shareMessage = "已复制文本";
    }
    this.shareState = "done";
    this.shareStateUntil = this.pulse + 2.5; // 显示 2.5s
  }

  /**
   * v7/v3：构建分享文案（含模块专属信息：模式 / 真实案例 / 排行榜段位 / 受害者档案）
   * 文案降级：若无 v7/fb 数据，回退到 v2 通用文案
   */
  private buildShareText(): string {
    const game = getGame(this.result.gameId);
    const v7 = this.cb.v7ManagerData;
    const fb = this.cb.fbReportData;
    const count = this.result.bustedCount ?? this.result.wave ?? 0;
    const base = `我在《${game.title}》中${this.result.win ? "识破" : "挑战"}了 ${count} 次诈骗，得分 ${this.result.score}`;
    if (!v7 && !fb) {
      return `${base}。全民反诈，天下无诈！`;
    }
    const parts: string[] = [base];
    if (v7) {
      parts.push(`【${v7.modeLabel}】`);
      if (v7.towerFloor > 0) {
        parts.push(`爬塔 ${v7.towerFloor} 层`);
      }
      if (v7.realCase) {
        parts.push(`还原真实案例《${v7.realCase.title}》`);
      }
      if (v7.newlyCollectedTerms.length > 0) {
        parts.push(`新收集口诀 ${v7.newlyCollectedTerms.length} 句`);
      }
      if (v7.seasonRank) {
        parts.push(`当前段位 ${v7.seasonRank}`);
      }
    }
    if (fb) {
      parts.push(`【${fb.modeLabel}】`);
      if (fb.perfectRun) {
        parts.push("★ 完美一局");
      }
      if (fb.victimProfile) {
        parts.push(`画像 ${fb.victimProfile.name}`);
      }
      if (fb.caseArchives && fb.caseArchives.length > 0) {
        parts.push(`遭遇真实案例 ${fb.caseArchives.length} 个`);
      }
      const masteryPct = Math.round(fb.knowledgeMastery * 100);
      if (masteryPct > 0) {
        parts.push(`知识掌握 ${masteryPct}%`);
      }
      // 模式专属统计
      const ms = fb.modeStats;
      if (fb.mode === "speedrun" && ms.speedrunCorrect !== undefined) {
        parts.push(`${ms.speedrunCorrect}/${ms.speedrunTotal ?? 30} 正确`);
      } else if (fb.mode === "hardcore" && ms.hardcoreCorrect !== undefined) {
        parts.push(`连对 ${ms.hardcoreCorrect} 题`);
      } else if (fb.mode === "story" && ms.storyStagesCleared !== undefined) {
        parts.push(`通关 ${ms.storyStagesCleared}/6 关`);
      } else if (fb.mode === "daily" && ms.dailyCorrect !== undefined) {
        parts.push(`每日 ${ms.dailyCorrect}/10`);
      } else if (fb.mode === "review" && ms.reviewNightmareCleared !== undefined) {
        parts.push(`清除 ${ms.reviewNightmareCleared} 错题`);
      }
    }
    parts.push("全民反诈，天下无诈！");
    return parts.join("·");
  }

  private getButtonRects(screenW: number, screenH: number): Record<string, Rect> {
    const w = Math.min(340, screenW - 32);
    const h = Math.min(this.panelH, screenH - 16);
    const px = (screenW - w) / 2;
    const py = Math.max(8, (screenH - h) / 2);
    const pad = 16;
    const btnW = (w - pad * 3) / 2;
    const btnH = 38;
    const hasReview = !!this.cb.onReview;
    // 有 review 按钮时底部多一行：[review] 占满一行，[back][share] 在下一行
    const reviewRowH = hasReview ? btnH + 8 : 0;
    const btnY = py + h - btnH - 16 - reviewRowH;
    const hasNext = !!this.cb.onNext;

    const rects: Record<string, Rect> = {};
    if (hasNext) {
      rects.next = { x: px + pad, y: btnY, w: btnW, h: btnH };
      rects.retry = { x: px + pad * 2 + btnW, y: btnY, w: btnW, h: btnH };
    } else {
      rects.retry = { x: px + pad, y: btnY, w: btnW, h: btnH };
    }
    const bottomY = btnY + btnH + 8;
    const backX = hasNext ? px + pad : px + pad * 2 + btnW;
    rects.back = { x: backX, y: bottomY, w: btnW, h: btnH };
    rects.share = { x: px + pad * 2 + btnW, y: bottomY, w: btnW, h: btnH };
    // v2：错题复盘按钮（独占一行，全宽）
    if (hasReview) {
      rects.review = { x: px + pad, y: bottomY + btnH + 8, w: w - pad * 2, h: btnH };
    }
    return rects;
  }

  /** 面板高度：有新解锁成就时加高 60 像素以容纳成就行；有额外统计时按实测高度加高（首帧用默认 180）；有 review 按钮时再加一行 */
  private get panelH(): number {
    let h = this.unlockedAchievements.length > 0 ? 480 : 420;
    if (this.cb.renderExtraStats) {
      // 首帧 extraStatsH=0，使用默认估值 180；后续帧使用实测高度
      h += this.extraStatsH > 0 ? this.extraStatsH + 16 : 180;
    }
    if (this.cb.onReview) {
      // review 按钮独占一行（btnH + 上下间距）
      h += 38 + 16;
    }
    return h;
  }

  /** 额外统计区域高度（renderExtraStats 返回值的缓存） */
  private extraStatsH = 0;

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const game = getGame(this.result.gameId);
    const accent = game.accent;
    const tip = TIPS.find((t) => t.id === this.result.tipId) ?? TIPS[0];
    const t = this.enterT;

    drawModalOverlay(ctx, screenW, screenH);

    ctx.save();
    ctx.globalAlpha = t;

    const w = Math.min(340, screenW - 32);
    const h = Math.min(this.panelH, screenH - 16);
    const px = (screenW - w) / 2;
    const py = Math.max(8, (screenH - h) / 2 - 20 * (1 - t));

    drawPanel(ctx, px, py, w, h, { borderColor: withAlpha(accent, 0.6), cut: 10 });

    // v3 Phase 3.4：完美一局金色边框（动画发光描边 + 角落金饰）
    if (this.perfectRun) {
      const goldPulse = 0.6 + 0.4 * Math.sin(this.pulse * 2.5);
      ctx.save();
      // 外层金色辉光描边
      ctx.strokeStyle = withAlpha("#FFD666", 0.85 * goldPulse);
      ctx.lineWidth = 2;
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 18 * goldPulse;
      roundRect(ctx, px + 1, py + 1, w - 2, h - 2, 9);
      ctx.stroke();
      // 内层细金线
      ctx.shadowBlur = 0;
      ctx.strokeStyle = withAlpha("#FFF1B8", 0.55);
      ctx.lineWidth = 1;
      roundRect(ctx, px + 4, py + 4, w - 8, h - 8, 7);
      ctx.stroke();
      // 四角金饰（直角光带）
      const cornerLen = 18;
      ctx.strokeStyle = withAlpha("#FFD666", 0.95);
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 8;
      // 左上
      ctx.beginPath();
      ctx.moveTo(px + 2, py + cornerLen);
      ctx.lineTo(px + 2, py + 2);
      ctx.lineTo(px + cornerLen, py + 2);
      ctx.stroke();
      // 右上
      ctx.beginPath();
      ctx.moveTo(px + w - cornerLen, py + 2);
      ctx.lineTo(px + w - 2, py + 2);
      ctx.lineTo(px + w - 2, py + cornerLen);
      ctx.stroke();
      // 左下
      ctx.beginPath();
      ctx.moveTo(px + 2, py + h - cornerLen);
      ctx.lineTo(px + 2, py + h - 2);
      ctx.lineTo(px + cornerLen, py + h - 2);
      ctx.stroke();
      // 右下
      ctx.beginPath();
      ctx.moveTo(px + w - cornerLen, py + h - 2);
      ctx.lineTo(px + w - 2, py + h - 2);
      ctx.lineTo(px + w - 2, py + h - cornerLen);
      ctx.stroke();
      ctx.restore();
    }

    // 顶部渐变线
    ctx.save();
    const lg = ctx.createLinearGradient(px, py, px + w, py);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, this.perfectRun ? "#FFD666" : accent);
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(px, py, w, 1);
    ctx.restore();

    // v3 Phase 3.4：完美一局铭言横幅（标题上方，金色双线 + 铭言文字）
    if (this.perfectRun) {
      const mottoAlpha = Math.min(1, Math.max(0, (t - 0.15) / 0.4));
      ctx.save();
      ctx.globalAlpha = mottoAlpha;
      const mottoY = py + 8;
      // 左右金色短线
      ctx.strokeStyle = withAlpha("#FFD666", 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 24, mottoY + 5);
      ctx.lineTo(px + w / 2 - 90, mottoY + 5);
      ctx.moveTo(px + w / 2 + 90, mottoY + 5);
      ctx.lineTo(px + w - 24, mottoY + 5);
      ctx.stroke();
      // 铭言文字
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 6;
      ctx.fillText(`★ PERFECT · ${this.perfectMotto} ★`, px + w / 2, mottoY + 5);
      ctx.restore();
    }

    // 标题
    const titleColor = this.result.win ? Theme.colors.safe.DEFAULT : Theme.colors.flag.DEFAULT;
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${game.subtitle} · RESULT`, px + w / 2, py + 20);
    ctx.font = `700 28px ${Theme.fonts.display}`;
    ctx.fillStyle = titleColor;
    ctx.shadowColor = withAlpha(titleColor, 0.4);
    ctx.shadowBlur = 16 + Math.sin(this.pulse * 3) * 6;
    ctx.fillText(this.result.win ? "反诈胜利" : "反诈结束", px + w / 2, py + 36);
    ctx.restore();

    // 新纪录闪烁徽章（在标题右下方）
    if (this.isNewRecord) {
      const blink = 0.6 + 0.4 * Math.sin(this.pulse * 6);
      ctx.save();
      ctx.globalAlpha = blink;
      drawBadge(ctx, px + w - 96, py + 22, "★ NEW RECORD", "rgba(255,214,102,0.22)", "#FFD666");
      ctx.restore();
    }

    // 统计卡片
    const cardW = (w - 16 * 3) / 2;
    const cardH = 70;
    const cardY = py + 84;
    const statLabel = this.result.wave !== undefined
      ? "最高反诈波次"
      : this.result.destroyRate !== undefined
        ? "摧毁率"
        : "击败数";
    const statValue = this.result.wave !== undefined
      ? `${this.result.wave}`
      : this.result.destroyRate !== undefined
        ? `${Math.round(this.result.destroyRate * 100)}%`
        : `${this.result.bustedCount ?? 0}`;
    drawStatCard(ctx, px + 16, cardY, cardW, cardH, {
      label: "本局识破分", value: Math.floor(this.displayedScore).toLocaleString(), color: accent,
    });
    drawStatCard(ctx, px + 16 * 2 + cardW, cardY, cardW, cardH, {
      label: statLabel, value: statValue, color: accent,
    });

    // 反诈锦囊
    const tipY = cardY + cardH + 16;
    const tipH = 140;
    ctx.save();
    clipPanel(ctx, px + 16, tipY, w - 32, tipH, 8);
    ctx.fillStyle = withAlpha(accent, 0.05);
    ctx.fillRect(px + 16, tipY, w - 32, tipH);
    ctx.restore();
    // 左边框
    ctx.save();
    ctx.fillStyle = accent;
    ctx.fillRect(px + 16, tipY, 3, tipH);
    ctx.restore();

    drawIcon(ctx, "trophy", px + 28, tipY + 12, 14, accent);
    drawHudLabel(ctx, px + 46, tipY + 16, `反诈锦囊 · ${tip.source}`, accent);

    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(tip.title, px + 28, tipY + 38);
    ctx.restore();

    // 锦囊正文（换行）
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const tipLines = wrapText(ctx, tip.body, w - 56);
    tipLines.forEach((line, i) => ctx.fillText(line, px + 28, tipY + 62 + i * 17));
    ctx.restore();

    // 徽章
    const badgeY = tipY + tipH - 26;
    drawBadge(ctx, px + 28, badgeY, "96110 报警咨询", "rgba(229,53,59,0.2)", Theme.colors.warn.DEFAULT);
    drawBadge(ctx, px + 28 + 120, badgeY, "国家反诈中心 APP", "rgba(27,95,204,0.2)", Theme.colors.neon.DEFAULT);

    // v10：本局学到的反诈知识点卡片（仅 manager 游戏 + stats 中有 learnedFraudTips 时）
    let learnedTipsY = tipY + tipH + 8;
    const tips = this.extractLearnedFraudTips();
    if (tips.length > 0) {
      const tipsH = 28 + Math.ceil(tips.length / 3) * 22 + 12;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.3) / 0.4));
      clipPanel(ctx, px + 16, learnedTipsY, w - 32, tipsH, 8);
      ctx.fillStyle = "rgba(82,196,26,0.06)";
      ctx.fillRect(px + 16, learnedTipsY, w - 32, tipsH);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = "#52C41A";
      ctx.fillRect(px + 16, learnedTipsY, 3, tipsH);
      ctx.restore();
      drawIcon(ctx, "shield", px + 28, learnedTipsY + 10, 12, "#52C41A");
      drawHudLabel(ctx, px + 44, learnedTipsY + 12, `本局学到的反诈知识点（${tips.length} 条）`, "#52C41A");
      // 知识点 chips（3 列布局）
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const chipW = (w - 56) / 3;
      for (let i = 0; i < tips.length; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = px + 28 + col * chipW;
        const cy = learnedTipsY + 36 + row * 22;
        const label = tips[i].length > 14 ? tips[i].slice(0, 13) + "…" : tips[i];
        // chip 背景
        ctx.fillStyle = "rgba(82,196,26,0.12)";
        roundRect(ctx, cx, cy - 8, chipW - 6, 16, 8);
        ctx.fill();
        ctx.fillStyle = "#1F7A0D";
        ctx.fillText("✓ " + label, cx + 4, cy);
      }
      ctx.restore();
      learnedTipsY += tipsH + 4;
    }

    // 成就解锁行（如有）：错落入场，金色发光
    if (this.unlockedAchievements.length > 0) {
      const achY = learnedTipsY;
      const achH = 56;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.4) / 0.4));
      // 背景框
      clipPanel(ctx, px + 16, achY, w - 32, achH, 8);
      ctx.fillStyle = "rgba(255,214,102,0.08)";
      ctx.fillRect(px + 16, achY, w - 32, achH);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = "#FFD666";
      ctx.fillRect(px + 16, achY, 3, achH);
      ctx.restore();
      drawIcon(ctx, "award", px + 28, achY + 10, 12, "#FFD666");
      drawHudLabel(ctx, px + 44, achY + 12, `本局解锁 ${this.unlockedAchievements.length} 项成就`, "#FFD666");
      // 成就芯片行
      let chipX = px + 28;
      const chipY = achY + 30;
      for (let i = 0; i < this.unlockedAchievements.length; i++) {
        const a = this.unlockedAchievements[i];
        // 入场延迟
        const chipP = Math.min(1, Math.max(0, (t - 0.5 - i * 0.08) / 0.3));
        if (chipP <= 0) continue;
        ctx.save();
        ctx.globalAlpha = chipP;
        const chipText = a.name;
        ctx.font = `700 11px ${Theme.fonts.body}`;
        const textW = ctx.measureText(chipText).width;
        const chipW = textW + 30;
        if (chipX + chipW > px + w - 16) break; // 超出面板宽度则截断
        // 胶囊背景
        ctx.fillStyle = withAlpha(a.color, 0.18);
        ctx.strokeStyle = withAlpha(a.color, 0.7);
        ctx.lineWidth = 1;
        roundRect(ctx, chipX, chipY, chipW, 20, 10);
        ctx.fill();
        ctx.stroke();
        // 图标
        drawIcon(ctx, a.icon, chipX + 4, chipY + 3, 14, a.color);
        // 文字
        ctx.fillStyle = a.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(chipText, chipX + 22, chipY + 10);
        ctx.restore();
        chipX += chipW + 6;
      }
    }

    // 游戏专属额外统计（如反诈详细数据）
    if (this.cb.renderExtraStats) {
      const statsY = this.unlockedAchievements.length > 0
        ? tipY + tipH + 8 + 56 + 8
        : tipY + tipH + 8;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.5) / 0.4));
      this.extraStatsH = this.cb.renderExtraStats(ctx, px + 16, statsY, w - 32);
      ctx.restore();
    }

    // 按钮组
    const rects = this.getButtonRects(screenW, screenH);
    const btnW = (w - 16 * 3) / 2;
    const btnH = 38;

    if (this.cb.onNext) {
      drawButton(ctx, rects.next.x, rects.next.y, btnW, btnH, this.cb.nextLabel || "下一关", {
        variant: "primary", accent, pressed: this.pressedButton === "next",
      });
      drawButton(ctx, rects.retry.x, rects.retry.y, btnW, btnH, "再反诈一局", {
        variant: "primary", accent, pressed: this.pressedButton === "retry",
      });
    } else {
      drawButton(ctx, rects.retry.x, rects.retry.y, btnW, btnH, "再反诈一局", {
        variant: "primary", accent, pressed: this.pressedButton === "retry",
      });
    }
    drawButton(ctx, rects.back.x, rects.back.y, btnW, btnH, "返回 Hub", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "back",
    });
    drawButton(ctx, rects.share.x, rects.share.y, btnW, btnH, "", {
      variant: "ghost",
      accent: this.shareState === "done" ? Theme.colors.safe.DEFAULT : Theme.colors.neon.DEFAULT,
      pressed: this.pressedButton === "share",
    });
    if (this.shareState === "idle") {
      drawIcon(ctx, "share", rects.share.x + btnW / 2 - 8, rects.share.y + btnH / 2 - 8, 16, Theme.colors.neon.DEFAULT);
    } else if (this.shareState === "busy") {
      // 旋转加载指示器
      ctx.save();
      const cx = rects.share.x + btnW / 2;
      const cy = rects.share.y + btnH / 2;
      const r = 8;
      ctx.strokeStyle = Theme.colors.neon.DEFAULT;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      const start = this.pulse * 6;
      ctx.arc(cx, cy, r, start, start + Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();
    } else {
      // done：勾选图标 + 文字
      drawIcon(ctx, "check", rects.share.x + btnW / 2 - 22, rects.share.y + btnH / 2 - 8, 16, Theme.colors.safe.DEFAULT);
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(this.shareMessage, rects.share.x + btnW / 2 - 4, rects.share.y + btnH / 2 + 1);
      ctx.restore();
    }

    // v2：错题复盘按钮（独占一行，全宽，教育属性强调色）
    if (this.cb.onReview && rects.review) {
      const reviewW = rects.review.w;
      const reviewH = rects.review.h;
      drawButton(ctx, rects.review.x, rects.review.y, reviewW, reviewH, this.cb.reviewLabel || "📝 错题复盘 · 补漏挑战", {
        variant: "primary",
        accent: Theme.colors.warn.DEFAULT,
        pressed: this.pressedButton === "review",
      });
    }

    // 粒子层（彩屑叠在面板之上）
    this.particles.render(ctx);

    ctx.restore();
  }
}

// 辅助：斜切角面板裁剪（与 widgets.drawPanel 内部一致，用于自定义填充）
function clipPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, cut: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

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

/**
 * v3 Phase 3.4：完美一局（零失误通关）铭言池
 * 每次结算随机抽取一句，作为完美一局的纪念文案
 * 风格：四字 + 短句，反诈主题，金色铭文感
 */
const PERFECT_MOTTOS: string[] = [
  "百诈不侵",
  "火眼金睛",
  "明察秋毫",
  "一念之差·万诈不侵",
  "智勇双全·识破万千",
  "全民反诈·先锋无畏",
  "心如明镜·诈无可乘",
  "千局历练·一局无瑕",
  "反诈达人·完美无瑕",
  "天下无诈·从我做起",
];
