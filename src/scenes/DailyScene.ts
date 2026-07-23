/**
 * 每日活动场景 · v2
 * 7 日签到环 + 资源栏 + 每日任务
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawPanel, drawButton, drawHudLabel, drawBadge, drawNeonCorners,
  hitTest, drawProgressRing, type Rect,
} from "@/ui/widgets";
import { drawIcon, type IconName } from "@/ui/icons";
import { clamp } from "@/engine/Renderer";
import { ParticleSystem } from "@/engine/Particle";
import { postFX } from "@/engine/PostFX";
import { playSfx, startBGM } from "@/engine/Audio";
import { platformStore } from "@/store/platformStore";
import { DAILY_QUESTS, CHECK_IN_REWARDS, type DailyQuestDef } from "@/data/daily";

const PAD = 16;
const TOP_BAR_H = 48;

export class DailyScene extends Scene {
  private t = 0;
  private scrollY = 0;
  private contentH = 800;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;
  private pressedButton: string | null = null;
  private particles = new ParticleSystem();
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;

  enter(): void {
    super.enter();
    startBGM("hub");
    // 初始化今日任务
    platformStore.ensureDailyQuests(DAILY_QUESTS.map((q) => ({ id: q.id, target: q.target })));
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    this.particles.update(dt);
    if (this.toast && this.t >= this.toast.until) this.toast = null;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 背景
    ctx.fillStyle = Theme.colors.bg.deep;
    ctx.fillRect(0, 0, screenW, screenH);

    // 滚动内容
    ctx.save();
    ctx.translate(0, -this.scrollY);
    this.renderContent(ctx, screenW, screenH);
    ctx.restore();

    // 固定顶部栏
    this.renderTopBar(ctx, screenW);

    // 粒子（屏幕坐标）
    this.particles.render(ctx);

    // Toast
    if (this.toast) {
      this.renderToast(ctx, screenW, screenH);
    }
  }

  // ============ 顶部栏 ============

  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.92)";
    ctx.fillRect(0, 0, screenW, TOP_BAR_H);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, TOP_BAR_H - 1, screenW, 1);
    ctx.restore();

    // 返回按钮
    const backRect = this.getBackRect();
    drawButton(ctx, backRect.x, backRect.y, backRect.w, backRect.h, "", {
      variant: "ghost",
      accent: this.pressedButton === "back" ? Theme.colors.neon.DEFAULT : Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backRect.x + backRect.w / 2 - 10, backRect.y + backRect.h / 2 - 10, 20, Theme.colors.ink.muted);

    // 标题
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("每日活动", screenW / 2, TOP_BAR_H / 2);
    ctx.restore();

    // 资源栏（右上角）
    this.renderResourceBar(ctx, screenW);
  }

  private renderResourceBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    const r = platformStore.state.resources;
    const items = [
      { icon: "coin" as IconName, val: r.coins, color: "#FFD666" },
      { icon: "energy" as IconName, val: r.energy, color: "#00E5FF" },
      { icon: "fragment" as IconName, val: r.fragments, color: "#FF7A1A" },
    ];
    let x = screenW - PAD;
    const y = 12;
    const itemH = 24;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      ctx.save();
      ctx.font = `700 12px ${Theme.fonts.mono}`;
      const tw = ctx.measureText(String(item.val)).width;
      const w = tw + 28;
      x -= w + 6;
      drawBadge(ctx, x, y, `${item.val}`, withAlpha(item.color, 0.15), item.color);
      drawIcon(ctx, item.icon, x + 4, y + 4, 12, item.color);
      ctx.restore();
    }
  }

  // ============ 内容 ============

  private renderContent(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number): void {
    let y = TOP_BAR_H + 16;

    // ===== 签到区标题 =====
    drawHudLabel(ctx, PAD, y, "// DAILY CHECK-IN · 每日签到", Theme.colors.neon.DEFAULT);
    y += 16;
    ctx.save();
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("连续签到", PAD, y);
    // 连签天数 + 火焰
    const streak = platformStore.state.dailyCheckIn.streak;
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.warn.DEFAULT;
    ctx.textAlign = "right";
    ctx.fillText(`${streak} 天`, screenW - PAD, y + 4);
    drawIcon(ctx, "flame", screenW - PAD - 48, y, 16, Theme.colors.warn.DEFAULT);
    ctx.restore();
    y += 36;

    // ===== 7 日签到环 =====
    y = this.renderCheckInRing(ctx, PAD, y, screenW - PAD * 2);
    y += 24;

    // ===== 每日任务标题 =====
    drawHudLabel(ctx, PAD, y, "// DAILY QUESTS · 每日任务", Theme.colors.flag.DEFAULT);
    y += 16;
    ctx.save();
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("今日任务", PAD, y);
    y += 36;
    ctx.restore();

    // ===== 任务列表 =====
    const quests = platformStore.state.dailyQuests.quests;
    for (let i = 0; i < DAILY_QUESTS.length; i++) {
      const def = DAILY_QUESTS[i];
      const state = quests.find((q) => q.id === def.id);
      if (!state) continue;
      this.renderQuestCard(ctx, PAD, y, screenW - PAD * 2, def, state.progress, state.claimed);
      y += 84;
    }

    y += 16;
    this.contentH = y;
  }

  /** 7 日签到环 */
  private renderCheckInRing(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): number {
    const h = 150;
    drawPanel(ctx, x, y, w, h, {
      borderColor: withAlpha(Theme.colors.neon.DEFAULT, 0.3),
      bgColor: withAlpha(Theme.colors.neon.DEFAULT, 0.04),
      cut: 8,
    });

    const canCheckIn = platformStore.canCheckInToday();
    const currentDay = platformStore.checkInDayInCycle();
    const lastDay = canCheckIn ? currentDay : currentDay; // 已签到的当天
    // 如果今天已签，claimed 到 currentDay；如果未签，claimed 到 currentDay-1
    const claimedUpTo = canCheckIn ? currentDay - 1 : currentDay;

    const circleR = 22;
    const gap = (w - circleR * 2 * 7) / 6;
    const startX = x + circleR;
    const cy = y + 60;

    // 连接线
    ctx.save();
    ctx.strokeStyle = withAlpha(Theme.colors.bg.line, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, cy);
    ctx.lineTo(startX + (circleR * 2 + gap) * 6, cy);
    ctx.stroke();
    // 已签到的连接线高亮
    if (claimedUpTo >= 1) {
      ctx.strokeStyle = withAlpha(Theme.colors.safe.DEFAULT, 0.6);
      ctx.beginPath();
      ctx.moveTo(startX, cy);
      ctx.lineTo(startX + (circleR * 2 + gap) * Math.min(claimedUpTo - 1, 6), cy);
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < 7; i++) {
      const day = i + 1;
      const cx = startX + i * (circleR * 2 + gap);
      const reward = CHECK_IN_REWARDS[i];
      const isClaimed = day <= claimedUpTo;
      const isToday = day === currentDay && canCheckIn;
      const isLocked = day > currentDay;

      ctx.save();
      // 圆圈背景
      if (isClaimed) {
        ctx.fillStyle = withAlpha(Theme.colors.safe.DEFAULT, 0.2);
        ctx.beginPath();
        ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = Theme.colors.safe.DEFAULT;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isToday) {
        // 今日：脉冲发光
        const pulse = 0.5 + Math.sin(this.t * 4) * 0.5;
        ctx.fillStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.15 + pulse * 0.15);
        ctx.beginPath();
        ctx.arc(cx, cy, circleR + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = Theme.colors.neon.DEFAULT;
        ctx.lineWidth = 2;
        ctx.shadowColor = Theme.colors.neon.DEFAULT;
        ctx.shadowBlur = 8 * pulse;
        ctx.beginPath();
        ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.3);
        ctx.beginPath();
        ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = withAlpha(Theme.colors.ink.dim, 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 内容
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (isClaimed) {
        drawIcon(ctx, "check", cx - 8, cy - 8, 16, Theme.colors.safe.DEFAULT);
      } else if (isToday) {
        ctx.font = `700 11px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.neon.DEFAULT;
        ctx.fillText("签到", cx, cy);
      } else if (isLocked) {
        drawIcon(ctx, "lock", cx - 8, cy - 8, 16, Theme.colors.ink.dim);
      } else {
        ctx.font = `700 12px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.fillText(String(day), cx, cy);
      }

      // 日期标签
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = isClaimed ? Theme.colors.safe.DEFAULT : isToday ? Theme.colors.neon.DEFAULT : Theme.colors.ink.dim;
      ctx.fillText(`D${day}`, cx, cy - circleR - 8);

      // 奖励标签
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = isClaimed ? withAlpha(Theme.colors.safe.DEFAULT, 0.7) : withAlpha(Theme.colors.ink.muted, 0.8);
      const rewardText = day === 7 ? "豪华礼包" : `+${reward.coins}🪙`;
      ctx.fillText(rewardText, cx, cy + circleR + 10);

      ctx.restore();
    }

    // 今日可签到提示
    if (canCheckIn) {
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.textAlign = "center";
      const blink = 0.5 + Math.sin(this.t * 3) * 0.5;
      ctx.globalAlpha = 0.6 + blink * 0.4;
      ctx.fillText("点击今日圆圈签到 ▲", x + w / 2, y + h - 14);
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.fillText(`今日已签到 · 明日再来（连续 ${platformStore.state.dailyCheckIn.streak} 天）`, x + w / 2, y + h - 14);
      ctx.restore();
    }

    return y + h;
  }

  /** 任务卡片 */
  private renderQuestCard(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number,
    def: DailyQuestDef,
    progress: number,
    claimed: boolean,
  ): void {
    const h = 76;
    const isComplete = progress >= def.target;
    const accent = claimed ? Theme.colors.ink.dim : isComplete ? Theme.colors.safe.DEFAULT : Theme.colors.flag.DEFAULT;

    drawPanel(ctx, x, y, w, h, {
      borderColor: withAlpha(accent, 0.35),
      bgColor: withAlpha(accent, 0.03),
      cut: 8,
    });

    // 按下高亮
    if (this.pressedButton === `quest-${def.id}` && isComplete && !claimed) {
      drawNeonCorners(ctx, x, y, w, h, accent, undefined, undefined, 6 + Math.sin(this.t * 8) * 3);
    }

    // 左侧图标
    const iconBox = h - 20;
    ctx.save();
    ctx.fillStyle = withAlpha(accent, 0.12);
    ctx.fillRect(x + 10, y + 10, iconBox, iconBox);
    ctx.strokeStyle = withAlpha(accent, 0.35);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 10, y + 10, iconBox, iconBox);
    ctx.restore();
    drawIcon(ctx, def.icon, x + 10 + 6, y + 10 + 6, iconBox - 12, accent);

    // 右侧内容
    const contentX = x + 10 + iconBox + 14;
    const contentW = w - (iconBox + 34) - 70;

    // 任务名
    ctx.save();
    ctx.font = `700 15px ${Theme.fonts.display}`;
    ctx.fillStyle = claimed ? Theme.colors.ink.muted : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(def.name, contentX, y + 12);
    ctx.restore();

    // 描述
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(def.description, contentX, y + 32);
    ctx.restore();

    // 进度条
    const barY = y + 52;
    const barW = contentW;
    ctx.save();
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.5);
    ctx.fillRect(contentX, barY, barW, 4);
    if (progress > 0) {
      const ratio = clamp(progress / def.target, 0, 1);
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 4;
      ctx.fillRect(contentX, barY, barW * ratio, 4);
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // 进度文字
    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = isComplete ? Theme.colors.safe.DEFAULT : Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.min(progress, def.target)}/${def.target} ${def.unit}`, contentX, y + 60);
    ctx.restore();

    // 领取按钮 / 已领取
    const btnW = 60;
    const btnH = 32;
    const btnX = x + w - btnW - 12;
    const btnY = y + (h - btnH) / 2;
    if (claimed) {
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("已领取", btnX + btnW / 2, btnY + btnH / 2);
      ctx.restore();
    } else if (isComplete) {
      drawButton(ctx, btnX, btnY, btnW, btnH, "领取", {
        variant: "primary",
        accent: Theme.colors.safe.DEFAULT,
        pressed: this.pressedButton === `quest-${def.id}`,
        fontSize: 12,
      });
    } else {
      drawButton(ctx, btnX, btnY, btnW, btnH, "进行中", {
        variant: "ghost",
        accent: Theme.colors.ink.dim,
        fontSize: 11,
      });
    }
  }

  // ============ Toast ============

  private renderToast(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.toast) return;
    const remain = this.toast.until - this.t;
    const alpha = remain > 0.5 ? 1 : remain / 0.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `500 13px ${Theme.fonts.body}`;
    const tw = ctx.measureText(this.toast.text).width;
    const w = tw + 32;
    const h = 36;
    const x = (screenW - w) / 2;
    const y = screenH - 80;
    const color = this.toast.tone === "good" ? Theme.colors.safe.DEFAULT : this.toast.tone === "bad" ? Theme.colors.warn.DEFAULT : Theme.colors.neon.DEFAULT;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(color, 0.5), bgColor: "rgba(10,25,41,0.95)" });
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.toast.text, screenW / 2, y + h / 2);
    ctx.restore();
  }

  // ============ 触摸 ============

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    const backRect = this.getBackRect();

    if (type === "start") {
      if (hitTest(x, y, backRect)) {
        this.pressedButton = "back";
        return true;
      }

      // 签到圆圈检测
      const canCheckIn = platformStore.canCheckInToday();
      if (canCheckIn) {
        const currentDay = platformStore.checkInDayInCycle();
        const circleR = 22;
        const gap = (screenW - PAD * 2 - circleR * 2 * 7) / 6;
        const startX = PAD + circleR;
        const cy = TOP_BAR_H + 16 + 16 + 36 + 60;
        const cx = startX + (currentDay - 1) * (circleR * 2 + gap);
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= circleR + 4) {
          this.pressedButton = "checkin";
          return true;
        }
      }

      // 任务领取按钮检测
      const quests = platformStore.state.dailyQuests.quests;
      let qy = TOP_BAR_H + 16 + 16 + 36 + 150 + 24 + 16 + 36;
      for (let i = 0; i < DAILY_QUESTS.length; i++) {
        const def = DAILY_QUESTS[i];
        const state = quests.find((q) => q.id === def.id);
        if (!state) continue;
        const isComplete = state.progress >= def.target && !state.claimed;
        if (isComplete) {
          const btnW = 60;
          const btnH = 32;
          const btnX = PAD + (screenW - PAD * 2) - btnW - 12;
          const btnY = qy + (76 - btnH) / 2;
          const btnRect: Rect = { x: btnX, y: btnY, w: btnW, h: btnH };
          if (hitTest(x, y, btnRect)) {
            this.pressedButton = `quest-${def.id}`;
            return true;
          }
        }
        qy += 84;
      }

      // 滚动
      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      this.isDragging = true;
      return false;
    } else if (type === "move") {
      if (this.isDragging) {
        const dy = y - this.dragStartY;
        this.scrollY = Math.max(0, Math.min(this.contentH - screenH, this.dragStartScroll - dy));
      }
      return false;
    } else if (type === "end") {
      if (this.pressedButton === "back") {
        playSfx("click");
        this.director.pop();
      } else if (this.pressedButton === "checkin") {
        const reward = platformStore.doDailyCheckIn();
        if (reward) {
          playSfx("achievement");
          postFX.flash(Theme.colors.neon.DEFAULT, 0.4, 2);
          this.particles.spawnBurst(this.director.screenWidth / 2, TOP_BAR_H + 92, Theme.colors.neon.DEFAULT, {
            ring: true, sparks: 12, dots: 16, speed: 200, life: 0.8, size: 4, color2: "#FFD666",
          });
          this.particles.spawnText(this.director.screenWidth / 2, TOP_BAR_H + 60, `+${reward.coins}🪙 +${reward.energy}⚡`, Theme.colors.neon.DEFAULT, { size: 16, life: 1.2 });
          this.toast = { text: `签到成功！D${reward.day} · 获得 ${reward.coins} 金币 + ${reward.energy} 能量`, tone: "good", until: this.t + 2.6 };
        }
      } else if (this.pressedButton && this.pressedButton.startsWith("quest-")) {
        const questId = this.pressedButton.slice(6);
        const def = DAILY_QUESTS.find((q) => q.id === questId);
        if (def) {
          const ok = platformStore.claimDailyQuest(questId, def.reward);
          if (ok) {
            playSfx("good");
            postFX.flash(Theme.colors.safe.DEFAULT, 0.3, 2);
            const rewardText = def.reward.coins ? `+${def.reward.coins}🪙` : def.reward.energy ? `+${def.reward.energy}⚡` : `+${def.reward.fragments}🔮`;
            this.particles.spawnText(this.director.screenWidth / 2, this.director.screenHeight / 2, rewardText, Theme.colors.safe.DEFAULT, { size: 18, life: 1.0 });
            this.toast = { text: `任务完成！${def.name} · ${rewardText}`, tone: "good", until: this.t + 2.2 };
          }
        }
      }
      this.pressedButton = null;
      this.isDragging = false;
      return false;
    }
    return false;
  }

  private getBackRect(): Rect {
    return { x: PAD, y: 8, w: 36, h: 32 };
  }
}
