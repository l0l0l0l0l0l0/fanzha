import type {
  ThunderRPGScenarioDef,
  ThunderRPGNodeDef,
  ThunderRPGChoiceDef,
  ThunderRPGEndingDef,
  ThunderRPGNodeKind,
} from "./types";

// ===========================================================================
// ===== v7 升级：第一人称 RPG 剧本系统 ======================================
// 雷霆反诈·沉浸式反诈剧本：玩家以第一人称视角识破各类诈骗套路。
// 每个剧本覆盖一种典型诈骗类型，包含叙事/对话/决策/检查证据/结局节点。
// ===========================================================================

/**
 * v7 RPG 剧本列表（6 个剧本，覆盖杀猪盘/冒充公检法/刷单/AI换脸/数字钱包/加密货币）
 * 玩家以第一人称代入，通过对话与决策识破骗局。
 */
export const THUNDER_RPG_SCENARIOS: ThunderRPGScenarioDef[] = [
  // ============ RPG-001：杀猪盘 ============
  {
    id: "RPG-001",
    fraudTypeId: "F02",
    fraudType: "杀猪盘诈骗",
    title: "我是受害者的朋友",
    difficulty: 2,
    scenario: "你的闺蜜小林最近迷上了一位「投资导师」，朋友圈全是盈利截图。今天她拉你到咖啡馆，兴奋地要介绍你也入局。作为好友，你必须识破这场精心编织的杀猪盘。",
    playerRole: "受害者的好友",
    tags: ["杀猪盘", "友情救援", "投资陷阱", "识破话术", "闺蜜"],
    startNodeId: "r1-n1",
    passThreshold: 3,
    relatedLessonId: "CHAPTER-02",
    rewardTalentPoints: 2,
    nodes: [
      {
        id: "r1-n1", kind: "narrative",
        scene: "周末下午·街角咖啡馆",
        text: "「我跟你说，这真的是我遇到过最靠谱的机会！」小林搅着咖啡，眼睛亮得反光，「陈哥带我三个月赚了三万多，一开始我也不信，但钱真的到账了呀。」她掏出手机，屏幕上是密密麻麻的盈利截图和一位西装革履的「陈导师」朋友圈。",
        deconstruct: "杀猪盘前期一定会让玩家「尝到甜头」——小额提现成功是建立信任的关键钩子，让你以为平台是真的。",
      },
      {
        id: "r1-n2", kind: "dialogue", speaker: "小林",
        scene: "咖啡馆·对话",
        text: "「你看，陈哥说下周有个内部名额，收益能翻倍。你要不要也投一点？我帮你引荐。」小林把手机推到你面前，期待地看着你。",
        psychology: ["利益诱惑", "熟人背书", "稀缺性"],
        redFlag: 3,
        choices: [
          {
            text: "「这听起来太像杀猪盘了，那些截图能造假。」",
            nextNodeId: "r1-n3", bust: true, bustScore: 2, verdict: "right",
            feedback: "识破关键红旗！盈利截图可以批量伪造，杀猪盘最擅长的就是用「晒收益」建立信任。",
            psychology: ["识破盈利截图造假"],
          },
          {
            text: "「先别投太多，观望一下再说。」",
            nextNodeId: "r1-n3", verdict: "warn", bustScore: 1,
            feedback: "保持警惕是对的，但「观望」可能让小林觉得你不支持她。需要更直接地指出问题。",
          },
          {
            text: "「真有这么赚？那我也投一点试试。」",
            nextNodeId: "r1-n3", verdict: "wrong",
            feedback: "危险！「我也投一点」正是骗子想要的态度。杀猪盘靠的就是熟人间的信任传染。",
            psychology: ["从众心理", "利益诱惑"],
          },
        ],
      },
      {
        id: "r1-n3", kind: "examine",
        scene: "咖啡馆·借口离开",
        text: "你借口去洗手间，借机上网搜索「陈导师」和那个投资平台。你还翻看了小林手机里和陈哥的聊天记录——发现几个不对劲的地方。",
        psychology: ["信息核实", "证据收集"],
        redFlag: 4,
        deconstruct: "检查证据时，注意三个致命信号：①平台无法在正规应用商店下载 ②「导师」催促私下转账 ③聊天里反复强调「保密」「内部名额」。",
        choices: [
          {
            text: "截图保存聊天记录和平台链接，作为证据。",
            nextNodeId: "r1-n4", bust: true, bustScore: 2, verdict: "right",
            feedback: "做得好！保留证据是后续报警和止损的关键。杀猪盘的聊天记录、转账凭证都要留存。",
            psychology: ["证据意识"],
          },
          {
            text: "只是随便看看，没特别留意。",
            nextNodeId: "r1-n4", verdict: "warn", bustScore: 0,
            feedback: "走马观花地看容易漏掉关键证据。下次记得截图保存，细节决定能否说服受害者。",
          },
        ],
      },
      {
        id: "r1-n4", kind: "decision",
        scene: "咖啡馆·回到座位",
        text: "你心里已经有了判断，现在要决定怎么劝小林。她正眼巴巴地等你表态，旁边还有陈哥发来的语音：「妹妹，名额只剩两个了哦。」",
        psychology: ["紧迫催促", "沉没成本"],
        redFlag: 4,
        deconstruct: "「名额只剩两个」「再不来不及」是杀猪盘标准话术，制造紧迫感让你来不及思考。",
        choices: [
          {
            text: "「小林，我现在就帮你查反诈APP，这种平台八成是假的。」",
            nextNodeId: "r1-n5", bust: true, bustScore: 2, verdict: "right",
            feedback: "果断行动！用反诈APP核查是最直接的方式，比空口争论更有说服力。",
          },
          {
            text: "「你先把已经投的钱提出来试试，能提出来再说。」",
            nextNodeId: "r1-n5", verdict: "warn", bustScore: 1,
            feedback: "试探性提现是个办法，但杀猪盘前期往往允许小额提现，这反而可能加深小林的信任。",
          },
          {
            text: "「这是你的钱，你自己决定吧。」",
            nextNodeId: "r1-n5", verdict: "wrong",
            feedback: "逃避！作为好友，眼睁睁看朋友往火坑里跳而不阻拦，是最差的选项。",
          },
        ],
      },
      {
        id: "r1-n5", kind: "decision", speaker: "小林",
        scene: "咖啡馆·转折",
        text: "小林的脸色变了：「你……你是不信我吗？我可是亲眼看着钱到账的。」她的声音有点发抖，「陈哥说，提现要再交一笔『认证金』……我刚才正想跟你说这事。」",
        psychology: ["沉没成本", "提现前置收费"],
        redFlag: 5,
        deconstruct: "「提现要交认证金」是杀猪盘的收割信号——前期让你尝甜头，后期以各种名目（认证金/解冻金/税金）连环收割。",
        choices: [
          {
            text: "「停！提现要交钱=100%是诈骗。我们现在就报警。」",
            nextNodeId: "r1-end-perfect", bust: true, bustScore: 3, verdict: "right",
            feedback: "完美识破！「提现前置收费」是杀猪盘的铁证，立即报警止损是唯一正确做法。",
          },
          {
            text: "「那笔认证金先别交，我们再核实一下平台。」",
            nextNodeId: "r1-end-good", bust: true, bustScore: 2, verdict: "right",
            feedback: "阻止了进一步损失，但报警可以更早冻结对方账户。",
          },
          {
            text: "「要不你先交了试试，能提出来说明是真的。」",
            nextNodeId: "r1-end-bad", verdict: "wrong",
            feedback: "致命错误！「交认证金」=连环收割，交了只会被套得更深。",
          },
          {
            text: "「我记得96110可以咨询，我们先打过去问问？」",
            nextNodeId: "r1-end-secret", bust: true, bustScore: 3, verdict: "right",
            feedback: "机智！96110是反诈专线，咨询不花钱却可能救回一笔钱。这个习惯能帮你识破很多骗局。",
          },
        ],
      },
      { id: "r1-end-perfect", kind: "ending", scene: "结局", text: "小林愣了几秒，终于哭了出来：「我差点把爸妈的养老钱也搭进去……」你们一起拨打了96110，警方很快锁定了那个平台。一周后，小林的那笔钱被冻结前追回了一部分。", isEnding: true, endingId: "r1-perfect" },
      { id: "r1-end-good", kind: "ending", scene: "结局", text: "小林犹豫了很久，最终没有交那笔认证金。虽然之前投的钱没能全部追回，但她至少止损了。「谢谢你拉了我一把，」她红着眼说，「以后我再也不信什么内部名额了。」", isEnding: true, endingId: "r1-good" },
      { id: "r1-end-normal", kind: "ending", scene: "结局", text: "你劝了半天，小林嘴上答应不投了，但回去后还是偷偷交了认证金。后来她哭着告诉你钱全没了。你叹了口气——下次得拦得更早、更狠一点。", isEnding: true, endingId: "r1-normal" },
      { id: "r1-end-bad", kind: "ending", scene: "结局", text: "小林交了认证金，账户显示「盈利翻倍」，却再也提不出来。她哭着说陈哥把她拉黑了。你看着她崩溃的样子，心里堵得慌——本来可以拦住的。", isEnding: true, endingId: "r1-bad" },
      { id: "r1-end-secret", kind: "ending", scene: "结局", text: "96110的接线员听完，语气一紧：「您描述的这个平台我们正在协查，请您立刻带朋友到就近派出所做笔录。」原来陈哥的团伙已经骗了上百人。你的一个电话，让小林成了关键证人——也成了几十个受害者的希望。", isEnding: true, endingId: "r1-secret" },
    ],
    endings: [
      { id: "r1-perfect", type: "perfect", title: "釜底抽薪", desc: "你果断识破提现收费陷阱，第一时间报警止损，帮小林追回了大部分资金。", lesson: "杀猪盘的收割信号是「提现要交钱」。遇到这种情况，别犹豫，立刻拨打96110报警——报警永远比转账管用。", icon: "🏆", color: "#FFD700" },
      { id: "r1-good", type: "good", title: "悬崖勒马", desc: "你阻止了小林继续交认证金，虽然没能追回全部损失，但及时止损。", lesson: "止损也是一种胜利。已经投入的钱不必为了「捞回」而继续加码，那只会让窟窿越来越大。", icon: "🛡️", color: "#52C41A" },
      { id: "r1-normal", type: "normal", title: "后知后觉", desc: "你的劝说起效太晚，小林最终还是损失了一笔钱，但至少没有倾家荡产。", lesson: "劝阻要趁早，更要趁「狠」。轻描淡写的提醒敌不过精心设计的话术，关键时刻得拿出证据和决心。", icon: "📌", color: "#7A8FB0" },
      { id: "r1-bad", type: "bad", title: "错失良机", desc: "你没能阻止小林交认证金，她账户里的钱全部被套走，陈哥也消失了。", lesson: "「提现要交钱」就是诈骗的铁证。下次遇到朋友要交这种钱，哪怕翻脸也要拦住——钱没了可以再赚，信任崩塌才是真的痛。", icon: "💔", color: "#FF4D4F" },
      { id: "r1-secret", type: "secret", title: "关键证人", desc: "你拨打96110的举动，意外牵出了一个跨省诈骗团伙，小林成了关键证人。", lesson: "96110不只是一个号码，它连接着全国反诈网络。你的一次咨询，可能不止救一个人，而是救一群人。", icon: "🌟", color: "#B388FF" },
    ],
  },

  // ============ RPG-002：冒充公检法 ============
  {
    id: "RPG-002",
    fraudTypeId: "F01",
    fraudType: "冒充公检法诈骗",
    title: "深夜来电",
    difficulty: 3,
    scenario: "凌晨两点，电话响起。对方自称市公安局，说你的身份证涉嫌一宗跨国洗钱案，必须立刻配合「资金清查」。深夜的电话最容易让人慌神，你必须稳住自己，识破这场冒充公检法的戏码。",
    playerRole: "接到电话的普通人",
    tags: ["冒充公检法", "深夜来电", "权威恐吓", "安全账户", "资金清查"],
    startNodeId: "r2-n1",
    passThreshold: 3,
    relatedLessonId: "CHAPTER-01",
    rewardTalentPoints: 3,
    nodes: [
      {
        id: "r2-n1", kind: "narrative",
        scene: "凌晨2:17·卧室",
        text: "手机在床头震动，屏幕上是个陌生号码。你迷迷糊糊接起来，对方语气严肃：「这里是市公安局刑侦支队，你涉嫌一宗跨国洗钱案，请立刻配合调查，否则将依法对你采取强制措施。」你的睡意瞬间醒了大半。",
        deconstruct: "冒充公检法的第一招永远是「恐吓」——用「涉嫌犯罪」「强制措施」制造恐慌，让你大脑空白、来不及思考。",
      },
      {
        id: "r2-n2", kind: "dialogue", speaker: "「警官」",
        scene: "电话中",
        text: "「为了证明你的清白，请报出身份证号后六位，并核对你的家庭住址。」对方报出了一串数字，正是你的身份证号。「我们已对你的账户进行监控，需要将资金转入『安全账户』进行清查。」",
        psychology: ["权威压迫", "信息泄露建立信任", "恐吓"],
        redFlag: 4,
        choices: [
          {
            text: "「公安机关办案不会电话要求转账，更没有什么安全账户。」",
            nextNodeId: "r2-n3", bust: true, bustScore: 2, verdict: "right",
            feedback: "一针见血！公检法绝不会电话办案，更不会要求转账到「安全账户」——这是冒充公检法的核心红旗。",
          },
          {
            text: "「可我的身份证号你们都知道……应该是真的吧？」",
            nextNodeId: "r2-n3", verdict: "warn", bustScore: 0,
            feedback: "身份证号泄露很常见，骗子能用它建立信任，但这不代表对方就是警察。信息泄露≠身份核实。",
            psychology: ["信息泄露误导"],
          },
          {
            text: "「那我配合调查，要转多少？」",
            nextNodeId: "r2-n3", verdict: "wrong",
            feedback: "危险！一旦答应转账，对方会步步紧逼。记住：任何让你「转钱配合调查」的都是诈骗。",
            psychology: ["顺从权威"],
          },
        ],
      },
      {
        id: "r2-n3", kind: "examine",
        scene: "卧室·你打开电脑",
        text: "对方发来一张「刑事逮捕令」的图片，上面有你的照片、身份证号，还盖着红通通的「公章」。你盯着那张图片，总觉得哪里不对。",
        psychology: ["伪造文书", "视觉恐吓"],
        redFlag: 5,
        deconstruct: "「电子逮捕令」是伪造的——真正的法律文书不会通过微信/QQ发送，更不会用PS痕迹明显的图片吓唬你。仔细看，公章字体、排版往往破绽百出。",
        choices: [
          {
            text: "放大图片检查公章和排版，发现是PS合成的。",
            nextNodeId: "r2-n4", bust: true, bustScore: 2, verdict: "right",
            feedback: "细心！伪造文书的公章往往是贴图，字体模糊、边缘锐利不自然。这是识破冒充公检法的关键证据。",
          },
          {
            text: "被图片吓到，没敢仔细看。",
            nextNodeId: "r2-n4", verdict: "warn", bustScore: 0,
            feedback: "恐惧会让人放弃思考。深呼吸，记住：真警察不会用图片恐吓你转账。",
          },
        ],
      },
      {
        id: "r2-n4", kind: "decision",
        scene: "卧室·电话仍在继续",
        text: "对方的声音越来越急：「现在案件已移交，再不配合将以『妨碍公务』拘留！」电话里隐约还有「警笛声」。你握着手机，必须做个决定。",
        psychology: ["升级恐吓", "紧迫催促", "伪造场景音"],
        redFlag: 5,
        deconstruct: "「警笛声」「拘留」都是话术道具。骗子会播放背景音、多人轮番上阵，目的是让你在恐慌中服从。静下心——真警察办案会当面出示证件，不会电话催你转账。",
        choices: [
          {
            text: "「我现在就挂断，自己打110核实。」",
            nextNodeId: "r2-n5", bust: true, bustScore: 2, verdict: "right",
            feedback: "正确做法！挂断后自行拨打110核实，是识破冒充公检法的黄金法则。骗子最怕你「主动核实」。",
          },
          {
            text: "「那我不转了，你们看着办吧。」说完挂断。",
            nextNodeId: "r2-n5", verdict: "warn", bustScore: 1,
            feedback: "挂断是对的，但没有主动核实，对方可能换号继续骚扰你。最好打110报备一下。",
          },
          {
            text: "「那我把钱转过去配合清查，事后能退吧？」",
            nextNodeId: "r2-n5", verdict: "wrong",
            feedback: "致命错误！「安全账户」是骗子的私人账户，钱进去就回不来了。任何「配合清查转账」都是诈骗。",
          },
        ],
      },
      {
        id: "r2-n5", kind: "decision", speaker: "「警官」",
        scene: "电话中·最后施压",
        text: "对方换了个「领导」的语气：「年轻人，这是给你的最后机会，案件一旦录入系统就撤不回了。你这样是自毁前途。」背景里传来打印机的声音，仿佛逮捕令正在生成。",
        psychology: ["最后通牒", "前途恐吓", "伪造场景音"],
        redFlag: 5,
        choices: [
          {
            text: "「我已经打过110核实了，他们说这是诈骗，你们报个警号我查查？」",
            nextNodeId: "r2-end-perfect", bust: true, bustScore: 3, verdict: "right",
            feedback: "完美反击！要求对方报「警号」并自行核实，骗子立刻就会露馅。真警察不怕你核实。",
          },
          {
            text: "「你们别再打了，再打我报警。」然后拉黑号码。",
            nextNodeId: "r2-end-good", bust: true, bustScore: 2, verdict: "right",
            feedback: "果断止损！拉黑+报警是有效做法，只是少了留存证据这一步。",
          },
          {
            text: "「那我配合，钱转到哪个账户？」",
            nextNodeId: "r2-end-bad", verdict: "wrong",
            feedback: "致命错误！你已经走到了这一步还动摇，说明恐吓话术起了作用。记住：钱一转出，就再也回不来了。",
          },
          {
            text: "「我下载个国家反诈APP，让你们看看我是不是清白的。」",
            nextNodeId: "r2-end-secret", bust: true, bustScore: 3, verdict: "right",
            feedback: "聪明！国家反诈APP有来电预警功能，一打开骗子号码就被标记。这个习惯能挡掉大半电话诈骗。",
          },
        ],
      },
      { id: "r2-end-perfect", kind: "ending", scene: "结局", text: "对方一听「警号」两个字，沉默了两秒，电话那头传来忙音。你拨通110核实，果然——根本没有这个案子，那是典型的冒充公检法套路。第二天反诈中心给你发来短信：你举报的号码已被标记，将提醒更多人。", isEnding: true, endingId: "r2-perfect" },
      { id: "r2-end-good", kind: "ending", scene: "结局", text: "你拉黑了那个号码，第二天又收到几个陌生来电，你没再接。后来在新闻里看到，同号段骗了好几个人。你庆幸自己没转钱，但也后悔没早点报警留存证据。", isEnding: true, endingId: "r2-good" },
      { id: "r2-end-normal", kind: "ending", scene: "结局", text: "你挂了电话，一夜没睡好。第二天去派出所问，民警说确实是诈骗。你松了口气，但那种被恐吓的窒息感挥之不去——下次再接到这种电话，你会更早识破。", isEnding: true, endingId: "r2-normal" },
      { id: "r2-end-bad", kind: "ending", scene: "结局", text: "你在恐慌中转了账，第二天醒来才意识到不对劲。报警后警察说钱已经被拆分转移到境外，追回希望渺茫。你盯着银行短信，懊悔得说不出话。", isEnding: true, endingId: "r2-bad" },
      { id: "r2-end-secret", kind: "ending", scene: "结局", text: "你打开国家反诈APP，那个号码立刻被标红预警。你顺手举报了它，没想到一周后接到反诈中心回访：你的举报帮他们锁定了一个跨境诈骗窝点的线索。「您这个习惯，可能救了几百人。」民警在电话里说。", isEnding: true, endingId: "r2-secret" },
    ],
    endings: [
      { id: "r2-perfect", type: "perfect", title: "见招拆招", desc: "你识破了伪造逮捕令，挂断后主动核实警号，骗子落荒而逃。", lesson: "冒充公检法的核心话术是「恐吓+安全账户」。真警察不会电话办案、不会要你转账、不怕你核实。记住这三个「不会」，深夜来电也不慌。", icon: "🏆", color: "#FFD700" },
      { id: "r2-good", type: "good", title: "及时止损", desc: "你果断挂断并拉黑号码，保住了资金，只是少了留存证据。", lesson: "挂断是对的，但记得打110报备——你的举报能让更多人免于上当。证据留存也是反诈的一环。", icon: "🛡️", color: "#52C41A" },
      { id: "r2-normal", type: "normal", title: "虚惊一场", desc: "你虽然被吓到，但最终没转账，第二天核实后才彻底放下心。", lesson: "被吓到不可怕，可怕的是在恐惧中做决定。下次接到「涉案」电话，先深呼吸——真警察会等你核实。", icon: "📌", color: "#7A8FB0" },
      { id: "r2-bad", type: "bad", title: "深夜失守", desc: "你在恐慌中转了账，钱被迅速转移境外，追回希望渺茫。", lesson: "「安全账户」不存在，任何让你转账「配合调查」的都是诈骗。再深的夜、再大的恐吓，也别在恐惧中按下转账键。", icon: "💔", color: "#FF4D4F" },
      { id: "r2-secret", type: "secret", title: "反诈哨兵", desc: "你用国家反诈APP识破了骗子，举报线索还帮警方锁定了窝点。", lesson: "国家反诈APP不只是装在手机里，更是一种习惯——来电预警、一键举报，你的一个动作可能就是几百人的防线。", icon: "🌟", color: "#B388FF" },
    ],
  },

  // ============ RPG-003：刷单返利 ============
  {
    id: "RPG-003",
    fraudTypeId: "F03",
    fraudType: "刷单返利诈骗",
    title: "群里的兼职广告",
    difficulty: 2,
    scenario: "宿舍群里弹出一条兼职广告：「动动手指，日入200，学生优先」。你想赚点生活费，加了那个「客服」。但刷单返利的甜头背后，往往是一个越陷越深的坑。",
    playerRole: "大学生",
    tags: ["刷单返利", "兼职陷阱", "大学生", "先垫后返", "任务连环"],
    startNodeId: "r3-n1",
    passThreshold: 2,
    relatedLessonId: "CHAPTER-03",
    rewardTalentPoints: 2,
    nodes: [
      {
        id: "r3-n1", kind: "narrative",
        scene: "宿舍·晚上",
        text: "室友小张在群里转了一条广告：「点赞关注就能赚钱，日结200+，加微信详聊。」你生活费又快见底了，犹豫了一下，还是扫了二维码，加了个叫「兼职客服-小美」的微信号。",
        deconstruct: "刷单诈骗的入口永远是「低门槛高回报」——学生、宝妈是主要目标，因为缺钱又想灵活兼职。",
      },
      {
        id: "r3-n2", kind: "dialogue", speaker: "客服小美",
        scene: "微信对话",
        text: "「亲，先试一单吧～给这个商品点赞关注，截图给我，立刻返你8元红包。」你照做了，8块钱真的秒到账。「接下来可以做『任务单』，先垫付商品款，确认收货后连本带佣金返给你，一单能赚30～80哦。」",
        psychology: ["小额返利建立信任", "垫付前置"],
        redFlag: 3,
        choices: [
          {
            text: "「垫付才能赚钱？这不就是刷单吗，刷单是违法的。」",
            nextNodeId: "r3-n3", bust: true, bustScore: 2, verdict: "right",
            feedback: "识破红旗！刷单本身就违法，而且「先垫后返」是刷单诈骗的核心结构——前期返你甜头，后期垫付越多越提不出来。",
          },
          {
            text: "「8块到账了，那做大单试试？」",
            nextNodeId: "r3-n3", verdict: "warn", bustScore: 0,
            feedback: "8块钱正是饵料。刷单诈骗一定会让你「尝到甜头」建立信任，然后诱导你垫付更大金额。",
            psychology: ["尝甜头效应"],
          },
          {
            text: "「先做一单小的看看。」",
            nextNodeId: "r3-n3", verdict: "wrong",
            feedback: "危险！小单返利是诱饵，一旦你尝到甜头，客服就会以「连单任务」「高级会员」诱导你垫付大额。",
          },
        ],
      },
      {
        id: "r3-n3", kind: "examine",
        scene: "宿舍·你搜索平台信息",
        text: "你上网搜了搜这个「兼职平台」的名字，还查了查刷单到底合不合法。",
        psychology: ["信息核实", "法律常识"],
        redFlag: 4,
        deconstruct: "检查时要查两点：①平台是否有正规应用商店上架 ②刷单行为本身违反《反不正当竞争法》，任何「合规刷单」都是话术。",
        choices: [
          {
            text: "搜索发现刷单违法，且该平台无任何备案信息。",
            nextNodeId: "r3-n4", bust: true, bustScore: 2, verdict: "right",
            feedback: "做得好！刷单违法+平台无备案，双红旗已亮。正规兼职不需要你垫付本金。",
          },
          {
            text: "只看了几条好评就信了。",
            nextNodeId: "r3-n4", verdict: "warn", bustScore: 0,
            feedback: "好评可以刷。判断平台要查备案、应用商店，而不是看评论区。",
          },
        ],
      },
      {
        id: "r3-n4", kind: "decision",
        scene: "微信·客服催促",
        text: "小美发来语音：「亲，今天还有最后一个『连单任务』，做完返佣翻倍哦，错过就没了～」她还发来一张「群友晒收益」的图，金额从几百到几千不等。",
        psychology: ["稀缺催促", "从众晒单", "连单陷阱"],
        redFlag: 4,
        deconstruct: "「连单任务」是刷单诈骗的收割信号——要求你连续垫付多笔，每笔都说「再做一单就能一起返」，实际永远不会返。",
        choices: [
          {
            text: "「刷单违法，我不做了，已截图留证。」",
            nextNodeId: "r3-n5", bust: true, bustScore: 2, verdict: "right",
            feedback: "果断！截图留证+及时退出，是面对刷单诈骗最聪明的做法。前期那8块就当买了个教训。",
          },
          {
            text: "「那做一单小的，大单不做。」",
            nextNodeId: "r3-n5", verdict: "warn", bustScore: 1,
            feedback: "「只做小单」是侥幸心理，骗子会逐步加码。刷单没有「安全剂量」，一旦开始就容易收不住。",
          },
          {
            text: "「那做连单任务，赚大的。」",
            nextNodeId: "r3-n5", verdict: "wrong",
            feedback: "危险！「连单任务」是连环收割，你垫付的钱永远不会回来。",
          },
        ],
      },
      {
        id: "r3-n5", kind: "decision", speaker: "客服小美",
        scene: "微信·最后诱导",
        text: "（如果你还在做任务）小美发来：「亲，这单系统显示需要再做3个连单才能一起返款哦，已经垫的钱不做完就冻结了～」如果你已退出，她还在群发「今日收益榜」诱惑你。",
        psychology: ["沉没成本绑架", "冻结恐吓"],
        redFlag: 5,
        choices: [
          {
            text: "「这是诈骗，我已截图报警，你等着。」",
            nextNodeId: "r3-end-perfect", bust: true, bustScore: 3, verdict: "right",
            feedback: "完美！截图报警不仅能止损，还能帮警方打击刷单诈骗团伙。",
          },
          {
            text: "退出群聊，拉黑客服，并在宿舍提醒同学。",
            nextNodeId: "r3-end-good", bust: true, bustScore: 2, verdict: "right",
            feedback: "好样的！拉黑止损+提醒同学，一个人识破能护住一个宿舍。",
          },
          {
            text: "「那我再做3个连单把钱提出来。」",
            nextNodeId: "r3-end-bad", verdict: "wrong",
            feedback: "致命错误！「再做几单就能提」是连环收割，越做窟窿越大。已经垫的钱，永远提不出来。",
          },
          {
            text: "「我把这个套路发到校园反诈志愿团，让大家都看看。」",
            nextNodeId: "r3-end-secret", bust: true, bustScore: 3, verdict: "right",
            feedback: "格局打开！把识破的套路分享出去，你的经验能帮整个校园躲过这个坑。",
          },
        ],
      },
      { id: "r3-end-perfect", kind: "ending", scene: "结局", text: "你截图报警，反诈中心反馈说那个微信号关联了多起学生受骗案。辅导员在班会上点名表扬了你——「这位同学识破得早，还帮大家挡了个坑。」那8块钱，你后来捐给了校园反诈宣传栏。", isEnding: true, endingId: "r3-perfect" },
      { id: "r3-end-good", kind: "ending", scene: "结局", text: "你拉黑了客服，把这事告诉了室友。第二天宿舍群里又有人转那条广告，你立刻提醒大家别信。几个同学悄悄感谢你——原来他们都差点心动。", isEnding: true, endingId: "r3-good" },
      { id: "r3-end-normal", kind: "ending", scene: "结局", text: "你没做连单，但也没截图报警，只是默默退出了群。后来听说同楼有个同学被骗了几千块，你心里有点不是滋味——早知道举报一下就好了。", isEnding: true, endingId: "r3-normal" },
      { id: "r3-end-bad", kind: "ending", scene: "结局", text: "你做了连单，垫了2000多，客服说「再做最后一单就能提」。最后一单又是最后一单。等你反应过来，小美已经把你拉黑，那2000多是你一个月的生活费。", isEnding: true, endingId: "r3-bad" },
      { id: "r3-end-secret", kind: "ending", scene: "结局", text: "你把整个套路整理成图文发到校园反诈志愿团，阅读量破千。一周后校保卫处找到你：「同学，你这篇帖子帮我们拦住了3起同类诈骗，要不要来当反诈宣传员？」你没想到，识破一个骗局还能点亮一条新赛道。", isEnding: true, endingId: "r3-secret" },
    ],
    endings: [
      { id: "r3-perfect", type: "perfect", title: "见微知著", desc: "你识破刷单违法本质，截图报警，还帮警方关联了多起案件。", lesson: "刷单违法，且「先垫后返」是诈骗结构。8块钱的甜头不值得搭上一个月生活费——尝到甜头就该警惕，那是诱饵不是收益。", icon: "🏆", color: "#FFD700" },
      { id: "r3-good", type: "good", title: "独善兼济", desc: "你拉黑止损，还提醒了室友和同学，护住了一个宿舍。", lesson: "识破骗局后分享出去，价值翻倍。你的一句提醒，可能就是别人的止损线。", icon: "🛡️", color: "#52C41A" },
      { id: "r3-normal", type: "normal", title: "独善其身", desc: "你退出了骗局，但没举报，后来听说有同学被骗，心里不是滋味。", lesson: "止损是第一步，举报是第二步。你的截图和举报，可能就是别人避免损失的关键。", icon: "📌", color: "#7A8FB0" },
      { id: "r3-bad", type: "bad", title: "连环收割", desc: "你在连单陷阱里越垫越多，最终被拉黑，损失了一个月生活费。", lesson: "「再做最后一单就能提」是刷单诈骗最毒的话术。已经垫的钱是沉没成本，别为了捞回而继续加码——窟窿只会越来越大。", icon: "💔", color: "#FF4D4F" },
      { id: "r3-secret", type: "secret", title: "反诈宣传员", desc: "你把套路分享到校园反诈志愿团，帮校方拦住了3起同类诈骗。", lesson: "识破骗局后的分享，是反诈最有力的传播。你的经验从「自保」升级为「守护」，这是反诈意识最美的样子。", icon: "🌟", color: "#B388FF" },
    ],
  },

  // ============ RPG-004：AI换脸冒充领导 ============
  {
    id: "RPG-004",
    fraudTypeId: "F116",
    fraudType: "AI实时换脸视频通话诈骗",
    title: "老板的视频会议",
    difficulty: 4,
    scenario: "临近下班，公司老板微信让你加入一个紧急视频会议。视频里那张脸、那个声音，都和老板一模一样。作为财务，你被要求立刻转一笔「收购诚意金」。AI换脸的时代，眼见不再为实。",
    playerRole: "公司财务",
    tags: ["AI换脸", "视频诈骗", "财务安全", "深度伪造", "紧急转账"],
    startNodeId: "r4-n1",
    passThreshold: 3,
    relatedLessonId: "CHAPTER-04",
    rewardTalentPoints: 3,
    nodes: [
      {
        id: "r4-n1", kind: "narrative",
        scene: "公司·17:48",
        text: "微信弹出老板的头像：「小李，紧急，加这个会议号，现在。」你心跳加快，点进视频会议——屏幕里确实是老板的脸，连说话的语气都一样：「有个收购项目，对方要今天到账诚意金，你走一下对公，38万。」",
        deconstruct: "AI换脸诈骗的入场永远是「紧急+权威」——用老板的身份和紧迫感让你来不及核实，财务是这类诈骗的头号目标。",
      },
      {
        id: "r4-n2", kind: "dialogue", speaker: "「老板」（视频中）",
        scene: "视频会议",
        text: "「小李，这笔很急，对方等着签约，财务那边你直接走特批，我在外地信号不好，不方便打电话。」视频里的「老板」皱着眉，语气不容置疑，「操作完截图发我，晚点我补签字。」",
        psychology: ["权威压迫", "紧迫催促", "规避核实"],
        redFlag: 4,
        choices: [
          {
            text: "「老板，按流程大额转账需要电话核实，我打您手机确认下。」",
            nextNodeId: "r4-n3", bust: true, bustScore: 2, verdict: "right",
            feedback: "关键识破！「规避核实」是AI换脸诈骗的核心破绽——真老板不会拒绝电话核实，骗子才怕你打电话。",
          },
          {
            text: "「那走特批流程，我先转了再补签字。」",
            nextNodeId: "r4-n3", verdict: "warn", bustScore: 0,
            feedback: "「先转后补」是财务大忌。任何大额转账都必须先核实身份，流程不是障碍，是防线。",
          },
          {
            text: "「好的老板，我马上操作。」",
            nextNodeId: "r4-n3", verdict: "wrong",
            feedback: "危险！38万不是小数目，视频里的脸可能是AI合成的。没有电话核实就转账，等于把公司钱送出去。",
          },
        ],
      },
      {
        id: "r4-n3", kind: "examine",
        scene: "工位·你仔细观察视频",
        text: "你借口「查账户」暂停了几秒，仔细盯住视频画面。老板的脸在动，但有几个细节让你起疑。",
        psychology: ["深度伪造破绽", "细节观察"],
        redFlag: 5,
        deconstruct: "AI换脸的破绽：①眨眼频率异常 ②嘴唇和声音轻微不同步 ③转头时边缘有模糊 ④光线方向和现场不符。暂停放大看，破绽更明显。",
        choices: [
          {
            text: "放大画面，发现眨眼频率异常、嘴角和声音有轻微延迟。",
            nextNodeId: "r4-n4", bust: true, bustScore: 2, verdict: "right",
            feedback: "专业！AI换脸的破绽藏在细节里——眨眼、口型同步、边缘模糊都是识别点。财务的敏锐观察救了公司38万。",
          },
          {
            text: "画面看着挺正常，没看出问题。",
            nextNodeId: "r4-n4", verdict: "warn", bustScore: 0,
            feedback: "AI换脸越来越逼真，肉眼难辨。但「规避电话核实」本身就是红旗，不必只靠眼睛判断。",
          },
        ],
      },
      {
        id: "r4-n4", kind: "decision",
        scene: "工位·视频仍在继续",
        text: "「老板」催促：「小李，怎么还没动？对方在催了，这单谈下来公司下半年都稳了。」视频里他甚至站起来，背景是「酒店房间」。你必须立刻决定。",
        psychology: ["紧迫升级", "利益诱惑", "场景伪造"],
        redFlag: 5,
        deconstruct: "骗子会配合场景演戏——「酒店」「出差」是为了解释为什么不能当面核实。越是「出差+信号不好+特批」，越要警惕。",
        choices: [
          {
            text: "「老板，按规定大额转账必须电话+双人核实，我现在拨您登记的手机。」",
            nextNodeId: "r4-n5", bust: true, bustScore: 2, verdict: "right",
            feedback: "坚持流程！大额转账的电话+双人核实是财务的铁律，真老板会理解，骗子会发慌。",
          },
          {
            text: "「那您发个语音确认下，我就转。」",
            nextNodeId: "r4-n5", verdict: "warn", bustScore: 1,
            feedback: "语音也能AI合成。核实要走「多渠道交叉」——电话、当面、或已知号码回拨，单一渠道都不够。",
          },
          {
            text: "「好的，我现在就走特批流程转账。」",
            nextNodeId: "r4-n5", verdict: "wrong",
            feedback: "致命错误！38万一旦转出，追回极难。AI换脸时代，视频不是身份证明。",
          },
        ],
      },
      {
        id: "r4-n5", kind: "decision", speaker: "「老板」（视频中）",
        scene: "视频会议·最后施压",
        text: "「老板」的语气变了：「小李，你是不是不信任我？这种执行力怎么担大任？」视频画面突然卡顿了一下，又恢复。「就两分钟的事，转完截图发我，明天当面向你解释。」",
        psychology: ["情感绑架", "前途施压", "画面卡顿破绽"],
        redFlag: 5,
        choices: [
          {
            text: "「画面刚才卡顿了，我怀疑是AI合成。我已联系老板助理核实，并报了网管。」",
            nextNodeId: "r4-end-perfect", bust: true, bustScore: 3, verdict: "right",
            feedback: "完美应对！联系助理交叉核实+报网管，是识破AI换脸诈骗的标准动作。你的专业救了公司一笔大钱。",
          },
          {
            text: "「我不转了，您明天当面再说。」然后退出会议。",
            nextNodeId: "r4-end-good", bust: true, bustScore: 2, verdict: "right",
            feedback: "果断止损！退出会议+延后处理，是面对可疑转账的安全做法。",
          },
          {
            text: "「老板别生气，我马上转。」",
            nextNodeId: "r4-end-bad", verdict: "wrong",
            feedback: "致命错误！「情感绑架」是骗子最后的杀手锏。一旦你被「不信任」「执行力」绑架，38万就没了。",
          },
          {
            text: "「我录下这段视频，发到公司安全群让大家一起判断。」",
            nextNodeId: "r4-end-secret", bust: true, bustScore: 3, verdict: "right",
            feedback: "高招！把可疑视频发到安全群交叉判断，集体的眼睛比一个人更亮。这也是反诈的团队力量。",
          },
        ],
      },
      { id: "r4-end-perfect", kind: "ending", scene: "结局", text: "你联系老板助理，真正的老板正在开会，根本没开过视频会议。公司安全部介入，发现这是一个用AI换脸伪造老板形象的精准诈骗。老板第二天当面感谢你：「小李，你的流程意识救了公司38万，这笔钱够发你半年奖金了。」", isEnding: true, endingId: "r4-perfect" },
      { id: "r4-end-good", kind: "ending", scene: "结局", text: "你退出会议没转账。第二天核实，果然是诈骗。老板虽然被你「不信任」气了一下，但听完经过后拍拍你肩膀：「以后遇到这种事，先核实没错，是我该表扬你。」", isEnding: true, endingId: "r4-good" },
      { id: "r4-end-normal", kind: "ending", scene: "结局", text: "你犹豫了很久，最终没转，但也没立刻核实。第二天同事说，隔壁公司财务就被同样的套路骗了20万。你后背一凉——原来昨晚自己也站在悬崖边。", isEnding: true, endingId: "r4-normal" },
      { id: "r4-end-bad", kind: "ending", scene: "结局", text: "你被「执行力」「前途」绑架，转了38万。第二天真正的老板听说后愣住：「我昨晚根本没找你。」公司报警，但钱已被拆分转走。你站在财务室，手还在抖。", isEnding: true, endingId: "r4-bad" },
      { id: "r4-end-secret", kind: "ending", scene: "结局", text: "你把视频发到公司安全群，几个同事一眼看出「老板」的眨眼频率不对。公司安全部顺藤摸瓜，发现这是针对多家公司的定向AI换脸诈骗团伙——你的一个截图，成了警方破案的关键证据。", isEnding: true, endingId: "r4-secret" },
    ],
    endings: [
      { id: "r4-perfect", type: "perfect", title: "流程卫士", desc: "你识破AI换脸，坚持电话核实+报网管，保住了公司38万。", lesson: "AI换脸时代，视频不是身份证明。大额转账的电话+双人核实是财务的铁律——流程不是束缚，是守护。", icon: "🏆", color: "#FFD700" },
      { id: "r4-good", type: "good", title: "果断止损", desc: "你退出会议延后处理，第二天核实果然是诈骗。", lesson: "面对可疑转账，「先停下、再核实」永远比「赶紧办」安全。一时的尴尬好过一夜的懊悔。", icon: "🛡️", color: "#52C41A" },
      { id: "r4-normal", type: "normal", title: "悬崖边上", desc: "你犹豫后没转，但没立刻核实，第二天才惊觉自己离骗局多近。", lesson: "没被骗是运气，识破并核实才是本事。下次别赌运气，赌流程。", icon: "📌", color: "#7A8FB0" },
      { id: "r4-bad", type: "bad", title: "情感绑架", desc: "你被「执行力」「前途」绑架，转出了38万，钱被迅速转走。", lesson: "骗子最爱用「不信任我」「执行力」绑架你。真正的领导会理解核实，假领导才催你绕过流程。", icon: "💔", color: "#FF4D4F" },
      { id: "r4-secret", type: "secret", title: "团队之眼", desc: "你把可疑视频发到安全群，集体的眼睛识破了AI换脸，还顺出了一条犯罪线索。", lesson: "反诈不是一个人的事。把可疑信息交给团队判断，集体的眼睛比AI更亮——这是AI时代反诈的团队力量。", icon: "🌟", color: "#B388FF" },
    ],
  },

  // ============ RPG-005：数字人民币钱包权限委托诈骗 ============
  {
    id: "RPG-005",
    fraudTypeId: "F117",
    fraudType: "数字人民币钱包权限委托诈骗",
    title: "数字钱包升级",
    difficulty: 3,
    scenario: "你收到一条短信，说数字人民币钱包需要「升级授权」，否则功能受限。一位「客服」主动来指导你操作，话术专业又耐心。但数字钱包的权限一旦委托出去，钱就不再只属于你了。",
    playerRole: "数字钱包用户",
    tags: ["数字人民币", "钱包升级", "权限委托", "验证码", "授权陷阱"],
    startNodeId: "r5-n1",
    passThreshold: 3,
    relatedLessonId: "CHAPTER-05",
    rewardTalentPoints: 2,
    nodes: [
      {
        id: "r5-n1", kind: "narrative",
        scene: "家中·下午",
        text: "手机弹出短信：「【数字钱包】您的钱包需升级授权，否则将限制收付款功能，请点击链接完成认证。」你刚用过数字人民币付款，心里一紧，点开了链接。页面做得和官方一模一样，一位「客服」很快就拨通了你的电话。",
        deconstruct: "数字人民币钱包诈骗的入口是「功能受限」恐吓——用「限制收付」制造紧迫，让你来不及核实就点链接。",
      },
      {
        id: "r5-n2", kind: "dialogue", speaker: "「客服」",
        scene: "电话+网页",
        text: "「先生您好，您的钱包需要升级到「企业级权限」才能继续使用，我远程指导您操作。请先打开钱包，找到『权限委托』，授权给「钱包安全服务」。」客服语气专业，还贴心地解释每一步。",
        psychology: ["权威伪装", "耐心建立信任", "权限委托陷阱"],
        redFlag: 4,
        choices: [
          {
            text: "「数字人民币官方不会要权限委托，这不对劲。」",
            nextNodeId: "r5-n3", bust: true, bustScore: 2, verdict: "right",
            feedback: "识破核心红旗！「权限委托」是这类诈骗的关键——一旦授权，对方就能操作你的钱包。官方绝不会要你委托权限。",
          },
          {
            text: "「那按你说的，我去找『权限委托』。」",
            nextNodeId: "r5-n3", verdict: "warn", bustScore: 0,
            feedback: "警惕性不足。「权限委托」这四个字本身就是危险信号，任何要你「授权」操作的都要立刻停止。",
          },
          {
            text: "「好的，我授权，需要填什么？」",
            nextNodeId: "r5-n3", verdict: "wrong",
            feedback: "危险！权限委托=把钱包钥匙交出去。一旦授权，对方可以代替你操作钱包资金。",
          },
        ],
      },
      {
        id: "r5-n3", kind: "examine",
        scene: "家中·你检查短信和链接",
        text: "你多留了个心眼，仔细看了那条短信和链接，还查了查数字人民币官方的公告。",
        psychology: ["链接核实", "官方渠道对照"],
        redFlag: 4,
        deconstruct: "检查三件事：①短信发送号码是不是官方号段 ②链接域名是否为官方域名 ③官方APP内是否有升级通知——官方升级永远在APP内完成，不会发链接。",
        choices: [
          {
            text: "发现链接域名是仿冒的，官方APP内并无升级通知。",
            nextNodeId: "r5-n4", bust: true, bustScore: 2, verdict: "right",
            feedback: "专业核查！仿冒域名+APP内无通知，双红旗已亮。官方升级只在APP内进行，外链都是钓鱼。",
          },
          {
            text: "短信看着挺正式，没多查。",
            nextNodeId: "r5-n4", verdict: "warn", bustScore: 0,
            feedback: "短信签名可以伪造。核实要走官方APP和客服热线，而不是短信里的链接。",
          },
        ],
      },
      {
        id: "r5-n4", kind: "decision",
        scene: "电话中·客服催促",
        text: "客服的语气急了点：「先生，今天不升级，今晚12点您的钱包就会被冻结，里面的钱也取不出来。只要授权一下，5分钟就好。」她还发来一条「验证码」，让你填到「升级页面」。",
        psychology: ["冻结恐吓", "验证码索要", "紧迫催促"],
        redFlag: 5,
        deconstruct: "「验证码」是最后一道防线——任何索要验证码的都是诈骗。验证码=密码，给出去等于把钱包交出去。",
        choices: [
          {
            text: "「验证码绝不给任何人。我挂了，自己打官方客服核实。」",
            nextNodeId: "r5-n5", bust: true, bustScore: 2, verdict: "right",
            feedback: "守住底线！验证码是资金的最后一道门，任何「升级」「解冻」要验证码的都是诈骗。挂断+自行核实是黄金法则。",
          },
          {
            text: "「那我把验证码报给你，升级完就没事了吧？」",
            nextNodeId: "r5-n5", verdict: "warn", bustScore: 0,
            feedback: "危险！验证码一旦给出，钱包就失控了。「升级完就好」是骗子的话术，根本不会停下来。",
          },
          {
            text: "「那我授权并填验证码，快点升级。」",
            nextNodeId: "r5-n5", verdict: "wrong",
            feedback: "致命错误！权限委托+验证码=钱包完全失控。这两样一起给，等于亲手把钱包交出去。",
          },
        ],
      },
      {
        id: "r5-n5", kind: "decision", speaker: "「客服」",
        scene: "电话中·最后诱导",
        text: "（若你已犹豫）客服换了个温柔的语气：「先生，我理解您谨慎，但这是为了您的钱包安全。我帮您远程操作，您只要点一下『同意授权』就行，其他我来。」",
        psychology: ["远程操控", "情感软化为"],
        redFlag: 5,
        choices: [
          {
            text: "「远程操控我的钱包？绝不。已挂断，打官方95开头条码核实。」",
            nextNodeId: "r5-end-perfect", bust: true, bustScore: 3, verdict: "right",
            feedback: "完美！远程操控是诈骗的终极手段，一旦同意对方就能操作你手机里的一切。挂断+官方核实是唯一正确做法。",
          },
          {
            text: "「我不授权了，挂了。」然后拉黑。",
            nextNodeId: "r5-end-good", bust: true, bustScore: 2, verdict: "right",
            feedback: "止损成功！拉黑+退出，是面对可疑操作的安全做法。",
          },
          {
            text: "「那你远程帮我操作吧，我点同意。」",
            nextNodeId: "r5-end-bad", verdict: "wrong",
            feedback: "致命错误！远程操控+权限委托+验证码，三件套齐了，钱包必然失守。",
          },
          {
            text: "「我先打96110问问这是不是诈骗。」",
            nextNodeId: "r5-end-secret", bust: true, bustScore: 3, verdict: "right",
            feedback: "明智！96110是反诈专线，一个电话就能确认这是不是骗局。这种「先问再办」的习惯，能挡掉大半新型诈骗。",
          },
        ],
      },
      { id: "r5-end-perfect", kind: "ending", scene: "结局", text: "你挂断电话，拨打了数字人民币官方客服，对方明确说：「我们绝不会要权限委托和验证码，这是诈骗。」你顺手举报了那个号码和链接。一周后反诈中心反馈：你的举报帮他们拦住了一批同类诈骗短信。", isEnding: true, endingId: "r5-perfect" },
      { id: "r5-end-good", kind: "ending", scene: "结局", text: "你拉黑了客服，没授权也没给验证码。虽然心里还嘀咕「钱包会不会真被冻结」，但打开官方APP一看，一切正常。你松了口气，把那条短信也删了。", isEnding: true, endingId: "r5-good" },
      { id: "r5-end-normal", kind: "ending", scene: "结局", text: "你没授权，但也没立刻核实，心里不踏实。第二天看到新闻说「数字钱包升级诈骗」高发，才彻底放心。你把新闻转给家人，提醒他们也别信这种短信。", isEnding: true, endingId: "r5-normal" },
      { id: "r5-end-bad", kind: "ending", scene: "结局", text: "你授权了权限、报了验证码，客服说「升级完成」就挂了。第二天你打开钱包，余额空了，转账记录显示钱被转到一个陌生账户。你报警，警察说权限委托让追回极难。", isEnding: true, endingId: "r5-bad" },
      { id: "r5-end-secret", kind: "ending", scene: "结局", text: "你打96110一问，接线员立刻说：「这是新型数字钱包诈骗，我们正在预警拦截，您举报得正是时候。」你顺手把诈骗链接发过去，没想到帮反诈中心更新了当天的预警词库——可能有几万人因为你的一个电话，没收到那条短信。", isEnding: true, endingId: "r5-secret" },
    ],
    endings: [
      { id: "r5-perfect", type: "perfect", title: "权限守门人", desc: "你识破权限委托陷阱，守住验证码，挂断后官方核实并举报。", lesson: "数字人民币官方绝不会要你「权限委托」和「验证码」。权限是钱包的钥匙，验证码是最后一道门——这两样，谁来要都不给。", icon: "🏆", color: "#FFD700" },
      { id: "r5-good", type: "good", title: "及时退出", desc: "你拉黑客服，没授权没给验证码，保住了钱包。", lesson: "面对可疑操作，「先退出再核实」永远安全。官方APP里没有通知，就是最好的通知。", icon: "🛡️", color: "#52C41A" },
      { id: "r5-normal", type: "normal", title: "后怕庆幸", desc: "你虽没被骗，但没立刻核实，看到新闻才彻底放心。", lesson: "新型诈骗层出不穷，别等新闻提醒才放心。「先核实再操作」是数字时代的钱包保险栓。", icon: "📌", color: "#7A8FB0" },
      { id: "r5-bad", type: "bad", title: "权限失守", desc: "你授权了权限、交出验证码，钱包余额被转空，追回极难。", lesson: "权限委托+验证码=钱包完全失控。这两样一起给，等于把钱包和钥匙一起交出去。再「专业」的客服，要这两样都是骗子。", icon: "💔", color: "#FF4D4F" },
      { id: "r5-secret", type: "secret", title: "预警先锋", desc: "你打96110核实，举报帮反诈中心更新了预警词库，拦住了一批诈骗短信。", lesson: "96110不只能核实，还能联动预警。你的一次举报，可能让几万人没收到那条诈骗短信——这就是反诈的蝴蝶效应。", icon: "🌟", color: "#B388FF" },
    ],
  },

  // ============ RPG-006：加密货币杀猪盘 ============
  {
    id: "RPG-006",
    fraudTypeId: "F118",
    fraudType: "加密货币杀猪盘诈骗",
    title: "币圈群友的暴富梦",
    difficulty: 3,
    scenario: "你刚接触加密货币，币圈群里一位热心的「老韭菜」主动加你，拉你进一个「代挖群」。群友天天晒收益，导师说「稳赚不赔」。但加密货币杀猪盘的剧本，远比K线更狡猾。",
    playerRole: "刚接触加密货币的年轻人",
    tags: ["加密货币", "杀猪盘", "代挖陷阱", "提现缴税", "USDT"],
    startNodeId: "r6-n1",
    passThreshold: 3,
    relatedLessonId: "CHAPTER-06",
    rewardTalentPoints: 3,
    nodes: [
      {
        id: "r6-n1", kind: "narrative",
        scene: "币圈群·晚上",
        text: "群里有人@你：「兄弟，看你问USDT怎么买，我带你进个「代挖群」，导师带单，稳赚。」你刚入圈，对各种术语一知半解，被拉进了一个百人群。群公告写着：「每日收益3%-8%，本金随时可提」。",
        deconstruct: "加密货币杀猪盘的入口是「老韭菜带新韭菜」——用群友背书和「稳赚」承诺，降低你对陌生平台的警惕。",
      },
      {
        id: "r6-n2", kind: "dialogue", speaker: "「导师」阿凯",
        scene: "代挖群+私聊",
        text: "「兄弟，我们这是『云算力代挖』，你充值USDT，平台帮你挖币，每天返收益。」阿凯发来一张张群友晒单图——有人晒「日入2000U」，有人晒「提现到账」。「新人有福利，充100U返10U体验金，先试试水？」",
        psychology: ["利益诱惑", "群友晒单背书", "体验金钩子"],
        redFlag: 3,
        choices: [
          {
            text: "「日收益3%-8%？这收益率远超正常理财，必然是资金盘。」",
            nextNodeId: "r6-n3", bust: true, bustScore: 2, verdict: "right",
            feedback: "识破核心红旗！日化3%-8%意味着年化上千倍，这在任何正经投资里都不可能。高收益=资金盘的铁证。",
          },
          {
            text: "「群友都在赚，那充100U试试水也行。」",
            nextNodeId: "r6-n3", verdict: "warn", bustScore: 0,
            feedback: "「群友晒单」可以全是托。100U体验金是钩子，让你尝甜头后加大投入。",
            psychology: ["从众心理", "尝甜头效应"],
          },
          {
            text: "「那我充1000U，多赚点。」",
            nextNodeId: "r6-n3", verdict: "wrong",
            feedback: "危险！在未核实平台资质前充值，等于送钱。加密货币转账不可逆，钱进去就难出来。",
          },
        ],
      },
      {
        id: "r6-n3", kind: "examine",
        scene: "你搜索平台信息",
        text: "你上网查了查这个「代挖平台」，还核对了下阿凯晒的群友图。",
        psychology: ["平台资质核实", "图片真伪判断"],
        redFlag: 4,
        deconstruct: "检查三件事：①平台是否有正规交易所备案 ②群友晒图是否批量伪造（相同金额、不同头像） ③提现是否需要「缴税」「认证金」——任何提现前置收费都是诈骗。",
        choices: [
          {
            text: "查到平台无任何备案，晒图金额雷同疑似批量伪造。",
            nextNodeId: "r6-n4", bust: true, bustScore: 2, verdict: "right",
            feedback: "专业核查！无备案+晒图雷同，是加密货币杀猪盘的标准配置。正规交易所都有公开备案。",
          },
          {
            text: "只看了晒图就信了。",
            nextNodeId: "r6-n4", verdict: "warn", bustScore: 0,
            feedback: "晒图可以批量伪造。判断平台要查备案、看白皮书，而不是看群里几张图。",
          },
        ],
      },
      {
        id: "r6-n4", kind: "decision",
        scene: "私聊·阿凯催促",
        text: "阿凯发来：「兄弟，今天有个『内部名额』，充值5000U送500U体验金，名额就3个，群友都抢疯了。」群里刷屏「已上车」「感谢导师」。你必须决定。",
        psychology: ["稀缺催促", "群友抢购", "内部名额"],
        redFlag: 4,
        deconstruct: "「内部名额+群友抢购」是杀猪盘的连环话术——用稀缺性和从众效应逼你来不及思考。真正的好机会不需要催你充值。",
        choices: [
          {
            text: "「不投了，平台无备案，晒图也造假。」",
            nextNodeId: "r6-n5", bust: true, bustScore: 2, verdict: "right",
            feedback: "果断退出！识破无备案+晒图造假后及时止损，是面对加密货币杀猪盘最聪明的做法。",
          },
          {
            text: "「那充500U小试，大额不做。」",
            nextNodeId: "r6-n5", verdict: "warn", bustScore: 1,
            feedback: "「小试」是侥幸心理。加密货币杀猪盘前期会返你甜头，让你加大投入，500U也可能是损失的起点。",
          },
          {
            text: "「那我充5000U抢名额。」",
            nextNodeId: "r6-n5", verdict: "wrong",
            feedback: "危险！在无备案平台充5000U，等于直接送钱。「内部名额」是话术，不是机会。",
          },
        ],
      },
      {
        id: "r6-n5", kind: "decision", speaker: "「导师」阿凯",
        scene: "私聊·最后收割",
        text: "（若你已充值）阿凯发来：「兄弟，你账户盈利翻倍了！但提现需先缴10%「个人所得税」+500U「反洗钱认证金」，缴清一次性提现。」（若你没充）阿凯还在发「今日收益榜」诱惑你回心转意。",
        psychology: ["提现前置收费", "沉没成本绑架", "连环收割"],
        redFlag: 5,
        choices: [
          {
            text: "「提现要交钱=100%诈骗。立即止损报警，保留转账记录。」",
            nextNodeId: "r6-end-perfect", bust: true, bustScore: 3, verdict: "right",
            feedback: "完美识破！「提现缴税」是加密货币杀猪盘的铁证，任何提现前置收费都是诈骗。立即报警+保留链上转账记录是关键。",
          },
          {
            text: "「那我不提了，先把本金退出来。」",
            nextNodeId: "r6-end-good", bust: true, bustScore: 2, verdict: "right",
            feedback: "止损意识好，但对方多半不会让你「只退本金」。要立刻报警，链上转账记录是证据。",
          },
          {
            text: "「那交500U认证金，提出来就退出。」",
            nextNodeId: "r6-end-bad", verdict: "wrong",
            feedback: "致命错误！「提现缴税」「认证金」是连环收割，交了只会被套更深。已经损失的钱是沉没成本，别为捞回而继续加码。",
          },
          {
            text: "「我把这个套路发到加密货币反诈社区，让大家都避坑。」",
            nextNodeId: "r6-end-secret", bust: true, bustScore: 3, verdict: "right",
            feedback: "格局打开！把识破的套路分享到反诈社区，你的经验能帮一群新手躲过这个坑——加密圈的反诈，尤其需要老手带新手。",
          },
        ],
      },
      { id: "r6-end-perfect", kind: "ending", scene: "结局", text: "你截图保留了所有聊天和转账记录，立刻报警。警察说链上转账记录是关键证据，帮你冻结了部分涉案地址。虽然钱未必全追回，但你止损及时，还成了反诈中心的协查证人。", isEnding: true, endingId: "r6-perfect" },
      { id: "r6-end-good", kind: "ending", scene: "结局", text: "你退出群聊，拉黑了阿凯，没交认证金。虽然之前充的几百U没能追回，但你及时止损，没有陷得更深。你在日记里写下：「币圈水深，先学再投。」", isEnding: true, endingId: "r6-good" },
      { id: "r6-end-normal", kind: "ending", scene: "结局", text: "你退出了，但心里还有点不甘心——「万一真能提呢？」一周后你看到新闻，那个平台跑路了，群里几百人血本无归。你后背一凉，庆幸自己没交那笔认证金。", isEnding: true, endingId: "r6-normal" },
      { id: "r6-end-bad", kind: "ending", scene: "结局", text: "你交了认证金，账户显示「盈利翻倍」，却再也提不出来。阿凯把你拉黑，平台也打不开了。你盯着链上记录，那笔钱被拆分转进了混币器。报警后警察说，链上追查极难。", isEnding: true, endingId: "r6-bad" },
      { id: "r6-end-secret", kind: "ending", scene: "结局", text: "你把整个套路整理成图文发到加密货币反诈社区，阅读量破万。一周后社区管理员联系你：「兄弟，你这篇帖子让3个新手在最后关头退出了充值，有个还来道谢。」你没想到，识破一个骗局，还能在币圈点燃一盏灯。", isEnding: true, endingId: "r6-secret" },
    ],
    endings: [
      { id: "r6-perfect", type: "perfect", title: "链上止损", desc: "你识破提现缴税陷阱，保留链上记录报警，成为反诈协查证人。", lesson: "加密货币杀猪盘的铁证是「提现要交钱」。链上转账不可逆，所以事前核查平台、事后保留记录比追钱更重要——报警永远比转账管用。", icon: "🏆", color: "#FFD700" },
      { id: "r6-good", type: "good", title: "及时抽身", desc: "你拉黑导师没交认证金，虽损失几百U但及时止损。", lesson: "已经损失的钱是沉没成本。别为了「捞回」而继续加码，止损本身就是胜利——币圈先学会不亏，再谈赚。", icon: "🛡️", color: "#52C41A" },
      { id: "r6-normal", type: "normal", title: "险过一关", desc: "你退出后还有点不甘心，看到平台跑路新闻才彻底醒悟。", lesson: "「万一能提」是沉没成本在作祟。提现要交钱=诈骗，这个判断不需要犹豫，也不需要侥幸。", icon: "📌", color: "#7A8FB0" },
      { id: "r6-bad", type: "bad", title: "连环收割", desc: "你交了认证金，账户「盈利翻倍」却提不出来，钱被转进混币器。", lesson: "「提现缴税」「认证金」是连环收割，交了只会被套更深。加密货币转账不可逆，一旦交出去，追回希望渺茫——别让沉没成本绑架你的下一步。", icon: "💔", color: "#FF4D4F" },
      { id: "r6-secret", type: "secret", title: "币圈点灯人", desc: "你把套路分享到反诈社区，帮3个新手在最后关头退出充值。", lesson: "币圈的反诈，尤其需要老手带新手。你识破后的一次分享，可能就是别人悬崖勒马的最后一根稻草——这是加密世界最稀缺的善意。", icon: "🌟", color: "#B388FF" },
    ],
  },
];

// ===========================================================================
// ===== v7 RPG 剧本辅助函数 =================================================
// ===========================================================================

/** 根据 ID 获取 RPG 剧本 */
export function getRPGScenarioById(id: string): ThunderRPGScenarioDef | undefined {
  return THUNDER_RPG_SCENARIOS.find((s) => s.id === id);
}

/** 根据节点 ID 在剧本中查找节点 */
export function getRPGNodeById(scenario: ThunderRPGScenarioDef, nodeId: string): ThunderRPGNodeDef | undefined {
  return scenario.nodes.find((n) => n.id === nodeId);
}

/** 根据结局 ID 在剧本中查找结局 */
export function getRPTEndingById(scenario: ThunderRPGScenarioDef, endingId: string): ThunderRPGEndingDef | undefined {
  return scenario.endings.find((e) => e.id === endingId);
}

/** 随机挑选一个 RPG 剧本 */
export function pickRandomRPGScenario(): ThunderRPGScenarioDef {
  return THUNDER_RPG_SCENARIOS[Math.floor(Math.random() * THUNDER_RPG_SCENARIOS.length)];
}

/** 根据诈骗类型 ID 筛选剧本 */
export function getRPGScenariosByFraudType(fraudTypeId: string): ThunderRPGScenarioDef[] {
  return THUNDER_RPG_SCENARIOS.filter((s) => s.fraudTypeId === fraudTypeId);
}

/**
 * 根据识破分数计算结局（用于引擎在节点未显式指向结局时兜底判断）
 * 规则：
 *  - bustScore >= passThreshold + 2 → perfect（完美识破）
 *  - bustScore >= passThreshold + 1 → good
 *  - bustScore >= passThreshold → normal
 *  - bustScore >= Math.max(1, passThreshold - 1) → bad（部分识破仍被骗）
 *  - 否则 → bad（失败结局）
 * 若存在 secret 结局，优先返回（需调用方判断是否触发隐藏路径）
 */
export function calcRPGEnding(bustScore: number, scenario: ThunderRPGScenarioDef): ThunderRPGEndingDef {
  const t = scenario.passThreshold;
  let type: ThunderRPGEndingDef["type"];
  if (bustScore >= t + 2) type = "perfect";
  else if (bustScore >= t + 1) type = "good";
  else if (bustScore >= t) type = "normal";
  else type = "bad";
  // 优先匹配目标类型，否则回退到 bad
  return scenario.endings.find((e) => e.type === type) ?? scenario.endings.find((e) => e.type === "bad") ?? scenario.endings[0];
}

// ===== rpgScenarios.ts：v7 第一人称 RPG 剧本系统结束 =====
