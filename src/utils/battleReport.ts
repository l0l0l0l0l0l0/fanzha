/**
 * 战报图生成器 · v2
 * 在离屏画布上渲染一张 1080×1620 的可分享战报 PNG，
 * 包含：游戏标题、胜负、分数、段位、识破数、新解锁成就、反诈标语、 hotline。
 *
 * 不依赖引擎渲染管线，直接使用 document.createElement('canvas')，
 * 因为这是面向"导出/分享"的一次性渲染，需要原始 DOM Canvas 的 toBlob 能力。
 */
import { Theme, withAlpha } from "@/ui/Theme";
import { getGame, GAMES } from "@/data/games";
import { TIPS } from "@/data/tips";
import { platformStore, rankProgress, CODEX_TOTAL } from "@/store/platformStore";
import type { GameResultPayload } from "@/types";
import type { Achievement } from "@/data/achievements";

const W = 1080;
const H = 1620;

export interface BattleReportData {
  result: GameResultPayload;
  /** 本局新解锁成就（由 ResultOverlay 传入） */
  unlockedAchievements: Achievement[];
}

/**
 * 生成战报图，返回 HTMLCanvasElement（用于 toBlob）
 */
export function renderBattleReportCanvas(data: BattleReportData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
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
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#0A1929");
  bgGrad.addColorStop(0.5, "#0E2438");
  bgGrad.addColorStop(1, "#08111E");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 顶部光晕
  const glowGrad = ctx.createRadialGradient(W * 0.5, H * 0.15, 0, W * 0.5, H * 0.15, H * 0.6);
  glowGrad.addColorStop(0, withAlpha(accent, 0.18));
  glowGrad.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  // 网格
  ctx.save();
  ctx.strokeStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.05);
  ctx.lineWidth = 1;
  const step = 60;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  // 扫描线
  ctx.save();
  ctx.fillStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.025);
  for (let y = 0; y < H; y += 6) {
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
  ctx.fillText(isWin ? "战斗胜利" : "战斗结束", W / 2, 290);
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
  ctx.fillText("本局得分", W / 2, scoreY);
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
      label: data.result.wave !== undefined ? "最高波数" : "识破次数",
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

  // ===== 底部反诈热线 + 段位进度 =====
  const footY = 1340;
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
  ctx.fillText("全民反诈 · 天下无诈", W / 2, H - 90);

  ctx.font = `400 18px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.7);
  ctx.fillText("// ANTI-FRAUD ARCADE · 在娱乐中识破套路", W / 2, H - 50);
  ctx.restore();

  // ===== 四角霓虹括号 =====
  drawCornerBracket(ctx, 30, 30, 80, 80, accent);
  drawCornerBracket(ctx, W - 110, 30, 80, 80, accent, "tr");
  drawCornerBracket(ctx, 30, H - 110, 80, 80, accent, "bl");
  drawCornerBracket(ctx, W - 110, H - 110, 80, 80, accent, "br");

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
// 反诈进度卡（Hub 分享 · 非单局战报）
// ============================================================

/**
 * 生成整体进度分享卡，返回 HTMLCanvasElement（用于 toBlob）
 * 内容：段位、累计识破、图鉴、5 款游戏最高分、反诈标语
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

  // ===== 5 款游戏最高分 =====
  const gamesY = 760;
  ctx.save();
  ctx.font = `400 22px ${Theme.fonts.mono}`;
  ctx.fillStyle = withAlpha(accent, 0.85);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("// GAME HIGH SCORES · 五款游戏最高分", 60, gamesY);
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
