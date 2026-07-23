/**
 * Web 主入口
 */
import { initFonts } from "@/platform/web";
import { platformStore } from "@/store/platformStore";
import { setMuted } from "@/engine/Audio";
import { SceneDirector } from "@/ui/SceneDirector";
import { BootScene } from "@/scenes/BootScene";

/**
 * 启动失败兜底：在画布上显示错误提示，避免白屏无反馈
 * 不依赖 #loading 是否仍存在（createCanvas 可能已移除它）
 */
function showFatalError(err: unknown): void {
  console.error("[boot] fatal error", err);
  try {
    if (typeof document === "undefined") return;
    let el = document.getElementById("boot-error");
    if (!el) {
      el = document.createElement("div");
      el.id = "boot-error";
      el.style.cssText =
        "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        "background:#0A1929;color:#FF5A60;font-family:sans-serif;font-size:14px;text-align:center;padding:24px;z-index:9999;";
      document.body.appendChild(el);
    }
    el.innerHTML =
      "<div style='font-size:18px;font-weight:700;margin-bottom:8px'>反诈街机启动失败</div>" +
      "<div style='color:#8FA6C7'>请刷新页面重试，若反复出现可清理浏览器缓存。</div>";
  } catch {
    /* noop */
  }
}

try {
  initFonts();
  platformStore.load();
  setMuted(!platformStore.state.settings.sound);

  const director = new SceneDirector();
  director.replace(new BootScene(director), undefined, "none");
  director.start();
} catch (err) {
  showFatalError(err);
}
