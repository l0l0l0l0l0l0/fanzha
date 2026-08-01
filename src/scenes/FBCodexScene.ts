/**
 * 「是男人就反诈」图鉴浏览器场景（v3 教育功能）
 * 横屏 Canvas UI：浏览 FB_CODEX 中所有诈骗类型图鉴
 * - 顶部课程等级 Tab（全部/基础/进阶/高级）
 * - 网格卡片展示（已遭遇/未遭遇两种状态）
 * - 点击卡片展开详情面板（catchphrase + 防骗要点 + 应对话术 + 案例档案 + 心理手法标签）
 * - 显示解锁进度
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawButton, drawScanlineOverlay,
  drawNeonCorners, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { roundRect } from "@/engine/Renderer";
import { FB_CODEX } from "@/games/fraudBuster/dataV2";
import { PSYCHOLOGY_LABELS_V2, SEASON_LABELS, SEASON_ICONS } from "@/games/fraudBuster/dataV2";
import type { FBCodexEntry, FBPsychology, FBSeason } from "@/games/fraudBuster/types";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";

/** 课程等级 Tab */
type CourseFilter = "all" | "basic" | "intermediate" | "advanced";

const FILTER_TABS: { id: CourseFilter; label: string; emoji: string }[] = [
  { id: "all", label: "全部", emoji: "📚" },
  { id: "basic", label: "基础", emoji: "🟢" },
  { id: "intermediate", label: "进阶", emoji: "🟡" },
  { id: "advanced", label: "高级", emoji: "🔴" },
];

const COURSE_LEVEL_LABELS: Record<FBCodexEntry["courseLevel"], string> = {
  basic: "基础",
  intermediate: "进阶",
  advanced: "高级",
};
const COURSE_LEVEL_COLORS: Record<FBCodexEntry["courseLevel"], string> = {
  basic: "#1AD670",
  intermediate: "#FFD666",
  advanced: "#E5353B",
};

/** 网格列数（横屏布局） */
const GRID_COLS = 4;
/** 每个卡片高度 */
const CARD_H = 110;
const CARD_GAP = 10;

const FB_ACCENT = "#00E5FF";

export class FBCodexScene extends Scene {
  private filter: CourseFilter = "all";
  private selectedEntry: FBCodexEntry | null = null;
  private pressedButton: string | null = null;
  private pressedCardIdx: number | null = null;
  private scrollY = 0;
  private contentH = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;
  private t = 0;
  /** 缓存上一帧屏幕尺寸（触摸命中测试用） */
  private lastScreenW = 800;
  private lastScreenH = 480;

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.selectedEntry = null;
    this.scrollY = 0;
    this.filter = "all";
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
  }

  /** 当前过滤条件下显示的图鉴条目 */
  private getEntries(): FBCodexEntry[] {
    if (this.filter === "all") return FB_CODEX;
    return FB_CODEX.filter((e) => e.courseLevel === this.filter);
  }

  /** 已遭遇的诈骗类型 ID 集合（来自 platformStore.unlockedCodex） */
  private getEncounteredIds(): Set<string> {
    return new Set(platformStore.state.unlockedCodex);
  }

  // ====================================================================
  // 布局
  // ====================================================================

  private getBackBtnRect(): Rect {
    return { x: 8, y: 8, w: 56, h: 32 };
  }

  private getTabRect(idx: number, screenW: number): Rect {
    const tabW = 90;
    const gap = 6;
    const totalW = FILTER_TABS.length * tabW + (FILTER_TABS.length - 1) * gap;
    const startX = (screenW - totalW) / 2;
    return { x: startX + idx * (tabW + gap), y: 8, w: tabW, h: 32 };
  }

  private getGridStartY(): number {
    return 56;
  }

  private getGridAvailW(screenW: number): number {
    return screenW - 32;
  }

  private getCardRect(idx: number, screenW: number): Rect {
    const startY = this.getGridStartY();
    const availW = this.getGridAvailW(screenW);
    const totalGapW = (GRID_COLS - 1) * CARD_GAP;
    const cardW = Math.floor((availW - totalGapW) / GRID_COLS);
    const col = idx % GRID_COLS;
    const row = Math.floor(idx / GRID_COLS);
    const x = 16 + col * (cardW + CARD_GAP);
    const y = startY + 40 + row * (CARD_H + CARD_GAP); // 40 = 标题区高度
    return { x, y, w: cardW, h: CARD_H };
  }

  private getDetailRect(screenW: number, screenH: number): Rect {
    const w = Math.min(600, screenW - 64);
    const h = Math.min(420, screenH - 80);
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
  }

  // ====================================================================
  // 渲染
  // ====================================================================

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    this.lastScreenW = screenW;
    this.lastScreenH = screenH;
    drawBackground(ctx, screenW, screenH);

    // 顶部导航条
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.9)";
    ctx.fillRect(0, 0, screenW, 48);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, 47, screenW, 1);
    ctx.restore();

    // 返回按钮
    const backBtn = this.getBackBtnRect();
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 12, backBtn.y + 8, 16, Theme.colors.ink.muted);

    // 标题
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = FB_ACCENT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(FB_ACCENT, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("是男人就反诈 · 诈骗图鉴", screenW / 2, 24);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 课程等级 Tab
    for (let i = 0; i < FILTER_TABS.length; i++) {
      this.renderTab(ctx, i, screenW);
    }

    // 滚动内容：标题 + 进度 + 网格
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 56, screenW, screenH - 56);
    ctx.clip();
    ctx.translate(0, -this.scrollY);

    this.renderHeader(ctx, screenW);
    const entries = this.getEntries();
    const encountered = this.getEncounteredIds();
    for (let i = 0; i < entries.length; i++) {
      this.renderCard(ctx, i, entries[i], encountered.has(entries[i].typeId), screenW);
    }
    // 计算内容总高度
    const rows = Math.ceil(entries.length / GRID_COLS);
    this.contentH = this.getGridStartY() + 40 + rows * (CARD_H + CARD_GAP) + 32;
    ctx.restore();

    // 滚动条指示
    this.renderScrollbar(ctx, screenW, screenH);

    // 详情面板（最上层）
    if (this.selectedEntry) {
      this.renderDetail(ctx, screenW, screenH);
    }

    drawScanlineOverlay(ctx, screenW, screenH);
    drawNeonCorners(ctx, 0, 0, screenW, screenH, FB_ACCENT);
  }

  /** 渲染课程等级 Tab */
  private renderTab(ctx: CanvasRenderingContext2D, idx: number, screenW: number): void {
    const tab = FILTER_TABS[idx];
    const r = this.getTabRect(idx, screenW);
    const active = this.filter === tab.id;
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    if (active) {
      ctx.fillStyle = withAlpha(FB_ACCENT, 0.18);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = FB_ACCENT;
      ctx.shadowColor = FB_ACCENT;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "rgba(20,35,55,0.6)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(Theme.colors.ink.muted, 0.3);
      ctx.stroke();
    }
    ctx.font = `600 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = active ? FB_ACCENT : Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${tab.emoji} ${tab.label}`, r.x + r.w / 2, r.y + r.h / 2);
    ctx.restore();
  }

  /** 渲染标题区 + 进度 */
  private renderHeader(ctx: CanvasRenderingContext2D, screenW: number): void {
    const encountered = this.getEncounteredIds();
    const totalEncountered = FB_CODEX.filter((e) => encountered.has(e.typeId)).length;
    const y = this.getGridStartY() + 8;
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const filterLabel = FILTER_TABS.find((f) => f.id === this.filter)?.label ?? "全部";
    ctx.fillText(`// FRAUD TYPE CODEX · ${filterLabel} · ${this.getEntries().length} 条`, 16, y);

    ctx.textAlign = "right";
    ctx.fillStyle = FB_ACCENT;
    ctx.fillText(`已遭遇 ${totalEncountered} / ${FB_CODEX.length}`, screenW - 16, y);

    // 进度条
    const barY = y + 18;
    const barW = screenW - 32;
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.6);
    roundRect(ctx, 16, barY, barW, 6, 3);
    ctx.fill();
    const ratio = FB_CODEX.length > 0 ? totalEncountered / FB_CODEX.length : 0;
    if (ratio > 0) {
      ctx.fillStyle = FB_ACCENT;
      ctx.shadowColor = FB_ACCENT;
      ctx.shadowBlur = 8;
      roundRect(ctx, 16, barY, barW * ratio, 6, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /** 渲染单个图鉴卡片 */
  private renderCard(
    ctx: CanvasRenderingContext2D,
    idx: number,
    entry: FBCodexEntry,
    encountered: boolean,
    screenW: number,
  ): void {
    const r = this.getCardRect(idx, screenW);
    const pressed = this.pressedCardIdx === idx;
    const levelColor = COURSE_LEVEL_COLORS[entry.courseLevel];

    ctx.save();
    if (pressed) ctx.translate(0, 2);
    // 背景
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    if (encountered) {
      g.addColorStop(0, withAlpha(levelColor, 0.18));
      g.addColorStop(1, "rgba(10,25,41,0.85)");
    } else {
      g.addColorStop(0, "rgba(40,50,70,0.4)");
      g.addColorStop(1, "rgba(10,15,25,0.7)");
    }
    ctx.fillStyle = g;
    ctx.fill();
    // 边框
    const pulse = encountered ? 0.5 + Math.sin(this.t * 2 + idx * 0.5) * 0.3 : 0;
    ctx.lineWidth = encountered ? 1.5 : 1;
    ctx.strokeStyle = encountered ? levelColor : "rgba(122,143,176,0.35)";
    ctx.shadowColor = encountered ? levelColor : "transparent";
    ctx.shadowBlur = encountered ? 4 + pulse * 4 : 0;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 顶部色条
    ctx.fillStyle = encountered ? levelColor : "rgba(122,143,176,0.4)";
    ctx.fillRect(r.x, r.y, r.w, 3);

    // 图标（左上，大字）
    ctx.font = `30px ${Theme.fonts.display}`;
    ctx.fillStyle = encountered ? "#FFFFFF" : "rgba(122,143,176,0.5)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(encountered ? entry.icon : "🔒", r.x + 10, r.y + 10);

    // 类型名（右上）
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = encountered ? levelColor : "rgba(122,143,176,0.6)";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(encountered ? entry.name : "???", r.x + r.w - 8, r.y + 12);

    // typeId（左下，小字）
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
    ctx.textAlign = "left";
    ctx.fillText(entry.typeId, r.x + 10, r.y + 48);

    // catchphrase（中部，换行）
    if (encountered) {
      ctx.font = `500 11px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
      const lines = this.wrapText(ctx, entry.catchphrase, r.w - 16, 2);
      lines.forEach((line, i) => ctx.fillText(line, r.x + 8, r.y + 64 + i * 14));
    } else {
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = "rgba(122,143,176,0.5)";
      ctx.fillText("未遭遇此诈骗类型", r.x + 10, r.y + 70);
    }

    // 课程等级标签（右下）
    ctx.font = `600 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = encountered ? levelColor : "rgba(122,143,176,0.5)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(COURSE_LEVEL_LABELS[entry.courseLevel], r.x + r.w - 8, r.y + r.h - 6);
    ctx.restore();
  }

  /** 渲染滚动条 */
  private renderScrollbar(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const viewH = screenH - 56;
    if (this.contentH <= viewH) return;
    const trackH = viewH - 20;
    const thumbH = Math.max(30, (viewH / this.contentH) * trackH);
    const thumbY = 56 + 10 + (this.scrollY / (this.contentH - viewH)) * (trackH - thumbH);
    ctx.save();
    ctx.fillStyle = "rgba(122,143,176,0.15)";
    roundRect(ctx, screenW - 6, 56 + 10, 3, trackH, 1.5);
    ctx.fill();
    ctx.fillStyle = withAlpha(FB_ACCENT, 0.6);
    roundRect(ctx, screenW - 6, thumbY, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }

  /** 渲染详情面板 */
  private renderDetail(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.selectedEntry) return;
    const e = this.selectedEntry;
    const r = this.getDetailRect(screenW, screenH);
    const levelColor = COURSE_LEVEL_COLORS[e.courseLevel];

    // 遮罩
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    // 面板背景
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, "rgba(15,30,50,0.98)");
    g.addColorStop(1, "rgba(8,17,30,0.98)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = levelColor;
    ctx.shadowColor = levelColor;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 裁剪内容区
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.clip();

    let cy = r.y + 16;
    // 顶部色条
    ctx.fillStyle = levelColor;
    ctx.fillRect(r.x + 2, cy, r.w - 4, 3);
    cy += 12;

    // 图标 + 名称 + typeId
    ctx.font = `36px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(e.icon, r.x + 16, cy);
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = levelColor;
    ctx.fillText(e.name, r.x + 60, cy + 2);
    ctx.font = `500 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.textAlign = "right";
    ctx.fillText(`${e.typeId} · ${COURSE_LEVEL_LABELS[e.courseLevel]}`, r.x + r.w - 16, cy + 12);
    cy += 48;

    // slogan
    ctx.font = `600 13px ${Theme.fonts.display}`;
    ctx.fillStyle = withAlpha(levelColor, 0.95);
    ctx.textAlign = "left";
    ctx.fillText(`💡 ${e.slogan}`, r.x + 16, cy);
    cy += 22;

    // catchphrase（警示框）
    ctx.save();
    roundRect(ctx, r.x + 16, cy, r.w - 32, 28, 6);
    ctx.fillStyle = withAlpha("#E5353B", 0.12);
    ctx.fill();
    ctx.fillStyle = "#E5353B";
    ctx.fillRect(r.x + 16, cy, 3, 28);
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FF6B6B";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`⚠ ${e.catchphrase}`, r.x + 26, cy + 14);
    ctx.restore();
    cy += 38;

    // 防骗要点
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = FB_ACCENT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("🛡 防骗要点", r.x + 16, cy);
    cy += 18;
    ctx.font = `500 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    for (const p of e.points) {
      const lines = this.wrapText(ctx, `• ${p}`, r.w - 32, 2);
      for (const line of lines) {
        ctx.fillText(line, r.x + 16, cy);
        cy += 15;
      }
    }
    cy += 6;

    // 应对话术
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = "#1AD670";
    ctx.fillText("✓ 标准应对", r.x + 16, cy);
    cy += 18;
    ctx.font = `500 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    const respLines = this.wrapText(ctx, e.response, r.w - 32, 2);
    for (const line of respLines) {
      ctx.fillText(line, r.x + 16, cy);
      cy += 15;
    }
    cy += 6;

    // 心理手法标签
    if (e.psychology && e.psychology.length > 0) {
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#B388FF";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("🧠 心理手法", r.x + 16, cy);
      cy += 16;
      let tagX = r.x + 16;
      for (const p of e.psychology) {
        const label = PSYCHOLOGY_LABELS_V2[p as FBPsychology] ?? p;
        const tagW = ctx.measureText(label).width + 16;
        if (tagX + tagW > r.x + r.w - 16) {
          tagX = r.x + 16;
          cy += 22;
        }
        ctx.save();
        roundRect(ctx, tagX, cy, tagW, 18, 9);
        ctx.fillStyle = withAlpha("#B388FF", 0.15);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = withAlpha("#B388FF", 0.5);
        ctx.stroke();
        ctx.font = `600 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#B388FF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, tagX + tagW / 2, cy + 9);
        ctx.restore();
        tagX += tagW + 6;
      }
      cy += 28;
    }

    // 季节标签
    if (e.season && e.season.length > 0) {
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#52C41A";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("📅 季节标签", r.x + 16, cy);
      cy += 16;
      let tagX = r.x + 16;
      for (const s of e.season) {
        const label = `${SEASON_ICONS[s as FBSeason] ?? ""} ${SEASON_LABELS[s as FBSeason] ?? s}`;
        const tagW = ctx.measureText(label).width + 16;
        ctx.save();
        roundRect(ctx, tagX, cy, tagW, 18, 9);
        ctx.fillStyle = withAlpha("#52C41A", 0.12);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = withAlpha("#52C41A", 0.5);
        ctx.stroke();
        ctx.font = `600 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = "#52C41A";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, tagX + tagW / 2, cy + 9);
        ctx.restore();
        tagX += tagW + 6;
      }
      cy += 26;
    }

    // 案例档案
    if (e.caseArchives && e.caseArchives.length > 0) {
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#FF7A1A";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("📁 真实案例档案", r.x + 16, cy);
      cy += 16;
      ctx.font = `500 10px ${Theme.fonts.body}`;
      for (const a of e.caseArchives.slice(0, 2)) {
        ctx.fillStyle = withAlpha("#FF7A1A", 0.95);
        ctx.fillText(`📌 ${a.title}`, r.x + 16, cy);
        cy += 13;
        ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
        ctx.fillText(`${a.date} · ${a.source}`, r.x + 16, cy);
        cy += 13;
        ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
        const tLines = this.wrapText(ctx, a.takeaway, r.w - 32, 2);
        for (const line of tLines) {
          ctx.fillText(line, r.x + 16, cy);
          cy += 13;
        }
        cy += 6;
      }
    }

    ctx.restore();

    // 关闭按钮（右上角）
    const closeR = { x: r.x + r.w - 32, y: r.y + 8, w: 24, h: 24 };
    ctx.save();
    roundRect(ctx, closeR.x, closeR.y, closeR.w, closeR.h, 6);
    ctx.fillStyle = "rgba(229,53,59,0.2)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha("#E5353B", 0.6);
    ctx.stroke();
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FF6B6B";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", closeR.x + closeR.w / 2, closeR.y + closeR.h / 2);
    ctx.restore();

    // 来源（底部）
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.7);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`来源：${e.source}`, r.x + 16, r.y + r.h - 10);
    ctx.restore();
  }

  /** 画布文本换行（返回最多 maxLines 行，超长末尾加…） */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
        if (lines.length >= maxLines - 1) break;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length > 0) {
      let last = lines[lines.length - 1];
      while (last.length > 0 && ctx.measureText(last + "…").width > maxWidth) {
        last = last.slice(0, -1);
      }
      if (lines[lines.length - 1] !== last) lines[lines.length - 1] = last + "…";
    }
    return lines;
  }

  // ====================================================================
  // 触摸处理
  // ====================================================================

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    // 详情面板打开时
    if (this.selectedEntry) {
      if (type === "start") {
        // 关闭按钮
        const r = this.getDetailRect(this.lastScreenW, this.lastScreenH);
        const closeR = { x: r.x + r.w - 32, y: r.y + 8, w: 24, h: 24 };
        if (hitTest(x, y, closeR)) {
          this.pressedButton = "close";
          return true;
        }
        // 点击遮罩关闭
        this.pressedButton = "outside";
        return true;
      } else if (type === "end") {
        if (this.pressedButton === "close") {
          this.pressedButton = null;
          this.selectedEntry = null;
          playSfx("click");
          vibrateShort();
          return true;
        }
        if (this.pressedButton === "outside") {
          this.pressedButton = null;
          const r = this.getDetailRect(this.lastScreenW, this.lastScreenH);
          if (!hitTest(x, y, r)) {
            this.selectedEntry = null;
            playSfx("click");
          }
          return true;
        }
      }
      return true;
    }

    if (type === "start") {
      // 返回按钮
      if (hitTest(x, y, this.getBackBtnRect())) {
        this.pressedButton = "back";
        return true;
      }
      // Tab 切换
      for (let i = 0; i < FILTER_TABS.length; i++) {
        if (hitTest(x, y, this.getTabRect(i, this.lastScreenW))) {
          this.pressedButton = `tab${i}`;
          return true;
        }
      }
      // 卡片点击
      const entries = this.getEntries();
      for (let i = 0; i < entries.length; i++) {
        const r = this.getCardRect(i, this.lastScreenW);
        if (hitTest(x, y, { x: r.x, y: r.y - this.scrollY, w: r.w, h: r.h })) {
          this.pressedCardIdx = i;
          this.isDragging = false;
          this.dragStartY = y;
          this.dragStartScroll = this.scrollY;
          return true;
        }
      }
      // 滚动区域拖拽
      if (y > 56) {
        this.isDragging = true;
        this.dragStartY = y;
        this.dragStartScroll = this.scrollY;
        return true;
      }
      return false;
    } else if (type === "move") {
      // 滚动拖拽
      if (this.pressedCardIdx !== null || this.isDragging) {
        const dy = y - this.dragStartY;
        if (Math.abs(dy) > 5) {
          this.isDragging = true;
          this.scrollY = Math.max(0, this.dragStartScroll - dy);
          const maxScroll = Math.max(0, this.contentH - (this.lastScreenH - 56));
          this.scrollY = Math.min(this.scrollY, maxScroll);
        }
        return true;
      }
      return false;
    } else if (type === "end") {
      // 返回
      if (this.pressedButton === "back") {
        this.pressedButton = null;
        if (hitTest(x, y, this.getBackBtnRect())) {
          this.director.pop();
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      // Tab
      if (this.pressedButton && this.pressedButton.startsWith("tab")) {
        const idx = parseInt(this.pressedButton.slice(3));
        this.pressedButton = null;
        if (hitTest(x, y, this.getTabRect(idx, this.lastScreenW))) {
          this.filter = FILTER_TABS[idx].id;
          this.scrollY = 0;
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      // 卡片
      if (this.pressedCardIdx !== null) {
        const idx = this.pressedCardIdx;
        this.pressedCardIdx = null;
        if (!this.isDragging) {
          const entries = this.getEntries();
          if (idx < entries.length) {
            this.selectedEntry = entries[idx];
            playSfx("click");
            vibrateShort();
          }
        }
        this.isDragging = false;
        return true;
      }
      this.isDragging = false;
      return false;
    }
    return false;
  }
}
