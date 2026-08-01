/**
 * 反诈成长主页 · 养成外壳（方向 A · 细打磨版）
 *
 * 把「玩家养成身份」提到 C 位，4 个街机小游戏降级为「训练场」。
 * 复用 HubScene 的顶栏/预警/滚动模式与平台存档，不损伤原有玩法。
 *
 * 细打磨三项：
 *  1) 横屏 letterbox：内容列定宽居中（DW ≤ 480），顶栏/预警/底栏约束到列宽，
 *     两侧留白铺网格 + 雷达 + 霓虹边框，横屏手机不再拉伸卡片。
 *  2) 经验条/段位动画：经验条缓动填充 + 流动光泽，头像外环进度环，段位提升
 *     检测（rankUp 音效 + toast + 屏闪），入场揭示动画。
 *  3) 训练场卡片视觉：drawTiltCard 按压视差 + drawGlowButton 发光按钮，
 *     难度星级 + 最佳成绩，idle 轻微摇摆。
 *
 * 布局（纵向可滚，列宽 DW，逻辑高 896）：
 * - 顶栏 0-56 / 预警 56-84 / 身份卡 96-214 / 进度 2×2 232-380 /
 *   训练场 5卡3行 400-912 / 每日 924-1044 / 更多 1064-1264 / 底栏 footer
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawStatCard, drawModalOverlay,
  drawHudLabel, drawNeonCorners, drawAlertTicker, drawAmbientGrid,
  drawTiltCard, drawGlowButton, drawStars, drawProgressRing, drawRadarBackground,
  hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon, drawLogo, type IconName } from "@/ui/icons";
import { GAMES } from "@/data/games";
import { CODEX_TOTAL, platformStore, rankProgress } from "@/store/platformStore";
import { AGENTS } from "@/games/manager/data";
import { setMuted } from "@/engine/Audio";
import { playSfx, startBGM } from "@/engine/Audio";
import { ParticleSystem } from "@/engine/Particle";
import { postFX } from "@/engine/PostFX";
import { BriefingScene } from "./BriefingScene";
import { BombIslandModeScene } from "./BombIslandModeScene";
import { LearningScene } from "./LearningScene";
import { StoryScene } from "./StoryScene";
import { DailyScene } from "./DailyScene";
import { HubScene } from "./HubScene";
import { FBCodexScene } from "./FBCodexScene";
import { AchievementsScene } from "./AchievementsScene";
import { onKeyDown, offKeyDown, type KeyListener } from "@/platform/web";
import { canvasToBlob, shareImageWithFallback } from "@/platform/web";
import { renderProgressReportCanvas } from "@/utils/battleReport";

/** 紧急预警滚动条目（结合全民防骗局 F26-F31 + 高发类型） */
const TICKER_ITEMS = [
  { level: "critical" as const, tag: "F26", text: "未成年人游戏诈骗：免费皮肤+拘留父母=伪造官方威胁，告知家长并举报" },
  { level: "critical" as const, tag: "F27", text: "冒充现役军人+不能视频+稳赚不赔=升级版杀猪盘" },
  { level: "warning" as const, tag: "F28", text: "买黄金交现金=虚假投资线下取现升级，凡线下交现金立即报警" },
  { level: "warning" as const, tag: "F30", text: "租卡卖卡日入千元=帮信罪案底，影响考公参军就业" },
  { level: "info" as const, tag: "F01", text: "公检法不电话办案，无安全账户，不转账验资" },
  { level: "warning" as const, tag: "F03", text: "刷单返利占电诈报案量约 25%，凡刷单必诈" },
  { level: "success" as const, tag: "96110", text: "遇可疑来电立即挂断，资金损失第一时间拨打 96110" },
];

const TOTAL_TERMS = 36;
/** 内容列最大宽度（letterbox：窄于屏幕时居中，避免横屏拉伸） */
const DESIGN_W_CAP = 480;

const LAYOUT = {
  topBarH: 56,
  tickerY: 56,
  tickerH: 28,
  identityY: 96,
  identityH: 118,
  progressLabelY: 232,
  progressY: 256,
  progressH: 58,
  trainingLabelY: 400,
  trainingY: 432,
  trainingH: 152,
  dailyLabelY: 924,
  dailyY: 948,
  dailyH: 96,
  entryLabelY: 1064,
  entryY: 1088,
  entryH: 52,
  entryGap: 10,
  footerH: 32,
};

export class GrowthHomeScene extends Scene {
  private scrollY = 0;
  private contentH = 1290;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;

  private pressedButton: string | null = null;
  private t = 0;
  private particles = new ParticleSystem();

  private displayedFools = 0;
  private displayedCodex = 0;
  private tickerScroll = 0;

  /** 经验条缓动填充（0..1） */
  private expFill = 0;
  /** 上一次段位，用于检测提升 */
  private lastRank = "";

  private confirmReset = false;

  /** 分享状态 */
  private shareState: "idle" | "busy" | "done" = "idle";
  private shareMessage = "";
  private shareStateUntil = 0;

  /** 轻量 toast（签到奖励等） */
  private toastMsg = "";
  private toastUntil = 0;

  private keyCb: KeyListener | null = null;

  enter(): void {
    super.enter();
    this.scrollY = 0;
    this.t = 0;
    this.expFill = 0;
    this.lastRank = rankProgress(platformStore.state.totalFoolsBusted).rank;
    startBGM("hub");
    // 保证每日任务有数据可展示
    platformStore.ensureDailyQuests([
      { id: "train", target: 1 },
      { id: "codex", target: 1 },
      { id: "quiz", target: 3 },
    ]);
    this.keyCb = (key: string) => this.onKey(key);
    onKeyDown(this.keyCb);
  }

  exit(): void {
    super.exit();
    if (this.keyCb) { offKeyDown(this.keyCb); this.keyCb = null; }
  }

  private onKey(key: string): void {
    if (key === "ArrowDown") { this.scrollY = Math.min(this.contentH - this.director.screenHeight, this.scrollY + 60); playSfx("click"); }
    else if (key === "ArrowUp") { this.scrollY = Math.max(0, this.scrollY - 60); playSfx("click"); }
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (Math.random() < dt * 8) {
      const screenW = this.director.screenWidth;
      this.particles.spawn({
        x: Math.random() * screenW, y: this.director.screenHeight + 10, count: 1,
        speed: 20 + Math.random() * 15, life: 4 + Math.random() * 2,
        size: 1.5 + Math.random() * 1.5,
        color: Math.random() < 0.5 ? "#00E5FF" : "#1B5FCC",
        spread: Math.PI * 0.1, angle: -Math.PI / 2, friction: 1,
      });
    }
    this.particles.update(dt);
    const stat = platformStore.state;
    this.displayedFools += (stat.totalFoolsBusted - this.displayedFools) * Math.min(1, dt * 4);
    this.displayedCodex += (stat.unlockedCodex.length - this.displayedCodex) * Math.min(1, dt * 4);
    this.tickerScroll += dt * 60;

    // 经验条缓动填充
    const rp = rankProgress(stat.totalFoolsBusted);
    this.expFill += (rp.ratio - this.expFill) * Math.min(1, dt * 3.2);

    // 段位提升检测
    if (this.lastRank && rp.rank !== this.lastRank && this.enterT > 0.5) {
      this.showToast(`段位提升 · ${rp.rank}！`);
      postFX.flash(Theme.colors.neon.DEFAULT, 0.3);
      playSfx("rankUp");
    }
    this.lastRank = rp.rank;

    if (this.shareState === "done" && this.t > this.shareStateUntil) {
      this.shareState = "idle"; this.shareMessage = "";
    }
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);
    drawAmbientGrid(ctx, screenW, screenH, this.t, "rgba(0,229,255,0.04)");
    this.particles.render(ctx);

    const gx = this.getGutterX(screenW);
    const DW = this.getDesignW(screenW);
    const colX0 = gx;
    const colX1 = gx + DW;

    // 横屏/宽屏：两侧留白装饰
    if (gx > 40) {
      this.drawColumnFrame(ctx, colX0, colX1, screenH);
      const r = Math.min(gx * 0.42, screenH * 0.34);
      drawRadarBackground(ctx, colX0 / 2, screenH / 2, r, this.t, Theme.colors.neon.DEFAULT);
      drawRadarBackground(ctx, colX1 + gx / 2, screenH / 2, r, this.t + 2.1, Theme.colors.police.DEFAULT);
    }

    // 内容列（纵向可滚 + 入场揭示）
    const reveal = Math.min(1, this.enterT / 0.55);
    const dy = (1 - reveal) * 18;
    ctx.save();
    ctx.translate(0, -this.scrollY + dy);
    ctx.globalAlpha = reveal;
    this.renderContent(ctx, colX0 + 16, DW - 32);
    ctx.restore();

    // 固定栏（约束到列宽，铺满横屏留白之外）
    this.renderTopBar(ctx, colX0, colX1);
    drawAlertTicker(ctx, colX0, LAYOUT.tickerY, DW, LAYOUT.tickerH, TICKER_ITEMS, this.tickerScroll, this.t);
    this.renderFooter(ctx, colX0, colX1, screenH);
    this.renderToast(ctx, screenW, screenH);

    if (this.confirmReset) this.renderResetModal(ctx, screenW, screenH);
  }

  private drawColumnFrame(ctx: CanvasRenderingContext2D, colX0: number, colX1: number, screenH: number): void {
    ctx.save();
    ctx.strokeStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.22);
    ctx.shadowColor = Theme.colors.neon.DEFAULT;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(colX0, 0); ctx.lineTo(colX0, screenH);
    ctx.moveTo(colX1, 0); ctx.lineTo(colX1, screenH);
    ctx.stroke();
    ctx.restore();
  }

  // ===================== letterbox 几何 =====================
  private getDesignW(screenW: number): number { return Math.min(screenW, DESIGN_W_CAP); }
  private getGutterX(screenW: number): number {
    return Math.max(0, (screenW - this.getDesignW(screenW)) / 2);
  }

  // ===================== 顶栏 =====================
  private renderTopBar(ctx: CanvasRenderingContext2D, colX0: number, colX1: number): void {
    const w = colX1 - colX0;
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.85)";
    ctx.fillRect(colX0, 0, w, LAYOUT.topBarH);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(colX0, LAYOUT.topBarH - 1, w, 1);
    ctx.restore();

    drawLogo(ctx, colX0 + 16, 12, 32, false);

    const shareBtn = this.getShareButtonRect(colX1);
    drawButton(ctx, shareBtn.x, shareBtn.y, shareBtn.w, shareBtn.h, "", {
      variant: "ghost",
      accent: this.shareState === "done" ? Theme.colors.safe.DEFAULT
        : this.shareState === "busy" ? Theme.colors.neon.DEFAULT : Theme.colors.ink.muted,
      pressed: this.pressedButton === "share",
    });
    if (this.shareState === "idle") drawIcon(ctx, "share", shareBtn.x + shareBtn.w / 2 - 10, shareBtn.y + shareBtn.h / 2 - 10, 20, Theme.colors.ink.muted);
    else if (this.shareState === "busy") {
      ctx.save();
      const cx = shareBtn.x + shareBtn.w / 2, cy = shareBtn.y + shareBtn.h / 2;
      ctx.strokeStyle = Theme.colors.neon.DEFAULT; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); const start = this.t * 6; ctx.arc(cx, cy, 8, start, start + Math.PI * 1.4); ctx.stroke();
      ctx.restore();
    } else drawIcon(ctx, "check", shareBtn.x + shareBtn.w / 2 - 10, shareBtn.y + shareBtn.h / 2 - 10, 20, Theme.colors.safe.DEFAULT);

    const soundBtn = this.getSoundButtonRect(colX1);
    drawButton(ctx, soundBtn.x, soundBtn.y, soundBtn.w, soundBtn.h, "", {
      variant: "ghost",
      accent: platformStore.state.settings.sound ? Theme.colors.neon.DEFAULT : Theme.colors.ink.dim,
    });
    drawIcon(ctx, platformStore.state.settings.sound ? "volumeOn" : "volumeOff",
      soundBtn.x + soundBtn.w / 2 - 10, soundBtn.y + soundBtn.h / 2 - 10, 20,
      platformStore.state.settings.sound ? Theme.colors.neon.DEFAULT : Theme.colors.ink.dim);

    const resetBtn = this.getResetButtonRect(colX1);
    drawButton(ctx, resetBtn.x, resetBtn.y, resetBtn.w, resetBtn.h, "", {
      variant: "ghost",
      accent: this.pressedButton === "reset" ? Theme.colors.warn.glow : Theme.colors.ink.muted,
      pressed: this.pressedButton === "reset",
    });
    drawIcon(ctx, "trash", resetBtn.x + resetBtn.w / 2 - 10, resetBtn.y + resetBtn.h / 2 - 10, 20, Theme.colors.ink.muted);
  }

  private renderFooter(ctx: CanvasRenderingContext2D, colX0: number, colX1: number, screenH: number): void {
    const y = screenH - LAYOUT.footerH;
    const w = colX1 - colX0;
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.9)";
    ctx.fillRect(colX0, y, w, LAYOUT.footerH);
    ctx.fillStyle = Theme.colors.bg.line; ctx.fillRect(colX0, y, w, 1);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillStyle = Theme.colors.flag.DEFAULT; ctx.fillText("96110", colX0 + 12, y + 16);
    ctx.fillStyle = Theme.colors.ink.muted; ctx.fillText(" 反诈专线 · ", colX0 + 12 + 28, y + 16);
    ctx.fillStyle = Theme.colors.neon.DEFAULT; ctx.fillText("12321", colX0 + 12 + 96, y + 16);
    ctx.fillStyle = Theme.colors.ink.muted; ctx.fillText(" 举报渠道", colX0 + 12 + 132, y + 16);
    ctx.textAlign = "right"; ctx.fillText("全民反诈 · 天下无诈", colX1 - 12, y + 16);
    ctx.restore();
  }

  private renderToast(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.toastMsg || this.t > this.toastUntil) return;
    const w = Math.min(260, screenW - 32);
    const h = 44;
    const x = (screenW - w) / 2;
    const y = LAYOUT.tickerY + LAYOUT.tickerH + 10;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(Theme.colors.safe.DEFAULT, 0.6), bgColor: "rgba(10,25,41,0.95)", cut: 8 });
    drawIcon(ctx, "check", x + 12, y + h / 2 - 10, 20, Theme.colors.safe.DEFAULT);
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(this.toastMsg, x + 40, y + h / 2);
    ctx.restore();
  }

  // ===================== 内容区 =====================
  private renderContent(ctx: CanvasRenderingContext2D, x: number, w: number): void {
    // ===== 养成身份卡 =====
    this.renderIdentityCard(ctx, x, LAYOUT.identityY, w, LAYOUT.identityH);

    // ===== 养成进度 2×2 =====
    drawHudLabel(ctx, x, LAYOUT.progressLabelY, "// 养成进度 · 知识即免疫力", Theme.colors.ink.muted);
    this.renderProgressGrid(ctx, x, LAYOUT.progressY, w);

    // ===== 训练场 2×2 =====
    drawHudLabel(ctx, x, LAYOUT.trainingLabelY, "// 训练场 · 在实战中练就反诈本能", Theme.colors.ink.muted);
    this.renderTrainingGrid(ctx, x, LAYOUT.trainingY, w);

    // ===== 每日签到 + 任务 =====
    drawHudLabel(ctx, x, LAYOUT.dailyLabelY, "// 每日养成 · 签到与任务", Theme.colors.ink.muted);
    this.renderDailyRow(ctx, x, LAYOUT.dailyY, w, LAYOUT.dailyH);

    // ===== 更多入口 =====
    drawHudLabel(ctx, x, LAYOUT.entryLabelY, "// 更多 · 学习 / 剧情 / 图鉴", Theme.colors.ink.muted);
    this.renderEntryGrid(ctx, x, LAYOUT.entryY, w);

    this.contentH = 1290;
  }

  /** 养成身份卡：段位 + Lv + 经验条 + 累计识破 */
  private renderIdentityCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const accent = Theme.colors.neon.DEFAULT;
    const rp = rankProgress(platformStore.state.totalFoolsBusted);
    const level = Math.min(99, Math.floor(platformStore.state.totalFoolsBusted / 20) + 1);
    const fools = Math.floor(this.displayedFools);
    const reveal = Math.min(1, this.enterT / 0.9);
    const shownRatio = this.expFill * reveal;

    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(accent, 0.45), bgColor: withAlpha(accent, 0.05), cut: 12 });
    drawNeonCorners(ctx, x, y, w, h, accent, undefined, undefined, 6 + Math.sin(this.t * 4) * 3);

    // 左侧圆形头像（盾徽）+ 进度环
    const avatarR = 34;
    const ax = x + 42;
    const ay = y + h / 2;
    ctx.save();
    ctx.fillStyle = withAlpha(accent, 0.18);
    ctx.beginPath(); ctx.arc(ax, ay, avatarR + 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = withAlpha(accent, 0.95);
    ctx.shadowColor = accent; ctx.shadowBlur = 12 + Math.sin(this.t * 4) * 4;
    ctx.beginPath(); ctx.arc(ax, ay, avatarR, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    drawIcon(ctx, "shield", ax - 17, ay - 17, 34, "#0A1929");
    ctx.restore();
    // 经验进度环（绕头像）
    drawProgressRing(ctx, ax, ay, avatarR + 8, shownRatio, accent, this.t, `${Math.round(shownRatio * 100)}%`);

    const contentX = x + 96;
    const cw = w - 96 - 16;

    // 标题行
    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("反诈小卫士", contentX, y + 14);
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = accent; ctx.textAlign = "right";
    ctx.fillText(`Lv.${level}`, x + w - 16, y + 16);
    ctx.restore();

    // 段位（呼吸辉光）
    ctx.save();
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = accent; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.4); ctx.shadowBlur = 8 + Math.sin(this.t * 3) * 4;
    ctx.fillText(rp.rank, contentX, y + 38);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 经验条（到下一段位）+ 流动光泽
    const barX = contentX, barY = y + 74, barW = cw, barH = 6;
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.7);
    ctx.fillRect(barX, barY, barW, barH);
    const fillW = Math.max(0, barW * shownRatio);
    if (fillW > 0) {
      ctx.save();
      ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 6;
      ctx.fillRect(barX, barY, fillW, barH);
      // 流动光泽
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.rect(barX, barY, fillW, barH); ctx.clip();
      const fpos = (this.t * 0.7) % 1;
      const hx = barX + fillW * fpos;
      const sheen = ctx.createLinearGradient(hx - 16, 0, hx + 16, 0);
      sheen.addColorStop(0, "rgba(255,255,255,0)");
      sheen.addColorStop(0.5, "rgba(255,255,255,0.35)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(barX, barY, fillW, barH);
      ctx.restore();
    }
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    const tip = rp.next ? `距「${rp.next}」还需 ${Math.max(0, rp.threshold - fools)} 次识破` : "已达最高段位 · 反诈之神";
    ctx.fillText(tip, barX, barY + 10);
    ctx.restore();

    // 累计识破（右下角大字）
    ctx.save();
    ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.font = `700 26px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(String(fools), x + w - 16, y + h - 12);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("累计识破诈骗 (次)", x + w - 16, y + h - 40);
    ctx.restore();
  }

  /** 养成进度 2×2 */
  private renderProgressGrid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const meta = platformStore.state.managerMeta;
    const wrongCount = Object.keys(meta.wrongQuestions).length;
    const stats = [
      { label: "图鉴收集度", value: `${platformStore.state.unlockedCodex.length}`, unit: `/ ${CODEX_TOTAL}`, color: Theme.colors.safe.DEFAULT },
      { label: "口诀收藏", value: `${meta.collectedTerms.length}`, unit: `/ ${TOTAL_TERMS}`, color: Theme.colors.police.DEFAULT },
      { label: "探员解锁", value: `${meta.unlockedAgents.length}`, unit: `/ ${AGENTS.length}`, color: Theme.colors.neon.DEFAULT },
      { label: "错题待巩固", value: String(wrongCount), unit: " 题", color: Theme.colors.warn.DEFAULT },
    ];
    const cardW = (w - 8) / 2;
    const cardH = LAYOUT.progressH;
    for (let i = 0; i < stats.length; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      drawStatCard(ctx, x + col * (cardW + 8), y + row * (cardH + 8), cardW, cardH, stats[i]);
    }
  }

  /** 训练场 2×2：4 款游戏（TiltCard + 发光按钮 + 难度星级 + 最佳成绩） */
  private renderTrainingGrid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const cardW = (w - 12) / 2;
    const cardH = LAYOUT.trainingH;
    for (let i = 0; i < GAMES.length; i++) {
      const g = GAMES[i];
      const col = i % 2, row = Math.floor(i / 2);
      const cx = x + col * (cardW + 12);
      const cy = y + row * (cardH + 12);
      const isPressed = this.pressedButton === `train-${i}`;
      const best = platformStore.state.bestScores[g.id] || 0;
      const tiltX = Math.sin(this.t * 0.7 + i * 1.3) * 0.05;
      const tiltY = Math.cos(this.t * 0.6 + i * 1.3) * 0.05;

      drawTiltCard(ctx, cx, cy, cardW, cardH, {
        accent: g.accent, pressed: isPressed, tiltX, tiltY, t: this.t, cut: 10,
      }, (cctx, bx, by, bw, bh) => {
        // 图标盒
        const iconBox = 40;
        cctx.save();
        cctx.fillStyle = withAlpha(g.accent, 0.16);
        cctx.fillRect(bx + 12, by + 14, iconBox, iconBox);
        cctx.strokeStyle = withAlpha(g.accent, 0.5); cctx.lineWidth = 1;
        cctx.strokeRect(bx + 12, by + 14, iconBox, iconBox);
        cctx.restore();
        drawIcon(cctx, g.icon as IconName, bx + 12 + 9, by + 14 + 9, iconBox - 18, g.accent);

        // 标题 + 副标题
        const tx = bx + 12 + iconBox + 10;
        cctx.save();
        cctx.font = `700 15px ${Theme.fonts.display}`;
        cctx.fillStyle = g.accent; cctx.textAlign = "left"; cctx.textBaseline = "top";
        cctx.fillText(g.title, tx, by + 16);
        cctx.font = `400 9px ${Theme.fonts.mono}`;
        cctx.fillStyle = Theme.colors.ink.muted;
        cctx.fillText(g.tagline, tx, by + 38);
        cctx.restore();

        // 难度星级（左）+ 最佳成绩（右）
        drawStars(cctx, tx + 30, by + 58, g.difficulty, 5, 11, g.accent, this.t + i);
        cctx.save();
        cctx.font = `700 10px ${Theme.fonts.mono}`;
        cctx.fillStyle = Theme.colors.ink.muted; cctx.textAlign = "right"; cctx.textBaseline = "top";
        cctx.fillText(`最佳 ${best}`, bx + bw - 12, by + 52);
        cctx.restore();

        // 进入训练按钮（发光）
        const btnW = bw - 24, btnH = 30, btnX = bx + 12, btnY = by + bh - btnH - 12;
        drawGlowButton(cctx, btnX, btnY, btnW, btnH, "▶ 进入训练", {
          variant: "primary", accent: g.accent, pressed: isPressed,
          fontSize: 13, cut: 6, glow: 0.45 + 0.45 * Math.sin(this.t * 2 + i), t: this.t,
        });
      });
    }
  }

  /** 每日签到 + 今日任务 */
  private renderDailyRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const tileW = (w - 12) / 2;
    // 签到
    const can = platformStore.canCheckInToday();
    const checkAccent = Theme.colors.safe.DEFAULT;
    const isCheck = this.pressedButton === "checkin";
    drawPanel(ctx, x, y, tileW, h, { borderColor: withAlpha(checkAccent, 0.5), bgColor: withAlpha(checkAccent, 0.04), cut: 8 });
    if (isCheck) drawNeonCorners(ctx, x, y, tileW, h, checkAccent, undefined, undefined, 8 + Math.sin(this.t * 8) * 4);
    drawIcon(ctx, "gift", x + 14, y + 18, 30, checkAccent);
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = checkAccent; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(can ? "今日签到" : "已签到", x + 54, y + 16);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    const st = platformStore.state.dailyCheckIn;
    ctx.fillText(can ? "领取金币 + 养成资源" : `连签 ${st.streak} 天 · 第 ${platformStore.checkInDayInCycle()} 天`, x + 54, y + 40);
    ctx.restore();

    // 任务
    const questAccent = Theme.colors.warn.DEFAULT;
    const qx = x + tileW + 12;
    const isQuest = this.pressedButton === "quest";
    drawPanel(ctx, qx, y, tileW, h, { borderColor: withAlpha(questAccent, 0.5), bgColor: withAlpha(questAccent, 0.04), cut: 8 });
    if (isQuest) drawNeonCorners(ctx, qx, y, tileW, h, questAccent, undefined, undefined, 8 + Math.sin(this.t * 8) * 4);
    drawIcon(ctx, "target", qx + 14, y + 18, 30, questAccent);
    const quests = platformStore.state.dailyQuests.quests;
    const done = quests.filter((q) => q.claimed || q.progress >= q.target).length;
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = questAccent; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("今日任务", qx + 54, y + 16);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${done}/${quests.length} 已完成 · 点击查看`, qx + 54, y + 40);
    ctx.restore();
  }

  /** 更多入口 2×3 */
  private renderEntryGrid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const entries: { id: string; icon: IconName; accent: string; title: string }[] = [
      { id: "learn", icon: "book", accent: Theme.colors.flag.DEFAULT, title: "反诈学习中心" },
      { id: "story", icon: "story", accent: Theme.colors.flag.DEFAULT, title: "剧情模式" },
      { id: "daily", icon: "calendar", accent: Theme.colors.neon.DEFAULT, title: "每日活动" },
      { id: "arcade", icon: "shield", accent: Theme.colors.police.DEFAULT, title: "经典街机大厅" },
      { id: "codex", icon: "award", accent: Theme.colors.safe.DEFAULT, title: "反诈图鉴" },
      { id: "achv", icon: "trophy", accent: Theme.colors.warn.DEFAULT, title: "成就荣誉" },
    ];
    const tileW = (w - 12) / 2;
    const tileH = LAYOUT.entryH;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const col = i % 2, row = Math.floor(i / 2);
      const ex = x + col * (tileW + 12);
      const ey = y + row * (tileH + LAYOUT.entryGap);
      const isPressed = this.pressedButton === `entry-${e.id}`;
      drawPanel(ctx, ex, ey, tileW, tileH, { borderColor: withAlpha(e.accent, 0.45), bgColor: withAlpha(e.accent, 0.04), cut: 8 });
      if (isPressed) drawNeonCorners(ctx, ex, ey, tileW, tileH, e.accent, undefined, undefined, 8 + Math.sin(this.t * 8) * 4);
      drawIcon(ctx, e.icon, ex + 12, ey + tileH / 2 - 12, 24, e.accent);
      ctx.save();
      ctx.font = `700 13px ${Theme.fonts.display}`;
      ctx.fillStyle = e.accent; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(e.title, ex + 44, ey + tileH / 2);
      ctx.restore();
      drawIcon(ctx, "chevronRight", ex + tileW - 22, ey + tileH / 2 - 8, 16, Theme.colors.ink.dim);
    }
  }

  private renderResetModal(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawModalOverlay(ctx, screenW, screenH);
    const w = Math.min(320, screenW - 32), h = 180;
    const x = (screenW - w) / 2, y = (screenH - h) / 2;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(Theme.colors.warn.DEFAULT, 0.6) });
    drawIcon(ctx, "trash", x + 16, y + 16, 18, Theme.colors.warn.DEFAULT);
    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("重置所有进度？", x + 42, y + 18);
    ctx.restore();
    ctx.save();
    ctx.font = `400 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("将清除累计识破、段位、图鉴、养成等", x + 16, y + 56);
    ctx.fillText("所有数据，且不可恢复。", x + 16, y + 76);
    ctx.restore();
    const btnW = (w - 32 - 8) / 2, btnH = 36, btnY = y + h - btnH - 16;
    const cancelRect: Rect = { x: x + 16, y: btnY, w: btnW, h: btnH };
    const confirmRect: Rect = { x: x + 16 + btnW + 8, y: btnY, w: btnW, h: btnH };
    drawButton(ctx, cancelRect.x, cancelRect.y, cancelRect.w, cancelRect.h, "取消", { variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "cancel-reset" });
    drawButton(ctx, confirmRect.x, confirmRect.y, confirmRect.w, confirmRect.h, "确认重置", { variant: "danger", pressed: this.pressedButton === "confirm-reset" });
  }

  // ===================== 触摸 =====================
  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    if (this.confirmReset) return this.handleResetTouch(type, x, y, screenW, screenH);

    const gx = this.getGutterX(screenW);
    const colX1 = gx + this.getDesignW(screenW);
    const soundBtn = this.getSoundButtonRect(colX1);
    const resetBtn = this.getResetButtonRect(colX1);
    const shareBtn = this.getShareButtonRect(colX1);

    if (type === "start") {
      if (hitTest(x, y, soundBtn)) { this.pressedButton = "sound"; return true; }
      if (hitTest(x, y, resetBtn)) { this.pressedButton = "reset"; return true; }
      if (hitTest(x, y, shareBtn) && this.shareState !== "busy") { this.pressedButton = "share"; return true; }

      // 训练场
      const trainRects = this.getTrainingRects(screenW);
      for (let i = 0; i < trainRects.length; i++) {
        if (hitTest(x, y, trainRects[i])) { this.pressedButton = `train-${i}`; return true; }
      }
      // 每日
      const dailyRects = this.getDailyRects(screenW);
      if (hitTest(x, y, dailyRects[0])) { this.pressedButton = "checkin"; return true; }
      if (hitTest(x, y, dailyRects[1])) { this.pressedButton = "quest"; return true; }
      // 入口
      const entryRects = this.getEntryRects(screenW);
      for (let i = 0; i < entryRects.length; i++) {
        if (hitTest(x, y, entryRects[i])) { this.pressedButton = `entry-${ENTRY_IDS[i]}`; return true; }
      }
      // 否则滚动
      this.dragStartY = y; this.dragStartScroll = this.scrollY; this.isDragging = true;
      return false;
    } else if (type === "move") {
      if (this.isDragging) {
        const dy = y - this.dragStartY;
        this.scrollY = Math.max(0, Math.min(this.contentH - screenH, this.dragStartScroll - dy));
      }
      return false;
    } else if (type === "end") {
      if (this.pressedButton === "sound") {
        platformStore.toggleSound(); setMuted(!platformStore.state.settings.sound); playSfx("click");
        this.pressedButton = null; return true;
      }
      if (this.pressedButton === "reset") {
        this.confirmReset = true; playSfx("click"); this.pressedButton = null; return true;
      }
      if (this.pressedButton === "share") {
        if (hitTest(x, y, shareBtn)) { playSfx("click"); this.handleProgressShare(); }
        this.pressedButton = null; return true;
      }
      if (this.pressedButton && this.pressedButton.startsWith("train-")) {
        const idx = parseInt(this.pressedButton.slice(6));
        if (hitTest(x, y, this.getTrainingRects(screenW)[idx])) {
          playSfx("click"); this.launchGame(GAMES[idx].id);
        }
        this.pressedButton = null; return true;
      }
      if (this.pressedButton === "checkin") {
        if (hitTest(x, y, this.getDailyRects(screenW)[0])) this.handleCheckIn();
        this.pressedButton = null; return true;
      }
      if (this.pressedButton === "quest") {
        if (hitTest(x, y, this.getDailyRects(screenW)[1])) { playSfx("click"); this.director.push(new DailyScene(this.director), undefined, "slide"); }
        this.pressedButton = null; return true;
      }
      if (this.pressedButton && this.pressedButton.startsWith("entry-")) {
        const id = this.pressedButton.slice(6);
        const idx = ENTRY_IDS.indexOf(id);
        if (idx >= 0 && hitTest(x, y, this.getEntryRects(screenW)[idx])) this.launchEntry(id);
        this.pressedButton = null; return true;
      }
      this.pressedButton = null; this.isDragging = false; return false;
    }
    return false;
  }

  private handleResetTouch(type: "start" | "move" | "end", x: number, y: number, screenW: number, screenH: number): boolean {
    const w = Math.min(320, screenW - 32), h = 180;
    const mx = (screenW - w) / 2, my = (screenH - h) / 2;
    const btnW = (w - 32 - 8) / 2, btnH = 36, btnY = my + h - btnH - 16;
    const cancelRect: Rect = { x: mx + 16, y: btnY, w: btnW, h: btnH };
    const confirmRect: Rect = { x: mx + 16 + btnW + 8, y: btnY, w: btnW, h: btnH };
    if (type === "start") {
      if (hitTest(x, y, cancelRect)) { this.pressedButton = "cancel-reset"; return true; }
      if (hitTest(x, y, confirmRect)) { this.pressedButton = "confirm-reset"; return true; }
      return true;
    } else if (type === "end") {
      if (this.pressedButton === "cancel-reset" && hitTest(x, y, cancelRect)) { this.confirmReset = false; playSfx("click"); }
      else if (this.pressedButton === "confirm-reset" && hitTest(x, y, confirmRect)) {
        platformStore.resetProgress(); this.confirmReset = false; playSfx("bad");
      }
      this.pressedButton = null; return true;
    }
    return true;
  }

  private launchGame(gameId: string): void {
    if (gameId === "bomb-island") this.director.push(new BombIslandModeScene(this.director), undefined, "slide");
    else this.director.push(new BriefingScene(this.director), { gameId }, "slide");
    postFX.flash(Theme.colors.neon.DEFAULT, 0.25);
  }

  private launchEntry(id: string): void {
    playSfx("click");
    switch (id) {
      case "learn": this.director.push(new LearningScene(this.director), undefined, "slide"); break;
      case "story": this.director.push(new StoryScene(this.director), undefined, "slide"); break;
      case "daily": this.director.push(new DailyScene(this.director), undefined, "slide"); break;
      case "arcade": this.director.push(new HubScene(this.director), undefined, "slide"); break;
      case "codex": this.director.push(new FBCodexScene(this.director), undefined, "slide"); break;
      case "achv": this.director.push(new AchievementsScene(this.director), undefined, "slide"); break;
    }
  }

  private handleCheckIn(): void {
    if (!platformStore.canCheckInToday()) { this.showToast("今日已签到"); return; }
    const r = platformStore.doDailyCheckIn();
    if (r) {
      playSfx("click");
      this.showToast(`签到 +${r.coins}金币 · 连签${platformStore.state.dailyCheckIn.streak}天`);
      postFX.flash(Theme.colors.safe.DEFAULT, 0.25);
    }
  }

  private showToast(msg: string): void {
    this.toastMsg = msg;
    this.toastUntil = this.t + 2.2;
  }

  private handleProgressShare(): void {
    if (this.shareState === "busy") return;
    this.shareState = "busy";
    Promise.resolve().then(async () => {
      try {
        const canvas = renderProgressReportCanvas();
        const blob = await canvasToBlob(canvas, "image/png");
        if (!blob) throw new Error("canvasToBlob 返回空");
        const rp = rankProgress(platformStore.state.totalFoolsBusted);
        const text = `我是「${rp.rank}」，累计识破 ${platformStore.state.totalFoolsBusted} 次诈骗！全民反诈，天下无诈！`;
        const result = await shareImageWithFallback({
          title: "反诈成长档案", text, blob, filename: `anti-fraud-profile-${Date.now()}.png`,
        });
        this.shareMessage = result === "shared" ? "已分享" : result === "downloaded" ? "已保存" : "已复制";
        postFX.flash(Theme.colors.neon.DEFAULT, 0.3);
      } catch (e) {
        console.warn("[share] 进度卡生成失败", e);
        this.shareMessage = "分享失败";
      }
      this.shareState = "done";
      this.shareStateUntil = this.t + 2.5;
    });
  }

  // ===================== 命中矩形 =====================
  private getTrainingRects(screenW: number): Rect[] {
    const x0 = this.getGutterX(screenW) + 16;
    const w = this.getDesignW(screenW) - 32;
    const cardW = (w - 12) / 2, cardH = LAYOUT.trainingH;
    const rects: Rect[] = [];
    for (let i = 0; i < GAMES.length; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      rects.push({
        x: x0 + col * (cardW + 12),
        y: LAYOUT.trainingY + row * (cardH + 12) - this.scrollY,
        w: cardW, h: cardH,
      });
    }
    return rects;
  }

  private getDailyRects(screenW: number): Rect[] {
    const x0 = this.getGutterX(screenW) + 16;
    const w = this.getDesignW(screenW) - 32;
    const tileW = (w - 12) / 2;
    return [
      { x: x0, y: LAYOUT.dailyY - this.scrollY, w: tileW, h: LAYOUT.dailyH },
      { x: x0 + tileW + 12, y: LAYOUT.dailyY - this.scrollY, w: tileW, h: LAYOUT.dailyH },
    ];
  }

  private getEntryRects(screenW: number): Rect[] {
    const x0 = this.getGutterX(screenW) + 16;
    const w = this.getDesignW(screenW) - 32;
    const tileW = (w - 12) / 2, tileH = LAYOUT.entryH, gap = LAYOUT.entryGap;
    const rects: Rect[] = [];
    for (let i = 0; i < ENTRY_IDS.length; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      rects.push({
        x: x0 + col * (tileW + 12),
        y: LAYOUT.entryY + row * (tileH + gap) - this.scrollY,
        w: tileW, h: tileH,
      });
    }
    return rects;
  }

  private getSoundButtonRect(right: number): Rect { return { x: right - 96, y: 12, w: 36, h: 32 }; }
  private getResetButtonRect(right: number): Rect { return { x: right - 52, y: 12, w: 36, h: 32 }; }
  private getShareButtonRect(right: number): Rect { return { x: right - 140, y: 12, w: 36, h: 32 }; }
}

const ENTRY_IDS = ["learn", "story", "daily", "arcade", "codex", "achv"];
