export interface AgentDef {
  id: string;
  name: string;
  role: string;
  emoji: string;
  hp: number;
  attack: number;
  range: number;
  fireRate: number;
  projectileSpeed: number;
  color: string;
  ult: string;
  ultDesc: string;
  splash?: number;
  slow?: number;
  crit?: number;
  bio: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  damage: number;
  reward: number;
  color: string;
  fraudType: string;
  heal?: number;
}

export interface WaveEntry {
  typeId: string;
  count: number;
  interval: number;
  lane: number; // 0/1/2
  delay: number;
}

export interface Wave {
  enemies: WaveEntry[];
}

export type ManagerPhase = "deploy" | "battle" | "won" | "lost";

export interface DeploySlot {
  row: number; // 0..2
  col: number; // 0..2
  agentId: string | null;
}

export interface ManagerHud {
  phase: ManagerPhase;
  baseHp: number;
  baseMax: number;
  wave: number;
  totalWaves: number;
  score: number;
  enemiesLeft: number;
  energy: number; // 0..100
  ultReady: boolean;
  agents: { id: string; hp: number; maxHp: number; alive: boolean }[];
  waveProgress: number;
}
