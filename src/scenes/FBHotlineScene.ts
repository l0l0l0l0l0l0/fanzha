/**
 * 「是男人就反诈」96110 模拟通话器场景（v3 教育功能 Phase 3.3）
 * 横屏 Canvas UI：模拟拨打反诈中心 96110 专线的电话通话体验
 *
 * 视觉与交互：
 * - 顶部状态栏：返回按钮 + 标题"96110 反诈专线" + 通话状态指示
 * - 剧本选择态（picker）：5 个剧本卡片网格，展示场景描述与诈骗类型
 * - 通话态（calling）：
 *   · 顶部：接线员头像（👮）+ 姓名 + 通话时长 + 实时波形动画
 *   · 中部：接线员台词气泡（Web Speech API 朗读台词）
 *   · 底部：玩家可选回复按钮（2-3 个）
 *   · 选择反馈：verdict 颜色闪屏 + feedback 文字提示
 * - 结局态（ending）：通话挂断，展示学习要点 + 重拨 / 返回列表按钮
 *
 * 数据来源：HOTLINE_SCRIPTS_96110（5 个剧本，覆盖冒充公检法/杀猪盘/刷单/AI换脸/春运退票）
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawButton, drawScanlineOverlay,
  drawNeonCorners, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { roundRect } from "@/engine/Renderer";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { HOTLINE_SCRIPTS_96110, getFBCodexEntry } from "@/games/fraudBuster/dataV2";
import type { FBHotlineScript, FBHotlineChoice, FBHotlineNode } from "@/games/fraudBuster/types";

/** 96110 主题色（反诈中心蓝绿） */
const HOTLINE_ACCENT = "#1AD670";
const OPERATOR_ACCENT = "#00E5FF";

/** 通话状态 */
type CallState = "picker" | "calling" | "ending";

/** 选项反馈类型 */
type Verdict = "right" | "warn" | "wrong";

/** 结局类型 */
type Ending = "verified" | "scam" | "uncertain";

/** 玩家行进路径记录（用于结局回看） */
interface PathStep {
  nodeId: string;
  operatorText: string;
  choiceText: string;
  verdict: Verdict;
  feedback: string;
}

/** 缓存上一帧屏幕尺寸（触摸命中测试用） */
const VERDICT_COLORS: Record<Verdict, string> = {
  right: "#1AD670",
  warn: "#FFD666",
  wrong: "#E5353B",
};

const VERDICT_LABELS: Record<Verdict, string> = {
  right: "正确处置",
  warn: "需谨慎",
  wrong: "错误做法",
};

const ENDING_LABELS: Record<Ending, string> = {
  verified: "✓ 反诈核实成功",
  scam: "✗ 仍落入骗局",
  uncertain: "? 需进一步核实",
};

const ENDING_COLORS: Record<Ending, string> = {
  verified: "#1AD670",
  scam: "#E5353B",
  uncertain: "#FFD666",
};

export class FBHotlineScene extends Scene {
  private callState: CallState = "picker";
  /** 当前剧本 */
  private script: FBHotlineScript | null = null;
  /** 当前节点 */
  private currentNode: FBHotlineNode | null = null;
  /** 行进路径 */
  private path: PathStep[] = [];
  /** 最终结局 */
  private ending: Ending | null = null;
  /** 通话开始时间（秒，enterT 系） */
  private callStartT = 0;
  /** 通话时长（秒） */
  private callDuration = 0;
  /** 上一帧通话时长（用于检测分钟变化触发音效） */
  private prevCallSec = 0;
  /** TTS 是否正在播放 */
  private ttsPlaying = false;
  /** TTS 播放开始时间 */
  private ttsStartT = 0;
  /** TTS 预计时长（秒，按字数估算） */
  private ttsEstimatedDuration = 0;
  /** 当前 verdict 反馈（选择后短暂展示） */
  private verdictFlash: { verdict: Verdict; feedback: string; choiceText: string; until: number } | null = null;
  /** 选项按钮按下态 */
  private pressedChoiceIdx: number | null = null;
  /** 剧本卡片按下态 */
  private pressedScriptIdx: number | null = null;
  /** 通用按钮按下态 */
  private pressedButton: string | null = null;
  /** 波形相位（动画用） */
  private waveformPhase = 0;
  /** 入场/状态切换动画进度 0..1 */
  private stateT = 0;
  /** 上一帧屏幕尺寸 */
  private lastScreenW = 800;
  private lastScreenH = 480;
  /** 累计时间（用于波形/脉动等动画） */
  private t = 0;

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.callState = "picker";
    this.script = null;
    this.currentNode = null;
    this.path = [];
    this.ending = null;
    this.verdictFlash = null;
    this.cancelTTS();
  }

  exit(): void {
    super.exit();
    this.cancelTTS();
  }

  pause(): void {
    // 切到后台时暂停 TTS，避免漏字
    this.cancelTTS();
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    this.waveformPhase += dt * 8;
    this.stateT = Math.min(1, this.stateT + dt * 5);

    // 通话态：累计通话时长 + 检测分钟变化
    if (this.callState === "calling") {
      this.callDuration = this.t - this.callStartT;
      const curSec = Math.floor(this.callDuration);
      if (curSec !== this.prevCallSec) {
        // 每整分钟触发一次轻微提示音（仿电话提示）
        if (curSec > 0 && curSec % 60 === 0) {
          playSfx("click");
        }
        this.prevCallSec = curSec;
      }
      // TTS 自动结束检测（Web Speech API 无可靠结束回调，按估算时长判断）
      if (this.ttsPlaying && this.ttsEstimatedDuration > 0) {
        if (this.t - this.ttsStartT >= this.ttsEstimatedDuration) {
          this.ttsPlaying = false;
        }
      }
    }

    // verdict 反馈超时清除
    if (this.verdictFlash && this.t > this.verdictFlash.until) {
      this.verdictFlash = null;
    }
  }

  // ====================================================================
  // 布局
  // ====================================================================

  private getBackBtnRect(): Rect {
    return { x: 8, y: 8, w: 56, h: 32 };
  }

  /** 剧本卡片矩形（picker 状态，2 列网格） */
  private getScriptCardRect(idx: number, screenW: number): Rect {
    const cols = 2;
    const gap = 12;
    const padX = 24;
    const availW = screenW - padX * 2;
    const cardW = Math.floor((availW - gap * (cols - 1)) / cols);
    const cardH = 92;
    const startY = 130;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      x: padX + col * (cardW + gap),
      y: startY + row * (cardH + gap),
      w: cardW,
      h: cardH,
    };
  }

  /** 接线员头像区域（顶部） */
  private getOperatorRect(screenW: number): Rect {
    return { x: screenW / 2 - 56, y: 64, w: 112, h: 112 };
  }

  /** 接线员台词气泡矩形 */
  private getBubbleRect(screenW: number, screenH: number): Rect {
    const w = Math.min(560, screenW - 48);
    const h = 140;
    return { x: (screenW - w) / 2, y: 200, w, h };
  }

  /** 玩家选项按钮矩形 */
  private getChoiceRect(idx: number, total: number, screenW: number, screenH: number): Rect {
    const w = Math.min(560, screenW - 48);
    const x = (screenW - w) / 2;
    const gap = 8;
    const btnH = 56;
    const totalH = total * btnH + (total - 1) * gap;
    const startY = screenH - totalH - 24;
    return { x, y: startY + idx * (btnH + gap), w, h: btnH };
  }

  /** 结局面板矩形 */
  private getEndingRect(screenW: number, screenH: number): Rect {
    const w = Math.min(560, screenW - 48);
    const h = Math.min(360, screenH - 64);
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
  }

  // ====================================================================
  // 渲染
  // ====================================================================

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    this.lastScreenW = screenW;
    this.lastScreenH = screenH;
    drawBackground(ctx, screenW, screenH);

    // 顶部状态栏
    this.renderTopBar(ctx, screenW);

    if (this.callState === "picker") {
      this.renderPicker(ctx, screenW, screenH);
    } else if (this.callState === "calling") {
      this.renderCalling(ctx, screenW, screenH);
    } else if (this.callState === "ending") {
      this.renderEnding(ctx, screenW, screenH);
    }

    drawScanlineOverlay(ctx, screenW, screenH);
    drawNeonCorners(ctx, 0, 0, screenW, screenH, HOTLINE_ACCENT);
  }

  /** 顶部状态栏 */
  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.9)";
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
    ctx.fillStyle = HOTLINE_ACCENT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(HOTLINE_ACCENT, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("📞 96110 反诈专线模拟器", screenW / 2, 24);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /** picker 状态：剧本选择列表 */
  private renderPicker(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    // 顶部说明
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = HOTLINE_ACCENT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(HOTLINE_ACCENT, 0.3);
    ctx.shadowBlur = 6;
    ctx.fillText("// 选择要咨询的诈骗场景", screenW / 2, 80);
    ctx.shadowBlur = 0;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("FRAUD HOTLINE SIMULATOR · 5 个真实剧本 · 接线员将引导你正确处置", screenW / 2, 102);
    ctx.restore();

    // 剧本卡片
    for (let i = 0; i < HOTLINE_SCRIPTS_96110.length; i++) {
      this.renderScriptCard(ctx, i, HOTLINE_SCRIPTS_96110[i]);
    }

    // 底部提示
    ctx.save();
    ctx.font = `500 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("点击剧本开始模拟通话 · 接线员台词将通过浏览器 TTS 朗读", screenW / 2, screenH - 24);
    ctx.restore();
  }

  /** 渲染单个剧本卡片 */
  private renderScriptCard(ctx: CanvasRenderingContext2D, idx: number, script: FBHotlineScript): void {
    const r = this.getScriptCardRect(idx, this.lastScreenW);
    const pressed = this.pressedScriptIdx === idx;
    const codex = getFBCodexEntry(script.typeId);
    const icon = codex?.icon ?? "⚠️";
    const name = codex?.name ?? "未知诈骗类型";

    ctx.save();
    if (pressed) ctx.translate(0, 2);

    // 背景
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, withAlpha(HOTLINE_ACCENT, 0.15));
    g.addColorStop(1, "rgba(10,25,41,0.85)");
    ctx.fillStyle = g;
    ctx.fill();
    // 边框
    const pulse = 0.6 + Math.sin(this.t * 2 + idx * 0.7) * 0.4;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = HOTLINE_ACCENT;
    ctx.shadowColor = HOTLINE_ACCENT;
    ctx.shadowBlur = 4 + pulse * 4;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 左侧色条
    ctx.fillStyle = HOTLINE_ACCENT;
    ctx.fillRect(r.x, r.y, 3, r.h);

    // 图标
    ctx.font = `28px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(icon, r.x + 12, r.y + 12);

    // 标题
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = HOTLINE_ACCENT;
    ctx.fillText(script.title, r.x + 50, r.y + 14);

    // 类型标签（右上）
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(script.typeId, r.x + r.w - 12, r.y + 16);

    // 场景描述（中部，换行）
    ctx.font = `500 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lines = this.wrapText(ctx, script.scenario, r.w - 24, 2);
    lines.forEach((line, i) => ctx.fillText(line, r.x + 12, r.y + 46 + i * 14));

    // 关联类型名（左下）+ 节点数（右下）
    ctx.font = `600 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(HOTLINE_ACCENT, 0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`🏷 ${name}`, r.x + 12, r.y + r.h - 8);
    ctx.textAlign = "right";
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
    ctx.fillText(`${script.nodes.length} 节点 · ${script.takeaways.length} 要点`, r.x + r.w - 12, r.y + r.h - 8);

    ctx.restore();
  }

  /** calling 状态：电话通话界面 */
  private renderCalling(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.script || !this.currentNode) return;

    // 通话背景光晕
    ctx.save();
    const glow = ctx.createRadialGradient(screenW / 2, 120, 0, screenW / 2, 120, 280);
    glow.addColorStop(0, withAlpha(OPERATOR_ACCENT, 0.18));
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 56, screenW, screenH - 56);
    ctx.restore();

    // 接线员头像区
    this.renderOperator(ctx, screenW);

    // 接线员台词气泡
    this.renderOperatorBubble(ctx, screenW, screenH);

    // 玩家选项
    this.renderChoices(ctx, screenW, screenH);

    // 通话时长 + 状态指示（右上角）
    this.renderCallStatus(ctx, screenW);

    // verdict 反馈闪屏
    if (this.verdictFlash) {
      this.renderVerdictFlash(ctx, screenW, screenH);
    }
  }

  /** 接线员头像（圆形 + 波形 + 朗读指示） */
  private renderOperator(ctx: CanvasRenderingContext2D, screenW: number): void {
    const r = this.getOperatorRect(screenW);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const radius = r.w / 2;

    // 外圈脉动光晕（朗读时更明显）
    const pulseR = radius + 8 + Math.sin(this.t * 4) * 4;
    ctx.save();
    const ringG = ctx.createRadialGradient(cx, cy, radius, cx, cy, pulseR + 12);
    ringG.addColorStop(0, withAlpha(OPERATOR_ACCENT, this.ttsPlaying ? 0.5 : 0.25));
    ringG.addColorStop(1, "transparent");
    ctx.fillStyle = ringG;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 头像背景圆
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy - 10, 0, cx, cy, radius);
    g.addColorStop(0, "#1B5FCC");
    g.addColorStop(1, "#0A1929");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    // 边框
    ctx.lineWidth = 2;
    ctx.strokeStyle = OPERATOR_ACCENT;
    ctx.shadowColor = OPERATOR_ACCENT;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 头像 emoji
    ctx.save();
    ctx.font = `48px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("👮", cx, cy);
    ctx.restore();

    // 接线员姓名 + 职级
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = OPERATOR_ACCENT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("反诈中心接线员", cx, r.y + r.h + 8);
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText("Anti-Fraud Hotline Operator", cx, r.y + r.h + 26);
    ctx.restore();

    // 波形动画（朗读时活跃，否则静态低条）
    this.renderWaveform(ctx, cx, r.y + r.h + 44, 120, 16);
  }

  /** 波形动画（一组垂直条） */
  private renderWaveform(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
    const bars = 24;
    const barW = 2;
    const gap = (w - bars * barW) / (bars - 1);
    const startX = cx - w / 2;
    ctx.save();
    for (let i = 0; i < bars; i++) {
      const x = startX + i * (barW + gap);
      // 朗读时：每个条高度按正弦+随机相位变化；静默时：固定低高度
      const phase = this.waveformPhase + i * 0.5;
      const amp = this.ttsPlaying ? 0.7 + Math.sin(phase) * 0.3 : 0.15;
      const noise = this.ttsPlaying ? (Math.sin(phase * 2.3) * 0.5 + 0.5) : 0.5;
      const barH = Math.max(2, h * amp * noise);
      const y = cy - barH / 2;
      ctx.fillStyle = this.ttsPlaying ? OPERATOR_ACCENT : withAlpha(OPERATOR_ACCENT, 0.3);
      ctx.shadowColor = OPERATOR_ACCENT;
      ctx.shadowBlur = this.ttsPlaying ? 4 : 0;
      roundRect(ctx, x, y, barW, barH, 1);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /** 接线员台词气泡 */
  private renderOperatorBubble(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.currentNode) return;
    const r = this.getBubbleRect(screenW, screenH);

    ctx.save();
    // 气泡背景
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, "rgba(15,30,50,0.98)");
    g.addColorStop(1, "rgba(8,17,30,0.98)");
    ctx.fillStyle = g;
    ctx.fill();
    // 边框
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = OPERATOR_ACCENT;
    ctx.shadowColor = OPERATOR_ACCENT;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 顶部小三角（指向头像）
    ctx.fillStyle = "rgba(15,30,50,0.98)";
    ctx.beginPath();
    ctx.moveTo(screenW / 2 - 8, r.y);
    ctx.lineTo(screenW / 2 + 8, r.y);
    ctx.lineTo(screenW / 2, r.y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OPERATOR_ACCENT;
    ctx.beginPath();
    ctx.moveTo(screenW / 2 - 8, r.y);
    ctx.lineTo(screenW / 2, r.y - 8);
    ctx.lineTo(screenW / 2 + 8, r.y);
    ctx.stroke();

    // 台词标签
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = OPERATOR_ACCENT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("// OPERATOR", r.x + 14, r.y + 10);

    // TTS 状态标签（右上）
    ctx.textAlign = "right";
    ctx.fillStyle = this.ttsPlaying ? OPERATOR_ACCENT : withAlpha(Theme.colors.ink.muted, 0.7);
    ctx.fillText(this.ttsPlaying ? "🔊 朗读中..." : "💬 已朗读", r.x + r.w - 14, r.y + 10);

    // 台词文本（自动换行）
    ctx.font = `500 13px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.95);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lines = this.wrapText(ctx, this.currentNode.operator, r.w - 28, 5);
    lines.forEach((line, i) => ctx.fillText(line, r.x + 14, r.y + 32 + i * 18));

    ctx.restore();
  }

  /** 玩家选项按钮列表 */
  private renderChoices(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.currentNode) return;
    const choices = this.currentNode.choices;
    for (let i = 0; i < choices.length; i++) {
      const r = this.getChoiceRect(i, choices.length, screenW, screenH);
      const pressed = this.pressedChoiceIdx === i;
      const choice = choices[i];
      // verdict 颜色预览（不直接揭示，但用色相暗示方向）
      const accent = choice.verdict === "right" ? "#1AD670"
        : choice.verdict === "warn" ? "#FFD666"
        : "#E5353B";

      ctx.save();
      if (pressed) ctx.translate(0, 2);
      // 背景
      roundRect(ctx, r.x, r.y, r.w, r.h, 10);
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, withAlpha(accent, 0.18));
      g.addColorStop(1, "rgba(10,25,41,0.85)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = withAlpha(accent, 0.7);
      ctx.shadowColor = accent;
      ctx.shadowBlur = pressed ? 8 : 4;
      roundRect(ctx, r.x, r.y, r.w, r.h, 10);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 左侧色条
      ctx.fillStyle = accent;
      ctx.fillRect(r.x, r.y, 3, r.h);

      // 选项序号
      ctx.font = `700 14px ${Theme.fonts.mono}`;
      ctx.fillStyle = accent;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String.fromCharCode(65 + i), r.x + 16, r.y + r.h / 2);

      // 选项文本
      ctx.font = `500 13px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.95);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const lines = this.wrapText(ctx, choice.text, r.w - 80, 2);
      const lineH = 16;
      const startY = r.y + r.h / 2 - ((lines.length - 1) * lineH) / 2;
      lines.forEach((line, i) => ctx.fillText(line, r.x + 40, startY + i * lineH));

      ctx.restore();
    }
  }

  /** 通话状态指示（右上角） */
  private renderCallStatus(ctx: CanvasRenderingContext2D, screenW: number): void {
    const mm = Math.floor(this.callDuration / 60);
    const ss = Math.floor(this.callDuration % 60);
    const timeStr = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

    ctx.save();
    // 通话中绿点闪烁
    const blink = 0.5 + 0.5 * Math.sin(this.t * 4);
    ctx.fillStyle = withAlpha(HOTLINE_ACCENT, blink);
    ctx.beginPath();
    ctx.arc(screenW - 100, 24, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = HOTLINE_ACCENT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`📞 ${timeStr}`, screenW - 16, 24);
    ctx.restore();
  }

  /** verdict 反馈闪屏（选择后短暂展示） */
  private renderVerdictFlash(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.verdictFlash) return;
    const v = this.verdictFlash.verdict;
    const color = VERDICT_COLORS[v];
    const remaining = this.verdictFlash.until - this.t;
    const alpha = Math.min(1, remaining / 0.5) * 0.85;

    // 半透明遮罩
    ctx.save();
    ctx.fillStyle = withAlpha(color, alpha * 0.18);
    ctx.fillRect(0, 0, screenW, screenH);

    // 中央反馈卡片
    const cardW = 380;
    const cardH = 100;
    const cx = screenW / 2;
    const cy = screenH / 2;
    roundRect(ctx, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
    ctx.fillStyle = "rgba(15,30,50,0.96)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 顶部色条
    ctx.fillStyle = color;
    ctx.fillRect(cx - cardW / 2 + 2, cy - cardH / 2 + 2, cardW - 4, 3);

    // verdict 标签
    ctx.font = `900 20px ${Theme.fonts.display}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(VERDICT_LABELS[v], cx, cy - 28);
    ctx.shadowBlur = 0;

    // 玩家选择摘要
    ctx.font = `500 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(`你选择了：${this.verdictFlash.choiceText}`, cx, cy - 2);

    // feedback
    ctx.font = `600 12px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.95);
    const fbLines = this.wrapText(ctx, this.verdictFlash.feedback, cardW - 32, 2);
    fbLines.forEach((line, i) => ctx.fillText(line, cx, cy + 18 + i * 16));
    ctx.restore();
  }

  /** ending 状态：通话结束 + 学习要点 */
  private renderEnding(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    if (!this.script || !this.ending) return;
    const r = this.getEndingRect(screenW, screenH);
    const endingColor = ENDING_COLORS[this.ending];

    // 遮罩
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    // 面板
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, "rgba(15,30,50,0.98)");
    g.addColorStop(1, "rgba(8,17,30,0.98)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = endingColor;
    ctx.shadowColor = endingColor;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 裁剪内容区
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.clip();

    let cy = r.y + 16;
    // 顶部色条
    ctx.fillStyle = endingColor;
    ctx.fillRect(r.x + 2, cy, r.w - 4, 3);
    cy += 16;

    // 通话时长 + 结局标签
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const mm = Math.floor(this.callDuration / 60);
    const ss = Math.floor(this.callDuration % 60);
    ctx.fillText(`// CALL ENDED · ${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")} · ${this.path.length} 轮对话`, r.x + 16, cy);
    cy += 18;

    // 结局标题（大字）
    ctx.font = `900 26px ${Theme.fonts.display}`;
    ctx.fillStyle = endingColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = endingColor;
    ctx.shadowBlur = 12;
    ctx.fillText(ENDING_LABELS[this.ending], r.x + r.w / 2, cy);
    ctx.shadowBlur = 0;
    cy += 38;

    // 剧本标题
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.95);
    ctx.fillText(`📞 ${this.script.title}`, r.x + r.w / 2, cy);
    cy += 24;

    // 学习要点标题
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = HOTLINE_ACCENT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("📚 学习要点", r.x + 16, cy);
    cy += 18;

    // 学习要点列表
    ctx.font = `500 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    for (const tip of this.script.takeaways) {
      const lines = this.wrapText(ctx, `• ${tip}`, r.w - 32, 2);
      for (const line of lines) {
        ctx.fillText(line, r.x + 16, cy);
        cy += 15;
      }
      cy += 2;
    }
    cy += 6;

    // 行进路径摘要（可选）
    if (this.path.length > 0 && cy < r.y + r.h - 80) {
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = OPERATOR_ACCENT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("🧭 你的处置路径", r.x + 16, cy);
      cy += 16;
      ctx.font = `500 10px ${Theme.fonts.body}`;
      for (let i = 0; i < this.path.length; i++) {
        if (cy > r.y + r.h - 70) break;
        const step = this.path[i];
        ctx.fillStyle = withAlpha(VERDICT_COLORS[step.verdict], 0.95);
        const summary = `${i + 1}. ${step.choiceText.length > 18 ? step.choiceText.slice(0, 18) + "…" : step.choiceText}`;
        const lines = this.wrapText(ctx, summary, r.w - 32, 1);
        for (const line of lines) {
          ctx.fillText(line, r.x + 16, cy);
          cy += 13;
        }
      }
    }

    ctx.restore();

    // 底部按钮：重新拨打 / 返回列表
    const btnW = (r.w - 48) / 2;
    const btnH = 38;
    const btnY = r.y + r.h - btnH - 16;
    const replay = { x: r.x + 16, y: btnY, w: btnW, h: btnH };
    const back = { x: r.x + 16 + btnW + 16, y: btnY, w: btnW, h: btnH };

    drawButton(ctx, replay.x, replay.y, replay.w, replay.h, "🔄 重新拨打", {
      variant: "primary", accent: HOTLINE_ACCENT,
      pressed: this.pressedButton === "replay",
    });
    drawButton(ctx, back.x, back.y, back.w, back.h, "📋 返回列表", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "backToList",
    });
  }

  // ====================================================================
  // 通话逻辑
  // ====================================================================

  /** 开始通话（从 picker 进入 calling） */
  private startCall(script: FBHotlineScript): void {
    this.script = script;
    this.callState = "calling";
    this.callStartT = this.t;
    this.callDuration = 0;
    this.prevCallSec = 0;
    this.path = [];
    this.ending = null;
    this.verdictFlash = null;
    this.stateT = 0;
    const startNode = script.nodes.find((n) => n.id === script.startNodeId) ?? script.nodes[0];
    this.currentNode = startNode;
    this.speakOperator(startNode.operator);
    playSfx("good");
    vibrateShort();
  }

  /** 玩家选择某选项 */
  private selectChoice(choice: FBHotlineChoice): void {
    if (!this.script || !this.currentNode) return;
    const verdict = choice.verdict ?? "right";
    // 记录路径
    this.path.push({
      nodeId: this.currentNode.id,
      operatorText: this.currentNode.operator,
      choiceText: choice.text,
      verdict,
      feedback: choice.feedback ?? "",
    });
    // 反馈闪屏
    this.verdictFlash = {
      verdict,
      feedback: choice.feedback ?? "",
      choiceText: choice.text,
      until: this.t + 1.6,
    };
    // 音效反馈
    if (verdict === "right") playSfx("good");
    else if (verdict === "warn") playSfx("click");
    else playSfx("bad");
    vibrateShort();

    // 取消当前 TTS，准备播放下一节点的接线员台词
    this.cancelTTS();

    // 判断是否到达结局
    if (choice.next === null || choice.next === undefined) {
      // 终结节点
      this.ending = choice.ending ?? (verdict === "right" ? "verified" : "scam");
      // 延迟切换到 ending 态（让 verdictFlash 先展示完）
      setTimeout(() => {
        this.callState = "ending";
        this.stateT = 0;
      }, 1600);
      return;
    }
    // 进入下一节点
    const nextNode = this.script.nodes.find((n) => n.id === choice.next);
    if (!nextNode) {
      // 兜底：找不到下一节点，按终结处理
      this.ending = "uncertain";
      setTimeout(() => {
        this.callState = "ending";
        this.stateT = 0;
      }, 1600);
      return;
    }
    this.currentNode = nextNode;
    // 延迟朗读下一段台词（让 verdictFlash 先显示）
    setTimeout(() => {
      if (this.callState === "calling" && this.currentNode === nextNode) {
        this.speakOperator(nextNode.operator);
      }
    }, 1200);
  }

  /** 重新拨打当前剧本 */
  private replayCall(): void {
    if (!this.script) return;
    this.startCall(this.script);
  }

  /** 返回剧本列表 */
  private backToPicker(): void {
    this.callState = "picker";
    this.script = null;
    this.currentNode = null;
    this.path = [];
    this.ending = null;
    this.verdictFlash = null;
    this.cancelTTS();
    this.stateT = 0;
  }

  /** Web Speech API 朗读接线员台词 */
  private speakOperator(text: string): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.ttsPlaying = false;
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "zh-CN";
      utter.rate = 0.95;
      utter.pitch = 1.0;
      utter.volume = 1.0;
      // 按字数估算时长（中文 ~4 字/秒，加上停顿）
      this.ttsEstimatedDuration = Math.max(2, text.length / 4 + 1);
      this.ttsStartT = this.t;
      this.ttsPlaying = true;
      utter.onend = () => {
        this.ttsPlaying = false;
      };
      utter.onerror = () => {
        this.ttsPlaying = false;
      };
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("[fb:hotline] TTS speak failed", e);
      this.ttsPlaying = false;
    }
  }

  /** 取消 TTS */
  private cancelTTS(): void {
    this.ttsPlaying = false;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      void e;
    }
  }

  /** 画布文本换行（返回最多 maxLines 行，超长末尾加…） */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
        if (lines.length >= maxLines - 1) break;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length > 0) {
      let last = lines[lines.length - 1];
      while (last.length > 0 && ctx.measureText(last + "…").width > maxWidth) {
        last = last.slice(0, -1);
      }
      if (lines[lines.length - 1] !== last) lines[lines.length - 1] = last + "…";
    }
    return lines;
  }

  // ====================================================================
  // 触摸处理
  // ====================================================================

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    // ending 态：处理底部按钮
    if (this.callState === "ending") {
      if (type === "start") {
        const r = this.getEndingRect(this.lastScreenW, this.lastScreenH);
        const btnW = (r.w - 48) / 2;
        const btnH = 38;
        const btnY = r.y + r.h - btnH - 16;
        const replay = { x: r.x + 16, y: btnY, w: btnW, h: btnH };
        const back = { x: r.x + 16 + btnW + 16, y: btnY, w: btnW, h: btnH };
        if (hitTest(x, y, replay)) {
          this.pressedButton = "replay";
          return true;
        }
        if (hitTest(x, y, back)) {
          this.pressedButton = "backToList";
          return true;
        }
        // 返回按钮（顶部）
        if (hitTest(x, y, this.getBackBtnRect())) {
          this.pressedButton = "back";
          return true;
        }
        return true;
      } else if (type === "end") {
        const pressed = this.pressedButton;
        this.pressedButton = null;
        if (pressed === "replay") {
          this.replayCall();
          playSfx("click");
          vibrateShort();
        } else if (pressed === "backToList") {
          this.backToPicker();
          playSfx("click");
          vibrateShort();
        } else if (pressed === "back") {
          this.director.pop();
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      return true;
    }

    // calling 态：处理选项按钮 + 返回
    if (this.callState === "calling") {
      // verdict 反馈展示期间禁止选项操作（避免误触）
      const verdictShowing = this.verdictFlash !== null;
      if (type === "start") {
        // 返回按钮（顶部）：通话中按返回 = 挂断返回列表
        if (hitTest(x, y, this.getBackBtnRect())) {
          this.pressedButton = "back";
          return true;
        }
        if (verdictShowing) return true;
        // 选项按钮
        if (this.currentNode) {
          const choices = this.currentNode.choices;
          for (let i = 0; i < choices.length; i++) {
            const r = this.getChoiceRect(i, choices.length, this.lastScreenW, this.lastScreenH);
            if (hitTest(x, y, r)) {
              this.pressedChoiceIdx = i;
              return true;
            }
          }
        }
        return true;
      } else if (type === "end") {
        if (this.pressedButton === "back") {
          this.pressedButton = null;
          if (hitTest(x, y, this.getBackBtnRect())) {
            // 挂断并返回列表
            this.cancelTTS();
            this.backToPicker();
            playSfx("click");
            vibrateShort();
          }
          return true;
        }
        if (this.pressedChoiceIdx !== null && !verdictShowing) {
          const idx = this.pressedChoiceIdx;
          this.pressedChoiceIdx = null;
          if (this.currentNode && idx < this.currentNode.choices.length) {
            const r = this.getChoiceRect(idx, this.currentNode.choices.length, this.lastScreenW, this.lastScreenH);
            if (hitTest(x, y, r)) {
              this.selectChoice(this.currentNode.choices[idx]);
            }
          }
          return true;
        }
        this.pressedChoiceIdx = null;
        return true;
      }
      // move：选项按下态跟随
      if (type === "move") return true;
      return true;
    }

    // picker 态：剧本卡片 + 返回
    if (this.callState === "picker") {
      if (type === "start") {
        // 返回按钮
        if (hitTest(x, y, this.getBackBtnRect())) {
          this.pressedButton = "back";
          return true;
        }
        // 剧本卡片
        for (let i = 0; i < HOTLINE_SCRIPTS_96110.length; i++) {
          const r = this.getScriptCardRect(i, this.lastScreenW);
          if (hitTest(x, y, r)) {
            this.pressedScriptIdx = i;
            return true;
          }
        }
        return false;
      } else if (type === "end") {
        if (this.pressedButton === "back") {
          this.pressedButton = null;
          if (hitTest(x, y, this.getBackBtnRect())) {
            this.director.pop();
            playSfx("click");
            vibrateShort();
          }
          return true;
        }
        if (this.pressedScriptIdx !== null) {
          const idx = this.pressedScriptIdx;
          this.pressedScriptIdx = null;
          const r = this.getScriptCardRect(idx, this.lastScreenW);
          if (hitTest(x, y, r) && idx < HOTLINE_SCRIPTS_96110.length) {
            this.startCall(HOTLINE_SCRIPTS_96110[idx]);
          }
          return true;
        }
        return false;
      }
      return false;
    }
    return false;
  }
}
