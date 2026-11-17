// The static block diorama: baseplate, oval track, platform, station, forest, town.
import * as THREE from "three";
import {
  C,
  Instancer,
  lowStud,
  brick,
  canvasTexture,
  glass,
  mesh,
  plastic,
  roundBox,
  studGrid,
} from "./kit";

export const TRACK_Y = 1.2;
const R = 14,
  HALF = 30;
export const LOOP = 4 * HALF + 2 * Math.PI * R;
export const PLATFORM = { z0: 19.4, z1: 27.5, x0: -34, x1: 34, y: 2.4 };

/** Point and heading on the loop at distance s (front straight runs +x at z=+R). */
export function trackAt(s: number) {
  s = ((s % LOOP) + LOOP) % LOOP;
  const arc = Math.PI * R;
  if (s < 2 * HALF) return { x: -HALF + s, z: R, yaw: 0 };
  s -= 2 * HALF;
  if (s < arc) {
    const a = s / R;
    return { x: HALF + Math.sin(a) * R, z: Math.cos(a) * R, yaw: a };
  }
  s -= arc;
  if (s < 2 * HALF) return { x: HALF - s, z: -R, yaw: Math.PI };
  s -= 2 * HALF;
  const a = s / R;
  return { x: -HALF - Math.sin(a) * R, z: -Math.cos(a) * R, yaw: Math.PI + a };
}

export interface Diorama {
  root: THREE.Group;
  signal: (go: boolean) => void;
  cars: { group: THREE.Group; speed: number; lane: number }[];
  /** Waving flag of the station master. */
  update: (t: number, dt: number) => void;
}

function ribbon(width: number, y: number, step = 0.5) {
  const pos: number[] = [],
    idx: number[] = [];
  const n = Math.ceil(LOOP / step);
  for (let i = 0; i <= n; i++) {
    const p = trackAt(i * step),
      nx = Math.sin(p.yaw),
      nz = Math.cos(p.yaw);
    pos.push(
      p.x - (nx * width) / 2,
      y,
      p.z - (nz * width) / 2,
      p.x + (nx * width) / 2,
      y,
      p.z + (nz * width) / 2,
    );
    if (i < n)
      idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function rail(offset: number) {
  const pts: THREE.Vector3[] = [];
  for (let s = 0; s < LOOP; s += 1) {
    const p = trackAt(s);
    pts.push(
      new THREE.Vector3(
        p.x + Math.sin(p.yaw) * offset,
        TRACK_Y - 0.15,
        p.z + Math.cos(p.yaw) * offset,
      ),
    );
  }
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts, true),
    600,
    0.22,
    6,
    true,
  );
}

function pine(inst: Instancer, x: number, z: number, s: number, shade = 0) {
  const green = [C.green, "#2d6e3e", "#1f6b39"][shade % 3];
  inst.add(
    "trunk",
    TRUNK,
    plastic(C.reddishBrown),
    [x, 0.7 * s, z],
    [0, 0, 0],
    [s, s, s],
  );
  const layers = [
    [2.4, 2.6, 1.3],
    [1.95, 2.3, 2.9],
    [1.45, 2.0, 4.3],
    [0.95, 1.7, 5.5],
  ];
  for (const [r, h, y] of layers)
    inst.add(
      "cone" + green,
      CONE,
      PINE(green),
      [x, y * s, z],
      [0, x * 7 + z, 0],
      [r * s, h * s, r * s],
    );
}
const TRUNK = new THREE.CylinderGeometry(0.45, 0.5, 1.4, 10);
const CONE = new THREE.ConeGeometry(1, 1, 9);
const pineMats = new Map<string, THREE.Material>();
const PINE = (c: string) => {
  let m = pineMats.get(c);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.45,
      flatShading: true,
    });
    pineMats.set(c, m);
  }
  return m;
};
const LEAF = new THREE.IcosahedronGeometry(1, 1);
function roundTree(inst: Instancer, x: number, z: number, s: number) {
  inst.add(
    "trunk",
    TRUNK,
    plastic(C.reddishBrown),
    [x, 1.2 * s, z],
    [0, 0, 0],
    [s, s * 1.8, s],
  );
  const leaf = PINE(C.brightGreen);
  inst.add(
    "leaf",
    LEAF,
    leaf,
    [x, 3.6 * s, z],
    [0, x, 0],
    [2.2 * s, 1.9 * s, 2.2 * s],
  );
  inst.add(
    "leaf",
    LEAF,
    leaf,
    [x - 1.1 * s, 3.0 * s, z + 0.6 * s],
    [0, z, 0],
    [1.4 * s, 1.3 * s, 1.4 * s],
  );
  inst.add(
    "leaf",
    LEAF,
    leaf,
    [x + 1.2 * s, 3.2 * s, z - 0.3 * s],
    [0, x + z, 0],
    [1.4 * s, 1.3 * s, 1.4 * s],
  );
}
const FLOWER = new THREE.CylinderGeometry(0.32, 0.32, 0.4, 10);

function building(
  root: THREE.Group,
  inst: Instancer,
  x: number,
  z: number,
  w: number,
  d: number,
  floors: number,
  color: string,
  roof: string,
) {
  const h = floors * 3.6;
  const b = mesh(roundBox(w, h, d, 0.1), plastic(color));
  b.position.set(x, h / 2, z);
  root.add(b);
  const top = brick(w + 0.4, d + 0.4, 0.6, roof);
  top.position.set(x, h, z);
  root.add(top);
  // Window grid on the side facing the camera.
  const cols = Math.floor((w - 1) / 3);
  for (let f = 0; f < floors; f++)
    for (let c = 0; c < cols; c++) {
      const wx = x - ((cols - 1) * 3) / 2 + c * 3;
      inst.add(
        "winFrame",
        WIN_FRAME,
        plastic(C.white),
        [wx, f * 3.6 + 1.9, z + d / 2 + 0.05],
        [0, 0, 0],
        [1, 1, 1],
        false,
      );
      inst.add(
        "winPane",
        WIN_PANE,
        plastic(C.glass, { rough: 0.08, metal: 0.2 }),
        [wx, f * 3.6 + 1.9, z + d / 2 + 0.15],
        [0, 0, 0],
        [1, 1, 1],
        false,
      );
    }
}

const WIN_FRAME = roundBox(2.0, 2.2, 0.3, 0.05, 1);
const WIN_PANE = roundBox(1.6, 1.8, 0.2, 0.03, 1);
function stationHouse(root: THREE.Group, x: number, z: number) {
  const w = 16,
    d = 11,
    h = 9.6;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  root.add(g);
  // Two-tone brick walls.
  const base = mesh(roundBox(w, 2.4, d, 0.1), plastic(C.darkTan));
  base.position.y = 1.2;
  g.add(base);
  const wall = mesh(roundBox(w - 0.4, h - 2.4, d - 0.4, 0.1), plastic(C.tan));
  wall.position.y = 2.4 + (h - 2.4) / 2;
  g.add(wall);
  // Arched windows and a big door on the front.
  for (const wx of [-5, 5]) {
    const f = mesh(roundBox(3.2, 4.4, 0.4, 0.2), plastic(C.white));
    f.position.set(wx, 5.4, d / 2);
    g.add(f);
    const p = mesh(roundBox(2.6, 3.8, 0.3, 0.2), glass, false, false);
    p.position.set(wx, 5.4, d / 2 + 0.12);
    g.add(p);
  }
  const door = mesh(roundBox(4, 5.4, 0.4, 0.15), plastic(C.darkBlue));
  door.position.set(0, 2.7, d / 2);
  g.add(door);
  // Side door at platform height, where friends walk into the station.
  const side = mesh(roundBox(0.4, 4.6, 3.4, 0.15), plastic(C.darkBlue));
  side.position.set(w / 2 + 0.05, 2.4 + 2.3, -2);
  g.add(side);
  const sideFrame = mesh(roundBox(0.3, 5.2, 4.2, 0.1), plastic(C.white));
  sideFrame.position.set(w / 2 - 0.02, 2.4 + 2.5, -2);
  g.add(sideFrame);
  const doorGlass = mesh(roundBox(3.2, 2.4, 0.3, 0.1), glass, false, false);
  doorGlass.position.set(0, 3.6, d / 2 + 0.12);
  g.add(doorGlass);
  // Sign over the door.
  const sign = canvasTexture(512, 128, (c) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = "#0a3463";
    c.fillRect(0, 0, 512, 14);
    c.fillRect(0, 114, 512, 14);
    c.font = "bold 76px Jua, 'Apple SD Gothic Neo', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("슝슝역", 256, 68);
  });
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 2),
    new THREE.MeshStandardMaterial({ map: sign, roughness: 0.4 }),
  );
  board.position.set(0, 7.7, d / 2 + 0.25);
  g.add(board);
  // Stepped roof.
  for (let i = 0; i < 3; i++) {
    const r = brick(w + 1.2 - i * 3, d + 1.2 - i * 3, 1.2, C.darkBlue, i === 2);
    r.position.y = h + i * 1.2;
    g.add(r);
  }
  // Clock tower.
  const tower = mesh(roundBox(5, 6, 5, 0.1), plastic(C.tan));
  tower.position.set(0, h + 3.6 + 3, 0);
  g.add(tower);
  const clock = canvasTexture(256, 256, (c) => {
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(128, 128, 120, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 14;
    c.strokeStyle = "#1b2a34";
    c.stroke();
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(128, 128);
    c.lineTo(128, 50);
    c.moveTo(128, 128);
    c.lineTo(180, 150);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.fillStyle = "#1b2a34";
      c.beginPath();
      c.arc(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96, 7, 0, Math.PI * 2);
      c.fill();
    }
  });
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 32),
    new THREE.MeshStandardMaterial({ map: clock, roughness: 0.3 }),
  );
  face.position.set(0, h + 3.6 + 3.4, 2.56);
  g.add(face);
  const cap = mesh(new THREE.ConeGeometry(4.2, 4, 4), plastic(C.darkBlue));
  cap.rotation.y = Math.PI / 4;
  cap.position.set(0, h + 3.6 + 6 + 2, 0);
  g.add(cap);
  const spire = mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 2, 8),
    plastic(C.yellow, { metal: 0.6 }),
  );
  spire.position.set(0, h + 3.6 + 6 + 4.8, 0);
  g.add(spire);
}

function lamp(root: THREE.Group, x: number, z: number, y = 0) {
  const pole = mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 7, 10),
    plastic(C.black),
  );
  pole.position.set(x, y + 3.5, z);
  root.add(pole);
  const head = mesh(
    new THREE.SphereGeometry(0.7, 16, 12),
    new THREE.MeshStandardMaterial({
      color: "#fff8dc",
      emissive: "#ffd98a",
      emissiveIntensity: 2.4,
      roughness: 0.2,
    }),
  );
  head.position.set(x, y + 7.4, z);
  root.add(head);
  const cap = mesh(new THREE.ConeGeometry(0.8, 0.5, 12), plastic(C.black));
  cap.position.set(x, y + 8.2, z);
  root.add(cap);
}

function car(color: string) {
  const g = new THREE.Group();
  const body = mesh(roundBox(5, 1.3, 2.8, 0.25), plastic(color));
  body.position.y = 1.15;
  g.add(body);
  const cab = mesh(roundBox(2.8, 1.2, 2.5, 0.25), glass);
  cab.position.set(-0.3, 2.35, 0);
  g.add(cab);
  const roof = mesh(roundBox(2.8, 0.25, 2.6, 0.1), plastic(color));
  roof.position.set(-0.3, 3.05, 0);
  g.add(roof);
  for (const x of [-1.6, 1.6])
    for (const z of [-1.35, 1.35]) {
      const w = mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.4, 16).rotateX(Math.PI / 2),
        plastic(C.black),
      );
      w.position.set(x, 0.55, z);
      g.add(w);
    }
  return g;
}

export function buildDiorama(): Diorama {
  const root = new THREE.Group();
  const inst = new Instancer();
  const X0 = -64,
    X1 = 64,
    Z0 = -50,
    Z1 = 40;
  // Table and the thick baseplate stack.
  const table = mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: "#a97f5a", roughness: 0.75 }),
    false,
    true,
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -3.8;
  root.add(table);
  // The slab ends below the green plate (never at the same height, or the faces flicker).
  const slab = mesh(roundBox(X1 - X0, 3.2, Z1 - Z0, 0.2), plastic(C.darkGray));
  slab.position.set(0, -2.0, (Z0 + Z1) / 2);
  root.add(slab);
  const plate = mesh(
    roundBox(X1 - X0, 0.4, Z1 - Z0, 0.05),
    plastic(C.brightGreen),
  );
  plate.position.set(0, -0.2, (Z0 + Z1) / 2);
  root.add(plate);

  // Track: ballast, sleepers, rails.
  const ballast = mesh(
    ribbon(9.2, 0.25),
    plastic(C.darkGray, { rough: 0.7 }),
    false,
    true,
  );
  root.add(ballast);
  const sleeper = roundBox(7.4, 0.5, 1.0, 0.06, 1);
  for (let s = 0; s < LOOP; s += 1.6) {
    const p = trackAt(s);
    inst.add(
      "sleeper",
      sleeper,
      plastic(C.reddishBrown),
      [p.x, 0.5, p.z],
      [0, p.yaw + Math.PI / 2, 0],
      [1, 1, 1],
      false,
    );
  }
  const steel = plastic(C.lightGray, { metal: 0.7, rough: 0.28 });
  root.add(
    mesh(rail(2.35), steel, true, true),
    mesh(rail(-2.35), steel, true, true),
  );

  // Platform: grey tiles, yellow studded edge, brick front face.
  const P = PLATFORM;
  const pw = P.x1 - P.x0,
    pd = P.z1 - P.z0;
  const pbase = mesh(roundBox(pw, P.y - 0.2, pd, 0.1), plastic("#6f7477"));
  pbase.position.set((P.x0 + P.x1) / 2, (P.y - 0.2) / 2, (P.z0 + P.z1) / 2);
  root.add(pbase);
  const tile = roundBox(1.96, 0.2, 1.96, 0.05, 1);
  for (let x = P.x0 + 1; x < P.x1; x += 2)
    for (let z = P.z0 + 2; z < P.z1; z += 2)
      inst.add(
        "tile",
        tile,
        plastic("#9ea3a6"),
        [x, P.y - 0.1, z + 0.0],
        [0, 0, 0],
        [1, 1, 1],
        false,
      );
  for (let x = P.x0 + 0.5; x < P.x1; x += 1) {
    inst.add(
      "edge",
      roundBox(0.98, 0.2, 0.98, 0.04, 1),
      plastic(C.yellow),
      [x, P.y - 0.1, P.z0 + 0.5],
      [0, 0, 0],
      [1, 1, 1],
      false,
    );
    inst.add(
      "edgeStud",
      lowStud,
      plastic(C.yellow),
      [x, P.y, P.z0 + 0.5],
      [0, 0, 0],
      [1, 1, 1],
      false,
    );
  }
  const brickGeo = roundBox(3.94, 1.14, 0.3, 0.05, 1);
  for (let row = 0; row < 2; row++)
    for (let x = P.x0 + (row ? 1 : 2); x < P.x1 - 1; x += 4)
      inst.add(
        "pbrick",
        brickGeo,
        plastic("#b5b9bb"),
        [x, 0.6 + row * 1.2, P.z1 + 0.05],
        [0, 0, 0],
        [1, 1, 1],
        false,
      );

  stationHouse(root, -46, 26);
  const walkway = mesh(
    roundBox(4.4, PLATFORM.y - 0.2, 4.4, 0.1),
    plastic("#9ea3a6"),
  );
  walkway.position.set(-36, (PLATFORM.y - 0.2) / 2, 24);
  root.add(walkway);
  for (const x of [P.x0 + 1.5, P.x1 - 1.5]) lamp(root, x, P.z1 - 1.5, P.y);
  for (const x of [-24, 24]) {
    const bench = brick(4, 1, 0.8, C.reddishBrown, false);
    bench.position.set(x, P.y + 0.6, P.z1 - 1.2);
    root.add(bench);
    for (const lx of [-1.5, 1.5]) {
      const leg = mesh(roundBox(0.4, 0.6, 0.8, 0.04), plastic(C.black));
      leg.position.set(x + lx, P.y + 0.3, P.z1 - 1.2);
      root.add(leg);
    }
  }

  // Signal by the track.
  const sx = 38,
    sz = 20.5;
  const post = mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 8, 10),
    plastic(C.darkGray),
  );
  post.position.set(sx, 4, sz);
  root.add(post);
  const box = mesh(roundBox(1.4, 3, 1, 0.15), plastic(C.black));
  box.position.set(sx, 8.4, sz);
  root.add(box);
  const red = new THREE.MeshStandardMaterial({
    color: "#ff3b30",
    emissive: "#ff2010",
    emissiveIntensity: 0,
  });
  const green = new THREE.MeshStandardMaterial({
    color: "#36d36b",
    emissive: "#20ff60",
    emissiveIntensity: 0,
  });
  const lr = mesh(new THREE.SphereGeometry(0.42, 16, 10), red, false);
  lr.position.set(sx, 9.2, sz + 0.5);
  const lg = mesh(new THREE.SphereGeometry(0.42, 16, 10), green, false);
  lg.position.set(sx, 7.7, sz + 0.5);
  root.add(lr, lg);

  // Road and town behind the back straight.
  const road = mesh(
    roundBox(X1 - X0, 0.4, 10, 0.05),
    plastic("#5b5d58", { rough: 0.6 }),
    false,
    true,
  );
  road.position.set(0, 0.2, -27);
  root.add(road);
  for (let x = X0 + 3; x < X1; x += 6) {
    const dash = mesh(
      roundBox(3, 0.05, 0.4, 0.02),
      plastic(C.white),
      false,
      true,
    );
    dash.position.set(x, 0.43, -27);
    root.add(dash);
  }
  const town: [number, number, number, string, string][] = [
    [-52, 16, 4, C.tan, C.darkGray],
    [-34, 14, 6, "#b40000", C.black],
    [-17, 16, 3, C.yellow, C.darkGray],
    [1, 14, 5, C.white, C.darkBlue],
    [18, 16, 4, "#6c96bf", C.darkGray],
    [35, 14, 7, C.tan, C.black],
    [52, 16, 3, "#a0bcac", C.darkGray],
  ];
  for (const [x, w, f, c, r] of town)
    building(root, inst, x, -42, w, 10, f, c, r);
  const cars = [
    { group: car(C.blue), speed: 7, lane: -24.6 },
    { group: car(C.yellow), speed: -5.5, lane: -29.4 },
    { group: car(C.white), speed: 6, lane: -24.6 },
  ];
  cars.forEach((c, i) => {
    c.group.position.set(-40 + i * 37, 0.4, c.lane);
    if (c.speed < 0) c.group.rotation.y = Math.PI;
    root.add(c.group);
  });

  // Forest inside the loop and around the edges.
  const rnd = (() => {
    let s = 7;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  })();
  const covered = (x: number, z: number) => {
    // Distance to the loop centre line.
    const cx = Math.max(-HALF, Math.min(HALF, x));
    const dl = Math.hypot(x - cx, z) - R;
    if (Math.abs(dl) < 5.2) return true;
    if (x > P.x0 - 1 && x < P.x1 + 1 && z > P.z0 - 1 && z < P.z1 + 1)
      return true;
    if (x > -55 && x < -37 && z > 19.5 && z < 32.5) return true;
    if (z < -21.5) return true;
    return false;
  };
  const trees: [number, number][] = [];
  const free = (x: number, z: number, r: number) =>
    !covered(x, z) && trees.every(([a, b]) => Math.hypot(a - x, b - z) > r);
  // Dense pines in the loop's back half; round trees and bushes up front.
  for (let i = 0; i < 400 && trees.length < 46; i++) {
    const x = -38 + rnd() * 76,
      z = -8 + rnd() * 10;
    if (
      free(x, z, 4.2) &&
      Math.hypot(Math.max(0, Math.abs(x) - HALF), z) < R - 6
    ) {
      trees.push([x, z]);
      pine(inst, x, z, 0.8 + rnd() * 0.45, i);
    }
  }
  for (let i = 0; i < 200; i++) {
    const x = -30 + rnd() * 60,
      z = 2 + rnd() * 6;
    if (free(x, z, 4)) {
      trees.push([x, z]);
      if (rnd() < 0.5) roundTree(inst, x, z, 0.8 + rnd() * 0.3);
      else
        inst.add(
          "leaf",
          LEAF,
          PINE(C.brightGreen),
          [x, 0.8, z],
          [0, x, 0],
          [1.6, 1.1, 1.6],
        );
    }
  }
  for (let i = 0; i < 400; i++) {
    const x = X0 + 2 + rnd() * (X1 - X0 - 4),
      z = rnd() < 0.5 ? -21 + rnd() * 3 : 29 + rnd() * 9;
    if (free(x, z, 3.6)) {
      trees.push([x, z]);
      if (z > 0 && rnd() < 0.6) {
        const col = [C.brightRed, C.yellow, C.pink, C.white, C.orange][
          Math.floor(rnd() * 5)
        ];
        for (let k = 0; k < 5; k++)
          inst.add(
            "flower" + col,
            FLOWER,
            plastic(col),
            [x + (rnd() - 0.5) * 3, 0.2, z + (rnd() - 0.5) * 2],
            [0, 0, 0],
            [1, 1, 1],
            false,
          );
      } else if (z > 0)
        // Only low bushes in front of the platform, so nothing hides the friends.
        inst.add(
          "leaf",
          LEAF,
          PINE(C.brightGreen),
          [x, 0.6, z],
          [0, x, 0],
          [1.4, 0.9, 1.4],
        );
      else if (rnd() < 0.5) pine(inst, x, z, 0.7 + rnd() * 0.3, i);
      else roundTree(inst, x, z, 0.75);
    }
  }
  for (const [x, z] of [
    [50, 8],
    [56, -6],
    [-58, 4],
    [-52, -10],
    [48, -14],
    [58, 14],
  ] as const)
    pine(inst, x, z, 1.1, 1);

  // Studs on every uncovered patch of baseplate.
  for (let x = X0 + 0.5; x < X1; x += 1)
    for (let z = Z0 + 0.5; z < Z1; z += 1)
      if (!covered(x, z))
        inst.add(
          "stud",
          lowStud,
          plastic(C.brightGreen),
          [x, 0, z],
          [0, 0, 0],
          [1, 1, 1],
          false,
        );
  inst.build(root);
  void studGrid;

  const signal = (go: boolean) => {
    red.emissiveIntensity = go ? 0 : 3;
    green.emissiveIntensity = go ? 3 : 0;
  };
  signal(true);
  return {
    root,
    signal,
    cars,
    update: (_t, dt) => {
      for (const c of cars) {
        c.group.position.x += c.speed * dt;
        if (c.group.position.x > X1 + 6) c.group.position.x = X0 - 6;
        if (c.group.position.x < X0 - 6) c.group.position.x = X1 + 6;
      }
    },
  };
}
