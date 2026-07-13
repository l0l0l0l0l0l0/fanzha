/**
 * 抖音小游戏主入口
 */
import { initFonts } from "@/platform/web";
import { platformStore } from "@/store/platformStore";
import { setMuted } from "@/engine/Audio";
import { SceneDirector } from "@/ui/SceneDirector";
import { HubScene } from "@/scenes/HubScene";

initFonts();
platformStore.load();
setMuted(!platformStore.state.settings.sound);

const director = new SceneDirector();
director.replace(new HubScene(director));
director.start();
