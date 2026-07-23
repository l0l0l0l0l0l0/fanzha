/**
 * 诈园区引擎（bomb-island）
 * 纯无尽爽打：反诈意大利炮不可被伤害 · BOSS 反击改为 debuff · 多管齐射 + hit-stop + 拆楼分阶段崩塌
 * 左侧列：进度面板 + 9 道具栏（CD + 全局刷新 + 过载连击槽）
 */
import { GameEngine } from "@/engine/GameEngine";
import { ParticleSystem } from "@/engine/Particle";
import { postFX } from "@/engine/PostFX";
import { playSfx, startBGM, stopBGM } from "@/engine/Audio";
import { InputManager } from "@/engine/Input";
import { vibrateShort } from "@/platform/web";
import { clamp, drawText } from "@/engine/Renderer";
import { Theme } from "@/ui/Theme";
import type { GameEvent, GameResultPayload } from "@/types";
import {
  ITEMS, ITEM_ORDER, getTierForWave, getBossForWave, moduleHpBaseForWave, repairForWave,
  CD_REFRESH_PCT, OVERDRIVE_MAX, OVERDRIVE_DECAY, OVERDRIVE_DURATION,
  OVERDRIVE_FIRE_MULT, OVERDRIVE_MULTISHOT_BONUS, BASE_FIRE_INTERVAL,
  SHELL_OVERDRIVE_GAIN, K_ESCAPE,
  weaponFireInterval, weaponDamageAbs, CANNON_MAX_HP, WEAPON_MAX_LEVEL,
  WEATHERS, pickWeather, resetWeather,
  WEAPONS, WEAPON_ORDER, SPECIAL_WEAPON_START_AMMO,
  CLUSTER_SUB_COUNT, CLUSTER_SUB_OFFSET, CLUSTER_MAIN_DMG, CLUSTER_SUB_DMG,
  EMP_SLOW_DURATION, EMP_REPAIR_MUL, EMP_COUNTER_MUL, EMP_DMG_ABS,
  INCENDIARY_ZONE_DURATION, INCENDIARY_ZONE_DPS, INCENDIARY_DMG_ABS,
  MODULE_HP_LARGE, MODULE_HP_MEDIUM_MUL, MODULE_HP_SMALL_MUL,
  TREE_MAX_HP, TREE_RADIUS, TREE_DMG_PER_SHELL, TREE_DMG_PER_COUNTER,
  MAP_LAYOUTS, MAP_CYCLE, MAP_TRANSITION_DURATION, getMapForWave,
  multishotCount, PATTERN_DEBUFF, DEBUFF_NAMES, DEBUFF_EMOJIS, WEAPON_JAM_FIRE_MUL,
} from "./data";
import type {
  ItemId, ParkTierDef, ParkHud, ItemState, BombBossDef, WeatherDef,
  WeaponKind, WeaponState, TreeDef, MapLayoutDef,
  CounterDebuff, CounterShell,
} from "./types";
import type { GameCanvas } from "@/platform/web";

/** shade() 纯函数结果缓存：key = `${hex}|${factor}`，避免热循环重复 parseInt/toString */
const _shadeCache = new Map<string, string>();

const W = 960;
const H = 540;
const ACCENT = "#FF7A1A";

const GROUND_Y = 474;
const CANNON_X = 300;
const CANNON_Y = 432;
const GRAVITY = 560;

/** 同屏最大炮弹数（性能保护：多管齐射粒子数控制） */
const MAX_SHELLS = 50;

// 园区综合体（单一目标建筑）
const PARK_CX = 740;
const PARK_BASE_Y = 474;
const PARK_W = 210;
const PARK_H = 158;
const PARK_LEFT = PARK_CX - PARK_W / 2;
const PARK_RIGHT = PARK_CX + PARK_W / 2;
const PARK_TOP = PARK_BASE_Y - PARK_H;

// 左侧列 UI
const COL_X = 10;
const COL_W = 188;
const COL_TOP = 78;
const PANEL_BOTTOM = 192;
const SLOT_X = COL_X + 6;
const SLOT_W = COL_W - 12;
const SLOT_H = 31;
const SLOT_GAP = 3;
const BAR_TOP = 198;

interface Shell {
  x: number; y: number; vx: number; vy: number; life: number;
  trail: { x: number; y: number }[];
  /** 该炮弹使用的武器类型（决定爆破效果） */
  weapon: WeaponKind;
}
/** 反击预警标记（落地前的警告圈） */
interface CounterWarn {
  x: number; y: number; landT: number; r: number; color: string;
}
/** 延迟发射的反击弹（到时间点才生成实际 CounterShell） */
interface PendingCounter {
  at: number;
  debuff: CounterDebuff;
  duration: number;
}
interface DotEffect {
  until: number; dps: number; kind: "fireRain" | "burnZone" | "drone";
  x: number; y: number; r: number; startT: number;
}
interface Strike {
  landT: number; x: number; dmg: number; color: string; kind: "meteor" | "arrow"; startY: number;
}
interface Beam {
  until: number; color: string; kind: "laser" | "swords" | "blast" | "homing";
  x: number; y: number; r: number;
}
interface FloatText {
  x: number; y: number; text: string; color: string; life: number; maxLife: number;
  /** 字号（默认 16，关键命中可放大） */
  size?: number;
}

/** 园区建筑模块：每模块独立 HP，被炮击至 0 时拆除为废墟（不可再被攻击） */
interface BuildingModule {
  id: string;
  name: string;
  /** 模块在画布坐标的绝对位置与尺寸 */
  x: number; y: number; w: number; h: number;
  /** 3D 挤出深度 */
  depth: number;
  /** 主题色 */
  color: string;
  /** 模块类型：决定特殊渲染（信号塔/电诈工位/电击室/铁笼/小黑屋/白家武装/苦工宿舍/装甲碉堡/铁丝网/地基） */
  type: "antenna" | "floor" | "server" | "dorm" | "fortress" | "wall" | "foundation" | "shock" | "cage" | "cell" | "guard";
  /** 运行时：是否已被拆除 */
  demolished: boolean;
  /** 拆除动画进度 0→1（0=刚拆除，1=废墟稳定） */
  demolishAnim: number;
  /** 当前 HP（绝对值） */
  hp: number;
  /** 最大 HP（绝对值） */
  maxHp: number;
  /** 受击闪烁计时（>0 时白闪） */
  hitFlash: number;
}

/** 按 debuff 取对应警示色 */
const DEBUFF_WARN_COLORS: Record<CounterDebuff, string> = {
  cdLock: "#FFB020",
  weaponJam: "#FF5A2A",
  itemDisable: "#E5353B",
  visionJam: "#B388FF",
};

export class BombIslandEngine extends GameEngine {
  private particles = new ParticleSystem();
  private input: InputManager;
  private t = 0;
  private wave = 1;
  private tier: ParkTierDef = getTierForWave(1);
  /** 园区总 HP（所有模块 HP 之和，用于 HUD 显示与波次清空判定） */
  private maxHp = 0;
  private hp = 0;
  private repair = repairForWave(1);
  private escape = 0;
  private overdrive = 0;
  private overdriveActive = false;
  private overdriveLeft = 0;
  private overdriveIdle = 0;
  private combo = 0;
  private comboTimer = 0;
  private score = 0;
  private cdLeft: Record<ItemId, number> = {
    bomb: 0, missile: 0, fireRain: 0, incendiary: 0, drone: 0,
    laser: 0, meteor: 0, arrowRain: 0, swords: 0,
  };
  private shells: Shell[] = [];
  private counterShells: CounterShell[] = [];
  private counterWarns: CounterWarn[] = [];
  private pendingCounters: PendingCounter[] = [];
  private dots: DotEffect[] = [];
  private strikes: Strike[] = [];
  private beams: Beam[] = [];
  private floats: FloatText[] = [];
  private phase: "fight" | "clearing" | "lost" = "fight";
  private result: GameResultPayload | null = null;
  private fireTimer = 0.6;
  private shakeUntil = 0;
  private damageThisFrame = 0;
  private cannonRecoil = 0;
  private muzzleUntil = 0;
  private parkFlashUntil = 0;
  private collapseT = 0;
  private rebuildT = 0;
  private toast: { text: string; tone: "good" | "bad" | "info"; until: number } | null = null;
  /** 当前波次 BOSS 定义 */
  private bossDef: BombBossDef = getBossForWave(1);
  /** BOSS 是否已狂暴 */
  private bossEnraged = false;
  /** BOSS 反击计时器 */
  private counterTimer = 0;
  /** 反击预警倒计时（>0 显示警告） */
  private counterWarnLeft = 0;
  /** HUD 复用缓冲：预分配 items/weapons 数组，避免每帧 map 分配 */
  private _hudItems: ItemState[] = ITEM_ORDER.map((id) => ({ id, cdLeft: 0, cd: ITEMS[id].cd }));
  private _hudWeapons: WeaponState[] = WEAPON_ORDER.map((k) => ({
    id: k, name: WEAPONS[k].name, emoji: WEAPONS[k].emoji, color: WEAPONS[k].color,
    ammo: 0, maxAmmo: WEAPONS[k].maxAmmo,
  }));
  /** 渐变缓存：天空（按天气 key）/ 地面（固定），避免每帧 createLinearGradient */
  private _gradSky: CanvasGradient | null = null;
  private _gradSkyKey = "";
  private _gradGround: CanvasGradient | null = null;
  /** 武器等级 */
  private weaponLevel = 1;
  /** 天气系统：当前天气定义 */
  private weather: WeatherDef = WEATHERS.sunny;
  /** 天气粒子动画累积时间（用于雨/雾等渲染） */
  private weatherT = 0;
  /** 雷暴下次闪光时间 */
  private nextThunderFlash = 0;

  // ============ debuff 系统（BOSS 反击命中后触发，不伤害炮兵） ============
  /** 道具 CD 锁定结束时间（>this.t 道具 CD 不刷新） */
  private cdLockUntil = 0;
  /** 武器干扰结束时间（>this.t 武器射速降为 WEAPON_JAM_FIRE_MUL） */
  private weaponJamUntil = 0;
  /** 道具失效结束时间（>this.t 随机道具不可用） */
  private itemDisableUntil = 0;
  /** 视觉干扰结束时间（>this.t 屏幕扭曲） */
  private visionJamUntil = 0;
  /** 当前失效的道具 id（itemDisable 期间） */
  private disabledItem: ItemId | null = null;

  // ============ hit-stop 慢镜头 ============
  /** hit-stop 剩余秒数（>0 时仅推进 particles 与本身衰减，其他逻辑跳过） */
  private hitStopRemain = 0;

  // ============ 伤害 / DPS 统计 ============
  /** 本波累计伤害 */
  private waveDamage = 0;
  /** 全局累计伤害 */
  private totalDamage = 0;
  /** 实时 DPS（基于 1 秒滑动窗口） */
  private dps = 0;
  /** 最高 DPS 峰值 */
  private maxDps = 0;
  /** DPS 滑动窗口样本（最近 1 秒伤害事件） */
  private dpsWindow: { t: number; dmg: number }[] = [];
  /** DPS 窗口头部索引（避免每帧 shift 的 O(n) 移位） */
  private dpsHead = 0;
  /** 最高连击纪录 */
  private maxCombo = 0;
  /** 已击破波数 */
  private clearedWaves = 0;

  // ============ 武器系统 ============
  /** 当前选中的武器 */
  private weapon: WeaponKind = "standard";
  /** 各武器剩余弹药（-1 = 无限） */
  private weaponAmmo: Record<WeaponKind, number> = {
    standard: -1,
    cluster: SPECIAL_WEAPON_START_AMMO,
    emp: SPECIAL_WEAPON_START_AMMO,
    incendiary: SPECIAL_WEAPON_START_AMMO,
  };
  /** EMP 减速结束时间（>this.t 表示敌人被减速） */
  private empUntil = 0;

  // ============ 公园地图系统 ============
  /** 当前地图布局 */
  private currentMap: MapLayoutDef = getMapForWave(1);
  /** 树木列表 */
  private trees: TreeDef[] = [];
  /** 地图切换动画倒计时（>0 表示正在切换） */
  private mapTransitionT = 0;

  // ============ 模块化建筑系统 ============
  /** 当前园区的建筑模块列表 */
  private modules: BuildingModule[] = [];
  /** 模块连拆计数（连续拆除模块的连击数，2秒内继续拆除则累加） */
  private moduleCombo = 0;
  /** 模块连拆计时器（>0 时保持连击，归零则重置） */
  private moduleComboTimer = 0;

  constructor(canvas: GameCanvas) {
    super(canvas);
    canvas.width = W;
    canvas.height = H;
    resetWeather(); // 重置全局天气状态（retry 时确保从新天气开始）
    this.startWave(1, true);
    startBGM("tense"); // 紧张氛围 BGM
    this.input = new InputManager(canvas);
    this.input.attach(this);
    this.input.setHandlers({ onClick: (x, y) => this.handleTap(x, y) });
    this.addDestroy(() => this.input.destroy());
    this.addDestroy(() => stopBGM()); // 引擎销毁时停止 BGM
  }

  // ============ 波次 ============

  private startWave(wave: number, initial = false): void {
    this.wave = wave;
    this.tier = getTierForWave(wave);
    this.bossDef = getBossForWave(wave);
    this.bossEnraged = false;
    this.repair = repairForWave(wave);
    this.escape = 0;
    this.phase = "fight";
    this.fireTimer = 0.5;
    this.counterTimer = this.bossDef.counterInterval; // 第一波给点缓冲
    this.counterWarnLeft = 0;
    this.shells.length = 0;
    this.counterShells.length = 0;
    this.counterWarns.length = 0;
    this.pendingCounters.length = 0;
    this.dots.length = 0;
    this.strikes.length = 0;
    this.beams.length = 0;
    this.collapseT = 0;
    this.rebuildT = 0;
    // 天气系统：每波根据 wave 选天气（pickWeather 内部保证 phase 内固定）
    const prevWeather = this.weather;
    this.weather = pickWeather(wave);
    if (!initial && prevWeather.id !== this.weather.id) {
      this.nextThunderFlash = this.t + 0.5 + Math.random() * 2;
    }
    // 公园地图系统：每 MAP_CYCLE 波切换地图
    const newMap = getMapForWave(wave);
    const mapChanged = !initial && newMap.id !== this.currentMap.id;
    this.currentMap = newMap;
    if (initial || mapChanged) {
      this.initTrees();
      if (mapChanged) {
        this.mapTransitionT = MAP_TRANSITION_DURATION;
        this.particles.spawnText((COL_X + COL_W + W) / 2, 120, `${newMap.emoji} ${newMap.name}`, "#52C41A", { size: 18, life: 1.5 });
        postFX.flash("#52C41A", 0.3, 3);
        playSfx("phase");
      }
    }
    // 构建模块化建筑（每模块独立 HP）
    this.buildModules();
    // 总 HP = 所有模块 HP 之和
    this.maxHp = this.modules.reduce((s, m) => s + m.maxHp, 0);
    this.hp = this.maxHp;
    const tip = initial
      ? `${this.bossDef.bossName}·${this.tier.name} 园区已锁定 · 武器 LV${this.weaponLevel} · ${this.weather.emoji}${this.weather.name}`
      : `波次 ${wave}：${this.bossDef.bossName} 出现！${this.weather.emoji}${this.weather.name} · ${this.weather.desc}`;
    this.toast = { text: tip, tone: "info", until: this.t + 3.5 };
    if (!initial) {
      postFX.flash(this.tier.color, 0.3, 3);
    }
  }

  /** 根据当前地图布局初始化树木 */
  private initTrees(): void {
    this.trees = this.currentMap.trees.map((p) => ({
      x: p.x, y: p.y, hp: TREE_MAX_HP, maxHp: TREE_MAX_HP, alive: true, shake: 0,
    }));
  }

  /**
   * 构建模块化电诈园区：由电诈特色组件组成（信号塔/电诈工位/铁笼/小黑屋/电击室/白家武装/苦工宿舍/装甲碉堡/铁丝网/地基）。
   * v2：每模块独立 HP（绝对值），被炮击至 0 时拆除为废墟（不可再被攻击）。
   * 建筑数值尽可能大：单模块 3.75w~15w HP，营造"缓慢动态拆除"爽感。
   * 自恢复不会重建已拆模块。
   */
  private buildModules(): void {
    const tierColor = this.tier.color;
    const depth = 16;
    const ms: BuildingModule[] = [];

    // 主楼尺寸与位置
    const mainW = 84, mainH = 108;
    const mainX = PARK_CX - mainW / 2;
    const mainY = PARK_BASE_Y - mainH;

    // 模块 HP 基准值（按波次/档位递增）
    const baseHp = moduleHpBaseForWave(this.wave);
    const hpLarge = baseHp;                                  // 大型模块（铁笼/小黑屋/电击室/白家武装/装甲碉堡）
    const hpMedium = Math.round(baseHp * MODULE_HP_MEDIUM_MUL); // 中型模块（电诈工位/苦工宿舍）
    const hpSmall = Math.round(baseHp * MODULE_HP_SMALL_MUL);   // 小型模块（信号塔/铁丝网/地基）

    // HP 分配辅助：按类型取 HP
    const hpFor = (type: BuildingModule["type"]): number => {
      switch (type) {
        case "antenna":
        case "wall":
        case "foundation":
          return hpSmall;
        case "floor":
        case "dorm":
          return hpMedium;
        default: // cage / cell / shock / guard / fortress
          return hpLarge;
      }
    };
    // 模块构造辅助：统一赋 hp/maxHp/hitFlash
    const mk = (
      id: string, name: string,
      x: number, y: number, w: number, h: number,
      depthVal: number, color: string, type: BuildingModule["type"],
    ): BuildingModule => {
      const hp = hpFor(type);
      return { id, name, x, y, w, h, depth: depthVal, color, type, demolished: false, demolishAnim: 0, hp, maxHp: hp, hitFlash: 0 };
    };

    // ---- 信号塔（最顶，小型）----
    ms.push(mk("antenna", "信号塔", PARK_CX - 2, mainY - 30, 4, 30, 0, "#3A4A5A", "antenna"));

    // ---- 电诈工位楼层（高阶档位楼层更多，位于主楼顶部，中型）----
    const floors = this.tier.structure === "den" ? 0 : this.tier.structure === "kokang" ? 1 : 2;
    const themedH = 96; // 3 个电诈特色模块占据的主楼高度
    const floorZoneH = mainH - themedH; // 留给电诈工位的高度
    const floorH = floors > 0 ? floorZoneH / floors : 0;
    for (let i = 0; i < floors; i++) {
      ms.push(mk(`floor${i}`, `电诈工位 ${floors - i}F`, mainX, mainY + i * floorH, mainW, floorH, depth, tierColor, "floor"));
    }

    // ---- 三大电诈特色模块（主楼核心区，从上到下：铁笼 / 小黑屋 / 电击室，大型）----
    const zoneY = mainY + floorZoneH;
    const zoneH = themedH / 3;
    ms.push(mk("cage", "铁笼", mainX, zoneY, mainW, zoneH, depth, "#8A9AAE", "cage"));
    ms.push(mk("cell", "小黑屋", mainX, zoneY + zoneH, mainW, zoneH, depth, "#3A3A45", "cell"));
    ms.push(mk("shock", "电击室", mainX, zoneY + zoneH * 2, mainW, zoneH, depth, "#00E5FF", "shock"));

    // ---- 白家武装（右侧武装塔，大型）----
    ms.push(mk("guard", "白家武装", mainX + mainW + 6, PARK_BASE_Y - 74, 50, 74, depth, "#E5353B", "guard"));

    // ---- 苦工宿舍（左侧塔，kokang/hq 结构，分多层，中型）----
    if (this.tier.structure !== "den") {
      const dormW = 50, dormH = 116;
      const dormX = mainX - dormW - 6;
      const dormY = PARK_BASE_Y - dormH;
      const dormFloors = this.tier.structure === "hq" ? 4 : 3;
      const dormFH = dormH / dormFloors;
      for (let i = 0; i < dormFloors; i++) {
        ms.push(mk(`dorm${i}`, `苦工宿舍 ${dormFloors - i}F`, dormX, dormY + i * dormFH, dormW, dormFH, depth, "#FFB020", "dorm"));
      }
    }

    // ---- 装甲碉堡外壳（hq 结构，大型）----
    if (this.tier.structure === "hq") {
      ms.push(mk("fortress", "装甲碉堡", mainX - 4, mainY - 4, mainW + 8, mainH + 8, depth, "#B388FF", "fortress"));
    }

    // ---- 铁丝网（左右两侧围墙，小型）----
    ms.push(mk("wallL", "铁丝网·左", PARK_LEFT - 6, PARK_BASE_Y - 8, 34, 8, 0, tierColor, "wall"));
    ms.push(mk("wallR", "铁丝网·右", PARK_RIGHT - 28, PARK_BASE_Y - 8, 34, 8, 0, tierColor, "wall"));

    // ---- 地基（最后拆除，小型）----
    ms.push(mk("foundation", "园区地基", PARK_LEFT, PARK_BASE_Y - 4, PARK_W, 4, 0, tierColor, "foundation"));

    this.modules = ms;
    this.moduleCombo = 0;
    this.moduleComboTimer = 0;
  }

  /**
   * 拆除单个模块：触发大爆炸特效、屏幕震动、hit-stop、连击与分数奖励。
   * 自恢复不会重建已拆模块，营造"逐步拆楼"的爽感。
   * 模块 HP 归零时调用；全局 hp 自动同步（hp = 所有未拆模块 hp 之和）。
   */
  private demolishModule(m: BuildingModule): void {
    if (m.demolished) return;
    m.demolished = true;
    m.demolishAnim = 0;
    m.hp = 0;
    m.hitFlash = 0;
    // 全局 hp 同步：减去本模块剩余 hp（已为 0，但保险）
    this.hp = Math.max(0, this.hp - m.hp);
    const cx = m.x + m.w / 2;
    const cy = m.y + m.h / 2;
    const scale = Math.max(0.8, Math.min(2.2, (m.w * m.h) / 1200));

    // 爆炸粒子：环+火花+碎屑+冲击波
    this.particles.spawnBurst(cx, cy, m.color, {
      ring: true, sparks: Math.round(20 * scale), dots: Math.round(28 * scale),
      speed: 280 * scale, life: 0.9, size: 4, color2: "#FFD666",
    });
    this.particles.spawn({
      x: cx, y: cy, count: Math.round(16 * scale), speed: 220, life: 1.1,
      size: 5, color: m.color, type: "debris", gravity: 560, friction: 0.95,
    });
    this.particles.spawn({
      x: cx, y: cy, count: Math.round(10 * scale), speed: 90, life: 1.4,
      size: 8, color: "rgba(120,120,120,0.6)", type: "dot", friction: 0.93,
    });

    // 屏幕震动 + 闪光 + hit-stop 顿挫感（爽感强化）
    postFX.shake(6 + scale * 3, 10);
    postFX.flash(m.color, 0.25, 3);
    this.hitStopRemain = Math.max(this.hitStopRemain, 0.06 + scale * 0.02);

    // 连击系统：2 秒内继续拆除则累加
    this.moduleCombo += 1;
    this.moduleComboTimer = 2;
    const comboMul = 1 + (this.moduleCombo - 1) * 0.5;
    const reward = Math.round(50 * comboMul * scale);
    this.score += reward;

    // 飘字：仅显示模块名 + 奖励 + 连击（不显示伤害数字）
    this.floats.push({
      x: cx, y: cy - 10, text: `拆除 ${m.name}`, color: m.color, life: 1.2, maxLife: 1.2, size: 15,
    });
    this.floats.push({
      x: cx, y: cy + 8, text: `+${reward}${this.moduleCombo > 1 ? `  ×${this.moduleCombo} 连拆` : ""}`,
      color: "#FFD666", life: 1.1, maxLife: 1.1, size: 13,
    });

    // 音效 + 震动
    playSfx("explode");
    vibrateShort();

    // 过载槽充能（连拆越多充能越多）
    this.overdrive = Math.min(OVERDRIVE_MAX, this.overdrive + 6 + this.moduleCombo * 2);
    this.overdriveIdle = 0;
  }

  // ============ 模块目标选择与伤害（v2：绝对伤害，每击≤100） ============

  /**
   * 选择一个未拆除的模块作为炮弹目标。
   * 优先选择离给定 x 最近的未拆模块（让多管齐射分布更自然）。
   * 若全部已拆返回 null（本波即将清空）。
   */
  private pickTargetModule(preferX: number): BuildingModule | null {
    let best: BuildingModule | null = null;
    let bestDist = Infinity;
    for (const m of this.modules) {
      if (m.demolished) continue;
      const mx = m.x + m.w / 2;
      const d = Math.abs(mx - preferX);
      if (d < bestDist) { bestDist = d; best = m; }
    }
    return best;
  }

  /** 随机选择一个未拆模块（用于 DoT/箭雨等随机分布伤害） */
  private pickRandomIntactModule(): BuildingModule | null {
    const intact: BuildingModule[] = [];
    for (const m of this.modules) if (!m.demolished) intact.push(m);
    if (intact.length === 0) return null;
    return intact[Math.floor(Math.random() * intact.length)];
  }

  /** 取以 (x,y) 为中心、半径 r 内的所有未拆模块（用于 AoE 伤害） */
  private modulesInRadius(x: number, y: number, r: number): BuildingModule[] {
    const r2 = r * r;
    const out: BuildingModule[] = [];
    for (const m of this.modules) {
      if (m.demolished) continue;
      const mx = m.x + m.w / 2;
      const my = m.y + m.h / 2;
      const dx = mx - x, dy = my - y;
      if (dx * dx + dy * dy <= r2) out.push(m);
    }
    return out;
  }

  /** 取水平线 y 附近、左右覆盖整个园区宽度的未拆模块（用于激光横扫） */
  private modulesInHorizontalBand(y: number, halfH: number): BuildingModule[] {
    const out: BuildingModule[] = [];
    for (const m of this.modules) {
      if (m.demolished) continue;
      const my = m.y + m.h / 2;
      if (Math.abs(my - y) <= halfH + m.h / 2) out.push(m);
    }
    return out;
  }

  /**
   * 对单个模块造成绝对伤害（每击≤100 由调用方保证）。
   * - 不产生伤害飘字（按用户要求隐藏具体伤害数值）
   * - 触发模块 hitFlash 白闪、轻微震屏、过载充能
   * - 模块 HP 归零时调用 demolishModule
   * - 全局 hp/dps/连击统计同步更新
   */
  private damageModule(m: BuildingModule, dmg: number): void {
    if (this.phase !== "fight") return;
    if (m.demolished || dmg <= 0) return;
    const actual = Math.min(m.hp, dmg); // 不会溢出
    m.hp -= actual;
    m.hitFlash = 0.1; // 白闪 0.1s
    // 全局 hp/dps 统计同步
    this.hp = Math.max(0, this.hp - actual);
    this.damageThisFrame += actual;
    this.waveDamage += actual;
    this.totalDamage += actual;
    this.dpsWindow.push({ t: this.t, dmg: actual });
    this.parkFlashUntil = this.t + 0.08;
    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.comboTimer = 2;
    this.overdriveIdle = 0;
    // HP 归零 → 拆除
    if (m.hp <= 0) this.demolishModule(m);
  }

  /** 对半径内所有未拆模块各造成绝对伤害（AoE：每模块独立承受 ≤100） */
  private damageModulesAoE(x: number, y: number, r: number, dmgPerModule: number): void {
    const list = this.modulesInRadius(x, y, r);
    for (const m of list) this.damageModule(m, dmgPerModule);
  }

  // ============ 道具 ============

  private getItemSlotRect(i: number) {
    return { x: SLOT_X, y: BAR_TOP + i * (SLOT_H + SLOT_GAP), w: SLOT_W, h: SLOT_H };
  }

  private handleTap(x: number, y: number): void {
    if (this.phase !== "fight") return;
    // 武器切换按钮（优先级最高）
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      const r = this.getWeaponSlotRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this.switchWeapon(WEAPON_ORDER[i]);
        return;
      }
    }
    // 道具栏
    for (let i = 0; i < ITEM_ORDER.length; i++) {
      const r = this.getItemSlotRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        const id = ITEM_ORDER[i];
        // itemDisable 期间，被禁用的道具不可用
        if (this.itemDisableUntil > this.t && this.disabledItem === id) {
          this.toast = { text: `⚠ ${ITEMS[id].emoji} ${ITEMS[id].name} 已被干扰失效`, tone: "bad", until: this.t + 1.4 };
          playSfx("bad");
          this.emitHud();
          return;
        }
        if (this.cdLeft[id] <= 0) this.useItem(id);
        else playSfx("bad");
        return;
      }
    }
    // 战场空白点击：无操作（炮兵自动发射）
  }

  /** 武器按钮槽位坐标 */
  private getWeaponSlotRect(i: number) {
    const w = 41;
    const gap = 3;
    return { x: SLOT_X + i * (w + gap), y: 32, w, h: 32 };
  }

  /** 切换当前武器 */
  private switchWeapon(kind: WeaponKind): void {
    if (this.weapon === kind) return;
    this.weapon = kind;
    const def = WEAPONS[kind];
    const ammo = kind === "standard" ? -1 : this.weaponAmmo[kind];
    const ammoText = ammo === -1 ? "∞" : `${ammo}`;
    // 飘字通知
    this.particles.spawnText(CANNON_X, CANNON_Y - 50, `${def.emoji} ${def.name} ${ammoText}`, def.color, { size: 12, life: 1.2 });
    playSfx("click");
    this.emitHud();
  }

  private useItem(id: ItemId): void {
    const def = ITEMS[id];
    this.cdLeft[id] = def.cd;
    // 全局刷新：其他道具剩余 CD 折减
    for (const oid of ITEM_ORDER) {
      if (oid === id) continue;
      if (this.cdLeft[oid] > 0) this.cdLeft[oid] = Math.max(0, this.cdLeft[oid] * (1 - CD_REFRESH_PCT));
    }
    // 过载充能
    this.addOverdrive(def.overdrive);
    // 连击
    this.combo += 1; this.comboTimer = 2;
    // 效果（v2：绝对伤害，每模块每击≤100；不显示伤害飘字）
    switch (def.effect) {
      case "blast": {
        // 反诈炮弹：园区中心大爆破，半径内每模块承受 100 伤害
        const bx = PARK_CX, by = PARK_TOP + PARK_H * 0.4;
        this.damageModulesAoE(bx, by, 90, def.damageAbs ?? 100);
        this.spawnBlast(bx, by, def.color, 1.4);
        this.beams.push({ until: this.t + 0.35, color: def.color, kind: "blast", x: bx, y: by, r: 90 });
        postFX.flash(def.color, 0.35, 3); postFX.shake(9, 14);
        this.hitStopRemain = Math.max(this.hitStopRemain, 0.08);
        playSfx("explode");
        break;
      }
      case "homing": {
        // 96110 震慑：制导打击最近未拆模块，100 伤害
        const target = this.pickTargetModule(PARK_CX);
        if (target) {
          const tx = target.x + target.w / 2, ty = target.y + target.h / 2;
          this.damageModule(target, def.damageAbs ?? 100);
          this.beams.push({ until: this.t + 0.45, color: def.color, kind: "homing", x: tx, y: ty, r: 60 });
          this.spawnBurst(tx, ty, def.color, 1);
        }
        postFX.shake(6, 12);
        this.hitStopRemain = Math.max(this.hitStopRemain, 0.06);
        playSfx("explode");
        break;
      }
      case "fireRain":
        // 警方突击：3 秒火雨 DoT，覆盖园区上半部，每秒每模块 100
        this.dots.push({ until: this.t + (def.duration ?? 3), dps: def.dpsAbs ?? 100, kind: "fireRain", x: PARK_CX, y: PARK_TOP, r: PARK_W * 0.6, startT: this.t });
        playSfx("shoot");
        break;
      case "burnZone":
        // 银行止付：4 秒燃烧区 DoT，每秒每模块 100
        this.dots.push({ until: this.t + (def.duration ?? 4), dps: def.dpsAbs ?? 100, kind: "burnZone", x: PARK_CX, y: PARK_BASE_Y - 10, r: 70, startT: this.t });
        playSfx("explode");
        break;
      case "drone":
        // 反诈无人机：5 秒扫射 DoT，每秒对随机未拆模块 80
        this.dots.push({ until: this.t + (def.duration ?? 5), dps: def.dpsAbs ?? 80, kind: "drone", x: PARK_CX, y: PARK_TOP - 70, r: 0, startT: this.t });
        playSfx("shoot");
        break;
      case "laser": {
        // 反诈 APP 光束：横扫园区中部，水平带内每模块 100
        const ly = PARK_TOP + PARK_H * 0.4;
        const list = this.modulesInHorizontalBand(ly, 12);
        for (const m of list) this.damageModule(m, def.damageAbs ?? 100);
        this.beams.push({ until: this.t + 0.4, color: def.color, kind: "laser", x: PARK_CX, y: ly, r: 0 });
        postFX.flash(def.color, 0.3, 3);
        this.hitStopRemain = Math.max(this.hitStopRemain, 0.06);
        playSfx("shoot");
        break;
      }
      case "meteor": {
        // 法律铁锤：5 次重锤连坠，每次对落点附近模块 100
        const n = 5;
        for (let i = 0; i < n; i++) {
          const mx = PARK_LEFT + (i + 0.5) * (PARK_W / n) + (Math.random() - 0.5) * 20;
          this.strikes.push({ landT: this.t + 0.3 + i * 0.35, x: mx, dmg: def.damageAbs ?? 100, color: def.color, kind: "meteor", startY: -40 });
        }
        playSfx("boss");
        break;
      }
      case "arrowRain": {
        // 网络封禁令：2 秒箭雨，每箭对落点附近模块 70（dpsAbs×duration/箭数）
        const dur = def.duration ?? 2;
        const n = 14;
        for (let i = 0; i < n; i++) {
          const ax = PARK_LEFT + Math.random() * PARK_W;
          // 每箭伤害 = (dps × 时长) / 箭数，封顶 100
          const perArrow = Math.min(100, Math.round(((def.dpsAbs ?? 70) * dur) / n));
          this.strikes.push({ landT: this.t + Math.random() * dur, x: ax, dmg: perArrow, color: def.color, kind: "arrow", startY: -30 });
        }
        playSfx("shoot");
        break;
      }
      case "swords": {
        // 全民反诈风暴：终极汇聚爆破，园区中心大半径内每模块 100
        const sx = PARK_CX, sy = PARK_TOP + PARK_H * 0.45;
        this.damageModulesAoE(sx, sy, 130, def.damageAbs ?? 100);
        this.beams.push({ until: this.t + 1.0, color: def.color, kind: "swords", x: sx, y: sy, r: 130 });
        this.spawnBurst(sx, sy, def.color, 1.6);
        postFX.flash(def.color, 0.5, 4); postFX.glitch(0.5, 2.5); postFX.shake(12, 16);
        this.hitStopRemain = Math.max(this.hitStopRemain, 0.1);
        playSfx("boss");
        break;
      }
    }
    this.score += 5 + this.combo;
    vibrateShort();
    this.emitHud();
  }

  private addOverdrive(v: number): void {
    if (this.overdriveActive) return;
    this.overdrive = clamp(this.overdrive + v, 0, OVERDRIVE_MAX);
    if (this.overdrive >= OVERDRIVE_MAX) {
      this.overdriveActive = true;
      this.overdriveLeft = OVERDRIVE_DURATION;
      this.toast = { text: "火力过载！自动炮提速", tone: "good", until: this.t + 2 };
      postFX.flash("#00E5FF", 0.3, 3);
    }
  }

  // ============ 伤害（v2：已迁移至 damageModule / damageModulesAoE） ============
  // 旧的 applyDamagePct / applyDamagePctBig / applyDamage 已移除（百分比伤害 + 飘字不再需要）
  // DPS 滑动窗口统计仍保留，由 damageModule 推送样本

  /** 每帧重算 DPS（基于 1 秒滑动窗口） */
  private updateDps(): void {
    const cutoff = this.t - 1;
    // 前进 head 索引跳过过期项，避免每帧 shift 的 O(n) 移位
    const arr = this.dpsWindow;
    let head = this.dpsHead;
    while (head < arr.length && arr[head].t < cutoff) head++;
    this.dpsHead = head;
    let sum = 0;
    for (let i = head; i < arr.length; i++) sum += arr[i].dmg;
    this.dps = sum;
    // 定期 compact：过期项累积超过一半时一次性清理，保持数组紧凑
    if (head > 16 && head * 2 > arr.length) {
      arr.splice(0, head);
      this.dpsHead = 0;
    }
    if (sum > this.maxDps) this.maxDps = sum;
  }

  private spawnBurst(x: number, y: number, color: string, scale: number): void {
    this.particles.spawnBurst(x, y, color, { ring: true, sparks: Math.round(18 * scale), dots: Math.round(22 * scale), speed: 240 * scale, life: 0.8, size: 4, color2: "#FFD666" });
    this.particles.spawn({ x, y, count: Math.round(10 * scale), speed: 160, life: 0.9, size: 4, color: "#FFD666", type: "debris", gravity: 420, friction: 0.96 });
  }
  private spawnBlast(x: number, y: number, color: string, scale: number): void {
    this.spawnBurst(x, y, color, scale);
  }

  // ============ 主循环 ============

  protected update(dt: number): void {
    this.t += dt;
    this.particles.update(dt);
    this.updateFloats(dt);
    // hit-stop 慢镜头：仅推进 particles/floats/hitStopRemain，跳过其他逻辑
    if (this.hitStopRemain > 0) {
      this.hitStopRemain = Math.max(0, this.hitStopRemain - dt);
      this.emitHud();
      return;
    }
    if (this.phase === "lost") return;

    if (this.phase === "clearing") {
      this.collapseT += dt;
      // 分阶段坍塌：持续喷发碎屑/烟尘，强度随进度先升后降
      const c = clamp(this.collapseT / 1.2, 0, 1);
      const intensity = Math.sin(c * Math.PI) * 3;
      if (Math.random() < dt * intensity) {
        this.particles.spawn({ x: PARK_CX + (Math.random() - 0.5) * PARK_W * 0.8, y: PARK_BASE_Y - 20 - Math.random() * PARK_H * 0.5, count: 4, speed: 160, life: 1.0, size: 4, color: this.tier.color, type: "debris", gravity: 500, friction: 0.96 });
      }
      if (Math.random() < dt * intensity * 1.5) {
        this.particles.spawn({ x: PARK_CX + (Math.random() - 0.5) * PARK_W, y: PARK_BASE_Y - 10, count: 3, speed: 60, life: 1.3, size: 6, color: "rgba(120,120,120,0.55)", type: "dot", friction: 0.94 });
      }
      if (this.collapseT > 1.6) this.startWave(this.wave + 1);
      this.emitHud();
      return;
    }

    // BOSS 狂暴检测
    if (!this.bossEnraged && this.hp / this.maxHp <= this.bossDef.enrageAt) {
      this.bossEnraged = true;
      this.toast = { text: `${this.bossDef.bossName} 狂暴！反击频率×${this.bossDef.enrageMul}`, tone: "bad", until: this.t + 2.5 };
      postFX.flash("#E5353B", 0.3, 3);
      postFX.shake(8, 12);
    }

    // 自动开火（按武器等级计算射速，天气影响射速；weaponJam 时降低射速）
    const jamMul = this.weaponJamUntil > this.t ? WEAPON_JAM_FIRE_MUL : 1;
    this.fireTimer -= dt * this.weather.fireRateMul * jamMul;
    if (this.fireTimer <= 0) {
      this.fireShell();
      const mult = this.overdriveActive ? OVERDRIVE_FIRE_MULT : 1;
      this.fireTimer = weaponFireInterval(this.weaponLevel) / mult;
    }

    // 炮弹
    this.updateShells(dt);

    // BOSS 反击系统（天气影响反击频率）
    this.updateBossCounter(dt);

    // 反击弹运动
    this.updateCounterShells(dt);

    // 持续 DoT
    this.updateDots(dt);

    // 延时打击（陨石/箭雨）
    this.updateStrikes();

    // 光束/特效计时（in-place compaction，避免 filter 分配新数组）
    {
      const arr = this.beams;
      let w = 0;
      for (let r = 0; r < arr.length; r++) {
        if (this.t < arr[r].until) {
          if (w !== r) arr[w] = arr[r];
          w++;
        }
      }
      arr.length = w;
    }

    // 园区自修复（v2：模块级修复，仅治愈未拆模块；废墟不可修复）
    // 总修复量按未拆模块数平均分配，每模块每秒修复 repair/numIntact
    const empRepairMul = this.t < this.empUntil ? EMP_REPAIR_MUL : 1;
    const repairTotal = this.repair * this.weather.repairMul * empRepairMul * dt;
    if (repairTotal > 0 && this.phase === "fight") {
      const intact = this.modules.filter(m => !m.demolished);
      if (intact.length > 0) {
        const perModule = repairTotal / intact.length;
        let healed = 0;
        for (const m of intact) {
          const before = m.hp;
          m.hp = Math.min(m.maxHp, m.hp + perModule);
          healed += m.hp - before;
        }
        this.hp = Math.min(this.maxHp, this.hp + healed);
      }
    }
    this.damageThisFrame = 0;

    // 模块拆除动画推进（缓慢动态拆除：demolishAnim 0→1，约 0.8 秒完成废墟下沉）
    if (this.modules.length > 0) {
      for (const m of this.modules) {
        if (m.demolished && m.demolishAnim < 1) {
          m.demolishAnim = Math.min(1, m.demolishAnim + dt * 1.25);
        }
        // hitFlash 衰减
        if (m.hitFlash > 0) m.hitFlash = Math.max(0, m.hitFlash - dt);
      }
      // 模块连拆计时器衰减
      if (this.moduleComboTimer > 0) {
        this.moduleComboTimer -= dt;
        if (this.moduleComboTimer <= 0) this.moduleCombo = 0;
      }
    }

    // 过载
    if (this.overdriveActive) {
      this.overdriveLeft -= dt;
      if (this.overdriveLeft <= 0) { this.overdriveActive = false; this.overdrive = 0; }
    } else {
      this.overdriveIdle += dt;
      if (this.overdriveIdle > 1.5) this.overdrive = Math.max(0, this.overdrive - OVERDRIVE_DECAY * dt);
    }

    // 连击衰减
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;

    // CD（天气影响道具 CD；cdLock 期间不刷新）
    if (this.cdLockUntil <= this.t) {
      for (const id of ITEM_ORDER) this.cdLeft[id] = Math.max(0, this.cdLeft[id] - dt / this.weather.cdMul);
    }

    // DPS 重算
    this.updateDps();

    // 炮兵后坐/炮口
    this.cannonRecoil = Math.max(0, this.cannonRecoil - dt * 60);

    // 园区受损烟雾/火焰（按破坏阶段）
    this.spawnParkAmbient(dt);

    // 天气动画与雷暴闪光
    this.weatherT += dt;
    if (this.weather.id === "thunder" && this.t >= this.nextThunderFlash) {
      postFX.flash("#B388FF", 0.25, 4);
      this.nextThunderFlash = this.t + 2 + Math.random() * 3;
    }
    // 树木摇晃动画衰减
    this.updateTrees(dt);
    // 地图切换动画倒计时
    if (this.mapTransitionT > 0) this.mapTransitionT = Math.max(0, this.mapTransitionT - dt);

    // 相位清空（纯无尽：无失败条件）
    if (this.hp <= 0) { this.clearPhase(); this.emitHud(); return; }

    this.emitHud();
  }

  // ============ BOSS 反击 ============

  private updateBossCounter(dt: number): void {
    this.counterWarnLeft = Math.max(0, this.counterWarnLeft - dt);
    this.counterTimer -= dt;
    if (this.counterTimer <= 0) {
      // 即将反击：先发出预警，0.7 秒后发射
      const enragedMul = this.bossEnraged ? this.bossDef.enrageMul : 1;
      // 天气影响反击频率（雷暴 +30%）；EMP 减速时反击间隔拉长
      const empCounterMul = this.t < this.empUntil ? EMP_COUNTER_MUL : 1;
      const interval = this.bossDef.counterInterval / enragedMul / this.weather.counterMul * empCounterMul;
      this.counterTimer = interval;
      this.counterWarnLeft = 0.7;
      // 反击类型 = PATTERN_DEBUFF[pattern]
      const debuff = PATTERN_DEBUFF[this.bossDef.pattern];
      const duration = this.bossDef.counterDebuffDur;
      const warnColor = DEBUFF_WARN_COLORS[debuff];
      // 预警标记
      this.counterWarns.push({
        x: CANNON_X,
        y: CANNON_Y,
        landT: this.t + 0.7,
        r: 40,
        color: warnColor,
      });
      // 安排延迟发射（不使用 setTimeout，改用 pending 队列由主循环推进）
      const shots = this.bossDef.counterShots;
      for (let i = 0; i < shots; i++) {
        this.pendingCounters.push({ at: this.t + 0.7 + i * 0.12, debuff, duration });
      }
      playSfx("boss");
    }
    // 触发到时间的延迟反击
    for (let i = this.pendingCounters.length - 1; i >= 0; i--) {
      const p = this.pendingCounters[i];
      if (this.t >= p.at) {
        if (this.phase === "fight") this.launchCounterShell(p.debuff, p.duration);
        const last = this.pendingCounters.length - 1;
        if (i !== last) this.pendingCounters[i] = this.pendingCounters[last];
        this.pendingCounters.pop();
      }
    }
    // 清理过期预警（in-place compaction，避免 filter 分配新数组）
    {
      const arr = this.counterWarns;
      let w = 0;
      for (let r = 0; r < arr.length; r++) {
        if (this.t < arr[r].landT + 0.1) {
          if (w !== r) arr[w] = arr[r];
          w++;
        }
      }
      arr.length = w;
    }
  }

  private launchCounterShell(debuff: CounterDebuff, duration: number): void {
    const def = this.bossDef;
    const startX = PARK_CX + (Math.random() - 0.5) * PARK_W * 0.6;
    const startY = PARK_TOP + 20;
    const tx = CANNON_X + (Math.random() - 0.5) * 60;
    const ty = CANNON_Y;
    const T = 0.6 + Math.random() * 0.2;
    const vx = (tx - startX) / T;
    const vy = (ty - startY - 0.5 * GRAVITY * T * T) / T;
    const kind: CounterShell["kind"] =
      def.pattern === "droneSwarm" ? "drone" :
      def.pattern === "missileSalvo" ? "missile" :
      def.pattern === "commsJamming" ? "jam" : "shell";
    // 颜色按 debuff 类型决定
    const color = DEBUFF_WARN_COLORS[debuff];
    this.counterShells.push({
      x: startX, y: startY, vx, vy, life: 3, debuff, duration, color, kind, trail: [],
    });
  }

  private updateCounterShells(dt: number): void {
    // 反向遍历 + swap-pop：O(1) 删除，避免 splice 的 O(n) 移位
    const arr = this.counterShells;
    for (let i = arr.length - 1; i >= 0; i--) {
      const s = arr[i];
      s.life -= dt;
      if (s.life <= 0) {
        const last = arr.length - 1;
        if (i !== last) arr[i] = arr[last];
        arr.pop();
        continue;
      }
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 8) s.trail.shift();
      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // 命中树木（护盾：反击弹被树木阻挡）
      const tree = this.hitTestTree(s.x, s.y);
      if (tree) {
        this.damageTree(tree, TREE_DMG_PER_COUNTER);
        this.particles.spawnBurst(s.x, s.y, s.color, { ring: false, sparks: 4, dots: 6, speed: 100, life: 0.4, size: 2, color2: s.color });
        const last = arr.length - 1;
        if (i !== last) arr[i] = arr[last];
        arr.pop();
        continue;
      }
      // 命中炮兵区域：不再造成伤害，改为触发对应 debuff
      const dx = s.x - CANNON_X;
      const dy = s.y - CANNON_Y;
      if (Math.hypot(dx, dy) < 30) {
        this.hitCannonArea(s.debuff, s.duration, s.color);
        const last = arr.length - 1;
        if (i !== last) arr[i] = arr[last];
        arr.pop();
        continue;
      }
      if (s.y >= GROUND_Y) {
        // 落地粒子
        this.particles.spawnBurst(s.x, GROUND_Y, s.color, { ring: false, sparks: 4, dots: 6, speed: 100, life: 0.4, size: 2, color2: s.color });
        const last = arr.length - 1;
        if (i !== last) arr[i] = arr[last];
        arr.pop();
      }
    }
  }

  /** 反击弹命中炮兵区域：激活对应 debuff（不再伤害炮兵） */
  private hitCannonArea(debuff: CounterDebuff, duration: number, color: string): void {
    switch (debuff) {
      case "cdLock":
        this.cdLockUntil = this.t + duration;
        break;
      case "weaponJam":
        this.weaponJamUntil = this.t + duration;
        break;
      case "itemDisable": {
        this.itemDisableUntil = this.t + duration;
        // 随机选一个可用道具使其失效
        const available = ITEM_ORDER.filter(id => this.cdLeft[id] <= 0);
        if (available.length > 0) {
          this.disabledItem = available[Math.floor(Math.random() * available.length)];
        } else {
          // 没有可用道具时退化为选择 CD 最短的
          let minCd = Infinity;
          let pick: ItemId | null = null;
          for (const id of ITEM_ORDER) {
            if (this.cdLeft[id] < minCd) { minCd = this.cdLeft[id]; pick = id; }
          }
          this.disabledItem = pick;
        }
        break;
      }
      case "visionJam":
        this.visionJamUntil = this.t + duration;
        break;
    }
    this.shakeUntil = this.t + 0.3;
    postFX.flash(color, 0.3, 3);
    postFX.shake(6, 10);
    if (debuff === "visionJam") postFX.glitch(0.4, 3);
    this.particles.spawnBurst(CANNON_X, CANNON_Y, color, { ring: true, sparks: 12, dots: 16, speed: 200, life: 0.7, size: 3, color2: "#FFD666" });
    this.toast = { text: `⚠ ${DEBUFF_EMOJIS[debuff]} ${DEBUFF_NAMES[debuff]} ${duration.toFixed(1)}s`, tone: "bad", until: this.t + 2 };
    playSfx("hit");
    vibrateShort();
  }

  private fireShell(): void {
    const w = this.weapon;
    // 特殊武器弹药耗尽时自动回退到标准弹
    const effective: WeaponKind = (w !== "standard" && this.weaponAmmo[w] <= 0) ? "standard" : w;
    // 消耗弹药
    if (effective !== "standard") this.weaponAmmo[effective] -= 1;
    // 多管齐射：基础数 + 过载额外加成（过载不再提升单发伤害，改为多发）
    const base = multishotCount(this.weaponLevel);
    const count = this.overdriveActive ? base + OVERDRIVE_MULTISHOT_BONUS : base;
    const fired = Math.min(count, MAX_SHELLS - this.shells.length);
    // 过载时多管齐射分布更广
    const spread = this.overdriveActive ? PARK_W * 0.5 : PARK_W * 0.35;
    for (let i = 0; i < fired; i++) {
      // v2：瞄准未拆模块（击打对象不能是废墟）
      const offset = fired > 1 ? (i - (fired - 1) / 2) * (spread / Math.max(1, fired - 1)) : 0;
      const preferX = PARK_CX + offset;
      const target = this.pickTargetModule(preferX);
      let tx: number, ty: number;
      if (target) {
        // 瞄准目标模块中心 + 小偏移（命中模块本体）
        tx = target.x + target.w / 2 + (Math.random() - 0.5) * target.w * 0.6;
        ty = target.y + target.h / 2 + (Math.random() - 0.5) * target.h * 0.6;
      } else {
        // 无未拆模块（即将清波）： fallback 落点
        tx = PARK_CX + offset + (Math.random() - 0.5) * PARK_W * 0.4;
        ty = PARK_TOP + Math.random() * PARK_H * 0.6;
      }
      const T = 0.85 + Math.random() * 0.2;
      const vx = (tx - CANNON_X) / T;
      const vy = (ty - CANNON_Y - 0.5 * GRAVITY * T * T) / T;
      this.shells.push({ x: CANNON_X + 22, y: CANNON_Y - 8, vx, vy, life: 3, trail: [], weapon: effective });
    }
    // 多枚炮弹发射时后坐力累积增强、炮口闪光更亮
    this.cannonRecoil = 10 + count * 2;
    this.muzzleUntil = this.t + 0.08 + count * 0.02;
    playSfx("shoot");
  }

  private updateShells(dt: number): void {
    // 反向遍历 + swap-pop：O(1) 删除，避免 splice 的 O(n) 移位
    const arr = this.shells;
    for (let i = arr.length - 1; i >= 0; i--) {
      const s = arr[i];
      s.life -= dt;
      if (s.life <= 0) {
        const last = arr.length - 1;
        if (i !== last) arr[i] = arr[last];
        arr.pop();
        continue;
      }
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 10) s.trail.shift();
      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // 命中树木（障碍物：炮弹被阻挡，不伤害园区）
      const tree = this.hitTestTree(s.x, s.y);
      if (tree) {
        this.damageTree(tree, TREE_DMG_PER_SHELL);
        this.particles.spawnBurst(s.x, s.y, "#FFD666", { ring: true, sparks: 6, dots: 8, speed: 160, life: 0.5, size: 3, color2: "#FF7A1A" });
        const last = arr.length - 1;
        if (i !== last) arr[i] = arr[last];
        arr.pop();
        continue;
      }
      // 命中园区（v2：只要进入园区 bbox 即触发 impactShell，由 impactShell 寻找最近未拆模块）
      if (s.y >= PARK_TOP && s.x >= PARK_LEFT && s.x <= PARK_RIGHT) {
        this.impactShell(s.x, s.y, s.weapon);
        const last = arr.length - 1;
        if (i !== last) arr[i] = arr[last];
        arr.pop();
        continue;
      }
      if (s.y >= GROUND_Y || s.x > W + 30 || s.x < -30) {
        const last = arr.length - 1;
        if (i !== last) arr[i] = arr[last];
        arr.pop();
      }
    }
  }

  /**
   * 炮弹命中园区：v2 寻找最近未拆模块造成绝对伤害（≤100/发）。
   * 若无未拆模块（即将清波），仅产生落地灰尘。
   * 不显示伤害飘字（按用户要求隐藏）。
   */
  private impactShell(x: number, y: number, weapon: WeaponKind): void {
    // 天气影响炮弹伤害（雷暴 +20%，浓雾 -15%）；过载不提升单发伤害（改为多发）
    const dmgMul = this.weather.shellDmgMul;
    const baseDmg = Math.min(100, Math.round(weaponDamageAbs(this.weaponLevel) * dmgMul));
    this.addOverdrive(SHELL_OVERDRIVE_GAIN);
    // shake 强度随武器等级递增
    const shakeMag = 4 + this.weaponLevel * 0.5;
    // 寻找最近未拆模块（击打对象不能是废墟）
    const target = this.pickTargetModule(x);
    switch (weapon) {
      case "standard": {
        // 标准弹：单模块绝对伤害（爽感强化：每发轻震屏 + hit-stop 概率）
        if (target) this.damageModule(target, baseDmg);
        this.particles.spawnBurst(x, y, "#FFD666", { ring: true, sparks: 14, dots: 18, speed: 200, life: 0.55, size: 3, color2: "#FF7A1A" });
        this.parkFlashUntil = this.t + 0.1;
        postFX.shake(2.5, 6);
        // hit-stop：标准弹有 28% 概率触发短暂慢镜头
        if (Math.random() < 0.28) this.hitStopRemain = Math.max(this.hitStopRemain, 0.045);
        playSfx("hit");
        break;
      }
      case "cluster": {
        // 集束弹：主爆破对落点最近模块 + 3 发子爆破各自寻找最近模块
        if (target) this.damageModule(target, CLUSTER_MAIN_DMG);
        this.spawnBurst(x, y, "#FF7A1A", 1.2);
        for (let i = 0; i < CLUSTER_SUB_COUNT; i++) {
          const a = (i / CLUSTER_SUB_COUNT) * Math.PI * 2 + Math.random() * 0.5;
          const sx = x + Math.cos(a) * CLUSTER_SUB_OFFSET;
          const sy = y + Math.sin(a) * CLUSTER_SUB_OFFSET;
          const subTarget = this.pickTargetModule(sx);
          if (subTarget) this.damageModule(subTarget, CLUSTER_SUB_DMG);
          this.spawnBurst(sx, sy, "#FF7A1A", 0.9);
        }
        this.parkFlashUntil = this.t + 0.12;
        postFX.shake(shakeMag + 1, 10);
        playSfx("explode");
        break;
      }
      case "emp": {
        // 电磁弹：直接伤害 + 全局减速 2 秒（冲击波保留）
        if (target) this.damageModule(target, EMP_DMG_ABS);
        this.empUntil = this.t + EMP_SLOW_DURATION;
        this.particles.spawnBurst(x, y, "#00E5FF", { ring: true, sparks: 16, dots: 22, speed: 260, life: 0.8, size: 4, color2: "#B388FF", shockwave: true });
        // 额外冲击环
        this.particles.spawn({ x, y, count: 1, speed: 0, life: 1.0, size: 8, color: "#00E5FF", type: "shockwave", ringWidth: 4 });
        postFX.flash("#00E5FF", 0.35, 3);
        postFX.shake(shakeMag + 2, 12);
        playSfx("laser");
        this.particles.spawnText(PARK_CX, PARK_TOP - 30, "EMP 减速！", "#00E5FF", { size: 12, life: 1.0 });
        this.parkFlashUntil = this.t + 0.1;
        break;
      }
      case "incendiary": {
        // 燃烧弹：初始伤害 + 3 秒燃烧区 DoT
        if (target) this.damageModule(target, INCENDIARY_DMG_ABS);
        this.dots.push({ until: this.t + INCENDIARY_ZONE_DURATION, dps: INCENDIARY_ZONE_DPS, kind: "burnZone", x, y, r: 100, startT: this.t });
        this.particles.spawnBurst(x, y, "#E5353B", { ring: true, sparks: 14, dots: 18, speed: 200, life: 0.7, size: 3, color2: "#FF7A1A" });
        this.parkFlashUntil = this.t + 0.1;
        postFX.shake(shakeMag, 10);
        playSfx("explode");
        break;
      }
    }
    // 过载命中触发更强 hit-stop + 蓝光（但不提升单发伤害）
    if (this.overdriveActive) {
      postFX.flash("#00E5FF", 0.15, 4);
      this.hitStopRemain = Math.max(this.hitStopRemain, 0.05);
    }
  }

  private updateDots(dt: number): void {
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const d = this.dots[i];
      if (this.t > d.until) {
        const last = this.dots.length - 1;
        if (i !== last) this.dots[i] = this.dots[last];
        this.dots.pop();
        continue;
      }
      // v2：绝对 DPS，每秒每模块≤100；对范围内未拆模块各造成 dps*dt 伤害
      if (d.kind === "drone") {
        // 无人机：每秒对随机未拆模块造成 dps 伤害（单目标扫射）
        const target = this.pickRandomIntactModule();
        if (target) this.damageModule(target, d.dps * dt);
      } else {
        // fireRain / burnZone：范围内每模块每秒 dps
        const list = this.modulesInRadius(d.x, d.y, d.r);
        for (const m of list) this.damageModule(m, d.dps * dt);
      }
      // 粒子
      if (d.kind === "fireRain") {
        if (Math.random() < dt * 30) {
          this.particles.spawn({ x: d.x + (Math.random() - 0.5) * d.r * 2, y: d.y - 10, count: 1, speed: 60, life: 0.6, size: 3, color: "#FF5A2A", gravity: 120 });
        }
      } else if (d.kind === "burnZone") {
        if (Math.random() < dt * 16) {
          this.particles.spawn({ x: d.x + (Math.random() - 0.5) * d.r, y: d.y - Math.random() * 20, count: 1, speed: 30, life: 0.7, size: 3, color: "#FF7A1A" });
        }
      } else if (d.kind === "drone") {
        // 无人机扫射子弹
        if (Math.random() < dt * 12) {
          const dx = PARK_CX + (Math.random() - 0.5) * PARK_W;
          this.particles.spawn({ x: d.x, y: d.y, count: 1, speed: 200, life: 0.4, size: 2, color: "#00E5FF", angle: Math.atan2(PARK_TOP - d.y, dx - d.x), spread: 0.1, type: "spark" });
        }
      }
    }
  }

  private updateStrikes(): void {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      if (this.t >= s.landT) {
        // v2：绝对伤害，对落点附近未拆模块造成 dmg（每模块≤100）
        const target = this.pickTargetModule(s.x);
        if (target) this.damageModule(target, s.dmg);
        this.spawnBurst(s.x, PARK_TOP + PARK_H * 0.5, s.color, s.kind === "meteor" ? 1.1 : 0.4);
        if (s.kind === "meteor") { postFX.flash(s.color, 0.2, 3); postFX.shake(6, 12); playSfx("explode"); }
        else playSfx("hit");
        this.strikes[i] = this.strikes[this.strikes.length - 1];
        this.strikes.pop();
      }
    }
  }

  private spawnParkAmbient(dt: number): void {
    const hpPct = this.hp / this.maxHp;
    // 已拆除模块的废墟持续冒烟（爽感反馈：拆得越多烟越浓）
    for (const m of this.modules) {
      if (!m.demolished || m.demolishAnim < 0.4) continue;
      if (Math.random() < dt * 4) {
        const cx = m.x + m.w / 2 + (Math.random() - 0.5) * m.w * 0.6;
        const cy = m.y + m.h - m.h * 0.25;
        this.particles.spawn({ x: cx, y: cy, count: 1, speed: 14, life: 1.2, size: 4, color: "rgba(120,120,120,0.5)", gravity: -10, friction: 0.99 });
      }
    }
    // 整体低血量时的余烬火星
    if (hpPct < 0.4 && Math.random() < dt * 10) {
      this.particles.spawn({ x: PARK_LEFT + Math.random() * PARK_W, y: PARK_TOP + Math.random() * PARK_H * 0.7, count: 1, speed: 30, life: 0.6, size: 3, color: "#FF7A1A" });
    }
  }

  private clearPhase(): void {
    this.phase = "clearing";
    this.collapseT = 0;
    // 清波时击破波数 +1，本波伤害归零
    this.clearedWaves += 1;
    this.waveDamage = 0;
    // 武器升级（每清一波 +1 级）
    const oldLv = this.weaponLevel;
    if (this.weaponLevel < WEAPON_MAX_LEVEL) this.weaponLevel += 1;
    const bonus = this.wave * 100 + Math.floor(this.overdrive) * 2 + this.maxCombo * 2;
    this.score += bonus;
    const upgradeMsg = this.weaponLevel > oldLv ? ` · 武器升级 LV${this.weaponLevel}！` : "";
    this.toast = { text: `${this.bossDef.bossName} 已被击溃！+${bonus}${upgradeMsg}`, tone: "good", until: this.t + 2.8 };
    postFX.flash("#52C41A", 0.4, 2);
    // 清波时触发最长 hit-stop（0.2s）+ 多阶段坍塌动画
    this.hitStopRemain = Math.max(this.hitStopRemain, 0.2);
    this.particles.spawnBurst(PARK_CX, PARK_TOP + PARK_H * 0.5, "#52C41A", { ring: true, sparks: 30, dots: 40, speed: 360, life: 1.4, size: 6, color2: "#FFD666", shockwave: true });
    this.particles.spawn({ x: PARK_CX, y: PARK_BASE_Y - 30, count: 30, speed: 260, life: 1.3, size: 5, color: this.tier.color, type: "debris", gravity: 500, friction: 0.96 });
    // 烟尘扩散
    this.particles.spawn({ x: PARK_CX, y: PARK_BASE_Y - 20, count: 24, speed: 90, life: 1.6, size: 8, color: "rgba(120,120,120,0.6)", type: "dot", friction: 0.94 });
    // 武器升级特效：金色光环
    if (this.weaponLevel > oldLv) {
      this.particles.spawnBurst(CANNON_X, CANNON_Y, "#FFD666", { ring: true, sparks: 18, dots: 22, speed: 240, life: 1.0, size: 4, color2: "#FF7A1A" });
      postFX.flash("#FFD666", 0.3, 3);
    }
    // 特殊武器弹药补满（清波奖励）
    let refilled = false;
    for (const k of WEAPON_ORDER) {
      const def = WEAPONS[k];
      if (def.maxAmmo > 0 && this.weaponAmmo[k] < def.maxAmmo) {
        this.weaponAmmo[k] = def.maxAmmo;
        refilled = true;
      }
    }
    if (refilled) {
      this.particles.spawnText(CANNON_X, CANNON_Y - 70, "弹药已补满", "#FFD666", { size: 12, life: 1.6 });
    }
    playSfx("good");
  }

  private updateFloats(dt: number): void {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= dt * 36;
      if (f.life <= 0) {
        const last = this.floats.length - 1;
        if (i !== last) this.floats[i] = this.floats[last];
        this.floats.pop();
      }
    }
  }

  private emitHud(): void {
    // 更新预分配的 items/weapons 动态字段（避免每帧 map 分配新数组/对象）
    for (let i = 0; i < ITEM_ORDER.length; i++) {
      this._hudItems[i].cdLeft = this.cdLeft[ITEM_ORDER[i]];
    }
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      this._hudWeapons[i].ammo = this.weaponAmmo[WEAPON_ORDER[i]];
    }
    const curWeaponDef = WEAPONS[this.weapon];
    const curAmmo = this.weaponAmmo[this.weapon];
    // 园区破坏阶段：0=完好 1=≤75% 2=≤50% 3=≤25%
    const hpPct = this.hp / this.maxHp;
    const destructionStage: 0 | 1 | 2 | 3 = hpPct > 0.75 ? 0 : hpPct > 0.5 ? 1 : hpPct > 0.25 ? 2 : 3;
    const hud: ParkHud = {
      wave: this.wave,
      tierName: this.tier.name,
      tierSubtitle: this.tier.subtitle,
      bossName: this.bossDef.bossName,
      bossIdentity: this.bossDef.identity,
      bossEmoji: this.bossDef.emoji,
      bossSkillName: this.bossDef.skillName,
      bossEnraged: this.bossEnraged,
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      hpPct,
      // 纯无尽模式：escape 永远为 0（向后兼容）
      escape: 0,
      overdrive: this.overdrive,
      overdriveActive: this.overdriveActive,
      combo: this.combo,
      score: this.score,
      items: this._hudItems,
      phase: this.phase,
      // 炮兵生命系统已移除：字段保留为满值向后兼容
      cannonHp: CANNON_MAX_HP,
      cannonMaxHp: CANNON_MAX_HP,
      weaponLevel: this.weaponLevel,
      counterWarn: this.counterWarnLeft,
      // 天气系统
      weather: this.weather.id,
      weatherName: this.weather.name,
      weatherEmoji: this.weather.emoji,
      weatherDesc: this.weather.desc,
      weatherColor: this.weather.color,
      // ---- 武器系统 ----
      weapon: this.weapon,
      weaponName: curWeaponDef.name,
      weaponEmoji: curWeaponDef.emoji,
      weaponColor: curWeaponDef.color,
      weaponAmmo: curAmmo,
      weapons: this._hudWeapons,
      // ---- 公园地图系统 ----
      mapId: this.currentMap.id,
      mapName: this.currentMap.name,
      mapEmoji: this.currentMap.emoji,
      mapTransition: this.mapTransitionT > 0
        ? Math.max(0, 1 - this.mapTransitionT / MAP_TRANSITION_DURATION)
        : 0,
      empSlow: this.empUntil > this.t ? (this.empUntil - this.t) : 0,
      // ---- 升级新增字段 ----
      waveDamage: this.waveDamage,
      totalDamage: this.totalDamage,
      dps: this.dps,
      maxDps: this.maxDps,
      maxCombo: this.maxCombo,
      clearedWaves: this.clearedWaves,
      destructionStage,
      cdLockRemain: this.cdLockUntil > this.t ? (this.cdLockUntil - this.t) : 0,
      weaponJamRemain: this.weaponJamUntil > this.t ? (this.weaponJamUntil - this.t) : 0,
      itemDisableRemain: this.itemDisableUntil > this.t ? (this.itemDisableUntil - this.t) : 0,
      visionJamRemain: this.visionJamUntil > this.t ? (this.visionJamUntil - this.t) : 0,
      disabledItemId: this.itemDisableUntil > this.t ? this.disabledItem : null,
    };
    this.emit({ type: "hud", payload: hud as unknown as Record<string, string | number> });
    if (this.toast && this.t < this.toast.until) {
      this.emit({ type: "toast", text: this.toast.text, tone: this.toast.tone });
    }
  }

  // ============ 渲染 ============

  protected render(): void {
    const ctx = this.ctx;
    const shaking = this.t < this.shakeUntil;
    const sx = shaking ? (Math.random() - 0.5) * 6 : 0;
    const sy = shaking ? (Math.random() - 0.5) * 6 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    this.drawSky(ctx);
    this.drawPark(ctx);
    this.drawTrees(ctx); // 公园树木（障碍/护盾）
    this.drawDots(ctx);
    this.drawStrikes(ctx);
    this.drawBeams(ctx);
    this.drawCounterWarns(ctx);
    this.drawCannon(ctx);
    this.drawShells(ctx);
    this.drawCounterShells(ctx);
    this.particles.render(ctx);
    this.drawFloats(ctx);
    this.drawBossBanner(ctx);
    // 地图切换过渡（覆盖战场，但在左侧列 UI 之下）
    this.drawMapTransition(ctx);

    // 左侧列 UI（覆盖在最上）
    this.drawLeftPanel(ctx);

    // 视觉干扰 debuff 渲染（覆盖全屏，最后绘制）
    this.drawVisionJam(ctx);

    ctx.restore();
  }

  /** visionJam 激活时全屏叠加色差 + 微抖动（3 层透明色块叠加，每层有不同偏移） */
  private drawVisionJam(ctx: CanvasRenderingContext2D): void {
    if (this.visionJamUntil <= this.t) return;
    const remain = this.visionJamUntil - this.t;
    const intensity = Math.min(1, remain / 2) * 0.5; // 0..0.5
    // 微抖动偏移
    const jx = (Math.random() - 0.5) * 4 * intensity * 2;
    const jy = (Math.random() - 0.5) * 2 * intensity * 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // 红色层（向左偏移）
    ctx.globalAlpha = intensity * 0.5;
    ctx.fillStyle = "#FF0050";
    ctx.fillRect(jx, 0, W, H);
    // 蓝色层（向右偏移）
    ctx.fillStyle = "#00E5FF";
    ctx.fillRect(-jx, jy, W, H);
    // 紫色层（向下偏移）
    ctx.globalAlpha = intensity * 0.3;
    ctx.fillStyle = "#B388FF";
    ctx.fillRect(0, -jy, W, H);
    ctx.restore();
    // 干扰扫描线
    ctx.save();
    ctx.globalAlpha = intensity * 0.4;
    ctx.strokeStyle = "#B388FF";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const y = (this.t * 200 + i * 90) % H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** 顶部 BOSS 横幅：身份/技能/狂暴状态 */
  private drawBossBanner(ctx: CanvasRenderingContext2D): void {
    if (this.phase === "lost") return;
    const cx = (COL_X + COL_W + W) / 2;
    const y = 18;
    // BOSS 头像 emoji
    ctx.save();
    ctx.font = `22px ${Theme.fonts.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = this.bossEnraged ? "#E5353B" : this.tier.color;
    ctx.shadowBlur = 12;
    ctx.fillText(this.bossDef.emoji, cx - 130, y + 8);
    ctx.restore();
    // 名称
    drawText(ctx, this.bossDef.bossName, cx - 100, y, {
      size: 14, color: this.bossEnraged ? "#FF5A60" : "#F0F4FF", weight: "900", align: "left",
      shadow: { color: this.bossEnraged ? "#E5353B" : this.tier.color, blur: 8 },
    });
    // 身份
    drawText(ctx, this.bossDef.identity, cx - 100, y + 16, {
      size: 9, color: "#FF8A8A", weight: "500", align: "left",
    });
    // 技能
    drawText(ctx, `技能：${this.bossDef.skillName}`, cx + 60, y, {
      size: 10, color: this.bossEnraged ? "#FF5A60" : "#FFD666", weight: "700", align: "left",
    });
    drawText(ctx, this.bossDef.skillDesc, cx + 60, y + 14, {
      size: 8, color: "#7A8FB0", weight: "400", align: "left",
    });
    // 狂暴标识
    if (this.bossEnraged) {
      drawText(ctx, "⚠ ENRAGED", cx + 60, y + 26, {
        size: 9, color: "#E5353B", weight: "900", align: "left",
        font: Theme.fonts.mono,
        shadow: { color: "#E5353B", blur: 6 },
      });
    }
    // 反击预警：根据 debuff 类型上色，文案改为"即将干扰"
    if (this.counterWarnLeft > 0) {
      const blink = Math.floor(this.t * 12) % 2 === 0;
      const debuff = PATTERN_DEBUFF[this.bossDef.pattern];
      const warnColor = DEBUFF_WARN_COLORS[debuff];
      drawText(ctx, `⚠ BOSS 反击倒计时 ${this.counterWarnLeft.toFixed(1)}s · 即将干扰`, cx, y + 38, {
        size: 11, color: blink ? warnColor : "#FFD666", weight: "900", align: "center",
        font: Theme.fonts.mono,
        shadow: { color: warnColor, blur: 8 },
      });
    }
  }

  /** 反击预警圈（炮兵位置） */
  private drawCounterWarns(ctx: CanvasRenderingContext2D): void {
    for (const w of this.counterWarns) {
      const remain = w.landT - this.t;
      if (remain <= 0) continue;
      const ratio = 1 - remain / 0.7;
      const r = w.r * ratio;
      ctx.save();
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6 + Math.sin(this.t * 20) * 0.3;
      ctx.shadowColor = w.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
      ctx.stroke();
      // 内圈填充
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = w.color;
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 反击弹渲染 */
  private drawCounterShells(ctx: CanvasRenderingContext2D): void {
    for (const s of this.counterShells) {
      // 拖尾
      for (let i = 0; i < s.trail.length; i++) {
        const tp = s.trail[i];
        const a = i / s.trail.length;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = a * 0.5;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 2.5 * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 弹体（按 kind 不同造型）
      ctx.save();
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;
      if (s.kind === "drone") {
        // 无人机造型：椭圆机身 + 翼
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1A0A0A";
        ctx.fillRect(s.x - 12, s.y - 1, 6, 2);
        ctx.fillRect(s.x + 6, s.y - 1, 6, 2);
      } else if (s.kind === "missile") {
        // 导弹造型：菱形 + 尾焰
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 7);
        ctx.lineTo(s.x + 4, s.y);
        ctx.lineTo(s.x, s.y + 7);
        ctx.lineTo(s.x - 4, s.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFD666";
        ctx.beginPath();
        ctx.arc(s.x - 5, s.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.kind === "jam") {
        // 干扰弹：六边形
        ctx.fillStyle = s.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + this.t * 4;
          const px = s.x + Math.cos(a) * 6;
          const py = s.y + Math.sin(a) * 6;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // 普通炮弹
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    // 天空渐变按天气缓存（仅在天气切换时重建）
    if (!this._gradSky || this._gradSkyKey !== this.weather.id) {
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      // 天气影响天空色调
      if (this.weather.id === "storm") {
        sky.addColorStop(0, "#0A1424");
        sky.addColorStop(0.5, "#1A2840");
        sky.addColorStop(1, "#2A3850");
      } else if (this.weather.id === "thunder") {
        sky.addColorStop(0, "#10081A");
        sky.addColorStop(0.5, "#241040");
        sky.addColorStop(1, "#3A1850");
      } else if (this.weather.id === "fog") {
        sky.addColorStop(0, "#2A2A30");
        sky.addColorStop(0.5, "#3A3A45");
        sky.addColorStop(1, "#4A4A55");
      } else {
        // sunny / 默认
        sky.addColorStop(0, "#150A24");
        sky.addColorStop(0.5, "#2E1430");
        sky.addColorStop(1, "#4A2418");
      }
      this._gradSky = sky;
      this._gradSkyKey = this.weather.id;
    }
    ctx.fillStyle = this._gradSky;
    ctx.fillRect(0, 0, W, GROUND_Y);
    // 远山
    ctx.fillStyle = "rgba(60,30,40,0.55)";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(120, 330); ctx.lineTo(260, 380); ctx.lineTo(400, 300);
    ctx.lineTo(560, 360); ctx.lineTo(720, 318); ctx.lineTo(880, 372); ctx.lineTo(W, 340);
    ctx.lineTo(W, GROUND_Y); ctx.closePath(); ctx.fill();
    // 烟霾
    ctx.fillStyle = "rgba(255,122,26,0.05)";
    ctx.fillRect(0, 0, W, GROUND_Y);
    // 地面渐变（参数固定，懒加载一次）
    if (!this._gradGround) {
      const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
      g.addColorStop(0, "#7A4A24"); g.addColorStop(1, "#3A2010");
      this._gradGround = g;
    }
    ctx.fillStyle = this._gradGround;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.strokeStyle = "rgba(255,176,32,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();

    // 天气覆盖效果
    this.drawWeatherOverlay(ctx);
  }

  /** 天气视觉覆盖：雨/雾/烈日眩光 / 雷暴已在 update 中触发 postFX.flash */
  private drawWeatherOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.weather.id === "storm") {
      // 暴雨：斜线雨丝
      ctx.save();
      ctx.strokeStyle = "rgba(150,200,255,0.45)";
      ctx.lineWidth = 1;
      const rainCount = 60;
      for (let i = 0; i < rainCount; i++) {
        // 用 weatherT 与 i 生成稳定的伪随机位置
        const seed = i * 37.7;
        const baseX = (seed + this.weatherT * 320) % (W + 60) - 30;
        const baseY = (seed * 1.7 + this.weatherT * 600) % (GROUND_Y + 40) - 20;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX - 6, baseY + 14);
        ctx.stroke();
      }
      ctx.restore();
    } else if (this.weather.id === "fog") {
      // 浓雾：分层半透明色块
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const yOff = i * 80 + 80;
        const alpha = 0.18 - i * 0.04;
        ctx.fillStyle = `rgba(220,230,240,${alpha})`;
        ctx.fillRect(0, yOff, W, 60);
      }
      // 顶部柔和雾
      const fogGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      fogGrad.addColorStop(0, "rgba(200,210,220,0.15)");
      fogGrad.addColorStop(0.5, "rgba(200,210,220,0.08)");
      fogGrad.addColorStop(1, "rgba(200,210,220,0)");
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, W, GROUND_Y);
      ctx.restore();
    } else if (this.weather.id === "sunny") {
      // 烈日：右上角光晕 + 暖色色调
      ctx.save();
      const sunX = W - 80;
      const sunY = 70;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 120);
      sunGrad.addColorStop(0, "rgba(255,220,120,0.35)");
      sunGrad.addColorStop(0.5, "rgba(255,180,80,0.15)");
      sunGrad.addColorStop(1, "rgba(255,180,80,0)");
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, W, GROUND_Y);
      // 太阳本体
      ctx.fillStyle = "rgba(255,230,150,0.6)";
      ctx.shadowColor = "#FFD666";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (this.weather.id === "thunder") {
      // 雷暴：偶发闪电（用 weatherT 调制 alpha）
      ctx.save();
      const flashPhase = (this.weatherT % 4) / 4;
      if (flashPhase < 0.05) {
        ctx.fillStyle = "rgba(180,140,255,0.18)";
        ctx.fillRect(0, 0, W, GROUND_Y);
      }
      // 紫色基调光晕
      const thunderGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      thunderGrad.addColorStop(0, "rgba(120,90,200,0.18)");
      thunderGrad.addColorStop(1, "rgba(60,40,120,0)");
      ctx.fillStyle = thunderGrad;
      ctx.fillRect(0, 0, W, GROUND_Y);
      ctx.restore();
    }
  }

  // ---- 3D 立方体辅助 ----
  private extrudeBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, depth: number, face: string, top: string, side: string): void {
    ctx.fillStyle = face; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + depth, y - depth); ctx.lineTo(x + w + depth, y - depth); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(x + w, y); ctx.lineTo(x + w + depth, y - depth); ctx.lineTo(x + w + depth, y + h - depth); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  private drawPark(ctx: CanvasRenderingContext2D): void {
    const hpPct = this.hp / this.maxHp;
    const flash = this.t < this.parkFlashUntil;
    const tierColor = this.tier.color;
    const baseW = PARK_W;
    const baseY = PARK_BASE_Y;
    // 园区破坏阶段：0=完好 1=≤75% 2=≤50% 3=≤25%
    const stage: 0 | 1 | 2 | 3 = hpPct > 0.75 ? 0 : hpPct > 0.5 ? 1 : hpPct > 0.25 ? 2 : 3;
    const clearing = this.phase === "clearing";
    const collapse = clearing ? clamp(this.collapseT / 1.2, 0, 1) : 0;
    // 倾斜：阶段 3 轻微 + 清波坍塌加剧 + 已拆模块越多越倾斜（爽感反馈）
    const demolishedCount = this.modules.reduce((n, m) => n + (m.demolished ? 1 : 0), 0);
    const moduleTilt = Math.min(0.08, demolishedCount * 0.008);
    const tilt = moduleTilt + (stage >= 3 ? 0.04 : 0) + collapse * 0.12;

    // 地面投影（随拆除进度变暗变大）
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(PARK_CX, baseY + 6, baseW * 0.6 + demolishedCount * 1.5, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    // 整体倾斜（以园区底部为中心）
    ctx.translate(PARK_CX, baseY);
    ctx.rotate(tilt);
    ctx.translate(-PARK_CX, -baseY);

    // 渲染所有模块：未拆除 → 完整/裂痕/烟焰；已拆除 → 废墟
    // 按 y 从下往上排序，保证上层模块遮挡下层（地基/围墙先画，楼层/天线后画）
    const sorted = this.modules.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const m of sorted) {
      this.drawModule(ctx, m, flash, stage, collapse);
    }

    ctx.restore(); // 倾斜

    // 厚血条（浮于园区上方）
    const barW = baseW + 20;
    const barX = PARK_CX - barW / 2;
    const barY = PARK_TOP - 26;
    const barH = 14;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.strokeStyle = this.shade(tierColor, 1.1);
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);
    // 分段刻度背景
    ctx.fillStyle = "rgba(40,20,20,0.9)";
    ctx.fillRect(barX, barY, barW, barH);
    const ratio = clamp(hpPct, 0, 1);
    const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    hpGrad.addColorStop(0, ratio > 0.5 ? "#52C41A" : ratio > 0.25 ? "#FFD666" : "#E5353B");
    hpGrad.addColorStop(1, ratio > 0.5 ? "#73D13D" : ratio > 0.25 ? "#FF7A1A" : "#FF5A60");
    ctx.fillStyle = hpGrad;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    // 刻度
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const tx = barX + (barW / 10) * i;
      ctx.beginPath(); ctx.moveTo(tx, barY); ctx.lineTo(tx, barY + barH); ctx.stroke();
    }
    drawText(ctx, `${this.formatNum(this.hp)} / ${this.formatNum(this.maxHp)}`, PARK_CX, barY + barH / 2, { size: 9, color: "#0A1929", weight: "900", align: "center", baseline: "middle" });

    // 名称
    drawText(ctx, `${this.tier.name}园区 · WAVE ${this.wave}`, PARK_CX, barY - 12, { size: 11, color: this.shade(tierColor, 1.1), weight: "700", align: "center", shadow: { color: this.shade(tierColor, 0.8), blur: 6 } });
  }

  /**
   * 渲染单个建筑模块：未拆除时按类型绘制完整结构（含裂痕/窗户/烟焰），
   * 已拆除时绘制废墟堆。清波坍塌阶段所有模块逐层下沉。
   * v2：损伤阶段基于每模块自身 HP 比例（非全局 HP），hitFlash 触发白闪。
   */
  private drawModule(ctx: CanvasRenderingContext2D, m: BuildingModule, flash: boolean, _globalStage: number, collapse: number): void {
    // 清波逐层下沉：所有模块随坍塌进度下沉
    const sink = this.phase === "clearing" ? collapse * 50 : 0;

    if (m.demolished) {
      this.drawRubble(ctx, m, sink);
      return;
    }

    // v2：模块级损伤阶段（基于本模块 HP 比例，非全局）
    const hpRatio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
    const stage: 0 | 1 | 2 | 3 = hpRatio > 0.75 ? 0 : hpRatio > 0.5 ? 1 : hpRatio > 0.25 ? 2 : 3;
    // hitFlash：受击白闪（与全局 parkFlash 叠加）
    const hitFlash = m.hitFlash > 0;

    ctx.save();
    ctx.translate(0, sink);

    const colDark = this.shade(m.color, 0.55);
    const colMid = (flash || hitFlash) ? "#FFFFFF" : this.shade(m.color, 0.85);
    const colTop = this.shade(m.color, 1.15);

    if (m.type === "antenna") {
      // 信号塔：细杆 + 顶端闪烁红灯
      ctx.strokeStyle = m.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x + m.w / 2, m.y + m.h); ctx.lineTo(m.x + m.w / 2, m.y); ctx.stroke();
      const blink = Math.floor(this.t * 3) % 2 === 0;
      ctx.fillStyle = blink ? "#E5353B" : "rgba(229,53,59,0.3)";
      ctx.shadowColor = "#E5353B"; ctx.shadowBlur = blink ? 8 : 0;
      ctx.beginPath(); ctx.arc(m.x + m.w / 2, m.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (m.type === "wall") {
      // 铁丝网：扁长条 + 尖刺纹理
      ctx.fillStyle = colMid;
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.strokeStyle = colDark; ctx.lineWidth = 1;
      ctx.strokeRect(m.x, m.y, m.w, m.h);
      // 铁丝网纹路
      ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 0.8;
      for (let gx = m.x + 3; gx < m.x + m.w; gx += 4) {
        ctx.beginPath(); ctx.moveTo(gx, m.y); ctx.lineTo(gx, m.y + m.h); ctx.stroke();
      }
    } else if (m.type === "foundation") {
      // 地基：贴地深色条
      ctx.fillStyle = colDark;
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1;
      ctx.strokeRect(m.x, m.y, m.w, m.h);
    } else if (m.type === "fortress") {
      // 装甲碉堡：半透明覆盖 + 板条纹理
      ctx.fillStyle = "rgba(179,136,255,0.30)";
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.strokeStyle = m.color; ctx.lineWidth = 2;
      ctx.strokeRect(m.x, m.y, m.w, m.h);
      ctx.strokeStyle = "rgba(179,136,255,0.5)"; ctx.lineWidth = 1;
      for (let y = m.y + 12; y < m.y + m.h; y += 18) {
        ctx.beginPath(); ctx.moveTo(m.x, y); ctx.lineTo(m.x + m.w, y); ctx.stroke();
      }
    } else if (m.type === "shock") {
      // 电击室：3D 立方体 + 动态电弧 + 青蓝辉光
      this.extrudeBox(ctx, m.x, m.y, m.w, m.h, m.depth, colMid, colTop, colDark);
      if (stage >= 1) this.drawCracks(ctx, m.x, m.y, m.w, m.h, stage);
      // 电弧（动态锯齿闪电）
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const arcCount = 3;
      for (let i = 0; i < arcCount; i++) {
        const ph = this.t * 8 + i * 2.1;
        const ax = m.x + m.w * (0.25 + i * 0.25);
        const flick = Math.sin(ph) > -0.3;
        if (!flick) continue;
        ctx.strokeStyle = "#00E5FF"; ctx.lineWidth = 1.5; ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 8;
        ctx.beginPath();
        let cy = m.y + 4;
        ctx.moveTo(ax, cy);
        while (cy < m.y + m.h - 4) {
          cy += 5 + Math.random() * 4;
          ctx.lineTo(ax + (Math.random() - 0.5) * 10, cy);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      // 中央电极光晕
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const eg = ctx.createRadialGradient(m.x + m.w / 2, m.y + m.h / 2, 0, m.x + m.w / 2, m.y + m.h / 2, 14);
      const ep = 0.4 + Math.sin(this.t * 10) * 0.3;
      eg.addColorStop(0, `rgba(0,229,255,${ep})`);
      eg.addColorStop(1, "rgba(0,229,255,0)");
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(m.x + m.w / 2, m.y + m.h / 2, 14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      drawText(ctx, "电击室", m.x + m.w / 2, m.y + m.h - 6, { size: 8, color: "#0A1929", weight: "900", align: "center" });
    } else if (m.type === "cage") {
      // 铁笼：3D 立方体框 + 竖向铁栏 + 囚人剪影
      this.extrudeBox(ctx, m.x, m.y, m.w, m.h, m.depth, colDark, colMid, this.shade(m.color, 0.4));
      if (stage >= 1) this.drawCracks(ctx, m.x, m.y, m.w, m.h, stage);
      // 竖向铁栏
      ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 2;
      const barN = 5;
      for (let i = 1; i < barN; i++) {
        const bx = m.x + (m.w / barN) * i;
        ctx.beginPath(); ctx.moveTo(bx, m.y + 2); ctx.lineTo(bx, m.y + m.h - 2); ctx.stroke();
      }
      // 囚人剪影（低饱和暗色人形）
      const px = m.x + m.w / 2, py = m.y + m.h * 0.6;
      ctx.fillStyle = "rgba(20,20,30,0.75)";
      ctx.beginPath(); ctx.arc(px, py - 6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(px - 4, py - 2, 8, 10);
      drawText(ctx, "铁笼", m.x + m.w / 2, m.y + 8, { size: 8, color: "#F0F4FF", weight: "700", align: "center" });
    } else if (m.type === "cell") {
      // 小黑屋：极暗 3D 立方体 + 单个小 barred 窗 + 无光
      this.extrudeBox(ctx, m.x, m.y, m.w, m.h, m.depth, this.shade(m.color, 0.5), this.shade(m.color, 0.7), this.shade(m.color, 0.3));
      if (stage >= 1) this.drawCracks(ctx, m.x, m.y, m.w, m.h, stage);
      // 单个小铁窗（偶发微光）
      const wx = m.x + m.w / 2 - 7, wy = m.y + m.h * 0.35, ww = 14, wh = 10;
      ctx.fillStyle = "rgba(10,12,18,0.95)";
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = "rgba(120,130,150,0.6)"; ctx.lineWidth = 1;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
      // 偶发微光（囚人窥视）
      if (Math.floor(this.t * 2) % 7 < 2) {
        ctx.fillStyle = "rgba(255,200,120,0.25)";
        ctx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      }
      drawText(ctx, "小黑屋", m.x + m.w / 2, m.y + m.h - 6, { size: 8, color: "#F0F4FF", weight: "700", align: "center" });
    } else if (m.type === "guard") {
      // 白家武装：3D 武装塔 + 顶部哨兵 + 武器架
      this.extrudeBox(ctx, m.x, m.y, m.w, m.h, m.depth, colMid, colTop, colDark);
      if (stage >= 1) this.drawCracks(ctx, m.x, m.y, m.w, m.h, stage);
      // 窗户（暗红警戒色）
      this.drawWindows(ctx, m.x + 6, m.y + 8, m.w - 12, m.h - 20, "#E5353B", stage >= 2 ? 0.35 : 0);
      // 顶部哨兵位（垛口）
      ctx.fillStyle = colDark;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(m.x + 2 + i * (m.w / 4), m.y - 4, m.w / 4 - 3, 5);
      }
      // 哨兵剪影 + 枪管
      const gx = m.x + m.w / 2, gy = m.y - 2;
      ctx.fillStyle = "#1A0A0A";
      ctx.beginPath(); ctx.arc(gx, gy - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(gx - 2, gy - 2, 4, 6);
      ctx.strokeStyle = "#3A3A45"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gx, gy - 2); ctx.lineTo(gx + 10, gy - 6); ctx.stroke();
      // 警戒红灯
      const gblink = Math.floor(this.t * 4) % 2 === 0;
      ctx.fillStyle = gblink ? "#E5353B" : "rgba(229,53,59,0.3)";
      ctx.shadowColor = "#E5353B"; ctx.shadowBlur = gblink ? 6 : 0;
      ctx.beginPath(); ctx.arc(m.x + m.w - 6, m.y + 6, 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      drawText(ctx, "白家武装", m.x + m.w / 2, m.y + m.h - 6, { size: 7, color: "#F0F4FF", weight: "900", align: "center" });
    } else {
      // 电诈工位 / 苦工宿舍：3D 挤出立方体 + 窗户 + 裂痕
      this.extrudeBox(ctx, m.x, m.y, m.w, m.h, m.depth, colMid, colTop, colDark);
      if (stage >= 1) this.drawCracks(ctx, m.x, m.y, m.w, m.h, stage);
      const winColor = m.type === "dorm" ? "#FFD666" : this.tier.color;
      this.drawWindows(ctx, m.x + 6, m.y + 6, m.w - 12, m.h - 12, winColor, stage >= 2 ? 0.35 : 0);
      // 模块标签
      if (m.type === "floor") {
        drawText(ctx, "电诈工位", m.x + m.w / 2, m.y + 9, { size: 8, color: "#F0F4FF", weight: "700", align: "center" });
      } else if (m.type === "dorm") {
        drawText(ctx, "苦工宿舍", m.x + m.w / 2, m.y + 9, { size: 8, color: "#F0F4FF", weight: "700", align: "center" });
      }
      // 楼顶冒烟（仅顶层 floor0，stage 1+）
      if (m.type === "floor" && m.id === "floor0" && stage >= 1) {
        const smokeA = stage === 1 ? 0.22 : stage === 2 ? 0.38 : 0.55;
        for (let i = 0; i < 3; i++) {
          const sx = m.x + m.w * (0.25 + i * 0.25);
          const drift = Math.sin(this.t * 1.2 + i * 1.7) * 5;
          const sr = 12 + i * 3;
          const sg = ctx.createRadialGradient(sx + drift, m.y - 8, 0, sx + drift, m.y - 8, sr);
          sg.addColorStop(0, `rgba(90,90,90,${smokeA})`);
          sg.addColorStop(1, "rgba(90,90,90,0)");
          ctx.fillStyle = sg;
          ctx.beginPath(); ctx.arc(sx + drift, m.y - 8, sr, 0, Math.PI * 2); ctx.fill();
        }
      }
      // 火焰光晕（stage 2+，楼层内部）
      if (m.type === "floor" && stage >= 2) {
        const pts = stage >= 3 ? 3 : 2;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < pts; i++) {
          const fx = m.x + m.w * (0.25 + i * 0.25);
          const fy = m.y + m.h * 0.5;
          const flick = 0.6 + Math.sin(this.t * 9 + i * 2.1) * 0.4;
          const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 12);
          fg.addColorStop(0, `rgba(255,150,50,${0.6 * flick})`);
          fg.addColorStop(0.5, `rgba(255,80,20,${0.3 * flick})`);
          fg.addColorStop(1, "rgba(255,80,20,0)");
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(fx, fy, 12, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    }

    // v2：hitFlash 白闪覆盖（受击瞬间高亮整个模块矩形，强化打击爽感）
    if (hitFlash) {
      const fa = Math.min(1, m.hitFlash / 0.1) * 0.55;
      ctx.fillStyle = `rgba(255,255,255,${fa})`;
      ctx.fillRect(m.x, m.y, m.w, m.h);
    }

    ctx.restore();
  }

  /** 绘制已拆除模块的废墟堆：低矮碎块 + 残留灰尘（随时间消散） */
  private drawRubble(ctx: CanvasRenderingContext2D, m: BuildingModule, sink: number): void {
    ctx.save();
    ctx.translate(0, sink);
    const a = m.demolishAnim; // 0→1，拆除动画进度
    // 废墟高度随动画从 35% 降至 25%
    const rubbleH = m.h * (0.35 - a * 0.10);
    const rubbleY = m.y + m.h - rubbleH;
    // 主废墟块
    ctx.fillStyle = this.shade(m.color, 0.4);
    ctx.fillRect(m.x, rubbleY, m.w, rubbleH);
    // 碎块（基于位置哈希，避免闪烁）
    ctx.fillStyle = this.shade(m.color, 0.6);
    const blocks = Math.max(4, Math.floor(m.w / 14));
    for (let i = 0; i < blocks; i++) {
      const hx = (i * 7 + 3) % 10;
      const rx = m.x + (i / (blocks - 1)) * (m.w - 8) + 4 + (hx - 5) * 0.6;
      const ry = rubbleY + (hx % 3) * 2;
      const rw = 5 + (hx % 3);
      const rh = 3 + (hx % 2);
      ctx.fillRect(rx - rw / 2, ry, rw, rh);
    }
    // 残留灰尘（拆除瞬间较浓，0.6 进度后消散）
    if (a < 0.6) {
      const dustA = (1 - a / 0.6) * 0.4;
      const dg = ctx.createRadialGradient(m.x + m.w / 2, rubbleY, 0, m.x + m.w / 2, rubbleY, m.w * 0.7);
      dg.addColorStop(0, `rgba(120,120,120,${dustA})`);
      dg.addColorStop(1, "rgba(120,120,120,0)");
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(m.x + m.w / 2, rubbleY, m.w * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    // 边缘描边
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
    ctx.strokeRect(m.x, rubbleY, m.w, rubbleH);
    ctx.restore();
  }

  /** 在建筑表面绘制裂痕（stage 越高裂痕越多越深） */
  private drawCracks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stage: number): void {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1;
    // 主裂痕（阶段 1+）
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y);
    ctx.lineTo(x + w * 0.4, y + h * 0.3);
    ctx.lineTo(x + w * 0.32, y + h * 0.55);
    ctx.lineTo(x + w * 0.5, y + h * 0.8);
    ctx.lineTo(x + w * 0.42, y + h);
    ctx.stroke();
    if (stage >= 2) {
      // 次裂痕（阶段 2+）
      ctx.beginPath();
      ctx.moveTo(x + w * 0.7, y + h * 0.1);
      ctx.lineTo(x + w * 0.62, y + h * 0.4);
      ctx.lineTo(x + w * 0.75, y + h * 0.65);
      ctx.lineTo(x + w * 0.68, y + h * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.15, y + h * 0.5);
      ctx.lineTo(x + w * 0.25, y + h * 0.7);
      ctx.stroke();
    }
    if (stage >= 3) {
      // 大裂缝 + 缺口（阶段 3）
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y + h * 0.2);
      ctx.lineTo(x + w * 0.2, y + h * 0.6);
      ctx.lineTo(x + w * 0.35, y + h);
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.55, y + h * 0.45);
      ctx.lineTo(x + w * 0.7, y + h * 0.5);
      ctx.lineTo(x + w * 0.65, y + h * 0.7);
      ctx.lineTo(x + w * 0.5, y + h * 0.65);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawWindows(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, blackout = 0): void {
    const cols = Math.max(2, Math.floor(w / 14));
    const rows = Math.max(2, Math.floor(h / 16));
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 破坏阶段 2+：部分窗户永久熄灭（基于位置哈希，避免闪烁）
        const posHash = (r * 7 + c * 13) % 10;
        const forcedOff = blackout > 0 && posHash < blackout * 10;
        const on = !forcedOff && (Math.floor(this.t * 2 + r * 3 + c * 5) % 7) < 4;
        ctx.fillStyle = on ? this.shade(color, 1.2) : "rgba(20,30,50,0.6)";
        ctx.fillRect(x + c * cw + 2, y + r * rh + 2, cw - 4, rh - 4);
      }
    }
  }

  private drawDots(ctx: CanvasRenderingContext2D): void {
    for (const d of this.dots) {
      const left = d.until - this.t;
      const alpha = clamp(left / 1, 0, 1);
      if (d.kind === "burnZone") {
        ctx.save();
        ctx.globalAlpha = alpha * 0.4;
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        g.addColorStop(0, "#FF7A1A"); g.addColorStop(1, "rgba(255,122,26,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (d.kind === "fireRain") {
        ctx.save();
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = "#FF5A2A";
        ctx.fillRect(d.x - d.r, PARK_TOP - 6, d.r * 2, 4);
        ctx.restore();
      } else if (d.kind === "drone") {
        const dx = PARK_CX + Math.sin((this.t - d.startT) * 2) * 80;
        // 无人机本体（3D 小机身）
        ctx.save();
        ctx.translate(dx, d.y);
        ctx.fillStyle = "#0F2236";
        ctx.beginPath(); ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1B3A5A";
        ctx.fillRect(-22, -2, 8, 4); ctx.fillRect(14, -2, 8, 4);
        ctx.fillStyle = "#00E5FF"; ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, 4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // 瞄准线
        ctx.strokeStyle = "rgba(0,229,255,0.4)";
        ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, PARK_TOP - d.y + 20); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  private drawStrikes(ctx: CanvasRenderingContext2D): void {
    for (const s of this.strikes) {
      const remain = s.landT - this.t;
      if (remain <= 0) continue;
      const fall = clamp(1 - remain / 1.0, 0, 1);
      const y = s.startY + (PARK_TOP + PARK_H * 0.5 - s.startY) * fall;
      if (s.kind === "meteor") {
        ctx.save();
        ctx.fillStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(s.x, y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // 尾焰
        this.particles.spawn({ x: s.x, y: y - 4, count: 1, speed: 20, life: 0.4, size: 3, color: s.color });
        ctx.restore();
      } else {
        ctx.save();
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(s.x, y); ctx.lineTo(s.x, y + 14); ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawBeams(ctx: CanvasRenderingContext2D): void {
    for (const b of this.beams) {
      const left = b.until - this.t;
      const alpha = clamp(left / 0.4, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      if (b.kind === "laser") {
        ctx.strokeStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 16;
        ctx.lineWidth = 6 + Math.sin(this.t * 40) * 2;
        ctx.beginPath(); ctx.moveTo(PARK_LEFT - 20, b.y); ctx.lineTo(PARK_RIGHT + 20, b.y); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = "#FFFFFF"; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(PARK_LEFT - 20, b.y); ctx.lineTo(PARK_RIGHT + 20, b.y); ctx.stroke();
      } else if (b.kind === "blast" || b.kind === "homing") {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, "#FFFFFF"); g.addColorStop(0.4, b.color); g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      } else if (b.kind === "swords") {
        // 万剑汇聚：从四周向中心射出光剑
        ctx.strokeStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 10; ctx.lineWidth = 2;
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + this.t * 3;
          const r = b.r * (1 - alpha);
          const x1 = b.x + Math.cos(a) * b.r;
          const y1 = b.y + Math.sin(a) * b.r;
          const x2 = b.x + Math.cos(a) * r;
          const y2 = b.y + Math.sin(a) * r;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        ctx.fillStyle = "#FFFFFF"; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(b.x, b.y, 6 * alpha, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawCannon(ctx: CanvasRenderingContext2D): void {
    const od = this.overdriveActive;
    const odGlow = od ? (0.5 + Math.sin(this.t * 20) * 0.5) : 0;
    // weaponJam：红色故障闪烁
    const jammed = this.weaponJamUntil > this.t;
    const jamFlicker = jammed && Math.floor(this.t * 12) % 2 === 0;
    // 主色：weaponJam 时切红色
    const mainColor = jammed ? "#FF5A2A" : od ? "#00E5FF" : "#1AD670";

    // 过载光环：旋转蓝色光圈
    if (od) {
      ctx.save();
      ctx.translate(CANNON_X, CANNON_Y - 6);
      ctx.rotate(this.t * 2);
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 14;
      ctx.globalAlpha = 0.6 + odGlow * 0.4;
      // 4 段弧线旋转
      for (let i = 0; i < 4; i++) {
        const a0 = (i / 4) * Math.PI * 2;
        const a1 = a0 + Math.PI * 0.35;
        ctx.beginPath();
        ctx.arc(0, 0, 40 + Math.sin(this.t * 6 + i) * 4, a0, a1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 底座（透视梯形）
    ctx.save();
    const baseGrad = ctx.createLinearGradient(0, CANNON_Y, 0, GROUND_Y);
    baseGrad.addColorStop(0, jamFlicker ? "#5A2A2A" : "#4A5A6A");
    baseGrad.addColorStop(1, "#1A2A3A");
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.moveTo(CANNON_X - 44, CANNON_Y);
    ctx.lineTo(CANNON_X - 30, GROUND_Y);
    ctx.lineTo(CANNON_X + 30, GROUND_Y);
    ctx.lineTo(CANNON_X + 44, CANNON_Y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = mainColor; ctx.lineWidth = 2;
    if (od) { ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 8 + odGlow * 8; }
    if (jamFlicker) { ctx.shadowColor = "#FF5A2A"; ctx.shadowBlur = 10; }
    ctx.stroke(); ctx.shadowBlur = 0;
    // 履带轮
    ctx.fillStyle = "#0F1A28";
    ctx.beginPath(); ctx.ellipse(CANNON_X - 24, GROUND_Y - 4, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(CANNON_X + 24, GROUND_Y - 4, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = jamFlicker ? "#FF5A2A" : "#2A3A4A";
    ctx.beginPath(); ctx.arc(CANNON_X - 24, GROUND_Y - 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CANNON_X + 24, GROUND_Y - 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 炮塔本体
    ctx.save();
    ctx.translate(CANNON_X, CANNON_Y);
    const turretGrad = ctx.createLinearGradient(-26, -18, 26, 18);
    turretGrad.addColorStop(0, jamFlicker ? "#5A2A2A" : "#3A4A5A");
    turretGrad.addColorStop(0.5, "#5A6A7A");
    turretGrad.addColorStop(1, "#2A3A4A");
    ctx.fillStyle = turretGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = mainColor; ctx.lineWidth = 2;
    if (od) { ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 10 + odGlow * 8; }
    if (jamFlicker) { ctx.shadowColor = "#FF5A2A"; ctx.shadowBlur = 12; }
    ctx.stroke(); ctx.shadowBlur = 0;
    // 能量核心
    ctx.fillStyle = mainColor;
    ctx.shadowColor = mainColor; ctx.shadowBlur = 8 + Math.sin(this.t * 6) * 4;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 炮管（指向园区）
    const angle = -0.12; // 轻微上扬
    ctx.save();
    ctx.translate(CANNON_X, CANNON_Y);
    ctx.rotate(angle);
    ctx.translate(-this.cannonRecoil, 0);
    const barrelGrad = ctx.createLinearGradient(0, -8, 0, 8);
    barrelGrad.addColorStop(0, jamFlicker ? "#7A3A3A" : "#6A7A8A");
    barrelGrad.addColorStop(0.5, "#3A4A5A");
    barrelGrad.addColorStop(1, "#1A2A3A");
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(0, -8, 52, 16);
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(0, -7, 52, 3);
    // 炮口
    ctx.fillStyle = "#0A1929";
    ctx.beginPath(); ctx.ellipse(52, 0, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
    // 炮口闪光（过载时更亮更长）
    if (this.t < this.muzzleUntil) {
      const flashSize = od ? 12 : 8;
      ctx.fillStyle = od ? "#00E5FF" : "#FFD666";
      ctx.shadowColor = od ? "#00E5FF" : "#FFD666";
      ctx.shadowBlur = od ? 20 : 14;
      ctx.beginPath(); ctx.arc(56, 0, flashSize, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // 标签
    drawText(ctx, "反诈意大利炮", CANNON_X, CANNON_Y - 26, { size: 10, color: mainColor, weight: "700", align: "center", font: Theme.fonts.mono, shadow: { color: mainColor, blur: 6 } });
    if (od) {
      drawText(ctx, "OVERDRIVE", CANNON_X, CANNON_Y - 38, { size: 8, color: "#00E5FF", weight: "900", align: "center", font: Theme.fonts.mono });
    }
    if (jammed) {
      drawText(ctx, "JAMMED", CANNON_X, CANNON_Y - 38, { size: 8, color: "#FF5A2A", weight: "900", align: "center", font: Theme.fonts.mono, shadow: { color: "#FF5A2A", blur: 6 } });
    }
  }

  private drawShells(ctx: CanvasRenderingContext2D): void {
    for (const s of this.shells) {
      for (let i = 0; i < s.trail.length; i++) {
        const tp = s.trail[i];
        const a = i / s.trail.length;
        ctx.fillStyle = "#FFD666";
        ctx.globalAlpha = a * 0.5;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 2.5 * a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.overdriveActive ? "#00E5FF" : "#FFD666";
      ctx.shadowColor = this.overdriveActive ? "#00E5FF" : "#FFD666";
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // 高光
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.arc(s.x - 2, s.y - 2, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawFloats(ctx: CanvasRenderingContext2D): void {
    for (const f of this.floats) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = a;
      drawText(ctx, f.text, f.x, f.y, { size: 16, color: f.color, weight: "900", align: "center", shadow: { color: f.color, blur: 6 } });
      ctx.globalAlpha = 1;
    }
  }

  // ---- 左侧列：进度面板 + 道具栏 ----
  private drawLeftPanel(ctx: CanvasRenderingContext2D): void {
    // 列背景
    ctx.save();
    ctx.fillStyle = "rgba(10,25,41,0.55)";
    ctx.fillRect(COL_X, COL_TOP, COL_W, 512 - COL_TOP);
    ctx.strokeStyle = "rgba(255,122,26,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(COL_X, COL_TOP, COL_W, 512 - COL_TOP);
    ctx.restore();

    this.drawProgressPanel(ctx);
    this.drawItemBar(ctx);
    // 武器面板（浮于左侧列上方，y=12..70）
    this.drawWeaponPanel(ctx);
  }

  private drawProgressPanel(ctx: CanvasRenderingContext2D): void {
    const x = COL_X + 6, w = COL_W - 12;
    let y = COL_TOP + 6;
    // 波次 + 档位
    drawText(ctx, `WAVE ${this.wave}`, x, y, { size: 10, color: "#7A8FB0", weight: "700", font: Theme.fonts.mono });
    drawText(ctx, this.tier.name, x + w, y, { size: 11, color: this.tier.color, weight: "700", align: "right", font: Theme.fonts.mono });
    y += 16;
    // BOSS 名称
    drawText(ctx, `${this.bossDef.emoji} ${this.bossDef.bossName}`, x, y, { size: 10, color: this.bossEnraged ? "#FF5A60" : "#FFD666", weight: "700" });
    y += 14;
    // 园区血量（不显示具体数值，仅展示定性状态）
    const hpRatio = this.hp / this.maxHp;
    const hpLabel = hpRatio > 0.75 ? "完好" : hpRatio > 0.5 ? "受损" : hpRatio > 0.25 ? "重创" : "濒毁";
    const hpLabelColor = hpRatio > 0.75 ? "#52C41A" : hpRatio > 0.5 ? "#FFD666" : hpRatio > 0.25 ? "#FF7A1A" : "#E5353B";
    drawText(ctx, "园区血量", x, y, { size: 9, color: "#7A8FB0", weight: "500" });
    drawText(ctx, hpLabel, x + w, y, { size: 9, color: hpLabelColor, weight: "900", align: "right", font: Theme.fonts.mono });
    y += 12;
    this.bar(ctx, x, y, w, 8, this.hp / this.maxHp, "#52C41A", "#73D13D"); y += 14;

    // 本波伤害
    drawText(ctx, "本波伤害", x, y, { size: 9, color: "#7A8FB0", weight: "500" });
    drawText(ctx, this.formatNum(this.waveDamage), x + w, y, { size: 9, color: "#FFD666", weight: "700", align: "right", font: Theme.fonts.mono });
    y += 12;
    this.bar(ctx, x, y, w, 6, Math.min(1, this.waveDamage / Math.max(1, this.maxHp)), "#FF7A1A", "#FFD666"); y += 12;

    // 实时 DPS
    drawText(ctx, "实时 DPS", x, y, { size: 9, color: "#7A8FB0", weight: "500" });
    drawText(ctx, this.formatNum(this.dps), x + w, y, { size: 9, color: this.dps > this.maxDps * 0.8 ? "#00E5FF" : "#FFD666", weight: "700", align: "right", font: Theme.fonts.mono });
    y += 12;
    this.bar(ctx, x, y, w, 6, Math.min(1, this.dps / Math.max(1, this.maxDps)), "#00E5FF", "#B388FF"); y += 12;

    // 过载连击槽（保留）
    const odCol = this.overdriveActive ? "#00E5FF" : "#1AD670";
    drawText(ctx, this.overdriveActive ? "火力过载" : "过载连击", x, y, { size: 9, color: "#7A8FB0", weight: "500" });
    drawText(ctx, `${Math.round(this.overdrive)}`, x + w, y, { size: 9, color: odCol, weight: "700", align: "right", font: Theme.fonts.mono });
    y += 12;
    this.bar(ctx, x, y, w, 8, this.overdrive / OVERDRIVE_MAX, odCol, "#00E5FF"); y += 14;

    // 武器等级 + 分数（保留）
    drawText(ctx, `武器 LV${this.weaponLevel}`, x, y, { size: 10, color: ACCENT, weight: "900", font: Theme.fonts.mono, shadow: { color: ACCENT, blur: 4 } });
    drawText(ctx, `${this.score}`, x + w, y, { size: 12, color: "#FFD666", weight: "900", align: "right", font: Theme.fonts.mono, shadow: { color: "#FFD666", blur: 6 } });
    y += 14;
    // 连击 + 最高连击
    drawText(ctx, `COMBO ×${this.combo}`, x, y, { size: 9, color: this.combo > 0 ? "#FFD666" : "#4A5D7A", weight: "700", font: Theme.fonts.mono });
    drawText(ctx, `MAX ${this.maxCombo}`, x + w, y, { size: 8, color: "#7A8FB0", weight: "700", align: "right", font: Theme.fonts.mono });
    y += 12;
    // 已击破波数 + 累计伤害
    drawText(ctx, `已击破 ${this.clearedWaves} 波`, x, y, { size: 9, color: "#52C41A", weight: "700", font: Theme.fonts.mono });
    drawText(ctx, `TOTAL ${this.formatNum(this.totalDamage)}`, x + w, y, { size: 8, color: "#7A8FB0", weight: "700", align: "right", font: Theme.fonts.mono });
    y += 12;

    // debuff 标签（emoji + 名称 + 剩余秒数）
    if (this.cdLockUntil > this.t) {
      this.drawDebuffTag(ctx, x, y, w, "cdLock", this.cdLockUntil - this.t);
      y += 12;
    }
    if (this.weaponJamUntil > this.t) {
      this.drawDebuffTag(ctx, x, y, w, "weaponJam", this.weaponJamUntil - this.t);
      y += 12;
    }
    if (this.itemDisableUntil > this.t) {
      this.drawDebuffTag(ctx, x, y, w, "itemDisable", this.itemDisableUntil - this.t);
      y += 12;
    }
    if (this.visionJamUntil > this.t) {
      this.drawDebuffTag(ctx, x, y, w, "visionJam", this.visionJamUntil - this.t);
      y += 12;
    }
  }

  /** 格式化大数字（k/w） */
  private formatNum(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${Math.round(n)}`;
  }

  /** debuff 标签条 */
  private drawDebuffTag(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, debuff: CounterDebuff, remain: number): void {
    const color = DEBUFF_WARN_COLORS[debuff];
    const name = DEBUFF_NAMES[debuff];
    const emoji = DEBUFF_EMOJIS[debuff];
    const dur = this.bossDef.counterDebuffDur; // 当前 BOSS 反击 debuff 总时长（用于显示比例）
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y, w, 10);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.shadowColor = color; ctx.shadowBlur = 4;
    ctx.strokeRect(x, y, w, 10);
    ctx.shadowBlur = 0;
    ctx.restore();
    // 进度条
    const ratio = dur > 0 ? clamp(remain / dur, 0, 1) : 0;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * ratio, 10);
    drawText(ctx, `${emoji} ${name}`, x + 4, y + 5, { size: 8, color: "#FFFFFF", weight: "700", baseline: "middle", font: Theme.fonts.mono });
    drawText(ctx, `${remain.toFixed(1)}s`, x + w - 4, y + 5, { size: 8, color: "#FFFFFF", weight: "900", align: "right", baseline: "middle", font: Theme.fonts.mono });
  }

  private bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number, c1: string, c2: string, danger = false): void {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y, w, h);
    const r = clamp(ratio, 0, 1);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * r, h);
    if (danger && r > 0.7) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(this.t * 12) * 0.15})`;
      ctx.fillRect(x, y, w * r, h);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  private drawItemBar(ctx: CanvasRenderingContext2D): void {
    drawText(ctx, "道具栏 · ARSENAL", COL_X + 6, BAR_TOP - 12, { size: 9, color: "#7A8FB0", weight: "700", font: Theme.fonts.mono });
    for (let i = 0; i < ITEM_ORDER.length; i++) {
      const id = ITEM_ORDER[i];
      const def = ITEMS[id];
      const r = this.getItemSlotRect(i);
      const cd = this.cdLeft[id];
      const ready = cd <= 0 && this.phase === "fight";
      // 槽背景
      ctx.save();
      ctx.fillStyle = ready ? "rgba(255,122,26,0.14)" : "rgba(15,34,54,0.8)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = ready ? def.color : "rgba(40,60,90,0.8)";
      ctx.lineWidth = ready ? 1.5 : 1;
      if (ready) { ctx.shadowColor = def.color; ctx.shadowBlur = 6; }
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.shadowBlur = 0;
      ctx.restore();

      // emoji
      ctx.save();
      ctx.globalAlpha = ready ? 1 : 0.4;
      ctx.font = `16px ${Theme.fonts.body}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(def.emoji, r.x + 16, r.y + r.h / 2);
      ctx.restore();

      // 名称
      ctx.save();
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = ready ? def.color : "#4A5D7A";
      ctx.fillText(def.name, r.x + 32, r.y + 11);
      ctx.font = `400 8px ${Theme.fonts.mono}`;
      ctx.fillStyle = "#4A5D7A";
      ctx.fillText(def.desc, r.x + 32, r.y + 23);
      ctx.restore();

      // CD 覆盖
      if (cd > 0) {
        const ratio = clamp(cd / def.cd, 0, 1);
        ctx.fillStyle = "rgba(5,12,22,0.72)";
        ctx.fillRect(r.x, r.y, r.w, r.h * ratio);
        drawText(ctx, `${cd.toFixed(1)}`, r.x + r.w - 8, r.y + r.h / 2, { size: 10, color: "#FFD666", weight: "700", align: "right", baseline: "middle", font: Theme.fonts.mono });
      }
    }
  }

  // ============ 武器面板渲染 ============

  private drawWeaponPanel(ctx: CanvasRenderingContext2D): void {
    const px = COL_X, py = 12, pw = COL_W, ph = 58;
    // 背景面板
    ctx.save();
    ctx.fillStyle = "rgba(10,25,41,0.55)";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "rgba(255,122,26,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);
    ctx.restore();
    // 标题
    drawText(ctx, "武器 · WEAPON [点击切换]", px + 6, py + 8, { size: 8, color: "#7A8FB0", weight: "700", font: Theme.fonts.mono });
    // 4 个武器按钮
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      const kind = WEAPON_ORDER[i];
      const def = WEAPONS[kind];
      const r = this.getWeaponSlotRect(i);
      const active = this.weapon === kind;
      const ammo = kind === "standard" ? -1 : this.weaponAmmo[kind];
      const hasAmmo = ammo === -1 || ammo > 0;
      // 槽背景
      ctx.save();
      ctx.fillStyle = active ? "rgba(255,122,26,0.18)" : "rgba(15,34,54,0.8)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = active ? def.color : "rgba(40,60,90,0.8)";
      ctx.lineWidth = active ? 1.5 : 1;
      if (active) { ctx.shadowColor = def.color; ctx.shadowBlur = 6; }
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.shadowBlur = 0;
      ctx.restore();
      // emoji
      ctx.save();
      ctx.globalAlpha = hasAmmo ? 1 : 0.35;
      ctx.font = `14px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.emoji, r.x + r.w / 2, r.y + 11);
      ctx.restore();
      // 弹药数
      const ammoText = ammo === -1 ? "∞" : `${ammo}`;
      drawText(ctx, ammoText, r.x + r.w / 2, r.y + 25, {
        size: 9,
        color: ammo === 0 ? "#E5353B" : active ? def.color : "#7A8FB0",
        weight: "700", align: "center", font: Theme.fonts.mono,
      });
    }
  }

  // ============ 树木系统 ============

  /** 检测坐标是否命中存活树木 */
  private hitTestTree(x: number, y: number): TreeDef | null {
    for (const t of this.trees) {
      if (!t.alive) continue;
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy < TREE_RADIUS * TREE_RADIUS) return t;
    }
    return null;
  }

  /** 对树木造成伤害 */
  private damageTree(tree: TreeDef, dmg: number): void {
    if (!tree.alive) return;
    tree.hp -= dmg;
    tree.shake = 0.3;
    if (tree.hp <= 0) {
      tree.hp = 0;
      tree.alive = false;
      // 树木倒下：绿色 + 棕色 debris 爆裂
      this.particles.spawnBurst(tree.x, tree.y, "#52C41A", { ring: true, sparks: 10, dots: 14, speed: 180, life: 0.8, size: 4, color2: "#8B4513" });
      this.particles.spawn({ x: tree.x, y: tree.y, count: 12, speed: 140, life: 1.0, size: 5, color: "#5A3520", type: "debris", gravity: 420, friction: 0.96 });
      playSfx("hit");
    }
  }

  /** 树木动画更新（摇晃衰减） */
  private updateTrees(dt: number): void {
    for (const t of this.trees) {
      if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);
    }
  }

  /** 渲染树木 */
  private drawTrees(ctx: CanvasRenderingContext2D): void {
    for (const t of this.trees) {
      if (!t.alive) continue;
      const hpRatio = t.hp / t.maxHp;
      const shakeX = t.shake > 0 ? (Math.random() - 0.5) * 4 : 0;
      const x = t.x + shakeX;
      const y = t.y;
      // 阴影
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(t.x, y + 18, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // 树干
      ctx.fillStyle = "#5A3520";
      ctx.fillRect(x - 3, y, 6, 18);
      // 树冠（颜色随 hp 变化：绿 → 黄 → 红）
      const canopyColor = hpRatio > 0.5 ? "#2E7D32" : hpRatio > 0.25 ? "#FFB020" : "#E5353B";
      ctx.save();
      ctx.fillStyle = canopyColor;
      ctx.shadowColor = canopyColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y - 4, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // 内层亮色高光
      ctx.fillStyle = this.shade(canopyColor, 1.3);
      ctx.beginPath();
      ctx.arc(x - 3, y - 7, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ============ 地图切换覆盖 ============

  private drawMapTransition(ctx: CanvasRenderingContext2D): void {
    if (this.mapTransitionT <= 0) return;
    const progress = 1 - this.mapTransitionT / MAP_TRANSITION_DURATION; // 0..1
    const alpha = Math.sin(progress * Math.PI) * 0.6; // 淡入淡出
    ctx.save();
    ctx.fillStyle = `rgba(10,25,41,${alpha})`;
    ctx.fillRect(0, 0, W, H);
    // 地图名称居中
    const cx = W / 2;
    const cy = H / 2;
    drawText(ctx, `${this.currentMap.emoji} ${this.currentMap.name}`, cx, cy, {
      size: 24, color: "#52C41A", weight: "900", align: "center", baseline: "middle",
      shadow: { color: "#52C41A", blur: 12 },
    });
    drawText(ctx, "地图切换中...", cx, cy + 28, {
      size: 12, color: "#7A8FB0", weight: "500", align: "center", baseline: "middle",
    });
    ctx.restore();
  }

  // 颜色明暗工具
  // shade 是纯函数，模块级缓存避免每帧重复 parseInt/toString（drawWindows/drawTrees 等热循环每帧上百次调用）
  private shade(hex: string, factor: number): string {
    const key = hex + "|" + factor;
    const cached = _shadeCache.get(key);
    if (cached !== undefined) return cached;
    const h = hex.replace("#", "");
    if (h.length !== 6) return hex;
    const r = clamp(Math.round(parseInt(h.slice(0, 2), 16) * factor), 0, 255);
    const g = clamp(Math.round(parseInt(h.slice(2, 4), 16) * factor), 0, 255);
    const b = clamp(Math.round(parseInt(h.slice(4, 6), 16) * factor), 0, 255);
    const result = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    _shadeCache.set(key, result);
    return result;
  }
}
