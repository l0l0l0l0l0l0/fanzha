import type {
  ThunderStoryCampaign,
  ThunderStoryStageDef,
  ThunderStoryEndingDef,
} from "./types";

// ===========================================================================
// v7 剧情战役系统数据：雷霆行动 · 跨境追击
// 模式：mode="story"，10 章主线 + 2 章支线标记 + 5 种结局
// ===========================================================================

/**
 * 剧情战役主数据
 * - id: 战役 ID
 * - stages: 10 个关卡（按章节顺序）
 * - endings: 5 种结局
 */
export const THUNDER_STORY_CAMPAIGN: ThunderStoryCampaign = {
  id: "STORY-MAIN-01",
  name: "雷霆行动：跨境追击",
  desc:
    "境外电诈园区盘踞多年，骗术不断翻新。雷霆反诈特警小队接到密令，从城市街头一路追击到边境口岸，再潜入网络空间与境外园区，与冒充公检法、杀猪盘、AI 换脸、共享屏幕、跨境洗钱等典型电诈团伙正面交锋，最终直捣电诈集团总部。每一关都是一次真实反诈战场，每一次通关都点亮一条识骗防线。",
  stages: [
    // ===== 第一章：暗流涌动（教学向战斗关） =====
    {
      id: "STORY-01",
      chapter: 1,
      name: "第一章：暗流涌动",
      kind: "combat",
      intro:
        "深夜的城西派出所，报案电话此起彼伏。一通自称「客服」的电话、一条陌生短信，让普通人的积蓄瞬间蒸发。队长把新队员叫到跟前：先从最基础的骗局打起，学会看清骗子的第一张脸。",
      outro:
        "你成功拦截了第一批骗子话术。记住：96110 是全国反诈专线，接到这个号码一定要接听；任何陌生人让你「点链接」「下 APP」时，先停一停，多问一句为什么。",
      theme: "city",
      difficulty: "normal",
      waves: [
        [{ typeId: "script", count: 5, interval: 1.2, delay: 0 }],
        [{ typeId: "fakecs", count: 4, interval: 1.0, delay: 1.5 }],
        [{ typeId: "script", count: 6, interval: 0.8, delay: 0.5 }],
      ],
      recommendedCharacterId: "swat",
      passScore: 800,
      passWave: 3,
      rankSScore: 1600,
      rankAScore: 1200,
      rankBScore: 1000,
      themeColor: "#00E5FF",
      icon: "🌃",
      learningPoints: [
        "96110 是全国统一的反诈预警专线，看到这个号码务必接听。",
        "陌生短信里的链接不要点，很可能诱导你安装木马 APP。",
        "客服主动联系「退款」「理赔」时，先通过官方 APP 核实订单状态。",
      ],
      unlocksStages: ["STORY-02"],
    },

    // ===== 第二章：首次交锋（BOSS：冒充公检法） =====
    {
      id: "STORY-02",
      chapter: 2,
      name: "第二章：首次交锋",
      kind: "boss",
      intro:
        "一位老人攥着电话冲进派出所：「他说我是嫌疑人，要把我抓走！」话筒那头传来严厉的「警官」声音，要求把存款转进「安全账户」。这是典型的冒充公检法骗局，必须当场揭穿。",
      outro:
        "冒充公检法是高发骗术之一。真正的警察不会电话办案，更不存在所谓的「安全账户」。任何要求你转账、汇款、提供验证码的「公检法」，都是骗子。",
      theme: "city",
      difficulty: "normal",
      waves: [
        [{ typeId: "threat", count: 3, interval: 1.5, delay: 0 }],
        [{ typeId: "fakecs", count: 5, interval: 0.9, delay: 1.0 }],
        [{ typeId: "threat", count: 4, interval: 1.0, delay: 0.5 }],
      ],
      bossId: "fakecop",
      recommendedCharacterId: "officer",
      passScore: 1200,
      passWave: 3,
      rankSScore: 2400,
      rankAScore: 1800,
      rankBScore: 1500,
      themeColor: "#3B7FEF",
      icon: "🚔",
      learningPoints: [
        "公检法机关不会通过电话、QQ、微信办案，更不会要求转账到「安全账户」。",
        "凡是要求「保密」「不能告诉家人」的「案件」，基本都是骗局。",
        "真正的法律文书会通过正式渠道送达，不会用短信链接让你点击签收。",
        "接到可疑「公检法」电话，立即挂断并拨打 110 或 96110 核实。",
      ],
      unlocksStages: ["STORY-03"],
    },

    // ===== 第三章：杀猪盘之祸（战斗关） =====
    {
      id: "STORY-03",
      chapter: 3,
      name: "第三章：杀猪盘之祸",
      kind: "combat",
      intro:
        "一位年轻姑娘红着眼走进反诈中心：她在交友软件上认识了「阿杰」，相恋半年，对方嘘寒问暖、风雨无阻。直到他推荐了一个「稳赚不赔」的投资平台，她把全部积蓄投了进去……人财两空。这是一场精心包装的杀猪盘。",
      outro:
        "杀猪盘的「养猪」阶段温柔体贴，「杀猪」阶段冷血收割。任何在网上认识的「对象」，只要谈到投资、博彩、稳赚平台，几乎都是骗子。感情可以认真，转账必须慎重。",
      theme: "cyber",
      difficulty: "normal",
      waves: [
        [{ typeId: "script", count: 6, interval: 0.8, delay: 0 }],
        [{ typeId: "brushing", count: 4, interval: 1.0, delay: 1.0 }],
        [{ typeId: "pigboy", count: 3, interval: 1.2, delay: 0.8 }],
        [{ typeId: "script", count: 8, interval: 0.6, delay: 0.5 }],
      ],
      recommendedCharacterId: "cyber",
      passScore: 1500,
      passWave: 4,
      rankSScore: 3000,
      rankAScore: 2250,
      rankBScore: 1800,
      themeColor: "#FF7AB8",
      icon: "💔",
      learningPoints: [
        "网上认识的「优质对象」短时间内称你为「老婆/老公」并谈投资，基本是杀猪盘。",
        "任何「稳赚不赔」「内部漏洞」「老师带单」的投资平台，都是诈骗温床。",
        "平台显示的「盈利」只是数字，提现时一定会以各种理由让你继续充钱。",
        "恋爱可以谈，钱不能轻易转；遇到投资要求，先与家人朋友商量。",
      ],
      unlocksStages: ["STORY-04"],
    },

    // ===== 第四章：迷雾重重（纯剧情对白关） =====
    {
      id: "STORY-04",
      chapter: 4,
      name: "第四章：迷雾重重",
      kind: "narrative",
      intro:
        "前线的案子越来越多，看似毫无关联的报案，背后却隐隐指向同一只看不见的手。队长决定暂缓出击，先把所有线索摊在桌上，理清骗局的来龙去脉。",
      outro:
        "线索逐渐清晰：分散在全国的骗局，资金最终都流向了境外园区。雷霆小队意识到，这一次要面对的不是散兵游勇，而是一个组织严密的跨境电诈集团。",
      theme: "city",
      difficulty: "normal",
      recommendedCharacterId: "volunteer",
      passScore: 0,
      passWave: 0,
      rankSScore: 0,
      rankAScore: 0,
      rankBScore: 0,
      themeColor: "#B0BEC5",
      icon: "📜",
      learningPoints: [
        "反诈不只是「抓一个骗子」，更要看清整条黑色产业链。",
        "报案后第一时间拨打 110 并保留转账凭证，有助于紧急止付。",
        "国家反诈中心 APP 可一键举报可疑线索，是普通人的「反诈哨兵」。",
      ],
      unlocksStages: ["STORY-05"],
    },

    // ===== 第五章：甜蜜陷阱（BOSS：杀猪盘头目） =====
    {
      id: "STORY-05",
      chapter: 5,
      name: "第五章：甜蜜陷阱",
      kind: "boss",
      intro:
        "顺着线索，小队锁定了杀猪盘团伙的核心据点。头目外号「猪老六」，靠一套精心编写的话术剧本，把无数受害者骗得倾家荡产。这一次，要正面对决。",
      outro:
        "击败「猪老六」并不意味着杀猪盘就此消失。请把这条经验带给身边人：再温柔的话术，最终都会指向「转账」「投资」「借款」。守住钱袋子的最后一道防线，永远是「不转账」三个字。",
      theme: "cyber",
      difficulty: "hard",
      waves: [
        [{ typeId: "pigboy", count: 4, interval: 1.0, delay: 0 }],
        [{ typeId: "script", count: 8, interval: 0.6, delay: 1.0 }],
        [{ typeId: "brushing", count: 5, interval: 0.8, delay: 0.5 }],
        [{ typeId: "pigboy", count: 5, interval: 0.7, delay: 0.5 }],
      ],
      bossId: "pigkiller",
      recommendedCharacterId: "cyber",
      passScore: 2000,
      passWave: 4,
      rankSScore: 4000,
      rankAScore: 3000,
      rankBScore: 2500,
      themeColor: "#FF00E5",
      icon: "🐷",
      learningPoints: [
        "杀猪盘的剧本高度模板化：嘘寒问暖 → 引入投资 → 小额返利 → 大额杀猪。",
        "凡是以「内幕消息」「平台漏洞」诱导你大额充值的，100% 是诈骗。",
        "恋爱交友平台上的「真人认证」并不等于「真实身份」，头像可盗用、人设可伪造。",
        "紧急止付黄金时间为转账后 30 分钟内，立刻报警才有机会挽回损失。",
      ],
      unlocksStages: ["STORY-06", "STORY-07"],
    },

    // ===== 第六章：AI 伪造危机（支线战斗关） =====
    {
      id: "STORY-06",
      chapter: 6,
      name: "第六章：AI 伪造危机",
      kind: "combat",
      intro:
        "新技术成了骗子手里的新刀。AI 拟声、视频换脸、伪造领导语音，让不少财务和家庭中招。小队接到上级指派，前往网络空间清剿这一波新型诈骗团伙。",
      outro:
        "声音可以模仿，脸可以换，但身份不能只凭一段视频就认定。涉及转账汇款，务必通过第二条渠道（电话、当面）再次核实，给「AI 换脸」留一道防线。",
      theme: "cyber",
      difficulty: "hard",
      waves: [
        [{ typeId: "aiVoice", count: 4, interval: 1.0, delay: 0 }],
        [{ typeId: "facetime", count: 4, interval: 0.9, delay: 1.0 }],
        [{ typeId: "deepfake", count: 3, interval: 1.2, delay: 0.8 }],
        [{ typeId: "aiVoice", count: 6, interval: 0.6, delay: 0.5 }],
      ],
      recommendedCharacterId: "streamer",
      passScore: 1800,
      passWave: 4,
      rankSScore: 3600,
      rankAScore: 2700,
      rankBScore: 2200,
      themeColor: "#B388FF",
      icon: "🤖",
      learningPoints: [
        "AI 换脸、AI 拟声已能高度还原熟人的脸和声音，不能只凭视频就信。",
        "领导通过微信、QQ 视频要求转账时，务必电话或当面二次核实。",
        "家人「出事」急需用钱的电话，先挂掉，再主动联系本人或学校、单位确认。",
        "为重要账户开启「大额转账延时到账」，给自己留出反悔和报警的时间。",
      ],
      isBranch: true,
      unlockCondition: "通关第五章「甜蜜陷阱」后解锁",
      unlocksStages: ["STORY-07"],
    },

    // ===== 第七章：共享屏幕黑手（BOSS：共享屏幕诈骗团伙） =====
    {
      id: "STORY-07",
      chapter: 7,
      name: "第七章：共享屏幕黑手",
      kind: "boss",
      intro:
        "新一波骗局盯上了「屏幕共享」功能。骗子冒充客服，以「关闭会员」「取消百万保障」为由，引导受害者打开视频会议共享屏幕，眼睁睁看着对方转走自己卡里的钱。这一次的对手，是擅长操纵屏幕的诈骗团伙。",
      outro:
        "屏幕共享等于把手机交到了骗子手里——你输入的密码、收到的验证码，对方看得一清二楚。任何让你「开视频会议」「共享屏幕」的「客服」，都是骗子。",
      theme: "border",
      difficulty: "hard",
      waves: [
        [{ typeId: "screenShare", count: 4, interval: 1.0, delay: 0 }],
        [{ typeId: "fakecs", count: 5, interval: 0.8, delay: 1.0 }],
        [{ typeId: "screenShare", count: 6, interval: 0.7, delay: 0.5 }],
      ],
      bossId: "screenShareSyndicate",
      recommendedCharacterId: "banker",
      passScore: 2200,
      passWave: 3,
      rankSScore: 4400,
      rankAScore: 3300,
      rankBScore: 2700,
      themeColor: "#FFB020",
      icon: "📱",
      learningPoints: [
        "「共享屏幕」会让对方看到你的密码、验证码、短信，等同于把手机递给骗子。",
        "微信、支付宝没有「百万保障」服务，所谓「不取消就扣费」全是恐吓。",
        "任何「客服」让你下载腾讯会议、Zoom、向日葵等远控软件的，立即挂断。",
        "支付密码、短信验证码是最后一道闸，任何场景都不能念给他人听。",
      ],
      unlocksStages: ["STORY-08", "STORY-09"],
    },

    // ===== 第八章：边境追踪（支线战斗关） =====
    {
      id: "STORY-08",
      chapter: 8,
      name: "第八章：边境追踪",
      kind: "combat",
      intro:
        "线索延伸到边境口岸。这里鱼龙混杂，假招聘、快递理赔、虚假中奖层出不穷，每一类都通往同一条境外偷渡通道。小队奉命在边境布控，截断骗子的「人货通道」。",
      outro:
        "边境一战的收获不仅是抓获若干「马仔」，更撬开了通往境外园区的最后一块砖。请记住：高薪境外招聘大多有去无回，正规的境外用工一定有齐全的劳务手续。",
      theme: "border",
      difficulty: "nightmare",
      waves: [
        [{ typeId: "fakeRecruit", count: 4, interval: 1.0, delay: 0 }],
        [{ typeId: "expressClaim", count: 4, interval: 0.9, delay: 1.0 }],
        [{ typeId: "fakeLottery", count: 3, interval: 1.2, delay: 0.8 }],
        [{ typeId: "fakeRecruit", count: 6, interval: 0.6, delay: 0.5 }],
      ],
      recommendedCharacterId: "officer",
      passScore: 2500,
      passWave: 4,
      rankSScore: 5000,
      rankAScore: 3750,
      rankBScore: 3000,
      themeColor: "#52C41A",
      icon: "🛡",
      learningPoints: [
        "「高薪境外招聘、包机包住、无需经验」多为偷渡电诈园区的诱饵。",
        "正规境外劳务必须办理工作签证，签订劳务合同，并经商务部资质公司派出。",
        "快递「理赔」「丢件退款」让你下载 APP、共享屏幕的，100% 是诈骗。",
        "中奖信息要先核对官方渠道；任何「先交税费、保证金」的中奖都是骗局。",
      ],
      isBranch: true,
      unlockCondition: "通关第七章「共享屏幕黑手」后解锁",
      unlocksStages: ["STORY-09"],
    },

    // ===== 第九章：跨境洗钱（BOSS：跨境洗钱团伙） =====
    {
      id: "STORY-09",
      chapter: 9,
      name: "第九章：跨境洗钱",
      kind: "boss",
      intro:
        "电诈得手后，赃款要经过层层洗白才能落到骗子口袋。小队盯上了一支专门负责「跑分」「币种兑换」「数字藏品」洗钱的跨境团伙，必须斩断这条黑色资金动脉。",
      outro:
        "洗钱链条被切断，骗子账户里的钱第一次真正「卡住了」。也请把这条提醒带回家：把自己的银行卡、收款码借给他人「走流水赚佣金」，本身就是帮助信息网络犯罪活动罪，会留下案底。",
      theme: "overseas",
      difficulty: "nightmare",
      waves: [
        [{ typeId: "dcep", count: 4, interval: 0.9, delay: 0 }],
        [{ typeId: "gameAccTrade", count: 5, interval: 0.8, delay: 1.0 }],
        [{ typeId: "digitalCollect", count: 4, interval: 1.0, delay: 0.8 }],
        [{ typeId: "dcep", count: 6, interval: 0.6, delay: 0.5 }],
      ],
      bossId: "crossBorderLaunder",
      recommendedCharacterId: "banker",
      passScore: 2800,
      passWave: 4,
      rankSScore: 5600,
      rankAScore: 4200,
      rankBScore: 3400,
      themeColor: "#FF7A1A",
      icon: "💸",
      learningPoints: [
        "出借、出租、出售本人银行卡给他人「跑分」，构成帮信罪，最高可判三年。",
        "「USDT 代挖」「虚拟币搬砖赚佣金」是新型洗钱马甲，参与即违法。",
        "「数字藏品/NFT 内测发售」对涨不涨没保障，本质是击鼓传花式骗局。",
        "游戏账号、礼品卡回收是常见洗钱通道，涉案账户将被冻结并追责。",
      ],
      unlocksStages: ["STORY-10"],
    },

    // ===== 第十章：最终决战（终极 BOSS：电诈集团首脑） =====
    {
      id: "STORY-10",
      chapter: 10,
      name: "第十章：最终决战",
      kind: "boss",
      intro:
        "所有线索汇于一处：境外园区深处，电诈集团的首脑「金主」坐镇指挥。雷霆小队跨境突击，正面攻入园区核心。这一战，是为了所有受害者，也是为了不再有下一个受害者。",
      outro:
        "「金主」落网，电诈集团土崩瓦解。但反诈之战远未结束——只要还有人轻信陌生电话，骗子就会换个马甲卷土重来。把今天学到的识骗要点告诉身边每一个人，让防线从一个人延伸到一座城。",
      theme: "overseas",
      difficulty: "nightmare",
      waves: [
        [{ typeId: "script", count: 8, interval: 0.5, delay: 0 }],
        [{ typeId: "threat", count: 5, interval: 0.8, delay: 1.0 }],
        [{ typeId: "deepfake", count: 4, interval: 0.9, delay: 0.8 }],
        [{ typeId: "pigboy", count: 6, interval: 0.6, delay: 0.5 }],
        [{ typeId: "screenShare", count: 5, interval: 0.7, delay: 0.5 }],
      ],
      bossId: "kingpin",
      recommendedCharacterId: "swat",
      passScore: 3500,
      passWave: 5,
      rankSScore: 7000,
      rankAScore: 5250,
      rankBScore: 4200,
      themeColor: "#E5353B",
      icon: "👑",
      learningPoints: [
        "反诈不是一个人的战斗，是全社会共同构筑的防线。",
        "「不轻信、不透露、不转账」是识骗防骗的三条铁律。",
        "遭遇诈骗后请第一时间拨打 110 / 96110，并保留聊天、转账记录作为证据。",
        "下载并开启「国家反诈中心 APP」的预警功能，让骗术无处遁形。",
        "把学到的反诈知识讲给家人朋友，让防线从一个人扩散到一群人。",
      ],
      isEnding: true,
      endingId: "ENDING-TRUE",
      unlocksStages: [],
    },
  ],

  endings: [
    {
      id: "ENDING-TRUE",
      type: "true",
      title: "真相结局：雷霆扫穴",
      desc:
        "所有关卡均以 S 级通关，电诈集团首脑「金主」被生擒归案，整条黑色产业链被连根拔起。城市重归安宁，每一通陌生电话都不再令人心慌。",
      lesson:
        "真正扫除电诈，靠的不仅是抓捕，更是全民识骗。当你把每一条反诈要点都讲给身边的人，你就成了雷霆行动的一员。",
      icon: "⚡",
      color: "#FFD666",
      unlockCondition: "全部 10 关以 S 级评价通关",
    },
    {
      id: "ENDING-GOOD",
      type: "good",
      title: "完美结局：凯旋归来",
      desc:
        "主线全部通关，雷霆小队顺利凯旋。电诈集团遭受重创，多名骨干落网。前路仍有零星骗术冒头，但反诈意识已在千家万户生根。",
      lesson:
        "反诈是一场没有终点的马拉松，打赢一场不等于结束。继续保持警惕，让识骗能力成为日常习惯。",
      icon: "🎉",
      color: "#52C41A",
      unlockCondition: "通关全部主线关卡",
    },
    {
      id: "ENDING-NORMAL",
      type: "normal",
      title: "普通结局：任务完成",
      desc:
        "基础通关，主线核心关卡已通过。雷霆小队完成了既定任务，但仍有支线骗术团伙逍遥法外。下一次行动，已经在路上。",
      lesson:
        "每一次通关都是一次成长。剩下的支线，是给自己留的下一份功课，也是为身边人留的一份守护。",
      icon: "✅",
      color: "#3B7FEF",
      unlockCondition: "通关全部主线关卡（含支线未完成）",
    },
    {
      id: "ENDING-BAD",
      type: "bad",
      title: "坏结局：代价惨重",
      desc:
        "通关时小队战机 HP 已所剩无几。虽然最终击破了首脑，但途中多名队员受伤，部分受害者资金未能及时止付。胜利的代价，刻在了每一位队员心里。",
      lesson:
        "反诈不能只等最后一刻才出手。越早识破、越早报警，挽回的可能就越大。请把「第一时间 110」刻进本能。",
      icon: "🩹",
      color: "#FF7A1A",
      unlockCondition: "通关最终关时玩家 HP 低于最大值的 20%",
    },
    {
      id: "ENDING-HIDDEN",
      type: "hidden",
      title: "隐藏结局：深渊之中",
      desc:
        "你做出了不一样的选择，深入到骗局的最深处，看到了那些不为人知的暗面。这一条线，没有掌声，却让更多人免于跌入同一个深渊。",
      lesson:
        "有些防线，是在沉默中筑起的。愿你在每一个深夜接到陌生电话时，都能想起这一程的所见所闻，多问一句「这是不是骗局」。",
      icon: "🌑",
      color: "#9D4EDD",
      unlockCondition: "在剧情战役中达成特殊隐藏条件（详见成就系统）",
    },
  ],
};

// ===========================================================================
// 辅助查询函数
// ===========================================================================

/**
 * 按关卡 ID 查询关卡定义
 */
export function getStoryStageById(id: string): ThunderStoryStageDef | undefined {
  return THUNDER_STORY_CAMPAIGN.stages.find((s) => s.id === id);
}

/**
 * 按结局 ID 查询结局定义
 */
export function getStoryEndingById(id: string): ThunderStoryEndingDef | undefined {
  return THUNDER_STORY_CAMPAIGN.endings.find((e) => e.id === id);
}

/**
 * 返回所有非支线关卡（isBranch !== true）
 */
export function getMainStages(): ThunderStoryStageDef[] {
  return THUNDER_STORY_CAMPAIGN.stages.filter((s) => !s.isBranch);
}

/**
 * 返回所有支线关卡（isBranch === true）
 */
export function getBranchStages(): ThunderStoryStageDef[] {
  return THUNDER_STORY_CAMPAIGN.stages.filter((s) => s.isBranch === true);
}

/**
 * 根据当前关卡 ID 返回下一关 ID（按章节顺序，无下一关返回 null）
 */
export function getNextStageId(currentStageId: string): string | null {
  const stages = THUNDER_STORY_CAMPAIGN.stages;
  const idx = stages.findIndex((s) => s.id === currentStageId);
  if (idx < 0 || idx + 1 >= stages.length) return null;
  return stages[idx + 1].id;
}

/**
 * 根据已通关关卡 ID 列表，判断指定关卡是否已解锁
 * - 第一章默认解锁
 * - 已通关的关卡视为已解锁
 * - 任一已通关关卡的 unlocksStages 中包含此 ID，则解锁
 */
export function isStageUnlocked(stageId: string, clearedStageIds: string[]): boolean {
  const stages = THUNDER_STORY_CAMPAIGN.stages;
  if (stages.length === 0) return false;
  // 第一章默认解锁
  if (stages[0].id === stageId) return true;
  // 已通关视为已解锁（便于回看 / 复玩）
  if (clearedStageIds.includes(stageId)) return true;
  // 任一前置已通关且其 unlocksStages 包含此 ID
  for (const s of stages) {
    if (s.unlocksStages?.includes(stageId) && clearedStageIds.includes(s.id)) {
      return true;
    }
  }
  return false;
}

/**
 * 根据分数计算评级：S / A / B / C
 * - score >= rankSScore → S
 * - score >= rankAScore → A
 * - score >= rankBScore → B
 * - 其余 → C
 */
export function calcStageRank(
  score: number,
  stage: ThunderStoryStageDef,
): "S" | "A" | "B" | "C" {
  if (score >= stage.rankSScore) return "S";
  if (score >= stage.rankAScore) return "A";
  if (score >= stage.rankBScore) return "B";
  return "C";
}

/**
 * 计算剧情进度
 * - cleared: 已通关关卡数（仅统计属于本战役的关卡）
 * - total: 关卡总数
 * - progress: 进度比 0..1
 */
export function getStoryProgress(clearedStageIds: string[]): {
  cleared: number;
  total: number;
  progress: number;
} {
  const stages = THUNDER_STORY_CAMPAIGN.stages;
  const total = stages.length;
  const clearedSet = new Set(clearedStageIds);
  const cleared = stages.filter((s) => clearedSet.has(s.id)).length;
  const progress = total > 0 ? cleared / total : 0;
  return { cleared, total, progress };
}

// ===========================================================================
// 剧情对白数据（narrative 关卡专用）
// ===========================================================================

/**
 * narrative 关卡对白数据
 * - key: 关卡 ID（如 STORY-04）
 * - value: 对白数组，每条含 speaker 与 text
 */
export const THUNDER_STORY_NARRATIVE_LINES: Record<
  string,
  Array<{ speaker: string; text: string }>
> = {
  "STORY-04": [
    { speaker: "旁白", text: "深夜的指挥部，大屏上跳动着分散在全国各地的报案红点，像一片密密麻麻的星图。" },
    { speaker: "队长", text: "都看看，这是这周的新发案子，三百多起，金额加起来快两个亿。" },
    { speaker: "队员", text: "队长，我们梳理了受害人画像，他们之间毫无交集，但都被同一种套路骗了。" },
    { speaker: "队长", text: "说具体点。" },
    { speaker: "队员", text: "杀猪盘、冒充客服、虚假投资……表面是不同骗术，资金流向却汇到了同一条通道。" },
    { speaker: "队长", text: "也就是说，背后是一只手？" },
    { speaker: "队员", text: "对，最后都流向了境外的同一个园区，国内止付非常困难。" },
    { speaker: "旁白", text: "队长没说话，把烟按灭在烟灰缸里，窗外的霓虹一闪一闪。" },
    { speaker: "队长", text: "通知技术组，调取近三个月的境外来电和资金流水，我要看到每一根线头。" },
    { speaker: "队员", text: "明白。还有——记得提醒大家，96110 来电一定要接，那是反诈预警。" },
    { speaker: "队长", text: "这一次，咱们顺着线头摸过去，把它们一锅端了。" },
    { speaker: "旁白", text: "新一轮的跨境追击，就此拉开序幕。" },
  ],
};

// v7 剧情战役系统数据
