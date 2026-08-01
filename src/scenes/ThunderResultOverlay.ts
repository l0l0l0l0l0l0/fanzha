/**
 * 雷霆反诈专属结算/死亡复盘组件
 * - 失败：红色卡片「你被 XX 诈骗击中」+ 真实案例 + 识别要点 + 防护清单 + 96110 拨打按钮
 * - 胜利：击杀分布条形图 + BOSS 击败时间轴 + 最高连击曲线 + 称号晋升 + 难度/模式徽章
 * 接口与 ResultOverlay 兼容，可由 ThunderScene 直接替换使用。
 */
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawPanel, drawButton, drawStatCard, drawBadge, drawNeonCorners,
  hitTest, type Rect,
} from "@/ui/widgets";
import { platformStore } from "@/store/platformStore";
import { vibrateShort } from "@/platform/web";
import { playSfx } from "@/engine/Audio";
import { ParticleSystem } from "@/engine/Particle";
import { postFX } from "@/engine/PostFX";
import { roundRect } from "@/engine/Renderer";
import { ENEMIES, titleFor, DIFFICULTIES, type ThunderFinalStats } from "@/games/thunder/data";
import type { GameResultPayload } from "@/types";
import type { ThunderFraudArchive, ThunderSeasonPassReward } from "@/games/thunder/types";

export interface ThunderResultCallbacks {
  onRetry?: () => void;
  onBack?: () => void;
}

const MODE_LABEL: Record<string, string> = {
  campaign: "战役模式",
  endless: "无尽模式",
  daily: "每日挑战",
  bossRush: "BOSS连战",
  weekly: "周常挑战",
  survival: "生存防守",
  challenge: "极限挑战",
  ranked: "段位赛",
};

/** deathCause 缺失时的通用回退文案 */
const FALLBACK_DEATH = {
  fraudType: "电信网络诈骗",
  emoji: "⚠",
  name: "诈骗分子",
  identifyDetail: [
    "陌生来电提及转账、验证码、安全账户",
    "要求屏幕共享或下载未知 APP",
    "「稳赚不赔」「内部消息」核心话术",
  ],
  protectList: [
    "立即挂断，自行拨打 96110 核实",
    "不点击未知链接，不下载未知 APP",
    "验证码、密码绝不外泄",
  ],
  caseStory: "受害人被诈骗话术诱导转账，造成财产损失。",
};

export class ThunderResultOverlay {
  private director: SceneDirector;
  private result: GameResultPayload;
  private cb: ThunderResultCallbacks;
  private stats: ThunderFinalStats | null;
  private enterT = 0;
  private pulse = 0;
  private pressedButton: string | null = null;
  private lostGlitchDone = false;
  private particles = new ParticleSystem();
  private displayedScore = 0;
  private isNewRecord = false;
  private recorded = false;
  private unlockedAchievements: { name: string; desc: string; emoji: string; color: string }[] = [];
  /** 96110 拨打提示 toast 消失时刻（pulse 时间轴） */
  private hotlineToastUntil = 0;
  /** v4：分享战报 toast 消失时刻 */
  private shareToastUntil = 0;
  /** v4：分享战报文案 */
  private shareText = "";

  constructor(director: SceneDirector, result: GameResultPayload, cb: ThunderResultCallbacks = {}) {
    this.director = director;
    this.result = result;
    this.cb = cb;
    this.stats = (result.stats as unknown as ThunderFinalStats) ?? null;
    this.recordOnce();
  }

  /** v2 升级：记录一局游戏到全局 platformStore（更新 bestScores / totalFoolsBusted / 图鉴 / 成就） */
  private recordOnce(): void {
    if (this.recorded) return;
    this.recorded = true;
    const r = this.result;
    // 捕获是否破纪录（recordGame 会更新 bestScores）
    const prevBest = platformStore.state.bestScores[r.gameId] || 0;
    this.isNewRecord = r.score > prevBest && r.score > 0;
    // 提取图鉴解锁（由 ThunderScene.onResult 注入）
    const unlockedTypes = (r as GameResultPayload & { unlockedTypes?: string[] }).unlockedTypes ?? [];
    // 完整字段传入，触发各种成就判定
    const newly = platformStore.recordGame({
      gameId: r.gameId,
      score: r.score,
      busted: r.bustedCount ?? 0,
      unlockedTypes,
      durationSec: this.stats?.elapsedSec ?? 0,
      win: r.win,
      wave: r.wave,
      maxCombo: r.maxCombo,
    });
    if (newly.length > 0) {
      this.unlockedAchievements = newly.map((a) => ({ name: a.name, desc: a.desc, emoji: "🏆", color: a.color }));
      playSfx("good");
    }
  }

  /** v4：生成可分享的战报文案 */
  private buildShareText(): string {
    const r = this.result;
    const s = this.stats;
    const modeLabel = s ? (MODE_LABEL[s.mode] ?? s.mode) : "雷霆反诈";
    const diffLabel = s ? (DIFFICULTIES[s.difficulty]?.name ?? s.difficulty) : "";
    const lines: string[] = [];
    lines.push("⚡ 雷霆反诈 · 战报");
    lines.push(`模式：${modeLabel}${diffLabel ? ` · ${diffLabel}` : ""}`);
    lines.push(`结果：${r.win ? "✅ 反诈胜利" : "❌ 反诈失利"}`);
    lines.push(`识破分：${r.score.toLocaleString()}`);
    if (s) {
      lines.push(`击败 BOSS：${s.bossesDefeated} · 最高连击：×${s.maxCombo}`);
      lines.push(`用时：${Math.round(s.elapsedSec)}s · 波次：${s.wave}`);
    }
    lines.push("—— 守护钱包，从识破每一句话术开始");
    return lines.join("\n");
  }

  /** v4：尝试复制到剪贴板（浏览器环境） */
  private tryCopyToClipboard(text: string): void {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => { /* ignore */ });
      } else if (typeof document !== "undefined") {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch { /* ignore */ }
        document.body.removeChild(ta);
      }
    } catch { /* ignore */ }
  }

  update(dt: number): void {
    // 0.5s 入场
    this.enterT = Math.min(1, this.enterT + dt * 2);
    this.pulse += dt;
    this.displayedScore += (this.result.score - this.displayedScore) * Math.min(1, dt * 6);
    this.particles.update(dt);

    // 胜利彩屑
    if (this.result.win && this.enterT > 0.4) {
      const screenW = this.director.screenWidth;
      const palette = ["#FFD666", "#00E5FF", "#52C41A", "#FF7A1A", "#B388FF"];
      for (let i = 0; i < 2; i++) {
        this.particles.spawn({
          x: Math.random() * screenW,
          y: -10,
          count: 1,
          speed: 60 + Math.random() * 50,
          life: 2 + Math.random(),
          size: 3 + Math.random() * 2,
          color: palette[Math.floor(Math.random() * palette.length)],
          type: "debris",
          gravity: 80,
          friction: 0.99,
          angle: Math.PI / 2 + (Math.random() - 0.5) * 0.6,
        });
      }
    }

    // 失败 glitch：仅触发一次
    if (!this.result.win && this.enterT > 0.2 && !this.lostGlitchDone) {
      this.lostGlitchDone = true;
      postFX.glitch(0.6, 3);
      postFX.flash("#E5353B", 0.3, 3);
    }
  }

  get active(): boolean { return true; }

  handleTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const rects = this.getButtonRects(screenW, screenH);

    if (type === "start") {
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
        if (pressed === "hotline") {
          // 浏览器无法真正拨号，仅提示用户手动拨打
          this.hotlineToastUntil = this.pulse + 2.5;
        } else if (pressed === "retry") {
          this.cb.onRetry?.();
        } else if (pressed === "back") {
          this.cb.onBack?.();
        } else if (pressed === "share") {
          // v4：生成战报文案并尝试复制到剪贴板
          this.shareText = this.buildShareText();
          this.shareToastUntil = this.pulse + 2.5;
          this.tryCopyToClipboard(this.shareText);
        }
        return true;
      }
      return true;
    }
    return true;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.result.win) {
      this.renderWin(ctx, screenW, screenH);
    } else {
      this.renderLoss(ctx, screenW, screenH);
    }
    this.particles.render(ctx);
    // v4：分享战报 toast
    if (this.shareToastUntil > 0 && this.pulse < this.shareToastUntil) {
      this.renderShareToast(ctx, screenW, screenH);
    }
  }

  /** v4：分享战报成功提示 */
  private renderShareToast(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number): void {
    const txt = "📋 战报已复制到剪贴板";
    ctx.save();
    ctx.font = `600 12px ${Theme.fonts.mono}`;
    const tw = ctx.measureText(txt).width + 28;
    const th = 28;
    const tx = (screenW - tw) / 2;
    const ty = 60;
    roundRect(ctx, tx, ty, tw, th, 6);
    ctx.fillStyle = "rgba(10,25,41,0.95)";
    ctx.fill();
    ctx.strokeStyle = withAlpha("#52C41A", 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#52C41A";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, tx + tw / 2, ty + th / 2);
    ctx.restore();
  }

  // ============ 失败死亡复盘 ============

  private renderLoss(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 全屏红色暗化遮罩 + glitch 闪烁
    ctx.save();
    ctx.fillStyle = "rgba(40,8,12,0.85)";
    ctx.fillRect(0, 0, screenW, screenH);
    const flicker = 0.04 + 0.05 * Math.abs(Math.sin(this.pulse * 18));
    ctx.fillStyle = `rgba(229,53,59,${flicker})`;
    for (let y = 0; y < screenH; y += 4) {
      ctx.fillRect(0, y, screenW, 1);
    }
    ctx.restore();

    const dc = this.stats?.deathCause ?? FALLBACK_DEATH;
    const w = Math.min(360, screenW - 32);
    const h = Math.min(this.lossPanelH(), screenH - 16);
    const px = (screenW - w) / 2;
    // 卡片从下方滑入 + 透明度淡入
    const slideY = 40 * (1 - this.enterT);
    const py = Math.max(8, (screenH - h) / 2) + slideY;

    ctx.save();
    ctx.globalAlpha = this.enterT;

    // 红色卡片
    drawPanel(ctx, px, py, w, h, {
      bgColor: "#1A0810",
      borderColor: withAlpha("#E5353B", 0.7),
      cut: 10,
      borderWidth: 1.5,
    });
    drawNeonCorners(ctx, px, py, w, h, "#E5353B", undefined, undefined, 8);

    // 顶部标题
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#FF5A60", 0.8);
    ctx.fillText("ANTI-FRAUD · 雷霆失利", px + w / 2, py + 16);
    ctx.font = `700 20px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FF5A60";
    ctx.shadowColor = "rgba(229,53,59,0.5)";
    ctx.shadowBlur = 12 + Math.sin(this.pulse * 3) * 4;
    ctx.fillText("⚠ 反诈失利", px + w / 2, py + 32);
    ctx.shadowBlur = 0;
    ctx.font = `700 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(`你被「${dc.fraudType}」击中`, px + w / 2, py + 60);
    ctx.restore();

    // emoji + 诈骗类型头部
    const headY = py + 92;
    ctx.save();
    ctx.font = `700 38px ${Theme.fonts.display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(dc.emoji, px + 42, headY + 22);
    ctx.textAlign = "left";
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("FRAUD TYPE", px + 78, headY + 8);
    ctx.font = `700 15px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FF5A60";
    ctx.fillText(dc.name || dc.fraudType, px + 78, headY + 28);
    ctx.restore();

    // 分隔线
    const sepY = headY + 52;
    ctx.save();
    const lg = ctx.createLinearGradient(px + 16, sepY, px + w - 16, sepY);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, withAlpha("#E5353B", 0.5));
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(px + 16, sepY, w - 32, 1);
    ctx.restore();

    let cy = sepY + 10;

    // 真实案例简述
    if (dc.caseStory) {
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.78);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const lines = wrapText(ctx, `真实案例：${dc.caseStory}`, w - 32);
      lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, px + 16, cy + i * 15));
      ctx.restore();
      cy += Math.min(3, lines.length) * 15 + 8;
    }

    // 识别要点
    const identify = dc.identifyDetail ?? [];
    if (identify.length > 0) {
      cy = this.drawListSection(ctx, px + 16, cy, w - 32, "识别要点", "▸", identify, "#FF5A60");
      cy += 6;
    }

    // 防护清单
    const protect = dc.protectList ?? [];
    if (protect.length > 0) {
      this.drawListSection(ctx, px + 16, cy, w - 32, "防护清单", "✓", protect, Theme.colors.safe.DEFAULT);
    }

    // 96110 拨打提示 toast
    if (this.hotlineToastUntil > 0 && this.pulse < this.hotlineToastUntil) {
      const rects = this.getButtonRects(screenW, screenH);
      const r = rects.hotline;
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      const txt = "请手动拨打 96110";
      const tw = ctx.measureText(txt).width + 20;
      const tx = r.x + r.w / 2 - tw / 2;
      const ty = r.y - 26;
      roundRect(ctx, tx, ty, tw, 20, 4);
      ctx.fillStyle = "rgba(10,25,41,0.92)";
      ctx.fill();
      ctx.strokeStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, tx + tw / 2, ty + 10);
      ctx.restore();
    }

    // 按钮
    const rects = this.getButtonRects(screenW, screenH);
    drawButton(ctx, rects.hotline.x, rects.hotline.y, rects.hotline.w, rects.hotline.h, "拨打 96110 反诈专线", {
      variant: "danger", accent: "#E5353B", pressed: this.pressedButton === "hotline", fontSize: 15,
    });
    drawButton(ctx, rects.retry.x, rects.retry.y, rects.retry.w, rects.retry.h, "再反诈一局", {
      variant: "primary", accent: "#E5353B", pressed: this.pressedButton === "retry",
    });
    drawButton(ctx, rects.back.x, rects.back.y, rects.back.w, rects.back.h, "返回 Hub", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "back",
    });

    ctx.restore();
  }

  /** 绘制带前缀的列表小节，返回下一个 y 坐标 */
  private drawListSection(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number,
    title: string, prefix: string, items: string[], color: string,
  ): number {
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(title, x, y);
    ctx.font = `400 11px ${Theme.fonts.body}`;
    let cy = y + 16;
    for (const item of items) {
      ctx.fillStyle = color;
      ctx.fillText(prefix, x, cy);
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
      const lines = wrapText(ctx, item, w - 16);
      lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, x + 14, cy + i * 15));
      cy += Math.min(2, lines.length) * 15;
    }
    ctx.restore();
    return cy;
  }

  private lossPanelH(): number {
    const dc = this.stats?.deathCause ?? FALLBACK_DEATH;
    let h = 92; // 标题区
    h += 52; // emoji 头部
    h += 10; // 分隔线
    if (dc.caseStory) h += 3 * 15 + 8;
    const identify = dc.identifyDetail ?? [];
    if (identify.length > 0) h += 16 + identify.length * 2 * 15 + 6;
    const protect = dc.protectList ?? [];
    if (protect.length > 0) h += 16 + protect.length * 2 * 15;
    h += 12; // hotline 前留白
    h += 44 + 8 + 44 + 16; // hotline + 间距 + retry/back + 底部留白
    return h;
  }

  private lossButtonRects(screenW: number, screenH: number): Record<string, Rect> {
    const w = Math.min(360, screenW - 32);
    const h = Math.min(this.lossPanelH(), screenH - 16);
    const px = (screenW - w) / 2;
    const py = Math.max(8, (screenH - h) / 2);
    const pad = 16;
    const btnH = 44;
    const rowY = py + h - pad - btnH;
    const hotlineY = rowY - 8 - btnH;
    const btnW = (w - pad * 3) / 2;
    return {
      hotline: { x: px + pad, y: hotlineY, w: w - pad * 2, h: btnH },
      retry: { x: px + pad, y: rowY, w: btnW, h: btnH },
      back: { x: px + pad * 2 + btnW, y: rowY, w: btnW, h: btnH },
    };
  }

  // ============ 胜利专属结算 ============

  private renderWin(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 全屏深蓝暗化遮罩 + 金色边光
    ctx.save();
    ctx.fillStyle = "rgba(6,14,30,0.88)";
    ctx.fillRect(0, 0, screenW, screenH);
    const grad = ctx.createRadialGradient(screenW / 2, 0, 0, screenW / 2, 0, screenH * 0.6);
    grad.addColorStop(0, "rgba(255,214,102,0.12)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    const s = this.stats;
    const w = Math.min(420, screenW - 32);
    const h = Math.min(this.winPanelH(), screenH - 16);
    const px = (screenW - w) / 2;
    const py = Math.max(8, (screenH - h) / 2);

    ctx.save();
    ctx.globalAlpha = this.enterT;

    drawPanel(ctx, px, py, w, h, {
      bgColor: "#0C1A2E",
      borderColor: withAlpha("#FFD666", 0.5),
      cut: 10,
      borderWidth: 1.5,
    });
    drawNeonCorners(ctx, px, py, w, h, "#FFD666", undefined, undefined, 8);

    // 新纪录徽章
    if (this.isNewRecord) {
      const blink = 0.6 + 0.4 * Math.sin(this.pulse * 6);
      ctx.save();
      ctx.globalAlpha = this.enterT * blink;
      drawBadge(ctx, px + w - 110, py + 18, "★ NEW RECORD", "rgba(255,214,102,0.22)", "#FFD666");
      ctx.restore();
    }

    // 标题
    const sub = s ? (s.endless ? `无尽波次 ${s.wave}` : "战役通关") : "反诈胜利";
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha("#FFD666", 0.8);
    ctx.fillText("THUNDER JUDGEMENT", px + w / 2, py + 16);
    ctx.font = `700 26px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFD666";
    ctx.shadowColor = "rgba(255,214,102,0.45)";
    ctx.shadowBlur = 14 + Math.sin(this.pulse * 3) * 5;
    ctx.fillText("雷霆审判完成", px + w / 2, py + 32);
    ctx.shadowBlur = 0;
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(sub, px + w / 2, py + 66);
    ctx.restore();

    // 三栏统计卡片
    const cardY = py + 92;
    const cardW = (w - 16 * 4) / 3;
    const cardH = 70;
    ctx.save();
    ctx.globalAlpha = this.enterT * this.stag(0.1);
    drawStatCard(ctx, px + 16, cardY, cardW, cardH, {
      label: "本局识破分", value: Math.floor(this.displayedScore).toLocaleString(), color: "#FFD666",
    });
    drawStatCard(ctx, px + 16 * 2 + cardW, cardY, cardW, cardH, {
      label: "击败 BOSS", value: `${s?.bossesDefeated ?? 0}`, color: "#B388FF",
    });
    drawStatCard(ctx, px + 16 * 3 + cardW * 2, cardY, cardW, cardH, {
      label: "最高连击", value: `×${s?.maxCombo ?? 0}`, color: "#00E5FF",
    });
    ctx.restore();
    let cy = cardY + cardH + 16;

    // 难度/模式徽章
    if (s) {
      ctx.save();
      ctx.globalAlpha = this.enterT * this.stag(0.15);
      const diff = DIFFICULTIES[s.difficulty];
      const modeLabel = MODE_LABEL[s.mode] ?? s.mode;
      let bx = px + 16;
      const by = cy;
      if (diff) {
        const r = drawBadge(ctx, bx, by, `难度 · ${diff.name}`, withAlpha(diff.color, 0.18), diff.color);
        bx += r.w + 8;
      }
      drawBadge(ctx, bx, by, modeLabel, withAlpha(Theme.colors.neon.DEFAULT, 0.18), Theme.colors.neon.DEFAULT);
      ctx.restore();
      cy += 26;
    }

    // 击杀分布条形图
    if (s && s.killStats && Object.keys(s.killStats).length > 0) {
      ctx.save();
      ctx.globalAlpha = this.enterT * this.stag(0.2);
      cy = this.drawKillChart(ctx, px + 16, cy, w - 32, s);
      ctx.restore();
      cy += 8;
    }

    // BOSS 击败时间轴
    if (s && s.bossKillTimes && s.bossKillTimes.length > 0) {
      ctx.save();
      ctx.globalAlpha = this.enterT * this.stag(0.3);
      cy = this.drawBossTimeline(ctx, px + 16, cy, w - 32, s);
      ctx.restore();
      cy += 8;
    }

    // v4：BossRush 各阶段用时
    if (s && s.bossRushStages && s.bossRushStages.length > 0) {
      ctx.save();
      ctx.globalAlpha = this.enterT * this.stag(0.35);
      cy = this.drawBossRushStages(ctx, px + 16, cy, w - 32, s);
      ctx.restore();
      cy += 8;
    }

    // v5：段位赛 / 擦弹 / 案例剧场
    if (s) {
      ctx.save();
      ctx.globalAlpha = this.enterT * this.stag(0.38);
      cy = this.drawV5Stats(ctx, px + 16, cy, w - 32, s);
      ctx.restore();
      cy += 8;
    }

    // v6 升级：格挡 / 口诀 / AI 对话识破 / 档案 / 通行证
    if (s) {
      ctx.save();
      ctx.globalAlpha = this.enterT * this.stag(0.39);
      cy = this.drawV6Stats(ctx, px + 16, cy, w - 32, s);
      ctx.restore();
      cy += 8;
    }

    // 最高连击曲线
    if (s && s.comboHistory && s.comboHistory.length > 1) {
      ctx.save();
      ctx.globalAlpha = this.enterT * this.stag(0.4);
      cy = this.drawComboCurve(ctx, px + 16, cy, w - 32, s);
      ctx.restore();
      cy += 8;
    }

    // 称号晋升
    if (s) {
      ctx.save();
      ctx.globalAlpha = this.enterT * this.stag(0.5);
      this.drawTitlePromotion(ctx, px + 16, cy, w - 32, s.score);
      ctx.restore();
    }

    // 按钮
    const rects = this.getButtonRects(screenW, screenH);
    ctx.save();
    ctx.globalAlpha = this.enterT * this.stag(0.6);
    drawButton(ctx, rects.retry.x, rects.retry.y, rects.retry.w, rects.retry.h, "再反诈一局", {
      variant: "primary", accent: "#FFD666", pressed: this.pressedButton === "retry",
    });
    drawButton(ctx, rects.back.x, rects.back.y, rects.back.w, rects.back.h, "返回 Hub", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "back",
    });
    drawButton(ctx, rects.share.x, rects.share.y, rects.share.w, rects.share.h, "分享战报", {
      variant: "hard", accent: Theme.colors.neon.DEFAULT, pressed: this.pressedButton === "share",
    });
    ctx.restore();

    ctx.restore();
  }

  /** 击杀分布横向条形图（前 6 项，按数量降序） */
  private drawKillChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: ThunderFinalStats): number {
    const entries = Object.entries(s.killStats)
      .map(([typeId, count]) => ({ typeId, count, def: ENEMIES[typeId] }))
      .filter((e) => e.def)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("击杀分布", x, y);
    ctx.restore();
    if (entries.length === 0) return y + 20;
    const maxCount = Math.max(1, ...entries.map((e) => e.count));
    let cy = y + 18;
    const rowH = 18;
    const barX = x + 88;
    const barW = Math.max(20, w - 88 - 40);
    for (const e of entries) {
      const def = e.def!;
      ctx.save();
      ctx.font = `700 13px ${Theme.fonts.body}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(def.emoji, x, cy + rowH / 2);
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.8);
      ctx.fillText(def.name, x + 20, cy + rowH / 2);
      // 背景条
      roundRect(ctx, barX, cy + 3, barW, rowH - 6, 3);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      // 填充条
      const fw = barW * (e.count / maxCount);
      if (fw > 0) {
        roundRect(ctx, barX, cy + 3, fw, rowH - 6, 3);
        ctx.fillStyle = def.color;
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // 数量
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = def.color;
      ctx.textAlign = "right";
      ctx.fillText(`${e.count}`, x + w, cy + rowH / 2);
      ctx.restore();
      cy += rowH;
    }
    return cy;
  }

  /** BOSS 击败时间轴 */
  private drawBossTimeline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: ThunderFinalStats): number {
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("BOSS 击败时间轴", x, y);
    ctx.restore();
    const axisY = y + 36;
    const axisX0 = x + 16;
    const axisX1 = x + w - 16;
    const axisW = axisX1 - axisX0;
    const total = Math.max(1, s.elapsedSec);
    ctx.save();
    // 主轴
    ctx.strokeStyle = withAlpha(Theme.colors.bg.line, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(axisX0, axisY);
    ctx.lineTo(axisX1, axisY);
    ctx.stroke();
    // 起止标签
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("0s", axisX0, axisY + 6);
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(total)}s`, axisX1, axisY + 6);
    // BOSS 节点
    for (const b of s.bossKillTimes) {
      const nx = axisX0 + Math.max(0, Math.min(1, b.atSec / total)) * axisW;
      ctx.strokeStyle = "#B388FF";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(nx, axisY - 10);
      ctx.lineTo(nx, axisY);
      ctx.stroke();
      ctx.fillStyle = "#B388FF";
      ctx.beginPath();
      ctx.arc(nx, axisY, 4, 0, Math.PI * 2);
      ctx.shadowColor = "#B388FF";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      // emoji
      ctx.font = `700 12px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(b.emoji, nx, axisY - 12);
      // 名称（截断 6 字）
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.7);
      const nm = b.name.length > 6 ? b.name.slice(0, 6) + "…" : b.name;
      ctx.fillText(nm, nx, axisY - 26);
    }
    ctx.restore();
    return axisY + 22;
  }

  /** v4：BossRush 各阶段用时列表 */
  private drawBossRushStages(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: ThunderFinalStats): number {
    const stages = s.bossRushStages ?? [];
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const totalLabel = s.bossRushTotalTimeSec != null ? ` · 总用时 ${s.bossRushTotalTimeSec.toFixed(1)}s` : "";
    ctx.fillText(`BOSS 连战阶段${totalLabel}`, x, y);
    ctx.restore();
    let cy = y + 18;
    const rowH = 20;
    for (const st of stages) {
      ctx.save();
      // 阶段编号
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF00E5";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`第 ${st.stage} 战`, x, cy + rowH / 2);
      // emoji + 名称
      ctx.font = `700 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.fillText(`${st.emoji} ${st.bossName}`, x + 56, cy + rowH / 2);
      // 用时
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "right";
      ctx.fillText(`${st.timeSec.toFixed(1)}s`, x + w, cy + rowH / 2);
      ctx.restore();
      cy += rowH;
    }
    return cy;
  }

  /** v5 结算区块：段位赛 / 擦弹统计 / 案例剧场 */
  private drawV5Stats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: ThunderFinalStats): number {
    let cy = y;
    // 段位赛结算
    if (s.rankDelta !== undefined) {
      ctx.save();
      ctx.font = `700 13px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("段位赛结算", x, cy);
      cy += 20;
      // 新段位徽章
      if (s.rankNewTierEmoji && s.rankNewTierName) {
        ctx.font = `600 16px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#B388FF";
        ctx.fillText(`${s.rankNewTierEmoji} ${s.rankNewTierName}`, x, cy);
        cy += 22;
      }
      // 积分变化
      const delta = s.rankDelta;
      const deltaColor = delta >= 0 ? "#52C41A" : "#FF4D4F";
      const deltaText = delta >= 0 ? `+${delta}` : `${delta}`;
      ctx.font = `700 18px ${Theme.fonts.mono}`;
      ctx.fillStyle = deltaColor;
      ctx.textAlign = "left";
      ctx.fillText(`积分 ${deltaText}`, x, cy);
      // 晋升/降级提示
      if (s.rankTierUp) {
        ctx.font = `600 12px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#FFD666";
        ctx.fillText("▲ 段位晋升！", x + 120, cy + 4);
      } else if (s.rankTierDown) {
        ctx.font = `600 12px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#FF4D4F";
        ctx.fillText("▼ 段位降级", x + 120, cy + 4);
      }
      cy += 26;
      ctx.restore();
    }
    // 擦弹统计
    if (s.grazeCount !== undefined && s.grazeCount > 0) {
      ctx.save();
      ctx.font = `600 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`擦弹次数：${s.grazeCount}`, x, cy);
      cy += 18;
      ctx.restore();
    }
    // 案例剧场触发卡片
    if (s.caseTheaterTrigger) {
      const ct = s.caseTheaterTrigger;
      ctx.save();
      const cardH = 80;
      // 卡片背景
      ctx.fillStyle = "rgba(255,0,229,0.08)";
      ctx.strokeStyle = "rgba(255,0,229,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(x, cy, w, cardH);
      ctx.fill();
      ctx.stroke();
      // 标题
      ctx.font = `700 13px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF00E5";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`🎬 案例剧场：${ct.emoji} ${ct.bossName}`, x + 10, cy + 8);
      // 案例文案（截断到 2 行）
      ctx.font = `500 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      const lines = wrapText(ctx, ct.caseStory, w - 20);
      for (let i = 0; i < Math.min(2, lines.length); i++) {
        ctx.fillText(lines[i], x + 10, cy + 30 + i * 16);
      }
      // 底部提示
      ctx.font = `600 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF00E5";
      ctx.textAlign = "right";
      ctx.fillText("点击查看详情 →", x + w - 10, cy + cardH - 16);
      ctx.restore();
      cy += cardH + 8;
    }
    return cy;
  }

  /** v6 升级：格挡 / 口诀 / AI 对话识破 / 档案解锁 / 通行证奖励 统计区块 */
  private drawV6Stats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: ThunderFinalStats): number {
    let cy = y;
    const hasParry = (s.parryCount ?? 0) > 0;
    const hasMantra = (s.mantraTriggeredCount ?? 0) > 0;
    const hasAIDialog = (s.aiDialogBustedCount ?? 0) > 0;
    const hasArchives = s.unlockedArchives && s.unlockedArchives.length > 0;
    const hasSeasonPass = (s.seasonPassGainedExp ?? 0) > 0 || (s.seasonPassUnlockedRewards && s.seasonPassUnlockedRewards.length > 0);
    if (!hasParry && !hasMantra && !hasAIDialog && !hasArchives && !hasSeasonPass) return cy;

    // 区块标题
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FF00E5";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("v6 反诈新技能", x, cy);
    cy += 20;
    ctx.restore();

    // 三栏统计：格挡 / 口诀 / AI识破
    if (hasParry || hasMantra || hasAIDialog) {
      ctx.save();
      const statW = (w - 16) / 3;
      const statH = 44;
      const items = [
        { label: "格挡反击", value: s.parryCount ?? 0, color: "#3B7FEF", emoji: "🛡️" },
        { label: "口诀连招", value: s.mantraTriggeredCount ?? 0, color: "#00E5FF", emoji: "🔤" },
        { label: "AI识破", value: s.aiDialogBustedCount ?? 0, color: "#FF00E5", emoji: "💬" },
      ];
      for (let i = 0; i < 3; i++) {
        const sx = x + i * (statW + 8);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        roundRect(ctx, sx, cy, statW, statH, 6);
        ctx.fill();
        ctx.strokeStyle = withAlpha(items[i].color, 0.4);
        ctx.lineWidth = 1;
        roundRect(ctx, sx, cy, statW, statH, 6);
        ctx.stroke();
        ctx.font = `700 16px ${Theme.fonts.mono}`;
        ctx.fillStyle = items[i].color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${items[i].emoji} ×${items[i].value}`, sx + statW / 2, cy + 16);
        ctx.font = `500 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.fillText(items[i].label, sx + statW / 2, cy + 32);
      }
      ctx.restore();
      cy += statH + 8;
    }

    // 诈骗溯源档案解锁列表
    if (hasArchives) {
      const archives: ThunderFraudArchive[] = s.unlockedArchives!;
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#00E5FF";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`📁 解锁档案 ×${archives.length}`, x, cy);
      cy += 16;
      const archH = 22;
      const maxShow = 3;
      for (let i = 0; i < Math.min(maxShow, archives.length); i++) {
        const a = archives[i];
        ctx.fillStyle = "rgba(0,229,255,0.06)";
        roundRect(ctx, x, cy, w, archH, 4);
        ctx.fill();
        ctx.strokeStyle = withAlpha("#00E5FF", 0.3);
        ctx.lineWidth = 1;
        roundRect(ctx, x, cy, w, archH, 4);
        ctx.stroke();
        ctx.font = `600 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#00E5FF";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const title = a.title.length > 24 ? a.title.slice(0, 22) + "…" : a.title;
        ctx.fillText(`📄 ${title}`, x + 8, cy + archH / 2);
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.textAlign = "right";
        ctx.fillText(a.date, x + w - 8, cy + archH / 2);
        cy += archH + 4;
      }
      if (archives.length > maxShow) {
        ctx.font = `600 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.textAlign = "right";
        ctx.fillText(`+${archives.length - maxShow} 个更多`, x + w, cy);
        cy += 14;
      }
      ctx.restore();
      cy += 4;
    }

    // 赛季通行证奖励
    if (hasSeasonPass) {
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FFD666";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const expText = (s.seasonPassGainedExp ?? 0) > 0 ? `🏆 赛季通行证 +${s.seasonPassGainedExp} EXP` : "🏆 赛季通行证奖励";
      ctx.fillText(expText, x, cy);
      cy += 16;
      const rewards: ThunderSeasonPassReward[] = s.seasonPassUnlockedRewards ?? [];
      if (rewards.length > 0) {
        const maxShow = 4;
        const pillH = 22;
        const pillGap = 4;
        for (let i = 0; i < Math.min(maxShow, rewards.length); i++) {
          const r = rewards[i];
          ctx.fillStyle = "rgba(255,214,102,0.08)";
          roundRect(ctx, x, cy, w, pillH, 4);
          ctx.fill();
          ctx.strokeStyle = withAlpha("#FFD666", 0.4);
          ctx.lineWidth = 1;
          roundRect(ctx, x, cy, w, pillH, 4);
          ctx.stroke();
          ctx.font = `600 10px ${Theme.fonts.mono}`;
          ctx.fillStyle = "#FFD666";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const name = r.amount > 1 ? `${r.emoji} ${r.name} ×${r.amount}` : `${r.emoji} ${r.name}`;
          ctx.fillText(name, x + 8, cy + pillH / 2);
          ctx.font = `400 8px ${Theme.fonts.mono}`;
          ctx.fillStyle = Theme.colors.ink.muted;
          ctx.textAlign = "right";
          ctx.fillText(r.type, x + w - 8, cy + pillH / 2);
          cy += pillH + pillGap;
        }
        if (rewards.length > maxShow) {
          ctx.font = `600 9px ${Theme.fonts.mono}`;
          ctx.fillStyle = Theme.colors.ink.muted;
          ctx.textAlign = "right";
          ctx.fillText(`+${rewards.length - maxShow} 个更多`, x + w, cy);
          cy += 14;
        }
      }
      ctx.restore();
      cy += 4;
    }
    return cy;
  }

  /** 最高连击曲线（折线图，峰值标注 MAX ×N） */
  private drawComboCurve(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: ThunderFinalStats): number {
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("最高连击曲线", x, y);
    ctx.restore();
    const chartY = y + 18;
    const chartH = 70;
    const chartX = x;
    const chartW = w;
    const hist = s.comboHistory;
    const maxT = hist.length ? hist[hist.length - 1].t : 1;
    const maxC = Math.max(1, s.maxCombo, ...hist.map((h) => h.combo));
    ctx.save();
    roundRect(ctx, chartX, chartY, chartW, chartH, 4);
    ctx.fillStyle = "rgba(0,229,255,0.04)";
    ctx.fill();
    // 网格线
    ctx.strokeStyle = "rgba(0,229,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const gy = chartY + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(chartX, gy);
      ctx.lineTo(chartX + chartW, gy);
      ctx.stroke();
    }
    // 折线 + 填充
    if (hist.length >= 2) {
      const pad = 6;
      const innerW = chartW - pad * 2;
      const innerH = chartH - pad * 2;
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      hist.forEach((p, i) => {
        const px2 = chartX + pad + (p.t / maxT) * innerW;
        const py2 = chartY + chartH - pad - (p.combo / maxC) * innerH;
        if (i === 0) ctx.moveTo(px2, py2);
        else ctx.lineTo(px2, py2);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 区域填充
      ctx.lineTo(chartX + pad + innerW, chartY + chartH - pad);
      ctx.lineTo(chartX + pad, chartY + chartH - pad);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,229,255,0.12)";
      ctx.fill();
    }
    // 峰值标注
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`MAX ×${s.maxCombo}`, chartX + chartW - 6, chartY + 4);
    ctx.restore();
    return chartY + chartH;
  }

  /** 称号晋升展示 */
  private drawTitlePromotion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, score: number): number {
    const { title, next, gap } = titleFor(score);
    const boxH = 56;
    ctx.save();
    roundRect(ctx, x, y, w, boxH, 6);
    ctx.fillStyle = withAlpha(title.color, 0.08);
    ctx.fill();
    ctx.strokeStyle = withAlpha(title.color, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    // 左侧色条
    ctx.fillStyle = title.color;
    ctx.fillRect(x, y, 3, boxH);
    // 称号标签
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("当前称号", x + 12, y + 10);
    // 称号名
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = title.color;
    ctx.shadowColor = withAlpha(title.color, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(title.name, x + 12, y + 26);
    ctx.shadowBlur = 0;
    // 距下一称号
    ctx.textAlign = "right";
    if (next) {
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("距下一称号", x + w - 12, y + 12);
      ctx.font = `700 13px ${Theme.fonts.mono}`;
      ctx.fillStyle = next.color;
      ctx.fillText(`${gap.toLocaleString()} 分`, x + w - 12, y + 28);
    } else {
      ctx.font = `700 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = title.color;
      ctx.fillText("已满级", x + w - 12, y + 22);
    }
    ctx.restore();
    return y + boxH;
  }

  private winPanelH(): number {
    const s = this.stats;
    let h = 92; // 标题区
    h += 70 + 16; // 统计卡片 + 间距
    if (s) h += 26; // 徽章
    if (s && s.killStats && Object.keys(s.killStats).length > 0) {
      const n = Math.min(6, Object.keys(s.killStats).length);
      h += 18 + n * 18 + 8;
    }
    if (s && s.bossKillTimes && s.bossKillTimes.length > 0) {
      h += 18 + 36 + 22 + 8;
    }
    // v4：BossRush 阶段列表
    if (s && s.bossRushStages && s.bossRushStages.length > 0) {
      h += 18 + s.bossRushStages.length * 20 + 8;
    }
    // v5：段位赛 / 擦弹 / 案例剧场（粗略估算）
    if (s) {
      if (s.rankDelta !== undefined) h += 20 + 22 + 26;
      if (s.grazeCount !== undefined && s.grazeCount > 0) h += 18;
      if (s.caseTheaterTrigger) h += 80 + 8;
    }
    // v6：格挡 / 口诀 / AI识破 / 档案 / 通行证
    if (s) {
      const hasParry = (s.parryCount ?? 0) > 0;
      const hasMantra = (s.mantraTriggeredCount ?? 0) > 0;
      const hasAIDialog = (s.aiDialogBustedCount ?? 0) > 0;
      const hasArchives = s.unlockedArchives && s.unlockedArchives.length > 0;
      const hasSeasonPass = (s.seasonPassGainedExp ?? 0) > 0 || (s.seasonPassUnlockedRewards && s.seasonPassUnlockedRewards.length > 0);
      if (hasParry || hasMantra || hasAIDialog || hasArchives || hasSeasonPass) {
        h += 20; // 标题
        if (hasParry || hasMantra || hasAIDialog) h += 44 + 8;
        if (hasArchives) {
          h += 16 + Math.min(3, s.unlockedArchives!.length) * 26 + 4;
          if (s.unlockedArchives!.length > 3) h += 14;
        }
        if (hasSeasonPass) {
          h += 16;
          const rewards = s.seasonPassUnlockedRewards ?? [];
          if (rewards.length > 0) {
            h += Math.min(4, rewards.length) * 26 + 4;
            if (rewards.length > 4) h += 14;
          }
        }
        h += 8;
      }
    }
    if (s && s.comboHistory && s.comboHistory.length > 1) {
      h += 18 + 70 + 8;
    }
    if (s) h += 56; // 称号晋升
    h += 16 + 44 + 16; // 按钮区 + 底部留白
    return h;
  }

  private winButtonRects(screenW: number, screenH: number): Record<string, Rect> {
    const w = Math.min(420, screenW - 32);
    const h = Math.min(this.winPanelH(), screenH - 16);
    const px = (screenW - w) / 2;
    const py = Math.max(8, (screenH - h) / 2);
    const pad = 16;
    const gap = 8;
    const btnH = 44;
    const btnY = py + h - pad - btnH;
    const btnW = (w - pad * 2 - gap * 2) / 3;
    return {
      retry: { x: px + pad, y: btnY, w: btnW, h: btnH },
      back: { x: px + pad + btnW + gap, y: btnY, w: btnW, h: btnH },
      share: { x: px + pad + (btnW + gap) * 2, y: btnY, w: btnW, h: btnH },
    };
  }

  private getButtonRects(screenW: number, screenH: number): Record<string, Rect> {
    return this.result.win
      ? this.winButtonRects(screenW, screenH)
      : this.lossButtonRects(screenW, screenH);
  }

  /** 错落淡入：返回某延迟下的局部透明度 0..1 */
  private stag(delay: number): number {
    return Math.max(0, Math.min(1, (this.enterT - delay) / 0.25));
  }
}

/** 文本换行辅助（逐字符测量，兼容中英混排） */
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
