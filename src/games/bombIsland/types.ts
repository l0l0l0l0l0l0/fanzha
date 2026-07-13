export type WeaponId = "basic" | "fire" | "bunker" | "cluster";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  emoji: string;
  color: string;
  desc: string;
  damage: number;
  blastRadius: number;
  splash?: number;
  pierce?: boolean;
  burn?: number; // burn dps for 2s
  split?: number; // cluster split count
  unlocked: boolean;
}

export interface BuildingDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  score: number;
  color: string;
  fraudType: string;
  w: number;
  h: number;
  armored?: boolean; // reduces damage
  bonus?: number; // bonus score for hitting server
}

export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  terrain: "easy" | "hills" | "fortress";
  ammo: number;
  buildings: { typeId: string; x: number; y: number }[];
  unlockWeapon?: WeaponId;
  briefing: string;
  fraudSummary: string;
}

export interface BombHud {
  level: number;
  totalLevels: number;
  ammo: number;
  score: number;
  weapon: WeaponId;
  buildingsLeft: number;
  buildingsTotal: number;
  destroyRate: number;
  phase: "aim" | "fire" | "won" | "lost";
  currentWeapon: WeaponDef;
  unlocked: WeaponId[];
}
