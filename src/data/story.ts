/**
 * 剧情模式章节定义
 *
 * 反诈剧情五部曲：玩家以新晋反诈探员身份，从识破单点诈骗到摧毁境外电诈集团，
 * 最终与"电诈首脑"展开知识对决。每章对应一款游戏关卡。
 *
 * 文案遵循公开反诈常识：96110 反诈专线、公检法不电话办案、无安全账户、
 * 验证码即密码、杀猪盘识别、刷单返利诈骗、境外高薪招聘陷阱、12308 领事保护。
 */
import type { GameId } from "@/types";

export interface StoryDialogue {
  /** 说话人名称 */
  speaker: string;
  /** 头像 emoji */
  avatar: string;
  /** 台词正文 */
  text: string;
  /** 说话人文字颜色（霓虹色） */
  color: string;
}

export interface StoryChapter {
  /** 章节 ID（同时作为完成节点 ID 写入 platformStore.story.completedNodes） */
  id: string;
  /** 0-based 章节序号 */
  index: number;
  /** 章节标题 */
  title: string;
  /** 章节副标题（英文 / 标语） */
  subtitle: string;
  /** 主题色 */
  accent: string;
  /** 该章节关联的游戏 ID */
  gameId: GameId;
  /** 关联游戏显示名（避免反复查表） */
  gameTitle: string;
  /** 任务前过场对白 */
  intro: StoryDialogue[];
  /** 任务后过场对白 */
  outro: StoryDialogue[];
  /** 通关奖励资源 */
  reward: { coins: number; energy: number; fragments: number };
  /** 章节描述（用于关卡树展示） */
  description: string;
}

export const STORY_CHAPTERS: StoryChapter[] = [
  // ============ 第 0 章：初入警队 ============
  {
    id: "story-ch0-recruit",
    index: 0,
    title: "初入警队",
    subtitle: "ROOKIE RECRUIT",
    accent: "#1AD670",
    gameId: "fraud-buster",
    gameTitle: "是男人就反诈",
    description:
      "新兵报到第一天，反诈中心接报量井喷。跟着老探员识别雪片般飞来的诈骗卡片，扛过 100 波才算入队。",
    reward: { coins: 100, energy: 1, fragments: 0 },
    intro: [
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "新人报到？我是反诈中心陈队长。从今天起你就是反诈探员，先记住一句话：96110 是全国反诈劝阻专线。",
        color: "#00E5FF",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "我带过几十个徒弟，第一课永远是『公检法不会电话办案』。对方自称警官要你转账验资？挂掉，100% 是诈骗。",
        color: "#FFB020",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "记住：所谓『安全账户』根本不存在。验证码就是密码，谁要都别给。陌生人发来的链接，一律不点。",
        color: "#FFB020",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "现在指挥中心把诈骗情境卡片推给你，4 秒内判断是诈骗还是正常。扛过 100 波，才能正式上岗。准备好了吗？",
        color: "#00E5FF",
      },
    ],
    outro: [
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "干得漂亮。你刚刚识破的，覆盖了刷单返利、冒充客服、杀猪盘入口等高频套路，这些都是真实报案里最常见的。",
        color: "#FFB020",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "不过单兵作战救不了几个人。下一步，你要学会指挥一支反诈小队——『杀猪盘』集团正在城东布局，该你上场了。",
        color: "#00E5FF",
      },
    ],
  },

  // ============ 第 1 章：指挥行动 ============
  {
    id: "story-ch1-command",
    index: 1,
    title: "指挥行动",
    subtitle: "TACTICAL COMMAND",
    accent: "#FFB020",
    gameId: "manager",
    gameTitle: "反诈职业经理人",
    description:
      "杀猪盘集团在城东铺设投资陷阱。招募 6 名探员部署到 3×3 战位，自动拦截『猪』『屠夫』『资金流』，大招一开全屏震慑。",
    reward: { coins: 150, energy: 1, fragments: 1 },
    intro: [
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "情报来了：一个『杀猪盘』团伙在城东同时养了上百个『猪』，准备集中收网提现。我们必须在他们得手前拦下资金。",
        color: "#00E5FF",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "杀猪盘三步走：先用『高富帅/白富美』人设撩感情，再诱导到非正规平台『投资』，最后以『税费解冻金』卡住提现。",
        color: "#FFB020",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "记住核心信号：稳赚不赔是陷阱、提现要交钱就是诈骗、被催『加仓保收益』立即撤。这三条印在脑子里。",
        color: "#FFB020",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "这次不能单打独斗。招募探员、部署战位、看准时机放大招。把『屠夫』挡在『猪』之外，就算赢。",
        color: "#00E5FF",
      },
      {
        speaker: "探员小赵",
        avatar: "👮",
        text: "队长，情报显示对方有车接应，可能往港口方向逃——我看他们不像本地人。",
        color: "#1AD670",
      },
    ],
    outro: [
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "漂亮，资金链被切断了，几十个潜在受害者保住了钱包。但主犯跑了，情报指向港口。",
        color: "#00E5FF",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "他们在往码头搬设备，估计想上快艇出海。再晚一步就出境了——快，追！",
        color: "#FFB020",
      },
      {
        speaker: "探员小赵",
        avatar: "👮",
        text: "驾驶执法号就位，请求出发！",
        color: "#1AD670",
      },
    ],
  },

  // ============ 第 2 章：闪电追击 ============
  {
    id: "story-ch2-thunder",
    index: 2,
    title: "闪电追击",
    subtitle: "THUNDER PURSUIT",
    accent: "#00E5FF",
    gameId: "thunder",
    gameTitle: "雷霆反诈",
    description:
      "诈骗集团舰队试图出境。驾驶警务执法号穿越电诈舰队弹幕，沿途拾取『国家反诈 APP』『不接境外来电』等强力道具，与首脑决战。",
    reward: { coins: 200, energy: 2, fragments: 1 },
    intro: [
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "诈骗集团在海上编了舰队，每艘船都是一个境外来电源。他们想冲出去就再也追不回来了。",
        color: "#00E5FF",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "记住关键反诈道具：『国家反诈 APP』能预警可疑来电、『不接境外来电』直接屏蔽整片海域、『96110 震慑』一发清场。",
        color: "#FFB020",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "还有一条：公检法绝不会让你转账『自证清白』。船上那些冒充警官的，全是诈骗犯本人。",
        color: "#FFB020",
      },
      {
        speaker: "探员小赵",
        avatar: "👮",
        text: "前方发现首脑座舰！它的弹幕是『安全账户验证码解冻金』——我用反诈 APP 接住每一发！",
        color: "#1AD670",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "突击！把首脑座舰打下来，活要见人。",
        color: "#00E5FF",
      },
    ],
    outro: [
      {
        speaker: "探员小赵",
        avatar: "👮",
        text: "首脑座舰迫降了！但他跳上一艘小艇，往南边一座岛屿去了——那是境外电诈园区。",
        color: "#1AD670",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "那地方以『境外高薪招聘』为饵，骗了不少人进去。受害者出不来，只能被迫参与诈骗。",
        color: "#FFB020",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "进入园区不能强冲，得远程围困。炮兵阵地已就位，听你指挥。",
        color: "#00E5FF",
      },
    ],
  },

  // ============ 第 3 章：岛上围剿 ============
  {
    id: "story-ch3-siege",
    index: 3,
    title: "岛上围剿",
    subtitle: "ISLAND SIEGE",
    accent: "#FF7A1A",
    gameId: "bomb-island",
    gameTitle: "诈园区",
    description:
      "境外电诈园区负隅顽抗。炮兵自动连续炮击，左侧道具栏释放反诈炮弹/96110 震慑/警方突击/反诈 APP 光束，过载槽满后火力全开。",
    reward: { coins: 250, energy: 2, fragments: 2 },
    intro: [
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "园区里关着上百名被骗去的『工人』，强攻会伤及无辜。我们用远程炮击切断他们的电诈网络，逼他们投降。",
        color: "#00E5FF",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "科普一下：境外高薪招聘 = 电诈陷阱，月薪数万包机包住全是饵。被诱骗进去应立即联系使馆，12308 领事保护热线 24 小时。",
        color: "#FFB020",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "炮击目标分四级：诈骗窝点、信号塔、资金通道、首脑楼。按优先级打，过载槽满了一波带走整片区域。",
        color: "#FFB020",
      },
      {
        speaker: "探员小赵",
        avatar: "👮",
        text: "炮兵阵地就位！96110 震慑弹装填完毕，请求开火！",
        color: "#1AD670",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "开火。把他们的电诈网络一根根拔掉，给被骗进去的人留一条回家的路。",
        color: "#00E5FF",
      },
    ],
    outro: [
      {
        speaker: "探员小赵",
        avatar: "👮",
        text: "园区电诈网络全部瘫痪！被骗的『工人』正在分批移交使馆，12308 已对接回国航班。",
        color: "#1AD670",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "但首脑本人溜进了地下掩体，他扬言要『直播反洗白』，公开扭曲反诈知识来洗脑粉丝。",
        color: "#FFB020",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "不能让他得逞。这场仗只能用知识打——你上，正面和他对决。",
        color: "#00E5FF",
      },
    ],
  },

  // ============ 第 4 章：终极对决 ============
  {
    id: "story-ch4-finale",
    index: 4,
    title: "终极对决",
    subtitle: "FINAL SHOWDOWN",
    accent: "#FF00E5",
    gameId: "fraud-buster",
    gameTitle: "是男人就反诈",
    description:
      "电诈首脑开启直播洗白，疯狂抛出诈骗话术卡片。4 秒内识破每张卡片是诈骗还是正常，扛过的反诈波次越多越显真本事，把他打到下播。",
    reward: { coins: 500, energy: 3, fragments: 3 },
    intro: [
      {
        speaker: "电诈首脑",
        avatar: "🦹",
        text: "呵，反诈探员？我直播一场能洗白上万人。你那点反诈常识，我一句话就能扭曲。",
        color: "#FF3B5C",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "别听他胡扯。知识就是武器，卡片飞来 4 秒内识破，连击越长火力越猛，道具用对能扛更久。把他打到下播。",
        color: "#00E5FF",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "核心反诈知识点再过一遍：96110 是反诈专线、公检法不电话办案、无安全账户、验证码即密码、刷单必诈、境外高薪是陷阱。",
        color: "#FFB020",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "他擅长设陷阱：把『安全』说成『不安全』、把『诈骗』说成『福利』。看到卡片别急，4 秒够你想清楚。",
        color: "#FFB020",
      },
      {
        speaker: "探员小赵",
        avatar: "👮",
        text: "队长，全国网友都在看这场直播。我不能输。",
        color: "#1AD670",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "去吧，让所有人看见——反诈常识，比骗术更硬。",
        color: "#00E5FF",
      },
    ],
    outro: [
      {
        speaker: "电诈首脑",
        avatar: "🦹",
        text: "不……不可能……我准备了那么多话术，怎么会被一个新人答穿……",
        color: "#FF3B5C",
      },
      {
        speaker: "陈队长",
        avatar: "🎖️",
        text: "骗子最怕的不是警察，是识破他们的人。今天这场直播，让上万人学会了反诈。",
        color: "#00E5FF",
      },
      {
        speaker: "老李",
        avatar: "🕵️",
        text: "记住今天这五关：识别、指挥、追击、围困、对决。全民反诈，天下无诈。",
        color: "#FFB020",
      },
      {
        speaker: "探员小赵",
        avatar: "👮",
        text: "96110 已收到全国网友来电，反诈中心全员就位。下一班，等你。",
        color: "#1AD670",
      },
    ],
  },
];
