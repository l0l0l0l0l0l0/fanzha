/**
 * 「炸岛」选关场景
 * 纯 Canvas UI，3 关卡卡片 + 武器库展示
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawHudLabel, drawScanlineOverlay,
  hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { LEVELS, WEAPONS } from "@/games/bombIsland/data";
import type { WeaponId } from "@/games/bombIsland/types";
import { playSfx } from "@/engine/Audio";
import { platformStore } from "@/store/platformStore";
import { BombIslandBattleScene } from "./BombIslandBattleScene";

export class BombIslandSelectScene extends Scene {
  private pressedButton: string | null = null;
  private unlockedWeapons: WeaponId[] = ["basic"];

  enter(): void {
    super.enter();
    // 从存储恢复已解锁武器（根据最高分推断）
    const best = platformStore.state.bestScores["bomb-island"] || 0;
    this.unlockedWeapons = ["basic"];
    if (best > 200) this.unlockedWeapons.push("fire");
    if (best > 500) this.unlockedWeapons.push("bunker");
    if (best > 1000) this.unlockedWeapons.push("cluster");
  }

  update(dt: number): void {
    super.update(dt);
  }

  private getLevelCardRect(idx: number, screenW: number): Rect {
    const w = screenW - 32;
    const h = 120;
    const x = 16;
    const y = 120 + idx * (h + 12);
    return { x, y, w, h };
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

    const backBtn: Rect = { x: 8, y: 8, w: 56, h: 32 };
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted, pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 12, backBtn.y + 8, 16, Theme.colors.ink.muted);

    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.accents["bomb-island"];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(Theme.accents["bomb-island"], 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("炸岛 · 作战选关", screenW / 2, 24);
    ctx.restore();

    // 关卡卡片
    for (let i = 0; i < LEVELS.length; i++) {
      this.renderLevelCard(ctx, i, screenW);
    }

    // 武器库
    this.renderArsenal(ctx, screenW);

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderLevelCard(ctx: CanvasRenderingContext2D, idx: number, screenW: number): void {
    const level = LEVELS[idx];
    const rect = this.getLevelCardRect(idx, screenW);
    const accent = Theme.accents["bomb-island"];
    const isCompleted = this.isLevelCompleted(idx);

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: withAlpha(accent, 0.4),
      borderWidth: isCompleted ? 2 : 1,
    });

    // 关卡编号
    ctx.save();
    ctx.fillStyle = withAlpha(accent, 0.12);
    ctx.fillRect(rect.x, rect.y, 56, rect.h);
    ctx.font = `700 28px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(`${idx + 1}`, rect.x + 28, rect.y + rect.h / 2);
    ctx.restore();

    // 名称
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(level.name, rect.x + 68, rect.y + 12);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(level.subtitle, rect.x + 68, rect.y + 32);
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
    this.drawWrapped(ctx, level.briefing, rect.x + 68, rect.y + 48, rect.w - 80, 14);
    ctx.restore();

    // 属性
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`弹药 ${level.ammo} · 建筑 ${level.buildings.length}`, rect.x + rect.w - 12, rect.y + 12);
    if (level.unlockWeapon) {
      ctx.fillStyle = Theme.colors.flag.DEFAULT;
      ctx.fillText(`解锁 ${WEAPONS[level.unlockWeapon].name}`, rect.x + rect.w - 12, rect.y + 28);
    }
    if (isCompleted) {
      drawIcon(ctx, "check", rect.x + rect.w - 24, rect.y + rect.h - 24, 16, Theme.colors.safe.DEFAULT);
    }
    ctx.restore();
  }

  private renderArsenal(ctx: CanvasRenderingContext2D, screenW: number): void {
    const y = 120 + LEVELS.length * 132 + 8;
    const w = screenW - 32;
    const h = 80;
    drawPanel(ctx, 16, y, w, h, { borderColor: withAlpha(Theme.colors.flag.DEFAULT, 0.3) });
    drawIcon(ctx, "bomb", 24, y + 8, 14, Theme.colors.flag.DEFAULT);
    drawHudLabel(ctx, 42, y + 10, "武器库 · ARSENAL", Theme.colors.flag.DEFAULT);

    const weaponIds: WeaponId[] = ["basic", "fire", "bunker", "cluster"];
    const cellW = (w - 32) / 4;
    for (let i = 0; i < weaponIds.length; i++) {
      const weapon = WEAPONS[weaponIds[i]];
      const wx = 16 + 16 + i * cellW;
      const wy = y + 30;
      const unlocked = this.unlockedWeapons.includes(weaponIds[i]);

      ctx.save();
      ctx.font = `20px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.globalAlpha = unlocked ? 1 : 0.3;
      ctx.fillText(weapon.emoji, wx + cellW / 2, wy);
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = unlocked ? weapon.color : Theme.colors.ink.dim;
      ctx.fillText(weapon.name, wx + cellW / 2, wy + 26);
      if (!unlocked) {
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.fillText("未解锁", wx + cellW / 2, wy + 40);
      }
      ctx.restore();
    }
  }

  private drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
    const chars = text.split("");
    let line = "";
    let yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = ch;
        yy += lh;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  private isLevelCompleted(idx: number): boolean {
    // 简单推断：最高分超过关卡阈值视为通关
    const best = platformStore.state.bestScores["bomb-island"] || 0;
    return best > (idx + 1) * 200;
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    const screenW = this.director.screenWidth;

    if (type === "start") {
      if (hitTest(x, y, { x: 8, y: 8, w: 56, h: 32 })) {
        this.pressedButton = "back";
        return true;
      }
      for (let i = 0; i < LEVELS.length; i++) {
        if (hitTest(x, y, this.getLevelCardRect(i, screenW))) {
          this.pressedButton = `level-${i}`;
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
      if (pressed?.startsWith("level-")) {
        const idx = parseInt(pressed.split("-")[1]);
        if (hitTest(x, y, this.getLevelCardRect(idx, screenW))) {
          playSfx("click");
          const battleScene = new BombIslandBattleScene(this.director);
          this.director.replace(battleScene, { levelIdx: idx, unlocked: this.unlockedWeapons });
        }
        return true;
      }
      return false;
    }
    return false;
  }
}
