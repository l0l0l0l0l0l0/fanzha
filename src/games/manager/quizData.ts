// ====================================================================
// 反诈职业经理人 · v9 Phase 4.3 知识闯关题库
// 独立文件，按关卡组织（5 关卡 × 10 题，难度递增）
// 题型：single 单选 / multi 多选 / judge 判断
// 数据来源：公安部反诈中心通报 + 央视新闻 + 反诈法条目
// ====================================================================

/** 题目类型 */
export type QuizModeQuestionType = "single" | "multi" | "judge";

/** 知识闯关题目 */
export interface QuizModeQuestion {
  /** 题目 id（在 quiz 命名空间内唯一） */
  id: string;
  /** 题型 */
  type: QuizModeQuestionType;
  /** 题干 */
  question: string;
  /** 选项（single=4 个 / multi=4 个 / judge=2 个对错） */
  options: string[];
  /**
   * 正确答案索引
   * - single/judge：单个数字
   * - multi：逗号分隔的索引字符串，如 "0,2,3"
   */
  correct: string;
  /** 解析 */
  explanation: string;
  /** 知识点分类（与 fraudType 一致，用于错题归类） */
  category: string;
  /** 关联反诈案例 id（可选） */
  relatedCaseId?: string;
}

/** 知识闯关关卡定义 */
export interface QuizModeLevel {
  /** 关卡 id */
  id: string;
  /** 关卡序号（1..N） */
  order: number;
  /** 关卡名称 */
  name: string;
  /** 副标题 */
  subtitle: string;
  /** emoji 图标 */
  emoji: string;
  /** 主题色 */
  color: string;
  /** 题目列表 */
  questions: QuizModeQuestion[];
  /** 通关所需正确题数 */
  passCount: number;
  /** 通关奖励 */
  rewards: {
    coins: number;
    intel: number;
    fragments: number;
    /** 反诈积分 */
    antiFraudPoints: number;
  };
  /** 解锁条件：需通关前置关卡 id（首关为空） */
  prerequisite?: string;
}

// ====================================================================
// 关卡 1：反诈入门（基础概念）
// ====================================================================

const LEVEL_1_QUESTIONS: QuizModeQuestion[] = [
  {
    id: "l1_q1",
    type: "single",
    question: "全国反诈劝阻专线号码是？",
    options: ["110", "96110", "12345", "120"],
    correct: "1",
    explanation: "96110 是工信部为公安机关反诈中心开通的专用号码，用于预警劝阻和反诈咨询。",
    category: "反诈常识",
  },
  {
    id: "l1_q2",
    type: "single",
    question: "接到自称客服的电话说订单异常要双倍退款，正确做法是？",
    options: ["按对方指引下载理赔 APP", "开启屏幕共享让对方协助", "挂断并通过官方 APP 自助核实", "提供银行卡号和验证码"],
    correct: "2",
    explanation: "客服不主动、退款走官方、屏幕共享不开、验证码不给——四道防线守住任何一道都不会被骗。",
    category: "冒充客服",
    relatedCaseId: "case_popup",
  },
  {
    id: "l1_q3",
    type: "judge",
    question: "公检法机关可以通过电话对嫌疑人进行立案调查。",
    options: ["正确", "错误"],
    correct: "1",
    explanation: "公检法不会电话办案，更不会要求转账到「安全账户」或下载指定 APP 接受调查。",
    category: "冒充公检法",
    relatedCaseId: "case_threat",
  },
  {
    id: "l1_q4",
    type: "judge",
    question: "短信里附带的「ETC 过期补办」链接可以放心点击。",
    options: ["正确", "错误"],
    correct: "1",
    explanation: "ETC 发行方不会通过短信链接索要银行卡或验证码。任何附带链接的「过期/禁用」通知都应通过官方 APP 核实。",
    category: "ETC 诈骗",
  },
  {
    id: "l1_q5",
    type: "single",
    question: "「国家反诈中心」APP 的主要功能是？",
    options: ["领取理财收益", "在线报警抓人", "识别预警诈骗来电/短信并提供举报", "代为追回被骗资金"],
    correct: "2",
    explanation: "反诈 APP 主功能是预警、识别和举报，不能直接抓人或追款，但开启来电预警可大幅降低受骗概率。",
    category: "反诈常识",
  },
  {
    id: "l1_q6",
    type: "judge",
    question: "陌生人加微信推荐「稳赚不赔」的理财，群内有人晒单盈利，可以跟单试水。",
    options: ["正确", "错误"],
    correct: "1",
    explanation: "理财认持牌。「稳赚不赔」+群内晒单+老师带单是典型虚假投资盘话术，可在证监会/银保监会官网核查机构资质。",
    category: "虚假投资理财",
    relatedCaseId: "case_invest",
  },
  {
    id: "l1_q7",
    type: "single",
    question: "「刷单返利」类诈骗最常见的入局话术是？",
    options: ["第一单真返现建立信任", "直接要银行卡密码", "声称冻结账户", "要求面签合同"],
    correct: "0",
    explanation: "刷单诈骗 100% 以首单真返现为饵建立信任，第二单开始要求大额本金，并以「任务未完成」为由拒绝返款。",
    category: "刷单返利",
    relatedCaseId: "case_brushOrder",
  },
  {
    id: "l1_q8",
    type: "judge",
    question: "短视频平台陌生人私信你「点赞赚钱」「做任务返利」，这是合法兼职。",
    options: ["正确", "错误"],
    correct: "1",
    explanation: "「点赞/关注返利」是刷单诈骗的引流变种，前期小额返利建立信任后，会引导下载赌博/理财 APP 实施大额诈骗。",
    category: "刷单返利",
  },
  {
    id: "l1_q9",
    type: "single",
    question: "网络交友对方很快喊你「老公/老婆」并推荐理财平台，最可能是？",
    options: ["真心相爱", "杀猪盘诈骗", "合法理财顾问", "社交平台推广"],
    correct: "1",
    explanation: "杀猪盘：先感情培养（养猪），再诱导大额投资（杀猪）。网恋+理财=99% 是诈骗。",
    category: "杀猪盘",
    relatedCaseId: "case_pigButcher",
  },
  {
    id: "l1_q10",
    type: "multi",
    question: "下列哪些是诈骗分子常用的隔离话术？（多选）",
    options: ["找个没人的地方接电话", "不要告诉家人", "拘捕令已发到你 QQ", "请通过 110 核实"],
    correct: "0,1,2",
    explanation: "诈骗分子通过「找没人的地方」「不要告诉家人」「拘捕令发 QQ」等话术切断受害人对外核实渠道。请通过 110 核实是合法建议。",
    category: "冒充公检法",
  },
];

// ====================================================================
// 关卡 2：进阶识骗（新型手段）
// ====================================================================

const LEVEL_2_QUESTIONS: QuizModeQuestion[] = [
  {
    id: "l2_q1",
    type: "single",
    question: "AI 拟声电话里「儿子」说出全名并要求紧急转账，最快的核实方式是？",
    options: ["立即转账", "问对方身份证号", "挂断并用私密问题回拨核实", "相信对方"],
    correct: "2",
    explanation: "AI 拟声仅需 10 秒语音素材即可合成。姓名、身份证号都属可泄露信息，只有私密问题（宠物名/童年昵称）不可伪造。",
    category: "AI 拟声",
    relatedCaseId: "case_aiVoiceClone",
  },
  {
    id: "l2_q2",
    type: "single",
    question: "视频通话里「女儿」的脸要你转 5 万，画面有轻微卡顿，应该？",
    options: ["画面卡是网络问题，转账", "挂断换电话回拨女儿本人核实", "把卡号告诉对方", "让女儿发身份证照核实"],
    correct: "1",
    explanation: "AI 换脸常表现卡顿、眨眼异常、嘴型不同步。换渠道（电话）回拨本人是最快核实方式。",
    category: "AI 换脸",
    relatedCaseId: "case_aiDeepfake",
  },
  {
    id: "l2_q3",
    type: "judge",
    question: "直播带货主播说「内部名额投资电影份额」，可信。",
    options: ["正确", "错误"],
    correct: "1",
    explanation: "影视投资份额不通过直播间零售，且合规影视基金须备案。直播+投资+限时名额是 2024 年新型直播诈骗。",
    category: "直播诈骗",
    relatedCaseId: "case_livestream",
  },
  {
    id: "l2_q4",
    type: "single",
    question: "陌生快递到付包裹里有「中奖刮刮卡」，刮开中了 88 元红包，正确做法？",
    options: ["扫码领奖", "按指引下载 APP 兑奖", "拒绝签收并丢弃，不扫码", "把卡号发过去收钱"],
    correct: "2",
    explanation: "到付包裹+刮刮卡+扫码领奖是新型引流诈骗。一旦扫码即进入刷单/理财诈骗链路。",
    category: "新型引流",
  },
  {
    id: "l2_q5",
    type: "multi",
    question: "下列哪些是 AI 换脸/换声视频的常见破绽？（多选）",
    options: ["画面卡顿或音画不同步", "眨眼频率异常或眼球运动僵硬", "口型与声音轻微错位", "视频通话流畅且自然"],
    correct: "0,1,2",
    explanation: "AI 换脸在表情细节上仍有破绽：卡顿、眨眼异常、嘴型不同步。流畅自然的视频通常为真实通话。",
    category: "AI 换脸",
  },
  {
    id: "l2_q6",
    type: "single",
    question: "陌生短信「您的航班取消，改签请拨 400-xxx-xxxx」，应如何处理？",
    options: ["立即拨打短信中的电话", "通过航司官方 APP/官网核实", "回复短信确认", "按对方要求转账改签费"],
    correct: "1",
    explanation: "航班取消诈骗利用出行焦虑。任何「改签费」「保证金」要求均为诈骗，应通过购票渠道或航司官方核实。",
    category: "航班取消",
  },
  {
    id: "l2_q7",
    type: "judge",
    question: "陌生人邮件附件 .doc / .xlsm 启用宏后能直接盗取你的密码。",
    options: ["正确", "错误"],
    correct: "0",
    explanation: "启用宏的 Office 文档可执行任意代码，窃取浏览器保存的密码、加密货币钱包等。陌生附件一律不打开。",
    category: "钓鱼邮件",
  },
  {
    id: "l2_q8",
    type: "single",
    question: "「医保卡停用，请点击 dxyibao.xyz 完善信息」这类短信是？",
    options: ["医保局正常通知", "钓鱼链接诈骗", "可放心填写", "缴费提醒"],
    correct: "1",
    explanation: "医保局/社保局不发 .xyz / .top 等非官方域名链接。任何「停用/完善信息」通知应通过 12333 或本地政务 APP 核实。",
    category: "钓鱼短信",
  },
  {
    id: "l2_q9",
    type: "multi",
    question: "下列哪些行为会泄露你的生物特征信息？（多选）",
    options: ["在陌生 APP 做人脸识别认证", "社交平台发布高清正脸视频", "开通银行 APP 刷脸登录", "在公共 WiFi 下访问网银"],
    correct: "0,1",
    explanation: "陌生 APP 人脸认证、社交平台高清正脸视频都可能被用于训练 AI 换脸模型。银行 APP 与公共 WiFi 不直接泄露生物特征。",
    category: "AI 换脸",
  },
  {
    id: "l2_q10",
    type: "single",
    question: "游戏里有人私聊「高价收号，加 QQ 详谈」，加完后让你下载指定交易平台，正确判断？",
    options: ["按对方指引下载", "在官方游戏平台/正规二手平台交易", "提供账号密码让对方验号", "先交保证金"],
    correct: "1",
    explanation: "「指定交易平台」多为诈骗分子自建假平台，充值后无法提现。游戏交易走官方或正规二手平台。",
    category: "游戏交易诈骗",
  },
];

// ====================================================================
// 关卡 3：高阶拆解（话术识别）
// ====================================================================

const LEVEL_3_QUESTIONS: QuizModeQuestion[] = [
  {
    id: "l3_q1",
    type: "single",
    question: "骗子说「我是反诈中心，发现你正在被骗，请配合我们将资金转移到安全账户」，破绽是？",
    options: ["无明显破绽，配合即可", "真反诈中心不会要求转账到所谓安全账户", "对方工号是 32817 应该可信", "应配合以免资金损失"],
    correct: "1",
    explanation: "这是「反诈中心冒充诈骗」——骗子利用受害人对反诈机构的信任。真反诈中心只会劝阻转账，永远不会要求转账到任何账户。",
    category: "冒充反诈中心",
  },
  {
    id: "l3_q2",
    type: "single",
    question: "「注销校园贷记录，否则影响征信」类电话，正确判断是？",
    options: ["按对方引导注销", "正规校园贷记录无法「注销」，是诈骗", "提供身份证号协助注销", "下载对方指定 APP 操作"],
    correct: "1",
    explanation: "校园贷记录按征信规则保留，无法「注销」。任何以「消除校园贷记录/洗白征信」为名要求转账的都是诈骗。",
    category: "校园贷诈骗",
  },
  {
    id: "l3_q3",
    type: "multi",
    question: "杀猪盘诈骗的典型阶段包括？（多选）",
    options: ["找猪（交友平台物色目标）", "养猪（感情培养+小赚建立信任）", "杀猪（诱导大额投资后失联）", "报警（骗子协助报案）"],
    correct: "0,1,2",
    explanation: "杀猪盘三阶段：找猪-养猪-杀猪。「报警」阶段不会出现，骗子得手后立即失联。",
    category: "杀猪盘",
    relatedCaseId: "case_pigButcher",
  },
  {
    id: "l3_q4",
    type: "single",
    question: "骗子说「你涉嫌洗钱，拘捕令已发」并发来带公章的 PDF，正确判断？",
    options: ["看到公章就是真的，配合", "拘捕令不会通过 QQ/微信发送，是诈骗", "立即转账到安全账户自证清白", "按对方要求隔离接听"],
    correct: "1",
    explanation: "拘捕令由公安机关依法当面送达或通过法定程序通知，不会通过 QQ/微信发 PDF。PS 公章是基础作案工具。",
    category: "冒充公检法",
    relatedCaseId: "case_threat",
  },
  {
    id: "l3_q5",
    type: "judge",
    question: "客服主动来电说「商品双倍理赔」并要求下载会议软件共享屏幕，是合法售后流程。",
    options: ["正确", "错误"],
    correct: "1",
    explanation: "电商售后走官方 APP 工单流程，不会主动来电+会议软件+屏幕共享。屏幕共享=交出手机控制权，验证码会被实时窃取。",
    category: "冒充客服",
    relatedCaseId: "case_popup",
  },
  {
    id: "l3_q6",
    type: "single",
    question: "「快递丢失三倍理赔」电话，对方准确报出你的订单号、收货地址，应？",
    options: ["信息准确可信，配合理赔", "信息泄露不代表对方是官方，仍需通过电商平台核实", "提供验证码加速理赔", "下载对方指定理赔 APP"],
    correct: "1",
    explanation: "撞库泄露的订单信息被骗子用作「身份证明」。电商理赔一律走官方 APP 工单，不会主动来电+索要验证码。",
    category: "冒充客服",
  },
  {
    id: "l3_q7",
    type: "multi",
    question: "冒充公检法诈骗的「四不原则」是？（多选）",
    options: ["不电办（不电话办案）", "不设安全账户", "不发拘捕令到 QQ/微信", "不要求隔离接听"],
    correct: "0,1,2,3",
    explanation: "公检法不电办、不设安全账户、不发拘捕令到 QQ/微信、不要求隔离接听——任何违反四不原则的「公检法」都是假冒。",
    category: "冒充公检法",
  },
  {
    id: "l3_q8",
    type: "single",
    question: "「猜猜我是谁」电话，对方不报姓名只说「老朋友」，应？",
    options: ["按声音猜对方是谁", "让对方自报姓名，否则挂断", "故意说一个名字试探", "立即约对方见面"],
    correct: "1",
    explanation: "「猜猜我是谁」是冒充熟人诈骗的开口话术。一旦你猜出某名字，对方立即冒充该人借钱。让对方自报姓名是最简防御。",
    category: "冒充熟人",
  },
  {
    id: "l3_q9",
    type: "single",
    question: "网恋对象推荐「内部投资渠道」，理由是「我只告诉你」，这是？",
    options: ["真心相待", "杀猪盘引流话术", "合法理财顾问", "朋友好意"],
    correct: "1",
    explanation: "「内部」「只告诉你」是杀猪盘典型引流话术，制造排他性以降低警惕。合规理财必须公开持牌。",
    category: "杀猪盘",
  },
  {
    id: "l3_q10",
    type: "judge",
    question: "骗子能准确报出你的身份证号、家庭住址，说明对方一定是公检法。",
    options: ["正确", "错误"],
    correct: "1",
    explanation: "个人信息泄露渠道众多（撞库、快递单、酒店入住记录等），骗子掌握这些信息不等于身份可信。仍需通过 110/官方渠道核实。",
    category: "信息泄露",
  },
];

// ====================================================================
// 关卡 4：大师级（跨境/复合诈骗）
// ====================================================================

const LEVEL_4_QUESTIONS: QuizModeQuestion[] = [
  {
    id: "l4_q1",
    type: "single",
    question: "「币圈大佬带单 USDT 暴富」群，老师让你下载某境外交易所 APP 并 C2C 充值，正确判断？",
    options: ["跟单赚一笔", "境外交易所+USDT+C2C 是典型币圈诈骗组合", "先把养老金 all in", "群内晒单真实可信"],
    correct: "1",
    explanation: "境外交易所+USDT+C2C 充值是币圈诈骗标准链路：假平台显示盈利但无法提现，C2C 充值无法追回。境内 USDT 交易本身已涉嫌违规。",
    category: "币圈诈骗",
    relatedCaseId: "case_cryptoWallet",
  },
  {
    id: "l4_q2",
    type: "single",
    question: "接到「你被起诉，传票已寄出」的语音电话，按 9 转人工，正确做法？",
    options: ["按 9 转人工应诉", "挂断并拨打 12368 核实", "按对方要求转账撤诉", "提供身份证号查询案件"],
    correct: "1",
    explanation: "法院传票通过邮政 EMS 寄送并附案号，不会以语音电话+按键转人工形式通知。12368 是诉讼服务热线，可核实真伪。",
    category: "冒充法院",
  },
  {
    id: "l4_q3",
    type: "multi",
    question: "下列哪些是跨境诈骗集团的常见特征？（多选）",
    options: ["窝点设在境外法律薄弱地区", "使用 VOIP 改号伪装国内号码", "资金通过 USDT/虚拟币转移", "受害人面签合同后收据"],
    correct: "0,1,2",
    explanation: "跨境诈骗集团特征：境外窝点+VOIP 改号+虚拟币洗钱。面签合同与收据属传统经济纠纷特征，与跨境电信诈骗模式不符。",
    category: "跨境诈骗",
  },
  {
    id: "l4_q4",
    type: "single",
    question: "「国家扶贫款」申请短信，让你加 QQ 验证身份并交「手续费」激活，这是？",
    options: ["国家真实扶贫政策", "冒充国家政策诈骗", "可申请试一下", "扶贫办正常流程"],
    correct: "1",
    explanation: "国家扶贫政策通过村委/街道/民政部门落地，不会发短信+加 QQ+索要手续费。任何「先交钱领扶贫款」都是诈骗。",
    category: "冒充政策诈骗",
  },
  {
    id: "l4_q5",
    type: "single",
    question: "「快递小哥」加微信说包裹丢失要赔付，发来一个二维码让你扫码填写银行卡，正确做法？",
    options: ["扫码填写收款", "拒扫并通过快递公司官方客服核实", "提供手机验证码加速赔付", "按对方要求下载 APP"],
    correct: "1",
    explanation: "快递公司不会让员工加私人微信处理赔付，更不会发二维码索要银行卡信息。扫码即可能触发木马或钓鱼页面。",
    category: "冒充快递",
  },
  {
    id: "l4_q6",
    type: "judge",
    question: "「我是客服，您的百万医疗险免费升级，请提供身份证号完成验证」是合法服务。",
    options: ["正确", "错误"],
    correct: "1",
    explanation: "「百万医疗险升级」是 2024 年新型冒充保险客服诈骗，目的是套取身份证号+银行卡号，进而冒名办卡或转走资金。",
    category: "冒充保险",
  },
  {
    id: "l4_q7",
    type: "multi",
    question: "遭遇诈骗后应立即采取的正确措施包括？（多选）",
    options: ["拨打 110 报警并提供转账凭证", "冻结对方账户（联系银行）", "保留聊天记录/通话记录作为证据", "联系骗子协商退款"],
    correct: "0,1,2",
    explanation: "黄金止付时间内（通常 30 分钟内）报警+冻结对方账户是止付关键。聊天/通话记录是核心证据。联系骗子协商只会二次被骗。",
    category: "应急处置",
  },
  {
    id: "l4_q8",
    type: "single",
    question: "「老板」通过 QQ 发消息让你紧急转账一笔款项到陌生账户，正确做法？",
    options: ["老板指令立即执行", "电话或当面核实老板本人", "按 QQ 指令转账", "先转一半试水"],
    correct: "1",
    explanation: "冒充老板诈骗利用职场服从心理。「紧急」「不要声张」「立即转账」是三大警示词，必须电话或当面核实本人。",
    category: "冒充领导",
  },
  {
    id: "l4_q9",
    type: "single",
    question: "「你的微信二次实名认证，否则封号」短信附带的链接，正确处理？",
    options: ["点击链接完成认证", "微信不会通过短信链接做二次实名，删除短信", "提供身份证号协助认证", "扫码确认"],
    correct: "1",
    explanation: "微信不会发短信链接做二次实名。这类钓鱼链接伪造微信登录页窃取账号密码，进而冒充你诈骗通讯录好友。",
    category: "冒充平台",
  },
  {
    id: "l4_q10",
    type: "multi",
    question: "下列哪些是 2024-2026 年新型 AI 诈骗手段？（多选）",
    options: ["AI 拟声冒充亲属借钱", "AI 换脸视频通话", "AI 自动生成钓鱼邮件", "银行柜台人工核实"],
    correct: "0,1,2",
    explanation: "AI 拟声、AI 换脸、AI 钓鱼邮件生成是 2024-2026 年新型 AI 诈骗的三大方向。银行柜台人工核实是反诈措施而非诈骗手段。",
    category: "AI 诈骗",
  },
];

// ====================================================================
// 关卡 5：王者级（综合应用）
// ====================================================================

const LEVEL_5_QUESTIONS: QuizModeQuestion[] = [
  {
    id: "l5_q1",
    type: "multi",
    question: "「反诈中心」来电说你账户被冻结，需转账至安全账户审查，破绽包括？（多选）",
    options: ["真反诈中心不会要求转账", "不存在「安全账户」概念", "对方称工号 32817 但拒绝回拨核实", "对方提供了真实身份证号"],
    correct: "0,1,2",
    explanation: "三重破绽：反诈中心不要求转账、不存在安全账户、拒绝回拨核实。身份证号属泄露信息不能作为身份证明。",
    category: "冒充反诈中心",
  },
  {
    id: "l5_q2",
    type: "single",
    question: "网恋对象推荐理财，你已投入 5 万并盈利 1 万想提现，对方说要先缴 20% 个税，应？",
    options: ["缴税提现", "立即停止投入，报警并保留证据", "再投入 5 万补足账户等级", "相信对方继续操作"],
    correct: "1",
    explanation: "「提现先缴税/保证金/解冻费」是杀猪盘收网阶段标志。账面盈利是假的，缴税后对方立即失联。停止投入+报警是唯一选项。",
    category: "杀猪盘",
    relatedCaseId: "case_pigButcher",
  },
  {
    id: "l5_q3",
    type: "single",
    question: "「机构老师」直播带单，让你在虚假平台做空某虚拟币，账户显示已盈利 50 万但提现需充值 5 万「验证账户」，这是？",
    options: ["真实投资机会", "虚假投资盘+杀猪盘组合诈骗", "可以小额充值验证", "持续跟单扩大盈利"],
    correct: "1",
    explanation: "「带单+虚假平台+提现需充值」是虚假投资盘标准收网话术。账面盈利是数字幻觉，充值后立即失联。",
    category: "虚假投资理财",
    relatedCaseId: "case_invest",
  },
  {
    id: "l5_q4",
    type: "multi",
    question: "妈妈接到「儿子」AI 拟声电话说出车祸要 30 万手术费，你作为子女听到后应？（多选）",
    options: ["立即帮妈妈转账", "用私密问题（宠物名/童年昵称）回拨核实", "电话联系儿子其他亲属确认", "拨打 110 报警"],
    correct: "1,2,3",
    explanation: "AI 拟声+紧急事由+大额转账是新型诈骗组合。私密问题核实+多渠道确认+必要时报警是正确响应。立即转账是诈骗目标。",
    category: "AI 拟声",
    relatedCaseId: "case_aiVoiceClone",
  },
  {
    id: "l5_q5",
    type: "single",
    question: "你被骗子拉黑后发现账面有 200 万借款合同，对方威胁起诉，正确做法？",
    options: ["按对方要求还款息事", "保留所有证据并报警+咨询律师", "继续转账尝试追回", "私下联系骗子谈判"],
    correct: "1",
    explanation: "诈骗形成的「借款合同」无法律效力，但仍需报警+律师协助固定证据。继续转账或私聊骗子只会扩大损失。",
    category: "应急处置",
  },
  {
    id: "l5_q6",
    type: "single",
    question: "「老板」QQ 让你转账 80 万，对方称在开会不方便接电话，正确判断？",
    options: ["老板指令立即执行", "「不方便接电话」+「立即转账」是冒充领导诈骗典型话术，必须电话核实", "按 QQ 指令转账", "转一半试水"],
    correct: "1",
    explanation: "「不方便接电话」是冒充领导诈骗的核心隔离话术，目的是阻止核实。任何大额转账必须电话或当面核实本人，无例外。",
    category: "冒充领导",
  },
  {
    id: "l5_q7",
    type: "multi",
    question: "开通国家反诈中心 APP 后，正确使用方式包括？（多选）",
    options: ["开启来电预警权限", "定期更新 APP 至最新版本", "上传身份证照片加速识别", "举报可疑来电/短信"],
    correct: "0,1,3",
    explanation: "反诈 APP 通过来电预警+举报数据库识别诈骗。上传身份证照片非必需且属过度授权。开启权限+定期更新+主动举报是最佳实践。",
    category: "反诈常识",
  },
  {
    id: "l5_q8",
    type: "single",
    question: "「我是网警，监测到你访问违法网站，需远程检查你的电脑」让你下载 TeamViewer，正确做法？",
    options: ["按对方要求下载并远程", "网警不会要求远程控制个人电脑，挂断报警", "提供电脑密码协助检查", "按对方指引支付检查费"],
    correct: "1",
    explanation: "网警依法办案不会电话要求远程控制个人电脑。下载远程软件=交出电脑控制权，可窃取网银/钱包凭证。挂断+110 报警是正确响应。",
    category: "冒充网警",
  },
  {
    id: "l5_q9",
    type: "multi",
    question: "防诈骗的「三不一多」原则是？（多选）",
    options: ["不轻信", "不透露", "不转账", "多核实"],
    correct: "0,1,2,3",
    explanation: "「三不一多」：不轻信来历不明的电话/短信、不透露本人及家人身份信息/存款/银行卡、不向陌生账户转账，多核实（110/官方渠道）。",
    category: "反诈常识",
  },
  {
    id: "l5_q10",
    type: "single",
    question: "「您的快递被海关扣押，需缴纳税费才能放行」短信附链接，正确处理？",
    options: ["点链接缴税", "通过快递公司官方客服/海关 12360 核实", "提供银行卡号扣税", "按对方指引下载 APP"],
    correct: "1",
    explanation: "海关通关通过邮政 EMS 或快递公司官方渠道通知并附正式文书，不会发短信链接索要银行卡。12360 是海关热线。",
    category: "冒充海关",
  },
];

// ====================================================================
// 5 个关卡定义
// ====================================================================

export const QUIZ_LEVELS: QuizModeLevel[] = [
  {
    id: "quiz_l1",
    order: 1,
    name: "反诈入门",
    subtitle: "基础概念 · 10 题",
    emoji: "🟢",
    color: "#52C41A",
    questions: LEVEL_1_QUESTIONS,
    passCount: 7,
    rewards: { coins: 200, intel: 5, fragments: 2, antiFraudPoints: 100 },
  },
  {
    id: "quiz_l2",
    order: 2,
    name: "进阶识骗",
    subtitle: "新型手段 · 10 题",
    emoji: "🔵",
    color: "#1B5FCC",
    questions: LEVEL_2_QUESTIONS,
    passCount: 7,
    rewards: { coins: 400, intel: 10, fragments: 4, antiFraudPoints: 200 },
    prerequisite: "quiz_l1",
  },
  {
    id: "quiz_l3",
    order: 3,
    name: "高阶拆解",
    subtitle: "话术识别 · 10 题",
    emoji: "🟡",
    color: "#FFB020",
    questions: LEVEL_3_QUESTIONS,
    passCount: 8,
    rewards: { coins: 600, intel: 15, fragments: 6, antiFraudPoints: 300 },
    prerequisite: "quiz_l2",
  },
  {
    id: "quiz_l4",
    order: 4,
    name: "大师级",
    subtitle: "跨境/复合 · 10 题",
    emoji: "🟠",
    color: "#FF8A3D",
    questions: LEVEL_4_QUESTIONS,
    passCount: 8,
    rewards: { coins: 800, intel: 20, fragments: 8, antiFraudPoints: 400 },
    prerequisite: "quiz_l3",
  },
  {
    id: "quiz_l5",
    order: 5,
    name: "王者级",
    subtitle: "综合应用 · 10 题",
    emoji: "🔴",
    color: "#E5353B",
    questions: LEVEL_5_QUESTIONS,
    passCount: 9,
    rewards: { coins: 1200, intel: 30, fragments: 12, antiFraudPoints: 600 },
    prerequisite: "quiz_l4",
  },
];
