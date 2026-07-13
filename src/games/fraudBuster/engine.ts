import { GameEngine } from "@/engine/GameEngine";
import { ParticleSystem } from "@/engine/Particle";
import { playSfx } from "@/engine/Audio";
import type { GameCanvas } from "@/platform/web";
import {
  clamp,
  clearCanvas,
  drawText,
  wrapText,
  roundRect,
  drawGrid,
} from "@/engine/Renderer";
import type { GameEvent, GameResultPayload } from "@/types";
import { randomTip } from "@/data/tips";
import { FBCardData, pickCard, waveConfig, rankByWave } from "./data";

const W = 480;
const H = 800;
const ACCENT = "#1AD670";

interface Card {
  data: FBCardData;
  spawnTs: number;
  duration: number;
  entered: number;
  exited: number;
  state: "in" | "show" | "out";
  verdict: "fraud" | "pass" | null;
  judged: boolean;
}

export class FraudBusterEngine extends GameEngine {
  private particles = new ParticleSystem();
  private state = {
    wave: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    shield: 3,
    busted: 0,
    unlockedTypes: new Set<string>(),
    over: false,
  };
  private current: Card | null = null;
  private usedIds = new Set<string>();
  private nextSpawnAt = 0;
  private t = 0;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private shakeUntil = 0;
  private result: GameResultPayload | null = null;
  private startedAt = 0;

  constructor(canvas: GameCanvas) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    this.startedAt = performance.now();
  }

  judge(verdict: "fraud" | "pass"): void {
    if (this.state.over || !this.current || this.current.judged) return;
    const c = this.current;
    c.judged = true;
    const correct = verdict === "fraud" ? c.data.isFraud : !c.data.isFraud;
    if (correct) {
      const speedBonus = clamp((c.duration - (this.t - c.spawnTs)) / c.duration, 0, 1) * 30;
      const base = Math.floor(100 * this.state.wave * 0.1 + 100 + speedBonus);
      this.state.combo += 1;
      this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
      const comboMul = 1 + Math.min(2, this.state.combo * 0.1);
      const gained = Math.floor(base * comboMul);
      this.state.score += gained;
      if (c.data.isFraud) {
        this.state.busted += 1;
        this.state.unlockedTypes.add(c.data.typeId);
      }
      c.verdict = verdict;
      c.state = "out";
      c.exited = 0;
      this.toast = {
        text: c.data.explain,
        tone: "good",
        until: this.t + 2.4,
      };
      this.particles.spawn({
        x: W / 2,
        y: H / 2,
        count: 18,
        speed: 200,
        life: 0.7,
        size: 3,
        color: c.data.isFraud ? "#FFD666" : "#52C41A",
      });
      playSfx("good");
    } else {
      this.state.combo = 0;
      this.state.shield -= 1;
      c.verdict = verdict;
      c.state = "out";
      c.exited = 0;
      const wrong = c.data.isFraud ? "你放过了诈骗！" : "误判，这是正常信息！";
      this.toast = { text: `${wrong} ${c.data.explain}`, tone: "bad", until: this.t + 2.8 };
      this.shakeUntil = this.t + 0.3;
      this.particles.spawn({
        x: W / 2,
        y: H / 2,
        count: 24,
        speed: 280,
        life: 0.8,
        size: 4,
        color: "#E5353B",
      });
      playSfx("bad");
      if (this.state.shield <= 0) this.gameOver();
    }
    this.emitHud();
  }

  private gameOver(): void {
    if (this.state.over) return;
    this.state.over = true;
    const durationSec = Math.floor((performance.now() - this.startedAt) / 1000);
    this.result = {
      gameId: "fraud-buster",
      win: false,
      score: this.state.score,
      wave: this.state.wave,
      bustedCount: this.state.busted,
      tipId: randomTip(this.state.wave).id,
    };
    playSfx("lose");
    this.emit({ type: "result", payload: this.result });
    void durationSec;
  }

  protected update(dt: number): void {
    this.t += dt;
    this.particles.update(dt);

    // 当前卡片
    if (this.current) {
      const c = this.current;
      if (c.state === "in") {
        c.entered = Math.min(1, c.entered + dt * 4);
        if (c.entered >= 1) c.state = "show";
      } else if (c.state === "show") {
        const elapsed = this.t - c.spawnTs;
        if (elapsed >= c.duration && !c.judged) {
          // 超时
          c.judged = true;
          this.state.combo = 0;
          this.state.shield -= 1;
          c.verdict = null;
          c.state = "out";
          c.exited = 0;
          this.toast = {
            text: `超时未判断！${c.data.explain}`,
            tone: "bad",
            until: this.t + 2.4,
          };
          this.shakeUntil = this.t + 0.3;
          playSfx("bad");
          this.emitHud();
          if (this.state.shield <= 0) this.gameOver();
        }
      } else if (c.state === "out") {
        c.exited = Math.min(1, c.exited + dt * 4);
        if (c.exited >= 1) {
          // 完全消失，进入下一波
          this.state.wave += 1;
          this.current = null;
          const cfg = waveConfig(this.state.wave);
          this.nextSpawnAt = this.t + cfg.cardInterval * 0.5;
          this.emitHud();
        }
      }
    } else if (!this.state.over) {
      // 生成下一张
      if (this.t >= this.nextSpawnAt) {
        this.spawnCard();
      }
    }
  }

  private spawnCard(): void {
    const cfg = waveConfig(this.state.wave);
    const card = pickCard(this.state.wave, this.usedIds);
    this.usedIds.add(card.sceneId);
    if (this.usedIds.size > 24) {
      // 重置避免穷尽
      const keep = Array.from(this.usedIds).slice(-12);
      this.usedIds = new Set(keep);
    }
    this.current = {
      data: card,
      spawnTs: this.t,
      duration: cfg.duration,
      entered: 0,
      exited: 0,
      state: "in",
      verdict: null,
      judged: false,
    };
    playSfx("tick");
  }

  private emitHud(): void {
    this.emit({
      type: "hud",
      payload: {
        wave: this.state.wave,
        score: this.state.score,
        combo: this.state.combo,
        shield: this.state.shield,
        rank: rankByWave(this.state.wave),
        busted: this.state.busted,
      },
    });
    if (this.toast) {
      this.emit({
        type: "toast",
        text: this.toast.text,
        tone: this.toast.tone,
      });
    }
  }

  protected render(): void {
    const ctx = this.ctx;
    const shaking = this.t < this.shakeUntil;
    const sx = shaking ? (Math.random() - 0.5) * 8 : 0;
    const sy = shaking ? (Math.random() - 0.5) * 8 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    clearCanvas(ctx, W, H, "#0A1929");
    drawGrid(ctx, W, H, 32, "rgba(0,229,255,0.05)");

    // 顶部标识
    this.drawHeader(ctx);

    // 当前卡片
    if (this.current) {
      this.drawCard(ctx, this.current);
    } else if (!this.state.over) {
      // 等待下一张
      drawText(ctx, `WAVE ${this.state.wave} 即将开始`, W / 2, H / 2, {
        size: 22,
        color: ACCENT,
        weight: "700",
        align: "center",
        shadow: { color: ACCENT, blur: 12 },
      });
    }

    // 粒子
    this.particles.render(ctx);
    ctx.restore();
  }

  private drawHeader(ctx: CanvasRenderingContext2D): void {
    // 段位
    const rank = rankByWave(this.state.wave);
    drawText(ctx, `WAVE ${this.state.wave.toString().padStart(3, "0")}`, 24, 36, {
      size: 28,
      color: ACCENT,
      weight: "900",
      shadow: { color: ACCENT, blur: 10 },
    });
    drawText(ctx, rank, 24, 56, {
      size: 14,
      color: "#FFD666",
      weight: "700",
    });

    // 分数
    drawText(ctx, this.state.score.toLocaleString().padStart(6, "0"), W - 24, 36, {
      size: 24,
      color: "#F0F4FF",
      weight: "900",
      align: "right",
      font: '"JetBrains Mono", monospace',
      shadow: { color: "#00E5FF", blur: 8 },
    });
    drawText(ctx, "SCORE", W - 24, 50, {
      size: 10,
      color: "#7A8FB0",
      weight: "500",
      align: "right",
      font: '"JetBrains Mono", monospace',
    });

    // 护盾
    const shieldY = 78;
    for (let i = 0; i < 5; i++) {
      const x = 24 + i * 22;
      const filled = i < this.state.shield;
      ctx.save();
      ctx.translate(x, shieldY);
      const heartColor = filled ? "#E5353B" : "#1B3A5A";
      ctx.fillStyle = heartColor;
      if (filled) {
        ctx.shadowColor = "#E5353B";
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-7, -2, -7, -8, 0, -4);
      ctx.bezierCurveTo(7, -8, 7, -2, 0, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 连击
    if (this.state.combo >= 2) {
      drawText(ctx, `COMBO x${this.state.combo}`, W - 24, 78, {
        size: 16,
        color: "#FFD666",
        weight: "900",
        align: "right",
        font: '"JetBrains Mono", monospace',
        shadow: { color: "#FFD666", blur: 10 },
      });
    }

    // 分隔线
    ctx.strokeStyle = "rgba(0,229,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 100);
    ctx.lineTo(W, 100);
    ctx.stroke();
  }

  private drawCard(ctx: CanvasRenderingContext2D, c: Card): void {
    const cardX = 32;
    const cardY = 130;
    const cardW = W - 64;
    const cardH = 460;
    let y = cardY;
    let alpha = 1;
    let scale = 1;

    if (c.state === "in") {
      const t = c.entered;
      const ease = 1 - Math.pow(1 - t, 3);
      y = cardY + (1 - ease) * 80;
      alpha = ease;
      scale = 0.92 + ease * 0.08;
    } else if (c.state === "out") {
      const t = c.exited;
      const ease = t * t;
      const slideDir = c.verdict === "fraud" ? -1 : c.verdict === "pass" ? 1 : 0;
      y = cardY + ease * 60;
      alpha = 1 - ease;
      if (slideDir) scale = 1 - ease * 0.3;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, y + cardH / 2);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -(y + cardH / 2));

    // 卡片底
    roundRect(ctx, cardX, y, cardW, cardH, 12);
    const isFraud = c.data.isFraud;
    const accentColor = isFraud ? "#E5353B" : "#1AD670";
    const grad = ctx.createLinearGradient(0, y, 0, y + cardH);
    grad.addColorStop(0, "#122A42");
    grad.addColorStop(1, "#0F2236");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = accentColor + "66";
    ctx.stroke();

    // 卡片类型标识
    const typeLabel = this.cardTypeLabel(c.data.cardType);
    drawText(ctx, typeLabel, cardX + 16, y + 28, {
      size: 11,
      color: accentColor,
      weight: "700",
      font: '"JetBrains Mono", monospace',
    });
    drawText(ctx, c.data.type, cardX + 16, y + 46, {
      size: 14,
      color: "#F0F4FF",
      weight: "700",
    });

    // 倒计时进度
    const elapsed = clamp(this.t - c.spawnTs, 0, c.duration);
    const progress = 1 - elapsed / c.duration;
    if (c.state === "show" || c.state === "in") {
      const barY = y + 14;
      const barX = cardX + cardW - 96;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      roundRect(ctx, barX, barY, 80, 6, 3);
      ctx.fill();
      const barColor = progress > 0.5 ? "#1AD670" : progress > 0.25 ? "#FFD666" : "#E5353B";
      ctx.fillStyle = barColor;
      roundRect(ctx, barX, barY, 80 * progress, 6, 3);
      ctx.fill();
      drawText(ctx, `${(c.duration - elapsed).toFixed(1)}s`, barX + 80, barY + 4, {
        size: 10,
        color: barColor,
        weight: "700",
        align: "right",
        font: '"JetBrains Mono", monospace',
      });
      ctx.restore();
    }

    // 卡片内容
    const contentY = y + 80;
    this.drawCardContent(ctx, c.data, cardX + 20, contentY, cardW - 40, accentColor);

    ctx.restore();
  }

  private drawCardContent(
    ctx: CanvasRenderingContext2D,
    data: FBCardData,
    x: number,
    y: number,
    w: number,
    accent: string
  ): void {
    // 标题（发送方）
    drawText(ctx, data.title, x, y + 14, {
      size: 13,
      color: "#7A8FB0",
      weight: "700",
      font: '"JetBrains Mono", monospace',
    });
    // 横线
    ctx.strokeStyle = "rgba(0,229,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(x, y + 28);
    ctx.lineTo(x + w, y + 28);
    ctx.stroke();

    // 内容（按 cardType 不同样式）
    const bodyY = y + 50;
    const bodyColor = "#F0F4FF";
    if (data.cardType === "call" || data.cardType === "video") {
      // 来电/视频通话卡片
      const isVideo = data.cardType === "video";
      const avatarCx = x + w / 2;
      const avatarCy = bodyY + 60;
      // avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCx, avatarCy, 32, 0, Math.PI * 2);
      ctx.fillStyle = accent + "22";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.font = "900 22px 'Noto Sans SC', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", avatarCx, avatarCy);
      ctx.restore();

      drawText(ctx, data.title, avatarCx, avatarCy + 56, {
        size: 14,
        color: "#F0F4FF",
        weight: "700",
        align: "center",
        max: 30,
      });
      drawText(ctx, isVideo ? "视频通话中…" : "来电中…", avatarCx, avatarCy + 76, {
        size: 11,
        color: accent,
        weight: "500",
        align: "center",
        font: '"JetBrains Mono", monospace',
      });

      // 通话内容（在下方）
      wrapText(ctx, data.body, x + 16, avatarCy + 100, w - 32, 22, {
        size: 14,
        color: bodyColor,
        weight: "500",
      });
    } else if (data.cardType === "sms") {
      // 短信样式
      const bubbleX = x;
      const bubbleY = bodyY;
      const bubbleW = w;
      const bubbleH = 60;
      ctx.save();
      roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 8);
      ctx.fillStyle = "#1B3A5A";
      ctx.fill();
      ctx.restore();
      drawText(ctx, data.title, bubbleX + 12, bubbleY + 18, {
        size: 11,
        color: "#FFD666",
        weight: "700",
        font: '"JetBrains Mono", monospace',
      });
      wrapText(ctx, data.body, bubbleX + 12, bubbleY + 32, bubbleW - 24, 18, {
        size: 12,
        color: bodyColor,
        weight: "500",
      });
    } else if (data.cardType === "transfer") {
      // 转账/支付弹窗
      ctx.save();
      roundRect(ctx, x, bodyY, w, 80, 8);
      ctx.fillStyle = "#1B3A5A";
      ctx.fill();
      ctx.restore();
      drawText(ctx, "💸 资金操作提示", x + 12, bodyY + 22, {
        size: 12,
        color: "#FFD666",
        weight: "700",
      });
      wrapText(ctx, data.body, x + 12, bodyY + 40, w - 24, 20, {
        size: 13,
        color: bodyColor,
        weight: "500",
      });
    } else if (data.cardType === "popup") {
      // 弹窗
      ctx.save();
      roundRect(ctx, x, bodyY, w, 60, 8);
      ctx.fillStyle = "#3A1A1A";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#E5353B";
      ctx.stroke();
      ctx.restore();
      drawText(ctx, "⚠ 网页弹窗", x + 12, bodyY + 22, {
        size: 11,
        color: "#E5353B",
        weight: "700",
        font: '"JetBrains Mono", monospace',
      });
      wrapText(ctx, data.body, x + 12, bodyY + 38, w - 24, 18, {
        size: 12,
        color: bodyColor,
        weight: "500",
      });
    } else {
      // chat - 微信风格气泡
      const bubbleX = x;
      const bubbleY = bodyY;
      // 计算高度
      ctx.save();
      ctx.font = "500 14px 'Noto Sans SC', sans-serif";
      const lines = Math.ceil(ctx.measureText(data.body).width / (w - 32)) || 1;
      const bubbleH = Math.max(80, 28 + lines * 22);
      ctx.restore();

      // avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(bubbleX + 16, bubbleY + 16, 14, 0, Math.PI * 2);
      ctx.fillStyle = accent + "44";
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.font = "900 12px 'Noto Sans SC', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", bubbleX + 16, bubbleY + 16);
      ctx.restore();

      // 气泡
      ctx.save();
      roundRect(ctx, bubbleX + 38, bubbleY, w - 38, bubbleH, 8);
      ctx.fillStyle = "#1B3A5A";
      ctx.fill();
      // 小三角
      ctx.beginPath();
      ctx.moveTo(bubbleX + 38, bubbleY + 8);
      ctx.lineTo(bubbleX + 30, bubbleY + 12);
      ctx.lineTo(bubbleX + 38, bubbleY + 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 发送方
      drawText(ctx, data.title, bubbleX + 50, bubbleY + 18, {
        size: 10,
        color: "#7A8FB0",
        weight: "700",
        max: 30,
      });
      // 内容
      wrapText(ctx, data.body, bubbleX + 50, bubbleY + 34, w - 56, 20, {
        size: 13,
        color: bodyColor,
        weight: "500",
      });
    }

    // 破绽提示（错误判断后显示 cues）
    // 不在游戏中显示，保持挑战；改在结算时显示
    void accent;
  }

  private cardTypeLabel(t: FBCardData["cardType"]): string {
    switch (t) {
      case "chat": return "💬 CHAT · 聊天消息";
      case "call": return "📞 INCOMING · 来电";
      case "video": return "📹 VIDEO · 视频通话";
      case "transfer": return "💸 TRANSFER · 资金操作";
      case "popup": return "⚠ POPUP · 网页弹窗";
      case "sms": return "📨 SMS · 短信通知";
    }
  }

  // 按钮点击入口
  reportFraud(): void {
    this.judge("fraud");
  }
  approvePass(): void {
    this.judge("pass");
  }

  // 暴露当前卡片信息（用于破绽提示等）
  getCurrentCardInfo(): { typeId: string; type: string; cues: string[] } | null {
    if (!this.current) return null;
    return {
      typeId: this.current.data.typeId,
      type: this.current.data.type,
      cues: this.current.data.cues,
    };
  }
}
