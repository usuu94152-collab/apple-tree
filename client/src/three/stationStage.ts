// The outdoor model-railway station: oval track, steam train, friends fall from the sky.
import * as THREE from "three";
import { LOOP, PLATFORM as P, TRACK_Y, buildDiorama, trackAt } from "./diorama";
import { Stage } from "./stage";
import { buildCoach, buildLoco } from "./train";

export function skyBackground(top: string, mid: string, bottom: string) {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 256;
  const g = c.getContext("2d")!,
    grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.6, mid);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function shadowSun(
  color: string,
  intensity: number,
  pos: [number, number, number],
  lite: boolean,
  half = 95,
) {
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.position.set(...pos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lite ? 1024 : 4096, lite ? 1024 : 4096);
  Object.assign(sun.shadow.camera, {
    left: -half,
    right: half,
    top: half * 0.9,
    bottom: -half * 0.9,
    near: 10,
    far: 320,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.05;
  return sun;
}

export function stationStage(): Stage {
  const d = buildDiorama();
  return {
    id: "station",
    label: "블록 친구들이 기차를 타는 기차역",
    root: d.root,
    setupLights(scene, lite) {
      scene.background = skyBackground("#9fd0ee", "#d9ecf5", "#f2e6d4");
      scene.fog = new THREE.Fog("#efe4d3", 190, 420);
      // Low, warm afternoon sun: long readable shadows. Little fill light keeps them visible.
      scene.add(new THREE.HemisphereLight("#d8ecff", "#5f7a4d", 0.32));
      const sun = shadowSun("#ffe2b8", 3.6, [-90, 75, 50], lite);
      scene.add(sun);
      return sun;
    },
    frame(camera, aspect) {
      const far = Math.pow(Math.max(1, 1.65 / aspect), 0.9);
      camera.fov = aspect < 1 ? 40 : 32;
      // The whole diorama on its table, like walking up to a model railway.
      camera.position.set(0, 2 + 92 * far, 6 + 118 * far);
      return new THREE.Vector3(0, 0, 4);
    },
    focus: 0.45,
    trackY: TRACK_Y,
    loop: LOOP,
    trackAt,
    buildTrain: () => ({
      vehicles: [buildLoco(), buildCoach(), buildCoach(), buildCoach()],
      gap: 1.4,
    }),
    // Middle coach centred on the platform.
    stopAt: (offsets) => 30 + offsets[2],
    platformY: P.y,
    spot(i) {
      const perRow = 13,
        row = i < perRow ? 0 : 1,
        j = row ? i - perRow : i;
      return new THREE.Vector3(
        -27 + j * 4.5 + row * 2.2,
        P.y,
        row ? 25.7 : 22.9,
      );
    },
    maxWaiting: 26,
    arrival: "fall",
    boardPoint: (seat) => new THREE.Vector3(seat.x, P.y, P.z0 + 1.2),
    alightPoint: (seat) => new THREE.Vector3(seat.x, P.y, P.z0 + 1.6),
    // Stroll along the platform into the station building.
    // Walk to the end of the platform and into the station building's side door.
    exitPath: (from) => ({
      points: [
        new THREE.Vector3(Math.max(P.x0 + 1, Math.min(from.x, P.x1)), P.y, 24),
        new THREE.Vector3(-35, P.y, 24),
        new THREE.Vector3(-41, P.y, 24),
      ],
    }),
    benches: [-24, 24].flatMap((x) =>
      [-1, 1].map((dx) => ({
        pos: new THREE.Vector3(x + dx, P.y - 0.15, P.z1 - 1.2),
        yaw: 0,
        approach: new THREE.Vector3(x + dx, P.y, P.z1 - 2.6),
      })),
    ),
    wander() {
      for (;;) {
        const p = new THREE.Vector3(
          -30 + Math.random() * 60,
          P.y,
          21.6 + Math.random() * 3.6,
        );
        if (!(Math.abs(Math.abs(p.x) - 24) < 3.2 && p.z > 24.5)) return p;
      }
    },
    watchSpot: () => ({
      pos: new THREE.Vector3(-28 + Math.random() * 56, P.y, P.z0 + 2.0),
      yaw: Math.PI,
    }),
    hopHeight: 5,
    hasDoors: false,
    setDoors: () => {},
    master: { pos: new THREE.Vector3(P.x1 - 4, P.y, P.z0 + 2.4), yaw: -0.4 },
    steam: true,
    sounds: {
      approach: "horn",
      stop: "bell",
      depart: "horn",
      move: "chug",
      moveEvery: 3.4,
      horn: "horn",
    },
    update(t, dt, info) {
      d.signal(info.mode !== "stopped");
      d.update(t, dt);
    },
  };
}
