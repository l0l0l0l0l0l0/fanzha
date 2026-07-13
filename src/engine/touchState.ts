/**
 * 共享触摸状态：被场景按钮消费的触摸 ID
 * SceneDirector 写入，InputManager 读取并跳过这些触摸
 * 解决 Scene 按钮 vs 引擎拖拽的触摸冲突
 */
export const consumedTouchIds = new Set<number>();
