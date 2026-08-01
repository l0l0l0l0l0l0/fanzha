/**
 * 设计令牌
 */

export const Theme = {
  colors: {
    bg: {
      deep: "#0A1929",
      panel: "#0F2236",
      card: "#122A42",
      line: "#1B3A5A",
    },
    ink: {
      DEFAULT: "#F0F4FF",
      muted: "#7A8FB0",
      dim: "#4A5D7A",
    },
    police: {
      DEFAULT: "#1B5FCC",
      glow: "#3B7FEF",
    },
    warn: {
      DEFAULT: "#E5353B",
      glow: "#FF5A60",
    },
    neon: {
      DEFAULT: "#00E5FF",
      dim: "#00A8C2",
    },
    flag: {
      DEFAULT: "#FFD666",
      dim: "#B8941E",
    },
    safe: {
      DEFAULT: "#52C41A",
      glow: "#73D13D",
    },
  },
  fonts: {
    // 注：外部字体（ZCOOL/Noto/JetBrains）通过 web.ts 的 FontFace 异步加载；
    // 加载失败时回退到中文系统字体栈，避免 Canvas 文字降级为默认无衬线
    display: '"ZCOOL KuaiLe", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Source Han Sans CN", system-ui, sans-serif',
    body: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Source Han Sans CN", system-ui, sans-serif',
    mono: '"JetBrains Mono", "ui-monospace", "Cascadia Code", "Consolas", "Menlo", monospace',
  },
  accents: {
    "fraud-buster": "#1AD670",
    manager: "#FFB020",
    thunder: "#00E5FF",
    "bomb-island": "#FF7A1A",
    "chat-detective": "#FF5A8A",
  } as Record<string, string>,
  grid: { step: 32, color: "rgba(0,229,255,0.05)" },
  shadows: {
    neon: "rgba(0, 229, 255, 0.6)",
    police: "rgba(27, 95, 204, 0.45)",
    warn: "rgba(229, 53, 59, 0.45)",
  },
  /** 赛博警务终端 FX 色板（PostFX / 场景动效共用） */
  fx: {
    glitchRed: "#FF0050",
    glitchCyan: "#00E5FF",
    caRed: "rgba(255,0,80,1)",
    caCyan: "rgba(0,229,255,1)",
    grain: "rgba(255,255,255,1)",
    scanline: "rgba(0,229,255,1)",
    vignette: "rgba(0,0,0,1)",
    policeBlue: "#1B5FCC",
    policeRed: "#E5353B",
  },
  /** 全新升级：渐变 / 阴影 / 高程令牌（v2） */
  gradients: {
    /** Hero 顶部光晕 */
    heroGlow: "radial-gradient(circle at 30% 10%, rgba(0,229,255,0.08), transparent 60%)",
    /** 卡片悬浮发光 */
    cardGlow: "radial-gradient(circle at 50% 0%, rgba(0,229,255,0.18), transparent 70%)",
    /** 警示横条 */
    alertBar: "linear-gradient(90deg, rgba(229,53,59,0.25), rgba(229,53,59,0.05))",
    /** 信号扫描带 */
    sweepBand: "linear-gradient(180deg, transparent, rgba(0,229,255,0.18), transparent)",
    /** 警灯左 */
    policeLeft: "linear-gradient(90deg, rgba(27,95,204,0.45), transparent)",
    /** 警灯右 */
    policeRight: "linear-gradient(270deg, rgba(229,53,59,0.45), transparent)",
    /** 进度填充 */
    fill: "linear-gradient(90deg, #00E5FF, #1B5FCC)",
  },
  /** 高程阴影 */
  elevations: {
    card: "0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,229,255,0.08)",
    cardHover: "0 8px 30px rgba(0,229,255,0.18), 0 0 0 1px rgba(0,229,255,0.45)",
    panel: "0 2px 12px rgba(0,0,0,0.3)",
    modal: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(229,53,59,0.4)",
  },
  /** 全新升级：动画时长 / 曲线令牌（v2） */
  motion: {
    fast: 0.18,
    normal: 0.32,
    slow: 0.55,
    spring: 0.42,
  },
  /** 全新升级：警示文案色（v2 ticker 用） */
  alert: {
    critical: "#FF3B5C",
    warning: "#FFB020",
    info: "#00E5FF",
    success: "#1AD670",
  },
} as const;

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const ah = Math.round(a * 255).toString(16).padStart(2, "0");
  return hex + ah;
}
