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
}

export class ParticleSystem {
  private parts: P[] = [];

  spawn(opts: {
    x: number;
    y: number;
    count?: number;
    speed?: number;
    life?: number;
    size?: number;
    color: string;
    gravity?: number;
    spread?: number;
  }): void {
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
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * spread - spread / 2;
      const s = speed * (0.5 + Math.random() * 0.7);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        gravity,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.parts) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  clear(): void {
    this.parts.length = 0;
  }
}
