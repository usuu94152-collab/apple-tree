// Underground station seen as a cut-away block model: street on top, platform below,
// a silver metro with sliding doors, platform screen doors and an escalator.
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
import { figureSvg, loadImage, sampleDesigns, svgUrl } from "../objects/figure";

const X = 54,
  ZB = -10,
  ZF = 22,
  CEIL = 18,
  STREET = 19.4,
  PY = 2.4,
  TRACK_Z = -0.5,
  LINE = "#2fae4a",
  CAR = 18,
  GAP = 1.6,
  LOOP = 260;
const TRACK_Y = 1.2;
const DOORS_LOCAL = [-4.5, 4.5];
/** Car centres when the train is stopped (lead car first, moving +x). */
const STOPPED = [CAR + GAP, 0, -(CAR + GAP)];
const DOOR_X = STOPPED.flatMap((c) => DOORS_LOCAL.map((d) => c + d)).sort(
  (a, b) => a - b,
);
const ESC = {
  top: new THREE.Vector3(46.5, STREET, 17.2),
  bottom: new THREE.Vector3(30.5, PY, 17.2),
};

const silver = () => plastic("#d9dde1", { rough: 0.25, metal: 0.35 });
const line = () => plastic(LINE);
const darkGlass = new THREE.MeshStandardMaterial({
  color: "#8fb3c4",
  roughness: 0.05,
  metalness: 0.2,
  transparent: true,
  opacity: 0.28,
  envMapIntensity: 1.2,
});
const glow = (color: string, k = 2.5) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: k,
    roughness: 0.4,
  });

function ledTexture(text: string, color = "#ff9d2e", bg = "#111315") {
  return canvasTexture(512, 96, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, 512, 96);
    c.fillStyle = color;
    // Shrink long messages so they always fit the board.
    let size = 50;
    c.font = `bold ${size}px Jua, 'Apple SD Gothic Neo', sans-serif`;
    const w = c.measureText(text).width;
    if (w > 480) size = Math.floor((size * 480) / w);
    c.font = `bold ${size}px Jua, 'Apple SD Gothic Neo', sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 256, 52);
  });
}

export function buildSubwayCar(lead: boolean): Vehicle {
  const g = new THREE.Group(),
    W = 5.8,
    L = CAR,
    wheels: THREE.Mesh[] = [];
  const under = mesh(roundBox(L - 1, 0.9, W - 0.6, 0.1), plastic(C.darkGray));
  under.position.y = 0.75;
  g.add(under);
  for (const bx of [-6, 6])
    for (const dx of [-1, 1])
      for (const z of [-2.3, 2.3]) {
        const w = mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 0.3, 16).rotateX(Math.PI / 2),
          plastic(C.black),
        );
        w.position.set(bx + dx, 0.55, z);
        g.add(w);
        wheels.push(w);
      }
  const floor = mesh(roundBox(L - 0.4, 0.2, W - 0.4, 0.04), plastic("#8c9196"));
  floor.position.y = 1.1;
  g.add(floor);
  // Side walls between the door openings, with big windows.
  const segs: [number, number][] = [
    [-L / 2, -6.1],
    [-2.9, 2.9],
    [6.1, L / 2],
  ];
  for (const side of [-1, 1]) {
    const z = side * (W / 2 - 0.25);
    for (const [a, b] of segs) {
      const len = b - a,
        cx = (a + b) / 2;
      const low = mesh(roundBox(len, 2.6, 0.5, 0.08), silver());
      low.position.set(cx, 2.5, z);
      const up = mesh(roundBox(len, 1.0, 0.5, 0.08), silver());
      up.position.set(cx, 7.3, z);
      g.add(low, up);
      for (const px of [a + 0.25, b - 0.25]) {
        const p = mesh(roundBox(0.5, 3.0, 0.5, 0.05), silver());
        p.position.set(px, 5.3, z);
        g.add(p);
      }
      const pane = mesh(
        new THREE.PlaneGeometry(len - 0.5, 3.0),
        darkGlass,
        false,
        false,
      );
      pane.position.set(cx, 5.3, z + side * 0.05);
      if (side < 0) pane.rotation.y = Math.PI;
      g.add(pane);
      for (const [y, h] of [
        [3.75, 0.3],
        [6.95, 0.18],
      ]) {
        const s = mesh(roundBox(len, h, 0.1, 0.03), line(), false);
        s.position.set(cx, y, z + side * 0.28);
        g.add(s);
      }
    }
  }
  // Sliding doors (two leaves each); only the platform side (+z) opens.
  const leaves: { m: THREE.Group; base: number; dir: number }[] = [];
  for (const side of [-1, 1])
    for (const d of DOORS_LOCAL)
      for (const dir of [-1, 1]) {
        const leaf = new THREE.Group();
        const body = mesh(roundBox(1.58, 5.8, 0.25, 0.05), silver());
        leaf.add(body);
        const win = mesh(
          new THREE.PlaneGeometry(1.0, 2.2),
          darkGlass,
          false,
          false,
        );
        win.position.set(0, 0.8, side * 0.14);
        if (side < 0) win.rotation.y = Math.PI;
        leaf.add(win);
        const base = d + dir * 0.8;
        leaf.position.set(base, 4.2, side * (W / 2 - 0.2));
        g.add(leaf);
        if (side > 0) leaves.push({ m: leaf, base, dir });
      }
  // Ends, roof, cooling units.
  const ends = lead ? [-L / 2 + 0.25] : [-L / 2 + 0.25, L / 2 - 0.25];
  for (const x of ends) {
    const e = mesh(roundBox(0.5, 6.8, W, 0.08), silver());
    e.position.set(x, 4.6, 0);
    g.add(e);
  }
  const roof = mesh(
    roundBox(L, 0.9, W + 0.1, 0.4),
    plastic("#cfd3d7", { rough: 0.3, metal: 0.3 }),
  );
  roof.position.y = 8.2;
  g.add(roof);
  for (const x of [-4.5, 4.5]) {
    const ac = brick(4, 3, 0.6, "#b9bec3");
    ac.position.set(x, 8.6, 0);
    g.add(ac);
  }
  // Lit interior: ceiling light, long seats, yellow poles.
  const lamp = mesh(
    roundBox(L - 2, 0.15, 1.0, 0.05),
    glow("#fffaf0", 1.6),
    false,
  );
  lamp.position.y = 7.55;
  g.add(lamp);
  for (const [a, b] of segs) {
    const seat = mesh(
      roundBox(b - a - 0.8, 0.9, 1.2, 0.15),
      plastic("#3d7fb8"),
    );
    seat.position.set((a + b) / 2, 1.9, -2.0);
    g.add(seat);
  }
  for (const d of DOORS_LOCAL)
    for (const dx of [-1.9, 1.9]) {
      const pole = mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 6.3, 8),
        plastic(C.yellow, { metal: 0.4 }),
        false,
      );
      pole.position.set(d + dx, 4.35, 0.6);
      g.add(pole);
    }
  let driverSeat: THREE.Vector3 | undefined;
  if (lead) {
    // Rounded nose with windscreen, headlights and destination sign.
    const nose = mesh(roundBox(1.4, 7.0, W, 0.6), silver());
    nose.position.set(L / 2 + 0.2, 4.6, 0);
    g.add(nose);
    const screen = mesh(
      roundBox(0.2, 2.8, W - 1.2, 0.2),
      plastic("#1c2a33", { rough: 0.1, metal: 0.4 }),
    );
    screen.position.set(L / 2 + 0.9, 5.6, 0);
    g.add(screen);
    const band = mesh(roundBox(0.25, 0.5, W - 0.6, 0.1), line());
    band.position.set(L / 2 + 0.9, 3.7, 0);
    g.add(band);
    for (const z of [-1.9, 1.9]) {
      const h = mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.2, 16).rotateZ(Math.PI / 2),
        glow("#fff6d8", 3),
        false,
      );
      h.position.set(L / 2 + 0.95, 2.5, z);
      g.add(h);
    }
    const dest = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 0.7),
      new THREE.MeshBasicMaterial({
        map: ledTexture("꿈나라"),
        toneMapped: false,
      }),
    );
    dest.rotation.y = Math.PI / 2;
    dest.position.set(L / 2 + 1.02, 7.4, 0);
    g.add(dest);
    driverSeat = new THREE.Vector3(7.6, 1.2, -0.6);
  }
  const seats = (lead ? [-6.6, -2.4, 2.4] : [-6.6, -2.4, 2.4, 6.6]).map(
    (x) => new THREE.Vector3(x, 1.2, 1.4),
  );
  return {
    group: g,
    length: L,
    wheels,
    seats,
    driverSeat,
    stand: true,
    setDoors(open) {
      for (const l of leaves) l.m.position.x = l.base + l.dir * open * 1.5;
    },
  };
}

export function subwayStage(): Stage {
  const root = new THREE.Group(),
    inst = new Instancer(),
    street = new THREE.Group();
  root.add(street);
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
  const concrete = plastic("#b7b3aa", { rough: 0.7 }),
    cream = plastic("#efe8d8", { rough: 0.35 });

  // The model sits on a wooden table.
  const table = mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: "#a97f5a", roughness: 0.75 }),
    false,
    true,
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -4.4;
  root.add(table);
  // Ground block, track pit and platform slab.
  add(
    roundBox(2 * X, 4, ZF - ZB, 0.15),
    plastic("#6b5a4a", { rough: 0.8 }),
    0,
    -2,
    (ZB + ZF) / 2,
  );
  add(
    roundBox(2 * X, 0.3, 13, 0.05),
    plastic("#4c4e50", { rough: 0.8 }),
    0,
    0.15,
    (ZB + 3) / 2,
  );
  for (let x = -X + 0.8; x < X; x += 1.6)
    inst.add(
      "sleeper",
      roundBox(1.0, 0.4, 6.8, 0.05, 1),
      plastic("#8a8d90", { rough: 0.6 }),
      [x, 0.5, TRACK_Z],
      [0, 0, 0],
      [1, 1, 1],
      false,
    );
  const steel = plastic(C.lightGray, { metal: 0.7, rough: 0.28 });
  for (const dz of [-2.35, 2.35])
    add(roundBox(2 * X, 0.35, 0.4, 0.08), steel, 0, 1.0, TRACK_Z + dz);
  add(
    roundBox(2 * X, PY - 0.2, ZF - 3, 0.1),
    concrete,
    0,
    (PY - 0.2) / 2,
    (3 + ZF) / 2,
  );
  for (let x = -X + 1; x < X; x += 2)
    for (let z = 5; z < ZF; z += 2)
      inst.add(
        "tile",
        roundBox(1.96, 0.2, 1.96, 0.04, 1),
        plastic(z > 18 ? "#cfc8b8" : "#d3cbb9", { rough: 0.4 }),
        [x, PY - 0.1, z],
        [0, 0, 0],
        [1, 1, 1],
        false,
      );
  for (let x = -X + 0.5; x < X; x += 1) {
    inst.add(
      "edge",
      roundBox(0.98, 0.2, 0.98, 0.04, 1),
      plastic(C.yellow),
      [x, PY - 0.1, 3.5],
      [0, 0, 0],
      [1, 1, 1],
      false,
    );
    inst.add(
      "edgeStud",
      lowStud,
      plastic(C.yellow),
      [x, PY, 3.5],
      [0, 0, 0],
      [1, 1, 1],
      false,
    );
  }

  // Back wall of tiles with the line-colour band.
  add(roundBox(2 * X, CEIL, 1, 0.05), cream, 0, CEIL / 2, ZB + 0.5);
  for (let x = -X + 1; x < X; x += 2)
    for (let y = 1; y < CEIL; y += 2)
      inst.add(
        y > 6 && y < 9 ? "tileBand" : "tileWall",
        roundBox(1.94, 1.94, 0.2, 0.05, 1),
        y > 6 && y < 9 ? line() : cream,
        [x, y, ZB + 1.1],
        [0, 0, 0],
        [1, 1, 1],
        false,
      );
  // Station name board and direction signs.
  const name = canvasTexture(1024, 256, (c) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 1024, 256);
    c.fillStyle = LINE;
    c.beginPath();
    c.arc(150, 128, 82, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffffff";
    c.font = "bold 110px Jua, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("2", 150, 134);
    c.fillStyle = "#1b2a34";
    c.font = "bold 150px Jua, 'Apple SD Gothic Neo', sans-serif";
    c.fillText("슝슝", 560, 120);
    c.font = "44px Jua, sans-serif";
    c.fillStyle = "#5b6570";
    c.fillText("SHUNGSHUNG · 꿈나라선", 600, 214);
  });
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4),
    new THREE.MeshStandardMaterial({ map: name, roughness: 0.4 }),
  );
  board.position.set(0, 12.5, ZB + 1.62);
  root.add(board);
  add(roundBox(16.6, 4.6, 0.3, 0.1), plastic("#1b2a34"), 0, 12.5, ZB + 1.4);
  // Posters of friends on the wall.
  for (const [i, x] of [
    [1, -42],
    [3, 24],
    [5, 38],
  ] as const) {
    add(roundBox(6.6, 8.6, 0.3, 0.1), plastic(C.white), x, 12, ZB + 1.4);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 8),
      new THREE.MeshStandardMaterial({
        color: ["#fff3c4", "#d6f0ff", "#ffe0ea"][i % 3],
      }),
    );
    back.position.set(x, 12, ZB + 1.6);
    root.add(back);
    void loadImage(
      svgUrl(figureSvg(sampleDesigns[i % sampleDesigns.length], "full")),
    ).then((img) => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      const pic = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshStandardMaterial({
          map: t,
          transparent: true,
          roughness: 0.5,
        }),
      );
      pic.position.set(x, 11.6, ZB + 1.66);
      root.add(pic);
    });
  }

  // Side walls with tunnel mouths; an exit corridor on the right.
  const sideWall = (sx: number) => {
    const xx = sx * (X - 0.5);
    add(
      roundBox(1, CEIL, -4.5 - ZB, 0.05),
      cream,
      xx,
      CEIL / 2,
      (ZB - 4.5) / 2,
    );
    add(
      roundBox(1, CEIL - 10, 7.5, 0.05),
      cream,
      xx,
      10 + (CEIL - 10) / 2,
      -0.75,
    );
    const tunnel = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 10),
      new THREE.MeshBasicMaterial({ color: "#050607" }),
    );
    tunnel.rotation.y = (-sx * Math.PI) / 2;
    tunnel.position.set(sx * (X - 0.08), 5, -0.75);
    root.add(tunnel);
    add(
      roundBox(1.4, 1.2, 8.3, 0.1),
      plastic("#3d4246"),
      sx * (X - 0.7),
      10.6,
      -0.75,
    );
    if (sx < 0)
      add(
        roundBox(1, CEIL - PY, ZF - 3, 0.05),
        cream,
        xx,
        PY + (CEIL - PY) / 2,
        (3 + ZF) / 2,
      );
    else {
      add(
        roundBox(1, CEIL - PY, 5, 0.05),
        cream,
        xx,
        PY + (CEIL - PY) / 2,
        5.5,
      );
      add(
        roundBox(1, CEIL - PY, ZF - 13, 0.05),
        cream,
        xx,
        PY + (CEIL - PY) / 2,
        (13 + ZF) / 2,
      );
      add(roundBox(1, CEIL - 9, 5, 0.05), cream, xx, 9 + (CEIL - 9) / 2, 10.5);
      const dark = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 6.6),
        new THREE.MeshBasicMaterial({ color: "#1d1f22" }),
      );
      dark.rotation.y = -Math.PI / 2;
      dark.position.set(X - 0.08, PY + 3.3, 10.5);
      root.add(dark);
      const exit = new THREE.Mesh(
        new THREE.PlaneGeometry(4.6, 1.2),
        new THREE.MeshBasicMaterial({
          map: ledTexture("나가는 곳 →", "#ffffff", "#1f9d55"),
          toneMapped: false,
        }),
      );
      exit.rotation.y = -Math.PI / 2;
      exit.position.set(X - 1.05, 10.2, 10.5);
      root.add(exit);
    }
  };
  sideWall(-1);
  sideWall(1);

  // Pillars.
  for (const x of [-40, -14, 12, 36]) {
    add(
      roundBox(1.6, CEIL - PY, 1.6, 0.1),
      cream,
      x,
      PY + (CEIL - PY) / 2,
      12.4,
    );
    add(roundBox(1.7, 1.2, 1.7, 0.08), line(), x, 9, 12.4);
  }

  // Platform screen doors: glass panels, sliding leaves at each car door.
  const psdZ = 4.3,
    psdTop = 9.0;
  add(
    roundBox(2 * X - 2, 1.0, 0.8, 0.1),
    plastic("#3d4246"),
    0,
    psdTop + 0.5,
    psdZ,
  );
  const ledStrip = new THREE.MeshBasicMaterial({
    color: "#7cf2a0",
    toneMapped: false,
  });
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * X - 4, 0.12),
    ledStrip,
  );
  strip.position.set(0, psdTop + 0.3, psdZ + 0.41);
  root.add(strip);
  const psdLeaves: { m: THREE.Mesh; base: number; dir: number }[] = [];
  let x0 = -X + 1;
  const panel = (a: number, b: number) => {
    if (b - a < 0.3) return;
    const pane = add(
      roundBox(b - a - 0.25, psdTop - PY, 0.15, 0.03),
      glass,
      (a + b) / 2,
      (PY + psdTop) / 2,
      psdZ,
      root,
      false,
    );
    pane.receiveShadow = false;
    add(
      roundBox(0.3, psdTop - PY, 0.5, 0.05),
      plastic("#9aa1a7", { metal: 0.4 }),
      b,
      (PY + psdTop) / 2,
      psdZ,
    );
    const st = add(
      roundBox(b - a - 0.3, 0.25, 0.18, 0.03),
      line(),
      (a + b) / 2,
      PY + 2.8,
      psdZ + 0.05,
      root,
      false,
    );
    void st;
  };
  for (const d of DOOR_X) {
    for (let a = x0; a < d - 1.6; a += 6) panel(a, Math.min(a + 6, d - 1.6));
    for (const dir of [-1, 1]) {
      const leaf = add(
        roundBox(1.55, psdTop - PY - 0.2, 0.12, 0.03),
        glass,
        d + dir * 0.8,
        (PY + psdTop) / 2,
        psdZ - 0.18,
        root,
        false,
      );
      const frame = add(
        roundBox(1.55, 0.2, 0.16, 0.03),
        plastic("#9aa1a7", { metal: 0.4 }),
        0,
        (psdTop - PY) / 2 - 0.3,
        0,
        leaf,
        false,
      );
      void frame;
      psdLeaves.push({ m: leaf, base: d + dir * 0.8, dir });
    }
    x0 = d + 1.6;
  }
  for (let a = x0; a < X - 1; a += 6) panel(a, Math.min(a + 6, X - 1));

  // Benches, vending machine, bin.
  for (const x of [-27, -1]) {
    add(roundBox(5, 0.5, 1.6, 0.1), plastic("#3d7fb8"), x, PY + 1.6, 19.4);
    add(roundBox(5, 1.6, 0.4, 0.1), plastic("#3d7fb8"), x, PY + 2.4, 18.5);
    for (const dx of [-2, 2])
      add(
        roundBox(0.4, 1.4, 1.2, 0.05),
        plastic(C.darkGray),
        x + dx,
        PY + 0.7,
        19.4,
      );
  }
  add(
    roundBox(3.2, 6.4, 2.2, 0.15),
    plastic(C.brightRed),
    -49.5,
    PY + 3.2,
    18.5,
  );
  add(
    roundBox(2.4, 3, 0.15, 0.05),
    glow("#bfefff", 1.4),
    -49.5,
    PY + 4.4,
    19.65,
    root,
    false,
  );
  add(
    new THREE.CylinderGeometry(0.8, 0.7, 2.4, 16),
    plastic(C.darkGray),
    -45.5,
    PY + 1.2,
    19.8,
  );

  // Escalator from the street down to the platform (moving steps).
  const run = ESC.top.x - ESC.bottom.x,
    rise = ESC.top.y - ESC.bottom.y,
    len = Math.hypot(run, rise),
    ang = Math.atan2(rise, run);
  const steps = canvasTexture(64, 64, (c) => {
    c.fillStyle = "#6c7378";
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = "#454b50";
    c.fillRect(0, 0, 18, 64);
    c.fillStyle = "#ffd23f";
    c.fillRect(60, 0, 4, 64);
  });
  steps.wrapS = steps.wrapT = THREE.RepeatWrapping;
  steps.repeat.set(len / 1.2, 1);
  const rampG = new THREE.Group();
  rampG.position.set(
    (ESC.top.x + ESC.bottom.x) / 2,
    (ESC.top.y + ESC.bottom.y) / 2 + 0.05,
    ESC.top.z,
  );
  rampG.rotation.z = ang;
  root.add(rampG);
  const ramp = new THREE.Mesh(
    new THREE.PlaneGeometry(len, 3.4),
    new THREE.MeshStandardMaterial({
      map: steps,
      roughness: 0.5,
      metalness: 0.3,
    }),
  );
  ramp.rotation.x = -Math.PI / 2;
  ramp.receiveShadow = true;
  rampG.add(ramp);
  for (const dz of [-2.0, 2.0]) {
    const rail = new THREE.Group();
    rail.position.set(
      (ESC.top.x + ESC.bottom.x) / 2,
      (ESC.top.y + ESC.bottom.y) / 2,
      ESC.top.z + dz,
    );
    rail.rotation.z = ang;
    root.add(rail);
    add(roundBox(len, 3.0, 0.15, 0.05), glass, 0, 1.5, 0, rail, false);
    add(roundBox(len, 0.25, 0.35, 0.1), plastic(C.black), 0, 3.1, 0, rail);
    add(
      roundBox(len, 1.2, 0.5, 0.1),
      plastic("#9aa1a7", { metal: 0.4 }),
      0,
      -0.6,
      0,
      rail,
    );
  }

  // Ceiling slab (with the escalator hole) carrying the street.
  const slab = (x0: number, x1: number, z0: number, z1: number) =>
    add(
      roundBox(x1 - x0, STREET - CEIL, z1 - z0, 0.05),
      concrete,
      (x0 + x1) / 2,
      (CEIL + STREET) / 2,
      (z0 + z1) / 2,
      street,
      false,
    );
  slab(-X, X, ZB, 12);
  slab(46, X, 12, ZF);
  // Hanging light strips and warm lamps.
  for (const z of [0.5, 10])
    for (let x = -42; x <= 42; x += 14) {
      add(
        roundBox(9, 0.35, 1.0, 0.1),
        glow("#fffdf4", 3),
        x,
        CEIL - 1.2,
        z,
        root,
        false,
      );
      add(
        new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6),
        plastic(C.darkGray),
        x,
        CEIL - 0.6,
        z,
        root,
        false,
      );
    }
  // LED arrival board.
  const led = new THREE.MeshBasicMaterial({
    map: ledTexture("꿈나라 방면 열차를 기다려요"),
    toneMapped: false,
  });
  const ledBox = add(
    roundBox(14.4, 2.4, 0.6, 0.1),
    plastic("#1b2a34"),
    -24,
    CEIL - 3.5,
    9,
  );
  void ledBox;
  const ledFace = new THREE.Mesh(new THREE.PlaneGeometry(13.8, 1.9), led);
  ledFace.position.set(-24, CEIL - 3.5, 9.31);
  root.add(ledFace);
  for (const dx of [-30, -18])
    add(
      new THREE.CylinderGeometry(0.06, 0.06, 2.3, 6),
      plastic(C.darkGray),
      dx,
      CEIL - 1.15,
      9,
      root,
      false,
    );

  // Street level: pavements, road with cars, trees, low buildings, entrance canopy.
  const top = STREET;
  add(
    roundBox(2 * X, 0.3, 9, 0.05),
    plastic("#5b5d58", { rough: 0.6 }),
    0,
    top + 0.15,
    1.5,
    street,
    false,
  );
  for (let x = -X + 3; x < X; x += 6)
    add(
      roundBox(3, 0.05, 0.4, 0.02),
      plastic(C.white),
      x,
      top + 0.32,
      1.5,
      street,
      false,
    );
  for (const [x0, x1, z0, z1] of [
    [-X, X, ZB, -3],
    [-X, X, 6, 12],
    [46, X, 12, ZF],
  ])
    for (let x = x0 + 1; x < x1; x += 2)
      for (let z = z0 + 1; z < z1; z += 2)
        inst.add(
          "pave",
          roundBox(1.94, 0.3, 1.94, 0.04, 1),
          plastic("#c9c6bf", { rough: 0.6 }),
          [x, top + 0.15, z],
          [0, 0, 0],
          [1, 1, 1],
          false,
        );
  const cars: { g: THREE.Group; v: number }[] = [];
  for (const [i, col] of [C.blue, C.yellow, C.brightRed].entries()) {
    const car = new THREE.Group();
    add(roundBox(5, 1.3, 2.8, 0.25), plastic(col), 0, 1.15, 0, car, false);
    add(roundBox(2.8, 1.2, 2.5, 0.25), glass, -0.3, 2.35, 0, car, false);
    add(roundBox(2.8, 0.25, 2.6, 0.1), plastic(col), -0.3, 3.05, 0, car, false);
    for (const x of [-1.6, 1.6])
      for (const z of [-1.35, 1.35])
        add(
          new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14).rotateX(Math.PI / 2),
          plastic(C.black),
          x,
          0.55,
          z,
          car,
          false,
        );
    const v = i === 1 ? -6 : 7;
    car.position.set(-40 + i * 35, top + 0.3, i === 1 ? -0.8 : 3.8);
    if (v < 0) car.rotation.y = Math.PI;
    street.add(car);
    cars.push({ g: car, v });
  }
  const leaf = new THREE.MeshStandardMaterial({
    color: C.brightGreen,
    roughness: 0.5,
    flatShading: true,
  });
  for (const x of [-48, -30, -10, 10, 26]) {
    add(
      new THREE.CylinderGeometry(0.4, 0.5, 2.4, 10),
      plastic(C.reddishBrown),
      x,
      top + 1.5,
      9.5,
      street,
      false,
    );
    const crown = add(
      new THREE.IcosahedronGeometry(2, 1),
      leaf,
      x,
      top + 4.4,
      9.5,
      street,
      false,
    );
    crown.scale.set(1, 0.9, 1);
  }
  const homes: [number, number, number, string][] = [
    [-42, 18, 2, C.tan],
    [-20, 16, 3, "#b40000"],
    [2, 18, 2, C.yellow],
    [24, 14, 3, "#6c96bf"],
    [44, 16, 2, C.white],
  ];
  for (const [x, w, f, col] of homes) {
    const h = f * 3.4;
    add(
      roundBox(w, h, 6, 0.1),
      plastic(col),
      x,
      top + h / 2,
      -6.5,
      street,
      false,
    );
    const roofB = brick(w + 0.4, 6.4, 0.6, C.darkGray);
    roofB.position.set(x, top + h, -6.5);
    street.add(roofB);
    for (let k = 0; k < f; k++)
      for (let c = 0; c < Math.floor(w / 3.2); c++)
        add(
          roundBox(1.8, 2, 0.2, 0.04, 1),
          glow("#cfeeff", 0.25),
          x - w / 2 + 1.8 + c * 3.2,
          top + 1.8 + k * 3.4,
          -3.45,
          street,
          false,
        );
  }
  // Entrance canopy over the escalator.
  for (const [x, z] of [
    [46.6, 14.4],
    [53.2, 14.4],
    [46.6, 20.2],
    [53.2, 20.2],
  ])
    add(
      new THREE.CylinderGeometry(0.2, 0.2, 5.5, 8),
      plastic(C.darkGray),
      x,
      top + 2.75,
      z,
      street,
      false,
    );
  add(
    roundBox(7.4, 0.4, 6.4, 0.1),
    glass,
    49.9,
    top + 5.6,
    17.3,
    street,
    false,
  );
  add(
    roundBox(7.6, 0.5, 0.4, 0.1),
    line(),
    49.9,
    top + 5.6,
    20.5,
    street,
    false,
  );
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 1.6),
    new THREE.MeshBasicMaterial({
      map: ledTexture("🚇 슝슝역", "#ffffff", LINE),
      toneMapped: false,
    }),
  );
  sign.position.set(49.9, top + 6.8, 20.75);
  street.add(sign);
  inst.build(root);
  street.traverse((o) => ((o as THREE.Mesh).castShadow = false));

  let ledText = "";
  const setLed = (text: string) => {
    if (text === ledText) return;
    ledText = text;
    led.map?.dispose();
    led.map = ledTexture(text);
    led.needsUpdate = true;
  };
  const exitDoor = new THREE.Vector3(X - 1.5, PY, 10.5);
  return {
    id: "subway",
    label: "블록 친구들이 지하철을 타는 지하철역",
    root,
    setupLights(scene, lite) {
      scene.background = skyBackground("#9fd0ee", "#dbe6ec", "#cbc3b7");
      scene.fog = new THREE.Fog("#d8d3cb", 200, 420);
      scene.add(new THREE.HemisphereLight("#ffffff", "#5a5650", 0.42));
      // Overhead light for crisp shadows under friends, pillars and the train.
      const sun = shadowSun("#f4f7ff", 2.0, [20, 95, 45], lite, 75);
      scene.add(sun);
      for (const x of [-36, -12, 12, 36]) {
        const p = new THREE.PointLight("#ffe7c2", 110, 46, 2);
        p.position.set(x, CEIL - 3, 9);
        scene.add(p);
      }
      return sun;
    },
    frame(camera, aspect) {
      const far = Math.pow(Math.max(1, 1.65 / aspect), 0.9);
      camera.fov = aspect < 1 ? 40 : 32;
      // High enough to look over the screen doors into the train.
      camera.position.set(0, 4 + 54 * far, 10 + 92 * far);
      return new THREE.Vector3(0, 1, 6);
    },
    focus: 0.55,
    clip: [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), X),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), X),
    ],
    trackY: TRACK_Y,
    loop: LOOP,
    trackAt: (s) => ({
      x: (((s % LOOP) + LOOP) % LOOP) - LOOP / 2,
      z: TRACK_Z,
      yaw: 0,
    }),
    buildTrain: () => ({
      vehicles: [
        buildSubwayCar(true),
        buildSubwayCar(false),
        buildSubwayCar(false),
      ],
      gap: GAP,
    }),
    stopAt: () => STOPPED[0] + LOOP / 2,
    platformY: PY,
    spot(i) {
      const perRow = 17,
        row = i < perRow ? 0 : 1,
        j = row ? i - perRow : i;
      return new THREE.Vector3(-44 + j * 4.6 + row * 2.3, PY, row ? 9.8 : 7.0);
    },
    maxWaiting: 30,
    arrival: {
      points: [
        new THREE.Vector3(52, STREET, 17.2),
        ESC.top.clone(),
        ESC.bottom.clone(),
        new THREE.Vector3(26, PY, 15),
      ],
      ride: [1],
    },
    boardPoint(seat) {
      const door = DOOR_X.reduce((a, b) =>
        Math.abs(b - seat.x) < Math.abs(a - seat.x) ? b : a,
      );
      return new THREE.Vector3(door, PY, psdZ + 1.4);
    },
    alightPoint(seat) {
      const door = DOOR_X.reduce((a, b) =>
        Math.abs(b - seat.x) < Math.abs(a - seat.x) ? b : a,
      );
      return new THREE.Vector3(door, PY, psdZ + 1.8);
    },
    exitPath: (from) => ({
      points: [
        new THREE.Vector3(from.x, PY, 10.5),
        exitDoor.clone(),
        new THREE.Vector3(X + 2, PY, 10.5),
      ],
    }),
    hopHeight: 0.8,
    benches: [-27, -1].flatMap((x) =>
      [-1.6, 0, 1.6].map((dx) => ({
        pos: new THREE.Vector3(x + dx, PY + 0.3, 19.4),
        yaw: 0,
        approach: new THREE.Vector3(x + dx, PY, 21.0),
      })),
    ),
    wander() {
      for (;;) {
        const p = new THREE.Vector3(
          -46 + Math.random() * 72,
          PY,
          6.5 + Math.random() * 10.5,
        );
        const pillar = [-40, -14, 12].some(
          (px) => Math.abs(p.x - px) < 2 && Math.abs(p.z - 12.4) < 2,
        );
        const bench = [-27, -1].some(
          (bx) => Math.abs(p.x - bx) < 3.6 && p.z > 17.2,
        );
        if (!pillar && !bench) return p;
      }
    },
    watchSpot: () => ({
      pos: new THREE.Vector3(-44 + Math.random() * 68, PY, 5.7),
      yaw: Math.PI,
    }),
    hasDoors: true,
    setDoors(open) {
      for (const l of psdLeaves) l.m.position.x = l.base + l.dir * open * 1.5;
    },
    master: { pos: new THREE.Vector3(36, PY, 6.4), yaw: -0.5 },
    steam: false,
    sounds: {
      approach: "metro",
      stop: "chime",
      depart: "whoosh",
      move: "rumble",
      moveEvery: 6,
      horn: "metroHorn",
    },
    update(_t, dt, info) {
      steps.offset.x += dt * 0.9;
      for (const c of cars) {
        c.g.position.x += c.v * dt;
        if (c.g.position.x > X + 4) c.g.position.x = -X - 4;
        if (c.g.position.x < -X - 4) c.g.position.x = X + 4;
      }
      setLed(
        info.mode === "braking"
          ? "열차가 들어오고 있습니다"
          : info.mode === "stopped"
            ? "슝슝역입니다 · 어서 타세요!"
            : info.mode === "closing"
              ? "출입문 닫습니다"
              : info.mode === "leaving"
                ? "꿈나라행 열차 출발!"
                : "꿈나라 방면 열차를 기다려요",
      );
    },
  };
}
