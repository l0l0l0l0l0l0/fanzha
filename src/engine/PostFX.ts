/**
 * 全局后处理 FX 层 · Cyber Police Terminal
 *
 * 由 SceneDirector.loop 在 current.render(...) 之后调用，直接操作显示画布。
 * 零离屏 buffer：全部效果用 displayCtx 叠加 + drawImage(displayCanvas, self) 实现。
 *
 * 效果：CRT 扫描线 / 扫描带扫掠 / 暗角 / 胶片噪点 / 边缘色差 / 故障 glitch / 屏闪 / 震屏 / 霓虹边框
 *
 * 引擎/场景通过单例 postFX 触发：postFX.flash(...) / postFX.shake(...) / postFX.glitch(...)
 */
import { Theme, withAlpha } from "@/ui/Theme";

export interface FXConfig {
  enable: boolean;
  scanlines: boolean;
  sweep: boolean;
  vignette: boolean;
  grain: boolean;
  chromaticAberration: boolean;
  glitch: boolean;
  neonFrame: boolean;
  bloom: boolean;       // v2：辉光（亮区溢出）
  dither: boolean;      // v2：有序抖动（复古色带）
  /** 0..1 全局强度倍率 */
  intensity: number;
  /** 移动端降级阈值（CSS px 宽度） */
  mobileWidth: number;
}

export const FX_CONFIG: FXConfig = {
  enable: true,
  // 以下三项为视觉模糊主因，默认关闭以保证小字可读性
  // - bloom：整屏 blur 降采样叠加，会让文字发糊
  // - grain：每帧随机噪点，破坏小字锐度
  // - dither：复古色带抖动，干扰细节
  bloom: false,
  grain: false,
  dither: false,
  // 扫描线/暗角保留但降强度，维持赛博警务终端氛围但不糊字
  scanlines: true,
  vignette: true,
  // 以下保留原效果
  sweep: true,
  chromaticAberration: true,
  glitch: true,
  neonFrame: true,
  intensity: 1,
  mobileWidth: 600,
};

interface FlashState {
  color: string;
  alpha: number;
  decay: number; // alpha per second
}

/**
 * v7：闪屏/故障节流配置
 * 战斗中 postFX.flash/glitch 会被大量调用（击杀、BOSS阶段、突破防线、大招…），
 * 若不加节流，连续触发会让 flashState 永不衰减 → 持续闪屏。
 * 冷却期内的新触发只有"显著更强"才覆盖当前状态，避免闪烁堆积。
 */
const FLASH_COOLDOWN = 0.35; // 秒：两次屏闪之间最小间隔
const GLITCH_COOLDOWN = 0.5; // 秒：两次故障之间最小间隔

class PostFX {
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private devW = 0;
  private devH = 0;
  private t = 0;

  private flashState: FlashState | null = null;
  /** v7：上次屏闪触发时间（用于冷却节流） */
  private lastFlashAt = -1;
  private shakeMag = 0;
  private shakeDecay = 0; // magnitude per second
  private glitchSpike = 0; // 0..1
  private glitchDecay = 0;
  /** v7：上次故障触发时间（用于冷却节流） */
  private lastGlitchAt = -1;

  /** 噪点缓存坐标（避免每帧 new Array） */
  private grainBuf = new Float32Array(64 * 3);

  /** 自动降级（小屏 / 高 dpr） */
  private degraded = false;

  /**
   * v8：中间快照画布——根治 self-blit 闪烁
   * 原 drawChromaticAberration / drawGlitch / drawShake / drawBloom 把 displayCanvas
   * 画到自身（ctx.drawImage(canvas, self)），浏览器同时读写同一 bitmap 会导致
   * 撕裂/反馈/持续闪烁。改为每帧先将 displayCanvas 复制到 fxSrcCanvas，
   * 后续 self-referential 效果一律从 fxSrcCanvas 读取。
   */
  private fxSrcCanvas: HTMLCanvasElement | null = null;
  private fxSrcCtx: CanvasRenderingContext2D | null = null;

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.devW = Math.round(cssW * dpr);
    this.devH = Math.round(cssH * dpr);
    this.degraded = cssW < FX_CONFIG.mobileWidth || dpr > 2;
    // v8：同步快照画布尺寸（设备像素，与 displayCanvas 一致）
    if (this.devW > 0 && this.devH > 0) {
      if (!this.fxSrcCanvas && typeof document !== "undefined") {
        this.fxSrcCanvas = document.createElement("canvas");
        this.fxSrcCtx = this.fxSrcCanvas.getContext("2d");
      }
      if (this.fxSrcCanvas) {
        this.fxSrcCanvas.width = this.devW;
        this.fxSrcCanvas.height = this.devH;
      }
    }
  }

  /**
   * 全屏色闪（v7：带冷却节流）
   * - 冷却期内（FLASH_COOLDOWN 秒）的新调用，仅当 alpha 显著更强（>1.3×）才覆盖
   * - 已有 flashState 时，新 alpha 必须超过当前已衰减 alpha 才覆盖
   * - 这样战斗中连续 flash 调用不会让屏幕持续闪烁
   */
  flash(color: string, alpha = 0.5, decay = 1.6): void {
    if (!FX_CONFIG.enable) return;
    const now = this.t;
    const sinceLast = now - this.lastFlashAt;
    const newAlpha = alpha * FX_CONFIG.intensity;
    // 冷却期内：仅显著更强者（1.3×）才覆盖
    if (sinceLast < FLASH_COOLDOWN) {
      if (!this.flashState || newAlpha > this.flashState.alpha * 1.3) {
        this.flashState = { color, alpha: newAlpha, decay };
        this.lastFlashAt = now;
      }
      return;
    }
    // 冷却期外：取较强者（原逻辑），但要求新 alpha 超过当前已衰减值
    const currentAlpha = this.flashState ? this.flashState.alpha : 0;
    if (!this.flashState || newAlpha > currentAlpha) {
      this.flashState = { color, alpha: newAlpha, decay };
      this.lastFlashAt = now;
    }
  }

  /** 全局震屏 */
  shake(magnitude = 6, decay = 14): void {
    if (!FX_CONFIG.enable) return;
    this.shakeMag = Math.max(this.shakeMag, magnitude * FX_CONFIG.intensity);
    this.shakeDecay = decay;
  }

  /**
   * 故障峰值（v7：带冷却节流）
   * 冷却期内（GLITCH_COOLDOWN 秒）不再叠加新 spike，
   * 避免战斗中连续 glitch 调用让 glitchSpike 永不衰减。
   */
  glitch(spike = 0.8, decay = 3): void {
    if (!FX_CONFIG.enable || !FX_CONFIG.glitch) return;
    const now = this.t;
    if (now - this.lastGlitchAt < GLITCH_COOLDOWN) {
      // 冷却期内：仅显著更强者（1.4×）才覆盖
      if (spike * FX_CONFIG.intensity > this.glitchSpike * 1.4) {
        this.glitchSpike = spike * FX_CONFIG.intensity;
        this.glitchDecay = decay;
        this.lastGlitchAt = now;
      }
      return;
    }
    this.glitchSpike = Math.max(this.glitchSpike, spike * FX_CONFIG.intensity);
    this.glitchDecay = decay;
    this.lastGlitchAt = now;
  }

  /** 当前震屏偏移（设备 px），供 SceneDirector 在场景渲染前 translate 用 */
  getShakeOffset(): { x: number; y: number } {
    if (this.shakeMag <= 0.01) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shakeMag * 2 * this.dpr,
      y: (Math.random() - 0.5) * this.shakeMag * 2 * this.dpr,
    };
  }

  update(dt: number): void {
    this.t += dt;
    if (this.flashState) {
      this.flashState.alpha -= this.flashState.decay * dt;
      if (this.flashState.alpha <= 0) this.flashState = null;
    }
    if (this.shakeMag > 0) {
      this.shakeMag -= this.shakeDecay * dt;
      if (this.shakeMag < 0) this.shakeMag = 0;
    }
    if (this.glitchSpike > 0) {
      this.glitchSpike -= this.glitchDecay * dt;
      if (this.glitchSpike < 0) this.glitchSpike = 0;
    }
  }

  /**
   * 在显示画布上叠加全部后处理。
   * ctx / canvas 为 SceneDirector 的 displayCtx / displayCanvas。
   * 在 identity（设备像素）空间内绘制，结束恢复原 transform。
   *
   * v8：根治 self-blit 闪烁——每帧先将 displayCanvas 复制到 fxSrcCanvas，
   * 色差/glitch/震屏/辉光等 self-referential 效果从 fxSrcCanvas 读取，
   * 不再直接 drawImage(canvas, self)。
   */
  render(ctx: CanvasRenderingContext2D, canvas: CanvasImageSource): void {
    if (!FX_CONFIG.enable) return;
    const W = this.devW;
    const H = this.devH;
    if (W <= 0 || H <= 0) return;

    // v8：快照 displayCanvas → fxSrcCanvas（仅当需要 self-blit 效果时）
    const needSrc = FX_CONFIG.chromaticAberration || FX_CONFIG.glitch
      || this.shakeMag > 0.5 || (FX_CONFIG.bloom && !this.degraded);
    if (needSrc && this.fxSrcCanvas && this.fxSrcCtx) {
      this.fxSrcCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.fxSrcCtx.globalCompositeOperation = "source-over";
      this.fxSrcCtx.globalAlpha = 1;
      this.fxSrcCtx.clearRect(0, 0, W, H);
      this.fxSrcCtx.drawImage(canvas as CanvasImageSource, 0, 0, W, H);
    }
    const src: CanvasImageSource = (this.fxSrcCanvas && needSrc) ? this.fxSrcCanvas : canvas;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    const I = FX_CONFIG.intensity * (this.degraded ? 0.6 : 1);

    // 1. 边缘色差（从快照读取，避免 self-blit）
    if (FX_CONFIG.chromaticAberration && !this.degraded) {
      this.drawChromaticAberration(ctx, src, W, H, I);
    }

    // 2. 故障 glitch（从快照读取切片）
    if (FX_CONFIG.glitch) {
      this.drawGlitch(ctx, src, W, H, I);
    }

    // 3. 震屏（从快照读取偏移重绘）
    if (this.shakeMag > 0.5) {
      this.drawShake(ctx, src, W, H);
    }

    // 4. CRT 扫描线
    if (FX_CONFIG.scanlines) {
      this.drawScanlines(ctx, W, H, I);
    }

    // 5. 扫描带扫掠
    if (FX_CONFIG.sweep) {
      this.drawSweep(ctx, W, H, I);
    }

    // 6. 暗角
    if (FX_CONFIG.vignette) {
      this.drawVignette(ctx, W, H, I);
    }

    // 7. 胶片噪点
    if (FX_CONFIG.grain) {
      this.drawGrain(ctx, W, H, I);
    }

    // 7.5 v2 辉光（亮区溢出，从快照读取，避免 self-blit）
    if (FX_CONFIG.bloom && !this.degraded) {
      this.drawBloom(ctx, src, W, H, I);
    }

    // 7.6 v2 有序抖动（复古色带，默认关闭）
    if (FX_CONFIG.dither && !this.degraded) {
      this.drawDither(ctx, W, H, I);
    }

    // 8. 屏闪
    if (this.flashState) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = withAlpha(this.flashState.color, Math.min(1, this.flashState.alpha));
      ctx.fillRect(0, 0, W, H);
    }

    // 9. 霓虹边框
    if (FX_CONFIG.neonFrame) {
      this.drawNeonFrame(ctx, W, H, I);
    }

    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  // ============ 实现 ============

  private drawScanlines(ctx: CanvasRenderingContext2D, W: number, H: number, I: number): void {
    // 稀疏化：每 8px 一条，避免切碎小字
    const step = this.degraded ? 10 : 8;
    const flicker = 1 + Math.sin(this.t * 7.3) * 0.08;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    // 主层：青色细线（强度减半）
    ctx.fillStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.025 * I * flicker);
    for (let y = 0; y < H; y += step) {
      ctx.fillRect(0, y, W, 1);
    }
    // 副层：稀疏暗线（CRT 显像管感）
    ctx.fillStyle = `rgba(0,0,0,${0.03 * I})`;
    for (let y = 0; y < H; y += step * 4) {
      ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();
  }

  private drawSweep(ctx: CanvasRenderingContext2D, W: number, H: number, I: number): void {
    const bandH = H * 0.18;
    const y = ((this.t * 0.18) % 1.4 - 0.2) * H;
    const grad = ctx.createLinearGradient(0, y - bandH, 0, y + bandH);
    grad.addColorStop(0, "rgba(0,229,255,0)");
    grad.addColorStop(0.5, `rgba(0,229,255,${0.05 * I})`);
    grad.addColorStop(1, "rgba(0,229,255,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - bandH, W, bandH * 2);
    ctx.restore();
  }

  private drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number, I: number): void {
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.hypot(W, H) / 2;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.05);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    // 暗角强度从 0.5 降到 0.3，避免边缘文字被遮蔽
    grad.addColorStop(1, `rgba(0,0,0,${0.3 * I})`);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // 四角加深（CRT 球面错觉）
    ctx.fillStyle = `rgba(10,25,41,${0.15 * I})`;
    const c = Math.round(Math.min(W, H) * 0.06);
    // 左上
    ctx.fillRect(0, 0, c, 1); ctx.fillRect(0, 0, 1, c);
    ctx.restore();
  }

  private drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number, I: number): void {
    const n = this.degraded ? 40 : 90;
    const buf = this.grainBuf;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const a = (0.02 + Math.random() * 0.05) * I;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, this.dpr > 1 ? 2 : 1, this.dpr > 1 ? 2 : 1);
    }
    // 偶发暗点
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < n * 0.4; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      ctx.fillStyle = `rgba(0,0,0,${0.03 * I})`;
      ctx.fillRect(x, y, this.dpr > 1 ? 2 : 1, this.dpr > 1 ? 2 : 1);
    }
    void buf;
    ctx.restore();
  }

  private drawChromaticAberration(ctx: CanvasRenderingContext2D, canvas: CanvasImageSource, W: number, H: number, I: number): void {
    // 边缘条 self 偏移 + 加性：左/右各一条窄带，红青错位
    const stripW = Math.max(8, Math.round(Math.min(W, H) * 0.06));
    const off = Math.max(1, Math.round(this.dpr * 2 * I));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // 左带：向右偏移红
    ctx.globalAlpha = 0.5 * I;
    ctx.drawImage(canvas, 0, 0, stripW, H, off, 0, stripW, H);
    // 右带：向左偏移青
    ctx.drawImage(canvas, W - stripW, 0, stripW, H, W - stripW - off, 0, stripW, H);
    ctx.globalAlpha = 1;
    // 边缘彩色渐变（强化 CA 色感）
    const lg = ctx.createLinearGradient(0, 0, stripW * 2, 0);
    lg.addColorStop(0, `rgba(255,0,80,${0.16 * I})`);
    lg.addColorStop(1, "rgba(255,0,80,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, stripW * 2, H);
    const rg = ctx.createLinearGradient(W, 0, W - stripW * 2, 0);
    rg.addColorStop(0, `rgba(0,229,255,${0.16 * I})`);
    rg.addColorStop(1, "rgba(0,229,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(W - stripW * 2, 0, stripW * 2, H);
    ctx.restore();
  }

  private drawGlitch(ctx: CanvasRenderingContext2D, canvas: CanvasImageSource, W: number, H: number, I: number): void {
    // v7：仅在有 spike 时触发故障，移除随机基础故障（baseChance→0）
    // 原随机 baseChance=0.02 会在战斗中持续触发微小撕裂，叠加 spike 后画面一直闪
    const spike = this.glitchSpike;
    if (spike < 0.08) return; // 低于阈值完全不画故障，杜绝背景闪烁

    ctx.save();
    const slices = spike > 0.3 ? 4 : 2;
    for (let i = 0; i < slices; i++) {
      const sy = Math.random() * H;
      const sh = Math.round(4 + Math.random() * (H * 0.12));
      const dx = Math.round((Math.random() - 0.5) * (8 + spike * 40) * this.dpr);
      ctx.drawImage(canvas, 0, sy, W, sh, dx, sy, W, sh);
    }
    // 撕裂亮线
    ctx.globalCompositeOperation = "lighter";
    const lines = spike > 0.3 ? 3 : 1;
    for (let i = 0; i < lines; i++) {
      const y = Math.random() * H;
      const h = Math.max(1, Math.round(this.dpr * (1 + Math.random() * 2)));
      const col = Math.random() < 0.5 ? "255,0,80" : "0,229,255";
      ctx.fillStyle = `rgba(${col},${0.25 * I + spike * 0.4})`;
      ctx.fillRect(0, y, W, h);
    }
    ctx.restore();
  }

  private drawShake(ctx: CanvasRenderingContext2D, canvas: CanvasImageSource, W: number, H: number): void {
    const off = this.getShakeOffset();
    if (Math.abs(off.x) < 0.5 && Math.abs(off.y) < 0.5) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    // 先填底色（防露边）
    ctx.fillStyle = Theme.colors.bg.deep;
    ctx.fillRect(0, 0, W, H);
    // self 重绘偏移
    ctx.drawImage(canvas, 0, 0, W, H, -off.x, -off.y, W, H);
    ctx.restore();
  }

  /** v2：辉光——把画面模糊后以加性叠加回去，模拟亮区溢出 */
  private drawBloom(ctx: CanvasRenderingContext2D, canvas: CanvasImageSource, W: number, H: number, I: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35 * I;
    // 用 canvas filter 做廉价模糊（Chrome/Edge/Safari 支持）
    // 降采样到 1/2 再放大，减少模糊开销
    const sw = Math.max(1, Math.round(W / 2));
    const sh = Math.max(1, Math.round(H / 2));
    ctx.filter = `blur(${Math.max(2, Math.round(this.dpr * 3))}px)`;
    ctx.drawImage(canvas, 0, 0, W, H, 0, 0, sw, sh);
    // 再放大回全屏（带模糊的亮区）
    ctx.filter = "none";
    ctx.globalAlpha = 0.25 * I;
    ctx.drawImage(canvas, 0, 0, W, H, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.35 * I;
    ctx.drawImage(canvas, 0, 0, sw, sh, 0, 0, W, H);
    ctx.restore();
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  }

  /** v2：有序抖动——4x4 Bayer 矩阵稀疏点叠层，模拟色带/复古感 */
  private drawDither(ctx: CanvasRenderingContext2D, W: number, H: number, I: number): void {
    // 4x4 Bayer 矩阵（0..15）
    const bayer = [
      0, 8, 2, 10,
      12, 4, 14, 6,
      3, 11, 1, 9,
      15, 7, 13, 5,
    ];
    const step = Math.max(2, Math.round(this.dpr * 2));
    const size = 4;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    // 亮抖点
    ctx.fillStyle = `rgba(255,255,255,${0.04 * I})`;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const bx = (x / step) % size;
        const by = (y / step) % size;
        const v = bayer[by * size + bx];
        if (v > 11) ctx.fillRect(x, y, step, step);
      }
    }
    // 暗抖点
    ctx.fillStyle = `rgba(0,0,0,${0.06 * I})`;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const bx = (x / step) % size;
        const by = (y / step) % size;
        const v = bayer[by * size + bx];
        if (v < 4) ctx.fillRect(x, y, step, step);
      }
    }
    ctx.restore();
  }

  private drawNeonFrame(ctx: CanvasRenderingContext2D, W: number, H: number, I: number): void {
    const len = Math.round(Math.min(W, H) * 0.05);
    const inset = Math.max(2, Math.round(this.dpr * 2));
    const t = this.t;
    // 顶部红蓝警灯脉冲
    const police = (Math.sin(t * 3) + 1) / 2; // 0..1
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const barH = Math.round(this.dpr * 3);
    const gradL = ctx.createLinearGradient(0, 0, W * 0.5, 0);
    gradL.addColorStop(0, `rgba(27,95,204,${0.25 * I * police})`);
    gradL.addColorStop(1, "rgba(27,95,204,0)");
    ctx.fillStyle = gradL;
    ctx.fillRect(0, 0, W * 0.5, barH);
    const gradR = ctx.createLinearGradient(W, 0, W * 0.5, 0);
    gradR.addColorStop(0, `rgba(229,53,59,${0.25 * I * (1 - police)})`);
    gradR.addColorStop(1, "rgba(229,53,59,0)");
    ctx.fillStyle = gradR;
    ctx.fillRect(W * 0.5, 0, W * 0.5, barH);

    // 四角括号
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = withAlpha(Theme.colors.neon.DEFAULT, 0.35 * I);
    ctx.lineWidth = Math.max(1, this.dpr);
    ctx.shadowColor = Theme.colors.neon.DEFAULT;
    ctx.shadowBlur = 6 * I;
    const c = inset;
    // 左上
    ctx.beginPath();
    ctx.moveTo(c, c + len); ctx.lineTo(c, c); ctx.lineTo(c + len, c);
    // 右上
    ctx.moveTo(W - c - len, c); ctx.lineTo(W - c, c); ctx.lineTo(W - c, c + len);
    // 左下
    ctx.moveTo(c, H - c - len); ctx.lineTo(c, H - c); ctx.lineTo(c + len, H - c);
    // 右下
    ctx.moveTo(W - c - len, H - c); ctx.lineTo(W - c, H - c); ctx.lineTo(W - c, H - c - len);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

export const postFX = new PostFX();
