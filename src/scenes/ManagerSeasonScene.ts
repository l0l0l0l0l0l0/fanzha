/**
 * 「反诈职业经理人」赛季 + 周常任务面板（v6 Phase 3.3）
 * 横屏 Canvas UI：当前赛季段位 + 段位阶梯 + 周常任务列表
 * - 顶部：返回 + 标题 + 赛季编号 / 起始日期
 * - 左侧：当前段位卡 + 段位进度条 + 段位阶梯列表（10 阶）
 * - 右侧：周常任务列表（6 项），显示目标 / 奖励 / 进度 / 领取按钮
 *
 * 注：前端 localStorage 模拟，无后端。周常"进度"基于 platformStore 的累计统计派生
 * （实际产品中应由后端按周重置；此处用累计值作为可领取判定依据）
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawProgressBar, drawScanlineOverlay,
  drawNeonCorners, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import {
  WEEKLY_QUESTS, SEASON_RANKS, seasonRankFromScore,
} from "@/games/manager/data";
import { generateLeaderboard } from "@/games/manager/data.v7";
import type { SeasonRank, WeeklyQuest, LeaderboardEntry } from "@/games/manager/types";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";

export class ManagerSeasonScene extends Scene {
  private pressedButton: string | null = null;
  /** 待确认领取的任务 id */
  private pendingClaimId: string | null = null;
  private t = 0;
  /** v7：右侧面板视图模式 — 周常任务 / 排行榜 */
  private viewMode: "quests" | "leaderboard" = "quests";
  /** v7：排行榜标签 — 每日 / 每周 / 赛季 */
  private leaderboardTab: "daily" | "weekly" | "season" = "daily";

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.pendingClaimId = null;
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
  }

  // ====================================================================
  // 布局
  // ====================================================================

  private getBackBtnRect(): Rect {
    return { x: 8, y: 8, w: 56, h: 32 };
  }

  /** 左侧面板：段位信息 */
  private getLeftPanelRect(screenW: number, screenH: number): Rect {
    const panelW = Math.min(420, screenW * 0.42);
    return { x: 16, y: 56, w: panelW, h: screenH - 72 };
  }

  /** 右侧面板：周常任务 */
  private getRightPanelRect(screenW: number, screenH: number): Rect {
    const left = this.getLeftPanelRect(screenW, screenH);
    const panelW = screenW - left.x - left.w - 16 - 16;
    return { x: left.x + left.w + 16, y: 56, w: panelW, h: screenH - 72 };
  }

  /** 周常任务项矩形（在右侧面板内） */
  private getQuestItemRect(idx: number, screenW: number, screenH: number): Rect {
    const panel = this.getRightPanelRect(screenW, screenH);
    const padding = 16;
    const itemH = 72;
    const itemGap = 8;
    // v7：视图标签行占 28px，headerH 从 32 → 60
    const headerH = 60;
    return {
      x: panel.x + padding,
      y: panel.y + headerH + 8 + idx * (itemH + itemGap),
      w: panel.w - padding * 2,
      h: itemH,
    };
  }

  /** 任务领取按钮矩形 */
  private getClaimBtnRect(idx: number, screenW: number, screenH: number): Rect {
    const item = this.getQuestItemRect(idx, screenW, screenH);
    const btnW = 72;
    const btnH = 28;
    return { x: item.x + item.w - btnW - 8, y: item.y + item.h / 2 - btnH / 2, w: btnW, h: btnH };
  }

  /** 确认弹窗 */
  private getConfirmRect(screenW: number, screenH: number): Rect {
    const w = Math.min(380, screenW - 64);
    const h = 170;
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
  }

  // ====================================================================
  // 数据派生：周常任务进度
  // ====================================================================

  /** 根据累计统计派生任务进度（前端模拟，无后端按周重置） */
  private getQuestProgress(quest: WeeklyQuest): { progress: number; claimed: boolean; canClaim: boolean } {
    const meta = platformStore.managerMetaProgress();
    const progression = platformStore.managerProgress();
    const claimed = meta.weeklyCompleted.includes(quest.id);
    let progress = 0;
    switch (quest.id) {
      case "wq_play_5":
        progress = platformStore.state.totalGames;
        break;
      case "wq_kill_200":
        progress = meta.totalKills;
        break;
      case "wq_boss_3":
        progress = meta.totalBossKills;
        break;
      case "wq_tower_10":
        progress = meta.towerMaxFloor;
        break;
      case "wq_quiz_10":
        progress = meta.quizCorrectCount;
        break;
      case "wq_combo_30":
        // 无独立追踪字段，用累计 BOSS 击杀 + 答题对数估算
        progress = Math.max(meta.totalBossKills * 5, meta.quizCorrectCount * 3);
        break;
      default:
        progress = 0;
    }
    const canClaim = !claimed && progress >= quest.target;
    return { progress: Math.min(progress, quest.target), claimed, canClaim };
  }

  // ====================================================================
  // 渲染
  // ====================================================================

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);

    // 顶部导航条
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 41, 0.85)";
    ctx.fillRect(0, 0, screenW, 48);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, 47, screenW, 1);
    ctx.restore();

    // 返回按钮
    const backBtn = this.getBackBtnRect();
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 12, backBtn.y + 8, 16, Theme.colors.ink.muted);

    // 标题
    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.accents.manager;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(Theme.accents.manager, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("反诈档案 · 赛季中心", screenW / 2, 24);
    ctx.restore();

    // 左侧：段位信息
    this.renderRankPanel(ctx, screenW, screenH);

    // v7：右侧视图切换标签（周常任务 / 排行榜）
    this.renderViewTabs(ctx, screenW, screenH);

    // 右侧：周常任务 / 排行榜
    if (this.viewMode === "quests") {
      this.renderQuestPanel(ctx, screenW, screenH);
    } else {
      this.renderLeaderboardPanel(ctx, screenW, screenH);
    }

    // 确认弹窗
    if (this.pendingClaimId) {
      this.renderConfirm(ctx, screenW, screenH);
    }

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderRankPanel(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const panel = this.getLeftPanelRect(screenW, screenH);
    const meta = platformStore.managerMetaProgress();
    const accent = "#9D6BFF";
    drawPanel(ctx, panel.x, panel.y, panel.w, panel.h, {
      bgColor: withAlpha(accent, 0.04),
      borderColor: withAlpha(accent, 0.35),
      borderWidth: 1,
    });

    // 面板标题
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 4;
    ctx.fillText(`🏆 赛季 ${meta.seasonNumber} · 段位中心`, panel.x + 16, panel.y + 12);
    ctx.shadowBlur = 0;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`// SEASON ${meta.seasonNumber} · 起始 ${meta.seasonStartDate || "—"}`, panel.x + 16, panel.y + 30);
    ctx.restore();

    // 当前段位卡
    const curRank = seasonRankFromScore(meta.seasonScore);
    const rankIdx = SEASON_RANKS.findIndex((r) => r.rank === curRank);
    const nextRank = rankIdx >= 0 && rankIdx < SEASON_RANKS.length - 1 ? SEASON_RANKS[rankIdx + 1] : null;
    const curThreshold = rankIdx >= 0 ? SEASON_RANKS[rankIdx].minScore : 0;
    const nextThreshold = nextRank ? nextRank.minScore : curThreshold;
    const rankRatio = nextRank
      ? (meta.seasonScore - curThreshold) / Math.max(1, nextThreshold - curThreshold)
      : 1;

    const cardRect: Rect = { x: panel.x + 16, y: panel.y + 52, w: panel.w - 32, h: 96 };
    drawPanel(ctx, cardRect.x, cardRect.y, cardRect.w, cardRect.h, {
      bgColor: withAlpha(accent, 0.1),
      borderColor: accent,
      borderWidth: 2,
    });
    drawNeonCorners(ctx, cardRect.x, cardRect.y, cardRect.w, cardRect.h, accent, 10, 2, 5);

    ctx.save();
    ctx.font = `400 28px ${Theme.fonts.body}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🏆", cardRect.x + 36, cardRect.y + cardRect.h / 2);
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.textAlign = "left";
    ctx.fillText(curRank, cardRect.x + 70, cardRect.y + 32);
    ctx.shadowBlur = 0;
    ctx.font = `700 14px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(`${meta.seasonScore} 分`, cardRect.x + 70, cardRect.y + 58);
    ctx.restore();

    // 段位进度条
    const barY = cardRect.y + cardRect.h + 12;
    const barW = cardRect.w;
    if (nextRank) {
      ctx.save();
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`距离「${nextRank.rank}」还需 ${Math.max(0, nextThreshold - meta.seasonScore)} 分`, cardRect.x, barY);
      ctx.restore();
      drawProgressBar(ctx, cardRect.x, barY + 16, barW, 6, Math.min(1, rankRatio), accent);
    } else {
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = accent;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.shadowColor = accent;
      ctx.shadowBlur = 6;
      ctx.fillText("★ 已达最高段位 · 反诈元帅", cardRect.x + barW / 2, barY + 6);
      ctx.restore();
    }

    // 段位阶梯列表
    const listY = barY + 36;
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("▸ 段位阶梯", panel.x + 16, listY);
    ctx.restore();

    const rankItemH = 24;
    for (let i = SEASON_RANKS.length - 1; i >= 0; i--) {
      const r = SEASON_RANKS[i];
      const isCurrent = r.rank === curRank;
      const isAchieved = meta.seasonScore >= r.minScore;
      const itemY = listY + 20 + (SEASON_RANKS.length - 1 - i) * rankItemH;
      ctx.save();
      // 阶段背景
      if (isCurrent) {
        ctx.fillStyle = withAlpha(accent, 0.18);
        ctx.fillRect(panel.x + 16, itemY, panel.w - 32, rankItemH - 2);
      }
      ctx.font = `${isCurrent ? "700" : "500"} 11px ${Theme.fonts.display}`;
      ctx.fillStyle = isCurrent ? accent : (isAchieved ? Theme.colors.ink.DEFAULT : Theme.colors.ink.dim);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${isAchieved ? "✓" : "○"} ${r.rank}`, panel.x + 24, itemY + rankItemH / 2);
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = isAchieved ? Theme.colors.ink.muted : Theme.colors.ink.dim;
      ctx.textAlign = "right";
      ctx.fillText(`${r.minScore} 分`, panel.x + panel.w - 24, itemY + rankItemH / 2);
      ctx.restore();
    }
  }

  private renderQuestPanel(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const panel = this.getRightPanelRect(screenW, screenH);
    const accent = "#1AD670";
    drawPanel(ctx, panel.x, panel.y, panel.w, panel.h, {
      bgColor: withAlpha(accent, 0.03),
      borderColor: withAlpha(accent, 0.3),
      borderWidth: 1,
    });

    // 面板标题（v7：下移避开视图标签）
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 4;
    ctx.fillText("📅 周常任务 · 每周一刷新", panel.x + 16, panel.y + 36);
    ctx.shadowBlur = 0;
    const meta = platformStore.managerMetaProgress();
    const claimedCount = WEEKLY_QUESTS.filter((q) => meta.weeklyCompleted.includes(q.id)).length;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText(`已领取 ${claimedCount}/${WEEKLY_QUESTS.length}`, panel.x + panel.w - 16, panel.y + 38);
    ctx.restore();

    // 任务列表
    for (let i = 0; i < WEEKLY_QUESTS.length; i++) {
      this.renderQuestItem(ctx, i, WEEKLY_QUESTS[i], screenW, screenH);
    }
  }

  // ====================================================================
  // v7：视图标签 + 排行榜面板
  // ====================================================================

  /** 渲染右侧面板顶部的视图切换标签（周常任务 / 排行榜） */
  private renderViewTabs(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const panel = this.getRightPanelRect(screenW, screenH);
    const tabs: { id: "quests" | "leaderboard"; label: string; accent: string }[] = [
      { id: "quests", label: "📅 周常任务", accent: "#1AD670" },
      { id: "leaderboard", label: "🏆 排行榜", accent: "#FFD666" },
    ];
    const tabW = (panel.w - 32 - 8) / 2;
    const tabH = 24;
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const rect: Rect = { x: panel.x + 16 + i * (tabW + 8), y: panel.y + 6, w: tabW, h: tabH };
      const selected = this.viewMode === tab.id;
      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        bgColor: selected ? withAlpha(tab.accent, 0.15) : "rgba(20,30,45,0.6)",
        borderColor: selected ? tab.accent : withAlpha(Theme.colors.bg.line, 0.4),
        borderWidth: selected ? 2 : 1,
      });
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = selected ? tab.accent : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tab.label, rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.restore();
    }
  }

  /** 视图标签矩形 */
  private getViewTabRect(idx: number, screenW: number, screenH: number): Rect {
    const panel = this.getRightPanelRect(screenW, screenH);
    const tabW = (panel.w - 32 - 8) / 2;
    const tabH = 24;
    return { x: panel.x + 16 + idx * (tabW + 8), y: panel.y + 6, w: tabW, h: tabH };
  }

  /** 渲染排行榜面板 */
  private renderLeaderboardPanel(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const panel = this.getRightPanelRect(screenW, screenH);
    const accent = "#FFD666";
    drawPanel(ctx, panel.x, panel.y, panel.w, panel.h, {
      bgColor: withAlpha(accent, 0.03),
      borderColor: withAlpha(accent, 0.3),
      borderWidth: 1,
    });

    // 排行榜子标签：每日 / 每周 / 赛季
    const subTabs: { id: "daily" | "weekly" | "season"; label: string }[] = [
      { id: "daily", label: "每日" },
      { id: "weekly", label: "每周" },
      { id: "season", label: "赛季" },
    ];
    for (let i = 0; i < subTabs.length; i++) {
      const st = subTabs[i];
      const rect = this.getLeaderboardTabRect(i, screenW, screenH);
      const selected = this.leaderboardTab === st.id;
      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        bgColor: selected ? withAlpha(accent, 0.18) : "rgba(20,30,45,0.6)",
        borderColor: selected ? accent : withAlpha(Theme.colors.bg.line, 0.4),
        borderWidth: selected ? 2 : 1,
      });
      ctx.save();
      ctx.font = `700 10px ${Theme.fonts.display}`;
      ctx.fillStyle = selected ? accent : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.label, rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.restore();
    }
    // 子标签右侧：玩家分数
    const meta = platformStore.managerMetaProgress();
    const playerScore = this.leaderboardTab === "daily" ? meta.leaderboard.daily.score
      : this.leaderboardTab === "weekly" ? meta.leaderboard.weekly.score
      : meta.leaderboard.season.score;
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`我的分数 ${playerScore.toLocaleString()}`, panel.x + panel.w - 16, panel.y + 40);
    ctx.restore();

    // 生成排行榜数据
    const playerRank = seasonRankFromScore(meta.seasonScore);
    const entries = generateLeaderboard(this.leaderboardTab, playerScore, playerRank, "classic");

    // 排行榜列表（最多显示 20 条）
    const listY = panel.y + 56;
    const listH = panel.h - 56 - 12;
    const itemH = Math.min(28, Math.floor(listH / 20));
    for (let i = 0; i < Math.min(entries.length, 20); i++) {
      const entry = entries[i];
      const rect = this.getLeaderboardItemRect(i, screenW, screenH);
      const isPlayer = entry.isPlayer;
      // 背景
      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        bgColor: isPlayer ? withAlpha(accent, 0.15) : "rgba(20,30,45,0.5)",
        borderColor: isPlayer ? accent : withAlpha(Theme.colors.bg.line, 0.3),
        borderWidth: isPlayer ? 2 : 1,
      });
      // 排名
      ctx.save();
      ctx.font = `900 12px ${Theme.fonts.mono}`;
      ctx.fillStyle = i < 3 ? accent : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const rankEmoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
      ctx.fillText(rankEmoji, rect.x + 18, rect.y + rect.h / 2);
      // 头像
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(entry.avatar, rect.x + 44, rect.y + rect.h / 2);
      // 名字
      ctx.font = `700 11px ${Theme.fonts.body}`;
      ctx.fillStyle = isPlayer ? accent : Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left";
      ctx.fillText(entry.name + (isPlayer ? "（我）" : ""), rect.x + 62, rect.y + rect.h / 2);
      // 段位
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText(entry.rank, rect.x + 160, rect.y + rect.h / 2);
      // 分数
      ctx.font = `700 11px ${Theme.fonts.mono}`;
      ctx.fillStyle = isPlayer ? accent : Theme.colors.ink.DEFAULT;
      ctx.textAlign = "right";
      ctx.fillText(entry.score.toLocaleString(), rect.x + rect.w - 10, rect.y + rect.h / 2);
      ctx.restore();
    }

    // 底部提示
    ctx.save();
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("// 前端模拟排行 · 每日/每周自动刷新", panel.x + panel.w / 2, panel.y + panel.h - 4);
    ctx.restore();
  }

  /** 排行榜子标签矩形 */
  private getLeaderboardTabRect(idx: number, screenW: number, screenH: number): Rect {
    const panel = this.getRightPanelRect(screenW, screenH);
    const tabW = 56;
    const tabH = 20;
    return { x: panel.x + 16 + idx * (tabW + 6), y: panel.y + 34, w: tabW, h: tabH };
  }

  /** 排行榜条目矩形 */
  private getLeaderboardItemRect(idx: number, screenW: number, screenH: number): Rect {
    const panel = this.getRightPanelRect(screenW, screenH);
    const listY = panel.y + 56;
    const listH = panel.h - 56 - 12;
    const itemH = Math.min(28, Math.floor(listH / 20));
    return { x: panel.x + 16, y: listY + idx * itemH, w: panel.w - 32, h: itemH - 2 };
  }

  private renderQuestItem(ctx: CanvasRenderingContext2D, idx: number, quest: WeeklyQuest, screenW: number, screenH: number): void {
    const rect = this.getQuestItemRect(idx, screenW, screenH);
    const { progress, claimed, canClaim } = this.getQuestProgress(quest);
    const ratio = quest.target > 0 ? progress / quest.target : 0;
    const accent = quest.reward.relicId ? "#FFD666" : "#1AD670";

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: claimed ? withAlpha(Theme.colors.bg.line, 0.5) : (canClaim ? accent : withAlpha(accent, 0.35)),
      borderWidth: canClaim ? 2 : 1,
      bgColor: claimed ? "rgba(20,30,45,0.5)" : (canClaim ? withAlpha(accent, 0.1) : "rgba(20,30,45,0.6)"),
    });

    // 任务名称 + 描述
    ctx.save();
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = claimed ? Theme.colors.ink.dim : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(quest.name, rect.x + 10, rect.y + 8);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(quest.desc, rect.x + 10, rect.y + 24);

    // 进度
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = claimed ? Theme.colors.ink.dim : (canClaim ? accent : Theme.colors.ink.muted);
    ctx.fillText(`${progress}/${quest.target}`, rect.x + 10, rect.y + 42);

    // 进度条
    drawProgressBar(ctx, rect.x + 60, rect.y + 46, rect.w - 150, 4, Math.min(1, ratio), accent);

    // 奖励
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    const rewardText = `+${quest.reward.seasonScore}分 · +${quest.reward.coins}币${quest.reward.relicId ? " · +遗物" : ""}`;
    ctx.fillText(rewardText, rect.x + 10, rect.y + rect.h - 12);

    // 领取按钮 / 状态
    const claimBtn = this.getClaimBtnRect(idx, screenW, screenH);
    if (claimed) {
      ctx.font = `700 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓ 已领取", claimBtn.x + claimBtn.w / 2, claimBtn.y + claimBtn.h / 2);
    } else if (canClaim) {
      drawButton(ctx, claimBtn.x, claimBtn.y, claimBtn.w, claimBtn.h, "领取", {
        variant: "primary", accent,
        pressed: this.pressedButton === `claim-${idx}`,
        fontSize: 11,
      });
    } else {
      drawButton(ctx, claimBtn.x, claimBtn.y, claimBtn.w, claimBtn.h, "进行中", {
        variant: "ghost", accent: Theme.colors.ink.dim,
        fontSize: 10,
      });
    }
    ctx.restore();
  }

  private renderConfirm(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const quest = WEEKLY_QUESTS.find((q) => q.id === this.pendingClaimId);
    if (!quest) return;
    ctx.save();
    ctx.fillStyle = "rgba(8, 16, 30, 0.82)";
    ctx.fillRect(0, 0, screenW, screenH);
    const rect = this.getConfirmRect(screenW, screenH);
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      bgColor: "rgba(15, 34, 54, 0.97)",
      borderColor: Theme.accents.manager,
      borderWidth: 2,
    });
    drawNeonCorners(ctx, rect.x, rect.y, rect.w, rect.h, Theme.accents.manager, 12, 3, 6);

    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.accents.manager;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = Theme.accents.manager;
    ctx.shadowBlur = 6;
    ctx.fillText("领取任务奖励", rect.x + rect.w / 2, rect.y + 20);
    ctx.shadowBlur = 0;

    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(`确认领取「${quest.name}」奖励？`, rect.x + rect.w / 2, rect.y + 50);
    ctx.font = `700 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.accents.manager;
    ctx.fillText(`+${quest.reward.seasonScore} 赛季积分 · +${quest.reward.coins} 金币${quest.reward.relicId ? " · 1 件遗物" : ""}`, rect.x + rect.w / 2, rect.y + 72);

    const btnW = 110;
    const btnH = 32;
    const cancelRect: Rect = { x: rect.x + 32, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
    const confirmRect: Rect = { x: rect.x + rect.w - 32 - btnW, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
    drawButton(ctx, cancelRect.x, cancelRect.y, cancelRect.w, cancelRect.h, "取消", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "confirm-cancel",
    });
    drawButton(ctx, confirmRect.x, confirmRect.y, confirmRect.w, confirmRect.h, "领取", {
      variant: "primary", accent: Theme.accents.manager,
      pressed: this.pressedButton === "confirm-ok",
    });
    ctx.restore();
  }

  // ====================================================================
  // 触摸处理
  // ====================================================================

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    // 确认弹窗优先
    if (this.pendingClaimId) {
      if (type === "start") {
        const rect = this.getConfirmRect(screenW, screenH);
        const btnW = 110;
        const btnH = 32;
        const cancelRect: Rect = { x: rect.x + 32, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
        const confirmRect: Rect = { x: rect.x + rect.w - 32 - btnW, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
        if (hitTest(x, y, cancelRect)) { this.pressedButton = "confirm-cancel"; return true; }
        if (hitTest(x, y, confirmRect)) { this.pressedButton = "confirm-ok"; return true; }
        return true;
      } else if (type === "end") {
        const rect = this.getConfirmRect(screenW, screenH);
        const btnW = 110;
        const btnH = 32;
        const cancelRect: Rect = { x: rect.x + 32, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
        const confirmRect: Rect = { x: rect.x + rect.w - 32 - btnW, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
        if (this.pressedButton === "confirm-cancel" && hitTest(x, y, cancelRect)) {
          this.pendingClaimId = null;
          playSfx("click");
        } else if (this.pressedButton === "confirm-ok" && hitTest(x, y, confirmRect)) {
          this.claimQuest(this.pendingClaimId);
          this.pendingClaimId = null;
          playSfx("achievement");
          vibrateShort();
        }
        this.pressedButton = null;
        return true;
      }
      return true;
    }

    if (type === "start") {
      if (hitTest(x, y, this.getBackBtnRect())) { this.pressedButton = "back"; return true; }
      // v7：视图标签（周常任务 / 排行榜）
      for (let i = 0; i < 2; i++) {
        if (hitTest(x, y, this.getViewTabRect(i, screenW, screenH))) {
          this.pressedButton = `viewtab-${i}`;
          return true;
        }
      }
      // v7：排行榜子标签（每日 / 每周 / 赛季）
      if (this.viewMode === "leaderboard") {
        for (let i = 0; i < 3; i++) {
          if (hitTest(x, y, this.getLeaderboardTabRect(i, screenW, screenH))) {
            this.pressedButton = `lbtab-${i}`;
            return true;
          }
        }
      }
      // 领取按钮（仅 quests 视图）
      if (this.viewMode === "quests") {
        for (let i = 0; i < WEEKLY_QUESTS.length; i++) {
          const q = WEEKLY_QUESTS[i];
          const { canClaim, claimed } = this.getQuestProgress(q);
          if (canClaim && !claimed) {
            if (hitTest(x, y, this.getClaimBtnRect(i, screenW, screenH))) {
              this.pressedButton = `claim-${i}`;
              return true;
            }
          }
        }
      }
      return false;
    } else if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;
      if (pressed === "back") {
        playSfx("click");
        this.director.pop();
        return true;
      }
      // v7：视图标签切换
      if (pressed?.startsWith("viewtab-")) {
        const idx = parseInt(pressed.split("-")[1]);
        if (hitTest(x, y, this.getViewTabRect(idx, screenW, screenH))) {
          this.viewMode = idx === 0 ? "quests" : "leaderboard";
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      // v7：排行榜子标签切换
      if (pressed?.startsWith("lbtab-")) {
        const idx = parseInt(pressed.split("-")[1]);
        if (hitTest(x, y, this.getLeaderboardTabRect(idx, screenW, screenH))) {
          this.leaderboardTab = idx === 0 ? "daily" : idx === 1 ? "weekly" : "season";
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      if (pressed?.startsWith("claim-")) {
        const idx = parseInt(pressed.split("-")[1]);
        const quest = WEEKLY_QUESTS[idx];
        const { canClaim, claimed } = this.getQuestProgress(quest);
        if (canClaim && !claimed && hitTest(x, y, this.getClaimBtnRect(idx, screenW, screenH))) {
          this.pendingClaimId = quest.id;
          playSfx("click");
        }
        return true;
      }
      return false;
    }
    return false;
  }

  /** 领取任务奖励：增加赛季积分 + 金币 + 遗物（如有），标记为已领取 */
  private claimQuest(questId: string): void {
    const quest = WEEKLY_QUESTS.find((q) => q.id === questId);
    if (!quest) return;
    const meta = platformStore.managerMetaProgress();
    if (meta.weeklyCompleted.includes(questId)) return;
    platformStore.addSeasonScore(quest.reward.seasonScore);
    if (quest.reward.coins) platformStore.addManagerCoins(quest.reward.coins);
    if (quest.reward.relicId) platformStore.grantRelic(quest.reward.relicId);
    platformStore.completeWeeklyQuest(questId);
  }
}
