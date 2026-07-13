import type { AntiFraudTip } from "@/types";

export const TIPS: AntiFraudTip[] = [
  {
    id: "tip-001",
    title: "96110 是反诈专线",
    body: "96110 是全国反诈专线，来电请务必接听；疑似被骗立即拨打 96110 报警咨询。",
    source: "公安部刑事侦查局",
  },
  {
    id: "tip-002",
    title: "三不一多原则",
    body: "未知链接不点击，陌生来电不轻信，个人信息不透露，转账汇款多核实。",
    source: "国家反诈中心",
  },
  {
    id: "tip-003",
    title: "验证码即密码",
    body: "任何索要短信验证码的都是诈骗。验证码 = 你的钱袋子密码，绝不外泄。",
    source: "国家反诈中心",
  },
  {
    id: "tip-004",
    title: "公检法不会电话办案",
    body: "真警察会让你到公安机关当面配合调查，绝不会电话要求转账到“安全账户”。",
    source: "公安部刑事侦查局",
  },
  {
    id: "tip-005",
    title: "下载国家反诈中心APP",
    body: "官方反诈APP 提供预警、举报、学习一站式服务，开启来电预警守护钱包。",
    source: "国家反诈中心",
  },
  {
    id: "tip-006",
    title: "高薪境外招聘是陷阱",
    body: "境外高薪招聘 = 电诈陷阱。被诱骗至园区应立即联系使馆，拨打 12308 领事保护热线。",
    source: "外交部领事保护中心",
  },
  {
    id: "tip-007",
    title: "12321 举报渠道",
    body: "收到垃圾短信、骚扰电话、不良APP，可拨打 12321 或登录 12321.cn 举报。",
    source: "工业和信息化部",
  },
  {
    id: "tip-008",
    title: "征信不能花钱修",
    body: "任何收费消除征信不良记录的都是诈骗。征信由人民银行统一管理，可通过官网免费查询。",
    source: "中国人民银行",
  },
];

export function randomTip(seed?: number): AntiFraudTip {
  if (seed === undefined) return TIPS[Math.floor(Math.random() * TIPS.length)];
  return TIPS[seed % TIPS.length];
}
