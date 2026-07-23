export type WeaponLevel = 1 | 2 | 3 | 4;

/** 武器分支类型（新增）：normal=未选择, spread=散射, laser=激光, homing=追踪 */
export type WeaponBranch = "normal" | "spread" | "laser" | "homing";

/** 武器分支等级（新增）：0=未选择, 1-3=等级 */
export type WeaponBranchLevel = 0 | 1 | 2 | 3;

/** 武器分支定义（新增） */
export interface WeaponBranchDef {
  id: WeaponBranch;
  name: string;
  emoji: string;
  color: string;
  desc: string;
}

/** BOSS 攻击模式 */
export type BossAttackPattern =
  | "spread"      // 扇形散射
  | "spiral"      // 螺旋弹幕
  | "rain"        // 区域弹雨
  | "beam"        // 集束光束
  | "summon"      // 召唤小怪
  | "homing"      // 追踪弹
  | "laserSweep"; // 激光扫射（新增）

/**
 * 特色电诈 BOSS 定义
 * 每个 BOSS 代表一种典型电诈类型，拥有独特形象、攻击模式与反诈知识点
 */
export interface BossDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  color: string;
  fraudType: string;
  /** 攻击模式组合（按阶段轮换） */
  patterns: BossAttackPattern[];
  /** 移动速度倍率 */
  speedMul: number;
  /** 召唤小怪 typeId */
  summonType?: string;
  /** 反诈识破要点 */
  identify: string[];
  /** 是否终极 BOSS */
  ultimate?: boolean;
  /** 外观形状 */
  shape: "hex" | "skull" | "crown" | "eye" | "tower";
}

/**
 * 反诈道具（强力工具）
 * - antifraudApp：国家反诈APP（盾牌形象），可吸收多次伤害
 * - blockOverseas：不接境外来电，持续秒数内免疫敌方弹幕
 * - policeRaid：公安反诈突击，全屏清场 + 重创敌方
 * - smsFirewall：短信防火墙，摧毁敌方子弹并反击
 * - evidenceLock：证据固定，冻结全场敌方 3s
 * - fraudAwareness：反诈意识觉醒，临时火力顶档 + 双倍伤害
 * - weapon：火力升级
 * - lifePack：生命补给（回复 HP）
 * - phish：钓鱼链接陷阱（降级武器）
 * - hotline96110：96110反诈热线，3秒全屏净化所有敌方弹幕+锁定最强敌人
 * - bankFreeze：银行紧急止付，5秒内敌方所有伤害减半+持续扣敌方血
 * - awarenessAd：反诈宣传员，8秒内连击不掉+自动拾取道具
 * - timeSlow：时间减速（新增），3 秒内敌方/弹幕全部减速 70%
 */
export type PowerupKind =
  | "weapon"
  | "antifraudApp"
  | "blockOverseas"
  | "policeRaid"
  | "smsFirewall"
  | "evidenceLock"
  | "fraudAwareness"
  | "lifePack"
  | "phish" // 钓鱼链接 - 陷阱
  | "hotline96110"
  | "bankFreeze"
  | "awarenessAd"
  | "timeSlow"; // 时间减速（新增）

export interface PowerupDef {
  kind: PowerupKind;
  emoji: string;
  color: string;
  label: string;
  desc: string;
  trap?: boolean;
}

export interface EnemyTypeDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  score: number;
  color: string;
  fraudType: string;
  pattern: "straight" | "zigzag" | "shooter" | "miner";
  shootInterval?: number;
  dropRate?: number;
  /** 护盾值：先破盾再扣血（新增） */
  shield?: number;
  /** 是否精英敌人（更大、更亮光环） */
  elite?: boolean;
}

export interface WaveEntry {
  typeId: string;
  count: number;
  interval: number;
  delay: number;
}

/** 称号体系：随积分晋升的荣誉称号 */
export interface Title {
  id: string;
  name: string;
  minScore: number;
  color: string;
}

export const MAX_HP = 36;
/** 每个铜元宝代表的 HP（36 / 4 = 9 个元宝） */
export const HP_PER_YUANBAO = 4;

export interface ThunderHud {
  hp: number;
  maxHp: number;
  shield: boolean;
  /** 国家反诈APP 护盾剩余吸收次数 */
  appCharges: number;
  /** 不接境外来电：剩余免疫秒数 */
  overseasUntil: number;
  /** 反诈意识觉醒：剩余秒数（>0 时火力顶档 + 双倍伤害） */
  awarenessUntil: number;
  /** 证据固定：剩余冻结秒数 */
  freezeUntil: number;
  /** 96110热线：剩余净化秒数 */
  hotlineUntil: number;
  /** 银行止付：剩余减伤秒数 */
  bankFreezeUntil: number;
  /** 反诈宣传员：剩余秒数 */
  adUntil: number;
  /** 时间减速：剩余秒数（新增） */
  slowMoUntil: number;
  raids: number;
  score: number;
  /** 当前称号 */
  titleName: string;
  titleColor: string;
  /** 下一称号还需多少分（无下一档时为 0） */
  nextTitleGap: number;
  combo: number;
  weapon: WeaponLevel;
  /** 武器经验（0..xpMax，满则自动升级，新增） */
  weaponXp: number;
  /** 武器升级所需经验（新增） */
  weaponXpMax: number;
  /** 分数倍率（基于 combo，新增） */
  scoreMultiplier: number;
  /** 武器分支（新增）：normal/spread/laser/homing */
  weaponBranch?: string;
  /** 武器分支等级（新增）：0-3 */
  weaponBranchLevel?: number;
  phase: "battle" | "boss" | "branch" | "won" | "lost";
  bossHp?: number;
  bossMax?: number;
  bossPhase?: number;
  /** 当前 BOSS 名称 */
  bossName?: string;
  /** 当前 BOSS 诈骗类型 */
  bossFraudType?: string;
  /** BOSS 是否狂暴（HP < 30%，新增） */
  bossEnraged?: boolean;
  wave: number;
  totalWaves: number;
  /** 阶段切换动画剩余秒数（>0 时显示全屏 overlay，新增） */
  phaseTransitionUntil?: number;
  /** 阶段切换文字（如 "PHASE 2/3"，新增） */
  phaseTransitionText?: string;
  /** 成就解锁提示（一次性，新增） */
  achievement?: { name: string; desc: string; emoji: string };
  /** 分支选择：当 phase === "branch" 时输出的 3 个增援选项 */
  branchOptions?: BranchOption[];
  /** 分支选择阶段：当前关卡序号（用于显示 "第 N 波增援"） */
  branchWave?: number;
}

/** 分支增援选项 */
export interface BranchOption {
  id: "weapon" | "shield" | "tactical";
  emoji: string;
  title: string;
  desc: string;
  color: string;
}
