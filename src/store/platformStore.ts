/**
 * 平台状态管理（模块单例 + tt 存储）
 * 替代 Zustand + localStorage 的 usePlatformStore.ts
 */
import { getStorageSync, setStorageSync } from "@/platform/web";
import type { GameId } from "@/types";

export type Rank =
  | "反诈小白"
  | "略有警觉"
  | "是男人"
  | "反诈达人"
  | "反诈教头"
  | "反诈之神";

interface PlatformState {
  totalFoolsBusted: number;
  totalPlayTimeSec: number;
  unlockedCodex: string[];
  bestScores: Record<GameId, number>;
  totalGames: number;
  settings: { sound: boolean; haptics: boolean };
}

const STORAGE_KEY = "anti-fraud-platform";

const defaultState: PlatformState = {
  totalFoolsBusted: 0,
  totalPlayTimeSec: 0,
  unlockedCodex: [],
  bestScores: {
    "fraud-buster": 0,
    manager: 0,
    thunder: 0,
    "bomb-island": 0,
  },
  totalGames: 0,
  settings: { sound: true, haptics: true },
};

function rankFromBusted(n: number): Rank {
  if (n >= 500) return "反诈之神";
  if (n >= 200) return "反诈教头";
  if (n >= 100) return "反诈达人";
  if (n >= 50) return "是男人";
  if (n >= 10) return "略有警觉";
  return "反诈小白";
}

class PlatformStore {
  state: PlatformState = JSON.parse(JSON.stringify(defaultState));
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    const saved = getStorageSync(STORAGE_KEY) as Partial<PlatformState> | null;
    if (saved && typeof saved === "object") {
      this.state = {
        ...defaultState,
        ...saved,
        bestScores: { ...defaultState.bestScores, ...(saved.bestScores || {}) },
        settings: { ...defaultState.settings, ...(saved.settings || {}) },
        unlockedCodex: Array.isArray(saved.unlockedCodex) ? saved.unlockedCodex : [],
      };
    }
    this.loaded = true;
  }

  private save(): void {
    setStorageSync(STORAGE_KEY, this.state);
  }

  recordGame(data: {
    gameId: GameId;
    score: number;
    busted?: number;
    unlockedTypes?: string[];
    durationSec: number;
  }): void {
    const { gameId, score, busted = 0, unlockedTypes = [], durationSec } = data;
    const best = Math.max(this.state.bestScores[gameId] || 0, score);
    const merged = Array.from(new Set([...this.state.unlockedCodex, ...unlockedTypes]));
    this.state = {
      ...this.state,
      totalFoolsBusted: this.state.totalFoolsBusted + busted,
      totalPlayTimeSec: this.state.totalPlayTimeSec + durationSec,
      unlockedCodex: merged,
      bestScores: { ...this.state.bestScores, [gameId]: best },
      totalGames: this.state.totalGames + 1,
    };
    this.save();
  }

  toggleSound(): void {
    this.state.settings = { ...this.state.settings, sound: !this.state.settings.sound };
    this.save();
  }

  toggleHaptics(): void {
    this.state.settings = { ...this.state.settings, haptics: !this.state.settings.haptics };
    this.save();
  }

  resetProgress(): void {
    this.state = { ...defaultState, settings: this.state.settings };
    this.save();
  }

  rank(): Rank {
    return rankFromBusted(this.state.totalFoolsBusted);
  }
}

export const platformStore = new PlatformStore();
