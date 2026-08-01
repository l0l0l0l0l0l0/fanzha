/**
 * 「反诈职业经理人」剧情战役面板（v8 全面升级）
 * 横屏 Canvas UI：双 Tab 主线剧情 + 探员支线
 *
 * - 顶部：返回 + 标题 + Tab 切换（主线剧情 / 探员支线）
 * - 主线剧情 Tab：8 章 × 5 关 stages（来自 STORY_CHAPTERS_FULL）
 *   - 章节卡显示 序号 / emoji / 标题 / 副标题 / 关卡进度 X/5 / 推荐战力
 *   - 点击章节 → 弹出详情：5 个 stage 卡片 + 序章/终章对白
 *   - 点击 stage → push ManagerDeployScene（mode=bossRush）
 * - 探员支线 Tab：10 探员 × 3 战（来自 AGENT_STORY_QUESTS）
 *   - 探员卡显示 emoji / 名称 / 支线标题 / 章节进度 X/3 / 奖励
 *   - 未解锁探员显示 🔒
 *   - 点击探员 → 弹出详情：3 个 chapter 卡片 + 简介 + 奖励
 *   - 点击 chapter → push ManagerDeployScene（mode=bossRush）
 *
 * 关卡完成判定：v8 stages 通过 completedStoryStages 持久化
 *   - key 格式：`${chapterId}::stage${order}`
 * 探员支线完成判定：通过 completedAgentStoryQuests 持久化
 *   - key 格式：`${agentId}::chapter${order}`
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawScanlineOverlay,
  drawNeonCorners, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import { roundRect } from "@/engine/Renderer";
import { STORY_CHAPTERS_FULL, AGENT_STORY_QUESTS } from "@/games/manager/data.v8";
import { AGENTS, VICTIM_SIM_SCENARIOS_V11 } from "@/games/manager/data";
import type { StoryChapterFull, AgentStoryQuest, WrongQuestionRecord, VictimSimScenario, VictimSimEnding, VictimSimChoice } from "@/games/manager/types";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ManagerDeployScene } from "./ManagerDeployScene";

type StoryTab = "main" | "agent" | "wrong" | "victim";

/** 错题来源筛选 */
type WrongQFilter = "all" | "quiz" | "dialog" | "case" | "battle";

const CARD_H = 56;
const CARD_GAP = 6;
const PAD = 12;
const TAB_H = 32;
const TAB_GAP = 6;
const STAGE_ROW_H = 40;
const STAGE_ROW_GAP = 4;
const WRONGQ_CARD_H = 52;
const WRONGQ_CARD_GAP = 5;
const WRONGQ_FILTER_H = 26;
const WRONGQ_FILTER_GAP = 4;

export class ManagerStoryScene extends Scene {
  private pressedButton: string | null = null;
  /** 当前展开详情的主线章节 id（null 表示无展开） */
  private expandedChapterId: string | null = null;
  /** 当前展开详情的探员 id（null 表示无展开） */
  private expandedAgentId: string | null = null;
  /** 当前 Tab：main = 主线剧情，agent = 探员支线，wrong = 错题强化 */
  private currentTab: StoryTab = "main";
  private t = 0;

  // ===== v9 Phase 4.5：错题强化状态 =====
  /** 错题来源筛选 */
  private wrongQFilter: WrongQFilter = "all";
  /** 当前正在重练的错题 key（`${source}::${questionId}`，null 表示无） */
  private expandedWrongQKey: string | null = null;
  /** 重练时已选选项索引集合（multi 支持多选） */
  private wrongQSelectedIdx: Set<number> = new Set();
  /** 重练是否已提交作答 */
  private wrongQAnswered = false;
  /** 上一帧渲染时错题卡片矩形缓存（hitTest 用） */
  private lastWrongQRects: Rect[] = [];
  /** 上一帧渲染时重练弹窗选项矩形缓存 */
  private lastWrongQOptRects: Rect[] = [];
  /** 上一帧渲染时重练弹窗底部按钮矩形 */
  private lastWrongQBtnRect: Rect | null = null;

  // ===== v11：受害者模拟（第一人称识骗演练）状态 =====
  /** 受害者模拟当前模式：list=剧本列表 / play=剧情进行 / ending=结局展示 */
  private victimSimMode: "list" | "play" | "ending" = "list";
  /** 当前进行的剧本 id（null 表示未在进行） */
  private victimSimScenarioId: string | null = null;
  /** 当前节点 id */
  private victimSimNodeId: string | null = null;
  /** 累计警觉值 */
  private victimSimAwareness = 0;
  /** 累计损失值 */
  private victimSimLoss = 0;
  /** 当前结局 id（ending 模式时） */
  private victimSimEndingId: string | null = null;
  /** 上次选择的选项（用于展示反馈） */
  private victimSimLastChoice: VictimSimChoice | null = null;
  /** 上一帧渲染时剧本卡片矩形缓存 */
  private lastVictimSimCardRects: Rect[] = [];
  /** 上一帧渲染时选项矩形缓存 */
  private lastVictimSimChoiceRects: Rect[] = [];
  /** 上一帧渲染时继续按钮矩形 */
  private lastVictimSimContinueBtn: Rect | null = null;
  /** 上一帧渲染时结局返回按钮矩形 */
  private lastVictimSimEndBtn: Rect | null = null;

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.expandedChapterId = null;
    this.expandedAgentId = null;
    this.currentTab = "main";
    this.wrongQFilter = "all";
    this.expandedWrongQKey = null;
    this.wrongQSelectedIdx.clear();
    this.wrongQAnswered = false;
    this.victimSimMode = "list";
    this.victimSimScenarioId = null;
    this.victimSimNodeId = null;
    this.victimSimAwareness = 0;
    this.victimSimLoss = 0;
    this.victimSimEndingId = null;
    this.victimSimLastChoice = null;
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
  }

  // ====================================================================
  // 进度查询辅助
  // ====================================================================

  /** 主线 stage 完成键 */
  private stageKey(chapterId: string, stageOrder: number): string {
    return `${chapterId}::stage${stageOrder}`;
  }

  /** 探员支线 chapter 完成键 */
  private agentChapterKey(agentId: string, chapterOrder: number): string {
    return `${agentId}::chapter${chapterOrder}`;
  }

  /** 某个 stage 是否已完成 */
  private isStageDone(chapterId: string, stageOrder: number): boolean {
    return platformStore.managerMetaProgress().completedStoryStages.includes(
      this.stageKey(chapterId, stageOrder),
    );
  }

  /** 某个章节是否已全部通关（所有 stages 完成，或 v7 旧版完成记录存在） */
  private isChapterDone(chapter: StoryChapterFull): boolean {
    const legacy = platformStore.managerMetaProgress().completedStoryChapters.includes(chapter.id);
    if (legacy) return true;
    if (chapter.stages.length === 0) return false;
    return chapter.stages.every((s) => this.isStageDone(chapter.id, s.order));
  }

  /** 章节完成 stage 数量 */
  private chapterDoneCount(chapter: StoryChapterFull): number {
    return chapter.stages.filter((s) => this.isStageDone(chapter.id, s.order)).length;
  }

  /** 章节是否解锁（前一章节已完成 或 requires===null） */
  private isChapterUnlocked(chapter: StoryChapterFull): boolean {
    if (!chapter.requires) return true;
    const prev = STORY_CHAPTERS_FULL.find((c) => c.id === chapter.requires);
    if (!prev) return true;
    return this.isChapterDone(prev);
  }

  /** stage 是否可挑战（章节已解锁 且 (第一节 或 上一节已完成)） */
  private isStageUnlocked(chapter: StoryChapterFull, stageOrder: number): boolean {
    if (!this.isChapterUnlocked(chapter)) return false;
    if (stageOrder === 1) return true;
    return this.isStageDone(chapter.id, stageOrder - 1);
  }

  /** 探员支线 chapter 是否已完成 */
  private isAgentChapterDone(agentId: string, chapterOrder: number): boolean {
    return platformStore.managerMetaProgress().completedAgentStoryQuests.includes(
      this.agentChapterKey(agentId, chapterOrder),
    );
  }

  /** 探员支线是否全部完成 */
  private isAgentQuestDone(quest: AgentStoryQuest): boolean {
    if (quest.chapters.length === 0) return false;
    return quest.chapters.every((c) => this.isAgentChapterDone(quest.agentId, c.order));
  }

  /** 探员支线完成 chapter 数量 */
  private agentChapterDoneCount(quest: AgentStoryQuest): number {
    return quest.chapters.filter((c) => this.isAgentChapterDone(quest.agentId, c.order)).length;
  }

  /** 探员是否解锁 */
  private isAgentUnlocked(agentId: string): boolean {
    return platformStore.managerMetaProgress().unlockedAgents.includes(agentId);
  }

  /** 探员支线 chapter 是否可挑战（探员已解锁 且 (第一章 或 上一章已完成)） */
  private isAgentChapterUnlocked(quest: AgentStoryQuest, chapterOrder: number): boolean {
    if (!this.isAgentUnlocked(quest.agentId)) return false;
    if (chapterOrder === 1) return true;
    return this.isAgentChapterDone(quest.agentId, chapterOrder - 1);
  }

  // ====================================================================
  // 布局
  // ====================================================================

  private getBackBtnRect(): Rect {
    return { x: 8, y: 8, w: 56, h: 32 };
  }

  /** Tab 按钮矩形（v11：支持 4 Tab） */
  private getTabRect(idx: number, screenW: number): Rect {
    const tabW = 120;
    const totalW = tabW * 4 + TAB_GAP * 3;
    const x0 = (screenW - totalW) / 2;
    return {
      x: x0 + idx * (tabW + TAB_GAP),
      y: 48,
      w: tabW,
      h: TAB_H,
    };
  }

  /** 主线章节卡片矩形（列表起始 y 在 Tab 下方） */
  private getChapterCardRect(idx: number, screenW: number): Rect {
    const w = screenW - PAD * 2;
    return {
      x: PAD,
      y: 48 + TAB_H + 12 + idx * (CARD_H + CARD_GAP),
      w,
      h: CARD_H,
    };
  }

  /** 探员支线卡片矩形 */
  private getAgentCardRect(idx: number, screenW: number): Rect {
    const w = screenW - PAD * 2;
    return {
      x: PAD,
      y: 48 + TAB_H + 12 + idx * (CARD_H + CARD_GAP),
      w,
      h: CARD_H,
    };
  }

  /** 详情面板矩形（居中弹窗） */
  private getDetailRect(screenW: number, screenH: number): Rect {
    const w = Math.min(560, screenW - 64);
    const h = Math.min(440, screenH - 64);
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
  }

  /** 详情面板内 stage 行矩形 */
  private getStageRowRect(stageIdx: number, detail: Rect): Rect {
    const stageX = detail.x + 16;
    const stageW = detail.w - 32;
    const stageY = detail.y + 96 + stageIdx * (STAGE_ROW_H + STAGE_ROW_GAP);
    return { x: stageX, y: stageY, w: stageW, h: STAGE_ROW_H };
  }

  /** 详情面板内 agent chapter 行矩形 */
  private getAgentChapterRowRect(chIdx: number, detail: Rect): Rect {
    const x = detail.x + 16;
    const w = detail.w - 32;
    const y = detail.y + 140 + chIdx * (STAGE_ROW_H + STAGE_ROW_GAP);
    return { x, y, w, h: STAGE_ROW_H };
  }

  /** 详情面板关闭按钮 */
  private getCloseBtnRect(detail: Rect): Rect {
    return { x: detail.x + detail.w - 36, y: detail.y + 8, w: 28, h: 28 };
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
    ctx.fillText("反诈档案 · 剧情战役", screenW / 2, 24);
    ctx.restore();

    // Tab 栏
    this.renderTabBar(ctx, screenW);

    // Tab 内容
    if (this.currentTab === "main") {
      this.renderMainStoryTab(ctx, screenW);
    } else if (this.currentTab === "agent") {
      this.renderAgentStoryTab(ctx, screenW);
    } else if (this.currentTab === "wrong") {
      this.renderWrongQuestionTab(ctx, screenW, screenH);
    } else if (this.currentTab === "victim") {
      this.renderVictimSimTab(ctx, screenW);
    }

    // 详情弹窗（主线章节详情）
    if (this.expandedChapterId) {
      const chapter = STORY_CHAPTERS_FULL.find((c) => c.id === this.expandedChapterId);
      if (chapter) {
        this.renderChapterDetailOverlay(ctx, chapter, screenW, screenH);
      }
    }

    // 详情弹窗（探员支线详情）
    if (this.expandedAgentId) {
      const quest = AGENT_STORY_QUESTS.find((q) => q.agentId === this.expandedAgentId);
      if (quest) {
        this.renderAgentDetailOverlay(ctx, quest, screenW, screenH);
      }
    }

    // v9 Phase 4.5：错题重练弹窗
    if (this.expandedWrongQKey) {
      this.renderWrongQPracticeOverlay(ctx, screenW, screenH);
    }

    // v11：受害者模拟弹窗（剧情/结局）
    if (this.victimSimScenarioId) {
      this.renderVictimSimPlayOverlay(ctx, screenW, screenH);
    }

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  /** 渲染 Tab 栏（主线剧情 / 探员支线 / 错题强化 / 受害者模拟） */
  private renderTabBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    const tabs: { label: string; key: StoryTab }[] = [
      { label: "📖 主线剧情", key: "main" },
      { label: "🥷 探员支线", key: "agent" },
      { label: "📝 错题强化", key: "wrong" },
      { label: "🪤 受害者模拟", key: "victim" },
    ];
    for (let i = 0; i < tabs.length; i++) {
      const rect = this.getTabRect(i, screenW);
      const active = this.currentTab === tabs[i].key;
      const pressed = this.pressedButton === `tab-${tabs[i].key}`;
      ctx.save();
      ctx.fillStyle = active
        ? withAlpha(Theme.accents.manager, 0.25)
        : pressed
        ? withAlpha(Theme.accents.manager, 0.12)
        : "rgba(20, 30, 45, 0.6)";
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
      ctx.fill();
      ctx.strokeStyle = active ? Theme.accents.manager : withAlpha(Theme.colors.bg.line, 0.5);
      ctx.lineWidth = active ? 1.5 : 1;
      ctx.stroke();
      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = active ? Theme.accents.manager : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tabs[i].label, rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.restore();
    }
  }

  /** 渲染主线剧情 Tab 内容 */
  private renderMainStoryTab(ctx: CanvasRenderingContext2D, screenW: number): void {
    const meta = platformStore.managerMetaProgress();
    const doneChapters = STORY_CHAPTERS_FULL.filter((c) => this.isChapterDone(c)).length;

    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `// STORY CAMPAIGN · ${doneChapters}/${STORY_CHAPTERS_FULL.length} 章节已通关 · ${meta.completedStoryStages.length} 关 stages`,
      PAD,
      48 + TAB_H + 2,
    );
    ctx.restore();

    for (let i = 0; i < STORY_CHAPTERS_FULL.length; i++) {
      this.renderChapterCard(ctx, i, STORY_CHAPTERS_FULL[i], screenW);
    }
  }

  /** 渲染探员支线 Tab 内容 */
  private renderAgentStoryTab(ctx: CanvasRenderingContext2D, screenW: number): void {
    const meta = platformStore.managerMetaProgress();
    const doneQuests = AGENT_STORY_QUESTS.filter((q) => this.isAgentQuestDone(q)).length;

    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `// AGENT STORY · ${doneQuests}/${AGENT_STORY_QUESTS.length} 支线已通关 · ${meta.completedAgentStoryQuests.length} 战`,
      PAD,
      48 + TAB_H + 2,
    );
    ctx.restore();

    for (let i = 0; i < AGENT_STORY_QUESTS.length; i++) {
      this.renderAgentCard(ctx, i, AGENT_STORY_QUESTS[i], screenW);
    }
  }

  // ====================================================================
  // v9 Phase 4.5：错题强化 Tab
  // ====================================================================

  /** 错题来源元数据 */
  private static readonly WRONGQ_SOURCE_META: Record<
    WrongQuestionRecord["source"],
    { label: string; emoji: string; color: string }
  > = {
    quiz: { label: "知识闯关", emoji: "🧠", color: "#FF8A3D" },
    dialog: { label: "AI 对话", emoji: "💬", color: "#52C41A" },
    case: { label: "案例复盘", emoji: "📂", color: "#00E5FF" },
    battle: { label: "战间答题", emoji: "⚔️", color: "#FF3B6B" },
  };

  /** 错题列表起始 y（Tab 下方 + 信息行 + 筛选栏） */
  private getWrongQListStartY(): number {
    return 48 + TAB_H + 12 + 14 + WRONGQ_FILTER_H + 8;
  }

  /** 错题筛选按钮矩形 */
  private getWrongQFilterRect(idx: number, screenW: number): Rect {
    const filters: WrongQFilter[] = ["all", "quiz", "dialog", "case", "battle"];
    const labels = ["全部", "闯关", "对话", "案例", "战间"];
    const widths = labels.map((l) => 36 + l.length * 12);
    const totalW = widths.reduce((a, b) => a + b, 0) + WRONGQ_FILTER_GAP * (widths.length - 1);
    let x0 = (screenW - totalW) / 2;
    for (let i = 0; i < idx; i++) {
      x0 += widths[i] + WRONGQ_FILTER_GAP;
    }
    return { x: x0, y: 48 + TAB_H + 12 + 14, w: widths[idx], h: WRONGQ_FILTER_H };
  }

  /** 错题卡片矩形 */
  private getWrongQCardRect(idx: number, screenW: number): Rect {
    const w = screenW - PAD * 2;
    return {
      x: PAD,
      y: this.getWrongQListStartY() + idx * (WRONGQ_CARD_H + WRONGQ_CARD_GAP),
      w,
      h: WRONGQ_CARD_H,
    };
  }

  /** 获取当前筛选后的错题列表 */
  private getFilteredWrongQuestions(): WrongQuestionRecord[] {
    const all = platformStore.getWrongQuestions();
    if (this.wrongQFilter === "all") return all;
    return all.filter((q) => q.source === this.wrongQFilter);
  }

  /** 渲染错题强化 Tab 内容 */
  private renderWrongQuestionTab(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const stats = platformStore.getWrongQuestionStats();
    const total = stats.quiz + stats.dialog + stats.case + stats.battle;
    const listY = 48 + TAB_H + 2;

    // 信息行
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `// WRONG QUESTION BOOK · 共 ${total} 题 · 闯关 ${stats.quiz} / 对话 ${stats.dialog} / 案例 ${stats.case} / 战间 ${stats.battle}`,
      PAD,
      listY,
    );
    ctx.restore();

    // 筛选按钮栏
    const filters: { key: WrongQFilter; label: string }[] = [
      { key: "all", label: "全部" },
      { key: "quiz", label: "🧠 闯关" },
      { key: "dialog", label: "💬 对话" },
      { key: "case", label: "📂 案例" },
      { key: "battle", label: "⚔️ 战间" },
    ];
    for (let i = 0; i < filters.length; i++) {
      const rect = this.getWrongQFilterRect(i, screenW);
      const active = this.wrongQFilter === filters[i].key;
      const pressed = this.pressedButton === `wq-filter-${filters[i].key}`;
      ctx.save();
      ctx.fillStyle = active
        ? withAlpha(Theme.accents.manager, 0.25)
        : pressed
        ? withAlpha(Theme.accents.manager, 0.12)
        : "rgba(20, 30, 45, 0.6)";
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 4);
      ctx.fill();
      ctx.strokeStyle = active ? Theme.accents.manager : withAlpha(Theme.colors.bg.line, 0.5);
      ctx.lineWidth = active ? 1.5 : 1;
      ctx.stroke();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = active ? Theme.accents.manager : Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(filters[i].label, rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.restore();
    }

    // 错题列表
    const list = this.getFilteredWrongQuestions();
    this.lastWrongQRects = [];

    if (list.length === 0) {
      ctx.save();
      ctx.font = `700 14px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const emptyY = this.getWrongQListStartY() + 60;
      ctx.fillText(total === 0 ? "🎉 错题本为空，继续加油！" : "📋 当前筛选无错题", screenW / 2, emptyY);
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText(total === 0 ? "答题中答错的题目会自动收录到这里" : "试试切换其他来源筛选", screenW / 2, emptyY + 22);
      ctx.restore();
      return;
    }

    for (let i = 0; i < list.length; i++) {
      const rect = this.getWrongQCardRect(i, screenW);
      this.lastWrongQRects.push(rect);
      this.renderWrongQCard(ctx, rect, list[i], i, screenH);
    }
  }

  /** 渲染单个错题卡片 */
  private renderWrongQCard(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    q: WrongQuestionRecord,
    idx: number,
    _screenH: number,
  ): void {
    const meta = ManagerStoryScene.WRONGQ_SOURCE_META[q.source];
    const isPressed = this.pressedButton === `wq-${idx}`;
    const isExpanded = this.expandedWrongQKey === `${q.source}::${q.questionId}`;

    ctx.save();
    ctx.fillStyle = isExpanded
      ? withAlpha(meta.color, 0.18)
      : isPressed
      ? withAlpha(meta.color, 0.10)
      : withAlpha(Theme.colors.bg.card, 0.7);
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
    ctx.fill();
    ctx.strokeStyle = isExpanded ? meta.color : withAlpha(Theme.colors.bg.line, 0.5);
    ctx.lineWidth = isExpanded ? 1.5 : 1;
    ctx.stroke();

    // 左侧：来源 emoji
    ctx.font = `900 22px ${Theme.fonts.display}`;
    ctx.fillStyle = meta.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(meta.emoji, rect.x + 22, rect.y + rect.h / 2);

    // 题干（截断）
    ctx.font = `500 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    const maxW = rect.w - 130;
    const truncated = this.truncateText(ctx, q.questionText, maxW);
    ctx.fillText(truncated, rect.x + 48, rect.y + 18);

    // 分类 + 题型
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    const typeLabel = q.questionType === "single" ? "单选"
      : q.questionType === "multi" ? "多选"
      : q.questionType === "judge" ? "判断" : "分支";
    ctx.fillText(`[${q.category}] · ${typeLabel}`, rect.x + 48, rect.y + 36);

    // 右侧：错误次数 + 重练按钮
    ctx.textAlign = "right";
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = q.wrongCount >= 3 ? "#E5353B" : q.wrongCount >= 2 ? "#FFB020" : meta.color;
    ctx.fillText(`✗ ×${q.wrongCount}`, rect.x + rect.w - 12, rect.y + 18);

    ctx.font = `700 10px ${Theme.fonts.display}`;
    ctx.fillStyle = meta.color;
    ctx.fillText("重练 ▶", rect.x + rect.w - 12, rect.y + 36);

    ctx.restore();
  }

  /** 文本截断（超出宽度加省略号） */
  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (ctx.measureText(text.slice(0, mid) + "…").width <= maxW) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return text.slice(0, Math.max(0, lo - 1)) + "…";
  }

  /** 错题重练弹窗 */
  private renderWrongQPracticeOverlay(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
  ): void {
    const q = this.getExpandedWrongQ();
    if (!q) {
      this.expandedWrongQKey = null;
      return;
    }
    const meta = ManagerStoryScene.WRONGQ_SOURCE_META[q.source];

    // 半透明遮罩
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, screenW, screenH);

    // 弹窗面板
    const detail = this.getWrongQDetailRect(screenW, screenH);
    drawPanel(ctx, detail.x, detail.y, detail.w, detail.h, {
      borderColor: meta.color,
      borderWidth: 2,
      bgColor: withAlpha(Theme.colors.bg.deep, 0.95),
    });

    // 标题
    ctx.font = `700 14px ${Theme.fonts.display}`;
    ctx.fillStyle = meta.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`📝 错题重练 · ${meta.label}`, detail.x + detail.w / 2, detail.y + 22);

    // 关闭按钮
    const closeBtn = this.getCloseBtnRect(detail);
    ctx.fillStyle = withAlpha(Theme.colors.warn.DEFAULT, 0.2);
    roundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 4);
    ctx.fill();
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = "#E5353B";
    ctx.fillText("✕", closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2);

    // 题型标签 + 分类
    const typeLabel = q.questionType === "single" ? "单选题"
      : q.questionType === "multi" ? "多选题"
      : q.questionType === "judge" ? "判断题" : "分支选择";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = meta.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`【${typeLabel}】${q.category} · 已错 ${q.wrongCount} 次`, detail.x + 16, detail.y + 44);

    // 题干（自动换行）
    ctx.font = `500 13px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const qLines = this.wrapWrongQText(ctx, q.questionText, detail.w - 32);
    let curY = detail.y + 64;
    for (const line of qLines) {
      ctx.fillText(line, detail.x + 16, curY);
      curY += 18;
    }
    curY += 8;

    // 选项
    const optH = 36;
    const optGap = 6;
    this.lastWrongQOptRects = [];
    for (let i = 0; i < q.options.length; i++) {
      const oy = curY + i * (optH + optGap);
      const ox = detail.x + 16;
      const ow = detail.w - 32;
      this.lastWrongQOptRects.push({ x: ox, y: oy, w: ow, h: optH });
      this.drawWrongQOption(ctx, ox, oy, ow, optH, q, i, meta.color);
    }
    curY += q.options.length * (optH + optGap) + 8;

    // 解析（已作答时显示）
    if (this.wrongQAnswered) {
      const isCorrect = this.isWrongQAnswerCorrect(q);
      const explainColor = isCorrect ? "#52C41A" : "#E5353B";
      ctx.fillStyle = withAlpha(explainColor, 0.10);
      roundRect(ctx, detail.x + 16, curY, detail.w - 32, 50, 6);
      ctx.fill();
      ctx.strokeStyle = explainColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = explainColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(isCorrect ? "✓ 答对！错次 -1" : "✗ 又答错了，错次 +1", detail.x + 24, curY + 8);

      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const exLines = this.wrapWrongQText(ctx, q.explanation ?? "暂无解析", detail.w - 48);
      exLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, detail.x + 24, curY + 26 + i * 14);
      });
      curY += 58;
    }

    // 底部按钮
    const btnW = 160;
    const btnH = 36;
    const btnX = detail.x + (detail.w - btnW) / 2;
    const btnY = detail.y + detail.h - 48;
    this.lastWrongQBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
    if (this.wrongQAnswered) {
      this.drawWrongQButton(ctx, btnX, btnY, btnW, btnH, "完成 ✓", meta.color, "wq-done", false);
    } else {
      const canSubmit = this.wrongQSelectedIdx.size > 0;
      this.drawWrongQButton(
        ctx, btnX, btnY, btnW, btnH,
        "提交答案",
        canSubmit ? meta.color : Theme.colors.ink.dim,
        "wq-submit",
        !canSubmit,
      );
    }

    ctx.restore();
  }

  /** 渲染单个选项（错题重练弹窗用） */
  private drawWrongQOption(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    q: WrongQuestionRecord, idx: number,
    accent: string,
  ): void {
    const isSelected = this.wrongQSelectedIdx.has(idx);
    const isPressed = this.pressedButton === `wq-opt-${idx}`;
    const correctIdxSet = new Set(q.correctAnswer.split(",").map((s) => s.trim()));
    const isCorrect = this.wrongQAnswered && correctIdxSet.has(String(idx));
    const isWrongPick = this.wrongQAnswered && isSelected && !isCorrect;

    let borderColor: string = withAlpha(Theme.colors.bg.line, 0.6);
    let bgColor: string = withAlpha(Theme.colors.bg.card, 0.5);
    if (isSelected && !this.wrongQAnswered) {
      borderColor = q.questionType === "multi" ? "#9D6BFF" : accent;
      bgColor = withAlpha(borderColor, 0.12);
    } else if (isCorrect) {
      borderColor = "#52C41A";
      bgColor = withAlpha("#52C41A", 0.15);
    } else if (isWrongPick) {
      borderColor = "#E5353B";
      bgColor = withAlpha("#E5353B", 0.15);
    }

    const offsetY = isPressed ? 1 : 0;
    ctx.save();
    ctx.fillStyle = bgColor;
    roundRect(ctx, x, y + offsetY, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = (isSelected || isCorrect || isWrongPick) ? 1.5 : 1;
    ctx.stroke();

    // 选项标记
    const label = q.questionType === "multi"
      ? (isSelected ? "☑" : "☐")
      : String.fromCharCode(65 + idx);
    ctx.font = `900 13px ${Theme.fonts.display}`;
    ctx.fillStyle = isCorrect ? "#52C41A" : isWrongPick ? "#E5353B" : borderColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 12, y + offsetY + h / 2);

    // 选项文字
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const optText = q.options[idx] ?? "";
    const truncated = this.truncateText(ctx, optText, w - 40);
    ctx.fillText(truncated, x + 32, y + offsetY + h / 2);

    if (this.wrongQAnswered) {
      ctx.textAlign = "right";
      if (isCorrect) {
        ctx.font = `900 14px ${Theme.fonts.display}`;
        ctx.fillStyle = "#52C41A";
        ctx.fillText("✓", x + w - 10, y + offsetY + h / 2);
      } else if (isWrongPick) {
        ctx.font = `900 14px ${Theme.fonts.display}`;
        ctx.fillStyle = "#E5353B";
        ctx.fillText("✗", x + w - 10, y + offsetY + h / 2);
      }
    }
    ctx.restore();
  }

  /** 绘制按钮（错题重练弹窗用） */
  private drawWrongQButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    label: string, color: string, id: string, disabled: boolean,
  ): void {
    const isPressed = this.pressedButton === id;
    const offsetY = isPressed ? 1 : 0;
    ctx.save();
    ctx.fillStyle = disabled
      ? withAlpha(Theme.colors.ink.dim, 0.15)
      : isPressed
      ? withAlpha(color, 0.35)
      : withAlpha(color, 0.20);
    roundRect(ctx, x, y + offsetY, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = disabled ? withAlpha(Theme.colors.ink.dim, 0.3) : color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = disabled ? Theme.colors.ink.dim : color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + offsetY + h / 2);
    ctx.restore();
  }

  /** 错题重练弹窗矩形 */
  private getWrongQDetailRect(screenW: number, screenH: number): Rect {
    const w = Math.min(560, screenW - 40);
    const h = Math.min(420, screenH - 40);
    return {
      x: (screenW - w) / 2,
      y: (screenH - h) / 2,
      w,
      h,
    };
  }

  /** 获取当前展开的错题记录 */
  private getExpandedWrongQ(): WrongQuestionRecord | null {
    if (!this.expandedWrongQKey) return null;
    const all = platformStore.getWrongQuestions();
    return all.find((q) => `${q.source}::${q.questionId}` === this.expandedWrongQKey) ?? null;
  }

  /** 文本换行（错题重练弹窗用） */
  private wrapWrongQText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
    const lines: string[] = [];
    let current = "";
    for (const ch of text) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxW && current.length > 0) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines.length > 0 ? lines : [text];
  }

  /** 判断重练答案是否正确 */
  private isWrongQAnswerCorrect(q: WrongQuestionRecord): boolean {
    const correctArr = q.correctAnswer.split(",").map((s) => s.trim()).sort();
    const userArr = Array.from(this.wrongQSelectedIdx).map((i) => String(i)).sort();
    return correctArr.length === userArr.length && correctArr.every((v, i) => v === userArr[i]);
  }

  /** 提交错题重练答案 */
  private submitWrongQAnswer(): void {
    const q = this.getExpandedWrongQ();
    if (!q || this.wrongQAnswered) return;
    const correct = this.isWrongQAnswerCorrect(q);
    const userArr = Array.from(this.wrongQSelectedIdx).map((i) => String(i)).sort().join(",");
    this.wrongQAnswered = true;

    // 写入错题本（答对递减，答错递增）
    platformStore.recordWrongQuestion({
      questionId: q.questionId,
      source: q.source,
      questionType: q.questionType,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      userAnswer: userArr,
      category: q.category,
      relatedCaseId: q.relatedCaseId,
      explanation: q.explanation,
      correct,
    });

    playSfx(correct ? "good" : "bad");
    vibrateShort();
  }

  /** 渲染单个主线章节卡片（v8：使用 STORY_CHAPTERS_FULL + stages 进度） */
  private renderChapterCard(
    ctx: CanvasRenderingContext2D,
    idx: number,
    chapter: StoryChapterFull,
    screenW: number,
  ): void {
    const rect = this.getChapterCardRect(idx, screenW);
    const isCompleted = this.isChapterDone(chapter);
    const isUnlocked = this.isChapterUnlocked(chapter);
    const isLocked = !isUnlocked;
    const accent = chapter.accent;
    const isExpanded = this.expandedChapterId === chapter.id;
    const doneCount = this.chapterDoneCount(chapter);
    const totalStages = chapter.stages.length;

    // 卡片背景
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      bgColor: isLocked ? "rgba(20, 30, 45, 0.4)" : withAlpha(accent, 0.05),
      borderColor: isExpanded ? accent : (isLocked ? withAlpha(Theme.colors.bg.line, 0.3) : withAlpha(accent, 0.4)),
      borderWidth: isExpanded ? 2 : 1,
    });

    // 左侧：emoji + 序号
    ctx.save();
    ctx.font = `900 24px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = isLocked ? "transparent" : withAlpha(accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(isLocked ? "🔒" : chapter.emoji, rect.x + 28, rect.y + rect.h / 2);
    ctx.shadowBlur = 0;
    ctx.font = `400 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`CH.${String(chapter.order).padStart(2, "0")}`, rect.x + 28, rect.y + 4);
    ctx.restore();

    // 中间：标题 + 副标题
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(chapter.title, rect.x + 60, rect.y + 10);
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(chapter.subtitle, rect.x + 60, rect.y + 28);
    ctx.restore();

    // 进度条 + 文本
    const barX = rect.x + 60;
    const barY = rect.y + rect.h - 14;
    const barW = rect.w - 60 - 120;
    const barH = 4;
    ctx.save();
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.5);
    roundRect(ctx, barX, barY, barW, barH, 2);
    ctx.fill();
    const progress = totalStages > 0 ? doneCount / totalStages : 0;
    if (progress > 0) {
      ctx.fillStyle = accent;
      roundRect(ctx, barX, barY, barW * progress, barH, 2);
      ctx.fill();
    }
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : withAlpha(Theme.colors.ink.muted, 0.8);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${doneCount}/${totalStages} 关`, barX, barY - 2);
    ctx.restore();

    // 右侧：状态 + 推荐战力
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    if (isCompleted) {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✅ 已通关", rect.x + rect.w - 12, rect.y + 18);
    } else if (isLocked) {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText("🔒 未解锁", rect.x + rect.w - 12, rect.y + 18);
    } else {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = accent;
      ctx.fillText("⚔️ 进行中", rect.x + rect.w - 12, rect.y + 18);
    }
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`战力 ${chapter.recommendedPower}`, rect.x + rect.w - 12, rect.y + 36);
    ctx.restore();
  }

  /** 渲染单个探员支线卡片 */
  private renderAgentCard(
    ctx: CanvasRenderingContext2D,
    idx: number,
    quest: AgentStoryQuest,
    screenW: number,
  ): void {
    const rect = this.getAgentCardRect(idx, screenW);
    const agent = AGENTS.find((a) => a.id === quest.agentId);
    const isUnlocked = this.isAgentUnlocked(quest.agentId);
    const isLocked = !isUnlocked;
    const isCompleted = this.isAgentQuestDone(quest);
    const accent = agent?.color ?? Theme.accents.manager;
    const isExpanded = this.expandedAgentId === quest.agentId;
    const doneCount = this.agentChapterDoneCount(quest);
    const totalCh = quest.chapters.length;

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      bgColor: isLocked ? "rgba(20, 30, 45, 0.4)" : withAlpha(accent, 0.05),
      borderColor: isExpanded ? accent : (isLocked ? withAlpha(Theme.colors.bg.line, 0.3) : withAlpha(accent, 0.4)),
      borderWidth: isExpanded ? 2 : 1,
    });

    // 左侧：探员 emoji
    ctx.save();
    ctx.font = `900 24px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = isLocked ? "transparent" : withAlpha(accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText(isLocked ? "🔒" : (agent?.emoji ?? "❓"), rect.x + 28, rect.y + rect.h / 2);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 中间：标题 + 简介
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(quest.title, rect.x + 60, rect.y + 10);
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : withAlpha(Theme.colors.ink.muted, 0.9);
    const summary = truncateText(ctx, quest.summary, rect.w - 60 - 120);
    ctx.fillText(summary, rect.x + 60, rect.y + 28);
    ctx.restore();

    // 进度条
    const barX = rect.x + 60;
    const barY = rect.y + rect.h - 14;
    const barW = rect.w - 60 - 120;
    const barH = 4;
    ctx.save();
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.5);
    roundRect(ctx, barX, barY, barW, barH, 2);
    ctx.fill();
    const progress = totalCh > 0 ? doneCount / totalCh : 0;
    if (progress > 0) {
      ctx.fillStyle = accent;
      roundRect(ctx, barX, barY, barW * progress, barH, 2);
      ctx.fill();
    }
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : withAlpha(Theme.colors.ink.muted, 0.8);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${doneCount}/${totalCh} 战`, barX, barY - 2);
    ctx.restore();

    // 右侧：状态 + 奖励
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    if (isCompleted) {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✅ 已通关", rect.x + rect.w - 12, rect.y + 18);
    } else if (isLocked) {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText("🔒 未解锁", rect.x + rect.w - 12, rect.y + 18);
    } else {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = accent;
      ctx.fillText("⚔️ 可挑战", rect.x + rect.w - 12, rect.y + 18);
    }
    const rewardText = quest.reward.skinId ? "🎁 专属皮肤" : quest.reward.relicId ? "🎁 专属遗物" : `🎁 ${quest.reward.talentPoints} 天赋`;
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(rewardText, rect.x + rect.w - 12, rect.y + 36);
    ctx.restore();
  }

  /** 渲染主线章节详情弹窗（v8：含 stages 列表） */
  private renderChapterDetailOverlay(
    ctx: CanvasRenderingContext2D,
    chapter: StoryChapterFull,
    screenW: number,
    screenH: number,
  ): void {
    const detail = this.getDetailRect(screenW, screenH);
    const accent = chapter.accent;
    const isCompleted = this.isChapterDone(chapter);

    // 遮罩
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    // 面板
    drawPanel(ctx, detail.x, detail.y, detail.w, detail.h, {
      bgColor: "rgba(15, 25, 40, 0.96)",
      borderColor: accent,
      borderWidth: 2,
      cut: 10,
    });
    drawNeonCorners(ctx, detail.x, detail.y, detail.w, detail.h, accent, 12, 2, 6);

    // 关闭按钮
    const closeBtn = this.getCloseBtnRect(detail);
    drawButton(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "close",
    });
    drawIcon(ctx, "x", closeBtn.x + 6, closeBtn.y + 6, 16, Theme.colors.ink.muted);

    // 标题区
    ctx.save();
    ctx.font = `900 24px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.5);
    ctx.shadowBlur = 12;
    ctx.fillText(`${chapter.emoji} ${chapter.title}`, detail.x + 20, detail.y + 16);
    ctx.shadowBlur = 0;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(`${chapter.subtitle} · ${chapter.background}`, detail.x + 20, detail.y + 48);
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = accent;
    ctx.fillText(`序章 · ${chapter.prologue[0]?.speaker ?? ""}：${truncateText(ctx, chapter.prologue[0]?.text ?? "", detail.w - 100)}`, detail.x + 20, detail.y + 68);
    ctx.restore();

    // Stages 列表
    for (let i = 0; i < chapter.stages.length; i++) {
      this.renderStageRow(ctx, chapter, i, detail);
    }

    // 终章对白（已通关时显示）
    if (isCompleted && chapter.epilogue.length > 0) {
      const epiY = detail.y + 96 + chapter.stages.length * (STAGE_ROW_H + STAGE_ROW_GAP) + 8;
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`🎬 终章 · ${chapter.epilogue[0]?.speaker ?? ""}：${truncateText(ctx, chapter.epilogue[0]?.text ?? "", detail.w - 100)}`, detail.x + 20, epiY);
      ctx.restore();
    }
  }

  /** 渲染 stage 行 */
  private renderStageRow(
    ctx: CanvasRenderingContext2D,
    chapter: StoryChapterFull,
    stageIdx: number,
    detail: Rect,
  ): void {
    const stage = chapter.stages[stageIdx];
    const rect = this.getStageRowRect(stageIdx, detail);
    const isDone = this.isStageDone(chapter.id, stage.order);
    const isUnlocked = this.isStageUnlocked(chapter, stage.order);
    const isLocked = !isUnlocked;
    const pressed = this.pressedButton === `stage-${stageIdx}`;
    const accent = chapter.accent;

    ctx.save();
    ctx.fillStyle = isDone
      ? withAlpha(Theme.colors.safe.DEFAULT, 0.12)
      : pressed
      ? withAlpha(accent, 0.2)
      : isLocked
      ? "rgba(20, 30, 45, 0.4)"
      : withAlpha(accent, 0.08);
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 4);
    ctx.fill();
    ctx.strokeStyle = isDone ? withAlpha(Theme.colors.safe.DEFAULT, 0.6) : isLocked ? withAlpha(Theme.colors.bg.line, 0.3) : withAlpha(accent, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 左侧：序号 + 难度星
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${String(stage.order).padStart(2, "0")}`, rect.x + 8, rect.y + rect.h / 2);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : withAlpha(Theme.colors.ink.muted, 0.8);
    const stars = "★".repeat(stage.difficulty) + "☆".repeat(Math.max(0, 5 - stage.difficulty));
    ctx.fillText(stars, rect.x + 28, rect.y + rect.h / 2);
    ctx.restore();

    // 中间：标题 + 简介
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.body}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(stage.title, rect.x + 86, rect.y + rect.h / 2);
    ctx.restore();

    // 右侧：状态 + 推荐战力
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = `700 10px ${Theme.fonts.display}`;
    if (isDone) {
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✅", rect.x + rect.w - 12, rect.y + rect.h / 2);
    } else if (isLocked) {
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText("🔒", rect.x + rect.w - 12, rect.y + rect.h / 2);
    } else {
      ctx.fillStyle = accent;
      ctx.fillText("⚔️", rect.x + rect.w - 12, rect.y + rect.h / 2);
    }
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`战力 ${stage.recommendedPower}`, rect.x + rect.w - 36, rect.y + rect.h / 2);
    ctx.restore();
  }

  /** 渲染探员支线详情弹窗 */
  private renderAgentDetailOverlay(
    ctx: CanvasRenderingContext2D,
    quest: AgentStoryQuest,
    screenW: number,
    screenH: number,
  ): void {
    const detail = this.getDetailRect(screenW, screenH);
    const agent = AGENTS.find((a) => a.id === quest.agentId);
    const accent = agent?.color ?? Theme.accents.manager;
    const isUnlocked = this.isAgentUnlocked(quest.agentId);
    const isCompleted = this.isAgentQuestDone(quest);

    // 遮罩
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    drawPanel(ctx, detail.x, detail.y, detail.w, detail.h, {
      bgColor: "rgba(15, 25, 40, 0.96)",
      borderColor: accent,
      borderWidth: 2,
      cut: 10,
    });
    drawNeonCorners(ctx, detail.x, detail.y, detail.w, detail.h, accent, 12, 2, 6);

    // 关闭按钮
    const closeBtn = this.getCloseBtnRect(detail);
    drawButton(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "close",
    });
    drawIcon(ctx, "x", closeBtn.x + 6, closeBtn.y + 6, 16, Theme.colors.ink.muted);

    // 标题区
    ctx.save();
    ctx.font = `900 24px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.5);
    ctx.shadowBlur = 12;
    ctx.fillText(`${agent?.emoji ?? "❓"} ${quest.title}`, detail.x + 20, detail.y + 16);
    ctx.shadowBlur = 0;
    ctx.font = `400 11px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(`探员：${agent?.name ?? quest.agentId} · ${quest.chapters.length} 战`, detail.x + 20, detail.y + 48);
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
    ctx.fillText(truncateText(ctx, quest.summary, detail.w - 60), detail.x + 20, detail.y + 68);
    // 奖励行
    const rewardText = [
      quest.reward.skinId ? "🎁 专属皮肤" : null,
      quest.reward.relicId ? "🎁 专属遗物" : null,
      `🎁 ${quest.reward.talentPoints} 天赋点`,
    ].filter(Boolean).join("  ·  ");
    ctx.font = `700 10px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.fillText(rewardText, detail.x + 20, detail.y + 88);
    ctx.restore();

    if (!isUnlocked) {
      // 未解锁探员提示
      ctx.save();
      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔒 该探员尚未解锁，请先在「探员招募」中解锁", detail.x + detail.w / 2, detail.y + detail.h / 2);
      ctx.restore();
      return;
    }

    // Chapter 列表
    for (let i = 0; i < quest.chapters.length; i++) {
      this.renderAgentChapterRow(ctx, quest, i, detail);
    }

    // 完成提示
    if (isCompleted) {
      const tipY = detail.y + 140 + quest.chapters.length * (STAGE_ROW_H + STAGE_ROW_GAP) + 8;
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("✅ 该支线已全部通关，奖励已发放", detail.x + 20, tipY);
      ctx.restore();
    }
  }

  /** 渲染探员支线 chapter 行 */
  private renderAgentChapterRow(
    ctx: CanvasRenderingContext2D,
    quest: AgentStoryQuest,
    chIdx: number,
    detail: Rect,
  ): void {
    const ch = quest.chapters[chIdx];
    const rect = this.getAgentChapterRowRect(chIdx, detail);
    const isDone = this.isAgentChapterDone(quest.agentId, ch.order);
    const isUnlocked = this.isAgentChapterUnlocked(quest, ch.order);
    const isLocked = !isUnlocked;
    const pressed = this.pressedButton === `agent-ch-${chIdx}`;
    const agent = AGENTS.find((a) => a.id === quest.agentId);
    const accent = agent?.color ?? Theme.accents.manager;

    ctx.save();
    ctx.fillStyle = isDone
      ? withAlpha(Theme.colors.safe.DEFAULT, 0.12)
      : pressed
      ? withAlpha(accent, 0.2)
      : isLocked
      ? "rgba(20, 30, 45, 0.4)"
      : withAlpha(accent, 0.08);
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 4);
    ctx.fill();
    ctx.strokeStyle = isDone ? withAlpha(Theme.colors.safe.DEFAULT, 0.6) : isLocked ? withAlpha(Theme.colors.bg.line, 0.3) : withAlpha(accent, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 左侧：序号
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`第${ch.order}战`, rect.x + 8, rect.y + rect.h / 2);
    ctx.restore();

    // 中间：标题 + BOSS 标记
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.body}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(ch.title, rect.x + 56, rect.y + rect.h / 2);
    if (ch.bossId) {
      ctx.font = `700 9px ${Theme.fonts.display}`;
      ctx.fillStyle = "#FF3B6B";
      ctx.fillText("BOSS", rect.x + 56 + ctx.measureText(ch.title).width + 8, rect.y + rect.h / 2);
    }
    ctx.restore();

    // 右侧：状态 + 推荐战力
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = `700 10px ${Theme.fonts.display}`;
    if (isDone) {
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✅", rect.x + rect.w - 12, rect.y + rect.h / 2);
    } else if (isLocked) {
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText("🔒", rect.x + rect.w - 12, rect.y + rect.h / 2);
    } else {
      ctx.fillStyle = accent;
      ctx.fillText("⚔️", rect.x + rect.w - 12, rect.y + rect.h / 2);
    }
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(`战力 ${ch.recommendedPower}`, rect.x + rect.w - 36, rect.y + rect.h / 2);
    ctx.restore();
  }

  // ====================================================================
  // 交互
  // ====================================================================

  handleTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;

    if (type === "start") {
      this.pressedButton = null;

      // v11：受害者模拟弹窗优先
      if (this.victimSimScenarioId) {
        const detail = this.getVictimSimPlayRect(screenW, screenH);
        const closeBtn = this.getCloseBtnRect(detail);
        if (hitTest(x, y, closeBtn)) { this.pressedButton = "vic-close"; return true; }
        if (!hitTest(x, y, detail)) { this.pressedButton = "vic-close"; return true; }
        if (this.victimSimMode === "ending") {
          if (this.lastVictimSimEndBtn && hitTest(x, y, this.lastVictimSimEndBtn)) {
            this.pressedButton = "vic-endback";
          }
          return true;
        }
        // play / feedback 模式
        if (this.victimSimLastChoice) {
          if (this.lastVictimSimContinueBtn && hitTest(x, y, this.lastVictimSimContinueBtn)) {
            this.pressedButton = "vic-continue";
          }
          return true;
        }
        // 选项
        for (let i = 0; i < this.lastVictimSimChoiceRects.length; i++) {
          if (hitTest(x, y, this.lastVictimSimChoiceRects[i])) {
            this.pressedButton = `vic-choice-${i}`;
            return true;
          }
        }
        return true;
      }

      // 主线章节详情弹窗优先
      if (this.expandedChapterId) {
        const chapter = STORY_CHAPTERS_FULL.find((c) => c.id === this.expandedChapterId);
        if (chapter) {
          const detail = this.getDetailRect(screenW, screenH);
          const closeBtn = this.getCloseBtnRect(detail);
          if (hitTest(x, y, closeBtn)) { this.pressedButton = "close"; return true; }
          // 点击面板外区域关闭
          if (!hitTest(x, y, detail)) { this.pressedButton = "close"; return true; }
          // stage 行
          for (let i = 0; i < chapter.stages.length; i++) {
            const rect = this.getStageRowRect(i, detail);
            if (hitTest(x, y, rect)) {
              const stage = chapter.stages[i];
              if (this.isStageUnlocked(chapter, stage.order)) {
                this.pressedButton = `stage-${i}`;
              } else {
                this.pressedButton = `stage-locked-${i}`;
              }
              return true;
            }
          }
          return true;
        }
      }

      // 探员支线详情弹窗
      if (this.expandedAgentId) {
        const quest = AGENT_STORY_QUESTS.find((q) => q.agentId === this.expandedAgentId);
        if (quest) {
          const detail = this.getDetailRect(screenW, screenH);
          const closeBtn = this.getCloseBtnRect(detail);
          if (hitTest(x, y, closeBtn)) { this.pressedButton = "close"; return true; }
          if (!hitTest(x, y, detail)) { this.pressedButton = "close"; return true; }
          // 未解锁探员：只允许关闭
          if (!this.isAgentUnlocked(quest.agentId)) return true;
          // chapter 行
          for (let i = 0; i < quest.chapters.length; i++) {
            const rect = this.getAgentChapterRowRect(i, detail);
            if (hitTest(x, y, rect)) {
              const ch = quest.chapters[i];
              if (this.isAgentChapterUnlocked(quest, ch.order)) {
                this.pressedButton = `agent-ch-${i}`;
              } else {
                this.pressedButton = `agent-ch-locked-${i}`;
              }
              return true;
            }
          }
          return true;
        }
      }

      // v9 Phase 4.5：错题重练弹窗优先
      if (this.expandedWrongQKey) {
        const detail = this.getWrongQDetailRect(screenW, screenH);
        const closeBtn = this.getCloseBtnRect(detail);
        if (hitTest(x, y, closeBtn)) { this.pressedButton = "wq-close"; return true; }
        if (!hitTest(x, y, detail)) { this.pressedButton = "wq-close"; return true; }
        const q = this.getExpandedWrongQ();
        if (q && !this.wrongQAnswered) {
          // 选项点击（使用渲染时缓存的矩形）
          for (let i = 0; i < this.lastWrongQOptRects.length; i++) {
            if (hitTest(x, y, this.lastWrongQOptRects[i])) {
              this.pressedButton = `wq-opt-${i}`;
              return true;
            }
          }
          // 提交按钮
          if (this.lastWrongQBtnRect && this.wrongQSelectedIdx.size > 0
              && hitTest(x, y, this.lastWrongQBtnRect)) {
            this.pressedButton = "wq-submit";
          }
        } else if (q && this.wrongQAnswered) {
          // 完成按钮
          if (this.lastWrongQBtnRect && hitTest(x, y, this.lastWrongQBtnRect)) {
            this.pressedButton = "wq-done";
          }
        }
        return true;
      }

      // 返回按钮
      const backBtn = this.getBackBtnRect();
      if (hitTest(x, y, backBtn)) { this.pressedButton = "back"; return true; }

      // Tab 切换
      const tabKeys: StoryTab[] = ["main", "agent", "wrong", "victim"];
      for (let i = 0; i < tabKeys.length; i++) {
        const rect = this.getTabRect(i, screenW);
        if (hitTest(x, y, rect)) {
          this.pressedButton = `tab-${tabKeys[i]}`;
          return true;
        }
      }

      // 主线章节卡片
      if (this.currentTab === "main") {
        for (let i = 0; i < STORY_CHAPTERS_FULL.length; i++) {
          const rect = this.getChapterCardRect(i, screenW);
          if (hitTest(x, y, rect)) {
            const chapter = STORY_CHAPTERS_FULL[i];
            if (this.isChapterUnlocked(chapter)) {
              this.pressedButton = `chapter-${i}`;
            } else {
              this.pressedButton = `chapter-locked-${i}`;
            }
            return true;
          }
        }
      } else if (this.currentTab === "agent") {
        // 探员支线卡片
        for (let i = 0; i < AGENT_STORY_QUESTS.length; i++) {
          const rect = this.getAgentCardRect(i, screenW);
          if (hitTest(x, y, rect)) {
            const quest = AGENT_STORY_QUESTS[i];
            // 即使锁定也允许点开看详情（详情里会提示未解锁）
            this.pressedButton = `agent-${i}`;
            return true;
          }
        }
      } else if (this.currentTab === "wrong") {
        // v9 Phase 4.5：错题强化 Tab
        // 筛选按钮
        const filters: WrongQFilter[] = ["all", "quiz", "dialog", "case", "battle"];
        for (let i = 0; i < filters.length; i++) {
          const rect = this.getWrongQFilterRect(i, screenW);
          if (hitTest(x, y, rect)) {
            this.pressedButton = `wq-filter-${filters[i]}`;
            return true;
          }
        }
        // 错题卡片
        for (let i = 0; i < this.lastWrongQRects.length; i++) {
          if (hitTest(x, y, this.lastWrongQRects[i])) {
            this.pressedButton = `wq-${i}`;
            return true;
          }
        }
      } else if (this.currentTab === "victim") {
        // v11：受害者模拟 Tab
        for (let i = 0; i < this.lastVictimSimCardRects.length; i++) {
          if (hitTest(x, y, this.lastVictimSimCardRects[i])) {
            const scenario = VICTIM_SIM_SCENARIOS_V11[i];
            this.pressedButton = `vic-card-${scenario.id}`;
            return true;
          }
        }
      }
      return true;
    } else if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;
      if (!pressed) return true;

      // Tab 切换不触发音效（避免和 click 叠音）
      if (pressed === "tab-main") {
        if (this.currentTab !== "main") {
          this.currentTab = "main";
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      if (pressed === "tab-agent") {
        if (this.currentTab !== "agent") {
          this.currentTab = "agent";
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      if (pressed === "tab-wrong") {
        if (this.currentTab !== "wrong") {
          this.currentTab = "wrong";
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      if (pressed === "tab-victim") {
        if (this.currentTab !== "victim") {
          this.currentTab = "victim";
          playSfx("click");
          vibrateShort();
        }
        return true;
      }

      playSfx("click");
      vibrateShort();

      if (pressed === "back") {
        this.director.pop();
        return true;
      }
      if (pressed === "close") {
        this.expandedChapterId = null;
        this.expandedAgentId = null;
        return true;
      }

      // v11：受害者模拟弹窗交互
      if (pressed === "vic-close" || pressed === "vic-endback") {
        this.closeVictimSim();
        return true;
      }
      if (pressed === "vic-continue") {
        this.advanceVictimSim();
        return true;
      }
      if (pressed.startsWith("vic-choice-")) {
        const idx = parseInt(pressed.slice("vic-choice-".length), 10);
        const scenario = this.getVictimSimScenario();
        const node = scenario ? this.getVictimSimCurrentNode(scenario) : null;
        if (scenario && node && node.choices[idx]) {
          this.applyVictimSimChoice(node.choices[idx]);
        }
        return true;
      }
      if (pressed.startsWith("vic-card-")) {
        const id = pressed.slice("vic-card-".length);
        const scenario = VICTIM_SIM_SCENARIOS_V11.find((s) => s.id === id);
        if (scenario) {
          this.startVictimSim(scenario);
        }
        return true;
      }

      // v9 Phase 4.5：错题重练弹窗交互
      if (pressed === "wq-close") {
        this.expandedWrongQKey = null;
        this.wrongQSelectedIdx.clear();
        this.wrongQAnswered = false;
        return true;
      }
      if (pressed === "wq-submit") {
        this.submitWrongQAnswer();
        return true;
      }
      if (pressed === "wq-done") {
        this.expandedWrongQKey = null;
        this.wrongQSelectedIdx.clear();
        this.wrongQAnswered = false;
        return true;
      }
      if (pressed.startsWith("wq-opt-")) {
        const idx = parseInt(pressed.slice("wq-opt-".length), 10);
        const q = this.getExpandedWrongQ();
        if (q && !this.wrongQAnswered) {
          if (q.questionType === "multi") {
            if (this.wrongQSelectedIdx.has(idx)) {
              this.wrongQSelectedIdx.delete(idx);
            } else {
              this.wrongQSelectedIdx.add(idx);
            }
          } else {
            this.wrongQSelectedIdx.clear();
            this.wrongQSelectedIdx.add(idx);
          }
        }
        return true;
      }
      if (pressed.startsWith("wq-filter-")) {
        const filter = pressed.slice("wq-filter-".length) as WrongQFilter;
        this.wrongQFilter = filter;
        return true;
      }
      if (pressed.startsWith("wq-")) {
        // 错题卡片点击 → 展开重练弹窗
        const idx = parseInt(pressed.slice("wq-".length), 10);
        const list = this.getFilteredWrongQuestions();
        const q = list[idx];
        if (q) {
          this.expandedWrongQKey = `${q.source}::${q.questionId}`;
          this.wrongQSelectedIdx.clear();
          this.wrongQAnswered = false;
        }
        return true;
      }

      // 主线 stage 点击 → 进入 bossRush（先匹配 locked 变体，避免前缀冲突）
      if (pressed.startsWith("stage-locked-")) {
        playSfx("bad");
        return true;
      }
      if (pressed.startsWith("stage-")) {
        const idx = parseInt(pressed.slice("stage-".length), 10);
        const chapter = STORY_CHAPTERS_FULL.find((c) => c.id === this.expandedChapterId);
        if (chapter && chapter.stages[idx]) {
          this.startStoryBattle(chapter, chapter.stages[idx].order);
        }
        return true;
      }

      // 探员 chapter 点击 → 进入 bossRush
      if (pressed.startsWith("agent-ch-locked-")) {
        playSfx("bad");
        return true;
      }
      if (pressed.startsWith("agent-ch-")) {
        const idx = parseInt(pressed.slice("agent-ch-".length), 10);
        const quest = AGENT_STORY_QUESTS.find((q) => q.agentId === this.expandedAgentId);
        if (quest && quest.chapters[idx]) {
          this.startAgentBattle(quest, quest.chapters[idx].order);
        }
        return true;
      }

      // 主线章节卡点击 → 展开详情
      if (pressed.startsWith("chapter-locked-")) {
        playSfx("bad");
        return true;
      }
      if (pressed.startsWith("chapter-")) {
        const idx = parseInt(pressed.slice("chapter-".length), 10);
        const chapter = STORY_CHAPTERS_FULL[idx];
        if (chapter) {
          this.expandedChapterId = chapter.id;
        }
        return true;
      }

      // 探员卡点击 → 展开详情（放最后，因为 "agent-" 是 "agent-ch-" 的前缀）
      if (pressed.startsWith("agent-")) {
        const idx = parseInt(pressed.slice("agent-".length), 10);
        const quest = AGENT_STORY_QUESTS[idx];
        if (quest) {
          this.expandedAgentId = quest.agentId;
        }
        return true;
      }
      return true;
    }
    return true;
  }

  /** 进入主线 stage 战斗（bossRush 模式） */
  private startStoryBattle(_chapter: StoryChapterFull, _stageOrder: number): void {
    const deploy = new ManagerDeployScene(this.director);
    this.director.push(deploy, { mode: "bossRush" });
  }

  /** 进入探员支线 chapter 战斗（bossRush 模式） */
  private startAgentBattle(_quest: AgentStoryQuest, _chapterOrder: number): void {
    const deploy = new ManagerDeployScene(this.director);
    this.director.push(deploy, { mode: "bossRush" });
  }

  // ====================================================================
  // v11：受害者模拟（第一人称识骗演练）
  // ====================================================================

  /** 受害者模拟剧本卡片矩形 */
  private getVictimSimCardRect(idx: number, screenW: number): Rect {
    const w = screenW - PAD * 2;
    return {
      x: PAD,
      y: 48 + TAB_H + 12 + idx * (CARD_H + CARD_GAP),
      w,
      h: CARD_H,
    };
  }

  /** 受害者模拟剧情面板矩形（居中弹窗） */
  private getVictimSimPlayRect(screenW: number, screenH: number): Rect {
    const w = Math.min(620, screenW - 32);
    const h = Math.min(540, screenH - 32);
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
  }

  /** 当前受害者模拟剧本 */
  private getVictimSimScenario(): VictimSimScenario | null {
    if (!this.victimSimScenarioId) return null;
    return VICTIM_SIM_SCENARIOS_V11.find((s) => s.id === this.victimSimScenarioId) ?? null;
  }

  /** 当前节点 */
  private getVictimSimCurrentNode(scenario: VictimSimScenario) {
    if (!this.victimSimNodeId) return null;
    return scenario.nodes.find((n) => n.id === this.victimSimNodeId) ?? null;
  }

  /** 剧本是否已通关 */
  private isVictimSimDone(scenarioId: string): boolean {
    return platformStore.managerMetaProgress().completedVictimSimScenarios.includes(scenarioId);
  }

  /** 剧本最佳评级（未通关返回 null） */
  private getVictimSimBestRank(scenarioId: string): "S" | "A" | "B" | "C" | "D" | null {
    const meta = platformStore.managerMetaProgress();
    if (!meta.completedVictimSimScenarios.includes(scenarioId)) return null;
    return meta.victimSimBestRanks[scenarioId] ?? null;
  }

  /** 评级对应颜色 */
  private victimSimRankColor(rank: "S" | "A" | "B" | "C" | "D"): string {
    switch (rank) {
      case "S": return "#FFD700";
      case "A": return "#52C41A";
      case "B": return "#00E5FF";
      case "C": return "#FFB020";
      case "D": return "#E5353B";
    }
  }

  /** 选项 verdict 对应颜色 */
  private victimSimVerdictColor(verdict: VictimSimChoice["verdict"]): string {
    switch (verdict) {
      case "perfect": return "#52C41A";
      case "ok": return "#00E5FF";
      case "warn": return "#FFB020";
      case "wrong": return "#E5353B";
    }
  }

  /** 选项 verdict 对应中文标签 */
  private victimSimVerdictLabel(verdict: VictimSimChoice["verdict"]): string {
    switch (verdict) {
      case "perfect": return "最佳应对";
      case "ok": return "正确";
      case "warn": return "有风险";
      case "wrong": return "致命错误";
    }
  }

  /** 根据累计警觉值/损失值计算结局（按评级从高到低匹配首个满足条件的） */
  private computeVictimSimEnding(
    scenario: VictimSimScenario,
    awareness: number,
    loss: number,
  ): VictimSimEnding {
    const rankOrder: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
    const sorted = [...scenario.endings].sort((a, b) => rankOrder[b.rank] - rankOrder[a.rank]);
    for (const e of sorted) {
      if (awareness >= e.minAwareness && loss <= e.maxLoss) return e;
    }
    return sorted[sorted.length - 1] ?? scenario.endings[0];
  }

  /** 渲染受害者模拟 Tab 内容（剧本列表） */
  private renderVictimSimTab(ctx: CanvasRenderingContext2D, screenW: number): void {
    const meta = platformStore.managerMetaProgress();
    const doneCount = VICTIM_SIM_SCENARIOS_V11.filter(
      (s) => meta.completedVictimSimScenarios.includes(s.id),
    ).length;

    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `// VICTIM SIMULATION · ${doneCount}/${VICTIM_SIM_SCENARIOS_V11.length} 剧本已通关 · 第一人称识骗演练`,
      PAD,
      48 + TAB_H + 2,
    );
    ctx.restore();

    this.lastVictimSimCardRects = [];
    for (let i = 0; i < VICTIM_SIM_SCENARIOS_V11.length; i++) {
      const rect = this.getVictimSimCardRect(i, screenW);
      this.lastVictimSimCardRects.push(rect);
      this.renderVictimSimCard(ctx, rect, VICTIM_SIM_SCENARIOS_V11[i]);
    }
  }

  /** 渲染单个受害者模拟剧本卡片 */
  private renderVictimSimCard(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    scenario: VictimSimScenario,
  ): void {
    const isDone = this.isVictimSimDone(scenario.id);
    const bestRank = this.getVictimSimBestRank(scenario.id);
    const accent = Theme.accents.manager;
    const isPressed = this.pressedButton === `vic-card-${scenario.id}`;

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      bgColor: isPressed ? withAlpha(accent, 0.12) : withAlpha(accent, 0.05),
      borderColor: isPressed ? accent : withAlpha(accent, 0.4),
      borderWidth: isPressed ? 1.5 : 1,
    });

    // 左侧：图标
    ctx.save();
    ctx.font = `900 22px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(accent, 0.4);
    ctx.shadowBlur = 8;
    ctx.fillText("🪤", rect.x + 26, rect.y + rect.h / 2);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 中间：标题 + 画像/类型
    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(scenario.title, rect.x + 56, rect.y + 8);
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(
      `${scenario.typeName} · ${scenario.victimProfile}`,
      rect.x + 56,
      rect.y + 26,
    );
    // 难度星
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.8);
    const stars = "★".repeat(scenario.difficulty) + "☆".repeat(Math.max(0, 4 - scenario.difficulty));
    ctx.fillText(`难度 ${stars}`, rect.x + 56, rect.y + 42);
    ctx.restore();

    // 右侧：状态
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    if (isDone && bestRank) {
      ctx.font = `900 18px ${Theme.fonts.display}`;
      const rankColor = this.victimSimRankColor(bestRank);
      ctx.fillStyle = rankColor;
      ctx.shadowColor = withAlpha(rankColor, 0.5);
      ctx.shadowBlur = 8;
      ctx.fillText(bestRank, rect.x + rect.w - 12, rect.y + 20);
      ctx.shadowBlur = 0;
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("已通关", rect.x + rect.w - 12, rect.y + 40);
    } else {
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = accent;
      ctx.fillText("▶ 体验", rect.x + rect.w - 12, rect.y + 18);
      ctx.font = `400 9px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText("未通关", rect.x + rect.w - 12, rect.y + 36);
    }
    ctx.restore();
  }

  /** 渲染受害者模拟剧情/结局弹窗 */
  private renderVictimSimPlayOverlay(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
  ): void {
    const scenario = this.getVictimSimScenario();
    if (!scenario) return;

    // 半透明遮罩
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    const detail = this.getVictimSimPlayRect(screenW, screenH);
    const accent = Theme.accents.manager;

    drawPanel(ctx, detail.x, detail.y, detail.w, detail.h, {
      bgColor: "rgba(12, 20, 35, 0.97)",
      borderColor: accent,
      borderWidth: 2,
      cut: 10,
    });
    drawNeonCorners(ctx, detail.x, detail.y, detail.w, detail.h, accent, 12, 2, 6);

    // 关闭按钮
    const closeBtn = this.getCloseBtnRect(detail);
    drawButton(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, "", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "vic-close",
    });
    drawIcon(ctx, "x", closeBtn.x + 6, closeBtn.y + 6, 16, Theme.colors.ink.muted);

    if (this.victimSimMode === "ending") {
      this.renderVictimSimEnding(ctx, scenario, detail);
      return;
    }

    // ===== play / feedback 模式 =====
    const node = this.getVictimSimCurrentNode(scenario);
    if (!node) return;

    // 标题区
    ctx.save();
    ctx.font = `900 18px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = withAlpha(accent, 0.5);
    ctx.shadowBlur = 10;
    ctx.fillText(`🪤 ${scenario.title}`, detail.x + 20, detail.y + 14);
    ctx.shadowBlur = 0;
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(
      `${scenario.typeName} · ${scenario.victimProfile}`,
      detail.x + 20,
      detail.y + 38,
    );
    // 节点标题
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = withAlpha(accent, 0.85);
    ctx.fillText(node.title, detail.x + 20, detail.y + 54);
    ctx.restore();

    let curY = detail.y + 76;

    // 场景描述（第一人称）
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const sceneLines = this.wrapWrongQText(ctx, node.scene, detail.w - 40);
    for (const line of sceneLines) {
      ctx.fillText(line, detail.x + 20, curY);
      curY += 16;
    }
    ctx.restore();
    curY += 6;

    // 骗子话术框
    const scamLines = this.wrapWrongQText(ctx, node.scammerLine, detail.w - 72);
    const scammerH = Math.max(36, scamLines.length * 14 + 16);
    ctx.save();
    ctx.fillStyle = withAlpha("#FF3B6B", 0.10);
    roundRect(ctx, detail.x + 20, curY, detail.w - 40, scammerH, 6);
    ctx.fill();
    ctx.strokeStyle = withAlpha("#FF3B6B", 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `700 10px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FF8A9B";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("💬 骗子：", detail.x + 28, curY + 8);
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    let scamY = curY + 8;
    for (const line of scamLines) {
      scamY += 14;
      ctx.fillText(line, detail.x + 40, scamY);
    }
    ctx.restore();
    curY += scammerH + 6;

    // 心理手法 + 红旗 + 警觉/损失
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `心理手法: ${node.psychology.join(" · ")}`,
      detail.x + 20,
      curY,
    );
    curY += 14;
    const stars = "★".repeat(node.redFlag) + "☆".repeat(Math.max(0, 5 - node.redFlag));
    ctx.fillStyle = "#FFB020";
    ctx.fillText(`红旗 ${stars}`, detail.x + 20, curY);
    ctx.fillStyle = Theme.colors.safe.DEFAULT;
    ctx.textAlign = "right";
    ctx.fillText(`警觉 ${this.victimSimAwareness}`, detail.x + detail.w - 90, curY);
    ctx.fillStyle = "#E5353B";
    ctx.fillText(`损失 ${this.victimSimLoss}`, detail.x + detail.w - 20, curY);
    ctx.restore();
    curY += 18;

    // 选项 or 反馈
    if (this.victimSimLastChoice) {
      // 反馈模式
      const choice = this.victimSimLastChoice;
      const vColor = this.victimSimVerdictColor(choice.verdict);
      const vLabel = this.victimSimVerdictLabel(choice.verdict);

      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("你的选择：", detail.x + 20, curY);
      curY += 14;
      ctx.font = `500 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const choiceLines = this.wrapWrongQText(ctx, `${choice.emoji} ${choice.text}`, detail.w - 40);
      for (const line of choiceLines) {
        ctx.fillText(line, detail.x + 20, curY);
        curY += 16;
      }
      curY += 6;

      // 反馈框
      const fbLines = this.wrapWrongQText(ctx, choice.feedback, detail.w - 56);
      const fbH = Math.max(40, fbLines.length * 14 + 32);
      ctx.fillStyle = withAlpha(vColor, 0.12);
      roundRect(ctx, detail.x + 20, curY, detail.w - 40, fbH, 6);
      ctx.fill();
      ctx.strokeStyle = vColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = vColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const icon = choice.verdict === "perfect" ? "✓" : choice.verdict === "wrong" ? "✗" : "!";
      ctx.fillText(`${icon} ${vLabel}`, detail.x + 28, curY + 8);
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      let fbY = curY + 26;
      for (const line of fbLines) {
        ctx.fillText(line, detail.x + 28, fbY);
        fbY += 14;
      }
      ctx.restore();
      curY += fbH + 8;

      // 继续按钮
      const btnW = 140;
      const btnH = 34;
      const btnX = detail.x + (detail.w - btnW) / 2;
      const btnY = Math.min(detail.y + detail.h - 44, curY);
      this.lastVictimSimContinueBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
      this.drawVictimSimButton(ctx, btnX, btnY, btnW, btnH, "继续 ▶", accent, "vic-continue");
    } else {
      // 选项列表
      this.lastVictimSimChoiceRects = [];
      const optH = 36;
      const optGap = 6;
      for (let i = 0; i < node.choices.length; i++) {
        const c = node.choices[i];
        const oy = curY + i * (optH + optGap);
        const ox = detail.x + 20;
        const ow = detail.w - 40;
        this.lastVictimSimChoiceRects.push({ x: ox, y: oy, w: ow, h: optH });
        this.drawVictimSimChoice(ctx, ox, oy, ow, optH, c, i);
      }
    }
  }

  /** 渲染单个选项按钮 */
  private drawVictimSimChoice(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    choice: VictimSimChoice, idx: number,
  ): void {
    const isPressed = this.pressedButton === `vic-choice-${idx}`;
    const accent = Theme.accents.manager;
    const offsetY = isPressed ? 1 : 0;
    ctx.save();
    ctx.fillStyle = isPressed ? withAlpha(accent, 0.25) : withAlpha(accent, 0.08);
    roundRect(ctx, x, y + offsetY, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = isPressed ? accent : withAlpha(accent, 0.5);
    ctx.lineWidth = isPressed ? 1.5 : 1;
    ctx.stroke();
    // emoji
    ctx.font = `900 14px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(choice.emoji, x + 12, y + offsetY + h / 2);
    // text
    ctx.font = `500 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const truncated = this.truncateText(ctx, choice.text, w - 44);
    ctx.fillText(truncated, x + 34, y + offsetY + h / 2);
    // 箭头
    ctx.textAlign = "right";
    ctx.font = `700 12px ${Theme.fonts.display}`;
    ctx.fillStyle = withAlpha(accent, 0.7);
    ctx.fillText("›", x + w - 10, y + offsetY + h / 2);
    ctx.restore();
  }

  /** 渲染结局 */
  private renderVictimSimEnding(
    ctx: CanvasRenderingContext2D,
    scenario: VictimSimScenario,
    detail: Rect,
  ): void {
    const ending = scenario.endings.find((e) => e.id === this.victimSimEndingId);
    if (!ending) return;
    const rankColor = this.victimSimRankColor(ending.rank);
    const accent = Theme.accents.manager;

    // 标题区
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`🪤 ${scenario.title} · 结局`, detail.x + 20, detail.y + 14);
    ctx.restore();

    // 大评级 + 标题
    const rankBoxY = detail.y + 36;
    const rankBoxSize = 56;
    ctx.save();
    ctx.fillStyle = withAlpha(rankColor, 0.18);
    roundRect(ctx, detail.x + 20, rankBoxY, rankBoxSize, rankBoxSize, 8);
    ctx.fill();
    ctx.strokeStyle = rankColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `900 32px ${Theme.fonts.display}`;
    ctx.fillStyle = rankColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(rankColor, 0.6);
    ctx.shadowBlur = 14;
    ctx.fillText(ending.rank, detail.x + 20 + rankBoxSize / 2, rankBoxY + rankBoxSize / 2);
    ctx.shadowBlur = 0;
    // 结局标题
    ctx.font = `700 15px ${Theme.fonts.display}`;
    ctx.fillStyle = rankColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const titleLines = this.wrapWrongQText(ctx, ending.title, detail.w - 100);
    titleLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, detail.x + 90, rankBoxY + 4 + i * 18);
    });
    // kind 标签
    const kindLabel = ending.kind === "busted" ? "✅ 团伙被端"
      : ending.kind === "rescued" ? "🛡️ 成功识破"
      : ending.kind === "partialLoss" ? "⚠️ 部分损失"
      : "💀 全额损失";
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.fillText(kindLabel, detail.x + 90, rankBoxY + 42);
    ctx.restore();

    let curY = rankBoxY + rankBoxSize + 12;

    // 结局描述
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const descLines = this.wrapWrongQText(ctx, ending.desc, detail.w - 40);
    for (const line of descLines) {
      ctx.fillText(line, detail.x + 20, curY);
      curY += 16;
    }
    ctx.restore();
    curY += 6;

    // 弱点情报解锁
    if (ending.weaknessIntel) {
      const intelLines = this.wrapWrongQText(ctx, ending.weaknessIntel.desc, detail.w - 72);
      const intelH = Math.max(48, intelLines.length * 14 + 32);
      ctx.save();
      ctx.fillStyle = withAlpha("#9D6BFF", 0.15);
      roundRect(ctx, detail.x + 20, curY, detail.w - 40, intelH, 6);
      ctx.fill();
      ctx.strokeStyle = "#9D6BFF";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = "#9D6BFF";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("🎯 弱点情报已解锁", detail.x + 28, curY + 8);
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      let intY = curY + 26;
      for (const line of intelLines) {
        ctx.fillText(line, detail.x + 28, intY);
        intY += 14;
      }
      ctx.font = `700 10px ${Theme.fonts.display}`;
      ctx.fillStyle = "#9D6BFF";
      ctx.fillText(
        `塔防中对该敌人 +${Math.round(ending.weaknessIntel.damageBonus * 100)}% 伤害`,
        detail.x + 28,
        curY + intelH - 16,
      );
      ctx.restore();
      curY += intelH + 8;
    }

    // 96110 提示
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.muted, 0.9);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const hotLines = this.wrapWrongQText(ctx, `📞 ${ending.hotline}`, detail.w - 40);
    for (const line of hotLines) {
      ctx.fillText(line, detail.x + 20, curY);
      curY += 14;
    }
    ctx.restore();
    curY += 8;

    // 学习要点
    if (scenario.takeaways.length > 0) {
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = accent;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("📖 学习要点", detail.x + 20, curY);
      ctx.restore();
      curY += 16;
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      for (const t of scenario.takeaways) {
        const tLines = this.wrapWrongQText(ctx, `• ${t}`, detail.w - 48);
        for (const line of tLines) {
          ctx.fillText(line, detail.x + 24, curY);
          curY += 14;
        }
      }
      ctx.restore();
    }

    // 返回列表按钮
    const btnW = 160;
    const btnH = 36;
    const btnX = detail.x + (detail.w - btnW) / 2;
    const btnY = Math.min(detail.y + detail.h - 44, curY + 8);
    this.lastVictimSimEndBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
    this.drawVictimSimButton(ctx, btnX, btnY, btnW, btnH, "返回列表 ✓", accent, "vic-endback");
  }

  /** 绘制按钮（受害者模拟用） */
  private drawVictimSimButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    label: string, color: string, id: string,
  ): void {
    const isPressed = this.pressedButton === id;
    const offsetY = isPressed ? 1 : 0;
    ctx.save();
    ctx.fillStyle = isPressed ? withAlpha(color, 0.35) : withAlpha(color, 0.20);
    roundRect(ctx, x, y + offsetY, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + offsetY + h / 2);
    ctx.restore();
  }

  /** 开始受害者模拟剧本 */
  private startVictimSim(scenario: VictimSimScenario): void {
    this.victimSimScenarioId = scenario.id;
    this.victimSimNodeId = scenario.startNodeId;
    this.victimSimAwareness = 0;
    this.victimSimLoss = 0;
    this.victimSimEndingId = null;
    this.victimSimLastChoice = null;
    this.victimSimMode = "play";
  }

  /** 应用选项选择（累计警觉/损失，进入反馈状态） */
  private applyVictimSimChoice(choice: VictimSimChoice): void {
    this.victimSimAwareness += choice.awarenessDelta ?? 0;
    this.victimSimLoss += choice.lossDelta ?? 0;
    this.victimSimLastChoice = choice;
  }

  /** 从反馈状态继续：进入下一节点或结算结局 */
  private advanceVictimSim(): void {
    const scenario = this.getVictimSimScenario();
    if (!scenario || !this.victimSimLastChoice) return;
    const choice = this.victimSimLastChoice;
    if (choice.nextNodeId === null || choice.nextNodeId === undefined) {
      // 进入结局判定
      const ending = this.computeVictimSimEnding(scenario, this.victimSimAwareness, this.victimSimLoss);
      this.victimSimEndingId = ending.id;
      this.victimSimMode = "ending";
      // 持久化通关 + 评级
      platformStore.recordVictimSimResult(scenario.id, ending.rank);
      // 解锁弱点情报（如存在）
      if (ending.weaknessIntel) {
        platformStore.unlockWeaknessIntel(
          ending.weaknessIntel.enemyTypeId,
          scenario.id,
          ending.weaknessIntel.damageBonus,
        );
      }
      playSfx(ending.rank === "S" || ending.rank === "A" ? "good" : "bad");
      vibrateShort();
    } else {
      this.victimSimNodeId = choice.nextNodeId;
      this.victimSimLastChoice = null;
    }
  }

  /** 关闭受害者模拟弹窗，返回列表 */
  private closeVictimSim(): void {
    this.victimSimScenarioId = null;
    this.victimSimNodeId = null;
    this.victimSimAwareness = 0;
    this.victimSimLoss = 0;
    this.victimSimEndingId = null;
    this.victimSimLastChoice = null;
    this.victimSimMode = "list";
  }
}

/** 截断文本到指定宽度（超出加 "…"） */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const test = text.slice(0, mid) + "…";
    if (ctx.measureText(test).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? text.slice(0, lo) + "…" : "…";
}
