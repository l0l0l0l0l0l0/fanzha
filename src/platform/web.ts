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
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
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
window.addEventListener("resize", () => {
  invalidateSystemInfoCache();
  resizeSet.forEach((cb) => cb());
});

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

export function onHide(cb: () => void): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") cb();
  });
}

export function onShow(cb: () => void): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") cb();
  });
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
