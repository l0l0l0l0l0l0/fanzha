/**
 * 「诈园区」模式选择场景（v9）
 *
 * 全面升级入口：
 * - 5 模式选择（无尽/剧情/每日/极速/硬核）
 * - 4 难度选择（简单/普通/困难/地狱）—— 仅无尽/极速需要
 * - 5 剧情关卡选择 —— 仅剧情模式显示，按存档解锁
 * - 详情面板：模式说明 + 历史最高分 + 每日规则（每日模式）
 * - 开始按钮 → BriefingScene（透传 mode/difficulty/storyStageIdx）
 *
 * 布局（414×896 逻辑坐标系，纵向）：
 * - 0-56：顶部栏（返回 + 标题 + 96110）
 * - 56-92：分区标题"选择模式"
 * - 92-340：5 模式卡片（2 列 × 3 行，末行单卡 + 累计统计卡）
 * - 340-376：分区标题（难度 / 关卡 / 模式提示）
 * - 376-580：难度选择(4 卡) / 剧情关卡(5 行) / 模式说明
 * - 580-820：详情面板（选中模式说明 + 最高分 + 每日规则）
 * - 820-872：开始任务按钮
 * - 872-896：底部权威条
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawHudLabel,
  hitTest, drawNeonCorners, type Rect,
} from "@/ui/widgets";
import { drawIcon, drawLogo } from "@/ui/icons";
import { playSfx, startBGM } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import { BriefingScene } from "./BriefingScene";
import { BombCodexScene } from "./BombCodexScene";
import { BombHotlineScene } from "./BombHotlineScene";
import { BombToolboxScene } from "./BombToolboxScene";
import { BombLeaderboardScene } from "./BombLeaderboardScene";
import type { BombGameMode, BombDifficulty } from "@/games/bombIsland/types";
import { GAME_MODES, DIFFICULTIES, MODE_ORDER, DIFFICULTY_ORDER } from "@/games/bombIsland/data";
import { STORY_STAGES } from "@/games/bombIsland/dataV2";
import {
  loadV6Save, getStoryMaxUnlocked, getModeHighScore, getDifficultyHighScore,
} from "@/games/bombIsland/storage";
import { getDailyRule, getTodayKey, MODE_LABELS } from "@/games/bombIsland/dataV2";

const ACCENT = Theme.accents["bomb-island"];

/** 布局常量 */
const LAYOUT = {
  topBarH: 56,
  sec1Y: 60,       // "选择模式" 标题
  modeGridY: 92,   // 模式卡片起始
  modeCardH: 72,
  modeGap: 8,
  modeRows: 3,
  sec2Y: 344,      // 第二分区标题
  sec2ContentY: 376,
  detailY: 580,
  startBtnY: 820,
  startBtnH: 48,
  footerY: 880,
};

export class BombIslandModeScene extends Scene {
  /** 当前选中的模式 */
  private selectedMode: BombGameMode = "endless";
  /** 当前选中的难度（仅无尽/极速） */
  private selectedDifficulty: BombDifficulty = "normal";
  /** 当前选中的剧情关卡索引 */
  private selectedStageIdx = 0;
  /** 按下的按钮 ID */
  private pressedButton: string | null = null;
  /** 入场动画进度 */
  private t = 0;
  /** 卡片切换闪烁计时 */
  private switchFlash = 0;

  enter(): void {
    super.enter();
    startBGM("hub");
    // 默认选中第一个已解锁的剧情关卡
    this.selectedStageIdx = Math.min(getStoryMaxUnlocked(), STORY_STAGES.length - 1);
    this.switchFlash = 0;
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    if (this.switchFlash > 0) this.switchFlash -= dt;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    // 入场淡入
    const enterAlpha = Math.min(1, this.enterT * 2.5);
    ctx.save();
    ctx.globalAlpha = enterAlpha;

    // 顶部栏
    this.renderTopBar(ctx, screenW);

    // 分区 1：选择模式
    this.renderSectionLabel(ctx, 16, LAYOUT.sec1Y, screenW - 32, "选择模式 · MODE", ACCENT);
    this.renderModeGrid(ctx, screenW);

    // 分区 2：难度 / 关卡 / 模式说明
    const sec2Title = this.getSection2Title();
    this.renderSectionLabel(ctx, 16, LAYOUT.sec2Y, screenW - 32, sec2Title, ACCENT);
    this.renderSection2Content(ctx, screenW);

    // 详情面板
    this.renderDetailPanel(ctx, screenW);

    // 开始按钮
    this.renderStartButton(ctx, screenW);

    // 底部权威条
    this.renderFooter(ctx, screenW, screenH);

    // 切换闪烁
    if (this.switchFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.switchFlash * 0.25;
      ctx.fillStyle = ACCENT;
      ctx.fillRect(0, 0, screenW, screenH);
      ctx.restore();
    }

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
    drawHudLabel(ctx, backBtn.x + 32, backBtn.y + 11, "Hub");

    // Logo
    drawLogo(ctx, screenW / 2 - 16, 12, 32, false);

    // 标题
    ctx.save();
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(ACCENT, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("诈园区 · 模式选择", screenW / 2, 44);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 96110 水印
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.warn.DEFAULT, 0.6);
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("☎ 96110", screenW - 16, 14);
    ctx.font = `400 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.dim, 0.7);
    ctx.fillText("反诈专线", screenW - 16, 28);
    ctx.restore();
  }

  // ============ 分区标题 ============

  private renderSectionLabel(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, text: string, color: string,
  ): void {
    ctx.save();
    // 左侧色条
    ctx.fillStyle = color;
    ctx.fillRect(x, y + 2, 3, 14);
    // 标题
    ctx.font = `700 12px ${Theme.fonts.mono}`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(text, x + 10, y + 2);
    // 右侧分隔线
    ctx.fillStyle = withAlpha(color, 0.2);
    ctx.fillRect(x + 10 + ctx.measureText(text).width + 12, y + 9, w - 10 - ctx.measureText(text).width - 12, 1);
    ctx.restore();
  }

  // ============ 模式网格 ============

  private renderModeGrid(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const gap = LAYOUT.modeGap;
    const colW = (screenW - pad * 2 - gap) / 2;
    const rowH = LAYOUT.modeCardH;

    for (let i = 0; i < MODE_ORDER.length; i++) {
      const mode = MODE_ORDER[i];
      const def = GAME_MODES[mode];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = pad + col * (colW + gap);
      const y = LAYOUT.modeGridY + row * (rowH + gap);
      const selected = this.selectedMode === mode;
      this.renderModeCard(ctx, x, y, colW, rowH, def, selected);
    }

    // 第 6 格：累计统计卡（第 3 行第 2 列）
    const statX = pad + colW + gap;
    const statY = LAYOUT.modeGridY + 2 * (rowH + gap);
    this.renderStatsCard(ctx, statX, statY, colW, rowH);
  }

  private renderModeCard(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    def: { name: string; desc: string; icon: string; color: string; hint: string },
    selected: boolean,
  ): void {
    ctx.save();
    // 背景
    if (selected) {
      ctx.fillStyle = withAlpha(def.color, 0.18);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 12;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "rgba(18, 42, 66, 0.7)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = withAlpha(def.color, 0.3);
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();

    // 图标
    ctx.save();
    ctx.font = `28px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = def.color;
    if (selected) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
    }
    ctx.fillText(def.icon, x + 28, y + h / 2);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 名称
    ctx.save();
    ctx.font = `700 15px ${Theme.fonts.display}`;
    ctx.fillStyle = selected ? def.color : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(def.name, x + 56, y + 14);
    // 描述
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.75);
    ctx.fillText(def.desc, x + 56, y + 36);
    // hint
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(def.color, selected ? 0.9 : 0.55);
    ctx.fillText(`▸ ${def.hint}`, x + 56, y + 54);
    ctx.restore();

    // 选中标记
    if (selected) {
      ctx.save();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x + w - 14, y + 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderStatsCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const save = loadV6Save();
    ctx.save();
    ctx.fillStyle = "rgba(18, 42, 66, 0.6)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.25);
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    // 标题
    ctx.save();
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("📊 历史战绩", x + 12, y + 10);
    ctx.restore();

    // 数据 2×2
    const items = [
      { label: "累计局数", value: `${save.totalRuns ?? 0}`, color: Theme.colors.ink.DEFAULT },
      { label: "通关波次", value: `${save.totalClearedWaves ?? 0}`, color: Theme.colors.safe.DEFAULT },
      { label: "击败 Boss", value: `${save.totalBossesDefeated ?? 0}`, color: ACCENT },
      { label: "救援受害者", value: `${save.totalVictimsRescued ?? 0}`, color: Theme.colors.flag.DEFAULT },
    ];
    const colW = (w - 24) / 2;
    const rowH = (h - 36) / 2;
    for (let i = 0; i < items.length; i++) {
      const cx = x + 12 + (i % 2) * colW;
      const cy = y + 28 + Math.floor(i / 2) * rowH;
      ctx.save();
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(items[i].label, cx, cy);
      ctx.font = `700 13px ${Theme.fonts.mono}`;
      ctx.fillStyle = items[i].color;
      ctx.fillText(items[i].value, cx, cy + 11);
      ctx.restore();
    }
  }

  // ============ 第二分区内容 ============

  private getSection2Title(): string {
    if (this.selectedMode === "story") return "选择关卡 · STAGE";
    if (GAME_MODES[this.selectedMode].needDifficulty) return "选择难度 · DIFFICULTY";
    return "模式说明 · BRIEFING";
  }

  private renderSection2Content(ctx: CanvasRenderingContext2D, screenW: number): void {
    if (this.selectedMode === "story") {
      this.renderStageList(ctx, screenW);
    } else if (GAME_MODES[this.selectedMode].needDifficulty) {
      this.renderDifficultyRow(ctx, screenW);
    } else {
      this.renderModeBriefing(ctx, screenW);
    }
  }

  /** 难度选择：4 卡横排 */
  private renderDifficultyRow(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const gap = 8;
    const cardW = (screenW - pad * 2 - gap * 3) / 4;
    const cardH = 92;
    const y = LAYOUT.sec2ContentY;

    for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
      const diff = DIFFICULTY_ORDER[i];
      const def = DIFFICULTIES[diff];
      const x = pad + i * (cardW + gap);
      const selected = this.selectedDifficulty === diff;
      const best = getDifficultyHighScore(diff);

      ctx.save();
      if (selected) {
        ctx.fillStyle = withAlpha(def.color, 0.18);
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 10;
        ctx.strokeRect(x, y, cardW, cardH);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "rgba(18, 42, 66, 0.7)";
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeStyle = withAlpha(def.color, 0.3);
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cardW, cardH);
      }
      ctx.restore();

      // 名称
      ctx.save();
      ctx.font = `700 13px ${Theme.fonts.display}`;
      ctx.fillStyle = selected ? def.color : Theme.colors.ink.DEFAULT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(def.name, x + cardW / 2, y + 10);
      // 描述
      ctx.font = `400 8px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.7);
      ctx.fillText(def.desc, x + cardW / 2, y + 30);
      // 数值标签
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(def.color, 0.85);
      ctx.fillText(`HP×${def.bossHpMul}`, x + cardW / 2, y + 50);
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
      ctx.fillText(`得分×${def.scoreMul}`, x + cardW / 2, y + 62);
      // 最高分
      ctx.font = `700 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = best > 0 ? Theme.colors.flag.DEFAULT : Theme.colors.ink.dim;
      ctx.fillText(best > 0 ? `最高 ${best}` : "未挑战", x + cardW / 2, y + 76);
      ctx.restore();
    }
  }

  /** 剧情关卡列表：5 行 */
  private renderStageList(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const gap = 6;
    const rowH = 36;
    const maxUnlocked = getStoryMaxUnlocked();
    const y0 = LAYOUT.sec2ContentY;

    for (let i = 0; i < STORY_STAGES.length; i++) {
      const stage = STORY_STAGES[i];
      const y = y0 + i * (rowH + gap);
      const locked = i > maxUnlocked;
      const selected = this.selectedStageIdx === i && !locked;
      const cleared = loadV6Save().storyClearedStages.includes(i);

      ctx.save();
      if (selected) {
        ctx.fillStyle = withAlpha(stage.themeColor, 0.18);
        ctx.fillRect(pad, y, screenW - pad * 2, rowH);
        ctx.strokeStyle = stage.themeColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = stage.themeColor;
        ctx.shadowBlur = 8;
        ctx.strokeRect(pad, y, screenW - pad * 2, rowH);
        ctx.shadowBlur = 0;
      } else if (locked) {
        ctx.fillStyle = "rgba(10, 20, 35, 0.6)";
        ctx.fillRect(pad, y, screenW - pad * 2, rowH);
        ctx.strokeStyle = Theme.colors.ink.dim;
        ctx.lineWidth = 1;
        ctx.strokeRect(pad, y, screenW - pad * 2, rowH);
      } else {
        ctx.fillStyle = "rgba(18, 42, 66, 0.7)";
        ctx.fillRect(pad, y, screenW - pad * 2, rowH);
        ctx.strokeStyle = withAlpha(stage.themeColor, 0.35);
        ctx.lineWidth = 1;
        ctx.strokeRect(pad, y, screenW - pad * 2, rowH);
      }
      ctx.restore();

      // 图标
      ctx.save();
      ctx.font = `18px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = locked ? Theme.colors.ink.dim : stage.themeColor;
      ctx.fillText(locked ? "🔒" : stage.icon, pad + 18, y + rowH / 2);
      ctx.restore();

      // 关卡名
      ctx.save();
      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = locked ? Theme.colors.ink.dim : (selected ? stage.themeColor : Theme.colors.ink.DEFAULT);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(stage.name, pad + 40, y + rowH / 2);
      ctx.restore();

      // 右侧状态
      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      if (locked) {
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.fillText("未解锁", screenW - pad - 12, y + rowH / 2);
      } else if (cleared) {
        ctx.fillStyle = Theme.colors.safe.DEFAULT;
        ctx.fillText("✓ 已通关", screenW - pad - 12, y + rowH / 2);
      } else {
        ctx.fillStyle = stage.themeColor;
        ctx.fillText(`${stage.passWaves} 波`, screenW - pad - 12, y + rowH / 2);
      }
      ctx.restore();
    }
  }

  /** 模式说明（每日/硬核模式无难度选择时显示） */
  private renderModeBriefing(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const def = GAME_MODES[this.selectedMode];
    const y = LAYOUT.sec2ContentY;
    const h = 120;

    ctx.save();
    ctx.fillStyle = withAlpha(def.color, 0.06);
    ctx.fillRect(pad, y, screenW - pad * 2, h);
    ctx.strokeStyle = withAlpha(def.color, 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, y, screenW - pad * 2, h);
    ctx.restore();

    // 每日模式：显示今日规则
    if (this.selectedMode === "daily") {
      const rule = getDailyRule(getTodayKey());
      ctx.save();
      ctx.font = `700 13px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`📅 今日规则：${rule.name}`, pad + 14, y + 12);
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
      this.drawWrappedText(ctx, rule.desc, pad + 14, y + 34, screenW - pad * 2 - 28, 15);
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.flag.DEFAULT;
      ctx.fillText(`奖励倍率 ×${rule.rewardMul}  ·  ${rule.maxWave} 波上限`, pad + 14, y + 70);
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText(`日期：${getTodayKey()}`, pad + 14, y + 88);
      // 历史最佳
      const prevBest = loadV6Save().dailyRecords[getTodayKey()] ?? 0;
      ctx.fillStyle = prevBest > 0 ? Theme.colors.neon.DEFAULT : Theme.colors.ink.dim;
      ctx.textAlign = "right";
      ctx.fillText(prevBest > 0 ? `今日最高 ${prevBest}` : "今日未挑战", screenW - pad - 14, y + 88);
      ctx.restore();
      return;
    }

    // 硬核模式说明
    if (this.selectedMode === "hardcore") {
      ctx.save();
      ctx.font = `700 13px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.warn.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("💀 极限挑战规则", pad + 14, y + 12);
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
      this.drawWrappedText(ctx, "民心值仅 1 点，Boss 阶段切换时若未及时压制将直接终局。一击必杀的极限挑战，仅推荐资深指挥官。", pad + 14, y + 34, screenW - pad * 2 - 28, 15);
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.warn.glow;
      ctx.fillText("失败即终局 · 无道具补给 · 民心归零", pad + 14, y + 76);
      const best = getModeHighScore("hardcore");
      ctx.fillStyle = best > 0 ? Theme.colors.flag.DEFAULT : Theme.colors.ink.dim;
      ctx.textAlign = "right";
      ctx.fillText(best > 0 ? `最高 ${best}` : "未挑战", screenW - pad - 14, y + 76);
      ctx.restore();
      return;
    }

    // 通用模式说明
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.drawWrappedText(ctx, def.desc + "。" + def.hint + "。", pad + 14, y + 14, screenW - pad * 2 - 28, 16);
    const best = getModeHighScore(this.selectedMode);
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = best > 0 ? Theme.colors.flag.DEFAULT : Theme.colors.ink.dim;
    ctx.fillText(best > 0 ? `历史最高分：${best}` : "尚无记录", pad + 14, y + 80);
    ctx.restore();
  }

  // ============ 详情面板 ============

  private renderDetailPanel(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const y = LAYOUT.detailY;
    const h = 232;
    const def = GAME_MODES[this.selectedMode];

    drawPanel(ctx, pad, y, screenW - pad * 2, h, { borderColor: withAlpha(def.color, 0.5), cut: 8 });
    drawNeonCorners(ctx, pad, y, screenW - pad * 2, h, def.color, 10);

    // 标题行
    ctx.save();
    ctx.font = `28px ${Theme.fonts.body}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = def.color;
    ctx.fillText(def.icon, pad + 16, y + 14);
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = def.color;
    ctx.shadowColor = withAlpha(def.color, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(def.name, pad + 52, y + 16);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(MODE_LABELS[this.selectedMode] ?? "", pad + 52, y + 40);
    ctx.restore();

    // 当前选择摘要
    let summary = "";
    if (this.selectedMode === "story") {
      const stage = STORY_STAGES[this.selectedStageIdx];
      summary = `关卡：${stage?.name ?? "-"}  ·  ${stage?.passWaves ?? 0} 波  ·  拆除率 ≥ ${(stage?.passDestroyRate ?? 0) * 100}%`;
    } else if (def.needDifficulty) {
      const diff = DIFFICULTIES[this.selectedDifficulty];
      summary = `难度：${diff.name}  ·  Boss HP ×${diff.bossHpMul}  ·  得分 ×${diff.scoreMul}`;
    } else if (this.selectedMode === "daily") {
      summary = `每日挑战  ·  ${getDailyRule(getTodayKey()).maxWave} 波上限  ·  奖励 ×${getDailyRule(getTodayKey()).rewardMul}`;
    } else {
      summary = def.desc;
    }

    ctx.save();
    ctx.fillStyle = withAlpha(def.color, 0.08);
    ctx.fillRect(pad + 16, y + 60, screenW - pad * 2 - 32, 28);
    ctx.fillStyle = def.color;
    ctx.fillRect(pad + 16, y + 60, 3, 28);
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.92);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(summary, pad + 28, y + 74);
    ctx.restore();

    // 模式提示
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.8);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.drawWrappedText(ctx, `▸ ${def.hint}`, pad + 16, y + 100, screenW - pad * 2 - 32, 16);
    ctx.restore();

    // 历史最高分
    const best = getModeHighScore(this.selectedMode);
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("历史最高分", pad + 16, y + 150);
    ctx.font = `700 22px ${Theme.fonts.mono}`;
    ctx.fillStyle = best > 0 ? Theme.colors.flag.DEFAULT : Theme.colors.ink.dim;
    ctx.shadowColor = best > 0 ? withAlpha(Theme.colors.flag.DEFAULT, 0.4) : "transparent";
    ctx.shadowBlur = best > 0 ? 6 : 0;
    ctx.fillText(best > 0 ? String(best) : "—", pad + 16, y + 166);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 右侧：历史最高评级
    const save = loadV6Save();
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("历史最高评级", screenW - pad - 16, y + 150);
    const ratingColors: Record<string, string> = {
      F: "#888888", D: "#FF5A2A", C: "#FFB020", B: "#FFD666",
      A: "#52C41A", S: "#00E5FF", SS: "#B388FF", SSS: "#FF7A1A",
    };
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = ratingColors[save.bestRating] ?? "#888888";
    ctx.shadowColor = withAlpha(ratingColors[save.bestRating] ?? "#888888", 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText(save.bestRating, screenW - pad - 16, y + 166);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 底部功能页入口（4 个小按钮）
    const fnBtns = this.getFnEntryRects(screenW);
    const fnDefs = [
      { icon: "📖", label: "图鉴馆", color: "#B388FF" },
      { icon: "☎", label: "96110", color: "#1AD670" },
      { icon: "🛡", label: "工具箱", color: "#00E5FF" },
      { icon: "🏆", label: "排行", color: "#FFD666" },
    ];
    for (let i = 0; i < fnBtns.length; i++) {
      const r = fnBtns[i];
      const d = fnDefs[i];
      const pressed = this.pressedButton === `fn-${i}`;
      drawPanel(ctx, r.x, r.y, r.w, r.h, {
        borderColor: withAlpha(d.color, pressed ? 0.9 : 0.5),
        bgColor: withAlpha(d.color, pressed ? 0.18 : 0.08),
        cut: 6,
      });
      ctx.save();
      ctx.font = `16px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = d.color;
      ctx.fillText(d.icon, r.x + r.w / 2, r.y + 11);
      ctx.font = `600 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
      ctx.fillText(d.label, r.x + r.w / 2, r.y + 26);
      ctx.restore();
    }
  }

  /** v10：4 个功能页入口按钮坐标 */
  private getFnEntryRects(screenW: number): Rect[] {
    const pad = 16;
    const y = LAYOUT.detailY + 196;
    const h = 34;
    const gap = 6;
    const w = (screenW - pad * 2 - gap * 3) / 4;
    return [0, 1, 2, 3].map(i => ({ x: pad + i * (w + gap), y, w, h }));
  }

  // ============ 开始按钮 ============

  private renderStartButton(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 16;
    const y = LAYOUT.startBtnY;
    const h = LAYOUT.startBtnH;
    const def = GAME_MODES[this.selectedMode];

    let label = "开始任务";
    let subText = `ENTER ${this.selectedMode.toUpperCase()}`;
    if (this.selectedMode === "story") {
      label = `进入关卡 ${this.selectedStageIdx + 1}`;
      subText = STORY_STAGES[this.selectedStageIdx]?.id ?? "";
    }

    drawButton(ctx, pad, y, screenW - pad * 2, h, label, {
      variant: "primary",
      accent: def.color,
      pressed: this.pressedButton === "start",
      subText,
    });
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
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.fillText("12321", 108, y + (screenH - y) / 2);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(" 举报渠道", 144, y + (screenH - y) / 2);
    ctx.textAlign = "right";
    ctx.fillText("全民反诈 · 天下无诈", screenW - 12, y + (screenH - y) / 2);
    ctx.restore();
  }

  // ============ 工具 ============

  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number, maxWidth: number, lineHeight: number,
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
      // 模式卡片
      const modeRects = this.getModeCardRects(screenW);
      for (let i = 0; i < modeRects.length; i++) {
        if (hitTest(x, y, modeRects[i])) {
          this.pressedButton = `mode-${i}`;
          return true;
        }
      }
      // 难度卡片
      if (GAME_MODES[this.selectedMode].needDifficulty) {
        const diffRects = this.getDifficultyCardRects(screenW);
        for (let i = 0; i < diffRects.length; i++) {
          if (hitTest(x, y, diffRects[i])) {
            this.pressedButton = `diff-${i}`;
            return true;
          }
        }
      }
      // 剧情关卡
      if (this.selectedMode === "story") {
        const stageRects = this.getStageRects(screenW);
        const maxUnlocked = getStoryMaxUnlocked();
        for (let i = 0; i < stageRects.length; i++) {
          if (hitTest(x, y, stageRects[i]) && i <= maxUnlocked) {
            this.pressedButton = `stage-${i}`;
            return true;
          }
        }
      }
      // 开始按钮
      const startBtn: Rect = { x: 16, y: LAYOUT.startBtnY, w: screenW - 32, h: LAYOUT.startBtnH };
      if (hitTest(x, y, startBtn)) {
        this.pressedButton = "start";
        return true;
      }
      // v10 功能页入口
      const fnRects = this.getFnEntryRects(screenW);
      for (let i = 0; i < fnRects.length; i++) {
        if (hitTest(x, y, fnRects[i])) {
          this.pressedButton = `fn-${i}`;
          return true;
        }
      }
      return false;
    }

    if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;

      // 返回
      const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
      if (pressed === "back" && hitTest(x, y, backBtn)) {
        playSfx("click");
        this.director.pop();
        return true;
      }

      // 模式选择
      if (pressed?.startsWith("mode-")) {
        const idx = parseInt(pressed.slice(5), 10);
        const modeRects = this.getModeCardRects(screenW);
        if (idx < MODE_ORDER.length && hitTest(x, y, modeRects[idx])) {
          const newMode = MODE_ORDER[idx];
          if (newMode !== this.selectedMode) {
            this.selectedMode = newMode;
            this.switchFlash = 0.4;
            playSfx("click");
            postFX.flash(GAME_MODES[newMode].color, 0.2, 0.3);
          }
          return true;
        }
      }

      // 难度选择
      if (pressed?.startsWith("diff-")) {
        const idx = parseInt(pressed.slice(5), 10);
        const diffRects = this.getDifficultyCardRects(screenW);
        if (idx < DIFFICULTY_ORDER.length && hitTest(x, y, diffRects[idx])) {
          const newDiff = DIFFICULTY_ORDER[idx];
          if (newDiff !== this.selectedDifficulty) {
            this.selectedDifficulty = newDiff;
            playSfx("click");
            postFX.flash(DIFFICULTIES[newDiff].color, 0.18, 0.25);
          }
          return true;
        }
      }

      // 剧情关卡选择
      if (pressed?.startsWith("stage-")) {
        const idx = parseInt(pressed.slice(6), 10);
        const stageRects = this.getStageRects(screenW);
        const maxUnlocked = getStoryMaxUnlocked();
        if (idx < STORY_STAGES.length && idx <= maxUnlocked && hitTest(x, y, stageRects[idx])) {
          if (idx !== this.selectedStageIdx) {
            this.selectedStageIdx = idx;
            playSfx("click");
            postFX.flash(STORY_STAGES[idx].themeColor, 0.2, 0.3);
          }
          return true;
        }
      }

      // 开始按钮
      if (pressed === "start") {
        const startBtn: Rect = { x: 16, y: LAYOUT.startBtnY, w: screenW - 32, h: LAYOUT.startBtnH };
        if (hitTest(x, y, startBtn)) {
          playSfx("click");
          this.launchGame();
          return true;
        }
      }

      // v10 功能页入口
      if (pressed?.startsWith("fn-")) {
        const idx = parseInt(pressed.slice(3), 10);
        const fnRects = this.getFnEntryRects(screenW);
        if (idx >= 0 && idx < 4 && hitTest(x, y, fnRects[idx])) {
          playSfx("click");
          const scenes = [
            new BombCodexScene(this.director),
            new BombHotlineScene(this.director),
            new BombToolboxScene(this.director),
            new BombLeaderboardScene(this.director),
          ];
          this.director.push(scenes[idx], undefined, "slide");
          return true;
        }
      }
      return true;
    }

    return false;
  }

  private getModeCardRects(screenW: number): Rect[] {
    const pad = 16;
    const gap = LAYOUT.modeGap;
    const colW = (screenW - pad * 2 - gap) / 2;
    const rowH = LAYOUT.modeCardH;
    const rects: Rect[] = [];
    for (let i = 0; i < MODE_ORDER.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      rects.push({
        x: pad + col * (colW + gap),
        y: LAYOUT.modeGridY + row * (rowH + gap),
        w: colW,
        h: rowH,
      });
    }
    return rects;
  }

  private getDifficultyCardRects(screenW: number): Rect[] {
    const pad = 16;
    const gap = 8;
    const cardW = (screenW - pad * 2 - gap * 3) / 4;
    const cardH = 92;
    const y = LAYOUT.sec2ContentY;
    const rects: Rect[] = [];
    for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
      rects.push({
        x: pad + i * (cardW + gap),
        y, w: cardW, h: cardH,
      });
    }
    return rects;
  }

  private getStageRects(screenW: number): Rect[] {
    const pad = 16;
    const gap = 6;
    const rowH = 36;
    const y0 = LAYOUT.sec2ContentY;
    const rects: Rect[] = [];
    for (let i = 0; i < STORY_STAGES.length; i++) {
      rects.push({
        x: pad,
        y: y0 + i * (rowH + gap),
        w: screenW - pad * 2,
        h: rowH,
      });
    }
    return rects;
  }

  /** 启动游戏：进入 BriefingScene，透传模式配置 */
  private launchGame(): void {
    const params: Record<string, unknown> = {
      gameId: "bomb-island",
      mode: this.selectedMode,
    };
    if (GAME_MODES[this.selectedMode].needDifficulty) {
      params.difficulty = this.selectedDifficulty;
    }
    if (this.selectedMode === "story") {
      params.storyStageIdx = this.selectedStageIdx;
    }
    postFX.flash(ACCENT, 0.3, 0.4);
    this.director.replace(new BriefingScene(this.director), params, "slide");
  }
}
