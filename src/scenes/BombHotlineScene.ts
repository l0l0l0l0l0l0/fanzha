/**
 * 96110 热线模拟场景（诈园区）
 *
 * 接线员对话树交互：
 * - 剧本选择：展示 HOTLINE_SCRIPTS 剧本卡片，点击进入对话
 * - 对话流程：startNodeId → 接线员台词 → 玩家选项 → verdict 反馈 → next 跳转
 * - 结局展示：next=null 时显示 ending + 学习要点 takeaways
 *
 * 布局（414×896 逻辑坐标系，纵向）：
 * - 0-56：顶部栏（返回 + 标题"96110 热线模拟" + 96110 徽章）
 * - 56-180：剧本选择区（HOTLINE_SCRIPTS 卡片列表）
 * - 180-780：对话区（接线员气泡 + 玩家选项 + 反馈，可滚动）
 * - 780-872：学习要点区（对话结束后展示 takeaways）
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
import { HOTLINE_SCRIPTS } from "@/games/bombIsland/dataV3";
import type { BombHotlineScript, BombHotlineChoice } from "@/games/bombIsland/types";

const ACCENT = Theme.accents["bomb-island"];

/** 布局常量 */
const LAYOUT = {
  topBarH: 56,
  scriptY: 64,        // 剧本选择区起始
  scriptH: 34,
  scriptGap: 6,
  dialogueY: 180,     // 对话区起始
  dialogueH: 600,     // 180-780
  takeawaysY: 780,    // 学习要点区
  takeawaysH: 92,     // 780-872
  footerY: 872,
};

/** verdict 配色：right=绿 / warn=黄 / wrong=红 */
const VERDICT_COLORS: Record<string, string> = {
  right: Theme.colors.safe.DEFAULT,
  warn: Theme.colors.flag.DEFAULT,
  wrong: Theme.colors.warn.DEFAULT,
};

/** ending 配色 */
const ENDING_COLORS: Record<string, string> = {
  verified: Theme.colors.safe.DEFAULT,
  scam: Theme.colors.warn.DEFAULT,
  uncertain: Theme.colors.flag.DEFAULT,
};

/** ending 文案 */
const ENDING_LABELS: Record<string, string> = {
  verified: "✓ 正确处置",
  scam: "✗ 已受损·已报警止付",
  uncertain: "? 处置存疑",
};

/** 反馈展示时长（秒），归零后自动跳转 */
const FEEDBACK_DURATION = 1.8;

/** 已访问的对话历史条目 */
interface HistoryEntry {
  operator: string;
  choiceText: string;
  verdict?: string;
  feedback?: string;
}

/** 对话区绘制块（display list，用于先测量再滚动绘制） */
interface DrawBlock {
  y: number;
  h: number;
  draw: (cx: CanvasRenderingContext2D, dx: number, dy: number, dw: number) => void;
}

export class BombHotlineScene extends Scene {
  /** 当前选中的剧本（null=未选中） */
  private currentScript: BombHotlineScript | null = null;
  /** 当前节点 ID */
  private currentNodeId: string | null = null;
  /** 当前选中的选项索引（展示反馈期间） */
  private selectedChoiceIdx: number | null = null;
  /** 反馈展示计时（>0 时展示反馈，归零后自动跳转） */
  private feedbackTimer = 0;
  /** 已访问的对话历史 */
  private history: HistoryEntry[] = [];
  /** 是否已到达结局 */
  private ended = false;
  /** 当前结局 */
  private ending: string | null = null;
  /** 按下的按钮 ID */
  private pressedButton: string | null = null;
  /** 对话区滚动偏移 */
  private scrollY = 0;
  /** 触摸起点 y（滚动判定） */
  private touchStartY = 0;
  /** 触摸起始滚动偏移 */
  private touchStartScroll = 0;
  /** 是否正在拖动滚动 */
  private dragging = false;
  /** 入场动画计时 */
  private t = 0;
  /** 剧本卡片命中区（render 写入） */
  private scriptRects: Rect[] = [];
  /** 选项按钮命中区（render 写入） */
  private choiceRects: Array<{ rect: Rect; idx: number }> = [];

  enter(): void {
    super.enter();
    this.resetDialogue();
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    // 反馈计时：归零后自动跳转到下一节点或结局
    if (this.selectedChoiceIdx !== null && this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) {
        this.advanceFromChoice();
      }
    }
  }

  /** 重置全部对话状态 */
  private resetDialogue(): void {
    this.currentScript = null;
    this.currentNodeId = null;
    this.selectedChoiceIdx = null;
    this.feedbackTimer = 0;
    this.history = [];
    this.ended = false;
    this.ending = null;
    this.scrollY = 0;
  }

  /** 进入指定剧本 */
  private enterScript(script: BombHotlineScript): void {
    this.currentScript = script;
    this.currentNodeId = script.startNodeId;
    this.selectedChoiceIdx = null;
    this.feedbackTimer = 0;
    this.history = [];
    this.ended = false;
    this.ending = null;
    this.scrollY = 0;
  }

  /** 从当前所选选项跳转到下一节点或结局 */
  private advanceFromChoice(): void {
    if (!this.currentScript || this.currentNodeId === null || this.selectedChoiceIdx === null) return;
    const node = this.currentScript.nodes.find(n => n.id === this.currentNodeId);
    if (!node) return;
    const choice = node.choices[this.selectedChoiceIdx];
    if (!choice) return;

    // 推入历史
    this.history.push({
      operator: node.operator,
      choiceText: choice.text,
      verdict: choice.verdict,
      feedback: choice.feedback,
    });

    // 跳转：next=null 到达结局；否则切到下一节点
    if (choice.next === null || choice.next === undefined) {
      this.ended = true;
      this.ending = choice.ending ?? "uncertain";
      this.selectedChoiceIdx = null;
    } else {
      this.currentNodeId = choice.next;
      this.selectedChoiceIdx = null;
    }
    // 跳转后滚到底（render 时按 maxScroll 钳制）
    this.scrollY = 100000;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    const enterAlpha = Math.min(1, this.enterT * 2.5);
    ctx.save();
    ctx.globalAlpha = enterAlpha;

    this.renderTopBar(ctx, screenW);
    this.renderScriptList(ctx, screenW);
    this.renderDialogue(ctx, screenW);
    this.renderTakeaways(ctx, screenW);
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
    ctx.fillText("96110 热线模拟", screenW / 2, 16);
    ctx.shadowBlur = 0;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
    ctx.fillText("反诈专线 · 对话树演练", screenW / 2, 38);
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

  // ============ 剧本选择区 ============

  private renderScriptList(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const w = screenW - pad * 2;
    this.scriptRects = [];

    for (let i = 0; i < HOTLINE_SCRIPTS.length; i++) {
      const s = HOTLINE_SCRIPTS[i];
      const y = LAYOUT.scriptY + i * (LAYOUT.scriptH + LAYOUT.scriptGap);
      const rect: Rect = { x: pad, y, w, h: LAYOUT.scriptH };
      this.scriptRects.push(rect);
      const selected = this.currentScript?.id === s.id;

      // 背景
      ctx.save();
      if (selected) {
        ctx.fillStyle = withAlpha(ACCENT, 0.18);
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 8;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "rgba(18, 42, 66, 0.7)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = withAlpha(ACCENT, 0.3);
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
      ctx.restore();

      // 序号 + 标题 + 场景摘要
      ctx.save();
      ctx.textBaseline = "middle";
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = selected ? ACCENT : Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.fillText(`${i + 1}`, rect.x + 12, rect.y + rect.h / 2);

      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = selected ? ACCENT : Theme.colors.ink.DEFAULT;
      ctx.fillText(s.title, rect.x + 30, rect.y + rect.h / 2);

      // 场景摘要（右侧截断）
      ctx.font = `400 9px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      const maxW = rect.w - 220;
      let hint = s.scenario;
      while (hint.length > 1 && ctx.measureText(hint + "…").width > maxW) hint = hint.slice(0, -1);
      if (hint.length < s.scenario.length) hint += "…";
      ctx.textAlign = "right";
      ctx.fillText(hint, rect.x + rect.w - 22, rect.y + rect.h / 2);

      // 展开箭头
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = selected ? ACCENT : Theme.colors.ink.dim;
      ctx.fillText(selected ? "▶" : "▸", rect.x + rect.w - 12, rect.y + rect.h / 2);
      ctx.restore();
    }
  }

  // ============ 对话区 ============

  private renderDialogue(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const y = LAYOUT.dialogueY;
    const h = LAYOUT.dialogueH;
    const w = screenW - pad * 2;
    const innerX = pad + 12;
    const innerW = w - 24;

    drawPanel(ctx, pad, y, w, h, { borderColor: withAlpha(ACCENT, 0.3), cut: 8 });

    // 未选剧本：提示
    if (!this.currentScript) {
      ctx.save();
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("👆 请从上方选择一个剧本", screenW / 2, y + h / 2 - 10);
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.dim, 0.8);
      ctx.fillText("开始模拟 96110 通话", screenW / 2, y + h / 2 + 12);
      ctx.restore();
      this.choiceRects = [];
      return;
    }

    // 构建绘制块（display list：先测量后绘制以支持滚动）
    const blocks: DrawBlock[] = [];
    const choiceBuild: Array<{ y: number; h: number; idx: number }> = [];
    let cursor = 12;

    // 1. 剧本标题
    blocks.push({
      y: cursor, h: 18,
      draw: (cx, dx, dy) => {
        cx.save();
        cx.font = `700 13px ${Theme.fonts.display}`;
        cx.fillStyle = ACCENT;
        cx.textAlign = "left";
        cx.textBaseline = "top";
        cx.fillText(`📞 ${this.currentScript!.title}`, dx, dy);
        cx.restore();
      },
    });
    cursor += 24;

    // 2. 场景描述框
    const scFont = `400 11px ${Theme.fonts.body}`;
    const scLines = this.wrapLines(ctx, this.currentScript.scenario, innerW - 16, scFont);
    const scH = scLines.length * 15 + 20;
    blocks.push({
      y: cursor, h: scH,
      draw: (cx, dx, dy, dw) => {
        cx.save();
        cx.fillStyle = withAlpha(Theme.colors.warn.DEFAULT, 0.08);
        cx.fillRect(dx, dy, dw, scH);
        cx.fillStyle = Theme.colors.warn.DEFAULT;
        cx.fillRect(dx, dy, 3, scH);
        cx.font = scFont;
        cx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
        cx.textAlign = "left";
        cx.textBaseline = "top";
        scLines.forEach((ln, i) => cx.fillText(ln, dx + 12, dy + 10 + i * 15));
        cx.restore();
      },
    });
    cursor += scH + 10;

    // 3. 历史对话
    for (const entry of this.history) {
      const vColor = VERDICT_COLORS[entry.verdict ?? ""] ?? Theme.colors.ink.DEFAULT;

      // 接线员标签
      blocks.push({
        y: cursor, h: 12,
        draw: (cx, dx, dy) => {
          cx.save();
          cx.font = `700 9px ${Theme.fonts.mono}`;
          cx.fillStyle = Theme.colors.ink.muted;
          cx.textAlign = "left";
          cx.textBaseline = "top";
          cx.fillText("☎ 接线员", dx, dy);
          cx.restore();
        },
      });
      cursor += 14;

      // 接线员台词（muted）
      const opFont = `400 10px ${Theme.fonts.body}`;
      const opLines = this.wrapLines(ctx, entry.operator, innerW - 16, opFont);
      const opH = opLines.length * 13;
      blocks.push({
        y: cursor, h: opH,
        draw: (cx, dx, dy) => {
          cx.save();
          cx.font = opFont;
          cx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
          cx.textAlign = "left";
          cx.textBaseline = "top";
          opLines.forEach((ln, i) => cx.fillText(ln, dx + 12, dy + i * 13));
          cx.restore();
        },
      });
      cursor += opH + 3;

      // 玩家选择（verdict 色）
      const chFont = `700 10px ${Theme.fonts.body}`;
      const chLines = this.wrapLines(ctx, `▸ ${entry.choiceText}`, innerW - 12, chFont);
      const chH = chLines.length * 13;
      blocks.push({
        y: cursor, h: chH,
        draw: (cx, dx, dy) => {
          cx.save();
          cx.font = chFont;
          cx.fillStyle = vColor;
          cx.textAlign = "left";
          cx.textBaseline = "top";
          chLines.forEach((ln, i) => cx.fillText(ln, dx + 8, dy + i * 13));
          cx.restore();
        },
      });
      cursor += chH + 3;

      // 反馈文本
      if (entry.feedback) {
        const fbFont = `400 9px ${Theme.fonts.mono}`;
        const fbLines = this.wrapLines(ctx, entry.feedback, innerW - 16, fbFont);
        const fbH = fbLines.length * 12;
        blocks.push({
          y: cursor, h: fbH,
          draw: (cx, dx, dy) => {
            cx.save();
            cx.font = fbFont;
            cx.fillStyle = withAlpha(vColor, 0.8);
            cx.textAlign = "left";
            cx.textBaseline = "top";
            fbLines.forEach((ln, i) => cx.fillText(ln, dx + 12, dy + i * 12));
            cx.restore();
          },
        });
        cursor += fbH + 3;
      }
      cursor += 8; // 条目间隙
    }

    // 4. 当前节点 / 结局
    if (this.ended) {
      const endColor = ENDING_COLORS[this.ending ?? ""] ?? Theme.colors.ink.DEFAULT;
      const endH = 44;
      blocks.push({
        y: cursor, h: endH,
        draw: (cx, dx, dy, dw) => {
          cx.save();
          cx.fillStyle = withAlpha(endColor, 0.15);
          cx.fillRect(dx, dy, dw, endH);
          cx.strokeStyle = endColor;
          cx.lineWidth = 1.5;
          cx.shadowColor = endColor;
          cx.shadowBlur = 8;
          cx.strokeRect(dx, dy, dw, endH);
          cx.shadowBlur = 0;
          cx.font = `700 14px ${Theme.fonts.display}`;
          cx.fillStyle = endColor;
          cx.textAlign = "center";
          cx.textBaseline = "middle";
          cx.fillText(ENDING_LABELS[this.ending ?? ""] ?? "通话结束", dx + dw / 2, dy + endH / 2);
          cx.restore();
        },
      });
      cursor += endH + 8;

      // 重新开始提示
      blocks.push({
        y: cursor, h: 14,
        draw: (cx, dx, dy) => {
          cx.save();
          cx.font = `400 9px ${Theme.fonts.mono}`;
          cx.fillStyle = Theme.colors.ink.muted;
          cx.textAlign = "center";
          cx.textBaseline = "top";
          cx.fillText("👆 点击上方剧本可重新开始", dx + innerW / 2, dy);
          cx.restore();
        },
      });
      cursor += 22;
    } else if (this.currentNodeId) {
      const node = this.currentScript.nodes.find(n => n.id === this.currentNodeId);
      if (node) {
        // 接线员气泡（蓝底白字 + ☎ 头像）
        const opFont = `400 12px ${Theme.fonts.body}`;
        const opLines = this.wrapLines(ctx, node.operator, innerW - 52, opFont);
        const bubH = Math.max(48, opLines.length * 16 + 24);
        blocks.push({
          y: cursor, h: bubH,
          draw: (cx, dx, dy, dw) => {
            // 头像圆
            cx.save();
            cx.fillStyle = withAlpha(Theme.colors.police.DEFAULT, 0.3);
            cx.beginPath();
            cx.arc(dx + 18, dy + 24, 16, 0, Math.PI * 2);
            cx.fill();
            cx.strokeStyle = withAlpha(Theme.colors.police.glow, 0.6);
            cx.lineWidth = 1;
            cx.stroke();
            cx.font = `18px ${Theme.fonts.body}`;
            cx.textAlign = "center";
            cx.textBaseline = "middle";
            cx.fillText("☎", dx + 18, dy + 24);
            cx.restore();
            // 气泡
            const bx = dx + 40;
            const bw = dw - 40;
            cx.save();
            cx.fillStyle = withAlpha(Theme.colors.police.DEFAULT, 0.2);
            cx.fillRect(bx, dy, bw, bubH);
            cx.strokeStyle = withAlpha(Theme.colors.police.glow, 0.5);
            cx.lineWidth = 1;
            cx.strokeRect(bx, dy, bw, bubH);
            cx.font = `700 8px ${Theme.fonts.mono}`;
            cx.fillStyle = withAlpha(Theme.colors.police.glow, 0.9);
            cx.textAlign = "left";
            cx.textBaseline = "top";
            cx.fillText("96110 接线员", bx + 10, dy + 6);
            cx.font = opFont;
            cx.fillStyle = Theme.colors.ink.DEFAULT;
            opLines.forEach((ln, i) => cx.fillText(ln, bx + 10, dy + 20 + i * 16));
            cx.restore();
          },
        });
        cursor += bubH + 8;

        // 选项 / 反馈
        if (this.selectedChoiceIdx !== null) {
          const choice = node.choices[this.selectedChoiceIdx];
          if (choice) {
            cursor = this.appendChoiceFeedbackBlocks(ctx, blocks, cursor, innerW, choice);
          }
        } else {
          // 选项按钮列表
          for (let i = 0; i < node.choices.length; i++) {
            const ch = node.choices[i];
            const btnH = 40;
            const idx = i;
            choiceBuild.push({ y: cursor, h: btnH, idx });
            blocks.push({
              y: cursor, h: btnH,
              draw: (cx, dx, dy, dw) => {
                drawButton(cx, dx, dy, dw, btnH, ch.text, {
                  variant: "ghost",
                  accent: ACCENT,
                  pressed: this.pressedButton === `choice-${idx}`,
                  fontSize: 11,
                });
              },
            });
            cursor += btnH + 6;
          }
        }
      }
    }

    cursor += 12; // 底部留白
    const contentH = cursor;

    // 钳制滚动
    const maxScroll = Math.max(0, contentH - h);
    if (this.scrollY > maxScroll) this.scrollY = maxScroll;
    if (this.scrollY < 0) this.scrollY = 0;

    // 裁剪 + 绘制可见块
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, y, w, h);
    ctx.clip();
    this.choiceRects = [];
    for (const b of blocks) {
      const dy = y + b.y - this.scrollY;
      if (dy + b.h < y || dy > y + h) continue;
      b.draw(ctx, innerX, dy, innerW);
    }
    // 计算选项按钮命中区（基于已钳制 scrollY）
    for (const c of choiceBuild) {
      this.choiceRects.push({
        rect: { x: innerX, y: y + c.y - this.scrollY, w: innerW, h: c.h },
        idx: c.idx,
      });
    }
    ctx.restore();

    // 滚动条
    if (contentH > h) {
      const thumbH = Math.max(20, (h / contentH) * h);
      const thumbY = y + (this.scrollY / maxScroll) * (h - thumbH);
      ctx.save();
      ctx.fillStyle = withAlpha(ACCENT, 0.4);
      ctx.fillRect(pad + w - 4, thumbY, 2, thumbH);
      ctx.restore();
    }
  }

  /** 追加选项反馈块（选中后高亮 + feedback 文本），返回新的 cursor */
  private appendChoiceFeedbackBlocks(
    ctx: CanvasRenderingContext2D,
    blocks: DrawBlock[],
    cursor: number,
    innerW: number,
    choice: BombHotlineChoice,
  ): number {
    const vColor = VERDICT_COLORS[choice.verdict ?? ""] ?? Theme.colors.ink.DEFAULT;
    // 选中项高亮
    const selH = 36;
    blocks.push({
      y: cursor, h: selH,
      draw: (cx, dx, dy, dw) => {
        cx.save();
        cx.fillStyle = withAlpha(vColor, 0.15);
        cx.fillRect(dx, dy, dw, selH);
        cx.strokeStyle = vColor;
        cx.lineWidth = 1.5;
        cx.strokeRect(dx, dy, dw, selH);
        cx.font = `700 11px ${Theme.fonts.body}`;
        cx.fillStyle = vColor;
        cx.textAlign = "left";
        cx.textBaseline = "middle";
        cx.fillText(`▸ ${choice.text}`, dx + 12, dy + selH / 2);
        cx.restore();
      },
    });
    cursor += selH + 4;

    // 反馈文本
    if (choice.feedback) {
      const fbFont = `400 10px ${Theme.fonts.body}`;
      const fbLines = this.wrapLines(ctx, choice.feedback, innerW - 16, fbFont);
      const fbH = fbLines.length * 14 + 14;
      blocks.push({
        y: cursor, h: fbH,
        draw: (cx, dx, dy, dw) => {
          cx.save();
          cx.fillStyle = withAlpha(vColor, 0.08);
          cx.fillRect(dx, dy, dw, fbH);
          cx.fillStyle = vColor;
          cx.fillRect(dx, dy, 3, fbH);
          cx.font = fbFont;
          cx.fillStyle = vColor;
          cx.textAlign = "left";
          cx.textBaseline = "top";
          fbLines.forEach((ln, i) => cx.fillText(ln, dx + 12, dy + 7 + i * 14));
          cx.restore();
        },
      });
      cursor += fbH + 4;
    }
    return cursor;
  }

  // ============ 学习要点区 ============

  private renderTakeaways(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const y = LAYOUT.takeawaysY;
    const h = LAYOUT.takeawaysH;
    const w = screenW - pad * 2;

    drawPanel(ctx, pad, y, w, h, { borderColor: withAlpha(Theme.colors.safe.DEFAULT, 0.3), cut: 6 });

    ctx.save();
    // 标题
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.safe.glow;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("💡 学习要点", pad + 12, y + 8);

    if (this.ended && this.currentScript) {
      const items = this.currentScript.takeaways;
      let yy = y + 26;
      for (const tk of items) {
        ctx.font = `700 10px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.safe.DEFAULT;
        ctx.fillText("✓", pad + 14, yy);
        ctx.font = `400 10px ${Theme.fonts.body}`;
        ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.88);
        const maxW = w - 36;
        let display = tk;
        while (display.length > 1 && ctx.measureText(display + "…").width > maxW) {
          display = display.slice(0, -1);
        }
        if (display.length < tk.length) display += "…";
        ctx.fillText(display, pad + 28, yy);
        yy += 16;
      }
    } else {
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      const hint = this.currentScript
        ? "完成对话后解锁学习要点..."
        : "选择剧本并完成对话后解锁学习要点";
      ctx.fillText(hint, pad + 12, y + 32);
    }
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
    ctx.textAlign = "right";
    ctx.fillText("遇诈即拨 · 全天 24h", screenW - 12, y + (screenH - y) / 2);
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
      // 剧本卡片
      for (let i = 0; i < this.scriptRects.length; i++) {
        if (hitTest(x, y, this.scriptRects[i])) {
          this.pressedButton = `script-${i}`;
          return true;
        }
      }
      // 对话区：选项按钮 / 滚动
      const dialRect: Rect = { x: 16, y: LAYOUT.dialogueY, w: screenW - 32, h: LAYOUT.dialogueH };
      if (this.currentScript && hitTest(x, y, dialRect)) {
        for (const cr of this.choiceRects) {
          if (hitTest(x, y, cr.rect)) {
            this.pressedButton = `choice-${cr.idx}`;
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

      // 剧本选择
      if (pressed?.startsWith("script-")) {
        const idx = parseInt(pressed.slice(7), 10);
        if (idx < HOTLINE_SCRIPTS.length && hitTest(x, y, this.scriptRects[idx])) {
          playSfx("click");
          this.enterScript(HOTLINE_SCRIPTS[idx]);
          return true;
        }
      }

      // 选项点击（仅在未选 + 未结束时）
      if (pressed?.startsWith("choice-")) {
        const idx = parseInt(pressed.slice(7), 10);
        const cr = this.choiceRects.find(c => c.idx === idx);
        if (cr && hitTest(x, y, cr.rect) && this.selectedChoiceIdx === null && !this.ended) {
          playSfx("click");
          this.selectedChoiceIdx = idx;
          this.feedbackTimer = FEEDBACK_DURATION;
          return true;
        }
      }

      return true;
    }

    return false;
  }
}
