/**
 * 「炸岛」战斗场景
 * 引擎画布 960×540 横屏，进入时 setOrientation("landscape")
 * 引擎 InputManager 处理弹弓拖拽，Scene 负责武器选择器（consumedTouchIds 防冲突）
 */
import { GameShellScene } from "./GameShellScene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawButton, drawToast, hitTest, type Rect } from "@/ui/widgets";
import { BombIslandEngine } from "@/games/bombIsland/engine";
import type { BombHud, WeaponId } from "@/games/bombIsland/types";
import { WEAPONS, LEVELS } from "@/games/bombIsland/data";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ResultOverlay } from "./ResultOverlay";
import { HubScene } from "./HubScene";
import type { GameEvent, GameResultPayload } from "@/types";

export class BombIslandBattleScene extends GameShellScene {
  private engine: BombIslandEngine | null = null;
  private engineCanvas: { width: number; height: number; getContext(c: string): CanvasRenderingContext2D } | null = null;
  private levelIdx = 0;
  private unlockedWeapons: WeaponId[] = ["basic"];
  private hud: BombHud | null = null;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  private toastTimer = 0;
  private resultOverlay: ResultOverlay | null = null;
  private unsub: (() => void) | null = null;
  private pressedWeapon: WeaponId | null = null;
  private t = 0;

  getGameTitle(): string { return LEVELS[this.levelIdx]?.name ?? "炸岛"; }
  getGameSubtitle(): string { return "BOMB ISLAND"; }
  getAccent(): string { return Theme.accents["bomb-island"]; }

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    this.levelIdx = (params?.levelIdx as number) ?? 0;
    this.unlockedWeapons = (params?.unlocked as WeaponId[]) ?? ["basic"];
    setOrientation("landscape");
    this.spawnEngine();
  }

  private spawnEngine(): void {
    const canvas = this.director.createOffscreenCanvas();
    this.engineCanvas = canvas;
    const engine = new BombIslandEngine(canvas, this.levelIdx, this.unlockedWeapons);
    this.engine = engine;
    this.unsub = engine.on((e: GameEvent) => this.onEngineEvent(e));
    engine.start();
  }

  private onEngineEvent(e: GameEvent): void {
    if (e.type === "hud") {
      this.hud = e.payload as unknown as BombHud;
    } else if (e.type === "toast") {
      this.toast = { text: e.text, tone: e.tone, until: this.t + 3 };
      this.toastTimer = 0;
    } else if (e.type === "result") {
      this.onResult(e.payload);
    }
  }

  private onResult(result: GameResultPayload): void {
    const hasNext = this.levelIdx + 1 < LEVELS.length;
    this.resultOverlay = new ResultOverlay(this.director, result, {
      onRetry: () => this.retry(),
      onBack: () => this.director.replace(new HubScene(this.director)),
      onNext: hasNext ? () => this.nextLevel() : undefined,
      nextLabel: hasNext ? "下一关" : undefined,
    });
  }

  private retry(): void {
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.spawnEngine();
  }

  private nextLevel(): void {
    const unlocked = this.engine?.getUnlocked() ?? this.unlockedWeapons;
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.resultOverlay = null;
    this.hud = null;
    this.toast = null;
    this.levelIdx += 1;
    this.unlockedWeapons = unlocked;
    this.spawnEngine();
  }

  protected updateGame(dt: number): void {
    this.t += dt;
    if (this.toast) {
      this.toastTimer += dt;
      if (this.toastTimer > 3) this.toast = null;
    }
    if (this.resultOverlay) this.resultOverlay.update(dt);
  }

  private getWeaponButtonRect(idx: number, screenW: number, screenH: number): Rect {
    const weaponIds: WeaponId[] = ["basic", "fire", "bunker", "cluster"];
    const btnW = 64;
    const btnH = 48;
    const totalW = btnW * 4 + 8 * 3;
    const startX = (screenW - totalW) / 2;
    return { x: startX + idx * (btnW + 8), y: screenH - 24 - btnH - 12, w: btnW, h: btnH };
  }

  protected renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (this.engineCanvas && this.engine) {
      this.director.blitContain(this.engineCanvas, ctx, screenW, screenH);
    }

    // 顶部状态
    if (this.hud) {
      this.renderStats(ctx, screenW);
    }

    // 武器选择器
    this.renderWeaponSelector(ctx, screenW, screenH);

    // Toast
    if (this.toast) {
      const tw = screenW - 32;
      const th = 48;
      const ty = 56;
      drawToast(ctx, 16, ty, tw, th, this.toast.text, this.toast.tone, "炮兵通讯");
    }

    // 结算
    if (this.resultOverlay) {
      this.resultOverlay.render(ctx, screenW, screenH);
    }
  }

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const hud = this.hud!;
    const y = 52;
    ctx.save();
    // 关卡
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("LEVEL", 16, y);
    ctx.font = `700 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.getAccent();
    ctx.fillText(`${hud.level}/${hud.totalLevels}`, 16, y + 14);
    // 弹药
    ctx.fillText(`弹药 ${hud.ammo}`, 60, y + 16);
    // 建筑
    ctx.fillText(`目标 ${hud.buildingsLeft}/${hud.buildingsTotal}`, 130, y + 16);
    // 摧毁率
    ctx.fillText(`摧毁 ${Math.round(hud.destroyRate * 100)}%`, 230, y + 16);
    // 分数
    ctx.textAlign = "right";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("SCORE", screenW - 16, y);
    ctx.font = `700 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = this.getAccent();
    ctx.shadowColor = withAlpha(this.getAccent(), 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(`${hud.score}`, screenW - 16, y + 14);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private renderWeaponSelector(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const weaponIds: WeaponId[] = ["basic", "fire", "bunker", "cluster"];
    for (let i = 0; i < weaponIds.length; i++) {
      const wid = weaponIds[i];
      const weapon = WEAPONS[wid];
      const rect = this.getWeaponButtonRect(i, screenW, screenH);
      const unlocked = this.hud?.unlocked.includes(wid) ?? this.unlockedWeapons.includes(wid);
      const isCurrent = this.hud?.weapon === wid;

      drawButton(ctx, rect.x, rect.y, rect.w, rect.h, "", {
        variant: isCurrent ? "primary" : unlocked ? "hard" : "ghost",
        accent: weapon.color,
        pressed: this.pressedWeapon === wid,
      });
      if (!unlocked && !isCurrent) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      }
      ctx.save();
      ctx.font = `18px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = unlocked ? 1 : 0.4;
      ctx.fillText(weapon.emoji, rect.x + rect.w / 2, rect.y + 16);
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = isCurrent ? "#0A1929" : unlocked ? weapon.color : Theme.colors.ink.dim;
      ctx.fillText(weapon.name, rect.x + rect.w / 2, rect.y + 34);
      ctx.restore();
    }
  }

  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.resultOverlay) {
      return this.resultOverlay.handleTouch(type, x, y);
    }
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const weaponIds: WeaponId[] = ["basic", "fire", "bunker", "cluster"];

    if (type === "start") {
      for (let i = 0; i < weaponIds.length; i++) {
        const rect = this.getWeaponButtonRect(i, screenW, screenH);
        if (hitTest(x, y, rect)) {
          this.pressedWeapon = weaponIds[i];
          return true; // 消费 touch，防止 InputManager 拖拽
        }
      }
      return false; // 交给引擎处理弹弓拖拽
    } else if (type === "end") {
      if (this.pressedWeapon) {
        const idx = weaponIds.indexOf(this.pressedWeapon);
        const rect = this.getWeaponButtonRect(idx, screenW, screenH);
        if (hitTest(x, y, rect)) {
          this.engine?.setWeapon(this.pressedWeapon);
          playSfx("click");
          vibrateShort();
        }
      }
      this.pressedWeapon = null;
      return true;
    }
    return false;
  }

  exit(): void {
    super.exit();
    setOrientation("portrait");
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.engineCanvas = null;
    this.resultOverlay = null;
  }
}
