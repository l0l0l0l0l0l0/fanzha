import type { FraudScene } from "@/types";
import { FRAUD_SCENES } from "@/data/fraudScenes";

export interface FBCardData {
  sceneId: string;
  typeId: string;
  type: string;
  cardType: FraudScene["cardType"];
  title: string;
  body: string;
  isFraud: boolean;
  cues: string[];
  explain: string;
  source: string;
}

export const FB_CARDS: FBCardData[] = FRAUD_SCENES.map((s) => ({
  sceneId: s.id,
  typeId: s.typeId,
  type: s.type,
  cardType: s.cardType,
  title: s.title,
  body: s.body,
  isFraud: s.isFraud,
  cues: s.cues ?? [],
  explain: s.explain,
  source: s.source,
}));

export interface WaveConfig {
  cardInterval: number;
  duration: number;
  disturbRate: number;
  maxDiff: number;
}

export function waveConfig(wave: number): WaveConfig {
  if (wave <= 10) return { cardInterval: 2.2, duration: 4.0, disturbRate: 0.05, maxDiff: 2 };
  if (wave <= 25) return { cardInterval: 1.6, duration: 3.0, disturbRate: 0.15, maxDiff: 2 };
  if (wave <= 50) return { cardInterval: 1.2, duration: 2.2, disturbRate: 0.25, maxDiff: 3 };
  return { cardInterval: 0.9, duration: 1.6, disturbRate: 0.30, maxDiff: 4 };
}

export function pickCard(wave: number, usedIds: Set<string>): FBCardData {
  const cfg = waveConfig(wave);
  const wantFraud = Math.random() > cfg.disturbRate;
  const pool = FB_CARDS.filter(
    (c) =>
      !usedIds.has(c.sceneId) &&
      c.isFraud === wantFraud &&
      // 简单难度阶梯
      (wave <= 10 ? c.typeId !== "F11" && c.typeId !== "F05" : true)
  );
  const full = pool.length > 0 ? pool : FB_CARDS.filter((c) => !usedIds.has(c.sceneId) && c.isFraud === wantFraud);
  const list = full.length > 0 ? full : FB_CARDS;
  return list[Math.floor(Math.random() * list.length)];
}

export function rankByWave(wave: number): string {
  if (wave >= 100) return "反诈之神";
  if (wave >= 80) return "反诈教头";
  if (wave >= 50) return "反诈达人";
  if (wave >= 30) return "是男人";
  if (wave >= 10) return "略有警觉";
  return "反诈小白";
}
