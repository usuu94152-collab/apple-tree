// A "stage" is one place the friends can travel from: scenery, track, platform,
// lights, camera and how friends arrive and leave. The engine (game/World) runs the
// train and the friends the same way on every stage.
import * as THREE from "three";
import type { Vehicle } from "./train";

import { StageId, stageIds as ids } from "../../../shared/protocol";
export type { StageId };
export const stageIds: StageId[] = [...ids];
export const stageNames: Record<StageId, string> = {
  station: "🚂 기차역",
  subway: "🚇 지하철역",
  spaceport: "🚀 우주기지",
};

export interface Path {
  points: THREE.Vector3[];
  /** Segment indices (from point i to i+1) where the friend rides instead of walking. */
  ride?: number[];
}
export type TrainMode =
  | "cruise"
  | "braking"
  | "stopped"
  | "closing"
  | "leaving";

export interface Stage {
  id: StageId;
  label: string;
  root: THREE.Group;
  /** Lights, background and fog; returns the shadow-casting light. */
  setupLights: (scene: THREE.Scene, lite: boolean) => THREE.DirectionalLight;
  /** Places the camera for a screen shape; returns where it looks. */
  frame: (camera: THREE.PerspectiveCamera, aspect: number) => THREE.Vector3;
  /** Tilt-shift focus line (0 bottom … 1 top). */
  focus: number;
  clip?: THREE.Plane[];
  trackY: number;
  loop: number;
  /** Route position at distance s; y/pitch/roll let vehicles fly. */
  trackAt: (s: number) => {
    x: number;
    z: number;
    yaw: number;
    y?: number;
    pitch?: number;
    roll?: number;
  };
  /** Stop at the platform every time round, even with nobody waiting. */
  alwaysStop?: boolean;
  /** Shortest stay at the platform in seconds (default 2.5). */
  dwell?: number;
  /** Cruising speed (default 8). */
  speed?: number;
  /** Shown to screen readers. */
  ariaLabel?: string;
  buildTrain: () => { vehicles: Vehicle[]; gap: number };
  /** Train position s at which it stops, given each vehicle's offset behind the lead. */
  stopAt: (offsets: number[]) => number;
  platformY: number;
  spot: (i: number) => THREE.Vector3;
  maxWaiting: number;
  arrival: "fall" | Path;
  /** Where a friend walks to before hopping into this seat (world). */
  boardPoint: (seat: THREE.Vector3) => THREE.Vector3;
  alightPoint: (seat: THREE.Vector3) => THREE.Vector3;
  exitPath: (from: THREE.Vector3) => Path;
  hopHeight: number;
  /** Bench seats: where a sitting friend's feet-origin goes, which way they face, where they step from. */
  benches: { pos: THREE.Vector3; yaw: number; approach: THREE.Vector3 }[];
  /** A random free spot on the platform to stroll to. */
  wander: () => THREE.Vector3;
  /** A spot near the track to stand and watch trains, and which way to face. */
  watchSpot: () => { pos: THREE.Vector3; yaw: number };
  hasDoors: boolean;
  setDoors: (open: number) => void;
  master: { pos: THREE.Vector3; yaw: number };
  steam: boolean;
  sounds: {
    approach: string;
    stop: string;
    depart: string;
    move: string;
    moveEvery: number;
    horn: string;
  };
  update: (
    t: number,
    dt: number,
    info: {
      mode: TrainMode;
      doors: number;
      speed: number;
      puff: (
        pos: THREE.Vector3,
        vel: THREE.Vector3,
        size: number,
        life: number,
        color?: string,
        grow?: number,
      ) => void;
    },
  ) => void;
}
