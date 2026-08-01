# FraudBuster 新增 4 模式 PRD

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 创建日期 | 2026-07-31 |
| 状态 | 待审阅 |
| 适用范围 | fanzha/src/games/fraudBuster |
| 决策口径 | A/B/C/D 全部融入 FraudBuster 为新模式，manager 游戏保留不动 |

---

## 1. 背景与目标

### 1.1 现状盘点

FraudBuster 已是反诈街机平台的主游戏，现有功能极度完整：

- **9 个游戏模式**：endless / story / speedrun / hardcore / daily / review / aiBattle / versus / deconstruct
- **14 种卡片类型**：chat / call / transfer / popup / sms / video / qrcode / voice / app / audio / branch / live / secondhand / recruit
- **9 种题型**：single / judge / multi / fill / link / sort / branch / crisis / evidence
- **题库**：覆盖 2026 全部新型诈骗（F87-F96 等 10 大类，每类 5 题）
- **教育功能**：图鉴、知识图谱、受害者档案、案例库、证书、小课堂、96110 热线、反诈工具箱、每日任务、节日活动、本地排行榜

继续在同一框架里堆模式，边际收益已低。**真正能让反诈题材释放潜力的，是跳出"答题"这一种交互范式。**

### 1.2 新增 4 模式总览

| 模式 ID | 名称 | 玩法核心 | 数据复用 | 冲突处理（已确认） |
|---|---|---|---|---|
| **detective** | 反诈侦探·案件推理 | 多证据链交叉推理还原剧本 | caseArchives + evidence + deconstruct 数据 | 保留 evidence 单题，A 作为独立模式并存 |
| **persuader** | 96110 劝阻员·对话博弈 | 限时对话说服不同心理状态受害者 | FBHotlineScript | hotline 升级为双向（受害者拨入 + 劝阻员拨出） |
| **scamSim** | 骗子模拟器·反转视角教学 | 选话术对 AI 受害者实施诈骗 | deconstruct 剧本 + victimProfiles | 严格教学反向库 + 强制备盘 + 不教唆定位 |
| **manage** | 反诈中心·经营模拟 | 经营反诈中心降发案率 | items 道具 + season 季节 + tasks 任务 | 融入 FraudBuster 为新模式，manager 游戏保留不动 |

### 1.3 目标

- 让 FraudBuster 从"答题闯关"扩展为"反诈题材多玩法聚合平台"
- 覆盖反诈全流程：识诈（detective）→ 劝阻（persuader）→ 反向学习（scamSim）→ 系统防御（manage）
- 最大化复用现有数据，避免重写题库
- 不破坏现有 9 模式与教育功能，新模式独立挂载

---

## 2. 数据复用矩阵

| 现有数据 | 现有用途 | 新模式复用方式 |
|---|---|---|
| `caseArchives` 案例库（10 类 × 5 = 50 案例） | 结算页溯源展示 | detective 作为案件源数据 |
| `evidence-questions.json`（8 道证据题） | evidence 题型单题 | detective 作为单条证据片段，复用 `FBEvidenceMessage` 结构 |
| `deconstruct-scenarios.json`（12 个完整剧本） | deconstruct 模式被动观看 | scamSim 作为骗子话术池，按 tactic 字段抽取 |
| `FBHotlineScript`（20 个 96110 剧本） | hotline 受害者拨入 | persuader 反向复用，受害者心理状态来自 victimProfiles |
| `VICTIM_PROFILES`（9 种档案） | 结算页匹配受害者类型 | scamSim 作为 AI 受害者初始心理参数；persuader 作为受害者画像 |
| `ITEM_UPGRADE_DEFS`（6 道具 × 3 级） | 道具系统 | manage 改造为"反诈装备"（警力/系统/宣传物料） |
| `DAILY_TASK_POOL`（12 任务 × 6 类型） | 每日任务 | manage 改造为"辖区警情任务" |
| `FBSeason`（7 季节） | 季节性加权出题 | manage 作为"季度警情潮汐"参数 |
| `FBBoss`（诈骗首脑） | Boss 战 | manage 作为"诈骗集团 Boss"周期出现 |
| `FBKnowledgeGraph` | 知识图谱 | manage 作为"辖区反诈能力图谱" |

---

## 3. 方案 A：反诈侦探·案件推理（detective）

### 3.1 玩法核心

玩家扮演反诈中心探员，接警后查看完整证据材料（聊天记录/转账流水/通话录音/可疑链接/截图），通过**多证据链交叉推理**还原诈骗剧本，定位受害者被哪一步攻破，找出关键"破局点"。

与现有 evidence 题型的区别：
- evidence 题型：单题，从 5 条聊天消息里选 1 条诈骗话术
- detective 模式：多源证据（聊天+转账+通话+链接+截图）交叉推理，需回答 3-5 个递进问题

### 3.2 玩法流程

```
[案件选择] → [案情简报] → [证据收集（限时浏览）] → [推理问答（3-5 题）]
       ↓                                          ↓
   [案件库列表]                              [破局点定位]
                                                   ↓
                                          [复盘：剧本还原 + 心理弱点 + 教训]
                                                   ↓
                                          [案件归档（写入存档）]
```

### 3.3 数据结构（新增）

```typescript
// 新增到 types.ts

/** 反诈侦探案件（detective 模式） */
export interface FBDetectiveCase {
  /** 案件 ID（如 DET-001） */
  id: string;
  /** 关联诈骗类型 ID（F01/F02/F87 等） */
  typeId: string;
  /** 诈骗类型名 */
  type: string;
  /** 案件标题 */
  title: string;
  /** 难度 1-4 */
  difficulty: number;
  /** 案情简报（接警时展示） */
  briefing: string;
  /** 受害者画像（复用 VICTIM_PROFILES 的 typeId） */
  victimProfileId: string;
  /** 证据收集时限（秒，默认 60） */
  evidenceReviewSec: number;
  /** 多源证据列表 */
  evidences: FBDetectiveEvidence[];
  /** 推理问答列表（3-5 题，递进式） */
  reasoningQuestions: FBDetectiveQuestion[];
  /** 破局点：诈骗剧本的关键转折点 */
  breakingPoint: {
    /** 在 evidences 中的索引 */
    evidenceIdx: number;
    /** 在该证据内部的位置（如第几条消息） */
    innerIdx: number;
    /** 破局点说明 */
    desc: string;
  };
  /** 案件复盘 */
  caseSummary: {
    /** 完整诈骗剧本还原（按时间线） */
    timeline: string[];
    /** 利用的心理弱点（复用 FBPsychology） */
    psychology: FBPsychology[];
    /** 核心教训 */
    lesson: string;
    /** 关联案例档案（复用 caseArchives） */
    caseArchive?: FBCaseArchive;
  };
  /** 多维度标签 */
  tags?: string[];
  /** 更新日期 */
  updateDate?: string;
  /** 严重度 1-5 */
  severity?: number;
}

/** 侦探案件证据片段（多源） */
export interface FBDetectiveEvidence {
  /** 证据 ID */
  id: string;
  /** 证据类型 */
  kind: "chat" | "transfer" | "call" | "link" | "screenshot" | "audio";
  /** 证据标题（如"与骗子聊天记录""银行转账流水"） */
  title: string;
  /** 证据内容（结构因 kind 而异） */
  payload: FBDetectiveEvidencePayload;
  /** 证据标签（如"关键证据""误导证据""正常证据"） */
  tag: "key" | "misleading" | "normal";
  /** 该证据揭露的诈骗话术要点 */
  revealedCues?: string[];
}

/** 证据内容（联合类型，按 kind 区分） */
export type FBDetectiveEvidencePayload =
  | { kind: "chat"; messages: FBEvidenceMessage[] }   // 复用现有 FBEvidenceMessage
  | { kind: "transfer"; flows: Array<{ from: string; to: string; amount: string; time: string; note?: string }> }
  | { kind: "call"; transcript: string; duration: number; callerNumber: string; isSyntheticVoice?: boolean }
  | { kind: "link"; url: string; screenshotDesc: string; domainAnalysis: string; isPhishing: boolean }
  | { kind: "screenshot"; desc: string; details: string[]; tampered: boolean }
  | { kind: "audio"; clip: FBAudioClip };  // 复用现有 FBAudioClip

/** 推理问答题（递进式 3-5 题） */
export interface FBDetectiveQuestion {
  /** 问题 ID */
  id: string;
  /** 问题类型 */
  kind: "single" | "multi" | "sort" | "link";
  /** 问题文本 */
  question: string;
  /** 选项 */
  options: string[];
  /** 单选/判断正确索引 */
  answer?: number;
  /** 多选正确索引列表 */
  answers?: number[];
  /** 排序正确序列 */
  sortCorrect?: number[];
  /** 连线题 */
  linkLeft?: string[];
  linkRight?: string[];
  linkPairing?: number[];
  /** 答错是否锁定（不允许重试） */
  lockOnWrong?: boolean;
  /** 解析 */
  explain: string;
  /** 该问题对应的推理阶段（如"识别诈骗类型""定位攻破点""还原剧本"） */
  stage: "identify" | "locate" | "reconstruct" | "prevent";
}

/** 侦探模式 HUD 状态 */
export interface FBHudDetectiveState {
  /** 当前案件 */
  caseId: string;
  /** 案件标题 */
  caseTitle: string;
  /** 当前阶段：briefing / evidence / reasoning / summary / archived */
  stage: "briefing" | "evidence" | "reasoning" | "summary" | "archived";
  /** 证据浏览剩余秒数（evidence 阶段） */
  evidenceRemainSec: number;
  /** 已查看的证据 ID 列表 */
  viewedEvidenceIds: string[];
  /** 当前选中的证据 ID（null=未选中） */
  selectedEvidenceId: string | null;
  /** 当前推理问题索引 */
  currentQuestionIdx: number;
  /** 已回答问题结果 */
  answeredQuestions: Array<{ questionId: string; correct: boolean; playerAnswer: number | number[] }>;
  /** 推理得分 0-100 */
  reasoningScore: number;
  /** 是否已破案（reasoningScore >= 60） */
  caseSolved: boolean;
  /** 破局点是否被玩家选中 */
  breakingPointFound: boolean;
}
```

### 3.4 数据示例

```json
{
  "id": "DET-001",
  "typeId": "F87",
  "type": "DeepSeek大模型仿冒客服",
  "title": "案件 001：DeepSeek 客服来电关闭会员",
  "difficulty": 2,
  "briefing": "报警人张先生（45 岁，企业高管）称接到自称 DeepSeek 官方客服电话，称其账户被开通 Pro 会员每月扣费 800 元，需下载会议软件共享屏幕关闭。张先生按指引操作后，银行卡被盗刷 5 万元。请收集证据，还原诈骗剧本，定位破局点。",
  "victimProfileId": "TRUST",
  "evidenceReviewSec": 90,
  "evidences": [
    {
      "id": "EV-01",
      "kind": "call",
      "title": "来电记录与通话转录",
      "tag": "key",
      "payload": {
        "kind": "call",
        "callerNumber": "+8210-XXXX-XXXX",
        "duration": 14,
        "transcript": "您好，这里是 DeepSeek 官方客服，检测到您的账户被开通 Pro 会员每月扣费 800 元，为保障资金安全请按指引关闭，需下载会议软件共享屏幕。",
        "isSyntheticVoice": true
      },
      "revealedCues": ["AI 仿声", "扣费恐吓", "共享屏幕"]
    },
    {
      "id": "EV-02",
      "kind": "chat",
      "title": "与骗子聊天记录",
      "tag": "key",
      "payload": {
        "kind": "chat",
        "messages": [
          { "from": "scammer", "text": "您已开通 Pro 会员每月扣费 800 元，需关闭请按指引操作", "time": "14:01" },
          { "from": "me", "text": "怎么关闭？", "time": "14:02" },
          { "from": "scammer", "text": "下载腾讯会议输入会议号 888 888 888，开启屏幕共享", "time": "14:03" },
          { "from": "me", "text": "好的", "time": "14:04" },
          { "from": "scammer", "text": "请读出您手机收到的 6 位验证码 808823 完成身份核验", "time": "14:05" }
        ]
      },
      "revealedCues": ["屏幕共享", "验证码"]
    },
    {
      "id": "EV-03",
      "kind": "transfer",
      "title": "银行转账流水",
      "tag": "key",
      "payload": {
        "kind": "transfer",
        "flows": [
          { "from": "张先生招行 ****8821", "to": "境外账户 6228 **** **** ****", "amount": "50,000 元", "time": "14:08", "note": "转账备注：核验" }
        ]
      },
      "revealedCues": ["境外账户", "大额转账"]
    },
    {
      "id": "EV-04",
      "kind": "screenshot",
      "title": "DeepSeek 官方域名对比",
      "tag": "normal",
      "payload": {
        "kind": "screenshot",
        "desc": "骗子发送的'官方关闭链接'截图",
        "details": ["链接域名：deepsek-cancel.xyz", "官方域名：deepseek.com", "拼写差一个字母 e"],
        "tampered": false
      },
      "revealedCues": ["仿冒域名"]
    }
  ],
  "reasoningQuestions": [
    {
      "id": "RQ-01",
      "kind": "single",
      "stage": "identify",
      "question": "本案属于哪类诈骗？",
      "options": ["冒充公检法", "DeepSeek 大模型仿冒客服", "刷单返利", "杀猪盘"],
      "answer": 1,
      "explain": "骗子自称 DeepSeek 官方客服，借大模型热度仿冒，是 2026 年新型 AI 诈骗。"
    },
    {
      "id": "RQ-02",
      "kind": "multi",
      "stage": "locate",
      "question": "下列哪些是本案的致命红旗？（多选）",
      "options": ["AI 仿声专业客服音色", "要求共享屏幕", "要求读出验证码", "仿冒域名 deepsek-cancel.xyz", "自称金融监管单位"],
      "answers": [0, 1, 2, 3],
      "explain": "前 4 项均为本案致命红旗。第 5 项'金融监管单位'是冒充公检法话术，本案未出现。"
    },
    {
      "id": "RQ-03",
      "kind": "single",
      "stage": "locate",
      "question": "受害者被攻破的关键一步是？",
      "options": [
        "接听电话",
        "下载腾讯会议",
        "开启屏幕共享并读出验证码",
        "查看银行卡余额"
      ],
      "answer": 2,
      "explain": "屏幕共享+验证码泄露=骗子获得完整账户控制权，是盗刷的直接原因。"
      ],
      "lockOnWrong": true
    },
    {
      "id": "RQ-04",
      "kind": "sort",
      "stage": "reconstruct",
      "question": "请按时间顺序排列诈骗剧本步骤。",
      "options": [
        "骗子 AI 仿声自称 DeepSeek 客服",
        "恐吓'扣费 800 元'制造紧迫感",
        "诱导下载腾讯会议开启屏幕共享",
        "索要验证码完成'身份核验'",
        "骗子在共享屏幕上操作银行 APP 转账 5 万元"
      ],
      "sortCorrect": [0, 1, 2, 3, 4],
      "explain": "完整剧本：仿声→扣费恐吓→屏幕共享→验证码→盗刷。每一步都是破局窗口。"
    },
    {
      "id": "RQ-05",
      "kind": "single",
      "stage": "prevent",
      "question": "若张先生在以下哪一步操作，可完全避免损失？",
      "options": [
        "接听时挂断并拨打 DeepSeek 官方渠道核实",
        "下载腾讯会议但不开启屏幕共享",
        "开启屏幕共享但不读验证码",
        "读出验证码后立即挂断"
      ],
      "answer": 0,
      "explain": "挂断→官方渠道核实是唯一完全正确的做法。任何'共享屏幕+验证码'都是诈骗。"
    }
  ],
  "breakingPoint": {
    "evidenceIdx": 1,
    "innerIdx": 4,
    "desc": "第 5 条消息'请读出验证码'是诈骗核心动作——验证码一旦泄露，资金防线即刻失守。"
  },
  "caseSummary": {
    "timeline": [
      "14:00 骗子 AI 仿声自称 DeepSeek 客服来电",
      "14:01 恐吓'Pro 会员每月扣费 800 元'",
      "14:03 诱导下载腾讯会议开启屏幕共享",
      "14:05 索要验证码'完成身份核验'",
      "14:08 骗子在共享屏幕操作转账 5 万元"
    ],
    "psychology": ["authority", "fear", "urgency"],
    "lesson": "大模型官方不会要求共享屏幕，验证码绝不读给任何人。挂断→官方渠道核实是铁律。",
    "caseArchive": {
      "title": "DeepSeek 大模型仿冒客服诈骗案",
      "date": "2026-03",
      "source": "国家反诈中心通报",
      "takeaway": "大模型官方不会要求共享屏幕，会员管理走官方 APP。"
    }
  },
  "tags": ["AI 仿声", "DeepSeek", "共享屏幕", "验证码", "盗刷"],
  "updateDate": "2026-07",
  "severity": 5
}
```

### 3.5 冲突点处理

| 冲突 | 处理方式 |
|---|---|
| 与 evidence 题型重叠 | 保留 evidence 单题（8 道）作为 FraudBuster 内题型，detective 作为独立模式并存。evidence 复用 `FBEvidenceMessage` 数据结构作为 detective 的 chat 证据片段。 |
| 与 deconstruct 模式定位接近 | deconstruct 是被动观看剧本拆解，detective 是主动多源推理，玩法完全不同，并存。 |

### 3.6 实现要点

1. **新增数据文件**：`questions/detective-cases.json`，初始 6 个案件（覆盖 F01/F02/F03/F45/F78/F87 高发类型）
2. **新增引擎模块**：`v6Modes.ts`（detective runner），由 engine.ts 在 `gameMode === "detective"` 时委托调用
3. **新增场景**：`FBDetectiveScene.ts`，包含 4 个子阶段 UI（简报/证据浏览/推理问答/复盘）
4. **存档扩展**：`FBSaveData` 新增 `detectiveSolvedCases: string[]`（已破案 ID 列表）和 `detectiveScore: number`（累计推理分）
5. **模式注册**：`FB_MODE_LABELS` 增加 `detective: "反诈侦探"`，`FB_MODE_ICONS` 增加 `detective: "🔍"`

---

## 4. 方案 B：96110 劝阻员·对话博弈（persuader）

### 4.1 玩法核心

玩家扮演 96110 反诈专线劝阻员，接到预警系统提示后**主动拨出**电话给正在被骗的受害者，限时内通过对话说服对方挂断/停止转账。不同受害者有不同心理状态（信任骗子/被恐吓/贪婪/否认），需匹配话术。

与现有 hotline 的区别：
- hotline：受害者主动拨入 96110，接线员引导核实（玩家是受害者视角）
- persuader：96110 主动拨出劝阻受害者（玩家是劝阻员视角）

### 4.2 玩法流程

```
[预警列表] → [选择劝阻对象] → [受害者画像展示（心理状态）]
                                       ↓
                              [限时对话博弈（90 秒）]
                                       ↓
                       ┌───────────────┼───────────────┐
                       ↓               ↓               ↓
                  [劝阻成功]      [劝阻失败]       [超时]
                       ↓               ↓               ↓
                  [复盘：心理   [复盘：受害者   [复盘：时间
                   突破路径]     为何固执]       管理教训]
                       ↓               ↓               ↓
                              [归档（写入存档）]
```

### 4.3 数据结构（新增）

```typescript
// 新增到 types.ts

/** 96110 劝阻剧本（persuader 模式，劝阻员视角） */
export interface FBPersuaderScript {
  /** 剧本 ID（如 PRS-001） */
  id: string;
  /** 关联诈骗类型 ID */
  typeId: string;
  /** 诈骗类型名 */
  type: string;
  /** 剧本标题 */
  title: string;
  /** 难度 1-4 */
  difficulty: number;
  /** 预警场景描述（劝阻员接到的预警信息） */
  alertScenario: string;
  /** 受害者画像（复用 VICTIM_PROFILES 的 typeId） */
  victimProfileId: string;
  /** 受害者初始心理状态（0-100，越高越顽固） */
  victimResistance: number;
  /** 劝阻时限（秒，默认 90） */
  timeLimit: number;
  /** 受害者初始对白（接通电话后第一句） */
  victimOpening: string;
  /** 对话节点列表 */
  nodes: FBPersuaderNode[];
  /** 起始节点 ID */
  startNodeId: string;
  /** 通关条件：劝阻成功率阈值（0-1） */
  successThreshold: number;
}

/** 劝阻对话节点 */
export interface FBPersuaderNode {
  /** 节点 ID */
  id: string;
  /** 受害者台词 */
  victimLine: string;
  /** 受害者当前情绪标签（如"恐慌""愤怒""否认""犹豫""信任骗子"） */
  emotion: "panic" | "anger" | "deny" | "hesitate" | "trust_scammer" | "calm" | "grateful";
  /** 劝阻员可选话术列表 */
  choices: FBPersuaderChoice[];
}

/** 劝阻员话术选项 */
export interface FBPersuaderChoice {
  /** 话术文本 */
  text: string;
  /** 该话术的策略类型 */
  tactic: "empathy" | "authority" | "evidence" | "action" | "question" | "warn";
  /** 该话术对受害者抵抗值的影响（负数=降低抵抗，正数=激怒） */
  resistanceDelta: number;
  /** 下一节点 ID（null=对话结束） */
  nextNodeId?: string | null;
  /** 该话术的评价 */
  verdict?: "right" | "warn" | "wrong";
  /** 评价说明 */
  feedback?: string;
  /** 是否为终结节点 */
  ending?: "success" | "fail" | "timeout";
}

/** 劝阻模式 HUD 状态 */
export interface FBHudPersuaderState {
  /** 当前剧本 */
  scriptId: string;
  /** 剧本标题 */
  scriptTitle: string;
  /** 当前节点 ID */
  currentNodeId: string;
  /** 受害者当前抵抗值 0-100 */
  victimResistance: number;
  /** 受害者当前情绪 */
  victimEmotion: "panic" | "anger" | "deny" | "hesitate" | "trust_scammer" | "calm" | "grateful";
  /** 剩余秒数 */
  remainSec: number;
  /** 总时长 */
  totalSec: number;
  /** 已用轮次 */
  turnCount: number;
  /** 最大轮次 */
  maxTurns: number;
  /** 已发生对话轮次 */
  turns: Array<{ from: "victim" | "persuader"; text: string; emotion?: string; tactic?: string }>;
  /** 当前受害者台词 */
  currentVictimLine: string;
  /** 当前可选话术 */
  currentChoices: FBPersuaderChoice[];
  /** 是否已结束 */
  ended: boolean;
  /** 结局类型 */
  ending?: "success" | "fail" | "timeout";
  /** 结局说明 */
  endingDesc?: string;
  /** 劝阻成功率 0-1 */
  successRate: number;
}
```

### 4.4 数据示例

```json
{
  "id": "PRS-001",
  "typeId": "F01",
  "type": "冒充公检法",
  "title": "劝阻对象：被'刑侦支队'恐吓的母亲",
  "difficulty": 3,
  "alertScenario": "预警系统提示：王阿姨（62 岁，退休教师）正在与境外号码通话 8 分钟，疑似遭遇冒充公检法诈骗。请立即拨出劝阻。",
  "victimProfileId": "FEAR",
  "victimResistance": 85,
  "timeLimit": 90,
  "victimOpening": "你好？你是谁？我正在配合公安调查，没空接别的电话！",
  "nodes": [
    {
      "id": "n1",
      "victimLine": "你好？你是谁？我正在配合公安调查，没空接别的电话！",
      "emotion": "panic",
      "choices": [
        {
          "text": "王阿姨，我是 96110 反诈专线劝阻员，您正在遭遇诈骗！",
          "tactic": "authority",
          "resistanceDelta": -10,
          "nextNodeId": "n2",
          "verdict": "right",
          "feedback": "亮明身份+直接告知诈骗，是劝阻员标准开场。"
        },
        {
          "text": "阿姨您别怕，慢慢说，对方让您做什么？",
          "tactic": "empathy",
          "resistanceDelta": -5,
          "nextNodeId": "n2",
          "verdict": "warn",
          "feedback": "共情是好的，但未直接告知诈骗，受害者仍可能继续信任骗子。"
        },
        {
          "text": "您这是被骗了，立即挂断电话！",
          "tactic": "warn",
          "resistanceDelta": 5,
          "nextNodeId": "n3",
          "verdict": "wrong",
          "feedback": "命令式语气会激怒恐慌中的受害者，反而加强抵抗。"
        }
      ]
    },
    {
      "id": "n2",
      "victimLine": "96110？可是那个警官说涉嫌洗钱 200 万，让我把资金转'安全账户'清查……",
      "emotion": "panic",
      "choices": [
        {
          "text": "阿姨，公检法不电话办案，更不存在'安全账户'！这是诈骗铁律。",
          "tactic": "evidence",
          "resistanceDelta": -20,
          "nextNodeId": "n4",
          "verdict": "right",
          "feedback": "用反诈铁律直接打破话术，是关键劝阻动作。"
        },
        {
          "text": "您名下银行卡涉嫌洗钱？您最近有没有泄露过身份证？",
          "tactic": "question",
          "resistanceDelta": 0,
          "nextNodeId": "n3",
          "verdict": "warn",
          "feedback": "顺着骗子话术追问会强化受害者恐惧。"
        }
      ]
    },
    {
      "id": "n3",
      "victimLine": "你别说了！我必须证明清白，警官说案件保密不能告诉别人……",
      "emotion": "anger",
      "choices": [
        {
          "text": "保密要求是切断您求助渠道的话术，真警察办案不会禁止您告诉家人。",
          "tactic": "evidence",
          "resistanceDelta": -15,
          "nextNodeId": "n4",
          "verdict": "right",
          "feedback": "拆解'保密'话术是关键，让受害者意识到被操控。"
        },
        {
          "text": "阿姨您先冷静，深呼吸，跟我说说具体情况。",
          "tactic": "empathy",
          "resistanceDelta": -5,
          "nextNodeId": "n4",
          "verdict": "warn",
          "feedback": "情绪安抚有效，但未拆解话术，受害者仍可能继续操作。"
        }
      ]
    },
    {
      "id": "n4",
      "victimLine": "真的吗？可是对方准确报出了我的身份证号和家庭地址……",
      "emotion": "hesitate",
      "choices": [
        {
          "text": "身份证号泄露是黑产问题，但不能改变诈骗性质。请立即挂断电话，到就近派出所当面核实。",
          "tactic": "action",
          "resistanceDelta": -25,
          "nextNodeId": null,
          "ending": "success",
          "verdict": "right",
          "feedback": "拆解信息泄露迷思+给出可执行行动，是劝阻成功关键。"
        },
        {
          "text": "对方信息准确就说明是真的，您配合调查吧。",
          "tactic": "warn",
          "resistanceDelta": 30,
          "nextNodeId": null,
          "ending": "fail",
          "verdict": "wrong",
          "feedback": "致命错误！信息泄露≠诈骗属实，反而强化受害者信任骗子。"
        }
      ]
    }
  ],
  "startNodeId": "n1",
  "successThreshold": 0.3
}
```

### 4.5 冲突点处理

| 冲突 | 处理方式 |
|---|---|
| 与现有 hotline 重叠 | hotline 升级为"双向"模式：受害者拨入（现有 20 个剧本）+ 劝阻员拨出（新增 persuader 模式），两个子模式并存。UI 入口合并为"96110 反诈专线"，进入后选择"我是受害者"或"我是劝阻员"。 |
| 与 victimProfiles 重叠 | persuader 复用 VICTIM_PROFILES 的 typeId 作为受害者画像，不重复定义。 |

### 4.6 实现要点

1. **新增数据文件**：`questions/persuader-scripts.json`，初始 6 个剧本（覆盖 F01/F02/F03/F45/F78/F87 高发类型）
2. **新增引擎模块**：`v6Modes.ts` 增加 persuader runner
3. **新增场景**：`FBPersuaderScene.ts`，含受害者情绪可视化（恐慌红/愤怒紫/犹豫黄/平静绿）+ 限时进度条 + 抵抗值仪表
4. **hotline UI 改造**：`FBHotlineScene.ts` 入口增加"双向"切换，受害者拨入=原 hotline，劝阻员拨出=persuader
5. **存档扩展**：`FBSaveData` 新增 `persuaderSuccessCount: number`、`persuaderSolvedScripts: string[]`
6. **模式注册**：`FB_MODE_LABELS` 增加 `persuader: "96110 劝阻员"`，`FB_MODE_ICONS` 增加 `persuader: "📞"`

---

## 5. 方案 C：骗子模拟器·反转视角教学（scamSim）

### 5.1 玩法核心

玩家扮演"反诈训练模拟器"中的骗子角色（明确教学反向演练框架），从"骗子剧本库"中选择话术组合对 AI 受害者实施诈骗。AI 受害者根据心理弱点（来自 victimProfiles）做出反应。**失败/成功都会强制复盘骗术原理**，明确"不教唆"定位。

与现有 deconstruct 的区别：
- deconstruct：被动观看骗子剧本逐句拆解（教育属性强但互动弱）
- scamSim：主动操作话术选择，AI 受害者实时反应（沉浸感强，但需严格教学框架）

### 5.2 教学框架（防止教唆）

1. **入口警示**：进入模式前显示"本模式为反诈训练模拟器，目的是让你理解骗子手法以便识破，请勿用于实际操作"
2. **话术池限定**：所有话术来自现有 deconstruct 剧本（已脱敏），不可自由输入
3. **强制复盘**：每局结束后必须查看"骗术原理拆解"才能结算
4. **失败优先**：AI 受害者警觉度较高，玩家"诈骗成功"难度大，多数情况是"被识破"
5. **红色边框**：整个模式 UI 用红色警示边框，与正常模式视觉区分
6. **结算反向**：不奖励"诈骗成功"，而是奖励"识破的红旗数"

### 5.3 玩法流程

```
[教学警示] → [选择训练剧本] → [AI 受害者画像展示]
                                       ↓
                              [话术选择博弈（多轮）]
                                       ↓
                       ┌───────────────┼───────────────┐
                       ↓               ↓               ↓
                  [被识破]      [诈骗成功]       [超时]
                       ↓               ↓               ↓
                  [复盘：你    [复盘：AI    [复盘：时
                   的话术]    受害者弱点]    间管理]
                       ↓               ↓               ↓
                              [强制拆解骗术原理]
                                       ↓
                              [归档（写入存档）]
```

### 5.4 数据结构（新增）

```typescript
// 新增到 types.ts

/** 骗子模拟器训练剧本（scamSim 模式） */
export interface FBScamSimScenario {
  /** 剧本 ID（如 SS-001） */
  id: string;
  /** 关联诈骗类型 ID */
  typeId: string;
  /** 诈骗类型名 */
  type: string;
  /** 剧本标题 */
  title: string;
  /** 难度 1-4 */
  difficulty: number;
  /** 训练场景描述 */
  scenario: string;
  /** AI 受害者画像（复用 VICTIM_PROFILES 的 typeId） */
  victimProfileId: string;
  /** AI 受害者初始警觉度 0-100（越高越难骗） */
  victimAlertness: number;
  /** 受害者弱点列表（来自 victimProfile.weakness） */
  victimWeakness: FBPsychology[];
  /** 骗子可选话术池（按 tactic 分组） */
  scammerTactics: FBScamSimTactic[];
  /** 对话节点列表 */
  nodes: FBScamSimNode[];
  /** 起始节点 ID */
  startNodeId: string;
  /** 最大轮次 */
  maxTurns: number;
  /** 训练目标：玩家需识别的红旗数 */
  targetRedFlags: number;
}

/** 骗子话术组（按 tactic 分组，玩家从中选择） */
export interface FBScamSimTactic {
  /** 话术策略类型 */
  tactic: "buildTrust" | "createUrgency" | "promiseGain" | "createFear" | "isolate" | "collectInfo" | "induceAction";
  /** 该策略的中文标签 */
  label: string;
  /** 该策略对应的心理手法 */
  psychology: FBPsychology[];
  /** 该策略可选的具体话术 */
  lines: string[];
}

/** 骗子模拟器对话节点 */
export interface FBScamSimNode {
  /** 节点 ID */
  id: string;
  /** AI 受害者反应（针对上一轮话术） */
  victimResponse: string;
  /** 受害者警觉度变化（-10=放松，+10=警觉） */
  alertnessDelta: number;
  /** 受害者当前情绪 */
  emotion: "trusting" | "suspicious" | "afraid" | "greedy" | "resistant" | "busted";
  /** 该节点可选的话术组（引用 scammerTactics 的 tactic） */
  availableTactics: string[];
  /** 该节点是否触发红旗（玩家选了致命话术） */
  triggersRedFlag?: boolean;
  /** 红旗说明 */
  redFlagDesc?: string;
  /** 玩家选择的下一步 */
  choices: FBScamSimChoice[];
}

/** 骗子模拟器玩家选项 */
export interface FBScamSimChoice {
  /** 选择的 tactic */
  tactic: string;
  /** 选择的具体话术 */
  line: string;
  /** 下一节点 ID（null=对话结束） */
  nextNodeId?: string | null;
  /** 该话术是否被识破（AI 受害者识破） */
  busted?: boolean;
  /** 该话术的红旗等级 0-5 */
  redFlag?: number;
  /** 评价 */
  verdict?: "right" | "warn" | "wrong";
  /** 评价说明（教学反馈） */
  feedback?: string;
  /** 结局类型 */
  ending?: "busted" | "success" | "timeout";
}

/** 骗子模拟器 HUD 状态 */
export interface FBHudScamSimState {
  /** 当前剧本 */
  scenarioId: string;
  /** 剧本标题 */
  scenarioTitle: string;
  /** 当前节点 ID */
  currentNodeId: string;
  /** AI 受害者当前警觉度 0-100 */
  victimAlertness: number;
  /** AI 受害者当前情绪 */
  victimEmotion: "trusting" | "suspicious" | "afraid" | "greedy" | "resistant" | "busted";
  /** 玩家累计触发红旗数 */
  redFlagCount: number;
  /** 训练目标红旗数 */
  targetRedFlags: number;
  /** 已用轮次 */
  turnCount: number;
  /** 最大轮次 */
  maxTurns: number;
  /** 已发生对话轮次 */
  turns: Array<{ from: "scammer" | "victim"; text: string; tactic?: string; emotion?: string }>;
  /** 当前受害者反应 */
  currentVictimResponse: string;
  /** 当前可选话术组 */
  currentTactics: FBScamSimTactic[];
  /** 是否已结束 */
  ended: boolean;
  /** 结局类型 */
  ending?: "busted" | "success" | "timeout";
  /** 结局说明 */
  endingDesc?: string;
  /** 是否已查看复盘（必须查看才能结算） */
  debriefViewed: boolean;
}
```

### 5.5 数据示例（节选）

```json
{
  "id": "SS-001",
  "typeId": "F02",
  "type": "杀猪盘",
  "title": "训练 001：杀猪盘话术链训练",
  "difficulty": 3,
  "scenario": "AI 受害者是 30 岁单身男性，对情感慰藉敏感，对'内部投资消息'有好奇心。你的训练目标：识别杀猪盘的关键红旗（5 个），不要真正实施诈骗。",
  "victimProfileId": "INTIMACY",
  "victimAlertness": 60,
  "victimWeakness": ["intimacy", "greed", "trust"],
  "scammerTactics": [
    {
      "tactic": "buildTrust",
      "label": "建立人设",
      "psychology": ["intimacy", "curiosity"],
      "lines": [
        "你好呀，看你头像挺阳光的，喜欢健身吗？",
        "我是做金融分析的，平时工作忙但收入还行。",
        "这几天看你朋友圈挺压抑的，是不是工作不顺心？"
      ]
    },
    {
      "tactic": "promiseGain",
      "label": "利益诱惑",
      "psychology": ["greed", "scarcity"],
      "lines": [
        "我舅舅在金融监管单位，发现了系统漏洞，稳赚不赔。",
        "先 5000 试水，赚到钱你请我吃饭就行。",
        "加大投入博高收益，3 万返 5 万，机会难得。"
      ]
    },
    {
      "tactic": "isolate",
      "label": "孤立受害者",
      "psychology": ["fear", "conformity"],
      "lines": [
        "这件事千万不能告诉别人，监管查到就麻烦了。",
        "你别跟家里人商量，他们不懂这种内部机会。"
      ]
    },
    {
      "tactic": "induceAction",
      "label": "诱导转账",
      "psychology": ["urgency", "sunkCost"],
      "lines": [
        "提现需要缴 8% 个人所得税和 5000 反洗钱认证金。",
        "不继续转账，本金全部作废。"
      ]
    }
  ],
  "nodes": [
    {
      "id": "n1",
      "victimResponse": "（AI 受害者上线）你好，你是？",
      "alertnessDelta": 0,
      "emotion": "suspicious",
      "availableTactics": ["buildTrust"],
      "choices": [
        {
          "tactic": "buildTrust",
          "line": "你好呀，看你头像挺阳光的，喜欢健身吗？",
          "nextNodeId": "n2",
          "redFlag": 1,
          "verdict": "warn",
          "feedback": "话术红旗 1：陌生人过度热情+完美人设=剧本开端。"
        }
      ]
    },
    {
      "id": "n2",
      "victimResponse": "嗯，我平时也健身。你是做什么的？",
      "alertnessDelta": -5,
      "emotion": "trusting",
      "availableTactics": ["buildTrust", "promiseGain"],
      "choices": [
        {
          "tactic": "buildTrust",
          "line": "我是做金融分析的，平时工作忙但收入还行。",
          "nextNodeId": "n3",
          "redFlag": 2,
          "verdict": "warn",
          "feedback": "话术红旗 2：提前铺垫'金融'背景，为后续投资埋伏笔。"
        },
        {
          "tactic": "promiseGain",
          "line": "我舅舅在金融监管单位，发现了系统漏洞，稳赚不赔。",
          "nextNodeId": "n3",
          "redFlag": 5,
          "verdict": "wrong",
          "feedback": "致命红旗 5：'内部消息+稳赚不赔'是诈骗核心话术。AI 受害者此时应高度警觉。"
        }
      ]
    }
  ],
  "startNodeId": "n1",
  "maxTurns": 10,
  "targetRedFlags": 5
}
```

### 5.6 冲突点处理

| 冲突 | 处理方式 |
|---|---|
| 与 deconstruct 模式定位接近 | deconstruct 是被动观看拆解（教育属性强），scamSim 是主动操作话术（沉浸感强），并存。两者复用同一套剧本数据但玩法不同。 |
| 题材敏感 | 严格教学反向库 + 强制备盘 + 不教唆定位（见 5.2 教学框架）。UI 用红色警示边框，结算反向奖励"识破红旗数"而非"诈骗成功"。 |

### 5.7 实现要点

1. **新增数据文件**：`questions/scamsim-scenarios.json`，初始 6 个剧本（覆盖 F01/F02/F03/F45/F78/F87）
2. **新增引擎模块**：`v6Modes.ts` 增加 scamSim runner
3. **新增场景**：`FBScamSimScene.ts`，含红色警示边框 + AI 受害者警觉度仪表 + 话术池选择 UI
4. **入口警示**：进入模式前必须显示 `ModalConfirm` 教学警示，玩家确认后才能进入
5. **存档扩展**：`FBSaveData` 新增 `scamSimRedFlags: number`（累计识破红旗数）、`scamSimSolvedScenarios: string[]`
6. **模式注册**：`FB_MODE_LABELS` 增加 `scamSim: "骗子模拟器（教学）"`，`FB_MODE_ICONS` 增加 `scamSim: "🎭"`

---

## 6. 方案 D：反诈中心·经营模拟（manage）

### 6.1 玩法核心

玩家经营一家反诈中心，每天处理警情、分配警力资源、升级反诈系统、做社区宣传，目标是降低辖区诈骗发案率。每"周"为一个游戏周期，对应一个诈骗集团 Boss 出现。

与现有 manager 游戏的区别：
- manager：团建经理人类，竖屏部署+横屏战斗，聚焦战斗/团战
- manage：经营模拟，竖屏，聚焦资源分配+长期策略+发案率曲线

### 6.2 玩法流程

```
[辖区仪表盘] → [每日警情分配] → [警力部署] → [宣传策略] → [系统升级]
       ↓              ↓              ↓            ↓            ↓
   [发案率曲线]  [处理警情]    [消耗警力]   [提升免疫]   [提升能力]
       ↓              ↓              ↓            ↓            ↓
                  [日结算：发案率变化、损失金额、警力消耗]
                                       ↓
                              [周结算：诈骗集团 Boss 出现]
                                       ↓
                              [击败 Boss → 解锁下一周]
```

### 6.3 数据结构（新增）

```typescript
// 新增到 types.ts

/** 反诈中心经营模式（manage 模式） */
export interface FBManageState {
  /** 当前周次（1-based） */
  week: number;
  /** 当前日次（1-7） */
  day: number;
  /** 辖区名称 */
  districtName: string;
  /** 辖区人口（万人） */
  population: number;
  /** 当前发案率 0-100（越低越好） */
  fraudRate: number;
  /** 累计损失金额（万元） */
  totalLoss: number;
  /** 累计止损金额（万元） */
  totalSaved: number;
  /** 警力资源（点数） */
  policeForce: number;
  /** 最大警力上限 */
  maxPoliceForce: number;
  /** 反诈系统等级 1-5 */
  systemLevel: number;
  /** 社区宣传覆盖度 0-100 */
  propagandaCoverage: number;
  /** 反诈装备库存（复用 ITEM_UPGRADE_DEFS 改造为装备） */
  equipment: Record<FBManageEquipmentType, number>;
  /** 装备等级 */
  equipmentLevels: Record<FBManageEquipmentType, number>;
  /** 辖区反诈能力图谱（复用 FBKnowledgeGraph） */
  knowledgeGraph: FBKnowledgeGraph;
  /** 当前周期警情列表 */
  dailyAlerts: FBManageAlert[];
  /** 已处理警情数 */
  handledAlerts: number;
  /** 本周警情处理率 0-1 */
  weeklyHandleRate: number;
  /** 当前周诈骗集团 Boss（null=本周未出现） */
  currentBoss: FBBoss | null;
  /** 已击败 Boss 数 */
  defeatedBosses: number;
  /** 辖区评分 0-100 */
  districtScore: number;
  /** 游戏是否结束 */
  gameOver: boolean;
  /** 结局类型 */
  ending?: "excellent" | "good" | "pass" | "fail";
}

/** 反诈装备类型（改造自 ITEM_UPGRADE_DEFS） */
export type FBManageEquipmentType =
  | "patrolCar"     // 巡逻车（增加警力上限）
  | "warningSystem" // 预警系统（提前发现警情）
  | "propagandaKit" // 宣传物料（提升宣传覆盖度）
  | "trainingCourse"// 培训课程（提升警员能力）
  | "techSystem"    // 技术系统（提升识诈准确率）
  | "hotlineSeat";  // 96110 坐席（提升劝阻成功率）

/** 辖区警情（manage 模式） */
export interface FBManageAlert {
  /** 警情 ID */
  id: string;
  /** 警情类型（关联诈骗类型 typeId） */
  typeId: string;
  /** 警情标题（如"辖区居民接到冒充公检法电话"） */
  title: string;
  /** 警情描述 */
  desc: string;
  /** 紧急度 1-5 */
  urgency: number;
  /** 处理该警情所需警力 */
  requiredForce: number;
  /** 处理该警情所需装备（type 列表） */
  requiredEquipment?: FBManageEquipmentType[];
  /** 处理成功可止损金额（万元） */
  savedAmount: number;
  /** 不处理将损失金额（万元） */
  lossAmount: number;
  /** 警情处理时限（日次） */
  deadline: number;
  /** 是否已处理 */
  handled: boolean;
  /** 处理结果 */
  result?: "success" | "partial" | "fail";
  /** 处理该警情触发的问题（来自现有题库，玩家需答题才能成功处理） */
  questionIds: string[];
}

/** 经营模式 HUD 状态（精简版，供场景渲染） */
export interface FBHudManageState {
  /** 当前周次 */
  week: number;
  /** 当前日次 */
  day: number;
  /** 发案率 */
  fraudRate: number;
  /** 警力 */
  policeForce: number;
  /** 最大警力 */
  maxPoliceForce: number;
  /** 系统等级 */
  systemLevel: number;
  /** 宣传覆盖度 */
  propagandaCoverage: number;
  /** 今日警情列表 */
  todayAlerts: FBManageAlert[];
  /** 当前选中的警情（null=未选中） */
  selectedAlertId: string | null;
  /** 当前答题状态（处理警情时触发，null=无） */
  currentQuestion: FBQuestion | null;
  /** 当前题目索引 */
  currentQuestionIdx: number;
  /** 总题数 */
  totalQuestions: number;
  /** 是否在 Boss 战 */
  inBossBattle: boolean;
  /** Boss 状态 */
  boss?: FBBoss | null;
  /** Boss 当前血量 */
  bossHp?: number;
  /** Boss 最大血量 */
  bossMaxHp?: number;
  /** 辖区评分 */
  districtScore: number;
  /** 上日发案率变化（正=恶化，负=改善） */
  fraudRateDelta?: number;
  /** 上日损失金额 */
  yesterdayLoss?: number;
  /** 上日止损金额 */
  yesterdaySaved?: number;
  /** 是否在日结算 */
  inDaySettlement: boolean;
}
```

### 6.4 数据示例（节选）

```json
{
  "week": 1,
  "day": 1,
  "districtName": "城南街道",
  "population": 8.5,
  "fraudRate": 65,
  "totalLoss": 0,
  "totalSaved": 0,
  "policeForce": 20,
  "maxPoliceForce": 20,
  "systemLevel": 1,
  "propagandaCoverage": 30,
  "equipment": {
    "patrolCar": 2,
    "warningSystem": 1,
    "propagandaKit": 1,
    "trainingCourse": 0,
    "techSystem": 0,
    "hotlineSeat": 1
  },
  "equipmentLevels": {
    "patrolCar": 1,
    "warningSystem": 1,
    "propagandaKit": 1,
    "trainingCourse": 0,
    "techSystem": 0,
    "hotlineSeat": 1
  },
  "dailyAlerts": [
    {
      "id": "MA-001",
      "typeId": "F01",
      "title": "居民张阿姨接到冒充公检法电话",
      "desc": "辖区居民张阿姨（62 岁）接到自称刑侦支队电话，称其涉嫌洗钱，要求转账到'安全账户'。预警系统已识别，请立即派警力劝阻。",
      "urgency": 5,
      "requiredForce": 3,
      "requiredEquipment": ["hotlineSeat"],
      "savedAmount": 30,
      "lossAmount": 30,
      "deadline": 1,
      "handled": false,
      "questionIds": ["F01-001", "F01-002", "F01-003"]
    },
    {
      "id": "MA-002",
      "typeId": "F02",
      "title": "辖区王先生疑似遭遇杀猪盘",
      "desc": "辖区王先生（35 岁）近日频繁向陌生账户转账，疑似被网友诱导投资。请派警力上门劝阻。",
      "urgency": 4,
      "requiredForce": 4,
      "requiredEquipment": ["patrolCar"],
      "savedAmount": 50,
      "lossAmount": 50,
      "deadline": 2,
      "handled": false,
      "questionIds": ["F02-001", "F02-002"]
    },
    {
      "id": "MA-003",
      "typeId": "F87",
      "title": "DeepSeek 仿冒客服诈骗集中爆发",
      "desc": "今日辖区多名居民接到自称 DeepSeek 客服电话，要求共享屏幕关闭会员。请加强宣传预警。",
      "urgency": 3,
      "requiredForce": 2,
      "requiredEquipment": ["propagandaKit"],
      "savedAmount": 20,
      "lossAmount": 20,
      "deadline": 3,
      "handled": false,
      "questionIds": ["F87-001", "F87-003"]
    }
  ],
  "handledAlerts": 0,
  "weeklyHandleRate": 0,
  "currentBoss": null,
  "defeatedBosses": 0,
  "districtScore": 50,
  "gameOver": false
}
```

### 6.5 冲突点处理

| 冲突 | 处理方式 |
|---|---|
| 与 manager 游戏冲突 | manage 融入 FraudBuster 为新模式，manager 游戏保留不动。两者定位不同：manager=战斗团战，manage=经营策略。 |
| 与现有 FBKnowledgeGraph 重叠 | manage 直接复用 FBKnowledgeGraph 作为"辖区反诈能力图谱"，节点代表辖区各类反诈能力维度。 |
| 与现有 items 道具系统重叠 | manage 不复用 items 数据，而是新增 FBManageEquipmentType（6 种装备），与原道具系统并存。 |
| 与现有 tasks 任务系统重叠 | manage 不复用 DAILY_TASK_POOL，而是用辖区警情（FBManageAlert）作为任务源。 |

### 6.6 实现要点

1. **新增数据文件**：`data/manageConfig.ts`（装备定义、辖区配置、Boss 周期表），`questions/manage-alerts.json`（警情池）
2. **新增引擎模块**：`v6Modes.ts` 增加 manage runner
3. **新增场景**：`FBManageScene.ts`，含辖区仪表盘 + 警情列表 + 装备升级 + 日/周结算
4. **题库联动**：处理警情时从现有 QUESTION_BANK 抽取对应 typeId 的题目，玩家答对即成功处理
5. **存档扩展**：`FBSaveData` 新增 `manageSave: { week, day, districtScore, defeatedBosses }`
6. **模式注册**：`FB_MODE_LABELS` 增加 `manage: "反诈中心"`，`FB_MODE_ICONS` 增加 `manage: "🏢"`

---

## 7. 实施顺序与里程碑

按用户确认的 **A → B → C → D** 顺序实施，复用数据量从多到少、风险从低到高。

### 7.1 里程碑

| 里程碑 | 内容 | 依赖 |
|---|---|---|
| **M1：方案 A 反诈侦探** | detective 模式完整实现（数据结构+引擎+场景+6 案件） | 复用 caseArchives + evidence + deconstruct |
| **M2：方案 B 96110 劝阻员** | persuader 模式完整实现 + hotline 双向化改造 | 复用 FBHotlineScript + victimProfiles |
| **M3：方案 C 骗子模拟器** | scamSim 模式完整实现（含教学框架+红色警示 UI） | 复用 deconstruct + victimProfiles |
| **M4：方案 D 反诈中心经营** | manage 模式完整实现（含装备系统+警情池+Boss 周期） | 复用 knowledgeGraph + 题库 |

### 7.2 每个里程碑的产出

每个里程碑交付：
1. 数据文件（JSON/TS）
2. 引擎模块（v6Modes.ts 增量）
3. 场景文件（FBXxxScene.ts）
4. 类型定义（types.ts 增量）
5. 存档扩展（storage.ts 增量）
6. 模式注册（modes.ts 增量）
7. 模式入口（GameShellScene / HubScene 入口添加）

---

## 8. 风险与待确认事项

### 8.1 已识别风险

| 风险 | 等级 | 缓解措施 |
|---|---|---|
| 方案 C 题材敏感被误解为教唆 | 高 | 严格教学框架（见 5.2），红色警示边框，强制复盘，结算反向奖励"识破红旗数" |
| 4 模式工作量巨大，开发周期长 | 高 | 严格按 M1-M4 里程碑推进，每个里程碑独立可玩可发布 |
| FraudBuster 模式数从 9 增至 13，UI 入口拥挤 | 中 | 模式选择页改为分类展示（核心答题 / 推理博弈 / 模拟经营） |
| manage 模式与 manager 游戏命名混淆 | 中 | manage 中文名"反诈中心"，manager 中文名"反诈职业经理人"，UI 强区分 |
| detective 与 evidence 数据结构相似，开发时易混淆 | 低 | detective 强制多源证据（≥3 类），evidence 保持单题单源，数据结构隔离 |

### 8.2 待用户确认事项

1. **detective 初始案件数量**：建议 6 个（覆盖 F01/F02/F03/F45/F78/F87），是否需要更多？
2. **persuader 初始剧本数量**：建议 6 个（覆盖 F01/F02/F03/F45/F78/F87），是否需要更多？
3. **scamSim 教学警示文案**：是否需要法务/合规审阅？
4. **manage 单局周期**：建议 4 周（28 天）为一局，是否合适？
5. **新模式是否接入赛季经验**：建议接入（与现有 season 系统打通），是否同意？
6. **新模式是否接入成就系统**：建议每个模式新增 2-3 个成就，是否同意？

---

## 9. 文件清单（实施时新增/修改）

### 9.1 新增文件

```
src/games/fraudBuster/
├── questions/
│   ├── detective-cases.json      ← M1
│   ├── persuader-scripts.json    ← M2
│   ├── scamsim-scenarios.json    ← M3
│   └── manage-alerts.json        ← M4
├── data/
│   └── manageConfig.ts           ← M4
├── v6Modes.ts                    ← M1-M4 增量
└── scenes/（实际位于 src/scenes/）
    ├── FBDetectiveScene.ts       ← M1
    ├── FBPersuaderScene.ts       ← M2
    ├── FBScamSimScene.ts         ← M3
    └── FBManageScene.ts          ← M4
```

### 9.2 修改文件

```
src/games/fraudBuster/
├── types.ts                      ← 增量新增 4 模式类型定义
├── storage.ts                    ← 增量新增 4 模式存档字段
├── data/modes.ts                 ← 增量新增 4 模式注册
├── engine.ts                     ← 增量委托 v6Modes
└── scenes/
    ├── FBHotlineScene.ts         ← M2 改造为双向
    ├── HubScene.ts               ← 增量新增 4 模式入口
    └── GameShellScene.ts         ← 增量模式分类展示
```

---

## 10. 验收标准

每个里程碑完成后需满足：

1. **可玩性**：模式可从主菜单进入，完整玩通一局
2. **数据正确**：复用现有数据无冲突，新增数据结构完整
3. **存档生效**：进度写入 localStorage，重启后可恢复
4. **教育属性**：每局结束有复盘/拆解/教训展示
5. **模式注册**：在 modes.ts 中正确注册，模式选择页可见
6. **不破坏现有**：现有 9 模式与教育功能不受影响
7. **构建通过**：`pnpm build` 无 TypeScript 错误
