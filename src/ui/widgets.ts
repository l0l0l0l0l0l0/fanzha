/**
 * Canvas UI 组件库
 * 纯函数式绘制 + 命中检测
 */
import { Theme, withAlpha } from "./Theme";
import { clipPath, drawText, roundRect } from "@/engine/Renderer";

export interface Rect { x: number; y: number; w: number; h: number; }

export function hitTest(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// ============ 面板（斜切角） ============

export interface PanelOpts {
  borderColor?: string;
  bgColor?: string;
  cut?: number;
  borderWidth?: number;
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: PanelOpts = {}
): Rect {
  const cut = opts.cut ?? 8;
  const bg = opts.bgColor ?? Theme.colors.bg.panel;
  const border = opts.borderColor ?? Theme.colors.bg.line;
  const bw = opts.borderWidth ?? 1;

  ctx.save();
  // 背景
  clipPath(ctx, x, y, w, h, cut);
  ctx.fillStyle = bg;
  ctx.fill();
  // 边框
  if (bw > 0) {
    ctx.lineWidth = bw;
    ctx.strokeStyle = border;
    ctx.stroke();
  }
  ctx.restore();
  return { x, y, w, h };
}

// ============ 按钮 ============

export type ButtonVariant = "primary" | "danger" | "ghost" | "hard";

export interface ButtonOpts {
  variant: ButtonVariant;
  accent?: string;
  pressed?: boolean;
  font?: string;
  subText?: string;
  fontSize?: number;
  cut?: number;
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  text: string,
  opts: ButtonOpts
): Rect {
  const variant = opts.variant;
  const accent = opts.accent ?? Theme.colors.neon.DEFAULT;
  const pressed = opts.pressed ?? false;
  const cut = opts.cut ?? 6;
  const offsetY = pressed ? 1 : 0;

  ctx.save();
  clipPath(ctx, x, y + offsetY, w, h, cut);

  // 背景配色
  if (variant === "primary") {
    ctx.fillStyle = accent;
    ctx.fill();
  } else if (variant === "danger") {
    ctx.fillStyle = Theme.colors.warn.DEFAULT;
    ctx.fill();
  } else if (variant === "hard") {
    ctx.fillStyle = Theme.colors.bg.card;
    ctx.fill();
  } else { // ghost
    ctx.fillStyle = "rgba(15, 34, 54, 0.6)";
    ctx.fill();
  }

  // 边框
  if (variant === "ghost") {
    ctx.lineWidth = 1;
    ctx.strokeStyle = pressed ? accent : Theme.colors.bg.line;
    ctx.stroke();
  } else if (variant === "hard") {
    ctx.lineWidth = 1;
    ctx.strokeStyle = accent;
    ctx.stroke();
  }

  // 文字
  const fontSize = opts.fontSize ?? Math.min(18, h * 0.36);
  const font = opts.font ?? Theme.fonts.display;
  const textColor = variant === "primary" ? "#0A1929" : variant === "danger" ? "#FFFFFF" : accent;

  ctx.font = `700 ${fontSize}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
  if (variant !== "ghost") {
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 4;
  }
  const textY = opts.subText ? y + offsetY + h / 2 - fontSize * 0.3 : y + offsetY + h / 2;
  ctx.fillText(text, x + w / 2, textY);

  // 副标题
  if (opts.subText) {
    ctx.shadowBlur = 0;
    ctx.font = `400 ${Math.max(9, fontSize * 0.45)}px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(textColor, 0.7);
    ctx.fillText(opts.subText, x + w / 2, y + offsetY + h / 2 + fontSize * 0.55);
  }

  ctx.restore();
  return { x, y, w, h };
}

// ============ 统计卡片 ============

export interface StatCardOpts {
  label: string;
  value: string;
  unit?: string;
  color: string;
}

export function drawStatCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: StatCardOpts
): Rect {
  drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(opts.color, 0.3) });

  // 顶部渐变线
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.5, opts.color);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, 1);
  ctx.restore();

  // 标签
  drawText(ctx, opts.label, x + 12, y + 22, {
    size: 11, color: Theme.colors.ink.muted, weight: "400",
    font: Theme.fonts.mono,
  });

  // 数值
  drawText(ctx, opts.value, x + 12, y + 50, {
    size: 26, color: opts.color, weight: "700",
    font: Theme.fonts.mono,
    shadow: { color: withAlpha(opts.color, 0.3), blur: 12 },
  });

  // 单位
  if (opts.unit) {
    drawText(ctx, opts.unit, x + 12, y + h - 16, {
      size: 10, color: Theme.colors.ink.muted, weight: "400",
      font: Theme.fonts.mono,
    });
  }

  return { x, y, w, h };
}

// ============ 进度条 ============

export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  ratio: number,
  color: string,
  opts: { bgColor?: string } = {}
): Rect {
  const r = Math.max(0, Math.min(1, ratio));
  const bg = opts.bgColor ?? Theme.colors.bg.line;
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  if (r > 0) {
    roundRect(ctx, x, y, w * r, h, h / 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
  }
  ctx.restore();
  return { x, y, w, h };
}

// ============ Toast 通知条 ============

export function drawToast(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  text: string,
  tone: "good" | "bad" | "info",
  label?: string
): Rect {
  const colors = {
    good: { border: Theme.colors.safe.DEFAULT, bg: "rgba(82,196,26,0.12)", text: Theme.colors.safe.glow },
    bad: { border: Theme.colors.warn.DEFAULT, bg: "rgba(229,53,59,0.14)", text: Theme.colors.warn.glow },
    info: { border: Theme.colors.neon.DEFAULT, bg: "rgba(0,229,255,0.1)", text: Theme.colors.neon.DEFAULT },
  }[tone];

  ctx.save();
  // 背景
  ctx.fillStyle = colors.bg;
  ctx.fillRect(x, y, w, h);
  // 左边框
  ctx.fillStyle = colors.border;
  ctx.fillRect(x, y, 4, h);
  // 标签
  if (label) {
    drawText(ctx, label, x + 12, y + 16, {
      size: 10, color: withAlpha(colors.text, 0.7), weight: "400",
      font: Theme.fonts.mono,
    });
  }
  // 正文
  ctx.font = `500 13px ${Theme.fonts.body}`;
  ctx.fillStyle = Theme.colors.ink.DEFAULT;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const lines = wrapLines(ctx, text, w - 24);
  lines.forEach((line, i) => {
    ctx.fillText(line, x + 12, y + (label ? 30 : 12) + i * 18);
  });
  ctx.restore();
  return { x, y, w, h };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

// ============ 模态弹窗遮罩 ============

export function drawModalOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, screenW, screenH);
  ctx.restore();
}

// ============ 全局背景（深蓝 + 网格 + 渐变光晕） ============

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // 深蓝底
  ctx.fillStyle = Theme.colors.bg.deep;
  ctx.fillRect(0, 0, w, h);

  // 顶部光晕
  const grad1 = ctx.createRadialGradient(w * 0.3, h * 0.1, 0, w * 0.3, h * 0.1, h * 0.6);
  grad1.addColorStop(0, "rgba(0, 229, 255, 0.06)");
  grad1.addColorStop(1, "transparent");
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, w, h);

  // 右下光晕
  const grad2 = ctx.createRadialGradient(w * 0.8, h * 0.9, 0, w * 0.8, h * 0.9, h * 0.5);
  grad2.addColorStop(0, "rgba(27, 95, 204, 0.08)");
  grad2.addColorStop(1, "transparent");
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, w, h);

  // 网格
  ctx.save();
  ctx.strokeStyle = "rgba(0, 229, 255, 0.04)";
  ctx.lineWidth = 1;
  const step = 32;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ============ CRT 扫描线覆盖层 ============

export function drawScanlineOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(0, 229, 255, 0.025)";
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.restore();
}

// ============ 警告条纹背景 ============

export function drawWarnStripes(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string = Theme.colors.flag.DEFAULT
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const step = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = step;
  ctx.globalAlpha = 0.15;
  for (let i = -h; i < w + h; i += step * 2) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

// ============ HUD 标签 ============

export function drawHudLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  color: string = Theme.colors.ink.muted
): void {
  drawText(ctx, text, x, y, {
    size: 10,
    color,
    weight: "400",
    font: Theme.fonts.mono,
  });
}

// ============ 标签徽章 ============

export function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  bgColor: string,
  textColor: string
): Rect {
  ctx.save();
  ctx.font = `400 10px ${Theme.fonts.mono}`;
  const tw = ctx.measureText(text).width;
  const w = tw + 16;
  const h = 18;
  clipPath(ctx, x, y, w, h, 3);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
  return { x, y, w, h };
}
