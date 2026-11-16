import { useEffect, useRef } from "react";
import { Artwork, MAX_OBJECTS } from "../../../shared/protocol";
import { socket } from "../network/socket";
import { figureSvg, loadImage, sampleDesigns, svgUrl } from "../objects/figure";
import { play } from "./sound";
import {
  Layout,
  SEATS,
  chimneyTop,
  cloud,
  drawBack,
  drawFront,
  drawInWindow,
  drawSignal,
  drawSky,
  drawTrain,
  layout,
  seatRect,
  trainBox,
  trainLength,
} from "./station";

type State = "falling" | "waiting" | "boarding" | "riding" | "leaving";
interface Friend {
  id: string;
  img: HTMLImageElement;
  state: State;
  /** Centre x and feet y while on the platform. */
  x: number;
  y: number;
  vy: number;
  spin: number;
  angle: number;
  bounces: number;
  seat: number;
  t0: number;
  from: { x: number; y: number; s: number };
  boardedAt: number;
  stop: number;
  hit: number;
  acked: boolean;
  seed: number;
}
interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  color: string;
  star?: boolean;
}
type Mode = "away" | "arriving" | "stopped" | "departing" | "passing";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const FEET = 478 / 512;

export function World({
  initial,
  demo = false,
}: {
  initial: Artwork[];
  demo?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!,
      ctx = c.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let L: Layout = layout(1, 1),
      dpr = 1,
      sky = document.createElement("canvas"),
      back = document.createElement("canvas"),
      front = document.createElement("canvas"),
      frame = 0,
      disposed = false,
      resetVersion = 0,
      last = performance.now() / 1000;
    const friends: Friend[] = [],
      puffs: Puff[] = [],
      loading = new Set<string>(),
      seats: (Friend | null)[] = Array(SEATS).fill(null);
    const train = {
      mode: "away" as Mode,
      x: -9999,
      startX: 0,
      t0: 0,
      angle: 0,
      nextLap: last + (demo ? 4 : 8),
      awaySince: last,
      stops: 0,
      lastAction: 0,
      chugAt: 0,
      puffAt: 0,
      dist: 0,
    };
    let driver: HTMLImageElement | null = null;
    void loadImage(svgUrl(figureSvg(sampleDesigns[0], "full"))).then(
      (i) => (driver = i),
    );

    const paint = (
      target: HTMLCanvasElement,
      draw: (x: CanvasRenderingContext2D) => void,
    ) => {
      target.width = Math.round(L.w * dpr);
      target.height = Math.round(L.h * dpr);
      const x = target.getContext("2d")!;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(x);
    };
    const resize = () => {
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      L = layout(r.width, r.height);
      paint(sky, (x) => drawSky(x, L));
      paint(back, (x) => drawBack(x, L));
      paint(front, (x) => drawFront(x, L));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(c);
    void document.fonts?.ready.then(() => !disposed && resize());

    const stopX = () => {
      const total = trainLength(L);
      return total < L.w ? (L.w - total) / 2 : L.w * 0.02;
    };
    const waiting = () => friends.filter((f) => f.state === "waiting");
    // Platform spots: one row in front, a second row slightly behind when it fills up.
    const perRow = () =>
      Math.max(3, Math.floor((L.w * 0.86 - L.S * 0.6) / (L.S * 0.6)));
    const spot = (i: number) => {
      const row = i < perRow() ? 0 : 1,
        j = row ? i - perRow() : i;
      return {
        x: L.w * 0.07 + L.S * 0.3 + j * L.S * 0.6 + row * L.S * 0.3,
        y: L.feetY - row * L.h * 0.03,
        row,
      };
    };
    const ack = (f: Friend) => {
      if (f.acked) return;
      f.acked = true;
      if (!demo) socket.emit("artwork-ready", { messageId: f.id });
    };
    const burst = (
      x: number,
      y: number,
      n: number,
      colors: string[],
      star = true,
    ) => {
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        puffs.push({
          x,
          y,
          vx: Math.cos(a) * L.k * 0.18,
          vy: Math.sin(a) * L.k * 0.18 - L.k * 0.08,
          r: L.k * 0.012,
          life: 0.8,
          max: 0.8,
          color: colors[j % colors.length],
          star,
        });
      }
    };
    const leave = (f: Friend, now: number) => {
      if (f.state === "riding") {
        const r = seatRect(L, train.x, f.seat);
        seats[f.seat] = null;
        f.from = { x: r.x + r.w / 2, y: r.y + r.h, s: L.k * 0.26 };
        f.x = r.x + r.w / 2;
      } else f.from = { x: f.x, y: f.y, s: L.S };
      f.state = "leaving";
      f.t0 = now;
    };
    const live = () => friends.filter((f) => f.state !== "leaving");

    const add = async (a: Artwork, restored = false) => {
      const known = friends.find((f) => f.id === a.messageId);
      if (known) {
        if (known.state !== "falling") ack(known);
        return;
      }
      if (loading.has(a.messageId)) return;
      loading.add(a.messageId);
      const version = resetVersion;
      try {
        const img = await loadImage(a.imageData);
        if (disposed || version !== resetVersion) return;
        const now = performance.now() / 1000,
          s = spot(
            waiting().length +
              friends.filter((f) => f.state === "falling").length,
          );
        const f: Friend = {
          id: a.messageId,
          img,
          state: restored ? "waiting" : "falling",
          x: s.x,
          y: restored ? s.y : -L.S,
          vy: 0,
          spin: (Math.random() - 0.5) * 6,
          angle: 0,
          bounces: 0,
          seat: -1,
          t0: now,
          from: { x: 0, y: 0, s: L.S },
          boardedAt: 0,
          stop: 0,
          hit: 0,
          acked: false,
          seed: Math.random(),
        };
        friends.push(f);
        if (restored || reduce) {
          f.state = "waiting";
          f.y = s.y;
          ack(f);
        } else play("launch");
        // Too many friends: the one who has waited longest strolls away.
        const crowd = live();
        if (crowd.length > MAX_OBJECTS || waiting().length > perRow() * 2) {
          const oldest = crowd.find((x) => x.state === "waiting") || crowd[0];
          if (oldest && oldest !== f) leave(oldest, now);
        }
      } catch {
        /* No arrival confirmation if the picture cannot be decoded. */
      } finally {
        loading.delete(a.messageId);
      }
    };
    const reset = () => {
      resetVersion++;
      friends.length = 0;
      puffs.length = 0;
      seats.fill(null);
    };

    // Train state machine.
    const startTrain = (mode: Mode, now: number) => {
      train.mode = mode;
      train.t0 = now;
      train.startX = -trainLength(L) - L.w * 0.05;
      train.x = train.startX;
      if (mode === "arriving") play("horn");
    };
    const board = (f: Friend, seat: number, now: number) => {
      f.state = "boarding";
      f.seat = seat;
      seats[seat] = f;
      f.from = { x: f.x, y: f.y, s: L.S };
      f.t0 = now;
      play("boing");
    };
    const updateTrain = (now: number, dt: number) => {
      const before = train.x,
        total = trainLength(L);
      if (train.mode === "away") {
        const landing = friends.some((f) => f.state === "falling");
        if (waiting().length && !landing && now - train.awaySince > 1.2)
          startTrain("arriving", now);
        else if (!waiting().length && now > train.nextLap)
          startTrain("passing", now);
      } else if (train.mode === "arriving") {
        const t = Math.min(1, (now - train.t0) / 4.2);
        train.x = train.startX + (stopX() - train.startX) * easeOut(t);
        if (t >= 1) {
          train.mode = "stopped";
          train.t0 = now;
          train.lastAction = now;
          train.stops++;
          play("bell");
        }
      } else if (train.mode === "stopped") {
        train.x = stopX();
        const hopping = friends.some(
          (f) =>
            f.state === "boarding" ||
            (f.state === "leaving" && now - f.t0 < 0.7),
        );
        if (now - train.t0 > 0.9 && now - train.lastAction > 0.5) {
          const next = waiting()[0],
            free = seats.findIndex((s) => !s);
          if (next && free >= 0) {
            board(next, free, now);
            train.lastAction = now;
          } else if (next) {
            const old = seats
              .filter(
                (s): s is Friend =>
                  !!s && s.state === "riding" && s.stop !== train.stops,
              )
              .sort((a, b) => a.boardedAt - b.boardedAt)[0];
            if (old) {
              leave(old, now);
              play("pop");
              train.lastAction = now;
            }
          }
        }
        const canBoard =
          waiting().length > 0 &&
          (seats.some((s) => !s) ||
            seats.some(
              (s) => s && s.state === "riding" && s.stop !== train.stops,
            ));
        if (
          !canBoard &&
          !hopping &&
          now - train.lastAction > 1.2 &&
          now - train.t0 > 2
        ) {
          train.mode = "departing";
          train.t0 = now;
          play("horn");
        }
      } else if (train.mode === "departing") {
        const t = now - train.t0,
          dist = L.w * 1.1 - stopX(),
          a = (2 * dist) / 25;
        train.x = stopX() + 0.5 * a * t * t;
        if (train.x > L.w * 1.05) {
          train.mode = "away";
          train.awaySince = now;
          train.nextLap = now + (demo ? 14 : 28);
        }
      } else if (train.mode === "passing") {
        train.x += ((L.w + total) / 7.5) * dt;
        if (train.x > L.w * 1.05) {
          train.mode = "away";
          train.awaySince = now;
          train.nextLap = now + (demo ? 14 : 28);
        }
      }
      const moved = train.mode === "away" ? 0 : train.x - before;
      train.angle += moved / (L.k * 0.026);
      train.dist += Math.abs(moved);
      const speed = Math.abs(moved) / Math.max(dt, 1e-3);
      if (train.mode !== "away") {
        const top = chimneyTop(L, train.x);
        const gap = speed > 5 ? Math.max(0.12, 0.35 - speed / (L.k * 6)) : 0.9;
        if (now - train.puffAt > gap && !reduce) {
          train.puffAt = now;
          puffs.push({
            x: top.x,
            y: top.y,
            vx: -speed * 0.25 - L.k * 0.02,
            vy: -L.k * 0.16,
            r: L.k * 0.03,
            life: 1.6,
            max: 1.6,
            color: "#ffffff",
          });
        }
        if (speed > 5 && train.dist > L.k * 0.16 && now - train.chugAt > 0.12) {
          train.dist = 0;
          train.chugAt = now;
          play("chug");
        }
      }
    };

    const updateFriend = (f: Friend, now: number, dt: number, i: number) => {
      if (f.state === "falling") {
        const target = spot(waiting().length).y;
        f.vy += L.h * 3.2 * dt;
        f.y += f.vy * dt;
        f.angle += f.spin * dt;
        if (now - f.t0 < 1 && Math.random() < 0.5)
          puffs.push({
            x: f.x,
            y: f.y - L.S * 0.9,
            vx: 0,
            vy: -L.k * 0.05,
            r: L.k * 0.008,
            life: 0.5,
            max: 0.5,
            color: "#fff3a0",
            star: true,
          });
        if (f.y >= target) {
          f.y = target;
          if (f.bounces === 0 && f.vy > L.h * 0.4) {
            f.vy = -f.vy * 0.28;
            f.bounces++;
            play("land");
            for (let j = 0; j < 8; j++)
              puffs.push({
                x: f.x + (j - 3.5) * L.S * 0.06,
                y: f.y,
                vx: (j - 3.5) * L.k * 0.05,
                vy: -L.k * 0.04,
                r: L.k * 0.018,
                life: 0.6,
                max: 0.6,
                color: "#e8e2d6",
              });
          } else {
            f.state = "waiting";
            f.angle = 0;
            ack(f);
            burst(f.x, f.y - L.S * 0.5, 10, ["#ffd23f", "#ff6fa8", "#5bc0eb"]);
          }
        }
        return;
      }
      if (f.state === "waiting") {
        const s = spot(i);
        const dx = s.x - f.x;
        f.x += Math.sign(dx) * Math.min(Math.abs(dx), L.k * 0.35 * dt);
        f.y += (s.y - f.y) * Math.min(1, dt * 6);
        f.angle = Math.abs(dx) > 1 ? Math.sin(now * 14) * 0.08 : 0;
        return;
      }
      if (f.state === "boarding") {
        const t = Math.min(1, (now - f.t0) / 0.75);
        if (t >= 1) {
          f.state = "riding";
          f.boardedAt = now;
          f.stop = train.stops;
        }
        return;
      }
      if (f.state === "leaving") {
        const t = (now - f.t0) / 0.7;
        if (t >= 1) {
          f.y = L.feetY;
          f.x += L.w * 0.16 * dt;
          f.angle = Math.sin(now * 14) * 0.1;
          if (f.x > L.w + L.S) friends.splice(friends.indexOf(f), 1);
        }
      }
    };

    // Drawing helpers for friends outside the train.
    const drawFriend = (
      f: Friend,
      x: number,
      feet: number,
      size: number,
      angle: number,
      now: number,
    ) => {
      const jump = f.hit ? Math.max(0, 1 - (now - f.hit) / 0.7) : 0,
        lift = Math.sin(jump * Math.PI) * L.S * 0.35,
        breathe = reduce ? 0 : Math.sin(now * 2.2 + f.seed * 9) * size * 0.006;
      if (feet >= L.platTop) {
        ctx.fillStyle = "rgba(0,0,0,.13)";
        ctx.beginPath();
        ctx.ellipse(
          x,
          feet,
          size * 0.24 * (1 - lift / (L.S * 0.6)),
          size * 0.035,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.save();
      ctx.translate(x, feet - lift + breathe);
      ctx.rotate(angle);
      ctx.drawImage(f.img, -size / 2, -size * FEET, size, size);
      ctx.restore();
    };

    if (demo) {
      let n = 0;
      const drop = async () => {
        if (disposed) return;
        const d = sampleDesigns[n++ % sampleDesigns.length];
        await add({
          messageId: "demo-" + n,
          roomId: "demo",
          objectType: "figure",
          imageData: svgUrl(figureSvg(d, "full")),
          timestamp: Date.now(),
        });
      };
      [0.5, 1.3, 2.1].forEach((s) => setTimeout(() => void drop(), s * 1000));
      const timer = setInterval(() => void drop(), 11000);
      c.dataset.demo = String(timer);
    } else {
      for (const a of initial.slice(-perRow() * 2)) void add(a, true);
      socket.on("artwork", add).on("reset", reset);
    }

    const tick = (ms: number) => {
      const now = ms / 1000,
        dt = Math.min(now - last, 0.05);
      last = now;
      if (!L.w || L.w < 2) resize();
      updateTrain(now, dt);
      const wait = waiting();
      for (const f of [...friends]) updateFriend(f, now, dt, wait.indexOf(f));
      ctx.clearRect(0, 0, L.w, L.h);
      ctx.drawImage(sky, 0, 0, L.w, L.h);
      // Drifting clouds, behind mountains and the station.
      for (let i = 0; i < 3; i++) {
        const span = L.w + L.p * 14,
          cx =
            ((i * 0.37 + (reduce ? 0 : now * 0.006 * (1 + i * 0.3))) % 1) *
              span -
            L.p * 8;
        cloud(ctx, L, cx, L.h * (0.08 + i * 0.07), 1 + (i % 2) * 0.4);
      }
      ctx.drawImage(back, 0, 0, L.w, L.h);
      drawSignal(ctx, L, train.mode !== "stopped" && train.mode !== "arriving");
      if (train.mode !== "away")
        drawTrain(
          ctx,
          L,
          train.x,
          train.angle,
          seats.map((s) => (s && s.state === "riding" ? s.img : null)),
          driver,
          now,
          train.mode !== "stopped",
        );
      // Steam behind the platform.
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life -= dt;
        if (p.life <= 0) {
          puffs.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (!p.star) p.r += L.k * 0.03 * dt;
        else p.vy += L.k * 0.4 * dt;
        ctx.globalAlpha =
          Math.min(1, (p.life / p.max) * 1.4) * (p.star ? 1 : 0.85);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.star) {
          const r = p.r * 1.6;
          for (let j = 0; j < 8; j++) {
            const a = (j * Math.PI) / 4,
              rad = j % 2 ? r * 0.4 : r;
            ctx.lineTo(p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad);
          }
        } else ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(front, 0, 0, L.w, L.h);
      // Friends on the platform: back row first.
      const order = friends
        .filter(
          (f) =>
            f.state === "waiting" ||
            f.state === "falling" ||
            (f.state === "leaving" && now - f.t0 >= 0.7),
        )
        .sort((a, b) => a.y - b.y);
      for (const f of order) {
        const back = f.state === "waiting" && spot(wait.indexOf(f)).row === 1;
        drawFriend(f, f.x, f.y, L.S * (back ? 0.94 : 1), f.angle, now);
      }
      // Hops between platform and windows.
      for (const f of friends) {
        if (f.state === "boarding") {
          const t = Math.min(1, (now - f.t0) / 0.75),
            r = seatRect(L, train.x, f.seat),
            size = f.from.s + (L.k * 0.26 - f.from.s) * t,
            fx = f.from.x + (r.x + r.w / 2 - f.from.x) * t,
            feetTo =
              r.y + r.h * 0.5 - L.k * 0.26 * (150 / 512) + L.k * 0.26 * FEET,
            fy =
              f.from.y +
              (feetTo - f.from.y) * t -
              Math.sin(t * Math.PI) * L.h * 0.16;
          if (t > 0.85) drawInWindow(ctx, L, f.img, r, 0);
          else drawFriend(f, fx, fy, size, Math.sin(t * Math.PI) * 0.3, now);
        }
        if (f.state === "leaving" && now - f.t0 < 0.7) {
          const t = (now - f.t0) / 0.7,
            size = f.from.s + (L.S - f.from.s) * t,
            fy =
              f.from.y +
              (L.feetY - f.from.y) * t -
              Math.sin(t * Math.PI) * L.h * 0.12;
          drawFriend(f, f.from.x, fy, size, -Math.sin(t * Math.PI) * 0.3, now);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const hit = (e: PointerEvent) => {
      const r = c.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top,
        now = performance.now() / 1000;
      const f = [...friends].reverse().find((f) => {
        if (f.state === "riding") {
          const s = seatRect(L, train.x, f.seat);
          return x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h;
        }
        return Math.abs(x - f.x) < L.S * 0.3 && y < f.y && y > f.y - L.S * 0.9;
      });
      if (f) {
        f.hit = now;
        play("boing");
        burst(x, y, 10, ["#ffd23f", "#ff6fa8", "#5bc0eb", "#8cc63f"]);
        return;
      }
      const b = trainBox(L, train.x);
      if (
        train.mode !== "away" &&
        x > b.x &&
        x < b.x + b.w &&
        y > b.y &&
        y < b.y + b.h
      ) {
        play("horn");
        const top = chimneyTop(L, train.x);
        for (let j = 0; j < 5; j++)
          puffs.push({
            x: top.x,
            y: top.y,
            vx: (j - 2) * L.k * 0.04,
            vy: -L.k * (0.2 + j * 0.03),
            r: L.k * 0.03,
            life: 1.4,
            max: 1.4,
            color: "#ffffff",
          });
      }
    };
    c.addEventListener("pointerdown", hit);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (demo) clearInterval(Number(c.dataset.demo));
      else socket.off("artwork", add).off("reset", reset);
      c.removeEventListener("pointerdown", hit);
    };
  }, [initial, demo]);
  return (
    <canvas
      className="world-canvas"
      ref={canvas}
      aria-label="블록 친구들이 기차를 타는 기차역"
    />
  );
}
