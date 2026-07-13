import type { EnemyTypeDef, PowerupDef, WaveEntry, PowerupKind } from "./types";

export const ENEMIES: Record<string, EnemyTypeDef> = {
  script: {
    id: "script",
    name: "话术弹幕",
    emoji: "💬",
    hp: 20,
    speed: 120,
    score: 60,
    color: "#9FE3FF",
    fraudType: "话术脚本诈骗",
    pattern: "straight",
    dropRate: 0.18,
  },
  fakecs: {
    id: "fakecs",
    name: "假客服",
    emoji: "🎧",
    hp: 35,
    speed: 90,
    score: 100,
    color: "#FFB020",
    fraudType: "冒充客服诈骗",
    pattern: "zigzag",
    dropRate: 0.22,
  },
  threat: {
    id: "threat",
    name: "恐吓信",
    emoji: "📜",
    hp: 60,
    speed: 60,
    score: 160,
    color: "#E5353B",
    fraudType: "冒充公检法",
    pattern: "shooter",
    shootInterval: 1.8,
    dropRate: 0.3,
  },
  phishmine: {
    id: "phishmine",
    name: "钓鱼雷",
    emoji: "🎣",
    hp: 40,
    speed: 70,
    score: 140,
    color: "#1AD670",
    fraudType: "钓鱼链接",
    pattern: "miner",
    shootInterval: 2.4,
    dropRate: 0.25,
  },
};

export const WAVES: WaveEntry[][] = [
  // Wave 1
  [
    { typeId: "script", count: 6, interval: 0.8, delay: 0 },
    { typeId: "fakecs", count: 3, interval: 1.4, delay: 3 },
  ],
  // Wave 2
  [
    { typeId: "script", count: 5, interval: 0.7, delay: 0 },
    { typeId: "phishmine", count: 3, interval: 1.3, delay: 2 },
    { typeId: "fakecs", count: 4, interval: 1.0, delay: 5 },
  ],
  // Wave 3
  [
    { typeId: "fakecs", count: 4, interval: 0.9, delay: 0 },
    { typeId: "threat", count: 3, interval: 1.4, delay: 2 },
    { typeId: "phishmine", count: 3, interval: 1.2, delay: 4 },
    { typeId: "script", count: 6, interval: 0.6, delay: 6 },
  ],
];

export const POWERUPS: Record<PowerupKind, PowerupDef> = {
  weapon: { kind: "weapon", emoji: "⚡", color: "#FFD666", label: "武器升级", desc: "火力 +1（最高 4 级）" },
  shield: { kind: "shield", emoji: "🛡", color: "#00E5FF", label: "护盾激活", desc: "吸收下一次伤害" },
  bomb: { kind: "bomb", emoji: "💣", color: "#FF7A1A", label: "炸弹+1", desc: "双击或点击炸弹按钮释放" },
  life: { kind: "life", emoji: "❤", color: "#E5353B", label: "生命+1", desc: "额外复活机会" },
  clear: { kind: "clear", emoji: "✨", color: "#B388FF", label: "全屏清场", desc: "瞬间清空所有敌人弹幕" },
  phish: { kind: "phish", emoji: "🎣", color: "#1AD670", label: "钓鱼链接", desc: "陷阱！武器降级", trap: true },
};

export const BOSS = {
  name: "假警察局长",
  emoji: "👮",
  hp: 800,
  color: "#E5353B",
  fraudType: "冒充公检法诈骗",
  identify: [
    "真警察绝不会电话要求转账到「安全账户」",
    "公检法不会通过 QQ/微信发送「逮捕令」",
    "要求视频讯问、屏幕共享的都是假冒",
  ],
};
