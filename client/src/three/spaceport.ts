// Moon-base spaceport: a rocket stands on its pad, friends walk up the gangway
// into its glass passenger deck, it lifts off, loops round the sky nose-first and lands tail-first.
import * as THREE from "three";
import {
  C,
  Instancer,
  brick,
  canvasTexture,
  glass,
  lowStud,
  mesh,
  plastic,
  roundBox,
} from "./kit";
import { Stage } from "./stage";
import { Vehicle } from "./train";
import { shadowSun, skyBackground } from "./stationStage";

const PY = 2.4,
  PAD = new THREE.Vector3(0, 0, -6),
  PAD_TOP = 1.2,
  H = 20,
  R = 30,
  CIRCLE = 2 * Math.PI * R,
  LOOP = H + CIRCLE + H,
  DECK = { x0: -32, x1: 30, z0: 8, z1: 22 };

const glow = (color: string, k = 2.5) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: k,
    roughness: 0.35,
  });

/** Flight route: straight up, a banked loop round the base, straight down. */
function flight(s: number) {
  s = ((s % LOOP) + LOOP) % LOOP;
  if (s < H) return { x: PAD.x, z: PAD.z, y: s, yaw: 0 };
  if (s < H + CIRCLE) {
    const a = (s - H) / R;
    return {
      x: PAD.x + R * Math.sin(a),
      z: PAD.z - R + R * Math.cos(a),
      y: H + 10 * Math.sin(a / 2),
      yaw: a,
      // Nose leans into the turn direction while it flies round.
      roll: -0.95 * Math.sin(a / 2),
    };
  }
  return { x: PAD.x, z: PAD.z, y: H - (s - H - CIRCLE), yaw: 0 };
}

/** A toy rocket: white body, red nose and fins, and a glass passenger deck in the middle. */
export function buildRocket(): Vehicle & { lift: () => number } {
  const g = new THREE.Group();
  g.rotation.order = "YXZ";
  const white = plastic("#f1f3f6", { rough: 0.22, metal: 0.15 }),
    red = plastic(C.red, { rough: 0.25 }),
    R0 = 3.2,
    CABIN = [8, 13.6] as const;
  const tube = (
    from: number,
    to: number,
    mat: THREE.Material,
    r = R0,
    open = false,
  ) => {
    const m = mesh(
      new THREE.CylinderGeometry(r, r, to - from, 40, 1, open),
      mat,
    );
    m.position.y = (from + to) / 2;
    g.add(m);
    return m;
  };
  // Engine bell and lower body.
  const bell = mesh(
    new THREE.CylinderGeometry(1.3, 2.0, 1.8, 32, 1, true),
    plastic(C.darkGray, { metal: 0.6, rough: 0.3 }),
  );
  (bell.material as THREE.Material).side = THREE.DoubleSide;
  bell.position.y = 1.7;
  g.add(bell);
  const base = mesh(new THREE.CylinderGeometry(R0 * 0.9, 2.0, 1.6, 40), white);
  base.position.y = 3.4;
  g.add(base);
  tube(4.2, CABIN[0], white);
  for (const y of [5.4, 6.0]) {
    const band = mesh(
      new THREE.CylinderGeometry(R0 + 0.04, R0 + 0.04, 0.35, 40),
      y === 5.4 ? red : plastic(C.yellow),
    );
    band.position.y = y;
    g.add(band);
  }
  // Passenger deck: glass all round, floor and ceiling, four thin pillars.
  const deck = mesh(
    new THREE.CylinderGeometry(R0, R0, 0.2, 40),
    plastic("#c9d0d6"),
    false,
  );
  deck.position.y = CABIN[0];
  g.add(deck);
  tube(CABIN[0], CABIN[1], glass, R0 + 0.05, true).castShadow = false;
  const ceil = mesh(new THREE.CylinderGeometry(R0, R0, 0.3, 40), white);
  ceil.position.y = CABIN[1];
  g.add(ceil);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = mesh(
      new THREE.CylinderGeometry(0.15, 0.15, CABIN[1] - CABIN[0], 8),
      plastic(C.lightGray, { metal: 0.5 }),
    );
    p.position.set(
      Math.sin(a) * (R0 + 0.05),
      (CABIN[0] + CABIN[1]) / 2,
      Math.cos(a) * (R0 + 0.05),
    );
    g.add(p);
  }
  const lights: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2,
      m = glow(["#ffe066", "#6ff0ff", "#ff7ad9"][i % 3], 2);
    const b = mesh(new THREE.SphereGeometry(0.22, 10, 8), m, false);
    b.position.set(
      Math.sin(a) * (R0 + 0.12),
      CABIN[0] + 0.15,
      Math.cos(a) * (R0 + 0.12),
    );
    g.add(b);
    lights.push(m);
  }
  // Upper body with round windows, then the red nose cone.
  tube(CABIN[1], 19, white);
  const stripe = mesh(
    new THREE.CylinderGeometry(R0 + 0.04, R0 + 0.04, 0.45, 40),
    red,
  );
  stripe.position.y = 18.2;
  g.add(stripe);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const frame = mesh(
      new THREE.TorusGeometry(0.75, 0.16, 8, 24),
      plastic(C.lightGray, { metal: 0.5 }),
    );
    frame.position.set(
      Math.sin(a) * (R0 + 0.02),
      16,
      Math.cos(a) * (R0 + 0.02),
    );
    frame.rotation.y = a;
    g.add(frame);
    const pane = mesh(
      new THREE.CircleGeometry(0.72, 20),
      glow("#8fd8ff", 0.9),
      false,
    );
    pane.position.set(Math.sin(a) * (R0 + 0.05), 16, Math.cos(a) * (R0 + 0.05));
    pane.rotation.y = a;
    g.add(pane);
  }
  const nose = mesh(new THREE.ConeGeometry(R0, 6.2, 40), red);
  nose.position.y = 19 + 3.1;
  g.add(nose);
  const tip = mesh(
    new THREE.SphereGeometry(0.4, 12, 8),
    glow("#ff5a5a", 2.5),
    false,
  );
  tip.position.y = 25.4;
  g.add(tip);
  // Three swept fins that also stand the rocket on the pad.
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(3.4, -0.2);
  finShape.lineTo(3.6, 1.0);
  finShape.lineTo(0.2, 7.5);
  finShape.lineTo(0, 7.5);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.45,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  finGeo.translate(0, 0, -0.22);
  for (const a of [Math.PI / 3, Math.PI, (5 * Math.PI) / 3]) {
    const fin = mesh(finGeo, red);
    fin.rotation.y = a - Math.PI / 2;
    fin.position.set(Math.sin(a) * (R0 - 0.6), 0.2, Math.cos(a) * (R0 - 0.6));
    g.add(fin);
  }
  // Flame under the bell.
  const engine = glow("#ffb347", 1);
  const glowDisc = mesh(
    new THREE.CircleGeometry(1.25, 24).rotateX(Math.PI / 2),
    engine,
    false,
  );
  glowDisc.position.y = 2.55;
  g.add(glowDisc);
  const flameMat = new THREE.MeshBasicMaterial({
    color: "#ffb347",
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(1.8, 7, 24, 1, true)
      .rotateX(Math.PI)
      .translate(0, -3.5, 0),
    flameMat,
  );
  flame.position.y = 0.9;
  g.add(flame);
  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 4.5, 16, 1, true)
      .rotateX(Math.PI)
      .translate(0, -2.25, 0),
    new THREE.MeshBasicMaterial({
      color: "#fff6d0",
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  core.position.y = 0.9;
  g.add(core);
  // Gangway from the passenger deck down to the platform; slides out when docked.
  const ramp = new THREE.Group();
  ramp.position.set(0, CABIN[0] - 0.1, R0);
  g.add(ramp);
  const LEN = 12.8;
  const plank = mesh(
    roundBox(3.2, 0.3, LEN, 0.08),
    plastic(C.lightGray, { metal: 0.3 }),
  );
  plank.position.z = LEN / 2;
  ramp.add(plank);
  for (const x of [-1.5, 1.5]) {
    const rail = mesh(roundBox(0.15, 0.15, LEN - 0.2, 0.05), plastic(C.yellow));
    rail.position.set(x, 1.0, LEN / 2);
    ramp.add(rail);
  }
  const SEAT_R = 1.95;
  const seatYaw = [0, 1, 2, 3, 4].map(
    (i) => (i / 5) * Math.PI * 2 + Math.PI / 5,
  );
  let lift = 0;
  return {
    group: g,
    length: 15,
    wheels: [],
    seats: seatYaw.map(
      (a) =>
        new THREE.Vector3(
          Math.sin(a) * SEAT_R,
          CABIN[0] + 0.1,
          Math.cos(a) * SEAT_R,
        ),
    ),
    seatYaw,
    driverSeat: new THREE.Vector3(0, CABIN[0] + 0.1, 0),
    stand: true,
    lift: () => lift,
    setDoors(open) {
      ramp.rotation.x = 0.56;
      ramp.scale.z = Math.max(0.001, open);
      ramp.visible = open > 0.02;
    },
    animate(t, _dt, speed) {
      const alt = g.position.y - PAD_TOP;
      lift = alt;
      const thrust = speed < 0.2 ? 0 : alt < 18 ? 1 : 0.55;
      const flick = 0.85 + Math.sin(t * 40) * 0.1 + Math.random() * 0.1;
      flame.scale.set(
        0.6 + thrust * 0.5,
        0.15 + thrust * 1.1 * flick,
        0.6 + thrust * 0.5,
      );
      core.scale.copy(flame.scale);
      flame.visible = core.visible = thrust > 0;
      engine.emissiveIntensity = 0.6 + thrust * 3.5;
      lights.forEach(
        (m, i) =>
          (m.emissiveIntensity =
            1.2 + Math.max(0, Math.sin(t * 5 - i * 0.8)) * 2.4),
      );
    },
  };
}

export function spaceportStage(): Stage {
  const root = new THREE.Group(),
    inst = new Instancer();
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = root,
    cast = true,
  ) => {
    const m = mesh(geo, mat, cast);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const X0 = -60,
    X1 = 60,
    Z0 = -44,
    Z1 = 30;
  // Table, base slab and moon-grey baseplate.
  const table = mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshStandardMaterial({ color: "#12142a", roughness: 0.85 }),
    false,
    true,
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -3.8;
  root.add(table);
  add(
    roundBox(X1 - X0, 3.2, Z1 - Z0, 0.2),
    plastic("#3d4250"),
    0,
    -2.0,
    (Z0 + Z1) / 2,
  );
  add(
    roundBox(X1 - X0, 0.4, Z1 - Z0, 0.05),
    plastic("#9aa0a8", { rough: 0.6 }),
    0,
    -0.2,
    (Z0 + Z1) / 2,
  );

  // Launch pad with hazard ring and lights.
  add(
    new THREE.CylinderGeometry(11, 11.6, PAD_TOP, 48),
    plastic("#5c636a", { rough: 0.5 }),
    PAD.x,
    PAD_TOP / 2,
    PAD.z,
  );
  const ring = mesh(
    new THREE.RingGeometry(8.4, 9.6, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(256, 16, (c) => {
        for (let i = 0; i < 16; i++) {
          c.fillStyle = i % 2 ? "#1b2a34" : "#f2cd37";
          c.fillRect(i * 16, 0, 16, 16);
        }
      }),
      roughness: 0.5,
    }),
    false,
    true,
  );
  ring.position.set(PAD.x, PAD_TOP + 0.02, PAD.z);
  root.add(ring);
  const padMark = mesh(
    new THREE.RingGeometry(3.2, 3.8, 40).rotateX(-Math.PI / 2),
    plastic(C.white),
    false,
    true,
  );
  padMark.position.set(PAD.x, PAD_TOP + 0.02, PAD.z);
  root.add(padMark);
  const padLights: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2,
      m = glow(i % 2 ? "#4dd0ff" : "#ffe066", 2);
    add(
      new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12),
      m,
      PAD.x + Math.sin(a) * 10.4,
      PAD_TOP + 0.15,
      PAD.z + Math.cos(a) * 10.4,
      root,
      false,
    );
    padLights.push(m);
  }

  // Boarding deck: metal tiles, hazard edge, railings with a gap for the ramp.
  const deckW = DECK.x1 - DECK.x0,
    deckD = DECK.z1 - DECK.z0;
  add(
    roundBox(deckW, PY - 0.2, deckD, 0.1),
    plastic("#4a5058"),
    (DECK.x0 + DECK.x1) / 2,
    (PY - 0.2) / 2,
    (DECK.z0 + DECK.z1) / 2,
  );
  for (let x = DECK.x0 + 1; x < DECK.x1; x += 2)
    for (let z = DECK.z0 + 2; z < DECK.z1; z += 2)
      inst.add(
        "deck",
        roundBox(1.94, 0.2, 1.94, 0.04, 1),
        plastic((x + z) % 4 === 0 ? "#8d96a0" : "#a3abb4", {
          rough: 0.4,
          metal: 0.3,
        }),
        [x, PY - 0.1, z],
        [0, 0, 0],
        [1, 1, 1],
        false,
      );
  for (let x = DECK.x0 + 0.5; x < DECK.x1; x += 1) {
    inst.add(
      "haz" + (Math.floor(x) % 2),
      roundBox(0.98, 0.2, 0.98, 0.04, 1),
      plastic(Math.floor(x) % 2 ? C.yellow : C.black),
      [x, PY - 0.1, DECK.z0 + 0.5],
      [0, 0, 0],
      [1, 1, 1],
      false,
    );
    if (Math.abs(x) > 3)
      inst.add(
        "rail",
        lowStud,
        plastic(C.yellow),
        [x, PY, DECK.z0 + 0.5],
        [0, 0, 0],
        [1, 1, 1],
        false,
      );
  }
  for (const [a, b] of [
    [DECK.x0 + 1, -3],
    [3, DECK.x1 - 1],
  ]) {
    add(
      roundBox(b - a, 0.2, 0.2, 0.08),
      plastic(C.lightGray, { metal: 0.5 }),
      (a + b) / 2,
      PY + 1.9,
      DECK.z0 + 0.6,
    );
    for (let x = a; x <= b; x += 4)
      add(
        new THREE.CylinderGeometry(0.1, 0.1, 1.9, 8),
        plastic(C.lightGray, { metal: 0.5 }),
        x,
        PY + 0.95,
        DECK.z0 + 0.6,
      );
  }
  // Teleporter where new friends appear.
  const tele = new THREE.Vector3(25, PY, 17.5);
  add(
    new THREE.CylinderGeometry(2.4, 2.6, 0.4, 32),
    plastic(C.darkGray, { metal: 0.4 }),
    tele.x,
    PY + 0.2,
    tele.z,
  );
  const teleGlow = glow("#5ef3ff", 2.2);
  add(
    new THREE.CylinderGeometry(1.9, 1.9, 0.1, 32),
    teleGlow,
    tele.x,
    PY + 0.45,
    tele.z,
    root,
    false,
  );
  const beamMat = new THREE.MeshBasicMaterial({
    color: "#7ff6ff",
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 9, 32, 1, true),
    beamMat,
  );
  beam.position.set(tele.x, PY + 4.9, tele.z);
  root.add(beam);
  // Benches at the back of the deck, facing the room.
  for (const x of [-18, 12]) {
    add(roundBox(5, 0.5, 1.6, 0.1), plastic(C.blue), x, PY + 1.6, 20.2);
    add(roundBox(5, 1.6, 0.4, 0.1), plastic(C.blue), x, PY + 2.4, 19.3);
    for (const dx of [-2, 2])
      add(
        roundBox(0.4, 1.4, 1.2, 0.05),
        plastic(C.darkGray),
        x + dx,
        PY + 0.7,
        20.2,
      );
  }

  // Mission control on the left, with a turning radar dish.
  const ctl = new THREE.Group();
  ctl.position.set(-41, 0, 12);
  root.add(ctl);
  add(roundBox(18, 12, 20, 0.2), plastic("#eef1f4"), 0, 6, 0, ctl);
  add(roundBox(18.2, 1.2, 20.2, 0.1), plastic(C.blue), 0, 8.5, 0, ctl);
  for (let i = 0; i < 4; i++)
    add(
      roundBox(0.2, 2.2, 3, 0.05),
      glow("#9fe8ff", 0.6),
      9.05,
      10.3,
      -7.5 + i * 5,
      ctl,
      false,
    );
  add(roundBox(0.4, 4.6, 3.4, 0.15), plastic(C.blue), 9.05, PY + 2.3, 3, ctl);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.2),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(512, 112, (c) => {
        c.fillStyle = "#0a1a3a";
        c.fillRect(0, 0, 512, 112);
        c.fillStyle = "#ffffff";
        c.font = "bold 68px Jua, 'Apple SD Gothic Neo', sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("🚀 슝슝 우주기지", 256, 60);
      }),
      toneMapped: false,
    }),
  );
  sign.position.set(0, 13.6, 10.05);
  ctl.add(sign);
  add(
    new THREE.SphereGeometry(4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    plastic("#d7dde3", { metal: 0.3 }),
    -3,
    12,
    -4,
    ctl,
  );
  const radar = new THREE.Group();
  radar.position.set(4, 12, -5);
  ctl.add(radar);
  add(
    new THREE.CylinderGeometry(0.3, 0.3, 3, 10),
    plastic(C.darkGray),
    0,
    1.5,
    0,
    radar,
  );
  const dish = add(
    new THREE.SphereGeometry(2.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6),
    plastic(C.white, { metal: 0.3 }),
    0,
    3.4,
    0,
    radar,
  );
  dish.rotation.x = -1.1;
  (dish.material as THREE.Material).side = THREE.DoubleSide;
  const beacon = glow("#ff4d4d", 3);
  add(
    new THREE.CylinderGeometry(0.08, 0.08, 6, 6),
    plastic(C.darkGray),
    7,
    15,
    7,
    ctl,
  );
  add(new THREE.SphereGeometry(0.45, 12, 8), beacon, 7, 18.2, 7, ctl, false);

  // Launch tower, fuel tanks, rocks and craters.
  const tower = new THREE.Group();
  tower.position.set(16, 0, -10);
  root.add(tower);
  for (let i = 0; i < 9; i++) {
    const seg = brick(3, 3, 3, i % 2 ? C.white : C.brightRed, i === 8);
    seg.position.y = i * 3;
    tower.add(seg);
  }
  add(
    new THREE.SphereGeometry(0.5, 12, 8),
    glow("#ff4d4d", 3),
    0,
    28,
    0,
    tower,
    false,
  );
  for (const [x, z, col] of [
    [34, -24, C.white],
    [40, -18, C.orange],
    [28, -30, C.white],
  ] as const) {
    add(
      new THREE.CylinderGeometry(3, 3, 9, 28),
      plastic(col, { metal: 0.2 }),
      x,
      4.5,
      z,
    );
    add(
      new THREE.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      plastic(col, { metal: 0.2 }),
      x,
      9,
      z,
    );
  }
  const rnd = (() => {
    let s = 11;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  })();
  const covered = (x: number, z: number) =>
    Math.hypot(x - PAD.x, z - PAD.z) < 12.5 ||
    (x > DECK.x0 - 1 &&
      x < DECK.x1 + 1 &&
      z > DECK.z0 - 1 &&
      z < DECK.z1 + 1) ||
    (x > -51 && x < -31 && z > 1 && z < 23) ||
    (Math.abs(x - 16) < 2.5 && Math.abs(z + 10) < 2.5);
  const rockMat = new THREE.MeshStandardMaterial({
    color: "#7d838c",
    roughness: 0.9,
    flatShading: true,
  });
  for (let i = 0; i < 40; i++) {
    const x = X0 + 3 + rnd() * (X1 - X0 - 6),
      z = Z0 + 3 + rnd() * (Z1 - Z0 - 6);
    if (covered(x, z)) continue;
    if (i % 3 === 0) {
      const r = 2 + rnd() * 3;
      const crater = mesh(
        new THREE.TorusGeometry(r, 0.5, 8, 28),
        plastic("#858b94", { rough: 0.8 }),
        false,
        true,
      );
      crater.rotation.x = Math.PI / 2;
      crater.scale.z = 0.6;
      crater.position.set(x, 0.1, z);
      root.add(crater);
    } else
      inst.add(
        "rock",
        new THREE.IcosahedronGeometry(1, 0),
        rockMat,
        [x, 0.4, z],
        [rnd(), rnd(), rnd()],
        [0.6 + rnd() * 1.4, 0.5 + rnd(), 0.6 + rnd() * 1.4],
      );
  }
  for (let x = X0 + 0.5; x < X1; x += 1)
    for (let z = Z0 + 0.5; z < Z1; z += 1)
      if (!covered(x, z))
        inst.add(
          "stud",
          lowStud,
          plastic("#9aa0a8", { rough: 0.6 }),
          [x, 0, z],
          [0, 0, 0],
          [1, 1, 1],
          false,
        );
  inst.build(root);

  // A little moon rover driving round the back.
  const rover = new THREE.Group();
  root.add(rover);
  add(roundBox(4.4, 1.2, 2.8, 0.2), plastic(C.white), 0, 1.4, 0, rover);
  add(roundBox(2, 1, 2.4, 0.2), glass, -0.6, 2.4, 0, rover);
  add(
    new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6),
    plastic(C.darkGray),
    1.4,
    2.6,
    0.8,
    rover,
  );
  add(
    new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    plastic(C.white),
    1.4,
    3.4,
    0.8,
    rover,
  );
  for (const x of [-1.5, 1.5])
    for (const z of [-1.5, 1.5])
      add(
        new THREE.CylinderGeometry(0.6, 0.6, 0.5, 14).rotateX(Math.PI / 2),
        plastic(C.darkGray),
        x,
        0.6,
        z,
        rover,
      );

  // Starry sky with two planets.
  const starPos: number[] = [];
  for (let i = 0; i < 900; i++) {
    const u = rnd() * Math.PI * 2,
      v = rnd() * 0.5 * Math.PI;
    starPos.push(
      Math.cos(u) * Math.cos(v) * 450,
      Math.sin(v) * 450 + 20,
      Math.sin(u) * Math.cos(v) * 450,
    );
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPos, 3),
  );
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: "#ffffff",
      size: 2,
      sizeAttenuation: false,
      fog: false,
    }),
  );
  root.add(stars);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(30, 48, 24),
    new THREE.MeshStandardMaterial({
      color: "#f2a65a",
      roughness: 0.7,
      fog: false,
    }),
  );
  planet.position.set(-150, 62, -330);
  root.add(planet);
  const rings = new THREE.Mesh(
    new THREE.RingGeometry(40, 58, 64),
    new THREE.MeshStandardMaterial({
      color: "#ffd9a0",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      fog: false,
    }),
  );
  rings.position.copy(planet.position);
  rings.rotation.set(1.2, 0.3, 0.2);
  root.add(rings);
  const blue = new THREE.Mesh(
    new THREE.SphereGeometry(16, 40, 20),
    new THREE.MeshStandardMaterial({
      color: "#4a8ef0",
      emissive: "#173a7a",
      emissiveIntensity: 0.4,
      roughness: 0.6,
      fog: false,
    }),
  );
  blue.position.set(160, 48, -300);
  root.add(blue);

  let ship: ReturnType<typeof buildRocket> | null = null;
  return {
    id: "spaceport",
    label: "블록 친구들이 우주선을 타는 우주기지",
    root,
    setupLights(scene, lite) {
      scene.background = skyBackground("#03051a", "#0f1640", "#2b2350");
      scene.fog = new THREE.Fog("#0f1433", 220, 520);
      scene.add(new THREE.HemisphereLight("#a9c0ff", "#2b2b3a", 0.6));
      const sun = shadowSun("#f2f5ff", 3.0, [-70, 95, 60], lite, 85);
      scene.add(sun);
      return sun;
    },
    frame(camera, aspect) {
      const far = Math.pow(Math.max(1, 1.65 / aspect), 0.9);
      camera.fov = aspect < 1 ? 42 : 36;
      // Low enough to see the ship climb into the sky above the base.
      // Low and close: the base along the bottom, the sky (and the flying ship) above.
      camera.position.set(0, 10 + 24 * far, 6 + 86 * far);
      return new THREE.Vector3(0, 17, -10);
    },
    focus: 0.42,
    trackY: PAD_TOP,
    loop: LOOP,
    trackAt: flight,
    alwaysStop: true,
    dwell: 6,
    speed: 12,
    buildTrain() {
      ship = buildRocket();
      return { vehicles: [ship], gap: 0 };
    },
    stopAt: () => 0,
    platformY: PY,
    spot(i) {
      const perRow = 13,
        row = i < perRow ? 0 : 1,
        j = row ? i - perRow : i;
      return new THREE.Vector3(-24 + j * 4 + row * 2, PY, row ? 15.6 : 12.4);
    },
    maxWaiting: 24,
    arrival: { points: [tele.clone(), new THREE.Vector3(21, PY, 15.5)] },
    boardPoint: () => new THREE.Vector3(0, PY, DECK.z0 + 0.6),
    alightPoint: () => new THREE.Vector3(0, PY, DECK.z0 + 1.2),
    exitPath: (from) => ({
      points: [
        new THREE.Vector3(Math.max(DECK.x0 + 1, from.x), PY, 15),
        new THREE.Vector3(-31.5, PY, 15),
        new THREE.Vector3(-36, PY, 15),
      ],
    }),
    hopHeight: 2.2,
    benches: [-18, 12].flatMap((x) =>
      [-1.6, 0, 1.6].map((dx) => ({
        pos: new THREE.Vector3(x + dx, PY + 0.3, 20.2),
        yaw: 0,
        approach: new THREE.Vector3(x + dx, PY, 21.5),
      })),
    ),
    wander() {
      for (;;) {
        const p = new THREE.Vector3(
          -28 + Math.random() * 56,
          PY,
          10 + Math.random() * 8.5,
        );
        if (!(Math.abs(p.x - tele.x) < 3.2 && Math.abs(p.z - tele.z) < 3.2))
          return p;
      }
    },
    watchSpot: () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      return {
        pos: new THREE.Vector3(
          side * (5 + Math.random() * 21),
          PY,
          DECK.z0 + 1.4,
        ),
        yaw: Math.PI,
      };
    },
    hasDoors: true,
    setDoors: () => {},
    master: { pos: new THREE.Vector3(-8, PY, DECK.z0 + 1.6), yaw: 0.3 },
    steam: false,
    sounds: {
      approach: "landing",
      stop: "spaceBeep",
      depart: "liftoff",
      move: "hum",
      moveEvery: 10,
      horn: "spaceBeep",
    },
    update(t, dt, info) {
      radar.rotation.y += dt * 0.8;
      beacon.emissiveIntensity = Math.sin(t * 4) > 0 ? 4 : 0.3;
      teleGlow.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.8;
      beamMat.opacity = 0.12 + Math.sin(t * 3) * 0.06;
      padLights.forEach(
        (m, i) =>
          (m.emissiveIntensity =
            info.mode === "stopped"
              ? 2.2
              : 0.8 + Math.max(0, Math.sin(t * 8 - i)) * 3),
      );
      const a = t * 0.12;
      rover.position.set(Math.sin(a) * 34, 0, -26 + Math.cos(a) * 10);
      rover.rotation.y = a + Math.PI / 2;
      // Smoke billowing over the pad on lift-off and landing.
      if (
        ship &&
        info.speed > 0.2 &&
        ship.lift() < 14 &&
        Math.random() < dt * 30
      ) {
        const ang = Math.random() * Math.PI * 2;
        info.puff(
          new THREE.Vector3(
            PAD.x + Math.cos(ang) * 3,
            PAD_TOP + 0.6,
            PAD.z + Math.sin(ang) * 3,
          ),
          new THREE.Vector3(
            Math.cos(ang) * 9,
            1.5 + Math.random() * 2,
            Math.sin(ang) * 9,
          ),
          2.2,
          1.8,
          "#d9dde3",
          1.4,
        );
      }
    },
  };
}
