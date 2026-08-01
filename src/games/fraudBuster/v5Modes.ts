/**
 * 「是男人就反诈」v5 升级：三种新模式的核心逻辑
 * - AI 对战（aiBattle）：与 AI 骗子多轮对话识破
 * - 双人对战（versus）：同设备双人轮流答题
 * - 骗局拆解（deconstruct）：观看骗子剧本逐句拆解
 *
 * 本模块为独立 Runner，由 engine.ts 在对应模式下委托调用，
 * 不修改 engine 既有逻辑，实现"模块化扩展"。
 */
import type {
  FBAIDialogScenario, FBAIDialogNode, FBAIDialogTurn, FBAIDialogChoice,
  FBHudAIDialogState, FBHudDeconstructState, FBHudVSState, FBVSPlayerState,
  FBDeconstructScenario, FBDeconstructLine, FBDeconstructSummary,
  FBQuestion, FBStats, FBWeaknessReport, FBGameMode,
} from "./types";
import { DECONSTRUCT_SCENARIOS, VERSUS_CONFIG, AI_BATTLE_CONFIG } from "./dataV2";
import { QUESTION_BANK } from "./data";

// ============ AI 对战剧本数据 ============

/** 5 个 AI 对战剧本，覆盖高发诈骗类型 */
export const AI_DIALOG_SCENARIOS: FBAIDialogScenario[] = [
  {
    id: "AI-001", typeId: "F02", type: "杀猪盘",
    title: "网友带你投资：AI 骗子多轮对话",
    difficulty: 2,
    scenario: "交友软件认识的优质异性，暧昧后带你投资，你需要通过对话识破骗局。",
    persona: "温柔体贴的理财达人，擅长情感拉拢+利益诱惑",
    maxTurns: 10, startNodeId: "n1", passThreshold: 3,
    nodes: [
      {
        id: "n1", redFlag: 1, tactic: "建立人设", psychology: ["intimacy", "curiosity"],
        scammerLines: [
          "你好呀~看你朋友圈喜欢旅行，我也刚从日本回来呢",
          " hi~ 你的头像好阳光，平时喜欢健身吗？",
        ],
        choices: [
          { text: "聊聊旅行/健身", nextNodeId: "n2", verdict: "warn", feedback: "骗子精心打造人设，通过日常话题建立亲近感。" },
          { text: "你是做什么工作的？", nextNodeId: "n2", verdict: "right", feedback: "了解对方背景是好习惯，但骗子会有标准答案。" },
          { text: "直接问能不能带赚钱", nextNodeId: "n3", bust: true, bustScore: 1, verdict: "right", feedback: "敏锐！直接试探对方是否要谈钱。" },
        ],
      },
      {
        id: "n2", redFlag: 2, tactic: "身份铺垫", psychology: ["trust", "authority"],
        scammerLines: [
          "我在金融公司做数据分析，舅舅在监管单位，有些内部消息",
          "我平时做量化投资，收益还不错，可以带你一起",
        ],
        choices: [
          { text: "量化投资？收益多少？", nextNodeId: "n3", verdict: "warn", feedback: "对方开始铺垫投资背景，警惕利益诱惑。" },
          { text: "内部消息？这合法吗？", nextNodeId: "n3", bust: true, bustScore: 1, verdict: "right", feedback: "识破'内部消息'话术！任何内部消息都是诈骗信号。" },
          { text: "不太感兴趣，聊别的吧", nextNodeId: "n4", verdict: "right", feedback: "拒绝利益诱惑是好的，但骗子会换个角度继续。" },
        ],
      },
      {
        id: "n3", redFlag: 4, tactic: "利益诱惑+稀缺性", psychology: ["greed", "scarcity"],
        scammerLines: [
          "稳赚不赔的，月化 20%，但只能内部人参与，千万保密",
          "我舅舅发现的系统漏洞，名额有限，带你一个",
        ],
        choices: [
          { text: "稳赚不赔？投入多少？", nextNodeId: "n5", verdict: "warn", feedback: "'稳赚不赔'是诈骗核心话术！任何投资都不保本。" },
          { text: "保密参与？这是诈骗！", nextNodeId: "n6", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！'保密参与'+'稳赚不赔'=100%诈骗。" },
          { text: "我先小额试水看看", nextNodeId: "n5", verdict: "wrong", feedback: "小额试水是诱饵，骗子会让你尝到甜头后加大投入。" },
        ],
      },
      {
        id: "n4", redFlag: 3, tactic: "情感拉拢", psychology: ["intimacy", "greed"],
        scammerLines: [
          "你不一样，我想认真和你发展，带你赚钱是想给你未来",
          "我都把你当自己人了，别人想跟我学我都不教",
        ],
        choices: [
          { text: "谢谢你的好意，但我自己理财", nextNodeId: "n6", bust: true, bustScore: 1, verdict: "right", feedback: "坚定拒绝是对的！情感+利益是杀猪盘标配。" },
          { text: "那我就信你一次", nextNodeId: "n5", verdict: "wrong", feedback: "情感拉拢成功！一旦投入就难以止损。" },
        ],
      },
      {
        id: "n5", redFlag: 5, tactic: "连环收割", psychology: ["sunkCost", "greed"],
        scammerLines: [
          "提现需要缴 8% 个人所得税和 5000 反洗钱认证金",
          "你的账户被风控了，需要再入金 1 万解冻",
        ],
        choices: [
          { text: "立即停止，报警止损", nextNodeId: "n6", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！'提现缴税'=100%诈骗，立即止损报警。" },
          { text: "再缴一次就能提了", nextNodeId: "n6", verdict: "wrong", feedback: "致命错误！'再缴一次就能提'是连环套，越缴越多。" },
        ],
      },
      {
        id: "n6", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对话结束）"],
        choices: [
          { text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" },
        ],
      },
    ],
  },
  {
    id: "AI-002", typeId: "F01", type: "冒充公检法",
    title: "刑侦支队来电：AI 警官多轮对话",
    difficulty: 3,
    scenario: "自称市局刑侦支队的警官来电，称你涉嫌洗钱，需要配合调查。",
    persona: "严厉专业的警官，擅长权威压迫+恐惧施压",
    maxTurns: 10, startNodeId: "n1", passThreshold: 3,
    nodes: [
      {
        id: "n1", redFlag: 2, tactic: "权威假冒", psychology: ["authority", "fear"],
        scammerLines: [
          "我是市局刑侦支队民警，你名下银行卡涉嫌洗钱 200 万，现对你立案侦查",
          "这里是省检察院，你的身份证在外地办卡涉嫌洗钱案",
        ],
        choices: [
          { text: "我不认识，肯定是误会", nextNodeId: "n2", verdict: "warn", feedback: "骗子会用'案件保密'堵住你的辩解。" },
          { text: "公检法不电话办案，挂了", nextNodeId: "n4", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！公检法不电话办案，更无'安全账户'。" },
          { text: "我配合调查，怎么做？", nextNodeId: "n3", verdict: "wrong", feedback: "一旦配合，骗子会引导你转账到'安全账户'。" },
        ],
      },
      {
        id: "n2", redFlag: 3, tactic: "案件保密", psychology: ["fear", "authority"],
        scammerLines: [
          "案件保密，不得告诉任何人，包括家人",
          "如果你告诉别人，将以妨碍公务追究责任",
        ],
        choices: [
          { text: "保密？这不对劲", nextNodeId: "n4", bust: true, bustScore: 1, verdict: "right", feedback: "识破红旗！'案件保密'是阻止你寻求帮助的话术。" },
          { text: "好的，我保密配合", nextNodeId: "n3", verdict: "wrong", feedback: "保密要求切断了你核实真伪的渠道。" },
        ],
      },
      {
        id: "n3", redFlag: 5, tactic: "安全账户转账", psychology: ["fear", "urgency"],
        scammerLines: [
          "请将资金转入安全账户清查，否则将拘捕你",
          "下载检务通 APP 进行资金清查，案件保密",
        ],
        choices: [
          { text: "立即转账配合清查", nextNodeId: "n4", verdict: "wrong", feedback: "致命错误！'安全账户'不存在，转账即失。" },
          { text: "挂断，拨打 96110 核实", nextNodeId: "n4", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！'安全账户'=100%诈骗，挂断拨打 96110。" },
        ],
      },
      {
        id: "n4", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对话结束）"],
        choices: [
          { text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" },
        ],
      },
    ],
  },
  {
    id: "AI-003", typeId: "F03", type: "刷单返利",
    title: "轻松兼职日入 800：AI 客服多轮对话",
    difficulty: 2,
    scenario: "群里看到的兼职广告，点赞关注已返佣，客服要求垫付做连单。",
    persona: "热情专业的兼职客服，擅长小额返利+逐步加码",
    maxTurns: 10, startNodeId: "n1", passThreshold: 3,
    nodes: [
      {
        id: "n1", redFlag: 2, tactic: "小额返利", psychology: ["greed", "conformity"],
        scammerLines: [
          "点赞关注已返佣 5-10 元，想做连单任务返 650 吗？",
          "前几单都到账了吧？连单任务收益更高哦",
        ],
        choices: [
          { text: "连单任务怎么做？", nextNodeId: "n2", verdict: "warn", feedback: "'连单任务'是刷单诈骗核心话术。" },
          { text: "刷单本身就是违法的", nextNodeId: "n3", bust: true, bustScore: 1, verdict: "right", feedback: "识破红旗！刷单本身违法，返佣只是诱饵。" },
          { text: "已经返佣了，试试", nextNodeId: "n2", verdict: "wrong", feedback: "小额返佣是诱饵，下一步必然要求垫付。" },
        ],
      },
      {
        id: "n2", redFlag: 4, tactic: "垫付连单", psychology: ["greed", "sunkCost"],
        scammerLines: [
          "垫付 500 做连单，返 650，到账后立结",
          "这个任务需要垫付 3000，返 3900，名额有限",
        ],
        choices: [
          { text: "垫付 500 试试", nextNodeId: "n3", verdict: "wrong", feedback: "垫付后必然'卡单'，要求继续转账解冻。" },
          { text: "不垫付，退群", nextNodeId: "n3", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！'垫付连单'=诈骗，及时止损。" },
        ],
      },
      {
        id: "n3", redFlag: 5, tactic: "卡单解冻", psychology: ["sunkCost", "urgency"],
        scammerLines: [
          "你操作失误导致卡单，需再垫付 8000 解冻保证金",
          "不解冻的话前期投入的 5000 无法退回",
        ],
        choices: [
          { text: "继续转账解冻", nextNodeId: "n4", verdict: "wrong", feedback: "致命错误！'卡单解冻'是标准话术，越垫越深。" },
          { text: "停止转账，立即报警", nextNodeId: "n4", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！'卡单解冻'=诈骗，立即止损报警。" },
        ],
      },
      {
        id: "n4", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对话结束）"],
        choices: [
          { text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" },
        ],
      },
    ],
  },
  {
    id: "AI-004", typeId: "F45", type: "AI换脸冒充领导",
    title: "领导视频急令代转账：AI 换脸多轮对话",
    difficulty: 4,
    scenario: "假冒领导微信加你，紧急会议后通过 AI 视频通话要求代转账。",
    persona: "威严急迫的公司领导，擅长权威压迫+紧迫催促",
    maxTurns: 8, startNodeId: "n1", passThreshold: 2,
    nodes: [
      {
        id: "n1", redFlag: 2, tactic: "假冒身份", psychology: ["authority", "urgency"],
        scammerLines: [
          "小王，我是张总，新号加一下，等下开个视频会议",
          "我在开会不方便接电话，加你微信说个事",
        ],
        choices: [
          { text: "张总好，什么事？", nextNodeId: "n2", verdict: "warn", feedback: "'换号+不方便接电话'是冒充领导标配。" },
          { text: "我回拨您原号码确认", nextNodeId: "n3", bust: true, bustScore: 2, verdict: "right", feedback: "识破红旗！回拨原号码是核实身份的铁律。" },
        ],
      },
      {
        id: "n2", redFlag: 4, tactic: "AI视频伪装", psychology: ["authority", "urgency"],
        scammerLines: [
          "（视频通话）小王，我需要你帮忙代转一笔款给客户，半小时内必须到账",
          "（视频通话）会议中不方便操作，你先垫付 5 万，回公司报销",
        ],
        choices: [
          { text: "好的张总，马上转", nextNodeId: "n3", verdict: "wrong", feedback: "AI 换脸可伪造视频，转账前必须二次核实。" },
          { text: "视频里是您，但我需要电话确认", nextNodeId: "n3", bust: true, bustScore: 1, verdict: "right", feedback: "识破红旗！视频不是身份证明，需电话核实。" },
        ],
      },
      {
        id: "n3", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对话结束）"],
        choices: [
          { text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" },
        ],
      },
    ],
  },
  {
    id: "AI-005", typeId: "F110", type: "AI客服退款升级版",
    title: "商品甲醛超标退款：AI 客服多轮对话",
    difficulty: 3,
    scenario: "自称淘宝客服来电，称你购买的商品甲醛超标，需办理退款理赔。",
    persona: "专业礼貌的客服人员，擅长权威建立+共享屏幕盗刷",
    maxTurns: 10, startNodeId: "n1", passThreshold: 3,
    nodes: [
      {
        id: "n1", redFlag: 2, tactic: "订单泄露+权威建立", psychology: ["authority", "trust"],
        scammerLines: [
          "您好，我是淘宝客服，您购买的婴儿服装甲醛超标，为您办理退款理赔",
          "您的订单号是 XXX，购买时间是 X 月 X 日，金额 299 元",
        ],
        choices: [
          { text: "订单信息对，怎么理赔？", nextNodeId: "n2", verdict: "warn", feedback: "订单泄露是诈骗引子，警惕后续操作。" },
          { text: "我登录淘宝 APP 核实", nextNodeId: "n3", bust: true, bustScore: 1, verdict: "right", feedback: "识破红旗！退款只在官方 APP 完成。" },
        ],
      },
      {
        id: "n2", redFlag: 4, tactic: "共享屏幕指导", psychology: ["authority", "urgency"],
        scammerLines: [
          "理赔需要指导您操作，请下载会议软件共享屏幕",
          "我帮您开通理赔通道，请按提示共享屏幕",
        ],
        choices: [
          { text: "下载会议软件共享屏幕", nextNodeId: "n3", verdict: "wrong", feedback: "共享屏幕=交出账户控制权，密码验证码全泄露。" },
          { text: "退款不需要共享屏幕", nextNodeId: "n3", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！'共享屏幕'=100%诈骗。" },
        ],
      },
      {
        id: "n3", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对话结束）"],
        choices: [
          { text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" },
        ],
      },
    ],
  },
  // ===== v6 升级新增剧本（2026 Q3-Q4 新型诈骗） =====
  {
    id: "AI-006", typeId: "F116", type: "AI实时换脸视频通话",
    title: "老板视频急令：AI换脸冒充CEO对话",
    difficulty: 4,
    scenario: "视频会议中'老板'紧急要求2分钟内转账10万，画面声音都像，但需识破换脸诈骗。",
    persona: "严厉急躁的CEO，擅长权威压迫+紧急催促",
    maxTurns: 8, startNodeId: "n1", passThreshold: 3,
    nodes: [
      {
        id: "n1", redFlag: 2, tactic: "视频+紧急催促", psychology: ["urgency", "authority"],
        scammerLines: [
          "小王，开视频会议，客户合同要立即付款10万，2分钟内到账，超时丢单你负责！",
          "立即开视频！我口头批准，财务总监那边我打过招呼了，直接转账！",
        ],
        choices: [
          { text: "立即转账避免丢单", nextNodeId: "n3", verdict: "wrong", feedback: "致命错误！视频面容可伪造，紧急转账必须独立核实。" },
          { text: "要求走公司流程审批", nextNodeId: "n2", verdict: "warn", feedback: "坚持流程是对的，但骗子会继续施压。" },
          { text: "要求对方用公司座机回拨核实", nextNodeId: "n4", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！换脸无法接管公司座机，独立核实是关键。" },
        ],
      },
      {
        id: "n2", redFlag: 4, tactic: "绕过流程+威胁", psychology: ["authority", "fear"],
        scammerLines: [
          "别走流程了！客户急着签约，我口头批准就行，账号私发你微信。",
          "你是不信任我吗？我是老板！再拖延就开除你！",
        ],
        choices: [
          { text: "服从命令立即转账", nextNodeId: "n3", verdict: "wrong", feedback: "致命错误！绕过流程+威胁开除=100%诈骗。真领导会理解核实需求。" },
          { text: "坚持要邮件审批或公司座机核实", nextNodeId: "n4", bust: true, bustScore: 2, verdict: "right", feedback: "识破！任何拒绝独立核实渠道的'领导'都是骗子。" },
          { text: "让财务加对方微信核实", nextNodeId: "n3", verdict: "wrong", feedback: "微信不是独立渠道，骗子可冒充。必须公司座机核实。" },
        ],
      },
      {
        id: "n3", redFlag: 5, tactic: "连环收割", psychology: ["fear", "sunkCost"],
        scammerLines: [
          "转账后系统检测到账户异常，需再转5万验证，否则10万被冻结。",
          "再转一次就能解冻，全部退回，相信我！",
        ],
        choices: [
          { text: "再转5万解冻", nextNodeId: "n5", verdict: "wrong", feedback: "致命错误！'再缴一次解冻'是连环套，越缴越多。" },
          { text: "立即停止，报警止损", nextNodeId: "n4", bust: true, bustScore: 1, verdict: "right", feedback: "正确！发现被骗立即报警止损。" },
        ],
      },
      {
        id: "n4", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对方拒绝用公司座机回拨，挂断）"],
        choices: [
          { text: "结束对话，用通讯录原号码联系真老板", nextNodeId: null, bust: true, bustScore: 1, verdict: "right", feedback: "识破换脸诈骗！视频面容再真实，也必须用通讯录原号码回拨核实。" },
        ],
      },
      {
        id: "n5", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对话结束）"],
        choices: [
          { text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" },
        ],
      },
    ],
  },
  {
    id: "AI-007", typeId: "F117", type: "数字人民币钱包权限委托诈骗",
    title: "数字钱包风控升级：权限委托对话",
    difficulty: 3,
    scenario: "自称'数字人民币客服'称钱包异常需升级，诱导开通权限委托远程控制钱包。",
    persona: "专业冷静的央行客服，擅长权威冒充+风控恐吓",
    maxTurns: 8, startNodeId: "n1", passThreshold: 3,
    nodes: [
      {
        id: "n1", redFlag: 2, tactic: "权威冒充+风控恐吓", psychology: ["authority", "fear", "urgency"],
        scammerLines: [
          "您好，这里是数字人民币官方客服。检测到您的钱包异常登录，需立即升级风控，否则钱包将被冻结。",
          "您的钱包存在风险，请配合升级，否则永久冻结资金无法取出。",
        ],
        choices: [
          { text: "立即配合升级", nextNodeId: "n2", verdict: "warn", feedback: "警惕！任何主动来电称'钱包风控升级'的都是诈骗，数字人民币官方不会主动电话索要操作。" },
          { text: "挂断到银行网点核实", nextNodeId: "n4", bust: true, bustScore: 2, verdict: "right", feedback: "识破！钱包问题只能到银行网点或官方APP处理。" },
          { text: "询问具体升级流程", nextNodeId: "n2", verdict: "warn", feedback: "了解流程是对的，但骗子会有标准话术应对。" },
        ],
      },
      {
        id: "n2", redFlag: 5, tactic: "权限委托+测试金", psychology: ["authority", "trust", "greed"],
        scammerLines: [
          "请下载DCEP-Safe APP，开通'权限委托'让我们代为操作钱包，验证200元测试金，升级后原路退回。",
          "权限委托是央行新规，让授权客服临时操作您的钱包，这是标准流程。",
        ],
        choices: [
          { text: "下载APP并开通权限委托", nextNodeId: "n3", verdict: "wrong", feedback: "致命错误！'权限委托'不存在，开通=交出钱包控制权。" },
          { text: "质问'央行新规'具体文号", nextNodeId: "n5", bust: true, bustScore: 2, verdict: "right", feedback: "识破！央行新规会通过官方公告，不会电话索要操作。任何'代为操作钱包'都100%是诈骗。" },
          { text: "要求到银行网点办理", nextNodeId: "n4", bust: true, bustScore: 1, verdict: "right", feedback: "正确！钱包问题只能到银行网点或官方APP处理。" },
        ],
      },
      {
        id: "n3", redFlag: 5, tactic: "安全账户连环收割", psychology: ["fear", "sunkCost"],
        scammerLines: [
          "升级完成。系统检测到您钱包余额5000元，需转至'安全账户'托管24小时验证。",
          "不转安全账户将永久冻结，您的5000元全部损失！",
        ],
        choices: [
          { text: "转至安全账户托管", nextNodeId: "n5", verdict: "wrong", feedback: "致命错误！'安全账户'不存在，央行无此概念。已开通权限委托后骗子可绕过受害者转款。" },
          { text: "立即停止，报警止损", nextNodeId: "n4", bust: true, bustScore: 1, verdict: "right", feedback: "正确！发现被骗立即报警，请求冻结钱包。" },
        ],
      },
      {
        id: "n4", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对方挂断）"],
        choices: [
          { text: "结束对话，到银行网点核实", nextNodeId: null, bust: true, bustScore: 1, verdict: "right", feedback: "识破！数字人民币无'权限委托'功能，任何代为操作都是诈骗。" },
        ],
      },
      {
        id: "n5", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对话结束）"],
        choices: [
          { text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" },
        ],
      },
    ],
  },
  {
    id: "AI-008", typeId: "F118", type: "加密货币杀猪盘",
    title: "USDT量化稳赚：群友带飞对话",
    difficulty: 3,
    scenario: "币圈群友推荐'表哥做量化月化30%'，下载自建APP入金后提现被连环收费。",
    persona: "热心的币圈群友，擅长利益诱惑+从众压力",
    maxTurns: 10, startNodeId: "n1", passThreshold: 3,
    nodes: [
      {
        id: "n1", redFlag: 2, tactic: "群友推荐+收益诱惑", psychology: ["greed", "trust", "conformity"],
        scammerLines: [
          "哥，最近币圈行情不错，我表哥做量化每月30%收益，带我们几个一起赚。",
          "群里的兄弟都跟了，晒单了，你看这收益截图，稳赚不赔！",
        ],
        choices: [
          { text: "询问怎么操作", nextNodeId: "n2", verdict: "warn", feedback: "警惕！'每月30%收益'是诈骗核心话术，币圈无保本收益。" },
          { text: "质问'稳赚不赔'真实性", nextNodeId: "n5", bust: true, bustScore: 1, verdict: "right", feedback: "识破！任何投资都不保本，'稳赚不赔'是诈骗信号。" },
          { text: "直接拒绝", nextNodeId: "n4", bust: true, bustScore: 1, verdict: "right", feedback: "正确！拒绝高收益诱惑是好的，但骗子会换角度继续。" },
        ],
      },
      {
        id: "n2", redFlag: 5, tactic: "自建APP+稳赚不赔", psychology: ["greed", "trust"],
        scammerLines: [
          "下载QuantX这个APP注册就行，先入1000U试水，稳赚不赔。我发你下载链接。",
          "QuantX是内部通道，主流交易所没有这功能，名额有限！",
        ],
        choices: [
          { text: "下载APP并转入1000U", nextNodeId: "n3", verdict: "wrong", feedback: "致命错误！自建APP+私人链接=100%诈骗。主流交易所只通过官方应用商店下载。" },
          { text: "质问为何不用币安/欧易等主流交易所", nextNodeId: "n5", bust: true, bustScore: 2, verdict: "right", feedback: "识破！任何拒绝主流交易所的'内部通道'都是诈骗。" },
          { text: "要求看监管牌照", nextNodeId: "n5", bust: true, bustScore: 1, verdict: "right", feedback: "正确！正规交易所有监管牌照，自建APP无法提供。" },
        ],
      },
      {
        id: "n3", redFlag: 5, tactic: "提现缴税连环收割", psychology: ["sunkCost", "greed"],
        scammerLines: [
          "恭喜！账户显示盈利300U。但提现需缴20%通道税（260U）和5000U反洗钱认证金。",
          "再缴一次就能提全部，相信我！前面都缴了，不缴一分钱拿不回。",
        ],
        choices: [
          { text: "缴通道税和认证金", nextNodeId: "n5", verdict: "wrong", feedback: "致命错误！'提现缴税'不存在，加密货币提现无需缴税。'再缴一次'是连环套。" },
          { text: "立即卸载APP报警举报", nextNodeId: "n4", bust: true, bustScore: 2, verdict: "right", feedback: "识破致命红旗！'提现缴税'=100%诈骗，立即止损报警。" },
          { text: "要求先提本金再说", nextNodeId: "n5", verdict: "wrong", feedback: "骗子已控制APP，'提本金'同样触发连环收费。" },
        ],
      },
      {
        id: "n4", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对方挂断）"],
        choices: [
          { text: "结束对话，到国家反诈中心APP举报", nextNodeId: null, bust: true, bustScore: 1, verdict: "right", feedback: "识破！加密货币杀猪盘资金难以追回，预防胜于维权。" },
        ],
      },
      {
        id: "n5", redFlag: 0, tactic: "结局节点", psychology: [],
        scammerLines: ["（对话结束）"],
        choices: [
          { text: "结束对话", nextNodeId: null, verdict: "right", feedback: "对话已结束。" },
        ],
      },
    ],
  },
];

/** 根据 ID 查询 AI 对战剧本 */
export function getAIDialogScenario(id: string): FBAIDialogScenario | undefined {
  return AI_DIALOG_SCENARIOS.find((s) => s.id === id);
}

/** 随机选取一个 AI 对战剧本 */
export function pickAIDialogScenario(): FBAIDialogScenario {
  return AI_DIALOG_SCENARIOS[Math.floor(Math.random() * AI_DIALOG_SCENARIOS.length)];
}

// ============ AI 对战模式 Runner ============

export class AIBattleRunner {
  private scenario: FBAIDialogScenario;
  private currentNode: FBAIDialogNode;
  private turns: FBAIDialogTurn[] = [];
  private bustScore = 0;
  private turnCount = 0;
  private ended = false;
  private ending: "busted" | "scammed" | "timeout" | null = null;
  private endingDesc = "";
  private currentScammerLine = "";
  private startTime = 0;

  constructor(scenario?: FBAIDialogScenario) {
    this.scenario = scenario ?? pickAIDialogScenario();
    this.currentNode = this.scenario.nodes.find((n) => n.id === this.scenario.startNodeId) ?? this.scenario.nodes[0];
    this.currentScammerLine = this.pickScammerLine();
    this.startTime = Date.now();
  }

  private pickScammerLine(): string {
    const lines = this.currentNode.scammerLines;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  /** 处理玩家选择 */
  choose(choiceIdx: number): { feedback: string; verdict: string; bust: boolean } {
    if (this.ended) return { feedback: "", verdict: "", bust: false };
    const choice = this.currentNode.choices[choiceIdx];
    if (!choice) return { feedback: "", verdict: "", bust: false };

    // 记录对话
    this.turns.push({ from: "scammer", text: this.currentScammerLine, tactic: this.currentNode.tactic, psychology: this.currentNode.psychology, atTs: (Date.now() - this.startTime) / 1000 });
    this.turns.push({ from: "player", text: choice.text, atTs: (Date.now() - this.startTime) / 1000 });
    this.turnCount++;

    // 累加识破分数
    if (choice.bust && choice.bustScore) {
      this.bustScore += choice.bustScore;
    }

    // 判断结局
    if (choice.nextNodeId === null || choice.nextNodeId === undefined) {
      this.end(choice);
    } else {
      const next = this.scenario.nodes.find((n) => n.id === choice.nextNodeId);
      if (next) {
        this.currentNode = next;
        this.currentScammerLine = this.pickScammerLine();
      } else {
        this.end(choice);
      }
    }

    // 超过最大轮次
    if (this.turnCount >= this.scenario.maxTurns && !this.ended) {
      this.ending = "timeout";
      this.endingDesc = "对话超时，未能在限定轮次内识破骗局。";
      this.ended = true;
    }

    return {
      feedback: choice.feedback ?? "",
      verdict: choice.verdict ?? "right",
      bust: !!choice.bust,
    };
  }

  private end(choice: FBAIDialogChoice) {
    this.ended = true;
    if (this.bustScore >= this.scenario.passThreshold) {
      this.ending = "busted";
      this.endingDesc = `识破骗局！累计识破 ${this.bustScore} 个关键红旗，成功识破${this.scenario.type}诈骗。`;
    } else if (choice.verdict === "wrong") {
      this.ending = "scammed";
      this.endingDesc = `未能识破骗局，被骗子的${this.scenario.persona}话术操控。`;
    } else {
      this.ending = "busted";
      this.endingDesc = `对话结束，累计识破 ${this.bustScore} 个关键红旗。`;
    }
  }

  isOver(): boolean { return this.ended; }
  getScenario() { return this.scenario; }
  getBustScore() { return this.bustScore; }
  getTurnCount() { return this.turnCount; }
  getEnding() { return this.ending; }
  getEndingDesc() { return this.endingDesc; }
  getCurrentNode() { return this.currentNode; }
  getCurrentScammerLine() { return this.currentScammerLine; }
  getTurns() { return this.turns; }

  getHud(): FBHudAIDialogState {
    return {
      scenarioId: this.scenario.id,
      scenarioTitle: this.scenario.title,
      currentNodeId: this.currentNode.id,
      turns: this.turns,
      currentScammerLine: this.currentScammerLine,
      currentRedFlag: this.currentNode.redFlag,
      currentTactic: this.currentNode.tactic ?? "",
      bustScore: this.bustScore,
      passThreshold: this.scenario.passThreshold,
      turnCount: this.turnCount,
      maxTurns: this.scenario.maxTurns,
      ended: this.ended,
      ending: this.ending ?? undefined,
      endingDesc: this.endingDesc,
      currentChoices: this.currentNode.choices,
    };
  }

  getStats(): Partial<FBStats> {
    return {
      aiBattleBustScore: this.bustScore,
      aiBattleTurns: this.turnCount,
      aiBattleEnding: this.ending ?? undefined,
      correctCount: this.bustScore >= this.scenario.passThreshold ? 1 : 0,
      wrongCount: this.bustScore < this.scenario.passThreshold ? 1 : 0,
      totalAnswered: 1,
    };
  }
}

// ============ 骗局拆解模式 Runner ============

export class DeconstructRunner {
  private scenario: FBDeconstructScenario;
  private currentLineIdx = 0;
  private revealedLines: FBDeconstructLine[] = [];
  private deconstructRevealed = false;
  private summaryShown = false;
  private totalRedFlags = 0;
  private ended = false;

  constructor(scenarioId?: string) {
    this.scenario = scenarioId
      ? DECONSTRUCT_SCENARIOS.find((s) => s.id === scenarioId) ?? DECONSTRUCT_SCENARIOS[0]
      : DECONSTRUCT_SCENARIOS[Math.floor(Math.random() * DECONSTRUCT_SCENARIOS.length)];
    this.revealedLines = [this.scenario.script[0]];
    if (this.scenario.script[0].redFlag && this.scenario.script[0].redFlag >= 5) {
      this.totalRedFlags++;
    }
  }

  /** 推进到下一行或显示拆解 */
  advance(): { action: "showLine" | "showDeconstruct" | "showSummary" | "ended" } {
    if (this.ended) return { action: "ended" };

    // 先显示拆解
    if (!this.deconstructRevealed && this.scenario.script[this.currentLineIdx].deconstruct) {
      this.deconstructRevealed = true;
      return { action: "showDeconstruct" };
    }

    // 推进到下一行
    if (this.currentLineIdx < this.scenario.script.length - 1) {
      this.currentLineIdx++;
      this.revealedLines.push(this.scenario.script[this.currentLineIdx]);
      this.deconstructRevealed = false;
      if (this.scenario.script[this.currentLineIdx].redFlag && this.scenario.script[this.currentLineIdx].redFlag! >= 5) {
        this.totalRedFlags++;
      }
      return { action: "showLine" };
    }

    // 显示总结
    if (!this.summaryShown) {
      this.summaryShown = true;
      return { action: "showSummary" };
    }

    // 结束
    this.ended = true;
    return { action: "ended" };
  }

  /** 跳过到结尾 */
  skipToEnd() {
    while (this.currentLineIdx < this.scenario.script.length - 1) {
      this.currentLineIdx++;
      this.revealedLines.push(this.scenario.script[this.currentLineIdx]);
      if (this.scenario.script[this.currentLineIdx].redFlag && this.scenario.script[this.currentLineIdx].redFlag! >= 5) {
        this.totalRedFlags++;
      }
    }
    this.deconstructRevealed = true;
    this.summaryShown = true;
    this.ended = true;
  }

  isOver(): boolean { return this.ended; }
  getScenario() { return this.scenario; }
  getCurrentLineIdx() { return this.currentLineIdx; }
  getTotalLines() { return this.scenario.script.length; }
  getCurrentLine() { return this.scenario.script[this.currentLineIdx]; }
  getRevealedLines() { return this.revealedLines; }
  getTotalRedFlags() { return this.totalRedFlags; }
  getSummary() { return this.scenario.summary; }

  getHud(): FBHudDeconstructState {
    return {
      scenarioId: this.scenario.id,
      currentLineIdx: this.currentLineIdx,
      totalLines: this.scenario.script.length,
      currentLine: this.scenario.script[this.currentLineIdx],
      revealedLines: this.revealedLines,
      deconstructRevealed: this.deconstructRevealed,
      summaryShown: this.summaryShown,
      summary: this.summaryShown ? this.scenario.summary : null,
      totalRedFlags: this.totalRedFlags,
    };
  }

  getStats(): Partial<FBStats> {
    return {
      deconstructCompleted: this.ended ? 1 : 0,
      deconstructRedFlags: this.totalRedFlags,
      totalAnswered: 1,
      correctCount: 1,
    };
  }
}

// ============ 双人对战模式 Runner ============

export class VersusRunner {
  private p1: FBVSPlayerState;
  private p2: FBVSPlayerState;
  private currentTurn: "P1" | "P2" = "P1";
  private questions: FBQuestion[];
  private currentQuestionIdx = 0;
  private ended = false;
  private winner: "P1" | "P2" | "draw" | null = null;
  private lastResult: { correct: boolean; damage: number; target: "P1" | "P2"; feedback: string } | null = null;

  constructor(questions?: FBQuestion[]) {
    this.p1 = {
      id: "P1", name: VERSUS_CONFIG.p1.name, hp: VERSUS_CONFIG.initialHp,
      maxHp: VERSUS_CONFIG.initialHp, correct: 0, wrong: 0, combo: 0,
      isTurn: true, icon: VERSUS_CONFIG.p1.icon, color: VERSUS_CONFIG.p1.color,
    };
    this.p2 = {
      id: "P2", name: VERSUS_CONFIG.p2.name, hp: VERSUS_CONFIG.initialHp,
      maxHp: VERSUS_CONFIG.initialHp, correct: 0, wrong: 0, combo: 0,
      isTurn: false, icon: VERSUS_CONFIG.p2.icon, color: VERSUS_CONFIG.p2.color,
    };
    // 选取题目：优先单选/判断题，难度 1-3
    this.questions = questions ?? QUESTION_BANK
      .filter((q) => (q.kind === "single" || q.kind === "judge" || !q.kind) && (q.difficulty ?? 1) <= 3)
      .sort(() => Math.random() - 0.5)
      .slice(0, VERSUS_CONFIG.totalQuestions);
  }

  /** 获取当前题目 */
  getCurrentQuestion(): FBQuestion | null {
    return this.questions[this.currentQuestionIdx] ?? null;
  }

  /** 获取当前回合玩家 */
  getCurrentPlayer(): FBVSPlayerState {
    return this.currentTurn === "P1" ? this.p1 : this.p2;
  }

  /** 获取对手玩家 */
  getOpponent(): FBVSPlayerState {
    return this.currentTurn === "P1" ? this.p2 : this.p1;
  }

  /** 处理答题 */
  answer(choiceIdx: number): { correct: boolean; damage: number; target: "P1" | "P2"; feedback: string } {
    if (this.ended) return { correct: false, damage: 0, target: "P1", feedback: "" };
    const q = this.getCurrentQuestion();
    if (!q) return { correct: false, damage: 0, target: "P1", feedback: "" };

    const correctIdx = q.answer ?? 0;
    const isCorrect = choiceIdx === correctIdx;
    const player = this.getCurrentPlayer();
    const opponent = this.getOpponent();

    let damage = 0;
    if (isCorrect) {
      player.correct++;
      player.combo++;
      damage = VERSUS_CONFIG.damageOnCorrect + Math.max(0, player.combo - 1) * VERSUS_CONFIG.comboBonusDamage;
      opponent.hp = Math.max(0, opponent.hp - damage);
      this.lastResult = { correct: true, damage, target: opponent.id, feedback: q.explain };
    } else {
      player.wrong++;
      player.combo = 0;
      damage = VERSUS_CONFIG.selfDamageOnWrong;
      player.hp = Math.max(0, player.hp - damage);
      this.lastResult = { correct: false, damage, target: player.id, feedback: q.explain };
    }

    // 判断结束
    if (this.p1.hp <= 0 || this.p2.hp <= 0) {
      this.ended = true;
      this.winner = this.p1.hp <= 0 && this.p2.hp <= 0 ? "draw" : this.p1.hp <= 0 ? "P2" : "P1";
    } else if (this.currentQuestionIdx >= this.questions.length - 1) {
      this.ended = true;
      this.winner = this.p1.hp > this.p2.hp ? "P1" : this.p2.hp > this.p1.hp ? "P2" : "draw";
    } else {
      // 切换回合
      this.currentQuestionIdx++;
      this.currentTurn = this.currentTurn === "P1" ? "P2" : "P1";
      this.p1.isTurn = this.currentTurn === "P1";
      this.p2.isTurn = this.currentTurn === "P2";
    }

    return {
      correct: isCorrect,
      damage,
      target: this.lastResult.target,
      feedback: q.explain,
    };
  }

  isOver(): boolean { return this.ended; }
  getWinner() { return this.winner; }
  getP1() { return this.p1; }
  getP2() { return this.p2; }
  getCurrentTurn() { return this.currentTurn; }
  getTotalQuestions() { return this.questions.length; }
  getCurrentQuestionIdx() { return this.currentQuestionIdx; }
  getLastResult() { return this.lastResult; }

  getHud(): FBHudVSState {
    return {
      p1: this.p1, p2: this.p2, currentTurn: this.currentTurn,
      totalQuestions: this.questions.length, currentQuestionIdx: this.currentQuestionIdx,
      ended: this.ended, winner: this.winner,
      currentQuestion: this.getCurrentQuestion(),
      lastResult: this.lastResult,
    };
  }

  getStats(): Partial<FBStats> {
    return {
      versusWinner: this.winner,
      versusP1Correct: this.p1.correct,
      versusP2Correct: this.p2.correct,
      totalAnswered: this.p1.correct + this.p1.wrong + this.p2.correct + this.p2.wrong,
      correctCount: this.p1.correct + this.p2.correct,
      wrongCount: this.p1.wrong + this.p2.wrong,
    };
  }
}
