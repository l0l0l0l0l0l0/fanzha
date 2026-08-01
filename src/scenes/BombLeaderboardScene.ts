/**
 * 本地排行榜场景（BombLeaderboardScene）
 *
 * 展示 NPC + 玩家成绩排行：
 * - 顶部栏：返回 + 标题"战绩排行" + 96110 徽章
 * - 筛选区：6 个模式 tab（全部/无尽/剧情/每日/极速/硬核）
 * - 排行列表：NPC + 玩家成绩按分数降序，前 3 名金银铜样式，玩家高亮
 * - 底部统计：本局最高分 / 最高评级 / 累计局数
 * - 底部权威条
 *
 * 布局（414×896 逻辑坐标系，纵向）：
 * - 0-56：顶部栏
 * - 56-100：模式筛选 tab
 * - 100-820：排行榜列表（每行 56px，最多 12 行）
 * - 820-872：本局统计
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
import {
  LOCAL_RANK_NPCS, buildLocalRank, getTodayKeyBomb,
} from "@/games/bombIsland/dataV3";
import { loadV6Save } from "@/games/bombIsland/storage";
import { GAME_MODES, MODE_ORDER } from "@/games/bombIsland/data";
import type {
  BombGameMode, BombLocalRankEntry, BombTierRating,
} from "@/games/bombIsland/types";

const ACCENT = Theme.accents["bomb-island"];

type FilterMode = "all" | BombGameMode;

/** 布局常量 */
const LAYOUT = {
  topBarH: 56,
  filterY: 56,
  filterH: 44,
  listY: 100,
  listH: 720,
  rowH: 56,
  statsY: 820,
  statsH: 52,
  footerY: 872,
};

/** 筛选 tab */
const FILTERS: { id: FilterMode; label: string }[] = [
  { id: "all",      label: "全部" },
  { id: "endless",  label: "无尽" },
  { id: "story",    label: "剧情" },
  { id: "daily",    label: "每日" },
  { id: "speedrun", label: "极速" },
  { id: "hardcore", label: "硬核" },
];

/** 评级配色 */
const RATING_COLORS: Record<BombTierRating, string> = {
  F: "#888888", D: "#FF5A2A", C: "#FFB020", B: "#FFD666",
  A: "#52C41A", S: "#00E5FF", SS: "#B388FF", SSS: "#FF7A1A",
};

/** 前 3 名奖牌色 */
const MEDAL_COLORS = ["#FFD666", "#C0C0C0", "#CD7F32"];

/** 模式中文名 */
const MODE_LABELS: Record<BombGameMode, string> = {
  endless: "无尽",
  story: "剧情",
  daily: "每日",
  speedrun: "极速",
  hardcore: "硬核",
};

/** 头像 emoji 池（按名字 hash 选） */
const AVATAR_POOL = ["🦸", "🧑‍✈", "👮", "🥷", "🧑‍🚒", "💂", "🧑‍🔧", "🧙", "🦰", "🧔"];

function avatarFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return AVATAR_POOL[h % AVATAR_POOL.length];
}

export class BombLeaderboardScene extends Scene {
  /** 当前筛选模式 */
  private activeFilter: FilterMode = "all";
  /** 按下的按钮 ID */
  private pressedButton: string | null = null;
  /** 入场动画计时 */
  private t = 0;

  enter(): void {
    super.enter();
    startBGM("hub");
    this.pressedButton = null;
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    const enterAlpha = Math.min(1, this.enterT * 2.5);
    ctx.save();
    ctx.globalAlpha = enterAlpha;

    this.renderTopBar(ctx, screenW);
    this.renderFilters(ctx, screenW);
    this.renderList(ctx, screenW);
    this.renderStats(ctx, screenW);
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
    ctx.fillText("战绩排行", screenW / 2, 44);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 96110 徽章
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

  // ============ 筛选 tab ============

  private renderFilters(ctx: CanvasRenderingContext2D, screenW: number): void {
    const pad = 8;
    const gap = 4;
    const tabCount = FILTERS.length;
    const tabW = (screenW - pad * 2 - gap * (tabCount - 1)) / tabCount;
    const y = LAYOUT.filterY + 6;
    const h = LAYOUT.filterH - 12;

    for (let i = 0; i < tabCount; i++) {
      const f = FILTERS[i];
      const x = pad + i * (tabW + gap);
      const active = this.activeFilter === f.id;
      const def = f.id === "all" ? null : GAME_MODES[f.id as BombGameMode];
      const color = def?.color ?? ACCENT;

      ctx.save();
      if (active) {
        ctx.fillStyle = withAlpha(color, 0.2);
        ctx.fillRect(x, y, tabW, h);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.strokeRect(x, y, tabW, h);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "rgba(18, 42, 66, 0.7)";
        ctx.fillRect(x, y, tabW, h);
        ctx.strokeStyle = withAlpha(color, 0.3);
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tabW, h);
      }
      ctx.restore();

      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = active ? color : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.label, x + tabW / 2, y + h / 2);
      ctx.restore();
    }

    // 分隔线
    ctx.save();
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, LAYOUT.filterY + LAYOUT.filterH - 1, screenW, 1);
    ctx.restore();
  }

  // ============ 排行榜列表 ============

  /** 构建玩家成绩条目 */
  private buildPlayerEntry(): Omit<BombLocalRankEntry, "rank"> {
    const save = loadV6Save();
    const bestScore = save.bestScore ?? 0;
    const bestRating = save.bestRating ?? "F";
    // 取最高分模式
    let bestMode: BombGameMode = "endless";
    let modeBest = -1;
    for (const m of MODE_ORDER) {
      const s = save.modeHighScores[m] ?? 0;
      if (s > modeBest) {
        modeBest = s;
        bestMode = m;
      }
    }
    return {
      name: "指挥官（你）",
      isPlayer: true,
      score: bestScore,
      rating: bestRating,
      gameMode: bestMode,
      date: getTodayKeyBomb(),
      perfect: false,
    };
  }

  /** 取当前筛选下的展示列表 */
  private getDisplayList(): BombLocalRankEntry[] {
    const player = this.buildPlayerEntry();
    // 用 buildLocalRank 取完整排序（topN 取大一点以包含全部 NPC+玩家）
    const full = buildLocalRank(player, 50);
    if (this.activeFilter === "all") return full.slice(0, 12);
    return full.filter(e => e.gameMode === this.activeFilter).slice(0, 12);
  }

  private renderList(ctx: CanvasRenderingContext2D, screenW: number): void {
    const list = this.getDisplayList();

    // 列表区背景面板
    drawPanel(ctx, 8, LAYOUT.listY, screenW - 16, LAYOUT.listH, {
      borderColor: withAlpha(ACCENT, 0.25), cut: 8,
    });

    // 列表标题行
    ctx.save();
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("#", 24, LAYOUT.listY + 14);
    ctx.fillText("玩家", 64, LAYOUT.listY + 14);
    ctx.textAlign = "center";
    ctx.fillText("段位", screenW * 0.62, LAYOUT.listY + 14);
    ctx.fillText("模式", screenW * 0.76, LAYOUT.listY + 14);
    ctx.textAlign = "right";
    ctx.fillText("分数", screenW - 60, LAYOUT.listY + 14);
    ctx.fillText("日期", screenW - 16, LAYOUT.listY + 14);
    ctx.restore();

    // 分隔线
    ctx.save();
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.6);
    ctx.fillRect(16, LAYOUT.listY + 24, screenW - 32, 1);
    ctx.restore();

    if (list.length === 0) {
      ctx.save();
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.7);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("该模式下暂无成绩", screenW / 2, LAYOUT.listY + LAYOUT.listH / 2);
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.dim, 0.7);
      ctx.fillText("去诈园区战斗一场吧", screenW / 2, LAYOUT.listY + LAYOUT.listH / 2 + 18);
      ctx.restore();
      return;
    }

    // 列表行
    const rowY0 = LAYOUT.listY + 28;
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      // 注意：entry.rank 是在 full 列表中的排名（all 模式下），筛选模式下重新按位置展示
      const displayRank = i + 1;
      this.renderRow(ctx, 16, rowY0 + i * LAYOUT.rowH, screenW - 32, LAYOUT.rowH, entry, displayRank);
    }
  }

  private renderRow(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    entry: BombLocalRankEntry, displayRank: number,
  ): void {
    const isPlayer = entry.isPlayer;
    const isTop3 = displayRank <= 3;

    // 行背景
    ctx.save();
    if (isPlayer) {
      // 玩家高亮（accent 边框 + 微染色）
      ctx.fillStyle = withAlpha(ACCENT, 0.12);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 6;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
    } else if (isTop3) {
      ctx.fillStyle = withAlpha(MEDAL_COLORS[displayRank - 1], 0.06);
      ctx.fillRect(x, y, w, h);
    } else if (displayRank % 2 === 0) {
      ctx.fillStyle = "rgba(18, 42, 66, 0.4)";
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();

    // 排名（前 3 名奖牌）
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (isTop3) {
      const medal = MEDAL_COLORS[displayRank - 1];
      ctx.fillStyle = medal;
      ctx.shadowColor = medal;
      ctx.shadowBlur = 6;
      ctx.font = `700 14px ${Theme.fonts.mono}`;
      ctx.fillText(["🥇", "🥈", "🥉"][displayRank - 1], x + 14, y + h / 2);
    } else {
      ctx.font = `700 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText(String(displayRank), x + 14, y + h / 2);
    }
    ctx.restore();

    // 头像 emoji
    ctx.save();
    ctx.font = `20px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(avatarFor(entry.name), x + 44, y + h / 2);
    ctx.restore();

    // 名字
    ctx.save();
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = isPlayer ? ACCENT : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let name = entry.name;
    if (name.length > 8) name = name.slice(0, 8) + "…";
    ctx.fillText(name, x + 64, y + h / 2);
    if (entry.perfect) {
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.flag.DEFAULT;
      ctx.fillText("★", x + 64 + ctx.measureText(name).width + 6, y + h / 2);
    }
    ctx.restore();

    // 段位
    ctx.save();
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = RATING_COLORS[entry.rating] ?? Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(RATING_COLORS[entry.rating] ?? "#888", 0.4);
    ctx.shadowBlur = 4;
    ctx.fillText(entry.rating, x + w * 0.56, y + h / 2);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 模式标签
    ctx.save();
    const modeColor = GAME_MODES[entry.gameMode]?.color ?? Theme.colors.ink.muted;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = modeColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(MODE_LABELS[entry.gameMode] ?? entry.gameMode, x + w * 0.72, y + h / 2);
    ctx.restore();

    // 分数
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.mono}`;
    ctx.fillStyle = isPlayer ? ACCENT : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(entry.score.toLocaleString(), x + w - 64, y + h / 2);
    ctx.restore();

    // 日期
    ctx.save();
    ctx.font = `400 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    // 仅展示 MM-DD
    const parts = entry.date.split("-");
    const md = parts.length >= 3 ? `${parts[1]}-${parts[2]}` : entry.date;
    ctx.fillText(md, x + w - 12, y + h / 2);
    ctx.restore();
  }

  // ============ 底部统计 ============

  private renderStats(ctx: CanvasRenderingContext2D, screenW: number): void {
    const save = loadV6Save();
    const y = LAYOUT.statsY;
    const h = LAYOUT.statsH;
    const pad = 8;
    const gap = 6;
    const colW = (screenW - pad * 2 - gap * 2) / 3;

    const items = [
      { label: "最高分", value: (save.bestScore ?? 0).toLocaleString(), color: ACCENT },
      { label: "最高评级", value: save.bestRating ?? "F", color: RATING_COLORS[save.bestRating ?? "F"] ?? "#888" },
      { label: "累计局数", value: String(save.totalRuns ?? 0), color: Theme.colors.neon.DEFAULT },
    ];

    for (let i = 0; i < items.length; i++) {
      const x = pad + i * (colW + gap);
      ctx.save();
      ctx.fillStyle = "rgba(18, 42, 66, 0.7)";
      ctx.fillRect(x, y, colW, h);
      ctx.strokeStyle = withAlpha(items[i].color, 0.4);
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, colW, h);
      // 顶部色条
      ctx.fillStyle = items[i].color;
      ctx.fillRect(x, y, colW, 2);
      ctx.restore();

      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(items[i].label, x + 10, y + 8);
      ctx.font = `700 16px ${Theme.fonts.mono}`;
      ctx.fillStyle = items[i].color;
      ctx.shadowColor = withAlpha(items[i].color, 0.4);
      ctx.shadowBlur = 6;
      ctx.fillText(items[i].value, x + 10, y + 24);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
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

  // ============ 命中区域计算 ============

  private getFilterRects(screenW: number): Rect[] {
    const pad = 8;
    const gap = 4;
    const tabCount = FILTERS.length;
    const tabW = (screenW - pad * 2 - gap * (tabCount - 1)) / tabCount;
    const y = LAYOUT.filterY + 6;
    const h = LAYOUT.filterH - 12;
    const rects: Rect[] = [];
    for (let i = 0; i < tabCount; i++) {
      rects.push({ x: pad + i * (tabW + gap), y, w: tabW, h });
    }
    return rects;
  }

  // ============ 触摸处理 ============

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
    if (type === "start") {
      // 返回按钮
      const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
      if (hitTest(x, y, backBtn)) {
        this.pressedButton = "back";
        return true;
      }
      // 筛选 tab
      const filterRects = this.getFilterRects(this.director.screenWidth);
      for (let i = 0; i < filterRects.length; i++) {
        if (hitTest(x, y, filterRects[i])) {
          this.pressedButton = `filter-${i}`;
          return true;
        }
      }
      return false;
    }

    if (type === "end") {
      // 返回按钮
      const backBtn: Rect = { x: 16, y: 12, w: 56, h: 32 };
      if (this.pressedButton === "back" && hitTest(x, y, backBtn)) {
        this.pressedButton = null;
        playSfx("click");
        this.director.pop();
        return true;
      }
      // 筛选 tab
      if (this.pressedButton?.startsWith("filter-")) {
        const idx = parseInt(this.pressedButton.slice(7), 10);
        const filterRects = this.getFilterRects(this.director.screenWidth);
        this.pressedButton = null;
        if (idx < FILTERS.length && hitTest(x, y, filterRects[idx])) {
          const newFilter = FILTERS[idx].id;
          if (newFilter !== this.activeFilter) {
            this.activeFilter = newFilter;
            playSfx("click");
          }
          return true;
        }
      }
      this.pressedButton = null;
      return true;
    }

    return false;
  }
}
