import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { HorizontalTiltShiftShader } from "three/examples/jsm/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "three/examples/jsm/shaders/VerticalTiltShiftShader.js";
import { Artwork, MAX_OBJECTS, cleanDesign } from "../../../shared/protocol";
import { socket } from "../network/socket";
import {
  Design,
  defaultDesign,
  figureSvg,
  loadImage,
  sampleDesigns,
  svgUrl,
} from "../objects/figure";
import { play } from "./sound";
import { puffTexture } from "../three/kit";
import { Figure, buildFigure } from "../three/minifig";
import { Vehicle } from "../three/train";
import { Path, Stage, StageId, TrainMode } from "../three/stage";
import { stationStage } from "../three/stationStage";
import { subwayStage } from "../three/subway";
import { spaceportStage } from "../three/spaceport";

type State =
  | "arriving"
  | "falling"
  | "waiting"
  | "walking"
  | "hopIn"
  | "riding"
  | "hopOut"
  | "leaving"
  | "idle";
/** What a friend on the platform feels like doing next. */
type Plan = "ride" | "sit" | "stroll" | "watch" | "exit";
interface Friend {
  id: string;
  fig: Figure;
  state: State;
  vy: number;
  spin: number;
  bounced: boolean;
  t0: number;
  seat: number;
  boardedAt: number;
  stop: number;
  hit: number;
  acked: boolean;
  seed: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  path?: Path;
  leg: number;
  plan: Plan;
  /** Phase inside a plan: walking there, then doing it. */
  doing: boolean;
  until: number;
  pause: number;
  yaw: number;
  bench: number;
  rides: number;
  arrivedAt: number;
  unload: boolean;
  wave: number;
  spinAt: number;
  armBase: number;
}
const EMOJI = ["💖", "⭐", "🎵", "😊", "✨", "🌈"];
const bubbleTextures = new Map<string, THREE.Texture>();
function bubbleTexture(emoji: string) {
  let t = bubbleTextures.get(emoji);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#ffffff";
    x.beginPath();
    x.arc(64, 58, 50, 0, Math.PI * 2);
    x.moveTo(50, 100);
    x.lineTo(64, 124);
    x.lineTo(78, 100);
    x.fill();
    x.font =
      "64px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(emoji, 64, 62);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    bubbleTextures.set(emoji, t);
  }
  return t;
}
/** Turn smoothly toward an angle along the short way round. */
function turn(o: THREE.Object3D, yaw: number, k: number) {
  let d = yaw - o.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  o.rotation.y += d * Math.min(1, k);
}
interface Puff {
  sprite: THREE.Sprite;
  life: number;
  max: number;
  vel: THREE.Vector3;
  grow: number;
}

const ease = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** Rough design from the picture alone (older tablets that don't send one). */
function guessDesign(img: HTMLImageElement): Design {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  const at = (px: number, py: number) => {
    const d = x.getImageData(px, py, 1, 1).data;
    return (
      "#" +
      [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")
    );
  };
  return {
    ...defaultDesign(),
    hat: "none",
    fills: {
      torso: at(256, 300),
      armL: at(160, 270),
      armR: at(352, 270),
      hips: at(300, 344),
      legL: at(200, 440),
      legR: at(312, 440),
      head: at(290, 182),
      handL: at(130, 340),
      handR: at(382, 340),
    },
  };
}

export function World({
  initial,
  demo = false,
  stage: stageId = "station",
  zoomable = false,
}: {
  initial: Artwork[];
  demo?: boolean;
  stage?: StageId;
  /** Wheel / pinch / drag zoom (the big screen); off for the home preview. */
  zoomable?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // ?lite: no post effects and smaller shadows (weak TVs, software rendering).
    const lite = new URLSearchParams(location.search).has("lite");
    let disposed = false,
      resetVersion = 0;
    const renderer = new THREE.WebGLRenderer({
      canvas: c,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(lite ? 1 : Math.min(devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = !lite;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    const stage: Stage =
      stageId === "subway"
        ? subwayStage()
        : stageId === "spaceport"
          ? spaceportStage()
          : stationStage();
    // Only the train and its riders are cut at the tunnel mouths, so the rest of the scene stays whole.
    renderer.localClippingEnabled = !!stage.clip;
    const clipObject = (o: THREE.Object3D) => {
      if (!stage.clip) return;
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.clipped) return;
        mesh.userData.clipped = true;
        const mat = (mesh.material as THREE.Material).clone();
        mat.clippingPlanes = stage.clip!;
        mesh.material = mat;
      });
    };
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    const sun = stage.setupLights(scene, lite);
    const P = { y: stage.platformY };

    const camera = new THREE.PerspectiveCamera(28, 1, 1, 700);
    let target = new THREE.Vector3(0, 0, 4);
    const composer = new EffectComposer(
      renderer,
      new THREE.WebGLRenderTarget(1, 1, {
        samples: 4,
        type: THREE.HalfFloatType,
      }),
    );
    composer.addPass(new RenderPass(scene, camera));
    // Glow on lamps, the engine headlight and the signal.
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(256, 256),
      0.5,
      0.45,
      1.6,
    );
    composer.addPass(bloom);
    const hTilt = new ShaderPass(HorizontalTiltShiftShader),
      vTilt = new ShaderPass(VerticalTiltShiftShader);
    composer.addPass(hTilt);
    composer.addPass(vTilt);
    composer.addPass(new OutputPass());
    let fancy = !lite;

    scene.add(stage.root);
    const { trackAt, loop: LOOP } = stage;

    // Train: lead vehicle first, the rest coupled behind it.
    const { vehicles, gap: GAP } = stage.buildTrain();
    const lead = vehicles[0];
    vehicles.forEach((v) => {
      scene.add(v.group);
      clipObject(v.group);
    });
    const offsets = [0];
    for (let i = 1; i < vehicles.length; i++)
      offsets.push(
        offsets[i - 1] +
          vehicles[i - 1].length / 2 +
          GAP +
          vehicles[i].length / 2,
      );
    const STOP = stage.stopAt(offsets);
    const train = {
      s: STOP + LOOP * 0.45,
      v: 0,
      doors: 0,
      mode: "cruise" as TrainMode,
      t0: 0,
      lastAction: 0,
      stops: 0,
      wheel: 0,
      chug: 0,
      puffAt: 0,
    };
    const seatRefs = vehicles.flatMap((v) => v.seats.map((_, i) => ({ v, i })));
    const seats: (Friend | null)[] = Array(seatRefs.length).fill(null);
    const seatWorld = (k: number) => {
      const { v, i } = seatRefs[k];
      return v.group.localToWorld(v.seats[i].clone());
    };
    const placeTrain = () => {
      vehicles.forEach((v, i) => {
        const p = trackAt(train.s - offsets[i]);
        v.group.position.set(p.x, stage.trackY + (p.y ?? 0), p.z);
        v.group.rotation.set(p.pitch ?? 0, p.yaw, p.roll ?? 0);
      });
    };
    placeTrain();

    // Friends.
    const friends: Friend[] = [],
      loading = new Set<string>();
    const waiting = () => friends.filter((f) => f.state === "waiting");
    const coming = () =>
      friends.some((f) => f.state === "falling" || f.state === "arriving");
    const ack = (f: Friend) => {
      if (f.acked) return;
      f.acked = true;
      if (!demo) socket.emit("artwork-ready", { messageId: f.id });
    };
    let driver: Figure | null = null,
      master: Figure | null = null;
    const pose = (f: Figure, walk: number, sit = false) => {
      const sw = Math.sin(walk) * 0.55;
      f.legL.rotation.x = sit ? -Math.PI / 2 : sw;
      f.legR.rotation.x = sit ? -Math.PI / 2 : -sw;
      f.armL.rotation.x = sit ? -0.3 : -sw * 0.8;
    };

    // Steam and dust.
    const puffs: Puff[] = [];
    const puffMat = (color: string) =>
      new THREE.SpriteMaterial({
        map: puffTexture(),
        color,
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
        fog: true,
      });
    const puff = (
      pos: THREE.Vector3,
      vel: THREE.Vector3,
      size: number,
      life: number,
      color = "#ffffff",
      grow = 1.6,
    ) => {
      if (reduce || puffs.length > 140) return;
      const s = new THREE.Sprite(puffMat(color));
      s.position.copy(pos);
      s.scale.setScalar(size);
      scene.add(s);
      puffs.push({ sprite: s, life, max: life, vel, grow });
    };
    const sparkle = (pos: THREE.Vector3) => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        puff(
          pos.clone(),
          new THREE.Vector3(
            Math.cos(a) * 6,
            4 + Math.sin(a) * 3,
            Math.sin(a) * 3,
          ),
          0.7,
          0.7,
          ["#ffd23f", "#ff6fa8", "#5bc0eb"][i % 3],
          0.2,
        );
      }
    };

    const add = async (a: Artwork, restored = false) => {
      const known = friends.find((f) => f.id === a.messageId);
      if (known) {
        if (known.state !== "falling") ack(known);
        return;
      }
      if (waiting().length >= stage.maxWaiting + 4) return;
      if (loading.has(a.messageId)) return;
      loading.add(a.messageId);
      const version = resetVersion;
      try {
        const img = await loadImage(a.imageData);
        if (disposed || version !== resetVersion) return;
        const design = cleanDesign(a.design) || guessDesign(img);
        const fig = buildFigure(design, img);
        const now = performance.now() / 1000;
        const s = stage.spot(
          waiting().length +
            friends.filter((f) => f.state === "falling").length,
        );
        const f: Friend = {
          id: a.messageId,
          fig,
          state: "falling",
          vy: 0,
          spin: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 4),
          bounced: false,
          t0: now,
          seat: -1,
          boardedAt: 0,
          stop: -1,
          hit: 0,
          acked: false,
          seed: Math.random() * 10,
          from: new THREE.Vector3(),
          to: new THREE.Vector3(),
          leg: 0,
          plan: "ride",
          doing: false,
          until: 0,
          pause: 0,
          yaw: 0,
          bench: -1,
          rides: 0,
          arrivedAt: now,
          unload: false,
          wave: 0,
          spinAt: 0,
          armBase: fig.armR.rotation.x,
        };
        fig.root.position.set(s.x, 48, s.z);
        scene.add(fig.root);
        friends.push(f);
        if (restored || reduce) {
          fig.root.position.copy(s);
          ack(f);
          choose(f, now, true);
        } else if (stage.arrival === "fall") play("launch");
        else {
          // Comes in from the street (escalator) instead of the sky.
          f.state = "arriving";
          f.path = stage.arrival;
          f.leg = 0;
          fig.root.position.copy(stage.arrival.points[0]);
          ack(f);
          play("pop");
          sparkle(
            stage.arrival.points[0].clone().add(new THREE.Vector3(0, 3, 0)),
          );
        }
        // Keep the platform from overflowing: someone who has already ridden
        // (or else whoever has been around longest) heads into the station.
        const onPlatform = friends.filter(
          (x) => x !== f && (x.state === "idle" || x.state === "waiting"),
        );
        const crowd = friends.filter(
          (x) => x.state !== "leaving" && x.state !== "hopOut",
        );
        if (
          crowd.length > MAX_OBJECTS ||
          onPlatform.length > Math.min(18, stage.maxWaiting) ||
          waiting().length > stage.maxWaiting
        ) {
          const goer = onPlatform.find((x) => x.rides > 0) ?? onPlatform[0];
          if (goer) startExit(goer);
        }
      } catch {
        /* No arrival confirmation if the picture cannot be decoded. */
      } finally {
        loading.delete(a.messageId);
      }
    };
    const remove = (f: Friend) => {
      freeBench(f);
      f.fig.root.removeFromParent();
      f.fig.dispose();
      friends.splice(friends.indexOf(f), 1);
    };
    const reset = () => {
      resetVersion++;
      for (const f of [...friends]) remove(f);
      seats.fill(null);
      benchTaken.fill(null);
      for (const b of bubbles.splice(0)) b.s.removeFromParent();
    };
    const leave = (f: Friend, now: number) => {
      if (f.state === "riding") {
        const w = new THREE.Vector3();
        f.fig.root.getWorldPosition(w);
        scene.attach(f.fig.root);
        seats[f.seat] = null;
        f.from.copy(w);
        f.to.copy(stage.alightPoint(w));
        f.state = "hopOut";
      } else startExit(f);
      f.t0 = now;
    };
    const startExit = (f: Friend) => {
      freeBench(f);
      f.state = "leaving";
      f.path = stage.exitPath(f.fig.root.position);
      f.leg = 0;
    };
    // Platform life: sit on benches, stroll, watch trains, go into the station.
    const benchTaken: (Friend | null)[] = stage.benches.map(() => null);
    const freeBench = (f: Friend) => {
      if (f.bench >= 0 && benchTaken[f.bench] === f) benchTaken[f.bench] = null;
      f.bench = -1;
    };
    const bubbles: { s: THREE.Sprite; f: Friend; life: number }[] = [];
    const bubble = (
      f: Friend,
      emoji = EMOJI[Math.floor(Math.random() * EMOJI.length)],
    ) => {
      if (bubbles.some((b) => b.f === f)) return;
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: bubbleTexture(emoji),
          transparent: true,
          depthWrite: false,
        }),
      );
      s.scale.setScalar(4.2);
      scene.add(s);
      bubbles.push({ s, f, life: 1.8 });
    };
    const emote = (f: Friend, now: number) => {
      const r = Math.random();
      if (r < 0.3) f.wave = now + 1.6;
      else if (r < 0.5) f.hit = now;
      else if (r < 0.65) f.spinAt = now;
      bubble(f);
    };
    const choose = (f: Friend, now: number, first = false) => {
      freeBench(f);
      const r = Math.random(),
        canExit = f.rides > 0 && now - f.arrivedAt > 40;
      let plan: Plan;
      // A new friend mostly wants to ride first; later the day gets more varied.
      if (first)
        plan =
          r < 0.7 ? "ride" : r < 0.8 ? "stroll" : r < 0.9 ? "sit" : "watch";
      else if (canExit && r < 0.14) plan = "exit";
      else
        plan =
          r < 0.42 ? "ride" : r < 0.64 ? "stroll" : r < 0.84 ? "sit" : "watch";
      setPlan(f, plan, now);
    };
    const setPlan = (f: Friend, plan: Plan, now: number) => {
      f.plan = plan;
      f.doing = false;
      f.pause = 0;
      f.until = now + 9 + Math.random() * 9;
      if (plan === "ride") {
        f.state = "waiting";
        return;
      }
      if (plan === "exit") return startExit(f);
      f.state = "idle";
      if (plan === "sit") {
        const free = benchTaken.findIndex((b) => !b);
        if (free < 0) return setPlan(f, "stroll", now);
        benchTaken[free] = f;
        f.bench = free;
        f.to.copy(stage.benches[free].approach);
      } else if (plan === "stroll") f.to.copy(stage.wander());
      else {
        const w = stage.watchSpot();
        f.to.copy(w.pos);
        f.yaw = w.yaw;
      }
    };
    /** Walk across the platform to a point; true on arrival. */
    const walkTo = (
      f: Friend,
      target: THREE.Vector3,
      dt: number,
      now: number,
      speed = 5,
    ) => {
      const r = f.fig.root;
      const d = target.clone().sub(r.position);
      d.y = 0;
      const dist = d.length();
      if (dist < 0.12) return true;
      r.position.addScaledVector(d.normalize(), Math.min(dist, speed * dt));
      turn(r, Math.atan2(d.x, d.z), dt * 10);
      pose(f.fig, now * (speed + 5));
      return false;
    };
    const idle = (f: Friend, now: number, dt: number) => {
      const r = f.fig.root;
      if (f.plan === "sit") {
        const b = stage.benches[f.bench];
        if (!f.doing) {
          if (walkTo(f, f.to, dt, now)) {
            f.doing = true;
            r.position.copy(b.pos);
            r.rotation.y = b.yaw;
          }
          return;
        }
        pose(f.fig, 0, true);
        f.fig.head.rotation.y = Math.sin(now * 0.6 + f.seed) * 0.5;
        f.fig.legL.rotation.x =
          -Math.PI / 2 + Math.max(0, Math.sin(now * 3 + f.seed)) * 0.25;
        if (Math.random() < dt * 0.12) emote(f, now);
        if (now > f.until) {
          r.position.copy(b.approach);
          choose(f, now);
        }
        return;
      }
      if (f.plan === "stroll") {
        if (now < f.pause) {
          pose(f.fig, 0);
          f.fig.head.rotation.y = Math.sin(now * 1.3 + f.seed) * 0.6;
          return;
        }
        if (walkTo(f, f.to, dt, now, 4)) {
          if (now > f.until) return choose(f, now);
          f.pause = now + 1.2 + Math.random() * 2.5;
          turn(r, 0, 1);
          emote(f, now);
          f.to.copy(stage.wander());
        }
        return;
      }
      // Watching trains go by, waving at them.
      if (!f.doing) {
        if (walkTo(f, f.to, dt, now)) f.doing = true;
        return;
      }
      turn(r, f.yaw, dt * 6);
      pose(f.fig, 0);
      const near =
        train.mode !== "stopped" &&
        train.v > 1 &&
        vehicles.some(
          (v) =>
            Math.abs(v.group.position.x - r.position.x) < 14 &&
            Math.abs(v.group.position.z - r.position.z) < 16,
        );
      if (near) {
        f.wave = now + 0.5;
        if (Math.random() < dt * 0.6) bubble(f, "👋");
      }
      if (now > f.until) choose(f, now);
    };
    const board = (f: Friend, seat: number, now: number) => {
      seats[seat] = f;
      f.seat = seat;
      f.state = "walking";
      f.t0 = now;
      f.to.copy(stage.boardPoint(seatWorld(seat)));
    };
    /** Walk (or ride) along a path; true when the last point is reached. */
    const follow = (f: Friend, dt: number, now: number) => {
      const r = f.fig.root,
        path = f.path!;
      const goal = path.points[f.leg];
      if (!goal) return true;
      const riding = path.ride?.includes(f.leg - 1) ?? false;
      const d = goal.clone().sub(r.position);
      const dist = d.length();
      const step = (riding ? 5 : 7) * dt;
      if (dist <= step) {
        r.position.copy(goal);
        f.leg++;
        return f.leg >= path.points.length;
      }
      r.position.addScaledVector(d.normalize(), step);
      if (Math.abs(d.x) + Math.abs(d.z) > 0.01) {
        const yaw = Math.atan2(d.x, d.z);
        r.rotation.y += (yaw - r.rotation.y) * Math.min(1, dt * 10);
      }
      pose(f.fig, riding ? 0 : now * 11);
      return false;
    };

    const updateTrain = (now: number, dt: number) => {
      const brake = 2.4,
        cruise = stage.speed ?? (demo ? 7 : 8);
      const ahead = (((STOP - train.s) % LOOP) + LOOP) % LOOP;
      const landing = coming();
      if (train.mode === "cruise" || train.mode === "leaving") {
        train.v = Math.min(
          cruise,
          train.v + (train.mode === "leaving" ? 2.2 : 3) * dt,
        );
        if (train.v >= cruise) train.mode = "cruise";
        const want = stage.alwaysStop || waiting().length > 0 || landing;
        if (
          train.mode === "cruise" &&
          want &&
          ahead > 0.5 &&
          ahead <= (train.v * train.v) / (2 * brake) + 0.4
        ) {
          train.mode = "braking";
          play(stage.sounds.approach);
        }
      }
      if (train.mode === "braking") {
        train.v = Math.max(0.6, Math.sqrt(2 * brake * ahead));
        if (ahead < train.v * dt + 0.02 || ahead > LOOP - 1) {
          train.s = STOP;
          train.v = 0;
          train.mode = "stopped";
          train.t0 = now;
          train.lastAction = now;
          train.stops++;
          play(stage.sounds.stop);
          // Some on the platform decide to hop on; some riders get off here.
          for (const f of friends) {
            if (f.state === "idle" && Math.random() < (f.rides ? 0.3 : 0.6))
              setPlan(f, "ride", now);
            if (f.state === "riding" && f.stop !== train.stops)
              f.unload = Math.random() < 0.35;
          }
        }
      }
      if (train.mode === "stopped") {
        const busy = friends.some(
          (f) =>
            f.state === "walking" ||
            f.state === "hopIn" ||
            f.state === "hopOut",
        );
        // Doors slide open a moment after stopping.
        if (now - train.t0 > 0.8)
          train.doors = Math.min(1, train.doors + dt * 1.3);
        const ready = !stage.hasDoors || train.doors >= 1;
        if (ready && now - train.t0 > 1 && now - train.lastAction > 0.6) {
          const next = waiting()[0],
            free = seats.findIndex((s) => !s),
            off = seats.find((s) => s && s.state === "riding" && s.unload);
          if (off) {
            off.unload = false;
            leave(off, now);
            train.lastAction = now;
          } else if (next && free >= 0) {
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
              train.lastAction = now;
            }
          }
        }
        const canBoard =
          seats.some((s) => s && s.state === "riding" && s.unload) ||
          (waiting().length > 0 &&
            (seats.some((s) => !s) ||
              seats.some(
                (s) => s && s.state === "riding" && s.stop !== train.stops,
              )));
        if (
          !canBoard &&
          !busy &&
          !landing &&
          now - train.lastAction > 1.4 &&
          now - train.t0 > (stage.dwell ?? 2.5)
        ) {
          if (stage.hasDoors) {
            train.mode = "closing";
            play("doorBeep");
          } else {
            train.mode = "leaving";
            play(stage.sounds.depart);
          }
        }
      }
      if (train.mode === "closing") {
        train.doors = Math.max(0, train.doors - dt * 1.1);
        if (train.doors <= 0) {
          train.mode = "leaving";
          play(stage.sounds.depart);
        }
      }
      stage.setDoors(train.doors);
      for (const v of vehicles) v.setDoors?.(train.doors);
      const move = train.v * dt;
      train.s = (train.s + move) % LOOP;
      placeTrain();
      // Wheels, rods, chuffing and steam.
      train.wheel += move;
      for (const v of vehicles)
        for (const w of v.wheels) {
          const r =
            (w.geometry as THREE.CylinderGeometry).parameters?.radiusTop ??
            0.62;
          w.rotation.z = (-train.wheel / r) * (w.rotation.y ? -1 : 1);
        }
      const crank = -train.wheel / 1.15;
      lead.rods?.forEach((rod) => {
        rod.position.x = Math.cos(crank) * 0.55;
        rod.position.y = 1.15 + Math.sin(crank) * 0.55;
      });
      train.chug += move;
      if (train.v > 1 && train.chug > stage.sounds.moveEvery) {
        train.chug = 0;
        play(stage.sounds.move);
      }
      const gap = train.v > 0.5 ? Math.max(0.09, 0.5 - train.v * 0.05) : 0.8;
      if (stage.steam && lead.chimney && now - train.puffAt > gap) {
        train.puffAt = now;
        const top = lead.group.localToWorld(lead.chimney.clone());
        const back = new THREE.Vector3(-1, 0, 0)
          .applyQuaternion(lead.group.quaternion)
          .multiplyScalar(train.v * 0.6);
        puff(
          top,
          new THREE.Vector3(back.x, 5 + Math.random(), back.z),
          1.6,
          2.2,
        );
      }
    };

    const updateFriend = (f: Friend, now: number, dt: number, idx: number) => {
      const r = f.fig.root,
        t = now - f.t0;
      const jump = f.hit ? Math.max(0, 1 - (now - f.hit) / 0.8) : 0;
      f.fig.body.position.y = Math.sin(jump * Math.PI) * 2.2;
      f.fig.armR.rotation.z =
        -0.12 - (jump > 0 ? Math.sin(now * 18) * 0.4 + 0.8 : 0);
      // Waving and twirling.
      f.fig.armR.rotation.x =
        now < f.wave ? -2.7 + Math.sin(now * 12) * 0.35 : f.armBase;
      const spin = now - f.spinAt;
      f.fig.body.rotation.y = spin < 0.8 ? ease(spin / 0.8) * Math.PI * 2 : 0;
      if (f.state === "idle") return idle(f, now, dt);
      if (f.fig.flag) f.fig.flag.rotation.y = Math.sin(now * 5 + f.seed) * 0.25;
      if (f.state === "arriving") {
        if (follow(f, dt, now)) {
          f.path = undefined;
          choose(f, now, true);
        }
        return;
      }
      if (f.state === "falling") {
        f.vy -= 70 * dt;
        r.position.y += f.vy * dt;
        r.rotation.y += f.spin * dt;
        r.rotation.z = Math.sin(t * 6) * 0.25;
        pose(f.fig, t * 9);
        if (r.position.y <= P.y) {
          r.position.y = P.y;
          if (!f.bounced && f.vy < -12) {
            f.bounced = true;
            f.vy = -f.vy * 0.25;
            play("land");
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              puff(
                r.position
                  .clone()
                  .add(new THREE.Vector3(Math.cos(a), 0.4, Math.sin(a))),
                new THREE.Vector3(Math.cos(a) * 3, 0.8, Math.sin(a) * 3),
                1.2,
                0.7,
                "#e9e4da",
                1.2,
              );
            }
          } else {
            r.rotation.z = 0;
            f.vy = 0;
            ack(f);
            choose(f, now, true);
            sparkle(r.position.clone().add(new THREE.Vector3(0, 4, 0)));
          }
        }
        return;
      }
      if (f.state === "waiting") {
        const s = stage.spot(idx);
        const d = s.clone().sub(r.position);
        d.y = 0;
        const dist = d.length();
        if (dist > 0.05) {
          const step = Math.min(dist, 6 * dt);
          r.position.addScaledVector(d.normalize(), step);
          turn(r, Math.atan2(d.x, d.z), dt * 10);
          pose(f.fig, now * 10);
        } else {
          turn(r, 0, dt * 4);
          pose(f.fig, 0);
          f.fig.head.rotation.y = Math.sin(now * 0.7 + f.seed) * 0.35;
        }
        return;
      }
      if (f.state === "walking") {
        const d = f.to.clone().sub(r.position);
        d.y = 0;
        const dist = d.length();
        if (dist > 0.1) {
          r.position.addScaledVector(d.normalize(), Math.min(dist, 7 * dt));
          const yaw = Math.atan2(d.x, d.z);
          r.rotation.y += (yaw - r.rotation.y) * Math.min(1, dt * 10);
          pose(f.fig, now * 12);
        } else {
          f.state = "hopIn";
          f.t0 = now;
          f.from.copy(r.position);
          play("boing");
        }
        return;
      }
      if (f.state === "hopIn") {
        const k = Math.min(1, t / 0.75),
          to = seatWorld(f.seat);
        const { v, i } = seatRefs[f.seat];
        r.position.lerpVectors(f.from, to, ease(k));
        r.position.y += Math.sin(k * Math.PI) * stage.hopHeight;
        r.rotation.y =
          Math.PI * (1 - k) + (v.group.rotation.y + (v.seatYaw?.[i] ?? 0)) * k;
        pose(f.fig, v.stand ? k * 8 : 0, !v.stand && k > 0.6);
        if (k >= 1) {
          clipObject(r);
          v.group.add(r);
          r.position.copy(v.seats[i]);
          r.rotation.set(0, v.seatYaw?.[i] ?? 0, 0);
          f.state = "riding";
          f.boardedAt = now;
          f.stop = train.stops;
          f.rides++;
          f.unload = false;
        }
        return;
      }
      if (f.state === "riding") {
        pose(f.fig, 0, !seatRefs[f.seat]?.v.stand);
        f.fig.head.rotation.y = Math.sin(now * 0.9 + f.seed) * 0.3;
        if (train.v > 1)
          f.fig.armL.rotation.x = -1.6 - Math.sin(now * 8 + f.seed) * 0.4;
        return;
      }
      if (f.state === "hopOut") {
        const k = Math.min(1, t / 0.7);
        r.position.lerpVectors(f.from, f.to, ease(k));
        r.position.y += Math.sin(k * Math.PI) * Math.min(4, stage.hopHeight);
        r.rotation.y = (k * -Math.PI) / 2;
        pose(f.fig, 0, stage.hopHeight > 1 && k < 0.4);
        if (k >= 1) {
          f.t0 = now;
          choose(f, now);
        }
        return;
      }
      if (f.state === "leaving") {
        // Walk out the way the stage says, then disappear.
        if (!follow(f, dt, now)) return;
        {
          const s = Math.max(0, r.scale.x - dt * 2.5);
          r.scale.setScalar(s);
          if (s === 0) remove(f);
        }
      }
    };

    // Camera framing that keeps the platform in view on any screen shape,
    // plus zoom and pan on top of it.
    let w = 1,
      h = 1;
    const baseTarget = new THREE.Vector3(),
      baseOffset = new THREE.Vector3();
    const view = {
      zoom: 1,
      wantZoom: 1,
      pan: new THREE.Vector3(),
      wantPan: new THREE.Vector3(),
    };
    const MAX_ZOOM = 4;
    // Less miniature blur when zoomed in, so close-ups stay sharp.
    const blur = () => {
      const k = 2.4 / Math.max(1, view.zoom * 0.9);
      hTilt.uniforms.h.value = k / (w * renderer.getPixelRatio());
      vTilt.uniforms.v.value = k / (h * renderer.getPixelRatio());
    };
    const clampPan = () => {
      const room = 1 - 1 / view.wantZoom;
      view.wantPan.x = THREE.MathUtils.clamp(
        view.wantPan.x,
        -60 * room,
        60 * room,
      );
      view.wantPan.z = THREE.MathUtils.clamp(
        view.wantPan.z,
        -45 * room,
        30 * room,
      );
      view.wantPan.y = 0;
    };
    const ground = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -stage.platformY,
    );
    /** The point on the platform level under a screen position. */
    const groundAt = (x: number, y: number) => {
      const r = c.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((x - r.left) / r.width) * 2 - 1,
        -((y - r.top) / r.height) * 2 + 1,
      );
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, camera);
      return rc.ray.intersectPlane(ground, new THREE.Vector3());
    };
    /** Zoom by a factor, keeping the spot under (x, y) roughly in place. */
    const zoomAt = (factor: number, x?: number, y?: number) => {
      const old = view.wantZoom;
      view.wantZoom = THREE.MathUtils.clamp(old * factor, 1, MAX_ZOOM);
      const p = x !== undefined && y !== undefined ? groundAt(x, y) : null;
      if (p) {
        const t = baseTarget.clone().add(view.wantPan);
        view.wantPan.add(p.sub(t).multiplyScalar(1 - old / view.wantZoom));
      }
      if (view.wantZoom === 1) view.wantPan.set(0, 0, 0);
      clampPan();
    };
    const frame = () => {
      const aspect = w / h;
      camera.aspect = aspect;
      baseTarget.copy(stage.frame(camera, aspect));
      baseOffset.copy(camera.position).sub(baseTarget);
      camera.updateProjectionMatrix();
      blur();
      hTilt.uniforms.r.value = vTilt.uniforms.r.value = stage.focus;
      bloom.resolution.set(w / 2, h / 2);
    };
    const resize = () => {
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      w = r.width;
      h = r.height;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      composer.setPixelRatio(renderer.getPixelRatio());
      frame();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(c);

    // Fixed cast: the engine driver and a station master with a flag.
    const conductor = sampleDesigns[0];
    void loadImage(svgUrl(figureSvg(conductor, "full"))).then((img) => {
      if (disposed) return;
      if (lead.driverSeat) {
        driver = buildFigure({ ...conductor, item: "none" }, img);
        lead.group.add(driver.root);
        clipObject(driver.root);
        driver.root.position.copy(lead.driverSeat);
      }
      master = buildFigure(
        {
          ...conductor,
          fills: {
            ...conductor.fills,
            torso: "#1f5fbf",
            armL: "#1f5fbf",
            armR: "#1f5fbf",
          },
        },
        img,
      );
      master.root.position.copy(stage.master.pos);
      master.root.rotation.y = stage.master.yaw;
      scene.add(master.root);
    });

    if (demo) {
      let n = 0;
      const drop = () => {
        if (disposed || friends.length >= 12) return;
        const d = sampleDesigns[n++ % sampleDesigns.length];
        void add({
          messageId: "demo-" + n,
          roomId: "demo",
          objectType: "figure",
          imageData: svgUrl(figureSvg(d, "full")),
          design: d,
          timestamp: Date.now(),
        });
      };
      const timers = [0.8, 1.6, 2.4].map((s) => setTimeout(drop, s * 1000));
      const every = setInterval(drop, 9000);
      c.dataset.timers = JSON.stringify([...timers.map(Number), Number(every)]);
    } else {
      for (const a of initial.slice(-26)) void add(a, true);
      socket.on("artwork", add).on("reset", reset);
    }

    let last = performance.now() / 1000;
    const started = last,
      times: number[] = [];
    renderer.setAnimationLoop((ms: number) => {
      const now = ms / 1000,
        real = now - last,
        dt = Math.min(real, 0.25);
      last = now;
      updateTrain(now, dt);
      const wait = waiting();
      for (const f of [...friends]) updateFriend(f, now, dt, wait.indexOf(f));
      stage.update(now, dt, {
        mode: train.mode,
        doors: train.doors,
        speed: train.v,
        puff,
      });
      for (const v of vehicles) v.animate?.(now, dt, train.v);
      if (master) {
        const stopped = train.mode === "stopped";
        master.armR.rotation.x = stopped
          ? -2.4 + Math.sin(now * 3) * 0.2
          : -0.35;
        if (master.flag) master.flag.rotation.y = Math.sin(now * 5) * 0.25;
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life -= dt;
        if (p.life <= 0) {
          p.sprite.removeFromParent();
          p.sprite.material.dispose();
          puffs.splice(i, 1);
          continue;
        }
        p.sprite.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - dt * 0.8);
        p.sprite.scale.multiplyScalar(1 + p.grow * dt);
        p.sprite.material.opacity = Math.min(0.9, (p.life / p.max) * 1.3);
      }
      // Emoji bubbles float above their friend and fade.
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.life -= dt;
        if (b.life <= 0 || !friends.includes(b.f)) {
          b.s.removeFromParent();
          b.s.material.dispose();
          bubbles.splice(i, 1);
          continue;
        }
        b.f.fig.root.getWorldPosition(b.s.position);
        b.s.position.y += 7 + (1.8 - b.life) * 0.6;
        b.s.material.opacity = Math.min(1, b.life * 2);
      }
      // A still camera (it only moves when you zoom or drag): a drifting one makes the studs shimmer.
      const k = Math.min(1, dt * 8);
      const settle =
        Math.abs(view.wantZoom - view.zoom) + view.wantPan.distanceTo(view.pan);
      if (settle > 1e-4) {
        view.zoom += (view.wantZoom - view.zoom) * k;
        view.pan.lerp(view.wantPan, k);
        blur();
      }
      target.copy(baseTarget).add(view.pan);
      camera.position.copy(target).addScaledVector(baseOffset, 1 / view.zoom);
      camera.lookAt(target);
      // Only after loading has settled, and only if it stays slow, drop the post effects once.
      // Shadows stay on; they are what makes the scene read as real.
      if (fancy && now - started > 8) {
        times.push(real);
        if (times.length > 90) times.shift();
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        if (times.length === 90 && avg > 0.055) {
          fancy = false;
          renderer.setPixelRatio(1);
          sun.shadow.mapSize.set(2048, 2048);
          sun.shadow.map?.dispose();
          sun.shadow.map = null;
          resize();
        }
      }
      if (fancy) composer.render();
      else renderer.render(scene, camera);
    });

    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const hit = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const now = performance.now() / 1000;
      const hits = ray.intersectObjects(
        [...friends.map((f) => f.fig.root), ...vehicles.map((v) => v.group)],
        true,
      );
      for (const h of hits) {
        const f = friends.find((f) => {
          let o: THREE.Object3D | null = h.object;
          while (o) {
            if (o === f.fig.root) return true;
            o = o.parent;
          }
          return false;
        });
        if (f) {
          f.hit = now;
          play("boing");
          sparkle(h.point);
          return;
        }
        play(stage.sounds.horn);
        if (stage.steam && lead.chimney) {
          const top = lead.group.localToWorld(lead.chimney.clone());
          for (let i = 0; i < 6; i++)
            puff(top, new THREE.Vector3((i - 2.5) * 1.2, 7 + i, 0), 1.8, 2);
        }
        return;
      }
    };
    // Taps poke friends; drags pan; two fingers pinch; the wheel zooms.
    const touches = new Map<number, { x: number; y: number }>();
    let downAt: { x: number; y: number } | null = null,
      dragged = false,
      lastTap = 0;
    const down = (e: PointerEvent) => {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 1) {
        downAt = { x: e.clientX, y: e.clientY };
        dragged = false;
      }
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* Fine without capture. */
      }
    };
    const move = (e: PointerEvent) => {
      const prev = touches.get(e.pointerId);
      if (!prev || !zoomable) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (touches.size === 2) {
        const [a, b] = [...touches.entries()].map(([id, p]) =>
          id === e.pointerId ? cur : p,
        );
        const [pa, pb] = [...touches.entries()].map(([, p]) => p);
        const before = Math.hypot(pa.x - pb.x, pa.y - pb.y),
          after = Math.hypot(a.x - b.x, a.y - b.y);
        if (before > 10)
          zoomAt(after / before, (a.x + b.x) / 2, (a.y + b.y) / 2);
        dragged = true;
      } else if (touches.size === 1 && downAt) {
        if (Math.hypot(cur.x - downAt.x, cur.y - downAt.y) > 8) dragged = true;
        if (dragged && view.wantZoom > 1) {
          const g0 = groundAt(prev.x, prev.y),
            g1 = groundAt(cur.x, cur.y);
          if (g0 && g1) {
            view.wantPan.add(g0.sub(g1));
            clampPan();
            view.pan.copy(view.wantPan);
          }
        }
      }
      touches.set(e.pointerId, cur);
    };
    const up = (e: PointerEvent) => {
      const was = touches.size;
      touches.delete(e.pointerId);
      if (was === 1 && !dragged) {
        hit(e);
        // Double tap: zoom in there, or back out.
        const now = performance.now();
        if (zoomable && now - lastTap < 320) {
          if (view.wantZoom > 1.2) zoomAt(1 / view.wantZoom);
          else zoomAt(2.5, e.clientX, e.clientY);
          lastTap = 0;
        } else lastTap = now;
      }
      if (touches.size === 0) downAt = null;
    };
    const wheel = (e: WheelEvent) => {
      if (!zoomable) return;
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    const button = (e: Event) => {
      const what = (e as CustomEvent<string>).detail;
      if (what === "in") zoomAt(1.5);
      else if (what === "out") zoomAt(1 / 1.5);
      else zoomAt(1 / view.wantZoom);
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("world-zoom", button);
    return () => {
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
      c.removeEventListener("wheel", wheel);
      window.removeEventListener("world-zoom", button);
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      c.removeEventListener("pointerdown", down);
      if (demo)
        for (const t of JSON.parse(c.dataset.timers || "[]"))
          (clearTimeout(t), clearInterval(t));
      else socket.off("artwork", add).off("reset", reset);
      for (const f of [...friends]) remove(f);
      composer.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [initial, demo, stageId, zoomable]);
  return (
    <canvas
      className="world-canvas"
      ref={canvas}
      aria-label={
        stageId === "subway"
          ? "블록 친구들이 지하철을 타는 지하철역"
          : stageId === "spaceport"
            ? "블록 친구들이 우주선을 타는 우주기지"
            : "블록 친구들이 기차를 타는 기차역"
      }
    />
  );
}
