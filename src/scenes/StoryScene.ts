/**
 * 剧情模式场景
 *
 * 关卡树视图：5 章节节点纵向排列，由虚线路径连接。每节点显示章节号、
 * 标题、游戏图标与状态（完成 / 当前 / 锁定）。点击已解锁章节进入对白视图。
 *
 * 对白视图：视觉小说式覆盖层（头像 + 说话人 + 文本框，点击推进），
 * 带打字机效果。intro 走完后显示「开始任务」按钮，启动 BriefingScene。
 *
 * 完成处理：enter() 时检查 platformStore.storyProgress()。若当前章节节点
 * 已在 completedNodes 中，播放 outro 对白，发放奖励，解锁下一章，回到树视图。
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawModalOverlay,
  drawHudLabel, drawNeonCorners, drawGlowBadge, drawProgressRing,
  hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon, type IconName } from "@/ui/icons";
import { STORY_CHAPTERS, type StoryChapter, type StoryDialogue } from "@/data/story";
import { platformStore } from "@/store/platformStore";
import { playSfx, startBGM } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import { ParticleSystem } from "@/engine/Particle";
import { clamp } from "@/engine/Renderer";
import { BriefingScene } from "./BriefingScene";
import type { GameId } from "@/types";

// ============ 布局常量 ============
const TOP_BAR_H = 56;
const PAD = 16;
const NODE_H = 104;
const NODE_GAP = 20;
const ICON_BOX = 56;
const ICON_X_OFFSET = 14;
const LINE_X = PAD + ICON_X_OFFSET + ICON_BOX / 2;

/** 游戏 ID → 图标名映射（GAMES.icon 字段是字符串，需转 IconName） */
const GAME_ICON: Record<GameId, IconName> = {
  "fraud-buster": "shield",
  manager: "users",
  thunder: "lightning",
  "bomb-island": "bomb",
  "quiz-fight": "crosshair",
};

type ViewMode = "tree" | "intro" | "outro";
type ChapterStatus = "completed" | "current" | "locked";

export class StoryScene extends Scene {
  private view: ViewMode = "tree";
  /** 当前对白索引 */
  private dialogueIndex = 0;
  /** 打字机进度 0..1 */
  private typeProgress = 0;
  /** intro 中的章节 */
  private pendingIntroChapter: StoryChapter | null = null;
  /** outro 中的章节 */
  private pendingOutroChapter: StoryChapter | null = null;
  /** 树视图滚动 */
  private scrollY = 0;
  private contentH = 800;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private isDragging = false;
  /** 按下的按钮 / 节点 ID */
  private pressedButton: string | null = null;
  private t = 0;
  private particles = new ParticleSystem();

  enter(): void {
    super.enter();
    startBGM("hub");
    this.t = 0;
    this.scrollY = 0;
    this.particles.clear();
    this.pendingIntroChapter = null;
    this.pendingOutroChapter = null;
    this.pressedButton = null;

    // 检查当前章节是否已完成（玩家玩完游戏返回）
    const progress = platformStore.storyProgress();
    if (progress.currentChapter < STORY_CHAPTERS.length) {
      const currentChapter = STORY_CHAPTERS[progress.currentChapter];
      if (progress.completedNodes.includes(currentChapter.id)) {
        // 当前章节节点已完成 → 播放 outro
        this.pendingOutroChapter = currentChapter;
        this.view = "outro";
        this.dialogueIndex = 0;
        this.typeProgress = 0;
        return;
      }
    }
    this.view = "tree";
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    this.particles.update(dt);
    // 打字机推进（约 30 字/秒）
    if ((this.view === "intro" || this.view === "outro") && this.typeProgress < 1) {
      const text = this.currentDialogueText();
      const charsPerSec = 30;
      const fullDur = Math.max(0.4, text.length / charsPerSec);
      this.typeProgress = Math.min(1, this.typeProgress + dt / fullDur);
    }
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    // 树视图始终作为底层渲染
    this.renderTree(ctx, screenW, screenH);

    if (this.view !== "tree") {
      // 暗化覆盖层
      drawModalOverlay(ctx, screenW, screenH);
      // 对白视图
      this.renderDialogue(ctx, screenW, screenH);
    }

    // 粒子层（奖励特效等）
    this.particles.render(ctx);
  }

  // ============ 树视图渲染 ============

  private renderTree(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 顶部导航栏（固定，不随滚动）
    this.renderTopBar(ctx, screenW, screenH);

    // 滚动内容
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP_BAR_H, screenW, screenH - TOP_BAR_H);
    ctx.clip();
    ctx.translate(0, -this.scrollY);
    this.renderTreeContent(ctx, screenW);
    ctx.restore();
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.9)";
    ctx.fillRect(0, 0, screenW, TOP_BAR_H);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, TOP_BAR_H - 1, screenW, 1);
    ctx.restore();

    // 返回按钮
    const backBtn: Rect = { x: 12, y: 12, w: 40, h: 32 };
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost",
      accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 12, backBtn.y + 8, 16, Theme.colors.ink.muted);

    // 标题
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(Theme.colors.neon.DEFAULT, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("剧情模式", screenW / 2, 22);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("STORY MODE · 反诈五部曲", screenW / 2, 40);
    ctx.restore();
  }

  private renderTreeContent(ctx: CanvasRenderingContext2D, screenW: number): void {
    let y = TOP_BAR_H + 16;

    // 区块标题
    drawHudLabel(ctx, PAD, y, "// STORY MODE · 5 CHAPTERS", Theme.colors.ink.muted);
    y += 18;

    ctx.save();
    ctx.font = `700 24px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("反诈剧情 · 五部曲", PAD, y);
    y += 32;

    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("从识破单点诈骗到摧毁境外电诈集团，一步步成为反诈探员", PAD, y);
    y += 22;
    ctx.restore();

    // 进度
    const progress = platformStore.storyProgress();
    const completedCount = STORY_CHAPTERS.filter((c) => progress.completedNodes.includes(c.id)).length;
    drawHudLabel(ctx, PAD, y, `PROGRESS · ${completedCount}/${STORY_CHAPTERS.length} 章节已完成`, Theme.colors.neon.DEFAULT);
    y += 24;

    // 章节节点起点
    const nodeStartY = y;

    // 连接线（先画，在节点下方）
    this.renderConnectingLine(ctx, nodeStartY);

    // 章节节点
    for (let i = 0; i < STORY_CHAPTERS.length; i++) {
      const nodeY = nodeStartY + i * (NODE_H + NODE_GAP);
      this.renderChapterNode(ctx, STORY_CHAPTERS[i], PAD, nodeY, screenW - PAD * 2, NODE_H, i);
    }

    this.contentH = nodeStartY + STORY_CHAPTERS.length * (NODE_H + NODE_GAP) + 60;
  }

  private renderConnectingLine(ctx: CanvasRenderingContext2D, nodeStartY: number): void {
    const firstCY = nodeStartY + NODE_H / 2;
    const lastCY = nodeStartY + (STORY_CHAPTERS.length - 1) * (NODE_H + NODE_GAP) + NODE_H / 2;

    ctx.save();
    const grad = ctx.createLinearGradient(0, firstCY, 0, lastCY);
    grad.addColorStop(0, withAlpha(Theme.colors.neon.DEFAULT, 0.5));
    grad.addColorStop(1, withAlpha(Theme.colors.neon.DEFAULT, 0.1));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(LINE_X, firstCY);
    ctx.lineTo(LINE_X, lastCY);
    ctx.stroke();
    ctx.restore();
  }

  private renderChapterNode(
    ctx: CanvasRenderingContext2D,
    chapter: StoryChapter,
    x: number, y: number, w: number, h: number,
    index: number,
  ): void {
    const status = this.chapterStatus(index);
    const accent = chapter.accent;
    const isLocked = status === "locked";
    const isCompleted = status === "completed";
    const isCurrent = status === "current";
    const isPressed = this.pressedButton === `node-${index}`;

    ctx.save();
    if (isLocked) ctx.globalAlpha = 0.45;

    // 卡片背景
    drawPanel(ctx, x, y, w, h, {
      borderColor: isLocked
        ? Theme.colors.bg.line
        : withAlpha(accent, isCurrent ? 0.65 : 0.3),
      bgColor: isLocked
        ? Theme.colors.bg.panel
        : withAlpha(accent, isCurrent ? 0.07 : 0.03),
      cut: 8,
    });

    // 顶部渐变线
    if (!isLocked) {
      ctx.save();
      const lineGrad = ctx.createLinearGradient(x, y, x + w, y);
      lineGrad.addColorStop(0, "transparent");
      lineGrad.addColorStop(0.5, accent);
      lineGrad.addColorStop(1, "transparent");
      ctx.fillStyle = lineGrad;
      ctx.fillRect(x, y, w, 1);
      ctx.restore();
    }

    // 当前章节：脉冲霓虹四角
    if (isCurrent) {
      const pulse = 6 + Math.sin(this.t * 4) * 3;
      drawNeonCorners(ctx, x, y, w, h, accent, undefined, undefined, pulse);
    }
    if (isPressed) {
      drawNeonCorners(ctx, x, y, w, h, accent, undefined, undefined, 8);
    }

    // 图标盒
    const iconBoxX = x + ICON_X_OFFSET;
    const iconBoxY = y + (h - ICON_BOX) / 2;
    ctx.save();
    ctx.fillStyle = withAlpha(accent, isLocked ? 0.08 : 0.15);
    ctx.fillRect(iconBoxX, iconBoxY, ICON_BOX, ICON_BOX);
    ctx.strokeStyle = withAlpha(accent, isLocked ? 0.2 : 0.5);
    ctx.lineWidth = 1;
    ctx.strokeRect(iconBoxX, iconBoxY, ICON_BOX, ICON_BOX);
    ctx.restore();

    // 游戏图标
    const iconPad = 12;
    drawIcon(
      ctx, GAME_ICON[chapter.gameId],
      iconBoxX + iconPad, iconBoxY + iconPad, ICON_BOX - iconPad * 2,
      isLocked ? Theme.colors.ink.dim : accent,
    );

    // 章节号徽章
    drawGlowBadge(ctx, iconBoxX, iconBoxY - 9, `0${index + 1}`, accent, this.t, isCurrent);

    // 内容区
    const contentX = iconBoxX + ICON_BOX + 16;
    const contentW = w - (contentX - x) - 56;

    // 标题
    ctx.save();
    ctx.font = `700 17px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.muted : accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (!isLocked) {
      ctx.shadowColor = withAlpha(accent, 0.3);
      ctx.shadowBlur = 6;
    }
    ctx.fillText(chapter.title, contentX, y + 14);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 副标题
    drawHudLabel(ctx, contentX, y + 38, chapter.subtitle, Theme.colors.ink.muted);

    // 描述（最多 2 行，超出截断）
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : withAlpha(Theme.colors.ink.DEFAULT, 0.72);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.drawTruncatedText(ctx, chapter.description, contentX, y + 56, contentW, 14, 2);
    ctx.restore();

    // 状态指示器（右侧）
    const statusCX = x + w - 30;
    const statusCY = y + h / 2;
    if (isCompleted) {
      ctx.save();
      ctx.fillStyle = withAlpha(Theme.colors.safe.DEFAULT, 0.15);
      ctx.beginPath();
      ctx.arc(statusCX, statusCY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(Theme.colors.safe.DEFAULT, 0.6);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      drawIcon(ctx, "check", statusCX - 8, statusCY - 8, 16, Theme.colors.safe.DEFAULT);
    } else if (isCurrent) {
      drawProgressRing(ctx, statusCX, statusCY, 14, 0, accent, this.t);
      ctx.save();
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8 + Math.sin(this.t * 4) * 4;
      ctx.beginPath();
      ctx.arc(statusCX, statusCY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      drawIcon(ctx, "lock", statusCX - 8, statusCY - 8, 16, Theme.colors.ink.dim);
    }

    // 右箭头（可点击时）
    if (!isLocked) {
      drawIcon(ctx, "chevronRight", x + w - 12, y + h / 2 - 6, 12, isCurrent ? accent : Theme.colors.ink.muted);
    }

    ctx.restore();
  }

  /** 截断到最多 maxLines 行，超出加省略号 */
  private drawTruncatedText(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number,
    maxWidth: number, lineHeight: number, maxLines: number,
  ): void {
    const chars = text.split("");
    const lines: string[] = [];
    let line = "";
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);

    // 超出则末行加省略号
    const joined = lines.join("");
    if (joined.length < text.length && lines.length > 0) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.slice(0, Math.max(0, last.length - 1)) + "…";
    }
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
  }

  // ============ 对白视图渲染 ============

  private renderDialogue(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const chapter = this.view === "intro" ? this.pendingIntroChapter : this.pendingOutroChapter;
    if (!chapter) return;
    const accent = chapter.accent;

    // 章节标题（顶部）
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(accent, 0.8);
    ctx.fillText(`CHAPTER ${String(chapter.index + 1).padStart(2, "0")}`, screenW / 2, 80);
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 12;
    ctx.fillText(`第 ${chapter.index + 1} 章 · ${chapter.title}`, screenW / 2, 96);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(chapter.subtitle, screenW / 2, 126);
    ctx.restore();

    // 对白面板
    const panelX = PAD;
    const panelW = screenW - PAD * 2;
    const panelH = Math.min(280, screenH * 0.42);
    const panelY = screenH - panelH - 24;

    drawPanel(ctx, panelX, panelY, panelW, panelH, {
      borderColor: withAlpha(accent, 0.55),
      bgColor: withAlpha(Theme.colors.bg.panel, 0.95),
      cut: 10,
    });

    // 顶部渐变线
    ctx.save();
    const lineGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
    lineGrad.addColorStop(0, "transparent");
    lineGrad.addColorStop(0.5, accent);
    lineGrad.addColorStop(1, "transparent");
    ctx.fillStyle = lineGrad;
    ctx.fillRect(panelX, panelY, panelW, 1);
    ctx.restore();

    // 当前章节脉冲四角
    drawNeonCorners(ctx, panelX, panelY, panelW, panelH, accent, undefined, undefined, 4 + Math.sin(this.t * 3) * 2);

    // 头像
    const dialogue = this.currentDialogue();
    const avatarSize = 64;
    const avatarX = panelX + 20;
    const avatarY = panelY - avatarSize / 2;

    if (dialogue) {
      ctx.save();
      // 头像背景圆
      ctx.fillStyle = withAlpha(dialogue.color, 0.12);
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(dialogue.color, 0.6);
      ctx.lineWidth = 2;
      ctx.shadowColor = dialogue.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // emoji 头像
      ctx.font = `36px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dialogue.avatar, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 2);
      ctx.restore();
    }

    // 说话人名称 + 文本
    const textX = avatarX + avatarSize + 18;
    const textMaxW = panelW - (textX - panelX) - 24;

    if (dialogue) {
      // 说话人名称
      ctx.save();
      ctx.font = `700 15px ${Theme.fonts.display}`;
      ctx.fillStyle = dialogue.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.shadowColor = withAlpha(dialogue.color, 0.3);
      ctx.shadowBlur = 6;
      ctx.fillText(dialogue.speaker, textX, panelY + 18);
      ctx.shadowBlur = 0;
      // 名称下色条
      ctx.fillStyle = withAlpha(dialogue.color, 0.5);
      ctx.fillRect(textX, panelY + 40, 24, 2);
      ctx.restore();

      // 对白文本（打字机效果）
      const fullText = dialogue.text;
      const visibleLen = Math.floor(fullText.length * this.typeProgress);
      const visibleText = fullText.slice(0, visibleLen);

      ctx.save();
      ctx.font = `400 14px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      this.drawWrappedText(ctx, visibleText, textX, panelY + 52, textMaxW, 20);
      ctx.restore();
    }

    // 底部提示 / 按钮
    const isLast = this.isLastDialogue();
    const typed = this.typeProgress >= 1;

    if (isLast && typed) {
      // 最后一句话打完 → 显示动作按钮
      this.renderActionButton(ctx, screenW, screenH, chapter);
    } else {
      // 「点击继续」提示
      const pulse = 0.4 + 0.5 * ((Math.sin(this.t * 3) + 1) / 2);
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, pulse);
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      const hint = typed ? "点击继续 ▸" : "点击跳过 ▸";
      ctx.fillText(hint, panelX + panelW - 16, panelY + panelH - 12);
      ctx.restore();
    }
  }

  private renderActionButton(
    ctx: CanvasRenderingContext2D,
    screenW: number, _screenH: number,
    chapter: StoryChapter,
  ): void {
    const accent = chapter.accent;
    const btnW = Math.min(200, screenW - PAD * 2 - 32);
    const btnH = 44;
    const btnX = (screenW - btnW) / 2;
    const btnY = _screenH - 24 - btnH - 8;

    const isOutro = this.view === "outro";
    const isReplay = this.view === "intro" && platformStore.storyProgress().completedNodes.includes(chapter.id);
    const text = isOutro ? "领取奖励" : isReplay ? "重玩任务" : "开始任务";

    // 奖励预览（outro 时）
    if (isOutro) {
      const rewardY = btnY - 32;
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const parts: string[] = [];
      parts.push(`¥${chapter.reward.coins}`);
      if (chapter.reward.energy > 0) parts.push(`⚡${chapter.reward.energy}`);
      if (chapter.reward.fragments > 0) parts.push(`◆${chapter.reward.fragments}`);
      ctx.fillText(`奖励 · ${parts.join("  ")}`, screenW / 2, rewardY);
      ctx.restore();
    }

    drawButton(ctx, btnX, btnY, btnW, btnH, text, {
      variant: "primary",
      accent,
      pressed: this.pressedButton === "action",
      subText: isOutro ? "CLAIM REWARD" : isReplay ? "REPLAY" : "START MISSION",
    });
  }

  // ============ 触摸处理 ============

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (this.view === "tree") {
      return this.handleTreeTouch(type, x, y);
    }
    return this.handleDialogueTouch(type, x, y);
  }

  private handleTreeTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const backBtn: Rect = { x: 12, y: 12, w: 40, h: 32 };

    if (type === "start") {
      // 返回按钮
      if (hitTest(x, y, backBtn)) {
        this.pressedButton = "back";
        return true;
      }

      // 章节节点
      const pad = PAD;
      const nodeStartY = this.computeNodeStartY();
      for (let i = 0; i < STORY_CHAPTERS.length; i++) {
        const status = this.chapterStatus(i);
        if (status === "locked") continue;
        const nodeY = nodeStartY + i * (NODE_H + NODE_GAP);
        const nodeRect: Rect = {
          x: pad, y: nodeY - this.scrollY,
          w: screenW - pad * 2, h: NODE_H,
        };
        if (hitTest(x, y, nodeRect)) {
          this.pressedButton = `node-${i}`;
          return true;
        }
      }

      // 滚动拖拽
      this.dragStartY = y;
      this.dragStartScroll = this.scrollY;
      this.isDragging = true;
      return true;
    } else if (type === "move") {
      if (this.isDragging) {
        const dy = y - this.dragStartY;
        const maxScroll = Math.max(0, this.contentH - screenH + TOP_BAR_H);
        this.scrollY = clamp(this.dragStartScroll - dy, 0, maxScroll);
      }
      return false;
    } else if (type === "end") {
      if (this.pressedButton === "back" && hitTest(x, y, backBtn)) {
        playSfx("click");
        this.director.pop();
        postFX.flash(Theme.colors.neon.DEFAULT, 0.25);
      } else if (this.pressedButton && this.pressedButton.startsWith("node-")) {
        const idx = parseInt(this.pressedButton.slice(5));
        const nodeStartY = this.computeNodeStartY();
        const nodeY = nodeStartY + idx * (NODE_H + NODE_GAP);
        const nodeRect: Rect = {
          x: PAD, y: nodeY - this.scrollY,
          w: screenW - PAD * 2, h: NODE_H,
        };
        if (hitTest(x, y, nodeRect)) {
          playSfx("click");
          this.pendingIntroChapter = STORY_CHAPTERS[idx];
          this.pendingOutroChapter = null;
          this.view = "intro";
          this.dialogueIndex = 0;
          this.typeProgress = 0;
          postFX.flash(STORY_CHAPTERS[idx].accent, 0.2);
        }
      }
      this.pressedButton = null;
      this.isDragging = false;
      return false;
    }
    return false;
  }

  private handleDialogueTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const isLast = this.isLastDialogue();
    const typed = this.typeProgress >= 1;
    const showButton = isLast && typed;

    if (type === "start") {
      if (showButton) {
        const btn = this.actionButtonRect(screenW, screenH);
        if (hitTest(x, y, btn)) {
          this.pressedButton = "action";
        }
      }
      return true; // 对白视图消费所有触摸
    } else if (type === "move") {
      return true;
    } else if (type === "end") {
      if (this.pressedButton === "action") {
        const btn = this.actionButtonRect(screenW, screenH);
        if (hitTest(x, y, btn)) {
          this.triggerAction();
        }
        this.pressedButton = null;
        return true;
      }

      // 非按钮区域：推进对白
      if (!showButton) {
        if (!typed) {
          // 打字机未完成 → 立即补全
          this.typeProgress = 1;
          playSfx("tick");
        } else if (!isLast) {
          // 推进到下一句
          this.dialogueIndex++;
          this.typeProgress = 0;
          playSfx("tick");
        }
      }
      return true;
    }
    return true;
  }

  // ============ 动作触发 ============

  private triggerAction(): void {
    if (this.view === "intro" && this.pendingIntroChapter) {
      const chapter = this.pendingIntroChapter;
      // 标记章节节点完成（幂等）
      platformStore.completeStoryNode(chapter.id);
      playSfx("click");
      postFX.flash(chapter.accent, 0.35);
      // 通过 BriefingScene 启动游戏
      this.director.replace(
        new BriefingScene(this.director),
        { gameId: chapter.gameId },
        "slide",
      );
    } else if (this.view === "outro" && this.pendingOutroChapter) {
      const chapter = this.pendingOutroChapter;
      // 发放奖励
      platformStore.addResources(chapter.reward);
      // 解锁下一章
      platformStore.advanceStoryChapter(chapter.index + 1);
      playSfx("achievement");
      postFX.flash(chapter.accent, 0.45, 2);
      postFX.shake(4, 8);

      // 奖励特效粒子
      const sw = this.director.screenWidth;
      const sh = this.director.screenHeight;
      this.particles.spawnBurst(sw / 2, sh * 0.7, chapter.accent, {
        ring: true, sparks: 16, dots: 24, speed: 200, life: 1.0,
        size: 4, shockwave: true,
      });
      this.particles.spawnText(sw / 2, sh * 0.58, `+${chapter.reward.coins} 金币`, Theme.colors.flag.DEFAULT, { size: 18, life: 1.6 });
      if (chapter.reward.energy > 0) {
        this.particles.spawnText(sw / 2, sh * 0.58 + 26, `+${chapter.reward.energy} 能量`, Theme.colors.safe.DEFAULT, { size: 16, life: 1.6 });
      }
      if (chapter.reward.fragments > 0) {
        this.particles.spawnText(sw / 2, sh * 0.58 + 50, `+${chapter.reward.fragments} 碎片`, Theme.colors.neon.DEFAULT, { size: 16, life: 1.6 });
      }

      // 回到树视图
      this.pendingOutroChapter = null;
      this.view = "tree";
      this.dialogueIndex = 0;
      this.typeProgress = 0;
      this.scrollY = 0;
    }
  }

  // ============ 辅助方法 ============

  private chapterStatus(index: number): ChapterStatus {
    const progress = platformStore.storyProgress();
    const chapter = STORY_CHAPTERS[index];
    if (progress.completedNodes.includes(chapter.id)) return "completed";
    if (index === progress.currentChapter) return "current";
    if (index < progress.currentChapter) return "completed"; // 防御性：已超过但未记录
    return "locked";
  }

  private currentDialogues(): StoryDialogue[] {
    if (this.view === "intro" && this.pendingIntroChapter) return this.pendingIntroChapter.intro;
    if (this.view === "outro" && this.pendingOutroChapter) return this.pendingOutroChapter.outro;
    return [];
  }

  private currentDialogue(): StoryDialogue | null {
    const list = this.currentDialogues();
    return this.dialogueIndex < list.length ? list[this.dialogueIndex] : null;
  }

  private currentDialogueText(): string {
    return this.currentDialogue()?.text ?? "";
  }

  private isLastDialogue(): boolean {
    const list = this.currentDialogues();
    return list.length === 0 || this.dialogueIndex >= list.length - 1;
  }

  private actionButtonRect(screenW: number, screenH: number): Rect {
    const btnW = Math.min(200, screenW - PAD * 2 - 32);
    const btnH = 44;
    const btnX = (screenW - btnW) / 2;
    const btnY = screenH - 24 - btnH - 8;
    return { x: btnX, y: btnY, w: btnW, h: btnH };
  }

  /**
   * 计算章节节点在内容坐标系中的起点 Y
   * 与 renderTreeContent 保持同步：
   * TOP_BAR_H + 16 + 18 + 32 + 22 + 24 = 168
   */
  private computeNodeStartY(): number {
    return TOP_BAR_H + 16 + 18 + 32 + 22 + 24;
  }

  /** 简单自动换行（不截断） */
  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number,
    maxWidth: number, lineHeight: number,
  ): void {
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
  }
}
