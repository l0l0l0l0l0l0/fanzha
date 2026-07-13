export interface DrawTextOpts {
  font?: string;
  size: number;
  color: string;
  weight?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  shadow?: { color: string; blur: number; dx?: number; dy?: number };
  max?: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

export function clearCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, color = "rgba(10,25,41,0.32)"): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function clipPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut = 10
): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: DrawTextOpts
): void {
  const {
    font = '"Noto Sans SC", sans-serif',
    size,
    color,
    weight = "700",
    align = "left",
    baseline = "alphabetic",
    shadow,
    max,
  } = opts;
  let t = text;
  if (max && text.length > max) t = text.slice(0, max - 1) + "…";
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (shadow) {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetX = shadow.dx ?? 0;
    ctx.shadowOffsetY = shadow.dy ?? 0;
  }
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
  ctx.restore();
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  opts: DrawTextOpts
): number {
  const { font = '"Noto Sans SC", sans-serif', size, weight = "500", color, align = "left", baseline = "top" } = opts;
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  const chars = text.split("");
  let line = "";
  let yy = y;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = chars[i];
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  ctx.restore();
  return yy + lineHeight - y;
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  step = 32,
  color = "rgba(0,229,255,0.06)"
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
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

export function drawScanline(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const y = (t * 60) % (h + 100) - 50;
  const grad = ctx.createLinearGradient(0, y - 30, 0, y + 30);
  grad.addColorStop(0, "rgba(0,229,255,0)");
  grad.addColorStop(0.5, "rgba(0,229,255,0.10)");
  grad.addColorStop(1, "rgba(0,229,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, y - 30, w, 60);
}
