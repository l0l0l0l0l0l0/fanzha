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
import { playSfx } from "@/engine/Audio";
import type { GameResultPayload } from "@/types";

export interface ResultOverlayCallbacks {
  onRetry?: () => void;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
}

export class ResultOverlay {
  private director: SceneDirector;
  private result: GameResultPayload;
  private cb: ResultOverlayCallbacks;
  private recorded = false;
  private enterT = 0;
  private pulse = 0;
  private pressedButton: string | null = null;

  constructor(director: SceneDirector, result: GameResultPayload, cb: ResultOverlayCallbacks = {}) {
    this.director = director;
    this.result = result;
    this.cb = cb;
    this.recordOnce();
  }

  private recordOnce(): void {
    if (this.recorded) return;
    this.recorded = true;
    const r = this.result;
    platformStore.recordGame({
      gameId: r.gameId,
      score: r.score,
      busted: r.bustedCount ?? 0,
      durationSec: 0,
    });
  }

  update(dt: number): void {
    this.enterT = Math.min(1, this.enterT + dt * 4);
    this.pulse += dt;
  }

  /** 是否已激活（有 result 即激活） */
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
        if (pressed === "retry" && this.cb.onRetry) this.cb.onRetry();
        else if (pressed === "next" && this.cb.onNext) this.cb.onNext();
        else if (pressed === "back" && this.cb.onBack) this.cb.onBack();
        else if (pressed === "share") {
          const game = getGame(this.result.gameId);
          shareAppMessage({
            title: `我在《${game.title}》中${this.result.win ? "识破" : "挑战"}了 ${this.result.bustedCount ?? this.result.wave ?? 0} 次诈骗，得分 ${this.result.score}。全民反诈，天下无诈！`,
          });
        }
        return true;
      }
      return true;
    }
    return true;
  }

  private getButtonRects(screenW: number, screenH: number): Record<string, Rect> {
    const w = Math.min(340, screenW - 32);
    const h = 420;
    const px = (screenW - w) / 2;
    const py = (screenH - h) / 2;
    const pad = 16;
    const btnW = (w - pad * 3) / 2;
    const btnH = 38;
    const btnY = py + h - btnH - 16;
    const hasNext = !!this.cb.onNext;

    const rects: Record<string, Rect> = {};
    if (hasNext) {
      rects.next = { x: px + pad, y: btnY, w: btnW, h: btnH };
      rects.retry = { x: px + pad * 2 + btnW, y: btnY, w: btnW, h: btnH };
    } else {
      rects.retry = { x: px + pad, y: btnY, w: btnW, h: btnH };
    }
    const backX = hasNext ? px + pad : px + pad * 2 + btnW;
    rects.back = { x: backX, y: btnY + btnH + 8, w: btnW, h: btnH };
    rects.share = { x: px + pad * 2 + btnW, y: btnY + btnH + 8, w: btnW, h: btnH };
    return rects;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const game = getGame(this.result.gameId);
    const accent = game.accent;
    const tip = TIPS.find((t) => t.id === this.result.tipId) ?? TIPS[0];
    const t = this.enterT;

    drawModalOverlay(ctx, screenW, screenH);

    ctx.save();
    ctx.globalAlpha = t;

    const w = Math.min(340, screenW - 32);
    const h = 420;
    const px = (screenW - w) / 2;
    const py = (screenH - h) / 2 - 20 * (1 - t);

    drawPanel(ctx, px, py, w, h, { borderColor: withAlpha(accent, 0.6), cut: 10 });

    // 顶部渐变线
    ctx.save();
    const lg = ctx.createLinearGradient(px, py, px + w, py);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, accent);
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(px, py, w, 1);
    ctx.restore();

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
    ctx.shadowBlur = 16;
    ctx.fillText(this.result.win ? "战斗胜利" : "战斗结束", px + w / 2, py + 36);
    ctx.restore();

    // 统计卡片
    const cardW = (w - 16 * 3) / 2;
    const cardH = 70;
    const cardY = py + 84;
    const statLabel = this.result.wave !== undefined
      ? "最高波数"
      : this.result.destroyRate !== undefined
        ? "摧毁率"
        : "击败数";
    const statValue = this.result.wave !== undefined
      ? `${this.result.wave}`
      : this.result.destroyRate !== undefined
        ? `${Math.round(this.result.destroyRate * 100)}%`
        : `${this.result.bustedCount ?? 0}`;
    drawStatCard(ctx, px + 16, cardY, cardW, cardH, {
      label: "本局得分", value: this.result.score.toLocaleString(), color: accent,
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

    // 按钮组
    const rects = this.getButtonRects(screenW, screenH);
    const btnW = (w - 16 * 3) / 2;
    const btnH = 38;

    if (this.cb.onNext) {
      drawButton(ctx, rects.next.x, rects.next.y, btnW, btnH, this.cb.nextLabel || "下一关", {
        variant: "primary", accent, pressed: this.pressedButton === "next",
      });
      drawButton(ctx, rects.retry.x, rects.retry.y, btnW, btnH, "再来一局", {
        variant: "primary", accent, pressed: this.pressedButton === "retry",
      });
    } else {
      drawButton(ctx, rects.retry.x, rects.retry.y, btnW, btnH, "再来一局", {
        variant: "primary", accent, pressed: this.pressedButton === "retry",
      });
    }
    drawButton(ctx, rects.back.x, rects.back.y, btnW, btnH, "返回 Hub", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "back",
    });
    drawButton(ctx, rects.share.x, rects.share.y, btnW, btnH, "", {
      variant: "ghost", accent: Theme.colors.neon.DEFAULT, pressed: this.pressedButton === "share",
    });
    drawIcon(ctx, "share", rects.share.x + btnW / 2 - 8, rects.share.y + btnH / 2 - 8, 16, Theme.colors.neon.DEFAULT);

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
