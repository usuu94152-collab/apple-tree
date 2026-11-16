// Block-figure template: every colourable part is a closed path in a 512×512 box.
export type Region =
  | "item"
  | "itemTrim"
  | "legL"
  | "legR"
  | "hips"
  | "torso"
  | "armL"
  | "armR"
  | "handL"
  | "handR"
  | "head"
  | "hat"
  | "hatTrim";
export type HatId =
  | "conductor"
  | "helmet"
  | "crown"
  | "hair"
  | "pigtails"
  | "party"
  | "none";
export type FaceId = "smile" | "grin" | "wink" | "wow";
export type ItemId = "none" | "flag" | "balloon" | "suitcase" | "lollipop";
export interface Design {
  fills: Partial<Record<Region, string>>;
  hat: HatId;
  face: FaceId;
  item: ItemId;
}

export const INK = "#23262b";
export const SKIN = "#ffd23f";
export const colors: [string, string][] = [
  ["빨강", "#e3342f"],
  ["주황", "#f7882f"],
  ["노랑", "#ffd23f"],
  ["연두", "#8cc63f"],
  ["초록", "#1f9d55"],
  ["하늘", "#5bc0eb"],
  ["파랑", "#1f5fbf"],
  ["보라", "#8e5cd9"],
  ["분홍", "#ff6fa8"],
  ["갈색", "#8b5a2b"],
  ["흰색", "#ffffff"],
  ["검정", "#2b2f33"],
];

export const regionNames: Record<Region, string> = {
  item: "소품",
  itemTrim: "소품",
  legL: "왼쪽 다리",
  legR: "오른쪽 다리",
  hips: "허리",
  torso: "옷",
  armL: "왼팔",
  armR: "오른팔",
  handL: "왼손",
  handR: "오른손",
  head: "얼굴",
  hat: "모자",
  hatTrim: "모자 장식",
};

const circle = (x: number, y: number, r: number) =>
  `M${x - r} ${y} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

const body: Partial<Record<Region, string>> = {
  legL: "M152 358 H253 V470 Q253 478 245 478 H152 Q146 478 146 472 V460 Q146 452 152 450 Z",
  legR: "M360 358 H259 V470 Q259 478 267 478 H360 Q366 478 366 472 V460 Q366 452 360 450 Z",
  hips: "M150 330 H362 V358 H150 Z",
  torso:
    "M184 208 H328 Q336 208 338 216 L360 330 H152 L174 216 Q176 208 184 208 Z",
  armL: "M182 212 Q150 214 142 246 L126 306 Q124 318 136 320 L160 324 Q170 324 172 314 L184 262 Z",
  armR: "M330 212 Q362 214 370 246 L386 306 Q388 318 376 320 L352 324 Q342 324 340 314 L328 262 Z",
  handL: circle(146, 340, 22),
  handR: circle(366, 340, 22),
  head: "M220 98 H292 Q316 98 316 122 V174 Q316 198 292 198 H220 Q196 198 196 174 V122 Q196 98 220 98 Z M228 102 V88 Q228 82 234 82 H278 Q284 82 284 88 V102 Z M232 196 H280 V212 H232 Z",
};

interface Part {
  name: string;
  main?: string;
  trim?: string;
  mainColor: string;
  trimColor?: string;
  details?: string;
  box: string;
}

export const hats: Record<HatId, Part> = {
  conductor: {
    name: "기관사 모자",
    main: "M194 100 Q192 54 256 52 Q320 54 318 100 Z",
    trim: "M192 92 H320 V108 H192 Z M196 106 Q256 126 316 106 L320 114 Q256 136 192 114 Z",
    mainColor: "#1f5fbf",
    trimColor: "#2b2f33",
    details: `<path d="${circle(256, 76, 10)}" fill="#ffd23f"/>`,
    box: "150 30 212 170",
  },
  helmet: {
    name: "안전모",
    main: "M184 116 Q184 40 256 38 Q328 40 328 116 Z",
    trim: "M168 110 H344 Q352 110 350 118 L348 124 H164 L162 118 Q160 110 168 110 Z",
    mainColor: "#ffd23f",
    trimColor: "#f7882f",
    details: '<path d="M256 42 V108" fill="none"/>',
    box: "150 20 212 180",
  },
  crown: {
    name: "왕관",
    main: "M194 110 L198 46 L228 78 L256 36 L284 78 L314 46 L318 110 Z",
    trim: circle(256, 92, 9) + circle(222, 96, 7) + circle(290, 96, 7),
    mainColor: "#ffd23f",
    trimColor: "#e3342f",
    box: "150 20 212 180",
  },
  hair: {
    name: "짧은 머리",
    main: "M188 140 Q180 64 256 60 Q332 64 324 140 Q322 112 300 102 Q262 118 222 102 Q192 110 188 140 Z",
    mainColor: "#8b5a2b",
    box: "150 30 212 170",
  },
  pigtails: {
    name: "양갈래 머리",
    main: "M188 136 Q180 64 256 60 Q332 64 324 136 Q322 110 300 102 Q256 116 212 102 Q190 110 188 136 Z M188 124 Q148 126 148 164 Q148 200 178 204 Q198 182 196 138 Z M324 124 Q364 126 364 164 Q364 200 334 204 Q314 182 316 138 Z",
    trim: "M166 104 L188 118 L166 132 Z M210 104 L188 118 L210 132 Z M346 104 L324 118 L346 132 Z M302 104 L324 118 L302 132 Z",
    mainColor: "#2b2f33",
    trimColor: "#ff6fa8",
    box: "136 40 240 175",
  },
  party: {
    name: "파티 모자",
    main: "M210 104 L256 18 L302 104 Z",
    trim: circle(256, 18, 14),
    mainColor: "#8e5cd9",
    trimColor: "#ffd23f",
    details:
      '<path d="M226 76 L284 60 M218 94 L294 74" fill="none" stroke="#ffffff" stroke-width="6"/>',
    box: "150 0 212 200",
  },
  none: { name: "없음", mainColor: "", box: "150 60 212 150" },
};

export const faces: Record<FaceId, { name: string; svg: string }> = {
  smile: {
    name: "웃음",
    svg: `<path d="M230 162 Q256 184 282 162" fill="none"/><ellipse cx="236" cy="140" rx="6" ry="8" fill="${INK}" stroke="none"/><ellipse cx="276" cy="140" rx="6" ry="8" fill="${INK}" stroke="none"/>`,
  },
  grin: {
    name: "신나요",
    svg: `<path d="M226 158 Q256 194 286 158 Z" fill="${INK}"/><path d="M228 140 Q236 130 244 140 M268 140 Q276 130 284 140" fill="none"/>`,
  },
  wink: {
    name: "윙크",
    svg: `<path d="M230 162 Q256 184 282 162" fill="none"/><path d="M228 142 Q236 134 244 142" fill="none"/><ellipse cx="276" cy="140" rx="6" ry="8" fill="${INK}" stroke="none"/>`,
  },
  wow: {
    name: "깜짝",
    svg: `<ellipse cx="256" cy="170" rx="10" ry="12" fill="${INK}" stroke="none"/><circle cx="234" cy="138" r="9" fill="${INK}" stroke="none"/><circle cx="278" cy="138" r="9" fill="${INK}" stroke="none"/>`,
  },
};

export const items: Record<ItemId, Part> = {
  none: { name: "없음", mainColor: "", box: "300 280 200 200" },
  flag: {
    name: "신호 깃발",
    main: "M362 120 H370 V352 H362 Z",
    trim: "M370 124 Q410 112 450 126 Q440 150 452 176 Q412 162 370 176 Z",
    mainColor: "#c9cdd1",
    trimColor: "#e3342f",
    box: "330 100 140 270",
  },
  balloon: {
    name: "풍선",
    main: circle(420, 120, 54) + " M412 172 L428 172 L420 184 Z",
    mainColor: "#ff6fa8",
    details:
      '<path d="M420 184 Q398 262 370 330" fill="none" stroke-width="4"/><path d="M394 96 Q398 82 410 78" fill="none" stroke="#ffffff" stroke-width="8"/>',
    box: "340 50 160 300",
  },
  suitcase: {
    name: "여행 가방",
    main: "M362 380 H446 Q456 380 456 390 V452 Q456 462 446 462 H362 Q352 462 352 452 V390 Q352 380 362 380 Z",
    trim: "M380 380 V362 Q380 354 388 354 H420 Q428 354 428 362 V380 H418 V364 H390 V380 Z",
    mainColor: "#8b5a2b",
    trimColor: "#2b2f33",
    details:
      '<path d="M380 390 V454 M428 390 V454" fill="none" stroke-width="5"/>',
    box: "330 330 150 150",
  },
  lollipop: {
    name: "막대 사탕",
    main: "M362 344 L404 186 L412 188 L370 346 Z",
    trim: circle(412, 168, 38),
    mainColor: "#ffffff",
    trimColor: "#ff6fa8",
    details:
      '<path d="M412 168 m-6 0 a6 6 0 1 1 12 0 a12 12 0 1 1 -24 0 a18 18 0 1 1 36 0 a24 24 0 1 1 -48 0" fill="none" stroke="#ffffff" stroke-width="5"/>',
    box: "330 120 150 240",
  },
};

export const defaultDesign = (): Design => ({
  fills: {},
  hat: "conductor",
  face: "smile",
  item: "none",
});

/** Paths from back to front, so later regions win both visually and for taps. */
export function shapes(d: Design): [Region, string][] {
  const out: [Region, string][] = [];
  const item = items[d.item],
    hat = hats[d.hat];
  if (item.main) out.push(["item", item.main]);
  if (item.trim) out.push(["itemTrim", item.trim]);
  for (const r of [
    "legL",
    "legR",
    "hips",
    "torso",
    "armL",
    "armR",
    "handL",
    "handR",
    "head",
  ] as Region[])
    out.push([r, body[r]!]);
  if (hat.main) out.push(["hat", hat.main]);
  if (hat.trim) out.push(["hatTrim", hat.trim]);
  return out;
}

export function colorOf(d: Design, r: Region) {
  const set = d.fills[r];
  if (set) return set;
  if (r === "head" || r === "handL" || r === "handR") return SKIN;
  if (r === "hat") return hats[d.hat].mainColor;
  if (r === "hatTrim") return hats[d.hat].trimColor!;
  if (r === "item") return items[d.item].mainColor;
  if (r === "itemTrim") return items[d.item].trimColor!;
  return "#ffffff";
}

const hitColor = (i: number) => `rgb(${(i + 1) * 17},0,0)`;
export function hitRegion(d: Design, r: number, g: number, b: number) {
  if (g || b || r % 17) return undefined;
  return shapes(d)[r / 17 - 1]?.[0];
}

const wrap = (inner: string, box = "0 0 512 512", extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="512" height="512"${extra}>${inner}</svg>`;

function fillLayer(d: Design) {
  return shapes(d)
    .map(([r, p]) => `<path d="${p}" fill="${colorOf(d, r)}"/>`)
    .join("");
}

function outlineLayer(d: Design) {
  const hat = hats[d.hat],
    item = items[d.item];
  // Each outline is hidden where a part in front of it covers it (cap over the head stud, arm over a flag pole).
  const list = shapes(d);
  const masks = list
    .map(
      (_, i) =>
        `<mask id="m${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#fff"/>${list
          .slice(i + 1)
          .map(([, p]) => `<path d="${p}" fill="#000" stroke="none"/>`)
          .join("")}</mask>`,
    )
    .join("");
  const lines = list
    .map(
      ([r, p], i) =>
        `<g mask="url(#m${i})"><path d="${p}"/>${
          r === (item.trim ? "itemTrim" : "item") ? item.details || "" : ""
        }</g>`,
    )
    .join("");
  return `<defs>${masks}</defs><g fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">${lines}
<path d="M246 358 V376 H266 V358"/>${["146", "366"].map((x) => `<circle cx="${x}" cy="340" r="9"/>`).join("")}
<circle cx="218" cy="166" r="8" fill="#ff8f8f" stroke="none" opacity="0.55"/><circle cx="294" cy="166" r="8" fill="#ff8f8f" stroke="none" opacity="0.55"/>
${faces[d.face].svg}${hat.details || ""}
<path d="M206 126 Q206 112 216 108" stroke="#ffffff" stroke-width="7" opacity="0.7"/>
<path d="M200 226 L194 258" stroke="#ffffff" stroke-width="9" opacity="0.4"/>
<path d="M160 372 V430" stroke="#ffffff" stroke-width="7" opacity="0.35"/></g>`;
}

/** Layers: fill (colours), outline (ink + face), mask (silhouette), hit (tap map), full (both). */
export function figureSvg(
  d: Design,
  mode: "fill" | "outline" | "mask" | "hit" | "full",
  box?: string,
) {
  if (mode === "fill") return wrap(fillLayer(d), box);
  if (mode === "outline") return wrap(outlineLayer(d), box);
  if (mode === "full") return wrap(fillLayer(d) + outlineLayer(d), box);
  if (mode === "mask")
    return wrap(
      `<g fill="#ffffff" stroke="#ffffff" stroke-width="7" stroke-linejoin="round">${shapes(
        d,
      )
        .map(([, p]) => `<path d="${p}"/>`)
        .join("")}</g>`,
    );
  return wrap(
    shapes(d)
      .map(([, p], i) => `<path d="${p}" fill="${hitColor(i)}"/>`)
      .join(""),
    "0 0 512 512",
    ' shape-rendering="crispEdges"',
  );
}

/** Small picture for the hat / face / item pickers. */
export function thumbSvg(kind: "hat" | "face" | "item", id: string) {
  if (kind === "hat")
    return figureSvg(
      { ...defaultDesign(), hat: id as HatId },
      "full",
      hats[id as HatId].box,
    );
  if (kind === "face")
    return figureSvg(
      { ...defaultDesign(), hat: "none", face: id as FaceId },
      "full",
      "180 76 152 136",
    );
  const it = items[id as ItemId];
  const parts = [
    [it.main, it.mainColor],
    [it.trim, it.trimColor],
  ].filter(([p]) => p) as [string, string][];
  return wrap(
    parts.map(([p, c]) => `<path d="${p}" fill="${c}"/>`).join("") +
      `<g fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">${parts
        .map(([p]) => `<path d="${p}"/>`)
        .join("")}${it.details || ""}</g>`,
    it.box,
  );
}

export const svgUrl = (s: string) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

/** Ready-made friends for the home page preview and the train driver. */
export const sampleDesigns: Design[] = [
  {
    fills: {
      torso: "#e3342f",
      armL: "#e3342f",
      armR: "#e3342f",
      legL: "#1f5fbf",
      legR: "#1f5fbf",
      hips: "#1f5fbf",
    },
    hat: "conductor",
    face: "smile",
    item: "flag",
  },
  {
    fills: {
      torso: "#ffd23f",
      armL: "#ffd23f",
      armR: "#ffd23f",
      legL: "#1f9d55",
      legR: "#1f9d55",
      hips: "#1f9d55",
    },
    hat: "pigtails",
    face: "grin",
    item: "balloon",
  },
  {
    fills: {
      torso: "#5bc0eb",
      armL: "#ffffff",
      armR: "#ffffff",
      legL: "#2b2f33",
      legR: "#2b2f33",
      hips: "#2b2f33",
    },
    hat: "helmet",
    face: "wink",
    item: "suitcase",
  },
  {
    fills: {
      torso: "#8e5cd9",
      armL: "#8e5cd9",
      armR: "#8e5cd9",
      legL: "#ff6fa8",
      legR: "#ff6fa8",
      hips: "#ff6fa8",
    },
    hat: "crown",
    face: "wow",
    item: "lollipop",
  },
  {
    fills: {
      torso: "#1f9d55",
      armL: "#f7882f",
      armR: "#f7882f",
      legL: "#8b5a2b",
      legR: "#8b5a2b",
      hips: "#8b5a2b",
    },
    hat: "hair",
    face: "smile",
    item: "none",
  },
  {
    fills: {
      torso: "#f7882f",
      armL: "#f7882f",
      armR: "#f7882f",
      legL: "#5bc0eb",
      legR: "#5bc0eb",
      hips: "#5bc0eb",
    },
    hat: "party",
    face: "grin",
    item: "balloon",
  },
];
