import type { CodexEntry } from "@/types";

export const CODEX: CodexEntry[] = [
  {
    typeId: "F01",
    name: "冒充公检法",
    icon: "🚔",
    catchphrase: "电话办案 = 诈骗",
    points: [
      "公检法不会通过电话办案",
      "不存在“安全账户”",
      "不会被要求转账“自证清白”",
    ],
    response: "挂断并拨打 96110 核实，必要时到就近派出所",
    source: "公安部刑事侦查局",
  },
  {
    typeId: "F02",
    name: "杀猪盘",
    icon: "🐷",
    catchphrase: "稳赚不赔 = 杀猪",
    points: [
      "高富帅/白富美主动加好友且快速暧昧",
      "引导到非正规平台投资",
      "小额提现成功，大额无法提现",
    ],
    response: "不下载陌生APP，不向个人账户转账，投资认准持牌机构",
    source: "国家反诈中心",
  },
  {
    typeId: "F03",
    name: "刷单返利",
    icon: "💰",
    catchphrase: "凡是刷单都是违法",
    points: [
      "凡是刷单都是违法",
      "前几单返利诱你加大投入",
      "“卡单/操作失误”要求继续垫付",
    ],
    response: "拒绝任何刷单，已转账立即 96110",
    source: "国家反诈中心",
  },
  {
    typeId: "F04",
    name: "冒充客服退款",
    icon: "📞",
    catchphrase: "屏幕共享 = 套路",
    points: [
      "主动来电退款理赔",
      "要求屏幕共享",
      "让你贷款“验资”或刷流水",
    ],
    response: "挂断后到官方APP自行核实，绝不屏幕共享，验证码不外泄",
    source: "公安部刑事侦查局",
  },
  {
    typeId: "F05",
    name: "虚假投资理财",
    icon: "📈",
    catchphrase: "保证收益都是骗",
    points: [
      "保证收益都是骗",
      "私下加群荐股",
      "平台 K 线可后台操控",
    ],
    response: "投资理财认准正规持牌机构，不信“内部渠道”",
    source: "国家反诈中心",
  },
  {
    typeId: "F06",
    name: "冒充熟人/领导",
    icon: "👤",
    catchphrase: "转账前先核实",
    points: [
      "头像昵称高仿",
      "催促转账制造紧迫",
      "拒绝电话/视频核实",
    ],
    response: "电话或当面核实，多问一个只有双方知道的问题",
    source: "公安部刑事侦查局",
  },
  {
    typeId: "F07",
    name: "注销校园贷/征信修复",
    icon: "📜",
    catchphrase: "征信不能花钱修",
    points: [
      "校园贷账户注销不需转账",
      "征信由人民银行管理",
      "收费消除不良记录都是骗",
    ],
    response: "通过人民银行征信中心官网查询，不轻信陌生来电",
    source: "人民银行 / 公安部",
  },
  {
    typeId: "F08",
    name: "游戏账号/装备交易",
    icon: "🎮",
    catchphrase: "先交保证金 = 诈骗",
    points: [
      "走官方或知名第三方平台",
      "任何索要账号密码+验证码都是盗号",
      "免费送绝版皮肤是诱饵",
    ],
    response: "不下载陌生交易APP，不输入账号密码到非官方页面",
    source: "国家反诈中心",
  },
  {
    typeId: "F09",
    name: "虚假中奖",
    icon: "🎁",
    catchphrase: "未参与的中奖是诈骗",
    points: [
      "未参与的抽奖中奖是诈骗",
      "正规中奖扣税由发放方代扣",
      "19.9 邮费套取支付信息",
    ],
    response: "直接删除，不点击链接不扫码不付费",
    source: "国家反诈中心",
  },
  {
    typeId: "F10",
    name: "裸聊敲诈",
    icon: "🔞",
    catchphrase: "不下载陌生APP",
    points: [
      "诱导下载木马APP窃取通讯录",
      "录屏勒索封口费",
      "不转账不回应保留证据",
    ],
    response: "不转账、不回应，保留证据立即报警 96110",
    source: "公安部刑事侦查局",
  },
  {
    typeId: "F11",
    name: "AI换脸/拟声",
    icon: "🤖",
    catchphrase: "挂断后回拨核实",
    points: [
      "视频可疑动作僵硬",
      "催促转账",
      "拒绝再次视频或要求眨眼/转头",
    ],
    response: "挂断后用已知号码回拨核实，多重确认再转账",
    source: "国家反诈中心",
  },
  {
    typeId: "F12",
    name: "虚构险情/事故",
    icon: "🚑",
    catchphrase: "挂断后核实亲人",
    points: [
      "制造紧迫感让你来不及核实",
      "虚构事故/手术/抓捕",
      "要求立即转账",
    ],
    response: "挂断后联系当事人本人或医院/学校核实",
    source: "公安部刑事侦查局",
  },
];

export function getCodex(typeId: string): CodexEntry | undefined {
  return CODEX.find((c) => c.typeId === typeId);
}
