import type { FBHotlineScript } from "../types";

// ============ v3 升级：96110 模拟通话剧本 ============
/**
 * 96110 反诈专线模拟通话器：玩家选择疑似遭遇的诈骗类型，
 * 接线员引导玩家核实关键点，最终给出"是否诈骗"判定。
 * 每个剧本对应一种诈骗类型，强化"挂断→96110核实"的肌肉记忆。
 */
export const HOTLINE_SCRIPTS_96110: FBHotlineScript[] = [
  {
    id: "HL-IMPOLICE", title: "怀疑遭遇冒充公检法",
    scenario: "你刚接到自称\"市局刑侦支队\"的电话，称你名下银行卡涉嫌洗钱，要求转账到\"安全账户\"清查。",
    typeId: "F01", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，这里是 96110 反诈专线。请描述一下对方说了什么？",
        choices: [
          { text: "对方说涉嫌洗钱，要转账到安全账户", next: "s2", verdict: "right", feedback: "这是典型的冒充公检法话术。" },
          { text: "对方让我下载APP做资金清查", next: "s2", verdict: "right", feedback: "下载陌生APP\"资金清查\"同样是诈骗套路。" },
          { text: "我已转账了，怎么办？", next: "s3", verdict: "warn", feedback: "请立即保留证据并到就近派出所报案。" },
        ],
      },
      {
        id: "s2",
        operator: "请记住：公检法不会电话办案，更不存在\"安全账户\"。对方还做了什么？",
        choices: [
          { text: "准确报出我的身份证号", next: "s3", verdict: "warn", feedback: "身份证号泄露需警惕，但不会改变诈骗性质。" },
          { text: "让我保密不能告诉家人", next: "s3", verdict: "right", feedback: "\"案件保密\"是核心话术，目的是阻止你寻求帮助。" },
          { text: "我没转账，已挂断", next: null, verdict: "right", ending: "verified", feedback: "正确处置！公检法不电话办案，挂断拨打96110核实是唯一正确做法。" },
        ],
      },
      {
        id: "s3",
        operator: "请到就近派出所当面核实，并下载国家反诈中心APP。如已转账，请保留所有聊天/转账记录作为证据。",
        choices: [
          { text: "好的，我立即去派出所", next: null, verdict: "right", ending: "verified", feedback: "正确！真警察会让你当面配合，不会让你转账。" },
          { text: "我再回拨那个号码确认", next: null, verdict: "wrong", ending: "scam", feedback: "错误！回拨骗子号码只会被进一步操控。请拨打96110或到派出所。" },
        ],
      },
    ],
    takeaways: [
      "公检法不会电话办案，更不存在\"安全账户\"",
      "真警察会让你到公安机关当面配合",
      "遇疑拨打 96110，不上当不转账",
    ],
  },
  {
    id: "HL-PIG", title: "怀疑遭遇杀猪盘",
    scenario: "网友带你投资，小额已提现，现在要求大额入金才能\"博高收益\"。",
    typeId: "F02", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方的引流方式？",
        choices: [
          { text: "交友软件认识的，暧昧后带我投资", next: "s2", verdict: "right", feedback: "情感铺垫+投资引流是杀猪盘标配。" },
          { text: "短视频平台理财导师拉群", next: "s2", verdict: "right", feedback: "短视频平台也是杀猪盘新引流渠道。" },
          { text: "已经提现成功了几次", next: "s2", verdict: "warn", feedback: "小额提现是诱饵，大额必然无法提现。" },
        ],
      },
      {
        id: "s2",
        operator: "提现时是否要求缴\"税\"或\"解冻金\"？",
        choices: [
          { text: "是，要交8%税+解冻金", next: "s3", verdict: "right", feedback: "提现要交钱=100%诈骗，立即停止转账。" },
          { text: "还没有提现，准备大额入金", next: "s3", verdict: "warn", feedback: "请立即停止入金，平台是诈骗平台。" },
          { text: "对方说保密别告诉别人", next: "s3", verdict: "right", feedback: "\"保密参与漏洞套利\"是核心话术。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即停止一切转账，保留所有聊天/转账记录，到就近派出所报案。已损失的钱追回难度大，止损才是赢家。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据是唯一正确路径。" },
          { text: "我想再投点把本金提回来", next: null, verdict: "wrong", ending: "scam", feedback: "错误！任何继续转账都是扩大损失。已损失的钱追不回。" },
        ],
      },
    ],
    takeaways: [
      "优质异性带投资=杀猪盘",
      "提现要交\"税\"\"解冻金\"=100%诈骗",
      "止损+报警+保留证据，已损失的钱追不回",
    ],
  },
  {
    id: "HL-BRUSH", title: "怀疑遭遇刷单诈骗",
    scenario: "做点赞关注任务已返佣几单，客服要求垫付500做连单，称返650。",
    typeId: "F03", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下任务流程？",
        choices: [
          { text: "点赞关注已返佣5-10元", next: "s2", verdict: "warn", feedback: "小额返佣是诱饵，下一步必然要求垫付。" },
          { text: "客服让我垫付500做连单", next: "s2", verdict: "right", feedback: "\"连单任务\"\"垫付\"是刷单诈骗核心话术。" },
          { text: "我已垫付3000，卡单要再垫付", next: "s3", verdict: "warn", feedback: "请立即停止转账并报警。" },
        ],
      },
      {
        id: "s2",
        operator: "刷单本身违法，前几单返利只为诱你加大投入。\"垫付连单\"=诈骗。",
        choices: [
          { text: "退群不做了", next: null, verdict: "right", ending: "verified", feedback: "正确！刷单即诈骗，及时止损。" },
          { text: "已经垫付500了，再做单回本", next: "s3", verdict: "wrong", feedback: "错误！\"卡单\"\"解冻\"是标准话术，越垫越深。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即报警并保留证据。任何\"继续转账才能提现\"的话术都是诈骗。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损报警是唯一出路。" },
          { text: "找客服理论要回本金", next: null, verdict: "wrong", ending: "scam", feedback: "错误！客服就是骗子，理论只会被进一步操控。" },
        ],
      },
    ],
    takeaways: [
      "刷单本身违法，返佣是诱饵",
      "\"垫付连单\"\"卡单解冻\"是标准话术",
      "止损+报警+保留证据，不继续转账",
    ],
  },
  {
    id: "HL-DEEPFAKE", title: "怀疑遭遇AI换脸/拟声",
    scenario: "收到\"子女\"语音急要培训费，或\"老友\"视频借款，画面声音都很像。",
    typeId: "F78", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方联系你的方式？",
        choices: [
          { text: "语音消息，声音像子女", next: "s2", verdict: "right", feedback: "AI拟声可克隆声音，3秒素材即可。" },
          { text: "视频通话，画面是本人", next: "s2", verdict: "right", feedback: "AI换脸可伪造视频，注意口型/光线破绽。" },
          { text: "已转账给对方", next: "s3", verdict: "warn", feedback: "请立即报警并联系银行尝试止付。" },
        ],
      },
      {
        id: "s2",
        operator: "AI换脸/拟声诈骗高发。请回拨原号码核实，切勿直接转账。",
        choices: [
          { text: "回拨原号码核实", next: null, verdict: "right", ending: "verified", feedback: "正确！回拨原号码是核实身份的铁律。" },
          { text: "视频里是本人放心转", next: null, verdict: "wrong", ending: "scam", feedback: "错误！AI换脸可伪造视频，必须二次电话核实。" },
          { text: "对方说手机丢了借同学的", next: "s3", verdict: "warn", feedback: "\"借同学手机\"是典型话术，更需核实。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天/转账记录。AI诈骗追赃难度大，止损优先。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "AI可换脸/拟声，3秒素材即可克隆",
      "回拨原号码电话核实是铁律",
      "口型偏差/画面卡顿/光线不自然是破绽",
    ],
  },
  {
    id: "HL-SPRING-TRAVEL", title: "怀疑遭遇春运退票诈骗",
    scenario: "收到\"铁路客服\"短信称列车停运，要求点击链接退票退款，需填银行卡信息。",
    typeId: "F82", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请告诉我短信里的链接是什么域名？",
        choices: [
          { text: "12306-refund.xyz 之类", next: "s2", verdict: "right", feedback: "非 12306.cn 域名一律是钓鱼。" },
          { text: "已点击并填了银行卡信息", next: "s3", verdict: "warn", feedback: "请立即冻结银行卡并报警。" },
          { text: "短信里有客服电话让我打", next: "s2", verdict: "warn", feedback: "短信中的客服电话不可信。" },
        ],
      },
      {
        id: "s2",
        operator: "官方退票只走 12306 官方APP或 12306.cn。任何其他域名都是钓鱼。",
        choices: [
          { text: "登录12306官方APP核实", next: null, verdict: "right", ending: "verified", feedback: "正确！退票只认12306官方渠道。" },
          { text: "按短信提示填银行卡退款", next: null, verdict: "wrong", ending: "scam", feedback: "错误！填银行卡信息=泄露卡号密码，资金将被盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即拨打银行客服冻结银行卡，并到就近派出所报案。",
        choices: [
          { text: "好的，我立即冻结银行卡", next: null, verdict: "right", ending: "verified", feedback: "正确！止付+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "退票只认 12306 官方APP或 12306.cn",
      "陌生链接一律不点，不填银行卡信息",
      "已泄露卡信息立即冻结银行卡+报警",
    ],
  },
];

/** 根据 ID 查询 96110 剧本 */
export function getHotlineScript(id: string): FBHotlineScript | undefined {
  return HOTLINE_SCRIPTS_96110.find((s) => s.id === id);
}
// ============ v4 升级：96110 通话剧本扩充 ============
/**
 * 补充 v2/v4 新增诈骗类型的 96110 剧本，覆盖 F88-F96 + F45-F52。
 * 每个剧本强化"挂断→96110核实"的肌肉记忆。
 */
export const HOTLINE_SCRIPTS_V4: FBHotlineScript[] = [
  {
    id: "HL-SECONDHAND", title: "怀疑遭遇二手平台诈骗",
    scenario: "闲鱼卖手机时\"客服\"称买家付款冻结，需缴纳2000元解冻保证金。",
    typeId: "F47", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"客服\"是怎么联系您的？",
        choices: [
          { text: "闲鱼私信发的消息", next: "s2", verdict: "warn", feedback: "闲鱼客服只在APP内沟通，私信可能是冒充。" },
          { text: "已经转账2000元保证金", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没转账，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "闲鱼客服只在APP内沟通，不收任何保证金/解冻金。请登录闲鱼APP核实订单状态。",
        choices: [
          { text: "登录闲鱼APP核实", next: null, verdict: "right", ending: "verified", feedback: "正确！闲鱼客服只在APP内，任何保证金都是诈骗。" },
          { text: "按客服指引转账保证金", next: null, verdict: "wrong", ending: "scam", feedback: "错误！任何保证金/解冻金都是诈骗，转账后被拉黑。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天/转账记录作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "闲鱼客服只在APP内沟通",
      "任何保证金/解冻金都是诈骗",
      "订单状态只在官方APP查看",
    ],
  },
  {
    id: "HL-DEEPFAKE-REALTIME", title: "怀疑遭遇AI实时换脸",
    scenario: "视频通话中\"领导\"急令代转账5万元，画面逼真但眨眼偏少。",
    typeId: "F45", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方是怎么联系您的？",
        choices: [
          { text: "视频通话，画面是领导", next: "s2", verdict: "right", feedback: "AI实时换脸可伪造视频通话。" },
          { text: "已转账5万元", next: "s3", verdict: "warn", feedback: "请立即报警并联系银行止付。" },
          { text: "挂断了来核实", next: "s2", verdict: "right", feedback: "正确！挂断核实是关键防线。" },
        ],
      },
      {
        id: "s2",
        operator: "AI实时换脸可伪造视频通话。请用通讯录原号码电话核实，切勿直接转账。",
        choices: [
          { text: "用通讯录原号码核实", next: null, verdict: "right", ending: "verified", feedback: "正确！原号码核实是铁律。" },
          { text: "视频里是本人放心转", next: null, verdict: "wrong", ending: "scam", feedback: "错误！AI换脸可伪造视频，必须二次电话核实。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系银行申请紧急止付，并到就近派出所报案。AI诈骗追赃难度大，止损优先。",
        choices: [
          { text: "好的，我立即止付报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止付+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "AI实时换脸可伪造视频通话",
      "用通讯录原号码电话核实是铁律",
      "眨眼频率低/画面卡顿是破绽",
    ],
  },
  {
    id: "HL-FAKE-JOB", title: "怀疑遭遇虚假招聘/培训贷",
    scenario: "面试通过后公司要求交1980元培训费，或协助办理19800元培训贷。",
    typeId: "F50", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下公司要求您做什么？",
        choices: [
          { text: "先交1980元培训费", next: "s2", verdict: "right", feedback: "正规招聘不收任何费用。" },
          { text: "办19800元培训贷", next: "s2", verdict: "right", feedback: "培训贷是新型招聘诈骗。" },
          { text: "已交费/办贷", next: "s3", verdict: "warn", feedback: "请立即报警并向劳动监察投诉。" },
        ],
      },
      {
        id: "s2",
        operator: "正规招聘不收培训费/服装费/押金/工本费，不要求办贷。请拒绝并核实公司营业执照。",
        choices: [
          { text: "拒绝交费，核实公司资质", next: null, verdict: "right", ending: "verified", feedback: "正确！正规招聘不收费不办贷。" },
          { text: "交费入职博高薪", next: null, verdict: "wrong", ending: "scam", feedback: "错误！先交费=诈骗，交费后公司跑路。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即报警并向劳动监察部门投诉，保留合同/转账记录作为证据。如已办贷，联系银保监会投诉。",
        choices: [
          { text: "好的，我立即报警投诉", next: null, verdict: "right", ending: "verified", feedback: "正确！报警+劳动监察+银保监会投诉。" },
        ],
      },
    ],
    takeaways: [
      "正规招聘不收任何费用",
      "培训贷是新型招聘诈骗",
      "已交费立即报警+劳动监察投诉",
    ],
  },
  {
    id: "HL-LAUNDERING", title: "怀疑遭遇跑分洗钱招募",
    scenario: "群里\"租卡日500\"招募，要求提供银行卡号密码参与资金过账。",
    typeId: "F48", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方招募的内容？",
        choices: [
          { text: "租银行卡日入500", next: "s2", verdict: "right", feedback: "出租银行卡跑分=帮信罪。" },
          { text: "帮转账抽成5%", next: "s2", verdict: "right", feedback: "帮转账走账=洗钱罪。" },
          { text: "已提供银行卡号密码", next: "s3", verdict: "warn", feedback: "请立即冻结银行卡并报警。" },
        ],
      },
      {
        id: "s2",
        operator: "出租银行卡/帮转账走账=跑分洗钱，涉嫌帮信罪（最高3年）或洗钱罪（最高7年）。请立即拒绝。",
        choices: [
          { text: "拒绝参与，退群", next: null, verdict: "right", ending: "verified", feedback: "正确！跑分洗钱涉嫌犯罪，拒绝是唯一正确做法。" },
          { text: "试试看赚外快", next: null, verdict: "wrong", ending: "scam", feedback: "错误！跑分洗钱涉嫌刑事犯罪，征信受损终身。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系银行冻结银行卡，并到就近派出所报案说明情况。主动配合调查可减轻责任。",
        choices: [
          { text: "好的，我立即冻结报警", next: null, verdict: "right", ending: "verified", feedback: "正确！冻结+报警+配合调查。" },
        ],
      },
    ],
    takeaways: [
      "出租银行卡=帮信罪最高判3年",
      "帮转账走账=洗钱罪最高判7年",
      "已参与立即冻结+报警+配合调查",
    ],
  },
  {
    id: "HL-REFUND", title: "怀疑遭遇冒充客服退款",
    scenario: "自称淘宝客服称商品质量问题需退款理赔，要求共享屏幕操作。",
    typeId: "F04", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"客服\"是怎么引导您操作的？",
        choices: [
          { text: "要求下载会议APP共享屏幕", next: "s2", verdict: "right", feedback: "共享屏幕=诈骗标准动作。" },
          { text: "已共享屏幕并输入验证码", next: "s3", verdict: "warn", feedback: "请立即停止共享并报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "正规退款只原路退回支付账户，不要求共享屏幕、不下载APP、不验证流水。请通过淘宝官方APP核实订单。",
        choices: [
          { text: "挂断，登录淘宝官方APP核实", next: null, verdict: "right", ending: "verified", feedback: "正确！官方APP核实是唯一可信渠道。" },
          { text: "按客服指引共享屏幕理赔", next: null, verdict: "wrong", ending: "scam", feedback: "错误！共享屏幕会泄露密码验证码，资金秒被盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即关闭共享屏幕，联系银行冻结账户，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即报警止付", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "正规退款只原路退回支付账户",
      "共享屏幕=诈骗，不下载会议APP",
      "挂断→96110核实→官方渠道核实",
    ],
  },
  {
    id: "HL-INVEST", title: "怀疑遭遇虚假投资理财",
    scenario: "微信群里\"导师\"荐股，引导下载非正规APP投资。",
    typeId: "F05", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"导师\"是怎么引导您投资的？",
        choices: [
          { text: "下载非正规APP，群内晒单日入过万", next: "s2", verdict: "right", feedback: "晒单都是托，非正规APP=诈骗。" },
          { text: "已充值5万元无法提现", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没充值，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "任何非正规平台投资都是诈骗，群内晒单动辄日入过万都是托。投资认准持牌金融机构。",
        choices: [
          { text: "卸载APP，退群举报", next: null, verdict: "right", ending: "verified", feedback: "正确！非正规平台投资=诈骗。" },
          { text: "再投10万凑够VIP提现", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"凑够才能提现\"是典型连环套，越投越多。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天记录、转账凭证、APP截图作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "非正规平台投资=诈骗",
      "群内晒单日入过万都是托",
      "投资认准持牌金融机构",
    ],
  },
  {
    id: "HL-BOSS", title: "怀疑遭遇冒充熟人/领导",
    scenario: "领导换号加微信，称开会不方便接电话，急令代转5万元。",
    typeId: "F06", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"领导\"是怎么联系您的？",
        choices: [
          { text: "换新微信号加好友，称开会不便接电话", next: "s2", verdict: "right", feedback: "换号+不接电话=冒充典型特征。" },
          { text: "已转账5万元", next: "s3", verdict: "warn", feedback: "请立即报警并联系银行止付。" },
          { text: "要求电话核实被拒", next: "s2", verdict: "right", feedback: "正确！电话核实是关键防线。" },
        ],
      },
      {
        id: "s2",
        operator: "换号加微信+不接电话+急令转账=冒充领导典型话术。请用通讯录原号码电话核实。",
        choices: [
          { text: "用通讯录原号码电话核实", next: null, verdict: "right", ending: "verified", feedback: "正确！原号码核实是铁律。" },
          { text: "领导说急事立即转", next: null, verdict: "wrong", ending: "scam", feedback: "错误！越急越要核实，急令转账=诈骗。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留微信聊天记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警止付", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "换号+不接电话=冒充典型话术",
      "急令转账务必电话核实原号码",
      "转账前面对面或电话二次确认",
    ],
  },
  {
    id: "HL-CREDIT", title: "怀疑遭遇注销校园贷/征信修复",
    scenario: "自称银监会工作人员称校园贷未注销影响征信。",
    typeId: "F07", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下对方是怎么引导您操作的？",
        choices: [
          { text: "自称银监会，要求转账到安全账户注销", next: "s2", verdict: "right", feedback: "银监会不会要求转账注销。" },
          { text: "已转账3万元注销贷款", next: "s3", verdict: "warn", feedback: "请立即报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "银监会不会电话要求注销校园贷，更不会要求转账到\"安全账户\"。征信只能通过央行征信中心官方渠道查询修复。",
        choices: [
          { text: "挂断，登录央行征信中心官网核实", next: null, verdict: "right", ending: "verified", feedback: "正确！征信只认央行官方渠道。" },
          { text: "按对方指引转账注销", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"安全账户\"=诈骗账户，转账即失。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留通话记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "银监会不电话要求注销校园贷",
      "征信修复只走央行官方渠道",
      "任何\"安全账户\"都是诈骗",
    ],
  },
  {
    id: "HL-DCEP", title: "怀疑遭遇数字人民币钓鱼",
    scenario: "群里发数字人民币红包兑换码，扫码跳转非官方页面。",
    typeId: "F79", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下红包兑换码是怎么出现的？",
        choices: [
          { text: "群里扫码跳转非官方页面要求输密码", next: "s2", verdict: "right", feedback: "非官方页面=钓鱼。" },
          { text: "已输入密码和验证码", next: "s3", verdict: "warn", feedback: "请立即冻结账户并报警。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "数字人民币红包只在官方APP内领取，兑换码不通过链接发放。任何要求输密码验证码的页面都是钓鱼。",
        choices: [
          { text: "关闭页面，登录数字人民币官方APP", next: null, verdict: "right", ending: "verified", feedback: "正确！数字人民币只走官方APP。" },
          { text: "扫码领红包输密码", next: null, verdict: "wrong", ending: "scam", feedback: "错误！陌生链接输密码=钱包被盗。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系银行冻结账户，登录数字人民币官方APP修改密码，并到就近派出所报案。",
        choices: [
          { text: "好的，我立即冻结报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "数字人民币红包只在官方APP内领取",
      "兑换码不通过链接发放",
      "任何要求输密码的页面都是钓鱼",
    ],
  },
  {
    id: "HL-SHORT-PIG", title: "怀疑遭遇短视频平台杀猪盘",
    scenario: "小红书私信推荐理财导师，群内晒单日入过万。",
    typeId: "F80", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"理财导师\"是怎么联系您的？",
        choices: [
          { text: "短视频私信推荐，群内晒单日入过万", next: "s2", verdict: "right", feedback: "短视频引流=杀猪盘新变种。" },
          { text: "已下载APP并充值", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "短视频平台私信推荐\"理财导师\"是杀猪盘新引流，群内晒单都是托。任何非正规平台投资都是诈骗。",
        choices: [
          { text: "拉黑举报，不下载陌生APP", next: null, verdict: "right", ending: "verified", feedback: "正确！短视频理财引流=杀猪盘。" },
          { text: "试试看投1万赚回再撤", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"先小赚再大亏\"是杀猪盘经典套路。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留私信、群聊、转账记录、APP截图作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "短视频私信理财引流=杀猪盘",
      "群内晒单日入过万都是托",
      "不下载陌生APP，投资认准持牌机构",
    ],
  },
  {
    id: "HL-AI-SERVICE", title: "怀疑遭遇AI客服仿声诈骗",
    scenario: "自称支付宝客服称花呗异常，声音像官方录音。",
    typeId: "F81", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"客服\"是怎么引导您操作的？",
        choices: [
          { text: "声音像官方录音，要求处理花呗异常", next: "s2", verdict: "right", feedback: "AI可仿造官方客服声音。" },
          { text: "已按指引输入验证码", next: "s3", verdict: "warn", feedback: "请立即冻结账户并报警止付。" },
          { text: "挂断来核实", next: "s2", verdict: "right", feedback: "正确！挂断核实是关键。" },
        ],
      },
      {
        id: "s2",
        operator: "AI可仿造支付宝/银行/快递客服声音，官方客服不会索要密码验证码，不会要求共享屏幕。请挂断后拨打95188核实。",
        choices: [
          { text: "挂断，拨打95188核实", next: null, verdict: "right", ending: "verified", feedback: "正确！挂断回拨官方号码是铁律。" },
          { text: "声音是官方的处理一下", next: null, verdict: "wrong", ending: "scam", feedback: "错误！AI可仿造官方声音，必须回拨核实。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系支付宝/银行冻结账户，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即冻结报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "AI可仿造官方客服声音",
      "官方客服不索要密码验证码",
      "挂断回拨95188/95588等官方号码核实",
    ],
  },
  {
    id: "HL-DOUBLE11", title: "怀疑遭遇双11虚假快递理赔",
    scenario: "双11快递丢失双倍赔偿，要求下载会议APP共享屏幕。",
    typeId: "F83", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"快递理赔\"是怎么引导您操作的？",
        choices: [
          { text: "称快递丢失双倍赔偿，要求共享屏幕", next: "s2", verdict: "right", feedback: "理赔+共享屏幕=诈骗。" },
          { text: "已共享屏幕并付款", next: "s3", verdict: "warn", feedback: "请立即停止共享并报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "快递理赔只通过官方渠道原路退回，不要求下载会议APP、不共享屏幕、不验证流水。请登录购物APP核实物流。",
        choices: [
          { text: "挂断，登录购物APP核实物流", next: null, verdict: "right", ending: "verified", feedback: "正确！官方APP核实是唯一可信渠道。" },
          { text: "按客服指引共享屏幕理赔", next: null, verdict: "wrong", ending: "scam", feedback: "错误！共享屏幕会泄露验证码，资金秒被盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即关闭共享屏幕，联系银行冻结账户，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即报警止付", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "快递理赔只通过官方渠道原路退回",
      "理赔+共享屏幕=诈骗",
      "购物APP核实物流是唯一可信渠道",
    ],
  },
  {
    id: "HL-YEAREND", title: "怀疑遭遇年终虚假理财",
    scenario: "年终限享内部理财年化18%保本保息最后10名额。",
    typeId: "F85", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"内部理财\"是怎么推销的？",
        choices: [
          { text: "年终限享年化18%保本保息最后10名额", next: "s2", verdict: "right", feedback: "保本保息+高收益=诈骗。" },
          { text: "已转账认购10万元", next: "s3", verdict: "warn", feedback: "请立即报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "任何承诺保本保息且年化超8%的理财都是诈骗，\"内部名额\"\"限享\"是饥饿营销话术。投资认准持牌金融机构。",
        choices: [
          { text: "拒绝认购，举报拉黑", next: null, verdict: "right", ending: "verified", feedback: "正确！保本保息+高收益=诈骗。" },
          { text: "抢最后名额认购", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"最后名额\"是饥饿营销，转账即失。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天记录、转账凭证、宣传截图作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "保本保息+年化超8%=诈骗",
      "\"内部名额\"\"限享\"是饥饿营销话术",
      "投资认准持牌金融机构",
    ],
  },
  {
    id: "HL-SCHOOL-FEE", title: "怀疑遭遇开学季冒充老师收费",
    scenario: "家长群班主任发消息收资料费298元扫码缴纳。",
    typeId: "F86", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"班主任\"是怎么收费的？",
        choices: [
          { text: "家长群发消息收资料费298元扫码", next: "s2", verdict: "right", feedback: "群内扫码收费=冒充典型。" },
          { text: "已扫码付款298元", next: "s3", verdict: "warn", feedback: "请立即报警并提醒群内其他家长。" },
          { text: "要求电话核实被拒", next: "s2", verdict: "right", feedback: "正确！电话核实是关键。" },
        ],
      },
      {
        id: "s2",
        operator: "学校收费不会通过家长群扫码收取，更不会要求私下转账。请电话联系班主任原号码核实。",
        choices: [
          { text: "电话联系班主任原号码核实", next: null, verdict: "right", ending: "verified", feedback: "正确！电话核实原号码是铁律。" },
          { text: "群里都交了我也交", next: null, verdict: "wrong", ending: "scam", feedback: "错误！群里\"都交了\"可能是托，务必电话核实。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，并在家长群提醒其他家长警惕，保留聊天记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警并提醒群内家长", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+提醒他人。" },
        ],
      },
    ],
    takeaways: [
      "学校收费不通过家长群扫码收取",
      "群内扫码收费=冒充典型话术",
      "电话联系班主任原号码核实",
    ],
  },
  {
    id: "HL-DEEPSEEK", title: "怀疑遭遇DeepSeek大模型仿冒客服",
    scenario: "自称DeepSeek客服称误开会员每月扣费，要求共享屏幕关闭。",
    typeId: "F87", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"DeepSeek客服\"是怎么引导您操作的？",
        choices: [
          { text: "称误开会员每月扣费，要求共享屏幕关闭", next: "s2", verdict: "right", feedback: "扣费+共享屏幕=诈骗。" },
          { text: "已共享屏幕并输入验证码", next: "s3", verdict: "warn", feedback: "请立即停止共享并报警止付。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "DeepSeek不会电话联系用户关闭会员，更不会要求共享屏幕。任何\"误开会员扣费\"都是诈骗话术。请通过官方APP或官网核实。",
        choices: [
          { text: "挂断，登录DeepSeek官方渠道核实", next: null, verdict: "right", ending: "verified", feedback: "正确！官方渠道核实是唯一可信方式。" },
          { text: "按客服指引共享屏幕关闭", next: null, verdict: "wrong", ending: "scam", feedback: "错误！共享屏幕会泄露密码验证码，资金秒被盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即关闭共享屏幕，联系银行冻结账户，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即报警止付", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "DeepSeek不会电话联系关闭会员",
      "\"误开会员扣费\"是诈骗话术",
      "共享屏幕=诈骗标准动作",
    ],
  },
  {
    id: "HL-USDT", title: "怀疑遭遇USDT虚拟币代挖诈骗",
    scenario: "网友推荐USDT代挖稳赚，提现需缴认证金。",
    typeId: "F88", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"代挖\"是怎么引导您操作的？",
        choices: [
          { text: "USDT代挖稳赚，提现需缴认证金", next: "s2", verdict: "right", feedback: "提现要认证金=诈骗。" },
          { text: "已缴认证金仍无法提现", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "国内虚拟币交易已全面禁止，任何USDT代挖稳赚都是诈骗，提现需缴认证金/解冻金是典型连环套。",
        choices: [
          { text: "拒绝缴金，卸载APP报警", next: null, verdict: "right", ending: "verified", feedback: "正确！提现要认证金=诈骗。" },
          { text: "再缴认证金试一次提现", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"再缴一次就能提\"是连环套，越缴越多。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留聊天记录、转账凭证、APP截图作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "国内虚拟币交易已全面禁止",
      "USDT代挖稳赚=诈骗",
      "提现需缴认证金是典型连环套",
    ],
  },
  {
    id: "HL-FLIGHT", title: "怀疑遭遇航班改签钓鱼",
    scenario: "短信称航班取消改签领补偿金，点击链接填银行卡。",
    typeId: "F90", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"航班改签\"是怎么引导您操作的？",
        choices: [
          { text: "短信称航班取消，点链接领补偿金填卡", next: "s2", verdict: "right", feedback: "改签+补偿金+链接=钓鱼。" },
          { text: "已点击链接填写银行卡和验证码", next: "s3", verdict: "warn", feedback: "请立即冻结银行卡并报警。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "航班改签只通过航司官方APP或客服电话办理，不通过短信链接，补偿金不会要求填银行卡密码验证码。请拨打航司官方客服核实。",
        choices: [
          { text: "挂断，拨打航司官方客服核实", next: null, verdict: "right", ending: "verified", feedback: "正确！航司官方客服是唯一可信渠道。" },
          { text: "点链接领补偿金填卡", next: null, verdict: "wrong", ending: "scam", feedback: "错误！链接是钓鱼页面，填卡即盗刷。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即联系银行冻结银行卡，并到就近派出所报案止付。",
        choices: [
          { text: "好的，我立即冻结报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "航班改签只通过航司官方渠道办理",
      "短信链接领补偿金=钓鱼",
      "补偿金不会要求填银行卡密码验证码",
    ],
  },
  {
    id: "HL-NFT", title: "怀疑遭遇数字藏品NFT发售骗局",
    scenario: "数字藏品保本回购10倍收益，提现要交个税。",
    typeId: "F91", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"数字藏品\"是怎么推销的？",
        choices: [
          { text: "保本回购10倍收益，提现要交个税", next: "s2", verdict: "right", feedback: "保本回购+高收益=诈骗。" },
          { text: "已购藏品并交了\"个税\"", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "国内数字藏品禁止金融化、证券化，任何承诺保本回购、10倍收益的都是诈骗，提现要交个税/解冻金是连环套。",
        choices: [
          { text: "拒绝购买，举报平台", next: null, verdict: "right", ending: "verified", feedback: "正确！数字藏品保本回购=诈骗。" },
          { text: "抢购等10倍回购", next: null, verdict: "wrong", ending: "scam", feedback: "错误！\"保本回购\"是话术，转账即失。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留平台截图、聊天记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "国内数字藏品禁止金融化证券化",
      "保本回购+10倍收益=诈骗",
      "提现要交个税是典型连环套",
    ],
  },
  {
    id: "HL-PENSION", title: "怀疑遭遇AI养老金资格认证钓鱼",
    scenario: "自称社保局要求下载APP做人脸识别认证养老金。",
    typeId: "F95", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"社保局\"是怎么引导您操作的？",
        choices: [
          { text: "要求下载APP做人脸识别认证养老金", next: "s2", verdict: "right", feedback: "下载APP+人脸识别=钓鱼。" },
          { text: "已下载APP并完成人脸识别", next: "s3", verdict: "warn", feedback: "请立即卸载APP并报警。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "社保局不会要求下载非官方APP做人脸识别，养老金资格认证通过\"掌上12333\"或当地人社APP办理。任何陌生APP人脸识别都是钓鱼。",
        choices: [
          { text: "挂断，登录\"掌上12333\"核实", next: null, verdict: "right", ending: "verified", feedback: "正确！官方APP核实是唯一可信渠道。" },
          { text: "按对方指引下载APP认证", next: null, verdict: "wrong", ending: "scam", feedback: "错误！陌生APP会窃取人脸信息盗刷账户。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即卸载该APP，联系银行冻结关联账户，并到就近派出所报案。",
        choices: [
          { text: "好的，我立即卸载报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "社保局不要求下载非官方APP",
      "养老金认证通过\"掌上12333\"办理",
      "陌生APP人脸识别=钓鱼",
    ],
  },
  {
    id: "HL-LIVE-SHOP", title: "怀疑遭遇短视频直播带货诈骗",
    scenario: "直播间1元秒杀苹果手机，加微信私下交易。",
    typeId: "F46", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下\"秒杀\"是怎么引导您交易的？",
        choices: [
          { text: "1元秒杀苹果手机，加微信私下交易", next: "s2", verdict: "right", feedback: "私下交易=诈骗。" },
          { text: "已微信转账货款被拉黑", next: "s3", verdict: "warn", feedback: "请立即报警并保留证据。" },
          { text: "还没操作，来核实", next: "s2", verdict: "right", feedback: "正确！先核实再操作。" },
        ],
      },
      {
        id: "s2",
        operator: "正规直播带货只在平台内下单付款，任何加微信私下交易都是诈骗，1元秒杀苹果手机明显低于市场价=话术。",
        choices: [
          { text: "拒绝私下交易，平台内下单", next: null, verdict: "right", ending: "verified", feedback: "正确！私下交易=诈骗。" },
          { text: "加微信转账抢秒杀", next: null, verdict: "wrong", ending: "scam", feedback: "错误！私下转账无平台保障，被骗后拉黑失联。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即到就近派出所报案，保留直播间截图、微信聊天记录、转账凭证作为证据。",
        choices: [
          { text: "好的，我立即报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "正规直播带货只在平台内交易",
      "加微信私下交易=诈骗",
      "1元秒杀明显低于市场价=话术",
    ],
  },
  {
    id: "HL-MINOR-GAME", title: "怀疑遭遇未成年人网络打赏/游戏代练",
    scenario: "孩子拿家长手机给主播打赏，代练要账号密码。",
    typeId: "F49", startNodeId: "s1",
    nodes: [
      {
        id: "s1",
        operator: "您好，96110。请描述一下孩子是怎么被引导的？",
        choices: [
          { text: "主播诱导打赏，代练要账号密码", next: "s2", verdict: "right", feedback: "索要账号密码=诈骗。" },
          { text: "已支付大额打赏/提供账号密码", next: "s3", verdict: "warn", feedback: "请立即冻结账户并报警。" },
          { text: "及时发现来核实", next: "s2", verdict: "right", feedback: "正确！及时发现是关键。" },
        ],
      },
      {
        id: "s2",
        operator: "未成年人打赏可联系平台申请退款，代练索要账号密码是盗号诈骗。请立即修改支付密码，开启未成年人模式。",
        choices: [
          { text: "修改密码，联系平台申请退款", next: null, verdict: "right", ending: "verified", feedback: "正确！未成年人打赏可申请退款。" },
          { text: "提供账号密码让代练上分", next: null, verdict: "wrong", ending: "scam", feedback: "错误！账号密码一旦泄露，装备皮肤即被盗。" },
        ],
      },
      {
        id: "s3",
        operator: "请立即修改支付密码、冻结关联账户，联系平台申请退款，并到就近派出所报案。",
        choices: [
          { text: "好的，我立即修改密码报警", next: null, verdict: "right", ending: "verified", feedback: "正确！止损+报警+保留证据。" },
        ],
      },
    ],
    takeaways: [
      "未成年人打赏可联系平台申请退款",
      "代练索要账号密码=盗号诈骗",
      "开启未成年人模式，保管支付密码",
    ],
  },
];

/** 合并 v3 + v4 的 96110 剧本 */
export const ALL_HOTLINE_SCRIPTS: FBHotlineScript[] = [...HOTLINE_SCRIPTS_96110, ...HOTLINE_SCRIPTS_V4];

/** 根据 ID 查询 96110 剧本（覆盖 v3 + v4） */
export function getHotlineScriptV4(id: string): FBHotlineScript | undefined {
  return ALL_HOTLINE_SCRIPTS.find((s) => s.id === id);
}
