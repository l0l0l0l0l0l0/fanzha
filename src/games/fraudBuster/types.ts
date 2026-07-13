export interface FBState {
  wave: number;
  score: number;
  combo: number;
  maxCombo: number;
  shield: number;
  busted: number;
  unlockedTypes: string[];
}

export interface FBCard {
  sceneId: string;
  typeId: string;
  type: string;
  cardType: "chat" | "call" | "transfer" | "popup" | "sms" | "video";
  title: string;
  body: string;
  isFraud: boolean;
  cues: string[];
  explain: string;
  source: string;
  // 引擎运行时
  spawnTs: number;
  duration: number;
  entered: number; // 0->1 入场动画
  exited: number; // 0->1 出场动画
  state: "in" | "show" | "out";
  verdict: "fraud" | "pass" | null;
  judged: boolean;
}
