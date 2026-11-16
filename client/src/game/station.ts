// Canvas drawing for the block-diorama train station. Pure drawing, no state.
type Ctx = CanvasRenderingContext2D;

export interface Layout {
  w: number;
  h: number;
  /** Scale for train and friends: fits a full train on wide screens. */
  k: number;
  /** Stud pitch. */
  p: number;
  horizon: number;
  backPlatform: number;
  railY: number;
  platTop: number;
  feetY: number;
  platFront: number;
  baseTop: number;
  edge: number;
  /** Friend picture size (512 box). */
  S: number;
}
export function layout(w: number, h: number): Layout {
  const k = Math.min(h, w / 1.85);
  return {
    w,
    h,
    k,
    p: Math.max(9, k * 0.032),
    horizon: h * 0.5,
    backPlatform: h * 0.6,
    railY: h * 0.695,
    platTop: h * 0.735,
    feetY: h * 0.815,
    platFront: h * 0.835,
    baseTop: h * 0.885,
    edge: h * 0.958,
    S: k * 0.27,
  };
}

export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)),
  );
  return `rgb(${ch.join(",")})`;
}

export function rr(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function studs(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  color: string,
  p: number,
) {
  const n = Math.max(1, Math.round(w / p)),
    sw = p * 0.6,
    sh = p * 0.2;
  for (let i = 0; i < n; i++) {
    const sx = x + ((i + 0.5) * w) / n - sw / 2;
    rr(c, sx, y - sh, sw, sh + 1, sw * 0.18);
    c.fillStyle = shade(color, -0.06);
    c.fill();
    c.fillStyle = shade(color, 0.28);
    c.fillRect(sx + sw * 0.15, y - sh + 1, sw * 0.32, Math.max(1, sh * 0.35));
  }
}

/** A plastic brick: soft gradient, highlight, outline and optional studs on top. */
export function brick(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  p: number,
  withStuds = true,
) {
  if (withStuds) studs(c, x, y, w, color, p);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(color, 0.1));
  g.addColorStop(1, shade(color, -0.12));
  rr(c, x, y, w, h, Math.min(p * 0.12, h / 4));
  c.fillStyle = g;
  c.fill();
  c.lineWidth = Math.max(1, p * 0.05);
  c.strokeStyle = shade(color, -0.32);
  c.stroke();
  c.fillStyle = shade(color, 0.35);
  c.fillRect(x + p * 0.15, y + 1, w - p * 0.3, Math.max(1, p * 0.06));
}

/** Big studded plate (baseplate / platform tiles). */
function studField(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  p: number,
) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
  const r = p * 0.28;
  for (let sy = y + p * 0.55; sy < y + h - r; sy += p)
    for (let sx = x + p * 0.5; sx < x + w; sx += p) {
      c.beginPath();
      c.arc(sx, sy + r * 0.25, r, 0, Math.PI * 2);
      c.fillStyle = shade(color, -0.14);
      c.fill();
      c.beginPath();
      c.arc(sx, sy, r, 0, Math.PI * 2);
      c.fillStyle = shade(color, 0.08);
      c.fill();
    }
}

function wall(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  p: number,
) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
  c.strokeStyle = shade(color, -0.18);
  c.lineWidth = Math.max(1, p * 0.05);
  const bh = p * 1.2,
    bw = p * 2.4;
  let row = 0;
  for (let yy = y; yy < y + h - 1; yy += bh, row++) {
    c.beginPath();
    c.moveTo(x, yy);
    c.lineTo(x + w, yy);
    for (let xx = x + (row % 2 ? bw / 2 : 0); xx < x + w; xx += bw) {
      c.moveTo(xx, yy);
      c.lineTo(xx, Math.min(yy + bh, y + h));
    }
    c.stroke();
  }
}

function mountain(
  c: Ctx,
  L: Layout,
  cx: number,
  base: number,
  width: number,
  height: number,
  color: string,
  snow = false,
) {
  const n = Math.max(4, Math.round(height / (L.p * 1.15))),
    lh = height / n;
  for (let i = 0; i < n; i++) {
    const ww = width * (1 - i / n) + L.p,
      y = base - (i + 1) * lh;
    brick(
      c,
      cx - ww / 2,
      y,
      ww,
      lh + 1,
      snow && i >= n - 2 ? "#f4f7fb" : color,
      L.p,
    );
  }
}

function tree(c: Ctx, L: Layout, x: number, base: number, size: number) {
  const p = L.p;
  brick(
    c,
    x - size * 0.09,
    base - size * 0.32,
    size * 0.18,
    size * 0.32,
    "#8b5a2b",
    p,
    false,
  );
  const layers = [
    [1, "#2f8a46"],
    [0.74, "#38a052"],
    [0.48, "#45b45f"],
  ] as const;
  layers.forEach(([s, col], i) => {
    const ww = size * s,
      hh = size * 0.26;
    brick(c, x - ww / 2, base - size * 0.32 - (i + 1) * hh, ww, hh + 1, col, p);
  });
}

export function cloud(c: Ctx, L: Layout, x: number, y: number, s: number) {
  const p = L.p * s;
  brick(c, x, y, p * 6, p * 1.1, "#ffffff", p);
  brick(c, x + p * 1.5, y - p * 1.1, p * 3, p * 1.1, "#ffffff", p);
}

function station(c: Ctx, L: Layout) {
  const { w, h, p } = L;
  const width = Math.min(w * 0.34, h * 0.75),
    x = w * 0.62,
    base = L.backPlatform,
    top = h * 0.36;
  // Side pillars and walls.
  wall(c, x, top, width, base - top, "#e9d3a5", p);
  c.strokeStyle = "#b99a62";
  c.lineWidth = p * 0.1;
  c.strokeRect(x, top, width, base - top);
  // Windows and door.
  const win = (wx: number) => {
    brick(
      c,
      wx,
      top + (base - top) * 0.22,
      width * 0.16,
      (base - top) * 0.36,
      "#ffffff",
      p,
      false,
    );
    c.fillStyle = "#9fdcf7";
    c.fillRect(
      wx + p * 0.3,
      top + (base - top) * 0.22 + p * 0.3,
      width * 0.16 - p * 0.6,
      (base - top) * 0.36 - p * 0.6,
    );
    c.strokeStyle = "rgba(255,255,255,.75)";
    c.lineWidth = p * 0.25;
    c.beginPath();
    c.moveTo(wx + p * 0.8, top + (base - top) * 0.5);
    c.lineTo(wx + width * 0.1, top + (base - top) * 0.3);
    c.stroke();
  };
  win(x + width * 0.08);
  win(x + width * 0.76);
  const dw = width * 0.26,
    dx = x + width / 2 - dw / 2,
    dy = top + (base - top) * 0.25;
  brick(c, dx, dy, dw, base - dy, "#1f9d55", p, false);
  c.fillStyle = "#9fdcf7";
  c.fillRect(dx + p * 0.4, dy + p * 0.4, dw / 2 - p * 0.6, (base - dy) * 0.45);
  c.fillRect(
    dx + dw / 2 + p * 0.2,
    dy + p * 0.4,
    dw / 2 - p * 0.6,
    (base - dy) * 0.45,
  );
  // Stepped roof.
  const roofBase = top,
    steps = 4,
    sh = h * 0.035;
  for (let i = 0; i < steps; i++) {
    const ww = width * (1.12 - i * 0.2);
    brick(
      c,
      x + width / 2 - ww / 2,
      roofBase - (i + 1) * sh,
      ww,
      sh + 1,
      "#d6312b",
      p,
    );
  }
  // Sign + clock.
  const sw = width * 0.5,
    sy = roofBase - sh * 2.1;
  brick(
    c,
    x + width / 2 - sw / 2,
    top + p * 0.4,
    sw,
    h * 0.05,
    "#ffffff",
    p,
    false,
  );
  c.fillStyle = "#23262b";
  c.font = `${Math.round(h * 0.034)}px Jua, "Apple SD Gothic Neo", sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("슝슝역", x + width / 2, top + p * 0.4 + h * 0.026);
  const cr = sh * 1.05,
    cx = x + width / 2,
    cy = sy - sh * 1.2;
  c.beginPath();
  c.arc(cx, cy, cr, 0, Math.PI * 2);
  c.fillStyle = "#ffffff";
  c.fill();
  c.lineWidth = p * 0.25;
  c.strokeStyle = "#23262b";
  c.stroke();
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx, cy - cr * 0.65);
  c.moveTo(cx, cy);
  c.lineTo(cx + cr * 0.45, cy + cr * 0.15);
  c.stroke();
}

/** Sky and sun (clouds drift between this and the scenery). */
export function drawSky(c: Ctx, L: Layout) {
  const { w, h, p } = L;
  const sky = c.createLinearGradient(0, 0, 0, L.horizon);
  sky.addColorStop(0, "#6cc4f0");
  sky.addColorStop(1, "#d3f0fb");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, L.backPlatform);
  // Sun: a round 2×2 brick seen from above.
  const sr = h * 0.06,
    sx = w * 0.9,
    sy = h * 0.13;
  c.beginPath();
  c.arc(sx, sy, sr, 0, Math.PI * 2);
  c.fillStyle = "#ffd23f";
  c.fill();
  c.lineWidth = p * 0.12;
  c.strokeStyle = "#f2b705";
  c.stroke();
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    c.beginPath();
    c.arc(sx + dx * sr * 0.38, sy + dy * sr * 0.38, sr * 0.24, 0, Math.PI * 2);
    c.fillStyle = "#ffe27a";
    c.fill();
    c.strokeStyle = "#f2b705";
    c.lineWidth = p * 0.08;
    c.stroke();
  }
}

/** Everything else behind the train: mountains, station, track. */
export function drawBack(c: Ctx, L: Layout) {
  const { w, h, p } = L;
  mountain(
    c,
    L,
    w * 0.18,
    L.horizon + h * 0.04,
    w * 0.42,
    h * 0.3,
    "#a9d9b4",
    true,
  );
  mountain(c, L, w * 0.48, L.horizon + h * 0.04, w * 0.34, h * 0.2, "#8fcf9c");
  mountain(c, L, w * 0.02, L.horizon + h * 0.06, w * 0.26, h * 0.16, "#7cc489");
  studField(c, 0, L.horizon, w, L.backPlatform - L.horizon, "#5cb85c", p);
  tree(c, L, w * 0.06, L.backPlatform, h * 0.2);
  tree(c, L, w * 0.15, L.backPlatform, h * 0.15);
  tree(c, L, w * 0.5, L.backPlatform, h * 0.13);
  station(c, L);
  tree(c, L, w * 0.98, L.backPlatform, h * 0.18);
  // Back platform edge.
  studField(c, 0, L.backPlatform, w, h * 0.04, "#b9bfc4", p);
  // Track bed with sleepers and rail.
  const bed = L.backPlatform + h * 0.04;
  c.fillStyle = "#a39686";
  c.fillRect(0, bed, w, L.platTop - bed);
  c.fillStyle = "#8a7d6e";
  for (let x = 0; x < w; x += p * 0.9)
    c.fillRect(
      x + ((x * 7) % 5),
      bed + ((x * 13) % (L.platTop - bed - 3)),
      3,
      3,
    );
  for (let x = -p; x < w + p * 3; x += p * 2.6)
    brick(c, x, L.railY - h * 0.004, p * 1.7, h * 0.022, "#6d4a2f", p, false);
  c.fillStyle = "#5c636a";
  c.fillRect(0, L.railY - h * 0.006, w, h * 0.011);
  c.fillStyle = "#c9d0d6";
  c.fillRect(0, L.railY - h * 0.006, w, Math.max(1, h * 0.003));
}

/** Everything in front of the train: platform, baseplate, diorama edge. */
export function drawFront(c: Ctx, L: Layout) {
  const { w, h, p } = L;
  studField(c, 0, L.platTop, w, L.platFront - L.platTop, "#d4d8db", p);
  studField(c, 0, L.platTop, w, h * 0.018, "#ffd23f", p * 0.6);
  wall(c, 0, L.platFront, w, L.baseTop - L.platFront, "#959da3", p);
  c.fillStyle = "rgba(255,255,255,.55)";
  c.fillRect(0, L.platFront, w, Math.max(1, p * 0.1));
  studField(c, 0, L.baseTop, w, L.edge - L.baseTop, "#4fae55", p);
  // Little flower studs.
  const flowers = ["#e3342f", "#ffd23f", "#ff6fa8", "#ffffff"];
  for (let i = 0; i < 26; i++) {
    const fx = ((i * 0.618) % 1) * w,
      fy = L.baseTop + p * 0.6 + ((i * 7) % 3) * p * 0.8;
    c.beginPath();
    c.arc(fx, fy, p * 0.32, 0, Math.PI * 2);
    c.fillStyle = flowers[i % 4];
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.18)";
    c.lineWidth = 1;
    c.stroke();
  }
  // Diorama table edge.
  const g = c.createLinearGradient(0, L.edge, 0, h);
  g.addColorStop(0, "#2f7d3a");
  g.addColorStop(1, "#1f5a28");
  c.fillStyle = g;
  c.fillRect(0, L.edge, w, h - L.edge);
  c.fillStyle = "rgba(255,255,255,.35)";
  c.fillRect(0, L.edge, w, Math.max(1, p * 0.08));
  // Lamp posts at both ends of the platform.
  for (const x of [w * 0.975]) {
    const top = L.platTop - h * 0.3;
    brick(
      c,
      x - p * 0.3,
      top,
      p * 0.6,
      L.platTop - top + p * 0.5,
      "#2b2f33",
      p,
      false,
    );
    brick(c, x - p * 1.1, top - p * 1.4, p * 2.2, p * 1.4, "#ffe27a", p);
    brick(c, x - p * 1.3, top - p * 1.8, p * 2.6, p * 0.5, "#2b2f33", p);
  }
}

/** Signal light by the track: red while the train waits, green when it may go. */
export function drawSignal(c: Ctx, L: Layout, go: boolean) {
  const { h, p } = L,
    x = L.w * 0.03,
    top = L.backPlatform - h * 0.2;
  brick(
    c,
    x - p * 0.25,
    top,
    p * 0.5,
    L.backPlatform - top + p * 0.4,
    "#5c636a",
    p,
    false,
  );
  brick(c, x - p * 0.8, top - p * 2.6, p * 1.6, p * 2.8, "#2b2f33", p);
  for (const [i, col, on] of [
    [0, "#e3342f", !go],
    [1, "#2fd165", go],
  ] as const) {
    c.beginPath();
    c.arc(x, top - p * 1.9 + i * p * 1.2, p * 0.45, 0, Math.PI * 2);
    c.fillStyle = on ? col : shade(col, -0.65);
    c.fill();
    if (on) {
      c.beginPath();
      c.arc(x, top - p * 1.9 + i * p * 1.2, p * 0.9, 0, Math.PI * 2);
      c.fillStyle = col + "44";
      c.fill();
    }
  }
}

// ---------------------------------------------------------------- train
export const SEATS = 9;
const CAR_COLORS = ["#1f5fbf", "#ffd23f", "#1f9d55"];
export function trainSize(L: Layout) {
  const carLen = L.k * 0.4,
    gap = L.k * 0.026,
    locoLen = L.k * 0.53;
  return { carLen, gap, locoLen, total: 3 * (carLen + gap) + locoLen };
}
const bodyBottom = (L: Layout) => L.railY - L.k * 0.036;
/** Glass rectangle of seat i (3 cars × 3 windows) for a train whose rear is at x. */
export function seatRect(L: Layout, x: number, i: number) {
  const { carLen, gap } = trainSize(L),
    car = Math.floor(i / 3),
    j = i % 3,
    ww = L.k * 0.095,
    wh = L.k * 0.088,
    cx = x + car * (carLen + gap) + ((j + 0.5) * carLen) / 3,
    top = bodyBottom(L) - L.k * 0.17 + L.k * 0.028;
  return { x: cx - ww / 2, y: top, w: ww, h: wh };
}
export function chimneyTop(L: Layout, x: number) {
  const { carLen, gap } = trainSize(L);
  return {
    x: x + 3 * (carLen + gap) + L.k * 0.4,
    y: bodyBottom(L) - L.k * 0.26,
  };
}
export function trainBox(L: Layout, x: number) {
  return {
    x,
    y: bodyBottom(L) - L.k * 0.3,
    w: trainSize(L).total,
    h: L.railY - bodyBottom(L) + L.k * 0.3,
  };
}

function wheel(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = "#2b2f33";
  c.fill();
  c.beginPath();
  c.arc(x, y, r * 0.78, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = shade(color, -0.4);
  c.lineWidth = Math.max(1, r * 0.12);
  c.beginPath();
  for (let s = 0; s < 4; s++) {
    const a = angle + (s * Math.PI) / 4;
    c.moveTo(x - Math.cos(a) * r * 0.7, y - Math.sin(a) * r * 0.7);
    c.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
  }
  c.stroke();
  c.beginPath();
  c.arc(x, y, r * 0.2, 0, Math.PI * 2);
  c.fillStyle = "#c9d0d6";
  c.fill();
}

/** A friend picture placed so its face fills a window. */
export function drawInWindow(
  c: Ctx,
  L: Layout,
  img: CanvasImageSource,
  r: { x: number; y: number; w: number; h: number },
  bob: number,
) {
  const size = L.k * 0.26;
  c.save();
  c.beginPath();
  c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  c.drawImage(
    img,
    r.x + r.w / 2 - size / 2,
    r.y + r.h * 0.5 - size * (150 / 512) + bob,
    size,
    size,
  );
  c.restore();
}

export function drawTrain(
  c: Ctx,
  L: Layout,
  x: number,
  angle: number,
  seats: (CanvasImageSource | null)[],
  driver: CanvasImageSource | null,
  t: number,
  moving: boolean,
) {
  const { k, p } = L,
    { carLen, gap } = trainSize(L),
    bb = bodyBottom(L),
    bodyH = k * 0.17,
    wr = k * 0.026;
  const bob = (i: number) =>
    Math.sin(t * 6 + i * 1.7) * k * (moving ? 0.005 : 0.002);
  for (let car = 0; car < 3; car++) {
    const cx = x + car * (carLen + gap),
      col = CAR_COLORS[car];
    // Coupler to the next vehicle.
    c.fillStyle = "#3a3f45";
    c.fillRect(cx + carLen - 2, bb - k * 0.03, gap + 4, k * 0.014);
    c.fillStyle = "#3a3f45";
    c.fillRect(cx + k * 0.01, bb - 2, carLen - k * 0.02, k * 0.02);
    for (const f of [0.14, 0.3, 0.7, 0.86])
      wheel(c, cx + carLen * f, L.railY - wr, wr, angle, "#5c636a");
    brick(c, cx, bb - bodyH, carLen, bodyH, col, p, false);
    c.fillStyle = "#ffffff";
    c.fillRect(cx + p * 0.2, bb - k * 0.042, carLen - p * 0.4, k * 0.013);
    brick(
      c,
      cx - k * 0.012,
      bb - bodyH - k * 0.03,
      carLen + k * 0.024,
      k * 0.032,
      "#eef1f3",
      p,
    );
    for (let j = 0; j < 3; j++) {
      const i = car * 3 + j,
        r = seatRect(L, x, i);
      rr(
        c,
        r.x - p * 0.25,
        r.y - p * 0.25,
        r.w + p * 0.5,
        r.h + p * 0.5,
        p * 0.2,
      );
      c.fillStyle = "#ffffff";
      c.fill();
      c.fillStyle = "#cdeefc";
      c.fillRect(r.x, r.y, r.w, r.h);
      const img = seats[i];
      if (img) drawInWindow(c, L, img, r, bob(i));
      c.strokeStyle = "rgba(255,255,255,.55)";
      c.lineWidth = p * 0.2;
      c.beginPath();
      c.moveTo(r.x + r.w * 0.15, r.y + r.h * 0.55);
      c.lineTo(r.x + r.w * 0.5, r.y + r.h * 0.1);
      c.stroke();
    }
  }
  // Locomotive.
  const lx = x + 3 * (carLen + gap);
  c.fillStyle = "#3a3f45";
  c.fillRect(lx, bb - 2, k * 0.5, k * 0.024);
  const cabTop = bb - k * 0.25;
  const big = k * 0.042;
  wheel(c, lx + k * 0.08, L.railY - wr, wr, angle, "#d6312b");
  wheel(c, lx + k * 0.22, L.railY - big, big, angle * (wr / big), "#d6312b");
  wheel(c, lx + k * 0.33, L.railY - big, big, angle * (wr / big), "#d6312b");
  wheel(c, lx + k * 0.45, L.railY - wr, wr, angle, "#d6312b");
  // Connecting rod between the big wheels.
  const a = angle * (wr / big),
    px = Math.cos(a) * big * 0.5,
    py = Math.sin(a) * big * 0.5;
  c.strokeStyle = "#c9d0d6";
  c.lineWidth = k * 0.009;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(lx + k * 0.22 + px, L.railY - big + py);
  c.lineTo(lx + k * 0.33 + px, L.railY - big + py);
  c.stroke();
  // Boiler.
  const boilTop = bb - k * 0.15;
  brick(c, lx + k * 0.16, boilTop, k * 0.32, k * 0.145, "#2b2f33", p, false);
  for (const f of [0.22, 0.31, 0.4]) {
    c.fillStyle = "#ffd23f";
    c.fillRect(lx + k * f, boilTop + 1, k * 0.012, k * 0.143);
  }
  // Dome and chimney.
  c.beginPath();
  c.arc(lx + k * 0.28, boilTop, k * 0.03, Math.PI, 0);
  c.fillStyle = "#ffd23f";
  c.fill();
  brick(
    c,
    lx + k * 0.38,
    boilTop - k * 0.08,
    k * 0.044,
    k * 0.082,
    "#2b2f33",
    p,
    false,
  );
  brick(
    c,
    lx + k * 0.37,
    boilTop - k * 0.1,
    k * 0.064,
    k * 0.024,
    "#d6312b",
    p,
    false,
  );
  // Front plate, lamp, cow-catcher.
  brick(
    c,
    lx + k * 0.47,
    boilTop + k * 0.01,
    k * 0.04,
    k * 0.135,
    "#d6312b",
    p,
    false,
  );
  c.beginPath();
  c.moveTo(lx + k * 0.47, bb);
  c.lineTo(lx + k * 0.53, L.railY - 2);
  c.lineTo(lx + k * 0.47, L.railY - 2);
  c.closePath();
  c.fillStyle = "#d6312b";
  c.fill();
  c.beginPath();
  c.arc(lx + k * 0.5, boilTop + k * 0.04, k * 0.017, 0, Math.PI * 2);
  c.fillStyle = "#fff6b0";
  c.fill();
  if (moving) {
    c.beginPath();
    c.moveTo(lx + k * 0.51, boilTop + k * 0.04);
    c.lineTo(lx + k * 0.75, boilTop - k * 0.02);
    c.lineTo(lx + k * 0.75, boilTop + k * 0.1);
    c.closePath();
    c.fillStyle = "rgba(255,246,176,.28)";
    c.fill();
  }
  // Cab with the driver.
  brick(c, lx, cabTop, k * 0.17, bb - cabTop, "#e3342f", p, false);
  const dw = {
    x: lx + k * 0.035,
    y: cabTop + k * 0.04,
    w: k * 0.1,
    h: k * 0.09,
  };
  rr(
    c,
    dw.x - p * 0.25,
    dw.y - p * 0.25,
    dw.w + p * 0.5,
    dw.h + p * 0.5,
    p * 0.2,
  );
  c.fillStyle = "#ffd23f";
  c.fill();
  c.fillStyle = "#cdeefc";
  c.fillRect(dw.x, dw.y, dw.w, dw.h);
  if (driver) drawInWindow(c, L, driver, dw, bob(9));
  brick(c, lx - k * 0.015, cabTop - k * 0.03, k * 0.2, k * 0.032, "#2b2f33", p);
}

export function trainLength(L: Layout) {
  return trainSize(L).total;
}
