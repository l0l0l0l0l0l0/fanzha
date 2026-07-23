/**
 * 粒子系统 · v2 扩展
 *
 * 支持类型：dot / ring / spark / debris / trail / beam / text / shockwave
 * 全部沿用 globalCompositeOperation = "lighter" 加性混合。
 */
type ParticleType = "dot" | "ring" | "spark" | "debris" | "trail" | "beam" | "text" | "shockwave";

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity?: number;
  type: ParticleType;
  angle: number;   // spark 朝向 / debris 旋转角 / beam 方向
  vrot: number;    // debris 角速度
  ringW: number;   // ring/shockwave 描边宽度
  friction: number;
  // v2 新增字段
  trail?: { xs: number[]; ys: number[]; max: number }; // trail 历史位置
  text?: string;        // text 内容
  fontSize?: number;    // text 字号
  beamLen?: number;     // beam 当前长度
  beamMaxLen?: number;  // beam 最大长度
  beamGrow?: number;    // beam 生长速度
}

export interface SpawnOpts {
  x: number;
  y: number;
  count?: number;
  speed?: number;
  life?: number;
  size?: number;
  color: string;
  gravity?: number;
  spread?: number;
  type?: ParticleType;
  angle?: number;        // spark/debris/beam 初始朝向（弧度）；不传则随机
  ringWidth?: number;    // ring/shockwave 描边宽度
  friction?: number;     // 阻力系数（默认 0.97）
  // v2 新增
  text?: string;         // type="text" 时的文本
  fontSize?: number;     // type="text" 时的字号
  trailLen?: number;     // type="trail" 时的历史长度
  beamMaxLen?: number;   // type="beam" 时的最大长度
}

export interface BurstOpts {
  ring?: boolean;
  sparks?: number;
  dots?: number;
  speed?: number;
  life?: number;
  size?: number;
  gravity?: number;
  color2?: string;       // 副色（sparks 用主色，dots 用副色）
  shockwave?: boolean;   // v2：是否叠加冲击波
}

export class ParticleSystem {
  private parts: P[] = [];

  spawn(opts: SpawnOpts): void {
    const {
      x,
      y,
      count = 12,
      speed = 120,
      life = 0.6,
      size = 3,
      color,
      gravity = 0,
      spread = Math.PI * 2,
      type = "dot",
      ringWidth = 2,
      friction = 0.97,
      text,
      fontSize = 14,
      trailLen = 8,
      beamMaxLen = 120,
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = (opts.angle !== undefined && type !== "dot" && type !== "ring" && type !== "text")
        ? opts.angle + (Math.random() - 0.5) * spread
        : Math.random() * spread - spread / 2;
      const s = speed * (0.5 + Math.random() * 0.7);
      const p: P = {
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        gravity,
        type,
        angle: a,
        vrot: (Math.random() - 0.5) * 12,
        ringW: ringWidth,
        friction,
      };
      if (type === "trail") {
        p.trail = { xs: [x], ys: [y], max: trailLen };
      } else if (type === "text") {
        p.text = text ?? "";
        p.fontSize = fontSize;
        p.vy = -40 - Math.random() * 20; // 文本上浮
        p.vx = (Math.random() - 0.5) * 10;
      } else if (type === "beam") {
        p.beamLen = 0;
        p.beamMaxLen = beamMaxLen;
        p.beamGrow = beamMaxLen / (life * 0.3); // 前 30% 生命生长
      }
      this.parts.push(p);
    }
  }

  /**
   * 综合 burst：扩散光环 + 放射火花 + 飞溅圆点
   * 一次调用覆盖大多数「击杀/爆炸/命中」juice 场景
   */
  spawnBurst(x: number, y: number, color: string, opts: BurstOpts = {}): void {
    const {
      ring = true,
      sparks = 10,
      dots = 14,
      speed = 220,
      life = 0.7,
      size = 4,
      gravity = 0,
      color2,
      shockwave = false,
    } = opts;
    if (ring) {
      this.spawn({
        x, y, count: 1, speed: 0, life: life * 1.1, size: size * 1.4,
        color, type: "ring", ringWidth: Math.max(1.5, size * 0.6),
      });
    }
    if (shockwave) {
      this.spawn({
        x, y, count: 1, speed: 0, life: life * 1.3, size: size * 2,
        color, type: "shockwave", ringWidth: Math.max(2, size * 0.9),
      });
    }
    if (sparks > 0) {
      this.spawn({
        x, y, count: sparks, speed: speed * 1.2, life: life * 0.8, size: size * 1.1,
        color, type: "spark", friction: 0.94,
      });
    }
    if (dots > 0) {
      this.spawn({
        x, y, count: dots, speed, life, size,
        color: color2 ?? color, type: "dot", gravity,
      });
    }
  }

  /** v2：飘字（伤害数字 / 得分 / 状态） */
  spawnText(x: number, y: number, text: string, color: string, opts: { size?: number; life?: number } = {}): void {
    this.spawn({
      x, y, count: 1, speed: 0, life: opts.life ?? 1.0, size: opts.size ?? 14,
      color, type: "text", text, fontSize: opts.size ?? 14,
    });
  }

  /** v2：尾迹粒子（移动物体后方拖尾） */
  spawnTrail(x: number, y: number, color: string, opts: { speed?: number; angle?: number; life?: number; size?: number; len?: number } = {}): void {
    this.spawn({
      x, y, count: 1, speed: opts.speed ?? 30, life: opts.life ?? 0.5, size: opts.size ?? 3,
      color, type: "trail", angle: opts.angle ?? 0, trailLen: opts.len ?? 8,
    });
  }

  /** v2：光束（激光 / 射线） */
  spawnBeam(x: number, y: number, angle: number, color: string, opts: { len?: number; life?: number; size?: number } = {}): void {
    this.spawn({
      x, y, count: 1, speed: 0, life: opts.life ?? 0.3, size: opts.size ?? 4,
      color, type: "beam", angle, beamMaxLen: opts.len ?? 120,
    });
  }

  update(dt: number): void {
    // 反向遍历 + swap-pop：O(1) 删除，避免 splice 的 O(n) 数组移位
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        const last = this.parts.length - 1;
        if (i !== last) this.parts[i] = this.parts[last];
        this.parts.pop();
        continue;
      }
      // trail 记录历史
      if (p.type === "trail" && p.trail) {
        p.trail.xs.push(p.x);
        p.trail.ys.push(p.y);
        if (p.trail.xs.length > p.trail.max) {
          p.trail.xs.shift();
          p.trail.ys.shift();
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      p.vx *= p.friction;
      p.vy *= p.friction;
      if (p.type === "debris") p.angle += p.vrot * dt;
      // beam 生长
      if (p.type === "beam" && p.beamLen !== undefined && p.beamGrow !== undefined && p.beamMaxLen !== undefined) {
        p.beamLen = Math.min(p.beamMaxLen, p.beamLen + p.beamGrow * dt);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.parts.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.parts) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.type) {
        case "ring": {
          // 扩散光环：半径随生命增长，alpha 衰减
          const r = p.size + (1 - alpha) * p.size * 3;
          ctx.lineWidth = p.ringW * (0.4 + alpha * 0.6);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "shockwave": {
          // v2：冲击波——更厚、双线、快速扩张
          const r = p.size + (1 - alpha) * p.size * 5;
          ctx.lineWidth = p.ringW * (0.6 + alpha * 0.4);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          // 内圈（更细更暗）
          ctx.globalAlpha = alpha * 0.5;
          ctx.lineWidth = p.ringW * 0.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.75, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = alpha;
          break;
        }
        case "spark": {
          // 线段粒子：沿运动方向，长度随 alpha 衰减
          const len = p.size * 2.4 * alpha;
          const dx = Math.cos(p.angle) * len;
          const dy = Math.sin(p.angle) * len;
          ctx.lineWidth = Math.max(1, p.size * 0.5 * alpha);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + dx, p.y + dy);
          ctx.stroke();
          break;
        }
        case "debris": {
          // 旋转小矩形
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          const w = p.size * 1.6;
          const h = p.size * 0.8;
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.restore();
          break;
        }
        case "trail": {
          // v2：拖尾——沿历史位置画渐细渐淡的折线
          if (p.trail && p.trail.xs.length > 1) {
            ctx.lineCap = "round";
            for (let i = 1; i < p.trail.xs.length; i++) {
              const t = i / p.trail.xs.length;
              ctx.globalAlpha = alpha * t * 0.8;
              ctx.lineWidth = p.size * t;
              ctx.beginPath();
              ctx.moveTo(p.trail.xs[i - 1], p.trail.ys[i - 1]);
              ctx.lineTo(p.trail.xs[i], p.trail.ys[i]);
              ctx.stroke();
            }
            ctx.globalAlpha = alpha;
          }
          // 头部圆点
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "beam": {
          // v2：光束——从原点向 angle 方向延伸的渐变线段
          if (p.beamLen !== undefined) {
            const ex = p.x + Math.cos(p.angle) * p.beamLen;
            const ey = p.y + Math.sin(p.angle) * p.beamLen;
            ctx.lineWidth = p.size * (0.5 + alpha * 0.5);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            // 核心亮线
            ctx.globalAlpha = alpha * 0.8;
            ctx.lineWidth = p.size * 0.3;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.globalAlpha = alpha;
          }
          break;
        }
        case "text": {
          // v2：飘字——上浮淡出
          if (p.text) {
            ctx.font = `700 ${p.fontSize ?? 14}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            // 描边增强可读性
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillText(p.text, p.x, p.y);
          }
          break;
        }
        case "dot":
        default: {
          // 圆点（原有行为）
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  clear(): void {
    this.parts.length = 0;
  }
}
