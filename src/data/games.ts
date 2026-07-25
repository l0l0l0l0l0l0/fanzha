import type { GameMeta, GameId } from "@/types";

export const GAMES: GameMeta[] = [
  {
    id: "fraud-buster",
    title: "是男人就反诈",
    subtitle: "FRAUD BUSTER",
    tagline: "扛过 100 波，才是真男人",
    tags: ["限时判断", "无尽挑战", "反诈科普"],
    difficulty: 3,
    accent: "#1AD670",
    accentSoft: "rgba(26, 214, 112, 0.18)",
    icon: "shield",
    cover: "phone",
    description:
      "诈骗情境卡片像雪片飞来，4 秒内判断是诈骗还是正常，扛过的波数越多越“是男人”。致敬经典《是男人就下 100 层》。",
    briefing: {
      type: "通用诈骗识别训练",
      points: [
        "公检法不会电话办案，更没有“安全账户”",
        "陌生链接不点，验证码即密码",
        "遇到可疑来电，立即拨打 96110",
      ],
      hotline: "96110",
    },
  },
  {
    id: "manager",
    title: "反诈职业经理人",
    subtitle: "ANTI-FRAUD MANAGER",
    tagline: "招募探员，组建反诈战队",
    tags: ["策略部署", "实时塔防", "探员养成"],
    difficulty: 4,
    accent: "#FFB020",
    accentSoft: "rgba(255, 176, 32, 0.18)",
    icon: "users",
    cover: "tactic",
    description:
      "招募 6 名反诈探员，部署到 3×3 战位，自动开火拦截杀猪盘敌人，玩家点击释放大招。致敬《职业经理人》组建球队玩法。",
    briefing: {
      type: "杀猪盘战场",
      points: [
        "高富帅/白富美主动加好友，快速暧昧要警惕",
        "引导到非正规平台投资、稳赚不赔是陷阱",
        "提现需交“税费”“解冻金” = 100% 诈骗",
      ],
      hotline: "96110",
    },
  },
  {
    id: "thunder",
    title: "雷霆反诈",
    subtitle: "THUNDER ANTI-FRAUD",
    tagline: "驾驶执法号，扫荡电诈舰队",
    tags: ["竖屏射击", "弹幕躲避", "Boss 战"],
    difficulty: 4,
    accent: "#00E5FF",
    accentSoft: "rgba(0, 229, 255, 0.18)",
    icon: "rocket",
    cover: "ship",
    description:
      "驾驶警务执法号穿越电信诈骗舰队，自动开火击破杀猪盘、冒充客服等诈骗敌人，拾取国家反诈APP、不接境外来电等强力反诈道具，积累积分晋升反诈称号，与“诈骗集团首脑”Boss 决战。致敬《雷霆战机》。",
    briefing: {
      type: "跨境电信诈骗集团",
      points: [
        "公检法不会通过电话办案",
        "不存在所谓“安全账户”",
        "不会被要求转账“自证清白”",
        "凡是要验证码、密码的全部是诈骗",
      ],
      hotline: "96110",
    },
  },
  {
    id: "bomb-island",
    title: "诈园区",
    subtitle: "SCAM PARK",
    tagline: "自动炮击围攻境外电诈园区",
    tags: ["自动炮击", "无尽波次", "道具连招"],
    difficulty: 3,
    accent: "#FF7A1A",
    accentSoft: "rgba(255, 122, 26, 0.18)",
    icon: "bomb",
    cover: "bomb",
    description:
      "反诈意大利炮自动连续炮击境外电诈园区，左侧道具栏释放反诈炮弹/96110震慑/警方突击/反诈APP光束等连招，过载槽充满后火力全开。无尽波次，园区逐级升级。",
    briefing: {
      type: "境外电诈园区",
      points: [
        "境外高薪招聘 = 电诈陷阱，勿信勿往",
        "被诱骗至园区应立即联系使馆求助",
        "12308 中国领事保护热线 24 小时",
      ],
      hotline: "12308",
    },
  },
];

export function getGame(id: GameId): GameMeta {
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown game ${id}`);
  return g;
}
