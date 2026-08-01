/**
 * 反诈探索 · 杀猪盘（Demo）
 *
 * 探索式关卡的验证原型，目标不是考"识别"，而是让玩家以「受害者视角」走完
 * 一桩杀猪盘的完整养成过程，亲历信任如何被一步步建立、警觉如何被一点点消解。
 *
 * 结构：
 * - 地图视图：5 个阶段节点（偶遇→升温→诱饵→入金→杀猪）沿路径排列，按顺序解锁。
 * - 场景视图：进入某节点后，先看叙事 + 骗子对白（打字机），对白结束后出现选择。
 * - 双量条：信任(危险，红) / 警觉(安全，绿) 跨节点持续累积，可视化受害者心理曲线。
 * - 结局复盘：走到「杀猪」节点做出关键抉择 → 脱身 / 被套牢，并给出红flag复盘。
 *
 * 本 Demo 仅验证「探索 + 受害者心理」的手感与教学效果，复盘后暂不串联 quiz/图鉴。
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import {
  drawBackground, drawPanel, drawButton, drawModalOverlay,
  drawHudLabel, drawNeonCorners, hitTest, type Rect,
} from "@/ui/widgets";
import { drawIcon, type IconName } from "@/ui/icons";
import { playSfx, startBGM } from "@/engine/Audio";
import { postFX } from "@/engine/PostFX";
import { ParticleSystem } from "@/engine/Particle";
import { clamp } from "@/engine/Renderer";

interface ExplDlg {
  speaker: string;
  color: string;
  avatar: string;
  text: string;
}
interface ExplChoice {
  label: string;
  /** 信任增量（越高越危险） */
  trust: number;
  /** 警觉增量（越高越安全） */
  alert: number;
  /** 选择后的反馈文案 */
  feedback: string;
  /** 该选项对应的杀猪盘红flag（复盘时展示） */
  flag?: string;
}
interface ExplPhase {
  id: string;
  title: string;
  place: string;
  icon: IconName;
  accent: string;
  intro: string;
  dialogue: ExplDlg[];
  choices: ExplChoice[];
}

// ============ 杀猪盘剧本（数据驱动） ============
const SCAMMER = { speaker: "守疆", color: Theme.colors.flag.DEFAULT, avatar: "💂" };
const ME = { speaker: "你", color: Theme.colors.neon.DEFAULT, avatar: "🙂" };

const PHASES: ExplPhase[] = [
  {
    id: "contact",
    title: "第一步 · 偶遇",
    place: "交友软件 · 附近的人",
    icon: "chat",
    accent: Theme.colors.neon.DEFAULT,
    intro: "你在交友软件刷到一条打招呼。头像是个穿军装、笑容干净的男人，昵称「守疆」，简介写着「边疆服役，少上网」。",
    dialogue: [
      { ...SCAMMER, text: "你好呀，打扰了。看你动态像个热爱生活的人，冒昧打个招呼~我在边疆服役，平时很少上网，今天刚下载这个软件。" },
      { ...SCAMMER, text: "不勉强你回，就是觉得有缘。要是愿意聊，我每天睡前都能陪你说会儿话。" },
    ],
    choices: [
      {
        label: "礼貌回个笑脸，聊两句",
        trust: 18, alert: 0,
        feedback: "你回了一句「你好」。对方立刻接话——这一步，你已经被列入了他的「可养成名单」。",
        flag: "陌生人主动破冰 + 人设完美（军人/精英）＝批量撒网的标配",
      },
      {
        label: "不理会，直接划走",
        trust: 0, alert: 25,
        feedback: "你没理会。骗子每天向几百人撒网，绝大多数人划走——你不给他入口，这一步你就赢了。",
        flag: "对来路不明的搭讪保持冷处理，是成本最低的反制",
      },
    ],
  },
  {
    id: "warm",
    title: "第二步 · 升温",
    place: "私聊 · 第 7 天",
    icon: "heart",
    accent: "#FF9F45",
    intro: "他每天准点问候，记得你说过的小事，还分享自己的「投资盈利截图」。你开始把他当真朋友，甚至有点心动。",
    dialogue: [
      { ...SCAMMER, text: "今天训练累坏了，但一想到能跟你说说话就又有了劲。你昨天说胃疼，好点了吗？" },
      { ...SCAMMER, text: "对了，我闲钱放在一个内部平台做量化，每周稳定几个点。截给你看，不是显摆，是想让你也稳一点。" },
      { ...ME, text: "（你心里：从没人这样记挂我……他好像真的靠谱）" },
    ],
    choices: [
      {
        label: "被这份「在意」打动，越聊越深",
        trust: 22, alert: 0,
        feedback: "你开始分享自己的脆弱和秘密。信任一旦交付，后面他说什么你都更愿意信——这正是「养」的目的。",
        flag: "高频情绪关怀 + 展示盈利截图＝建立依赖、铺垫诱饵",
      },
      {
        label: "问他「你为什么跟我讲这些」",
        trust: 4, alert: 22,
        feedback: "你多问了一句。他顿了顿，说「觉得跟你有缘」。问题没被正面回应，但你留了个心眼。",
        flag: "对「完美关怀」保持疑问：真朋友不会上来就谈钱路",
      },
    ],
  },
  {
    id: "hook",
    title: "第三步 · 诱饵",
    place: "私聊 · 第 21 天",
    icon: "coin",
    accent: Theme.colors.warn.DEFAULT,
    intro: "他「无意间」提到平台有个漏洞，邀请你小额试投，说「就当陪我玩」。你犹豫，但利息确实到账了。",
    dialogue: [
      { ...SCAMMER, text: "其实这平台有个时间窗的套利口，我不好多说。你要是信我，拿点零花钱试试，亏了算我的。" },
      { ...ME, text: "（你投了 2000，三天后账户显示赚了 380，还能提现到账）" },
      { ...SCAMMER, text: "看到没？姐姐/兄弟我没骗你。想多赚，就得抓窗口——不过风险你自己掂量哈。" },
    ],
    choices: [
      {
        label: "跟着加一点，反正能提现",
        trust: 20, alert: 0,
        feedback: "你又投了 2 万，账户数字漂亮地涨。但那笔「能提现」只是诱饵饵料——真金白银还在你手里时，他不会收网。",
        flag: "「先给甜头、可小额提现」＝放长线钓大鱼的经典诱饵",
      },
      {
        label: "要求视频核实他身份再决定",
        trust: 2, alert: 20,
        feedback: "你提了视频。他发来一段语音：「部队纪律，不能视频，你是不信我吗？」——用纪律当挡箭牌，恰恰是最该警惕的信号。",
        flag: "以「纪律/涉密」拒绝视频核实＝不敢露真容的典型话术",
      },
    ],
  },
  {
    id: "invest",
    title: "第四步 · 入金",
    place: "虚假投资 APP",
    icon: "flame",
    accent: "#FF5A60",
    intro: "你被盈利冲昏头，开始大额转入。APP 上的余额飞涨，但他劝你「别急提，锁仓收益更高」。",
    dialogue: [
      { ...SCAMMER, text: "姐/弟，这波窗口难得，凑个整能上 VIP 利率。我帮你盯着，错过要等半年。" },
      { ...ME, text: "（你分三笔转入 18 万，余额显示 21 万。你想提现买房，他却说要「锁仓 30 天」）" },
      { ...SCAMMER, text: "提现？现在提利息全没，还得交 5% 解冻费。咱又不缺这俩钱，稳住。" },
    ],
    choices: [
      {
        label: "再凑钱锁仓，搏更高收益",
        trust: 22, alert: 0,
        feedback: "你又借又贷补进去。此刻你的「本金」早已不在平台，余额只是一串数字——你赌的，是他还会让你「赚」下去。",
        flag: "「锁仓 / 提现收费」＝阻止你出场、把盘子做大的套路",
      },
      {
        label: "先试着提一笔验证真假",
        trust: 0, alert: 18,
        feedback: "你点了提现，系统提示「需先缴保证金解冻」。正规平台绝不会让你先交钱才能拿回自己的钱——这下你确定不对了。",
        flag: "「提现要先交保证金/解冻费」＝100% 诈骗铁证",
      },
    ],
  },
  {
    id: "slaughter",
    title: "第五步 · 杀猪",
    place: "提现受阻 · 最后通牒",
    icon: "alert",
    accent: "#FF3B5C",
    intro: "你想拿回本金，对方却说账户被风控，必须再转「保证金」才能解冻。数字还在涨，可你连一分都取不出。",
    dialogue: [
      { ...SCAMMER, text: "最后一步了，交完解冻金连本带利全回来。不交，前面 20 万就永久冻结，你也忍心？" },
      { ...ME, text: "（你盯着那串漂亮却取不出的余额，手在转账界面悬着）" },
    ],
    choices: [
      {
        label: "交保证金，把本金拿回来",
        trust: 18, alert: 0,
        feedback: "你转了最后一笔。三分钟后，账号被封、人被拉黑、群聊解散。那串 21 万，从一开始就不属于你。",
        flag: "「再转一笔就能解冻」＝榨干前不收网的终极话术",
      },
      {
        label: "不对劲，立刻拉黑并拨 96110",
        trust: 0, alert: 25,
        feedback: "你深吸一口气，截好聊天和转账记录，拉黑并拨打 96110。钱未必全追回，但你止住了出血，也保住了自己。",
        flag: "察觉异常立即止损 + 拨打 96110 报警＝把伤害降到最低",
      },
    ],
  },
];

/** 结局复盘展示的杀猪盘红flag要点 */
const RED_FLAGS = [
  "陌生「精英」主动破冰，人设完美无破绽",
  "高频情绪关怀，先交心再谈钱",
  "展示「稳赚」截图，诱导小额试投并可提现",
  "以「纪律/涉密」拒绝视频、拒绝官方平台",
  "提现被「保证金/解冻费」卡住＝诈骗铁证",
];

type View = "map" | "scene" | "ending";

export class ExploreScene extends Scene {
  private view: View = "map";
  private activePhase = 0;
  private explored: boolean[] = PHASES.map(() => false);

  // 量条（目标值 + 显示值，用于平滑过渡）
  private trust = 0;
  private alert = 0;
  private trustShown = 0;
  private alertShown = 0;

  // 对白
  private dialogueIndex = 0;
  private typeProgress = 0;

  // 选择后反馈
  private pendingFeedback: string | null = null;
  private pendingPhase = -1;
  private appliedChoiceIndex = -1;

  // 结局
  private endingType: "escape" | "scammed" | null = null;
  private flagsHit: string[] = [];

  private pressedButton: string | null = null;
  private t = 0;
  private particles = new ParticleSystem();

  // 布局
  private readonly PAD = 16;
  private readonly TOP_BAR_H = 52;
  private readonly NODE_H = 64;
  private readonly NODE_GAP = 12;

  enter(): void {
    super.enter();
    startBGM("hub");
    this.t = 0;
    this.pressedButton = null;
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    this.particles.update(dt);
    // 量条平滑
    this.trustShown += (this.trust - this.trustShown) * Math.min(1, dt * 8);
    this.alertShown += (this.alert - this.alertShown) * Math.min(1, dt * 8);
    // 打字机
    if (this.view === "scene" && this.pendingFeedback === null && this.typeProgress < 1) {
      const text = this.currentDialogueText();
      const fullDur = Math.max(0.4, text.length / 32);
      this.typeProgress = Math.min(1, this.typeProgress + dt / fullDur);
    }
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);
    this.renderTopBar(ctx, screenW);
    this.renderMeters(ctx, screenW);

    if (this.view === "map") {
      this.renderMap(ctx, screenW, screenH);
    } else if (this.view === "scene") {
      this.renderScene(ctx, screenW, screenH);
    }

    if (this.view === "ending") {
      drawModalOverlay(ctx, screenW, screenH);
      this.renderEnding(ctx, screenW, screenH);
    }

    this.particles.render(ctx);
  }

  // ============ 顶部栏 ============
  private renderTopBar(ctx: CanvasRenderingContext2D, screenW: number): void {
    ctx.save();
    ctx.fillStyle = withAlpha(Theme.colors.bg.deep, 0.9);
    ctx.fillRect(0, 0, screenW, this.TOP_BAR_H);
    ctx.fillStyle = Theme.colors.bg.line;
    ctx.fillRect(0, this.TOP_BAR_H - 1, screenW, 1);
    ctx.restore();

    const backBtn: Rect = { x: 12, y: 10, w: 36, h: 32 };
    drawButton(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, "", {
      variant: "ghost",
      accent: Theme.colors.ink.muted,
      pressed: this.pressedButton === "back",
    });
    drawIcon(ctx, "arrowLeft", backBtn.x + 10, backBtn.y + 8, 16, Theme.colors.ink.muted);

    ctx.save();
    ctx.font = `700 16px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("反诈探索 · 杀猪盘", screenW / 2, 18);
    ctx.font = `400 9px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("EXPLORATION · 以受害者视角走完一局", screenW / 2, 36);
    ctx.restore();
  }

  // ============ 双量条 ============
  private renderMeters(ctx: CanvasRenderingContext2D, screenW: number): void {
    const x = this.PAD;
    const w = screenW - this.PAD * 2;
    const y0 = this.TOP_BAR_H + 10;
    this.drawMeter(ctx, x, y0, w, "信任", this.trustShown, "#FF5A60");
    this.drawMeter(ctx, x, y0 + 26, w, "警觉", this.alertShown, Theme.colors.safe.DEFAULT);
  }

  private drawMeter(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number,
    label: string, value: number, color: string,
  ): void {
    const labelW = 34;
    const barX = x + labelW;
    const barW = w - labelW - 34;
    const barH = 8;
    ctx.save();
    ctx.font = `700 11px ${Theme.fonts.body}`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + barH / 2);
    // 轨道
    ctx.fillStyle = withAlpha(Theme.colors.bg.line, 0.8);
    this.roundRect(ctx, barX, y, barW, barH, 4);
    ctx.fill();
    // 填充
    const fillW = Math.max(0, Math.min(1, value / 100)) * barW;
    if (fillW > 0) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      this.roundRect(ctx, barX, y, fillW, barH, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // 数值
    ctx.font = `700 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(value)}`, x + w, y + barH / 2);
    ctx.restore();
  }

  // ============ 地图视图 ============
  private renderMap(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const x = this.PAD;
    const w = screenW - this.PAD * 2;
    let y = this.TOP_BAR_H + 58;

    drawHudLabel(ctx, x, y, "// 阶段地图 · 按顺序解锁，点击进入", Theme.colors.ink.muted);
    y += 22;
    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("一局杀猪盘的五步养成", x, y);
    ctx.restore();
    y += 30;

    for (let i = 0; i < PHASES.length; i++) {
      this.renderNode(ctx, PHASES[i], x, y, w, i);
      y += this.NODE_H + this.NODE_GAP;
    }
  }

  private renderNode(
    ctx: CanvasRenderingContext2D, phase: ExplPhase,
    x: number, y: number, w: number, index: number,
  ): void {
    const accessible = index === 0 || this.explored[index - 1];
    const isExplored = this.explored[index];
    const isCurrent = accessible && !isExplored;
    const isLocked = !accessible;
    const accent = phase.accent;
    const pressed = this.pressedButton === `node-${index}`;

    ctx.save();
    if (isLocked) ctx.globalAlpha = 0.4;
    drawPanel(ctx, x, y, w, this.NODE_H, {
      borderColor: isLocked ? Theme.colors.bg.line
        : withAlpha(accent, isCurrent ? 0.7 : 0.3),
      bgColor: isLocked ? Theme.colors.bg.panel
        : withAlpha(accent, isCurrent ? 0.08 : 0.03),
      cut: 8,
    });
    if (isCurrent || pressed) {
      drawNeonCorners(ctx, x, y, w, this.NODE_H, accent, undefined, undefined, 6 + Math.sin(this.t * 4) * 3);
    }

    // 图标盒
    const box = 40;
    const bx = x + 12;
    const by = y + (this.NODE_H - box) / 2;
    ctx.fillStyle = withAlpha(accent, 0.14);
    ctx.fillRect(bx, by, box, box);
    ctx.strokeStyle = withAlpha(accent, 0.5);
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, box, box);
    drawIcon(ctx, phase.icon, bx + 8, by + 8, box - 16, isLocked ? Theme.colors.ink.dim : accent);

    // 序号徽章
    drawGlowBadgeSafe(ctx, bx, by - 8, `0${index + 1}`, accent);

    // 文本
    const tx = bx + box + 14;
    const tw = w - (tx - x) - 44;
    ctx.save();
    ctx.font = `700 15px ${Theme.fonts.display}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.muted : accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(phase.title, tx, y + 12);
    ctx.restore();
    ctx.save();
    ctx.font = `400 10px ${Theme.fonts.body}`;
    ctx.fillStyle = isLocked ? Theme.colors.ink.dim : Theme.colors.ink.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.truncate(ctx, phase.place, tx, y + 34, tw);
    ctx.restore();

    // 状态徽标
    const sx = x + w - 26;
    const sy = y + this.NODE_H / 2;
    if (isExplored) {
      ctx.fillStyle = withAlpha(Theme.colors.safe.DEFAULT, 0.15);
      ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
      drawIcon(ctx, "check", sx - 7, sy - 7, 14, Theme.colors.safe.DEFAULT);
    } else if (isCurrent) {
      const pulse = 4 + Math.sin(this.t * 4) * 3;
      drawIcon(ctx, "chevronRight", sx - 6, sy - 6, 12, accent);
      void pulse;
    } else {
      drawIcon(ctx, "lock", sx - 7, sy - 7, 14, Theme.colors.ink.dim);
    }
    ctx.restore();
  }

  // ============ 场景视图（对白 + 选择） ============
  private renderScene(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const phase = PHASES[this.activePhase];
    const accent = phase.accent;
    const x = this.PAD;
    const w = screenW - this.PAD * 2;

    // 阶段标题
    ctx.save();
    ctx.font = `700 18px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(phase.title, x, this.TOP_BAR_H + 58);
    ctx.font = `400 10px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(phase.place, x, this.TOP_BAR_H + 82);
    ctx.restore();

    // 叙事 intro
    const introY = this.TOP_BAR_H + 100;
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.78);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this.wrap(ctx, phase.intro, x, introY, w, 17);
    ctx.restore();

    // 对白面板（仅打字中显示）；对白结束后让出底部给选项/反馈
    if (this.typeProgress < 1) {
      const panelH = Math.min(300, screenH * 0.4);
      const panelY = screenH - panelH - 20;
      drawPanel(ctx, x, panelY, w, panelH, {
        borderColor: withAlpha(accent, 0.5),
        bgColor: withAlpha(Theme.colors.bg.panel, 0.95),
        cut: 10,
      });
      drawNeonCorners(ctx, x, panelY, w, panelH, accent, undefined, undefined, 4 + Math.sin(this.t * 3) * 2);

      const dlg = this.currentDialogue();
      if (dlg) {
        const avatarSize = 56;
        const avX = x + 18;
        const avY = panelY - avatarSize / 2;
        ctx.save();
        ctx.fillStyle = withAlpha(dlg.color, 0.12);
        ctx.beginPath(); ctx.arc(avX + avatarSize / 2, avY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = withAlpha(dlg.color, 0.6); ctx.lineWidth = 2; ctx.stroke();
        ctx.font = `30px ${Theme.fonts.body}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(dlg.avatar, avX + avatarSize / 2, avY + avatarSize / 2 + 2);
        ctx.restore();

        const textX = avX + avatarSize + 14;
        const textMaxW = w - (textX - x) - 20;
        ctx.save();
        ctx.font = `700 14px ${Theme.fonts.display}`;
        ctx.fillStyle = dlg.color;
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText(dlg.speaker, textX, panelY + 16);
        ctx.restore();

        const visibleLen = Math.floor(dlg.text.length * this.typeProgress);
        const visible = dlg.text.slice(0, visibleLen);
        ctx.save();
        ctx.font = `400 13px ${Theme.fonts.body}`;
        ctx.fillStyle = Theme.colors.ink.DEFAULT;
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        this.wrap(ctx, visible, textX, panelY + 40, textMaxW, 19);
        ctx.restore();
      }

      const pulse = 0.4 + 0.5 * ((Math.sin(this.t * 3) + 1) / 2);
      ctx.save();
      ctx.font = `400 10px ${Theme.fonts.mono}`;
      ctx.fillStyle = withAlpha(Theme.colors.ink.muted, pulse);
      ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillText("点击继续 ▸", x + w - 14, panelY - 8);
      ctx.restore();
    } else if (this.pendingFeedback === null) {
      this.renderChoices(ctx, screenW, screenH, phase);
    } else {
      this.renderFeedback(ctx, screenW, screenH);
    }
  }

  private renderChoices(
    ctx: CanvasRenderingContext2D, screenW: number, screenH: number, phase: ExplPhase,
  ): void {
    const btnH = 52;
    const gap = 10;
    const w = screenW - this.PAD * 2;
    const x = this.PAD;
    const totalH = phase.choices.length * btnH + (phase.choices.length - 1) * gap;
    let by = screenH - totalH - 16;
    for (let i = 0; i < phase.choices.length; i++) {
      const c = phase.choices[i];
      const id = `choice-${i}`;
      drawButton(ctx, x, by, w, btnH, c.label, {
        variant: "hard",
        accent: Theme.colors.neon.DEFAULT,
        pressed: this.pressedButton === id,
      });
      by += btnH + gap;
    }
  }

  private renderFeedback(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const w = screenW - this.PAD * 2;
    const x = this.PAD;
    const panelH = 200;
    const panelY = screenH - panelH - 16;
    drawPanel(ctx, x, panelY, w, panelH, {
      borderColor: withAlpha(Theme.colors.flag.DEFAULT, 0.5),
      bgColor: withAlpha(Theme.colors.bg.panel, 0.97),
      cut: 10,
    });
    drawNeonCorners(ctx, x, panelY, w, panelH, Theme.colors.flag.DEFAULT, undefined, undefined, 4);

    ctx.save();
    ctx.font = `700 13px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.flag.DEFAULT;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("▸ 此刻发生了什么", x + 16, panelY + 14);
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    this.wrap(ctx, this.pendingFeedback ?? "", x + 16, panelY + 38, w - 32, 18, panelH - 110);
    ctx.restore();

    const btnW = Math.min(220, w - 32);
    const btnH = 44;
    const btnX = (screenW - btnW) / 2;
    const btnY = panelY + panelH - btnH - 12;
    drawButton(ctx, btnX, btnY, btnW, btnH, "继续", {
      variant: "primary",
      accent: Theme.colors.neon.DEFAULT,
      pressed: this.pressedButton === "continue",
      subText: "CONTINUE",
    });
  }

  // ============ 结局 ============
  private renderEnding(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const win = this.endingType === "escape";
    const accent = win ? Theme.colors.safe.DEFAULT : Theme.colors.warn.DEFAULT;
    const x = this.PAD;
    const w = screenW - this.PAD * 2;
    const panelH = Math.min(440, screenH * 0.82);
    const panelY = (screenH - panelH) / 2;

    drawPanel(ctx, x, panelY, w, panelH, {
      borderColor: withAlpha(accent, 0.6),
      bgColor: withAlpha(Theme.colors.bg.panel, 0.98),
      cut: 12,
    });
    drawNeonCorners(ctx, x, panelY, w, panelH, accent, undefined, undefined, 6 + Math.sin(this.t * 3) * 3);

    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.font = `700 22px ${Theme.fonts.display}`;
    ctx.fillStyle = accent;
    ctx.shadowColor = withAlpha(accent, 0.4); ctx.shadowBlur = 12;
    ctx.fillText(win ? "🛡 你成功脱身" : "💸 你被套牢了", screenW / 2, panelY + 22);
    ctx.shadowBlur = 0;
    ctx.restore();

    const body = win
      ? `你一路把警觉保持在 ${Math.round(this.alert)}，没让信任冲昏头。杀猪盘最怕的，就是「肯停手、肯核实、肯报警」的人。`
      : `你把这局的信任堆到了 ${Math.round(this.trust)}，警觉只有 ${Math.round(this.alert)}。记住：你不是笨，是被慢慢「养熟」的——这正是杀猪盘最危险的地方。`;
    ctx.save();
    ctx.font = `400 12px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    this.wrap(ctx, body, x + 18, panelY + 60, w - 36, 18);
    ctx.restore();

    // 红flag复盘
    const listY = panelY + 116;
    drawHudLabel(ctx, x + 18, listY, "// 杀猪盘 · 5 个红flag", accent);
    ctx.save();
    ctx.font = `400 11px ${Theme.fonts.body}`;
    ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.82);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    let ly = listY + 22;
    for (const f of RED_FLAGS) {
      ctx.fillStyle = accent;
      ctx.fillText("▪", x + 18, ly);
      ctx.fillStyle = withAlpha(Theme.colors.ink.DEFAULT, 0.82);
      this.wrap(ctx, f, x + 34, ly, w - 52, 15, 30);
      ly += 30;
    }
    ctx.restore();

    // 按钮
    const btnW = (w - 36 - 12) / 2;
    const btnH = 44;
    const btnY = panelY + panelH - btnH - 16;
    drawButton(ctx, x + 18, btnY, btnW, btnH, "重新体验", {
      variant: "hard",
      accent: Theme.colors.neon.DEFAULT,
      pressed: this.pressedButton === "restart",
    });
    drawButton(ctx, x + 18 + btnW + 12, btnY, btnW, btnH, "返回街机", {
      variant: "primary",
      accent: accent,
      pressed: this.pressedButton === "backtohub",
    });
  }

  // ============ 触摸 ============
  handleTouch(type: "start" | "move" | "end", x: number, y: number, _id: number): boolean {
    if (this.view === "ending") return this.handleEndingTouch(type, x, y);
    if (this.view === "scene") return this.handleSceneTouch(type, x, y);
    return this.handleMapTouch(type, x, y);
  }

  private handleMapTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const backBtn: Rect = { x: 12, y: 10, w: 36, h: 32 };
    if (type === "start") {
      if (hitTest(x, y, backBtn)) { this.pressedButton = "back"; return true; }
      const x0 = this.PAD;
      const w = screenW - this.PAD * 2;
      let ny = this.TOP_BAR_H + 58 + 22 + 30;
      for (let i = 0; i < PHASES.length; i++) {
        const accessible = i === 0 || this.explored[i - 1];
        const nodeRect: Rect = { x: x0, y: ny, w, h: this.NODE_H };
        if (accessible && hitTest(x, y, nodeRect)) { this.pressedButton = `node-${i}`; return true; }
        ny += this.NODE_H + this.NODE_GAP;
      }
      return false;
    } else if (type === "end") {
      if (this.pressedButton === "back" && hitTest(x, y, backBtn)) {
        playSfx("click");
        this.director.pop();
        return true;
      }
      if (this.pressedButton && this.pressedButton.startsWith("node-")) {
        const idx = parseInt(this.pressedButton.slice(5));
        const x0 = this.PAD;
        const w = screenW - this.PAD * 2;
        let ny = this.TOP_BAR_H + 58 + 22 + 30;
        for (let i = 0; i < idx; i++) ny += this.NODE_H + this.NODE_GAP;
        if (hitTest(x, y, { x: x0, y: ny, w, h: this.NODE_H })) {
          playSfx("click");
          this.enterPhase(idx);
        }
      }
      this.pressedButton = null;
      return true;
    }
    return false;
  }

  private handleSceneTouch(type: "start" | "move" | "end", x: number, y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const backBtn: Rect = { x: 12, y: 10, w: 36, h: 32 };
    const phase = PHASES[this.activePhase];

    if (type === "start") {
      if (hitTest(x, y, backBtn)) { this.pressedButton = "back"; return true; }
      if (this.typeProgress < 1) { this.pressedButton = "advance"; return true; }
      if (this.pendingFeedback !== null) {
        const w = screenW - this.PAD * 2;
        const panelH = 200;
        const panelY = screenH - panelH - 16;
        const btnW = Math.min(220, w - 32);
        const btnX = (screenW - btnW) / 2;
        const btnY = panelY + panelH - 44 - 12;
        if (hitTest(x, y, { x: btnX, y: btnY, w: btnW, h: 44 })) this.pressedButton = "continue";
        return true;
      }
      // 选项
      const btnH = 52, gap = 10;
      const w = screenW - this.PAD * 2;
      const totalH = phase.choices.length * btnH + (phase.choices.length - 1) * gap;
      let by = screenH - totalH - 16;
      for (let i = 0; i < phase.choices.length; i++) {
        if (hitTest(x, y, { x: this.PAD, y: by, w, h: btnH })) { this.pressedButton = `choice-${i}`; return true; }
        by += btnH + gap;
      }
      return true;
    } else if (type === "end") {
      if (this.pressedButton === "back" && hitTest(x, y, backBtn)) {
        playSfx("click");
        this.view = "map";
        this.pressedButton = null;
        return true;
      }
      if (this.pressedButton === "advance") {
        if (this.typeProgress < 1) { this.typeProgress = 1; playSfx("tick"); }
        else if (!this.isLastDialogue()) { this.dialogueIndex++; this.typeProgress = 0; playSfx("tick"); }
        this.pressedButton = null;
        return true;
      }
      if (this.pressedButton === "continue") {
        this.afterFeedback();
        this.pressedButton = null;
        return true;
      }
      if (this.pressedButton && this.pressedButton.startsWith("choice-")) {
        const idx = parseInt(this.pressedButton.slice(7));
        const btnH = 52, gap = 10;
        const w = screenW - this.PAD * 2;
        const totalH = phase.choices.length * btnH + (phase.choices.length - 1) * gap;
        let by = screenH - totalH - 16;
        for (let i = 0; i < idx; i++) by += btnH + gap;
        if (hitTest(x, y, { x: this.PAD, y: by, w, h: btnH })) {
          this.applyChoice(idx);
        }
        this.pressedButton = null;
        return true;
      }
      this.pressedButton = null;
      return false;
    }
    return false;
  }

  private handleEndingTouch(type: "start" | "move" | "end", x: number, _y: number): boolean {
    const screenW = this.director.screenWidth;
    const screenH = this.director.screenHeight;
    const w = screenW - this.PAD * 2;
    const panelH = Math.min(440, screenH * 0.82);
    const panelY = (screenH - panelH) / 2;
    const btnW = (w - 36 - 12) / 2;
    const btnH = 44;
    const btnY = panelY + panelH - btnH - 16;
    const btnX = this.PAD + 18;

    if (type === "start") {
      if (hitTest(x, _y, { x: btnX, y: btnY, w: btnW, h: btnH })) this.pressedButton = "restart";
      else if (hitTest(x, _y, { x: btnX + btnW + 12, y: btnY, w: btnW, h: btnH })) this.pressedButton = "backtohub";
      return true;
    } else if (type === "end") {
      if (this.pressedButton === "restart" && hitTest(x, _y, { x: btnX, y: btnY, w: btnW, h: btnH })) {
        playSfx("click");
        this.resetAll();
      } else if (this.pressedButton === "backtohub" && hitTest(x, _y, { x: btnX + btnW + 12, y: btnY, w: btnW, h: btnH })) {
        playSfx("click");
        this.director.pop();
      }
      this.pressedButton = null;
      return true;
    }
    return true;
  }

  // ============ 逻辑辅助 ============
  private enterPhase(idx: number): void {
    this.activePhase = idx;
    this.view = "scene";
    this.dialogueIndex = 0;
    this.typeProgress = 0;
    this.pendingFeedback = null;
    postFX.flash(PHASES[idx].accent, 0.2);
  }

  private applyChoice(idx: number): void {
    const phase = PHASES[this.activePhase];
    const c = phase.choices[idx];
    this.trust = clamp(this.trust + c.trust, 0, 100);
    this.alert = clamp(this.alert + c.alert, 0, 100);
    if (c.flag) this.flagsHit.push(c.flag);
    this.explored[this.activePhase] = true;
    this.appliedChoiceIndex = idx;
    this.pendingFeedback = c.feedback;
    this.pendingPhase = this.activePhase;
    playSfx(c.alert >= c.trust ? "achievement" : "click");
    postFX.flash(c.alert >= c.trust ? Theme.colors.safe.DEFAULT : Theme.colors.warn.DEFAULT, 0.25);
  }

  private afterFeedback(): void {
    const isLast = this.pendingPhase >= PHASES.length - 1;
    if (isLast) {
      // 最后节点（杀猪）第二个选项 = 拉黑报警 = 脱身
      const wise = this.appliedChoiceIndex === 1;
      this.endingType = wise ? "escape" : "scammed";
      this.view = "ending";
      postFX.flash(this.endingType === "escape" ? Theme.colors.safe.DEFAULT : Theme.colors.warn.DEFAULT, 0.4, 2);
      if (this.endingType === "escape") {
        this.particles.spawnBurst(this.director.screenWidth / 2, this.director.screenHeight * 0.4,
          Theme.colors.safe.DEFAULT, { ring: true, sparks: 14, dots: 20, speed: 180, life: 1.0, size: 4 });
      }
    } else {
      this.view = "map";
    }
    this.pendingFeedback = null;
    this.pendingPhase = -1;
    this.appliedChoiceIndex = -1;
  }

  private resetAll(): void {
    this.view = "map";
    this.activePhase = 0;
    this.explored = PHASES.map(() => false);
    this.trust = 0; this.alert = 0;
    this.trustShown = 0; this.alertShown = 0;
    this.dialogueIndex = 0; this.typeProgress = 0;
    this.pendingFeedback = null; this.pendingPhase = -1;
    this.endingType = null; this.flagsHit = [];
  }

  private currentDialogue() {
    const list = PHASES[this.activePhase].dialogue;
    return this.dialogueIndex < list.length ? list[this.dialogueIndex] : null;
  }
  private currentDialogueText(): string {
    return this.currentDialogue()?.text ?? "";
  }
  private isLastDialogue(): boolean {
    const list = PHASES[this.activePhase].dialogue;
    return list.length === 0 || this.dialogueIndex >= list.length - 1;
  }

  // ============ 绘制工具 ============
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  private wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxH?: number): void {
    const chars = Array.from(text);
    let line = "";
    let yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = ch; yy += lh;
        if (maxH !== undefined && yy - y > maxH - lh) { ctx.fillText("…", x, yy); return; }
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  private truncate(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number): void {
    let t = text;
    while (ctx.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1);
    if (t !== text) t = t.slice(0, -1) + "…";
    ctx.fillText(t, x, y);
  }
}

/** 内联版 glow badge（避免引入额外依赖，仅画圆底+序号） */
function drawGlowBadgeSafe(
  ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 9, y + 9, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0A1929";
  ctx.font = `700 10px ${Theme.fonts.mono}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x + 9, y + 10);
  ctx.restore();
}
