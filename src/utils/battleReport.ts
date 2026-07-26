/**
 * 战报图生成器 · v2
 * 在离屏画布上渲染一张 1080×1620 的可分享战报 PNG，
 * 包含：游戏标题、胜负、分数、段位、识破数、新解锁成就、反诈标语、 hotline。
 *
 * 不依赖引擎渲染管线，直接使用 document.createElement('canvas')，
 * 因为这是面向"导出/分享"的一次性渲染，需要原始 DOM Canvas 的 toBlob 能力。
 *
 * v7：当 v7ManagerData 存在时（反诈职业经理人模块），追加渲染
 *   - 模式徽章（经典/限时/BOSS Rush/无尽/每日/爬塔/极限）
 *   - 真实案例还原（标题 + 摘要 + 96110）
 *   - 本局新收集反诈口诀（最多展示 6 句）
 *   - 排行榜段位（每日/每周/赛季）
 */
import { Theme, withAlpha } from "@/ui/Theme";
import { getGame, GAMES } from "@/data/games";
import { TIPS } from "@/data/tips";
import { platformStore, rankProgress, CODEX_TOTAL } from "@/store/platformStore";
import type { GameResultPayload } from "@/types";
import type { Achievement } from "@/data/achievements";
import type { RealCaseDef, ManagerMode } from "@/games/manager/types";
import { MAZE_TERMS } from "@/games/manager/maze";

const W = 1080;
const H = 1620;

/**
 * v7：反诈职业经理人专属战报数据
 * 仅 manager 模块传入；其他游戏保持 undefined，战报图回退到 v2 通用布局
 */
export interface V7ManagerReportData {
  /** 本局模式 */
  mode: ManagerMode;
  /** 模式中文名（如"经典战役"/"BOSS Rush"） */
  modeLabel: string;
  /** 爬塔层数（仅 tower 模式 > 0） */
  towerFloor: number;
  /** 本局还原的真实案例（最后击破的 BOSS 关联，可选） */
  realCase?: RealCaseDef;
  /** 本局新收集的口诀索引列表（对应 MAZE_TERMS 下标） */
  newlyCollectedTerms: number[];
  /** 当前赛季段位名（如"反诈新星"，空字符串表示无） */
  seasonRank: string;
  /** 当前赛季分数 */
  seasonScore: number;
  /** 每日排行榜名次（0 表示未上榜） */
  leaderboardDailyRank: number;
  /** 每周排行榜名次（0 表示未上榜） */
  leaderboardWeeklyRank: number;
}

export interface BattleReportData {
  result: GameResultPayload;
  /** 本局新解锁成就（由 ResultOverlay 传入） */
  unlockedAchievements: Achievement[];
  /** v7：反诈职业经理人专属数据（可选，仅 manager 模块传入） */
  v7ManagerData?: V7ManagerReportData;
}

/**
 * 生成战报图，返回 HTMLCanvasElement（用于 toBlob）
 */
export function renderBattleReportCanvas(data: BattleReportData): HTMLCanvasElement {
  // v7：动态扩展画布高度（仅当 manager 模块传入 v7 数据时）
  const v7 = data.v7ManagerData;
  const v7ExtraH = v7 ? computeV7SectionsHeight(v7) : 0;
  const totalH = H + v7ExtraH;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d")!;
  const game = getGame(data.result.gameId);
  const accent = game.accent;
  const tip = TIPS.find((t) => t.id === data.result.tipId) ?? TIPS[0];
  const stat = platformStore.state;
  const rp = rankProgress(stat.totalFoolsBusted);
  const isWin = data.result.win;
  const titleColor = isWin ? Theme.colors.safe.DEFAULT : Theme.colors.flag.DEFAULT;

  // ===== 背景 =====
  // 深蓝渐变底
  const bgGrad = ctx.createLinearGradient(0, 0, 0, totalH);
  bgGrad.addColorStop(0, "#0A1929");
  bgGrad.addColorStop(0.5, "#0E2438");
  bgGrad.addColorStop(1, "#08111E");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, totalH);

  // 顶部光晕
  const glowGrad = ctx.createRadialGradient(W * 0.5, H * 0.15, 0, W * 0.5, H * 0.15, H * 0.6);
  glowGrad.addColorStop(0, withAlpha(accent, 0.18));
  glowGrad.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, totalH);

  // 网格
  ctx.save();
  ctx.strokeStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.05);
  ctx.lineWidth = 1;
  const step = 60;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, totalH);
    ctx.stroke();
  }
  for (let y = 0; y < totalH; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  // 扫描线
  ctx.save();
  ctx.fillStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.025);
  for (let y = 0; y < totalH; y += 6) {
    ctx.fillRect(0, y, W, 2);
  }
  ctx.restore();

  // ===== 顶部 HUD 标签 =====
  ctx.save();
  ctx.font = `400 24px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.7);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("// ANTI-FRAUD ARCADE · BATTLE REPORT", 60, 60);
  ctx.restore();

  // ===== 游戏副标题（小字） =====
  ctx.save();
  ctx.font = `400 28px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(accent, 0.85);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(game.subtitle, 60, 100);
  ctx.restore();

  // ===== 游戏主标题（大字） =====
  ctx.save();
  ctx.font = `700 80px ${Theme.fonts.display}`;
  ctx.fillStyle = Theme.colors.ink.DEFAULT;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.shadowColor = withAlpha(accent, 0.5);
  ctx.shadowBlur = 20;
  ctx.fillText(game.title, 60, 140);
  ctx.shadowBlur = 0;
  ctx.restore();

  // ===== 顶部分隔线 =====
  ctx.save();
  const lg = ctx.createLinearGradient(60, 250, W - 60, 250);
  lg.addColorStop(0, "transparent");
  lg.addColorStop(0.5, accent);
  lg.addColorStop(1, "transparent");
  ctx.fillStyle = lg;
  ctx.fillRect(60, 250, W - 120, 2);
  ctx.restore();

  // ===== 胜负大字 =====
  ctx.save();
  ctx.font = `900 140px ${Theme.fonts.display}`;
  ctx.fillStyle = titleColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = withAlpha(titleColor, 0.6);
  ctx.shadowBlur = 30;
  ctx.fillText(isWin ? "反诈胜利" : "反诈结束", W / 2, 290);
  ctx.shadowBlur = 0;
  ctx.restore();

  // ===== 主分数（核心视觉） =====
  const scoreY = 470;
  ctx.save();
  // 标签
  ctx.font = `400 26px ${Theme.fonts.mono}`;
  ctx.fillStyle = Theme.colors.ink.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("本局识破分", W / 2, scoreY);
  // 大数字
  ctx.font = `900 160px ${Theme.fonts.mono}`;
  ctx.fillStyle = accent;
  ctx.shadowColor = withAlpha(accent, 0.7);
  ctx.shadowBlur = 40;
  ctx.fillText(data.result.score.toLocaleString(), W / 2, scoreY + 40);
  ctx.shadowBlur = 0;
  ctx.restore();

  // ===== 统计行（3 列） =====
  const statsY = 700;
  const statsH = 140;
  const colW = (W - 120 - 40) / 3;
  const stats = [
    {
      label: data.result.wave !== undefined ? "最高反诈波次" : "识破次数",
      value: data.result.wave !== undefined
        ? `${data.result.wave}`
        : `${data.result.bustedCount ?? 0}`,
    },
    {
      label: "当前段位",
      value: rp.rank,
    },
    {
      label: "累计识破",
      value: `${stat.totalFoolsBusted}`,
    },
  ];
  for (let i = 0; i < stats.length; i++) {
    const sx = 60 + i * (colW + 20);
    drawStatBlock(ctx, sx, statsY, colW, statsH, stats[i].label, stats[i].value, accent);
  }

  // ===== 反诈锦囊（中段） =====
  const tipY = 880;
  const tipH = 240;
  ctx.save();
  // 背景
  ctx.fillStyle = withAlpha(accent, 0.06);
  roundRectPath(ctx, 60, tipY, W - 120, tipH, 16);
  ctx.fill();
  // 左边框
  ctx.fillStyle = accent;
  ctx.fillRect(60, tipY, 6, tipH);
  ctx.restore();

  ctx.save();
  ctx.font = `400 22px ${Theme.fonts.mono}`;
  ctx.fillStyle = accent;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`反诈锦囊 · ${tip.source}`, 90, tipY + 28);

  ctx.font = `700 36px ${Theme.fonts.display}`;
  ctx.fillStyle = Theme.colors.ink.DEFAULT;
  ctx.fillText(tip.title, 90, tipY + 66);

  ctx.font = `400 24px ${Theme.fonts.body}`;
  ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.85);
  const tipLines = wrapText(ctx, tip.body, W - 180);
  tipLines.forEach((line, i) => ctx.fillText(line, 90, tipY + 120 + i * 32));
  ctx.restore();

  // ===== 成就解锁（如有） =====
  let achY = tipY + tipH + 30;
  if (data.unlockedAchievements.length > 0) {
    const achH = 100;
    ctx.save();
    ctx.fillStyle = "rgba(255,214,102,0.08)";
    roundRectPath(ctx, 60, achY, W - 120, achH, 16);
    ctx.fill();
    ctx.fillStyle = "#FFD666";
    ctx.fillRect(60, achY, 6, achH);

    ctx.font = `400 22px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`★ 本局解锁 ${data.unlockedAchievements.length} 项成就`, 90, achY + 22);

    // 成就名拼接
    const names = data.unlockedAchievements.map((a) => a.name).join(" · ");
    ctx.font = `700 26px ${Theme.fonts.display}`;
    ctx.fillStyle = withAlpha("#FFD666", 0.95);
    const nameLines = wrapText(ctx, names, W - 180);
    nameLines.forEach((line, i) => ctx.fillText(line, 90, achY + 56 + i * 30));
    ctx.restore();
    achY += achH + 20;
  }

  // ===== v7：反诈职业经理人专属区块（如有） =====
  if (v7) {
    drawV7ManagerSections(ctx, achY, W, v7);
  }

  // ===== 底部反诈热线 + 段位进度 =====
  const footY = 1340 + v7ExtraH;
  // 段位进度条
  ctx.save();
  ctx.font = `400 22px ${Theme.fonts.mono}`;
  ctx.fillStyle = Theme.colors.ink.muted;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`段位进度 · ${rp.rank}`, 60, footY);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.fillText(`${stat.totalFoolsBusted}/${rp.threshold}`, W - 60, footY);
  // 进度条
  const barY = footY + 38;
  const barW = W - 120;
  ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.6);
  roundRectPath(ctx, 60, barY, barW, 12, 6);
  ctx.fill();
  if (rp.ratio > 0) {
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    roundRectPath(ctx, 60, barY, barW * rp.ratio, 12, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // 热线徽章
  const hotlineY = footY + 80;
  drawHotlineBadge(ctx, 60, hotlineY, "96110", "反诈专线", Theme.colors.warn.DEFAULT);
  drawHotlineBadge(ctx, 60 + 320, hotlineY, "12321", "网络举报", Theme.colors.safe.DEFAULT);
  drawHotlineBadge(ctx, 60 + 640, hotlineY, "12308", "领事保护", Theme.colors.neon.DEFAULT);

  // ===== 底部标语 =====
  ctx.save();
  ctx.font = `700 32px ${Theme.fonts.display}`;
  ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("全民反诈 · 天下无诈", W / 2, totalH - 90);

  ctx.font = `400 18px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.7);
  ctx.fillText("// ANTI-FRAUD ARCADE · 在娱乐中识破套路", W / 2, totalH - 50);
  ctx.restore();

  // ===== 四角霓虹括号 =====
  drawCornerBracket(ctx, 30, 30, 80, 80, accent);
  drawCornerBracket(ctx, W - 110, 30, 80, 80, accent, "tr");
  drawCornerBracket(ctx, 30, totalH - 110, 80, 80, accent, "bl");
  drawCornerBracket(ctx, W - 110, totalH - 110, 80, 80, accent, "br");

  return canvas;
}

// ============ 辅助绘制 ============

function drawStatBlock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, value: string, accent: string
): void {
  ctx.save();
  // 背景
  ctx.fillStyle = withAlpha(accent, 0.06);
  roundRectPath(ctx, x, y, w, h, 12);
  ctx.fill();
  // 边框
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 顶部线
  const lg = ctx.createLinearGradient(x, y, x + w, y);
  lg.addColorStop(0, "transparent");
  lg.addColorStop(0.5, accent);
  lg.addColorStop(1, "transparent");
  ctx.fillStyle = lg;
  ctx.fillRect(x, y, w, 2);
  // 标签
  ctx.font = `400 22px ${Theme.fonts.mono}`;
  ctx.fillStyle = Theme.colors.ink.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + w / 2, y + 24);
  // 数值（自适应字号）
  let vSize = 48;
  ctx.font = `900 ${vSize}px ${Theme.fonts.mono}`;
  while (ctx.measureText(value).width > w - 40 && vSize > 20) {
    vSize -= 4;
    ctx.font = `900 ${vSize}px ${Theme.fonts.mono}`;
  }
  ctx.fillStyle = accent;
  ctx.shadowColor = withAlpha(accent, 0.4);
  ctx.shadowBlur = 12;
  ctx.fillText(value, x + w / 2, y + 60);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawHotlineBadge(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  number: string, label: string, color: string
): void {
  const w = 280;
  const h = 80;
  ctx.save();
  ctx.fillStyle = withAlpha(color, 0.12);
  roundRectPath(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = withAlpha(color, 0.6);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 大数字
  ctx.font = `900 38px ${Theme.fonts.mono}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = withAlpha(color, 0.5);
  ctx.shadowBlur = 10;
  ctx.fillText(number, x + w / 2, y + 12);
  ctx.shadowBlur = 0;
  // 标签
  ctx.font = `400 16px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(color, 0.8);
  ctx.fillText(label, x + w / 2, y + 54);
  ctx.restore();
}

function drawCornerBracket(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
  corner: "tl" | "tr" | "bl" | "br" = "tl"
): void {
  const L = Math.min(w, h) * 0.4;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  if (corner === "tl") {
    ctx.moveTo(x, y + L); ctx.lineTo(x, y); ctx.lineTo(x + L, y);
  } else if (corner === "tr") {
    ctx.moveTo(x + w - L, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + L);
  } else if (corner === "bl") {
    ctx.moveTo(x, y + h - L); ctx.lineTo(x, y + h); ctx.lineTo(x + L, y + h);
  } else {
    ctx.moveTo(x + w - L, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - L);
  }
  ctx.stroke();
  ctx.restore();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = text.split("");
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4); // 最多 4 行
}

// ============================================================
// v7：反诈职业经理人专属战报区块
// ============================================================

/**
 * 计算 v7 专属区块总高度（用于动态扩展画布）
 * - 区块标题：60px
 * - 模式 + 爬塔层数行：100px
 * - 真实案例面板：280px（仅 realCase 存在时）
 * - 新收集口诀面板：140px（仅 newlyCollectedTerms > 0 时）
 * - 排行榜段位面板：140px
 */
function computeV7SectionsHeight(v7: V7ManagerReportData): number {
  let h = 60 + 100 + 140; // 标题 + 模式行 + 排行榜
  if (v7.realCase) h += 280;
  if (v7.newlyCollectedTerms.length > 0) h += 140;
  return h;
}

/**
 * 渲染 v7 专属区块（在成就区块与底部热线之间）
 * 返回结束 y 坐标（供后续 footer 定位参考，此处 footY 已由 v7ExtraH 推下）
 */
function drawV7ManagerSections(
  ctx: CanvasRenderingContext2D,
  startY: number,
  W: number,
  v7: V7ManagerReportData,
): number {
  const v7Accent = "#9D6BFF"; // v7 主题色（与知识图谱/manager 模块一致）
  let y = startY;

  // ===== 区块标题 =====
  ctx.save();
  ctx.font = `400 22px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(v7Accent, 0.85);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("// MANAGER v7 · 反诈职业经理人战报", 60, y);
  ctx.restore();
  // 分隔线
  ctx.save();
  const lg = ctx.createLinearGradient(60, y + 32, W - 60, y + 32);
  lg.addColorStop(0, "transparent");
  lg.addColorStop(0.5, withAlpha(v7Accent, 0.6));
  lg.addColorStop(1, "transparent");
  ctx.fillStyle = lg;
  ctx.fillRect(60, y + 32, W - 120, 2);
  ctx.restore();
  y += 60;

  // ===== 模式徽章 + 爬塔层数 =====
  const modeH = 80;
  ctx.save();
  ctx.fillStyle = withAlpha(v7Accent, 0.06);
  roundRectPath(ctx, 60, y, W - 120, modeH, 16);
  ctx.fill();
  ctx.fillStyle = v7Accent;
  ctx.fillRect(60, y, 6, modeH);

  // 模式徽章
  ctx.font = `400 20px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(v7Accent, 0.85);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("本局模式", 90, y + 18);
  ctx.font = `700 36px ${Theme.fonts.display}`;
  ctx.fillStyle = v7Accent;
  ctx.shadowColor = withAlpha(v7Accent, 0.5);
  ctx.shadowBlur = 12;
  ctx.fillText(v7.modeLabel, 90, y + 42);
  ctx.shadowBlur = 0;

  // 爬塔层数（仅 tower 模式）
  if (v7.towerFloor > 0) {
    ctx.font = `400 20px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(v7Accent, 0.85);
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("爬塔层数", W - 90, y + 18);
    ctx.font = `700 36px ${Theme.fonts.mono}`;
    ctx.fillStyle = "#FFD666";
    ctx.shadowColor = withAlpha("#FFD666", 0.5);
    ctx.shadowBlur = 12;
    ctx.fillText(`${v7.towerFloor} 层`, W - 90, y + 42);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  y += modeH + 20;

  // ===== 真实案例还原（如有） =====
  if (v7.realCase) {
    const rc = v7.realCase;
    const rcH = 260;
    ctx.save();
    ctx.fillStyle = withAlpha(rc.color, 0.06);
    roundRectPath(ctx, 60, y, W - 120, rcH, 16);
    ctx.fill();
    ctx.fillStyle = rc.color;
    ctx.fillRect(60, y, 6, rcH);

    // 标题行：emoji + 案件标题 + 年份
    ctx.font = `700 32px ${Theme.fonts.display}`;
    ctx.fillStyle = rc.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(rc.color, 0.4);
    ctx.shadowBlur = 10;
    ctx.fillText(`${rc.emoji}  ${rc.title}`, 90, y + 22);
    ctx.shadowBlur = 0;
    ctx.font = `400 18px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.textAlign = "right";
    ctx.fillText(`${rc.year} · 真实案例`, W - 90, y + 28);

    // 摘要正文（换行）
    ctx.font = `400 22px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const summaryLines = wrapText(ctx, rc.summary, W - 180);
    summaryLines.forEach((line, i) => ctx.fillText(line, 90, y + 80 + i * 30));

    // 关键数据行
    const statsY = y + 80 + summaryLines.length * 30 + 12;
    ctx.font = `700 20px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.warn.DEFAULT;
    ctx.textAlign = "left";
    ctx.fillText(`💰 涉案 ${formatAmount(rc.amount)}`, 90, statsY);
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.95);
    ctx.fillText(`👤 ${rc.victim}`, 90 + 280, statsY);
    ctx.fillText(`🛡️ ${rc.bustedBy}`, 90, statsY + 28);

    // 反诈提示
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = rc.color;
    ctx.fillText(`💡 ${rc.tip}`, 90, statsY + 64);
    ctx.restore();
    y += rcH + 20;
  }

  // ===== 新收集反诈口诀（如有） =====
  if (v7.newlyCollectedTerms.length > 0) {
    const termH = 120;
    const termAccent = "#FFD666";
    ctx.save();
    ctx.fillStyle = withAlpha(termAccent, 0.06);
    roundRectPath(ctx, 60, y, W - 120, termH, 16);
    ctx.fill();
    ctx.fillStyle = termAccent;
    ctx.fillRect(60, y, 6, termH);

    ctx.font = `400 20px ${Theme.fonts.mono}`;
    ctx.fillStyle = termAccent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`★ 本局新收集 ${v7.newlyCollectedTerms.length} 句反诈口诀`, 90, y + 18);

    // 口诀文本（最多展示 6 句，每句前加📜）
    const showCount = Math.min(v7.newlyCollectedTerms.length, 6);
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = withAlpha(termAccent, 0.95);
    for (let i = 0; i < showCount; i++) {
      const idx = v7.newlyCollectedTerms[i];
      const term = MAZE_TERMS[idx] ?? `口诀 ${idx}`;
      ctx.fillText(`📜 ${term}`, 90, y + 50 + i * 28);
    }
    if (v7.newlyCollectedTerms.length > 6) {
      ctx.font = `400 18px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
      ctx.fillText(`... 及其他 ${v7.newlyCollectedTerms.length - 6} 句`, 90, y + 50 + 6 * 28);
    }
    ctx.restore();
    y += termH + 20;
  }

  // ===== 排行榜段位面板 =====
  const lbH = 120;
  const lbAccent = "#FFD666";
  ctx.save();
  ctx.fillStyle = withAlpha(lbAccent, 0.06);
  roundRectPath(ctx, 60, y, W - 120, lbH, 16);
  ctx.fill();
  ctx.fillStyle = lbAccent;
  ctx.fillRect(60, y, 6, lbH);

  // 赛季段位（核心视觉）
  ctx.font = `400 20px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(lbAccent, 0.85);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("当前赛季段位", 90, y + 18);
  ctx.font = `700 32px ${Theme.fonts.display}`;
  ctx.fillStyle = lbAccent;
  ctx.shadowColor = withAlpha(lbAccent, 0.5);
  ctx.shadowBlur = 12;
  ctx.fillText(v7.seasonRank || "—", 90, y + 48);
  ctx.shadowBlur = 0;
  ctx.font = `400 18px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
  ctx.fillText(`${v7.seasonScore} 分`, 90, y + 88);

  // 每日/每周排名（右侧）
  ctx.font = `400 20px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(lbAccent, 0.85);
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("每日排名", W - 320, y + 18);
  ctx.fillText("每周排名", W - 90, y + 18);
  ctx.font = `700 36px ${Theme.fonts.mono}`;
  ctx.fillStyle = lbAccent;
  ctx.shadowColor = withAlpha(lbAccent, 0.5);
  ctx.shadowBlur = 12;
  const dailyRankText = v7.leaderboardDailyRank > 0 ? `#${v7.leaderboardDailyRank}` : "—";
  const weeklyRankText = v7.leaderboardWeeklyRank > 0 ? `#${v7.leaderboardWeeklyRank}` : "—";
  ctx.fillText(dailyRankText, W - 320, y + 48);
  ctx.fillText(weeklyRankText, W - 90, y + 48);
  ctx.shadowBlur = 0;
  ctx.restore();
  y += lbH + 20;

  return y;
}

/** 涉案金额格式化（万/亿） */
function formatAmount(amount: number): string {
  if (amount <= 0) return "未知";
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(2)} 亿元`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)} 万元`;
  return `${amount} 元`;
}

// ============================================================
// 反诈进度卡（Hub 分享 · 非单局战报）
// ============================================================

/**
 * 生成整体进度分享卡，返回 HTMLCanvasElement（用于 toBlob）
 * 内容：段位、累计识破、图鉴、4 款游戏最高分、反诈标语
 */
export function renderProgressReportCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const stat = platformStore.state;
  const rp = rankProgress(stat.totalFoolsBusted);
  const accent = Theme.colors.neon.DEFAULT;

  // ===== 背景（同战报卡风格） =====
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#0A1929");
  bgGrad.addColorStop(0.5, "#0E2438");
  bgGrad.addColorStop(1, "#08111E");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const glowGrad = ctx.createRadialGradient(W * 0.5, H * 0.18, 0, W * 0.5, H * 0.18, H * 0.6);
  glowGrad.addColorStop(0, withAlpha(accent, 0.2));
  glowGrad.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  // 网格
  ctx.save();
  ctx.strokeStyle = withAlpha(accent, 0.05);
  ctx.lineWidth = 1;
  const step = 60;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // 扫描线
  ctx.save();
  ctx.fillStyle = withAlpha(accent, 0.025);
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
  ctx.restore();

  // ===== 顶部 HUD =====
  ctx.save();
  ctx.font = `400 24px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(accent, 0.7);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("// ANTI-FRAUD ARCADE · OFFICER REPORT", 60, 60);

  ctx.font = `400 28px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(Theme.colors.flag.DEFAULT, 0.85);
  ctx.fillText("OFFICER PROFILE", 60, 100);

  ctx.font = `700 80px ${Theme.fonts.display}`;
  ctx.fillStyle = Theme.colors.ink.DEFAULT;
  ctx.shadowColor = withAlpha(accent, 0.5);
  ctx.shadowBlur = 20;
  ctx.fillText("反诈档案", 60, 140);
  ctx.shadowBlur = 0;
  ctx.restore();

  // 顶部分隔线
  ctx.save();
  const lg = ctx.createLinearGradient(60, 250, W - 60, 250);
  lg.addColorStop(0, "transparent");
  lg.addColorStop(0.5, accent);
  lg.addColorStop(1, "transparent");
  ctx.fillStyle = lg;
  ctx.fillRect(60, 250, W - 120, 2);
  ctx.restore();

  // ===== 段位（核心视觉） =====
  ctx.save();
  ctx.font = `400 26px ${Theme.fonts.mono}`;
  ctx.fillStyle = Theme.colors.ink.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("当前段位", W / 2, 300);

  ctx.font = `900 130px ${Theme.fonts.display}`;
  ctx.fillStyle = Theme.colors.flag.DEFAULT;
  ctx.shadowColor = withAlpha(Theme.colors.flag.DEFAULT, 0.6);
  ctx.shadowBlur = 35;
  ctx.fillText(rp.rank, W / 2, 340);
  ctx.shadowBlur = 0;
  ctx.restore();

  // 段位进度条
  const barY = 500;
  ctx.save();
  ctx.font = `400 22px ${Theme.fonts.mono}`;
  ctx.fillStyle = Theme.colors.ink.muted;
  ctx.textAlign = "left";
  ctx.fillText(`${stat.totalFoolsBusted} / ${rp.threshold}`, 60, barY - 32);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.fillText(rp.next ? `下一档：${rp.next}` : "已达最高段位", W - 60, barY - 32);
  const barW = W - 120;
  ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.6);
  roundRectPath(ctx, 60, barY, barW, 14, 7);
  ctx.fill();
  if (rp.ratio > 0) {
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    roundRectPath(ctx, 60, barY, barW * rp.ratio, 14, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // ===== 统计行（3 列） =====
  const statsY = 580;
  const statsH = 140;
  const colW = (W - 120 - 40) / 3;
  const stats = [
    { label: "累计识破", value: `${stat.totalFoolsBusted}` },
    { label: "图鉴解锁", value: `${stat.unlockedCodex.length}/${CODEX_TOTAL}` },
    { label: "总游戏局数", value: `${stat.totalGames}` },
  ];
  for (let i = 0; i < stats.length; i++) {
    const sx = 60 + i * (colW + 20);
    drawStatBlock(ctx, sx, statsY, colW, statsH, stats[i].label, stats[i].value, accent);
  }

  // ===== 4 款游戏最高分 =====
  const gamesY = 760;
  ctx.save();
  ctx.font = `400 22px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(accent, 0.85);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("// GAME HIGH SCORES · 四款游戏最高分", 60, gamesY);
  ctx.restore();

  const gameRowH = 80;
  for (let i = 0; i < GAMES.length; i++) {
    const g = GAMES[i];
    const ry = gamesY + 40 + i * gameRowH;
    ctx.save();
    // 行背景
    ctx.fillStyle = withAlpha(g.accent, 0.06);
    roundRectPath(ctx, 60, ry, W - 120, gameRowH - 10, 12);
    ctx.fill();
    ctx.strokeStyle = withAlpha(g.accent, 0.35);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 游戏标题
    ctx.font = `700 30px ${Theme.fonts.display}`;
    ctx.fillStyle = g.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(g.accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(g.title, 90, ry + 14);
    ctx.shadowBlur = 0;
    // 副标题
    ctx.font = `400 16px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(g.subtitle, 90, ry + 50);
    // 最高分
    const best = stat.bestScores[g.id] || 0;
    ctx.font = `900 36px ${Theme.fonts.mono}`;
    ctx.fillStyle = best > 0 ? g.accent : withAlpha(Theme.colors.ink.muted, 0.5);
    ctx.textAlign = "right";
    ctx.fillText(best.toLocaleString(), W - 90, ry + 22);
    ctx.restore();
  }

  // ===== 反诈标语 + 热线 =====
  const footY = 1340;
  const hotlineY = footY + 80;
  drawHotlineBadge(ctx, 60, hotlineY, "96110", "反诈专线", Theme.colors.warn.DEFAULT);
  drawHotlineBadge(ctx, 60 + 320, hotlineY, "12321", "网络举报", Theme.colors.safe.DEFAULT);
  drawHotlineBadge(ctx, 60 + 640, hotlineY, "12308", "领事保护", Theme.colors.neon.DEFAULT);

  // 底部标语
  ctx.save();
  ctx.font = `700 32px ${Theme.fonts.display}`;
  ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.9);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("全民反诈 · 天下无诈", W / 2, H - 90);
  ctx.font = `400 18px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.7);
  ctx.fillText("// ANTI-FRAUD ARCADE · 在娱乐中识破套路", W / 2, H - 50);
  ctx.restore();

  // 四角括号
  drawCornerBracket(ctx, 30, 30, 80, 80, accent);
  drawCornerBracket(ctx, W - 110, 30, 80, 80, accent, "tr");
  drawCornerBracket(ctx, 30, H - 110, 80, 80, accent, "bl");
  drawCornerBracket(ctx, W - 110, H - 110, 80, 80, accent, "br");

  return canvas;
}
