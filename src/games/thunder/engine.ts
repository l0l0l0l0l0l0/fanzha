import { GameEngine } from "@/engine/GameEngine";
import { ParticleSystem } from "@/engine/Particle";
import { playSfx } from "@/engine/Audio";
import type { GameCanvas } from "@/platform/web";
import {
  clamp,
  clearCanvas,
  drawText,
  drawGrid,
} from "@/engine/Renderer";
import type { GameEvent, GameResultPayload } from "@/types";
import { randomTip } from "@/data/tips";
import { ENEMIES, WAVES, POWERUPS, BOSS } from "./data";
import type { WeaponLevel, PowerupKind, ThunderHud } from "./types";
import { InputManager } from "@/engine/Input";

const W = 540;
const H = 960;
const ACCENT = "#00E5FF";

const SHIP_Y = 820;
const SHIP_R = 22;

interface Player {
  x: number;
  y: number;
  tx: number; // target x for drag
  ty: number;
  weapon: WeaponLevel;
  lives: number;
  shield: boolean;
  bombs: number;
  fireCd: number;
  invincibleUntil: number;
}

interface Enemy {
  uid: number;
  def: (typeof ENEMIES)[string];
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  shootCd: number;
  phase: number;
  born: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  size: number;
  from: "player" | "enemy";
  life: number;
}

interface Powerup {
  x: number;
  y: number;
  vy: number;
  kind: PowerupKind;
  born: number;
}

interface Boss {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phase: number;
  fireCd: number;
  moveDir: number;
  spawnCd: number;
  enterUntil: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export class ThunderEngine extends GameEngine {
  private particles = new ParticleSystem();
  private input: InputManager;
  private player: Player = {
    x: W / 2,
    y: SHIP_Y,
    tx: W / 2,
    ty: SHIP_Y,
    weapon: 1,
    lives: 3,
    shield: false,
    bombs: 2,
    fireCd: 0,
    invincibleUntil: 0,
  };
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private powerups: Powerup[] = [];
  private floats: FloatingText[] = [];
  private boss: Boss | null = null;
  private wave = 0;
  private spawnQueue: { typeId: string; at: number; spawned: boolean }[] = [];
  private waveActive = false;
  private prepUntil = 0;
  private t = 0;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private comboUntil = 0;
  private over = false;
  private phase: "battle" | "boss" | "won" | "lost" = "battle";
  private result: GameResultPayload | null = null;
  private uidSeq = 1;
  private shakeUntil = 0;
  private bombFlashUntil = 0;
  private startedAt = 0;
  private bustedCount = 0;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private bossEnterAt = 0;

  constructor(canvas: GameCanvas) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    this.startedAt = performance.now();
    this.input = new InputManager(canvas);
    this.input.attach(this);
    this.input.setHandlers({
      onDrag: (_x, _y, _dx, _dy, id) => {
        const p = this.input.getPos(id);
        if (!p) return;
        this.player.tx = clamp(p.x, SHIP_R, W - SHIP_R);
        this.player.ty = clamp(p.y, H * 0.5, H - SHIP_R);
      },
    });
    this.startWave(0, 1.5);
    this.addDestroy(() => this.input.destroy());
  }

  private startWave(idx: number, prep: number): void {
    this.wave = idx;
    this.waveActive = false;
    this.prepUntil = this.t + prep;
    const wave = WAVES[idx];
    if (!wave) return;
    this.spawnQueue = [];
    for (const entry of wave) {
      const def = ENEMIES[entry.typeId];
      if (!def) continue;
      for (let i = 0; i < entry.count; i++) {
        this.spawnQueue.push({
          typeId: entry.typeId,
          at: this.prepUntil + entry.delay + i * entry.interval,
          spawned: false,
        });
      }
    }
    if (idx > 0) {
      this.toast = {
        text: `WAVE ${idx + 1}：${Array.from(new Set(wave.map((e) => ENEMIES[e.typeId].name))).join(" / ")}`,
        tone: "info",
        until: this.t + 2.5,
      };
    }
  }

  private spawnEnemy(typeId: string): void {
    const def = ENEMIES[typeId];
    if (!def) return;
    const x = 40 + Math.random() * (W - 80);
    this.enemies.push({
      uid: this.uidSeq++,
      def,
      x,
      y: -30,
      vx: 0,
      vy: def.speed,
      hp: def.hp,
      maxHp: def.hp,
      shootCd: def.shootInterval ?? 0,
      phase: 0,
      born: this.t,
    });
  }

  useBomb(): void {
    if (this.over || this.player.bombs <= 0) return;
    this.player.bombs -= 1;
    this.bombFlashUntil = this.t + 0.6;
    this.shakeUntil = this.t + 0.4;
    // Clear all enemy bullets
    this.bullets = this.bullets.filter((b) => b.from !== "enemy");
    // Damage all enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hp -= 80;
      if (e.hp <= 0) this.killEnemy(i, true);
    }
    // Damage boss
    if (this.boss) {
      this.boss.hp -= 120;
      this.particles.spawn({
        x: this.boss.x,
        y: this.boss.y,
        count: 30,
        speed: 280,
        life: 0.8,
        size: 4,
        color: "#FFD666",
      });
    }
    playSfx("bomb");
    this.emitHud();
  }

  protected update(dt: number): void {
    this.t += dt;
    this.particles.update(dt);
    this.updateFloats(dt);

    if (this.over) return;

    // Player movement (lerp toward target)
    const p = this.player;
    p.x += (p.tx - p.x) * Math.min(1, dt * 12);
    p.y += (p.ty - p.y) * Math.min(1, dt * 12);

    // Auto fire
    p.fireCd -= dt;
    if (p.fireCd <= 0) {
      p.fireCd = this.fireRateFor(p.weapon);
      this.firePlayerBullets();
    }

    // Combo decay
    if (this.t > this.comboUntil) this.combo = 0;

    // Wave management
    if (!this.waveActive && this.t >= this.prepUntil) {
      this.waveActive = true;
    }
    if (this.waveActive && this.phase === "battle") {
      for (const s of this.spawnQueue) {
        if (!s.spawned && this.t >= s.at) {
          s.spawned = true;
          this.spawnEnemy(s.typeId);
        }
      }
      const allSpawned = this.spawnQueue.every((s) => s.spawned);
      if (allSpawned && this.enemies.length === 0) {
        if (this.wave + 1 < WAVES.length) {
          this.startWave(this.wave + 1, 2.5);
        } else {
          // Spawn boss
          this.spawnBoss();
        }
      }
    }

    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateBullets(dt);
    this.updatePowerups(dt);
    this.checkCollisions();
  }

  private fireRateFor(weapon: WeaponLevel): number {
    return 0.18 - weapon * 0.015;
  }

  private firePlayerBullets(): void {
    const p = this.player;
    const dmg = 10 + p.weapon * 2;
    const col = "#00E5FF";
    const speed = 700;
    const shots: { x: number; vx: number }[] = [];
    switch (p.weapon) {
      case 1:
        shots.push({ x: p.x, vx: 0 });
        break;
      case 2:
        shots.push({ x: p.x - 8, vx: 0 });
        shots.push({ x: p.x + 8, vx: 0 });
        break;
      case 3:
        shots.push({ x: p.x, vx: 0 });
        shots.push({ x: p.x - 14, vx: -60 });
        shots.push({ x: p.x + 14, vx: 60 });
        break;
      case 4:
        shots.push({ x: p.x - 6, vx: 0 });
        shots.push({ x: p.x + 6, vx: 0 });
        shots.push({ x: p.x - 16, vx: -100 });
        shots.push({ x: p.x + 16, vx: 100 });
        break;
    }
    for (const s of shots) {
      this.bullets.push({
        x: s.x,
        y: p.y - 20,
        vx: s.vx,
        vy: -speed,
        damage: dmg,
        color: col,
        size: 4,
        from: "player",
        life: 2,
      });
    }
    playSfx("shoot");
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const age = this.t - e.born;
      // Movement pattern
      if (e.def.pattern === "zigzag") {
        e.vx = Math.sin(age * 3) * 120;
      } else if (e.def.pattern === "miner") {
        e.vx = Math.sin(age * 1.5) * 60;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = clamp(e.x, 20, W - 20);
      // Shoot
      if (e.def.shootInterval && e.y > 0 && e.y < H * 0.6) {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = e.def.shootInterval;
          this.enemyShoot(e);
        }
      }
      // Off-screen bottom
      if (e.y > H + 40) {
        this.enemies.splice(i, 1);
      }
    }
  }

  private enemyShoot(e: Enemy): void {
    if (e.def.pattern === "shooter") {
      // Aimed shot at player
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      this.bullets.push({
        x: e.x,
        y: e.y,
        vx: (dx / d) * 260,
        vy: (dy / d) * 260,
        damage: 1,
        color: "#E5353B",
        size: 5,
        from: "enemy",
        life: 4,
      });
    } else if (e.def.pattern === "miner") {
      // Drop mine (slow downward)
      this.bullets.push({
        x: e.x,
        y: e.y + 10,
        vx: 0,
        vy: 80,
        damage: 1,
        color: "#1AD670",
        size: 6,
        from: "enemy",
        life: 6,
      });
    }
    playSfx("tick");
  }

  private spawnBoss(): void {
    this.phase = "boss";
    this.bossEnterAt = this.t;
    this.boss = {
      x: W / 2,
      y: -60,
      hp: BOSS.hp,
      maxHp: BOSS.hp,
      phase: 1,
      fireCd: 1.5,
      moveDir: 1,
      spawnCd: 4,
      enterUntil: this.t + 2,
    };
    this.toast = {
      text: `BOSS 来袭：${BOSS.name} · ${BOSS.fraudType}`,
      tone: "bad",
      until: this.t + 3.5,
    };
    playSfx("boss");
  }

  private updateBoss(dt: number): void {
    const b = this.boss;
    if (!b) return;
    // Enter animation
    if (this.t < b.enterUntil) {
      b.y += ((120 - b.y) / Math.max(0.01, b.enterUntil - this.t)) * dt;
      return;
    }
    b.y = 120;
    // Movement
    b.x += b.moveDir * 80 * dt;
    if (b.x < 80) {
      b.x = 80;
      b.moveDir = 1;
    } else if (b.x > W - 80) {
      b.x = W - 80;
      b.moveDir = -1;
    }
    // Phase by HP
    const ratio = b.hp / b.maxHp;
    const newPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (newPhase !== b.phase) {
      b.phase = newPhase;
      this.shakeUntil = this.t + 0.3;
      this.particles.spawn({
        x: b.x,
        y: b.y,
        count: 30,
        speed: 240,
        life: 0.8,
        size: 4,
        color: "#FFD666",
      });
      this.toast = {
        text: `BOSS 狂暴阶段 ${newPhase}/3`,
        tone: "bad",
        until: this.t + 2,
      };
    }
    // Fire
    b.fireCd -= dt;
    if (b.fireCd <= 0) {
      b.fireCd = b.phase === 1 ? 1.2 : b.phase === 2 ? 0.9 : 0.6;
      this.bossFire();
    }
    // Spawn minions in phase 2+
    if (b.phase >= 2) {
      b.spawnCd -= dt;
      if (b.spawnCd <= 0) {
        b.spawnCd = 4;
        this.enemies.push({
          uid: this.uidSeq++,
          def: ENEMIES.script,
          x: b.x - 40,
          y: b.y + 30,
          vx: -40,
          vy: 100,
          hp: ENEMIES.script.hp,
          maxHp: ENEMIES.script.hp,
          shootCd: 0,
          phase: 0,
          born: this.t,
        });
        this.enemies.push({
          uid: this.uidSeq++,
          def: ENEMIES.script,
          x: b.x + 40,
          y: b.y + 30,
          vx: 40,
          vy: 100,
          hp: ENEMIES.script.hp,
          maxHp: ENEMIES.script.hp,
          shootCd: 0,
          phase: 0,
          born: this.t,
        });
      }
    }
  }

  private bossFire(): void {
    const b = this.boss!;
    if (b.phase === 1) {
      // Aimed 3-shot
      const dx = this.player.x - b.x;
      const dy = this.player.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const baseA = Math.atan2(dy, dx);
      for (let i = -1; i <= 1; i++) {
        const a = baseA + i * 0.2;
        this.bullets.push({
          x: b.x,
          y: b.y + 30,
          vx: Math.cos(a) * 280,
          vy: Math.sin(a) * 280,
          damage: 1,
          color: "#E5353B",
          size: 6,
          from: "enemy",
          life: 4,
        });
      }
    } else if (b.phase === 2) {
      // 8-way spread
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + this.t;
        this.bullets.push({
          x: b.x,
          y: b.y,
          vx: Math.cos(a) * 240,
          vy: Math.sin(a) * 240,
          damage: 1,
          color: "#FF7A1A",
          size: 5,
          from: "enemy",
          life: 4,
        });
      }
    } else {
      // Spiral bullet hell
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + this.t * 4;
        this.bullets.push({
          x: b.x,
          y: b.y,
          vx: Math.cos(a) * 200,
          vy: Math.sin(a) * 200,
          damage: 1,
          color: "#E5353B",
          size: 5,
          from: "enemy",
          life: 5,
        });
      }
    }
    playSfx("tick");
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        this.bullets.splice(i, 1);
      }
    }
  }

  private updatePowerups(dt: number): void {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.y += 80 * dt;
      if (p.y > H + 20) {
        this.powerups.splice(i, 1);
      }
    }
  }

  private updateFloats(dt: number): void {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= dt * 40;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
  }

  private checkCollisions(): void {
    const p = this.player;
    // Player bullets vs enemies
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.from !== "player") continue;
      // vs boss
      if (this.boss && this.t >= this.boss.enterUntil) {
        const boss = this.boss;
        const dx = b.x - boss.x;
        const dy = b.y - boss.y;
        if (Math.abs(dx) < 50 && Math.abs(dy) < 50) {
          boss.hp -= b.damage;
          this.particles.spawn({
            x: b.x,
            y: b.y,
            count: 4,
            speed: 80,
            life: 0.3,
            size: 2,
            color: b.color,
          });
          this.bullets.splice(i, 1);
          if (boss.hp <= 0) {
            this.killBoss();
          }
          continue;
        }
      }
      // vs enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (Math.hypot(dx, dy) < 22) {
          e.hp -= b.damage;
          this.particles.spawn({
            x: b.x,
            y: b.y,
            count: 4,
            speed: 80,
            life: 0.3,
            size: 2,
            color: b.color,
          });
          this.bullets.splice(i, 1);
          if (e.hp <= 0) {
            this.killEnemy(j, false);
          }
          break;
        }
      }
    }
    // Enemy bullets vs player
    if (this.t >= p.invincibleUntil) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.from !== "enemy") continue;
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (Math.hypot(dx, dy) < SHIP_R) {
          this.bullets.splice(i, 1);
          this.hitPlayer();
          break;
        }
      }
    }
    // Enemy body collision with player
    if (this.t >= p.invincibleUntil) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (Math.hypot(dx, dy) < SHIP_R + 20) {
          e.hp -= 50;
          if (e.hp <= 0) this.killEnemy(i, false);
          this.hitPlayer();
          break;
        }
      }
    }
    // Powerup pickup
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      const dx = pu.x - p.x;
      const dy = pu.y - p.y;
      if (Math.hypot(dx, dy) < SHIP_R + 16) {
        this.applyPowerup(pu.kind);
        this.powerups.splice(i, 1);
        playSfx("pickup");
      }
    }
    // Boss body collision with player
    if (this.boss && this.t >= this.boss.enterUntil && this.t >= p.invincibleUntil) {
      const boss = this.boss;
      if (Math.abs(boss.x - p.x) < 55 && Math.abs(boss.y - p.y) < 55) {
        this.hitPlayer();
      }
    }
  }

  private hitPlayer(): void {
    const p = this.player;
    if (p.shield) {
      p.shield = false;
      p.invincibleUntil = this.t + 1.0;
      this.shakeUntil = this.t + 0.2;
      this.particles.spawn({
        x: p.x,
        y: p.y,
        count: 18,
        speed: 200,
        life: 0.6,
        size: 3,
        color: "#00E5FF",
      });
      this.toast = { text: "护盾抵挡了一次攻击！", tone: "info", until: this.t + 1.5 };
      playSfx("hit");
      this.emitHud();
      return;
    }
    p.lives -= 1;
    p.invincibleUntil = this.t + 2;
    p.weapon = Math.max(1, p.weapon - 1) as WeaponLevel;
    this.combo = 0;
    this.shakeUntil = this.t + 0.4;
    this.particles.spawn({
      x: p.x,
      y: p.y,
      count: 28,
      speed: 260,
      life: 0.8,
      size: 4,
      color: "#E5353B",
    });
    playSfx("bad");
    if (p.lives <= 0) {
      this.lose();
    } else {
      this.toast = {
        text: `被击中！剩余生命 ${p.lives}`,
        tone: "bad",
        until: this.t + 2,
      };
    }
    this.emitHud();
  }

  private killEnemy(idx: number, byBomb: boolean): void {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    this.score += e.def.score;
    this.bustedCount += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboUntil = this.t + 2;
    this.particles.spawn({
      x: e.x,
      y: e.y,
      count: 14,
      speed: 180,
      life: 0.6,
      size: 3,
      color: e.def.color,
    });
    if (!byBomb) {
      this.floats.push({
        x: e.x,
        y: e.y - 10,
        text: `+${e.def.score}${this.combo > 1 ? ` ×${this.combo}` : ""}`,
        color: "#FFD666",
        life: 0.7,
        maxLife: 0.7,
      });
    }
    playSfx("explode");
    // Drop powerup
    if (e.def.dropRate && Math.random() < e.def.dropRate) {
      this.dropPowerup(e.x, e.y);
    }
    this.emitHud();
  }

  private dropPowerup(x: number, y: number): void {
    // Weighted random
    const r = Math.random();
    let kind: PowerupKind;
    if (r < 0.28) kind = "weapon";
    else if (r < 0.5) kind = "shield";
    else if (r < 0.68) kind = "bomb";
    else if (r < 0.82) kind = "life";
    else if (r < 0.92) kind = "clear";
    else kind = "phish"; // trap ~8%
    this.powerups.push({ x, y, vy: 90, kind, born: this.t });
  }

  private applyPowerup(kind: PowerupKind): void {
    const p = this.player;
    const def = POWERUPS[kind];
    let tone: "good" | "bad" | "info" = "good";
    switch (kind) {
      case "weapon":
        if (p.weapon < 4) {
          p.weapon = (p.weapon + 1) as WeaponLevel;
          this.toast = { text: `武器升级 → LV${p.weapon}`, tone: "good", until: this.t + 1.5 };
        } else {
          this.score += 200;
          this.toast = { text: "武器已满级，+200 分", tone: "good", until: this.t + 1.5 };
        }
        break;
      case "shield":
        p.shield = true;
        this.toast = { text: "护盾激活", tone: "good", until: this.t + 1.5 };
        break;
      case "bomb":
        p.bombs = Math.min(5, p.bombs + 1);
        this.toast = { text: `炸弹+1（共 ${p.bombs}）`, tone: "good", until: this.t + 1.5 };
        break;
      case "life":
        p.lives = Math.min(5, p.lives + 1);
        this.toast = { text: `生命+1（共 ${p.lives}）`, tone: "good", until: this.t + 1.5 };
        break;
      case "clear":
        this.bullets = this.bullets.filter((b) => b.from !== "enemy");
        this.particles.spawn({
          x: W / 2,
          y: H / 2,
          count: 40,
          speed: 400,
          life: 1,
          size: 4,
          color: "#B388FF",
        });
        this.bombFlashUntil = this.t + 0.5;
        this.toast = { text: "全屏清场！敌方子弹已清除", tone: "good", until: this.t + 1.8 };
        break;
      case "phish":
        p.weapon = Math.max(1, p.weapon - 1) as WeaponLevel;
        tone = "bad";
        this.toast = { text: "误拾钓鱼链接！武器降级", tone: "bad", until: this.t + 2 };
        this.shakeUntil = this.t + 0.3;
        break;
    }
    if (tone === "good") playSfx("good");
    this.emitHud();
  }

  private killBoss(): void {
    if (!this.boss) return;
    const b = this.boss;
    this.bustedCount += 10;
    this.score += 2000;
    this.particles.spawn({
      x: b.x,
      y: b.y,
      count: 80,
      speed: 360,
      life: 1.4,
      size: 5,
      color: "#FFD666",
    });
    this.particles.spawn({
      x: b.x,
      y: b.y,
      count: 40,
      speed: 240,
      life: 1.2,
      size: 4,
      color: "#E5353B",
    });
    this.shakeUntil = this.t + 0.8;
    this.boss = null;
    this.win();
  }

  private win(): void {
    if (this.over) return;
    this.over = true;
    this.phase = "won";
    this.result = {
      gameId: "thunder",
      win: true,
      score: this.score + this.player.lives * 300,
      bustedCount: this.bustedCount,
      tipId: randomTip(5).id,
    };
    playSfx("win");
    this.emit({ type: "result", payload: this.result });
  }

  private lose(): void {
    if (this.over) return;
    this.over = true;
    this.phase = "lost";
    this.result = {
      gameId: "thunder",
      win: false,
      score: this.score,
      bustedCount: this.bustedCount,
      tipId: randomTip(4).id,
    };
    playSfx("lose");
    this.emit({ type: "result", payload: this.result });
  }

  private emitHud(): void {
    const hud: ThunderHud = {
      lives: this.player.lives,
      shield: this.player.shield,
      bombs: this.player.bombs,
      score: this.score,
      combo: this.combo,
      weapon: this.player.weapon,
      phase: this.phase,
      bossHp: this.boss ? Math.ceil(this.boss.hp) : undefined,
      bossMax: this.boss ? this.boss.maxHp : undefined,
      bossPhase: this.boss?.phase,
      wave: this.wave + 1,
      totalWaves: WAVES.length,
    };
    this.emit({ type: "hud", payload: hud as unknown as Record<string, string | number> });
    if (this.toast && this.t < this.toast.until) {
      this.emit({ type: "toast", text: this.toast.text, tone: this.toast.tone });
    }
  }

  protected render(): void {
    const ctx = this.ctx;
    const shaking = this.t < this.shakeUntil;
    const sx = shaking ? (Math.random() - 0.5) * 8 : 0;
    const sy = shaking ? (Math.random() - 0.5) * 8 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    clearCanvas(ctx, W, H, "#070E1F");
    drawGrid(ctx, W, H, 32, "rgba(0,229,255,0.05)");

    // Stars background
    this.drawStars(ctx);

    // Powerups
    for (const pu of this.powerups) {
      const def = POWERUPS[pu.kind];
      const wob = Math.sin((this.t - pu.born) * 4) * 2;
      ctx.save();
      ctx.translate(pu.x, pu.y + wob);
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = def.color + "22";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = def.color;
      if (def.trap) {
        ctx.setLineDash([3, 3]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.emoji, 0, 0);
      ctx.restore();
    }

    // Enemies
    for (const e of this.enemies) {
      this.drawEnemy(ctx, e);
    }

    // Boss
    if (this.boss) this.drawBoss(ctx, this.boss);

    // Bullets
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Player ship
    if (!this.over || this.phase === "won") this.drawShip(ctx);

    this.particles.render(ctx);

    // Floating texts
    for (const f of this.floats) {
      const alpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      drawText(ctx, f.text, f.x, f.y, {
        size: 14,
        color: f.color,
        weight: "900",
        align: "center",
        shadow: { color: f.color, blur: 6 },
      });
      ctx.globalAlpha = 1;
    }

    // Bomb flash
    if (this.t < this.bombFlashUntil) {
      const alpha = (this.bombFlashUntil - this.t) / 0.6;
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD on canvas (top)
    this.drawCanvasHud(ctx);

    // Prep countdown
    if (!this.waveActive && this.phase === "battle" && !this.over) {
      const remaining = Math.max(0, this.prepUntil - this.t);
      drawText(ctx, `WAVE ${this.wave + 1}`, W / 2, H / 2 - 30, {
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

  private drawStars(ctx: CanvasRenderingContext2D): void {
    const t = this.t;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 137 + 23) % W;
      const y = ((i * 211 + t * 60) % H);
      const s = (i % 3) + 1;
      ctx.globalAlpha = 0.3 + (i % 3) * 0.2;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  private drawShip(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const blink = this.t < p.invincibleUntil && Math.floor(this.t * 12) % 2 === 0;
    if (blink) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Shield ring
    if (p.shield) {
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, SHIP_R + 8 + Math.sin(this.t * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // Ship body (triangle)
    ctx.fillStyle = ACCENT;
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-16, 14);
    ctx.lineTo(-8, 8);
    ctx.lineTo(0, 14);
    ctx.lineTo(8, 8);
    ctx.lineTo(16, 14);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // Cockpit
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(0, -6, 4, 0, Math.PI * 2);
    ctx.fill();
    // Engine flame
    ctx.fillStyle = "#FFD666";
    ctx.beginPath();
    ctx.moveTo(-6, 14);
    ctx.lineTo(0, 22 + Math.random() * 4);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = e.def.color + "22";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = e.def.color;
    ctx.stroke();
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.def.emoji, 0, 0);
    ctx.restore();
    // HP bar (if damaged)
    if (e.hp < e.maxHp) {
      const w = 36;
      const x = e.x - w / 2;
      const y = e.y - 28;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = "#E5353B";
      ctx.fillRect(x, y, w * (e.hp / e.maxHp), 3);
    }
  }

  private drawBoss(ctx: CanvasRenderingContext2D, b: Boss): void {
    ctx.save();
    ctx.translate(b.x, b.y);
    // Aura
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fillStyle = BOSS.color + "22";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = BOSS.color;
    ctx.shadowColor = BOSS.color;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Body
    ctx.font = "44px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(BOSS.emoji, 0, 0);
    // Phase indicator
    ctx.font = "900 14px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#FFD666";
    ctx.fillText(`P${b.phase}`, 0, -36);
    ctx.restore();
    // Boss HP bar (top)
    const barX = 60;
    const barY = 56;
    const barW = W - 120;
    const barH = 10;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#E5353B";
    ctx.strokeRect(barX, barY, barW, barH);
    const ratio = clamp(b.hp / b.maxHp, 0, 1);
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, "#E5353B");
    grad.addColorStop(1, "#FF7A1A");
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    drawText(ctx, `${BOSS.name} · ${Math.ceil(b.hp)}/${b.maxHp}`, W / 2, barY - 6, {
      size: 11,
      color: "#F0F4FF",
      weight: "700",
      align: "center",
      font: '"JetBrains Mono", monospace',
    });
  }

  private drawCanvasHud(ctx: CanvasRenderingContext2D): void {
    // Top score
    drawText(ctx, this.score.toLocaleString().padStart(6, "0"), W / 2, 32, {
      size: 22,
      color: "#F0F4FF",
      weight: "900",
      align: "center",
      font: '"JetBrains Mono", monospace',
      shadow: { color: ACCENT, blur: 8 },
    });
    drawText(ctx, "SCORE", W / 2, 46, {
      size: 9,
      color: "#7A8FB0",
      weight: "500",
      align: "center",
      font: '"JetBrains Mono", monospace',
    });

    // Lives (top-left)
    for (let i = 0; i < Math.min(this.player.lives, 5); i++) {
      ctx.save();
      ctx.translate(28 + i * 22, 30);
      ctx.fillStyle = "#E5353B";
      ctx.shadowColor = "#E5353B";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.bezierCurveTo(-7, -2, -7, -8, 0, -4);
      ctx.bezierCurveTo(7, -8, 7, -2, 0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Combo (top-right)
    if (this.combo >= 2) {
      drawText(ctx, `COMBO ×${this.combo}`, W - 24, 32, {
        size: 14,
        color: "#FFD666",
        weight: "900",
        align: "right",
        font: '"JetBrains Mono", monospace',
        shadow: { color: "#FFD666", blur: 8 },
      });
    }

    // Weapon + bombs (bottom-left small)
    drawText(ctx, `WPN LV${this.player.weapon}`, 24, H - 32, {
      size: 11,
      color: ACCENT,
      weight: "700",
      font: '"JetBrains Mono", monospace',
    });
    drawText(ctx, `BMB ×${this.player.bombs}`, 24, H - 16, {
      size: 11,
      color: "#FF7A1A",
      weight: "700",
      font: '"JetBrains Mono", monospace',
    });

    // Wave info (bottom-right)
    drawText(ctx, `WAVE ${this.wave + 1}/${WAVES.length}`, W - 24, H - 32, {
      size: 11,
      color: this.phase === "boss" ? "#E5353B" : "#7A8FB0",
      weight: "700",
      align: "right",
      font: '"JetBrains Mono", monospace',
    });
    if (this.phase === "boss") {
      drawText(ctx, "BOSS战", W - 24, H - 16, {
        size: 11,
        color: "#E5353B",
        weight: "900",
        align: "right",
        font: '"JetBrains Mono", monospace',
        shadow: { color: "#E5353B", blur: 6 },
      });
    }
  }
}
