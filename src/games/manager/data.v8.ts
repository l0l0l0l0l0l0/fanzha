// ====================================================================
// 反诈职业经理人 · v8 全面升级数据
// 独立文件，避免 data.ts 过大（继续渐进式拆分）
// 包含：案例五步复盘 / 探员个人支线 / 主线章节扩展 / 卡牌大招 / 地区数据 / 扩展题库
// ====================================================================

import type {
  CaseBreakdownDef,
  CaseInvestigation,
  AgentStoryQuest,
  StoryChapterFull,
  CardSkillDef,
  RegionDef,
  QuizQuestion,
  // v9 新增：探员羁绊
  AgentBond,
} from "./types";

// ====================================================================
// v8：案例五步复盘（12 个，对应 12 个真实案例）
// 每关结算展示真实案件的 接触→信任→诱导→转账→拉黑 五步
// 玩家选关键拦截点（答对解锁奖励）
// ====================================================================

export const CASE_BREAKDOWNS: CaseBreakdownDef[] = [
  {
    caseId: "case_robot",
    title: "话术脚本流水线诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "自动拨号系统拨打受害人电话，话术机器人念剧本", warningSign: "陌生号码 + 固定开场白", correctAction: "陌生电话不接听，立即拉黑" },
      { order: 2, name: "信任", desc: "伪装成客服/公检法/熟人，提供能查到的部分真实信息", warningSign: "对方报出你的姓名/订单号", correctAction: "信息泄露不等于对方身份真实" },
      { order: 3, name: "诱导", desc: "以'订单异常/涉嫌洗钱/中奖'为由制造紧迫感", warningSign: "对方要求立即操作 + 不让你挂断核实", correctAction: "挂断电话，换渠道核实" },
      { order: 4, name: "转账", desc: "引导点击链接/共享屏幕/转账到'安全账户'", warningSign: "对方索要密码/验证码/要求转账", correctAction: "不输入密码、不共享屏幕、不转账" },
      { order: 5, name: "拉黑", desc: "得手后失联，受害人再无法联系", warningSign: "对方突然消失/号码空号", correctAction: "立即报警 + 银行冻结" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 500, antiFraudPoints: 50 },
  },
  {
    caseId: "case_sweet",
    title: "杀猪盘跨境诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "社交平台加好友，优质女性/男性形象主动搭讪", warningSign: "陌生人主动加好友 + 头像精致", correctAction: "陌生加好友保持警惕" },
      { order: 2, name: "信任", desc: "聊数月，关心备至，从不见面不视频", warningSign: "始终拒绝视频/见面", correctAction: "不见面不转账" },
      { order: 3, name: "诱导", desc: "透露'内部投资渠道'，晒虚假收益截图", warningSign: "对方提'稳赚不赔'/'内部数据'", correctAction: "理财认持牌，拒绝跟单" },
      { order: 4, name: "转账", desc: "诱导充值到虚假平台，前期可小额提现建立信任", warningSign: "对方催促加大投入", correctAction: "提现受阻立即止损报警" },
      { order: 5, name: "拉黑", desc: "大额投入后平台跑路，对方失联", warningSign: "平台无法登录/对方消失", correctAction: "保留聊天记录报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 600, antiFraudPoints: 60 },
  },
  {
    caseId: "case_threat",
    title: "冒充公检法跨境诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "自称警官/检察官来电，报出你的身份证号", warningSign: "陌生号码 + 报出你的个人信息", correctAction: "公检法不电办" },
      { order: 2, name: "信任", desc: "通过 QQ/微信发送伪造拘捕令、PS 公章", warningSign: "拘捕令通过 QQ/微信发送", correctAction: "公检法不会用 QQ 办案" },
      { order: 3, name: "诱导", desc: "以'涉嫌洗钱'恐吓，要求配合调查不得挂断", warningSign: "对方要求保持通话不让你核实", correctAction: "挂断后拨 110 核实" },
      { order: 4, name: "转账", desc: "要求转账到'安全账户'验资", warningSign: "对方提'安全账户'", correctAction: "不存在'安全账户'，立即挂断" },
      { order: 5, name: "拉黑", desc: "转账后对方失联，拘捕令是 PS 的", warningSign: "对方消失/号码空号", correctAction: "立即报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 600, antiFraudPoints: 60 },
  },
  {
    caseId: "case_phish",
    title: "钓鱼链接盗刷案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "收到'银行积分兑换/ETC 过期'短信", warningSign: "陌生短信号码 + 短链接", correctAction: "陌生短链接不点" },
      { order: 2, name: "信任", desc: "链接打开后是高仿银行页面，相似度 95%", warningSign: "页面 URL 不是银行官方域名", correctAction: "查官方 APP/官网核实" },
      { order: 3, name: "诱导", desc: "要求输入银行卡号+密码+验证码", warningSign: "页面索取密码/验证码", correctAction: "正规机构不通过链接索要密码" },
      { order: 4, name: "转账", desc: "输入后钱被秒转走", warningSign: "短信验证码被读出", correctAction: "验证码绝不告诉任何人" },
      { order: 5, name: "拉黑", desc: "发现时钱已转走，钓鱼链接失效", warningSign: "卡内资金异常", correctAction: "立即银行冻结 + 报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 500, antiFraudPoints: 50 },
  },
  {
    caseId: "case_farmer",
    title: "断卡行动·卡农洗钱案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "网上看到'高价租银行卡，月入 2000'", warningSign: "陌生人高价租卡", correctAction: "租卡即犯罪" },
      { order: 2, name: "信任", desc: "对方解释'只是过账，不会查到你'", warningSign: "对方淡化风险", correctAction: "帮信罪最高判 3 年" },
      { order: 3, name: "诱导", desc: "签订'租赁合同'，给小利建立信任", warningSign: "对方给小额回报", correctAction: "拒绝任何租卡请求" },
      { order: 4, name: "转账", desc: "你的卡被用于走账，单月过百万", warningSign: "银行短信异常频繁", correctAction: "立即到银行销卡" },
      { order: 5, name: "拉黑", desc: "案发后你被以帮信罪起诉", warningSign: "警方传唤", correctAction: "主动投案 + 配合调查" },
    ],
    correctInterceptIdx: 0,
    reward: { score: 600, antiFraudPoints: 60 },
  },
  {
    caseId: "case_deepfake",
    title: "AI 换脸冒充熟人诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "收到'亲友'视频通话请求", warningSign: "视频通话请求突然", correctAction: "视频借钱务必电话核实" },
      { order: 2, name: "信任", desc: "视频里就是亲友的脸和声音", warningSign: "视频有卡顿/眨眼异常", correctAction: "换话题问私密信息核实" },
      { order: 3, name: "诱导", desc: "'亲友'说急用钱，要求立即转账", warningSign: "对方催促转账", correctAction: "换渠道核实本人" },
      { order: 4, name: "转账", desc: "诱导转账到陌生账户", warningSign: "陌生账户", correctAction: "不转账，电话核实" },
      { order: 5, name: "拉黑", desc: "转账后发现亲友本人毫不知情", warningSign: "亲友否认借钱", correctAction: "立即报警" },
    ],
    correctInterceptIdx: 1,
    reward: { score: 700, antiFraudPoints: 70 },
  },
  {
    caseId: "case_investApp",
    title: "虚假理财平台暴雷案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "网友推荐'稳赚不赔'理财 APP", warningSign: "陌生网友推荐理财", correctAction: "理财认持牌" },
      { order: 2, name: "信任", desc: "群内晒单,老师带单,前期可小额提现", warningSign: "群内晒单 + 老师带单", correctAction: "证监会/银保监会官网查资质" },
      { order: 3, name: "诱导", desc: "'年化 30%'高收益诱惑", warningSign: "承诺高收益", correctAction: "高收益=高风险,可能是骗局" },
      { order: 4, name: "转账", desc: "诱导大额充值到平台", warningSign: "对方催促加大投入", correctAction: "提现受阻立即止损" },
      { order: 5, name: "拉黑", desc: "平台跑路,无法提现", warningSign: "平台无法登录", correctAction: "保留证据报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 700, antiFraudPoints: 70 },
  },
  {
    caseId: "case_fakeLeader",
    title: "冒充领导转账诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "微信收到'领导'加好友请求", warningSign: "领导主动加微信", correctAction: "核实领导身份" },
      { order: 2, name: "信任", desc: "头像/昵称与领导一致", warningSign: "头像昵称一致但微信号不同", correctAction: "看微信号是否本人" },
      { order: 3, name: "诱导", desc: "'领导'让你帮忙转钱给客户,事后还你", warningSign: "对方提'在开会不便接电话'", correctAction: "换渠道核实本人" },
      { order: 4, name: "转账", desc: "诱导转账到陌生账户", warningSign: "陌生账户", correctAction: "电话/当面核实领导" },
      { order: 5, name: "拉黑", desc: "转账后发现领导本人毫不知情", warningSign: "领导否认借钱", correctAction: "立即报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 600, antiFraudPoints: 60 },
  },
  {
    caseId: "case_etcFraud",
    title: "ETC 过期短信钓鱼案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "收到'ETC 过期禁用'短信", warningSign: "陌生短信号码", correctAction: "ETC 官方办" },
      { order: 2, name: "信任", desc: "短信带 ETC 发行方名称,链接高仿官方", warningSign: "链接非官方域名", correctAction: "查官方 APP 核实" },
      { order: 3, name: "诱导", desc: "短信称'不补办将影响通行'", warningSign: "对方制造紧迫感", correctAction: "ETC 不会以短信索要银行卡" },
      { order: 4, name: "转账", desc: "诱导输入银行卡号+密码+验证码", warningSign: "页面索取密码", correctAction: "正规机构不通过链接索要密码" },
      { order: 5, name: "拉黑", desc: "输入后卡内钱被秒转", warningSign: "卡内资金异常", correctAction: "立即银行冻结 + 报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 500, antiFraudPoints: 50 },
  },
  {
    caseId: "case_refundFraud",
    title: "退费诈骗连环套案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "客服主动来电说'商品质量问题双倍退款'", warningSign: "客服主动来电", correctAction: "客服不主动" },
      { order: 2, name: "信任", desc: "对方报出你的订单详情", warningSign: "对方报出订单号", correctAction: "订单泄露不等于对方是真客服" },
      { order: 3, name: "诱导", desc: "要求下载会议 APP 共享屏幕指导操作", warningSign: "对方要求共享屏幕", correctAction: "共享屏幕=交出手机控制权" },
      { order: 4, name: "转账", desc: "通过共享屏幕读出验证码,转走钱款", warningSign: "对方索要验证码", correctAction: "验证码绝不告诉任何人" },
      { order: 5, name: "拉黑", desc: "对方失联,受害人发现钱被转走", warningSign: "对方消失", correctAction: "立即报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 600, antiFraudPoints: 60 },
  },
  {
    caseId: "case_loanCancel",
    title: "注销校园贷诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "自称金融监管来电,称你有校园贷记录", warningSign: "陌生号码自称金融监管", correctAction: "征信只能本人到央行查" },
      { order: 2, name: "信任", desc: "对方报出你的身份证号+学籍信息", warningSign: "对方报出你的个人信息", correctAction: "信息泄露不等于对方身份真实" },
      { order: 3, name: "诱导", desc: "称'不注销影响征信',恐吓学生", warningSign: "对方制造紧迫感", correctAction: "征信不可代修" },
      { order: 4, name: "转账", desc: "诱导网贷转账'注销'", warningSign: "对方要求网贷转账", correctAction: "立即挂断,到央行查征信" },
      { order: 5, name: "拉黑", desc: "转账后对方失联", warningSign: "对方消失", correctAction: "立即报警" },
    ],
    correctInterceptIdx: 0,
    reward: { score: 600, antiFraudPoints: 60 },
  },
  {
    caseId: "case_popup",
    title: "假客服双倍退款诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "客服主动来电说'商品质量问题双倍退款'", warningSign: "客服主动来电", correctAction: "客服不主动" },
      { order: 2, name: "信任", desc: "对方报出你的订单详情(撞库所得)", warningSign: "对方报出订单号", correctAction: "订单泄露不等于对方是真客服" },
      { order: 3, name: "诱导", desc: "要求下载会议 APP 共享屏幕", warningSign: "对方要求共享屏幕", correctAction: "共享屏幕=交出手机控制权" },
      { order: 4, name: "转账", desc: "通过共享屏幕读出验证码", warningSign: "对方索要验证码", correctAction: "验证码绝不告诉任何人" },
      { order: 5, name: "拉黑", desc: "对方失联,受害人发现钱被转走", warningSign: "对方消失", correctAction: "立即报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 500, antiFraudPoints: 50 },
  },
  // ===== v9 新增案例复盘（F45-F52，对应 8 个 2026 Q3-Q4 新型诈骗） =====
  {
    caseId: "case_aiVoiceClone",
    title: "AI 语音克隆诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "接到'亲友'电话，声音与真人无异", warningSign: "陌生号码 + 熟悉声音", correctAction: "AI 克隆声音已成熟，电话借钱务必核实" },
      { order: 2, name: "信任", desc: "对方称呼你小名，提及家庭细节", warningSign: "对方掌握你的隐私信息", correctAction: "信息泄露不等于对方是本人" },
      { order: 3, name: "诱导", desc: "'亲友'说急用钱，要求立即转账", warningSign: "对方催促转账", correctAction: "挂断后用原存号码回拨核实" },
      { order: 4, name: "转账", desc: "诱导转账到陌生账户", warningSign: "陌生账户", correctAction: "设私密问题验证本人" },
      { order: 5, name: "拉黑", desc: "转账后联系亲友发现毫不知情", warningSign: "亲友否认借钱", correctAction: "立即报警 + 银行冻结" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 700, antiFraudPoints: 70 },
  },
  {
    caseId: "case_fakeLivestream",
    title: "直播间虚假宣传诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "刷到直播间'限量特价'商品", warningSign: "直播间限时限量催单", correctAction: "直播间购物认准官方店铺" },
      { order: 2, name: "信任", desc: "主播展示'真品'，刷屏好评", warningSign: "刷屏好评 + 托儿气氛", correctAction: "刷屏好评可能是水军" },
      { order: 3, name: "诱导", desc: "'最后 3 件'制造紧迫感", warningSign: "主播制造紧迫感", correctAction: "限时催单是常见话术" },
      { order: 4, name: "转账", desc: "诱导点击小黄车外链付款", warningSign: "付款跳转外部链接", correctAction: "只在平台内付款" },
      { order: 5, name: "拉黑", desc: "收到假货/空包裹，主播失联", warningSign: "收到假货", correctAction: "平台投诉 + 12315 维权" },
    ],
    correctInterceptIdx: 3,
    reward: { score: 550, antiFraudPoints: 55 },
  },
  {
    caseId: "case_cryptoWalletPhish",
    title: "数字货币钱包授权钓鱼案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "空投/社群推送'免费领币'链接", warningSign: "陌生空投链接", correctAction: "陌生空投不领" },
      { order: 2, name: "信任", desc: "链接打开是知名钱包界面", warningSign: "URL 非官方域名", correctAction: "钱包只从官网下载" },
      { order: 3, name: "诱导", desc: "提示'授权即可领取'", warningSign: "要求授权合约", correctAction: "授权=交出资产控制权" },
      { order: 4, name: "转账", desc: "授权后钱包资产被秒转走", warningSign: "授权后资产异常", correctAction: "授权前用 revoke.cash 查合约" },
      { order: 5, name: "拉黑", desc: "资产被转走，链上无法追回", warningSign: "链上转账不可逆", correctAction: "立即撤销授权 + 报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 700, antiFraudPoints: 70 },
  },
  {
    caseId: "case_fakeGovApp",
    title: "政务 APP 仿冒诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "短信'你的政务 APP 待激活'", warningSign: "陌生短信 + 下载链接", correctAction: "政务 APP 只从官方应用商店下载" },
      { order: 2, name: "信任", desc: "APP 界面高仿官方，图标名称一致", warningSign: "APP 签名非官方", correctAction: "查应用商店开发者信息" },
      { order: 3, name: "诱导", desc: "'不激活将影响社保/医保'", warningSign: "对方制造紧迫感", correctAction: "政务部门不会短信索要信息" },
      { order: 4, name: "转账", desc: "诱导输入银行卡+密码+验证码", warningSign: "页面索取密码", correctAction: "正规政务 APP 不索要银行卡密码" },
      { order: 5, name: "拉黑", desc: "输入后卡内钱被秒转", warningSign: "卡内资金异常", correctAction: "立即银行冻结 + 报警" },
    ],
    correctInterceptIdx: 3,
    reward: { score: 600, antiFraudPoints: 60 },
  },
  {
    caseId: "case_pensionFraud",
    title: "虚假养老理财诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "参加'免费养生讲座'领取鸡蛋", warningSign: "免费礼品 + 养生讲座", correctAction: "免费礼品是常见诱饵" },
      { order: 2, name: "信任", desc: "'专家'讲解养老金政策，嘘寒问暖", warningSign: "陌生人过度关心", correctAction: "警惕陌生人过度热情" },
      { order: 3, name: "诱导", desc: "'年化 15% 稳赚，专为养老设计'", warningSign: "承诺高收益 + 养老专属", correctAction: "理财认持牌，高收益=高风险" },
      { order: 4, name: "转账", desc: "诱导签合同转账到'养老基金'", warningSign: "转账到陌生公司账户", correctAction: "查公司资质 + 不签陌生合同" },
      { order: 5, name: "拉黑", desc: "公司跑路，养老钱血本无归", warningSign: "公司失联", correctAction: "立即报警 + 保留合同证据" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 700, antiFraudPoints: 70 },
  },
  {
    caseId: "case_shortDramaTrap",
    title: "短剧付费连环扣费案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "短视频推送'免费看全集'短剧", warningSign: "免费看全集引流", correctAction: "免费引流是套路起点" },
      { order: 2, name: "信任", desc: "前几集免费，剧情引人入胜", warningSign: "免费内容钩子", correctAction: "警惕'免费'背后的扣费陷阱" },
      { order: 3, name: "诱导", desc: "'解锁后续只需 9.9'", warningSign: "小额解锁", correctAction: "看清是否自动续费" },
      { order: 4, name: "转账", desc: "默认勾选自动续费，连续扣款", warningSign: "自动续费条款隐藏", correctAction: "付款前看清续费条款" },
      { order: 5, name: "拉黑", desc: "每月被扣款，取消入口隐蔽", warningSign: "扣款难取消", correctAction: "立即关闭自动续费 + 投诉" },
    ],
    correctInterceptIdx: 3,
    reward: { score: 500, antiFraudPoints: 50 },
  },
  {
    caseId: "case_secondhandCutOrder",
    title: "二手平台线下切单诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "二手平台发布低价商品吸引买家", warningSign: "价格明显低于市场", correctAction: "低价是常见诱饵" },
      { order: 2, name: "信任", desc: "卖家主动加微信，称'平台手续费高'", warningSign: "卖家要求脱离平台", correctAction: "拒绝脱离平台交易" },
      { order: 3, name: "诱导", desc: "'微信直接转账，给你优惠'", warningSign: "要求私下转账", correctAction: "私下转账无平台保障" },
      { order: 4, name: "转账", desc: "转账后卖家不发货或拉黑", warningSign: "转账后卖家失联", correctAction: "只在平台内付款" },
      { order: 5, name: "拉黑", desc: "微信被拉黑，平台无法维权", warningSign: "被拉黑", correctAction: "报警 + 平台举报" },
    ],
    correctInterceptIdx: 1,
    reward: { score: 550, antiFraudPoints: 55 },
  },
  {
    caseId: "case_aiRefundVoice",
    title: "AI 语音冒充客服退货诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "AI 语音来电自称客服，声音自然", warningSign: "AI 语音客服主动来电", correctAction: "客服不主动来电" },
      { order: 2, name: "信任", desc: "AI 准确报出你的订单详情", warningSign: "对方掌握订单信息", correctAction: "订单泄露不等于对方是真客服" },
      { order: 3, name: "诱导", desc: "'商品质量问题双倍退款，需共享屏幕'", warningSign: "要求共享屏幕", correctAction: "共享屏幕=交出手机控制权" },
      { order: 4, name: "转账", desc: "通过共享屏幕读出验证码", warningSign: "对方索要验证码", correctAction: "验证码绝不告诉任何人" },
      { order: 5, name: "拉黑", desc: "对方失联，受害人发现钱被转走", warningSign: "对方消失", correctAction: "立即报警" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 650, antiFraudPoints: 65 },
  },
  // ===== v10 新增：桥接 fraudBuster F87 DeepSeek 仿冒客服案例 =====
  {
    caseId: "case_deepseekFake",
    title: "DeepSeek 大模型仿冒客服诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "陌生号码自称 DeepSeek 官方客服，AI 仿声专业无机械感", warningSign: "陌生来电 + 自称官方客服", correctAction: "DeepSeek 官方不会主动来电" },
      { order: 2, name: "信任", desc: "报出你的账户注册手机号 + 部分使用记录，伪造'账户异常登录'通知", warningSign: "对方报出你的真实信息 + 制造账户异常恐慌", correctAction: "信息泄露不等于身份真实" },
      { order: 3, name: "诱导", desc: "称账户被开通会员每月扣费 800 元，要求下载会议软件共享屏幕关闭", warningSign: "对方要求共享屏幕 + 操作指引", correctAction: "任何'共享屏幕关闭会员'都是诈骗" },
      { order: 4, name: "转账", desc: "通过屏幕共享读取验证码 + 引导转账到'安全账户'核验", warningSign: "对方索要验证码 + 要求转账", correctAction: "验证码绝不告诉任何人，无'安全账户'" },
      { order: 5, name: "拉黑", desc: "得手后号码空号，仿冒域名 deepsek.com / deepseek-cn.xyz 失效", warningSign: "对方突然消失 / 号码空号", correctAction: "立即报警 + 银行冻结" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 700, antiFraudPoints: 70 },
  },
  // ===== v10 新增：桥接 fraudBuster F45 AI 实时换脸冒充熟人案例 =====
  {
    caseId: "case_aiFaceSwap",
    title: "AI 实时换脸冒充熟人诈骗案 · 五步拆解",
    steps: [
      { order: 1, name: "接触", desc: "社交账号被盗用，伪装成熟人/领导发起视频通话", warningSign: "熟人账号 + 主动视频通话", correctAction: "视频通话也要核实" },
      { order: 2, name: "信任", desc: "AI 实时换脸 + 仿声，画面声音高度相似", warningSign: "画面有微卡顿/眨眼不自然 + 拒绝二次回拨", correctAction: "AI 换脸难辨真伪，单凭视频不能转账" },
      { order: 3, name: "诱导", desc: "声称急事/会议中/不便接电话，催促立即转账", warningSign: "对方制造紧迫感 + 拒绝回拨核实", correctAction: "挂断后用原号码回拨核实" },
      { order: 4, name: "转账", desc: "诱导转账到指定账户，金额从数千到数十万不等", warningSign: "对方索要转账 + 催促", correctAction: "任何转账前必须多重核实" },
      { order: 5, name: "拉黑", desc: "得手后失联，受害人回拨真熟人电话才发现被骗", warningSign: "对方消失 / 回拨真熟人才知被骗", correctAction: "立即报警 + 银行冻结" },
    ],
    correctInterceptIdx: 2,
    reward: { score: 750, antiFraudPoints: 75 },
  },
];

/** 根据 caseId 取五步复盘 */
export function getCaseBreakdown(caseId: string): CaseBreakdownDef | undefined {
  return CASE_BREAKDOWNS.find((c) => c.caseId === caseId);
}

/** 根据敌人/BOSS id 取关联案例五步复盘 */
export function getCaseBreakdownByEnemyId(enemyId: string): CaseBreakdownDef | undefined {
  // 先按 case_<enemyId> 直接找
  const directCaseId = `case_${enemyId}`;
  const direct = CASE_BREAKDOWNS.find((c) => c.caseId === directCaseId);
  if (direct) return direct;
  // v10：boss_xxx 形式回退到 enemyTypeId（boss_deepseek → deepseekFake）
  if (enemyId.startsWith("boss_")) {
    const inner = enemyId.slice(5);
    const bossToEnemyMap: Record<string, string> = {
      deepseek: "deepseekFake",
      aiface: "aiFaceSwap",
    };
    const mappedEnemy = bossToEnemyMap[inner] ?? inner;
    const mappedCaseId = `case_${mappedEnemy}`;
    return CASE_BREAKDOWNS.find((c) => c.caseId === mappedCaseId);
  }
  return undefined;
}

// ====================================================================
// v10 P0-1c：案例五步复盘 → 微型 QuizQuestion 转换
// 每 10 波将真实案例转为"最佳拦截点"选择题，强化教育闭环
// ====================================================================

/**
 * 将 CaseBreakdownDef 转换为微型复盘 QuizQuestion
 * - 题面：案例标题 + 5 步流程简介，问"最佳拦截点"
 * - 选项：5 步的 name + warningSign（玩家选哪一步本可拦截）
 * - 正确答案：correctInterceptIdx
 * - 解析：正确步骤的 correctAction
 * @param caseDef 案例五步复盘定义
 * @returns QuizQuestion（可直接塞入 pendingQuiz 流程）
 */
export function caseBreakdownToMiniQuiz(caseDef: CaseBreakdownDef): QuizQuestion {
  const correctStep = caseDef.steps[caseDef.correctInterceptIdx];
  return {
    id: `miniCase_${caseDef.caseId}`,
    question: `【案例复盘】${caseDef.title}\n此案例在哪一步本可最佳拦截？`,
    options: caseDef.steps.map((s) => `${s.name}：${s.warningSign}`),
    correctIdx: caseDef.correctInterceptIdx,
    explanation: `正确拦截点："${correctStep?.name ?? ""}"。${correctStep?.correctAction ?? ""}`,
    fraudType: caseDef.title.split("·")[0]?.trim() || "案例复盘",
    difficulty: 2,
  };
}

/** 随机取一个案例并转为微型复盘题（每 10 波用） */
export function pickRandomCaseMiniQuiz(): QuizQuestion | null {
  if (CASE_BREAKDOWNS.length === 0) return null;
  const caseDef = CASE_BREAKDOWNS[Math.floor(Math.random() * CASE_BREAKDOWNS.length)];
  return caseBreakdownToMiniQuiz(caseDef);
}

// ====================================================================
// v9 升级：案例分支式调查数据（12 个，对应 12 个案例）
// 玩家扮演反诈干警，在 5 阶段调查中各选调查方向，多分支多结局
// 每节点 3 选项，每选项有 evidenceDelta（证据+）/ lossDelta（损失+）
// 累计 evidence ≥ 阈值 且 loss ≤ 阈值 → S/A/B/C/D 评级
// ====================================================================

export const CASE_INVESTIGATIONS: Record<string, CaseInvestigation> = {
  // ===== 1. 话术脚本诈骗案 =====
  case_robot: {
    startNodeId: "n1",
    nodes: [
      {
        id: "n1", title: "第一阶段 · 来电源头调查", scene: "受害人接到一通自称客服的陌生电话，对方准确报出其姓名与近期订单。你需要调查来电源头。",
        choices: [
          { text: "调取受害人通话记录，追踪主叫号码归属", emoji: "📞", verdict: "perfect", feedback: "正确。溯源主叫号码可锁定诈骗窝点位置。", evidenceDelta: 20, lossDelta: 0, nextNodeId: "n2" },
          { text: "让受害人回忆对方说了什么话术", emoji: "📝", verdict: "ok", feedback: "方向正确，但仅凭话术难以锁定窝点，证据不足。", evidenceDelta: 10, lossDelta: 5, nextNodeId: "n2" },
          { text: "直接让受害人删除通话记录", emoji: "🗑️", verdict: "wrong", feedback: "错误。销毁证据将无法溯源，且受害人损失无法追回。", evidenceDelta: 0, lossDelta: 20, nextNodeId: "n2" },
        ],
      },
      {
        id: "n2", title: "第二阶段 · 话术脚本溯源", scene: "通过通话记录锁定一个境外号码段，疑似诈骗园区自动拨号系统。你需要进一步调查话术脚本来源。",
        choices: [
          { text: "申请跨境协查，调取园区服务器数据", emoji: "🌐", verdict: "perfect", feedback: "正确。跨境协查是捣毁窝点的关键。", evidenceDelta: 25, lossDelta: 0, nextNodeId: "n3" },
          { text: "分析话术文本特征，比对已知话术库", emoji: "🔍", verdict: "ok", feedback: "方向正确，可辅助定罪但无法捣毁窝点。", evidenceDelta: 15, lossDelta: 5, nextNodeId: "n3" },
          { text: "只调查国内中间人，不追境外", emoji: "🚫", verdict: "warn", feedback: "方向有偏。只抓中间人无法斩断源头。", evidenceDelta: 5, lossDelta: 10, nextNodeId: "n3" },
        ],
      },
      {
        id: "n3", title: "第三阶段 · 资金流向追踪", scene: "查明话术窝点诱导受害人转账至一个三级银行卡账户。你需要追踪资金流向。",
        choices: [
          { text: "立即冻结涉案账户，倒查资金链路", emoji: "❄️", verdict: "perfect", feedback: "正确。第一时间冻结可挽回损失。", evidenceDelta: 25, lossDelta: 0, nextNodeId: "n4" },
          { text: "先观察资金流向再冻结", emoji: "👀", verdict: "warn", feedback: "方向有偏。等待期间资金已被转移。", evidenceDelta: 15, lossDelta: 15, nextNodeId: "n4" },
          { text: "通知受害人自行联系银行", emoji: "🏦", verdict: "wrong", feedback: "错误。受害人自行联系效率低，错失冻结黄金期。", evidenceDelta: 5, lossDelta: 25, nextNodeId: "n4" },
        ],
      },
      {
        id: "n4", title: "第四阶段 · 团伙架构摸排", scene: "资金链路指向一个层级分明的诈骗团伙：话务组、资金组、技术组。你需要摸排团伙架构。",
        choices: [
          { text: "综合通信+资金+人员关系大数据分析", emoji: "📊", verdict: "perfect", feedback: "正确。多维数据交叉验证可还原全团伙。", evidenceDelta: 20, lossDelta: 0, nextNodeId: "n5" },
          { text: "只审讯已抓捕的话务员", emoji: "🗣️", verdict: "ok", feedback: "方向正确，但话务员层级低，难触及核心。", evidenceDelta: 10, lossDelta: 10, nextNodeId: "n5" },
          { text: "直接收网抓所有人", emoji: "⚡", verdict: "warn", feedback: "方向有偏。过早收网会打草惊蛇，主犯易逃脱。", evidenceDelta: 5, lossDelta: 15, nextNodeId: "n5" },
        ],
      },
      {
        id: "n5", title: "第五阶段 · 收网与挽损", scene: "团伙架构已摸清，主犯藏匿境外。你需要决定收网策略。",
        choices: [
          { text: "联合国际刑警跨境执法 + 同步冻结资金", emoji: "🌍", verdict: "perfect", feedback: "完美。跨境联合执法是捣毁窝点+挽损的最优解。", evidenceDelta: 20, lossDelta: 0, nextNodeId: null },
          { text: "只在国内收网，境外发红色通缉令", emoji: "🔴", verdict: "ok", feedback: "方向正确，但主犯逍遥法外，损失难全追。", evidenceDelta: 10, lossDelta: 10, nextNodeId: null },
          { text: "先不打草惊蛇，长期经营", emoji: "⏳", verdict: "warn", feedback: "方向有偏。长期经营期间更多受害人被骗。", evidenceDelta: 5, lossDelta: 20, nextNodeId: null },
        ],
      },
    ],
    endings: [
      { id: "S", rank: "S", title: "全链条捣毁", desc: "证据充分、损失极小。联合跨境执法一举捣毁窝点，抓获全部主犯，挽回 90%+ 损失。", minEvidence: 90, maxLoss: 20, rewardMul: 1.5, legalCharacterization: "诈骗罪（跨境），主犯 10 年以上有期徒刑", hotline: "96110 提醒：陌生电话不轻信，挂断后拨打官方核实" },
      { id: "A", rank: "A", title: "主要成员落网", desc: "证据较充分。捣毁国内分支，主犯在逃但资金大部分冻结，挽回 60-80%。", minEvidence: 70, maxLoss: 40, rewardMul: 1.2, legalCharacterization: "诈骗罪，从犯 3-10 年有期徒刑", hotline: "96110 提醒：保留通话记录作为证据" },
      { id: "B", rank: "B", title: "部分挽损", desc: "证据一般。抓获部分从犯，挽回 30-50% 损失。", minEvidence: 50, maxLoss: 60, rewardMul: 1.0, legalCharacterization: "诈骗罪从犯，1-5 年有期徒刑", hotline: "96110 提醒：第一时间报警冻结账户" },
      { id: "C", rank: "C", title: "损失较大", desc: "证据不足。仅抓获底层话务员，主犯与资金均已转移，挽回不足 20%。", minEvidence: 30, maxLoss: 80, rewardMul: 0.6, legalCharacterization: "帮信罪，拘役或 1 年以下", hotline: "96110 提醒：不轻信陌生来电，不转账" },
      { id: "D", rank: "D", title: "侦查失败", desc: "证据严重不足。团伙销毁证据转移资金，受害人损失无法追回。", minEvidence: 0, maxLoss: 100, rewardMul: 0.3, legalCharacterization: "证据不足未起诉", hotline: "96110 提醒：销毁证据将无法溯源" },
    ],
  },

  // ===== 2. 杀猪盘跨境诈骗案 =====
  case_sweet: {
    startNodeId: "n1",
    nodes: [
      {
        id: "n1", title: "第一阶段 · 社交账号溯源", scene: "受害人与'优质异性网友'聊了 3 个月后被诱导投资，被骗 80 万。你需要溯源社交账号。",
        choices: [
          { text: "调取社交账号登录 IP 与设备指纹", emoji: "💻", verdict: "perfect", feedback: "正确。IP 与设备指纹可锁定诈骗分子位置。", evidenceDelta: 20, lossDelta: 0, nextNodeId: "n2" },
          { text: "分析聊天话术特征识别杀猪盘模板", emoji: "💬", verdict: "ok", feedback: "方向正确，但仅话术难定位。", evidenceDelta: 10, lossDelta: 5, nextNodeId: "n2" },
          { text: "让受害人继续与对方周旋套话", emoji: "🎭", verdict: "warn", feedback: "方向有偏。受害人二次受害风险高。", evidenceDelta: 5, lossDelta: 15, nextNodeId: "n2" },
        ],
      },
      {
        id: "n2", title: "第二阶段 · 虚假投资平台取证", scene: "查明对方诱导受害人充值的'投资平台'是虚假平台。你需要对平台取证。",
        choices: [
          { text: "渗透测试平台抓取后台数据与受害人列表", emoji: "🔧", verdict: "perfect", feedback: "正确。后台数据可固定全部受害人证据。", evidenceDelta: 25, lossDelta: 0, nextNodeId: "n3" },
          { text: "只截图受害人自己的账户页面", emoji: "📸", verdict: "ok", feedback: "方向正确，但仅证明单人受骗，难以并案。", evidenceDelta: 10, lossDelta: 10, nextNodeId: "n3" },
          { text: "等平台自行跑路后再取证", emoji: "⏳", verdict: "wrong", feedback: "错误。跑路后服务器关闭，证据灭失。", evidenceDelta: 0, lossDelta: 25, nextNodeId: "n3" },
        ],
      },
      {
        id: "n3", title: "第三阶段 · 资金链路追踪", scene: "受害人 80 万已通过虚拟币混币器转移。你需要追踪资金链路。",
        choices: [
          { text: "联合区块链安全公司追踪混币器流向", emoji: "⛓️", verdict: "perfect", feedback: "正确。链上分析可突破混币器。", evidenceDelta: 25, lossDelta: 0, nextNodeId: "n4" },
          { text: "只冻结法币入口的银行卡", emoji: "❄️", verdict: "ok", feedback: "方向正确，但虚拟币部分已无法冻结。", evidenceDelta: 10, lossDelta: 15, nextNodeId: "n4" },
          { text: "放弃追踪虚拟币部分", emoji: "🏳️", verdict: "wrong", feedback: "错误。放弃即损失无法追回。", evidenceDelta: 0, lossDelta: 30, nextNodeId: "n4" },
        ],
      },
      {
        id: "n4", title: "第四阶段 · 跨境团伙定位", scene: "资金最终流向东南亚某国诈骗园区。你需要定位团伙。",
        choices: [
          { text: "联合当地警方 + 国际刑警同步行动", emoji: "🌍", verdict: "perfect", feedback: "正确。跨境联合行动是捣毁园区的唯一方式。", evidenceDelta: 20, lossDelta: 0, nextNodeId: "n5" },
          { text: "通过回流人员口供摸排园区内部", emoji: "🗣️", verdict: "ok", feedback: "方向正确，但效率较低。", evidenceDelta: 12, lossDelta: 8, nextNodeId: "n5" },
          { text: "只在国内抓马仔不跨境", emoji: "🚫", verdict: "warn", feedback: "方向有偏。主犯在境外逍遥。", evidenceDelta: 5, lossDelta: 15, nextNodeId: "n5" },
        ],
      },
      {
        id: "n5", title: "第五阶段 · 收网与受害人救助", scene: "园区位置已锁定，内有被胁迫从事诈骗的受害人。你需要决定收网策略。",
        choices: [
          { text: "跨境联合解救 + 同步冻结资金 + 引渡主犯", emoji: "🛡️", verdict: "perfect", feedback: "完美。解救+挽损+惩凶三管齐下。", evidenceDelta: 20, lossDelta: 0, nextNodeId: null },
          { text: "只引渡主犯，不解救园区内人员", emoji: "⚖️", verdict: "ok", feedback: "方向正确，但园区内受害人继续受胁迫。", evidenceDelta: 10, lossDelta: 10, nextNodeId: null },
          { text: "只冻结资金不抓人", emoji: "💰", verdict: "warn", feedback: "方向有偏。资金冻结后主犯转移阵地。", evidenceDelta: 5, lossDelta: 15, nextNodeId: null },
        ],
      },
    ],
    endings: [
      { id: "S", rank: "S", title: "全链条捣毁+解救", desc: "跨境联合行动捣毁园区，解救被胁迫人员，挽回 80%+ 损失。", minEvidence: 90, maxLoss: 20, rewardMul: 1.5, legalCharacterization: "诈骗罪（跨境集团），主犯无期徒刑", hotline: "96110 提醒：网恋不投资，投资不跟单" },
      { id: "A", rank: "A", title: "主犯落网", desc: "抓获主犯，挽回 50-70% 损失。", minEvidence: 70, maxLoss: 40, rewardMul: 1.2, legalCharacterization: "诈骗罪，主犯 10 年以上", hotline: "96110 提醒：不见面不转账" },
      { id: "B", rank: "B", title: "部分挽损", desc: "抓获从犯，挽回 20-40%。", minEvidence: 50, maxLoss: 60, rewardMul: 1.0, legalCharacterization: "诈骗罪从犯，3-7 年", hotline: "96110 提醒：理财认持牌" },
      { id: "C", rank: "C", title: "损失较大", desc: "仅冻结部分资金，主犯在逃。", minEvidence: 30, maxLoss: 80, rewardMul: 0.6, legalCharacterization: "帮信罪", hotline: "96110 提醒：高收益=高风险" },
      { id: "D", rank: "D", title: "侦查失败", desc: "虚拟币混币成功，资金无法追踪。", minEvidence: 0, maxLoss: 100, rewardMul: 0.3, legalCharacterization: "证据不足", hotline: "96110 提醒：虚拟币投资不保本" },
    ],
  },

  // ===== 3. 冒充公检法跨境诈骗案 =====
  case_threat: {
    startNodeId: "n1",
    nodes: [
      {
        id: "n1", title: "第一阶段 · 假公文溯源", scene: "受害人收到伪造拘捕令，被诱导转账至'安全账户'。你需要溯源假公文。",
        choices: [
          { text: "鉴定拘捕令公章 PS 痕迹 + 追踪发送账号", emoji: "🔬", verdict: "perfect", feedback: "正确。技术鉴定+账号溯源双管齐下。", evidenceDelta: 20, lossDelta: 0, nextNodeId: "n2" },
          { text: "只询问受害人对方说了什么", emoji: "📝", verdict: "ok", feedback: "方向正确但证据单薄。", evidenceDelta: 10, lossDelta: 5, nextNodeId: "n2" },
          { text: "告诉受害人这种事很常见不用查", emoji: "🤷", verdict: "wrong", feedback: "错误。每起案件都需立案侦查。", evidenceDelta: 0, lossDelta: 20, nextNodeId: "n2" },
        ],
      },
      {
        id: "n2", title: "第二阶段 · 通信链路追踪", scene: "诈骗分子通过 QQ/微信发送假公文，电话恐吓受害人。你需要追踪通信链路。",
        choices: [
          { text: "联合运营商+腾讯调取通信与社交账号数据", emoji: "📡", verdict: "perfect", feedback: "正确。跨平台数据关联可锁定嫌疑人。", evidenceDelta: 25, lossDelta: 0, nextNodeId: "n3" },
          { text: "只调取电话记录不查社交账号", emoji: "📞", verdict: "ok", feedback: "方向正确，但漏掉关键证据链。", evidenceDelta: 12, lossDelta: 8, nextNodeId: "n3" },
          { text: "让受害人加对方好友套话", emoji: "🎭", verdict: "warn", feedback: "方向有偏。受害人二次受害风险。", evidenceDelta: 5, lossDelta: 15, nextNodeId: "n3" },
        ],
      },
      {
        id: "n3", title: "第三阶段 · '安全账户'追查", scene: "受害人的钱被转入所谓的'安全账户'。你需要追查账户。",
        choices: [
          { text: "立即冻结涉案账户 + 倒查开户人信息", emoji: "❄️", verdict: "perfect", feedback: "正确。冻结+倒查是挽损关键。", evidenceDelta: 25, lossDelta: 0, nextNodeId: "n4" },
          { text: "先查开户人再冻结", emoji: "🔍", verdict: "warn", feedback: "方向有偏。查询期间资金被转走。", evidenceDelta: 15, lossDelta: 20, nextNodeId: "n4" },
          { text: "告诉受害人钱追不回来了", emoji: "🏳️", verdict: "wrong", feedback: "错误。第一时间冻结可挽回。", evidenceDelta: 0, lossDelta: 30, nextNodeId: "n4" },
        ],
      },
      {
        id: "n4", title: "第四阶段 · 诈骗团伙架构", scene: "查明这是分工明确的跨境团伙：话务组+PS 组+资金组。你需要摸排架构。",
        choices: [
          { text: "通过资金流+通信流+人员流交叉分析", emoji: "📊", verdict: "perfect", feedback: "正确。三流交叉可还原全团伙。", evidenceDelta: 20, lossDelta: 0, nextNodeId: "n5" },
          { text: "只审讯已抓的开卡人", emoji: "🗣️", verdict: "ok", feedback: "方向正确，但开卡人层级低。", evidenceDelta: 8, lossDelta: 12, nextNodeId: "n5" },
          { text: "直接公开通缉所有嫌疑人", emoji: "📢", verdict: "warn", feedback: "方向有偏。打草惊蛇主犯逃。", evidenceDelta: 5, lossDelta: 15, nextNodeId: "n5" },
        ],
      },
      {
        id: "n5", title: "第五阶段 · 跨境收网", scene: "主犯藏匿境外，国内从犯已锁定。你需要决定收网策略。",
        choices: [
          { text: "国内同步抓捕+境外联合引渡+资金冻结", emoji: "🌍", verdict: "perfect", feedback: "完美。三同步收网最优。", evidenceDelta: 20, lossDelta: 0, nextNodeId: null },
          { text: "只国内抓捕，境外发红通", emoji: "🔴", verdict: "ok", feedback: "方向正确，主犯在逃。", evidenceDelta: 10, lossDelta: 10, nextNodeId: null },
          { text: "只冻结资金不抓人", emoji: "💰", verdict: "warn", feedback: "方向有偏。团伙转移阵地继续作案。", evidenceDelta: 5, lossDelta: 15, nextNodeId: null },
        ],
      },
    ],
    endings: [
      { id: "S", rank: "S", title: "全链条捣毁", desc: "跨境联合捣毁团伙，主犯引渡归案，挽回 85%+。", minEvidence: 90, maxLoss: 20, rewardMul: 1.5, legalCharacterization: "诈骗罪（冒充国家机关），从重处罚 10 年以上", hotline: "96110 提醒：公检法不电办，无'安全账户'" },
      { id: "A", rank: "A", title: "主犯落网", desc: "主犯归案，挽回 50-70%。", minEvidence: 70, maxLoss: 40, rewardMul: 1.2, legalCharacterization: "诈骗罪，10 年以上", hotline: "96110 提醒：挂断后拨 110 核实" },
      { id: "B", rank: "B", title: "部分挽损", desc: "抓获从犯，挽回 25-45%。", minEvidence: 50, maxLoss: 60, rewardMul: 1.0, legalCharacterization: "诈骗罪从犯，3-7 年", hotline: "96110 提醒：拘捕令不通过 QQ 发" },
      { id: "C", rank: "C", title: "损失较大", desc: "仅抓开卡人，主犯在逃。", minEvidence: 30, maxLoss: 80, rewardMul: 0.6, legalCharacterization: "帮信罪", hotline: "96110 提醒：不转账到'安全账户'" },
      { id: "D", rank: "D", title: "侦查失败", desc: "证据灭失，资金转移完毕。", minEvidence: 0, maxLoss: 100, rewardMul: 0.3, legalCharacterization: "证据不足", hotline: "96110 提醒：第一时间报警" },
    ],
  },

  // ===== 4. AI 换脸冒充熟人诈骗案 =====
  case_deepfake: {
    startNodeId: "n1",
    nodes: [
      {
        id: "n1", title: "第一阶段 · 视频样本取证", scene: "受害人通过视频通话看到'亲友'脸被骗 50 万。你需要取证视频。",
        choices: [
          { text: "提取视频帧做 Deepfake 篡改痕迹鉴定", emoji: "🔬", verdict: "perfect", feedback: "正确。技术鉴定可固定 AI 伪造证据。", evidenceDelta: 25, lossDelta: 0, nextNodeId: "n2" },
          { text: "只询问受害人视频时长与内容", emoji: "📝", verdict: "ok", feedback: "方向正确，但缺乏技术证据。", evidenceDelta: 10, lossDelta: 5, nextNodeId: "n2" },
          { text: "告诉受害人 AI 换脸无法破案", emoji: "🏳️", verdict: "wrong", feedback: "错误。技术鉴定可追溯伪造模型。", evidenceDelta: 0, lossDelta: 20, nextNodeId: "n2" },
        ],
      },
      {
        id: "n2", title: "第二阶段 · 伪造模型溯源", scene: "鉴定确认是 AI 换脸。你需要溯源伪造模型与训练数据来源。",
        choices: [
          { text: "调取亲友社交账号被盗用的证据 + 追踪模型下载源", emoji: "🌐", verdict: "perfect", feedback: "正确。锁定训练数据来源可追溯犯罪链条。", evidenceDelta: 25, lossDelta: 0, nextNodeId: "n3" },
          { text: "只分析换脸软件特征", emoji: "🔧", verdict: "ok", feedback: "方向正确，但难以定位具体嫌疑人。", evidenceDelta: 12, lossDelta: 8, nextNodeId: "n3" },
          { text: "只告诉亲友删除社交账号照片", emoji: "🗑️", verdict: "warn", feedback: "方向有偏。预防措施但不推进侦查。", evidenceDelta: 5, lossDelta: 15, nextNodeId: "n3" },
        ],
      },
      {
        id: "n3", title: "第三阶段 · 资金紧急止付", scene: "50 万已转入陌生账户。你需要紧急止付。",
        choices: [
          { text: "立即启动反诈中心紧急止付机制", emoji: "🚨", verdict: "perfect", feedback: "正确。黄金 30 分钟内止付可挽损。", evidenceDelta: 25, lossDelta: 0, nextNodeId: "n4" },
          { text: "让受害人自行联系银行冻结", emoji: "🏦", verdict: "warn", feedback: "方向有偏。银行流程慢，错失黄金期。", evidenceDelta: 10, lossDelta: 20, nextNodeId: "n4" },
          { text: "先立案走流程再止付", emoji: "📋", verdict: "wrong", feedback: "错误。立案流程期间资金被转走。", evidenceDelta: 5, lossDelta: 30, nextNodeId: "n4" },
        ],
      },
      {
        id: "n4", title: "第四阶段 · 诈骗团伙技术画像", scene: "查明这是技术型团伙，专门用 AI 换脸+拟声实施诈骗。你需要技术画像。",
        choices: [
          { text: "联合网安部门分析 AI 模型指纹 + 关联历史案件", emoji: "🤖", verdict: "perfect", feedback: "正确。模型指纹可串并全国案件。", evidenceDelta: 20, lossDelta: 0, nextNodeId: "n5" },
          { text: "只分析本案资金流", emoji: "💰", verdict: "ok", feedback: "方向正确，但无法串并案件。", evidenceDelta: 10, lossDelta: 10, nextNodeId: "n5" },
          { text: "只审讯资金组马仔", emoji: "🗣️", verdict: "warn", feedback: "方向有偏。技术组才是核心。", evidenceDelta: 5, lossDelta: 15, nextNodeId: "n5" },
        ],
      },
      {
        id: "n5", title: "第五阶段 · 全链条打击", scene: "技术组+资金组+话务组分工明确。你需要全链条打击。",
        choices: [
          { text: "三组同步收网 + 固定 AI 伪造工具作为定罪证据", emoji: "⚖️", verdict: "perfect", feedback: "完美。同步收网+技术证据固定。", evidenceDelta: 20, lossDelta: 0, nextNodeId: null },
          { text: "只抓资金组，技术组后续追查", emoji: "💰", verdict: "ok", feedback: "方向正确，技术组销毁证据。", evidenceDelta: 10, lossDelta: 15, nextNodeId: null },
          { text: "公开警示但不抓人", emoji: "📢", verdict: "wrong", feedback: "错误。团伙转移阵地继续作案。", evidenceDelta: 0, lossDelta: 25, nextNodeId: null },
        ],
      },
    ],
    endings: [
      { id: "S", rank: "S", title: "全链条捣毁", desc: "三组同步落网，AI 伪造工具固定，挽回 85%+。", minEvidence: 90, maxLoss: 20, rewardMul: 1.5, legalCharacterization: "诈骗罪+非法使用 AI 技术，从重处罚", hotline: "96110 提醒：视频借钱务必电话核实" },
      { id: "A", rank: "A", title: "主要成员落网", desc: "抓获技术组与资金组，挽回 50-70%。", minEvidence: 70, maxLoss: 40, rewardMul: 1.2, legalCharacterization: "诈骗罪，7-12 年", hotline: "96110 提醒：换话题问私密信息核实" },
      { id: "B", rank: "B", title: "部分挽损", desc: "抓获资金组，技术组在逃，挽回 25-45%。", minEvidence: 50, maxLoss: 60, rewardMul: 1.0, legalCharacterization: "诈骗罪从犯，3-7 年", hotline: "96110 提醒：视频卡顿眨眼异常需警惕" },
      { id: "C", rank: "C", title: "损失较大", desc: "仅止付部分资金，团伙销毁技术证据。", minEvidence: 30, maxLoss: 80, rewardMul: 0.6, legalCharacterization: "帮信罪", hotline: "96110 提醒：不转账到陌生账户" },
      { id: "D", rank: "D", title: "侦查失败", desc: "AI 伪造工具无法固定，资金转移完毕。", minEvidence: 0, maxLoss: 100, rewardMul: 0.3, legalCharacterization: "证据不足", hotline: "96110 提醒：保留视频作为证据" },
    ],
  },
};

/**
 * v9：通用调查模板生成器（为 v8 遗留案例生成标准分支调查）
 * 基于 caseId 对应的五步数据自动生成 5 节点 × 3 选项的调查剧本
 */
function buildGenericInvestigation(caseId: string, steps: CaseBreakdownDef["steps"]): CaseInvestigation {
  const nodes = steps.map((step, idx) => ({
    id: `n${idx + 1}`,
    title: `第${idx + 1}阶段 · ${step.name}阶段调查`,
    scene: `${step.desc}。预警信号：${step.warningSign}。正确应对：${step.correctAction}。`,
    choices: [
      { text: "采取标准侦查流程，固定证据", emoji: "🔍", verdict: "perfect" as const, feedback: `正确。${step.correctAction}`, evidenceDelta: 20, lossDelta: 0, nextNodeId: idx < steps.length - 1 ? `n${idx + 2}` : null },
      { text: "仅做初步调查，证据链不完整", emoji: "📝", verdict: "ok" as const, feedback: `方向正确但证据不足。${step.warningSign}`, evidenceDelta: 10, lossDelta: 10, nextNodeId: idx < steps.length - 1 ? `n${idx + 2}` : null },
      { text: "跳过本阶段直接推进", emoji: "⏭️", verdict: "warn" as const, feedback: `方向有偏。遗漏${step.name}阶段证据将影响定罪。`, evidenceDelta: 5, lossDelta: 20, nextNodeId: idx < steps.length - 1 ? `n${idx + 2}` : null },
    ],
  }));
  return {
    startNodeId: "n1",
    nodes,
    endings: [
      { id: "S", rank: "S", title: "完美侦查", desc: "证据充分，损失极小，全链条打击。", minEvidence: 90, maxLoss: 20, rewardMul: 1.5, legalCharacterization: "诈骗罪，从重处罚", hotline: "96110 反诈专线" },
      { id: "A", rank: "A", title: "主要落网", desc: "证据较充分，主要嫌疑人落网。", minEvidence: 70, maxLoss: 40, rewardMul: 1.2, legalCharacterization: "诈骗罪，5-10 年", hotline: "96110 反诈专线" },
      { id: "B", rank: "B", title: "部分挽损", desc: "证据一般，部分挽损。", minEvidence: 50, maxLoss: 60, rewardMul: 1.0, legalCharacterization: "诈骗罪从犯，1-5 年", hotline: "96110 反诈专线" },
      { id: "C", rank: "C", title: "损失较大", desc: "证据不足，损失较大。", minEvidence: 30, maxLoss: 80, rewardMul: 0.6, legalCharacterization: "帮信罪", hotline: "96110 反诈专线" },
      { id: "D", rank: "D", title: "侦查失败", desc: "证据灭失，损失无法追回。", minEvidence: 0, maxLoss: 100, rewardMul: 0.3, legalCharacterization: "证据不足", hotline: "96110 反诈专线" },
    ],
  };
}

/** v9：取案例的分支式调查剧本（优先用详细版，缺省自动生成通用版） */
export function getCaseInvestigation(caseId: string): CaseInvestigation | undefined {
  if (CASE_INVESTIGATIONS[caseId]) return CASE_INVESTIGATIONS[caseId];
  const breakdown = CASE_BREAKDOWNS.find((c) => c.caseId === caseId);
  if (!breakdown) return undefined;
  return buildGenericInvestigation(caseId, breakdown.steps);
}

// ====================================================================
// v8：探员个人支线（10 探员 × 3 战，完成解锁专属皮肤/天赋）
// ====================================================================

export const AGENT_STORY_QUESTS: AgentStoryQuest[] = [
  {
    agentId: "shen",
    title: "沈锋 · 断卡追踪",
    summary: "沈锋追踪一桩 7 层壳公司的资金链，3 战逐步揭开洗钱网络",
    chapters: [
      {
        order: 1,
        title: "第一层壳",
        prologue: [
          { speaker: "沈锋", emoji: "🔫", text: "资金走的第一层壳是空壳公司,我去查账。", color: "#FF7A1A", side: "player" },
        ],
        epilogue: [
          { speaker: "沈锋", emoji: "🔫", text: "查到了,背后还有 6 层。", color: "#FF7A1A", side: "player" },
        ],
        waveSeed: "shen_story_1",
        recommendedPower: 800,
      },
      {
        order: 2,
        title: "中层卡农",
        prologue: [
          { speaker: "沈锋", emoji: "🔫", text: "中层卡农浮现,这次有反抗。", color: "#FF7A1A", side: "player" },
        ],
        epilogue: [
          { speaker: "沈锋", emoji: "🔫", text: "卡农王钱叔露面了。", color: "#FF7A1A", side: "player" },
        ],
        waveSeed: "shen_story_2",
        recommendedPower: 1200,
        bossId: "boss_farmer",
      },
      {
        order: 3,
        title: "钱叔落网",
        prologue: [
          { speaker: "沈锋", emoji: "🔫", text: "7 层壳全部冻结。钱叔,你的卡池我们一清二楚。", color: "#FF7A1A", side: "player" },
        ],
        epilogue: [
          { speaker: "沈锋", emoji: "🔫", text: "断卡行动,一查到底。", color: "#FF7A1A", side: "player" },
        ],
        waveSeed: "shen_story_3",
        recommendedPower: 1600,
      },
    ],
    reward: { skinId: "skin_shen_formal", talentPoints: 200 },
  },
  {
    agentId: "lin",
    title: "林书影 · 96110 风暴",
    summary: "林书影在 96110 话务中心识破连环假客服,3 战净化客服网络",
    chapters: [
      {
        order: 1,
        title: "话术风暴",
        prologue: [{ speaker: "林书影", emoji: "📡", text: "今天接了 200 个假客服电话,真客服快被淹没。", color: "#00E5FF", side: "player" }],
        epilogue: [{ speaker: "林书影", emoji: "📡", text: "客服007的脚本套路都一样。", color: "#00E5FF", side: "player" }],
        waveSeed: "lin_story_1",
        recommendedPower: 800,
      },
      {
        order: 2,
        title: "弹窗轰炸",
        prologue: [{ speaker: "林书影", emoji: "📡", text: "弹窗轰炸开始了,识破每一个。", color: "#00E5FF", side: "player" }],
        epilogue: [{ speaker: "林书影", emoji: "📡", text: "客服007的本体浮现。", color: "#00E5FF", side: "player" }],
        waveSeed: "lin_story_2",
        recommendedPower: 1200,
        bossId: "boss_popup",
      },
      {
        order: 3,
        title: "客服007落网",
        prologue: [{ speaker: "林书影", emoji: "📡", text: "假客服必挂,真客服不催。今天终结你。", color: "#00E5FF", side: "player" }],
        epilogue: [{ speaker: "林书影", emoji: "📡", text: "96110 一天能接 200 个,你的剧本失效了。", color: "#00E5FF", side: "player" }],
        waveSeed: "lin_story_3",
        recommendedPower: 1600,
      },
    ],
    reward: { skinId: "skin_lin_night", talentPoints: 200 },
  },
  {
    agentId: "zhou",
    title: "周衡 · 网安追踪",
    summary: "周衡黑进电诈窝点服务器,3 战揭跨境服务器网络",
    chapters: [
      {
        order: 1,
        title: "服务器入侵",
        prologue: [{ speaker: "周衡", emoji: "💻", text: "我先黑进他们的边缘服务器。", color: "#B388FF", side: "player" }],
        epilogue: [{ speaker: "周衡", emoji: "💻", text: "找到了主服务器坐标。", color: "#B388FF", side: "player" }],
        waveSeed: "zhou_story_1",
        recommendedPower: 1000,
      },
      {
        order: 2,
        title: "数据围剿",
        prologue: [{ speaker: "周衡", emoji: "💻", text: "数据围剿启动,反查他们的资金流向。", color: "#B388FF", side: "player" }],
        epilogue: [{ speaker: "周衡", emoji: "💻", text: "缅北枭雄的服务器集群定位完毕。", color: "#B388FF", side: "player" }],
        waveSeed: "zhou_story_2",
        recommendedPower: 1400,
      },
      {
        order: 3,
        title: "服务器清零",
        prologue: [{ speaker: "周衡", emoji: "💻", text: "服务器清零,所有诈骗脚本归零。", color: "#B388FF", side: "player" }],
        epilogue: [{ speaker: "周衡", emoji: "💻", text: "下一个换脸样本,已入库训练。", color: "#B388FF", side: "player" }],
        waveSeed: "zhou_story_3",
        recommendedPower: 1800,
      },
    ],
    reward: { skinId: "skin_zhou_hacker", talentPoints: 200 },
  },
  {
    agentId: "wang",
    title: "王婆婆 · 社区扫街",
    summary: "王婆婆社区宣讲,3 战拆穿保健品/杀猪盘/校园贷",
    chapters: [
      {
        order: 1,
        title: "保健品骗局",
        prologue: [{ speaker: "王婆婆", emoji: "👵", text: "今天社区有'免费体检',我去看看。", color: "#52C41A", side: "player" }],
        epilogue: [{ speaker: "王婆婆", emoji: "👵", text: "保健品的'神效'都是话术。", color: "#52C41A", side: "player" }],
        waveSeed: "wang_story_1",
        recommendedPower: 700,
      },
      {
        order: 2,
        title: "杀猪盘拆穿",
        prologue: [{ speaker: "王婆婆", emoji: "👵", text: "邻居家孩子在网恋,我得提醒。", color: "#52C41A", side: "player" }],
        epilogue: [{ speaker: "王婆婆", emoji: "👵", text: "甜言蜜语藏刀子,姑娘我见多了。", color: "#52C41A", side: "player" }],
        waveSeed: "wang_story_2",
        recommendedPower: 1100,
      },
      {
        order: 3,
        title: "校园贷宣讲",
        prologue: [{ speaker: "王婆婆", emoji: "👵", text: "进校园讲一讲校园贷。", color: "#52C41A", side: "player" }],
        epilogue: [{ speaker: "王婆婆", emoji: "👵", text: "一届一届讲下去。", color: "#52C41A", side: "player" }],
        waveSeed: "wang_story_3",
        recommendedPower: 1500,
      },
    ],
    reward: { talentPoints: 200, relicId: "relic_regen_module" },
  },
  {
    agentId: "su",
    title: "苏岩 · 数据预警",
    summary: "苏岩用数据模型预警诈骗团伙,3 战拦截大额转账",
    chapters: [
      {
        order: 1,
        title: "模型预警",
        prologue: [{ speaker: "苏岩", emoji: "📊", text: "数据模型预警到一笔可疑转账。", color: "#FFD666", side: "player" }],
        epilogue: [{ speaker: "苏岩", emoji: "📊", text: "及时拦截,资金追回。", color: "#FFD666", side: "player" }],
        waveSeed: "su_story_1",
        recommendedPower: 900,
      },
      {
        order: 2,
        title: "团伙画像",
        prologue: [{ speaker: "苏岩", emoji: "📊", text: "团伙画像完成,锁定跨境流向。", color: "#FFD666", side: "player" }],
        epilogue: [{ speaker: "苏岩", emoji: "📊", text: "下一个盘,提前预警。", color: "#FFD666", side: "player" }],
        waveSeed: "su_story_2",
        recommendedPower: 1300,
      },
      {
        order: 3,
        title: "精准狙击",
        prologue: [{ speaker: "苏岩", emoji: "📊", text: "精准狙击启动,数据锁定诈骗头目。", color: "#FFD666", side: "player" }],
        epilogue: [{ speaker: "苏岩", emoji: "📊", text: "下一个名单,已入库。", color: "#FFD666", side: "player" }],
        waveSeed: "su_story_3",
        recommendedPower: 1700,
      },
    ],
    reward: { skinId: "skin_su_default", talentPoints: 200, relicId: "relic_score_chip" },
  },
  {
    agentId: "chen",
    title: "陈默 · 卧底归途",
    summary: "陈默卧底三年归队,3 战收网跨境电诈园区",
    chapters: [
      {
        order: 1,
        title: "卧底归队",
        prologue: [{ speaker: "陈默", emoji: "🥷", text: "卧底三年,名单带回来了。", color: "#E5353B", side: "player" }],
        epilogue: [{ speaker: "陈默", emoji: "🥷", text: "跨境联合执法启动。", color: "#E5353B", side: "player" }],
        waveSeed: "chen_story_1",
        recommendedPower: 1200,
      },
      {
        order: 2,
        title: "园区围剿",
        prologue: [{ speaker: "陈默", emoji: "🥷", text: "园区围剿,逐个清。", color: "#E5353B", side: "player" }],
        epilogue: [{ speaker: "陈默", emoji: "🥷", text: "缅北枭雄的园区千名'员工'。", color: "#E5353B", side: "player" }],
        waveSeed: "chen_story_2",
        recommendedPower: 1600,
        bossId: "boss_kingpin",
      },
      {
        order: 3,
        title: "跨境收网",
        prologue: [{ speaker: "陈默", emoji: "🥷", text: "跨境收网,今日清零。", color: "#E5353B", side: "player" }],
        epilogue: [{ speaker: "陈默", emoji: "🥷", text: "反诈没有终点。", color: "#E5353B", side: "player" }],
        waveSeed: "chen_story_3",
        recommendedPower: 2000,
      },
    ],
    reward: { skinId: "skin_chen_stealth", talentPoints: 300 },
  },
  {
    agentId: "fayi",
    title: "法务审计师 · 资金链审计",
    summary: "法务审计师审计复杂资金链,3 战冻结 7 层壳公司",
    chapters: [
      {
        order: 1,
        title: "壳公司审计",
        prologue: [{ speaker: "法务审计师", emoji: "⚖️", text: "我先审计最外层壳公司。", color: "#3D8BFD", side: "player" }],
        epilogue: [{ speaker: "法务审计师", emoji: "⚖️", text: "壳公司背后是 6 层资金链。", color: "#3D8BFD", side: "player" }],
        waveSeed: "fayi_story_1",
        recommendedPower: 1000,
      },
      {
        order: 2,
        title: "资金链冻结",
        prologue: [{ speaker: "法务审计师", emoji: "⚖️", text: "资金链冻结启动。", color: "#3D8BFD", side: "player" }],
        epilogue: [{ speaker: "法务审计师", emoji: "⚖️", text: "虚假理财平台暴雷了。", color: "#3D8BFD", side: "player" }],
        waveSeed: "fayi_story_2",
        recommendedPower: 1400,
        bossId: "boss_invest",
      },
      {
        order: 3,
        title: "追赃挽损",
        prologue: [{ speaker: "法务审计师", emoji: "⚖️", text: "追赃挽损启动。", color: "#3D8BFD", side: "player" }],
        epilogue: [{ speaker: "法务审计师", emoji: "⚖️", text: "复杂资金链审计是追赃的关键。", color: "#3D8BFD", side: "player" }],
        waveSeed: "fayi_story_3",
        recommendedPower: 1800,
      },
    ],
    reward: { talentPoints: 300, relicId: "relic_regen_module" },
  },
  {
    agentId: "yuce",
    title: "数据预测师 · AI 风控",
    summary: "数据预测师用 AI 预测诈骗团伙下一步,3 战拦截大额诈骗",
    chapters: [
      {
        order: 1,
        title: "AI 预警",
        prologue: [{ speaker: "数据预测师", emoji: "🔮", text: "AI 模型预警到下一个目标。", color: "#00C9A7", side: "player" }],
        epilogue: [{ speaker: "数据预测师", emoji: "🔮", text: "提前预警,资金追回。", color: "#00C9A7", side: "player" }],
        waveSeed: "yuce_story_1",
        recommendedPower: 1000,
      },
      {
        order: 2,
        title: "校园贷预警",
        prologue: [{ speaker: "数据预测师", emoji: "🔮", text: "校园贷团伙浮现,启动预警。", color: "#00C9A7", side: "player" }],
        epilogue: [{ speaker: "数据预测师", emoji: "🔮", text: "蜡笔老哥团伙定位完毕。", color: "#00C9A7", side: "player" }],
        waveSeed: "yuce_story_2",
        recommendedPower: 1400,
        bossId: "boss_loan",
      },
      {
        order: 3,
        title: "AI 风控闭环",
        prologue: [{ speaker: "数据预测师", emoji: "🔮", text: "AI 风控闭环启动。", color: "#00C9A7", side: "player" }],
        epilogue: [{ speaker: "数据预测师", emoji: "🔮", text: "AI 风控可在受害人转账前发出预警。", color: "#00C9A7", side: "player" }],
        waveSeed: "yuce_story_3",
        recommendedPower: 1800,
      },
    ],
    reward: { talentPoints: 300, relicId: "relic_combo_extender" },
  },
  {
    agentId: "kuajing",
    title: "跨境联络官 · 国际执法",
    summary: "跨境联络官协调国际执法,3 战清零跨境电诈园区",
    chapters: [
      {
        order: 1,
        title: "国际协调",
        prologue: [{ speaker: "跨境联络官", emoji: "🌐", text: "国际刑警协调完毕。", color: "#FF8A3D", side: "player" }],
        epilogue: [{ speaker: "跨境联络官", emoji: "🌐", text: "联合行动启动。", color: "#FF8A3D", side: "player" }],
        waveSeed: "kuajing_story_1",
        recommendedPower: 1200,
      },
      {
        order: 2,
        title: "跨境收网",
        prologue: [{ speaker: "跨境联络官", emoji: "🌐", text: "跨境收网启动。", color: "#FF8A3D", side: "player" }],
        epilogue: [{ speaker: "跨境联络官", emoji: "🌐", text: "缅北枭雄的园区千名'员工'。", color: "#FF8A3D", side: "player" }],
        waveSeed: "kuajing_story_2",
        recommendedPower: 1600,
        bossId: "boss_kingpin",
      },
      {
        order: 3,
        title: "园区清零",
        prologue: [{ speaker: "跨境联络官", emoji: "🌐", text: "园区清零启动。", color: "#FF8A3D", side: "player" }],
        epilogue: [{ speaker: "跨境联络官", emoji: "🌐", text: "跨境必究。", color: "#FF8A3D", side: "player" }],
        waveSeed: "kuajing_story_3",
        recommendedPower: 2000,
      },
    ],
    reward: { talentPoints: 300, relicId: "relic_start_shield" },
  },
  {
    agentId: "jianwei",
    title: "AI 鉴伪师 · Deepfake 对决",
    summary: "AI 鉴伪师与 Deepfake 团伙对决,3 战升级鉴伪模型",
    chapters: [
      {
        order: 1,
        title: "鉴伪模型",
        prologue: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "鉴伪模型启动,识别每一帧合成。", color: "#A8E6CF", side: "player" }],
        epilogue: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "镜像团伙浮现。", color: "#A8E6CF", side: "player" }],
        waveSeed: "jianwei_story_1",
        recommendedPower: 1100,
      },
      {
        order: 2,
        title: "镜像对决",
        prologue: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "镜像对决开始。", color: "#A8E6CF", side: "player" }],
        epilogue: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "镜像的本体浮现。", color: "#A8E6CF", side: "player" }],
        waveSeed: "jianwei_story_2",
        recommendedPower: 1500,
        bossId: "boss_deepfake",
      },
      {
        order: 3,
        title: "鉴伪升级",
        prologue: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "鉴伪模型升级,识别每一帧。", color: "#A8E6CF", side: "player" }],
        epilogue: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "AI 鉴伪一直在升级。", color: "#A8E6CF", side: "player" }],
        waveSeed: "jianwei_story_3",
        recommendedPower: 1900,
      },
    ],
    reward: { talentPoints: 300, relicId: "relic_energy_reactor" },
  },
];

/** 根据探员 id 取支线任务 */
export function getAgentStoryQuest(agentId: string): AgentStoryQuest | undefined {
  return AGENT_STORY_QUESTS.find((q) => q.agentId === agentId);
}

// ====================================================================
// v8：卡牌大招定义（10 探员 × 3 张牌 = 30 张）
// 保留能量基础（基础 100 能量），每张牌消耗能量不同
// 稀有度越高效果越强，但费用越高
// ====================================================================

export const CARD_SKILLS: CardSkillDef[] = [
  // ===== 沈锋（资金链斩断师）=====
  { id: "card_shen_1", agentId: "shen", name: "资金穿透·速", desc: "对当前排敌人造成 180% 伤害", rarity: "common", emoji: "🔫", color: "#FF7A1A", cost: 60, effect: { kind: "pierce", dmgMul: 1.8, lane: 0 } },
  { id: "card_shen_2", agentId: "shen", name: "资金穿透·强", desc: "对当前排敌人造成 250% 伤害", rarity: "rare", emoji: "🔫", color: "#FF7A1A", cost: 90, effect: { kind: "pierce", dmgMul: 2.5, lane: 0 } },
  { id: "card_shen_3", agentId: "shen", name: "断金风暴", desc: "AOE 100 半径 + 减速 50%（3 秒）", rarity: "epic", emoji: "💥", color: "#FF3B6B", cost: 100, effect: { kind: "aoePlusSlow", dmgMul: 2.0, radius: 100, slowMul: 0.5, slowDuration: 3 } },
  // ===== 林书影（话术识别员）=====
  { id: "card_lin_1", agentId: "lin", name: "信号拦截·速", desc: "全场减速 40%（3 秒）", rarity: "common", emoji: "📡", color: "#00E5FF", cost: 60, effect: { kind: "slowAll", slowMul: 0.4, duration: 3, vulnBonus: 0.2 } },
  { id: "card_lin_2", agentId: "lin", name: "信号拦截·强", desc: "全场减速 60%（4 秒）+ 易伤 50%", rarity: "rare", emoji: "📡", color: "#00E5FF", cost: 90, effect: { kind: "slowAll", slowMul: 0.6, duration: 4, vulnBonus: 0.5 } },
  { id: "card_lin_3", agentId: "lin", name: "96110 风暴", desc: "全场冻结 2 秒 + 易伤 30%", rarity: "epic", emoji: "❄️", color: "#A8E6CF", cost: 100, effect: { kind: "freeze", duration: 2, vulnBonus: 0.3 } },
  // ===== 周衡（网安追踪师）=====
  { id: "card_zhou_1", agentId: "zhou", name: "数据围剿·速", desc: "AOE 80 半径 180% 伤害", rarity: "common", emoji: "💻", color: "#B388FF", cost: 60, effect: { kind: "aoe", dmgMul: 1.8, radius: 80 } },
  { id: "card_zhou_2", agentId: "zhou", name: "数据围剿·强", desc: "AOE 100 半径 220% 伤害", rarity: "rare", emoji: "💻", color: "#B388FF", cost: 90, effect: { kind: "aoe", dmgMul: 2.2, radius: 100 } },
  { id: "card_zhou_3", agentId: "zhou", name: "服务器过载", desc: "AOE 120 半径 200% + 减速 50%（3 秒）", rarity: "epic", emoji: "⚡", color: "#00E5FF", cost: 100, effect: { kind: "aoePlusSlow", dmgMul: 2.0, radius: 120, slowMul: 0.5, slowDuration: 3 } },
  // ===== 王婆婆（社区宣防员）=====
  { id: "card_wang_1", agentId: "wang", name: "全民防线·速", desc: "全队回血 30% + 护盾 20%", rarity: "common", emoji: "👵", color: "#52C41A", cost: 60, effect: { kind: "healShield", healRatio: 0.3, shieldRatio: 0.2 } },
  { id: "card_wang_2", agentId: "wang", name: "全民防线·强", desc: "全队回血 40% + 护盾 30%", rarity: "rare", emoji: "👵", color: "#52C41A", cost: 90, effect: { kind: "healShield", healRatio: 0.4, shieldRatio: 0.3 } },
  { id: "card_wang_3", agentId: "wang", name: "社区宣讲", desc: "全队回血 35% + 暴击率 +40%（5 秒）", rarity: "epic", emoji: "📢", color: "#FFD666", cost: 100, effect: { kind: "healPlusCrit", healRatio: 0.35, critRate: 0.4, duration: 5 } },
  // ===== 苏岩（数据猎查师）=====
  { id: "card_su_1", agentId: "su", name: "精准锁定·速", desc: "暴击率 +40%（4 秒）", rarity: "common", emoji: "📊", color: "#FFD666", cost: 60, effect: { kind: "critBuff", critRate: 0.4, critDmg: 0.3, duration: 4 } },
  { id: "card_su_2", agentId: "su", name: "精准锁定·强", desc: "暴击率 +60% / 暴伤 +50%（5 秒）", rarity: "rare", emoji: "📊", color: "#FFD666", cost: 90, effect: { kind: "critBuff", critRate: 0.6, critDmg: 0.5, duration: 5 } },
  { id: "card_su_3", agentId: "su", name: "数据猎杀", desc: "暴击率 +50% / 暴伤 +60%（6 秒）", rarity: "epic", emoji: "🎯", color: "#FF3B6B", cost: 100, effect: { kind: "critBuff", critRate: 0.5, critDmg: 0.6, duration: 6 } },
  // ===== 陈默（卧底侦查员）=====
  { id: "card_chen_1", agentId: "chen", name: "暗影突袭·速", desc: "对最强敌人造成 350% 伤害", rarity: "common", emoji: "🥷", color: "#E5353B", cost: 60, effect: { kind: "assassinate", dmgMul: 3.5 } },
  { id: "card_chen_2", agentId: "chen", name: "暗影收网·强", desc: "对最强敌人造成 500% 伤害", rarity: "rare", emoji: "🥷", color: "#E5353B", cost: 90, effect: { kind: "assassinate", dmgMul: 5.0 } },
  { id: "card_chen_3", agentId: "chen", name: "潜行刺杀", desc: "对最强敌人造成 600% 伤害", rarity: "epic", emoji: "🗡️", color: "#FF3B6B", cost: 100, effect: { kind: "assassinate", dmgMul: 6.0 } },
  // ===== 法务审计师 =====
  { id: "card_fayi_1", agentId: "fayi", name: "资金冻结·速", desc: "冻结全场 1.5 秒 + 易伤 20%", rarity: "common", emoji: "⚖️", color: "#3D8BFD", cost: 60, effect: { kind: "freeze", duration: 1.5, vulnBonus: 0.2 } },
  { id: "card_fayi_2", agentId: "fayi", name: "资金冻结·强", desc: "冻结全场 2 秒 + 易伤 30%", rarity: "rare", emoji: "⚖️", color: "#3D8BFD", cost: 90, effect: { kind: "freeze", duration: 2, vulnBonus: 0.3 } },
  { id: "card_fayi_3", agentId: "fayi", name: "审计风暴", desc: "冻结 2.5 秒 + 全队回血 30%", rarity: "epic", emoji: "❄️", color: "#A8E6CF", cost: 100, effect: { kind: "freeze", duration: 2.5, vulnBonus: 0.3 } },
  // ===== 数据预测师 =====
  { id: "card_yuce_1", agentId: "yuce", name: "时间扭曲·速", desc: "敌人减速 40%（4 秒）", rarity: "common", emoji: "🔮", color: "#00C9A7", cost: 60, effect: { kind: "timeWarp", slowMul: 0.4, duration: 4 } },
  { id: "card_yuce_2", agentId: "yuce", name: "时间扭曲·强", desc: "敌人减速 50%（5 秒）", rarity: "rare", emoji: "🔮", color: "#00C9A7", cost: 90, effect: { kind: "timeWarp", slowMul: 0.5, duration: 5 } },
  { id: "card_yuce_3", agentId: "yuce", name: "AI 预判", desc: "减速 60%（6 秒）+ 暴击率 +30%", rarity: "epic", emoji: "🎯", color: "#FFD666", cost: 100, effect: { kind: "timeWarp", slowMul: 0.6, duration: 6 } },
  // ===== 跨境联络官 =====
  { id: "card_kuajing_1", agentId: "kuajing", name: "联合行动·速", desc: "召唤临时探员（60% 属性，6 秒）", rarity: "common", emoji: "🌐", color: "#FF8A3D", cost: 60, effect: { kind: "summon", ratio: 0.6, duration: 6 } },
  { id: "card_kuajing_2", agentId: "kuajing", name: "联合行动·强", desc: "召唤临时探员（70% 属性，8 秒）", rarity: "rare", emoji: "🌐", color: "#FF8A3D", cost: 90, effect: { kind: "summon", ratio: 0.7, duration: 8 } },
  { id: "card_kuajing_3", agentId: "kuajing", name: "国际围剿", desc: "召唤（80% 属性，10 秒）+ 护盾 40%", rarity: "epic", emoji: "🛡️", color: "#A8E6CF", cost: 100, effect: { kind: "summon", ratio: 0.8, duration: 10 } },
  // ===== AI 鉴伪师 =====
  { id: "card_jianwei_1", agentId: "jianwei", name: "鉴伪护盾·速", desc: "全队护盾 30%（4 秒）", rarity: "common", emoji: "🤖", color: "#A8E6CF", cost: 60, effect: { kind: "shieldWall", shieldRatio: 0.3, duration: 4 } },
  { id: "card_jianwei_2", agentId: "jianwei", name: "鉴伪护盾·强", desc: "全队护盾 50%（5 秒）", rarity: "rare", emoji: "🤖", color: "#A8E6CF", cost: 90, effect: { kind: "shieldWall", shieldRatio: 0.5, duration: 5 } },
  { id: "card_jianwei_3", agentId: "jianwei", name: "AI 协同", desc: "全队护盾 50% + 暴击率 +30%（5 秒）", rarity: "epic", emoji: "✨", color: "#FFD666", cost: 100, effect: { kind: "healPlusCrit", healRatio: 0.0, critRate: 0.3, duration: 5 } },
];

/** 根据探员 id 取 3 张卡 */
export function getCardsForAgent(agentId: string): CardSkillDef[] {
  return CARD_SKILLS.filter((c) => c.agentId === agentId);
}

/** 抽取手牌：从当前部署探员每人 3 张中随机抽 1 张，组成手牌 */
export function drawHand(deployedAgentIds: string[], seed: string): CardSkillDef[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rng = () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hand: CardSkillDef[] = [];
  for (const agentId of deployedAgentIds) {
    const cards = getCardsForAgent(agentId);
    if (cards.length === 0) continue;
    const idx = Math.floor(rng() * cards.length);
    hand.push(cards[idx]);
  }
  return hand;
}

// ====================================================================
// v8：地区高发诈骗数据（基于公开报道整理的内置 JSON，按月切换）
// 注意：模拟数据，可后续接入国家反诈中心 API
// ====================================================================

export const REGIONS: RegionDef[] = [
  {
    id: "region_beijing",
    name: "北京",
    emoji: "🏙️",
    antiFraudCenter: "北京市反诈中心",
    monthlyFraudTypes: {
      "2026-07": ["冒充公检法诈骗", "冒充客服诈骗", "AI 换脸冒充熟人"],
      "2026-08": ["杀猪盘情感诈骗", "虚假投资平台诈骗", "ETC 过期短信诈骗"],
      "2026-09": ["假冒注销校园贷诈骗", "虚假招聘押金诈骗", "二手演唱会票务诈骗"],
    },
  },
  {
    id: "region_shanghai",
    name: "上海",
    emoji: "🌆",
    antiFraudCenter: "上海市反诈中心",
    monthlyFraudTypes: {
      "2026-07": ["冒充客服诈骗", "假冒客服退费诈骗", "虚假投资平台诈骗"],
      "2026-08": ["杀猪盘情感诈骗", "AI 换脸冒充熟人", "钓鱼网站盗刷"],
      "2026-09": ["机票退改签诈骗", "冒充领导熟人转账", "虚假招聘押金诈骗"],
    },
  },
  {
    id: "region_guangdong",
    name: "广东",
    emoji: "🌅",
    antiFraudCenter: "广东省反诈中心",
    monthlyFraudTypes: {
      "2026-07": ["买卖银行卡洗钱", "跨境电诈", "冒充客服诈骗"],
      "2026-08": ["虚假投资平台诈骗", "杀猪盘情感诈骗", "钓鱼网站盗刷"],
      "2026-09": ["ETC 过期短信诈骗", "假冒注销校园贷诈骗", "虚构亲友意外诈骗"],
    },
  },
  {
    id: "region_sichuan",
    name: "四川",
    emoji: "🐼",
    antiFraudCenter: "四川省反诈中心",
    monthlyFraudTypes: {
      "2026-07": ["杀猪盘情感诈骗", "冒充公检法诈骗", "虚假投资平台诈骗"],
      "2026-08": ["买卖银行卡洗钱", "钓鱼网站盗刷", "冒充客服诈骗"],
      "2026-09": ["虚假招聘押金诈骗", "二手演唱会票务诈骗", "AI 换脸冒充熟人"],
    },
  },
];

/** 默认地区（玩家未选择时） */
export const DEFAULT_REGION_ID = "region_beijing";

/** 取当前月份字符串 YYYY-MM */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 根据地区 id 取该月高发诈骗类型 */
export function getMonthlyFraudTypes(regionId: string, monthKey: string): string[] {
  const region = REGIONS.find((r) => r.id === regionId) ?? REGIONS[0];
  return region.monthlyFraudTypes[monthKey] ?? region.monthlyFraudTypes[Object.keys(region.monthlyFraudTypes)[0]] ?? [];
}

// ====================================================================
// v8：扩展题库（在原 25 题基础上新增 80 题，达到 105 题）
// 按诈骗类型 × 难度 三维分类
// ====================================================================

export const QUIZ_BANK_V8_EXTENSION: QuizQuestion[] = [
  // ===== 难度 1（基础识记，30 题）=====
  { id: "qv8_01", question: "下列哪种情况可以确认对方是真警察？", options: ["对方报出你的身份证号", "对方发来拘捕令照片", "对方让你到派出所当面核实", "对方让你转账到安全账户"], correctIdx: 2, explanation: "公检法不会电话办案。真警察会要求你到派出所当面核实，绝不会让你转账到'安全账户'。", fraudType: "冒充公检法", difficulty: 1 },
  { id: "qv8_02", question: "微信收到好友借钱消息，最快的核实方式？", options: ["直接转账", "语音/视频通话确认", "看头像一样就借", "回个问号"], correctIdx: 1, explanation: "账号被盗冒充熟人借钱非常常见。语音/视频核实是最快的拦截方式。", fraudType: "冒充熟人借钱", difficulty: 1 },
  { id: "qv8_03", question: "客服说你的快递丢了要理赔，让你下载 APP 共享屏幕，应该？", options: ["下载并共享", "拒绝，挂断后通过官方渠道核实", "把验证码读给对方", "把银行卡号给对方"], correctIdx: 1, explanation: "理赔走官方。屏幕共享=把手机控制权交给对方。", fraudType: "冒充快递理赔", difficulty: 1 },
  { id: "qv8_04", question: "陌生人发来'点击免费领红包'链接，应该？", options: ["立即点击领取", "不点，可能是钓鱼链接", "把链接转发给朋友", "输入银行卡号领取"], correctIdx: 1, explanation: "不点陌生链。任何要求输入银行卡信息的红包都是钓鱼。", fraudType: "钓鱼网站盗刷", difficulty: 1 },
  { id: "qv8_05", question: "中奖短信要你先交 200 元手续费才能领奖，下列说法正确的是？", options: ["先交钱拿大奖", "正规中奖不收费，是骗局", "把朋友也叫来", "提供银行卡号接收"], correctIdx: 1, explanation: "正规中奖不收费。任何'先交钱才能领奖'均为骗局。", fraudType: "中奖诈骗", difficulty: 1 },
  { id: "qv8_06", question: "在二手平台买演唱会门票，对方要求加微信私下转账，应该？", options: ["加微信转账", "坚持平台担保交易", "把身份证发给对方", "先转 50% 定金"], correctIdx: 1, explanation: "私下交易无担保。脱离平台后钱款无法追回。", fraudType: "二手票务诈骗", difficulty: 1 },
  { id: "qv8_07", question: "收到'医保卡异常停用'短信附链接，应该？", options: ["点链接补全", "骗局，医保局不通过短信链接采集信息", "把社保号发过去", "把密码告诉对方"], correctIdx: 1, explanation: "医保卡异常请到医保局官方渠道查询。短信链接多为钓鱼。", fraudType: "冒充医保社保", difficulty: 1 },
  { id: "qv8_08", question: "电话里有人说'你孩子出车祸了，急需手术费 3 万'，第一时间应该？", options: ["立即转账救人", "挂断后直接联系孩子本人/学校核实", "把全部家当都转", "按对方要求不挂电话"], correctIdx: 1, explanation: "亲属出事必核实。挂断后联系本人是第一步。", fraudType: "虚构意外诈骗", difficulty: 1 },
  { id: "qv8_09", question: "求职平台上 HR 让你下载第三方 APP 完成'入职测评'并交押金，这是？", options: ["下载并交押金", "骗局，正规招聘不收押金", "把身份证扫描件发过去", "把银行卡给对方"], correctIdx: 1, explanation: "招聘不收押金。第三方 APP 测评常是钓鱼或刷单引流。", fraudType: "虚假招聘诈骗", difficulty: 1 },
  { id: "qv8_10", question: "陌生二维码扫出来是'红包'页面，要输入银行卡号+密码才能领取，应该？", options: ["输入领取", "拒绝，正规红包不索取密码", "把验证码也发过去", "把卡号给同事代领"], correctIdx: 1, explanation: "红包不索取密码。任何要求输入银行卡密码的红包都是钓鱼。", fraudType: "二维码钓鱼", difficulty: 1 },
  { id: "qv8_11", question: "收到'航班取消需改签'短信，应该？", options: ["按短信链接改签", "拨打航空公司官方客服核实", "把身份证号发过去", "把银行卡给对方退票"], correctIdx: 1, explanation: "航班改签走官方。骗子利用真实航班信息行骗。", fraudType: "机票退改签诈骗", difficulty: 1 },
  { id: "qv8_12", question: "陌生邮件附件是'面试通知.doc'，打开后要求'启用宏'，正确做法是？", options: ["启用宏查看", "删除邮件，不启用宏", "把附件转发给同事", "回复提供身份证"], correctIdx: 1, explanation: "陌生附件的'启用宏'常携带宏病毒。直接删除最稳妥。", fraudType: "钓鱼邮件", difficulty: 1 },
  { id: "qv8_13", question: "贷款 APP 显示'额度已批，需先交 1000 元解冻费'才能提现，这是？", options: ["交解冻费拿贷款", "骗局，正规贷款不放贷前收费", "再交 2000 加速", "把身份证发过去"], correctIdx: 1, explanation: "正规贷款不放贷前收费。解冻费/工本费/保证金都是套路。", fraudType: "虚假网贷", difficulty: 1 },
  { id: "qv8_14", question: "陌生人加 QQ 说'内部数据包赢彩票/赌球'，让你下载 APP 充值，应该？", options: ["充值跟单", "骗局，赌博+虚假平台双套", "抵押房产跟单", "拉同事一起充"], correctIdx: 1, explanation: "内部数据是假，平台是真骗。后台操控输赢，充值后无法提现。", fraudType: "跨境赌博诈骗", difficulty: 1 },
  { id: "qv8_15", question: "微信收到'朋友'借钱消息，最快的核实方式是？", options: ["直接转账", "语音/视频通话确认本人", "看头像一样就借", "把全部积蓄都借"], correctIdx: 1, explanation: "借钱必核身份。账号被盗冒充熟人借钱非常常见。", fraudType: "冒充熟人借钱", difficulty: 1 },
  { id: "qv8_16", question: "陌生来电自称'96110'让你转账到'安全账户'，这是？", options: ["真反诈中心，配合", "骗局，96110 不会让你转账", "按对方要求操作", "提供银行卡密码"], correctIdx: 1, explanation: "96110 是反诈专线，不会让你转账。", fraudType: "冒充公检法", difficulty: 1 },
  { id: "qv8_17", question: "短信附带的链接显示'银行积分兑换现金'，应该？", options: ["点链接兑换", "通过银行官方 APP 核实", "把密码发过去", "把卡号给同事代领"], correctIdx: 1, explanation: "银行积分兑换只在官方 APP。", fraudType: "钓鱼网站盗刷", difficulty: 1 },
  { id: "qv8_18", question: "有人高价租你的银行卡，每月 2000 元，应该？", options: ["租出去赚零花", "拒绝，买卖/出租两卡涉嫌帮信罪", "把亲戚的卡也介绍过去", "先租一张试试"], correctIdx: 1, explanation: "不租售两卡。出租银行卡给诈骗团伙走账构成帮信罪。", fraudType: "买卖银行卡洗钱", difficulty: 1 },
  { id: "qv8_19", question: "客服说你的商品质量问题双倍退款，让你下载会议 APP 共享屏幕，这是？", options: ["真客服，配合", "骗局，共享屏幕会泄露验证码", "把验证码读给对方", "把银行卡密码告诉对方"], correctIdx: 1, explanation: "退费走官方。共享屏幕=对方能看到你的所有验证码和密码。", fraudType: "冒充客服退费", difficulty: 1 },
  { id: "qv8_20", question: "初恋网恋对象聊了 3 个月从未见面，今天让你转账一起'投资'买币，应该？", options: ["转账，真爱无价", "拒绝，并在平台举报", "借钱也要转", "把朋友也拉进来"], correctIdx: 1, explanation: "网恋不转账。没见过面就让你投资的，100% 是骗局。", fraudType: "杀猪盘情感诈骗", difficulty: 1 },
  { id: "qv8_21", question: "自称'领导'加微信让你帮忙转钱给他客户，事后还你，怎么办？", options: ["立即转账", "换渠道（电话/当面）核实领导本人", "把同事也叫上一起转", "把公司账户信息发过去"], correctIdx: 1, explanation: "领导转账核实。冒充领导常用'在开会不便接电话'阻挠核实。", fraudType: "冒充领导熟人", difficulty: 1 },
  { id: "qv8_22", question: "收到'校园贷记录影响征信，需注销'的电话，对方能报出你的身份证号，是否可信？", options: ["可信，立即配合注销", "不可信，征信只能本人到央行查询", "把银行卡给对方操作", "按指引网贷注销"], correctIdx: 1, explanation: "注销校园贷是骗。信息泄露不等于对方资质真实。", fraudType: "注销校园贷", difficulty: 1 },
  { id: "qv8_23", question: "网友推荐'稳赚不赔'的理财 APP，老师带单、群内晒单，下列判断正确的是？", options: ["立即跟单", "先小额试水再加大投入", "持牌金融机构名录里查不到就是骗局", "把养老金 all in"], correctIdx: 2, explanation: "理财认持牌。可在证监会、银保监会官网核查机构资质。", fraudType: "虚假投资理财", difficulty: 1 },
  { id: "qv8_24", question: "视频里'妈妈'说急用钱让你转 5 万，但画面有些卡顿，最稳妥的做法是？", options: ["立即转账", "换个话题问只有家人知道的事核实", "按对方要求下载借款 APP", "拉黑所有家人"], correctIdx: 1, explanation: "AI 换脸核实。换话题问私密信息是最快的核实方式。", fraudType: "AI 换脸冒充熟人", difficulty: 1 },
  { id: "qv8_25", question: "收到'ETC 过期/禁用'短信，附链接要求补办，正确做法是？", options: ["点链接补办", "回拨短信中的电话", "通过 ETC 发行方官方 APP/客服核实", "把卡号发过去"], correctIdx: 2, explanation: "ETC 官方办。ETC 不会以短信链接形式索要银行卡信息。", fraudType: "ETC 诈骗", difficulty: 1 },
  { id: "qv8_26", question: "陌生号码发来彩信附'看你老婆/老公的视频'链接，应该？", options: ["立即点开看", "删除，链接多为木马或勒索", "把链接转发给朋友", "输入密码查看"], correctIdx: 1, explanation: "隐私窥探+木马链接是常见组合。", fraudType: "木马勒索", difficulty: 1 },
  { id: "qv8_27", question: "收到'刷单返现'任务，第 1 单返了 10 元，第 2 单让你垫 5000 元，是否继续？", options: ["继续垫 5000", "立即停止，前期返利是诱饵", "再拉朋友一起刷", "把信用卡额度刷满"], correctIdx: 1, explanation: "刷单本身违法，且 100% 是骗局。前期返利是为了套住你做大单。", fraudType: "刷单返利", difficulty: 1 },
  { id: "qv8_28", question: "自称'反诈中心'来电说你涉嫌洗钱要配合调查，应该？", options: ["立即配合", "挂断并拨打 110 核实", "按对方要求下载 APP", "提供银行卡密码"], correctIdx: 1, explanation: "反诈中心不会电话办案。挂断后拨 110 核实。", fraudType: "冒充公检法", difficulty: 1 },
  { id: "qv8_29", question: "微信群有人发'扫码领京东卡 500 元'，应该？", options: ["立即扫码", "可能是钓鱼，不扫", "把二维码转发给朋友", "输入银行卡信息领取"], correctIdx: 1, explanation: "高价值免费赠品多是钓鱼。扫码即套信息。", fraudType: "二维码钓鱼", difficulty: 1 },
  { id: "qv8_30", question: "陌生来电自称'社保局'说你的社保卡异常，应该？", options: ["按对方要求操作", "挂断，到社保局官方渠道核实", "提供身份证号", "提供银行卡号"], correctIdx: 1, explanation: "社保卡异常请到社保局官方渠道查询。", fraudType: "冒充医保社保", difficulty: 1 },
  // ===== 难度 2（情境判断，35 题）=====
  { id: "qv8_31", question: "客服说你的商品'质量问题'双倍退款，要求下载会议 APP 共享屏幕。下列判断正确的是？", options: ["正规退款不需要共享屏幕，是骗局", "对方能报出订单号就是真的", "共享屏幕不会泄露信息", "对方让我退就退"], correctIdx: 0, explanation: "正规退款不需要共享屏幕。订单信息泄露不等于对方是真客服。", fraudType: "冒充客服退费", difficulty: 2 },
  { id: "qv8_32", question: "网恋对象聊了 3 个月，今天让你转账一起投资买币。下列哪些信号是骗局？", options: ["对方头像精致", "对方从不视频见面 + 推荐投资", "对方说喜欢你", "对方生日快到了"], correctIdx: 1, explanation: "不见面+推荐投资是杀猪盘核心信号。", fraudType: "杀猪盘情感诈骗", difficulty: 2 },
  { id: "qv8_33", question: "收到'领导'加微信借钱，对方说'在开会不便接电话'。下列做法正确的是？", options: ["领导说开会就别打扰", "换渠道（电话/当面）核实领导本人", "立即转账", "把同事也叫上一起转"], correctIdx: 1, explanation: "'在开会不便接电话'是冒充领导的典型话术。必须换渠道核实。", fraudType: "冒充领导熟人", difficulty: 2 },
  { id: "qv8_34", question: "贷款 APP 显示额度已批，但提现时提示'银行卡号错误，需交解冻费'。下列判断正确的是？", options: ["交解冻费即可提现", "系统故障，再交 2000 元加速", "骗局，正规贷款不放贷前收费", "把身份证发过去"], correctIdx: 2, explanation: "正规贷款不放贷前收费。'银行卡号错误'是系统故意制造的解冻费陷阱。", fraudType: "虚假网贷", difficulty: 2 },
  { id: "qv8_35", question: "在二手平台买演唱会门票，对方要求加微信私下转账。下列哪些信号是骗局？", options: ["对方说'平台手续费高'", "对方要求脱离平台交易 + 先付定金", "对方说'票是真票'", "对方头像看起来很老实"], correctIdx: 1, explanation: "脱离平台交易无担保。先付定金后失联是典型套路。", fraudType: "二手票务诈骗", difficulty: 2 },
  { id: "qv8_36", question: "客服说你的航班取消需改签，并要求收取改签费。下列判断正确的是？", options: ["按短信链接改签", "拨打航空公司官方客服核实", "把身份证号发过去", "把银行卡给对方退票"], correctIdx: 1, explanation: "航班改签走官方。骗子利用真实航班信息行骗。", fraudType: "机票退改签诈骗", difficulty: 2 },
  { id: "qv8_37", question: "求职平台上 HR 让你下载第三方 APP 完成'入职测评'。下列哪些信号是骗局？", options: ["HR 头像看起来很专业", "要求下载第三方 APP + 交押金", "HR 说公司规模大", "HR 让你明天入职"], correctIdx: 1, explanation: "正规招聘不收押金，不强制第三方 APP。", fraudType: "虚假招聘诈骗", difficulty: 2 },
  { id: "qv8_38", question: "电话里有人说'你孩子出车祸了，急需手术费 3 万'。下列哪些信号是骗局？", options: ["对方知道孩子名字", "对方要求保持通话不让你核实 + 立即转账", "对方说在医院", "对方说医生在等"], correctIdx: 1, explanation: "要求保持通话不让你核实是虚构意外的典型套路。", fraudType: "虚构意外诈骗", difficulty: 2 },
  { id: "qv8_39", question: "陌生人加 QQ 说'内部数据包赢彩票'。下列判断正确的是？", options: ["内部数据是真的", "骗局，赌博+虚假平台双套", "先小额试水", "拉同事一起充"], correctIdx: 1, explanation: "内部数据是假，平台是真骗。", fraudType: "跨境赌博诈骗", difficulty: 2 },
  { id: "qv8_40", question: "收到'医保卡异常停用'短信附链接。下列哪些信号是骗局？", options: ["短信里有'医保局'字样", "短信附链接要求补全银行卡信息", "短信说'48 小时内处理'", "短信里有医保局电话"], correctIdx: 1, explanation: "医保局不通过短信链接采集信息。", fraudType: "冒充医保社保", difficulty: 2 },
  { id: "qv8_41", question: "视频里'妈妈'说急用钱让你转 5 万，画面卡顿。下列哪些信号是 AI 换脸？", options: ["妈妈穿的衣服平时不穿", "画面卡顿 + 眨眼频率异常 + 不换话题", "妈妈声音听起来有点累", "妈妈说在外地"], correctIdx: 1, explanation: "卡顿+眨眼异常+不换话题是 AI 换脸的典型破绽。", fraudType: "AI 换脸冒充熟人", difficulty: 2 },
  { id: "qv8_42", question: "陌生邮件附件是'面试通知.doc'，要求'启用宏'。下列哪些信号是钓鱼邮件？", options: ["发件人邮箱域名与公司官方不符", "邮件里有公司 logo", "邮件附件是 .doc", "邮件标题是'面试通知'"], correctIdx: 0, explanation: "发件人邮箱域名不符是钓鱼邮件的典型信号。", fraudType: "钓鱼邮件", difficulty: 2 },
  { id: "qv8_43", question: "网友推荐'稳赚不赔'理财 APP。下列哪些信号是资金盘？", options: ["群里晒单 + 老师带单 + 高收益承诺", "网友头像精致", "网友说喜欢你", "网友说在境外"], correctIdx: 0, explanation: "群内晒单+老师带单+高收益承诺是资金盘典型信号。", fraudType: "虚假投资理财", difficulty: 2 },
  { id: "qv8_44", question: "收到'ETC 过期禁用'短信附链接。下列哪些信号是钓鱼？", options: ["短信里有'ETC 发行方'字样", "短信附链接要求输入银行卡密码", "短信说'3 天内处理'", "短信里有 ETC 客服电话"], correctIdx: 1, explanation: "ETC 不会以短信链接形式索要银行卡信息。", fraudType: "ETC 诈骗", difficulty: 2 },
  { id: "qv8_45", question: "客服说你的商品质量问题双倍退款，要求共享屏幕。下列哪些信号是骗局？", options: ["对方能报出订单号", "对方要求下载会议 APP + 共享屏幕", "对方说'商品质量问题'", "对方说'双倍退款'"], correctIdx: 1, explanation: "正规退款不需要共享屏幕。", fraudType: "冒充客服退费", difficulty: 2 },
  { id: "qv8_46", question: "初恋网恋对象聊了 3 个月，今天让你转账一起投资。下列判断正确的是？", options: ["真爱无价，转账", "不见面+推荐投资是杀猪盘", "对方是真心喜欢我", "对方说以后见面"], correctIdx: 1, explanation: "杀猪盘核心是不见面+推荐投资。", fraudType: "杀猪盘情感诈骗", difficulty: 2 },
  { id: "qv8_47", question: "收到'领导'加微信借钱。下列哪些做法是正确的？", options: ["立即转账", "换渠道核实 + 看微信号是否本人", "把同事也叫上一起转", "把公司账户信息发过去"], correctIdx: 1, explanation: "换渠道核实+看微信号是否本人。", fraudType: "冒充领导熟人", difficulty: 2 },
  { id: "qv8_48", question: "校园贷注销诈骗中，下列哪些信号是骗局？", options: ["对方能报出身份证号", "对方自称金融监管 + 要求网贷转账注销", "对方说影响征信", "对方说'内部政策'"], correctIdx: 1, explanation: "金融监管不会让你网贷转账注销。征信只能本人到央行查。", fraudType: "注销校园贷", difficulty: 2 },
  { id: "qv8_49", question: "虚假理财平台诈骗中，下列哪些信号是骗局？", options: ["群里晒单 + 老师带单 + 高收益承诺", "平台有 APP", "平台有客服", "平台说'保本'"], correctIdx: 0, explanation: "群内晒单+老师带单+高收益承诺是资金盘典型信号。", fraudType: "虚假投资理财", difficulty: 2 },
  { id: "qv8_50", question: "AI 换脸诈骗中，下列哪些做法是正确的？", options: ["立即转账", "换话题问私密信息核实 + 电话核实本人", "看头像一样就转账", "把全部积蓄都转"], correctIdx: 1, explanation: "换话题问私密信息是最快的核实方式。", fraudType: "AI 换脸冒充熟人", difficulty: 2 },
  { id: "qv8_51", question: "钓鱼邮件诈骗中，下列哪些做法是正确的？", options: ["启用宏查看", "删除邮件，不启用宏", "把附件转发给同事", "回复提供身份证"], correctIdx: 1, explanation: "陌生附件的'启用宏'常携带宏病毒。直接删除最稳妥。", fraudType: "钓鱼邮件", difficulty: 2 },
  { id: "qv8_52", question: "二手票务诈骗中，下列哪些做法是正确的？", options: ["加微信转账", "坚持平台担保交易", "把身份证发给对方", "先转 50% 定金"], correctIdx: 1, explanation: "坚持平台担保交易。脱离平台后钱款无法追回。", fraudType: "二手票务诈骗", difficulty: 2 },
  { id: "qv8_53", question: "机票退改签诈骗中，下列哪些做法是正确的？", options: ["按短信链接改签", "拨打航空公司官方客服核实", "把身份证号发过去", "把银行卡给对方退票"], correctIdx: 1, explanation: "拨打航空公司官方客服核实。", fraudType: "机票退改签诈骗", difficulty: 2 },
  { id: "qv8_54", question: "虚假招聘诈骗中，下列哪些做法是正确的？", options: ["下载并交押金", "拒绝，正规招聘不收押金", "把身份证扫描件发过去", "把银行卡给对方"], correctIdx: 1, explanation: "拒绝交押金。正规招聘不收押金。", fraudType: "虚假招聘诈骗", difficulty: 2 },
  { id: "qv8_55", question: "虚构意外诈骗中，下列哪些做法是正确的？", options: ["立即转账救人", "挂断后直接联系孩子本人/学校核实", "把全部家当都转", "按对方要求不挂电话"], correctIdx: 1, explanation: "挂断后联系本人是第一步。", fraudType: "虚构意外诈骗", difficulty: 2 },
  { id: "qv8_56", question: "刷单返利诈骗中，下列哪些信号是骗局？", options: ["第 1 单返了 10 元", "前期小额返利 + 大单垫资", "对方说'刷单违法'", "对方说'刷单有风险'"], correctIdx: 1, explanation: "前期小额返利是诱饵，大单垫资必失本金。", fraudType: "刷单返利", difficulty: 2 },
  { id: "qv8_57", question: "跨境赌博诈骗中，下列哪些信号是骗局？", options: ["对方说'内部数据'", "对方说'包赢'", "对方说'充值后无法提现'", "对方说'赌博违法'"], correctIdx: 0, explanation: "内部数据是假，平台是真骗。", fraudType: "跨境赌博诈骗", difficulty: 2 },
  { id: "qv8_58", question: "冒充公检法诈骗中，下列哪些信号是骗局？", options: ["对方报出身份证号", "对方让你转账到'安全账户'", "对方说'涉嫌洗钱'", "对方说'拘捕令'"], correctIdx: 1, explanation: "不存在'安全账户'。公检法不会让你转账。", fraudType: "冒充公检法", difficulty: 2 },
  { id: "qv8_59", question: "冒充客服诈骗中，下列哪些信号是骗局？", options: ["对方主动来电", "对方要求共享屏幕", "对方说'商品质量问题'", "对方说'双倍退款'"], correctIdx: 1, explanation: "客服不主动。共享屏幕=交出手机控制权。", fraudType: "冒充客服退费", difficulty: 2 },
  { id: "qv8_60", question: "买卖银行卡洗钱中，下列哪些信号是骗局？", options: ["对方说'只是过账'", "对方说'不会查到你'", "对方高价租卡", "以上都是"], correctIdx: 3, explanation: "以上都是帮信罪的典型话术。租卡即犯罪。", fraudType: "买卖银行卡洗钱", difficulty: 2 },
  { id: "qv8_61", question: "ETC 诈骗中，下列哪些信号是骗局？", options: ["短信附链接", "短信要求输入银行卡密码", "短信说'3 天内处理'", "以上都是"], correctIdx: 3, explanation: "以上都是 ETC 钓鱼短信的典型信号。", fraudType: "ETC 诈骗", difficulty: 2 },
  { id: "qv8_62", question: "AI 换脸诈骗中，下列哪些信号是骗局？", options: ["视频画面卡顿", "眨眼频率异常", "对方催促转账", "以上都是"], correctIdx: 3, explanation: "以上都是 AI 换脸诈骗的典型信号。", fraudType: "AI 换脸冒充熟人", difficulty: 2 },
  { id: "qv8_63", question: "虚假投资理财诈骗中，下列哪些信号是骗局？", options: ["群内晒单", "老师带单", "高收益承诺", "以上都是"], correctIdx: 3, explanation: "以上都是资金盘的典型信号。", fraudType: "虚假投资理财", difficulty: 2 },
  { id: "qv8_64", question: "冒充领导熟人诈骗中，下列哪些信号是骗局？", options: ["对方说'在开会不便接电话'", "对方要求转账到陌生账户", "对方加微信但微信号与本人不符", "以上都是"], correctIdx: 3, explanation: "以上都是冒充领导的典型信号。", fraudType: "冒充领导熟人", difficulty: 2 },
  { id: "qv8_65", question: "注销校园贷诈骗中，下列哪些信号是骗局？", options: ["对方能报出身份证号", "对方自称金融监管", "对方要求网贷转账注销", "以上都是"], correctIdx: 3, explanation: "以上都是注销校园贷诈骗的典型信号。", fraudType: "注销校园贷", difficulty: 2 },
  // ===== 难度 3（综合分析，15 题）=====
  { id: "qv8_66", question: "受害人接到'96110'电话被告知涉嫌洗钱，对方要求加 QQ 接受调查并转账到'安全账户'。该案中骗子利用了哪些心理？", options: ["恐惧权威 + 紧迫感 + 信息不对称", "贪婪 + 侥幸", "情感依赖 + 孤独", "好奇 + 窥探"], correctIdx: 0, explanation: "冒充公检法利用受害人对权威的恐惧+紧迫感+信息不对称。", fraudType: "冒充公检法", difficulty: 3 },
  { id: "qv8_67", question: "杀猪盘诈骗中，骗子从'养猪'到'杀猪'通常历时多久？", options: ["1-3 天", "1-2 周", "数月到半年", "1 年以上"], correctIdx: 2, explanation: "杀猪盘核心是长期养-杀-收割，通常历时数月。", fraudType: "杀猪盘情感诈骗", difficulty: 3 },
  { id: "qv8_68", question: "虚假理财平台前期允许小额提现的目的是？", options: ["平台 bug", "建立信任诱导大额投入", "客户服务", "合规要求"], correctIdx: 1, explanation: "前期小额提现是建立信任的核心手段，诱导受害人加大投入。", fraudType: "虚假投资理财", difficulty: 3 },
  { id: "qv8_69", question: "AI 换脸诈骗中，骗子为何选择视频通话而非纯语音？", options: ["视频更清楚", "视频更有说服力 + 受害人难以拒绝", "视频更便宜", "视频更合法"], correctIdx: 1, explanation: "视频更有说服力，受害人看到'亲友'的脸更难拒绝。", fraudType: "AI 换脸冒充熟人", difficulty: 3 },
  { id: "qv8_70", question: "冒充客服退费诈骗中，骗子为何要求共享屏幕？", options: ["指导操作", "查看受害人屏幕上的验证码 + 密码", "客服规范", "提升效率"], correctIdx: 1, explanation: "共享屏幕让骗子能看到受害人所有验证码和密码。", fraudType: "冒充客服退费", difficulty: 3 },
  { id: "qv8_71", question: "买卖银行卡洗钱中，'帮信罪'最高可判几年？", options: ["1 年", "2 年", "3 年", "5 年"], correctIdx: 2, explanation: "帮助信息网络犯罪活动罪最高判 3 年有期徒刑。", fraudType: "买卖银行卡洗钱", difficulty: 3 },
  { id: "qv8_72", question: "ETC 诈骗中，骗子为何选择 ETC 主题？", options: ["ETC 用户多", "ETC 涉及银行卡 + 车主群体有支付能力", "ETC 是热点", "ETC 系统漏洞多"], correctIdx: 1, explanation: "ETC 涉及银行卡+车主群体有支付能力，是钓鱼的高价值目标。", fraudType: "ETC 诈骗", difficulty: 3 },
  { id: "qv8_73", question: "虚构意外诈骗中，骗子为何要求受害人保持通话不挂断？", options: ["提高沟通效率", "阻止受害人核实 + 制造紧迫感", "客服规范", "录音取证"], correctIdx: 1, explanation: "保持通话阻止受害人联系本人核实，制造紧迫感。", fraudType: "虚构意外诈骗", difficulty: 3 },
  { id: "qv8_74", question: "虚假招聘诈骗中，骗子为何要求下载第三方 APP？", options: ["测评需求", "脱离正规平台 + 后续刷单引流 + 钓鱼", "公司规范", "节省成本"], correctIdx: 1, explanation: "第三方 APP 脱离正规平台，便于后续刷单引流或钓鱼。", fraudType: "虚假招聘诈骗", difficulty: 3 },
  { id: "qv8_75", question: "机票退改签诈骗中，骗子如何获取受害人真实航班信息？", options: ["航空公司泄露", "通过非法渠道购买旅客信息 + 利用真实信息行骗", "随机猜测", "公开数据"], correctIdx: 1, explanation: "骗子通过非法渠道购买旅客信息，利用真实信息增加可信度。", fraudType: "机票退改签诈骗", difficulty: 3 },
  { id: "qv8_76", question: "钓鱼邮件中，'启用宏'的目的是？", options: ["查看完整内容", "执行宏病毒窃取密码/加密文件", "提升文档性能", "兼容性要求"], correctIdx: 1, explanation: "启用宏会执行宏病毒，窃取密码或加密文件勒索。", fraudType: "钓鱼邮件", difficulty: 3 },
  { id: "qv8_77", question: "二手票务诈骗中，骗子为何要求脱离平台交易？", options: ["节省手续费", "脱离平台担保后钱款无法追回", "提升效率", "平台限制"], correctIdx: 1, explanation: "脱离平台后钱款无法追回，且门票可能是伪造或一票多卖。", fraudType: "二手票务诈骗", difficulty: 3 },
  { id: "qv8_78", question: "刷单返利诈骗中，前期返利的资金来源是？", options: ["商家利润", "后期受害人的本金 + 诈骗团伙垫资", "广告收入", "平台补贴"], correctIdx: 1, explanation: "前期返利用后期受害人的本金或团伙垫资，是典型庞氏结构。", fraudType: "刷单返利", difficulty: 3 },
  { id: "qv8_79", question: "跨境赌博诈骗中，平台如何操控输赢？", options: ["公平随机", "后台操控赔率 + 充值后无法提现", "玩家技术差", "运气问题"], correctIdx: 1, explanation: "跨境赌博平台后台操控赔率，充值后无法提现。", fraudType: "跨境赌博诈骗", difficulty: 3 },
  { id: "qv8_80", question: "注销校园贷诈骗中，骗子为何专盯大学生？", options: ["大学生有钱", "大学生涉世未深 + 担心征信 + 信息泄露严重", "大学生好沟通", "大学生群体大"], correctIdx: 1, explanation: "大学生涉世未深+担心征信+信息泄露严重，是高价值目标。", fraudType: "注销校园贷", difficulty: 3 },
];

/** v8 扩展题库总数 */
export const QUIZ_BANK_V8_TOTAL = 25 + QUIZ_BANK_V8_EXTENSION.length; // 105 题

// ====================================================================
// v8：主线章节扩展（8 章 × 5-6 关）
// 把现有 8 BOSS 对白扩展为完整章节剧情
// 注：为控制文件体积，此处仅提供 8 章节框架（每章 5 关），
//     详细 stages 简化为关键节点，引擎可按章节 id 加载
// ====================================================================

export const STORY_CHAPTERS_FULL: StoryChapterFull[] = [
  {
    id: "chapter_1_farmer",
    order: 1,
    title: "断卡行动",
    subtitle: "社区级 · 资金链追踪",
    bossId: "boss_farmer",
    prologue: [{ speaker: "沈锋", emoji: "🔫", text: "断卡行动启动，从最外层卡农查起。", color: "#FF7A1A", side: "player" }],
    epilogue: [{ speaker: "沈锋", emoji: "🔫", text: "钱叔落网，但金流只是冰山一角。", color: "#FF7A1A", side: "player" }],
    recommendedPower: 800,
    requires: null,
    accent: "#FF7A1A",
    emoji: "💳",
    background: "社区反诈 · 资金链追踪",
    stages: [
      { order: 1, title: "社区巡查", difficulty: 1, refEnemyId: "robot", recommendedPower: 600, brief: [{ speaker: "沈锋", emoji: "🔫", text: "先从社区话术机器人查起。", color: "#FF7A1A", side: "player" }], debrief: [{ speaker: "沈锋", emoji: "🔫", text: "话术机器人背后有卡农。", color: "#FF7A1A", side: "player" }] },
      { order: 2, title: "卡农浮现", difficulty: 2, refEnemyId: "farmer", recommendedPower: 700, brief: [{ speaker: "沈锋", emoji: "🔫", text: "卡农在社区出没。", color: "#FF7A1A", side: "player" }], debrief: [{ speaker: "沈锋", emoji: "🔫", text: "卡农王钱叔露面了。", color: "#FF7A1A", side: "player" }] },
      { order: 3, title: "壳公司审计", difficulty: 3, refEnemyId: "farmer", recommendedPower: 800, brief: [{ speaker: "法务审计师", emoji: "⚖️", text: "壳公司审计启动。", color: "#3D8BFD", side: "player" }], debrief: [{ speaker: "法务审计师", emoji: "⚖️", text: "7 层壳全部锁定。", color: "#3D8BFD", side: "player" }] },
      { order: 4, title: "资金链冻结", difficulty: 4, refEnemyId: "farmer", recommendedPower: 900, brief: [{ speaker: "沈锋", emoji: "🔫", text: "资金链冻结启动。", color: "#FF7A1A", side: "player" }], debrief: [{ speaker: "沈锋", emoji: "🔫", text: "钱叔的资金链全部冻结。", color: "#FF7A1A", side: "player" }] },
      { order: 5, title: "钱叔落网", difficulty: 5, refEnemyId: "boss_farmer", recommendedPower: 1000, brief: [{ speaker: "沈锋", emoji: "🔫", text: "钱叔落网。", color: "#FF7A1A", side: "player" }], debrief: [{ speaker: "沈锋", emoji: "🔫", text: "断卡行动首战告捷。", color: "#FF7A1A", side: "player" }] },
    ],
    unlocks: { caseId: "case_farmer", relicId: "relic_regen_module" },
  },
  {
    id: "chapter_2_sweet",
    order: 2,
    title: "杀猪盘必破",
    subtitle: "市级 · 情感诈骗围剿",
    bossId: "boss_sweet",
    prologue: [{ speaker: "王婆婆", emoji: "👵", text: "社区有孩子在网恋，我去看看。", color: "#52C41A", side: "player" }],
    epilogue: [{ speaker: "王婆婆", emoji: "👵", text: "杀猪盘必破，下个窝点数据已入库。", color: "#52C41A", side: "player" }],
    recommendedPower: 1200,
    requires: "chapter_1_farmer",
    accent: "#FF7AB8",
    emoji: "💔",
    background: "市级反诈 · 情感诈骗围剿",
    stages: [
      { order: 1, title: "甜言蜜语", difficulty: 2, refEnemyId: "sweet", recommendedPower: 1000, brief: [{ speaker: "王婆婆", emoji: "👵", text: "甜言蜜语开始出现。", color: "#52C41A", side: "player" }], debrief: [{ speaker: "王婆婆", emoji: "👵", text: "甜言蜜语背后是杀猪盘。", color: "#52C41A", side: "player" }] },
      { order: 2, title: "情感陷阱", difficulty: 3, refEnemyId: "sweet", recommendedPower: 1100, brief: [{ speaker: "王婆婆", emoji: "👵", text: "情感陷阱加深。", color: "#52C41A", side: "player" }], debrief: [{ speaker: "王婆婆", emoji: "👵", text: "婉清团伙浮现。", color: "#52C41A", side: "player" }] },
      { order: 3, title: "投资诱导", difficulty: 4, refEnemyId: "investApp", recommendedPower: 1200, brief: [{ speaker: "苏岩", emoji: "📊", text: "投资诱导开始。", color: "#FFD666", side: "player" }], debrief: [{ speaker: "苏岩", emoji: "📊", text: "杀猪盘的资金流向锁定。", color: "#FFD666", side: "player" }] },
      { order: 4, title: "杀猪收网", difficulty: 5, refEnemyId: "boss_sweet", recommendedPower: 1300, brief: [{ speaker: "王婆婆", emoji: "👵", text: "杀猪收网。", color: "#52C41A", side: "player" }], debrief: [{ speaker: "王婆婆", emoji: "👵", text: "婉清落网。", color: "#52C41A", side: "player" }] },
      { order: 5, title: "窝点清零", difficulty: 5, refEnemyId: "boss_sweet", recommendedPower: 1400, brief: [{ speaker: "苏岩", emoji: "📊", text: "窝点清零。", color: "#FFD666", side: "player" }], debrief: [{ speaker: "苏岩", emoji: "📊", text: "下个窝点数据已入库。", color: "#FFD666", side: "player" }] },
    ],
    unlocks: { caseId: "case_sweet", skinId: "skin_lin_night" },
  },
  {
    id: "chapter_3_popup",
    order: 3,
    title: "假客服必挂",
    subtitle: "市级 · 客服网络净化",
    bossId: "boss_popup",
    prologue: [{ speaker: "林书影", emoji: "📡", text: "今天接了 200 个假客服电话，真客服快被淹没。", color: "#00E5FF", side: "player" }],
    epilogue: [{ speaker: "林书影", emoji: "📡", text: "假客服必挂，真客服不催。", color: "#00E5FF", side: "player" }],
    recommendedPower: 1500,
    requires: "chapter_2_sweet",
    accent: "#FFB020",
    emoji: "💬",
    background: "市级反诈 · 客服网络净化",
    stages: [
      { order: 1, title: "弹窗风暴", difficulty: 2, refEnemyId: "popup", recommendedPower: 1300, brief: [{ speaker: "林书影", emoji: "📡", text: "弹窗风暴开始。", color: "#00E5FF", side: "player" }], debrief: [{ speaker: "林书影", emoji: "📡", text: "弹窗脚本都一样。", color: "#00E5FF", side: "player" }] },
      { order: 2, title: "退费连环", difficulty: 3, refEnemyId: "refundFraud", recommendedPower: 1400, brief: [{ speaker: "林书影", emoji: "📡", text: "退费连环套开始。", color: "#00E5FF", side: "player" }], debrief: [{ speaker: "林书影", emoji: "📡", text: "退费是诱饵，共享屏幕是杀招。", color: "#00E5FF", side: "player" }] },
      { order: 3, title: "客服007浮现", difficulty: 4, refEnemyId: "boss_popup", recommendedPower: 1500, brief: [{ speaker: "林书影", emoji: "📡", text: "客服007的本体浮现。", color: "#00E5FF", side: "player" }], debrief: [{ speaker: "林书影", emoji: "📡", text: "客服007落网。", color: "#00E5FF", side: "player" }] },
      { order: 4, title: "脚本净化", difficulty: 5, refEnemyId: "boss_popup", recommendedPower: 1600, brief: [{ speaker: "林书影", emoji: "📡", text: "脚本净化启动。", color: "#00E5FF", side: "player" }], debrief: [{ speaker: "林书影", emoji: "📡", text: "假客服脚本全部失效。", color: "#00E5FF", side: "player" }] },
      { order: 5, title: "96110 守护", difficulty: 5, refEnemyId: "boss_popup", recommendedPower: 1700, brief: [{ speaker: "林书影", emoji: "📡", text: "96110 守护启动。", color: "#00E5FF", side: "player" }], debrief: [{ speaker: "林书影", emoji: "📡", text: "96110 守护完成。", color: "#00E5FF", side: "player" }] },
    ],
    unlocks: { caseId: "case_popup", relicId: "relic_combo_extender" },
  },
  {
    id: "chapter_4_threat",
    order: 4,
    title: "假警官必假",
    subtitle: "市级 · 公检法诈骗围剿",
    bossId: "boss_threat",
    prologue: [{ speaker: "陈默", emoji: "🥷", text: "假警官的拘捕令是 PS 的，我们去揭穿。", color: "#E5353B", side: "player" }],
    epilogue: [{ speaker: "陈默", emoji: "🥷", text: "公检法不电办，拘捕令不会通过电话发送。", color: "#E5353B", side: "player" }],
    recommendedPower: 1800,
    requires: "chapter_3_popup",
    accent: "#E5353B",
    emoji: "📞",
    background: "市级反诈 · 公检法诈骗围剿",
    stages: [
      { order: 1, title: "恐吓语音", difficulty: 3, refEnemyId: "threat", recommendedPower: 1600, brief: [{ speaker: "陈默", emoji: "🥷", text: "恐吓语音开始出现。", color: "#E5353B", side: "player" }], debrief: [{ speaker: "陈默", emoji: "🥷", text: "恐吓语音背后是假警官。", color: "#E5353B", side: "player" }] },
      { order: 2, title: "拘捕令", difficulty: 4, refEnemyId: "threat", recommendedPower: 1700, brief: [{ speaker: "陈默", emoji: "🥷", text: "拘捕令是 PS 的。", color: "#E5353B", side: "player" }], debrief: [{ speaker: "陈默", emoji: "🥷", text: "拘捕令的公章字体都对不上。", color: "#E5353B", side: "player" }] },
      { order: 3, title: "假警官浮现", difficulty: 5, refEnemyId: "boss_threat", recommendedPower: 1800, brief: [{ speaker: "陈默", emoji: "🥷", text: "假警官的本体浮现。", color: "#E5353B", side: "player" }], debrief: [{ speaker: "陈默", emoji: "🥷", text: "假警官落网。", color: "#E5353B", side: "player" }] },
      { order: 4, title: "剧本揭穿", difficulty: 5, refEnemyId: "boss_threat", recommendedPower: 1900, brief: [{ speaker: "林书影", emoji: "📡", text: "剧本揭穿。", color: "#00E5FF", side: "player" }], debrief: [{ speaker: "林书影", emoji: "📡", text: "96110 一天能接 200 个假警官电话。", color: "#00E5FF", side: "player" }] },
      { order: 5, title: "公检法守护", difficulty: 5, refEnemyId: "boss_threat", recommendedPower: 2000, brief: [{ speaker: "陈默", emoji: "🥷", text: "公检法守护启动。", color: "#E5353B", side: "player" }], debrief: [{ speaker: "陈默", emoji: "🥷", text: "公检法不电办深入人心。", color: "#E5353B", side: "player" }] },
    ],
    unlocks: { caseId: "case_threat", skinId: "skin_zhou_hacker" },
  },
  {
    id: "chapter_5_deepfake",
    order: 5,
    title: "AI 换脸必究",
    subtitle: "跨境 · AI 诈骗对决",
    bossId: "boss_deepfake",
    prologue: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "AI 换脸诈骗开始蔓延，鉴伪模型启动。", color: "#A8E6CF", side: "player" }],
    epilogue: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "AI 鉴伪一直在升级，换脸视频总有破绽。", color: "#A8E6CF", side: "player" }],
    recommendedPower: 2100,
    requires: "chapter_4_threat",
    accent: "#A8E6CF",
    emoji: "🎭",
    background: "跨境反诈 · AI 诈骗对决",
    stages: [
      { order: 1, title: "鉴伪模型", difficulty: 3, refEnemyId: "deepfake", recommendedPower: 1900, brief: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "鉴伪模型启动。", color: "#A8E6CF", side: "player" }], debrief: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "鉴伪模型识别出合成痕迹。", color: "#A8E6CF", side: "player" }] },
      { order: 2, title: "镜像分身", difficulty: 4, refEnemyId: "deepfake", recommendedPower: 2000, brief: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "镜像分身出现。", color: "#A8E6CF", side: "player" }], debrief: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "镜像团伙浮现。", color: "#A8E6CF", side: "player" }] },
      { order: 3, title: "镜中幻影", difficulty: 5, refEnemyId: "boss_deepfake", recommendedPower: 2100, brief: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "镜中幻影出现。", color: "#A8E6CF", side: "player" }], debrief: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "镜像的本体浮现。", color: "#A8E6CF", side: "player" }] },
      { order: 4, title: "鉴伪升级", difficulty: 5, refEnemyId: "boss_deepfake", recommendedPower: 2200, brief: [{ speaker: "周衡", emoji: "💻", text: "鉴伪模型升级。", color: "#B388FF", side: "player" }], debrief: [{ speaker: "周衡", emoji: "💻", text: "下一个换脸样本已入库训练。", color: "#B388FF", side: "player" }] },
      { order: 5, title: "镜像落网", difficulty: 5, refEnemyId: "boss_deepfake", recommendedPower: 2300, brief: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "镜像落网。", color: "#A8E6CF", side: "player" }], debrief: [{ speaker: "AI 鉴伪师", emoji: "🤖", text: "AI 鉴伪一直在升级。", color: "#A8E6CF", side: "player" }] },
    ],
    unlocks: { caseId: "case_deepfake", agentId: "jianwei" },
  },
  {
    id: "chapter_6_invest",
    order: 6,
    title: "虚假平台必崩",
    subtitle: "跨境 · 资金盘暴雷",
    bossId: "boss_invest",
    prologue: [{ speaker: "法务审计师", emoji: "⚖️", text: "虚假理财平台暴雷在即，资金链审计启动。", color: "#3D8BFD", side: "player" }],
    epilogue: [{ speaker: "法务审计师", emoji: "⚖️", text: "理财认持牌，群里的晒单都是托。", color: "#3D8BFD", side: "player" }],
    recommendedPower: 2400,
    requires: "chapter_5_deepfake",
    accent: "#FF6B9D",
    emoji: "💰",
    background: "跨境反诈 · 资金盘暴雷",
    stages: [
      { order: 1, title: "平台审计", difficulty: 4, refEnemyId: "investApp", recommendedPower: 2200, brief: [{ speaker: "法务审计师", emoji: "⚖️", text: "平台审计启动。", color: "#3D8BFD", side: "player" }], debrief: [{ speaker: "法务审计师", emoji: "⚖️", text: "持牌机构名录里查不到。", color: "#3D8BFD", side: "player" }] },
      { order: 2, title: "晒单揭穿", difficulty: 4, refEnemyId: "investApp", recommendedPower: 2300, brief: [{ speaker: "苏岩", emoji: "📊", text: "晒单揭穿。", color: "#FFD666", side: "player" }], debrief: [{ speaker: "苏岩", emoji: "📊", text: "群里的晒单都是托。", color: "#FFD666", side: "player" }] },
      { order: 3, title: "平台暴雷", difficulty: 5, refEnemyId: "boss_invest", recommendedPower: 2400, brief: [{ speaker: "法务审计师", emoji: "⚖️", text: "平台暴雷。", color: "#3D8BFD", side: "player" }], debrief: [{ speaker: "法务审计师", emoji: "⚖️", text: "钱生钱落网。", color: "#3D8BFD", side: "player" }] },
      { order: 4, title: "资金链追赃", difficulty: 5, refEnemyId: "boss_invest", recommendedPower: 2500, brief: [{ speaker: "苏岩", emoji: "📊", text: "资金链追赃启动。", color: "#FFD666", side: "player" }], debrief: [{ speaker: "苏岩", emoji: "📊", text: "资金链我们追得到。", color: "#FFD666", side: "player" }] },
      { order: 5, title: "持牌守护", difficulty: 5, refEnemyId: "boss_invest", recommendedPower: 2600, brief: [{ speaker: "法务审计师", emoji: "⚖️", text: "持牌守护启动。", color: "#3D8BFD", side: "player" }], debrief: [{ speaker: "法务审计师", emoji: "⚖️", text: "理财认持牌深入人心。", color: "#3D8BFD", side: "player" }] },
    ],
    unlocks: { caseId: "case_investApp", agentId: "fayi" },
  },
  {
    id: "chapter_7_loan",
    order: 7,
    title: "校园贷必破",
    subtitle: "校园 · 校园贷围剿",
    bossId: "boss_loan",
    prologue: [{ speaker: "数据预测师", emoji: "🔮", text: "校园贷团伙专盯大学生，AI 预警启动。", color: "#00C9A7", side: "player" }],
    epilogue: [{ speaker: "数据预测师", emoji: "🔮", text: "校园贷骗局必破，征信只能本人到央行查。", color: "#00C9A7", side: "player" }],
    recommendedPower: 2700,
    requires: "chapter_6_invest",
    accent: "#9B59B6",
    emoji: "📚",
    background: "校园反诈 · 校园贷围剿",
    stages: [
      { order: 1, title: "校园宣讲", difficulty: 4, refEnemyId: "loanCancel", recommendedPower: 2500, brief: [{ speaker: "王婆婆", emoji: "👵", text: "进校园讲一讲校园贷。", color: "#52C41A", side: "player" }], debrief: [{ speaker: "王婆婆", emoji: "👵", text: "学生开始警觉。", color: "#52C41A", side: "player" }] },
      { order: 2, title: "AI 预警", difficulty: 5, refEnemyId: "loanCancel", recommendedPower: 2600, brief: [{ speaker: "数据预测师", emoji: "🔮", text: "AI 预警启动。", color: "#00C9A7", side: "player" }], debrief: [{ speaker: "数据预测师", emoji: "🔮", text: "蜡笔老哥团伙定位完毕。", color: "#00C9A7", side: "player" }] },
      { order: 3, title: "蜡笔老哥浮现", difficulty: 5, refEnemyId: "boss_loan", recommendedPower: 2700, brief: [{ speaker: "数据预测师", emoji: "🔮", text: "蜡笔老哥的本体浮现。", color: "#00C9A7", side: "player" }], debrief: [{ speaker: "数据预测师", emoji: "🔮", text: "蜡笔老哥落网。", color: "#00C9A7", side: "player" }] },
      { order: 4, title: "征信守护", difficulty: 5, refEnemyId: "boss_loan", recommendedPower: 2800, brief: [{ speaker: "数据预测师", emoji: "🔮", text: "征信守护启动。", color: "#00C9A7", side: "player" }], debrief: [{ speaker: "数据预测师", emoji: "🔮", text: "征信只能本人到央行查。", color: "#00C9A7", side: "player" }] },
      { order: 5, title: "校园净化", difficulty: 5, refEnemyId: "boss_loan", recommendedPower: 2900, brief: [{ speaker: "王婆婆", emoji: "👵", text: "校园净化启动。", color: "#52C41A", side: "player" }], debrief: [{ speaker: "王婆婆", emoji: "👵", text: "一届一届讲下去。", color: "#52C41A", side: "player" }] },
    ],
    unlocks: { caseId: "case_loanCancel", agentId: "yuce" },
  },
  {
    id: "chapter_8_kingpin",
    order: 8,
    title: "跨境必究",
    subtitle: "跨境 · 终极围剿",
    bossId: "boss_kingpin",
    prologue: [{ speaker: "跨境联络官", emoji: "🌐", text: "国际刑警协调完毕，跨境围剿启动。", color: "#FF8A3D", side: "player" }],
    epilogue: [{ speaker: "沈锋", emoji: "🔫", text: "反诈没有终点，逐个清。", color: "#FF7A1A", side: "player" }],
    recommendedPower: 3000,
    requires: "chapter_7_loan",
    accent: "#FF3B6B",
    emoji: "👑",
    background: "跨境反诈 · 终极围剿",
    stages: [
      { order: 1, title: "国际协调", difficulty: 5, refEnemyId: "farmer", recommendedPower: 2800, brief: [{ speaker: "跨境联络官", emoji: "🌐", text: "国际刑警协调完毕。", color: "#FF8A3D", side: "player" }], debrief: [{ speaker: "跨境联络官", emoji: "🌐", text: "联合行动启动。", color: "#FF8A3D", side: "player" }] },
      { order: 2, title: "卧底归队", difficulty: 5, refEnemyId: "farmer", recommendedPower: 2900, brief: [{ speaker: "陈默", emoji: "🥷", text: "卧底三年，名单带回来了。", color: "#E5353B", side: "player" }], debrief: [{ speaker: "陈默", emoji: "🥷", text: "园区坐标已锁定。", color: "#E5353B", side: "player" }] },
      { order: 3, title: "跨境围剿", difficulty: 5, refEnemyId: "boss_kingpin", recommendedPower: 3000, brief: [{ speaker: "跨境联络官", emoji: "🌐", text: "跨境围剿启动。", color: "#FF8A3D", side: "player" }], debrief: [{ speaker: "跨境联络官", emoji: "🌐", text: "缅北枭雄的园区千名'员工'。", color: "#FF8A3D", side: "player" }] },
      { order: 4, title: "园区清零", difficulty: 5, refEnemyId: "boss_kingpin", recommendedPower: 3100, brief: [{ speaker: "陈默", emoji: "🥷", text: "园区清零。", color: "#E5353B", side: "player" }], debrief: [{ speaker: "陈默", emoji: "🥷", text: "缅北枭雄落网。", color: "#E5353B", side: "player" }] },
      { order: 5, title: "反诈无终点", difficulty: 5, refEnemyId: "boss_kingpin", recommendedPower: 3200, brief: [{ speaker: "沈锋", emoji: "🔫", text: "反诈没有终点。", color: "#FF7A1A", side: "player" }], debrief: [{ speaker: "沈锋", emoji: "🔫", text: "逐个清。", color: "#FF7A1A", side: "player" }] },
    ],
    unlocks: { caseId: "case_kingpin", skinId: "skin_chen_legend" },
  },
];

/** 根据 id 取主线章节 */
export function getStoryChapterFull(chapterId: string): StoryChapterFull | undefined {
  return STORY_CHAPTERS_FULL.find((c) => c.id === chapterId);
}

// ====================================================================
// v9 全面升级：探员羁绊系统（10 对，3 级递进）
// 同局同时部署羁绊双方时激活；等级随同局累计击杀数解锁（5 / 15 / 30）
// 14 名探员全员覆盖，每名至少参与 1 对羁绊
// ====================================================================

export const AGENT_BONDS: AgentBond[] = [
  {
    id: "bond_shen_lin",
    name: "老搭档·资金话术",
    color: "#FF7A1A",
    agentIds: ["shen", "lin"],
    story: "刑侦老炮与 96110 话务员并肩多年，话术一出口，资金链就已锁定。",
    levels: [
      { level: 1, requiredKills: 5, effect: "attackUp", value: 0.08, bondLine: "话术一出口，资金链就锁定了。" },
      { level: 2, requiredKills: 15, effect: "firerateUp", value: 0.12, bondLine: "96110 接线与资金冻结同步推进。" },
      { level: 3, requiredKills: 30, effect: "ultChargeUp", value: 0.25, bondLine: "老搭档默契满格，大招充能加速。" },
    ],
  },
  {
    id: "bond_zhou_yuce",
    name: "网安双雄",
    color: "#B388FF",
    agentIds: ["zhou", "yuce"],
    story: "网安追踪师与数据预测师，技术派双核：一个黑进窝点，一个预测下一步。",
    levels: [
      { level: 1, requiredKills: 5, effect: "critUp", value: 0.08, bondLine: "预测模型锁定目标，追踪师精准命中。" },
      { level: 2, requiredKills: 15, effect: "rangeUp", value: 0.10, bondLine: "数据视野扩展，射程提升。" },
      { level: 3, requiredKills: 30, effect: "elementLink", value: 0.5, bondLine: "技术系双核共振，元素反应额外伤害。" },
    ],
  },
  {
    id: "bond_wang_xiaoyuan",
    name: "社区温情线",
    color: "#52C41A",
    agentIds: ["wang", "xiaoyuan"],
    story: "社区宣防员与校园宣讲官，情感系宣防双线，从社区到校园守护每一处温情。",
    levels: [
      { level: 1, requiredKills: 5, effect: "healLink", value: 0.10, bondLine: "社区与校园互助，伤害转化治疗。" },
      { level: 2, requiredKills: 15, effect: "shieldLink", value: 0.08, bondLine: "温情护盾，受击互加盾。" },
      { level: 3, requiredKills: 30, effect: "comboBoost", value: 0.20, bondLine: "宣防协同，连击倍率提升。" },
    ],
  },
  {
    id: "bond_chen_su",
    name: "暗影猎查",
    color: "#E5353B",
    agentIds: ["chen", "su"],
    story: "卧底侦查员潜伏三年带回名单，数据猎查师用模型锁定资金流向，内外线夹击。",
    levels: [
      { level: 1, requiredKills: 5, effect: "critUp", value: 0.10, bondLine: "卧底定位+数据锁定，暴击提升。" },
      { level: 2, requiredKills: 15, effect: "attackUp", value: 0.10, bondLine: "内外线夹击，攻击力提升。" },
      { level: 3, requiredKills: 30, effect: "comboBoost", value: 0.30, bondLine: "暗影猎查连击不断，连击倍率额外提升。" },
    ],
  },
  {
    id: "bond_fayi_piaowu",
    name: "法理审计",
    color: "#3D8BFD",
    agentIds: ["fayi", "piaowu"],
    story: "法务审计师与票务稽查员，法律系双执法：一个审壳公司，一个查假票务。",
    levels: [
      { level: 1, requiredKills: 5, effect: "attackUp", value: 0.08, bondLine: "法理+稽查双执法，攻击提升。" },
      { level: 2, requiredKills: 15, effect: "firerateUp", value: 0.10, bondLine: "执法节奏加快。" },
      { level: 3, requiredKills: 30, effect: "ultChargeUp", value: 0.20, bondLine: "执法联动，大招充能加速。" },
    ],
  },
  {
    id: "bond_kuajing_hangban",
    name: "跨境联运",
    color: "#FF8A3D",
    agentIds: ["kuajing", "hangban"],
    story: "跨境联络官协调国际刑警，航班护航员守护航线，跨境联合作战无缝衔接。",
    levels: [
      { level: 1, requiredKills: 5, effect: "rangeUp", value: 0.10, bondLine: "跨境视野，射程提升。" },
      { level: 2, requiredKills: 15, effect: "attackUp", value: 0.10, bondLine: "联合作战，攻击提升。" },
      { level: 3, requiredKills: 30, effect: "elementLink", value: 0.4, bondLine: "跨境+航班协同，元素反应加成。" },
    ],
  },
  {
    id: "bond_jianwei_zhou",
    name: "鉴伪追踪",
    color: "#A8E6CF",
    agentIds: ["jianwei", "zhou"],
    story: "AI 鉴伪师识破每一帧换脸，网安追踪师黑进每一台服务器，技术反诈深度协同。",
    levels: [
      { level: 1, requiredKills: 5, effect: "critUp", value: 0.08, bondLine: "鉴伪+追踪，精准命中。" },
      { level: 2, requiredKills: 15, effect: "shieldLink", value: 0.10, bondLine: "鉴伪护盾与追踪协同防御。" },
      { level: 3, requiredKills: 30, effect: "ultChargeUp", value: 0.20, bondLine: "技术双核，大招充能加速。" },
    ],
  },
  {
    id: "bond_jiuyuan_wang",
    name: "急救助宣防",
    color: "#FF7043",
    agentIds: ["jiuyuan", "wang"],
    story: "应急救助员与社区宣防员，救助+宣防双线，从急救到宣防守护受害人。",
    levels: [
      { level: 1, requiredKills: 5, effect: "healLink", value: 0.12, bondLine: "救助+宣防，伤害转化治疗。" },
      { level: 2, requiredKills: 15, effect: "shieldLink", value: 0.10, bondLine: "应急护盾，互加盾。" },
      { level: 3, requiredKills: 30, effect: "ultChargeUp", value: 0.20, bondLine: "救助协同，大招充能加速。" },
    ],
  },
  {
    id: "bond_shen_fayi",
    name: "资金冻结线",
    color: "#FFB020",
    agentIds: ["shen", "fayi"],
    story: "资金链斩断师追资金流向，法务审计师审壳公司账目，资金链双冻结无遗漏。",
    levels: [
      { level: 1, requiredKills: 5, effect: "attackUp", value: 0.10, bondLine: "资金+法务双冻结，攻击提升。" },
      { level: 2, requiredKills: 15, effect: "firerateUp", value: 0.10, bondLine: "冻结节奏加快。" },
      { level: 3, requiredKills: 30, effect: "comboBoost", value: 0.25, bondLine: "资金链连击不断。" },
    ],
  },
  {
    id: "bond_su_kuajing",
    name: "数据跨境",
    color: "#FFD666",
    agentIds: ["su", "kuajing"],
    story: "数据猎查师锁定资金流向，跨境联络官协调国际执法，数据+跨境联合收网。",
    levels: [
      { level: 1, requiredKills: 5, effect: "critUp", value: 0.10, bondLine: "数据+跨境锁定，暴击提升。" },
      { level: 2, requiredKills: 15, effect: "rangeUp", value: 0.10, bondLine: "跨境数据视野，射程提升。" },
      { level: 3, requiredKills: 30, effect: "ultChargeUp", value: 0.20, bondLine: "数据跨境协同，大招充能加速。" },
    ],
  },
];

/** 根据 id 取探员羁绊定义 */
export function getAgentBond(bondId: string): AgentBond | undefined {
  return AGENT_BONDS.find((b) => b.id === bondId);
}

/** 取指定探员参与的所有羁绊（用于部署时检测激活） */
export function getBondsByAgent(agentId: string): AgentBond[] {
  return AGENT_BONDS.filter((b) => b.agentIds.includes(agentId));
}

/** 取两名探员之间的羁绊（无则返回 undefined） */
export function getBondBetween(agentIdA: string, agentIdB: string): AgentBond | undefined {
  return AGENT_BONDS.find(
    (b) => b.agentIds.includes(agentIdA) && b.agentIds.includes(agentIdB),
  );
}

// ====================================================================
// v10 新增：系统总览数据（让玩家了解 manager 模块的 20+ 系统及触发方式）
// 在 ManagerCodexScene 第 6 Tab "系统" 中展示
// ====================================================================

/** 系统总览条目 */
export interface SystemOverviewEntry {
  /** 系统 id */
  id: string;
  /** 系统名称 */
  name: string;
  /** emoji 图标 */
  emoji: string;
  /** 主题色 */
  color: string;
  /** 一句话说明 */
  desc: string;
  /** 触发条件 */
  trigger: string;
  /** 所属版本（v3/v6/v8/v9/v10 等） */
  version: string;
  /** 分类：core=核心 / element=元素 / bond=羁绊 / education=教育 / meta=元进度 */
  category: "core" | "element" | "bond" | "education" | "meta";
}

/** manager 模块的 20+ 系统总览（按版本 + 分类组织） */
export const MANAGER_SYSTEMS: SystemOverviewEntry[] = [
  // ===== 核心战斗系统 =====
  { id: "sys_element", name: "元素克制", emoji: "⚡", color: "#00E5FF", desc: "5 系元素循环相克，强效命中加伤、弱效减伤", trigger: "探员与敌人元素相克时自动触发", version: "v3", category: "core" },
  { id: "sys_combo", name: "连击系统", emoji: "🔥", color: "#FFD666", desc: "连续击杀累积倍率，最高 2.5×", trigger: "3 秒内连续击杀", version: "v3", category: "core" },
  { id: "sys_ult", name: "探员独有大招", emoji: "💥", color: "#FF7A1A", desc: "10 种大招，能量满释放", trigger: "能量 100 时点大招按钮", version: "v3", category: "core" },
  { id: "sys_boss_phase", name: "BOSS 三阶段", emoji: "👑", color: "#E5353B", desc: "BOSS HP 60%/30% 触发阶段技能", trigger: "BOSS 战中自动触发", version: "v3", category: "core" },
  { id: "sys_maze", name: "分支迷宫", emoji: "🗺️", color: "#52C41A", desc: "4 套迷宫随机，多路径刷怪", trigger: "每局开局随机选择", version: "v4", category: "core" },
  { id: "sys_upgrade", name: "探员升级", emoji: "⬆️", color: "#FFB020", desc: "8 种升级随机三选一，最多 8 次", trigger: "经验满时弹出选择", version: "v5", category: "core" },
  // ===== v6 系统 =====
  { id: "sys_talent", name: "天赋树", emoji: "🌳", color: "#52C41A", desc: "每探员 3 分支 × 5 层，反诈积分解锁", trigger: "ProgressionScene → 天赋 Tab", version: "v6", category: "meta" },
  { id: "sys_relic", name: "遗物系统", emoji: "🏺", color: "#FFD666", desc: "类杀戮尖塔，每局选 1 件下局携带", trigger: "BOSS 击破 / 爬塔层 / 答题", version: "v6", category: "meta" },
  { id: "sys_equipment", name: "装备系统", emoji: "⚔️", color: "#00E5FF", desc: "每探员 2 槽位（武器/徽章）", trigger: "ProgressionScene → 装备 Tab", version: "v6", category: "meta" },
  { id: "sys_skin", name: "探员皮肤", emoji: "🎨", color: "#FF7AB8", desc: "改变剪影与主题色", trigger: "完成支线 / 解锁条件", version: "v6", category: "meta" },
  { id: "sys_tactical_device", name: "战术装置", emoji: "🛡️", color: "#1B5FCC", desc: "3 种装置（屏障/诱饵/EMP），每局限 3 个", trigger: "战斗中点击装置按钮", version: "v6", category: "core" },
  { id: "sys_skill_link", name: "技能链", emoji: "🔗", color: "#FF7AB8", desc: "组合探员同时部署触发协同技", trigger: "部署特定探员组合", version: "v6", category: "bond" },
  { id: "sys_element_reaction", name: "元素反应", emoji: "⚗️", color: "#00BFA5", desc: "5 系元素叠加触发场地效果", trigger: "多元素探员同时部署", version: "v6", category: "element" },
  { id: "sys_quiz", name: "战间答题", emoji: "📝", color: "#FFB020", desc: "每 5 波弹一题，答对获 buff", trigger: "波数 % 5 == 0 时自动弹出", version: "v6", category: "education" },
  { id: "sys_tower", name: "爬塔模式", emoji: "🗼", color: "#FFD666", desc: "100 层递进，每 5 层事件、每 10 层 BOSS", trigger: "选择 tower 模式", version: "v6", category: "core" },
  { id: "sys_season", name: "赛季周常", emoji: "🏆", color: "#FFB020", desc: "每月一赛季，周常任务奖励", trigger: "SeasonScene 查看", version: "v6", category: "meta" },
  { id: "sys_challenge", name: "极限词缀", emoji: "💀", color: "#E5353B", desc: "挑战模式专属，10 种词缀", trigger: "选择 challenge 模式", version: "v6", category: "core" },
  // ===== v8 系统 =====
  { id: "sys_victim", name: "受害人营救", emoji: "🆘", color: "#52C41A", desc: "地图随机受害人，敌人接触触发洗脑", trigger: "探员靠近受害人降低进度", version: "v8", category: "core" },
  { id: "sys_speech_bubble", name: "话术气泡", emoji: "💬", color: "#FFB020", desc: "敌人冒话术，点对应口诀击破+易伤", trigger: "战斗中点 4 个口诀按钮", version: "v8", category: "education" },
  { id: "sys_tactical_command", name: "战术指令", emoji: "📡", color: "#1B5FCC", desc: "对单探员下达 5 种短指令", trigger: "选中探员后点指令按钮", version: "v8", category: "core" },
  { id: "sys_card_skill", name: "卡牌大招", emoji: "🃏", color: "#FF7AB8", desc: "保留能量基础，每探员 3 张牌抽 1", trigger: "能量满时抽牌释放", version: "v8", category: "core" },
  { id: "sys_case_breakdown", name: "五步复盘", emoji: "🔍", color: "#FFB020", desc: "结算展示案例 5 步拆解 + 拦截点", trigger: "胜利结算时弹出", version: "v8", category: "education" },
  // ===== v9 系统 =====
  { id: "sys_ai_behavior", name: "敌人 AI 行为树", emoji: "🧠", color: "#E5353B", desc: "10 种行为类型，运行时动态切换", trigger: "敌人血量/概率触发", version: "v9", category: "core" },
  { id: "sys_relic_craft", name: "遗物合成", emoji: "🔧", color: "#FFD666", desc: "tier 1→2→3 三级合成", trigger: "战间遗物商店三选一", version: "v9", category: "meta" },
  { id: "sys_investigation", name: "分支式调查", emoji: "⚖️", color: "#1B5FCC", desc: "5 阶段调查，S/A/B/C/D 评级", trigger: "胜利结算时优先弹出", version: "v9", category: "education" },
  { id: "sys_bond", name: "探员羁绊", emoji: "🤝", color: "#FF7AB8", desc: "组合探员同局击杀达 5/15/30 升级", trigger: "同时部署有羁绊的探员", version: "v9", category: "bond" },
  { id: "sys_wrong_questions", name: "错题本", emoji: "❌", color: "#E5353B", desc: "跨场景错题结构化记录，自适应重练", trigger: "答题错误自动入本", version: "v9", category: "education" },
  // ===== v10 新增 =====
  { id: "sys_system_events", name: "系统事件通知", emoji: "📢", color: "#FFB020", desc: "高光时刻 toast 提示（本 v10 新增）", trigger: "元素反应/技能链/敌人AI/羁绊触发", version: "v10", category: "core" },
  { id: "sys_learned_tips", name: "反诈知识点收集", emoji: "📚", color: "#52C41A", desc: "本局击破敌人 fraudType 自动收集", trigger: "击杀敌人时收集，结算页展示", version: "v10", category: "education" },
];
