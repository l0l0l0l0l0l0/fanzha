/**
 * 反诈图鉴馆场景（BombCodexScene）
 *
 * 浏览三类反诈档案：
 * - Boss图鉴：全部 Boss 卡片（击败/未击败），点击展开真实原型与技能
 * - 案例档案：已击败 Boss 的 caseStudy（标题/正文/防骗要点）
 * - 受害者档案：9 种心理型受害者档案（按累计救援数解锁）
 *
 * 布局（414×896 逻辑坐标系，纵向）：
 * - 0-56：顶部栏（返回 + 标题"反诈图鉴馆" + 96110 徽章）
 * - 56-92：3 个 tab 切换（Boss图鉴 / 案例档案 / 受害者档案）
 * - 92-872：可滚动内容区
 * - 872-896：底部权威条 + 图鉴进度"已击败 X/Y"
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawHudLabel,
  hitTest, drawNeonCorners, drawProgressBar, type Rect,
} from "@/ui/widgets";
import { drawIcon, drawLogo } from "@/ui/icons";
import { playSfx, startBGM } from "@/engine/Audio";
import {
  getBossCodex, getBossCodexProgress,
} from "@/games/bombIsland/dataV3";
import { TIER_BOSSES } from "@/games/bombIsland/data";
import { VICTIM_PROFILES } from "@/games/bombIsland/dataV2";
import { loadCodexUnlocks, loadV6Save } from "@/games/bombIsland/storage";
import type {
  BombBossCodexEntry, BombBossDef,
} from "@/games/bombIsland/types";

const ACCENT = Theme.accents["bomb-island"];

type CodexTab = "boss" | "case" | "victim";

/** 布局常量 */
const LAYOUT = {
  topBarH: 56,
  tabBarY: 56,
  tabBarH: 36,
  contentY: 92,
  contentH: 780,
  footerY: 872,
};

/** Tab 定义 */
const TABS: { id: CodexTab; label: string; icon: string }[] = [
  { id: "boss",   label: "Boss图鉴",   icon: "👹" },
  { id: "case",   label: "案例档案",   icon: "📋" },
  { id: "victim", label: "受害者档案", icon: "🔓" },
];

/** 卡片尺寸（固定，便于命中检测） */
const CARD = {
  bossCollapsed: 84,
  bossExpanded: 184,
  caseH: 196,
  victimCollapsed: 92,
  victimExpanded: 220,
  pad: 16,
  gap: 8,
};

/** 根据 codexId 反查 BossDef（取 caseStudy） */
function getBossDefByCodexId(bossId: string): BombBossDef | null {
  const sep = bossId.lastIndexOf("-");
  if (sep < 0) return null;
  const structure = bossId.slice(0, sep) as keyof typeof TIER_BOSSES;
  const idx = parseInt(bossId.slice(sep + 1), 10);
  const list = TIER_BOSSES[structure];
  if (!list || isNaN(idx) || idx < 0 || idx >= list.length) return null;
  return list[idx];
}

export class BombCodexScene extends Scene {
  /** 当前 tab */
  private activeTab: CodexTab = "boss";
  /** 滚动偏移（>=0，向下滚动为正） */
  private scrollY = 0;
  /** 当前内容总高度（render 时计算，用于 clamp） */
  private contentMaxH = LAYOUT.contentH;
  /** 当前正在拖拽的触摸 ID */
  private scrollTouchId: number | null = null;
  private scrollStartY = 0;
  private scrollStartScroll = 0;
  /** 是否发生过明显移动（用于区分点击与拖动） */
  private touchMoved = false;
  /** 展开的 Boss 卡片 ID */
  private expandedBossId: string | null = null;
  /** 展开的受害者档案 typeId */
  private expandedVictimId: string | null = null;
  /** 按下的按钮 ID */
  private pressedButton: string | null = null;
  /** 入场动画计时 */
  private t = 0;

  enter(): void {
    super.enter();
    startBGM("hub");
    this.scrollY = 0;
    this.expandedBossId = null;
    this.expandedVictimId = null;
    this.pressedButton = null;
    this.scrollTouchId = null;
    this.touchMoved = false;
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    const enterAlpha = Math.min(1, this.enterT * 2.5);
    ctx.save();
    ctx.globalAlpha = enterAlpha;

    this.renderTopBar(ctx, screenW);
    this.renderTabs(ctx, screenW);
    this.renderContent(ctx, screenW);
    this.renderFooter(ctx, screenW, screenH);

    ctx.restore();
  }

  // ============ 顶部栏 ============

  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.88)";
    ctx.fillRect(0, 0, screenW, LAYOUT.topBarH);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, LAYOUT.topBarH - 1, screenW, 1);
    ctx.restore();

    // 返回按钮
    const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 12, backBtn.y + 8, 16, Theme.colors.ink.muted);
    drawHudLabel(ctx, backBtn.x + 32, backBtn.y + 11, "返回");

    // Logo
    drawLogo(ctx, screenW / 2 - 16, 12, 32, false);

    // 标题
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(ACCENT, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("反诈图鉴馆", screenW / 2, 44);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 96110 徽章
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.warn.DEFAULT, 0.6);
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("☎ 96110", screenW - 16, 14);
    ctx.font = `400 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.dim, 0.7);
    ctx.fillText("反诈专线", screenW - 16, 28);
    ctx.restore();
  }

  // ============ Tab 栏 ============

  private renderTabs(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 12;
    const gap = 6;
    const tabW = (screenW - pad * 2 - gap * 2) / 3;
    const y = LAYOUT.tabBarY + 4;
    const h = LAYOUT.tabBarH - 8;

    for (let i = 0; i < TABS.length; i++) {
      const tab = TABS[i];
      const x = pad + i * (tabW + gap);
      const active = this.activeTab === tab.id;
      ctx.save();
      if (active) {
        ctx.fillStyle = withAlpha(ACCENT, 0.18);
        ctx.fillRect(x, y, tabW, h);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 2;
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 8;
        ctx.strokeRect(x, y, tabW, h);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "rgba(18, 42, 66, 0.7)";
        ctx.fillRect(x, y, tabW, h);
        ctx.strokeStyle = withAlpha(ACCENT, 0.3);
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tabW, h);
      }
      ctx.restore();

      ctx.save();
      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = active ? ACCENT : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${tab.icon} ${tab.label}`, x + tabW / 2, y + h / 2);
      ctx.restore();
    }

    // tab 底部分隔线
    ctx.save();
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, LAYOUT.tabBarY + LAYOUT.tabBarH - 1, screenW, 1);
    ctx.restore();
  }

  // ============ 内容区 ============

  private renderContent(ctx: CanvasRenderingContext2D, screenW: number): void {
    // 裁剪到内容区
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, LAYOUT.contentY, screenW, LAYOUT.contentH);
    ctx.clip();
    ctx.translate(0, -this.scrollY);

    if (this.activeTab === "boss") {
      this.renderBossTab(ctx, screenW);
    } else if (this.activeTab === "case") {
      this.renderCaseTab(ctx, screenW);
    } else {
      this.renderVictimTab(ctx, screenW);
    }

    ctx.restore();
  }

  // ===== Boss 图鉴 =====

  private renderBossTab(ctx: CanvasRenderingContext2D, screenW: number): void {
    const defeatedIds = loadCodexUnlocks();
    const codex = getBossCodex(defeatedIds);
    const x = CARD.pad;
    const w = screenW - CARD.pad * 2;
    let y = LAYOUT.contentY + 8;
    for (const entry of codex) {
      const expanded = this.expandedBossId === entry.bossId && entry.defeated;
      const h = expanded ? CARD.bossExpanded : CARD.bossCollapsed;
      this.renderBossCard(ctx, x, y, w, h, entry, expanded);
      y += h + CARD.gap;
    }
    y += 24;
    this.contentMaxH = y - LAYOUT.contentY;
  }

  private renderBossCard(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    entry: BombBossCodexEntry, expanded: boolean,
  ): void {
    const unlocked = !!entry.defeated;
    const accent = unlocked ? ACCENT : Theme.colors.ink.dim;

    ctx.save();
    if (unlocked) {
      ctx.fillStyle = withAlpha(ACCENT, 0.08);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = withAlpha(ACCENT, expanded ? 0.9 : 0.45);
      ctx.lineWidth = expanded ? 2 : 1;
      if (expanded) {
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 10;
      }
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "rgba(10, 20, 35, 0.6)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = Theme.colors.ink.dim;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();

    // emoji 形象
    ctx.save();
    ctx.font = `34px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = unlocked ? ACCENT : Theme.colors.ink.dim;
    if (unlocked) {
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 8;
    }
    ctx.fillText(unlocked ? entry.emoji : "🔒", x + 32, y + 42);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 名称 + 身份
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = unlocked ? Theme.colors.ink.DEFAULT : Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(entry.bossName, x + 72, y + 12);
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, unlocked ? 0.75 : 0.45);
    ctx.fillText(`身份：${entry.identity}`, x + 72, y + 32);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(accent, 0.85);
    ctx.fillText(`诈骗类型：${entry.scamType}`, x + 72, y + 48);
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
    ctx.fillText(`园区：${entry.tierStructure}`, x + 72, y + 62);
    ctx.restore();

    // 右侧状态
    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    if (unlocked) {
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✓ 已击败", x + w - 12, y + 12);
    } else {
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText("🔒 未击败", x + w - 12, y + 12);
    }
    if (unlocked) {
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.7);
      ctx.fillText(expanded ? "▾ 收起" : "▸ 详情", x + w - 12, y + 28);
    }
    ctx.restore();

    // 展开详情
    if (expanded) {
      let yy = y + 84;
      ctx.save();
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = ACCENT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("🏷 专属技能", x + 12, yy);
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
      ctx.fillText(entry.skillName, x + 90, yy);
      yy += 18;
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.fillText("📖 真实原型", x + 12, yy);
      yy += 14;
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
      yy = this.drawWrappedText(ctx, entry.realPrototype, x + 12, yy, w - 24, 14);
      yy += 6;
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.flag.DEFAULT, 0.9);
      ctx.fillText(`🎁 ${entry.defeatReward}`, x + 12, yy);
      ctx.restore();
    }
  }

  // ===== 案例档案 =====

  private renderCaseTab(ctx: CanvasRenderingContext2D, screenW: number): void {
    const defeatedIds = loadCodexUnlocks();
    const codex = getBossCodex(defeatedIds);
    const x = CARD.pad;
    const w = screenW - CARD.pad * 2;
    let y = LAYOUT.contentY + 8;

    const hasAny = codex.some(e => e.defeated);
    if (!hasAny) {
      // 空状态提示
      ctx.save();
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("尚未击败任何 Boss", screenW / 2, LAYOUT.contentY + 80);
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.dim, 0.7);
      ctx.fillText("击败 Boss 后将解锁对应案例档案", screenW / 2, LAYOUT.contentY + 100);
      ctx.restore();
      this.contentMaxH = LAYOUT.contentH;
      return;
    }

    for (const entry of codex) {
      if (!entry.defeated) continue;
      const def = getBossDefByCodexId(entry.bossId);
      if (!def) continue;
      this.renderCaseCard(ctx, x, y, w, CARD.caseH, entry, def);
      y += CARD.caseH + CARD.gap;
    }
    y += 24;
    this.contentMaxH = y - LAYOUT.contentY;
  }

  private renderCaseCard(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    entry: BombBossCodexEntry, def: BombBossDef,
  ): void {
    const cs = def.caseStudy;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(ACCENT, 0.45), cut: 8 });
    drawNeonCorners(ctx, x, y, w, h, ACCENT, 10);

    // 标题行：emoji + title + hotline
    ctx.save();
    ctx.font = `22px ${Theme.fonts.body}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = ACCENT;
    ctx.fillText(entry.emoji, x + 12, y + 12);
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = ACCENT;
    ctx.shadowColor = withAlpha(ACCENT, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(cs.title, x + 42, y + 16);
    ctx.shadowBlur = 0;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.warn.glow, 0.85);
    ctx.textAlign = "right";
    ctx.fillText(`☎ ${cs.hotline}`, x + w - 12, y + 18);
    ctx.restore();

    // 正文
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.drawWrappedText(ctx, cs.body, x + 12, y + 46, w - 24, 15);
    ctx.restore();

    // 防骗要点
    let py = y + 110;
    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.safe.glow;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("🛡 防骗要点", x + 12, py);
    ctx.restore();
    py += 16;
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < cs.points.length; i++) {
      const p = cs.points[i];
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("•", x + 14, py + i * 16);
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
      this.drawWrappedText(ctx, p, x + 26, py + i * 16, w - 38, 14);
    }
    ctx.restore();
  }

  // ===== 受害者档案 =====

  private renderVictimTab(ctx: CanvasRenderingContext2D, screenW: number): void {
    const totalRescued = loadV6Save().totalVictimsRescued ?? 0;
    const x = CARD.pad;
    const w = screenW - CARD.pad * 2;
    let y = LAYOUT.contentY + 8;

    // 顶部说明
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`累计救援：${totalRescued} 人 · 解锁档案按救援数逐步开放`, x, y);
    ctx.restore();
    y += 20;

    for (const profile of VICTIM_PROFILES) {
      const unlocked = totalRescued >= profile.unlockAtRescued;
      const expanded = this.expandedVictimId === profile.typeId && unlocked;
      const h = expanded ? CARD.victimExpanded : CARD.victimCollapsed;
      this.renderVictimCard(ctx, x, y, w, h, profile, unlocked, expanded, totalRescued);
      y += h + CARD.gap;
    }
    y += 24;
    this.contentMaxH = y - LAYOUT.contentY;
  }

  private renderVictimCard(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    profile: { typeId: string; name: string; color: string; desc: string;
      weakness: string[]; vulnerableScenes: string[]; advice: string[];
      unlockAtRescued: number; },
    unlocked: boolean, expanded: boolean, totalRescued: number,
  ): void {
    const accent = unlocked ? profile.color : Theme.colors.ink.dim;
    ctx.save();
    if (unlocked) {
      ctx.fillStyle = withAlpha(profile.color, 0.08);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = withAlpha(profile.color, expanded ? 0.9 : 0.45);
      ctx.lineWidth = expanded ? 2 : 1;
      if (expanded) {
        ctx.shadowColor = profile.color;
        ctx.shadowBlur = 10;
      }
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "rgba(10, 20, 35, 0.6)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = Theme.colors.ink.dim;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();

    // 左侧色条
    ctx.save();
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 3, h);
    ctx.restore();

    // 名称
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = unlocked ? profile.color : Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(unlocked ? profile.name : "🔒 未知档案", x + 14, y + 10);
    ctx.restore();

    // 描述
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, unlocked ? 0.85 : 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (unlocked) {
      this.drawWrappedText(ctx, profile.desc, x + 14, y + 32, w - 28, 14);
    } else {
      ctx.fillText(`救援 ${profile.unlockAtRescued} 人后解锁此档案`, x + 14, y + 36);
    }
    ctx.restore();

    // 右侧状态
    ctx.save();
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    if (unlocked) {
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✓ 已解锁", x + w - 12, y + 12);
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.7);
      ctx.fillText(expanded ? "▾ 收起" : "▸ 详情", x + w - 12, y + 26);
    } else {
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText(`${totalRescued}/${profile.unlockAtRescued}`, x + w - 12, y + 12);
    }
    ctx.restore();

    // 展开详情
    if (expanded) {
      let yy = y + 64;
      ctx.save();
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.warn.glow;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("⚠ 易受骗场景", x + 14, yy);
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
      ctx.fillText(profile.vulnerableScenes.join("、"), x + 14, yy + 14);
      yy += 34;
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.neon.DEFAULT;
      ctx.fillText("🧠 心理弱点", x + 14, yy);
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
      ctx.fillText(profile.weakness.join(" / "), x + 14, yy + 14);
      yy += 34;
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.safe.glow;
      ctx.fillText("🛡 防护建议", x + 14, yy);
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
      for (let i = 0; i < profile.advice.length; i++) {
        ctx.fillStyle = Theme.colors.safe.DEFAULT;
        ctx.fillText("•", x + 14, yy + 14 + i * 14);
        ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
        ctx.fillText(profile.advice[i], x + 24, yy + 14 + i * 14);
      }
      ctx.restore();
    }
  }

  // ============ 底部权威条 ============

  private renderFooter(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const y = LAYOUT.footerY;
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.9)";
    ctx.fillRect(0, y, screenW, screenH - y);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, y, screenW, 1);
    ctx.restore();

    // 图鉴进度
    const defeatedIds = loadCodexUnlocks();
    const progress = getBossCodexProgress(defeatedIds);
    const pad = 16;
    const barX = pad;
    const barY = y + 6;
    const barW = screenW - pad * 2;
    const barH = 6;
    drawProgressBar(ctx, barX, barY, barW, barH, progress.total > 0 ? progress.unlocked / progress.total : 0, ACCENT);

    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("图鉴进度", barX, barY + 10);
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "right";
    ctx.fillText(`已击败 ${progress.unlocked}/${progress.total}`, barX + barW, barY + 10);
    ctx.restore();

    // 权威条
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.fillText("96110", 12, y + (screenH - y) - 6);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(" 反诈专线", 40, y + (screenH - y) - 6);
    ctx.textAlign = "right";
    ctx.fillText("全民反诈 · 天下无诈", screenW - 12, y + (screenH - y) - 6);
    ctx.restore();
  }

  // ============ 工具 ============

  /** 简单中文换行，返回下一行的 y 坐标 */
  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number, maxWidth: number, lineHeight: number,
  ): number {
    const chars = text.split("");
    let line = "";
    let yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = ch;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
    return yy + lineHeight;
  }

  // ============ 命中区域计算 ============

  private getTabRects(screenW: number): Rect[] {
    const pad = 12;
    const gap = 6;
    const tabW = (screenW - pad * 2 - gap * 2) / 3;
    const y = LAYOUT.tabBarY + 4;
    const h = LAYOUT.tabBarH - 8;
    const rects: Rect[] = [];
    for (let i = 0; i < TABS.length; i++) {
      rects.push({ x: pad + i * (tabW + gap), y, w: tabW, h });
    }
    return rects;
  }

  /** 计算 Boss tab 各卡片命中区域（逻辑坐标，未含 scrollY 偏移） */
  private getBossCardRects(screenW: number): { rect: Rect; bossId: string; defeated: boolean }[] {
    const defeatedIds = loadCodexUnlocks();
    const codex = getBossCodex(defeatedIds);
    const x = CARD.pad;
    const w = screenW - CARD.pad * 2;
    let y = LAYOUT.contentY + 8;
    const out: { rect: Rect; bossId: string; defeated: boolean }[] = [];
    for (const entry of codex) {
      const expanded = this.expandedBossId === entry.bossId && entry.defeated;
      const h = expanded ? CARD.bossExpanded : CARD.bossCollapsed;
      out.push({ rect: { x, y, w, h }, bossId: entry.bossId, defeated: !!entry.defeated });
      y += h + CARD.gap;
    }
    return out;
  }

  private getVictimCardRects(screenW: number): { rect: Rect; typeId: string; unlocked: boolean }[] {
    const totalRescued = loadV6Save().totalVictimsRescued ?? 0;
    const x = CARD.pad;
    const w = screenW - CARD.pad * 2;
    let y = LAYOUT.contentY + 8 + 20;
    const out: { rect: Rect; typeId: string; unlocked: boolean }[] = [];
    for (const profile of VICTIM_PROFILES) {
      const unlocked = totalRescued >= profile.unlockAtRescued;
      const expanded = this.expandedVictimId === profile.typeId && unlocked;
      const h = expanded ? CARD.victimExpanded : CARD.victimCollapsed;
      out.push({ rect: { x, y, w, h }, typeId: profile.typeId, unlocked });
      y += h + CARD.gap;
    }
    return out;
  }

  private clampScroll(): void {
    const max = Math.max(0, this.contentMaxH - LAYOUT.contentH);
    if (this.scrollY < 0) this.scrollY = 0;
    if (this.scrollY > max) this.scrollY = max;
  }

  // ============ 触摸处理 ============

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    if (type === "start") {
      // 返回按钮
      const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
      if (hitTest(x, y, backBtn)) {
        this.pressedButton = "back";
        return true;
      }
      // Tab 切换
      const tabRects = this.getTabRects(this.director.screenWidth);
      for (let i = 0; i < tabRects.length; i++) {
        if (hitTest(x, y, tabRects[i])) {
          this.pressedButton = `tab-${i}`;
          return true;
        }
      }
      // 内容区：开始滚动拖拽
      if (y >= LAYOUT.contentY && y < LAYOUT.footerY) {
        this.scrollTouchId = touchId;
        this.scrollStartY = y;
        this.scrollStartScroll = this.scrollY;
        this.touchMoved = false;
        return true;
      }
      return false;
    }

    if (type === "move") {
      if (this.scrollTouchId === touchId) {
        const delta = y - this.scrollStartY;
        if (Math.abs(delta) > 4) this.touchMoved = true;
        this.scrollY = this.scrollStartScroll - delta;
        this.clampScroll();
        return true;
      }
      return false;
    }

    if (type === "end") {
      // 返回按钮
      const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
      if (this.pressedButton === "back" && hitTest(x, y, backBtn)) {
        this.pressedButton = null;
        playSfx("click");
        this.director.pop();
        return true;
      }
      // Tab 切换
      if (this.pressedButton?.startsWith("tab-")) {
        const idx = parseInt(this.pressedButton.slice(4), 10);
        const tabRects = this.getTabRects(this.director.screenWidth);
        this.pressedButton = null;
        if (idx < TABS.length && hitTest(x, y, tabRects[idx])) {
          const newTab = TABS[idx].id;
          if (newTab !== this.activeTab) {
            this.activeTab = newTab;
            this.scrollY = 0;
            this.touchMoved = false;
            this.scrollTouchId = null;
            playSfx("click");
          }
          return true;
        }
      }
      this.pressedButton = null;

      // 内容区：滚动结束或点击展开
      if (this.scrollTouchId === touchId) {
        const wasMoved = this.touchMoved;
        this.scrollTouchId = null;
        if (!wasMoved) {
          // 视为点击：将屏幕 y 还原为内容逻辑 y
          const logicY = y + this.scrollY;
          if (this.activeTab === "boss") {
            const rects = this.getBossCardRects(this.director.screenWidth);
            for (const r of rects) {
              if (hitTest(x, logicY, r.rect) && r.defeated) {
                this.expandedBossId = this.expandedBossId === r.bossId ? null : r.bossId;
                playSfx("click");
                return true;
              }
            }
          } else if (this.activeTab === "victim") {
            const rects = this.getVictimCardRects(this.director.screenWidth);
            for (const r of rects) {
              if (hitTest(x, logicY, r.rect) && r.unlocked) {
                this.expandedVictimId = this.expandedVictimId === r.typeId ? null : r.typeId;
                playSfx("click");
                return true;
              }
            }
          }
        }
        return true;
      }
      return true;
    }

    return false;
  }
}
