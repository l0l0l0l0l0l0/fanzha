/**
 * 反诈工具箱场景（诈园区）
 *
 * 5 类反诈工具浏览：
 * - 工具分类 tab（自查/举报/止付/专线/核实），点击筛选；再次点击取消筛选
 * - 工具卡片列表：图标 + 名称 + 描述 + 展开按钮
 * - 展开后显示 steps 步骤列表 + contact 联系方式徽章 + applicableScenes 适用场景标签
 * - 同一时刻只展开 1 张卡片，点击其他卡片收起当前
 *
 * 布局（414×896 逻辑坐标系，纵向）：
 * - 0-56：顶部栏（返回 + 标题"反诈工具箱" + 96110 徽章）
 * - 56-120：工具分类区（5 个分类 tab）
 * - 120-820：工具列表（卡片式，可滚动）
 * - 820-872：紧急提示（红色警示条）
 * - 872-896：底部权威条
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawHudLabel,
  hitTest, drawBadge, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { playSfx } from "@/engine/Audio";
import { TOOLBOX_ITEMS, getToolsByType } from "@/games/bombIsland/dataV3";
import type { BombToolItem, BombToolType } from "@/games/bombIsland/types";

const ACCENT = Theme.accents["bomb-island"];

/** 布局常量 */
const LAYOUT = {
  topBarH: 56,
  tabY: 66,          // 分类 tab 起始
  tabH: 36,
  listY: 120,        // 工具列表起始
  listH: 700,        // 120-820
  urgentY: 820,      // 紧急提示
  urgentH: 52,       // 820-872
  footerY: 872,
};

/** 5 类工具分类（tab 配置） */
const TOOL_TABS: Array<{ type: BombToolType; label: string; icon: string; color: string }> = [
  { type: "selfCheck", label: "自查", icon: "📋", color: Theme.colors.neon.DEFAULT },
  { type: "report",    label: "举报", icon: "📞", color: Theme.colors.flag.DEFAULT },
  { type: "emergency", label: "止付", icon: "🚨", color: Theme.colors.warn.DEFAULT },
  { type: "hotline",   label: "专线", icon: "☎", color: Theme.colors.safe.DEFAULT },
  { type: "verify",    label: "核实", icon: "✅", color: Theme.colors.police.glow },
];

/** 分类中文名（卡片角标用） */
const TYPE_LABELS: Record<BombToolType, string> = {
  selfCheck: "自查",
  report: "举报",
  emergency: "止付",
  hotline: "专线",
  verify: "核实",
};

/** 折叠卡片高度 */
const CARD_COLLAPSED_H = 64;
/** 卡片间距 */
const CARD_GAP = 8;

export class BombToolboxScene extends Scene {
  /** 当前筛选的分类（null=全部） */
  private selectedType: BombToolType | null = null;
  /** 当前展开的工具 ID（null=全部收起） */
  private expandedId: string | null = null;
  /** 按下的按钮 ID */
  private pressedButton: string | null = null;
  /** 列表滚动偏移 */
  private scrollY = 0;
  /** 触摸起点 y（滚动判定） */
  private touchStartY = 0;
  /** 触摸起始滚动偏移 */
  private touchStartScroll = 0;
  /** 是否正在拖动滚动 */
  private dragging = false;
  /** 入场动画计时 */
  private t = 0;
  /** 分类 tab 命中区（render 写入） */
  private tabRects: Array<{ rect: Rect; type: BombToolType }> = [];
  /** 工具卡片命中区（render 写入） */
  private cardRects: Array<{ rect: Rect; id: string }> = [];

  enter(): void {
    super.enter();
    this.selectedType = null;
    this.expandedId = null;
    this.scrollY = 0;
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
  }

  /** 取当前要展示的工具列表（按分类筛选） */
  private getVisibleTools(): BombToolItem[] {
    return this.selectedType ? getToolsByType(this.selectedType) : TOOLBOX_ITEMS;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    const enterAlpha = Math.min(1, this.enterT * 2.5);
    ctx.save();
    ctx.globalAlpha = enterAlpha;

    this.renderTopBar(ctx, screenW);
    this.renderTabs(ctx, screenW);
    this.renderToolList(ctx, screenW);
    this.renderUrgent(ctx, screenW);
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

    // 标题
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(ACCENT, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("反诈工具箱", screenW / 2, 16);
    ctx.shadowBlur = 0;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
    ctx.fillText("5 类工具 · 应急自救手册", screenW / 2, 38);
    ctx.restore();

    // 96110 徽章（脉冲）
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    ctx.save();
    ctx.shadowColor = withAlpha(Theme.colors.warn.glow, 0.5 * pulse);
    ctx.shadowBlur = 6;
    drawBadge(
      ctx, screenW - 76, 14, "☎ 96110",
      withAlpha(Theme.colors.warn.DEFAULT, 0.18 + 0.1 * pulse),
      Theme.colors.warn.glow,
    );
    ctx.restore();
  }

  // ============ 分类 tab ============

  private renderTabs(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const gap = 6;
    const tabW = (screenW - pad * 2 - gap * (TOOL_TABS.length - 1)) / TOOL_TABS.length;
    const tabH = LAYOUT.tabH;
    const y = LAYOUT.tabY;
    this.tabRects = [];

    for (let i = 0; i < TOOL_TABS.length; i++) {
      const tab = TOOL_TABS[i];
      const x = pad + i * (tabW + gap);
      const rect: Rect = { x, y, w: tabW, h: tabH };
      this.tabRects.push({ rect, type: tab.type });
      const selected = this.selectedType === tab.type;
      const pressed = this.pressedButton === `tab-${i}`;

      ctx.save();
      if (selected) {
        ctx.fillStyle = withAlpha(tab.color, 0.2);
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = tab.color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = tab.color;
        ctx.shadowBlur = 8;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.shadowBlur = 0;
      } else if (pressed) {
        ctx.fillStyle = "rgba(18, 42, 66, 0.9)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = withAlpha(tab.color, 0.6);
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      } else {
        ctx.fillStyle = "rgba(18, 42, 66, 0.6)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = withAlpha(tab.color, 0.3);
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
      ctx.restore();

      // 图标 + 标签
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `16px ${Theme.fonts.body}`;
      ctx.fillStyle = selected ? tab.color : withAlpha(tab.color, 0.85);
      ctx.fillText(tab.icon, rect.x + rect.w / 2, rect.y + 13);
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = selected ? tab.color : Theme.colors.ink.DEFAULT;
      ctx.fillText(tab.label, rect.x + rect.w / 2, rect.y + 28);
      ctx.restore();
    }

    // "全部/筛选中" 提示
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const label = this.selectedType
      ? `筛选：${TYPE_LABELS[this.selectedType]}（再次点击查看全部）`
      : `展示全部 ${TOOLBOX_ITEMS.length} 件工具`;
    ctx.fillText(label, pad, y + tabH + 4);
    ctx.restore();
  }

  // ============ 工具列表 ============

  /** 测量单张卡片高度（展开/折叠） */
  private measureCardH(ctx: CanvasRenderingContext2D, tool: BombToolItem, w: number, expanded: boolean): number {
    if (!expanded) return CARD_COLLAPSED_H;
    // 头部 44
    let h = 44;
    // 步骤标题 16
    h += 18;
    // 步骤列表
    const stepFont = `400 10px ${Theme.fonts.body}`;
    for (const step of tool.steps) {
      const lines = this.wrapLines(ctx, step, w - 36, stepFont);
      h += lines.length * 14 + 3;
    }
    // 联系方式徽章
    if (tool.contact) h += 26;
    // 适用场景标签
    h += 24;
    // 底部留白
    h += 10;
    return h;
  }

  private renderToolList(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const y = LAYOUT.listY;
    const h = LAYOUT.listH;
    const w = screenW - pad * 2;
    const innerX = pad;
    const innerW = w;

    const tools = this.getVisibleTools();

    // 预计算每张卡片高度
    const cardHeights = tools.map(t => this.measureCardH(ctx, t, innerW, t.id === this.expandedId));
    let total = 8; // 顶部留白
    for (let i = 0; i < tools.length; i++) {
      total += cardHeights[i] + CARD_GAP;
    }
    total += 4;

    // 钳制滚动
    const maxScroll = Math.max(0, total - h);
    if (this.scrollY > maxScroll) this.scrollY = maxScroll;
    if (this.scrollY < 0) this.scrollY = 0;

    // 空列表提示
    if (tools.length === 0) {
      ctx.save();
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("该分类暂无工具", screenW / 2, y + h / 2);
      ctx.restore();
      this.cardRects = [];
      return;
    }

    // 裁剪 + 绘制可见卡片
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, y, w, h);
    ctx.clip();

    this.cardRects = [];
    let cursor = y + 8 - this.scrollY;
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const expanded = tool.id === this.expandedId;
      const ch = cardHeights[i];
      if (cursor + ch >= y && cursor <= y + h) {
        this.drawToolCard(ctx, innerX, cursor, innerW, tool, expanded, ch);
      }
      this.cardRects.push({ rect: { x: innerX, y: cursor, w: innerW, h: ch }, id: tool.id });
      cursor += ch + CARD_GAP;
    }
    ctx.restore();

    // 滚动条
    if (total > h) {
      const thumbH = Math.max(20, (h / total) * h);
      const thumbY = y + (this.scrollY / maxScroll) * (h - thumbH);
      ctx.save();
      ctx.fillStyle = withAlpha(ACCENT, 0.4);
      ctx.fillRect(pad + w - 4, thumbY, 2, thumbH);
      ctx.restore();
    }
  }

  /** 绘制单张工具卡片 */
  private drawToolCard(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number,
    tool: BombToolItem, expanded: boolean, cardH: number,
  ): void {
    const tabDef = TOOL_TABS.find(t => t.type === tool.type);
    const color = tabDef?.color ?? ACCENT;
    const pressed = this.pressedButton === `card-${tool.id}`;

    // 卡片背景
    ctx.save();
    if (expanded) {
      ctx.fillStyle = withAlpha(color, 0.08);
      ctx.fillRect(x, y, w, cardH);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.strokeRect(x, y, w, cardH);
      ctx.shadowBlur = 0;
    } else if (pressed) {
      ctx.fillStyle = withAlpha(color, 0.12);
      ctx.fillRect(x, y, w, cardH);
      ctx.strokeStyle = withAlpha(color, 0.7);
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, cardH);
    } else {
      ctx.fillStyle = "rgba(18, 42, 66, 0.7)";
      ctx.fillRect(x, y, w, cardH);
      ctx.strokeStyle = withAlpha(color, 0.35);
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, cardH);
    }
    // 顶部渐变细线
    const lg = ctx.createLinearGradient(x, y, x + w, y);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, color);
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, 1);
    ctx.restore();

    // 图标
    ctx.save();
    ctx.font = `24px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    if (expanded) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    }
    ctx.fillText(tool.icon, x + 22, y + 26);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 名称 + 分类角标
    ctx.save();
    ctx.textBaseline = "top";
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = expanded ? color : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.fillText(tool.name, x + 48, y + 12);
    // 分类角标
    ctx.font = `400 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(color, 0.85);
    ctx.fillText(`[${TYPE_LABELS[tool.type]}]`, x + 48 + ctx.measureText(tool.name).width + 8, y + 15);
    ctx.restore();

    // 描述（折叠态截断；展开态完整）
    const descFont = `400 10px ${Theme.fonts.body}`;
    ctx.save();
    ctx.font = descFont;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.78);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const descMaxW = w - 90;
    if (expanded) {
      const descLines = this.wrapLines(ctx, tool.desc, descMaxW, descFont);
      descLines.forEach((ln, i) => ctx.fillText(ln, x + 48, y + 32 + i * 13));
    } else {
      let desc = tool.desc;
      while (desc.length > 1 && ctx.measureText(desc + "…").width > descMaxW) desc = desc.slice(0, -1);
      if (desc.length < tool.desc.length) desc += "…";
      ctx.fillText(desc, x + 48, y + 36);
    }
    ctx.restore();

    // 展开/收起按钮（右上角）
    const toggleX = x + w - 28;
    const toggleY = y + 12;
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = expanded ? color : Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(expanded ? "▲" : "▼", toggleX + 8, toggleY + 8);
    ctx.restore();

    // 展开内容
    if (expanded) {
      let cy = y + 50;
      // 步骤标题
      ctx.save();
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("📋 操作步骤", x + 12, cy);
      ctx.restore();
      cy += 18;

      // 步骤列表（带序号）
      const stepFont = `400 10px ${Theme.fonts.body}`;
      ctx.save();
      ctx.font = stepFont;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      for (let i = 0; i < tool.steps.length; i++) {
        const step = tool.steps[i];
        const lines = this.wrapLines(ctx, step, w - 36, stepFont);
        // 序号圆点
        ctx.save();
        ctx.fillStyle = withAlpha(color, 0.18);
        ctx.beginPath();
        ctx.arc(x + 20, cy + 6, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = withAlpha(color, 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = `700 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${i + 1}`, x + 20, cy + 7);
        ctx.restore();
        // 步骤文本
        ctx.save();
        ctx.font = stepFont;
        ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        lines.forEach((ln, k) => ctx.fillText(ln, x + 34, cy + k * 14));
        ctx.restore();
        cy += lines.length * 14 + 3;
      }
      ctx.restore();

      // 联系方式徽章（高亮）
      if (tool.contact) {
        ctx.save();
        drawBadge(ctx, x + 12, cy, `☎ ${tool.contact}`,
          withAlpha(Theme.colors.warn.DEFAULT, 0.2), Theme.colors.warn.glow);
        ctx.restore();
        cy += 26;
      }

      // 适用场景标签
      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("适用：", x + 12, cy + 8);
      let tagX = x + 12 + ctx.measureText("适用：").width + 4;
      for (const scene of tool.applicableScenes) {
        const tagW = ctx.measureText(scene).width + 12;
        ctx.fillStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.12);
        ctx.fillRect(tagX, cy + 1, tagW, 14);
        ctx.strokeStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.4);
        ctx.lineWidth = 1;
        ctx.strokeRect(tagX, cy + 1, tagW, 14);
        ctx.fillStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.9);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(scene, tagX + tagW / 2, cy + 8);
        tagX += tagW + 4;
        // 超出宽度则停止
        if (tagX > x + w - 8) break;
      }
      ctx.restore();
    }
  }

  // ============ 紧急提示 ============

  private renderUrgent(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const y = LAYOUT.urgentY;
    const h = LAYOUT.urgentH;
    const w = screenW - pad * 2;

    // 红色警示底
    ctx.save();
    ctx.fillStyle = withAlpha(Theme.colors.warn.DEFAULT, 0.16);
    ctx.fillRect(pad, y, w, h);
    ctx.fillStyle = Theme.colors.warn.DEFAULT;
    ctx.fillRect(pad, y, 4, h);
    // 警闪
    const flash = 0.5 + 0.5 * Math.sin(this.t * 4);
    ctx.fillStyle = withAlpha(Theme.colors.warn.glow, 0.3 + 0.3 * flash);
    ctx.fillRect(pad, y, w, 1);
    ctx.fillRect(pad, y + h - 1, w, 1);
    ctx.restore();

    // 文案
    ctx.save();
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.warn.glow;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(Theme.colors.warn.DEFAULT, 0.4);
    ctx.shadowBlur = 4;
    ctx.fillText("🚨 已转账？立即止损", pad + 14, y + 8);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    ctx.fillText("立即拨打 110 + 银行客服紧急止付（黄金 30 分钟）", pad + 14, y + 28);
    ctx.restore();
  }

  // ============ 底部权威条 ============

  private renderFooter(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const y = LAYOUT.footerY;
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.9)";
    ctx.fillRect(0, y, screenW, screenH - y);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, y, screenW, 1);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.fillText("96110", 12, y + (screenH - y) / 2);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(" 反诈专线 · ", 40, y + (screenH - y) / 2);
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.fillText("12321", 108, y + (screenH - y) / 2);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(" 举报渠道", 144, y + (screenH - y) / 2);
    ctx.textAlign = "right";
    ctx.fillText("全民反诈 · 天下无诈", screenW - 12, y + (screenH - y) / 2);
    ctx.restore();
  }

  // ============ 工具：文本换行 ============

  private wrapLines(
    ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string,
  ): string[] {
    ctx.save();
    ctx.font = font;
    const lines: string[] = [];
    let line = "";
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  }

  // ============ 触摸处理 ============

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    const screenW = this.director.screenWidth;

    if (type === "start") {
      // 返回按钮
      const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
      if (hitTest(x, y, backBtn)) {
        this.pressedButton = "back";
        return true;
      }
      // 分类 tab
      for (let i = 0; i < this.tabRects.length; i++) {
        if (hitTest(x, y, this.tabRects[i].rect)) {
          this.pressedButton = `tab-${i}`;
          return true;
        }
      }
      // 工具列表：卡片展开/收起 + 滚动
      const listRect: Rect = { x: 16, y: LAYOUT.listY, w: screenW - 32, h: LAYOUT.listH };
      if (hitTest(x, y, listRect)) {
        for (const cr of this.cardRects) {
          if (hitTest(x, y, cr.rect)) {
            this.pressedButton = `card-${cr.id}`;
            return true;
          }
        }
        // 否则作为滚动拖拽起点
        this.touchStartY = y;
        this.touchStartScroll = this.scrollY;
        this.dragging = true;
        return true;
      }
      return false;
    }

    if (type === "move") {
      if (this.dragging) {
        const delta = this.touchStartY - y;
        this.scrollY = this.touchStartScroll + delta;
        return true;
      }
      return false;
    }

    if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;
      this.dragging = false;

      // 返回
      const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
      if (pressed === "back" && hitTest(x, y, backBtn)) {
        playSfx("click");
        this.director.pop();
        return true;
      }

      // 分类 tab 切换（再次点击同 tab 取消筛选 → 全部）
      if (pressed?.startsWith("tab-")) {
        const idx = parseInt(pressed.slice(4), 10);
        if (idx < this.tabRects.length && hitTest(x, y, this.tabRects[idx].rect)) {
          const tType = this.tabRects[idx].type;
          playSfx("click");
          if (this.selectedType === tType) {
            this.selectedType = null; // 取消筛选
          } else {
            this.selectedType = tType;
          }
          this.expandedId = null;
          this.scrollY = 0;
          return true;
        }
      }

      // 卡片展开/收起（点击其他卡片收起当前）
      if (pressed?.startsWith("card-")) {
        const id = pressed.slice(5);
        const cr = this.cardRects.find(c => c.id === id);
        if (cr && hitTest(x, y, cr.rect)) {
          playSfx("click");
          this.expandedId = (this.expandedId === id) ? null : id;
          // 展开后若超出视野，滚到该卡片
          if (this.expandedId === id) {
            const maxScroll = this.computeMaxScroll(screenW);
            // 将该卡片顶部对齐到列表顶部
            const cardTop = cr.rect.y - LAYOUT.listY + this.scrollY;
            const target = Math.min(maxScroll, Math.max(0, cardTop - 8));
            this.scrollY = target;
          }
          return true;
        }
      }

      return true;
    }

    return false;
  }

  /** 计算当前列表最大滚动距离（与 render 口径一致） */
  private computeMaxScroll(screenW: number): number {
    const pad = 16;
    const h = LAYOUT.listH;
    // 用一个临时 ctx 估算不可行（无 ctx），改为按工具数据估算高度
    // 此处复用 measureCardH 需 ctx，因此采用简化估算：与 render 一致地用 getVisibleTools
    // 为避免重复测量复杂度，直接用一个足够大的上界；render 会再次钳制
    const tools = this.getVisibleTools();
    let total = 8;
    for (const t of tools) {
      // 估算：折叠 64；展开 ≈ 64 + steps*17 + 60
      const expanded = t.id === this.expandedId;
      const est = expanded ? CARD_COLLAPSED_H + t.steps.length * 17 + 64 : CARD_COLLAPSED_H;
      total += est + CARD_GAP;
    }
    total += 4;
    void pad;
    void screenW;
    return Math.max(0, total - h);
  }
}
