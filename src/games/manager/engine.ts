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
  clipPath,
} from "@/engine/Renderer";
import type { GameEvent, GameResultPayload } from "@/types";
import { randomTip } from "@/data/tips";
import { AGENTS, ENEMIES, WAVES, getAgent } from "./data";
import type { DeploySlot, ManagerHud } from "./types";

const W = 960;
const H = 540;
const ACCENT = "#FFB020";

const LANE_Y = [130, 270, 410];
const SLOT_X = [110, 230, 350];
const BASE_X = 30;
const SPAWN_X = 990;

interface DeployedAgent {
  id: string;
  def: (typeof AGENTS)[number];
  row: number;
  col: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  cooldown: number;
  flashUntil: number;
}

interface Enemy {
  uid: number;
  def: (typeof ENEMIES)[string];
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  slowUntil: number;
  lane: number;
  wobble: number;
}

interface Projectile {
  x: number;
  y: number;
  tx: number;
  ty: number;
  target: Enemy | null;
  speed: number;
  damage: number;
  color: string;
  splash: number;
  life: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export class ManagerEngine extends GameEngine {
  private particles = new ParticleSystem();
  private base = { hp: 100, max: 100 };
  private wave = 0;
  private score = 0;
  private energy = 0;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private floats: FloatingText[] = [];
  private agents: DeployedAgent[] = [];
  private spawnQueue: { typeId: string; lane: number; at: number; spawned: boolean }[] = [];
  private waveActive = false;
  private prepUntil = 0;
  private t = 0;
  private slowUntil = 0;
  private ultFlashUntil = 0;
  private shakeUntil = 0;
  private over = false;
  private result: GameResultPayload | null = null;
  private uidSeq = 1;
  private startedAt = 0;
  private bustedCount = 0;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;

  constructor(canvas: GameCanvas, deployment: DeploySlot[]) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    this.startedAt = performance.now();
    this.placeAgents(deployment);
    this.startWave(0, 1.5);
  }

  private placeAgents(deployment: DeploySlot[]): void {
    for (const slot of deployment) {
      if (!slot.agentId) continue;
      const def = getAgent(slot.agentId);
      if (!def) continue;
      this.agents.push({
        id: slot.agentId,
        def,
        row: slot.row,
        col: slot.col,
        x: SLOT_X[slot.col],
        y: LANE_Y[slot.row],
        hp: def.hp,
        maxHp: def.hp,
        alive: true,
        cooldown: 0,
        flashUntil: 0,
      });
    }
  }

  private startWave(waveIdx: number, prepSec: number): void {
    this.wave = waveIdx;
    this.waveActive = false;
    this.prepUntil = this.t + prepSec;
    const wave = WAVES[waveIdx];
    if (!wave) return;
    this.spawnQueue = [];
    for (const entry of wave.enemies) {
      for (let i = 0; i < entry.count; i++) {
        this.spawnQueue.push({
          typeId: entry.typeId,
          lane: entry.lane,
          at: this.prepUntil + entry.delay + i * entry.interval,
          spawned: false,
        });
      }
    }
    if (waveIdx > 0) {
      this.toast = {
        text: `WAVE ${waveIdx + 1} 来袭：${wave.enemies
          .map((e) => ENEMIES[e.typeId].name)
          .join(" / ")}`,
        tone: "info",
        until: this.t + 3,
      };
    }
  }

  private spawnEnemy(typeId: string, lane: number): void {
    const def = ENEMIES[typeId];
    if (!def) return;
    this.enemies.push({
      uid: this.uidSeq++,
      def,
      x: SPAWN_X,
      y: LANE_Y[lane],
      hp: def.hp,
      maxHp: def.hp,
      slowUntil: 0,
      lane,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  triggerUlt(): void {
    if (this.over || this.energy < 100) return;
    this.energy = 0;
    this.ultFlashUntil = this.t + 0.6;
    this.shakeUntil = this.t + 0.4;
    this.slowUntil = this.t + 3;
    // Deal 60 damage to all enemies
    for (const e of this.enemies) {
      e.hp -= 60;
      e.slowUntil = this.t + 3;
      this.particles.spawn({
        x: e.x,
        y: e.y,
        count: 14,
        speed: 180,
        life: 0.6,
        size: 3,
        color: "#FFD666",
      });
    }
    // Heal team 30%
    for (const a of this.agents) {
      if (a.alive) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.3);
    }
    this.floats.push({
      x: W / 2,
      y: H / 2,
      text: "雷霆出击！",
      color: "#FFD666",
      life: 1.2,
      maxLife: 1.2,
    });
    playSfx("bomb");
    this.emitHud();
  }

  protected update(dt: number): void {
    this.t += dt;
    this.particles.update(dt);
    this.updateFloats(dt);

    if (this.over) return;

    // Wave management
    if (!this.waveActive && this.t >= this.prepUntil) {
      this.waveActive = true;
    }
    if (this.waveActive) {
      // Spawn scheduled
      for (const s of this.spawnQueue) {
        if (!s.spawned && this.t >= s.at) {
          s.spawned = true;
          this.spawnEnemy(s.typeId, s.lane);
        }
      }
      // Wave clear check
      const allSpawned = this.spawnQueue.every((s) => s.spawned);
      if (allSpawned && this.enemies.length === 0) {
        // Next wave or win
        if (this.wave + 1 < WAVES.length) {
          this.startWave(this.wave + 1, 3);
        } else {
          this.win();
          return;
        }
      }
    }

    this.updateEnemies(dt);
    this.updateAgents(dt);
    this.updateProjectiles(dt);
    this.updateEnergy(dt);
  }

  private updateEnemies(dt: number): void {
    const slowed = this.t < this.slowUntil;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      let speed = e.def.speed;
      if (slowed || this.t < e.slowUntil) speed *= 0.4;
      e.x -= speed * dt;
      e.wobble += dt * 6;
      // Heal aura (sweet)
      if (e.def.heal) {
        for (const other of this.enemies) {
          if (other !== e && Math.abs(other.x - e.x) < 60 && other.lane === e.lane) {
            other.hp = Math.min(other.maxHp, other.hp + e.def.heal * dt);
          }
        }
      }
      // Reached base
      if (e.x < BASE_X) {
        this.base.hp -= e.def.damage;
        this.shakeUntil = this.t + 0.25;
        this.enemies.splice(i, 1);
        this.particles.spawn({
          x: BASE_X,
          y: e.y,
          count: 16,
          speed: 200,
          life: 0.6,
          size: 3,
          color: "#E5353B",
        });
        playSfx("hit");
        this.toast = {
          text: `${e.def.name} 突破防线！基地 -${e.def.damage}`,
          tone: "bad",
          until: this.t + 2,
        };
        if (this.base.hp <= 0) {
          this.base.hp = 0;
          this.lose();
          return;
        }
      }
    }
  }

  private updateAgents(dt: number): void {
    for (const a of this.agents) {
      if (!a.alive) continue;
      a.cooldown -= dt;
      if (a.cooldown <= 0) {
        // Find target: nearest enemy in range, prefer same lane
        const target = this.findTarget(a);
        if (target) {
          a.cooldown = 1 / a.def.fireRate;
          a.flashUntil = this.t + 0.08;
          this.fireProjectile(a, target);
        }
      }
    }
  }

  private findTarget(a: DeployedAgent): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (e.x < a.x) continue; // only enemies ahead
      const dx = e.x - a.x;
      if (dx > a.def.range) continue;
      const sameLane = e.lane === a.row ? 0 : 1000;
      const score = dx + sameLane;
      if (score < bestDist) {
        bestDist = score;
        best = e;
      }
    }
    return best;
  }

  private fireProjectile(a: DeployedAgent, target: Enemy): void {
    const crit = a.def.crit && Math.random() < a.def.crit ? 1.8 : 1;
    this.projectiles.push({
      x: a.x + 18,
      y: a.y - 4,
      tx: target.x,
      ty: target.y,
      target,
      speed: a.def.projectileSpeed,
      damage: a.def.attack * crit,
      color: a.def.color,
      splash: a.def.splash ?? 0,
      life: 2,
    });
    playSfx("shoot");
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }
      // Track target
      if (p.target && p.target.hp > 0) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      } else {
        p.target = null;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) {
        // Hit
        this.applyHit(p);
        this.projectiles.splice(i, 1);
        continue;
      }
      const vx = (dx / dist) * p.speed;
      const vy = (dy / dist) * p.speed;
      p.x += vx * dt;
      p.y += vy * dt;
    }
  }

  private applyHit(p: Projectile): void {
    if (!p.target) return;
    const e = p.target;
    e.hp -= p.damage;
    this.particles.spawn({
      x: e.x,
      y: e.y,
      count: 6,
      speed: 120,
      life: 0.4,
      size: 2,
      color: p.color,
    });
    if (p.splash > 0) {
      for (const other of this.enemies) {
        if (other === e) continue;
        const d = Math.hypot(other.x - e.x, other.y - e.y);
        if (d < p.splash) {
          other.hp -= p.damage * 0.5;
        }
      }
      this.particles.spawn({
        x: e.x,
        y: e.y,
        count: 20,
        speed: 200,
        life: 0.6,
        size: 3,
        color: p.color,
      });
    }
    if (e.hp <= 0) {
      this.killEnemy(e);
    }
  }

  private killEnemy(e: Enemy): void {
    const idx = this.enemies.indexOf(e);
    if (idx < 0) return;
    this.enemies.splice(idx, 1);
    this.score += e.def.reward;
    this.bustedCount += 1;
    this.energy = clamp(this.energy + 8, 0, 100);
    this.particles.spawn({
      x: e.x,
      y: e.y,
      count: 18,
      speed: 220,
      life: 0.7,
      size: 3,
      color: e.def.color,
    });
    this.floats.push({
      x: e.x,
      y: e.y - 10,
      text: `+${e.def.reward}`,
      color: "#FFD666",
      life: 0.8,
      maxLife: 0.8,
    });
    playSfx("explode");
  }

  private updateEnergy(dt: number): void {
    this.energy = clamp(this.energy + dt * 2, 0, 100);
    this.emitHud();
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
    if (this.over) return;
    this.over = true;
    this.result = {
      gameId: "manager",
      win: true,
      score: this.score + Math.floor(this.base.hp * 5),
      bustedCount: this.bustedCount,
      tipId: randomTip(7).id,
    };
    this.toast = { text: "诈骗团伙全军覆没！", tone: "good", until: this.t + 3 };
    playSfx("win");
    this.emit({ type: "result", payload: this.result });
  }

  private lose(): void {
    if (this.over) return;
    this.over = true;
    this.result = {
      gameId: "manager",
      win: false,
      score: this.score,
      bustedCount: this.bustedCount,
      tipId: randomTip(3).id,
    };
    playSfx("lose");
    this.emit({ type: "result", payload: this.result });
  }

  private emitHud(): void {
    const hud: ManagerHud = {
      phase: this.over ? (this.result?.win ? "won" : "lost") : "battle",
      baseHp: Math.ceil(this.base.hp),
      baseMax: this.base.max,
      wave: this.wave + 1,
      totalWaves: WAVES.length,
      score: this.score,
      enemiesLeft: this.enemies.length + this.spawnQueue.filter((s) => !s.spawned).length,
      energy: Math.floor(this.energy),
      ultReady: this.energy >= 100,
      agents: this.agents.map((a) => ({
        id: a.id,
        hp: Math.ceil(a.hp),
        maxHp: a.maxHp,
        alive: a.alive,
      })),
      waveProgress: this.spawnQueue.length
        ? this.spawnQueue.filter((s) => s.spawned).length / this.spawnQueue.length
        : 0,
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

    clearCanvas(ctx, W, H, "#0A1929");
    drawGrid(ctx, W, H, 32, "rgba(0,229,255,0.05)");

    // Lane backgrounds
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,176,32,0.04)" : "rgba(0,229,255,0.04)";
      ctx.fillRect(0, LANE_Y[i] - 50, W, 100);
      // Lane line
      ctx.strokeStyle = "rgba(0,229,255,0.15)";
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, LANE_Y[i] - 50);
      ctx.lineTo(W, LANE_Y[i] - 50);
      ctx.moveTo(0, LANE_Y[i] + 50);
      ctx.lineTo(W, LANE_Y[i] + 50);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Base (left edge)
    this.drawBase(ctx);

    // Spawn zone (right edge)
    ctx.fillStyle = "rgba(229,53,59,0.08)";
    ctx.fillRect(W - 40, 0, 40, H);
    drawText(ctx, "诈骗窝点", W - 24, H / 2, {
      size: 12,
      color: "#E5353B",
      weight: "700",
      align: "center",
      font: '"JetBrains Mono", monospace',
    });
    ctx.save();
    ctx.translate(W - 24, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.restore();

    // Slot indicators
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const occupied = this.agents.find((a) => a.row === row && a.col === col);
        if (!occupied) {
          ctx.strokeStyle = "rgba(0,229,255,0.18)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(SLOT_X[col] - 22, LANE_Y[row] - 22, 44, 44);
          ctx.setLineDash([]);
        }
      }
    }

    // Agents
    for (const a of this.agents) {
      this.drawAgent(ctx, a);
    }

    // Enemies
    for (const e of this.enemies) {
      this.drawEnemy(ctx, e);
    }

    // Projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    this.particles.render(ctx);

    // Floating texts
    for (const f of this.floats) {
      const alpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      drawText(ctx, f.text, f.x, f.y, {
        size: 16,
        color: f.color,
        weight: "900",
        align: "center",
        shadow: { color: f.color, blur: 8 },
      });
      ctx.globalAlpha = 1;
    }

    // Ult flash
    if (this.t < this.ultFlashUntil) {
      const alpha = (this.ultFlashUntil - this.t) / 0.6;
      ctx.fillStyle = `rgba(255,214,102,${alpha * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Prep countdown
    if (!this.waveActive && !this.over) {
      const remaining = Math.max(0, this.prepUntil - this.t);
      drawText(ctx, `WAVE ${this.wave + 1} 来袭`, W / 2, H / 2 - 30, {
        size: 28,
        color: ACCENT,
        weight: "900",
        align: "center",
        shadow: { color: ACCENT, blur: 14 },
      });
      drawText(ctx, `${remaining.toFixed(1)}s`, W / 2, H / 2 + 10, {
        size: 40,
        color: "#F0F4FF",
        weight: "900",
        align: "center",
        font: '"JetBrains Mono", monospace',
        shadow: { color: "#00E5FF", blur: 12 },
      });
    }

    ctx.restore();
  }

  private drawBase(ctx: CanvasRenderingContext2D): void {
    const hpRatio = this.base.hp / this.base.max;
    // Base structure
    ctx.fillStyle = "#1B3A5A";
    ctx.fillRect(0, 0, BASE_X, H);
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, BASE_X, H);
    // HP bar
    const barH = H;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(8, 8, 6, barH - 16);
    const hpColor = hpRatio > 0.5 ? "#52C41A" : hpRatio > 0.25 ? "#FFD666" : "#E5353B";
    ctx.fillStyle = hpColor;
    ctx.fillRect(8, 8 + (barH - 16) * (1 - hpRatio), 6, (barH - 16) * hpRatio);
    // Label
    ctx.save();
    ctx.translate(20, H / 2);
    ctx.rotate(-Math.PI / 2);
    drawText(ctx, "反诈基地", 0, 0, {
      size: 11,
      color: "#00E5FF",
      weight: "700",
      align: "center",
      font: '"JetBrains Mono", monospace',
    });
    ctx.restore();
    void clipPath;
  }

  private drawAgent(ctx: CanvasRenderingContext2D, a: DeployedAgent): void {
    const flash = this.t < a.flashUntil;
    // Body
    ctx.save();
    ctx.translate(a.x, a.y);
    // Base circle
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fillStyle = a.def.color + "22";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = a.def.color;
    if (flash) {
      ctx.shadowColor = a.def.color;
      ctx.shadowBlur = 14;
    }
    ctx.stroke();
    // Emoji
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(a.def.emoji, 0, 0);
    ctx.restore();

    // Range indicator (subtle)
    if (flash) {
      ctx.strokeStyle = a.def.color + "33";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.def.range, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HP bar
    const hpW = 40;
    const hpH = 4;
    const hpX = a.x - hpW / 2;
    const hpY = a.y - 32;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(hpX, hpY, hpW, hpH);
    ctx.fillStyle = a.def.color;
    ctx.fillRect(hpX, hpY, hpW * (a.hp / a.maxHp), hpH);

    // Name
    drawText(ctx, a.def.name, a.x, a.y + 32, {
      size: 11,
      color: "#F0F4FF",
      weight: "700",
      align: "center",
    });
    drawText(ctx, a.def.role, a.x, a.y + 44, {
      size: 9,
      color: "#7A8FB0",
      weight: "500",
      align: "center",
      font: '"JetBrains Mono", monospace',
    });
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const wob = Math.sin(e.wobble) * 3;
    ctx.save();
    ctx.translate(e.x, e.y + wob);
    // Body
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fillStyle = e.def.color + "22";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = e.def.color;
    ctx.stroke();
    // Emoji
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.def.emoji, 0, 0);
    ctx.restore();

    // HP bar
    const hpW = 36;
    const hpH = 4;
    const hpX = e.x - hpW / 2;
    const hpY = e.y - 30;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(hpX, hpY, hpW, hpH);
    const hpRatio = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = hpRatio > 0.5 ? "#E5353B" : "#FFD666";
    ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);

    // Name
    drawText(ctx, e.def.name, e.x, e.y + 30, {
      size: 10,
      color: "#F0F4FF",
      weight: "700",
      align: "center",
    });

    // Slow indicator
    if (this.t < e.slowUntil || this.t < this.slowUntil) {
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Retry/redeploy hooks
  getResult(): GameResultPayload | null {
    return this.result;
  }
}
