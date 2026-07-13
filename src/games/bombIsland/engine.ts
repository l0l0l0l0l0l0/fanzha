import { GameEngine } from "@/engine/GameEngine";
import { ParticleSystem } from "@/engine/Particle";
import { playSfx } from "@/engine/Audio";
import type { GameCanvas } from "@/platform/web";
import {
  clamp,
  clearCanvas,
  drawText,
  roundRect,
  drawGrid,
} from "@/engine/Renderer";
import type { GameEvent, GameResultPayload } from "@/types";
import { randomTip } from "@/data/tips";
import { WEAPONS, BUILDINGS, LEVELS } from "./data";
import type { WeaponId, WeaponDef, LevelDef, BombHud } from "./types";
import { InputManager } from "@/engine/Input";

const W = 960;
const H = 540;
const ACCENT = "#FF7A1A";

const GROUND_Y = 470;
const CANNON_X = 90;
const CANNON_Y = 420;
const GRAVITY = 600;
const POWER_K = 4.2;
const POWER_MIN = 120;
const POWER_MAX = 950;

interface Building {
  def: (typeof BUILDINGS)[string];
  x: number; // center
  y: number; // ground bottom
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  burnUntil: number;
  hitFlashUntil: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  weapon: WeaponDef;
  pierceLeft: number;
  splitAt: number; // t to split (cluster)
  life: number;
  trail: { x: number; y: number }[];
}

interface BurnZone {
  x: number;
  y: number;
  r: number;
  until: number;
  dps: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export class BombIslandEngine extends GameEngine {
  private particles = new ParticleSystem();
  private input: InputManager;
  private levelIdx: number;
  private level: LevelDef;
  private buildings: Building[] = [];
  private projectiles: Projectile[] = [];
  private burnZones: BurnZone[] = [];
  private floats: FloatingText[] = [];
  private ammo: number;
  private score = 0;
  private currentWeapon: WeaponId;
  private unlocked: Set<WeaponId>;
  private aiming = false;
  private aimX = 0;
  private aimY = 0;
  private aimDownTs = 0;
  private phase: "aim" | "fire" | "won" | "lost" = "aim";
  private result: GameResultPayload | null = null;
  private t = 0;
  private shakeUntil = 0;
  private startedAt = 0;
  private buildingsTotal = 0;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;

  constructor(canvas: GameCanvas, levelIdx: number, unlocked: WeaponId[]) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    this.startedAt = performance.now();
    this.levelIdx = levelIdx;
    this.level = LEVELS[levelIdx];
    this.ammo = this.level.ammo;
    this.currentWeapon = "basic";
    this.unlocked = new Set<WeaponId>(unlocked);
    if (this.level.unlockWeapon && levelIdx > 0) {
      // Unlock at start of level (for current battle use)
      this.unlocked.add(this.level.unlockWeapon);
    }
    this.placeBuildings();
    this.input = new InputManager(canvas);
    this.input.attach(this);
    this.input.setHandlers({
      onDrag: (x, y) => {
        if (this.phase !== "aim" && this.phase !== "fire") return;
        if (!this.aiming) {
          this.aiming = true;
          this.aimDownTs = this.t;
        }
        this.aimX = x;
        this.aimY = y;
      },
      onClick: (_x, _y) => {
        if (this.aiming && this.t - this.aimDownTs > 0.05) {
          this.fire();
        }
        this.aiming = false;
      },
    });
    this.addDestroy(() => this.input.destroy());
    this.toast = {
      text: `${this.level.name}：${this.level.briefing}`,
      tone: "info",
      until: this.t + 4,
    };
  }

  private placeBuildings(): void {
    this.buildings = this.level.buildings.map((b) => {
      const def = BUILDINGS[b.typeId];
      return {
        def,
        x: b.x,
        y: GROUND_Y,
        w: def.w,
        h: def.h,
        hp: def.hp,
        maxHp: def.hp,
        alive: true,
        burnUntil: 0,
        hitFlashUntil: 0,
      };
    });
    this.buildingsTotal = this.buildings.length;
  }

  setWeapon(id: WeaponId): void {
    if (!this.unlocked.has(id)) return;
    this.currentWeapon = id;
    playSfx("click");
    this.emitHud();
  }

  private fire(): void {
    if (this.phase !== "aim" && this.phase !== "fire") return;
    if (this.ammo <= 0) return;
    const dx = CANNON_X - this.aimX;
    const dy = CANNON_Y - this.aimY;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return;
    const power = clamp(dist * POWER_K, POWER_MIN, POWER_MAX);
    const vx = (dx / dist) * power;
    const vy = (dy / dist) * power;
    const weapon = WEAPONS[this.currentWeapon];
    this.projectiles.push({
      x: CANNON_X,
      y: CANNON_Y,
      vx,
      vy,
      weapon,
      pierceLeft: weapon.pierce ? 3 : 0,
      splitAt: weapon.split ? this.t + 0.5 : 0,
      life: 6,
      trail: [],
    });
    this.ammo -= 1;
    this.phase = "fire";
    playSfx("shoot");
    this.emitHud();
  }

  private explode(x: number, y: number, weapon: WeaponDef, fromSplit = false): void {
    // Damage buildings in radius
    for (const b of this.buildings) {
      if (!b.alive) continue;
      const cx = clamp(x, b.x - b.w / 2, b.x + b.w / 2);
      const cy = clamp(y, b.y - b.h, b.y);
      const d = Math.hypot(cx - x, cy - y);
      if (d < weapon.blastRadius) {
        const dmgMult = b.def.armored ? 0.5 : 1;
        const dmg = weapon.damage * dmgMult * (1 - d / weapon.blastRadius / 2);
        b.hp -= dmg;
        b.hitFlashUntil = this.t + 0.15;
        if (weapon.burn) {
          b.burnUntil = this.t + 2.5;
        }
      }
    }
    // Burn zone for fire
    if (weapon.burn) {
      this.burnZones.push({
        x,
        y: Math.min(y, GROUND_Y - 5),
        r: weapon.blastRadius,
        until: this.t + 2,
        dps: weapon.burn,
      });
    }
    // Particles
    this.particles.spawn({
      x,
      y,
      count: 30,
      speed: 240,
      life: 0.8,
      size: 4,
      color: weapon.color,
    });
    this.particles.spawn({
      x,
      y,
      count: 14,
      speed: 100,
      life: 0.6,
      size: 6,
      color: "#FFD666",
    });
    this.shakeUntil = this.t + 0.2;
    playSfx("explode");
    // Check building deaths
    this.checkBuildingDeaths();
    void fromSplit;
  }

  private checkBuildingDeaths(): void {
    for (const b of this.buildings) {
      if (b.alive && b.hp <= 0) {
        b.alive = false;
        this.score += b.def.score + (b.def.bonus ?? 0);
        this.particles.spawn({
          x: b.x,
          y: b.y - b.h / 2,
          count: 40,
          speed: 300,
          life: 1,
          size: 5,
          color: b.def.color,
        });
        this.particles.spawn({
          x: b.x,
          y: b.y - b.h / 2,
          count: 20,
          speed: 160,
          life: 0.9,
          size: 5,
          color: "#FFD666",
        });
        this.floats.push({
          x: b.x,
          y: b.y - b.h,
          text: `+${b.def.score}${b.def.bonus ? " ★" : ""}`,
          color: "#FFD666",
          life: 1,
          maxLife: 1,
        });
        playSfx("explode");
      }
    }
  }

  protected update(dt: number): void {
    this.t += dt;
    this.particles.update(dt);
    this.updateFloats(dt);
    this.updateBurnZones(dt);

    if (this.phase === "won" || this.phase === "lost") return;

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }
      // Cluster split
      if (p.weapon.split && this.t >= p.splitAt && p.vy > 0) {
        const sub = WEAPONS.basic; // sub-bombs use basic stats
        for (let k = -1; k <= 1; k++) {
          const ang = Math.atan2(p.vy, p.vx) + k * 0.3;
          const sp = Math.hypot(p.vx, p.vy) * 0.9;
          this.projectiles.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            weapon: { ...sub, color: p.weapon.color, blastRadius: 35 },
            pierceLeft: 0,
            splitAt: 0,
            life: 4,
            trail: [],
          });
        }
        p.life = 0;
        continue;
      }
      // Physics
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 12) p.trail.shift();
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Collision: ground
      if (p.y > GROUND_Y) {
        this.explode(p.x, GROUND_Y, p.weapon);
        this.projectiles.splice(i, 1);
        continue;
      }
      // Out of bounds
      if (p.x < -20 || p.x > W + 20 || p.y < -200) {
        this.projectiles.splice(i, 1);
        continue;
      }
      // Collision: building
      let hit = false;
      for (const b of this.buildings) {
        if (!b.alive) continue;
        const left = b.x - b.w / 2;
        const right = b.x + b.w / 2;
        const top = b.y - b.h;
        const bottom = b.y;
        if (p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) {
          hit = true;
          if (p.weapon.pierce && p.pierceLeft > 0) {
            // Damage this building, continue flying
            p.pierceLeft -= 1;
            b.hp -= p.weapon.damage * 0.6;
            b.hitFlashUntil = this.t + 0.15;
            this.particles.spawn({
              x: p.x,
              y: p.y,
              count: 10,
              speed: 150,
              life: 0.5,
              size: 3,
              color: p.weapon.color,
            });
            this.checkBuildingDeaths();
            hit = false; // don't explode
          } else {
            this.explode(p.x, p.y, p.weapon);
            this.projectiles.splice(i, 1);
          }
          break;
        }
      }
      if (hit) continue;
    }

    // Update burning buildings
    for (const b of this.buildings) {
      if (b.alive && this.t < b.burnUntil) {
        b.hp -= 12 * dt;
        if (Math.random() < dt * 4) {
          this.particles.spawn({
            x: b.x + (Math.random() - 0.5) * b.w,
            y: b.y - b.h * Math.random(),
            count: 1,
            speed: 30,
            life: 0.6,
            size: 3,
            color: "#FF7A1A",
          });
        }
      }
    }
    this.checkBuildingDeaths();

    // Win/lose check
    if (this.buildings.every((b) => !b.alive)) {
      this.win();
    } else if (this.ammo <= 0 && this.projectiles.length === 0) {
      // Brief delay before declaring loss
      if (!this.lostTimer) this.lostTimer = this.t + 1.5;
      if (this.t >= this.lostTimer) this.lose();
    } else {
      this.lostTimer = 0;
    }

    // Phase back to aim if no projectiles
    if (this.phase === "fire" && this.projectiles.length === 0) {
      this.phase = "aim";
    }
    this.emitHud();
  }

  private lostTimer = 0;

  private updateBurnZones(dt: number): void {
    for (let i = this.burnZones.length - 1; i >= 0; i--) {
      const z = this.burnZones[i];
      if (this.t > z.until) {
        this.burnZones.splice(i, 1);
        continue;
      }
      // Damage buildings in zone
      for (const b of this.buildings) {
        if (!b.alive) continue;
        const cx = clamp(z.x, b.x - b.w / 2, b.x + b.w / 2);
        const cy = clamp(z.y, b.y - b.h, b.y);
        if (Math.hypot(cx - z.x, cy - z.y) < z.r) {
          b.hp -= z.dps * dt;
        }
      }
      // Spawn fire particles
      if (Math.random() < dt * 8) {
        this.particles.spawn({
          x: z.x + (Math.random() - 0.5) * z.r,
          y: z.y,
          count: 1,
          speed: 40,
          life: 0.5,
          size: 3,
          color: "#FF7A1A",
        });
      }
      void dt;
    }
    this.checkBuildingDeaths();
  }

  private updateFloats(dt: number): void {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= dt * 40;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
  }

  private win(): void {
    if (this.phase === "won" || this.phase === "lost") return;
    this.phase = "won";
    // Unlock next weapon
    if (this.level.unlockWeapon) {
      this.unlocked.add(this.level.unlockWeapon);
    }
    this.result = {
      gameId: "bomb-island",
      win: true,
      score: this.score + this.ammo * 100, // ammo efficiency bonus
      destroyRate: 1,
      tipId: randomTip(this.levelIdx + 1).id,
    };
    this.toast = { text: `${this.level.name} 已清剿完毕！`, tone: "good", until: this.t + 3 };
    playSfx("win");
    this.emit({ type: "result", payload: this.result });
    this.emitHud();
  }

  private lose(): void {
    if (this.phase === "won" || this.phase === "lost") return;
    this.phase = "lost";
    const destroyed = this.buildings.filter((b) => !b.alive).length;
    this.result = {
      gameId: "bomb-island",
      win: false,
      score: this.score,
      destroyRate: destroyed / this.buildingsTotal,
      tipId: randomTip(this.levelIdx + 1).id,
    };
    playSfx("lose");
    this.emit({ type: "result", payload: this.result });
    this.emitHud();
  }

  getUnlocked(): WeaponId[] {
    return Array.from(this.unlocked);
  }

  private emitHud(): void {
    const alive = this.buildings.filter((b) => b.alive).length;
    const total = this.buildingsTotal;
    const hud: BombHud = {
      level: this.levelIdx + 1,
      totalLevels: LEVELS.length,
      ammo: this.ammo,
      score: this.score,
      weapon: this.currentWeapon,
      buildingsLeft: alive,
      buildingsTotal: total,
      destroyRate: (total - alive) / total,
      phase: this.phase,
      currentWeapon: WEAPONS[this.currentWeapon],
      unlocked: Array.from(this.unlocked),
    };
    this.emit({ type: "hud", payload: hud as unknown as Record<string, string | number> });
    if (this.toast && this.t < this.toast.until) {
      this.emit({ type: "toast", text: this.toast.text, tone: this.toast.tone });
    }
  }

  protected render(): void {
    const ctx = this.ctx;
    const shaking = this.t < this.shakeUntil;
    const sx = shaking ? (Math.random() - 0.5) * 6 : 0;
    const sy = shaking ? (Math.random() - 0.5) * 6 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, "#1A0E2E");
    sky.addColorStop(0.5, "#3A1A2E");
    sky.addColorStop(1, "#5A2A1E");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Distant mountains
    ctx.fillStyle = "rgba(60,30,40,0.6)";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(150, 320);
    ctx.lineTo(300, 380);
    ctx.lineTo(450, 290);
    ctx.lineTo(600, 360);
    ctx.lineTo(750, 310);
    ctx.lineTo(900, 370);
    ctx.lineTo(W, 340);
    ctx.lineTo(W, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // Smoke haze
    ctx.fillStyle = "rgba(255,122,26,0.06)";
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Ground (desert)
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    groundGrad.addColorStop(0, "#8B5A2B");
    groundGrad.addColorStop(1, "#4A2E1A");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    // Ground line
    ctx.strokeStyle = "rgba(255,176,32,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();

    // Buildings
    for (const b of this.buildings) {
      this.drawBuilding(ctx, b);
    }

    // Burn zones
    for (const z of this.burnZones) {
      const alpha = clamp((z.until - this.t) / 2, 0, 1);
      ctx.fillStyle = `rgba(255,122,26,${alpha * 0.2})`;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cannon
    this.drawCannon(ctx);

    // Trajectory preview (during aim)
    if (this.aiming) {
      this.drawAimPreview(ctx);
    }

    // Projectiles
    for (const p of this.projectiles) {
      this.drawProjectile(ctx, p);
    }

    this.particles.render(ctx);

    // Floating texts
    for (const f of this.floats) {
      const alpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      drawText(ctx, f.text, f.x, f.y, {
        size: 18,
        color: f.color,
        weight: "900",
        align: "center",
        shadow: { color: f.color, blur: 8 },
      });
      ctx.globalAlpha = 1;
    }

    // HUD
    this.drawCanvasHud(ctx);

    ctx.restore();
    void drawGrid;
    void roundRect;
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, b: Building): void {
    if (!b.alive) {
      // Rubble
      ctx.fillStyle = "#3A2A1A";
      ctx.fillRect(b.x - b.w / 2, GROUND_Y - 10, b.w, 10);
      ctx.fillStyle = "#5A3A2A";
      ctx.beginPath();
      ctx.moveTo(b.x - b.w / 2, GROUND_Y - 10);
      ctx.lineTo(b.x - b.w / 3, GROUND_Y - 18);
      ctx.lineTo(b.x, GROUND_Y - 14);
      ctx.lineTo(b.x + b.w / 3, GROUND_Y - 20);
      ctx.lineTo(b.x + b.w / 2, GROUND_Y - 10);
      ctx.closePath();
      ctx.fill();
      return;
    }
    const left = b.x - b.w / 2;
    const top = b.y - b.h;
    const flash = this.t < b.hitFlashUntil;
    // Body
    const grad = ctx.createLinearGradient(left, top, left, b.y);
    grad.addColorStop(0, b.def.color + "AA");
    grad.addColorStop(1, b.def.color + "44");
    ctx.fillStyle = flash ? "#FFFFFF" : grad;
    ctx.fillRect(left, top, b.w, b.h);
    // Border
    ctx.strokeStyle = b.def.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, b.w, b.h);
    // Armored overlay
    if (b.def.armored) {
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      for (let y = top + 12; y < b.y; y += 16) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + b.w, y);
        ctx.stroke();
      }
    }
    // Emoji
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.def.emoji, b.x, top + 24);
    // Name
    drawText(ctx, b.def.name, b.x, top + 48, {
      size: 10,
      color: "#F0F4FF",
      weight: "700",
      align: "center",
    });
    // HP bar
    const hpW = b.w;
    const hpH = 4;
    const hpX = left;
    const hpY = top - 10;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(hpX, hpY, hpW, hpH);
    const ratio = clamp(b.hp / b.maxHp, 0, 1);
    ctx.fillStyle = ratio > 0.5 ? "#52C41A" : ratio > 0.25 ? "#FFD666" : "#E5353B";
    ctx.fillRect(hpX, hpY, hpW * ratio, hpH);
    // Burning indicator
    if (this.t < b.burnUntil) {
      ctx.fillStyle = "#FF7A1A";
      ctx.shadowColor = "#FF7A1A";
      ctx.shadowBlur = 8;
      ctx.font = "12px sans-serif";
      ctx.fillText("🔥", b.x, top - 18);
      ctx.shadowBlur = 0;
    }
  }

  private drawCannon(ctx: CanvasRenderingContext2D): void {
    // Base
    ctx.fillStyle = "#3A4A5A";
    ctx.fillRect(CANNON_X - 24, CANNON_Y, 48, GROUND_Y - CANNON_Y);
    ctx.strokeStyle = "#1AD670";
    ctx.lineWidth = 2;
    ctx.strokeRect(CANNON_X - 24, CANNON_Y, 48, GROUND_Y - CANNON_Y);
    // Turret
    let angle = -Math.PI / 4;
    if (this.aiming) {
      const dx = CANNON_X - this.aimX;
      const dy = CANNON_Y - this.aimY;
      angle = Math.atan2(dy, dx);
    }
    ctx.save();
    ctx.translate(CANNON_X, CANNON_Y);
    ctx.rotate(angle);
    ctx.fillStyle = WEAPONS[this.currentWeapon].color;
    ctx.shadowColor = WEAPONS[this.currentWeapon].color;
    ctx.shadowBlur = 8;
    ctx.fillRect(0, -8, 50, 16);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0A1929";
    ctx.fillRect(46, -6, 6, 12);
    ctx.restore();
    // Wheels
    ctx.fillStyle = "#1A2A3A";
    ctx.beginPath();
    ctx.arc(CANNON_X - 14, GROUND_Y - 4, 8, 0, Math.PI * 2);
    ctx.arc(CANNON_X + 14, GROUND_Y - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    // Label
    drawText(ctx, "反诈炮兵", CANNON_X, CANNON_Y - 18, {
      size: 10,
      color: "#1AD670",
      weight: "700",
      align: "center",
      font: '"JetBrains Mono", monospace',
    });
  }

  private drawAimPreview(ctx: CanvasRenderingContext2D): void {
    const dx = CANNON_X - this.aimX;
    const dy = CANNON_Y - this.aimY;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return;
    const power = clamp(dist * POWER_K, POWER_MIN, POWER_MAX);
    const vx = (dx / dist) * power;
    const vy = (dy / dist) * power;
    // Simulate trajectory
    let x = CANNON_X;
    let y = CANNON_Y;
    let cvx = vx;
    let cvy = vy;
    const step = 0.04;
    ctx.fillStyle = WEAPONS[this.currentWeapon].color;
    for (let i = 0; i < 50; i++) {
      cvy += GRAVITY * step;
      x += cvx * step;
      y += cvy * step;
      if (y > GROUND_Y || x > W || x < 0) break;
      const alpha = 1 - i / 50;
      ctx.globalAlpha = alpha * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Power bar (near cannon)
    const barX = CANNON_X - 30;
    const barY = CANNON_Y - 40;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX, barY, 60, 6);
    const ratio = (power - POWER_MIN) / (POWER_MAX - POWER_MIN);
    const col = ratio > 0.7 ? "#E5353B" : ratio > 0.4 ? "#FFD666" : "#1AD670";
    ctx.fillStyle = col;
    ctx.fillRect(barX, barY, 60 * ratio, 6);
    drawText(ctx, `${Math.round(ratio * 100)}%`, CANNON_X, barY - 4, {
      size: 10,
      color: col,
      weight: "700",
      align: "center",
      font: '"JetBrains Mono", monospace',
    });
    // Aim point marker
    ctx.strokeStyle = WEAPONS[this.currentWeapon].color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.aimX, this.aimY, 10, 0, Math.PI * 2);
    ctx.stroke();
    // Line from cannon to aim
    ctx.strokeStyle = WEAPONS[this.currentWeapon].color + "55";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(CANNON_X, CANNON_Y);
    ctx.lineTo(this.aimX, this.aimY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
    // Trail
    for (let i = 0; i < p.trail.length; i++) {
      const t = p.trail[i];
      const alpha = i / p.trail.length;
      ctx.fillStyle = p.weapon.color;
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3 * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Body
    ctx.fillStyle = p.weapon.color;
    ctx.shadowColor = p.weapon.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Emoji
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.weapon.emoji, p.x, p.y);
  }

  private drawCanvasHud(ctx: CanvasRenderingContext2D): void {
    // Top bar
    ctx.fillStyle = "rgba(10,25,41,0.7)";
    ctx.fillRect(0, 0, W, 36);
    drawText(ctx, `LEVEL ${this.levelIdx + 1} · ${this.level.name}`, 16, 16, {
      size: 12,
      color: ACCENT,
      weight: "700",
      font: '"JetBrains Mono", monospace',
    });
    drawText(ctx, `AMMO ${this.ammo}/${this.level.ammo}`, W / 2, 16, {
      size: 14,
      color: this.ammo > 1 ? "#FFD666" : "#E5353B",
      weight: "900",
      align: "center",
      font: '"JetBrains Mono", monospace',
      shadow: { color: this.ammo > 1 ? "#FFD666" : "#E5353B", blur: 8 },
    });
    drawText(ctx, `SCORE ${this.score.toLocaleString()}`, W - 16, 16, {
      size: 12,
      color: "#F0F4FF",
      weight: "700",
      align: "right",
      font: '"JetBrains Mono", monospace',
    });

    // Bottom: buildings remaining
    const alive = this.buildings.filter((b) => b.alive).length;
    drawText(ctx, `目标 ${this.buildingsTotal - alive}/${this.buildingsTotal} 已摧毁`, 16, H - 14, {
      size: 11,
      color: "#1AD670",
      weight: "700",
      font: '"JetBrains Mono", monospace',
    });

    // Hint when no aim yet
    if (!this.aiming && this.ammo > 0 && this.projectiles.length === 0 && this.phase === "aim") {
      drawText(ctx, "按住并向左下拖拽瞄准 · 松开发射", W / 2, H - 50, {
        size: 13,
        color: "#7A8FB0",
        weight: "500",
        align: "center",
        font: '"JetBrains Mono", monospace',
      });
    }
  }
}
