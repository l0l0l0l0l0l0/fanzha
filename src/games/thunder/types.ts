export type WeaponLevel = 1 | 2 | 3 | 4;

export type PowerupKind =
  | "weapon"
  | "shield"
  | "bomb"
  | "life"
  | "clear"
  | "phish"; // 钓鱼链接 - 陷阱

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
}

export interface WaveEntry {
  typeId: string;
  count: number;
  interval: number;
  delay: number;
}

export interface ThunderHud {
  lives: number;
  shield: boolean;
  bombs: number;
  score: number;
  combo: number;
  weapon: WeaponLevel;
  phase: "battle" | "boss" | "won" | "lost";
  bossHp?: number;
  bossMax?: number;
  bossPhase?: number;
  wave: number;
  totalWaves: number;
}
