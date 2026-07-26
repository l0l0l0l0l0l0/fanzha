/**
 * 「反诈职业经理人」剧情战役面板（v7 B4）
 * 横屏 Canvas UI：8 章节关卡序列 + 过场对白 + BOSS 挑战入口
 *
 * - 顶部：返回 + 标题
 * - 主区域：垂直章节列表（8 章），每章显示 序号 / emoji / 标题 / 副标题 / 状态 / 推荐战力
 * - 点击已解锁章节 → 弹出详情面板（过场对白 + 挑战按钮）
 * - "挑战 BOSS" → push ManagerDeployScene（mode=bossRush）
 *
 * 章节完成判定：bossRush 模式下击败对应 BOSS 后由 ManagerBattleScene 自动标记
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawScanlineOverlay,
  drawNeonCorners, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { STORY_CHAPTERS, getUnlockedChapters } from "@/games/manager/data.v7";
import type { StoryChapterDef, DialogueLine } from "@/games/manager/types";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ManagerDeployScene } from "./ManagerDeployScene";

const CARD_H = 64;
const CARD_GAP = 8;
const PAD = 16;

export class ManagerStoryScene extends Scene {
  private pressedButton: string | null = null;
  /** 当前展开详情的章节 id（null 表示无展开） */
  private expandedChapterId: string | null = null;
  private t = 0;

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.expandedChapterId = null;
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
  }

  // ====================================================================
  // 布局
  // ====================================================================

  private getBackBtnRect(): Rect {
    return { x: 8, y: 8, w: 56, h: 32 };
  }

  /** 章节卡片矩形 */
  private getChapterCardRect(idx: number, screenW: number): Rect {
    const w = screenW - PAD * 2;
    return {
      x: PAD,
      y: 56 + idx * (CARD_H + CARD_GAP),
      w,
      h: CARD_H,
    };
  }

  /** 详情面板矩形（居中弹窗） */
  private getDetailRect(screenW: number, screenH: number): Rect {
    const w = Math.min(560, screenW - 64);
    const h = Math.min(420, screenH - 64);
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
  }

  /** 详情面板内"挑战 BOSS"按钮矩形 */
  private getChallengeBtnRect(detail: Rect): Rect {
    const btnW = 160;
    const btnH = 36;
    return {
      x: detail.x + (detail.w - btnW) / 2,
      y: detail.y + detail.h - btnH - 16,
      w: btnW,
      h: btnH,
    };
  }

  /** 详情面板关闭按钮 */
  private getCloseBtnRect(detail: Rect): Rect {
    return { x: detail.x + detail.w - 36, y: detail.y + 8, w: 28, h: 28 };
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
    ctx.fillText("反诈档案 · 剧情战役", screenW / 2, 24);
    ctx.restore();

    // 章节列表
    const completed = platformStore.managerMetaProgress().completedStoryChapters;
    const unlockedChapters = getUnlockedChapters(completed);

    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`// STORY CAMPAIGN · ${completed.length}/${STORY_CHAPTERS.length} 章节已完成`, PAD, 52);
    ctx.restore();

    for (let i = 0; i < STORY_CHAPTERS.length; i++) {
      this.renderChapterCard(ctx, i, STORY_CHAPTERS[i], unlockedChapters, completed, screenW);
    }

    // 详情弹窗
    if (this.expandedChapterId) {
      const chapter = STORY_CHAPTERS.find((c) => c.id === this.expandedChapterId);
      if (chapter) {
        this.renderDetailOverlay(ctx, chapter, completed.includes(chapter.id), screenW, screenH);
      }
    }

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  /** 渲染单个章节卡片 */
  private renderChapterCard(
    ctx: CanvasRenderingContext2D,
    idx: number,
    chapter: StoryChapterDef,
    unlocked: StoryChapterDef[],
    completed: string[],
    screenW: number,
  ): void {
    const rect = this.getChapterCardRect(idx, screenW);
    const isCompleted = completed.includes(chapter.id);
    const isUnlocked = unlocked.some((c) => c.id === chapter.id);
    const isLocked = !isUnlocked;
    const accent = chapter.accent;
    const isExpanded = this.expandedChapterId === chapter.id;

    // 卡片背景
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      bgColor: isLocked ? "rgba(20, 30, 45, 0.4)" : withAlpha(accent, 0.05),
      borderColor: isExpanded ? accent : (isLocked ? withAlpha(Theme.colors.bg.line, 0.3) : withAlpha(accent, 0.4)),
      borderWidth: isExpanded ? 2 : 1,
    });

    // 左侧：序号 + emoji
    ctx.save();
    ctx.font = `900 28px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = isLocked ? "transparent" : withAlpha(accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(isLocked ? "🔒" : chapter.emoji, rect.x + 32, rect.y + rect.h / 2);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 章节序号小字
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`CH.${String(chapter.order).padStart(2, "0")}`, rect.x + 32, rect.y + 4);
    ctx.restore();

    // 中间：标题 + 副标题
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(chapter.title, rect.x + 72, rect.y + 12);
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(chapter.subtitle, rect.x + 72, rect.y + 32);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : withAlpha(Theme.colors.ink.muted, 0.7);
    ctx.fillText(chapter.background, rect.x + 72, rect.y + 48);
    ctx.restore();

    // 右侧：状态徽章 + 推荐战力
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    if (isCompleted) {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✅ 已通关", rect.x + rect.w - 12, rect.y + 20);
    } else if (isLocked) {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText("🔒 未解锁", rect.x + rect.w - 12, rect.y + 20);
    } else {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = accent;
      ctx.fillText("⚔️ 可挑战", rect.x + rect.w - 12, rect.y + 20);
    }
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`推荐战力 ${chapter.recommendedPower}`, rect.x + rect.w - 12, rect.y + 42);
    ctx.restore();
  }

  /** 渲染详情弹窗 */
  private renderDetailOverlay(
    ctx: CanvasRenderingContext2D,
    chapter: StoryChapterDef,
    isCompleted: boolean,
    screenW: number,
    screenH: number,
  ): void {
    const detail = this.getDetailRect(screenW, screenH);
    const accent = chapter.accent;

    // 遮罩
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    // 面板
    drawPanel(ctx, detail.x, detail.y, detail.w, detail.h, {
      bgColor: "rgba(15, 25, 40, 0.96)",
      borderColor: accent,
      borderWidth: 2,
      cut: 10,
    });
    drawNeonCorners(ctx, detail.x, detail.y, detail.w, detail.h, accent, 12, 2, 6);

    // 关闭按钮
    const closeBtn = this.getCloseBtnRect(detail);
    drawButton(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "close",
    });
    drawIcon(ctx, "x", closeBtn.x + 6, closeBtn.y + 6, 16, Theme.colors.ink.muted);

    // 标题区
    ctx.save();
    ctx.font = `900 32px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.5);
    ctx.shadowBlur = 12;
    ctx.fillText(`${chapter.emoji} ${chapter.title}`, detail.x + 20, detail.y + 16);
    ctx.shadowBlur = 0;
    ctx.font = `400 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(`${chapter.subtitle} · ${chapter.background}`, detail.x + 20, detail.y + 56);
    ctx.restore();

    // 对白区域标题：序章
    let dialogueY = detail.y + 84;
    dialogueY = this.renderDialogueSection(ctx, "📖 序章 · 出击前", chapter.prologue, accent, detail.x + 20, dialogueY, detail.w - 40);

    // 如果已通关，展示终章
    if (isCompleted && chapter.epilogue.length > 0) {
      dialogueY += 12;
      dialogueY = this.renderDialogueSection(ctx, "🎬 终章 · 收网后", chapter.epilogue, accent, detail.x + 20, dialogueY, detail.w - 40);
    }

    // 挑战按钮
    const chBtn = this.getChallengeBtnRect(detail);
    const btnLabel = isCompleted ? "🔄 重玩本章" : "⚔️ 挑战 BOSS";
    drawButton(ctx, chBtn.x, chBtn.y, chBtn.w, chBtn.h, btnLabel, {
      variant: "primary",
      accent,
      pressed: this.pressedButton === "challenge",
    });
  }

  /** 渲染一段对白序列（标题 + 多条对白行） */
  private renderDialogueSection(
    ctx: CanvasRenderingContext2D,
    title: string,
    lines: DialogueLine[],
    accent: string,
    x: number,
    y: number,
    w: number,
  ): number {
    // 小标题
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(title, x, y);
    ctx.restore();
    y += 18;

    // 对白行
    const lineH = 22;
    for (const line of lines) {
      // 发言人 + emoji
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.body}`;
      ctx.fillStyle = line.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${line.emoji} ${line.speaker}：`, x, y);
      // 对白文本（截断到剩余宽度）
      const speakerW = ctx.measureText(`${line.emoji} ${line.speaker}：`).width;
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
      const textW = w - speakerW - 8;
      const truncated = truncateText(ctx, line.text, textW);
      ctx.fillText(truncated, x + speakerW + 4, y);
      ctx.restore();
      y += lineH;
    }
    return y;
  }

  // ====================================================================
  // 交互
  // ====================================================================

  handleTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    if (type === "start") {
      this.pressedButton = null;
      // 详情展开时优先处理详情面板
      if (this.expandedChapterId) {
        const detail = this.getDetailRect(screenW, screenH);
        const closeBtn = this.getCloseBtnRect(detail);
        const chBtn = this.getChallengeBtnRect(detail);
        if (hitTest(x, y, closeBtn)) { this.pressedButton = "close"; return true; }
        if (hitTest(x, y, chBtn)) { this.pressedButton = "challenge"; return true; }
        // 点击面板外区域关闭
        if (!hitTest(x, y, detail)) { this.pressedButton = "close"; return true; }
        return true;
      }
      // 返回按钮
      const backBtn = this.getBackBtnRect();
      if (hitTest(x, y, backBtn)) { this.pressedButton = "back"; return true; }
      // 章节卡片
      const completed = platformStore.managerMetaProgress().completedStoryChapters;
      const unlocked = getUnlockedChapters(completed);
      for (let i = 0; i < STORY_CHAPTERS.length; i++) {
        const rect = this.getChapterCardRect(i, screenW);
        if (hitTest(x, y, rect)) {
          const chapter = STORY_CHAPTERS[i];
          const isUnlocked = unlocked.some((c) => c.id === chapter.id);
          if (isUnlocked) {
            this.pressedButton = `chapter-${i}`;
          } else {
            this.pressedButton = `locked-${i}`;
          }
          return true;
        }
      }
      return true;
    } else if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;
      if (!pressed) return true;

      playSfx("click");
      vibrateShort();

      if (pressed === "back") {
        this.director.pop();
        return true;
      }
      if (pressed === "close") {
        this.expandedChapterId = null;
        return true;
      }
      if (pressed === "challenge") {
        // 进入 bossRush 部署界面
        const deploy = new ManagerDeployScene(this.director);
        this.director.push(deploy, { mode: "bossRush" });
        return true;
      }
      if (pressed.startsWith("chapter-")) {
        const idx = parseInt(pressed.slice("chapter-".length), 10);
        const chapter = STORY_CHAPTERS[idx];
        if (chapter) {
          this.expandedChapterId = chapter.id;
        }
        return true;
      }
      if (pressed.startsWith("locked-")) {
        // 锁定章节提示
        playSfx("bad");
        return true;
      }
      return true;
    }
    return true;
  }
}

/** 截断文本到指定宽度（超出加 "…"） */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const test = text.slice(0, mid) + "…";
    if (ctx.measureText(test).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? text.slice(0, lo) + "…" : "…";
}
