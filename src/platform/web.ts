/**
 * Web 平台适配层
 * 封装浏览器原生 API，提供与原 tt.ts 一致的接口签名
 */

// ============ 画布 ============

export interface GameCanvas {
  width: number;
  height: number;
  getContext(contextType: string, contextAttributes?: unknown): CanvasRenderingContext2D;
}

let mainCanvas: HTMLCanvasElement | null = null;

export function createCanvas(): GameCanvas {
  if (!mainCanvas) {
    if (typeof document === "undefined") {
      throw new Error("createCanvas requires a DOM environment");
    }
    const c = document.createElement("canvas");
    c.id = "game-canvas";
    c.style.position = "fixed";
    c.style.left = "0";
    c.style.top = "0";
    c.style.width = "100vw";
    c.style.height = "100vh";
    c.style.display = "block";
    c.style.touchAction = "none";
    document.body.appendChild(c);
    mainCanvas = c;
    const loading = document.getElementById("loading");
    if (loading) loading.remove();
  }
  return mainCanvas as unknown as GameCanvas;
}

// ============ 系统信息 ============

export interface SystemInfo {
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  statusBarHeight: number;
  safeArea: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
}

let cachedSystemInfo: SystemInfo | null = null;

function invalidateSystemInfoCache(): void {
  cachedSystemInfo = null;
}

export function getSystemInfo(): SystemInfo {
  if (cachedSystemInfo) return cachedSystemInfo;
  const w = Math.max(1, window.innerWidth || 0);
  const h = Math.max(1, window.innerHeight || 0);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  cachedSystemInfo = {
    screenWidth: w,
    screenHeight: h,
    pixelRatio: dpr,
    statusBarHeight: 0,
    safeArea: { left: 0, right: w, top: 0, bottom: h, width: w, height: h },
  };
  return cachedSystemInfo;
}

export interface MenuButtonLayout {
  top: number;
  right: number;
  width: number;
  height: number;
  bottom: number;
  left: number;
}

export function getMenuButtonLayout(): MenuButtonLayout {
  const info = getSystemInfo();
  return {
    top: -100,
    right: -100,
    width: 0,
    height: 0,
    bottom: -100,
    left: info.screenWidth - 100,
  };
}

// ============ 触摸事件 ============

export interface TouchData {
  identifier: number;
  clientX: number;
  clientY: number;
}

export interface TouchEvent {
  touches: TouchData[];
  changedTouches: TouchData[];
  timeStamp: number;
}

function mapTouch(t: globalThis.Touch | MouseEvent): TouchData {
  return {
    identifier: (t as globalThis.Touch).identifier ?? 0,
    clientX: t.clientX ?? 0,
    clientY: t.clientY ?? 0,
  };
}

function fromBrowserTouchEvent(e: globalThis.TouchEvent): TouchEvent {
  return {
    touches: Array.from(e.touches).map(mapTouch),
    changedTouches: Array.from(e.changedTouches).map(mapTouch),
    timeStamp: e.timeStamp,
  };
}

function fromMouseEvent(e: MouseEvent, type: "start" | "move" | "end"): TouchEvent {
  const t: TouchData = { identifier: 0, clientX: e.clientX, clientY: e.clientY };
  const touches = type === "end" ? [] : [t];
  return { touches, changedTouches: [t], timeStamp: e.timeStamp };
}

type TouchListener = (e: TouchEvent) => void;

function makeTouchChannel(domType: string, isMouse: boolean, kind: "start" | "move" | "end") {
  const set = new Set<TouchListener>();
  const handler = (e: Event) => {
    if (isMouse) {
      const me = e as MouseEvent;
      if (kind === "start" && me.button !== 0) return;
      const mapped = fromMouseEvent(me, kind);
      set.forEach((cb) => cb(mapped));
    } else {
      const te = e as globalThis.TouchEvent;
      const mapped = fromBrowserTouchEvent(te);
      set.forEach((cb) => cb(mapped));
    }
  };
  const target = () => mainCanvas ?? document.body;
  target().addEventListener(domType, handler as EventListener);
  return {
    on(cb: TouchListener) { set.add(cb); },
    off(cb: TouchListener) { set.delete(cb); },
  };
}

const startChannel = makeTouchChannel("touchstart", false, "start");
const moveChannel = makeTouchChannel("touchmove", false, "move");
const endChannel = makeTouchChannel("touchend", false, "end");
const cancelChannel = makeTouchChannel("touchcancel", false, "end");

const mouseStartChannel = makeTouchChannel("mousedown", true, "start");
const mouseMoveChannel = makeTouchChannel("mousemove", true, "move");
const mouseEndChannel = makeTouchChannel("mouseup", true, "end");

export function onTouchStart(cb: TouchListener): void {
  startChannel.on(cb);
  mouseStartChannel.on(cb);
}
export function onTouchMove(cb: TouchListener): void {
  moveChannel.on(cb);
  mouseMoveChannel.on(cb);
}
export function onTouchEnd(cb: TouchListener): void {
  endChannel.on(cb);
  mouseEndChannel.on(cb);
}
export function onTouchCancel(cb: TouchListener): void {
  cancelChannel.on(cb);
}

export function offTouchStart(cb: TouchListener): void {
  startChannel.off(cb);
  mouseStartChannel.off(cb);
}
export function offTouchMove(cb: TouchListener): void {
  moveChannel.off(cb);
  mouseMoveChannel.off(cb);
}
export function offTouchEnd(cb: TouchListener): void {
  endChannel.off(cb);
  mouseEndChannel.off(cb);
}
export function offTouchCancel(cb: TouchListener): void {
  cancelChannel.off(cb);
}

// ============ 窗口尺寸变化 ============

type ResizeListener = () => void;
const resizeSet = new Set<ResizeListener>();
// rAF 节流：拖拽缩放窗口时避免每帧多次重算画布尺寸
let resizeRaf = 0;
let pendingResize = false;
window.addEventListener(
  "resize",
  () => {
    invalidateSystemInfoCache();
    if (resizeRaf) return;
    pendingResize = true;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (!pendingResize) return;
      pendingResize = false;
      resizeSet.forEach((cb) => {
        try { cb(); } catch (e) { console.warn("[resize] listener failed", e); }
      });
    });
  },
  { passive: true }
);
// 立即响应一次 orientationchange（移动端旋转）
window.addEventListener(
  "orientationchange",
  () => {
    invalidateSystemInfoCache();
    resizeSet.forEach((cb) => {
      try { cb(); } catch (e) { console.warn("[orientation] listener failed", e); }
    });
  },
  { passive: true }
);

export function onResize(cb: ResizeListener): void {
  resizeSet.add(cb);
}
export function offResize(cb: ResizeListener): void {
  resizeSet.delete(cb);
}

// ============ 存储 ============

export function getStorageSync(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStorageSync(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[storage] setItem failed", e);
  }
}

export function removeStorageSync(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// ============ 音频 ============

export function createAudioContext(): AudioContext | null {
  const g = globalThis as any;
  if (typeof g.AudioContext !== "undefined") {
    try { return new g.AudioContext(); } catch {}
  }
  if (typeof g.webkitAudioContext !== "undefined") {
    try { return new g.webkitAudioContext(); } catch {}
  }
  return null;
}

// ============ 字体 ============

export function loadFont(faceName: string, src: string, _size = 0): boolean {
  try {
    if (typeof FontFace === "undefined") return false;
    const ff = new FontFace(faceName, `url("${src}")`);
    ff.load().then(
      () => {
        (document as any).fonts.add(ff);
      },
      (e) => console.warn(`[font] ${faceName} load failed`, e)
    );
    return true;
  } catch {
    return false;
  }
}

const FONT_GOOGLE: Record<string, string> = {
  "ZCOOL KuaiLe": "https://fonts.gstatic.com/s/zcoolkuaile/v17/tssqApdaRQokwFjF4jLEdOvLJPm4LeM.ttf",
  "Noto Sans SC": "https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJFpOww.woff2",
  "JetBrains Mono": "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zrCj2CPhz4.woff2",
};

export function initFonts(): void {
  for (const [face, url] of Object.entries(FONT_GOOGLE)) {
    loadFont(face, url);
  }
}

// ============ 分享 ============

export function shareAppMessage(opts: { title: string; imageUrl?: string }): void {
  const nav = navigator as any;
  if (typeof nav.share === "function") {
    nav.share({ title: opts.title, url: window.location.href }).catch(() => {});
  } else if (nav.clipboard?.writeText) {
    nav.clipboard.writeText(`${opts.title} ${window.location.href}`).catch(() => {});
  }
}

export function onShareAppMessage(_cb: () => { title: string; imageUrl?: string }): void {
  // Web 上无对应能力，noop
}

/**
 * 将 canvas 转 Blob（用于战报图分享/下载）
 */
export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * 通过创建 <a download> 触发文件下载
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放，避免下载未完成
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * 分享带图片（Web Share API + files）
 * 若浏览器不支持文件分享，回退到下载
 */
export async function shareImageWithFallback(opts: {
  title: string;
  text: string;
  blob: Blob;
  filename: string;
}): Promise<"shared" | "downloaded" | "copied"> {
  const nav = navigator as any;
  const file = new File([opts.blob], opts.filename, { type: opts.blob.type });
  // 优先尝试 Web Share API + 文件
  if (typeof nav.canShare === "function" && nav.canShare({ files: [file] }) && typeof nav.share === "function") {
    try {
      await nav.share({ title: opts.title, text: opts.text, files: [file] });
      return "shared";
    } catch {
      // 用户取消或失败，回退到下载
    }
  }
  // 回退 1：下载图片
  try {
    downloadBlob(opts.blob, opts.filename);
    return "downloaded";
  } catch {
    // 回退 2：复制文本
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(`${opts.title}\n${opts.text}`);
      return "copied";
    }
  }
  return "downloaded";
}

// ============ 振动 ============

export function vibrateShort(): void {
  try { navigator.vibrate?.(15); } catch {}
}

export function vibrateLong(): void {
  try { navigator.vibrate?.(200); } catch {}
}

// ============ 模态弹窗 ============

export function showModal(opts: {
  title: string;
  content: string;
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
}): Promise<{ confirm: boolean; cancel: boolean }> {
  return new Promise((resolve) => {
    const msg = `${opts.title}\n\n${opts.content}`;
    const ok = window.confirm(msg);
    resolve({ confirm: ok, cancel: !ok });
  });
}

// ============ 横竖屏 ============

export function setOrientation(_orientation: "portrait" | "landscape"): void {
  // Web 上 noop；桌面横屏铺满方案下不强制旋转
}

// ============ 生命周期 ============

type VisibilityListener = () => void;
const hideSet = new Set<VisibilityListener>();
const showSet = new Set<VisibilityListener>();
document.addEventListener(
  "visibilitychange",
  () => {
    if (document.visibilityState === "hidden") {
      hideSet.forEach((cb) => { try { cb(); } catch (e) { console.warn("[hide] listener failed", e); } });
    } else if (document.visibilityState === "visible") {
      showSet.forEach((cb) => { try { cb(); } catch (e) { console.warn("[show] listener failed", e); } });
    }
  },
  { passive: true }
);

export function onHide(cb: () => void): void {
  hideSet.add(cb);
}
export function offHide(cb: () => void): void {
  hideSet.delete(cb);
}
export function onShow(cb: () => void): void {
  showSet.add(cb);
}
export function offShow(cb: () => void): void {
  showSet.delete(cb);
}

// ============ 日志 ============

export function log(...args: unknown[]): void {
  console.log(...args);
}

export function warn(...args: unknown[]): void {
  console.warn(...args);
}

export function error(...args: unknown[]): void {
  console.error(...args);
}

// ============ 退出 ============

export function exitMiniProgram(): void {
  console.log("[exitMiniProgram] Web 上无法退出，请直接关闭标签页");
}

// ============ 键盘 ============

export type KeyListener = (key: string, e: KeyboardEvent) => void;
const keyDownSet = new Set<KeyListener>();
window.addEventListener("keydown", (e) => {
  keyDownSet.forEach((cb) => cb(e.key, e));
});

export function onKeyDown(cb: KeyListener): void {
  keyDownSet.add(cb);
}
export function offKeyDown(cb: KeyListener): void {
  keyDownSet.delete(cb);
}
