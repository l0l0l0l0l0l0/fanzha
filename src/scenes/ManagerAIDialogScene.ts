/**
 * AI 对话演练（ManagerAIDialogScene）
 * v9 Phase 4.2：分支对话训练系统
 * - 玩家与"AI 骗子"模拟对话，练习识破话术
 * - 每轮 2-3 个回应选项，不同选项导向不同结局
 * - 3 种结局：识破（safe）/ 中招（scammed）/ 警觉（suspicious）
 * - 聊天气泡 UI，打字机效果，分支评分
 */
import { Scene } from "@/ui/Scene";
import type { SceneDirector } from "@/ui/SceneDirector";
import { Theme, withAlpha } from "@/ui/Theme";
import { drawBackground, drawPanel, hitTest } from "@/ui/widgets";
import { platformStore } from "@/store/platformStore";
import { playSfx } from "@/engine/Audio";
import { vibrateShort } from "@/platform/web";
import { ManagerDeployScene } from "./ManagerDeployScene";

// ============ 对话数据结构 ============

interface DialogOption {
  id: string;
  text: string;
  nextNodeId: string;
  /** +1 机警 / 0 中性 / -1 危险 */
  score: number;
}

interface DialogNode {
  id: string;
  scammerMsg: string;
  options?: DialogOption[];
  isEnding?: boolean;
  endingType?: "safe" | "scammed" | "suspicious";
  endingDesc?: string;
}

interface DialogScenario {
  id: string;
  title: string;
  fraudType: string;
  emoji: string;
  color: string;
  desc: string;
  nodes: Record<string, DialogNode>;
  startNodeId: string;
}

// ============ 3 个对话剧本 ============

const SCENARIOS: DialogScenario[] = [
  {
    id: "fake_refund",
    title: "假客服退款",
    fraudType: "冒充客服诈骗",
    emoji: "💬",
    color: "#FFB020",
    desc: "接到自称淘宝客服的电话，说你的订单有质量问题要双倍退款……",
    startNodeId: "n1",
    nodes: {
      n1: {
        id: "n1",
        scammerMsg: "您好，我是淘宝客服。您上周购买的奶粉经检测有质量问题，我们现在为您办理双倍退款，请您配合。",
        options: [
          { id: "a", text: "好的，怎么退款？", nextNodeId: "n2", score: -1 },
          { id: "b", text: "我没有买奶粉，你打错了", nextNodeId: "n3", score: 1 },
          { id: "c", text: "订单号是多少？", nextNodeId: "n2", score: 0 },
        ],
      },
      n2: {
        id: "n2",
        scammerMsg: "退款需要您下载一个'理赔 APP'，然后开启屏幕共享，我们指导您操作。这是理赔编号 TG-8847。",
        options: [
          { id: "a", text: "好的，我下载", nextNodeId: "end_scammed", score: -1 },
          { id: "b", text: "屏幕共享？不对，我挂了", nextNodeId: "end_safe", score: 1 },
          { id: "c", text: "理赔编号我在哪查？", nextNodeId: "n4", score: 0 },
        ],
      },
      n3: {
        id: "n3",
        scammerMsg: "可能是系统订单串号了。不管怎样，您的账户确实存在风险，需要解除，否则会扣费。请配合核实身份信息。",
        options: [
          { id: "a", text: "什么扣费？我不配合", nextNodeId: "end_safe", score: 1 },
          { id: "b", text: "那要怎么核实？", nextNodeId: "n4", score: -1 },
        ],
      },
      n4: {
        id: "n4",
        scammerMsg: "请提供您的身份证号、银行卡号和手机验证码，我们帮您核实并退款到账。",
        options: [
          { id: "a", text: "验证码不能给！", nextNodeId: "end_safe", score: 1 },
          { id: "b", text: "好的，我发给你", nextNodeId: "end_scammed", score: -1 },
        ],
      },
      end_safe: {
        id: "end_safe",
        scammerMsg: "……（对方挂断）",
        isEnding: true,
        endingType: "safe",
        endingDesc: "识破骗局！客服不主动、退款走官方、验证码不给、屏幕共享不开——四道防线你守住了。",
      },
      end_scammed: {
        id: "end_scammed",
        scammerMsg: "好的，请打开屏幕共享，输入验证码……（账户资金被转走）",
        isEnding: true,
        endingType: "scammed",
        endingDesc: "中招了！屏幕共享=交出手机控制权，验证码=资金最后一道锁。客服退款一律走官方 APP。",
      },
    },
  },
  {
    id: "fake_police",
    title: "冒充公检法",
    fraudType: "冒充公检法诈骗",
    emoji: "📞",
    color: "#E5353B",
    desc: "接到自称公安局的电话，说你涉嫌洗钱，需要配合调查……",
    startNodeId: "n1",
    nodes: {
      n1: {
        id: "n1",
        scammerMsg: "你好，这里是市公安局。你名下的银行卡涉嫌洗钱 200 万，现对你进行电话立案，请配合调查，不得挂断。",
        options: [
          { id: "a", text: "我没有洗钱！我配合", nextNodeId: "n2", score: -1 },
          { id: "b", text: "公检法不电办，我挂了", nextNodeId: "end_safe", score: 1 },
          { id: "c", text: "你是哪个公安局？工号多少？", nextNodeId: "n3", score: 0 },
        ],
      },
      n2: {
        id: "n2",
        scammerMsg: "为了自证清白，你需要将资金转入我们提供的'安全账户'进行审查。这是拘捕令，已发到你 QQ。",
        options: [
          { id: "a", text: "安全账户？不存在的东西", nextNodeId: "end_safe", score: 1 },
          { id: "b", text: "我转，别抓我", nextNodeId: "end_scammed", score: -1 },
          { id: "c", text: "拘捕令发 QQ？公检法不这么干", nextNodeId: "end_safe", score: 1 },
        ],
      },
      n3: {
        id: "n3",
        scammerMsg: "我是刑侦大队李警官，工号 32817。你不配合调查将立即被逮捕，后果自负！现在不要挂电话，找个没人的地方。",
        options: [
          { id: "a", text: "找没人的地方？这是隔离话术", nextNodeId: "end_safe", score: 1 },
          { id: "b", text: "好的，我去找个安静的地方", nextNodeId: "n2", score: -1 },
        ],
      },
      end_safe: {
        id: "end_safe",
        scammerMsg: "……（对方挂断）",
        isEnding: true,
        endingType: "safe",
        endingDesc: "识破骗局！公检法不电办、不设安全账户、不发拘捕令到 QQ、不要求隔离——四不原则你守住了。",
      },
      end_scammed: {
        id: "end_scammed",
        scammerMsg: "好的，请记下安全账户……（资金被转走，且被隔离无法核实）",
        isEnding: true,
        endingType: "scammed",
        endingDesc: "中招了！公检法不会电话办案，更没有'安全账户'。被要求'找没人的地方'是隔离话术，阻止你向家人核实。",
      },
    },
  },
  {
    id: "ai_deepfake",
    title: "AI 换脸借钱",
    fraudType: "AI 换脸冒充熟人",
    emoji: "🎭",
    color: "#A8E6CF",
    desc: "收到儿子的视频通话请求，画面里是儿子的脸，说急需用钱……",
    startNodeId: "n1",
    nodes: {
      n1: {
        id: "n1",
        scammerMsg: "（视频接通，画面是儿子的脸）妈，我出事了，朋友出了车祸急需手术费 5 万，你先转给我，别告诉爸。",
        options: [
          { id: "a", text: "马上转，哪家医院？", nextNodeId: "n2", score: -1 },
          { id: "b", text: "你小时候养的那只猫叫什么？", nextNodeId: "n3", score: 1 },
          { id: "c", text: "我给你爸打个电话核实", nextNodeId: "n4", score: 0 },
        ],
      },
      n2: {
        id: "n2",
        scammerMsg: "在省医院，快点转，来不及了！这是我的卡号 6228……（画面有轻微卡顿）",
        options: [
          { id: "a", text: "画面怎么卡？不对劲", nextNodeId: "n3", score: 1 },
          { id: "b", text: "好的，我马上转", nextNodeId: "end_scammed", score: -1 },
        ],
      },
      n3: {
        id: "n3",
        scammerMsg: "（画面突然卡顿，嘴型与声音不同步）……妈，别问了，赶紧转钱，急用！",
        options: [
          { id: "a", text: "你是 AI 换脸，我挂了报警", nextNodeId: "end_safe", score: 1 },
          { id: "b", text: "可能信号不好，我转", nextNodeId: "end_scammed", score: -1 },
        ],
      },
      n4: {
        id: "n4",
        scammerMsg: "别告诉爸！这事不能让他知道，你先转给我，回头我解释。",
        options: [
          { id: "a", text: "不告诉爸？太可疑了", nextNodeId: "n3", score: 1 },
          { id: "b", text: "好吧，不告诉爸", nextNodeId: "end_scammed", score: -1 },
        ],
      },
      end_safe: {
        id: "end_safe",
        scammerMsg: "……（视频突然挂断，对方失联）",
        isEnding: true,
        endingType: "safe",
        endingDesc: "识破骗局！AI 换脸有卡顿、眨眼异常、嘴型不同步等破绽。借钱务必用私密问题核实，换渠道（电话）确认本人。",
      },
      end_scammed: {
        id: "end_scammed",
        scammerMsg: "好的，转过来吧……（资金转出后，真实儿子打来电话：我没有借过钱）",
        isEnding: true,
        endingType: "scammed",
        endingDesc: "中招了！AI 换脸+换声 10 分钟即可伪造。视频借钱务必换渠道核实，用私密问题（宠物名/童年事）验证身份。",
      },
    },
  },
];

// ============ 场景状态 ============

type DialogPhase = "select" | "chat" | "result";

/** 聊天记录条目 */
interface ChatEntry {
  role: "scammer" | "player";
  text: string;
}

// ============ 字号令牌（比适老模式小，比常规略大） ============

const FONT_TITLE = 32;
const FONT_BODY = 18;
const FONT_BUBBLE = 17;
const FONT_BTN = 18;
const FONT_META = 13;

const COLOR_SCAMMER = "#FFB020";
const COLOR_PLAYER = "#1B5FCC";
const COLOR_SAFE = "#52C41A";
const COLOR_DANGER = "#E5353B";
const COLOR_NEUTRAL = "#FFD666";

// ============ 场景类 ============

export class ManagerAIDialogScene extends Scene {
  private phase: DialogPhase = "select";
  private currentScenario: DialogScenario | null = null;
  private currentNodeId: string = "";
  private chatLog: ChatEntry[] = [];
  private score = 0;
  /** 打字机效果：当前骗子消息的显示进度（0..1） */
  private typewriterT = 0;
  /** 打字机速度（字符/秒） */
  private readonly typeSpeed = 30;
  /** 当前消息是否已完全显示 */
  private msgComplete = false;
  /** 按下状态 */
  private pressedBtn: string | null = null;
  /** 入场动画 */
  private phaseT = 0;
  /** 选中的剧本索引（select 阶段） */
  private selectedScenarioIdx = 0;

  enter(): void {
    super.enter();
    this.phase = "select";
    this.phaseT = 0;
    this.currentScenario = null;
    this.chatLog = [];
    this.score = 0;
    this.pressedBtn = null;
  }

  update(dt: number): void {
    super.update(dt);
    this.phaseT += dt;
    // 打字机效果
    if (this.phase === "chat" && !this.msgComplete) {
      const msg = this.getCurrentScammerMsg();
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
      case "chat":
        this.renderChat(ctx, screenW, screenH);
        break;
      case "result":
        this.renderResult(ctx, screenW, screenH);
        break;
    }
  }

  // ---- select：剧本选择 ----

  private renderSelect(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    const cx = sw / 2;

    // 标题
    ctx.font = `900 ${FONT_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.neon.DEFAULT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = Theme.colors.neon.DEFAULT;
    ctx.shadowBlur = 12;
    ctx.fillText("🎭 AI 对话演练", cx, sh * 0.10);
    ctx.shadowBlur = 0;

    ctx.font = `400 ${FONT_BODY}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.fillText("选择一个剧本，与 AI 骗子过招", cx, sh * 0.16);

    // 剧本卡片
    const cardW = sw * 0.85;
    const cardH = 110;
    const cardGap = 16;
    const startY = sh * 0.22;

    for (let i = 0; i < SCENARIOS.length; i++) {
      const s = SCENARIOS[i];
      const y = startY + i * (cardH + cardGap);
      const x = (sw - cardW) / 2;
      const isPressed = this.pressedBtn === `scenario_${i}`;

      drawPanel(ctx, x, y, cardW, cardH, {
        borderColor: s.color,
        borderWidth: 2,
        bgColor: withAlpha(s.color, 0.08),
      });

      // 顶部色条
      ctx.fillStyle = s.color;
      ctx.fillRect(x, y, cardW, 3);

      // emoji
      ctx.font = `900 40px ${Theme.fonts.display}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(s.emoji, x + 20, y + 50);

      // 标题
      ctx.font = `700 ${FONT_BTN + 4}px ${Theme.fonts.display}`;
      ctx.fillStyle = s.color;
      ctx.fillText(s.title, x + 76, y + 36);

      // 类型标签
      ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
      ctx.fillStyle = Theme.colors.ink.muted;
      ctx.fillText(s.fraudType, x + 76, y + 58);

      // 描述
      ctx.font = `400 ${FONT_META + 1}px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      const descLines = this.wrapText(ctx, s.desc, cardW - 100);
      descLines.slice(0, 2).forEach((line, j) => {
        ctx.fillText(line, x + 76, y + 80 + j * 16);
      });

      // 箭头
      ctx.font = `900 24px ${Theme.fonts.display}`;
      ctx.fillStyle = s.color;
      ctx.textAlign = "right";
      ctx.fillText("▶", x + cardW - 20, y + 50);

      if (isPressed) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, cardW, cardH);
      }
    }

    ctx.textAlign = "center";

    // 返回按钮
    const backW = 180;
    const backH = 48;
    const backX = cx - backW / 2;
    const backY = sh - 70;
    this.drawButton(ctx, backX, backY, backW, backH, "← 返回菜单", Theme.colors.ink.dim, "back");
  }

  // ---- chat：对话阶段 ----

  private renderChat(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    if (!this.currentScenario) return;
    const s = this.currentScenario;
    const cx = sw / 2;

    // 顶部信息栏
    ctx.fillStyle = withAlpha(s.color, 0.1);
    ctx.fillRect(0, 0, sw, 56);
    ctx.fillStyle = s.color;
    ctx.fillRect(0, 56, sw, 2);

    ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = s.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${s.emoji} ${s.title}`, 16, 28);

    ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
    ctx.fillStyle = Theme.colors.ink.muted;
    ctx.textAlign = "right";
    ctx.fillText(`机警值 ${this.score}`, sw - 16, 28);

    // 聊天区域
    const chatTop = 64;
    const chatBottom = this.getCurrentNode()?.isEnding ? sh - 100 : sh - 180;
    const chatH = chatBottom - chatTop;
    const bubbleMaxW = sw * 0.6;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // 渲染聊天记录
    let yPos = chatBottom - 16;
    for (let i = this.chatLog.length - 1; i >= 0; i--) {
      const entry = this.chatLog[i];
      const isScammer = entry.role === "scammer";
      const text = isScammer && i === this.chatLog.length - 1 && !this.msgComplete
        ? entry.text.slice(0, Math.floor(this.typewriterT))
        : entry.text;

      const lines = this.wrapText(ctx, text, bubbleMaxW - 32);
      const bubbleH = lines.length * 22 + 20;
      yPos -= bubbleH + 8;

      if (yPos < chatTop) break;

      const bubbleW = Math.min(bubbleMaxW, this.maxLineWidth(ctx, lines) + 32);
      const isRight = !isScammer;
      const bubbleX = isRight ? sw - 16 - bubbleW : 16;

      // 气泡背景
      const bubbleColor = isScammer ? withAlpha(COLOR_SCAMMER, 0.15) : withAlpha(COLOR_PLAYER, 0.15);
      const borderColor = isScammer ? COLOR_SCAMMER : COLOR_PLAYER;
      ctx.fillStyle = bubbleColor;
      this.roundRect(ctx, bubbleX, yPos, bubbleW, bubbleH, 10);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 气泡文字
      ctx.font = `400 ${FONT_BUBBLE}px ${Theme.fonts.body}`;
      ctx.fillStyle = Theme.colors.ink.DEFAULT;
      lines.forEach((line, j) => {
        ctx.fillText(line, bubbleX + 16, yPos + 10 + j * 22);
      });

      // 头像 emoji
      ctx.font = `900 20px ${Theme.fonts.display}`;
      ctx.textBaseline = "middle";
      const avatarX = isRight ? sw - 16 - bubbleW - 28 : 16 + bubbleW + 8;
      ctx.fillStyle = borderColor;
      ctx.fillText(isScammer ? s.emoji : "🛡️", avatarX, yPos + bubbleH / 2);
      ctx.textBaseline = "top";
    }

    // 打字指示器
    if (!this.msgComplete && this.chatLog.length > 0) {
      const last = this.chatLog[this.chatLog.length - 1];
      if (last.role === "scammer") {
        ctx.font = `400 ${FONT_META}px ${Theme.fonts.mono}`;
        ctx.fillStyle = Theme.colors.ink.dim;
        ctx.textAlign = "left";
        ctx.fillText("● ● ● 对方正在输入", 16, chatBottom + 4);
      }
    }

    ctx.textAlign = "center";

    // 选项或结局按钮
    const node = this.getCurrentNode();
    if (node?.isEnding) {
      // 结局：显示总结按钮
      const btnW = 240;
      const btnH = 52;
      this.drawButton(ctx, cx - btnW / 2, sh - 80, btnW, btnH, "查看演练总结 ▶", s.color, "to_result");
    } else if (node && this.msgComplete) {
      // 选项按钮
      const optW = sw * 0.88;
      const optH = 48;
      const optGap = 8;
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

  // ---- result：总结页 ----

  private renderResult(ctx: CanvasRenderingContext2D, sw: number, sh: number): void {
    if (!this.currentScenario) return;
    const s = this.currentScenario;
    const node = this.getCurrentNode();
    if (!node?.isEnding) return;
    const cx = sw / 2;

    const endingColor = node.endingType === "safe" ? COLOR_SAFE
      : node.endingType === "scammed" ? COLOR_DANGER
      : COLOR_NEUTRAL;
    const endingTitle = node.endingType === "safe" ? "🛡️ 识破骗局！"
      : node.endingType === "scammed" ? "💸 中招了！"
      : "⚠️ 对方警觉";

    ctx.font = `900 ${FONT_TITLE}px ${Theme.fonts.display}`;
    ctx.fillStyle = endingColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = endingColor;
    ctx.shadowBlur = 14;
    ctx.fillText(endingTitle, cx, sh * 0.14);
    ctx.shadowBlur = 0;

    // 机警值
    ctx.font = `700 ${FONT_BTN + 4}px ${Theme.fonts.display}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(`机警值 ${this.score >= 0 ? "+" : ""}${this.score}`, cx, sh * 0.22);

    // 解析卡片
    const cardY = sh * 0.28;
    const cardH = sh * 0.42;
    const cardX = sw * 0.06;
    const cardW = sw * 0.88;

    drawPanel(ctx, cardX, cardY, cardW, cardH, {
      borderColor: endingColor,
      borderWidth: 2,
      bgColor: withAlpha(endingColor, 0.06),
    });

    ctx.font = `700 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = endingColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("📋 演练总结：", cardX + 20, cardY + 16);

    ctx.font = `400 ${FONT_BODY}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    const descLines = this.wrapText(ctx, node.endingDesc ?? "", cardW - 40);
    descLines.forEach((line, i) => {
      ctx.fillText(line, cardX + 20, cardY + 52 + i * 26);
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 按钮
    const btnW = 200;
    const btnH = 52;
    const gap = 16;
    const retryX = cx - btnW - gap / 2;
    const backX = cx + gap / 2;
    const btnY = sh * 0.78;

    this.drawButton(ctx, retryX, btnY, btnW, btnH, "🔄 再练一次", s.color, "retry");
    this.drawButton(ctx, backX, btnY, btnW, btnH, "← 返回菜单", Theme.colors.ink.dim, "back");

    // 96110
    ctx.font = `400 ${FONT_META}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.dim;
    ctx.fillText("📞 遇到诈骗请拨打 96110", cx, sh * 0.90);
  }

  // ============ 辅助方法 ============

  private getCurrentNode(): DialogNode | null {
    if (!this.currentScenario) return null;
    return this.currentScenario.nodes[this.currentNodeId] ?? null;
  }

  private getCurrentScammerMsg(): string {
    const node = this.getCurrentNode();
    return node?.scammerMsg ?? "";
  }

  /** 开始一个剧本 */
  private startScenario(scenario: DialogScenario): void {
    this.currentScenario = scenario;
    this.currentNodeId = scenario.startNodeId;
    this.chatLog = [];
    this.score = 0;
    this.phase = "chat";
    this.phaseT = 0;
    this.typewriterT = 0;
    this.msgComplete = false;
    // 添加骗子第一条消息
    this.chatLog.push({ role: "scammer", text: scenario.nodes[scenario.startNodeId].scammerMsg });
  }

  /** 玩家选择选项 */
  private selectOption(opt: DialogOption): void {
    // 添加玩家消息
    this.chatLog.push({ role: "player", text: opt.text });
    this.score += opt.score;

    // 跳转到下一节点
    const nextNode = this.currentScenario!.nodes[opt.nextNodeId];
    if (!nextNode) return;
    this.currentNodeId = nextNode.id;

    if (nextNode.isEnding) {
      // 结局节点：直接显示骗子的最后话术
      this.chatLog.push({ role: "scammer", text: nextNode.scammerMsg });
      this.msgComplete = true;
    } else {
      // 添加骗子的新消息
      this.chatLog.push({ role: "scammer", text: nextNode.scammerMsg });
      this.typewriterT = 0;
      this.msgComplete = false;
    }
  }

  // ============ 触摸交互 ============

  handleTouch(type: "start" | "move" | "end", x: number, y: number, touchId: number): boolean {
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
        const cardW = sw * 0.85;
        const cardH = 110;
        const cardGap = 16;
        const startY = sh * 0.22;
        for (let i = 0; i < SCENARIOS.length; i++) {
          const cy = startY + i * (cardH + cardGap);
          const cxi = (sw - cardW) / 2;
          if (hitTest(x, y, { x: cxi, y: cy, w: cardW, h: cardH })) return `scenario_${i}`;
        }
        const backW = 180, backH = 48;
        const backX = cx - backW / 2, backY = sh - 70;
        if (hitTest(x, y, { x: backX, y: backY, w: backW, h: backH })) return "back";
        return null;
      }

      case "chat": {
        const node = this.getCurrentNode();
        if (!node) return null;
        if (node.isEnding) {
          const btnW = 240, btnH = 52;
          if (hitTest(x, y, { x: cx - btnW / 2, y: sh - 80, w: btnW, h: btnH })) return "to_result";
          return null;
        }
        if (!this.msgComplete) return null; // 消息未显示完，不响应
        const optW = sw * 0.88;
        const optH = 48;
        const optGap = 8;
        const startY = sh - node.options!.length * (optH + optGap) - 12;
        for (let i = 0; i < node.options!.length; i++) {
          const oy = startY + i * (optH + optGap);
          const ox = (sw - optW) / 2;
          if (hitTest(x, y, { x: ox, y: oy, w: optW, h: optH })) return `opt_${i}`;
        }
        return null;
      }

      case "result": {
        const btnW = 200, btnH = 52, gap = 16;
        const retryX = cx - btnW - gap / 2, backX = cx + gap / 2, btnY = sh * 0.78;
        if (hitTest(x, y, { x: retryX, y: btnY, w: btnW, h: btnH })) return "retry";
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

    if (btn === "retry") {
      this.phase = "select";
      this.phaseT = 0;
      this.currentScenario = null;
      this.chatLog = [];
      this.score = 0;
      return;
    }

    if (this.phase === "select" && btn.startsWith("scenario_")) {
      const idx = parseInt(btn.split("_")[1]);
      if (!isNaN(idx) && idx >= 0 && idx < SCENARIOS.length) {
        this.startScenario(SCENARIOS[idx]);
      }
      return;
    }

    if (this.phase === "chat") {
      if (btn === "to_result") {
        this.phase = "result";
        this.phaseT = 0;
        return;
      }
      if (btn.startsWith("opt_")) {
        const idx = parseInt(btn.split("_")[1]);
        const node = this.getCurrentNode();
        if (node && node.options && idx >= 0 && idx < node.options.length) {
          this.selectOption(node.options[idx]);
          if (this.getCurrentNode()?.isEnding) {
            playSfx("good");
          }
        }
        return;
      }
    }
  }

  // ============ 绘制工具 ============

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
    // 选项序号
    ctx.font = `900 ${FONT_BTN}px ${Theme.fonts.display}`;
    ctx.fillStyle = COLOR_PLAYER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String.fromCharCode(65 + idx), x + 14, y + offsetY + h / 2);
    // 选项文字
    ctx.font = `400 ${FONT_BUBBLE}px ${Theme.fonts.body}`;
    ctx.fillStyle = Theme.colors.ink.DEFAULT;
    ctx.fillText(text, x + 36, y + offsetY + h / 2);
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
