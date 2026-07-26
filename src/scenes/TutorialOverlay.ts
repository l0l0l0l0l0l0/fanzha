/**
 * 新手引导覆盖层（v7 D1）
 * 由各场景持有并在 render 末尾叠加绘制；首次进入时自动展示，点击"知道了"关闭并持久化。
 *
 * 设计要点：
 * - 半透明遮罩 + 居中信息卡，不阻断底层场景渲染（仅消费触摸）
 * - 支持多步骤要点列表（emoji + 文本）
 * - 关闭时调用 platformStore.completeTutorial(step) 持久化
 */
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawPanel, drawButton, hitTest, type Rect } from "@/ui/widgets";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort } from "@/platform/web";
import { roundRect } from "@/engine/Renderer";

export type TutorialStep = "deploy" | "battle" | "progression" | "codex" | "season";

export interface TutorialContent {
  step: TutorialStep;
  title: string;
  emoji: string;
  accent: string;
  /** 要点列表（每条：emoji + 文本） */
  tips: { emoji: string; text: string }[];
  /** 按钮文案 */
  buttonLabel?: string;
}

export class TutorialOverlay {
  private director: SceneDirector;
  private content: TutorialContent;
  private pressedButton: boolean = false;
  private enterT = 0;
  /** 是否已关闭 */
  private dismissed = false;

  constructor(director: SceneDirector, content: TutorialContent) {
    this.director = director;
    this.content = content;
  }

  /** 静态工厂：检查是否需要展示，若需要则返回实例，否则返回 null */
  static maybeCreate(director: SceneDirector, content: TutorialContent): TutorialOverlay | null {
    const meta = platformStore.managerMetaProgress();
    if (meta.tutorialCompleted[content.step]) return null;
    return new TutorialOverlay(director, content);
  }

  update(dt: number): void {
    this.enterT = Math.min(1, this.enterT + dt * 4);
  }

  get active(): boolean { return !this.dismissed; }

  /** 关闭并持久化 */
  private dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    platformStore.completeTutorial(this.content.step);
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    if (this.dismissed) return false;
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const rect = this.getCardRect(screenW, screenH);
    const btnRect = this.getButtonRect(rect);

    if (type === "start") {
      this.pressedButton = hitTest(x, y, btnRect);
      return true; // 遮罩消费所有触摸
    } else if (type === "end") {
      const wasPressed = this.pressedButton;
      this.pressedButton = false;
      if (wasPressed && hitTest(x, y, btnRect)) {
        playSfx("click");
        vibrateShort();
        this.dismiss();
      }
      return true;
    }
    return true;
  }

  private getCardRect(screenW: number, screenH: number): Rect {
    const w = Math.min(420, screenW - 48);
    const h = 320;
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
  }

  private getButtonRect(card: Rect): Rect {
    const btnW = 200;
    const btnH = 38;
    return { x: card.x + (card.w - btnW) / 2, y: card.y + card.h - btnH - 16, w: btnW, h: btnH };
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.dismissed) return;
    const t = this.enterT;
    const card = this.getCardRect(screenW, screenH);
    const accent = this.content.accent;

    // 遮罩
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * t})`;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = t;

    // 卡片
    drawPanel(ctx, card.x, card.y, card.w, card.h, {
      bgColor: "rgba(15, 25, 40, 0.98)",
      borderColor: accent,
      borderWidth: 2,
      cut: 12,
    });

    // 顶部渐变线
    ctx.save();
    const lg = ctx.createLinearGradient(card.x, card.y, card.x + card.w, card.y);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, accent);
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(card.x, card.y, card.w, 2);
    ctx.restore();

    // 标签
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(accent, 0.8);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("// TUTORIAL · 新手引导", card.x + card.w / 2, card.y + 16);
    ctx.restore();

    // 标题
    ctx.save();
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.5);
    ctx.shadowBlur = 12;
    ctx.fillText(`${this.content.emoji} ${this.content.title}`, card.x + card.w / 2, card.y + 36);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 要点列表
    const tipsStartY = card.y + 80;
    const tipLineH = 38;
    for (let i = 0; i < this.content.tips.length; i++) {
      const tip = this.content.tips[i];
      const tipY = tipsStartY + i * tipLineH;
      // 入场延迟
      const tipP = Math.min(1, Math.max(0, (t - 0.2 - i * 0.1) / 0.3));
      if (tipP <= 0) continue;

      ctx.save();
      ctx.globalAlpha = tipP;

      // 要点背景
      const tipBgY = tipY;
      ctx.fillStyle = withAlpha(accent, 0.06);
      roundRect(ctx, card.x + 20, tipBgY, card.w - 40, tipLineH - 6, 8);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(card.x + 20, tipBgY, 3, tipLineH - 6);

      // emoji
      ctx.font = `400 20px ${Theme.fonts.body}`;
      ctx.fillStyle = accent;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(tip.emoji, card.x + 32, tipBgY + (tipLineH - 6) / 2);

      // 文本
      ctx.font = `400 13px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
      ctx.fillText(tip.text, card.x + 60, tipBgY + (tipLineH - 6) / 2);
      ctx.restore();
    }

    // 按钮
    const btnRect = this.getButtonRect(card);
    drawButton(ctx, btnRect.x, btnRect.y, btnRect.w, btnRect.h, this.content.buttonLabel ?? "✓ 知道了，开始", {
      variant: "primary",
      accent,
      pressed: this.pressedButton,
    });

    ctx.restore();
  }
}
