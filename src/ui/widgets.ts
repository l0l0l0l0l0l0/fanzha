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

// ============ 四角霓虹括号（局部版） ============

export function drawNeonCorners(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
  len?: number,
  inset?: number,
  glow?: number,
): void {
  const L = len ?? Math.min(w, h) * 0.12;
  const c = inset ?? 2;
  const blur = glow ?? 6;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, blur * 0.25);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.lineCap = "round";
  // 左上
  ctx.beginPath();
  ctx.moveTo(x + c, y + c + L); ctx.lineTo(x + c, y + c); ctx.lineTo(x + c + L, y + c);
  // 右上
  ctx.moveTo(x + w - c - L, y + c); ctx.lineTo(x + w - c, y + c); ctx.lineTo(x + w - c, y + c + L);
  // 左下
  ctx.moveTo(x + c, y + h - c - L); ctx.lineTo(x + c, y + h - c); ctx.lineTo(x + c + L, y + h - c);
  // 右下
  ctx.moveTo(x + w - c - L, y + h - c); ctx.lineTo(x + w - c, y + h - c); ctx.lineTo(x + w - c, y + h - c - L);
  ctx.stroke();
  ctx.restore();
}

// ============ 数字滚动渲染 ============

export interface NumberRollupOpts {
  size?: number;
  color?: string;
  weight?: string;
  font?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** 数字变化时是否脉冲发光 */
  pulse?: boolean;
}

export function drawNumberRollup(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  displayed: number,
  target: number,
  opts: NumberRollupOpts = {},
): void {
  const {
    size = 22,
    color = Theme.colors.ink.DEFAULT,
    weight = "900",
    font = Theme.fonts.mono,
    align = "left",
    baseline = "top",
    pulse = true,
  } = opts;
  const changing = pulse && Math.abs(target - displayed) > 0.5;
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (changing) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
  }
  ctx.fillText(Math.floor(displayed).toLocaleString(), x, y);
  ctx.restore();
}

// ============ 霓虹发光边框（四角高光 + 流动能量线） ============

export function drawNeonFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
  t: number,
  opts: { cut?: number; intensity?: number } = {}
): void {
  const cut = opts.cut ?? 8;
  const intensity = opts.intensity ?? 1;
  ctx.save();
  // 主体细边框
  clipPath(ctx, x, y, w, h, cut);
  ctx.strokeStyle = withAlpha(color, 0.35 * intensity);
  ctx.lineWidth = 1;
  ctx.stroke();

  // 四角高光
  const cl = Math.min(14, w * 0.12);
  ctx.strokeStyle = withAlpha(color, 0.9 * intensity);
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6 * intensity;
  const corners: [number, number, number, number][] = [
    [x, y + cl, x, y], [x, y, x + cl, y], // 左上
    [x + w - cl, y, x + w, y], [x + w, y, x + w, y + cl], // 右上
    [x + w, y + h - cl, x + w, y + h], [x + w, y + h, x + w - cl, y + h], // 右下
    [x + cl, y + h, x, y + h], [x, y + h, x, y + h - cl], // 左下
  ];
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of corners) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  // 流动能量点（沿顶边移动）
  const flow = (t * 0.4) % 1;
  const fx = x + cut + (w - cut * 2) * flow;
  ctx.shadowBlur = 8 * intensity;
  ctx.fillStyle = withAlpha(color, 0.9 * intensity);
  ctx.beginPath();
  ctx.arc(fx, y, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============ 发光渐变按钮 ============

export interface GlowButtonOpts extends ButtonOpts {
  glow?: number; // 0~1 呼吸发光强度
  t?: number;    // 时间（呼吸动画）
}

export function drawGlowButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  text: string,
  opts: GlowButtonOpts
): Rect {
  const accent = opts.accent ?? Theme.colors.neon.DEFAULT;
  const pressed = opts.pressed ?? false;
  const glow = opts.glow ?? 0;
  const cut = opts.cut ?? 6;
  const offsetY = pressed ? 1 : 0;

  ctx.save();
  // 外发光
  if (glow > 0 && !pressed && opts.variant !== "ghost") {
    ctx.shadowColor = withAlpha(accent, 0.55 * glow);
    ctx.shadowBlur = 18 * glow;
  }
  clipPath(ctx, x, y + offsetY, w, h, cut);

  if (opts.variant === "primary") {
    // 渐变填充
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, withAlpha(accent, 0.75));
    ctx.fillStyle = grad;
    ctx.fill();
    // 顶部高光
    ctx.shadowBlur = 0;
    const hl = ctx.createLinearGradient(x, y, x, y + h * 0.5);
    hl.addColorStop(0, "rgba(255,255,255,0.35)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fill();
  } else {
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // 其余部分复用基础按钮
  if (opts.variant === "primary") {
    // 只画文字
    ctx.save();
    const fontSize = opts.fontSize ?? Math.min(18, h * 0.36);
    const font = opts.font ?? Theme.fonts.display;
    ctx.font = `700 ${fontSize}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0A1929";
    const textY = opts.subText ? y + offsetY + h / 2 - fontSize * 0.3 : y + offsetY + h / 2;
    ctx.fillText(text, x + w / 2, textY);
    if (opts.subText) {
      ctx.font = `400 ${Math.max(9, fontSize * 0.45)}px ${Theme.fonts.mono}`;
      ctx.fillStyle = "rgba(10,25,41,0.7)";
      ctx.fillText(opts.subText, x + w / 2, y + offsetY + h / 2 + fontSize * 0.55);
    }
    ctx.restore();
    return { x, y, w, h };
  }
  return drawButton(ctx, x, y, w, h, text, opts);
}

// ============ 数字滚动器 ============

export class NumberTicker {
  private displayed = 0;
  private target = 0;

  set(value: number, immediate = false): void {
    this.target = value;
    if (immediate) this.displayed = value;
  }
  get value(): number { return this.target; }

  update(dt: number): void {
    const diff = this.target - this.displayed;
    if (Math.abs(diff) < 0.5) {
      this.displayed = this.target;
    } else {
      this.displayed += diff * Math.min(1, dt * 8);
    }
  }

  get text(): string {
    return Math.round(this.displayed).toLocaleString();
  }
}

// ============ 星级评分 ============

export function drawStars(
  ctx: CanvasRenderingContext2D,
  cx: number, y: number,
  count: number, total: number,
  size: number,
  color: string,
  t: number
): void {
  const gap = size * 1.4;
  const startX = cx - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) {
    const lit = i < count;
    const delay = i * 0.15;
    const local = Math.max(0, Math.min(1, (t - delay) / 0.3));
    const scale = lit ? (local < 1 ? 0.3 + 0.9 * local : 1) : 1;
    const x = startX + i * gap;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = lit ? local : 0.25;
    if (lit) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = lit ? color : Theme.colors.ink.dim;
    drawStarPath(ctx, 0, 0, size / 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawStarPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerA = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const innerA = outerA + Math.PI / 5;
    const ox = cx + Math.cos(outerA) * r;
    const oy = cy + Math.sin(outerA) * r;
    const ix = cx + Math.cos(innerA) * r * 0.45;
    const iy = cy + Math.sin(innerA) * r * 0.45;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
}

// ============ 雷达扫描装饰 ============

export function drawRadar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  t: number,
  color: string
): void {
  ctx.save();
  // 同心圆
  ctx.strokeStyle = withAlpha(color, 0.18);
  ctx.lineWidth = 1;
  for (const rr of [r, r * 0.66, r * 0.33]) {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 十字线
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  // 扫描扇形
  const angle = t * 1.2;
  const grad = ctx.createConicGradient
    ? ctx.createConicGradient(angle, cx, cy)
    : null;
  if (grad) {
    grad.addColorStop(0, withAlpha(color, 0.35));
    grad.addColorStop(0.12, withAlpha(color, 0.08));
    grad.addColorStop(0.25, "transparent");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 扫描线
  ctx.strokeStyle = withAlpha(color, 0.7);
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  ctx.stroke();
  ctx.restore();
}

// ============ 数据流背景粒子（赛博雨丝） ============

export interface StreamParticle {
  x: number;
  y: number;
  speed: number;
  len: number;
  alpha: number;
}

export function makeStreamParticles(w: number, h: number, count: number): StreamParticle[] {
  const list: StreamParticle[] = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: Math.random() * w,
      y: Math.random() * h,
      speed: 30 + Math.random() * 90,
      len: 20 + Math.random() * 60,
      alpha: 0.08 + Math.random() * 0.2,
    });
  }
  return list;
}

export function updateStreamParticles(list: StreamParticle[], w: number, h: number, dt: number): void {
  for (const p of list) {
    p.y += p.speed * dt;
    if (p.y - p.len > h) {
      p.y = -p.len;
      p.x = Math.random() * w;
    }
  }
}

export function drawStreamParticles(
  ctx: CanvasRenderingContext2D,
  list: StreamParticle[],
  color: string
): void {
  ctx.save();
  ctx.lineWidth = 1;
  for (const p of list) {
    const grad = ctx.createLinearGradient(p.x, p.y - p.len, p.x, p.y);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, withAlpha(color, p.alpha));
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - p.len);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.restore();
}

// ============ v2 升级：紧急预警 Ticker 滚动条 ============

export interface TickerItem {
  level: "critical" | "warning" | "info" | "success";
  tag: string;
  text: string;
}

export function drawAlertTicker(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  items: TickerItem[],
  scrollX: number,
  t: number,
): void {
  ctx.save();
  // 背景
  ctx.fillStyle = "rgba(10,25,41,0.92)";
  ctx.fillRect(x, y, w, h);
  // 顶部红蓝渐变细线
  const police = (Math.sin(t * 3) + 1) / 2;
  ctx.fillStyle = withAlpha("#1B5FCC", 0.5 * police + 0.2);
  ctx.fillRect(x, y, w * 0.5, 1);
  ctx.fillStyle = withAlpha("#E5353B", 0.5 * (1 - police) + 0.2);
  ctx.fillRect(x + w * 0.5, y, w * 0.5, 1);
  // 底部细线
  ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.6);
  ctx.fillRect(x, y + h - 1, w, 1);

  // 裁剪滚动内容
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // 左侧"紧急预警"标签（固定）
  const labelW = 88;
  ctx.fillStyle = "rgba(229,53,59,0.15)";
  ctx.fillRect(x, y, labelW, h);
  ctx.fillStyle = withAlpha("#E5353B", 0.7 + 0.3 * Math.sin(t * 4));
  ctx.beginPath();
  ctx.arc(x + 12, y + h / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 10px ${Theme.fonts.mono}`;
  ctx.fillStyle = "#FF5A60";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(229,53,59,0.6)";
  ctx.shadowBlur = 6;
  ctx.fillText("LIVE 预警", x + 22, y + h / 2);
  ctx.shadowBlur = 0;

  // 滚动条目
  const contentX = x + labelW + 8;
  const contentW = w - labelW - 16;
  let cursor = contentX - (scrollX % contentW);
  for (let i = 0; i < items.length * 2; i++) {
    const item = items[i % items.length];
    const colorMap = {
      critical: "#FF3B5C",
      warning: "#FFB020",
      info: "#00E5FF",
      success: "#1AD670",
    }[item.level];
    const tagW = ctx.measureText(item.tag).width;
    // tag
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    const fullTag = `[${item.tag}]`;
    const ftw = ctx.measureText(fullTag).width;
    ctx.fillStyle = withAlpha(colorMap, 0.18);
    ctx.fillRect(cursor, y + 8, ftw + 8, h - 16);
    ctx.fillStyle = colorMap;
    ctx.textBaseline = "middle";
    ctx.fillText(fullTag, cursor + 4, y + h / 2);
    cursor += ftw + 12;
    // text
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
    ctx.fillText(item.text, cursor, y + h / 2);
    cursor += ctx.measureText(item.text).width + 24;
    if (cursor > x + w) break;
  }
  ctx.restore();
}

// ============ v2 升级：雷达扫描背景（Hub 主页用） ============

export function drawRadarBackground(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  t: number,
  color: string = Theme.colors.neon.DEFAULT,
): void {
  ctx.save();
  // 同心圆
  ctx.strokeStyle = withAlpha(color, 0.06);
  ctx.lineWidth = 1;
  for (const rr of [r, r * 0.75, r * 0.5, r * 0.25]) {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 十字线
  ctx.strokeStyle = withAlpha(color, 0.04);
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  // 斜线
  const d = r * 0.707;
  ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d);
  ctx.moveTo(cx - d, cy + d); ctx.lineTo(cx + d, cy - d);
  ctx.stroke();
  // 扫描扇形（用 conicGradient，回退到 linear）
  const angle = t * 0.8;
  if (typeof ctx.createConicGradient === "function") {
    const grad = ctx.createConicGradient(angle, cx, cy);
    grad.addColorStop(0, withAlpha(color, 0.22));
    grad.addColorStop(0.08, withAlpha(color, 0.06));
    grad.addColorStop(0.18, "transparent");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 扫描线
  ctx.strokeStyle = withAlpha(color, 0.55);
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  ctx.stroke();
  // 中心点
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
  // 随机闪烁目标点（模拟诈骗信号源）
  for (let i = 0; i < 4; i++) {
    const seed = i * 73.13 + Math.floor(t * 0.3) * 17;
    const a = (seed % 6.28);
    const dist = r * (0.3 + (seed * 0.31) % 0.6);
    const px = cx + Math.cos(a) * dist;
    const py = cy + Math.sin(a) * dist;
    const blink = (Math.sin(t * 5 + i) + 1) / 2;
    ctx.globalAlpha = 0.3 + 0.6 * blink;
    ctx.fillStyle = "#E5353B";
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ============ v2 升级：CRT 终端启动文字流（Hub Hero 入场用） ============

export function drawBootTerminal(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  lines: string[],
  progress: number, // 0..1
  t: number,
): void {
  ctx.save();
  ctx.font = `400 10px ${Theme.fonts.mono}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const lineH = 13;
  const visibleCount = Math.floor(progress * lines.length + 0.001);
  for (let i = 0; i < visibleCount && i < lines.length; i++) {
    const lineProgress = Math.min(1, (progress * lines.length) - i);
    const text = lines[i].slice(0, Math.floor(lines[i].length * lineProgress));
    const isLast = i === visibleCount - 1 && lineProgress < 1;
    ctx.fillStyle = i === 0 ? "#00E5FF" : withAlpha(Theme.colors.ink.muted, 0.8);
    ctx.fillText(text, x, y + i * lineH);
    if (isLast) {
      // 闪烁光标
      const cursorBlink = (Math.sin(t * 8) + 1) / 2 > 0.5;
      if (cursorBlink) {
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "#00E5FF";
        ctx.fillRect(x + tw + 2, y + i * lineH + 1, 6, 10);
      }
    }
  }
  ctx.restore();
}

// ============ v2 升级：3D 倾斜卡片（按压视差） ============

export interface TiltCardOpts {
  accent: string;
  pressed?: boolean;
  hover?: boolean;
  tiltX?: number; // -1..1 横向倾斜
  tiltY?: number; // -1..1 纵向倾斜
  t?: number;
  cut?: number;
}

export function drawTiltCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: TiltCardOpts,
  drawContent: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void,
): void {
  const tx = opts.tiltX ?? 0;
  const ty = opts.tiltY ?? 0;
  const lift = opts.pressed ? 2 : opts.hover ? -4 : 0;
  const cut = opts.cut ?? 8;
  const t = opts.t ?? 0;

  ctx.save();
  // 阴影投影（轻微偏移）
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.filter = "blur(8px)";
  clipPath(ctx, x + 4 + tx * 2, y + 6 - lift, w, h, cut);
  ctx.fill();
  ctx.restore();

  // 主体
  ctx.translate(tx * 3, ty * 3 + lift);
  // 卡片背景
  clipPath(ctx, x, y, w, h, cut);
  // 渐变背景（accent 微染）
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, withAlpha(opts.accent, opts.pressed ? 0.18 : 0.10));
  bgGrad.addColorStop(1, Theme.colors.bg.card);
  ctx.fillStyle = bgGrad;
  ctx.fill();
  // 边框
  ctx.lineWidth = 1;
  ctx.strokeStyle = withAlpha(opts.accent, opts.pressed ? 0.85 : 0.4);
  ctx.stroke();
  // 顶部渐变线
  const lineGrad = ctx.createLinearGradient(x, y, x + w, y);
  lineGrad.addColorStop(0, "transparent");
  lineGrad.addColorStop(0.5, opts.accent);
  lineGrad.addColorStop(1, "transparent");
  ctx.fillStyle = lineGrad;
  ctx.fillRect(x, y, w, 1);

  // 内容（裁剪到卡片内）
  ctx.save();
  clipPath(ctx, x, y, w, h, cut);
  ctx.clip();
  drawContent(ctx, x, y, w, h);
  ctx.restore();

  // 悬浮 / 按压时四角霓虹括号
  if (opts.pressed || opts.hover) {
    const pulseBlur = 8 + Math.sin(t * 8) * 4;
    drawNeonCorners(ctx, x, y, w, h, opts.accent, undefined, undefined, pulseBlur);
  }
  ctx.restore();
}

// ============ v2 升级：动态网格背景（视差移动） ============

export function drawAmbientGrid(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  t: number,
  color: string = "rgba(0,229,255,0.05)",
): void {
  const step = 36;
  const offset = (t * 12) % step;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  // 竖线
  for (let x = -offset; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  // 横线
  for (let y = -offset; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // 中心点
  ctx.fillStyle = "rgba(0,229,255,0.15)";
  for (let x = -offset; x < w; x += step) {
    for (let y = -offset; y < h; y += step) {
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
    }
  }
  ctx.restore();
}

// ============ v2 升级：辉光徽章（带光晕脉冲） ============

export function drawGlowBadge(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  color: string,
  t: number,
  pulse: boolean = true,
): Rect {
  ctx.save();
  ctx.font = `400 10px ${Theme.fonts.mono}`;
  const tw = ctx.measureText(text).width;
  const w = tw + 16;
  const h = 18;
  const glow = pulse ? 0.4 + 0.4 * Math.sin(t * 3) : 0.4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 * glow;
  clipPath(ctx, x, y, w, h, 3);
  ctx.fillStyle = withAlpha(color, 0.15);
  ctx.fill();
  ctx.strokeStyle = withAlpha(color, 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
  return { x, y, w, h };
}

// ============ v2 升级：章节进度环（剧情/任务用） ============

export function drawProgressRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  ratio: number,
  color: string,
  t: number,
  label?: string,
): void {
  ctx.save();
  // 背景环
  ctx.strokeStyle = withAlpha(Theme.colors.bg.line, 0.6);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // 进度环
  const p = Math.max(0, Math.min(1, ratio));
  if (p > 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
  }
  // 中心点（旋转）
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  const angle = -Math.PI / 2 + p * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // 文字
  if (label) {
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy);
  }
  void t;
  ctx.restore();
}

