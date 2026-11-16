// Steam engine and coaches built from bricks. Local frame: forward is +x,
// the side facing out of the loop is +z, y=0 is the top of the rails.
import * as THREE from "three";
import { C, brick, glass, mesh, plastic, roundBox, studGrid } from "./kit";

export interface Vehicle {
  group: THREE.Group;
  length: number;
  wheels: THREE.Mesh[];
  /** Seat anchors (local) for passengers. */
  seats: THREE.Vector3[];
  /** Where the driver stands (local), if this vehicle is driven. */
  driverSeat?: THREE.Vector3;
  /** Passengers stand (subway) instead of sitting (coaches). */
  stand?: boolean;
  /** Slide the doors on the platform side: 0 shut … 1 open. */
  setDoors?: (open: number) => void;
  chimney?: THREE.Vector3;
  rods?: THREE.Mesh[];
}

const WHEEL_SMALL = new THREE.CylinderGeometry(0.62, 0.62, 0.35, 20).rotateX(
  Math.PI / 2,
);
const WHEEL_BIG = new THREE.CylinderGeometry(1.15, 1.15, 0.4, 28).rotateX(
  Math.PI / 2,
);
const SPOKE = new THREE.BoxGeometry(0.16, 1, 0.08);

function wheel(r: "small" | "big", color: string) {
  const w = mesh(r === "big" ? WHEEL_BIG : WHEEL_SMALL, plastic(color));
  const size = r === "big" ? 2.0 : 1.05;
  for (let i = 0; i < (r === "big" ? 4 : 2); i++) {
    const s = mesh(SPOKE, plastic(C.lightGray, { metal: 0.4 }), false);
    s.scale.y = size;
    s.rotation.z = (i * Math.PI) / (r === "big" ? 4 : 2);
    s.position.z = r === "big" ? 0.22 : 0.19;
    w.add(s);
  }
  return w;
}

function bogie(g: THREE.Group, x: number, wheels: THREE.Mesh[]) {
  const frame = mesh(roundBox(3.6, 0.7, 4.2, 0.1), plastic(C.darkGray));
  frame.position.set(x, 0.75, 0);
  g.add(frame);
  for (const dx of [-1.05, 1.05])
    for (const z of [-2.15, 2.15]) {
      const w = wheel("small", C.black);
      w.position.set(x + dx, 0.62, z);
      if (z < 0) w.rotation.y = Math.PI;
      g.add(w);
      wheels.push(w);
    }
}

/** Panel of wall bricks with window openings and glass. */
function sideWall(
  g: THREE.Group,
  z: number,
  len: number,
  color: string,
  windows: number,
  from: number,
  to: number,
) {
  const pillar = 1.1,
    win = (len - pillar * (windows + 1)) / windows;
  for (let i = 0; i <= windows; i++) {
    const p = mesh(roundBox(pillar, to - from, 0.6, 0.06), plastic(color));
    p.position.set(
      -len / 2 + pillar / 2 + i * (pillar + win),
      (from + to) / 2,
      z,
    );
    g.add(p);
  }
  for (let i = 0; i < windows; i++) {
    const pane = mesh(
      new THREE.PlaneGeometry(win, to - from),
      glass,
      false,
      false,
    );
    pane.position.set(
      -len / 2 + pillar + win / 2 + i * (pillar + win),
      (from + to) / 2,
      z + (z > 0 ? 0.1 : -0.1),
    );
    if (z < 0) pane.rotation.y = Math.PI;
    g.add(pane);
  }
  return { pillar, win };
}

export function buildCoach(color = C.red): Vehicle {
  const g = new THREE.Group(),
    wheels: THREE.Mesh[] = [],
    L = 18,
    W = 6;
  bogie(g, -5.8, wheels);
  bogie(g, 5.8, wheels);
  const base = mesh(roundBox(L, 0.5, W, 0.08), plastic(C.darkGray));
  base.position.y = 1.4;
  g.add(base);
  const floor = mesh(roundBox(L - 0.4, 0.2, W - 0.6, 0.04), plastic(C.tan));
  floor.position.y = 1.75;
  g.add(floor);
  // Lower and upper walls, windows between.
  for (const z of [-(W / 2 - 0.3), W / 2 - 0.3]) {
    const low = mesh(roundBox(L, 1.9, 0.6, 0.08), plastic(color));
    low.position.set(0, 2.6, z);
    g.add(low);
    const stripe = mesh(roundBox(L - 0.2, 0.22, 0.12, 0.04), plastic(C.yellow));
    stripe.position.set(0, 3.25, z + (z > 0 ? 0.33 : -0.33));
    g.add(stripe);
    const up = mesh(roundBox(L, 1.0, 0.6, 0.08), plastic(color));
    up.position.set(0, 6.1, z);
    g.add(up);
  }
  const { pillar, win } = sideWall(g, W / 2 - 0.3, L, color, 4, 3.55, 5.6);
  sideWall(g, -(W / 2 - 0.3), L, color, 4, 3.55, 5.6);
  for (const x of [-(L / 2 - 0.3), L / 2 - 0.3]) {
    const end = mesh(roundBox(0.6, 4.95, W, 0.08), plastic(color));
    end.position.set(x, 4.08, 0);
    g.add(end);
  }
  // Roof: dark plate with a studded ridge.
  const roof = mesh(roundBox(L + 0.4, 0.5, W + 0.4, 0.12), plastic(C.black));
  roof.position.y = 6.85;
  g.add(roof);
  const ridge = brick(L - 2, 3, 0.6, C.black);
  ridge.position.y = 7.1;
  g.add(ridge);
  // Benches and seat anchors behind each window on the outer side.
  const seats: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const x = -L / 2 + pillar + win / 2 + i * (pillar + win);
    const bench = mesh(roundBox(2.2, 0.8, 1.6, 0.08), plastic(C.reddishBrown));
    bench.position.set(x, 2.25, 0.4);
    g.add(bench);
    const back = mesh(roundBox(2.2, 1.6, 0.4, 0.08), plastic(C.reddishBrown));
    back.position.set(x, 3.0, -0.6);
    g.add(back);
    seats.push(new THREE.Vector3(x, 2.65 - 1.55, 0.35));
  }
  // Couplers.
  for (const x of [-L / 2 - 0.4, L / 2 + 0.4]) {
    const c = mesh(roundBox(1.0, 0.4, 0.8, 0.08), plastic(C.darkGray));
    c.position.set(x, 1.3, 0);
    g.add(c);
  }
  return { group: g, length: L, wheels, seats };
}

export function buildLoco(): Vehicle {
  const g = new THREE.Group(),
    wheels: THREE.Mesh[] = [],
    rods: THREE.Mesh[] = [],
    L = 14;
  const frame = mesh(roundBox(L, 1.0, 4.4, 0.1), plastic(C.red));
  frame.position.y = 1.8;
  g.add(frame);
  // Big driving wheels with connecting rods, small leading wheel.
  for (const z of [-2.35, 2.35]) {
    for (const x of [-2.6, 0, 2.6]) {
      const w = wheel("big", C.red);
      w.position.set(x, 1.15, z);
      if (z < 0) w.rotation.y = Math.PI;
      g.add(w);
      wheels.push(w);
    }
    const small = wheel("small", C.red);
    small.position.set(5.3, 0.62, z);
    if (z < 0) small.rotation.y = Math.PI;
    g.add(small);
    wheels.push(small);
    const rod = mesh(
      roundBox(5.6, 0.22, 0.14, 0.05),
      plastic(C.lightGray, { metal: 0.6, rough: 0.25 }),
    );
    rod.position.set(0, 1.15, z + (z > 0 ? 0.36 : -0.36));
    g.add(rod);
    rods.push(rod);
  }
  // Boiler with brass bands, smokebox, chimney and dome.
  const boiler = mesh(
    new THREE.CylinderGeometry(1.95, 1.95, 8.2, 32).rotateZ(Math.PI / 2),
    plastic(C.black, { rough: 0.25 }),
  );
  boiler.position.set(1.4, 4.2, 0);
  g.add(boiler);
  for (const x of [-1.6, 0.6, 2.8, 4.8]) {
    const band = mesh(
      new THREE.CylinderGeometry(2.0, 2.0, 0.22, 32).rotateZ(Math.PI / 2),
      plastic(C.yellow, { metal: 0.5, rough: 0.25 }),
    );
    band.position.set(x, 4.2, 0);
    g.add(band);
  }
  const smoke = mesh(
    new THREE.CylinderGeometry(1.75, 1.75, 0.6, 32).rotateZ(Math.PI / 2),
    plastic(C.darkGray),
  );
  smoke.position.set(5.75, 4.2, 0);
  g.add(smoke);
  const lamp = mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: "#fff3b0",
      emissive: "#ffd86b",
      emissiveIntensity: 3,
    }),
  );
  lamp.position.set(6.1, 5.4, 0);
  g.add(lamp);
  const chimney = mesh(
    new THREE.CylinderGeometry(0.6, 0.55, 2.2, 20),
    plastic(C.black),
  );
  chimney.position.set(4.3, 6.9, 0);
  g.add(chimney);
  const cap = mesh(
    new THREE.CylinderGeometry(0.85, 0.65, 0.5, 20),
    plastic(C.red),
  );
  cap.position.set(4.3, 8.1, 0);
  g.add(cap);
  const dome = mesh(
    new THREE.SphereGeometry(0.9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    plastic(C.yellow, { metal: 0.5, rough: 0.25 }),
  );
  dome.position.set(1.2, 6.0, 0);
  g.add(dome);
  // Buffer beam.
  const beam = mesh(roundBox(0.8, 1.2, 5.4, 0.08), plastic(C.red));
  beam.position.set(L / 2 - 0.2, 1.9, 0);
  g.add(beam);
  for (const z of [-1.8, 1.8]) {
    const b = mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.6, 14).rotateZ(Math.PI / 2),
      plastic(C.darkGray),
    );
    b.position.set(L / 2 + 0.4, 1.9, z);
    g.add(b);
  }
  // Cab with open side windows and a studded roof.
  const cx = -4.6;
  for (const z of [-2.3, 2.3]) {
    const low = mesh(roundBox(4.6, 2.4, 0.6, 0.08), plastic(C.black));
    low.position.set(cx, 3.5, z);
    g.add(low);
    for (const x of [cx - 2.0, cx + 2.0]) {
      const p = mesh(roundBox(0.6, 2.1, 0.6, 0.06), plastic(C.black));
      p.position.set(x, 5.75, z);
      g.add(p);
    }
    const stripe = mesh(roundBox(4.4, 0.25, 0.12, 0.04), plastic(C.red));
    stripe.position.set(cx, 4.2, z + (z > 0 ? 0.33 : -0.33));
    g.add(stripe);
  }
  const back = mesh(roundBox(0.6, 4.6, 5.2, 0.08), plastic(C.black));
  back.position.set(cx - 2.0, 4.6, 0);
  g.add(back);
  const roof = mesh(roundBox(5.6, 0.5, 6.0, 0.12), plastic(C.red));
  roof.position.set(cx, 7.05, 0);
  g.add(roof);
  const studs = mesh(studGrid(4, 4), plastic(C.red), false);
  studs.position.set(cx, 7.3, 0);
  g.add(studs);
  const floor = mesh(roundBox(4.4, 0.3, 4.4, 0.04), plastic(C.darkGray));
  floor.position.set(cx, 2.3, 0);
  g.add(floor);
  return {
    group: g,
    length: L,
    wheels,
    rods,
    seats: [],
    driverSeat: new THREE.Vector3(cx - 0.4, 2.45 - 1.0, 0.6),
    chimney: new THREE.Vector3(4.3, 8.6, 0),
  };
}
