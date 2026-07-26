import { createAudioContext } from "@/platform/web";

type SfxName =
  | "click"
  | "good"
  | "bad"
  | "explode"
  | "shoot"
  | "hit"
  | "pickup"
  | "bomb"
  | "boss"
  | "win"
  | "lose"
  | "tick"
  | "phase"        // 阶段切换（新增）
  | "achievement"  // 成就解锁（新增）
  | "weaponUp"     // 武器升级（新增）
  | "timeSlow"     // 时间减速（新增）
  | "laser"        // 激光扫射（新增）
  | "shieldBreak"  // 护盾击破（新增）
  | "ultimate"      // 连击大招释放（包C）
  | "comboTier"     // 连击色阶升级（包C）
  | "cardFlip"      // 卡片翻转（包F 3D 翻转）
  | "achievementUnlock" // 成就解锁（包E）
  | "rankUp"        // 段位晋级（包E）
  | "wrongRecord"   // 错题记录（包D）
  | "bossSkill"     // Boss 技能触发
  | "specialEvent";  // 特殊波次事件

/** v2：BGM 曲目名 */
export type BgmName = "hub" | "battle" | "tense" | "bossBattle" | "ultReady" | "none";

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (!ctx) {
    ctx = createAudioContext();
    if (!ctx) return null;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(v: boolean): void {
  muted = v;
  if (muted) stopBGM();
}

export function isMuted(): boolean {
  return muted;
}

// ============ v2：BGM 系统 ============

/** BGM 音轨定义：根音 + 音阶 + 节奏 + 音色 */
interface BgmTrack {
  name: Exclude<BgmName, "none">;
  bpm: number;
  root: number;          // 根音频率
  scale: number[];       // 半音偏移
  pattern: number[];     // 音阶索引序列（-1 = 休止）
  bassPattern: number[]; // 贝斯音阶索引序列
  oscType: OscillatorType;
  bassType: OscillatorType;
}

const BGM_TRACKS: Record<Exclude<BgmName, "none">, BgmTrack> = {
  // Hub：舒缓 cyber 氛围，A 小调五声
  hub: {
    name: "hub", bpm: 90, root: 220,
    scale: [0, 3, 5, 7, 10], // 小调五声
    pattern: [0, 2, 3, 2, 4, 3, 2, 0, -1, 0, 2, -1, 3, 2, 0, -1],
    bassPattern: [0, -1, -1, 0, -1, -1, 0, -1],
    oscType: "triangle",
    bassType: "sine",
  },
  // Battle：紧凑进行感，D 小调
  battle: {
    name: "battle", bpm: 132, root: 147,
    scale: [0, 2, 3, 5, 7, 8, 10], // 自然小调
    pattern: [0, 2, 4, 3, 2, 4, 5, 4, 0, 2, 4, 3, 2, 0, -1, -1],
    bassPattern: [0, 0, -1, 0, 4, -1, 4, -1],
    oscType: "square",
    bassType: "sawtooth",
  },
  // Tense：低沉悬疑，E 小调
  tense: {
    name: "tense", bpm: 70, root: 165,
    scale: [0, 2, 3, 5, 6, 8, 10],
    pattern: [0, -1, -1, 2, -1, -1, 3, -1, -1, 2, -1, 0, -1, -1, -1, -1],
    bassPattern: [0, -1, -1, -1, 0, -1, -1, -1],
    oscType: "sine",
    bassType: "triangle",
  },
  // BossBattle：紧张激烈的 Boss 战氛围，C 自然小调
  bossBattle: {
    name: "bossBattle", bpm: 145, root: 130,
    scale: [0, 2, 3, 5, 7, 8, 10], // 自然小调
    pattern: [0, -1, 3, 4, -1, 3, 0, 4, 5, -1, 4, 3, -1, 5, 4, -1],
    bassPattern: [0, 0, -1, 0, 4, -1, 0, 4],
    oscType: "sawtooth",
    bassType: "square",
  },
  // UltReady：神秘就绪氛围，G 大调五声
  ultReady: {
    name: "ultReady", bpm: 100, root: 196,
    scale: [0, 2, 4, 7, 9], // 大调五声
    pattern: [0, 2, 4, 2, 4, 5, 4, 2, 0, 2, 4, 5, 4, 2, 0, -1],
    bassPattern: [0, -1, -1, 0, -1, -1, 0, -1],
    oscType: "triangle",
    bassType: "sine",
  },
};

let bgmGain: GainNode | null = null;
let bgmSchedulerId: number | null = null;
let bgmCurrentTrack: BgmTrack | null = null;
let bgmNextNoteTime = 0;
let bgmStep = 0;
let bgmVolume = 0.12;

/** 调度器：提前 0.2s 安排下一个音符 */
function bgmSchedule(): void {
  if (!ctx || !bgmGain || !bgmCurrentTrack || muted) return;
  const lookahead = 0.2;
  const stepDur = 60 / bgmCurrentTrack.bpm / 2; // 八分音符

  while (bgmNextNoteTime < ctx.currentTime + lookahead) {
    const track = bgmCurrentTrack;
    const stepIdx = bgmStep % track.pattern.length;
    const bassIdx = bgmStep % track.bassPattern.length;

    // 主旋律
    const note = track.pattern[stepIdx];
    if (note >= 0) {
      const semitone = track.scale[note % track.scale.length] + 12 * Math.floor(note / track.scale.length);
      const freq = track.root * Math.pow(2, semitone / 12);
      scheduleBgmNote(freq, bgmNextNoteTime, stepDur * 0.9, track.oscType, 0.5);
    }

    // 贝斯（每两步触发一次）
    if (bgmStep % 2 === 0) {
      const bNote = track.bassPattern[bassIdx];
      if (bNote >= 0) {
        const semitone = track.scale[bNote % track.scale.length] - 12;
        const freq = track.root * Math.pow(2, semitone / 12);
        scheduleBgmNote(freq, bgmNextNoteTime, stepDur * 1.6, track.bassType, 0.7);
      }
    }

    bgmNextNoteTime += stepDur;
    bgmStep++;
  }
  bgmSchedulerId = window.setTimeout(bgmSchedule, 50);
}

function scheduleBgmNote(freq: number, time: number, dur: number, type: OscillatorType, vol: number): void {
  if (!ctx || !bgmGain) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(bgmVolume * vol, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(g);
  g.connect(bgmGain);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

export function startBGM(name: BgmName): void {
  if (muted || name === "none") {
    stopBGM();
    return;
  }
  const track = BGM_TRACKS[name];
  if (!track) return;
  // 已在播同一首：不重启
  if (bgmCurrentTrack && bgmCurrentTrack.name === name && bgmSchedulerId !== null) return;

  stopBGM();
  const c = getCtx();
  if (!c) return;
  bgmGain = c.createGain();
  bgmGain.gain.setValueAtTime(0, c.currentTime);
  bgmGain.gain.linearRampToValueAtTime(1, c.currentTime + 0.5); // 淡入
  bgmGain.connect(c.destination);
  bgmCurrentTrack = track;
  bgmStep = 0;
  bgmNextNoteTime = c.currentTime + 0.1;
  bgmSchedule();
}

export function stopBGM(): void {
  if (bgmSchedulerId !== null) {
    clearTimeout(bgmSchedulerId);
    bgmSchedulerId = null;
  }
  if (bgmGain && ctx) {
    // 淡出后断开
    const g = bgmGain;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    setTimeout(() => { try { g.disconnect(); } catch { /* noop */ } }, 400);
  }
  bgmGain = null;
  bgmCurrentTrack = null;
  bgmStep = 0;
}

export function setBGMVolume(v: number): void {
  bgmVolume = Math.max(0, Math.min(0.3, v));
  if (bgmGain && ctx) {
    bgmGain.gain.setValueAtTime(bgmVolume, ctx.currentTime);
  }
}

export function isBGMPlaying(): boolean {
  return bgmSchedulerId !== null;
}

interface ToneOpts {
  freq: number;
  type?: OscillatorType;
  duration?: number;
  gain?: number;
  attack?: number;
  release?: number;
  freqEnd?: number;
}

function playTone(opts: ToneOpts): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const {
    freq,
    type = "sine",
    duration = 0.18,
    gain = 0.18,
    attack = 0.005,
    release = duration,
    freqEnd,
  } = opts;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
  }
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(now);
  osc.stop(now + attack + release + 0.02);
}

function playNoise(duration: number, gain = 0.2, filter = 1500): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  const bp = c.createBiquadFilter();
  bp.type = "lowpass";
  bp.frequency.value = filter;
  src.connect(bp);
  bp.connect(g);
  g.connect(c.destination);
  src.start(now);
  src.stop(now + duration);
}

export function playSfx(name: SfxName): void {
  switch (name) {
    case "click":
      playTone({ freq: 660, type: "square", duration: 0.05, gain: 0.08 });
      break;
    case "tick":
      playTone({ freq: 880, type: "sine", duration: 0.03, gain: 0.05 });
      break;
    case "good":
      playTone({ freq: 660, type: "sine", duration: 0.08, gain: 0.15 });
      setTimeout(() => playTone({ freq: 880, type: "sine", duration: 0.12, gain: 0.15 }), 70);
      break;
    case "bad":
      playTone({ freq: 220, type: "sawtooth", duration: 0.25, gain: 0.18, freqEnd: 110 });
      break;
    case "shoot":
      playTone({ freq: 1200, type: "square", duration: 0.04, gain: 0.05, freqEnd: 600 });
      break;
    case "hit":
      playTone({ freq: 180, type: "sawtooth", duration: 0.08, gain: 0.12, freqEnd: 80 });
      break;
    case "explode":
      playNoise(0.35, 0.25, 1800);
      playTone({ freq: 100, type: "sawtooth", duration: 0.3, gain: 0.15, freqEnd: 40 });
      break;
    case "pickup":
      playTone({ freq: 980, type: "sine", duration: 0.08, gain: 0.15 });
      setTimeout(() => playTone({ freq: 1320, type: "sine", duration: 0.1, gain: 0.15 }), 50);
      break;
    case "bomb":
      playNoise(0.6, 0.3, 800);
      playTone({ freq: 80, type: "sawtooth", duration: 0.5, gain: 0.2, freqEnd: 30 });
      break;
    case "boss":
      playTone({ freq: 200, type: "sawtooth", duration: 0.6, gain: 0.2, freqEnd: 600 });
      setTimeout(() => playTone({ freq: 300, type: "square", duration: 0.4, gain: 0.15, freqEnd: 500 }), 200);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => playTone({ freq: f, type: "triangle", duration: 0.18, gain: 0.18 }), i * 120)
      );
      break;
    case "lose":
      [440, 330, 220, 165].forEach((f, i) =>
        setTimeout(() => playTone({ freq: f, type: "sawtooth", duration: 0.22, gain: 0.15 }), i * 130)
      );
      break;
    case "phase":
      // 阶段切换：低频 → 高频上扬 + 共鸣
      playTone({ freq: 110, type: "sawtooth", duration: 0.4, gain: 0.2, freqEnd: 440 });
      setTimeout(() => playTone({ freq: 220, type: "square", duration: 0.3, gain: 0.15, freqEnd: 660 }), 80);
      playNoise(0.2, 0.15, 2400);
      break;
    case "achievement":
      // 成就解锁：欢快上行琶音
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        setTimeout(() => playTone({ freq: f, type: "triangle", duration: 0.16, gain: 0.16 }), i * 80)
      );
      break;
    case "weaponUp":
      // 武器升级：金属感双音 + 拨弦
      playTone({ freq: 880, type: "square", duration: 0.08, gain: 0.12 });
      setTimeout(() => playTone({ freq: 1320, type: "square", duration: 0.12, gain: 0.14 }), 60);
      setTimeout(() => playTone({ freq: 1760, type: "triangle", duration: 0.18, gain: 0.12 }), 140);
      break;
    case "timeSlow":
      // 时间减速：下行 sweep + 拖尾
      playTone({ freq: 1200, type: "sine", duration: 0.6, gain: 0.18, freqEnd: 200 });
      playNoise(0.4, 0.1, 600);
      break;
    case "laser":
      // 激光扫射：高频持续 + 调制
      playTone({ freq: 2400, type: "sawtooth", duration: 0.25, gain: 0.12, freqEnd: 800 });
      playTone({ freq: 1600, type: "sine", duration: 0.2, gain: 0.08, freqEnd: 600 });
      break;
    case "shieldBreak":
      // 护盾击破：玻璃碎裂感
      playNoise(0.18, 0.18, 3200);
      playTone({ freq: 1800, type: "triangle", duration: 0.12, gain: 0.12, freqEnd: 600 });
      break;
    case "ultimate":
      // 连击大招释放：三连上行 sweep + 共鸣
      [330, 440, 660].forEach((f, i) =>
        setTimeout(() => playTone({ freq: f, type: "triangle", duration: 0.18, gain: 0.2 }), i * 60)
      );
      playNoise(0.3, 0.12, 2000);
      break;
    case "comboTier":
      // 连击色阶升级：单音上行 sweep
      playTone({ freq: 880, type: "triangle", duration: 0.15, gain: 0.15, freqEnd: 1320 });
      break;
    case "cardFlip":
      // 卡片翻转：短促双音
      playTone({ freq: 600, type: "square", duration: 0.04, gain: 0.08, freqEnd: 900 });
      setTimeout(() => playTone({ freq: 1000, type: "square", duration: 0.05, gain: 0.06, freqEnd: 700 }), 30);
      break;
    case "achievementUnlock":
      // 成就解锁：五音上行琶音
      [523, 659, 784, 988, 1175].forEach((f, i) =>
        setTimeout(() => playTone({ freq: f, type: "triangle", duration: 0.14, gain: 0.16 }), i * 70)
      );
      break;
    case "rankUp":
      // 段位晋级：宏伟上行 + 末尾长音
      [392, 523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => playTone({ freq: f, type: "triangle", duration: 0.2, gain: 0.18 }), i * 100)
      );
      setTimeout(() => playTone({ freq: 1568, type: "sine", duration: 0.4, gain: 0.12 }), 5 * 100);
      break;
    case "wrongRecord":
      // 错题记录：下行 sad tone
      [440, 330, 247].forEach((f, i) =>
        setTimeout(() => playTone({ freq: f, type: "sine", duration: 0.2, gain: 0.12 }), i * 130)
      );
      break;
    case "bossSkill":
      // Boss 技能：低频威胁 + 噪声
      playTone({ freq: 110, type: "sawtooth", duration: 0.3, gain: 0.2, freqEnd: 220 });
      playNoise(0.2, 0.1, 800);
      break;
    case "specialEvent":
      // 特殊事件：神秘提示 + 短 ping
      playTone({ freq: 660, type: "sine", duration: 0.25, gain: 0.15, freqEnd: 990 });
      setTimeout(() => playTone({ freq: 1320, type: "triangle", duration: 0.1, gain: 0.1 }), 150);
      break;
  }
}
