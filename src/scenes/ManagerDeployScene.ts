/**
 * 「反诈职业经理人」部署阶段
 * 纯 Canvas UI，无引擎。6 探员卡片 + 3×3 战位网格 + 开始战斗
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawHudLabel, drawScanlineOverlay,
  hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { AGENTS, ENEMIES, WAVES } from "@/games/manager/data";
import type { DeploySlot } from "@/games/manager/types";
import { playSfx } from "@/engine/Audio";
import { vibrateShort } from "@/platform/web";
import { setOrientation } from "@/platform/web";
import { ManagerBattleScene } from "./ManagerBattleScene";

const GRID_ROWS = 3;
const GRID_COLS = 3;

export class ManagerDeployScene extends Scene {
  private selectedAgentIdx: number | null = null;
  private slots: DeploySlot[] = [];
  private pressedButton: string | null = null;
  private scrollY = 0;

  enter(): void {
    super.enter();
    this.selectedAgentIdx = null;
    this.slots = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        this.slots.push({ row: r, col: c, agentId: null });
      }
    }
  }

  update(dt: number): void {
    super.update(dt);
  }

  private getPlacedCount(): number {
    return this.slots.filter((s) => s.agentId).length;
  }

  private getAgentCardRect(idx: number, screenW: number): Rect {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cardW = (screenW - 16 * 4) / 3;
    const cardH = 96;
    const x = 16 + col * (cardW + 8);
    const y = 120 + row * (cardH + 8) - this.scrollY;
    return { x, y, w: cardW, h: cardH };
  }

  private getGridCellRect(row: number, col: number, screenW: number): Rect {
    const gridW = Math.min(280, screenW - 32);
    const cellSize = (gridW - 8 * 2) / 3;
    const gx = (screenW - gridW) / 2;
    const gy = 340 - this.scrollY;
    return {
      x: gx + col * (cellSize + 8),
      y: gy + row * (cellSize + 8),
      w: cellSize,
      h: cellSize,
    };
  }

  private getStartButtonRect(screenW: number, screenH: number): Rect {
    return { x: 16, y: screenH - 24 - 48 - 12, w: screenW - 32, h: 48 };
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    // 顶部导航
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
    ctx.fillText("反诈职业经理人 · 部署", screenW / 2, 24);
    ctx.restore();

    // 描述
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("选择探员 → 点击战位部署 · 6 名全部署后开始战斗", screenW / 2, 56);
    ctx.restore();

    // 探员卡片
    for (let i = 0; i < AGENTS.length; i++) {
      this.renderAgentCard(ctx, i, screenW);
    }

    // 战位网格
    this.renderGrid(ctx, screenW);

    // 敌方情报
    this.renderIntel(ctx, screenW, screenH);

    // 开始战斗按钮
    const placed = this.getPlacedCount();
    const ready = placed === 6;
    const startBtn = this.getStartButtonRect(screenW, screenH);
    drawButton(ctx, startBtn.x, startBtn.y, startBtn.w, startBtn.h, "开始战斗", {
      variant: ready ? "primary" : "ghost",
      accent: Theme.accents.manager,
      pressed: this.pressedButton === "start",
      subText: ready ? "ENTER BATTLE" : `${placed}/6 已部署`,
    });

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderAgentCard(ctx: CanvasRenderingContext2D, idx: number, screenW: number): void {
    const agent = AGENTS[idx];
    const rect = this.getAgentCardRect(idx, screenW);
    if (rect.y + rect.h < 48 || rect.y > screenW + 100) return;
    const selected = this.selectedAgentIdx === idx;
    const placed = this.slots.some((s) => s.agentId === agent.id);

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: selected ? agent.color : withAlpha(Theme.colors.bg.line, 0.5),
      borderWidth: selected ? 2 : 1,
    });

    // emoji
    ctx.save();
    ctx.font = `28px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(agent.emoji, rect.x + rect.w / 2, rect.y + 8);
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = agent.color;
    ctx.fillText(agent.name, rect.x + rect.w / 2, rect.y + 42);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(agent.role, rect.x + rect.w / 2, rect.y + 58);
    ctx.font = `400 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = placed ? Theme.colors.safe.DEFAULT : withAlpha(Theme.colors.ink.muted, 0.7);
    ctx.fillText(placed ? "已部署" : `ATK ${agent.attack}`, rect.x + rect.w / 2, rect.y + 74);
    ctx.restore();

    if (selected) {
      ctx.save();
      ctx.strokeStyle = agent.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = agent.color;
      ctx.shadowBlur = 12;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  }

  private renderGrid(ctx: CanvasRenderingContext2D, screenW: number): void {
    const gridW = Math.min(280, screenW - 32);
    const gx = (screenW - gridW) / 2;
    const gy = 340 - this.scrollY;

    drawHudLabel(ctx, gx, gy - 18, "战位部署 · 3×3", Theme.colors.ink.muted);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = this.getGridCellRect(r, c, screenW);
        const slot = this.slots[r * GRID_COLS + c];
        const agent = slot.agentId ? AGENTS.find((a) => a.id === slot.agentId) : null;

        drawPanel(ctx, cell.x, cell.y, cell.w, cell.h, {
          borderColor: agent ? withAlpha(agent.color, 0.5) : Theme.colors.bg.line,
          bgColor: agent ? withAlpha(agent.color, 0.08) : Theme.colors.bg.card,
        });

        if (agent) {
          ctx.save();
          ctx.font = `24px ${Theme.fonts.body}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(agent.emoji, cell.x + cell.w / 2, cell.y + cell.h / 2);
          ctx.restore();
        } else {
          ctx.save();
          ctx.font = `400 20px ${Theme.fonts.mono}`;
          ctx.fillStyle = Theme.colors.ink.dim;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("+", cell.x + cell.w / 2, cell.y + cell.h / 2);
          ctx.restore();
        }
      }
    }
  }

  private renderIntel(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const y = 340 - this.scrollY + 280 + 16;
    if (y > screenH - 24 - 48 - 20) return;
    const w = screenW - 32;
    drawPanel(ctx, 16, y, w, 64, { borderColor: withAlpha(Theme.colors.warn.DEFAULT, 0.3) });
    drawIcon(ctx, "alert", 24, y + 8, 14, Theme.colors.warn.DEFAULT);
    drawHudLabel(ctx, 42, y + 10, "敌方情报 · 杀猪盘军团", Theme.colors.warn.DEFAULT);
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let yy = y + 28;
    for (let i = 0; i < Math.min(3, WAVES.length); i++) {
      const types = Array.from(new Set(WAVES[i].enemies.map((e) => ENEMIES[e.typeId]?.name).filter(Boolean)));
      ctx.fillText(`第 ${i + 1} 波：${types.join(" / ")}`, 24, yy);
      yy += 14;
    }
    ctx.restore();
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    if (type === "start") {
      // 返回
      if (hitTest(x, y, { x: 8, y: 8, w: 56, h: 32 })) {
        this.pressedButton = "back";
        return true;
      }
      // 开始战斗
      if (hitTest(x, y, this.getStartButtonRect(screenW, screenH))) {
        this.pressedButton = "start";
        return true;
      }
      // 探员卡片
      for (let i = 0; i < AGENTS.length; i++) {
        if (hitTest(x, y, this.getAgentCardRect(i, screenW))) {
          this.pressedButton = `agent-${i}`;
          return true;
        }
      }
      // 网格
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (hitTest(x, y, this.getGridCellRect(r, c, screenW))) {
            this.pressedButton = `cell-${r}-${c}`;
            return true;
          }
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
      if (pressed === "start" && hitTest(x, y, this.getStartButtonRect(screenW, screenH))) {
        if (this.getPlacedCount() === 6) {
          playSfx("click");
          vibrateShort();
          setOrientation("landscape");
          const battleScene = new ManagerBattleScene(this.director);
          this.director.replace(battleScene, { deployment: this.slots });
        }
        return true;
      }
      if (pressed?.startsWith("agent-")) {
        const idx = parseInt(pressed.split("-")[1]);
        if (hitTest(x, y, this.getAgentCardRect(idx, screenW))) {
          const agent = AGENTS[idx];
          const placed = this.slots.some((s) => s.agentId === agent.id);
          if (!placed) {
            this.selectedAgentIdx = this.selectedAgentIdx === idx ? null : idx;
          }
          playSfx("click");
        }
        return true;
      }
      if (pressed?.startsWith("cell-")) {
        const [r, c] = pressed.split("-").slice(1).map(Number);
        if (hitTest(x, y, this.getGridCellRect(r, c, screenW))) {
          const slot = this.slots[r * GRID_COLS + c];
          if (slot.agentId) {
            // 撤回
            slot.agentId = null;
            playSfx("click");
          } else if (this.selectedAgentIdx !== null) {
            slot.agentId = AGENTS[this.selectedAgentIdx].id;
            this.selectedAgentIdx = null;
            playSfx("click");
            vibrateShort();
          }
        }
        return true;
      }
      return false;
    }
    return false;
  }
}
