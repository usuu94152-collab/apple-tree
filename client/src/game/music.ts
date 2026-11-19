// Background music in the spirit of a theme-park band organ, composed for this app
// and played live with Web Audio (no audio files). Two original tunes:
// a carousel waltz for the outdoor station and a bouncy march for the subway.
import { audio } from "./sound";

type Chord = "C" | "F" | "G7" | "Am" | "Dm" | "E7" | "D7";
interface Tune {
  bpm: number;
  /** Beats per bar: 3 = waltz (oom-pah-pah), 4 = march (oom-pah). */
  meter: 3 | 4;
  chords: Chord[];
  /** Melody as [note, beats]; "-" is a rest. */
  melody: [string, number][];
}
interface Note {
  t: number;
  dur: number;
  freq: number;
  voice: "lead" | "bell" | "chord" | "bass" | "kick" | "snare" | "block";
}

const CHORDS: Record<Chord, string[]> = {
  C: ["C", "E", "G"],
  F: ["F", "A", "C"],
  G7: ["G", "B", "D", "F"],
  Am: ["A", "C", "E"],
  Dm: ["D", "F", "A"],
  E7: ["E", "G#", "B", "D"],
  D7: ["D", "F#", "A", "C"],
};
const SEMI: Record<string, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};
const freq = (name: string, octave?: number) => {
  const m = /^([A-G]#?)(\d)?$/.exec(name)!;
  const o = octave ?? Number(m[2]);
  return 440 * Math.pow(2, (SEMI[m[1]] + (o + 1) * 12 - 69) / 12);
};

/** Carousel waltz: a merry-go-round on a summer afternoon. */
const waltz: Tune = {
  bpm: 168,
  meter: 3,
  chords: [
    "C",
    "C",
    "G7",
    "G7",
    "G7",
    "G7",
    "C",
    "C",
    "F",
    "F",
    "C",
    "Am",
    "Dm",
    "G7",
    "C",
    "C",
    "Am",
    "Am",
    "E7",
    "E7",
    "Dm",
    "G7",
    "C",
    "C",
    "F",
    "F",
    "C",
    "Am",
    "D7",
    "G7",
    "C",
    "C",
  ],
  melody: [
    ["E4", 1],
    ["G4", 1],
    ["C5", 1],
    ["E5", 2],
    ["D5", 1],
    ["C5", 1],
    ["B4", 1],
    ["D5", 1],
    ["G4", 3],
    ["F4", 1],
    ["G4", 1],
    ["B4", 1],
    ["D5", 2],
    ["C5", 1],
    ["B4", 1],
    ["C5", 1],
    ["E5", 1],
    ["C5", 3],
    ["A4", 1],
    ["C5", 1],
    ["F5", 1],
    ["A5", 2],
    ["G5", 1],
    ["E5", 1],
    ["G5", 1],
    ["E5", 1],
    ["C5", 2],
    ["E5", 1],
    ["D5", 1],
    ["E5", 1],
    ["F5", 1],
    ["G5", 1],
    ["F5", 1],
    ["D5", 1],
    ["E5", 1],
    ["D5", 1],
    ["B4", 1],
    ["C5", 3],
    ["E5", 1],
    ["D5", 1],
    ["C5", 1],
    ["A4", 3],
    ["B4", 1],
    ["C5", 1],
    ["D5", 1],
    ["G#4", 3],
    ["A4", 1],
    ["B4", 1],
    ["C5", 1],
    ["D5", 1],
    ["E5", 1],
    ["F5", 1],
    ["E5", 2],
    ["D5", 1],
    ["C5", 3],
    ["C5", 1],
    ["F5", 1],
    ["A5", 1],
    ["C6", 2],
    ["A5", 1],
    ["G5", 1],
    ["E5", 1],
    ["C5", 1],
    ["A4", 2],
    ["C5", 1],
    ["F#5", 1],
    ["E5", 1],
    ["D5", 1],
    ["G5", 1],
    ["F5", 1],
    ["D5", 1],
    ["C5", 3],
    ["-", 3],
  ],
};

/** Station march: a parade band marching down the platform. */
const march: Tune = {
  bpm: 132,
  meter: 4,
  chords: [
    "C",
    "C",
    "F",
    "C",
    "G7",
    "C",
    "G7",
    "C",
    "F",
    "F",
    "C",
    "Am",
    "D7",
    "G7",
    "C",
    "C",
  ],
  melody: [
    ["G4", 0.5],
    ["C5", 0.5],
    ["E5", 1],
    ["G5", 1],
    ["E5", 1],
    ["F5", 0.5],
    ["E5", 0.5],
    ["D5", 1],
    ["C5", 2],
    ["A4", 0.5],
    ["C5", 0.5],
    ["F5", 1],
    ["A5", 1],
    ["F5", 1],
    ["G5", 1.5],
    ["E5", 0.5],
    ["C5", 2],
    ["B4", 0.5],
    ["D5", 0.5],
    ["G5", 1],
    ["F5", 1],
    ["D5", 1],
    ["E5", 0.5],
    ["F5", 0.5],
    ["G5", 1],
    ["E5", 2],
    ["D5", 1],
    ["F5", 1],
    ["B4", 1],
    ["D5", 1],
    ["C5", 3],
    ["-", 1],
    ["A4", 0.5],
    ["B4", 0.5],
    ["C5", 1],
    ["F5", 1],
    ["A5", 1],
    ["G5", 0.5],
    ["F5", 0.5],
    ["E5", 1],
    ["F5", 2],
    ["E5", 0.5],
    ["F5", 0.5],
    ["G5", 1],
    ["C6", 1],
    ["G5", 1],
    ["A5", 1],
    ["E5", 1],
    ["C5", 2],
    ["D5", 0.5],
    ["E5", 0.5],
    ["F#5", 1],
    ["A5", 1],
    ["F#5", 1],
    ["G5", 1],
    ["B4", 1],
    ["D5", 1],
    ["F5", 1],
    ["E5", 1],
    ["G5", 1],
    ["C6", 1.5],
    ["G5", 0.5],
    ["C6", 2],
    ["-", 2],
  ],
};

export const tunes = { station: waltz, subway: march };
export type TuneId = keyof typeof tunes;

/** Turn a tune into timed notes for one pass (beats from the start). */
function arrange(tune: Tune, pass: number): { notes: Note[]; length: number } {
  const notes: Note[] = [];
  let t = 0;
  for (const [n, d] of tune.melody) {
    if (n !== "-") {
      notes.push({ t, dur: d, freq: freq(n), voice: "lead" });
      // Second time round the glockenspiel doubles the tune an octave up.
      if (pass % 2 === 1)
        notes.push({
          t,
          dur: Math.min(d, 1),
          freq: freq(n) * 2,
          voice: "bell",
        });
    }
    t += d;
  }
  const m = tune.meter;
  tune.chords.forEach((c, bar) => {
    const b = bar * m,
      tones = CHORDS[c];
    const root = freq(tones[0], 2),
      fifth = freq(tones[2] ?? tones[0], 2);
    notes.push({ t: b, dur: 0.9, freq: root, voice: "bass" });
    notes.push({ t: b, dur: 0.2, freq: 0, voice: "kick" });
    const stab = (at: number) =>
      tones.slice(0, 3).forEach((x) =>
        notes.push({
          t: b + at,
          dur: 0.45,
          freq: freq(x, 4),
          voice: "chord",
        }),
      );
    if (m === 3) {
      stab(1);
      stab(2);
      notes.push({ t: b + 1, dur: 0.1, freq: 0, voice: "block" });
      notes.push({ t: b + 2, dur: 0.1, freq: 0, voice: "block" });
    } else {
      notes.push({ t: b + 2, dur: 0.9, freq: fifth, voice: "bass" });
      notes.push({ t: b + 2, dur: 0.2, freq: 0, voice: "kick" });
      stab(1);
      stab(3);
      notes.push({ t: b + 1, dur: 0.1, freq: 0, voice: "snare" });
      notes.push({ t: b + 3, dur: 0.1, freq: 0, voice: "snare" });
    }
    // A little sparkle running up the chord at the end of every other bar.
    if (bar % 2 === 1)
      tones.slice(0, 3).forEach((x, i) =>
        notes.push({
          t: b + m - 0.75 + i * 0.25,
          dur: 0.25,
          freq: freq(x, 6),
          voice: "bell",
        }),
      );
  });
  return {
    notes: notes.sort((a, b) => a.t - b.t),
    length: tune.chords.length * m,
  };
}

let enabled = (() => {
  try {
    return localStorage.getItem("swoosh-music") !== "off";
  } catch {
    return true;
  }
})();
let current: TuneId = "station",
  playing = false,
  master: GainNode | undefined,
  noise: AudioBuffer | undefined,
  timer: ReturnType<typeof setInterval> | undefined,
  passStart = 0,
  pass = 0,
  queue: Note[] = [],
  qi = 0,
  passLength = 0;

export const musicEnabled = () => enabled;
export function setMusic(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem("swoosh-music", on ? "on" : "off");
  } catch {
    /* Preference stays for this page only. */
  }
  if (on) startMusic();
  else stopMusic();
}

function voice(
  a: BaseAudioContext,
  out: AudioNode,
  n: Note,
  at: number,
  spb: number,
) {
  const len = n.dur * spb;
  const env = (
    g: GainNode,
    peak: number,
    attack: number,
    hold: number,
    release: number,
  ) => {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.setValueAtTime(peak, at + Math.max(attack, hold));
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      at + Math.max(attack, hold) + release,
    );
  };
  const osc = (type: OscillatorType, f: number, g: GainNode) => {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    o.connect(g);
    o.start(at);
    o.stop(at + len + 0.6);
    return o;
  };
  switch (n.voice) {
    case "lead": {
      // Band-organ pipe: bright pulse plus a flute an octave up, with gentle vibrato.
      const g = a.createGain(),
        f = a.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 2600;
      g.connect(f).connect(out);
      env(g, 0.16, 0.02, len * 0.85, 0.08);
      const lfo = a.createOscillator(),
        depth = a.createGain();
      lfo.frequency.value = 5.6;
      depth.gain.value = n.freq * 0.006;
      lfo.connect(depth);
      lfo.start(at);
      lfo.stop(at + len + 0.6);
      for (const [type, mult, vol] of [
        ["square", 1, 0.5],
        ["triangle", 2, 0.7],
        ["sine", 1, 0.6],
      ] as const) {
        const vg = a.createGain();
        vg.gain.value = vol;
        vg.connect(g);
        const o = osc(type, n.freq * mult, vg);
        depth.connect(o.frequency);
      }
      break;
    }
    case "bell": {
      const g = a.createGain();
      g.connect(out);
      env(g, 0.07, 0.005, 0.01, 0.5);
      osc("sine", n.freq, g);
      const g2 = a.createGain();
      g2.connect(out);
      env(g2, 0.02, 0.005, 0.01, 0.25);
      osc("sine", n.freq * 2.76, g2);
      break;
    }
    case "chord": {
      // Accordion-ish stab.
      const g = a.createGain(),
        f = a.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 1800;
      g.connect(f).connect(out);
      env(g, 0.035, 0.01, len * 0.6, 0.06);
      osc("sawtooth", n.freq, g);
      osc("sawtooth", n.freq * 1.004, g);
      break;
    }
    case "bass": {
      // Tuba: soft sawtooth through a low filter.
      const g = a.createGain(),
        f = a.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 520;
      g.connect(f).connect(out);
      env(g, 0.22, 0.02, len * 0.55, 0.1);
      osc("sawtooth", n.freq, g);
      osc("sine", n.freq, g);
      break;
    }
    case "kick": {
      const g = a.createGain(),
        o = a.createOscillator();
      o.frequency.setValueAtTime(140, at);
      o.frequency.exponentialRampToValueAtTime(45, at + 0.15);
      o.connect(g).connect(out);
      env(g, 0.25, 0.005, 0.02, 0.18);
      o.start(at);
      o.stop(at + 0.3);
      break;
    }
    case "snare":
    case "block": {
      if (n.voice === "block") {
        const g = a.createGain();
        g.connect(out);
        env(g, 0.05, 0.002, 0.005, 0.05);
        osc("sine", 1250, g);
        break;
      }
      if (!noise) {
        noise = a.createBuffer(1, a.sampleRate * 0.3, a.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = a.createBufferSource(),
        f = a.createBiquadFilter(),
        g = a.createGain();
      s.buffer = noise;
      f.type = "highpass";
      f.frequency.value = 1800;
      s.connect(f).connect(g).connect(out);
      env(g, 0.05, 0.002, 0.01, 0.1);
      s.start(at);
      s.stop(at + 0.2);
      break;
    }
  }
}

function tick() {
  const a = audio();
  if (!master) return;
  const tune = tunes[current],
    spb = 60 / tune.bpm;
  const horizon = a.currentTime + 0.3;
  for (;;) {
    if (qi >= queue.length) {
      passStart += passLength * spb;
      pass++;
      const next = arrange(tune, pass);
      queue = next.notes;
      passLength = next.length;
      qi = 0;
    }
    const n = queue[qi],
      at = passStart + n.t * spb;
    if (at > horizon) break;
    if (at > a.currentTime - 0.05)
      voice(a, master, n, Math.max(at, a.currentTime), spb);
    qi++;
  }
}

/** Start (or keep) playing; call from a tap or click so the browser allows sound. */
export function startMusic() {
  if (!enabled || playing) return;
  try {
    const a = audio();
    master = a.createGain();
    master.gain.setValueAtTime(0.0001, a.currentTime);
    master.gain.exponentialRampToValueAtTime(0.5, a.currentTime + 1.5);
    const comp = a.createDynamicsCompressor();
    master.connect(comp).connect(a.destination);
    const first = arrange(tunes[current], 0);
    queue = first.notes;
    passLength = first.length;
    qi = 0;
    pass = 0;
    passStart = a.currentTime + 0.15;
    playing = true;
    timer = setInterval(tick, 60);
    tick();
  } catch {
    /* No audio on this device. */
  }
}

export function stopMusic() {
  if (!playing) return;
  playing = false;
  clearInterval(timer);
  const a = audio(),
    m = master;
  if (m) {
    m.gain.cancelScheduledValues(a.currentTime);
    m.gain.setValueAtTime(Math.max(0.0001, m.gain.value), a.currentTime);
    m.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.6);
    setTimeout(() => m.disconnect(), 800);
  }
  master = undefined;
}

/** Switch to the tune that belongs to a place (fades over). */
export function setTune(id: TuneId) {
  if (id === current) return;
  current = id;
  if (playing) {
    stopMusic();
    setTimeout(startMusic, 650);
  }
}

/** Render a tune to an audio buffer (for previews and checks), without playing it. */
export async function renderTune(id: TuneId, seconds: number) {
  const rate = 44100;
  const a = new OfflineAudioContext(2, rate * seconds, rate);
  const out = a.createGain();
  out.gain.value = 0.5;
  out.connect(a.createDynamicsCompressor()).connect(a.destination);
  const tune = tunes[id],
    spb = 60 / tune.bpm;
  let start = 0.1;
  for (let p = 0; start < seconds; p++) {
    const { notes, length } = arrange(tune, p);
    for (const n of notes) {
      const at = start + n.t * spb;
      if (at < seconds) voice(a, out, n, at, spb);
    }
    start += length * spb;
  }
  return a.startRendering();
}
