// A 3D block figure built from the tablet design. The child's own picture is used
// as printed stickers on the face, shirt and trousers, so pen patterns show up too.
import * as THREE from "three";
import { Design, Region, colorOf } from "../objects/figure";
import { C, mesh, plastic, roundBox } from "./kit";

export interface Figure {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  flag?: THREE.Mesh;
  dispose: () => void;
}

const PX = 512;
/** Map a point of the 512×512 picture to UV. */
const uv = (x: number, y: number) => [x / PX, 1 - y / PX] as const;

/** Flat quad whose corners show the given picture corners (for printed fronts). */
function decal(
  corners3: [number, number][],
  corners2: [number, number][],
  tex: THREE.Texture,
) {
  const g = new THREE.BufferGeometry();
  const pos: number[] = [],
    uvs: number[] = [];
  for (const i of [0, 1, 2, 0, 2, 3]) {
    pos.push(corners3[i][0], corners3[i][1], 0);
    uvs.push(...uv(corners2[i][0], corners2[i][1]));
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  m.receiveShadow = true;
  return m;
}

function torsoGeometry() {
  // Trapezoid: 2.0 wide at the waist, 1.5 at the shoulders, 1.5 tall, 1.0 deep.
  const s = new THREE.Shape();
  s.moveTo(-1, 0);
  s.lineTo(1, 0);
  s.lineTo(0.75, 1.5);
  s.lineTo(-0.75, 1.5);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.9,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  g.translate(0, 0, -0.45);
  return g;
}
const TORSO = torsoGeometry();
const HEAD = (() => {
  const pts: THREE.Vector2[] = [];
  const r = 0.62,
    h = 1.0,
    b = 0.12;
  pts.push(new THREE.Vector2(0, 0));
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - b + Math.sin(a) * b, b - Math.cos(a) * b));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(r - b + Math.cos(a) * b, h - b + Math.sin(a) * b),
    );
  }
  pts.push(new THREE.Vector2(0, h));
  return new THREE.LatheGeometry(pts, 32);
})();
const FACE = new THREE.CylinderGeometry(
  0.627,
  0.627,
  0.7,
  24,
  1,
  true,
  -0.95,
  1.9,
);
const ARM = new THREE.CylinderGeometry(0.2, 0.25, 1.15, 16);
ARM.translate(0, -0.55, 0);
const HAND = new THREE.TorusGeometry(0.17, 0.09, 10, 18);
const NECK = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
const STUD = new THREE.CylinderGeometry(0.33, 0.33, 0.2, 16);

export function buildFigure(
  d: Design,
  picture: HTMLImageElement | HTMLCanvasElement | null,
): Figure {
  const col = (r: Region) => plastic(colorOf(d, r));
  const textures: THREE.Texture[] = [];
  let tex: THREE.Texture | null = null;
  if (picture) {
    tex = new THREE.Texture(picture);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    textures.push(tex);
  }
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);

  // Legs pivot at the hips so they can walk and sit.
  const leg = (side: -1 | 1, r: Region) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.5, 1.55, 0);
    const m = mesh(roundBox(0.95, 1.55, 1.0, 0.07), col(r));
    m.position.y = -0.78;
    pivot.add(m);
    if (tex) {
      const x0 = side < 0 ? 167 : 266,
        x1 = side < 0 ? 246 : 345;
      const dc = decal(
        [
          [-0.44, -1.5],
          [0.44, -1.5],
          [0.44, -0.05],
          [-0.44, -0.05],
        ],
        [
          [x0, 470],
          [x1, 470],
          [x1, 366],
          [x0, 366],
        ],
        tex,
      );
      dc.position.z = 0.505;
      pivot.add(dc);
    }
    body.add(pivot);
    return pivot;
  };
  const legL = leg(-1, "legL"),
    legR = leg(1, "legR");
  const hips = mesh(roundBox(2.0, 0.4, 1.0, 0.06), col("hips"));
  hips.position.y = 1.72;
  body.add(hips);

  const torso = mesh(TORSO, col("torso"));
  torso.position.y = 1.92;
  body.add(torso);
  if (tex) {
    const dc = decal(
      [
        [-0.95, 0.04],
        [0.95, 0.04],
        [0.72, 1.46],
        [-0.72, 1.46],
      ],
      [
        [185, 319],
        [327, 319],
        [315, 221],
        [197, 221],
      ],
      tex,
    );
    dc.position.set(0, 1.92, 0.502);
    body.add(dc);
  }

  const arm = (side: -1 | 1, r: Region, hand: Region) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.9, 3.2, 0);
    pivot.rotation.z = side * 0.12;
    const a = mesh(ARM, col(r));
    pivot.add(a);
    const h = mesh(HAND, col(hand));
    h.position.set(0, -1.25, 0.12);
    h.rotation.x = Math.PI / 2.4;
    pivot.add(h);
    body.add(pivot);
    return pivot;
  };
  const armL = arm(-1, "armL", "handL"),
    armR = arm(1, "armR", "handR");

  const head = new THREE.Group();
  head.position.y = 3.42;
  body.add(head);
  const neck = mesh(NECK, col("head"));
  neck.position.y = 0.08;
  head.add(neck);
  const skull = mesh(HEAD, col("head"));
  skull.position.y = 0.16;
  head.add(skull);
  if (tex) {
    // Face printed on the front of the head (picture area under the hat brim).
    const g = FACE.clone();
    const uvs = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uvs.count; i++) {
      const [u, v] = uv(207 + uvs.getX(i) * 98, 192 - uvs.getY(i) * 66);
      uvs.setXY(i, u, v);
    }
    const face = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.35,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    face.position.y = 0.16 + 0.5 - 0.11;
    head.add(face);
  }
  if (d.hat === "none") {
    const s = mesh(STUD, col("head"));
    s.position.y = 1.25;
    head.add(s);
  } else head.add(hat(d));

  // The item is held in the hand on the viewer's right, as on the tablet.
  let flag: THREE.Mesh | undefined;
  if (d.item !== "none") {
    const it = item(d);
    armR.add(it.group);
    armR.rotation.x = -0.35;
    flag = it.flag;
  }

  return {
    root,
    body,
    legL,
    legR,
    armL,
    armR,
    head,
    flag,
    dispose: () => textures.forEach((t) => t.dispose()),
  };
}

function hat(d: Design) {
  const g = new THREE.Group();
  const main = plastic(colorOf(d, "hat")),
    trim =
      d.hat === "hair"
        ? main
        : plastic(colorOf(d, "hatTrim") || colorOf(d, "hat"));
  const top = 1.16;
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    s: [number, number, number] = [1, 1, 1],
  ) => {
    const m = mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(...s);
    g.add(m);
    return m;
  };
  switch (d.hat) {
    case "conductor":
      add(
        new THREE.CylinderGeometry(0.66, 0.66, 0.2, 28),
        trim,
        0,
        top - 0.02,
        0,
      );
      add(
        new THREE.CylinderGeometry(0.72, 0.66, 0.36, 28),
        main,
        0,
        top + 0.26,
        0,
      );
      add(
        new THREE.CylinderGeometry(0.72, 0.72, 0.06, 28),
        main,
        0,
        top + 0.46,
        0,
      );
      add(
        new THREE.CylinderGeometry(
          0.55,
          0.55,
          0.06,
          20,
          1,
          false,
          -Math.PI / 2,
          Math.PI,
        ),
        trim,
        0,
        top - 0.1,
        0.42,
        0.18,
        0,
        0,
        [1.15, 1, 1],
      );
      add(
        new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16),
        plastic(C.yellow, { metal: 0.5, rough: 0.25 }),
        0,
        top + 0.26,
        0.7,
        Math.PI / 2,
      );
      break;
    case "helmet":
      add(
        new THREE.SphereGeometry(0.74, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
        main,
        0,
        top - 0.12,
        0,
      );
      add(
        new THREE.CylinderGeometry(0.92, 0.92, 0.07, 28),
        trim,
        0,
        top - 0.12,
        0.04,
      );
      add(
        roundBox(0.16, 0.2, 1.3, 0.05),
        main,
        0,
        top + 0.5,
        0,
        0.0,
        0,
        0,
        [1, 1, 1],
      ).rotation.set(0, 0, 0);
      break;
    case "crown": {
      add(
        new THREE.CylinderGeometry(0.66, 0.64, 0.34, 28, 1, true),
        main,
        0,
        top + 0.05,
        0,
      ).material = plastic(colorOf(d, "hat"));
      (g.children[g.children.length - 1] as THREE.Mesh).material =
        new THREE.MeshStandardMaterial({
          color: colorOf(d, "hat"),
          roughness: 0.25,
          metalness: 0.4,
          side: THREE.DoubleSide,
        });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(
          new THREE.ConeGeometry(0.13, 0.36, 12),
          main,
          Math.sin(a) * 0.62,
          top + 0.38,
          Math.cos(a) * 0.62,
        );
      }
      add(new THREE.SphereGeometry(0.1, 12, 8), trim, 0, top + 0.06, 0.67);
      add(new THREE.SphereGeometry(0.08, 12, 8), trim, -0.36, top + 0.06, 0.56);
      add(new THREE.SphereGeometry(0.08, 12, 8), trim, 0.36, top + 0.06, 0.56);
      break;
    }
    case "hair":
    case "pigtails":
      add(
        new THREE.SphereGeometry(
          0.7,
          28,
          14,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.55,
        ),
        main,
        0,
        top - 0.3,
        -0.02,
        0,
        0,
        0,
        [1, 0.95, 1],
      );
      add(
        new THREE.CylinderGeometry(
          0.7,
          0.68,
          0.75,
          28,
          1,
          false,
          Math.PI * 0.62,
          Math.PI * 0.76,
        ),
        main,
        0,
        top - 0.62,
        0,
      );
      if (d.hat === "pigtails")
        for (const s of [-1, 1]) {
          add(
            new THREE.SphereGeometry(0.32, 16, 12),
            main,
            s * 0.78,
            top - 0.62,
            -0.1,
          );
          add(
            new THREE.ConeGeometry(0.16, 0.3, 4),
            trim,
            s * 0.62,
            top - 0.18,
            0.1,
            0,
            0,
            (s * Math.PI) / 2,
          );
          add(
            new THREE.ConeGeometry(0.16, 0.3, 4),
            trim,
            s * 0.9,
            top - 0.18,
            0.1,
            0,
            0,
            (-s * Math.PI) / 2,
          );
        }
      break;
    case "party":
      add(new THREE.ConeGeometry(0.46, 1.15, 28), main, 0, top + 0.5, 0);
      add(new THREE.SphereGeometry(0.17, 16, 12), trim, 0, top + 1.1, 0);
      add(
        new THREE.TorusGeometry(0.33, 0.04, 8, 24),
        plastic(C.white),
        0,
        top + 0.3,
        0,
        Math.PI / 2,
      );
      break;
  }
  return g;
}

function item(d: Design) {
  const g = new THREE.Group();
  // Local frame of the right-arm pivot; the hand sits at (0, -1.25, 0.12).
  g.position.set(0, -1.25, 0.15);
  const main = plastic(colorOf(d, "item")),
    trim = plastic(colorOf(d, "itemTrim") || colorOf(d, "item"));
  let flag: THREE.Mesh | undefined;
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    rz = 0,
  ) => {
    const m = mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    g.add(m);
    return m;
  };
  switch (d.item) {
    case "flag": {
      add(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 10), main, 0, 1.1, 0);
      const geo = new THREE.PlaneGeometry(1.2, 0.75, 12, 2);
      geo.translate(0.6, 0, 0);
      flag = add(
        geo,
        new THREE.MeshStandardMaterial({
          color: colorOf(d, "itemTrim"),
          side: THREE.DoubleSide,
          roughness: 0.5,
        }),
        0.05,
        2.25,
        0,
      );
      break;
    }
    case "balloon":
      add(
        new THREE.CylinderGeometry(0.015, 0.015, 2.6, 4),
        plastic(C.white),
        0.15,
        1.3,
        0,
        0,
        -0.12,
      );
      add(
        new THREE.SphereGeometry(0.75, 24, 18),
        plastic(colorOf(d, "item"), { rough: 0.15 }),
        0.32,
        3.25,
        0,
      ).scale.set(1, 1.15, 1);
      add(new THREE.ConeGeometry(0.12, 0.2, 10), main, 0.32, 2.4, 0, Math.PI);
      break;
    case "suitcase":
      add(roundBox(1.15, 0.85, 0.42, 0.08), main, 0.15, -0.7, 0);
      add(
        new THREE.TorusGeometry(0.2, 0.06, 8, 16, Math.PI),
        trim,
        0.15,
        -0.27,
        0,
      );
      add(roundBox(0.06, 0.8, 0.44, 0.02), plastic(C.black), -0.15, -0.7, 0);
      add(roundBox(0.06, 0.8, 0.44, 0.02), plastic(C.black), 0.45, -0.7, 0);
      break;
    case "lollipop":
      add(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), main, 0, 0.6, 0);
      add(
        new THREE.CylinderGeometry(0.48, 0.48, 0.14, 28),
        trim,
        0,
        1.55,
        0,
        Math.PI / 2,
      );
      add(
        new THREE.TorusGeometry(0.28, 0.05, 8, 24),
        plastic(C.white),
        0,
        1.55,
        0.08,
      );
      add(
        new THREE.TorusGeometry(0.12, 0.04, 8, 18),
        plastic(C.white),
        0,
        1.55,
        0.08,
      );
      break;
  }
  return { group: g, flag };
}
