/**
 * v9 扩展系统 · 系统文档 + 依赖契约
 *
 * v9「全面升级」引入了五大子系统，本文件集中管理其文档与依赖契约。
 * 与 v8 不同，v9 没有模块级数据表或渲染常量需要抽取（所有 v9 逻辑均为
 * 类方法，访问 private 字段）。因此本文件仅提供文档和未来抽取的参考接口。
 *
 * v9 系统包含：
 *
 * 1. 敌人 AI 行为树（Enemy AI Behavior Tree）
 *    - 6 种行为：disguise（伪装·无法被攻击）、rush（狂奔加速）、
 *      flank（绕侧偏移）、teleport（瞬移）、split（分裂）、enrage（狂暴）
 *    - 2 种光环：fearAura（恐惧·探员射速 -30%）、healAura（治愈·附近敌人回血）
 *    - 触发条件：敌人 def.aiBehavior（trigger.belowHpRatio + cooldown）
 *    - 运行时字段：_v9DisguiseUntil / _v9AiCooldownUntil / _v9ActiveKind /
 *      _v9RushUntil / _v9RushMul / _v9FlankOffset / _v9FlankUntil /
 *      _v9EnrageDmgMul / _v9SplitDone（定义在 Enemy 接口）
 *
 * 2. 探员羁绊（Agent Bonds）
 *    - 检测双方均部署的羁绊对，激活后随累计击杀升级（Lv1→Lv3）
 *    - 7 种羁绊效果：attackUp / firerateUp / rangeUp / critUp /
 *      ultChargeUp / comboBoost / healLink / shieldLink / elementLink
 *    - 运行时：bondStates / bondAppliedBuffs（每探员 buff 快照）
 *    - 钩子点：击杀时推进进度、造成伤害时 healLink、受击时 shieldLink、
 *      元素反应时 elementLink、连击时 comboBoost
 *
 * 3. 遗物商店 + 合成系统（Relic Shop & Crafting）
 *    - 每 5 波触发一次战间遗物商店（3 选 1，消耗分数购买）
 *    - pendingRelicShopOffers / relicShopWaveTrigger
 *    - 购买后即时应用遗物效果
 *
 * 4. 案例分支式调查（Branch Investigation）
 *    - 击破 BOSS 后触发（与五步复盘并存，调查优先展示）
 *    - 5 阶段分支选择，累计证据/损失，S/A/B/C/D 评级
 *    - pendingInvestigation: InvestigationState | null
 *
 * 5. 适老模式（Senior Mode）
 *    - 简化 HUD、放大字体、降低敌人速度、禁用复杂系统
 *    - 通过 mode === "senior" 判断，在各 update/render 分支中条件化处理
 *
 * 系统事件通知（v10 新增）：
 * - v9 的 AI 行为、羁绊激活等事件通过 pushSystemEvent() 通知 HUD
 * - recentSystemEvents 队列最多保留 3 条，以 toast 形式展示
 */

import type {
  AgentBond,
  BondRuntimeState,
  BondEffectKind,
  EnemyAIBehaviorKind,
  RelicShopOffer,
  InvestigationState,
  CaseInvestigation,
} from "./types";

// ====================================================================
// v9 系统状态接口（文档用途 —— 标注 v9 方法在 ManagerEngine 上的依赖）
// ====================================================================

/**
 * v9 系统依赖契约（文档用，非运行时约束）。
 * 标注 v9 方法需要访问的 ManagerEngine 字段/方法，为未来完整抽取提供参考。
 * @internal
 */
export interface V9EngineAccess {
  // v9 专属状态（如未来抽取，这些字段应迁移到 V9Systems 类）
  bondStates: BondRuntimeState[];
  bondAppliedBuffs: unknown[]; // BondBuffSnapshot[] — 定义在 engine.ts 内部
  pendingRelicShopOffers: RelicShopOffer[];
  relicShopWaveTrigger: number;
  pendingInvestigation: InvestigationState | null;
  lastEnemyAIEvent: string | null;

  // 敌人 AI 行为树运行时字段（定义在 Enemy 接口的 _v9* 前缀字段）
  // — 通过 this.enemies[i]._v9Xxx 访问，无需在此声明

  // 引擎核心字段（v9 方法读写）
  readonly t: number;
  readonly score: number;
  readonly energy: number;
  readonly over: boolean;
  readonly mode: string;
  readonly level: number;
  readonly wave: number;

  // 核心方法
  emitHud(): void;
  pushSystemEvent(ev: { emoji: string; title: string; color: string; ttl: number }): void;
}

// ====================================================================
// v9 AI 行为树文档
// ====================================================================

/**
 * 敌人 AI 行为种类（与 types.ts 中 EnemyAIBehaviorKind 对应）。
 *
 * 行为优先级（从高到低）：
 * 1. split —— 分裂（死亡时触发，优先于 v6 ability）
 * 2. enrage —— 狂暴（低血量时触发，加速 + 伤害倍率）
 * 3. disguise —— 伪装（无法被攻击，减速，冷却后切换）
 * 4. rush —— 狂奔（加速冲向出口，波及附近同类）
 * 5. flank —— 绕侧（偏移 y 目标，模拟绕路到侧翼）
 * 6. teleport —— 瞬移（随机传送到路径中段）
 *
 * 光环类（持续生效，非触发式）：
 * - fearAura —— 恐惧光环（附近探员射速 -30%）
 * - healAura —— 治愈光环（附近敌人每秒回血）
 */
export const AI_BEHAVIOR_KINDS: readonly EnemyAIBehaviorKind[] = [
  "disguise", "rush", "flank", "teleport", "split", "enrage",
];

/**
 * 羁绊效果种类（与 types.ts 中 BondEffectKind 对应）。
 *
 * 效果说明：
 * - attackUp: 攻击力 +X%
 * - firerateUp: 射速 +X%
 * - rangeUp: 射程 +X%
 * - critUp: 暴击率 +X%
 * - ultChargeUp: 大招充能 +X%
 * - comboBoost: 连击倍率额外加成
 * - healLink: 造成伤害时为羁绊搭档回血
 * - shieldLink: 受击时为羁绊搭档叠加护盾
 * - elementLink: 元素反应触发时附加额外范围伤害
 */
export const BOND_EFFECT_KINDS: readonly BondEffectKind[] = [
  "attackUp", "firerateUp", "rangeUp", "critUp",
  "ultChargeUp", "comboBoost", "healLink", "shieldLink", "elementLink",
];

/**
 * 调查评级阈值（S/A/B/C/D）。
 * 累计证据值达到对应阈值即可获得该评级。
 */
export const INVESTIGATION_RANK_THRESHOLDS: Readonly<Record<string, number>> = {
  S: 90,
  A: 75,
  B: 60,
  C: 40,
  D: 0,
};

/**
 * 遗物商店触发间隔（每 N 波触发一次）。
 */
export const RELIC_SHOP_WAVE_INTERVAL = 5;

/**
 * 适老模式敌人速度倍率（降低敌人速度以适配老年玩家）。
 */
export const SENIOR_ENEMY_SPEED_MUL = 0.7;

/**
 * 适老模式 HUD 字体放大倍率。
 */
export const SENIOR_FONT_SCALE = 1.25;
