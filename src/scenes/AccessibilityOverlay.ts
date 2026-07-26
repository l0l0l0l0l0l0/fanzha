/**
 * 可访问性设置覆盖层（v7 D5）
 * 提供色弱模式开关 + 字号选择（小/中/大），设置持久化到 platformStore。
 *
 * 由 ManagerDeployScene 持有并在 render 末尾叠加绘制；
 * 通过顶部右侧齿轮按钮打开。
 */
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawPanel, drawButton, hitTest, type Rect } from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort } from "@/platform/web";
import { roundRect } from "@/engine/Renderer";

export class AccessibilityOverlay {
  private director: SceneDirector;
  private pressedButton: string | null = null;
  private enterT = 0;
  private dismissed = false;

  constructor(director: SceneDirector) {
    this.director = director;
  }

  get active(): boolean { return !this.dismissed; }

  update(dt: number): void {
    this.enterT = Math.min(1, this.enterT + dt * 5);
  }

  dismiss(): void {
    this.dismissed = true;
  }

  private getCardRect(screenW: number, screenH: number): Rect {
    const w = Math.min(380, screenW - 48);
    const h = 280;
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
  }

  private getCloseBtnRect(card: Rect): Rect {
    return { x: card.x + card.w - 36, y: card.y + 8, w: 28, h: 28 };
  }

  /** 色弱模式开关按钮 */
  private getColorBlindToggleRect(card: Rect): Rect {
    return { x: card.x + card.w - 80, y: card.y + 80, w: 60, h: 32 };
  }

  /** 字号选择按钮（3 个） */
  private getFontSizeBtnRect(idx: number, card: Rect): Rect {
    const btnW = 80;
    const btnH = 36;
    const gap = 8;
    const totalW = 3 * btnW + 2 * gap;
    const startX = card.x + (card.w - totalW) / 2;
    return { x: startX + idx * (btnW + gap), y: card.y + 168, w: btnW, h: btnH };
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    if (this.dismissed) return false;
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const card = this.getCardRect(screenW, screenH);

    if (type === "start") {
      this.pressedButton = null;
      if (hitTest(x, y, this.getCloseBtnRect(card))) { this.pressedButton = "close"; return true; }
      if (hitTest(x, y, this.getColorBlindToggleRect(card))) { this.pressedButton = "colorBlind"; return true; }
      for (let i = 0; i < 3; i++) {
        if (hitTest(x, y, this.getFontSizeBtnRect(i, card))) { this.pressedButton = `font-${i}`; return true; }
      }
      // 点击面板外关闭
      if (!hitTest(x, y, card)) { this.pressedButton = "close"; return true; }
      return true;
    } else if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;
      if (!pressed) return true;
      playSfx("click");
      vibrateShort();
      if (pressed === "close") {
        this.dismiss();
        return true;
      }
      if (pressed === "colorBlind") {
        const cur = platformStore.managerMetaProgress().accessibility.colorBlindMode;
        platformStore.setAccessibility({ colorBlindMode: !cur });
        return true;
      }
      if (pressed.startsWith("font-")) {
        const idx = parseInt(pressed.slice("font-".length), 10);
        const sizes = ["small", "medium", "large"] as const;
        if (idx >= 0 && idx < sizes.length) {
          platformStore.setAccessibility({ fontSize: sizes[idx] });
        }
        return true;
      }
      return true;
    }
    return true;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.dismissed) return;
    const t = this.enterT;
    const card = this.getCardRect(screenW, screenH);
    const accent = "#00E5FF";
    const meta = platformStore.managerMetaProgress().accessibility;

    // 遮罩
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * t})`;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = t;

    drawPanel(ctx, card.x, card.y, card.w, card.h, {
      bgColor: "rgba(15, 25, 40, 0.98)",
      borderColor: accent,
      borderWidth: 2,
      cut: 12,
    });

    // 关闭按钮
    const closeBtn = this.getCloseBtnRect(card);
    drawButton(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "close",
    });
    drawIcon(ctx, "x", closeBtn.x + 6, closeBtn.y + 6, 16, Theme.colors.ink.muted);

    // 标题
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(accent, 0.8);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("// ACCESSIBILITY · 无障碍设置", card.x + card.w / 2, card.y + 16);
    ctx.font = `700 20px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = withAlpha(accent, 0.5);
    ctx.shadowBlur = 10;
    ctx.fillText("♿ 无障碍设置", card.x + card.w / 2, card.y + 34);
    ctx.shadowBlur = 0;
    ctx.restore();

    // ===== 色弱模式 =====
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🎨 色弱模式", card.x + 20, card.y + 96);
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("启用后元素/状态附加文字标签", card.x + 20, card.y + 114);
    ctx.restore();

    // 色弱模式开关
    const cbToggle = this.getColorBlindToggleRect(card);
    const cbOn = meta.colorBlindMode;
    ctx.save();
    ctx.fillStyle = cbOn ? withAlpha(Theme.colors.safe.DEFAULT, 0.2) : "rgba(20,30,45,0.6)";
    roundRect(ctx, cbToggle.x, cbToggle.y, cbToggle.w, cbToggle.h, 16);
    ctx.fill();
    ctx.strokeStyle = cbOn ? Theme.colors.safe.DEFAULT : withAlpha(Theme.colors.bg.line, 0.4);
    ctx.lineWidth = cbOn ? 2 : 1;
    ctx.stroke();
    // 开关圆点
    const dotX = cbOn ? cbToggle.x + cbToggle.w - 16 : cbToggle.x + 16;
    ctx.fillStyle = cbOn ? Theme.colors.safe.DEFAULT : Theme.colors.ink.muted;
    ctx.beginPath();
    ctx.arc(dotX, cbToggle.y + cbToggle.h / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    // 文字
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = cbOn ? Theme.colors.safe.DEFAULT : Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(cbOn ? "ON" : "OFF", cbToggle.x + cbToggle.w / 2, cbToggle.y + cbToggle.h / 2);
    ctx.restore();

    // ===== 字号选择 =====
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🔤 字号调整", card.x + 20, card.y + 148);
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("影响战斗 HUD 与结算页文字大小", card.x + 20, card.y + 166);
    ctx.restore();

    // 字号按钮
    const sizes = [
      { id: "small", label: "小", sample: "A" },
      { id: "medium", label: "中", sample: "A" },
      { id: "large", label: "大", sample: "A" },
    ] as const;
    for (let i = 0; i < sizes.length; i++) {
      const s = sizes[i];
      const rect = this.getFontSizeBtnRect(i, card);
      const selected = meta.fontSize === s.id;
      drawButton(ctx, rect.x, rect.y, rect.w, rect.h, "", {
        variant: selected ? "primary" : "ghost",
        accent,
        pressed: this.pressedButton === `font-${i}`,
      });
      ctx.save();
      // 样本字（不同字号）
      const sampleSize = s.id === "small" ? 12 : s.id === "medium" ? 16 : 20;
      ctx.font = `700 ${sampleSize}px ${Theme.fonts.display}`;
      ctx.fillStyle = selected ? accent : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.sample, rect.x + rect.w / 2 - 12, rect.y + rect.h / 2);
      // 标签
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = selected ? accent : Theme.colors.ink.muted;
      ctx.fillText(s.label, rect.x + rect.w / 2 + 12, rect.y + rect.h / 2);
      ctx.restore();
    }

    ctx.restore();
  }
}

/**
 * v7 D5：字号缩放工具
 * 根据 accessibility.fontSize 返回缩放系数，供 HUD 渲染使用
 */
export function fontScale(): number {
  const fs = platformStore.managerMetaProgress().accessibility.fontSize;
  return fs === "small" ? 0.88 : fs === "large" ? 1.15 : 1.0;
}

/**
 * v7 D5：色弱模式辅助标签
 * 启用色弱模式时，为元素类型返回文字标签
 */
export function elementLabel(element: string): string {
  const labels: Record<string, string> = {
    money: "金",
    emotion: "情",
    info: "信",
    tech: "技",
    threat: "威",
  };
  return labels[element] ?? "";
}
