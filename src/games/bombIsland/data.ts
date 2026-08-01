import type { ItemDef, ItemId, ParkTierDef, BombBossDef, WeatherDef, WeatherKind, WeaponDef, WeaponKind, MapLayoutDef, BombDifficultyDef, BombDifficulty, BombModeDef, BombGameMode } from "./types";

/** 9 种反诈道具：点击使用，CD 中无效；使用后对其他道具剩余 CD 折减 CD_REFRESH_PCT */
export const ITEMS: Record<ItemId, ItemDef> = {
  bomb: {
    id: "bomb", name: "反诈炮弹", emoji: "💥", color: "#FFD666",
    desc: "96110 精准爆破园区核心", cd: 8, overdrive: 22, effect: "blast", damageAbs: 100,
  },
  missile: {
    id: "missile", name: "96110 震慑", emoji: "📞", color: "#FF7A1A",
    desc: "反诈热线制导打击·震慑全场", cd: 10, overdrive: 20, effect: "homing", damageAbs: 100,
  },
  fireRain: {
    id: "fireRain", name: "警方突击", emoji: "🚔", color: "#FF5A2A",
    desc: "3 秒警力突击覆盖", cd: 14, overdrive: 18, effect: "fireRain", dpsAbs: 100, duration: 3,
  },
  incendiary: {
    id: "incendiary", name: "银行止付", emoji: "🏦", color: "#E5353B",
    desc: "4 秒冻结资金账户", cd: 12, overdrive: 16, effect: "burnZone", dpsAbs: 100, duration: 4,
  },
  drone: {
    id: "drone", name: "反诈无人机", emoji: "🛰", color: "#00E5FF",
    desc: "5 秒空中巡查扫射", cd: 16, overdrive: 24, effect: "drone", dpsAbs: 80, duration: 5,
  },
  laser: {
    id: "laser", name: "反诈 APP 光束", emoji: "🛡", color: "#B388FF",
    desc: "国家反诈中心扫描光束", cd: 11, overdrive: 18, effect: "laser", damageAbs: 100,
  },
  meteor: {
    id: "meteor", name: "法律铁锤", emoji: "⚖", color: "#FFB020",
    desc: "5 次依法重锤连坠", cd: 15, overdrive: 22, effect: "meteor", damageAbs: 100,
  },
  arrowRain: {
    id: "arrowRain", name: "网络封禁令", emoji: "🚫", color: "#52C41A",
    desc: "2 秒封堵诈骗通道", cd: 13, overdrive: 16, effect: "arrowRain", dpsAbs: 70, duration: 2,
  },
  swords: {
    id: "swords", name: "全民反诈风暴", emoji: "🌐", color: "#00E5FF",
    desc: "全民聚力终极扫荡", cd: 22, overdrive: 40, effect: "swords", damageAbs: 100,
  },
  // ===== v6 新增道具 =====
  signalJam: {
    id: "signalJam", name: "信号屏蔽", emoji: "📡", color: "#9FE3FF",
    desc: "5 秒屏蔽 Boss 反击信号", cd: 18, overdrive: 20, effect: "signalJam", damageAbs: 0, duration: 5,
  },
  airStrike: {
    id: "airStrike", name: "空袭支援", emoji: "🚁", color: "#FF5A2A",
    desc: "6 秒武装直升机扫射", cd: 20, overdrive: 28, effect: "airStrike", dpsAbs: 90, duration: 6,
  },
};

/** 道具栏渲染顺序（自上而下） */
export const ITEM_ORDER: ItemId[] = [
  "bomb", "missile", "fireRain", "incendiary", "drone",
  "laser", "meteor", "arrowRain", "swords",
  // v6 新增
  "signalJam", "airStrike",
];

/** 园区档位：v6 扩展到 5 档（每 2 波升档：妙瓦底 → 缅北 → 总部 → 迪拜 → 西非） */
export const PARK_TIERS: ParkTierDef[] = [
  {
    tier: 0, name: "妙瓦底", subtitle: "MYAWADDY", hpMul: 1.0, repairMul: 1.0, color: "#9FE3FF", structure: "den",
    briefing: {
      scamType: "网络交友诱导投资（杀猪盘）+ 限制人身自由",
      points: [
        "境外高薪招聘 = 电诈陷阱，勿信勿往",
        "网恋对象引导投资/赌博的，几乎都是诈骗",
        "被诱骗至园区应立即联系使馆，拨打 12308",
      ],
    },
  },
  {
    tier: 1, name: "缅北中区", subtitle: "KOKANG", hpMul: 1.5, repairMul: 1.8, color: "#FFB020", structure: "kokang",
    briefing: {
      scamType: "冒充客服 + 网络赌博 + 武装掩护电诈",
      points: [
        "客服主动来电称'注销会员/退款'的都是诈骗",
        "网络赌博十赌十输，后台可操纵输赢",
        "武装集团控制下的电诈窝点将被依法铲除",
      ],
    },
  },
  {
    tier: 2, name: "总部核心", subtitle: "HEADQUARTERS", hpMul: 2.2, repairMul: 2.6, color: "#B388FF", structure: "hq",
    briefing: {
      scamType: "跨境洗钱 + 暗网数据交易 + 投资理财诈骗",
      points: [
        "高收益零风险的投资理财都是诈骗",
        "个人数据被用于精准诈骗，注意保护隐私",
        "跨境电诈首脑将数罪并罚、从重惩处",
      ],
    },
  },
  // ===== v6 新增 2 档 =====
  {
    tier: 3, name: "迪拜园区", subtitle: "DUBAI", hpMul: 2.8, repairMul: 3.2, color: "#FFD666", structure: "dubai",
    briefing: {
      scamType: "白手套洗钱 + 虚拟币变现 + 境外资产转移",
      points: [
        "虚拟货币不是法外之地，链上追溯全程可查",
        "帮诈骗团伙'跑分'换汇 = 掩饰犯罪所得罪",
        "境外资产转移须合规申报，否则涉嫌洗钱",
      ],
    },
  },
  {
    tier: 4, name: "西非园区", subtitle: "WEST AFRICA", hpMul: 3.5, repairMul: 4.0, color: "#52C41A", structure: "wafrica",
    briefing: {
      scamType: "庞氏骗局 + 杀猪盘进阶 + 跨洲诈骗中转",
      points: [
        "承诺保本高息、拉人头返利 = 庞氏骗局",
        "跨国追赃难度大，前期预防比后期追损更重要",
        "西非诈骗集团常以'跨国贸易'为掩护",
      ],
    },
  },
  // ===== v9 新增第 6 档：暗网深渊 =====
  {
    tier: 5, name: "暗网深渊", subtitle: "ABYSS", hpMul: 4.2, repairMul: 4.8, color: "#1DE9B6", structure: "abyss",
    briefing: {
      scamType: "AI 换脸 Deepfake + 虚拟身份伪造 + 元宇宙诈骗",
      points: [
        "AI 换脸/拟声伪造视频索要转账 = 诈骗，务必二次核实",
        "虚拟身份批量伪造用于精准诈骗，警惕陌生身份",
        "元宇宙/NFT 高收益话术多为新型诈骗",
      ],
    },
  },
];

/** 每 2 波升档时的 BOSS 身份（每档 2 个 BOSS，逐波强化） */
export const TIER_BOSSES: Record<ParkTierDef["structure"], BombBossDef[]> = {
  den: [
    {
      bossName: "血汗工厂主",
      identity: "妙瓦底电诈窝点操盘手",
      emoji: "👹",
      pattern: "droneSwarm",
      counterInterval: 8,
      counterShots: 3,
      counterDebuffDur: 2.5,
      skillName: "释放逃跑无人机",
      skillDesc: "每隔 8 秒释放 3 架干扰无人机，命中触发道具失效",
      enrageAt: 0.5,
      enrageMul: 1.6,
      caseStudy: {
        title: "妙瓦底电诈园区：境外高薪招聘陷阱",
        body: "不法分子以'月入数万包吃住'为诱饵，将受害者骗至妙瓦底等境外电诈园区，没收护照、限制人身自由，强迫从事电信诈骗。受害者遭受殴打、电击、关水牢等虐待。",
        hotline: "12308",
        points: [
          "境外高薪招聘信息几乎都是电诈陷阱",
          "被诱骗至园区应立即联系中国驻当地使馆",
          "拨打 12308 领事保护热线 24 小时求助",
        ],
      },
      specialSkill: {
        kind: "cageTrap",
        name: "铁笼困人",
        desc: "妙瓦底电诈园区标志性暴行：没收护照、铁笼关押、限制人身自由，模拟受害者无法逃脱的绝望。",
        triggerAtHpPct: 0.5,
        cooldown: 18,
        duration: 3.0,
        color: "#FF5A2A",
        debuffs: ["cdLock"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "droneSwarm", counterInterval: 8, counterShots: 3, counterDebuffDur: 2.5, phaseName: "阶段一·试探", phaseTransitionText: "血汗工厂主：先放几架无人机试探火力", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "droneSwarm", counterInterval: 6.5, counterShots: 4, counterDebuffDur: 2.8, phaseName: "阶段二·狂暴", phaseTransitionText: "血汗工厂主狂暴！无人机+召唤马仔", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "droneSwarm", counterInterval: 5, counterShots: 5, counterDebuffDur: 3.2, phaseName: "阶段三·殊死", phaseTransitionText: "血汗工厂主殊死顽抗！无人机全开", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 1, count: 2, kind: "fraud-minion", hpEach: 8000, speed: 70, debuffDur: 2.5, rewardScore: 200, rewardOverdrive: 8, announceText: "血汗工厂主召唤电诈马仔袭扰炮兵！" },
    },
    {
      bossName: "话术培训师",
      identity: "妙瓦底诈骗话术教练",
      emoji: "🎭",
      pattern: "commsJamming",
      counterInterval: 7,
      counterShots: 4,
      counterDebuffDur: 2.8,
      skillName: "信号干扰弹幕",
      skillDesc: "释放干扰弹幕触发屏幕扭曲，压制反诈炮兵射速",
      enrageAt: 0.5,
      enrageMul: 1.7,
      caseStudy: {
        title: "杀猪盘话术：网恋交友诱导投资",
        body: "电诈园区话术师编写标准化'养猪'剧本，通过社交平台伪装成成功人士与受害者建立感情，再以'内幕消息/稳赚不赔'诱导投资虚假平台，最终卷款跑路。",
        hotline: "96110",
        points: [
          "网恋对象引导投资/赌博的，几乎都是诈骗",
          "投资平台无法提现时已被骗，应立即报警",
          "96110 来电务必接听，可能正在被骗",
        ],
      },
      specialSkill: {
        kind: "cageTrap",
        name: "铁笼困人·话术强化",
        desc: "话术师以伪造情感困住受害者，叠加信号干扰压制反诈炮兵视野，模拟'被洗脑无法求救'。",
        triggerAtHpPct: 0.55,
        cooldown: 16,
        duration: 3.2,
        color: "#FF7A1A",
        debuffs: ["cdLock", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "commsJamming", counterInterval: 7, counterShots: 4, counterDebuffDur: 2.8, phaseName: "阶段一·话术", phaseTransitionText: "话术培训师：释放信号干扰弹幕", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "commsJamming", counterInterval: 5.5, counterShots: 5, counterDebuffDur: 3.0, phaseName: "阶段二·情感操纵", phaseTransitionText: "话术师升级剧本！干扰+召唤卡农", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "commsJamming", counterInterval: 4.5, counterShots: 6, counterDebuffDur: 3.4, phaseName: "阶段三·全员洗脑", phaseTransitionText: "话术师终极剧本！全员洗脑弹幕", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 1, count: 2, kind: "card-farmer", hpEach: 6500, speed: 90, debuffDur: 2.5, rewardScore: 250, rewardOverdrive: 10, announceText: "话术培训师召唤洗钱卡农转移资金！" },
    },
  ],
  kokang: [
    {
      bossName: "缅北武装头目",
      identity: "缅北中区武装集团首脑",
      emoji: "🔫",
      pattern: "artilleryBarrage",
      counterInterval: 6,
      counterShots: 5,
      counterDebuffDur: 3.0,
      skillName: "重炮齐射",
      skillDesc: "6 秒一次重炮齐射 5 发，命中锁定道具 CD",
      enrageAt: 0.55,
      enrageMul: 1.8,
      caseStudy: {
        title: "缅北武装电诈集团：暴力掩护下的跨境犯罪",
        body: "缅北地区武装集团以武力掩护大规模电诈窝点，配备武装看守防止人员逃脱。该集团涉及网络赌博、冒充客服、投资理财等多种诈骗，案值达数百亿元。",
        hotline: "96110",
        points: [
          "武装集团控制下的电诈窝点将被依法铲除",
          "网络赌博十赌十输，后台可操纵输赢",
          "跨境联合执法持续打击境外电诈集团",
        ],
      },
      specialSkill: {
        kind: "shockJam",
        name: "电击干扰",
        desc: "缅北武装集团以电击酷刑胁迫人员从事电诈，模拟暴力胁迫下的武器压制与视野干扰。",
        triggerAtHpPct: 0.5,
        cooldown: 16,
        duration: 3.0,
        color: "#00E5FF",
        debuffs: ["weaponJam", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "artilleryBarrage", counterInterval: 6, counterShots: 5, counterDebuffDur: 3.0, phaseName: "阶段一·重炮", phaseTransitionText: "缅北武装头目：重炮齐射压制", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "artilleryBarrage", counterInterval: 5, counterShots: 6, counterDebuffDur: 3.3, phaseName: "阶段二·武装反扑", phaseTransitionText: "武装头目反扑！重炮+召唤马仔", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "missileSalvo", counterInterval: 4, counterShots: 7, counterDebuffDur: 3.6, phaseName: "阶段三·全军出击", phaseTransitionText: "武装头目全军出击！导弹覆盖", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 1, count: 3, kind: "fraud-minion", hpEach: 9000, speed: 75, debuffDur: 2.8, rewardScore: 220, rewardOverdrive: 9, announceText: "缅北武装头目派出马仔冲锋！" },
    },
    {
      bossName: "洗钱水房老板",
      identity: "缅北洗钱水房操盘者",
      emoji: "💰",
      pattern: "missileSalvo",
      counterInterval: 5.5,
      counterShots: 6,
      counterDebuffDur: 3.2,
      skillName: "资金外逃导弹",
      skillDesc: "5.5 秒一次 6 发导弹齐射，干扰炮兵武器系统",
      enrageAt: 0.55,
      enrageMul: 1.9,
      caseStudy: {
        title: "洗钱水房：被骗资金的'地下通道'",
        body: "洗钱水房通过'跑分平台'、虚拟货币、购买游戏点卡等方式，将被骗资金层层转移洗白。提供银行卡/收款码帮助转账的'卡农'同样构成犯罪。",
        hotline: "96110",
        points: [
          "出租出借银行卡/收款码是帮助信息网络犯罪",
          "跑分平台兼职 = 协助洗钱，将被追究刑责",
          "发现可疑资金往来应立即向银行举报",
        ],
      },
      specialSkill: {
        kind: "shockJam",
        name: "电击干扰·资金外逃",
        desc: "洗钱水房以电击掩护资金外逃，更强的武器压制叠加视觉干扰，模拟'被骗资金被层层转移'。",
        triggerAtHpPct: 0.55,
        cooldown: 14,
        duration: 3.2,
        color: "#B388FF",
        debuffs: ["weaponJam", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "missileSalvo", counterInterval: 5.5, counterShots: 6, counterDebuffDur: 3.2, phaseName: "阶段一·资金外逃", phaseTransitionText: "洗钱水房老板：导弹齐射掩护资金", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "missileSalvo", counterInterval: 4.5, counterShots: 7, counterDebuffDur: 3.4, phaseName: "阶段二·层层转移", phaseTransitionText: "水房老板加速洗钱！导弹+召唤卡农", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "missileSalvo", counterInterval: 3.5, counterShots: 8, counterDebuffDur: 3.8, phaseName: "阶段三·终极洗白", phaseTransitionText: "水房老板终极洗白！导弹全覆盖", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 2, count: 3, kind: "card-farmer", hpEach: 7500, speed: 100, debuffDur: 3.0, rewardScore: 280, rewardOverdrive: 12, announceText: "洗钱水房老板派出卡农加速转移资金！" },
    },
  ],
  hq: [
    {
      bossName: "跨境电诈首脑",
      identity: "总部核心终极电诈大佬",
      emoji: "👑",
      pattern: "missileSalvo",
      counterInterval: 5,
      counterShots: 7,
      counterDebuffDur: 3.5,
      skillName: "全方位导弹覆盖",
      skillDesc: "5 秒一次 7 发导弹覆盖，装甲修复+多重干扰",
      enrageAt: 0.6,
      enrageMul: 2.0,
      caseStudy: {
        title: "跨境电诈首脑：数罪并罚从重惩处",
        body: "跨境电诈集团首脑组织领导诈骗、非法拘禁、故意伤害、洗钱等多类犯罪，涉案金额巨大、受害者众多。依法将被数罪并罚、从重惩处，最高可判无期徒刑。",
        hotline: "110",
        points: [
          "组织领导电诈集团将数罪并罚、从重惩处",
          "涉案金额特别巨大可判十年以上至无期",
          "主动投案自首、检举立功可依法从轻处理",
        ],
      },
      specialSkill: {
        kind: "deepfake",
        name: "AI 换脸·首脑伪装",
        desc: "跨境电诈首脑使用 AI 换脸深度伪造技术伪装身份，模拟'真假难辨'的高科技迷惑，道具失效+视觉干扰。",
        triggerAtHpPct: 0.5,
        cooldown: 14,
        duration: 3.5,
        color: "#B388FF",
        debuffs: ["itemDisable", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "missileSalvo", counterInterval: 5, counterShots: 7, counterDebuffDur: 3.5, phaseName: "阶段一·首脑威压", phaseTransitionText: "跨境电诈首脑：全方位导弹覆盖", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "missileSalvo", counterInterval: 4, counterShots: 8, counterDebuffDur: 3.7, phaseName: "阶段二·AI伪装", phaseTransitionText: "首脑启动AI换脸！导弹+召唤黑客", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "artilleryBarrage", counterInterval: 3.5, counterShots: 9, counterDebuffDur: 4.0, phaseName: "阶段三·数罪并罚", phaseTransitionText: "首脑绝地顽抗！重炮+导弹混合", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 1, count: 2, kind: "cyber-hacker", hpEach: 7000, speed: 60, debuffDur: 3.0, rewardScore: 350, rewardOverdrive: 14, announceText: "跨境电诈首脑派出黑客学徒远程干扰！" },
    },
    {
      bossName: "暗网数据王",
      identity: "总部暗网数据黑市掌门",
      emoji: "🕸",
      pattern: "artilleryBarrage",
      counterInterval: 4.5,
      counterShots: 8,
      counterDebuffDur: 3.8,
      skillName: "数据洪流重炮",
      skillDesc: "4.5 秒一次 8 发重炮，火力压制+全屏干扰",
      enrageAt: 0.6,
      enrageMul: 2.1,
      caseStudy: {
        title: "暗网数据黑市：你的信息正在被售卖",
        body: "电诈集团通过黑客攻击、内鬼倒卖等方式窃取个人信息，在暗网批量出售。买家利用这些数据实施精准诈骗，如冒充公检法、冒充熟人借款等。",
        hotline: "96110",
        points: [
          "个人数据被用于精准诈骗，注意保护隐私",
          "快递单/身份证/银行卡信息切勿随意泄露",
          "接到'熟人'借款电话务必二次核实身份",
        ],
      },
      specialSkill: {
        kind: "deepfake",
        name: "AI 换脸·数据克隆",
        desc: "暗网数据王利用窃取的个人信息批量克隆身份，更强的道具失效叠加视觉干扰，模拟'身份被盗用'的精准诈骗。",
        triggerAtHpPct: 0.55,
        cooldown: 12,
        duration: 3.8,
        color: "#9FE3FF",
        debuffs: ["itemDisable", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "artilleryBarrage", counterInterval: 4.5, counterShots: 8, counterDebuffDur: 3.8, phaseName: "阶段一·数据洪流", phaseTransitionText: "暗网数据王：重炮齐发数据洪流", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "artilleryBarrage", counterInterval: 3.5, counterShots: 9, counterDebuffDur: 4.0, phaseName: "阶段二·身份克隆", phaseTransitionText: "数据王批量克隆身份！重炮+召唤黑客", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "missileSalvo", counterInterval: 3, counterShots: 10, counterDebuffDur: 4.2, phaseName: "阶段三·暗网风暴", phaseTransitionText: "数据王掀起暗网风暴！导弹全覆盖", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 2, count: 3, kind: "cyber-hacker", hpEach: 8000, speed: 65, debuffDur: 3.2, rewardScore: 400, rewardOverdrive: 16, announceText: "暗网数据王派出黑客学徒全屏干扰！" },
    },
  ],
  // ===== v6 新增：迪拜园区 2 Boss =====
  dubai: [
    {
      bossName: "白手套金融师",
      identity: "迪拜园区虚拟币洗钱操盘手",
      emoji: "💎",
      pattern: "missileSalvo",
      counterInterval: 4.5,
      counterShots: 7,
      counterDebuffDur: 3.5,
      skillName: "资金外逃导弹",
      skillDesc: "4.5 秒一次 7 发导弹，掩护资金链上转移",
      enrageAt: 0.55,
      enrageMul: 2.0,
      caseStudy: {
        title: "虚拟币洗钱：链上不是法外之地",
        body: "迪拜园区通过虚拟货币混币器、跨链桥、OTC 商户将被骗资金洗白。提供 USDT 帮助换汇的'跑分客'同样涉嫌掩饰、隐瞒犯罪所得罪，最高可判 7 年有期徒刑。",
        hotline: "96110",
        points: [
          "虚拟货币交易全链路可追溯，不要心存侥幸",
          "出借钱包地址帮人收款 = 协助洗钱",
          "境外资产转移须合规申报，否则涉嫌洗钱罪",
        ],
      },
      specialSkill: {
        kind: "moneyLaunder",
        name: "白手套洗钱",
        desc: "迪拜园区以虚拟币混币器洗白资金，模拟'资金被层层转移'的过载槽倒扣与金流粒子视觉。",
        triggerAtHpPct: 0.5,
        cooldown: 14,
        duration: 3.5,
        color: "#FFD666",
        debuffs: ["overdriveDrain", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "missileSalvo", counterInterval: 4.5, counterShots: 7, counterDebuffDur: 3.5, phaseName: "阶段一·资金入库", phaseTransitionText: "白手套金融师：资金开始链上转移", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "missileSalvo", counterInterval: 3.5, counterShots: 8, counterDebuffDur: 3.7, phaseName: "阶段二·混币洗白", phaseTransitionText: "金融师启动混币器！导弹+召唤币圈中介", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "artilleryBarrage", counterInterval: 3, counterShots: 9, counterDebuffDur: 4.0, phaseName: "阶段三·境外消失", phaseTransitionText: "金融师终极洗白！资金全境外消失", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 1, count: 3, kind: "coin-broker", hpEach: 7500, speed: 110, debuffDur: 3.0, rewardScore: 320, rewardOverdrive: 14, announceText: "白手套金融师派出币圈中介吸走过载！" },
    },
    {
      bossName: "币圈操盘手",
      identity: "迪拜虚拟币操盘庄家",
      emoji: "₿",
      pattern: "artilleryBarrage",
      counterInterval: 4,
      counterShots: 8,
      counterDebuffDur: 3.7,
      skillName: "拉盘砸盘重炮",
      skillDesc: "4 秒一次 8 发重炮，模拟币价剧烈波动",
      enrageAt: 0.55,
      enrageMul: 2.1,
      caseStudy: {
        title: "虚拟币杀猪盘：拉盘砸盘收割散户",
        body: "币圈操盘手通过控制虚拟币价格'拉盘-砸盘'，配合杀猪盘话术诱导投资者高位接盘。最终散户血本无归，操盘方卷款跑路。我国禁止虚拟币交易业务，参与即风险自担。",
        hotline: "96110",
        points: [
          "我国明确禁止虚拟币交易业务，无'合法平台'",
          "稳赚不赔的炒币信号 = 杀猪盘前兆",
          "境外钱包一旦转账，资金几乎无法追回",
        ],
      },
      specialSkill: {
        kind: "moneyLaunder",
        name: "白手套洗钱·币圈收割",
        desc: "币圈操盘手以拉盘砸盘掩护资金外逃，更强的过载倒扣叠加视觉干扰，模拟'散户被收割'。",
        triggerAtHpPct: 0.55,
        cooldown: 12,
        duration: 3.8,
        color: "#FF7A1A",
        debuffs: ["overdriveDrain", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "artilleryBarrage", counterInterval: 4, counterShots: 8, counterDebuffDur: 3.7, phaseName: "阶段一·拉盘诱惑", phaseTransitionText: "币圈操盘手：拉盘信号引诱跟风", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "artilleryBarrage", counterInterval: 3, counterShots: 9, counterDebuffDur: 4.0, phaseName: "阶段二·砸盘收割", phaseTransitionText: "操盘手砸盘收割！重炮+召唤币圈中介", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "missileSalvo", counterInterval: 2.5, counterShots: 10, counterDebuffDur: 4.3, phaseName: "阶段三·币归零", phaseTransitionText: "操盘手终极砸盘！币价归零跑路", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 2, count: 4, kind: "coin-broker", hpEach: 8500, speed: 120, debuffDur: 3.3, rewardScore: 380, rewardOverdrive: 18, announceText: "币圈操盘手派出币圈中介全屏吸过载！" },
    },
  ],
  // ===== v6 新增：西非园区 2 Boss =====
  wafrica: [
    {
      bossName: "庞氏主谋",
      identity: "西非庞氏骗局操盘者",
      emoji: "🎭",
      pattern: "commsJamming",
      counterInterval: 4,
      counterShots: 8,
      counterDebuffDur: 3.8,
      skillName: "崩盘抽底",
      skillDesc: "4 秒一次 8 发干扰，连击重置压制玩家节奏",
      enrageAt: 0.55,
      enrageMul: 2.0,
      caseStudy: {
        title: "庞氏骗局：拆东墙补西墙的必崩局",
        body: "庞氏骗局以'保本高息'为饵，用后入局者的钱支付前人的'收益'，制造赚钱假象。一旦新资金跟不上，整个盘面崩盘，操盘者卷款跑路。我国以集资诈骗罪论处，最高可判无期。",
        hotline: "96110",
        points: [
          "承诺保本高息、拉人头返利 = 庞氏骗局",
          "收益来自后入局者本金 = 必然崩盘",
          "境外操盘者卷款跑路，跨国追赃难度大",
        ],
      },
      specialSkill: {
        kind: "ponziTrap",
        name: "庞氏收割",
        desc: "庞氏主谋以崩盘抽底收割散户，连击重置+红色崩盘视觉，模拟'盘面崩塌'的玩家节奏断裂。",
        triggerAtHpPct: 0.5,
        cooldown: 13,
        duration: 3.5,
        color: "#E5353B",
        debuffs: ["comboBreak", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "commsJamming", counterInterval: 4, counterShots: 8, counterDebuffDur: 3.8, phaseName: "阶段一·保本诱惑", phaseTransitionText: "庞氏主谋：保本高息拉人头", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "commsJamming", counterInterval: 3, counterShots: 9, counterDebuffDur: 4.0, phaseName: "阶段二·拉人扩张", phaseTransitionText: "主谋扩张盘面！干扰+召唤假主播", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "missileSalvo", counterInterval: 2.5, counterShots: 10, counterDebuffDur: 4.3, phaseName: "阶段三·崩盘跑路", phaseTransitionText: "主谋终极崩盘！资金全消失", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 1, count: 3, kind: "live-streamer", hpEach: 7000, speed: 95, debuffDur: 3.0, rewardScore: 360, rewardOverdrive: 15, announceText: "庞氏主谋派出假主播直播干扰连击！" },
    },
    {
      bossName: "跨洲中转王",
      identity: "西非跨洲诈骗中转操盘者",
      emoji: "🌍",
      pattern: "missileSalvo",
      counterInterval: 3.5,
      counterShots: 9,
      counterDebuffDur: 4.0,
      skillName: "跨洲资金流",
      skillDesc: "3.5 秒一次 9 发导弹，模拟跨洲资金中转",
      enrageAt: 0.6,
      enrageMul: 2.2,
      caseStudy: {
        title: "跨洲诈骗中转：犯罪链条全球化",
        body: "跨洲中转王以'跨国贸易'为掩护，将诈骗资金经多个国家中转洗白，并协调各地诈骗团伙分工。我国与多国建立反诈执法合作机制，联合打击跨境电诈，引渡首脑归案。",
        hotline: "110",
        points: [
          "跨国电诈集团首脑将被引渡回国受审",
          "跨国贸易合同须核实对方资质与资金来源",
          "联合执法持续推进，跨境电诈无处遁形",
        ],
      },
      specialSkill: {
        kind: "ponziTrap",
        name: "庞氏收割·跨洲中转",
        desc: "跨洲中转王以多国中转掩护资金消失，更强的连击重置+视觉干扰，模拟'资金跨洲消失'。",
        triggerAtHpPct: 0.55,
        cooldown: 11,
        duration: 3.8,
        color: "#FF5A2A",
        debuffs: ["comboBreak", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "missileSalvo", counterInterval: 3.5, counterShots: 9, counterDebuffDur: 4.0, phaseName: "阶段一·跨洲入库", phaseTransitionText: "跨洲中转王：资金多国中转", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "missileSalvo", counterInterval: 2.8, counterShots: 10, counterDebuffDur: 4.2, phaseName: "阶段二·多链洗白", phaseTransitionText: "中转王加速跨洲转移！导弹+召唤币圈中介", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "artilleryBarrage", counterInterval: 2.2, counterShots: 11, counterDebuffDur: 4.5, phaseName: "阶段三·全球蒸发", phaseTransitionText: "中转王终极洗白！资金全球蒸发", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 2, count: 4, kind: "coin-broker", hpEach: 9000, speed: 125, debuffDur: 3.5, rewardScore: 420, rewardOverdrive: 20, announceText: "跨洲中转王派出币圈中介跨洲吸过载！" },
    },
  ],
  // ===== v9 新增第 6 档：暗网深渊 Boss =====
  abyss: [
    {
      bossName: "AI 换脸师",
      identity: "暗网深渊 Deepfake 伪造首脑",
      emoji: "🤖",
      pattern: "commsJamming",
      counterInterval: 5.5,
      counterShots: 5,
      counterDebuffDur: 3.0,
      skillName: "Deepfake 全息伪装",
      skillDesc: "AI 换脸伪装熟人来电索款，每 5.5 秒释放 5 枚干扰弹，命中触发视觉干扰",
      enrageAt: 0.5,
      enrageMul: 1.6,
      caseStudy: {
        title: "AI 换脸诈骗：眼见不再为实",
        body: "犯罪团伙利用 AI 换脸/拟声技术伪造亲友、领导视频或语音，在短时间内诱导受害者转账。视频通话中'本人'也可能是深度伪造，务必通过原有渠道二次核实。",
        hotline: "96110",
        points: [
          "视频通话也可能是 AI 换脸，务必二次核实",
          "AI 仿声可模仿亲人声音，挂断回拨原号核实",
          "任何'紧急转账'都先冷静核实身份",
        ],
      },
      specialSkill: {
        kind: "deepfake", name: "Deepfake 全息伪装", desc: "AI 换脸伪造熟人身份索款，触发道具失效+视觉干扰",
        triggerAtHpPct: 0.7, cooldown: 14, duration: 5, color: "#1DE9B6",
        debuffs: ["itemDisable", "visionJam"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "commsJamming", counterInterval: 5.5, counterShots: 5, counterDebuffDur: 3.0, phaseName: "阶段一·换脸试探", phaseTransitionText: "AI 换脸师：伪造熟人身份试探转账", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "droneSwarm", counterInterval: 4.0, counterShots: 6, counterDebuffDur: 3.5, phaseName: "阶段二·批量伪造", phaseTransitionText: "换脸师批量伪造身份！无人机+召唤假主播", enrageMul: 1.3 },
        { phase: 2, hpPct: 0.3, pattern: "missileSalvo", counterInterval: 3.0, counterShots: 8, counterDebuffDur: 4.0, phaseName: "阶段三·全息崩坏", phaseTransitionText: "换脸师终极全息伪装！多链伪造轰炸", enrageMul: 1.6 },
      ],
      summon: { triggerPhase: 1, count: 3, kind: "live-streamer", hpEach: 8200, speed: 110, debuffDur: 3.0, rewardScore: 380, rewardOverdrive: 18, announceText: "AI 换脸师派出假主播直播干扰连击！" },
    },
    {
      bossName: "身份铸造师",
      identity: "暗网深渊虚拟身份批发首脑",
      emoji: "🎭",
      pattern: "artilleryBarrage",
      counterInterval: 5.0,
      counterShots: 6,
      counterDebuffDur: 3.2,
      skillName: "身份熔炉",
      skillDesc: "批量伪造虚拟身份用于精准诈骗，每 5 秒 6 发弹幕，命中触发 CD 锁定",
      enrageAt: 0.5,
      enrageMul: 1.7,
      caseStudy: {
        title: "虚拟身份黑产：精准诈骗的源头",
        body: "身份铸造师批量伪造身份证、银行卡、社交账号，售予电诈团伙实施精准诈骗。提供伪造身份材料将构成伪造身份证件罪、帮助信息网络犯罪活动罪，数罪并罚。",
        hotline: "110",
        points: [
          "出售/提供伪造身份材料构成犯罪",
          "出租出借银行卡/身份证 = 帮信罪",
          "精准诈骗背后是个人信息黑产链",
        ],
      },
      specialSkill: {
        kind: "moneyLaunder", name: "身份熔炉", desc: "批量伪造身份洗白诈骗资金，触发过载倒扣+金流粒子",
        triggerAtHpPct: 0.65, cooldown: 12, duration: 5, color: "#1DE9B6",
        debuffs: ["overdriveDrain", "cdLock"],
      },
      phases: [
        { phase: 0, hpPct: 1.0, pattern: "artilleryBarrage", counterInterval: 5.0, counterShots: 6, counterDebuffDur: 3.2, phaseName: "阶段一·身份熔铸", phaseTransitionText: "身份铸造师：批量伪造身份材料", enrageMul: 1.0 },
        { phase: 1, hpPct: 0.6, pattern: "commsJamming", counterInterval: 3.5, counterShots: 7, counterDebuffDur: 3.8, phaseName: "阶段二·精准投毒", phaseTransitionText: "铸造师精准投毒！通信干扰+召唤黑客", enrageMul: 1.4 },
        { phase: 2, hpPct: 0.3, pattern: "missileSalvo", counterInterval: 2.5, counterShots: 9, counterDebuffDur: 4.2, phaseName: "阶段三·黑产崩塌", phaseTransitionText: "铸造师终极崩塌！身份黑产全链摧毁", enrageMul: 1.7 },
      ],
      summon: { triggerPhase: 2, count: 4, kind: "cyber-hacker", hpEach: 8800, speed: 115, debuffDur: 3.2, rewardScore: 400, rewardOverdrive: 20, announceText: "身份铸造师派出黑客学徒远程干扰！" },
    },
  ],
};

/** 取当前波次的 BOSS 定义（按 tier 和波次内序号循环） */
export function getBossForWave(wave: number): BombBossDef {
  const tier = getTierForWave(wave);
  const list = TIER_BOSSES[tier.structure];
  // 每 2 波升档，档位内 2 个 BOSS 轮换（wave-1）% 2
  const idx = (wave - 1) % list.length;
  return list[idx];
}

export function getTierForWave(wave: number): ParkTierDef {
  const idx = Math.min(PARK_TIERS.length - 1, Math.floor((wave - 1) / 2));
  return PARK_TIERS[idx];
}

/** 武器升级曲线：每清一波 +1 级，影响射速与伤害 */
export const WEAPON_BASE_INTERVAL = 0.18; // 升级：基础射速更快（原 0.25 → 0.18）
/** 每级射速提升比例（0.10 = 每级 +10% 射速，原 0.08） */
export const WEAPON_FIRE_GAIN_PER_LV = 0.10;
/** 武器最高等级 */
export const WEAPON_MAX_LEVEL = 10;

export function weaponFireInterval(level: number): number {
  const lv = Math.min(WEAPON_MAX_LEVEL, Math.max(1, level));
  return WEAPON_BASE_INTERVAL / (1 + (lv - 1) * WEAPON_FIRE_GAIN_PER_LV);
}

/**
 * 炮兵生命系统已移除（纯无尽模式）：炮兵不可被伤害。
 * 保留常量向后兼容，实际不再使用。
 */
export const CANNON_MAX_HP = 100;
export const CANNON_REGEN = 0;

// ============ 数值调参（爽感强化：高血量 + 自回血 + 废墟可重建） ============
// v3 升级：建筑血量提升 3 倍，自回血提升 2 倍，废墟随血条回复逐步重建

export const BASE_MAX_HP = 2_400_000; // 升血量×3：建筑血量很高（原 800_000 → 2_400_000）
export const BASE_REPAIR = 6000;      // 升修复×2：配合高血量让回血可见（原 3000 → 6000）
/** 每波 maxHP / repair 递增系数 */
export const WAVE_HP_GROWTH = 0.10;
export const WAVE_REPAIR_GROWTH = 0.10;

/**
 * 废墟重建触发阈值：当园区总 HP 占比 > 该值时，多余修复量进入"废墟重建池"。
 * 设计意图：玩家拆光一半模块后必须持续输出，否则园区会逐步重建已被拆除的模块，
 * 形成"打不死就回血"的压迫感与持续输出爽感。
 */
export const REBUILD_THRESHOLD = 0.55;
/** 废墟重建速率倍率（相对 BASE_REPAIR，控制单个废墟从 0→1 重建所需时间） */
export const REBUILD_RATE_MUL = 0.6;
/** 同屏最多并行重建的废墟数（避免一波全重建造成"打不完"的挫败感） */
export const REBUILD_MAX_PARALLEL = 2;

/** 使用道具 → 其他道具剩余 CD 折减比例 */
export const CD_REFRESH_PCT = 0.40;   // 升级：CD 折减更多（原 0.35 → 0.40）

/** 过载连击槽 */
export const OVERDRIVE_MAX = 100;
export const OVERDRIVE_DECAY = 8;     // 升级：衰减更慢（原 10 → 8）
export const OVERDRIVE_DURATION = 5;  // 升级：过载更久（原 4 → 5）
export const OVERDRIVE_FIRE_MULT = 3.0; // 升级：射速倍率更高（原 2.5 → 3.0）
export const OVERDRIVE_DMG_MULT = 2.5;  // 升级：伤害倍率更高（原 2.0 → 2.5）

/** 反诈炮兵自动发射（爽感强化：基础射速更快、多管齐射） */
export const BASE_FIRE_INTERVAL = 0.18; // s (≈5.5 发/秒，原 0.25)
export const SHELL_DAMAGE_PCT = 0.06;   // 每发占 maxHP 百分比（原 0.05）
export const SHELL_OVERDRIVE_GAIN = 3;  // 每发过载充能（原 2）
/** 多管齐射：每次发射的并行炮弹数（随武器等级递增） */
export const MULTISHOT_BASE = 1;
export const MULTISHOT_PER_LV = 0.4;    // 每级 +0.4 管，向取整靠拢
/** 取指定武器等级的多管数 */
export function multishotCount(level: number): number {
  const lv = Math.min(WEAPON_MAX_LEVEL, Math.max(1, level));
  return MULTISHOT_BASE + Math.floor((lv - 1) * MULTISHOT_PER_LV);
}

/**
 * 逃脱进度系统已移除（纯无尽模式）：玩家不会失败。
 * 保留常量向后兼容，escape 始终为 0。
 */
export const K_ESCAPE = 0;

export function maxHpForWave(wave: number): number {
  const tier = getTierForWave(wave);
  return Math.round(BASE_MAX_HP * tier.hpMul * (1 + (wave - 1) * WAVE_HP_GROWTH));
}

export function repairForWave(wave: number): number {
  const tier = getTierForWave(wave);
  return BASE_REPAIR * tier.repairMul * (1 + (wave - 1) * WAVE_REPAIR_GROWTH);
}

// ============ 模块 HP 基准（per-module，区别于 maxHpForWave 的园区总 HP） ============

/** 大型模块 HP 倍率（= baseHp，保留导出供 engine 兼容） */
export const MODULE_HP_LARGE = 1.0;
/** 中型模块 HP 倍率（电诈工位/苦工宿舍） */
export const MODULE_HP_MEDIUM_MUL = 0.6;
/** 小型模块 HP 倍率（信号塔/铁丝网/地基） */
export const MODULE_HP_SMALL_MUL = 0.3;

/** 每模块基础 HP：按波次/档位递增。园区总 HP = 各模块 HP 之和。 */
export function moduleHpBaseForWave(wave: number): number {
  const tier = getTierForWave(wave);
  // v3：模块基础 HP ×3（原 5000 → 15000），营造"建筑血量很高"的爽感
  return Math.round(15000 * tier.hpMul * (1 + (wave - 1) * WAVE_HP_GROWTH));
}

// ============ 过载多管加成 ============

/** 过载期间额外多管数 */
export const OVERDRIVE_MULTISHOT_BONUS = 2;

// ============ 绝对伤害值（engine 兼容：引擎以绝对值扣减模块 HP，封顶 100） ============

/** 武器单发绝对伤害（随等级递增，engine 端封顶 100） */
export function weaponDamageAbs(level: number): number {
  const lv = Math.min(WEAPON_MAX_LEVEL, Math.max(1, level));
  return Math.round(80 + (lv - 1) * 2.2);
}

/** 集束弹主爆破绝对伤害 */
export const CLUSTER_MAIN_DMG = 80;
/** 集束弹子爆破绝对伤害 */
export const CLUSTER_SUB_DMG = 50;
/** 电磁弹绝对伤害 */
export const EMP_DMG_ABS = 80;
/** 燃烧弹初始绝对伤害 */
export const INCENDIARY_DMG_ABS = 60;
/** 燃烧区每秒绝对 DPS */
export const INCENDIARY_ZONE_DPS = 50;

// ============ BOSS 反击干扰系统（不伤害炮兵，触发 debuff） ============

/** 各反击模式对应的 debuff 类型 */
export const PATTERN_DEBUFF: Record<BombBossDef["pattern"], import("./types").CounterDebuff> = {
  droneSwarm: "itemDisable",
  artilleryBarrage: "cdLock",
  commsJamming: "visionJam",
  missileSalvo: "weaponJam",
};

/** 各 debuff 的中文名 */
export const DEBUFF_NAMES: Record<import("./types").CounterDebuff, string> = {
  cdLock: "道具 CD 锁定",
  weaponJam: "武器射速压制",
  itemDisable: "道具失效",
  visionJam: "屏幕干扰",
  // v6 新增
  overdriveDrain: "过载倒扣",
  comboBreak: "连击重置",
};

/** 各 debuff 的 emoji */
export const DEBUFF_EMOJIS: Record<import("./types").CounterDebuff, string> = {
  cdLock: "🔒",
  weaponJam: "🔫",
  itemDisable: "🚫",
  visionJam: "👁",
  // v6 新增
  overdriveDrain: "💧",
  comboBreak: "💔",
};

/** 武器干扰时的射速倍率（0.5 = 射速减半） */
export const WEAPON_JAM_FIRE_MUL = 0.5;

// ============ 天气系统 ============

/** 4 种天气定义：影响炮兵射速 / 园区修复 / BOSS 反击 / 炮弹伤害 / 道具 CD */
export const WEATHERS: Record<WeatherKind, WeatherDef> = {
  sunny: {
    id: "sunny",
    name: "烈日",
    emoji: "☀",
    desc: "园区修复 +50% · 炮兵射速 +20%",
    color: "#FFB020",
    fireRateMul: 1.2,
    repairMul: 1.5,
    counterMul: 1.0,
    shellDmgMul: 1.0,
    cdMul: 1.0,
    escapeMul: 1.0,
  },
  storm: {
    id: "storm",
    name: "暴雨",
    emoji: "🌧",
    desc: "炮兵射速 -20% · 道具 CD -20%",
    color: "#5AB8FF",
    fireRateMul: 0.8,
    repairMul: 1.0,
    counterMul: 1.0,
    shellDmgMul: 1.0,
    cdMul: 0.8,
    escapeMul: 1.0,
  },
  thunder: {
    id: "thunder",
    name: "雷暴",
    emoji: "⛈",
    desc: "BOSS 反击 +30% · 炮弹伤害 +20%",
    color: "#B388FF",
    fireRateMul: 1.0,
    repairMul: 1.0,
    counterMul: 1.3,
    shellDmgMul: 1.2,
    cdMul: 1.0,
    escapeMul: 1.0,
  },
  fog: {
    id: "fog",
    name: "浓雾",
    emoji: "🌫",
    desc: "炮弹伤害 -15% · BOSS 反击 -30%",
    color: "#9FE3FF",
    fireRateMul: 1.0,
    repairMul: 1.0,
    counterMul: 0.7,
    shellDmgMul: 0.85,
    cdMul: 1.0,
    escapeMul: 1.0,
  },
  // ===== v6 新增天气 =====
  sandstorm: {
    id: "sandstorm",
    name: "沙尘暴",
    emoji: "🌪",
    desc: "视野受限 · 道具 CD +30% · 炮兵射速 +15%",
    color: "#D9A066",
    fireRateMul: 1.15,
    repairMul: 1.0,
    counterMul: 1.1,
    shellDmgMul: 0.95,
    cdMul: 1.3,
    escapeMul: 1.0,
  },
  aurora: {
    id: "aurora",
    name: "极光",
    emoji: "🌌",
    desc: "炮弹伤害 +25% · 过载充能 +50%",
    color: "#52C41A",
    fireRateMul: 1.0,
    repairMul: 0.9,
    counterMul: 0.9,
    shellDmgMul: 1.25,
    cdMul: 1.0,
    escapeMul: 1.0,
  },
};

const WEATHER_LIST: WeatherKind[] = ["sunny", "storm", "thunder", "fog", "sandstorm", "aurora"];

/**
 * 根据波次选择天气：每 2 波切换一次（奇数波同上一波，偶数波换新）
 * wave 1-2: 随机一种；wave 3-4: 换另一种；依次类推
 */
let lastWeatherIdx = -1;
export function pickWeather(wave: number): WeatherDef {
  const phase = Math.floor((wave - 1) / 2);
  // 同一 phase 内天气固定；进入新 phase 时换一种（避免连续相同）
  if (phase === 0 && lastWeatherIdx === -1) {
    lastWeatherIdx = Math.floor(Math.random() * WEATHER_LIST.length);
  } else if (phase > 0 && wave % 2 === 1) {
    // 新 phase 第一波：换一种不同的天气
    let idx = lastWeatherIdx;
    while (idx === lastWeatherIdx) {
      idx = Math.floor(Math.random() * WEATHER_LIST.length);
    }
    lastWeatherIdx = idx;
  }
  return WEATHERS[WEATHER_LIST[lastWeatherIdx]];
}

/** 重置天气状态（用于 retry） */
export function resetWeather(): void {
  lastWeatherIdx = -1;
}

// ============ 武器系统 ============

/** v6 6 种武器：标准弹 / 集束弹 / 电磁弹 / 燃烧弹 / 激光炮 / 导弹雨 */
export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  standard: {
    id: "standard", name: "标准弹", emoji: "🎯", color: "#FFD666",
    desc: "中型爆破·无限弹药", maxAmmo: -1,
  },
  cluster: {
    id: "cluster", name: "集束弹", emoji: "🎇", color: "#FF7A1A",
    desc: "分裂 3 发子爆破·大范围", maxAmmo: 5,
  },
  emp: {
    id: "emp", name: "电磁弹", emoji: "⚡", color: "#00E5FF",
    desc: "减速敌人 2 秒·电磁脉冲", maxAmmo: 5,
  },
  incendiary: {
    id: "incendiary", name: "燃烧弹", emoji: "🔥", color: "#E5353B",
    desc: "3 秒燃烧区持续伤害", maxAmmo: 5,
  },
  // ===== v6 新增武器 =====
  laserCannon: {
    id: "laserCannon", name: "激光炮", emoji: "🔫", color: "#B388FF",
    desc: "穿透多模块·即时光束", maxAmmo: 4,
  },
  missileRain: {
    id: "missileRain", name: "导弹雨", emoji: "🎆", color: "#FF5A2A",
    desc: "区域饱和·6 发导弹覆盖", maxAmmo: 3,
  },
};

/** 武器渲染顺序（自左向右） */
export const WEAPON_ORDER: WeaponKind[] = ["standard", "cluster", "emp", "incendiary", "laserCannon", "missileRain"];

/** 特殊武器初始弹药 */
export const SPECIAL_WEAPON_START_AMMO = 5;

/** 集束弹子爆破数 */
export const CLUSTER_SUB_COUNT = 3;
/** 集束弹子爆破偏移半径（像素） */
export const CLUSTER_SUB_OFFSET = 38;
/** 集束弹主爆破伤害倍率（相对标准） */
export const CLUSTER_MAIN_DMG_MULT = 0.3;
/** 集束弹子爆破伤害倍率（相对标准） */
export const CLUSTER_SUB_DMG_MULT = 0.3;

/** 电磁弹减速持续秒数 */
export const EMP_SLOW_DURATION = 2;
/** 电磁弹减速时园区修复倍率（0.3 = 修复降至 30%） */
export const EMP_REPAIR_MUL = 0.3;
/** 电磁弹减速时 BOSS 反击间隔倍率（1.8 = 反击变慢 80%） */
export const EMP_COUNTER_MUL = 1.8;
/** 电磁弹直接伤害倍率（相对标准） */
export const EMP_DMG_MULT = 0.5;

/** 燃烧弹区域持续秒数 */
export const INCENDIARY_ZONE_DURATION = 3;
/** 燃烧弹每秒伤害（占 maxHP 百分比） */
export const INCENDIARY_ZONE_DPS_PCT = 1.2;
/** 燃烧弹初始伤害倍率（相对标准） */
export const INCENDIARY_DMG_MULT = 0.4;

// ============ 公园地图系统 ============

/** 树木生命值 */
export const TREE_MAX_HP = 60;
/** 树木碰撞半径（像素） */
export const TREE_RADIUS = 18;
/** 玩家炮弹对树木单发伤害 */
export const TREE_DMG_PER_SHELL = 30;
/** BOSS 反击弹对树木单发伤害 */
export const TREE_DMG_PER_COUNTER = 15;

/** 3 种公园地图布局，每 MAP_CYCLE 波切换一次（循环） */
export const MAP_LAYOUTS: MapLayoutDef[] = [
  {
    id: "central", name: "中央公园", emoji: "🌳",
    // 开阔中央：树木环绕四周，中央留空
    trees: [
      { x: 240, y: 180 }, { x: 480, y: 130 }, { x: 620, y: 130 },
      { x: 880, y: 180 }, { x: 240, y: 360 }, { x: 880, y: 360 },
    ],
  },
  {
    id: "avenue", name: "林荫大道", emoji: "🛣",
    // 中央纵向林荫：树木沿中线排成大道
    trees: [
      { x: 490, y: 150 }, { x: 510, y: 200 }, { x: 490, y: 250 },
      { x: 510, y: 300 }, { x: 490, y: 350 }, { x: 510, y: 400 },
    ],
  },
  {
    id: "checker", name: "棋盘绿地", emoji: "🔲",
    // 棋盘格阵：交替排列的树木方阵
    trees: [
      { x: 280, y: 180 }, { x: 580, y: 180 }, { x: 880, y: 180 },
      { x: 430, y: 280 }, { x: 730, y: 280 },
      { x: 280, y: 380 }, { x: 580, y: 380 }, { x: 880, y: 380 },
    ],
  },
];

/** 地图切换周期（每 N 波换地图） */
export const MAP_CYCLE = 3;
/** 地图切换动画持续秒数 */
export const MAP_TRANSITION_DURATION = 1.5;

/** 根据波次取地图布局（循环切换） */
export function getMapForWave(wave: number): MapLayoutDef {
  const idx = Math.floor((wave - 1) / MAP_CYCLE) % MAP_LAYOUTS.length;
  return MAP_LAYOUTS[idx];
}

// ============ 模块知识点：拆除特定模块时飘字显示反诈知识 ============

/** 各模块类型对应的反诈知识点（拆除时飘字提示） */
export const MODULE_KNOWLEDGE: Record<string, { tip: string; color: string }> = {
  cage:       { tip: "限制人身自由是犯罪行为", color: "#FF5A2A" },
  cell:       { tip: "非法拘禁可处三年以下有期徒刑", color: "#FF5A2A" },
  shock:      { tip: "暴力胁迫参与电诈从重处罚", color: "#00E5FF" },
  guard:      { tip: "武装掩护电诈是加重情节", color: "#E5353B" },
  dorm:       { tip: "诱骗他人出境参与电诈将追责", color: "#FFB020" },
  floor:      { tip: "诈骗金额越大刑期越长", color: "#FFD666" },
  antenna:    { tip: "伪基站/GOIP 设备是犯罪工具", color: "#00E5FF" },
  fortress:   { tip: "组织者将数罪并罚", color: "#B388FF" },
  wall:       { tip: "明知电诈仍提供帮助是共犯", color: "#9FE3FF" },
  foundation: { tip: "电诈园区将被依法取缔", color: "#52C41A" },
  server:     { tip: "提供技术支持构成帮助犯", color: "#00E5FF" },
  // ===== v6 新增模块知识点 =====
  liveRoom:   { tip: "虚假直播带货构成诈骗罪", color: "#FF7A1A" },
  casino:     { tip: "开设赌场罪最高可判十年", color: "#E5353B" },
  darkweb:    { tip: "非法获取/出售个人信息罪", color: "#B388FF" },
  minefarm:   { tip: "帮洗钱可能构成掩饰犯罪所得罪", color: "#FFD666" },
  // ===== v9 新增模块知识点（暗网深渊档位） =====
  aiFactory:  { tip: "AI 换脸/拟声伪造可构成诈骗共犯", color: "#FF5A60" },
  idForge:    { tip: "伪造身份信息用于诈骗将从重处罚", color: "#B388FF" },
};

// ============ v5 模块 → 反诈图鉴映射（累计拆除解锁对应图鉴条目） ============

/** 模块类型 → 反诈图鉴 typeId（拆除该类模块累计达阈值时解锁对应图鉴） */
export const MODULE_CODEX_TYPE: Record<string, string> = {
  antenna:    "F04", // 信号塔 → 冒充客服退款（伪基站/GOIP）
  floor:      "F02", // 电诈工位 → 杀猪盘
  server:     "F03", // 服务器 → 刷单返利
  dorm:       "F35", // 苦工宿舍 → 境外高薪招工诱骗
  fortress:   "F01", // 装甲碉堡 → 冒充公检法
  wall:       "F06", // 铁丝网 → 冒充熟人/领导
  foundation: "F33", // 地基 → 民族资产解冻诈骗
  shock:      "F25", // 电击室 → 冒充反诈中心·保证金
  cage:       "F30", // 铁笼 → 两卡犯罪·工具人
  cell:       "F10", // 小黑屋 → 裸聊敲诈
  guard:      "F37", // 武装 → 冒充军警采购诈骗
  // ===== v6 新增模块图鉴映射 =====
  liveRoom:   "F38", // 直播间 → 虚假直播带货诈骗
  casino:     "F39", // 赌博机房 → 跨境网络赌博诈骗
  darkweb:    "F40", // 暗网服务器 → 个人信息黑市交易
  minefarm:   "F41", // 虚拟币矿场 → 虚拟币洗钱诈骗
  // ===== v9 新增模块图鉴映射（暗网深渊档位） =====
  aiFactory: "F87", // AI 换脸工厂 → Deepfake 仿冒诈骗
  idForge:   "F88", // 虚拟身份车间 → 批量伪造身份诈骗
};

/** 拆除某类模块累计达该阈值时解锁对应图鉴（按全局累计拆除数，跨局保留） */
export const MODULE_CODEX_UNLOCK_THRESHOLD = 5;

/** v5 受害者救援：拆除该类模块时释放的受害者数 */
export const MODULE_VICTIM_COUNT: Record<string, number> = {
  cage: 3,  // 铁笼：关押多人
  cell: 2,  // 小黑屋
  dorm: 2,  // 苦工宿舍
  // ===== v6 新增：新模块也可释放受害者 =====
  liveRoom: 1, // 直播间：被胁迫直播的受害者
  casino: 2,   // 赌博机房：被诱骗赌博的受害者
};

// ============ v5 过载大招配置 ============

/** 过载满后，玩家可主动释放的窗口期（秒）；超过则自动转为 buff */
export const OVERDRIVE_MANUAL_WINDOW = 3.0;
/** 过载大招：对存活模块造成的真实伤害（占其 maxHp 比例） */
export const OVERDRIVE_ULT_DAMAGE_PCT = 0.30;
/** 过载大招：全屏闪光强度 */
export const OVERDRIVE_ULT_FLASH = 0.7;
/** 过载大招：hit-stop 持续秒数 */
export const OVERDRIVE_ULT_HITSTOP = 0.25;

// ============ v6 新增武器参数 ============

/** 激光炮穿透伤害（绝对值，每模块） */
export const LASER_DMG_ABS = 90;
/** 激光炮最大穿透模块数 */
export const LASER_PIERCE_MAX = 4;
/** 激光炮持续时间（秒） */
export const LASER_DURATION = 0.4;

/** 导弹雨导弹数 */
export const MISSILE_RAIN_COUNT = 6;
/** 导弹雨单发伤害（绝对值） */
export const MISSILE_RAIN_DMG_ABS = 70;
/** 导弹雨覆盖半径（像素） */
export const MISSILE_RAIN_RADIUS = 90;
/** 导弹雨延迟落弹间隔（秒） */
export const MISSILE_RAIN_DELAY = 0.18;

// ============ v6 新增道具参数 ============

/** 信号屏蔽：禁 Boss 反击持续秒数 */
export const SIGNAL_JAM_DURATION = 5;
/** 空袭支援：直升机扫射持续秒数 */
export const AIR_STRIKE_DURATION = 6;
/** 空袭支援：每秒伤害（绝对值） */
export const AIR_STRIKE_DPS = 90;
/** 空袭支援：扫射半径（像素） */
export const AIR_STRIKE_RADIUS = 120;

// ============ v6 新增 debuff 参数 ============

/** 过载倒扣每秒扣减量 */
export const OVERDRIVE_DRAIN_PER_SEC = 8;
/** 连击重置：触发时直接 combo 归零 */
export const COMBO_BREAK_RESET = true;

// ============ v6 难度系数 ============

export const DIFFICULTIES: Record<BombDifficulty, BombDifficultyDef> = {
  easy:   { id: "easy",   name: "简单", bossHpMul: 0.7, repairMul: 0.7, counterIntervalMul: 1.4, minionCountMul: 0.6, itemCdMul: 0.7, scoreMul: 0.8,  color: "#52C41A", desc: "适合新手·Boss 弱化 30%" },
  normal: { id: "normal", name: "普通", bossHpMul: 1.0, repairMul: 1.0, counterIntervalMul: 1.0, minionCountMul: 1.0, itemCdMul: 1.0, scoreMul: 1.0,  color: "#FFD666", desc: "标准难度·原 v5 数值" },
  hard:   { id: "hard",   name: "困难", bossHpMul: 1.5, repairMul: 1.3, counterIntervalMul: 0.75, minionCountMul: 1.5, itemCdMul: 1.2, scoreMul: 1.5,  color: "#FF7A1A", desc: "Boss 强化 50%·小怪增多" },
  hell:   { id: "hell",   name: "地狱", bossHpMul: 2.2, repairMul: 1.6, counterIntervalMul: 0.55, minionCountMul: 2.2, itemCdMul: 1.4, scoreMul: 2.5,  color: "#E5353B", desc: "Boss 翻倍·反击频繁·仅高手" },
};

export const DIFFICULTY_ORDER: BombDifficulty[] = ["easy", "normal", "hard", "hell"];

// ============ v6 模式定义 ============

export const GAME_MODES: Record<BombGameMode, BombModeDef> = {
  endless: {
    id: "endless", name: "无尽模式", desc: "纯无尽爽打·3 档园区循环", hint: "永不止步·刷新最高分",
    icon: "♾", color: "#00E5FF", needDifficulty: true, maxWave: -1,
  },
  story: {
    id: "story", name: "剧情战役", desc: "5 关剧情·线性通关", hint: "从湄公河到总部·击破首脑",
    icon: "📖", color: "#FFD666", needDifficulty: false, maxWave: -1,
  },
  daily: {
    id: "daily", name: "每日挑战", desc: "每日固定 seed·特殊规则", hint: "全网同一份·比拼策略",
    icon: "📅", color: "#52C41A", needDifficulty: false, maxWave: 15,
  },
  speedrun: {
    id: "speedrun", name: "极速模式", desc: "3 分钟限时·按摧毁率评分", hint: "时间就是火力·极速输出",
    icon: "⚡", color: "#FF7A1A", needDifficulty: true, maxWave: -1,
  },
  hardcore: {
    id: "hardcore", name: "硬核模式", desc: "1 滴民心·Boss 大招即终局", hint: "一击必杀·极限挑战",
    icon: "💀", color: "#E5353B", needDifficulty: false, maxWave: -1,
  },
};

export const MODE_ORDER: BombGameMode[] = ["endless", "story", "daily", "speedrun", "hardcore"];

/** 极速模式：总时长（秒） */
export const SPEEDRUN_TOTAL_DURATION = 180;
/** 极速模式：每摧毁 1 个模块奖励秒数 */
export const SPEEDRUN_BONUS_PER_MODULE = 1.5;
/** 硬核模式：民心初始值 */
export const HARDCORE_MORALE_MAX = 1;
/** 硬核模式：Boss 阶段切换时民心扣减 */
export const HARDCORE_MORALE_LOSS_ON_PHASE = 1;
