export type GameId = "fraud-buster" | "manager" | "thunder" | "bomb-island";

export interface GameMeta {
  id: GameId;
  title: string;
  subtitle: string;
  tagline: string;
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  accent: string;
  accentSoft: string;
  icon: string;
  cover: "phone" | "tactic" | "ship" | "bomb";
  description: string;
  briefing: {
    type: string;
    points: string[];
    hotline: string;
  };
}

export type FraudTypeId =
  | "F01"
  | "F02"
  | "F03"
  | "F04"
  | "F05"
  | "F06"
  | "F07"
  | "F08"
  | "F09"
  | "F10"
  | "F11"
  | "F12";

export interface FraudScene {
  id: string;
  typeId: FraudTypeId;
  type: string;
  difficulty: 1 | 2 | 3 | 4;
  isFraud: boolean;
  cardType: "chat" | "call" | "transfer" | "popup" | "sms" | "video";
  title: string;
  body: string;
  extra?: string[];
  cues?: string[];
  explain: string;
  source: string;
}

export interface CodexEntry {
  typeId: FraudTypeId;
  name: string;
  icon: string;
  catchphrase: string;
  points: string[];
  response: string;
  source: string;
}

export interface AntiFraudTip {
  id: string;
  title: string;
  body: string;
  source: string;
}

export type GameEvent =
  | { type: "score"; score: number }
  | { type: "wave"; wave: number }
  | { type: "combo"; combo: number }
  | { type: "shield"; shield: number }
  | { type: "lives"; lives: number }
  | { type: "hud"; payload: Record<string, string | number> }
  | { type: "toast"; text: string; tone: "good" | "bad" | "info" }
  | { type: "result"; payload: GameResultPayload }
  | { type: "log"; text: string };

export interface GameResultPayload {
  gameId: GameId;
  win: boolean;
  score: number;
  wave?: number;
  bustedCount?: number;
  destroyRate?: number;
  tipId: string;
}
