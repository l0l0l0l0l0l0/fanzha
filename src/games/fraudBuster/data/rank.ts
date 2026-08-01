import type { FBLocalRankEntry } from "../types";

// ============ v4 升级：本地排行榜（无后端，NPC 模拟） ============

/**
 * 本地排行榜 NPC 假数据：预置 15 个 NPC，营造竞争氛围。
 * 玩家分数插入后按分数排序，NPC 分数固定（不随时间变化）。
 * NPC 名字使用反诈主题化命名，避免真实人名。
 */
export const LOCAL_RANK_NPC: Omit<FBLocalRankEntry, "rank">[] = [
  { name: "反诈先锋·李探长", isPlayer: false, score: 58200, rankName: "反诈宗师", rankIcon: "🌟", gameMode: "endless", date: "2026-07-25", perfect: true },
  { name: "识诈达人·王警官", isPlayer: false, score: 52100, rankName: "反诈大师", rankIcon: "👑", gameMode: "endless", date: "2026-07-24", perfect: false },
  { name: "反诈尖兵·张同学", isPlayer: false, score: 47800, rankName: "反诈大师", rankIcon: "👑", gameMode: "speedrun", date: "2026-07-26", perfect: false },
  { name: "反诈精英·陈师傅", isPlayer: false, score: 42500, rankName: "反诈专家", rankIcon: "🏅", gameMode: "endless", date: "2026-07-23", perfect: false },
  { name: "反诈老兵·刘大爷", isPlayer: false, score: 38900, rankName: "反诈专家", rankIcon: "🏅", gameMode: "endless", date: "2026-07-22", perfect: false },
  { name: "识诈高手·赵阿姨", isPlayer: false, score: 34200, rankName: "反诈精英", rankIcon: "🎖️", gameMode: "daily", date: "2026-07-26", perfect: false },
  { name: "反诈新兵·小明", isPlayer: false, score: 28500, rankName: "反诈精英", rankIcon: "🎖️", gameMode: "endless", date: "2026-07-25", perfect: false },
  { name: "反诈战士·大壮", isPlayer: false, score: 23800, rankName: "反诈尖兵", rankIcon: "⚔️", gameMode: "hardcore", date: "2026-07-24", perfect: false },
  { name: "识诈能手·小红", isPlayer: false, score: 19200, rankName: "反诈尖兵", rankIcon: "⚔️", gameMode: "endless", date: "2026-07-23", perfect: false },
  { name: "反诈学徒·阿强", isPlayer: false, score: 15600, rankName: "反诈新兵", rankIcon: "🛡️", gameMode: "endless", date: "2026-07-22", perfect: false },
  { name: "反诈新人·小李", isPlayer: false, score: 12300, rankName: "反诈新兵", rankIcon: "🛡️", gameMode: "daily", date: "2026-07-26", perfect: false },
  { name: "识诈学徒·小王", isPlayer: false, score: 9800, rankName: "见习", rankIcon: "🔰", gameMode: "endless", date: "2026-07-21", perfect: false },
  { name: "反诈萌新·小张", isPlayer: false, score: 6500, rankName: "见习", rankIcon: "🔰", gameMode: "endless", date: "2026-07-20", perfect: false },
  { name: "识诈新人·小陈", isPlayer: false, score: 4200, rankName: "学徒", rankIcon: "📘", gameMode: "endless", date: "2026-07-19", perfect: false },
  { name: "反诈小白·小赵", isPlayer: false, score: 2800, rankName: "学徒", rankIcon: "📘", gameMode: "endless", date: "2026-07-18", perfect: false },
];

/** 生成本地排行榜（NPC + 玩家自己，按分数降序，取前 20） */
export function buildLocalRank(playerEntry: Omit<FBLocalRankEntry, "rank">): FBLocalRankEntry[] {
  const all = [...LOCAL_RANK_NPC, playerEntry];
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, 20).map((e, i) => ({ ...e, rank: i + 1 }));
}
