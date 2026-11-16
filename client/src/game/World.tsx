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
import { Vehicle, buildCoach, buildLoco } from "../three/train";
import {
  LOOP,
  PLATFORM,
  TRACK_Y,
  buildDiorama,
  trackAt,
} from "../three/diorama";

type State =
  | "falling"
  | "waiting"
  | "walking"
  | "hopIn"
  | "riding"
  | "hopOut"
  | "leaving";
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
}
interface Puff {
  sprite: THREE.Sprite;
  life: number;
  max: number;
  vel: THREE.Vector3;
  grow: number;
}

const GAP = 1.4;
const SEATS_PER = 4;
const P = PLATFORM;
const spot = (i: number) => {
  const perRow = 13,
    row = i < perRow ? 0 : 1,
    j = row ? i - perRow : i;
  return new THREE.Vector3(-27 + j * 4.5 + row * 2.2, P.y, row ? 25.7 : 22.9);
};
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
}: {
  initial: Artwork[];
  demo?: boolean;
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
    const scene = new THREE.Scene();
    // Soft sky gradient behind the diorama; fog fades the far table into it.
    const sky = document.createElement("canvas");
    sky.width = 2;
    sky.height = 256;
    const sg = sky.getContext("2d")!,
      grad = sg.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#9fd0ee");
    grad.addColorStop(0.6, "#d9ecf5");
    grad.addColorStop(1, "#f2e6d4");
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 2, 256);
    const skyTex = new THREE.CanvasTexture(sky);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTex;
    scene.fog = new THREE.Fog("#efe4d3", 190, 420);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    // Low, warm afternoon sun: long readable shadows. Little fill light keeps them visible.
    scene.add(new THREE.HemisphereLight("#d8ecff", "#5f7a4d", 0.32));
    const sun = new THREE.DirectionalLight("#ffe2b8", 3.6);
    sun.position.set(-90, 75, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(lite ? 1024 : 4096, lite ? 1024 : 4096);
    Object.assign(sun.shadow.camera, {
      left: -95,
      right: 95,
      top: 85,
      bottom: -85,
      near: 10,
      far: 320,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 3;
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(28, 1, 1, 700);
    const target = new THREE.Vector3(0, 0, 4);
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
      0.95,
    );
    composer.addPass(bloom);
    const hTilt = new ShaderPass(HorizontalTiltShiftShader),
      vTilt = new ShaderPass(VerticalTiltShiftShader);
    composer.addPass(hTilt);
    composer.addPass(vTilt);
    composer.addPass(new OutputPass());
    let fancy = !lite;

    const diorama = buildDiorama();
    scene.add(diorama.root);

    // Train: engine in front, three coaches behind.
    const loco = buildLoco();
    const coaches = [buildCoach(), buildCoach(), buildCoach()];
    const vehicles: Vehicle[] = [loco, ...coaches];
    vehicles.forEach((v) => scene.add(v.group));
    const offsets = [0];
    coaches.forEach((co, i) =>
      offsets.push(
        loco.length / 2 + GAP + co.length / 2 + i * (co.length + GAP),
      ),
    );
    const STOP = 30 + offsets[2];
    const train = {
      s: STOP + LOOP * 0.45,
      v: 0,
      mode: "cruise" as "cruise" | "braking" | "stopped" | "leaving",
      t0: 0,
      lastAction: 0,
      stops: 0,
      wheel: 0,
      chug: 0,
      puffAt: 0,
    };
    const seats: (Friend | null)[] = Array(coaches.length * SEATS_PER).fill(
      null,
    );
    const seatWorld = (i: number) => {
      const v = coaches[Math.floor(i / SEATS_PER)];
      return v.group.localToWorld(v.seats[i % SEATS_PER].clone());
    };
    const placeTrain = () => {
      vehicles.forEach((v, i) => {
        const p = trackAt(train.s - offsets[i]);
        v.group.position.set(p.x, TRACK_Y, p.z);
        v.group.rotation.y = p.yaw;
      });
    };
    placeTrain();

    // Friends.
    const friends: Friend[] = [],
      loading = new Set<string>();
    const waiting = () => friends.filter((f) => f.state === "waiting");
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
      if (loading.has(a.messageId)) return;
      loading.add(a.messageId);
      const version = resetVersion;
      try {
        const img = await loadImage(a.imageData);
        if (disposed || version !== resetVersion) return;
        const design = cleanDesign(a.design) || guessDesign(img);
        const fig = buildFigure(design, img);
        const now = performance.now() / 1000;
        const s = spot(
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
        };
        fig.root.position.set(s.x, 48, s.z);
        scene.add(fig.root);
        friends.push(f);
        if (restored || reduce) {
          f.state = "waiting";
          fig.root.position.copy(s);
          ack(f);
        } else play("launch");
        const crowd = friends.filter(
          (x) => x.state !== "leaving" && x.state !== "hopOut",
        );
        if (crowd.length > MAX_OBJECTS || waiting().length > 26) {
          const oldest = crowd.find((x) => x.state === "waiting");
          if (oldest && oldest !== f) leave(oldest, now);
        }
      } catch {
        /* No arrival confirmation if the picture cannot be decoded. */
      } finally {
        loading.delete(a.messageId);
      }
    };
    const remove = (f: Friend) => {
      f.fig.root.removeFromParent();
      f.fig.dispose();
      friends.splice(friends.indexOf(f), 1);
    };
    const reset = () => {
      resetVersion++;
      for (const f of [...friends]) remove(f);
      seats.fill(null);
    };
    const leave = (f: Friend, now: number) => {
      if (f.state === "riding") {
        const w = new THREE.Vector3();
        f.fig.root.getWorldPosition(w);
        scene.attach(f.fig.root);
        seats[f.seat] = null;
        f.from.copy(w);
        f.to.set(w.x, P.y, P.z0 + 1.6);
        f.state = "hopOut";
      } else f.state = "leaving";
      f.t0 = now;
    };
    const board = (f: Friend, seat: number, now: number) => {
      seats[seat] = f;
      f.seat = seat;
      f.state = "walking";
      f.t0 = now;
      const w = seatWorld(seat);
      f.to.set(w.x, P.y, P.z0 + 1.2);
    };

    const updateTrain = (now: number, dt: number) => {
      const brake = 2.4,
        cruise = demo ? 7 : 8;
      const ahead = (((STOP - train.s) % LOOP) + LOOP) % LOOP;
      const landing = friends.some((f) => f.state === "falling");
      if (train.mode === "cruise" || train.mode === "leaving") {
        train.v = Math.min(
          cruise,
          train.v + (train.mode === "leaving" ? 2.2 : 3) * dt,
        );
        if (train.v >= cruise) train.mode = "cruise";
        const want = waiting().length > 0 || landing;
        if (
          train.mode === "cruise" &&
          want &&
          ahead > 0.5 &&
          ahead <= (train.v * train.v) / (2 * brake) + 0.4
        ) {
          train.mode = "braking";
          play("horn");
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
          diorama.signal(false);
          play("bell");
        }
      }
      if (train.mode === "stopped") {
        const busy = friends.some(
          (f) =>
            f.state === "walking" ||
            f.state === "hopIn" ||
            f.state === "hopOut",
        );
        if (now - train.t0 > 1 && now - train.lastAction > 0.6) {
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
          !busy &&
          !landing &&
          now - train.lastAction > 1.4 &&
          now - train.t0 > 2.5
        ) {
          train.mode = "leaving";
          diorama.signal(true);
          play("horn");
        }
      }
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
      loco.rods?.forEach((rod) => {
        rod.position.x = Math.cos(crank) * 0.55;
        rod.position.y = 1.15 + Math.sin(crank) * 0.55;
      });
      train.chug += move;
      if (train.v > 1 && train.chug > 3.4) {
        train.chug = 0;
        play("chug");
      }
      const gap = train.v > 0.5 ? Math.max(0.09, 0.5 - train.v * 0.05) : 0.8;
      if (now - train.puffAt > gap) {
        train.puffAt = now;
        const top = loco.group.localToWorld(loco.chimney!.clone());
        const back = new THREE.Vector3(-1, 0, 0)
          .applyQuaternion(loco.group.quaternion)
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
      if (f.fig.flag) f.fig.flag.rotation.y = Math.sin(now * 5 + f.seed) * 0.25;
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
            f.state = "waiting";
            r.rotation.z = 0;
            f.vy = 0;
            ack(f);
            sparkle(r.position.clone().add(new THREE.Vector3(0, 4, 0)));
          }
        }
        return;
      }
      if (f.state === "waiting") {
        const s = spot(idx);
        const d = s.clone().sub(r.position);
        d.y = 0;
        const dist = d.length();
        if (dist > 0.05) {
          const step = Math.min(dist, 6 * dt);
          r.position.addScaledVector(d.normalize(), step);
          r.rotation.y +=
            (Math.atan2(d.x, d.z) - r.rotation.y) * Math.min(1, dt * 10);
          pose(f.fig, now * 10);
        } else {
          r.rotation.y += (0 - r.rotation.y) * Math.min(1, dt * 4);
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
        r.position.lerpVectors(f.from, to, ease(k));
        r.position.y += Math.sin(k * Math.PI) * 5;
        r.rotation.y = Math.PI * (1 - k) + coaches[0].group.rotation.y * k;
        pose(f.fig, 0, k > 0.6);
        if (k >= 1) {
          const v = coaches[Math.floor(f.seat / SEATS_PER)];
          v.group.add(r);
          r.position.copy(v.seats[f.seat % SEATS_PER]);
          r.rotation.set(0, 0, 0);
          f.state = "riding";
          f.boardedAt = now;
          f.stop = train.stops;
        }
        return;
      }
      if (f.state === "riding") {
        pose(f.fig, 0, true);
        f.fig.head.rotation.y = Math.sin(now * 0.9 + f.seed) * 0.3;
        if (train.v > 1)
          f.fig.armL.rotation.x = -1.6 - Math.sin(now * 8 + f.seed) * 0.4;
        return;
      }
      if (f.state === "hopOut") {
        const k = Math.min(1, t / 0.7);
        r.position.lerpVectors(f.from, f.to, ease(k));
        r.position.y += Math.sin(k * Math.PI) * 4;
        r.rotation.y = (k * -Math.PI) / 2;
        pose(f.fig, 0, k < 0.4);
        if (k >= 1) {
          f.state = "leaving";
          f.t0 = now;
        }
        return;
      }
      if (f.state === "leaving") {
        // Stroll to the station building and go inside.
        const goal = new THREE.Vector3(P.x0 + 0.5, P.y, r.position.z);
        const d = goal.sub(r.position);
        d.y = 0;
        r.rotation.y = -Math.PI / 2;
        pose(f.fig, now * 11);
        if (d.length() > 0.2) r.position.addScaledVector(d.normalize(), 7 * dt);
        else {
          const s = Math.max(0, r.scale.x - dt * 2.5);
          r.scale.setScalar(s);
          if (s === 0) remove(f);
        }
      }
    };

    // Camera framing that keeps the platform in view on any screen shape.
    let w = 1,
      h = 1;
    const frame = () => {
      const aspect = w / h;
      const far = Math.pow(Math.max(1, 1.65 / aspect), 0.9);
      camera.aspect = aspect;
      camera.fov = aspect < 1 ? 40 : 32;
      // Far enough to see the whole diorama on its table, like walking up to a model railway.
      camera.position.set(0, 2 + 92 * far, 6 + 118 * far);
      camera.updateProjectionMatrix();
      hTilt.uniforms.h.value = 2.4 / (w * renderer.getPixelRatio());
      vTilt.uniforms.v.value = 2.4 / (h * renderer.getPixelRatio());
      hTilt.uniforms.r.value = vTilt.uniforms.r.value = 0.45;
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
      driver = buildFigure({ ...conductor, item: "none" }, img);
      loco.group.add(driver.root);
      driver.root.position.copy(loco.seats[0]);
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
      master.root.position.set(P.x1 - 4, P.y, P.z0 + 2.4);
      master.root.rotation.y = -0.4;
      scene.add(master.root);
    });

    if (demo) {
      let n = 0;
      const drop = () => {
        if (disposed) return;
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
      diorama.update(now, dt);
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
      // A still camera: a moving one makes thousands of tiny studs shimmer.
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
        play("horn");
        const top = loco.group.localToWorld(loco.chimney!.clone());
        for (let i = 0; i < 6; i++)
          puff(top, new THREE.Vector3((i - 2.5) * 1.2, 7 + i, 0), 1.8, 2);
        return;
      }
    };
    c.addEventListener("pointerdown", hit);
    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      c.removeEventListener("pointerdown", hit);
      if (demo)
        for (const t of JSON.parse(c.dataset.timers || "[]"))
          (clearTimeout(t), clearInterval(t));
      else socket.off("artwork", add).off("reset", reset);
      for (const f of [...friends]) remove(f);
      composer.dispose();
      pmrem.dispose();
      renderer.dispose();
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
