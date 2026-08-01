/**
 * Canvas 图标绘制（替代 lucide-react 的 SVG 图标）
 * 每个图标在以 (x, y) 为左上角的 size×size 正方形内绘制
 */
import { Theme } from "./Theme";

export type IconName =
  | "arrowLeft" | "arrowRight" | "pause" | "play" | "volumeOn" | "volumeOff"
  | "home" | "trash" | "phone" | "alert" | "shield" | "heart" | "zap"
  | "bomb" | "lock" | "check" | "x" | "info" | "trophy" | "rotate" | "share"
  | "star" | "clock" | "award" | "book" | "users" | "crosshair" | "target"
  | "gift" | "calendar" | "coin" | "energy" | "fragment" | "download" | "story"
  | "chevronRight" | "flag" | "flame" | "lightning" | "gear"
  | "chat" | "brain";

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: IconName,
  x: number, y: number, size: number,
  color: string = Theme.colors.ink.DEFAULT
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;

  switch (name) {
    case "arrowLeft":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy);
      ctx.lineTo(cx + r * 0.4, cy);
      ctx.moveTo(cx - r * 0.4, cy);
      ctx.lineTo(cx - r * 0.1, cy - r * 0.3);
      ctx.moveTo(cx - r * 0.4, cy);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.3);
      ctx.stroke();
      break;
    case "arrowRight":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy);
      ctx.lineTo(cx + r * 0.4, cy);
      ctx.moveTo(cx + r * 0.4, cy);
      ctx.lineTo(cx + r * 0.1, cy - r * 0.3);
      ctx.moveTo(cx + r * 0.4, cy);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.3);
      ctx.stroke();
      break;
    case "pause":
      ctx.fillRect(cx - r * 0.4, cy - r * 0.5, r * 0.25, r);
      ctx.fillRect(cx + r * 0.15, cy - r * 0.5, r * 0.25, r);
      break;
    case "play":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    case "volumeOn":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy - r * 0.2);
      ctx.lineTo(cx - r * 0.2, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.1, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.5);
      ctx.lineTo(cx - r * 0.2, cy + r * 0.2);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + r * 0.2, cy, r * 0.15, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      break;
    case "volumeOff":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy - r * 0.2);
      ctx.lineTo(cx - r * 0.2, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.1, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.5);
      ctx.lineTo(cx - r * 0.2, cy + r * 0.2);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.3, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.6, cy + r * 0.3);
      ctx.moveTo(cx + r * 0.6, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.3, cy + r * 0.3);
      ctx.stroke();
      break;
    case "home":
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.4);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.4);
      ctx.lineTo(cx - r * 0.5, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(cx - r * 0.15, cy + r * 0.1, r * 0.3, r * 0.3);
      break;
    case "trash":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.3);
      ctx.moveTo(cx - r * 0.3, cy - r * 0.3);
      ctx.lineTo(cx - r * 0.2, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.2, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.3);
      ctx.moveTo(cx - r * 0.15, cy - r * 0.4);
      ctx.lineTo(cx + r * 0.15, cy - r * 0.4);
      ctx.stroke();
      break;
    case "phone":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy - r * 0.4);
      ctx.quadraticCurveTo(cx - r * 0.4, cy - r * 0.2, cx - r * 0.3, cy);
      ctx.quadraticCurveTo(cx, cy + r * 0.3, cx + r * 0.3, cy + r * 0.1);
      ctx.quadraticCurveTo(cx + r * 0.5, cy, cx + r * 0.4, cy - r * 0.2);
      ctx.quadraticCurveTo(cx + r * 0.2, cy - r * 0.3, cx + r * 0.1, cy - r * 0.2);
      ctx.lineTo(cx, cy - r * 0.1);
      ctx.lineTo(cx - r * 0.2, cy - r * 0.3);
      ctx.closePath();
      ctx.fill();
      break;
    case "alert":
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.4);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.4);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(cx - r * 0.06, cy - r * 0.15, r * 0.12, r * 0.3);
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.3, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "shield":
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.1);
      ctx.quadraticCurveTo(cx + r * 0.4, cy + r * 0.4, cx, cy + r * 0.5);
      ctx.quadraticCurveTo(cx - r * 0.4, cy + r * 0.4, cx - r * 0.4, cy + r * 0.1);
      ctx.lineTo(cx - r * 0.4, cy - r * 0.3);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.15, cy);
      ctx.lineTo(cx - r * 0.05, cy + r * 0.15);
      ctx.lineTo(cx + r * 0.2, cy - r * 0.15);
      ctx.stroke();
      break;
    case "heart":
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.4);
      ctx.bezierCurveTo(cx - r * 0.6, cy, cx - r * 0.4, cy - r * 0.5, cx, cy - r * 0.2);
      ctx.bezierCurveTo(cx + r * 0.4, cy - r * 0.5, cx + r * 0.6, cy, cx, cy + r * 0.4);
      ctx.closePath();
      ctx.fill();
      break;
    case "zap":
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.1, cy - r * 0.5);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.1);
      ctx.lineTo(cx, cy + r * 0.1);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.1);
      ctx.lineTo(cx, cy - r * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case "bomb":
      ctx.beginPath();
      ctx.arc(cx - r * 0.05, cy + r * 0.1, r * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.2, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.5);
      ctx.stroke();
      break;
    case "lock":
      ctx.beginPath();
      ctx.rect(cx - r * 0.3, cy - r * 0.05, r * 0.6, r * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.1, r * 0.25, Math.PI, 0);
      ctx.stroke();
      break;
    case "check":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.3);
      ctx.stroke();
      break;
    case "x":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.3, cy + r * 0.3);
      ctx.moveTo(cx + r * 0.3, cy - r * 0.3);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.3);
      ctx.stroke();
      break;
    case "info":
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `700 ${size * 0.5}px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("i", cx, cy + 1);
      break;
    case "trophy":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy - r * 0.4);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.4);
      ctx.lineTo(cx + r * 0.2, cy + r * 0.1);
      ctx.lineTo(cx - r * 0.2, cy + r * 0.1);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy - r * 0.3);
      ctx.lineTo(cx - r * 0.45, cy - r * 0.1);
      ctx.moveTo(cx + r * 0.3, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.45, cy - r * 0.1);
      ctx.stroke();
      ctx.fillRect(cx - r * 0.05, cy + r * 0.1, r * 0.1, r * 0.2);
      ctx.fillRect(cx - r * 0.2, cy + r * 0.3, r * 0.4, r * 0.1);
      break;
    case "rotate":
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.4, Math.PI * 0.2, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.4, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.05);
      ctx.lineTo(cx + r * 0.25, cy - r * 0.05);
      ctx.closePath();
      ctx.fill();
      break;
    case "share":
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy, r * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.35, cy - r * 0.3, r * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.35, cy + r * 0.3, r * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy);
      ctx.lineTo(cx + r * 0.2, cy - r * 0.3);
      ctx.moveTo(cx - r * 0.2, cy);
      ctx.lineTo(cx + r * 0.2, cy + r * 0.3);
      ctx.stroke();
      break;
    case "star":
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = cx + Math.cos(a) * r * 0.5;
        const py = cy + Math.sin(a) * r * 0.5;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case "clock":
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - r * 0.3);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * 0.2, cy);
      ctx.stroke();
      break;
    case "award":
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.1, r * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.25, cy + r * 0.15);
      ctx.lineTo(cx - r * 0.15, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.15, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.25, cy + r * 0.15);
      ctx.stroke();
      break;
    case "book":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy - r * 0.3);
      ctx.lineTo(cx, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.3);
      ctx.lineTo(cx, cy + r * 0.4);
      ctx.lineTo(cx - r * 0.4, cy + r * 0.3);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.2);
      ctx.lineTo(cx, cy + r * 0.4);
      ctx.stroke();
      break;
    case "users":
      ctx.beginPath();
      ctx.arc(cx - r * 0.2, cy - r * 0.15, r * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.25, cy - r * 0.05, r * 0.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy + r * 0.4);
      ctx.quadraticCurveTo(cx - r * 0.2, cy + r * 0.1, cx + r * 0.1, cy + r * 0.4);
      ctx.stroke();
      break;
    case "crosshair":
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy);
      ctx.lineTo(cx - r * 0.2, cy);
      ctx.moveTo(cx + r * 0.2, cy);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx, cy - r * 0.2);
      ctx.moveTo(cx, cy + r * 0.2);
      ctx.lineTo(cx, cy + r * 0.5);
      ctx.stroke();
      break;
    case "target":
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    // ===== v2 新增图标 =====
    case "gift":
      // 礼物盒 + 蝴蝶结
      ctx.fillRect(cx - r * 0.4, cy - r * 0.1, r * 0.8, r * 0.5);
      ctx.beginPath();
      ctx.rect(cx - r * 0.4, cy + r * 0.05, r * 0.8, r * 0.4);
      ctx.stroke();
      ctx.fillRect(cx - r * 0.4, cy - r * 0.2, r * 0.8, r * 0.15);
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.2);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.25);
      ctx.quadraticCurveTo(cx - r * 0.3, cy - r * 0.45, cx - r * 0.15, cy - r * 0.25);
      ctx.quadraticCurveTo(cx, cy - r * 0.15, cx, cy - r * 0.25);
      ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 0.45, cx + r * 0.15, cy - r * 0.25);
      ctx.quadraticCurveTo(cx, cy - r * 0.15, cx, cy - r * 0.25);
      ctx.stroke();
      break;
    case "calendar":
      ctx.beginPath();
      ctx.rect(cx - r * 0.4, cy - r * 0.35, r * 0.8, r * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy - r * 0.15);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.25, cy - r * 0.45);
      ctx.lineTo(cx - r * 0.25, cy - r * 0.25);
      ctx.moveTo(cx + r * 0.25, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.25, cy - r * 0.25);
      ctx.stroke();
      // 日期点阵
      ctx.fillStyle = color;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.arc(cx - r * 0.2 + j * r * 0.2, cy + r * 0.0 + i * r * 0.12, r * 0.04, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case "coin":
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `700 ${size * 0.45}px ${Theme.fonts.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("¥", cx, cy + 1);
      break;
    case "energy":
      // 闪电能量
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.05, cy - r * 0.45);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.05);
      ctx.lineTo(cx - r * 0.05, cy + r * 0.05);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.45);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.05, cy - r * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case "fragment":
      // 菱形碎片
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.35, cy);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.lineTo(cx - r * 0.35, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.45);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.moveTo(cx - r * 0.35, cy);
      ctx.lineTo(cx + r * 0.35, cy);
      ctx.stroke();
      break;
    case "download":
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.4);
      ctx.lineTo(cx, cy + r * 0.15);
      ctx.moveTo(cx - r * 0.25, cy - r * 0.05);
      ctx.lineTo(cx, cy + r * 0.25);
      ctx.lineTo(cx + r * 0.25, cy - r * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy + r * 0.35);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.35);
      ctx.stroke();
      break;
    case "story":
      // 书卷 + 五角星
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy - r * 0.25);
      ctx.lineTo(cx, cy - r * 0.15);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.25);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.35);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.lineTo(cx - r * 0.4, cy + r * 0.35);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.15);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.stroke();
      // 五角星
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = cx + Math.cos(a) * r * 0.15;
        const py = cy + r * 0.15 + Math.sin(a) * r * 0.15;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case "chevronRight":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.15, cy - r * 0.35);
      ctx.lineTo(cx + r * 0.25, cy);
      ctx.lineTo(cx - r * 0.15, cy + r * 0.35);
      ctx.stroke();
      break;
    case "flag":
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy - r * 0.45);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy - r * 0.4);
      ctx.lineTo(cx + r * 0.35, cy - r * 0.25);
      ctx.lineTo(cx + r * 0.15, cy - r * 0.05);
      ctx.lineTo(cx + r * 0.35, cy + r * 0.15);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.05);
      ctx.closePath();
      ctx.fill();
      break;
    case "flame":
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.45);
      ctx.bezierCurveTo(cx - r * 0.4, cy + r * 0.25, cx - r * 0.3, cy - r * 0.1, cx - r * 0.1, cy - r * 0.2);
      ctx.bezierCurveTo(cx - r * 0.05, cy, cx + r * 0.05, cy - r * 0.05, cx + r * 0.05, cy - r * 0.3);
      ctx.bezierCurveTo(cx + r * 0.25, cy - r * 0.15, cx + r * 0.4, cy + r * 0.1, cx + r * 0.3, cy + r * 0.3);
      ctx.bezierCurveTo(cx + r * 0.25, cy + r * 0.45, cx, cy + r * 0.5, cx, cy + r * 0.45);
      ctx.closePath();
      ctx.fill();
      break;
    case "lightning":
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.1, cy - r * 0.5);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.1);
      ctx.lineTo(cx, cy + r * 0.1);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.1);
      ctx.lineTo(cx, cy - r * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case "gear": {
      // 外圈圆 + 8 齿 + 中心孔
      const teeth = 8;
      const outerR = r * 0.85;
      const innerR = r * 0.62;
      const holeR = r * 0.28;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const ang = (Math.PI * 2 * i) / (teeth * 2) - Math.PI / 2;
        const rad = i % 2 === 0 ? outerR : innerR;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, holeR, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "chat": {
      // 对话气泡：圆角矩形 + 尾巴 + 3 点
      const bw = r * 1.5;
      const bh = r * 1.1;
      const bx = cx - bw / 2;
      const by = cy - bh / 2 - r * 0.1;
      ctx.beginPath();
      ctx.moveTo(bx + r * 0.25, by);
      ctx.lineTo(bx + bw - r * 0.25, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + r * 0.25, r * 0.25);
      ctx.lineTo(bx + bw, by + bh - r * 0.25);
      ctx.arcTo(bx + bw, by + bh, bx + bw - r * 0.25, by + bh, r * 0.25);
      ctx.lineTo(bx + r * 0.4, by + bh);
      ctx.lineTo(bx + r * 0.2, by + bh + r * 0.35);
      ctx.lineTo(bx + r * 0.3, by + bh);
      ctx.lineTo(bx + r * 0.25, by + bh);
      ctx.arcTo(bx, by + bh, bx, by + bh - r * 0.25, r * 0.25);
      ctx.lineTo(bx, by + r * 0.25);
      ctx.arcTo(bx, by, bx + r * 0.25, by, r * 0.25);
      ctx.closePath();
      ctx.stroke();
      // 3 点
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(bx + bw * (0.3 + i * 0.2), by + bh / 2, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "brain": {
      // 大脑/知识：两个半球 + 沟回
      ctx.beginPath();
      // 左半球
      ctx.arc(cx - r * 0.18, cy, r * 0.55, Math.PI * 0.35, Math.PI * 1.65, false);
      // 右半球
      ctx.arc(cx + r * 0.18, cy, r * 0.55, -Math.PI * 0.65, Math.PI * 0.65, false);
      ctx.closePath();
      ctx.stroke();
      // 中线
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.55);
      ctx.lineTo(cx, cy + r * 0.5);
      ctx.stroke();
      // 沟回（左）
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy - r * 0.2);
      ctx.bezierCurveTo(cx - r * 0.3, cy - r * 0.35, cx - r * 0.55, cy + r * 0.1, cx - r * 0.4, cy + r * 0.3);
      ctx.stroke();
      // 沟回（右）
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.45, cy - r * 0.2);
      ctx.bezierCurveTo(cx + r * 0.3, cy - r * 0.35, cx + r * 0.55, cy + r * 0.1, cx + r * 0.4, cy + r * 0.3);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/**
 * 警徽 Logo
 */
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  withText: boolean = false
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;

  ctx.save();
  // 盾牌外轮廓
  ctx.fillStyle = Theme.colors.police.DEFAULT;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.9);
  ctx.lineTo(cx + r * 0.8, cy - r * 0.5);
  ctx.lineTo(cx + r * 0.8, cy + r * 0.2);
  ctx.quadraticCurveTo(cx + r * 0.8, cy + r * 0.8, cx, cy + r * 0.9);
  ctx.quadraticCurveTo(cx - r * 0.8, cy + r * 0.8, cx - r * 0.8, cy + r * 0.2);
  ctx.lineTo(cx - r * 0.8, cy - r * 0.5);
  ctx.closePath();
  ctx.shadowColor = "rgba(0, 229, 255, 0.5)";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 内部星徽
  ctx.fillStyle = Theme.colors.neon.DEFAULT;
  ctx.font = `700 ${size * 0.55}px ${Theme.fonts.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("反诈", cx, cy);

  // 文字
  if (withText) {
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.font = `700 ${size * 0.4}px ${Theme.fonts.display}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("反诈游戏平台", x + size + 8, cy - 6);
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.font = `400 ${size * 0.2}px ${Theme.fonts.mono}`;
    ctx.fillText("ANTI-FRAUD ARCADE", x + size + 8, cy + size * 0.2);
  }
  ctx.restore();
}
