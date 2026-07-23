/**
 * 全局特效层（FX Bus）
 * 屏幕震动 / 飘字 / 闪光 / 冲击环 / 粒子爆发
 * 每个场景持有一个实例：render 世界前 applyShake()，世界后 renderOverlay()
 *
 * 与 PostFX.ts 互补：PostFX 偏全屏后处理（CRT/色差/vignette），
 * FxLayer 偏事件型瞬时反馈（震屏/飘字/冲击环/粒子爆发/闪光）。
 */
import { Ease } from "./easing";
import { rand } from "./Renderer";
import { Theme } from "@/ui/Theme";

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  t: number;
  duration: number;
  vy: number;
}

interface Flash {
  color: string;
  alpha: number;
  t: number;
  duration: number;
}

interface Ring {
  x: number;
  y: number;
  color: string;
  t: number;
  duration: number;
  maxR: number;
  width: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export class FxLayer {
  private trauma = 0;
  private shakeT = 0;
  private texts: FloatText[] = [];
  private flashes: Flash[] = [];
  private rings: Ring[] = [];
  private sparks: Spark[] = [];

  /** 震屏：strength 0~1，会累加但封顶 */
  shake(strength: number): void {
    this.trauma = Math.min(1, this.trauma + strength);
  }

  /** 全屏闪光 */
  flash(color: string, alpha = 0.25, duration = 0.25): void {
    this.flashes.push({ color, alpha, t: 0, duration });
  }

  /** 飘字 */
  popText(x: number, y: number, text: string, opts: { color?: string; size?: number; duration?: number; vy?: number } = {}): void {
    this.texts.push({
      x, y, text,
      color: opts.color ?? "#FFD666",
      size: opts.size ?? 20,
      duration: opts.duration ?? 0.9,
      vy: opts.vy ?? -60,
      t: 0,
    });
    if (this.texts.length > 24) this.texts.shift();
  }

  /** 冲击环 */
  ring(x: number, y: number, color: string, maxR = 90, duration = 0.45): void {
    this.rings.push({ x, y, color, t: 0, duration, maxR, width: 3 });
  }

  /** 粒子爆发（加色混合发光） */
  burst(x: number, y: number, color: string, count = 16, speed = 220): void {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.3, speed);
      this.sparks.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.35, 0.8),
        maxLife: 0.8,
        size: rand(1.5, 3.5),
        color,
        gravity: 320,
      });
    }
    if (this.sparks.length > 300) this.sparks.splice(0, this.sparks.length - 300);
  }

  update(dt: number): void {
    this.shakeT += dt * 40;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);

    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= 0.94; }
    this.texts = this.texts.filter((t) => t.t < t.duration);

    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.duration);

    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.duration);

    for (const s of this.sparks) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += s.gravity * dt;
      s.vx *= 0.985;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
  }

  /** 当前震屏偏移量（世界渲染前 ctx.translate） */
  get shakeX(): number {
    const m = this.trauma * this.trauma * 14;
    return m * (Math.sin(this.shakeT * 1.1) + Math.sin(this.shakeT * 2.7) * 0.5);
  }
  get shakeY(): number {
    const m = this.trauma * this.trauma * 14;
    return m * (Math.cos(this.shakeT * 1.7) + Math.sin(this.shakeT * 3.1) * 0.5);
  }
  get shaking(): boolean {
    return this.trauma > 0.001;
  }

  /** 世界渲染之后调用：绘制粒子/冲击环/闪光/飘字 */
  renderOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 粒子（加色混合发光）
    if (this.sparks.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const s of this.sparks) {
        const a = Math.max(0, s.life / s.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 冲击环
    for (const r of this.rings) {
      const p = Math.min(1, r.t / r.duration);
      const radius = r.maxR * Ease.cubicOut(p);
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 闪光
    for (const f of this.flashes) {
      const p = Math.min(1, f.t / f.duration);
      ctx.save();
      ctx.globalAlpha = f.alpha * (1 - p);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 飘字
    for (const t of this.texts) {
      const p = Math.min(1, t.t / t.duration);
      const scale = p < 0.15 ? Ease.backOut(p / 0.15) : 1;
      ctx.save();
      ctx.globalAlpha = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
      ctx.translate(t.x, t.y);
      ctx.scale(scale, scale);
      ctx.font = `700 ${t.size}px ${Theme.fonts.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }

  clear(): void {
    this.trauma = 0;
    this.texts = [];
    this.flashes = [];
    this.rings = [];
    this.sparks = [];
  }
}
