/**
 * 游戏外壳场景基类
 * 提供：顶部 HUD 条（返回/标题/暂停/音效）、底部权威条、退出确认 Modal、暂停覆盖层
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawPanel, drawButton, drawModalOverlay, drawScanlineOverlay,
  drawHudLabel, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { playSfx, setMuted } from "@/engine/Audio";
import { platformStore } from "@/store/platformStore";
import { HubScene } from "./HubScene";
import { FxLayer } from "@/engine/fx";
import { onKeyDown, offKeyDown, type KeyListener } from "@/platform/web";

export abstract class GameShellScene extends Scene {
  protected paused = false;
  protected confirmExit = false;
  protected pressedButton: string | null = null;
  /** 外壳动画时钟（秒），用于警灯条等周期动效（子类自有 t 用于游戏逻辑） */
  private shellT = 0;
  /** 全局特效层：子类可通过 this.fx 触发震屏/飘字/闪光/冲击环/粒子爆发 */
  protected fx = new FxLayer();
  private keyCb: KeyListener | null = null;

  abstract getGameTitle(): string;
  abstract getGameSubtitle(): string;
  abstract getAccent(): string;
  protected abstract updateGame(dt: number): void;
  protected abstract renderGame(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void;
  protected handleGameTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean { return false; }

  update(dt: number): void {
    super.update(dt);
    this.shellT += dt;
    this.fx.update(dt);
    if (!this.paused) this.updateGame(dt);
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    ctx.save();
    if (this.fx.shaking) ctx.translate(this.fx.shakeX, this.fx.shakeY);
    this.renderGame(ctx, screenW, screenH);
    ctx.restore();
    this.fx.renderOverlay(ctx, screenW, screenH);
    this.renderTopBar(ctx, screenW);
    this.renderBottomBar(ctx, screenW, screenH);
    drawScanlineOverlay(ctx, screenW, screenH);

    if (this.paused) {
      this.renderPauseOverlay(ctx, screenW, screenH);
    }
    if (this.confirmExit) {
      this.renderExitModal(ctx, screenW, screenH);
    }
  }

  enter(params?: Record<string, unknown>): void {
    super.enter(params);
    this.keyCb = (key: string) => this.onKey(key);
    onKeyDown(this.keyCb);
  }

  exit(): void {
    super.exit();
    if (this.keyCb) { offKeyDown(this.keyCb); this.keyCb = null; }
  }

  /** 全局快捷键：Esc 返回确认 / P 暂停 / M 静音 */
  protected onKey(key: string): void {
    if (key === "Escape") {
      if (!this.confirmExit) { this.confirmExit = true; playSfx("click"); }
    } else if (key === "p" || key === "P") {
      this.paused = !this.paused;
      playSfx("click");
    } else if (key === "m" || key === "M") {
      platformStore.toggleSound();
      setMuted(!platformStore.state.settings.sound);
      playSfx("click");
    }
  }

  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    const accent = this.getAccent();
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.85)";
    ctx.fillRect(0, 0, screenW, 48);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, 47, screenW, 1);
    ctx.restore();

    // 警灯条：左红右蓝交替闪烁（4Hz）
    const phase = Math.floor(this.shellT * 4) % 2 === 0;
    ctx.save();
    const halfW = screenW / 2;
    ctx.fillStyle = phase ? "#E5353B" : "#1B5FCC";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.fillRect(0, 0, halfW, 2);
    ctx.fillStyle = phase ? "#1B5FCC" : "#E5353B";
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(halfW, 0, halfW, 2);
    ctx.restore();

    // 返回按钮
    const backBtn = this.getBackButtonRect(screenW);
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 8, backBtn.y + 8, 16, Theme.colors.ink.muted);

    // 标题
    const titleX = backBtn.x + backBtn.w + 8;
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(this.getGameTitle(), titleX, 18);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(this.getGameSubtitle(), titleX, 34);
    ctx.restore();

    // 暂停按钮
    const pauseBtn = this.getPauseButtonRect(screenW);
    drawButton(ctx, pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "pause",
    });
    drawIcon(ctx, this.paused ? "play" : "pause", pauseBtn.x + 6, pauseBtn.y + 6, 16,
      this.paused ? Theme.colors.neon.DEFAULT : Theme.colors.ink.muted);

    // 音效按钮
    const soundBtn = this.getSoundButtonRect(screenW);
    drawButton(ctx, soundBtn.x, soundBtn.y, soundBtn.w, soundBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "sound",
    });
    drawIcon(
      ctx,
      platformStore.state.settings.sound ? "volumeOn" : "volumeOff",
      soundBtn.x + 6, soundBtn.y + 6, 16,
      platformStore.state.settings.sound ? Theme.colors.neon.DEFAULT : Theme.colors.ink.dim
    );
  }

  private renderBottomBar(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.85)";
    ctx.fillRect(0, screenH - 24, screenW, 24);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, screenH - 24, screenW, 1);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.fillText("96110", 12, screenH - 12);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(" 反诈专线 · ", 12 + 28, screenH - 12);
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.fillText("12321", 12 + 96, screenH - 12);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(" 举报渠道", 12 + 132, screenH - 12);
    ctx.textAlign = "right";
    ctx.fillText("全民反诈 · 天下无诈", screenW - 12, screenH - 12);
    ctx.restore();
  }

  private renderPauseOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawModalOverlay(ctx, screenW, screenH);
    ctx.save();
    ctx.font = `700 32px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 229, 255, 0.5)";
    ctx.shadowBlur = 20;
    ctx.fillText("// PAUSED", screenW / 2, screenH / 2 - 20);
    ctx.shadowBlur = 0;
    ctx.font = `400 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("点击右上角播放按钮继续", screenW / 2, screenH / 2 + 20);
    ctx.restore();
  }

  private renderExitModal(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawModalOverlay(ctx, screenW, screenH);
    const w = Math.min(300, screenW - 32);
    const h = 170;
    const x = (screenW - w) / 2;
    const y = (screenH - h) / 2;
    drawPanel(ctx, x, y, w, h, { borderColor: withAlpha(Theme.colors.warn.DEFAULT, 0.6) });

    drawIcon(ctx, "home", x + 16, y + 16, 18, Theme.colors.warn.DEFAULT);
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("返回 Hub 主页？", x + 42, y + 18);
    ctx.restore();

    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("当前进度将丢失，确定要离开本局游戏吗？", x + 16, y + 52);
    ctx.restore();

    const btnW = (w - 32 - 8) / 2;
    const btnH = 34;
    const btnY = y + h - btnH - 16;
    drawButton(ctx, x + 16, btnY, btnW, btnH, "继续游戏", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "cancel-exit",
    });
    drawButton(ctx, x + 16 + btnW + 8, btnY, btnW, btnH, "返回 Hub", {
      variant: "danger",
      pressed: this.pressedButton === "confirm-exit",
    });
  }

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    if (this.confirmExit) {
      const w = Math.min(300, screenW - 32);
      const h = 170;
      const mx = (screenW - w) / 2;
      const my = (screenH - h) / 2;
      const btnW = (w - 32 - 8) / 2;
      const btnH = 34;
      const btnY = my + h - btnH - 16;
      const cancelRect: Rect = { x: mx + 16, y: btnY, w: btnW, h: btnH };
      const confirmRect: Rect = { x: mx + 16 + btnW + 8, y: btnY, w: btnW, h: btnH };

      if (type === "start") {
        if (hitTest(x, y, cancelRect)) { this.pressedButton = "cancel-exit"; return true; }
        if (hitTest(x, y, confirmRect)) { this.pressedButton = "confirm-exit"; return true; }
        return true;
      } else if (type === "end") {
        if (this.pressedButton === "cancel-exit" && hitTest(x, y, cancelRect)) {
          this.confirmExit = false;
          playSfx("click");
        } else if (this.pressedButton === "confirm-exit" && hitTest(x, y, confirmRect)) {
          playSfx("click");
          this.director.replace(new HubScene(this.director));
        }
        this.pressedButton = null;
        return true;
      }
      return true;
    }

    const backBtn = this.getBackButtonRect(screenW);
    const pauseBtn = this.getPauseButtonRect(screenW);
    const soundBtn = this.getSoundButtonRect(screenW);

    if (type === "start") {
      if (hitTest(x, y, backBtn)) { this.pressedButton = "back"; return true; }
      if (hitTest(x, y, pauseBtn)) { this.pressedButton = "pause"; return true; }
      if (hitTest(x, y, soundBtn)) { this.pressedButton = "sound"; return true; }
      // 未命中 HUD，转发给游戏
      return this.handleGameTouch("start", x, y, touchId);
    } else if (type === "move") {
      return this.handleGameTouch("move", x, y, touchId);
    } else if (type === "end") {
      if (this.pressedButton === "back" && hitTest(x, y, backBtn)) {
        this.confirmExit = true;
        playSfx("click");
        this.pressedButton = null;
        return true;
      }
      if (this.pressedButton === "pause" && hitTest(x, y, pauseBtn)) {
        this.paused = !this.paused;
        playSfx("click");
        this.pressedButton = null;
        return true;
      }
      if (this.pressedButton === "sound" && hitTest(x, y, soundBtn)) {
        platformStore.toggleSound();
        setMuted(!platformStore.state.settings.sound);
        playSfx("click");
        this.pressedButton = null;
        return true;
      }
      this.pressedButton = null;
      return this.handleGameTouch("end", x, y, touchId);
    }
    return false;
  }

  private getBackButtonRect(screenW: number): Rect {
    return { x: 8, y: 8, w: 36, h: 32 };
  }
  private getPauseButtonRect(screenW: number): Rect {
    return { x: screenW - 92, y: 8, w: 36, h: 32 };
  }
  private getSoundButtonRect(screenW: number): Rect {
    return { x: screenW - 48, y: 8, w: 36, h: 32 };
  }
}
