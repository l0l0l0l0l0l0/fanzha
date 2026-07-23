/**
 * 「反诈职业经理人」部署阶段（v4 迷宫版）
 * 横屏 Canvas UI：5 模式选择 + 迷宫地图渲染 + 路径旁岗哨位自由部署 + 6 探员卡片
 * - 复用 maze.ts 的 MazeDef，渲染路径格子、岗哨位、入口/出口标记
 * - 探员可放置在任意岗哨位（路径相邻的非路径格）
 * - 一键布阵：按射程智能分配到路径前/中/后段岗哨位
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawProgressBar, drawScanlineOverlay,
  hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { AGENTS, MODE_META, dailyModifiersForSeed, ELEMENTS } from "@/games/manager/data";
import type { DeploySlot, ManagerMode } from "@/games/manager/types";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ManagerBattleScene } from "./ManagerBattleScene";
import {
  getInitialMaze, generateMaze,
  MAZE_CELL, MAZE_COLS, MAZE_ROWS,
  type MazeDef, type DeployTile,
} from "@/games/manager/maze";

/** 5 种模式按 UI 顺序排列（经典置首，每日挑战殿后） */
const MODE_ORDER: ManagerMode[] = ["classic", "timeTrial", "bossRush", "endlessRush", "daily"];

/** 6 探员中各属性的最大值，用于属性条归一化 */
const MAX_HP = Math.max(...AGENTS.map((a) => a.hp));

/** 迷宫渲染度量（运行时按屏幕动态计算） */
interface MazeMetrics {
  cell: number;
  offsetX: number;
  offsetY: number;
  mazeW: number;
  mazeH: number;
}

export class ManagerDeployScene extends Scene {
  private selectedAgentIdx: number | null = null;
  /** 已部署槽位（迷宫网格坐标 col/row） */
  private slots: DeploySlot[] = [];
  private pressedButton: string | null = null;
  private mode: ManagerMode = "classic";
  private maze: MazeDef | null = null;
  private dailySeed = "";

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.selectedAgentIdx = null;
    this.slots = [];
    this.dailySeed = this.getDailySeed();
    this.maze = this.buildMazeForMode(this.mode);
  }

  /** 每日挑战种子：YYYY-MM-DD */
  private getDailySeed(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /** 按当前模式构建迷宫预览（与 engine 启动时一致） */
  private buildMazeForMode(mode: ManagerMode): MazeDef {
    if (mode === "endlessRush") {
      // 部署阶段用固定种子预览，开战时引擎会用新种子再生成
      return generateMaze(`deploy-${this.dailySeed}`, "#B388FF");
    }
    return getInitialMaze(mode, 1, this.dailySeed);
  }

  /** 切换模式时重建迷宫与部署 */
  private switchMode(newMode: ManagerMode): void {
    if (newMode === this.mode) return;
    this.mode = newMode;
    this.maze = this.buildMazeForMode(newMode);
    // 迷宫变更后，原部署的岗哨位可能不存在 → 丢弃已放置探员
    this.slots = [];
    this.selectedAgentIdx = null;
    playSfx("click");
    vibrateShort();
  }

  private getPlacedCount(): number {
    return this.slots.filter((s) => s.agentId).length;
  }

  /** 已放置的探员 id 集合（用于卡片"已部署"标记） */
  private isAgentPlaced(agentId: string): boolean {
    return this.slots.some((s) => s.agentId === agentId);
  }

  /** 查找 col/row 处的部署槽位 */
  private findSlot(col: number, row: number): DeploySlot | undefined {
    return this.slots.find((s) => s.col === col && s.row === row);
  }

  // ====================================================================
  // 布局矩形
  // ====================================================================

  private getModeCardRect(idx: number, screenW: number): Rect {
    const gap = 8;
    const cardW = (screenW - 16 * 2 - gap * 4) / 5;
    const cardH = 56;
    const x = 16 + idx * (cardW + gap);
    const y = 52;
    return { x, y, w: cardW, h: cardH };
  }

  private getStartButtonRect(screenW: number): Rect {
    return { x: screenW - 16 - 110, y: 8, w: 110, h: 32 };
  }

  private getAutoDeployButtonRect(screenW: number): Rect {
    return { x: screenW - 16 - 110 - 8 - 96, y: 8, w: 96, h: 32 };
  }

  /** 探员卡片矩形（底部 1 行 6 列） */
  private getAgentCardRect(idx: number, screenW: number, screenH: number): Rect {
    const rosterH = 64;
    const rosterY = screenH - 28 - rosterH - 8;
    const gap = 6;
    const cardW = (screenW - 32 - gap * 5) / 6;
    const x = 16 + idx * (cardW + gap);
    return { x, y: rosterY, w: cardW, h: rosterH };
  }

  /** 迷宫渲染度量：在 (16, 124) → (screenW-16, screenH-100) 的可用区域内居中适配 */
  private getMazeMetrics(screenW: number, screenH: number): MazeMetrics {
    const topPad = 124;
    const botPad = 100;
    const availW = screenW - 32;
    const availH = screenH - topPad - botPad;
    const cellW = Math.floor(availW / MAZE_COLS);
    const cellH = Math.floor(availH / MAZE_ROWS);
    const cell = Math.max(20, Math.min(cellW, cellH, MAZE_CELL));
    const mazeW = cell * MAZE_COLS;
    const mazeH = cell * MAZE_ROWS;
    const offsetX = Math.floor((screenW - mazeW) / 2);
    const offsetY = topPad + Math.floor((availH - mazeH) / 2);
    return { cell, offsetX, offsetY, mazeW, mazeH };
  }

  // ====================================================================
  // 一键布阵：按射程将 6 探员分配到路径前/中/后段的岗哨位
  // ====================================================================

  private autoDeploy(): void {
    if (!this.maze) return;
    this.slots = [];
    const pathCells = this.maze.pathCells;
    if (pathCells.length === 0) return;

    const usedTiles = new Set<string>();
    // 顺序：短射程放前段，长射程放后段
    const agentOrder: { id: string; pathFrac: number }[] = [
      { id: "chen", pathFrac: 0.10 }, // 潜伏者（160）：入口前线
      { id: "wang", pathFrac: 0.22 }, // 社工师（200，治疗）：前线
      { id: "shen", pathFrac: 0.38 }, // 突击手（220）：中前
      { id: "zhou", pathFrac: 0.55 }, // 技术员（280）：中
      { id: "su",   pathFrac: 0.75 }, // 数据分析师（300）：中后
      { id: "lin",  pathFrac: 0.92 }, // 通讯专家（360）：后卫
    ];

    for (const { id, pathFrac } of agentOrder) {
      const pathIdx = Math.min(pathCells.length - 1, Math.max(0, Math.floor(pathCells.length * pathFrac)));
      const targetCell = pathCells[pathIdx];
      let bestTile: DeployTile | null = null;
      let bestDist = Infinity;
      for (const tile of this.maze.deployTiles) {
        const k = `${tile.col},${tile.row}`;
        if (usedTiles.has(k)) continue;
        const d = Math.abs(tile.col - targetCell.col) + Math.abs(tile.row - targetCell.row);
        if (d < bestDist) { bestDist = d; bestTile = tile; }
      }
      if (bestTile) {
        usedTiles.add(`${bestTile.col},${bestTile.row}`);
        this.slots.push({ col: bestTile.col, row: bestTile.row, agentId: id });
      }
    }

    this.selectedAgentIdx = null;
    playSfx("click");
    vibrateShort();
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
    const backBtn: Rect = { x: 8, y: 8, w: 56, h: 32 };
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "back",
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
    ctx.fillText("反诈职业经理人 · 迷宫部署", screenW / 2, 24);
    ctx.restore();

    // 顶部右侧：一键布阵 + 开战
    const meta = MODE_META[this.mode];
    const ready = this.getPlacedCount() === 6;
    const startBtn = this.getStartButtonRect(screenW);
    drawButton(ctx, startBtn.x, startBtn.y, startBtn.w, startBtn.h, ready ? "▶ 开战" : `部署 ${this.getPlacedCount()}/6`, {
      variant: ready ? "primary" : "ghost",
      accent: meta.accent,
      pressed: this.pressedButton === "start",
      fontSize: 13,
    });
    const autoBtn = this.getAutoDeployButtonRect(screenW);
    drawButton(ctx, autoBtn.x, autoBtn.y, autoBtn.w, autoBtn.h, "一键布阵", {
      variant: "ghost", accent: "#00E5FF",
      pressed: this.pressedButton === "auto",
      fontSize: 12,
    });

    // 模式选择器
    this.renderModeSelector(ctx, screenW);

    // 模式详情
    this.renderModeDetail(ctx, screenW);

    // 迷宫地图（含路径、岗哨位、入口/出口、已部署探员）
    if (this.maze) {
      const metrics = this.getMazeMetrics(screenW, screenH);
      this.renderMaze(ctx, metrics, screenW);
    }

    // 探员卡片（底部一行）
    for (let i = 0; i < AGENTS.length; i++) {
      this.renderAgentCard(ctx, i, screenW, screenH);
    }

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderModeSelector(ctx: CanvasRenderingContext2D, screenW: number): void {
    for (let i = 0; i < MODE_ORDER.length; i++) {
      const m = MODE_ORDER[i];
      const meta = MODE_META[m];
      const rect = this.getModeCardRect(i, screenW);
      const selected = this.mode === m;

      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        borderColor: selected ? meta.accent : withAlpha(Theme.colors.bg.line, 0.5),
        borderWidth: selected ? 2 : 1,
        bgColor: selected ? withAlpha(meta.accent, 0.1) : Theme.colors.bg.card,
      });

      // 顶部色条
      ctx.fillStyle = meta.accent;
      ctx.fillRect(rect.x, rect.y, rect.w, 3);

      ctx.save();
      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = selected ? meta.accent : Theme.colors.ink.DEFAULT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(meta.label, rect.x + rect.w / 2, rect.y + 8);
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = selected ? meta.accent : Theme.colors.ink.muted;
      const tagText = selected && m === "daily" ? this.dailySeed : meta.tagline;
      ctx.fillText(tagText, rect.x + rect.w / 2, rect.y + 26);
      if (selected) {
        ctx.font = `900 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = meta.accent;
        ctx.shadowColor = meta.accent;
        ctx.shadowBlur = 6;
        ctx.fillText("● 已选", rect.x + rect.w / 2, rect.y + 42);
        ctx.shadowBlur = 0;
      } else {
        ctx.font = `400 8px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.fillText("点击切换", rect.x + rect.w / 2, rect.y + 42);
      }
      ctx.restore();
    }
  }

  private renderModeDetail(ctx: CanvasRenderingContext2D, screenW: number): void {
    const meta = MODE_META[this.mode];
    const y = 114;
    ctx.save();
    ctx.font = `500 10px ${Theme.fonts.body}`;
    ctx.textBaseline = "middle";

    if (this.mode === "daily") {
      const mods = dailyModifiersForSeed(this.dailySeed);
      const prefix = "▸ 今日词缀";
      ctx.fillStyle = meta.accent;
      ctx.textAlign = "left";
      ctx.shadowColor = withAlpha(meta.accent, 0.4);
      ctx.shadowBlur = 4;
      ctx.fillText(prefix, 16, y);
      ctx.shadowBlur = 0;
      let cursorX = 16 + ctx.measureText(prefix).width + 8;
      for (let i = 0; i < mods.length; i++) {
        const mod = mods[i];
        const seg = `${mod.emoji} ${mod.name}`;
        ctx.fillStyle = mod.color;
        ctx.fillText(seg, cursorX, y);
        cursorX += ctx.measureText(seg).width + 10;
      }
    } else {
      ctx.fillStyle = meta.accent;
      ctx.textAlign = "left";
      ctx.shadowColor = withAlpha(meta.accent, 0.4);
      ctx.shadowBlur = 4;
      ctx.fillText(`▸ ${meta.desc}`, 16, y);
      ctx.shadowBlur = 0;
    }

    // 历史最高分（右上对齐）
    const progress = platformStore.managerProgress();
    const highScore = progress.modeHighScores[this.mode] ?? 0;
    ctx.fillStyle = meta.accent;
    ctx.textAlign = "right";
    ctx.fillText(`🏆 最高 ${highScore}`, screenW - 16, y);
    ctx.restore();
  }

  /** 渲染迷宫：路径格子 + 岗哨位 + 入口/出口 + 已部署探员 */
  private renderMaze(ctx: CanvasRenderingContext2D, metrics: MazeMetrics, screenW: number): void {
    if (!this.maze) return;
    const { cell, offsetX, offsetY } = metrics;
    const maze = this.maze;
    const t = this.enterT;

    // 迷宫名称（左上角，v5：显示分支图信息）
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = maze.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = maze.accent;
    ctx.shadowBlur = 4;
    ctx.fillText(
      `🗺️ ${maze.name} · 分支 ${maze.nodes.length}节点/${maze.edges.length}边 · 岗哨 ${maze.deployTiles.length}位`,
      16, offsetY - 4,
    );
    ctx.shadowBlur = 0;
    ctx.restore();

    // 选中探员提示（右上角）
    if (this.selectedAgentIdx !== null) {
      const agent = AGENTS[this.selectedAgentIdx];
      ctx.save();
      ctx.font = `500 10px ${Theme.fonts.body}`;
      ctx.fillStyle = agent.color;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = agent.color;
      ctx.shadowBlur = 4;
      ctx.fillText(`已选 ${agent.emoji} ${agent.name} · 点击 + 岗哨位部署`, screenW - 16, offsetY - 4);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 1) 路径格子（道路）
    ctx.fillStyle = "rgba(0, 229, 255, 0.05)";
    for (const c of maze.pathCells) {
      ctx.fillRect(offsetX + c.col * cell, offsetY + c.row * cell, cell, cell);
    }

    // 2) 路径边框（虚线流动）
    ctx.strokeStyle = "rgba(0, 229, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -t * 20;
    for (const c of maze.pathCells) {
      ctx.strokeRect(offsetX + c.col * cell + 2, offsetY + c.row * cell + 2, cell - 4, cell - 4);
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // v5：分支节点标记（junction 用光点突出岔路口，提示玩家敌人会在此分岔）
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    for (const node of maze.nodes) {
      if (node.kind === "entrance" || node.kind === "exit") continue; // 入口出口稍后单独绘制
      const nx = offsetX + node.col * cell + cell / 2;
      const ny = offsetY + node.row * cell + cell / 2;
      ctx.save();
      ctx.fillStyle = withAlpha(maze.accent, 0.25 + pulse * 0.15);
      ctx.beginPath();
      ctx.arc(nx, ny, cell * 0.18 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = maze.accent;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.restore();
    }

    // 3) 岗哨位（可放置守卫）
    for (const tile of maze.deployTiles) {
      const occupied = this.findSlot(tile.col, tile.row);
      const x = offsetX + tile.col * cell;
      const y = offsetY + tile.row * cell;
      if (occupied) continue; // 已占用由下方探员渲染覆盖
      ctx.strokeStyle = "rgba(0, 229, 255, 0.20)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x + 4, y + 4, cell - 8, cell - 8);
      ctx.setLineDash([]);
      // + 提示
      ctx.font = `400 ${Math.max(10, Math.floor(cell * 0.4))}px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", x + cell / 2, y + cell / 2);
    }

    // 4) 入口标记（诈骗窝点）
    const entX = offsetX + maze.entrance.col * cell + cell / 2;
    const entY = offsetY + maze.entrance.row * cell + cell / 2;
    ctx.save();
    ctx.fillStyle = `rgba(229,53,59,${0.18 + pulse * 0.12})`;
    ctx.beginPath();
    ctx.arc(entX, entY, cell * 0.4 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#E5353B";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `${Math.max(12, Math.floor(cell * 0.5))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚠️", entX, entY);
    ctx.restore();
    ctx.save();
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#E5353B";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "#E5353B";
    ctx.shadowBlur = 4;
    ctx.fillText("入口", entX, entY - cell * 0.55);
    ctx.restore();

    // 5) 出口标记（反诈基地）
    const exitX = offsetX + maze.exit.col * cell + cell / 2;
    const exitY = offsetY + maze.exit.row * cell + cell / 2;
    ctx.save();
    ctx.fillStyle = `rgba(0,229,255,${0.18 + pulse * 0.10})`;
    ctx.beginPath();
    ctx.arc(exitX, exitY, cell * 0.4 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `${Math.max(12, Math.floor(cell * 0.5))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🏛️", exitX, exitY);
    ctx.restore();
    ctx.save();
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 4;
    ctx.fillText("基地", exitX, exitY - cell * 0.55);
    ctx.restore();

    // 6) 已部署探员
    for (const slot of this.slots) {
      const agent = AGENTS.find((a) => a.id === slot.agentId);
      if (!agent) continue;
      const x = offsetX + slot.col * cell + cell / 2;
      const y = offsetY + slot.row * cell + cell / 2;
      const r = cell * 0.4;
      // 光环
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(agent.color, 0.18);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = agent.color;
      ctx.stroke();
      // emoji
      ctx.font = `${Math.max(14, Math.floor(cell * 0.55))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(agent.emoji, x, y);
    }
  }

  /** 探员卡片：紧凑横排，含 emoji/名/属性条/已部署标记/选中态 */
  private renderAgentCard(ctx: CanvasRenderingContext2D, idx: number, screenW: number, screenH: number): void {
    const agent = AGENTS[idx];
    const rect = this.getAgentCardRect(idx, screenW, screenH);
    if (rect.y + rect.h < 48 || rect.y > screenH + 100) return;
    const selected = this.selectedAgentIdx === idx;
    const placed = this.isAgentPlaced(agent.id);

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: selected ? agent.color : withAlpha(Theme.colors.bg.line, 0.5),
      borderWidth: selected ? 2 : 1,
      bgColor: selected ? withAlpha(agent.color, 0.10) : Theme.colors.bg.card,
    });

    // 选中态高亮边框
    if (selected) {
      ctx.save();
      ctx.strokeStyle = agent.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = agent.color;
      ctx.shadowBlur = 12;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.restore();
    }

    // 元素徽章（右上角）
    const elem = ELEMENTS[agent.element];
    ctx.save();
    ctx.font = `400 8px ${Theme.fonts.mono}`;
    const badgeText = `${elem.emoji}${elem.name}`;
    const tw = ctx.measureText(badgeText).width;
    const bw = tw + 8;
    const bh = 11;
    const bx = rect.x + rect.w - bw - 4;
    const by = rect.y + 4;
    drawPanel(ctx, bx, by, bw, bh, {
      bgColor: withAlpha(elem.color, 0.15),
      borderColor: withAlpha(elem.color, 0.5),
      borderWidth: 1,
      cut: 3,
    });
    ctx.fillStyle = elem.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, bx + bw / 2, by + bh / 2 + 0.5);
    ctx.restore();

    // 已部署 ✓ 标记
    if (placed) {
      drawIcon(ctx, "check", rect.x + 10, rect.y + 6, 10, Theme.colors.safe.DEFAULT);
    }

    // emoji + 名字（左侧）
    ctx.save();
    ctx.font = `20px ${Theme.fonts.body}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(agent.emoji, rect.x + 8, rect.y + rect.h / 2);
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = selected ? agent.color : Theme.colors.ink.DEFAULT;
    ctx.fillText(agent.name, rect.x + 32, rect.y + 16);
    ctx.font = `400 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(agent.role, rect.x + 32, rect.y + 30);
    ctx.restore();

    // mini HP 条 + 大招简写
    const barX = rect.x + 32;
    const barW = Math.max(20, rect.w - 40);
    drawProgressBar(ctx, barX, rect.y + rect.h - 12, barW, 3, agent.hp / MAX_HP, agent.color);
    ctx.save();
    ctx.font = `400 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = selected ? agent.color : Theme.colors.ink.dim;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(agent.ult, rect.x + 32, rect.y + rect.h - 14);
    ctx.restore();
  }

  // ====================================================================
  // 触摸处理
  // ====================================================================

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    if (type === "start") {
      // 返回
      if (hitTest(x, y, { x: 8, y: 8, w: 56, h: 32 })) {
        this.pressedButton = "back";
        return true;
      }
      // 开战
      if (hitTest(x, y, this.getStartButtonRect(screenW))) {
        this.pressedButton = "start";
        return true;
      }
      // 一键布阵
      if (hitTest(x, y, this.getAutoDeployButtonRect(screenW))) {
        this.pressedButton = "auto";
        return true;
      }
      // 模式卡片
      for (let i = 0; i < MODE_ORDER.length; i++) {
        if (hitTest(x, y, this.getModeCardRect(i, screenW))) {
          this.pressedButton = `mode-${i}`;
          return true;
        }
      }
      // 探员卡片
      for (let i = 0; i < AGENTS.length; i++) {
        if (hitTest(x, y, this.getAgentCardRect(i, screenW, screenH))) {
          this.pressedButton = `agent-${i}`;
          return true;
        }
      }
      // 迷宫岗哨位点击
      if (this.maze) {
        const metrics = this.getMazeMetrics(screenW, screenH);
        const col = Math.floor((x - metrics.offsetX) / metrics.cell);
        const row = Math.floor((y - metrics.offsetY) / metrics.cell);
        const k = `${col},${row}`;
        if (this.maze.deploySet.has(k)) {
          this.pressedButton = `tile-${col}-${row}`;
          return true;
        }
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
      if (pressed === "start" && hitTest(x, y, this.getStartButtonRect(screenW))) {
        if (this.getPlacedCount() === 6 && this.maze) {
          playSfx("click");
          vibrateShort();
          setOrientation("landscape");
          const battleScene = new ManagerBattleScene(this.director);
          this.director.replace(battleScene, {
            deployment: this.slots,
            mode: this.mode,
            maze: this.maze,
          });
        }
        return true;
      }
      if (pressed === "auto" && hitTest(x, y, this.getAutoDeployButtonRect(screenW))) {
        this.autoDeploy();
        return true;
      }
      if (pressed?.startsWith("mode-")) {
        const idx = parseInt(pressed.split("-")[1]);
        if (hitTest(x, y, this.getModeCardRect(idx, screenW))) {
          this.switchMode(MODE_ORDER[idx]);
        }
        return true;
      }
      if (pressed?.startsWith("agent-")) {
        const idx = parseInt(pressed.split("-")[1]);
        if (hitTest(x, y, this.getAgentCardRect(idx, screenW, screenH))) {
          const agent = AGENTS[idx];
          if (!this.isAgentPlaced(agent.id)) {
            this.selectedAgentIdx = this.selectedAgentIdx === idx ? null : idx;
          }
          playSfx("click");
        }
        return true;
      }
      if (pressed?.startsWith("tile-")) {
        const [colStr, rowStr] = pressed.split("-").slice(1);
        const col = parseInt(colStr);
        const row = parseInt(rowStr);
        if (this.maze) {
          const metrics = this.getMazeMetrics(screenW, screenH);
          const colNow = Math.floor((x - metrics.offsetX) / metrics.cell);
          const rowNow = Math.floor((y - metrics.offsetY) / metrics.cell);
          if (col === colNow && row === rowNow) {
            this.handleTileClick(col, row);
          }
        }
        return true;
      }
      return false;
    }
    return false;
  }

  /** 岗哨位点击逻辑：放置选中探员 / 撤回已放置探员 */
  private handleTileClick(col: number, row: number): void {
    if (!this.maze) return;
    const k = `${col},${row}`;
    if (!this.maze.deploySet.has(k)) return;
    const existing = this.findSlot(col, row);
    if (existing) {
      // 撤回
      this.slots = this.slots.filter((s) => !(s.col === col && s.row === row));
      playSfx("click");
      vibrateShort();
      return;
    }
    // 放置选中探员
    if (this.selectedAgentIdx === null) return;
    const agent = AGENTS[this.selectedAgentIdx];
    if (this.isAgentPlaced(agent.id)) return; // 已放置过
    this.slots.push({ col, row, agentId: agent.id });
    this.selectedAgentIdx = null;
    playSfx("click");
    vibrateShort();
  }
}
