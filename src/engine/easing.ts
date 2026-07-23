/**
 * 缓动函数库
 * 全部接收 t ∈ [0,1]，返回缓动后的值
 */
export const Ease = {
  linear: (t: number): number => t,

  quadOut: (t: number): number => 1 - (1 - t) * (1 - t),
  quadInOut: (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),

  cubicOut: (t: number): number => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  quartOut: (t: number): number => 1 - Math.pow(1 - t, 4),

  expoOut: (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),

  backOut: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  elasticOut: (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  bounceOut: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
} as const;

export type EaseFn = (t: number) => number;

/** 数值动画助手：在 duration 秒内从 from 到 to */
export function tween(elapsed: number, duration: number, from: number, to: number, ease: EaseFn = Ease.quadOut): number {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  return from + (to - from) * ease(t);
}
