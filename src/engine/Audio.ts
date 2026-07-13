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
  | "tick";

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
}

export function isMuted(): boolean {
  return muted;
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
  }
}
