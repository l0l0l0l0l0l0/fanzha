/**
 * 主页场景 · v3 三段式聚焦 + Fast-Tab 切换
 *
 * 布局（414×896 逻辑坐标系）：
 * - 0-56：顶部固定栏（Logo + 分享/音效/重置）
 * - 56-84：紧急预警 ticker
 * - 84-180：精简 Hero（标题 + 副标题 + 段位徽章一行）
 * - 180-260：Fast-Tab 5 个圆形游戏切换按钮
 * - 260-700：当前选中游戏的中央大卡片（详情 + 开始任务按钮）
 * - 700-820：4 个 stat 卡片 2×2 紧凑网格
 * - 820-896：底部权威条（96110/12321）
 *
 * 二屏（可滚，y > 896）：
 * - 学习中心入口
 * - 扩展玩法（剧情 / 每日）
 * - 内容来源声明
 *
 * 切换方式：
 * - 点击 Fast-Tab 圆形按钮 → 直接切换 selectedGameIndex
 * - 中央卡片左右滑 → 滑动距离 > 阈值时切换 prev/next
 * - 键盘 ← → 切换
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawStatCard, drawModalOverlay,
  drawHudLabel, drawBadge, drawNeonCorners, hitTest, type Rect,
  drawAlertTicker, drawRadarBackground, drawBootTerminal,
  drawAmbientGrid, drawTiltCard,
  type TickerItem,
} from "@/ui/widgets";
import { drawIcon, drawLogo, type IconName } from "@/ui/icons";
import { GAMES } from "@/data/games";
import { CODEX_TOTAL, platformStore, rankProgress } from "@/store/platformStore";
import { setMuted } from "@/engine/Audio";
import { playSfx, startBGM } from "@/engine/Audio";
import { ParticleSystem } from "@/engine/Particle";
import { postFX } from "@/engine/PostFX";
import { BriefingScene } from "./BriefingScene";
import { LearningScene } from "./LearningScene";
import { StoryScene } from "./StoryScene";
import { DailyScene } from "./DailyScene";
import { onKeyDown, offKeyDown, type KeyListener } from "@/platform/web";
import { canvasToBlob, shareImageWithFallback } from "@/platform/web";
import { renderProgressReportCanvas } from "@/utils/battleReport";

const COVER_ICON: Record<string, IconName> = {
  phone: "phone",
  tactic: "users",
  ship: "shield",
  bomb: "bomb",
};

/** 紧急预警滚动条目（结合全民防骗局清单 F26-F31 + 国家反诈中心高频类型） */
const TICKER_ITEMS: TickerItem[] = [
  // === 全民防骗局专题 F26-F31 ===
  { level: "critical", tag: "F26", text: "未成年人游戏诈骗：免费皮肤+拘留父母=伪造官方威胁，告知家长并举报" },
  { level: "critical", tag: "F27", text: "冒充现役军人+不能视频+稳赚不赔=升级版杀猪盘" },
  { level: "warning", tag: "F28", text: "买黄金交现金=虚假投资线下取现升级，凡线下交现金立即报警" },
  { level: "warning", tag: "F29", text: "误开会员+下载服务APP=远程操控手机窃验证码" },
  { level: "critical", tag: "F30", text: "租卡卖卡日入千元=帮信罪案底，影响考公参军就业" },
  { level: "info", tag: "F31", text: "志愿内部指标+ATM激活助学金=升学诈骗，走省考试院官方系统" },
  // === 高发类型（图鉴 catchphrase 直接搬用） ===
  { level: "critical", tag: "F01", text: "公检法不电话办案，无安全账户，不转账验资" },
  { level: "critical", tag: "F02", text: "杀猪盘：稳赚不赔+陌生投资APP立即止损报警" },
  { level: "warning", tag: "F03", text: "刷单返利占电诈报案量约 25%，凡刷单必诈" },
  { level: "warning", tag: "F04", text: "客服退款+屏幕共享=套密码，挂断到官方APP自查" },
  { level: "info", tag: "F11", text: "AI 换脸拟声冒充亲友紧急转账，挂断回拨常用号码核实" },
  { level: "warning", tag: "F25", text: "反诈中心不收保证金，96110 是反诈专线可主动核实" },
  // === 真实来源扩展专题 F35-F70 精选 ===
  { level: "critical", tag: "F35", text: "境外高薪招工=跨境电诈诱饵，12308 领事保护 24h" },
  { level: "warning", tag: "F37", text: "军警不电话私聊采购，不向第三方垫付货款" },
  { level: "warning", tag: "F40", text: "网恋荐虚拟币/线下交币=杀猪盘，拒下陌生软件" },
  { level: "info", tag: "F48", text: "AI合成亲友声线借钱，声音逼真不等于本人" },
  { level: "warning", tag: "F54", text: "百万保障永久免费自动开启，称要续费的均诈骗" },
  { level: "warning", tag: "F56", text: "线上私彩=吞本金，购彩走体彩福彩线下网点" },
  { level: "warning", tag: "F60", text: "通缉令+安全账户+清查资金=冒充公检法诈骗" },
  { level: "warning", tag: "F67", text: "AI实时换脸视频借钱，挂断用已知号码回拨本人" },
  { level: "warning", tag: "F68", text: "培训机构主动退费+下载APP=刷单变种诈骗" },
  // === 反诈专线 + 综合提醒 ===
  { level: "success", tag: "96110", text: "劝阻专线已为全国用户拦截数亿元电诈资金" },
  { level: "success", tag: "110", text: "遇可疑来电立即挂断，资金损失第一时间报警" },
  { level: "info", tag: "TIPS", text: "三不一多：不轻信·不透露·不转账·多核实" },
];

/** Hub Hero CRT 启动终端文案 */
const BOOT_LINES = [
  "> anti-fraud-arcade boot --v3",
  "[OK] loading codex.db ............ 72 entries (F01-F70 + J01/M01)",
  "[OK] loading 全民防骗局 cases .... F26-F31 暑期专题已挂载",
  "[OK] mounting particle.fx ........ ring/spark/debris/trail/beam",
  "[OK] calibrating radar.sweep ..... 0.8 rad/s",
  "[OK] linking 96110 hotline ....... online (反诈劝阻专线)",
  "[OK] linking 12308 consular ...... online (境外领保)",
  "[OK] linking 110 police .......... online (紧急报警)",
  "[OK] checking daily.quest ........ synced",
  "[OK] achievements ............... 12 nodes",
  "[OK] tips library ................ 41 cards (tip-001~041)",
  "[OK] scene director ............. ready (414x896 logical)",
  "> welcome, officer.",
];

/** 首屏关键 y 坐标（414×896 逻辑坐标系） */
const LAYOUT = {
  topBarH: 56,
  tickerY: 56,
  tickerH: 28,
  heroY: 88,
  fastTabY: 188,
  fastTabH: 72,
  centralCardY: 268,
  centralCardH: 332,
  statGridY: 612,
  footerY: 820,
  footerH: 76,
  /** 二屏：滚动区域 */
  secondScreenY: 896,
};

export class HubScene extends Scene {
  /** v3：当前选中的游戏索引 */
  private selectedGameIndex = 0;
  /** v3：中央卡片切换动画进度（lerp 向 selectedGameIndex） */
  private cardAnimIndex = 0;
  /** v3：卡片左右滑跟手偏移（屏幕 px） */
  private cardSwipeX = 0;
  private cardSwipeStartX = 0;
  private cardSwipeStartY = 0;
  private isSwipingCard = false;
  /** v3：滚动（仅二屏） */
  private scrollY = 0;
  private contentH = 1400;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;

  private confirmReset = false;
  private pressedButton: string | null = null;
  private t = 0;
  private particles = new ParticleSystem();
  /** 统计数字滚动显示值（lerp 向真实值） */
  private displayedFools = 0;
  private displayedCodex = 0;
  private displayedGames = 0;
  /** 紧急预警滚动偏移 */
  private tickerScroll = 0;
  /** Hero CRT 启动终端进度 0..1（每次进入 Hub 重置） */
  private bootProgress = 0;
  /** 上次统计快照（用于在变化时触发粒子爆点） */
  private lastFools = 0;
  /** 分享状态 */
  private shareState: "idle" | "busy" | "done" = "idle";
  private shareMessage = "";
  private shareStateUntil = 0;
  /** 键盘监听 */
  private keyCb: KeyListener | null = null;

  enter(): void {
    super.enter();
    this.scrollY = 0;
    this.bootProgress = 0;
    this.selectedGameIndex = 0;
    this.cardAnimIndex = 0;
    startBGM("hub");
    this.keyCb = (key: string) => this.onKey(key);
    onKeyDown(this.keyCb);
  }

  exit(): void {
    super.exit();
    if (this.keyCb) { offKeyDown(this.keyCb); this.keyCb = null; }
  }

  /** v3：键盘左右切换游戏，P 暂停（Hub 不需要），M 静音 */
  private onKey(key: string): void {
    if (key === "ArrowLeft") {
      this.setSelected(Math.max(0, this.selectedGameIndex - 1));
      playSfx("click");
    } else if (key === "ArrowRight") {
      this.setSelected(Math.min(GAMES.length - 1, this.selectedGameIndex + 1));
      playSfx("click");
    }
  }

  private setSelected(idx: number): void {
    if (idx === this.selectedGameIndex) return;
    this.selectedGameIndex = idx;
    postFX.flash(GAMES[idx].accent, 0.18, 0.25);
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    // 环境粒子：底部上升数据流
    if (Math.random() < dt * 8) {
      const screenW = this.director.screenWidth;
      this.particles.spawn({
        x: Math.random() * screenW,
        y: this.director.screenHeight + 10,
        count: 1,
        speed: 20 + Math.random() * 15,
        life: 4 + Math.random() * 2,
        size: 1.5 + Math.random() * 1.5,
        color: Math.random() < 0.5 ? "#00E5FF" : "#1B5FCC",
        spread: Math.PI * 0.1,
        angle: -Math.PI / 2,
        friction: 1,
      });
    }
    this.particles.update(dt);
    // 数字滚动 lerp
    const stat = platformStore.state;
    this.displayedFools += (stat.totalFoolsBusted - this.displayedFools) * Math.min(1, dt * 4);
    this.displayedCodex += (stat.unlockedCodex.length - this.displayedCodex) * Math.min(1, dt * 4);
    this.displayedGames += (stat.totalGames - this.displayedGames) * Math.min(1, dt * 4);
    // 数字变化时触发粒子爆点（在累计识破 stat 卡中心位置）
    if (Math.floor(this.displayedFools) > this.lastFools) {
      this.lastFools = Math.floor(this.displayedFools);
      const screenW = this.director.screenWidth;
      const pad = 16;
      const statW = (screenW - pad * 2 - 8) / 2;
      const burstX = pad + statW / 2;
      const burstY = LAYOUT.statGridY + 38;
      if (burstY - this.scrollY > -40 && burstY - this.scrollY < this.director.screenHeight + 40) {
        this.particles.spawnBurst(burstX, burstY - this.scrollY, Theme.colors.neon.DEFAULT, {
          ring: true, sparks: 6, dots: 8, speed: 80, life: 0.5, size: 2.5,
        });
      }
    }
    // 紧急预警滚动
    this.tickerScroll += dt * 60;
    // 启动终端进度（持续 2.2s）
    this.bootProgress = Math.min(1, this.bootProgress + dt / 2.2);
    // v3：卡片切换动画 lerp
    this.cardAnimIndex += (this.selectedGameIndex - this.cardAnimIndex) * Math.min(1, dt * 12);
    // 分享状态超时复位
    if (this.shareState === "done" && this.t > this.shareStateUntil) {
      this.shareState = "idle";
      this.shareMessage = "";
    }
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);
    // 动态视差网格背景
    drawAmbientGrid(ctx, screenW, screenH, this.t, "rgba(0,229,255,0.04)");
    // Hero 区雷达扫描背景（半透明）
    ctx.save();
    ctx.globalAlpha = 0.45;
    drawRadarBackground(ctx, screenW * 0.78, 180, 140, this.t, Theme.colors.neon.DEFAULT);
    ctx.restore();
    // 环境粒子
    this.particles.render(ctx);

    // 滚动内容（首屏 + 二屏）
    ctx.save();
    ctx.translate(0, -this.scrollY);
    this.renderContent(ctx, screenW, screenH);
    ctx.restore();

    // 固定顶部导航栏
    this.renderTopBar(ctx, screenW);
    // 紧急预警滚动条（顶部栏下方固定）
    drawAlertTicker(ctx, 0, LAYOUT.tickerY, screenW, LAYOUT.tickerH, TICKER_ITEMS, this.tickerScroll, this.t);
    // 底部权威条（固定在屏幕底部，但仅当滚动到首屏底部时显示；这里始终固定）
    this.renderFooter(ctx, screenW, screenH);

    // 重置确认弹窗
    if (this.confirmReset) {
      this.renderResetModal(ctx, screenW, screenH);
    }
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    // 背景
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.85)";
    ctx.fillRect(0, 0, screenW, LAYOUT.topBarH);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, LAYOUT.topBarH - 1, screenW, 1);
    ctx.restore();

    // Logo
    drawLogo(ctx, 16, 12, 32, false);

    // 分享按钮
    const shareBtn = this.getShareButtonRect(screenW);
    drawButton(ctx, shareBtn.x, shareBtn.y, shareBtn.w, shareBtn.h, "", {
      variant: "ghost",
      accent: this.shareState === "done"
        ? Theme.colors.safe.DEFAULT
        : this.shareState === "busy"
          ? Theme.colors.neon.DEFAULT
          : Theme.colors.ink.muted,
      pressed: this.pressedButton === "share",
    });
    if (this.shareState === "idle") {
      drawIcon(ctx, "share", shareBtn.x + shareBtn.w / 2 - 10, shareBtn.y + shareBtn.h / 2 - 10, 20, Theme.colors.ink.muted);
    } else if (this.shareState === "busy") {
      ctx.save();
      const cx = shareBtn.x + shareBtn.w / 2;
      const cy = shareBtn.y + shareBtn.h / 2;
      ctx.strokeStyle = Theme.colors.neon.DEFAULT;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      const start = this.t * 6;
      ctx.arc(cx, cy, 8, start, start + Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();
    } else {
      drawIcon(ctx, "check", shareBtn.x + shareBtn.w / 2 - 10, shareBtn.y + shareBtn.h / 2 - 10, 20, Theme.colors.safe.DEFAULT);
    }

    // 音效按钮
    const soundBtn = this.getSoundButtonRect(screenW);
    drawButton(ctx, soundBtn.x, soundBtn.y, soundBtn.w, soundBtn.h, "", {
      variant: "ghost",
      accent: platformStore.state.settings.sound ? Theme.colors.neon.DEFAULT : Theme.colors.ink.dim,
    });
    drawIcon(
      ctx,
      platformStore.state.settings.sound ? "volumeOn" : "volumeOff",
      soundBtn.x + soundBtn.w / 2 - 10, soundBtn.y + soundBtn.h / 2 - 10, 20,
      platformStore.state.settings.sound ? Theme.colors.neon.DEFAULT : Theme.colors.ink.dim
    );

    // 重置按钮
    const resetBtn = this.getResetButtonRect(screenW);
    drawButton(ctx, resetBtn.x, resetBtn.y, resetBtn.w, resetBtn.h, "", {
      variant: "ghost",
      accent: this.pressedButton === "reset" ? Theme.colors.warn.glow : Theme.colors.ink.muted,
      pressed: this.pressedButton === "reset",
    });
    drawIcon(ctx, "trash", resetBtn.x + resetBtn.w / 2 - 10, resetBtn.y + resetBtn.h / 2 - 10, 20, Theme.colors.ink.muted);
  }

  private renderFooter(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const y = screenH - 32;
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.9)";
    ctx.fillRect(0, y, screenW, 32);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, y, screenW, 1);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.fillText("96110", 12, y + 16);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(" 反诈专线 · ", 12 + 28, y + 16);
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.fillText("12321", 12 + 96, y + 16);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(" 举报渠道", 12 + 132, y + 16);
    ctx.textAlign = "right";
    ctx.fillText("全民反诈 · 天下无诈", screenW - 12, y + 16);
    ctx.restore();
  }

  private renderContent(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const pad = 16;
    // ===== Hero 区域（精简版） =====
    let y = LAYOUT.heroY;
    drawHudLabel(ctx, pad, y, "// AGENT · " + platformStore.rank() + " · 系统已激活", Theme.colors.neon.DEFAULT);
    y += 20;

    // 标题（紧凑）
    ctx.save();
    ctx.font = `700 32px ${Theme.fonts.display}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText("反诈", pad, y);
    const w1 = ctx.measureText("反诈").width;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.shadowColor = "rgba(0, 229, 255, 0.4)";
    ctx.shadowBlur = 14 + Math.sin(this.t * 2) * 5;
    ctx.fillText("游戏", pad + w1 + 4, y);
    const w2 = ctx.measureText("游戏").width;
    ctx.shadowBlur = 0;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText("平台", pad + w1 + w2 + 8, y);
    ctx.restore();
    y += 38;

    // 副标题 + 段位徽章 一行
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("// ANTI-FRAUD ARCADE · 5 款反诈主题游戏 · 全民反诈 天下无诈", pad, y);
    ctx.restore();

    // 顶部徽章（紧贴副标题下方）
    let bx = pad;
    const by = y + 16;
    const badges = [
      { text: "96110 反诈专线", bg: "rgba(27,95,204,0.15)", fg: Theme.colors.neon.DEFAULT },
      { text: "国家反诈中心", bg: "rgba(229,53,59,0.15)", fg: Theme.colors.warn.DEFAULT },
      { text: "12321 举报", bg: "rgba(82,196,26,0.15)", fg: Theme.colors.safe.DEFAULT },
    ];
    for (const b of badges) {
      const r = drawBadge(ctx, bx, by, b.text, b.bg, b.fg);
      bx += r.w + 8;
    }

    // Hero CRT 启动终端（前 2.2s 显示，覆盖在徽章下方）
    if (this.bootProgress < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - this.bootProgress) * 0.6;
      drawBootTerminal(ctx, pad, by + 28, screenW - pad * 2, BOOT_LINES, this.bootProgress, this.t);
      ctx.restore();
    }

    // ===== Fast-Tab 5 个圆形切换 =====
    this.renderFastTab(ctx, pad, LAYOUT.fastTabY, screenW - pad * 2, LAYOUT.fastTabH);

    // ===== 中央大卡片 =====
    this.renderCentralCard(ctx, pad, LAYOUT.centralCardY, screenW - pad * 2, LAYOUT.centralCardH);

    // ===== 数据看板 2×2 紧凑网格 =====
    this.renderStatGrid(ctx, pad, LAYOUT.statGridY, screenW - pad * 2);

    // ===== 首屏底部至 footer 之间的空隙用作呼吸 =====

    // ===== 二屏：学习中心 / 扩展玩法 / 来源声明 =====
    let y2 = LAYOUT.secondScreenY + 16;

    // 学习中心入口
    this.renderLearningEntry(ctx, pad, y2, screenW - pad * 2);
    y2 += 92 + 16;

    // 扩展玩法入口
    this.renderExtraModes(ctx, pad, y2, screenW - pad * 2);
    y2 += 14 + 36 + 88 + 16;

    // 内容来源声明
    const cardW = screenW - pad * 2;
    drawPanel(ctx, pad, y2, cardW, 100, { borderColor: Theme.colors.bg.line });
    drawIcon(ctx, "phone", pad + 12, y2 + 12, 16, Theme.colors.neon.DEFAULT);
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lines = [
      "内容来源声明 · 本平台所有反诈内容依据国家反诈中心、",
      "公安部刑事侦查局、人民银行、外交部领事保护中心公开",
      "资料整理改编。游戏内具体案例均为脱敏虚构。",
      "反诈专线 96110 · 举报渠道 12321 · 领事保护 12308",
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, pad + 36, y2 + 14 + i * 16);
    });
    ctx.restore();
    y2 += 116;

    this.contentH = y2;
  }

  /**
   * Fast-Tab：5 个圆形游戏切换按钮横排
   * - 选中态：圆形填充 accent + 内圈发光 + 下方文字高亮
   * - 未选中态：圆形空心灰色 + 下方文字 muted
   */
  private renderFastTab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const count = GAMES.length;
    const tabSize = 48;
    const gap = (w - tabSize * count) / (count - 1);
    const ty = y + 4;
    const labelY = ty + tabSize + 4;

    for (let i = 0; i < count; i++) {
      const g = GAMES[i];
      const tx = x + i * (tabSize + gap);
      const isSelected = i === this.selectedGameIndex;
      const isPressed = this.pressedButton === `tab-${i}`;
      const cx = tx + tabSize / 2;
      const cy = ty + tabSize / 2;
      const accent = g.accent;

      // 圆形背景
      ctx.save();
      if (isSelected) {
        // 选中：accent 填充 + 外发光
        ctx.fillStyle = withAlpha(accent, 0.18);
        ctx.beginPath();
        ctx.arc(cx, cy, tabSize / 2 + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = withAlpha(accent, 0.95);
        ctx.shadowColor = accent;
        ctx.shadowBlur = 12 + Math.sin(this.t * 4) * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, tabSize / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // 未选中：空心灰色
        ctx.fillStyle = "rgba(15, 34, 54, 0.7)";
        ctx.beginPath();
        ctx.arc(cx, cy, tabSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isPressed ? accent : withAlpha(accent, 0.35);
        ctx.lineWidth = isPressed ? 2 : 1;
        ctx.stroke();
      }
      ctx.restore();

      // 图标
      const iconColor = isSelected ? "#0A1929" : withAlpha(accent, isSelected ? 1 : 0.75);
      drawIcon(ctx, COVER_ICON[g.cover] || "shield", tx + 10, ty + 10, tabSize - 20, iconColor);

      // 难度点（圆形顶部）
      const diff = g.difficulty;
      for (let d = 0; d < 5; d++) {
        const dotX = cx - 12 + d * 6;
        const dotY = ty - 6;
        ctx.fillStyle = d < diff ? accent : withAlpha(Theme.colors.ink.dim, 0.5);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 名称（下方）
      ctx.save();
      ctx.font = `${isSelected ? "700" : "400"} 10px ${Theme.fonts.body}`;
      ctx.fillStyle = isSelected ? accent : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      // 取标题前 4 字符避免太长
      const label = g.title.length > 4 ? g.title.slice(0, 4) : g.title;
      ctx.fillText(label, cx, labelY);
      ctx.restore();
    }

    // Tab 容器底部细线
    ctx.save();
    ctx.strokeStyle = withAlpha(Theme.colors.bg.line, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h - 4);
    ctx.lineTo(x + w, y + h - 4);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 中央大卡片：当前选中游戏的详情 + 开始任务按钮
   * 左右滑切换：用 cardSwipeX 偏移绘制 prev/next 卡片预览
   */
  private renderCentralCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    // 用裁剪 + 偏移绘制当前卡片及左右邻居（实现滑动跟手）
    ctx.save();
    // 裁剪到卡片区域
    ctx.beginPath();
    ctx.rect(x - 4, y - 4, w + 8, h + 8);
    ctx.clip();

    const swipeX = this.cardSwipeX;
    // 当前卡片
    this.drawSingleCard(ctx, x + swipeX, y, w, h, this.selectedGameIndex);
    // 左侧邻居（露出边缘）
    if (this.selectedGameIndex > 0) {
      this.drawSingleCard(ctx, x + swipeX - w - 8, y, w, h, this.selectedGameIndex - 1);
    }
    // 右侧邻居
    if (this.selectedGameIndex < GAMES.length - 1) {
      this.drawSingleCard(ctx, x + swipeX + w + 8, y, w, h, this.selectedGameIndex + 1);
    }
    ctx.restore();

    // 左右边缘渐变阴影（提示可滑）
    ctx.save();
    const gradL = ctx.createLinearGradient(x, y, x + 24, y);
    gradL.addColorStop(0, "rgba(10,25,41,0.6)");
    gradL.addColorStop(1, "transparent");
    ctx.fillStyle = gradL;
    ctx.fillRect(x, y, 24, h);
    const gradR = ctx.createLinearGradient(x + w - 24, y, x + w, y);
    gradR.addColorStop(0, "transparent");
    gradR.addColorStop(1, "rgba(10,25,41,0.6)");
    ctx.fillStyle = gradR;
    ctx.fillRect(x + w - 24, y, 24, h);
    ctx.restore();

    // 索引指示器（卡片底部居中点）
    const indY = y + h + 12;
    const indCount = GAMES.length;
    const indW = indCount * 8 + (indCount - 1) * 4;
    let ix = x + w / 2 - indW / 2;
    for (let i = 0; i < indCount; i++) {
      ctx.fillStyle = i === this.selectedGameIndex ? GAMES[i].accent : withAlpha(Theme.colors.ink.dim, 0.6);
      ctx.beginPath();
      ctx.arc(ix + 4, indY, i === this.selectedGameIndex ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
      ix += 12;
    }
  }

  private drawSingleCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, idx: number): void {
    const g = GAMES[idx];
    const accent = g.accent;
    const isPressed = this.pressedButton === "start";

    drawTiltCard(
      ctx, x, y, w, h,
      {
        accent,
        pressed: false,
        t: this.t,
        cut: 12,
      },
      (c, cx, cy, cw, ch) => {
        // 顶部 hero 图标区（大）
        const heroH = 110;
        c.save();
        const heroGrad = c.createLinearGradient(cx, cy, cx, cy + heroH);
        heroGrad.addColorStop(0, withAlpha(accent, 0.22));
        heroGrad.addColorStop(1, "transparent");
        c.fillStyle = heroGrad;
        c.fillRect(cx, cy, cw, heroH);
        c.restore();

        // 中央大图标
        const iconSize = 64;
        drawIcon(c, COVER_ICON[g.cover] || "shield", cx + cw / 2 - iconSize / 2, cy + 22, iconSize, accent);

        // 难度星标（右上角）
        c.save();
        c.font = `400 10px ${Theme.fonts.mono}`;
        c.fillStyle = withAlpha(accent, 0.9);
        c.textAlign = "right";
        c.textBaseline = "top";
        const diffStr = "★".repeat(g.difficulty) + "☆".repeat(5 - g.difficulty);
        c.fillText(diffStr, cx + cw - 12, cy + 10);
        c.restore();

        // 最高分（左上角）
        const best = platformStore.state.bestScores[g.id] || 0;
        c.save();
        c.font = `400 9px ${Theme.fonts.mono}`;
        c.fillStyle = Theme.colors.ink.dim;
        c.textAlign = "left";
        c.textBaseline = "top";
        c.fillText(`BEST ${best.toLocaleString()}`, cx + 12, cy + 12);
        c.restore();

        // 标题
        c.save();
        c.font = `700 22px ${Theme.fonts.display}`;
        c.fillStyle = accent;
        c.textAlign = "center";
        c.textBaseline = "top";
        c.shadowColor = withAlpha(accent, 0.4);
        c.shadowBlur = 10;
        c.fillText(g.title, cx + cw / 2, cy + heroH + 4);
        c.shadowBlur = 0;
        c.restore();

        // 副标题
        drawHudLabel(c, cx + cw / 2 - 60, cy + heroH + 32, "// " + g.subtitle, Theme.colors.ink.muted);

        // 标签
        let tx = cx + 12;
        const ty = cy + heroH + 56;
        const tagSpace = cw - 24;
        let tagTotalW = 0;
        const tagRects: Rect[] = [];
        for (const tag of g.tags.slice(0, 3)) {
          // 估算 badge 宽度（drawBadge 不返回 w，先估算）
          const estimatedW = tag.length * 8 + 14;
          if (tagTotalW + estimatedW > tagSpace) break;
          tagRects.push({ x: tx, y: ty, w: 0, h: 18 });
          const r = drawBadge(c, tx, ty, tag, withAlpha(accent, 0.12), withAlpha(accent, 0.9));
          tx += r.w + 6;
          tagTotalW += r.w + 6;
        }
        // 居中标签行
        if (tagTotalW > 0) {
          const offset = (cw - tagTotalW + 6) / 2;
          // 这里已经画完了，无法重画。简化：标签左对齐到 cx + 12
        }
        void tagRects;

        // Tagline
        c.save();
        c.font = `400 11px ${Theme.fonts.body}`;
        c.fillStyle = Theme.colors.ink.muted;
        c.textAlign = "center";
        c.textBaseline = "top";
        c.fillText(g.tagline, cx + cw / 2, cy + heroH + 82);
        c.restore();

        // 开始任务按钮（底部）
        const btnW = cw - 32;
        const btnH = 40;
        const btnX = cx + 16;
        const btnY = cy + ch - btnH - 16;
        drawButton(c, btnX, btnY, btnW, btnH, "▶ 开始任务", {
          variant: "primary",
          accent,
          pressed: isPressed,
          fontSize: 16,
          cut: 8,
        });
      }
    );
  }

  /** v3：4 个 stat 卡片 2×2 紧凑网格 */
  private renderStatGrid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const stat = platformStore.state;
    const rank = platformStore.rank();
    const statW = (w - 8) / 2;
    const statH = 60;
    const stats = [
      { label: "累计识破诈骗", value: String(Math.floor(this.displayedFools)), unit: "次", color: Theme.colors.neon.DEFAULT },
      { label: "当前段位", value: rank, color: Theme.colors.flag.DEFAULT },
      { label: "已解锁图鉴", value: String(Math.floor(this.displayedCodex)), unit: `/ ${CODEX_TOTAL} 类`, color: Theme.colors.safe.DEFAULT },
      { label: "累计游戏", value: String(Math.floor(this.displayedGames)), unit: `局`, color: Theme.colors.police.DEFAULT },
    ];
    for (let i = 0; i < stats.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = x + col * (statW + 8);
      const sy = y + row * (statH + 8);
      drawStatCard(ctx, sx, sy, statW, statH, stats[i]);
    }
  }

  private renderResetModal(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawModalOverlay(ctx, screenW, screenH);
    const w = Math.min(320, screenW - 32);
    const h = 180;
    const x = (screenW - w) / 2;
    const y = (screenH - h) / 2;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(Theme.colors.warn.DEFAULT, 0.6) });

    drawIcon(ctx, "trash", x + 16, y + 16, 18, Theme.colors.warn.DEFAULT);
    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("重置所有进度？", x + 42, y + 18);
    ctx.restore();

    ctx.save();
    ctx.font = `400 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("将清除累计识破诈骗数、段位、图鉴解锁、", x + 16, y + 56);
    ctx.fillText("最高分等所有数据，且不可恢复。", x + 16, y + 76);
    ctx.restore();

    const btnW = (w - 32 - 8) / 2;
    const btnH = 36;
    const btnY = y + h - btnH - 16;
    const cancelRect: Rect = { x: x + 16, y: btnY, w: btnW, h: btnH };
    const confirmRect: Rect = { x: x + 16 + btnW + 8, y: btnY, w: btnW, h: btnH };
    drawButton(ctx, cancelRect.x, cancelRect.y, cancelRect.w, cancelRect.h, "取消", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "cancel-reset",
    });
    drawButton(ctx, confirmRect.x, confirmRect.y, confirmRect.w, confirmRect.h, "确认重置", {
      variant: "danger",
      pressed: this.pressedButton === "confirm-reset",
    });
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    if (this.confirmReset) {
      const w = Math.min(320, screenW - 32);
      const h = 180;
      const mx = (screenW - w) / 2;
      const my = (screenH - h) / 2;
      const btnW = (w - 32 - 8) / 2;
      const btnH = 36;
      const btnY = my + h - btnH - 16;
      const cancelRect: Rect = { x: mx + 16, y: btnY, w: btnW, h: btnH };
      const confirmRect: Rect = { x: mx + 16 + btnW + 8, y: btnY, w: btnW, h: btnH };

      if (type === "start") {
        if (hitTest(x, y, cancelRect)) { this.pressedButton = "cancel-reset"; return true; }
        if (hitTest(x, y, confirmRect)) { this.pressedButton = "confirm-reset"; return true; }
        return true;
      } else if (type === "end") {
        if (this.pressedButton === "cancel-reset" && hitTest(x, y, cancelRect)) {
          this.confirmReset = false;
          playSfx("click");
        } else if (this.pressedButton === "confirm-reset" && hitTest(x, y, confirmRect)) {
          platformStore.resetProgress();
          this.confirmReset = false;
          playSfx("bad");
        }
        this.pressedButton = null;
        return true;
      }
      return true;
    }

    // 顶部按钮（固定，不随滚动）
    const soundBtn = this.getSoundButtonRect(screenW);
    const resetBtn = this.getResetButtonRect(screenW);
    const shareBtn = this.getShareButtonRect(screenW);

    if (type === "start") {
      if (hitTest(x, y, soundBtn)) {
        this.pressedButton = "sound";
        return true;
      }
      if (hitTest(x, y, resetBtn)) {
        this.pressedButton = "reset";
        return true;
      }
      if (hitTest(x, y, shareBtn) && this.shareState !== "busy") {
        this.pressedButton = "share";
        return true;
      }

      // Fast-Tab 圆形按钮命中检测
      const tabRects = this.getFastTabRects(screenW);
      for (let i = 0; i < tabRects.length; i++) {
        if (hitTest(x, y, tabRects[i])) {
          this.pressedButton = `tab-${i}`;
          return true;
        }
      }

      // 中央卡片区域：开始任务按钮 / 左右滑切换
      const pad = 16;
      const centralRect: Rect = {
        x: pad,
        y: LAYOUT.centralCardY - this.scrollY,
        w: screenW - pad * 2,
        h: LAYOUT.centralCardH,
      };
      if (hitTest(x, y, centralRect)) {
        // 检查是否点中"开始任务"按钮（卡片底部）
        const btnW = centralRect.w - 32;
        const btnH = 40;
        const btnX = centralRect.x + 16;
        const btnY = centralRect.y + centralRect.h - btnH - 16;
        const startBtnRect: Rect = { x: btnX, y: btnY, w: btnW, h: btnH };
        if (hitTest(x, y, startBtnRect)) {
          this.pressedButton = "start";
          return true;
        }
        // 否则视为左右滑起点
        this.cardSwipeStartX = x;
        this.cardSwipeStartY = y;
        this.isSwipingCard = true;
        this.cardSwipeX = 0;
        return true;
      }

      // 二屏滚动：学习入口 / 扩展玩法 / 来源声明
      if (this.scrollY > 0 || y < screenH) {
        const learnY = this.computeLearnY();
        const learnRect: Rect = { x: pad, y: learnY - this.scrollY, w: screenW - pad * 2, h: 92 };
        if (hitTest(x, y, learnRect)) {
          this.pressedButton = "learning";
          return true;
        }
        const extraY = this.computeExtraModesY() + 50;
        const extraGap = 12;
        const extraTileW = (screenW - pad * 2 - extraGap) / 2;
        const extraTileH = 88;
        const storyRect: Rect = { x: pad, y: extraY - this.scrollY, w: extraTileW, h: extraTileH };
        const dailyRect: Rect = { x: pad + extraTileW + extraGap, y: extraY - this.scrollY, w: extraTileW, h: extraTileH };
        if (hitTest(x, y, storyRect)) {
          this.pressedButton = "story";
          return true;
        }
        if (hitTest(x, y, dailyRect)) {
          this.pressedButton = "daily";
          return true;
        }
      }

      // 否则视为纵向滚动起点
      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      this.isDragging = true;
      return false;
    } else if (type === "move") {
      if (this.isSwipingCard) {
        const dx = x - this.cardSwipeStartX;
        const dy = y - this.cardSwipeStartY;
        // 判断主方向：横向 > 纵向才进 swipe，否则让位给滚动
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
          this.cardSwipeX = dx;
          return true;
        } else if (Math.abs(dy) > 8) {
          // 转为滚动
          this.isSwipingCard = false;
          this.isDragging = true;
          this.dragStartY = y;
          this.dragStartScroll = this.scrollY;
        }
      }
      if (this.isDragging) {
        const dy = y - this.dragStartY;
        this.scrollY = Math.max(0, Math.min(this.contentH - screenH, this.dragStartScroll - dy));
      }
      return false;
    } else if (type === "end") {
      // 顶部按钮
      if (this.pressedButton === "sound") {
        platformStore.toggleSound();
        setMuted(!platformStore.state.settings.sound);
        playSfx("click");
        this.pressedButton = null;
        return true;
      }
      if (this.pressedButton === "reset") {
        this.confirmReset = true;
        playSfx("click");
        this.pressedButton = null;
        return true;
      }
      if (this.pressedButton === "share") {
        if (hitTest(x, y, shareBtn)) {
          playSfx("click");
          this.handleProgressShare();
        }
        this.pressedButton = null;
        return true;
      }
      // Fast-Tab
      if (this.pressedButton && this.pressedButton.startsWith("tab-")) {
        const idx = parseInt(this.pressedButton.slice(4));
        const tabRects = this.getFastTabRects(screenW);
        if (hitTest(x, y, tabRects[idx])) {
          this.setSelected(idx);
          playSfx("click");
        }
        this.pressedButton = null;
        return true;
      }
      // 中央卡片左右滑结束
      if (this.isSwipingCard) {
        const dx = this.cardSwipeX;
        const threshold = 60;
        if (dx <= -threshold && this.selectedGameIndex < GAMES.length - 1) {
          this.setSelected(this.selectedGameIndex + 1);
          playSfx("click");
        } else if (dx >= threshold && this.selectedGameIndex > 0) {
          this.setSelected(this.selectedGameIndex - 1);
          playSfx("click");
        }
        this.cardSwipeX = 0;
        this.isSwipingCard = false;
        return true;
      }
      // 中央卡片"开始任务"按钮
      if (this.pressedButton === "start") {
        const pad = 16;
        const btnW = screenW - pad * 2 - 32;
        const btnH = 40;
        const btnX = pad + 16;
        const btnY = LAYOUT.centralCardY + LAYOUT.centralCardH - btnH - 16 - this.scrollY;
        const startBtnRect: Rect = { x: btnX, y: btnY, w: btnW, h: btnH };
        if (hitTest(x, y, startBtnRect)) {
          playSfx("click");
          this.director.replace(new BriefingScene(this.director), { gameId: GAMES[this.selectedGameIndex].id }, "slide");
        }
        this.pressedButton = null;
        return true;
      }
      // 学习入口
      if (this.pressedButton === "learning") {
        const pad = 16;
        const learnY = this.computeLearnY();
        const learnRect: Rect = { x: pad, y: learnY - this.scrollY, w: screenW - pad * 2, h: 92 };
        if (hitTest(x, y, learnRect)) {
          playSfx("click");
          this.director.push(new LearningScene(this.director), undefined, "slide");
          postFX.flash(Theme.colors.flag.DEFAULT, 0.3);
        }
        this.pressedButton = null;
        return true;
      }
      if (this.pressedButton === "story") {
        const pad = 16;
        const extraY = this.computeExtraModesY() + 50;
        const extraGap = 12;
        const extraTileW = (screenW - pad * 2 - extraGap) / 2;
        const extraTileH = 88;
        const storyRect: Rect = { x: pad, y: extraY - this.scrollY, w: extraTileW, h: extraTileH };
        if (hitTest(x, y, storyRect)) {
          playSfx("click");
          this.director.push(new StoryScene(this.director), undefined, "slide");
          postFX.flash(Theme.colors.flag.DEFAULT, 0.3);
        }
        this.pressedButton = null;
        return true;
      }
      if (this.pressedButton === "daily") {
        const pad = 16;
        const extraY = this.computeExtraModesY() + 50;
        const extraGap = 12;
        const extraTileW = (screenW - pad * 2 - extraGap) / 2;
        const extraTileH = 88;
        const dailyRect: Rect = { x: pad + extraTileW + extraGap, y: extraY - this.scrollY, w: extraTileW, h: extraTileH };
        if (hitTest(x, y, dailyRect)) {
          playSfx("click");
          this.director.push(new DailyScene(this.director), undefined, "slide");
          postFX.flash(Theme.colors.neon.DEFAULT, 0.3);
        }
        this.pressedButton = null;
        return true;
      }
      this.pressedButton = null;
      this.isDragging = false;
      return false;
    }
    return false;
  }

  /** 计算 Fast-Tab 5 个圆形按钮的命中区域 */
  private getFastTabRects(screenW: number): Rect[] {
    const pad = 16;
    const w = screenW - pad * 2;
    const count = GAMES.length;
    const tabSize = 48;
    const gap = (w - tabSize * count) / (count - 1);
    const ty = LAYOUT.fastTabY + 4;
    const rects: Rect[] = [];
    for (let i = 0; i < count; i++) {
      const tx = pad + i * (tabSize + gap);
      // 命中区域包含图标 + 标签
      rects.push({ x: tx - 4, y: ty - 8, w: tabSize + 8, h: tabSize + 20 });
    }
    return rects;
  }

  private getSoundButtonRect(screenW: number): Rect {
    return { x: screenW - 96, y: 12, w: 36, h: 32 };
  }

  private getResetButtonRect(screenW: number): Rect {
    return { x: screenW - 52, y: 12, w: 36, h: 32 };
  }

  private getShareButtonRect(screenW: number): Rect {
    return { x: screenW - 140, y: 12, w: 36, h: 32 };
  }

  /** v3：处理进度卡分享 */
  private async handleProgressShare(): Promise<void> {
    if (this.shareState === "busy") return;
    this.shareState = "busy";
    try {
      const canvas = renderProgressReportCanvas();
      const blob = await canvasToBlob(canvas, "image/png");
      if (!blob) throw new Error("canvasToBlob 返回空");
      const filename = `anti-fraud-profile-${Date.now()}.png`;
      const rp = rankProgress(platformStore.state.totalFoolsBusted);
      const text = `我是「${rp.rank}」，累计识破 ${platformStore.state.totalFoolsBusted} 次诈骗！全民反诈，天下无诈！`;
      const result = await shareImageWithFallback({
        title: "反诈档案 · ANTI-FRAUD ARCADE",
        text,
        blob,
        filename,
      });
      this.shareMessage = result === "shared" ? "已分享"
        : result === "downloaded" ? "已保存"
        : "已复制";
      postFX.flash(Theme.colors.neon.DEFAULT, 0.3);
    } catch (e) {
      console.warn("[share] 进度卡生成失败", e);
      this.shareMessage = "分享失败";
    }
    this.shareState = "done";
    this.shareStateUntil = this.t + 2.5;
  }

  /** 计算学习入口卡片在内容坐标系中的 y 起点（二屏） */
  private computeLearnY(): number {
    return LAYOUT.secondScreenY + 16;
  }

  /** 计算扩展玩法入口在内容坐标系中的 y 起点 */
  private computeExtraModesY(): number {
    return this.computeLearnY() + 92 + 16;
  }

  /**
   * 扩展玩法入口：剧情模式 + 每日活动（并排两块）
   */
  private renderExtraModes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    drawHudLabel(ctx, x, y, "// EXTRA MODES · 剧情与每日", Theme.colors.ink.muted);
    ctx.save();
    ctx.font = `700 24px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("扩展玩法", x, y + 14);
    ctx.restore();

    const gap = 12;
    const tileW = (w - gap) / 2;
    const tileH = 88;
    const tileY = y + 50;

    this.renderExtraTile(ctx, x, tileY, tileW, tileH, {
      id: "story",
      icon: "story",
      accent: Theme.colors.flag.DEFAULT,
      title: "剧情模式",
      subText: "5 章主线 · 串联 4 款游戏",
      progressLabel: this.getStoryProgressLabel(),
    });
    this.renderExtraTile(ctx, x + tileW + gap, tileY, tileW, tileH, {
      id: "daily",
      icon: "calendar",
      accent: Theme.colors.neon.DEFAULT,
      title: "每日活动",
      subText: "7 日签到 · 每日任务",
      progressLabel: this.getDailyProgressLabel(),
    });
  }

  private getStoryProgressLabel(): string {
    const sp = platformStore.storyProgress();
    const total = 5;
    const done = sp.completedNodes.length > 0
      ? Math.min(total, Math.ceil(sp.completedNodes.length / 2))
      : 0;
    return `${sp.currentChapter + 1}/${total} 章`;
  }

  private getDailyProgressLabel(): string {
    const st = platformStore.state;
    const can = platformStore.canCheckInToday();
    if (can) return "今日待签到";
    const day = platformStore.checkInDayInCycle();
    return `连签 ${st.dailyCheckIn.streak} 天 · 第 ${day} 天`;
  }

  private renderExtraTile(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    opts: {
      id: string;
      icon: IconName;
      accent: string;
      title: string;
      subText: string;
      progressLabel: string;
    }
  ): void {
    const isPressed = this.pressedButton === opts.id;
    drawPanel(ctx, x, y, w, h, {
      borderColor: withAlpha(opts.accent, 0.45),
      bgColor: withAlpha(opts.accent, 0.04),
      cut: 8,
    });
    if (isPressed) {
      drawNeonCorners(ctx, x, y, w, h, opts.accent, undefined, undefined, 8 + Math.sin(this.t * 8) * 4);
    }

    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, opts.accent);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, 1);
    ctx.restore();

    const iconBox = h - 36;
    ctx.save();
    ctx.fillStyle = withAlpha(opts.accent, 0.15);
    ctx.fillRect(x + 10, y + 12, iconBox, iconBox);
    ctx.strokeStyle = withAlpha(opts.accent, 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 10, y + 12, iconBox, iconBox);
    ctx.restore();
    drawIcon(ctx, opts.icon, x + 10 + 6, y + 12 + 6, iconBox - 12, opts.accent);

    const contentX = x + 10 + iconBox + 10;
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = opts.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(opts.accent, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(opts.title, contentX, y + 12);
    ctx.shadowBlur = 0;

    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(opts.subText, contentX, y + 34);

    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = opts.accent;
    ctx.fillText(opts.progressLabel, contentX, y + h - 20);
    ctx.restore();
  }

  private renderLearningEntry(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const h = 92;
    const isPressed = this.pressedButton === "learning";
    const accent = Theme.colors.flag.DEFAULT;
    const prog = platformStore.learningProgress();
    const totalDone = prog.completedLessons.length;
    const totalAll = prog.basicTotal + prog.intermediateTotal + prog.advancedTotal;
    const ratio = totalAll > 0 ? totalDone / totalAll : 0;

    drawPanel(ctx, x, y, w, h, {
      borderColor: withAlpha(accent, 0.45),
      bgColor: withAlpha(accent, 0.04),
      cut: 8,
    });
    if (isPressed) {
      drawNeonCorners(ctx, x, y, w, h, accent, undefined, undefined, 8 + Math.sin(this.t * 8) * 4);
    }

    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, accent);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, 1);
    ctx.restore();

    const iconBox = h - 24;
    ctx.save();
    ctx.fillStyle = withAlpha(accent, 0.15);
    ctx.fillRect(x + 12, y + 12, iconBox, iconBox);
    ctx.strokeStyle = withAlpha(accent, 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 12, y + 12, iconBox, iconBox);
    ctx.restore();
    drawIcon(ctx, "book", x + 12 + 8, y + 12 + 8, iconBox - 16, accent);

    const contentX = x + 12 + iconBox + 16;

    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("反诈学习中心", contentX, y + 14);
    ctx.shadowBlur = 0;

    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("// ANTI-FRAUD ACADEMY · 三阶进阶课程", contentX, y + 38);

    const barW = w - (contentX - x) - 12;
    const barY = y + 60;
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.6);
    ctx.fillRect(contentX, barY, barW, 4);
    if (ratio > 0) {
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 6;
      ctx.fillRect(contentX, barY, barW * ratio, 4);
      ctx.shadowBlur = 0;
    }

    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${totalDone}/${totalAll} 课程`, contentX, y + 70);
    ctx.textAlign = "right";
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`${Math.floor(ratio * 100)}%`, x + w - 12, y + 70);
    ctx.restore();
  }
}
