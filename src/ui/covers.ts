/**
 * 程序化游戏封面插画
 * 每款游戏一幅动态小场景，替代静态图标
 */
import { Theme, withAlpha } from "./Theme";
import { roundRect } from "@/engine/Renderer";

export type CoverId = "phone" | "tactic" | "ship" | "bomb";

export function drawCover(
  ctx: CanvasRenderingContext2D,
  id: CoverId,
  x: number, y: number, w: number, h: number,
  t: number,
  accent: string
): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, 8);
  ctx.clip();

  // 底色渐变
  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, withAlpha(accent, 0.22));
  bg.addColorStop(1, "rgba(10,25,41,0.9)");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  switch (id) {
    case "phone": drawPhoneCover(ctx, x, y, w, h, t, accent); break;
    case "tactic": drawTacticCover(ctx, x, y, w, h, t, accent); break;
    case "ship": drawShipCover(ctx, x, y, w, h, t, accent); break;
    case "bomb": drawBombCover(ctx, x, y, w, h, t, accent); break;
  }

  // 顶部高光
  const hl = ctx.createLinearGradient(x, y, x, y + h * 0.4);
  hl.addColorStop(0, "rgba(255,255,255,0.10)");
  hl.addColorStop(1, "transparent");
  ctx.fillStyle = hl;
  ctx.fillRect(x, y, w, h * 0.4);

  ctx.restore();

  // 边框
  ctx.save();
  roundRect(ctx, x, y, w, h, 8);
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** 是男人就反诈：手机 + 下落的消息气泡 + 判定盾 */
function drawPhoneCover(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, accent: string): void {
  const px = x + w * 0.28;
  const py = y + h * 0.14;
  const pw = w * 0.44;
  const ph = h * 0.72;

  // 手机机身
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 6);
  ctx.fillStyle = "#0F2236";
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.7);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 屏幕
  roundRect(ctx, px + 3, py + 6, pw - 6, ph - 12, 3);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fill();
  ctx.restore();

  // 下落的气泡（循环）
  for (let i = 0; i < 3; i++) {
    const cycle = (t * 0.5 + i / 3) % 1;
    const by = py + 8 + cycle * (ph - 26);
    const bw = pw * (0.5 + 0.2 * Math.sin(i * 2.1));
    const bx = px + 6 + (i % 2) * (pw - bw - 12);
    ctx.save();
    ctx.globalAlpha = Math.sin(cycle * Math.PI) * 0.9;
    roundRect(ctx, bx, by, bw, 10, 3);
    ctx.fillStyle = i === 1 ? withAlpha("#E5353B", 0.8) : withAlpha(accent, 0.55);
    ctx.fill();
    ctx.restore();
  }

  // 判定盾（右下，呼吸）
  const pulse = 1 + Math.sin(t * 3) * 0.08;
  const sx = x + w * 0.72;
  const sy = y + h * 0.62;
  const sr = w * 0.16 * pulse;
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 12;
  ctx.fillStyle = withAlpha(accent, 0.9);
  ctx.beginPath();
  ctx.moveTo(sx, sy - sr);
  ctx.quadraticCurveTo(sx + sr, sy - sr * 0.6, sx + sr * 0.85, sy + sr * 0.2);
  ctx.quadraticCurveTo(sx + sr * 0.6, sy + sr * 0.9, sx, sy + sr * 1.15);
  ctx.quadraticCurveTo(sx - sr * 0.6, sy + sr * 0.9, sx - sr * 0.85, sy + sr * 0.2);
  ctx.quadraticCurveTo(sx - sr, sy - sr * 0.6, sx, sy - sr);
  ctx.fill();
  // 对勾
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#0A1929";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - sr * 0.35, sy + sr * 0.05);
  ctx.lineTo(sx - sr * 0.08, sy + sr * 0.35);
  ctx.lineTo(sx + sr * 0.4, sy - sr * 0.25);
  ctx.stroke();
  ctx.restore();

  // 警告角标
  ctx.save();
  ctx.fillStyle = "#E5353B";
  ctx.beginPath();
  ctx.arc(x + w * 0.2, y + h * 0.22, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", x + w * 0.2, y + h * 0.22 + 0.5);
  ctx.restore();
}

/** 反诈职业经理人：3x3 战位网格 + 探员棋子 */
function drawTacticCover(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, accent: string): void {
  const gx = x + w * 0.18;
  const gy = y + h * 0.16;
  const gw = w * 0.64;
  const gh = h * 0.68;
  const cw = gw / 3;
  const ch = gh / 3;

  // 网格
  ctx.save();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(gx + i * cw, gy);
    ctx.lineTo(gx + i * cw, gy + gh);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx, gy + i * ch);
    ctx.lineTo(gx + gw, gy + i * ch);
    ctx.stroke();
  }
  ctx.restore();

  // 探员棋子（呼吸错位）
  const units: [number, number, string][] = [
    [0, 1, accent], [1, 0, "#00E5FF"], [1, 2, accent], [2, 1, "#FFD666"],
  ];
  units.forEach(([col, row, color], i) => {
    const bob = Math.sin(t * 2.4 + i * 1.3) * 2;
    const ux = gx + col * cw + cw / 2;
    const uy = gy + row * ch + ch / 2 + bob;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ux, uy, Math.min(cw, ch) * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0A1929";
    ctx.font = `700 ${Math.floor(Math.min(cw, ch) * 0.3)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("探", ux, uy + 0.5);
    ctx.restore();
  });

  // 进攻射线（从棋子向右上）
  const beam = (t * 0.8) % 1;
  ctx.save();
  ctx.globalAlpha = Math.sin(beam * Math.PI) * 0.7;
  ctx.strokeStyle = "#E5353B";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(gx + cw * 1.5, gy + ch * 0.5);
  ctx.lineTo(gx + gw + 6, gy - 4);
  ctx.stroke();
  ctx.restore();
}

/** 雷霆反诈：战机爬升 + 弹幕 + 星空 */
function drawShipCover(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, accent: string): void {
  // 星星
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const sx = x + ((i * 37.7) % 100) / 100 * w;
    const sy = y + (((i * 53.3) % 100) / 100 * h + t * 24) % h;
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i));
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.restore();

  // 敌机（顶部两个）
  for (let i = 0; i < 2; i++) {
    const ex = x + w * (0.3 + i * 0.35) + Math.sin(t * 1.5 + i * 2) * 6;
    const ey = y + h * 0.2;
    ctx.save();
    ctx.fillStyle = withAlpha("#E5353B", 0.85);
    ctx.beginPath();
    ctx.moveTo(ex, ey + 7);
    ctx.lineTo(ex - 7, ey - 5);
    ctx.lineTo(ex + 7, ey - 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 子弹（向上飞）
  for (let i = 0; i < 3; i++) {
    const cycle = (t * 1.2 + i / 3) % 1;
    const by = y + h * 0.72 - cycle * h * 0.5;
    ctx.save();
    ctx.globalAlpha = Math.sin(cycle * Math.PI);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    ctx.fillStyle = accent;
    ctx.fillRect(x + w * 0.5 - 1 + (i - 1) * 8, by, 2, 8);
    ctx.restore();
  }

  // 玩家战机
  const shipX = x + w * 0.5 + Math.sin(t * 1.8) * w * 0.08;
  const shipY = y + h * 0.74;
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(shipX, shipY - 12);
  ctx.lineTo(shipX - 10, shipY + 8);
  ctx.lineTo(shipX - 3, shipY + 4);
  ctx.lineTo(shipX + 3, shipY + 4);
  ctx.lineTo(shipX + 10, shipY + 8);
  ctx.closePath();
  ctx.fill();
  // 尾焰
  const flame = 4 + Math.sin(t * 12) * 2;
  ctx.shadowColor = "#FFD666";
  ctx.fillStyle = "#FFD666";
  ctx.beginPath();
  ctx.moveTo(shipX - 3, shipY + 6);
  ctx.lineTo(shipX, shipY + 6 + flame + 4);
  ctx.lineTo(shipX + 3, shipY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 诈园区：抛物线弹道 + 园区建筑 + 爆炸 */
function drawBombCover(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, accent: string): void {
  // 地面
  ctx.save();
  ctx.fillStyle = "rgba(27,95,204,0.25)";
  ctx.fillRect(x, y + h * 0.78, w, h * 0.22);
  ctx.restore();

  // 园区基座
  const ix = x + w * 0.58;
  const iy = y + h * 0.78;
  ctx.save();
  ctx.fillStyle = "#3D5A43";
  ctx.beginPath();
  ctx.ellipse(ix + w * 0.12, iy, w * 0.24, h * 0.08, 0, Math.PI, 0);
  ctx.fill();
  // 园区综合体（盒状）
  ctx.fillStyle = "#8A7B5C";
  ctx.fillRect(ix, iy - h * 0.3, w * 0.08, h * 0.3);
  ctx.fillRect(ix + w * 0.12, iy - h * 0.2, w * 0.07, h * 0.2);
  // 天线
  ctx.strokeStyle = "#E5353B";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ix + w * 0.04, iy - h * 0.3);
  ctx.lineTo(ix + w * 0.04, iy - h * 0.42);
  ctx.stroke();
  ctx.restore();

  // 反诈意大利炮（左下）
  const bx = x + w * 0.16;
  const by = y + h * 0.82;
  ctx.save();
  ctx.fillStyle = "#4A5D7A";
  ctx.beginPath();
  ctx.arc(bx, by, 8, Math.PI, 0);
  ctx.fill();
  const aimA = -Math.PI / 4;
  ctx.strokeStyle = "#4A5D7A";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bx, by - 4);
  ctx.lineTo(bx + Math.cos(aimA) * 14, by - 4 + Math.sin(aimA) * 14);
  ctx.stroke();
  ctx.restore();

  // 弹道虚线
  ctx.save();
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    const tx = bx + (ix - bx + w * 0.02) * p;
    const ty = by - 6 - (by - 6 - (iy - h * 0.32)) * p - Math.sin(p * Math.PI) * h * 0.28;
    if (i === 0) ctx.moveTo(tx, ty);
    else ctx.lineTo(tx, ty);
  }
  ctx.stroke();
  ctx.restore();

  // 飞行的炮弹
  const fly = (t * 0.7) % 1;
  const sx = bx + (ix - bx + w * 0.02) * fly;
  const sy = by - 6 - (by - 6 - (iy - h * 0.32)) * fly - Math.sin(fly * Math.PI) * h * 0.28;
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 落点爆炸（循环后段）
  if (fly > 0.9) {
    const ep = (fly - 0.9) / 0.1;
    ctx.save();
    ctx.globalAlpha = 1 - ep;
    ctx.shadowColor = "#FFD666";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#FFD666";
    ctx.beginPath();
    ctx.arc(ix + w * 0.04, iy - h * 0.32, 4 + ep * 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
