// Building blocks for the 3D diorama. Units: 1 = one stud pitch, a brick is 1.2 high.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const BRICK = 1.2;
export const PLATE = 0.4;
export const C = {
  red: "#c91a09",
  brightRed: "#e3342f",
  yellow: "#f2cd37",
  blue: "#0055bf",
  darkBlue: "#0a3463",
  green: "#237841",
  brightGreen: "#4b9f4a",
  lime: "#a5ca18",
  darkGreen: "#184632",
  tan: "#e4cd9e",
  darkTan: "#958a73",
  brown: "#583927",
  reddishBrown: "#82422a",
  black: "#1b2a34",
  white: "#f4f4f4",
  lightGray: "#a0a5a9",
  darkGray: "#6c6e68",
  orange: "#fe8a18",
  pink: "#fc97ac",
  sky: "#9fc3e9",
  glass: "#bfe6f7",
};

const materials = new Map<string, THREE.MeshStandardMaterial>();
/** Glossy ABS-like plastic. */
export function plastic(
  color: string,
  opts: { rough?: number; metal?: number } = {},
) {
  const key = color + (opts.rough ?? "") + (opts.metal ?? "");
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.3,
      metalness: opts.metal ?? 0,
      envMapIntensity: 0.7,
    });
    materials.set(key, m);
  }
  return m;
}
export const glass = new THREE.MeshStandardMaterial({
  color: C.glass,
  roughness: 0.05,
  metalness: 0.1,
  transparent: true,
  opacity: 0.35,
  envMapIntensity: 1.2,
});

const boxes = new Map<string, THREE.BufferGeometry>();
/** Box with softly rounded edges: the main "plastic brick" look. */
export function roundBox(
  w: number,
  h: number,
  d: number,
  r = 0.06,
  segments = 2,
) {
  const key = [w, h, d, r, segments].join("/");
  let g = boxes.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(
      w,
      h,
      d,
      segments,
      Math.min(r, w / 2, h / 2, d / 2) * 0.999,
    );
    boxes.set(key, g);
  }
  return g;
}

export const studGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14);
studGeo.translate(0, 0.1, 0);
/** Cheap stud for big baseplates: 8 sides, top cap only (bottom is never seen). */
export const lowStud = (() => {
  const side = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8, 1, true);
  const top = new THREE.CircleGeometry(0.3, 8)
    .rotateX(-Math.PI / 2)
    .translate(0, 0.1, 0);
  side.deleteAttribute("uv");
  top.deleteAttribute("uv");
  return mergeGeometries([side.toNonIndexed(), top.toNonIndexed()]).translate(
    0,
    0.1,
    0,
  );
})();
const grids = new Map<string, THREE.BufferGeometry>();
/** All studs of a w×d top merged into one geometry (centred, bottom at y=0). */
export function studGrid(w: number, d: number) {
  const key = w + "x" + d;
  let g = grids.get(key);
  if (!g) {
    const list: THREE.BufferGeometry[] = [];
    for (let i = 0; i < w; i++)
      for (let j = 0; j < d; j++)
        list.push(
          studGeo.clone().translate(i - (w - 1) / 2, 0, j - (d - 1) / 2),
        );
    g = mergeGeometries(list);
    grids.set(key, g);
  }
  return g;
}

export function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  cast = true,
  receive = true,
) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/**
 * A brick or plate w×d studs, height h, centred on x/z with its bottom at y=0.
 * Studs on top unless studs=false (a "tile").
 */
export function brick(
  w: number,
  d: number,
  h: number,
  color: string,
  studs = true,
) {
  const g = new THREE.Group();
  const body = mesh(roundBox(w, h, d, Math.min(0.08, h * 0.2)), plastic(color));
  body.position.y = h / 2;
  g.add(body);
  if (studs) {
    const s = mesh(
      studGrid(Math.round(w), Math.round(d)),
      plastic(color),
      false,
      true,
    );
    s.position.y = h;
    g.add(s);
  }
  return g;
}

/** Collects many identical parts and turns them into one InstancedMesh per kind. */
export class Instancer {
  private sets = new Map<
    string,
    {
      geo: THREE.BufferGeometry;
      mat: THREE.Material;
      list: THREE.Matrix4[];
      cast: boolean;
    }
  >();
  private tmp = new THREE.Object3D();
  add(
    key: string,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    cast = true,
  ) {
    let s = this.sets.get(key);
    if (!s) {
      s = { geo, mat, list: [], cast };
      this.sets.set(key, s);
    }
    this.tmp.position.set(...pos);
    this.tmp.rotation.set(...rot);
    this.tmp.scale.set(...scale);
    this.tmp.updateMatrix();
    s.list.push(this.tmp.matrix.clone());
  }
  build(parent: THREE.Object3D) {
    for (const s of this.sets.values()) {
      const im = new THREE.InstancedMesh(s.geo, s.mat, s.list.length);
      s.list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = s.cast;
      im.receiveShadow = true;
      parent.add(im);
    }
  }
}

/** Text or drawing painted on a canvas, used as a sticker texture. */
export function canvasTexture(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Soft round puff for steam and dust. */
export const puffTexture = (() => {
  let t: THREE.Texture | undefined;
  return () =>
    (t ??= canvasTexture(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 31);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.55, "rgba(255,255,255,.75)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }));
})();
