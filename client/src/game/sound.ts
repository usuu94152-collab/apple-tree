let ctx: AudioContext | undefined;
let enabled = localStorage.getItem("swoosh-sound") !== "off";
export function setSound(on: boolean) {
  enabled = on;
  localStorage.setItem("swoosh-sound", on ? "on" : "off");
  if (on) play("pop");
}
export const soundEnabled = () => enabled;
export function play(kind = "pop") {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    const now = ctx.currentTime;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(
      kind === "launch" ? 180 : kind === "star" ? 880 : 520,
      now,
    );
    o.frequency.exponentialRampToValueAtTime(
      kind === "launch" ? 1200 : 260,
      now + 0.22,
    );
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(now + 0.3);
  } catch {
    /* Muted/unsupported audio never interrupts play. */
  }
}
