/**
 * 「反诈职业经理人」跨局养成系统（v6 Phase 3.3）
 * 横屏 Canvas UI：天赋树 + 装备 + 遗物 三合一管理
 * - 顶部：返回 + 标题 + 资源条（金币/情报/卷宗/反诈积分/天赋点）
 * - 探员选择行：10 探员头像（未解锁灰色）
 * - 主内容区：3 个子 Tab（天赋 / 装备 / 遗物）
 *   - 天赋：3 分支 × 5 层节点，点击解锁（消耗天赋点）
 *   - 装备：探员当前装备 + 已拥有装备列表，点击装备/卸下
 *   - 遗物：已装备 3 槽 + 已拥有遗物列表，点击装备/卸下
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawScanlineOverlay,
  drawNeonCorners, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon } from "@/ui/icons";
import {
  AGENTS, getTalentTree, getRelic, getEquipment,
} from "@/games/manager/data";
import type {
  TalentBranch, TalentNode, RelicDef, EquipmentDef, RelicRarity,
} from "@/games/manager/types";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";

type SubTab = "talent" | "equipment" | "relic";

const RARITY_COLOR: Record<RelicRarity, string> = {
  common: "#9FE3FF",
  rare: "#00E5FF",
  epic: "#B388FF",
  legendary: "#FFD666",
};

const RARITY_LABEL: Record<RelicRarity, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
};

const BRANCH_META: Record<TalentBranch, { label: string; emoji: string; color: string }> = {
  offense: { label: "攻击", emoji: "⚔️", color: "#E5353B" },
  defense: { label: "防御", emoji: "🛡️", color: "#3D8BFD" },
  support: { label: "辅助", emoji: "🔭", color: "#52C41A" },
};

const SUB_TABS: { id: SubTab; label: string; emoji: string }[] = [
  { id: "talent", label: "天赋树", emoji: "🌳" },
  { id: "equipment", label: "装备", emoji: "⚔️" },
  { id: "relic", label: "遗物", emoji: "💎" },
];

export class ManagerProgressionScene extends Scene {
  private selectedAgentIdx = 0;
  private subTab: SubTab = "talent";
  private pressedButton: string | null = null;
  /** 待确认操作（解锁天赋/装备/卸下）的描述，用于二次确认 */
  private pendingConfirm: { title: string; desc: string; onConfirm: () => void } | null = null;

  enter(): void {
    super.enter();
    setOrientation("landscape");
    // 默认选中第一个已解锁探员
    const meta = platformStore.managerMetaProgress();
    const firstUnlocked = AGENTS.findIndex((a) => meta.unlockedAgents.includes(a.id));
    this.selectedAgentIdx = firstUnlocked >= 0 ? firstUnlocked : 0;
    this.pendingConfirm = null;
  }

  private get selectedAgent() {
    return AGENTS[this.selectedAgentIdx];
  }

  // ====================================================================
  // 布局
  // ====================================================================

  private getBackBtnRect(): Rect {
    return { x: 8, y: 8, w: 56, h: 32 };
  }

  private getSubTabRect(idx: number, screenW: number): Rect {
    const tabW = 92;
    const gap = 6;
    const startX = screenW - 16 - 3 * tabW - 2 * gap;
    return { x: startX + idx * (tabW + gap), y: 8, w: tabW, h: 32 };
  }

  /** 资源条 y 位置 */
  private getResourceBarY(): number {
    return 52;
  }

  /** 探员选择行 y */
  private getAgentRowY(): number {
    return 80;
  }

  /** 探员卡片矩形（横排 10 个） */
  private getAgentCardRect(idx: number, screenW: number): Rect {
    const y = this.getAgentRowY();
    const gap = 4;
    const cardW = (screenW - 32 - gap * 9) / 10;
    const x = 16 + idx * (cardW + gap);
    return { x, y, w: cardW, h: 56 };
  }

  /** 主内容区起点 y */
  private getContentY(): number {
    return 144;
  }

  // ===== 天赋树布局 =====

  /** 天赋分支列矩形 */
  private getTalentBranchRect(branchIdx: number, screenW: number): Rect {
    const contentY = this.getContentY();
    const gap = 12;
    const colW = (screenW - 32 - gap * 2) / 3;
    return { x: 16 + branchIdx * (colW + gap), y: contentY, w: colW, h: 360 };
  }

  /** 天赋节点矩形（在分支列内） */
  private getTalentNodeRect(branchIdx: number, tier: number, screenW: number): Rect {
    const branchRect = this.getTalentBranchRect(branchIdx, screenW);
    const nodeH = 56;
    const nodeGap = 6;
    const headerH = 24;
    return {
      x: branchRect.x + 8,
      y: branchRect.y + headerH + (tier - 1) * (nodeH + nodeGap),
      w: branchRect.w - 16,
      h: nodeH,
    };
  }

  // ===== 装备布局 =====

  /** 装备槽矩形（2 个：weapon / badge） */
  private getEquipSlotRect(slotIdx: number, screenW: number): Rect {
    const contentY = this.getContentY();
    const slotW = 200;
    const slotH = 100;
    const gap = 16;
    const startX = (screenW - slotW * 2 - gap) / 2;
    return { x: startX + slotIdx * (slotW + gap), y: contentY, w: slotW, h: slotH };
  }

  /** 已拥有装备列表项矩形 */
  private getEquipListItemRect(idx: number, screenW: number): Rect {
    const contentY = this.getContentY() + 116;
    const itemH = 44;
    const itemGap = 4;
    const listW = screenW - 32;
    return { x: 16, y: contentY + idx * (itemH + itemGap), w: listW, h: itemH };
  }

  // ===== 遗物布局 =====

  /** 已装备遗物槽矩形（3 个） */
  private getRelicSlotRect(idx: number, screenW: number): Rect {
    const contentY = this.getContentY();
    const slotW = 200;
    const slotH = 100;
    const gap = 16;
    const startX = (screenW - slotW * 3 - gap * 2) / 2;
    return { x: startX + idx * (slotW + gap), y: contentY, w: slotW, h: slotH };
  }

  /** 已拥有遗物列表项矩形 */
  private getRelicListItemRect(idx: number, screenW: number): Rect {
    const contentY = this.getContentY() + 116;
    const itemH = 44;
    const itemGap = 4;
    const listW = screenW - 32;
    return { x: 16, y: contentY + idx * (itemH + itemGap), w: listW, h: itemH };
  }

  /** 确认弹窗矩形 */
  private getConfirmRect(screenW: number, screenH: number): Rect {
    const w = Math.min(420, screenW - 64);
    const h = 180;
    return { x: (screenW - w) / 2, y: (screenH - h) / 2, w, h };
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
    ctx.font = `700 15px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.accents.manager;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(Theme.accents.manager, 0.4);
    ctx.shadowBlur = 6;
    ctx.fillText("反诈档案 · 跨局养成", 72, 24);
    ctx.restore();

    // 子 Tab（右上角）
    for (let i = 0; i < SUB_TABS.length; i++) {
      this.renderSubTab(ctx, i, screenW);
    }

    // 资源条
    this.renderResourceBar(ctx, screenW);

    // 探员选择行
    this.renderAgentRow(ctx, screenW);

    // 主内容区
    if (this.subTab === "talent") {
      this.renderTalentTree(ctx, screenW, screenH);
    } else if (this.subTab === "equipment") {
      this.renderEquipment(ctx, screenW, screenH);
    } else {
      this.renderRelics(ctx, screenW, screenH);
    }

    // 确认弹窗（最上层）
    if (this.pendingConfirm) {
      this.renderConfirm(ctx, screenW, screenH);
    }

    drawScanlineOverlay(ctx, screenW, screenH);
  }

  private renderSubTab(ctx: CanvasRenderingContext2D, idx: number, screenW: number): void {
    const tab = SUB_TABS[idx];
    const rect = this.getSubTabRect(idx, screenW);
    const selected = this.subTab === tab.id;
    const accent = Theme.accents.manager;
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: selected ? accent : withAlpha(Theme.colors.bg.line, 0.5),
      borderWidth: selected ? 2 : 1,
      bgColor: selected ? withAlpha(accent, 0.12) : Theme.colors.bg.card,
    });
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = selected ? accent : Theme.colors.ink.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tab.emoji, rect.x + 20, rect.y + rect.h / 2);
    ctx.font = `${selected ? "700" : "500"} 10px ${Theme.fonts.display}`;
    ctx.fillStyle = selected ? accent : Theme.colors.ink.muted;
    ctx.fillText(tab.label, rect.x + 56, rect.y + rect.h / 2);
    ctx.restore();
  }

  private renderResourceBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    const meta = platformStore.managerMetaProgress();
    const y = this.getResourceBarY();
    const resources = [
      { label: "金币", value: meta.coins, emoji: "🪙", color: "#FFB020" },
      { label: "情报", value: meta.intel, emoji: "📡", color: "#00E5FF" },
      { label: "卷宗", value: meta.caseFiles, emoji: "📁", color: "#FF7AB8" },
      { label: "反诈积分", value: meta.antiFraudPoints, emoji: "⭐", color: "#FFD666" },
      { label: "天赋点", value: meta.talentPoints, emoji: "🌳", color: "#52C41A" },
    ];
    ctx.save();
    ctx.font = `500 10px ${Theme.fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let x = 16;
    for (const r of resources) {
      const text = `${r.emoji} ${r.label} ${r.value}`;
      const w = ctx.measureText(text).width + 12;
      drawPanel(ctx, x, y, w, 20, {
        bgColor: withAlpha(r.color, 0.08),
        borderColor: withAlpha(r.color, 0.35),
        borderWidth: 1,
      });
      ctx.fillStyle = r.color;
      ctx.fillText(text, x + 6, y + 11);
      x += w + 6;
    }
    ctx.restore();
  }

  private renderAgentRow(ctx: CanvasRenderingContext2D, screenW: number): void {
    const meta = platformStore.managerMetaProgress();
    for (let i = 0; i < AGENTS.length; i++) {
      const agent = AGENTS[i];
      const rect = this.getAgentCardRect(i, screenW);
      const selected = this.selectedAgentIdx === i;
      const unlocked = meta.unlockedAgents.includes(agent.id);

      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        borderColor: unlocked ? (selected ? agent.color : withAlpha(agent.color, 0.4)) : withAlpha(Theme.colors.bg.line, 0.3),
        borderWidth: selected ? 2 : 1,
        bgColor: selected ? withAlpha(agent.color, 0.15) : (unlocked ? withAlpha(agent.color, 0.04) : "rgba(20,30,45,0.6)"),
      });

      // emoji
      ctx.save();
      ctx.font = `20px ${Theme.fonts.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!unlocked) ctx.globalAlpha = 0.35;
      ctx.fillText(unlocked ? agent.emoji : "🔒", rect.x + rect.w / 2, rect.y + 18);
      ctx.restore();

      // 名字（截断）
      ctx.save();
      ctx.font = `${selected ? "700" : "400"} 9px ${Theme.fonts.display}`;
      ctx.fillStyle = unlocked ? (selected ? agent.color : Theme.colors.ink.DEFAULT) : Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const name = agent.name.length > 4 ? agent.name.slice(0, 4) : agent.name;
      ctx.fillText(unlocked ? name : "???", rect.x + rect.w / 2, rect.y + 42);
      ctx.restore();

      // 选中态发光
      if (selected) {
        ctx.save();
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 1;
        ctx.shadowColor = agent.color;
        ctx.shadowBlur = 8;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        ctx.restore();
      }
    }
  }

  // ===== 天赋树渲染 =====

  private renderTalentTree(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number): void {
    const agent = this.selectedAgent;
    const tree = getTalentTree(agent.id);
    if (!tree) {
      ctx.save();
      ctx.font = `400 12px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "center";
      ctx.fillText("该探员暂无天赋树数据", screenW / 2, this.getContentY() + 40);
      ctx.restore();
      return;
    }
    const meta = platformStore.managerMetaProgress();
    const agentTalent = meta.agentTalents[agent.id] ?? {};
    const branches: TalentBranch[] = ["offense", "defense", "support"];

    for (let bIdx = 0; bIdx < 3; bIdx++) {
      const branch = branches[bIdx];
      const branchRect = this.getTalentBranchRect(bIdx, screenW);
      const bMeta = BRANCH_META[branch];

      // 分支列背景
      drawPanel(ctx, branchRect.x, branchRect.y, branchRect.w, branchRect.h, {
        bgColor: withAlpha(bMeta.color, 0.04),
        borderColor: withAlpha(bMeta.color, 0.3),
        borderWidth: 1,
      });
      // 分支标题
      ctx.save();
      ctx.font = `700 12px ${Theme.fonts.display}`;
      ctx.fillStyle = bMeta.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = bMeta.color;
      ctx.shadowBlur = 4;
      ctx.fillText(`${bMeta.emoji} ${bMeta.label}系`, branchRect.x + branchRect.w / 2, branchRect.y + 12);
      ctx.restore();

      const currentTier = agentTalent[branch] ?? 0;
      const nodes = tree.branches[branch];
      for (const node of nodes) {
        this.renderTalentNode(ctx, node, bIdx, screenW, currentTier);
      }
    }
  }

  private renderTalentNode(ctx: CanvasRenderingContext2D, node: TalentNode, branchIdx: number, screenW: number, currentTier: number): void {
    const rect = this.getTalentNodeRect(branchIdx, node.tier - 1, screenW);
    const unlocked = node.tier <= currentTier;
    const canUnlock = !unlocked && node.tier === currentTier + 1;
    const meta = platformStore.managerMetaProgress();
    const hasPoints = meta.talentPoints >= node.cost;
    const bMeta = BRANCH_META[node.branch];

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: unlocked ? bMeta.color : (canUnlock ? (hasPoints ? bMeta.color : withAlpha(bMeta.color, 0.4)) : withAlpha(Theme.colors.bg.line, 0.4)),
      borderWidth: unlocked ? 2 : 1,
      bgColor: unlocked ? withAlpha(bMeta.color, 0.15) : (canUnlock ? withAlpha(bMeta.color, 0.06) : "rgba(20,30,45,0.6)"),
    });

    // emoji + 名称 + 描述 + 消耗
    ctx.save();
    ctx.font = `16px ${Theme.fonts.body}`;
    ctx.fillStyle = unlocked ? "#FFFFFF" : (canUnlock ? bMeta.color : Theme.colors.ink.dim);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(node.emoji, rect.x + 8, rect.y + rect.h / 2);

    ctx.font = `${unlocked ? "700" : "500"} 10px ${Theme.fonts.display}`;
    ctx.fillStyle = unlocked ? bMeta.color : (canUnlock ? Theme.colors.ink.DEFAULT : Theme.colors.ink.dim);
    ctx.fillText(node.name, rect.x + 30, rect.y + 14);

    ctx.font = `400 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = unlocked ? Theme.colors.ink.muted : Theme.colors.ink.dim;
    ctx.fillText(node.desc, rect.x + 30, rect.y + 28);

    // 消耗 / 状态
    ctx.font = `700 9px ${Theme.fonts.mono}`;
    ctx.textAlign = "right";
    if (unlocked) {
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✓ 已解锁", rect.x + rect.w - 8, rect.y + 14);
    } else if (canUnlock) {
      ctx.fillStyle = hasPoints ? bMeta.color : Theme.colors.warn.DEFAULT;
      ctx.fillText(`${node.cost} 点`, rect.x + rect.w - 8, rect.y + 14);
      if (!hasPoints) {
        ctx.font = `400 8px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.fillText("点数不足", rect.x + rect.w - 8, rect.y + 28);
      }
    } else {
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText(`需先解锁 T${node.tier - 1}`, rect.x + rect.w - 8, rect.y + 14);
    }
    ctx.restore();
  }

  // ===== 装备渲染 =====

  private renderEquipment(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number): void {
    const agent = this.selectedAgent;
    const meta = platformStore.managerMetaProgress();
    const slots: { slot: "weapon" | "badge"; label: string; emoji: string }[] = [
      { slot: "weapon", label: "武器槽", emoji: "🔫" },
      { slot: "badge", label: "徽章槽", emoji: "🔰" },
    ];

    // 当前装备的 2 个槽
    for (let i = 0; i < 2; i++) {
      const s = slots[i];
      const rect = this.getEquipSlotRect(i, screenW);
      const equippedId = meta.agentEquipment[agent.id];
      const equipped = equippedId ? getEquipment(equippedId) : undefined;
      const isThisSlot = equipped?.slot === s.slot;

      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        borderColor: equipped && isThisSlot ? equipped.color : withAlpha(Theme.colors.bg.line, 0.4),
        borderWidth: equipped && isThisSlot ? 2 : 1,
        bgColor: equipped && isThisSlot ? withAlpha(equipped.color, 0.08) : "rgba(20,30,45,0.6)",
      });
      // 槽位标题
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${s.emoji} ${s.label}`, rect.x + 8, rect.y + 6);
      ctx.restore();

      if (equipped && isThisSlot) {
        // 显示装备详情
        ctx.save();
        ctx.font = `28px ${Theme.fonts.body}`;
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(equipped.emoji, rect.x + 12, rect.y + 52);
        ctx.font = `700 12px ${Theme.fonts.display}`;
        ctx.fillStyle = equipped.color;
        ctx.fillText(equipped.name, rect.x + 48, rect.y + 44);
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.fillText(equipped.desc, rect.x + 48, rect.y + 60);
        ctx.font = `700 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = RARITY_COLOR[equipped.rarity];
        ctx.fillText(`[${RARITY_LABEL[equipped.rarity]}]`, rect.x + 48, rect.y + 76);
        ctx.restore();
        // 卸下按钮
        const unequipBtn: Rect = { x: rect.x + rect.w - 60, y: rect.y + rect.h - 24, w: 52, h: 18 };
        drawButton(ctx, unequipBtn.x, unequipBtn.y, unequipBtn.w, unequipBtn.h, "卸下", {
          variant: "ghost", accent: Theme.colors.warn.DEFAULT, fontSize: 9,
          pressed: this.pressedButton === `unequip-${agent.id}`,
        });
      } else {
        // 空槽位提示
        ctx.save();
        ctx.font = `400 11px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("（空）", rect.x + rect.w / 2, rect.y + rect.h / 2 + 8);
        ctx.restore();
      }
    }

    // 已拥有装备列表
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("▸ 已拥有装备（点击装备到当前探员）", 16, this.getContentY() + 108);
    ctx.restore();

    const ownedEquip = meta.ownedEquipment
      .map((id) => getEquipment(id))
      .filter((e): e is EquipmentDef => !!e);
    for (let i = 0; i < ownedEquip.length; i++) {
      this.renderEquipListItem(ctx, i, ownedEquip[i], screenW);
    }
    if (ownedEquip.length === 0) {
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.fillText("暂无装备 · 通过爬塔/BOSS 击破获取", screenW / 2, this.getContentY() + 160);
      ctx.restore();
    }
  }

  private renderEquipListItem(ctx: CanvasRenderingContext2D, idx: number, eq: EquipmentDef, screenW: number): void {
    const rect = this.getEquipListItemRect(idx, screenW);
    const meta = platformStore.managerMetaProgress();
    const agent = this.selectedAgent;
    // 检查装备是否已被当前探员装备，或被其他探员占用
    let assignedTo: string | null = null;
    for (const [aid, eid] of Object.entries(meta.agentEquipment)) {
      if (eid === eq.id) { assignedTo = aid; break; }
    }
    const isEquippedHere = assignedTo === agent.id;
    const isEquippedElse = assignedTo !== null && assignedTo !== agent.id;
    const slotMatch = eq.slot === "weapon" || eq.slot === "badge"; // 任意槽都可显示

    if (!slotMatch) return;

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: isEquippedHere ? eq.color : (isEquippedElse ? withAlpha(Theme.colors.bg.line, 0.4) : withAlpha(eq.color, 0.4)),
      borderWidth: 1,
      bgColor: isEquippedHere ? withAlpha(eq.color, 0.1) : "rgba(20,30,45,0.6)",
    });

    ctx.save();
    ctx.font = `20px ${Theme.fonts.body}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(eq.emoji, rect.x + 10, rect.y + rect.h / 2);

    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = eq.color;
    ctx.fillText(eq.name, rect.x + 38, rect.y + 14);

    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(eq.desc, rect.x + 38, rect.y + 30);

    // 槽位 + 稀有度
    ctx.font = `700 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = RARITY_COLOR[eq.rarity];
    ctx.fillText(`[${eq.slot === "weapon" ? "武器" : "徽章"} · ${RARITY_LABEL[eq.rarity]}]`, rect.x + 38, rect.y + rect.h - 8);

    // 状态/操作
    ctx.textAlign = "right";
    if (isEquippedHere) {
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✓ 已装备", rect.x + rect.w - 10, rect.y + 14);
    } else if (isEquippedElse) {
      const otherAgent = AGENTS.find((a) => a.id === assignedTo);
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.fillText(`已被 ${otherAgent?.name ?? "?"} 装备`, rect.x + rect.w - 10, rect.y + 14);
    } else {
      ctx.fillStyle = eq.color;
      ctx.fillText("点击装备 →", rect.x + rect.w - 10, rect.y + 14);
    }
    ctx.restore();
  }

  // ===== 遗物渲染 =====

  private renderRelics(ctx: CanvasRenderingContext2D, screenW: number, _screenH: number): void {
    const meta = platformStore.managerMetaProgress();
    // 已装备遗物槽（3 个）
    for (let i = 0; i < 3; i++) {
      const rect = this.getRelicSlotRect(i, screenW);
      const relicId = meta.equippedRelics[i];
      const relic = relicId ? getRelic(relicId) : undefined;
      drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
        borderColor: relic ? relic.color : withAlpha(Theme.colors.bg.line, 0.4),
        borderWidth: relic ? 2 : 1,
        bgColor: relic ? withAlpha(relic.color, 0.08) : "rgba(20,30,45,0.6)",
      });
      ctx.save();
      ctx.font = `700 11px ${Theme.fonts.display}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`💎 遗物槽 ${i + 1}`, rect.x + 8, rect.y + 6);
      if (relic) {
        ctx.font = `28px ${Theme.fonts.body}`;
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(relic.emoji, rect.x + 12, rect.y + 52);
        ctx.font = `700 12px ${Theme.fonts.display}`;
        ctx.fillStyle = relic.color;
        ctx.fillText(relic.name, rect.x + 48, rect.y + 44);
        ctx.font = `400 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.muted;
        ctx.fillText(relic.desc, rect.x + 48, rect.y + 60);
        ctx.font = `700 9px ${Theme.fonts.mono}`;
        ctx.fillStyle = RARITY_COLOR[relic.rarity];
        ctx.fillText(`[${RARITY_LABEL[relic.rarity]}]`, rect.x + 48, rect.y + 76);
      } else {
        ctx.font = `400 11px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("（空）", rect.x + rect.w / 2, rect.y + rect.h / 2 + 8);
      }
      ctx.restore();
    }

    // 已拥有遗物列表
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`▸ 已拥有遗物（${meta.ownedRelics.length} 件 · 已装备 ${meta.equippedRelics.length}/3 · 点击装备/卸下）`, 16, this.getContentY() + 108);
    ctx.restore();

    const ownedRelics = meta.ownedRelics
      .map((id) => getRelic(id))
      .filter((r): r is RelicDef => !!r);
    for (let i = 0; i < ownedRelics.length; i++) {
      this.renderRelicListItem(ctx, i, ownedRelics[i], screenW);
    }
    if (ownedRelics.length === 0) {
      ctx.save();
      ctx.font = `400 11px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.dim;
      ctx.textAlign = "center";
      ctx.fillText("暂无遗物 · 通过 BOSS 击破 / 爬塔奖励 / 答题获取", screenW / 2, this.getContentY() + 160);
      ctx.restore();
    }
  }

  private renderRelicListItem(ctx: CanvasRenderingContext2D, idx: number, relic: RelicDef, screenW: number): void {
    const rect = this.getRelicListItemRect(idx, screenW);
    const meta = platformStore.managerMetaProgress();
    const isEquipped = meta.equippedRelics.includes(relic.id);

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      borderColor: isEquipped ? relic.color : withAlpha(relic.color, 0.4),
      borderWidth: 1,
      bgColor: isEquipped ? withAlpha(relic.color, 0.1) : "rgba(20,30,45,0.6)",
    });

    ctx.save();
    ctx.font = `20px ${Theme.fonts.body}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(relic.emoji, rect.x + 10, rect.y + rect.h / 2);

    ctx.font = `700 11px ${Theme.fonts.display}`;
    ctx.fillStyle = relic.color;
    ctx.fillText(relic.name, rect.x + 38, rect.y + 14);

    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(relic.desc, rect.x + 38, rect.y + 30);

    ctx.font = `700 8px ${Theme.fonts.mono}`;
    ctx.fillStyle = RARITY_COLOR[relic.rarity];
    ctx.fillText(`[${RARITY_LABEL[relic.rarity]}]`, rect.x + 38, rect.y + rect.h - 8);

    ctx.textAlign = "right";
    if (isEquipped) {
      ctx.fillStyle = Theme.colors.safe.DEFAULT;
      ctx.fillText("✓ 已装备 · 点击卸下", rect.x + rect.w - 10, rect.y + 14);
    } else {
      ctx.fillStyle = relic.color;
      ctx.fillText("点击装备 →", rect.x + rect.w - 10, rect.y + 14);
    }
    ctx.restore();
  }

  // ===== 确认弹窗 =====

  private renderConfirm(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const pc = this.pendingConfirm;
    if (!pc) return;
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
    ctx.fillText(pc.title, rect.x + rect.w / 2, rect.y + 20);
    ctx.shadowBlur = 0;

    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(pc.desc, rect.x + rect.w / 2, rect.y + 56);

    const btnW = 120;
    const btnH = 32;
    const cancelRect: Rect = { x: rect.x + 32, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
    const confirmRect: Rect = { x: rect.x + rect.w - 32 - btnW, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
    drawButton(ctx, cancelRect.x, cancelRect.y, cancelRect.w, cancelRect.h, "取消", {
      variant: "ghost", accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "confirm-cancel",
    });
    drawButton(ctx, confirmRect.x, confirmRect.y, confirmRect.w, confirmRect.h, "确认", {
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

    // 确认弹窗优先处理
    if (this.pendingConfirm) {
      if (type === "start") {
        const rect = this.getConfirmRect(screenW, screenH);
        const btnW = 120;
        const btnH = 32;
        const cancelRect: Rect = { x: rect.x + 32, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
        const confirmRect: Rect = { x: rect.x + rect.w - 32 - btnW, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
        if (hitTest(x, y, cancelRect)) { this.pressedButton = "confirm-cancel"; return true; }
        if (hitTest(x, y, confirmRect)) { this.pressedButton = "confirm-ok"; return true; }
        return true;
      } else if (type === "end") {
        const rect = this.getConfirmRect(screenW, screenH);
        const btnW = 120;
        const btnH = 32;
        const cancelRect: Rect = { x: rect.x + 32, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
        const confirmRect: Rect = { x: rect.x + rect.w - 32 - btnW, y: rect.y + rect.h - btnH - 16, w: btnW, h: btnH };
        if (this.pressedButton === "confirm-cancel" && hitTest(x, y, cancelRect)) {
          this.pendingConfirm = null;
          playSfx("click");
        } else if (this.pressedButton === "confirm-ok" && hitTest(x, y, confirmRect)) {
          this.pendingConfirm.onConfirm();
          this.pendingConfirm = null;
          playSfx("click");
          vibrateShort();
        }
        this.pressedButton = null;
        return true;
      }
      return true;
    }

    if (type === "start") {
      if (hitTest(x, y, this.getBackBtnRect())) { this.pressedButton = "back"; return true; }
      // 子 Tab
      for (let i = 0; i < SUB_TABS.length; i++) {
        if (hitTest(x, y, this.getSubTabRect(i, screenW))) { this.pressedButton = `subtab-${i}`; return true; }
      }
      // 探员选择
      const meta = platformStore.managerMetaProgress();
      for (let i = 0; i < AGENTS.length; i++) {
        if (hitTest(x, y, this.getAgentCardRect(i, screenW))) {
          if (meta.unlockedAgents.includes(AGENTS[i].id)) {
            this.pressedButton = `agent-${i}`;
          } else {
            this.pressedButton = `agent-locked-${i}`;
          }
          return true;
        }
      }
      // 子 Tab 内容
      if (this.subTab === "talent") {
        this.handleTalentTouchStart(x, y, screenW);
      } else if (this.subTab === "equipment") {
        this.handleEquipTouchStart(x, y, screenW);
      } else {
        this.handleRelicTouchStart(x, y, screenW);
      }
      return true;
    } else if (type === "end") {
      const pressed = this.pressedButton;
      this.pressedButton = null;
      if (pressed === "back") {
        playSfx("click");
        this.director.pop();
        return true;
      }
      if (pressed?.startsWith("subtab-")) {
        const idx = parseInt(pressed.split("-")[1]);
        if (hitTest(x, y, this.getSubTabRect(idx, screenW))) {
          this.subTab = SUB_TABS[idx].id;
          playSfx("click");
          vibrateShort();
        }
        return true;
      }
      if (pressed?.startsWith("agent-")) {
        const parts = pressed.split("-");
        const isLocked = parts[1] === "locked";
        const idx = parseInt(parts[2] ?? parts[1]);
        if (hitTest(x, y, this.getAgentCardRect(idx, screenW))) {
          if (!isLocked) {
            this.selectedAgentIdx = idx;
            playSfx("click");
            vibrateShort();
          } else {
            playSfx("bad");
          }
        }
        return true;
      }
      if (pressed?.startsWith("talent-")) {
        this.handleTalentTouchEnd(pressed, x, y, screenW);
        return true;
      }
      if (pressed?.startsWith("equip-")) {
        this.handleEquipTouchEnd(pressed, x, y, screenW);
        return true;
      }
      if (pressed?.startsWith("unequip-")) {
        const agentId = pressed.slice("unequip-".length);
        if (hitTest(x, y, this.getEquipSlotRect(0, screenW)) || hitTest(x, y, this.getEquipSlotRect(1, screenW))) {
          this.requestConfirm("卸下装备", `确认卸下 ${this.selectedAgent.name} 的装备？`, () => {
            platformStore.equipAgentEquipment(agentId, null);
          });
        }
        return true;
      }
      if (pressed?.startsWith("relic-")) {
        this.handleRelicTouchEnd(pressed, x, y, screenW);
        return true;
      }
      return false;
    }
    return false;
  }

  private handleTalentTouchStart(x: number, y: number, screenW: number): void {
    const tree = getTalentTree(this.selectedAgent.id);
    if (!tree) return;
    const branches: TalentBranch[] = ["offense", "defense", "support"];
    for (let bIdx = 0; bIdx < 3; bIdx++) {
      const branch = branches[bIdx];
      const nodes = tree.branches[branch];
      for (const node of nodes) {
        const rect = this.getTalentNodeRect(bIdx, node.tier - 1, screenW);
        if (hitTest(x, y, rect)) {
          this.pressedButton = `talent-${branch}-${node.tier}`;
          return;
        }
      }
    }
  }

  private handleTalentTouchEnd(pressed: string, x: number, y: number, screenW: number): void {
    // pressed = "talent-{branch}-{tier}"
    const parts = pressed.split("-");
    const branch = parts[1] as TalentBranch;
    const tier = parseInt(parts[2]);
    const bIdx = branch === "offense" ? 0 : branch === "defense" ? 1 : 2;
    const nodeRect = this.getTalentNodeRect(bIdx, tier - 1, screenW);
    if (!hitTest(x, y, nodeRect)) return;
    const tree = getTalentTree(this.selectedAgent.id);
    if (!tree) return;
    const node = tree.branches[branch].find((n) => n.tier === tier);
    if (!node) return;
    const meta = platformStore.managerMetaProgress();
    const currentTier = meta.agentTalents[this.selectedAgent.id]?.[branch] ?? 0;
    if (tier <= currentTier) return; // 已解锁
    if (tier !== currentTier + 1) { playSfx("bad"); return; } // 顺序不符
    if (meta.talentPoints < node.cost) { playSfx("bad"); return; }
    // 二次确认
    this.requestConfirm(
      "解锁天赋节点",
      `${node.emoji} ${node.name}\n${node.desc}\n消耗 ${node.cost} 天赋点？`,
      () => {
        const ok = platformStore.unlockTalentNode(this.selectedAgent.id, branch, tier, node.cost);
        if (ok) { playSfx("achievement"); vibrateShort(); }
        else { playSfx("bad"); }
      },
    );
  }

  private handleEquipTouchStart(x: number, y: number, screenW: number): void {
    const meta = platformStore.managerMetaProgress();
    // 卸下按钮
    const equippedId = meta.agentEquipment[this.selectedAgent.id];
    if (equippedId) {
      const eq = getEquipment(equippedId);
      if (eq) {
        const slotIdx = eq.slot === "weapon" ? 0 : 1;
        const slotRect = this.getEquipSlotRect(slotIdx, screenW);
        const unequipBtn: Rect = { x: slotRect.x + slotRect.w - 60, y: slotRect.y + slotRect.h - 24, w: 52, h: 18 };
        if (hitTest(x, y, unequipBtn)) {
          this.pressedButton = `unequip-${this.selectedAgent.id}`;
          return;
        }
      }
    }
    // 装备列表项
    const ownedEquip = meta.ownedEquipment
      .map((id) => getEquipment(id))
      .filter((e): e is EquipmentDef => !!e);
    for (let i = 0; i < ownedEquip.length; i++) {
      const rect = this.getEquipListItemRect(i, screenW);
      if (hitTest(x, y, rect)) {
        this.pressedButton = `equip-${ownedEquip[i].id}`;
        return;
      }
    }
  }

  private handleEquipTouchEnd(pressed: string, x: number, y: number, screenW: number): void {
    if (!pressed.startsWith("equip-")) return;
    const eqId = pressed.slice("equip-".length);
    const meta = platformStore.managerMetaProgress();
    const ownedIdx = meta.ownedEquipment.indexOf(eqId);
    if (ownedIdx < 0) return;
    const rect = this.getEquipListItemRect(ownedIdx, screenW);
    if (!hitTest(x, y, rect)) return;
    const eq = getEquipment(eqId);
    if (!eq) return;
    // 检查是否已被当前探员装备
    if (meta.agentEquipment[this.selectedAgent.id] === eqId) {
      playSfx("bad");
      return;
    }
    // 检查是否被其他探员占用
    for (const [aid, eid] of Object.entries(meta.agentEquipment)) {
      if (eid === eqId && aid !== this.selectedAgent.id) {
        playSfx("bad");
        return;
      }
    }
    this.requestConfirm(
      "装备确认",
      `将「${eq.name}」装备到 ${this.selectedAgent.name}？\n${eq.desc}`,
      () => {
        const ok = platformStore.equipAgentEquipment(this.selectedAgent.id, eqId);
        if (ok) { playSfx("achievement"); vibrateShort(); }
        else { playSfx("bad"); }
      },
    );
  }

  private handleRelicTouchStart(x: number, y: number, screenW: number): void {
    const meta = platformStore.managerMetaProgress();
    const ownedRelics = meta.ownedRelics
      .map((id) => getRelic(id))
      .filter((r): r is RelicDef => !!r);
    for (let i = 0; i < ownedRelics.length; i++) {
      const rect = this.getRelicListItemRect(i, screenW);
      if (hitTest(x, y, rect)) {
        this.pressedButton = `relic-${ownedRelics[i].id}`;
        return;
      }
    }
  }

  private handleRelicTouchEnd(pressed: string, x: number, y: number, screenW: number): void {
    if (!pressed.startsWith("relic-")) return;
    const relicId = pressed.slice("relic-".length);
    const meta = platformStore.managerMetaProgress();
    const ownedIdx = meta.ownedRelics.indexOf(relicId);
    if (ownedIdx < 0) return;
    const rect = this.getRelicListItemRect(ownedIdx, screenW);
    if (!hitTest(x, y, rect)) return;
    const relic = getRelic(relicId);
    if (!relic) return;
    const isEquipped = meta.equippedRelics.includes(relicId);
    if (isEquipped) {
      this.requestConfirm(
        "卸下遗物",
        `卸下「${relic.name}」？\n效果将立即失效。`,
        () => {
          platformStore.toggleRelic(relicId);
        },
      );
    } else {
      if (meta.equippedRelics.length >= 3) { playSfx("bad"); return; }
      this.requestConfirm(
        "装备遗物",
        `装备「${relic.name}」？\n${relic.desc}`,
        () => {
          platformStore.toggleRelic(relicId);
        },
      );
    }
  }

  private requestConfirm(title: string, desc: string, onConfirm: () => void): void {
    this.pendingConfirm = { title, desc, onConfirm };
    playSfx("click");
  }
}
