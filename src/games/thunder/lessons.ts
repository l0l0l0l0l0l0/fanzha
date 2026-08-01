import type {
  ThunderLessonChapterDef,
  ThunderLessonSectionDef,
  ThunderLessonQuizQuestion,
  ThunderLessonSectionKind,
} from "./types";

/**
 * v7 升级 · 反诈课程章节系统
 *
 * 课程围绕“识破—应对—巩固”的节奏设计，每章先读、再看案例、再测验、再实战。
 * 文案参考国家反诈中心公开资料与多地公安通报案例，力求具体可操作。
 */

// ===========================================================================
// ===== 第一章：识破冒充公检法 ==============================================
// ===========================================================================

const CHAPTER_01_SECTIONS: ThunderLessonSectionDef[] = [
  {
    id: "CHAPTER-01-S01",
    title: "冒充公检法的固定话术",
    kind: "reading",
    durationMin: 6,
    fraudTypeId: "F01",
    codexId: "CODEX-F01",
    knowledgeNodeId: "KN-001",
    content:
      `冒充公检法诈骗是当下危害最烈的骗局之一。骗子会冒充公安、检察院、法院工作人员，声称你涉嫌洗钱、走私、诈骗等严重犯罪，要求你“配合调查”。他们的话术有几个固定套路：一是发送带有你照片和身份证号的“逮捕令”“通缉令”，制造恐慌；二是要求你到一个安静、无人的地方接听电话，阻断家人和警方的提醒；三是反复强调“案件涉密”，不准你告诉任何人；四是以“资金清查”为由，要求你把钱转入所谓的“安全账户”。请牢记三件事：真正的公检法绝不会通过电话、微信、视频做笔录；世上不存在所谓的“安全账户”；任何要求你转账“自证清白”的都是诈骗。一旦对方提到转账、验证码、屏幕共享，请立即挂断。`,
    keyPoints: [
      "公检法不会通过电话/微信/视频做笔录，更不会让你转账",
      `不存在“安全账户”，要求转账“自证清白”的一律是诈骗`,
      `骗子常用“逮捕令”“通缉令”伪造文件制造恐慌`,
      "要求独处、开启屏幕共享、索要验证码是典型话术控制",
      "察觉异常立即挂断，拨打 96110 或 110 核实",
    ],
  },
  {
    id: "CHAPTER-01-S02",
    title: "案例：王女士的 47 万元教训",
    kind: "caseStudy",
    durationMin: 5,
    fraudTypeId: "F01",
    codexId: "CODEX-F01",
    knowledgeNodeId: "KN-001",
    content:
      `2023 年 5 月，浙江王女士接到自称“杭州市公安局”的电话，对方准确报出她的身份证号和家庭住址，称她名下银行卡涉嫌一桩 200 万元的洗钱案，并发来一张盖有公章的“刑事逮捕冻结管制令”。王女士被吓懵后，按对方指示躲进酒店、开通手机屏幕共享，把所有存款 47 万元转入“安全账户”核查。等她回过神来拨打 110，钱已被分多笔转至境外。这起案件最关键的教训是：公检法办案绝不会让你转账，任何带“安全账户”字眼的话术都是诈骗；屏幕共享一旦开启，骗子就能看到你的短信验证码，等于把金库钥匙交了出去。`,
    keyPoints: [
      "骗子掌握的个人信息可能来自快递、网购等渠道泄露",
      `伪造的“逮捕令”盖的是假章，真文书须当面送达`,
      "屏幕共享 = 验证码裸奔，任何场景都不要对陌生人开启",
      `被要求“独处”是阻断你求证的红线信号`,
      "挂断后第一时间拨 96110，可启动紧急止付",
    ],
  },
  {
    id: "CHAPTER-01-S03",
    title: "正规办案流程 vs 骗子话术",
    kind: "reading",
    durationMin: 5,
    fraudTypeId: "F01",
    codexId: "CODEX-F01",
    knowledgeNodeId: "KN-008",
    content:
      `识别冒充公检法，最有效的方法是对照正规流程。真实的办案程序有严格规定：民警传唤须出示《传唤证》并当面进行，绝不会通过电话远程“做笔录”；搜查、冻结账户须有法定文书并依法定程序；涉案资金由法院依法处置，不存在“你把钱转到安全账户核查”的操作；讯问须在办案场所进行，全程同步录音录像。而骗子的话术恰好相反：全程不见面、只靠电话施压、动辄“保密”、最后落点一定是转账。记住一个朴素的判断：凡是“不见面、只转账”的“办案”，100% 是诈骗。遇到拿不准的情况，挂断电话，亲自到辖区派出所问一句，比任何“在线核查”都靠谱。`,
    keyPoints: [
      "正规传唤须当面出示《传唤证》，不会电话远程办案",
      `涉案资金由法院依法处置，没有“安全账户”核查流程`,
      "讯问在办案场所进行，全程录音录像",
      `凡是“不见面、只转账”的“办案”必是诈骗`,
      "拿不准就挂断电话，亲自到派出所核实",
    ],
  },
  {
    id: "CHAPTER-01-S04",
    title: "章节测验：你识破了吗",
    kind: "quiz",
    durationMin: 6,
    fraudTypeId: "F01",
    codexId: "CODEX-F01",
    knowledgeNodeId: "KN-001",
    content: "完成下面 4 道题，巩固冒充公检法诈骗的识别要点。",
    keyPoints: [
      `重点关注“安全账户”“屏幕共享”“案件保密”三个关键词`,
      `正确选项往往指向“挂断 + 拨打 96110/110”`,
      "答错也别灰心，看解析记牢要点",
    ],
    quizQuestions: [
      {
        id: "CHAPTER-01-S04-Q01",
        question: `接到自称公检法的电话，对方要求你转账到“安全账户”配合调查，你应该？`,
        options: [
          "按要求转账，配合调查以证清白",
          "先转一部分，验证账户真伪",
          "立即挂断，拨打 96110 或 110 核实",
          "加对方微信，看看逮捕令长什么样",
        ],
        answer: 2,
        explain:
          `公检法不存在“安全账户”，任何要求转账“自证清白”的都是诈骗。挂断后立即拨打 96110 核实是最稳的做法。`,
        knowledgeNodeId: "KN-001",
      },
      {
        id: "CHAPTER-01-S04-Q02",
        question: "骗子要求你到安静的地方接听电话并开启屏幕共享，真实目的是？",
        options: [
          "保护你的个人隐私",
          "阻断外界提醒并窃取短信验证码",
          "方便在线做笔录",
          "提高通话音质",
        ],
        answer: 1,
        explain:
          "独处能切断家人和警方的提醒，屏幕共享能让骗子看到你的短信验证码，是话术控制的核心手段。",
        knowledgeNodeId: "KN-006",
      },
      {
        id: "CHAPTER-01-S04-Q03",
        question: "关于公检法办案流程，下列哪项说法正确？",
        options: [
          "可以通过视频电话远程做笔录",
          "会通过电话告知你涉嫌犯罪并要求转账核查",
          "须出示证件、依法定程序进行，不会电话要求转账",
          "会用微信发送电子逮捕令",
        ],
        answer: 2,
        explain:
          "正规办案须当面出示证件、依法定程序进行，全程录音录像，绝不会通过电话要求转账。",
        knowledgeNodeId: "KN-008",
      },
      {
        id: "CHAPTER-01-S04-Q04",
        question: `收到带有自己照片和身份证号的“通缉令”，说明？`,
        options: [
          "你真的被通缉了，必须配合",
          "信息泄露，骗子伪造文件恐吓你",
          "需要立即联系发件人说明情况",
          "应当转账消除通缉记录",
        ],
        answer: 1,
        explain:
          `个人信息泄露让骗子能伪造以假乱真的“文书”。真正的通缉令不会通过微信、短信发送，也不会要求转账。`,
        knowledgeNodeId: "KN-001",
      },
    ],
  },
  {
    id: "CHAPTER-01-S05",
    title: `实战：对决“假警察”`,
    kind: "practice",
    durationMin: 7,
    fraudTypeId: "F01",
    codexId: "CODEX-F01",
    knowledgeNodeId: "KN-001",
    content:
      `把刚学的识破要点用到实战中。本关你将迎战 BOSS“假警察”——它擅长用“逮捕令”“安全账户”压制你。在战斗中留意它的话术飘字，对应你学过的红旗信号，逐一识破。`,
    keyPoints: [
      `把“安全账户”“屏幕共享”当作攻击信号识破`,
      "留意 BOSS 进入狂暴时的话术升级",
      "通关后解锁关联图鉴与溯源档案",
    ],
    practiceMode: "bossRush",
    practiceStageId: "fakecop",
  },
];

// ===========================================================================
// ===== 第二章：杀猪盘套路解析 ==============================================
// ===========================================================================

const CHAPTER_02_SECTIONS: ThunderLessonSectionDef[] = [
  {
    id: "CHAPTER-02-S01",
    title: "杀猪盘的五步剧本",
    kind: "reading",
    durationMin: 6,
    fraudTypeId: "F02",
    codexId: "CODEX-F02",
    knowledgeNodeId: "KN-002",
    content:
      `杀猪盘是情感与投资叠加的复合诈骗，骗子把受害人叫“猪”，把聊天剧本叫“饲料”，把诈骗平台叫“屠宰场”。整个套路通常分五步：第一步“找猪”，在婚恋社交平台用精心包装的人设接近你；第二步“养猪”，每天嘘寒问暖、建立情感依赖，偶尔透露自己“有内幕投资渠道”；第三步“喂料”，让你看到他在某个平台日赚数千，主动问你“要不要一起”；第四步“屠宰”，先让你小额提现尝甜头，等你加大投入后平台显示“盈利”却无法提现；第五步“杀猪”，以“缴纳税金”“解冻费”为由继续榨取，直到你醒悟或被拉黑。识破的关键在于：任何“稳赚不赔”的投资都是骗局；任何只在指定平台操作、不让提现的“投资”都是屠宰场。真正的感情不会催你掏钱，真正的投资不会承诺保本高收益。`,
    keyPoints: [
      "杀猪盘 = 情感诱导 + 虚假投资平台",
      "五个阶段：找猪→养猪→喂料→屠宰→杀猪",
      `任何“稳赚不赔”“保本高收益”都是骗局`,
      "小额提现尝甜头是引诱大额投入的钩子",
      "真感情不催你掏钱，真投资不阻你提现",
    ],
  },
  {
    id: "CHAPTER-02-S02",
    title: `案例：李工程师的“恋爱”陷阱`,
    kind: "caseStudy",
    durationMin: 5,
    fraudTypeId: "F02",
    codexId: "CODEX-F02",
    knowledgeNodeId: "KN-002",
    content:
      `2022 年，深圳某互联网公司工程师李某在某婚恋 App 认识了“投资经理”小雅。小雅每天早晚问候、分享生活，一个月后“不经意”提到自己在炒一个叫“币链通”的虚拟币平台，发来截图显示日收益 8%。李某试着投了 2000 元，第二天提现 2300 元到账，彻底放下戒心。随后三个月，他先后投入 180 万元，账户“浮盈”达 260 万。当他想提现买房时，客服以“高级会员需缴 20% 税金”为由要求再转 52 万，他才惊觉被骗。案件警示：能提现 ≠ 真平台，前期的小额到账只是诱饵；任何要求“先交税金/解冻费才能提现”的都是杀猪盘尾声。`,
    keyPoints: [
      "前期小额提现成功是建立信任的诱饵",
      `“浮盈”数字是平台后台改的，根本提不出来`,
      `“先交税金/解冻费才能提现”是杀猪盘收网信号`,
      "虚拟币、外汇、博彩是杀猪盘常用载体",
      "网恋对象引导投资，几乎可以判定为骗局",
    ],
  },
  {
    id: "CHAPTER-02-S03",
    title: `章节测验：你被“养”了吗`,
    kind: "quiz",
    durationMin: 6,
    fraudTypeId: "F02",
    codexId: "CODEX-F02",
    knowledgeNodeId: "KN-002",
    content: "完成下面 4 道题，检验你对杀猪盘套路的识别力。",
    keyPoints: [
      `重点识别“内幕渠道”“保本高收益”等钩子`,
      `提现被要求交“税金/解冻费”是收网信号`,
      "网恋 + 投资 = 高度可疑",
    ],
    quizQuestions: [
      {
        id: "CHAPTER-02-S03-Q01",
        question: `网恋对象说“我有内幕投资渠道，日收益 8%，带你一起赚”，你应该？`,
        options: [
          "抓住机会，跟着投一笔",
          "先投 2000 试水，能提现就加大投入",
          `高度警惕，任何“稳赚不赔”的投资都是骗局`,
          "把存款都交给他帮忙操作",
        ],
        answer: 2,
        explain:
          `日收益 8% 意味着年化数千倍，任何承诺保本高收益、稳赚不赔的“投资”都是骗局，这是杀猪盘最典型的钩子。`,
        knowledgeNodeId: "KN-007",
      },
      {
        id: "CHAPTER-02-S03-Q02",
        question: `投资平台显示你已“浮盈 80 万”，但提现时客服要你先缴 20% 税金，说明？`,
        options: [
          "平台合规，按规定缴税即可提现",
          `这是杀猪盘收网，“浮盈”是假的，不能再转钱`,
          "税金可以从盈利里扣除，不用担心",
          "先缴一半，剩下提现后再补",
        ],
        answer: 1,
        explain:
          `正规平台的税金会从盈利中代扣代缴，绝不会要求你“先转账再提现”。“先交钱才能提现”是杀猪盘最后的收割信号。`,
        knowledgeNodeId: "KN-002",
      },
      {
        id: "CHAPTER-02-S03-Q03",
        question: "杀猪盘骗子为什么前期会让你小额提现成功？",
        options: [
          "平台真实可靠，可以放心",
          "建立信任，诱使你投入更大金额",
          "让你熟悉提现流程",
          "遵守监管要求",
        ],
        answer: 1,
        explain:
          `小额提现是“喂料”阶段的核心手法，目的是让你相信平台是真的，从而放心投入全部身家。能提现 ≠ 真平台。`,
        knowledgeNodeId: "KN-002",
      },
      {
        id: "CHAPTER-02-S03-Q04",
        question: "下列哪项不是杀猪盘的常用载体？",
        options: [
          "虚拟币交易平台",
          "境外博彩网站",
          "银行官方定期存款",
          "外汇炒汇平台",
        ],
        answer: 2,
        explain:
          "银行定期存款是受存款保险制度保护的正规产品。杀猪盘常用虚拟币、博彩、外汇等监管难、易操纵的虚假平台。",
        knowledgeNodeId: "KN-002",
      },
    ],
  },
  {
    id: "CHAPTER-02-S04",
    title: `实战：对决“杀猪屠夫”`,
    kind: "practice",
    durationMin: 7,
    fraudTypeId: "F02",
    codexId: "CODEX-F02",
    knowledgeNodeId: "KN-002",
    content:
      `本关你将迎战 BOSS“杀猪屠夫”。它会抛出“内幕渠道”“保本高收益”“先缴税金”等话术弹幕，对照你学过的五步剧本，逐一识破它的招数。`,
    keyPoints: [
      `把“稳赚不赔”“内幕渠道”当作攻击信号`,
      `留意“先缴税金才能提现”的收网话术`,
      "通关解锁杀猪盘溯源档案",
    ],
    practiceMode: "bossRush",
    practiceStageId: "pigkiller",
  },
];

// ===========================================================================
// ===== 第三章：刷单返利陷阱 ================================================
// ===========================================================================

const CHAPTER_03_SECTIONS: ThunderLessonSectionDef[] = [
  {
    id: "CHAPTER-03-S01",
    title: "刷单本身就是违法",
    kind: "reading",
    durationMin: 5,
    fraudTypeId: "F03",
    codexId: "CODEX-F03",
    knowledgeNodeId: "KN-003",
    content:
      `刷单返利是发案率长期居前的诈骗类型。骗子通过短信、兼职群、短视频广告发布“点赞赚钱”“刷单返佣金”“日结 200-500”的诱饵，先让你做几单小任务、即时返现，建立“真能赚钱”的信任，再以“连单任务”“垫付返高佣”为由让你不断加大投入，最后以“操作失误”“系统卡单”为由拒绝返现并拉黑。这里有一个常被忽略的底层事实：刷单本身违反《反不正当竞争法》和《电子商务法》，任何正规的电商平台都不会雇佣陌生人刷单。所以“刷单兼职”这四个字一出现，就可以直接判定为骗局，没有例外。无论对方晒多少返现截图、多少营业执照，都不要信——那些都是可以 PS 的。守住一条底线：凡是先垫钱再返佣的“兼职”，一律拉黑。`,
    keyPoints: [
      "刷单违反《反不正当竞争法》，正规平台不会雇人刷单",
      `“日结 200-500”“点赞赚钱”是常见诱饵`,
      "先小额返现建立信任，再诱导大额垫付",
      `“连单”“垫付返高佣”是收割信号`,
      `凡是先垫钱再返佣的“兼职”一律拉黑`,
    ],
  },
  {
    id: "CHAPTER-03-S02",
    title: `案例：宝妈群里的“轻松兼职”`,
    kind: "caseStudy",
    durationMin: 5,
    fraudTypeId: "F03",
    codexId: "CODEX-F03",
    knowledgeNodeId: "KN-003",
    content:
      `2024 年初，江苏张女士在一个宝妈群里看到“在家刷单、日结 300、不押任何费用”的广告。她扫码添加“客服”，第一单给某商品点赞，3 分钟后微信收到 8.8 元返现。第二天客服派“连单任务”，要求先垫付 500 元购买虚拟商品，承诺返本付佣 580 元，到账后她又做了 3000 元的单。到第三单 1 万元时，客服说她“操作顺序错误导致数据冻结”，需再做一单 3 万元才能解冻返现。张女士四处借钱凑齐 3 万后，客服又要求 5 万“保证金”，她才报警。前后共被骗 4.5 万元。这起案件清晰展示了刷单诈骗的进阶节奏：甜头→垫付→连单→冻结→保证金，每一步都在放大你的沉没成本。`,
    keyPoints: [
      "8.8 元小额返现是建立信任的廉价诱饵",
      `“操作错误导致冻结”是进阶收割的标准话术`,
      `“再做一单就能解冻”利用了沉没成本心理`,
      `要求“保证金”“解冻费”时已被深度套牢`,
      `看到“连单”“垫付”应立即停止并报警`,
    ],
  },
  {
    id: "CHAPTER-03-S03",
    title: "章节测验：刷单陷阱识别",
    kind: "quiz",
    durationMin: 5,
    fraudTypeId: "F03",
    codexId: "CODEX-F03",
    knowledgeNodeId: "KN-003",
    content: "完成下面 3 道题，巩固刷单返利诈骗的识别与应对。",
    keyPoints: [
      `牢记“刷单=违法=骗局”的等式`,
      `“操作错误”“数据冻结”是收割信号`,
      "沉没成本不该成为继续投钱的理由",
    ],
    quizQuestions: [
      {
        id: "CHAPTER-03-S03-Q01",
        question: `看到“点赞赚钱、日结 300、不押费用”的兼职广告，正确的判断是？`,
        options: [
          "不押费用应该安全，可以试试",
          "刷单本身违法，这类广告 100% 是骗局",
          "先做一单小的，赚到钱再说",
          "看广告里有没有营业执照再决定",
        ],
        answer: 1,
        explain:
          `刷单违反《反不正当竞争法》，正规平台不会雇陌生人刷单。“刷单兼职”四个字一出现即可判定为骗局，营业执照可以 PS。`,
        knowledgeNodeId: "KN-003",
      },
      {
        id: "CHAPTER-03-S03-Q02",
        question: `刷单客服说你“操作顺序错误导致数据冻结”，需再做一单大额任务才能解冻，你应该？`,
        options: [
          "按客服说的再做一单解冻",
          "找家人借钱把单做完",
          "立即停止操作，保存截图并报警",
          "和客服商量减免金额",
        ],
        answer: 2,
        explain:
          `“操作错误/数据冻结”是刷单诈骗的标准收割话术，目的是利用沉没成本继续榨取。任何“再做一单就能解冻”都是套路，必须立即停止并报警。`,
        knowledgeNodeId: "KN-007",
      },
      {
        id: "CHAPTER-03-S03-Q03",
        question: "关于刷单诈骗的进阶节奏，下列排序正确的是？",
        options: [
          "垫付→甜头→保证金→冻结",
          "甜头→垫付→连单→冻结→保证金",
          "冻结→甜头→垫付→连单",
          "保证金→甜头→垫付→连单",
        ],
        answer: 1,
        explain:
          `标准节奏是：小额返现甜头→垫付返佣→连单加码→“操作错误”冻结→“保证金/解冻费”收割。认清节奏有助及时止损。`,
        knowledgeNodeId: "KN-003",
      },
    ],
  },
  {
    id: "CHAPTER-03-S04",
    title: "实战：扫荡刷单话术",
    kind: "practice",
    durationMin: 6,
    fraudTypeId: "F03",
    codexId: "CODEX-F03",
    knowledgeNodeId: "KN-003",
    content:
      `本关没有专属 BOSS，你将在关卡模式中遭遇大量刷单话术敌人。留意它们抛出的“日结 300”“连单返佣”“数据冻结”等弹幕，对照本章要点逐一识破。`,
    keyPoints: [
      `把“日结”“连单”“解冻”当攻击信号`,
      "关卡模式连续作战，注意走位规避",
      "通关后解锁刷单诈骗图鉴",
    ],
    practiceMode: "campaign",
    practiceStageId: "F03-stage",
  },
];

// ===========================================================================
// ===== 第四章：AI 换脸与拟声诈骗 ===========================================
// ===========================================================================

const CHAPTER_04_SECTIONS: ThunderLessonSectionDef[] = [
  {
    id: "CHAPTER-04-S01",
    title: "AI 换脸拟声：眼见不再为实",
    kind: "reading",
    durationMin: 7,
    fraudTypeId: "F45",
    codexId: "CODEX-F45",
    knowledgeNodeId: "KN-004",
    content:
      `随着生成式 AI 普及，“眼见为实”正在被颠覆。骗子只需几秒你的语音素材，就能克隆出以假乱真的声音；只需几张正面照片，就能实时换脸成你的领导、家人、朋友，发起视频通话实施诈骗。常见场景有三类：一是冒充领导，通过视频会议要求你“紧急转账”或“代付合同款”；二是冒充家人，哭诉出事需要打钱；三是冒充朋友，借钱周转。识破 AI 换脸有几个有效方法：让对方在脸前挥手或快速转头，换脸模型会出现画面撕裂、五官错位；让对方做一些夸张表情（如捂脸、吐舌头），AI 模型常常跟不上；询问只有你们俩才知道的私密细节。最重要的防线是：凡是涉及转账的视频请求，务必挂断后用存档的电话号码回拨核实，不要用对方发来的号码。`,
    keyPoints: [
      "AI 克隆声音只需几秒语音素材，换脸只需几张照片",
      "常见场景：冒充领导/家人/朋友发起视频转账请求",
      "识破法：让对方挥手/快速转头/做夸张表情，AI 会露馅",
      "核实私密细节是低成本的反向验证",
      "涉及转账的视频请求，挂断后用存档号码回拨核实",
    ],
  },
  {
    id: "CHAPTER-04-S02",
    title: "案例：10 分钟视频会议骗走 430 万",
    kind: "caseStudy",
    durationMin: 5,
    fraudTypeId: "F45",
    codexId: "CODEX-F45",
    knowledgeNodeId: "KN-004",
    content:
      `2024 年 1 月，香港某跨国公司财务职员收到一封来自“总部 CFO”的邮件，要求参加一个机密视频会议。会议中，CFO 和多名同事都出现了画面，神情自然地要求她将 430 万港币转入 15 个本地账户。整个过程里她没有察觉异样——因为所有“参会者”都是 AI 实时换脸生成的。直到事后与真 CFO 当面确认才发觉被骗。这起案件震撼业界之处在于：多人视频会议、熟悉的脸、自然的神态，全部可以伪造。它给所有人提了个醒——任何“紧急、机密、转账”三要素同时出现的视频请求，必须走第二条独立渠道核实，哪怕对方真的是领导，核实也只需多打一通电话。`,
    keyPoints: [
      "AI 可同时伪造多人视频会议，熟悉的脸也能假",
      `“紧急+机密+转账”三要素同时出现必是高危信号`,
      "视频里的脸和声音都不能单独作为身份证明",
      "核实只需多打一通电话，成本极低",
      "用存档号码回拨，不要回拨来电号码",
    ],
  },
  {
    id: "CHAPTER-04-S03",
    title: "章节测验：AI 诈骗识破",
    kind: "quiz",
    durationMin: 6,
    fraudTypeId: "F45",
    codexId: "CODEX-F45",
    knowledgeNodeId: "KN-004",
    content: "完成下面 4 道题，掌握 AI 换脸拟声诈骗的识别与反制。",
    keyPoints: [
      "挥手/转头/夸张表情是有效的 AI 露馅测试",
      `“紧急+机密+转账”三要素是高危组合`,
      "独立渠道回拨核实是终极防线",
    ],
    quizQuestions: [
      {
        id: "CHAPTER-04-S03-Q01",
        question: `视频里“领导”紧急要求你转账，最稳妥的做法是？`,
        options: [
          "领导亲自视频要求，立即转账",
          "要求对方再说几句确认声音",
          "挂断后用存档电话号码回拨核实",
          "转账小额试探，确认后再转全款",
        ],
        answer: 2,
        explain:
          "AI 换脸换声足以伪造视频，声音和脸都不能单独作为身份证明。挂断后用你存档的号码回拨，是最低成本也最有效的核实方式。",
        knowledgeNodeId: "KN-004",
      },
      {
        id: "CHAPTER-04-S03-Q02",
        question: "下列哪种方法能有效识别 AI 实时换脸？",
        options: [
          "让对方正脸对着镜头",
          "让对方在脸前挥手或快速转头",
          "让对方说话时间长一点",
          "看对方穿着是否得体",
        ],
        answer: 1,
        explain:
          "换脸模型在遮挡物经过面部、快速转头时容易出现撕裂和五官错位。让对方挥手、做夸张表情是有效的露馅测试。",
        knowledgeNodeId: "KN-004",
      },
      {
        id: "CHAPTER-04-S03-Q03",
        question: "骗子克隆你家人的声音哭诉出事要钱，你应该？",
        options: [
          "声音听起来确实是家人，赶紧打钱",
          "挂断后用其他方式联系家人本人或亲友核实",
          "先打一半，剩下事后再补",
          "问对方要银行卡号",
        ],
        answer: 1,
        explain:
          `AI 克隆声音只需几秒素材，“听起来像”已不能作为凭证。挂断后通过其他独立渠道联系家人本人或共同亲友核实。`,
        knowledgeNodeId: "KN-009",
      },
      {
        id: "CHAPTER-04-S03-Q04",
        question: "下列哪个组合是 AI 诈骗最高危的信号？",
        options: [
          "紧急 + 机密 + 转账",
          "日常 + 公开 + 转账",
          "紧急 + 公开 + 还款",
          "日常 + 机密 + 咨询",
        ],
        answer: 0,
        explain:
          `“紧急制造压力、机密阻断求证、转账实现收割”是各类诈骗的高危组合，AI 时代尤甚。三者同时出现必须走独立渠道核实。`,
        knowledgeNodeId: "KN-006",
      },
    ],
  },
  {
    id: "CHAPTER-04-S04",
    title: `实战：对决“AI 铸造者”`,
    kind: "practice",
    durationMin: 8,
    fraudTypeId: "F45",
    codexId: "CODEX-F45",
    knowledgeNodeId: "KN-004",
    content:
      `本关你将迎战 BOSS“AI 铸造者”。它能实时换脸、拟声，会伪装成你的领导、家人发起攻击。用你学过的挥手测试、回拨核实等识破法，破解它的伪装弹幕。`,
    keyPoints: [
      "BOSS 会切换多种伪装身份，注意识别",
      `留意“紧急+机密+转账”组合攻击`,
      "通关解锁 AI 诈骗溯源档案",
    ],
    practiceMode: "bossRush",
    practiceStageId: "aiForge",
  },
];

// ===========================================================================
// ===== 第五章：数字货币与加密资产诈骗 ======================================
// ===========================================================================

const CHAPTER_05_SECTIONS: ThunderLessonSectionDef[] = [
  {
    id: "CHAPTER-05-S01",
    title: "数字人民币与加密资产骗局",
    kind: "reading",
    durationMin: 7,
    fraudTypeId: "F117",
    codexId: "CODEX-F117",
    knowledgeNodeId: "KN-002",
    content:
      `围绕数字货币的诈骗正在快速变种，主要有三类。第一类是“数字人民币钱包权限委托诈骗”：骗子冒充反诈中心或银行，称你的数字人民币钱包“被冻结”或“需年审”，要求你把钱包权限委托给“工作人员”操作，一旦授权，钱包内的资金会被瞬间转走。请记住：数字人民币由中国人民银行发行，与微信、支付宝一样正规，任何要求你“委托钱包权限”“授权代操作”的都是诈骗；官方永远不会通过电话要你授权。第二类是“加密货币杀猪盘”：以“内部渠道”“保本高收益”诱导你在虚假交易所投资，前期小额提现成功，加大投入后无法提现。第三类是“虚拟币跑路盘”：发行空气币拉高出货后项目方消失。识破核心：数字人民币不会要求委托权限；任何承诺保本高收益的加密投资都是骗局；境外虚拟币平台不受国内法律保护，维权极难。`,
    keyPoints: [
      `数字人民币不会要求“委托钱包权限”“授权代操作”`,
      "官方永不通过电话要求你授权钱包",
      "加密货币杀猪盘 = 虚假交易所 + 小额提现诱饵",
      `“空气币”拉高出货后项目方跑路`,
      "境外虚拟币平台不受国内法律保护",
    ],
  },
  {
    id: "CHAPTER-05-S02",
    title: `案例：陈先生的“钱包年审”`,
    kind: "caseStudy",
    durationMin: 5,
    fraudTypeId: "F117",
    codexId: "CODEX-F117",
    knowledgeNodeId: "KN-002",
    content:
      `2024 年 3 月，北京陈先生接到自称“数字人民币运营中心”的电话，称其钱包未完成“年度合规审查”，将影响所有银行卡使用。对方准确说出他开户行和尾号，并“指导”他在数字人民币 APP 里把钱包权限委托给“审查专员”。陈先生按提示操作后，3 分钟内钱包内 12 万元被分批转出。等他拨打银行客服才得知，根本没有“钱包年审”这一环节。另一案例中，受害者被诱导在某境外交易所购买“以太坊 2.0 内测币”，前期“涨”了 5 倍却无法提现，最后平台关闭，损失 80 万。两类骗局共同点：都用“官方话术”+ 信息泄露取得信任，最后落点都是你授权或转账。`,
    keyPoints: [
      `“钱包年审”“合规审查”是虚构名目，数字人民币无此流程`,
      "钱包权限一旦委托，资金秒转难追回",
      `境外虚拟币“内测币”多为空气币，涨跌全靠后台`,
      `信息泄露让骗子的话术显得“很官方”`,
      `任何要求授权/转账的“官方电话”都要回拨官方客服核实`,
    ],
  },
  {
    id: "CHAPTER-05-S03",
    title: "章节测验：数字货币陷阱",
    kind: "quiz",
    durationMin: 6,
    fraudTypeId: "F117",
    codexId: "CODEX-F117",
    knowledgeNodeId: "KN-002",
    content: "完成下面 3 道题，辨清数字货币与加密资产诈骗的边界。",
    keyPoints: [
      "数字人民币是法定货币，不会要你委托权限",
      "承诺保本高收益的加密投资都是骗局",
      "境外虚拟币平台不受国内法律保护",
    ],
    quizQuestions: [
      {
        id: "CHAPTER-05-S03-Q01",
        question: `自称“数字人民币运营中心”的人要求你把钱包权限委托给“审查专员”做年审，你应该？`,
        options: [
          "按提示委托，避免影响银行卡使用",
          "先委托，事后查看流水",
          `立即拒绝，数字人民币无“钱包年审”，官方不电话要授权`,
          "把钱包余额转到另一张卡后再委托",
        ],
        answer: 2,
        explain:
          `数字人民币由人民银行发行，无“钱包年审”环节，官方永不通过电话要求授权。委托权限等于交出资金控制权，务必拒绝并回拨官方客服核实。`,
        knowledgeNodeId: "KN-002",
      },
      {
        id: "CHAPTER-05-S03-Q02",
        question: `某境外交易所推销“以太坊 2.0 内测币”，承诺月收益 30% 保本，这属于？`,
        options: [
          "早期投资机会，值得参与",
          "加密货币杀猪盘 / 空气币骗局",
          "正规理财产品",
          "区块链技术创新",
        ],
        answer: 1,
        explain:
          `任何承诺保本高收益的加密投资都是骗局。“内测币”多为空气币，涨跌由后台操控，前期“上涨”只是为了诱使你加大投入，最终无法提现。`,
        knowledgeNodeId: "KN-007",
      },
      {
        id: "CHAPTER-05-S03-Q03",
        question: "关于境外虚拟币平台，下列说法正确的是？",
        options: [
          "受国内法律同等保护，可放心投资",
          "不受国内法律保护，维权极难，应远离",
          "只要平台有中文界面就合规",
          "提现失败可向国内公安全额追回",
        ],
        answer: 1,
        explain:
          "境外虚拟币平台不受国内法律保护，资金一旦转出跨境追赃难度极大。这也是骗子偏爱用虚拟币平台收割的原因之一。",
        knowledgeNodeId: "KN-014",
      },
    ],
  },
  {
    id: "CHAPTER-05-S04",
    title: "实战：狙击加密资产骗局",
    kind: "practice",
    durationMin: 7,
    fraudTypeId: "F117",
    codexId: "CODEX-F117",
    knowledgeNodeId: "KN-002",
    content:
      `本关你将在关卡模式中遭遇“钱包年审”“内测币”“保本高收益”等加密资产话术敌人。留意它们抛出的授权、转账类弹幕，对照本章要点逐一识破，巩固你对数字货币骗局的判断力。`,
    keyPoints: [
      `把“委托权限”“内测币”当攻击信号`,
      "关卡模式连续作战，注意节奏控制",
      "通关解锁加密资产诈骗图鉴",
    ],
    practiceMode: "campaign",
    practiceStageId: "F117-stage",
  },
];

// ===========================================================================
// ===== 第六章：跨境电诈集团识破 ============================================
// ===========================================================================

const CHAPTER_06_SECTIONS: ThunderLessonSectionDef[] = [
  {
    id: "CHAPTER-06-S01",
    title: "跨境电诈集团的运作图谱",
    kind: "reading",
    durationMin: 8,
    fraudTypeId: "F118",
    codexId: "CODEX-F118",
    knowledgeNodeId: "KN-001",
    content:
      `近年来公安机关破获的大量案件揭示，跨境电诈集团已形成高度专业化的产业链，大致分四块：一是“金主”与头目，盘踞境外，提供资金、平台和“保护伞”；二是“话务组”，按剧本分工冒充公检法、客服、投资顾问等，使用 AI 换脸、GOIP 设备隐藏真实位置；三是“技术组”，开发诈骗 APP、搭建虚假平台、维护 GOIP/络漫宝等呼叫设备；四是“洗钱组”，通过跑分平台、数字人民币、虚拟币、地下钱庄把赃款分层转移出境。识破跨境集团诈骗的关键，在于识别其共性特征：来电显示多为境外或虚拟号码、话术高度模板化、最终落点都是转账到陌生账户或授权操作。另一类高发是“境外高薪招聘”骗局，以“月入数万、包机包吃住”诱骗受害人偷渡出境，到了园区被强迫参与诈骗、失去人身自由。看到“东南亚高薪客服”“境外赌场高薪”等招聘，务必提高警惕。`,
    keyPoints: [
      "跨境电诈产业链：金主→话务→技术→洗钱四块分工",
      "GOIP/络漫宝让境外来电显示为本地号码",
      "共性特征：境外/虚拟号 + 模板话术 + 转账落点",
      `“境外高薪招聘”可能诱骗偷渡、强迫参与诈骗`,
      `看到“东南亚高薪客服”等招聘务必警惕`,
    ],
  },
  {
    id: "CHAPTER-06-S02",
    title: "案例：从受害者到被迫加害者",
    kind: "caseStudy",
    durationMin: 6,
    fraudTypeId: "F118",
    codexId: "CODEX-F118",
    knowledgeNodeId: "KN-001",
    content:
      `2023 年，云南青年小周在网上看到“缅北客服岗，月入 2 万、包机包吃住”的招聘，偷渡出境后才发现是电诈园区。他被没收手机、限制自由，被强迫学习“杀猪盘”话术剧本，完不成业绩就遭体罚。半年后他趁乱逃出，辗转回国投案自首。同一时期，多地老人接到显示为本地固话的“公安局”来电，对方称其涉嫌跨境洗钱——事后查明，这些电话全部来自境外的 GOIP 设备，骗子通过络漫宝把境外号码伪装成本地号码。两类案件指向同一个真相：跨境电诈集团一边诱骗国人出境当“工具人”，一边用技术伪装把魔爪伸向国内群众。识破的关键是：本地号码不代表本地来电；任何境外高薪招聘都先核实资质；接到“涉罪”电话一律挂断后拨打 96110。`,
    keyPoints: [
      `“缅北高薪客服”是诱骗偷渡的典型话术`,
      "GOIP/络漫宝可把境外号码伪装成本地固话",
      "本地号码 ≠ 本地来电，不能作为身份凭证",
      "被诱骗出境者往往从受害者变成被迫加害者",
      `接到“涉罪”电话一律挂断后拨 96110 核实`,
    ],
  },
  {
    id: "CHAPTER-06-S03",
    title: "紧急止付与跨境追赃流程",
    kind: "reading",
    durationMin: 6,
    fraudTypeId: "F118",
    codexId: "CODEX-F118",
    knowledgeNodeId: "KN-011",
    content:
      "一旦发现被骗，黄金止付时间通常只有几分钟到几小时，越快行动越有可能追回资金。标准流程是：第一步，立即拨打 110 报警，说清转账时间、金额、对方账户（骗子账户）、转出方式，警方可通过反诈平台向相关银行发起紧急止付；第二步，同步拨打 96110 反诈专线，登记涉案信息，便于全国反诈系统协同；第三步，保存好所有聊天记录、转账凭证、骗子账号、通话录音，这些是取证和追赃的关键证据；第四步，配合警方做笔录，提供完整时间线。需要清醒认识的是：跨境电诈资金往往在数分钟内被分拆到几十个账户并通过虚拟币、地下钱庄转出境，因此止付拼的是速度，而追赃则可能是漫长的过程。提前防范永远胜过事后追赃——把 96110 存进通讯录，遇事先打这一通电话。",
    keyPoints: [
      "黄金止付时间仅几分钟到几小时，越快越好",
      "报警时说清：转账时间、金额、骗子账户、转出方式",
      "同步拨打 96110 登记涉案信息",
      "保存聊天记录、转账凭证、账号、通话录音",
      "提前把 96110 存进通讯录，防范胜过追赃",
    ],
  },
  {
    id: "CHAPTER-06-S04",
    title: "章节测验：跨境电诈识破与应对",
    kind: "quiz",
    durationMin: 7,
    fraudTypeId: "F118",
    codexId: "CODEX-F118",
    knowledgeNodeId: "KN-011",
    content: "完成下面 4 道题，检验你对跨境电诈集团的识别与紧急应对能力。",
    keyPoints: [
      "本地号码 ≠ 本地来电，GOIP 可伪装",
      "黄金止付拼速度，96110 是第一通电话",
      "境外高薪招聘要核实资质",
    ],
    quizQuestions: [
      {
        id: "CHAPTER-06-S04-Q01",
        question: "来电显示是本地固话，对方自称公安局说你涉嫌跨境洗钱，你应该？",
        options: [
          "本地号码肯定是真警察，配合调查",
          "按对方要求转账到安全账户自证清白",
          "挂断后拨打 96110/110 核实，本地号可能来自 GOIP 伪装",
          "加对方微信查看逮捕令",
        ],
        answer: 2,
        explain:
          "GOIP/络漫宝可把境外号码伪装成本地固话，本地号 ≠ 本地来电。公检法不会电话要求转账，挂断后拨 96110 核实是最稳做法。",
        knowledgeNodeId: "KN-001",
      },
      {
        id: "CHAPTER-06-S04-Q02",
        question: "发现被骗转账后，第一通电话应该打给谁？",
        options: [
          "骗子，要求退还",
          "96110 反诈专线 / 110 报警",
          "银行客服投诉",
          "家人商量一晚上",
        ],
        answer: 1,
        explain:
          "黄金止付时间极短，应立即拨打 96110/110，说清转账时间、金额、骗子账户和转出方式，警方可通过反诈平台发起紧急止付。",
        knowledgeNodeId: "KN-011",
      },
      {
        id: "CHAPTER-06-S04-Q03",
        question: `看到“缅北客服岗，月入 2 万、包机包吃住”的招聘，正确的判断是？`,
        options: [
          "待遇优厚，值得冒险一试",
          "可能是诱骗偷渡的电诈园区，务必远离并核实资质",
          "先过去看看，不行再回来",
          "约朋友一起去，互相照应",
        ],
        answer: 1,
        explain:
          `此类“境外高薪”招聘是诱骗偷渡的典型话术，受害人到了园区往往被强迫参与诈骗、失去人身自由。务必远离并向公安举报。`,
        knowledgeNodeId: "KN-009",
      },
      {
        id: "CHAPTER-06-S04-Q04",
        question: "下列哪项不属于被骗后应保存的关键证据？",
        options: [
          "聊天记录与转账凭证",
          "骗子账号与通话录音",
          "你自己的身份证原件",
          "完整的受骗时间线",
        ],
        answer: 2,
        explain:
          "聊天记录、转账凭证、骗子账号、通话录音、时间线都是关键证据。身份证原件无需提供给任何个人，警方做笔录会依法核验。",
        knowledgeNodeId: "KN-012",
      },
    ],
  },
  {
    id: "CHAPTER-06-S05",
    title: `实战：终极对决“跨境洗钱集团”`,
    kind: "practice",
    durationMin: 8,
    fraudTypeId: "F118",
    codexId: "CODEX-F118",
    knowledgeNodeId: "KN-011",
    content:
      `本关你将迎战终极 BOSS“跨境洗钱集团”。它会调用冒充公检法、AI 换脸、虚拟币洗钱等多种手段，是 v7 课程毕业战。综合运用前五章所学，识破它的复合攻击，完成反诈课程毕业。`,
    keyPoints: [
      "BOSS 会复合使用多种诈骗手段",
      "综合运用前五章识破要点",
      "通关获得课程毕业证书与天赋点",
    ],
    practiceMode: "bossRush",
    practiceStageId: "crossBorderLaunder",
  },
];

// ===========================================================================
// ===== 章节总表 ============================================================
// ===========================================================================

export const THUNDER_LESSON_CHAPTERS: ThunderLessonChapterDef[] = [
  {
    id: "CHAPTER-01",
    chapter: 1,
    title: "第一章：识破冒充公检法",
    intro:
      `冒充公检法是危害最烈的诈骗类型之一。本章带你拆解它的固定话术，对照正规办案流程，学会一眼识破“安全账户”骗局。`,
    level: "basic",
    fraudTypeId: "F01",
    relatedBossId: "fakecop",
    sections: CHAPTER_01_SECTIONS,
    passMastery: 0.7,
    themeColor: "#E5353B",
    icon: "📜",
    rewardTalentPoints: 2,
    rewardCertificateId: "CERT-LESSON-01",
  },
  {
    id: "CHAPTER-02",
    chapter: 2,
    title: "第二章：杀猪盘套路解析",
    intro:
      `情感诱导 + 虚假投资，是杀猪盘的标配。本章带你拆解“找猪—养猪—喂料—屠宰—杀猪”五步剧本，识破“稳赚不赔”的钩子。`,
    level: "basic",
    fraudTypeId: "F02",
    relatedBossId: "pigkiller",
    sections: CHAPTER_02_SECTIONS,
    passMastery: 0.7,
    themeColor: "#FF7A1A",
    icon: "🐖",
    prerequisiteChapterId: "CHAPTER-01",
    rewardTalentPoints: 2,
    rewardCertificateId: "CERT-LESSON-02",
  },
  {
    id: "CHAPTER-03",
    chapter: 3,
    title: "第三章：刷单返利陷阱",
    intro:
      `刷单本身违法，“刷单兼职”四个字就是骗局信号。本章拆解刷单诈骗的进阶节奏：甜头→垫付→连单→冻结→保证金。`,
    level: "basic",
    fraudTypeId: "F03",
    sections: CHAPTER_03_SECTIONS,
    passMastery: 0.7,
    themeColor: "#52C41A",
    icon: "🧾",
    prerequisiteChapterId: "CHAPTER-02",
    rewardTalentPoints: 3,
    rewardCertificateId: "CERT-LESSON-03",
  },
  {
    id: "CHAPTER-04",
    chapter: 4,
    title: "第四章：AI 换脸与拟声诈骗",
    intro:
      "AI 时代，眼见不再为实。本章教你用挥手测试、独立渠道回拨等手段，破解 AI 换脸拟声冒充领导、家人的新型诈骗。",
    level: "intermediate",
    fraudTypeId: "F45",
    relatedBossId: "aiForge",
    sections: CHAPTER_04_SECTIONS,
    passMastery: 0.75,
    themeColor: "#B388FF",
    icon: "🤖",
    prerequisiteChapterId: "CHAPTER-03",
    rewardTalentPoints: 4,
    rewardCertificateId: "CERT-LESSON-04",
  },
  {
    id: "CHAPTER-05",
    chapter: 5,
    title: "第五章：数字货币与加密资产诈骗",
    intro:
      `围绕数字人民币和加密资产的骗局正在变种。本章辨清“钱包权限委托”“内测币”“保本高收益”等套路，守住你的数字钱包。`,
    level: "intermediate",
    fraudTypeId: "F117",
    sections: CHAPTER_05_SECTIONS,
    passMastery: 0.75,
    themeColor: "#00E5FF",
    icon: "💎",
    prerequisiteChapterId: "CHAPTER-04",
    rewardTalentPoints: 4,
    rewardCertificateId: "CERT-LESSON-05",
  },
  {
    id: "CHAPTER-06",
    chapter: 6,
    title: "第六章：跨境电诈集团识破",
    intro:
      "跨境电诈集团已产业化运作。本章带你认识其运作图谱、识破 GOIP 伪装与境外高薪招聘骗局，并掌握被骗后的紧急止付流程。",
    level: "advanced",
    fraudTypeId: "F118",
    relatedBossId: "crossBorderLaunder",
    sections: CHAPTER_06_SECTIONS,
    passMastery: 0.8,
    themeColor: "#FF5A60",
    icon: "🌐",
    prerequisiteChapterId: "CHAPTER-05",
    rewardTalentPoints: 5,
    rewardCertificateId: "CERT-LESSON-06",
  },
];

// ===========================================================================
// ===== 辅助函数 ============================================================
// ===========================================================================

/** 获取全部课程章节 */
export function getAllLessonChapters(): ThunderLessonChapterDef[] {
  return THUNDER_LESSON_CHAPTERS;
}

/** 按 ID 获取章节 */
export function getLessonChapterById(id: string): ThunderLessonChapterDef | undefined {
  return THUNDER_LESSON_CHAPTERS.find((c) => c.id === id);
}

/** 按 chapterId + sectionId 获取小节 */
export function getLessonSectionById(
  chapterId: string,
  sectionId: string,
): ThunderLessonSectionDef | undefined {
  const chapter = getLessonChapterById(chapterId);
  if (!chapter) return undefined;
  return chapter.sections.find((s) => s.id === sectionId);
}

/** 判断章节是否解锁：无前置章节则默认解锁；否则前置章节须在已通关列表中 */
export function isChapterUnlocked(chapterId: string, clearedChapters: string[]): boolean {
  const chapter = getLessonChapterById(chapterId);
  if (!chapter) return false;
  if (!chapter.prerequisiteChapterId) return true;
  return clearedChapters.includes(chapter.prerequisiteChapterId);
}

/** 计算章节学习进度（已完成小节 / 总小节），返回 0..1 */
export function calcChapterProgress(
  chapter: ThunderLessonChapterDef,
  completedSections: string[],
): number {
  const total = chapter.sections.length;
  if (total === 0) return 0;
  let done = 0;
  for (const s of chapter.sections) {
    if (completedSections.includes(s.id)) done += 1;
  }
  return Math.min(1, done / total);
}

/**
 * 计算章节掌握度：取该章所有 quiz 小节的测验得分（0..1）均值。
 * quizScores: sectionId → 该小节测验得分（0..1）
 * 若章节无 quiz 小节，则返回 0。
 */
export function calcChapterMastery(
  chapter: ThunderLessonChapterDef,
  quizScores: Record<string, number>,
): number {
  const quizSections = chapter.sections.filter((s) => s.kind === "quiz");
  if (quizSections.length === 0) return 0;
  let sum = 0;
  for (const s of quizSections) {
    const score = quizScores[s.id];
    sum += typeof score === "number" && score > 0 ? Math.min(1, score) : 0;
  }
  return Math.min(1, sum / quizSections.length);
}

// ===== 文件末尾标识：lessons.ts (v7 反诈课程章节系统) =====
