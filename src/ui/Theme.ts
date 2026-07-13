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
    display: '"ZCOOL KuaiLe", "Noto Sans SC", sans-serif',
    body: '"Noto Sans SC", sans-serif',
    mono: '"JetBrains Mono", "ui-monospace", monospace',
  },
  accents: {
    "fraud-buster": "#1AD670",
    manager: "#FFB020",
    thunder: "#00E5FF",
    "bomb-island": "#FF7A1A",
  } as Record<string, string>,
  grid: { step: 32, color: "rgba(0,229,255,0.05)" },
  shadows: {
    neon: "rgba(0, 229, 255, 0.6)",
    police: "rgba(27, 95, 204, 0.45)",
    warn: "rgba(229, 53, 59, 0.45)",
  },
} as const;

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const ah = Math.round(a * 255).toString(16).padStart(2, "0");
  return hex + ah;
}
