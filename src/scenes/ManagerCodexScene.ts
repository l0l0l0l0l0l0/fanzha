/**
 * 「反诈职业经理人」图鉴系统（v6 Phase 3.3 + v7 知识图谱）
 * 横屏 Canvas UI：三类图鉴（敌人/探员/案件）浏览 + 详情展开 + 知识图谱视图
 * - 顶部 Tab 切换类别（v7 新增第 4 Tab：知识图谱）
 * - 网格卡片展示条目（已解锁/未解锁两种状态）
 * - 点击已解锁条目展开详情面板（描述 + 反诈知识点）
 * - v7：知识图谱视图展示诈骗类型关联关系
 * - 显示各类别解锁进度
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawScanlineOverlay,
  drawNeonCorners, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { MANAGER_CODEX } from "@/games/manager/data";
import { KNOWLEDGE_GRAPH, getGraphLinks } from "@/games/manager/data.v7";
import { MANAGER_SYSTEMS } from "@/games/manager/data.v8";
import { MAZE_TERMS } from "@/games/manager/maze";
import type { CodexCategory, CodexEntry, KnowledgeGraphNode } from "@/games/manager/types";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";

const CATEGORY_META: Record<CodexCategory, { label: string; emoji: string; accent: string }> = {
  enemy: { label: "敌人图鉴", emoji: "⚠️", accent: "#E5353B" },
  agent: { label: "探员图鉴", emoji: "🛡️", accent: "#00E5FF" },
  case: { label: "案件图鉴", emoji: "📁", accent: "#FFB020" },
};

/** 网格列数（横屏布局） */
const GRID_COLS = 6;
/** 每个卡片高度 */
const CARD_H = 88;
const CARD_GAP = 8;

export class ManagerCodexScene extends Scene {
  private category: CodexCategory = "enemy";
  private selectedEntry: CodexEntry | null = null;
  private pressedButton: string | null = null;
  private scrollY = 0;
  private contentH = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;
  // ===== v7 知识图谱 + 口诀收集 =====
  /** 当前视图模式：网格 / 图谱 / 口诀 / 系统（v10 新增） */
  private viewMode: "grid" | "graph" | "terms" | "systems" = "grid";
  /** 图谱中选中的节点 codexId */
  private selectedGraphNode: string | null = null;
  private pressedGraphNode: string | null = null;

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.selectedEntry = null;
    this.scrollY = 0;
    this.viewMode = "grid";
    this.selectedGraphNode = null;
  }

  /** 当前类别下所有图鉴条目 */
  private getEntries(): CodexEntry[] {
    return MANAGER_CODEX.filter((e) => e.category === this.category);
  }

  /** 当前类别已解锁的条目 id 列表 */
  private getUnlockedIds(): Set<string> {
    const meta = platformStore.managerMetaProgress();
    const list = this.category === "enemy" ? meta.enemyCodex
      : this.category === "agent" ? meta.agentCodex
      : meta.caseCodex;
    return new Set(list);
  }

  // ====================================================================
  // 布局
  // ====================================================================

  private getBackBtnRect(): Rect {
    return { x: 8, y: 8, w: 56, h: 32 };
  }

  private getTabRect(idx: number, screenW: number): Rect {
    // v10：6 个 Tab（敌人/探员/案件/图谱/口诀/系统），宽度自适应
    const tabW = 84;
    const gap = 6;
    const totalW = 6 * tabW + 5 * gap;
    const startX = (screenW - totalW) / 2;
    return { x: startX + idx * (tabW + gap), y: 8, w: tabW, h: 32 };
  }

  /** 网格区域起点 y（顶部栏之下） */
  private getGridStartY(): number {
    return 56;
  }

  /** 网格区域可用宽度（左右各留 16 边距） */
  private getGridAvailW(screenW: number): number {
    return screenW - 32;
  }

  /** 取索引 idx 的卡片矩形（在内容坐标系中） */
  private getCardRect(idx: number, screenW: number): Rect {
    const startY = this.getGridStartY();
    const availW = this.getGridAvailW(screenW);
    const totalGapW = (GRID_COLS - 1) * CARD_GAP;
    const cardW = Math.floor((availW - totalGapW) / GRID_COLS);
    const cardH = CARD_H;
    const col = idx % GRID_COLS;
    const row = Math.floor(idx / GRID_COLS);
    const x = 16 + col * (cardW + CARD_GAP);
    const y = startY + 40 + row * (cardH + CARD_GAP); // 40 = 类别标题区高度
    return { x, y, w: cardW, h: cardH };
  }

  /** 详情面板矩形（屏幕居中） */
  private getDetailRect(screenW: number, screenH: number): Rect {
    const w = Math.min(560, screenW - 64);
    const h = Math.min(320, screenH - 80);
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
  }

  // ====================================================================
  // 渲染
  // ====================================================================

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    // 顶部导航条
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.85)";
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
    ctx.fillStyle = Theme.accents.manager;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(Theme.accents.manager, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("反诈档案 · 图鉴系统", screenW / 2, 24);
    ctx.restore();

    // 三个类别 Tab + v7 第 4 Tab（知识图谱）+ 第 5 Tab（口诀）+ v10 第 6 Tab（系统）
    const categories: CodexCategory[] = ["enemy", "agent", "case"];
    for (let i = 0; i < categories.length; i++) {
      this.renderTab(ctx, i, categories[i], screenW);
    }
    this.renderGraphTab(ctx, 3, screenW);
    this.renderTermsTab(ctx, 4, screenW);
    this.renderSystemsTab(ctx, 5, screenW);

    // v7：图谱视图 / 口诀视图 / 网格视图 / v10 系统视图
    if (this.viewMode === "graph") {
      this.renderGraphView(ctx, screenW, screenH);
    } else if (this.viewMode === "terms") {
      this.renderTermsView(ctx, screenW, screenH);
    } else if (this.viewMode === "systems") {
      this.renderSystemsView(ctx, screenW, screenH);
    } else {
      // 滚动内容：类别标题 + 进度 + 网格
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 56, screenW, screenH - 56);
      ctx.clip();
      ctx.translate(0, -this.scrollY);

      this.renderCategoryHeader(ctx, screenW);
      const entries = this.getEntries();
      const unlocked = this.getUnlockedIds();
      for (let i = 0; i < entries.length; i++) {
        this.renderCard(ctx, i, entries[i], unlocked.has(entries[i].id), screenW);
      }
      // 计算内容总高度
      const rows = Math.ceil(entries.length / GRID_COLS);
      this.contentH = this.getGridStartY() + 40 + rows * (CARD_H + CARD_GAP) + 32;
      ctx.restore();
    }

    // 详情面板（最上层）
    if (this.selectedEntry) {
      this.renderDetail(ctx, screenW, screenH);
    }

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderTab(ctx: CanvasRenderingContext2D, idx: number, cat: CodexCategory, screenW: number): void {
    const meta = CATEGORY_META[cat];
    const rect = this.getTabRect(idx, screenW);
    const selected = this.category === cat;
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: selected ? meta.accent : withAlpha(Theme.colors.bg.line, 0.5),
      borderWidth: selected ? 2 : 1,
      bgColor: selected ? withAlpha(meta.accent, 0.12) : Theme.colors.bg.card,
    });
    ctx.save();
    ctx.font = `400 14px ${Theme.fonts.body}`;
    ctx.fillStyle = selected ? meta.accent : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(meta.emoji, rect.x + 18, rect.y + rect.h / 2);
    ctx.font = `${selected ? "700" : "500"} 11px ${Theme.fonts.display}`;
    ctx.fillStyle = selected ? meta.accent : Theme.colors.ink.muted;
    ctx.fillText(meta.label, rect.x + 56, rect.y + rect.h / 2);
    ctx.restore();
  }

  /** v7：渲染第 4 Tab（知识图谱） */
  private renderGraphTab(ctx: CanvasRenderingContext2D, idx: number, screenW: number): void {
    const accent = "#9D6BFF";
    const rect = this.getTabRect(idx, screenW);
    const selected = this.viewMode === "graph";
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: selected ? accent : withAlpha(Theme.colors.bg.line, 0.5),
      borderWidth: selected ? 2 : 1,
      bgColor: selected ? withAlpha(accent, 0.12) : Theme.colors.bg.card,
    });
    ctx.save();
    ctx.font = `400 14px ${Theme.fonts.body}`;
    ctx.fillStyle = selected ? accent : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🔗", rect.x + 18, rect.y + rect.h / 2);
    ctx.font = `${selected ? "700" : "500"} 11px ${Theme.fonts.display}`;
    ctx.fillStyle = selected ? accent : Theme.colors.ink.muted;
    ctx.fillText("知识图谱", rect.x + 50, rect.y + rect.h / 2);
    ctx.restore();
  }

  /** v7：渲染第 5 Tab（口诀收集） */
  private renderTermsTab(ctx: CanvasRenderingContext2D, idx: number, screenW: number): void {
    const accent = "#FFD666";
    const rect = this.getTabRect(idx, screenW);
    const selected = this.viewMode === "terms";
    const meta = platformStore.managerMetaProgress();
    const count = meta.collectedTerms.length;
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: selected ? accent : withAlpha(Theme.colors.bg.line, 0.5),
      borderWidth: selected ? 2 : 1,
      bgColor: selected ? withAlpha(accent, 0.12) : Theme.colors.bg.card,
    });
    ctx.save();
    ctx.font = `400 14px ${Theme.fonts.body}`;
    ctx.fillStyle = selected ? accent : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📜", rect.x + 18, rect.y + rect.h / 2);
    ctx.font = `${selected ? "700" : "500"} 11px ${Theme.fonts.display}`;
    ctx.fillStyle = selected ? accent : Theme.colors.ink.muted;
    ctx.fillText(`口诀 ${count}/36`, rect.x + 50, rect.y + rect.h / 2);
    ctx.restore();
  }

  /** v7：口诀收集视图 — 36 句口诀网格 + 解锁状态 */
  private renderTermsView(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const accent = "#FFD666";
    const meta = platformStore.managerMetaProgress();
    const collected = new Set(meta.collectedTerms);

    // 顶部说明
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(`// 反诈口诀收集 · ${collected.size}/36`, screenW / 2, 72);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("击破 BOSS / 爬塔里程碑 / 累计击杀 解锁口诀", screenW / 2, 90);
    ctx.restore();

    // 36 句口诀网格（6 列 × 6 行）
    const cols = 6;
    const rows = 6;
    const gap = 8;
    const availW = screenW - 32;
    const cardW = Math.floor((availW - (cols - 1) * gap) / cols);
    const cardH = 56;
    const startY = 110;
    for (let i = 0; i < 36; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 16 + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      const isCollected = collected.has(i);
      const term = MAZE_TERMS[i];

      drawPanel(ctx, x, y, cardW, cardH, {
        bgColor: isCollected ? withAlpha(accent, 0.1) : "rgba(20, 30, 50, 0.6)",
        borderColor: isCollected ? accent : withAlpha(Theme.colors.bg.line, 0.4),
        borderWidth: isCollected ? 1.5 : 1,
      });
      ctx.save();
      // 序号
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = isCollected ? accent : Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`#${String(i + 1).padStart(2, "0")}`, x + 6, y + 4);
      // 口诀文本
      ctx.font = `${isCollected ? "700" : "500"} 12px ${Theme.fonts.display}`;
      ctx.fillStyle = isCollected ? Theme.colors.ink.DEFAULT : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (isCollected) {
        ctx.fillText(term, x + cardW / 2, y + cardH / 2 + 4);
      } else {
        ctx.fillText("？？？", x + cardW / 2, y + cardH / 2 + 4);
      }
      ctx.restore();
    }
  }

  /** v10：系统总览 Tab */
  private renderSystemsTab(ctx: CanvasRenderingContext2D, idx: number, screenW: number): void {
    const accent = "#00E5FF";
    const rect = this.getTabRect(idx, screenW);
    const selected = this.viewMode === "systems";
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: selected ? accent : withAlpha(Theme.colors.bg.line, 0.5),
      borderWidth: selected ? 2 : 1,
      bgColor: selected ? withAlpha(accent, 0.12) : Theme.colors.bg.card,
    });
    ctx.save();
    ctx.font = `400 14px ${Theme.fonts.body}`;
    ctx.fillStyle = selected ? accent : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧩", rect.x + 18, rect.y + rect.h / 2);
    ctx.font = `${selected ? "700" : "500"} 11px ${Theme.fonts.display}`;
    ctx.fillStyle = selected ? accent : Theme.colors.ink.muted;
    ctx.fillText(`系统 ${MANAGER_SYSTEMS.length}`, rect.x + 52, rect.y + rect.h / 2);
    ctx.restore();
  }

  /** v10：系统总览视图 — 按 category 分组列出 20+ 系统 + 触发条件 */
  private renderSystemsView(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const accent = "#00E5FF";
    // 滚动容器
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 56, screenW, screenH - 56);
    ctx.clip();
    ctx.translate(0, -this.scrollY);

    // 标题
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(`🧩 系统总览 · ${MANAGER_SYSTEMS.length} 个系统`, 20, 70);
    ctx.shadowBlur = 0;
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("manager 模块从 v3 到 v10 累计实现的全部系统及触发方式", 20, 92);

    // 按 category 分组
    const categoryOrder: { key: string; label: string; color: string }[] = [
      { key: "core", label: "核心战斗", color: "#FF7A1A" },
      { key: "element", label: "元素系统", color: "#00BFA5" },
      { key: "bond", label: "羁绊协同", color: "#FF7AB8" },
      { key: "education", label: "反诈教育", color: "#52C41A" },
      { key: "meta", label: "元进度养成", color: "#FFD666" },
    ];

    let y = 116;
    const cardH = 56;
    const cardGap = 6;
    const cardW = screenW - 40;
    for (const cat of categoryOrder) {
      const systems = MANAGER_SYSTEMS.filter((s) => s.category === cat.key);
      if (systems.length === 0) continue;
      // 分类标题
      ctx.font = `700 13px ${Theme.fonts.display}`;
      ctx.fillStyle = cat.color;
      ctx.fillText(`▶ ${cat.label}（${systems.length}）`, 20, y);
      y += 22;
      // 系统卡片
      for (const sys of systems) {
        // 卡片背景
        drawPanel(ctx, 20, y, cardW, cardH, {
          borderColor: withAlpha(sys.color, 0.4),
          borderWidth: 1,
          bgColor: withAlpha(sys.color, 0.05),
        });
        // 左侧色条
        ctx.fillStyle = sys.color;
        ctx.fillRect(20, y, 3, cardH);
        // emoji + 名称
        ctx.font = `700 14px ${Theme.fonts.body}`;
        ctx.fillStyle = sys.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`${sys.emoji} ${sys.name}`, 32, y + 8);
        // 版本标签
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.textAlign = "right";
        ctx.fillText(sys.version.toUpperCase(), screenW - 28, y + 8);
        // 描述
        ctx.font = `400 11px ${Theme.fonts.body}`;
        ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
        ctx.textAlign = "left";
        ctx.fillText(sys.desc, 32, y + 26);
        // 触发条件
        ctx.font = `400 10px ${Theme.fonts.body}`;
        ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
        ctx.fillText(`触发：${sys.trigger}`, 32, y + 41);
        y += cardH + cardGap;
      }
      y += 8;
    }
    this.contentH = y + 32;
    ctx.restore();
  }

  /** v7：知识图谱视图 — 圆形布局 + 连线 + 选中节点详情 */
  private renderGraphView(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const accent = "#9D6BFF";
    const centerY = 56 + (screenH - 56) / 2;
    const centerX = screenW / 2;
    const radius = Math.min(screenW, screenH - 56) * 0.32;

    // 顶部说明
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText("// 反诈知识图谱 · 诈骗类型关联关系", screenW / 2, 72);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("点击节点查看关联 · 节点颜色表示类型", screenW / 2, 90);
    ctx.restore();

    // 计算节点位置（圆形布局）
    const nodes = KNOWLEDGE_GRAPH;
    const nodePositions = new Map<string, { x: number; y: number }>();
    for (let i = 0; i < nodes.length; i++) {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.7; // 椭圆压扁
      nodePositions.set(nodes[i].codexId, { x, y });
    }

    // 先画连线
    ctx.save();
    ctx.lineWidth = 1;
    for (const node of nodes) {
      const from = nodePositions.get(node.codexId);
      if (!from) continue;
      for (const linkId of node.links) {
        const to = nodePositions.get(linkId);
        if (!to) continue;
        const isSelectedLink = this.selectedGraphNode === node.codexId
          || this.selectedGraphNode === linkId;
        ctx.strokeStyle = isSelectedLink
          ? withAlpha(accent, 0.7)
          : withAlpha(Theme.colors.bg.line, 0.35);
        ctx.lineWidth = isSelectedLink ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 画节点
    const kindColor: Record<string, string> = {
      fraudType: "#E5353B",
      tactic: "#FFB020",
      channel: "#B388FF",
      target: "#52C41A",
    };
    const meta = platformStore.managerMetaProgress();
    const allCodex = new Set([...meta.enemyCodex, ...meta.agentCodex, ...meta.caseCodex]);
    for (const node of nodes) {
      const pos = nodePositions.get(node.codexId);
      if (!pos) continue;
      const isSelected = this.selectedGraphNode === node.codexId;
      const isUnlocked = allCodex.has(node.codexId);
      const color = kindColor[node.kind] ?? accent;
      const nodeR = isSelected ? 22 : 16;

      // 节点背景圆
      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeR, 0, Math.PI * 2);
      ctx.fillStyle = isUnlocked ? withAlpha(color, 0.18) : "rgba(40, 50, 70, 0.6)";
      ctx.fill();
      ctx.strokeStyle = isUnlocked ? color : withAlpha(Theme.colors.ink.muted, 0.3);
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.stroke();
      // 选中时外发光
      if (isSelected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.stroke();
      }
      ctx.restore();

      // 节点 emoji/标识
      const codexEntry = MANAGER_CODEX.find((e) => e.id === node.codexId);
      const emoji = codexEntry?.emoji ?? "?";
      ctx.save();
      ctx.font = `${nodeR * 0.7}px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = isUnlocked ? 1 : 0.4;
      ctx.fillText(emoji, pos.x, pos.y);
      ctx.restore();

      // 节点标签（简短）
      if (isUnlocked && codexEntry) {
        const label = codexEntry.name.slice(0, 4);
        ctx.save();
        ctx.font = `500 9px ${Theme.fonts.display}`;
        ctx.fillStyle = isSelected ? color : Theme.colors.ink.muted;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(label, pos.x, pos.y + nodeR + 2);
        ctx.restore();
      }
    }

    // 选中节点的详情面板（右侧）
    if (this.selectedGraphNode) {
      this.renderGraphNodeDetail(ctx, this.selectedGraphNode, screenW, screenH);
    }
  }

  /** v7：图谱节点详情面板 */
  private renderGraphNodeDetail(ctx: CanvasRenderingContext2D, codexId: string, screenW: number, screenH: number): void {
    const node = KNOWLEDGE_GRAPH.find((n) => n.codexId === codexId);
    if (!node) return;
    const codexEntry = MANAGER_CODEX.find((e) => e.id === codexId);
    const meta = platformStore.managerMetaProgress();
    const allCodex = new Set([...meta.enemyCodex, ...meta.agentCodex, ...meta.caseCodex]);
    const isUnlocked = allCodex.has(codexId);

    // 右侧面板
    const panelW = 240;
    const panelH = Math.min(280, screenH - 100);
    const panelX = screenW - panelW - 16;
    const panelY = 100;
    const accent = "#9D6BFF";
    drawPanel(ctx, panelX, panelY, panelW, panelH, {
      bgColor: "rgba(15, 34, 54, 0.95)",
      borderColor: accent,
      borderWidth: 2,
    });

    // 标题
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(codexEntry?.emoji ?? "🔗", panelX + 12, panelY + 12);
    ctx.fillText(codexEntry?.name ?? codexId, panelX + 36, panelY + 14);
    // 节点类型标签
    const kindLabel: Record<string, string> = {
      fraudType: "诈骗类型",
      tactic: "话术手段",
      channel: "洗钱通道",
      target: "受害目标",
    };
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`类型：${kindLabel[node.kind] ?? node.kind}`, panelX + 12, panelY + 36);

    if (!isUnlocked) {
      ctx.font = `500 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("（该条目尚未解锁）", panelX + 12, panelY + 56);
    } else if (codexEntry) {
      // 描述
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const desc = codexEntry.short.length > 60
        ? codexEntry.short.slice(0, 60) + "…"
        : codexEntry.short;
      this.wrapAndDraw(ctx, desc, panelX + 12, panelY + 56, panelW - 24, 14);
    }

    // 关联节点列表
    const links = getGraphLinks(codexId);
    let ly = panelY + 110;
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.fillText("关联节点", panelX + 12, ly);
    ly += 18;
    if (links.length === 0) {
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("（无关联）", panelX + 12, ly);
    } else {
      for (const link of links) {
        const linkEntry = MANAGER_CODEX.find((e) => e.id === link.target.codexId);
        const linkUnlocked = allCodex.has(link.target.codexId);
        ctx.font = `400 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.fillText(`• ${link.desc}`, panelX + 12, ly);
        ly += 14;
        ctx.font = `500 11px ${Theme.fonts.display}`;
        ctx.fillStyle = linkUnlocked ? Theme.colors.ink.DEFAULT : Theme.colors.ink.muted;
        ctx.fillText(`  ${linkEntry?.emoji ?? "?"} ${linkEntry?.name ?? link.target.codexId}`, panelX + 16, ly);
        ly += 16;
        if (ly > panelY + panelH - 12) break;
      }
    }
    ctx.restore();
  }

  /** 简单文本换行绘制（辅助） */
  private wrapAndDraw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): void {
    const chars = text.split("");
    let line = "";
    let cy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        ctx.fillText(line, x, cy);
        line = ch;
        cy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }

  private renderCategoryHeader(ctx: CanvasRenderingContext2D, screenW: number): void {
    const meta = CATEGORY_META[this.category];
    const entries = this.getEntries();
    const unlocked = this.getUnlockedIds();
    const unlockedCount = entries.filter((e) => unlocked.has(e.id)).length;
    const y = this.getGridStartY() + 8;
    // 类别标题 + 进度
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = meta.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(meta.accent, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(`▸ ${meta.label}`, 16, y);
    ctx.shadowBlur = 0;
    ctx.font = `500 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText(`已解锁 ${unlockedCount}/${entries.length}`, screenW - 16, y);
    // 进度条
    const barW = screenW - 32;
    const barY = y + 14;
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.5);
    ctx.fillRect(16, barY, barW, 3);
    const ratio = entries.length > 0 ? unlockedCount / entries.length : 0;
    if (ratio > 0) {
      ctx.fillStyle = meta.accent;
      ctx.shadowColor = meta.accent;
      ctx.shadowBlur = 4;
      ctx.fillRect(16, barY, barW * ratio, 3);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  private renderCard(ctx: CanvasRenderingContext2D, idx: number, entry: CodexEntry, unlocked: boolean, screenW: number): void {
    const rect = this.getCardRect(idx, screenW);
    const isSelected = this.selectedEntry?.id === entry.id;
    const meta = CATEGORY_META[entry.category];

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: unlocked ? (isSelected ? entry.color : withAlpha(entry.color, 0.5)) : withAlpha(Theme.colors.bg.line, 0.4),
      borderWidth: unlocked ? (isSelected ? 2 : 1) : 1,
      bgColor: unlocked ? (isSelected ? withAlpha(entry.color, 0.15) : withAlpha(entry.color, 0.05)) : "rgba(20, 30, 45, 0.6)",
    });

    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = entry.color;
      ctx.lineWidth = 1;
      ctx.shadowColor = entry.color;
      ctx.shadowBlur = 10;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.restore();
    }

    // emoji（已解锁显示原色，未解锁灰色 + 锁标）
    ctx.save();
    ctx.font = `28px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (unlocked) {
      ctx.fillText(entry.emoji, rect.x + rect.w / 2, rect.y + 28);
    } else {
      ctx.globalAlpha = 0.35;
      ctx.fillText("🔒", rect.x + rect.w / 2, rect.y + 28);
    }
    ctx.restore();

    // 名称
    ctx.save();
    ctx.font = `${unlocked ? "700" : "400"} 11px ${Theme.fonts.display}`;
    ctx.fillStyle = unlocked ? entry.color : Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const name = unlocked ? entry.name : "????";
    ctx.fillText(name, rect.x + rect.w / 2, rect.y + 56);
    // 短描述
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = unlocked ? Theme.colors.ink.muted : Theme.colors.ink.dim;
    ctx.fillText(unlocked ? entry.short : "未解锁", rect.x + rect.w / 2, rect.y + 72);
    ctx.restore();

    // 已解锁标记（右上角小点）
    if (unlocked) {
      ctx.save();
      ctx.fillStyle = meta.accent;
      ctx.shadowColor = meta.accent;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(rect.x + rect.w - 8, rect.y + 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderDetail(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const entry = this.selectedEntry;
    if (!entry) return;
    // 半透明遮罩
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.82)";
    ctx.fillRect(0, 0, screenW, screenH);
    const rect = this.getDetailRect(screenW, screenH);
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      bgColor: "rgba(15, 34, 54, 0.97)",
      borderColor: entry.color,
      borderWidth: 2,
    });
    drawNeonCorners(ctx, rect.x, rect.y, rect.w, rect.h, entry.color, 14, 3, 8);

    // 大 emoji
    ctx.font = `48px ${Theme.fonts.body}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(entry.emoji, rect.x + rect.w / 2, rect.y + 20);

    // 名称
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = entry.color;
    ctx.shadowColor = entry.color;
    ctx.shadowBlur = 8;
    ctx.fillText(entry.name, rect.x + rect.w / 2, rect.y + 80);
    ctx.shadowBlur = 0;

    // 短描述
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`// ${entry.short}`, rect.x + rect.w / 2, rect.y + 108);

    // 详细描述
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.wrapText(ctx, entry.detail, rect.x + 24, rect.y + 132, rect.w - 48, 18);

    // 反诈知识点
    const tipY = rect.y + rect.h - 80;
    ctx.fillStyle = withAlpha(entry.color, 0.1);
    ctx.fillRect(rect.x + 16, tipY, rect.w - 32, 48);
    ctx.strokeStyle = withAlpha(entry.color, 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 16, tipY, rect.w - 32, 48);
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = entry.color;
    ctx.textAlign = "left";
    ctx.fillText("💡 反诈知识点", rect.x + 24, tipY + 8);
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    this.wrapText(ctx, entry.tip, rect.x + 24, tipY + 24, rect.w - 48, 14);

    // 关闭按钮
    const closeBtn: Rect = { x: rect.x + rect.w - 36, y: rect.y + 8, w: 28, h: 28 };
    drawButton(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, "✕", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "close",
    });
    ctx.restore();
  }

  /** 简单文本换行（按字符宽度） */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const chars = Array.from(text);
    let line = "";
    let cy = y;
    for (const ch of chars) {
      if (ch === "\n") {
        ctx.fillText(line, x, cy);
        line = "";
        cy += lineHeight;
        continue;
      }
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line.length > 0) {
        ctx.fillText(line, x, cy);
        line = ch;
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }

  // ====================================================================
  // 触摸处理
  // ====================================================================

  /** v7：检测点击位置命中的图谱节点，返回 codexId 或 null */
  private hitTestGraphNode(x: number, y: number, screenW: number, screenH: number): string | null {
    const centerY = 56 + (screenH - 56) / 2;
    const centerX = screenW / 2;
    const radius = Math.min(screenW, screenH - 56) * 0.32;
    const nodes = KNOWLEDGE_GRAPH;
    for (let i = 0; i < nodes.length; i++) {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const nx = centerX + Math.cos(angle) * radius;
      const ny = centerY + Math.sin(angle) * radius * 0.7;
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy <= 24 * 24) {
        return nodes[i].codexId;
      }
    }
    return null;
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    // 详情面板打开时优先处理
    if (this.selectedEntry) {
      if (type === "start") {
        const rect = this.getDetailRect(screenW, screenH);
        const closeBtn: Rect = { x: rect.x + rect.w - 36, y: rect.y + 8, w: 28, h: 28 };
        if (hitTest(x, y, closeBtn)) {
          this.pressedButton = "close";
          return true;
        }
        return true; // 消费所有触摸，禁止穿透
      } else if (type === "end") {
        if (this.pressedButton === "close") {
          const rect = this.getDetailRect(screenW, screenH);
          const closeBtn: Rect = { x: rect.x + rect.w - 36, y: rect.y + 8, w: 28, h: 28 };
          if (hitTest(x, y, closeBtn)) {
            this.selectedEntry = null;
            playSfx("click");
            vibrateShort();
          }
          this.pressedButton = null;
          return true;
        }
        // 点击遮罩外区域关闭
        const rect = this.getDetailRect(screenW, screenH);
        if (!hitTest(x, y, rect)) {
          this.selectedEntry = null;
          playSfx("click");
        }
        return true;
      }
      return true;
    }

    if (type === "start") {
      // 返回按钮
      if (hitTest(x, y, this.getBackBtnRect())) {
        this.pressedButton = "back";
        return true;
      }
      // Tab 切换（v7：含第 4 Tab 知识图谱）
      const categories: CodexCategory[] = ["enemy", "agent", "case"];
      for (let i = 0; i < categories.length; i++) {
        if (hitTest(x, y, this.getTabRect(i, screenW))) {
          this.pressedButton = `tab-${i}`;
          return true;
        }
      }
      if (hitTest(x, y, this.getTabRect(3, screenW))) {
        this.pressedButton = "tab-graph";
        return true;
      }
      // v7：口诀 Tab（idx=4）/ v10：系统 Tab（idx=5）
      if (hitTest(x, y, this.getTabRect(4, screenW))) {
        this.pressedButton = "tab-terms";
        return true;
      }
      if (hitTest(x, y, this.getTabRect(5, screenW))) {
        this.pressedButton = "tab-systems";
        return true;
      }
      // v7：图谱视图下的节点点击
      if (this.viewMode === "graph") {
        const nodeHit = this.hitTestGraphNode(x, y, screenW, screenH);
        if (nodeHit) {
          this.pressedGraphNode = nodeHit;
          return true;
        }
        return false; // 图谱视图不滚动
      }
      // 卡片点击
      const entries = this.getEntries();
      const unlocked = this.getUnlockedIds();
      for (let i = 0; i < entries.length; i++) {
        const rect = this.getCardRect(i, screenW);
        const screenRect = { x: rect.x, y: rect.y - this.scrollY, w: rect.w, h: rect.h };
        if (hitTest(x, y, screenRect)) {
          if (unlocked.has(entries[i].id)) {
            this.pressedButton = `card-${i}`;
          } else {
            this.pressedButton = `card-locked-${i}`;
          }
          return true;
        }
      }
      // 否则视为滚动起点
      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      this.isDragging = true;
      return false;
    } else if (type === "move") {
      if (this.isDragging && this.viewMode === "grid") {
        const dy = y - this.dragStartY;
        const maxScroll = Math.max(0, this.contentH - (screenH - 56));
        this.scrollY = Math.max(0, Math.min(maxScroll, this.dragStartScroll - dy));
      }
      return false;
    } else if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;
      if (pressed === "back") {
        playSfx("click");
        this.director.pop();
        return true;
      }
      if (pressed === "tab-graph") {
        if (hitTest(x, y, this.getTabRect(3, screenW))) {
          if (this.viewMode !== "graph") {
            this.viewMode = "graph";
            this.selectedGraphNode = null;
            this.scrollY = 0;
            playSfx("click");
            vibrateShort();
          }
        }
        return true;
      }
      if (pressed === "tab-terms") {
        if (hitTest(x, y, this.getTabRect(4, screenW))) {
          if (this.viewMode !== "terms") {
            this.viewMode = "terms";
            this.scrollY = 0;
            playSfx("click");
            vibrateShort();
          }
        }
        return true;
      }
      if (pressed === "tab-systems") {
        if (hitTest(x, y, this.getTabRect(5, screenW))) {
          if (this.viewMode !== "systems") {
            this.viewMode = "systems";
            this.scrollY = 0;
            playSfx("click");
            vibrateShort();
          }
        }
        return true;
      }
      if (pressed?.startsWith("tab-")) {
        const idx = parseInt(pressed.split("-")[1]);
        const categories: CodexCategory[] = ["enemy", "agent", "case"];
        if (hitTest(x, y, this.getTabRect(idx, screenW))) {
          if (this.category !== categories[idx] || this.viewMode !== "grid") {
            this.category = categories[idx];
            this.viewMode = "grid";
            this.scrollY = 0;
            playSfx("click");
            vibrateShort();
          }
        }
        return true;
      }
      // v7：图谱节点点击
      if (this.pressedGraphNode && this.viewMode === "graph") {
        const nodeHit = this.hitTestGraphNode(x, y, screenW, screenH);
        if (nodeHit === this.pressedGraphNode) {
          this.selectedGraphNode = this.selectedGraphNode === nodeHit ? null : nodeHit;
          playSfx("click");
          vibrateShort();
        }
        this.pressedGraphNode = null;
        return true;
      }
      if (pressed?.startsWith("card-")) {
        const idx = parseInt(pressed.split("-")[1]);
        const entries = this.getEntries();
        const unlocked = this.getUnlockedIds();
        if (idx < entries.length && unlocked.has(entries[idx].id)) {
          const rect = this.getCardRect(idx, screenW);
          const screenRect = { x: rect.x, y: rect.y - this.scrollY, w: rect.w, h: rect.h };
          if (hitTest(x, y, screenRect)) {
            this.selectedEntry = entries[idx];
            playSfx("click");
            vibrateShort();
          }
        }
        return true;
      }
      this.isDragging = false;
      return false;
    }
    return false;
  }
}
