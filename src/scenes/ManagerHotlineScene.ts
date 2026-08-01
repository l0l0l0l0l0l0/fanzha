/**
 * 96110 通话模拟（ManagerHotlineScene）
 * v9 Phase 4.4：模拟拨打 96110 反诈专线
 * - 玩家选择报案场景（疑似被骗/已转账/亲友被诈骗咨询/陌生来电核实）
 * - 与「反诈接线员」分支对话，学习如何高效报警
 * - 每个分支结束展示「报警要点清单」+ 真实报警提示
 * - 完成后奖励反诈积分
 */
import { Scene } from "@/ui/Scene";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawBackground, drawPanel, hitTest } from "@/ui/widgets";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort, setOrientation } from "@/platform/web";
import { ManagerDeployScene } from "./ManagerDeployScene";

// ============ 字号令牌 ============

const FONT_TITLE = 28;
const FONT_SUBTITLE = 15;
const FONT_BODY = 15;
const FONT_DIALOG = 16;
const FONT_BTN = 16;
const FONT_META = 12;

const COLOR_OPERATOR = "#00E5FF";
const COLOR_PLAYER = "#52C41A";
const COLOR_INFO = "#FFD666";
const COLOR_DANGER = "#E5353B";

// ============ 数据结构 ============

interface HotlineOption {
  id: string;
  text: string;
  nextNodeId: string;
}

interface HotlineNode {
  id: string;
  /** 接线员台词 */
  operatorMsg: string;
  /** 选项（无选项=结局节点） */
  options?: HotlineOption[];
  /** 是否为结局节点 */
  isEnding?: boolean;
  /** 结局类型 */
  endingType?: "complete" | "incomplete";
  /** 结局说明 */
  endingDesc?: string;
  /** 报警要点清单（结局节点展示） */
  checklist?: string[];
}

interface HotlineScenario {
  id: string;
  /** 场景标题 */
  title: string;
  /** 短描述 */
  desc: string;
  emoji: string;
  color: string;
  /** 起始节点 id */
  startNodeId: string;
  nodes: Record<string, HotlineNode>;
}

// ============ 4 个报警场景剧本 ============

const HOTLINE_SCENARIOS: HotlineScenario[] = [
  {
    id: "suspect_fraud",
    title: "疑似遭遇诈骗",
    desc: "对方让我转账到安全账户，我怀疑是骗子……",
    emoji: "🚨",
    color: COLOR_DANGER,
    startNodeId: "n1",
    nodes: {
      n1: {
        id: "n1",
        operatorMsg: "您好，这里是 96110 反诈劝阻专线。请问您遇到了什么情况？",
        options: [
          { id: "a", text: "对方说涉嫌洗钱，要我转安全账户", nextNodeId: "n2" },
          { id: "b", text: "客服说要双倍退款让我共享屏幕", nextNodeId: "n3" },
          { id: "c", text: "网恋对象推荐理财，我已投 5 万", nextNodeId: "n4" },
        ],
      },
      n2: {
        id: "n2",
        operatorMsg: "这是典型冒充公检法诈骗。公检法不会电话办案，更不存在「安全账户」。请立即停止任何转账操作。请问您已经转账了吗？",
        options: [
          { id: "a", text: "还没转，但对方一直催", nextNodeId: "end_complete" },
          { id: "b", text: "已经转了 80 万", nextNodeId: "end_call_110" },
        ],
      },
      n3: {
        id: "n3",
        operatorMsg: "冒充客服+屏幕共享诈骗。对方通过屏幕共享看到了您的验证码并转走资金。请立即挂断、关闭屏幕共享、冻结银行卡。您转账了吗？",
        options: [
          { id: "a", text: "没转，已挂断", nextNodeId: "end_complete" },
          { id: "b", text: "已转，验证码也给了", nextNodeId: "end_call_110" },
        ],
      },
      n4: {
        id: "n4",
        operatorMsg: "这是杀猪盘诈骗。「老师带单+虚假平台+无法提现」是收网标志。请立即停止投入，保存所有聊天/转账记录。您能提现吗？",
        options: [
          { id: "a", text: "不能提现，对方说要缴税", nextNodeId: "end_call_110" },
          { id: "b", text: "还没尝试提现", nextNodeId: "end_complete" },
        ],
      },
      end_complete: {
        id: "end_complete",
        operatorMsg: "做得好！您成功识破了骗局。请保留对方号码、聊天记录作为证据。如再接到可疑电话请立即挂断并来电核实。",
        isEnding: true,
        endingType: "complete",
        endingDesc: "正确应对！96110 是预警劝阻专线，识破骗局未转账是最佳结果。",
        checklist: [
          "✓ 识破骗局未转账",
          "✓ 保留对方号码和聊天记录",
          "✓ 后续可疑来电立即挂断",
          "✓ 下载国家反诈中心 APP 开启预警",
        ],
      },
      end_call_110: {
        id: "end_call_110",
        operatorMsg: "已记录您的报警信息。请您立即拨打 110 报警，并提供：转账时间、金额、对方账户、聊天记录。黄金止付时间是 30 分钟内，请尽快！",
        isEnding: true,
        endingType: "complete",
        endingDesc: "正确报警！96110 劝阻+110 止付是黄金组合。30 分钟内是止付关键期。",
        checklist: [
          "✓ 立即拨打 110 报警",
          "✓ 提供转账时间/金额/对方账户",
          "✓ 保留聊天记录/通话记录作为证据",
          "✓ 联系银行冻结对方账户",
          "✓ 30 分钟内是黄金止付时间",
        ],
      },
    },
  },
  {
    id: "already_transferred",
    title: "已经转账了",
    desc: "我刚刚把钱转给了骗子，怎么办？",
    emoji: "💸",
    color: COLOR_DANGER,
    startNodeId: "n1",
    nodes: {
      n1: {
        id: "n1",
        operatorMsg: "您好，这里是 96110。请保持冷静，越早报警止付成功率越高。请问您转账多久了？",
        options: [
          { id: "a", text: "10 分钟内", nextNodeId: "n2" },
          { id: "b", text: "30 分钟 - 2 小时", nextNodeId: "n3" },
          { id: "c", text: "超过 2 小时", nextNodeId: "n4" },
        ],
      },
      n2: {
        id: "n2",
        operatorMsg: "还在黄金止付窗口！立即拨打 110，告知转账时间、金额、对方账户。同时联系您的银行申请紧急冻结对方账户。",
        options: [
          { id: "a", text: "好的，我立即打 110", nextNodeId: "end_complete" },
          { id: "b", text: "对方账户我没有", nextNodeId: "n5" },
        ],
      },
      n3: {
        id: "n3",
        operatorMsg: "仍有止付可能。请立即拨打 110 报警，提供转账凭证、对方账户、聊天记录。资金可能已被分散转移，但仍需报警固定证据。",
        options: [
          { id: "a", text: "好的，我立即报警", nextNodeId: "end_complete" },
          { id: "b", text: "想先联系骗子协商退款", nextNodeId: "n6" },
        ],
      },
      n4: {
        id: "n4",
        operatorMsg: "资金大概率已被转移，但报警仍是必要的。请保留所有证据报警，警方会立案侦查。同时警惕「追款中介」二次诈骗。",
        options: [
          { id: "a", text: "好的，我去报警", nextNodeId: "end_complete" },
          { id: "b", text: "网上有人说能帮我追回", nextNodeId: "n6" },
        ],
      },
      n5: {
        id: "n5",
        operatorMsg: "对方账户在转账凭证/银行流水中可以查到。立即打开手机银行 APP 查看转账详情，或带身份证到银行网点打印流水，然后拨打 110 报警。",
        options: [
          { id: "a", text: "好的，我现在去查", nextNodeId: "end_complete" },
        ],
      },
      n6: {
        id: "n6",
        operatorMsg: "⚠️ 警惕二次诈骗！「追款中介」「黑客追回」100% 是骗子，利用受害人急切心理二次收割。被骗资金只能通过公安机关依法追回。",
        options: [
          { id: "a", text: "明白了，我只信公安机关", nextNodeId: "end_complete" },
        ],
      },
      end_complete: {
        id: "end_complete",
        operatorMsg: "已记录您的报警需求。请尽快拨打 110，警方会按程序处置。如需心理援助可联系当地心理热线。",
        isEnding: true,
        endingType: "complete",
        endingDesc: "正确响应！被骗后第一时间的正确动作是 110 报警+保留证据+拒绝任何「追款中介」。",
        checklist: [
          "✓ 立即拨打 110 报警",
          "✓ 提供转账凭证/对方账户",
          "✓ 保留聊天/通话记录",
          "✓ 联系银行冻结对方账户",
          "✓ 警惕「追款中介」二次诈骗",
        ],
      },
    },
  },
  {
    id: "verify_call",
    title: "核实陌生来电",
    desc: "接到自称反诈中心/公检法的电话，是真的吗？",
    emoji: "🔍",
    color: COLOR_INFO,
    startNodeId: "n1",
    nodes: {
      n1: {
        id: "n1",
        operatorMsg: "您好，这里是 96110 反诈专线。请问您要核实什么电话？",
        options: [
          { id: "a", text: "对方自称反诈中心，要我转账", nextNodeId: "n2" },
          { id: "b", text: "对方自称公安局，说我涉嫌洗钱", nextNodeId: "n3" },
          { id: "c", text: "对方自称法院，说我被起诉了", nextNodeId: "n4" },
        ],
      },
      n2: {
        id: "n2",
        operatorMsg: "⚠️ 这是冒充反诈中心诈骗！真 96110 只会劝阻您转账，永远不会要求您转账到任何账户。请立即挂断并拉黑对方号码。",
        options: [
          { id: "a", text: "明白了，立即挂断", nextNodeId: "end_complete" },
        ],
      },
      n3: {
        id: "n3",
        operatorMsg: "冒充公检法诈骗。公检法不电办、不设安全账户、不发拘捕令到 QQ/微信、不要求隔离接听——任何违反「四不」的都是假冒。",
        options: [
          { id: "a", text: "已挂断，如何举报？", nextNodeId: "n5" },
        ],
      },
      n4: {
        id: "n4",
        operatorMsg: "冒充法院诈骗。法院传票通过邮政 EMS 寄送并附案号，不会发语音电话+按键转人工。可拨打 12368 诉讼服务热线核实。",
        options: [
          { id: "a", text: "好的，挂断并打 12368 核实", nextNodeId: "end_complete" },
        ],
      },
      n5: {
        id: "n5",
        operatorMsg: "举报方式：1) 国家反诈中心 APP「我要举报」；2) 拨打 110；3) 短信举报至 12110。请保留对方号码、通话记录作为证据。",
        options: [
          { id: "a", text: "好的，我去举报", nextNodeId: "end_complete" },
        ],
      },
      end_complete: {
        id: "end_complete",
        operatorMsg: "正确识别！任何要求转账的「公检法/反诈中心」都是假冒，请保持警惕并积极举报。",
        isEnding: true,
        endingType: "complete",
        endingDesc: "识破冒充！核实陌生「公检法」来电的最好方式是挂断后通过 110/12368/12360 等官方热线回拨核实。",
        checklist: [
          "✓ 不轻信来电显示的号码（可改号）",
          "✓ 真公检法不电话办案/不设安全账户",
          "✓ 通过 110/12368/12360 官方热线核实",
          "✓ 保留证据并通过反诈 APP 举报",
        ],
      },
    },
  },
  {
    id: "family_consult",
    title: "亲友被诈骗咨询",
    desc: "家里老人/朋友疑似被骗，但不听劝，怎么办？",
    emoji: "👨‍👩‍👧",
    color: COLOR_INFO,
    startNodeId: "n1",
    nodes: {
      n1: {
        id: "n1",
        operatorMsg: "您好，这里是 96110。请描述一下您亲友的情况，被骗类型是什么？",
        options: [
          { id: "a", text: "老人沉迷理财群，已经投了 20 万", nextNodeId: "n2" },
          { id: "b", text: "朋友被「警察」电话吓到要转账", nextNodeId: "n3" },
          { id: "c", text: "孩子要给游戏主播刷大额礼物", nextNodeId: "n4" },
        ],
      },
      n2: {
        id: "n2",
        operatorMsg: "杀猪盘或虚假投资盘。受害人往往处于「沉没成本」心理，难以自行止损。建议：1) 协助其拨打 110 报警；2) 联系银行冻结账户；3) 必要时寻求心理干预。",
        options: [
          { id: "a", text: "他不肯报警怎么办？", nextNodeId: "n5" },
          { id: "b", text: "好的，我陪他去报警", nextNodeId: "end_complete" },
        ],
      },
      n3: {
        id: "n3",
        operatorMsg: "冒充公检法诈骗。受害人被「拘捕令」恐吓后常隔离接听。建议：1) 切断其与骗子的联系（夺手机/断网）；2) 立即拨打 110；3) 用真实亲属身份证明对方是假冒。",
        options: [
          { id: "a", text: "好的，立即夺手机报警", nextNodeId: "end_complete" },
        ],
      },
      n4: {
        id: "n4",
        operatorMsg: "未成年人打赏纠纷。根据民法典，8 周岁以上未成年人打赏可主张退还。建议：1) 联系直播平台客服申请未成年人打赏退款；2) 设置支付密码；3) 加强家庭沟通。",
        options: [
          { id: "a", text: "好的，我去联系平台", nextNodeId: "end_complete" },
        ],
      },
      n5: {
        id: "n5",
        operatorMsg: "受害人不愿报警时：1) 您可代为报警提供线索（警方会处理）；2) 联系反诈中心上门劝阻（96110 可指派辖区民警）；3) 银行端可申请账户保护性止付。",
        options: [
          { id: "a", text: "明白了，我去代为报警", nextNodeId: "end_complete" },
        ],
      },
      end_complete: {
        id: "end_complete",
        operatorMsg: "感谢您关心亲友的安全。家人朋友是反诈的最后一道防线，发现异常请尽早干预。",
        isEnding: true,
        endingType: "complete",
        endingDesc: "亲友协助报警！家属可在受害人不愿报警时代为提供线索，96110 可指派辖区民警上门劝阻。",
        checklist: [
          "✓ 协助受害人拨打 110 报警",
          "✓ 切断受害人与骗子联系",
          "✓ 联系银行保护性止付",
          "✓ 96110 可指派民警上门劝阻",
          "✓ 未成年人打赏可依法主张退还",
        ],
      },
    },
  },
];

// ============ 场景状态 ============

type HotlinePhase = "select" | "call" | "summary";

interface DialogEntry {
  role: "operator" | "player";
  text: string;
}

export class ManagerHotlineScene extends Scene {
  private phase: HotlinePhase = "select";
  private currentScenario: HotlineScenario | null = null;
  private currentNodeId = "";
  private dialogLog: DialogEntry[] = [];
  private pressedBtn: string | null = null;
  private phaseT = 0;
  /** 通话进度动画（用于接线员打字效果） */
  private typewriterT = 0;
  private readonly typeSpeed = 35;
  private msgComplete = false;
  /** 已完成的场景 id 集合（用于一次性奖励） */
  private completedScenarios = new Set<string>();

  enter(): void {
    super.enter();
    setOrientation("landscape");
    this.phase = "select";
    this.phaseT = 0;
    this.currentScenario = null;
    this.dialogLog = [];
    this.pressedBtn = null;
    // 加载已完成的场景（通过 managerMeta.unlockedCases 复用存储）
    const meta = platformStore.managerMetaProgress();
    for (const id of meta.unlockedCases) {
      if (id.startsWith("hotline_")) {
        this.completedScenarios.add(id.replace("hotline_", ""));
      }
    }
  }

  update(dt: number): void {
    super.update(dt);
    this.phaseT += dt;
    if (this.phase === "call" && !this.msgComplete) {
      const msg = this.getCurrentOperatorMsg();
      this.typewriterT += dt * this.typeSpeed;
      if (this.typewriterT >= msg.length) {
        this.typewriterT = msg.length;
        this.msgComplete = true;
      }
    }
  }

  // ============ 渲染 ============

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    drawBackground(ctx, screenW, screenH);
    switch (this.phase) {
      case "select":
        this.renderSelect(ctx, screenW, screenH);
        break;
      case "call":
        this.renderCall(ctx, screenW, screenH);
        break;
      case "summary":
        this.renderSummary(ctx, screenW, screenH);
        break;
    }
  }

  // ---- select：场景选择 ----

  private renderSelect(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const cx = sw / 2;

    // 顶部装饰：模拟电话图标
    ctx.font = `900 36px ${Theme.fonts.display}`;
    ctx.fillStyle = COLOR_OPERATOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = COLOR_OPERATOR;
    ctx.shadowBlur = 14;
    ctx.fillText("📞 96110", cx, sh * 0.09);
    ctx.shadowBlur = 0;

    ctx.font = `900 ${FONT_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.fillText("反诈劝阻专线模拟", cx, sh * 0.15);

    ctx.font = `400 ${FONT_SUBTITLE}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("选择场景，练习如何与 96110 接线员沟通", cx, sh * 0.20);

    // 场景卡片（2×2 网格）
    const cardW = sw * 0.42;
    const cardH = 100;
    const gap = 12;
    const startX = (sw - cardW * 2 - gap) / 2;
    const startY = sh * 0.27;

    for (let i = 0; i < HOTLINE_SCENARIOS.length; i++) {
      const s = HOTLINE_SCENARIOS[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      const isPressed = this.pressedBtn === `scenario_${i}`;
      const isCompleted = this.completedScenarios.has(s.id);

      drawPanel(ctx, x, y, cardW, cardH, {
        borderColor: s.color,
        borderWidth: isCompleted ? 2 : 1,
        bgColor: withAlpha(s.color, 0.08),
      });

      ctx.fillStyle = s.color;
      ctx.fillRect(x, y, cardW, 3);

      ctx.font = `900 32px ${Theme.fonts.display}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = s.color;
      ctx.fillText(s.emoji, x + 16, y + 36);

      ctx.font = `700 ${FONT_BTN + 2}px ${Theme.fonts.display}`;
      ctx.fillStyle = s.color;
      ctx.fillText(s.title, x + 56, y + 28);

      ctx.font = `400 ${FONT_META}px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      const descLines = this.wrapText(ctx, s.desc, cardW - 80);
      descLines.slice(0, 2).forEach((line, j) => {
        ctx.fillText(line, x + 56, y + 52 + j * 14);
      });

      ctx.textAlign = "right";
      if (isCompleted) {
        ctx.font = `700 ${FONT_META}px ${Theme.fonts.mono}`;
        ctx.fillStyle = COLOR_PLAYER;
        ctx.fillText("✓ 已完成", x + cardW - 12, y + cardH - 14);
      } else {
        ctx.font = `900 18px ${Theme.fonts.display}`;
        ctx.fillStyle = s.color;
        ctx.fillText("▶", x + cardW - 16, y + cardH - 16);
      }

      if (isPressed) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, cardW, cardH);
      }
    }

    ctx.textAlign = "center";

    // 96110 提示
    ctx.font = `400 ${FONT_META}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.fillText("96110 是工信部为公安机关反诈中心开通的专用号码，用于预警劝阻和反诈咨询", cx, sh - 76);

    // 返回按钮
    const backW = 180;
    const backH = 44;
    const backX = cx - backW / 2;
    const backY = sh - 56;
    this.drawButton(ctx, backX, backY, backW, backH, "← 返回菜单", Theme.colors.ink.dim, "back");
  }

  // ---- call：通话阶段 ----

  private renderCall(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    if (!this.currentScenario) return;
    const s = this.currentScenario;
    const cx = sw / 2;

    // 顶部模拟通话状态栏
    ctx.fillStyle = withAlpha(s.color, 0.12);
    ctx.fillRect(0, 0, sw, 50);
    ctx.fillStyle = s.color;
    ctx.fillRect(0, 50, sw, 2);

    // 通话中动画（脉冲点）
    const pulseT = (Math.sin(this.phaseT * 4) + 1) / 2;
    ctx.fillStyle = withAlpha(COLOR_PLAYER, 0.5 + pulseT * 0.5);
    ctx.beginPath();
    ctx.arc(20, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = s.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${s.emoji} 96110 · ${s.title}`, 36, 25);

    ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText(`通话中 ${this.formatDuration(this.phaseT)}`, sw - 16, 25);

    // 聊天区域
    const chatTop = 60;
    const node = this.getCurrentNode();
    const chatBottom = node?.isEnding ? sh - 80 : sh - 160;
    const bubbleMaxW = sw * 0.65;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // 从底部向上绘制聊天记录
    let yPos = chatBottom - 8;
    for (let i = this.dialogLog.length - 1; i >= 0; i--) {
      const entry = this.dialogLog[i];
      const isOperator = entry.role === "operator";
      const text = isOperator && i === this.dialogLog.length - 1 && !this.msgComplete
        ? entry.text.slice(0, Math.floor(this.typewriterT))
        : entry.text;

      const lines = this.wrapText(ctx, text, bubbleMaxW - 32);
      const bubbleH = lines.length * 22 + 20;
      yPos -= bubbleH + 8;

      if (yPos < chatTop) break;

      const bubbleW = Math.min(bubbleMaxW, this.maxLineWidth(ctx, lines) + 32);
      const isRight = !isOperator;
      const bubbleX = isRight ? sw - 16 - bubbleW : 16;

      const bubbleColor = isOperator ? withAlpha(COLOR_OPERATOR, 0.15) : withAlpha(COLOR_PLAYER, 0.15);
      const borderColor = isOperator ? COLOR_OPERATOR : COLOR_PLAYER;

      ctx.fillStyle = bubbleColor;
      this.roundRect(ctx, bubbleX, yPos, bubbleW, bubbleH, 10);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = `400 ${FONT_DIALOG}px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      lines.forEach((line, j) => {
        ctx.fillText(line, bubbleX + 16, yPos + 10 + j * 22);
      });

      // 头像
      ctx.font = `900 18px ${Theme.fonts.display}`;
      ctx.textBaseline = "middle";
      const avatarX = isRight ? sw - 16 - bubbleW - 26 : 16 + bubbleW + 8;
      ctx.fillStyle = borderColor;
      ctx.fillText(isOperator ? "🛡️" : "🧑", avatarX, yPos + bubbleH / 2);
      ctx.textBaseline = "top";
    }

    // 打字指示器
    if (!this.msgComplete && this.dialogLog.length > 0) {
      const last = this.dialogLog[this.dialogLog.length - 1];
      if (last.role === "operator") {
        ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
        ctx.fillStyle = COLOR_OPERATOR;
        ctx.textAlign = "left";
        ctx.fillText("● 接线员正在回复...", 16, chatBottom + 4);
      }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 选项或结局按钮
    if (node?.isEnding) {
      const btnW = 240;
      const btnH = 48;
      this.drawButton(ctx, cx - btnW / 2, sh - 68, btnW, btnH, "查看报警要点 ▶", s.color, "to_summary");
    } else if (node && this.msgComplete) {
      const optW = sw * 0.88;
      const optH = 44;
      const optGap = 6;
      const startY = sh - node.options!.length * (optH + optGap) - 12;
      for (let i = 0; i < node.options!.length; i++) {
        const opt = node.options![i];
        const oy = startY + i * (optH + optGap);
        const ox = (sw - optW) / 2;
        const isPressed = this.pressedBtn === `opt_${i}`;
        this.drawOptionButton(ctx, ox, oy, optW, optH, opt.text, i, isPressed);
      }
    }
  }

  // ---- summary：报警要点总结 ----

  private renderSummary(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    if (!this.currentScenario) return;
    const s = this.currentScenario;
    const node = this.getCurrentNode();
    if (!node?.isEnding) return;
    const cx = sw / 2;

    // 标题
    ctx.font = `900 ${FONT_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = COLOR_PLAYER;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = COLOR_PLAYER;
    ctx.shadowBlur = 12;
    ctx.fillText("✓ 通话结束", cx, sh * 0.10);
    ctx.shadowBlur = 0;

    ctx.font = `400 ${FONT_BODY}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText(node.endingDesc ?? "", cx, sh * 0.15);

    // 要点清单卡片
    const cardY = sh * 0.20;
    const cardH = sh * 0.50;
    const cardX = sw * 0.10;
    const cardW = sw * 0.80;

    drawPanel(ctx, cardX, cardY, cardW, cardH, {
      borderColor: COLOR_PLAYER,
      borderWidth: 2,
      bgColor: withAlpha(COLOR_PLAYER, 0.06),
    });

    ctx.font = `700 ${FONT_BTN + 2}px ${Theme.fonts.display}`;
    ctx.fillStyle = COLOR_PLAYER;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("📋 报警要点清单", cardX + 20, cardY + 16);

    if (node.checklist) {
      ctx.font = `400 ${FONT_BODY + 1}px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      node.checklist.forEach((item, i) => {
        ctx.fillText(item, cardX + 24, cardY + 56 + i * 28);
      });
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 96110 / 110 双重提示
    ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = COLOR_DANGER;
    ctx.fillText("🚨 紧急报警请拨 110 · 反诈咨询请拨 96110", cx, sh * 0.75);

    // 按钮
    const btnW = 180;
    const btnH = 46;
    const gap = 16;
    const retryX = cx - btnW - gap / 2;
    const backX = cx + gap / 2;
    const btnY = sh * 0.84;

    this.drawButton(ctx, retryX, btnY, btnW, btnH, "🔄 再练一场景", s.color, "to_select");
    this.drawButton(ctx, backX, btnY, btnW, btnH, "← 返回菜单", Theme.colors.ink.dim, "back");
  }

  // ============ 触摸交互 ============

  handleTouch(type: "start" | "move" | "end", x: number, y: number, _touchId: number): boolean {
    if (type === "start") {
      this.pressedBtn = this.hitTestButton(x, y);
      return this.pressedBtn !== null;
    }
    if (type === "end") {
      const btn = this.hitTestButton(x, y);
      if (btn && btn === this.pressedBtn) {
        this.onButtonPress(btn);
      }
      this.pressedBtn = null;
      return btn !== null;
    }
    return false;
  }

  private hitTestButton(x: number, y: number): string | null {
    const sw = this.director.screenWidth;
    const sh = this.director.screenHeight;
    const cx = sw / 2;

    switch (this.phase) {
      case "select": {
        const cardW = sw * 0.42;
        const cardH = 100;
        const gap = 12;
        const startX = (sw - cardW * 2 - gap) / 2;
        const startY = sh * 0.27;
        for (let i = 0; i < HOTLINE_SCENARIOS.length; i++) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const cxi = startX + col * (cardW + gap);
          const cyi = startY + row * (cardH + gap);
          if (hitTest(x, y, { x: cxi, y: cyi, w: cardW, h: cardH })) return `scenario_${i}`;
        }
        const backW = 180, backH = 44;
        const backX = cx - backW / 2, backY = sh - 56;
        if (hitTest(x, y, { x: backX, y: backY, w: backW, h: backH })) return "back";
        return null;
      }

      case "call": {
        const node = this.getCurrentNode();
        if (!node) return null;
        if (node.isEnding) {
          const btnW = 240, btnH = 48;
          if (hitTest(x, y, { x: cx - btnW / 2, y: sh - 68, w: btnW, h: btnH })) return "to_summary";
          return null;
        }
        if (!this.msgComplete) return null;
        const optW = sw * 0.88;
        const optH = 44;
        const optGap = 6;
        const startY = sh - node.options!.length * (optH + optGap) - 12;
        for (let i = 0; i < node.options!.length; i++) {
          const oy = startY + i * (optH + optGap);
          const ox = (sw - optW) / 2;
          if (hitTest(x, y, { x: ox, y: oy, w: optW, h: optH })) return `opt_${i}`;
        }
        return null;
      }

      case "summary": {
        const btnW = 180, btnH = 46, gap = 16;
        const retryX = cx - btnW - gap / 2, backX = cx + gap / 2, btnY = sh * 0.84;
        if (hitTest(x, y, { x: retryX, y: btnY, w: btnW, h: btnH })) return "to_select";
        if (hitTest(x, y, { x: backX, y: btnY, w: btnW, h: btnH })) return "back";
        return null;
      }
    }
    return null;
  }

  private onButtonPress(btn: string): void {
    playSfx("click");
    vibrateShort();

    if (btn === "back") {
      this.director.replace(new ManagerDeployScene(this.director));
      return;
    }

    if (btn === "to_select") {
      this.phase = "select";
      this.phaseT = 0;
      this.currentScenario = null;
      this.dialogLog = [];
      return;
    }

    if (this.phase === "select" && btn.startsWith("scenario_")) {
      const idx = parseInt(btn.split("_")[1]);
      if (!isNaN(idx) && idx >= 0 && idx < HOTLINE_SCENARIOS.length) {
        this.startScenario(HOTLINE_SCENARIOS[idx]);
      }
      return;
    }

    if (this.phase === "call") {
      if (btn === "to_summary") {
        this.finishScenario();
        this.phase = "summary";
        this.phaseT = 0;
        return;
      }
      if (btn.startsWith("opt_")) {
        const idx = parseInt(btn.split("_")[1]);
        const node = this.getCurrentNode();
        if (node && node.options && idx >= 0 && idx < node.options.length) {
          this.selectOption(node.options[idx]);
        }
        return;
      }
    }
  }

  // ============ 通话逻辑 ============

  private startScenario(scenario: HotlineScenario): void {
    this.currentScenario = scenario;
    this.currentNodeId = scenario.startNodeId;
    this.dialogLog = [];
    this.phaseT = 0;
    this.typewriterT = 0;
    this.msgComplete = false;
    this.phase = "call";
    // 添加接线员第一条消息
    const startNode = scenario.nodes[scenario.startNodeId];
    this.dialogLog.push({ role: "operator", text: startNode.operatorMsg });
    playSfx("good"); // 拨通提示音
  }

  private selectOption(opt: HotlineOption): void {
    this.dialogLog.push({ role: "player", text: opt.text });
    const nextNode = this.currentScenario!.nodes[opt.nextNodeId];
    if (!nextNode) return;
    this.currentNodeId = nextNode.id;
    this.dialogLog.push({ role: "operator", text: nextNode.operatorMsg });
    this.typewriterT = 0;
    this.msgComplete = false;
  }

  private finishScenario(): void {
    if (!this.currentScenario) return;
    // 首次完成奖励 50 反诈积分
    if (!this.completedScenarios.has(this.currentScenario.id)) {
      this.completedScenarios.add(this.currentScenario.id);
      platformStore.unlockCase(`hotline_${this.currentScenario.id}`);
      platformStore.addManagerMetaResources({ antiFraudPoints: 50 });
    }
  }

  // ============ 辅助方法 ============

  private getCurrentNode(): HotlineNode | null {
    if (!this.currentScenario) return null;
    return this.currentScenario.nodes[this.currentNodeId] ?? null;
  }

  private getCurrentOperatorMsg(): string {
    return this.getCurrentNode()?.operatorMsg ?? "";
  }

  private formatDuration(t: number): string {
    const sec = Math.floor(t);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  private drawButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    text: string, color: string, id: string,
  ): void {
    const pressed = this.pressedBtn === id;
    const offsetY = pressed ? 2 : 0;
    ctx.save();
    ctx.fillStyle = pressed ? withAlpha(color, 0.8) : color;
    this.roundRect(ctx, x, y + offsetY, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 3;
    ctx.fillText(text, x + w / 2, y + offsetY + h / 2);
    ctx.restore();
  }

  private drawOptionButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    text: string, idx: number, pressed: boolean,
  ): void {
    const offsetY = pressed ? 2 : 0;
    ctx.save();
    ctx.fillStyle = pressed ? withAlpha(COLOR_PLAYER, 0.15) : withAlpha(Theme.colors.bg.card, 0.7);
    this.roundRect(ctx, x, y + offsetY, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = pressed ? COLOR_PLAYER : Theme.colors.bg.line;
    ctx.lineWidth = pressed ? 2 : 1;
    ctx.stroke();
    ctx.font = `900 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = COLOR_PLAYER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String.fromCharCode(65 + idx), x + 14, y + offsetY + h / 2);
    ctx.font = `400 ${FONT_DIALOG - 1}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const lines = this.wrapText(ctx, text, w - 36);
    lines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, x + 36, y + offsetY + h / 2 - (lines.length - 1) * 8 + i * 16);
    });
    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let current = "";
    for (const ch of text) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  private maxLineWidth(ctx: CanvasRenderingContext2D, lines: string[]): number {
    let max = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > max) max = w;
    }
    return max;
  }
}
