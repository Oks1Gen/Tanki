import * as THREE from "three";
import type { TankSpec } from "./tanks";
import type { TankMesh } from "./tank-mesh";
import type { GameResult, HudState } from "../types";

export interface Obstacle {
  box: THREE.Box3;
  mesh: THREE.Object3D;
}

export interface Tank {
  spec: TankSpec;
  mesh: TankMesh;
  hullAngle: number;
  turretAngle: number;
  velocity: number;
  health: number;
  reload: number;
  recoil: number;
  isPlayer: boolean;
  dead: boolean;
  radius: number;
  aiWander: number;
  aiTimer: number;
  aiTarget: Tank | null;
  targetTimer: number;
  blocked: number;
  barrelPitch: number;
  hpBarCanvas?: HTMLCanvasElement;
  hpBarCtx?: CanvasRenderingContext2D;
  hpBarTexture?: THREE.CanvasTexture;
  hpBarSprite?: THREE.Sprite;
  hpBarLastHp?: number;
  hpBarDirty?: boolean;
}

export interface Shell {
  group: THREE.Group;
  vel: THREE.Vector3;
  life: number;
  owner: Tank;
  damage: number;
}

export interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
}

export interface Effect {
  group: THREE.Group;
  age: number;
  life: number;
  light: THREE.PointLight | null;
  sparks: Spark[];
  grow: THREE.Mesh[];
  update: (dt: number) => boolean;
}

export interface GameCallbacks {
  onHud: (s: HudState) => void;
  onEnd: (r: GameResult) => void;
  onPause: (paused: boolean) => void;
  onAim: (x: number, y: number) => void;
}
