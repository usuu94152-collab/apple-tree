import { useEffect, useRef } from "react";
import { Artwork, MAX_OBJECTS } from "../../../shared/protocol";
import { socket } from "../network/socket";
import { loadImage } from "../objects/catalog";
import { play } from "./sound";
interface Actor {
  art: Artwork;
  image: HTMLImageElement;
  born: number;
  seed: number;
  x: number;
  y: number;
  size: number;
  hit: number;
  retire?: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}
export function World({ initial }: { initial: Artwork[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!,
      ctx = c.getContext("2d")!;
    let w = innerWidth,
      h = innerHeight,
      frame = 0,
      last = performance.now(),
      disposed = false,
      resetVersion = 0;
    const actors: Actor[] = [],
      loading = new Set<string>(),
      particles: Particle[] = [];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const r = c.getBoundingClientRect();
      w = r.width;
      h = r.height;
      const d = Math.min(devicePixelRatio || 1, 2);
      c.width = w * d;
      c.height = h * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(c);
    const burst = (x: number, y: number, type: string) => {
      for (let j = 0; j < 12; j++) {
        const angle = (j / 12) * Math.PI * 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * 40,
          vy: Math.sin(angle) * 40 - 20,
          life: 1,
          color: type === "fish" ? "#c3f7ff" : "#ffe79b",
        });
      }
    };
    const add = async (a: Artwork) => {
      if (actors.some((t) => t.art.messageId === a.messageId)) {
        socket.emit("artwork-ready", { messageId: a.messageId });
        return;
      }
      if (loading.has(a.messageId)) return;
      loading.add(a.messageId);
      const version = resetVersion;
      try {
        const image = await loadImage(a.imageData);
        if (disposed || version !== resetVersion) return;
        actors.push({
          art: a,
          image,
          born: performance.now(),
          seed: Math.random(),
          x: 0.5,
          y: 1.1,
          size: 120,
          hit: 0,
        });
        const live = actors.filter((a) => !a.retire);
        if (live.length > MAX_OBJECTS) live[0].retire = performance.now();
        play("star");
      } catch {
        /* No rendering confirmation if image decode fails. */
      } finally {
        loading.delete(a.messageId);
      }
    };
    const reset = () => {
      resetVersion++;
      actors.length = 0;
      particles.length = 0;
    };
    for (const a of initial) void add(a);
    socket.on("artwork", add).on("reset", reset);
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = actors.length - 1; i >= 0; i--) {
        const a = actors[i],
          t = (now - a.born) / 1000,
          s = a.seed,
          kind = a.art.objectType;
        const phase = reduce ? 0 : now / 1000;
        let x = 0.5,
          y = 0.5,
          angle = 0,
          flip = false;
        const idx = actors.filter((b) => b.art.objectType === kind).indexOf(a);
        if (kind === "apple") {
          const slots = [
            [0.2, 0.36],
            [0.32, 0.3],
            [0.13, 0.42],
            [0.39, 0.43],
            [0.28, 0.49],
            [0.18, 0.55],
            [0.35, 0.56],
            [0.25, 0.23],
          ];
          const slot = slots[idx % slots.length];
          x = slot[0] + Math.floor(idx / 8) * 0.018;
          y = slot[1];
          angle = Math.sin(phase * 1.5 + s * 10) * 0.07;
        }
        if (kind === "fish") {
          const wave = Math.sin(phase * 0.22 + s * 10);
          x = 0.72 + wave * 0.19;
          y =
            0.82 +
            Math.sin(phase * 0.9 + s * 15) * 0.035 +
            ((idx % 3) - 1) * 0.035;
          flip = Math.cos(phase * 0.22 + s * 10) < 0;
          angle = Math.sin(phase * 5) * 0.04;
        }
        if (kind === "balloon") {
          x = 0.52 + s * 0.35 + Math.sin(phase * 0.7 + s * 6) * 0.025;
          y = reduce ? 0.2 + s * 0.25 : 0.96 - ((t * 0.035 + s * 0.6) % 1.08);
          angle = Math.sin(phase * 1.4 + s * 10) * 0.09;
        }
        if (kind === "star") {
          x = 0.48 + s * 0.45 + Math.sin(phase * 0.3 + s * 9) * 0.02;
          y = 0.14 + (idx % 3) * 0.09 + Math.sin(phase * 0.5 + s * 5) * 0.02;
          angle = Math.sin(phase * 0.5 + s * 3) * 0.12;
        }
        const enter = reduce ? 1 : Math.min(1, t / 1.2),
          ease = 1 - Math.pow(1 - enter, 3);
        a.x = (0.5 + (x - 0.5) * ease) * w;
        a.y = (1.13 + (y - 1.13) * ease) * h;
        a.size = Math.min(w * 0.125, h * 0.23, 160);
        let alpha = a.retire ? Math.max(0, 1 - (now - a.retire) / 700) : 1;
        if (a.retire && alpha === 0) {
          actors.splice(i, 1);
          continue;
        }
        if (kind === "star")
          alpha *= 0.84 + Math.sin(phase * 1.7 + s * 5) * 0.16;
        const bounce = a.hit ? Math.max(0, 1 - (now - a.hit) / 900) : 0;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(
          a.x,
          a.y - Math.abs(Math.sin(bounce * Math.PI * 3)) * bounce * 22,
        );
        ctx.rotate(angle);
        ctx.scale(flip ? -1 : 1, 1);
        ctx.drawImage(a.image, -a.size / 2, -a.size / 2, a.size, a.size);
        ctx.restore();
        if (enter === 1 && !(a as Actor & { ack?: boolean }).ack) {
          (a as Actor & { ack?: boolean }).ack = true;
          socket.emit("artwork-ready", { messageId: a.art.messageId });
          burst(a.x, a.y, kind);
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life;
        ctx.strokeStyle = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 + p.life * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hit = (e: PointerEvent) => {
      const r = c.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top;
      const a = [...actors]
        .reverse()
        .find(
          (a) =>
            Math.abs(x - a.x) < a.size * 0.4 &&
            Math.abs(y - a.y) < a.size * 0.4,
        );
      if (a) {
        a.hit = performance.now();
        burst(a.x, a.y, a.art.objectType);
        play(a.art.objectType);
      }
    };
    c.addEventListener("pointerdown", hit);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      socket.off("artwork", add).off("reset", reset);
      c.removeEventListener("pointerdown", hit);
    };
  }, [initial]);
  return (
    <canvas
      className="world-canvas"
      ref={canvas}
      aria-label="아이들의 그림이 살아 움직이는 놀이터"
    />
  );
}
