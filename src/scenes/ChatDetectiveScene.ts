/**
 * 聊天鉴诈 · 杀猪盘（第 5 个街机游戏）
 *
 * 玩法：以「反诈观察员」视角查看朋友小林与"现役军官陈志远"的聊天记录，
 * 点击气泡圈出诈骗破绽（共 TOTAL_FLAWS 处）。点中破绽展开解析卡，
 * 误点扣分，可用「提示」定位（限 3 次，扣分）。全部找齐后结算，
 * 调用 platformStore.recordGame 回写最佳成绩与累计识破。
 *
 * 布局（letterbox 列宽 DW ≤ 480）：
 * - 顶栏 0-56（返回 + 标题 + 重开）
 * - 任务条 56-90（进度提示）
 * - 聊天区 90 .. screenH-72（可滚动，气泡 + 解析卡）
 * - 底栏 screenH-72 .. screenH（进度条 + 提示按钮）
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawPanel, drawButton, drawModalOverlay, drawProgressBar,
  drawGlowButton, drawStars, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { roundRect, clamp } from "@/engine/Renderer";
import { playSfx } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import { platformStore } from "@/store/platformStore";
import { MESSAGES, TOTAL_FLAWS, TIPS, type ChatMessage } from "@/games/chatDetective/data";

const ACCENT = "#FF5A8A";
const DESIGN_W_CAP = 480;
const TOP_H = 56;
const MISSION_H = 34;
const BOTTOM_H = 72;
const BUBBLE_FONT = 14;
const BUBBLE_LH = 20;
const ANA_FONT = 12;
const ANA_LH = 18;
const MAX_HINTS = 3;

interface BubbleLayout {
  msg: ChatMessage;
  /** 气泡矩形（聊天内容坐标系，y 从 0 开始） */
  x: number; y: number; w: number; h: number;
  lines: string[];
  /** 已识破时的解析卡矩形 */
  ana?: { x: number; y: number; w: number; h: number; lines: string[] };
}

export class ChatDetectiveScene extends Scene {
  private t = 0;
  private startT = 0;

  private scrollY = 0;
  private scrollTarget = -1;
  private contentH = 600;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragged = false;
  private touching = false;

  private busted = new Set<number>();
  private miss = 0;
  private hintsUsed = 0;
  /** 提示高亮的消息 id 与截止时间 */
  private hintMsgId = -1;
  private hintUntil = 0;

  private pressedButton: string | null = null;
  private toastMsg = "";
  private toastUntil = 0;

  private finishAt = -1;
  private showResult = false;
  private recorded = false;
  private finalScore = 0;

  /** 布局缓存（宽度或识破集合变化时重算） */
  private layoutKey = "";
  private layoutItems: BubbleLayout[] = [];

  constructor(director: SceneDirector) {
    super(director);
  }

  enter(): void {
    super.enter();
    this.restart();
  }

  private restart(): void {
    this.t = 0;
    this.startT = 0;
    this.scrollY = 0;
    this.scrollTarget = -1;
    this.busted.clear();
    this.miss = 0;
    this.hintsUsed = 0;
    this.hintMsgId = -1;
    this.hintUntil = 0;
    this.toastMsg = "";
    this.finishAt = -1;
    this.showResult = false;
    this.recorded = false;
    this.finalScore = 0;
    this.layoutKey = "";
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;

    // 提示自动滚动
    if (this.scrollTarget >= 0) {
      const diff = this.scrollTarget - this.scrollY;
      if (Math.abs(diff) < 2) { this.scrollY = this.scrollTarget; this.scrollTarget = -1; }
      else this.scrollY += diff * Math.min(1, dt * 8);
    }

    // 全部识破 → 延迟结算
    if (this.finishAt > 0 && this.t >= this.finishAt && !this.showResult) {
      this.showResult = true;
      this.finalScore = this.computeScore();
      if (!this.recorded) {
        this.recorded = true;
        platformStore.recordGame({
          gameId: "chat-detective",
          score: this.finalScore,
          busted: TOTAL_FLAWS,
          durationSec: Math.round(this.t - this.startT),
          win: true,
        });
      }
      playSfx("rankUp");
      postFX.flash(ACCENT, 0.3);
    }
  }

  private computeScore(): number {
    return Math.max(100, TOTAL_FLAWS * 100 - this.miss * 15 - this.hintsUsed * 20);
  }

  // ===================== 几何 =====================
  private getDW(screenW: number): number { return Math.min(screenW, DESIGN_W_CAP); }
  private getGX(screenW: number): number { return Math.max(0, (screenW - this.getDW(screenW)) / 2); }
  private chatTop(): number { return TOP_H + MISSION_H; }
  private chatViewH(screenH: number): number { return screenH - this.chatTop() - BOTTOM_H; }

  private getBackRect(screenW: number): Rect {
    return { x: this.getGX(screenW) + 8, y: 10, w: 40, h: 36 };
  }
  private getRestartRect(screenW: number): Rect {
    const gx = this.getGX(screenW);
    return { x: gx + this.getDW(screenW) - 48, y: 10, w: 40, h: 36 };
  }
  private getHintRect(screenW: number, screenH: number): Rect {
    const gx = this.getGX(screenW);
    return { x: gx + this.getDW(screenW) - 116, y: screenH - BOTTOM_H + 14, w: 100, h: 44 };
  }

  // ===================== 布局 =====================
  private wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = ch;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  private ensureLayout(ctx: CanvasRenderingContext2D, screenW: number): void {
    const DW = this.getDW(screenW);
    const key = `${DW}|${[...this.busted].sort((a, b) => a - b).join(",")}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.layoutItems = [];

    const gx = this.getGX(screenW);
    const pad = 14;
    const avatarW = 34;
    const maxTextW = DW - avatarW * 2 - 90;
    let y = 16;

    ctx.save();
    for (const msg of MESSAGES) {
      ctx.font = `500 ${BUBBLE_FONT}px ${Theme.fonts.body}`;
      const lines = this.wrapLines(ctx, msg.text, maxTextW);
      let lineMax = 0;
      for (const l of lines) lineMax = Math.max(lineMax, ctx.measureText(l).width);
      const bw = Math.ceil(lineMax) + pad * 2;
      const bh = lines.length * BUBBLE_LH + pad * 2 - 6;
      const isScam = msg.who === "scam";
      const bx = isScam ? gx + 12 + avatarW + 8 : gx + DW - 12 - avatarW - 8 - bw;

      const item: BubbleLayout = { msg, x: bx, y, w: bw, h: bh, lines };
      y += bh;

      // 已识破 → 解析卡（通栏宽）
      if (msg.flaw && this.busted.has(msg.id)) {
        ctx.font = `400 ${ANA_FONT}px ${Theme.fonts.body}`;
        const anaW = DW - 24 - avatarW - 8;
        const anaLines = this.wrapLines(ctx, msg.flaw.d, anaW - 24);
        const anaH = 30 + anaLines.length * ANA_LH + 12;
        item.ana = { x: gx + 12 + avatarW + 8, y: y + 6, w: anaW, h: anaH, lines: anaLines };
        y += anaH + 6;
      }
      y += 14;
      this.layoutItems.push(item);
    }
    ctx.restore();
    this.contentH = y + 20;
  }

  // ===================== 渲染 =====================
  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const gx = this.getGX(screenW);
    const DW = this.getDW(screenW);

    // 背景（微信式深色聊天底 + 品牌深蓝）
    ctx.fillStyle = Theme.colors.bg.deep;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.fillStyle = "rgba(15, 30, 48, 0.9)";
    ctx.fillRect(gx, 0, DW, screenH);
    if (gx > 4) {
      ctx.strokeStyle = withAlpha(ACCENT, 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, 0); ctx.lineTo(gx, screenH);
      ctx.moveTo(gx + DW, 0); ctx.lineTo(gx + DW, screenH);
      ctx.stroke();
    }

    this.ensureLayout(ctx, screenW);

    // 聊天区（裁剪滚动）
    const top = this.chatTop();
    const viewH = this.chatViewH(screenH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, top, DW, viewH);
    ctx.clip();
    ctx.translate(0, top - this.scrollY);
    this.renderChat(ctx, screenW);
    ctx.restore();

    // 固定栏
    this.renderTopBar(ctx, screenW);
    this.renderMissionBar(ctx, screenW);
    this.renderBottomBar(ctx, screenW, screenH);
    this.renderToast(ctx, screenW, screenH);

    if (this.showResult) this.renderResult(ctx, screenW, screenH);
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    const gx = this.getGX(screenW);
    const DW = this.getDW(screenW);
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.95)";
    ctx.fillRect(gx, 0, DW, TOP_H);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(gx, TOP_H - 1, DW, 1);
    ctx.restore();

    const back = this.getBackRect(screenW);
    drawButton(ctx, back.x, back.y, back.w, back.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", back.x + back.w / 2 - 10, back.y + back.h / 2 - 10, 20, Theme.colors.ink.muted);

    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `700 17px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText("聊天鉴诈 · 杀猪盘", gx + DW / 2, 22);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(ACCENT, 0.9);
    ctx.fillText("对方：陈志远（自称现役军官）", gx + DW / 2, 42);
    ctx.restore();

    const rs = this.getRestartRect(screenW);
    drawButton(ctx, rs.x, rs.y, rs.w, rs.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "restart",
    });
    drawIcon(ctx, "rotate", rs.x + rs.w / 2 - 9, rs.y + rs.h / 2 - 9, 18, Theme.colors.ink.muted);
  }

  private renderMissionBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    const gx = this.getGX(screenW);
    const DW = this.getDW(screenW);
    ctx.save();
    ctx.fillStyle = withAlpha(ACCENT, 0.10);
    ctx.fillRect(gx, TOP_H, DW, MISSION_H);
    ctx.fillStyle = withAlpha(ACCENT, 0.35);
    ctx.fillRect(gx, TOP_H + MISSION_H - 1, DW, 1);
    drawIcon(ctx, "crosshair", gx + 12, TOP_H + 8, 18, ACCENT);
    ctx.font = `500 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(`帮小林止损：点击聊天气泡，圈出 ${TOTAL_FLAWS} 处诈骗破绽`, gx + 38, TOP_H + MISSION_H / 2 + 1);
    ctx.restore();
  }

  private renderChat(ctx: CanvasRenderingContext2D, screenW: number): void {
    const gx = this.getGX(screenW);
    const DW = this.getDW(screenW);
    const avatarW = 34;

    // 顶部时间胶囊
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("—— 好友申请通过第 3 天 ——", gx + DW / 2, 0);
    ctx.restore();

    for (const item of this.layoutItems) {
      const m = item.msg;
      const isScam = m.who === "scam";
      const isBusted = m.flaw && this.busted.has(m.id);
      const isHinted = m.id === this.hintMsgId && this.t < this.hintUntil;

      // 头像
      const ax = isScam ? gx + 12 : gx + DW - 12 - avatarW;
      ctx.save();
      ctx.fillStyle = isScam ? withAlpha(ACCENT, 0.22) : withAlpha(Theme.colors.neon.DEFAULT, 0.18);
      roundRect(ctx, ax, item.y, avatarW, avatarW, 8);
      ctx.fill();
      ctx.strokeStyle = isScam ? withAlpha(ACCENT, 0.6) : withAlpha(Theme.colors.neon.DEFAULT, 0.5);
      ctx.lineWidth = 1;
      roundRect(ctx, ax, item.y, avatarW, avatarW, 8);
      ctx.stroke();
      ctx.font = `700 15px ${Theme.fonts.display}`;
      ctx.fillStyle = isScam ? ACCENT : Theme.colors.neon.DEFAULT;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(isScam ? "陈" : "林", ax + avatarW / 2, item.y + avatarW / 2 + 1);
      ctx.restore();

      // 气泡
      ctx.save();
      const bubbleBg = isScam ? "#1A3050" : withAlpha(Theme.colors.safe.DEFAULT, 0.16);
      ctx.fillStyle = bubbleBg;
      roundRect(ctx, item.x, item.y, item.w, item.h, 10);
      ctx.fill();
      if (isBusted) {
        ctx.strokeStyle = Theme.colors.warn.glow;
        ctx.lineWidth = 2;
        ctx.shadowColor = Theme.colors.warn.DEFAULT;
        ctx.shadowBlur = 8;
        roundRect(ctx, item.x, item.y, item.w, item.h, 10);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (isHinted) {
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 5));
        ctx.strokeStyle = withAlpha(Theme.colors.flag.DEFAULT, pulse);
        ctx.lineWidth = 2;
        ctx.shadowColor = Theme.colors.flag.DEFAULT;
        ctx.shadowBlur = 10 * pulse;
        roundRect(ctx, item.x, item.y, item.w, item.h, 10);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // 正文
      ctx.font = `500 ${BUBBLE_FONT}px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      for (let i = 0; i < item.lines.length; i++) {
        ctx.fillText(item.lines[i], item.x + 14, item.y + 11 + i * BUBBLE_LH);
      }
      ctx.restore();

      // 识破角标
      if (isBusted) {
        const tagW = 52, tagH = 18;
        const tx = item.x + item.w - tagW + 8;
        const ty = item.y - 9;
        ctx.save();
        ctx.fillStyle = Theme.colors.warn.DEFAULT;
        roundRect(ctx, tx, ty, tagW, tagH, 9);
        ctx.fill();
        ctx.font = `700 10px ${Theme.fonts.body}`;
        ctx.fillStyle = "#FFF";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("破绽!", tx + tagW / 2, ty + tagH / 2 + 0.5);
        ctx.restore();
      }

      // 解析卡
      if (item.ana && m.flaw) {
        const a = item.ana;
        drawPanel(ctx, a.x, a.y, a.w, a.h, {
          borderColor: withAlpha(Theme.colors.warn.DEFAULT, 0.55),
          bgColor: "rgba(30, 16, 24, 0.92)", cut: 8,
        });
        ctx.save();
        drawIcon(ctx, "alert", a.x + 10, a.y + 8, 14, Theme.colors.warn.glow);
        ctx.font = `700 12px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.warn.glow;
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText(m.flaw.t, a.x + 30, a.y + 8);
        ctx.font = `400 ${ANA_FONT}px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.DEFAULT;
        for (let i = 0; i < a.lines.length; i++) {
          ctx.fillText(a.lines[i], a.x + 12, a.y + 30 + i * ANA_LH);
        }
        ctx.restore();
      }
    }
  }

  private renderBottomBar(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const gx = this.getGX(screenW);
    const DW = this.getDW(screenW);
    const y = screenH - BOTTOM_H;
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.95)";
    ctx.fillRect(gx, y, DW, BOTTOM_H);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(gx, y, DW, 1);
    ctx.restore();

    // 进度
    const found = this.busted.size;
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`破绽 ${found}/${TOTAL_FLAWS}`, gx + 16, y + 12);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`误点 ${this.miss} 次`, gx + 110, y + 15);
    ctx.restore();
    drawProgressBar(ctx, gx + 16, y + 36, DW - 148, 8, found / TOTAL_FLAWS, ACCENT);

    // 提示按钮
    const hint = this.getHintRect(screenW, screenH);
    const left = MAX_HINTS - this.hintsUsed;
    drawGlowButton(ctx, hint.x, hint.y, hint.w, hint.h, `提示 x${left}`, {
      variant: left > 0 ? "primary" : "ghost",
      accent: left > 0 ? Theme.colors.flag.DEFAULT : Theme.colors.ink.dim,
      pressed: this.pressedButton === "hint",
      fontSize: 14, cut: 6, glow: left > 0 ? 0.35 : 0, t: this.t,
    });
  }

  private renderToast(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.toastMsg || this.t > this.toastUntil) return;
    const w = Math.min(250, screenW - 40);
    const h = 38;
    const x = (screenW - w) / 2;
    const y = screenH - BOTTOM_H - h - 14;
    const fade = clamp((this.toastUntil - this.t) / 0.3, 0, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(10, 25, 41, 0.95)";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = withAlpha(Theme.colors.warn.DEFAULT, 0.5);
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
    ctx.font = `500 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(this.toastMsg, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }

  private renderResult(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawModalOverlay(ctx, screenW, screenH);
    const w = Math.min(340, screenW - 32);
    const h = 380;
    const x = (screenW - w) / 2;
    const y = (screenH - h) / 2;
    const reveal = clamp((this.t - this.finishAt) / 0.4, 0, 1);

    ctx.save();
    ctx.globalAlpha = reveal;
    drawPanel(ctx, x, y, w, h, {
      borderColor: withAlpha(ACCENT, 0.6), bgColor: "rgba(12, 22, 38, 0.98)", cut: 12,
    });

    const perfect = this.miss === 0 && this.hintsUsed === 0;
    const stars = perfect ? 3 : this.miss <= 2 && this.hintsUsed <= 1 ? 2 : 1;
    const rank = perfect ? "火眼金睛" : stars === 2 ? "反诈达人" : "继续修炼";

    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.safe.DEFAULT;
    ctx.fillText("— 止损成功 · 小林已醒悟 —", x + w / 2, y + 20);
    ctx.font = `700 30px ${Theme.fonts.display}`;
    ctx.fillStyle = ACCENT;
    ctx.shadowColor = withAlpha(ACCENT, 0.5); ctx.shadowBlur = 12;
    ctx.fillText(rank, x + w / 2, y + 44);
    ctx.shadowBlur = 0;
    ctx.restore();

    drawStars(ctx, x + w / 2 - 42, y + 90, stars, 3, 24, Theme.colors.flag.DEFAULT, this.t);

    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.font = `700 22px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(`${this.finalScore}`, x + w / 2, y + 126);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`识破 ${TOTAL_FLAWS} 处破绽 · 误点 ${this.miss} · 提示 ${this.hintsUsed}`, x + w / 2, y + 154);

    // 反诈锦囊
    ctx.textAlign = "left";
    ctx.font = `700 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.fillText("反诈锦囊", x + 22, y + 180);
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    for (let i = 0; i < TIPS.length; i++) {
      ctx.fillText(`· ${TIPS[i]}`, x + 22, y + 202 + i * 22);
    }
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("凡网恋 + 荐投资 = 杀猪盘 · 受骗立拨 96110", x + 22, y + 272);
    ctx.restore();

    const btnW = (w - 44 - 10) / 2, btnH = 44;
    const btnY = y + h - btnH - 20;
    drawButton(ctx, x + 22, btnY, btnW, btnH, "再玩一次", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "again",
    });
    drawGlowButton(ctx, x + 22 + btnW + 10, btnY, btnW, btnH, "返回主页", {
      variant: "primary", accent: ACCENT, pressed: this.pressedButton === "home",
      fontSize: 15, glow: 0.4, t: this.t,
    });
  }

  private getResultButtonRects(screenW: number, screenH: number): { again: Rect; home: Rect } {
    const w = Math.min(340, screenW - 32);
    const h = 380;
    const x = (screenW - w) / 2;
    const y = (screenH - h) / 2;
    const btnW = (w - 44 - 10) / 2, btnH = 44;
    const btnY = y + h - btnH - 20;
    return {
      again: { x: x + 22, y: btnY, w: btnW, h: btnH },
      home: { x: x + 22 + btnW + 10, y: btnY, w: btnW, h: btnH },
    };
  }

  // ===================== 交互 =====================
  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    // 结算覆盖层
    if (this.showResult) {
      const btns = this.getResultButtonRects(screenW, screenH);
      if (type === "start") {
        if (hitTest(x, y, btns.again)) this.pressedButton = "again";
        else if (hitTest(x, y, btns.home)) this.pressedButton = "home";
        return true;
      }
      if (type === "end") {
        if (this.pressedButton === "again" && hitTest(x, y, btns.again)) {
          playSfx("click"); this.restart();
        } else if (this.pressedButton === "home" && hitTest(x, y, btns.home)) {
          playSfx("click"); this.director.pop();
        }
        this.pressedButton = null;
        return true;
      }
      return true;
    }

    const back = this.getBackRect(screenW);
    const restart = this.getRestartRect(screenW);
    const hint = this.getHintRect(screenW, screenH);

    if (type === "start") {
      this.touching = true;
      this.dragged = false;
      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      if (hitTest(x, y, back)) { this.pressedButton = "back"; return true; }
      if (hitTest(x, y, restart)) { this.pressedButton = "restart"; return true; }
      if (hitTest(x, y, hint)) { this.pressedButton = "hint"; return true; }
      return false;
    }

    if (type === "move") {
      if (this.touching && !this.pressedButton) {
        const dy = y - this.dragStartY;
        if (Math.abs(dy) > 6) this.dragged = true;
        if (this.dragged) {
          this.scrollTarget = -1;
          const maxScroll = Math.max(0, this.contentH - this.chatViewH(screenH));
          this.scrollY = clamp(this.dragStartScroll - dy, 0, maxScroll);
        }
      }
      return false;
    }

    // end
    this.touching = false;
    if (this.pressedButton === "back") {
      if (hitTest(x, y, back)) { playSfx("click"); this.director.pop(); }
      this.pressedButton = null; return true;
    }
    if (this.pressedButton === "restart") {
      if (hitTest(x, y, restart)) { playSfx("click"); this.restart(); }
      this.pressedButton = null; return true;
    }
    if (this.pressedButton === "hint") {
      if (hitTest(x, y, hint)) this.useHint(screenH);
      this.pressedButton = null; return true;
    }
    if (!this.dragged) {
      this.onChatTap(x, y, screenW, screenH);
      return true;
    }
    return false;
  }

  private onChatTap(x: number, y: number, screenW: number, screenH: number): void {
    const top = this.chatTop();
    if (y < top || y > screenH - BOTTOM_H) return;
    const cy = y - top + this.scrollY; // 转换为聊天内容坐标
    for (const item of this.layoutItems) {
      if (x >= item.x && x <= item.x + item.w && cy >= item.y && cy <= item.y + item.h) {
        this.onBubbleTap(item.msg);
        return;
      }
    }
  }

  private onBubbleTap(msg: ChatMessage): void {
    if (msg.flaw && !this.busted.has(msg.id)) {
      // 识破！
      this.busted.add(msg.id);
      this.layoutKey = ""; // 触发重排（展开解析卡）
      playSfx("good");
      postFX.flash(Theme.colors.warn.DEFAULT, 0.18);
      if (this.busted.size >= TOTAL_FLAWS) this.finishAt = this.t + 1.0;
    } else if (msg.flaw && this.busted.has(msg.id)) {
      // 已识破，忽略
    } else {
      // 误点
      this.miss++;
      playSfx("bad");
      this.showToast(msg.who === "me" ? "小林是受害者，破绽在对方话术里" : "这句暂时没毛病，再想想");
    }
  }

  private useHint(screenH: number): void {
    if (this.hintsUsed >= MAX_HINTS) { this.showToast("提示次数已用完"); return; }
    const target = this.layoutItems.find((it) => it.msg.flaw && !this.busted.has(it.msg.id));
    if (!target) return;
    this.hintsUsed++;
    this.hintMsgId = target.msg.id;
    this.hintUntil = this.t + 2.6;
    playSfx("click");
    // 滚动到目标气泡
    const viewH = this.chatViewH(screenH);
    const maxScroll = Math.max(0, this.contentH - viewH);
    this.scrollTarget = clamp(target.y - viewH / 2 + target.h / 2, 0, maxScroll);
    this.showToast("金色高亮处有蹊跷…");
  }

  private showToast(msg: string): void {
    this.toastMsg = msg;
    this.toastUntil = this.t + 1.8;
  }
}
