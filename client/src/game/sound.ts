let ctx: AudioContext | undefined;
let noise: AudioBuffer | undefined;
let enabled = (() => {
  try {
    return localStorage.getItem("swoosh-sound") !== "off";
  } catch {
    return true;
  }
})();
export function setSound(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem("swoosh-sound", on ? "on" : "off");
  } catch {
    /* Preference stays for this page only. */
  }
  if (on) play("pop");
}
export const soundEnabled = () => enabled;
/** The one shared audio context (effects and background music). */
export function audio() {
  ctx ??= new AudioContext();
  void ctx.resume();
  return ctx;
}

function tone(
  a: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  start: number,
  length: number,
  volume: number,
) {
  const o = a.createOscillator(),
    g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, start);
  o.frequency.exponentialRampToValueAtTime(to, start + length);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  g.gain.setValueAtTime(volume, start + length * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  o.connect(g).connect(a.destination);
  o.start(start);
  o.stop(start + length + 0.02);
}

function hiss(a: AudioContext, start: number, length: number, volume: number) {
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = a.createBufferSource(),
    f = a.createBiquadFilter(),
    g = a.createGain();
  s.buffer = noise;
  f.type = "bandpass";
  f.frequency.value = 900;
  f.Q.value = 0.8;
  g.gain.setValueAtTime(volume, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  s.connect(f).connect(g).connect(a.destination);
  s.start(start);
  s.stop(start + length);
}

/** Small synthesized effects: no audio files to download. */
export function play(kind = "pop") {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    const a = ctx,
      now = a.currentTime;
    switch (kind) {
      case "launch":
        tone(a, "sine", 180, 1200, now, 0.28, 0.07);
        break;
      case "fill":
        tone(a, "triangle", 660, 990, now, 0.12, 0.08);
        break;
      case "land":
        tone(a, "sine", 320, 120, now, 0.16, 0.12);
        break;
      case "boing":
        tone(a, "triangle", 260, 620, now, 0.18, 0.08);
        tone(a, "triangle", 620, 300, now + 0.16, 0.16, 0.06);
        break;
      case "bell":
        tone(a, "sine", 1320, 1310, now, 0.35, 0.07);
        tone(a, "sine", 1320, 1310, now + 0.3, 0.45, 0.07);
        break;
      case "horn":
        for (const t of [0, 0.42]) {
          tone(a, "sawtooth", 392, 388, now + t, 0.34, 0.035);
          tone(a, "sawtooth", 494, 490, now + t, 0.34, 0.03);
        }
        hiss(a, now, 0.6, 0.05);
        break;
      case "chug":
        hiss(a, now, 0.12, 0.06);
        break;
      case "metro":
        // Little arrival melody.
        [659, 784, 988, 784, 1175].forEach((f, i) =>
          tone(a, "triangle", f, f, now + i * 0.18, 0.22, 0.06),
        );
        break;
      case "chime":
        tone(a, "sine", 988, 985, now, 0.5, 0.08);
        tone(a, "sine", 784, 780, now + 0.45, 0.7, 0.08);
        break;
      case "doorBeep":
        for (const t of [0, 0.25, 0.5])
          tone(a, "square", 1400, 1400, now + t, 0.12, 0.03);
        break;
      case "whoosh":
        hiss(a, now, 0.9, 0.05);
        tone(a, "sine", 90, 140, now, 0.9, 0.06);
        break;
      case "rumble":
        tone(a, "sine", 60, 55, now, 0.35, 0.05);
        break;
      case "spaceBeep":
        [880, 1320, 1760].forEach((f, i) =>
          tone(a, "square", f, f, now + i * 0.09, 0.08, 0.03),
        );
        break;
      case "liftoff":
        hiss(a, now, 2.4, 0.09);
        tone(a, "sawtooth", 60, 180, now, 2.4, 0.05);
        tone(a, "sine", 220, 880, now + 0.2, 2.0, 0.04);
        break;
      case "landing":
        hiss(a, now, 1.8, 0.07);
        tone(a, "sine", 700, 160, now, 1.8, 0.05);
        break;
      case "hum":
        tone(a, "sine", 110, 118, now, 0.6, 0.025);
        break;
      case "metroHorn":
        tone(a, "triangle", 523, 520, now, 0.35, 0.06);
        tone(a, "triangle", 659, 655, now, 0.35, 0.05);
        break;
      default:
        tone(a, "sine", 520, 260, now, 0.22, 0.07);
    }
  } catch {
    /* Muted/unsupported audio never interrupts play. */
  }
}
